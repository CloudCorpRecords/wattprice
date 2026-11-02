/**
 * wattprice types.
 *
 * wattprice forwards one query — the PVPC (Voluntary Price for
 * the Small Consumer) indicator published by Red Eléctrica de
 * España — to the ESIOS API and hands the caller the prices
 * payload back as JSON. Every argument is optional: the locale,
 * the two aggregations, and the geographical ID list carry
 * documented defaults, and an absent date range means today,
 * from its first to its last millisecond.
 */

/** Arguments accepted by `fetch_prices`, exactly as documented. */
export interface FetchPricesArgs {
  /** Translations for sources: "es" or "en". Defaults to "es". */
  locale?: string;
  /** Beginning of the date range, ISO 8601. Defaults to the start of today. */
  startDate?: string;
  /** End of the date range, ISO 8601. Defaults to the end of today. */
  endDate?: string;
  /** Time grouping aggregation: "sum" or "average". Defaults to "sum". */
  timeAggregation?: string;
  /** Time series truncation: "hour", "day", "month", or "year". */
  timeTruncation?: string;
  /** Geographical grouping aggregation: "sum" or "average". Defaults to "sum". */
  geographicalAggregation?: string;
  /**
   * Geographical IDs to filter by, as strings: "3" (España),
   * "8741" (Península), "8742" (Canarias), "8743" (Baleares),
   * "8744" (Ceuta), "8745" (Melilla). Defaults to the five
   * 8741–8745 system IDs.
   */
  geographicalIds?: string[];
  /** Geographical grouping: "country" or "electric_system". */
  geographicalTruncation?: string;
}

/** The minimal slice of a fetch Response this client relies on. */
export interface FetchResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

/** Injectable fetch, so tests never touch the live network. */
export type FetchFn = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<FetchResponseLike>;

/** Runtime dependencies for the core, all injectable in tests. */
export interface WattpriceDeps {
  /** ESIOS API key. Falls back to the ESIOS_API_KEY env var. */
  apiKey?: string;
  /** API base URL. Falls back to ESIOS_API_BASE, then the public API. */
  baseUrl?: string;
  /** Fetch implementation. Defaults to the global fetch. */
  fetchFn?: FetchFn;
  /** Clock used to resolve "today" for an absent date range. */
  now?: Date;
}
