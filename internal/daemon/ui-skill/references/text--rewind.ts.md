# text/rewind.ts

Generated from web/src/text/rewind.ts; do not edit.

```tsx
import { catalog, plural } from "../i18n";

// Palaa tähän (components/Rewind.tsx): the own message's menu item, the
// confirmation sheet above the composer and the history rows a return
// leaves. Files tracked by the agent's edit and write tools are restored in
// full, replacing anyone's later edits. Current contents are saved for undo.
// Files changed only by commands are not tracked.
const messages = (n: number) => (n === 1 ? "1 viestisi" : `${n} viestiäsi`);
const replies = (n: number) => (n === 1 ? "1 vastaus" : `${n} vastausta`);
const files = (n: number) => (n === 1 ? "1 tiedosto" : `${n} tiedostoa`);
const fi = {
  menuLabel: "Viestin toiminnot",
  menuItem: "Palaa tähän…",
  menuItemDesc: "Keskustelu, tiedostot tai molemmat",
  sheetLabel: "Palaa tähän",
  title: (time?: string) =>
    time ? `Palaa ennen viestiäsi klo ${time}` : "Palaa ennen viestiäsi",
  close: "Sulje",
  conversation: "Keskustelu",
  files: "Tiedostot",
  counted: (own: number, rep: number) =>
    own + rep ? `${messages(own)} ja ${replies(rep)}` : "ei viestejä",
  aside: (own: number, rep: number) =>
    own + rep
      ? `${messages(own)} ja ${replies(rep)} sivuun`
      : "Ei mitään sivuun",
  continues: "Jatkuu ennallaan",
  restoring: (n: number) => `${files(n)} palautuu`,
  staying: (n: number) =>
    n === 1 ? "1 tiedosto jää ennalleen" : `${n} tiedostoa jää ennalleen`,
  noChanges: "Agentti ei muuttanut tiedostoja tämän jälkeen",
  noCopies: "Tästä viestistä ei ole kopioita",
  reading: "Luetaan…",
  readFailed: "Tietoja ei voitu lukea; keskustelu voi silti palata.",
  commandsStay: "Vain komennoilla muutetut tiedostot jäävät ennalleen.",
  restoreWarning:
    "Näiden tiedostojen kaikki myöhemmät muutokset korvataan, myös omasi. Nykyinen sisältö tallennetaan ensin, jotta voit perua palautuksen.",
  showFiles: "Näytä tiedostot",
  hideFiles: "Piilota tiedostot",
  created: "uusi",
  deleted: "poistettu",
  more: (n: number) => `ja ${n} muuta`,
  stays: "jää",
  // A restore never rewrites Git history: what was already committed stays
  // in its commits, and the restored files become uncommitted changes.
  committedTag: "commitoitu",
  committed: (names: string[], more: number) =>
    `Jo commitoitu: ${names.join(", ")}${more ? ` ja ${more} muuta` : ""}. Palautus ei kumoa committeja, joten nämä tiedostot näkyvät palautuksen jälkeen commitoimattomina muutoksina.`,
  unreadable: (n: number) =>
    n === 1 ? "1 tiedostoa ei voitu lukea" : `${n} tiedostoa ei voitu lukea`,
  busy: "Agentti on työssä; se pysäytetään ensin.",
  cancel: "Peru",
  chooseOne: "Valitse ainakin toinen",
  goFiles: "Palauta tiedostot",
  goBoth: "Palaa ja palauta",
  goConversation: "Palaa tähän",
  stopAndReturn: "Pysäytä ja palaa",
  stopAndRestore: "Pysäytä ja palauta",
  // History rows.
  earlier: "Aiempi jatko",
  restoredNote: (n: number) => ` · ${files(n)} palautettu`,
  show: "Näytä",
  hide: "Piilota",
  agentDoesNotSee: "Agentti ei näe tätä jatkoa.",
  filesReturn:
    "Sen tiedostomuutokset on peruttu, ja ne palaavat, jos jatkat siitä.",
  canContinue: "Voit jatkaa siitä.",
  branchLoading: "Luetaan jatkoa…",
  branchFailed: "Jatkoa ei voitu lukea.",
  branchEmpty: "Jatkossa ei ollut viestejä.",
  branchPartial: "Näytetään jatkon uusin osa.",
  continueThis: "Jatka tästä jatkosta",
  alsoFiles: "Palauta myös sen tiedostot",
  alsoFilesHint: "Tiedostot palaavat ennen palautusta tallennettuun tilaan",
  filesRestored: (n: number, time?: string) =>
    `${files(n)} palautettu${time ? ` tilaan ennen viestiäsi klo ${time}` : ""}.`,
  conversationContinues:
    "Keskustelu jatkuu ennallaan; agentille kerrottiin palautuksesta.",
  undo: "Peru palautus",
  undone:
    "Tiedostojen palautus peruttu: palautusta edeltänyt sisältö on taas paikallaan. Agentille kerrottiin.",
  fileErrors: (n: number) =>
    n === 1
      ? "1 tiedostoa ei voitu palauttaa."
      : `${n} tiedostoa ei voitu palauttaa.`,
  failed: {
    turn_running: "Agentti aloitti työn. Valitse uudelleen.",
    queued:
      "Agentilla on jonossa viestejä. Odota, että se ottaa ne, tai peru ne ensin.",
    busy: "Edellinen palaaminen on vielä kesken.",
    no_checkpoint: "Tiedostoista ei ole kopiota tälle viestille.",
    not_switchable: "Tähän jatkoon ei voi palata.",
    already_undone: "Palautus on jo peruttu.",
    cancelled: "Palaaminen keskeytyi; mitään ei muutettu.",
    not_found: "Kohta ei ole enää tässä keskustelussa.",
    unavailable: "Palaaminen ei onnistunut juuri nyt.",
    uncertain:
      "Ei tiedetä, ehtikö palaaminen tapahtua. Katso keskustelu ennen kuin yrität uudelleen.",
    login: "Kirjaudu uudelleen ja yritä sitten.",
    start: "Agenttia ei voitu käynnistää palaamista varten.",
  },
};

const enMessages = (n: number) =>
  `${n} ${plural("en", n, { one: "message", other: "messages" })} of yours`;
const enReplies = (n: number) =>
  `${n} ${plural("en", n, { one: "reply", other: "replies" })}`;
const enFiles = (n: number) =>
  `${n} ${plural("en", n, { one: "file", other: "files" })}`;

export const rewindText = catalog(fi, {
  menuLabel: "Message actions",
  menuItem: "Go back here…",
  menuItemDesc: "Conversation, files or both",
  sheetLabel: "Go back here",
  title: (time) =>
    time
      ? `Go back to before your message at ${time}`
      : "Go back to before your message",
  close: "Close",
  conversation: "Conversation",
  files: "Files",
  counted: (own, rep) =>
    own + rep ? `${enMessages(own)} and ${enReplies(rep)}` : "no messages",
  aside: (own, rep) =>
    own + rep
      ? `${enMessages(own)} and ${enReplies(rep)} set aside`
      : "Nothing set aside",
  continues: "Continues as it is",
  restoring: (n) => `${enFiles(n)} restored`,
  staying: (n) => `${enFiles(n)} stay as they are`,
  noChanges: "The agent changed no files after this",
  noCopies: "No copies exist for this message",
  reading: "Reading…",
  readFailed:
    "The details could not be read; the conversation can still go back.",
  commandsStay: "Files changed only by commands stay as they are.",
  restoreWarning:
    "All later changes to these files are replaced, including your own. The current contents are saved first so you can undo the restore.",
  showFiles: "Show files",
  hideFiles: "Hide files",
  created: "new",
  deleted: "deleted",
  more: (n) => `and ${n} more`,
  stays: "stays",
  committedTag: "committed",
  committed: (names, more) =>
    `Already committed: ${names.join(", ")}${more ? ` and ${more} more` : ""}. Restoring does not undo commits, so after it these files show as uncommitted changes.`,
  unreadable: (n) => `${enFiles(n)} could not be read`,
  busy: "The agent is working; it is stopped first.",
  cancel: "Cancel",
  chooseOne: "Choose at least one",
  goFiles: "Restore files",
  goBoth: "Go back and restore",
  goConversation: "Go back here",
  stopAndReturn: "Stop and go back",
  stopAndRestore: "Stop and restore",
  earlier: "Earlier continuation",
  restoredNote: (n) => ` · ${enFiles(n)} restored`,
  show: "Show",
  hide: "Hide",
  agentDoesNotSee: "The agent does not see this continuation.",
  filesReturn:
    "Its file changes were undone, and they come back if you continue from it.",
  canContinue: "You can continue from it.",
  branchLoading: "Reading the continuation…",
  branchFailed: "The continuation could not be read.",
  branchEmpty: "The continuation had no messages.",
  branchPartial: "Showing the newest part of the continuation.",
  continueThis: "Continue from this one",
  alsoFiles: "Restore its files too",
  alsoFilesHint: "The files go back to the state saved before the restore",
  filesRestored: (n, time) =>
    `${enFiles(n)} restored${time ? ` to before your message at ${time}` : ""}.`,
  conversationContinues:
    "The conversation continues as it is; the agent was told about the restore.",
  undo: "Undo restore",
  undone:
    "File restore undone: the contents from before the restore are back in place. The agent was told.",
  fileErrors: (n) => `${enFiles(n)} could not be restored.`,
  failed: {
    turn_running: "The agent started working. Choose again.",
    queued:
      "The agent has queued messages. Wait until it takes them, or cancel them first.",
    busy: "The previous return is still in progress.",
    no_checkpoint: "No copy of the files exists for this message.",
    not_switchable: "This continuation cannot be returned to.",
    already_undone: "The restore was already undone.",
    cancelled: "Going back was interrupted; nothing was changed.",
    not_found: "That point is no longer in this conversation.",
    unavailable: "Going back did not work right now.",
    uncertain:
      "It is not known whether going back happened. Look at the conversation before trying again.",
    login: "Sign in again, then try.",
    start: "The agent could not be started for going back.",
  },
});

```
