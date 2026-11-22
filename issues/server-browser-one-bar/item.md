---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-server-browser-one-bar
lane: server-browser-control
lane_seq: 5
preparation: ready
closed: 2026-11-22
---

# Server browser: turn and clipboard controls move into the top bar beside Sulje selain

## Description

Jari (22.11.2026, trying the test server): the server browser viewer now has two
control places at once: the Kehys tabs on the canvas edge (turn / Ota ohjaus / Valmis,
and Leikepöytä) and the old top bar with "Sulje selain" and the close ×. Move the
Ota ohjaus content and the clipboard content into that same top bar, so there is one bar.

Next action (approved for implementation, Jari 22.11.2026): one top bar carrying the
turn controls and the clipboard; the canvas border keeps showing who controls.

## Acceptance Criteria

- [x] Turn, request and clipboard controls share the sheet top bar with stop and close.
- [x] Canvas-edge tabs are removed; the dashed/solid border still identifies control.
- [x] Existing input, clipboard and idle-return paths pass the focused browser checks.
- [x] Phone-width actions stay on one row with accessible names and an accessible clipboard popover.
