# Tulos

Kaikki työvaiheen merkit (työkalut, ajattelu ja muut lohkot) olivat 7 px
aikajanan vasemmalla puolella, myös onnistuneiden työkalujen vihreät
neliöt. Punainen neliö vain erottui parhaiten. Merkin paikka oli kiinteä
`-26px`, joka ei vastannut turn-ruudukon saraketta (18 px + 8 px väli).
Paikka lasketaan nyt ruudukon mitoista, joten merkki on samassa kohdassa
kuin vastausten pallot.

Lisäksi työvaiheen aliruudukko korvasi oman sarakevälinsä rivivälillä
(`gap`), mikä siirsi työkalukortteja 1 px vastauksia vasemmalle. Nyt
asetetaan vain `row-gap`.

Kuva: `evidence/work-nodes-before-after.avif` (DSF 2). Selaintesti
`web/tests/turn-work-row.spec.ts` tarkistaa, että onnistuneen ja
epäonnistuneen työkalun merkit ovat aikajanan keskellä (alle 0,5 px).
Vanhalla CSS:llä testi kaatuu 8 px:n poikkeamaan.
