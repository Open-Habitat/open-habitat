import { useState } from "react";
import { PendingWakeBar } from "../components/ScheduledWake";
import { useText } from "../i18n";
import { scheduledWakeText } from "../text/scheduledWake";
import { useExperimentalFeature } from "./accountPreferences";
import { changeWake } from "./conversations";
import type { Agent } from "./snapshot";
import { pendingWakeModels } from "./wakesArchive";

/** The conversation's pending scheduled wake as the bar above the composer
 * (scheduled-wake, experimental). The person moves or cancels it; the
 * snapshot that the daemon's change publishes then carries the result. */
export function WakeDock({
  agent,
  csrf,
}: {
  agent?: Pick<Agent, "agent_id" | "wakes" | "archive">;
  csrf?: string;
}) {
  const t = useText(scheduledWakeText);
  const on = useExperimentalFeature("scheduled-wake");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ agent: string; text: string }>();
  if (!on || !agent || agent.archive === "archived") return null;
  const wakes = pendingWakeModels(agent);
  if (!wakes.length) return null;
  const run = (wakeId: string, action: "move" | "cancel", at?: Date) => {
    if (!csrf || busy) return;
    setBusy(true);
    setProblem(undefined);
    void changeWake(agent.agent_id, wakeId, action, csrf, at)
      .catch(() => setProblem({ agent: agent.agent_id, text: t.changeFailed }))
      .finally(() => setBusy(false));
  };
  return (
    <PendingWakeBar
      key={agent.agent_id}
      wakes={wakes}
      busy={busy || !csrf}
      problem={problem?.agent === agent.agent_id ? problem.text : undefined}
      onMove={(id, at) => run(id, "move", at)}
      onCancel={(id) => run(id, "cancel")}
    />
  );
}
