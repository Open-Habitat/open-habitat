---
created: 2026-11-08
updated: 2026-11-09
type: improvement
reporter: jari
status: done
priority: normal
lane: explain-cards
preparation: ready
lane_seq: 2
closed: 2026-11-08
---

# Move the helpers panel's rule text into Explain mode

## Description

Jari 8.11.2026, test server: the Avustajat chip's panel shows a standing line
*Avustajat jäävät odottamaan kierroksen jälkeen. Viestit, kierrosten
yhdistäminen ja lopetus kulkevat pääagentin kautta.* It is not needed there;
it belongs in the explanations behind the ? button (Explain mode,
`web/src/components/explainParts.ts`, `web/src/text/explainMode.ts`) and the
agent UI reference. Remove it from the panel (both languages) and add it to
the helpers chip's/panel's explanation card. Jari asked for this exact change,
so no prototype.

Jari 8.11.: the Avustajat chip has no Explain-mode card at all; add one
(what the chip, its marks and the panel's rows mean) together with the moved
line. While there, check this round's other new controls for a missing card:
the assets chip and its list rows, the offer card's corner icons, the server
browser chip and strip, the helper archive rows.

## Acceptance Criteria

- [x] Avustajat chip and the other new controls listed above have Explain-mode cards, fi and en.
- [x] Panel without the line; Explain mode card for helpers carries it, fi and en.
- [x] Touched specs green.
