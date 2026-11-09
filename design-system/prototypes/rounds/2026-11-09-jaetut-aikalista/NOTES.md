# Jaetut-sivu – kierros 3: aikajanamainen lista

- **A Päivät**: lista päiväotsikoittain uusin ensin, rivillä keskustelu ja kellonaika. Valitussa jaossa koko osoite kentässä ja erillinen Kopioi linkki -painike.
- **B Keskustelut**: keskustelut pystyviivalla viimeisimmän jaon mukaan ja jaot niiden alla. Valitussa jaossa koko osoite kentässä ja linkkikuvake kentän päässä.
- **C Agenda**: päivämäärä omassa sarakkeessaan ja päivän keskustelut sen vieressä. Valitussa jaossa pelkkä Kopioi linkki -painike, osoitetta ei näytetä.

Issue `proto-shares-own-place`. Jari valitsi 9.11. kierroksen 2 suunnan B
Lista pohjaksi (tiivis lista ja valittu jako isona, osoite ja
päättymispäivä näkyvissä ilman hoveria) ja pyysi listaan kierroksen 2 C:n
ajallisen jäsennyksen. Tämä kierros riffaa sitä; sivu, rivit, oikea puoli
ja host-tiedot ovat muuten samat kuin kierroksella 2
(`2026-11-09-jaetut-sivu`).

Toinen akseli kulkee mukana, koska Jari jätti sen auki: miten valitun
jaon osoite näytetään. A näyttää kentän ja erillisen painikkeen, B kentän
ja kentän päässä olevan linkkikuvakkeen, C pelkän painikkeen. Kumpikin
avoin kysymys (erillinen painike vai kuvake; kenttä vai ei) on siis
nähtävissä kahdella tavalla.

Jaon aika on hostin `created_at`; päivät ja kellonajat näytetään
selaimen aikavyöhykkeellä (`check.mjs` ajaa Europe/Helsinki-ajassa).
Puhelimessa osoite tulee ennen kuvakkeita, jotta päivämäärän työkaluvihje
ei peitä kopiointia.

## Rakentaminen ja tarkistus

Aja kertakäyttöisessä checkoutissa, jossa on `web/node_modules`
commitoidusta lukosta.

```
node build.mjs <out-dir>                 # offline.html (fontit) ja index.html
node check.mjs <out-dir>/offline.html <evidence-dir>
```

`check.mjs`:n alussa kerrotaan kuvat ja väitteet. Viimeisin ajo: 366
tarkistuspistettä, konsoli puhdas, ei vaakavieritystä.
