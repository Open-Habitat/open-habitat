import { useEffect, useRef } from "react";
import { liveText } from "../i18n";
import { workingProgressText } from "../text/workingProgress";
import { HabitatMark } from "./HabitatMark";

const txt = liveText(workingProgressText);

// Only known event types become UI copy. Never render an RPC payload or tool arguments.
export function progressLabel(events: unknown[]): string {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (!event || typeof event !== "object" || Array.isArray(event)) continue;
    const { type, toolName } = event as Record<string, unknown>;
    if (type === "tool_execution_start") {
      const tool =
        typeof toolName === "string" &&
        /^(bash|read|write|edit|grep|find|ls)$/.test(toolName)
          ? toolName
          : undefined;
      return tool ? txt.usingTool(tool) : txt.usingAnyTool;
    }
    if (type === "tool_execution_end") return txt.toolResult;
    if (type === "message_end") return txt.preparingNext;
    if (type === "agent_start") return txt.starting;
  }
  return txt.waitingNext;
}

// Native history, typed live progress and supported question controls own the
// presentation. Raw RPC frames must never become conversation messages.
const representedFrames = new Set([
  "agent_start",
  "agent_end",
  "agent_settled",
  "turn_start",
  "turn_end",
  "message_start",
  "message_update",
  "message_end",
  "tool_execution_start",
  "tool_execution_update",
  "tool_execution_end",
  "queue_update",
  "response", // Normally separated by the daemon RPC reader.
  "session_info_changed",
  "thinking_level_changed",
  "entry_appended",
  "compaction_start",
  "compaction_end",
  "auto_compaction_start",
  "auto_compaction_end",
  "auto_retry_start",
  "auto_retry_end",
  "summarization_retry_scheduled",
  "summarization_retry_attempt_start",
  "summarization_retry_finished",
  "bash_execution_update",
  "extension_ui_request", // Presented through the supported extension controls.
]);

// Keep a diagnostic for adapter gaps, never the untrusted frame or its payload.
export function UnpresentedEvents({
  events,
  liveEvents,
}: {
  events: unknown[];
  liveEvents?: { kind: string }[];
}) {
  const reported = useRef(new WeakSet<object>());
  useEffect(() => {
    const report = (event: object) => {
      if (reported.current.has(event)) return;
      reported.current.add(event);
      console.warn("Unsupported native Pi event omitted from conversation");
    };
    for (const event of events) {
      if (!event || typeof event !== "object" || Array.isArray(event)) continue;
      const { type } = event as Record<string, unknown>;
      if (typeof type === "string" && !representedFrames.has(type))
        report(event);
    }
    for (const event of liveEvents ?? []) {
      if (event.kind === "unknown.native") report(event);
    }
  }, [events, liveEvents]);
  return null;
}

export function WorkingProgress({
  state,
  events,
  activeToolName,
}: {
  state?: string;
  events: unknown[];
  activeToolName?: string;
}) {
  const working =
    state === "accepted" || state === "pending" || state === "stopping";
  const label =
    state === "stopping"
      ? txt.stopping
      : activeToolName
        ? txt.usingTool(activeToolName)
        : progressLabel(events);
  if (!working && state !== "uncertain") return null;
  if (state === "uncertain")
    return (
      <p data-testid="working-uncertain" data-state={state} role="status">
        {txt.uncertain}
      </p>
    );
  return (
    <section
      data-testid="working-uncertain"
      data-state={state}
      aria-label={txt.progress}
      className="ah-working-progress"
      role="status"
    >
      <HabitatMark
        state={state === "stopping" ? "stopping" : "working"}
        size={16}
      />
      <span>{label}</span>
    </section>
  );
}
