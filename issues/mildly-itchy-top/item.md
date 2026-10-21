---
created: 2026-10-20
updated: 2026-10-21
type: bug
status: fixed
priority: normal
provenance: other
source_ref: taskfleet:01m5d3qn4xx2t9q0v0qdsvvs3x/test-failure:archive-idle-race
originating_run: 01m5d3qn4xx2t9q0v0qdsvvs3x
originating_run_kind: spinoff
lane: archive
lane_seq: 2
collision: [internal/daemon/archive]
closed: 2026-10-21
---

# Archive test races with its background idle check

## Description

## Description

An observed race in `TestArchiveKeepsNativeHistoryAndRejectsUnknownWriters` makes the required daemon race suite fail nondeterministically. This is a test-health defect, not evidence of a production cross-user access problem.

## Reproduction

Run `./scripts/test-focused.sh --area go --go-package ./internal/daemon` (includes `go vet` and `go test -race -count=1`). Observed on the ARM64 runner in job `87991b01131907ced3cbd49094777d3708d283aefba147e4289e0f92275964f2`, based on main `fae07aecfa626e3729f8ea41995514c6ce66fd46` plus cross-workspace attribution changes. None of `archive_linux.go`, `archive_linux_test.go` or `pi_activity_linux.go` was changed.

Race report: write/access to the test's map at `archive_linux_test.go:218`, concurrent with `ConversationController.classify` at `pi_activity_linux.go:113`, called by `stopIfIdle` at `pi_activity_linux.go:230` from `archiveInput.gowrap5` (`archive_linux.go:216`). The test ends with `race detected during execution of test`. Full retained synthetic logs: `/var/tmp/oh-browser-acanlwxv/009-logs.json` on Alder.

A repeat of the same check on an unchanged checkout of that main commit did not reproduce this race; it failed instead on the separately known terminal cleanup flake. Treat reproduction as intermittent, not deterministic. Inspect the test's mutation of controller session state while the archive-triggered goroutine is still live.

## Expected Behavior

The archive test synchronizes its fake controller state and background activity so the required race suite does not fail on test-owned shared state.

## Acceptance Criteria

- [x] Repeated race-enabled archive tests no longer report this shared-map race, without disabling the detector or removing archive coverage.
