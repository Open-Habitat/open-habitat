import { type ReactNode, useRef, useState } from "react";
import { ArchiveNotice } from "../components/ArchiveNotice";
import { agentPresentation } from "../components/agentPresentation";
import { ControlButton, LinkRow } from "../components/ControlElements";
import {
  GitStatusDetails,
  type GitSummaryFacts,
} from "../components/GitStatus";
import {
  type HomeConversation,
  HomeConversationGrid,
  homeSections,
  useCardArchiveAction,
} from "../components/HomeWorkspaces";
import { Dialog } from "../components/Overlays";
import { PendingNote } from "../components/PendingNote";
import { TextField } from "../components/Primitives";
import { WorkspaceActions } from "../components/WorkspaceActions";
import { WorkspaceGitLayer } from "../components/WorkspaceGitLayer";
import type { WorkspaceIconModel } from "../components/WorkspaceIcon";
import { WorkspaceIconPicker } from "../components/WorkspaceIconPicker";
import { useGitStatus } from "./ConversationGitStatus";
import {
  type ConversationStore,
  useConversationMetadata,
} from "./conversationStore";
import type { PendingPhase } from "./mutations";
import { type Choice, PiModelSelector } from "./PiModelSelector";
import type { Workspace } from "./snapshot";
import { type DeletionOutcome, WorkspaceDeletion } from "./WorkspaceDeletion";
import { WorkspaceGitHub } from "./WorkspaceGitHub";
import { WorkspaceLanding } from "./WorkspaceLanding";
import { WorktreeCleanup } from "./WorktreeCleanup";
import { iconPicker, iconSourceLine } from "./workspaceIcons";
import { useWorkspaceIconWrite } from "./workspaceIconWrite";
import "./WorkspacePage.css";

export function WorkspacePage({
  workspace,
  conversations,
  store,
  csrf,
  identity,
  onNew,
  onNewWorktree,
  onArchive,
  archiveReason,
  onNewChoice,
  startReason,
  onRecheckCreation,
  defaultRefused,
  defaultUnavailable,
  onRefreshDefault,
  onVisibility,
  visibilityPhase,
  visibilityProblem = "",
  onRename,
  renamePhase,
  renameProblem = "",
  conversationProblem = "",
  onDismissProblem,
  refresh,
  onDeleted,
  single = false,
  archived,
  archivedPlace = "rail",
  icon,
  onLogin,
}: {
  workspace: Workspace;
  conversations: HomeConversation[];
  store: ConversationStore;
  csrf?: string;
  /** The person whose new-conversation draft a chosen goal prepares. */
  identity?: string;
  onNew?: (id: string) => void;
  onNewWorktree?: (id: string) => void;
  onArchive?: (id: string) => Promise<boolean>;
  archiveReason?: (conversation: HomeConversation) => string;
  onNewChoice?: (id: string, choice: Choice) => void;
  startReason?: string;
  onRecheckCreation?: () => void;
  defaultRefused?: boolean;
  defaultUnavailable?: boolean;
  onRefreshDefault?: () => void;
  /** Archive (hide) or restore: optimistic, shown at once (ADR 0023). */
  onVisibility?: (hidden: boolean) => Promise<boolean>;
  visibilityPhase?: PendingPhase;
  visibilityProblem?: string;
  /** Rename: optimistic as well; the dialog closes at once. */
  onRename?: (display: string) => void;
  renamePhase?: PendingPhase;
  renameProblem?: string;
  /** A refused pending command on one of its conversations, with its reason. */
  conversationProblem?: string;
  onDismissProblem?: () => void;
  refresh: () => void;
  /** The workspace left ~/src: the app shows the outcome and leaves the page. */
  onDeleted?: (outcome: DeletionOutcome) => void;
  /**
   * Single-workspace mode's home (Yläpalkissa): the page is the person's
   * conversations and Git; the workspace's name and actions are in the top
   * bar, and the last workspace is never offered for the Trash.
   */
  single?: boolean;
  /** Hidden workspaces, which single-workspace mode has no sidebar for. */
  archived?: ReactNode;
  /** Where hidden workspaces are listed: home in single-workspace mode. */
  archivedPlace?: "rail" | "home";
  /** The workspace's icon, while the experimental workspace icons are on:
   * the heading shows it and it opens the icon picker. */
  icon?: WorkspaceIconModel;
  onLogin?: () => void;
}) {
  const archiveAction = useCardArchiveAction(onArchive);
  const metadata = useConversationMetadata(store);
  const decorated = conversations.map((c) => ({
    ...c,
    attention: metadata.attention.get(c.id) ?? c.attention,
    command: metadata.staleStatuses.has(c.id)
      ? c.command
      : (metadata.statuses.get(c.id)?.state ?? c.command),
    runActive: metadata.staleStatuses.has(c.id)
      ? c.runActive
      : (metadata.statuses.get(c.id)?.run_active ?? c.runActive),
    pendingQuestion:
      !metadata.staleStatuses.has(c.id) &&
      (!!metadata.statuses.get(c.id)?.pending_question || !!c.pendingQuestion),
  }));
  const section = homeSections([workspace], decorated)[0];
  const done = decorated.filter(
    (c) => !section.open.some((open) => open.id === c.id),
  );
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryChoice, setRecoveryChoice] = useState<Choice>();
  const actionButton = useRef<HTMLButtonElement>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [display, setDisplay] = useState(
    workspace.display_name ?? workspace.name,
  );
  const [hideNotice, setHideNotice] = useState(false);
  const hidden = workspace.visibility === "hidden";
  const isGit =
    workspace.kind === "git_main_worktree" ||
    workspace.kind === "git_linked_worktree";
  const gitStatus = useGitStatus(workspace, csrf, { eager: true });
  const git = gitStatus.detail;
  const iconWrite = useWorkspaceIconWrite({
    workspace,
    csrf,
    refresh,
    reread: gitStatus.details.onReread,
    onLogin,
  });
  const source = iconSourceLine(workspace);
  // A second click while the first is unconfirmed queues behind it.
  const archive = (next: boolean) => {
    if (!onVisibility) return;
    setHideNotice(next);
    void onVisibility(next).then((ok) => {
      if (!ok && next) setHideNotice(false);
    });
  };
  const rename = () => {
    if (!onRename || !csrf || workspace.mutation_state !== "allowed") return;
    onRename(display);
    setRenameOpen(false);
  };
  const displayPath = workspace.path?.endsWith(`/src/${workspace.name}`)
    ? `~/src/${workspace.name}`
    : (workspace.path ?? workspace.name);
  const activities = decorated.map((c) => agentPresentation(c).activity);
  const waiting = decorated.filter(
    (c) => c.attention === "new" || agentPresentation(c).activity === "waiting",
  ).length;
  const working = activities.filter((a) => a === "working").length;
  const background = activities.filter(
    (a) => a === "waiting_background",
  ).length;
  const summary = !gitStatus.readError ? gitStatus.facts : undefined;
  const label = summary
    ? `${summary.branch} · ${summary.dirty_count} ${summary.dirty_count === 1 ? "muutos" : "muutosta"}${summary.ahead ? ` ↑${summary.ahead}` : ""}${summary.behind ? ` ↓${summary.behind}` : ""}`
    : "Git-tila ei tiedossa";
  const summaryText = [
    waiting ? `${waiting} odottaa sinua` : "",
    working ? `${working} työskentelee` : "",
    background ? `${background} odottaa taustatyötä` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const gitControl = isGit ? (
    <WorkspaceGitLayer
      label={label}
      title={`Git · ${workspace.name}`}
      open={gitStatus.open}
      onOpenChange={gitStatus.setOpen}
    >
      {summary || git ? (
        <GitStatusDetails
          embedded
          summary={(summary ?? git) as GitSummaryFacts}
          {...gitStatus.details}
        />
      ) : (
        <p role="status">
          Git-tilaa ei voitu lukea. Näkyvä tila ei ole vahvistettu.
        </p>
      )}
      {workspace.kind === "git_main_worktree" &&
      (workspace.git_remote === "none" || workspace.publish_continuation) ? (
        <WorkspaceGitHub
          workspace={workspace}
          csrf={csrf}
          refresh={() => {
            refresh();
            gitStatus.details.onReread();
          }}
        />
      ) : null}
    </WorkspaceGitLayer>
  ) : (
    <p className="ah-git-note">
      {workspace.kind === "directory"
        ? "Hakemisto · ei Git-työtilaa"
        : "Git-tila ei tiedossa"}
    </p>
  );
  return (
    <div
      className={`ah-workspace-page${single ? " ah-workspace-page-single" : ""}`}
    >
      {single ? (
        <header className="ah-workspace-page-head">
          <div className="ah-workspace-page-title">
            <h1 tabIndex={-1}>Keskustelut</h1>
            <p className="ah-workspace-summary">
              {summaryText || "Mikään ei odota sinua"}
            </p>
          </div>
          {gitControl}
        </header>
      ) : (
        <header className="ah-workspace-page-head">
          {icon ? (
            <WorkspaceIconPicker
              model={iconPicker(icon, workspace, iconWrite.pending)}
              onChoose={(value) => void iconWrite.choose(value)}
              isDisabled={!iconWrite.available}
              disabledReason="Kuvaketta voi vaihtaa, kun työtilan tila on vahvistettu."
            />
          ) : null}
          <div className="ah-workspace-page-title">
            <h1 data-testid="workspace-title" tabIndex={-1}>
              {workspace.display_name ?? workspace.name}
            </h1>
            <p>
              <code title={workspace.path}>{displayPath}</code>
            </p>
            {icon ? (
              <p
                className="ah-workspace-icon-source"
                data-testid="workspace-icon-source"
              >
                Kuvake: {source.source}
                {source.where ? (
                  <>
                    {" · "}
                    <code>{source.where}</code>
                  </>
                ) : null}
              </p>
            ) : null}
            {hidden ? (
              <span className="ah-workspace-hidden">
                Arkistoitu · tiedostot ja keskustelut säilyvät ·{" "}
                <ControlButton
                  variant="quiet"
                  size="inline"
                  isDisabled={
                    !onVisibility ||
                    !csrf ||
                    workspace.mutation_state !== "allowed"
                  }
                  onPress={() => archive(false)}
                >
                  Palauta
                </ControlButton>
              </span>
            ) : null}
          </div>
          <WorkspaceActions
            page
            workspace={workspace}
            renameRef={actionButton}
            onNew={onNew}
            onNewWorktree={onNewWorktree}
            newReason={startReason}
            onRename={() => {
              setDisplay(workspace.display_name ?? workspace.name);
              setRenameOpen(true);
            }}
            onHide={onVisibility ? () => archive(!hidden) : undefined}
            settingsAvailable={!!csrf && workspace.mutation_state === "allowed"}
            deleteRef={deleteButton}
            onDelete={
              csrf && onDeleted && workspace.observation_token
                ? () => setDeleteOpen(true)
                : undefined
            }
          />
        </header>
      )}
      {csrf && onDeleted && deleteOpen ? (
        <WorkspaceDeletion
          workspace={workspace}
          csrf={csrf}
          isOpen
          onClose={() => {
            setDeleteOpen(false);
            queueMicrotask(() => deleteButton.current?.focus());
          }}
          onDone={(outcome) => {
            setDeleteOpen(false);
            onDeleted(outcome);
          }}
          refresh={refresh}
          conversation={(agentId) => decorated.find((c) => c.id === agentId)}
        />
      ) : null}
      {hideNotice && hidden ? (
        <ArchiveNotice
          kind="workspace-archive"
          title={workspace.display_name ?? workspace.name}
          detail={`Tiedostot ja keskustelut säilyvät. Löydät sen ${archivedPlace === "home" ? "etusivun" : "sivupalkin"} lopusta, Arkistoidut-ryhmästä.`}
          restoreLabel="Kumoa"
          busy={false}
          onRestore={() => archive(false)}
          onClose={() => setHideNotice(false)}
        />
      ) : null}
      <PendingNote phase={visibilityPhase ?? renamePhase} />
      {icon && iconWrite.note ? (
        <p role="status" data-testid="workspace-icon-note">
          {iconWrite.note}
        </p>
      ) : null}
      {visibilityProblem ? <p role="alert">{visibilityProblem}</p> : null}
      {renameProblem ? <p role="alert">{renameProblem}</p> : null}
      {conversationProblem ? (
        <p role="alert">
          {conversationProblem}{" "}
          {onDismissProblem ? (
            <ControlButton
              data-testid="dialog-close"
              variant="quiet"
              size="inline"
              onPress={onDismissProblem}
            >
              Sulje
            </ControlButton>
          ) : null}
        </p>
      ) : null}
      {startReason ? <p role="status">{startReason}</p> : null}
      {onRecheckCreation ? (
        <ControlButton
          data-testid="creation-recheck"
          size="row"
          variant="secondary"
          onPress={onRecheckCreation}
        >
          Tarkista luonnin tulos
        </ControlButton>
      ) : null}
      {defaultUnavailable && onRefreshDefault ? (
        <ControlButton size="row" variant="quiet" onPress={onRefreshDefault}>
          Päivitä oletusagentin tiedot
        </ControlButton>
      ) : null}
      {defaultRefused && onNewChoice ? (
        <Dialog
          data-testid="model-picker-open"
          triggerLabel="Valitse toinen malli"
          title="Malli uudelle keskustelulle"
          isOpen={recoveryOpen}
          onOpenChange={setRecoveryOpen}
        >
          <PiModelSelector
            csrf={csrf}
            scope="new"
            onChoice={setRecoveryChoice}
          />
          <ControlButton
            data-testid="conversation-model-start"
            size="page"
            isDisabled={!recoveryChoice || !csrf}
            onPress={() => {
              if (recoveryChoice) {
                onNewChoice(workspace.workspace_id, recoveryChoice);
                setRecoveryOpen(false);
              }
            }}
          >
            Aloita keskustelu valitulla mallilla
          </ControlButton>
        </Dialog>
      ) : null}
      {workspace.facts.some(
        (f) => f.source === "filesystem" && f.state === "confirmed",
      ) ? (
        <WorkspaceLanding
          key={workspace.workspace_id}
          workspaceId={workspace.workspace_id}
          identity={identity}
          onNew={onNew}
          startReason={startReason}
          single={single}
        />
      ) : null}
      {single ? null : (
        <div className="ah-workspace-git">
          {gitControl}
          <span className="ah-workspace-summary">{summaryText}</span>
        </div>
      )}
      {csrf && workspace.kind === "git_main_worktree" ? (
        <WorktreeCleanup
          csrf={csrf}
          workspaceId={workspace.workspace_id}
          hideWhenEmpty
          onChanged={refresh}
        />
      ) : null}
      <div className="ah-workspace-rename">
        <Dialog
          triggerLabel="Muuta näyttönimeä…"
          title="Muuta näyttönimeä"
          returnFocusRef={actionButton}
          isOpen={renameOpen}
          onOpenChange={setRenameOpen}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              rename();
            }}
          >
            <TextField
              data-testid="workspace-name"
              label="Näyttönimi"
              value={display}
              onChange={setDisplay}
            />
            <ControlButton
              data-testid="save-workspace-name"
              size="page"
              type="submit"
              isDisabled={!csrf || !onRename}
            >
              Tallenna
            </ControlButton>
          </form>
        </Dialog>
      </div>
      <section
        data-testid="open-conversations"
        aria-label="Avoimet keskustelut"
      >
        <h2>
          Avoimet <span>{section.open.length}</span>
        </h2>
        {section.open.length ? (
          <HomeConversationGrid
            conversations={section.open}
            archiveAction={archiveAction}
            archiveReason={archiveReason}
          />
        ) : (
          <p data-testid="workspace-conversations-empty">
            {single
              ? "Ei avoimia keskusteluja. Aloita uusi yläpalkin Uusi keskustelu -painikkeesta."
              : "Ei avoimia keskusteluja. Aloita uusi keskustelu +:sta."}
          </p>
        )}
      </section>
      <details className="ah-workspace-done">
        <summary>Valmiit · {done.length}</summary>
        <ul>
          {done.map((c) => (
            <li key={c.id}>
              <LinkRow href={c.href}>{c.title}</LinkRow>
            </li>
          ))}
        </ul>
      </details>
      {archived}
    </div>
  );
}
