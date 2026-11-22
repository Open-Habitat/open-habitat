import {
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useText } from "../i18n";
import { navigationText } from "../text/navigation";
import { LinkRow } from "./ControlElements";
import controls from "./Controls.module.css";
import { Icon, type IconName } from "./Icon";
import {
  ADAPTIVE_RAIL,
  type Alloc,
  allocate,
  type Consts,
  type Step,
} from "./railAllocation";
import { RAIL_BEYOND_CUE } from "./railRegions";
import { SearchDoor } from "./Switcher";
import "./AdaptiveRail.css";

// The adaptive rail (adaptive-rail, experimental; rail-space round 3, Jari
// 22.11.2026: C Leveämpi with B's logic). The places at the top grow from an
// icon row to one row of tiles to a row each as the rail gets taller, and
// the conversations and Työtilat get the heights railAllocation.ts gives
// them. This file draws the places, measures the rail into the rule's
// constants and says what Työtilat's edges hide.

export type RailPlaceId = "home" | "shares" | "browser" | "resources";

/** The places' icons, in one place: an icon round for them waits for Jari,
 * and its choice is a change here. */
export const PLACE_ICONS: Record<RailPlaceId | "search", IconName> = {
  home: "home",
  shares: "globe",
  browser: "browser",
  resources: "shield",
  search: "search",
};

/** One place at the top of the adaptive rail, as the app knows it now. */
export type RailPlace = {
  id: RailPlaceId;
  /** The test id the place has in the fixed rail, kept so the rest of the
   * product finds it in either. */
  testId: string;
  label: string;
  /** A page of its own: the place is a link. */
  href?: string;
  onNavigate?: (href: string) => void;
  /** Otherwise a press does this (Oma selain opens the live view). */
  onOpen?: () => void;
  current?: boolean;
  /** A number beside the name (Tuotokset's public addresses), formatted. */
  count?: string;
  /** Oma selain's state (data-state), its short words and its sentence. */
  state?: string;
  stateText?: ReactNode;
  said?: string;
};
export type RailSearch = {
  label: string;
  keyHint: string;
  onOpen: () => void;
};

/** A state worth a mark on the place in the icon and tile steps: the agent
 * works in the browser, a window waits for the person, or they drive. */
const marked = (state?: string) =>
  state === "agent" || state === "ask" || state === "person";

/** The places in one step. `measure` draws a copy only to be measured:
 * without test ids or handlers, under an inert container. */
export function RailPlaces({
  step,
  places,
  search,
  measure = false,
}: {
  step: Step;
  places: readonly RailPlace[];
  search: RailSearch;
  measure?: boolean;
}) {
  const t = useText(navigationText);
  const tid = (id: string) => (measure ? undefined : id);
  // Each step draws its own controls, so a step change would drop the
  // keyboard's place: remember the focused place as the step changes and
  // give focus back to the same place once the new step is drawn.
  const root = useRef<HTMLDivElement>(null);
  const drawn = useRef(step);
  const refocus = useRef<string | undefined>(undefined);
  if (drawn.current !== step && !measure) {
    const active =
      typeof document === "undefined" ? null : document.activeElement;
    refocus.current =
      active instanceof HTMLElement && root.current?.contains(active)
        ? (active.dataset.testid ?? undefined)
        : undefined;
  }
  drawn.current = step;
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the step has changed.
  useLayoutEffect(() => {
    const id = refocus.current;
    refocus.current = undefined;
    if (!id || root.current?.contains(document.activeElement)) return;
    root.current
      ?.querySelector<HTMLElement>(`[data-testid="${id}"]`)
      ?.focus({ preventScroll: true });
  }, [step]);
  const name = (p: RailPlace) =>
    p.said ?? (p.count ? `${p.label} ${p.count}` : p.label);
  const mark = (p: RailPlace) => (
    <span className="ah-place-mark">
      <Icon name={PLACE_ICONS[p.id]} />
      {marked(p.state) ? (
        <span className="ah-place-dot" data-state={p.state} />
      ) : null}
      {step < 2 && p.count ? (
        <span className="ah-place-count">{p.count}</span>
      ) : null}
    </span>
  );
  const body = (p: RailPlace) =>
    step === 0 ? (
      mark(p)
    ) : step === 1 ? (
      <>
        {mark(p)}
        <span className="ah-place-label">{p.label}</span>
      </>
    ) : (
      <>
        <Icon name={PLACE_ICONS[p.id]} />
        <span className="ah-rail-home-label">{p.label}</span>
        {p.count ? (
          <span className="ah-rail-place-count">{p.count}</span>
        ) : null}
        {p.stateText !== undefined ? (
          <span
            className="sb-rail-state"
            data-testid={tid("browser-rail-state")}
            aria-hidden="true"
          >
            {p.stateText}
          </span>
        ) : null}
      </>
    );
  const kind = step === 0 ? "ah-place-icon" : step === 1 ? "ah-place-tile" : "";
  const place = (p: RailPlace) => {
    // The icon and tile steps name the place for touch and screen readers;
    // the rows step reads its words, and Oma selain its sentence.
    const label = step < 2 || p.said ? name(p) : undefined;
    const className = `ah-rail-home ah-place ${kind}`;
    const item = p.href ? (
      <LinkRow
        href={p.href}
        onNavigate={measure ? undefined : p.onNavigate}
        data-testid={tid(p.testId)}
        kind="home"
        current={p.current}
        className={className}
        aria-label={label}
        title={step < 2 ? name(p) : undefined}
      >
        {body(p)}
      </LinkRow>
    ) : (
      <button
        type="button"
        className={`${controls.link} ${controls.home} ${className} sb-rail-item`}
        data-testid={tid(p.testId)}
        data-state={p.state}
        aria-label={label}
        title={step < 2 ? name(p) : undefined}
        onClick={measure ? undefined : p.onOpen}
      >
        {body(p)}
      </button>
    );
    return step === 2 ? (
      <div key={p.id} className="ah-rail-home-row">
        {item}
      </div>
    ) : (
      <span key={p.id} className="ah-place-slot">
        {item}
      </span>
    );
  };
  if (step === 0)
    return (
      // biome-ignore lint/a11y/useSemanticElements: a group of links and buttons, not a form fieldset.
      <div
        ref={root}
        className="ah-places"
        data-step={0}
        data-testid={tid("rail-places")}
        role="group"
        aria-label={measure ? undefined : t.places}
      >
        <div className="ah-places-icons">
          {places.map(place)}
          <span className="ah-place-slot">
            <button
              type="button"
              className={`${controls.link} ${controls.home} ah-rail-home ah-place ah-place-icon`}
              data-testid={tid("search-door")}
              aria-label={`${search.label} (${search.keyHint})`}
              title={`${search.label} (${search.keyHint})`}
              aria-keyshortcuts="Meta+K Control+K /"
              onClick={measure ? undefined : search.onOpen}
            >
              <span className="ah-place-mark">
                <Icon name={PLACE_ICONS.search} />
              </span>
            </button>
          </span>
        </div>
      </div>
    );
  return (
    // biome-ignore lint/a11y/useSemanticElements: a group of links and buttons, not a form fieldset.
    <div
      ref={root}
      className="ah-places"
      data-step={step}
      data-testid={tid("rail-places")}
      role="group"
      aria-label={measure ? undefined : t.places}
    >
      {step === 1 ? (
        <div className="ah-places-tiles">{places.map(place)}</div>
      ) : (
        places.map(place)
      )}
      <SearchDoor
        label={search.label}
        keyHint={search.keyHint}
        onOpen={measure ? () => {} : search.onOpen}
        testId={measure ? null : "search-door"}
      />
    </div>
  );
}

/** Every step out of sight, so the rule knows each one's height before
 * choosing. */
export function RailPlacesMeasure(props: {
  places: readonly RailPlace[];
  search: RailSearch;
}) {
  return (
    <div className="ah-places-measure" aria-hidden="true" inert>
      {([0, 1, 2] as const).map((s) => (
        <RailPlaces key={s} step={s} {...props} measure />
      ))}
    </div>
  );
}

/** Työtilat's edge chip, as the conversations' (railRegions.tsx): it covers
 * the edge row while the list scrolls, so the rule pays for it. */
export const WS_EDGE_CUE = 22;

const px = (v: string) => Number.parseFloat(v) || 0;
const sum = (els: Element[]) =>
  els.reduce((s, el) => s + (el as HTMLElement).offsetHeight, 0);
const CONV_ROW = 'li[data-testid^="agent-item-"]';
const WS_ROW = ".ah-workspace-list > li";

/** From one row to the next in the same list: a row and its gap. */
function pitchOf(rows: HTMLElement[], gap: number) {
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].parentElement !== rows[i - 1].parentElement) continue;
    const d =
      rows[i].getBoundingClientRect().top -
      rows[i - 1].getBoundingClientRect().top;
    if (d > 0) return d;
  }
  return (rows[0]?.getBoundingClientRect().height || 30) + gap;
}

/** The rule's constants, read from the rail as drawn. None of them depends
 * on the heights the rule sets: the regions fill the rail, the sections
 * keep their own height inside the conversations' scroller, and Työtilat's
 * scroller takes what its section leaves. */
export function measureRail(
  nav: HTMLElement,
): { consts: Consts; height: number } | undefined {
  const head = nav.querySelector<HTMLElement>(".ah-rail-head > .ah-places");
  const regions = nav.querySelector<HTMLElement>(".ah-rail-regions");
  const convs = regions?.querySelector<HTMLElement>(".ah-rail-convs");
  const steps = [
    ...nav.querySelectorAll<HTMLElement>(".ah-places-measure > .ah-places"),
  ];
  if (!head || !regions || !convs || steps.length !== 3) return undefined;
  const ws = regions.querySelector<HTMLElement>(":scope > .ah-rail-workspaces");
  const scroll = ws?.querySelector<HTMLElement>(".ah-rail-ws-scroll");
  // The regions' room for the two lists: what is left of them once their
  // padding, gaps and anything else in them (one workspace's mention) are
  // paid.
  const rs = getComputedStyle(regions);
  const kids = [...regions.children] as HTMLElement[];
  const others = kids.filter((k) => k !== convs && k !== ws);
  const inner =
    regions.clientHeight -
    px(rs.paddingTop) -
    px(rs.paddingBottom) -
    Math.max(0, kids.length - 1) * px(rs.rowGap) -
    sum(others);
  const height = nav.clientHeight;
  // The conversations: the sections from the first's top to the last's
  // bottom, margins included, whatever the scroll, less their rows.
  const sections = [...convs.querySelectorAll<HTMLElement>(":scope > section")];
  const convRows = [...convs.querySelectorAll<HTMLElement>(CONV_ROW)];
  const quietRows = [
    ...convs.querySelectorAll<HTMLElement>(
      `[data-testid="rail-quiet"] ${CONV_ROW}`,
    ),
  ];
  const cs = getComputedStyle(convs);
  const firstSection = sections[0];
  const lastSection = sections[sections.length - 1];
  const span =
    firstSection && lastSection
      ? lastSection.getBoundingClientRect().bottom +
        px(getComputedStyle(lastSection).marginBottom) -
        firstSection.getBoundingClientRect().top +
        px(getComputedStyle(firstSection).marginTop)
      : 0;
  const convPitch = pitchOf(quietRows.length > 1 ? quietRows : convRows, 1);
  const convOver =
    span +
    px(cs.paddingTop) +
    px(cs.paddingBottom) -
    convRows.length * convPitch;
  // Työtilat: its heading and padding stay; inside the scroller, everything
  // but the rows.
  let wsConsts = { over: 0, pitch: 30, n: 0, cue: WS_EDGE_CUE };
  if (ws && scroll) {
    const rows = [...ws.querySelectorAll<HTMLElement>(WS_ROW)];
    const ss = getComputedStyle(scroll);
    const pitch = pitchOf(rows, 2);
    const inside =
      sum([...scroll.children]) +
      px(ss.paddingTop) +
      px(ss.paddingBottom) +
      Math.max(0, scroll.children.length - 1) * px(ss.rowGap);
    const over =
      ws.offsetHeight - scroll.offsetHeight + inside - rows.length * pitch;
    wsConsts = {
      over: Math.max(0, over),
      pitch,
      n: rows.length,
      cue: WS_EDGE_CUE,
    };
  }
  return {
    height,
    consts: {
      fixed: height - inner - head.offsetHeight,
      head: steps.map((s) => s.offsetHeight) as [number, number, number],
      conv: {
        over: Math.max(0, convOver),
        pitch: convPitch,
        n: convRows.length,
        cue: RAIL_BEYOND_CUE,
      },
      ws: wsConsts,
    },
  };
}

/** Measures the rail whenever it or its contents change size and runs the
 * rule; undefined while off or before the first measurement. */
export function useAdaptiveRail(
  nav: RefObject<HTMLElement | null>,
  enabled: boolean,
): Alloc | undefined {
  const [alloc, setAlloc] = useState<Alloc>();
  const last = useRef("");
  const frame = useRef(0);
  const observer = useRef<ResizeObserver | undefined>(undefined);
  const run = useRef(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const el = nav.current;
      const m = el && measureRail(el);
      if (!m) return;
      const next = allocate(ADAPTIVE_RAIL, m.consts, m.height);
      const key = JSON.stringify(next);
      if (key === last.current) return;
      last.current = key;
      setAlloc(next);
    });
  }).current;
  // Every render: rows come and go with the host's news, and a new element
  // (a section, a clone row) needs watching.
  useLayoutEffect(() => {
    if (!enabled) return;
    const el = nav.current;
    if (el && observer.current)
      for (const target of [
        el,
        ...el.querySelectorAll(
          ".ah-rail-regions, .ah-rail-convs > section, .ah-rail-ws-scroll > *, .ah-places-measure > *",
        ),
      ])
        observer.current.observe(target);
    run();
  });
  useEffect(() => {
    if (!enabled) {
      last.current = "";
      setAlloc(undefined);
      return;
    }
    // Absent only outside a browser (jsdom).
    observer.current =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(run);
    run();
    return () => {
      observer.current?.disconnect();
      observer.current = undefined;
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [enabled, run]);
  return enabled ? alloc : undefined;
}

/** Työtilat's edges while its list scrolls: how many workspaces lie past
 * each, as the conversations' chips say; a press pages the list. */
export function WorkspaceEdgeChips({
  list,
  watch,
}: {
  list: RefObject<HTMLElement | null>;
  /** Anything whose change can move the rows (the region's height). */
  watch: unknown;
}) {
  const t = useText(navigationText);
  const [edge, setEdge] = useState({ above: 0, below: 0, top: 0 });
  // biome-ignore lint/correctness/useExhaustiveDependencies: recount when the region's height changes.
  useEffect(() => {
    const scroll = list.current;
    if (!scroll) return;
    const count = () => {
      const box = scroll.getBoundingClientRect();
      const rows = [...scroll.querySelectorAll<HTMLElement>(WS_ROW)].map((li) =>
        li.getBoundingClientRect(),
      );
      const scrolls = scroll.scrollHeight > scroll.clientHeight + 1;
      const next = {
        above: scrolls
          ? rows.filter(
              (r) =>
                r.bottom - 6 <=
                box.top + (scroll.scrollTop > 1 ? WS_EDGE_CUE : 0),
            ).length
          : 0,
        below: scrolls
          ? rows.filter((r) => r.top + 6 >= box.bottom - WS_EDGE_CUE).length
          : 0,
        top: scroll.offsetTop,
      };
      setEdge((e) =>
        e.above === next.above && e.below === next.below && e.top === next.top
          ? e
          : next,
      );
    };
    count();
    scroll.addEventListener("scroll", count, { passive: true });
    const o =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(count);
    o?.observe(scroll);
    for (const kid of scroll.children) o?.observe(kid);
    return () => {
      scroll.removeEventListener("scroll", count);
      o?.disconnect();
    };
  }, [list, watch]);
  const page = (dir: 1 | -1) => {
    const scroll = list.current;
    if (scroll)
      scroll.scrollBy({
        top: dir * Math.max(40, scroll.clientHeight - 2 * WS_EDGE_CUE),
      });
  };
  return (
    <>
      {edge.above ? (
        <button
          type="button"
          className="ah-rail-ws-edge"
          data-edge="above"
          data-testid="rail-ws-above"
          style={{ top: edge.top }}
          aria-label={t.wsBeyondPage(edge.above, "above")}
          onClick={() => page(-1)}
        >
          <span aria-hidden="true">↑</span> {t.wsBeyond(edge.above)}
        </button>
      ) : null}
      {edge.below ? (
        <button
          type="button"
          className="ah-rail-ws-edge"
          data-edge="below"
          data-testid="rail-ws-below"
          aria-label={t.wsBeyondPage(edge.below, "below")}
          onClick={() => page(1)}
        >
          <span aria-hidden="true">↓</span> {t.wsBeyond(edge.below)}
        </button>
      ) : null}
    </>
  );
}
