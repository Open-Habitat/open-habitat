---
created: 2026-11-06
updated: 2026-11-06
type: improvement
reporter: jari
status: open
priority: normal
preparation: ready
provenance: chat
source_ref: chat:2026-11-06/next-waiting-hides-while-typing
lane: next-waiting
lane_seq: 1
---

# Next waiting conversation row hides while the person is typing

## Description

Jari 6.11.2026: kun hän on aloittanut kirjoittaa keskustelun
kirjoituskenttään, *Seuraava odottava keskustelu* -rivi (kokeellinen
ominaisuus; `web/src/app/NextWaitingDock.tsx`,
`web/src/components/NextWaitingRow.tsx`, *Montako odottaa · Avaa
seuraava*) pitäisi kadota: kirjoittaessaan hän tuskin haluaa siirtyä
seuraavaan. Jos hän poistaa tekstin ja agentti on yhä käynnissä, rivi voi
tulla takaisin.

Korjaus kokeellisen ominaisuuden käytökseen (Jari kuvasi toivotun
toiminnan), ei prototyyppiä: rivi piiloon, kun kentässä on luonnosta,
takaisin kun kenttä tyhjenee; pikanäppäin ei siirrä pois luonnoksen
päältä. Tarkista, miten luonnoksen tila on jo saatavilla (composer draft).

## Acceptance Criteria

- [ ] rivi ei näy, kun kirjoituskentässä on tekstiä, ja palaa, kun kenttä tyhjenee; testi selaimessa tai komponenttitasolla
