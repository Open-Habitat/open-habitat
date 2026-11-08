import { catalog } from "../i18n";

// One offer card for every kind an agent offers (components/OfferCard.tsx):
// a view, a file, a table, an image, a document or a folder. The card opens
// its item beside the conversation and closes it again; its own icons
// publish, open a tab of its own and download.
const fi = {
  open: (title: string) => `Avaa viereen: ${title}`,
  close: (title: string) => `Sulje: ${title}`,
  openHint: "Avaa viereen",
  closeHint: "Sulje paneeli",
  actions: (title: string) => `Toiminnot: ${title}`,
  public: "Julkinen",
  publicHint: (date: string) =>
    `Julkinen ${date} asti. Paina, niin vain sinä näet tämän.`,
  privateHint: (length: string) =>
    `Vain sinulle. Paina, niin se on julkinen ${length}: kuka tahansa linkin saanut voi avata sen.`,
  unknownHint: "Tilaa ei juuri nyt tiedetä. Se tarkistetaan uudelleen.",
  until: (date: string) => `${date} asti`,
  untilHint: (date: string) => `Julkinen ${date} asti. Paina muuttaaksesi.`,
  duration: "Julkisena",
  durationHead: (date: string) =>
    `Nyt ${date} asti. Uusi aika lasketaan tästä hetkestä.`,
  openTab: "Avaa omalle välilehdelle",
  download: "Lataa",
  downloadZip: "Lataa (.zip)",
  downloadAll: "Lataa kaikki (.zip)",
  onlyYou: "Vain sinulle",
  publicUntil: (date: string) => `Julkinen ${date} asti`,
  view: "Näkymä",
  folder: (name: string) => `Kansio ${name}/`,
  failed: "Kohdetta ei voitu avata. Se on ehkä poistettu, tai yhteys katkesi.",
  removed: "Poistettu. Tiedosto ei ole enää ladattavissa.",
  unavailable: "Tiedoston tietoja ei saatu juuri nyt. Lataa sivu uudelleen.",
};

export const offerCardText = catalog(fi, {
  open: (title) => `Open beside: ${title}`,
  close: (title) => `Close: ${title}`,
  openHint: "Open beside",
  closeHint: "Close the panel",
  actions: (title) => `Actions: ${title}`,
  public: "Public",
  publicHint: (date) =>
    `Public until ${date}. Press, and only you will see it.`,
  privateHint: (length) =>
    `Only for you. Press, and it is public for ${length}: anyone who receives the link can open it.`,
  unknownHint: "The state is not known right now. It will be checked again.",
  until: (date) => `until ${date}`,
  untilHint: (date) => `Public until ${date}. Press to change.`,
  duration: "Public for",
  durationHead: (date) =>
    `Now until ${date}. The new time counts from this moment.`,
  openTab: "Open in a new tab",
  download: "Download",
  downloadZip: "Download (.zip)",
  downloadAll: "Download all (.zip)",
  onlyYou: "Only for you",
  publicUntil: (date) => `Public until ${date}`,
  view: "View",
  folder: (name) => `Folder ${name}/`,
  failed:
    "The item could not be opened. It may have been removed, or the connection was lost.",
  removed: "Removed. The file can no longer be downloaded.",
  unavailable:
    "The file's details could not be fetched just now. Reload the page.",
});
