import { useEffect, useId, useRef, useState } from "react";
import {
  type ConversationStore,
  useConversationMetadata,
} from "../app/conversationStore";
import type { RecapRead } from "../app/conversations";
import { currentRecap, readRecap } from "../app/conversations";
import type { Workspace } from "../app/snapshot";
import { liveText } from "../i18n";
import { homeWorkspacesText } from "../text/homeWorkspaces";
import { agentPresentation, waitedFor, waitingName } from "./agentPresentation";
import { ControlButton, LinkRow } from "./ControlElements";
import { Icon } from "./Icon";
import { LatestMessageAge, useMinuteNow } from "./RecapCard";
import type { ReturnConversation } from "./ReturnView";
import { StatusMark } from "./Status";
import { WorkspaceActions } from "./WorkspaceActions";
import "./HomeWorkspaces.css";

const txt = liveText(homeWorkspacesText);

export type HomeConversation = ReturnConversation & {
  workspaceId: string;
  revision?: string;
};
export type HomeSection = {
  workspace: Workspace;
  open: HomeConversation[];
  done: number;
};
export function homeSections(
  workspaces: Workspace[],
  conversations: HomeConversation[],
): HomeSection[] {
  return workspaces
    .map((workspace) => {
      const all = conversations.filter(
        (c) => c.workspaceId === workspace.workspace_id,
      );
      const open = all.filter(
        (c) => c.process !== "confirmed_exited" || c.attention === "new",
      );
      open.sort((a, b) => rank(a) - rank(b));
      return { workspace, open, done: all.length - open.length };
    })
    .sort((a, b) => score(b.open) - score(a.open));
}
function rank(c: HomeConversation): number {
  if (c.attention === "new") return 0;
  const activity = agentPresentation(c).activity;
  return activity === "working"
    ? 1
    : activity === "waiting_background"
      ? 2
      : activity === "waiting"
        ? 3
        : 4;
}
function score(items: HomeConversation[]) {
  return items.reduce((sum, c) => sum + [100, 10, 2, 1, 0][rank(c)], 0);
}

export function HomeCard({
  conversation,
  onArchive,
  archiveReason,
  archiveError,
}: {
  conversation: HomeConversation;
  onArchive?: () => void;
  archiveReason?: string;
  archiveError: boolean;
}) {
  const [state, setState] = useState<RecapRead>();
  const now = useMinuteNow();
  const [error, setError] = useState(false);
  const archiveReasonId = useId();
  // Pi has written nothing yet: there is no recap to read and no state to
  // guess, only an empty conversation.
  const unwritten = conversation.history === "missing";
  useEffect(() => {
    let active = true;
    // A native JSONL append changes the revision even when the ID is stable.
    void conversation.revision;
    setError(false);
    if (unwritten) return;
    void readRecap(conversation.id)
      .then((value) => {
        if (active) setState(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [conversation.id, conversation.revision, unwritten]);
  const activity = agentPresentation(conversation).activity;
  // An outdated recap is not shown as the current situation; the daemon
  // writes a new one once the conversation has been idle.
  const recap = state
    ? currentRecap(state.recap, state.latest_message, activity === "working")
    : null;
  const label =
    conversation.attention === "new"
      ? txt.readReply
      : activity === "waiting"
        ? txt.reply
        : txt.open;
  return (
    <article
      data-testid={`conversation-card-${conversation.id}`}
      data-agent-id={conversation.id}
      className={`ah-home-card ah-home-card-${activity}${conversation.attention === "new" ? " ah-home-card-new" : ""}${conversation.pendingLabel ? " ah-pending-item" : ""}`}
      aria-busy={conversation.pendingLabel ? true : undefined}
    >
      <div className="ah-home-card-head">
        <LinkRow
          data-agent-id={conversation.id}
          data-testid={`home-conversation-${conversation.id}`}
          href={conversation.href}
          kind="inline"
        >
          <span
            aria-hidden="true"
            className={`ah-home-dot ah-home-${rank(conversation)} ah-home-dot-${activity}`}
          />
          <span className="ah-home-card-title">{conversation.title}</span>
        </LinkRow>
        <div className="ah-home-card-meta">
          <span>
            {conversation.pendingLabel ??
              (conversation.attention === "new"
                ? txt.newReply
                : unwritten && activity === "unknown"
                  ? txt.noMessages
                  : agentPresentation(conversation).activityLabel)}
          </span>
          {!conversation.browserSession && (
            <StatusMark
              data-testid="card-read-only"
              label={txt.readOnly}
              kind="read-only"
            />
          )}
          {recap && (
            <LatestMessageAge at={state?.latest_message_at} now={now} />
          )}
        </div>
        <span className="ah-home-archive-slot">
          <ControlButton
            title={archiveReason || txt.archive}
            data-testid="archive-conversation"
            className="ah-home-archive"
            variant="quiet"
            size="inline"
            aria-label={txt.archive}
            aria-describedby={archiveReason ? archiveReasonId : undefined}
            isDisabled={!onArchive || !!archiveReason}
            onPress={onArchive}
          >
            <Icon name="archive" />
          </ControlButton>
          {archiveReason ? (
            <span id={archiveReasonId} className="ah-visually-hidden">
              {archiveReason}
            </span>
          ) : null}
        </span>
      </div>
      {conversation.worktree ? (
        <WorktreeCardLine worktree={conversation.worktree} />
      ) : null}
      {activity === "waiting_background" ? (
        <p className="ah-home-live">
          {txt.waitingBackground}
          {conversation.waitingOn?.some(waitedFor)
            ? txt.waitingOn(
                conversation.waitingOn
                  .filter(waitedFor)
                  .map(waitingName)
                  .join(", "),
              )
            : ""}
        </p>
      ) : null}
      {activity === "working" && (
        <p className="ah-home-live">
          {txt.working}
          {conversation.liveActivity === "tool.started"
            ? txt.usingTool
            : conversation.liveActivity === "assistant.delta"
              ? txt.writing
              : ""}
        </p>
      )}
      {recap ? (
        <>
          <p className="ah-home-recap">{recap.recap}</p>
          <p className="ah-home-next">
            <strong>{txt.next}</strong>
            <span>{recap.next}</span>
          </p>
        </>
      ) : error ? (
        <p>{txt.recapUnreadable}</p>
      ) : state && conversation.attention === "new" ? (
        <p className="ah-home-pending">{txt.recapSoon}</p>
      ) : null}
      {archiveError && (
        <p className="ah-inline-error" role="alert">
          {txt.archiveFailed}
        </p>
      )}
      {(recap || !state || error || conversation.attention !== "new") && (
        <LinkRow
          data-testid="open-conversation"
          className="ah-home-open"
          href={conversation.href}
        >
          {label} →
        </LinkRow>
      )}
    </article>
  );
}
function GitLine({ workspace }: { workspace: Workspace }) {
  return (
    <span className="ah-home-git">
      {workspace.git_summary ? (
        <>
          ⑂ {workspace.git_summary.branch}
          {workspace.git_summary.dirty_count > 0 &&
            ` +${workspace.git_summary.dirty_count}`}
        </>
      ) : (
        txt.gitUnknown
      )}
    </span>
  );
}
/** Keep feedback in the owning page even while optimistic archive hides its last card. */
export function useCardArchiveAction(
  onArchive?: (id: string) => Promise<boolean>,
) {
  const [errorId, setErrorId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const archive = useRef(onArchive);
  archive.current = onArchive;
  return {
    errorId,
    pendingId,
    run: onArchive
      ? (id: string) => {
          setErrorId(null);
          setPendingId(id);
          const action = archive.current;
          if (!action) {
            setPendingId(null);
            return;
          }
          void action(id).then((ok) => {
            setPendingId(null);
            if (!ok) setErrorId(id);
          });
        }
      : undefined,
  };
}
/** The worktree agent's branch against its base, as Git says it now. */
function WorktreeCardLine({
  worktree,
}: {
  worktree: NonNullable<HomeConversation["worktree"]>;
}) {
  const facts = [
    worktree.merged && worktree.base ? txt.merged(worktree.base) : "",
    !worktree.merged && worktree.ahead !== undefined
      ? txt.ahead(worktree.ahead)
      : "",
    !worktree.merged && worktree.behind ? txt.behind(worktree.behind) : "",
    worktree.dirty ? txt.changes(worktree.dirty) : "",
  ].filter(Boolean);
  return (
    <p className={`ah-home-card-worktree${worktree.merged ? " merged" : ""}`}>
      <span className="ah-visually-hidden">{txt.worktreeBranch}</span>
      <Icon name={worktree.merged ? "merge" : "worktree"} aria-hidden="true" />
      <code>{worktree.branch ?? "worktree"}</code>
      {worktree.base ? (
        <>
          <span aria-hidden="true">→</span>
          <code>{worktree.base}</code>
        </>
      ) : null}
      {facts.length ? <span>{facts.join(" · ")}</span> : null}
    </p>
  );
}

export function HomeConversationGrid({
  conversations,
  archiveAction,
  archiveReason,
}: {
  conversations: HomeConversation[];
  archiveAction: ReturnType<typeof useCardArchiveAction>;
  archiveReason?: (conversation: HomeConversation) => string;
}) {
  return (
    <div className="ah-home-grid">
      {conversations.map((c) => (
        <HomeCard
          key={c.id}
          conversation={c}
          archiveError={archiveAction.errorId === c.id}
          archiveReason={
            archiveAction.pendingId === c.id
              ? txt.archiving
              : (archiveReason?.(c) ??
                (archiveAction.run ? "" : txt.archiveUnavailable))
          }
          onArchive={
            archiveAction.run ? () => archiveAction.run?.(c.id) : undefined
          }
        />
      ))}
    </div>
  );
}

export function HomeWorkspaces({
  workspaces,
  conversations,
  store,
  onNew,
  newReason,
  onCreate,
  onArchive,
  archiveReason,
}: {
  workspaces: Workspace[];
  conversations: HomeConversation[];
  store?: ConversationStore;
  onNew?: (id: string) => void;
  newReason?: (id: string) => string;
  onCreate?: () => void;
  onArchive?: (id: string) => Promise<boolean>;
  archiveReason?: (conversation: HomeConversation) => string;
}) {
  const archiveAction = useCardArchiveAction(onArchive);
  const metadata = useConversationMetadata(store);
  conversations = conversations.map((c) => ({
    ...c,
    command: metadata.staleStatuses.has(c.id)
      ? c.command
      : (metadata.statuses.get(c.id)?.state ?? c.command),
    runActive: metadata.staleStatuses.has(c.id)
      ? c.runActive
      : (metadata.statuses.get(c.id)?.run_active ?? c.runActive),
    pendingQuestion:
      !metadata.staleStatuses.has(c.id) &&
      (!!metadata.statuses.get(c.id)?.pending_question || !!c.pendingQuestion),
    attention: metadata.attention.get(c.id) ?? c.attention,
  }));
  const sections = homeSections(workspaces, conversations);
  const waiting = conversations.filter(
    (c) => c.attention === "new" || agentPresentation(c).activity === "waiting",
  ).length;
  const working = conversations.filter(
    (c) => agentPresentation(c).activity === "working",
  ).length;
  const background = conversations.filter(
    (c) => agentPresentation(c).activity === "waiting_background",
  ).length;
  return (
    <div className="ah-home">
      <header className="ah-home-head">
        <div>
          <h1 data-testid="workspaces-title">{txt.title}</h1>
          <p>
            {txt.summary(workspaces.length, waiting, working)}
            {background ? txt.summaryBackground(background) : ""}
          </p>
        </div>
        <ControlButton
          data-testid="workspace-create"
          size="row"
          type="button"
          variant="primary"
          className="ah-home-primary"
          onClick={onCreate}
          isDisabled={!onCreate}
        >
          {txt.newWorkspace}
        </ControlButton>
      </header>
      {sections
        .filter((s) => s.open.length)
        .map(({ workspace, open, done }) => (
          <section
            className="ah-home-section"
            key={workspace.workspace_id}
            aria-label={workspace.display_name ?? workspace.name}
          >
            <header className="ah-home-workspace-head">
              <LinkRow
                data-testid={`workspace-${workspace.display_name ?? workspace.name}`}
                href={`/workspaces/${workspace.workspace_id}`}
                className="ah-home-name"
              >
                {workspace.display_name ?? workspace.name}
              </LinkRow>
              <GitLine workspace={workspace} />
              <span className="ah-home-grow" />
              {done > 0 && <span>{txt.done(done)}</span>}
              <WorkspaceActions
                workspace={workspace}
                newReason={newReason?.(workspace.workspace_id)}
                onNew={onNew}
              />
            </header>
            <HomeConversationGrid
              conversations={open}
              archiveAction={archiveAction}
              archiveReason={archiveReason}
            />
          </section>
        ))}
      {sections.some((s) => !s.open.length) && (
        <section data-testid="empty-workspaces" aria-label={txt.noOpenWork}>
          <h2>{txt.noOpenWork}</h2>
          <div className="ah-home-quiet">
            {sections
              .filter((s) => !s.open.length)
              .map(({ workspace, done }) => (
                <div className="ah-home-row" key={workspace.workspace_id}>
                  <LinkRow
                    data-testid={`workspace-${workspace.display_name ?? workspace.name}`}
                    className="ah-home-name"
                    href={`/workspaces/${workspace.workspace_id}`}
                  >
                    {workspace.display_name ?? workspace.name}
                  </LinkRow>
                  <GitLine workspace={workspace} />
                  <span className="ah-home-grow" />
                  {done ? txt.done(done) : txt.noConversations}
                  <WorkspaceActions
                    workspace={workspace}
                    newReason={newReason?.(workspace.workspace_id)}
                    onNew={onNew}
                  />
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
