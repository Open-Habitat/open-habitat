# Tulos

`web/tests/workspace-editor.spec.ts` odotti yhä, että sovelluksen sivupalkki
väistyy editorin avautuessa. `eb23bed9` muutti tämän tarkoituksella:
sivupalkki kapenee kuvakepalkiksi editorin viereen. Testi tarkistaa nyt, että
sivupalkki näkyy kapeana (`ah-rail-collapsed`) editorin vierellä ja palaa
leveäksi, kun editori suljetaan. Sarakeleveys- ja muut tarkistukset ennallaan.
Tuotteen käytös vastasi `eb23bed9`:n tarkoitusta, joten koodia ei muutettu.

`workspace-editor.spec.ts`: 9/9 läpi (`OH_BROWSER_WORKERS=2`,
`OH_PORT_BASE=9600`).

## Decisions for later review

- **Tarkistetaan myös paluu leveään palkkiin.** Vaihtoehto: pelkkä
  `toBeVisible` kuten ennen. Lisäsin tarkistuksen, koska editorikerran
  päättyessä palkin pitää palata ihmisen omaan valintaan, ja tämä testi
  avaa ja sulkee editorin muutenkin.
