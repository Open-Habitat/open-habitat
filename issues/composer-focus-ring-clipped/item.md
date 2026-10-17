---
created: 2026-10-17
updated: 2026-10-17
type: bug
reporter: jari
status: fixed
priority: normal
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
closed: 2026-10-17
---

# Phone: composer focus ring is clipped under the element above

Jari, 2026-10-17 ~10.05 on the phone: in a conversation the text field's focus highlight line is clipped under some element above it (the composer's top edge is covered). Likely the new background strip (Merkit pills) or the queue row overlapping the field's focus ring; check overflow/z-index and the ring's offset. Phone and desktop, light and dark.

## Acceptance Criteria
- [ ] Focus ring fully visible on phone and desktop with and without the strip/queue (browser screenshot test).
