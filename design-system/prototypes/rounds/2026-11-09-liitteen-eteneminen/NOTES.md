# Liitteen eteneminen – kierros 1

Issue `proto-attachment-upload-progress`. Suunnat, host-tiedot, päätökset
ja kysymykset ovat issuen `result.md`:ssä.

`forkComposer.tsx` on tuotannon `Composer` kopioituna ensin sellaisenaan,
joten sen diff seuraavaan commitiin on suuntien speksi. `upload.ts` on
yhteinen XHR-lähetys ja sanasto, `progress.tsx` kolme esitystä, yhteinen
varoitus ja odottavan lähetyksen rivi. `round.tsx` simuloi verkon sivun
omalla kellolla: XHR:n (suunnat) ja `fetch`in (Nyt) korvikkeet lähettävät
valitulla nopeudella. `?pause=<ms>` pysäyttää kellon, `?warp=<n>` nopeuttaa
sitä ja `?case=<tapaus>` valitsee oikean paneelin tapauksen.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-09-liitteen-eteneminen/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 550 \
  node design-system/prototypes/rounds/2026-11-09-liitteen-eteneminen/check.mjs \
  design-system/prototypes/dist/liitteen-eteneminen/offline.html <kuvahakemisto>
```

`web/node_modules` tarvitaan lukitiedoston mukaisena (`npm ci --prefix web`).
Tarkistus: 170 tarkistusta, konsoli puhdas.
