# Työtilan sivun yläosa – kierros 2 (C:n muunnelmat)

Issue `workspace-page-header-round` (Jari 23.11.2026: C Laatat valittu,
yksi kierros lisää vain C:n muunnelmilla). Lähtökohta on kierroksen
`2026-11-22-workspace-page-header` C. Kaikissa muunnelmissa Kuvake, Nimi ja
Ääni ovat itse otsikko, Nimen laatassa on h1 ja polku kopiointeineen, ja
nimi muokataan paikallaan (Enter ja muualle klikkaus tallentavat, Esc
peruu, tyhjä nimi palauttaa kansion nimen).

- **C1 Matala**: laatat 88 px, Kuvakkeen ja Äänen kuva arvonsa vieressä;
  toiminnot nimettynä rivinä laattojen alla.
- **C2 Toiminnot sivulla**: laatat kierroksen 1 kokoisina (120 px), ja
  toiminnot sarakkeena niiden oikealla puolella: Uusi keskustelu, Uusi
  worktree ja siivoustoimintojen ikonit. Puhelimessa sarake palaa riviksi.
- **C3 Sanat näkyvissä**: nimi isompana ja painavampana (30 px, 700), ja
  jokaisen laatan otsikkorivillä on sen teko sanana (Vaihda, Muokkaa).

Tuotannon palat: `AppShell`, sivupalkki, `WorkspaceIcon`,
`WorkspaceIconPicker`, `SoundEmblem`, `ControlButton`, `Icon` ja tuotannon
tekstit. Tiedot ovat keksittyjä. Katselmointipalkki: Tilanne (`oletus`,
`oma`, `pitka`, `arkistoitu`, `kuvake`, `nimi`, `aani`) ja teema; `?s=`,
`?theme=` ja `?v=` valitsevat alkutilan.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-23-workspace-page-header-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1500 \
  node design-system/prototypes/rounds/2026-11-23-workspace-page-header-2/check.mjs \
  design-system/prototypes/dist/workspace-page-header-2/offline.html <kuvahakemisto> [--quick]
```

Rakennus kirjoittaa `design-system/prototypes/dist/workspace-page-header-2/`:een
`offline.html`:n (fontit upotettuina) ja `index.html`:n (ilman fontteja).
`check.mjs`:n alku kertoo, mitä se tarkistaa; se kirjoittaa myös
`heights.json`:n, otsikkoalueen korkeuden muunnelmittain.
