import { catalog } from "../i18n";

// The window that appears when leaving the editor could not save its text
// (components/UnsavedChangesDialog.tsx).
const fi = {
  title: "Muutoksia ei voitu tallentaa",
  discard: "Hylkää muutokset",
  keep: "Jatka muokkausta",
};

export const unsavedChangesDialogText = catalog(fi, {
  title: "Your changes could not be saved",
  discard: "Discard changes",
  keep: "Keep editing",
});
