// The round's own words, Finnish and English, and the synthetic world.
// Production pieces (section headings, Hiljaiset, Työtilat, the header, the
// composer) keep their own catalogs and follow the same language choice.
// Titles, workspaces and messages are synthetic.

/** Conversation + workspace rows wholly in sight in the ordinary world
 * (4 / 2 / 12, 18 workspaces) at a 720 and a 1080 px high window, as
 * check.mjs measures them (rows.json). Index: A, B, C, today. */
export const ROWS: Record<720 | 1080, number[]> = {
  720: [9, 11, 11, 4],
  1080: [16, 19, 16, 13],
};

/** Where the height-only directions (A and C) change step, in CSS px of
 * the rail's height (the window's, as the rail fills it). */
export const BREAKS = [850, 1050] as const;

const fi = {
  title: "Sivupalkki, joka mukautuu näytön korkeuteen",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  world: "Tilanne",
  worlds: {
    ordinary: "Tavallinen arki (4 / 2 / 12, 18 työtilaa)",
    like: "Vähän sisältöä (3 / 0 / 5, 6 työtilaa)",
    crowded: "Ruuhka (6 / 4 / 30, 40 työtilaa)",
  },
  height: "Korkeus",
  window: "selaimen ikkuna",
  browser: "Oma selain",
  browsers: { idle: "valmiina", agent: "agentti työssä", ask: "odottaa sinua" },
  steps: ["Kuvakkeet", "Ruudut", "Rivit"],
  rows: (a: number, b: number, ta: number, tb: number) =>
    `720: ${a} riviä · 1080: ${b} riviä (nyt ${ta} / ${tb})`,
  lines: [
    "A Portaat: askel valitaan pelkästä korkeudesta (alle 850 px kuvakkeet, 850–1049 px ruudut, 1050 px alkaen rivit); Työtilat saa kolmanneksen keskustelualueesta, vähintään kolme riviä.",
    "B Sisältö ensin: yläosa kasvaa vain, kun sisältö jo mahtuu (ruudut, kun sinua odottavat, käynnissä olevat sekä kuusi Hiljaisten ja kuusi työtilojen riviä mahtuvat; rivit, kun kumpaakin mahtuu kaksitoista); tila jaetaan järjestyksessä odottavat ja käynnissä, työtilat, Hiljaiset.",
    "C Suhteessa: askeleet korkeudesta kuten A:ssa, mutta keskustelut ja Työtilat jakavat tilan rivimääriensä suhteessa (18 keskustelua ja 18 työtilaa: puoliksi), kumpikin vähintään minimin.",
    "Nyt: tuotannon sivupalkki vertailuksi.",
  ],
  recommend:
    "Suositus: C Suhteessa. Askel tulee pelkästä korkeudesta, joten yläosa ei vaihda muotoaan kesken työn, kun uusi keskustelu tulee, ja Työtilat kasvaa sitä mukaa kuin työtiloja on. B antaa isolla näytöllä eniten rivejä, mutta sen yläosa vaihtuu sisällön mukana.",
  rule: (h: number, step: string, why: string, ws: number, floor: number) =>
    `Sivupalkin korkeus ${h} px → ${step}. ${why} Työtilat: ${ws} riviä näkyvissä, alue vähintään ${floor} riviä.`,
  why: {
    a: (b: readonly number[]) => `Rajat ${b[0]} ja ${b[1]} px.`,
    b: (tiles: number, rows: number) =>
      `Ruudut tarvitsevat ${tiles} px ja rivit ${rows} px sivupalkin korkeutta tässä tilanteessa.`,
    c: (b: readonly number[]) => `Rajat ${b[0]} ja ${b[1]} px; tila jaetaan rivimäärien suhteessa.`,
    now: "Tuotannon sivupalkki ei mukaudu; Työtilat saa minimin, keskustelut loput.",
  },
  icons: "Kuvakkeet",
  iconSet: [
    ["home", "Etusivu: talo (tuotannon)"],
    ["outbox", "Tuotokset: lähtevä laatikko (uusi; ennen maapallo)"],
    ["browser", "Oma selain: selainikkuna, tila pisteenä (uusi; ennen maapallo)"],
    ["shield", "Agentin käytössä: kilpi (tuotannon)"],
    ["search", "Haku: suurennuslasi (tuotannon)"],
  ] as [string, string][],
  home: "Etusivu",
  shares: "Tuotokset",
  ownBrowser: "Oma selain",
  resources: "Agentin käytössä",
  browserState: { idle: "Valmiina", agent: "Agentti työssä", ask: "Odottaa sinua" },
  searchKey: (k: string) => `Hae keskusteluista (${k})`,
  search: "Hae keskusteluista",
  pages: "Sivut ja haku",
  would: (s: string) => `Avaisi: ${s}`,
  pickerNames: ["A Portaat", "B Sisältö ensin", "C Suhteessa", "Nyt"],
  asked: "Katsotaanko, miksi koontiversio hidastui viime viikolla?",
  said:
    "Kävin läpi viime viikon ajot. Hidastuminen alkoi, kun testit alkoivat ladata koko fixture-hakemiston jokaiseen työntekijään. Ehdotan, että fixturet ladataan kerran ja jaetaan.",
};
type T = typeof fi;
const en: T = {
  title: "A rail that adapts to the screen's height",
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  world: "Situation",
  worlds: {
    ordinary: "Ordinary day (4 / 2 / 12, 18 workspaces)",
    like: "Little content (3 / 0 / 5, 6 workspaces)",
    crowded: "Crowded (6 / 4 / 30, 40 workspaces)",
  },
  height: "Height",
  window: "browser window",
  browser: "Your browser",
  browsers: { idle: "ready", agent: "agent at work", ask: "waiting for you" },
  steps: ["Icons", "Tiles", "Rows"],
  rows: (a: number, b: number, ta: number, tb: number) =>
    `720: ${a} rows · 1080: ${b} rows (today ${ta} / ${tb})`,
  lines: [
    "A Steps: the step follows the height alone (icons below 850 px, tiles at 850–1049 px, rows from 1050 px); Workspaces gets a third of the conversation area, at least three rows.",
    "B Content first: the top grows only when the content already fits (tiles once waiting and running conversations plus six Quiet and six workspace rows fit; rows once twelve of each fit); room goes in order to waiting and running, workspaces, Quiet.",
    "C In proportion: steps by height as in A, but conversations and Workspaces share the room in proportion to their rows (18 conversations and 18 workspaces: half each), each at least its minimum.",
    "Today: the production rail, for comparison.",
  ],
  recommend:
    "Recommendation: C In proportion. The step comes from the height alone, so the top never changes shape mid-work when a conversation arrives, and Workspaces grows with the number of workspaces. B gives the most rows on a large screen, but its top changes with the content.",
  rule: (h: number, step: string, why: string, ws: number, floor: number) =>
    `Rail height ${h} px → ${step}. ${why} Workspaces: ${ws} rows in sight, region at least ${floor} rows.`,
  why: {
    a: (b: readonly number[]) => `Breakpoints ${b[0]} and ${b[1]} px.`,
    b: (tiles: number, rows: number) =>
      `Tiles need ${tiles} px and rows ${rows} px of rail height in this situation.`,
    c: (b: readonly number[]) => `Breakpoints ${b[0]} and ${b[1]} px; room shared by row counts.`,
    now: "Production's rail does not adapt; Workspaces gets its minimum, conversations the rest.",
  },
  icons: "Icons",
  iconSet: [
    ["home", "Home: house (production)"],
    ["outbox", "Outputs: outgoing tray (new; was the globe)"],
    ["browser", "Your browser: browser window, state as a dot (new; was the globe)"],
    ["shield", "Agent resources: shield (production)"],
    ["search", "Search: magnifier (production)"],
  ],
  home: "Home",
  shares: "Outputs",
  ownBrowser: "Your browser",
  resources: "Agent resources",
  browserState: { idle: "Ready", agent: "Agent at work", ask: "Waiting for you" },
  searchKey: (k: string) => `Search conversations (${k})`,
  search: "Search conversations",
  pages: "Pages and search",
  would: (s: string) => `Would open: ${s}`,
  pickerNames: ["A Steps", "B Content first", "C Proportional", "Today"],
  asked: "Can we look at why the build slowed down last week?",
  said:
    "I went through last week's runs. The slowdown began when the tests started loading the whole fixture directory in every worker. I suggest loading the fixtures once and sharing them.",
};
export const TEXT = { fi, en };
export type Text = T;

/** Synthetic conversation titles, [fi, en]. */
export const TITLES: [string, string][] = [
  ["Tarkista laskun ALV-erittely", "Check the invoice VAT breakdown"],
  ["Saavutettavuuskatselmoinnin kysymykset", "Accessibility review questions"],
  ["Julkaisutiedotteen luonnos", "Release note draft"],
  ["Kirjautumisvirhe Safarissa", "Sign-in error in Safari"],
  ["Hinnaston päivitys tammikuulle", "January price list update"],
  ["Käännösten puuttuvat avaimet", "Missing translation keys"],
  ["Karttatasojen välimuisti", "Map tile cache"],
  ["Korkeusprofiilin piirto", "Elevation profile drawing"],
  ["Varmuuskopioiden kierrätys", "Backup rotation"],
  ["Hakuindeksin uudelleenrakennus", "Rebuild the search index"],
  ["Testien rinnakkaistus", "Parallelise the tests"],
  ["Termisanasto", "Glossary"],
  ["Kuittien luokittelu", "Receipt categories"],
  ["Värien kontrastit", "Colour contrasts"],
  ["Tietokannan migraatio 14", "Database migration 14"],
  ["Uutiskirjeen pohja", "Newsletter template"],
  ["Lomakkeen validointi", "Form validation"],
  ["Riippuvuuksien päivitys marraskuu", "November dependency update"],
  ["Kuvien pakkaus", "Image compression"],
  ["Sivukartan generointi", "Sitemap generation"],
  ["Laskutusajon aikataulu", "Billing run schedule"],
  ["PDF-viennin fontit", "PDF export fonts"],
  ["Mobiilinäkymän navigaatio", "Mobile view navigation"],
  ["Lokien säilytysaika", "Log retention"],
  ["CSV-tuonnin merkistö", "CSV import encoding"],
  ["Kirjanpidon tilikartta", "Chart of accounts"],
  ["Reittien offline-tila", "Offline routes"],
  ["Palautelomakkeen roskapostisuoja", "Feedback form spam guard"],
  ["Sähköpostipohjien tumma teema", "Dark theme for email templates"],
  ["Käyttäjähaastattelujen yhteenveto", "User interview summary"],
  ["Tuotekuvien alt-tekstit", "Product image alt texts"],
  ["Varastosaldojen synkronointi", "Stock level sync"],
  ["API-avainten kierto", "API key rotation"],
  ["Ohjesivujen rakenne", "Help page structure"],
  ["Tilastonäkymän suodattimet", "Statistics view filters"],
  ["Viivakoodien luku", "Barcode scanning"],
  ["Aikavyöhykkeiden käsittely", "Time zone handling"],
  ["Evästebannerin teksti", "Cookie banner text"],
  ["Tilausten peruutusvirta", "Order cancellation flow"],
  ["Hakukoneoptimoinnin otsikot", "SEO titles"],
  ["Ylläpitosivun teksti", "Maintenance page text"],
];

/** Synthetic workspace names: technical identifiers, shown as they are. */
export const WORKSPACES = [
  "asiakasportaali-frontend-uudistus-2026",
  "backup-skriptit",
  "blogi",
  "datanavigaattori-prototyyppi",
  "dokumentaatio-sivusto",
  "e-kauppa-integraatiot-ja-maksut",
  "flutter-sovellus",
  "hakemistopalvelu",
  "hinnoittelulaskuri",
  "infra-terraform-moduulit",
  "jaettu-komponenttikirjasto",
  "julkaisuputki",
  "kalenteri-synkronointi",
  "kartta-api",
  "kirjanpito",
  "kotisivu",
  "kuvapankki-ja-mediakirjasto",
  "laskutus",
  "lomakepalvelu",
  "markkinointi-sivut",
  "mobiili-backend",
  "muistiinpanot",
  "osaamiskartoitus-kyselytyokalu",
  "palautekanava",
  "pilvikulujen-seuranta-dashboard",
  "reseptit",
  "retkiopas",
  "sahkopostipohjat",
  "seurantaraportit",
  "sisaltohallinta-headless-cms",
  "tapahtumakalenteri",
  "testidatan-generaattori",
  "tilastot",
  "tuotetiedot",
  "uutiskirje",
  "varastonhallinta",
  "verkkokauppa",
  "viivakoodilukija",
  "yhdistyksen-jasenrekisteri",
  "yllapitotyokalut",
];
