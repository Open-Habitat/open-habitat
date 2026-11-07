import { useEffect, useRef, useState } from "react";
import type { CompactionControl } from "../components/ContextView";
import { CompactionFailed, compactConversation } from "./compaction";

/** Tiivistä nyt on the context page of a conversation the browser runs. A
 * resting conversation is woken first, as a send would wake it; a running
 * turn is never interrupted (the button waits for the agent). */
export function useCompaction({
  id,
  csrf,
  enabled,
  busy,
  stopped,
  workspaceId,
  onLogin,
  onSettled,
}: {
  id?: string;
  csrf?: string;
  enabled: boolean;
  busy: boolean;
  stopped: boolean;
  workspaceId: string;
  onLogin: () => void;
  /** Pi answered: the page reads the context again. */
  onSettled: () => void;
}): CompactionControl {
  const [running, setRunning] = useState<string>();
  const [outcome, setOutcome] = useState<CompactionControl["outcome"]>();
  const live = useRef({ id, stopped, workspaceId });
  live.current = { id, stopped, workspaceId };
  // biome-ignore lint/correctness/useExhaustiveDependencies: a different conversation forgets the last answer.
  useEffect(() => setOutcome(undefined), [id]);
  return {
    offer: !enabled || !id || !csrf ? "none" : busy ? "busy" : "ready",
    running: !!id && running === id,
    outcome,
    onCompact: (instructions) => {
      const conversation = live.current.id;
      if (!conversation || !csrf || running) return;
      setRunning(conversation);
      setOutcome(undefined);
      compactConversation(
        conversation,
        instructions,
        csrf,
        live.current.workspaceId,
        live.current.stopped,
      )
        .then(
          (result) => {
            if (live.current.id === conversation)
              setOutcome({
                kind: "done",
                after: result.estimated_tokens_after,
              });
          },
          (e: unknown) => {
            const reason =
              e instanceof CompactionFailed ? e.reason : "uncertain";
            if (reason === "login") return onLogin();
            if (live.current.id === conversation) setOutcome({ kind: reason });
          },
        )
        .finally(() => {
          setRunning(undefined);
          onSettled();
        });
    },
  };
}
