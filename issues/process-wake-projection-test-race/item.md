---
created: 2026-11-07
updated: 2026-11-07
type: bug
status: fixed
priority: normal
provenance: ci
source_ref: taskfleet:01m6v4fwchjk9y365ebg4cn7t6/gate:process-wake
originating_run: 01m6v4fwchjk9y365ebg4cn7t6
originating_run_kind: spinoff
closed: 2026-11-07
commits:
- hash: 27bdfa158
  summary: wait for the projected wake
---

# TestProcessPinnedPiBridgeAndWake looked for the wake notification before drain had read its frame

## Description

Observed in the pilot.20 clean gate on 9a1581ec (2026-11-07, `~/.local/state/oh-conductor/gate-pilot20-2/stdout.json`): `TestProcessPinnedPiBridgeAndWake` failed at `process_native_linux_test.go:147`, "live wake delivery not projected". Passes alone.

The test waits until the wake's run is active (`agent_start` drained) and then looks once for the `process.notification` wake event in the journal. That event is projected at the notification's `message_end`, a later frame than `agent_start`; Pi wrote it before the held provider call, but `drain` reads frames on its own goroutine and under load had not reached it yet.

Fix: wait for the projected wake event, as the test already waits for the run; the held provider call keeps the run from settling meanwhile.
