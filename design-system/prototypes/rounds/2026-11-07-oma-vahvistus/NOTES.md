# Oma vahvistus tallentamattomille muutoksille – kierros 1

Issue `proto-own-confirm-dialog`. Jari 7.11.: editorista poistuttaessa
selaimen oma *open-habitat-test.example.test says · Discard unsaved changes? …
Cancel / OK* on häiritsevä ja hankala. Tilalle Habitatin oma ratkaisu.

- **A Ikkuna**: kysymys keskellä sivua, sivu himmenee; kolme nimettyä painiketta: Tallenna ja sulje · Hylkää muutokset · Jatka muokkausta.
- **B Palkki**: rivi editorin alareunassa, muu sivu käytettävissä; lyhyet painikkeet Tallenna · Hylkää · Peru, ja kohde kerrotaan rivillä.
- **C Ei kysy**: ei kysymystä; poistuminen tallentaa ja ilmoitus kertoo sen, Kumoa palauttaa tekstin tallentamattomaksi. Kysyy vain, kun tallennus ei onnistu.

Akseli: kysytäänkö ja miten painavasti – estävä ikkuna, ei-estävä rivi vai
ei kysymystä lainkaan.

Rakennettu tuotannon komponenteista (`AppShell`, `WorkspaceRail`,
`NowSections`, `AgentHeader`, `ConversationTimeline`, `UserMessage`,
`AssistantMessage`, `ToolRow`, `EditorSplit`, `EditorHeader`,
`BrowserEditor`, `Button`, `Composer`); A:n ikkuna on react-aria-componentsin
`ModalOverlay`, jolla on tuotannon `ah-overlay`/`ah-modal`/`ah-dialog`-luokat
kuten `AlertDialog`issa. Kierroksen omia ovat kysymykset, palkki, ilmoitus ja
VS Coden kuva. Sisältö on synteettinen; mitään ei kirjoiteta.

## Yläpalkki

- **Kieli**: suomi tai englanti. Tuotannon komponentit ja kierroksen omat
  tekstit vaihtuvat; keskustelun sisältö pysyy suomeksi.
- **Tilanne**: *Sulje editori* (✕ editorin yläpalkissa), *Vaihda tiedosto*
  (`kayttajat.md` puusta), *Vaihda keskustelu* (Kotisivun kuvat toisesta
  työtilasta sivupalkissa) ja *VS Code → puhelimen editori* (ikkuna kapenee
  alle 800 px VS Coden ollessa auki).
- **Alku**: *Kysymys auki* näyttää tilanteen heti laukaistuna; *Muokkaus
  kesken* jättää editorin auki, ja ✕, puu ja sivupalkki laukaisevat sen itse.
- **Tallennus**: *Ei onnistu* simuloi agentin muutosta samassa kohdassa.
- **Nykyinen: selaimen kysymys** kysyy tuotannon tekstin tuotannon tapaan
  `window.confirm`illa, joten nykytilan voi verrata samassa näkymässä.

Sivun sulkeminen ja uudelleenlataus kysyvät kaikissa suunnissa selaimen omalla
`beforeunload`-kysymyksellä, kun teksti on tallentamatta, kuten tuotanto.

## Mitä kussakin tapahtuu

- **A.** Ikkuna estää muun sivun, kunnes valitaan; Esc ja ikkunan ulkopuolelle
  napsauttaminen ovat *Jatka muokkausta*. Ensisijainen painike sanoo, mitä
  tapahtuu: *Tallenna ja sulje*, *Tallenna ja avaa*, *Tallenna ja siirry*.
  Puhelimessa ikkuna nousee alareunasta ja painikkeet ovat allekkain
  ensisijainen ylimpänä. Epäonnistunut tallennus jättää ikkunan auki ja kertoo
  syyn; jäljelle jäävät *Hylkää muutokset* ja *Jatka muokkausta*. VS Coden
  kysymys: *Tallenna ja vaihda* · *Vaihda tallentamatta* · *Pysy VS Codessa*.
- **B.** Rivi on editorin sisällä, ei ikkuna: keskustelu, sivupalkki ja editori
  toimivat sen aikana. Painikkeet ovat lyhyitä, koska rivi kertoo kohteen
  (*Editori sulkeutuu, kun valitset.*, *kayttajat.md avautuu, kun valitset.*).
  VS Codessa rivi ei lupaa tallentaa: *Tallenna VS Codessa ensin (Ctrl+S), jos
  siellä on muutoksia.* · *Pysy VS Codessa* · *Vaihda puhelimen editoriin*,
  koska VS Code jää käyttöön rivin taakse.
- **C.** Poistuminen tallentaa heti. Ilmoitus näkyy siellä, missä muutos
  tapahtui: editorissa, kun se jää auki (tiedoston vaihto), muuten keskustelun
  yläpalkin alla. *Kumoa* palauttaa levylle aiemman version ja avaa editorin
  tekstisi kanssa tallentamattomana. Jos tallennus ei onnistu, kysytään A:n
  ikkunalla *Muutoksia ei voitu tallentaa* · *Hylkää muutokset* · *Jatka
  muokkausta*. VS Code tallennetaan ja vaihdetaan kysymättä.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-07-oma-vahvistus/build.mjs
node design-system/prototypes/rounds/2026-11-07-oma-vahvistus/check.mjs \
  design-system/prototypes/dist/oma-vahvistus/offline.html <kuvahakemisto>
xvfb-run -a -s "-screen 0 2880x1800x24" node \
  design-system/prototypes/rounds/2026-11-07-oma-vahvistus/capture-native.mjs \
  design-system/prototypes/dist/oma-vahvistus/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen suunnan läpi 1440 ja 390 px vaaleana ja tummana,
VS Coden kysymyksen myös 780 px:n kapeassa työpöytäikkunassa: kaikki neljä
tilannetta, kukin vastattuna eri painikkeella, epäonnistuva tallennus ja
englanniksi kaikki tilanteet (233 tarkistuspistettä, konsoli puhdas, kuvat
kertoimella 2). `capture-native.mjs` ottaa nykytilan kuvat oikeasta
Chromiumista virtuaalinäytöllä, koska headless-kuvaan selaimen omat
kysymykset eivät tule. `index.html` on sama ilman upotettuja fontteja
glasspadia varten.
