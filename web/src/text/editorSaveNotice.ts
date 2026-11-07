import { catalog } from "../i18n";

// The notice after leaving the editor saved its text, with an undo
// (app/EditorSaveNotice.tsx).
const fi = {
  saved: "Tallennettu",
  undo: "Kumoa",
  undone: (file: string) => `Tallennus kumottu: ${file} on taas ennallaan.`,
  changedSince:
    "Tiedosto on muuttunut tallennuksen jälkeen, joten tallennusta ei kumottu.",
  undoUnknown:
    "Kumoamisen tulos ei ole tiedossa. Avaa tiedosto ja tarkista se.",
  undoFailed: "Tallennusta ei voitu kumota.",
};

export const editorSaveNoticeText = catalog(fi, {
  saved: "Saved",
  undo: "Undo",
  undone: (file) => `Save undone: ${file} is back as it was.`,
  changedSince:
    "The file has changed since it was saved, so the save was not undone.",
  undoUnknown:
    "Whether the undo went through is not known. Open the file and check it.",
  undoFailed: "The save could not be undone.",
});
