---
created: 2026-11-06
updated: 2026-11-06
type: bug
reporter: jari
status: fixed
priority: high
related: ['@sharepoint-site-id-comma-escaped']
preparation: ready
provenance: chat
source_ref: chat:2026-11-06/sharepoint-recover
lane: sharepoint-fix
lane_seq: 2
blocked_by: ['@sharepoint-site-id-comma-escaped']
closed: 2026-11-06
---

# Recover SharePoint sites skipped by the escaping bug without asking the person

## Description

Jari 6.11.2026: kun `sharepoint-site-id-comma-escaped` on korjattu, Ainon
(Contoso) SharePoint pitää saada kuntoon ilman, että häntä vaivataan.
Nyt daemon ohitti 404:llä vastanneet sivustot yhdistämisessä
(`skippedSites`/`unavailableSites`, `microsoft_files_linux.go`), eikä
kansiovalinnassa ollut SharePointia; toisen agentin arvio oli, että Aino
tekisi valinnan uudelleen.

Tee: kun daemon on päivitetty, aiemmin ohitetut sivustot haetaan
uudelleen itsestään (esim. seuraavalla synkronoinnilla, daemonin
käynnistyessä tai yhdistämisen tilatarkistuksessa), ja jos henkilön
valinta kattaa koko tilin tai valinta oli tehty ilman SharePointia vain
siksi, ettei sitä ollut tarjolla, kirjastot tulevat näkyviin ilman uutta
valintaa. Älä lisää henkilön tietämättä synkronointiin mitään, mitä hän
ei olisi valinnut: jos kansiovalinta on rajattu, näytä SharePoint
valittavana ja kerro siitä henkilölle olemassa olevalla tavalla.
Selvitä ensin, miten valinta tallennetaan, ja kirjaa ratkaisu
"Decisions for later review" -kohtaan.

## Acceptance Criteria

- [x] päivityksen jälkeen aiemmin 404:llä ohitettu sivusto löytyy ilman henkilön toimia; testi synteettistä Graphia vasten
- [x] henkilön rajattua valintaa ei laajenneta hänen tietämättään
