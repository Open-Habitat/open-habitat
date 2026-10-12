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

/** Match the native call/result rows used by timelineItems, including orphan results. */
export function visibleEntryKeys(entries: HistoryEntry[]): string[] {
  const calls = new Set(
    entries.flatMap((entry) =>
      entry.kind === "assistant"
        ? (entry.blocks ?? []).flatMap((block) =>
            block.type === "toolCall" && block.tool_call_id
              ? [block.tool_call_id]
              : [],
          )
        : [],
    ),
  );
  const joined = new Map<string, HistoryEntry>();
  for (const entry of entries)
    if (
      entry.kind === "tool" &&
      entry.tool_call_id &&
      calls.has(entry.tool_call_id)
    )
      joined.set(entry.tool_call_id, entry);
  const keys: string[] = [];
  let first: string | undefined;
  let lastText = false;
  const flush = () => {
    if (first) keys.push(first);
    first = undefined;
    lastText = false;
  };
  for (const entry of entries) {
    if (
      entry.kind === "recap" ||
      (entry.tool_call_id && joined.get(entry.tool_call_id) === entry)
    )
      continue;
    if (entry.kind === "assistant") {
      if (first && lastText) flush();
      first ??= entry.entry_key;
      lastText =
        entry.blocks?.at(-1)?.type === "text" ||
        (!entry.blocks?.length && !!entry.content.text);
    } else {
      if (
        entry.kind === "user" ||
        entry.kind === "bash" ||
        entry.kind === "unknown"
      )
        flush();
      if (
        entry.kind !== "tool" ||
        !entry.tool_call_id ||
        !calls.has(entry.tool_call_id)
      )
        keys.push(entry.entry_key);
    }
  }
  flush();
  return keys;
}

/** An orphan result can become a child of its call when older pages arrive. */
export function rowIndexOf(entries: HistoryEntry[], key: string): number {
  const keys = visibleEntryKeys(entries);
  const direct = keys.indexOf(key);
  if (direct >= 0) return direct;
  const position = entries.findIndex((entry) => entry.entry_key === key);
  if (position >= 0 && entries[position].kind === "assistant") {
    for (let i = position - 1; i >= 0; i--) {
      if (keys.includes(entries[i].entry_key))
        return keys.indexOf(entries[i].entry_key);
      if (entries[i].kind !== "assistant" && entries[i].kind !== "tool") break;
    }
  }
  const result = entries.find(
    (entry) => entry.entry_key === key && entry.kind === "tool",
  );
  if (!result?.tool_call_id) return -1;
  const call = entries.find(
    (entry) =>
      entry.kind === "assistant" &&
      entry.blocks?.some(
        (block) =>
          block.type === "toolCall" &&
          block.tool_call_id === result.tool_call_id,
      ),
  );
  return call ? keys.indexOf(call.entry_key) : -1;
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
      const index = rowIndexOf(pages, anchor.key);
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
