Verdict: safe-to-bump

# Node 22.21.1 → 22.23.5 runtime assessment

Assessed 2026-11-13 against repository commit `96b2a762`. This is a mechanical runtime update **including the exact-version checks listed below**, not permission to change only the two JSON locks. No product contract adaptation was identified. Qualification of the rebuilt archives remains required; this report is not that qualification.

## 1. Installability, compatibility and supply chain

### Release and behavior

The [official distribution index](https://nodejs.org/dist/index.json) lists 22.23.5, dated 2026-11-11, as the newest Node 22 release and an LTS security release. It is two days old at assessment, not yanked or superseded in that index. [Release notes](https://nodejs.org/en/blog/release/v22.23.5) and the [22.x changelog](https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V22.md) describe HTTP/2 lifetime/memory fixes, TLS session/SNI policy isolation, proxy-credential error redaction and permission checks. These are good reasons to replace the year-old runtime, rather than wait for a feature release.

This interval is **not behavior-free merely because it stays on Node 22**:

- 22.23.0 backported removal of HTTP/2 priority signaling and nghttp2 1.69.0; both commits are marked SEMVER-MAJOR. No direct HTTP/2 priority use was found in the product's runtime JavaScript. The browser gateway is Go, not a Node HTTP/2 server. Exercise provider/MCP connections in the rebuilt runtime rather than treating ABI compatibility as complete network compatibility.
- Hostname/NUL validation, TLS identity/session reuse, HTTPS Agent policy keys, header limits and permission-model enforcement became stricter. Invalid addresses and unsafe TLS reuse can now fail instead of working accidentally. Do not compensate by weakening certificate checks.
- 22.23.1 already fixes the idle HTTP-agent socket listener regression introduced in 22.23.0. The candidate includes it.
- ESM/CJS loader, streams, zlib and V8 backports also occur in the interval. The [tag comparison](https://github.com/nodejs/node/compare/v22.21.1...v22.23.5) reports 597 commits. The fetched GitHub comparison exposes only its first 300 changed files; this was not an exhaustive source audit. The complete interval's changelog and direct LICENSE/BUILDING comparisons supplemented it.

### Runtime requirements and native dependencies

Both versions use Node module ABI **127**. The candidate's arm64 executable reports N-API 10, V8 `12.4.254.21-node.57`, libuv 1.51.0, OpenSSL 3.5.9 and Undici 6.29.1. The index reports npm moving from 10.9.4 to 10.9.9. Node is the executable being installed, not an npm dependency requiring a newer ambient Node.

The [candidate BUILDING.md](https://github.com/nodejs/node/blob/v22.23.5/BUILDING.md) retains the old GNU/Linux x64/arm64 baseline: kernel ≥4.18 and glibc ≥2.28; Ubuntu 24.04 meets it. No target-platform requirement change was found in the [old document](https://github.com/nodejs/node/blob/v22.21.1/BUILDING.md).

All declared Node engine ranges in `runtime/core/package-lock.json` and `runtime/profiles/integrations/package-lock.json` admit 22.23.5 (including the core's `>=22.19.0` and `^20.17.0 || >=22.9.0` ranges). Those application graphs need not change. Core has CPU-specific Claude SDK packages for both targets; npm must still select Linux/glibc and the correct CPU. Integrations retains optional `keytar`, with an install script, but deliberately inventories it even when never loaded. The builders use `npm ci --ignore-scripts --no-audit --no-fund`; this bump must not enable keytar compilation, protobufjs or other lifecycle scripts. ABI continuity is reassuring, not proof that every native dependency works.

### Licences and provenance

Node remains MIT with bundled third-party terms, **not an all-MIT binary**. Comparing the tagged [old LICENSE](https://github.com/nodejs/node/blob/v22.21.1/LICENSE) and [new LICENSE](https://github.com/nodejs/node/blob/v22.23.5/LICENSE) found two changes: additional MIT text in the ICU notices and bundled minimatch changing from ISC to **BlueOak-1.0.0**. The latter permits redistribution with its notice; the builders already copy the complete Node LICENSE into `licenses/node.txt`. No new source-offer obligation was identified in this difference. Preserve the new text, not the predecessor's notice. Both downloaded candidate archives contain exactly the candidate tag's LICENSE.

The product consumes official `nodejs.org/dist` tarballs, **not** the npm `node` wrapper. [Candidate npm metadata](https://registry.npmjs.org/node/22.23.5) advertises registry signatures and a SLSA v1 provenance-attestation endpoint. Compared with [22.21.1 metadata](https://registry.npmjs.org/node/22.21.1), the maintainer list, repository, dependency (`node-bin-setup ^1.0.0`) and `preinstall: node installArchSpecificPackage` are unchanged. The wrapper repository remains `aredridel/node-bin-gen`, distinct from `nodejs/node`. These are metadata observations, not cryptographic verification, and they do not authenticate the official tarballs. No repository transfer or unexpected new wrapper dependency was observed.

For the actual input channel, both downloads matched the [official SHA-256 list](https://nodejs.org/dist/v22.23.5/SHASUMS256.txt). Its [detached signature](https://nodejs.org/dist/v22.23.5/SHASUMS256.txt.sig) was available (HTTP 200), but was not verified against independently trusted release keys here. Verify that signature when selecting release inputs; do not substitute npm provenance for it. No supply-chain blocker was found, but this research does not claim independent publisher authentication or an exhaustive dependency audit.

### Both archive targets

Downloaded sizes and executable sizes were measured, not inferred from npm metadata:

| Product target / upstream suffix | Old compressed bytes | New compressed bytes | New `bin/node` bytes | Executable increase |
| --- | ---: | ---: | ---: | ---: |
| linux-amd64 / linux-x64 | 30,815,588 | 31,062,912 | 124,909,296 | 1,513,472 |
| linux-arm64 / linux-arm64 | 29,975,852 | 30,222,232 | 122,295,568 | 1,708,992 |

Candidate tarball SHA-256 values:

- `node-v22.23.5-linux-x64.tar.xz`: `cdeb8670a0c81f51b4dc4ac61919f9b1ad917b304bf8221eb939570663d240f8`
- `node-v22.23.5-linux-arm64.tar.xz`: `2babb9eb5264860d540849f4b064a6fbdebcdc323657d9d382ce23d313fd5e09`

Sources: [candidate distribution](https://nodejs.org/dist/v22.23.5/), [predecessor distribution](https://nodejs.org/dist/v22.21.1/). Both core and integrations ship their own Node executable, so both payloads grow. Their final compressed archive sizes require rebuilding; they are not the upstream tarball sizes. Native arm64 `process.versions` succeeded. An x64 execution attempt on the arm64 research environment failed with Exec format error, as expected; x64 execution remains unqualified. Both builds must run on their respective native architectures, as `docs/operations.md` requires.

## 2. Bump scope and proof

Repository sources: `scripts/build-core-runtime.sh`, `scripts/core-runtime-build.py`, `scripts/build-profile-runtime.sh`, `scripts/integrations-runtime-build.py`, `internal/host/release_closure_linux.go`, `internal/daemon/pi_runtime_linux.go`, `TESTING.md` and `docs/operations.md`.

Required mechanical edits and generated outputs:

1. Update the Node version and both targets' URL/prefix/SHA-256 in **both** artifact locks. Keep their Node records equal.
2. Update the hardcoded component version in `scripts/core-runtime-build.py`, the accepted core version in `internal/host/release_closure_linux.go`, and the actual executable-version check in `internal/daemon/pi_runtime_linux.go`. Otherwise a new archive is mislabeled or a valid new runtime is refused. Update matching fixtures in `release_closure_linux_test.go`, `pi_runtime_linux_test.go` and `scripts/test-integrations-runtime.py`.
3. Update the old x64 Node filename/hash in `scripts/test-real-pi-controller.sh` and prepare its candidate fixture. Its separate Pi archive is not a Node pin and should not be changed casually.
4. Rebuild both archives, regenerating Node notices, component/file inventories, digests, `artifact.json` descriptors and the combined release manifest. The integrations component version is already derived from its artifact lock. npm itself is used at build time; builders ship Node plus the application dependency closure, not the complete upstream npm distribution.
5. Keep application `package-lock.json` files unchanged unless candidate `npm ci` demonstrates a real lock incompatibility. A Node version change alone does not warrant refreshing their dependency graphs. No Chromium revision, core `browser-lock.json`, Python browser wheel, web lock, Rust Cargo/crate licence record, or Go-tool third-party notice needs regeneration for this bump. Those components have not changed.
6. Carry both existing application patches unchanged: the exact-once Claude bridge built-in web-tools patch in `core-runtime-build.py`, and the MS365 scope patch in `integrations-runtime-build.py`/`ms-365-mcp-server-scopes.json`. There is no carried Node source patch in these builders. Their patch assertions must still pass.

Focused acceptance for the implementation worker:

- Run `python3 scripts/test-profile-runtime-build.py` for lock equality, target selection and builder invariants.
- Build core and integrations with `--target linux-amd64` and `--target linux-arm64`, each on a matching host in the disposable Ubuntu builder. Confirm npm engine/install results, target-specific packages, executable versions and notices.
- Run affected Go tests through `scripts/test-focused.sh --area go --go-package ./internal/host` and the equivalent for `./internal/daemon`; in particular retain runtime-version refusal, release closure, executable architecture and npm CPU coverage.
- For each built core, run `OH_CORE_ARTIFACT_DIR=<output> go test ./internal/host -run TestReleaseClosureBuiltCore`; run `scripts/test-integrations-runtime.py` against the matching integrations output and core runtime.
- Exercise the documented `TestPiOAuthBuiltRuntime` and `TestMCPBuiltRuntimeAgent` built-runtime tests, then the real-Pi controller fixture with the updated input. Verify a synthetic model turn, streaming/cancellation, credentials/model helper loading and MCP round trip using the candidate Node rather than ambient development Node.
- Generate and verify a combined manifest using `runtime-release`. This establishes archive closure, not provider authorization, installed multi-user operation or arbitrary customer project compatibility.

These implementation checks were **not run** for this report-only change. Research performed upstream retrieval, both-target download hashing and LICENSE comparison, engine-range inspection, source inspection and an arm64 executable smoke check. Report validation passed: `python3 scripts/validate-project-view.py` and `git diff --cached --check`.

## 3. Product features reached

- **Agent conversations and native sessions:** `internal/daemon/pi_runtime_linux.go`, `pi_rpc_linux.go`, `pi_writer_linux.go` and `runtime/core/agent-bin/pi` select/launch the bundled Pi runtime. Streaming, cancellation and subprocess behavior run atop Node.
- **Provider credentials and model discovery:** `internal/daemon/pi_credentials_linux.go`, `pi_device_helper.mjs` and `pi_models_helper.mjs` use the Pi SDK. Network/TLS and module-loader fixes can affect these paths.
- **Provider web search and page reading:** `runtime/core/web-search.mjs` and `page-reader.mjs` use the same Node process. Page reading's DNS/socket filtering and local proxy deserve regression attention; the Chromium sandbox is unchanged.
- **Delegated workers:** `runtime/core/taskfleet-skills.mjs` and the Pi launcher use Node. Taskfleet/workmux binaries themselves do not change.
- **Microsoft and MCP integrations:** `runtime/profiles/integrations/microsoft-native.mjs`, `microsoft-native-cli.mjs`, the MS365 MCP package and generated profile wrappers use bundled Node; the integration Pi wrapper delegates to core. Native Go/Rust integration executables and the Go gateway do not acquire a new runtime dependency.

## 4. New capabilities, separate from the bump

22.23.3 adds `napi_create_external_sharedarraybuffer` and SharedArrayBuffer support in `napi_create_typedarray` ([changelog](https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V22.md#22.23.3)). A future native indexing/processing extension could share buffers with JavaScript workers instead of copying them. Open Habitat has no demonstrated need for such an addon: it would require a separately approved dependency, per-architecture native packaging and memory-lifetime/concurrency tests. **Do not add one during this bump.**

No new user-facing feature is required to benefit from the security fixes. Environment-proxy support and `--use-env-proxy` are not new in this interval: they arrived in 22.21.0, before the existing pin. Do not claim them as a new capability unlocked by 22.23.5. No capability spinoff is recommended without a concrete product need.

## 5. Decision

Proceed with the mechanical bump and its exact-version/fixture updates. The HTTP/2 change does not correspond to a product contract used by the inspected code, existing engine requirements remain satisfied, both official target archives exist, and changed notices fit the existing full-LICENSE retention mechanism. Stop the implementation if candidate archive checks expose dependency behavior requiring adaptation; do not turn a failed check into a relaxed verifier. The recommendation is `safe-to-bump`, not a claim that rebuilt or installed runtimes have already passed qualification.
