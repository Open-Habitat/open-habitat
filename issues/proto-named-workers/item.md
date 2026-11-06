---
created: 2026-11-06
updated: 2026-11-06
type: task
reporter: jari
status: done
priority: normal
related: ['@design-named-workers']
preparation: pending
provenance: chat
source_ref: chat:2026-11-06/proto-named-workers
lane: named-workers-proto
lane_seq: 1
closed: 2026-11-06
---

# Prototype: named support workers in Habitat

## Description

Jari 6.11.2026: nimetyt tukiagentit (`design-named-workers`) pitää myös
prototypoida. Worker tekee työn, sen viestit tulevat pääagentin
keskusteluun, se jää hiljaisena odottamaan, ja pääagentti (tai henkilö)
voi lähettää sille uuden viestin, esimerkiksi prototyypparille
riffauspyynnön.

Prototypoi Habitatin puoli: miltä nimetty worker näyttää Workerit-
paneelissa ja sivupalkissa (tekee työtä / odottaa / lopetettu), miten sen
viesti näkyy pääkeskustelussa, miten henkilö näkee, mitä pääagentti sille
lähetti, voiko henkilö kirjoittaa workerille itse, ja miten worker
lopetetaan ja sen työ yhdistetään. Prototyyppikierros AGENTS-WORKFLOW.md:n
mukaan.

## Decision (Jari 2026-11-06, mekanismista)

Henkilö ei kirjoita nimetylle workerille suoraan; viestit kulkevat aina
pääagentin kautta (`design-named-workers`). Kysymys 3 on siis ratkaistu:
*Kirjoita*-toimintoa ei tarvita. Suunnasta (A/B/C) ja raportin
esitystavasta Jari ei ole vielä päättänyt.

## Decision (Jari 2026-11-06, kierros 1)

Kierros 1 lähti väärään suuntaan. Nimetyt workerit kuuluvat nykyiseen
workerien palloon (Workerit-merkki kirjoituskentän luona) tai toiseksi
palloksi, siruksi, sen viereen; ei paneelia kentän yllä, ei omia
keskusteluja sivupalkissa, ei vastauksia pääkeskustelussa. Henkilö ei
kirjoita workerille itse (viestit pääagentin kautta). Kierros 2 riffaa
pallon/sirun ratkaisuja.

## Decision (Jari 2026-11-06, kierros 2)

**3 Avustajat** -siru. Sille prototypoidaan oma ikoni (kierros 3).

## Decision (Jari 2026-11-06, kierros 3)

Ikoni **1 Botit**. Esitys on nyt päätetty: yksi Avustajat-siru
Workerit-pallon vieressä Botit-ikonilla. Toteutus `named-workers-in-habitat`.

## Acceptance Criteria

- [x] kierros 1: tämänhetkinen tila ja kolme suuntaa, näkymätarjous ja kysymykset Jarille
- [x] kierros 2: kolme riffiä Workerit-pallon yhteydessä (pallossa, siru per avustaja, Avustajat-siru), näkymätarjous ja kysymykset Jarille
- [x] kierros 3: Avustajat-sirun oma ikoni kolmena riffinä (Botit, Silmukka, Nimilappu) kaikissa tiloissa, näkymätarjous ja kysymykset Jarille
