import { useState, type ReactNode } from "react";
import { ToolRow } from "./Conversation";

/** One visual use, from call formation through the native saved result. */
export function PiToolUse({
  name,
  state,
  children,
}: {
  name: string;
  state:
    | "forming"
    | "running"
    | "succeeded"
    | "failed"
    | "cancelled"
    | "unknown";
  children?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const labels = {
    forming: "muodostaa kutsua…",
    running: "ajossa",
    succeeded: "valmis",
    failed: "epäonnistui",
    cancelled: "keskeytetty",
    unknown: "tila ei tiedossa",
  };
  return (
    <div
      className={
        state === "running" || state === "forming"
          ? "ah-live-tool-row"
          : undefined
      }
    >
      <ToolRow
        name={name}
        state={state}
        statusLabel={labels[state]}
        errorSummary={
          state === "failed" ? "Pi ilmoitti työkalun virheestä." : undefined
        }
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      >
        {children}
      </ToolRow>
    </div>
  );
}

export function PiBoundary({ children }: { children: ReactNode }) {
  return (
    <p className="ah-pi-boundary" role="note">
      {children}
    </p>
  );
}
