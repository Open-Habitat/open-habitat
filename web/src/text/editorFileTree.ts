import { catalog } from "../i18n";

// The editor's file picker (components/EditorFileTree.tsx).
const fi = {
  workspaceFiles: "Työtilan tiedostot",
  files: "Tiedostot",
  closePicker: "Sulje tiedostovalitsin",
  close: "Sulje",
  filter: "Suodata nimellä",
  scope: "Vain avattujen kansioiden ladatut nimet ja polut.",
  unsupported: "Ei tuettu",
  modified: "● Muokattu",
  open: "Auki",
  noMatches: "Ei osumia ladatuissa nimissä.",
  loading: (path: string) => `Ladataan ${path}`,
  unreadable: (path: string) => `Kansiota ${path} ei voitu lukea.`,
  retry: "Yritä uudelleen",
  truncated: (path: string) =>
    `${path}: Vain osa tiedostoista näkyy. Käytä suurille kansioille natiivityökaluja.`,
};

export const editorFileTreeText = catalog(fi, {
  workspaceFiles: "Workspace files",
  files: "Files",
  closePicker: "Close the file picker",
  close: "Close",
  filter: "Filter by name",
  scope: "Only the loaded names and paths of opened folders.",
  unsupported: "Not supported",
  modified: "● Modified",
  open: "Open",
  noMatches: "No matches among the loaded names.",
  loading: (path) => `Loading ${path}`,
  unreadable: (path) => `The folder ${path} could not be read.`,
  retry: "Try again",
  truncated: (path) =>
    `${path}: Only some of the files are shown. Use native tools for large folders.`,
});
