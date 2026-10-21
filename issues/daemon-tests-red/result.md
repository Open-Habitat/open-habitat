# Result

## Cause and fix

Same-UID host processes (notably an opaque `gpg-agent`) made native process
censuses unknown. Tests incorrectly treated a shared host's census as a fixture
that could prove absence. Scoped synthetic proc trees now use the existing
controller/deletion seams; tests exercising real writers expose only their own
children through procfs symlinks. The batch snapshot census has the same seam,
with its production wrapper still hardwired to `/proc`.

Archive now explicitly supplies an opaque same-UID process and requires
`control_uncertain`, rather than relying on incidental host uncertainty.
Native descriptor, child exclusion, restart, ownership-lock, unknown-process,
and root-owned-runtime checks remain intact. Removed host-churn retries where
absence is now deterministic; no tests or boundary assertions were skipped.

## Evidence

Both baselines used `umask 077`, `TMPDIR=/var/tmp`, and
`npm ci --prefix internal/daemon/pi-device-test --ignore-scripts` before
`go test -race -count=1 ./...`, from base `1e9991b8edd1ce45b2fe168d7c0283c350ab48ae`.
The original worktree failed in 156.63 s; a fresh detached worktree at
`/var/tmp/oh-daemon-path.SGk8QQ` failed in 168.15 s. Both had exactly these
12 top-level daemon failures (all other packages passed):

- `TestArchiveKeepsNativeHistoryAndRejectsUnknownWriters`
- `TestConversationContinuationProofAndStatus`
- `TestCloneInterruptedAfterRestartAndExplicitActions`
- `TestObserveWithNativeGit`
- `TestHeldMessagesAcrossDaemonRestart`
- `TestIdleConversationsYieldTheirPlace`
- `TestArchiveStopsIdlePiButNotBackgroundWork`
- `TestIdleTimeoutResumesOnce`
- `TestPiWriterLiveOwnUID`
- `TestKnownControllerChildInSameWorkspaceDoesNotBlockOtherSession`
- `TestProcessResumeCatchUpAcrossDaemonRestart`
- `TestWorkspaceDeleteDuringSnapshotGitInspection`

With documented prerequisites, neither baseline reproduced additional unsafe
home, Pi-runtime, Microsoft-renewal or gateway failures. No speculative fixes
were made for those historical symptoms.

The first patched daemon run exposed one fixture omission: the native restart
test's external terminal writer also needed to be exposed in its scoped census.
That was corrected before final validation.

An intermediate full run passed in the worker in 111.30 s. The corresponding
fresh-path run passed the daemon but caught an integration fixture race:
`TestPastedRedirectIsValidatedAndHandedOnce` removed an account after login
completion but before reconciliation released `c.write`. Removal correctly
refused contention with 503. The fixture now waits for that reconciliation
before its next write; production's fail-fast removal behavior is unchanged.
Final `go test -race -count=1 ./...` passed in both locations:

| Location | Wall time |
| --- | ---: |
| Worker | **77.34 s** |
| Fresh `/var/tmp` worktree | **76.26 s** |

Both ran the identical final code: tracked patch SHA-256
`e1c573167b259acd2856d189187cd8dfc3170122f69c322736a1a334759adab5`,
plus `proc_fixture_linux_test.go` SHA-256
`b4abdcc066ac6dd4c5242c6163a70e8aeaea4db20ae20431a77035420bc14feb`.
The integration case also passed 50 consecutive race-enabled runs.
`./scripts/test-focused.sh --area contracts`, `git diff --check` and
`python3 scripts/validate-project-view.py` passed.
Self-review and a focused `claude-fable-5-1` review completed. No actionable
findings survived verification: its umask concern was outside the explicitly
required `077` setup; its claimed lost interrupted-clone process coverage is
already exercised indirectly by `TestCloneListInconclusiveProcessScan` through
`listProcessScan` -> `interruptedCloneWithScan`. No follow-up issues were filed.
The product extraction keeps `/proc` hardwired in its production wrapper and
leaves all UID, owner and pinned-inode checks unchanged.

A focused verbose race run passed archive unknown-writer rejection,
continuation ownership, real writer detection, child exclusion, synthetic
census, snapshot/deletion overlap and runtime rejection. The existing
`TestTrustedPiRuntime` positive root-owned fixture skipped because this runner
is nonroot; the fail-closed runtime test passed. This work does not establish
distinct-UID isolation or live-server behavior.

Optional model-performance corpus logging failed on Alder SSH-to-self
(authentication refused); the review itself completed successfully. No required
validation remains blocked. `issuectl doctor --json` also passed.
