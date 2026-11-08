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
  openPr: (n: number) => `Avaa PR #${n}`,
  readOnlyControl: "Vain luku",
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
  openPr: (n) => `Open PR #${n}`,
  readOnlyControl: "Read only",
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
