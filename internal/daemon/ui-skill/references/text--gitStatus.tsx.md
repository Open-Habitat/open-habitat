# text/gitStatus.tsx

Generated from web/src/text/gitStatus.tsx; do not edit.

```tsx
import type { ReactNode } from "react";
import { catalog, plural } from "../i18n";

// The top bar's Git chip and its details (components/GitStatus.tsx). Branch
// names, hashes and times come in as arguments.
const fi = {
  commits: (n: number) => `${n} ${n === 1 ? "commit" : "committia"}`,
  changedFiles: (n: number) =>
    `${n} ${n === 1 ? "muuttunut tiedosto" : "muuttunutta tiedostoa"}`,
  branch: (name: string) => `Haara ${name}`,
  branchLower: (name: string) => `haara ${name}`,
  upstream: (ahead: number, behind: number, upstream: string) =>
    `${ahead} lähettämättä ja ${behind} tulossa ${upstream}-haarasta`,
  upstreamUnknown: (upstream: string) =>
    `seurantahaaran ${upstream} tila ei tiedossa`,
  baseMerged: (base: string, behind: number) =>
    `yhdistetty ${base}-haaraan, ${behind} jäljessä`,
  baseCounts: (ahead: number, behind: number, base: string) =>
    `${ahead} edellä ja ${behind} jäljessä ${base}-haaraa`,
  worktreeOf: "Worktree-agentin ",
  worktreeMerged: (branch: string, base: string) =>
    `haara ${branch}, yhdistetty ${base}-haaraan.`,
  merged: "yhdistetty",
  dialog: "Git-tila",
  chipLabel: (sentence: string) => `${sentence} Avaa Git-tiedot.`,
  chipTitleWorktree: "Worktree · avaa tiedot",
  chipTitle: "Git-tila · avaa tiedot",
  aheadOf: (commits: string, base: string) =>
    `${commits} edellä ${base}-haaraa`,
  behindOf: (commits: string, base: string) =>
    `${commits} jäljessä ${base}-haarasta`,
  unpushedN: (commits: string) => `${commits} lähettämättä`,
  incomingN: (commits: string) => `${commits} tulossa`,
  status: {
    untracked: "Uusi, ei seurannassa",
    conflict: "Ristiriita",
    deleted: "Poistettu",
    added: "Lisätty",
    renamed: "Nimetty uudelleen",
    copied: "Kopioitu",
    modified: "Muutettu",
    staged: (word: string) => `${word} · indeksissä`,
  },
  justNow: "juuri nyt",
  minutesAgo: (n: number) => `${n} min sitten`,
  hoursAgo: (n: number) => `${n} t sitten`,
  daysAgo: (n: number) => `${n} pv sitten`,
  none: "ei yhtään",
  showingNewest: (shown: number, total: number) =>
    `Näytetään ${shown} uusinta ${total}:stä.`,
  commitsUnreadable: "Committeja ei voitu lukea.",
  notLocal: "ei löydy paikallisesti",
  close: "Sulje",
  upstreamLabel: "Seurantahaara",
  upstreamSub: "seurantahaara",
  unpushed: "lähettämättä",
  incoming: "tulossa",
  unpushedTitle: "Lähettämättä",
  incomingTitle: "Tulossa",
  noUpstream: "Haaralla ei ole seurantahaaraa.",
  baseLabel: "Pohjahaara",
  baseSub: (ref: string, recorded: boolean) =>
    `pohjahaara · ${ref}${recorded ? " · haara tehty siitä" : ""}`,
  ahead: "edellä",
  behind: "jäljessä",
  allInBase: (base: string) => `Kaikki commitit ovat ${base}-haarassa.`,
  aheadTitle: (base: string) => `Edellä ${base}-haaraa`,
  behindTitle: (base: string) => `Jäljessä ${base}-haarasta`,
  recentCommits: "Viimeisimmät commitit",
  changes: "Muutokset",
  readError: "Git-tilaa ei voitu lukea. Näkyvä tila ei ole vahvistettu.",
  reading: "Luetaan Git-tilaa…",
  noChanges: "Ei muutoksia viimeisimpään committiin.",
  showingFirst: (shown: number, total: number) =>
    `Näytetään ${shown} ensimmäistä ${total}:stä.`,
  fetchedAt: (age: ReactNode, time: string): ReactNode => (
    <>
      Etärepo haettu {age} ({time}).{" "}
    </>
  ),
  fetchUnknown: "Viimeisintä hakua ei tiedetä. ",
  incomingNote: (readAt?: string) =>
    `Tulossa olevat commitit ovat viimeisimmän haun tietoa${readAt ? `; tila on luettu ${readAt}` : ""}.`,
  fetchTitle:
    "Ajaa git fetch -komennon omana käyttäjänäsi. Ei muuta haaraa eikä tiedostoja.",
  fetching: "Päivitetään…",
  fetch: "Päivitä tila",
  fetchNote:
    "Päivitys hakee etätiedot (git fetch) ja lukee paikallisen tilan. Se ei muuta työhaaraa tai tiedostoja. Pyydä agenttia tuomaan muutokset työhaaraan (pull --rebase).",
};

export const gitStatusText = catalog(fi, {
  commits: (n) =>
    `${n} ${plural("en", n, { one: "commit", other: "commits" })}`,
  changedFiles: (n) =>
    `${n} ${plural("en", n, { one: "changed file", other: "changed files" })}`,
  branch: (name) => `Branch ${name}`,
  branchLower: (name) => `branch ${name}`,
  upstream: (ahead, behind, upstream) =>
    `${ahead} not pushed and ${behind} incoming from ${upstream}`,
  upstreamUnknown: (upstream) =>
    `state of the tracking branch ${upstream} unknown`,
  baseMerged: (base, behind) => `merged into ${base}, ${behind} behind`,
  baseCounts: (ahead, behind, base) =>
    `${ahead} ahead of and ${behind} behind ${base}`,
  worktreeOf: "Worktree agent's ",
  worktreeMerged: (branch, base) => `branch ${branch}, merged into ${base}.`,
  merged: "merged",
  dialog: "Git state",
  chipLabel: (sentence) => `${sentence} Open Git details.`,
  chipTitleWorktree: "Worktree · open details",
  chipTitle: "Git state · open details",
  aheadOf: (commits, base) => `${commits} ahead of ${base}`,
  behindOf: (commits, base) => `${commits} behind ${base}`,
  unpushedN: (commits) => `${commits} not pushed`,
  incomingN: (commits) => `${commits} incoming`,
  status: {
    untracked: "New, untracked",
    conflict: "Conflict",
    deleted: "Deleted",
    added: "Added",
    renamed: "Renamed",
    copied: "Copied",
    modified: "Modified",
    staged: (word) => `${word} · staged`,
  },
  justNow: "just now",
  minutesAgo: (n) => `${n} min ago`,
  hoursAgo: (n) => `${n} h ago`,
  daysAgo: (n) => `${n} d ago`,
  none: "none",
  showingNewest: (shown, total) => `Showing the newest ${shown} of ${total}.`,
  commitsUnreadable: "The commits could not be read.",
  notLocal: "not found locally",
  close: "Close",
  upstreamLabel: "Tracking branch",
  upstreamSub: "tracking branch",
  unpushed: "not pushed",
  incoming: "incoming",
  unpushedTitle: "Not pushed",
  incomingTitle: "Incoming",
  noUpstream: "The branch has no tracking branch.",
  baseLabel: "Base branch",
  baseSub: (ref, recorded) =>
    `base branch · ${ref}${recorded ? " · branched from it" : ""}`,
  ahead: "ahead",
  behind: "behind",
  allInBase: (base) => `Every commit is in ${base}.`,
  aheadTitle: (base) => `Ahead of ${base}`,
  behindTitle: (base) => `Behind ${base}`,
  recentCommits: "Recent commits",
  changes: "Changes",
  readError:
    "The Git state could not be read. The state shown is not confirmed.",
  reading: "Reading the Git state…",
  noChanges: "No changes since the latest commit.",
  showingFirst: (shown, total) => `Showing the first ${shown} of ${total}.`,
  fetchedAt: (age, time) => (
    <>
      Remote fetched {age} ({time}).{" "}
    </>
  ),
  fetchUnknown: "The latest fetch is not known. ",
  incomingNote: (readAt) =>
    `Incoming commits are as of the latest fetch${readAt ? `; the state was read at ${readAt}` : ""}.`,
  fetchTitle:
    "Runs git fetch as your own user. Changes neither the branch nor the files.",
  fetching: "Refreshing…",
  fetch: "Refresh state",
  fetchNote:
    "Refreshing fetches the remote (git fetch) and reads the local state. It does not change the working branch or the files. Ask the agent to bring the changes into the working branch (pull --rebase).",
});

```
