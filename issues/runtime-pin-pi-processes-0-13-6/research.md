Verdict: needs-work

# @aliou/pi-processes 0.10.9 → 0.13.6

Assessed 2026-11-13 against repository commit `5c9e5b1e0c61ccfc049082a73f126027e00fc937`. **Do not apply an automatic pin-only bump.** The candidate is compatible with the bundled Node/Pi versions, but immediate successful exits no longer produce a separate lifecycle notification. Both product history readers currently mistake that new start result for an unfinished process. Fix that integration and reconcile the shell-parser override before raising the pin.

## 1. Installability and upstream changes

### Requirements and behavior

The published package still requires Node `>=22.19.0`; core actually ships **22.21.1** (`runtime/core/artifact-lock.json`), which satisfies it. The candidate requires Pi `>=1.4.0` (optional peer), satisfied by core's **1.5.2**. Publishing with Node 24 does not change the runtime engine floor. The entry point remains `extensions/processes/index.ts`. [S1, S2]

The relevant changes in the published source diff and changelog are:

- **0.11:** intentional kills now deliver context notifications; log overlays gain wrapping/paging and dock fixes.
- **0.12:** adoption of externally spawned children through `ProcessManager.adopt` and `processes:command:adopt`.
- **0.13:** structured tool output, including bounded raw output lines for codemode; context/ignore notifications persist without waiting for another user prompt. The old Pi versions unsafe for this delivery shape are older than the bundled 1.5.2.
- **0.13.1–.4:** session `PI_*` environment injection; compaction holds notifications until completion/failure; idle wake uses Pi's steer path rather than an extra user-message workaround; list replies gain `wake` and persisted notifications gain `sessionIdle`. Project settings now require Pi project trust (settings library 0.24), rather than honoring untrusted repository shell/interception configuration.
- **0.13.5:** configurable tool exposure, shorter tool declarations, and a **150 ms immediate-exit grace window**. A failing immediate start throws; a successful immediate exit returns an already-ended process. Neither emits a duplicate lifecycle notification for the outcome reported by start.
- **0.13.6:** handles the shell parser's `AnsiC` and `LocaleStr` word parts; unknown parts throw instead of silently becoming empty arguments.

These are behavior changes even where upstream labels them patches. In particular, accepting the new trusted-settings behavior and handling terminal start results cannot be proved by regenerating a lock alone. Event-bus request names used by Habitat remain available; `src/protocol` moved to `extensions/shared/protocol`, but Habitat communicates through event strings, not imports of that directory. [S3, S4; `internal/daemon/process-extension.mjs`]

### Dependencies, licences and supply chain

No new direct dependency names. The ranges change from `@aliou/sh ^0.2.2` to `^0.4.0` and settings `^0.19.1` to `^0.24.0`; UI remains `^0.5.0`. Core deliberately overrides the parser to **0.3.4**, and the native test fixture has a global override to that same version. Merely changing pi-processes would leave its new parser requirement overridden. Remove or advance that override deliberately, test shell reconstruction, and update the verifier's parser version if it changes. Do not claim that an npm install honoring the override establishes upstream compatibility. [S1, S2; `runtime/core/package.json`, `internal/daemon/pi-device-test/package.json`]

At inspection, the ranges permit parser **0.4.1**, settings **0.24.1**, and UI **0.5.1** (UI 0.6.0 is outside the range). Settings depends only on UI; parser and UI have no production dependencies. None of these manifests declares bundled or optional dependencies. Candidate pi-processes and settings/UI remain MIT; parser remains **MIT AND BSD-3-Clause**, as in the current 0.3.4 lock. The parser tarball carries `LICENSE`; pi-processes/settings/UI provide SPDX metadata rather than a root licence file. The existing builder explicitly retains package metadata as the licence record in that case. No new licence family was found in this affected dependency subtree. This is not a new licence assessment of the unchanged Pi/Claude dependency closure. [S5–S7; `scripts/core-runtime-build.py`]

Supply-chain observations:

- Candidate published **2026-11-07 14:22:28 UTC**, about six days before inspection; registry `latest` remains 0.13.6, with no deprecation field. It is neither superseded nor marked withdrawn at inspection.
- Old/new version metadata has the same maintainer set and repository; both publish through GitHub Actions trusted publishing. No maintainer email or account details are needed in this report.
- Both tarballs matched their registry SHA-512 integrity. Both npm registry signatures were **cryptographically verified** using the matching key from the registry keys endpoint and the signed `name@version:integrity` message.
- Both attestation endpoints returned publish and SLSA-v1 provenance statements. Their subjects match the tarball digests; the provenance names the same repository, `main`, and `.github/workflows/publish.yml`, with commits `550b2e9fe0a5e9ebb77612dfc2f672d4038161b4` and `ed7b74ad68fcea9090a32d03e032b2f06d77a1be`. **Sigstore certificate/transparency verification was not run**; decoding and matching provenance is not full attestation verification.
- No install/preinstall/postinstall script appears in either pi-processes manifest. The unchanged `prepare` script conditionally invokes husky in a Git checkout. The inspected dependency manifests have development/build scripts, not install hooks. The core builder continues to use `npm ci --ignore-scripts --no-audit --no-fund`.

Sources: [S1, S2, S5–S9]; `scripts/build-core-runtime.sh`.

### Both archive targets

The candidate and affected dependencies ship TypeScript/JavaScript rather than native addons; inspection of their tarballs found no `.node` binaries. No new CPU/OS restriction, per-target download or native build step is introduced by this subtree. The same npm tarball applies to **linux-amd64 and linux-arm64**. Existing Pi native/optional packages and Node/browser/Rust target-specific artifacts remain separate obligations; each complete core archive still needs a native build and closure verification on its target. [S1, S2, S5–S7; `docs/operations.md`, `TESTING.md`]

Measured pi-processes tarball: **111,021 → 137,865 bytes** compressed (+26,844); registry unpacked size **436,345 → 516,590 bytes** (+80,245), **119 → 123 files**. With parser 0.4.1 and settings 0.24.1, their unpacked increases over the current lock are 111,532 and 60,892 bytes; unchanged UI contributes no increase. This gives an indicative **252,669-byte unpacked increase** for this subtree if those versions replace the existing copies. It is not a measured full archive delta: deduplication, optional target packages, inventories and compression must be measured in the builds. No runtime archive was built during research.

## 2. Required product work and bump records

### Confirmed integration mismatch: already-ended starts

Upstream `executeStart` returns `{action: "start", process, notify}` for an immediate clean exit, after `markStartReported` suppresses its lifecycle notification. Habitat's `branchFacts` adds every non-ignored start to its open-process map without checking `process.status` or `endTime`; the Go branch scanner does the same. Both rely on a later notification or stop result to close it. [S3, S4; `internal/daemon/process-extension.mjs:branchFacts`, `internal/daemon/process_interrupted_linux.go`]

A direct Node import of the current **production** `branchFacts` reproduced this with a synthetic start result containing `status: "exited"`, `success: true`, `exitCode: 0`, `startTime: 1000`, `endTime: 1001`, and default turn notifications: it returned that process in `open` with `wakes: true`. This is a pure history-reader reproduction, not a candidate end-to-end test. The upstream source establishes why such a result now occurs without a closing notification. On restart/catch-up, an already completed command can therefore be presented as interrupted. Adapt both readers to terminal start outcomes, keeping process identity/reuse fencing intact, and add regressions for immediate success, immediate failure and ordinary long-running starts. The Go path was inspected, not executed with a new fixture.

Also qualify trust-gated local process settings through Habitat's Pi startup path: do not bypass upstream trust to preserve old behavior. Existing browser control request/response shapes remain usable; new `wake` data can be ignored until separately adopted.

### Inputs and generated outputs

| Record | Required treatment |
| --- | --- |
| `runtime/core/package.json`, `package-lock.json` | Change pi-processes pin; reconcile parser override; regenerate a bounded lock and review all transitive changes/integrities. |
| `internal/daemon/pi-device-test/package.json`, `package-lock.json` | Match the candidate and parser decision so native tests exercise shipped versions. |
| `internal/host/release_closure_linux.go` and `_test.go` | Update accepted pi-processes version and parser version if advanced. Otherwise release verification rejects the new closure. |
| `runtime/core/artifact-lock.json` | **No npm tarball SHA-256 entry to regenerate here.** It locks Node/Rust tools; leave their bytes and source/licence/crate records unchanged for this bump. npm integrity belongs in the npm lock. |
| Generated `core.tar.gz`, `artifact.json`, `release.json` | Rebuild each target: regenerate file/component digests, archive SHA-256, size/counts, licence membership and manifest digest. No reuse of the old core archive digest. |
| Notices/licence records | Builder retains upstream files or SPDX package manifests for the newly resolved packages. Preserve parser's BSD as well as MIT terms. No Rust crate or Go binary notice regeneration unless those independently pinned tools change. |
| `runtime/core/browser-lock.json`, optional profile locks, `web/package-lock.json` | Unaffected; do not refresh Chromium, browser QA wheel, optional tools or frontend dependencies as part of this bump. |
| Carried source patches | No pi-processes source patch found in the core builder. Preserve the independent, exact-once Claude bridge WebSearch/WebFetch patch in `scripts/core-runtime-build.py`. |

Sources: `scripts/build-core-runtime.sh`, `scripts/core-runtime-build.py`, `internal/host/release_closure_linux.go`, the named manifests/locks, and `docs/operations.md` “Build and verify runtime archives”. `CoreAgentTools` and Rust tool lock regeneration concern different components, not this npm update.

### Focused acceptance for an implementation

1. With updated native fixture locks, run `./scripts/test-focused.sh --area go --go-package ./internal/daemon`. In particular preserve `TestProcessPinnedPiBridgeAndWake`, `TestProcessResumeCatchUpAcrossDaemonRestart`, catch-up/history tests and socket stale-owner/duplicate-owner checks. Add terminal-start regressions to the existing branch/catch-up tests, including a real candidate `exit 0` start followed by resume. Exercise compaction-time notifications and trusted/untrusted project settings with the pinned Pi.
2. Run the companion tests (`node --test internal/daemon/pi-device-test/process-extension.test.mjs internal/daemon/pi-device-test/wait-reminder.test.mjs`), then affected web component/history tests and `./scripts/test-focused.sh --area browser --spec process-tray.spec.ts`. Include `named-workers.spec.ts` if wait/catch-up presentation changes.
3. Run `python3 scripts/test-profile-runtime-build.py`; build core separately with `./scripts/build-core-runtime.sh --target linux-amd64 NEW_ABSOLUTE_OUTPUT` and `--target linux-arm64 NEW_ABSOLUTE_OUTPUT` on matching hosts. Run release closure tests and `OH_CORE_ARTIFACT_DIR=BUILD_OUTPUT go test ./internal/host -run TestReleaseClosureBuiltCore` for each actual build. Generate/verify the release manifest as documented. These establish shipped closure and accepted versions, not installed multi-user isolation.
4. Preserve distinct-UID coverage with `./scripts/test-proc-hidepid-uids.sh` when process ownership/control changes. Native tests and same-UID browser fixtures alone do not establish that boundary. The integrated full clean gate remains the conductor/release obligation, not evidence furnished by this research.

## 3. Product features affected

- **Agent background execution and notification delivery:** the loaded process extension is selected by `internal/daemon/recap_linux.go` and `pi_rpc_linux.go`; model `process` calls, shell interception, notification-triggered turns and compaction interact with it.
- **Process tray, stop/force-stop, output and clear-finished:** `internal/daemon/process-extension.mjs`, `processes_linux.go`, `web/src/components/ProcessTray.tsx`.
- **Waiting and interrupted-process recovery, including worker waits:** `internal/daemon/process_interrupted_linux.go`, `wake_linux.go`, `process-extension.mjs` branch facts/reminders; the immediate-exit mismatch directly affects these.
- **Process tool and lifecycle history presentation:** daemon process projections, `web/src/app/HistoryView.tsx` and its XML-as-text handling. Structured output is not a reason to replace bounded persisted `details` with raw output arrays.

## 4. New capability proposals (not part of a bump)

- **Accurate “can still wake the agent” indication:** consume list `wake` (resolved exit policy and fired/pending watches), instead of reconstructing only start-time policy in `wakes()`. Define how multiple watches and updated policies map to the browser's nullable `wakes_agent`, and test updates/fired watches. Use `sessionIdle` for actual idle-at-delivery evidence where useful, not a guessed wake claim.
- **Transfer long foreground commands into managed background execution:** use adoption only through a deliberate owning extension, with detached groups, piped streams, initial output and original start time. Add ownership/cleanup and cancellation tests before exposing a browser control; this is not an invitation to create a second process registry.
- **Structured process calls through codemode:** qualify the new output schema/raw line arrays with the product's codemode path and output bounds. Tool exposure can reduce always-on declaration cost, but retain default `direct` unless tool search/codemode reachability is proven. No frontend parser should assume `structuredContent` is persisted in history.
- TUI log wrapping, paging and mouse/dock interactions do **not** automatically enhance the browser process tray. A browser wrapping/scrolling affordance would be separate UI work, not a prerequisite for this version.

Sources: [S3, S4]; current `internal/daemon/process-extension.mjs` and `web/src/components/ProcessTray.tsx`.

## 5. Verdict and evidence limits

**needs-work**, not hold: no observed licence or publishing-identity concern warrants rejecting upstream, and its runtime floors fit. The terminal-start/history mismatch is a concrete product adaptation; parser override reconciliation and trust/notification qualification belong in the same implementation task. Only then should the pin and regenerated records land. Optional capabilities above remain conductor proposals.

Research performed: registry/attestation inspection; SHA-512 and registry-signature verification for both pi-processes tarballs; extracted old/new published-source comparison; affected dependency metadata/tarball inspection; production `branchFacts` synthetic reproduction. No candidate npm install, native model turn, dual-architecture archive build, full dependency vulnerability audit or Sigstore verification was performed. Documentation validation and whitespace checks are run before committing this report; their results are reported by the worker.

## Sources

- **S1:** [npm full registry metadata](https://registry.npmjs.org/@aliou%2fpi-processes), including version manifests, times, tags, signatures and provenance URLs.
- **S2:** Published artifacts: [0.10.9 tarball](https://registry.npmjs.org/@aliou/pi-processes/-/pi-processes-0.10.9.tgz), [0.13.6 tarball](https://registry.npmjs.org/@aliou/pi-processes/-/pi-processes-0.13.6.tgz). Sizes and source comparison above use these bytes, not a moving branch.
- **S3:** [Candidate changelog at published commit](https://github.com/aliou/pi-processes/blob/ed7b74ad68fcea9090a32d03e032b2f06d77a1be/CHANGELOG.md); also inspected inside the candidate tarball.
- **S4:** [Commit comparison](https://github.com/aliou/pi-processes/compare/550b2e9fe0a5e9ebb77612dfc2f672d4038161b4...ed7b74ad68fcea9090a32d03e032b2f06d77a1be). Key inspected published files: `extensions/processes/tools/start/index.ts`, `handlers/requests.ts`, `handlers/notifications.ts`, `notification-sender.ts`, `notifications/registry.ts`, `src/manager/process-runtime-controller.ts`, `src/utils/shell-utils.ts`, `package.json`.
- **S5:** [Parser metadata](https://registry.npmjs.org/@aliou%2fsh), [0.4.1 artifact](https://registry.npmjs.org/@aliou/sh/-/sh-0.4.1.tgz).
- **S6:** [Settings metadata](https://registry.npmjs.org/@aliou%2fpi-utils-settings), [0.24.1 artifact](https://registry.npmjs.org/@aliou/pi-utils-settings/-/pi-utils-settings-0.24.1.tgz).
- **S7:** [UI metadata](https://registry.npmjs.org/@aliou%2fpi-utils-ui), [0.5.1 artifact](https://registry.npmjs.org/@aliou/pi-utils-ui/-/pi-utils-ui-0.5.1.tgz).
- **S8:** Provenance bundles: [0.10.9](https://registry.npmjs.org/-/npm/v1/attestations/@aliou%2fpi-processes@0.10.9), [0.13.6](https://registry.npmjs.org/-/npm/v1/attestations/@aliou%2fpi-processes@0.13.6).
- **S9:** [npm registry signing keys](https://registry.npmjs.org/-/npm/v1/keys).
