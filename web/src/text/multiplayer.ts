import { catalog, formatNumber, plural } from "../i18n";

// Other people in a person's conversation (ADR 0038). People's names are
// interpolated only in the nominative ("henkilölle Ville", "Pyytäjä: Ville"),
// because the browser cannot inflect an arbitrary Finnish name.
const fi = {
  roles: {
    owner: "Omistaja",
    participant: "Osallistuja",
    full_rights: "Täydet oikeudet",
  },
  you: "Sinä",
  // The owner's people row and its panel.
  people: "Keskustelun ihmiset",
  present: (n: number) => `${formatNumber(n)} paikalla`,
  nobody: "Vain sinä",
  invite: "Kutsu",
  panelLead:
    "Agentti, malli, kiintiö ja yhteydet ovat sinun. Osallistujan viesteihin agentti vastaa ilman työkaluja, kunnes päästät sen jatkamaan tai annat hänelle täydet oikeudet.",
  states: {
    invited: "Kutsuttu, ei vielä liittynyt",
    joined: "Mukana",
    here: "Paikalla",
    typing: "Kirjoittaa",
  },
  giveFull: "Anna täydet oikeudet",
  takeBack: "Ota oikeudet pois",
  remove: "Poista keskustelusta",
  close: "Sulje",
  cancel: "Peruuta",
  busy: "Odota hetki…",
  changeFailed: "Muutosta ei voitu tehdä. Tila luettiin uudelleen.",
  changeUncertain:
    "Ei tiedetä, menikö muutos perille. Tila luettiin uudelleen.",
  noMembers: "Keskustelussa ei ole muita. Kutsu joku palvelimen käyttäjistä.",
  // Täydet oikeudet: the confirmation names what is lent.
  confirmTitle: (name: string) =>
    `Annetaanko henkilölle ${name} täydet oikeudet?`,
  confirmLead:
    "Hänen viesteihinsä agentti vastaa silloin samoilla työkaluilla kuin sinun viesteihisi. Agentti toimii sinun käyttäjänäsi, joten hän voi saada sen käyttämään kysymättä:",
  lent: [
    "tiedostojasi tällä palvelimella",
    "GitHub-tiliäsi",
    "yhdistämiäsi palveluja, kuten sähköpostia ja kalenteria",
    "omia koneitasi, jotka olet liittänyt Habitatiin",
    "kiintiötäsi ja AI-tunnuksiasi",
  ],
  confirmAfter:
    "Voit ottaa oikeudet pois heti. Se ei peru sitä, mitä agentti on jo tehnyt.",
  confirm: "Anna täydet oikeudet",
  // Kutsu: every signed-in person on this server.
  inviteTitle: "Kutsu keskusteluun",
  inviteLead:
    "Kutsuttu näkee keskustelun vasta liityttyään. Agentti vastaa hänelle ilman työkaluja, kunnes päästät sen jatkamaan. Kiintiö ja yhteydet ovat sinun.",
  inviteLoading: "Luetaan palvelimen käyttäjiä…",
  inviteFailed: "Käyttäjiä ei voitu lukea.",
  inviteEmpty: "Palvelimella ei ole muita kirjautuneita käyttäjiä.",
  inviteOne: "Kutsu",
  membership: {
    none: "",
    invited: "Kutsuttu",
    joined: "Mukana",
  },
  // After taking full rights back or removing someone: at once (Heti).
  tookBack: (name: string) => `Otit täydet oikeudet pois henkilöltä ${name}`,
  removed: (name: string) => `Poistit henkilön ${name} keskustelusta`,
  removedNote: "Hän ei enää näe keskustelua.",
  runContinues:
    "Käynnissä oleva ajo jatkuu vain tekstinä seuraavasta työkalukutsusta alkaen.",
  revocationFailed:
    "Käynnissä olevaa ajoa ei tavoitettu. Pysäytä se, jos se toimii hänen pyynnöstään.",
  stopRun: "Pysäytä ajo",
  stopRunSent: "Pysäytys pyydetty",
  processes: "Käynnissä olevat prosessit",
  processesNote:
    "Agentti on voinut käynnistää näitä hänen pyynnöstään. Ne jatkuvat, kunnes pysäytät ne.",
  noProcesses: "Ei käynnissä olevia prosesseja.",
  stop: "Pysäytä",
  stopping: "Pysäytetään",
  // The card where the agent stopped.
  waitingTitle: "Agentti pysähtyi: pyyntö tarvitsee työkaluja",
  requester: (name: string) => `Pyytäjä: ${name}`,
  waitingLead:
    "Agentti vastasi vain tekstillä. Päätä, saako se jatkaa sinun työkaluillasi.",
  allowAll: "Salli kaikki",
  approveEach: "Hyväksy yksitellen",
  decline: "Älä salli",
  released: "Vastaus lähetetty. Agentti jatkaa, kun se on vapaa.",
  releaseFailed: "Vastausta ei voitu lähettää. Pyyntö odottaa yhä.",
  // One call asked about in a run released one call at a time.
  approvalTitle: "Saako agentti tehdä tämän?",
  approvalTool: (tool: string) => `Työkalu: ${tool}`,
  allow: "Salli",
  deny: "Älä salli",
  answers: {
    allowed: "Sallittu",
    denied: "Et sallinut",
    allow_all: "Sallit loput",
    cancelled: "Peruttu",
  },
  decisions: "Päätökset tässä ajossa",
  answerSent: "Vastaus lähetetty",
  answerUncertain: "Ei tiedetä, menikö vastaus perille.",
  // Habitat's lines in the conversation.
  lines: {
    joined: (name: string) => `${name} liittyi keskusteluun.`,
    full_rights_given: (name: string) => `${name} sai täydet oikeudet.`,
    full_rights_taken: (name: string) =>
      `Täydet oikeudet otettiin pois. ${name} on taas osallistuja.`,
    removed: (name: string) => `${name} poistettiin keskustelusta.`,
    continueTools: (name: string) =>
      `Agentti jatkaa pyyntöä kaikilla työkaluilla. Pyytäjä: ${name}.`,
    continueEach: (name: string) =>
      `Agentti jatkaa pyyntöä, ja jokainen työkalukutsu hyväksytään erikseen. Pyytäjä: ${name}.`,
    declined: (name: string) =>
      `Pyyntöä ei sallittu, joten agentti ei toimi sen pohjalta. Pyytäjä: ${name}.`,
  },
  // The participant's side.
  sharedWithYou: "Jaettu kanssasi",
  inviteBadge: "Kutsu",
  invitedBy: (name: string) => `${name} kutsui sinut keskusteluun`,
  untitled: "Nimetön keskustelu",
  inviteWhose:
    "Agentti on kutsujan: hänen mallinsa, kiintiönsä ja yhteytensä. Se vastaa sinulle vain tekstillä, kunnes kutsuja päästää sen jatkamaan tai antaa sinulle täydet oikeudet.",
  inviteNothing: "Näet keskustelun vasta liityttyäsi.",
  join: "Liity",
  notNow: "Ei nyt",
  joinFailed: "Liittyminen ei onnistunut. Yritä uudelleen.",
  ownerLine: (name: string) => `Omistaja: ${name}`,
  workspaceLine: (name: string) => `Työtila: ${name}`,
  loading: "Avataan keskustelua…",
  unavailable: "Keskustelu ei ole saatavilla",
  unavailableDetail:
    "Omistaja on voinut poistaa sinut keskustelusta tai arkistoida sen, tai hänen palvelunsa ei ole juuri nyt käynnissä.",
  hostProblem: "Keskustelua ei voitu lukea. Yritetään uudelleen.",
  retry: "Yritä uudelleen",
  toAll: "Kaikki työtilat",
  stripTextOnly:
    "Vain teksti: agentti vastaa sinulle tekstillä. Työkaluja vaativat toimet odottavat omistajaa.",
  stripFull:
    "Täydet oikeudet: agentti voi käyttää työkaluja viestiesi pohjalta.",
  stripWaiting: (n: number) =>
    `${formatNumber(n)} ${plural("fi", n, { one: "pyyntösi odottaa", other: "pyyntöäsi odottaa" })} omistajan päätöstä`,
  stripAsked: "Omistaja hyväksyy agentin toimia yksi kerrallaan.",
  stripRunning: "Agentti työskentelee",
  stripStop: "Pysäytä vuoro",
  stopSent: "Pysäytys pyydetty",
  heldTitle: "Odottaa, kunnes agentti on vapaa",
  delivering: "Annetaan agentille",
  cancelHeld: "Peru",
  placeholder: "Kirjoita viesti agentille",
  sendFailed: "Viestiä ei voitu lähettää. Teksti on yhä kentässä.",
  liveLost: "Yhteys katkesi. Keskustelu luetaan uudelleen.",
};

export const multiplayerText = catalog(
  fi,
  {
    roles: {
      owner: "Owner",
      participant: "Participant",
      full_rights: "Full rights",
    },
    you: "You",
    people: "People in the conversation",
    present: (n) => `${formatNumber(n)} here`,
    nobody: "Only you",
    invite: "Invite",
    panelLead:
      "The agent, model, quota and connections are yours. The agent answers a participant's messages without tools until you let it continue or give them full rights.",
    states: {
      invited: "Invited, not joined yet",
      joined: "In the conversation",
      here: "Here",
      typing: "Typing",
    },
    giveFull: "Give full rights",
    takeBack: "Take rights back",
    remove: "Remove from conversation",
    close: "Close",
    cancel: "Cancel",
    busy: "One moment…",
    changeFailed: "The change could not be made. The state was read again.",
    changeUncertain:
      "It is not known whether the change went through. The state was read again.",
    noMembers:
      "Nobody else is in the conversation. Invite someone who uses this server.",
    confirmTitle: (name) => `Give ${name} full rights?`,
    confirmLead:
      "The agent then answers their messages with the same tools as yours. The agent acts as your user, so they can have it use, without asking:",
    lent: [
      "your files on this server",
      "your GitHub account",
      "services you have connected, such as mail and calendar",
      "your own machines connected to Habitat",
      "your quota and AI credentials",
    ],
    confirmAfter:
      "You can take the rights back at once. That does not undo what the agent has already done.",
    confirm: "Give full rights",
    inviteTitle: "Invite to the conversation",
    inviteLead:
      "The person sees the conversation only after joining. The agent answers them without tools until you let it continue. The quota and connections are yours.",
    inviteLoading: "Reading the people on this server…",
    inviteFailed: "The people could not be read.",
    inviteEmpty: "Nobody else has signed in to this server.",
    inviteOne: "Invite",
    membership: {
      none: "",
      invited: "Invited",
      joined: "In the conversation",
    },
    tookBack: (name) => `You took full rights back from ${name}`,
    removed: (name) => `You removed ${name} from the conversation`,
    removedNote: "They no longer see the conversation.",
    runContinues:
      "The run in progress continues as text only from its next tool call.",
    revocationFailed:
      "The run in progress could not be reached. Stop it if it acts on their request.",
    stopRun: "Stop the run",
    stopRunSent: "Stop requested",
    processes: "Running processes",
    processesNote:
      "The agent may have started these at their request. They keep running until you stop them.",
    noProcesses: "No running processes.",
    stop: "Stop",
    stopping: "Stopping",
    waitingTitle: "The agent stopped: the request needs tools",
    requester: (name) => `Requested by ${name}`,
    waitingLead:
      "The agent answered with text only. Decide whether it may continue with your tools.",
    allowAll: "Allow all",
    approveEach: "Approve one by one",
    decline: "Don't allow",
    released: "Answer sent. The agent continues when it is free.",
    releaseFailed:
      "The answer could not be sent. The request is still waiting.",
    approvalTitle: "May the agent do this?",
    approvalTool: (tool) => `Tool: ${tool}`,
    allow: "Allow",
    deny: "Don't allow",
    answers: {
      allowed: "Allowed",
      denied: "You did not allow",
      allow_all: "You allowed the rest",
      cancelled: "Canceled",
    },
    decisions: "Decisions in this run",
    answerSent: "Answer sent",
    answerUncertain: "It is not known whether the answer went through.",
    lines: {
      joined: (name) => `${name} joined the conversation.`,
      full_rights_given: (name) => `${name} got full rights.`,
      full_rights_taken: (name) =>
        `Full rights were taken back. ${name} is a participant again.`,
      removed: (name) => `${name} was removed from the conversation.`,
      continueTools: (name) =>
        `The agent continues the request with all its tools. Requested by ${name}.`,
      continueEach: (name) =>
        `The agent continues the request, and each tool call is approved separately. Requested by ${name}.`,
      declined: (name) =>
        `The request was not allowed, so the agent does not act on it. Requested by ${name}.`,
    },
    sharedWithYou: "Shared with you",
    inviteBadge: "Invite",
    invitedBy: (name) => `${name} invited you to a conversation`,
    untitled: "Untitled conversation",
    inviteWhose:
      "The agent belongs to the person who invited you: their model, quota and connections. It answers you with text only until they let it continue or give you full rights.",
    inviteNothing: "You see the conversation only after joining.",
    join: "Join",
    notNow: "Not now",
    joinFailed: "Joining did not work. Try again.",
    ownerLine: (name) => `Owner: ${name}`,
    workspaceLine: (name) => `Workspace: ${name}`,
    loading: "Opening the conversation…",
    unavailable: "Conversation unavailable",
    unavailableDetail:
      "The owner may have removed you from the conversation or archived it, or their service is not running right now.",
    hostProblem: "The conversation could not be read. Trying again.",
    retry: "Try again",
    toAll: "All workspaces",
    stripTextOnly:
      "Text only: the agent answers you with text. Actions that need tools wait for the owner.",
    stripFull: "Full rights: the agent may use tools based on your messages.",
    stripWaiting: (n) =>
      `${formatNumber(n)} ${plural("en-US", n, { one: "request of yours waits", other: "requests of yours wait" })} for the owner's decision`,
    stripAsked: "The owner approves the agent's actions one at a time.",
    stripRunning: "The agent is working",
    stripStop: "Stop the turn",
    stopSent: "Stop requested",
    heldTitle: "Waiting until the agent is free",
    delivering: "Being given to the agent",
    cancelHeld: "Cancel",
    placeholder: "Write a message to the agent",
    sendFailed:
      "The message could not be sent. The text is still in the field.",
    liveLost: "The connection dropped. The conversation is read again.",
  },
  { answers: { cancelled: "Cancelled" } },
);
