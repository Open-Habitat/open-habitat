import { type PointerEvent, useEffect, useId, useRef, useState } from "react";

export function useAccountSheetDrag(dismiss: () => void) {
  const start = useRef<number | null>(null);
  const [dy, setDy] = useState(0);
  const reset = () => {
    start.current = null;
    setDy(0);
  };
  return {
    style: dy ? { transform: `translateY(${dy}px)` } : undefined,
    head: {
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (
          event.button !== 0 ||
          (event.target instanceof Element && event.target.closest("button"))
        )
          return;
        start.current = event.clientY;
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        if (start.current !== null)
          setDy(Math.max(0, event.clientY - start.current));
      },
      onPointerUp: (event: PointerEvent<HTMLElement>) => {
        if (start.current !== null && event.clientY - start.current > 72)
          dismiss();
        reset();
      },
      onPointerCancel: reset,
    },
  };
}

/** Same-URL entries let the phone's Back gesture dismiss one account layer.
 * Preserve the router's state/key: opening a sheet is not route navigation. */
export function useAccountSheet(phone: boolean) {
  const id = useId();
  const [depth, setDepth] = useState(0);
  const current = useRef(0);
  const closing = useRef(false);
  const afterClose = useRef<(() => void) | undefined>(undefined);
  const close = (action?: () => void, all = false) => {
    if (closing.current) return;
    if (!current.current) {
      action?.();
      return;
    }
    closing.current = true;
    afterClose.current = action;
    window.history.go(all ? -current.current : -1);
  };
  useEffect(() => {
    const pop = (event: PopStateEvent) => {
      const layer = event.state?.accountSheet;
      const next =
        layer?.id === id ? Math.min(current.current, layer.depth) : 0;
      current.current = next;
      setDepth(next);
      closing.current = false;
      const action = afterClose.current;
      afterClose.current = undefined;
      action?.();
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [id]);
  useEffect(() => {
    if (!phone && current.current && !closing.current) {
      closing.current = true;
      window.history.go(-current.current);
    }
  }, [phone]);
  return {
    menuOpen: depth > 0,
    feedbackOpen: depth > 1,
    open: () => {
      if (closing.current || current.current >= 2) return;
      const next = current.current + 1;
      window.history.pushState(
        { ...window.history.state, accountSheet: { id, depth: next } },
        "",
      );
      current.current = next;
      setDepth(next);
    },
    back: () => close(),
    act: (action: () => void) => close(action, true),
  };
}
