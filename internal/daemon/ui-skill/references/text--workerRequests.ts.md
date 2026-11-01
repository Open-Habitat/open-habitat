# text/workerRequests.ts

Generated from web/src/text/workerRequests.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The request an ended worker's row sends its conversation in the person's
// name (app/workerRequests.ts). The agent reads it, so it is plain prose; the
// run marker names the Taskfleet run, and a request in either language is
// recognised by it.
const fi = {
  marker: (runId: string) => `Taskfleet-ajo ${runId}`,
  at: (time: string) => ` klo ${time}`,
  merged: "mergetty, worktree jäljellä",
  failed: (when: string) => `epäonnistui${when}, työ tallessa`,
  ended: (when: string) => `päättyi${when}, ei mergetty, työ tallessa`,
  branch: (branch: string) => `haara ${branch}`,
  worktree: (path: string) => `worktree ${path}`,
  line: (title: string, facts: string, what: string) =>
    `”${title}” (${facts}): ${what}`,
  tail: "Älä muuta mitään ennen kuin vastaan.",
  startedBy: (parent: string) => ` Sen käynnisti keskustelu ”${parent}”.`,
  verbsMerged: "siivotaanko se",
  verbs: "mergeä, jatka tai hylkää",
  one: (line: string, from: string, verbs: string, tail: string) =>
    `Käsittele worker ${line}.${from} Tarkista sen tila ja suosittele, mitä sille tehdään: ${verbs}. ${tail}`,
  manyStartedBy: (parent: string) =>
    `Workerit käynnisti keskustelu ”${parent}”.\n`,
  many: (n: number, list: string, from: string, tail: string) =>
    `Käsittele nämä ${n} keskeneräistä workeria:\n${list}\n${from}Tarkista kunkin tila ja suosittele, mitä niille tehdään: mergeä, jatka tai hylkää. ${tail}`,
};

export const workerRequestsText = catalog(fi, {
  marker: (runId) => `Taskfleet run ${runId}`,
  at: (time) => ` at ${time}`,
  merged: "merged, worktree still there",
  failed: (when) => `failed${when}, work kept`,
  ended: (when) => `ended${when}, not merged, work kept`,
  branch: (branch) => `branch ${branch}`,
  worktree: (path) => `worktree ${path}`,
  line: (title, facts, what) => `"${title}" (${facts}): ${what}`,
  tail: "Don't change anything until I answer.",
  startedBy: (parent) => ` It was started by the conversation "${parent}".`,
  verbsMerged: "whether to clean it up",
  verbs: "merge, continue or discard",
  one: (line, from, verbs, tail) =>
    `Look at the worker ${line}.${from} Check its state and recommend what to do with it: ${verbs}. ${tail}`,
  manyStartedBy: (parent) =>
    `The workers were started by the conversation "${parent}".\n`,
  many: (n, list, from, tail) =>
    `Look at these ${n} unfinished workers:\n${list}\n${from}Check the state of each and recommend what to do with them: merge, continue or discard. ${tail}`,
});

```
