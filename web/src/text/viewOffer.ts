import { catalog, plural } from "../i18n";

// A view an agent offered in the conversation (components/ViewOffer.tsx).
const fi = {
  bytes: (n: number) => `${n} t`,
  kilobytes: (n: number) => `${n} kt`,
  megabytes: (n: string) => `${n} Mt`,
  label: (title: string) => `Agentin tarjoama näkymä: ${title}`,
  offers: "Agentti tarjoaa näytettäväksi:",
  frozen: "Jäädytetty HTML",
  files: (n: number) => (n === 1 ? "1 tiedosto" : `${n} tiedostoa`),
  sharedUntil: (date: string) => `Jaettu linkillä ${date} asti`,
  onlyYou: "Vain sinulle",
  open: "Avaa",
  openTab: "Avaa omalle välilehdelle",
  share: "Jaa linkillä",
  tabRequested:
    "Avaus pyydetty. Jos välilehteä ei näy, selain saattoi estää sen.",
  failed: "Näkymää ei voitu avata. Se on ehkä poistettu, tai yhteys katkesi.",
};

export const viewOfferText = catalog(fi, {
  bytes: (n) => `${n} B`,
  kilobytes: (n) => `${n} KB`,
  megabytes: (n) => `${n} MB`,
  label: (title) => `View offered by the agent: ${title}`,
  offers: "The agent offers a view:",
  frozen: "Frozen HTML",
  files: (n) => `${n} ${plural("en", n, { one: "file", other: "files" })}`,
  sharedUntil: (date) => `Shared with a link until ${date}`,
  onlyYou: "Only for you",
  open: "Open",
  openTab: "Open in a new tab",
  share: "Share with a link",
  tabRequested:
    "Opening requested. If no tab appears, the browser may have blocked it.",
  failed:
    "The view could not be opened. It may have been removed, or the connection was lost.",
});
