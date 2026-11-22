---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: in-progress
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-place-toggle
lane: unlaned
preparation: ready
---

# Rail: pressing an open place (Tuotokset, Agentin käytössä) again returns to where you were

## Description

Jari (22.11.2026, test server): opening Tuotokset from the rail and pressing the
Tuotokset button again does nothing; it should close the view and return to
where he was. Same for Agentin käytössä. These place views should behave like
an overlay over the current conversation/workspace: the same button toggles
it away and the previous state comes back.

Next action (approved for implementation, Jari 22.11.2026): pressing an open
place's rail button again closes it and restores the previous view.
