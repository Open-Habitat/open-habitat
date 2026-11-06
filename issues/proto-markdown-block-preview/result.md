# Kierros 1: Markdown-lohkon esikatselu

Kierros: `design-system/prototypes/rounds/2026-11-06-md-lohkon-esikatselu/`
(`NOTES.md` kuvaa suunnat ja tarkistuksen). Akseli: mihin renderöity lohko
avautuu. Suunnat: **Nyt**, **A Editorissa**, **B Paneelissa** ja **C Paikallaan**.

## Host-faktat: mitä on nyt

Luettu koodista 6.11.2026. Elävää editoria ei ajettu, joten code-serverin
osalta (merkitty alla) tieto on koodin ja VS Coden tunnetun käytöksen
varassa.

- **Koodilohko.** `MarkdownRenderer.tsx`:n `MarkdownPre` piirtää jokaisen
  aidatun lohkon `MarkdownCode` → `OutputBox`. Otsakkeessa on
  kielimerkintä ja yli 10 rivin lohkossa rivimäärä (*markdown · 33 riviä*).
  Pitkä lohko näyttää alun (3 riviä) ja lopun (7 riviä). Toimintosarakkeessa
  ovat Kopioi koodi, näkymä (alku ja loppu / vieritettävä / kaikki),
  rivitys ja *Avaa omassa ikkunassa*. `markdown`-kielelle ei ole mitään
  erityistä. Ainoa poikkeus on `mermaid`: se piirretään kaaviona, ja lähde on
  `<details>`-kohdassa (*Kaavion lähde*). Tämä on valmis esikuva C:lle.
- **Kaksi editoria.** `accountPreferences.ts` antaa moottoriksi
  `codemirror6` (oletus) tai `vscode`. Oletus on Habitatin oma
  selaineditori (`BrowserDocument` + `BrowserEditor`). Kun leveys on enintään
  800 px, `WorkspaceEditor` vaihtaa aina siihen, joten myös puhelimessa on
  editori. Se pinoutuu 40 % korkeana keskustelun yläpuolelle.
  (`fileRefs.ts`:n kommentti *null … a phone* on tässä kohdassa vanhentunut.)
- **Selaineditorissa on jo Markdown-esikatselu**: kynä/silmä-valinta,
  Ctrl+Alt+P, sama `Markdown`-renderöijä kuin keskustelussa ja vieritys
  samaan kohtaan otsikoittain. Editori lukee ja tallentaa vain työtilan
  tiedostoja daemonin kautta (`editorFiles`). Tallentamatonta, polutonta
  dokumenttia sillä ei ole.
- **Tiedostolinkki** (`src/main.ts:42`): `FileLinkContext.open` →
  CodeMirrorissa `BrowserDocument.open(ref)`. VS Codessa kutsu on
  `POST /api/v1/editor/open {workspace_id, path, line, end_line}`, daemon
  ratkaisee polun `editorFile`llä työtilan sisällä (vain tavallinen tiedosto,
  `RESOLVE_BENEATH`) ja pyytää Open Habitatin omaa code-server-laajennusta
  Unix-socketin kautta (`internal/daemon/editor-extension/extension.js`,
  pyyntö enintään 8192 tavua) avaamaan sen: `showTextDocument`.
- **VS Coden esikatselu (ei todennettu elävästä).** Daemon linkittää
  code-serverin omat sisäänrakennetut laajennukset editorin
  `builtin`-hakemistoon. Niihin kuuluu normaalisti
  `markdown-language-features` ja sen komento `markdown.showPreview`.
  Habitatin laajennus ei kutsu sitä nyt, eikä esikatselulle ole URL- tai
  komentoreittiä. Laajennus voisi avata sisällön nimettömänä dokumenttina
  (`openTextDocument({language: 'markdown', content})`) ja ajaa
  `markdown.showPreview`. Silloin tarvitaan uusi pyyntölaji, joka kuljettaa
  sisällön (avoin pyyntö kantaa nyt vain polun, ja 8192 tavun raja on liian
  pieni dokumentille).
- **Väliaikainen tiedosto ja sen vaihtoehdot:**
  - *Työtilaan* (esim. `.open-habitat/luonnokset/`): omistajana henkilö,
    näkyy `git status`issa ja agentille, suhteelliset linkit ja kuvat
    toimivat. Joku joutuu siivoamaan sen, ja se on toinen kopio
    keskustelun sisällöstä.
  - *Editorin omaan hakemistoon* (`$XDG_RUNTIME_DIR/open-habitat/editor/`,
    0700, tmpfs, tyhjenee uloskirjautuessa ja uudelleenkäynnistyksessä): ei
    sotke työtilaa, mutta `editorFile` ja selaineditori hylkäävät polut
    työtilan ulkopuolelta, eivätkä suhteelliset linkit toimi.
  - *Ei tiedostoa*: selain kantaa lohkon tekstin jo valmiiksi.
    Selaineditorissa se on tallentamaton puskuri tässä välilehdessä, ja
    VS Codessa nimetön dokumentti. Levylle ei kirjoiteta mitään ennen kuin
    henkilö tallentaa, eikä siivottavaa jää. Tämä on suositus.

## Suunnat

- **A Editorissa.** Lohkon toimintosarakkeeseen tulee silmäpainike
  *Esikatselu editorissa*. Se avaa oletuseditorin luonnoksella
  `luonnos-julkaisu.md` suoraan esikatseluun, ja ilmoitusrivi kertoo *ei
  vielä työtilassa*. Kynä vaihtaa tekstiin. Tallenna kysyy tiedostopolun,
  ja vasta tallennus kirjoittaa tiedoston. Puhelimessa editori on
  keskustelun yläpuolella, kuten tiedostolinkeissä nyt.
- **B Paneelissa.** Sama painike avaa renderöidyn luonnoksen lukupaneeliin
  (`ViewSplit`, kuten agentin HTML-näkymät). Paneelissa ovat Kopioi
  Markdown, Laajenna ja Sulje, mutta ei muokkausta eikä tallennusta.
  Puhelimessa paneeli on koko näytöllä.
- **C Paikallaan.** Markdown-lohko piirretään keskusteluun valmiiksi
  renderöitynä korttina, jossa on Esikatselu | Lähde ja kopiointi. Pitkä
  luonnos rajataan, ja *Näytä kaikki 33 riviä* avaa sen kokonaan. Tämä
  toimii samoin kuin mermaid.

## Suositus

**A Editorissa.** Jari pyysi editorin esikatselua, ja oletuseditorissa se on
jo olemassa ja toimii myös puhelimessa. Agentin luonnoksen luonteva
seuraava askel on muokata ja tallentaa se tiedostoksi, ja editori antaa
molemmat. Tallentamaton puskuri ei vaadi väliaikaista tiedostoa eikä
siivousta, eikä se luo toista totuutta levylle.

B rakentaisi toisen esikatselupinnan editorin rinnalle, ja tiedostoksi
vieminen jäisi agentin tehtäväksi. C on halvin ja nopein lukea, mutta pitkä
luonnos vie keskustelusta tilaa. Lisäksi lukija ei näe suoraan, että
kopioitava on Markdown-lähde.

Toteutusta varten:

1. `OutputBox` tarvitsee `actions`-paikan, jota `MarkdownPre` käyttää
   `markdown`- ja `md`-lohkoille.
2. `BrowserDocument` ja `BrowserEditor` tarvitsevat luonnostilan: ei polkua,
   *Luonnos*-tila *Muokattu*-tilan sijaan, ja Tallenna kysyy polun.
3. VS Code -moottoria varten tarvitaan laajennukseen nimetön dokumentti +
   `markdown.showPreview` sekä daemonille sisältöä kantava avauspyyntö
   kokorajoineen. Vaihtoehtoisesti VS Code -käyttäjälle tarjotaan
   ensimmäisessä vaiheessa selaineditorin esikatselu.

## Kysymykset Jarille

1. Mikä suunta: A, B vai C? Katso kuvat `r1-a-editorissa-1-oletus-1440-light`,
   `r1-b-paneelissa-1-oletus-1440-light` ja `r1-c-paikallaan-1-oletus-1440-light`.
2. A:ssa luonnos avautuu tallentamattomana, ja Tallenna kysyy paikan
   (`r1-a-editorissa-3-tallenna-1440-light`). Kelpaako tämä, vai pitäisikö
   Esikatselun kirjoittaa tiedosto heti työtilaan agentin nimeämään
   paikkaan?
3. Puhelimessa A pinoaa editorin keskustelun yläpuolelle
   (`r1-a-editorissa-1-oletus-390-light`). Kelpaako tämä, vai pitäisikö
   puhelimessa avata koko näytölle kuten B (`r1-b-paneelissa-1-oletus-390-light`)?

## Todisteet

`evidence/r1-*`: jokainen suunta vaaleana ja tummana leveyksillä 1440 ja
390 px, kertoimella 2. Nimissä on suunta, vaihe ja tila: `1-oletus`, A:ssa
lisäksi `2-teksti`, `3-tallenna`, `4-tallennettu`, `5-suljettu` ja
`6-lyhyt`, B:ssä `2-laajennettu` (vain työpöytä), `3-suljettu` ja `4-lyhyt`
sekä C:ssä `2-kaikki`, `3-lahde` ja `4-lyhyt`. `check.mjs`: 92
tarkistuspistettä, konsoli puhdas.

```
node design-system/prototypes/rounds/2026-11-06-md-lohkon-esikatselu/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/md-lohkon-esikatselu/offline.html \
  --title "Markdown-lohkon esikatselu – kierros 1" \
  --idempotency-key "$(uuidgen)" --json
```
