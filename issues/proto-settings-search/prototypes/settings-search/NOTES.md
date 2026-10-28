# Haku asetuksissa

Avaa `index.html` selaimessa. Se on yksi offline-tiedosto, joka on kirjoitettu
käsin. Sitä ei ole rakennettu tuotantokomponenteista. Lähde on
`design-system/prototypes/rounds/2026-10-28-asetusten-haku/`.
Tiedosto rakennetaan ja tarkistetaan komennolla
`node design-system/prototypes/rounds/2026-10-28-asetusten-haku/verify.mjs`.
Komento tarvitsee Playwrightin `web/node_modules`ista ja ffmpeg:n. Kuvat ovat
`evidence/`-hakemistossa AVIF-muodossa laitteen skaalauksella 2.

## Mistä on kyse

Asetuksissa on nyt 10 omaa osiota, kun tuleva Tilannekatsaus lasketaan
mukaan, ja ylläpitäjällä lisäksi 7 palvelimen osiota. Rivejä on noin 40.
Kierros kokeilee hakua macOS:n Järjestelmäasetusten tapaan:

- Hakukenttä on asetusten sivupalkin yläreunassa otsikon alla.
- Osumat korostetaan.
- Tulokset näytetään polkuineen, esimerkiksi *Tekoäly › API-avaimet*.
- Valinta vie riville.

Nurkassa on sulkeva X, joka toteutetaan erikseen
(`settings-close-returns`). Haku on mitoitettu sen viereen.

## Sivun ohjaimet

- **Alareunan valitsin**: kolme suuntaa ja vertailuna **Nykyinen**
  (asetukset ilman hakua, mutta X:n kanssa). Suuntaa vaihdetaan näppäimillä
  1–4 ja nuolilla, kun kohdistus ei ole hakukentässä.
- **Kokeile**: valmiita hakuja. *tumma* osuu synonyymiin, *avain* moneen
  osioon, *gmail* palvelun sisältöön, *malli* yhdyssanaan *Oletusmalli*,
  *puhelin* Laitteisiin, *recap* tulevaan Tilannekatsaukseen ja *kiintiö*
  Tallennustilaan. *lomake* ei löydä mitään.
- **Rooli**: Ylläpitäjä löytää myös palvelimen asetukset, Henkilö ei.
- **Ikkuna**: Oma, 1280 tai Puhelin. **Teema**: Tumma tai Vaalea.

## Mikä on kaikissa suunnissa samaa

- **Hakukenttä** on sivupalkin yläreunassa. Näppäin `/` vie kenttään.
  Puhelimessa kenttä on asetusluettelon yläpuolella.
- **Mitä haku löytää**:
  - osiot ja yksittäiset asetukset nimen perusteella
  - synonyymit, esimerkiksi *dark mode* tai *tumma tila* → Teema
  - kuvauksen sanat, kun sana on vähintään kolmikirjaiminen
- **Hakusanat**: Isot ja pienet kirjaimet ovat sama asia, samoin ä ja a.
  Neljän kirjaimen sana löytyy myös yhdyssanan sisältä. Kaikkien kirjoitettujen
  sanojen on osuttava. Omat asetuksesi tulevat ennen palvelimen asetuksia.
- **Synonyymi**: Jos osuma tuli synonyymistä, tuloksessa lukee esimerkiksi
  *osui: tumma tila*. Silloin näet, miksi rivi löytyi.
- **Valinta**: Valittu tulos avaa osion, vierittää rivin näkyviin ja vilauttaa
  sitä. Tämä on sama merkintä, jota tuotanto jo käyttää linkeissä (esimerkiksi
  mallivalitsimen Claude-linkki). Haun ollessa auki osion osuvissa riveissä
  on lisäksi hiljainen reunaviiva, ja osuva teksti on korostettu.
- **Esc** tyhjentää haun. Kun haku on tyhjä, Esc sulkee asetukset ja palauttaa
  sen, mikä oli auki ennen niitä. Sama tekee X.

## Suunnat (akseli: missä osumat näytetään)

1. **Sivupalkissa** (macOS Sonoma): kirjoittaessa osioluettelo vaihtuu
   tuloslistaksi. Jokaisessa tuloksessa on nimi, polku ja tarvittaessa syy.
   Ensimmäinen tulos avautuu oikealle heti, ja nuolinäppäimet vaihtavat
   avattua tulosta. Enter vie kohdistuksen riville. Puhelimessa tulokset
   korvaavat luettelon. Osuman sivulta pääsee takaisin *Hakutulokset*-rivillä.
2. **Tulossivu** (Chrome ja VS Code): sivupalkki pysyy. Osioissa, joissa on
   osumia, on osumamäärä, ja muut himmenevät. Oikealla on *Hakutulokset*,
   jossa osuvat rivit ovat oikeine säätimineen osioittain. Säädön voi tehdä
   suoraan tuloksissa. Kokeile *tumma* ja vaihda teema tuloksissa. Kun haet
   osion nimellä, esimerkiksi *sanelu*, näet osion kaikki rivit.
3. **Pikahaku** (Spotlight): sivu pysyy ennallaan, ja kentän alle aukeaa
   ponnahduslista. Tyhjällä kentällä listassa on ehdotuksia. Hakiessa
   tulokset jakautuvat ryhmiin *Osiot* ja *Asetukset*. Enter tai napautus
   sulkee listan ja vie riville. Puhelimessa haku vie koko näytön, ja
   *Peruuta* palaa luetteloon.

## Mitä kannattaa katsoa

- Kokeile haulla *avain*, mihin osumat eri suunnissa päätyvät. Suunta 1
  näyttää yhdeksän osumaa kapeassa sivupalkissa. Suunta 2 näyttää kuusi riviä
  viidessä osiossa koko leveydellä. Suunta 3 näyttää listan sivun päällä.
- Puhelimessa: haku *gmail* → Google. Suunnassa 1 pääset takaisin
  tuloksiin, suunnassa 3 luetteloon.
- Sulje asetukset X:llä tai Escillä ja avaa ne sivupalkin nimestäsi.

Suositus ja perustelut ovat issuen `result.md`-tiedostossa.
