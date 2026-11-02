#!/usr/bin/env node
/**
 * wattprice CLI.
 *
 *   wattprice prices [--locale es|en] [--start-date ISO] [--end-date ISO]
 *                    [--time-aggregation sum|average]
 *                    [--time-truncation hour|day|month|year]
 *                    [--geographical-aggregation sum|average]
 *                    [--geographical-ids 8741,8742,...]
 *                    [--geographical-truncation country|electric_system]
 *   wattprice mcp
 *
 * `prices` runs the same forwarding query as the MCP tool and
 * prints the ESIOS payload as JSON. It needs ESIOS_API_KEY in
 * the environment (ESIOS_API_BASE overrides the API base URL).
 * Exit codes: 0 success, 1 runtime error (including the honest
 * missing-key error), 2 usage error.
 */
import type { FetchPricesArgs } from "./types.js";
import { fetchPrices, formatPayload, VERSION } from "./wattprice.js";

function usage(): never {
  console.error(`Usage:
  wattprice prices [--locale es|en] [--start-date <iso>] [--end-date <iso>] [--time-aggregation sum|average] [--time-truncation hour|day|month|year] [--geographical-aggregation sum|average] [--geographical-ids <id,id,...>] [--geographical-truncation country|electric_system]
  wattprice mcp
  wattprice --version`);
  process.exit(2);
}

type StringArgKey = Exclude<keyof FetchPricesArgs, "geographicalIds">;

const VALUE_FLAGS = new Map<string, StringArgKey>([
  ["--locale", "locale"],
  ["--start-date", "startDate"],
  ["--end-date", "endDate"],
  ["--time-aggregation", "timeAggregation"],
  ["--time-truncation", "timeTruncation"],
  ["--geographical-aggregation", "geographicalAggregation"],
  ["--geographical-truncation", "geographicalTruncation"],
]);

function parsePricesArgs(rest: string[]): FetchPricesArgs {
  const args: FetchPricesArgs = {};
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    if (flag === "--geographical-ids") {
      const value = rest[++i];
      if (value === undefined) usage();
      args.geographicalIds = value.split(",").map((v) => v.trim()).filter(Boolean);
      continue;
    }
    const key = VALUE_FLAGS.get(flag);
    if (key === undefined) usage();
    const value = rest[++i];
    if (value === undefined) usage();
    args[key] = value;
  }
  return args;
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    if (rest.length !== 0) usage();
    await import("./mcp.js");
    return;
  }
  if (cmd !== "prices") usage();

  const args = parsePricesArgs(rest);
  try {
    const out = await fetchPrices(args);
    console.log(formatPayload(out));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
