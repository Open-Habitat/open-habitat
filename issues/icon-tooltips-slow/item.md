---
created: 2026-11-01
updated: 2026-11-01
type: bug
reporter: jari
status: fixed
priority: high
lane: icon-tooltips-slow
lane_seq: 1
preparation: ready
closed: 2026-11-01
---

# Icon button tooltips appear far too slowly

Jari 1.11.: the conversation header's icon buttons (editor, terminal, queue, recap, archive, details; screenshot `attachments/header-icons.png`) explain themselves only through a mouse-over tooltip, and it appears far too slowly. They are native `title` tooltips, whose delay (about a second) the page cannot change. Replace them with one shared quick tooltip for every icon-only button (`IconButton` in `web/src/components/ControlElements.tsx`, the header's icon buttons and other icon-only controls): it appears after a short delay on hover (a few hundred ms) and at once when moving between neighbouring buttons, on keyboard focus too, never covers the button it explains, and leaves the accessible name as it is. Touch has no hover: do not invent a long-press behaviour here; `proto-conversation-header-actions` decides how phone users learn the buttons. Build on the design-system tokens and React Aria if it serves. Fix to existing behaviour: not gated.
