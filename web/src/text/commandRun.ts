import { catalog } from "../i18n";

// A `!` command's card in the conversation
// (components/composer/CommandRun.tsx): its state and its notes.
const fi = {
  label: "Sinä · komento",
  stopping: "Keskeytetään…",
  held: "Odottaa agentin käynnistymistä",
  running: (time: string) => (time ? `Ajossa ${time}` : "Ajossa"),
  cancelled: "Pysäytetty",
  exitCode: (code: number | undefined) => `Paluuarvo ${code}`,
  done: "Valmis",
  failed: "Epäonnistui",
  notStarted: "Ei ajettu",
  unknown: "Tulos ei tiedossa",
  notStartedNote: "Komentoa ei ajettu. Sitä ei ajeta myöhemmin.",
  uncertainNote:
    "Yhteys katkesi tai agentti päättyi ennen tulosta. Komentoa ei ajeta uudelleen.",
  waitingOutput: "Odotetaan tulostetta…",
  noOutput: "(ei tulostetta)",
};

export const commandRunText = catalog(fi, {
  label: "You · command",
  stopping: "Stopping…",
  held: "Waiting for the agent to start",
  running: (time) => (time ? `Running ${time}` : "Running"),
  cancelled: "Stopped",
  exitCode: (code) => `Exit code ${code}`,
  done: "Done",
  failed: "Failed",
  notStarted: "Not run",
  unknown: "Result unknown",
  notStartedNote: "The command was not run. It will not run later.",
  uncertainNote:
    "The connection broke or the agent ended before a result. The command will not run again.",
  waitingOutput: "Waiting for output…",
  noOutput: "(no output)",
});
