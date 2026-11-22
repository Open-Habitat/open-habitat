---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-place-toggle
lane: unlaned
preparation: ready
closed: 2026-11-22
commits:
- hash: 31170296634fa3cac00e1b137978c98afc9dfed7
  summary: Preserve place visits and return state
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

## Acceptance Criteria

- [x] Both place links return to the same mounted conversation or workspace, preserving draft, reading position and unsaved editor text; focused browser tests cover desktop and phone navigation.
- [x] Escape, browser history, direct links, Home, accessibility state and the existing server-browser modal have explicit decisions and verification recorded in result.md.
