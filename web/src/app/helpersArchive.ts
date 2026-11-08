import { textNow } from "../i18n";
import { archiveNoticeText } from "../text/archiveNotice";
import { liveHelper, type Spinoff } from "./spinoffs";

/** Idle helpers need no archive notice; only an unfinished round matters. */
export function helpersArchiveDetail(runs: Spinoff[]): string | undefined {
  const working = runs.filter(
    (r) => liveHelper(r) && r.resident?.round_state === "working",
  );
  if (!working.length) return undefined;
  return textNow(archiveNoticeText).helpersWorking(
    working.map((r) => r.resident?.name || r.title || r.run_id).join(", "),
  );
}
