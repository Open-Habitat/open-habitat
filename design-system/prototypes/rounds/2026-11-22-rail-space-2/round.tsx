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
import { BREAKS, ROWS, TEXT, type Text, TITLES, WORKSPACES } from "./text";
import "./round.css";

// rail-space-small-screens, round 2 (Jari 22.11.2026 on round 1): A Tiivis
// was best, but the rail should adapt to the height it has: a compact icon
// row on a small screen, the same destinations as labelled tiles with more
// room, a row each with ample room; and on a large screen Työtilat should
// get more than its three-row floor. The three directions differ in what
// decides the step (the height alone, or whether the content already fits)
// and in how conversations and Työtilat share the room. The rail and the
// conversation are production components; round-own are the adaptive head
// (icons, tiles, rows and the two new icons), the rule that picks its step
// and Työtilat's floor, the Työtilat heading's refresh icon and the review
// chrome. Direction 4 is today's rail.
setPersonalLanguage("fi");

const params = new URLSearchParams(location.search);
const bare = params.has("bare");
if (bare) document.documentElement.toggleAttribute("data-bare", true);

// ---------- The synthetic world (as in round 1) ----------

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
function model(c: Conv, open: string, lang: "fi" | "en", s: Words): AgentNavModel {
  const label = c.state === "working" ? s.working : c.state === "reply" ? s.newReply : c.state === "question" ? s.asks : "";
  return {
    agentId: c.id,
    href: hrefOf(c),
    title: TITLES[c.n % TITLES.length][lang === "fi" ? 0 : 1],
    workspaceId: c.ws,
    workspaceName: c.ws,
    workspaceIcon: iconOf(c.ws),
    changedAt: NOW0 - c.age * 60000,
    activity: c.state === "working" ? "working" : "waiting",
    activityLabel: label,
    attentionLabel: c.state === "reply" ? s.newReply : undefined,
    question: c.state === "question",
    controlLabel: "",
    detail: [c.ws, label].filter(Boolean).join(" · "),
    selected: c.id === open,
    worktree: c.worktree ? { merged: false, work: { text: lang === "fi" ? "2 muutosta" : "2 changes", tone: "work" } } : undefined,
  };
}

// ---------- Oma selain's state ----------

type BrowserKind = "idle" | "agent" | "ask";
/** Today's rail row reads production's summary; the adaptive head shows the
 * same three states in its own slot. */
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

// ---------- The icon set ----------
// Production gives Tuotokset and Oma selain the same globe. Here each
// destination has its own shape: Tuotokset an outgoing tray (what the agent
// has handed out), Oma selain a browser window that carries its state as a
// dot. Home, shield and search are production's.

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

type Step = 0 | 1 | 2;
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

function Head({ step, lang, browser, measure }: { step: Step; lang: "fi" | "en"; browser: BrowserKind; measure?: boolean }) {
  const t = TEXT[lang];
  const sw = useText(switcherText);
  const dests = useDestinations(lang, browser);
  const press = (label: string) => (measure ? undefined : () => toast(t.would(label)));
  const tid = (s: string) => (measure ? undefined : s);
  const tab = measure ? -1 : undefined;
  if (step === 0) {
    const items: Dest[] = [...dests, { id: "search", icon: "search", label: sw.door, tip: t.searchKey("Ctrl+K") }];
    return (
      <div className="rsp-head rsp-head-icons" role={measure ? undefined : "toolbar"} aria-label={measure ? undefined : t.pages} data-testid={tid("rsp-head")} data-step="0">
        {items.map((it) => (
          <button key={it.id} type="button" tabIndex={tab} className="rsp-icon-item" data-testid={tid(`rsp-dest-${it.id}`)} data-state={it.state} aria-label={it.tip} title={it.tip}
            aria-keyshortcuts={it.id === "search" ? "Meta+K Control+K" : undefined} onClick={press(it.label)}>
            <RIcon name={it.icon} />
            {it.badge ? <span className="rsp-badge">{it.badge}</span> : null}
            {it.state && it.state !== "idle" ? <span className="rsp-dot" data-state={it.state} /> : null}
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
  return (
    <div className={step === 1 ? "rsp-head rsp-head-tiles" : "rsp-head rsp-head-rows"} data-testid={tid("rsp-head")} data-step={step}>
      <div className={step === 1 ? "rsp-tiles" : "rsp-rows"}>
        {dests.map((it) => (
          <button key={it.id} type="button" tabIndex={tab} className={step === 1 ? "rsp-tile" : "rsp-row"} data-testid={tid(`rsp-dest-${it.id}`)} data-state={it.state} title={it.tip} onClick={press(it.label)}>
            <span className="rsp-mark">
              <RIcon name={it.icon} />
              {it.state && it.state !== "idle" ? <span className="rsp-dot" data-state={it.state} /> : null}
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

/** The head in all three steps, out of sight, so the rule can weigh each
 * step's height before choosing it. */
function Measure({ lang, browser }: { lang: "fi" | "en"; browser: BrowserKind }) {
  return (
    <div className="rsp-measure" aria-hidden="true" data-testid="rsp-measure">
      <Head step={0} lang={lang} browser={browser} measure />
      <Head step={1} lang={lang} browser={browser} measure />
      <Head step={2} lang={lang} browser={browser} measure />
    </div>
  );
}

// ---------- The rule: which step, and how much room Työtilat gets ----------

type Adapt = { step: Step; floor: number; railH: number; floorRows: number; needTiles: number; needRows: number };
type Counts = { quiet: number; convAll: number; ws: number };

const stepByHeight = (h: number): Step => (h < BREAKS[0] ? 0 : h < BREAKS[1] ? 1 : 2);

function readRail(counts: Counts) {
  const rail = document.querySelector<HTMLElement>(".ah-rail");
  const pages = document.querySelector<HTMLElement>(".ah-rail-head [data-testid='rsp-head']");
  const regions = document.querySelector<HTMLElement>(".ah-rail-regions");
  const region = document.querySelector<HTMLElement>("[data-testid='rail-conversations']");
  const ws = document.querySelector<HTMLElement>(".ah-rail-workspaces");
  const heads = [...document.querySelectorAll<HTMLElement>(".rsp-measure > .rsp-head")];
  if (!rail || !pages || !regions || !region || !ws || heads.length !== 3) return undefined;
  const rs = getComputedStyle(regions);
  const inner = regions.clientHeight - (Number.parseFloat(rs.paddingTop) || 0) - (Number.parseFloat(rs.paddingBottom) || 0) - (Number.parseFloat(rs.rowGap) || 0);
  // What the conversations and Työtilat would share at each step.
  const avail = heads.map((h) => inner + pages.offsetHeight - h.offsetHeight);
  // Waiting and running conversations, with Hiljaiset as its heading only
  // (worked out the same way whether it is folded or open).
  const quiet = region.querySelector<HTMLElement>("[data-testid='rail-quiet']");
  const quietHead = quiet?.querySelector<HTMLElement>("h2");
  const active = region.scrollHeight - (quiet && quietHead ? quiet.offsetHeight - quietHead.offsetHeight : 0);
  const convRow = region.querySelector<HTMLElement>("li[data-testid^='agent-item-']")?.offsetHeight ?? 30;
  // B counts Hiljaiset's rows up to a cap (six for tiles, twelve for
  // rows): a long Hiljaiset would otherwise keep the bigger steps away for good.
  const quietRows = (n: number) => Math.min(n, counts.quiet) * (convRow + 1);
  const wss = getComputedStyle(ws);
  const chrome =
    (Number.parseFloat(wss.paddingTop) || 0) +
    (Number.parseFloat(wss.borderTopWidth) || 0) +
    [...ws.children].filter((c) => !c.matches(".ah-rail-ws-scroll")).reduce((s, c) => s + (c as HTMLElement).offsetHeight, 0) +
    4;
  const wsRow = (ws.querySelector<HTMLElement>(".ah-workspace-list > li")?.offsetHeight ?? 30) + 2;
  const wsNeed = (n: number) => chrome + n * wsRow;
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return { railH: Math.round(rail.clientHeight), avail, active, quietRows, wsNeed, wsRow, chrome, minFloor: 11 * rem };
}

function decide(d: number, m: NonNullable<ReturnType<typeof readRail>>, counts: Counts, prev: Step): Adapt {
  const allWs = m.wsNeed(counts.ws);
  // B's thresholds: what has to fit beside each step. Tiles: waiting and
  // running, six Hiljaiset rows and six workspaces (or all, if fewer).
  // Rows: the same with twelve of each.
  const fits = (n: number) => m.active + m.quietRows(n) + m.wsNeed(Math.min(n, counts.ws));
  // B's thresholds: the rail height at which a step's content fits.
  const extra = (s: number) => m.avail[0] - m.avail[s];
  const needTiles = Math.ceil(m.railH - m.avail[0] + extra(1) + fits(6));
  const needRows = Math.ceil(m.railH - m.avail[0] + extra(2) + fits(12));
  let step: Step;
  if (d === 1) {
    // A step once taken is kept within a little slack, so the edge chips
    // coming and going cannot flip it back and forth.
    const keep = (need: number, s: Step) => m.railH >= need - (prev >= s ? 12 : 0);
    step = keep(needRows, 2) ? 2 : keep(needTiles, 1) ? 1 : 0;
  } else step = stepByHeight(m.railH);
  const total = m.avail[step];
  const want =
    d === 0
      ? total / 3
      : d === 1
        ? total - m.active
        : (total * counts.ws) / Math.max(1, counts.ws + counts.convAll);
  const lo = Math.min(m.minFloor, allWs);
  const floor = Math.round(Math.max(lo, Math.min(want, allWs)));
  return { step, floor, railH: m.railH, floorRows: Math.max(0, Math.floor((floor - m.chrome) / m.wsRow)), needTiles, needRows };
}

function useAdapt(d: number, counts: Counts, deps: unknown[]): Adapt | undefined {
  const [a, setA] = useState<Adapt>();
  const live = useRef(a);
  live.current = a;
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the world or the head changes.
  useLayoutEffect(() => {
    if (d === 3) return;
    let raf = 0;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const m = readRail(counts);
        if (!m) return;
        const prev = live.current;
        const next = decide(d, m, counts, prev?.step ?? 0);
        if (!prev || prev.step !== next.step || Math.abs(prev.floor - next.floor) > 2 || prev.railH !== next.railH || prev.needTiles !== next.needTiles)
          setA(next);
      });
    };
    const o = new ResizeObserver(run);
    for (const s of [".ah-rail", "[data-testid='rail-conversations'] > *", ".ah-rail-ws-scroll > *", ".rsp-measure > *"])
      document.querySelectorAll(s).forEach((el) => o.observe(el));
    run();
    return () => {
      o.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [d, ...deps]);
  return a;
}

// ---------- Työtilat heading: refresh as an icon (round 1) ----------

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
let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: "fi" | "en" = params.get("lang") === "en" ? "en" : "fi";
let reviewWorld: WorldKind = (["ordinary", "like", "crowded"] as const).find((w) => w === params.get("world")) ?? "ordinary";
let reviewBrowser: BrowserKind = (["idle", "agent", "ask"] as const).find((b) => b === params.get("browser")) ?? "idle";
const hParam = Number(params.get("h"));
let reviewHeight: number = hParam >= 560 && hParam <= 1600 ? hParam : bare ? 0 : 900;

function Main({ d, t, lang, w, browser, onAdapt }: { d: number; t: Text; lang: "fi" | "en"; w: World; browser: BrowserKind; onAdapt: (a: Adapt | undefined) => void }) {
  const location = useLocation();
  const first = w.convs.find((c) => c.state === "working") ?? w.convs[0];
  const open = new URLSearchParams(location.search).get("conversation") ?? first.id;
  const conv = w.convs.find((c) => c.id === open) ?? first;
  const s = useText(statusText).rail;
  const sw = useText(switcherText);
  const status = useText(statusText);
  const shares = useText(sharesText);
  const resources = useText(agentResourcesText);
  // Hiljaiset folds itself while the rail is crowded, as in production.
  const [choice, setChoice] = useState<boolean | undefined>(undefined);
  const [crowded, setCrowded] = useState(false);
  const folded = choice ?? crowded;
  const [filter, setFilter] = useState("");

  const rows = w.convs.map((c) => ({ c, m: model(c, conv.id, lang, s) }));
  const yours = rows.filter((r) => r.c.state === "reply" || r.c.state === "question").map((r) => r.m);
  const running = rows.filter((r) => r.c.state === "working").map((r) => r.m);
  const quiet = rows.filter((r) => r.c.state === "idle").map((r) => r.m);
  const listed = w.workspaces.map((n) => ({ id: n, name: n, icon: iconOf(n) }));
  const counts: Counts = { quiet: quiet.length, convAll: w.convs.length, ws: w.workspaces.length };
  const adapt = useAdapt(d, counts, [w, lang, browser]);
  useEffect(() => onAdapt(adapt), [adapt, onAdapt]);
  // Before the first measurement the height alone decides, as in A.
  const step: Step = adapt?.step ?? stepByHeight(window.innerHeight);

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
        <Head step={step} lang={lang} browser={browser} />
        <Measure lang={lang} browser={browser} />
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
      crowding={{ quietRows: quiet.length, onChange: setCrowded }}
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
  return (
    <StatusBellProvider items={[]}>
      <div
        className="rsp-shell"
        data-direction={d}
        data-step={d === 3 ? undefined : step}
        data-filter={filterShown ? "shown" : "hidden"}
        style={adapt && d !== 3 ? ({ "--rsp-ws-floor": `${adapt.floor}px` } as React.CSSProperties) : undefined}
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
      <Toast />
    </StatusBellProvider>
  );
}

/** The rule in words, for the step on screen. */
function Rule({ t, d, a, ws }: { t: Text; d: number; a: Adapt | undefined; ws: number }) {
  if (d === 3) return <p className="rsp-rule" data-testid="rsp-rule">{t.why.now}</p>;
  if (!a) return <p className="rsp-rule" data-testid="rsp-rule">…</p>;
  const why = d === 0 ? t.why.a(BREAKS) : d === 1 ? t.why.b(a.needTiles, a.needRows) : t.why.c(BREAKS);
  return (
    <p className="rsp-rule" data-testid="rsp-rule" data-step={a.step}>
      {t.rule(a.railH, t.steps[a.step], why, ws, a.floorRows)}
    </p>
  );
}

function Breaks({ t, d, a }: { t: Text; d: number; a: Adapt | undefined }) {
  if (d === 3) return null;
  // The rail heights at which the step changes: fixed for A and C, from the
  // content for B.
  const b = d === 1 && a ? [a.needTiles, a.needRows] : [...BREAKS];
  const min = 560;
  const max = 1600;
  const pos = (h: number) => `${((Math.min(max, Math.max(min, h)) - min) / (max - min)) * 100}%`;
  return (
    <div className="rsp-breaks" data-testid="rsp-breaks" aria-hidden="true">
      {[0, 1, 2].map((s) => {
        const from = s === 0 ? min : b[s - 1];
        const to = s === 2 ? max : b[s];
        return (
          <span key={s} className="rsp-break-band" data-current={a?.step === s || undefined}
            style={{ left: pos(from), width: `calc(${pos(to)} - ${pos(from)})` }}>
            {t.steps[s]}
          </span>
        );
      })}
      {a ? <span className="rsp-break-now" style={{ left: pos(a.railH) }} /> : null}
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

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(reviewLanguage);
  const [kind, setKind] = useState(reviewWorld);
  const [height, setHeight] = useState(reviewHeight);
  const [browser, setBrowser] = useState(reviewBrowser);
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
  const first = w.convs.find((c) => c.state === "working") ?? w.convs[0];
  const wsSeen = useWsSeen([adapt, height, kind, direction]);
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
              <input type="range" min={560} max={1600} step={10} value={height || 900} aria-label={t.height} data-testid="rsp-height" onChange={(e) => setH(Number(e.target.value))} />
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
                {i < 3 ? <b className="rsp-count"> {t.rows(ROWS[720][i], ROWS[1080][i], ROWS[720][3], ROWS[1080][3])}</b> : null}
              </li>
            ))}
          </ol>
          <p className="rsp-recommend" data-testid="recommendation">{t.recommend}</p>
          <Breaks t={t} d={direction} a={adapt} />
          <Rule t={t} d={direction} a={adapt} ws={wsSeen} />
        </header>
      )}
      <div className="rsp-stage">
        <MemoryRouter initialEntries={[`/workspaces/${first.ws}?conversation=${first.id}`]}>
          <Main key={`${direction}-${language}-${kind}`} d={direction} t={t} lang={language} w={w} browser={browser} onAdapt={setAdapt} />
        </MemoryRouter>
      </div>
    </div>
  );
}

/** Workspace rows wholly in sight, for the rule line. */
function useWsSeen(deps: unknown[]) {
  const [n, setN] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: recount when the layout changes.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const box = document.querySelector(".ah-rail-ws-scroll")?.getBoundingClientRect();
      if (!box) return;
      setN([...document.querySelectorAll(".ah-rail .ah-workspace-list > li")].filter((li) => {
        const r = li.getBoundingClientRect();
        return r.top >= box.top - 1 && r.bottom <= box.bottom + 1;
      }).length);
    });
    return () => cancelAnimationFrame(id);
  }, deps);
  return n;
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
