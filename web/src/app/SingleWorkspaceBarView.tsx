import { type ReactNode, useRef, useState } from "react";
import { AccountShelf } from "../components";
import { ControlButton } from "../components/ControlElements";
import { Dialog } from "../components/Overlays";
import { TextField } from "../components/Primitives";
import {
  type SingleWorkspaceAction,
  SingleWorkspaceBar,
} from "../components/SingleWorkspaceBar";
import { liveText } from "../i18n";
import { statusText } from "../text/status";
import type { AccountProfile } from "./pi";
import type { Workspace } from "./snapshot";
import type { RootState } from "./store";
import { lastWorkspaceReason } from "./trashText";
import { connectionStatus, serverLabel, useServer } from "./WorkspaceRailView";

const txt = liveText(statusText);

/** Single-workspace mode's frame: the loader and the writes stay in App. */
export function SingleWorkspaceBarView({
  workspace,
  phase,
  source,
  profile,
  identityName,
  pathname,
  onNew,
  newReason,
  onAdd,
  onRename,
  onNewWorktree,
  newWorktreeReason,
  onSettings,
  onAdministration,
  onLogout,
  bell,
}: {
  bell?: ReactNode;
  workspace: Workspace;
  phase: RootState["connection"]["phase"];
  source: string;
  profile?: AccountProfile;
  identityName: string;
  pathname: string;
  onNew?: () => void;
  newReason?: string;
  onAdd?: () => void;
  /** Absent while the display name cannot be changed. */
  onRename?: (display: string) => void;
  /** An empty worktree agent; absent unless the workspace is a Git main checkout. */
  onNewWorktree?: (id: string) => void;
  newWorktreeReason?: string;
  onSettings: () => void;
  onAdministration: () => void;
  onLogout: () => void;
}) {
  const server = useServer(pathname);
  const connection = connectionStatus(phase, source);
  const name = workspace.display_name ?? workspace.name;
  const github = workspace.git_summary?.github_repo;
  const [status, setStatus] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [display, setDisplay] = useState(name);
  const renameReturn = useRef<HTMLElement>(null);
  const path = workspace.path?.endsWith(`/src/${workspace.name}`)
    ? `~/src/${workspace.name}`
    : (workspace.path ?? workspace.name);
  const act = (action: SingleWorkspaceAction) => {
    if (action === "copy" && workspace.path)
      void navigator.clipboard?.writeText(workspace.path).then(
        () => setStatus(txt.pathCopied),
        () => setStatus(txt.pathNotCopied),
      );
    if (action === "github" && github)
      window.open(
        `https://github.com/${github}`,
        "_blank",
        "noopener,noreferrer",
      );
    if (action === "rename" && onRename) {
      // The menu returns focus to its trigger; the dialog does the same.
      renameReturn.current = document.querySelector(".ah-single-more");
      setDisplay(name);
      setRenameOpen(true);
    }
    if (action === "add") onAdd?.();
    if (action === "worktree") onNewWorktree?.(workspace.workspace_id);
  };
  return (
    <>
      <SingleWorkspaceBar
        name={name}
        path={path}
        github={github}
        homeCurrent={pathname === "/" || pathname === "/workspaces"}
        connectionLabel={`${connection.label} · ${serverLabel(server)}`}
        connectionTone={connection.tone}
        onNew={onNew}
        newReason={newReason}
        renameReason={onRename ? undefined : txt.renameUnavailable}
        onAdd={onAdd}
        worktree={
          workspace.kind === "git_main_worktree"
            ? newWorktreeReason ||
              (onNewWorktree ? "" : txt.worktreeUnavailable)
            : undefined
        }
        trashReason={lastWorkspaceReason()}
        onAction={act}
        status={status}
        bell={bell}
        account={
          <AccountShelf
            profile={
              profile ?? { name: identityName, email: "", avatar_url: "" }
            }
            server={{
              name: serverLabel(server),
              version: server?.version,
              connectionLabel: connection.label,
              tone: connection.tone,
            }}
            placement="bottom end"
            onSettings={onSettings}
            onAdministration={
              server?.administrator ? onAdministration : undefined
            }
            onLogout={onLogout}
          />
        }
      />
      <div className="ah-workspace-rename">
        <Dialog
          triggerLabel={txt.rename}
          title={txt.renameTitle}
          returnFocusRef={renameReturn}
          isOpen={renameOpen}
          onOpenChange={setRenameOpen}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!onRename) return;
              onRename(display);
              setRenameOpen(false);
            }}
          >
            <TextField
              data-testid="workspace-display-name"
              label={txt.displayName}
              value={display}
              onChange={setDisplay}
            />
            <ControlButton size="page" type="submit" isDisabled={!onRename}>
              Tallenna
            </ControlButton>
          </form>
        </Dialog>
      </div>
    </>
  );
}
