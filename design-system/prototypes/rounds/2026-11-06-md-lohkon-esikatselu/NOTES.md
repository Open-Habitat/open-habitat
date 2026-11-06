# Markdown-lohkon esikatselu – kierros 1

Issue `proto-markdown-block-preview`. Jari 6.11.: keskustelun
```` ```markdown ````-lohko pitäisi voida avata editorin esikatseluun, jotta
agentin ehdottama ohje tai dokumentti näkyy renderöitynä eikä koodina.

Rakennettu tuotannon komponenteista (`AppShell`, `WorkspaceRail`,
`AgentHeader`, `ConversationTimeline`, `UserMessage`, `AssistantMessage`,
`ToolRow`, `Markdown`, `OutputBox`, `EditorSplit`, `EditorHeaderActions`,
`BrowserEditor`, `ViewSplit`, `Segmented`, `TextField`, `Button`,
`Composer`). Kierroksen omia ovat lohkon Esikatselu-painike (lohkon
toimintosarakkeessa kopioinnin alla), B:n paneelin sisältö, C:n
paikallaan renderöity kortti ja A:n tallennuskortti. Sisältö on
synteettinen: pyöräseuran sivusto, lyhyt README-lohko (4 riviä) ja
julkaisuohjeen luonnos (33 riviä, otsikot, tehtävälista, numeroitu lista,
sisäkkäinen bash-lohko, taulukko, lainaus). Mitään ei kirjoiteta.

## Akseli ja suunnat

Akseli: mihin renderöity lohko avautuu.

- **Nyt**: Markdown-lohko on koodilaatikko: kielimerkintä, rivimäärä, alku ja loppu, kopiointi ja näkymän valinta. Renderöityä näkymää ei ole.
- **A Editorissa**: lohkon Esikatselu avaa sen editorin Markdown-esikatseluun tallentamattomana luonnoksena keskustelun viereen (puhelimessa yläpuolelle); Tallenna vie sen työtilan tiedostoksi.
- **B Paneelissa**: lohkon Esikatselu avaa renderöidyn luonnoksen lukupaneeliin keskustelun viereen (puhelimessa koko näytölle); paneelista voi vain kopioida.
- **C Paikallaan**: lohko näkyy keskustelussa valmiiksi renderöitynä; Esikatselu | Lähde vaihtaa koodiin, ja pitkä luonnos avautuu Näytä kaikki -painikkeesta.

Suositus: **A Editorissa** (perustelu `result.md`:ssä).

## Mitä kussakin tapahtuu

Oletusnäkymä (*Alku › Esikatselu auki*) näyttää A:ssa ja B:ssä luonnoksen
jo avattuna; *Alku › Keskustelu* näyttää tilan ennen painallusta.

- **A.** Editori (Habitatin oma, CodeMirror 6) aukeaa keskustelun
  vasemmalle puolelle, ja luonnos on sen esikatselussa. Tiedostonimenä on
  `luonnos-julkaisu.md`, ja ilmoitusrivi kertoo *Luonnos agentin
  vastauksesta klo 10.42 · ei vielä työtilassa*. Kynä vaihtaa tekstiin, ja
  luonnosta voi muokata. Tallenna avaa kortin *Tallenna työtilaan*, jossa on
  tiedostopolku (oletuksena `docs/julkaisu.md`). Tallennuksen jälkeen
  editori näyttää tiedoston nimellä. Lohkon silmäpainike on painettuna niin
  kauan kuin luonnos on auki. Puhelimessa editori pinoutuu keskustelun
  yläpuolelle, kuten tiedostolinkeissä nyt; nuoli piilottaa keskustelun.
- **B.** Oikealle aukeaa lukupaneeli: otsikkona luonnoksen ensimmäinen
  otsikko, alla *Agentin vastauksesta klo 10.42 · markdown · 33 riviä*,
  sitten renderöity dokumentti lukuleveydellä. Painikkeet: Kopioi Markdown,
  Laajenna (piilottaa keskustelun nauhaksi) ja Sulje. Puhelimessa paneeli
  peittää keskustelun, eikä Laajenna-painiketta ole.
- **C.** Lohko on kortti: otsakkeessa *markdown · 33 riviä*, Esikatselu |
  Lähde ja kopiointi. Pitkä luonnos rajataan noin 22 riviin, ja *Näytä
  kaikki 33 riviä* avaa sen kokonaan. Lähde näyttää tuotannon
  koodilaatikon. Lyhyt README-lohko näkyy kokonaan renderöitynä.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-06-md-lohkon-esikatselu/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-md-lohkon-esikatselu/check.mjs \
  design-system/prototypes/dist/md-lohkon-esikatselu/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen suunnan läpi vaaleana ja tummana leveyksillä
1440 ja 390 px. A:ssa se tarkistaa oletuksen, tekstin, tallennuskortin,
tallennetun tilan, sulkemisen ja lyhyen lohkon. B:ssä se tarkistaa
oletuksen, laajennuksen, sulkemisen ja lyhyen lohkon, ja C:ssä oletuksen,
Näytä kaikki -tilan, lähteen ja lyhyen lohkon. Tulos: 92 tarkistuspistettä,
konsoli puhdas ja kuvat kertoimella 2. `index.html` on sama sivu ilman
upotettuja fontteja glasspadia varten.

## Toteutukselle

- `OutputBox` ei ota lisäpainikkeita; kierros lisää painikkeen
  toimintosarakkeeseen portaalilla. Toteutus tarvitsee propsin (esim.
  `actions`), ja `MarkdownRenderer`in `MarkdownPre` antaisi sen vain
  `markdown`/`md`-lohkoille.
- `BrowserEditor` tuntee vain levyllä olevan tiedoston. Kierros piilottaa
  *Muokattu*-tilan CSS:llä ja kertoo luonnoksesta `notice`-rivillä.
  Toteutus tarvitsee oikean luonnostilan: polkua ei vielä ole, ja Tallenna
  kysyy sen.
