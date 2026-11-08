---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# Gaps between the strips, chips, attachment tray and field above the composer are uneven

## Description

Jari 8.11.2026, test server (screenshots `evidence/`): the vertical gaps in
the stack between the last message and the message field differ from one
another.

1. Between the turquoise *Sillä aikaa · 1 odottaa sinua · Avaa seuraava*
   strip and the *Odottaa agenttia* (queued steer) box the gap is too large.
2. Between an attachment thumbnail chip and the text field: a hairline.
3. Between the Workers/process chips row and the attachment tray: somewhat
   wider.
4. Between the chips row and the lowest message/status line above: yet
   another width.

All the gaps in that stack (status line, chips row, next-waiting strip,
warnings, queued box, attachment tray, field) should come from one spacing
token in the design system, so the stack reads as one evenly spaced column,
at 1440 and 390, in every combination of present/absent parts.

## Acceptance Criteria

- [ ] Every gap in the composer stack is the same token value (or a documented deliberate exception), in every combination of parts; 1440 and 390.
- [ ] A browser check measures the gaps; screenshots before/after.
