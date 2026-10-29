---
created: 2026-10-29
updated: 2026-10-29
type: bug
reporter: jari
status: fixed
priority: normal
lane: ui-polish
lane_seq: 16
preparation: ready
closed: 2026-10-29
---

# Näytä työ caret turns the wrong way; hover gap differs above own messages

_Source: chat_

## Description

Jari 29.10.: the caret next to *Näytä työ* turns when the work section opens and then points in an odd direction. The work list sits above or below the summary row depending on whether the turn is finished, so a rotating caret reads wrong. Jari's proposal: when open, the caret becomes straight (e.g. a vertical/neutral mark) instead of turning, so it does not claim a direction.

Also: the summary row's hover highlight has a different gap depending on whether the message below is the agent's or the person's own, and it looks sloppy; the person's own message has different spacing. Related: `work-row-hover-misaligned` (right edge of the same hover).

## Acceptance Criteria

- [x] Open state uses a non-directional caret (Jari's proposal), consistent before and after the turn finishes.
- [x] The summary row's hover has the same spacing above an agent reply and above the person's own message, aligned with the content edges.
- [x] Before/after screenshots at DSF 2; browser spec touching the work row.
