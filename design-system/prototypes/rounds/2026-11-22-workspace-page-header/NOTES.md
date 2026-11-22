# Työtilan sivun yläosa – yksi kierros

Issue `workspace-page-header-round` (Jari 22.11.2026). Koko työtilan
etusivun yläosa yhtenä alueena: otsikko ja polku, toiminnot (kopioi,
GitHub, arkistoi, poista, uusi worktree, uusi keskustelu) sekä
nauhakierrosten Kuvake / Nimi / Ääni.

Akseli: **missä työtilan tunnistetiedot näkyvät ja muuttuvat.**

- **A Otsikko**: otsikko on editori. Kuvake on tuotannon
  `WorkspaceIconPicker` sellaisenaan (kynämerkki), nimi muuttuu paikallaan
  otsikosta, polun vieressä on kopiointi ja Ääni on siru polun rivillä.
  Laatat poistuvat.
- **B Asetusrivi**: otsikko ja toiminnot kuten nyt (otsikon kuvake vain kuva),
  laattojen tilalla yksi matala rivi kolmea nimettyä sirua. Nimi-siru muuttaa
  otsikon kentäksi.
- **C Laatat**: laatat ovat otsikko. Nimen laatassa on h1 ja polku
  kopiointeineen, Kuvake ja Ääni sen vierellä. Toiminnot ovat laattojen alla
  rivinä: Uusi keskustelu ja Uusi worktree sanoin, siivoustoiminnot ikoneina
  oikealla. Puhelimessa Nimi saa oman rivin ja Kuvake ja Ääni puolikkaat.

Nimi muokataan kaikissa paikallaan (21.11. B Paikallaan): Enter ja muualle
klikkaus tallentavat, Esc peruu, tyhjä nimi palauttaa kansion nimen. Äänen
ponnahdus on tässä lyhyt lista; tuotannon valitsin pysyy ennallaan.
Otsikon alla oleva sivu on himmennetty sijainen, sama kaikissa suunnissa.

Tuotannon palat: `AppShell`, sivupalkki, `WorkspaceIcon`,
`WorkspaceIconPicker`, `SoundEmblem`, `ControlButton`, `Icon` ja tuotannon
tekstit. Tiedot ovat keksittyjä. Katselmointipalkki: Tilanne (`oletus`,
`oma`, `pitka`, `arkistoitu`, `kuvake`, `nimi`, `aani`) ja teema; `?s=`,
`?theme=` ja `?v=` valitsevat alkutilan.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-22-workspace-page-header/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1200 \
  node design-system/prototypes/rounds/2026-11-22-workspace-page-header/check.mjs \
  design-system/prototypes/dist/workspace-page-header/offline.html <kuvahakemisto> [--quick]
```

Rakennus kirjoittaa `design-system/prototypes/dist/workspace-page-header/`:een
`offline.html`:n (fontit upotettuina) ja `index.html`:n (ilman fontteja).
`check.mjs`:n alku kertoo, mitä se tarkistaa; se kirjoittaa myös
`heights.json`:n, otsikkoalueen korkeuden suunnittain.
