import { type RefObject, useState } from "react";
import type { Workspace } from "../app/snapshot";
import { useText } from "../i18n";
import { workspaceActionsText } from "../text/workspaceActions";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";

export function WorkspacePathCopy({
  path,
  inline = false,
}: {
  path?: string;
  inline?: boolean;
}) {
  const t = useText(workspaceActionsText);
  const [copyState, setCopyState] = useState<"" | "copied" | "failed">("");
  const note =
    copyState === "copied"
      ? t.pathCopied
      : copyState === "failed"
        ? t.pathNotCopied
        : "";
  return (
    <>
      <ControlButton
        data-testid="copy-path"
        size={inline ? "inline" : "row"}
        variant="quiet"
        presentation="icon"
        aria-label={t.copyPath}
        title={note || t.copyPath}
        isDisabled={!path || !navigator.clipboard}
        onPress={() => {
          if (path)
            void navigator.clipboard.writeText(path).then(
              () => setCopyState("copied"),
              () => setCopyState("failed"),
            );
        }}
      >
        <Icon name={copyState === "copied" ? "check" : "copy"} />
      </ControlButton>
      {note ? (
        <span className="ah-visually-hidden" role="status">
          {note}
        </span>
      ) : null}
    </>
  );
}

/** The rail and home lead to the workspace; its own actions live in its head. */
export function WorkspaceActions({
  workspace,
  onNew,
  newReason,
  rail = false,
  onHide,
  hidePending = false,
  settingsAvailable = false,
  deleteRef,
  onDelete,
  onNewWorktree,
  page = false,
  c2a = false,
}: {
  workspace: Workspace;
  onNew?: (id: string) => void;
  /** Opens an empty worktree agent (ADR 0025) for a Git main checkout. */
  onNewWorktree?: (id: string) => void;
  newReason?: string;
  rail?: boolean;
  onHide?: () => void;
  hidePending?: boolean;
  settingsAvailable?: boolean;
  deleteRef?: RefObject<HTMLButtonElement | null>;
  onDelete?: () => void;
  page?: boolean;
  c2a?: boolean;
}) {
  const t = useText(workspaceActionsText);
  const hidden = workspace.visibility === "hidden";
  const github = workspace.git_summary?.github_repo;
  const start = (
    <ControlButton
      data-workspace-name={workspace.display_name ?? workspace.name}
      variant={page ? "primary" : "quiet"}
      size={page ? "row" : "inline"}
      presentation={c2a ? undefined : "icon"}
      className={
        c2a
          ? "ah-c2a-primary"
          : page
            ? "ah-workspace-plus"
            : rail
              ? "ah-workspace-more"
              : "ah-home-more"
      }
      data-testid={
        page ? "conversation-start" : `workspace-start-${workspace.name}`
      }
      aria-label={
        page
          ? t.startConversation
          : t.newConversationIn(workspace.display_name ?? workspace.name)
      }
      isDisabled={!onNew || !!newReason}
      title={newReason || t.newConversation}
      tooltip={c2a ? newReason || t.newConversation : undefined}
      onPress={() => onNew?.(workspace.workspace_id)}
    >
      <Icon name="plus" />
      {c2a ? t.newConversation : null}
    </ControlButton>
  );
  const worktree =
    workspace.kind === "git_main_worktree" ? (
      <ControlButton
        data-testid="new-worktree"
        size="row"
        variant={c2a ? "secondary" : "quiet"}
        presentation={c2a ? undefined : "icon"}
        className={c2a ? "ah-c2a-worktree" : undefined}
        aria-label={t.newWorktreeIn(workspace.display_name ?? workspace.name)}
        title={newReason || t.newWorktreeHint}
        tooltip={c2a ? newReason || t.newWorktreeHint : undefined}
        isDisabled={!onNewWorktree || !!newReason}
        onPress={() => onNewWorktree?.(workspace.workspace_id)}
      >
        <Icon name="worktreeNew" />
        {c2a ? <span>{t.newWorktree}</span> : null}
      </ControlButton>
    ) : null;
  const other = (
    <>
      <ControlButton
        data-testid="open-github"
        size="row"
        variant={c2a ? "secondary" : "quiet"}
        presentation="icon"
        aria-label={t.openGitHub}
        title={github ? t.openGitHubRepo(github) : t.noOrigin}
        isDisabled={!github}
        onPress={() => {
          if (github)
            window.open(
              `https://github.com/${github}`,
              "_blank",
              "noopener,noreferrer",
            );
        }}
      >
        <Icon name="github" />
      </ControlButton>
      <ControlButton
        size="row"
        variant={c2a ? "secondary" : "quiet"}
        presentation="icon"
        data-testid={hidden ? "workspace-restore" : "workspace-archive"}
        aria-label={hidden ? t.restore : t.hide}
        title={
          c2a && (!settingsAvailable || !onHide || hidePending)
            ? t.changesUnavailable
            : hidden
              ? t.restoreHint
              : t.hideHint
        }
        aria-pressed={c2a ? undefined : hidden}
        isDisabled={!settingsAvailable || !onHide || hidePending}
        onPress={onHide}
      >
        <Icon name={hidden ? "eye" : "eyeOff"} />
      </ControlButton>
      {c2a ? <span className="ah-c2a-delete-gap" aria-hidden="true" /> : null}
      <ControlButton
        data-testid="delete-workspace"
        size="row"
        ref={deleteRef}
        variant={c2a ? "secondary" : "danger-subtle"}
        className={c2a ? "ah-c2a-delete" : undefined}
        presentation="icon"
        aria-label={t.delete}
        title={onDelete && settingsAvailable ? t.delete : t.deleteUnavailable}
        isDisabled={!settingsAvailable || !onDelete}
        onPress={onDelete}
      >
        <Icon name="trash" />
      </ControlButton>
    </>
  );
  return (
    // biome-ignore lint/a11y/useSemanticElements: action group is not a form fieldset.
    <div
      data-testid={page ? "workspace-actions" : undefined}
      className={
        c2a
          ? "ah-c2a-actions"
          : page
            ? "ah-workspace-icon-row"
            : rail
              ? "ah-rail-workspace-actions"
              : "ah-home-actions"
      }
      role="group"
      aria-label={page ? t.group : undefined}
    >
      {c2a ? (
        <>
          {start}
          {worktree}
          <div className="ah-c2a-icons">{other}</div>
        </>
      ) : (
        <>
          {page ? (
            <>
              <WorkspacePathCopy path={workspace.path} />
              {other}
              <span
                className="ah-workspace-action-divider"
                aria-hidden="true"
              />
              {worktree}
            </>
          ) : null}
          {start}
        </>
      )}
    </div>
  );
}
