import { catalog } from "../i18n";

// The workspace page's head actions and the + of the rail and home
// (components/WorkspaceActions.tsx).
const fi = {
  group: "Työtilan toiminnot",
  copyPath: "Kopioi polku",
  pathCopied: "Polku kopioitu",
  pathNotCopied: "Polkua ei voitu kopioida",
  openGitHub: "Avaa GitHubissa",
  openGitHubRepo: (repo: string) => `Avaa GitHubissa · ${repo}`,
  noOrigin: "Työtilalla ei ole GitHub-originia.",
  rename: "Muuta näyttönimeä…",
  restore: "Palauta työtila",
  archive: "Arkistoi työtila",
  restoreHint: "Palauta työtila sivupalkkiin",
  archiveHint:
    "Arkistoi: siirtää työtilan sivupalkin Arkistoidut-ryhmään. Tiedostot ja keskustelut säilyvät.",
  delete: "Poista työtila…",
  deleteUnavailable:
    "Työtilaa ei voi poistaa juuri nyt: muutokset eivät ole sallittuja.",
  newWorktreeIn: (name: string) => `Uusi worktree-agentti työtilassa ${name}`,
  newWorktreeHint:
    "Uusi worktree-agentti: oma worktree ja haara nykyisestä haarasta",
  startConversation: "Aloita uusi agenttikeskustelu",
  newConversationIn: (name: string) => `Uusi keskustelu työtilassa ${name}`,
  newConversation: "Uusi keskustelu",
};

export const workspaceActionsText = catalog(fi, {
  group: "Workspace actions",
  copyPath: "Copy path",
  pathCopied: "Path copied",
  pathNotCopied: "The path could not be copied",
  openGitHub: "Open in GitHub",
  openGitHubRepo: (repo) => `Open in GitHub · ${repo}`,
  noOrigin: "The workspace has no GitHub origin.",
  rename: "Change display name…",
  restore: "Restore workspace",
  archive: "Archive workspace",
  restoreHint: "Restore the workspace to the sidebar",
  archiveHint:
    "Archive: moves the workspace to the sidebar's Archived group. Files and conversations are kept.",
  delete: "Delete workspace…",
  deleteUnavailable:
    "The workspace cannot be deleted just now: changes are not allowed.",
  newWorktreeIn: (name) => `New worktree agent in the workspace ${name}`,
  newWorktreeHint:
    "New worktree agent: its own worktree and branch from the current branch",
  startConversation: "Start a new agent conversation",
  newConversationIn: (name) => `New conversation in the workspace ${name}`,
  newConversation: "New conversation",
});
