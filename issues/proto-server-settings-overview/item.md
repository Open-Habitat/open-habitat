---
created: 2026-11-06
updated: 2026-11-06
type: task
reporter: jari
status: done
priority: normal
preparation: pending
provenance: chat
source_ref: chat:2026-11-06/proto-server-settings-overview
lane: server-settings-proto
lane_seq: 1
closed: 2026-11-06
---

# Prototype: server settings with every section visible at once

## Description

Jari 6.11.2026, Contosoin käyttöönotossa Ainon kanssa: kun ylläpitäjä
avaa asetuksista palvelimen asetukset, vasen palkki on yhä asetusten
alussa, ja asetuksia on niin paljon, että alempana olevia (esimerkiksi
integraatioita) ei näe. Palvelimen asetusten pitäisi olla kaikki
näkyvillä oikealla puolella. Prototypoi, miltä tämä näyttää.

Nykyinen rakenne: Asetukset-näkymän vasen navigaatio (henkilön omat
osiot ja ylläpitäjän *Palvelin*-osiot, mm. pääsy `ServerAccess.tsx` ja
integraatiot `ServerIntegrations.tsx`) ja sisältö oikealla. Suunnille:
palvelimen asetukset omana kokonaisuutenaan, jonka kaikki osiot näkyvät
kerralla oikealla (yleiskuva tai osioiden lista); henkilön ja palvelimen
asetusten erottaminen; mitä vasen palkki näyttää palvelimen puolella;
miten ylläpitäjä löytää esim. integraatiot yhdellä silmäyksellä myös
puhelimessa. Prototyyppikierros AGENTS-WORKFLOW.md:n mukaan.

## Decision (Jari 2026-11-06)

Suunta **B Oma alue**: mennään sillä. Toteutus omana issuenaan
(`server-settings-own-area`). Jos toteutuksessa tulee kysyttävää, se
riffataan prototyyppinä.

## Acceptance Criteria

- [ ] kierros 1: tämänhetkinen tila ja kolme suuntaa, näkymätarjous ja kysymykset Jarille
