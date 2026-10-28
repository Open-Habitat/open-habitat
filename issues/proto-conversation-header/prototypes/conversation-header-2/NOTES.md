# Keskustelun otsake, kierros 2: malli- ja Git-siru

Avaa `index.html` selaimessa. Se on yksi offline-tiedosto, joka on kirjoitettu
käsin eikä rakennettu tuotantokomponenteista. Lähde on
`design-system/prototypes/rounds/2026-10-28-keskustelun-otsake-2/`. Rakennus
ja tarkistus tehdään komennolla
`node design-system/prototypes/rounds/2026-10-28-keskustelun-otsake-2/verify.mjs`
(Playwright `web/node_modules`ista). Kuvat ovat `evidence/`-hakemistossa
laitteen skaalauksella 2. Kierros 1 on yhä vertailtavissa hakemistossa
`../conversation-header/`.

## Mistä on kyse

Valitsit suunnan 1 *Lyhenee* ja yhteisen kevyen ulkoasun. Pohja on siis
valmis: yksi rivi, sirut ilman reunoja, Gitin nollat piilossa ja toiminnan
tila pelkkänä pisteenä. Pisteen tila näkyy tekstinä, kun osoitin on sen
päällä, kun siihen tullaan näppäimistöllä tai kun sitä napautetaan. Tämä
kierros kokeilee lisäpalautettasi:

- **Mallisiru lyhyeksi**: pelkkä `Opus 5.5` tai jopa `Opus`.
- **Ajattelutaso** näkyy joko vasta sirua avattaessa tai pienenä ikonina
  sirussa.
- **Git-siru ilman haaran nimeä**: sirussa ovat haaran ikoni ja nollasta
  poikkeavat luvut, ja nimi näkyy vasta avattaessa.

## Sivun ohjaimet

- **Alareunan valitsin**: **1 Taso avattaessa**, **2 Tasomittari sirussa**
  ja vertailuksi **Kierros 1 Lyhenee** sellaisena kuin valitsit sen.
  Näppäimet 1–3 ja nuolet vaihtavat näkymää.
- **Yläpalkki**: ikkunan leveys (Oma, 1024, 1280, 1600, 1920 tai
  Puhelin), sivupalkki, editori, **Mallin nimi** (`Opus 5.5` tai `Opus`),
  **Ajattelu** (off, low, medium, high tai max: näet, miltä mittari näyttää
  eri tasoilla), sisältö (Pitkä, Jarin kuva tai Puhdas Git), **Avaa**
  (malli, Git tai tilan vihje auki valmiiksi) ja teema.
- **Oikealla ylhäällä** näkyvät otsikon leveys suhteessa sen koko
  leveyteen, Git- ja mallisirun leveys sekä tiivistysvaihe.

Sirut avautuvat myös napsauttamalla. Esc tai ✕ sulkee ne.

## Suunnat (akseli: missä ajattelutaso näkyy)

1. **Taso avattaessa**: sirussa lukee vain malli. Ajattelutaso näkyy
   avautuvassa tasossa (tuotannon nykyinen sisältö: mallit, tunniste ja
   tasot) sekä vihjeessä ja ruudunlukijan nimessä.
2. **Tasomittari sirussa**: mallin nimen perässä on neljän palkin mittari.
   Mittari on 0–4 palkkia: off on 0, minimal ja low 1, medium 2, high 3
   sekä xhigh ja max 4. Tarkka taso on vihjeessä ja avattaessa. Mittari vie
   noin 21 px.

**Mallin nimi** on yläpalkin valinta, joten voit katsoa kummankin suunnan
sekä `Opus 5.5`- että `Opus`-nimellä. `Opus` säästää noin 21 px lisää.

## Kokeile näin

1. Valitse **1280**, sivupalkki **Auki**, sisältö **Jarin kuva**. Vaihda
   1, 2 ja Kierros 1. Rivi on kaikissa sama, mutta 1:ssä ja 2:ssa malli- ja
   Git-sirut ovat lyhyemmät.
2. Avaa **Malli** ja **Git** (napsauta sirua tai valitse yläpalkin
   **Avaa**). Git-taso näyttää koko haaran nimen otsikossa, polun,
   seurantahaaran, pohjahaaran ja muutokset. Mallitaso näyttää mallit, tunnisteen ja
   ajattelutasot.
3. Vaihda sisällöksi **Pitkä**. Pitkä haaranimi ei enää vie riviltä mitään,
   koska siru on aina ikoni ja luvut.
4. **Puhdas Git**: kun kaikki on nollaa, Git-siru on pelkkä ikoni.
5. Vaihda **Mallin nimi** `Opus`ksi ja **Ajattelu** eri tasoille suunnassa
   2.
6. Vie osoitin vihreän pisteen päälle tai siirry siihen sarkaimella.
   **Puhelimessa** napauta pistettä.
7. Avaa **Editori**. Keskustelusarake on silloin 440 px, ja kaikissa
   suunnissa malli siirtyy ⋯-valikkoon (kuten kierroksella 1), jotta
   otsikolle jää 40 % rivistä.

## Kuvat

- `1-avattaessa-1280-tumma.png`, `2-mittari-…` ja `kierros1-…` ovat koko
  näkymä 1280 px:ssä sivupalkki auki, myös `-vaalea`-versioina.
- `…-auki-model-…` ja `…-auki-git-…` näyttävät avatut tasot
  (myös `-opus-`, `-lyhyt-`, `-puhdas-`, editori ja puhelin).
- `1-avattaessa-1600-editori-auki-menu-tumma.png` on ⋯-valikko editorin
  vieressä.
- `tila-vihje-hover-1920-tumma.png` ja `2-mittari-puhelin-tila-napautus-vaalea.png`
  näyttävät pisteen vihjeen.
- `otsake-*.png` ovat pelkät otsakeleikkeet jokaisesta tapauksesta.
  `otsake-2-mittari-1280-kiinni-off|low|high|max-tumma.png` näyttävät
  mittarin eri tasoilla.
- `metrics.json` sisältää jokaisen tapauksen otsikon leveyden, sirujen
  leveydet ja tekstit sekä tiivistysvaiheen.

## Mitä minulta kysytään

Valitse suunta (1 tai 2) ja mallin nimen pituus (`Opus 5.5` tai `Opus`).
Suositus ja perustelut ovat issuen `result.md`:ssä: **1 Taso avattaessa,
`Opus 5.5`**.
