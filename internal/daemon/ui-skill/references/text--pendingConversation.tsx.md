# text/pendingConversation.tsx

Generated from web/src/text/pendingConversation.tsx; do not edit.

```tsx
import type { ReactNode } from "react";
import { catalog, plural } from "../i18n";

// A conversation that is loading or being created
// (app/PendingConversation.tsx), and the worktree agent's introduction.
const fi = {
  loading: "Ladataan keskustelua…",
  retry: "Yritä uudelleen",
  newConversation: "Uusi keskustelu",
  newWorktreeAgent: "Uusi worktree-agentti",
  unconfirmed: "Tilaa ei voitu vahvistaa",
  notCreated: "Ei luotu",
  creatingWorktree: "Luodaan worktreetä",
  workspace: "Työtila",
  stateUnconfirmed: "Keskustelun tilaa ei voitu vahvistaa",
  conversationNotCreated: "Keskustelua ei luotu",
  agent: "Agentti",
  modelUnknown: "Malli ei tiedossa",
  manyReturned: "Viestit eivät lähteneet. Ne ovat taas kentässä.",
  oneReturned: "Viesti ei lähtenyt. Se on taas kentässä.",
  edit: "Muokkaa",
  notCreatedReason: "Keskustelua ei luotu.",
  creationUnconfirmed: "Keskustelun luontia ei voitu vahvistaa.",
  worktreeLead: (workspace: ReactNode): ReactNode => (
    <>Uusi worktree-agentti työtilassa {workspace}</>
  ),
  worktreeFirst: (base: ReactNode | undefined): ReactNode => (
    <>
      Ensimmäinen viesti luo oman worktreen ja haaran{" "}
      {base ? <>haarasta {base}</> : "työtilan nykyisestä haarasta"} ja
      käynnistää siihen agentin. Otsikko syntyy keskustelusta.
    </>
  ),
  worktreeDirty: (n: number) =>
    n === 1
      ? "Työtilan tallentamaton muutos ei tule mukaan."
      : `Työtilan ${n} tallentamatonta muutosta eivät tule mukaan.`,
  worktreeMerge:
    "Yhdistä tai hylkää työ pyytämällä agenttia; yläpalkki näyttää Gitin tilan.",
};

export const pendingConversationText = catalog(fi, {
  loading: "Loading the conversation…",
  retry: "Try again",
  newConversation: "New conversation",
  newWorktreeAgent: "New worktree agent",
  unconfirmed: "The status could not be confirmed",
  notCreated: "Not created",
  creatingWorktree: "Creating the worktree",
  workspace: "Workspace",
  stateUnconfirmed: "The conversation's status could not be confirmed",
  conversationNotCreated: "The conversation was not created",
  agent: "Agent",
  modelUnknown: "Model unknown",
  manyReturned: "The messages did not go out. They are back in the field.",
  oneReturned: "The message did not go out. It is back in the field.",
  edit: "Edit",
  notCreatedReason: "The conversation was not created.",
  creationUnconfirmed: "Creating the conversation could not be confirmed.",
  worktreeLead: (workspace) => <>New worktree agent in workspace {workspace}</>,
  worktreeFirst: (base) => (
    <>
      The first message creates its own worktree and branch{" "}
      {base ? <>from branch {base}</> : "from the workspace's current branch"}{" "}
      and starts an agent in it. The title comes from the conversation.
    </>
  ),
  worktreeDirty: (n) =>
    `${n} unsaved ${plural("en", n, { one: "change", other: "changes" })} in the workspace ${n === 1 ? "is" : "are"} not included.`,
  worktreeMerge:
    "Merge or discard the work by asking the agent; the top bar shows the Git status.",
});

```
