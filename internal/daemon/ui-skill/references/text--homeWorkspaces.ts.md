# text/homeWorkspaces.ts

Generated from web/src/text/homeWorkspaces.ts; do not edit.

```tsx
import { catalog, plural } from "../i18n";

// Home: the workspace list and its conversation cards
// (components/HomeWorkspaces.tsx). Branch names come in as arguments.
const fi = {
  readReply: "Lue vastaus",
  reply: "Vastaa",
  open: "Avaa",
  newReply: "Uusi vastaus",
  noMessages: "Ei vielä viestejä",
  readOnly: "Vain luku",
  archive: "Arkistoi",
  waitingBackground: "Odotan taustatyötä",
  waitingOn: (names: string) => `: ${names} · jatkan itse, kun odotus päättyy.`,
  working: "Agentti työskentelee",
  usingTool: " · käyttää työkalua",
  writing: " · kirjoittaa vastausta",
  next: "Seuraavaksi",
  recapUnreadable: "Katsausta ei voitu lukea",
  recapSoon: "valmistui juuri · katsaus syntyy pian",
  archiveFailed: "Arkistointia ei tehty. Keskustelu palautettiin listaan.",
  gitUnknown: "Git-tila ei tiedossa",
  merged: (base: string) => `yhdistetty ${base}-haaraan`,
  ahead: (n: number) => `${n} edellä`,
  behind: (n: number) => `${n} jäljessä`,
  changes: (n: number) => `${n} ${n === 1 ? "muutos" : "muutosta"}`,
  worktreeBranch: "Worktree-agentti, haara ",
  archiving: "Arkistointi kesken.",
  archiveUnavailable: "Arkistointi ei ole käytettävissä.",
  title: "Työtilat",
  summary: (workspaces: number, waiting: number, working: number) =>
    `${workspaces} työtilaa · ${waiting} odottaa sinua · ${working} käynnissä`,
  summaryBackground: (n: number) => ` · ${n} odottaa taustatyötä`,
  newWorkspace: "Uusi työtila",
  done: (n: number) => `${n} valmista`,
  noOpenWork: "Ei avointa työtä",
  noConversations: "ei keskusteluja",
};

export const homeWorkspacesText = catalog(fi, {
  readReply: "Read the reply",
  reply: "Reply",
  open: "Open",
  newReply: "New reply",
  noMessages: "No messages yet",
  readOnly: "Read only",
  archive: "Archive",
  waitingBackground: "Waiting for background work",
  waitingOn: (names) => `: ${names} · I will continue when the wait ends.`,
  working: "The agent is working",
  usingTool: " · using a tool",
  writing: " · writing a reply",
  next: "Next",
  recapUnreadable: "The recap could not be read",
  recapSoon: "just finished · the recap is coming",
  archiveFailed: "Not archived. The conversation was put back in the list.",
  gitUnknown: "Git state unknown",
  merged: (base) => `merged into ${base}`,
  ahead: (n) => `${n} ahead`,
  behind: (n) => `${n} behind`,
  changes: (n) =>
    `${n} ${plural("en", n, { one: "change", other: "changes" })}`,
  worktreeBranch: "Worktree agent, branch ",
  archiving: "Archiving in progress.",
  archiveUnavailable: "Archiving is not available.",
  title: "Workspaces",
  summary: (workspaces, waiting, working) =>
    `${workspaces} ${plural("en", workspaces, { one: "workspace", other: "workspaces" })} · ${waiting} waiting for you · ${working} running`,
  summaryBackground: (n) => ` · ${n} waiting for background work`,
  newWorkspace: "New workspace",
  done: (n) => `${n} done`,
  noOpenWork: "No open work",
  noConversations: "no conversations",
});

```
