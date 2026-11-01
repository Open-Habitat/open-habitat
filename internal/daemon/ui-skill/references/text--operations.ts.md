# text/operations.ts

Generated from web/src/text/operations.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// A capability notice, an operation's progress and a form's error summary
// (components/Operations.tsx).
const fi = {
  capability: {
    unsupported: "Ei tuettu",
    unknown: "Ei vielä tiedossa",
    temporarilyUnavailable: "Tilapäisesti poissa käytöstä",
  },
  observed: (at: string) => ` Havaittu ${at}.`,
  reobserve: "Havaitse uudelleen",
  operation: {
    pending: "Odottaa",
    running: "Käynnissä",
    succeeded: "Onnistui",
    failed: "Epäonnistui",
    partial: "Osittainen",
    unknown: "Tila ei tiedossa",
  },
  stage: {
    pending: "Odottaa",
    running: "Käynnissä",
    succeeded: "Onnistui",
    failed: "Epäonnistui",
    unknown: "Ei tiedossa",
    skipped: "Ohitettu",
  },
  close: "Sulje näkymä — operaatio jatkuu",
  title: "Operaation eteneminen",
  observation: (age: string) => `Havainto: ${age}`,
  effects: "Vaikutukset",
  retry: "Yritä tuoreesta havainnosta",
  fix: "Korjaa seuraavat tiedot",
};

export const operationsText = catalog(fi, {
  capability: {
    unsupported: "Not supported",
    unknown: "Not known yet",
    temporarilyUnavailable: "Temporarily unavailable",
  },
  observed: (at) => ` Observed ${at}.`,
  reobserve: "Check again",
  operation: {
    pending: "Waiting",
    running: "Running",
    succeeded: "Succeeded",
    failed: "Failed",
    partial: "Partial",
    unknown: "State unknown",
  },
  stage: {
    pending: "Waiting",
    running: "Running",
    succeeded: "Succeeded",
    failed: "Failed",
    unknown: "Unknown",
    skipped: "Skipped",
  },
  close: "Close the view — the operation continues",
  title: "Operation progress",
  observation: (age) => `Observed: ${age}`,
  effects: "Effects",
  retry: "Retry from a fresh observation",
  fix: "Correct the following",
});

```
