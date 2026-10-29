---
created: 2026-10-29
updated: 2026-10-29
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: pilot.15 clean gate run
source_ref: taskfleet:01m64akne6b0b1xysrxstj3enk/gate:recap-presence-race
originating_run: 01m64akne6b0b1xysrxstj3enk
originating_run_kind: spinoff
closed: 2026-10-29
---

# Recap presence test marks a manual recap running before the automatic one has ended

## Description

The pilot.15 clean gate on Birch (1f385566, 29.10. evening) failed
`TestPresencePostponesAutomaticRecapButNotARunningOne` with "presence fenced
a running recap".

The fake recap generator signals `called` from inside `runRecap`; the
timer's goroutine still clears `s.recapping` after the generator returns.
The test immediately sets `s.recapping = true` to model a manual recap in
flight, the automatic run's end clears it underneath, and the next presence
report fences the epoch. Under CPU load (`-cpu 1,2 -count 600`, twelve busy
loops) the old test failed 24 times in 1200 runs.

Fix: the test waits until the automatic run has ended (recapping false under
c.mu) before the manual case; 0 failures in 1200 runs under the same load.

## Resolution

### 2026-10-29T19:15:36Z · @issuectl

Test waits for the automatic recap to end; 0/1200 under load (old: 24/1200).
