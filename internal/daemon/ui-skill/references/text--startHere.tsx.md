# text/startHere.tsx

Generated from web/src/text/startHere.tsx; do not edit.

```tsx
import { catalog } from "../i18n";

// A repository's start page, in a new conversation
// (components/StartHere.tsx) and on the workspace page
// (components/WorkspaceIntro.tsx).
// Agent reference: author the shared introduction in .agents/start-page.md;
// it appears on the workspace page and at the start of new conversations.
// /skill:open-habitat-start-page invokes the authoring skill.
// Goals may opt into `start: immediate`. Choosing one sends once through the
// ordinary send path if the prompt has no placeholder and the existing draft
// is blank. Otherwise it only prepares the draft. Explain mode never sends.
// Omit start for prepare-and-wait; immediate is the only supported value.
const fi = {
  unreadable: "Aloitussivua ei saatu luettua.",
  retry: "Yritä uudelleen",
  needsUpdateTitle: "Aloitussivu tarvitsee päivityksen",
  needsUpdate: "Pyydä agenttia päivittämään aloitussivu tai jatka omin sanoin.",
  whatToDo: "Mitä haluat tehdä?",
  goalHint:
    "Tavoite kirjoittaa pyynnön valmiiksi viestikenttään. Voit myös kirjoittaa suoraan agentille.",
  create: "Pyydä agenttia luomaan työtilalle aloitussivu.",
  // The workspace page's intro.
  introNeedsUpdate:
    "Päivitä työtilan esittely ja ehdotukset siitä, mitä täällä voi tehdä.",
  introAbsent:
    "Luo tähän aloitussivu, joka esittelee työtilan ja auttaa pääsemään alkuun.",
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
  needsUpdate:
    "Ask the agent to update the start page, or continue in your own words.",
  whatToDo: "What would you like to do?",
  goalHint:
    "A goal writes the request into the message field for you. You can also write to the agent directly.",
  create: "Ask the agent to create a start page for this workspace.",
  introNeedsUpdate:
    "Update the workspace introduction and suggestions for what to do here.",
  introAbsent:
    "Create a start page here to introduce the workspace and help you get started.",
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
