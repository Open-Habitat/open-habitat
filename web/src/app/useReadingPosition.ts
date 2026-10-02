import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { LiveTurn } from "./conversationEvents";
import type { ConversationStore } from "./conversationStore";
import type { HistoryEntry } from "./history";

/** Timeline groups adjacent tool entries into one row keyed by the first entry. */
export function visibleEntryKeys(entries: HistoryEntry[]): string[] {
  const keys: string[] = [];
  let tool = false;
  for (const entry of entries) {
    if (entry.kind !== "tool" || !tool) keys.push(entry.entry_key);
    tool = entry.kind === "tool";
  }
  return keys;
}

type Anchor = { key: string; offset: number };
export function useReadingPosition(
  entries: HistoryEntry[],
  next: string | undefined,
  id: string | undefined,
  store: ConversationStore,
) {
  const [unseen, setUnseen] = useState(0);
  const [awayFromLatest, setAwayFromLatest] = useState(
    !!id && !!store.position(id),
  );
  const wasAtBottom = useRef(!id || !store.position(id));
  const feed = useRef<HTMLElement>(null);
  const latest = useRef({ entries, next, unseen });
  latest.current = { entries, next, unseen };
  const readingAnchor = useRef<Anchor | undefined>(
    id ? store.position(id) : undefined,
  );
  const positions = useRef(
    new Map<string, { anchor?: Anchor; atBottom: boolean; top: number }>(),
  );
  const selected = useRef(id);
  useLayoutEffect(() => {
    if (selected.current === id) return;
    const old = selected.current;
    if (old) {
      store.savePosition(old, readingAnchor.current);
      positions.current.set(old, {
        anchor: readingAnchor.current,
        atBottom: wasAtBottom.current,
        top: feed.current?.scrollTop ?? 0,
      });
    }
    selected.current = id;
    const saved = id ? positions.current.get(id) : undefined;
    const storedAnchor = id ? store.position(id) : undefined;
    readingAnchor.current = storedAnchor ?? saved?.anchor;
    wasAtBottom.current = !readingAnchor.current && (saved?.atBottom ?? true);
    if (feed.current && saved && !saved.anchor)
      feed.current.scrollTop = saved.top;
    setUnseen(0);
    setAwayFromLatest(!wasAtBottom.current);
  }, [id, store]);
  const captureAnchor = useCallback(() => {
    const viewport = feed.current;
    if (!viewport || wasAtBottom.current) return;
    const rows = viewport.querySelectorAll<HTMLElement>(".ah-feed > li");
    const top = viewport.getBoundingClientRect().top;
    const keys = visibleEntryKeys(latest.current.entries);
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (rect.bottom > top && keys[i]) {
        readingAnchor.current = {
          key: keys[i],
          offset: rect.top - top,
        };
        if (id) store.savePosition(id, readingAnchor.current);
        return;
      }
    }
  }, [id, store]);
  const restoreAnchor = useCallback(
    (
      anchor: { key: string; offset: number } | undefined,
      pages: HistoryEntry[],
    ) => {
      const viewport = feed.current;
      if (!viewport || !anchor) return false;
      const index = visibleEntryKeys(pages).indexOf(anchor.key);
      const row =
        viewport.querySelectorAll<HTMLElement>(".ah-feed > li")[index];
      if (!row) return false;
      viewport.scrollTop +=
        row.getBoundingClientRect().top -
        viewport.getBoundingClientRect().top -
        anchor.offset;
      return true;
    },
    [],
  );
  return {
    feed,
    wasAtBottom,
    readingAnchor,
    latest,
    unseen,
    setUnseen,
    awayFromLatest,
    setAwayFromLatest,
    captureAnchor,
    restoreAnchor,
  };
}

export function useReadingPositionLayout({
  entries,
  live,
  queueOpen,
  receipt,
  problem,
  details,
  confirmStop,
  currentState,
  events,
  feed,
  wasAtBottom,
  readingAnchor,
  restoreAnchor,
  setUnseen,
}: {
  entries: HistoryEntry[];
  live: LiveTurn | undefined;
  queueOpen: boolean;
  receipt: string;
  problem: string;
  details: boolean;
  confirmStop: boolean;
  currentState: string | undefined;
  events: unknown[];
  feed: RefObject<HTMLElement | null>;
  wasAtBottom: RefObject<boolean>;
  readingAnchor: RefObject<Anchor | undefined>;
  restoreAnchor: (anchor: Anchor | undefined, pages: HistoryEntry[]) => boolean;
  setUnseen: Dispatch<SetStateAction<number>>;
}) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: a live fragment changes the feed height without changing native entries.
  useLayoutEffect(() => {
    if (wasAtBottom.current && feed.current) {
      feed.current.scrollTop = feed.current.scrollHeight;
      setUnseen(0);
    } else {
      restoreAnchor(readingAnchor.current, entries);
    }
  }, [entries, live, restoreAnchor]);
  // Footer controls can change the stream height without changing history.
  // Keep the native reading anchor for readers, or follow the latest turn.
  // biome-ignore lint/correctness/useExhaustiveDependencies: footer state changes are the layout-only trigger.
  useLayoutEffect(() => {
    const viewport = feed.current;
    if (!viewport) return;
    if (wasAtBottom.current) viewport.scrollTop = viewport.scrollHeight;
    else restoreAnchor(readingAnchor.current, entries);
  }, [
    queueOpen,
    receipt,
    problem,
    details,
    confirmStop,
    currentState,
    events,
    restoreAnchor,
    entries,
  ]);
}
