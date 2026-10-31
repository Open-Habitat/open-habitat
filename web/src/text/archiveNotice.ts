import { catalog } from "../i18n";

// The quiet notice row with an undo (components/ArchiveNotice.tsx).
const fi = {
  archived: "Arkistoitu",
  restore: "Palauta",
  hideOthers: "Piilota muut ilmoitukset",
  showOthers: (n: number) => `Näytä muut ilmoitukset (${n})`,
  hide: "Piilota",
  close: "Sulje ilmoitus",
};

export const archiveNoticeText = catalog(fi, {
  archived: "Archived",
  restore: "Restore",
  hideOthers: "Hide the other notices",
  showOthers: (n) => `Show the other notices (${n})`,
  hide: "Hide",
  close: "Dismiss notice",
});
