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

# Hover labels still appear in Explain mode

## Description

Jari 8.11.2026, test server: in Explain mode (the ? view) the ordinary hover
labels still open, for example the right-opening labels of the sidebar's small
buttons, on top of the explanation cards. No hover tooltip or label meant to
explain a control should appear while Explain mode is on; the mode's own cards
are the explanation. Fixing agreed behaviour; no prototype.

## Acceptance Criteria

- [x] With Explain mode on, no hover/focus tooltip or label opens anywhere (sidebar, strips, composer, settings); off, they work as before.
- [x] Test covering it; touched specs green.
