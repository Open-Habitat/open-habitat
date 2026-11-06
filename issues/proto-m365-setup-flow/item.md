---
created: 2026-11-06
updated: 2026-11-06
type: task
reporter: jari
status: open
priority: normal
related: ['@setup-console-path-too-small', '@ms-permissions-copy-one-by-one']
preparation: ready
provenance: chat
source_ref: chat:2026-11-06/proto-m365-setup-flow
lane: m365-setup-proto
lane_seq: 1
---

# Prototype: the Microsoft 365 integration setup flow

## Description

Jari 6.11.2026: Microsoft 365 -integraation ohjattu asetus (Asetukset ›
Integraatiot, ylläpitäjän *Microsoft 365: aseta tunnukset*, neljä vaihetta,
`microsoftSteps` in `web/src/components/ServerIntegrations.tsx`) on oma
kokonaisuutensa, joka prototypoidaan.

Jarin havainnot 6.11. (kuvakaappaus vaiheesta 2/4 *Julkinen asiakas*):

- Konsolipolut (*Authentication › Settings* jne.) ovat tosi pienellä ja
  himmeinä, vaikka ne ovat vaiheen tärkein ohje; nuoli näyttää
  avattavalta (`setup-console-path-too-small`).
- *Oikeudet*-vaiheen koko oikeuslistan voi kopioida yhdellä napilla, mutta
  Entran *Delegated permissions* -hakukenttä hakee yhden oikeuden
  kerrallaan, joten lista syötteenä ei toimi
  (`ms-permissions-copy-one-by-one`).

Prototypoi koko kulku rekisteröinnistä tunnusten syöttöön ja
hyväksyntään: mitä Entrassa tehdään missäkin järjestyksessä, miten polku
ja suora linkki näkyvät, miten arvot ja oikeudet kopioidaan niin että ne
toimivat Entran kentissä, ja miten ylläpitäjä tietää olevansa valmis.
Tarkista Entran nykyinen käyttöliittymä Microsoftin dokumentaatiosta.
Prototyyppikierros AGENTS-WORKFLOW.md:n mukaan.

## Decision (Jari 2026-11-06)

Kierros 1: suunta **A Lista**. Tällä mennään. Havainnot oikeasta
käyttöönotosta (Jari ja Aino):

- Suora linkki ei avannut oikeaa sivua: se avasi *App registrations* ›
  *All applications* -listan, ei omaa sovellusta, joten käyttäjä joutui
  joka tapauksessa navigoimaan itse. Ohjeen pitää olettaa se.
- Kaikki vaiheet rekisteröinnin jälkeen tapahtuvat saman sovelluksen
  näkymässä (vasen valikko: Overview, Authentication (Preview) ja sen
  välilehdet Redirect URI configuration / Supported accounts / Settings,
  API permissions). Myöhemmissä vaiheissa ei siis mielellään linkkejä,
  vaan sovelluksen vasemman valikon kohta.
- Jari antoi Entran kuvakaappaukset (Register an application, App
  registrations, sovelluksen Overview, Authentication (Preview), API
  permissions); niistä saa oikeita paloja ohjeeseen. Niissä on tenant-
  ja client-tunnuksia: ei committoida sellaisenaan, tunnukset peitetään.

Kierros 2: riffataan A:ta näiden pohjalta.

## Decision (Jari 2026-11-06, kierros 2)

**A1 Valikkopala** on selkein. Kierros 3 riffaa A1:tä: Entra-palat
piirrosten sijaan oikeina leikkeinä Jarin kuvakaappauksista (tunnukset ja
organisaation nimi peitettyinä). Oikeuksien edessä olevat valintaruudut
pois; niitä ei tarvita.

## Decision (Jari 2026-11-06, kierros 3)

**A1b Kaistale** sopii tilaan parhaiten. Kierros 4 riffaa sitä: vaiheen
alakohdat (rivit, joita nyt joutuu vierittämään ylös ja alas) välilehtinä
tai vastaavana, ettei sivua tarvitse kelata.

## Decision (Jari 2026-11-06, kierros 4)

Välilehdet ja *Seuraava*-painike pitää yhdistää: vain yksi paikka, jossa
klikataan "seuraava". Kierros 5 riffaa tätä.

## Acceptance Criteria

- [x] kierros 1: tämänhetkinen kulku ja kolme suuntaa, näkymätarjous ja kysymykset Jarille
- [x] kierros 2: kolme riffiä A:sta Jarin havainnoilla ja Entran kuvilla, suositus ja kysymykset Jarille
- [x] Jari valitsee kierroksen 2 riffin (A1 Valikkopala)
- [x] kierros 3: kolme riffiä A1:stä oikeilla, peitetyillä Entra-leikkeillä ja ilman oikeuksien valintaruutuja, suositus ja kysymykset Jarille
- [x] Jari valitsee kierroksen 3 riffin (A1b Kaistale)
- [x] kierros 4: kolme riffiä A1b:stä, joissa vaiheen alakohdat ovat välilehtinä, askelina tai nuolin ja vaihe mahtuu 1440×900:aan ja 390-puhelimeen ilman vieritystä; suositus ja kysymykset Jarille
- [ ] Jari valitsee kierroksen 4 riffin
