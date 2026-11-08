import { catalog, plural } from "../i18n";

// Stable view and file offer addresses: the copy button (components/ViewLink.tsx), the
// person's and the administrator's lists in Settings
// (app/ViewLinkSettings.tsx) and address errors (app/viewLinks.ts).
const fi = {
  viewGone: "Kohdetta ei enää ole. Agentti on ehkä poistanut sen.",
  linkGone: "Osoitetta ei enää ole: se on poistettu.",
  tooMany:
    "Sinulla on jo enimmäismäärä julkisia näkymiä ja tiedostoja. Tee jokin niistä yksityiseksi ensin.",
  tooManyAddresses:
    "Sinulla on jo enimmäismäärä osoitteita. Poista vanhoja asetusten kohdasta Näkymien ja tiedostojen osoitteet.",
  notPublic: "Kohde ei ole enää julkinen.",
  unavailable: "Tällä palvelimella ei voi nyt jakaa näkymiä eikä tiedostoja.",
  saveFailed: "Muutosta ei voitu tallentaa. Yritä uudelleen.",
  uncertain:
    "Muutoksen tulos jäi epäselväksi. Tila on luettu uudelleen; tarkista se ennen kuin yrität uudelleen.",
  removeFailed: "Osoitetta ei voitu poistaa. Yritä uudelleen.",
  busy: "Edellinen muutos on vielä kesken. Odota hetki.",
  days: (days: number) => `${days} ${days === 1 ? "päivä" : "päivää"}`,
  atMost: (days: string) => `${days} (enintään)`,
  copyLink: "Kopioi linkki",
  copied: "Kopioitu",
  copyBlocked: "Kopiointi estetty",
  addresses: "Näkymien ja tiedostojen osoitteet",
  addressesDesc:
    "Jokaisella omalle välilehdelle avaamallasi tai julkaisemallasi näkymällä ja tiedostolla on oma osoitteensa. Julkisen kohteen voi avata kuka tahansa, jolla osoite on, kirjautumatta. Poistettu osoite ei toimi enää koskaan; kohde itse säilyy.",
  noAddresses: "Näkymilläsi ja tiedostoillasi ei ole vielä osoitteita.",
  addressesUnknown: "Osoitteita ei voitu lukea. Yritä myöhemmin uudelleen.",
  isPrivate: "Vain sinä",
  publicUntil: (date: string) => `Julkinen ${date} asti`,
  paused: (date: string) =>
    `Julkinen ${date} asti, mutta palvelin ei nyt jaa mitään`,
  checking: "Tilaa tarkistetaan…",
  open: "Avaa",
  stop: "Tee yksityiseksi",
  remove: "Poista",
  removeTitle: "Poistetaanko osoite pysyvästi?",
  removeDesc: (title: string) =>
    `Kohteen ”${title}” osoite lakkaa toimimasta lopullisesti, myös kaikilta, joille olet sen antanut. Itse kohde säilyy. Jos avaat sen myöhemmin, se saa uuden osoitteen.`,
  removeConfirm: "Poista pysyvästi",
  cancel: "Peruuta",
  shared: "Jaetut linkit",
  deleteShort: "Poista",
  adminUnavailable: "Jaettuja linkkejä ei voitu ladata.",
  adminDesc:
    "Henkilöiden jakamat näkymät ja tiedostot. Kuka tahansa linkin saanut voi avata ne. Poista linkki, jota käytetään väärin: se lakkaa toimimasta pysyvästi.",
  adminOff: " Linkit eivät nyt ole käytössä tällä palvelimella.",
  adminNone: "Kukaan ei jaa nyt näkymiä eikä tiedostoja.",
  adminRow: (user: string, until: string) => `${user} · voimassa ${until} asti`,
};

export const viewLinksText = catalog(fi, {
  viewGone: "The item no longer exists. The agent may have removed it.",
  linkGone: "The address no longer exists: it has been removed.",
  tooMany:
    "You already have the maximum number of public views and files. Make one of them private first.",
  tooManyAddresses:
    "You already have the maximum number of addresses. Remove old ones in the settings under View and file addresses.",
  notPublic: "The item is no longer public.",
  unavailable: "Views and files cannot be shared on this server now.",
  saveFailed: "The change could not be saved. Try again.",
  uncertain:
    "The change's outcome is unclear. The state has been read again; check it before you try again.",
  removeFailed: "The address could not be removed. Try again.",
  busy: "The previous change is still on its way. Wait a moment.",
  days: (days) =>
    `${days} ${plural("en", days, { one: "day", other: "days" })}`,
  atMost: (days) => `${days} (at most)`,
  copyLink: "Copy link",
  copied: "Copied",
  copyBlocked: "Copying blocked",
  addresses: "View and file addresses",
  addressesDesc:
    "Every view and file you have opened in a tab of its own or published has an address of its own. Anyone who has a public item's address can open it without signing in. A removed address never works again; the item itself stays.",
  noAddresses: "Your views and files have no addresses yet.",
  addressesUnknown: "The addresses could not be read. Try again later.",
  isPrivate: "Only you",
  publicUntil: (date) => `Public until ${date}`,
  paused: (date) =>
    `Public until ${date}, but the server is not sharing anything now`,
  checking: "Checking the state…",
  open: "Open",
  stop: "Make private",
  remove: "Remove",
  removeTitle: "Remove the address for good?",
  removeDesc: (title) =>
    `The address of “${title}” stops working for good, also for everyone you gave it to. The item itself stays. If you open it later, it gets a new address.`,
  removeConfirm: "Remove for good",
  cancel: "Cancel",
  shared: "Shared links",
  deleteShort: "Remove",
  adminUnavailable: "Shared links could not be loaded.",
  adminDesc:
    "Views and files people have shared. Anyone who received the link can open them. Remove a link that is misused: it stops working for good.",
  adminOff: " Links are not in use on this server now.",
  adminNone: "Nobody is sharing any views or files now.",
  adminRow: (user, until) => `${user} · valid until ${until}`,
});
