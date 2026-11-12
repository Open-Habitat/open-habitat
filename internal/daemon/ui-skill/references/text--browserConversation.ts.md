# text/browserConversation.ts

Generated from web/src/text/browserConversation.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The browser-controlled conversation (app/BrowserConversation.tsx): the
// new-conversation start, the header and its details, live progress, the
// recovery banners and why sending or a recap is not available now.
const fi = {
  dismissNotice: "Sulje",
  storageFull: "Tallennustila on täynnä",
  storageFullDetail:
    "Vapauta tilaa ennen työn jatkamista. Pyydä tarvittaessa palvelimen ylläpitäjältä apua.",
  modelUnknown: "Malli ei tiedossa",
  attention: (title: string) => `Agentti tarvitsee huomiota · ${title}`,
  resting: "Agentti lepää. Kirjoittaminen herättää sen.",
  waitTurn: "Odota agentin vuoron päättymistä.",
  archived: "Palauta keskustelu arkistosta ennen viestin lähettämistä.",
  archiveUnknown: "Arkiston tila on epävarma. Päivitä tiedot.",
  chooseOtherModel:
    "Valitse toinen malli uuden keskustelun kentän valitsimesta.",
  serverLost: "Palvelinyhteys katkesi. Luonnos säilyy.",
  statusStale:
    "Tila on vanhentunut. Tarkista keskustelun tila ennen lähettämistä.",
  waitIdleUncertain:
    "Odota vahvistettua joutotilaa; epävarmaa viestiä ei lähetetä uudelleen.",
  waitIdle: "Odota vahvistettua joutotilaa.",
  waitConfirmed: "Odota vahvistettua tilaa.",
  bashRefused:
    "Komentoa ei ajettu. Edellinen komento voi olla vielä käynnissä; tarkista tila.",
  bashUncertain:
    "Komennon tulos epävarma. Tarkista tila; komentoa ei ajeta uudelleen.",
  bashStopUncertain:
    "Komennon pysäytyksen tulos epävarma. Tarkista tila; pyyntöä ei lähetetä uudelleen.",
  bashNotStarted: (command: string) =>
    `Komentoa ${command} ei ajettu: agentti ei käynnistynyt tai komento otettiin takaisin.`,
  bashUnknown: (command: string) =>
    `Komennon ${command} tulos ei tiedossa. Komentoa ei ajeta uudelleen.`,
  tool: "Työkalu",
  bashRunning: "Paikallisen komennon tuloste · käynnissä",
  bashOutput: "Paikallisen komennon tuloste",
  extensionNotice: "Laajennuksen ilmoitus",
  agentStatus: "Agentin tila",
  runs: (tool: string) => `Ajaa ${tool}`,
  thinking: "Ajattelee",
  replying: "Vastaa",
  conversations: "Agenttikeskustelut",
  agent: "Agentti",
  actions: "Agenttikeskustelun toiminnot",
  startNew: "Aloita uusi agenttikeskustelu",
  chooseModelFirst:
    "Valitse toinen malli ennen uuden keskustelun aloittamista.",
  sessionUnconfirmed: "Istuntoa ei voitu vahvistaa.",
  sessionLoading: "Ladataan istuntoa.",
  createUncertain: "Edellisen luonnin tulos on epävarma.",
  creating: "Luonti on käynnissä.",
  serverLostShort: "Palvelinyhteys katkesi.",
  loading: "Ladataan keskustelua…",
  awaitingArchive: "Odotetaan arkiston tilan vahvistusta.",
  loadingArchive: "Ladataan arkiston tilaa.",
  newConversation: "Uusi keskustelu",
  noControl: "Ohjaus ei ole käytettävissä.",
  retitle: "Luo uusi otsikko",
  nothingToName: "Keskustelussa ei ole vielä nimettävää sisältöä.",
  titleInvalid:
    "Mallilta ei saatu kelvollista otsikkoa. Voit yrittää uudelleen.",
  titleUncertain:
    "Otsikon muutos jäi epävarmaksi. Tarkista nykyinen otsikko ja keskustelun tila ennen uutta yritystä.",
  rests: "Lepää",
  modelSettings: "Oletusmallin asetukset",
  workspace: "Työtila",
  worktree: "Worktree",
  branch: "Haara",
  unknown: "Ei tiedossa",
  model: "Malli",
  agentDefault: "Agentin oletus",
  thinkingLevel: "Ajattelutaso",
  control: "Ohjaus",
  browserControl: "Selainohjaus",
  notAvailable: "Ei käytettävissä",
  started: "Aloitettu",
  nativeId: "Natiivi tunniste",
  controlUnavailable: "Ohjaus ei ole käytettävissä",
  conversation: "Keskustelu",
  loadOlder: "Lataa vanhempi historiasivu",
  cutOff: "Keskustelun loppu katkesi",
  cutOffDetail:
    "Näytetään kokonaan tallentuneet viestit. Alkuperäistä tiedostoa ei ole muutettu. Voit jatkaa uudessa keskustelussa.",
  sending: "Lähetetään",
  questionStale:
    "? Pyyntö voi olla vanhentunut tai toimitus epävarma. Tarkista tila.",
  questionUncertain:
    "? Ei tiedossa, käsittelikö agentti pyynnön. Älä lähetä uudelleen.",
  stale: "Keskustelun tila vanhentui",
  staleDetail:
    "Näytetään viimeisin tunnettu historia. Tarkista tila ennen ohjaamista.",
  check: "Tarkista tila",
  journalLost: "Tapahtumayhteys katkesi",
  journalLostDetail:
    "Tila ja natiivi historia tarkistetaan uudelleen. Viestiä ei lähetetä uudelleen.",
  missed: "Tapahtumia jäi väliin",
  missedDetail:
    "Live-tapahtumien häntä ei ole täydellinen. Tarkista natiivi historia.",
  eventsBeforeHistory: "Agentin tapahtumia vastaanotettu; historiaa odotetaan.",
  modelUnsupported: "Valittu kielimalli ei ole käytettävissä",
  chooseModel: "Valitse toinen malli",
  modelUnsupportedDetail:
    "Agentti ilmoitti, ettei valittu malli ole tuettu tällä ChatGPT-tilillä. Valitse toinen malli ja aloita uusi keskustelu. Viestiä ei toisteta; luonnos säilyy.",
  recheck: "Tarkista keskustelun tila",
  // A send whose outcome was lost, e.g. across a server restart: one warning
  // with the check as its action. It goes away once history shows the message,
  // or once it proves undelivered and is sent again (once) or the
  // conversation has moved on.
  sendUncertain: "Ei tiedossa, saiko agentti viestin",
  // It says the text is in the field only while it is: the person may have
  // edited it away or sent it again (Jari 9.11.2026).
  sendUncertainDetail: (inField: boolean): string =>
    inField
      ? "Teksti on kirjoituskentässä. Jos varmistuu, ettei agentti saanut viestiä, se lähetetään itsestään kerran uudelleen; muuten sitä ei lähetetä. Ilmoitus poistuu, kun viesti näkyy keskustelussa."
      : "Jos varmistuu, ettei agentti saanut viestiä, se lähetetään itsestään kerran uudelleen; muuten sitä ei lähetetä. Ilmoitus poistuu, kun viesti näkyy keskustelussa.",
  // A message sent while the agent was not running, whose outcome a lost
  // reply or a server restart made unknown: never sent again by itself.
  sendUncertainHeld: (inField: boolean): string =>
    inField
      ? "Teksti on kirjoituskentässä. Sitä ei lähetetä uudelleen automaattisesti. Ilmoitus poistuu, kun viesti näkyy keskustelussa."
      : "Sitä ei lähetetä uudelleen automaattisesti. Ilmoitus poistuu, kun viesti näkyy keskustelussa.",
  sendUncertainFailed:
    "Yhteys katkesi lähetettäessä. Tila tarkistetaan, kun yhteys palaa; viesti lähetetään uudelleen vain, jos varmistuu, ettei agentti saanut sitä.",
  // The time shows that each press of the check ran again.
  sendStillUnknown: (time: string, inField: boolean): string =>
    inField
      ? `Tarkistettu klo ${time}: viesti ei näy keskustelussa, eikä ole varmistunut, ettei agentti saanut sitä. Teksti on kirjoituskentässä.`
      : `Tarkistettu klo ${time}: viesti ei näy keskustelussa, eikä ole varmistunut, ettei agentti saanut sitä.`,
  rechecking: "Tarkistetaan",
  historyUnavailable: "Historiaa ei saada",
  // A refused read is usually momentary and is read again by itself; the
  // administrator is named only once a check finds it still refused.
  historyUnavailableDetail:
    "Keskustelun tallennettua historiaa ei juuri nyt saatu luettua. Mitään ei ole kadonnut, ja lukemista yritetään itsestään uudelleen.",
  historyStillUnavailable: (time: string): string =>
    `Tarkistettu klo ${time}: historiaa ei vieläkään saada. Mitään ei ole kadonnut, ja lukemista yritetään edelleen. Jos tilanne ei korjaannu, kerro ylläpitäjälle.`,
  // A full storage quota cut a record mid-write; nobody can make it
  // readable, so the card says what happened and what prevents it again.
  historyCut: "Tallennustila loppui kesken tallennuksen",
  historyCutDetail:
    "Tallennustila oli täynnä, kun agentti tallensi tätä keskustelua, ja yksi sen viesteistä katkesi. Siksi keskustelua ei voi enää lukea selaimessa. Alkuperäistä tiedostoa ei ole muutettu. Vapauta tilaa tai pyydä ylläpitäjältä lisää tilaa, ettei sama toistu, ja jatka uudessa keskustelussa.",
  historyUnavailableSend: (inField: boolean): string =>
    inField
      ? "Siksi ei myöskään tiedetä, saiko agentti viimeisen viestisi. Sitä ei lähetetä uudelleen automaattisesti, ja teksti on kirjoituskentässä."
      : "Siksi ei myöskään tiedetä, saiko agentti viimeisen viestisi. Sitä ei lähetetä uudelleen automaattisesti.",
  titleFailed: "Otsikkoa ei voitu luoda",
  wakePlaceholder: "Kirjoita, niin agentti herää…",
  keptNotSent: (reason: string) =>
    `Viestiä ei lähetetty: ${reason} Teksti on taas kentässä.`,
};

export const browserConversationText = catalog(fi, {
  dismissNotice: "Close",
  storageFull: "Storage is full",
  storageFullDetail:
    "Free up space before continuing. Ask the server's administrator for help if needed.",
  modelUnknown: "Model unknown",
  attention: (title) => `Agent needs attention · ${title}`,
  resting: "The agent is resting. Typing wakes it.",
  waitTurn: "Wait for the agent's turn to end.",
  archived:
    "Restore the conversation from the archive before sending a message.",
  archiveUnknown: "The archive status is uncertain. Refresh.",
  chooseOtherModel:
    "Choose another model in the new conversation's model picker.",
  serverLost: "The connection to the server was lost. Your draft is kept.",
  statusStale:
    "The status is out of date. Check the conversation's status before sending.",
  waitIdleUncertain:
    "Wait until the agent is confirmed idle; an uncertain message is not resent.",
  waitIdle: "Wait until the agent is confirmed idle.",
  waitConfirmed: "Wait for a confirmed status.",
  bashRefused:
    "The command was not run. The previous command may still be running; check the status.",
  bashUncertain:
    "The command's outcome is uncertain. Check the status; the command is not run again.",
  bashStopUncertain:
    "It is unclear whether the command was stopped. Check the status; the request is not resent.",
  bashNotStarted: (command) =>
    `The command ${command} was not run: the agent did not start or the command was taken back.`,
  bashUnknown: (command) =>
    `The outcome of the command ${command} is not known. It is not run again.`,
  tool: "Tool",
  bashRunning: "Local command output · running",
  bashOutput: "Local command output",
  extensionNotice: "Extension notice",
  agentStatus: "Agent status",
  runs: (tool) => `Running ${tool}`,
  thinking: "Thinking",
  replying: "Replying",
  conversations: "Agent conversations",
  agent: "Agent",
  actions: "Agent conversation actions",
  startNew: "Start a new agent conversation",
  chooseModelFirst: "Choose another model before starting a new conversation.",
  sessionUnconfirmed: "Your session could not be confirmed.",
  sessionLoading: "Loading your session.",
  createUncertain: "The outcome of the previous creation is uncertain.",
  creating: "Creating.",
  serverLostShort: "The connection to the server was lost.",
  loading: "Loading the conversation…",
  awaitingArchive: "Waiting for the archive status to be confirmed.",
  loadingArchive: "Loading the archive status.",
  newConversation: "New conversation",
  noControl: "Control is not available.",
  retitle: "Make a new title",
  nothingToName: "The conversation has nothing to name yet.",
  titleInvalid: "The model did not return a usable title. You can try again.",
  titleUncertain:
    "It is unclear whether the title changed. Check the current title and the conversation's status before trying again.",
  rests: "Resting",
  modelSettings: "Default model settings",
  workspace: "Workspace",
  worktree: "Worktree",
  branch: "Branch",
  unknown: "Not known",
  model: "Model",
  agentDefault: "Agent's default",
  thinkingLevel: "Thinking level",
  control: "Control",
  browserControl: "Browser control",
  notAvailable: "Not available",
  started: "Started",
  nativeId: "Native ID",
  controlUnavailable: "Control is not available",
  conversation: "Conversation",
  loadOlder: "Load an older page of history",
  cutOff: "The end of the conversation was cut off",
  cutOffDetail:
    "Showing the messages that were saved in full. The original file has not been changed. You can continue in a new conversation.",
  sending: "Sending",
  questionStale:
    "? The request may be out of date or its delivery uncertain. Check the status.",
  questionUncertain:
    "? It is not known whether the agent handled the request. Do not send again.",
  stale: "The conversation's status is out of date",
  staleDetail:
    "Showing the last known history. Check the status before steering the agent.",
  check: "Check status",
  journalLost: "The event stream was lost",
  journalLostDetail:
    "The status and native history are being checked again. The message is not resent.",
  missed: "Some events were missed",
  missedDetail:
    "The tail of the live events is incomplete. Check the native history.",
  eventsBeforeHistory: "Agent events received; waiting for the history.",
  modelUnsupported: "The chosen language model is not available",
  chooseModel: "Choose another model",
  modelUnsupportedDetail:
    "The agent reported that the chosen model is not supported on this ChatGPT account. Choose another model and start a new conversation. The message is not repeated; your draft is kept.",
  recheck: "Check the conversation's status",
  sendUncertain: "It is not known whether the agent got the message",
  sendUncertainDetail: (inField) =>
    inField
      ? "Its text is in the field. If it turns out the agent did not get the message, it is sent again once by itself; otherwise it is not resent. This notice goes away once the message shows in the conversation."
      : "If it turns out the agent did not get the message, it is sent again once by itself; otherwise it is not resent. This notice goes away once the message shows in the conversation.",
  sendUncertainHeld: (inField) =>
    inField
      ? "Its text is in the field. It is not resent automatically. This notice goes away once the message shows in the conversation."
      : "It is not resent automatically. This notice goes away once the message shows in the conversation.",
  sendUncertainFailed:
    "The connection broke while sending. The status is checked when the connection is back; the message is sent again only if it turns out the agent did not get it.",
  sendStillUnknown: (time, inField) =>
    inField
      ? `Checked at ${time}: the message does not show in the conversation, and it has not been confirmed that the agent did not get it. Its text is in the field.`
      : `Checked at ${time}: the message does not show in the conversation, and it has not been confirmed that the agent did not get it.`,
  rechecking: "Checking",
  historyUnavailable: "The history is not available",
  historyUnavailableDetail:
    "This conversation's saved history could not be read just now. Nothing has been lost, and it is read again by itself.",
  historyStillUnavailable: (time) =>
    `Checked at ${time}: the history is still not available. Nothing has been lost, and reading it is still retried. If it does not recover, tell your administrator.`,
  historyCut: "Storage ran out while saving",
  historyCutDetail:
    "Storage was full while the agent saved this conversation, and one of its messages was cut off. So the conversation can no longer be read in the browser. The original file has not been changed. Free up space or ask your administrator for more, so that it does not happen again, and continue in a new conversation.",
  historyUnavailableSend: (inField) =>
    inField
      ? "So it is also not known whether the agent got your last message. It is not resent automatically, and its text is in the field."
      : "So it is also not known whether the agent got your last message. It is not resent automatically.",
  titleFailed: "The title could not be made",
  wakePlaceholder: "Type to wake the agent…",
  keptNotSent: (reason) =>
    `The message was not sent: ${reason} The text is back in the field.`,
});

```
