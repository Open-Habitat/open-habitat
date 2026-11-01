# text/cloneProgress.ts

Generated from web/src/text/cloneProgress.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// A clone's progress line (components/cloneProgress.ts). Percentages refer
// to Git stages; the sizes come in already formatted.
const fi = {
  receiving: "Haetaan",
  finishing: "Viimeistellään",
  connecting: "Yhdistetään",
  percent: (n: number) => ` ${n} %`,
};

export const cloneProgressCopy = catalog(fi, {
  receiving: "Receiving",
  finishing: "Finishing",
  connecting: "Connecting",
  percent: (n) => ` ${n}%`,
});

```
