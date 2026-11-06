# Markdown-lohkon esikatselu – kierros 2

- **1 Paikallaan**: kopioinnin alla silmä, joka vaihtaa lohkon renderöidyksi samaan kohtaan ja painettuna takaisin lähteeksi.
- **2 Editoriin**: kopioinnin alla editoripainike, joka avaa lohkon editorin Markdown-esikatseluun tallentamattomana luonnoksena.
- **3 Valikko**: kopioinnin alla silmä, joka avaa pienen valikon: esikatsele tässä tai avaa editorin esikatselussa.

Issue `proto-markdown-block-preview`. Kierros 1
(`../2026-11-06-md-lohkon-esikatselu/`) ratkaisi paikan: toiminto on lohkossa
itsessään, oikean reunan painikkeiden joukossa kopioinnin ja kielimerkinnän
rinnalla. Tämä kierros riffaa sitä yhtä painiketta ja sitä, mitä se tekee.
Akseli: mitä lohkon oma esikatselupainike tekee.

Rakennettu tuotannon komponenteista (`AppShell`, `WorkspaceRail`,
`AgentHeader`, `ConversationTimeline`, `UserMessage`, `AssistantMessage`,
`ToolRow`, `Markdown`, `OutputBox`, `EditorSplit`, `EditorHeaderActions`,
`BrowserEditor`, `ControlMenuItem` ja react-aria-valikko, `IconButton`,
`TextField`, `Button`, `Composer`). Kierroksen omia ovat lisäpainike
lohkon oikeassa reunassa (oma ryhmä heti kopioinnin alla, kuten tuotannon
ryhmät), renderöity pinta laatikon sisällä ja tallennuskortti. Sisältö on
sama kuin kierroksessa 1: lyhyt README-lohko (4 riviä) ja julkaisuohjeen
luonnos (33 riviä). Mitään ei kirjoiteta.

## Mitä kussakin tapahtuu

Oletusnäkymä (*Alku › Toiminto käytetty*) näyttää kunkin riffin tuloksen;
*Alku › Ennen painallusta* näyttää lohkot koskemattomina.

- **1 Paikallaan.** Silmä on painettuna, ja luonnos näkyy renderöitynä
  samassa laatikossa: kielimerkintä *markdown · 33 riviä* jää yläkulmaan,
  kopiointi ja silmä pysyvät paikallaan. Renderöitynä näkymän valinta,
  rivitys ja oma ikkuna poistuvat, koska ne koskevat koodirivejä. Pitkä
  luonnos rajataan noin 22 riviin, ja *Näytä kaikki 33 riviä* avaa sen.
  Uusi painallus palauttaa lähteen; painike pysyy pikselilleen samassa
  kohdassa (rail pidetään saman levyisenä). README-lohko on oletuksessa
  vielä lähteenä, jotta molemmat tilat näkyvät vierekkäin.
- **2 Editoriin.** Editoripainike avaa Habitatin oman editorin keskustelun
  vasemmalle puolelle (puhelimessa yläpuolelle) luonnoksella
  `luonnos-julkaisu.md`, suoraan esikatselussa. Ilmoitusrivi: *Luonnos
  agentin vastauksesta klo 10.42 · ei vielä työtilassa*. Kynä vaihtaa
  tekstiin, Tallenna kysyy polun (`docs/julkaisu.md`), vasta tallennus
  kirjoittaa. Painike on painettuna niin kauan kuin luonnos on auki.
  Sama editori kuin kierroksen 1 A:ssa.
- **3 Valikko.** Silmä avaa valikon lohkon vasemmalle puolelle:
  *Esikatsele tässä – Renderöitynä keskustelussa* ja *Avaa editorin
  esikatselussa – Luonnoksena, jonka voi muokata ja tallentaa*. Kun lohko
  on renderöity, ensimmäinen kohta on *Näytä lähde*. Oletuksessa valikko on
  auki luonnoksen päällä ja README on jo renderöity sen kautta. Molemmat
  toiminnot ovat samat kuin riffeissä 1 ja 2.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-06-md-lohkon-esikatselu-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-md-lohkon-esikatselu-2/check.mjs \
  design-system/prototypes/dist/md-lohkon-esikatselu-2/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen riffin läpi vaaleana ja tummana leveyksillä 1440
ja 390 px kertoimella 2: 1:ssä oletus, Näytä kaikki, paluu lähteeseen
(painike ei liiku) ja lyhyt lohko; 2:ssa oletus, teksti, tallennuskortti,
sulkeminen ja lyhyt lohko; 3:ssa avoin valikko, renderöinti valikosta,
valikko renderöidyn päällä, editori valikosta ja paluu lähteeseen. Kaikissa
tarkistetaan, että painike on heti kopioinnin alla. Tulos: 128
tarkistuspistettä, konsoli puhdas. `index.html` on sama sivu ilman
upotettuja fontteja glasspadia varten.

## Toteutukselle

- `OutputBox` tarvitsee `actions`-paikan oikean reunan ryhmälle heti
  kopioinnin alle; kierros lisää sen portaalilla. Riffit 1 ja 3 tarvitsevat
  lisäksi tavan näyttää sisältö lähteen sijasta (`rendered`-sisältö samaan
  sarakkeeseen) ja piilottaa koodiriviin liittyvät ohjaimet. Kierros tekee
  sen CSS:llä ja portaalilla.
- Kierroksen 1 kehys kääri keskustelun niin, että `EditorSplit`in vieressä
  se ei vierinyt. Tämä kierros korjaa sen omassa CSS:ssään; tuotannossa
  `EditorSplit` saa lukunäkymän suoraan, joten vikaa ei ole siellä.
- `BrowserEditor`in luonnostila on yhä tekemättä: kierros piilottaa
  *Muokattu*-tilan CSS:llä ja kertoo luonnoksesta `notice`-rivillä.
