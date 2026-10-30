# Kuvakkeen asettaminen työtilasivulla: kokeiluohje

Avaa `kuvakkeen-asetus.html`. Se toimii ilman verkkoa, koska fontit ja tokenit on
upotettu siihen. Suunta valitaan alareunan valitsimesta (*Otsikko*,
*Ulkoasu*, *Ehdotus*), näppäimillä 1–3 tai nuolinäppäimillä. Yläpalkista
valitaan repo, näkymä (*Työpöytä*, *Puhelin*) ja teema. *Alkutila* peruu
tekemäsi muutokset. Jokainen suunta alkaa samasta tilasta.

Repot ovat keksittyjä. Sivupalkki lukee kuvakkeen Lähdeketjun mukaan
(`.open-habitat.yaml` `icon` → repon logo → nimestä johdettu tunnus), ja se
päivittyy heti, kun teet valinnan.

- **logo** = `open-habitat`. Repossa on logo (`design-system/favicon.svg`),
  mutta konffia ei ole. Lisäksi on kaksi muuta commitoimatonta muutosta.
- **asetettu** = `fleetrepo`. `.open-habitat.yaml` sisältää jo rivin
  `icon: "🏠"`, ja se on commitoitu.
- **ei mitään** = `tailspin-monorepo`. Repossa ei ole logoa eikä konffia,
  joten kuvakkeena näkyy tunnus *IT*.
- **ei Gitiä** = `muistiinpanot`. Tämä on tavallinen hakemisto, joten
  commitointia ei voi tarjota.

## Mitä kannattaa katsoa

1. **Otsikko.** Klikkaa työtilan nimen vieressä olevaa kuvaketta. Valitse
   logo, kirjaimet tai emoji. Valinta tallentuu heti. Otsikon alle tulee
   ilmoitus *`.open-habitat.yaml` luotu, ei commitoitu*, jossa on painikkeet
   *Kumoa* ja *Commitoi tiedosto*. Commitoi ja avaa sitten Git-siru: vain
   konffi lähti commitiin, ja kaksi muuta muutosta jäivät ennalleen.
2. **Ulkoasu.** Aloitussivun alla on oma osio, joka näyttää ketjun kolme
   porrasta ja sen, mikä niistä on käytössä. *Vaihda…* avaa välilehdet,
   esikatselun kolmessa koossa ja diffin siitä, mitä repoon kirjoitetaan.
   *Tallenna repoon* ei commitoi. Osio näyttää merkinnän *commitoimatta* ja
   kertoo, että commit jää sinulle tai agentille.
3. **Ehdotus.** Valitse *ei mitään*. Sivu ehdottaa kuvaketta, ja yksi klikkaus
   tallentaa ja commitoi sen. Commitoinnin voi kytkeä pois päältä valintaruudusta.
   Repossa, jossa kuvake on jo asetettu (*asetettu*), ehdotusta ei näy.
   Kuvake vaihdetaan silloin kynästä tai kuvakkeesta avautuvassa *Nimi ja
   kuvake* -ikkunassa. Ikkuna kertoo, että nimi tallentuu vain tälle
   palvelimelle mutta kuvake repoon.
4. **Puhelin.** Otsikon valitsin avautuu alapaneelina. Ulkoasu-osio ja
   ehdotus mahtuvat sivun leveydelle.
5. **Ilman Gitiä** (*ei Gitiä*). Commitointia ei tarjota, vaan sivu kertoo,
   että tiedosto jää vain tähän hakemistoon.

## Suositukseni lyhyesti

**Otsikko.** Kuvaketta vaihdetaan harvoin, ja sitä etsitään luontevimmin
kuvakkeesta itsestään. Valinta näkyy heti. Lisäksi sivu sanoo suoraan, että
muutos on commitoimatta, ja tarjoaa commitin, joka koskee vain konffitiedostoa.
Perustelut, havainnot koodista ja auki jääneet päätökset ovat issuen
`result.md`:ssä.
