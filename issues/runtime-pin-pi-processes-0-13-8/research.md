Verdict: needs-work

# @aliou/pi-processes 0.10.9 → 0.13.8

Assessed 2026-11-23 against product commit `84fe9498765ea98abe57bbde8245546f9b954f85`. **Do not automatically raise the pin.** Runtime requirements fit, but successful immediate exits now return terminal start results without a separate completion notification. Both product history readers still treat these as unfinished processes. The existing shell-parser override also needs reconciliation. The 0.13.7–0.13.8 changes do not remove those blockers. [S1–S4; product paths below]

## 1. Installability and upstream changes

### Requirements and behavior

Both releases require Node `>=22.19.0`. The actual shipped Node is **22.21.1**, from `runtime/core/artifact-lock.json` and `scripts/core-runtime-build.py` (not the newer developer-test Node named in TESTING.md). Candidate Pi peer floor is `>=1.4.0`; shipped Pi **1.5.2** meets it. The extension entry point remains `extensions/processes/index.ts`. [S1, S2; `runtime/core/package.json`]

Published-source comparison and the candidate changelog establish these relevant changes: [S2–S4]

- **0.11:** log overlay soft wrapping and paging, dock fixes, and intentional kills delivered at context attention rather than suppressed. A temporary next-turn workaround prevented mid-tool notification history corruption.
- **0.12:** an adoption API and `processes:command:adopt` let another extension transfer an existing child into the sole process manager.
- **0.13:** structured tool output and bounded raw selected log lines for codemode. Context/ignore messages persist immediately through the newer Pi tool-boundary behavior, rather than waiting for another user prompt. The older Pi versions unsafe for that behavior are below the shipped version.
- **0.13.1–0.13.4:** session `PI_*` variables reach started processes; notifications wait through compaction; idle turn notifications use Pi's steer path. List replies gain `wake` (exit attentions and log-watch state), and persisted notification details gain `sessionIdle`. Local process settings now require Pi project trust; an untrusted project cannot select the shell or change background interception.
- **0.13.5:** global `toolExposure` (`direct` by default, plus model-only/codemode/deferred/hidden), smaller declarations, and a **150 ms immediate-exit grace window**. An immediate failed start throws; an immediate successful start returns an already-ended process. Outcomes reported at start do not generate a duplicate lifecycle notification.
- **0.13.6:** shell reconstruction understands the newer parser's ANSI-C and locale-string word parts; unknown parts throw instead of silently disappearing.
- **0.13.7:** muted log-match summary rendering. **0.13.8:** guidance for immediate-exit results and `Promise.allSettled()` when starting processes concurrently through codemode. These last two releases do not restore the old lifecycle contract.

The event-bus request channels used by Habitat remain present. Upstream's protocol source relocation to `extensions/shared/protocol` is not itself a product import break: the companion uses event names. Nevertheless, terminal starts, project trust and notification ordering are behavior changes, not something a successful lock regeneration alone proves. [S2–S4; `internal/daemon/process-extension.mjs`]

### Dependency and licence closure

No new direct dependency names. Ranges change as follows: [S1, S5]

| Dependency | 0.10.9 range / currently locked | 0.13.8 range / current matching release |
| --- | --- | --- |
| `@aliou/sh` | `^0.2.2` / overridden **0.3.4** | `^0.4.0` / **0.4.1** |
| `@aliou/pi-utils-ui` | `^0.5.0` / **0.5.1** | `^0.6.0` / **0.6.0** |
| `@aliou/pi-utils-settings` | `^0.19.1` / **0.19.2** | `^0.24.0` / **0.24.2** |

Core has a package-scoped parser override; `internal/daemon/pi-device-test/package.json` has a global one, both 0.3.4. A pin-only install can preserve that override despite the new upstream requirement. Remove or advance it deliberately, qualify shell parsing/reconstruction, and update the verifier's expected parser version if changed. [Product manifests; `internal/host/release_closure_linux.go`]

Candidate pi-processes, UI and settings remain MIT. Parser remains **MIT AND BSD-3-Clause**, also the existing lock's expression. The inspected current matching dependency manifests have no production dependencies, bundled dependencies or optional dependencies. UI's optional Pi peers accept `>=0.74.0 <2`; settings' optional Pi peer accepts `>=1.4.0 <2`, and its schema-generator peer is optional. These fit the shipped Pi without requiring that development generator. Parser requires Node >=22. [S1, S5; `runtime/core/package-lock.json`]

Downloaded dependency artifacts contain no `.node`, `.so` or `.wasm` files. Parser includes its LICENSE; pi-processes/UI/settings have SPDX package metadata rather than root licence files. The existing builder retains metadata as the licence record where upstream supplies no separate licence text. No changed licence family was found in this affected subtree; this is not a fresh audit of the unchanged Pi/Claude dependency closure. [S2, S5; `scripts/core-runtime-build.py`]

### Supply chain and release age

- Registry reports publication **2026-11-22 10:39:11.191 UTC**: one calendar day before assessment. `latest` is still **0.13.8**, with no deprecation field. There is no observed withdrawal/supersession signal. This is a young release, not evidence of broad deployment. [S1]
- Old/new manifests retain the same maintainer set and repository. Both attestations identify the same repository identity, `main` and `.github/workflows/publish.yml`; candidate commit is `23c9313b71f93172884d5e381c1ffd408ef60ff2`, baseline `550b2e9fe0a5e9ebb77612dfc2f672d4038161b4`. [S1, S6]
- **Verified** both pi-processes tarballs against registry SHA-512 integrity and both npm registry signatures using the registry's published key. The common key id is `SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U`. Registry authentication is not a source-code security audit. [S1, S2, S7]
- Both endpoints return publish and SLSA-v1 provenance statements with subjects matching the downloaded digest. **Full Sigstore certificate/transparency verification was not run**; decoding/matching the statements is not verification of their signing chain. [S6]
- Neither pi-processes version declares preinstall/install/postinstall. Its unchanged `prepare` conditionally runs husky in a Git checkout. The three inspected dependency manifests contain development/build commands, not install lifecycle hooks. Core uses `npm ci --ignore-scripts --no-audit --no-fund`. [S1, S5; `scripts/build-core-runtime.sh`]

### Both runtime targets and size

The changed subtree is architecture-neutral TypeScript/JavaScript; no new native module, target-specific download, CPU/OS restriction or build hook was found. The same tarball serves **linux-amd64** and **linux-arm64**. Existing target-specific Node, browser and other Pi dependencies remain unchanged obligations. Both complete core archives still need native builds and closure verification on their respective target. [S1, S2, S5; `docs/operations.md`, `TESTING.md`]

Measured pi-processes compressed size: **111,021 → 137,324 bytes** (+26,303). Registry unpacked size: **436,345 → 511,772 bytes** (+75,427); **119 → 123 files**. Current matching dependency artifacts measure: parser 0.4.1 **107,063 compressed / 426,256 unpacked**, UI 0.6.0 **20,584 / 86,539**, settings 0.24.2 **68,588 / 281,252** bytes. These are package sizes, **not** full-core archive deltas: deduplication, target optional packages, generated inventories and compression affect the final result. No core archive was built in this research. [S1, S2, S5]

## 2. Required product adaptation, records and checks

### Reproduced blocker: terminal starts become false unfinished work

Candidate `extensions/processes/tools/start/index.ts` calls `markStartReported` for a non-live result and returns a successful terminal process; `notifications/registry.ts` and the lifecycle handler suppress the already-reported end. The grace constant lives in `src/manager/limits.ts`. [S2–S4]

In the product, `branchFacts` in `internal/daemon/process-extension.mjs` adds every valid start result to `open`, unless success attention is `ignore`; it never checks terminal status/end time. The matching reader in `internal/daemon/process_interrupted_linux.go` likewise records a start until a stop result or completion notification closes it. [Named product source]

A direct Node import of the current production `branchFacts` with a synthetic `exit 0` start result (`status: "exited"`, `success: true`, `exitCode: 0`, `startTime: 1000`, `endTime: 1001`, default turn attentions) returned that process in **`open` with `wakes: true`**. This independently reproduces the earlier candidate's finding against this product revision. It is a history-reader reproduction, not an end-to-end candidate run. After restart/catch-up an already-completed command can consequently be represented as interrupted. Adapt **both** readers, preserving process-id reuse/start-time fencing, and cover terminal success/failure and normal running starts. The Go path was source-inspected, not executed with a new regression fixture.

Also qualify project-trust-gated settings through the product's actual Pi startup and notification delivery through active turns/compaction. Do not bypass upstream trust to retain old local-settings behavior. [S3; `internal/daemon/recap_linux.go`, `process-extension.mjs`]

### Bump inventory

| Record | Required action |
| --- | --- |
| `runtime/core/package.json`, `package-lock.json` | Raise pin, reconcile parser override, regenerate with `--package-lock-only --ignore-scripts`; review bounded transitive version/integrity/peer changes. |
| `internal/daemon/pi-device-test/package.json`, `package-lock.json` | Match shipped pi-processes and parser versions so native tests do not keep exercising 0.10.9. |
| `internal/host/release_closure_linux.go`, `_test.go` | Change accepted pi-processes version and parser version if advanced. |
| Core build outputs `core.tar.gz`, `artifact.json`, release `release.json` | Regenerate file/component hashes, licence records, sizes, archive SHA-256 and manifest digest for each target; never reuse an old core for changed npm inputs. |
| `runtime/core/artifact-lock.json` | No npm digest lives here: Node and Rust tool artifacts only. No change for this bump unless deliberately changing those independent components. |
| Rust crate/licence records, `CoreAgentTools` | Unaffected; do not regenerate Taskfleet/workmux locks for an npm-only change. |
| `runtime/core/browser-lock.json`, optional profile locks, `web/package-lock.json` | Unaffected. Do not couple Chromium, browser QA wheel or frontend dependency upgrades to this bump. |
| Source patches | No pi-processes patch in the builder. Preserve the independent exact-once bridge WebSearch/WebFetch patch (`runtime/core/bridge-patch.json`, `scripts/core-runtime-build.py`). |

Sources: named files, `runtime/core/AGENTS.md`, `runtime/profiles/AGENTS.md`, `scripts/build-core-runtime.sh`, `scripts/core-runtime-build.py`, and `docs/operations.md` “Build and verify runtime archives”. Notices are regenerated by retaining each installed package's upstream notices/SPDX metadata, not by inventing a bundle-wide MIT declaration.

### Focused acceptance for the implementation

1. Add terminal-start regression cases to the two history-reader paths. With updated fixture locks, run `./scripts/test-focused.sh --area go --go-package ./internal/daemon`, especially `TestProcessPinnedPiBridgeAndWake`, `TestProcessResumeCatchUpAcrossDaemonRestart` and `TestProcessCatchUpLogic`. Include a real candidate immediate `exit 0` followed by resume, immediate failure, ordinary delayed completion, compaction-time notification ordering, and trusted/untrusted local settings.
2. Run `node --test internal/daemon/pi-device-test/process-extension.test.mjs internal/daemon/pi-device-test/wait-reminder.test.mjs`, relevant web process/history component tests, and `./scripts/test-focused.sh --area browser --spec process-tray.spec.ts`. Include `named-workers.spec.ts` if wait/catch-up presentation changes.
3. Run `python3 scripts/test-profile-runtime-build.py`, host release-closure tests, native core builds with `./scripts/build-core-runtime.sh --target linux-amd64 NEW_ABSOLUTE_OUTPUT` and the corresponding arm64 invocation on a matching host, then `OH_CORE_ARTIFACT_DIR=BUILD_OUTPUT go test ./internal/host -run TestReleaseClosureBuiltCore` on each result. Generate/verify the release manifest per operations guidance.
4. If process control/ownership changes, retain `./scripts/test-proc-hidepid-uids.sh` coverage; same-UID fixtures do not prove Unix-user separation. The integrated full clean gate belongs to the conductor/release, not this report.

These checks follow `TESTING.md`; they are proposed acceptance, **not claimed passes** from this research.

## 3. Product surfaces affected

- **Agent background commands, shell interception and process-driven turns:** `internal/daemon/recap_linux.go`, `pi_rpc_linux.go` load/select the extension; `process-extension.mjs` bridges its protocol and turn-mode policy.
- **Process tray, output, stop/force-stop and clear-finished:** `internal/daemon/processes_linux.go`, `process-extension.mjs`, `web/src/components/ProcessTray.tsx`.
- **Restart catch-up, interrupted-process history and waiting state:** `internal/daemon/process_interrupted_linux.go`, `wake_linux.go`, `process-extension.mjs` (`branchFacts`, wake inference and wait reminders).
- **Displayed process notifications/tool results:** `internal/daemon/processes_linux.go` projection and `web/src/app/HistoryView.tsx`. Structured output is not a replacement for persisted details; raw codemode output is intentionally not persisted upstream.
- **Delivered runtime acceptance:** `scripts/core-runtime-build.py`, `internal/host/release_closure_linux.go`.

Sources: named product code; upstream output/delivery contracts in S2–S4.

## 4. Optional capabilities — proposals, not part of the bump

- **More accurate “will wake” state:** consume list `wake`, including unfired log watches, rather than guessing only from start-result exit attentions. Use `sessionIdle` for notification-history meaning. Extend companion projection/contracts, daemon wake classification and tray tests before changing presentation; currently the companion explicitly cannot observe pending log watches. [S2–S4; `process-extension.mjs`]
- **Move a foreground command into managed background execution:** integrate `processes:command:adopt` with an owning extension, detached process groups, piped streams, original start time and captured initial output. Prove cancellation, ownership and shutdown behavior; do not introduce another process registry. [S2–S4]
- **Structured codemode process orchestration:** qualify output schema and bounded raw log arrays, preserve individual parallel-start failures with `Promise.allSettled()`, and retain per-call approval/text-only enforcement. Optional deferred exposure requires discoverability through tool search/codemode; retain default `direct` until proven. Do not assume `structuredContent` is session history. [S2–S4; `runtime/core/AGENTS.md`, `process-extension.mjs`]
- **Browser log wrapping/paging:** upstream terminal overlays offer these, but they do not automatically change Habitat's browser. A browser affordance would need its own product/UI work and tests. [S3; `web/src/components/ProcessTray.tsx`]

## 5. Verdict and evidence limits

**needs-work**, not hold: runtime floors fit and no observed licence/publishing-identity issue warrants rejecting the release. However, the reproduced terminal-start/history mismatch requires product code and tests; parser override reconciliation and trust/notification qualification must accompany the eventual bump. New capabilities above remain separate conductor proposals.

Performed: current registry inspection; downloaded old/new published packages and source diff; SHA-512 and npm registry-signature verification for both pi-processes artifacts; provenance statement inspection; matching dependency metadata/tarball/integrity inspection; production JavaScript history-reader reproduction. Not performed: candidate npm installation, upstream test suite, native provider turn, full Sigstore verification, full closure vulnerability audit, either runtime archive build or new Go regression execution. Documentation validation and whitespace checks are the report-only landing checks.

## Sources

- **S1:** npm registry metadata, including version manifests/timestamps/tags: `https://registry.npmjs.org/@aliou%2fpi-processes`.
- **S2:** Published artifacts: `https://registry.npmjs.org/@aliou/pi-processes/-/pi-processes-0.10.9.tgz` and `https://registry.npmjs.org/@aliou/pi-processes/-/pi-processes-0.13.8.tgz`. All source comparisons use these integrity-checked bytes, not a moving branch.
- **S3:** Published-commit changelog: `https://github.com/aliou/pi-processes/blob/23c9313b71f93172884d5e381c1ffd408ef60ff2/CHANGELOG.md` (also read from the tarball).
- **S4:** Source comparison: `https://github.com/aliou/pi-processes/compare/550b2e9fe0a5e9ebb77612dfc2f672d4038161b4...23c9313b71f93172884d5e381c1ffd408ef60ff2`. Key artifact files: start tool, notification registry/handlers/sender, request handlers, manager runtime controller, shell utilities, config and package manifest.
- **S5:** Dependency metadata: `https://registry.npmjs.org/@aliou%2fsh`, `https://registry.npmjs.org/@aliou%2fpi-utils-ui`, `https://registry.npmjs.org/@aliou%2fpi-utils-settings`; inspected their referenced tarballs for versions 0.4.1, 0.6.0 and 0.24.2 respectively.
- **S6:** Attestations: `https://registry.npmjs.org/-/npm/v1/attestations/@aliou%2fpi-processes@0.10.9` and `https://registry.npmjs.org/-/npm/v1/attestations/@aliou%2fpi-processes@0.13.8`.
- **S7:** Registry signature keys: `https://registry.npmjs.org/-/npm/v1/keys`.
