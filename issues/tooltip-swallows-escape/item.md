---
created: 2026-11-01
updated: 2026-11-14
type: bug
status: duplicate
priority: normal
provenance: other
provenance_detail: pilot.18 clean gate
source_ref: taskfleet:01m6c2ybczc0gvg629k2gnka93/gate:tooltip-escape
originating_run: 01m6c2ybczc0gvg629k2gnka93
originating_run_kind: spinoff
closed: 2026-11-14
---

# An open hover tooltip swallows Escape meant for the composer

## Description

Observed in the pilot.18 clean gate on Birch (1.11., candidate 48eae59f):
`lab-composer-area.spec.ts` "Esc in the field stops Pi and puts the queue
back into the field" failed about every other run, also alone.

Cause: since the quick shared tooltips (`icon-tooltips-slow`), any hover
help that the resting pointer has opened (in the failing runs the
"Päivitä" refresh button's) is a React Aria tooltip, and an open React
Aria tooltip takes every Escape keydown in the document in the capture
phase and stops its propagation. The composer never saw the key, so Pi
kept working and the queued follow-up stayed queued. A person who has just
clicked Send/Stop or any icon button and leaves the mouse there hits the
same thing: the first Esc only closes the tooltip.

Fix: `QuickTooltip` closes its open help synchronously when Escape is
pressed outside its trigger, so the key reaches the focused element; Escape
on the trigger itself still only dismisses the help.

## Resolution

### 2026-11-14T07:30:02Z · @issuectl

Fixed in race-tooltip-escape-under-load.
