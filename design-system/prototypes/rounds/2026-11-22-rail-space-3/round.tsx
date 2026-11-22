import React, { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import type { Workspace } from "../../../../web/src/app/snapshot";
import type { BrowserStatus, BrowserSummary } from "../../../../web/src/app/serverBrowser";
import { AccountShelf } from "../../../../web/src/components/Account";
import { AssistantMessage, ConversationTimeline, UserMessage } from "../../../../web/src/components/Conversation";
import { ConversationFrame, ConversationStream } from "../../../../web/src/components/ConversationFrame";
import { LinkRow } from "../../../../web/src/components/ControlElements";
import { Icon } from "../../../../web/src/components/Icon";
import { Markdown } from "../../../../web/src/components/Markdown";
import {
  AgentHeader,
  type AgentNavModel,
  AppShell,
  NowSections,
  WorkspaceNavRow,
  WorkspaceRail,
} from "../../../../web/src/components/Navigation";
import { RefreshIconButton } from "../../../../web/src/components/Primitives";
import { QuietSection } from "../../../../web/src/components/QuietSection";
import { BrowserRailRow } from "../../../../web/src/components/ServerBrowser";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { SearchDoor } from "../../../../web/src/components/Switcher";
import { WorkspaceActions } from "../../../../web/src/components/WorkspaceActions";
import type { WorkspaceIconModel } from "../../../../web/src/components/WorkspaceIcon";
import { Composer } from "../../../../web/src/components/composer/Composer";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { agentResourcesText } from "../../../../web/src/text/agentResources";
import { sharesText } from "../../../../web/src/text/shares";
import { statusText } from "../../../../web/src/text/status";
import { switcherText } from "../../../../web/src/text/switcher";
import "../../../../web/src/components/components.css";
import { type Alloc, type Consts, type Params, type Step, allocate, stepChanges, value } from "./model";
import { DEFAULTS, ROWS, TEXT, type Text, TITLES, WIDE, WORKSPACES } from "./text";
import "./round.css";

// rail-space-small-screens, round 3 (Jari 22.11.2026 on round 2): C
// Suhteessa, refined with utility thresholds. Each list has a lower bound
// and an "enough" bound; room goes to both minimums, then both "enough"s,
// then the place buttons (icons → tiles → rows), then both lists in a
// ratio. model.ts holds the rule; this page measures the rail, runs it, and
// shows it: each list's rows against its bounds, the marginal-value curves
// and where every height lands, with the bounds editable in a drawer. The
// directions differ in the curves' shape (A knees, B soft) and in the
// rail's width (C: A's rule in a rail about 20 % wider, whose tiles fit one
// row and whose conversation rows name their workspace, as in the Jono
// round). Direction 4 is today's rail. Round 2's head, icons and worlds
// carry over.
setPersonalLanguage("fi");

const params = new URLSearchParams(location.search);
const bare = params.has("bare");
if (bare) document.documentElement.toggleAttribute("data-bare", true);

// ---------- The synthetic world (as in rounds 1 and 2) ----------

type State = "reply" | "question" | "working" | "idle";
type Conv = { id: string; n: number; ws: string; state: State; age: number; worktree?: boolean };
type WorldKind = "ordinary" | "like" | "crowded";
type World = { convs: Conv[]; workspaces: string[] };
const EMOJI = ["🗺️", "📒", "🏠", "🧾", "📦", "🛒", "📰", "🧪", "📊", "🔧", "🎨", "📷", "🗓️", "🍲"];
const SIZES: Record<WorldKind, { yours: number; running: number; quiet: number; ws: number }> = {
  ordinary: { yours: 4, running: 2, quiet: 12, ws: 18 },
  like: { yours: 3, running: 0, quiet: 5, ws: 6 },
  crowded: { yours: 6, running: 4, quiet: 30, ws: 40 },
};
/** Past this many workspaces Työtilat shows its filter field (round 1, A). */
const FILTER_FROM = 12;

function world(kind: WorldKind): World {
  const s = SIZES[kind];
  const workspaces = Array.from({ length: s.ws }, (_, i) => WORKSPACES[Math.floor((i * WORKSPACES.length) / s.ws)]);
  const convs: Conv[] = [];
  let n = 0;
  const add = (count: number, state: State | "yours") => {
    for (let i = 0; i < count; i++, n++)
      convs.push({
        id: `c${n}`,
        n,
        ws: workspaces[(n * 7 + 3) % workspaces.length],
        state: state === "yours" ? (n % 2 ? "question" : "reply") : state,
        age: state === "working" ? 1 + n : n * n * 3 + 5,
        worktree: [7, 9, 13, 20, 27].includes(n),
      });
  };
  add(s.yours, "yours");
  add(s.running, "working");
  add(s.quiet, "idle");
  return { convs, workspaces };
}
const NOW0 = Date.now();
const hrefOf = (c: Conv) => `/workspaces/${c.ws}?conversation=${c.id}`;

function iconOf(name: string): WorkspaceIconModel {
  const i = WORKSPACES.indexOf(name);
  const letters = name.split("-").slice(0, 2).map((p) => p[0]).join("").toLocaleUpperCase("fi");
  return i % 3 === 0
    ? { name, glyph: { letters, hue: (i * 47) % 360 }, show: { kind: "emoji", value: EMOJI[i % EMOJI.length] }, source: "config", where: ".open-habitat.yaml" }
    : { name, glyph: { letters, hue: (i * 47) % 360 }, show: { kind: "glyph" }, source: "derived" };
}

type Words = ReturnType<typeof useText<typeof statusText>>["rail"];
/** named: the wide direction's rows say their workspace by name, as the
 * Jono round's did, with production's own name tag. Sinun vuorosi and
 * Käynnissä keep their icons (without them production groups the rows
 * under workspace headings, which costs rows); Hiljaiset shows the tag
 * only without icons, so there the name replaces the icon. */
function model(c: Conv, open: string, lang: "fi" | "en", s: Words, named: boolean): AgentNavModel {
  const label = c.state === "working" ? s.working : c.state === "reply" ? s.newReply : c.state === "question" ? s.asks : "";
  return {
    agentId: c.id,
    href: hrefOf(c),
    title: TITLES[c.n % TITLES.length][lang === "fi" ? 0 : 1],
    workspaceId: c.ws,
    workspaceName: c.ws,
    workspaceIcon: named && c.state === "idle" ? undefined : iconOf(c.ws),
    ...(named ? { workspaceTag: true } : {}),
    changedAt: NOW0 - c.age * 60000,
    activity: c.state === "working" ? "working" : "waiting",
    activityLabel: label,
    attentionLabel: c.state === "reply" ? s.newReply : undefined,
    question: c.state === "question",
    controlLabel: "",
    detail: [c.ws, label].filter(Boolean).join(" · "),
    selected: c.id === open,
    worktree: c.worktree ? { merged: false, work: { text: lang === "fi" ? "2 muutosta" : "2 changes", tone: "work" } } : undefined,
  } as AgentNavModel;
}

// ---------- Oma selain's state ----------

type BrowserKind = "idle" | "agent" | "ask";
function summaryOf(kind: BrowserKind, lang: "fi" | "en"): BrowserSummary {
  const window = { id: "w1", title: lang === "fi" ? "Kirjanpito" : "Ledger", origin: "https://kirjanpito.example", agent: true };
  if (kind === "ask") return { kind: "ask", window, text: lang === "fi" ? "Vahvista kirjautuminen" : "Confirm the sign-in" } as BrowserSummary;
  if (kind === "agent") return { kind: "agent", window } as BrowserSummary;
  return { kind: "idle" } as BrowserSummary;
}
void (null as unknown as BrowserStatus);

// ---------- Toast: where a press would lead ----------

let toast: (s: string) => void = () => {};
function Toast() {
  const [text, setText] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  toast = (s) => {
    setText(s);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(""), 1800);
  };
  return text ? <div className="rsp-toast" role="status" data-testid="toast">{text}</div> : null;
}

// ---------- Round 2's icons (an icon round runs in parallel) ----------

type DestIcon = "home" | "outbox" | "browser" | "shield" | "search";
function RIcon({ name }: { name: DestIcon }) {
  if (name === "home" || name === "shield" || name === "search") return <Icon name={name} />;
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {name === "outbox" ? (
        <>
          <path d="M4 13h4l1.5 3h5l1.5-3h4v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
          <path d="M12 3.5V12M8.5 7 12 3.5 15.5 7" />
        </>
      ) : (
        <>
          <rect x="3" y="4.5" width="18" height="15" rx="2" />
          <path d="M3 9h18M6.5 6.8h.01M9.2 6.8h.01" />
        </>
      )}
    </svg>
  );
}

// ---------- The adaptive head: one set of destinations, three steps ----------

type Dest = { id: string; icon: DestIcon; label: string; badge?: string; state?: BrowserKind; tip: string; small?: string };
function useDestinations(lang: "fi" | "en", browser: BrowserKind): Dest[] {
  const t = TEXT[lang];
  const state = t.browserState[browser];
  return [
    { id: "home", icon: "home", label: t.home, tip: t.home },
    { id: "shares", icon: "outbox", label: t.shares, badge: "1", tip: `${t.shares} · 1` },
    { id: "browser", icon: "browser", label: t.ownBrowser, state: browser, tip: `${t.ownBrowser} · ${state}`, small: browser === "idle" ? undefined : state },
    { id: "resources", icon: "shield", label: t.resources, tip: t.resources },
  ];
}

/** wide: the wider rail's tiles fit one row, icon over label, so its tile
 * step costs less height and arrives earlier. */
function Head({ step, lang, browser, wide, measure }: { step: Step; lang: "fi" | "en"; browser: BrowserKind; wide: boolean; measure?: boolean }) {
  const t = TEXT[lang];
  const sw = useText(switcherText);
  const dests = useDestinations(lang, browser);
  const press = (label: string) => (measure ? undefined : () => toast(t.would(label)));
  const tid = (s: string) => (measure ? undefined : s);
  const tab = measure ? -1 : undefined;
  const dot = (it: Dest) => (it.state && it.state !== "idle" ? <span className="rsp-dot" data-state={it.state} /> : null);
  if (step === 0) {
    const items: Dest[] = [...dests, { id: "search", icon: "search", label: sw.door, tip: t.searchKey("Ctrl+K") }];
    return (
      <div className="rsp-head rsp-head-icons" role={measure ? undefined : "toolbar"} aria-label={measure ? undefined : t.pages} data-testid={tid("rsp-head")} data-step="0">
        {items.map((it) => (
          <button key={it.id} type="button" tabIndex={tab} className="rsp-icon-item" data-testid={tid(`rsp-dest-${it.id}`)} data-state={it.state} aria-label={it.tip} title={it.tip}
            aria-keyshortcuts={it.id === "search" ? "Meta+K Control+K" : undefined} onClick={press(it.label)}>
            <RIcon name={it.icon} />
            {it.badge ? <span className="rsp-badge">{it.badge}</span> : null}
            {dot(it)}
          </button>
        ))}
      </div>
    );
  }
  const door = measure ? (
    <div className="ah-search-door rsp-door-measure"><Icon name="search" /><span>{sw.door}</span><kbd>Ctrl+K</kbd></div>
  ) : (
    <SearchDoor label={sw.door} keyHint="Ctrl+K" onOpen={() => toast(t.would(sw.door))} />
  );
  if (step === 1 && wide)
    return (
      <div className="rsp-head rsp-head-tiles" data-testid={tid("rsp-head")} data-step={step}>
        <div className="rsp-tiles-row">
          {dests.map((it) => (
            <button key={it.id} type="button" tabIndex={tab} className="rsp-tile rsp-tile-up" data-testid={tid(`rsp-dest-${it.id}`)} data-state={it.state} title={it.tip}
              aria-label={it.small ? it.tip : undefined} onClick={press(it.label)}>
              <span className="rsp-mark">
                <RIcon name={it.icon} />
                {dot(it)}
                {it.badge ? <span className="rsp-badge rsp-badge-corner">{it.badge}</span> : null}
              </span>
              <span className="rsp-label"><b>{it.label}</b></span>
            </button>
          ))}
        </div>
        {door}
      </div>
    );
  return (
    <div className={step === 1 ? "rsp-head rsp-head-tiles" : "rsp-head rsp-head-rows"} data-testid={tid("rsp-head")} data-step={step}>
      <div className={step === 1 ? "rsp-tiles" : "rsp-rows"}>
        {dests.map((it) => (
          <button key={it.id} type="button" tabIndex={tab} className={step === 1 ? "rsp-tile" : "rsp-row"} data-testid={tid(`rsp-dest-${it.id}`)} data-state={it.state} title={it.tip} onClick={press(it.label)}>
            <span className="rsp-mark">
              <RIcon name={it.icon} />
              {dot(it)}
            </span>
            <span className="rsp-label">
              <b>{it.label}</b>
              {step === 1 && it.small ? <small>{it.small}</small> : null}
            </span>
            {it.badge ? <span className="rsp-badge rsp-badge-inline">{it.badge}</span> : null}
            {step === 2 && it.state ? <small className="rsp-state">{t.browserState[it.state]}</small> : null}
          </button>
        ))}
      </div>
      {door}
    </div>
  );
}

/** The head in all three steps, out of sight, so the rule knows each
 * step's height before choosing. */
function Measure({ lang, browser, wide }: { lang: "fi" | "en"; browser: BrowserKind; wide: boolean }) {
  return (
    <div className="rsp-measure" aria-hidden="true" data-testid="rsp-measure">
      {([0, 1, 2] as Step[]).map((s) => (
        <Head key={s} step={s} lang={lang} browser={browser} wide={wide} measure />
      ))}
    </div>
  );
}

// ---------- Measuring the rail into the rule's constants ----------

const px = (v: string) => Number.parseFloat(v) || 0;
/** The distance from one row to the next in a list, or a row and its gap. */
function pitchOf(rows: HTMLElement[], gap: number) {
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].parentElement !== rows[i - 1].parentElement) continue;
    const d = rows[i].getBoundingClientRect().top - rows[i - 1].getBoundingClientRect().top;
    if (d > 0) return d;
  }
  return (rows[0]?.getBoundingClientRect().height ?? 30) + gap;
}

/** The edge chips' heights: the conversations' (production's .ah-rail-beyond)
 * and Työtilat's (this round's). Each overlays the edge row while its list
 * scrolls, so the rule pays for it when a list shows fewer than all rows. */
const CONV_CUE = 26;
const WS_CUE = 22;

function measure(): { consts: Consts; railH: number } | undefined {
  const rail = document.querySelector<HTMLElement>(".ah-rail");
  const pages = document.querySelector<HTMLElement>(".ah-rail-head [data-testid='rsp-head']");
  const regions = document.querySelector<HTMLElement>(".ah-rail-regions");
  const convs = document.querySelector<HTMLElement>("[data-testid='rail-conversations']");
  const ws = document.querySelector<HTMLElement>(".ah-rail-workspaces");
  const scroll = ws?.querySelector<HTMLElement>(".ah-rail-ws-scroll");
  const heads = [...document.querySelectorAll<HTMLElement>(".rsp-measure > .rsp-head")];
  if (!rail || !pages || !regions || !convs || !ws || !scroll || heads.length !== 3) return undefined;
  const rs = getComputedStyle(regions);
  const inner = regions.clientHeight - px(rs.paddingTop) - px(rs.paddingBottom) - px(rs.rowGap);
  const head = heads.map((h) => h.offsetHeight) as [number, number, number];
  const railH = rail.clientHeight;
  // The conversations: the sections from the first's top to the last's
  // bottom (independent of the scroll), less the rows.
  const sections = [...convs.querySelectorAll<HTMLElement>(":scope > section")];
  const convRows = [...convs.querySelectorAll<HTMLElement>("li[data-testid^='agent-item-']")];
  const cs = getComputedStyle(convs);
  const span = sections.length ? sections[sections.length - 1].getBoundingClientRect().bottom - sections[0].getBoundingClientRect().top : 0;
  const convPitch = pitchOf(
    [...convs.querySelectorAll<HTMLElement>("[data-testid='rail-quiet'] li[data-testid^='agent-item-']")].length > 1
      ? [...convs.querySelectorAll<HTMLElement>("[data-testid='rail-quiet'] li[data-testid^='agent-item-']")]
      : convRows,
    1,
  );
  const convOver = span + px(cs.paddingTop) + px(cs.paddingBottom) - convRows.length * convPitch;
  // Työtilat: the heading, the filter and the section's own padding stay;
  // inside the scroller, everything but the rows.
  const wsRows = [...ws.querySelectorAll<HTMLElement>(".ah-workspace-list > li")];
  const ss = getComputedStyle(scroll);
  const wsPitch = pitchOf(wsRows, 2);
  const fixedPart = ws.offsetHeight - scroll.offsetHeight;
  const content = [...scroll.children].reduce((s, c) => s + (c as HTMLElement).offsetHeight, 0) + px(ss.paddingTop) + px(ss.paddingBottom);
  const wsOver = fixedPart + content - wsRows.length * wsPitch;
  return {
    railH,
    consts: {
      fixed: railH - inner - pages.offsetHeight,
      head,
      conv: { over: Math.max(0, convOver), pitch: convPitch, n: convRows.length, cue: CONV_CUE },
      ws: { over: Math.max(0, wsOver), pitch: wsPitch, n: wsRows.length, cue: WS_CUE },
    },
  };
}

export type Adapt = { alloc: Alloc; consts: Consts; railH: number };

function useAdapt(d: number, p: Params, deps: unknown[]): Adapt | undefined {
  const [a, setA] = useState<Adapt>();
  const live = useRef(a);
  live.current = a;
  const pRef = useRef(p);
  pRef.current = p;
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the world, the head or the bounds change.
  useLayoutEffect(() => {
    if (d === 3) return;
    let raf = 0;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const m = measure();
        if (!m) return;
        const alloc = allocate(pRef.current, m.consts, m.railH);
        const prev = live.current;
        if (!prev || JSON.stringify(prev.alloc) !== JSON.stringify(alloc) || JSON.stringify(prev.consts) !== JSON.stringify(m.consts) || prev.railH !== m.railH)
          setA({ alloc, consts: m.consts, railH: m.railH });
      });
    };
    const o = new ResizeObserver(run);
    for (const s of [".ah-rail", "[data-testid='rail-conversations'] > section", ".ah-rail-ws-scroll > *", ".rsp-measure > *"])
      document.querySelectorAll(s).forEach((el) => o.observe(el));
    run();
    return () => {
      o.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [d, JSON.stringify(p), ...deps]);
  return a;
}

// ---------- Työtilat heading: refresh as an icon (rounds 1–2) ----------

function HeadTools({ d, t }: { d: number; t: Text }) {
  const [head, setHead] = useState<Element | null>(null);
  useLayoutEffect(() => {
    setHead(document.querySelector(".ah-rail-workspaces > .ah-rail-section-head"));
  }, [d]);
  if (!head || d === 3) return null;
  const label = t === TEXT.fi ? "Päivitä työtilat" : "Refresh workspaces";
  return createPortal(
    <span className="rsp-head-tools" data-testid="rsp-head-tools">
      <span className="rsp-refresh" title={label}><RefreshIconButton onPress={() => toast(t.would(label))} /></span>
    </span>,
    head,
  );
}

// ---------- Työtilat's edge chips: visible up/down indicators ----------
// Jari: past "enough" Työtilat scrolls, with visible up and down
// indicators. Production shades the edge; here the edge also says how many
// workspaces lie past it, as the conversations' chips do, and a press
// pages the list.

function WsEdges({ d, t, deps }: { d: number; t: Text; deps: unknown[] }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [edge, setEdge] = useState({ above: 0, below: 0, top: 0 });
  useLayoutEffect(() => {
    setHost(document.querySelector<HTMLElement>(".ah-rail-workspaces"));
  }, [d]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: recount when the layout changes.
  useEffect(() => {
    const scroll = host?.querySelector<HTMLElement>(".ah-rail-ws-scroll");
    if (!host || !scroll || d === 3) return;
    const count = () => {
      const box = scroll.getBoundingClientRect();
      const rows = [...scroll.querySelectorAll<HTMLElement>(".ah-workspace-list > li")].map((li) => li.getBoundingClientRect());
      const next = {
        above: rows.filter((r) => r.bottom - 6 <= box.top + (scroll.scrollTop > 1 ? WS_CUE : 0)).length,
        below: rows.filter((r) => r.top + 6 >= box.bottom - WS_CUE).length,
        top: scroll.offsetTop,
      };
      if (scroll.scrollHeight <= scroll.clientHeight + 1) {
        next.above = 0;
        next.below = 0;
      }
      setEdge((e) => (e.above === next.above && e.below === next.below && e.top === next.top ? e : next));
    };
    count();
    scroll.addEventListener("scroll", count, { passive: true });
    const o = new ResizeObserver(count);
    o.observe(scroll);
    return () => {
      scroll.removeEventListener("scroll", count);
      o.disconnect();
    };
  }, [host, d, ...deps]);
  if (!host || d === 3) return null;
  const page = (dir: 1 | -1) => {
    const scroll = host.querySelector<HTMLElement>(".ah-rail-ws-scroll");
    if (scroll) scroll.scrollBy({ top: dir * Math.max(40, scroll.clientHeight - 2 * WS_CUE), behavior: "auto" });
  };
  return createPortal(
    <>
      {edge.above ? (
        <button type="button" className="rsp-ws-edge" data-edge="above" data-testid="rsp-ws-above" style={{ top: edge.top }} aria-label={t.wsAbove(edge.above)} onClick={() => page(-1)}>
          ↑ {t.wsEdge(edge.above)}
        </button>
      ) : null}
      {edge.below ? (
        <button type="button" className="rsp-ws-edge" data-edge="below" data-testid="rsp-ws-below" aria-label={t.wsBelow(edge.below)} onClick={() => page(1)}>
          ↓ {t.wsEdge(edge.below)}
        </button>
      ) : null}
    </>,
    host,
  );
}

// ---------- The open conversation: production pieces ----------

const noop = () => {};
function Conversation({ title, ws, working, t }: { title: string; ws: string; working: boolean; t: Text }) {
  const s = useText(statusText);
  const [draft, setDraft] = useState("");
  return (
    <ConversationFrame>
      <AgentHeader
        title={title}
        activityLabel={working ? s.rail.working : s.rail.newReply}
        activityKind={working ? "working" : "unknown"}
        activityAnimated={working}
        controlLabel=""
        controlKind="neutral"
        workspaceLabel={ws}
        workspaceHref={`/workspaces/${ws}`}
        detailsExpanded={false}
        onToggleDetails={noop}
      />
      <ConversationStream label={title}>
        <ConversationTimeline
          state="ready"
          historyMode="pagedAccessible"
          onJumpToLatest={noop}
          items={[
            { id: "u", kind: "user", content: <UserMessage sourceText={t.asked} onCopy={noop} /> },
            { id: "a", kind: "assistant", content: <AssistantMessage onCopy={noop}><Markdown text={t.said} /></AssistantMessage> },
          ]}
        />
      </ConversationStream>
      <Composer
        value={draft}
        onChange={setDraft}
        activity={working ? "working" : "idle"}
        selectedWorkingMode="steer"
        onModeChange={noop}
        onSendNow={noop}
        onSteer={noop}
        onFollowUp={noop}
        csrf="prototype"
      />
    </ConversationFrame>
  );
}

// ---------- The page ----------

const HEIGHTS = [720, 800, 900, 1080, 1440];
const FRAME_W = 1280;
const H_MIN = 600;
const H_MAX = 1600;
let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: "fi" | "en" = params.get("lang") === "en" ? "en" : "fi";
let reviewWorld: WorldKind = (["ordinary", "like", "crowded"] as const).find((w) => w === params.get("world")) ?? "ordinary";
let reviewBrowser: BrowserKind = (["idle", "agent", "ask"] as const).find((b) => b === params.get("browser")) ?? "idle";
const hParam = Number(params.get("h"));
let reviewHeight: number = hParam >= H_MIN && hParam <= H_MAX ? hParam : bare ? 0 : 900;
/** Each direction's bounds as the drawer last left them. */
const reviewParams: Params[] = DEFAULTS.map((p) => ({ ...p, conv: { ...p.conv }, ws: { ...p.ws } }));

function Main({ d, t, lang, w, browser, p, onAdapt }: { d: number; t: Text; lang: "fi" | "en"; w: World; browser: BrowserKind; p: Params; onAdapt: (a: Adapt | undefined) => void }) {
  const location = useLocation();
  const first = w.convs.find((c) => c.state === "working") ?? w.convs[0];
  const open = new URLSearchParams(location.search).get("conversation") ?? first.id;
  const conv = w.convs.find((c) => c.id === open) ?? first;
  const s = useText(statusText).rail;
  const sw = useText(switcherText);
  const status = useText(statusText);
  const shares = useText(sharesText);
  const resources = useText(agentResourcesText);
  const wide = d === WIDE;
  // Today folds Hiljaiset itself while the rail is crowded. Here the rule
  // gives the conversation list its room and the list scrolls past it with
  // its edge chips, so Hiljaiset folds only when the person folds it.
  const [choice, setChoice] = useState<boolean | undefined>(undefined);
  const [crowded, setCrowded] = useState(false);
  const folded = choice ?? (d === 3 ? crowded : false);
  const [filter, setFilter] = useState("");

  const rows = w.convs.map((c) => ({ c, m: model(c, conv.id, lang, s, wide) }));
  const yours = rows.filter((r) => r.c.state === "reply" || r.c.state === "question").map((r) => r.m);
  const running = rows.filter((r) => r.c.state === "working").map((r) => r.m);
  const quiet = rows.filter((r) => r.c.state === "idle").map((r) => r.m);
  const listed = w.workspaces.map((n) => ({ id: n, name: n, icon: iconOf(n) }));
  const adapt = useAdapt(d, p, [w, lang, browser, folded]);
  useEffect(() => onAdapt(adapt), [adapt, onAdapt]);
  const step: Step = adapt?.alloc.step ?? 0;

  const homeRow = (testid: string, href: string, icon: "globe" | "shield", label: string) => (
    <div className="ah-rail-home-row">
      <LinkRow href={href} data-testid={testid} kind="home" className="ah-rail-home">
        <Icon name={icon} />
        <span className="ah-rail-home-label">{label}</span>
      </LinkRow>
    </div>
  );
  const pages =
    d === 3 ? (
      <>
        {homeRow("rail-shares", "/shares", "globe", `${shares.title} 1`)}
        <BrowserRailRow summary={summaryOf(browser, lang)} windows={1} onOpen={() => toast(t.would(t.ownBrowser))} />
        {homeRow("rail-resources", "/resources", "shield", resources.railLabel)}
      </>
    ) : (
      <>
        <Head step={step} lang={lang} browser={browser} wide={wide} />
        <Measure lang={lang} browser={browser} wide={wide} />
      </>
    );
  const search = d === 3 ? <SearchDoor label={sw.door} keyHint="Ctrl+K" onOpen={() => toast(t.would(sw.door))} /> : null;
  const filterShown = d === 3 || w.workspaces.length > FILTER_FROM;
  const shown = w.workspaces.filter((n) => n.includes(filter.toLocaleLowerCase()));

  const rail = (
    <WorkspaceRail
      collapsed={false}
      serverLabel="Habitat"
      connectionLabel={status.connected}
      connectionTone="success"
      homeCurrent={false}
      pages={pages}
      search={search}
      filterValue={filter}
      resultSummary={`${shown.length}`}
      listState={shown.length ? "ready" : "filtered-empty"}
      onToggle={noop}
      onFilter={setFilter}
      onRefresh={noop}
      onCreateWorkspace={noop}
      crowding={d === 3 ? { quietRows: quiet.length, onChange: setCrowded } : undefined}
      sessionActions={<AccountShelf profile={{ name: "Esimerkki Käyttäjä", email: "", avatar_url: "" }} onSettings={noop} onLogout={noop} />}
      now={
        <NowSections
          yours={yours}
          running={running}
          workspaces={listed}
          quiet={
            <QuietSection
              rows={quiet}
              workspaces={listed}
              choice={{ sort: "newest", workspace: null }}
              folded={folded}
              onFold={setChoice}
            />
          }
        />
      }
    >
      {shown.map((n) => (
        <WorkspaceNavRow
          key={n}
          name={n}
          href={`/workspaces/${n}`}
          icon={iconOf(n)}
          selected={false}
          workspaceMenu={
            <WorkspaceActions
              workspace={{ workspace_id: n, name: n, kind: "git_main_worktree", visibility: "visible" } as unknown as Workspace}
              onNew={noop}
              rail
            />
          }
        />
      ))}
    </WorkspaceRail>
  );
  const title = TITLES[conv.n % TITLES.length][lang === "fi" ? 0 : 1];
  const vars = adapt && d !== 3 ? ({ "--rsp-c-h": `${adapt.alloc.convPx}px`, "--rsp-w-h": `${adapt.alloc.wsPx}px` } as React.CSSProperties) : undefined;
  return (
    <StatusBellProvider items={[]}>
      <div
        className="rsp-shell"
        data-direction={d}
        data-wide={wide || undefined}
        data-step={d === 3 ? undefined : step}
        data-filter={filterShown ? "shown" : "hidden"}
        data-ready={d === 3 || adapt ? "" : undefined}
        data-alloc={adapt && d !== 3 ? JSON.stringify({ step: adapt.alloc.step, conv: adapt.alloc.conv, ws: adapt.alloc.ws, n: [adapt.consts.conv.n, adapt.consts.ws.n] }) : undefined}
        style={vars}
      >
        <AppShell
          mobileTitle={title}
          rail={rail}
          navigationBadge={yours.length}
          main={
            <div className="rsp-main" id="main">
              <Conversation key={conv.id} title={title} ws={conv.ws} working={conv.state === "working"} t={t} />
            </div>
          }
        />
      </div>
      <HeadTools d={d} t={t} />
      <WsEdges d={d} t={t} deps={[adapt?.alloc.wsPx, filter, w]} />
      <Toast />
    </StatusBellProvider>
  );
}

// ---------- The model, visible: meters, charts and the bounds drawer ----------

type Seen = { conv: number; ws: number };

function Meter({ label, rows, seen, n, min, enough, tone, testid, t }: { label: string; rows: number; seen: number; n: number; min: number; enough: number; tone: string; testid: string; t: Text }) {
  const max = Math.max(n, enough + 2, rows);
  const at = (r: number) => `${(Math.min(r, max) / max) * 100}%`;
  return (
    <div className="rsp-meter" data-testid={testid}>
      <div className="rsp-meter-text">
        <b>{label}</b> {t.meter(rows, seen, n, min, enough)}
      </div>
      <div className="rsp-meter-bar" aria-hidden="true">
        <span className="rsp-meter-band" style={{ left: at(min), width: `calc(${at(enough)} - ${at(min)})` }} />
        <span className="rsp-meter-fill" data-tone={tone} style={{ width: at(rows) }} />
        <span className="rsp-meter-n" style={{ left: at(n) }} />
        <span className="rsp-meter-tick" style={{ left: at(min) }}>{min}</span>
        <span className="rsp-meter-tick" style={{ left: at(enough) }}>{enough}</span>
      </div>
    </div>
  );
}

/** Rows per list against the rail's height, with the head's step as bands
 * and the current height marked: where every height lands. */
function AllocChart({ p, c, h, t }: { p: Params; c: Consts; h: number; t: Text }) {
  const W = 520;
  const Hh = 132;
  const padL = 26;
  const padB = 16;
  const pts: { h: number; a: Alloc }[] = [];
  for (let x = H_MIN; x <= H_MAX; x += 5) pts.push({ h: x, a: allocate(p, c, x) });
  const maxRows = Math.max(12, ...pts.map((q) => Math.max(q.a.conv, q.a.ws))) + 1;
  const X = (x: number) => padL + ((x - H_MIN) / (H_MAX - H_MIN)) * (W - padL - 4);
  const Y = (r: number) => Hh - padB - (r / maxRows) * (Hh - padB - 6);
  const line = (k: "conv" | "ws") => pts.map((q, i) => `${i ? "L" : "M"}${X(q.h).toFixed(1)},${Y(q.a[k]).toFixed(1)}`).join("");
  const changes = stepChanges(p, c, H_MIN, H_MAX);
  const bands: { from: number; to: number; step: Step }[] = [];
  let from = H_MIN;
  let s = allocate(p, c, H_MIN).step;
  for (const ch of changes) {
    bands.push({ from, to: ch.h, step: s });
    from = ch.h;
    s = ch.step;
  }
  bands.push({ from, to: H_MAX, step: s });
  const hh = Math.min(H_MAX, Math.max(H_MIN, h));
  return (
    <figure className="rsp-chart" data-testid="rsp-alloc-chart">
      <figcaption>{t.allocCaption}</figcaption>
      <svg viewBox={`0 0 ${W} ${Hh}`} width={W} height={Hh} role="img" aria-label={t.allocCaption}>
        {bands.map((b, i) => (
          <g key={i}>
            <rect x={X(b.from)} y={0} width={X(b.to) - X(b.from)} height={Hh - padB} className="rsp-band" data-step={b.step} />
            {X(b.to) - X(b.from) > 44 ? <text x={X(b.from) + 3} y={11} className="rsp-band-label">{t.steps[b.step]}</text> : null}
          </g>
        ))}
        {[p.conv.min, p.conv.enough].map((r, i) => <line key={`c${i}`} x1={padL} x2={W - 4} y1={Y(r)} y2={Y(r)} className="rsp-bound" data-list="conv" />)}
        {[p.ws.min, p.ws.enough].map((r, i) => <line key={`w${i}`} x1={padL} x2={W - 4} y1={Y(r)} y2={Y(r)} className="rsp-bound" data-list="ws" />)}
        <path d={line("conv")} className="rsp-line" data-list="conv" />
        <path d={line("ws")} className="rsp-line" data-list="ws" />
        {[0, 5, 10, 15, 20, 25, 30].filter((r) => r < maxRows).map((r) => (
          <text key={r} x={padL - 4} y={Y(r) + 3} className="rsp-axis" textAnchor="end">{r}</text>
        ))}
        {[600, 720, 900, 1080, 1440, 1600].map((x) => (
          <text key={x} x={X(x)} y={Hh - 3} className="rsp-axis" textAnchor="middle">{x}</text>
        ))}
        <line x1={X(hh)} x2={X(hh)} y1={0} y2={Hh - padB} className="rsp-now" />
      </svg>
      <p className="rsp-legend">
        <span data-list="conv">{t.convs}</span> <span data-list="ws">{t.wss}</span> {t.changes(changes.map((ch) => `${t.steps[ch.step]} ${ch.h}`).join(", ") || "–")}
      </p>
    </figure>
  );
}

/** The marginal value of each list's next row, the buttons' value, and
 * where the current height leaves each list. */
function CurveChart({ p, c, a, t }: { p: Params; c: Consts; a: Alloc; t: Text }) {
  const W = 280;
  const Hh = 132;
  const padL = 22;
  const padB = 16;
  const maxR = Math.max(24, p.conv.enough + 6, p.ws.enough + 6);
  const vmax = 4.2;
  const X = (r: number) => padL + (r / maxR) * (W - padL - 4);
  const Y = (v: number) => Hh - padB - (Math.min(v, vmax) / vmax) * (Hh - padB - 6);
  // Per pixel, scaled to conversation rows, so the two lists and the
  // buttons are on one scale.
  const per = (k: "conv" | "ws", r: number) =>
    (value(p, p[k], r, c[k].n, k === "conv" ? p.ratio : 1, k) * c.conv.pitch) / c[k].pitch;
  const path = (k: "conv" | "ws") => {
    let d = "";
    for (let r = 0; r < maxR; r++) d += `${r ? "L" : "M"}${X(r).toFixed(1)},${Y(per(k, r)).toFixed(1)}H${X(r + 1).toFixed(1)}`;
    return d;
  };
  return (
    <figure className="rsp-chart" data-testid="rsp-curve-chart">
      <figcaption>{t.curveCaption}</figcaption>
      <svg viewBox={`0 0 ${W} ${Hh}`} width={W} height={Hh} role="img" aria-label={t.curveCaption}>
        <line x1={padL} x2={W - 4} y1={Y(p.button)} y2={Y(p.button)} className="rsp-button-line" />
        <text x={W - 6} y={Y(p.button) - 3} className="rsp-axis" textAnchor="end">{t.buttonsShort}</text>
        <path d={path("conv")} className="rsp-line" data-list="conv" />
        <path d={path("ws")} className="rsp-line" data-list="ws" />
        <circle cx={X(a.conv)} cy={Y(per("conv", Math.max(0, a.conv - 1)))} r={4} className="rsp-dotmark" data-list="conv" />
        <circle cx={X(a.ws)} cy={Y(per("ws", Math.max(0, a.ws - 1)))} r={4} className="rsp-dotmark" data-list="ws" />
        {[0, 6, 12, 18, 24, 30].filter((r) => r <= maxR).map((r) => (
          <text key={r} x={X(r)} y={Hh - 3} className="rsp-axis" textAnchor="middle">{r}</text>
        ))}
        {[1, 2, 3, 4].map((v) => <text key={v} x={padL - 4} y={Y(v) + 3} className="rsp-axis" textAnchor="end">{v}</text>)}
      </svg>
      <p className="rsp-legend">{t.curveLegend}</p>
    </figure>
  );
}

function Drawer({ p, d, t, set }: { p: Params; d: number; t: Text; set: (p: Params) => void }) {
  const num = (label: string, testid: string, v: number, min: number, max: number, stepV: number, on: (v: number) => void) => (
    <label className="rsp-slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={stepV} value={v} data-testid={testid} onChange={(e) => on(Number(e.target.value))} />
      <output>{v}</output>
    </label>
  );
  return (
    <details className="rsp-drawer" data-testid="rsp-drawer">
      <summary>{t.drawer}</summary>
      <div className="rsp-drawer-body">
        <p>{t.drawerNote(t.pickerNames[d])}</p>
        <label className="rsp-slider">
          <span>{t.priority}</span>
          <select value={p.priority} data-testid="rsp-priority" onChange={(e) => set({ ...p, priority: e.target.value as Params["priority"] })}>
            <option value="share">{t.priorities.share}</option>
            <option value="conv">{t.priorities.conv}</option>
          </select>
        </label>
        <label className="rsp-slider">
          <span>{t.shape}</span>
          <select value={p.shape} data-testid="rsp-shape" onChange={(e) => set({ ...p, shape: e.target.value as Params["shape"] })}>
            <option value="knees">{t.shapes.knees}</option>
            <option value="soft">{t.shapes.soft}</option>
          </select>
        </label>
        {num(t.convMin, "rsp-conv-min", p.conv.min, 2, 16, 1, (v) => set({ ...p, conv: { min: v, enough: Math.max(v + 1, p.conv.enough) } }))}
        {num(t.convEnough, "rsp-conv-enough", p.conv.enough, 3, 30, 1, (v) => set({ ...p, conv: { min: Math.min(v - 1, p.conv.min), enough: v } }))}
        {num(t.wsMin, "rsp-ws-min", p.ws.min, 2, 14, 1, (v) => set({ ...p, ws: { min: v, enough: Math.max(v + 1, p.ws.enough) } }))}
        {num(t.wsEnough, "rsp-ws-enough", p.ws.enough, 3, 30, 1, (v) => set({ ...p, ws: { min: Math.min(v - 1, p.ws.min), enough: v } }))}
        {p.shape === "knees" ? num(t.ratio, "rsp-ratio", p.ratio, 0.5, 4, 0.5, (v) => set({ ...p, ratio: v })) : null}
        {num(t.button, "rsp-button", p.button, 0.5, 2.5, 0.05, (v) => set({ ...p, button: v }))}
        <button type="button" className="rsp-preset" data-testid="rsp-reset" onClick={() => set({ ...DEFAULTS[d], conv: { ...DEFAULTS[d].conv }, ws: { ...DEFAULTS[d].ws } })}>{t.reset}</button>
      </div>
    </details>
  );
}

function ModelPanel({ d, a, p, seen, t, set }: { d: number; a: Adapt | undefined; p: Params; seen: Seen; t: Text; set: (p: Params) => void }) {
  if (d === 3) return <p className="rsp-rule" data-testid="rsp-rule">{t.now}</p>;
  if (!a) return <p className="rsp-rule" data-testid="rsp-rule">…</p>;
  const { alloc, consts } = a;
  const next = stepChanges(p, consts, a.railH, H_MAX).find((ch) => ch.step > alloc.step);
  return (
    <div className="rsp-model" data-testid="rsp-model">
      <div className="rsp-meters">
        <p className="rsp-rule" data-testid="rsp-rule" data-step={alloc.step}>
          {t.rule(a.railH, t.steps[alloc.step], next ? `${t.steps[next.step]} ${next.h}` : null, alloc.band, alloc.spare)}
        </p>
        <Meter label={t.convs} rows={alloc.conv} seen={seen.conv} n={consts.conv.n} min={p.conv.min} enough={p.conv.enough} tone="conv" testid="rsp-meter-conv" t={t} />
        <Meter label={t.wss} rows={alloc.ws} seen={seen.ws} n={consts.ws.n} min={p.ws.min} enough={p.ws.enough} tone="ws" testid="rsp-meter-ws" t={t} />
        <Drawer p={p} d={d} t={t} set={set} />
      </div>
      <AllocChart p={p} c={consts} h={a.railH} t={t} />
      <CurveChart p={p} c={consts} a={alloc} t={t} />
    </div>
  );
}

function IconSet({ t }: { t: Text }) {
  return (
    <details className="rsp-iconset" data-testid="rsp-iconset">
      <summary>{t.icons}</summary>
      <ul>
        {t.iconSet.map(([name, label]) => (
          <li key={name}><RIcon name={name as DestIcon} /> {label}</li>
        ))}
      </ul>
    </details>
  );
}

/** Rows wholly in sight in each list, for the meters. */
function useSeen(deps: unknown[]): Seen {
  const [n, setN] = useState<Seen>({ conv: 0, ws: 0 });
  // biome-ignore lint/correctness/useExhaustiveDependencies: recount when the layout changes.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const inBox = (sel: string, box: Element | null, cue: number) => {
        if (!box) return 0;
        const b = box.getBoundingClientRect();
        const chips = [...box.parentElement!.querySelectorAll<HTMLElement>(".ah-rail-beyond, .rsp-ws-edge")].map((c) => c.getBoundingClientRect());
        return [...document.querySelectorAll(sel)].filter((li) => {
          const r = li.getBoundingClientRect();
          if (r.top < b.top - 1 || r.bottom > b.bottom + 1) return false;
          return !chips.some((c) => c.height && r.top < c.bottom - 2 && r.bottom > c.top + 2 && cue);
        }).length;
      };
      setN({
        conv: inBox(".ah-rail li[data-testid^='agent-item-']", document.querySelector("[data-testid='rail-conversations']"), 1),
        ws: inBox(".ah-rail .ah-workspace-list > li", document.querySelector(".ah-rail-ws-scroll"), 1),
      });
    });
    return () => cancelAnimationFrame(id);
  }, deps);
  return n;
}

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(reviewLanguage);
  const [kind, setKind] = useState(reviewWorld);
  const [height, setHeight] = useState(reviewHeight);
  const [browser, setBrowser] = useState(reviewBrowser);
  const [p, setP] = useState<Params>(reviewParams[direction] ?? DEFAULTS[0]);
  const [adapt, setAdapt] = useState<Adapt>();
  const bar = useRef<HTMLElement>(null);
  const t = TEXT[language];
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el || bare) return;
    const set = () => document.documentElement.style.setProperty("--review-h", `${el.getBoundingClientRect().height}px`);
    set();
    const o = new ResizeObserver(set);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = language;
  }, [theme, language]);
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    if (!height) {
      root.removeProperty("--frame-w");
      root.removeProperty("--frame-h");
    } else {
      root.setProperty("--frame-w", `${FRAME_W}px`);
      root.setProperty("--frame-h", `${height}px`);
    }
    document.documentElement.toggleAttribute("data-framed", !!height);
  }, [height]);
  useEffect(() => {
    document.querySelectorAll(".proto-picker-item").forEach((b, i) => {
      b.textContent = t.pickerNames[i];
    });
  }, [t]);
  const w = world(kind);
  const select = <V extends string>(id: string, label: string, value: V, options: [V, string][], set: (v: V) => void) => (
    <label>
      {label}{" "}
      <select id={id} value={value} onChange={(e) => set(e.target.value as V)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
  const setH = (h: number) => {
    reviewHeight = h;
    setHeight(h);
  };
  const setParams = (next: Params) => {
    reviewParams[direction] = next;
    setP(next);
  };
  const first = w.convs.find((c) => c.state === "working") ?? w.convs[0];
  const seen = useSeen([adapt, height, kind, direction]);
  return (
    <div className="rsp-review" data-direction={direction} data-world={kind}>
      {bare ? null : (
        <header className="rsp-bar" ref={bar}>
          <div className="rsp-controls">
            <strong>{t.title}</strong>
            <span className="rsp-heights" role="group" aria-label={t.height}>
              {t.height}{" "}
              {HEIGHTS.map((h) => (
                <button key={h} type="button" className="rsp-preset" data-testid={`rsp-h-${h}`} aria-pressed={height === h} onClick={() => setH(h)}>{h}</button>
              ))}
              <input type="range" min={H_MIN} max={H_MAX} step={10} value={height || 900} aria-label={t.height} data-testid="rsp-height" onChange={(e) => setH(Number(e.target.value))} />
              <output data-testid="rsp-height-value">{height ? `${FRAME_W} × ${height}` : t.window}</output>
            </span>
            {select("world", t.world, kind, (Object.keys(t.worlds) as WorldKind[]).map((k) => [k, t.worlds[k]]), (v) => { reviewWorld = v; setKind(v); })}
            {select("browser", t.browser, browser, (["idle", "agent", "ask"] as const).map((b) => [b, t.browsers[b]]), (v) => { reviewBrowser = v; setBrowser(v); })}
            {select("theme", t.theme, theme, (["light", "dark", "contrast"] as const).map((v) => [v, t.themes[v]]), (v) => { reviewTheme = v; setTheme(v); })}
            {select("language", t.language, language, [["fi", "suomi"], ["en", "English"]], (v) => { reviewLanguage = v; setPersonalLanguage(v); setLanguage(v); })}
            <IconSet t={t} />
          </div>
          <ol className="rsp-lines" data-testid="direction-lines">
            {t.lines.map((l, i) => (
              <li key={i} aria-current={i === direction ? "true" : undefined}>
                {l}
                <b className="rsp-count"> {t.rows(ROWS[i])}</b>
              </li>
            ))}
          </ol>
          <p className="rsp-recommend" data-testid="recommendation">{t.recommend}</p>
          <ModelPanel d={direction} a={adapt} p={p} seen={seen} t={t} set={setParams} />
        </header>
      )}
      <div className="rsp-stage">
        <MemoryRouter initialEntries={[`/workspaces/${first.ws}?conversation=${first.id}`]}>
          <Main key={`${direction}-${language}-${kind}`} d={direction} t={t} lang={language} w={w} browser={browser} p={p} onAdapt={setAdapt} />
        </MemoryRouter>
      </div>
    </div>
  );
}

// ---------- Host stand-in: only what the production shell asks for ----------

const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, "http://prototype.test/").pathname;
  if (!path.startsWith("/api/")) return realFetch(input, init);
  if (path === "/api/v1/server") return json({ schema_version: 1, name: "Habitat", administrator: false, version: "0.0.0-proto" });
  return new Response("", { status: 404 });
};

if (reviewLanguage === "en") setPersonalLanguage("en");
const root = createRoot(document.getElementById("root")!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {
  set innerHTML(view: ReactNode) {
    flushSync(() => root.render(view === "" ? null : view));
  },
};
const NAMES = TEXT[reviewLanguage].pickerNames;
const start = Math.max(0, Math.min(3, Number(params.get("d") ?? 0) || 0));
const variants = NAMES.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement("nav");
picker.className = "proto-picker";
picker.setAttribute("aria-label", "Prototype variants");
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
NAMES.forEach((n, i) => {
  const button = document.createElement("button");
  button.className = "proto-picker-item";
  button.textContent = n;
  if (i === 0) {
    button.setAttribute("data-active", "");
    button.setAttribute("aria-current", "true");
  }
  picker.append(button);
});
document.body.append(picker);
new Function("stage", "variants", pickerSource)(stageSink, variants);
if (start) (picker.querySelectorAll(".proto-picker-item")[start] as HTMLElement).click();
