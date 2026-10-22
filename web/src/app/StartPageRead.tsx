import { useEffect, useRef, useState } from "react";
import { goalDraft, StartHere } from "../components/StartHere";
import { readCommands, type StartPage } from "./composerReads";
import type { ConversationStore } from "./conversationStore";

export function StartPageRead({
  workspaceId,
  agentId,
  store,
  draft,
  onChange,
}: {
  workspaceId: string;
  agentId?: string;
  store?: ConversationStore;
  draft: string;
  onChange: (draft: string) => void;
}) {
  const [page, setPage] = useState<StartPage | null>();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, retry] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt retries a failed read.
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    setPage(undefined);
    const read =
      agentId && store
        ? store.startPage(agentId)
        : readCommands(
            agentId ? { agentId } : { workspaceId },
            controller.signal,
          ).then((list) => list.start_page ?? null);
    read
      .then((page) => {
        if (controller.signal.aborted) return;
        setPage(page);
        setState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [workspaceId, agentId, store, attempt]);
  return (
    <div ref={root} data-reading-intro>
      <StartHere
        key={`${workspaceId}:${agentId ?? "new"}`}
        page={state === "ready" ? page : undefined}
        state={state}
        onRetry={() => retry((v) => v + 1)}
        onGoal={(goal) => {
          onChange(goalDraft(goal, draft));
          requestAnimationFrame(() => {
            const field = root.current
              ?.closest(".ah-conversation-frame")
              ?.querySelector("textarea");
            if (field) {
              field.focus();
              field.setSelectionRange(field.value.length, field.value.length);
              field.scrollTop = field.scrollHeight;
            }
          });
        }}
      />
    </div>
  );
}
