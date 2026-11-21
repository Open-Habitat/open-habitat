# Villen prosessit oikeuksien jälkeen

- **1 Kortti** (suositus): vain omistajan näkemä kortti keskustelussa
  listaa Villen pyynnöistä käynnistetyt prosessit tunnisteineen: komento,
  Villen viesti (aika, lainaus, Näytä viesti), käynnistysaika, tulostaako
  se yhä ja viimeinen rivi. Jokaisella on Pysäytä, ja kun prosesseja on
  useampi, kortissa on Pysäytä kaikki. Jätä käyntiin taittaa kortin riviksi.
  Kortti pysyy paikallaan, ja osallistujarivillä lukee "Villeltä 2 prosessia
  käynnissä", kunnes prosessit päättyvät.
- **2 Merkit**: keskusteluun tulee vain rivi. Prosessit ovat kentän yllä
  olevassa prosessipaneelissa, jossa Villen prosessit ovat omana ryhmänään
  hänen merkillään. Paneeli avautuu oikeuksien poiston yhteydessä. Merkissä
  näkyy Villen avatar ja lukumäärä niin kauan kuin hänen prosessejaan on
  käynnissä.
- **3 Kysymys**: tiivis kysymys rivin alla ("Pysäytetäänkö ne?"), jossa
  komennot ja painikkeet Pysäytä molemmat ja Jätä käyntiin. Tiedot avautuvat
  pyynnöstä. Kun omistaja jatkaa keskustelua, kysymys taittuu riviksi
  "Villen pyynnöistä jäi käyntiin …", josta prosessit voi yhä pysäyttää.

Issue `multiplayer-take-back-prototype`, kierros 2. Suunnat, suositus ja
kysymykset Jarille ovat issuen `result-2.md`:ssä. Kierros jatkaa kierroksen
`2026-11-21-take-back-rights` suuntaa 1 Heti (Jari 21.11.): sivu avautuu
heti sen jälkeen, kun omistaja on ottanut oikeudet pois yhdellä
painalluksella. Kesken oleva ajo jatkuu vain tekstinä, ja prosessien
pysäyttämistä tarjotaan, mutta niitä ei pysäytetä automaattisesti.

## Maailma

Aino Laine (Omistaja) antoi Ville Virtaselle täydet oikeudet klo 14.05.
Villen pyynnöistä agentti käynnisti `npm run preview` (klo 14.20, tulostaa
yhä) ja `npm test -- --watch` (klo 14.24, hiljaa 6 minuuttia). Ainon oma
`npm run build -- --watch` ei ole tarjolla pysäytettäväksi. Klo 14.29 Ville
pyysi linkkitarkistusta, ja klo 14.31 Aino otti oikeudet pois.

Kaikissa suunnissa sama:

- Poistorivillä on **Pysäytä ajo** niin kauan kuin ajo jatkuu vain tekstinä.
- Prosessin tunnisteet ovat samat (suunnassa 2 tiiviimmät: ei lainausta
  eikä viimeistä riviä).
- Pysäyttäminen tuottaa Habitat-rivin, jonka kaikki näkevät. Ville näkee
  sen omin sanoin ("Aino pysäytti `npm run preview`, jonka agentti käynnisti
  pyynnöstäsi").
- Ville ei näe tarjousta, listaa eikä painikkeita.
- Kun yhtään Villen prosessia ei ole enää käynnissä (pysäytetty tai
  päättynyt itsestään), tarjous taittuu riviksi "… ovat päättyneet".

Tapahtumapainikkeet: **Aino jatkaa** (omistaja kirjoittaa eikä reagoi
tarjoukseen), **Testit päättyvät** (prosessi päättyy itsestään), **Ajo
päättyy** (tekstiajo päättyy ja seuraava `edit` estetään), **Villen
näkymä** (puhelimessa) ja **Alkutila**. `?theme=` ja `?lang=en` valitsevat
alkutilan.

Sivu koostuu tuotannon osista (`AppShell`, `WorkspaceRail`, `AgentHeader`,
`ConversationFrame`, `ConversationTimeline`, `UserMessage`,
`AssistantMessage`, `ToolRow`, `HabitatMark`, `ControlButton`, `Markdown`,
`Composer` ja sen `beforeField`). Kierroksen omia ovat prosessirivi,
kortti, kysymys, prosessimerkki ja paneeli (suunnan 2 kuvaus tuotannon
`BackgroundStrip`-merkistä, ei itse komponentti) sekä Villen näkymä.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-21-take-back-processes/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 580 \
  node design-system/prototypes/rounds/2026-11-21-take-back-processes/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

`<out>` on oletuksena `design-system/prototypes/dist/take-back-processes`.
`web/node_modules` vastaa lukkotiedostoa (`npm ci --prefix web`). Tarkistus
tekee 943 tarkistusta, ja konsoli pysyy puhtaana: 1440 ja 390 px Päivässä,
Yössä ja Kontrastissa (kulut Päivässä ja Yössä) sekä englanniksi.
