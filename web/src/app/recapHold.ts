import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { notePresence } from "./conversations";

/** Typing or reading holds a newly arrived automatic recap back this long
 * after it stops. An unsent draft holds it for as long as it is there. */
export const recapQuietMs = 60_000;
// The daemon waits three minutes from the latest report before its automatic
// recap, so a report at most every 20–30 seconds keeps it waiting.
const reportGapMs = 20_000;
const draftReportMs = 30_000;

/** Whether the person is busy in this conversation (Jari 27.10.2026: the
 * recap must not appear while a long message is being written). Composer
 * focus counts only when it happens: the field keeps focus while the person
 * is away, and coming back is exactly when the recap is wanted. */
export function useRecapHold({
  id,
  csrf,
  controlled,
  draft,
  feed,
  opened,
}: {
  id: string | undefined;
  csrf: string | undefined;
  controlled: boolean;
  draft: string;
  feed: RefObject<HTMLElement | null>;
  opened: boolean;
}): { active: boolean; note: () => void } {
  const [recent, setRecent] = useState(false);
  const quiet = useRef<number | undefined>(undefined);
  const reported = useRef({ id: "", at: 0 });
  const report = useCallback(() => {
    if (!id || !csrf || !controlled) return;
    const now = Date.now();
    if (reported.current.id === id && now - reported.current.at < reportGapMs)
      return;
    reported.current = { id, at: now };
    // Only a postponement: a lost report lets the daemon's recap come sooner.
    void notePresence(id, csrf).catch(() => undefined);
  }, [id, csrf, controlled]);
  const note = useCallback(() => {
    setRecent(true);
    window.clearTimeout(quiet.current);
    quiet.current = window.setTimeout(() => setRecent(false), recapQuietMs);
    report();
  }, [report]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new conversation starts without the previous one's activity.
  useEffect(() => {
    window.clearTimeout(quiet.current);
    setRecent(false);
  }, [id]);
  useEffect(() => () => window.clearTimeout(quiet.current), []);
  const drafting = draft.trim() !== "";
  useEffect(() => {
    if (!drafting) return;
    report();
    const timer = window.setInterval(report, draftReportMs);
    return () => window.clearInterval(timer);
  }, [drafting, report]);
  // Reader input on the stream, not layout-induced scrolling.
  // biome-ignore lint/correctness/useExhaustiveDependencies: opened binds listeners when the stream mounts.
  useEffect(() => {
    const viewport = feed.current;
    if (!viewport) return;
    const events = ["wheel", "touchmove", "keydown", "pointerdown"] as const;
    for (const name of events)
      viewport.addEventListener(name, note, { passive: true });
    return () => {
      for (const name of events) viewport.removeEventListener(name, note);
    };
  }, [note, opened]);
  return { active: recent || drafting, note };
}
