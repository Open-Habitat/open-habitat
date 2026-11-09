# Jaetut-sivu – kierros 2: miltä oma sivu näyttää

- **A Galleria**: isot esikatselukuvat ruudukossa, ryhmät Julkiset nyt, Vain sinä ja Päättyneet. Julkisen ruudun alla päättymispäivä ja Kopioi linkki.
- **B Lista**: tiivis lista uusin ensin, ja valittu jako isona oikealla osoitteen, päättymispäivän ja Kopioi linkki -painikkeen kanssa, kuten Agentin käytössä -sivu.
- **C Aikajana**: keskustelut aikajanalla viimeisimmän jaon mukaan ja niiden alla samat kortit kuin keskustelussa; kortti avaa esikatselun oikealle.

Issue `proto-shares-own-place`. Jari valitsi 9.11. kierroksen 1 suunnan 3
Oma sivu (Jaetut on oma sivu sivupalkissa Etusivun alla), näkymälle
`</>`-merkin ja sen, ettei poistoista jää jälkeä. Tämä kierros riffaa
sivun ulkoasua; paikka, hostin tiedot ja rivit ovat kaikissa samat kuin
kierroksella 1 (`2026-11-08-jaetut`): Jarin neljä osoitetta, kuvakaappaus,
kuvakansio, PDF-tarjous, vanhentunut CSV ja näkymä sekä osoite, jonka
kohteen agentti on poistanut.

Toiminnot ovat kaikissa tarjouskortin omat kuvakkeet (tuotannon
`OfferActions`): maapallo julkaisee tai tekee yksityiseksi, päivämäärä
avaa keston valikon, linkkikuvake kopioi, nuoli avaa omalle välilehdelle,
ja roskakori poistaa osoitteen tuotannon dialogin tekstein. A ja B
näyttävät julkiselle jaolle lisäksi tekstipainikkeen Kopioi linkki; C
pitää kortin sellaisenaan ja kertoo julkisuuden kortin tilarivillä.
Yläpalkin *Ei vielä jakoja* näyttää kunkin suunnan tyhjän sivun.

Kuvat ovat synteettisiä sijaisia hostin pikkukuville ja paneelin
sisällölle. C:n kortti on tuotannon `OfferCard`, ja `round.css` ohittaa
sen kulmarivin CSS-virheen (`offer-card-corner-icons-in-flow`) kuten
kierros 1.

## Rakentaminen ja tarkistus

Aja kertakäyttöisessä checkoutissa, jossa on `web/node_modules`
commitoidusta lukosta.

```
node build.mjs <out-dir>                 # offline.html (fontit) ja index.html
node check.mjs <out-dir>/offline.html <evidence-dir>
```

`check.mjs`:n alussa kerrotaan kuvat ja väitteet. Viimeisin ajo: 318
tarkistuspistettä, konsoli puhdas, ei vaakavieritystä.
