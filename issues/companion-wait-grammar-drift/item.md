---
created: 2026-10-27
updated: 2026-10-27
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: found by design-study worker by running the shipped module
source_ref: taskfleet:01m5xxx5ffpr29q7bmbmkctzhd/observed:companion-wait-grammar
originating_run: 01m5xxx5ffpr29q7bmbmkctzhd
originating_run_kind: research
---

# Companion's wait grammar still misses real run wait shapes, so restart catch-up does not re-arm

## Description

Found 2026-10-27 while studying `agent-worker-wait-model`, verified by running the shipped module with node.

`waitRuns` in `internal/daemon/process-extension.mjs` (the companion's copy of the daemon's Taskfleet wait grammar) was not updated when `taskfleet-wait-grammar-misses-real-waits` fixed `taskfleetWait` in `internal/daemon/processes_linux.go`. It still refuses `&` and does not know `--check-in` or `--terminal`:

    waitRuns('taskfleet run wait <id> --output json')                                  -> [<id>]
    waitRuns('cd ~/src/open-habitat && taskfleet run wait <id> --check-in 45m --output json') -> []
    waitRuns('taskfleet run wait <id> --terminal --output json')                       -> []
    waitRuns('taskfleet run wait <id> --check-in 45m')                                 -> []

The rejected shapes are the ones conductors actually use. Effect: after a daemon restart (release, upgrade, crash) the resume catch-up (`prepareCatchUp` → `readSpinoffs`) does not know which runs the cut-off wait covered, so a still-running worker is not listed under "Still running, and your wait for them was cut off" with the wait to start again, and a waited-for run is not read unconditionally. The agent is not told to re-arm and nothing wakes it when that worker settles; the same failure mode as `pi-stop-cause-overnight`, reached through a restart instead of a forgotten re-arm.

Fix: make the two grammars agree (same accepted shapes, same refusals), and add the real shapes to `pi-device-test/process-extension.test.mjs`; ideally one shared fixture table both tests read so they cannot drift again.
