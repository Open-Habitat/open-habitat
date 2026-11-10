# Verkkohaun avain – kierros 1

Issue `proto-web-search-key`. Suunnat, host-tiedot, päätökset ja kysymykset
ovat issuen `result.md`:ssä.

Sivu on tuotannon kehys (`AppShell`, `WorkspaceRail`) ja koko tuotannon
`AccountSettings` Tekoäly-osiossaan muuttamattomana. Host on
`fetch`-sijainen, joka vastaa sopimusten mukaan (`pi/models`,
`pi/credentials`, `pi/claude-login`). Verkkohaun rivit ovat kierroksen omia,
mutta ne on koottu tuotannon palasista (`ControlButton`, `StatusMark`,
`Badge`, `LetterMark`, `Icon`, react-arian ikkuna) ja asetussivun luokista
(`s-row`, `s-marked`, `s-prov-opt`, `s-model-chips`, `s-editor`). Ne
viedään portaalilla oikealle paikalleen tuotannon sivulla:
`display: contents` -paikka odottaa tuotannon rivin ilmestymistä
(`useSlot`). Kukin suunta avautuu omalle rivilleen tuotannon
rivilinkin laskeutumisella (`routeRow`), joten ero näkyy oletusnäkymässä.

`text.ts` on kierroksen sanasto suomeksi ja englanniksi. Tuotannon rivit
seuraavat samaa kielivalintaa. `?s=<tilanne>` ja `?theme=dark` valitsevat
alkutilan. Avain, joka alkaa `huono` tai `bad`, torjutaan tallennuksessa
(koehaku epäonnistuu); muut vähintään 20 merkin avaimet kelpaavat.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-10-hakuavain/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 550 \
  node design-system/prototypes/rounds/2026-11-10-hakuavain/check.mjs \
  design-system/prototypes/dist/hakuavain/offline.html <kuvahakemisto>
```

`web/node_modules` tarvitaan lukitiedoston mukaisena (`npm ci --prefix web`).
`offline.html` on yksi itsenäinen tiedosto fontteineen; `index.html` on sama
ilman upotettuja fontteja glasspadia varten. Tarkistus: 286 tarkistusta,
konsoli puhdas.
