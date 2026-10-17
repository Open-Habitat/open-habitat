import { useEffect, useRef, useState } from "react";

/** How long a Pi that has just started may take to answer for its processes. */
export const BRIDGE_WARMUP_MS = 10000;

/**
 * Whether a missing process bridge is expected rather than news. It is while
 * no Pi runs (ADR 0020), and after Pi starts until an inventory read after the
 * start answers: Pi's process extension loads after Pi reports running, and in
 * between the daemon truthfully says the bridge is unavailable (live
 * 2026-10-17, the "?" pill after a send to a stopped conversation).
 */
export function useBridgeExpected(
  notRunning: boolean,
  inventory?: { availability?: string },
): boolean {
  const [warming, setWarming] = useState(notRunning);
  const atStart = useRef<typeof inventory>(undefined);
  if (notRunning) atStart.current = inventory;
  // A fixed deadline from the start: inventory polls do not extend it.
  useEffect(() => {
    if (notRunning) {
      setWarming(true);
      return;
    }
    if (!warming) return;
    const timer = window.setTimeout(() => setWarming(false), BRIDGE_WARMUP_MS);
    return () => window.clearTimeout(timer);
  }, [notRunning, warming]);
  useEffect(() => {
    if (
      !notRunning &&
      warming &&
      inventory !== atStart.current &&
      inventory?.availability === "available"
    )
      setWarming(false);
  }, [notRunning, warming, inventory]);
  return notRunning || warming;
}
