# text/processes.ts

Generated from web/src/text/processes.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// Process and wait states (app/processes.ts): a spinoff joined to a wait, an
// interrupted process, how an ended process reads and its status label.
const fi = {
  run: {
    working: "Työskentelee",
    idle: "Odottaa sinua",
    waiting_parent: "Odottaa pääagenttia",
    merged: "Mergetty",
    unmerged: "Ei mergetty",
    unmergedKept: "Ei mergetty · työ tallessa",
    failed: "Epäonnistui",
    failedKept: "Epäonnistui · työ tallessa",
    unknown: "Tila ei tiedossa",
    cancelledKept: "Peruttu · työ tallessa",
  },
  interruptedRestart: "Katkesi palvelimen uudelleenkäynnistyksessä",
  interruptedStopped: "Katkesi, kun agentti pysähtyi",
  // Lower-case: these sit in the middle of a sentence.
  exit: {
    killed: "pysäytetty",
    notStarted: "ei käynnistynyt",
    lost: "katosi",
    done: "valmis",
    crashed: "kaatui",
    failed: "epäonnistui",
    waitTimeout: "odotus aikakatkaistiin",
    runFailed: "ajo epäonnistui",
    checkIn: "välitarkistus",
    ended: "päättyi",
  },
  status: {
    running: "Käynnissä",
    terminating: "Pysäytetään…",
    terminate_timeout: "Ei pysähtynyt",
    killed: "Pysäytetty",
  },
};

export const processesText = catalog(
  fi,
  {
    run: {
      working: "Working",
      idle: "Waiting for you",
      waiting_parent: "Waiting for the main agent",
      merged: "Merged",
      unmerged: "Not merged",
      unmergedKept: "Not merged · work kept",
      failed: "Failed",
      failedKept: "Failed · work kept",
      unknown: "State unknown",
      cancelledKept: "Canceled · work kept",
    },
    interruptedRestart: "Cut off when the server restarted",
    interruptedStopped: "Cut off when the agent stopped",
    exit: {
      killed: "stopped",
      notStarted: "did not start",
      lost: "lost",
      done: "done",
      crashed: "crashed",
      failed: "failed",
      waitTimeout: "wait timed out",
      runFailed: "run failed",
      checkIn: "check-in",
      ended: "ended",
    },
    status: {
      running: "Running",
      terminating: "Stopping…",
      terminate_timeout: "Did not stop",
      killed: "Stopped",
    },
  },
  { run: { cancelledKept: "Cancelled · work kept" } },
);

```
