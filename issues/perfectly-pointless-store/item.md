---
created: 2026-10-23
updated: 2026-10-23
type: bug
status: fixed
priority: normal
provenance: chat
source_ref: taskfleet:01m5kybnm5b081ptsvbzaby1q9/task
originating_run: 01m5kybnm5b081ptsvbzaby1q9
originating_run_kind: spinoff
closed: 2026-10-23
---

# Prepare proc remount fails on repeated preparation

## Description

## Problem
Pilot.3 prepare failed restarting the product proc unit: mount sends gid=open-habitat-proc to the kernel, which reports Bad value for gid. Operation c18ecc2ecde0500d7fd1764e208a365f is running at session_restarting, seq 7. Read-only pinned SSH confirms group GID 988, retained effective hidepid=invisible,gid=988, failed proc service and active logind/polkit. Pilot.2 previously prepared successfully.

## Reproduction
Rerun prepare on the already prepared pilot with pilot.3. The shipped guide provides no continuation for the incomplete prepare and no TLS rotation procedure.

## Acceptance Criteria
- [x] Numeric proc GID and already-prepared rerun regression coverage.
- [x] Narrow supported journal continuation proven synthetically and documented.
- [x] TLS rotation documented; independent hostop review assessed.
- [x] Product pilot.4 prerelease downloaded and verified; unchanged pilot.3 runtime pins and exact continuation in pilot-handoff.md.

## Scope
Pilot inspected read-only. No VM qualification or customer changes in this run. Pilot acceptance belongs to the subsequent customer installer.

## Resolution

### 2026-10-23T09:05:40Z · @issuectl

Published and downloaded/verified product pilot.4; fixed numeric proc rendering and narrowly verified prepare continuation; pilot.3 runtime unchanged. Focused tests and independent review assessed. Exact pins and customer continuation in pilot-handoff.md; pilot read-only, no VM/live acceptance claimed.
