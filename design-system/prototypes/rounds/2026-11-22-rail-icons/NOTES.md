# Sivupalkin paikkojen kuvakkeet

Tuotannossa Tuotokset ja Oma selain käyttävät samaa maapalloa, ja Agentin
käytössä on kilpi, jossa on huutomerkki ja joka näyttää varoitukselta.
Aiemmat kierrokset ehdottivat päinvastaisia korjauksia: `rail-space-2` antoi
Tuotoksille lähtevän laatikon ja Omalle selaimelle ikkunan, ja
`server-browser-places` antoi Omalle selaimelle ikkunan ja jätti Tuotoksille
maapallon. Tämä kierros piirtää paikoille yhtenäisen sarjan.

Akseli: **mikä on kuvakkeen idea**. Kaikki on piirretty tuotannon
24 yksikön ruudukkoon tuotannon 1,8 viivalla ja pyöreillä päillä.

- **A Esineet** (suositus): jokainen paikka on esine, jossa sen sisältö on.
  Tuotokset on lokero, jossa on sivu: agentin antamat näkymät ja tiedostot,
  ovat ne sitten vain sinulle tai jaettu linkillä. Oma selain on
  selainikkuna, sama merkki kuin keskustelurivin selainmerkki. Agentin
  käytössä on pistoke, eli yhdistetyt palvelut ja kansiot (sivun oma painike
  on *Yhdistä palvelu*). Selitä on kysymysmerkki ympyrässä.
- **B Merkitykset**: kuvake kertoo, mitä paikka tekee. Etusivu on Habitatin
  aurinko ja kaari, Tuotokset kertyvät kerrokset, Oma selain osoitin (kenen
  käsi on ohjaimissa) ja Agentin käytössä napa. Selitä on kysymys
  puhekuplassa.
- **C Kaksisävy**: A:n esineet, mutta paikan tunnusosa on sävytetty
  (`currentColor`, peittävyys 0,28): katto, lokero, otsikkopalkki ja
  pistokkeen runko. Paikat erottuvat massallaan, ja työkalut (haku, Selitä,
  uusi, asetukset) jäävät viivoiksi.
- **Nyt**: tuotannon kuvakkeet vertailuksi.

Haku, Uusi keskustelu (+), Uusi työtila ja Asetukset ovat tuotannon
kuvakkeita kaikissa suunnissa. Henkilövalikon avaa avatar, ei kuvake.

Sivulla on kolme osaa:

1. **Sivupalkissa**: sama palkki mukautuvan sivupalkin kolmessa askeleessa
   (kuvakerivi, ruudut ja rivit, kuten `rail-space-2`:ssa). Mukana ovat
   palvelimen nimi, paikat ja haku, Sinun vuorosi -rivit, Työtilat
   (Uusi työtila otsikossa ja Uusi keskustelu työtilarivillä) sekä hylly,
   jossa ovat avatar, Selitä ja tilivalikko (Asetukset, Selitä, Kirjaudu
   ulos; valikko avautuu rivien askeleessa). Vihje näkyy, kun osoitin tai
   fokus on kuvakkeen päällä, ja saavutettava nimi on sama teksti.
   Paikan painaminen tekee siitä nykyisen.
2. **Kuvakerivi päivällä ja yöllä, 1x ja 2x**: kuvakerivi kummassakin
   teemassa luonnollisessa koossa ja kaksinkertaisena.
3. **Pikseleinä ja erottuvuus**: jokainen 18 px kuvake rasteroituna 1x- ja
   2x-tiheydellä ja suurennettuna, päivällä ja yöllä. Lisäksi taulukko
   kuvakerivin kuvakeparien päällekkäisyydestä 1x-rasterissa (pehmeä
   leikkaus jaettuna yhdisteellä; 100 % tarkoittaa samaa kuvaa).

Tilat, joita voi vaihtaa *Tilanne*-valinnasta:

- **Levossa**: ei merkkejä.
- **Tavallinen**: Tuotoksissa on 1 uusi, ja agentti on selaimessa (ok-värinen
  piste, joka sykkii).
- **Sinua odotetaan**: Tuotoksissa on 3 uutta, Oma selain odottaa sinua, ja
  Agentin käytössä on yhteys, joka odottaa kirjautumista (Sinun vuorosi
  -värinen piste ja kuvake). Selitä on päällä.

Merkki ei ole koskaan pelkkä väri. Ruudussa tila kerrotaan toisella rivillä,
rivissä sanalla oikeassa reunassa ja kuvakerivissä vihjeessä ja
saavutettavassa nimessä.

Osoitteella voi valita: `?v=1..4`, `?scene=rest|usual|waiting`,
`?theme=dark` ja `?lang=en`.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-22-rail-icons/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 600 \
  node design-system/prototypes/rounds/2026-11-22-rail-icons/check.mjs \
  design-system/prototypes/dist/rail-icons/offline.html <kuvahakemisto>
```

Linuxissa komennot ajetaan scratch-leasen alla yksityisellä `TMPDIR`:llä ja
`umask 077`:llä. `check.mjs`:n alussa kerrotaan, mitä se tarkistaa. Se
epäonnistuu, jos A:ssa, B:ssä tai C:ssä jokin kuvakerivin pari menee yli
50 % päällekkäin tai jos Nyt ei näytä kahta maapalloaan samana kuvana.
