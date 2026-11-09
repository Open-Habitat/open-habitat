# components/ArchiveNotice.tsx

Generated from web/src/components/ArchiveNotice.tsx; do not edit.

```tsx
import { type KeyboardEvent, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useText } from "../i18n";
import { archiveNoticeText } from "../text/archiveNotice";
import { ControlButton } from "./ControlElements";
import type { IconName } from "./Icon";
import { type NoticeKind, returnFocusToWork, useNotice } from "./NoticeArea";
import { WarningBanner } from "./WarningBanner";

/** How long an untouched notice stays: long enough to read the title and
 * reach the undo, short enough not to linger (Jari found 20 s too long).
 * Hover, focus or a pending action holds it. */
export const NOTICE_LIFETIME_MS = 8_000;

const icons: Record<NoticeKind, IconName> = {
  archive: "archive",
  trash: "trash",
  "workspace-archive": "eyeOff",
  "workspace-icon": "check",
  "editor-save": "check",
};

/** Undo offer; failures persist until dismissed. The archive itself remains
 * native host state. In the page's top bar (NoticeArea), it never takes focus; Esc
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
}: {
  kind?: NoticeKind;
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
  useEffect(() => {
    if (problem) remaining.current = NOTICE_LIFETIME_MS;
  }, [problem]);
  const held = notice.paused || notice.folded || busy || !!problem;
  useEffect(() => {
    void problem;
    if (held) return;
    const start = Date.now();
    const timer = window.setTimeout(onClose, remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - start));
    };
  }, [held, onClose, problem]);
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
    // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/noNoninteractiveElementInteractions: Esc bubbles from the row's native buttons; the container is not an interactive control.
    <section
      ref={row}
      data-testid="archive-notice"
      data-kind={kind}
      className="ah-archive-notice-container"
      hidden={notice.folded}
      onKeyDown={onKeyDown}
    >
      <WarningBanner
        tone={problem ? "danger" : busy ? "progress" : "success"}
        icon={problem ? undefined : icons[kind]}
        actions={
          <>
            {more && notice.setOpen ? (
              <ControlButton
                data-testid="notice-more"
                size="inline"
                variant="quiet"
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
              aria-label={t.close}
              onPress={dismiss}
            >
              ×
            </ControlButton>
          </>
        }
      >
        {message ?? t.archived}
        {title ? (
          <>
            {" "}
            <b>{title}</b>
          </>
        ) : null}
        {detail ? (
          <span data-testid="archive-notice-detail"> · {detail}</span>
        ) : null}
        {problem ? <span data-testid="archive-error"> · {problem}</span> : null}
      </WarningBanner>
    </section>
  );
  return notice.element ? createPortal(content, notice.element) : content;
}

```
