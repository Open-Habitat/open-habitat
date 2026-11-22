// Texts of the rail-state-change round: the review bar, the six picker
// entries, the scripted events and the synthetic conversations. Section and
// state words follow production's (web/src/text/navigation.ts,
// serverBrowser.ts) where they exist.
export type Lang = "fi" | "en";
export const DIRECTIONS = ["Nyt", "A Liuku", "B Merkki", "C Laskuri ja siru", "D Reuna", "E Yhdistelmä"];

/** What a change is, for its treatment: the strong ones ask for the person
 * (a turn ended, a question, a failure, the browser waits); a start is news
 * but asks nothing. */
export type Kind = "reply" | "question" | "fail" | "browser" | "start";
export type State = "quiet" | "work" | "reply" | "question" | "fail" | "browser";

export type Conv = { id: string; ws: number; fi: string; en: string; state: State };
export const WORKSPACES = [
  { fi: "Kotitalous", en: "Household" },
  { fi: "Yhdistys", en: "Association" },
  { fi: "Mökki", en: "Cottage" },
  { fi: "Kirjanpito", en: "Bookkeeping" },
];
/** The open conversation is "o", quiet, at the top of Hiljaiset. */
export const CONVS: Conv[] = [
  { id: "r1", ws: 1, fi: "Kevätkokouksen esityslista", en: "Spring meeting agenda", state: "work" },
  { id: "r2", ws: 1, fi: "Jäsenlomakkeen täyttö", en: "Filling in the member form", state: "work" },
  { id: "r3", ws: 2, fi: "Laiturin korjaustarjoukset", en: "Jetty repair quotes", state: "work" },
  { id: "r4", ws: 0, fi: "Matkasuunnitelma Ouluun", en: "Trip plan to Oulu", state: "work" },
  { id: "r5", ws: 2, fi: "Vesimittarin lukemat", en: "Water meter readings", state: "work" },
  { id: "r6", ws: 3, fi: "ALV-ilmoituksen luonnos", en: "VAT return draft", state: "work" },
  { id: "r7", ws: 1, fi: "Tiedotteen oikoluku", en: "Proofreading the newsletter", state: "work" },
  { id: "o", ws: 0, fi: "Sähkösopimusten vertailu", en: "Comparing electricity contracts", state: "quiet" },
  { id: "q1", ws: 3, fi: "Kuittien luokittelu", en: "Sorting receipts", state: "quiet" },
  { id: "q2", ws: 0, fi: "Ruokalista viikolle", en: "Menu for the week", state: "quiet" },
  { id: "q3", ws: 2, fi: "Saunan kiukaan vertailu", en: "Comparing sauna stoves", state: "quiet" },
  { id: "q4", ws: 3, fi: "Pankkitilien täsmäytys", en: "Reconciling bank accounts", state: "quiet" },
  { id: "q5", ws: 1, fi: "Talkoolista", en: "Work party list", state: "quiet" },
  { id: "q6", ws: 0, fi: "Vakuutusten erittely", en: "Insurance breakdown", state: "quiet" },
  { id: "q7", ws: 2, fi: "Polttopuutilaus", en: "Firewood order", state: "quiet" },
  { id: "q8", ws: 1, fi: "Kokouspöytäkirja 3/2026", en: "Minutes 3/2026", state: "quiet" },
  { id: "q9", ws: 3, fi: "Kotitalousvähennys", en: "Household tax credit", state: "quiet" },
  { id: "q10", ws: 0, fi: "Lasten harrastuskalenteri", en: "Kids' activity calendar", state: "quiet" },
  { id: "q11", ws: 2, fi: "Venevajan inventaario", en: "Boathouse inventory", state: "quiet" },
  { id: "q12", ws: 3, fi: "Tilinpäätöksen liitteet", en: "Annual accounts appendices", state: "quiet" },
];

/** One step of the script: its changes, or a scroll or an open. */
export type Step = {
  changes?: { id: string; to: State }[];
  scroll?: "bottom" | "top";
  open?: string;
};
export const SCRIPT: Step[] = [
  { changes: [{ id: "q1", to: "work" }] },
  { changes: [{ id: "r1", to: "reply" }] },
  { changes: [{ id: "r2", to: "browser" }] },
  { changes: [{ id: "r3", to: "fail" }] },
  { scroll: "bottom" },
  { changes: [{ id: "r4", to: "question" }] },
  {
    changes: [
      { id: "r5", to: "reply" },
      { id: "r6", to: "reply" },
      { id: "r7", to: "question" },
      { id: "q2", to: "work" },
      { id: "q3", to: "work" },
    ],
  },
  { open: "r1", scroll: "top" },
];

const fi = {
  title: "Sivupalkki kertoo, että keskustelun tila muuttui",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  reduce: "Vähennä liikettä",
  auto: "Toista itsestään",
  next: "Seuraava tapahtuma",
  reset: "Alusta",
  stepOf: (i: number, n: number) => `${i}/${n}`,
  start: "Alku: katsot keskustelua Sähkösopimusten vertailu. Sinun vuorosi on tyhjä, Käynnissä on seitsemän keskustelua.",
  steps: [
    "Kuittien luokittelu käynnistyy (Hiljaiset → Käynnissä).",
    "Kevätkokouksen esityslistan vuoro päättyy (Käynnissä → Sinun vuorosi).",
    "Jäsenlomakkeen täyttö: selain odottaa sinua (pysyy Käynnissä).",
    "Laiturin korjaustarjoukset epäonnistuu (pysyy Käynnissä).",
    "Selaat Hiljaisia alas: Sinun vuorosi jää näkymän yläpuolelle.",
    "Matkasuunnitelma Ouluun kysyy sinulta, näkymän ulkopuolella.",
    "Viisi kerralla: kolme Sinun vuorosi -osioon, kaksi käynnistyy.",
    "Avaat Kevätkokouksen esityslistan: sen merkki poistuu.",
  ],
  lines: [
    "Nyt: tuotanto. Rivi vaihtaa osiota ja merkkiä ilman muuta ilmettä; reunasiru kertoo vain rivien määrän.",
    "A Liuku: rivi liukuu uuteen paikkaansa ja sen tausta hehkuu hetken ja häipyy. Vähennetyllä liikkeellä tausta pysyy paikallaan 6 s.",
    "B Merkki: muuttunut rivi saa reunaviivan ja sanan ”uusi” ajan tilalle, kunnes avaat sen. Käynnistyminen ei saa merkkiä.",
    "C Laskuri ja siru: osion otsikon luku sykähtää kerran ja ”+n” jää; näkymän ulkopuolinen muutos lisää reunasiruun ”+1”.",
    "D Reuna: sivupalkin reuna hehkuu kahdesti ja jää ohueksi viivaksi, ja Työtilat-rivi kertoo, montako uutta siellä on.",
    "E Yhdistelmä (suositus): B:n merkki, C:n reunasiru ja yksi A:n hehku ilman liukua. Kun kolme tai useampi muuttuu kerralla, hehku jää pois.",
  ],
  recommend:
    "Suositus: E. Merkki pysyy, kunnes avaat keskustelun, joten muutos löytyy myöhemminkin. Hehku huomataan silmäkulmasta, ja reunasiru kertoo muutoksesta, joka on näkymän ulkopuolella. Viidestä muutoksesta jää viisi merkkiä ilman välkettä.",
  // Rows
  tag: "uusi",
  tagMany: (n: number) => (n === 1 ? "1 uusi" : `${n} uutta`),
  fresh: "Uusi muutos",
  newReply: "Uusi vastaus",
  asks: "Kysyy sinulta",
  working: "Agentti työskentelee",
  failed: "Pi kaatui kesken vuoron",
  done: "Valmis",
  wsNew: (n: number) => `${n} uutta muutosta`,
  announce: (title: string, where: string) => `${title}: ${where}`,
  announceMany: (n: number) => `${n} keskustelua muuttui`,
  where: {
    reply: "uusi vastaus, Sinun vuorosi",
    question: "kysyy sinulta, Sinun vuorosi",
    fail: "epäonnistui",
    browser: "odottaa sinua selaimessa",
    start: "käynnistyi",
  } as Record<Kind, string>,
  // Main
  ask: "Vertaile kolmea tarjousta: kiinteä, pörssi ja määräaikainen. Mikä tulisi halvimmaksi meidän kulutuksellamme?",
  reply: "Viime vuoden kulutuksella (noin 9 800 kWh) **pörssisähkö** olisi tullut halvimmaksi, noin 140 € vähemmän kuin kiinteä. Määräaikainen on kallein, mutta hinta on varma kahdeksi vuodeksi.",
};
type Text = typeof fi;
const en: Text = {
  title: "The rail shows that a conversation changed state",
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  reduce: "Reduce motion",
  auto: "Play by itself",
  next: "Next event",
  reset: "Start over",
  stepOf: (i: number, n: number) => `${i}/${n}`,
  start: "Start: you are reading Comparing electricity contracts. Your turn is empty; seven conversations are running.",
  steps: [
    "Sorting receipts starts (Quiet → Running).",
    "Spring meeting agenda's turn ends (Running → Your turn).",
    "Filling in the member form: the browser waits for you (stays in Running).",
    "Jetty repair quotes fails (stays in Running).",
    "You scroll down through Quiet: Your turn is out of view above.",
    "Trip plan to Oulu asks you something, out of view.",
    "Five at once: three to Your turn, two start.",
    "You open Spring meeting agenda: its mark goes.",
  ],
  lines: [
    "Now: production. The row changes section and mark with no other sign; the edge chip says only how many rows.",
    "A Slide: the row slides to its new place and its background glows for a moment and fades. With reduced motion the background holds still for 6 s.",
    "B Mark: a changed row gets an edge bar and the word “new” in place of its time until you open it. A start gets no mark.",
    "C Counter and chip: the section's count pulses once and “+n” stays; a change out of view adds “+1” to the edge chip.",
    "D Edge: the rail's edge glows twice and stays as a thin line, and the Workspaces row says how many are new there.",
    "E Combined (recommended): B's mark, C's edge chip and one A glow without the slide. When three or more change at once there is no glow.",
  ],
  recommend:
    "Recommended: E. The mark stays until you open the conversation, so the change can be found later; the glow catches the eye; the chip tells of a change out of view. Five changes leave five marks without flicker.",
  tag: "new",
  tagMany: (n: number) => `${n} new`,
  fresh: "New change",
  newReply: "New reply",
  asks: "Asking you",
  working: "Agent working",
  failed: "Pi stopped mid-turn",
  done: "Done",
  wsNew: (n: number) => `${n} new changes`,
  announce: (title: string, where: string) => `${title}: ${where}`,
  announceMany: (n: number) => `${n} conversations changed`,
  where: {
    reply: "new reply, Your turn",
    question: "asking you, Your turn",
    fail: "failed",
    browser: "waiting for you in the browser",
    start: "started",
  },
  ask: "Compare three offers: fixed, spot and fixed-term. Which would be cheapest for our consumption?",
  reply: "At last year's consumption (about 9,800 kWh) **spot price** would have been cheapest, about €140 less than fixed. Fixed-term is the dearest, but its price is certain for two years.",
};
export const TEXT: Record<Lang, Text> = { fi, en };
export type { Text };
