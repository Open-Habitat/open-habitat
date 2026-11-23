import { createContext, useContext } from "react";
import { liveText } from "../i18n";
import { replyQuoteText } from "../text/replyQuote";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import "./ReplyQuote.css";

const txt = liveText(replyQuoteText);

/**
 * Replying to one agent message (reply-to-message, experimental; round
 * 2026-11-23-reply-to-message-3: corner control A, quote A). The app
 * provides what a press does; `onReply` is absent while the person's switch
 * is off, so no corner control is drawn, but a sent reply's quote still
 * leads to its original.
 */
export type ReplyControl = {
  /** The agent message the field's quote answers now. */
  active?: string;
  onReply?: (entryKey: string) => void;
  onJump: (entryKey: string) => void;
};
export const ReplyContext = createContext<ReplyControl | undefined>(undefined);

/** Markdown read as plain text for the two-line quote: markers dropped,
 * one paragraph. */
export function quotePlain(markdown: string): string {
  return markdown
    .replace(/^\s*(?:`{3,}|~{3,})\S*\s*$/gm, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, "")
    .replace(/\s*\n+\s*/g, " ")
    .trim();
}

/** The corner control, Kopioi's pair in the message's actions slot. */
export function ReplyCornerButton({
  entryKey,
  time,
}: {
  entryKey: string;
  time?: string;
}) {
  const reply = useContext(ReplyContext);
  if (!reply?.onReply) return null;
  const onReply = reply.onReply;
  return (
    <ControlButton
      data-testid="message-reply"
      data-entry-key={entryKey}
      className="ah-reply-corner"
      aria-label={txt.reply(time)}
      aria-pressed={reply.active === entryKey}
      variant="quiet"
      size="row"
      presentation="messageIcon"
      onPress={() => onReply(entryKey)}
    >
      <Icon name="reply" />
    </ControlButton>
  );
}

/** The quote as the field box's first row: two lines of the excerpt the
 * agent will receive. Tapping it shows the original; ✕ removes it. */
export function ComposerQuote({
  excerpt,
  time,
  onJump,
  onRemove,
}: {
  excerpt: string;
  time?: string;
  onJump: () => void;
  onRemove: () => void;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a group of the quote's two controls, not a form fieldset.
    <div
      className="ah-reply-quote"
      data-testid="composer-quote"
      role="group"
      aria-label={txt.replying}
    >
      <div className="ah-reply-quote-head">
        <Icon name="reply" />
        <span>{txt.replying}</span>
        {time ? <time>{time}</time> : null}
        <span className="ah-reply-quote-tools">
          <ControlButton
            data-testid="quote-remove"
            aria-label={txt.remove}
            variant="quiet"
            size="row"
            presentation="messageIcon"
            onPress={onRemove}
          >
            <Icon name="cross" />
          </ControlButton>
        </span>
      </div>
      <button
        type="button"
        className="ah-reply-jump"
        data-testid="quote-jump"
        aria-label={txt.jump(time)}
        onClick={onJump}
      >
        <span className="ah-reply-body">{quotePlain(excerpt)}</span>
      </button>
    </div>
  );
}

/** The quote on the person's sent reply: the excerpt the agent received. */
export function SentQuote({
  entryKey,
  excerpt,
}: {
  entryKey: string;
  excerpt: string;
}) {
  const reply = useContext(ReplyContext);
  const body = (
    <>
      <span className="ah-reply-quote-head">
        <Icon name="reply" />
        <span>{txt.repliedTo}</span>
      </span>
      <span className="ah-reply-body">{quotePlain(excerpt)}</span>
    </>
  );
  return reply ? (
    <button
      type="button"
      className="ah-reply-sent"
      data-testid="sent-quote"
      data-entry-key={entryKey}
      aria-label={txt.jump()}
      onClick={() => reply.onJump(entryKey)}
    >
      {body}
    </button>
  ) : (
    <div className="ah-reply-sent" data-testid="sent-quote">
      {body}
    </div>
  );
}
