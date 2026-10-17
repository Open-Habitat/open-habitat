import { useEffect, useRef, useState } from "react";

// Shared rules of the accepted loading landing (issues/proto-loading-landing).
export const landingRevealAfter = 300;
export const landingMinShown = 500;
export const landingSlowAfter = 8000;
const enterFor = 400;

export type LandingMode = "off" | "loading" | "failed";

/**
 * Times the loading landing. The first load is measured from navigation
 * start, so a page that loads within 300 ms never shows a loader; once the
 * landing has shown, it stays at least 500 ms, so it cannot flash. A failure
 * shows at once and keeps the landing's place, and its retry keeps the
 * landing visible. After a shown landing, `entering` is true briefly so the
 * frame can fade in; a fast load just paints the app.
 */
export function useLanding(mode: LandingMode) {
  const [revealed, setRevealed] = useState(
    () => mode !== "off" && performance.now() >= landingRevealAfter,
  );
  const [slow, setSlow] = useState(false);
  const [holding, setHolding] = useState(false);
  const [entering, setEntering] = useState(false);
  // Times on the performance.now() clock. Transitions set them once, so an
  // effect that runs again for the same mode (React StrictMode) keeps them.
  const loadStart = useRef(0);
  const shownAt = useRef<number | undefined>(undefined);
  const holdUntil = useRef(0);
  const enterUntil = useRef(0);
  const previous = useRef<LandingMode | undefined>(undefined);
  useEffect(() => {
    const now = performance.now();
    const before = previous.current;
    if (before !== mode) {
      previous.current = mode;
      if (mode === "failed") shownAt.current ??= now;
      else if (mode === "loading" && before === "failed") {
        // A retry from the failure keeps the landing visible.
        loadStart.current = now;
        shownAt.current = now;
      } else if (mode === "loading") {
        // The first load counts from navigation start, later ones from now.
        loadStart.current = before === undefined ? 0 : now;
        shownAt.current =
          now >= loadStart.current + landingRevealAfter ? now : undefined;
      } else {
        const shown = before === "loading" ? shownAt.current : undefined;
        holdUntil.current = shown === undefined ? 0 : shown + landingMinShown;
        enterUntil.current =
          shown === undefined ? 0 : Math.max(now, holdUntil.current) + enterFor;
        shownAt.current = undefined;
      }
    }
    const timers: number[] = [];
    const at = (time: number, run: () => void) => {
      if (time <= now) run();
      else timers.push(window.setTimeout(run, time - now));
    };
    if (mode === "failed") {
      setRevealed(true);
      setSlow(false);
      setHolding(false);
      setEntering(false);
    } else if (mode === "loading") {
      setHolding(false);
      setEntering(false);
      if (shownAt.current !== undefined) setRevealed(true);
      else {
        setRevealed(false);
        at(loadStart.current + landingRevealAfter, () => {
          shownAt.current ??= performance.now();
          setRevealed(true);
        });
      }
      setSlow(false);
      at(loadStart.current + landingSlowAfter, () => setSlow(true));
    } else {
      setRevealed(false);
      setSlow(false);
      setHolding(now < holdUntil.current);
      at(holdUntil.current, () => setHolding(false));
      setEntering(now < enterUntil.current);
      at(enterUntil.current, () => setEntering(false));
    }
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [mode]);
  return {
    /** The landing is mounted: loading, failed, or held after a shown load. */
    show: mode !== "off" || holding,
    revealed: revealed || holding,
    slow,
    entering: entering && !holding,
  };
}
