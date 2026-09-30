import { Link } from "react-router";
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

export function ReturnView({
  conversations,
}: {
  conversations: ReturnConversation[];
}) {
  return (
    <section
      className="ah-return-view ah-continue"
      aria-labelledby="continue-heading"
    >
      <h2 id="continue-heading">Jatka siitä, mihin jäit</h2>
      <p>Valitse keskustelu jatkaaksesi lukemista.</p>
      {conversations.length ? (
        <ul className="ah-continue-list">
          {conversations.map((conversation) => {
            const running =
              conversation.process === "daemon_managed_live" ||
              conversation.process === "terminal_observed_live";
            return (
              <li key={conversation.id}>
                <Link to={conversation.href}>
                  <span className="ah-return-title">{conversation.title}</span>
                  <span className="ah-return-meta">
                    <span className="ah-mono">{conversation.workspace}</span>
                    {running ? (
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
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>Keskusteluja ei vielä näy. Valitse työtila vasemmalta.</p>
      )}
    </section>
  );
}
