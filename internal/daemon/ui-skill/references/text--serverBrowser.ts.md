# text/serverBrowser.ts

Generated from web/src/text/serverBrowser.ts; do not edit.

```tsx
import { catalog, formatNumber, plural } from "../i18n";

// The person's own server browser (components/ServerBrowser.tsx): the rail's
// Oma selain row, the browser mark on a conversation's row, the Selain card in
// the conversation and the sheet with the live view. Window titles and the
// agent's request come in as arguments and stay as they are.
const fi = {
  ownBrowser: "Oma selain",
  windows: (n: number) => (n === 1 ? "1 ikkuna" : `${n} ikkunaa`),
  stop: "Sulje selain",
  takeControl: "Ota ohjaus",
  // The rail's Oma selain row: its short state at the end, and the whole
  // state for a screen reader.
  rail: {
    stopped: "ei auki",
    starting: "käynnistyy…",
    agent: "agentti",
    ask: "odottaa sinua",
    control: "sinä ohjaat",
    said: {
      stopped: "Oma selain, ei auki. Avaa painamalla.",
      starting: "Oma selain käynnistyy",
      idle: (windows: string) => `Oma selain, ${windows}, agentti ei käytä`,
      agent: (windows: string) => `Oma selain, agentti käyttää, ${windows}`,
      ask: (conversation: string) =>
        `Oma selain odottaa sinua, keskustelu ${conversation}`,
      askUnknown: "Oma selain odottaa sinua",
      control: "Oma selain, sinä ohjaat",
    },
  },
  // The browser mark at the end of a conversation's row in the rail.
  row: {
    ask: "selain",
    control: "ohjaat",
    said: {
      working: "Agentti työskentelee selaimessasi",
      ask: "Odottaa sinua selaimessa",
      control: "Sinä ohjaat selainta, agentti odottaa",
    },
  },
  // The Selain card under the turn that used the browser: live while the
  // agent works or asks, then the record of the visit. Page titles, paths,
  // selectors, file names and the agent's request stay as they are.
  card: {
    live: "Selain nyt",
    ask: "Odottaa sinua selaimessa",
    control: "Sinä ohjaat selainta",
    controlMeta: "Agentti odottaa, kunnes annat selaimen takaisin.",
    record: "Selain",
    take: "Ota ohjaus ja hoida",
    look: "Katso",
    lookFirst: "Katso ensin",
    open: "Avaa",
    giveBack: "Anna takaisin",
    show: "Näytä selaimen käynti",
    pages: (n: number) =>
      `${formatNumber(n)} ${plural("fi", n, { one: "sivu", other: "sivua" })}`,
    downloads: (n: number) =>
      `${formatNumber(n)} ${plural("fi", n, { one: "lataus", other: "latausta" })}`,
    actions: (n: number) =>
      `${formatNumber(n)} ${plural("fi", n, { one: "toiminto", other: "toimintoa" })}`,
    soFar: (counts: string) => `${counts} tähän mennessä`,
    inWindow: (title: string) => `Agentti ikkunassa ${title}`,
    tabsClosed: "Agentin välilehdet suljettu",
    sectionPages: "Sivut",
    sectionDownloads: "Lataukset",
    sectionActions: "Toiminnot",
    sectionYou: "Sinä selaimessa",
    youSpan: (from: string, to: string) =>
      `Ohjasit selainta ${from}–${to} agentin pyynnöstä.`,
    youNow: (from: string) => `Ohjaat selainta ${from} alkaen.`,
    savedTo: (folder: string) => `Tallennettu kansioon ${folder}`,
    action: {
      click: "Painoi",
      type: "Kirjoitti kenttään",
      eval: "Suoritti skriptin sivulla",
    },
    coverage:
      "Luettelo on koottu agentin selainkomennoista. Omaa ikkunaasi ei kirjata, eikä sitä, mitä teit ohjatessasi. Osoitteista on poistettu kyselyosat.",
    gaveBack: (time: string) => `Annoit selaimen takaisin ${time}`,
  },
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
    hintKeys:
      "⌘/Ctrl+V kirjoittaa tekstin ilman etäkoneen leikepöytää. Liitä sivulle käyttää leikepöytää. Kummallakin tavalla teksti menee sivulle eikä ole agentilta piilossa.",
    hintTouch: "Liitä tai kirjoita tähän ja lähetä sivulle.",
    paste: "Liitä sivulle",
    type: "Kirjoita näppäilyinä",
    hide: "Piilota teksti",
    show: "Näytä teksti",
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
    pasteBlockedAgent:
      "Selain ei antanut liittää suoraan kuvaan. Ota ensin selaimen ohjaus, liitä sitten tekstikenttään ja lähetä.",
    shortcutRefused: {
      empty:
        "Liittäminen ei onnistu: leikepöydällä ei ole tekstiä. Voit käyttää Leikepöytä-valikon Liitä sivulle -toimintoa.",
      long: "Liittäminen ei onnistu: tekstissä on yli 1 000 merkkiä. Käytä halutessasi Leikepöytä-valikon Liitä sivulle -toimintoa.",
      invalid_text:
        "Liittäminen ei onnistu: tekstissä on ohjausmerkkejä. Käytä halutessasi Leikepöytä-valikon Liitä sivulle -toimintoa.",
      unsupported:
        "Liittäminen ei onnistu: kaikkia merkkejä ei voi kirjoittaa näppäilyinä. Mitään ei lähetetty. Käytä halutessasi Leikepöytä-valikon Liitä sivulle -toimintoa.",
      not_in_control:
        "Liittäminen ei onnistu: ota ensin selaimen ohjaus. Voit myös käyttää Leikepöytä-valikon Liitä sivulle -toimintoa.",
      unavailable:
        "Mitään ei lähetetty: selaimeen ei ole yhteyttä. Odota yhteyttä ja yritä uudelleen.",
      multiline:
        "Liittäminen ei onnistu: rivinvaihto voisi lähettää lomakkeen. Käytä halutessasi Leikepöytä-valikon Liitä sivulle -toimintoa.",
    },
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
};

export const serverBrowserText = catalog(fi, {
  ownBrowser: "Your browser",
  windows: (n: number) => (n === 1 ? "1 window" : `${n} windows`),
  stop: "Close browser",
  takeControl: "Take control",
  rail: {
    stopped: "off",
    starting: "starting…",
    agent: "agent",
    ask: "waiting for you",
    control: "you control",
    said: {
      stopped: "Your browser, off. Press to open.",
      starting: "Your browser is starting",
      idle: (windows: string) =>
        `Your browser, ${windows}, the agent is not using it`,
      agent: (windows: string) =>
        `Your browser, the agent is using it, ${windows}`,
      ask: (conversation: string) =>
        `Your browser is waiting for you, conversation ${conversation}`,
      askUnknown: "Your browser is waiting for you",
      control: "Your browser, you are in control",
    },
  },
  row: {
    ask: "browser",
    control: "you",
    said: {
      working: "The agent is working in your browser",
      ask: "Waiting for you in the browser",
      control: "You control the browser, the agent waits",
    },
  },
  card: {
    live: "Browser now",
    ask: "Waiting for you in the browser",
    control: "You control the browser",
    controlMeta: "The agent waits until you give the browser back.",
    record: "Browser",
    take: "Take control and do it",
    look: "Look",
    lookFirst: "Look first",
    open: "Open",
    giveBack: "Give back",
    show: "Show the browser visit",
    pages: (n: number) =>
      `${formatNumber(n)} ${plural("en", n, { one: "page", other: "pages" })}`,
    downloads: (n: number) =>
      `${formatNumber(n)} ${plural("en", n, { one: "download", other: "downloads" })}`,
    actions: (n: number) =>
      `${formatNumber(n)} ${plural("en", n, { one: "action", other: "actions" })}`,
    soFar: (counts: string) => `${counts} so far`,
    inWindow: (title: string) => `The agent is in ${title}`,
    tabsClosed: "The agent's tabs are closed",
    sectionPages: "Pages",
    sectionDownloads: "Downloads",
    sectionActions: "Actions",
    sectionYou: "You in the browser",
    youSpan: (from: string, to: string) =>
      `You controlled the browser ${from}–${to} at the agent's request.`,
    youNow: (from: string) => `You have controlled the browser since ${from}.`,
    savedTo: (folder: string) => `Saved to ${folder}`,
    action: {
      click: "Pressed",
      type: "Typed into a field",
      eval: "Ran a script on the page",
    },
    coverage:
      "The list is built from the agent's browser commands. Your own window is not recorded, nor what you did while in control. Query strings are removed from addresses.",
    gaveBack: (time: string) => `You gave the browser back at ${time}`,
  },
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
      "⌘/Ctrl+V inserts text without the remote clipboard. Paste into page uses the clipboard. Either way, the text goes to the page and is not hidden from the agent.",
    hintTouch: "Paste or type here and send it to the page.",
    paste: "Paste into page",
    type: "Type as keystrokes",
    hide: "Hide text",
    show: "Show text",
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
    pasteBlockedAgent:
      "Your browser did not allow pasting straight into the picture. Take browser control first, then paste into the text field and send.",
    shortcutRefused: {
      empty:
        "Cannot paste: the clipboard has no text. You can use Paste into page in the Clipboard menu.",
      long: "Cannot paste: the text exceeds 1,000 characters. You can choose Paste into page in the Clipboard menu.",
      invalid_text:
        "Cannot paste: the text contains control characters. You can choose Paste into page in the Clipboard menu.",
      unsupported:
        "Cannot paste: some characters cannot be typed as keystrokes. Nothing was sent. You can choose Paste into page in the Clipboard menu.",
      not_in_control:
        "Cannot paste: take browser control first. You can also use Paste into page in the Clipboard menu.",
      unavailable:
        "Nothing was sent: the browser is disconnected. Wait for the connection and try again.",
      multiline:
        "Cannot paste: a line break could submit the form. You can choose Paste into page in the Clipboard menu.",
    },
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
});

```
