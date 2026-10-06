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
}: {
  title: string;
  conversations: ReturnConversation[];
}) {
  return (
    <section className="ah-return-group" aria-label={title}>
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
                          : "unknown"
                      }
                    />
                    {presentation(conversation).attentionLabel ? (
                      <StatusMark label="Uusi" tone="warning" />
                    ) : null}
                    {!conversation.browserSession ? (
                      <span>Vain luettavissa</span>
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
}: {
  conversations: ReturnConversation[];
  store?: ConversationStore;
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
  const ordered = [...decorated]
    .sort(
      (a, b) =>
        Number(b.attention === "new") - Number(a.attention === "new") ||
        Number(presentation(b).activity === "working") -
          Number(presentation(a).activity === "working"),
    )
    .slice(0, 3);
  const attention = ordered.filter(
    (conversation) => conversation.attention === "new",
  );
  const remaining = ordered.filter(
    (conversation) => conversation.attention !== "new",
  );
  const running = remaining.filter(
    (conversation) => presentation(conversation).activity === "working",
  );
  const waiting = remaining.filter(
    (conversation) => presentation(conversation).activity === "waiting",
  );
  const others = remaining.filter(
    (conversation) =>
      !["working", "waiting"].includes(presentation(conversation).activity),
  );
  return (
    <section
      className="ah-return-view ah-continue"
      aria-labelledby="continue-heading"
    >
      <header className="ah-return-intro">
        <h1 id="continue-heading">Jatka siitä, mihin jäit</h1>
        <p>
          Selainikkunan sulkeminen ei pysäytä käynnissä olevaa Pi:tä.
          Keskustelun avaaminen näyttää historian käynnistämättä Pi:tä.
          Selainistunnon ohjaus riippuu sen nykyisestä tilasta.
        </p>
      </header>
      {conversations.length ? (
        <div className="ah-return-groups">
          {attention.length ? (
            <ConversationGroup
              title="Tarvitsee huomiota"
              conversations={attention}
            />
          ) : null}
          {running.length ? (
            <ConversationGroup title="Työskentelee" conversations={running} />
          ) : null}
          {waiting.length ? (
            <ConversationGroup title="Odottaa" conversations={waiting} />
          ) : null}
          {others.length ? (
            <ConversationGroup
              title="Muut keskustelut"
              conversations={others}
            />
          ) : null}
        </div>
      ) : (
        <p>Keskusteluja ei vielä näy. Valitse työtila vasemmalta.</p>
      )}
    </section>
  );
}
