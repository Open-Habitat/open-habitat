---
created: 2026-10-28
updated: 2026-10-28
type: task
reporter: jari
status: done
priority: normal
lane: proto-conversation-header
preparation: pending
provenance: chat
source_ref: chat:2026-10-28/proto-conversation-header
closed: 2026-10-28
---

# Prototype: the conversation header on desktop (one row, title readable, not heavy)

Jari 2026-10-28 (testikone, pilot.455): keskustelun yläpalkki on nyt kahdessa rivissä ja on musta ja ruma (kuvakaappaus liitteenä). Kahden rivin otsake tuli desktop-header-title-squeezed-korjauksesta (container query: alle 80rem kaksi riviä, otsikko ja toiminnot ylhäällä, työtila, tila, Git, konteksti ja malli alla). Alkuperäinen ongelma oli, että yksirivinen otsake puristi otsikon olemattomiin 800–1400 px leveydellä sivupalkki auki. Prototyyppikierros (design-system/prototypes -menetelmä: 2–3 suuntaa yhdellä akselilla, tuotantokonteksti, työpöytä leveyksillä 1024, 1280, 1600 ja 1920 sivupalkki auki ja kiinni, myös editori auki, vaalea ja tumma, synteettinen data, pitkä otsikko, pitkä haara ja mallinimi, yksi offline-tiedosto): miten otsikko pysyy luettavana ja otsake kevyenä yhdellä rivillä, mitkä sirut tiivistyvät, piiloutuvat tai siirtyvät valikkoon ja mikä on niiden järjestys. Nykyinen kahden rivin versio ja aiempi puristuva versio mukaan vertailuksi. Jari valitsee; toteutus on myöhempi issue.

## Decisions

### 2026-10-28T11:02:46Z · @jari

Jari 2026-10-28: suunta 1 Lyhenee. Jari pitää myös kaikkien suuntien yhteisestä kevyemmästä ulkoasusta: lyhyemmät painikkeet ja ikonit, sirut ilman reunoja, Gitin nollat piilossa ja toiminnan tila pelkkänä pisteenä ilman 'Työskentelee'-pilleriä. Pisteelle tooltip (konduktorin ratkaisu Jarin kysymykseen): hover ja näppäimistöfokus näyttävät tilan tekstinä (esim. Työskentelee · Ajattelee, kesto), kosketuksella napautus; tila on aina myös pisteen saavutettavassa nimessä. Toteutus: conversation-header-shorten.

### 2026-10-28T11:09:18Z · @jari

Jari 2026-10-28, lisäpalaute Lyhenee-suuntaan, riffikierros 2 ennen toteutusta: mallisiru lyhyeksi, pelkkä 'Opus 5.5' tai jopa 'Opus'; ajattelutaso selviää sirun avatessa tai näkyy pienenä ikonina sirussa (molemmat vaihtoehdot riffiin). Git-sirussa ei näytetä haaran nimeä; nimi näkyy vasta avattaessa. Pohjana Lyhenee ja yhteinen kevyt ulkoasu sekä tilapisteen tooltip.

### 2026-10-28T17:37:22Z · @jari

Jari 2026-10-28: kierros 2, suunta 1 Taso avattaessa: mallisirussa pelkkä malli, ajattelutaso näkyy sirua avattaessa, vihjeessä ja saavutettavassa nimessä. Nimimuoto suosituksen mukaan 'Opus 5.5'. Toteutus: conversation-header-shorten, result.md:n Muutokset toteutukseen -kohdan mukaan.

## Reopen Notes — 2026-10-28

_Add rationale for reopening here._
