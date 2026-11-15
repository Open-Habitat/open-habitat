// Round 3 reuses round 2's synthetic conversations (two more messages in
// the tile cache, so one conversation has many hits). The round's own words and the synthetic conversations, Finnish and
// English. Production pieces (section headings, the header, the composer,
// the messages) keep their own catalogs and follow the same language choice.
// Every title, workspace and message here is invented for the round.

/** ⌘ on a Mac, Ctrl+ elsewhere, as production's altKey() writes Alt. */
export type Keys = { mod: (k: string) => string; enter: string };
export const keysFor = (mac: boolean): Keys =>
  mac
    ? { mod: (k) => `⌘${k}`, enter: "↵" }
    : { mod: (k) => `Ctrl+${k}`, enter: "Enter" };

export type ConvId =
  | "tiles"
  | "elevation"
  | "colors"
  | "notice"
  | "a11y"
  | "backups"
  | "glossary"
  | "receipts"
  | "provider";

type Conversation = { title: string; msgs: string[] };

const tileTest =
  "```\nnpm test -- tiles\n✓ caches tiles for 7 days (12 ms)\n✓ serves cached map tiles offline (8 ms)\n```";

const fiConv: Record<ConvId, Conversation> = {
  tiles: {
    title: "Karttatiilten välimuisti",
    msgs: [
      "Karttatiilet latautuvat mobiilissa hitaasti, varsinkin metsässä huonolla yhteydellä. Voisiko välimuistin tehdä service workeriin?",
      "Lisäsin service workerin, joka tallentaa näkyvän kartan tiilet seitsemäksi päiväksi. Ensimmäinen avaus on yhtä hidas kuin ennen, toinen lähes välitön.",
      tileTest,
      "Toimiiko tämä myös ilman verkkoa?",
      "Toimii niillä alueilla, jotka on avattu kerran. Muualla näytetään harmaa ruutu ja teksti, ettei karttaa ole tallennettu.",
      "Voisiko kartan tallentaa etukäteen koko reitin alueelta ennen retkeä?",
      "Lisäsin reittinäkymään painikkeen ”Tallenna kartta”. Se hakee reitin ympäriltä tiilet kolmella tarkkuudella, noin 40 Mt kymmenen kilometrin reitille.",
    ],
  },
  elevation: {
    title: "Korkeusprofiili reiteille",
    msgs: [
      "Haluaisin reitin alle korkeusprofiilin, josta näkee nousut.",
      "Piirsin profiilin kartan alle. Kun osoitin liikkuu profiilissa, kartalla näkyy sama kohta pisteenä.",
      "Nousut voisi värittää jyrkkyyden mukaan.",
      "Väritän jyrkkyyden kolmeen luokkaan: loiva, nouseva ja jyrkkä. Työ on vielä käynnissä.",
    ],
  },
  colors: {
    title: "Reittivärit Yö-teemaan",
    msgs: [
      "Reittiviivat hukkuvat tummaan pohjaan.",
      "Vaihdoin reittiviivojen värit niin, että ne erottuvat kartan tummasta taustasta. Kontrasti on nyt vähintään 4,5:1.",
    ],
  },
  notice: {
    title: "Aukioloaikojen ilmoitus",
    msgs: [
      "Lisää etusivulle ilmoitus joulun aukioloajoista ja karttalinkki alatunnisteeseen.",
      "Ilmoitus on etusivun yläreunassa 27.12. asti. Alatunnisteessa on nyt linkki, joka avaa osoitteen karttapalvelussa.",
    ],
  },
  a11y: {
    title: "Saavutettavuuskorjaukset",
    msgs: [
      "Käy sivusto läpi saavutettavuuden kannalta ja korjaa mitä löydät.",
      "Korjasin otsikkotasot ja kuvien tekstivastineet, yhteensä 14 kohtaa.",
      "Upotetulla kartalla ei ole tekstivaihtoehtoa. Lisäänkö osoitteen ja ajo-ohjeen tekstinä kartan alle?",
    ],
  },
  backups: {
    title: "Varmuuskopiot pilveen",
    msgs: [
      "Ota kirjanpitokansiosta yöllinen varmuuskopio.",
      "Ajastin varmuuskopion kello 3.00. Ensimmäinen ajo on käynnissä.",
    ],
  },
  glossary: {
    title: "Tilikartan sanasto",
    msgs: [
      "Tee sanasto tilikartan termeistä suomeksi ja englanniksi.",
      "Sanastossa on 86 termiä. Tilikartan rakenne seuraa yhdistyksen mallia.",
    ],
  },
  receipts: {
    title: "Kuittien luokittelu",
    msgs: [
      "Luokittele lokakuun kuitit kululajeittain.",
      "Luokittelin 42 kuittia. Kolme jäi epäselviksi, ja ne ovat omassa kansiossaan.",
    ],
  },
  provider: {
    title: "Karttapalvelun vaihto",
    msgs: [
      "Nykyisen karttapalvelun hinta nousee. Selvitä vaihtoehdot.",
      "Vertailin kolmea palvelua. Avoimeen karttadataan perustuva vaihtoehto on halvin, mutta tiilet pitää tarjoilla itse.",
      "Valitaan se. Tee siirtosuunnitelma.",
    ],
  },
};

const enConv: Record<ConvId, Conversation> = {
  tiles: {
    title: "Map tile cache",
    msgs: [
      "Map tiles load slowly on mobile, especially in the woods on a poor connection. Could the cache live in a service worker?",
      "I added a service worker that keeps the visible map's tiles for seven days. The first visit is as slow as before; the second is nearly instant.",
      tileTest,
      "Does this also work without a network?",
      "It does for areas opened once. Elsewhere it shows a grey square and a note that the map has not been saved.",
      "Could the map for the whole route be saved before the trip?",
      "I added a “Save map” button to the route view. It fetches the tiles around the route at three zoom levels, about 40 MB for a ten-kilometre route.",
    ],
  },
  elevation: {
    title: "Elevation profile for routes",
    msgs: [
      "I'd like an elevation profile under the route that shows the climbs.",
      "I drew the profile under the map. Moving the pointer along the profile shows the same spot as a dot on the map.",
      "Could the climbs be coloured by steepness?",
      "Colouring steepness in three classes: gentle, rising and steep. Still working on it.",
    ],
  },
  colors: {
    title: "Route colours for the dark theme",
    msgs: [
      "Route lines disappear on the dark background.",
      "I changed the route line colours so they stand out from the map's dark background. Contrast is now at least 4.5:1.",
    ],
  },
  notice: {
    title: "Opening hours notice",
    msgs: [
      "Add a notice about the holiday opening hours to the front page, and a map link to the footer.",
      "The notice is at the top of the front page until 27 December. The footer now has a link that opens the address in a map service.",
    ],
  },
  a11y: {
    title: "Accessibility fixes",
    msgs: [
      "Go through the site for accessibility and fix what you find.",
      "I fixed heading levels and image alt texts, 14 places in all.",
      "The embedded map has no text alternative. Shall I add the address and directions as text under the map?",
    ],
  },
  backups: {
    title: "Backups to the cloud",
    msgs: [
      "Take a nightly backup of the accounting folder.",
      "Scheduled the backup at 3:00. The first run is going.",
    ],
  },
  glossary: {
    title: "Chart of accounts glossary",
    msgs: [
      "Make a glossary of the chart of accounts terms in Finnish and English.",
      "The glossary has 86 terms. The chart follows the association model.",
    ],
  },
  receipts: {
    title: "Sorting receipts",
    msgs: [
      "Sort October's receipts by expense type.",
      "Sorted 42 receipts. Three were unclear, and they are in their own folder.",
    ],
  },
  provider: {
    title: "Switching map provider",
    msgs: [
      "The current map provider's price is going up. Look into alternatives.",
      "I compared three services. The one built on open map data is cheapest, but we would have to serve the tiles ourselves.",
      "Let's pick that. Write a migration plan.",
    ],
  },
};

const fi = {
  title: "⌘K-lista: miten tulokset esitetään · kierros 3",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  keyboard: "Näppäimistö",
  keyboards: { mac: "Mac", pc: "Windows / Linux" },
  example: "Tilanne",
  examples: { empty: "Tyhjä haku", many: "Monta osumaa: kartta", title: "Nimiosuma: sanasto", none: "Ei osumia: laskutus" },
  queries: { empty: "", many: "kartta", title: "sanasto", none: "laskutus" },
  lines: (k: Keys) => [
    `1 Keskustelut: yksi järjestetty lista, jossa rivi on keskustelu ja sen sisällä sen paras osuva lause. Nimiosuma on samanlainen rivi ylimpänä, ei omaa osiota. Muut osumat ovat määränä, ja → avaa ne rivin alle.`,
    `2 Viestit: rivi on yksi osunut viesti, ja keskustelun nimi on pienenä tunnisteena sen alla. Keskustelu saa oman rivin vain, kun haku osuu sen nimeen. → näyttää viestin edellisen viestin kanssa.`,
    `3 Kaksi vaihetta: kirjoittaessa lista näyttää vain keskustelut ja osumien määrän. → avaa valitun keskustelun osumat omaksi listakseen, ← palaa keskusteluihin. ${k.enter} avaa keskustelun uusimman osuman kohdalta.`,
  ],
  recommend: (k: Keys) =>
    `Suositus: 1 Keskustelut. Yksi rivi vastaa kysymykseen ”mikä keskustelu”, ja lause rivin sisällä kertoo miksi. Mitään ei ole kahdessa paikassa eikä otsikoiden alla, ja ${k.enter} avaa juuri näkyvän lauseen kohdalta.`,
  tryIt: (k: Keys) =>
    `Kokeile: ${k.mod("K")} tai /, kirjoita, ↑↓, → ja ←, ${k.enter}, Esc. Tyhjällä haulla ${k.mod("K")} ${k.enter} vaihtaa edelliseen.`,
  conv: fiConv,
  placeholder: "Hae keskusteluista",
  entry: "Hae keskusteluista",
  recent: "Viimeksi avatut",
  previous: "edellinen",
  continueSearch: (q: string) => `Jatka hakua: ”${q}”`,
  more: (n: number) => (n === 1 ? "+1 osuma" : `+${n} osumaa`),
  hits: (n: number) => (n === 1 ? "1 osuma" : `${n} osumaa`),
  inTitle: "nimessä",
  titleOnly: "Haku osui nimeen. Viimeisin viesti:",
  back: "Keskustelut",
  open: "Avaa keskustelu",
  empty: (q: string) => `Ei osumia nimissä eikä viesteissä: ”${q}”. Kokeile lyhyempää sanaa tai sanan alkua.`,
  archived: "Arkistoitu",
  who: { me: "Sinä", agent: "Agentti", tool: "Työkalu" },
  ago: (days: number) =>
    days === 0 ? "tänään" : days === 1 ? "eilen" : `${days} pv sitten`,
  foot: (k: Keys) => [
    `↑↓ valitse · → lisää osumia · ← piilota · ${k.enter} avaa lauseen kohdalta · Esc sulje`,
    `↑↓ valitse · → edellinen viesti mukaan · ← piilota · ${k.enter} avaa viestin kohdalta · Esc sulje`,
    `↑↓ valitse · → keskustelun osumat · ← takaisin · ${k.enter} avaa · Esc sulje`,
  ],
  jump: (q: string, who: string, ago: string) => `Hakuosuma ”${q}” · ${who}, ${ago}`,
  jumpBack: (k: Keys) => `${k.mod("K")} jatkaa hakua`,
  close: "Sulje",
  dialog: "Hae keskusteluista",
};

type Text = typeof fi;

const en: Text = {
  title: "⌘K list: how results are presented · round 3",
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  keyboard: "Keyboard",
  keyboards: { mac: "Mac", pc: "Windows / Linux" },
  example: "Case",
  examples: { empty: "Empty query", many: "Many hits: map", title: "Title match: glossary", none: "No hits: invoice" },
  queries: { empty: "", many: "map", title: "glossary", none: "invoice" },
  lines: (k) => [
    `1 Conversations: one ranked list where a row is a conversation with its best matching sentence inside it. A title match is the same kind of row, at the top, not a section of its own. Other hits are a count, and → opens them under the row.`,
    `2 Messages: a row is one matching message, with the conversation's name as a small label under it. A conversation gets a row of its own only when the query matches its name. → shows the message with the one before it.`,
    `3 Two stages: while you type the list shows only conversations and how many hits each has. → opens the chosen conversation's hits as a list of their own, ← goes back. ${k.enter} opens the conversation at its newest hit.`,
  ],
  recommend: (k) =>
    `Recommendation: 1 Conversations. One row answers “which conversation”, and the sentence inside it says why. Nothing is in two places or under headings, and ${k.enter} opens right at the sentence you see.`,
  tryIt: (k) =>
    `Try: ${k.mod("K")} or /, type, ↑↓, → and ←, ${k.enter}, Esc. With an empty query ${k.mod("K")} ${k.enter} swaps back.`,
  conv: enConv,
  placeholder: "Search conversations",
  entry: "Search conversations",
  recent: "Recently opened",
  previous: "previous",
  continueSearch: (q) => `Continue search: “${q}”`,
  more: (n) => (n === 1 ? "+1 hit" : `+${n} hits`),
  hits: (n) => (n === 1 ? "1 hit" : `${n} hits`),
  inTitle: "in name",
  titleOnly: "The query matched the name. Latest message:",
  back: "Conversations",
  open: "Open conversation",
  empty: (q) => `No hits in names or messages: “${q}”. Try a shorter word or the start of a word.`,
  archived: "Archived",
  who: { me: "You", agent: "Agent", tool: "Tool" },
  ago: (days) => (days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`),
  foot: (k) => [
    `↑↓ choose · → more hits · ← hide · ${k.enter} open at the sentence · Esc close`,
    `↑↓ choose · → show the message before · ← hide · ${k.enter} open at the message · Esc close`,
    `↑↓ choose · → its hits · ← back · ${k.enter} open · Esc close`,
  ],
  jump: (q, who, ago) => `Search hit “${q}” · ${who}, ${ago}`,
  jumpBack: (k) => `${k.mod("K")} continues the search`,
  close: "Close",
  dialog: "Search conversations",
};

export const TEXT = { fi, en };
export type { Text };
