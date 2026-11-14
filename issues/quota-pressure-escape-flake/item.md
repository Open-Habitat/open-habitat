---
created: 2026-11-01
updated: 2026-11-14
type: chore
status: duplicate
priority: normal
provenance: other
provenance_detail: pilot.18 clean gate
source_ref: taskfleet:01m6c2ybczc0gvg629k2gnka93/gate:quota-pressure
originating_run: 01m6c2ybczc0gvg629k2gnka93
originating_run_kind: spinoff
closed: 2026-11-14
---

# quota-pressure spec presses Escape before focus returns to the status panel

## Description

Observed in the pilot.18 clean gate, attempt 2 on Birch (1.11., ee3a1685):
`quota-pressure.spec.ts` "quota warning, full storage and recovery keep the
conversation mounted without resending" failed once under the whole
suite's load (Escape left the status panel open, so the bell stayed) and
passed three times alone.

The last recheck removes its own button together with the storage item;
React Aria moves focus back into the popover afterwards. The spec pressed
Escape at once, so under load the key could land before focus was back in
the panel, where the popover's Escape handler does not see it. The spec now
waits until focus is inside the popover before pressing Escape.

## Resolution

### 2026-11-14T07:30:23Z · @issuectl

Collected into gate-load-flakes-bundle (14.11.2026).
