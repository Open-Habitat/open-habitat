# text/webSearch.tsx

Generated from web/src/text/webSearch.tsx; do not edit.

```tsx
import type { ReactNode } from "react";
import { catalog } from "../i18n";

// The web search key (app/WebSearchSettings.tsx): the administrator's
// service rows on Palvelinintegraatiot and the person's card or tile on
// Tiedot agenteille. The words follow the speech key (text/speechSettings)
// wherever the search key works the same way, and the neighbouring service
// rows (Tunnukset, Aseta tunnukset…) where it sits among them.

const and = (names: string[], word: string) =>
  names.length < 2
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} ${word} ${names[names.length - 1]}`;

const fi = {
  search: "Verkkohaku",
  offered: "Tarjolla",
  notOffered: "Ei tarjolla",
  notInUse: "Ei käytössä",
  inUse: "Käytössä",
  notAnswering: "Ei vastaa",
  setKey: "Aseta avain…",
  addKeyDots: "Lisää avain…",
  keyMenu: "Avain",
  keyMenuOf: (service: string) => `Hakuavain: ${service}`,
  changeKeyDots: "Vaihda avain…",
  removeKey: "Poista avain",
  siteRow: (suffix: string, date: string) =>
    `Yhteinen avain …${suffix} · ${date}`,
  siteRowNone: "Verkkohaku. Ei yhteistä avainta.",
  serviceOther: (service: string) =>
    `Käytössä on ${service}. Avain tähän korvaisi sen.`,
  replacesSite: (other: string) =>
    `Tallennus korvaa yhteisen ${other}-avaimen, koska haku käyttää yhtä palvelua kerrallaan. ${other}-avaimen kopiot korvautuvat samalla tavalla kuin avainta vaihdettaessa.`,
  replacesOwn: (other: string) =>
    `Tallennus korvaa oman ${other}-avaimesi, koska haku käyttää yhtä palvelua kerrallaan.`,
  siteDialog: (service: string) => `Yhteinen ${service}-avain`,
  personDialog: (service: string) => `${service}-avain`,
  siteKeyState: (service: string, suffix: string, date: string) =>
    `${service} …${suffix}, otettu käyttöön ${date}.`,
  siteIntro:
    "Kaikki, joilla ei ole omaa hakuavainta, hakevat verkosta tällä. Käyttö laskutetaan sinulta.",
  siteSaveNote:
    "Tallennus kokeilee avainta yhdellä haulla ja antaa sen sitten jo liittyneille. Tallennettua avainta ei näytetä uudelleen.",
  giving: "Kokeillaan avainta ja annetaan sitä jo liittyneille…",
  siteRemoved: "Yhteinen avain poistettu. Jo annetut kopiot jäivät ennalleen.",
  siteNative:
    "Mallit, joilla on oma verkkohaku, kuten ChatGPT- ja Claude-tilaus, hakevat itse eivätkä käytä tätä avainta.",
  siteCopy:
    "Jokainen saa avaimesta kopion kotihakemistoonsa, ja hänen agenttinsa voivat käyttää sitä. Kopiota ei voi perua kuin vaihtamalla avain hakupalvelun sivulla.",
  siteJoined:
    "Jo liittyneet saavat avaimen heti, uudet ensimmäisellä kirjautumisellaan.",
  siteLimit:
    "Kaikki jakavat avaimen kuukausikiintiön. Kiintiön ylittävät haut laskutetaan sinulta, tai haku lakkaa, jos laskutusta ei ole.",
  siteReadFailed: "Yhteistä hakuavainta ei voitu lukea.",
  given: {
    seeded: "sai avaimen",
    replaced: "sai uuden avaimen aiemman tilalle",
    already_current: "oli jo saanut sen",
    kept: "käyttää omaa avaintaan",
    not_reached: "ei tavoitettu",
    unknown: "tulos ei varmistunut",
  } as Record<string, string>,
  missed: " Tavoittamattomat saavat avaimen, kun tallennat sen uudelleen.",
  notGiven:
    "Avain tallennettiin, mutta sitä ei voitu antaa jo liittyneille. He saavat sen, kun tallennat avaimen uudelleen.",
  // The person's card and tile
  admins: (suffix: string) => `Ylläpitäjän avain …${suffix}`,
  own: (suffix: string) => `Oma avain …${suffix}`,
  addOwn: "Lisää oma avain",
  replace: "Vaihda avain",
  remove: "Poista",
  refused: (service: string, day: string) =>
    `${service} torjui avaimen viimeksi haettaessa ${day}, joten agentit eivät voi hakea sillä. Avain on ehkä peruttu tai sen kiintiö on täynnä.`,
  users: (needers: string[], natives: string[]) =>
    (needers.length
      ? `${and(needers, "ja")}-mallit hakevat tällä avaimella.`
      : "Mikään mallisi ei nyt tarvitse avainta.") +
    (natives.length
      ? ` ${and(natives, "ja")} ${natives.length > 1 ? "hakevat" : "hakee"} itse.`
      : ""),
  usersUnknown:
    "Mallit, joilla ei ole omaa verkkohakua, hakevat tällä avaimella.",
  tileNeed: (names: string[]) =>
    `${and(names, "ja")}-mallit eivät hae verkosta ilman avainta.`,
  tileCovered: (names: string[]) =>
    `${and(names, "ja")} ${names.length > 1 ? "hakevat" : "hakee"} itse, joten avainta ei nyt tarvita.`,
  tileReplaces: (other: string) => `Korvaisi ${other}-avaimesi.`,
  tilePlain: "Verkkohaku malleille, joilla ei ole omaa hakua.",
  usedFor:
    "Avainta käytetään vain malleilla, joilla ei ole omaa verkkohakua. ChatGPT- ja Claude-tilaus hakevat itse.",
  goesTo: "Agentin hakusanat menevät valitulle hakupalvelulle.",
  stored: (file: ReactNode): ReactNode => (
    <>Avain tallentuu tiedostoon {file}, ja agenttisi voivat käyttää sitä.</>
  ),
  readFailed: "Hakuavainta ei voitu lukea.",
  reload: "Lataa uudelleen",
  // The dialog
  apiKey: (service: string) => `${service} API-avain`,
  getKey: (service: string) =>
    `Hae avain ${({ Brave: "Braven", Staan: "Staanin" } as Record<string, string>)[service] ?? service} sivulta`,
  notKey: "Tämä ei näytä hakuavaimelta.",
  saveNote:
    "Tallennus kokeilee avainta yhdellä haulla. Tallennettua avainta ei näytetä uudelleen.",
  checking: (service: string) => `Kokeillaan avainta palvelussa ${service}…`,
  rejected: (service: string) =>
    `Avainta ei tallennettu: ${service} ei hyväksynyt sitä koehaussa, joten se on väärin kirjoitettu tai peruttu.`,
  unavailable: (service: string) =>
    `Avainta ei tallennettu, koska palveluun ${service} ei saatu yhteyttä. Yritä hetken päästä uudelleen.`,
  limit: (service: string) =>
    `Avainta ei tallennettu, koska palvelun ${service} käyttöraja tuli vastaan. Yritä hetken päästä uudelleen.`,
  uncertain: "Muutoksen tulos ei varmistunut. Tila luettiin uudelleen.",
  cancel: "Peruuta",
  save: "Tallenna",
  more: "Käyttö ja säilytys",
};

export const webSearchText = catalog(fi, {
  search: "Web search",
  offered: "Offered",
  notOffered: "Not offered",
  notInUse: "Not in use",
  inUse: "In use",
  notAnswering: "Not answering",
  setKey: "Set key…",
  addKeyDots: "Add key…",
  keyMenu: "Key",
  keyMenuOf: (service) => `Search key: ${service}`,
  changeKeyDots: "Change key…",
  removeKey: "Remove key",
  siteRow: (suffix, date) => `Shared key …${suffix} · ${date}`,
  siteRowNone: "Web search. No shared key.",
  serviceOther: (service) =>
    `${service} is in use. A key here would replace it.`,
  replacesSite: (other) =>
    `Saving replaces the shared ${other} key, because search uses one service at a time. Copies of the ${other} key are replaced as when the key is changed.`,
  replacesOwn: (other) =>
    `Saving replaces your own ${other} key, because search uses one service at a time.`,
  siteDialog: (service) => `Shared ${service} key`,
  personDialog: (service) => `${service} key`,
  siteKeyState: (service, suffix, date) =>
    `${service} …${suffix}, taken into use ${date}.`,
  siteIntro:
    "Everyone without a search key of their own searches the web with this. Use is billed to you.",
  siteSaveNote:
    "Saving tries the key with one search and then gives it to those already joined. A saved key is not shown again.",
  giving: "Trying the key and giving it to those already joined…",
  siteRemoved:
    "Shared key removed. The copies already given stay as they were.",
  siteNative:
    "Models with web search of their own, such as a ChatGPT or Claude subscription, search on their own and do not use this key.",
  siteCopy:
    "Everyone gets a copy of the key in their home directory, and their agents can use it. A copy cannot be revoked except by changing the key on the search service's site.",
  siteJoined:
    "Those already joined receive the key at once, new people at their first sign-in.",
  siteLimit:
    "Everyone shares the key's monthly allowance. Searches beyond it are billed to you, or search stops if there is no billing.",
  siteReadFailed: "The shared search key could not be read.",
  given: {
    seeded: "received the key",
    replaced: "received a new key in place of the earlier one",
    already_current: "already had it",
    kept: "use their own key",
    not_reached: "not reached",
    unknown: "result not confirmed",
  },
  missed: " Those not reached receive the key when you save it again.",
  notGiven:
    "The key was saved, but it could not be given to those already joined. They receive it when you save the key again.",
  admins: (suffix) => `The administrator's key …${suffix}`,
  own: (suffix) => `Your own key …${suffix}`,
  addOwn: "Add your own key",
  replace: "Change key",
  remove: "Remove",
  refused: (service, day) =>
    `${service} refused the key at the last search on ${day}, so agents cannot search with it. The key may be revoked or its allowance used up.`,
  users: (needers, natives) =>
    (needers.length
      ? `${and(needers, "and")} models search with this key.`
      : "None of your models needs the key now.") +
    (natives.length
      ? ` ${and(natives, "and")} search${natives.length > 1 ? "" : "es"} on ${natives.length > 1 ? "their" : "its"} own.`
      : ""),
  usersUnknown: "Models without web search of their own search with this key.",
  tileNeed: (names) =>
    `${and(names, "and")} models cannot search the web without a key.`,
  tileCovered: (names) =>
    `${and(names, "and")} search${names.length > 1 ? "" : "es"} on ${names.length > 1 ? "their" : "its"} own, so no key is needed now.`,
  tileReplaces: (other) => `Would replace your ${other} key.`,
  tilePlain: "Web search for models without search of their own.",
  usedFor:
    "The key is used only with models that have no web search of their own. A ChatGPT or Claude subscription searches on its own.",
  goesTo: "The agent's search terms go to the chosen search service.",
  stored: (file) => (
    <>The key is saved in the file {file}, and your agents can use it.</>
  ),
  readFailed: "The search key could not be read.",
  reload: "Reload",
  apiKey: (service) => `${service} API key`,
  getKey: (service) => `Get a key from ${service}`,
  notKey: "This does not look like a search key.",
  saveNote:
    "Saving tries the key with one search. A saved key is not shown again.",
  checking: (service) => `Trying the key with ${service}…`,
  rejected: (service) =>
    `The key was not saved: ${service} did not accept it in the trial search, so it is mistyped or revoked.`,
  unavailable: (service) =>
    `The key was not saved because ${service} could not be reached. Try again in a moment.`,
  limit: (service) =>
    `The key was not saved because ${service}'s usage limit was reached. Try again in a moment.`,
  uncertain:
    "The result of the change was not confirmed. The state was read again.",
  cancel: "Cancel",
  save: "Save",
  more: "Use and storage",
});

```
