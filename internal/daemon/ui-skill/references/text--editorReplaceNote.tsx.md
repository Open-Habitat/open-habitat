# text/editorReplaceNote.tsx

Generated from web/src/text/editorReplaceNote.tsx; do not edit.

```tsx
import type { ReactNode } from "react";
import { catalog } from "../i18n";

// The note about agent changes a save replaced
// (components/EditorReplaceNote.tsx).
const fi = {
  title: "Korvasit agentin muutoksia",
  dismiss: "Sulje merkintä",
  savedOwn: (path: ReactNode, count: number) => (
    <>
      Tallensit tiedoston {path} omalla tekstilläsi.{" "}
      {count === 1
        ? "Tämä agentin muutos ei ole enää tiedostossa:"
        : "Nämä agentin muutokset eivät ole enää tiedostossa:"}
    </>
  ),
  line: (line: number) => `rivi ${line}:`,
  deletion: "(poisto)",
  onlyYou: "Vain sinä näet tämän. Agentti ei tiedä korvauksesta, ellet kerro.",
  tellAgent: "Kerro agentille",
};

export const editorReplaceNoteText = catalog(fi, {
  title: "You replaced the agent's changes",
  dismiss: "Dismiss note",
  savedOwn: (path, count) => (
    <>
      You saved {path} with your own text.{" "}
      {count === 1
        ? "This change by the agent is no longer in the file:"
        : "These changes by the agent are no longer in the file:"}
    </>
  ),
  line: (line) => `line ${line}:`,
  deletion: "(deletion)",
  onlyYou:
    "Only you see this. The agent does not know about the replacement unless you tell it.",
  tellAgent: "Tell the agent",
});

```
