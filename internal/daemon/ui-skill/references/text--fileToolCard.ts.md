# text/fileToolCard.ts

Generated from web/src/text/fileToolCard.ts; do not edit.

```tsx
import { catalog, plural } from "../i18n";

// A file tool's result in a conversation (components/FileToolCard.tsx):
// read, write and edit cards and their one-line stat.
const fi = {
  change: (n: number) => `⋯ muutos ${n}`,
  failed: "Työkalu epäonnistui.",
  copyContent: "Kopioi sisältö",
  removed: "poistettu: ",
  added: "lisätty: ",
  copyNewText: "Kopioi uusi teksti",
  copyNewTexts: "Kopioi uudet tekstit",
  copyDiff: "Kopioi diffi",
  lines: (n: number) => `${n} riviä`,
  newFile: (n: number) => `uusi · ${n} riviä`,
};

export const fileToolCardText = catalog(fi, {
  change: (n) => `⋯ change ${n}`,
  failed: "The tool failed.",
  copyContent: "Copy content",
  removed: "removed: ",
  added: "added: ",
  copyNewText: "Copy new text",
  copyNewTexts: "Copy new texts",
  copyDiff: "Copy diff",
  lines: (n) => `${n} ${plural("en", n, { one: "line", other: "lines" })}`,
  newFile: (n) =>
    `new · ${n} ${plural("en", n, { one: "line", other: "lines" })}`,
});

```
