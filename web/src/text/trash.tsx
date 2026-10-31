import type { ReactNode } from "react";
import { catalog, plural } from "../i18n";

// Workspace deletion and the Trash (app/trashText.ts,
// components/WorkspaceTrash.tsx, app/PersonalStorage.tsx). Host values
// (process names, paths, run IDs) come in as arguments.
const fi = {
  unknownChecks: {
    processes: "Prosesseja ei voitu tarkistaa.",
    taskfleet: "Taskfleetin ajoja ei voitu lukea.",
    worktrees: "Gitin worktree-luetteloa ei voitu lukea.",
    mounts: "Liitoksia ei voitu lukea.",
    trash: "Roskakoria ei voitu tarkistaa.",
    workspaces: "Muita työtiloja ei voitu laskea.",
  } as Record<string, string>,
  unknownHow:
    "Tuntematon estää poiston varmuuden vuoksi. Tarkista uudelleen hetken päästä.",
  lastWorkspace:
    "Tämä on ainoa työtilasi, joten sitä ei voi siirtää roskakoriin.",
  lastWorkspaceHow: "Lisää ensin toinen työtila, jos haluat poistaa tämän.",
  thisWorkspace: "tämän työtilan",
  thisWorktree: "tämän worktreen",
  question: (place: string) =>
    `Agentti odottaa vastaustasi ${place} keskustelussa.`,
  questionHow: "Vastaa kysymykseen tai pysäytä vuoro keskustelusta.",
  processes: (place: string) =>
    `Agentin käynnistämä taustaprosessi on käynnissä ${place} keskustelussa.`,
  processesHow:
    "Odota, että se päättyy, tai pysäytä se keskustelun prosesseista.",
  piUnknown: (place: string) =>
    `Agentin tilaa ${place} keskustelussa ei voitu tarkistaa.`,
  piUnknownHow: "Tarkista uudelleen hetken päästä, tai pysäytä keskustelu.",
  working: (place: string) => `Agentti työskentelee ${place} keskustelussa.`,
  workingHow: "Odota, että vuoro päättyy, tai pysäytä se keskustelusta.",
  fileOperation: "Tiedoston käsittely on kesken.",
  fileOperationHow: "Odota käsittelyn päättymistä.",
  terminal: "Pääte on auki tässä työtilassa.",
  terminalHow:
    "Sulje pääte ja sen käynnissä olevat komennot, sitten tarkista uudelleen.",
  editor: "Editori on auki tässä työtilassa.",
  editorHow:
    "Tallenna tiedostot ensin. Pysäytys sulkee editorin kaikissa työtiloissasi. Tarkista sitten uudelleen.",
  processBefore: "Prosessi ",
  processAfter: " on työtilan hakemistossa.",
  processHow: "Sulje se tai siirry siinä pois hakemistosta.",
  runBefore: "Taskfleet-ajo ",
  runAfter: " käyttää repoa.",
  runHow: "Odota, että ajo päättyy, tai peru se:",
  linkedBefore: "Repolla on linkitetty worktree ",
  linkedHow:
    "Poista se ensin työtilan Worktreet-listasta tai komennolla, muuten se jäisi orvoksi:",
  lockedBefore: "Repolla on lukittu worktree ",
  lockedHow: "Avaa lukko ja poista se ensin:",
  isLinked: "Tämä työtila on toisen repon linkitetty worktree.",
  isLinkedHow:
    "Poista se komennolla git worktree remove tai työkalulla, joka sen loi.",
  containsBefore: "Hakemistossa on toisen repon worktree ",
  containsHow: "Poista se ensin pääkloonista komennolla git worktree remove.",
  mountBefore: "Hakemiston alla on liitos ",
  mountHow: "Irrota se ensin.",
  differentFs: "Roskakori on eri levyllä kuin ~/src.",
  differentFsHow:
    "Työtilaa ei kopioida levyltä toiselle. Asennus pitää korjata.",
  processUnknownBefore: "Prosessia ",
  processUnknownAfter: " ei voitu tarkistaa.",
  checkFailed: "Tarkistusta ei voitu tehdä.",
  refusals: {
    workspace_busy: "Toinen työtilamuutos on kesken. Yritä hetken päästä.",
    workspace_changed:
      "Työtila muuttui tarkistuksen jälkeen. Tarkista uudelleen.",
    workspace_missing: "Työtilaa ei enää löydy.",
    workspace_uncertain:
      "Työtilan tilaa ei voitu vahvistaa. Mitään ei siirretty.",
    workspace_not_clean:
      "Työtila ei ole enää puhdas, joten sitä ei poistettu. Tarkista uudelleen.",
    workspace_exists:
      "Alkuperäinen nimi on jo käytössä. Nimeä tai poista kohde ensin; palautus ei nimeä mitään uudelleen.",
    workspace_partial:
      "Siirron tulosta ei voitu vahvistaa. Tarkista alkuperäinen paikka ja roskakori.",
    trash_parent_missing:
      "Palautuskansio puuttuu. Luo alkuperäinen kansio uudelleen ennen palautusta.",
    trash_destination_unavailable:
      "Palautuskansiota ei voitu avata turvallisesti. Tarkista polku ja oikeudet.",
    trash_unavailable: "Roskakoria ei voitu käyttää. Mitään ei siirretty.",
    trash_entry_missing: "Tätä kohdetta ei ole enää roskakorissa.",
    confirmation_mismatch: "Nimi ei täsmää.",
    trash_changed:
      "Roskakori muuttui sillä välin. Mitään ei poistettu; katso lista ja vahvista uudelleen.",
    identity_lost: "Istunto päättyi. Kirjaudu uudelleen.",
    invalid_reply: "Palvelimen vastausta ei voitu vahvistaa.",
    unavailable: "Palvelin ei vastannut. Yritä hetken päästä.",
  } as Record<string, string>,
  gitPartial: "Gitin tilaa ei voitu lukea kokonaan.",
  noRemote: "Ei haettua etärepoa: koko Git-historia on vain täällä.",
  changed: (n: number) =>
    `${n} ${n === 1 ? "muutettu tiedosto" : "muutettua tiedostoa"}, ei commitoitu`,
  untracked: (n: number) =>
    `${n} ${n === 1 ? "uusi tiedosto" : "uutta tiedostoa"}, ei Gitissä`,
  unpushed: (n: number) =>
    `${n} ${n === 1 ? "commit" : "committia"}, joita ei ole etärepossa`,
  stash: (n: number) =>
    `${n} ${n === 1 ? "stash-merkintä" : "stash-merkintää"}`,
  nested: (n: number) =>
    `${n} ${n === 1 ? "sisäkkäinen repo" : "sisäkkäistä repoa"}, joiden etärepoa ei tarkistettu`,
  chipNoRemote: "ei etärepoa",
  chipUnpushed: (n: number) =>
    `${n} ${n === 1 ? "commit" : "committia"} vain täällä`,
  chipChanges: (n: number) => `${n} ${n === 1 ? "muutos" : "muutosta"}`,
  chipGitUnknown: "Git-tila ei tiedossa",
  chipAllRemote: "kaikki etärepossa",
  conversationsKept: (n: number) =>
    `${n} ${n === 1 ? "keskustelu säilyy" : "keskustelua säilyy"} agentin historiassa.`,
  today: (time: string) => `tänään klo ${time}`,
  onDay: (day: string, time: string) => `${day} klo ${time}`,

  trashPlace: "Asetukset › Tallennustila",
  copyCommand: "Kopioi komento",
  copied: "Kopioitu",
  openNamed: (title: string) => `Avaa ${title}`,
  openConversation: "Avaa keskustelu",
  labelBlocked: (name: string) => `Työtilaa ${name} ei voi poistaa nyt`,
  labelPermanent: (name: string) => `Poistetaanko ${name}?`,
  labelTrash: (name: string) => `Siirretäänkö ${name} roskakoriin?`,
  labelDelete: (name: string) => `Poista ${name}`,
  checking: (name: ReactNode): ReactNode => (
    <>Tarkistetaan, käyttääkö jokin työtilaa {name}…</>
  ),
  checkFailedTitle: (name: ReactNode): ReactNode => (
    <>Työtilaa {name} ei voitu tarkistaa</>
  ),
  close: "Sulje",
  recheck: "Tarkista uudelleen",
  blockedTitle: (name: ReactNode): ReactNode => (
    <>Työtilaa {name} ei voi poistaa nyt</>
  ),
  inUse: "Nämä käyttävät työtilaa. Mitään ei ole siirretty.",
  notBlocking: "Keskustelut ja Gitin muutokset eivät estä poistoa.",
  permanentTitle: (name: ReactNode): ReactNode => <>Poistetaanko {name}?</>,
  allRemote: (remote: ReactNode): ReactNode => (
    <>
      Kaikki on tallessa etärepossa{remote}, joten työtila poistetaan pysyvästi.
      Sen saa takaisin kloonaamalla.
    </>
  ),
  noChanges: "Ei muutoksia eikä uusia tiedostoja",
  allCommits: (fetched?: string) =>
    `Kaikki commitit ovat etärepossa${fetched ? ` (haettu ${fetched})` : ""}`,
  noStash: "Ei stash-merkintöjä",
  fetchFirst:
    "Etärepo haetaan vielä ennen poistoa. Jos jotain puuttuu, työtila menee roskakoriin.",
  ignoredLost: "Gitin ohittamat tiedostot häviävät:",
  andMore: (n: number) => ` ja ${n} muuta`,
  cancel: "Peruuta",
  deletePermanently: "Poista pysyvästi",
  notGit: "Hakemisto ei ole Git-repo, joten sen sisältö on vain täällä.",
  trashTitle: (name: ReactNode): ReactNode => (
    <>Siirretäänkö {name} roskakoriin?</>
  ),
  restoreFrom: (place: string, size?: string, more?: boolean) =>
    `Sen voi palauttaa kohdasta ${place}${size ? ` (${more ? "yli " : ""}${size})` : ""}.`,
  onlyHereLead: "Roskakoriin eikä suoraan pois, koska tämä on vain täällä:",
  moveToTrash: "Siirrä roskakoriin",
  usageLabel: (usage: string, limit: string, trash?: string) =>
    `Käytössä ${usage} / ${limit}${trash !== undefined ? `, roskakorissa ${trash}` : ""}`,
  usageOther: "Työtilat, agentin historia ja välimuistit",
  trash: "Roskakori",
  empty: "Roskakori on tyhjä.",
  nameTaken: (path: string) =>
    `${path} on jo käytössä. Nimeä tai poista se ensin.`,
  parentMissing:
    "Palautuskansio puuttuu. Luo alkuperäinen kansio uudelleen ennen palautusta.",
  unknownPlace:
    "Alkuperäistä paikkaa ei tiedetä, joten tämän voi vain poistaa.",
  restoreUnknown: "Palautusta ei voitu tarkistaa juuri nyt.",
  deleted: (when: string) => `Poistettu ${when}`,
  size: (size: string, more: boolean) => `${more ? "yli " : ""}${size}`,
  conversations: (n: number) =>
    `${n} ${n === 1 ? "keskustelu" : "keskustelua"}`,
  onlyHereChip: "vain täällä",
  restoreNamed: (name: string) => `Palauta ${name}`,
  restore: "Palauta",
  purgeNamed: (name: string) => `Poista ${name} pysyvästi…`,
  purge: "Poista pysyvästi…",
  purgeLabel: (name: string) => `Poistetaanko ${name} pysyvästi?`,
  purgeTitle: (name: ReactNode): ReactNode => (
    <>Poistetaanko {name} pysyvästi?</>
  ),
  cannotUndo: (size?: string) =>
    `Tätä ei voi perua.${size ? ` ${size} vapautuu.` : ""}`,
  reading: "Luetaan, mitä siinä on…",
  folderRemoved: "Kansio ja sen sisältö poistetaan tältä palvelimelta.",
  lostForever: "Häviää lopullisesti, koska se on vain täällä:",
  everythingRemote: (remote: ReactNode): ReactNode => (
    <>Kaikki on etärepossa{remote}.</>
  ),
  typeToConfirm: (name: ReactNode): ReactNode => (
    <>Kirjoita {name} vahvistukseksi</>
  ),
  emptyQuestion: "Tyhjennetäänkö roskakori?",
  emptyBody: (count: number, size?: string) =>
    `${count === 1 ? "1 kohde" : `${count} kohdetta`} poistetaan pysyvästi${size ? `, ja ${size} vapautuu` : ""}. Tätä ei voi perua.`,
  emptyTrash: "Tyhjennä roskakori",

  usage: "Käyttö",
  usageFailed: "Tallennustietoa ei voitu hakea.",
  usageLoading: "Haetaan tallennustietoa…",
  sharedFree: (free: ReactNode, capacity: string): ReactNode => (
    <>
      {free} vapaana palvelimen levyllä ({capacity}).
    </>
  ),
  sharedNote:
    "Tällä palvelimella ei ole käyttäjäkohtaisia tallennusrajoja. Kaikkien kotihakemistot ovat samalla levyllä, joten kenen tahansa tiedostot voivat täyttää sen.",
  restored: (name: string, path: string) => `${name} palautettu: ${path}.`,
  restoredOther: (name: string, path: string) =>
    `${name} palautettiin, mutta nimen takana on nyt jotain muuta. Tarkista ${path}.`,
  purged: (name: string, size?: string) =>
    `${name} poistettu pysyvästi.${size ? ` ${size} vapautui.` : ""}`,
  notPurged: (why: string) => `Ei poistettu: ${why}`,
  partlyPurged: (n: number) => `Osa jäi poistamatta (${n}). Yritä uudelleen.`,
  emptied: "Roskakori tyhjennetty.",
  keptPartial: "osa jäi poistamatta.",
  keptChanged: "se ei ollut enää sama kohde.",
  emptiedSome: (deleted: number, kept: number, why: string) =>
    `${deleted} poistettiin, ${kept} jäi. ${why}`,
  emptyOpen: "Tyhjennä roskakori…",
  trashIntro: (dir: ReactNode, tool: ReactNode): ReactNode => (
    <>
      Poistetut kansiot säilyvät täällä kokonaisina, kunnes poistat ne
      pysyvästi. Tämä on kotihakemistosi roskakori ({dir}), jonka myös {tool}{" "}
      näkee.
    </>
  ),
  trashReadFailed: "Roskakoria ei voitu lukea.",
  retry: "Yritä uudelleen",
  trashReading: "Luetaan roskakoria…",
  showingFirst: (n: number) => `Näytetään ${n} ensimmäistä.`,
};

export const trashText = catalog(fi, {
  unknownChecks: {
    processes: "The processes could not be checked.",
    taskfleet: "Taskfleet's runs could not be read.",
    worktrees: "Git's worktree list could not be read.",
    mounts: "The mounts could not be read.",
    trash: "The Trash could not be checked.",
    workspaces: "The other workspaces could not be counted.",
  },
  unknownHow:
    "Something unknown blocks the deletion to be safe. Check again in a moment.",
  lastWorkspace:
    "This is your only workspace, so it cannot be moved to the Trash.",
  lastWorkspaceHow:
    "First add another workspace if you want to delete this one.",
  thisWorkspace: "this workspace's",
  thisWorktree: "this worktree's",
  question: (place) =>
    `The agent is waiting for your answer in ${place} conversation.`,
  questionHow: "Answer the question or stop the turn from the conversation.",
  processes: (place) =>
    `A background process the agent started is running in ${place} conversation.`,
  processesHow:
    "Wait for it to end, or stop it from the conversation's processes.",
  piUnknown: (place) =>
    `The agent's state in ${place} conversation could not be checked.`,
  piUnknownHow: "Check again in a moment, or stop the conversation.",
  working: (place) => `The agent is working in ${place} conversation.`,
  workingHow: "Wait for the turn to end, or stop it from the conversation.",
  fileOperation: "A file operation is under way.",
  fileOperationHow: "Wait for the operation to end.",
  terminal: "A terminal is open in this workspace.",
  terminalHow:
    "Close the terminal and the commands running in it, then check again.",
  editor: "The editor is open in this workspace.",
  editorHow:
    "Save the files first. Stopping closes the editor in all your workspaces. Then check again.",
  processBefore: "The process ",
  processAfter: " is in the workspace's directory.",
  processHow: "Close it or move it out of the directory.",
  runBefore: "The Taskfleet run ",
  runAfter: " uses the repository.",
  runHow: "Wait for the run to end, or cancel it:",
  linkedBefore: "The repository has the linked worktree ",
  linkedHow:
    "Remove it first from the workspace's Worktrees list or with the command, or it would be left orphaned:",
  lockedBefore: "The repository has the locked worktree ",
  lockedHow: "Unlock it and remove it first:",
  isLinked: "This workspace is a linked worktree of another repository.",
  isLinkedHow:
    "Remove it with git worktree remove or with the tool that created it.",
  containsBefore: "The directory has another repository's worktree ",
  containsHow: "Remove it first from the main clone with git worktree remove.",
  mountBefore: "There is a mount under the directory: ",
  mountHow: "Unmount it first.",
  differentFs: "The Trash is on another disk than ~/src.",
  differentFsHow:
    "A workspace is not copied from one disk to another. The installation has to be fixed.",
  processUnknownBefore: "The process ",
  processUnknownAfter: " could not be checked.",
  checkFailed: "The check could not be made.",
  refusals: {
    workspace_busy:
      "Another workspace change is under way. Try again in a moment.",
    workspace_changed: "The workspace changed after the check. Check again.",
    workspace_missing: "The workspace is no longer found.",
    workspace_uncertain:
      "The workspace's state could not be confirmed. Nothing was moved.",
    workspace_not_clean:
      "The workspace is no longer clean, so it was not deleted. Check again.",
    workspace_exists:
      "The original name is already in use. Rename or remove that first; restoring renames nothing.",
    workspace_partial:
      "The result of the move could not be confirmed. Check the original place and the Trash.",
    trash_parent_missing:
      "The folder to restore into is missing. Create the original folder again before restoring.",
    trash_destination_unavailable:
      "The folder to restore into could not be opened safely. Check the path and permissions.",
    trash_unavailable: "The Trash could not be used. Nothing was moved.",
    trash_entry_missing: "This item is no longer in the Trash.",
    confirmation_mismatch: "The name does not match.",
    trash_changed:
      "The Trash changed meanwhile. Nothing was deleted; look at the list and confirm again.",
    identity_lost: "The session ended. Sign in again.",
    invalid_reply: "The server's reply could not be confirmed.",
    unavailable: "The server did not answer. Try again in a moment.",
  },
  gitPartial: "Git's state could not be read fully.",
  noRemote: "No fetched remote: the whole Git history is only here.",
  changed: (n) =>
    `${n} ${plural("en", n, { one: "changed file", other: "changed files" })}, not committed`,
  untracked: (n) =>
    `${n} ${plural("en", n, { one: "new file", other: "new files" })}, not in Git`,
  unpushed: (n) =>
    `${n} ${plural("en", n, { one: "commit", other: "commits" })} not on the remote`,
  stash: (n) =>
    `${n} ${plural("en", n, { one: "stash entry", other: "stash entries" })}`,
  nested: (n) =>
    `${n} ${plural("en", n, { one: "nested repository", other: "nested repositories" })} whose remote was not checked`,
  chipNoRemote: "no remote",
  chipUnpushed: (n) =>
    `${n} ${plural("en", n, { one: "commit", other: "commits" })} only here`,
  chipChanges: (n) =>
    `${n} ${plural("en", n, { one: "change", other: "changes" })}`,
  chipGitUnknown: "Git state unknown",
  chipAllRemote: "all on the remote",
  conversationsKept: (n) =>
    `${n} ${plural("en", n, { one: "conversation stays", other: "conversations stay" })} in the agent's history.`,
  today: (time) => `today at ${time}`,
  onDay: (day, time) => `${day} at ${time}`,

  trashPlace: "Settings › Storage",
  copyCommand: "Copy command",
  copied: "Copied",
  openNamed: (title) => `Open ${title}`,
  openConversation: "Open conversation",
  labelBlocked: (name) => `The workspace ${name} cannot be deleted now`,
  labelPermanent: (name) => `Delete ${name}?`,
  labelTrash: (name) => `Move ${name} to the Trash?`,
  labelDelete: (name) => `Delete ${name}`,
  checking: (name) => <>Checking whether anything uses the workspace {name}…</>,
  checkFailedTitle: (name) => <>The workspace {name} could not be checked</>,
  close: "Close",
  recheck: "Check again",
  blockedTitle: (name) => <>The workspace {name} cannot be deleted now</>,
  inUse: "These use the workspace. Nothing has been moved.",
  notBlocking: "Conversations and Git changes do not block deletion.",
  permanentTitle: (name) => <>Delete {name}?</>,
  allRemote: (remote) => (
    <>
      Everything is safe on the remote{remote}, so the workspace is deleted
      permanently. Cloning brings it back.
    </>
  ),
  noChanges: "No changes and no new files",
  allCommits: (fetched) =>
    `All commits are on the remote${fetched ? ` (fetched ${fetched})` : ""}`,
  noStash: "No stash entries",
  fetchFirst:
    "The remote is fetched once more before deleting. If something is missing, the workspace goes to the Trash.",
  ignoredLost: "Files Git ignores are lost:",
  andMore: (n) => ` and ${n} more`,
  cancel: "Cancel",
  deletePermanently: "Delete permanently",
  notGit: "The directory is not a Git repository, so its content is only here.",
  trashTitle: (name) => <>Move {name} to the Trash?</>,
  restoreFrom: (place, size, more) =>
    `It can be restored under ${place}${size ? ` (${more ? "over " : ""}${size})` : ""}.`,
  onlyHereLead:
    "To the Trash and not straight away, because this is only here:",
  moveToTrash: "Move to the Trash",
  usageLabel: (usage, limit, trash) =>
    `In use ${usage} / ${limit}${trash !== undefined ? `, in the Trash ${trash}` : ""}`,
  usageOther: "Workspaces, agent history and caches",
  trash: "Trash",
  empty: "The Trash is empty.",
  nameTaken: (path) => `${path} is already in use. Rename or remove it first.`,
  parentMissing:
    "The folder to restore into is missing. Create the original folder again before restoring.",
  unknownPlace: "The original place is not known, so this can only be deleted.",
  restoreUnknown: "Restoring could not be checked just now.",
  deleted: (when) => `Deleted ${when}`,
  size: (size, more) => `${more ? "over " : ""}${size}`,
  conversations: (n) =>
    `${n} ${plural("en", n, { one: "conversation", other: "conversations" })}`,
  onlyHereChip: "only here",
  restoreNamed: (name) => `Restore ${name}`,
  restore: "Restore",
  purgeNamed: (name) => `Delete ${name} permanently…`,
  purge: "Delete permanently…",
  purgeLabel: (name) => `Delete ${name} permanently?`,
  purgeTitle: (name) => <>Delete {name} permanently?</>,
  cannotUndo: (size) =>
    `This cannot be undone.${size ? ` ${size} is freed.` : ""}`,
  reading: "Reading what is in it…",
  folderRemoved: "The folder and its content are deleted from this server.",
  lostForever: "Lost for good, because it is only here:",
  everythingRemote: (remote) => <>Everything is on the remote{remote}.</>,
  typeToConfirm: (name) => <>Type {name} to confirm</>,
  emptyQuestion: "Empty the Trash?",
  emptyBody: (count, size) =>
    `${count} ${plural("en", count, { one: "item is", other: "items are" })} deleted permanently${size ? `, and ${size} is freed` : ""}. This cannot be undone.`,
  emptyTrash: "Empty the Trash",

  usage: "Usage",
  usageFailed: "The storage information could not be fetched.",
  usageLoading: "Fetching the storage information…",
  sharedFree: (free, capacity) => (
    <>
      {free} free on the server's disk ({capacity}).
    </>
  ),
  sharedNote:
    "This server has no per-user storage limits. Everyone's home directories are on the same disk, so anyone's files can fill it.",
  restored: (name, path) => `${name} restored: ${path}.`,
  restoredOther: (name, path) =>
    `${name} was restored, but something else is now behind the name. Check ${path}.`,
  purged: (name, size) =>
    `${name} deleted permanently.${size ? ` ${size} was freed.` : ""}`,
  notPurged: (why) => `Not deleted: ${why}`,
  partlyPurged: (n) => `Some was left undeleted (${n}). Try again.`,
  emptied: "The Trash was emptied.",
  keptPartial: "some was left undeleted.",
  keptChanged: "it was no longer the same item.",
  emptiedSome: (deleted, kept, why) =>
    `${deleted} deleted, ${kept} kept. ${why}`,
  emptyOpen: "Empty the Trash…",
  trashIntro: (dir, tool) => (
    <>
      Deleted folders are kept here whole until you delete them permanently.
      This is your home directory's Trash ({dir}), which {tool} also sees.
    </>
  ),
  trashReadFailed: "The Trash could not be read.",
  retry: "Try again",
  trashReading: "Reading the Trash…",
  showingFirst: (n) => `Showing the first ${n}.`,
});
