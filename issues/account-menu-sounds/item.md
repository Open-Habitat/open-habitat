---
created: 2026-11-26
updated: 2026-11-26
type: improvement
reporter: jari
status: done
priority: normal
lane: unlaned
preparation: ready
closed: 2026-11-26
---

# Account menu: sounds-off status takes too much space

## Observed (Jari 26.11.2026, v0.1.8)

With sounds off, the account menu's Äänet row expands into the full list of reasons and fixes
("Äänet ovat hiljaa tällä laitteella · 2 syytä; ääni soi, kun kaikki on korjattu", "Pois
kaikilta laitteilta · Laita äänet päälle", "Tämä laite on mykistetty · ei vaikuta, ennen kuin
äänet ovat päällä · Poista mykistys"). In the account menu this takes far too much space.
The full list belongs to Settings › Äänet; the menu should be the tidy version.

## Done when

- The account menu shows the Äänet row with its Soi/Hiljaa control and at most one short
  status line (e.g. "Pois kaikilta laitteilta" or the main reason), plus a link to Settings ›
  Äänet for the details; no expanded list of reasons and buttons in the menu.
- Settings › Äänet keeps the full list.
- Phone sheet and Explain mode follow; touched specs and UI references updated.

## Resolution

### 2026-11-26T05:37:35Z · @issuectl

Compact row with main reason and Ääniasetukset link; see result.md.
