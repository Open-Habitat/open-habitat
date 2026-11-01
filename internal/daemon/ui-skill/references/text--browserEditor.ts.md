# text/browserEditor.ts

Generated from web/src/text/browserEditor.ts; do not edit.

```tsx
import { catalog, plural } from "../i18n";

// The browser editor's toolbar and states (components/BrowserEditor.tsx).
const fi = {
  saving: "Tallennetaan",
  pending: (agent: boolean, n: number) =>
    `${agent ? "Agentin" : "Levyn"} ${n} ${n === 1 ? "muutos odottaa" : "muutosta odottaa"}`,
  conflicts: (n: number) =>
    `Muokattu · ${n} ${n === 1 ? "ristiriita" : "ristiriitaa"}`,
  imported: (agent: boolean, n: number) =>
    `Muokattu · ${n} ${agent ? "agentin" : "levyn"} ${n === 1 ? "muutos tuotu" : "muutosta tuotu"}`,
  undone: (agent: boolean) =>
    `Muokattu · ilman ${agent ? "agentin" : "levyn"} muutoksia`,
  modified: "Muokattu",
  importNowHint:
    "Tuo nyt; muuten muutokset tuodaan, kun lopetat kirjoittamisen",
  importNow: "Tuo nyt",
  undoImport: "Peru tuonti",
  reimport: "Tuo uudelleen",
  files: "Tiedostot",
  chooseFile: "Valitse tiedosto",
  view: "Näkymä",
  text: "Teksti",
  backToText: "Takaisin tekstiin · Esc",
  views: {
    markdown: "Esikatselu",
    table: "Taulukko",
    image: "Kuva",
    page: "Sivu",
  },
  saveReplaceAgent: "Tallenna ja korvaa agentin versio",
  saveReplaceDisk: "Tallenna ja korvaa levyn versio",
  save: "Tallenna",
  saveWith: (keys: string) => `Tallenna · ${keys}`,
  saveWaits: (n: number, agent: boolean) =>
    `Tallennus odottaa: valitse ${n} ristiriitaiselle riville Sinun, ${agent ? "Agentin" : "Levyn"} tai Molemmat.`,
  loadingEditor: "Ladataan tekstieditoria",
  loadingPreview: "Ladataan esikatselua",
  openHint: "Avaa tekstitiedosto valitsimesta tai keskustelun linkistä.",
  discardReload: "Hylkää muutokset ja lataa",
};

export const browserEditorText = catalog(fi, {
  saving: "Saving",
  pending: (agent, n) =>
    `${n} ${plural("en", n, { one: "change", other: "changes" })} ${agent ? "by the agent" : "on disk"} waiting`,
  conflicts: (n) =>
    `Modified · ${n} ${plural("en", n, { one: "conflict", other: "conflicts" })}`,
  imported: (agent, n) =>
    `Modified · ${n} ${plural("en", n, { one: "change", other: "changes" })} ${agent ? "by the agent" : "on disk"} brought in`,
  undone: (agent) =>
    `Modified · without the ${agent ? "agent's" : "disk's"} changes`,
  modified: "Modified",
  importNowHint:
    "Bring in now; otherwise the changes come in when you stop typing",
  importNow: "Bring in now",
  undoImport: "Undo",
  reimport: "Bring in again",
  files: "Files",
  chooseFile: "Choose a file",
  view: "View",
  text: "Text",
  backToText: "Back to the text · Esc",
  views: {
    markdown: "Preview",
    table: "Table",
    image: "Picture",
    page: "Page",
  },
  saveReplaceAgent: "Save and replace the agent's version",
  saveReplaceDisk: "Save and replace the version on disk",
  save: "Save",
  saveWith: (keys) => `Save · ${keys}`,
  saveWaits: (n, agent) =>
    `Saving waits: choose Yours, ${agent ? "Agent's" : "Disk's"} or Both for ${n === 1 ? "the conflicting line" : `${n} conflicting lines`}.`,
  loadingEditor: "Loading the text editor",
  loadingPreview: "Loading the preview",
  openHint:
    "Open a text file from the picker or from a link in the conversation.",
  discardReload: "Discard changes and reload",
});

```
