# Vuoron muutokset – kierros 1

Issue `proto-turn-changes`. Suunnat, host-tiedot, päätökset ja kysymykset
ovat issuen `result.md`:ssä.

Sivu on tuotannon kehys (`AppShell`, `WorkspaceRail`, `AgentHeader`,
`ConversationFrame`, `ConversationTimeline`, `Composer`) ja tuotannon vuoro
(`AgentTurn`, `PiToolUse`, `FileToolCard`, `BashToolCard`) muuttamattomina.
Nyt on pelkkä tuotanto. Suunnat lisäävät saman vuoron perään tai viereen
yhden asian (`changes.tsx`). Jokainen diffi on tuotannon `FileToolCard`:
yksi muokkaus Pi:n edit-argumentteina kuten työkalukortissa, ja vuoron
nettomuutos unified diffinä, jonka kortti jo lukee.

`turn.ts` on keksitty vuoro: verkkosovellus `retkiopas`, kahdeksan
tiedostoa (uusi, kolmesti muokattu, komennolla poistettu, komennolla tehty
binääri, pieniä muokkauksia), yhden pienen muokkauksen vuoro ja kesken oleva
vuoro. `text.ts` on kierroksen sanasto suomeksi ja englanniksi. Keskustelun
tekstit ovat natiivia sisältöä eivätkä käänny.

Kesken oleva vuoro soi sivun omalla kellolla: se alkaa kohdasta 1:02 ja
pysähtyy 1:41, jolloin vuoro on yhä käynnissä. *Jatka* soittaa sen loppuun.
`?case=monta|pieni|kesken` valitsee vuoron, `?at=<ms>` pysäyttää kellon
siihen kohtaan ja `?warp=<n>` nopeuttaa sitä.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-10-vuoron-muutokset/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 550 \
  node design-system/prototypes/rounds/2026-11-10-vuoron-muutokset/check.mjs \
  design-system/prototypes/dist/vuoron-muutokset/offline.html <kuvahakemisto>
```

`web/node_modules` tarvitaan lukitiedoston mukaisena (`npm ci --prefix web`).
`offline.html` on yksi itsenäinen tiedosto fontteineen; `index.html` on sama
ilman upotettuja fontteja glasspadia varten. Tarkistus: 192 tarkistusta,
konsoli puhdas.
