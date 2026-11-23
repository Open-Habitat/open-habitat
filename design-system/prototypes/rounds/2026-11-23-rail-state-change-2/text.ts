// Texts of rail-state-change round 2: the review panel, the three picker
// entries, the scripted events and the synthetic conversations. Section and
// state words follow production's (web/src/text/navigation.ts) where they
// exist.
export type Lang = "fi" | "en";
export const DIRECTIONS = ["A Siirtyy", "B Pyyhkäisy", "C Laskuri"];

/** What a change is, for its colour and its weight: a turn that ends or a
 * question asks for the person, a failure warns them, a start is news but
 * asks nothing. */
export type Kind = "turn" | "fail" | "start";
export type State = "quiet" | "work" | "reply" | "question" | "fail";

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

/** One step of the script: its changes, or a scroll of the conversations'
 * region ("running" puts Käynnissä at the top, Sinun vuorosi out of view). */
export type Step = {
  changes?: { id: string; to: State }[];
  scroll?: "running" | "top";
};
export const SCRIPT: Step[] = [
  { changes: [{ id: "r1", to: "reply" }] },
  { changes: [{ id: "q1", to: "work" }] },
  { changes: [{ id: "r3", to: "fail" }] },
  { scroll: "running" },
  { changes: [{ id: "r4", to: "question" }] },
  { scroll: "top" },
  {
    changes: [
      { id: "r5", to: "reply" },
      { id: "r6", to: "reply" },
      { id: "r7", to: "question" },
      { id: "q2", to: "work" },
      { id: "q3", to: "work" },
    ],
  },
];
/** The two scenes the panel can replay on their own. */
export const ONE = 0;
export const FIVE = 6;

const fi = {
  title: "Sivupalkki näyttää tilan muutoksen liikkeellä",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  view: "Näkymä",
  views: { desktop: "Työpöytä", phone: "Puhelin" },
  reduce: "Vähennä liikettä",
  auto: "Toista itsestään",
  next: "Seuraava tapahtuma",
  reset: "Alusta",
  one: "▶ Yksi muutos",
  five: "▶ Viisi kerralla",
  stepOf: (i: number, n: number) => `${i}/${n}`,
  start:
    "Alku: luet keskustelua Sähkösopimusten vertailu. Sinun vuorosi on tyhjä, Käynnissä on seitsemän keskustelua.",
  steps: [
    "Kevätkokouksen esityslistan vuoro päättyy (Käynnissä → Sinun vuorosi).",
    "Kuittien luokittelu käynnistyy (Hiljaiset → Käynnissä).",
    "Laiturin korjaustarjoukset epäonnistuu (pysyy Käynnissä).",
    "Vierität alas: Sinun vuorosi jää näkymän yläpuolelle.",
    "Matkasuunnitelma Ouluun kysyy sinulta ja siirtyy näkymän ulkopuolelle.",
    "Vierität takaisin ylös.",
    "Viisi kerralla: kolme Sinun vuorosi -osioon, kaksi käynnistyy.",
  ],
  phoneScroll: "Puhelimessa laatikko on kiinni, joten vieritys ei näy. Avaa laatikko valikkonapista nähdäksesi rivit.",
  oneCaption: "Yksi muutos: Kevätkokouksen esityslistan vuoro päättyy.",
  fiveCaption: "Viisi kerralla: kolme Sinun vuorosi -osioon, kaksi käynnistyy.",
  lines: [
    "A Siirtyy: rivi liukuu näkyvästi uuteen osioonsa ja hehkuu perillä hetken, ja osion luku rullaa. Puhelimessa nimi lentää valikkonapin lukuun.",
    "B Pyyhkäisy: rivi hyppää paikalleen kuten nyt, ja sen yli kulkee kerran valojuova tilan värissä. Puhelimessa juova kulkee yläpalkin yli.",
    "C Laskuri: rivit eivät liiku, vaan osion luku, reunasirun luku ja rivin aika rullaavat kuin mittari. Puhelimessa valikkonapin luku rullaa.",
  ],
  reducedLine:
    "Vähennetty liike (laitteen asetus tai kytkin): mikään ei liiku. A:n hehku ja B:n juova ovat paikallaan pysyvä sävy tai reunus 4 s, ja luvut vaihtuvat kerralla ja jäävät korostetuiksi 4 s.",
  recommend:
    "Suositus: A. Liike kertoo, mihin keskustelu meni, ja osio kertoo, mitä se sinulta haluaa. Viisi kerralla liikkuu yhtenä rauhallisena liikkeenä ilman hehkua. B kertoo vain, että jotain tapahtui, ja C on rauhallisin mutta jää helposti huomaamatta.",
  // Rows
  newReply: "Uusi vastaus",
  asks: "Kysyy sinulta",
  working: "Agentti työskentelee",
  failed: "Pi kaatui kesken vuoron",
  done: "Valmis",
  flyTo: (title: string, where: string) => `${title} → ${where}`,
  flyMany: (n: number) => `${n} keskustelua muuttui`,
  where: { turn: "Sinun vuorosi", fail: "epäonnistui", start: "käynnistyi" } as Record<Kind, string>,
  announce: (title: string, where: string) => `${title}: ${where}`,
  announceMany: (n: number) => `${n} keskustelua muuttui`,
  said: {
    reply: "uusi vastaus, Sinun vuorosi",
    question: "kysyy sinulta, Sinun vuorosi",
    fail: "epäonnistui",
    work: "käynnistyi",
    quiet: "valmis",
  } as Record<State, string>,
  // Main
  ask: "Vertaile kolmea tarjousta: kiinteä, pörssi ja määräaikainen. Mikä tulisi halvimmaksi meidän kulutuksellamme?",
  reply:
    "Viime vuoden kulutuksella (noin 9 800 kWh) **pörssisähkö** olisi tullut halvimmaksi, noin 140 € vähemmän kuin kiinteä. Määräaikainen on kallein, mutta hinta on varma kahdeksi vuodeksi.",
};
type Text = typeof fi;
const en: Text = {
  title: "The rail shows a state change with motion",
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  view: "View",
  views: { desktop: "Desktop", phone: "Phone" },
  reduce: "Reduce motion",
  auto: "Play by itself",
  next: "Next event",
  reset: "Start over",
  one: "▶ One change",
  five: "▶ Five at once",
  stepOf: (i: number, n: number) => `${i}/${n}`,
  start: "Start: you are reading Comparing electricity contracts. Your turn is empty; seven conversations are running.",
  steps: [
    "Spring meeting agenda's turn ends (Running → Your turn).",
    "Sorting receipts starts (Quiet → Running).",
    "Jetty repair quotes fails (stays in Running).",
    "You scroll down: Your turn is out of view above.",
    "Trip plan to Oulu asks you something and moves out of view.",
    "You scroll back up.",
    "Five at once: three to Your turn, two start.",
  ],
  phoneScroll: "On the phone the drawer is closed, so the scroll does not show. Open the drawer from the menu button to see the rows.",
  oneCaption: "One change: Spring meeting agenda's turn ends.",
  fiveCaption: "Five at once: three to Your turn, two start.",
  lines: [
    "A Moves: the row visibly slides into its new section and glows there for a moment, and the section's count rolls. On the phone the name flies into the menu button's count.",
    "B Sweep: the row jumps into place as now, and a band of light crosses it once in the state's colour. On the phone the band crosses the top bar.",
    "C Counter: rows do not move; the section's count, the edge chip's count and the row's time roll like a meter. On the phone the menu button's count rolls.",
  ],
  reducedLine:
    "Reduced motion (the device setting or the switch): nothing moves. A's glow and B's band are a still tint or outline for 4 s, and counts change at once and stay emphasised for 4 s.",
  recommend:
    "Recommended: A. The motion says where the conversation went, and the section says what it wants from you. Five at once move as one calm motion without a glow. B says only that something happened, and C is the calmest but easy to miss.",
  newReply: "New reply",
  asks: "Asking you",
  working: "Agent working",
  failed: "Pi stopped mid-turn",
  done: "Done",
  flyTo: (title: string, where: string) => `${title} → ${where}`,
  flyMany: (n: number) => `${n} conversations changed`,
  where: { turn: "Your turn", fail: "failed", start: "started" },
  announce: (title: string, where: string) => `${title}: ${where}`,
  announceMany: (n: number) => `${n} conversations changed`,
  said: {
    reply: "new reply, Your turn",
    question: "asking you, Your turn",
    fail: "failed",
    work: "started",
    quiet: "done",
  },
  ask: "Compare three offers: fixed, spot and fixed-term. Which would be cheapest for our consumption?",
  reply:
    "At last year's consumption (about 9,800 kWh) **spot price** would have been cheapest, about €140 less than fixed. Fixed-term is the dearest, but its price is certain for two years.",
};
export const TEXT: Record<Lang, Text> = { fi, en };
export type { Text };
