import { catalog, plural } from "../i18n";

// API keys in Settings › Tekoäly and in onboarding (app/PiCredentials.tsx).
// Provider names stay as they are.
const fi = {
  startsWith: (prefix: string) => `alkaa ${prefix}`,
  readFailed: "Tunnuksia ei voitu tarkistaa.",
  uncertain:
    "Muutoksen tulosta ei voitu vahvistaa. Tarkista tunnukset ennen uutta yritystä.",
  stored: (name: string, suffix?: string) =>
    suffix
      ? `${name}-avain tallennettu · sk-…${suffix}`
      : `${name}-avain tallennettu`,
  apiKey: (name: string, replacing: boolean) =>
    `${replacing ? "Uusi " : ""}${name} API-avain`,
  save: "Tallenna",
  notThisKey: (name: string, hint: string) =>
    `Tämä ei näytä ${name}-avaimelta (${hint}).`,
  ownOnly: (name: string) =>
    `Avain tallentuu vain omalle käyttäjällesi eikä sitä näytetä uudelleen. ${name} laskuttaa käytöstä.`,
  checkCredentials: "Tarkista tunnukset",
  notLiteral: "ei kirjaimellinen avain",
  apiKeys: "API-avaimet",
  fromAdmin: "Ylläpitäjän antama",
  own: "Oma",
  refusedAll: (name: string) =>
    `${name} torjui tämän avaimen mallit viimeksi kokeiltaessa. Avain on ehkä peruttu, väärin kirjoitettu tai sen kiintiö on täynnä. `,
  givenCurrent: (day: string) =>
    `Ylläpitäjä antoi avaimen ${day} Käyttö laskutetaan palvelimen tililtä.`,
  givenEarlier: (day: string) =>
    `Ylläpitäjä antoi avaimen ${day} Palvelin on sittemmin vaihtanut avaimensa, joten tämä kopio voi lakata toimimasta.`,
  ownKey: (name: string) => `Oma avain. ${name} laskuttaa käytöstä.`,
  notAnswering: "Ei vastaa",
  changeToOwn: "Vaihda omaan…",
  change: "Vaihda…",
  remove: "Poista…",
  opens: "Avaa:",
  checking: "Tarkistetaan avaimia…",
  missing: (names: string) => `Ei avainta: ${names}.`,
  allHave: "Jokaisella palvelulla on avain.",
  none: "Ei API-avaimia. Avaimella voi käyttää palveluntarjoajan malleja ilman tilausta; palveluntarjoaja laskuttaa käytöstä.",
  add: "Lisää API-avain",
  replaceTitle: (name: string) => `Vaihda ${name} API-avain`,
  dialogIntro:
    "Avaimella voi käyttää palveluntarjoajan malleja ilman tilausta. Kullekin palvelulle tallentuu yksi avain.",
  provider: "Palveluntarjoaja",
  replacesAdmin: (key: string) => `Korvaa ylläpitäjän antaman avaimen ${key}`,
  replaces: (key: string) => `Korvaa avaimen ${key}`,
  models: (n: number) => `${n} mallia`,
  noKey: "Ei avainta",
  ownReplacesAdmin:
    "Oma avaimesi korvaa ylläpitäjän antaman kopion. Käyttö laskutetaan sen jälkeen sinulta. Avain lähetetään kerran eikä sitä näytetä uudelleen.",
  newReplaces: (key: string) =>
    `Uusi avain korvaa nykyisen (${key}). Avain lähetetään kerran eikä sitä näytetä uudelleen.`,
  firstKey:
    "Avain lähetetään kerran eikä sitä näytetä uudelleen. Palvelun ensimmäinen avain vaihtaa uusien keskustelujen oletukseksi sen mallin; avoimet keskustelut eivät muutu.",
  cancel: "Peruuta",
  saveKey: "Tallenna avain",
  removeQuestion: "Poistetaanko API-avain?",
  removeEffect: (name: string, isDefault: boolean) =>
    `Avain poistuu vain Pi:n tunnuksista tällä palvelimella. Avainta ei peruta palvelussa ${name}. Avainta käyttävät keskustelut eivät voi jatkaa ennen uuden avaimen lisäämistä. Tilauskirjautumiset säilyvät.${isDefault ? " Uusien keskustelujen oletusmalli käyttää tätä avainta, joten valitse sen jälkeen toinen oletus." : ""}`,
  removeKey: "Poista avain",
  modelsLine: (n: number, names: string) =>
    `${n} ${n === 1 ? "malli" : "mallia"}: ${names}.`,
};

export const piCredentialsText = catalog(fi, {
  startsWith: (prefix) => `starts ${prefix}`,
  readFailed: "The credentials could not be checked.",
  uncertain:
    "The result of the change could not be confirmed. Check the credentials before trying again.",
  stored: (name, suffix) =>
    suffix ? `${name} key saved · sk-…${suffix}` : `${name} key saved`,
  apiKey: (name, replacing) => `${replacing ? "New " : ""}${name} API key`,
  save: "Save",
  notThisKey: (name, hint) =>
    `This does not look like a ${name} key (${hint}).`,
  ownOnly: (name) =>
    `The key is saved only for your own user and is not shown again. ${name} bills for use.`,
  checkCredentials: "Check credentials",
  notLiteral: "not a literal key",
  apiKeys: "API keys",
  fromAdmin: "Given by the administrator",
  own: "Own",
  refusedAll: (name) =>
    `${name} refused this key's models when they were last tried. The key may have been revoked, mistyped or its quota is full. `,
  givenCurrent: (day) =>
    `The administrator gave the key on ${day}. Use is billed to the server's account.`,
  givenEarlier: (day) =>
    `The administrator gave the key on ${day}. The server has since changed its key, so this copy may stop working.`,
  ownKey: (name) => `Your own key. ${name} bills for use.`,
  notAnswering: "Not answering",
  changeToOwn: "Change to your own…",
  change: "Change…",
  remove: "Remove…",
  opens: "Opens:",
  checking: "Checking keys…",
  missing: (names) => `No key: ${names}.`,
  allHave: "Every service has a key.",
  none: "No API keys. With a key you can use a provider's models without a subscription; the provider bills for use.",
  add: "Add API key",
  replaceTitle: (name) => `Change ${name} API key`,
  dialogIntro:
    "With a key you can use a provider's models without a subscription. One key is saved per service.",
  provider: "Provider",
  replacesAdmin: (key) => `Replaces the key the administrator gave ${key}`,
  replaces: (key) => `Replaces the key ${key}`,
  models: (n) => `${n} ${plural("en", n, { one: "model", other: "models" })}`,
  noKey: "No key",
  ownReplacesAdmin:
    "Your own key replaces the copy the administrator gave. Use is billed to you after that. The key is sent once and not shown again.",
  newReplaces: (key) =>
    `The new key replaces the current one (${key}). The key is sent once and not shown again.`,
  firstKey:
    "The key is sent once and not shown again. A service's first key makes its model the default of new conversations; open conversations do not change.",
  cancel: "Cancel",
  saveKey: "Save key",
  removeQuestion: "Remove the API key?",
  removeEffect: (name, isDefault) =>
    `The key is removed only from Pi's credentials on this server. The key is not revoked at ${name}. Conversations using the key cannot continue until a new key is added. Subscription sign-ins stay.${isDefault ? " The default model of new conversations uses this key, so choose another default afterwards." : ""}`,
  removeKey: "Remove key",
  modelsLine: (n, names) =>
    `${n} ${plural("en", n, { one: "model", other: "models" })}: ${names}.`,
});
