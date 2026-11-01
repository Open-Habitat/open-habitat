# text/viewLinks.ts

Generated from web/src/text/viewLinks.ts; do not edit.

```tsx
import { catalog, plural } from "../i18n";

// Stable view addresses shared as links: the share dialog
// (components/ViewLink.tsx), the person's and the administrator's lists in
// Settings (app/ViewLinkSettings.tsx) and their errors (app/viewLinks.ts).
const fi = {
  viewGone: "Näkymää ei enää ole. Agentti on ehkä poistanut sen.",
  linkGone: "Linkkiä ei enää ole: se on poistettu.",
  tooMany:
    "Sinulla on jo enimmäismäärä jaettuja näkymiä. Lopeta jonkin jakaminen ensin.",
  tooManyAddresses:
    "Sinulla on jo enimmäismäärä näkymäosoitteita. Poista jokin vanha ensin.",
  notPublic: "Näkymää ei enää jaeta. Jaa se uudelleen.",
  unavailable: "Tällä palvelimella ei voi nyt jakaa linkkejä.",
  saveFailed: "Linkkiä ei voitu tallentaa. Yritä uudelleen.",
  removeFailed: "Linkkiä ei voitu poistaa. Yritä uudelleen.",
  days: (days: number) => `${days} ${days === 1 ? "päivä" : "päivää"}`,
  terms:
    "Kuka tahansa, jolla on linkki, voi avata näkymän kirjautumatta. Jakamisen lopettaminen ei peru sitä, mitä on jo avattu tai kopioitu, ja jos jaat näkymän uudelleen, sama linkki toimii taas.",
  copyLink: "Kopioi linkki",
  copied: "Kopioitu",
  copyBlocked: "Kopiointi estetty: valitse osoite",
  saveFailedShort: "Linkkiä ei voitu tallentaa.",
  atMost: (days: string) => `${days} (enintään)`,
  valid: "Voimassa",
  share: "Jaa linkillä",
  files: (n: number) => (n === 1 ? "1 tiedosto" : `${n} tiedostoa`),
  revoked:
    "Jakaminen on lopetettu. Linkki ei avaa näkymää, ennen kuin jaat sen uudelleen.",
  creating: "Luodaan…",
  create: "Luo linkki",
  link: "Linkki",
  extend: "Jatka",
  extendHint: "Jatka voimassaoloa tästä päivästä",
  remove: "Lopeta jakaminen",
  close: "Sulje",
  shared: "Jaetut linkit",
  none: "Et jaa nyt näkymiä. Jaa näkymä sen kortin painikkeella Jaa linkillä.",
  validUntil: (date: string) => `Voimassa ${date} asti`,
  removeShort: "Lopeta",
  deleteShort: "Poista",
  adminUnavailable: "Jaettuja linkkejä ei voitu ladata.",
  adminDesc:
    "Henkilöiden jakamat näkymät. Kuka tahansa linkin saanut voi avata ne. Poista linkki, jota käytetään väärin: se lakkaa toimimasta pysyvästi.",
  adminOff: " Linkit eivät nyt ole käytössä tällä palvelimella.",
  adminNone: "Kukaan ei jaa nyt näkymiä.",
  adminRow: (user: string, until: string) => `${user} · voimassa ${until} asti`,
};

export const viewLinksText = catalog(fi, {
  viewGone: "The view no longer exists. The agent may have removed it.",
  linkGone: "The link no longer exists: it has been removed.",
  tooMany:
    "You already share the maximum number of views. Stop sharing one first.",
  tooManyAddresses:
    "You already have the maximum number of view addresses. Remove an old one first.",
  notPublic: "The view is no longer shared. Share it again.",
  unavailable: "Links cannot be shared on this server now.",
  saveFailed: "The link could not be saved. Try again.",
  removeFailed: "The link could not be removed. Try again.",
  days: (days) =>
    `${days} ${plural("en", days, { one: "day", other: "days" })}`,
  terms:
    "Anyone who has the link can open the view without signing in. Stopping sharing does not undo what has already been opened or copied, and if you share the view again, the same link works again.",
  copyLink: "Copy link",
  copied: "Copied",
  copyBlocked: "Copying blocked: select the address",
  saveFailedShort: "The link could not be saved.",
  atMost: (days) => `${days} (at most)`,
  valid: "Valid",
  share: "Share with a link",
  files: (n) => `${n} ${plural("en", n, { one: "file", other: "files" })}`,
  revoked:
    "Sharing has stopped. The link does not open the view until you share it again.",
  creating: "Creating…",
  create: "Create link",
  link: "Link",
  extend: "Extend",
  extendHint: "Extend validity from today",
  remove: "Stop sharing",
  close: "Close",
  shared: "Shared links",
  none: "You are not sharing any views now. Share a view with its card's Share with a link button.",
  validUntil: (date) => `Valid until ${date}`,
  removeShort: "Stop",
  deleteShort: "Remove",
  adminUnavailable: "Shared links could not be loaded.",
  adminDesc:
    "Views people have shared. Anyone who received the link can open them. Remove a link that is misused: it stops working for good.",
  adminOff: " Links are not in use on this server now.",
  adminNone: "Nobody is sharing any views now.",
  adminRow: (user, until) => `${user} · valid until ${until}`,
});

```
