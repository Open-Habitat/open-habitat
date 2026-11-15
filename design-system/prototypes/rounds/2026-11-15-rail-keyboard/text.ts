// The round's own words, Finnish and English. Production pieces (section
// headings, Hiljaiset, the header, the composer, the next-waiting row) keep
// their own catalogs and follow the same language choice. Titles,
// workspaces and messages are synthetic.

/** How a key is written on this keyboard: ⌥ and ⌘ on a Mac, Alt+ and
 * Ctrl+ elsewhere, as production's altKey() does. */
export type Keys = {
  alt: (k: string) => string;
  altShift: (k: string) => string;
  mod: (k: string) => string;
};
export const keysFor = (mac: boolean): Keys =>
  mac
    ? {
        alt: (k) => `⌥${k}`,
        altShift: (k) => `⌥⇧${k}`,
        mod: (k) => `⌘${k}`,
      }
    : {
        alt: (k) => `Alt+${k}`,
        altShift: (k) => `Alt+Shift+${k}`,
        mod: (k) => `Ctrl+${k}`,
      };

const fi = {
  title: "Keskustelusta toiseen näppäimillä · kierros 1",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  keyboard: "Näppäimistö",
  keyboards: { mac: "Mac", pc: "Windows / Linux" },
  lines: (k: Keys) => [
    `1 Suoraan: ${k.alt("↑")} ja ${k.alt("↓")} avaavat sivupalkin edellisen ja seuraavan keskustelun heti, myös kirjoituskentästä. ${k.altShift("↓")} hyppää seuraavaan sinua odottavaan; Sillä aikaa -rivin näppäin muuttuu siksi.`,
    `2 Vaihtaja: ${k.mod("K")} avaa haun keskustelujen yli. Kirjoita osa nimestä, ↑↓ valitsee, Enter avaa, Esc palaa. Tyhjällä haulla valmiina on edellinen keskustelu, joten ${k.mod("K")} Enter vaihtaa kahden välillä. ${k.alt("↓")} pysyy Sillä aikaa -rivin näppäimenä.`,
    `3 Selaa ensin: ${k.alt("↑")} tai ${k.alt("↓")} vie fokuksen sivupalkkiin viereiselle riville avaamatta sitä. Sen jälkeen pelkät ↑↓ selaavat, Enter avaa ja palauttaa kirjoituskenttään, Esc palaa ennalleen.`,
  ],
  recommend: (k: Keys) =>
    `Suositus: 1 Suoraan. ${k.alt("↑↓")} on Slackin ja Discordin tuttu tapa, jatkaa jo olemassa olevaa ${k.alt("↓")}-näppäintä, toimii kirjoituskentästä eikä törmää selaimen näppäimiin millään alustalla. Vaihtaja on hyvä lisä myöhemmin, kun keskusteluja on kymmeniä.`,
  tryIt: "Kokeile: klikkaa kirjoituskenttään ja paina näppäimiä.",
  // Discoverability.
  hintHead: "Vinkki",
  hint1: (k: Keys) =>
    `${k.alt("↑")} ${k.alt("↓")} vaihtaa keskustelua sivupalkin järjestyksessä, ${k.altShift("↓")} vie seuraavaan sinua odottavaan.`,
  hint2: (k: Keys) =>
    `${k.mod("K")} hakee keskustelun nimellä. Enter tyhjällä haulla palaa edelliseen.`,
  hint3: (k: Keys) =>
    `${k.alt("↑")} ${k.alt("↓")} vie sivupalkkiin: ↑↓ selaa, Enter avaa, Esc palaa.`,
  hintWhy: "Näkyy, kun olet vaihtanut keskustelua hiirellä kolme kertaa.",
  hintOk: "Selvä",
  railMode: "↑↓ selaa · Enter avaa · Esc takaisin",
  // The switcher.
  switcherLabel: "Vaihda keskustelua",
  switcherPlaceholder: "Hae keskustelua tai työtilaa",
  switcherPrevious: "Edellinen",
  switcherEmpty: "Ei osumia.",
  switcherFoot: "↑↓ valitse · Enter avaa · Esc sulje",
  // The explanation the Explain mode would give for the rail.
  explainHead: "Selitystilassa sivupalkki kertoo",
  explain1: (k: Keys) =>
    `Keskustelut näkyvät tässä sen mukaan, kenen vuoro on. ${k.alt("↑")} ja ${k.alt("↓")} avaavat edellisen ja seuraavan, ${k.altShift("↓")} seuraavan sinua odottavan.`,
  explain2: (k: Keys) =>
    `Keskustelut näkyvät tässä sen mukaan, kenen vuoro on. ${k.mod("K")} hakee minkä tahansa keskustelun nimellä.`,
  explain3: (k: Keys) =>
    `Keskustelut näkyvät tässä sen mukaan, kenen vuoro on. ${k.alt("↑")} tai ${k.alt("↓")} tuo näppäimistön tänne; Enter avaa rivin.`,
  touch: "Kosketusnäytöllä mikään ei muutu: vinkki ja näppäinmerkit eivät näy.",
  // Synthetic conversations.
  conv: {
    notice: "Julkaisutiedote",
    a11y: "Saavutettavuuskatselmointi",
    tiles: "Karttatasojen välimuisti",
    elevation: "Reittihaun korkeuserot",
    backups: "Varmuuskopioiden siirto",
    glossary: "Sanaston siivous",
    receipts: "Kuittien nimeäminen",
    colors: "Teemavärit",
  },
  asked: {
    notice: "Kirjoita tiedote kevään julkaisusta.",
    a11y: "Käy etusivun saavutettavuus läpi.",
    tiles: "Lisää karttatasoille välimuisti.",
    elevation: "Näytä reitin korkeusprofiili.",
    backups: "Siirrä varmuuskopiot uudelle levylle.",
    glossary: "Siivoa sanastosta vanhentuneet termit.",
    receipts: "Nimeä marraskuun kuitit.",
    colors: "Kokeile tummempaa korostusväriä.",
  },
  said: {
    notice:
      "Luonnos on valmis tiedostossa `tiedote.md`. Julkaistaanko perjantaina vai vasta maanantaina?",
    a11y: "Löysin kolme puutetta: kahdesta kuvasta puuttuu vaihtoehtoinen teksti ja hakukentältä nimi. Korjaanko ne?",
    tiles:
      "Välimuisti on paikallaan ja ensimmäinen lataus nopeutui. Ajan nyt testit ja katson, vanheneeko vanha taso oikein.",
    elevation:
      "Korkeusprofiili piirtyy reitin alle. Haen vielä korkeusmallin tarkemman version.",
    backups:
      "Kopioin `arkisto/2025`-hakemistoa. Noin puolet on siirretty.",
    glossary: "Poistin 14 vanhentunutta termiä ja yhdistin kaksi päällekkäistä.",
    receipts: "Nimesin 23 kuittia muotoon päivä–myyjä–summa.",
    colors: "Tummempi korostus läpäisee kontrastivaatimuksen kaikissa teemoissa.",
  },
};

type Text = Omit<typeof fi, "lines" | "recommend"> & {
  lines: (k: Keys) => string[];
  recommend: (k: Keys) => string;
};

const en: Text = {
  title: "Moving between conversations by keyboard · round 1",
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  keyboard: "Keyboard",
  keyboards: { mac: "Mac", pc: "Windows / Linux" },
  lines: (k: Keys) => [
    `1 Direct: ${k.alt("↑")} and ${k.alt("↓")} open the previous and next conversation in the rail at once, from the message field too. ${k.altShift("↓")} jumps to the next one waiting for you, so the Meanwhile row's key changes to it.`,
    `2 Switcher: ${k.mod("K")} opens a search over the conversations. Type part of a name, ↑↓ chooses, Enter opens, Esc goes back. With an empty search the previous conversation is chosen, so ${k.mod("K")} Enter swaps between two. ${k.alt("↓")} stays the Meanwhile row's key.`,
    `3 Browse first: ${k.alt("↑")} or ${k.alt("↓")} moves focus into the rail onto the neighbouring row without opening it. Then plain ↑↓ browse, Enter opens and returns to the message field, Esc goes back unchanged.`,
  ],
  recommend: (k: Keys) =>
    `Recommendation: 1 Direct. ${k.alt("↑↓")} is the familiar Slack and Discord way, continues the existing ${k.alt("↓")}, works from the message field and collides with no browser key on any platform. The switcher is a good addition later, once there are dozens of conversations.`,
  tryIt: "Try it: click into the message field and press the keys.",
  hintHead: "Tip",
  hint1: (k: Keys) =>
    `${k.alt("↑")} ${k.alt("↓")} change conversation in the rail's order; ${k.altShift("↓")} goes to the next one waiting for you.`,
  hint2: (k: Keys) =>
    `${k.mod("K")} finds a conversation by name. Enter on an empty search goes back to the previous one.`,
  hint3: (k: Keys) =>
    `${k.alt("↑")} ${k.alt("↓")} take you into the rail: ↑↓ browse, Enter opens, Esc goes back.`,
  hintWhy: "Shown once you have changed conversation with the mouse three times.",
  hintOk: "Got it",
  railMode: "↑↓ browse · Enter opens · Esc back",
  switcherLabel: "Change conversation",
  switcherPlaceholder: "Search conversations or workspaces",
  switcherPrevious: "Previous",
  switcherEmpty: "No matches.",
  switcherFoot: "↑↓ choose · Enter open · Esc close",
  explainHead: "In Explain mode the rail says",
  explain1: (k: Keys) =>
    `Conversations are listed here by whose turn it is. ${k.alt("↑")} and ${k.alt("↓")} open the previous and next, ${k.altShift("↓")} the next one waiting for you.`,
  explain2: (k: Keys) =>
    `Conversations are listed here by whose turn it is. ${k.mod("K")} finds any conversation by name.`,
  explain3: (k: Keys) =>
    `Conversations are listed here by whose turn it is. ${k.alt("↑")} or ${k.alt("↓")} bring the keyboard here; Enter opens a row.`,
  touch: "On a touch screen nothing changes: no tip and no key caps.",
  conv: {
    notice: "Release announcement",
    a11y: "Accessibility review",
    tiles: "Map tile cache",
    elevation: "Route elevation",
    backups: "Backup migration",
    glossary: "Glossary cleanup",
    receipts: "Naming receipts",
    colors: "Theme colours",
  },
  asked: {
    notice: "Write the announcement for the spring release.",
    a11y: "Review the front page's accessibility.",
    tiles: "Add a cache for the map tiles.",
    elevation: "Show the route's elevation profile.",
    backups: "Move the backups to the new disk.",
    glossary: "Remove outdated terms from the glossary.",
    receipts: "Name November's receipts.",
    colors: "Try a darker accent colour.",
  },
  said: {
    notice:
      "The draft is ready in `tiedote.md`. Publish on Friday or wait until Monday?",
    a11y: "I found three gaps: two images lack alt text and the search field has no name. Shall I fix them?",
    tiles:
      "The cache is in place and the first load got faster. Running the tests now and checking that an old tile expires.",
    elevation:
      "The elevation profile draws under the route. Fetching a finer elevation model next.",
    backups: "Copying `arkisto/2025`. About half has moved.",
    glossary: "Removed 14 outdated terms and merged two duplicates.",
    receipts: "Named 23 receipts as date–vendor–amount.",
    colors: "The darker accent passes the contrast requirement in every theme.",
  },
};

export const TEXT = { fi: fi as Text, en };
export type { Text };
