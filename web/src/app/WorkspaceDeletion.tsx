import { useCallback, useEffect, useRef, useState } from "react";
import {
  type DeletionView,
  WorkspaceDeleteDialog,
} from "../components/WorkspaceTrash";
import type { Workspace } from "./snapshot";
import { refusalText } from "./trashText";
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
  conversation?: (agentId: string) => { href: string } | undefined;
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
      conversation={conversation}
    />
  );
}
