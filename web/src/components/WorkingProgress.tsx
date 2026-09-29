import { useEffect, useState } from "react";

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
          : "työkalua";
      return `Käyttää työkalua: ${tool}`;
    }
    if (type === "tool_execution_end") return "Työkalun tulos saapui";
    if (type === "message_end") return "Valmistelee seuraavaa vaihetta";
    if (type === "agent_start") return "Aloittaa työtä";
  }
  return "Odottaa Pi:n seuraavaa vaihetta";
}

export function WorkingProgress({
  state,
  events,
  elapsed,
}: {
  state?: string;
  events: unknown[];
  elapsed: number;
}) {
  const [announced, setAnnounced] = useState("");
  const working =
    state === "accepted" || state === "pending" || state === "stopping";
  const label =
    state === "stopping" ? "Keskeytystä odotetaan" : progressLabel(events);
  useEffect(() => {
    if (working && label !== announced) setAnnounced(label);
  }, [working, label, announced]);
  if (!working && state !== "uncertain") return null;
  if (state === "uncertain")
    return (
      <p role="status">
        Pi:n työ keskeytyi tai yhteys siihen katkesi. Historia on luettavissa,
        mutta työn päättymistä ei voida vahvistaa.
      </p>
    );
  return (
    <section aria-label="Pi:n työn eteneminen" className="ah-working-progress">
      <p>
        <strong>Pi työskentelee…</strong> · {Math.floor(elapsed / 60)} min{" "}
        {elapsed % 60} s
      </p>
      <p>{label}</p>
      <span className="ah-visually-hidden" role="status">
        {announced}
      </span>
    </section>
  );
}
