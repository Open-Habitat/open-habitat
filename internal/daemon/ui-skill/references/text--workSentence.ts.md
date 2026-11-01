# text/workSentence.ts

Generated from web/src/text/workSentence.ts; do not edit.

```tsx
import { catalog, plural } from "../i18n";

// What a worker has produced, in words (app/workSentence.ts): the row's short
// clause, its checks and pull request, and the worker view's whole sentence.
// Unknown is never said as zero.
const fi = {
  unknown: "työn tila ei tiedossa",
  noChanges: "ei vielä muutoksia",
  commits: (n: number) => `${n} ${n === 1 ? "commit" : "committia"}`,
  // "muutos/muutosta" as the home page's worktree card says it.
  changes: (n: number) => `${n} ${n === 1 ? "muutos" : "muutosta"}`,
  merged: "yhdistetty",
  closed: "suljettu",
  checkFailed: (n: number) =>
    n === 1 ? "tarkistus epäonnistui" : `${n} tarkistusta epäonnistui`,
  failedShort: "epäonnistui",
  checksRunning: "tarkistukset käynnissä",
  runningShort: "käynnissä",
  checksPassed: "tarkistukset läpi",
  passedShort: "läpi",
  noChecks: "ei tarkistuksia",
  prName: (n: number, draft: boolean) => `PR #${n}${draft ? " luonnos" : ""}`,
  sentenceUnknown: "Työn tila ei tiedossa: Git ei vastannut workerin haarasta.",
  sentenceNoChanges: "Ei vielä muutoksia.",
  onBranch: (n: number) => `${n} ${n === 1 ? "commit" : "committia"} haarassa`,
  uncommitted: (n: number) =>
    `${n} ${n === 1 ? "tiedosto" : "tiedostoa"} commitoimatta`,
  lines: (added: number, removed: number) =>
    `${added} ${added === 1 ? "rivi" : "riviä"} lisätty ja ${removed} poistettu.`,
  sourceBranch: "Lähtöhaara",
  behind: (branch: string, n: number) =>
    `${branch} on edennyt ${n} commitilla.`,
  pr: (n: number, draft: boolean, checks: string) =>
    `PR #${n}${draft ? " (luonnos)" : ""}: ${checks}.`,
  noPr: "Ei pull requestia.",
  prUnknown: "PR-tieto ei saatavilla.",
};

const commits = (n: number) =>
  `${n} ${plural("en", n, { one: "commit", other: "commits" })}`;

export const workSentenceText = catalog(fi, {
  unknown: "state of work unknown",
  noChanges: "no changes yet",
  commits,
  changes: (n) =>
    `${n} ${plural("en", n, { one: "change", other: "changes" })}`,
  merged: "merged",
  closed: "closed",
  checkFailed: (n) => (n === 1 ? "a check failed" : `${n} checks failed`),
  failedShort: "failed",
  checksRunning: "checks running",
  runningShort: "running",
  checksPassed: "checks passed",
  passedShort: "passed",
  noChecks: "no checks",
  prName: (n, draft) => `PR #${n}${draft ? " draft" : ""}`,
  sentenceUnknown:
    "State of work unknown: Git did not answer about the worker's branch.",
  sentenceNoChanges: "No changes yet.",
  onBranch: (n) => `${commits(n)} on the branch`,
  uncommitted: (n) =>
    `${n} ${plural("en", n, { one: "file", other: "files" })} uncommitted`,
  lines: (added, removed) =>
    `${added} ${plural("en", added, { one: "line", other: "lines" })} added and ${removed} removed.`,
  sourceBranch: "The source branch",
  behind: (branch, n) => `${branch} has moved ahead by ${commits(n)}.`,
  pr: (n, draft, checks) => `PR #${n}${draft ? " (draft)" : ""}: ${checks}.`,
  noPr: "No pull request.",
  prUnknown: "Pull request information not available.",
});

```
