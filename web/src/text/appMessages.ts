import { catalog } from "../i18n";

// Short words and sentences that app modules hand to the views: a shell
// command's failure (app/bashFailure.ts), a clone's state
// (app/cloneJobs.ts), what "Tell the agent" sends (app/editorChanges.ts),
// a full storage (app/github.ts), an unconfirmed workspace deletion
// (app/workspaceTrash.ts) and an offer's zip name (app/fileOffers.ts).
const fi = {
  failed: "epäonnistui",
  exitCode: (n?: number) => `paluuarvo ${n}`,
  timeout: (s?: number) => `aikakatkaisu ${s} s`,
  aborted: "keskeytetty",
  clone: {
    interrupted: "keskeytyi",
    queued: "jonossa",
    refused: "ei alkanut",
    percent: (n: number) => `${n} %`,
    cloning: "kloonataan",
    failed: "epäonnistui",
    done: "valmis",
    stopped: "keskeytetty",
  },
  replacedMessage: (path: string) =>
    `Tallensin tiedoston ${path} ja korvasin samalla muutoksesi. Lue tiedosto uudelleen ennen kuin jatkat.`,
  storageFull:
    "Tallennustila on täynnä. Pyydä ylläpitäjää nostamaan tallennusrajaa.",
  deletionUnconfirmed: "Työtilan poistoa ei voitu vahvistaa.",
  files: "tiedostot",
};

export const appMessagesText = catalog(fi, {
  failed: "failed",
  exitCode: (n) => `exit code ${n}`,
  timeout: (s) => `timed out after ${s} s`,
  aborted: "aborted",
  clone: {
    interrupted: "interrupted",
    queued: "queued",
    refused: "did not start",
    percent: (n) => `${n}%`,
    cloning: "cloning",
    failed: "failed",
    done: "done",
    stopped: "stopped",
  },
  replacedMessage: (path) =>
    `I saved ${path} and replaced your changes in it. Read the file again before you continue.`,
  storageFull:
    "Storage is full. Ask an administrator to raise the storage limit.",
  deletionUnconfirmed: "The workspace deletion could not be confirmed.",
  files: "files",
});
