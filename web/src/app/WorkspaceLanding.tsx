import { useEffect, useRef, useState } from "react";
import { useExplainState } from "../components/explainModeState";
import { WorkspaceIntro } from "../components/WorkspaceIntro";
import { useText } from "../i18n";
import { workspaceLandingText } from "../text/workspaceLanding";
import { readStartPage, type StartGoal, type StartPage } from "./composerReads";
import {
  creationGuideOwner,
  prepareField,
  prepareGoalConversation,
} from "./goalGuide";
import { creationKeys } from "./heldMessages";
import { startPageDraft } from "./startPageRequest";

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
}: {
  workspaceId: string;
  identity?: string;
  onNew?: (id: string) => boolean;
  startReason?: string;
}) {
  const t = useText(workspaceLandingText);
  const explain = useExplainState();
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
    !identity || !onNew ? startReason || t.cannotStart : undefined;
  const start = () => latest.current?.(workspaceId);
  return (
    <>
      <WorkspaceIntro
        page={page}
        state={state}
        onRetry={() => retry((v) => v + 1)}
        preparing={preparing}
        disabled={disabled}
        onCreatePage={() => {
          if (!identity || disabled) return;
          const key = creationKeys(identity, workspaceId).draft;
          const prepared = startPageDraft(
            sessionStorage.getItem(key) ?? "",
            !!page,
          );
          sessionStorage.setItem(key, prepared.text);
          prepareField(creationGuideOwner(identity, workspaceId), {
            text: prepared.text,
            start: prepared.selectionStart,
            end: prepared.selectionEnd,
          });
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
              allowImmediate: !explain.on,
              onStart: () => start() === true,
            });
          } catch {
            if (!controller.signal.aborted) setProblem(true);
          } finally {
            if (!prepared) {
              preparation.current = null;
              if (!controller.signal.aborted) setPreparing(undefined);
            }
          }
        }}
      />
      {problem ? (
        <p role="status" data-testid="landing-problem">
          {t.goalSkillUnchecked}
        </p>
      ) : null}
    </>
  );
}
