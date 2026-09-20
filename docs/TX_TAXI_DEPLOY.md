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
