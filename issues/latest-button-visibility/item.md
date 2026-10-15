---
created: 2026-10-15
updated: 2026-10-15
type: bug
reporter: jari
status: in-progress
priority: normal
lane: web
lane_seq: 35
collision: [web/]
---

# Jump-to-latest button ignores content height changes

Jari, pilot.65 (2026-10-15), the "Viimeisimpään" (jump to latest) button:
- When the user expanded blocks so that the conversation grew taller than the viewport, the button appeared only after the user scrolled a little.
- When the user collapsed blocks so that the conversation got shorter and the last message was visible, the button stayed floating.
- Its down-arrow icon is not centred horizontally.

Visibility must follow content height changes (expand/collapse, streaming, images loading), not only scroll events. The arrow is centred. The button's overall design is queued for its own prototype round (TODO.md).

## Acceptance Criteria
- [ ] Expanding blocks past the viewport shows the button without scrolling; collapsing until the end is visible hides it (browser test).
- [ ] The icon is centred within 0.5 px (element rectangles).
