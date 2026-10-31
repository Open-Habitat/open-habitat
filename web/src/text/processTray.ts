import { catalog, plural } from "../i18n";

// A conversation's processes (components/ProcessTray.tsx): the control
// notices, the process window, interrupted processes, a completion in the
// history, a process tool call's receipt and the waiting chip. Process names,
// commands and output come in as arguments.
const fi = {
  notice: {
    error: "Toiminto epäonnistui.",
    timeout: "Prosessi ei pysähtynyt. Voit pakottaa lopetuksen.",
    waitStopped:
      "Odotus lopetettiin. Worker jatkaa työtään, eikä agentti saa ilmoitusta.",
    stopped: "Prosessi pysäytettiin. Agentti ei saa tästä ilmoitusta.",
    cleared:
      "Päättyneet prosessit ja niiden lokit poistettiin. Historia säilyy.",
    stale:
      "Prosessin omistaja vaihtui. Tiedot päivitetään; toimintoa ei toistettu.",
    failed: "Toiminto epäonnistui. Tarkista tila.",
  },
  process: "Prosessi",
  processNamed: (name: string) => `Prosessi ${name}`,
  code: (n: number) => ` · koodi ${n}`,
  close: "Sulje",
  stopTitle: "Pysäyttää prosessin. Agentti ei saa tästä ilmoitusta.",
  force: "Pakota lopetus",
  stop: "Pysäytä",
  clearTitle:
    "pi-processes poistaa päättyneet yhdessä. Keskustelun historia säilyy.",
  clear: "Poista päättyneet",
  forceTitle: "Lopettaa prosessin heti (SIGKILL).",
  outputGone:
    "Tulostetta ei ole enää saatavilla. Prosessi on voitu poistaa tai agentti on käynnistetty uudelleen.",
  interrupted: "Katkenneet",
  started: (time: string) => `aloitettu ${time}`,
  interruptedNote:
    "Agentti kuulee katkenneista prosesseista seuraavan viestisi yhteydessä.",
  workerRuns: (ids: string) =>
    `Worker-ajot: ${ids}. Odotuksen lopettaminen ei pysäytä ajoja.`,
  pauseFollow: "Pysäytä seuraaminen",
  follow: "Seuraa loppua",
  paused:
    "Seuraaminen tauolla. Prosessi jatkaa; jatkaminen hakee uuden loppuosan.",
  outputFailed: "Tulostetta ei saatu. Aiempi tuloste ei ole ajantasainen.",
  tailUnknown:
    "Näytetään säilytetty loppuosa; aiempien rivien määrä ei ole tiedossa.",
  omitted: (n: number) => `${n} aiempaa riviä ei näytetä.`,
  tail: "Säilytetty loppuosa.",
  retentionRestarted: "Lokin säilytys on alkanut uudelleen.",
  retentionUnknown: "Lokin aiempi säilytys ei ole tiedossa.",
  output: "Prosessin tuloste",
  loading: "Ladataan tulostetta…",
  logMatch: "lokiosuma",
  logMatchSuppressed: "lokiosumien ilmoituksia jätettiin pois",
  woke: " · herätti agentin",
  steer: " · agentille työn aikana",
  context: " · agentin kontekstiin",
  now: "(nykytila)",
  runsUnknown: "Worker-ajot: nykytilaa ei saatu.",
  waitTimedOut: "Odotus aikakatkaistiin. Workerit voivat yhä työskennellä.",
  waitFailed: "Odotusehto päättyi epäonnistuneeseen ajoon.",
  checkIn:
    "Taskfleet palautti tilannekuvan sovitun ajan jälkeen. Workerit työskentelevät yhä, ja agentti voi jatkaa odotusta.",
  codeUnknown:
    "Habitat ei tiedä, mitä koodi tälle komennolle tarkoittaa. Agentti kertoo sen yleensä seuraavassa viestissään.",
  openInventory: "Avaa nykyiset prosessit",
  kept: "Merkintä säilyy historiassa. Aiemman prosessin tulosteen saatavuutta ei voida varmistaa.",
  call: "kutsu",
  showProcess: "Näytä prosessi ja tuloste",
  notJoined:
    "Nykyistä prosessia ei voitu yhdistää tähän kutsuun. Tarkista prosessit kentän yllä.",
  callDetails: "Kutsun tiedot",
  processFallback: "prosessi",
  started_: "Käynnistetty",
  showWaited: "Näytä mitä agentti odottaa",
};

export const processTrayText = catalog(fi, {
  notice: {
    error: "The action failed.",
    timeout: "The process did not stop. You can force it to end.",
    waitStopped:
      "The wait was stopped. The worker carries on, and the agent gets no notification.",
    stopped: "The process was stopped. The agent gets no notification of it.",
    cleared:
      "Finished processes and their logs were removed. The history stays.",
    stale:
      "The process changed owner. The details are being refreshed; the action was not repeated.",
    failed: "The action failed. Check the state.",
  },
  process: "Process",
  processNamed: (name) => `Process ${name}`,
  code: (n) => ` · code ${n}`,
  close: "Close",
  stopTitle: "Stops the process. The agent gets no notification of it.",
  force: "Force stop",
  stop: "Stop",
  clearTitle:
    "pi-processes removes finished processes together. The conversation's history stays.",
  clear: "Remove finished",
  forceTitle: "Ends the process at once (SIGKILL).",
  outputGone:
    "The output is no longer available. The process may have been removed or the agent restarted.",
  interrupted: "Cut off",
  started: (time) => `started ${time}`,
  interruptedNote:
    "The agent hears about the cut-off processes with your next message.",
  workerRuns: (ids) =>
    `Worker runs: ${ids}. Stopping the wait does not stop the runs.`,
  pauseFollow: "Stop following",
  follow: "Follow the end",
  paused:
    "Following is paused. The process carries on; resuming fetches the latest output.",
  outputFailed:
    "The output could not be read. The output shown is not current.",
  tailUnknown:
    "Showing the kept end of the output; how many lines came before is unknown.",
  omitted: (n) =>
    `${n} earlier ${plural("en", n, { one: "line is", other: "lines are" })} not shown.`,
  tail: "The kept end of the output.",
  retentionRestarted: "Log retention has started over.",
  retentionUnknown: "Earlier log retention is unknown.",
  output: "Process output",
  loading: "Loading output…",
  logMatch: "log match",
  logMatchSuppressed: "log match notifications left out",
  woke: " · woke the agent",
  steer: " · to the agent while it worked",
  context: " · into the agent's context",
  now: "(current state)",
  runsUnknown: "Worker runs: the current state could not be read.",
  waitTimedOut: "The wait timed out. The workers may still be working.",
  waitFailed: "The wait ended on a failed run.",
  checkIn:
    "Taskfleet returned a snapshot after the agreed time. The workers are still working, and the agent can keep waiting.",
  codeUnknown:
    "Habitat does not know what the code means for this command. The agent usually explains it in its next message.",
  openInventory: "Open current processes",
  kept: "The entry stays in the history. Whether the earlier process's output is still available cannot be confirmed.",
  call: "call",
  showProcess: "Show the process and its output",
  notJoined:
    "No current process could be matched to this call. Check the processes above the composer.",
  callDetails: "Call details",
  processFallback: "process",
  started_: "Started",
  showWaited: "Show what the agent is waiting for",
});
