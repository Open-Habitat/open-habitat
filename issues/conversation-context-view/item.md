---
created: 2026-11-07
updated: 2026-11-07
type: feature
reporter: jari
status: open
priority: normal
preparation: ready
lane: context-view
lane_seq: 1
---

# Conversation context view: list and compaction, open a file by its name (experimental)

## Description

Jari 7.11.2026: toteutus prototyypistä `proto-conversation-context-view`
kierros 3 (`design-system/prototypes/rounds/2026-11-06-kontekstinakyma-3/`),
suunta **2 Lista ja tiivistys** ilman omaa Avaa-saraketta: tiedoston nimen
napsautus avaa sen (näkymä on lähellä suuntaa 3 *Pelkkä lista*).
Pelkkien tiedostojen suodatin. Jokainen tieto ja painike sanoo tavallisin
sanoin, mitä se on ja mitä painallus tekee; lähteet kierroksen 3
`result.md`:n taulukossa. Tiivistyksen ennuste tulee Pi:n omasta
`prepareCompaction`ista henkilön asetuksilla (ei omaa arviota), ja
tiivistys on Pi:n RPC `compact` ohjeella. Tieto Pi:n natiivihistoriasta, ei
uutta tietovarastoa. Kokeellinen ominaisuus.

## Acceptance Criteria

- [ ] näkymä kokeellisena ominaisuutena prototyypin suunnan 2 mukaan, nimen napsautus avaa tiedoston, tiivistys toimii oikealla Pi:llä; työpöytä ja puhelin; testit
