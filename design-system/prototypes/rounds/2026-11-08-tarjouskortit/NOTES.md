# Tarjouskortit – kierros 1: yksi kortti ja yksi avautumispaikka

- **Nyt**: tuotanto tänään. Näkymä avautuu viereen, tiedosto ikkunaan keskustelun päälle, kansio Tiedostot-paneeliin; kortit ja painikkeet vaihtelevat lajin mukaan.
- **1 Kortti**: koko kortti on yksi painallus, joka avaa kohteen oikeaan paneeliin; lataus ja jakaminen ovat paneelin yläpalkissa.
- **2 Rivi**: jokainen tarjous on yksi rivi, jonka ainoa painike on Avaa (oikea paneeli); lataus ja jakaminen ⋯-valikossa.
- **3 Otsake**: jokaisella kortilla sama tietorivi (laji · koko · kuka näkee) ja samat kaksi painiketta: Avaa (oikea paneeli) ja Lataa.

Issue `proto-offer-cards-consistent`. Jari 8.11.: agentin tarjoamat
näkymät, taulukot ja kansiot näyttävät erilaisilta ja avautuvat eri
paikkoihin. Akseli on se, kuinka paljon kortti itse kantaa; avautumispaikka
on kaikissa suunnissa sama oikean reunan paneeli, jonka
`proto-conversation-assets` suositteli keskustelun näkymien ja tiedostojen
listalle (suunta 2 Paneeli).

## Sivu

Keskustelu *Asiakaskysely syksy 2026*: agentti tarjoaa kuusi kohdetta,
jokaista lajia yhden: näkymän (yhteenveto, vain sinulle), CSV-taulukon,
PNG-kuvan, toisen näkymän (kiitossivu, julkinen kaksi viikkoa),
PDF-raportin ja viiden kaavion kansion. Oletusnäkymä on keskustelun loppu,
jossa uusimmat kortit näkyvät; `0-kortit`-kuva näyttää kaikki kuusi.

Kaikissa suunnissa:

- Otsikko on tavallisella kirjasimella (tuotannossa tiedoston otsikko on
  monospacea, näkymän ei). Polku tai kansion nimi näkyy tietorivillä.
- Lajin merkki on tuotannon: `</>` näkymälle, tiedostotyypin kuvake ja väri
  tiedostolle.
- Kuka näkee on merkki: lukko = vain sinulle, maapallo = julkinen. Sitä
  muutetaan paneelissa (vain näkymä voi olla julkinen).
- Painallus avaa kohteen oikeaan paneeliin. Paneelin yläpalkissa on aina
  sama järjestys: ↗ omalle välilehdelle, ⤓ lataa, ✕ sulje; sen alla
  näkyvyysrivi (näkymällä Julkinen-kytkin ja Kopioi linkki). Paneelin
  yläreunan *‹ Näkymät ja tiedostot* vie keskustelun listaan, ja yläpalkin
  `</> 2 · ▯ 4` -siru avaa saman listan. Kansion tiedosto avautuu samaan
  paneeliin, paluu *‹ kaaviot/*.
- Puhelimessa paneeli peittää keskustelun, ✕ palaa.
- Avoimen kohteen kortti on korostettu.

## Suunnat

- **1 Kortti**: merkki, otsikko ja tietorivi, oikealla ›. Kuvassa ja
  kansiossa pienoiskuvat. Ei painikkeita lainkaan.
- **2 Rivi**: yksi rivi: merkki, otsikko, tietorivi (puhelimessa piiloon),
  lukko, *Avaa* ja ⋯ (Lataa, Avaa omalle välilehdelle, näkymällä
  Tee julkiseksi / Lopeta julkisuus). Kuvaa ei näy kortissa.
- **3 Otsake**: ylärivi `merkki laji · koko · 🔒 Vain sinulle`, otsikko,
  kuvalla pienoiskuva, ja aina *Avaa* + *⤓ Lataa* (näkymällä ja kansiolla
  *Lataa (.zip)*).

## Mistä sivu on tehty

Tuotannon `AppShell`, `WorkspaceRail`, `AgentNavItem`, `AgentHeader`,
`ConversationTimeline`, `Composer`, `ViewOfferCard`, `FileOfferCard`,
`ViewSplit`, `ViewPanel` ja `FileShelf` muuttamattomina; Nyt on niistä
koottu tuotanto. Suuntien kortit, paneeli ja lista ovat kierroksen omia
tuotannon tokeneilla, merkeillä ja `fileFacts`-tietorivillä. Näkymät ovat
pieniä `data:`-sivuja, kuvat piirrettyjä SVG-kaavioita (sivun
`MutationObserver` ohjaa tarjousten `inline`-osoitteet niihin), ja PDF on
paneelissa piirretty sivu. Nyt-näkymän PDF-ikkuna näyttää vain tiedot ja
Lataa-painikkeen, koska pdf.js:n worker puuttuu tästä sivusta; tuotannossa
siinä on esikatselu.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-08-tarjouskortit/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-08-tarjouskortit/check.mjs \
  design-system/prototypes/dist/tarjouskortit/offline.html <kuvahakemisto>
```

`check.mjs` käy Nyt-näkymän ja jokaisen suunnan läpi 1440 px:n ja 390 px:n
(kosketus) leveydellä vaaleana ja tummana. Se avaa jokaisen lajin kortista
ja tarkistaa paikan: Nyt-näkymässä paneeli, ikkuna tai Tiedostot lajin
mukaan, suunnissa aina sama paneeli ilman ikkunaa. Lisäksi se avaa kansion
tiedoston paikallaan, keskustelun listan sirusta ja Rivin ⋯-valikon.
Konsoli pysyy puhtaana eikä sivu vuoda sivusuunnassa (534 tarkistuspistettä).
`index.html` on sama sivu ilman upotettuja fontteja.
