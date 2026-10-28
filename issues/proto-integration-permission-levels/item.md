---
created: 2026-10-27
updated: 2026-10-28
type: task
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-10-27/proto-integration-permission-levels
lane: integration-scopes
lane_seq: 2
preparation: pending
closed: 2026-10-28
---

# Prototype: choosing an integration's permission level when connecting

## Description

Jari 2026-10-27 hyväksyi etenemisen research-integration-permission-scopes-selvityksen pohjalta (issues/research-integration-permission-scopes/result.md), ensin käyttöliittymäprototyypit.

Prototyyppikierros (design-system/prototypes -menetelmä: 2–3 suuntaa yhdellä akselilla, tuotantokonteksti Asetukset › Tiedot agenteille, työpöytä ja puhelin, vaalea ja tumma, synteettinen data, käsin kirjoitettu yksi offline-tiedosto): miten henkilö valitsee yhdistäessään, mitä agentti saa tehdä tilillä, ja miten taso näkyy jälkikäteen. Mukaan selvityksen todelliset vaihtoehdot palveluittain: Microsoft 365 täysi / vain luku / luonnokset ilman lähetystä (ja valitut kansiot), Gmail vain luku / täysi (ei 'vain luonnokset' -tasoa, sanottava rehellisesti), Dropbox täysi / sovelluskansio / vain luku, IMAP/CalDAV. Näytä myös tilanne, jossa ylläpitäjä tai yritys on jo kaventanut oikeudet (kapeampi myöntö hyväksytään ja puuttuva oikeus näkyy), tason vaihtaminen myöhemmin (uusi kirjautuminen) ja se, mitä taso ei estä (tunnuksen voi lukea saman käyttäjän agentti). Kirjaa result.md:hen host-faktat suunnittain. Jari valitsee; toteutus on myöhempi issue.

## Decisions

### 2026-10-28T04:23:44Z · @jari

Jari 2026-10-28: suunta 1 Tilitaso (yksi palveluntarjoajan valvoma taso tiliä kohden, mukaan lukien vain luku). Toteutus kolmessa vaiheessa: integration-grant-capabilities (myönnön lukeminen ja kapeamman myönnön hyväksyminen), integration-account-level-microsoft-dropbox, integration-account-level-google.
