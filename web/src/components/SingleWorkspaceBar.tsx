import type { ReactNode } from "react";
import { ControlButton, LinkRow } from "./ControlElements";
import { Icon } from "./Icon";
import { Menu } from "./Overlays";
import type { Tone } from "./types";
import "./SingleWorkspaceBar.css";
import { liveText } from "../i18n";
import { statusText } from "../text/status";

const txt = liveText(statusText);

export type SingleWorkspaceAction =
  | "copy"
  | "github"
  | "rename"
  | "worktree"
  | "add"
  | "trash";

/**
 * The frame of single-workspace mode (Yläpalkissa, Jari 18.10.2026): with one
 * visible workspace there is no sidebar. The workspace's name takes the
 * server's place and leads home; its own actions are in the menu beside it,
 * and the server moves into the account menu. The mode is derived from the
 * snapshot, so this bar only presents it.
 */
export function SingleWorkspaceBar({
  name,
  path,
  github,
  homeCurrent,
  connectionLabel,
  connectionTone,
  onNew,
  newReason,
  renameReason,
  onAdd,
  worktree,
  trashReason,
  onAction,
  account,
  bell,
  status,
}: {
  name: string;
  /** The path as shown, ~/src/name when it lies there. */
  path: string;
  /** owner/repo when the workspace has a GitHub origin. */
  github?: string;
  homeCurrent: boolean;
  connectionLabel: string;
  connectionTone: Tone;
  onNew?: () => void;
  newReason?: string;
  /** Why the display name cannot be changed now; absent when it can. */
  renameReason?: string;
  /** Absent when no workspace can be added now. */
  onAdd?: () => void;
  /**
   * Offers an empty worktree agent (ADR 0025) for a Git main checkout: ""
   * when it can be made now, otherwise why not; absent for other workspaces.
   */
  worktree?: string;
  /** The last workspace is never moved to the Trash; this says why. */
  trashReason: string;
  onAction: (action: SingleWorkspaceAction) => void;
  account: ReactNode;
  /** The status bell, while no conversation's top bar carries it. */
  bell?: ReactNode;
  /** Live feedback of a menu action, read by screen readers. */
  status?: string;
}) {
  return (
    <header className="ah-single-bar">
      <LinkRow
        data-testid={`workspace-${name}`}
        href="/"
        kind="header"
        current={homeCurrent}
        className="ah-single-name"
        title={txt.homeOf(name)}
      >
        <Icon name="repo" />
        <span>{name}</span>
      </LinkRow>
      <Menu
        label={txt.actionsOf(name)}
        trigger={<span aria-hidden="true" />}
        triggerPresentation="icon"
        triggerClassName="ah-single-more"
        placement="bottom start"
        popoverClassName="ah-single-menu"
        heading={
          <span className="ah-single-menu-who">
            <Icon name="repo" />
            <span>
              <strong>{name}</strong>
              <small>{path}</small>
            </span>
          </span>
        }
        items={[
          { id: "copy", label: txt.copyPath },
          {
            id: "github",
            label: txt.openGitHub,
            description: github,
            availability: github
              ? undefined
              : {
                  state: "disabled",
                  reason: txt.noOrigin,
                },
          },
          {
            id: "rename",
            label: txt.rename,
            availability: renameReason
              ? { state: "disabled", reason: renameReason }
              : undefined,
          },
          ...(worktree === undefined
            ? []
            : [
                {
                  id: "worktree",
                  label: txt.newWorktree,
                  description: txt.newWorktreeDesc,
                  availability: worktree
                    ? { state: "disabled" as const, reason: worktree }
                    : undefined,
                },
              ]),
          {
            id: "add",
            label: txt.addWorkspace,
            group: "add",
            availability: onAdd
              ? undefined
              : {
                  state: "disabled",
                  reason: txt.addUnavailable,
                },
          },
          {
            id: "trash",
            label: txt.toTrash,
            group: "trash",
            danger: true,
            availability: { state: "disabled", reason: trashReason },
          },
        ]}
        onAction={(id) => onAction(id as SingleWorkspaceAction)}
      />
      <span className={`ah-single-conn ah-tone-${connectionTone}`}>
        <span aria-hidden="true" className="ah-status-dot" />
        <span className="ah-visually-hidden">{connectionLabel}</span>
      </span>
      <span className="ah-single-grow" />
      {bell}
      <ControlButton
        data-testid="single-new-conversation"
        size="row"
        variant="primary"
        className="ah-single-new"
        aria-label={txt.newConversation}
        title={newReason || txt.newConversation}
        isDisabled={!onNew || !!newReason}
        onPress={onNew}
      >
        <Icon name="plus" />
        <span className="ah-single-new-label">Uusi keskustelu</span>
      </ControlButton>
      {account}
      <span className="ah-visually-hidden" role="status">
        {status}
      </span>
    </header>
  );
}
