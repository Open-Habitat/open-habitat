# Prototyyppi: koko näkymän esikatselun painike ja nopeampi näppäin

Kierros `design-system/prototypes/rounds/2026-10-28-md-esikatselu`, tulos
[prototypes/markdown-preview/index.html](prototypes/markdown-preview/index.html),
Jarin opas [prototypes/markdown-preview/NOTES.md](prototypes/markdown-preview/NOTES.md)
ja kuvat `prototypes/markdown-preview/evidence/` (laitteen skaalauskerroin 2).
Pohjana on nykyinen toteutus (`web/src/components/BrowserEditor.tsx`,
`CodeMirrorEditor.tsx`; editor-markdown-preview-folding): yksi
*Esikatselu*-painike rinnakkaiselle, Ctrl/Cmd+Shift+V tekstin tilalle ja
Ctrl/Cmd+K V rinnalle. Kapeampi kuin 720 px paneeli näyttää rinnakkaisen
tekstin tilalla.

Rakennus ja tarkistus (rakentaa tiedoston ja ottaa kuvat):

```
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright NODE_PATH=<checkout>/web/node_modules \
  node design-system/prototypes/rounds/2026-10-28-md-esikatselu/verify.mjs
```

Tarkistus käy jokaisen suunnan läpi 1440 ja 390 px leveydellä sekä vaaleana
että tummana. Se tarkistaa nämä: ⌘⇧V avaa esikatselun tekstin tilalle
samaan osioon ja siirtää fokuksen esikatseluun, Esc palaa tekstiin siihen
kohtaan, johon esikatselussa luettiin, ja suunnan oma ohjain avaa ja sulkee
esikatselun. Lisäksi ⌘⌥V näyttää esikatselun rinnalla, kirjoitus päivittää
esikatselun ja kapeasta paneelista puuttuu rinnakkaisen ohjain. Valitsin on
kunnossa, mikään ei vuoda vaakasuunnassa, eikä konsolissa ole virheitä tai
verkkopyyntöjä. Tulos 28.10.: `PASS: 12 direction×size×theme cases`.

## Akseli ja suunnat

Akseli: **minkä muotoinen ohjain koko näkymän esikatselulla on.** Muu on
kaikissa suunnissa samaa: näppäimet, Esc, paluu samaan kohtaan, kapean
paneelin sääntö, vihjeet ja pitkä tiedosto (`saaristoretki-2027.md`,
132 riviä otsikoita, listoja, taulukoita, lainaus ja koodiaita).

| Suunta | Ohjain | Mitä suunta päättää |
| --- | --- | --- |
| 1 Painike | Työkalurivillä *Esikatselu* (silmä ja teksti) avaa koko näkymän, ja sen vieressä on kuvake rinnakkaiselle. Molemmat ovat `aria-pressed`-painikkeita, joiden uusi painallus sulkee esikatselun. Kapeassa paneelissa kuvake jää pois. | Nykyinen painike vaihtaa merkitystä rinnakkaisesta koko näkymään. Rinnakkainen saa pienen kuvakkeen. |
| 2 Valitsin | Työkalurivillä on segmentoitu valitsin *Teksti · Rinnakkain · Esikatselu* (tuotannon `presentation="segment"`). Kapeassa paneelissa valitsin on *Teksti · Esikatselu*. | Esikatselu on editorin tila, joka näkyy aina, eikä sitä käytetä kytkimellä. |
| 3 Kelluva | Työkalurivillä ei ole esikatselua. Dokumentin oikeassa alakulmassa kelluu *Esikatselu*, joka vaihtuu *Muokkaa*-painikkeeksi, ja leveässä paneelissa sen yllä on pieni rinnakkaisen kuvake. | Ohjain siirtyy työkaluriviltä dokumenttiin peukalon ulottuville. Tämä on editorille uusi kelluva muoto. |

## Pikanäppäin

Säilyy: **Ctrl/Cmd+Shift+V** vaihtaa tekstin ja koko näkymän esikatselun
välillä (Jarin toive). Uusi: **Ctrl/Cmd+Alt+V** (Macissa ⌘⌥V) vaihtaa
rinnakkaisen esikatselun yhdellä painalluksella Cmd+K V:n sijaan. Lisäksi
**Esc** palaa koko näkymästä tekstiin.

Miksi Ctrl/Cmd+Alt+V:

- Sitä ei ole CodeMirrorin näppäinkartoissa. Tarkistin tämän asennetuista
  `@codemirror/commands`- ja `language`-paketeista: Mod-Alt-yhdistelmiä
  ovat vain nuolet, `\` sekä `[` ja `]`.
- Selaimissa se on V:n yhdistelmistä vapaa. ⌘⇧V ja ⌥⇧⌘V ovat Macissa
  *Liitä ja sovita tyyli*, ja Ctrl+Shift+V liittää muissa järjestelmissä
  pelkän tekstin. Tuotanto ohittaa jo ⌘⇧V:n `preventDefault`illa, ja ⌘⌥V
  ja Ctrl+Alt+V ovat vapaita. Tämä perustuu tunnettuihin oletuksiin, eikä
  sitä ole kokeiltu jokaisessa selaimessa.
- Se on sama kirjain kuin koko näkymällä, ja vain muunnosnäppäin vaihtuu.

Varaukset, jotka toteutuksen on hoidettava:

- Macissa Option muuttaa merkin (⌥V on `√`), joten tunnistus tehdään
  `e.code === "KeyV"`:llä eikä `e.key`:llä.
- Windowsissa AltGr lähettää Ctrl+Alt. Tunnistus ohittaa siksi
  `e.getModifierState("AltGraph")`-painallukset, jotta AltGr+V kirjoittaa
  merkin niillä asetteluilla, joilla se on käytössä.

Hylätyt vaihtoehdot: Ctrl/Cmd+Shift+B on Chromessa kirjanmerkkipalkki,
Ctrl+Shift+M on Firefoxin responsiivinen tila, ja Alt+Shift+V kirjoittaa
Macissa merkin `◊`. Pelkkä kirjain ei käy, koska tekstissä kirjoitetaan.

## Host-faktat, joita näkymä olettaa

| Fakta | Suunta | Onko olemassa |
| --- | --- | --- |
| Esikatselun tilat pois, rinnakkain ja tekstin tilalla, sekä kapean paneelin sääntö (alle 720 px rinnakkainen näytetään tekstin tilalla) | kaikki | On (`BrowserEditor.tsx`, `BrowserEditor.css` `@container ah-editor-panes`) |
| Ctrl/Cmd+Shift+V editorin juuren capture-kuuntelijassa ennen CodeMirroria | kaikki | On |
| Ctrl/Cmd+Alt+V `e.code`:lla ja AltGr-poikkeuksella | kaikki | Ei. Tilalle tulee Ctrl/Cmd+K V -sointu ja sen Ctrl/Cmd+K-nielaisu. |
| Esc koko näkymän esikatselussa palaa tekstiin | kaikki | Ei |
| Fokus siirtyy jäljelle jäävään osaan, kun fokusoitu osa piilotetaan | kaikki | On (`toggle` ja `requestAnimationFrame`) |
| Paluu samaan kohtaan: esikatselu avautuu tekstin yläreunan osioon ja teksti palaa esikatselussa luettuun kohtaan (otsikkoankkurit ja suhteellinen kohta osion sisällä) | kaikki | Ei. Tuotannossa esikatselu alkaa alusta. Lähde- ja esikatselurivien vastaavuutta ei ole, joten se tehdään otsikoiden järjestyksestä: CodeMirrorin Markdown-puun otsikot ja esikatselun `h1–h6` samassa järjestyksessä. |
| Kirjoitettaessa rinnakkainen esikatselu pitää muokattavan osion näkyvissä | kaikki | Ei (edellisen issuen päätös: ei vierityksen synkronointia) |
| Rinnakkaisen ohjaimen piilotus kapeassa paneelissa: JS:n tieto paneelin leveydestä tai saman container queryn sääntö ohjaimelle | 1, 2, 3 | Osittain: container query on olemassa, mutta se ei koske työkaluriviä, joka on `ah-editor-panes`-säiliön ulkopuolella. Tarvitaan `ResizeObserver` tai säiliö koko editorille. |
| Kuvakkeet: silmä, rinnakkain ja kynä | 1, 2, 3 | Ei editorissa. Projektin kuvakesarjasta on tarkistettava, onko niitä. |
| Segmentoitu valitsin `ControlButton presentation="segment"` | 2 | On (`ControlElements.tsx`, `Controls.module.css` `.segmented`/`.segment`) |
| Kelluva painike dokumentin päällä (`.floating`-esitys) | 3 | Esitys on olemassa (`Controls.module.css` `.floating`), mutta editorissa ei ole kelluvia ohjaimia |
| Vihje, jossa näkyy pikanäppäin (`aria-keyshortcuts` ja näkyvä vihje) | kaikki | `aria-keyshortcuts` on. Näkyvän vihjeen esitys on tarkistettava tuotannon tooltip-komponentista. |

Muutos koskee vain selaimen editoria. Se ei koske daemonia, gatewayta,
provisionia tai sopimusta, eikä mikään suunta siirrä valtuutta.

## Suositus

**1 Painike.** Jari pyysi omaa painiketta koko näkymän esikatselulle, ja
tämä suunta antaa sen nykyisen *Esikatselun* paikalle ilman uutta muotoa.
Rinnakkainen saa pienen kuvakkeen, jota tarvitaan vain leveässä
paneelissa. Työkalurivi kasvaa yhdellä 32 px:n kuvakkeella, ja puhelimessa
se ei kasva lainkaan. Valitsin näyttää tilan selvimmin, mutta se vie
tiiviiltä riviltä noin 300 px ja puhelimessa yhden rivin lisää, vaikka
puhelimessa tiloja on vain kaksi. Kelluva on paras peukalolle, mutta se
peittää tekstiä ja tuo editoriin muodon, jota siinä ei muuten ole.

## Decisions for later review

- **Rinnakkaisen pikanäppäin on Ctrl/Cmd+Alt+V.** Vaihtoehdot olivat
  Cmd+K V:n säilyttäminen ja vain koko näkymän nopeuttaminen tai toinen
  kirjain (B tai M törmäävät selaimiin). Valitsin yhden painalluksen
  yhdistelmän, joka käyttää samaa kirjainta kuin koko näkymä ja on vapaa
  sekä CodeMirrorissa että selaimissa.
- **Cmd+K V poistuu, ei jää rinnakkaiseksi aliakseksi.** Vaihtoehtona oli
  säilyttää se VS Coden lihasmuistin vuoksi. Poistin sen, koska sointu
  nielaisee nyt Ctrl/Cmd+K:n kaikissa Markdown-tiedostoissa, ja kaksi
  tapaa samaan asiaan on yksi enemmän opittavaa ja testattavaa.
- **Esc palaa koko näkymästä tekstiin.** Vaihtoehto oli, ettei Esc tee
  mitään. Esikatselu on vain luettava, joten Escillä ei ole siinä muuta
  merkitystä. Rinnakkaisessa tilassa Esc ei tee mitään, koska teksti on
  silloin näkyvissä ja Esc kuuluu CodeMirrorille.
- **Esikatselu avautuu samaan kohtaan, ja paluu tekstiin tulee luettuun
  kohtaan.** Vaihtoehto oli nykyinen alusta avautuminen. Pitkässä
  tiedostossa alusta avautuva esikatselu pakottaa etsimään kohdan, joten
  pikanäppäin olisi nopea vain lyhyessä tiedostossa. Ankkurina toimivat
  otsikot, koska rivitasoinen vastaavuus vaatisi lähdekarttaa
  Markdown-renderöijästä.
- **Rinnakkainen esikatselu seuraa kirjoitusta osion tarkkuudella.**
  Vaihtoehto oli täysi vierityksen synkronointi kuten VS Codessa. Valitsin
  kevyemmän, koska kirjoittaessa tarvitaan vain muokattavan osion näkymistä.
- **Painikkeen nimi on *Esikatselu*, ja se avaa koko näkymän.** Vaihtoehto
  oli *Koko näkymä* tai *Lue*. *Esikatselu* on jo tuttu, ja koko näkymä on
  Jarin pääkäyttö. Rinnakkaisen nimi on vihjeessä ja `aria-label`issa.
- **Kapeassa paneelissa rinnakkaisen ohjain piilotetaan** eikä näytetä
  ohjainta, joka tekisi saman kuin koko näkymä. Kahden saman tekevän
  painikkeen näyttäminen olisi harhaanjohtavaa.
