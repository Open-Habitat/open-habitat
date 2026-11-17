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

/** The mark's states whose ring already moves or whose ring is the state
 * itself (the dashed unknown). A background process adds nothing to them. */
const RING_OWNS: ReadonlySet<MarkState> = new Set<MarkState>([
  "working",
  "background",
  "awaited",
  "stopping",
  "loading",
  "intro",
  "unknown",
]);

/** Whether the mark's door drifts because a process of the conversation
 * runs (rail-background-door). The state is kept: its colour and resident
 * stay, and only the door travels as the background state's does, so a
 * read reply with a dev server behind it still reads as read. A done door
 * stands ajar while it drifts. A state whose ring already moves keeps its
 * own motion. */
export function markDrifts(
  state: MarkState,
  backgroundRunning: boolean | undefined,
): boolean {
  return !!backgroundRunning && !RING_OWNS.has(state);
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
