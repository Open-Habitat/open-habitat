---
created: 2026-11-13
updated: 2026-11-13
type: bug
status: fixed
priority: normal
preparation: ready
lane: terminal
lane_seq: 2
collision: [web/src/components/Terminal.tsx]
closed: 2026-11-13
commits:
- hash: f29e0a0e
  summary: browser terminal lane
---

# Terminal: scrolling jumps and the cursor jumps into the scrolled view

## Observed (Jari 13.11.2026)

Scrolling in the browser terminal misbehaves: the view jumps, the cursor
jumps into the scrolled view, and the terminal stays briefly in a state
where it does not respond properly.

## Expected

Scrolling back moves smoothly through the scrollback (tmux history included)
without the cursor jumping, and the terminal responds normally throughout.
