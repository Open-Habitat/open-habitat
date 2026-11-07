---
created: 2026-11-07
updated: 2026-11-07
type: feature
reporter: jari
status: open
priority: normal
preparation: pending
lane: view-versions
lane_seq: 1
---

# A new version of the same report updates its view instead of making a new card

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, 7.11.2026):

Näkymän toinen versio tekee uuden kortin (Jari 7.11., pilot.612, testi-repo): agentti nimesi kortit hyvin (*Kolme suosikkikirjastoa – testiraportti*, *… – tumma versio*), mutta toinen kierros tuli kokonaan uutena korttina ja eri näkymänä (`reports/kirjastot-tumma.html`). Jari huomautti tästä; selvitä, pitäisikö saman raportin uuden version päivittää sama näkymä ja osoite (ja kortti näyttää viimeisimmän), vai onko kierros aina oma korttinsa (`agent-view-offer-title`, `view-address-entry-route`).

## Acceptance Criteria

- [ ] havainto korjattu; testi rajapinnassa
