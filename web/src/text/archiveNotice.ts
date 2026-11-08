import { catalog } from "../i18n";

// The quiet notice row with an undo (components/ArchiveNotice.tsx).
const fi = {
  archived: "Arkistoitu",
  restore: "Palauta",
  hideOthers: "Piilota muut ilmoitukset",
  showOthers: (n: number) => `Näytä muut ilmoitukset (${n})`,
  hide: "Piilota",
  close: "Sulje ilmoitus",
  helpersWorking: (names: string) =>
    `Kierros on vielä kesken (${names}); sen raportti ei herätä arkistoitua keskustelua.`,
};

export const archiveNoticeText = catalog(fi, {
  archived: "Archived",
  restore: "Restore",
  hideOthers: "Hide the other notices",
  showOthers: (n) => `Show the other notices (${n})`,
  hide: "Hide",
  close: "Dismiss notice",
  helpersWorking: (names) =>
    `A round is still under way (${names}); its report does not wake an archived conversation.`,
});
