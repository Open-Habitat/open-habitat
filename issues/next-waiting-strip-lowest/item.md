---
created: 2026-11-09
updated: 2026-11-09
type: bug
reporter: jari
status: open
priority: high
lane: unlaned
preparation: ready
---

# Next-waiting strip sits directly above the field, queued steer above it

## Description

Jari 9.11.2026 corrected `queued-steer-above-next-waiting`, which recorded
his request the wrong way round: the green/turquoise *Sillä aikaa · Avaa
seuraava* strip belongs lowest, directly above the message field, and the
queued steer message ("Odottaa agenttia") sits above the strip. Order from top:
other current-conversation strips and notices, queued messages, next-waiting
strip, field. Jari's exact request; no prototype.

## Acceptance Criteria

- [ ] With a queued steer and a waiting conversation: queued box, then the strip, then the field; 1440 and 390; the 9 px rhythm and edge alignment kept.
- [ ] The order spec updated; touched specs green.
