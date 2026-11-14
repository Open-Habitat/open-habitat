import type { AgentPresentation } from "./agentPresentation";
import type { MarkState, SubMarkState } from "./HabitatMark";
import type { WorkerMarkKind } from "./WorkerMark";

// One mapping from the product's states to the mark's, so every place that
// draws an agent's state draws the same thing for it.

/** A conversation's state as the rail and the home cards know it. */
export function agentMark(agent: {
  failed?: boolean;
  attentionLabel?: string;
  question?: boolean;
  turnMark?: "raised" | "read";
  activity?: AgentPresentation["activity"];
  spinoffWorking?: boolean;
  spinoffIdle?: boolean;
}): MarkState {
  if (agent.failed) return "error";
  // A raise is the person's own act, not the agent's state.
  if (agent.question || agent.attentionLabel)
    return agent.turnMark === "read" && !agent.question ? "read" : "waiting";
  if (agent.turnMark === "read") return "read";
  if (agent.activity === "working") return "working";
  if (agent.activity === "waiting_background") return "background";
  if (agent.spinoffWorking) return "working";
  if (agent.spinoffIdle) return "waiting";
  return activityMark(agent.activity);
}

/** An agent's observed activity alone. */
export function activityMark(
  activity: AgentPresentation["activity"] | undefined,
): MarkState {
  switch (activity) {
    case "working":
      return "working";
    case "waiting_background":
      return "background";
    case "waiting":
    case "closed":
      return "done";
    default:
      return "unknown";
  }
}

/** A worker run's mark. `waited` means the main agent waits for it. A worker
 * in waiting_parent waits for its main agent and does nothing itself, so it
 * rests like the logo. */
export function workerMark(kind: WorkerMarkKind, waited = false): MarkState {
  switch (kind) {
    case "working":
    case "checking":
      return waited ? "awaited" : "working";
    case "idle":
    case "answer":
      return "waiting";
    case "merged":
    case "reported":
      return "done";
    case "failed":
    case "unfinished":
      return "error";
    case "waiting_parent":
      return waited ? "awaited" : "idle";
    default:
      return "unknown";
  }
}

/** Sub-agent dots from the snapshot's counts: the ones waiting for the
 * person first, since they ask something of them. */
export function subMarks(counts?: {
  working?: number;
  idle?: number;
}): SubMarkState[] {
  if (!counts) return [];
  return [
    ...Array<SubMarkState>(Math.max(0, counts.idle ?? 0)).fill("waiting"),
    ...Array<SubMarkState>(Math.max(0, counts.working ?? 0)).fill("working"),
  ];
}
