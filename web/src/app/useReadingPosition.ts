import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { LiveTurn } from "./conversationEvents";
import type { ConversationStore } from "./conversationStore";
import type { HistoryEntry } from "./history";
import { hiddenSessionEntry, sessionMarkers } from "./sessionSettings";

/** An authored reading page is not a conversation tail. Derive this from the
 * mounted view rather than duplicating its local guide-selection state. */
export function isReadingIntro(viewport: HTMLElement | null) {
  return !!viewport?.querySelector("[data-reading-intro]");
}

/** Assigning scrollTop, even to its current value, can end the browser's
 * momentum scroll or elastic overscroll mid-gesture, which the reader sees as
 * a sudden jump. So follow the end only when the view is really short of it;
 * an overscrolled end (negative gap) is left to the browser. */
export function scrollToEnd(viewport: HTMLElement) {
  if (viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight >= 1)
    viewport.scrollTop = viewport.scrollHeight;
}

/** Safari reports an elastic overscroll as a scrollTop outside its range. */
function overscrolled(viewport: HTMLElement) {
  return (
    viewport.scrollTop < 0 ||
    viewport.scrollTop > viewport.scrollHeight - viewport.clientHeight + 1
  );
}

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
  const markers = sessionMarkers(entries);
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
      hiddenSessionEntry(entry, markers) ||
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
  const [awayFromLatest, setAwayFromLatest] = useState(false);
  const wasAtBottom = useRef(true);
  const previousTail = useRef<{ id?: string; key?: string }>({
    id,
    key: entries.at(-1)?.entry_key,
  });
  useLayoutEffect(() => {
    const previous = previousTail.current;
    previousTail.current = { id, key: entries.at(-1)?.entry_key };
    if (previous.id !== id || !previous.key || wasAtBottom.current) return;
    const index = entries.findIndex(
      (entry) => entry.entry_key === previous.key,
    );
    if (index < 0) return;
    const replies = entries
      .slice(index + 1)
      .filter(
        (entry) =>
          entry.kind === "assistant" &&
          (entry.blocks?.some(
            (block) => block.type === "text" && !!block.text,
          ) ||
            (!entry.blocks?.length && !!entry.content.text)),
      );
    if (replies.length) setUnseen((count) => count + replies.length);
  }, [id, entries]);
  const feed = useRef<HTMLElement>(null);
  const latest = useRef({ entries, next, unseen });
  latest.current = { entries, next, unseen };
  // A route opening always starts at latest. Anchors belong to the current
  // reading visit (paging/layout changes), not a later navigation back here.
  const readingAnchor = useRef<Anchor | undefined>(undefined);
  const selected = useRef(id);
  useLayoutEffect(() => {
    if (selected.current === id) return;
    selected.current = id;
    readingAnchor.current = undefined;
    wasAtBottom.current = true;
    if (feed.current) feed.current.scrollTop = feed.current.scrollHeight;
    setUnseen(0);
    setAwayFromLatest(false);
  }, [id]);
  const captureAnchor = useCallback(() => {
    const viewport = feed.current;
    if (!viewport || wasAtBottom.current || overscrolled(viewport)) return;
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
      // The reader's own overscroll returns by itself; a write would cut it.
      if (overscrolled(viewport)) return true;
      const shift =
        row.getBoundingClientRect().top -
        viewport.getBoundingClientRect().top -
        anchor.offset;
      if (Math.abs(shift) >= 1) viewport.scrollTop += shift;
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
    if (isReadingIntro(feed.current)) return;
    if (wasAtBottom.current && feed.current) {
      scrollToEnd(feed.current);
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
    if (!viewport || isReadingIntro(viewport)) return;
    if (wasAtBottom.current) scrollToEnd(viewport);
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

/** How long a reader gesture owns the view before following may move it. */
const intentWindow = 600;
/** How long a following view keeps its height when its tail shrinks. A row
 * being rebuilt is gone for 15–60 ms; a live row that changes its own shape
 * stays shorter, and holding that longer is an empty gap above the composer. */
const holdWindow = 300;

/** Follows the latest turn while the reader is at the end, and lets reader
 * input, and only reader input, suspend it. Layout-induced scrolls (including
 * the browser clamping scrollTop when work collapses) are not reader input. */
export function useFollowLatest({
  feed,
  id,
  opened,
  rows,
  wasAtBottom,
  setAwayFromLatest,
}: {
  feed: RefObject<HTMLElement | null>;
  id: string | undefined;
  opened: boolean;
  rows: number;
  wasAtBottom: RefObject<boolean>;
  setAwayFromLatest: Dispatch<SetStateAction<boolean>>;
}) {
  const userScrollIntent = useRef(0);
  // Growth that arrived during a reader gesture and still has to be followed.
  const missedFollow = useRef(false);
  const lastTop = useRef(0);
  // A live tail is rebuilt in steps: the streamed part goes before the native
  // rows that replace it have rendered, or a row first renders shorter. Taking
  // that dip at face value clamps a following view up and pins it back down a
  // moment later. The stream keeps its height (an empty --ah-stream-hold at
  // the end) until the content regrows or the hold expires. The expiry is
  // set when the hold starts: a live turn resizes its tail all the time, and
  // restarting the expiry on each resize kept the hold for the whole turn.
  const hold = useRef({ id, px: 0, floor: 0, timer: 0 });
  // biome-ignore lint/correctness/useExhaustiveDependencies: opened binds listeners when the stream mounts.
  useEffect(() => {
    const viewport = feed.current;
    if (!viewport) return;
    let intentTimer: number | undefined;
    const intent = () => {
      userScrollIntent.current = Date.now();
      window.clearTimeout(intentTimer);
      intentTimer = window.setTimeout(() => {
        userScrollIntent.current = 0;
        // Only growth skipped during the gesture is followed now. Moving a
        // view that is merely near the end would undo the reader's scroll.
        if (
          missedFollow.current &&
          wasAtBottom.current &&
          !isReadingIntro(viewport)
        )
          scrollToEnd(viewport);
        missedFollow.current = false;
      }, intentWindow + 50);
    };
    const atEnd = () =>
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 1;
    const wheel = (event: WheelEvent) => {
      if (event.deltaY < 0 || !atEnd()) intent();
    };
    let touchY = 0;
    const touchstart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? 0;
    };
    const touchmove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? 0;
      if (y > touchY || !atEnd()) intent();
      touchY = y;
    };
    const keys = (event: KeyboardEvent) => {
      if (
        ["ArrowUp", "PageUp", "Home"].includes(event.key) ||
        (["ArrowDown", "PageDown", "End", " "].includes(event.key) && !atEnd())
      )
        intent();
    };
    const toggle = () => {
      userScrollIntent.current = 0;
      wasAtBottom.current = false;
      setAwayFromLatest(
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight >
          120,
      );
    };
    const scrollbar = (event: PointerEvent) => {
      if (event.target === viewport) intent();
    };
    viewport.addEventListener("wheel", wheel, { passive: true });
    viewport.addEventListener("touchstart", touchstart, { passive: true });
    viewport.addEventListener("touchmove", touchmove, { passive: true });
    viewport.addEventListener("pointerdown", scrollbar);
    viewport.addEventListener("keydown", keys);
    viewport.addEventListener("ah:work-toggle", toggle);
    return () => {
      window.clearTimeout(intentTimer);
      viewport.removeEventListener("wheel", wheel);
      viewport.removeEventListener("touchstart", touchstart);
      viewport.removeEventListener("touchmove", touchmove);
      viewport.removeEventListener("pointerdown", scrollbar);
      viewport.removeEventListener("keydown", keys);
      viewport.removeEventListener("ah:work-toggle", toggle);
    };
  }, [feed, id, opened, wasAtBottom, setAwayFromLatest]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Rebind when native rows mount the stream; the ref itself is stable.
  useEffect(() => {
    const viewport = feed.current;
    if (!viewport) return;
    const state = hold.current;
    const setHold = (px: number, glide = false) => {
      state.px = px;
      viewport.toggleAttribute("data-hold-release", glide);
      viewport.style.setProperty("--ah-stream-hold", `${px}px`);
    };
    // The rendered rows, not scrollHeight: a thread shorter than the view sits
    // on the composer and would move down without changing it, and the
    // message field resizing the stream is not a shrinking tail.
    const content = () => {
      const first = viewport.firstElementChild;
      const last = viewport.lastElementChild;
      return first && last
        ? last.getBoundingClientRect().bottom -
            first.getBoundingClientRect().top
        : 0;
    };
    // Without a reader at the end there is nothing to hold; following starts
    // again from the height it then finds.
    const release = () => {
      window.clearTimeout(state.timer);
      state.timer = 0;
      state.floor = 0;
      if (state.px) setHold(0);
    };
    if (state.id !== id) {
      state.id = id;
      release();
    }
    const update = () => {
      if (isReadingIntro(viewport)) {
        release();
        return;
      }
      if (!wasAtBottom.current) release();
      else if (Date.now() - userScrollIntent.current < intentWindow)
        missedFollow.current = true;
      else {
        const height = content();
        // A larger drop is the thread being replaced (a paged native window
        // for a long live turn), not a row being rebuilt; follow it at once.
        if (
          height >= state.floor ||
          state.floor - height > viewport.clientHeight / 2
        ) {
          window.clearTimeout(state.timer);
          state.timer = 0;
          state.floor = height;
          if (state.px) setHold(0);
        } else {
          setHold(state.floor - height);
          // A held view that never regrows lets go gently, not with a jump.
          if (!state.timer)
            state.timer = window.setTimeout(() => {
              state.timer = 0;
              state.floor = content();
              setHold(0, true);
            }, holdWindow);
        }
        scrollToEnd(viewport);
      }
      setAwayFromLatest(
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight >
          120,
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    for (const child of viewport.children) observer.observe(child);
    update();
    return () => observer.disconnect();
  }, [feed, id, opened, rows, wasAtBottom]);
  // Unmounting the conversation drops a pending hold with it.
  useEffect(() => () => window.clearTimeout(hold.current.timer), []);
  /** What a scroll event means for following: back at the end, a reader
   * leaving it, or neither (layout moved the view). */
  const scrolled = useCallback((viewport: HTMLElement) => {
    const gap =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    const down = viewport.scrollTop >= lastTop.current;
    lastTop.current = viewport.scrollTop;
    // Reaching near the end resumes following, but a reader moving up from
    // it is reading: snapping them back to the end later is the jump.
    if (gap < 2 || (gap < 60 && down)) {
      userScrollIntent.current = 0;
      return "end";
    }
    if (Date.now() - userScrollIntent.current < intentWindow) {
      userScrollIntent.current = 0;
      return "left";
    }
    return undefined;
  }, []);
  return { scrolled };
}
