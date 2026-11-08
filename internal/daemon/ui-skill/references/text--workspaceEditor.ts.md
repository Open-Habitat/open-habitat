# text/workspaceEditor.ts

Generated from web/src/text/workspaceEditor.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The workspace's editor beside the conversation (app/WorkspaceEditor.tsx):
// opening VS Code or the text editor, and the top bar's editor button.
const fi = {
  waitingForYou: "Odottaa sinua",
  phoneTitle: "Ikkuna on liian kapea VS Codelle.",
  phoneBody: "Tallenna VS Codessa ensin (Ctrl+S), jos siellä on muutoksia.",
  phoneStay: "Pysy VS Codessa",
  phoneSwitch: "Vaihda puhelimen editoriin",
  fileNotFound: (path: string) => `Tiedostoa ${path} ei löydy työtilasta.`,
  notYetReceived:
    "VS Code ei vielä ottanut tiedostoa vastaan. Yritä hetken päästä uudelleen.",
  sessionEnded: "Istunto on päättynyt. Kirjaudu uudelleen.",
  noOpenReply: "Tiedoston avaamisesta ei saatu vastausta.",
  vscodeFailed: "VS Codea ei voitu avata",
  vscodeFailedDetail:
    "Editori ei käynnistynyt, tai istunto ei siirtynyt sille.",
  retry: "Yritä uudelleen",
  loadingInterface: "Ladataan editorin käyttöliittymää",
  startingVSCode: "Käynnistetään VS Code",
  firstOpenSlow:
    "Ensimmäinen avaus voi kestää puoli minuuttia. Editori pysyy käynnissä, kunnes sitä ei ole käytetty puoleen tuntiin.",
  loadingEditor: "Ladataan editoria",
  workspaceGone:
    "Työtila ei ole enää valittuna tai käytettävissä. Tallentamaton teksti säilyy, kunnes suljet sen.",
  vscodeFrame: "VS Code: työtilan editori",
  closeEditor: "Sulje editori",
  editor: "Editori",
  openEditor: "Avaa työtilan editori keskustelun viereen (Ctrl+Alt+K)",
};

export const workspaceEditorText = catalog(fi, {
  waitingForYou: "Waiting for you",
  phoneTitle: "The window is too narrow for VS Code.",
  phoneBody: "Save in VS Code first (Ctrl+S) if it has changes.",
  phoneStay: "Stay in VS Code",
  phoneSwitch: "Switch to the phone editor",
  fileNotFound: (path) => `${path} was not found in the workspace.`,
  notYetReceived: "VS Code did not take the file yet. Try again in a moment.",
  sessionEnded: "Your session has ended. Sign in again.",
  noOpenReply: "No reply came to opening the file.",
  vscodeFailed: "VS Code could not be opened",
  vscodeFailedDetail:
    "The editor did not start, or the session did not pass to it.",
  retry: "Try again",
  loadingInterface: "Loading the editor",
  startingVSCode: "Starting VS Code",
  firstOpenSlow:
    "The first opening can take half a minute. The editor keeps running until it has gone unused for half an hour.",
  loadingEditor: "Loading the editor",
  workspaceGone:
    "The workspace is no longer selected or available. Unsaved text stays until you close it.",
  vscodeFrame: "VS Code: workspace editor",
  closeEditor: "Close editor",
  editor: "Editor",
  openEditor: "Open the workspace editor beside the conversation (Ctrl+Alt+K)",
});

```
