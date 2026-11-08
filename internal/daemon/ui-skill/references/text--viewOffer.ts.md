# text/viewOffer.ts

Generated from web/src/text/viewOffer.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// A view an agent offered in the conversation (components/ViewOffer.tsx).
const fi = {
  bytes: (n: number) => `${n} t`,
  kilobytes: (n: number) => `${n} kt`,
  megabytes: (n: string) => `${n} Mt`,
  label: (title: string) => `Agentin tarjoama näkymä: ${title}`,
  failed: "Näkymää ei voitu avata. Se on ehkä poistettu, tai yhteys katkesi.",
};

export const viewOfferText = catalog(fi, {
  bytes: (n) => `${n} B`,
  kilobytes: (n) => `${n} KB`,
  megabytes: (n) => `${n} MB`,
  label: (title) => `View offered by the agent: ${title}`,
  failed:
    "The view could not be opened. It may have been removed, or the connection was lost.",
});

```
