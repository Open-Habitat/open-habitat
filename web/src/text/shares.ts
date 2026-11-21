import { catalog, formatNumber, plural } from "../i18n";

const fi = {
  title: "Tuotokset",
  summary: (pub: number, own: number, past: number) =>
    `${formatNumber(pub)} ${plural("fi", pub, { one: "julkinen", other: "julkista" })}, ${formatNumber(own)} vain sinulle, ${formatNumber(past)} ${plural("fi", past, { one: "päättynyt tai poistettu", other: "päättynyttä tai poistettua" })}`,
  filters: {
    all: "Kaikki",
    public: "Julkiset",
    private: "Vain sinä",
    past: "Päättyneet",
  },
  empty: "Ei vielä tuotoksia",
  emptyHelp:
    "Agentin antamat näkymät ja tiedostot löytyvät täältä, olivatpa ne vain sinulle tai jaettu linkillä.",
  loading: "Luetaan tuotoksia…",
  failed: "Tuotoksia ei voitu lukea.",
  retry: "Yritä uudelleen",
  gone: "Kohde poistettu",
  unknown: "Keskustelu ei ole saatavilla",
  archived: "arkistoitu",
  count: (n: number) =>
    `${formatNumber(n)} ${plural("fi", n, { one: "tuotos", other: "tuotosta" })}`,
  shared: (date: string) => `luotu ${date}`,
  from: "Keskustelusta",
  ended: (date: string) => `Julkisuus päättyi ${date}`,
  hint: "Kuka tahansa, jolla on osoite, voi avata kohteen julkisuuden päättymiseen asti.",
  address: "Jaon osoite",
  noMatches: "Ei tuotoksia tässä ryhmässä.",
};
export const sharesText = catalog(fi, {
  title: "Outputs",
  summary: (pub: number, own: number, past: number) =>
    `${formatNumber(pub)} public, ${formatNumber(own)} only for you, ${formatNumber(past)} expired or removed`,
  filters: {
    all: "All",
    public: "Public",
    private: "Only you",
    past: "Expired",
  },
  empty: "No outputs yet",
  emptyHelp:
    "Views and files the agent gives you appear here, whether private or shared by link.",
  loading: "Loading outputs…",
  failed: "Outputs could not be loaded.",
  retry: "Try again",
  gone: "Item removed",
  unknown: "Conversation unavailable",
  archived: "archived",
  count: (n: number) =>
    `${formatNumber(n)} ${plural("en-US", n, { one: "output", other: "outputs" })}`,
  shared: (date: string) => `created ${date}`,
  from: "From conversation",
  ended: (date: string) => `Publication ended ${date}`,
  hint: "Anyone with the address can open the item until its publication ends.",
  address: "Share address",
  noMatches: "No outputs in this group.",
});
