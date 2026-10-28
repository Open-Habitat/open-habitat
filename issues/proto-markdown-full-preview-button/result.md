# Prototyyppi: koko näkymän esikatselun ikonirivi ja nopeampi näppäin

## Kierrokset

- **Kierros 1** (28.10.): ohjaimen muoto. Vaihtoehdot olivat Painike,
  Valitsin ja Kelluva. Lähde on `design-system/prototypes/rounds/2026-10-28-md-esikatselu`,
  tulos [prototypes/markdown-preview/index.html](prototypes/markdown-preview/index.html)
  ja opas [NOTES.md](prototypes/markdown-preview/NOTES.md). Jari valitsi
  Painikkeen ikoneina ilman rinnakkaista tilaa. Lisäksi sama esikatselu
  tulee muille muodoille, joissa se on mielekäs.
- **Kierros 2** (28.10., tämä): ikonirivin paikka ja kuvakkeet muodon
  mukaan. Tulos on käsin kirjoitettu offline-tiedosto
  [prototypes/full-preview-icons/index.html](prototypes/full-preview-icons/index.html),
  ja Jarin opas on [NOTES.md](prototypes/full-preview-icons/NOTES.md).
  Kuvat ovat hakemistossa `prototypes/full-preview-icons/evidence/`
  (laitteen skaalauskerroin 2).

Rakennus ja tarkistus:

```
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright NODE_PATH=<checkout>/web/node_modules \
  node issues/proto-markdown-full-preview-button/prototypes/full-preview-icons/verify.mjs
```

`build.mjs` kokoaa `src/`-hakemiston käsin kirjoitetun sivun, tokenit,
fontit ja synteettiset tiedostot yhdeksi tiedostoksi. Tuotantokomponentteja
ei niputeta, koska niputettu rakennus näkyy Habitatin näkymissä tyhjänä.
`verify.mjs` käy jokaisen suunnan läpi 1440 ja 390 px leveydellä, vaaleana
ja tummana. Se tarkistaa nämä:

- ⌘E ja ⌘⇧V avaavat esikatselun tekstin tilalle samaan osioon ja fokus
  siirtyy esikatseluun.
- Esc palaa tekstiin siihen kohtaan, johon esikatselussa luettiin.
- Suunnan oma ohjain avaa ja sulkee esikatselun.
- Nuolinäppäin esikatselussa ei vaihda suuntaa.
- CSV avautuu taulukkona samalle riville ja palaa samalle riville.
- SVG piirtyy kuvana.
- HTML näkyy `sandbox=""`-kehyksessä, ja tiedoston oma skripti estyy.
- JSON-tiedostossa ei ole riviä, eivätkä näppäimet tee mitään.
- Mikään ei vuoda vaakasuunnassa, valitsin on kunnossa, eikä sivu tee
  verkkopyyntöjä.

Tulos 28.10.: `PASS: 12 direction×size×theme cases`. Ainoa konsoliviesti
on Chromiumin ilmoitus HTML-tiedoston estetystä skriptistä, ja tarkistus
vaatii sen.

## Akseli ja suunnat

Akseli: **missä ikonirivi on ja mitä kuvakkeita siinä on.** Muu on
kaikissa suunnissa samaa: näppäimet, Esc, paluu samaan kohtaan, muodot
ja niiden kuvakkeet.

| Suunta | Paikka | Kuvakkeet | Mitä suunta päättää |
| --- | --- | --- | --- |
| 1 Tiedostorivi | Työkalurivi (`.ah-browser-toolbar`) tiedostonimen ja Tallennan välissä, nykyisen *Esikatselu*-tekstipainikkeen paikalla | Kaksi kuvaketta yhtenä ryhmänä (`role="group"`, `aria-pressed`): kynä *Teksti* ja muodon kuvake (*Esikatselu*, *Taulukko*, *Kuva*, *Sivu*) | Tila näkyy aina, ja paluu tekstiin on oma painikkeensa. |
| 2 Otsikkopalkki | `EditorHeader` ikkunapainikkeiden (‹ ×) vasemmalla puolella, erottimen takana | Yksi muodon kuvake `aria-pressed`-kytkimenä: painettuna esikatselu on auki, ja uusi painallus palaa tekstiin | Editorin otsikkopalkki saa tiedostokohtaisen toiminnon. Työkalurivi ei muutu. |
| 3 Kulma | Kelluu dokumentin päällä oikeassa yläkulmassa ja puhelimessa oikeassa alakulmassa | Sama pari kuin suunnassa 1 | Editoriin tulee kelluva ohjain. Työkalurivi ei muutu. |

## Muodot: mitä editori jo näyttää ja mitä esikatselu olisi

Editori avaa vain tekstiä. Daemon hylkää muun kuin UTF-8:n,
NUL-tavun, sekalaiset rivinvaihdot ja yli 1 MiB:n tiedostot
(`internal/daemon/editor_files_linux.go`, `editorTextLimit` ja
`reason`), ja tiedostopuu näyttää ne harmaana *unsupported*-rivinä
(`web/src/components/EditorFileTree.tsx`). Kielioppi tulee
tiedostopäätteestä (`web/src/components/editorGrammar.ts`).

| Muoto | Esikatselu | Renderöijä tuotannossa | Arvio |
| --- | --- | --- | --- |
| Markdown `.md`, `.markdown` | Muotoiltu teksti | On: `Markdown` (`web/src/components/Markdown.tsx`), jota editori jo käyttää (`BrowserEditor.tsx` `markdownPath`) | Kyllä |
| CSV `.csv`, TSV `.tsv` | Koko tiedosto taulukkona. Otsikkorivi ja rivinumerosarake pysyvät paikallaan, ja numerot tasataan oikealle. | Osittain: `csvSeparator` ja `tableRows` (`web/src/components/AttachmentPreview.tsx`) jäsentävät tiedoston, mutta vain 60 riviä ja 50 saraketta liitteen esikatselua varten. Editorissa raja nostetaan, ja rivinumerot tarvitsevat rivien lähdekohdan. | Kyllä |
| SVG `.svg` | Kuva `<img>`-elementissä ruudukkotaustalla. `<img>` ei suorita skriptejä eikä hae mitään. | Ei. Tarvitaan blob-URL puskurista ja kuvakomponentti. | Kyllä |
| HTML `.html`, `.htm` | Sivu kehyksessä ilman skriptejä ja verkkoa. Linkit ja suhteelliset kuvat eivät toimi, ja yläreunan rivi kertoo sen. | Malli on olemassa: Word-esikatselun `sandbox=""`-kehys, `frameCSP` ja `inertMarkup` (`web/src/app/documentPreview.ts`, `DocumentPreview.tsx` `WordFrame`) | Kyllä, rajoituksin |
| JSON, YAML, TOML, koodi | Ei esikatselua. CodeMirror taittaa jo lohkot (`foldGutter`), eikä puunäkymä toisi lisää. | – | Ei |
| Kuvat (PNG, JPEG, GIF, WebP), PDF, docx, xlsx, pptx | Editori ei avaa niitä. Ne ovat binäärisiä, ja puu näyttää ne harmaina. Liitteiden renderöijät ovat olemassa (`DocumentPreview.tsx`, `AttachmentPreview.tsx`). | – | Ei tähän issueen. Työtilan tiedostojen katseluohjelma on oma ominaisuutensa: editorin lukureitti palauttaa vain tekstiä, joten binääritiedosto tarvitsee oman lukureittinsä. |

## Pikanäppäin

- **Säilyy: Ctrl/Cmd+Shift+V.** Se vaihtaa tekstin ja esikatselun välillä
  kuten VS Codessa ja code-serverissä.
- **Uusi: Ctrl/Cmd+E** (Macissa ⌘E). Se tekee saman kahdella
  näppäimellä, ja E muistuttaa sanasta *esikatselu*.
- **Esc** palaa esikatselusta tekstiin.
- **Ctrl/Cmd+K V poistuu**, koska rinnakkaista tilaa ei ole. Samalla
  poistuu Ctrl/Cmd+K:n nielaisu kaikissa Markdown-tiedostoissa.

Ristiriidat tarkistettiin:

- **CodeMirror.** Editori käyttää näppäinkarttoja `defaultKeymap`,
  `historyKeymap` ja `foldKeymap` sekä omaa `Mod-s`:ää
  (`CodeMirrorEditor.tsx`). Asennetuissa paketeissa
  (`@codemirror/commands`, `@codemirror/language`) ei ole `Mod-e`- eikä
  `Mod-Shift-v`-sidontaa. `Ctrl-e` (rivin loppuun) on vain Macin
  Emacs-sidonta (`emacsStyleKeymap`, `mac:`), ja Macissa Mod on Cmd,
  joten ⌘E on eri näppäin.
- **Habitat.** Sovelluksen muut pikanäppäimet ovat Mod+Alt+K (editori,
  `web/src/app/editor.ts`), Alt+T (pääte, `terminalShortcut.ts`) ja
  Mod+P (kenttä, `Composer.tsx`). Kuuntelija on vain editorin juuressa
  esikatseltavan tiedoston ollessa auki.
- **code-server.** Se on eri editori omassa kehyksessään, eikä Habitatin
  kuuntelija ole siinä mukana, joten ajonaikaista ristiriitaa ei ole.
  Lihasmuistissa ero kuitenkin on: VS Codessa Ctrl+E on Quick Open
  (Windows ja Linux) ja Cmd+E *Use selection for find* (Mac), eikä
  code-server opi ⌘E:tä, ellei sen `keybindings.json`iin lisätä sidontaa.
- **Selaimet.** Ctrl+E siirtää Chromessa, Edgessä ja Firefoxissa
  (Windows ja Linux) fokuksen hakukenttään, ja ⌘E on Macin selaimissa
  *Käytä valintaa hakuun*. Molemmat sivu voi ohittaa `preventDefault`illa,
  toisin kuin selaimen varaamat Ctrl+T, W ja N. Tuotanto ohittaa samoin
  jo ⌘⇧V:n. Tämä perustuu selainten tunnettuun käytökseen; sitä ei ole
  kokeiltu jokaisella selaimella.
- **Tunnistus.** Näppäin tunnistetaan `e.code === "KeyE"`:llä, ja
  `!e.altKey` sulkee pois AltGr:n, joka saapuu Windowsissa Ctrl+Altina.

## Host-faktat, joita näkymä olettaa

| Fakta | Suunta | Onko olemassa |
| --- | --- | --- |
| Esikatselun tila tekstin tilalla | kaikki | On: `BrowserEditor.tsx` `Preview = "off" \| "side" \| "only"`. Tila `side` ja kapean paneelin sääntö (`BrowserEditor.css` `@container ah-editor-panes`) poistuvat. |
| Ctrl/Cmd+Shift+V editorin juuren capture-kuuntelijassa ennen CodeMirroria | kaikki | On |
| Ctrl/Cmd+E samassa kuuntelijassa (`e.code`) | kaikki | Ei |
| Ctrl/Cmd+K V -sointu | – | On, ja se poistetaan |
| Esc palaa esikatselusta tekstiin | kaikki | Ei |
| Fokus siirtyy jäljelle jäävään osaan | kaikki | On: `toggle` ja `requestAnimationFrame` |
| Paluu samaan kohtaan: Markdownissa otsikoiden järjestys ja suhteellinen kohta osiossa, CSV:ssä rivi = rivi | kaikki | Ei. Tuotannossa esikatselu alkaa alusta. |
| Esikatselu useammalle muodolle: muodon tunnistus päätteestä ja renderöijä muodoittain (Markdown, CSV ja TSV, SVG, HTML) | kaikki | Osittain: vain `markdownPath` on olemassa. CSV:n jäsennin on liitteissä, SVG:n renderöijää ei ole, ja HTML:n kehysmalli on Word-esikatselussa. |
| Kuvakkeet: kynä, silmä, taulukko ja kuva | kaikki | On: `web/src/components/Icon.tsx` (`pencil`, `eye`, `table`, `image`) |
| Kuvakepari yhtenä ryhmänä | 1, 3 | Lähes: `ControlButton presentation="segment"` (`ControlElements.tsx`, `Controls.module.css` `.segmented`/`.segment`) on tekstisegmentti. Ikonisegmentti on uusi esitys. |
| Kuvake `EditorHeader`issa | 2 | Rakenne on (`EditorHeader.tsx` `.ah-editor-controls`), mutta otsikkopalkki ei tiedä avoimesta tiedostosta. `WorkspaceEditor.tsx`:n on välitettävä esikatselun tila ja muoto `BrowserDocument`ilta otsikkopalkille. |
| Kelluva ohjain dokumentin päällä | 3 | Esitys on (`Controls.module.css` `.floating`), mutta editorissa ei ole kelluvia ohjaimia |
| Vihje, jossa pikanäppäin näkyy osoittimella ja fokuksella | kaikki | `aria-keyshortcuts` on. Näkyvä vihje on tarkistettava tuotannon tooltip-komponentista. |

Muutos koskee vain selaimen editoria. Se ei koske daemonia, gatewayta,
provisionia tai sopimusta, eikä mikään suunta siirrä valtuutta. HTML:n
esikatselu näyttää käyttäjän oman tiedoston hänen omassa selaimessaan
ilman skriptejä ja verkkoa, samalla mallilla kuin Word-liitteen
esikatselu.

## Suositus

**1 Tiedostorivi**, muodon mukaisin kuvakkein, ⌘E ja ⌘⇧V sekä Esc.

Pari näyttää aina, kumpi tila on auki. Kynä antaa paluun tekstiin myös
puhelimessa, jossa Esc:iä ei ole. Painikkeet ovat siellä, missä
*Esikatselu* on nyt, eli avoimen tiedoston vieressä. Toteutus pysyy
`BrowserEditor`issa, eikä otsikkopalkin tarvitse tietää tiedostosta.
Otsikkopalkki vie vähiten tilaa, mutta yksittäinen painettu kuvake ei
näytä yhtä selvästi paluuta, ja se vaatii tilan nostamisen
`WorkspaceEditor`iin. Kulma on paras peukalolle, mutta se peittää rivien
loppua, ja kierroksella 1 Jari valitsi painikkeen kelluvan sijaan.

## Decisions for later review

- **Uusi pikanäppäin on Ctrl/Cmd+E, ja ⌘⇧V säilyy.** Vaihtoehdot:
  - Pelkkä ⌘⇧V. Se on jo yksi painallus, mutta kolme näppäintä.
  - Ctrl/Cmd+Alt+V kierrokselta 1. Se ei ole nopeampi, ja Macissa Option
    muuttaa merkin.
  - Pelkkä kirjain. Se ei käy, koska tekstiin kirjoitetaan.

  Valitsin E:n, koska se on kahden näppäimen yhdistelmä, vapaa
  CodeMirrorissa ja Habitatissa ja selaimissa ohitettavissa, ja koska se
  muistuttaa sanasta *esikatselu*.
- **⌘E:tä ei lisätä code-serverin näppäimiin.** Vaihtoehto oli
  `keybindings.json`-sidonta `markdown.showPreview`ille Fleetrepon
  asennukseen. Jätin sen pois, koska code-serverin asetukset ovat
  käyttäjän omia, eikä tämä issue koske code-serveriä.
- **Cmd+K V poistuu, eikä Ctrl/Cmd+K:ta enää nielaista.** Rinnakkaista
  tilaa ei ole, joten soinnulle ei jää tehtävää.
- **Esikatselu tulee Markdownille, CSV:lle ja TSV:lle, SVG:lle ja
  HTML:lle.** JSONille, YAMLille ja koodille sitä ei tule, koska taitto
  riittää, eikä puunäkymä ole esikatselu. Binääritiedostot jäävät
  editorin ulkopuolelle, ja niiden katselu on erillinen
  tiedostonkatseluohjelman ominaisuus.
- **HTML näytetään ilman skriptejä.** Vaihtoehdot:
  - Skriptit sallitaan eristetyssä kehyksessä. Tämä on hylätty, koska se
    ajaisi työtilan koodia Habitatin sivulla.
  - HTML jätetään ilman esikatselua.

  Valitsin Word-esikatselun mallin (`sandbox=""`, `frameCSP` ja
  `inertMarkup`). Sivun ulkoasu näkyy, mutta mikään ei suoritu. Linkit
  ja suhteelliset kuvat eivät toimi, ja yläreunan rivi kertoo sen.
- **CSV näytetään kokonaan, ei 60 riviä kuten liitteessä.** Editori
  avaa enintään 1 MiB:n tiedoston. Toteuttaja voi rajata taulukon, jos
  suuri tiedosto hidastaa, mutta silloin rajaus kerrotaan rivillä.
- **Kuvakkeen nimi muodon mukaan:** *Esikatselu*, *Taulukko*, *Kuva* ja
  *Sivu*. Vaihtoehto oli *Esikatselu* kaikille. Muodon nimi kertoo
  ennalta, mitä painike näyttää, ja nimi on vihjeessä ja `aria-label`issa.
- **Paluu samaan kohtaan ja Esc** säilyvät kierrokselta 1. CSV saa saman
  rivi rivistä -vastaavuuden. SVG ja HTML ovat yksi kuva, joten niissä
  kohtaa ei ole.
- **Kulma-suunnan ohjain on puhelimessa alakulmassa** eikä yläkulmassa,
  koska peukalo ylettää sinne ja ensimmäiset rivit jäävät näkyviin.
