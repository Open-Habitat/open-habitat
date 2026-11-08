# text/archiveNotice.ts

Generated from web/src/text/archiveNotice.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The quiet notice row with an undo (components/ArchiveNotice.tsx).
const fi = {
  archived: "Arkistoitu",
  restore: "Palauta",
  hideOthers: "Piilota muut ilmoitukset",
  showOthers: (n: number) => `Näytä muut ilmoitukset (${n})`,
  hide: "Piilota",
  close: "Sulje ilmoitus",
  // Avustajat (named workers) go with an archived conversation.
  helpersArchived: (names: string) =>
    `Avustajat arkistoitiin mukana (${names}): ne odottavat ja palaavat keskustelun mukana käynnistämättä.`,
  helpersWorking: (names: string) =>
    `Kierros on vielä kesken (${names}); sen raportti ei herätä arkistoitua keskustelua.`,
  helpersUnlanded: (names: string) =>
    `Yhdistämätön työ säilyy avustajan haarassa (${names}).`,
  helpersUnconfirmed: (names: string) =>
    `Viimeisimmän kierroksen yhdistämistä ei ole kirjattu (${names}); jos siinä oli muutoksia, ne ovat avustajan haarassa.`,
};

export const archiveNoticeText = catalog(fi, {
  archived: "Archived",
  restore: "Restore",
  hideOthers: "Hide the other notices",
  showOthers: (n) => `Show the other notices (${n})`,
  hide: "Hide",
  close: "Dismiss notice",
  helpersArchived: (names) =>
    `Its helpers were archived with it (${names}): they wait and come back with the conversation, unstarted.`,
  helpersWorking: (names) =>
    `A round is still under way (${names}); its report does not wake an archived conversation.`,
  helpersUnlanded: (names) =>
    `Work not yet landed stays on the helper's branch (${names}).`,
  helpersUnconfirmed: (names) =>
    `No landing is recorded for the latest round (${names}); any changes it made are on the helper's branch.`,
});

```
