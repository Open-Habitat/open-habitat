import { Link } from "react-router";
import { Icon } from "./Icon";
import { StatusMark } from "./Status";

export interface ReturnConversation {
  id: string;
  href: string;
  title: string;
  workspace: string;
  browserSession: boolean;
  /** Only positively observed native process states may show a running mark. */
  process: string;
}

function isRunning(conversation: ReturnConversation) {
  return (
    conversation.process === "daemon_managed_live" ||
    conversation.process === "terminal_observed_live"
  );
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
            <Link to={conversation.href}>
              <span
                className="ah-return-indicator"
                aria-hidden="true"
                data-running={isRunning(conversation)}
              />
              <span className="ah-return-content">
                <span className="ah-return-title">{conversation.title}</span>
                <span className="ah-return-meta">
                  <span className="ah-mono">{conversation.workspace}</span>
                  {isRunning(conversation) ? (
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
                  {!conversation.browserSession ? (
                    <span>Vain luettavissa</span>
                  ) : null}
                </span>
              </span>
              <Icon name="forward" className="ah-return-arrow" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReturnView({
  conversations,
}: {
  conversations: ReturnConversation[];
}) {
  const running = conversations.filter(isRunning);
  const others = conversations.filter(
    (conversation) => !isRunning(conversation),
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
          {running.length ? (
            <ConversationGroup title="Käynnissä" conversations={running} />
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
