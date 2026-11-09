---
created: 2026-11-09
updated: 2026-11-09
type: bug
reporter: jari
status: fixed
priority: high
lane: unlaned
preparation: ready
closed: 2026-11-09
---

# Next-waiting strip sits directly above the field, queued steer above it

## Description

Jari 9.11.2026 corrected `queued-steer-above-next-waiting`, which recorded
his request the wrong way round: the green/turquoise *Sillä aikaa · Avaa
seuraava* strip belongs lowest, directly above the message field, and the
queued steer message ("Odottaa agenttia") sits above the strip. Order from the
bottom up (Jari 9.11., refined): field, next-waiting strip, the Workers and
other chips row, queued messages, then the rest. From the top: notices and
other strips, queued messages, chips row, next-waiting strip, field. Jari's exact request; no prototype.

## Acceptance Criteria

- [x] With a queued steer and a waiting conversation: queued box, chips row, the strip, then the field; 1440 and 390; the 9 px rhythm and edge alignment kept.
- [x] The order spec updated; touched specs green.
