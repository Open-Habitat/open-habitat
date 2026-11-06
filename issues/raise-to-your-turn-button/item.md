---
created: 2026-11-06
updated: 2026-11-06
type: feature
reporter: jari
status: done
priority: normal
preparation: ready
provenance: chat
source_ref: chat:2026-11-06/raise-to-your-turn-button
lane: raise-button
lane_seq: 1
closed: 2026-11-06
---

# Raise a conversation to Your turn: composer-row middle slot and rail row (experimental)

## Description

Jari 6.11.2026: toteutus prototyypistä `proto-raise-quiet-to-your-turn`
(kierrokset 1–3, result.md; viimeisin
`design-system/prototypes/rounds/2026-11-06-nosta-kentan-luona/`). Nosto
kirjoituskentän rivin keskipaikalla (C), joka on vapaa, kun agentti ei
työskentele; nostettuna oranssi *Sinun vuorossasi ✕*. Lisäksi sivupalkin
rivillä. Nostomerkki kuuluu henkilön omalle daemonille ja näkyy kaikilla
laitteilla (kierroksen 1 host-tiedot). Kokeellinen ominaisuus (Jari).
Liittyy `proto-quiet-transition-triggers`-linjaan (Ei nyt); pidä
mekanismi yhteisenä, jos se valmistuu ensin.

## Decision (Jari 2026-11-06): Ei nyt samaan painikkeeseen

`proto-quiet-transition-triggers` kierros 2, suunta A: kentän keskipaikalla
sama painike on *Nosta* tai *Ei nyt*. Sinun vuorosi -ryhmästä keskustelu
poistuu vasta vastaamalla tai *Ei nyt* -painalluksella (kierros 1, A
Vastaus), ei pelkällä avaamisella. Toteuta nosto ja Ei nyt yhtenä
mekanismina daemonin merkkinä (näkyy kaikilla laitteilla).

## Acceptance Criteria

- [x] nosto ja sen poisto toimivat kentän riviltä ja sivupalkin riviltä kokeellisen ominaisuuden takana; tila säilyy laitteiden välillä; testit
