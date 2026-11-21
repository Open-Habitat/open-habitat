import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useText } from "../i18n";
import { navigationText } from "../text/navigation";
import { quietRailText } from "../text/quietRail";

// The wide rail's scrolling regions (rail-scroll-region, direction 1
// Työtilat, Jari 21.11.2026). The rail itself never scrolls: the
// conversation sections share one region at the top, and Työtilat's list
// scrolls in its own below them, so browsing the workspaces never moves a
// conversation out of sight. When the conversations do not fit either,
// their region scrolls, and its edges name the sections with rows out of
// sight ("↑ Sinun vuorosi 4", "↓ Hiljaiset 30").

export type RailEdge = "above" | "below";
export type RailSectionKey = "yours" | "running" | "quiet";
export type RailBeyond = Record<
  RailEdge,
  Partial<Record<RailSectionKey, number>>
>;
const SECTIONS: Record<RailSectionKey, string> = {
  yours: "rail-yours",
  running: "rail-running",
  quiet: "rail-quiet",
};
/** The edge chips' height (components.css .ah-rail-beyond). They are
 * counted against it whether they show or not, so their coming and going
 * never changes what they count. */
const CUE = 26;
/** How far the conversations must fit under the room before a Hiljaiset
 * that folded itself opens again: a few pixels of change must not fold and
 * open it in turn. */
const SLACK = 24;

const NONE: RailBeyond = { above: {}, below: {} };
const ROW = 'li[data-testid^="agent-item-"]';

/** Marks a region with what lies past its edges, so the CSS shades only an
 * edge that hides something. */
function markEdges(el: HTMLElement) {
  const scrolls = el.scrollHeight > el.clientHeight + 1;
  el.toggleAttribute("data-scrolls", scrolls);
  el.toggleAttribute("data-above", scrolls && el.scrollTop > 1);
  el.toggleAttribute(
    "data-below",
    scrolls && el.scrollTop + el.clientHeight < el.scrollHeight - 1,
  );
}

/** The sections with rows wholly past one edge of the region, and how many.
 * A folded Hiljaiset whose heading is out of sight says all its rows. */
function rowsBeyond(region: HTMLElement, edge: RailEdge) {
  const out: Partial<Record<RailSectionKey, number>> = {};
  if (!region.hasAttribute("data-scrolls")) return out;
  const box = region.getBoundingClientRect();
  const line = edge === "below" ? box.bottom - CUE : box.top + CUE;
  const past = (r: DOMRect) =>
    edge === "below" ? r.top + 8 >= line : r.bottom - 8 <= line;
  for (const key of Object.keys(SECTIONS) as RailSectionKey[]) {
    const section = region.querySelector<HTMLElement>(
      `[data-testid="${SECTIONS[key]}"]`,
    );
    if (!section) continue;
    const head = section.querySelector("h2");
    let n = [...section.querySelectorAll<HTMLElement>(ROW)].filter((li) =>
      past(li.getBoundingClientRect()),
    ).length;
    if (
      section.hasAttribute("data-folded") &&
      head &&
      past(head.getBoundingClientRect())
    )
      n = Number(section.dataset.rows ?? n);
    if (n) out[key] = n;
  }
  return out;
}

/** Brings a row wholly into its region's sight, clear of the edge chips
 * (the region's scroll padding), moving nothing else: scrollIntoView
 * would scroll every scrolling ancestor, the page too. */
function revealIn(region: HTMLElement, el: HTMLElement) {
  const style = getComputedStyle(region);
  const top = Number.parseFloat(style.scrollPaddingTop) || 0;
  const bottom = Number.parseFloat(style.scrollPaddingBottom) || 0;
  const box = region.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (r.top < box.top + top) region.scrollTop -= box.top + top - r.top;
  else if (r.bottom > box.bottom - bottom)
    region.scrollTop += Math.min(
      r.bottom - (box.bottom - bottom),
      r.top - (box.top + top),
    );
}

/** A conversation row's height as drawn, a Hiljaiset row first; none
 * while no row shows (Hiljaiset folded and nothing else listed). */
function rowHeight(region: HTMLElement) {
  const quiet = region.querySelector(`[data-testid="${SECTIONS.quiet}"]`);
  const row =
    quiet?.querySelector<HTMLElement>(ROW) ??
    region.querySelector<HTMLElement>(ROW);
  return row?.getBoundingClientRect().height || undefined;
}

/** Whether the conversations with Hiljaiset open would need more room than
 * the rail can give them above Työtilat's floor. Worked out the same way
 * folded or open, so folding never changes the answer by itself: a folded
 * Hiljaiset counts its rows at the height they had when last drawn, since
 * a guess from the stylesheet can differ by more than SLACK and fold and
 * open it in turn without end. */
function crowdedNow(
  content: HTMLElement,
  region: HTMLElement,
  quietRows: number,
  was: boolean,
  drawn: number | undefined,
) {
  const quiet = region.querySelector<HTMLElement>(
    `[data-testid="${SECTIONS.quiet}"]`,
  );
  const head = quiet?.querySelector<HTMLElement>("h2");
  if (!quiet || !head || !quietRows) return false;
  const row =
    drawn ??
    (Number.parseFloat(
      getComputedStyle(region).getPropertyValue("--ah-conversation-row-height"),
    ) ||
      30);
  const need =
    region.scrollHeight -
    (quiet.offsetHeight - head.offsetHeight) +
    quietRows * (row + 1);
  // The room: the region's own height, plus what the rail leaves over
  // below it (Työtilat above its floor, or empty space).
  const style = getComputedStyle(content);
  let used =
    (Number.parseFloat(style.paddingTop) || 0) +
    (Number.parseFloat(style.paddingBottom) || 0);
  const kids = [...content.children] as HTMLElement[];
  for (const kid of kids) used += kid.offsetHeight;
  used += Math.max(0, kids.length - 1) * (Number.parseFloat(style.rowGap) || 0);
  let slack = Math.max(0, content.clientHeight - used);
  const ws = content.querySelector<HTMLElement>(".ah-rail-workspaces");
  if (ws)
    slack += Math.max(
      0,
      ws.offsetHeight -
        (Number.parseFloat(getComputedStyle(ws).minHeight) || 0),
    );
  const room = region.clientHeight + slack;
  return was ? need > room - SLACK : need > room;
}

const same = (a: RailBeyond, b: RailBeyond) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Keeps the wide rail's regions honest as rows, the window and the scroll
 * change: shades the edges that hide rows, names the sections out of sight,
 * brings the open conversation (and the open workspace) into sight in its
 * own region when it changes or the window does, and says whether the rail
 * is crowded. Off in the narrow rail, which keeps its single scroll.
 */
export function useRailRegions({
  content,
  region,
  list,
  enabled,
  quietRows,
  onCrowded,
}: {
  content: RefObject<HTMLElement | null>;
  region: RefObject<HTMLElement | null>;
  list: RefObject<HTMLElement | null>;
  enabled: boolean;
  quietRows: number;
  onCrowded?: (crowded: boolean) => void;
}) {
  const [beyond, setBeyond] = useState<RailBeyond>(NONE);
  const live = useRef<{
    beyond: RailBeyond;
    quietRows: number;
    onCrowded?: (crowded: boolean) => void;
    crowded: boolean;
    row?: number;
  }>({ beyond, quietRows, onCrowded, crowded: false });
  live.current.beyond = beyond;
  live.current.quietRows = quietRows;
  live.current.onCrowded = onCrowded;
  const shown = useRef<{ row?: Element | null; ws?: Element | null }>({});

  const update = useRef((resized: boolean) => {
    const c = content.current;
    const r = region.current;
    const l = list.current;
    if (l) markEdges(l);
    if (!c || !r) {
      if (!same(live.current.beyond, NONE)) setBeyond(NONE);
      return;
    }
    markEdges(r);
    // The open rows, revealed when they change and when the room does; the
    // person's own scrolling is otherwise left alone.
    const row = r
      .querySelector('[aria-current="page"]')
      ?.closest<HTMLElement>(ROW);
    if (row && (resized || row !== shown.current.row)) revealIn(r, row);
    shown.current.row = row;
    const ws = l?.querySelector<HTMLElement>(
      ".ah-workspace-row[data-selected]",
    );
    if (l && ws && (resized || ws !== shown.current.ws)) revealIn(l, ws);
    shown.current.ws = ws;
    if (row || ws) {
      markEdges(r);
      if (l) markEdges(l);
    }
    const next = {
      above: rowsBeyond(r, "above"),
      below: rowsBeyond(r, "below"),
    };
    if (!same(next, live.current.beyond)) setBeyond(next);
    live.current.row = rowHeight(r) ?? live.current.row;
    const report = live.current.onCrowded;
    if (report) {
      const crowded = crowdedNow(
        c,
        r,
        live.current.quietRows,
        live.current.crowded,
        live.current.row,
      );
      if (crowded !== live.current.crowded) {
        live.current.crowded = crowded;
        report(crowded);
      }
    }
  }).current;

  // Every render: rows come and go with the host's news and the route.
  useLayoutEffect(() => {
    if (enabled) update(false);
  });
  useEffect(() => {
    if (!enabled) {
      setBeyond(NONE);
      return;
    }
    let frame = 0;
    let resized = false;
    const later = (size: boolean) => {
      resized ||= size;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const size = resized;
        resized = false;
        update(size);
      });
    };
    const onScroll = () => later(false);
    // Absent only outside a browser (jsdom); the scroll still updates.
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => later(true));
    for (const el of [content.current, region.current, list.current])
      if (el) {
        observer?.observe(el);
        el.addEventListener("scroll", onScroll, { passive: true });
      }
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      for (const el of [content.current, region.current, list.current])
        el?.removeEventListener("scroll", onScroll);
    };
  }, [enabled, content, region, list, update]);

  /** Scrolls the region to a section's heading, clear of the top chip. */
  const jump = (key: RailSectionKey) => {
    const r = region.current;
    const section = r?.querySelector<HTMLElement>(
      `[data-testid="${SECTIONS[key]}"]`,
    );
    if (!r || !section) return;
    const pad = Number.parseFloat(getComputedStyle(r).scrollPaddingTop) || 0;
    r.scrollTop +=
      section.getBoundingClientRect().top - r.getBoundingClientRect().top - pad;
    // The chip may go with the scroll; keep the keyboard in the section.
    section
      .querySelector<HTMLElement>("a[href], button:not(:disabled)")
      ?.focus({ preventScroll: true });
  };
  return { beyond, jump };
}

/** One edge's chips: ↑ or ↓, then each section with rows past that edge
 * and how many. A chip scrolls to its section. They overlay the edge row,
 * so their coming and going never moves the rows. */
export function RailBeyondChips({
  edge,
  rows,
  onJump,
}: {
  edge: RailEdge;
  rows: Partial<Record<RailSectionKey, number>>;
  onJump: (key: RailSectionKey) => void;
}) {
  const t = useText(navigationText);
  const quiet = useText(quietRailText);
  const names: Record<RailSectionKey, string> = {
    yours: t.yourTurn,
    running: t.running,
    quiet: quiet.title,
  };
  const keys = (Object.keys(SECTIONS) as RailSectionKey[]).filter(
    (k) => rows[k],
  );
  if (!keys.length) return null;
  return (
    <div
      className="ah-rail-beyond"
      data-edge={edge}
      data-testid={`rail-beyond-${edge}`}
    >
      <span aria-hidden="true">{edge === "below" ? "↓" : "↑"}</span>
      <span className="ah-visually-hidden">{t.beyond[edge]}</span>
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          className="ah-rail-beyond-chip"
          data-testid={`rail-beyond-${edge}-${key}`}
          aria-label={t.beyondJump(names[key], rows[key] ?? 0, edge)}
          onClick={() => onJump(key)}
        >
          {names[key]} <b>{rows[key]}</b>
        </button>
      ))}
    </div>
  );
}
