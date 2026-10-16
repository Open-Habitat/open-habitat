import { type BashFailure, failureLabel } from "../app/bashFailure";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ToolRow } from "./Conversation";

/** One visual use, from call formation through the native saved result. */
export function PiToolUse({
  name,
  failureCause,
  state,
  targetText,
  stat,
  children,
  expansion,
  keepMounted = false,
}: {
  name: string;
  failureCause?: BashFailure;
  keepMounted?: boolean;
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
  const streaming =
    state === "forming" || state === "called" || state === "running";
  const [expanded, setExpanded] = useState(() => expansion?.get() ?? streaming);
  const userChoice = useRef(false);
  useEffect(() => {
    if (userChoice.current || expansion?.get() !== undefined) return;
    setExpanded(streaming);
  }, [streaming, expansion]);
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
        statusLabel={
          state === "failed" ? failureLabel(failureCause) : labels[state]
        }
        statusTitle={failureCause?.status_line}
        errorSummary={
          state === "failed" ? "Pi ilmoitti työkalun virheestä." : undefined
        }
        expanded={expanded}
        keepMounted={keepMounted}
        onToggle={() => {
          userChoice.current = true;
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
