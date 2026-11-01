# text/palette.tsx

Generated from web/src/text/palette.tsx; do not edit.

```tsx
import type { ReactNode } from "react";
import { catalog } from "../i18n";

// The composer's Ctrl/⌘+P picker (components/composer/Palette.tsx): its
// tabs, search, preview pane and key hints.
const fi = {
  tabs: {
    all: "Tiedostot",
    changed: "Muutetut",
    cmd: "Komennot",
  },
  nothingSelected: "Ei valittua.",
  source: "Lähde",
  runsAtOnce: "Ajetaan heti, kun valitset sen. Ei lähetä mitään agentille.",
  terminalOnly:
    "Tämä laajennuksen komento avaa agentin päätteen valikon, joten selain ei voi ajaa sitä.",
  addsSkill:
    "Lisätään viestin alkuun. Kun lähetät viestin, agentti lataa taidon.",
  addsPrompt:
    "Lisätään viestin alkuun. Kun lähetät viestin, agentti laajentaa pohjan.",
  addsCommand:
    "Lisätään viestin alkuun. Kun lähetät viestin, agentti ajaa komennon.",
  previewFailed: "Esikatselua ei saatu.",
  reading: "Luetaan…",
  binary: "Binääritiedosto: ei esikatselua.",
  close: "Sulje valitsin",
  dialog: "Valitse tiedostot tai komento",
  search: "Hae",
  searchCommand: "Hae komentoa tai taitoa",
  searchFile: "Hae tiedostoa · Tab merkitsee useamman",
  commands: "Komennot",
  files: "Tiedostot",
  noMatches: (query: string) =>
    query ? `Ei osumia haulle “${query}”.` : "Ei osumia.",
  preview: "Esikatselu",
  select: "valitse",
  addToStart: "lisää viestin alkuun",
  mark: "merkitse",
  addPaths: (n: number) => (n > 1 ? `lisää ${n} polkua` : "lisää polku"),
  nextTab: "seuraava välilehti",
  backToField: "takaisin kenttään",
  path: "polku",
  insertedAs: (form: ReactNode) => <>lisätään muodossa {form}</>,
  insertedInCommand: (form: ReactNode) => (
    <>lisätään muodossa {form} komentoon</>
  ),
};

export const paletteText = catalog(fi, {
  tabs: {
    all: "Files",
    changed: "Changed",
    cmd: "Commands",
  },
  nothingSelected: "Nothing selected.",
  source: "Source",
  runsAtOnce: "Runs as soon as you choose it. Sends nothing to the agent.",
  terminalOnly:
    "This extension command opens a menu in the agent's terminal, so the browser cannot run it.",
  addsSkill:
    "Added at the start of the message. When you send it, the agent loads the skill.",
  addsPrompt:
    "Added at the start of the message. When you send it, the agent expands the template.",
  addsCommand:
    "Added at the start of the message. When you send it, the agent runs the command.",
  previewFailed: "The preview could not be loaded.",
  reading: "Reading…",
  binary: "Binary file: no preview.",
  close: "Close the picker",
  dialog: "Choose files or a command",
  search: "Search",
  searchCommand: "Search commands and skills",
  searchFile: "Search files · Tab marks several",
  commands: "Commands",
  files: "Files",
  noMatches: (query) => (query ? `No matches for “${query}”.` : "No matches."),
  preview: "Preview",
  select: "select",
  addToStart: "add at the start of the message",
  mark: "mark",
  addPaths: (n) => (n > 1 ? `add ${n} paths` : "add the path"),
  nextTab: "next tab",
  backToField: "back to the field",
  path: "path",
  insertedAs: (form) => <>inserted as {form}</>,
  insertedInCommand: (form) => <>inserted in the command as {form}</>,
});

```
