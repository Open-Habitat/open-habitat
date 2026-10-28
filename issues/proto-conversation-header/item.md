---
created: 2026-10-28
updated: 2026-10-28
type: task
reporter: jari
status: open
priority: normal
lane: proto-conversation-header
preparation: ready
provenance: chat
source_ref: chat:2026-10-28/proto-conversation-header
---

# Prototype: the conversation header on desktop (one row, title readable, not heavy)

Jari 2026-10-28 (testikone, pilot.455): keskustelun yläpalkki on nyt kahdessa rivissä ja on musta ja ruma (kuvakaappaus liitteenä). Kahden rivin otsake tuli desktop-header-title-squeezed-korjauksesta (container query: alle 80rem kaksi riviä, otsikko ja toiminnot ylhäällä, työtila, tila, Git, konteksti ja malli alla). Alkuperäinen ongelma oli, että yksirivinen otsake puristi otsikon olemattomiin 800–1400 px leveydellä sivupalkki auki. Prototyyppikierros (design-system/prototypes -menetelmä: 2–3 suuntaa yhdellä akselilla, tuotantokonteksti, työpöytä leveyksillä 1024, 1280, 1600 ja 1920 sivupalkki auki ja kiinni, myös editori auki, vaalea ja tumma, synteettinen data, pitkä otsikko, pitkä haara ja mallinimi, yksi offline-tiedosto): miten otsikko pysyy luettavana ja otsake kevyenä yhdellä rivillä, mitkä sirut tiivistyvät, piiloutuvat tai siirtyvät valikkoon ja mikä on niiden järjestys. Nykyinen kahden rivin versio ja aiempi puristuva versio mukaan vertailuksi. Jari valitsee; toteutus on myöhempi issue.
