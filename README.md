# wattprice

What does electricity cost right now under Spain's regulated
PVPC tariff? wattprice asks the ESIOS API — the data service
run by Red Eléctrica de España — for the PVPC (Voluntary Price
for the Small Consumer) indicator and returns the prices
payload as JSON, for a date range and geographical area you
choose.

Everything except the API key itself is optional, with the
defaults the upstream documents:

- `locale` — `es` (default) or `en`
- `startDate` / `endDate` — ISO 8601 bounds; an absent range
  means today, start to end of day
- `timeAggregation` — `sum` (default) or `average`
- `timeTruncation` — `hour`, `day`, `month`, or `year`
- `geographicalAggregation` — `sum` (default) or `average`
- `geographicalIds` — string IDs: `3` España, `8741`
  Península, `8742` Canarias, `8743` Baleares, `8744` Ceuta,
  `8745` Melilla; defaults to the five system IDs 8741–8745
- `geographicalTruncation` — `country` or `electric_system`

## Configuration

You bring your own ESIOS API key (free registration at
esios.ree.es):

```bash
export ESIOS_API_KEY="your key"
```

Without it, wattprice does not guess: the call fails with an
error naming `ESIOS_API_KEY`, and no prices are invented.
`ESIOS_API_BASE` overrides the API base URL
(`https://api.esios.ree.es` by default).

## CLI

```bash
ESIOS_API_KEY=... npx @reneturcios/wattprice prices
ESIOS_API_KEY=... npx @reneturcios/wattprice prices --locale en --time-truncation day --geographical-ids 8741
npx @reneturcios/wattprice --version
```

Output is the ESIOS prices payload as JSON. Exit codes: `0` on
success, `1` on a runtime error (including a missing key or a
non-200 upstream response), `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/wattprice mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "wattprice": {
      "command": "npx",
      "args": ["-y", "@reneturcios/wattprice", "mcp"],
      "env": { "ESIOS_API_KEY": "your key" }
    }
  }
}
```

### Tools

- `fetch_prices` — Fetch PVPC prices for a given date range
  and geographical area. All arguments are optional; see the
  defaults list above.

## Docker

```bash
docker run -i -e ESIOS_API_KEY="your key" ghcr.io/cloudcorprecords/wattprice
docker run --rm -e ESIOS_API_KEY="your key" ghcr.io/cloudcorprecords/wattprice prices --locale en
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (fake fetch, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
