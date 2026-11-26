import { createContext, type MouseEvent, useContext } from "react";
import { useNavigate } from "react-router";
import { useText } from "../i18n";
import { agentMessageText } from "../text/agentMessage";
import { MessageTime } from "./ConversationTimes";
import { messageClock } from "./conversationTimes";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";
import { SharedViewer } from "./Multiplayer";
import { quotePlain } from "./ReplyQuote";
import "./AgentMessage.css";

// Agent messages between the person's conversations (agent-agent-messages,
// experimental; round 2026-11-25-agent-agent-message-4: incoming A Kirjeet,
// outgoing A Peili, copy B Hiljainen). A block says only who it is from or
// to, with a link to the same message in the other conversation, the time
// and the message; a quote is one line, only when the agent quoted. What
// it says comes from the daemon's typed history facts: the incoming block
// from the <agent-message> block the daemon wrote, the outgoing one from
// the CLI's typed result. Nothing here reads a command line or decides who
// wrote what.

/** history.schema.json#/$defs/agentQuote */
export type AgentQuoteFact = {
  message_id: string;
  from_agent_id?: string | null;
  excerpt: string;
};
/** history.schema.json#/$defs/agentMessage: a message another agent of the
 * person sent here. */
export type AgentMessageFact = {
  message_id: string;
  from_agent_id?: string | null;
  title?: string;
  workspace_id?: string;
  quote?: AgentQuoteFact;
};
/** history.schema.json#/$defs/sentAgentMessage: a message this
 * conversation's agent sent. */
export type SentAgentMessageFact = {
  message_id: string;
  to?: string;
  title?: string;
  workspace_id?: string;
  delivery: "send" | "steer" | "follow-up";
  state: "pending" | "held";
  text: string;
  text_truncated?: boolean;
  quote?: AgentQuoteFact;
};

/** What the app knows of the person's other conversations and how a quote
 * finds its original. Absent outside a live conversation: names then come
 * from the facts, and a quote does not jump. */
export type AgentMessageControl = {
  /** The conversation's current rail row, when it still exists. */
  peer: (agentId: string) => { title: string; workspaceId: string } | undefined;
  onJump: (messageId: string) => void;
};
export const AgentMessageContext = createContext<
  AgentMessageControl | undefined
>(undefined);

/** The quoted message, when it is in this conversation: sent by this
 * agent (self) or received from peerId, saved at `at`. */
export type QuotedMessage = {
  self?: boolean;
  peerId?: string | null;
  title?: string;
  at?: number;
};

export function AgentLetter({
  direction,
  messageId,
  peerId,
  peerTitle,
  peerWorkspace,
  at,
  text,
  truncated = false,
  quote,
  quoted,
  hideQuote = false,
  plain = false,
}: {
  /** The name without its link (agent-agent-messages off). */
  plain?: boolean;
  /** in: another conversation sent it here; out: this agent sent it. */
  direction: "in" | "out";
  messageId: string;
  /** The other conversation; null for an agent outside the person's
   * conversations, undefined when the participant's read leaves it out. */
  peerId?: string | null;
  peerTitle?: string;
  peerWorkspace?: string;
  at?: number;
  text: string;
  truncated?: boolean;
  quote?: AgentQuoteFact;
  quoted?: QuotedMessage;
  /** The quoted message is directly above this block. */
  hideQuote?: boolean;
}) {
  const t = useText(agentMessageText);
  const control = useContext(AgentMessageContext);
  const shared = useContext(SharedViewer);
  const navigate = useNavigate();
  const incoming = direction === "in";
  const row = peerId && !shared ? control?.peer(peerId) : undefined;
  const name = shared
    ? t.ownersOther
    : peerId === null
      ? t.outside
      : (row?.title ?? peerTitle ?? t.ownersOther);
  const workspace = row?.workspaceId ?? peerWorkspace;
  const href =
    !plain && !shared && peerId && workspace
      ? `/workspaces/${workspace}?conversation=${peerId}&message=${messageId}`
      : undefined;
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      !href ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    navigate(href);
  };
  const who = !quoted
    ? undefined
    : quoted.self
      ? t.thisAgent
      : shared
        ? t.ownersOther
        : quoted.peerId === null
          ? t.outside
          : ((quoted.peerId
              ? control?.peer(quoted.peerId)?.title
              : undefined) ?? quoted.title);
  const quoteLabel = t.quote(
    who,
    quoted?.at === undefined ? undefined : messageClock(quoted.at),
  );
  const quoteBody = quote ? (
    <>
      <Icon name="reply" />
      <span className="ah-agent-quote-text">{quotePlain(quote.excerpt)}</span>
    </>
  ) : null;
  return (
    <article
      className={`ah-message ah-agent-letter ah-agent-letter-${direction}`}
      data-testid={incoming ? "agent-letter" : "agent-letter-out"}
      data-agent-message={messageId}
      aria-label={incoming ? t.from(name) : t.to(name)}
    >
      <header>
        <strong className="ah-agent-letter-from">
          <Icon name={incoming ? "agent" : "arrowUp"} />
          {href ? (
            <a href={href} onClick={open} data-testid="agent-letter-peer">
              {name}
            </a>
          ) : (
            <span data-testid="agent-letter-peer">{name}</span>
          )}
        </strong>
        {at !== undefined ? <MessageTime at={at} /> : null}
      </header>
      <div className="ah-prose">
        {quote && !hideQuote ? (
          control ? (
            <button
              type="button"
              className="ah-agent-quote"
              data-testid="agent-letter-quote"
              data-quote={quote.message_id}
              aria-label={quoteLabel}
              onClick={() => control.onJump(quote.message_id)}
            >
              {quoteBody}
            </button>
          ) : (
            <div
              className="ah-agent-quote"
              data-testid="agent-letter-quote"
              data-quote={quote.message_id}
              role="note"
              aria-label={quoteLabel}
            >
              {quoteBody}
            </div>
          )
        ) : null}
        <Markdown text={truncated ? `${text} …` : text} />
      </div>
    </article>
  );
}
