import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
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
import { Icon } from "../components/Icon";
import { Dialog } from "../components/Overlays";
import { PendingNote } from "../components/PendingNote";
import {
  WorkspaceActions,
  WorkspacePathCopy,
} from "../components/WorkspaceActions";
import { WorkspaceGitLayer } from "../components/WorkspaceGitLayer";
import {
  WorkspaceIcon,
  type WorkspaceIconModel,
} from "../components/WorkspaceIcon";
import { WorkspaceIconPicker } from "../components/WorkspaceIconPicker";
import { WorkspaceIconSuggestions } from "../components/WorkspaceIconSuggestions";
import { type IconFrom, WorkspaceStrip } from "../components/WorkspaceStrip";
import type { OwnerConversation } from "../components/WorktreeAttention";
import { liveText } from "../i18n";
import { workspacePageText } from "../text/workspacePage";
import {
  chooseWorkspaceSound,
  useExperimentalFeature,
  useSessionPreferences,
} from "./accountPreferences";
import { playSound } from "./attentionSound";
import { useGitStatus } from "./ConversationGitStatus";
import {
  type ConversationStore,
  useConversationMetadata,
} from "./conversationStore";
import type { PendingPhase } from "./mutations";
import { type Choice, PiModelSelector } from "./PiModelSelector";
import { settingsHref } from "./settingsRoute";
import type { Workspace } from "./snapshot";
import type { HostChange } from "./store";
import { type DeletionOutcome, WorkspaceDeletion } from "./WorkspaceDeletion";
import { WorkspaceGitHub } from "./WorkspaceGitHub";
import { WorkspaceLanding } from "./WorkspaceLanding";
import { WorktreeCleanup } from "./WorktreeCleanup";
import { type IconSeen, useIconSuggestions } from "./workspaceIconSuggestions";
import {
  iconPicker,
  iconSetting,
  imageSuggestionReason,
  isImageCandidate,
  localSuggestions,
  previewIcon,
} from "./workspaceIcons";
import { commitNote, useWorkspaceIconWrite } from "./workspaceIconWrite";
import "./WorkspacePage.css";
import "./WorkspaceHeader.css";

const txt = liveText(workspacePageText);

/** After an icon choice: what was written to which file and whether it was
 * committed, Kumoa when there was an icon line to return to, and the way
 * back to the suggestions. */
function IconWrittenNotice({
  written,
  logo,
  onUndo,
  onSuggestions,
  onClose,
}: {
  written: NonNullable<ReturnType<typeof useWorkspaceIconWrite>["written"]>;
  logo?: string;
  onUndo: (previous: string) => void;
  onSuggestions: () => void;
  onClose: () => void;
}) {
  const name =
    written.value === "auto"
      ? txt.iconAuto
      : written.value === logo
        ? txt.iconLogo
        : /\.(svg|png|webp|jpe?g)$/i.test(written.value)
          ? txt.iconImage
          : written.value;
  const problem = commitNote(written.commit);
  const detail =
    written.commit === "unchanged"
      ? txt.unchanged
      : written.commit === "not_git"
        ? txt.written
        : written.commit === "committed"
          ? txt.committed
          : undefined;
  const previous = written.previous;
  return (
    <ArchiveNotice
      kind="workspace-icon"
      message={written.undo ? txt.iconRestored : txt.icon}
      title={name}
      detail={detail ? txt.suggestionsBack(detail) : undefined}
      problem={problem}
      busy={false}
      restoreLabel={txt.undo}
      onRestore={
        !written.undo &&
        previous !== undefined &&
        (written.commit === "committed" || written.commit === "not_git")
          ? () => onUndo(previous)
          : undefined
      }
      link={{ label: txt.suggestions, onPress: onSuggestions }}
      onClose={onClose}
    />
  );
}

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
  icon,
  onIconChanged,
  onLogin,
  ownerConversation,
  onRestoreConversation,
}: {
  workspace: Workspace;
  conversations: HomeConversation[];
  store: ConversationStore;
  csrf?: string;
  /** The person whose new-conversation draft a chosen goal prepares. */
  identity?: string;
  onNew?: (id: string) => boolean;
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
  /** The workspace's icon, while the experimental workspace icons are on:
   * the heading shows it and it opens the icon picker. */
  icon?: WorkspaceIconModel;
  /** A confirmed icon choice, for the host model the rail reads. */
  onIconChanged?: (change: HostChange) => void;
  onLogin?: () => void;
  /** The conversation that started a worktree's run, archived or not. */
  ownerConversation?: (id: string) => OwnerConversation | undefined;
  /** Restores an archived conversation; false when it was refused. An
   * unconfirmed restore still opens it, where the conversation shows its
   * own archive state and Restore. */
  onRestoreConversation?: (id: string) => Promise<boolean>;
}) {
  const navigate = useNavigate();
  const c2a = useExperimentalFeature("workspace-header-c2a");
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
  const deleteButton = useRef<HTMLButtonElement>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
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
    onChanged: onIconChanged,
    onLogin,
  });
  const soundPreferences = useSessionPreferences();
  const sound = soundPreferences.sound;
  const ownSound = sound.workspaces[workspace.workspace_id];
  // The suggestion row (Sirut): while the config names no icon, until the
  // person says Ei nyt for this visit; `icon: auto` hides it for good. The
  // picker can bring it back for this visit.
  const [suggestDismissed, setSuggestDismissed] = useState(false);
  const [suggestAgain, setSuggestAgain] = useState(false);
  const suggestWanted =
    !!icon &&
    iconWrite.available &&
    !iconWrite.pending &&
    (suggestAgain ||
      (iconSetting(workspace) === undefined && !suggestDismissed));
  const suggestions = useIconSuggestions(
    workspace.workspace_id,
    csrf,
    suggestWanted,
    identity,
  );
  // One object per page, so the wish field keeps its dictation engine.
  const speech = useMemo(
    () => ({ onOpenSettings: () => navigate(settingsHref("sanelu")) }),
    [navigate],
  );
  const acceptIcon = (value: string) => {
    setSuggestAgain(false);
    void iconWrite.choose(value);
  };
  // A second click while the first is unconfirmed queues behind it.
  const archive = (next: boolean) => {
    if (!onVisibility) return;
    setHideNotice(next);
    void onVisibility(next).then((ok) => {
      if (!ok && next) setHideNotice(false);
    });
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
    ? `${txt.gitLabel(summary.branch, summary.dirty_count)}${summary.ahead ? ` ↑${summary.ahead}` : ""}${summary.behind ? ` ↓${summary.behind}` : ""}`
    : txt.gitUnknown;
  const summaryText = [
    waiting ? txt.waiting(waiting) : "",
    working ? txt.working(working) : "",
    background ? txt.background(background) : "",
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
        <p role="status">{txt.gitUnreadable}</p>
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
      {workspace.kind === "directory" ? txt.directory : txt.gitUnknown}
    </p>
  );
  const iconPickerElement = icon ? (
    <WorkspaceIconPicker
      model={iconPicker(icon, workspace, iconWrite.pending)}
      onChoose={acceptIcon}
      isDisabled={!iconWrite.available}
      disabledReason={txt.iconUnavailable}
      footer={(close) => (
        <ControlButton
          data-testid="workspace-icon-ask-model"
          size="row"
          variant="quiet"
          onPress={() => {
            close();
            setSuggestDismissed(false);
            setSuggestAgain(true);
          }}
        >
          <Icon name="spark" /> {txt.askModel}
        </ControlButton>
      )}
    />
  ) : null;
  const actions = (
    <WorkspaceActions
      page
      c2a={c2a}
      workspace={workspace}
      onNew={onNew}
      onNewWorktree={onNewWorktree}
      newReason={startReason}
      onHide={onVisibility ? () => archive(!hidden) : undefined}
      settingsAvailable={!!csrf && workspace.mutation_state === "allowed"}
      deleteRef={deleteButton}
      onDelete={
        csrf && onDeleted && workspace.observation_token
          ? () => setDeleteOpen(true)
          : undefined
      }
    />
  );
  return (
    <div className="ah-workspace-page" data-header-c2a={c2a || undefined}>
      {c2a ? null : (
        <header className="ah-workspace-page-head">
          {icon ? (
            <span
              className="ah-workspace-head-icon"
              data-testid="workspace-head-icon"
            >
              <WorkspaceIcon
                icon={iconPicker(icon, workspace, iconWrite.pending).icon}
                size="l"
              />
            </span>
          ) : (
            iconPickerElement
          )}
          <div className="ah-workspace-page-title">
            <h1 data-testid="workspace-title" tabIndex={-1}>
              {workspace.display_name ?? workspace.name}
            </h1>
            <p data-testid="workspace-path">
              <code title={workspace.path}>{displayPath}</code>
            </p>
            {hidden ? (
              <span className="ah-workspace-hidden">
                {txt.hidden}{" "}
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
                  {txt.restore}
                </ControlButton>
              </span>
            ) : null}
          </div>
          {actions}
        </header>
      )}
      <WorkspaceStrip
        headingPath={
          c2a ? (
            <div className="ws-heading-path" data-testid="workspace-path">
              <code title={workspace.path}>{displayPath}</code>
              <WorkspacePathCopy path={workspace.path} inline />
            </div>
          ) : undefined
        }
        actions={c2a ? actions : undefined}
        workspaceId={workspace.workspace_id}
        icon={iconPickerElement}
        iconFrom={
          icon
            ? iconFrom(
                workspace,
                iconPicker(icon, workspace, iconWrite.pending).icon,
              )
            : undefined
        }
        name={workspace.display_name ?? workspace.name}
        folder={displayPath}
        onRename={
          onRename && csrf && workspace.mutation_state === "allowed"
            ? (value) => onRename(value)
            : undefined
        }
        sound={ownSound ?? sound.default}
        ownSound={ownSound}
        defaultSound={sound.default}
        length={sound.length}
        enabled={sound.enabled}
        onChooseSound={
          soundPreferences.identity &&
          soundPreferences.csrf &&
          soundPreferences.loaded
            ? (id) => {
                if (soundPreferences.identity && soundPreferences.csrf)
                  void chooseWorkspaceSound(
                    soundPreferences.identity,
                    workspace.workspace_id,
                    id,
                    soundPreferences.csrf,
                  );
              }
            : undefined
        }
        onPreview={(id, where) => playSound(id, sound.length, where)}
      />
      {c2a && hidden ? (
        <span className="ah-workspace-hidden">{txt.hidden}</span>
      ) : null}
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
          message={txt.hiddenNotice}
          detail={txt.hiddenRail}
          restoreLabel={txt.undo}
          busy={false}
          onRestore={() => archive(false)}
          onClose={() => setHideNotice(false)}
        />
      ) : null}
      <PendingNote phase={visibilityPhase ?? renamePhase} />
      {icon && iconWrite.written ? (
        <IconWrittenNotice
          written={iconWrite.written}
          logo={workspace.icon_logo?.path}
          onUndo={(previous) => void iconWrite.choose(previous, true)}
          onSuggestions={() => {
            iconWrite.dismissWritten();
            setSuggestDismissed(false);
            setSuggestAgain(true);
          }}
          onClose={iconWrite.dismissWritten}
        />
      ) : null}
      {icon && iconWrite.note ? (
        <p role="status" data-testid="workspace-icon-note">
          {iconWrite.note}
        </p>
      ) : null}
      {icon && suggestWanted && suggestions.state ? (
        <WorkspaceIconSuggestions
          model={(() => {
            const state = suggestions.state;
            const round = state.rounds[state.at];
            return {
              status: state.status,
              reason: state.reason,
              items: round
                ? round.suggestions.map((s) => ({
                    value: s.icon,
                    why: s.why,
                    icon: previewIcon(icon, workspace, s.icon),
                    label:
                      s.icon === workspace.icon_logo?.path
                        ? txt.repoLogo
                        : isImageCandidate(s.icon)
                          ? imageSuggestionReason(s.icon)
                          : undefined,
                  }))
                : state.status === "failed"
                  ? localSuggestions(icon, workspace)
                  : undefined,
              reply: round?.reply,
              wishing: !!state.wish,
              startedAt: state.startedAt,
              round: { at: state.at, count: state.rounds.length },
              seen: seenText(state.seen),
              model: round?.model,
            };
          })()}
          onAccept={acceptIcon}
          onAsk={suggestions.ask}
          onRound={suggestions.move}
          onOpenSettings={() => navigate(settingsHref("tekoaly"))}
          csrf={csrf}
          speech={speech}
          onDismiss={() => {
            setSuggestDismissed(true);
            setSuggestAgain(false);
          }}
        />
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
              {txt.close}
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
          {txt.recheckCreation}
        </ControlButton>
      ) : null}
      {defaultUnavailable && onRefreshDefault ? (
        <ControlButton size="row" variant="quiet" onPress={onRefreshDefault}>
          {txt.refreshDefault}
        </ControlButton>
      ) : null}
      {defaultRefused && onNewChoice ? (
        <Dialog
          data-testid="model-picker-open"
          triggerLabel={txt.chooseModel}
          title={txt.modelTitle}
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
            {txt.startWithModel}
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
        />
      ) : null}
      <div className="ah-workspace-git">
        {gitControl}
        <span className="ah-workspace-summary">{summaryText}</span>
      </div>
      {csrf && workspace.kind === "git_main_worktree" ? (
        <WorktreeCleanup
          csrf={csrf}
          workspaceId={workspace.workspace_id}
          hideWhenEmpty
          onChanged={refresh}
          conversation={ownerConversation}
          onOpenConversation={(c) => {
            if (!c.archived) navigate(c.href);
            else if (onRestoreConversation)
              void onRestoreConversation(c.id).then((ok) => {
                if (ok) navigate(c.href);
              });
          }}
        />
      ) : null}
      <section
        data-testid="open-conversations"
        aria-label={txt.openConversations}
      >
        <h2>
          {txt.open} <span>{section.open.length}</span>
        </h2>
        {section.open.length ? (
          <HomeConversationGrid
            conversations={section.open}
            archiveAction={archiveAction}
            archiveReason={archiveReason}
          />
        ) : (
          <p data-testid="workspace-conversations-empty">{txt.empty}</p>
        )}
      </section>
      <details className="ah-workspace-done">
        <summary>{txt.done(done.length)}</summary>
        <ul>
          {done.map((c) => (
            <li key={c.id}>
              <LinkRow href={c.href}>{c.title}</LinkRow>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** Where the strip's Kuvake says the icon comes from. */
function iconFrom(workspace: Workspace, shown: WorkspaceIconModel): IconFrom {
  if (shown.show.kind === "emoji") return "emoji";
  if (shown.show.kind === "image") return "logo";
  return workspace.icon?.source === "config" &&
    workspace.icon.kind === "letters" &&
    !workspace.icon_auto
    ? "letters"
    : "derived";
}

/** What the model was shown, in the words the row's footer uses. */
function seenText(seen: IconSeen | undefined) {
  if (!seen) return txt.seenAll;
  const languages = seen.languages
    ?.map((l) => txt.languagePercent(l.name, l.percent))
    .join(", ");
  return [
    txt.seenName,
    seen.readme ? txt.seenReadme : "",
    seen.start_page ? txt.seenStart : "",
    languages ? txt.seenLanguages(languages) : "",
    seen.logo ? txt.seenLogo : "",
  ]
    .filter(Boolean)
    .join(", ");
}
