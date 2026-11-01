# components/ViewPanel.tsx

Generated from web/src/components/ViewPanel.tsx; do not edit.

```tsx
import "./ViewPanel.css";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  useRef,
} from "react";
import { formatDate, liveText } from "../i18n";
import { viewPanelText } from "../text/viewPanel";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";

const txt = liveText(viewPanelText);

/** A view's content: a sandboxed frame on the view's own host, scripts but
 * nothing else. The panel and the own tab both show a view this way, so the
 * top-level page is always the app's: a browser that blocks third-party
 * cookies keys that on the top-level site, and the view's sandboxed document
 * as the top-level page would make every request it sends a third-party one,
 * so its own stylesheets and scripts would not load. */
export function ViewFrame({ src, title }: { src: string; title: string }) {
  return (
    <iframe
      key={src}
      data-testid="view-frame"
      src={src}
      title={txt.frame(title)}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      allow=""
    />
  );
}

/** The panel's own controls, as in the editor's header (EditorHeader): they
 * stay reachable even while the conversation is hidden. */
export function ViewHeader({
  title,
  expanded,
  titleRef,
  onToggleExpanded,
  onOpenTab,
  onShare,
  onClose,
}: {
  title: string;
  expanded: boolean;
  titleRef?: Ref<HTMLHeadingElement>;
  onToggleExpanded: () => void;
  onOpenTab: () => void;
  /** Jaa linkillä (ADR 0033); absent where the site offers no links. */
  onShare?: () => void;
  onClose: () => void;
}) {
  return (
    <header className="ah-editor-header" data-testid="view-header">
      <h2 ref={titleRef} tabIndex={-1} className="ah-view-title">
        {title}
      </h2>
      <span className="ah-editor-controls">
        <ControlButton
          data-testid="expand-view"
          size="row"
          variant="quiet"
          aria-label={expanded ? txt.restoreSplit : txt.expand}
          title={expanded ? txt.restoreSplitHint : txt.expand}
          aria-pressed={expanded}
          onPress={onToggleExpanded}
        >
          <Icon name={expanded ? "forward" : "back"} />
        </ControlButton>
        <ControlButton
          data-testid="view-panel-open-tab"
          size="row"
          variant="quiet"
          aria-label={txt.openTab}
          title={txt.openTabHint}
          onPress={onOpenTab}
        >
          <Icon name="external" />
        </ControlButton>
        {onShare && (
          <ControlButton
            data-testid="view-panel-share"
            size="row"
            variant="quiet"
            aria-label={txt.share}
            title={txt.share}
            onPress={onShare}
          >
            <Icon name="link" />
          </ControlButton>
        )}
        <ControlButton
          data-testid="close-view"
          size="row"
          variant="quiet"
          aria-label={txt.close}
          title={txt.close}
          onPress={onClose}
        >
          <Icon name="cross" />
        </ControlButton>
      </span>
    </header>
  );
}

/** The right-hand panel. The content runs in a frame on its own origin with
 * scripts but without same-origin rights; nothing here reads or reaches it. */
export function ViewPanel({
  title,
  src,
  failed,
  expanded,
  titleRef,
  onToggleExpanded,
  onOpenTab,
  onShare,
  sharedUntil,
  onClose,
}: {
  title: string;
  /** The one-time URL on the view's host; absent while it is being minted. */
  src?: string;
  failed?: boolean;
  expanded: boolean;
  titleRef?: Ref<HTMLHeadingElement>;
  onToggleExpanded: () => void;
  onOpenTab: () => void;
  onShare?: () => void;
  /** The expiry of the link that shows this view, when there is one. */
  sharedUntil?: string;
  onClose: () => void;
}) {
  const keyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Escape from the panel's own controls closes it, as in the editor.
    <section
      className="ah-view-pane"
      aria-label={txt.panel(title)}
      data-testid="view-panel"
      onKeyDown={keyDown}
    >
      <ViewHeader
        title={title}
        expanded={expanded}
        titleRef={titleRef}
        onToggleExpanded={onToggleExpanded}
        onOpenTab={onOpenTab}
        onShare={onShare}
        onClose={onClose}
      />
      <div className="ah-view-frame">
        {src && !failed ? (
          <ViewFrame key={src} src={src} title={title} />
        ) : (
          <p className="ah-view-frame-status" role="status">
            {failed ? txt.failed : txt.opening}
          </p>
        )}
      </div>
      <p className="ah-view-note">
        {txt.frozen} ·{" "}
        {sharedUntil
          ? txt.sharedUntil(
              formatDate(new Date(sharedUntil), { dateStyle: "short" }),
            )
          : txt.onlyYou}{" "}
        · {txt.isolated}
      </p>
    </section>
  );
}

/** The conversation on the left, the view panel on the right behind a divider
 * the person can drag or move with the arrows. Expanding hides the
 * conversation behind a strip; on a phone the panel covers the conversation.
 * The conversation stays mounted, so opening a view never reloads it. */
export function ViewSplit({
  open,
  expanded,
  width,
  min,
  max,
  panel,
  children,
  onResize,
  onReset,
  onShowConversation,
}: {
  open: boolean;
  expanded: boolean;
  /** The panel's width in pixels. */
  width: number;
  min: number;
  max: number;
  panel: ReactNode;
  children: ReactNode;
  onResize: (width: number) => void;
  onReset: () => void;
  onShowConversation: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, width };
    root.current?.classList.add("ah-view-dragging");
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    // The panel is on the right: dragging left widens it.
    if (start) onResize(start.width - (event.clientX - start.x));
  };
  const pointerUp = () => {
    drag.current = null;
    root.current?.classList.remove("ah-view-dragging");
  };
  const keyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 96 : 32;
    let next: number | undefined;
    if (event.key === "ArrowLeft") next = width + step;
    else if (event.key === "ArrowRight") next = width - step;
    else if (event.key === "Home") next = max;
    else if (event.key === "End") next = min;
    else return;
    event.preventDefault();
    onResize(next);
  };
  return (
    <div
      ref={root}
      className={`ah-view-split${open ? " ah-view-open" : ""}${open && expanded ? " ah-view-expanded" : ""}`}
      style={{ "--ah-view-width": `${width}px` } as React.CSSProperties}
    >
      <div className="ah-view-conversation" inert={open && expanded}>
        {children}
      </div>
      {open && expanded ? (
        <button
          data-testid="view-show-conversation"
          type="button"
          className="ah-editor-strip"
          aria-label={txt.showConversation}
          title={txt.showConversationHint}
          onClick={onShowConversation}
        >
          <span className="ah-editor-strip-label">{txt.conversation}</span>
        </button>
      ) : null}
      {open && !expanded ? (
        // biome-ignore lint/a11y/useSemanticElements: A focusable, adjustable window splitter has no native element; this is the ARIA separator pattern.
        <div
          data-testid="resize-view"
          className="ah-view-divider"
          role="separator"
          aria-orientation="vertical"
          aria-label={txt.width}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={width}
          aria-valuetext={txt.pixels(width)}
          tabIndex={0}
          title={txt.dragHint}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onDoubleClick={onReset}
          onKeyDown={keyDown}
        />
      ) : null}
      {open ? panel : null}
    </div>
  );
}

```
