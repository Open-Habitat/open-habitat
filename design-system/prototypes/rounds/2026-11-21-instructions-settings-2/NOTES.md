# Asetukset › Tili › Ohjeet agentille (kierros 2)

Issue `new-user-agent-instructions-template`. Jari 21.11.2026: suunta on
B Teksti muokattuna. Näkymässä on tavallinen Markdown-lohko, joka avautuu
Esikatseluun. Tämä vaatii daemonilta tiedoston luvun sekä kirjoituksen, joka
onnistuu vain, jos tiedosto ei ole muuttunut sillä välin (vertaa ja vaihda).
Suositus ja kysymykset Jarille ovat issuen `result-settings-2.md`:ssä.

## Jaettu editori

`editor.tsx` ja `editor.css` ovat **yksi ohje-editori**. Myös käyttöönoton
kierros 4 (`../2026-11-21-onboarding-instructions-4/`) tuo sen. Editori
koostuu tuotannon osista: `Tabs` (Overlays), `Markdown` dokumenttitilassa,
`ControlButton` sekä työtilaeditorin kolmitieyhdistäminen
(`editorMerge.threeWay`) ja ristiriitakortti (`EditorConflict`). Editori
omistaa vain luonnoksensa. Sivu antaa sille tekstin (`value`) ja päättää,
mitä Tallenna tekee. Hylätty tallennus palaa muodossa `{ conflict: theirs }`,
jossa `theirs` on levyllä nyt oleva teksti. Editori yhdistää toisen
muutoksen luonnokseen samoin kuin työtilaeditori, eikä mitään tallenneta
ennen kuin ihminen tallentaa uudelleen. Jos sama rivi on muuttunut
molemmissa, ristiriitakortti estää tallennuksen, kunnes ihminen valitsee,
kumpi rivi jää.

Prototyypin tekstikenttä on tavallinen `textarea`. Työtilaeditorin
CodeMirror merkitsee ihmisen rivin punaisella. Tässä kortin teksti "Sinun
rivisi on alla punaisella" ei siksi vielä pidä paikkaansa. Toteutuksessa
Muokkaa-välilehti voi olla tuotannon `CodeMirrorEditor` Markdown-tilassa.

## Akseli

**Jääkö Muokkaa agentin kanssa editorin viereen toissijaiseksi
toiminnoksi?**

- **B1 Editori ja agentti** (suositus): editorin toimintorivillä vasemmalla
  on Muokkaa agentin kanssa (toissijainen). Jos tiedostoa ei ole, painike on
  ensisijainen Kirjoita agentin kanssa. Painike avaa saman kotihakemiston
  keskustelun kuin kierroksella 1.
- **B2 Pelkkä editori**: ei agentin painiketta. Tyhjä tila ja itse
  kirjoitettu tiedosto neuvovat pyytämään agenttia missä tahansa
  keskustelussa.

## Tilanteet (valinta Tilanne, `?s=`)

- **Käyttöönotossa kirjoitettu** (`habitat`): kierroksen 4 vapaamuotoinen
  lappu. Claude lukee sen tuonnin kautta.
- **Ei vielä ohjeita** (`missing`): Esikatselu näyttää tyhjän tilan.
  Tiedoston voi kirjoittaa Muokkaa-välilehdellä. Ensimmäinen tallennus luo
  tiedoston ja Clauden tiedoston, joka viittaa siihen, jos Clauden tiedostoa
  ei vielä ole.
- **Itse kirjoitetut** (`own`): ihmisen oma tiedosto. Clauden tiedostossa on
  omia ohjeita ilman viittausta. Lähderivi kertoo, ettei Claude lue
  ohjeita. B1:ssä agentti tarjoaa viittauksen, B2:ssa näkymä vain kertoo
  asiasta.
- **Muuttuu sillä välin** (`changed`): agentti on toisessa keskustelussa
  muuttanut yhden rivin ja lisännyt yhden. Ensimmäinen tallennus hylätään,
  ja editori yhdistää muutokset.

## Käyttö

```
node build.mjs <out-dir>                                   # offline.html ja index.html
node check.mjs <out-dir>/offline.html <shots-dir> [--quick]
```

`?theme=light|dark|contrast`, `?lang=en` ja `?s=…` valitsevat alkutilan.
Sivu on tuotannon `AppShell`, `WorkspaceRail` ja `AccountSettings`
Tili-osiossa. Lohko viedään portaalilla Tilin kortin jälkeen, ja rivi
lisätään asetushakuun samoin kuin kierroksella 1. Kirjastoon (`lib/`) ja
tuotantokoodiin ei tehty muutoksia.
