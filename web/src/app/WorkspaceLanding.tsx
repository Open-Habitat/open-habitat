import { useEffect, useRef, useState } from "react";
import { WorkspaceIntro } from "../components/WorkspaceIntro";
import { readStartPage, type StartGoal, type StartPage } from "./composerReads";
import { prepareGoalConversation, prepareInvocation } from "./goalGuide";

/**
 * Reads the workspace's start page with the same file-only read a new
 * conversation uses, and turns a chosen goal into a new conversation whose
 * draft Aloita has already prepared.
 */
export function WorkspaceLanding({
  workspaceId,
  identity,
  onNew,
  startReason,
  single = false,
}: {
  workspaceId: string;
  identity?: string;
  onNew?: (id: string) => void;
  startReason?: string;
  single?: boolean;
}) {
  const [page, setPage] = useState<StartPage | null>();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, retry] = useState(0);
  const [preparing, setPreparing] = useState<StartGoal>();
  const [problem, setProblem] = useState(false);
  const latest = useRef(onNew);
  latest.current = onNew;
  const preparation = useRef<AbortController | null>(null);
  useEffect(() => () => preparation.current?.abort(), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt retries a failed read.
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    readStartPage(workspaceId, controller.signal)
      .then((read) => {
        if (controller.signal.aborted) return;
        setPage(read);
        setState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [workspaceId, attempt]);
  const disabled =
    !identity || !onNew
      ? startReason || "Uutta keskustelua ei voi aloittaa nyt."
      : undefined;
  const start = () => latest.current?.(workspaceId);
  return (
    <>
      <WorkspaceIntro
        page={page}
        state={state}
        onRetry={() => retry((v) => v + 1)}
        preparing={preparing}
        disabled={disabled}
        newHint={
          single
            ? "Tyhjän keskustelun saat yläpalkin Uusi keskustelu -painikkeesta."
            : undefined
        }
        onCreatePage={() => {
          if (!identity || disabled) return;
          prepareInvocation(identity, workspaceId, "/open-habitat-start-page ");
          start();
        }}
        onGoal={async (goal) => {
          if (!identity || disabled || preparation.current || !page) return;
          if ("state" in page) return;
          const controller = new AbortController();
          preparation.current = controller;
          setPreparing(goal);
          setProblem(false);
          let prepared = false;
          try {
            prepared = await prepareGoalConversation({
              identity,
              workspaceId,
              goal,
              page: page.title,
              signal: controller.signal,
            });
          } catch {
            if (!controller.signal.aborted) setProblem(true);
          } finally {
            preparation.current = null;
            if (!controller.signal.aborted) setPreparing(undefined);
          }
          if (prepared) start();
        }}
      />
      {problem ? (
        <p role="status" data-testid="landing-problem">
          Tavoitteen taitoa ei saatu tarkistettua. Valitse tavoite uudelleen.
        </p>
      ) : null}
    </>
  );
}
