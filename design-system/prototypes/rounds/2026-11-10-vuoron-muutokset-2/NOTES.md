# Vuoron muutokset – kierros 2

Issue `proto-turn-changes`. Muunnelmat, host-tiedot, päätökset ja kysymykset
ovat issuen `result.md`:ssä.

Kierros yhdistää Jarin kierros 1:n valinnat: Yhteenvedon lista, kiinni
oletuksena kuten Katselmoinnin painike, ja Aikajanan tiedostokohtaiset
janat valinnaisen painikkeen takana. Kierros käyttää kierros 1:n hakemistosta
muuttamattomina sen vuorot (`turn.ts`), sanaston (`text.ts`, jonka päälle
tämän kierroksen `text.ts` lisää omat sanansa), diffin palat (`changes.tsx`:n
`FileDiff`, `Tags`, `Counts`, `FileName`) ja tyylit (`round.css`). Siksi
kierros 1 pysyy puussa niin kauan kuin tämä kierros on. Oma `changes.tsx`
on taitettava Muutokset-kortti ja aikajana ilman omaa korttiaan;
`round.tsx` on kierros 1:n sivu kolmella muunnelmalla.

`?case=monta|pieni|kesken`, `?at=<ms>` ja `?warp=<n>` toimivat kuten
kierros 1:ssä.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-10-vuoron-muutokset-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 550 \
  node design-system/prototypes/rounds/2026-11-10-vuoron-muutokset-2/check.mjs \
  design-system/prototypes/dist/vuoron-muutokset-2/offline.html <kuvahakemisto>
```

`web/node_modules` tarvitaan lukitiedoston mukaisena (`npm ci --prefix web`).
Tarkistus: 252 tarkistusta, konsoli puhdas.
