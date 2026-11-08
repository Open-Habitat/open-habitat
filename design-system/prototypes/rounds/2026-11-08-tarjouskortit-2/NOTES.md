# Tarjouskortit – kierros 2: Kortti, avautumispaikka ja jakaminen

- **A Viereen**: kohde avautuu oikeaan paneeliin; paneelin yläpalkissa Julkinen-kytkin ja Avaa omalle välilehdelle.
- **B Ikkuna**: kohde avautuu ikkunaan keskustelun päälle, sama yläpalkki; Esc sulkee.
- **C Merkki**: työpöydällä viereen, puhelimessa ikkunaan; kortin lukko tai maapallo avaa jakamisen suoraan kortista.

Issue `proto-offer-cards-consistent`. Jari valitsi 8.11. kierroksen 1
suunnan **1 Kortti** (koko kortti on yksi painallus). Tämä kierros pitää
kortin ja riffaa sitä, missä avattu kohde on ja miten sen saa jaettua.
Oletusnäkymässä CSV-taulukko on jo auki, joten avautumispaikka näkyy heti.

## Sivu

Sama keskustelu kuin kierroksella 1 (*Asiakaskysely syksy 2026*): kaksi
näkymää (yhteenveto vain sinulle, kiitossivu julkinen kaksi viikkoa), CSV,
PNG-kaavio, PDF-raportti ja viiden kaavion kansio.

Kaikissa riffeissä:

- Kortti on kierroksen 1 Kortti: merkki, otsikko, tietorivi, kuvalla ja
  kansiolla pienoiskuvat, oikealla ›.
- Yläpalkki on sama joka lajilla ja joka paikassa: paluu *‹ Näkymät ja
  tiedostot*, otsikko ja tietorivi, ⤓ ja ✕. Toisella rivillä jakaminen ja
  *Avaa omalle välilehdelle ↗*.
- **Jakaminen on joka lajilla sama kuin näkymällä nyt**: *Julkinen*-kytkin
  julkaisee heti 30 päiväksi, päivämäärä avaa keston (1 pv, 1 vk, 2 vk,
  30 pv) ja *Kopioi linkki* kopioi osoitteen. Yksityisenä näkyy *🔒 Vain
  sinulle*.
- **Oma välilehti joka lajille**: ↗ avaa kuvitetun selainvälilehden, jossa
  osoite on kohteen pysyvä osoite `alder.example/n/…`, sama jonka *Kopioi
  linkki* antaa (näin näkymän oma välilehti toimii jo nyt). Sivulla on
  kohde koko ruudulla, jakaminen ja ⤓; kansiolla tiedostolista.
- Kansion tiedosto avautuu paikallaan, paluu *‹ kaaviot/*. Jakaminen koskee
  koko tarjousta.
- Yläpalkin `</> 2 · ▯ 4` -siru avaa keskustelun listan samaan paikkaan kuin
  kohteet; listassa jokaisella rivillä lukko tai maapallo.

## Riffit

- **A Viereen**: paneeli kuten kierroksella 1. Puhelimessa paneeli peittää
  keskustelun. Korttien tietorivin lopussa pieni lukko tai maapallo, jota
  ei voi painaa.
- **B Ikkuna**: iso ikkuna (enintään 1120 × 860) himmennetyn keskustelun
  päällä; Esc, ✕ ja taustan painallus sulkevat. Keskustelu pysyy täysleveänä
  ikkunan alla. Puhelimessa ikkuna nousee alhaalta ja keskustelun yläpalkki
  näkyy sen yllä.
- **C Merkki**: työpöydällä paneeli, puhelimessa B:n ikkuna. Jokaisen kortin
  oikeassa reunassa on pyöreä merkki: lukko, tai maapallo ja päivä
  (*🌐 22.11. asti*). Merkin painallus avaa jakamisen pienenä ponnahduksena
  kortin alle avaamatta kohdetta, ja julkisena siinä näkyy osoite. Sama
  merkki on paneelin yläpalkissa kytkimen tilalla.

## Mistä sivu on tehty

Tuotannon `AppShell`, `WorkspaceRail`, `AgentNavItem`, `AgentHeader`,
`ConversationTimeline`, `Composer`, `ViewSplit` ja `CopyButton`
muuttamattomina, sekä tuotannon kytkimen, keston ja ikkunan luokat
(`ah-view-offer-switch`, `ah-view-offer-until`, `ah-overlay`, `ah-modal`).
Kortit, yläpalkki, ikkuna, ponnahdus ja kuvitettu välilehti ovat kierroksen
omia tuotannon tokeneilla. Sisältö on kierroksen 1: `data:`-näkymät,
piirretyt SVG-kaaviot ja paneelissa piirretty PDF.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-08-tarjouskortit-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-08-tarjouskortit-2/check.mjs \
  design-system/prototypes/dist/tarjouskortit-2/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen riffin läpi 1440 px:n ja 390 px:n (kosketus)
leveydellä vaaleana ja tummana. Se tarkistaa, että oletuksena taulukko on
auki riffin paikassa, avaa jokaisen lajin kortista ja tarkistaa paikan
(A paneeli, B ikkuna, C paneeli työpöydällä ja ikkuna puhelimessa), että Esc
sulkee ikkunan, että jokaisen lajin saa omalle välilehdelle ja että
jakaminen on yläpalkissa. Se tekee taulukosta julkisen (C:ssä kortin
merkistä avaamatta kohdetta) ja takaisin yksityisen, avaa kansion
tiedoston ja listan. Konsoli pysyy puhtaana eikä sivu vuoda sivusuunnassa
(1008 tarkistuspistettä). `index.html` on sama sivu ilman upotettuja
fontteja.
