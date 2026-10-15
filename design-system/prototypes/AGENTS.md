# Prototyyppikirjasto

Tämä hakemisto on `/prototype`-kierrosten lähde keskustelunäkymälle. Kierros
näyttää Jarille kolme suuntaa yhdellä akselilla valitsimen takana; valittu
suunta siirtyy kirjastoon ja jäädytetään `../drafts/`-vedokseksi, jotta
seuraava kierros alkaa todellisuudesta eikä muistikuvasta. Kirjasto on
esityskielen kopio tokenien päällä, ei tuotantokomponentit: toteutuksen
vastaavuus vedokseen todennetaan labin vertailulla (`../process.md`).
Ensimmäiset kuusi kierrosta ajettiin yhdestä tiedostosta; se pilkottiin tähän
muotoon 12.10.2026, ja rakennettu vedos todettiin kuvavertailussa samaksi.

## Rakenne

- `lib/` on kirjasto, joka upotetaan jokaiseen sivuun samassa järjestyksessä
  kuin `build.mjs` sen lukee. `language.css` on esityskieli (kuplat, lanka,
  tilanauha, tuloste- ja komentolaatikot) ja `chrome.css` sivun kehys.
  `fixture.js` on sisältö: historia `CONVO` ja elävä vuoro `LIVE`, jonka
  `script()` soittaa tapahtumina. `turn.js` piirtää historian langat,
  `live.js` soittaa vuoron ja kokoaa valitun yhdistelmän (`threadR`,
  `withLive`), `output.js` piirtää tuloste- ja komentolaatikot, `pieces.js`,
  `icons.js` ja `markdown.js` ovat yhteisiä palasia ja `stage.js` näyttämön
  vieritys, teema, puhelinkehys ja klikkausten välitys. `picker.css` ja
  `picker.js` ovat `~/.claude/skills/prototype/PICKER.md` sanatarkasti; vain
  `stage`-muuttujan määrittely on jätetty pois, koska `stage.js` antaa sen.
  `replay.js` on yhden suunnan sivun johdotus ilman valitsinta.
  `app.js` ja `app.css` ovat sovelluskehys näyttämön ympärillä: sivupalkki,
  keskustelun yläpalkki ja niiden toiminnot. Ne tulevat mukaan, kun kierros
  vie `app = true`; suunnan `fn` on silloin `appView()`, ja kierros vaihtaa
  palan korvaamalla `APP.row`-, `APP.list`- tai `APP.actions`-hookin. `composer.js` ja
  `composer.css` ovat valittu alakerta (kenttä, Lähetä, Stop, jono); ne
  tulevat kehyksen mukana, ja kierros, joka piirtää oman kenttänsä, vie
  `composer = false`. `account.js` ja `account.css` ovat valittu sivupalkin
  tilivalikko ja työtilarivin `…`-valikko, ja `density.css` on valittu
  Tiivis tiheys. Kierros, joka piirtää omansa, vie `account = false` tai
  `density = false`. `R.startOpen = false` saa elävän vuoron alkamaan työ
  piilossa.
- `stage.js`:n seuranta katkeaa vain lukijan omasta vierityksestä (rulla,
  kosketus, näppäimet, vierityspalkki). Sisällön kutistuminen laskee myös
  `scrollTop`ia, joten kierros ei saa tulkita sitä lukijan teoksi.
- Valitsin, joka hakee ylöspäin attribuutilla, kuten `closest('[data-theme]')`,
  osuu myös sivun juureen, jolla on sama attribuutti. Dokumenttitason
  kuuntelija nielee silloin kaikki klikkaukset, joten valitsin rajataan
  omaan komponenttiinsa (`.p-theme [data-theme]`).
- Elävää riviä, jossa on painike, ei piirretä kokonaan uudelleen kellon
  takia: vaihtuva elementti hukkaa painallukset ja välkyttää korostusta.
  Päivitä vain muuttuva teksti.
- Kierros on hakemisto: `round.mjs` vie `title`-otsikon ja `variants`-listan
  (`name`, `axis`, `fn`), ja `round.css` ja `round.js` antavat kierroksen omat
  säännöt ja piirtofunktiot. Jokainen `fn` määritellään `round.js`:ssä ja
  palauttaa näyttämön HTML:n; `withLive(luokka, threadR(komento))` piirtää
  historian ja käynnistää vuoron, joten suunta, joka vaihtaa vain yhden palan,
  ohittaa sen piirtäjän ja käyttää muuten kirjastoa.
- `agentin-vuoro/` on kirjaston nykytila yhtenä suuntana: siitä rakennetaan
  `../drafts/Agentin vuoro.proto.html`. `rounds/` sisältää kierrokset;
  `rounds/2026-10-12-pitka-komento/` on kuudes kierros kierrostiedoston
  esimerkkinä, ja sen hylätyt suunnat elävät vain siellä.

## Rakentaminen ja näyttäminen

```
node build.mjs rounds/<kierros>                     # dist/<kierros>.html
node build.mjs rounds/<kierros> --out ../../issues/<slug>/prototype.html
node build.mjs agentin-vuoro --out "../drafts/Agentin vuoro.proto.html"
```

Tulos on yksi itsenäinen HTML: tokenit `../tokens/`-hakemistosta fontit
`../fonts/`-hakemistosta upotettuina, kirjasto, kierroksen koodi ja
valitsin, kun suuntia on useampi kuin yksi. `dist/` ei ole versionhallinnassa.
Sivu avataan Jarille `tw browser-open`illa, ja `glasspad publish` antaa saman
linkkinä; hosted-sivun CSP estää upotetut fontit. Ennen näyttämistä sivu
tarkistetaan headless-Chromiumilla työpöytä- ja puhelinleveydessä
(`PLAYWRIGHT_BROWSERS_PATH=$PWD/.cache/ms-playwright`, Playwright
`web/node_modules`ista), vuorovaikutukset klikattuna ja konsoli puhtaana.
`check.mjs` tekee tämän: se käy jokaisen suunnan läpi vaaleana, tummana ja
puhelimessa, odottaa vuoron asettumisen, klikkaa annetut valitsimet ja
kirjoittaa kuvat omaan `dist/check-*`-hakemistoonsa (`--help`-tyyppinen ohje
on tiedoston alussa). Yksi `node`-kutsu ilman `rm`-komentoja ei kysy lupia.

## Kun suunta valitaan

Valitun suunnan säännöt ja piirtäjät siirretään `lib/`-tiedostoihin ilman
suuntaluokkaa, ja hylätyt jäävät kierroshakemistoon. Siirrossa säilytetään
valitsimen tarkkuus: `lib/language.css`:n yleiset säännöt kuten
`.tool-body pre` voittavat paljaan luokan, joten siirretty sääntö tarvitsee
saman tarkkuuden kuin sillä oli suuntaluokan alla. Sen jälkeen
`agentin-vuoro` rakennetaan vedokseksi, ja kierroksen päätös kirjataan
omistavaan issueen ja `../design.md`:hen. Prototyypin omat tokenit
(`--ah-sunken`, `--ah-hover`) ovat `language.css`:n alussa, kunnes toteutus
vie ne `../tokens/`-hakemistoon.
Kirjastoon siirretty kierros määrittelee usein samoja nimiä kuin kirjasto
(`const`-nimet törmäävät eikä kierros enää rakennu). Kierroksen koodi
kääritään silloin omaan näkyvyysalueeseensa, `(() => { … window.v1 = … })()`,
jotta hylätyt suunnat voi yhä avata.
