import { catalog } from "../i18n";

// The shared instructions editor (components/InstructionsEditor.tsx).
const fi = {
  preview: "Esikatselu",
  edit: "Muokkaa",
  tabs: "Näkymä",
  save: "Tallenna",
  saving: "Tallennetaan",
  cancel: "Peru",
  unsaved: "Tallentamattomia muutoksia",
  saved: "Tallennettu",
  rawLabel: "Ohjeet Markdown-tekstinä",
  rawHint: "Tavallista tekstiä. # aloittaa otsikon ja - listan rivin.",
  kept: "Ennallaan",
  added: "Uutta",
  mergedTitle: "Ohjeet muuttuivat sillä välin, kun muokkasit niitä.",
  mergedLead: (n: number) =>
    n === 1
      ? "Toinen muutos on nyt mukana tekstissäsi. Mitään ei ole vielä tallennettu: tarkista ja tallenna uudelleen."
      : `${n} toista muutosta on nyt mukana tekstissäsi. Mitään ei ole vielä tallennettu: tarkista ja tallenna uudelleen.`,
  conflictLead: "Sama kohta muuttui myös toisaalla. Valitse ensin, mikä jää.",
  conflictBlocks: "Valitse ensin, mikä jää.",
};

export const instructionsEditorText = catalog(fi, {
  preview: "Preview",
  edit: "Edit",
  tabs: "View",
  save: "Save",
  saving: "Saving",
  cancel: "Cancel",
  unsaved: "Unsaved changes",
  saved: "Saved",
  rawLabel: "Instructions as Markdown text",
  rawHint: "Plain text. # starts a heading and - a list line.",
  kept: "Unchanged",
  added: "New",
  mergedTitle: "The instructions changed while you were editing them.",
  mergedLead: (n: number) =>
    n === 1
      ? "The other change is now part of your text. Nothing is saved yet: check it and save again."
      : `${n} other changes are now part of your text. Nothing is saved yet: check it and save again.`,
  conflictLead: "The same part changed elsewhere too. Choose what stays first.",
  conflictBlocks: "Choose what stays first.",
});
