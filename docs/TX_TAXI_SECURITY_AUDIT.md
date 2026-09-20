# tx.taxi security audit

Audit date: 2026-09-19

Command:

```bash
npx --yes yarn@1.22.22 audit --groups dependencies --json
```

After the security pins and reachable-path remediation in `package.json`, Yarn
reports 0 critical, 171 high, 203 moderate, and 6 low findings. The 171 high
paths reduce to 38 unique advisory records affecting 19 packages. Yarn v1 marks every path below as
`dev=false`; that flag is not enough to establish runtime reachability, so the
built `.next/standalone` artifact and application imports were also inspected.

`Standalone` means a vulnerable copy is present in the production server
artifact, not necessarily that an HTTP request can execute the vulnerable
operation.

| Package | Advisory IDs | Standalone | Actual configured path / disposition |
| --- | --- | --- | --- |
| `@grpc/grpc-js` | 1120586, 1120592 | Yes | OpenTelemetry exporters only; instrumentation does not load unless `NEXT_OPEN_TELEMETRY_ENABLED=true`. Do not enable before upgrade. |
| `@opentelemetry/auto-instrumentations-node` | 1120251 | Yes | Conditionally imported only when `NEXT_OPEN_TELEMETRY_ENABLED=true`; preset leaves it unset. Do not enable before upgrade. |
| `@opentelemetry/propagator-jaeger` | 1124011 | Yes | Same conditional OpenTelemetry path. Do not enable before upgrade. |
| `@opentelemetry/sdk-node` | 1120252 | Yes | Same conditional OpenTelemetry path. Do not enable before upgrade. |
| `bigint-buffer` | 1103747 | No | Dynamic wallet Solana subtree; account/wallet UI is disabled. No fixed release exists. |
| `brace-expansion` | 1123896, 1130589, 1130736 | No | `pino-pretty` glob tooling, absent from standalone. Build/development path. |
| `defu` | 1116102 | No | WalletConnect storage/server-helper subtree; wallet UI disabled and copy absent from standalone. |
| `flatted` | 1114526, 1115357 | No | `cspell` only, absent from standalone. Build/development path. |
| `h3` | 1115161, 1116543 | No | WalletConnect storage/server-helper subtree; wallet UI disabled and copy absent from standalone. |
| `hono` | 1114006, 1123999 | No | Wagmi/Porto wallet connector; wallet UI disabled and copy absent from standalone. |
| `minimatch` | 1113461, 1113540, 1113548 | No | `pino-pretty` glob tooling, absent from standalone. Build/development path. |
| `nanoid` | 1138810, 1138811, 1139427, 1153188, 1153189 | Yes | Next/PostCSS and disabled multisender paths. Advisories require invalid caller-supplied size; no such application call was found. |
| `node-forge` | 1115545, 1115546, 1115548, 1115612 | Yes | Disabled WalletConnect helper subtree; no configured connection path. |
| `picomatch` | 1115552, 1115554 | Nested copy | Next route generation, wallet helpers, and cspell. No request-controlled glob pattern was found. |
| `postcss` | 1124252, 1139510 | Nested Next copy | Next and Mixpanel/rrweb CSS processing. Mixpanel is not configured; runtime server does not process request-supplied CSS/source maps. |
| `preact` | 1111982, 1111983 | Nested wallet copy | Coinbase wallet and disabled multisender client bundles. Wallet UI and multisender are disabled. |
| `smol-toml` | 1193945 | No | `cspell` configuration only, absent from standalone. Build/development path. |
| `socket.io-parser` | 1115154, 1130713 | Yes | MetaMask wallet SDK only; wallet UI disabled. It remains traced but has no configured connection path. |
| `valibot` | 1110992 | Safe root only | Vulnerable Dynamic wallet subtree is not in standalone; root standalone copy is patched `1.2.0`. Wallet UI disabled. |

The reachable groups were remediated without removing explorer functionality:

- NFT `ipfs://` images use the existing HTTPS `ipfs.io` gateway parser; the
  Helia/libp2p browser stack and all of its audited advisories were removed.
- Swagger UI `5.33.0`, GraphiQL `5.4.0`, and compatible Lodash `4.18.1`
  resolutions remove all high API-doc findings while preserving both docs UIs.
- Each deploy-tool dependency set copied into or executed by the Docker runner audits at
  zero production findings. The previously unlocked essential-dapps generator
  now has a lockfile and a compatible ws `8.21.3` resolution.
- All Docker stages use the published `node:22.23.2-alpine` image. Node's
  official archive identifies 22.23.2 as the latest Node 22 LTS release:
  <https://nodejs.org/download/release/latest-v22.x/>.

## Runtime image scan and tool pruning

The staged pre-pruning image
`sha256:4f11d2c3b5e5c4f78988dedd17f0e71be867d256f2127bb89eb14cf3aefa9d61`
was scanned separately by package class. Its Alpine 3.24.2 packages reported
0 critical and 0 high findings. The global npm toolchain supplied by the base
image reported 1 critical and 10 high findings, while the application artifact
reported 0 critical and 13 high findings.

The final runtime entrypoint and every script it invokes were inspected. They
do not call `npm`, `npx`, or `corepack`, so the runner now removes those global
packages and command launchers. It deliberately retains Yarn 1: startup calls
`yarn install --frozen-lockfile` in `favicon_generator.sh` and
`yarn next-sitemap` in `sitemap_generator.sh`. A Docker build assertion checks
that Node and Yarn still run and that all three removed commands are absent.

The next image scan is expected to show 0 critical/0 high OS findings and no
global npm-toolchain findings. That result remains unverified until the parent
builds and scans the patched image. The 13 application highs expected to remain
are:

| Package | High findings | Configured runtime disposition |
| --- | ---: | --- |
| `@grpc/grpc-js` | 2 | OpenTelemetry path; disabled unless `NEXT_OPEN_TELEMETRY_ENABLED=true`. |
| `@opentelemetry/auto-instrumentations-node` | 1 | Conditional OpenTelemetry import; preset leaves it disabled. |
| `@opentelemetry/sdk-node` | 1 | Conditional OpenTelemetry path. |
| `@opentelemetry/propagator-jaeger` | 1 | Conditional OpenTelemetry path. |
| `preact` | 1 | Wallet client subtree; wallet/account features are disabled. |
| `socket.io-parser` | 2 | MetaMask wallet SDK subtree; wallet/account features are disabled. |
| `postcss` | 2 | Nested Next runtime copy; the server does not process request-supplied CSS or source maps. |
| `nanoid` | 3 | Findings require an invalid caller-controlled size; no such application call was found. |

## Gate decision

No reviewed high advisory remains reachable in the configured explorer path.
The conditional OpenTelemetry group is acceptable only while
`NEXT_OPEN_TELEMETRY_ENABLED` remains unset, and wallet findings are acceptable
only while account/wallet configuration remains disabled.

Remaining public-cutover gates are an actual Docker image build, confirmation
of the tool-pruning assertions, and a fresh image/OS scan, followed by browser
smoke tests of NFT gateway loading, REST/GraphQL API docs, and core explorer
routes. The scan must confirm that the global npm finding group is absent and
that the remaining application findings match the reviewed 13-high set above.

Do not treat physical presence in `.next/standalone` as proof of exploitability,
or an absent server copy as proof that browser users are unaffected. Re-run the
audit, production build, standalone trace check, and browser route tests after
each resolution. Major-version resolutions for OpenTelemetry or wallet owners
are not appropriate without advancing and testing the owning upstream packages.
