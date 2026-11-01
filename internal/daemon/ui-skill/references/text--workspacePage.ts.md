# text/workspacePage.ts

Generated from web/src/text/workspacePage.ts; do not edit.

```tsx
import { catalog, plural } from "../i18n";

// The workspace page (app/WorkspacePage.tsx): its head, Git line, notices,
// rename and conversation lists.
const fi = {
  iconAuto: "automaattinen",
  iconLogo: "repon logo",
  unchanged: ".open-habitat.yaml sanoi jo tämän, joten mitään ei muutettu.",
  written: "Kirjoitettu .open-habitat.yaml-tiedostoon.",
  committed:
    "Kirjoitettu .open-habitat.yaml-tiedostoon ja commitoitu, ei pushattu.",
  iconRestored: "Kuvake palautettu:",
  icon: "Kuvake:",
  suggestionsBack: (detail: string) =>
    `${detail} Ehdotukset saa takaisin kuvakkeesta.`,
  undo: "Kumoa",
  suggestions: "Ehdotukset",
  gitLabel: (branch: string, changes: number) =>
    `${branch} · ${changes} ${changes === 1 ? "muutos" : "muutosta"}`,
  gitUnknown: "Git-tila ei tiedossa",
  waiting: (n: number) => `${n} odottaa sinua`,
  working: (n: number) => `${n} työskentelee`,
  background: (n: number) => `${n} odottaa taustatyötä`,
  gitUnreadable: "Git-tilaa ei voitu lukea. Näkyvä tila ei ole vahvistettu.",
  directory: "Hakemisto · ei Git-työtilaa",
  iconUnavailable: "Kuvaketta voi vaihtaa, kun työtilan tila on vahvistettu.",
  askModel: "Ehdotuksia mallilta…",
  iconSource: "Kuvake:",
  archived: "Arkistoitu · tiedostot ja keskustelut säilyvät ·",
  restore: "Palauta",
  archivedRail:
    "Tiedostot ja keskustelut säilyvät. Löydät sen sivupalkin lopusta, Arkistoidut-ryhmästä.",
  repoLogo: "Repon logo",
  close: "Sulje",
  recheckCreation: "Tarkista luonnin tulos",
  refreshDefault: "Päivitä oletusagentin tiedot",
  chooseModel: "Valitse toinen malli",
  modelTitle: "Malli uudelle keskustelulle",
  startWithModel: "Aloita keskustelu valitulla mallilla",
  rename: "Muuta näyttönimeä…",
  renameTitle: "Muuta näyttönimeä",
  displayName: "Näyttönimi",
  save: "Tallenna",
  openConversations: "Avoimet keskustelut",
  open: "Avoimet",
  empty: "Ei avoimia keskusteluja. Aloita uusi keskustelu +:sta.",
  done: (n: number) => `Valmiit · ${n}`,
  // What the icon model is shown.
  seenAll: "nimi, README:n alku, aloitussivu, kielet ja logon polku",
  seenName: "nimi",
  seenReadme: "README:n alku",
  seenStart: "aloitussivu",
  seenLanguages: (languages: string) => `kielet (${languages})`,
  seenLogo: "logon polku",
  languagePercent: (name: string, percent: number) => `${name} ${percent} %`,
};

export const workspacePageText = catalog(fi, {
  iconAuto: "automatic",
  iconLogo: "repository logo",
  unchanged: ".open-habitat.yaml already said this, so nothing was changed.",
  written: "Written to .open-habitat.yaml.",
  committed: "Written to .open-habitat.yaml and committed, not pushed.",
  iconRestored: "Icon restored:",
  icon: "Icon:",
  suggestionsBack: (detail) =>
    `${detail} The icon brings the suggestions back.`,
  undo: "Undo",
  suggestions: "Suggestions",
  gitLabel: (branch, changes) =>
    `${branch} · ${changes} ${plural("en", changes, { one: "change", other: "changes" })}`,
  gitUnknown: "Git state unknown",
  waiting: (n) => `${n} waiting for you`,
  working: (n) => `${n} working`,
  background: (n) => `${n} waiting for background work`,
  gitUnreadable:
    "The Git state could not be read. The state shown is not confirmed.",
  directory: "Directory · not a Git workspace",
  iconUnavailable:
    "The icon can be changed once the workspace's state is confirmed.",
  askModel: "Suggestions from a model…",
  iconSource: "Icon:",
  archived: "Archived · files and conversations are kept ·",
  restore: "Restore",
  archivedRail:
    "Files and conversations are kept. You find it at the end of the sidebar, in the Archived group.",
  repoLogo: "Repository logo",
  close: "Close",
  recheckCreation: "Check the creation's result",
  refreshDefault: "Refresh the default agent's details",
  chooseModel: "Choose another model",
  modelTitle: "Model for the new conversation",
  startWithModel: "Start the conversation with the chosen model",
  rename: "Change display name…",
  renameTitle: "Change display name",
  displayName: "Display name",
  save: "Save",
  openConversations: "Open conversations",
  open: "Open",
  empty: "No open conversations. Start a new conversation with +.",
  done: (n) => `Done · ${n}`,
  seenAll:
    "the name, the start of the README, the start page, the languages and the logo's path",
  seenName: "the name",
  seenReadme: "the start of the README",
  seenStart: "the start page",
  seenLanguages: (languages) => `the languages (${languages})`,
  seenLogo: "the logo's path",
  languagePercent: (name, percent) => `${name} ${percent}%`,
});

```
