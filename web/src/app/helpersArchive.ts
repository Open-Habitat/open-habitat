import { textNow } from "../i18n";
import { archiveNoticeText } from "../text/archiveNotice";
import { liveHelper, type Spinoff } from "./spinoffs";

/** What the archive notice says about the conversation's named workers
 * (Jari 2026-11-08): they go with it, keep waiting, and come back with it
 * unstarted. Habitat merges nothing: rounds the main agent has landed are on
 * the source branch, and anything else stays on the worker's branch, as
 * Taskfleet keeps it. Read once, as the panel reads them; nothing to say, or
 * nothing readable, is no detail. */
export function helpersArchiveDetail(runs: Spinoff[]): string | undefined {
  const t = textNow(archiveNoticeText);
  const helpers = runs.filter(liveHelper);
  if (!helpers.length) return undefined;
  const name = (r: Spinoff) => r.resident?.name || r.title || r.run_id;
  const working = helpers.filter((r) => r.resident?.round_state === "working");
  // Taskfleet's own word that work waits on a branch (idle expiry kept it).
  const unlanded = helpers.filter((r) => r.resident?.unlanded);
  // A later round with no landing recorded: a round that changed nothing
  // records none either, so this is said as unconfirmed. A dormant helper
  // has Taskfleet's proof that everything landed.
  const unconfirmed = helpers.filter(
    (r) =>
      r.resident &&
      !r.resident.unlanded &&
      r.resident.round_state === "waiting" &&
      r.resident.rounds > (r.resident.landed_round ?? 0),
  );
  return [
    t.helpersArchived(helpers.map(name).join(", ")),
    working.length ? t.helpersWorking(working.map(name).join(", ")) : "",
    unlanded.length ? t.helpersUnlanded(unlanded.map(name).join(", ")) : "",
    unconfirmed.length
      ? t.helpersUnconfirmed(unconfirmed.map(name).join(", "))
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}
