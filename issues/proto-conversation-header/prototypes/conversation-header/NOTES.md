# Keskustelun otsake työpöydällä

Avaa `index.html` selaimessa. Se on yksi offline-tiedosto, käsin kirjoitettu
eikä tuotantokomponenteista rakennettu. Lähde on
`design-system/prototypes/rounds/2026-10-28-keskustelun-otsake/`. Rakennus ja
tarkistus tehdään komennolla
`node design-system/prototypes/rounds/2026-10-28-keskustelun-otsake/verify.mjs`
(Playwright `web/node_modules`ista). Kuvat ovat `evidence/`-hakemistossa
laitteen skaalauksella 2.

## Mistä on kyse

Kuvakaappauksesi (pilot.455) kaksirivinen otsake tuli korjauksesta, jossa
yksirivinen otsake puristi otsikon olemattomiin, kun sivupalkki oli auki ja
ikkuna oli 800–1400 px leveä. Nyt otsake on kahdella rivillä aina, kun
otsakkeen leveys on alle 80rem (1280 px). Sivupalkki auki se tarkoittaa käytännössä
kaikkia ikkunoita alle noin 1600 px. Lisäksi jokainen siru on reunaviivallinen
pilleri. Tämä kierros etsii yhden rivin, jossa otsikko pysyy luettavana.

## Sivun ohjaimet

- **Alareunan valitsin**: kolme suuntaa ja vertailut **Nykyinen** (tuotanto nyt,
  kaksi riviä) ja **Aiempi** (puristuva yksi rivi). Näppäimet 1–5 ja nuolet
  vaihtavat.
- **Yläpalkki**: ikkunan leveys (Oma, 1024, 1280, 1600, 1920 tai Puhelin),
  sivupalkki auki tai kiinni, editori auki tai kiinni, sisältö (Pitkä tai Jarin
  kuva) ja teema. Kiinteä leveys skaalataan mahtumaan ruutuusi, joten näet
  1920 px:n asettelun myös kannettavalla.
- **Oikealla ylhäällä** näkyy, montako pikseliä otsikolle jää koko tekstin
  leveydestä, kuinka korkea otsake on ja missä tiivistysvaiheessa suunta on.

## Mikä on kaikissa suunnissa samaa

Kaikissa kolmessa suunnassa otsake on yksi rivi. Siruilla ei ole reunaviivaa,
aktiviteetti on piste ja teksti ilman pilleriä, ja Git näyttää vain luvut, jotka
eivät ole nollia (`main ↑1`). Otsikko saa aina vähintään 40 % rivistä tai koko
tekstinsä. Vertaa ensin **Nykyinen** ja **1 Lyhenee** samalla leveydellä:
suurin osa raskaudesta lähtee jo tästä kevennyksestä.

## Suunnat (akseli: mihin tila väistyy, kun rivi loppuu)

1. **Lyhenee**: kaikki jää yläpalkkiin, mutta sirut lyhenevät vaiheittain:
   työtila, ajattelutaso, aktiviteetin teksti, kontekstin prosentti, haaran
   nimi ja mallin nimi. Vasta editorin vieressä Uusi otsikko, Arkistoi ja Tiedot
   siirtyvät ⋯-valikkoon.
2. **Valikkoon**: sirut pysyvät kokonaisina, mutta ne, jotka eivät mahdu,
   siirtyvät kokonaan ⋯-valikkoon (työtila, konteksti, Git, malli). Avaa ⋯
   nähdäksesi ne.
3. **Kentän luo**: yläpalkissa on vain otsikko, aktiviteetti ja toiminnot. Malli,
   konteksti, työtila ja Git ovat hiljaisella rivillä kentän alla.

## Kokeile näin

1. Valitse **1280**, sivupalkki **Auki**, sisältö **Jarin kuva**. Tämä vastaa
   kuvakaappaustasi. Käy läpi Nykyinen, 1, 2 ja 3.
2. Vaihda sisällöksi **Pitkä** (pitkä otsikko, haara
   `wt/korjaa-otsikkorivin-…` ja malli `Opus 5.5 (1M konteksti)`). Katso, mitä
   kukin suunta luopuu ensin.
3. Kokeile **1024** ja **1600**. Valitse **Aiempi**, niin näet alkuperäisen
   ongelman: 1024 px:ssä otsikolle ei jää mitään.
4. Avaa **Editori**. Keskustelusarake on silloin 440 px. Nykyisessä otsake on
   kolmella rivillä, suunnissa yksi.
5. Valitse **Oma** ja muuta selainikkunan leveyttä, niin näet vaiheiden
   vaihtuvan.
6. **Puhelin**: suunta 1 pitää nykyisen kaksirivisen asettelun hiljaisilla
   siruilla. Suunnat 2 ja 3 ovat yhdellä rivillä.

## Kuvat

- `1-lyhenee-1280-tumma.png`, `2-valikkoon-…`, `3-kentan-luo-…`,
  `nykyinen-…` ja `aiempi-…` ovat koko näkymä 1280 px:ssä sivupalkki auki,
  sekä `-vaalea`-versiot.
- `…-1600-editori-tumma.png` on editori auki, `…-1920-lyhyt-tumma.png` Jarin
  kuvan sisältö ja `…-puhelin-*.png` puhelin.
- `otsake-*.png` ovat pelkät otsakeleikkeet jokaisesta tapauksesta: leveys,
  sivupalkki, editori ja sisältö. Niitä on helppo verrata allekkain.
- `2-valikkoon-1280-editori-valikko-tumma.png` näyttää suunnan 2 avatun
  valikon.
- `metrics.json` sisältää jokaisen tapauksen otsikon leveyden, otsakkeen
  korkeuden ja näkyvät sirut.

## Mitä minulta kysytään

Valitse suunta. Suositus ja perustelut ovat issuen `result.md`:ssä
(suositus: **1 Lyhenee**). Kerro myös, saako työpöydällä olla ⋯-valikko
kapeassa sarakkeessa.
