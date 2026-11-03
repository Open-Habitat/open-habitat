# Kentän listat – kierros 2

Issue `proto-composer-popover-placement`. Jari valitsi kierroksella 1
*Kentän sisällä* (3.11.): lista avautuu kenttälaatikon sisään tekstin ja
nappirivin väliin, ja pitkä teksti tiivistyy listan ajaksi kursorin kahdeksi
riviksi. Tämä kierros kokeilee, miten lista toimii, kun siinä on kaikki
nykyisten listojen toiminnot eikä missään avaudu välidialogia.

Akseli: miten koko valikoima (haku, kansiot, usean valinta, muutetut,
esikatselu) järjestyy kentän sisäiseen listaan.

0. **Nyt**: lista avautuu kentän yläpuolelle; useamman tiedoston valinta, muutetut ja esikatselu ovat vain Ctrl/⌘+P-valitsimessa koko näkymän päällä.
1. **Hakulista**: yksi sarake kuten nyt, mutta kentän sisällä; kansiot tulevat hakuun riveinä ja rajaavat haun, ympyrä merkitsee useamman, Muutetut on siru.
2. **Kansiopuu**: lista selaa kansioita polkurivillä (aurinkokello › src); Muutetut on ensimmäinen kansio, valintaruutu joka rivillä, haku koko kansiosta.
3. **Välilehdet**: Ctrl/⌘+P-valitsin siirtyy kenttään: Tiedostot · Muutetut · Komennot ja esikatselu listan vieressä.

Suositus: **Kansiopuu**.

Oletusnäkymä on pitkä luonnos, jossa *Tiedosto* on auki napista, koska
kansiot ja usean valinta näkyvät tiedostolistassa.

## Mitä nyt on (lähtötilanne)

Luettu tuotannon koodista (`Composer.tsx`, `ChoiceList.tsx`, `Palette.tsx`,
`completion.ts`, daemonin `workspace_composer_files_linux.go`):

- **Kirjoitettu `/` tai `@`** avaa listan kursorin kohdalle. Kohdistus jää
  tekstiin, ja kirjoitettu sana on haku. Nuolet liikkuvat, Enter ja Tab
  lisäävät (Tab ylimmän), Esc sulkee ja teksti jää. Keskellä riviä `/` on
  maininta: mitään ei ole valittu, joten Enter lähettää viestin.
- **Nappi** (*Komennot*, *Tiedosto*) avaa listan, jossa on oma hakurivi, ja
  kohdistus siirtyy siihen. Komento lisätään viestin alkuun, ja se korvaa
  alussa jo olevan komennon. Tiedosto lisätään kursorin kohtaan muodossa
  `@polku`. Esc palauttaa kohdistuksen tekstiin samaan kohtaan, ja painallus
  komposerin ulkopuolelle sulkee listan.
- **Ctrl/⌘+P** avaa valitsimen koko näkymän päälle. Siinä on välilehdet
  Tiedostot, Muutetut ja Komennot sekä esikatselu (muutetusta tiedostosta
  diff, muuten alku). Tab merkitsee useamman tiedoston, ja Enter lisää ne.
  Usean valinta, Muutetut ja esikatselu ovat vain tässä dialogissa.
- **Kansioita ei ole riveinä.** Tiedostolista on polkuja (enintään 200,
  muutetut ensin), ja kansio näkyy polun himmeänä alkuna. Haku `src/`
  löytää kansion tiedostot sumealla haulla.
- **`!`-komennossa** tiedosto lisätään komentoon pelkkänä polkuna, tarvittaessa
  lainausmerkeissä, eikä Komennot-nappia ole.
- **Tilat**: *Haetaan tiedostoja…* sykkivän pisteen kanssa, *Tiedostolistaa
  ei saatu juuri nyt.*, *Agentin komentoja ei saatu. Kirjoita komento itse.* ja
  *Ei osumia haulle “…”.*
- *Liitä* avaa jo suoraan laitteen tiedostovalitsimen. Yhden vaihtoehdon
  valikko poistui 2.11. (`attach-menu-single-option`). Tämä on se
  yksinapinen välidialogi, jota Jari tarkoitti.

## Mikä on kaikissa kolmessa samaa

- Lista on kenttälaatikon osa, ei leijuva: ei varjoa, ei peitä tekstiä
  eikä keskustelua. Pitkä teksti tiivistyy kursorin kahdeksi riviksi, ja
  ylempi teksti häivytetään. Sulkeminen palauttaa kentän korkeuden.
  Lyhyttä tekstiä ei tiivistetä.
- **Ei välidialogia.** Napit avaavat listan suoraan. Ctrl/⌘+P avaa saman
  listan kentän sisään hakurivin kanssa, ja kirjoitettu `@sana` siirtyy
  hakuun (kuten nyt valitsimeen). Valitsindialogia koko näkymän päällä ei
  enää ole. Liitä avaa laitteen tiedostovalitsimen.
- **Usean valinta kaikissa listoissa.** Napin listassa Tab merkitsee ja
  siirtyy seuraavaan riviin. Hiirellä ja sormella merkitään rivin alun
  ympyrästä tai ruudusta. Kun jotain on merkitty, alas tulee rivi
  *2 valittu · Tyhjennä · Lisää 2 polkua*, ja Enter lisää kaikki
  merkintäjärjestyksessä (`@a @b `). Kun jotain on merkitty, painallus
  riviin merkitsee sen eikä lisää heti. Kirjoitetussa `@`-listassa Tab
  täydentää ylimmän kuten nyt ja Pi:n päätteessä. Useamman saa sieltä
  Ctrl/⌘+P:llä, joka vie kirjoitetun sanan mukanaan.
- **Kansiot.** Kansion valinta ei lisää sitä tekstiin vaan avaa sen.
  Kirjoitetussa `@`-listassa se täydentää sanan muotoon `@src/astro/`, ja
  lista jatkuu kansion sisältä, kuten Pi:n päätteessä. Kansion voi lisätä
  tekstiin (`@src/astro/ `) merkitsemällä sen.
- **Lisäys ennallaan.** Komento napista menee viestin alkuun ja korvaa
  aiemman. Kirjoitettu komento korvaa sanan, ja keskellä riviä se on
  maininta. Tiedosto menee kursorin kohtaan muodossa `@polku `, ja jos
  edellinen merkki ei ole väli, eteen tulee väli. `!`-komennossa se menee
  pelkkänä polkuna.
- **Kohdistus ja Esc.** Napista avatussa listassa kohdistus on haussa
  (puhelimessa näppäimistö nousee, kuten nyt). Esc sulkee listan ja
  palauttaa kohdistuksen tekstiin samaan kursorin kohtaan. Kirjoitetussa
  listassa kohdistus pysyy tekstissä, ja Esc sulkee listan mutta jättää
  tekstin. Toinen Esc tekee sen, mitä Esc kentässä nyt tekee (pysäyttää
  työn). Painallus näkyviin tekstiriveihin sulkee napin listan ja vie
  kursorin painettuun kohtaan. Samoin toimii painallus komposerin
  ulkopuolelle ja saman napin painallus uudelleen. Toinen nappi vaihtaa
  listan paikallaan.
- **Tilat** ovat tuotannon tekstit ja samassa paikassa: haetaan, ei saatu ja
  ei osumia. Sivun yläreunan *Lista*-valinta näyttää hitaan ja epäonnistuneen
  haun.

## Mitä kukin päättää

- **Hakulista** pitää nykyisen listan muodon. Kansiot tulevat hakuun
  *Kansiot*-ryhmänä osumien alle (enintään kolme). Kansion valinta tekee
  siitä hakurivin rajauksen `src/astro/ ×`, ja Backspace tyhjässä haussa
  poistaa sen. *Muutetut* on siru otsikkorivillä. Merkintäympyrä näkyy
  valitulla rivillä, hoverissa ja kaikilla riveillä, kun jotain on merkitty.
  Puhelimessa se näkyy aina. Esikatselua ei ole. Ctrl/⌘+P listassa vaihtaa
  tiedostoista komentoihin.
- **Kansiopuu** näyttää ilman hakua kansion sisällön: ensin *Muutetut*
  virtuaalikansiona (nykyisen Muutetut-välilehden lista), sitten alikansiot,
  joissa on muutettujen tiedostojen määrä, ja sitten tiedostot. Polkurivi
  `aurinkokello › src › astro` on klikattava, → avaa kansion ja ← tai
  Backspace tyhjässä haussa menee ylös. Haku etsii koko nykyisestä
  kansiosta. Kirjoitettu `@src/as` luetaan polkuna: kansio `src/` ja haku
  `as`. Valintaruutu näkyy joka rivillä. Komennot ovat ryhmissä Taidot,
  Pohjat ja Laajennukset. Esikatselua ei ole.
- **Välilehdet** tuo valitsimen sellaisenaan kenttään: välilehdet Tiedostot,
  Muutetut ja Komennot, lista ja työpöydällä esikatselu oikealla. Puhelimessa
  esikatselu jää pois kuten nykyisessä valitsimessa. Kansion valinta
  kirjoittaa sen hakuun (`src/astro/`), ja Ctrl/⌘+P vaihtaa välilehteä.
  Lista on korkein (320 px), ja kahden sarakkeen takia polut katkeavat
  aiemmin.

## Suositus

**Kansiopuu.** Jari nimesi kansiot vaatimukseksi, ja vain tässä suunnassa
kansiot näkyvät ilman, että niitä pitää osata hakea. Kirjoitettu `@src/`
toimii kuten Pi:n päätteessä, joten sama tapa käy kentässä ja päätteessä.
Valintaruutu joka rivillä tekee usean valinnan löydettäväksi myös
puhelimessa, jossa Tab-näppäintä ei ole. Nykyinen Muutetut-lista säilyy
ylimpänä kansiona, eikä sitä varten tarvita sirua tai välilehteä. Hinta
on, että avattaessa näkyvät kansiot eivätkä muutetut tiedostot suoraan:
yksi painallus (*Muutetut*) tai kirjoitettu sana lisää. Esikatselu jää pois.
Se on vain Välilehdet-suunnassa, ja jos sitä tarvitaan, sen voi lisätä
Kansiopuuhun työpöydälle samalla tavalla kuin Välilehdissä.

## Host-tiedot

Suunnat 1 ja 3 eivät tarvitse uutta: kansiot johdetaan daemonin palauttamista
poluista. Kansiopuu tarvitsee kansion sisällön silloinkin, kun työtilassa on
yli 200 tiedostoa (daemon palauttaa nyt enintään 200 osumaa, muutetut ensin).
Tämä onnistuisi daemonin nykyisellä tiedostohaulla, kun haulle annetaan
kansio: kansion suorat lapset ja kunkin alikansion muutosten määrä. Kyse on
lukurajapinnan laajennuksesta, ei uudesta tallennuksesta. Prototyypissä
luettelo on synteettinen ja suodatetaan selaimessa samalla sumealla haulla
kuin daemonissa.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-03-kentan-listat-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-03-kentan-listat-2/check.mjs \
  design-system/prototypes/dist/kentan-listat-2/offline.html <kuvahakemisto>
```

`check.mjs` käy läpi jokaisen suunnan vaaleana ja tummana 1440 ja 390 px
leveydellä. Puhelimessa merkintä tehdään napautuksin ja lisäys *Lisää*-napista.
Tarkistuksessa ovat oletusnäkymä, kahden tiedoston merkintä ja lisäys,
kansiot (rajaus, polkurivi ylös ja alas, Muutetut, välilehdet), Esc takaisin
tekstiin samaan kohtaan ja Komennot viestin alkuun. Lisäksi se tarkistaa
kirjoitetun `@`-listan ja Tabin, keskellä riviä olevan `/`-merkin ilman
valintaa, painalluksen tekstiin ja ulkopuolelle, lyhyen luonnoksen,
`!`-komennon polun sekä hitaan, epäonnistuneen ja tyhjän haun. Jokaisessa
suunnassa se tarkistaa, että lista on tekstin alla ja nappirivin yllä
kokonaan näkyvissä. Tarkistuspisteitä on 400, konsoli on puhdas ja kuvat
otetaan kertoimella 2. `index.html` on sama ilman upotettuja fontteja
glasspadia varten.

Nyt on tuotannon `Composer` muuttamattomana. Suunnat 1–3 ovat kierroksen
`infield.tsx`, joka käyttää tuotannon merkintää ja tyylejä (`.ah-cbox`,
`.ah-crow`, `.ah-choice-*`, `.ah-pal-*`), komponentteja (`Icon`, `GitBadge`,
`AttachmentMenu`) ja tekstisääntöjä (`completion.ts`: `caretToken`,
`fuzzyScore`, `fileInsertion`, `withLeadingCommand`). Toteutus kuuluisi
`Composer.tsx`:n `Open`-tilaan (merkinnät ja kansio myös napin listaan,
palette-tila pois), `ChoiceList.tsx`:n riveihin (kansiorivi ja
merkintäruutu) ja `composer.css`:ään. Tekstit menisivät `composer`- ja
`choiceList`-katalogeihin molemmilla kielillä.
