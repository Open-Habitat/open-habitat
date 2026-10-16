import { useEffect, useState } from "react";

// Invalidation precedes the successful native-history read on every live turn.
// Delay only its presentation, never the underlying write/recovery guards.
export function useSettledWarning(active: boolean, scope: string, delay = 800) {
  const [settled, setSettled] = useState<string>();
  useEffect(() => {
    setSettled(undefined);
    if (!active) return;
    const timer = window.setTimeout(() => setSettled(scope), delay);
    return () => window.clearTimeout(timer);
  }, [active, scope, delay]);
  return active && settled === scope;
}
