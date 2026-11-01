# text/accountProfileOnboarding.ts

Generated from web/src/text/accountProfileOnboarding.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The step that completes a profile GitHub left short
// (app/AccountProfileOnboarding.tsx).
const fi = {
  title: "Täydennä tilisi tiedot",
  intro:
    "GitHub ei antanut kaikkia tietoja. Sähköpostia ehdotetaan myös Git-commitien tekijätietoihin.",
  name: "Nimi",
  email: "Sähköposti",
  saveFailed: "Tietoja ei voitu tallentaa. Tarkista tiedot ja yritä uudelleen.",
  saving: "Tallennetaan…",
  continue: "Jatka",
  skip: "Jatka ilman tietoja",
};

export const accountProfileOnboardingText = catalog(fi, {
  title: "Complete your account details",
  intro:
    "GitHub did not provide all the details. The email is also suggested as the author of your Git commits.",
  name: "Name",
  email: "Email",
  saveFailed: "The details could not be saved. Check them and try again.",
  saving: "Saving…",
  continue: "Continue",
  skip: "Continue without them",
});

```
