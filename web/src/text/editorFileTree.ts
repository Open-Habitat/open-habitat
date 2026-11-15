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
  symbolicLink: "Symbolinen linkki",
  linkUnavailable: {
    outside_workspace: "Kohde on työtilan ulkopuolella tai eri levyllä.",
    broken_link: "Linkin kohdetta ei löydy.",
    symlink_loop: "Linkkiketju kiertää kehää tai on liian pitkä.",
    file_unavailable: "Linkin kohdetta ei voi avata.",
  },
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
  symbolicLink: "Symbolic link",
  linkUnavailable: {
    outside_workspace:
      "The target is outside the workspace or on another volume.",
    broken_link: "The link target could not be found.",
    symlink_loop: "The link chain loops or is too long.",
    file_unavailable: "The link target cannot be opened.",
  },
  modified: "● Modified",
  open: "Open",
  noMatches: "No matches among the loaded names.",
  loading: (path) => `Loading ${path}`,
  unreadable: (path) => `The folder ${path} could not be read.`,
  retry: "Try again",
  truncated: (path) =>
    `${path}: Only some of the files are shown. Use native tools for large folders.`,
});
