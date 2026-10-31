import { catalog, plural } from "../i18n";

// The clone page's catalog arrangement (components/repoCatalog.ts): the
// time filter, sizes and push times. Section kinds are identifiers there and
// get their labels in clonePage.ts.
const fi = {
  since: { "0": "Kaikki", "30": "30 pv", "90": "3 kk", "365": "Vuosi" },
  noPush: "ei pushia",
  today: (time: string) => `tänään klo ${time}`,
  yesterday: "eilen",
  daysAgo: (n: number) => `${n} pv sitten`,
};

export const repoCatalogText = catalog(fi, {
  since: { "0": "All", "30": "30 days", "90": "3 months", "365": "Year" },
  noPush: "no push",
  today: (time) => `today at ${time}`,
  yesterday: "yesterday",
  daysAgo: (n) => `${n} ${plural("en", n, { one: "day", other: "days" })} ago`,
});
