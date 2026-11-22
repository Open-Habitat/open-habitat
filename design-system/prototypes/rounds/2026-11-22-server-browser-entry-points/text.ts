// The round's own words, fi and en. Production strings (the chip, the strip,
// the rail row, the sheet) come from web/src/text/serverBrowser.ts unchanged.
// Every name, address and message here is synthetic.

export type Scene = "ask" | "agent" | "person" | "idle" | "stopped";
export type Conv = "a" | "b";

const fi = {
  title: "Palvelinselaimen paikka",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  scene: "Tilanne",
  scenes: {
    ask: "Ikkuna odottaa sinua",
    agent: "Agentti selaimessa",
    person: "Sinä ohjaat",
    idle: "Selain auki, agentti ei käytä",
    stopped: "Selain ei käynnissä",
  } as Record<Scene, string>,
  conversation: "Keskustelu",
  reset: "Alkutila",
  hint: "Vaihda keskustelua sivupalkista: toinen ei käytä selainta.",
  lines: [
    "1 Siru — selain on kentän yllä jokaisessa keskustelussa; sivupalkkiin tulee rivi vain, kun ikkuna odottaa sinua.",
    "2 Rivi — selain on sivupalkissa; keskustelu näyttää agentin selaintyön ja pyynnön omassa kulussaan.",
    "3 Kaksi — sivupalkissa koko selain; siru vain keskustelussa, jonka agentti käyttää selainta, ja vain sen ikkunat.",
  ],
  recommend:
    "Suositus: 2 Rivi. Selain on yksi ja sinun, joten sen paikka on sivupalkissa; keskustelu näyttää vain sen, mitä sen oma agentti teki.",
  you: "Sinä",
  workspace: "kotitalous",
  otherWorkspace: "yhdistys",
  convs: { a: "Sähkölaskut 2026", b: "Kevätkokouksen esitys" } as Record<Conv, string>,
  done: "Valmis",
  working: "Työskentelee",
  waits: "Odottaa sinua",
  tool: "valmis",
  running: "käynnissä",
  a: {
    ask: "Hae Energian sähkölaskut tältä vuodelta ja tee niistä kuukausittainen taulukko.",
    toLogin:
      "Laskusivu ohjasi kirjautumiseen, ja palvelu pyytää vahvistamaan sen. Pyysin sinua hoitamaan vahvistuksen selaimessa; jatkan laskujen hakua, kun annat selaimen takaisin.",
    working: "Avaan laskusivun selaimessasi ja katson, mitä sieltä löytyy.",
    finished:
      "Valmis. Hain 10 laskua (tammi–loka) ja tein taulukon `sahkolaskut-2026.csv`. Suljin avaamani välilehdet.",
    requestText: "Palvelu pyytää vahvistamaan kirjautumisen pankkitunnuksilla.",
  },
  b: {
    ask: "Tiivistä kevätkokouksen esityslista kolmeen kalvoon.",
    reply:
      "Tein kolme kalvoa tiedostoon `esitys/kevatkokous.md`: avaus ja kokouksen järjestäytyminen, tilinpäätös ja vastuuvapaus sekä vaalit.",
  },
  windows: {
    laskut: "Omat laskut – Energia",
    kirjaudu: "Vahvista kirjautuminen",
    kirjasto: "Lainat – Kirjasto",
  },
  // Direction 1: the rail's row only while a window waits for you.
  railAsk: (title: string) => `${title} odottaa sinua`,
  railAskIn: (conv: string) => `Selain · ${conv}`,
  // Direction 2: the conversation's own record of the browser work.
  traceLive: (n: number) => `Agentti selaimessa · ${n === 1 ? "1 ikkuna" : `${n} ikkunaa`}`,
  traceDone: "Agentti käytti selaintasi 9.12–9.31 · 2 ikkunaa, suljettu",
  traceWhere: "Koko selain on sivupalkin rivillä Oma selain.",
  // Direction 3: the chip's scope.
  scope: (n: number, all: number) =>
    `Tämän keskustelun ikkunat (${n}). Koko selain, ${all} ikkunaa, on sivupalkissa.`,
  scopeNone: "Agentti ei käytä selainta tässä keskustelussa.",
  sheetPage: {
    kirjaudu: ["Vahvista kirjautuminen", "Valitse pankki ja tunnistaudu.", "Jatka"],
    laskut: ["Omat laskut", "Lasku 10/2026 · 64,20 €", "Lataa PDF"],
    kirjasto: ["Lainasi", "3 lainaa · eräpäivä 2.12.", "Uusi lainat"],
  } as Record<string, [string, string, string]>,
};

type Text = typeof fi;

const en: Text = {
  title: "Where the server browser lives",
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  scene: "Situation",
  scenes: {
    ask: "A window is waiting for you",
    agent: "Agent in the browser",
    person: "You are in control",
    idle: "Browser open, agent not using it",
    stopped: "Browser not running",
  },
  conversation: "Conversation",
  reset: "Reset",
  hint: "Switch conversations from the sidebar: the other one does not use the browser.",
  lines: [
    "1 Chip — the browser sits above the field in every conversation; the sidebar gets a row only while a window is waiting for you.",
    "2 Row — the browser lives in the sidebar; the conversation shows the agent's browser work and request in its own flow.",
    "3 Two — the whole browser in the sidebar; a chip only in a conversation whose agent uses the browser, with just its windows.",
  ],
  recommend:
    "Recommended: 2 Row. There is one browser and it is yours, so it lives in the sidebar; a conversation shows only what its own agent did.",
  you: "You",
  workspace: "household",
  otherWorkspace: "association",
  convs: { a: "Electricity bills 2026", b: "Spring meeting slides" },
  done: "Done",
  working: "Working",
  waits: "Waiting for you",
  tool: "done",
  running: "running",
  a: {
    ask: "Fetch this year's electricity bills from Energia and make a monthly table of them.",
    toLogin:
      "The bills page redirected to sign-in, and the service asks to confirm it. I asked you to do the confirmation in the browser; I'll carry on fetching the bills when you give the browser back.",
    working: "I'm opening the bills page in your browser to see what is there.",
    finished:
      "Done. I fetched 10 bills (Jan–Oct) and made the table `sahkolaskut-2026.csv`. I closed the tabs I opened.",
    requestText: "The service asks you to confirm the sign-in with your bank ID.",
  },
  b: {
    ask: "Condense the spring meeting agenda into three slides.",
    reply:
      "I made three slides in `esitys/kevatkokous.md`: opening and constitution of the meeting, accounts and discharge, and elections.",
  },
  windows: {
    laskut: "My bills – Energia",
    kirjaudu: "Confirm sign-in",
    kirjasto: "Loans – Library",
  },
  railAsk: (title) => `${title} is waiting for you`,
  railAskIn: (conv) => `Browser · ${conv}`,
  traceLive: (n) => `Agent in the browser · ${n === 1 ? "1 window" : `${n} windows`}`,
  traceDone: "The agent used your browser 9.12–9.31 · 2 windows, closed",
  traceWhere: "The whole browser is the sidebar's Your browser row.",
  scope: (n, all) =>
    `This conversation's windows (${n}). The whole browser, ${all} windows, is in the sidebar.`,
  scopeNone: "The agent is not using the browser in this conversation.",
  sheetPage: {
    kirjaudu: ["Confirm sign-in", "Choose your bank and identify.", "Continue"],
    laskut: ["My bills", "Bill 10/2026 · €64.20", "Download PDF"],
    kirjasto: ["Your loans", "3 loans · due 2 Dec", "Renew loans"],
  },
};

export const TEXT = { fi, en };
export type { Text };
