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
      return tool ? `Käyttää työkalua ${tool}` : "Käyttää työkalua";
    }
    if (type === "tool_execution_end") return "Työkalun tulos saapui";
    if (type === "message_end") return "Valmistelee seuraavaa vaihetta";
    if (type === "agent_start") return "Aloittaa työtä";
  }
  return "Odottaa Pi:n seuraavaa vaihetta";
}

// Pi 1.3.0 AgentSessionEvent (pi-agent-core AgentEvent) and RPC response
// frames: these are turn lifecycle, queue or metadata, not new user-facing
// messages. Message and tool content is read from native history instead.
// Do not wildcard by prefix: extensions and future event types still need a
// safe visible fallback, including questions not yet persisted in history.
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
]);

// Live Pi events are not a substitute for native history, but a pending
// question may not have been persisted there yet. Keep unsupported events
// visible as inert text rather than silently discarding them.
export function UnpresentedEvents({ events }: { events: unknown[] }) {
  const occurrences = new Map<string, number>();
  return (
    <section aria-label="Muut Pi:n viestit">
      {events.map((event) => {
        if (!event || typeof event !== "object" || Array.isArray(event))
          return null;
        const record = event as Record<string, unknown>;
        if (
          typeof record.type !== "string" ||
          representedFrames.has(record.type)
        )
          return null;
        const text = JSON.stringify(event);
        const count = (occurrences.get(text) ?? 0) + 1;
        occurrences.set(text, count);
        return (
          <details key={`${text}:${count}`}>
            <summary>
              {record.type === "question.requested"
                ? "Pi odottaa vastausta"
                : "Muu Pi:n viesti"}
            </summary>
            <pre>{text}</pre>
          </details>
        );
      })}
    </section>
  );
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
      ? "Keskeytystä odotetaan"
      : activeToolName
        ? `Käyttää työkalua ${activeToolName}`
        : progressLabel(events);
  if (!working && state !== "uncertain") return null;
  if (state === "uncertain")
    return (
      <p role="status">
        Pi:n työ keskeytyi tai yhteys siihen katkesi. Historia on luettavissa,
        mutta työn päättymistä ei voida vahvistaa.
      </p>
    );
  return (
    <section
      aria-label="Pi:n työn eteneminen"
      className="ah-working-progress"
      role="status"
    >
      <span className="ah-status-dot ah-running" aria-hidden="true" />
      <span>{label}</span>
    </section>
  );
}
