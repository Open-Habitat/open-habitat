import type { ReactNode } from "react";
import { catalog, plural } from "../i18n";

// One worktree's row, its blockers and its removal dialogs
// (components/WorktreeList.tsx, app/worktreeText.ts). Host values (names,
// branches, paths, process names) come in as arguments or code segments.
const fi = {
  state: {
    merged: "yhdistetty",
    unmerged: "ei yhdistetty",
    dirty: "muutoksia",
    missing: "hakemisto puuttuu",
    locked: "lukittu",
    unknown: "tila ei tiedossa",
  },
  action: {
    remove: "Poista…",
    // The dialog says in full that the changes are committed to the branch.
    commit: "Tallenna ja poista…",
    force: "Poista pakolla…",
    prune: "Siivoa merkintä",
  },
  none: "Ei linkitettyjä worktreitä.",
  list: "Worktreet",
  detached: "irrallinen HEAD",
  over: "yli ",
  conversations: (n: number) =>
    `${n} ${n === 1 ? "keskustelu" : "keskustelua"}`,
  locked: "Git on lukinnut tämän worktreen",
  lockedEnd: ". Lukittua ei poisteta.",
  ignoredLost: "Gitin ohittamat tiedostot häviävät:",
  ignoredMore: (n: number) => ` ja ${n} muuta`,
  titleCommit: (name: string) =>
    `Tallennetaanko muutokset ja poistetaan ${name}?`,
  titleForce: (name: string) => `Poistetaanko ${name} pakolla?`,
  titleRemove: (name: string) => `Poistetaanko ${name}?`,
  headingCommit: "Tallennetaanko muutokset ja poistetaan ",
  headingRemove: "Poistetaanko ",
  headingForce: " pakolla",
  leadCommit: (branch: ReactNode) => (
    <>
      Kaikki muutokset ja uudet tiedostot commitoidaan haaraan {branch}, ja
      worktreen hakemisto poistetaan. Haara säilyy, joten työn saa takaisin
      komennolla <code>git worktree add</code>.
    </>
  ),
  leadForce:
    "Hakemisto poistetaan, ja nämä häviävät lopullisesti. Tätä ei voi perua.",
  forceBranchKept: (branch: ReactNode) => (
    <>Haara {branch} ja sen commitit säilyvät.</>
  ),
  leadMerged: (branch: ReactNode, base: ReactNode) => (
    <>
      Haara {branch} on yhdistetty haaraan {base}, joten worktreen hakemisto ja
      haara poistetaan. Mitään commitoitua ei häviä.
    </>
  ),
  leadRemove: "Worktreen hakemisto poistetaan.",
  branchKept: (branch: ReactNode) => (
    <>Haara {branch} säilyy, joten sen commitit eivät häviä.</>
  ),
  typeName: (name: ReactNode) => <>Kirjoita {name} vahvistukseksi</>,
  inUse: "Ei poistettu, koska nämä käyttävät worktreetä:",
  cancel: "Peruuta",
  confirmCommit: "Tallenna ja poista",
  confirmForce: "Poista pakolla",
  confirmRemove: "Poista",
  cleanTitle: "Siivotaanko yhdistetyt worktreet?",
  cleanLead: (n: number) =>
    n === 1
      ? "Tämän worktreen hakemisto ja haara poistetaan."
      : `Näiden ${n} worktreen hakemistot ja haarat poistetaan.`,
  cleanSafe: "Haarat on yhdistetty, joten mitään commitoitua ei häviä.",
  ignoredLostFrom: "Gitin ohittamat tiedostot häviävät näistä:",
  cleanConfirm: (n: number) =>
    `Siivoa ${n === 1 ? "1 worktree" : `${n} worktreetä`}`,
  // Blockers
  fileOperation: "Tiedoston käsittely on kesken.",
  fileOperationHow: "Odota käsittelyn päättymistä.",
  process: "Prosessi ",
  processEnd: " on worktreen hakemistossa.",
  processHow: "Sulje se tai siirry siinä pois hakemistosta.",
  run: "Taskfleet-ajo ",
  runEnd: " omistaa tämän worktreen.",
  runHow:
    "Ajo päättää itse, mitä worktreelle tapahtuu. Odota, että se päättyy, tai peru se:",
  nestedWorktree: "Worktreen sisällä on toinen worktree ",
  nestedWorktreeHow: "Poista sisempi ensin.",
  nestedRepo: "Worktreen sisällä on toinen Git-repo ",
  nestedRepoHow:
    "Sen historiaa tai muutoksia ei tallenneta haaraan. Siirrä tai poista se ensin.",
  outsideHome: "Worktree on kotihakemiston ulkopuolella: ",
  outsideHomeHow:
    "Selain poistaa vain kotihakemistossa olevia worktreitä. Poista tämä komennolla git worktree remove.",
  mount: "Worktreen alla on liitos ",
  mountHow: "Irrota se ensin.",
  unknown:
    "Worktreetä ei voitu lukea, tai hakemisto ei ole enää tämän worktreen.",
  unknownHow: "Tarkista tilanne komennolla git worktree list.",
  // Facts
  changed: (n: number) =>
    `${n} ${n === 1 ? "muutettu tiedosto" : "muutettua tiedostoa"}`,
  untracked: (n: number) =>
    `${n} ${n === 1 ? "uusi tiedosto" : "uutta tiedostoa"}`,
  ahead: (n: number, base: string) =>
    `${n} ${n === 1 ? "commit" : "committia"}, joita ei ole haarassa ${base}`,
  unreachable: "Irrallinen HEAD, jonka committeja mikään haara ei sisällä",
  // Refusals and outcomes
  refusals: {
    worktree_missing: "Tätä worktreetä ei enää löydy. Lista päivitettiin.",
    worktree_changed:
      "Worktree muuttui sen jälkeen, kun lista luettiin. Mitään ei poistettu; katso lista ja yritä uudelleen.",
    worktrees_changed:
      "Yhdistettyjen worktreiden joukko muuttui. Mitään ei poistettu; katso lista ja vahvista uudelleen.",
    commit_failed:
      "Muutoksia ei voitu tallentaa haaraan, joten mitään ei poistettu. Tarkista Gitin nimi ja sähköposti tai commitoi itse.",
  } as Record<string, string>,
  pruned: (name: string) =>
    `${name}: vanhentunut merkintä poistettu Gitin luettelosta.`,
  blocked: (name: string, why: string) => `${name} ei poistettu: ${why}`,
  partial: (name: string, n: number) =>
    `${name}: osa jäi poistamatta (${n}). Se näkyy listassa, ja sen voi poistaa uudelleen.`,
  committed: (sha: string) =>
    ` Muutokset tallennettiin haaraan commitiksi ${sha}.`,
  branchDeleted: (branch: string) => ` Haara ${branch} poistettiin.`,
  branchStays: (branch: string) => ` Haara ${branch} säilyy.`,
  branchStayed: (branch: string, moved: boolean) =>
    ` Haara ${branch} säilyi, koska ${moved ? "se oli muuttunut" : "se on käytössä toisessa checkoutissa"}.`,
  removed: (name: string) => `${name} poistettu.`,
};

export const worktreesText = catalog(fi, {
  state: {
    merged: "merged",
    unmerged: "not merged",
    dirty: "changes",
    missing: "directory missing",
    locked: "locked",
    unknown: "state unknown",
  },
  action: {
    remove: "Delete…",
    commit: "Save and delete…",
    force: "Force delete…",
    prune: "Clean up entry",
  },
  none: "No linked worktrees.",
  list: "Worktrees",
  detached: "detached HEAD",
  over: "over ",
  conversations: (n) =>
    `${n} ${plural("en", n, { one: "conversation", other: "conversations" })}`,
  locked: "Git has locked this worktree",
  lockedEnd: ". A locked worktree is not deleted.",
  ignoredLost: "Files Git ignores will be lost:",
  ignoredMore: (n) => ` and ${n} more`,
  titleCommit: (name) => `Save the changes and delete ${name}?`,
  titleForce: (name) => `Force delete ${name}?`,
  titleRemove: (name) => `Delete ${name}?`,
  headingCommit: "Save the changes and delete ",
  headingRemove: "Delete ",
  headingForce: " by force",
  leadCommit: (branch) => (
    <>
      All changes and new files are committed to the branch {branch}, and the
      worktree's directory is deleted. The branch stays, so the work can be
      brought back with <code>git worktree add</code>.
    </>
  ),
  leadForce:
    "The directory is deleted, and these are lost for good. This cannot be undone.",
  forceBranchKept: (branch) => <>The branch {branch} and its commits stay.</>,
  leadMerged: (branch, base) => (
    <>
      The branch {branch} is merged into {base}, so the worktree's directory and
      the branch are deleted. Nothing committed is lost.
    </>
  ),
  leadRemove: "The worktree's directory is deleted.",
  branchKept: (branch) => (
    <>The branch {branch} stays, so its commits are not lost.</>
  ),
  typeName: (name) => <>Type {name} to confirm</>,
  inUse: "Not deleted, because these are using the worktree:",
  cancel: "Cancel",
  confirmCommit: "Save and delete",
  confirmForce: "Force delete",
  confirmRemove: "Delete",
  cleanTitle: "Clean up the merged worktrees?",
  cleanLead: (n) =>
    n === 1
      ? "This worktree's directory and branch are deleted."
      : `The directories and branches of these ${n} worktrees are deleted.`,
  cleanSafe: "The branches are merged, so nothing committed is lost.",
  ignoredLostFrom: "Files Git ignores will be lost from these:",
  cleanConfirm: (n) =>
    `Clean up ${n} ${plural("en", n, { one: "worktree", other: "worktrees" })}`,
  fileOperation: "A file operation is in progress.",
  fileOperationHow: "Wait for it to finish.",
  process: "The process ",
  processEnd: " is in the worktree's directory.",
  processHow: "Close it or move it out of the directory.",
  run: "The Taskfleet run ",
  runEnd: " owns this worktree.",
  runHow:
    "The run decides itself what happens to the worktree. Wait for it to end, or cancel it:",
  nestedWorktree: "Inside the worktree is another worktree ",
  nestedWorktreeHow: "Delete the inner one first.",
  nestedRepo: "Inside the worktree is another Git repository ",
  nestedRepoHow:
    "Its history and changes are not saved to the branch. Move or delete it first.",
  outsideHome: "The worktree is outside the home directory: ",
  outsideHomeHow:
    "The browser only deletes worktrees in the home directory. Delete this one with git worktree remove.",
  mount: "Under the worktree is a mount ",
  mountHow: "Unmount it first.",
  unknown:
    "The worktree could not be read, or the directory no longer belongs to this worktree.",
  unknownHow: "Check the situation with git worktree list.",
  changed: (n) =>
    `${n} ${plural("en", n, { one: "changed file", other: "changed files" })}`,
  untracked: (n) =>
    `${n} ${plural("en", n, { one: "new file", other: "new files" })}`,
  ahead: (n, base) =>
    `${n} ${plural("en", n, { one: "commit", other: "commits" })} not on the branch ${base}`,
  unreachable: "Detached HEAD whose commits no branch contains",
  refusals: {
    worktree_missing: "This worktree no longer exists. The list was updated.",
    worktree_changed:
      "The worktree changed after the list was read. Nothing was deleted; check the list and try again.",
    worktrees_changed:
      "The set of merged worktrees changed. Nothing was deleted; check the list and confirm again.",
    commit_failed:
      "The changes could not be saved to the branch, so nothing was deleted. Check your Git name and email, or commit yourself.",
  },
  pruned: (name) => `${name}: stale entry removed from Git's list.`,
  blocked: (name, why) => `${name} was not deleted: ${why}`,
  partial: (name, n) =>
    `${name}: some was left undeleted (${n}). It shows in the list and can be deleted again.`,
  committed: (sha) => ` The changes were saved to the branch as commit ${sha}.`,
  branchDeleted: (branch) => ` The branch ${branch} was deleted.`,
  branchStays: (branch) => ` The branch ${branch} stays.`,
  branchStayed: (branch, moved) =>
    ` The branch ${branch} was kept because ${moved ? "it had changed" : "it is in use in another checkout"}.`,
  removed: (name) => `${name} deleted.`,
});
