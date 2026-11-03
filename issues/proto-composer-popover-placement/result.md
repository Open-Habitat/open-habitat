# Kentän listat

## Kierros 2: miten kentän sisäinen lista toimii

Kierros: `design-system/prototypes/rounds/2026-11-03-kentan-listat-2/`.
`NOTES.md` kertoo nykytilan, yhteiset säännöt ja rakennuskomennon. Kierroksella
1 Jari valitsi *Kentän sisällä* (3.11.). Nyt on tuotannon `Composer`
muuttamattomana, ja suunnat 1–3 on rakennettu tuotannon merkinnästä,
tyyleistä ja tekstisäännöistä synteettisen työtilan päälle. Oletusnäkymä on
pitkä luonnos, jossa *Tiedosto* on auki napista. Sivun yläreunasta voi
vaihtaa luonnoksen (pitkä, lyhyt, `!`-komento) ja listan tilan (valmis,
hidas, ei saatu). Hakua, nuolia, Tabia, Enteriä, Esciä, kansioita,
merkintää ja kirjoitettua `/`- tai `@`-merkkiä voi kokeilla.

Akseli: miten koko valikoima (haku, kansiot, usean valinta, muutetut,
esikatselu) järjestyy kentän sisäiseen listaan.

0. **Nyt**: lista avautuu kentän yläpuolelle; useamman tiedoston valinta, muutetut ja esikatselu ovat vain Ctrl/⌘+P-valitsimessa koko näkymän päällä.
1. **Hakulista**: yksi sarake kuten nyt, mutta kentän sisällä; kansiot tulevat hakuun riveinä ja rajaavat haun, ympyrä merkitsee useamman, Muutetut on siru.
2. **Kansiopuu**: lista selaa kansioita polkurivillä (aurinkokello › src); Muutetut on ensimmäinen kansio, valintaruutu joka rivillä, haku koko kansiosta.
3. **Välilehdet**: Ctrl/⌘+P-valitsin siirtyy kenttään: Tiedostot · Muutetut · Komennot ja esikatselu listan vieressä.

Kaikissa kolmessa on samat säännöt:

- Ei välidialogia. Napit ja Ctrl/⌘+P avaavat saman kentän sisäisen
  listan, eikä valitsindialogia koko näkymän päällä ole. Liitä avaa jo
  suoraan laitteen tiedostovalitsimen; yhden vaihtoehdon valikko poistui
  2.11.
- Usean valinta toimii kaikissa listoissa. Tab tai rivin alun ympyrä tai
  ruutu merkitsee, ja *2 valittu · Lisää 2 polkua* -rivi kertoo, mitä Enter
  lisää (`@a @b `). Kirjoitetussa `@`-listassa Tab täydentää ylimmän kuten
  nyt ja Pi:n päätteessä.
- Kansion valinta avaa kansion. Kirjoitettu `@src/` jatkuu kansion sisältä.
  Kansion voi lisätä tekstiin merkitsemällä sen.
- Lisäys toimii kuten nyt: komento napista viestin alkuun, kirjoitettu
  komento sanan paikalle, tiedosto kursorin kohtaan `@polku`-muodossa ja
  `!`-komennossa pelkkänä polkuna.
- Esc sulkee listan ja palauttaa kohdistuksen tekstiin samaan kohtaan.
  Painallus näkyviin tekstiriveihin tai komposerin ulkopuolelle sulkee
  napin listan. Lyhyt teksti ei tiivisty, pitkä tiivistyy kursorin
  kahdeksi riviksi.

Mitä kukin päättää:

- *Hakulista* pitää listan nykyisen muodon. Kansiot löytyvät vain haulla, ja
  esikatselua ei ole.
- *Kansiopuu* näyttää kansiot heti, ja muutetut ovat yhden painalluksen
  takana. Tarvitsee hostilta kansion sisällön isossa työtilassa (alla).
  Esikatselua ei ole.
- *Välilehdet* säilyttää valitsimen kokonaan esikatselua myöten. Lista on
  korkein, kaksi saraketta lyhentää polkuja, ja puhelimessa esikatselu jää
  pois.

### Suositus

**Kansiopuu.** Jari nimesi kansiot vaatimukseksi, ja vain tässä suunnassa ne
näkyvät ilman hakua. Kirjoitettu `@src/` toimii kuten Pi:n päätteessä.
Valintaruutu joka rivillä tekee usean valinnan löydettäväksi myös
puhelimessa, jossa ei ole Tabia. Muutetut-lista säilyy ylimpänä kansiona.
Hinta on, että muutetut tiedostot ovat yhden painalluksen takana ja
esikatselu jää pois. Jos esikatselua tarvitaan, sen voi lisätä työpöydälle
kuten Välilehdissä.

### Host-tiedot

Hakulista ja Välilehdet eivät tarvitse uutta: kansiot johdetaan daemonin
palauttamista poluista. Kansiopuu tarvitsee kansion suorat lapset ja
alikansioiden muutosmäärät myös silloin, kun työtilassa on yli 200
tiedostoa (daemon palauttaa nyt enintään 200 osumaa). Se on nykyisen
tiedostohaun laajennus, ei uusi tallennus.

### Kysymykset Jarille

1. Mitä Tiedosto näyttää avattaessa: kansiot ja ylimpänä *Muutetut*
   (`d2-kansiopuu-pitka-tiedosto`) vai tiedostolistan muutetut ensin kuten
   nyt (`d1-hakulista-pitka-tiedosto`)?
2. Tarvitaanko kentän listassa esikatselua (`d3-valilehdet-pitka-tiedosto`),
   vai riittääkö lista ilman sitä?
3. Usean valinta: näkyykö valintaruutu aina (`d2-kansiopuu-useampi`) vai
   ympyrä vasta valitulla rivillä ja hoverissa (`d1-hakulista-useampi`)?

### Todisteet

`evidence/kierros-2/`: jokaisesta suunnasta pitkä luonnos (Tiedosto,
Komennot, kirjoitettu `@`), kahden tiedoston merkintä, kansio ja lyhyt
luonnos 1440 vaaleana ja tummana sekä 390 vaaleana. 1440 vaaleana on
lisäksi `!`-komento, haetaan, ei saatu ja ei osumia, Kansiopuun
`muutetut` ja Välilehtien `komennot-valilehti`. Nyt-suunnasta on myös
nykyinen Ctrl/⌘+P-valitsin (`d0-nyt-valitsin`). Kuvat on otettu
kertoimella 2. `check.mjs` ajoi 400 tarkistuspistettä, ja konsoli oli
puhdas. Kyseessä on synteettinen komponenttilabra, jota ei ole ajettu
hostia vasten.

### Näyttäminen

```
node design-system/prototypes/rounds/2026-11-03-kentan-listat-2/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/kentan-listat-2/offline.html \
  --title "Kentän listat – kierros 2" \
  --idempotency-key "$(uuidgen)" --json
```

## Kierros 1: mihin lista avautuu

Kierros: `design-system/prototypes/rounds/2026-11-03-kentan-listat/`.
Suunnat olivat Nyt (koko kentän yläpuolelle), Napin luona, Kentän sisällä ja
Napit ylhäällä. Pitkällä luonnoksella nykyisen listan alareuna oli 230 px
(työpöytä) tai 189 px (puhelin) napin yläpuolella, ja suunnissa 1–3 enintään
12 px. Jari valitsi 3.11. *Kentän sisällä*. Kuvat ovat hakemistossa
`evidence/` (`d0`–`d3`, `gaps.json`).
