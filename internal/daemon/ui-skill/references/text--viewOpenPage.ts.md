# text/viewOpenPage.ts

Generated from web/src/text/viewOpenPage.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// A view opened in a tab of its own, or at its stable address
// (app/ViewOpenPage.tsx).
const fi = {
  failed:
    "Näkymää ei voitu avata. Se on ehkä poistettu, tai olet kirjautunut ulos. Avaa se uudelleen Habitatista.",
  opening: "Avataan näkymää…",
  signIn: "Kirjaudu sisään avataksesi näkymän.",
  signInAction: "Kirjaudu GitHubilla",
  unavailable: "Tämä näkymä ei ole saatavilla.",
};

export const viewOpenPageText = catalog(fi, {
  failed:
    "The view could not be opened. It may have been removed, or you have signed out. Open it again from Habitat.",
  opening: "Opening the view…",
  signIn: "Sign in to open the view.",
  signInAction: "Sign in with GitHub",
  unavailable: "This view is not available.",
});

```
