---
created: 2026-11-08
updated: 2026-11-08
type: improvement
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
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

## Acceptance Criteria

- [ ] Panel without the line; Explain mode card for helpers carries it, fi and en.
- [ ] Touched specs green.
