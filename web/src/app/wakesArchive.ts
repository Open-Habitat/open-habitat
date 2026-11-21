import type { PendingWakeModel } from "../components/ScheduledWake";
import { wakeShort } from "../components/wakeTime";
import { textNow } from "../i18n";
import { scheduledWakeText } from "../text/scheduledWake";
import type { Agent, Snapshot } from "./snapshot";

/** The conversation's pending wakes, as the snapshot names them now. */
export function pendingWakeModels(
  agent: Pick<Agent, "agent_id" | "wakes">,
  snapshot?: Pick<Snapshot, "agents">,
): PendingWakeModel[] {
  const current =
    snapshot?.agents.find((a) => a.agent_id === agent.agent_id) ?? agent;
  return (current.wakes ?? []).flatMap((w) => {
    const at = Date.parse(w.at);
    return Number.isFinite(at) ? [{ id: w.id, at, note: w.note }] : [];
  });
}

/** What the archive notice says went with the conversation. */
export function wakesArchiveDetail(
  wakes: PendingWakeModel[],
  now = Date.now(),
): string | undefined {
  if (!wakes.length) return undefined;
  return textNow(scheduledWakeText).noticeDetail(
    wakeShort(wakes[0].at, now),
    wakes.length,
  );
}
