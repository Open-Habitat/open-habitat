---
title: Tietoturvamalli
description: Mikä erottaa ihmiset toisistaan Open Habitat -palvelimella ja mikä ei.
---

Open Habitatin tietoturvaraja on tavallinen Unix-käyttäjä. Jokainen
kirjautuva saa oman Linux-tunnuksen, kotihakemiston, kirjautumistiedot ja
agenttidaemonin. Kaikki, mikä antaisi yhdelle ihmiselle pääsyn toisen kotiin,
tunnuksiin tai agentteihin, on tuotevika.

## Kolme osaa, erilliset valtuudet

| Osa | Mitä se saa tehdä |
| --- | --- |
| **gateway** | Tunnistaa selaimen GitHubilla ja liittää ihmisen hänen Unix-käyttäjäänsä. Selaimessa kukaan ei valitse Unix-tunnusta. |
| **daemon** | Ajetaan ihmisen omalla tunnuksella, ja se ajaa hänen agenttinsa ja työkalunsa. Se ei luota selaimen tai gatewayn identiteettiväitteisiin: ketä se palvelee, ratkaisee se, minä Unix-käyttäjänä se toimii. |
| **root broker** | Pieni, ja luo vain tilin ihmisen ensimmäisellä hyväksytyllä kirjautumisella. |

Kun osat pidetään erillään, yhden vika ei ulotu muiden valtuuksiin.

Käyttäjän hallitsema sisältö, kuten editori, agentin julkaisemat sivut ja
jaetut linkit, tarjoillaan omalta hostiltaan erillään sovelluksesta.
Keskustelun HTML tai koodi ei suoriudu sovelluksen sivulla.

## Mitä se ei suojaa

- **Omaa agenttiasi.** Agentti toimii omistajanaan, omistajan tiedostoin ja
  tunnuksin. Unix-tunnukset erottavat ihmiset toisistaan; ne eivät rajoita,
  mitä oma agenttisi voi tehdä omassa kodissasi.
- **Palvelimen ylläpitäjää.** Root on root: palvelimen ylläpitäjä voi lukea
  jokaisen kodin, kuten millä tahansa Linux-koneella.
- **Jaettua levyä.** Ilman käyttäjäkohtaisia rajoja kaikki kodit jakavat
  saman tiedostojärjestelmän, ja yksi ihminen tai agentti voi täyttää sen
  kaikilta. Ylläpitäjä valitsee tallennustilan asennuksessa.

## Ei tiliä sinun ja palvelimesi välissä

Open Habitat -tiliä, välityspalvelinta tai pilvipalvelua ei ole. Selain
puhuu palvelimesi kanssa, ja jokaisen mallipalvelukirjautuminen on hänen
omansa, Pi:n tallentamana hänen Unix-tunnuksessaan.

## Haavoittuvuuden raportointi

Käytä GitHubin
[yksityistä haavoittuvuusraportointia](https://github.com/Open-Habitat/open-habitat/security/advisories/new),
älä julkista issueta, jotta palvelimia ylläpitävät ehtivät korjata aukon
ennen kuin se kerrotaan kaikille.
