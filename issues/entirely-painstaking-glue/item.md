---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: observed in clean gate runs
source_ref: taskfleet:01m5pwash6xqdy2ckhjytkh1aa/gate-flake:personal-data-skill
originating_run: 01m5pwash6xqdy2ckhjytkh1aa
originating_run_kind: spinoff
lane: unlaned
collision: [internal/daemon/integrations]
preparation: ready
closed: 2026-10-24
---

# Daemon integration tests race the personal-data skill generation under gate load

## Description

Under the full clean gate's load on Alder (2026-10-24, two runs on the server-integrations-dropbox branch, which does not touch internal/daemon/integrations), tests in `internal/daemon/integrations` that read the generated personal-data skill right after a connect/login failed because the file was not there yet:

- run 1: `TestDropboxConnectSyncRestartAndRemove` — `dropbox_linux_test.go:165: skill: open .../.agents/skills/personal-data/SKILL.md: no such file or directory`
- run 2: `TestGoogleConnectSyncRestartAndRemove` (`google_linux_test.go:144`) and `TestDeviceCodeRelayBelongsToItsSession` (`integrations_linux_test.go:592: skill after login: ...`), same error

Each passes when run alone (`go test ./internal/daemon/integrations -run <name> -count=3`). The tests seem to read `~/.agents/skills/personal-data/SKILL.md` before the catalog's skill regeneration has finished, so they race the generation under CPU load. Either the tests should wait for the regeneration they depend on, or the generation is not synchronous with the operation the product claims completes it; which one needs a look at when the catalog writes the skill. Effect: the clean gate fails on an unrelated tree.

## Acceptance Criteria

- [x] Identify whether the skill writer or the assertions race, and synchronize at the actual completion boundary.
- [x] The three reported tests pass 50 times with the race detector, umask 077 and a private disk-backed TMPDIR.

## Result

The assertions ran early. `driveLogin` intentionally publishes `completed`
before `reconcile`, while holding `c.write`: this commits the accepted native
login against cancellation before reconciliation can start a token refresher.
Reconciliation serializes skill writes with all other catalog writes. Moving
the published state later would regress cancellation behavior, already covered
by `TestCompletionWinsCancellationDuringReconciliation`.

The three tests now wait for the attempt's existing `done` channel before
inspecting derived files or supervision. This channel closes after the worker's
cleanup and reconciliation, including deferred reconciliation on renewal. The
existing barrier regression uses the same helper and checks that the skill is
present after releasing deliberately blocked reconciliation (both ordinary and
folder-choice logins). No product behavior changed.

## Tests Run

Tested the code diff atop `b465282db93d25fc8ca1ae8d853cf9d2a53dad9f`:

- [x] `umask 077; export TMPDIR=$(mktemp -d /var/tmp/oh-XXXX); go test -race -count=50 ./internal/daemon/integrations -run '^(TestDropboxConnectSyncRestartAndRemove|TestGoogleConnectSyncRestartAndRemove|TestDeviceCodeRelayBelongsToItsSession|TestCompletionWinsCancellationDuringReconciliation)$'` — passed, all four tests (including both barrier subtests).
- [x] `umask 077; export TMPDIR=$(mktemp -d /var/tmp/oh-XXXX); go test -race -count=1 ./internal/daemon/integrations` — passed.
- [x] `python3 scripts/validate-contracts.py` — passed (67 schemas, 83 fixtures, 40 scenarios).
- [x] `git diff --check` — passed.

No full clean gate or live-provider run; this is synthetic integration-test
synchronization, not live-provider qualification.
