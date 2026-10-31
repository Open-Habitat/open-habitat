import { useCallback, useEffect, useRef, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import {
  type DeletionView,
  WorkspaceDeleteDialog,
} from "../components/WorkspaceTrash";
import { liveText } from "../i18n";
import { workspaceDeletionText } from "../text/workspaceDeletion";
import { stopEditor } from "./editor";
import { WriteRefused } from "./mutations";
import type { Workspace } from "./snapshot";
import { closeShell } from "./terminals";
import { refusalText } from "./trashText";
import type { DeletionBlocker } from "./workspaceTrash";
import {
  checkWorkspaceDeletion,
  type DeletionCheck,
  type DeletionResult,
  deleteWorkspace,
  WorkspaceTrashError,
} from "./workspaceTrash";

/** What a finished deletion tells the app, which outlives the workspace page. */
export type DeletionOutcome = {
  name: string;
  remote?: string;
  result: Exclude<DeletionResult, DeletionCheck>;
};

const txt = liveText(workspaceDeletionText);

const problemOf = (e: unknown) =>
  refusalText(e instanceof WorkspaceTrashError ? e.code : "unavailable");

// The workspace page's trash button: check, confirm, then move or delete. A
// refusal that means the observation is old asks the app to read again.
export function WorkspaceDeletion({
  workspace,
  csrf,
  isOpen,
  onClose,
  onDone,
  refresh,
  conversation,
}: {
  workspace: Workspace;
  csrf: string;
  isOpen: boolean;
  onClose: () => void;
  onDone: (outcome: DeletionOutcome) => void;
  refresh: () => void;
  conversation?: (
    agentId: string,
  ) => { href: string; title?: string } | undefined;
}) {
  const [view, setView] = useState<DeletionView>({ state: "checking" });
  const [round, setRound] = useState(0);
  const name = workspace.display_name ?? workspace.name;
  const remote = workspace.git_summary?.github_repo;
  const target = useRef(workspace);
  target.current = workspace;
  // biome-ignore lint/correctness/useExhaustiveDependencies: round explicitly asks for a fresh check; the workspace is read from the ref at that moment.
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setView({ state: "checking" });
    void checkWorkspaceDeletion(target.current, csrf, controller.signal).then(
      (check) => {
        if (!controller.signal.aborted) setView({ state: "checked", check });
      },
      (e) => {
        if (controller.signal.aborted) return;
        if (e instanceof WorkspaceTrashError && e.code === "workspace_changed")
          refresh();
        setView({ state: "failed", problem: problemOf(e) });
      },
    );
    return () => controller.abort();
  }, [isOpen, round, csrf]);
  const confirm = useCallback(
    (disposal: "trash" | "permanent") => {
      if (view.state !== "checked") return;
      const check = view.check;
      setView({ state: "working", check, disposal });
      void deleteWorkspace(target.current, disposal, csrf).then(
        (result) => {
          if ("outcome" in result) {
            setView({ state: "checked", check: result });
            return;
          }
          refresh();
          onDone({ name, remote, result });
        },
        (e) => {
          if (
            e instanceof WorkspaceTrashError &&
            (e.code === "workspace_changed" ||
              e.code === "workspace_not_clean" ||
              e.code === "workspace_partial")
          )
            refresh();
          setView({ state: "checked", check, problem: problemOf(e) });
        },
      );
    },
    [view, csrf, name, remote, onDone, refresh],
  );
  return (
    <WorkspaceDeleteDialog
      name={name}
      remote={remote}
      view={view}
      isOpen={isOpen}
      onClose={onClose}
      onRecheck={() => setRound((n) => n + 1)}
      onConfirm={confirm}
      blockerAction={(blocker) =>
        blocker.product && (
          <ProductBlockerAction
            blocker={blocker}
            workspaceId={workspace.workspace_id}
            csrf={csrf}
            onResolved={() => setRound((n) => n + 1)}
          />
        )
      }
      conversation={conversation}
    />
  );
}

function ProductBlockerAction({
  blocker,
  workspaceId,
  csrf,
  onResolved,
}: {
  blocker: DeletionBlocker;
  workspaceId: string;
  csrf: string;
  onResolved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState("");
  if (blocker.product === "terminal" && !blocker.shell) return null;
  return (
    <>
      <ControlButton
        data-testid={
          blocker.product === "terminal"
            ? "close-blocker-terminal"
            : "stop-blocker-editor"
        }
        variant="secondary"
        size="row"
        isDisabled={pending}
        onPress={() => {
          setPending(true);
          setProblem("");
          void (async () => {
            try {
              if (blocker.product === "terminal" && blocker.shell) {
                try {
                  await closeShell(workspaceId, blocker.shell, csrf);
                } catch (error) {
                  if (
                    !(
                      error instanceof WriteRefused &&
                      error.code === "shell_ended"
                    )
                  )
                    throw error;
                }
              } else {
                const result = await stopEditor(csrf);
                if (result.kind !== "ok")
                  throw new Error("editor stop not confirmed");
              }
              onResolved();
            } catch {
              setProblem(txt.closeUncertain);
            } finally {
              setPending(false);
            }
          })();
        }}
      >
        {pending
          ? txt.closing
          : blocker.product === "terminal"
            ? txt.closeTerminal
            : txt.stopEditor}
      </ControlButton>
      {problem && <p role="alert">{problem}</p>}
    </>
  );
}
