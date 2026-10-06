import {
  type ConversationStore,
  useConversationMetadata,
} from "../app/conversationStore";
import { agentPresentation } from "./agentPresentation";
import { LinkRow } from "./ControlElements";
import { Icon } from "./Icon";
import { ListRow } from "./Primitives";
import { StatusMark } from "./Status";

export interface ReturnConversation {
  id: string;
  href: string;
  title: string;
  workspace: string;
  browserSession: boolean;
  /** Only positively observed native process states may show a running mark. */
  process: string;
  command?: string;
  attention?: "new" | "seen";
  pendingQuestion?: boolean;
  history?: "readable" | "missing" | "corrupt" | "unavailable";
}

function presentation(conversation: ReturnConversation) {
  return agentPresentation({
    process: conversation.process,
    command: conversation.command,
    attention: conversation.attention,
    pendingQuestion: conversation.pendingQuestion,
  });
}

function ConversationGroup({
  title,
  conversations,
  featured = false,
}: {
  title: string;
  conversations: ReturnConversation[];
  featured?: boolean;
}) {
  return (
    <section
      className={`ah-return-group${featured ? " ah-return-featured" : ""}`}
      aria-label={title}
    >
      <h2>{title}</h2>
      <ul className="ah-continue-list">
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <LinkRow href={conversation.href} kind="return">
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
                            ? "Käynnissä terminaalissa"
                            : "Prosessi käynnissä"
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
                            : "unknown"
                      }
                    />
                    {conversation.history &&
                    conversation.history !== "readable" ? (
                      <StatusMark
                        label={
                          conversation.history === "unavailable"
                            ? "Historiaa ei voitu tarkistaa"
                            : "Historia ei luettavissa"
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
                      <StatusMark label="Uusi" tone="warning" />
                    ) : null}
                    {!conversation.browserSession ? (
                      <StatusMark label="Vain luku" kind="read-only" />
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
  const decorated = conversations.map((conversation) => ({
    ...conversation,
    command: metadata.staleStatuses.has(conversation.id)
      ? undefined
      : (metadata.statuses.get(conversation.id)?.state ?? conversation.command),
    pendingQuestion:
      !metadata.staleStatuses.has(conversation.id) &&
      (!!metadata.statuses.get(conversation.id)?.pending_question ||
        conversation.pendingQuestion),
    attention:
      metadata.attention.get(conversation.id) ?? conversation.attention,
  }));
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
      presentation(conversation).activity === "waiting",
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
          <h1 id="continue-heading">Jatka siitä, mihin jäit</h1>
        )}
        {!workspaceName ? (
          <p>
            Selainikkunan sulkeminen ei pysäytä käynnissä olevaa Pi:tä.
            Keskustelun avaaminen näyttää historian käynnistämättä Pi:tä.
            Selainistunnon ohjaus riippuu sen nykyisestä tilasta.
          </p>
        ) : null}
      </header>
      {conversations.length ? (
        <div className="ah-return-groups">
          {attention.length ? (
            <ConversationGroup
              title="Odottaa sinua"
              featured
              conversations={attention}
            />
          ) : null}
          {ongoing.length ? (
            <ConversationGroup
              title="Käynnissä"
              conversations={ongoing}
              featured
            />
          ) : null}
          {recent.length ? (
            <ConversationGroup
              title={workspaceName ? "Keskustelut" : "Muut keskustelut"}
              conversations={recent}
            />
          ) : null}
        </div>
      ) : (
        <p>Keskusteluja ei vielä näy. Valitse työtila vasemmalta.</p>
      )}
    </section>
  );
}
