// The round's own words, Finnish and English. Production pieces (the band,
// AgentHeader, GitStatusChip, ContextRing) keep their own catalogs and follow
// the same language choice; harness and model names, branches and run ids
// come in as data.

const fi = {
  title: "Workerin yläpalkki · kierros 1",
  caseLabel: "Tilanne",
  cases: {
    alussa: "Claude Code, ei vielä muutoksia",
    pr: "Pi, muutoksia ja PR, konteksti lähes täynnä",
    lukematon: "Tietoja ei saatu luettua",
  },
  theme: "Teema",
  light: "Vaalea",
  dark: "Tumma",
  language: "Kieli",
  lines: [
    "Otsikkorivillä: Git, konteksti ja malli ovat otsikon rivillä samassa paikassa ja järjestyksessä kuin keskustelussa. Nauha kertoo vain, kenen worker tämä on.",
    "Nauhassa: painikkeet ovat workerin nauhassa pääkeskustelulinkin vieressä, ja otsikkorivi pysyy nykyisellään. Workerin tiedot ja sen suhde pääagenttiin ovat yhdellä rivillä.",
  ],
  recommend:
    "Suositus: Otsikkorivillä. Sama tieto on samassa paikassa kuin keskustelussa, joten sitä ei tarvitse opetella kahdesti, ja nauha säilyy merkkinä siitä, että katsot workeria.",
  // The worker's facts in its header details (Tiedot).
  factContext: "Konteksti",
  factModel: "Malli",
  // What the round shows where the host could not say.
  gitUnknownValue: "?",
  gitUnknown:
    "Workerin Git-tilaa ei saatu luettua: työpuuta tai sen haaraa ei löytynyt.",
  gitUnknownTitle: "Git: ei tiedossa",
  contextUnknownValue: "?",
  contextUnknown:
    "Kontekstin täyttöä ei tiedetä: workerin istuntoa ei ole vielä löytynyt.",
  modelUnknownValue: "Malli ?",
  modelUnknown:
    "Mallia ei tiedetä: workerin istuntoa ei ole vielä löytynyt. Profiili on prototype-opus.",
  openDetails: "Avaa workerin tiedot.",
  pr: (n: number) => `PR #${n}`,
  prState: {
    open: "avoin",
    draft: "luonnos",
    closed: "suljettu",
    merged: "yhdistetty",
  } as Record<string, string>,
  prChecks: (passed: number, failed: number, pending: number) =>
    `Tarkistukset: ${passed} läpi, ${failed} epäonnistui, ${pending} kesken.`,
  prOpen: (n: number) => `Avaa PR #${n} GitHubissa.`,
  fetchWorker:
    "Workerin haaran tila luetaan, kun avaat näkymän. Workerin työpuuta ei päivitetä selaimesta.",
};

const en: typeof fi = {
  title: "Worker header · round 1",
  caseLabel: "Case",
  cases: {
    alussa: "Claude Code, no changes yet",
    pr: "Pi, changes and a PR, context nearly full",
    lukematon: "Facts could not be read",
  },
  theme: "Theme",
  light: "Light",
  dark: "Dark",
  language: "Language",
  lines: [
    "Title row: Git, context and model sit on the title row in the same place and order as in a conversation. The band only says whose worker this is.",
    "Band: the buttons sit in the worker's band beside the parent link, and the title row stays as it is. The worker's facts and its relation to the main agent are one row.",
  ],
  recommend:
    "Recommendation: Title row. The same facts are where a conversation has them, so nothing is learned twice, and the band stays as the sign that you are looking at a worker.",
  factContext: "Context",
  factModel: "Model",
  gitUnknownValue: "?",
  gitUnknown:
    "The worker's Git state could not be read: its worktree or branch was not found.",
  gitUnknownTitle: "Git: unknown",
  contextUnknownValue: "?",
  contextUnknown:
    "How full the context is, is not known: the worker's session has not been found yet.",
  modelUnknownValue: "Model ?",
  modelUnknown:
    "The model is not known: the worker's session has not been found yet. The profile is prototype-opus.",
  openDetails: "Open the worker's details.",
  pr: (n) => `PR #${n}`,
  prState: { open: "open", draft: "draft", closed: "closed", merged: "merged" },
  prChecks: (passed, failed, pending) =>
    `Checks: ${passed} passed, ${failed} failed, ${pending} pending.`,
  prOpen: (n) => `Open PR #${n} on GitHub.`,
  fetchWorker:
    "The worker's branch is read when you open this view. The worker's worktree is not refreshed from the browser.",
};

export type Text = typeof fi;
export const TEXT = { fi, en };
