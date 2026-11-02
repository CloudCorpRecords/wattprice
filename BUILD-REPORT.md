# wattprice — Build Report

MCP Rebuild 1000, Batch 11. Rebuild of `rfdez/pvpc-mcp-server`
(rank 611), built from the firsthand spec in
`~/workspace/mcp-rebuild-100/specs-batch11/pvpc.md` (README
Inputs list read firsthand from the public repo, 2026-10-27).
Local build only — nothing pushed or published.

Identity: repo `wattprice`, npm `@reneturcios/wattprice`,
MCP name `io.github.CloudCorpRecords/wattprice`, version
`0.1.0`, bin `wattprice` → `dist/cli.js`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json`, `server.json` (description "Fetch PVPC
  electricity prices from Spain's ESIOS API by date range and
  area.", 76 chars ≤100; npm entry carries `version: 0.1.0`;
  OCI entry `ghcr.io/cloudcorprecords/wattprice:0.1.0` carries
  **no** `version` field), `Dockerfile` (node:20-alpine
  two-stage, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/wattprice"`),
  `tsconfig.json`, `.gitignore`, `LICENSE` (MIT, Copyright (c)
  2026 Rene Turcios), `README.md` (fresh text), `CHANGELOG.md`
  (single 0.1.0 entry, 2026-10-27), `package-lock.json`
  (Route 3, see below)
- `src/index.ts`, `src/cli.ts` (`prices` with one flag per
  tool argument, `mcp`, `--version`; exit 2 usage / 1 runtime
  error), `src/mcp.ts`, `src/types.ts`, `src/wattprice.ts`
  (core, `VERSION = "0.1.0"`)
- `test/wattprice.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`

## Tools implemented (1)

- `fetch_prices` — all arguments optional: `locale` (string
  enum es/en, default es), `startDate` (string, default start
  of today), `endDate` (string, default end of today),
  `timeAggregation` (enum sum/average, default sum),
  `timeTruncation` (enum hour/day/month/year),
  `geographicalAggregation` (enum sum/average, default sum),
  `geographicalIds` (array of strings; documented IDs 3,
  8741–8745; default the five 8741–8745),
  `geographicalTruncation` (enum country/electric_system).

  Defaults are stated in the schema descriptions only — no
  JSON `"default"` keys — and the fixture literal and the
  `src/mcp.ts` literal are identical, with no `required`, no
  `additionalProperties`, no `$schema`.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with explicit
  inputSchema literals exactly matching the fixture, per the
  standing fleet rule; zod still validates every `tools/call`.
- The core is a forwarding client to the ESIOS API:
  `GET ${ESIOS_API_BASE | https://api.esios.ree.es}/indicators/1001`
  (1001 is the PVPC indicator), with the documented filters
  mapped to query parameters (`locale`, `start_date`,
  `end_date`, `time_agg`, `time_trunc`, `geo_agg`, `geo_ids`,
  `geo_trunc`). The caller's key (env `ESIOS_API_KEY`) travels
  as the `x-api-key` token header. Fetch is injectable
  (`WattpriceDeps.fetchFn`, plus injectable key/base/clock);
  no test touches the live network.
- Documented defaults are applied by the core before the
  request is shaped: locale `es`, both aggregations `sum`,
  geographical IDs 8741–8745, and start/end of today (injected
  clock, local time) for an absent date range.
- Honest failure modes: no key → error naming `ESIOS_API_KEY`
  before any request (MCP: `isError`; CLI: exit 1); non-200
  upstream → error carrying the status and a body snippet;
  non-JSON success body → error. Prices are never fabricated.
- The core also re-validates every enum and geographical ID,
  so the CLI path gets the same rejection behaviour as the
  zod layer in front of the MCP path.

## Verification (foreground, this session)

- `tsc --noEmit` exit 0; `tsc` build exit 0 (`dist/cli.js`)
- `tsx --test test/*.test.ts`: **10 tests, 10 pass, 0 fail** —
  missing-key refusal (fetch never called), default range =
  start/end of today, explicit range preserved, documented
  defaults + token header in the shaped query, full filter
  forwarding with base-URL override, `ESIOS_API_BASE` env
  override, per-enum rejection naming the argument,
  undocumented geographical ID rejection, non-200 surfacing,
  non-JSON body rejection
- `dist/cli.js --version` → `0.1.0`; unknown command exits 2
  with usage; `prices` with no key exits 1 naming
  `ESIOS_API_KEY`
- Parity: `harness/parity.py` vs
  `harness/fixtures/pvpc-mcp-server-tools-original.json` →
  **PASS, parity 100.0, identical_tools 1/1**

## Lockfile status

`package-lock.json` generated clean via Route 3 (temp copy
with only `package.json`, offline `npm install
--package-lock-only --ignore-scripts --offline`), verified:
parses, name `@reneturcios/wattprice`, **128 package
entries**. Local `node_modules` is a symlink to the sibling
burnmeter tree; gitignored.

## Gaps / honest notes

- **geographicalIds encoding choice:** the README publishes the
  IDs as a prose list of quoted strings; the schema encodes
  them as an **array of strings** (per the spec's documented
  choice), and on the wire the core sends them comma-joined as
  a single `geo_ids` query parameter. The exact upstream wire
  shape is unverified — no live ESIOS call was made (program
  rule) — so the parameter names, the `/indicators/1001` path,
  and the `x-api-key` header follow the ESIOS API's published
  conventions rather than a captured request.
- Live upstream behaviour is unproven: no real key was
  available in the build environment, so request acceptance,
  payload shape, and rate limits were not exercised.
- Container build not exercised locally; the
  publish-container workflow smoke-tests the image at publish
  time.
