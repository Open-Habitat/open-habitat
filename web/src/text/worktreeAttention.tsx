import type { ReactNode } from "react";
import { catalog, plural } from "../i18n";

// A workspace page's worktree section (components/WorktreeAttention.tsx):
// each worktree named by what it is for the person (a helper, a worker's
// task, an ended worker's leftover) from the Taskfleet run that owns it, and
// only the rows that need the person in view. Helper names, task titles and
// conversation titles come in as arguments.
const fi = {
  count: (n: number, size: string) => `${n} · ${size}`,
  intro:
    "Agenttien työkopiot tässä työtilassa. Näkyvissä ovat ne, jotka tarvitsevat sinua.",
  nothing: "Mikään ei tarvitse sinua.",
  kind: {
    helper: "avustaja",
    worker: "worker",
    ended: "worker, päättynyt",
    none: "worktree",
  },
  from: (conversation: ReactNode, tag: ReactNode) => (
    <>
      keskustelusta {conversation} {tag}
    </>
  ),
  archived: "arkistoitu",
  active: "käynnissä",
  // What keeps the worktree and what happens next.
  helperWaiting: "Avustaja pitää työkopion seuraavaa kierrosta varten.",
  helperLanded: " Kaikki kierrokset on yhdistetty.",
  helperWorking: "Avustaja tekee tässä kierrostaan.",
  helperAttention:
    "Avustajan työ on pysähtynyt tai jäänyt yhdistämättä, joten se ei vapauta työkopiota itse. Agentti hoitaa sen keskustelussa.",
  workerWorking:
    "Worker tekee tässä tehtäväänsä. Pääagentti yhdistää työn, kun se on valmis.",
  workerWaiting:
    "Worker on valmis ja odottaa, että agentti yhdistää tai hylkää sen.",
  workerAttention:
    "Worker on pysähtynyt. Agentti päättää keskustelussa, mitä sille tehdään.",
  archivedNobody:
    " Keskustelu on arkistoitu, joten kukaan ei tee sitä ennen kuin palautat sen.",
  ended: "Worker päättyi, eikä kukaan käytä tätä työkopiota enää.",
  none: "Mikään agentti ei pidä tätä worktreetä.",
  merged: " Työ on yhdistetty, joten poistaminen ei hävitä mitään.",
  ahead: (n: number) =>
    ` ${n === 1 ? "Sen commit jää" : `Sen ${n} committia jäävät`} haaraan, jos poistat työkopion.`,
  dirty: " Siinä on tallentamattomia muutoksia.",
  missing: " Hakemisto on poistettu, mutta Git muistaa sen yhä.",
  releases: (when: string) => `Vapautuu itsestään ${when}.`,
  releasesSoon: "Vapautuu itsestään pian.",
  today: (time: string) => `tänään klo ${time}`,
  tomorrow: (time: string) => `huomenna klo ${time}`,
  on: (date: string) => date,
  // Actions
  restore: "Palauta keskustelu",
  open: "Avaa keskustelu",
  gitFacts: "Git-tiedot",
  directory: "Hakemisto",
  branch: "Haara",
  size: "Koko",
  run: "Taskfleet-ajo",
  aheadOf: (n: number, base: string) =>
    `${n} ${n === 1 ? "commit" : "committia"}, joita ei ole haarassa ${base}`,
  mergedInto: "yhdistetty",
  // The one line of the rest.
  rest: (n: number) => `${n} muuta hoituu ilman sinua`,
  restRelease: (names: string, n: number) =>
    `${names} ${n === 1 ? "vapautuu" : "vapautuvat"} itsestään`,
  restWaiting: (names: string, n: number) =>
    `${names} ${n === 1 ? "odottaa" : "odottavat"} agenttia`,
  restWorking: (names: string, n: number) =>
    `${names} ${n === 1 ? "on" : "ovat"} työssä`,
};

export const worktreeAttentionText = catalog(fi, {
  count: (n, size) => `${n} · ${size}`,
  intro:
    "The agents' working copies in this workspace. The ones that need you are in view.",
  nothing: "Nothing needs you.",
  kind: {
    helper: "helper",
    worker: "worker",
    ended: "worker, ended",
    none: "worktree",
  },
  from: (conversation, tag) => (
    <>
      from {conversation} {tag}
    </>
  ),
  archived: "archived",
  active: "active",
  helperWaiting: "The helper keeps the working copy for its next round.",
  helperLanded: " Every round is merged.",
  helperWorking: "The helper is working on its round here.",
  helperAttention:
    "The helper's work has stalled or was left unmerged, so it does not release the working copy by itself. The agent handles it in the conversation.",
  workerWorking:
    "The worker is doing its task here. The main agent merges the work once it is done.",
  workerWaiting:
    "The worker is done and waits for the agent to merge or discard it.",
  workerAttention:
    "The worker has stalled. The agent decides in the conversation what to do with it.",
  archivedNobody:
    " The conversation is archived, so nobody will do it until you restore it.",
  ended: "The worker ended, and nobody uses this working copy any more.",
  none: "No agent keeps this worktree.",
  merged: " The work is merged, so deleting loses nothing.",
  ahead: (n) =>
    ` ${n === 1 ? "Its commit stays" : `Its ${n} commits stay`} on the branch if you delete the working copy.`,
  dirty: " It has unsaved changes.",
  missing: " The directory has been deleted, but Git still remembers it.",
  releases: (when) => `Releases itself ${when}.`,
  releasesSoon: "Releases itself soon.",
  today: (time) => `today at ${time}`,
  tomorrow: (time) => `tomorrow at ${time}`,
  on: (date) => `on ${date}`,
  restore: "Restore conversation",
  open: "Open conversation",
  gitFacts: "Git details",
  directory: "Directory",
  branch: "Branch",
  size: "Size",
  run: "Taskfleet run",
  aheadOf: (n, base) =>
    `${n} ${plural("en", n, { one: "commit", other: "commits" })} not on the branch ${base}`,
  mergedInto: "merged",
  rest: (n) =>
    `${n} more ${n === 1 ? "takes care of itself" : "take care of themselves"}`,
  restRelease: (names, n) =>
    `${names} ${n === 1 ? "releases itself" : "release themselves"}`,
  restWaiting: (names, n) =>
    `${names} ${n === 1 ? "waits" : "wait"} for the agent`,
  restWorking: (names, n) => `${names} ${n === 1 ? "is" : "are"} working`,
});
