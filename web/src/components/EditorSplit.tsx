import "./EditorSplit.css";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
} from "react";

/** Rinnakkain (proto-file-viewing-2): the editor on the left, the conversation
 * a column on the right behind a divider the person can drag, move with the
 * arrows, or press Enter on to hide the conversation into a strip. The
 * conversation stays mounted in the same place whether the editor is open or
 * not, so opening it never reloads or re-scrolls the conversation. */
export function EditorSplit({
  className,
  open,
  collapsed,
  width,
  min,
  max,
  editor,
  children,
  strip,
  onResize,
  onCollapse,
  onReset,
  onShowConversation,
}: {
  className?: string;
  open: boolean;
  collapsed: boolean;
  width: number;
  min: number;
  max: number;
  /** The editor's frame; once given it stays mounted while closed. */
  editor: ReactNode;
  children: ReactNode;
  /** Pi's state for the strip: shown while the conversation is hidden. */
  strip: { label: string; working: boolean; unread: boolean };
  /** A new width; `commit` is set when a drag or a key press ends. */
  onResize: (width: number, commit: boolean) => void;
  onCollapse: (collapsed: boolean) => void;
  onReset: () => void;
  onShowConversation: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLDivElement>(null);
  useKeepReadingPlace(column);
  const drag = useRef<{ x: number; width: number } | null>(null);

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, width: collapsed ? 0 : width };
    root.current?.classList.add("ah-editor-dragging");
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    // The column is on the right: dragging left widens it.
    const next = start.width - (event.clientX - start.x);
    if (next < min - 90) {
      if (!collapsed) onCollapse(true);
    } else {
      if (collapsed) onCollapse(false);
      onResize(next, false);
    }
  };
  const pointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    root.current?.classList.remove("ah-editor-dragging");
    if (!collapsed) onResize(width, true);
  };
  const keyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 96 : 32;
    let next: number | undefined;
    if (event.key === "ArrowLeft") next = width + step;
    else if (event.key === "ArrowRight") next = width - step;
    else if (event.key === "Home") next = max;
    else if (event.key === "End") next = min;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onCollapse(!collapsed);
      return;
    } else return;
    event.preventDefault();
    if (collapsed) onCollapse(false);
    onResize(next, true);
  };

  return (
    <div
      ref={root}
      className={`ah-editor-split${open ? " ah-editor-open" : ""}${open && collapsed ? " ah-editor-collapsed" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--ah-editor-conv-width": `${width}px` } as React.CSSProperties}
    >
      {editor ? (
        // A closed editor keeps its frame loaded, so reopening is instant.
        <section className="ah-editor-pane" aria-label="Editori" hidden={!open}>
          {editor}
        </section>
      ) : null}
      {open ? (
        // biome-ignore lint/a11y/useSemanticElements: A focusable, adjustable window splitter has no native element; this is the ARIA separator pattern.
        <div
          className="ah-editor-divider"
          role="separator"
          aria-orientation="vertical"
          aria-label="Keskustelun leveys"
          aria-controls="ah-editor-conversation"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={collapsed ? 0 : width}
          aria-valuetext={
            collapsed ? "Keskustelu piilotettu" : `${width} pikseliä`
          }
          tabIndex={0}
          title="Vedä leveyttä. Nuolet muuttavat, Enter piilottaa tai näyttää keskustelun, kaksoisnapsautus palauttaa."
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onDoubleClick={onReset}
          onKeyDown={keyDown}
        />
      ) : null}
      {open && collapsed ? (
        <button
          type="button"
          className="ah-editor-strip"
          aria-label={`Näytä keskustelu (${strip.unread ? "Uusi vastaus" : strip.label})`}
          title="Näytä keskustelu (Ctrl+Alt+K)"
          onClick={onShowConversation}
        >
          <span
            aria-hidden="true"
            className={`ah-status-dot${strip.working ? " ah-running" : ""}${strip.unread ? " ah-editor-unread" : ""}`}
          />
          <span className="ah-editor-strip-label">Keskustelu</span>
        </button>
      ) : null}
      <div
        ref={column}
        id="ah-editor-conversation"
        className="ah-editor-conversation"
        inert={open && collapsed}
      >
        {children}
      </div>
    </div>
  );
}

// When the column changes width the text reflows; the line the reader was at
// stays at the same height, and a reader at the bottom stays at the bottom.
// A file link that opened the editor is the preferred anchor while visible.
function useKeepReadingPlace(column: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const host = column.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    let stream: HTMLElement | null = null;
    let anchor: { el: Element; top: number } | null = null;
    let bottom = false;
    const record = () => {
      if (!stream) return;
      const box = stream.getBoundingClientRect();
      bottom = stream.scrollHeight - stream.scrollTop - stream.clientHeight < 4;
      const opened = stream.querySelector(".ah-file-link-opened");
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        return r.bottom > box.top && r.top < box.bottom;
      };
      const el =
        opened && visible(opened)
          ? opened
          : Array.from(
              stream.querySelectorAll(
                ".ah-markdown > *, .ah-user-message, .ah-pi-tool, section, p, li",
              ),
            ).find((n) => n.getBoundingClientRect().bottom > box.top + 8);
      anchor = el
        ? { el, top: el.getBoundingClientRect().top - box.top }
        : null;
    };
    const restore = () => {
      if (!stream) return;
      if (bottom) stream.scrollTop = stream.scrollHeight;
      else if (anchor?.el.isConnected) {
        const top =
          anchor.el.getBoundingClientRect().top -
          stream.getBoundingClientRect().top;
        stream.scrollTop += top - anchor.top;
      }
      record();
    };
    const sizes = new ResizeObserver(restore);
    const attach = () => {
      const next = host.querySelector<HTMLElement>(".ah-conversation-stream");
      if (next === stream) return;
      stream?.removeEventListener("scroll", record);
      sizes.disconnect();
      stream = next;
      if (!stream) return;
      stream.addEventListener("scroll", record, { passive: true });
      sizes.observe(stream);
      record();
    };
    const changes = new MutationObserver(attach);
    changes.observe(host, { childList: true, subtree: true });
    attach();
    return () => {
      changes.disconnect();
      sizes.disconnect();
      stream?.removeEventListener("scroll", record);
    };
  }, [column]);
}
