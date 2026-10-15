---
created: 2026-10-15
updated: 2026-10-15
type: feature
reporter: jari
status: in-progress
priority: normal
lane: web
lane_seq: 37
collision: [web/]
---

# Archive a conversation from its home-page card

Jari, pilot.65 (2026-10-15): on the home page (`home-workspace-sections`), conversations appear as recap cards. Jari often wants to archive a conversation right there once it is finished. Add an archive action to each card. Behave like the conversation's own archive action (`archive-without-confirmation`): no confirmation, and blocked with its reason while Pi is working. After archiving, the card leaves the section. A failure is shown on the card.

## Acceptance Criteria
- [x] Each recap card has an archive action. It is disabled with its reason while Pi works (browser test).
- [x] Archiving removes the card; a failure leaves it with an error.
