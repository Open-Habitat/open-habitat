import type { CompactionControl } from "../components/ContextView";
import type { CompactionFailed } from "./compaction";
import type { ConversationEvent } from "./conversationEvents";

/** What the conversation itself says about a compaction: that the agent
 * compacts now, or why the last one did not compact. A finished compaction
 * needs no notice here: Pi's own compaction entry is its mark in history. */
export type CompactionNotice =
  | { kind: "running" }
  | { kind: "failed"; reason: Exclude<CompactionFailed["reason"], "login"> };

const ended: Record<string, Exclude<CompactionFailed["reason"], "login">> = {
  already_compacted: "already_compacted",
  nothing_to_compact: "nothing_to_compact",
  cancelled: "cancelled",
  failed: "compaction_failed",
};

/** What Pi itself can say about the attempt; a refusal before Pi was asked
 * (a running turn, a wake that failed) only the request knows. */
const piSays = new Set<string>([...Object.values(ended), "uncertain"]);

/** The page's own press (`control`) says it at once and with the request's
 * reason; Pi's markers say it for a compaction anyone asked for, also in a
 * tab that did not ask, and Pi's later end supersedes the request's answer.
 * A new turn after the end leaves the notice behind. */
export function compactionNotice(
  control: Pick<CompactionControl, "running" | "outcome"> | undefined,
  fragments: ConversationEvent[] = [],
): CompactionNotice | undefined {
  if (control?.running) return { kind: "running" };
  let live: CompactionNotice | undefined;
  let liveEnd = false;
  let after = false;
  for (let i = fragments.length - 1; i >= 0; i--) {
    const { kind, payload } = fragments[i];
    if (
      kind === "pi.lifecycle" &&
      (payload.signal === "agent_start" || payload.signal === "turn_start")
    )
      after = true;
    if (kind !== "pi.marker") continue;
    if (payload.marker === "compaction_start") {
      live = after ? undefined : { kind: "running" };
      break;
    }
    if (payload.marker === "compaction_end") {
      const reason = ended[payload.outcome as string];
      liveEnd = !after && typeof payload.outcome === "string";
      live = reason && !after ? { kind: "failed", reason } : undefined;
      break;
    }
  }
  if (live?.kind === "running") return live;
  const outcome = control?.outcome?.kind;
  if (
    outcome &&
    outcome !== "done" &&
    outcome !== "login" &&
    !(liveEnd && piSays.has(outcome))
  )
    return { kind: "failed", reason: outcome };
  return live;
}
