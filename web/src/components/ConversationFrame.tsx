import type { ReactNode } from "react";

/** Viewport-height conversation composition. The caller owns history anchoring and focus. */
export function ConversationFrame({ children }: { children: ReactNode }) {
  return <section className="ah-conversation-frame">{children}</section>;
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
      ref={streamRef}
      onScroll={onScroll}
    >
      {children}
    </section>
  );
}
