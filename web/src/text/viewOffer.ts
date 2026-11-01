import { catalog } from "../i18n";

// A view an agent offered in the conversation (components/ViewOffer.tsx).
const fi = {
  bytes: (n: number) => `${n} t`,
  kilobytes: (n: number) => `${n} kt`,
  megabytes: (n: string) => `${n} Mt`,
  label: (title: string) => `Agentin tarjoama näkymä: ${title}`,
  open: "Avaa",
  openTab: "Avaa omalle välilehdelle",
  public: "Julkinen",
  publicHint: "Kuka tahansa, jolla linkki on, voi avata näkymän kirjautumatta.",
  privateHint:
    "Vain sinä näet näkymän. Kytke päälle, niin kuka tahansa linkin saanut voi avata sen.",
  unknownHint: "Näkymän tilaa ei juuri nyt tiedetä. Se tarkistetaan uudelleen.",
  until: (date: string) => `${date} asti`,
  untilHint: (date: string) => `Julkinen ${date} asti. Paina muuttaaksesi.`,
  duration: "Julkisena",
  durationHead: (date: string) =>
    `Nyt ${date} asti. Uusi aika lasketaan tästä hetkestä.`,
  failed: "Näkymää ei voitu avata. Se on ehkä poistettu, tai yhteys katkesi.",
};

export const viewOfferText = catalog(fi, {
  bytes: (n) => `${n} B`,
  kilobytes: (n) => `${n} KB`,
  megabytes: (n) => `${n} MB`,
  label: (title) => `View offered by the agent: ${title}`,
  open: "Open",
  openTab: "Open in a new tab",
  public: "Public",
  publicHint: "Anyone who has the link can open the view without signing in.",
  privateHint:
    "Only you see the view. Switch on, and anyone who receives the link can open it.",
  unknownHint:
    "The view's state is not known right now. It will be checked again.",
  until: (date) => `until ${date}`,
  untilHint: (date) => `Public until ${date}. Press to change.`,
  duration: "Public for",
  durationHead: (date) =>
    `Now until ${date}. The new time counts from this moment.`,
  failed:
    "The view could not be opened. It may have been removed, or the connection was lost.",
});
