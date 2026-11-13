---
created: 2026-11-05
updated: 2026-11-05
type: feature
reporter: jari
status: done
priority: high
related: []
preparation: ready
provenance: chat
source_ref: chat:2026-11-05/taskfleet-in-every-install
lane: taskfleet-baseline
lane_seq: 1
closed: 2026-11-05
---

# Taskfleet installed on every Open Habitat installation as part of install and upgrade

## Description

Jari 5.11.2026: Taskfleetin pitää olla jokaisella asennetulla palvelimella
(Northwind, Contoso, Birch, testipalvelin ja tulevat) ja tulla automaattisesti
osana asennusta ja päivitystä, ei käsin henkilöä kohden.

Tausta: Villen agentti Northwindilla totesi 4.11. "Taskfleet ei ole asennettu
tähän Open Habitatiin" ja ajoi kuuden tunnin kurssityön kiertotienä Claude
Coden headless-tilassa omassa worktreessä. Sellainen ajo ei näy Workerit-
paneelissa, sillä ei ole Taskfleetin merge-käytäntöä, ja taustaprosessina
se pitää yhtä keskustelun paikkaa koko ajan. Habitatin ohje (agentin
system-prompt) jo neuvoo käyttämään Taskfleetiä.

Nykyinen suunnitelma pitää Taskfleetin valinnaisessa koodausprofiilissa
(`deliver-install-runtime-profile`, ADR 0029). Tämä muuttaa sen: Taskfleet
(ja sen tarvitsema matched workmux/tmux sekä Taskfleetin omat skillit)
kuuluu jokaisen asennuksen perusajoympäristöön, lukittuna julkaisuun ja
tarkistettuna kuten muu runtime, ja sen pitää toimia henkilön omana Unix-
käyttäjänä ilman ylläpitäjän toimia. Selvitä riippuvuudet (Pi-profiili,
supervisor, skillien asennuspaikka käyttäjälle) ja toimita ne
julkaisuputken kautta. Päivitys tuo sen olemassa oleviin asennuksiin.

## Acceptance Criteria

- [x] uusi asennus ja päivitys tuovat Taskfleetin kaikille henkilöille; `taskfleet run create` toimii Habitatin keskustelusta ja ajo näkyy Workerit-paneelissa (toimitettu ja kokeiltu kertakäyttöisesti; elävä tarkistus seuraavan ajoympäristöjulkaisun jälkeen, KOKEILTAVAA)
- [x] runtime-lukko ja host check kattavat Taskfleetin; kokeiltu kertakäyttöisellä natiivilla worker-ajolla
- [x] deliver-install-runtime-profile ja ADR 0029 päivitetty vastaamaan päätöstä
