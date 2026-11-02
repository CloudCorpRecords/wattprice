import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRequest, fetchPrices } from "../src/wattprice.js";
import type { FetchFn } from "../src/types.js";

/**
 * Every test runs against an injected fake fetch: no live
 * network, no real ESIOS key. The fake records the request it
 * was handed and answers with a fixed prices payload.
 */

const PAYLOAD = {
  indicator: { id: 1001, name: "PVPC" },
  values: [{ value: 0.123, datetime: "2026-10-27T00:00:00.000+02:00", geo_id: 8741 }],
};

function fakeFetch(captured: { url?: string; headers?: Record<string, string> }): FetchFn {
  return async (url, init) => {
    captured.url = url;
    captured.headers = init.headers;
    return { ok: true, status: 200, text: async () => JSON.stringify(PAYLOAD) };
  };
}

const KEY = { apiKey: "test-key" };
const NOW = new Date(2026, 9, 27, 15, 30, 0); // 2026-10-27, local afternoon

describe("fetchPrices — missing key", () => {
  it("refuses with an error naming ESIOS_API_KEY and never calls fetch", async () => {
    const saved = process.env.ESIOS_API_KEY;
    delete process.env.ESIOS_API_KEY;
    let called = false;
    const spyFetch: FetchFn = async () => {
      called = true;
      return { ok: true, status: 200, text: async () => "{}" };
    };
    try {
      await assert.rejects(
        () => fetchPrices({}, { fetchFn: spyFetch, apiKey: "" }),
        /ESIOS_API_KEY is not set/,
      );
      // buildRequest with no key anywhere available also refuses.
      assert.throws(() => buildRequest({}, { apiKey: "" }), /ESIOS_API_KEY/);
      assert.equal(called, false);
    } finally {
      if (saved !== undefined) process.env.ESIOS_API_KEY = saved;
    }
  });
});

describe("fetchPrices — default range application", () => {
  it("defaults an absent range to the start and end of today", async () => {
    const captured: { url?: string } = {};
    const out = await fetchPrices({}, { ...KEY, fetchFn: fakeFetch(captured), now: NOW });
    assert.deepEqual(out, PAYLOAD);
    const url = new URL(captured.url!);
    assert.equal(url.searchParams.get("start_date"), new Date(2026, 9, 27, 0, 0, 0, 0).toISOString());
    assert.equal(url.searchParams.get("end_date"), new Date(2026, 9, 27, 23, 59, 59, 999).toISOString());
  });

  it("keeps an explicitly supplied range untouched", async () => {
    const captured: { url?: string } = {};
    await fetchPrices(
      { startDate: "2025-06-29T00:00:00.000+02:00", endDate: "2025-06-29T23:59:59.999+02:00" },
      { ...KEY, fetchFn: fakeFetch(captured), now: NOW },
    );
    const url = new URL(captured.url!);
    assert.equal(url.searchParams.get("start_date"), "2025-06-29T00:00:00.000+02:00");
    assert.equal(url.searchParams.get("end_date"), "2025-06-29T23:59:59.999+02:00");
  });
});

describe("fetchPrices — query shaping", () => {
  it("applies the documented defaults and sends the key as the token header", async () => {
    const captured: { url?: string; headers?: Record<string, string> } = {};
    await fetchPrices({}, { ...KEY, fetchFn: fakeFetch(captured), now: NOW });
    const url = new URL(captured.url!);
    assert.equal(url.origin + url.pathname, "https://api.esios.ree.es/indicators/1001");
    assert.equal(url.searchParams.get("locale"), "es");
    assert.equal(url.searchParams.get("time_agg"), "sum");
    assert.equal(url.searchParams.get("geo_agg"), "sum");
    assert.equal(url.searchParams.get("geo_ids"), "8741,8742,8743,8744,8745");
    assert.equal(url.searchParams.get("time_trunc"), null);
    assert.equal(url.searchParams.get("geo_trunc"), null);
    assert.equal(captured.headers!["x-api-key"], "test-key");
    assert.equal(captured.headers!.Accept, "application/json");
  });

  it("forwards every supplied filter, comma-joining geographicalIds", async () => {
    const captured: { url?: string } = {};
    await fetchPrices(
      {
        locale: "en",
        timeAggregation: "average",
        timeTruncation: "day",
        geographicalAggregation: "average",
        geographicalIds: ["3", "8741"],
        geographicalTruncation: "country",
      },
      { ...KEY, fetchFn: fakeFetch(captured), now: NOW, baseUrl: "https://example.test/api/" },
    );
    const url = new URL(captured.url!);
    assert.equal(url.origin + url.pathname, "https://example.test/api/indicators/1001");
    assert.equal(url.searchParams.get("locale"), "en");
    assert.equal(url.searchParams.get("time_agg"), "average");
    assert.equal(url.searchParams.get("time_trunc"), "day");
    assert.equal(url.searchParams.get("geo_agg"), "average");
    assert.equal(url.searchParams.get("geo_ids"), "3,8741");
    assert.equal(url.searchParams.get("geo_trunc"), "country");
  });

  it("honours the ESIOS_API_BASE override from the environment", async () => {
    const saved = process.env.ESIOS_API_BASE;
    process.env.ESIOS_API_BASE = "https://env.example.test";
    try {
      const captured: { url?: string } = {};
      await fetchPrices({}, { ...KEY, fetchFn: fakeFetch(captured), now: NOW });
      assert.ok(captured.url!.startsWith("https://env.example.test/indicators/1001?"));
    } finally {
      if (saved === undefined) delete process.env.ESIOS_API_BASE;
      else process.env.ESIOS_API_BASE = saved;
    }
  });
});

describe("fetchPrices — enum validation", () => {
  it("rejects values outside each documented enum, naming the argument", async () => {
    const fetchFn = fakeFetch({});
    await assert.rejects(() => fetchPrices({ locale: "fr" }, { ...KEY, fetchFn }), /locale must be one of/);
    await assert.rejects(
      () => fetchPrices({ timeAggregation: "median" }, { ...KEY, fetchFn }),
      /timeAggregation must be one of/,
    );
    await assert.rejects(
      () => fetchPrices({ timeTruncation: "week" }, { ...KEY, fetchFn }),
      /timeTruncation must be one of/,
    );
    await assert.rejects(
      () => fetchPrices({ geographicalAggregation: "max" }, { ...KEY, fetchFn }),
      /geographicalAggregation must be one of/,
    );
    await assert.rejects(
      () => fetchPrices({ geographicalTruncation: "region" }, { ...KEY, fetchFn }),
      /geographicalTruncation must be one of/,
    );
  });

  it("rejects an undocumented geographical ID", async () => {
    await assert.rejects(
      () => fetchPrices({ geographicalIds: ["9999"] }, { ...KEY, fetchFn: fakeFetch({}) }),
      /geographicalIds entries must be one of/,
    );
  });
});

describe("fetchPrices — upstream failures", () => {
  it("surfaces a non-200 status instead of fabricating prices", async () => {
    const failing: FetchFn = async () => ({
      ok: false,
      status: 401,
      text: async () => "invalid token",
    });
    await assert.rejects(
      () => fetchPrices({}, { ...KEY, fetchFn: failing }),
      /ESIOS API returned HTTP 401: invalid token/,
    );
  });

  it("rejects a non-JSON success body", async () => {
    const html: FetchFn = async () => ({
      ok: true,
      status: 200,
      text: async () => "<html>oops</html>",
    });
    await assert.rejects(
      () => fetchPrices({}, { ...KEY, fetchFn: html }),
      /non-JSON response/,
    );
  });
});
