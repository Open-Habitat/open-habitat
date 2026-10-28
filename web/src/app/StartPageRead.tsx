import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { goalDraft, StartHere } from "../components/StartHere";
import {
  readCommands,
  readStartPage,
  type StartGoal,
  type StartPage,
} from "./composerReads";
import type { ConversationStore } from "./conversationStore";

export function StartPageRead({
  workspaceId,
  agentId,
  store,
  draft,
  onChange,
  onPage,
  onStarted,
}: {
  workspaceId: string;
  agentId?: string;
  store?: ConversationStore;
  draft: string;
  onChange: (draft: string) => void;
  /** The page as read, for the composer's goal chips. */
  onPage?: (page: StartPage | null) => void;
  /** Aloita prepared this goal's draft: the guide can open beside it. */
  onStarted?: (goal: StartGoal, page: string) => void;
}) {
  const latest = useRef({ draft, onChange, onPage, onStarted });
  latest.current = { draft, onChange, onPage, onStarted };
  const [page, setPage] = useState<StartPage | null>();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, retry] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState(false);
  const preparation = useRef<AbortController | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: preparation belongs to this exact target.
  useEffect(() => () => preparation.current?.abort(), [workspaceId, agentId]);
  const root = useRef<HTMLDivElement>(null);
  const [preparedDraft, setPreparedDraft] = useState<
    (ReturnType<typeof goalDraft> & { chip: number }) | null
  >(null);
  useLayoutEffect(() => {
    if (!preparedDraft || draft !== preparedDraft.text) return;
    const field = root.current
      ?.closest(".ah-conversation-frame")
      ?.querySelector("textarea");
    // The field shows a goal's skill invocation as a chip and edits the rest.
    const shown = field?.value === preparedDraft.text ? 0 : preparedDraft.chip;
    // A frame can precede React's controlled-input commit under load. Focus
    // and select only once that commit has put the prepared text in the DOM.
    if (field && field.value === preparedDraft.text.slice(shown)) {
      field.focus();
      field.setSelectionRange(
        preparedDraft.selectionStart - shown,
        preparedDraft.selectionEnd - shown,
      );
      field.scrollTop = field.scrollHeight;
    }
    setPreparedDraft(null);
  }, [draft, preparedDraft]);
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
        latest.current.onPage?.(page);
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
          let carried = false;
          try {
            if (goal.skill) {
              const list = await readCommands(
                agentId ? { agentId } : { workspaceId },
                controller.signal,
              );
              const skill = list.commands.find(
                (c) => c.source === "skill" && c.name === `skill:${goal.skill}`,
              );
              effective = { ...goal, skill: skill ? goal.skill : undefined };
              // The goal's own skill (described by the goal's title) holds
              // the request; a general skill the goal borrows does not.
              carried = skill?.description.trim() === goal.title.trim();
            }
            if (controller.signal.aborted) return;
          } catch {
            if (!controller.signal.aborted) setPrepareError(true);
            return;
          } finally {
            preparation.current = null;
            if (!controller.signal.aborted) setPreparing(false);
          }
          const prepared = goalDraft(effective, latest.current.draft, carried);
          setPreparedDraft({
            ...prepared,
            chip: effective.skill ? `/skill:${effective.skill} `.length : 0,
          });
          latest.current.onChange(prepared.text);
          if (page && !("state" in page))
            latest.current.onStarted?.(effective, page.title);
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
