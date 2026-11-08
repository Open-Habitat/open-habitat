# Tarjouskortit – kierros 3: kortin omat toiminnot

- **A Kulma**: hiiren alla kortin oikeaan yläkulmaan pienet kuvakkeet (julkinen, välilehti, lataus); kosketuksella aina näkyvissä; paneelin yläpalkissa sama rivi.
- **B Palkki**: hiiren alla kortin alareunaan palkki lyhyin sanoin, avatussa kortissa pysyvästi; kosketuksella pitkä painallus; paneelissa vain ✕.
- **C Jako**: kortissa aina lukko tai maapallo, joka avaa jakamisen; ⋯ hiiren alla (välilehti, lataus); kosketuksella ⋯ on paneelin yläpalkissa.

Issue `proto-offer-cards-consistent`. Jari valitsi 8.11. kierroksen 2
suunnan **A Viereen** ja pyysi kaksi asiaa: saman kortin painallus sulkee
paneelin, ja julkaisu, oma välilehti ja lataus ovat kortissa hiiren alla.
Tämä kierros riffaa sitä, miltä kortin toiminnot näyttävät, mikä korvaa
hiiren kosketusnäytöllä ja mitä paneelin yläpalkkiin jää.

## Sivu

Sama keskustelu kuin kierroksilla 1 ja 2 (*Asiakaskysely syksy 2026*): kaksi
näkymää (yhteenveto vain sinulle, kiitossivu julkinen kaksi viikkoa), CSV,
PNG-kaavio, PDF-raportti ja viiden kaavion kansio.

Oletusnäkymässä työpöydällä PDF on auki paneelissa, ja kiitossivun kortti on
piirretty hiiren alla olevaksi. Piirretty hover poistuu, kun hiiri käy
jonkin kortin päällä. Puhelimessa mitään ei ole auki, ja näkyvissä on riffin
kosketustila: A:n kuvakkeet, B:n pitkällä painalluksella avattu palkki
PDF-kortissa ja C:n lukot.

Kaikissa riffeissä:

- **Kortti avaa ja sulkee.** Painallus avaa kohteen oikeaan paneeliin.
  Saman kortin uusi painallus sulkee paneelin, ja toisen kortin painallus
  vaihtaa sisällön. Avattu kortti on korostettu: aksenttireunus, vaalea
  aksenttitausta ja aksentinvärinen ›. Hiiren alla › vaihtuu ✕:ksi, koska
  painallus sulkee. Ruudunlukijalle kortti on *Avaa: …* tai *Sulje: …*
  (`aria-expanded`).
- **Julkaisu on sama kuin näkymällä nyt**: julkiseksi 30 päiväksi heti,
  päivä avaa keston (1 pv, 1 vk, 2 vk, 30 pv), *Kopioi linkki* kopioi
  pysyvän osoitteen `/n/…`.
- **Oma välilehti** avaa kuvitetun välilehden kohteen pysyvässä osoitteessa
  (kuten kierroksella 2). **Lataa** näyttää lyhyen ilmoituksen
  *Ladataan kysely-siivottu.csv*; näkymä ja kansio latautuvat zipinä.
- Kortin painamaton osa (myös palkin tyhjä kohta) avaa kortin. Vain
  painikkeet ottavat painalluksen itselleen.
- Yläpalkin `</> 2 · ▯ 4` -siru avaa keskustelun listan samaan paneeliin.

## Riffit

- **A Kulma**: hiiren alla kortin oikeaan yläkulmaan nousee pieni kehys,
  jossa on kolme kuvaketta: maapallo (julkinen päälle tai pois), ↗ ja ⤓.
  Kun kohde on julkinen, väliin tulevat päivä (*22.11. ⌄*) ja linkin
  kopiointi. Kehyksen ollessa näkyvissä › piilotetaan. Kosketuksella
  kuvakkeet ovat aina näkyvissä kortin alimmalla rivillä oikeassa
  reunassa. Ne eivät ole kulmassa, jotta otsikko saa koko leveyden. Paneelin
  yläpalkissa on sama rivi ja ✕.
- **B Palkki**: hiiren alla kortin alareunaan liukuu palkki: *Julkinen*-kytkin,
  julkisena päivä ja *Kopioi linkki*, oikealla *↗ Välilehti* ja *⤓ Lataa*.
  Hiiren alla palkki peittää tietorivin, jotta keskustelu ei liiku.
  Avatussa kortissa palkki on pysyvästi omana rivinään. Kosketuksella
  palkin tuo pitkä painallus (0,45 s), ja palkki pysyy, kunnes painetaan
  muualle. Lyhyt painallus avaa paneelin. Paneelin yläpalkissa on
  työpöydällä vain ✕, koska avattu kortti kantaa toiminnot vieressä.
  Puhelimessa paneeli peittää kortin, joten palkki on myös paneelin
  yläreunassa.
- **C Jako**: kortissa on aina pyöreä merkki: lukko, tai maapallo ja päivä.
  Merkin painallus avaa jakamisen pienenä ponnahduksena avaamatta kohdetta
  (kierroksen 2 C). Hiiren alla merkin viereen tulee ⋯: *Avaa omalle
  välilehdelle*, *Lataa* ja julkisena *Kopioi linkki*. Kosketuksella
  kortissa on vain merkki, ja ⋯ löytyy avatun kohteen yläpalkista.
  Paneelin yläpalkissa on merkki, ⋯ ja ✕.

## Mistä sivu on tehty

Tuotannon `AppShell`, `WorkspaceRail`, `AgentNavItem`, `AgentHeader`,
`ConversationTimeline`, `Composer`, `ViewSplit`, `ControlButton`,
`ControlMenuItem` ja `CopyButton` muuttamattomina, sekä tuotannon kytkimen ja
keston luokat (`ah-view-offer-switch`, `ah-view-offer-until`). Kortit,
toimintorivit, yläpalkki ja kuvitettu välilehti ovat kierroksen omia
tuotannon tokeneilla. Sisältö on kierrosten 1 ja 2: `data:`-näkymät,
piirretyt SVG-kaaviot ja paneelissa piirretty PDF.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-08-tarjouskortit-3/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-08-tarjouskortit-3/check.mjs \
  design-system/prototypes/dist/tarjouskortit-3/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen riffin läpi 1440 px:n ja 390 px:n (kosketus)
leveydellä vaaleana ja tummana. Se tarkistaa oletusnäkymän: työpöydällä
avattu ja korostettu PDF sekä hiiren alla piirretty kortti, puhelimessa
riffin kosketustila. Työpöydällä se tarkistaa, että saman kortin painallus
sulkee paneelin. Lisäksi se avaa jokaisen lajin kortista ja tarkistaa
paneelin yläpalkin sisällön riffin mukaan. Kortin omista toiminnoista
CSV:llä se tekee julkiseksi, avaa keston, palauttaa yksityiseksi, avaa
oman välilehden ja käynnistää latauksen. Puhelimessa B käytetään pitkällä
painalluksella ja C paneelin ⋯:lla. Konsoli pysyy puhtaana eikä sivu vuoda
sivusuunnassa (734 tarkistuspistettä). `index.html` on sama sivu ilman
upotettuja fontteja.
