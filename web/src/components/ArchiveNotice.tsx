import { type KeyboardEvent, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useText } from "../i18n";
import { archiveNoticeText } from "../text/archiveNotice";
import { ControlButton } from "./ControlElements";
import { Icon, type IconName } from "./Icon";
import { type NoticeKind, returnFocusToWork, useNotice } from "./NoticeArea";

/** How long an untouched notice stays: long enough to read the title and
 * reach the undo, short enough not to linger (Jari found 20 s too long).
 * Hover, focus or a pending action holds it. */
export const NOTICE_LIFETIME_MS = 8_000;

const icons: Record<NoticeKind, IconName> = {
  archive: "archive",
  trash: "trash",
  "workspace-archive": "eyeOff",
  "workspace-icon": "check",
};

/** Transient undo offer; the archive itself remains native host state. A
 * quiet row in the page's top bar (NoticeArea). It never takes focus; Esc
 * closes it only from inside it, because a writer's Esc belongs to the
 * composer. */
export function ArchiveNotice({
  kind = "archive",
  title,
  busy,
  problem,
  onRestore,
  onClose,
  message,
  detail,
  restoreLabel,
  link,
  wrap = false,
}: {
  kind?: NoticeKind;
  /** Long text wraps instead of being cut: a notice that must be read. */
  wrap?: boolean;
  /** Bold after the message; absent when the message says it all. */
  title?: string;
  message?: string;
  detail?: string;
  restoreLabel?: string;
  /** The action is on its way: the notice stays and its undo waits. */
  busy: boolean;
  /** Something did not go as asked: the notice stays until closed. */
  problem?: string;
  /** Absent when there is nothing to undo. */
  onRestore?: () => void;
  onClose: () => void;
  /** Where the thing can be found later. */
  link?: { label: string; onPress: () => void };
}) {
  const t = useText(archiveNoticeText);
  const notice = useNotice(kind, !!onRestore, onClose);
  const row = useRef<HTMLElement>(null);
  const remaining = useRef(NOTICE_LIFETIME_MS);
  const held = notice.paused || notice.folded || busy || !!problem;
  useEffect(() => {
    if (held) return;
    const start = Date.now();
    const timer = window.setTimeout(onClose, remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - start));
    };
  }, [held, onClose]);
  // Closing a notice that holds focus hands focus back to the work.
  const dismiss = () => {
    const hadFocus = !!row.current?.contains(document.activeElement);
    onClose();
    if (hadFocus) requestAnimationFrame(returnFocusToWork);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    dismiss();
  };
  const more = notice.index === 0 && notice.count > 1 ? notice.count - 1 : 0;
  const content = (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Esc from one of the row's own buttons closes it; the actions remain native buttons.
    <section
      ref={row}
      data-testid="archive-notice"
      data-kind={kind}
      className={`ah-archive-notice${wrap ? " ah-archive-notice-wrap" : ""}${problem ? " ah-archive-notice-problem" : ""}`}
      role="status"
      hidden={notice.folded}
      onKeyDown={onKeyDown}
    >
      <span className="ah-archive-notice-icon" aria-hidden="true">
        <Icon name={problem ? "warning" : icons[kind]} />
      </span>
      <span className="ah-archive-notice-text">
        {message ?? t.archived}
        {title ? (
          <>
            {" "}
            <b>{title}</b>
          </>
        ) : null}
        {detail ? <span> · {detail}</span> : null}
        {problem ? (
          <span data-testid="archive-error" className="ah-archive-notice-error">
            {" "}
            · {problem}
          </span>
        ) : null}
      </span>
      {more && notice.setOpen ? (
        <ControlButton
          data-testid="notice-more"
          size="inline"
          variant="quiet"
          className="ah-archive-notice-more"
          aria-expanded={notice.open}
          aria-label={notice.open ? t.hideOthers : t.showOthers(more)}
          onPress={() => notice.setOpen?.(!notice.open)}
        >
          {notice.open ? t.hide : `+${more}`}
        </ControlButton>
      ) : null}
      {link ? (
        <ControlButton
          data-testid="notice-link"
          size="row"
          variant="quiet"
          onPress={link.onPress}
        >
          {link.label}
        </ControlButton>
      ) : null}
      {onRestore ? (
        <ControlButton
          data-testid="restore-notice"
          size="row"
          variant="quiet"
          isDisabled={busy}
          onPress={onRestore}
        >
          {restoreLabel ?? t.restore}
        </ControlButton>
      ) : null}
      <ControlButton
        data-testid="notice-close"
        size="row"
        variant="quiet"
        className="ah-archive-notice-close"
        aria-label={t.close}
        onPress={dismiss}
      >
        ×
      </ControlButton>
    </section>
  );
  return notice.element ? createPortal(content, notice.element) : content;
}
