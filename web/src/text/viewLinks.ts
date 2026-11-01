import { catalog, plural } from "../i18n";

// Stable view addresses: the copy button (components/ViewLink.tsx), the
// person's and the administrator's lists in Settings
// (app/ViewLinkSettings.tsx) and address errors (app/viewLinks.ts).
const fi = {
  viewGone: "Näkymää ei enää ole. Agentti on ehkä poistanut sen.",
  linkGone: "Osoitetta ei enää ole: se on poistettu.",
  tooMany:
    "Sinulla on jo enimmäismäärä julkisia näkymiä. Tee jokin niistä yksityiseksi ensin.",
  tooManyAddresses:
    "Sinulla on jo enimmäismäärä näkymäosoitteita. Poista vanhoja asetusten kohdasta Näkymien osoitteet.",
  notPublic: "Näkymä ei ole enää julkinen.",
  unavailable: "Tällä palvelimella ei voi nyt jakaa näkymiä.",
  saveFailed: "Muutosta ei voitu tallentaa. Yritä uudelleen.",
  uncertain:
    "Muutoksen tulos jäi epäselväksi. Tila on luettu uudelleen; tarkista se ennen kuin yrität uudelleen.",
  removeFailed: "Osoitetta ei voitu poistaa. Yritä uudelleen.",
  days: (days: number) => `${days} ${days === 1 ? "päivä" : "päivää"}`,
  atMost: (days: string) => `${days} (enintään)`,
  copyLink: "Kopioi linkki",
  copied: "Kopioitu",
  copyBlocked: "Kopiointi estetty",
  addresses: "Näkymien osoitteet",
  addressesDesc:
    "Jokaisella avaamallasi näkymällä on oma osoitteensa. Julkisen näkymän voi avata kuka tahansa, jolla osoite on, kirjautumatta. Poistettu osoite ei toimi enää koskaan; näkymä itse säilyy.",
  noAddresses: "Näkymilläsi ei ole vielä osoitteita.",
  addressesUnknown: "Osoitteita ei voitu lukea. Yritä myöhemmin uudelleen.",
  isPrivate: "Vain sinä",
  publicUntil: (date: string) => `Julkinen ${date} asti`,
  paused: (date: string) =>
    `Julkinen ${date} asti, mutta palvelin ei nyt jaa näkymiä`,
  checking: "Tilaa tarkistetaan…",
  open: "Avaa",
  stop: "Tee yksityiseksi",
  remove: "Poista",
  removeTitle: "Poistetaanko osoite pysyvästi?",
  removeDesc: (title: string) =>
    `Näkymän ”${title}” osoite lakkaa toimimasta lopullisesti, myös kaikilta, joille olet sen antanut. Itse näkymä säilyy. Jos avaat sen myöhemmin, se saa uuden osoitteen.`,
  removeConfirm: "Poista pysyvästi",
  cancel: "Peruuta",
  shared: "Jaetut linkit",
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
  linkGone: "The address no longer exists: it has been removed.",
  tooMany:
    "You already have the maximum number of public views. Make one of them private first.",
  tooManyAddresses:
    "You already have the maximum number of view addresses. Remove old ones in the settings under View addresses.",
  notPublic: "The view is no longer public.",
  unavailable: "Views cannot be shared on this server now.",
  saveFailed: "The change could not be saved. Try again.",
  uncertain:
    "The change's outcome is unclear. The state has been read again; check it before you try again.",
  removeFailed: "The address could not be removed. Try again.",
  days: (days) =>
    `${days} ${plural("en", days, { one: "day", other: "days" })}`,
  atMost: (days) => `${days} (at most)`,
  copyLink: "Copy link",
  copied: "Copied",
  copyBlocked: "Copying blocked",
  addresses: "View addresses",
  addressesDesc:
    "Every view you have opened has an address of its own. Anyone who has a public view's address can open it without signing in. A removed address never works again; the view itself stays.",
  noAddresses: "Your views have no addresses yet.",
  addressesUnknown: "The addresses could not be read. Try again later.",
  isPrivate: "Only you",
  publicUntil: (date) => `Public until ${date}`,
  paused: (date) =>
    `Public until ${date}, but the server is not sharing views now`,
  checking: "Checking the state…",
  open: "Open",
  stop: "Make private",
  remove: "Remove",
  removeTitle: "Remove the address for good?",
  removeDesc: (title) =>
    `The address of the view “${title}” stops working for good, also for everyone you gave it to. The view itself stays. If you open it later, it gets a new address.`,
  removeConfirm: "Remove for good",
  cancel: "Cancel",
  shared: "Shared links",
  deleteShort: "Remove",
  adminUnavailable: "Shared links could not be loaded.",
  adminDesc:
    "Views people have shared. Anyone who received the link can open them. Remove a link that is misused: it stops working for good.",
  adminOff: " Links are not in use on this server now.",
  adminNone: "Nobody is sharing any views now.",
  adminRow: (user, until) => `${user} · valid until ${until}`,
});
