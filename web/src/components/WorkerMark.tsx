import "./WorkerMark.css";

export type WorkerMarkKind =
  | "working"
  | "idle"
  | "waiting_parent"
  | "unknown"
  | "merged"
  | "unfinished"
  | "failed"
  | "unmerged"
  | "checking"
  | "answer";

/** State and the parent's wait are independent: an idle worker can have both. */
export function WorkerMark({
  kind,
  waited = false,
}: {
  kind: WorkerMarkKind;
  waited?: boolean;
}) {
  return (
    <span
      className="ah-worker-mark"
      data-kind={kind}
      data-waited={waited || undefined}
      aria-hidden="true"
    />
  );
}
