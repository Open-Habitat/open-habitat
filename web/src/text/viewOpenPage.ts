import { catalog } from "../i18n";

// A shared view opened in a tab of its own (app/ViewOpenPage.tsx).
const fi = {
  failed:
    "Näkymää ei voitu avata. Se on ehkä poistettu, tai olet kirjautunut ulos. Avaa se uudelleen Habitatista.",
  opening: "Avataan näkymää…",
};

export const viewOpenPageText = catalog(fi, {
  failed:
    "The view could not be opened. It may have been removed, or you have signed out. Open it again from Habitat.",
  opening: "Opening the view…",
});
