import { catalog, plural } from "../i18n";

// The worktree list's frame in Settings › Tallennustila and on a workspace
// page (app/WorktreeCleanup.tsx).
const fi = {
  keptPartial: "osa jäi poistamatta.",
  keptChanged: "se oli muuttunut.",
  branchKept: (branch: string, moved: boolean) =>
    `haara ${branch} säilyi, koska ${moved ? "se oli muuttunut" : "se on käytössä"}.`,
  removed: (n: number) =>
    `${n} ${n === 1 ? "worktree siivottiin" : "worktreetä siivottiin"}.`,
  title: "Worktreet",
  cleanAll: (n: number) => `Siivoa kaikki yhdistetyt${n ? ` (${n})` : ""}…`,
  intro: (all: boolean) =>
    `Gitin linkitetyt worktreet${all ? " kaikista työtiloista" : ""} sellaisina kuin Git ne nyt näkee. Yhdistämisen ja muut Git-työt tekee agentti keskustelussa; täällä worktreen voi poistaa. Taskfleetin käynnissä olevan ajon worktreetä ei poisteta.`,
  readFailed: "Worktreitä ei voitu lukea.",
  retry: "Yritä uudelleen",
  reading: "Luetaan worktreitä…",
  first: (n: number) => `Näytetään ${n} ensimmäistä.`,
  incomplete:
    "Joidenkin työtilojen worktreitä ei voitu lukea, joten lista voi olla vajaa.",
};

export const worktreeCleanupText = catalog(fi, {
  keptPartial: "some was left undeleted.",
  keptChanged: "it had changed.",
  branchKept: (branch, moved) =>
    `the branch ${branch} was kept because ${moved ? "it had changed" : "it is in use"}.`,
  removed: (n) =>
    `${n} ${plural("en", n, { one: "worktree was", other: "worktrees were" })} cleaned up.`,
  title: "Worktrees",
  cleanAll: (n) => `Clean up all merged${n ? ` (${n})` : ""}…`,
  intro: (all) =>
    `Git's linked worktrees${all ? " of all workspaces" : ""} as Git now sees them. The agent does the merging and other Git work in the conversation; here a worktree can be removed. A worktree of a running Taskfleet run is not removed.`,
  readFailed: "The worktrees could not be read.",
  retry: "Try again",
  reading: "Reading worktrees…",
  first: (n) => `Showing the first ${n}.`,
  incomplete:
    "The worktrees of some workspaces could not be read, so the list may be incomplete.",
});
