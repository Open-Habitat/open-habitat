---
created: 2026-11-07
updated: 2026-11-08
type: feature
reporter: jari
status: open
priority: normal
preparation: pending
lane: view-versions
lane_seq: 2
blocked_by: ['@proto-conversation-assets']
---

# A new version of the same report updates its view instead of making a new card

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, 7.11.2026):

Näkymän toinen versio tekee uuden kortin (Jari 7.11., pilot.612, testi-repo): agentti nimesi kortit hyvin (*Kolme suosikkikirjastoa – testiraportti*, *… – tumma versio*), mutta toinen kierros tuli kokonaan uutena korttina ja eri näkymänä (`reports/kirjastot-tumma.html`). Jari huomautti tästä; selvitä, pitäisikö saman raportin uuden version päivittää sama näkymä ja osoite (ja kortti näyttää viimeisimmän), vai onko kierros aina oma korttinsa (`agent-view-offer-title`, `view-address-entry-route`).

## Acceptance Criteria

- [ ] havainto korjattu; testi rajapinnassa

## Jari 2026-11-08

Saman kortin päivittäminen toimii hyvin vasta, kun keskustelun kaikki
näkymäkortit löytyvät helposti: nyt vanhat pitää etsiä kelaamalla pitkälle
ylös. Ensin prototyyppi listasta, jossa keskustelun agentin tekemät näkymät
ja tiedostot ovat näkyvissä (`proto-conversation-assets`); sen jälkeen
päätetään, päivittääkö uusi versio saman kortin.
