# ⌘K-lista: miten tulokset esitetään – kierros 3

Issue `proto-rail-keyboard-navigation`. Jari valitsi kierrokselta 2 kapean
listan (1 Lista), mutta tulosten esitys hämmensi: keskustelut ylhäällä ja
viestiosumat erillisinä listoina alla. Tämä kierros vaihtaa vain sen, mitä
listan yksi rivi on ja minne loput osumat menevät. Näppäin (⌘K / Ctrl+K,
`/` tekstikenttien ulkopuolella), haku ja hyppy viestiin ovat kierroksen 2
(`../2026-11-15-switcher-search/NOTES.md`), ja haun täsmäys on sen koodia.

- **1 Keskustelut**: yksi järjestetty lista. Rivi on keskustelu, ja sen
  toisella rivillä on keskustelun paras osuva lause korostettuna. Nimiosuma
  on samanlainen rivi ja nousee ylimmäksi, ei omaan osioonsa. Muut osumat
  ovat määränä (”+4 osumaa →”); → avaa ne sisennettyinä rivin alle ja ←
  sulkee. Enter avaa keskustelun juuri näkyvän lauseen kohdalta.
- **2 Viestit**: rivi on yksi osunut viesti, ja keskustelun nimi on pienenä
  tunnisteena sen alla. Keskustelu saa oman rivinsä vain, kun haku osuu sen
  nimeen (merkitty ”nimessä”). → näyttää viestin edellisen viestin kanssa.
- **3 Kaksi vaihetta**: kirjoittaessa lista näyttää vain keskustelut ja
  osumien määrän. → avaa keskustelun osumat omaksi listakseen (”← Keskustelut”
  -otsake), ← palaa samaan keskusteluun. Enter ensimmäisessä vaiheessa avaa
  uusimman osuman kohdalta.

Kaikissa sama: tyhjä haku näyttää viimeksi avatut edellinen valittuna
(⌘K Enter vaihtaa kahden välillä), ”Jatka hakua” palauttaa edellisen haun,
ja tyhjä tulos kertoo, mitä kokeilla. → ja ← kuuluvat kentän kursorille,
ellei listassa ole avattavaa: → vain tekstin lopussa, ← vain kun jotain on
auki. Kosketuksella määrä (1) ja ”N osumaa ›” (3) ovat painikkeita.

Järjestys: nimiosumat ensin, arkistoidut viimeisinä kummassakin ryhmässä,
sitten uusimman osuman mukaan ja osumien määrän mukaan. Keskustelun paras
lause on uusin osuma, jossa haun sana alkaa sanan alusta; muuten uusin.

Katselmoinnin palkin ”Tilanne” vaihtaa tapausten välillä: tyhjä haku,
monta osumaa (*kartta* / *map*), nimiosuma (*sanasto* / *glossary*) ja ei
osumia (*laskutus* / *invoice*). `?example=empty|many|title|none`,
`?theme=`, `?lang=en` ja `?kbd=mac|pc` valitsevat alkutilan.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-15-switcher-list/build.mjs <kohde>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 500 \
  node design-system/prototypes/rounds/2026-11-15-switcher-list/check.mjs \
  <kohde>/offline.html <kuvahakemisto>
```

`web/node_modules` tarvitaan lukitiedoston mukaisena (`npm ci --prefix web`).
