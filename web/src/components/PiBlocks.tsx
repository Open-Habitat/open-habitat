import { type ReactNode, useState } from "react";
import { ToolRow } from "./Conversation";

/** One visual use, from call formation through the native saved result. */
export function PiToolUse({
  name,
  state,
  targetText,
  stat,
  children,
  initiallyExpanded = name === "bash" && state !== "forming",
  expansion,
}: {
  name: string;
  initiallyExpanded?: boolean;
  expansion?: { get: () => boolean | undefined; set: (value: boolean) => void };
  targetText?: string;
  stat?: string;
  state:
    | "forming"
    | "called"
    | "running"
    | "succeeded"
    | "failed"
    | "cancelled"
    | "unknown";
  children?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(() => {
    const previous = expansion?.get();
    if (previous !== undefined) return previous;
    expansion?.set(initiallyExpanded);
    return initiallyExpanded;
  });
  const labels = {
    forming: "muodostaa kutsua…",
    called: "odottaa ajoa",
    running: "ajossa",
    succeeded: "valmis",
    failed: "epäonnistui",
    cancelled: "keskeytetty",
    unknown: "tila ei tiedossa",
  };
  return (
    <div
      className={`ah-pi-tool-use${state === "running" || state === "forming" || state === "called" ? " ah-live-tool-row" : ""}`}
    >
      <ToolRow
        name={name}
        targetText={targetText}
        stat={stat}
        state={state}
        statusLabel={labels[state]}
        errorSummary={
          state === "failed" ? "Pi ilmoitti työkalun virheestä." : undefined
        }
        expanded={expanded}
        onToggle={() => {
          expansion?.set(!expanded);
          setExpanded(!expanded);
        }}
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
