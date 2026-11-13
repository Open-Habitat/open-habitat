---
created: 2026-11-13
updated: 2026-11-13
type: bug
status: open
priority: normal
preparation: ready
lane: terminal
lane_seq: 1
collision: [web/src/components/Terminal.tsx]
---

# Terminal: a mouse selection disappears before it can be copied

## Observed (Jari 13.11.2026)

In the browser terminal, text selected with the mouse disappears again
quickly, before the person can copy it.

## Expected

A selection stays until the person clicks elsewhere or the selected text
itself changes; terminal output elsewhere or a redraw does not clear it.
