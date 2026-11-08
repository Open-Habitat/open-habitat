# text/serverBrowser.ts

Generated from web/src/text/serverBrowser.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The person's own server browser (components/ServerBrowser.tsx): the chip
// above the message field, the strip it opens, the sheet with the live view
// and the row in the sidebar. Window titles and the agent's request come in
// as arguments and stay as they are.
const fi = {
  name: "Selain",
  ownBrowser: "Oma selain",
  windows: (n: number) => (n === 1 ? "1 ikkuna" : `${n} ikkunaa`),
  state: {
    stopped: "Ei käynnissä",
    starting: "Käynnistyy…",
    idle: "Valmiina agentille",
    agent: "Agentti työssä",
    person: "Sinä ohjaat",
    ask: (title: string) => `${title} odottaa sinua`,
    askUntitled: "Ikkuna odottaa sinua",
  },
  open: "Avaa selain",
  openHint:
    "Käynnistää oman selaimesi palvelimella. Agentti voi käyttää sitä, ja näet täällä, mitä se tekee.",
  stop: "Sulje selain",
  stripTitle: "Oma selain",
  noWindows: "Selaimessa ei ole ikkunoita.",
  agentHere: "agentti tässä",
  waitsYou: "odottaa sinua",
  youDrive: "sinä ohjaat",
  takeForRequest: "Ota ohjaus ja hoida",
  lookFirst: "Katso ensin",
  lookBig: "Katso isona",
  takeControl: "Ota ohjaus",
  giveBack: "Anna takaisin agentille",
  now: {
    stopped:
      "Selain ei ole käynnissä. Kirjautumiset säilyvät, kun avaat sen uudelleen.",
    idle: "Selain on auki. Agentti voi käyttää sitä, kun se tarvitsee.",
    agent: "Agentti käyttää selainta. Voit katsoa, mitä se tekee.",
    ask: "Agentti on pysähtynyt ja odottaa sinua.",
    person: "Sinä ohjaat. Agentti odottaa, kunnes annat selaimen takaisin.",
  },
  askLead:
    "Kun otat ohjauksen, agentti odottaa, kunnes annat selaimen takaisin.",
  sheet: {
    close: "Sulje",
    viewing: "Katselet. Agentti jatkaa työtään, eikä katselu vaikuta siihen.",
    control: "Sinä ohjaat. Agentti odottaa, kunnes annat selaimen takaisin.",
    connecting: "Yhdistetään…",
    lost: "Yhteys selaimeen katkesi.",
    retry: "Yritä uudelleen",
    notRunning: "Selain ei ole käynnissä.",
  },
  truth:
    "Agentti saa käyttää kaikkea, mihin tämä selain on kirjautunut, sinun nimissäsi.",
  errors: {
    start: "Selain ei käynnistynyt. Yritä hetken päästä uudelleen.",
    stop: "Selain ei sulkeutunut. Yritä uudelleen.",
    control: "Ohjauksen vaihto ei onnistunut. Yritä uudelleen.",
    read: "Selaimen tilaa ei saatu luettua.",
  },
  pointer: "agentti",
};

export const serverBrowserText = catalog(fi, {
  name: "Browser",
  ownBrowser: "Your browser",
  windows: (n: number) => (n === 1 ? "1 window" : `${n} windows`),
  state: {
    stopped: "Not running",
    starting: "Starting…",
    idle: "Ready for the agent",
    agent: "Agent at work",
    person: "You are in control",
    ask: (title: string) => `${title} is waiting for you`,
    askUntitled: "A window is waiting for you",
  },
  open: "Open browser",
  openHint:
    "Starts your own browser on the server. The agent can use it, and you see here what it does.",
  stop: "Close browser",
  stripTitle: "Your browser",
  noWindows: "The browser has no windows.",
  agentHere: "agent here",
  waitsYou: "waiting for you",
  youDrive: "you are in control",
  takeForRequest: "Take control and do it",
  lookFirst: "Look first",
  lookBig: "View large",
  takeControl: "Take control",
  giveBack: "Give back to the agent",
  now: {
    stopped:
      "The browser is not running. Sign-ins are kept when you open it again.",
    idle: "The browser is open. The agent can use it when it needs to.",
    agent: "The agent is using the browser. You can watch what it does.",
    ask: "The agent has stopped and is waiting for you.",
    person:
      "You are in control. The agent waits until you give the browser back.",
  },
  askLead:
    "When you take control, the agent waits until you give the browser back.",
  sheet: {
    close: "Close",
    viewing:
      "You are watching. The agent carries on, and watching does not affect it.",
    control:
      "You are in control. The agent waits until you give the browser back.",
    connecting: "Connecting…",
    lost: "The connection to the browser was lost.",
    retry: "Try again",
    notRunning: "The browser is not running.",
  },
  truth:
    "The agent may use everything this browser is signed in to, in your name.",
  errors: {
    start: "The browser did not start. Try again in a moment.",
    stop: "The browser did not close. Try again.",
    control: "Control could not be changed. Try again.",
    read: "The browser's state could not be read.",
  },
  pointer: "agent",
});

```
