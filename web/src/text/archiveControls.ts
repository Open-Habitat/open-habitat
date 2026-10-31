import { catalog } from "../i18n";

// A conversation's archive, restore or close action
// (components/ArchiveControls.tsx).
const fi = {
  busy: "Pyyntö kesken.",
  unknown: "Arkiston tila ei ole tiedossa.",
  waitTurn: "Odota agentin vuoron päättymistä.",
  close: "Sulje",
  closeOnlyEmpty: "Vain selaimessa aloitettu tyhjä keskustelu voidaan sulkea.",
  restore: "Palauta näkyviin",
  archive: "Arkistoi",
  checkFailed: "Arkiston tilaa ei voitu tarkistaa",
};

export const archiveControlsText = catalog(fi, {
  busy: "Request in progress.",
  unknown: "The archive state is not known.",
  waitTurn: "Wait for the agent's turn to end.",
  close: "Close",
  closeOnlyEmpty:
    "Only an empty conversation started in the browser can be closed.",
  restore: "Restore",
  archive: "Archive",
  checkFailed: "The archive state could not be checked",
});
