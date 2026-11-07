# Tulokset

## Kierros 1 (7.11.2026): Oletukseen henkilörivillä

Kierros: `design-system/prototypes/rounds/2026-11-07-oletukseen-paikka/`
(NOTES.md kertoo tarinan, mittaukset ja ohjaimet). Levytila ja Keskustelut
ovat vierekkäin tuotannon osioina muuttamattomina; vain henkilörivin
palautuksen paikka vaihtuu suunnan mukaan. Oletusnäkymä on kapea 440 px:n
asetuspaneeli, jossa Jari ongelman näki; yläpalkista saa leveän 720 px:n.
Akseli on se, missä henkilön oman rajan palautus oletukseen on rivillä niin,
että kaikki rivit ovat yhtä korkeita.

- **Nyt**: tuotanto muuttamattomana; Oletukseen on oma painikkeensa rivin lopussa, kapeassa paneelissa käyttöpalkin alla, joten rivit, joilla on oma raja, ovat korkeampia.
- **A Säädin**: pieni palautuskuvake heti − n + -säätimen oikealla puolella; riveillä ilman omaa rajaa sama tyhjä tila, joten säätimet pysyvät linjassa.
- **B Linkki**: nimen alla oleva rivi sanoo »oma raja · Oletukseen«, ja Oletukseen on linkki; riveillä ilman omaa rajaa siinä lukee »oletus«.
- **C Valikko**: jokaisen rivin lopussa sama ⋯-valikko, jossa »Palauta oletusrajaan«; se on harmaana, kun henkilö jo käyttää oletusta.

Mitattuna *Nyt*-rivit ovat Levytilassa 130 px (oma raja) ja 92 px (oletus)
kapeassa paneelissa ja 138/92 puhelimessa, Keskusteluissa puhelimessa 102/56.
Kaikissa kolmessa suunnassa rivit ovat samankorkuisia joka leveydellä
molemmissa osioissa, myös palautuksen jälkeen.

Kuvat: `evidence/r1-<suunta>-<vaihe>-<leveys>-<teema>.avif`, suunnat
`nyt`, `a-saadin`, `b-linkki` ja `c-valikko`. Vaiheet: `0-oletus`
(työpöydällä koko sivu), `0-keskustelut` (puhelimessa Keskustelut),
`1-valikko-auki` (vain C, ainon valikko auki), `2-aino-palautettu`
(ainon raja palautettu molemmissa osioissa) ja `3-levea-paneeli`
(työpöytä, 720 px). Vertailuun parhaat: `*-0-oletus-1440-dark` (Jarin
tilanne) ja `*-0-oletus-390-light`.

### Isäntätiedot

Uusia isäntätietoja ei tarvita. Molemmat osiot käyttävät nykyisiä reittejä:
Levytilan palautus asettaa henkilön rajaksi nykyisen oletusrajan
(`PUT /api/v1/server/storage`, isäntä pitää yhden rajan henkilöä kohden),
Keskustelujen palautus poistaa oman rajan (`PUT /api/v1/server/conversations`,
`limit: null`). *Oma raja* on edelleen selaimen päätelmä: raja eroaa
oletuksesta. Sijainen on synteettinen.

### Suositus

**B Linkki.** Rivi kertoo jo nimen alla, onko henkilöllä oma raja; palautus
on luontevimmin sanana juuri siinä (*oma raja · Oletukseen*). Mikään sarake
ei levene, ja ratkaisu näyttää samalta kapeassa ja leveässä paneelissa,
puhelimessa ja molemmissa osioissa. Toteutuksessa linkin osuma-aluetta
kasvatetaan puhelimessa rivin korkeutta muuttamatta, ja jaettu `LimitReset`
muuttuu `PeopleRow`in kuvausrivin osaksi.

- **A** on lähellä säädintä, mutta pelkkä kuvake ei kerro kosketuksella
  mitään, ja säädinsarake levenee kaikilla riveillä.
- **C** on siistein, mutta piilottaa yhden toiminnon kahden painalluksen
  taakse ja lisää ⋯:n myös riveille, joilla ei ole mitään palautettavaa.

### Kysymykset Jarille

1. Mikä suunta: A, B vai C (`*-0-oletus-1440-dark`)?
2. Pitäisikö palautuksen kertoa, mihin se palauttaa, esim. *Oletukseen
   (20 GiB)* (`b-linkki-0-oletus-390-light`)?

### Näkymätarjous

```
node design-system/prototypes/rounds/2026-11-07-oletukseen-paikka/build.mjs
open-habitat agent view offer --current --source design-system/prototypes/dist/oletukseen-paikka/offline.html --title "Oletukseen henkilörivillä · kierros 1" --idempotency-key c17ee3c4-3825-41da-8cb9-4b9cc33b96bc --json
```
