import { catalog } from "../i18n";

// The browser shell's reads and the host's refusals on a terminal socket
// (app/terminals.ts).
const fi = {
  readFailed: "Päätteitä ei voitu lukea.",
  unverified: "Päätteiden tietoja ei voitu vahvistaa.",
  shellEnded: "Pääte on jo päättynyt.",
  shellLimit: "Työtilassa on jo 16 päätettä. Lopeta jokin ennen uutta.",
  terminalLimit:
    "Avoimia päätteitä on liikaa. Sulje jokin toisesta välilehdestä.",
  unavailable:
    "Palvelin ei voi avata päätettä: tmux puuttuu tai ei käynnistynyt.",
  workspaceMissing: "Työtilaa ei löytynyt.",
  session: "Istunto ei kelpaa enää. Lataa sivu uudelleen.",
  failed: "Pääte ei avautunut.",
};

export const terminalsText = catalog(fi, {
  readFailed: "The terminals could not be read.",
  unverified: "The terminal details could not be verified.",
  shellEnded: "The terminal has already ended.",
  shellLimit:
    "This workspace already has 16 terminals. End one before opening another.",
  terminalLimit: "Too many terminals are open. Close one in another tab.",
  unavailable:
    "The server cannot open a terminal: tmux is missing or did not start.",
  workspaceMissing: "The workspace was not found.",
  session: "The session is no longer valid. Reload the page.",
  failed: "The terminal did not open.",
});
