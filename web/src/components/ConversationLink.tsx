import { useState } from "react";
import { useText } from "../i18n";
import { conversationLinkText } from "../text/conversationLink";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";
import { WarningBanner } from "./WarningBanner";
import "./ReplyQuote.css";
import "./ConversationLink.css";

/**
 * Conversation links (round 2026-11-27-keskustelulinkit-3). The person
 * pressed the link themself, so the field's mark says only the two things
 * the press does not tell: the text is not theirs, and nothing has gone yet.
 * It uses the reply quote's shape, as a quote is text from elsewhere too.
 */
export function LinkMark({ onRemove }: { onRemove: () => void }) {
  const t = useText(conversationLinkText);
  return (
    // biome-ignore lint/a11y/useSemanticElements: a labelled row with one control, as the reply quote.
    <div
      className="ah-reply-quote ah-link-mark"
      role="group"
      aria-label={t.markGroup}
      data-testid="link-mark"
    >
      <div className="ah-reply-quote-head">
        <Icon name="link" />
        <span>{t.mark}</span>
        <span className="ah-reply-quote-tools">
          <ControlButton
            data-testid="link-remove"
            aria-label={t.remove}
            variant="quiet"
            size="row"
            presentation="messageIcon"
            onPress={onRemove}
          >
            <Icon name="cross" />
          </ControlButton>
        </span>
      </div>
    </div>
  );
}

/** The link's message waits here when the new conversation's field already
 * held the person's own unsent text: it never overwrites it. */
export function LinkCard({
  text,
  onAppend,
  onReplace,
  onDismiss,
}: {
  text: string;
  onAppend: () => void;
  onReplace: () => void;
  onDismiss: () => void;
}) {
  const t = useText(conversationLinkText);
  return (
    <section
      className="ah-reply-quote ah-link-card"
      aria-label={t.markGroup}
      data-testid="link-card"
    >
      <div className="ah-reply-quote-head">
        <Icon name="link" />
        <span>{t.cardHead}</span>
      </div>
      <blockquote className="ah-link-text" data-testid="link-card-text">
        <Markdown text={text} breaks />
      </blockquote>
      <div className="ah-link-actions">
        <ControlButton
          data-testid="link-append"
          size="row"
          variant="secondary"
          onPress={onAppend}
        >
          {t.append}
        </ControlButton>
        <ControlButton
          data-testid="link-replace"
          size="row"
          variant="quiet"
          onPress={onReplace}
        >
          {t.replace}
        </ControlButton>
        <ControlButton
          data-testid="link-dismiss"
          size="row"
          variant="quiet"
          onPress={onDismiss}
        >
          {t.dismiss}
        </ControlButton>
      </div>
    </section>
  );
}

/** Links are not allowed: the field stayed empty and nothing of the
 * message is shown. Avaa asetus opens Settings on the row. */
export function LinkHeldNotice({
  workspace,
  onOpenSetting,
}: {
  workspace: string;
  onOpenSetting: () => void;
}) {
  const t = useText(conversationLinkText);
  return (
    <WarningBanner
      data-testid="link-held"
      subject="link-held"
      tone="neutral"
      title={t.offTitle}
      actions={
        <ControlButton
          data-testid="link-open-setting"
          size="row"
          variant="secondary"
          onPress={onOpenSetting}
        >
          {t.openSetting}
        </ControlButton>
      }
    >
      {t.offBody(<code>{workspace}</code>)}
    </WarningBanner>
  );
}

export function LinkHiddenNotice({
  workspace,
  onRestore,
}: {
  workspace: string;
  onRestore?: () => void;
}) {
  const t = useText(conversationLinkText);
  return (
    <WarningBanner
      data-testid="link-hidden-workspace"
      subject="link-hidden-workspace"
      tone="neutral"
      title={t.hiddenTitle}
      actions={
        onRestore ? (
          <ControlButton
            data-testid="link-restore-workspace"
            size="row"
            variant="secondary"
            onPress={onRestore}
          >
            {t.restore}
          </ControlButton>
        ) : undefined
      }
    >
      {t.hiddenBody(<code>{workspace}</code>)}
    </WarningBanner>
  );
}

export function LinkDroppedNotice({
  reason,
  length,
  limit,
}: {
  reason: "long" | "cut";
  length?: number;
  limit: number;
}) {
  const t = useText(conversationLinkText);
  return (
    <WarningBanner
      data-testid="link-dropped"
      data-reason={reason}
      subject="link-dropped"
      tone="neutral"
      title={t.droppedTitle}
    >
      {reason === "long" && length
        ? t.droppedLong(length, limit)
        : t.droppedCut}
    </WarningBanner>
  );
}

/** The link names a workspace the person does not have. The message (only
 * when links are allowed) stays here to copy, and each other workspace
 * starts the same link there. */
export function LinkMissingWorkspace({
  workspace,
  text,
  others,
  onStart,
}: {
  workspace: string;
  text?: string;
  others: { id: string; name: string }[];
  onStart: (name: string) => void;
}) {
  const t = useText(conversationLinkText);
  const [copy, setCopy] = useState<"copied" | "failed">();
  return (
    <section
      className="ah-link-missing"
      data-testid="link-missing-workspace"
      aria-labelledby="ah-link-missing-title"
    >
      <h1 id="ah-link-missing-title" tabIndex={-1}>
        {t.missingTitle}
      </h1>
      <p>{t.missingBody(<code>{workspace}</code>, !!text)}</p>
      {text ? (
        <section
          className="ah-reply-quote ah-link-card"
          aria-label={t.markGroup}
        >
          <div className="ah-reply-quote-head">
            <Icon name="link" />
            <span>{t.markGroup}</span>
          </div>
          <blockquote className="ah-link-text" data-testid="link-missing-text">
            <Markdown text={text} breaks />
          </blockquote>
          <div className="ah-link-actions">
            <ControlButton
              data-testid="link-missing-copy"
              size="row"
              variant="quiet"
              isDisabled={!navigator.clipboard}
              onPress={() =>
                void navigator.clipboard.writeText(text).then(
                  () => setCopy("copied"),
                  () => setCopy("failed"),
                )
              }
            >
              <Icon name={copy === "copied" ? "check" : "copy"} />
              {t.copy}
            </ControlButton>
            {copy ? (
              <span role="status" className="ah-link-copied">
                {copy === "copied" ? t.copied : t.notCopied}
              </span>
            ) : null}
          </div>
        </section>
      ) : null}
      <h2>{text ? t.otherWithMessage : t.other}</h2>
      {others.length ? (
        <ul className="ah-link-workspaces">
          {others.map((w) => (
            <li key={w.id}>
              <ControlButton
                data-testid="link-missing-workspace-start"
                data-workspace={w.name}
                size="row"
                variant="secondary"
                onPress={() => onStart(w.name)}
              >
                <Icon name="folder" />
                <code>{w.name}</code>
              </ControlButton>
            </li>
          ))}
        </ul>
      ) : (
        <p>{t.noOther}</p>
      )}
    </section>
  );
}

/** On the sign-in page of a link's address: where the person continues. */
export function LinkSignInNotice({ workspace }: { workspace: string }) {
  const t = useText(conversationLinkText);
  return (
    <WarningBanner
      tone="neutral"
      data-testid="link-sign-in"
      title={t.signInTitle}
    >
      {t.signInBody(<code>{workspace}</code>)}
    </WarningBanner>
  );
}
