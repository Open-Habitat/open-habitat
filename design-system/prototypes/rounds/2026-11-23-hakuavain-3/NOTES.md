# Verkkohaun avain – kierros 3

Issue `proto-web-search-key`. Suunnat, suositus, päätökset ja kysymykset ovat
issuen `result.md`:n Kierros 3 -osiossa.

Sivu on tuotannon kehys (`AppShell`, `WorkspaceRail`) ja koko tuotannon
`AccountSettings` muuttamattomana: ylläpitäjällä Palvelimen ylläpito ›
Integraatiot, henkilöllä Asetukset › Tiedot agenteille. Host on
`fetch`-sijainen, joka vastaa sopimusten esimerkeillä; naapurit ovat
realistiset (ylläpitäjällä useimmat palvelut tarjolla ja Microsoft ilman
sovelluksia, henkilöllä sähköposti, Dropbox ja Trello yhdistettyinä sekä
Google ja Microsoft lisättävinä). Hakuavaimen rivit, kortit ja ruudut on
koottu tuotannon palasista ja luokista (`PeopleRow`, `Menu`, `Modalish`,
`ig-card`, `ig-tile`) ja viety portaalilla tuotannon listaan (`useSlot`).
Avaimen toiminta on kierroksen 2 (saneluavaimen) toiminta.

`text.ts` on kierroksen sanasto suomeksi ja englanniksi.
`?view=admin|person`, `?s=<tilanne>` ja `?theme=dark` valitsevat alkutilan.
Avain, joka alkaa `huono` tai `bad`, epäonnistuu koehaussa. Muut vähintään
20 merkin avaimet kelpaavat.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-23-hakuavain-3/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 580 \
  node design-system/prototypes/rounds/2026-11-23-hakuavain-3/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

`web/node_modules` tarvitaan lukitiedoston mukaisena (`npm ci --prefix web`).
Ilman `<out>`-argumenttia tulos menee `design-system/prototypes/dist/hakuavain-3/`.
`offline.html` on yksi itsenäinen tiedosto fontteineen, `index.html` sama
ilman upotettuja fontteja glasspadia varten. Tarkistus: 382 tarkistusta,
konsoli puhdas. Kuvat `-page.png` ovat koko asetussivu vieritettynä auki.
