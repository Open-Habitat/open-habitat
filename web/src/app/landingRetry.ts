import { useEffect, useRef, useState } from "react";

export type LandingFailure = "network" | "answer" | "identity";

// Only the caller's ordinary, identity-checked reads are retried. This hook
// never navigates or owns an OAuth/device-link/write operation.
export function useLandingRetry(
  phase: string,
  failure: LandingFailure,
  refresh: () => void,
) {
  const episode = useRef<{ started: number; attempt: number } | undefined>(
    undefined,
  );
  const [offline, setOffline] = useState(!navigator.onLine);
  const [seconds, setSeconds] = useState<number | undefined>();
  const [progress, setProgress] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  useEffect(() => {
    const changed = () => setOffline(!navigator.onLine);
    window.addEventListener("online", changed);
    window.addEventListener("offline", changed);
    return () => {
      window.removeEventListener("online", changed);
      window.removeEventListener("offline", changed);
    };
  }, []);
  useEffect(() => {
    setSeconds(undefined);
    if (phase !== "daemon_unavailable") {
      if (phase !== "loading") {
        episode.current = undefined;
        setExhausted(false);
      }
      return;
    }
    if (failure === "identity") return;
    episode.current ??= { started: Date.now(), attempt: 0 };
    const run = episode.current;
    const delay = [5, 10, 20, 40, 60][Math.min(run.attempt, 4)] * 1000;
    const next = Date.now() + delay;
    const expired = () => Date.now() - run.started >= 15 * 60 * 1000;
    const attempt = () => {
      if (expired() || !navigator.onLine) return;
      run.attempt++;
      refresh();
    };
    const tick = () => {
      setExhausted(expired());
      if (expired() || offline) {
        setSeconds(undefined);
        return;
      }
      setSeconds(Math.max(0, Math.ceil((next - Date.now()) / 1000)));
      setProgress(Math.min(1, 1 - (next - Date.now()) / delay));
      if (Date.now() >= next) {
        window.clearInterval(timer);
        attempt();
      }
    };
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) attempt();
    };
    const visible = () => {
      if (document.visibilityState === "visible") attempt();
    };
    const timer = window.setInterval(tick, 1000);
    tick();
    window.addEventListener("online", attempt);
    window.addEventListener("pageshow", restored);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", attempt);
      window.removeEventListener("pageshow", restored);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [phase, failure, refresh, offline]);
  return { offline, seconds, progress, exhausted };
}
