---
created: 2026-10-28
updated: 2026-10-28
type: bug
status: untriaged
priority: normal
provenance: other
source_ref: taskfleet:01m61wz8039qbfn1xg421ds8m9/test-flake:process-pinned-pi-bridge-wake
originating_run: 01m61wz8039qbfn1xg421ds8m9
originating_run_kind: spinoff
---

# TestProcessPinnedPiBridgeAndWake fails under heavy load: native wake not active

## Description

`go test ./internal/daemon` failed once on Birch on 2026-10-28 (about 21:20)
in `TestProcessPinnedPiBridgeAndWake`:

    process_native_linux_test.go:121: native wake not working: active=false state=idle

The run was `./scripts/test-focused.sh --area go --go-package ./internal/daemon`
in the github-connection-classify worktree while about ten other workers ran
(load average around 10 on 8 vCPUs). The same test then passed 10 of 10 runs
alone (`go test -count=10 -run TestProcessPinnedPiBridgeAndWake`, load
average about 4). The change under test did not touch the process bridge or
the wake path, so this looks like a timing assumption in the test that heavy
load breaks: the wake is checked before the bridged Pi reached its active
state.

Impact: a red daemon package in a worker or on main's gate for a reason
unrelated to the change, costing a rerun and attention. Direction: find the
wait at process_native_linux_test.go:121 and replace a fixed sleep or a
too-short deadline with a poll on the observed state.
