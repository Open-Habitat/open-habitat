import { HabitatMark } from "./HabitatMark";
import { workerMark } from "./markState";
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

/** A worker's state as the Open Habitat mark (markState.workerMark). State
 * and the parent's wait are independent: an idle worker can have both. */
export function WorkerMark({
  kind,
  waited = false,
  size = 14,
}: {
  kind: WorkerMarkKind;
  waited?: boolean;
  size?: number;
}) {
  return (
    <span
      className="ah-worker-mark"
      data-kind={kind}
      data-waited={waited || undefined}
      aria-hidden="true"
    >
      <HabitatMark state={workerMark(kind, waited)} size={size} />
    </span>
  );
}
