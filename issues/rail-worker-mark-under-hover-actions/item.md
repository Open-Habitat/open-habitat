---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-11-08
---

# Rail row's worker (branch) mark shows through the hover action buttons

## Description

Jari 8.11.2026, test server: in the left rail, a conversation that has
workers or helpers shows a branch icon at the row's right end. On hover the
row's action buttons (for example *Arkistoi*) appear in the same place, and
the branch icon peeks out from under them at a corner, which looks messy.
Jari accepted either moving the mark to the left over the status ball or
hiding it while the actions show; the conductor chose hiding: whenever the
row's hover/focus actions are visible, the trailing marks under them
(branch icon and any other trailing mark in that slot) are not rendered or
are fully invisible, and they return when the actions go. No layout change
otherwise.

## Acceptance Criteria

- [x] With hover or keyboard focus on a rail row, no trailing mark shows under or beside the action buttons; without, the mark shows as before; 1440 and 390 (touch: actions as today).
- [x] Touched rail specs green; screenshot before/after.
