---
created: 2026-10-26
updated: 2026-10-27
type: task
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-10-26/research-integration-permission-scopes
lane: integration-scopes
lane_seq: 1
preparation: pending
closed: 2026-10-27
---

# Research: permission levels for integrations (read-only, drafts only, scoped folders)

## Description

Jari 2026-10-26, keskustelusta toisen kehittäjän kanssa (ulkopuolinen käyttäjä, joka arvioi Habitatia omaan ja asiakkaidensa käyttöön). Yritysympäristöt (erityisesti Microsoft 365) vaativat, ettei agentti saa kaikkea, mitä integraation tunnus sallii: esimerkiksi agentti saa tehdä sähköpostiluonnoksia mutta ei lähettää, tai lukea tiedostoja mutta ei kirjoittaa, tai Dropboxissa vain sovelluskansio. Nyt integraatioiden tunnukset ovat käyttäjän kotihakemistossa (0600) ja agentti voi käyttää niitä koko laajuudessaan. Jari: 'Selvitys tästä mikä on mahdollista.'

Selvitä palveluittain (Google, Microsoft Graph, IMAP/SMTP/CalDAV, Dropbox, GitHub, Gitea), mitä oikeustasoja OAuth-scopeilla tai palvelun omilla mekanismeilla voi valita yhdistämisvaiheessa, mitä ne käytännössä estävät, miten ne vaikuttavat nykyisiin työkaluihin ja synkronointiin, ja mitä jää suojaamatta (tunnuksen vuoto mallin tuottajalle tai prompt-injektion kautta). Vertaa lyhyesti erillisen tunnuksia pitävän välityskäyttäjän (proxy) malliin: se olisi oma credential broker, jota root AGENTS.md ei salli ilman arkkitehtuuripäätöstä, joten raportti esittää sen vain vaihtoehtona Jarin päätettäväksi. Tulos: raportti issuen hakemistoon ja suositus.

## Result

Raportti: [result.md](result.md). Seuraava askel on Jarin valinta suosituksesta (C heti, B vaiheittain, välittäjä D auki).

## Decisions

### 2026-10-27T05:22:29Z · @jari

Jari 2026-10-27: selvitys hyvä; jätetään auki, Jari käy sen läpi muiden kanssa ennen päätöstä.

### 2026-10-27T12:00:30Z · @jari

Jari 2026-10-27: edetään. Ensin käyttöliittymäprototyypit (proto-integration-permission-levels), toteutus niiden jälkeen.
