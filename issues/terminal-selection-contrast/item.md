---
created: 2026-11-15
updated: 2026-11-15
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-15/terminal-selection-contrast
lane: unlaned
lane_seq: 1
preparation: ready
---

# Terminal selection is barely visible in the night theme

## Description

Jari 15.11.2026: in the browser terminal, the selection painted while holding Shift (and dragging) is hard to see: its colour barely differs from the background, at least in the Yö (night) theme, so he does not notice what is selected.

Code: `web/src/components/Terminal.tsx` sets xterm's `selectionBackground` from `--ah-accent-soft`.
