# text/choiceList.ts

Generated from web/src/text/choiceList.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The composer's shared list of commands and files
// (components/composer/ChoiceList.tsx): Git's marks and the row notes.
const fi = {
  git: {
    modified: "muutettu",
    added: "lisätty",
    deleted: "poistettu",
    renamed: "nimetty uudelleen",
    untracked: "uusi, ei versionhallinnassa",
    conflict: "ristiriita",
  },
  marked: "(merkitty)",
  terminalOnly: "vain agentin päätteessä",
};

export const choiceListText = catalog(fi, {
  git: {
    modified: "modified",
    added: "added",
    deleted: "deleted",
    renamed: "renamed",
    untracked: "new, not under version control",
    conflict: "conflict",
  },
  marked: "(marked)",
  terminalOnly: "only in the agent's terminal",
});

```
