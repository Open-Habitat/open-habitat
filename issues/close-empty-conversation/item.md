---
created: 2026-10-13
updated: 2026-10-13
type: improvement
status: open
priority: normal
lane: web
lane_seq: 21
collision: [web/]
---

# Empty conversation: Close instead of Archive

Jari, 2026-10-13: an empty conversation has nothing to keep, so instead of
Archive its top bar offers Close, which removes the conversation from the
list at once without confirmation (`design-system/design.md`, Keskustelu).
Archiving an empty conversation was also refused on the test server ("Arkiston
tila epävarma … kirjoittaja on aktiivinen"), which Close replaces for that case.

## Agreed behaviour

- A conversation without messages shows Close (icon, with its name as
  tooltip and accessible label) where Archive is for others.
- Close removes it from the sidebar immediately; if the host already started
  a Pi process for it, Close stops that process; if nothing native exists
  yet, nothing is left behind. A failure restores the row with an honest
  error.
- Once the first message is sent, the button becomes Archive.

## Done when

- Tests cover empty → Close → gone (with and without a started Pi), failure
  rollback, and the switch to Archive after the first message; lab evidence
  here, notes in `result.md`.
