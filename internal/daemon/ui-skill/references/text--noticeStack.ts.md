# text/noticeStack.ts

Generated from web/src/text/noticeStack.ts; do not edit.

```tsx
import { catalog, formatNumber } from "../i18n";

const fi = {
  more: (n: number) =>
    `Näytä ${formatNumber(n)} muu${n === 1 ? " ilmoitus" : "ta ilmoitusta"}`,
  less: "Näytä vähemmän",
};
export const noticeStackText = catalog(fi, {
  more: (n) => `Show ${formatNumber(n)} more notice${n === 1 ? "" : "s"}`,
  less: "Show less",
});

```
