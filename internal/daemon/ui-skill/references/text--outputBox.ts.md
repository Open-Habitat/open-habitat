# text/outputBox.ts

Generated from web/src/text/outputBox.ts; do not edit.

```tsx
import { catalog, plural } from "../i18n";

// A command's or tool's output (components/OutputBox.tsx): its views,
// controls and the full-window dialog.
const fi = {
  copyOutput: "Kopioi tuloste",
  lines: (n: number) => `${n} riviä`,
  hiddenLines: (n: number) => `${n} riviä välistä · Näytä kaikki`,
  actions: "Tulosteen toiminnot",
  copied: "Tuloste kopioitu",
  view: "Näkymä",
  edges: "Alku ja loppu",
  scroll: "Vieritettävä ikkuna",
  all: "Kaikki rivit",
  go: "Siirry",
  top: "Alkuun",
  bottom: "Loppuun",
  noWrap: "Älä rivitä pitkiä rivejä",
  wrap: "Rivitä pitkät rivit",
  window: "Avaa omassa ikkunassa",
  output: "Tuloste",
  copy: "Kopioi",
  close: "Sulje",
};

const lines = (n: number) =>
  `${n} ${plural("en", n, { one: "line", other: "lines" })}`;

export const outputBoxText = catalog(fi, {
  copyOutput: "Copy output",
  lines,
  hiddenLines: (n) => `${lines(n)} in between · Show all`,
  actions: "Output actions",
  copied: "Output copied",
  view: "View",
  edges: "Start and end",
  scroll: "Scrolling window",
  all: "All lines",
  go: "Go to",
  top: "To the top",
  bottom: "To the end",
  noWrap: "Don't wrap long lines",
  wrap: "Wrap long lines",
  window: "Open in its own window",
  output: "Output",
  copy: "Copy",
  close: "Close",
});

```
