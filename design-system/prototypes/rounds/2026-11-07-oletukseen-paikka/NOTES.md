# Oletukseen henkilörivillä – kierros 1

Issue `proto-limit-reset-placement`. Jari 7.11.2026 (pilot.619,
Palvelimen ylläpito › Levytila, tumma): henkilörivin *Oletukseen* on omana
isona painikkeenaan käyttöpalkin alla, vaikka säädin (− 30 +) on rivin
oikeassa reunassa. Rivit, joilla on oma raja, ovat siksi korkeampia kuin
rivit ilman sitä. Keskustelujen poikkeuksissa on sama jaettu `LimitReset`.

Sivu näyttää Levytilan ja Keskustelut vierekkäin. Molemmat ovat tuotannon
osioita (`ServerStorage`, `ServerConversations`) muuttamattomina
`fetch`-sijaista vasten: kuusi henkilöä, levyn omat rajat ainolla (40 GiB),
maintainer (30 GiB, Jarin kuvan rivi) ja sannalla (10 GiB), keskustelujen
omat rajat ainolla, mikolla ja liisalla. Kirjoitukset muuttavat samaa tilaa,
joten säätimet ja palautus toimivat oikeasti. Kierroksen ainoa muutos on
`section.tsx`: `build.mjs` ohjaa näiden kahden osion `ServerSection`-tuonnin
siihen, ja se siirtää `PeopleRow`-riville annetun `LimitReset`in suunnan
paikkaan. *Nyt* jättää rivin koskematta.

Yläpalkin *Paneeli* vaihtaa asetuspaneelin leveyden: oletuksena kapea
440 px, jollainen paneeli on työpöydällä molempien sivupalkkien kanssa ja
jossa Jari ongelman näki, tai leveä 720 px. *Alusta* palauttaa alkutilan.

## Suunnat

Akseli: missä henkilön oman rajan palautus oletukseen on rivillä niin, että
kaikki rivit ovat yhtä korkeita.

- **Nyt**: tuotanto muuttamattomana; Oletukseen on oma painikkeensa rivin lopussa, kapeassa paneelissa käyttöpalkin alla, joten rivit, joilla on oma raja, ovat korkeampia.
- **A Säädin**: pieni palautuskuvake heti − n + -säätimen oikealla puolella; riveillä ilman omaa rajaa sama tyhjä tila, joten säätimet pysyvät linjassa.
- **B Linkki**: nimen alla oleva rivi sanoo »oma raja · Oletukseen«, ja Oletukseen on linkki; riveillä ilman omaa rajaa siinä lukee »oletus«.
- **C Valikko**: jokaisen rivin lopussa sama ⋯-valikko, jossa »Palauta oletusrajaan«; se on harmaana, kun henkilö jo käyttää oletusta.

## Mitä mittaus näyttää

`check.mjs` mittaa jokaisen henkilörivin korkeuden (CSS-pikseleinä):

| | Levytila 440 | Levytila puhelin | Keskustelut 440 | Keskustelut puhelin |
|---|---|---|---|---|
| Nyt | 130 / 92 | 138 / 92 | 56 kaikki | 102 / 56 |
| A, B, C | 92 kaikki | 92 kaikki | 56 kaikki | 56 kaikki |

Leveässä paneelissa myös *Nyt* on tasainen, koska Oletukseen mahtuu rivin
loppuun. Keskustelujen lista on tiivis ja pysyy 440 px:ssä yhdellä rivillä;
puhelimessa sielläkin Oletukseen putoaa omalle rivilleen.

## Kunkin suunnan hinta

- **A**: kuvake on säätimen vieressä, jossa arvoakin muutetaan, mutta
  kuvake yksin ei sano mitään. Työpöydällä vihje kertoo *Oletukseen: aino*,
  kosketuksella vihjettä ei ole. Säädinsarake levenee kaikilla riveillä
  yhden kuvakkeen verran.
- **B**: sana on siellä, missä rivi jo kertoo tilan (*oma raja*), eikä mitään
  levene. Linkki on pieni kosketuskohde puhelimessa; toteutuksessa sen
  osuma-aluetta kasvatetaan rivin korkeutta muuttamatta.
- **C**: rivi on siistein, mutta palautus vaatii kaksi painallusta ja on
  piilossa. Valikossa on vain yksi toiminto, ja ⋯ on jokaisella rivillä,
  myös niillä, joilla ei ole mitään palautettavaa.

## Kierroksen omat lisäykset

Vain kierroksessa, ei kirjastossa: `.rq-a-*` (A:n kuvake ja varattu tila),
`.rq-b-link` (tekstilinkki kuvausrivillä; tuotannossa ei ole
linkkipainiketta, joten toteutus tarvitsee sellaisen) ja `.rq-c-*`
(hiljainen ⋯ kuten *Palaa tähän* -valikossa ja kapean listan sääntö, joka
pitää ⋯:n rajan vieressä). C:n valikkotekstit ovat vain suomeksi;
toteutus vie ne molempien kielten katalogiin.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-07-oletukseen-paikka/build.mjs
PLAYWRIGHT_BROWSERS_PATH=… node design-system/prototypes/rounds/2026-11-07-oletukseen-paikka/check.mjs \
  design-system/prototypes/dist/oletukseen-paikka/offline.html <kuvakansio>
```

`build.mjs` tarvitsee `web/node_modules`in commitoidusta lukosta.
`check.mjs` käy jokaisen suunnan läpi 1440 ja 390 px leveänä, vaaleana ja
tummana, vaatii suuntien rivit samankorkuisiksi, palauttaa ainon rajan
molemmissa osioissa suunnan omalla tavalla ja tarkistaa, että rivi sanoo
*oletus*. C:ssä se avaa myös annan valikon ja tarkistaa, että palautus on
harmaana. Konsolin pitää pysyä puhtaana.
