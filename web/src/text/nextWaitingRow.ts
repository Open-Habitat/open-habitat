import { catalog, plural } from "../i18n";

// The line offering the conversations that wait for the person
// (components/NextWaitingRow.tsx).
const fi = {
  walk: "Käy läpi sinua odottavat",
  meanwhile: "Sillä aikaa",
  waiting: (n: number) => `${n} odottaa sinua`,
  go: "Käy läpi",
};

export const nextWaitingRowText = catalog(fi, {
  walk: "Go through the ones waiting for you",
  meanwhile: "Meanwhile",
  waiting: (n) =>
    `${n} ${plural("en", n, { one: "is", other: "are" })} waiting for you`,
  go: "Go through",
});
