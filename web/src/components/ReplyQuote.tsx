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

/** What a reply to a view or file offer card answers, as the quote shows
 * it: the offer's kind and title, or one file of several by its path
 * (reply-view-file; history's reply_to.offer). */
export type ReplyOffer = {
  kind: "view" | "file" | "files";
  title: string;
  path?: string;
};

/** The quote's one line of an offer: its title only, or the file's path
 * (Jari 27.11.2026); the head says which kind. */
const offerHead = (o: ReplyOffer) => (o.path ? "file" : o.kind);
const offerTitle = (o: ReplyOffer) => o.path ?? o.title;

/** The corner control of an offer card and of a file row in its list:
 * the same control as on an agent message. */
export function OfferReplyButton({
  title,
  active,
  path,
  onReply,
}: {
  /** The card's title, or the row's file. */
  title: string;
  active: boolean;
  path?: string;
  onReply: () => void;
}) {
  return (
    <ControlButton
      data-testid={path ? "offer-row-reply" : "offer-reply"}
      data-path={path}
      className="ah-reply-corner"
      aria-label={txt.replyOffer(title)}
      title={txt.replyOffer(title)}
      aria-pressed={active}
      variant="quiet"
      size="row"
      presentation="messageIcon"
      onPress={onReply}
    >
      <Icon name="reply" />
    </ControlButton>
  );
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
 * agent will receive, or an offer's title. Tapping it shows the original;
 * ✕ removes it. */
export function ComposerQuote({
  excerpt,
  offer,
  time,
  onJump,
  onRemove,
}: {
  excerpt: string;
  offer?: ReplyOffer;
  time?: string;
  onJump: () => void;
  onRemove: () => void;
}) {
  const head = offer ? txt.replyingOffer(offerHead(offer)) : txt.replying;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a group of the quote's two controls, not a form fieldset.
    <div
      className="ah-reply-quote"
      data-testid="composer-quote"
      data-offer={offer ? offerHead(offer) : undefined}
      role="group"
      aria-label={head}
    >
      <div className="ah-reply-quote-head">
        <Icon name="reply" />
        <span>{head}</span>
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
        aria-label={offer ? txt.jumpOffer(offerTitle(offer)) : txt.jump(time)}
        onClick={onJump}
      >
        <span
          className="ah-reply-body"
          data-offer-title={offer ? "" : undefined}
        >
          {offer ? offerTitle(offer) : quotePlain(excerpt)}
        </span>
      </button>
    </div>
  );
}

/** The quote on the person's sent reply: the excerpt the agent received,
 * or the title of the offer it answered. */
export function SentQuote({
  entryKey,
  excerpt,
  offer,
}: {
  entryKey: string;
  excerpt: string;
  offer?: ReplyOffer;
}) {
  const reply = useContext(ReplyContext);
  const body = (
    <>
      <span className="ah-reply-quote-head">
        <Icon name="reply" />
        <span>
          {offer ? txt.repliedToOffer(offerHead(offer)) : txt.repliedTo}
        </span>
      </span>
      <span className="ah-reply-body" data-offer-title={offer ? "" : undefined}>
        {offer ? offerTitle(offer) : quotePlain(excerpt)}
      </span>
    </>
  );
  return reply ? (
    <button
      type="button"
      className="ah-reply-sent"
      data-testid="sent-quote"
      data-entry-key={entryKey}
      data-offer={offer ? offerHead(offer) : undefined}
      aria-label={offer ? txt.jumpOffer(offerTitle(offer)) : txt.jump()}
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
