import { type ReactNode, useEffect, useRef, useState } from "react";
import { type BashFailure, failureLabel } from "../app/bashFailure";
import { useOwnMachine } from "../app/ownMachineUse";
import { liveText } from "../i18n";
import { piBlocksText } from "../text/piBlocks";
import { ToolRow } from "./Conversation";

const txt = liveText(piBlocksText);

/** One visual use, from call formation through the native saved result. */
export function PiToolUse({
  name,
  failureCause,
  state,
  statusLabel,
  targetText,
  remoteHost,
  stat,
  children,
  expansion,
  keepMounted = false,
}: {
  statusLabel?: string;
  name: string;
  failureCause?: BashFailure;
  keepMounted?: boolean;
  expansion?: { get: () => boolean | undefined; set: (value: boolean) => void };
  targetText?: string;
  /** The host the command ran ssh to (`sshTarget`); a chip names it when it
   * is one of the person's own machines. */
  remoteHost?: string;
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
  const machine = useOwnMachine(remoteHost, state);
  const streaming =
    state === "forming" || state === "called" || state === "running";
  const [expanded, setExpanded] = useState(() => expansion?.get() ?? streaming);
  const userChoice = useRef(false);
  useEffect(() => {
    if (userChoice.current || expansion?.get() !== undefined) return;
    setExpanded(streaming);
  }, [streaming, expansion]);
  const labels = txt.states;
  return (
    <div
      className={`ah-pi-tool-use${state === "running" || state === "forming" || state === "called" ? " ah-live-tool-row" : ""}`}
    >
      <ToolRow
        name={name}
        targetText={targetText}
        machine={machine}
        stat={stat}
        state={state}
        statusLabel={
          statusLabel ??
          (state === "failed" ? failureLabel(failureCause) : labels[state])
        }
        statusTitle={failureCause?.status_line}
        errorSummary={state === "failed" ? txt.failed : undefined}
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
