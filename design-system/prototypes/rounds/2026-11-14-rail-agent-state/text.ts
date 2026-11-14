// The round's own words, Finnish and English. Production pieces (section
// headings, Hiljaiset, the mark's tooltips) keep their own catalogs and
// follow the same language choice. Titles, workspaces, worker names and the
// questions are synthetic data.

const fi = {
  title: "Agentin paikka sivupalkissa · kierros 1",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  lines: [
    "Nyt: sivupalkki tänään samoille keskusteluille. Habitat näkee vain vuoron ja workerit, ei sitä, mitä agentti odottaa.",
    "1 Agentin rivi: agentin ilmoitus valitsee osion, ja sen omat sanat näkyvät otsikon alla toisena rivinä. Havaitut rivit pysyvät yksirivisinä, joten ilmoitettu erottuu havaitusta.",
    "2 Sama kieli: ilmoitus valitsee osion ja merkin, mutta rivi näyttää havainnolta ja pysyy yksirivisenä. Vain sinulle esitetty kysymys saa toisen rivin.",
    "3 Kysymysrivi: avoin kysymys on oma sisennetty rivinsä keskustelunsa alla, Käynnissä niin kauan kuin agentti hoitaa sitä ja Sinun vuorosi -osiossa, kun agentti kysyy sinulta.",
  ],
  recommend:
    "Suositus: 1 Agentin rivi. Rivin syy luetaan avaamatta keskustelua, kysymys näkyy sanoina, ja rauennut ilmoitus näkyy rauenneena eikä totena.",
  // Synthetic conversations.
  conv: {
    release: "Kevään julkaisu",
    tiles: "Karttatasojen välimuisti",
    elevation: "Reittihaun korkeuserot",
    notice: "Julkaisutiedote",
    a11y: "Saavutettavuuskatselmointi",
    glossary: "Sanaston siivous",
    backups: "Varmuuskopioiden siirto",
    receipts: "Kuittien nimeäminen",
    colors: "Teemavärit",
  },
  workerName: "Korkeusdata",
  noticeQuestion: "Julkaistaanko perjantaina vai vasta maanantaina?",
  workerQuestion: "SRTM vai Maanmittauslaitoksen korkeusmalli?",
  // What a declared state says, in the agent's words (Agentin rivi) or as
  // the row's state words (all directions' descriptions).
  waitsWorkers: (n: number) =>
    n === 1 ? "Odottaa workeria" : `Odottaa ${n === 2 ? "kahta" : n} workeria`,
  // design.md §2.1 and §2.4 share the native question's label.
  needsAnswer: "Kysyy sinulta",
  needsAnswerLine: (q: string) => `Kysyy sinulta: ${q}`,
  workerAsksLine: (w: string, q: string) => `${w} kysyy: ${q}`,
  workerAsked: (w: string) => `Worker ${w} kysyi`,
  parentAnswers: "agentti vastaa",
  fromWorker: (w: string) => `workerilta ${w}`,
  done: "Valmis, ei odota mitään",
  staleLine: (n: number) =>
    `Odotti ${n === 2 ? "kahta" : n} workeria · niitä ei enää näy`,
  workerAskedAnswering: (w: string) => `${w} kysyy agentilta`,
  stale: "ilmoitus rauennut",
  answering: "Vastaa workerin kysymykseen",
  agentSays: "Agentti ilmoitti",
  // The story beside the rail.
  storyHead: "Mitä agentit ilmoittivat",
  storyLead:
    "Agentti ilmoittaa vuoronsa aikana, kenen siirto on seuraavaksi. Ilmoitus on voimassa vuoron päättymisestä seuraavan vuoron alkuun; odotus workereille raukeaa myös, kun Habitat ei enää näe niistä yhtään työssä.",
  status: {
    live: "Voimassa",
    stale: "Rauennut: palvelin käynnistyi uudelleen, eikä Habitat näe enää yhtään workeria työssä",
    observed: "Havaittu, ei ilmoitusta",
    workerAsked: "Taskfleet: worker kysyy pääagentilta",
  },
  ended: {
    write: "Päättyi: kirjoitit keskusteluun",
    workers: "Päättyi: workerit valmistuivat, agentti jatkaa",
  },
  events: "Tapahtumat",
  ev: {
    escalate: "Agentti kysyy sinulta workerin kysymyksen",
    write: "Kirjoitat Julkaisutiedotteeseen",
    workers: "Karttatasojen workerit valmistuvat",
    reset: "Alkutila",
  },
  menuHint: "Puhelimessa sivupalkki aukeaa valikosta.",
};

export type Text = typeof fi;

const en: Text = {
  title: "The agent's place in the rail · round 1",
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  lines: [
    "Now: today's rail for the same conversations. Habitat sees only the turn and the workers, not what the agent is waiting for.",
    "1 Agent's line: the agent's declaration picks the section, and its own words stand under the title as a second line. Observed rows stay one line, so a declaration stands apart from an observation.",
    "2 Same language: the declaration picks the section and the mark, but the row reads like an observation and stays one line. Only a question put to you gets a second line.",
    "3 Question row: an open question is its own indented row under its conversation, in Running while the agent handles it and in Your turn once the agent asks you.",
  ],
  recommend:
    "Recommendation: 1 Agent's line. The row's reason reads without opening the conversation, a question shows as words, and a lapsed declaration shows as lapsed rather than true.",
  conv: {
    release: "Spring release",
    tiles: "Map tile cache",
    elevation: "Route elevation profile",
    notice: "Release announcement",
    a11y: "Accessibility review",
    glossary: "Glossary cleanup",
    backups: "Backup migration",
    receipts: "Receipt naming",
    colors: "Theme colours",
  },
  workerName: "Elevation data",
  noticeQuestion: "Publish on Friday or wait until Monday?",
  workerQuestion: "SRTM or the national elevation model?",
  waitsWorkers: (n: number) =>
    n === 1 ? "Waiting for a worker" : `Waiting for ${n === 2 ? "two" : n} workers`,
  needsAnswer: "Asking you",
  needsAnswerLine: (q: string) => `Asking you: ${q}`,
  workerAsksLine: (w: string, q: string) => `${w} asks: ${q}`,
  workerAsked: (w: string) => `Worker ${w} asked`,
  parentAnswers: "the agent is answering",
  fromWorker: (w: string) => `from worker ${w}`,
  done: "Done, nothing pending",
  staleLine: (n: number) =>
    `Was waiting for ${n === 2 ? "two" : n} workers · none seen now`,
  workerAskedAnswering: (w: string) => `${w} asks the agent`,
  stale: "declaration lapsed",
  answering: "Answering a worker's question",
  agentSays: "The agent declared",
  storyHead: "What the agents declared",
  storyLead:
    "During its turn the agent says who has the next move. The declaration holds from the end of that turn to the start of the next; waiting for workers also lapses once Habitat sees none of them working.",
  status: {
    live: "In effect",
    stale: "Lapsed: the server restarted and Habitat no longer sees any worker working",
    observed: "Observed, no declaration",
    workerAsked: "Taskfleet: a worker asks its main agent",
  },
  ended: {
    write: "Ended: you wrote in the conversation",
    workers: "Ended: the workers finished and the agent carries on",
  },
  events: "Events",
  ev: {
    escalate: "The agent asks you the worker's question",
    write: "You write in Release announcement",
    workers: "The map tile workers finish",
    reset: "Start over",
  },
  menuHint: "On a phone the rail opens from the menu.",
};

export const TEXT = { fi, en };
