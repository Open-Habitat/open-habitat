import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { textNow } from "../i18n";
import { conversationFrameText } from "../text/conversationFrame";

const FloatingControls = createContext<HTMLElement | null>(null);

/** Viewport-height conversation composition. The caller owns history anchoring and focus. */
export function ConversationFrame({
  children,
  className,
  view,
}: {
  children: ReactNode;
  className?: string;
  /** Which state of the conversation the frame shows (creation, loading,
   * opened); the frame itself stays through them. */
  view?: string;
}) {
  const frame = useRef<HTMLElement>(null);
  const [floating, setFloating] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const root = frame.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    let composer: Element | null = null;
    let dock: Element | null = null;
    let header: Element | null = null;
    const measure = () => {
      for (const [name, element] of [
        ["--ah-frame-height", root],
        ["--ah-composer-height", composer],
        ["--ah-dock-height", dock],
        ["--ah-header-height", header],
      ] as const) {
        root.style.setProperty(
          name,
          `${element?.getBoundingClientRect().height ?? 0}px`,
        );
      }
    };
    const size = new ResizeObserver(measure);
    const attach = () => {
      const nextComposer = root.querySelector(":scope > .ah-composer");
      const nextDock = root.querySelector(":scope > .ah-terminal-dock");
      const nextHeader = root.querySelector(":scope > .ah-agent-header");
      if (
        composer === nextComposer &&
        dock === nextDock &&
        header === nextHeader
      )
        return;
      size.disconnect();
      size.observe(root);
      composer = nextComposer;
      dock = nextDock;
      header = nextHeader;
      if (composer) size.observe(composer);
      if (dock) size.observe(dock);
      if (header) size.observe(header);
      measure();
    };
    const changes = new MutationObserver(attach);
    changes.observe(root, { childList: true });
    attach();
    return () => {
      changes.disconnect();
      size.disconnect();
    };
  }, []);
  return (
    <section
      className={`ah-conversation-frame ah-reading-view${className ? ` ${className}` : ""}`}
      data-view={view}
      ref={frame}
    >
      <FloatingControls.Provider value={floating}>
        {children}
      </FloatingControls.Provider>
      <div className="ah-floating-controls" ref={setFloating} />
    </section>
  );
}

/** Floating actions belong to the frame, not the scrolling timeline. */
export function ConversationFloatingAction({
  children,
}: {
  children: ReactNode;
}) {
  const target = useContext(FloatingControls);
  return target ? createPortal(children, target) : null;
}

/** The only scrolling region; the application may attach its history ref and onScroll. */
export function ConversationStream({
  children,
  streamRef,
  onScroll,
  label,
}: {
  children: ReactNode;
  label?: string;
  streamRef?: React.Ref<HTMLElement>;
  onScroll?: () => void;
}) {
  return (
    <section
      data-testid="conversation-stream"
      className="ah-conversation-stream"
      tabIndex={-1}
      aria-label={label ?? textNow(conversationFrameText).conversation}
      ref={streamRef}
      onScroll={onScroll}
    >
      {children}
    </section>
  );
}
