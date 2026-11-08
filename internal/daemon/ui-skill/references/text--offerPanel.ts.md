# text/offerPanel.ts

Generated from web/src/text/offerPanel.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// A file offer opened beside the conversation (components/OfferPanel.tsx),
// and the same item in a tab of its own (app/OfferOpenPage.tsx).
const fi = {
  panel: (title: string) => `Tiedosto: ${title}`,
  close: "Sulje",
  back: (folder: string) => `Takaisin: ${folder}`,
  loading: "Ladataan…",
  removed: "Tiedosto on poistettu.",
  unavailable: "Tiedoston tietoja ei saatu juuri nyt.",
  opening: "Avataan…",
  failed:
    "Tiedostoa ei voitu avata. Se on ehkä poistettu, tai olet kirjautunut ulos. Avaa se uudelleen Habitatista.",
  signIn: "Kirjaudu sisään avataksesi tiedoston.",
  signInAction: "Kirjaudu GitHubilla",
};

export const offerPanelText = catalog(fi, {
  panel: (title) => `File: ${title}`,
  close: "Close",
  back: (folder) => `Back: ${folder}`,
  loading: "Loading…",
  removed: "The file has been removed.",
  unavailable: "The file's details could not be fetched just now.",
  opening: "Opening…",
  failed:
    "The file could not be opened. It may have been removed, or you have signed out. Open it again from Habitat.",
  signIn: "Sign in to open the file.",
  signInAction: "Sign in with GitHub",
});

```
