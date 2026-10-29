---
created: 2026-10-29
updated: 2026-10-29
type: feature
status: untriaged
priority: normal
provenance: other
provenance_detail: taskfleet worker run sidebar-group-row-time
source_ref: taskfleet:01m63gzb4d8mnc471ny1rk0wnz/rail-failed-sources
originating_run: 01m63gzb4d8mnc471ny1rk0wnz
originating_run_kind: spinoff
---

# Rail failed ball for failed Taskfleet worker runs and error-ended turns

## Description

The rail's state ball (sidebar-group-row-time, Jari's 29.10. choice Aika from research-workmux-sidebar round 3) has four states: working, your turn, done and failed. Failed is red and never folds away, because the person has to look at it.

Today the rail shows failed only when Pi crashed: the snapshot agent's `rest.cause` is `crash` (web/src/app/railNow.ts, `crashed`). The prototype's failed state also covers two other cases, and neither is a per-agent fact in the snapshot:

- A Taskfleet worker run that Taskfleet marked `failed` (contracts/v1/spinoffs.schema.json). The worker's own conversation row keeps the green done ball, or the working ball while its Pi is alive, so a failed worker reads as finished in the rail.
- A turn that ended in an error: the last assistant message's `stop_reason` is `error` or the turn's `is_error` is set (contracts/v1/event.schema.json). The row shows done.

What a fix needs: a per-agent fact in the snapshot that the daemon derives from native sources (the Taskfleet run record for a worker's session, the last assistant message on the branch, which the snapshot's branch scan already reads per file stamp in internal/daemon/process_interrupted_linux.go), and railNow mapping it to `failed`.
