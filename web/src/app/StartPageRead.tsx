import { useEffect, useRef, useState } from "react";
import { goalDraft, StartHere } from "../components/StartHere";
import { readCommands, readStartPage, type StartPage } from "./composerReads";
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
  const latest = useRef({ draft, onChange });
  latest.current = { draft, onChange };
  const [page, setPage] = useState<StartPage | null>();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, retry] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState(false);
  const preparation = useRef<AbortController | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: preparation belongs to this exact target.
  useEffect(() => () => preparation.current?.abort(), [workspaceId, agentId]);
  const root = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt retries a failed read.
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    setPage(undefined);
    setPreparing(false);
    setPrepareError(false);
    const read =
      agentId && store
        ? store.startPage(agentId, workspaceId)
        : readStartPage(workspaceId, controller.signal);
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
        preparing={preparing}
        onGoal={async (goal) => {
          if (preparation.current) return;
          const controller = new AbortController();
          preparation.current = controller;
          setPreparing(true);
          setPrepareError(false);
          let effective = goal;
          try {
            if (goal.skill) {
              const list = await readCommands(
                agentId ? { agentId } : { workspaceId },
                controller.signal,
              );
              effective = {
                ...goal,
                skill: list.commands.some(
                  (c) =>
                    c.source === "skill" && c.name === `skill:${goal.skill}`,
                )
                  ? goal.skill
                  : undefined,
              };
            }
            if (controller.signal.aborted) return;
          } catch {
            if (!controller.signal.aborted) setPrepareError(true);
            return;
          } finally {
            preparation.current = null;
            if (!controller.signal.aborted) setPreparing(false);
          }
          latest.current.onChange(goalDraft(effective, latest.current.draft));
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
      {prepareError && (
        <p role="status">
          Taitoa ei saatu tarkistettua. Yritä Aloita-painiketta uudelleen.
        </p>
      )}
    </div>
  );
}
