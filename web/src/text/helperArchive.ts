import { catalog } from "../i18n";

const fi = {
  title: "Arkistoi keskustelu",
  lead: "Avustajat arkistoidaan keskustelun mukana:",
  rule: "Arkistointi ei yhdistä mitään. Kun palautat keskustelun, avustajat palaavat sen mukana käynnistämättä.",
  unavailable:
    "Avustajien tilaa ei voitu lukea. Arkistointi ei yhdistä niiden työtä.",
  loading: "Luetaan avustajien tilaa…",
  archive: "Arkistoi",
  cancel: "Peruuta",
  close: "Sulje",
  branch: "Avaa haara",
  branchTitle: "Avustajan haara",
  branchUnavailable: "Haaran tietoja ei ole saatavilla.",
  restored: "Palautettu arkistosta · avustajat palasivat käynnistämättä",
  working: (n: number) => `Kierros ${n} kesken · jää haaraan`,
  unlanded: (n: number) =>
    `Kierros ${n} raportoitu · työ haarassa, ei yhdistetty`,
  unconfirmed: "Yhdistämistä ei ole vahvistettu",
  landed: "Raportoidut kierrokset yhdistetty",
  source: "Lähdehaara",
  worktree: "Työpuu",
};
export const helperArchiveText = catalog(fi, {
  title: "Archive conversation",
  lead: "Helpers are archived with the conversation:",
  rule: "Archiving merges nothing. Restoring the conversation brings its helpers back without starting them.",
  unavailable:
    "Helper status could not be read. Archiving does not merge their work.",
  loading: "Reading helper status…",
  archive: "Archive",
  cancel: "Cancel",
  close: "Close",
  branch: "Open branch",
  branchTitle: "Helper branch",
  branchUnavailable: "Branch details are unavailable.",
  restored: "Restored from archive · helpers returned without starting",
  working: (n) => `Round ${n} unfinished · stays on the branch`,
  unlanded: (n) => `Round ${n} reported · work on the branch, not merged`,
  unconfirmed: "Merge not confirmed",
  landed: "Reported rounds merged",
  source: "Source branch",
  worktree: "Worktree",
});
