# Näkymäkortti: opas

Avaa `nakymakortti.html`. Se on yksi offline-sivu eikä käytä verkkoa.
Ylhäällä on valitsin (näppäimet 1–4 tai ←/→):

- **Nykyinen** on kortti sellaisena kuin main sen piirtää (`ViewOffer.tsx`).
- **1 · Otsikko ja painikkeet**, **2 · Näkyvyys tilarivinä** ja
  **3 · Näkyvyys säätimenä** ovat suunnat.

Sivun yläosan valinnoilla vaihdat vaalean ja tumman teeman, työpöydän ja
puhelimen, sen, **salliiko sivusto linkkijaon**, ja sen, onko otsikko
**kuvaava** (agentti antoi `--title`) vai **tiedostonimi** (`raide.html`).
*Alkuun* palauttaa tilan.

## Mikä on kaikissa suunnissa samaa

Jokainen suunta tekee sen, mitä pyysit:

- *Avaa* ja *Avaa omalle välilehdelle* pysyvät ennallaan.
- *Agentti tarjoaa näytettäväksi:* on poistettu.
- Rivi *Avaus pyydetty. Jos välilehteä ei näy…* on poistettu. Omalle
  välilehdelle avaaminen ei muuta korttia (sivun alareunan harmaa rivi kertoo
  vain, mitä selain tekisi).
- *Jäädytetty HTML*, tiedostomäärä ja koko on poistettu.
- Otsikko on agentin antama kuvaava otsikko.

Ainoa jäljelle jäävä tilarivi on virhe *Näkymää ei voitu avata…*, koska
siitä sinun pitää tietää.

## Akseli: missä näkymän näkyvyys näkyy

Kun *Vain sinulle* ei enää ole tekstinä metarivillä, kysymys on, missä ja
miten kortti kertoo, kuka näkymän näkee:

1. **Otsikko ja painikkeet.** Kortissa on vain otsikko ja painikkeet.
   Jakamattomasta näkymästä ei sanota mitään, koska kaikki keskustelussa on
   oletuksena vain sinun. Kun näkymällä on linkki, *Jaa linkillä* muuttuu
   muotoon **Jaettu 28.11. asti**, ja sama painike avaa linkki-ikkunan.
2. **Näkyvyys tilarivinä.** Otsikon alla on yksi hiljainen rivi:
   🔒 *Vain sinä* tai 🔗 *Kuka tahansa linkillä · 28.11. asti*.
   Painike pysyy verbinä: *Jaa linkillä* tai *Linkin asetukset*.
3. **Näkyvyys säätimenä.** Näkyvyys on otsikkorivin säädin kuten jaetussa
   dokumentissa: **Vain sinä ⌄** tai **Linkillä 28.11. asti ⌄**. Painettuna
   se avaa valikon, jossa on *Kuka tahansa linkillä…*, tai jaetulla
   näkymällä *Kopioi linkki*, *Linkin asetukset…* ja *Lopeta jakaminen*.
   Erillistä jakopainiketta ei ole. Puhelimessa säädin on otsikon alla.

Jos sivusto ei salli linkkejä, kortissa ei ole yhdessäkään suunnassa
näkyvyysmerkintää eikä jakopainiketta, koska vaihtoehtoa ei ole.

## Kokeile näin

1. **Nykyinen**: paina toisen kortin *Avaa omalle välilehdelle*, jolloin
   pyyntörivi jää korttiin. Ensimmäinen kortti on jo jaettu, ja sen metarivi
   kertoo sen.
2. **1**: paina toisen kortin *Jaa linkillä* › *Luo linkki* › *Sulje*.
   Painikkeeksi tulee *Jaettu 8.11. asti*. Vaihda valinnaksi *Ei linkkejä*,
   niin kortissa on vain otsikko ja kaksi painiketta.
3. **2**: vertaa, miltä 🔒 *Vain sinä* -rivi tuntuu kahdessa peräkkäisessä
   kortissa.
4. **3**: paina *Vain sinä ⌄* ja ensimmäisen kortin *Linkillä 28.11. asti ⌄*.
   *Lopeta jakaminen* poistaa linkin suoraan valikosta.
5. Missä tahansa suunnassa: valitse *Tiedostonimi*, niin näet kortin, kun
   agentti ei anna otsikkoa, ja *Avaa*, niin näet paneelin kortin vieressä.

Suosittelen suuntaa **1 · Otsikko ja painikkeet**. Perustelut, hostin tiedot
ja kysymykset ovat issuen `result.md`:ssä. Kuvat ovat hakemistossa `kuvat/`
laitteen skaalauksella 2.

Sivu rakennetaan komennolla `python3 build.py`, joka upottaa tokenit ja
fontit tiedostosta `page.src.html`. Kuvat ja konsolitarkistus tehdään
komennolla `NODE_PATH=<repo>/web/node_modules node shoot.mjs kuvat`.
