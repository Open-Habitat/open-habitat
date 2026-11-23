# Työtilan sivun yläosa – kierros 3 (C2:n toimintoryhmä)

Issue `workspace-page-header-round` (Jari 23.11.2026: C2 Toiminnot sivulla
jatkoon; myös kolme muuta toimintoa painikkeiksi, pieninä ja ilman tekstiä;
kokeile toista puolta; näytä, miten pieniä painikkeita yleensä kohdellaan).
Laatat ovat kaikissa suunnissa kierroksen 2 C2:n laatat; nimi muokataan
paikallaan kuten ennenkin. Vaihtelee toimintoryhmän paikka ja ryhmittely:

- **C2a Oikealla**: ryhmä laattojen oikealla; Uusi keskustelu ja Uusi
  worktree sanoin, GitHub, Arkistoi ja Poista pieninä painikkeina alla.
- **C2b Vasemmalla**: sama ryhmä ennen Kuvaketta; puhelimessa rivi
  peilattuna, Uusi keskustelu oikeassa reunassa.
- **C2c Yksi ryhmä**: vain Uusi keskustelu sanoin, muut neljä (myös Uusi
  worktree) pieninä painikkeina yhdellä rivillä sen alla.

Katselmointipalkin **Pienet painikkeet** avaa sääntöpaneelin (koko ja
osuma-alue, nimi ja vihje, estetty, ryhmä ja järjestys, vaihtava painike)
ja tilataulukon Päivä- ja Yö-teemassa (lepo, hover, fokus, painettu, ei
käytössä). `?rules=1` avaa sen alussa. Tilanteet: `oletus`, `oma`, `pitka`,
`arkistoitu`, `eiorigin`, `lukittu`, `kuvake`, `nimi`, `aani`; `?s=`,
`?theme=` ja `?v=` valitsevat alkutilan.

Sivu toimii Habitat-näkymänä: ei iframeja, ei navigointia, ei verkkoa.
Puhelinasettelu näkyy kapeassa ikkunassa tai puhelimella; sääntöpaneeli
näyttää puhelinkoon (40 px, osuma 44 px) myös työpöydällä.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-23-workspace-page-header-3/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1500 \
  node design-system/prototypes/rounds/2026-11-23-workspace-page-header-3/check.mjs \
  design-system/prototypes/dist/workspace-page-header-3/offline.html <kuvahakemisto> [--quick]
```

`check.mjs`:n alku kertoo, mitä se tarkistaa.
