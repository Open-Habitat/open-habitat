# text/startHere.tsx

Generated from web/src/text/startHere.tsx; do not edit.

```tsx
import type { ReactNode } from "react";
import { catalog } from "../i18n";

// A repository's start page, in a new conversation
// (components/StartHere.tsx) and on the workspace page
// (components/WorkspaceIntro.tsx). The command and the file name come in as
// nodes.
const fi = {
  unreadable: "Aloitussivua ei saatu luettua.",
  retry: "Yritä uudelleen",
  needsUpdateTitle: "Aloitussivu tarvitsee päivityksen",
  needsUpdate: (command: ReactNode): ReactNode => (
    <>
      Päivitä aloitussivu kirjoittamalla viestikenttään {command}. Voit myös
      jatkaa kirjoittamalla agentille omin sanoin.
    </>
  ),
  whatToDo: "Mitä haluat tehdä?",
  goalHint:
    "Tavoite kirjoittaa pyynnön valmiiksi viestikenttään. Voit myös kirjoittaa suoraan agentille.",
  create: (command: ReactNode): ReactNode => (
    <>Luo aloitussivu kirjoittamalla viestikenttään {command}.</>
  ),
  // The workspace page's intro.
  introNeedsUpdate: (file: ReactNode): ReactNode => (
    <>
      Aloitussivu tarvitsee päivityksen. Agentti päivittää {file}:n, ja esittely
      näkyy sitten täällä ja uuden keskustelun alussa.
    </>
  ),
  introAbsent: (file: ReactNode): ReactNode => (
    <>
      Tällä työtilalla ei ole aloitussivua. Agentti kirjoittaa sen {file}:hen,
      ja sama esittely näkyy sitten täällä ja uuden keskustelun alussa.
    </>
  ),
  updatePage: "Päivitä aloitussivu",
  createPage: "Luo aloitussivu",
  pageLabel: "Aloitussivu",
  showLess: "Näytä vähemmän",
  showAll: "Näytä koko esittely",
  introGoalHint: (newHint: string) =>
    `Tavoite aloittaa uuden keskustelun pyyntö valmiina. ${newHint}`,
  newHint: "Tyhjän keskustelun saat +:sta.",
};

export const startHereText = catalog(fi, {
  unreadable: "The start page could not be read.",
  retry: "Try again",
  needsUpdateTitle: "The start page needs an update",
  needsUpdate: (command) => (
    <>
      Update the start page by typing {command} in the message field. You can
      also go on by writing to the agent in your own words.
    </>
  ),
  whatToDo: "What would you like to do?",
  goalHint:
    "A goal writes the request into the message field for you. You can also write to the agent directly.",
  create: (command) => (
    <>Create a start page by typing {command} in the message field.</>
  ),
  introNeedsUpdate: (file) => (
    <>
      The start page needs an update. The agent updates {file}, and the
      introduction then shows here and at the start of a new conversation.
    </>
  ),
  introAbsent: (file) => (
    <>
      This workspace has no start page. The agent writes it to {file}, and the
      same introduction then shows here and at the start of a new conversation.
    </>
  ),
  updatePage: "Update start page",
  createPage: "Create start page",
  pageLabel: "Start page",
  showLess: "Show less",
  showAll: "Show the whole introduction",
  introGoalHint: (newHint) =>
    `A goal starts a new conversation with the request ready. ${newHint}`,
  newHint: "For an empty conversation, use +.",
});

```
