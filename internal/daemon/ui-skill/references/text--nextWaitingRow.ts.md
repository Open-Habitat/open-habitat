# text/nextWaitingRow.ts

Generated from web/src/text/nextWaitingRow.ts; do not edit.

```tsx
import { catalog, plural } from "../i18n";

// The line offering the conversations that wait for the person
// (components/NextWaitingRow.tsx).
const fi = {
  meanwhile: "Sillä aikaa",
  waiting: (n: number) => `${n} odottaa sinua`,
  go: "Avaa seuraava",
};

export const nextWaitingRowText = catalog(fi, {
  meanwhile: "Meanwhile",
  waiting: (n) =>
    `${n} ${plural("en", n, { one: "is", other: "are" })} waiting for you`,
  go: "Open next",
});

```
