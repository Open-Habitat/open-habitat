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
  | "answer"
  | "reported";

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

/** The rail row's worker mark: one branch whose end node is the worker's
 * ball. The waited-on ring is drawn inside the glyph, so the mark keeps one
 * width in every state and never reaches past the row's edge. */
export function WorkerBranchMark({
  kind,
  waited = false,
}: {
  kind: Extract<WorkerMarkKind, "working" | "idle" | "unknown">;
  waited?: boolean;
}) {
  return (
    <svg
      className="ah-worker-branch"
      data-kind={kind}
      data-waited={waited || undefined}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <g className="ah-worker-branch-stem">
        <circle cx="5" cy="5" r="2" />
        <path d="M5 7v12M5 10c0 3.5 2.5 6 7.5 6" />
      </g>
      {waited ? (
        <circle className="ah-worker-branch-ring" cx="16.5" cy="16" r="6.5" />
      ) : null}
      <circle className="ah-worker-branch-ball" cx="16.5" cy="16" r="4" />
    </svg>
  );
}
