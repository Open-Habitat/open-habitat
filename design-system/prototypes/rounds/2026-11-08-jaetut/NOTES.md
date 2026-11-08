# Jaetut – kierros 1: oma paikka jaetuille näkymille ja tiedostoille

- **Nyt**: tuotanto tänään. Osoitteet ovat Asetukset › Tili -sivulla uloskirjautumisen ja Git-identiteetin alla: otsikko, tila ja tekstipainikkeet.
- **1 Asetukset**: oma Jaetut-osio asetuksissa. Rivit ryhmissä Julkiset nyt, Vain sinä ja Päättyneet; pieni esikatselu ja kortin kuvakkeet aina näkyvissä.
- **2 Alkulehti**: etusivulla työtilojen alla Jaetut nyt -kortit isolla esikatselulla ja Kopioi linkki -painikkeella; yksityiset ja päättyneet yhden rivin takana.
- **3 Oma sivu**: Jaetut on oma sivu sivupalkissa Etusivun alla. Samat kortit kuin keskustelussa, keskusteluittain; kortti avaa esikatselun oikealle.

Issue `proto-shares-own-place`. Akseli on se, missä jaetut elävät ja miten
rivi esittää itsensä. Sisältö on kaikissa sama: Jarin neljä osoitetta
8.11. (*Testikierros 7.11. – tilanne* julkinen 7.12.2026 asti,
*Myyntitaulukko (testi)*, *Testinäkymä – tarjouskortit*, *Testiraportti
/var/tmp:stä*), kuvakaappaus (julkinen viikon), kuvakansio, PDF-tarjous,
vanhentunut CSV ja näkymä sekä osoite, jonka kohteen agentti on poistanut.

Kaikissa suunnissa rivin toiminnot ovat tarjouskortin omat kuvakkeet
(tuotannon `OfferActions`): maapallo julkaisee sivuston oletuspituudeksi,
päivämäärä vaihtaa pituuden, linkkikuvake kopioi, nuoli avaa omalle
välilehdelle. Niiden perään tulee roskakori, joka poistaa osoitteen
pysyvästi tuotannon tekstein. Nyt-suunta on tuotannon `ViewLinkSettings`
muuttamattomana, ja samat osoitteet tulevat hostin vastauksena.

Kuvat ovat synteettisiä sijaisia hostin pikkukuville (kuvatarjouksen
320 px:n JPEG) ja paneelin sisällölle. Näkymällä ei ole hostilla kuvaa,
joten sen esikatselu on `</>`-merkki ja aloitustiedoston nimi.

Kierros ohittaa tuotannon yhden CSS-virheen: `.ah-offer >
:not(.ah-offer-hit)` voittaa kulmarivin `position: absolute`, joten
piilotetut kuvakkeet vievät kortissa tilaa (`offer-card-corner-icons-in-flow`).
Ohitus on `round.css`:ssä ja koskee vain suuntaa 3.

## Rakentaminen ja tarkistus

```
node build.mjs <out-dir>                 # offline.html (fontit) ja index.html
node check.mjs <out-dir>/offline.html <evidence-dir>
```

Nyt-suunta tarvitsee oikean origin-osoitteen (tuotanto tarkistaa, että
osoite on sovelluksen omalla hostilla). Glasspadin null-origin-hiekkalaatikossa
se näyttää *Osoitteita ei voitu lukea*; muut suunnat toimivat.
`check.mjs`:n alussa kerrotaan kuvat ja väitteet. Viimeisin ajo: 244
tarkistuspistettä, konsoli puhdas, ei vaakavieritystä.
