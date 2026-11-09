# text/shares.ts

Generated from web/src/text/shares.ts; do not edit.

```tsx
import { catalog, formatNumber, plural } from "../i18n";

const fi = {
  title: "Jaetut",
  summary: (pub: number, own: number, past: number) =>
    `${formatNumber(pub)} ${plural("fi", pub, { one: "julkinen", other: "julkista" })}, ${formatNumber(own)} vain sinulle, ${formatNumber(past)} ${plural("fi", past, { one: "päättynyt tai poistettu", other: "päättynyttä tai poistettua" })}`,
  filters: {
    all: "Kaikki",
    public: "Julkiset",
    private: "Vain sinä",
    past: "Päättyneet",
  },
  empty: "Et ole jakanut vielä mitään",
  emptyHelp:
    "Jaa näkymä tai tiedosto keskustelun kortin maapallosta. Löydät sen jälkeen osoitteen täältä.",
  loading: "Luetaan jakoja…",
  failed: "Jakoja ei voitu lukea.",
  retry: "Yritä uudelleen",
  gone: "Kohde poistettu",
  unknown: "Keskustelu ei ole saatavilla",
  archived: "arkistoitu",
  count: (n: number) =>
    `${formatNumber(n)} ${plural("fi", n, { one: "jako", other: "jakoa" })}`,
  shared: (date: string) => `jaettu ${date}`,
  from: "Keskustelusta",
  ended: (date: string) => `Julkisuus päättyi ${date}`,
  hint: "Kuka tahansa, jolla on osoite, voi avata kohteen julkisuuden päättymiseen asti.",
  address: "Jaon osoite",
  noMatches: "Ei jakoja tässä ryhmässä.",
};
export const sharesText = catalog(fi, {
  title: "Shares",
  summary: (pub: number, own: number, past: number) =>
    `${formatNumber(pub)} public, ${formatNumber(own)} only for you, ${formatNumber(past)} expired or removed`,
  filters: {
    all: "All",
    public: "Public",
    private: "Only you",
    past: "Expired",
  },
  empty: "You have not shared anything yet",
  emptyHelp:
    "Share a view or file using the globe on its conversation card. Its address will then appear here.",
  loading: "Loading shares…",
  failed: "Shares could not be loaded.",
  retry: "Try again",
  gone: "Item removed",
  unknown: "Conversation unavailable",
  archived: "archived",
  count: (n: number) =>
    `${formatNumber(n)} ${plural("en-US", n, { one: "share", other: "shares" })}`,
  shared: (date: string) => `shared ${date}`,
  from: "From conversation",
  ended: (date: string) => `Publication ended ${date}`,
  hint: "Anyone with the address can open the item until its publication ends.",
  address: "Share address",
  noMatches: "No shares in this group.",
});

```
