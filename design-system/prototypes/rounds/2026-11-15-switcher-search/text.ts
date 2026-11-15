// The round's own words and the synthetic conversations, Finnish and
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
  title: "Haku kaikkiin keskusteluihin · kierros 2",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  keyboard: "Näppäimistö",
  keyboards: { mac: "Mac", pc: "Windows / Linux" },
  building: "Haku vielä rakentuu",
  query: "kartta",
  lines: (k: Keys) => [
    `1 Lista: ${k.mod("K")} avaa kapean listan. Nimet ensin, alla viestit, joissa sana esiintyy, osuva lause korostettuna. Ei suodattimia; ${k.enter} avaa keskustelun osuneen viestin kohdalta.`,
    `2 Esikatselu: sama haku leveämpänä. Osumat ryhmitellään keskusteluittain, suodattimet (kuka sanoi, työtila, aika, arkistoidut, työkalujen tulosteet) ovat kentän alla, ja oikealla näkyy valitun viestin ympäristö ennen kuin lähdet.`,
    `3 Hakusivu: ${k.mod("K")} hyppää vain nimillä kuten kierroksella 1. Viimeinen rivi ”Hae kaikista keskusteluista” avaa hakusivun keskustelun paikalle: suodattimet vasemmalla, osumat ympäristöineen, ja se odottaa, kunnes palaat.`,
  ],
  recommend: (k: Keys) =>
    `Suositus: 2 Esikatselu. Haku pysyy yhdessä näppäimistöllä käytettävässä ikkunassa, ja esikatselu kertoo ennen hyppyä, onko tämä oikea kohta. Kapealla ruudulla se on sama lista kuin 1. Näppäin on Macilla ${keysFor(true).mod("K")} ja Windowsilla/Linuxilla Ctrl+K (sivu ottaa sen osoiterivin haulta, ei koskaan päätteestä), lisäksi / tekstikenttien ulkopuolella.`,
  tryIt: (k: Keys) =>
    `Kokeile: ${k.mod("K")} tai /, kirjoita, ↑↓, ${k.enter}, Esc. Tyhjällä haulla ${k.mod("K")} ${k.enter} vaihtaa edelliseen.`,
  conv: fiConv,
  placeholder: "Hae keskusteluista",
  placeholderNames: "Hae keskustelun nimellä",
  entry: "Hae keskusteluista",
  recent: "Viimeksi avatut",
  names: "Keskustelut",
  inMessages: "Viesteissä",
  previous: "edellinen",
  continueSearch: (q: string) => `Jatka hakua: ”${q}”`,
  searchAll: (q: string) => `Hae kaikista keskusteluista: ”${q}”`,
  more: (n: number) => `+${n} muuta tässä keskustelussa`,
  hits: (n: number) => (n === 1 ? "1 osuma" : `${n} osumaa`),
  empty: "Ei osumia. Kokeile lyhyempää sanaa tai poista suodattimia.",
  archived: "Arkistoitu",
  who: { me: "Sinä", agent: "Agentti", tool: "Työkalu" },
  ago: (days: number) =>
    days === 0 ? "tänään" : days === 1 ? "eilen" : `${days} pv sitten`,
  foot: (k: Keys) => `↑↓ valitse · ${k.enter} avaa · Esc sulje`,
  footD2: (k: Keys) => `↑↓ valitse · ${k.enter} avaa kohdasta · Tab suodattimet · Esc sulje`,
  footD3: (k: Keys) => `↑↓ valitse · ${k.enter} avaa · ${k.mod(k.enter)} hakusivulle · Esc sulje`,
  filters: "Suodattimet",
  fWho: { all: "Kaikki", me: "Minä sanoin", agent: "Agentti sanoi" },
  fWhoLabel: "Kuka sanoi",
  fWhenLabel: "Milloin",
  fWs: "Työtila",
  fWsAll: "Kaikki työtilat",
  fWhen: { any: "Milloin tahansa", "7": "7 päivää", "30": "30 päivää" },
  fArchived: "Arkistoidut mukana",
  fTools: "Työkalujen tulosteet",
  preview: "Esikatselu",
  previewOpen: (k: Keys) => `${k.enter} avaa tästä kohdasta`,
  previewConv: "Viimeisimmät viestit",
  buildingLine: "Haku käy vielä läpi vanhempia keskusteluja (212/363). Nimet löytyvät jo kaikki, viestit tuoreimmasta alkaen.",
  pageTitle: "Haku",
  pageBack: "Palaa keskusteluun",
  jump: (q: string, who: string, ago: string) => `Hakuosuma ”${q}” · ${who}, ${ago}`,
  jumpBack: (k: Keys) => `${k.mod("K")} jatkaa hakua`,
  jumpBackPage: "Takaisin hakutuloksiin",
  close: "Sulje",
  dialog: "Hae keskusteluista",
};

type Text = typeof fi;

const en: Text = {
  title: "Search across all conversations · round 2",
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  keyboard: "Keyboard",
  keyboards: { mac: "Mac", pc: "Windows / Linux" },
  building: "Index still building",
  query: "map",
  lines: (k) => [
    `1 List: ${k.mod("K")} opens a narrow list. Names first, then the messages the words appear in, with the matching sentence highlighted. No filters; ${k.enter} opens the conversation at that message.`,
    `2 Preview: the same search, wider. Hits group by conversation, filters (who said it, workspace, when, archived, tool output) sit under the field, and the right side shows the selected message in context before you leave.`,
    `3 Search page: ${k.mod("K")} jumps by name only, as in round 1. Its last row, “Search all conversations”, opens a search page in place of the conversation: filters on the left, hits in context, and it waits until you come back.`,
  ],
  recommend: (k) =>
    `Recommendation: 2 Preview. Search stays in one keyboard-driven dialog, and the preview says whether this is the right place before the jump. On a narrow screen it is the same list as 1. The key is ${keysFor(true).mod("K")} on a Mac and Ctrl+K on Windows/Linux (the page takes it from the address bar's search, never from the terminal), plus / outside text fields.`,
  tryIt: (k) =>
    `Try: ${k.mod("K")} or /, type, ↑↓, ${k.enter}, Esc. With an empty query ${k.mod("K")} ${k.enter} swaps back.`,
  conv: enConv,
  placeholder: "Search conversations",
  placeholderNames: "Find a conversation by name",
  entry: "Search conversations",
  recent: "Recently opened",
  names: "Conversations",
  inMessages: "In messages",
  previous: "previous",
  continueSearch: (q) => `Continue search: “${q}”`,
  searchAll: (q) => `Search all conversations: “${q}”`,
  more: (n) => `+${n} more in this conversation`,
  hits: (n) => (n === 1 ? "1 hit" : `${n} hits`),
  empty: "No hits. Try a shorter word or remove filters.",
  archived: "Archived",
  who: { me: "You", agent: "Agent", tool: "Tool" },
  ago: (days) => (days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`),
  foot: (k) => `↑↓ choose · ${k.enter} open · Esc close`,
  footD2: (k) => `↑↓ choose · ${k.enter} open at the message · Tab filters · Esc close`,
  footD3: (k) => `↑↓ choose · ${k.enter} open · ${k.mod(k.enter)} search page · Esc close`,
  filters: "Filters",
  fWho: { all: "Everyone", me: "I said", agent: "Agent said" },
  fWhoLabel: "Who said it",
  fWhenLabel: "When",
  fWs: "Workspace",
  fWsAll: "All workspaces",
  fWhen: { any: "Any time", "7": "7 days", "30": "30 days" },
  fArchived: "Include archived",
  fTools: "Tool output",
  preview: "Preview",
  previewOpen: (k) => `${k.enter} opens at this message`,
  previewConv: "Latest messages",
  buildingLine: "Search is still reading older conversations (212/363). Every name is found already; messages from the newest down.",
  pageTitle: "Search",
  pageBack: "Back to the conversation",
  jump: (q, who, ago) => `Search hit “${q}” · ${who}, ${ago}`,
  jumpBack: (k) => `${k.mod("K")} continues the search`,
  jumpBackPage: "Back to the results",
  close: "Close",
  dialog: "Search conversations",
};

export const TEXT = { fi, en };
export type { Text };
