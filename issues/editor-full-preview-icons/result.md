# Tulos: editorin ikonirivi ja koko näkymän esikatselu

Toteutettu Jarin valitsema suunta 1 *Tiedostorivi* (prototyyppi
`issues/proto-markdown-full-preview-button/prototypes/full-preview-icons/`).

## Mitä muuttui

- **Ikonipari työkalurivillä** entisen *Esikatselu*-painikkeen paikalla:
  kynä (*Teksti*) ja muodon kuvake yhtenä ryhmänä (`fieldset`,
  `aria-pressed`). Kuvake ja nimi muodon mukaan: Markdown silmä
  *Esikatselu*, CSV/TSV taulukko *Taulukko*, SVG kuva *Kuva*, HTML silmä
  *Sivu*. JSONille, YAMLille ja koodille riviä ei ole.
- **Tallenna on ikoni** samassa rivissä (levykekuvake, `aria-label`
  *Tallenna*, vihje *Tallenna · Ctrl+S/⌘S*). Tallentamattomat muutokset
  täyttävät ikonin aksenttivärillä, ja työpöydällä *Muokattu* näkyy yhä
  polun vieressä.
- **Näppäimet:** Ctrl/Cmd+E ja Ctrl/Cmd+Shift+V vaihtavat tekstin ja
  esikatselun välillä, Esc palaa tekstiin, Ctrl/Cmd+K V on poistettu (eikä
  Ctrl/Cmd+K:ta enää nielaista). Näppäin tunnistetaan `e.code`-arvosta,
  AltGr (Ctrl+Alt) jätetään rauhaan, ja Macissa Mod on Cmd, joten Ctrl+E
  on yhä CodeMirrorin rivin loppu. Esikatselussa Ctrl/Cmd+S tallentaa.
- **Sama kohta molempiin suuntiin:** Markdown otsikoiden järjestyksen ja
  osion sisäisen suhteellisen kohdan mukaan, CSV rivi rivistä
  (taulukon rivinumerot ovat tekstin rivinumeroita, joten lainausmerkeissä
  oleva rivinvaihto näkyy hyppynä). SVG ja HTML ovat yksi näkymä.
- **Esikatselut:** Markdown kuten ennen. CSV/TSV taulukkona, otsikkorivi ja
  rivinumerot pysyvät paikallaan, numerot oikealla. SVG `<img>`-kuvana
  ruudukkotaustalla ja mittoineen. HTML `sandbox=""`-kehyksessä
  Word-esikatselun mallilla (`inertMarkup`, `frameCSP`), ja yläreunan rivi
  kertoo, ettei skriptejä ajeta eikä verkosta haeta, eivätkä linkit ja
  suhteelliset kuvat toimi.
- Rinnakkainen esikatselu (`side`) ja sen kapean paneelin sääntö
  poistuivat.

Koodi: `web/src/components/BrowserEditor.tsx`, `EditorFilePreview.tsx`
(laiska, ladataan kun taulukko, kuva tai sivu avataan), `editorPreview.ts`
(muodot ja kohdan kuvaus), `csvTable.ts` (liitteen CSV-jäsennin siirretty
tänne ja lisätty rivin lähderivi), `CodeMirrorEditor.tsx` (`place`:
ylin rivi ja rivin vieritys), `Icon.tsx` (`save`).

## Tarkistukset (synteettinen isäntä)

- `./scripts/test-focused.sh --area web`: läpi (tyypit, lint, 133
  yksikkö- ja komponenttitiedostoa). Uudet: `editorPreview.test.ts`
  (muodot, otsikkorivit aidatuissa lohkoissa, kohdan meno-paluu,
  HTML:n inertti sivu ilman skriptejä, linkkejä, lomakkeita, kehyksiä ja
  verkkoviittauksia), `csvTable.test.ts` (rivin lähderivi).
- `browser-editor.spec.ts` (21/21), `browser-editor-concurrent.spec.ts`
  (5/5) sekä lab-specit `lab-browser-editor`, `lab-filetree`,
  `lab-editor-syntax`, `lab-editor-settings`, `lab-git-status`,
  `lab-workspace-page`, `lab-worktree-agent`: läpi
  (`OH_BROWSER_WORKERS=2`, `OH_PORT_BASE=5700`).
  Uusi tapaus *table, picture and page previews* (1366 ja 390):
  CSV avautuu tekstin rivillä ja palaa taulukon riville, rivinumero
  seuraa tekstiriviä, SVG:n skripti ei aja eikä kuva hae mitään, kuvan
  osoite on `data:`, HTML-kehys on `sandbox=""`, sen sisällä ei ole
  skriptiä eikä linkkiä, kehyksen `contentDocument` on `null`
  (läpinäkymätön alkuperä), eikä sivu tee yhtään pyyntöä
  `example.test`-, `kuva.png`- tai `tyyli.css`-osoitteisiin. Markdown-tapaus
  kattaa Ctrl+Shift+V:n, Ctrl+E:n, Escin, kynän ja Ctrl+S:n esikatselusta.
- `go test ./test/browser-host/`: läpi.
- Koko selainsarjaa ei ajettu (kapellimestari ajaa sen integroidulla
  mainilla).

### Ctrl+E Chromiumissa

Tarkistettu oikeilla X-näppäinpainalluksilla (XTEST, Xvfb) ikkunalliseen
Chromium 153:een (Playwrightin Chrome for Testing), synteettisessä labissa
`cmd/notes.md` auki ja fokus tekstissä. Näppäimet kulkevat selaimen oman
näppäinkäsittelyn läpi, eivät CDP:n:
`{"ctrlE":true,"focusInPage":true,"escBack":true,"ctrlShiftV":true,"ctrlShiftVBack":true}`.
Ctrl+E avasi esikatselun, fokus pysyi sivulla, Esc palasi, Ctrl+Shift+V
avasi ja sulki. Selain ei siis niele Ctrl+E:tä, kun editorilla on fokus.

Raja: vertailutapaus (Ctrl+E ja Ctrl+L koodi-tiedostossa, jossa
kuuntelijaa ei ole) ei näyttänyt selaimen omaa toimintoa tässä
ympäristössä (sivu ei menettänyt fokusta kummallakaan), joten sitä, että
`preventDefault` nimenomaan ohittaa Chromen oman Ctrl+E:n, ei pystytty
näyttämään erikseen. Tulos nojaa siihen, että Chrome toimittaa
varaamattomat pikanäppäimet ensin sivulle. Macin ⌘E:tä ei kokeiltu
(ei Mac-selainta tässä). Skriptit: [keycheck/](keycheck/).

## Kuvat

`evidence/`, laitteen skaalauskerroin 2, synteettinen lab
(`web/lab/capture-editor-full-preview.mjs`): työpöytä 1440 ja puhelin
390, vaalea ja tumma: `md-teksti` (muokattu, täytetty Tallenna),
`md-esikatselu`, `csv-taulukko`; vaaleana lisäksi `svg-kuva` ja
`html-sivu`. HTML-kaksoset vain työpöydän vaaleille (kukin noin 550 kt
upotettuine fontteineen).

## Decisions for later review

- **Tallenna täyttyy aksenttivärillä, kun muutoksia on.** Vaihtoehdot:
  ikoni aina samannäköisenä (tila vain *Muokattu*-tekstinä) tai pieni piste
  ikonissa. Valitsin täytön, koska tuotteen pois käytöstä -tyyli piirtää
  laatikon, jolloin pelkkä ikoni näytti käytössä hiljaisemmalta kuin pois
  käytöstä. Täytetty ikoni näyttää tallentamattoman tilan myös ilman
  sanaa.
- **Puhelimessa *Muokattu* on vain ruudunlukijalle.** Sana työnsi ikonit
  toiselle riville 390 px:n leveydellä. Täytetty Tallenna kertoo saman.
  Samoin *Tallennetaan*. Tuonnit ja ristiriidat näkyvät kuten ennen
  omalla rivillään.
- **Korvaava tallennus pysyy tekstipainikkeena** (*Tallenna ja korvaa
  agentin versio*). Vaihtoehto oli sama ikoni punaisena. Se on harvinainen
  ja peruuttamaton valinta, joten sanat jäävät.
- **Vihje on selaimen oma `title`.** Tuotannossa ei ole vihjekomponenttia;
  prototyypin tyylitelty vihje olisi uusi komponentti. Puhelimessa
  vihjettä ei näy.
- **Esikatselu kuuluu tiedostolle, jolla se avattiin.** Toinen tiedosto
  avautuu tekstinä, ja rivilinkki (`tiedosto:rivi`) palauttaa tekstiin.
  Vaihtoehto oli muistaa tila kaikille tiedostoille.
- **Fokus:** näppäimellä avattu esikatselu saa fokuksen; painikkeella
  avattaessa fokus jää painikkeeseen. Paluu tekstiin ei siirrä kursoria,
  vaan vierittää luetun kohdan näkyviin.
- **CSV:stä näytetään enintään 5 000 riviä ja 200 saraketta**, ja otsikon
  alla kerrotaan rajaus. Editori avaa 1 MiB:n tiedoston, ja kymmenet
  tuhannet rivit jäädyttäisivät välilehden.
- **SVG on `data:`-osoite eikä `blob:`.** Blob jakaa sovelluksen
  alkuperän, ja kuvan avaaminen omaan välilehteen olisi ajanut kuvan
  skriptit siellä.
- **Esc ei toimi HTML-kehyksen sisällä** (kehys on eri alkuperää eikä
  välitä näppäimiä). Kynä palaa tekstiin.
- **Uusi kuvake `save`** (levyke) `Icon.tsx`:ään; olemassa oleva `disk` on
  kiintolevy.
