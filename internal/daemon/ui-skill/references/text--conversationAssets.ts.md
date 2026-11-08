# text/conversationAssets.ts

Generated from web/src/text/conversationAssets.ts; do not edit.

```tsx
import { catalog, plural } from "../i18n";

// The conversation's views and files (components/ConversationAssets.tsx):
// the chip beside the workers above the message field and its list.
const fi = {
  chip: (views: number, files: number) =>
    `Näkymät ${views}, tiedostot ${files}`,
  title: "Keskustelun näkymät ja tiedostot",
  list: "Näkymät ja tiedostot",
  close: "Sulje",
  versions: (n: number) => `${n} versiota`,
  showVersions: "Näytä aiemmat versiot",
  hideVersions: "Piilota aiemmat versiot",
  version: (n: number) => `Versio ${n}`,
  locate: "Näytä keskustelussa",
  notLoaded:
    "Kortti on keskustelun vanhemmassa osassa. Vieritä keskustelua ylös, niin se latautuu.",
  unavailable: "Tiedostoja ei saatu juuri nyt.",
  files: (n: number) => (n === 1 ? "1 tiedosto" : `${n} tiedostoa`),
};

export const conversationAssetsText = catalog(fi, {
  chip: (views, files) => `Views ${views}, files ${files}`,
  title: "The conversation's views and files",
  list: "Views and files",
  close: "Close",
  versions: (n) => `${n} versions`,
  showVersions: "Show earlier versions",
  hideVersions: "Hide earlier versions",
  version: (n) => `Version ${n}`,
  locate: "Show in the conversation",
  notLoaded:
    "The card is in an earlier part of the conversation. Scroll the conversation up and it loads.",
  unavailable: "The files could not be fetched just now.",
  files: (n) => `${n} ${plural("en", n, { one: "file", other: "files" })}`,
});

```
