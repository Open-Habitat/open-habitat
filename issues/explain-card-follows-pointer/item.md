---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-explain-follow
lane: explain-follow
lane_seq: 1
preparation: ready
closed: 2026-11-22
---

# Prototype: Explain mode card follows the pointer; only F pins it and opens the report

## Description

Jari (22.11.2026, test server): in Explain mode the explanation card is in the
way while browsing. Prototype an alternative: the card keeps following the
pointer the whole time; moving the pointer onto the card does not make it stay
put. Only pressing F pins it, and F also opens the report text field. Clicking
does not open the report; F is the only way in.

Next action: a prototype round of this behaviour; Jari picks; then implement.

## Decisions

### 2026-11-22T15:14:10Z · @jari

Jari 22.11.2026: direction A Vieressä (card beside the pointer, flipping at edges). Esc may drop typed text without asking. The F reminder on every card: riff it in a round 2 (explain-f-reminder). Not answered, so the round's default stands: A trails with easing; rigid under reduced motion. Implementation: explain-card-follows-impl.
