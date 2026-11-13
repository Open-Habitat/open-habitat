import {
  type ConversationStore,
  heldStatus,
  useConversationMetadata,
} from "../app/conversationStore";
import { liveText } from "../i18n";
import { returnViewText } from "../text/returnView";
import { agentPresentation } from "./agentPresentation";
import { LinkRow } from "./ControlElements";
import { Icon } from "./Icon";
import { ListRow } from "./Primitives";
import { StatusMark } from "./Status";

const txt = liveText(returnViewText);

export interface ReturnConversation {
  id: string;
  href: string;
  title: string;
  workspace: string;
  browserSession: boolean;
  /** Only positively observed native process states may show a running mark. */
  process: string;
  command?: string;
  liveActivity?: string;
  attention?: "new" | "seen";
  pendingQuestion?: boolean;
  runActive?: boolean;
  waitingOn?: import("./agentPresentation").WaitingOn[];
  history?: "readable" | "missing" | "corrupt" | "unavailable";
  /** A pending command on it (ADR 0023): shown dimmed and marked, not acted on. */
  pendingLabel?: string;
  /** A worktree agent (ADR 0025) with its worktree's Git facts. */
  worktree?: WorktreeLine;
}
export type WorktreeLine = {
  branch?: string;
  base?: string;
  ahead?: number;
  behind?: number;
  dirty?: number;
  merged: boolean;
};

function presentation(conversation: ReturnConversation) {
  return agentPresentation({
    process: conversation.process,
    runActive: conversation.runActive,
    waitingOn: conversation.waitingOn,
    command: conversation.command,
    attention: conversation.attention,
    pendingQuestion: conversation.pendingQuestion,
  });
}

function ConversationGroup({
  title,
  kind,
  conversations,
  featured = false,
}: {
  title: string;
  kind: string;
  conversations: ReturnConversation[];
  featured?: boolean;
}) {
  return (
    <section
      data-testid={`return-group-${kind}`}
      className={`ah-return-group${featured ? " ah-return-featured" : ""}`}
      aria-label={title}
    >
      <h2>{title}</h2>
      <ul className="ah-continue-list">
        {conversations.map((conversation) => (
          <li
            data-testid="return-conversation"
            data-history={conversation.history}
            key={conversation.id}
          >
            <LinkRow
              data-testid="agent-link"
              href={conversation.href}
              kind="return"
            >
              <ListRow
                indicator={
                  <span
                    className="ah-return-indicator"
                    aria-hidden="true"
                    data-running={presentation(conversation).running}
                  />
                }
                trailing={<Icon name="forward" className="ah-return-arrow" />}
              >
                <span className="ah-return-content">
                  <span className="ah-return-title">{conversation.title}</span>
                  <span className="ah-return-meta">
                    <span className="ah-mono">{conversation.workspace}</span>
                    {presentation(conversation).running ? (
                      <StatusMark
                        label={
                          conversation.process === "terminal_observed_live"
                            ? txt.inTerminal
                            : txt.processRunning
                        }
                        kind="working"
                        tone="info"
                        animated="running"
                      />
                    ) : null}
                    <StatusMark
                      label={presentation(conversation).activityLabel}
                      kind={
                        presentation(conversation).activity === "working"
                          ? "working"
                          : presentation(conversation).activity === "waiting"
                            ? "neutral"
                            : presentation(conversation).activity ===
                                "waiting_background"
                              ? "background"
                              : "unknown"
                      }
                    />
                    {conversation.history &&
                    conversation.history !== "readable" ? (
                      <StatusMark
                        data-testid="history-check-error"
                        label={
                          conversation.history === "unavailable"
                            ? txt.historyUnchecked
                            : txt.historyUnreadable
                        }
                        tone="warning"
                        kind={
                          conversation.history === "unavailable"
                            ? "unknown"
                            : "error"
                        }
                      />
                    ) : null}
                    {presentation(conversation).attentionLabel ? (
                      <StatusMark label={txt.new} tone="warning" />
                    ) : null}
                    {!conversation.browserSession ? (
                      <StatusMark
                        data-testid="read-only-indicator"
                        label={txt.readOnly}
                        kind="read-only"
                      />
                    ) : null}
                  </span>
                </span>
              </ListRow>
            </LinkRow>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReturnView({
  conversations,
  store,
  workspaceName,
}: {
  conversations: ReturnConversation[];
  store?: ConversationStore;
  workspaceName?: string;
}) {
  const metadata = useConversationMetadata(store);
  const decorated = conversations.map((conversation) => {
    // An invalidated status newer than the snapshot is still the newest
    // observation of the turn (heldStatus); an older one is unknown.
    const status = heldStatus(metadata, conversation.id);
    const lost = !status && metadata.staleStatuses.has(conversation.id);
    return {
      ...conversation,
      command: lost ? undefined : (status?.state ?? conversation.command),
      runActive: lost
        ? undefined
        : (status?.run_active ?? conversation.runActive),
      pendingQuestion:
        !lost && (!!status?.pending_question || conversation.pendingQuestion),
      attention:
        metadata.attention.get(conversation.id) ?? conversation.attention,
    };
  });
  // Snapshot order is catalog order, not a last-opened timestamp. Keep it
  // stable rather than inventing recency, and never drop urgent rows for a cap.
  const attention = decorated.filter(
    (conversation) =>
      conversation.attention === "new" ||
      (conversation.pendingQuestion && conversation.attention !== "seen"),
  );
  const remaining = decorated.filter(
    (conversation) => !attention.includes(conversation),
  );
  const ongoing = remaining.filter(
    (conversation) =>
      presentation(conversation).activity === "working" ||
      ["waiting", "waiting_background"].includes(
        presentation(conversation).activity,
      ),
  );
  const recent = remaining.filter(
    (conversation) => !ongoing.includes(conversation),
  );
  return (
    <section
      className="ah-return-view ah-continue"
      aria-labelledby="continue-heading"
    >
      <header className="ah-return-intro">
        {workspaceName ? (
          <h2 id="continue-heading">{workspaceName}</h2>
        ) : (
          <h1 id="continue-heading">{txt.heading}</h1>
        )}
        {!workspaceName ? <p>{txt.intro}</p> : null}
      </header>
      {conversations.length ? (
        <div className="ah-return-groups">
          {attention.length ? (
            <ConversationGroup
              kind="attention"
              title={txt.waitingForYou}
              featured
              conversations={attention}
            />
          ) : null}
          {ongoing.length ? (
            <ConversationGroup
              kind="ongoing"
              title={txt.running}
              conversations={ongoing}
              featured
            />
          ) : null}
          {recent.length ? (
            <ConversationGroup
              kind="recent"
              title={workspaceName ? txt.conversations : txt.otherConversations}
              conversations={recent}
            />
          ) : null}
        </div>
      ) : (
        <p>{workspaceName ? txt.emptyWorkspace : txt.empty}</p>
      )}
    </section>
  );
}
