import type { ReactNode } from "react";
import { catalog } from "../i18n";

// A Taskfleet worker's view (components/Spinoffs.tsx): its band, header,
// terminal and result. Harness names, branches, run ids and Taskfleet
// commands come in as arguments or code segments.
const fi = {
  agent: "Agentti",
  askLive: "Vain luku · kysy pääagentin kautta",
  askEnded: "Päättynyt · kysy jatkosta pääagentilta",
  ask: "Kysy",
  result: "Tulos",
  landed: (branch?: string) => `Laskeutui ${branch || "lähtöhaaraan"}`,
  recover: "Palautus pääagentin kautta:",
  decideQuestion: "Mitä tälle työlle tehdään?",
  decide:
    "Agentti tarkistaa sen ja suosittelee; sinä päätät vastaamalla pääkeskustelussa.",
  tell: "Kerro agentille",
  historyUnread: "Workerin historiaa ei saatu luettua.",
  unsupported: (harness: string) =>
    `Habitat ei lue ${harness}-workerin keskustelua, joten sen työ näkyy päätteenä.`,
  replaces:
    "Workerin vastaukset ja työkalut korvaavat päätteen tässä, kun sen istunto löytyy.",
  truncated: "Näytetään workerin historian viimeisin osa.",
  promptTitle: "Worker odottaa vastausta päätteessä",
  showTerminal: "Näytä pääte",
  promptHow: (attach: ReactNode) => (
    <>
      Kehotteeseen vastataan workerin natiivissa päätteessä ({attach}). Selaimen
      pääte on vain luku, eikä pääagentin viesti vastaa kehotteeseen.
    </>
  ),
  terminalLabel: "Workerin pääte",
  terminal: "Pääte",
  readOnly: "vain luku",
  expand: "Avaa pääte koko näkymään",
  terminalMissing: "Workerin päätettä ei löytynyt.",
  closedTitle: "Workerin pääte on suljettu.",
  closed: (unsupportedHarness?: string) =>
    `Worker on päättynyt${unsupportedHarness ? `, eikä Habitat lue ${unsupportedHarness}-workerin keskustelua` : ", eikä sen keskustelua saatu luettua"}. Jäljellä on raportti.`,
  arrived: "Historia tuli luettavaksi: pääte on nyt keskustelun lopussa.",
  worker: "Worker",
  toParent: (title: string) => `Pääkeskusteluun: ${title}`,
  mainAgent: "pääagentti",
  mainConversation: "Pääkeskustelu",
  readOnlyControl: "Vain luku",
  // The worker's header facts (worker-header-status): Git, pull request,
  // context and model on the title row; unknown is a "?" with a sentence.
  header: {
    openDetails: "Avaa workerin tiedot.",
    unknownValue: "?",
    gitReading: "Workerin Git-tilaa luetaan.",
    gitUnknown:
      "Workerin Git-tilaa ei saatu luettua: työpuuta tai sen haaraa ei löytynyt.",
    gitLanded: (branch?: string) =>
      `Workerin työ on yhdistetty ${branch ? `haaraan ${branch}` : "lähtöhaaraan"}, eikä sen työpuuta ole enää.`,
    gitBranchOnly:
      "Workerin työpuuta ei ole tai Habitat ei tunne sitä, joten tiedostoja ei voi näyttää. Luvut on luettu workerin haarasta.",
    gitFetch:
      "Workerin haaran tila luetaan, kun avaat näkymän. Workerin työpuuta ei päivitetä selaimesta.",
    workerBranch: "Workerin haara",
    contextClaude:
      "Kontekstin täyttöä ei tiedetä: Habitat ei vielä lue Claude Coden käyttötietoja.",
    contextUnread:
      "Kontekstin täyttöä ei tiedetä: workerin istuntoa ei ole vielä löytynyt.",
    contextUnsupported:
      "Kontekstin täyttöä ei tiedetä: Habitat ei lue tämän agentin istuntoa.",
    contextFirst:
      "Kontekstin täyttö selviää, kun worker on vastannut ensimmäisen kerran.",
    modelValue: "Malli ?",
    modelUnknown: (
      reason: "unread" | "unsupported" | "unnamed",
      profile?: string,
    ) =>
      `Mallia ei tiedetä: ${reason === "unsupported" ? "Habitat ei lue tämän agentin istuntoa" : reason === "unnamed" ? "workerin istunto ei nimeä sitä" : "workerin istuntoa ei ole löytynyt"}.${profile ? ` Profiili on ${profile}.` : ""}`,
    pr: (n: number) => `PR #${n}`,
    prState: {
      open: "avoin",
      draft: "luonnos",
      closed: "suljettu",
      merged: "yhdistetty",
    } as Record<"open" | "draft" | "closed" | "merged", string>,
    prChecks: (passed: number, failed: number, pending: number) =>
      `Tarkistukset: ${passed} läpi, ${failed} epäonnistui, ${pending} kesken.`,
    prOpen: (n: number) => `Avaa PR #${n} GitHubissa.`,
  },
  facts: {
    parent: "Pääkeskustelu",
    agent: "Agentti",
    profile: (profile: string) => ` · profiili ${profile}`,
    history: "Historia",
    readable: "Luettavissa",
    unsupported: "Habitat ei lue tämän agentin historiaa",
    notFound: "Istuntoa ei ole vielä löytynyt",
    state: "Tila",
    source: "Lähtöhaara",
    branch: "Tallessa oleva haara",
    worktree: "Työpuu",
    run: "Run",
    model: "Malli",
    context: "Konteksti",
    pullRequest: "Pull request",
    pullRequestUrl: "Pull requestin osoite",
    unknown: "Ei tiedossa",
  },
  stale: "Workerin ajantasaista tilaa ei saada.",
  back: "Takaisin keskusteluun",
  conversation: "Workerin keskustelu",
  empty: "Workerin tietoja ei ole vielä.",
  problemTitle: "Workeria ei saada",
  problem: "Taskfleet ei vastannut. Yritetään uudelleen.",
  runContext: "Taskfleetin ajo-ohje workerille",
};

export const spinoffsText = catalog(fi, {
  agent: "Agent",
  askLive: "Read only · ask through the main agent",
  askEnded: "Ended · ask the main agent what next",
  ask: "Ask",
  result: "Result",
  landed: (branch) => `Landed in ${branch || "the source branch"}`,
  recover: "Recover through the main agent:",
  decideQuestion: "What should happen to this work?",
  decide:
    "The agent checks it and recommends; you decide by answering in the main conversation.",
  tell: "Tell the agent",
  historyUnread: "The worker's history could not be read.",
  unsupported: (harness) =>
    `Habitat does not read a ${harness} worker's conversation, so its work shows as a terminal.`,
  replaces:
    "The worker's replies and tools replace the terminal here once its session is found.",
  truncated: "Showing the latest part of the worker's history.",
  promptTitle: "The worker is waiting for an answer in its terminal",
  showTerminal: "Show the terminal",
  promptHow: (attach) => (
    <>
      The prompt is answered in the worker's native terminal ({attach}). The
      browser's terminal is read only, and a message to the main agent does not
      answer the prompt.
    </>
  ),
  terminalLabel: "Worker's terminal",
  terminal: "Terminal",
  readOnly: "read only",
  expand: "Open the terminal in full view",
  terminalMissing: "The worker's terminal was not found.",
  closedTitle: "The worker's terminal is closed.",
  closed: (unsupportedHarness) =>
    `The worker has ended${unsupportedHarness ? `, and Habitat does not read a ${unsupportedHarness} worker's conversation` : ", and its conversation could not be read"}. Its report remains.`,
  arrived:
    "The history became readable: the terminal is now at the end of the conversation.",
  worker: "Worker",
  toParent: (title) => `To the main conversation: ${title}`,
  mainAgent: "main agent",
  mainConversation: "Main conversation",
  readOnlyControl: "Read only",
  header: {
    openDetails: "Open the worker's details.",
    unknownValue: "?",
    gitReading: "Reading the worker's Git state.",
    gitUnknown:
      "The worker's Git state could not be read: its worktree or branch was not found.",
    gitLanded: (branch) =>
      `The worker's work is merged into ${branch || "its source branch"}, and its worktree is gone.`,
    gitBranchOnly:
      "The worker's worktree is gone or Habitat does not know it, so no files can be shown. The counts are read from the worker's branch.",
    gitFetch:
      "The worker's branch is read when you open this view. The worker's worktree is not refreshed from the browser.",
    workerBranch: "The worker's branch",
    contextClaude:
      "How full the context is, is not known: Habitat does not read Claude Code's usage yet.",
    contextUnread:
      "How full the context is, is not known: the worker's session has not been found yet.",
    contextUnsupported:
      "How full the context is, is not known: Habitat does not read this agent's session.",
    contextFirst:
      "How full the context is, is known once the worker has replied for the first time.",
    modelValue: "Model ?",
    modelUnknown: (reason, profile) =>
      `The model is not known: ${reason === "unsupported" ? "Habitat does not read this agent's session" : reason === "unnamed" ? "the worker's session does not name it" : "the worker's session has not been found"}.${profile ? ` The profile is ${profile}.` : ""}`,
    pr: (n) => `PR #${n}`,
    prState: {
      open: "open",
      draft: "draft",
      closed: "closed",
      merged: "merged",
    },
    prChecks: (passed, failed, pending) =>
      `Checks: ${passed} passed, ${failed} failed, ${pending} pending.`,
    prOpen: (n) => `Open PR #${n} on GitHub.`,
  },
  facts: {
    parent: "Main conversation",
    agent: "Agent",
    profile: (profile) => ` · profile ${profile}`,
    history: "History",
    readable: "Readable",
    unsupported: "Habitat does not read this agent's history",
    notFound: "The session has not been found yet",
    state: "State",
    source: "Source branch",
    branch: "Kept branch",
    worktree: "Worktree",
    run: "Run",
    model: "Model",
    context: "Context",
    pullRequest: "Pull request",
    pullRequestUrl: "Pull request address",
    unknown: "Unknown",
  },
  stale: "The worker's current state is not available.",
  back: "Back to the conversation",
  conversation: "Worker's conversation",
  empty: "No worker details yet.",
  problemTitle: "The worker is not available",
  problem: "Taskfleet did not answer. Trying again.",
  runContext: "Taskfleet's run instructions for the worker",
});
