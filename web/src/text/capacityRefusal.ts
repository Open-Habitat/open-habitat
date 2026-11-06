import { catalog, plural } from "../i18n";

// The card of a new conversation refused at the limit on conversations
// working at once (components/CapacityRefusal.tsx), and its window of what
// holds a place.
const fi = {
  installation: (limit: number, n: number) =>
    `Ylläpitäjän asettama raja on ${limit} yhtä aikaa työskentelevää keskustelua, ja ${n} työskentelee jo.`,
  own: (limit: number, n: number) =>
    `Ylläpitäjä on antanut sinulle rajan ${limit} yhtä aikaa työskentelevää keskustelua, ja ${n} työskentelee jo.`,
  server: (limit: number, n: number) =>
    `Palvelimen raja on ${limit} yhtä aikaa työskentelevää keskustelua, ja ${n} työskentelee jo.`,
  stillFull: "Yritit uudelleen: yhä täynnä.",
  who: "Mitkä pitävät paikkaa?",
  changeLimitAdmin: "Muuta rajaa (ylläpitäjä)",
  changeLimit: "Muuta rajaa",
  room: "Tilaa on nyt",
  roomText: (n: number, limit: number) =>
    `${n} ${n === 1 ? "keskustelu työskentelee" : "keskustelua työskentelee"}; rajasi on ${limit}. Viestisi on tallessa.`,
  start: "Aloita keskustelu",
  windowTitle: (n: number, limit: number) => `Työskentelee nyt · ${n}/${limit}`,
  windowLabel: "Työskentelee nyt",
  windowDesc:
    "Keskustelu pitää paikkaa, kun sen vuoro on kesken, se odottaa vastaustasi tai sen käynnistämä taustaprosessi on yhä käynnissä. Pysäytetty keskustelu jatkuu seuraavasta viestistäsi.",
  thisWorkspace: (name: string, n: number) => `${name} (tämä työtila) · ${n}`,
  workspace: (name: string, n: number) => `${name} · ${n}`,
  otherPlace: "Muu paikka",
  inWorkspace: (name: string, n: number) => `${name}: ${n}`,
  unknown: "Tila ei varma",
  stopTurn: "Pysäytä vuoro",
  stopProcess: "Pysäytä prosessi",
  stop: "Pysäytä",
  stopping: "Pysäytetään…",
  stopped: "Pysäytetty · paikka vapautui",
  stopFailed: "Pysäytystä ei voitu vahvistaa.",
  done: "Valmis",
};

export const capacityRefusalText = catalog(fi, {
  installation: (limit, n) =>
    `The administrator's limit is ${limit} conversations working at once, and ${n} ${n === 1 ? "is" : "are"} already working.`,
  own: (limit, n) =>
    `The administrator has given you a limit of ${limit} conversations working at once, and ${n} ${n === 1 ? "is" : "are"} already working.`,
  server: (limit, n) =>
    `The server's limit is ${limit} conversations working at once, and ${n} ${n === 1 ? "is" : "are"} already working.`,
  stillFull: "You tried again: still full.",
  who: "What holds the places?",
  changeLimitAdmin: "Change the limit (administrator)",
  changeLimit: "Change the limit",
  room: "There is room now",
  roomText: (n, limit) =>
    `${n} ${plural("en", n, { one: "conversation is", other: "conversations are" })} working; your limit is ${limit}. Your message is kept.`,
  start: "Start the conversation",
  windowTitle: (n, limit) => `Working now · ${n}/${limit}`,
  windowLabel: "Working now",
  windowDesc:
    "A conversation holds a place while its turn is under way, while it waits for your answer or while a background process it started is still running. A stopped conversation continues from your next message.",
  thisWorkspace: (name, n) => `${name} (this workspace) · ${n}`,
  workspace: (name, n) => `${name} · ${n}`,
  otherPlace: "Elsewhere",
  inWorkspace: (name, n) => `${name}: ${n}`,
  unknown: "State uncertain",
  stopTurn: "Stop the turn",
  stopProcess: "Stop the process",
  stop: "Stop",
  stopping: "Stopping…",
  stopped: "Stopped · the place is free",
  stopFailed: "The stop could not be confirmed.",
  done: "Done",
});
