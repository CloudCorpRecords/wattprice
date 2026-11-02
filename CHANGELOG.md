# Changelog

## 0.1.0 (2026-10-27)

- Initial release: `fetch_prices` MCP tool and `prices` CLI
  command forwarding a PVPC query to the ESIOS API, with the
  documented filters (locale, date range, time and
  geographical aggregation/truncation, geographical IDs).
- Documented defaults applied by the core: locale `es`, both
  aggregations `sum`, geographical IDs 8741–8745, and the
  start/end of today for an absent date range.
- The caller's key comes from `ESIOS_API_KEY`; without it the
  call fails with an error naming that variable rather than
  returning invented prices.
