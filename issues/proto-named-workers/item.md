---
created: 2026-11-06
updated: 2026-11-06
type: task
reporter: jari
status: open
priority: normal
related: ['@design-named-workers']
preparation: pending
provenance: chat
source_ref: chat:2026-11-06/proto-named-workers
lane: named-workers-proto
lane_seq: 1
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

## Acceptance Criteria

- [x] kierros 1: tämänhetkinen tila ja kolme suuntaa, näkymätarjous ja kysymykset Jarille
