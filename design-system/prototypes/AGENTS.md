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
  `picker.js` ovat `/prototype`-taidon `PICKER.md` sanatarkasti; vain
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
  Tiivis tiheys. `quiet.js` ja `quiet.css` ovat valittu hiljainen työ:
  säikeet kiinni, inforivi ja sen alussa Näytä työ -painike, joka pysyy
  osoittimen alla, sekä tilivalikon "Agentin työ". Kierros, joka piirtää
  omansa, vie `account = false`, `density = false` tai `quiet = false`.
  `R.startOpen = false` saa elävän vuoron alkamaan työ piilossa.
  `strip.js` ja `strip.css` ovat valittu taustatyön palkki (Merkit,
  kierros `2026-10-16-taustatyo-riff`): spinoffien ja prosessien merkit
  kentän yllä, paneeli lajeittain ja prosessin ikkuna. Ne tulevat mukaan vain,
  kun kierros vie `strip = true`; `STRIP.B` on tarinan tila ja
  `STRIP.reset()` palauttaa sen.
- `merkki/` on Open Habitatin merkin parametrinen peti, ei kierros: `peti.js`
  piirtää kaksi lomittuvaa kaarta ja auringon nimetyistä parametreista siistiksi
  SVG:ksi (kaaret ja Bézier-käyrät, sauma maskina), `vedos.svg` on Jarin
  vedos vertailukuvaksi, ja oletusarvot on sovitettu siihen. `node
  merkki/build.mjs` rakentaa `dist/merkki-peti.html`:n fontteineen;
  `merkki/build.mjs`:n alku kertoo, miksi kolme fonttia haetaan eikä niitä
  commitoida.
- `lib/vendor/hljs.js` on highlight.js tuotannon kielillä, ja `output.js`
  korostaa laatikoiden koodin `--ah-syntax-*`-tokeneilla kuten tuotanto
  (ADR 0015). `node vendor-hljs.mjs` tekee tiedoston uudelleen, kun tuotannon
  kielilista (`web/src/components/SyntaxCode.tsx`) muuttuu.
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
  esimerkkinä. Muut kierrokset ovat kierrostyön ajan omissa hakemistoissaan
  ja poistuvat, kun valittu suunta on toteutettu; hylätyt suunnat löytyvät
  sen jälkeen Git-historiasta (`scripts/from-history.sh
  design-system/prototypes/rounds/<kierros>`).

## Rakentaminen ja näyttäminen

```
node build.mjs rounds/<kierros>                     # dist/<kierros>.html
node build.mjs rounds/<kierros> --out ../../issues/<slug>/prototype.html
node build.mjs agentin-vuoro --out "../drafts/Agentin vuoro.proto.html"
```

Tulos on yksi itsenäinen HTML: tokenit `../tokens/`-hakemistosta fontit
`../fonts/`-hakemistosta upotettuina, kirjasto, kierroksen koodi ja
valitsin, kun suuntia on useampi kuin yksi. Myös tuotantokomponenteista omalla
`build.mjs`:llä rakennetut kierrokset käyttävät `lib/picker.css`:ää ja
`lib/picker.js`:n käyttäytymistä; oma rakennus ei ohita valitsinta eikä
`picker-check.mjs`:n tarkistusta. Yhden suunnan vedos ei ole vertailukierros. `dist/` ei ole versionhallinnassa.
Sivu avautuu suoraan selaimessa; sivustopalvelun tiukka CSP voi estää
upotetut fontit. Ennen näyttämistä sivu
tarkistetaan headless-Chromiumilla työpöytä- ja puhelinleveydessä
(`PLAYWRIGHT_BROWSERS_PATH=$PWD/.cache/ms-playwright`, Playwright
`web/node_modules`ista), vuorovaikutukset klikattuna ja konsoli puhtaana.
`check.mjs` tekee tämän: se käy jokaisen suunnan läpi vaaleana, tummana ja
puhelimessa, odottaa vuoron asettumisen, klikkaa annetut valitsimet ja
kirjoittaa kuvat omaan `dist/check-*`-hakemistoonsa (`--help`-tyyppinen ohje
on tiedoston alussa). Yksi `node`-kutsu ilman `rm`-komentoja ei kysy lupia.

## Kun suunta valitaan

Valitun suunnan säännöt ja piirtäjät siirretään `lib/`-tiedostoihin ilman
suuntaluokkaa, ja hylätyt jäävät kierroshakemistoon, kunnes toteutus on
laskeutunut ja kierros siirtyy historiaan. Siirrossa säilytetään
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
jotta hylätyt suunnat voi yhä avata niin kauan kuin kierros on puussa.

## Prototyyppiworker

Uusista ominaisuuksista tehdään prototyyppi ennen toteutusta, ja Jarin
hyväksymä toimiva prototyyppi on ominaisuuden speksi (Jari 15.10.2026).
Kierrokset tehdään omissa worktreeissään, jotta työtä koordinoivan istunnon
konteksti säästyy; Jari arvioi ne. Workerin kierros:

- Lue nykytila ennen suuntia: tuotannon näkymä labissa (`web/AGENTS.md`,
  `scripts/lab.sh`, `web/lab/session.mjs`; oma `OH_PORT_BASE`), sen
  komponenttikoodi, `../design.md` ja issueen kirjattu arkkitehtuurivedos.
  Kolme suuntaa yhdellä nimetyllä akselilla, sisältö samaa kaikissa.
- Kirjoita vain oma kierroshakemistosi `rounds/<pvm>-<nimi>/`. Kirjasto
  (`lib/`) on yhteinen ja muut workerit ajavat rinnakkain; jos kierros
  tarvitsee kirjastomuutoksen, tee se kierroksen omana ohituksena ja kirjaa
  ehdotus issueen.
- Älä lue rakennettua HTML:ää, `dist/`-hakemistoa, vedoksia tai
  `lib/vendor/`-tiedostoja kokonaan: ne ovat satoja kilotavuja. Käytä
  `grep`iä, `head`iä ja `check.mjs`:ää, ja katso vain muutama ruutukaappaus.
- Tarkista `check.mjs`:llä (vaalea, tumma, puhelin, vuorovaikutukset
  klikattuina, konsoli puhdas). Issueen talletettavat ruutukaappaukset
  ovat AVIF-kuvia (`issuectl doctor` varoittaa muista): muunna ne
  `python3 scripts/screenshots-to-avif.py issues/<slug>/evidence`, joka
  varmistaa jokaisen AVIFin ja poistaa vasta sitten juuri sen PNG:n.
  Älä tee samaa `convert … && rm`-komennoilla. Commitoi kierroshakemisto; `dist/` ei ole
  versionhallinnassa, joten raportoi rakennuskomento ja suuntien nimet.
- Kirjaa issueen `result.md`: akseli, suunnat, mitä kukin päättää, mitä
  host-tietoja näkymä olettaa, ja kysymykset Jarille.
