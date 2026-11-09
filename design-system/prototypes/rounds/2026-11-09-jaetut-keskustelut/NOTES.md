# Jaetut-sivu – kierros 4: keskustelut viimeisimmän toiminnan mukaan

- **Kierros 3 B**: vertailukohta. Keskustelut viimeisimmän jaon mukaan, päivä keskustelun nimen edessä.
- **4 Viimeistely**: keskustelut viimeisimmän toiminnan mukaan kuten sivupalkissa, uusin ensin. Keskustelun nimi johtaa, päivä oikealla, jaot alla; osoite kentässä ja linkkikuvake sen päässä.

Issue `proto-shares-own-place`. Jari valitsi 9.11. kierroksen 3 suunnan B
Keskustelut: jako tunnistetaan keskustelustaan. Tämä kierros viimeistelee
sen toteutuksen määrittelyksi; Kierros 3 B on mukana vain vertailuna,
jotta muutos näkyy samasta paikasta.

Keskustelun päivä ja paikka listassa on sen viimeisin toiminta, sama
tieto, jolla sivupalkki järjestää keskustelut: snapshotin `changed_at`
eli keskustelun Pi-istuntotiedoston muokkausaika. Host lukee sen jo
jokaisesta keskustelusta, myös arkistoiduista, joten uutta host-tietoa ei
tarvita. Tarinassa *Testikierros 7.11.* on jatkunut 9.11. aamulla, joten
se nousee kärkeen, vaikka sen ainoa jako on 7.11. Osoite, jonka kohde on
poistettu, ei tiedä keskusteluaan ja jää viimeiseksi.

Puhelimessa osoite tulee ennen kuvakkeita, koska kosketusnäytöllä
päivämäärän työkaluvihje jää näkyviin napautuksen jälkeen ja peittäisi
alla olevan kopioinnin (kierroksen 3 löydös). Kentän päässä oleva
linkkikuvake on puhelimessa 44 px leveä.

## Rakentaminen ja tarkistus

Aja kertakäyttöisessä checkoutissa, jossa on `web/node_modules`
commitoidusta lukosta.

```
node build.mjs <out-dir>                 # offline.html (fontit) ja index.html
node check.mjs <out-dir>/offline.html <evidence-dir>
```

`check.mjs`:n alussa kerrotaan kuvat ja väitteet. Viimeisin ajo: 310
tarkistuspistettä, konsoli puhdas, ei vaakavieritystä.
