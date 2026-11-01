# text/integrationOnboarding.ts

Generated from web/src/text/integrationOnboarding.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// One integration step of onboarding (app/IntegrationOnboarding.tsx). The
// provider's name and its Finnish genitive come from the integrations
// catalog; English needs only the name.
const fi = {
  eyebrow: "Käyttöönotto",
  title: (name: string) => `Yhdistä ${name}`,
  required: (_name: string, gen: string) =>
    `Ylläpitäjä pyytää yhdistämään ${gen} tilin ennen jatkamista, jotta agenttisi voivat käyttää sen tietoja.`,
  optional: (_name: string, gen: string, place: string) =>
    `Agenttisi voivat käyttää ${gen} tietoja. Voit myös jatkaa ilman ja yhdistää tilin myöhemmin kohdassa Asetukset › ${place}.`,
  continue: "Jatka",
  continueWithout: "Jatka ilman tiliä",
};

export const integrationOnboardingText = catalog(fi, {
  eyebrow: "Getting started",
  title: (name) => `Connect ${name}`,
  required: (name) =>
    `The administrator asks you to connect your ${name} account before continuing, so your agents can use its data.`,
  optional: (name, _gen, place) =>
    `Your agents can use data from ${name}. You can also continue without it and connect the account later in Settings › ${place}.`,
  continue: "Continue",
  continueWithout: "Continue without an account",
});

```
