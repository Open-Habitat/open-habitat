# Keskustelun näkymät ja tiedostot – kierros 1: missä lista on

- **Nyt**: tuotanto tänään. Kortit vain keskustelussa; yläpalkin tiedostopainike avaa Tiedostot-paneelin, jossa on vain tiedostot. Näkymillä ei ole listaa.
- **1 Siru**: yläpalkin siru näyttää näkymien ja tiedostojen määrän ja avaa sen alle listan, uusin ylimpänä; saman raportin versiot yhdellä rivillä.
- **2 Paneeli**: oikean reunan tiedostopaneeli on Näkymät ja tiedostot: näkymät ylimpänä, tiedostot tuotannon riveinä alla; näkymä avautuu samaan paneeliin.
- **3 Sivupalkki**: keskustelun rivin alla sivupalkissa on sen näkymät ja tiedostot, uusimmat neljä ja loput yhden painalluksen takana.

Issue `proto-conversation-assets`. Jari 8.11.: agentin tarjoamat näkymät ja
tiedostot on vaikea löytää myöhemmin, vanhaa korttia joutuu kelaamaan
pitkälle ylös. Ennen kuin päätetään, päivittääkö uusi versio saman kortin
(`view-new-version-same-card`), tarvitaan paikka, josta keskustelun kaikki
näkymät ja tiedostot löytyvät. Akseli on listan paikka. Sisältö, rivin
muoto ja toiminnot ovat kaikissa suunnissa samat.

## Sivu

Keskustelu *Q3-myyntikatsaus johtoryhmälle*: agentti tarjoaa kuusi näkymää
ja neljä tiedostoa. Näkymistä kolme on saman kvartaalikatsauksen versioita
(alkuperäinen, korjattu, tumma) ja kaksi asiakaskyselyn yhteenvedon
versioita; tuotelinjojen vertailu on yksi. Tiedostot ovat lähdeaineiston
kansio (viisi tiedostoa), kyselyn vastaukset (XLSX), myyntidata (CSV) ja
katsaus PDF:nä. Jokaisen suunnan oletusnäkymässä lista on auki (Nyt:
Tiedostot-paneeli), joten ero näkyy heti.

Rivi on kaikissa suunnissa sama: merkki (`</>` näkymälle, tuotannon
tiedostotyypin kuvake tiedostolle), otsikko, polku tai koko, kellonaika ja
puhekuplapainike *Näytä keskustelussa*, joka vierittää kortin näkyviin ja
korostaa sen hetken renkaalla. Rivin painallus avaa näkymän oikeaan
paneeliin, yksittäisen tiedoston esikatseluun ja kansion tuotannon
Tiedostot-paneeliin sen kohdalle. Saman raportin versiot ovat yhdellä
rivillä, jossa on uusin versio; *3 versiota* -siru avaa aiemmat sen alle,
ja jokaisen niistä voi avata tai löytää keskustelusta.

Versiot tunnistetaan näkymän `entry`-polusta: sama polku = saman raportin
versio. Lista on uusin ylimpänä raportin uusimman version ajan mukaan.

## Suunnat

- **1 Siru** korvaa tuotannon tiedostopainikkeen sirulla `</> 3 · ▯ 4`
  (raportit ja tiedostotarjoukset). Lista on yläpalkin alle aukeava
  ponnahdus, joka sulkeutuu valinnasta, ulkopuolisesta painalluksesta ja
  Escistä. Puhelimessa siru pysyy otsikon vieressä ja lista on koko
  levyinen.
- **2 Paneeli** laajentaa tuotannon Tiedostot-paneelin: otsikko *Näkymät ja
  tiedostot*, ensin näkymät (rivit kuten muissa suunnissa), sitten
  tuotannon tiedostohylly sellaisenaan (haku, tarjoukset ajan mukaan,
  kansiot). Näkymä avautuu samaan paneeliin, ja sen yllä on paluu
  listaan. Painike yläpalkissa on sama siru kuin suunnassa 1.
  Tiedostoriveillä ei ole *Näytä keskustelussa* -painiketta, koska ne ovat
  tuotannon rivejä.
- **3 Sivupalkki** lisää valitun keskustelun rivin alle sen neljä uusinta
  kohtaa tiiviinä ja loput *3 lisää* -painikkeen taakse. Yläpalkissa ei ole
  painiketta. Puhelimessa lista on valikkolaatikossa, ja valinta sulkee
  laatikon.

## Mistä sivu on tehty

Tuotannon `AppShell`, `WorkspaceRail`, `AgentNavItem`, `AgentHeader`,
`ConversationTimeline`, `Composer`, `ViewOfferCard`, `FileOfferCard`,
`ViewSplit`, `ViewPanel`, `FileShelf` ja `OfferedFilePreview`
muuttamattomina. Nyt-näkymän tiedostopainike on piirretty kuten
`FilesHeaderControl`. Lista, siru, ponnahdus, paneelin näkymäosio ja
sivupalkin rivit ovat kierroksen omia. Näkymien sisältö on pieniä
`data:`-sivuja, ja tiedostojen esikatselu saa sisältönsä kierroksen
`fetch`-tyngältä.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-08-keskustelun-aineisto/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-08-keskustelun-aineisto/check.mjs \
  design-system/prototypes/dist/keskustelun-aineisto/offline.html <kuvahakemisto>
```

`check.mjs` käy Nyt-näkymän ja jokaisen suunnan läpi 1440 px:n ja 390 px:n
leveydellä (kosketus) vaaleana ja tummana: oletusnäkymä, lähikuva
yläpalkin painikkeesta, versiot auki, ensimmäinen versio avattuna listasta
(Nyt: kortista keskustelussa ylös kelaamalla) ja vanhimman tiedoston kortti
löydettynä keskustelusta (Paneeli: ensimmäisen version kortti). Se
tarkistaa korttien määrät, listan rivit ja järjestyksen, että oikea
versio aukeaa, että löydetty kortti on ruudulla ja ettei sivu vuoda
leveyssuunnassa. Konsoli pysyy puhtaana (248 tarkistuspistettä).
`index.html` on sama sivu ilman upotettuja fontteja.
