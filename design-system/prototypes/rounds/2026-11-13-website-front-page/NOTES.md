# Verkkosivun etusivu uudessa ilmeessä – kierros 1

Issue `proto-website-front-page-brand`. Suunnat, suositus ja kysymykset ovat
issuen `result.md`:ssä.

Kierros on itsenäinen staattinen sivu eikä Astro-rakennus. Syy: kolme
sommittelua valitsimen takana ja teeman vaihto eivät mahdu Starlightin
`splash`-pohjaan ilman, että `website/`-hakemistoa muutetaan, ja kierros ei
saa muuttaa sitä. Sivun teksti ei silti ole kopio: `build.mjs` lukee
nykyisen etusivun tekstiolion (molemmat kielet) suoraan
`website/src/components/Landing.astro`-tiedostosta, joten väitteet ovat
samat kuin livesivulla. Ainoa uusi teksti on suunnan 3 tilarivien
selitykset (`round.js`:n `UI.states`), ja jokainen niistä toistaa väitteen,
jonka sivu jo tekee (tagline, kortit 3 ja 4, `sameWork`).

`brand.css` on issuen `brand-themes-and-state-mark` kaksi CSS-lohkoa
muuttamattomina (teemat ja merkki); `check.mjs` vertaa sitä issueen niin
kauan kuin issue on puussa. Muut tokenit (fontit, välit) tulevat
`../../../tokens/`-hakemistosta. Linkit osoittavat livesivulle, jotta
offline-sivun linkit toimivat. Valitsin on `lib/picker.css` ja
`lib/picker.js` sellaisinaan; ainoa ohitus on `white-space: nowrap`, jotta
nimet eivät rivity 390 px:ssä.

`?v=1..3`, `?lang=fi` ja `?theme=light|dark|contrast|system` valitsevat
alkutilan. Ilman `theme`-parametria suunnat 1 ja 3 seuraavat järjestelmää
(`prefers-contrast: more` valitsee Korkean kontrastin), suunta 2 on Yö.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-13-website-front-page/build.mjs <out>
PROTO_WEB=<web-hakemisto, jossa node_modules> timeout 500 \
  node design-system/prototypes/rounds/2026-11-13-website-front-page/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

Tarkistus: 166 tarkistusta, konsoli puhdas. Se mittaa jokaisen tekstin
kontrastin omaa taustaansa vasten (4,5:1, Korkeassa kontrastissa 7:1)
kaikissa suunnissa ja teemoissa, ja katsoo, että intro ja työskentely
liikkuvat, intro soi kerran ja liikkeen vähennys pysäyttää kaiken.
