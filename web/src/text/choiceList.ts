import { catalog, plural } from "../i18n";

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
  folderOpen: "(auki)",
  folderClosed: "(kiinni)",
  changedBeneath: (n: number) =>
    plural("fi", n, {
      one: `${n} muutettu tiedosto`,
      other: `${n} muutettua tiedostoa`,
    }),
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
  folderOpen: "(open)",
  folderClosed: "(closed)",
  changedBeneath: (n) =>
    `${n} changed ${plural("en", n, { one: "file", other: "files" })}`,
});
