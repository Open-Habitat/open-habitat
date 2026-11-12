import { liveText } from "../i18n";
import { statusText } from "../text/status";

const txt = liveText(statusText);
/** Derive UI channels only from observed host facts, never from translated labels. */
export interface WaitingOn {
  spinoff?: import("../app/processes").ProcessSpinoff[];
  process_id: string;
  name: string;
  kind: "process" | "taskfleet_wait";
  run_ids: string[];
  before_turn?: true;
}
/**
 * Whether the conversation waits for this process. A Taskfleet wait always
 * means the agent waits for its worker. A plain process the agent started
 * before the person began the latest turn is something it left running (a
 * file server, a watcher): the agent has answered the person since and handed
 * the turn back, so it is a background service, not work the person waits
 * for (rail-background-service-not-running, Jari 12.11.2026).
 */
export const waitedFor = (item: WaitingOn) =>
  item.kind === "taskfleet_wait" || !item.before_turn;
/** The processes left running behind an ended turn (see waitedFor). */
export const backgroundServices = (waitingOn: WaitingOn[] | undefined) =>
  (waitingOn ?? []).filter((item) => !waitedFor(item));
export interface AgentFacts {
  runActive?: boolean;
  waitingOn?: WaitingOn[];
  process: string;
  control?: string;
  history?: string;
  command?: string;
  connectionLost?: boolean;
  /** Explicit local close, not a process exit or interrupted turn. */
  intentionallyClosed?: boolean;
  pendingQuestion?: boolean;
  /** Only a confirmed native event and its visited marker can set attention. */
  attention?: "new" | "seen";
}

export interface AgentPresentation {
  activity: "working" | "waiting" | "waiting_background" | "closed" | "unknown";
  activityLabel: string;
  activityShortLabel: string;
  controlLabel: string;
  attentionLabel?: string;
  operationLabel?: string;
  running: boolean;
}

export function agentPresentation(facts: AgentFacts): AgentPresentation {
  const running =
    facts.process === "daemon_managed_live" ||
    facts.process === "terminal_observed_live";
  // Pi-started runs (including wake-ups) are authoritative; old hosts use command state.
  const working =
    running &&
    (facts.runActive ?? facts.command === "accepted") &&
    !facts.pendingQuestion &&
    !facts.connectionLost;
  const waiting =
    running &&
    (facts.pendingQuestion ||
      facts.runActive === false ||
      facts.command === "idle");
  // A background process and a Taskfleet worker are one state for the
  // person: the agent continues by itself, nothing is asked of them.
  const background =
    running &&
    !working &&
    !facts.pendingQuestion &&
    !facts.connectionLost &&
    facts.runActive !== true &&
    !!facts.waitingOn?.some(waitedFor);
  const backgroundLabel = txt.activity.background;
  const activity = facts.intentionallyClosed
    ? "closed"
    : working
      ? "working"
      : background
        ? "waiting_background"
        : waiting
          ? "waiting"
          : "unknown";
  const activityLabel = facts.intentionallyClosed
    ? txt.activity.done
    : working
      ? txt.activity.working
      : background
        ? backgroundLabel
        : waiting
          ? txt.activity.waiting
          : txt.activity.unknown;
  const operationLabel = facts.connectionLost
    ? txt.operation.disconnected
    : facts.command === "uncertain"
      ? txt.operation.uncertain
      : facts.command === "rejected"
        ? txt.operation.rejected
        : facts.command === "pending"
          ? txt.operation.pending
          : facts.command === "stopping"
            ? txt.operation.stopping
            : undefined;
  return {
    activity,
    activityLabel,
    activityShortLabel: facts.intentionallyClosed
      ? txt.activity.doneShort
      : working
        ? txt.activity.workingShort
        : background
          ? backgroundLabel
          : waiting
            ? txt.activity.waitingShort
            : txt.activity.unknown,
    controlLabel:
      facts.control === "read_only"
        ? txt.control.readOnly
        : facts.control === "unavailable"
          ? txt.control.unavailable
          : facts.control === "unknown"
            ? txt.control.unknown
            : "",
    attentionLabel: facts.attention === "new" ? txt.newAttention : undefined,
    operationLabel,
    running,
  };
}

export function waitingName(item: WaitingOn): string {
  return item.kind === "taskfleet_wait" && item.spinoff?.length
    ? item.spinoff.map((run) => run.title || run.run_id).join(", ")
    : item.name;
}

/** Whether a background wait includes a Taskfleet worker (`run wait`). */
export function waitsOnWorker(waitingOn: WaitingOn[] | undefined): boolean {
  return !!waitingOn?.some((item) => item.kind === "taskfleet_wait");
}
