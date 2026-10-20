import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const FloatingControls = createContext<HTMLElement | null>(null);

/** Viewport-height conversation composition. The caller owns history anchoring and focus. */
export function ConversationFrame({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLElement>(null);
  const [floating, setFloating] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const root = frame.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    let composer: Element | null = null;
    let dock: Element | null = null;
    const measure = () => {
      for (const [name, element] of [
        ["--ah-composer-height", composer],
        ["--ah-dock-height", dock],
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
      if (composer === nextComposer && dock === nextDock) return;
      size.disconnect();
      composer = nextComposer;
      dock = nextDock;
      if (composer) size.observe(composer);
      if (dock) size.observe(dock);
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
    <section className="ah-conversation-frame ah-reading-view" ref={frame}>
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
}: {
  children: ReactNode;
  streamRef?: React.Ref<HTMLElement>;
  onScroll?: () => void;
}) {
  return (
    <section
      className="ah-conversation-stream"
      tabIndex={-1}
      aria-label="Keskustelu"
      ref={streamRef}
      onScroll={onScroll}
    >
      {children}
    </section>
  );
}
