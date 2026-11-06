import { catalog } from "../i18n";

// The browser-controlled conversation (app/BrowserConversation.tsx): the
// new-conversation start, the header and its details, live progress, the
// recovery banners and why sending or a recap is not available now.
const fi = {
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
  titleModelUnavailable:
    "Otsikointimalli ei vastannut. Tarkista mallipalvelun kirjautuminen asetuksista ja yritä uudelleen.",
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
  titleFailed: "Otsikkoa ei voitu luoda",
  wakePlaceholder: "Kirjoita, niin agentti herää…",
  keptNotSent: (reason: string) =>
    `Viestiä ei lähetetty: ${reason} Teksti on taas kentässä.`,
};

export const browserConversationText = catalog(fi, {
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
  titleModelUnavailable:
    "The titling model did not answer. Check your model provider sign-in in Settings and try again.",
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
  titleFailed: "The title could not be made",
  wakePlaceholder: "Type to wake the agent…",
  keptNotSent: (reason) =>
    `The message was not sent: ${reason} The text is back in the field.`,
});
