# text/overlays.ts

Generated from web/src/text/overlays.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The shared dialogs (components/Overlays.tsx), the note of a slow write
// (components/PendingNote.tsx) and an inline name's problem
// (components/NameEditor.tsx).
const fi = {
  close: "Sulje",
  cancel: "Peruuta",
  // The second half of a menu split by a separator.
  menuEnd: (label: string) => `${label}: loppu`,
  slow: "Vahvistus palvelimelta viipyy…",
  uncertain: "Vastaus katosi matkalla. Tarkistetaan, tallentuiko muutos.",
  nameNotSaved: "Nimeä ei voitu tallentaa. Yritä uudelleen tai paina Esc.",
  nameEscape: "Esc palauttaa aiemman nimen.",
};

export const overlaysText = catalog(fi, {
  close: "Close",
  cancel: "Cancel",
  menuEnd: (label) => `${label}: end`,
  slow: "Confirmation from the server is taking a while…",
  uncertain:
    "The reply was lost on the way. Checking whether the change was saved.",
  nameNotSaved: "The name could not be saved. Try again or press Esc.",
  nameEscape: "Esc keeps the previous name.",
});

```
