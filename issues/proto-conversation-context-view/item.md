---
created: 2026-11-06
updated: 2026-11-07
type: task
reporter: jari
status: done
priority: normal
related: ['@proto-browse-what-agent-sees-m365']
preparation: pending
provenance: chat
source_ref: chat:2026-11-06/proto-conversation-context-view
lane: context-view-proto
lane_seq: 1
closed: 2026-11-07
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

## Decision (Jari 2026-11-06, kierros 2)

Kokonaisuus on sekava. Epäselvää, mitä mistäkin painikkeesta oikeasti
tapahtuu, mistä "ennusteet" tulevat, ja mitä "Ohje riviltä" tarkoittaa
(mitä mainitaan, mitä ohitetaan). Kierros 3 yksinkertaistaa: jokainen
näkyvä tieto ja painike sanoo tavallisin sanoin, mitä se on ja mitä
painallus tekee, ja sen lähde on nimetty result.md:ssä. Jätä pois
kaikki, mitä ei voi selittää yhdellä lauseella. Lähtökohta B Koko ja
kierroksen 2 tutkimus todellisista toiminnoista.

## Acceptance Criteria

- [x] kierros 1: tämänhetkinen tila ja kolme suuntaa, näkymätarjous ja kysymykset Jarille
- [x] kierros 2: tutkimus todellisista toiminnoista ja kolme B-riffiä tiedostosuodattimella, näkymätarjous ja kysymykset Jarille
- [x] kierros 3: B Koko yksinkertaistettuna, jokaisen tiedon ja painikkeen lähde nimetty; kolme suuntaa, näkymätarjous ja kysymykset Jarille

## Decision (Jari 2026-11-07, kierros 3)

**2 Lista ja tiivistys** on hyvä, mutta ilman omaa Avaa-saraketta: tiedoston
nimen napsautus avaa sen, jolloin näkymä on lähellä suuntaa 3 *Pelkkä lista*.
Jari kysyi, mistä tieto siitä, mikä tiivistyy ja mikä ei, tulee: vastattu
keskustelussa (Pi:n oma `prepareCompaction` henkilön asetuksilla; Pi tiivistää
aina vanhimmat ja jättää uusimmat noin `keepRecentTokens`, oletus 20 000;
arvio muuttuu, jos keskustelu jatkuu ennen tiivistystä). Toteutus:
`conversation-context-view`.
