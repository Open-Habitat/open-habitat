# Keskustelun näkymät ja tiedostot – kierros 3: kohteen toiminnot

- **A Kuvakkeet**: hiiren alla rivin oikeaan päähän pienet kuvakkeet (julkinen, oma välilehti, lataus, keskustelussa); kosketuksella aina näkyvissä; paneelin yläpalkissa sama rivi.
- **B Valikko**: rivillä aina oma välilehti -nuoli, hiiren alla ⋯, jonka valikossa loput; kosketuksella ⋯ aina näkyvissä; paneelin yläpalkissa ↗ ja ⋯.
- **C Paneeli**: rivi pysyy puhtaana; toiminnot vain avatun kohteen yläpalkissa, ja ⌘- tai keskipainikkeen klikkaus rivillä avaa oman välilehden kuten linkki.

Issue `proto-conversation-assets`. Jari valitsi 8.11. kierroksen 2 Oman
sirun ja pyysi riffaamaan, miten listan kohteeseen ja avattuun kohteeseen
saa toiminnot; hän avaa usein kohteen omaan välilehteen. Akseli on
toimintojen paikka: rivillä hiiren alla, valikossa vai vain avatussa
kohteessa.

## Sivu

Sama keskustelu kuin kierroksella 2 (*Q3-myyntikatsaus johtoryhmälle*:
kuusi näkymätarjousta, neljä tiedostotarjousta, lopuksi kaksi workeria).
Oletusnäkymässä Oman sirun lista on auki, *Myyntidata Q3* on avattu oikeaan
paneeliin, ja uusimman raportin rivi on piirretty kuin hiiri olisi sen
päällä, joten suuntien ero näkyy heti. Puhelimessa mitään ei ole avattu ja
lista näyttää kosketustilan.

Kaikissa suunnissa:

- Rivin painallus avaa kohteen oikeaan paneeliin, ja saman rivin painallus
  uudelleen sulkee sen. Siksi lista pysyy työpöydällä auki, kun kohde
  avataan viereen (kierroksella 2 se sulkeutui valinnasta). Avattu rivi on
  korostettu kuten avattu kortti. Puhelimessa paneeli peittää keskustelun,
  joten lista sulkeutuu.
- Rivi on oikea linkki kohteen pysyvään osoitteeseen. ⌘-, Ctrl- ja
  keskipainikkeen klikkaus avaa siis oman välilehden kaikissa suunnissa;
  C:ssä se on listan ainoa reitti. Prototyyppi piirtää välilehden
  (osoiterivi, kohteen sivu) sivun päälle.
- Kuvakkeet ja järjestys ovat tarjouskorttien kierroksen 3
  (`proto-offer-cards-consistent`) mukaiset: maapallo (julkinen heti 30
  päivää), ↗ (oma välilehti), lataus; ⋯ valikolle; julkisena maapallon
  perään tulee *Kopioi linkki*. Tämän listan oma lisäys on viimeisenä
  *Näytä keskustelussa* (puhekupla), joka kierroksilla 1 ja 2 oli rivillä
  aina näkyvissä.
- Julkisen kohteen rivillä on pieni maapallo, ja paneelin tietorivillä
  lukee *Julkinen 8.12. asti* tai *Vain sinulle*.
- *Lataa* näyttää hetken ilmoituksen, koska hostia ei ole. Kansiolla
  (*Lähdeaineisto*) ei ole omaa välilehteä, vaan lataus on .zip.

## Suunnat

- **A Kuvakkeet**: hiiren alla neljä kuvaketta peittää rivin kellonajan,
  joten otsikko ei kapene. Kosketuksella maapallo, ↗ ja lataus ovat aina
  näkyvissä ja kellonaika siirtyy tietoriville; *Näytä keskustelussa* jää
  paneeliin. Paneelin yläpalkissa on sama rivi ja ✕.
- **B Valikko**: ↗ on jokaisella rivillä aina, koska oma välilehti on
  Jarin yleisin toiminto. ⋯ pitää paikkansa ja näkyy hiiren alla; sen
  valikossa ovat *Julkinen 30 päivää* (tai *Lopeta julkisuus*), *Kopioi
  linkki*, *Lataa* ja *Näytä keskustelussa*. Kosketuksella ⋯ on aina
  näkyvissä. Paneelin yläpalkissa on ↗, sama ⋯ ja ✕.
- **C Paneeli**: rivillä ei ole painikkeita. Hiiren alla kellonajan päälle
  tulee hiljainen vihje `⌘ ↗`. Kaikki toiminnot ovat paneelin yläpalkissa
  samana rivinä kuin A:ssa. Kosketuksella rivin pitkä painallus antaa
  selaimen oman linkkivalikon (*Avaa uudessa välilehdessä*), koska rivi on
  linkki; prototyyppi ei voi piirtää sitä, joten puhelimen kuvassa
  välilehti avataan paneelin yläpalkista.

## Päätökset myöhempää katselmointia varten

- Kuvakkeet ja järjestys otettiin tarjouskorttien kierroksen 3 worktreestä
  (`r68-cards3b`) ennen kuin se laskeutui. Jos Jari valitsee siellä toisen
  järjestyksen, tämä lista seuraa.
- Lista pysyy auki, kun kohde avataan viereen. Se sulkeutuu Escistä,
  sirusta, ✕:stä ja painalluksesta muualle kuin listaan tai avattuun
  kohteeseen.
- B:n valikossa julkisuuden kestoa ei voi muuttaa; se tehdään paneelissa
  tai omalla välilehdellä, kun kortin julkisuusmalli on päätetty.

## Mistä sivu on tehty

Tuotannon `AppShell`, `WorkspaceRail`, `AgentHeader`,
`ConversationTimeline`, `Composer`, `BackgroundStrip` (kahdella
synteettisellä workerilla), `ViewOfferCard`, `FileOfferCard`, `ViewSplit`,
`ControlButton`, `ControlMenuItem` ja `CopyButton` muuttamattomina.
Aineistosiru, lista, rivien toiminnot, avatun kohteen paneeli ja piirretty
välilehti ovat kierroksen omia.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-08-keskustelun-aineisto-3/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-08-keskustelun-aineisto-3/check.mjs \
  design-system/prototypes/dist/keskustelun-aineisto-3/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen suunnan läpi 1440 px:n ja 390 px:n leveydellä
(kosketus) vaaleana ja tummana. Se tarkistaa, mitä oletusnäkymän riveillä
näkyy (hiiren alla tai kosketuksella), että avatun rivin painallus sulkee
paneelin ja lista pysyy auki, että B:n rivivalikko aukeaa, että julkiseksi
asettaminen paneelin yläpalkista näkyy tietorivillä ja tuo *Kopioi
linkin*, että *Lataa* ilmoittaa, että oma välilehti aukeaa suunnan
paikasta (C: ⌘-klikkaus rivillä), eikä sivu vuoda sivuttain. Konsoli pysyy
puhtaana (294 tarkistuspistettä). `index.html` on sama sivu ilman
upotettuja fontteja.
