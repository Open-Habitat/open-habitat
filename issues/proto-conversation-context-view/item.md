---
created: 2026-11-06
updated: 2026-11-06
type: task
reporter: jari
status: open
priority: normal
related: ['@proto-browse-what-agent-sees-m365']
preparation: ready
provenance: chat
source_ref: chat:2026-11-06/proto-conversation-context-view
lane: context-view-proto
lane_seq: 1
---

# Prototype: conversation context analysis view (from the read/changed log)

## Description

Jari 6.11.2026, prototyypistä `proto-browse-what-agent-sees-m365`
(kierros 1, suunta C Paneeli): keskustelun tilaloki ("mitä agentti luki
ja muutti tässä keskustelussa") on erityisen kiinnostava. Laajennetaan se
nykyisen kontekstin analyysinäkymäksi: mitä keskustelun kontekstissa on
nyt (luetut tiedostot ja integraatioiden kohteet, työkalukutsut, muutetut
tiedostot, kontekstin koko ja mihin se kuluu, tiivistykset), ja miten
henkilö näkee ja ohjaa sitä. Lähtökohta: kierroksen 1 C
(`design-system/prototypes/rounds/2026-11-06-m365-selaus/`) ja nykyinen
kontekstinäkymä tuotannossa (`context-detail-page` historiassa;
`web/src/components/` Context*). Tieto tulee Pi:n natiivihistoriasta; ei
uutta tietovarastoa (root AGENTS.md). Prototyyppikierros
AGENTS-WORKFLOW.md:n mukaan.

## Decision (Jari 2026-11-06, kierros 1)

**B Koko** on ok. Prototyypissä on kuitenkin ominaisuuksia, joita ei
oikeasti ole tarjolla: tiivistyksen ja muun ohjauksen pitää olla todellisia,
toteutettavissa olevia ominaisuuksia. Lisäksi pitää voida suodattaa näkyviin
vain tiedostot. Kierros 2: ensin tutkimus siitä, mitä toimintoja Pi ja host
oikeasti tarjoavat (tai voi toteuttaa ilman uutta mekanismia), sitten
prototyyppi vain niillä, ja sitä riffataan.

## Acceptance Criteria

- [x] kierros 1: tämänhetkinen tila ja kolme suuntaa, näkymätarjous ja kysymykset Jarille
