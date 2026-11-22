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
  frame: {
    you: "Sinä ohjaat",
    agent: "Agentti ohjaa",
    agentBusy: "Agentti toimii",
    agentWaits: "Agentti odottaa sinua",
    waiting: "Otat ohjauksen, kun agentin toiminto päättyy…",
    done: "Valmis",
    cancel: "Peru",
    says: "Agentti",
    screen: "Palvelinselaimen näkymä",
    helpAgent: "Klikkaa sivua tai ala kirjoittaa, niin ohjaus siirtyy sinulle.",
    helpBusy:
      "Agentti on kesken. Klikkaus sivulla kysyy ennen kuin keskeyttää sen.",
    helpYou:
      "Agentti odottaa, kunnes annat selaimen takaisin. Klikkaa ja kirjoita sivulla kuten omassa selaimessasi.",
    hintAgent: "Klikkaa tai kirjoita ottaaksesi ohjauksen",
    hintBusy: "Agentti toimii · klikkaa ottaaksesi ohjauksen",
    midTitle: "Agentti on kesken",
    midText:
      "Jos otat ohjauksen nyt, sen seuraavat askeleet perutaan ja sivulle voi jäädä puolikas syöte. Agentti katsoo sivun uudelleen ennen kuin jatkaa.",
    takeNow: "Ota ohjaus nyt",
    takeAfter: "Ota, kun se on valmis",
    idle: (s: number) =>
      `Et ole käyttänyt selainta hetkeen. Se palautuu agentille 0:${String(s).padStart(2, "0")} kuluttua.`,
    keep: "Pidä ohjaus",
  },
  clip: {
    tab: "Leikepöytä",
    password: "Salasana näppäilyinä",
    passwordNote:
      "Salasana menee sivulle eikä ole agentilta piilossa. Pidä salasananhallinta omalla laitteellasi.",
    label: "Tavallinen teksti sivulle",
    placeholder: "Liitä tai kirjoita tähän",
    hintKeys: "⌘/Ctrl+V liittää suoraan sivulle. Jos se ei toimi, liitä tähän.",
    hintTouch: "Liitä tai kirjoita tähän ja lähetä sivulle.",
    paste: "Liitä sivulle",
    type: "Kirjoita näppäilyinä",
    hide: "Piilota teksti",
    keysNote:
      "Näppäilyt toimivat myös sivuilla, jotka estävät liittämisen. Kenttä tyhjenee lähetyksen jälkeen.",
    enterWarn: (n: number) =>
      `Tekstissä on ${n === 1 ? "rivinvaihto" : `${n} rivinvaihtoa`}. Ne lähtevät Enter-painalluksina, mikä voi lähettää lomakkeen. Paina uudelleen, jos haluat sen.`,
    copySelection: "Kopioi valinta",
    copied: "Kopioitu etäsivulta",
    copiedText: "Kopioitu teksti",
    copyLocal: "Kopioi koneellesi",
    note: "Etäkoneen leikepöytä tyhjennetään, kun annat ohjauksen takaisin.",
  },
  toast: {
    took: "Sinä ohjaat. Agentti odottaa.",
    tookAfter: "Agentin toiminto päättyi. Sinä ohjaat.",
    back: "Agentti jatkaa.",
    backCleared: "Agentti jatkaa. Etäkoneen leikepöytä tyhjennettiin.",
    idleBack: "Selain palautui agentille tauon jälkeen.",
    pasted: (n: number) => `Liitetty sivulle · ${n} merkkiä`,
    typed: (n: number) => `Kirjoitettiin sivulle näppäilyinä · ${n} merkkiä`,
    pasteBlocked:
      "Selain ei antanut liittää suoraan kuvaan. Liitä tekstikenttään ja lähetä.",
    tooLong: "Teksti on liian pitkä lähetettäväksi.",
    unsupported:
      "Tekstissä on merkkejä, joita ei voi kirjoittaa näppäilyinä, kuten emoji tai yhdistyvä tarke. Mitään ei lähetetty. Tavalliselle tekstille voit käyttää Liitä sivulle.",
    empty: "Kirjoita tai liitä ensin teksti.",
    copiedLocal: "Kopioitu etäsivulta koneellesi.",
    copyBlocked:
      "Selain ei antanut kopioida suoraan koneellesi. Kopioi Leikepöytä-valikosta.",
    copyRefused: "Kopiointi estettiin. Valitse teksti ja kopioi se itse.",
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
  frame: {
    you: "You are in control",
    agent: "Agent in control",
    agentBusy: "Agent at work",
    agentWaits: "Agent is waiting for you",
    waiting: "You take control when the agent’s step ends…",
    done: "Done",
    cancel: "Cancel",
    says: "Agent",
    screen: "Server browser view",
    helpAgent: "Click the page or start typing to take control.",
    helpBusy:
      "The agent is mid-step. A click on the page asks before interrupting it.",
    helpYou:
      "The agent waits until you give the browser back. Click and type on the page as in your own browser.",
    hintAgent: "Click or type to take control",
    hintBusy: "Agent at work · click to take control",
    midTitle: "The agent is mid-step",
    midText:
      "If you take control now, it stops its next steps and the page may keep a partial input. The agent looks at the page again before continuing.",
    takeNow: "Take control now",
    takeAfter: "Take when it’s done",
    idle: (s: number) =>
      `You haven’t used the browser for a while. It goes back to the agent in 0:${String(s).padStart(2, "0")}.`,
    keep: "Keep control",
  },
  clip: {
    tab: "Clipboard",
    password: "Password as keystrokes",
    passwordNote:
      "The password goes to the page and is not hidden from the agent. Keep your password manager on your own device.",
    label: "Ordinary text for the page",
    placeholder: "Paste or type here",
    hintKeys:
      "⌘/Ctrl+V pastes straight into the page. If that doesn’t work, paste here.",
    hintTouch: "Paste or type here and send it to the page.",
    paste: "Paste into page",
    type: "Type as keystrokes",
    hide: "Hide text",
    keysNote:
      "Keystrokes also work on sites that block pasting. The field clears after sending.",
    enterWarn: (n: number) =>
      `The text has ${n === 1 ? "a line break" : `${n} line breaks`}. They are sent as Enter, which may submit a form. Press again if you want that.`,
    copySelection: "Copy selection",
    copied: "Copied on the remote page",
    copiedText: "Copied text",
    copyLocal: "Copy to your computer",
    note: "The remote clipboard is cleared when you give control back.",
  },
  toast: {
    took: "You are in control. The agent waits.",
    tookAfter: "The agent’s step finished. You are in control.",
    back: "The agent continues.",
    backCleared: "The agent continues. The remote clipboard was cleared.",
    idleBack: "The browser went back to the agent after a pause.",
    pasted: (n: number) => `Pasted into the page · ${n} characters`,
    typed: (n: number) => `Typed into the page as keystrokes · ${n} characters`,
    pasteBlocked:
      "Your browser did not allow pasting straight into the picture. Paste into the text field and send.",
    tooLong: "The text is too long to send.",
    unsupported:
      "The text contains characters that cannot be typed as keystrokes, such as an emoji or a combining accent. Nothing was sent. For ordinary text, you can use Paste into page.",
    empty: "Type or paste some text first.",
    copiedLocal: "Copied from the remote page to your computer.",
    copyBlocked:
      "Your browser did not allow copying straight to your computer. Copy it from the Clipboard menu.",
    copyRefused: "Copying was blocked. Select the text and copy it yourself.",
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
