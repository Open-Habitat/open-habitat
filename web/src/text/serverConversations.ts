import { catalog, plural } from "../i18n";

// Settings › Ylläpito › Keskustelut (app/ServerConversations.tsx): the limit
// on conversations working at once, for everyone and per person. The
// estimate is computed from the limits; how many conversations another
// person has working is not shown, because only their own daemon knows it.
const fi = {
  lead: "Raja koskee yhtä aikaa työskenteleviä keskusteluja, ei avoimien keskustelujen määrää. Levossa oleva keskustelu ei vie paikkaa. Keskustelu pitää paikkaa, kun sen vuoro on kesken, se odottaa vastausta tai sen käynnistämä taustaprosessi on käynnissä. Rajaan törmäävä näkee, mitkä pitävät paikkaa, ja voi pysäyttää jonkin.",
  memory: "Muisti",
  memoryDesc: (total: string, child: string) =>
    `Palvelimella ${total}. Yksi työskentelevä keskustelu vie noin ${child}.`,
  memoryUnknownDesc: (child: string) =>
    `Palvelimen muistia ei voitu lukea. Yksi työskentelevä keskustelu vie noin ${child}.`,
  meter: (used: string, worst: string, total: string) =>
    `Käytössä nyt ${used}, jos jokainen käyttää koko rajansa ${worst} / ${total}`,
  usedNow: "Käytössä nyt koko palvelimella",
  worst: "Jos jokainen käyttää koko rajansa",
  conversations: (n: number) => `${n} keskustelu${n === 1 ? "" : "a"}`,
  over: "Rajat yhteensä ylittävät palvelimen muistin. Keskustelut eivät ole kaikki yhtä aikaa työssä, mutta jos ovat, muisti loppuu.",
  perPerson: "Raja henkilöä kohden",
  perPersonDesc: "Ellei henkilöllä ole omaa rajaa.",
  overHostDefault: (n: number) =>
    `Yli palvelimen oman oletuksen ${n}: varmista, että muisti riittää.`,
  unit: "keskustelua",
  people: "Henkilöt",
  usesDefault: "oletus",
  ownLimit: "oma raja",
  personLimit: (name: string) => `Raja: ${name}`,
  toDefault: "Oletukseen",
  saving: "Tallennetaan…",
  unavailable: "Rajoja ei voitu lukea.",
  refused: "Rajaa ei muutettu.",
  uncertain:
    "Muutosta ei voitu vahvistaa. Lataa sivu nähdäksesi voimassa olevan rajan.",
};

export const serverConversationsText = catalog(fi, {
  lead: "The limit counts conversations working at the same time, not open conversations. A resting conversation does not hold a place. A conversation holds a place while its turn is under way, while it waits for an answer or while a background process it started is running. Whoever reaches the limit sees what holds the places and can stop one.",
  memory: "Memory",
  memoryDesc: (total, child) =>
    `The server has ${total}. One working conversation takes about ${child}.`,
  memoryUnknownDesc: (child) =>
    `The server's memory could not be read. One working conversation takes about ${child}.`,
  meter: (used, worst, total) =>
    `In use now ${used}, if everyone used their whole limit ${worst} / ${total}`,
  usedNow: "In use now on the whole server",
  worst: "If everyone used their whole limit",
  conversations: (n) =>
    `${n} ${plural("en", n, { one: "conversation", other: "conversations" })}`,
  over: "Together the limits exceed the server's memory. The conversations are not all working at once, but if they are, memory runs out.",
  perPerson: "Limit per person",
  perPersonDesc: "Unless the person has a limit of their own.",
  overHostDefault: (n) =>
    `Above the server's own default of ${n}: make sure there is enough memory.`,
  unit: "conversations",
  people: "People",
  usesDefault: "default",
  ownLimit: "own limit",
  personLimit: (name) => `Limit: ${name}`,
  toDefault: "Back to default",
  saving: "Saving…",
  unavailable: "The limits could not be read.",
  refused: "The limit was not changed.",
  uncertain:
    "The change could not be confirmed. Reload the page to see the limit in effect.",
});
