/**
 * wattprice core: one forwarding query to the ESIOS API.
 *
 *   fetchPrices(args, deps) -> prices payload (parsed JSON)
 *
 * The query targets the PVPC indicator (ESIOS indicator 1001)
 * at `${base}/indicators/1001`, with the documented filters
 * mapped onto the API's query parameters:
 *
 *   locale                  -> locale
 *   startDate / endDate     -> start_date / end_date
 *   timeAggregation         -> time_agg
 *   timeTruncation          -> time_trunc
 *   geographicalAggregation -> geo_agg
 *   geographicalIds         -> geo_ids (comma-joined)
 *   geographicalTruncation  -> geo_trunc
 *
 * Documented defaults are applied here, by the core, before the
 * request is shaped: locale "es", both aggregations "sum", the
 * five geographical system IDs 8741–8745, and — for an absent
 * date range — the start and end of today (from the injected
 * clock, local time).
 *
 * The caller's own ESIOS API key (env ESIOS_API_KEY) travels as
 * the API's `x-api-key` token header. Without a key the core
 * refuses with an error naming ESIOS_API_KEY: wattprice never
 * invents prices to fill an unauthenticated gap.
 */
import type { FetchPricesArgs, FetchResponseLike, WattpriceDeps } from "./types.js";

export const VERSION = "0.1.0";

export const DEFAULT_BASE_URL = "https://api.esios.ree.es";

/** ESIOS indicator id for the PVPC tariff. */
export const PVPC_INDICATOR_ID = "1001";

export const DEFAULT_GEOGRAPHICAL_IDS = ["8741", "8742", "8743", "8744", "8745"];

const LOCALES = ["es", "en"];
const AGGREGATIONS = ["sum", "average"];
const TIME_TRUNCATIONS = ["hour", "day", "month", "year"];
const GEOGRAPHICAL_TRUNCATIONS = ["country", "electric_system"];
const KNOWN_GEOGRAPHICAL_IDS = ["3", "8741", "8742", "8743", "8744", "8745"];

function checkEnum(
  label: string,
  value: string | undefined,
  allowed: string[],
): string | undefined {
  if (value === undefined) return undefined;
  if (!allowed.includes(value)) {
    throw new Error(
      `${label} must be one of ${allowed.map((v) => `"${v}"`).join(", ")}; got "${value}"`,
    );
  }
  return value;
}

function checkGeographicalIds(value: string[] | undefined): string[] {
  if (value === undefined) return [...DEFAULT_GEOGRAPHICAL_IDS];
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw new Error("geographicalIds must be an array of strings");
  }
  for (const id of value) {
    if (!KNOWN_GEOGRAPHICAL_IDS.includes(id)) {
      throw new Error(
        `geographicalIds entries must be one of ${KNOWN_GEOGRAPHICAL_IDS.map((v) => `"${v}"`).join(", ")}; got "${id}"`,
      );
    }
  }
  return [...value];
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

async function defaultFetch(
  url: string,
  init: { headers: Record<string, string> },
): Promise<FetchResponseLike> {
  return fetch(url, { method: "GET", headers: init.headers });
}

/** The exact request the core will send, without sending it. */
export function buildRequest(
  args: FetchPricesArgs,
  deps: WattpriceDeps = {},
): { url: string; headers: Record<string, string> } {
  const apiKey = deps.apiKey ?? process.env.ESIOS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ESIOS_API_KEY is not set: wattprice needs your ESIOS API key (free registration at esios.ree.es) to fetch PVPC prices, and will not fabricate prices without one",
    );
  }

  const locale = checkEnum("locale", args.locale, LOCALES) ?? "es";
  const timeAggregation =
    checkEnum("timeAggregation", args.timeAggregation, AGGREGATIONS) ?? "sum";
  const timeTruncation = checkEnum("timeTruncation", args.timeTruncation, TIME_TRUNCATIONS);
  const geographicalAggregation =
    checkEnum("geographicalAggregation", args.geographicalAggregation, AGGREGATIONS) ?? "sum";
  const geographicalTruncation = checkEnum(
    "geographicalTruncation",
    args.geographicalTruncation,
    GEOGRAPHICAL_TRUNCATIONS,
  );
  const geographicalIds = checkGeographicalIds(args.geographicalIds);

  const now = deps.now ?? new Date();
  const startDate = args.startDate ?? startOfDay(now).toISOString();
  const endDate = args.endDate ?? endOfDay(now).toISOString();

  const base = (deps.baseUrl ?? process.env.ESIOS_API_BASE ?? DEFAULT_BASE_URL).replace(
    /\/+$/,
    "",
  );
  const params = new URLSearchParams();
  params.set("locale", locale);
  params.set("start_date", startDate);
  params.set("end_date", endDate);
  params.set("time_agg", timeAggregation);
  if (timeTruncation !== undefined) params.set("time_trunc", timeTruncation);
  params.set("geo_agg", geographicalAggregation);
  params.set("geo_ids", geographicalIds.join(","));
  if (geographicalTruncation !== undefined) params.set("geo_trunc", geographicalTruncation);

  return {
    url: `${base}/indicators/${PVPC_INDICATOR_ID}?${params.toString()}`,
    headers: { Accept: "application/json", "x-api-key": apiKey },
  };
}

/** Fetch PVPC prices from the ESIOS API and return the parsed payload. */
export async function fetchPrices(
  args: FetchPricesArgs,
  deps: WattpriceDeps = {},
): Promise<unknown> {
  const { url, headers } = buildRequest(args, deps);
  const fetchFn = deps.fetchFn ?? defaultFetch;
  let response: FetchResponseLike;
  try {
    response = await fetchFn(url, { headers });
  } catch (err) {
    throw new Error(
      `ESIOS API request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `ESIOS API returned HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
    );
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("ESIOS API returned a non-JSON response; cannot present it as prices");
  }
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
