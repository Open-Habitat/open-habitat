import { catalog } from "../i18n";

// The two pills above the composer and their floating panel
// (components/BackgroundStrip.tsx): workers and processes, each row's state
// and the requests ended workers send their conversation. Titles, process
// names and commands come in as arguments.
const fi = {
  ended: (n: number) => `${n} ${n === 1 ? "päättynyt" : "päättynyttä"}`,
  leftOne: (title: string) =>
    `${title} poistui Workerit-listasta: haaraa ja worktreetä ei enää ole.`,
  leftMany: (n: number) =>
    `${n} workeria poistui Workerit-listasta: haaroja ja worktreitä ei enää ole.`,
  wentToNew:
    "Tähän keskusteluun ei voi kirjoittaa selaimesta, joten pyyntö lähti uuteen keskusteluun.",
  unavailable: {
    failed: "Prosessitietoja ei saatu",
    pi_not_running: "Agentti ei ole käynnissä",
    terminal_control: "Agenttia ohjataan terminaalista",
    extension_missing: "Prosessilaajennusta ei ole",
    bridge_unavailable: "Prosessiyhteys ei ole saatavilla",
  },
  spin: {
    head: (n: number) =>
      `Workerit: ${n ? `${n} työskentelee` : "ei työskentele"}`,
    other: (n: number) => `${n} muussa tilassa`,
    waited: (names: string) => `odotetaan: ${names}`,
    unwaited: (n: number) => `${n} ilman odotusta`,
    unfinished: (n: number) =>
      `${n} ${n === 1 ? "keskeneräinen" : "keskeneräistä"}, työ tallessa`,
    handled: (n: number) => `${n} agentin käsittelyssä`,
  },
  proc: {
    cutOff: (n: number) => `Prosessit: ${n} katkesi`,
    unknown: (why: string) => `Prosessit: ei tiedossa (${why})`,
    head: (n: number) => `Prosessit: ${n ? `${n} käynnissä` : "ei käynnissä"}`,
    agentWaits: (names: string) => `agentti odottaa: ${names}`,
    cut: (n: number) => `${n} katkesi`,
  },
  workers: "Workerit",
  processes: "Prosessit",
  // Avustajat (named workers, experimental): the chip beside the Workers
  // pill and its tab. A helper's name is Taskfleet's; its task is the title.
  helpers: "Avustajat",
  help: {
    head: (n: number) => `Avustajat: ${n}`,
    one: (name: string, state: string) => `${name} ${state}`,
    rounds: (n: number) => `${n} ${n === 1 ? "kierros" : "kierrosta"}`,
    working: (n: number) => `kierros ${n} työn alla`,
    reported: (n: number) => `kierros ${n} raportoitu`,
    waiting: "odottaa pääagenttia",
    dormant: "lepää · herää pääagentin viestistä",
    unlanded: "keskeneräinen työ haarassa",
    ended: "lopetettu",
    report: (n: number, line: string) => `${n}. kierros: ${line}`,
    open: "Avaa avustajan keskustelu",
    running: "Avustajat",
  },
  askMany: (n: number, toNew: boolean) =>
    `Lähettää yhden pyynnön ${toNew ? "uuteen keskusteluun" : "tähän keskusteluun"}: agentti tarkistaa ${n} workeria ja suosittelee.`,
  askOne: (toNew: boolean) =>
    `Lähettää pyynnön ${toNew ? "uuteen keskusteluun" : "tähän keskusteluun"}: agentti tarkistaa worktreen ja suosittelee.`,
  attention: "Vaatii huomiota",
  clearTitle:
    "Poistaa päättyneet prosessit ja niiden lokit. Päättyneet workerit jäävät: ne ovat Taskfleetin ajoja.",
  clear: "Poista päättyneet",
  handleAll: (n: number) => `Käsittele kaikki (${n})`,
  handle: "Käsittele",
  endedGroup: (kind: string) => `${kind}: päättyneet`,
  gone: "haara ja worktree poistettu",
  openWorker: "Avaa workerin näkymä",
  otherRepository: "Eri repositorio kuin tämä keskustelu",
  stopWait: (title: string) => `Lopeta odotus: ${title}`,
  stopWaitTitle:
    "Lopettaa agentin odotuksen. Worker jatkaa työtään, eikä agentti herää sen valmistuessa.",
  open: "Avaa",
  show: "Näytä",
  // Hidden on a narrow row, so the verb alone must still make sense.
  conversation: "keskustelu",
  tell: "Kerro agentille",
  code: (n: number) => `koodi ${n}`,
  waitsThis: "Agentti odottaa tätä",
  waitsThisTitle: "Agentti jatkaa, kun tämä päättyy",
  stop: (name: string) => `Pysäytä ${name}`,
  stopTitle: (name: string) =>
    `Pysäytä prosessi ${name}. Agentti ei saa tästä ilmoitusta.`,
  connectGitHub: "Yhdistä GitHub",
  stale: "Tila voi olla vanhentunut.",
  workersRunning: "Workerit: käynnissä",
  noWorkers: "Ei työskenteleviä workereita.",
  unavailableNote: (why: string) =>
    `${why}. Puuttuva tieto ei tarkoita, ettei prosesseja ole.`,
  processesRunning: "Prosessit: käynnissä",
  noProcesses: "Ei käynnissä olevia prosesseja.",
  background: "Taustatyö",
  close: "Sulje",
  state: {
    kept: " · työ tallessa",
    mergedKept: "mergetty · worktree jäljellä",
    landed: "laskeutui",
    failed: (kept: string) => `epäonnistui${kept}`,
    unmerged: (kept: string) => `ei mergetty${kept}`,
    waitingParent: "odottaa pääagenttia",
    awaitingInput: "odottaa vastausta päätteessä",
    idle: "odottaa sinua",
    unknown: "tila ei tiedossa",
    waitedWith: (state: string) => `agentti odottaa · ${state}`,
    waited: "agentti odottaa",
    notWaited: "agentti ei odota",
  },
  phase: {
    inNew: "uudessa keskustelussa",
    inHere: "tässä keskustelussa",
    queued: "pyyntö jonossa · lähtee, kun vuoro päättyy",
    sentNew: "pyyntö lähetetty · uudessa keskustelussa",
    sent: "pyyntö lähetetty",
    answer: (where: string) => `odottaa vastaustasi · ${where}`,
    acting: (where: string) => `agentti toimii vastauksesi mukaan · ${where}`,
    checking: (where: string) => `agentti tarkistaa · ${where}`,
  },
};

export const backgroundStripText = catalog(fi, {
  ended: (n) => `${n} ended`,
  leftOne: (title) =>
    `${title} left the Workers list: its branch and worktree are gone.`,
  leftMany: (n) =>
    `${n} workers left the Workers list: their branches and worktrees are gone.`,
  wentToNew:
    "This conversation can't be written to from the browser, so the request went to a new conversation.",
  unavailable: {
    failed: "Process information could not be read",
    pi_not_running: "The agent is not running",
    terminal_control: "The agent is controlled from a terminal",
    extension_missing: "The process extension is missing",
    bridge_unavailable: "The process connection is not available",
  },
  spin: {
    head: (n) => `Workers: ${n ? `${n} working` : "none working"}`,
    other: (n) => `${n} in another state`,
    waited: (names) => `waited for: ${names}`,
    unwaited: (n) => `${n} not waited for`,
    unfinished: (n) => `${n} unfinished, work kept`,
    handled: (n) => `${n} being handled by the agent`,
  },
  proc: {
    cutOff: (n) => `Processes: ${n} cut off`,
    unknown: (why) => `Processes: unknown (${why})`,
    head: (n) => `Processes: ${n ? `${n} running` : "none running"}`,
    agentWaits: (names) => `the agent is waiting for: ${names}`,
    cut: (n) => `${n} cut off`,
  },
  workers: "Workers",
  processes: "Processes",
  helpers: "Helpers",
  help: {
    head: (n) => `Helpers: ${n}`,
    one: (name, state) => `${name} ${state}`,
    rounds: (n) => `${n} ${n === 1 ? "round" : "rounds"}`,
    working: (n) => `round ${n} under way`,
    reported: (n) => `round ${n} reported`,
    waiting: "waiting for the main agent",
    dormant: "resting · wakes at the main agent's message",
    unlanded: "unfinished work on its branch",
    ended: "stopped",
    report: (n, line) => `round ${n}: ${line}`,
    open: "Open the helper's conversation",
    running: "Helpers",
  },
  askMany: (n, toNew) =>
    `Sends one request ${toNew ? "to a new conversation" : "to this conversation"}: the agent checks ${n} workers and recommends what to do.`,
  askOne: (toNew) =>
    `Sends a request ${toNew ? "to a new conversation" : "to this conversation"}: the agent checks the worktree and recommends what to do.`,
  attention: "Needs attention",
  clearTitle:
    "Removes finished processes and their logs. Ended workers stay: they are Taskfleet runs.",
  clear: "Remove finished",
  handleAll: (n) => `Handle all (${n})`,
  handle: "Handle",
  endedGroup: (kind) => `${kind}: ended`,
  gone: "branch and worktree removed",
  openWorker: "Open the worker's view",
  otherRepository: "A different repository from this conversation",
  stopWait: (title) => `Stop waiting: ${title}`,
  stopWaitTitle:
    "Stops the agent's wait. The worker carries on, and the agent does not wake when it finishes.",
  open: "Open",
  show: "Show",
  conversation: "conversation",
  tell: "Tell the agent",
  code: (n) => `code ${n}`,
  waitsThis: "The agent is waiting for this",
  waitsThisTitle: "The agent continues when this ends",
  stop: (name) => `Stop ${name}`,
  stopTitle: (name) =>
    `Stop the process ${name}. The agent gets no notification of it.`,
  connectGitHub: "Connect GitHub",
  stale: "The state may be out of date.",
  workersRunning: "Workers: running",
  noWorkers: "No workers at work.",
  unavailableNote: (why) =>
    `${why}. Missing information does not mean there are no processes.`,
  processesRunning: "Processes: running",
  noProcesses: "No running processes.",
  background: "Background work",
  close: "Close",
  state: {
    kept: " · work kept",
    mergedKept: "merged · worktree still there",
    landed: "landed",
    failed: (kept) => `failed${kept}`,
    unmerged: (kept) => `not merged${kept}`,
    waitingParent: "waiting for the main agent",
    awaitingInput: "waiting for an answer in its terminal",
    idle: "waiting for you",
    unknown: "state unknown",
    waitedWith: (state) => `agent waiting · ${state}`,
    waited: "agent waiting",
    notWaited: "agent not waiting",
  },
  phase: {
    inNew: "in a new conversation",
    inHere: "in this conversation",
    queued: "request queued · sent when the turn ends",
    sentNew: "request sent · in a new conversation",
    sent: "request sent",
    answer: (where) => `waiting for your answer · ${where}`,
    acting: (where) => `agent acting on your answer · ${where}`,
    checking: (where) => `agent checking · ${where}`,
  },
});
