import { catalog } from "../i18n";

// The deletion dialog's own blocker actions (app/WorkspaceDeletion.tsx).
const fi = {
  closeUncertain:
    "Sulkemista ei voitu vahvistaa. Tarkista tilanne uudelleen ennen uutta yritystä.",
  closing: "Suljetaan…",
  closeTerminal: "Sulje pääte",
  stopEditor: "Pysäytä editori (kaikki ikkunat)",
};

export const workspaceDeletionText = catalog(fi, {
  closeUncertain:
    "Closing could not be confirmed. Check the situation again before trying again.",
  closing: "Closing…",
  closeTerminal: "Close terminal",
  stopEditor: "Stop the editor (all windows)",
});
