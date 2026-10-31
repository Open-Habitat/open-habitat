import { catalog } from "../i18n";

// Habitat's account of a rest and of a restart (components/RestartNotice.tsx).
// Times come in as syncedTime's "klo 14.05" / "at 14:05".
const fi = {
  // Each is Taskfleet's own report. A stall is Taskfleet's verdict about a
  // supervisor, which a live worker can contradict, so it is attributed.
  runState: {
    merged: "valmis ja yhdistetty",
    not_merged: "valmis, ei yhdistetty",
    failed: "epäonnistui",
    cancelled: "peruttu",
    awaiting: "odottaa sinua",
    stalled: "Taskfleetin mukaan pysähtynyt",
  },
  turnCut: " Agentin kesken ollut työ katkesi.",
  cutOff: (n: number) =>
    ` ${n === 1 ? "Yksi taustatyö katkesi" : `${n} taustatyötä katkesi`} samalla.`,
  nothingCut: " Mikään työ ei katkennut.",
  stop: {
    idle: (at: string, cut: string) =>
      `Pi pysähtyi ${at}, kun se oli ollut 10 minuuttia jouten.${cut}`,
    room: (at: string, cut: string) =>
      `Pi pysähtyi ${at} tehdäkseen tilaa toiselle keskustelulle.${cut}`,
    person: (at: string, cut: string) => `Pysäytit agentin ${at}.${cut}`,
    crash: (at: string, cut: string) => `Pi kaatui ${at}.${cut}`,
    restart: (at: string, cut: string) =>
      `Habitat käynnistyi uudelleen ${at}, esimerkiksi päivityksen vuoksi, ja Pi pysähtyi viimeistään silloin.${cut}`,
  },
  // Why Habitat woke the agent itself: what it was waiting for ended.
  wokeBecause: {
    settled: ", koska ajot, joita se odotti, päättyivät",
    cut_off:
      ", koska taustatyö, jota se odotti, katkesi eikä enää kerro päättymisestään",
  },
  wake: {
    asleep:
      "Kirjoita, niin agentti herää. Se saa tämän saman selostuksen viestisi mukana.",
    waking: "Agentti käynnistyy…",
    awake: "Agentti on hereillä. Lähetä, niin se vastaa.",
    refused:
      "Agenttia ei voitu käynnistää nyt. Se käynnistyy, kun lähetät viestin.",
  },
  refusedBecause: (why: string) => `Agenttia ei voitu käynnistää. ${why}`,
  markerLabel: "Agentin lepo",
  cardLabel: "Agentti lepää",
  rested: (range: string) => `Agentti lepäsi ${range}`,
  resting: "Agentti lepää",
  cutList: "Katkenneet taustatyöt: ",
  endedMeanwhile: "Päättyi sillä välin",
  branchKept: "haara tallessa",
  stillRunning: "Yhä käynnissä",
  runningSince: (at: string) => `käynnissä ${at} alkaen`,
  running: "käynnissä",
  waitCut: "odotus katkesi",
  nobodyWaits: "kukaan ei odota sitä",
  unavailable: "Kaikkia taustatöiden tietoja ei voitu lukea juuri nyt.",
  woke: (byHabitat: boolean, at: string, because: string) =>
    `${byHabitat ? "Habitat herätti agentin" : "Viestisi herätti agentin"}${at}${because}. Agentti sai tämän selostuksen.`,
  restarted: "Agentti käynnistettiin uudelleen",
  stillRunningCut: (names: string) => `Yhä käynnissä, odotus katkesi: ${names}`,
};

export const restartNoticeText = catalog(fi, {
  runState: {
    merged: "done and merged",
    not_merged: "done, not merged",
    failed: "failed",
    cancelled: "cancelled",
    awaiting: "waiting for you",
    stalled: "stalled, according to Taskfleet",
  },
  turnCut: " The work the agent had under way was cut off.",
  cutOff: (n) =>
    ` ${n === 1 ? "One background job was" : `${n} background jobs were`} cut off at the same time.`,
  nothingCut: " No work was cut off.",
  stop: {
    idle: (at, cut) =>
      `Pi stopped ${at} after it had been idle for 10 minutes.${cut}`,
    room: (at, cut) =>
      `Pi stopped ${at} to make room for another conversation.${cut}`,
    person: (at, cut) => `You stopped the agent ${at}.${cut}`,
    crash: (at, cut) => `Pi crashed ${at}.${cut}`,
    restart: (at, cut) =>
      `Habitat restarted ${at}, for example for an update, and Pi stopped then at the latest.${cut}`,
  },
  wokeBecause: {
    settled: ", because the runs it was waiting for ended",
    cut_off:
      ", because the background job it was waiting for was cut off and will no longer report its end",
  },
  wake: {
    asleep:
      "Write, and the agent wakes up. It gets this same account with your message.",
    waking: "The agent is starting…",
    awake: "The agent is awake. Send, and it answers.",
    refused:
      "The agent could not be started now. It starts when you send a message.",
  },
  refusedBecause: (why) => `The agent could not be started. ${why}`,
  markerLabel: "The agent's rest",
  cardLabel: "The agent is resting",
  rested: (range) => `The agent rested ${range}`,
  resting: "The agent is resting",
  cutList: "Background work cut off: ",
  endedMeanwhile: "Ended in the meantime",
  branchKept: "branch kept",
  stillRunning: "Still running",
  // "at 14:05" reads "since 14:05"; an earlier day keeps its date.
  runningSince: (at) => `running since ${at.replace(/^at /, "")}`,
  running: "running",
  waitCut: "wait cut off",
  nobodyWaits: "nobody is waiting for it",
  unavailable: "Not all background work could be read just now.",
  woke: (byHabitat, at, because) =>
    `${byHabitat ? "Habitat woke the agent" : "Your message woke the agent"}${at}${because}. The agent got this account.`,
  restarted: "The agent was restarted",
  stillRunningCut: (names) => `Still running, wait cut off: ${names}`,
});
