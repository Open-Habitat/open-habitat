import { catalog } from "../i18n";

// A worker run's state in one phrase (app/spinoffs.ts), for the worker view's
// header, its details and its result card.
const fi = {
  working: "Työskentelee",
  // Pi's own word: its turn ended and it waits at its prompt.
  awaitingInput: "Odottaa vastausta päätteessä",
  idle: "Odottaa sinua",
  waiting_parent: "Odottaa pääagenttia",
  merged: "Mergetty",
  unmerged: "Ei mergetty",
  unmergedKept: "Ei mergetty · työ tallessa",
  failed: "Epäonnistui",
  failedKept: "Epäonnistui · työ tallessa",
  unknown: "Tila ei tiedossa",
};

export const spinoffStateText = catalog(fi, {
  working: "Working",
  awaitingInput: "Waiting for an answer in its terminal",
  idle: "Waiting for you",
  waiting_parent: "Waiting for the main agent",
  merged: "Merged",
  unmerged: "Not merged",
  unmergedKept: "Not merged · work kept",
  failed: "Failed",
  failedKept: "Failed · work kept",
  unknown: "State unknown",
});
