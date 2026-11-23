Verdict: safe-to-bump

# Pi 1.5.2 → 1.6.0 runtime research

Assessed 2026-11-23 against product commit `0780c0a0c5d3c9bd6df410754eab5575e188791a`. This is approval for a **mechanical dependency/version-guard update followed by qualification**, not a claim that new runtime archives have already passed qualification. No product behavior adaptation was identified. The declared terminal-rendering break does not affect Habitat's RPC UI; the existing model-capability and session-event consumers accommodate the changed upstream behavior. Candidate-backed focused tests passed after adjusting only copied version guards. [U1–U4; P1–P4]

## 1. Installability and upstream changes

### Requirements and compatibility

Both npm releases require Node `>=22.19.0`. The actual core lock pins **22.21.1**, on both targets, which satisfies that floor; `TESTING.md`'s development Node 22.23.2 is not the runtime pin. All changed packages in the resolved graph fit 22.21.1. Installation with scripts disabled succeeded, and native arm64 tests subsequently ran with the digest-verified locked Node. [U1; P1]

The explicit breaking change is TUI `Component.render(): readonly string[]`: `Container` may return its cached array. Extensions must not mutate an embedded component's returned array. Habitat's companion extensions do not implement such renderers. Inspection of the shipped process/UI extension consumers found copying/spreading/joining returned lines rather than in-place mutation; arbitrary user-installed TUI extensions are outside that assurance. Their authors may need to copy render results. There is no RPC type declaration change: the published `dist/modes/rpc/rpc-types.d.ts` files are byte-identical. [U2–U4; P3]

Relevant behavior changes, confirmed in the tag diff and published JavaScript:

- Session replacement no longer binds extensions twice. RPC subscribes **before** binding, so `session_start`-emitted entries now reach the client. Habitat already accepts `entry_appended` as a journal marker and rebuilds companion state on session start; it does not require duplicate initialization. [U3: `packages/coding-agent/src/modes/rpc/rpc-mode.ts`; P3]
- Diagnostics after replacement go to stderr; event-bus handler failures use the existing extension-error channel. Habitat keeps stderr as bounded classifications, not browser-visible raw provider text. A richer diagnostic UI is optional, not necessary for this bump. [U3: `core/agent-session-runtime.ts`, `core/extensions/types.ts`, `modes/diagnostics-stderr.ts`; P3]
- Aborted tool batches now receive terminal results even for calls that never started; those calls skip hooks and execution. This is not an authorization bypass. The companion's text-only, approval and revocation tests passed against the candidate. [U3: `packages/agent/src/agent-loop.ts`; P3]
- Native defaults for OpenAI, Azure and Codex move to GPT-6.2 Sol. Existing explicit model settings remain authoritative. New Astra/Sol models do not allow thinking `off`; Habitat asks Pi for supported levels rather than assuming every model permits it. Find patterns containing `/` become search-root-relative, and `pi.exec` reports signal exits as `128 + signal`. No product consumer requiring the previous behavior was found. [U2–U3; P3]

Upstream also fixes session/read cancellation, tool-output truncation, provider retries and schemas, MCP activation restoration, and Codex caching/connection handling. These improve native behavior without adding a Habitat wire format or history migration. The Undici update is attributed upstream to six security advisories; this research did not independently adjudicate those advisories. [U2–U3]

### Dependency and licence delta

A scratch copy of the existing core manifest/lock was resolved with only the Pi direct pin changed. No package path was added or removed. The changed locked versions were:

| Packages | Old → candidate |
| --- | --- |
| Pi agent-core, ai, codemode, coding-agent, mcp, schema, telemetry, tui | 1.5.2 → 1.6.0 |
| `@google/genai` | 2.21.0 → 2.32.0 |
| `openai` | 7.19.0 → 7.59.0 |
| `undici` | 8.12.3 → 8.12.4 |
| `@types/node` | 26.6.5 → 26.6.6 |
| `ws` | 8.22.0 → 8.23.0 |

The two provider SDK changes are explicit upstream `pi-ai` pins, not unexplained new dependencies. The last two are transitive resolution changes; review the actual regenerated lock rather than assuming the bump touches only Pi. [U3: `packages/ai/package.json`; U5; P1]

No changed package's declared licence changed: Pi, Undici, ws and Node typings remain MIT; the Google and OpenAI SDKs remain Apache-2.0. The bundled MCP SDK notice and TypeBox licence in `pi-mcp/THIRD_PARTY_NOTICES` and `pi-schema/THIRD_PARTY_NOTICES` are byte-identical between releases. Preserve these files, SDK licence files and Node notices in the generated closure. This does **not** relicense unchanged Claude SDK/bridge components or establish a blanket MIT licence for the archive. [U1, U4–U5; P1–P2]

Pi has no install/postinstall hook in either release; its build/prepublish scripts are publisher operations. Google GenAI still declares a no-op `preinstall`; protobufjs's existing install-script marker remains. No new install-script package appeared. The builder's `npm ci --ignore-scripts` continues to suppress them. Npm reports the **existing** optional peer mismatch in `@aliou/pi-utils-settings@0.19.2` (`>=0.74.0 <1`), already incompatible with the old 1.5.2 pin; installation nonetheless succeeds. Candidate process/permission tests passed, but the warning is not proof of universal third-party extension compatibility. [U1, U5; P1]

### Supply-chain evidence

At the assessment, the npm registry's `latest` was still **1.6.0**, published **2026-11-20 11:09:15.529 UTC**, approximately three days old; it was not marked deprecated. The old release was published November 10. Repository identity and maintainer lists were unchanged between versions, for Pi and each changed resolved package. This is a young release, not evidence of a long production soak. [U1, U5]

Both Pi tarballs matched their registry SHA-512 integrity records. Candidate integrity:

```text
sha512-zX1BVEsshx7A2MRuQ6jfr3RJGWw4Wn+vLq5ZfmlvS1RskhRmByaSZVXH/zcwRrWHO7qPgs98pNCbPOEti/t0fQ==
```

Registry signatures and SLSA provenance are present. More importantly, `npm audit signatures` on the installed candidate core graph exited successfully: **221 packages with verified registry signatures, 52 with verified attestations**. This is not a claim that all dependencies have provenance, or a vulnerability audit. The candidate's decoded provenance names `earendil-works/pi`, tag `v1.6.0`, `.github/workflows/build-binaries.yml`, GitHub-hosted Actions, and commit `faac585884ae2c013a6b1400f3e9e77f10b34bac`; its subject digest matches the downloaded tarball. No repository/maintainer transfer or unexpected dependency was found in this comparison. [U1, U6; research commands below]

### Both archive targets

The Pi npm tarball is architecture-neutral. No changed package introduces a CPU-specific optional package or a native-addon build. Existing QuickJS WASI and Photon WASM dependencies remain pinned; existing Claude SDK platform packages are unchanged. Ubuntu amd64 and arm64 therefore get the same Pi/SDK delta while retaining their respective Node and SDK binaries. Native builds of **both** core archives remain required; an arm64 test does not qualify amd64. [U4–U5; P1–P2]

Pi's `tools-manager.js` is byte-identical across releases. Its existing architecture-specific fd/ripgrep fallback downloads, when those tools are absent and offline mode is off, are not new archive inputs or new behavior introduced by this bump. Do not confuse an npm installation with proof that every eventual agent tool runs offline. [U4]

Measured Pi tarball sizes are 7,899,382 → 7,965,591 bytes compressed; registry unpacked sizes are 24,401,012 → 24,815,212 bytes. The sum of unpacked-size changes for all changed packages is **+7,464,528 bytes**, mostly the provider SDKs, common to both target graphs. These are package measurements, **not** measured final core archive sizes; recompression, closure records and link materialization determine those at build time. [U1, U4–U5]

## 2. Mechanical bump work and required checks

Change together:

1. `runtime/core/package.json` and its `package-lock.json`; regenerate with `npm install --package-lock-only --ignore-scripts` and inspect every changed dependency.
2. `internal/daemon/pi-device-test/package.json` and its lock, so qualification tests use the shipped SDK version.
3. Exact accepted-version checks in `internal/daemon/pi_runtime_linux.go` and its test, plus `pi_device_helper.mjs`, `pi_credentials_helper.mjs`, `pi_models_helper.mjs`, `context_detail_helper.mjs`, `recap_settings_helper.mjs`, and `session_name_helper.mjs`. Leaving these on 1.5.2 makes otherwise-compatible native helpers refuse 1.6.0.
4. Pi's required version in `internal/host/release_closure_linux.go` and its test fixture. Version-bearing comments in the launcher/runtime instructions can be reviewed without changing behavior. [P1–P4]

**Do not regenerate unrelated locks.** `runtime/core/artifact-lock.json` contains Node and Rust-tool inputs, not the Pi npm tarball: none of its upstream SHA-256 pins, Cargo.lock/crate-licence records or `CoreAgentTools` versions needs changing for this bump. `runtime/core/browser-lock.json`, the browser profile's Playwright wheel alignment, `web/package-lock.json`, optional-profile locks, and Ubuntu requirements likewise have no Pi-caused change. [P1–P2]

Rebuild core for each architecture. This regenerates package/file/component hashes, licence/notice membership, `artifact.json`, archive SHA-256 and sizes, then the release manifest and its approved digest. Never reuse the 1.5.2 core bytes under a 1.6.0 lock. The sole carried runtime source patch is `runtime/core/bridge-patch.json`, applied by `scripts/core-runtime-build.py`; the bridge remains at 0.12.0, so retain that exact-once patch. There is no Pi source patch to rebase. The candidate bridge-tools test exercised the existing patch. [P1–P2; test evidence]

Focused qualification for the actual bump:

- Run `node --test internal/daemon/pi-device-test/*.test.mjs` after regenerating/installing the fixture lock. Include turn modes, bridge tools, session writes, models/credentials, rewind, recap, process integration and snapshots; do not infer real-provider acceptance from synthetic endpoints.
- Run `./scripts/test-focused.sh --area go --go-package ./internal/daemon` and the host equivalent. In particular cover runtime-version acceptance, native RPC abort/startup, typed events, diagnostics and release closure. The focused runner prepares the SDK/schema prerequisites.
- Run `python3 scripts/test-profile-runtime-build.py`; build fresh core archives with `scripts/build-core-runtime.sh --target linux-amd64|linux-arm64 NEW_OUTPUT` on corresponding native builders.
- For each archive run `OH_CORE_ARTIFACT_DIR=OUTPUT go test ./internal/host -run TestReleaseClosureBuiltCore`; exercise the candidate through `OH_PI_ARTIFACT_DIR=OUTPUT ./scripts/test-real-pi-controller.sh` with its documented prerequisites. Verify the complete release manifest, including integrations, not core alone.
- Exercise the shipped Pi launcher/Taskfleet skill discovery against the built runtime. Upstream CLI argument parsing is unchanged except help text, but package entry points and native launch are still packaging boundaries. Run the integrated clean gate once before a gated release, not in every research worker. [P2–P4; `TESTING.md`]

## 3. Product surfaces touched

| Surface | Product paths and relevance |
| --- | --- |
| Runtime selection and archive acceptance | `internal/daemon/pi_runtime_linux.go`, `internal/host/release_closure_linux.go`, `runtime/core/agent-bin/pi`: accepted versions, bundled CLI entry point, launcher argument behavior. |
| Sign-in, model choice, thinking and context limits | `pi_device_helper.mjs`, `pi_credentials_helper.mjs`, `pi_models_helper.mjs`, `context_detail_helper.mjs`, `internal/daemon/model_observations_linux.go`: native catalogs and capability filtering already carry new model IDs/limits. |
| Streaming, cancellation and lifecycle | `internal/daemon/pi_rpc_linux.go`, `pi_events_linux.go`, `pi_diagnostics_linux.go`, `web/src/app/conversationJournal.ts`: earlier startup markers, complete aborted tool results, bounded stderr classification. |
| Permissions and process tools | `internal/daemon/process-extension.mjs`, `pi_approval_linux.go`, `pi_permission_linux.go`, runtime bridge patch: tool hooks remain authoritative for Pi-dispatched tools; bridge/search bypass restrictions must still pass their tests. |
| Resume, rewind, recap and helper writes | `rewind-extension.mjs`, `recap-extension.mjs`, `recap_settings_helper.mjs`, `session_name_helper.mjs`, `internal/daemon/turn-snapshots/`: replacement hooks, native session storage and settings. |
| Delegation resources | `runtime/core/taskfleet-skills.mjs`: resources discovery now runs once on replacement rather than twice. |

These mappings follow the upstream changed code and the existing product consumers; they are not proposed product changes. [U3; P3–P4]

## 4. Optional capabilities for the conductor

Keep these **out of the bump**:

- **Browser-visible extension/runtime diagnostics.** Pi now reliably reports replacement diagnostics and event-handler failures. Habitat could add a typed, sanitized diagnostic event and explanatory UI instead of only exit classifications. That needs privacy-safe mapping in `pi_diagnostics_linux.go`/`pi_events_linux.go`, a contract change under `contracts/v1`, generated consumers, and tests proving provider details never leak. Do not forward raw stderr or extension error text. [U3; P3]
- **Broader provider selection.** New Qwen plan models and separate plan-key variables are usable natively; Habitat's browser catalog intentionally filters providers. Browser support would require an explicit supported-provider decision, credential/catalog integration and synthetic login/selection tests, not merely exposing another model string. [U2–U3; `internal/daemon/pi_models_helper.mjs`]
- **New-model validation, not a new adapter.** Astra/Sol can flow through the current OpenAI/Codex catalog. A focused product scenario could verify selecting each with supported thinking levels and the advertised context limit. Azure/Qwen browser onboarding is separate scope. No hard-coded default migration should overwrite a person's saved choice. [U2–U3; P3]

## 5. Evidence and limits

Performed in disposable scratch, leaving tracked runtime inputs unchanged:

- Retrieved registry metadata, both release tarballs, the full GitHub tag diff, and candidate provenance. The GitHub compare API's file list truncated at 300 entries, so the full `.diff` was used instead of treating that list as complete.
- Verified both Pi SHA-512 digests; resolved a copied core lock; installed it with scripts disabled; audited registry signatures/attestations successfully.
- Compared changed package metadata and bundled MCP/TypeBox notices; checked unchanged RPC type declarations, tool downloader, and CLI argument-parsing behavior.
- Ran ten copied SDK fixture files (`helper`, `models`, `claude-default`, `session-write`, `turn-modes`, `bridge-tools`, `rewind`, `recap-settings`, `process-extension`, `permission`) using **Node 22.21.1 on linux-arm64**, synthetic homes/endpoints and candidate dependencies: **57 tests passed, zero failed/skipped**. The first attempt exposed the expected old-version guard refusals and a missing copied bridge-patch fixture. After copying that fixture and changing only the copied helper version guards, the run passed. No fix to product logic was needed.

Report validation: `git diff --check` and `python3 scripts/validate-project-view.py` passed (13 project pages).

Not performed: full Go/browser gate, native amd64 execution, real core archive builds/closure verification, live provider authentication or model turns, mapped-user installation qualification, or a full third-party TUI-extension audit. Those remain bump/release acceptance work, not hidden research passes. A mistaken initial attempt to execute the x64 Node on the arm64 builder failed with an architecture error; only the subsequent correct-arm64 run is counted above.

**Conclusion:** take 1.6.0 through the ordinary mechanical bump and native qualification. There is positive candidate evidence for the sensitive permission/bridge/session boundary and no identified product contract adaptation or supply-chain/licence reason to hold. Reassess if the actual regenerated lock or either target's focused checks differ from this result.

## Sources

Upstream primary sources (retrieved 2026-11-23):

- **U1:** [npm registry package/version metadata](https://registry.npmjs.org/@earendil-works%2fpi-coding-agent), including publish timestamps, engines, dependencies, dist signatures/integrity and attestation references.
- **U2:** [Pi 1.6.0 coding-agent changelog](https://github.com/earendil-works/pi/blob/v1.6.0/packages/coding-agent/CHANGELOG.md).
- **U3:** [Full 1.5.2…1.6.0 source diff](https://github.com/earendil-works/pi/compare/v1.5.2...v1.6.0.diff); paths cited above are relative to that upstream repository. [Comparison view](https://github.com/earendil-works/pi/compare/v1.5.2...v1.6.0).
- **U4:** Published [1.5.2 tarball](https://registry.npmjs.org/@earendil-works/pi-coding-agent/-/pi-coding-agent-1.5.2.tgz) and [1.6.0 tarball](https://registry.npmjs.org/@earendil-works/pi-coding-agent/-/pi-coding-agent-1.6.0.tgz), plus their locked Pi sibling packages. Registry URLs and SHA-512 records in the npm lock identify the compared bytes.
- **U5:** Version-specific npm metadata for each changed package, using `https://registry.npmjs.org/<package>/<version>`; notably [pi-ai 1.6.0](https://registry.npmjs.org/@earendil-works%2fpi-ai/1.6.0), [Google GenAI 2.32.0](https://registry.npmjs.org/@google%2fgenai/2.32.0), [OpenAI 7.59.0](https://registry.npmjs.org/openai/7.59.0), and [Undici 8.12.4](https://registry.npmjs.org/undici/8.12.4). Old/new exact versions are tabulated above.
- **U6:** [Candidate npm attestations](https://registry.npmjs.org/-/npm/v1/attestations/@earendil-works%2fpi-coding-agent@1.6.0).

Product sources at the assessed commit:

- **P1:** `runtime/core/{package.json,package-lock.json,artifact-lock.json,browser-lock.json,bridge-patch.json,AGENTS.md}`, `scripts/{build-core-runtime.sh,core-runtime-build.py,rust-tools-runtime.py}`.
- **P2:** `runtime/profiles/AGENTS.md`, `TESTING.md`, `docs/operations.md` (Build and verify runtime archives), `internal/host/release_closure_linux.go` and its tests.
- **P3:** `internal/daemon/` helpers, extensions, RPC/events/diagnostics and SDK fixtures named above.
- **P4:** `runtime/core/agent-bin/pi`, `runtime/core/taskfleet-skills.mjs`, `internal/daemon/pi_runtime_linux.go` and its tests.
