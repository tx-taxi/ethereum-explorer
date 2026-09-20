# tx.taxi Ethereum explorer deployment

This fork deploys the upstream Blockscout frontend at `https://eth.tx.taxi` and
reads Ethereum data from the public `https://eth.blockscout.com` API. It does
not run a Blockscout indexer or Ethereum node.

The source remains GPL-3.0. Keep `LICENSE`, source notices, and the built-in
Blockscout footer attribution intact when publishing modified builds. The
tx.taxi footer links users to the fork source at
`https://github.com/tx-taxi/ethereum-explorer`.

## Coolify configuration

Create a Dockerfile application from the repository root with these settings:

| Setting | Value |
| --- | --- |
| Domain | `https://eth.tx.taxi` |
| Dockerfile | `Dockerfile` |
| Docker context | `.` |
| Exposed port | `3000` |
| Health check path | `/` |
| Build argument | `ENVS_PRESET=tx_taxi` |
| Build argument | `GIT_TAG=v2.7.1-tx-taxi` |

`ENVS_PRESET` is declared in the final Docker stage. Supplying it as a build
argument stores the image's runtime default; the Next.js build does not consume
the preset. Setting the same variable in Coolify at runtime is the authoritative
and overrideable configuration, and is required if images may be built without
that argument.

Set these runtime environment variables:

```dotenv
ENVS_PRESET=tx_taxi
HOSTNAME=0.0.0.0
NEXT_PUBLIC_APP_PROTOCOL=https
NEXT_PUBLIC_APP_HOST=eth.tx.taxi
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_API_WEBSOCKET_PROTOCOL=wss
NEXT_TELEMETRY_DISABLED=1
```

Do not set `NEXT_PUBLIC_APP_BASE_URL`; the explorer is mounted at the domain
root. Do not enable Coolify's static-site mode. The upstream multi-stage
Dockerfile builds and runs the standalone Next.js server, so no Dockerfile
variant is required.

Set `HOSTNAME` explicitly: Docker otherwise supplies the container hostname,
which Next.js uses as its bind address. The app can then respond on its bridge IP
while localhost health probes fail with connection refused. Binding to `0.0.0.0`
makes both checks work; it does not publish a host port or assign a public route.
Keep the domain unassigned during private validation, then set it only at cutover.

The preset uses raw GitHub URLs for the four brand assets on the pinned
`tx-taxi` branch. They become available after the parent publishes this tree as
`tx-taxi/ethereum-explorer`.
For a pre-publication local image build, override those four variables with
reachable HTTPS asset URLs; the runtime asset downloader does not accept paths
served by the application that has not started yet.

## Local production check

```bash
docker build \
  --build-arg ENVS_PRESET=tx_taxi \
  --build-arg GIT_TAG=v2.7.1-tx-taxi \
  -t tx-taxi-ethereum-explorer:v2.7.1 .

docker run --rm -p 3000:3000 \
  -e ENVS_PRESET=tx_taxi \
  -e HOSTNAME=0.0.0.0 \
  -e NEXT_PUBLIC_APP_PROTOCOL=http \
  -e NEXT_PUBLIC_APP_HOST=localhost \
  -e NEXT_PUBLIC_APP_PORT=3000 \
  -e NEXT_PUBLIC_APP_ENV=production \
  -e NEXT_PUBLIC_API_WEBSOCKET_PROTOCOL=wss \
  tx-taxi-ethereum-explorer:v2.7.1
```

Open `http://localhost:3000` and smoke-test:

- `/blocks`
- `/txs`
- `/accounts`
- `/tokens`
- `/verified-contracts`
- a known `/tx/{hash}`, `/address/{hash}`, and `/token/{hash}` page
- the Bitcoin, Monero, and Ethereum entries in the network switcher
- the source link and upstream Blockscout attribution in the footer

## Public API boundary

This configuration was checked against the public API on 2026-09-19. The
following endpoints returned HTTP 200:

- `/api/v2/stats`
- `/api/v2/blocks`
- `/api/v2/transactions`
- `/api/v2/addresses/{address}`
- `/api/v2/tokens`
- `/api/v2/smart-contracts`
- `/api/v2/main-page/indexing-status`
- `/api/v2/config/backend`
- `/api/v2/config/backend-version`

The API reported backend `v11.3.1.+commit.b7671f6c`. This is a point-in-time
smoke test, not a blanket compatibility guarantee. Optional account,
marketplace, metadata, user-operation, stats-microservice, and third-party
widget APIs are deliberately not configured. Anonymous API availability,
schema stability, request limits, and websocket behavior remain controlled by
the public Blockscout instance. Before production launch, verify the routes
above in-browser and retain a migration path to Blockscout Pro API or a
self-hosted backend.

## Security status

The security-only dependency pass pins Next.js `15.5.24`, protobufjs `7.6.1`,
axios `1.20.0`, sharp `0.35.4`, ws `8.21.3`, js-cookie `3.0.8`, and
path-to-regexp `8.4.2`. The resulting production audit on 2026-09-19 reported
zero critical findings, down from 8. Typecheck and the production Next.js build
both pass.

The audit still reports 171 high paths, representing 38 unique advisory records
across 19 packages. See [TX_TAXI_SECURITY_AUDIT.md](TX_TAXI_SECURITY_AUDIT.md)
for the package/path table and standalone runtime assessment. The reachable
Helia/libp2p and API-doc groups have been remediated; image scanning and browser
smoke testing remain production cutover gates.

The build emits one non-fatal warning for optional
`@react-native-async-storage/async-storage` through the disabled wallet stack.
A Docker image build was not run because Docker is unavailable in the local
validation environment. Run the image build and browser route smoke tests above
before assigning the public production route.
# Chain Menu Asset Follow-up

The tx.taxi preset now uses local Bitcoin and official Monero symbols, plus the
existing Ethereum symbol, for its featured networks. All three use the upstream
menu's fixed 20px icon box. Provenance is recorded in
`public/static/tx-taxi/chains/ASSETS.md`.

TypeScript, preset parsing, asset generation, and file existence checks pass.
The component suite compiled but its visual run was not clean: expected Chromium
1200 was unavailable and substituting installed Chromium 1208 produced snapshot
differences. No snapshots were replaced. The loopback staged image `e8dc748`
still has the earlier placeholder menu until the next image is built and applied.

The `/tokens` list is not stuck: a live browser probe received valid token rows
after roughly 15-20 seconds. Three direct upstream samples took 32.0, 21.2, and
20.5 seconds and each returned 50 valid tokens. Eight-second skeleton screenshots
must not be used as proof of token rendering, or as proof of a frontend defect.

## Runtime Icon Validation

The org-authenticated Coolify build at `a574600` succeeded, but startup failed
because featured-network icon validation required absolute URLs. The validator
now permits root-relative icon assets while keeping other URL fields unchanged.
Runtime fixtures retain absolute icons and network groups, and add the actual
tx.taxi icon paths. Negative fixtures reject protocol-relative, ordinary relative,
encoded traversal, encoded slash and encoded backslash paths. The full runtime
validator suite and exact tx.taxi preset validation pass; production startup and
browser checks must be repeated on the next image. No public domain was assigned
to the failed candidate.

## GraphQL and Theme Script Follow-up

GraphiQL now imports its documented Webpack worker bootstrap so Monaco starts
same-origin workers instead of failing on `require.toUrl`. The CSP allows the
exact next-themes bootstrap hashes for both system and configured default themes;
it does not add script `unsafe-inline`. The dark tx.taxi preset emits
`sha256-Os32ny+s3zEaX+XxoAVngBThnQv/IOycQlrqgxXOgRI=`. Its hash was absent in
image `597f528` and present in the fixed local production response.

The focused CSP test, root typecheck and Next production compilation pass. The
rebuilt local GraphQL page launched five same-origin workers and rendered a real
transaction query with no page exceptions, `toUrl` errors, CSP violations or
document overflow. Its four missing sprite/config resources came from using
the partial local asset pipeline; the complete private container had no missing
resources. Repeat these checks on the final complete image before cutover.

## Entity HTTP Status Checks (Source Only)

Block and transaction page handlers now validate identifiers and check the
configured public API before responding. Missing entities return HTTP 404;
provider failures, malformed responses and timeouts return HTTP 503 with
`Retry-After: 30`. Both failure paths emit `noindex` and `no-store`. Existing
feature guards and the separate block-countdown route are preserved.

The shared source coalesces identical requests, allows four concurrent distinct
requests, caps each response at 2 MiB and each request at five seconds, and
caches successes for ten seconds within 32-entry / 16-MiB limits. Redirects are
not followed and request cookies are not forwarded. Entity identity is checked
against the request; this is not full validation of every Blockscout field.

Validated data is retained in page props, but the upstream dynamic imports and
mount gate still prevent entity detail SSR. Query hydration, server-rendered
details, entity metadata, live status verification and a candidate image rebuild
remain required. These source changes are not deployed and do not close the
production SSR gate.

Validation on 2026-09-19: 17 focused Vitest tests, targeted ESLint and full
TypeScript compilation pass. A live call through the actual source returned
block #1 with its matching hash and height; an all-zero transaction hash
returned 404. These are provider-boundary checks, not browser or built-image
verification.

## Entity Detail SSR (Local Production Verified)

The follow-up hydrates Blockscout's existing query cache from an isolated
per-request QueryClient. The block and transaction pages now render the upstream
detail components on the server, and the read-only Wagmi provider no longer
suppresses its child tree during SSR. Wallet-connection providers remain
client-only. Hydrated pages use matching initial responsive state, and the
transaction tab loading state recognizes server-fetched data.

The Next.js production build, full TypeScript compilation, targeted ESLint and
18 focused tests pass. `tools/scripts/entity-ssr-smoke.cjs` verifies real block
46147 and transaction
`0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060`
with JavaScript disabled, then at 1440px and 390px with hydration enabled. Both
views retain details without page/hydration errors, failed resources or document
overflow. Previous/next block navigation and copying the complete transaction
hash pass. Malformed block/transaction IDs and a missing valid-shaped transaction
return HTTP 404 with `noindex`.

Local evidence: `/tmp/tx-taxi-eth-entity-ssr.json` and its screenshots.
The existing GraphiQL probe also passes with a real query, five same-origin
workers, no console/page errors, no failed requests and no overflow:
`/tmp/tx-taxi-eth-graphiql-entity-ssr.json`.

This is local production-build evidence, not a deployed-image claim. Canonical
URLs, entity social metadata, other entity routes, broader malformed-provider
payload validation and final image/security verification remain open. No public
domain has been changed.

## Cross-Timezone Hydration Follow-up

Running the first SSR candidate (`9fe6a63`) with a UTC server and a Phoenix
browser exposed React hydration error #418 in local timestamps. Coolify job
`vodxgc2j7dia0zu77hgkzv75` was cancelled before replacing the healthy `6425457`
container, and the application's commit pin was restored to that revision.

The fix serializes the request time for relative labels and uses UTC for initial
absolute labels; local formatting resumes after hydration. This is scoped to
hydrated entity pages. Three new clock tests bring the focused suite to 21
passing tests; full TypeScript, targeted lint and the UTC production build pass.
The smoke script now explicitly uses Phoenix (1440px) and Tokyo (390px), adds a
recent real block, and passes all 12 checks. No-JavaScript details, next/previous
navigation, full-hash copying, 404/noindex responses and zero captured
hydration/page/resource errors or document overflow are verified in
`/tmp/tx-taxi-eth-entity-ssr-time-fixed.json`. Recent-block mobile and transaction
desktop screenshots were visually reviewed. Deployed-image verification remains
required before assigning a public domain.

## Private Image Verification: 408882a

Coolify job `jjm3q6shu6xvckxn0fmtdroh` finished successfully at pinned source
`408882a789f364a7c1786990585242e15d85bf78`. The running container is
`fr5ydadyrvhakbg79vytbrbo-060837377371`, image
`sha256:192e607fbf3a3933d42c792d8f4b9a97faf27c491b33ebad9789a613cff6760f`.
It is healthy with zero restarts, no domain and no published host port.
Autodeploy remains disabled. Previous image
`sha256:2de2c4aba419a7efe9eeb84ce0fa81f43feda075beeb3c316f533da427d89df6`
is retained for rollback.

The stricter smoke probe captures every console error, HTTP failure and
non-cancelled network failure. All 12 checks pass against this exact image:
`/tmp/tx-taxi-eth-entity-ssr-408882a.json`. Its recent-block mobile and transaction
desktop screenshots were visually reviewed. The GraphiQL regression also passes
with a real query, four same-origin workers, no captured console/page/request
errors and no overflow: `/tmp/tx-taxi-eth-graphiql-408882a.json`.

The probes used temporary local port 14004. After verification, the existing SSH
tunnel at `http://127.0.0.1:14002` was moved to the new container's bridge address
`172.18.0.34:3000`; `/block/46147` returns 200 through it. Port 14004 was removed.
No public route was changed. Entity metadata, remaining entity SSR, provider
fault-injection coverage and final security/cutover gates remain open.

## Canonical and Social Metadata Follow-up (Source Only)

Metadata now emits validated canonical URLs for block, transaction, address,
token and uint256 NFT-instance routes, plus the main public lists. Tab/tracking
parameters are excluded and hex identifiers are normalized. Canonical blocks
looked up by hash use the validated height for metadata without changing the UI's
routing query. Reorged/uncle blocks and unknown block types retain hash identity.
Default HTTP/HTTPS ports are normalized at the configured application origin.

Open Graph URLs match the canonical, and social descriptions match the page
description. Image tags use the configured branded fallback instead of empty
values; builds without a public hostname omit image tags. This is not an
entity-specific image implementation. The upstream image pipeline generated a
241,085-byte PNG, which was fetched and visually reviewed locally.

Forty-three focused tests, targeted ESLint and the final production build pass.
The build was run without a public hostname, matching the standalone Docker
build's configuration model. Runtime checks used HTTPS `eth.tx.taxi` with port
443 and confirmed normalized URLs without `:443`. The maintained probe
`tools/scripts/entity-metadata-smoke.cjs` passes three real HTTP cases (block by
height, the same block by hash, transaction), image retrieval and browser
navigation to the next block with matching canonical/OG/Twitter titles.
Evidence: `/tmp/tx-taxi-eth-entity-metadata.json`.

The 12-check SSR/timezone/navigation regression also passes:
`/tmp/tx-taxi-eth-ssr-metadata.json`. The build-time 404 returns `noindex` and no
malformed image tags, but its title still lacks runtime network branding; that
remains open. The local validation server was stopped after the checks.

Private staging remains pinned to `408882a`; no deployment or public routing
change was made for this follow-up. Entity-specific bitmap previews, remaining
entity SSR, client-enriched metadata synchronization, remaining canonical
routes, error-page branding and final security/cutover checks are still required.
