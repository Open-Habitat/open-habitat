import { useEffect, useRef, useState } from "react";
import { goalDraft, StartHere } from "../components/StartHere";
import { type CommandList, readCommands } from "./composerReads";

export function StartPageRead({
  workspaceId,
  agentId,
  draft,
  onChange,
}: {
  workspaceId: string;
  agentId?: string;
  draft: string;
  onChange: (draft: string) => void;
}) {
  const [list, setList] = useState<CommandList>();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, retry] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt explicitly retries the native read.
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    setList(undefined);
    readCommands(agentId ? { agentId } : { workspaceId }, controller.signal)
      .then((v) => {
        if (controller.signal.aborted) return;
        setList(v);
        setState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [workspaceId, agentId, attempt]);
  return (
    <div ref={root}>
      <StartHere
        page={state === "ready" ? list?.start_page : undefined}
        state={state}
        onRetry={() => retry((v) => v + 1)}
        onGoal={(goal) => {
          onChange(goalDraft(goal, draft));
          requestAnimationFrame(() =>
            root.current
              ?.closest(".ah-conversation-frame")
              ?.querySelector("textarea")
              ?.focus(),
          );
        }}
      />
    </div>
  );
}
