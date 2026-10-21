# Result

The browser's `PiModelsProvider` preloaded and polled `/api/v1/pi/models` every 60 seconds. Opening model selectors also refreshed it; workspace direct-start admission made a separate fresh read.

Each model read redundantly validated the shared selector, walked the entire root-owned runtime/dependency tree, and ran `node --version`. It then spawned a bounded Node SDK helper (not an interactive Pi session), loaded Pi's offline native provider catalog and the declared Claude bridge, read native settings, and derived observations from recent session tails. Claude fallback status and credential reads also repeated the runtime walk. The daemon already performs full runtime validation before publishing any handlers.

Model, credential and Claude-login operations now retain cheap configuration/HOME checks and all mutable native-store checks, but do not repeat startup validation. No cache or second catalog was added. Catalog preload, focus, picker-open and mutation reads remain; idle minute polling is removed. Operator runtime upgrades still require daemon restart.

## Evidence

Base: `551bf5624a424168436daa75171b4f8d8a9260ee`. Tests cover the working-tree patch committed with this result.

- `./scripts/test-web-fast.sh`: passed, including the new three-minute idle/no-poll regression and focus/explicit-refresh assertions.
- `cd web && npx playwright test tests/settings-model-picker.spec.ts`: 3 passed, 7.6 s, through the Alder/Cedar runner (synthetic host).
- `./scripts/check-generated.sh`, `python3 scripts/validate-contracts.py`: passed.
- Focused independent review by `claude-fable-5-1`: no actionable findings. Checked startup callers, mutable-path checks, selector-upgrade semantics and picker/mutation refreshes. Added the suggested HOME-mismatch regression for all three changed operation boundaries.
- Native SDK helper-only baseline on Alder, synthetic empty home: 1.160 / 0.707 / 0.685 s. These exclude release validation and history observations.
- Extended startup regression checks that models, credentials and Claude status do not repeat selector/tree validation, and still reject a changed HOME. First complete patched daemon run measured the native model read at **1.254 s** through the remote runner. This is synthetic timing, not a measurement on the live test VM.

- Final `go test -race -count=1 -v ./internal/daemon`: changed-boundary tests passed; native models read **0.673 s**. The package remains red on 12 unchanged failures, reproduced on main `3bf45646704996bd99434174c80f04aec89f8d5c` (same daemon sources as the base). Failures: `TestArchiveKeepsNativeHistoryAndRejectsUnknownWriters`, `TestArchiveStopsIdlePiButNotBackgroundWork`, `TestCloneInterruptedAfterRestartAndExplicitActions`, `TestConversationContinuationProofAndStatus`, `TestHeldMessagesAcrossDaemonRestart`, `TestIdleConversationsYieldTheirPlace`, `TestIdleTimeoutResumesOnce`, `TestKnownControllerChildInSameWorkspaceDoesNotBlockOtherSession`, `TestObserveWithNativeGit`, `TestPiWriterLiveOwnUID`, `TestProcessResumeCatchUpAcrossDaemonRestart`, `TestWorkspaceDeleteDuringSnapshotGitInspection`. No new failure remains. These are the concurrent `daemon-tests-red` / `browser-suite-red` work, not waived new failures.
- Initial patched run also failed `TestPiModelsNativeDefault` with `native Pi models unavailable`; it passed in both the unchanged-main comparison and final patched run. The independent review also reported fixture-install/umask setup failures before its successful focused checks.
- A disposable archive comparison could not use the fleet Go dispatcher: first `git exited 128`, then the initialized copy was not host-approved. Recovered by running the unchanged package on the clean, approved main checkout. Local diagnostic logs: `/var/tmp/pi-models-{go,go-final,main-go-approved,main-go,main-go-retry,review}.log`.
- `git diff --check`, `python3 scripts/validate-project-view.py`, `issuectl doctor --json`: passed.

## Limits

No live VM latency claim or provider-network claim. The Node helper and bounded history scan remain per request; this removes the repeated installation scan, not all catalog work. Distinct-UID/root-only checks need their dedicated fixtures and are not established by the ordinary daemon/browser checks. Finnish manual check is in `KOKEILTAVAA.md` for the next test deployment.
