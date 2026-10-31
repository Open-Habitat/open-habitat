import { catalog, plural } from "../i18n";

// Shared view links: the share dialog (components/ViewLink.tsx), the
// person's and the administrator's lists in Settings
// (app/ViewLinkSettings.tsx) and their errors (app/viewLinks.ts).
const fi = {
  viewGone: "Näkymää ei enää ole. Agentti on ehkä poistanut sen.",
  linkGone: "Linkkiä ei enää ole: se on vanhentunut tai poistettu.",
  tooMany: "Sinulla on jo enimmäismäärä linkkejä. Poista jokin vanha ensin.",
  unavailable: "Tällä palvelimella ei voi jakaa linkkejä.",
  saveFailed: "Linkkiä ei voitu tallentaa. Yritä uudelleen.",
  removeFailed: "Linkkiä ei voitu poistaa. Yritä uudelleen.",
  days: (days: number) => `${days} ${days === 1 ? "päivä" : "päivää"}`,
  terms:
    "Kuka tahansa, jolla on linkki, voi avata näkymän kirjautumatta. Linkin poistaminen ei peru sitä, mitä on jo avattu tai kopioitu.",
  copyLink: "Kopioi linkki",
  copied: "Kopioitu",
  copyBlocked: "Kopiointi estetty: valitse osoite",
  saveFailedShort: "Linkkiä ei voitu tallentaa.",
  atMost: (days: string) => `${days} (enintään)`,
  valid: "Voimassa",
  share: "Jaa linkillä",
  files: (n: number) => (n === 1 ? "1 tiedosto" : `${n} tiedostoa`),
  revoked: "Linkki on poistettu. Kukaan ei voi enää avata näkymää sillä.",
  creating: "Luodaan…",
  create: "Luo linkki",
  link: "Linkki",
  extend: "Jatka",
  extendHint: "Jatka voimassaoloa tästä päivästä",
  repoint: "Vaihda sisältö",
  repointHint: "Vaihda sisältö: sama osoite näyttää toisen näkymäsi",
  chooseView: "Valitse näkymä…",
  readdress: "Uusi osoite",
  readdressHint: "Uusi osoite: vanha linkki lakkaa toimimasta, sisältö pysyy.",
  remove: "Poista linkki",
  close: "Sulje",
  shared: "Jaetut linkit",
  none: "Et ole jakanut näkymiä. Jaa näkymä sen kortin painikkeella Jaa linkillä.",
  validUntil: (date: string) => `Voimassa ${date} asti`,
  removeShort: "Poista",
  adminUnavailable: "Jaettuja linkkejä ei voitu ladata.",
  adminDesc:
    "Henkilöiden jakamat näkymät. Kuka tahansa linkin saanut voi avata ne. Poista linkki, jota käytetään väärin.",
  adminOff: " Linkit eivät nyt ole käytössä tällä palvelimella.",
  adminNone: "Kukaan ei ole jakanut näkymiä.",
  adminRow: (user: string, shared: string, until: string) =>
    `${user} · jaettu ${shared} · voimassa ${until} asti`,
};

export const viewLinksText = catalog(fi, {
  viewGone: "The view no longer exists. The agent may have removed it.",
  linkGone: "The link no longer exists: it has expired or been removed.",
  tooMany:
    "You already have the maximum number of links. Remove an old one first.",
  unavailable: "Links cannot be shared on this server.",
  saveFailed: "The link could not be saved. Try again.",
  removeFailed: "The link could not be removed. Try again.",
  days: (days) =>
    `${days} ${plural("en", days, { one: "day", other: "days" })}`,
  terms:
    "Anyone who has the link can open the view without signing in. Removing the link does not undo what has already been opened or copied.",
  copyLink: "Copy link",
  copied: "Copied",
  copyBlocked: "Copying blocked: select the address",
  saveFailedShort: "The link could not be saved.",
  atMost: (days) => `${days} (at most)`,
  valid: "Valid",
  share: "Share with a link",
  files: (n) => `${n} ${plural("en", n, { one: "file", other: "files" })}`,
  revoked:
    "The link has been removed. Nobody can open the view with it any more.",
  creating: "Creating…",
  create: "Create link",
  link: "Link",
  extend: "Extend",
  extendHint: "Extend validity from today",
  repoint: "Change content",
  repointHint: "Change content: the same address shows another of your views",
  chooseView: "Choose a view…",
  readdress: "New address",
  readdressHint: "New address: the old link stops working, the content stays.",
  remove: "Remove link",
  close: "Close",
  shared: "Shared links",
  none: "You have not shared any views. Share a view with its card's Share with a link button.",
  validUntil: (date) => `Valid until ${date}`,
  removeShort: "Remove",
  adminUnavailable: "Shared links could not be loaded.",
  adminDesc:
    "Views people have shared. Anyone who received the link can open them. Remove a link that is misused.",
  adminOff: " Links are not in use on this server now.",
  adminNone: "Nobody has shared any views.",
  adminRow: (user, shared, until) =>
    `${user} · shared ${shared} · valid until ${until}`,
});
