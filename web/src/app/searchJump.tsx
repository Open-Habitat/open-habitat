import {
  type RefObject,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { SearchBand } from "../components/Switcher";
import { useText } from "../i18n";
import { switcherText } from "../text/switcher";
import type { HistoryEntry } from "./history";
import { daysAgo } from "./switcherModel";
import { rowIndexOf } from "./useReadingPosition";

/** A conversation opened from a search hit: which message to show, and the
 * words to mark in it. It lives for this tab until the band is closed or
 * another conversation is opened; the route stays the conversation's own. */
export interface SearchJump {
  agentId: string;
  entryKey: string;
  query: string;
  terms: string[];
  role: "user" | "assistant";
  at: string;
  /** Distinguishes two jumps to the same message. */
  serial: number;
}

let current: SearchJump | undefined;
let serial = 0;
const listeners = new Set<() => void>();
const notify = () => {
  for (const l of listeners) l();
};

export function setSearchJump(jump: Omit<SearchJump, "serial">) {
  current = { ...jump, serial: ++serial };
  notify();
}
export function clearSearchJump(agentId?: string) {
  if (!current || (agentId && current.agentId !== agentId)) return;
  current = undefined;
  notify();
}
export function searchJumpNow() {
  return current;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The jump for this conversation, if it was opened from a hit. */
export function useSearchJump(agentId: string | undefined) {
  const jump = useSyncExternalStore(subscribe, () => current);
  return jump && jump.agentId === agentId ? jump : undefined;
}

/** How far back the view reads for a hit before saying it is missing: the
 * pager's pages are a hundred messages, so this reaches thousands. */
const maxPages = 60;

export type JumpState = "searching" | "shown" | "missing";

/**
 * Brings a hit into the opened conversation: reads older pages until the
 * hit's entry is in the window, then holds the view with the message in the
 * middle, outlines it and marks the words. `hold` lends the view's own
 * reading anchor, so later renders keep the message where it is.
 */
export function useJumpToHit({
  jump,
  entries,
  next,
  older,
  feed,
  hold,
}: {
  jump: SearchJump | undefined;
  entries: HistoryEntry[];
  next: string | undefined;
  older: () => Promise<unknown> | undefined;
  feed: RefObject<HTMLElement | null>;
  hold: (anchor: { key: string; offset: number }) => void;
}): JumpState | undefined {
  const [state, setState] = useState<JumpState>();
  const pages = useRef(0);
  const loading = useRef(false);
  const shown = useRef<number | undefined>(undefined);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new jump starts again.
  useEffect(() => {
    pages.current = 0;
    shown.current = undefined;
    setState(jump ? "searching" : undefined);
  }, [jump?.serial]);
  useEffect(() => {
    if (!jump || shown.current === jump.serial) return;
    const found = entries.some((e) => e.entry_key === jump.entryKey);
    if (!found) {
      if (!next) {
        if (entries.length) setState("missing");
        return;
      }
      if (loading.current || pages.current >= maxPages) {
        if (pages.current >= maxPages) setState("missing");
        return;
      }
      loading.current = true;
      pages.current++;
      void Promise.resolve(older())
        .catch(() => setState("missing"))
        .finally(() => {
          loading.current = false;
        });
      return;
    }
    const viewport = feed.current;
    if (!viewport) return;
    const index = rowIndexOf(entries, jump.entryKey);
    const row = viewport.querySelectorAll<HTMLElement>(".ah-feed > li")[index];
    if (!row) return;
    shown.current = jump.serial;
    const target =
      row.querySelector<HTMLElement>(
        `[data-reply-entry="${CSS.escape(jump.entryKey)}"]`,
      ) ?? row;
    const height = target.getBoundingClientRect().height;
    const offset = Math.max(16, (viewport.clientHeight - height) / 2);
    hold({ key: jump.entryKey, offset });
    for (const old of viewport.querySelectorAll(".ah-search-target"))
      old.classList.remove("ah-search-target");
    target.classList.add("ah-search-target");
    markTerms(target, jump.terms);
    setState("shown");
  }, [jump, entries, next, older, feed, hold]);
  // The marks belong to this jump only.
  useEffect(
    () => () => {
      markTerms(undefined, []);
      for (const old of document.querySelectorAll(".ah-search-target"))
        old.classList.remove("ah-search-target");
    },
    [],
  );
  useEffect(() => {
    if (jump) return;
    markTerms(undefined, []);
    for (const old of document.querySelectorAll(".ah-search-target"))
      old.classList.remove("ah-search-target");
  }, [jump]);
  return state;
}

/** Marks every word containing a term inside root with the CSS Custom
 * Highlight API, so the production message components stay untouched. */
export function markTerms(root: Element | undefined, terms: string[]) {
  const registry = (
    globalThis.CSS as unknown as { highlights?: Map<string, unknown> }
  )?.highlights;
  const H = (
    globalThis as unknown as { Highlight?: new (...r: Range[]) => unknown }
  ).Highlight;
  if (!registry || !H) return;
  registry.delete("ah-search-hit");
  if (!root || !terms.length) return;
  const ranges: Range[] = [];
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const s = n.textContent ?? "";
    for (const m of s.matchAll(/\p{L}[\p{L}\p{N}'’-]*|\p{N}+/gu)) {
      const lower = m[0].toLocaleLowerCase();
      if (!terms.some((t) => lower.includes(t))) continue;
      const r = new Range();
      r.setStart(n, m.index ?? 0);
      r.setEnd(n, (m.index ?? 0) + m[0].length);
      ranges.push(r);
    }
  }
  registry.set("ah-search-hit", new H(...ranges));
}

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);
export const switcherKey = isMac ? "⌘K" : "Ctrl+K";

/** The band above the field in a conversation opened from a hit. */
export function SearchJumpBand({
  jump,
  state,
}: {
  jump: SearchJump | undefined;
  state: JumpState | undefined;
}) {
  const t = useText(switcherText);
  if (!jump) return null;
  return (
    <SearchBand
      text={
        state === "missing"
          ? t.jumpMissing(jump.query)
          : state === "searching"
            ? t.jumpSearching(jump.query)
            : t.jump(
                jump.query,
                t.who[jump.role],
                t.ago(daysAgo(Date.parse(jump.at), Date.now())),
              )
      }
      keyHint={t.jumpBack(switcherKey)}
      closeLabel={t.close}
      onClose={() => clearSearchJump(jump.agentId)}
    />
  );
}
