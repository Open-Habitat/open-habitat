import { catalog, plural } from "../i18n";

// The settings search (components/SettingsSearch.tsx).
const fi = {
  summary: (n: number) =>
    n === 0 ? "Ei osumia" : n === 1 ? "1 osuma" : `${n} osumaa`,
  search: "Hae asetuksista",
  clear: "Tyhjennä haku",
  noneBefore: "Ei osumia haulle",
  noneAfter: ". Kokeile toista sanaa.",
  results: "Hakutulokset",
  matched: "osui:",
};

export const settingsSearchText = catalog(fi, {
  summary: (n) =>
    n === 0
      ? "No matches"
      : `${n} ${plural("en", n, { one: "match", other: "matches" })}`,
  search: "Search settings",
  clear: "Clear search",
  noneBefore: "No matches for",
  noneAfter: ". Try another word.",
  results: "Search results",
  matched: "matched:",
});
