---
created: 2026-11-13
updated: 2026-11-13
type: feature
status: done
priority: normal
preparation: ready
lane: terminal
lane_seq: 3
collision: [web/src/components/Terminal.tsx]
closed: 2026-11-13
commits:
- hash: f29e0a0e
  summary: browser terminal lane
---

# Terminal: copy on select and a clear copy action

## Observed (Jari 13.11.2026)

Selecting text in the browser terminal does not copy it, as many terminal
environments do (copy on select), and copying from the terminal in general
needs thought.

## Expected

Copy on select (selected text goes to the clipboard), plus a clear way to
copy otherwise (shortcut / context action), without breaking tmux's own
mouse mode. New behaviour: experimental feature first.
