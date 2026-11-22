# text/turnChanges.ts

Generated from web/src/text/turnChanges.ts; do not edit.

```tsx
import { catalog, plural } from "../i18n";

// What the agent changed in a turn (components/TurnChanges.tsx): the
// collapsed Muutokset line, its file list and timeline.
const fi = {
  changes: "Muutokset",
  files: (n: number) => (n === 1 ? "1 tiedosto" : `${n} tiedostoa`),
  showChanges: "Näytä vuoron muutokset",
  timeline: "Aikajana",
  timelineLabel: "Näytä muutokset vuoron aikajanalla",
  written: "kirjoitettu",
  deleted: "poistettu",
  byCommand: "komennolla",
  edits: (n: number) => `${n} muokkausta`,
  showDiff: (path: string) => `Näytä tiedoston ${path} muutokset`,
  commandNote: "Muuttui komennolla",
  commandSource:
    "Työkalukutsuista ei näe, mitä komento teki tiedoston sisällölle.",
  deletedNote: "Komento poisti tiedoston.",
  deletedLines: (n: number) =>
    `Komento poisti tiedoston. Siinä oli ${n} ${n === 1 ? "rivi" : "riviä"}.`,
  writtenNote:
    "Agentti kirjoitti tiedoston kokonaan. Vuoro ei lukenut sitä ensin, joten aiempaa sisältöä ei näy.",
  editsNote:
    "Vuoro ei lukenut tiedostoa kokonaan ennen muokkausta, joten muokkaukset näkyvät sellaisinaan.",
  openEditor: "Avaa editorissa",
  openEditorAt: (line: number) => `Avaa editorissa · rivi ${line}`,
  final: "Lopputulos",
  stage: (n: number) => `Vaihe ${n}`,
  eventLabel: (i: number, n: number, time: string, tool: string) =>
    `Muutos ${i}/${n} · ${time} · ${tool}`,
  marker: (path: string, i: number, time: string) =>
    `${path}: muutos ${i} kohdassa ${time}`,
  finalOf: (path: string) => `${path}: lopputulos`,
  steps: "Muutokset ja lopputulos",
  unread: "Vuoron muutoksia ei voitu lukea.",
  retry: "Yritä uudelleen",
  added: "uusi",
  renamed: "siirretty",
  renamedFrom: (path: string) => `Siirretty nimestä ${path}.`,
  byCommandNote: "Muuttui komennolla tai skriptillä.",
  binary: "Binääritiedosto: rivimuutoksia ei näytetä.",
  noLines: "Sisältö ei muuttunut, vain tiedoston nimi tai oikeudet.",
  diffUnread: "Muutosta ei voitu lukea.",
  diffCut: "Muutos on pitkä, ja vain sen alku näytetään.",
  unrecorded: (n: number): string =>
    n === 1
      ? "Tätä tiedostoa ei tallennettu vuoron tilannekuvaan:"
      : "Näitä tiedostoja ei tallennettu vuoron tilannekuvaan:",
  more: (n: number) => `ja ${n} muuta`,
  filesMore: (n: number): string =>
    `Lisäksi ${n} ${n === 1 ? "tiedosto" : "tiedostoa"} muuttui; niitä ei näytetä tässä.`,
};

export const turnChangesText = catalog(fi, {
  changes: "Changes",
  files: (n) => `${n} ${plural("en", n, { one: "file", other: "files" })}`,
  showChanges: "Show the turn's changes",
  timeline: "Timeline",
  timelineLabel: "Show the changes on the turn's timeline",
  written: "written",
  deleted: "deleted",
  byCommand: "by command",
  edits: (n) => `${n} edits`,
  showDiff: (path) => `Show the changes to ${path}`,
  commandNote: "Changed by the command",
  commandSource:
    "The tool calls do not show what the command did to the file's content.",
  deletedNote: "A command deleted the file.",
  deletedLines: (n) =>
    `A command deleted the file. It had ${n} ${plural("en", n, { one: "line", other: "lines" })}.`,
  writtenNote:
    "The agent wrote the whole file. The turn did not read it first, so its earlier content is not shown.",
  editsNote:
    "The turn did not read the whole file before editing it, so the edits are shown as they were made.",
  openEditor: "Open in editor",
  openEditorAt: (line) => `Open in editor · line ${line}`,
  final: "Result",
  stage: (n) => `Stage ${n}`,
  eventLabel: (i, n, time, tool) => `Change ${i}/${n} · ${time} · ${tool}`,
  marker: (path, i, time) => `${path}: change ${i} at ${time}`,
  finalOf: (path) => `${path}: result`,
  steps: "Changes and result",
  unread: "The turn's changes could not be read.",
  retry: "Try again",
  added: "new",
  renamed: "moved",
  renamedFrom: (path) => `Moved from ${path}.`,
  byCommandNote: "Changed by a command or script.",
  binary: "Binary file: line changes are not shown.",
  noLines: "The content did not change, only the file's name or mode.",
  diffUnread: "The change could not be read.",
  diffCut: "The change is long; only its beginning is shown.",
  unrecorded: (n) =>
    n === 1
      ? "This file was not recorded in the turn's snapshot:"
      : "These files were not recorded in the turn's snapshot:",
  more: (n) => `and ${n} more`,
  filesMore: (n) =>
    `${n} more ${plural("en", n, { one: "file", other: "files" })} changed; they are not shown here.`,
});

```
