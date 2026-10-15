---
created: 2026-10-15
updated: 2026-10-15
type: improvement
reporter: jari
status: in-progress
priority: normal
lane: web
lane_seq: 34
collision: [web/]
---

# Drop the redundant failure notice from failed tool cards

Jari, pilot.65 (2026-10-15): a failed tool card shows the notice "Työkalu epäonnistui · Pi ilmoitti työkalun virheestä." although the card's corner already says "Epäonnistui". Remove that redundant notice. The failure output itself stays visible. The look of a failed bash card is queued for a prototype round (TODO.md); do not redesign it here.

## Acceptance Criteria
- [ ] No duplicate failure notice in failed tool cards. The status and the output remain (Vitest and a lab screenshot).
