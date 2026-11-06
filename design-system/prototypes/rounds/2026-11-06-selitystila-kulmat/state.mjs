// Round 8 of the explain mode (proto-explain-mode-r6), built on round 7's
// state guidance and its chosen ? button. Round 6's cards stay in
// ../2026-11-03-selitystila-kortit/cards.mjs. Round 8 adds REGIONS (riff 3
// names the area empty space belongs to) and new riff lines.
//
// The text below is round 7's, unchanged:
// STATES is the guidance on the conversation's state as a whole: the card the
// mode shows in a conversation while you point at nothing. The prototype keys
// it by captured view; the implementation would key it by the state the
// header's dot already shows (working, waiting for you, stopped, failed,
// background work running, not started). Each state names its anchor (the part
// that carries the state on screen) and two or three things you can do now,
// each pointing at the part that does it (a card id of cards.mjs).
//
// CHANGED rewrites round 6 cards whose text spoke of pinning or of a press
// doing nothing; NEW adds the riffs' entry points; BLOCKED lists the presses
// that do nothing in the mode because their effect is lasting; TOGGLE maps a
// press that changes the view in place to the captured view after it.

// An anchor matching several parts means the last of them, the latest turn.
const LAST_TURN = '.ah-feed > li[data-kind="assistant"] [data-testid="agent-turn"]';
const LAST_REPLY = '.ah-feed [data-testid="stage-reply"]:not(.ah-turn-interim)';

export const STATES = {
  alku: {
    views: ["uusi", "uusi-malli", "opas"], anchor: '[data-testid="start-here"]', dot: "idle",
    fi: { name: "Ei vielä alkanut", lead: "Keskustelu alkaa, kun lähetät ensimmäisen viestin.", know: "Ennen sitä mitään ei tallennu: jos suljet sivun, tyhjää keskustelua ei jää listoille.",
      can: [["V01", "Kirjoita, mitä haluat agentin tekevän"], ["A02", "Tai valitse tavoite, niin pyyntö kirjoitetaan valmiiksi"], ["A05", "Vaihda malli tälle keskustelulle"]] },
    en: { name: "Not started yet", lead: "The conversation starts when you send the first message.", know: "Nothing is kept before that: close the page and no empty conversation is left on the lists.",
      can: [["V01", "Write what you want the agent to do"], ["A02", "Or choose a goal to have the request written for you"], ["A05", "Change the model for this conversation"]] },
  },
  tyossa: {
    views: ["tyossa", "tyossa-tyo"], anchor: '[data-testid="turn-progress"]', dot: "running",
    fi: { name: "Työskentelee", lead: "Agentti tekee pyytämääsi: se ajaa komentoja ja lukee tiedostoja tässä työtilassa.", know: "Työ jatkuu palvelimella, vaikka suljet selaimen; sivupalkin pallo kertoo, kun se on valmis.",
      can: [["V01", "Kirjoita jo seuraava viesti: se menee ohjauksena tai työn jälkeen"], ["K18", "Katso, mitä agentti tekee juuri nyt"], ["V07", "Pysäytä, jos työ on menossa väärään suuntaan"]] },
    en: { name: "Working", lead: "The agent is doing what you asked: running commands and reading files in this workspace.", know: "The work goes on on the server when you close the browser; the sidebar's ball tells you when it is done.",
      can: [["V01", "Write your next message now: it goes as steering or after the work"], ["K18", "See what the agent is doing right now"], ["V07", "Stop it if the work is heading the wrong way"]] },
  },
  vuorosi: {
    views: ["kaynnissa", "kaynnissa-auki", "kaynnissa-tuloste"], anchor: LAST_REPLY, dot: "waiting",
    fi: { name: "Odottaa sinua", lead: "Agentti on vastannut, ja vuoro on sinun.", know: "Keskustelu odottaa niin kauan kuin haluat. Jos et palaa siihen, se siirtyy sivupalkissa Hiljaisiin.",
      can: [["K04", "Avaa agentin työ, niin näet, mitä se teki"], ["V01", "Vastaa tai pyydä seuraava asia"], ["Y04", "Katso, mitä työtilassa muuttui"]] },
    en: { name: "Waiting for you", lead: "The agent has answered, and it is your turn.", know: "The conversation waits as long as you like. If you do not come back, it moves to Quiet in the sidebar.",
      can: [["K04", "Open the agent's work to see what it did"], ["V01", "Reply or ask for the next thing"], ["Y04", "See what changed in the workspace"]] },
  },
  pysaytetty: {
    views: ["pysaytetty"], anchor: `${LAST_TURN} [data-testid="turn-stage"]`, dot: "waiting",
    fi: { name: "Pysäytit vuoron", lead: "Agentti lopetti kesken eikä kirjoittanut vastausta.", know: "Se, minkä agentti ehti tehdä, jäi työtilaan. Agentti muistaa tähänastisen, joten voit jatkaa siitä.",
      can: [["K04", "Katso, mihin agentti jäi"], ["V01", "Kerro, miten jatketaan"]] },
    en: { name: "You stopped the turn", lead: "The agent stopped midway and wrote no reply.", know: "What the agent had done stays in the workspace. It remembers the conversation so far, so you can carry on from there.",
      can: [["K04", "See where the agent stopped"], ["V01", "Say how to carry on"]] },
  },
  virhe: {
    views: ["virhe"], anchor: LAST_TURN, dot: "failed",
    fi: { name: "Vuoro epäonnistui", lead: "Agentti ei saanut vastausta valmiiksi, ja vuoro päättyi virheeseen.", know: "Viestisi on tallessa. Usein riittää, että lähetät sen hetken päästä uudelleen.",
      can: [["V01", "Lähetä uudelleen tai kirjoita jatko"], ["Y06", "Vaihda malli, jos sama virhe toistuu"]] },
    en: { name: "The turn failed", lead: "The agent could not finish its reply, and the turn ended in an error.", know: "Your message is kept. Sending it again in a moment is often enough.",
      can: [["V01", "Send it again or write what comes next"], ["Y06", "Change the model if the same error repeats"]] },
  },
  tausta: {
    views: ["taustatyo-merkki"], anchor: '[data-testid="background-work"]', dot: "waiting",
    fi: { name: "Odottaa sinua, työ jatkuu taustalla", lead: "Agentti on vastannut, mutta sen käynnistämä worker tekee vielä omaa osaansa.", know: "Voit jatkaa keskustelua sillä aikaa; workerin valmistuminen näkyy viestikentän yllä.",
      can: [["V11", "Katso, mitä worker tekee"], ["V01", "Jatka keskustelua sillä aikaa"]] },
    en: { name: "Waiting for you, work goes on in the background", lead: "The agent has answered, but a worker it started is still doing its part.", know: "You can carry on meanwhile; the worker finishing shows above the message field.",
      can: [["V11", "See what the worker is doing"], ["V01", "Carry on meanwhile"]] },
  },
};

// Round 6 cards whose words no longer hold once a press keeps working, and
// one whose part was too wide: S02 matched every status mark, so the turn's
// "Agentti työskentelee" was explained as the connection.
export const CHANGED = {
  S02: { sel: 'strong + span[title] > [data-testid="status-mark"]' },
  X01: {
    fi: { know: "Nauha näkyy ensimmäisellä tyhjällä aloitussivulla. Myöhemmin tila löytyy Tilivalikosta ja keskustelun ?-painikkeesta." },
    en: { know: "The strip shows on your first empty start page. Later the mode is in the account menu and behind the conversation's ? button." },
  },
  X02: {
    fi: { lead: "Kertoo, että näyttö on selitystilassa: osoittamasi kohta selittyy, ja painallus toimii kuten aina.", know: "Esc tai Lopeta palauttaa tavallisen näkymän. Arkistointi, poisto ja lähettäminen odottavat, kunnes lopetat." },
    en: { lead: "Tells you the screen is in explain mode: what you point at is explained, and a press works as always.", know: "Esc or Stop returns to the normal view. Archiving, deleting and sending wait until you stop." },
  },
};

// Round 7's chosen entry point, now in every riff: the top bar's ?.
export const NEW = [
  { id: "X05", area: "X", kind: "once", sel: "[data-xm-help]", key: "?",
    fi: { name: "Selitä", lead: "Avaa selitystilan, ja ensin selittyy keskustelun tila.", know: "Painike on aina yläpalkissa; ?-näppäin tekee saman." },
    en: { name: "Explain", lead: "Opens the explain mode, starting with the conversation's state.", know: "The button is always in the top bar; the ? key does the same." } },
];

// Lasting effects: in the mode these presses do nothing, and the card says so.
export const BLOCKED = new Set(["Y11", "S13", "T05", "T06", "S26", "Y12", "V06", "V07", "R03", "D03"]);

// A press that changes the view in place: [card, from view, to view].
export const TOGGLE = [
  ["K04", "kaynnissa", "kaynnissa-auki"], ["K04", "kaynnissa-auki", "kaynnissa"], ["K04", "kaynnissa-tuloste", "kaynnissa"],
  ["K05", "kaynnissa-auki", "kaynnissa-tuloste"], ["K05", "kaynnissa-tuloste", "kaynnissa-auki"],
  ["K18", "tyossa", "tyossa-tyo"], ["K18", "tyossa-tyo", "tyossa"],
  ["V11", "taustatyo-merkki", "taustatyo"],
];

// The three riffs of round 8: the corner cases of pointing. Each answers both
// questions: what empty space shows, and how a control that production shows
// only under the pointer (the rail rows' Nimeä and Arkistoi, a workspace's +)
// is reached and explained.
export const RIFFS = [
  { id: "kuten-aina", fi: { label: "1 Kuten aina", line: "Osoitin toimii kuten ilman tilaa: rivi tuo piilopainikkeensa esiin, ja ne selittyvät. Tyhjän kohdan yllä edellinen kortti jää hiljaisena paikalleen, kunnes osoitat uutta kohtaa." } },
  { id: "kaikki-esilla", fi: { label: "2 Kaikki esillä", line: "Selitystila tuo kaikki piilopainikkeet näkyviin kerralla, kuten kosketusnäytöllä. Tyhjä kohta on tyhjä: kortti ja himmennys väistyvät." } },
  { id: "kokonaisuus", fi: { label: "3 Kokonaisuus kertoo", line: "Rivin kortti kertoo myös piilossa olevat painikkeet. Tyhjä kohta näyttää alueen nimen yhdellä rivillä, ja keskustelussa se rivi on tilanne." } },
];

// Riff 3: the area empty space belongs to, the first match from the pointed
// element up. "conversation" shows the conversation's state instead of a name.
export const REGIONS = [
  { id: "rail", sel: ".ah-rail", fi: { name: "Sivupalkki", line: "keskustelusi, työtilat ja tilisi" }, en: { name: "Sidebar", line: "your conversations, workspaces and account" } },
  { id: "header", sel: ".ah-agent-header, .ah-mobile-toolbar", fi: { name: "Yläpalkki", line: "keskustelun nimi, tila ja paneelit" }, en: { name: "Top bar", line: "the conversation's name, state and panels" } },
  { id: "composer", sel: ".ah-bg-strip, .ah-composer", fi: { name: "Viestikenttä", line: "mitä kirjoitat agentille, ja taustatyön merkit" }, en: { name: "Message field", line: "what you write to the agent, and background work" } },
  { id: "terminal", sel: ".ah-terminal-dock", fi: { name: "Pääte", line: "komentorivi työtilan kansiossa" }, en: { name: "Terminal", line: "a command line in the workspace folder" } },
  { id: "conversation", sel: ".ah-conversation-stream", fi: { name: "Keskustelu", line: "" }, en: { name: "Conversation", line: "" } },
  { id: "home", sel: ".ah-home-section", fi: { name: "Etusivu", line: "jokaisen työtilan avoimet keskustelut" }, en: { name: "Home", line: "every workspace's open conversations" } },
  { id: "workspace", sel: ".ah-start", fi: { name: "Työtilan sivu", line: "työtilan tiedot ja keskustelut" }, en: { name: "Workspace page", line: "the workspace's details and conversations" } },
  { id: "settings", sel: ".ah-account-settings", fi: { name: "Asetukset", line: "jokaisella sivulla rivit kertovat itse, mitä ne tekevät" }, en: { name: "Settings", line: "on every page the rows say what they do" } },
];
