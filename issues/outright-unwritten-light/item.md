---
created: 2026-10-23
updated: 2026-10-23
type: bug
status: in-progress
priority: normal
provenance: chat
source_ref: taskfleet:01m5m3np29q4xr2ky663p6ws70/task
originating_run: 01m5m3np29q4xr2ky663p6ws70
originating_run_kind: spinoff
---

# Gateway cannot bind declared HTTPS port 443

## Description

## Description
Pilot installation at converging seq 12 cannot bind declared TCP 443 as its non-root gateway. No capability is granted and the kernel privileged-port threshold is 1024. Support least-authority low-port binding, preflight and same-operation continuation, inspect remaining convergence assumptions, and publish product 0.1.0-pilot.6 (runtime pilot.3 unchanged).

## Acceptance Criteria
- [ ] Supported privileged-port policy, continuation regression, independent review and verified published product with installer handoff.
