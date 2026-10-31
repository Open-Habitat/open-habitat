import { type RefObject, useState } from "react";
import type { Workspace } from "../app/snapshot";
import { useText } from "../i18n";
import { workspaceActionsText } from "../text/workspaceActions";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";

/** The rail and home lead to the workspace; its own actions live in its head. */
export function WorkspaceActions({
  workspace,
  onNew,
  newReason,
  rail = false,
  onRename,
  onHide,
  hidePending = false,
  settingsAvailable = false,
  renameRef,
  deleteRef,
  onDelete,
  onNewWorktree,
  page = false,
}: {
  workspace: Workspace;
  onNew?: (id: string) => void;
  /** Opens an empty worktree agent (ADR 0025); the page offers it for a
   * Git main checkout. */
  onNewWorktree?: (id: string) => void;
  newReason?: string;
  rail?: boolean;
  onRename?: () => void;
  onHide?: () => void;
  hidePending?: boolean;
  settingsAvailable?: boolean;
  renameRef?: RefObject<HTMLButtonElement | null>;
  deleteRef?: RefObject<HTMLButtonElement | null>;
  /** Opens the deletion confirmation; absent while changes are not allowed. */
  onDelete?: () => void;
  page?: boolean;
}) {
  const t = useText(workspaceActionsText);
  const [copyState, setCopyState] = useState<"" | "copied" | "failed">("");
  const copyNote =
    copyState === "copied"
      ? t.pathCopied
      : copyState === "failed"
        ? t.pathNotCopied
        : "";
  const hidden = workspace.visibility === "hidden";
  const github = workspace.git_summary?.github_repo;
  return (
    // biome-ignore lint/a11y/useSemanticElements: action group is not a form fieldset.
    <div
      data-testid={page ? "workspace-actions" : undefined}
      className={
        page
          ? "ah-workspace-icon-row"
          : rail
            ? "ah-rail-workspace-actions"
            : "ah-home-actions"
      }
      role="group"
      aria-label={page ? t.group : undefined}
    >
      {page ? (
        <>
          <ControlButton
            data-testid="copy-path"
            size="row"
            variant="quiet"
            presentation="icon"
            aria-label={t.copyPath}
            title={copyNote || t.copyPath}
            isDisabled={!workspace.path || !navigator.clipboard}
            onPress={() => {
              if (workspace.path)
                void navigator.clipboard.writeText(workspace.path).then(
                  () => setCopyState("copied"),
                  () => setCopyState("failed"),
                );
            }}
          >
            <Icon name={copyState === "copied" ? "check" : "copy"} />
          </ControlButton>
          <ControlButton
            data-testid="open-github"
            size="row"
            variant="quiet"
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
            data-testid="rename-workspace"
            size="row"
            ref={renameRef}
            variant="quiet"
            presentation="icon"
            aria-label={t.rename}
            title={t.rename}
            isDisabled={!settingsAvailable || !onRename}
            onPress={onRename}
          >
            <Icon name="pencil" />
          </ControlButton>
          <ControlButton
            size="row"
            variant="quiet"
            presentation="icon"
            data-testid={hidden ? "workspace-restore" : "workspace-archive"}
            aria-label={hidden ? t.restore : t.archive}
            title={hidden ? t.restoreHint : t.archiveHint}
            aria-pressed={hidden}
            isDisabled={!settingsAvailable || !onHide || hidePending}
            onPress={onHide}
          >
            <Icon name={hidden ? "eye" : "eyeOff"} />
          </ControlButton>
          <ControlButton
            data-testid="delete-workspace"
            size="row"
            ref={deleteRef}
            variant="danger-subtle"
            presentation="icon"
            aria-label={t.delete}
            title={onDelete ? t.delete : t.deleteUnavailable}
            isDisabled={!settingsAvailable || !onDelete}
            onPress={onDelete}
          >
            <Icon name="trash" />
          </ControlButton>
          <span className="ah-workspace-action-divider" aria-hidden="true" />
          {workspace.kind === "git_main_worktree" ? (
            <ControlButton
              data-testid="new-worktree"
              size="row"
              variant="quiet"
              presentation="icon"
              aria-label={t.newWorktreeIn(
                workspace.display_name ?? workspace.name,
              )}
              title={newReason || t.newWorktreeHint}
              isDisabled={!onNewWorktree || !!newReason}
              onPress={() => onNewWorktree?.(workspace.workspace_id)}
            >
              <Icon name="worktreeNew" />
            </ControlButton>
          ) : null}
          {copyNote ? (
            <span className="ah-visually-hidden" role="status">
              {copyNote}
            </span>
          ) : null}
        </>
      ) : null}
      <ControlButton
        data-workspace-name={workspace.display_name ?? workspace.name}
        variant={page ? "primary" : "quiet"}
        size={page ? "row" : "inline"}
        presentation="icon"
        className={
          page
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
        onPress={() => onNew?.(workspace.workspace_id)}
      >
        <Icon name="plus" />
      </ControlButton>
    </div>
  );
}
