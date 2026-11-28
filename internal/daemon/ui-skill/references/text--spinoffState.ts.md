# text/spinoffState.ts

Generated from web/src/text/spinoffState.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// A worker run's state in one phrase (app/spinoffs.ts), for the worker view's
// header, its details and its result card.
const fi = {
  working: "Työskentelee",
  // Neither is the person's to answer in the browser: a worker stopped at a
  // prompt in its own terminal, or at its own prompt after its turn ended,
  // waits for the conversation's agent to handle it.
  awaitingInput: "Kehote päätteessä · odottaa pääagenttia",
  idle: "Pysähtyi · odottaa pääagenttia",
  waiting_parent: "Odottaa pääagenttia",
  // It asked its parent a question (taskfleet node ask); escalated, the
  // main agent passed it on to the person.
  askParent: "Kysyy pääagentilta",
  askYou: "Kysyy sinulta pääagentin kautta",
  merged: "Mergetty",
  unmerged: "Ei mergetty",
  unmergedKept: "Ei mergetty · työ tallessa",
  failed: "Epäonnistui",
  failedKept: "Epäonnistui · työ tallessa",
  unknown: "Tila ei tiedossa",
  // A named worker (avustaja) between and during its rounds.
  roundWorking: (n: number) => `Avustaja · kierros ${n} työn alla`,
  roundWaiting: (n: number) =>
    `Avustaja · ${n} ${n === 1 ? "kierros" : "kierrosta"} · odottaa pääagenttia`,
  roundDormant: (n: number) =>
    `Avustaja · ${n} ${n === 1 ? "kierros" : "kierrosta"} · lepää`,
};

export const spinoffStateText = catalog(fi, {
  working: "Working",
  awaitingInput: "Prompt in its terminal · waiting for the main agent",
  idle: "Stopped · waiting for the main agent",
  waiting_parent: "Waiting for the main agent",
  askParent: "Asking the main agent",
  askYou: "Asking you through the main agent",
  merged: "Merged",
  unmerged: "Not merged",
  unmergedKept: "Not merged · work kept",
  failed: "Failed",
  failedKept: "Failed · work kept",
  unknown: "State unknown",
  roundWorking: (n) => `Helper · round ${n} under way`,
  roundWaiting: (n) =>
    `Helper · ${n} ${n === 1 ? "round" : "rounds"} · waiting for the main agent`,
  roundDormant: (n) =>
    `Helper · ${n} ${n === 1 ? "round" : "rounds"} · resting`,
});

```
