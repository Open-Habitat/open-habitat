---
created: 2026-11-07
updated: 2026-11-07
type: feature
reporter: jari
status: done
priority: normal
preparation: ready
lane: agent-resources
lane_seq: 1
closed: 2026-11-07
---

# Agent resources view: browse what the agent can use, by kind (experimental)

## Description

Jari 7.11.2026: toteutus prototyypistä `proto-agent-resources-view`:
kierroksen 1 suunta **B Lajeittain** (sivupalkin *Agentin käytössä* ja
lajilista lähteineen, `design-system/prototypes/rounds/2026-11-06-agentin-resurssit/`)
ja kierroksen 3 suunta **C Vain rajat** lajin sisällölle
(`design-system/prototypes/rounds/2026-11-06-resurssien-sisalto/`): lähde
kertoo, mikä on mukana ja mikä ei ja mitä agentti saa tehdä, ja vie
integraation asetuksiin ja yhdistämiseen. Poikkeus Jarin vastauksesta:
**Tiedostot**-lajissa henkilö voi selata tiedostoja, joihin agentilla on pääsy
(peilikansio `~/cloud/...` henkilön omana käyttäjänä), joten myös agentin luoma
tiedosto näkyy siellä. Ei uutta lukureittiä palveluihin (ei Graphia sivua
avattaessa), ei uutta tietovarastoa; valtuus henkilön omalla daemonilla.
Kokeellinen ominaisuus.

## Acceptance Criteria

- [x] näkymä kokeellisena ominaisuutena: lajit ja lähteet B:n mukaan, sisältö C:n mukaan, tiedostojen selaus peilikansiosta; työpöytä ja puhelin; testit
