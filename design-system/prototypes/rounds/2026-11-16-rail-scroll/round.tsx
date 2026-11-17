import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import type { Workspace } from "../../../../web/src/app/snapshot";
import { AccountShelf } from "../../../../web/src/components/Account";
import {
  AssistantMessage,
  ConversationTimeline,
  UserMessage,
} from "../../../../web/src/components/Conversation";
import {
  ConversationFrame,
  ConversationStream,
} from "../../../../web/src/components/ConversationFrame";
import { Markdown } from "../../../../web/src/components/Markdown";
import {
  AgentHeader,
  type AgentNavModel,
  AppShell,
  NowSections,
  WorkspaceNavRow,
  WorkspaceRail,
} from "../../../../web/src/components/Navigation";
import { QuietSection } from "../../../../web/src/components/QuietSection";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { SearchDoor } from "../../../../web/src/components/Switcher";
import { WorkspaceActions } from "../../../../web/src/components/WorkspaceActions";
import type { WorkspaceIconModel } from "../../../../web/src/components/WorkspaceIcon";
import { Composer } from "../../../../web/src/components/composer/Composer";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { statusText } from "../../../../web/src/text/status";
import { navigationText } from "../../../../web/src/text/navigation";
import { quietRailText } from "../../../../web/src/text/quietRail";
import { switcherText } from "../../../../web/src/text/switcher";
import "../../../../web/src/components/components.css";
import { TEXT, type Text, TITLES, WORKSPACES } from "./text";
import "./round.css";

// rail-scroll-region, round 1. Jari 16.11.2026: today the whole rail
// scrolls, so after scrolling down to the workspaces the conversation
// sections leave sight and it looks as if every active conversation had
// vanished. He wants the workspace section itself to scroll. One view: the
// production rail (WorkspaceRail, SearchDoor, NowSections, QuietSection,
// WorkspaceNavRow with WorkspaceActions) beside an open conversation, in a
// crowded and an ordinary world. The directions differ only in which parts
// of the rail scroll: round-own are a wrapper round the conversation
// sections, the per-direction CSS, the scroll edge cues, direction 3's
// cap and Show all, and the reveal of the row Alt+↑/↓ opens (production's
// rail keys do not scroll their target into view today).
setPersonalLanguage("fi");

const directions = ["Työtilat", "Laatikot", "Katto"];
const params = new URLSearchParams(location.search);

// ---------- The synthetic world ----------

type State = "reply" | "question" | "working" | "idle";
type Conv = { id: string; n: number; ws: string; state: State; age: number; worktree?: boolean };
type World = { convs: Conv[]; workspaces: string[] };
const EMOJI = ["🗺️", "📒", "🏠", "🧾", "📦", "🛒", "📰", "🧪", "📊", "🔧", "🎨", "📷", "🗓️", "🍲"];

function world(kind: "crowded" | "modest"): World {
  const workspaces =
    kind === "crowded" ? WORKSPACES : WORKSPACES.filter((_, i) => i % 5 !== 3).slice(0, 24);
  const plan: [number[], State | "yours"][] =
    kind === "crowded"
      ? [
          [[0, 1, 2, 3, 4, 5], "yours"],
          [[6, 7, 8, 9, 10], "working"],
          [Array.from({ length: 30 }, (_, i) => 11 + i), "idle"],
        ]
      : [
          [[0, 1], "yours"],
          [[6], "working"],
          [[11, 12, 13, 14, 15], "idle"],
        ];
  const convs: Conv[] = [];
  for (const [ns, state] of plan)
    for (const n of ns)
      convs.push({
        id: `c${n}`,
        n,
        ws: workspaces[(n * 7 + 3) % workspaces.length],
        state: state === "yours" ? (n % 2 ? "question" : "reply") : state,
        age: state === "working" ? 1 + n : n * n * 3 + 5,
        worktree: [7, 9, 13, 20, 27].includes(n),
      });
  return { convs, workspaces };
}
const START = "c6";
const NOW0 = Date.now();
const hrefOf = (c: Conv) => `/workspaces/${c.ws}?conversation=${c.id}`;

function iconOf(name: string): WorkspaceIconModel {
  const i = WORKSPACES.indexOf(name);
  const letters = name
    .split("-")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toLocaleUpperCase("fi");
  return i % 3 === 0
    ? { name, glyph: { letters, hue: (i * 47) % 360 }, show: { kind: "emoji", value: EMOJI[i % EMOJI.length] }, source: "config", where: ".open-habitat.yaml" }
    : { name, glyph: { letters, hue: (i * 47) % 360 }, show: { kind: "glyph" }, source: "derived" };
}

type Words = ReturnType<typeof useText<typeof statusText>>["rail"];
function model(c: Conv, open: string, lang: "fi" | "en", s: Words): AgentNavModel {
  const label =
    c.state === "working" ? s.working : c.state === "reply" ? s.newReply : c.state === "question" ? s.asks : "";
  return {
    agentId: c.id,
    href: hrefOf(c),
    title: TITLES[c.n][lang === "fi" ? 0 : 1],
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
    worktree: c.worktree
      ? { merged: false, work: { text: lang === "fi" ? "2 muutosta" : "2 changes", tone: "work" } }
      : undefined,
  };
}

const field = () => document.querySelector<HTMLTextAreaElement>('[data-testid="message-input"]');
const rowOf = (id: string) =>
  document.querySelector<HTMLElement>(`.ah-rail [data-testid="agent-item-${id}"]`);

// ---------- Scroll edge cues ----------

/** Marks every scrolling region of the rail with what lies beyond its
 * edges, so the CSS can shade the edge that hides rows. Only an element
 * whose own overflow scrolls is a region. */
function updateEdges() {
  for (const el of document.querySelectorAll<HTMLElement>(
    ".ah-rail .rs-convs, .ah-rail .rs-convs .ah-now, .ah-rail .ah-workspace-list",
  )) {
    const scrolls = getComputedStyle(el).overflowY === "auto" && el.scrollHeight > el.clientHeight + 1;
    el.toggleAttribute("data-rs-region", scrolls);
    el.toggleAttribute("data-above", scrolls && el.scrollTop > 1);
    el.toggleAttribute("data-below", scrolls && el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  }
}

// ---------- Direction 1: what lies beyond the region's edges ----------

type Edge = "above" | "below";
const BEYOND_H = 26;
/** The conversation sections with rows past one edge of their region, and
 * how many: direction 1 names them at that edge, so a crowded rail never
 * looks as if those conversations had gone. */
function rowsBeyond(edge: Edge): Partial<Record<SectionKey, number>> {
  const region = document.querySelector<HTMLElement>(".ah-rail .rs-convs");
  if (!region || !region.hasAttribute("data-rs-region")) return {};
  const box = region.getBoundingClientRect();
  // The cue's own height (round.css), whether it shows or not, so that its
  // coming and going never changes what it counts.
  const line = edge === "below" ? box.bottom - BEYOND_H : box.top + BEYOND_H;
  const past = (r: DOMRect) => (edge === "below" ? r.top + 8 >= line : r.bottom - 8 <= line);
  const out: Partial<Record<SectionKey, number>> = {};
  for (const key of Object.keys(SECTION) as SectionKey[]) {
    const section = region.querySelector<HTMLElement>(`[data-testid="${SECTION[key]}"]`);
    if (!section) continue;
    const rows = [...section.querySelectorAll<HTMLElement>('li[data-testid^="agent-item-"]')];
    let n = rows.filter((li) => past(li.getBoundingClientRect())).length;
    // A folded Hiljaiset (no rows drawn) out of sight still has its
    // conversations: say its count.
    const head = section.querySelector("h2");
    if (!rows.length && head && past(head.getBoundingClientRect()))
      n = Number(head.querySelector(".ah-rail-count")?.textContent?.match(/\d+/)?.[0] ?? 0);
    if (n) out[key] = n;
  }
  return out;
}

function Beyond({
  edge,
  rows,
  t,
  names,
}: {
  edge: Edge;
  rows: Partial<Record<SectionKey, number>>;
  t: Text;
  names: Record<SectionKey, string>;
}) {
  const keys = Object.keys(rows) as SectionKey[];
  if (!keys.length) return null;
  return (
    <div className="rs-beyond" data-edge={edge} data-testid={`rs-${edge}`}>
      <span aria-hidden="true">{edge === "below" ? "↓" : "↑"}</span>
      <span className="ah-visually-hidden">{edge === "below" ? t.below : t.above}</span>
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          data-testid={`rs-${edge}-${key}`}
          aria-label={t.beyondJump(names[key], rows[key] ?? 0, edge)}
          onClick={() =>
            document
              .querySelector(`.ah-rail [data-testid="${SECTION[key]}"]`)
              ?.scrollIntoView({ block: "start" })
          }
        >
          {names[key]} <b>{rows[key]}</b>
        </button>
      ))}
    </div>
  );
}

// ---------- Direction 3: caps ----------

// Rows each section shows before Show all, by the height of the rail's
// content box: a 900 px window, a 700 px one, and anything shorter.
const CAPS = [
  { from: 620, yours: 4, running: 3, quiet: 3 },
  { from: 440, yours: 3, running: 2, quiet: 2 },
  { from: 0, yours: 2, running: 1, quiet: 1 },
];
type SectionKey = "yours" | "running" | "quiet";
const SECTION: Record<SectionKey, string> = {
  yours: "rail-yours",
  running: "rail-running",
  quiet: "rail-quiet",
};

/** Hides the rows past each section's cap, never the open one, and says
 * how many each hides. The cap is lower when the rail is short. */
function applyCaps(on: boolean, expanded: Set<SectionKey>) {
  const content = document.querySelector<HTMLElement>(".ah-rail-content");
  const h = content?.clientHeight ?? 900;
  const caps = CAPS.find((c) => h >= c.from) ?? CAPS[CAPS.length - 1];
  const hidden: Partial<Record<SectionKey, number>> = {};
  for (const key of Object.keys(SECTION) as SectionKey[]) {
    const section = document.querySelector<HTMLElement>(`.ah-rail [data-testid="${SECTION[key]}"]`);
    const rows = section
      ? [...section.querySelectorAll<HTMLElement>('li[data-testid^="agent-item-"]')]
      : [];
    let n = 0;
    rows.forEach((li, i) => {
      const cut =
        on && !expanded.has(key) && i >= caps[key] && !li.querySelector('[aria-current="page"]');
      li.toggleAttribute("data-rs-capped", cut);
      if (cut) n++;
    });
    hidden[key] = n;
  }
  return hidden;
}

function ShowAll({
  t,
  hidden,
  expanded,
  onToggle,
}: {
  t: Text;
  hidden: Partial<Record<SectionKey, number>>;
  expanded: Set<SectionKey>;
  onToggle: (k: SectionKey) => void;
}) {
  return (
    <>
      {(Object.keys(SECTION) as SectionKey[]).map((key) => {
        const section = document.querySelector<HTMLElement>(`.ah-rail [data-testid="${SECTION[key]}"]`);
        const n = hidden[key] ?? 0;
        if (!section || section.hasAttribute("data-folded") || (!n && !expanded.has(key))) return null;
        return createPortal(
          <button
            type="button"
            className="rs-show-all"
            data-testid={`show-all-${key}`}
            aria-expanded={expanded.has(key)}
            onClick={() => onToggle(key)}
          >
            {expanded.has(key) ? t.showLess : t.showAll(n)}
          </button>,
          section,
          key,
        );
      })}
    </>
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
            {
              id: "a",
              kind: "assistant",
              content: (
                <AssistantMessage onCopy={noop}>
                  <Markdown text={t.said} />
                </AssistantMessage>
              ),
            },
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

let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: "fi" | "en" = params.get("lang") === "en" ? "en" : "fi";
let reviewWorld: "crowded" | "modest" = params.get("world") === "modest" ? "modest" : "crowded";
// "window" fills the browser below the review bar; hNNN makes the shell
// NNN px tall, so a 900 or 700 px window can be seen on any screen.
let reviewHeight: string = /^h\d{3,4}$/.test(params.get("height") ?? "")
  ? (params.get("height") as string)
  : "window";
const HEIGHTS = ["window", "h900", "h700", "h560"];
let reviewFolded = params.get("quiet") === "folded";

const altArrow = (e: KeyboardEvent) =>
  e.altKey && !e.ctrlKey && !e.metaKey && !e.isComposing && (e.code === "ArrowDown" || e.code === "ArrowUp");

function Main({ d, t, lang, w }: { d: number; t: Text; lang: "fi" | "en"; w: World }) {
  const navigate = useNavigate();
  const location = useLocation();
  const open = new URLSearchParams(location.search).get("conversation") ?? START;
  const conv = w.convs.find((c) => c.id === open) ?? w.convs.find((c) => c.id === START)!;
  const s = useText(statusText).rail;
  const sw = useText(switcherText);
  const status = useText(statusText);
  const [folded, setFolded] = useState(reviewFolded);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<SectionKey>>(new Set());
  const [hidden, setHidden] = useState<Partial<Record<SectionKey, number>>>({});
  const [, resized] = useState(0);
  const [beyond, setBeyond] = useState<Record<Edge, Partial<Record<SectionKey, number>>>>({
    above: {},
    below: {},
  });
  const nav = useText(navigationText);
  const quietWords = useText(quietRailText);
  const sectionName: Record<SectionKey, string> = {
    yours: nav.yourTurn,
    running: nav.running,
    quiet: quietWords.title,
  };

  const rows = w.convs.map((c) => ({ c, m: model(c, conv.id, lang, s) }));
  const yours = rows.filter((r) => r.c.state === "reply" || r.c.state === "question");
  const running = rows.filter((r) => r.c.state === "working");
  const quiet = rows.filter((r) => r.c.state === "idle");

  // Production's rail order (railKeyboardOrder): a folded Hiljaiset keeps
  // only the open row. Direction 3's capped rows stay destinations: the
  // cap never hides the open row, so the key shows the row it opens.
  const order = [
    ...yours,
    ...running,
    ...(folded ? quiet.filter((r) => r.c.id === conv.id) : quiet),
  ].map((r) => r.c);
  const state = useRef({ open: conv.id, order });
  state.current.order = order;
  useEffect(() => {
    state.current.open = conv.id;
  }, [conv.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!altArrow(e) || e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      const { open: now, order: list } = state.current;
      const dir = e.code === "ArrowDown" ? 1 : -1;
      let next: Conv | undefined;
      if (e.shiftKey) {
        const ys = list.filter((c) => c.state === "reply" || c.state === "question");
        const at = ys.findIndex((c) => c.id === now);
        next = ys[at < 0 ? (dir > 0 ? 0 : ys.length - 1) : (at + dir + ys.length) % ys.length];
      } else {
        const at = list.findIndex((c) => c.id === now);
        next = list[at < 0 ? 0 : at + dir];
      }
      if (!next || next.id === now) return;
      // Held keys repeat faster than the view redraws: step from the target.
      state.current.open = next.id;
      field()?.focus({ preventScroll: true });
      navigate(hrefOf(next));
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [navigate]);

  // Every render: direction 3's caps, then the edge cues.
  useLayoutEffect(() => {
    const h = applyCaps(d === 2, expanded);
    if (JSON.stringify(h) !== JSON.stringify(hidden)) setHidden(h);
    updateEdges();
    if (d === 0) {
      const b = { above: rowsBeyond("above"), below: rowsBeyond("below") };
      if (JSON.stringify(b) !== JSON.stringify(beyond)) setBeyond(b);
    }
  });
  useEffect(() => {
    const again = () => resized((x) => x + 1);
    // On load and when the window changes height, the open row is brought
    // into sight again, after the regions (and direction 1's foot) settle.
    const reveal = () => {
      again();
      requestAnimationFrame(() =>
        requestAnimationFrame(() => rowOf(state.current.open)?.scrollIntoView({ block: "nearest" })),
      );
    };
    reveal();
    window.addEventListener("resize", reveal);
    const stage = document.querySelector(".rs-stage .ah-rail-content");
    const o = new ResizeObserver(reveal);
    if (stage) o.observe(stage);
    const onScroll = () => {
      updateEdges();
      again();
    };
    document.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", reveal);
      o.disconnect();
      document.removeEventListener("scroll", onScroll, true);
    };
  }, []);
  // The row the person opened is revealed in whichever region holds it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the open row changes.
  useEffect(() => {
    rowOf(conv.id)?.scrollIntoView({ block: "nearest" });
  }, [conv.id]);

  const shown = w.workspaces.filter((n) => n.includes(filter.toLocaleLowerCase()));
  const rail = (
    <WorkspaceRail
      collapsed={false}
      serverLabel="Habitat"
      connectionLabel={status.connected}
      connectionTone="success"
      filterValue={filter}
      resultSummary={`${shown.length}`}
      listState={shown.length ? "ready" : "filtered-empty"}
      onToggle={noop}
      onFilter={setFilter}
      onRefresh={noop}
      onCreateWorkspace={noop}
      sessionActions={
        <AccountShelf
          profile={{ name: "Esimerkki Käyttäjä", email: "", avatar_url: "" }}
          onSettings={noop}
          onLogout={noop}
        />
      }
      now={
        <>
          <SearchDoor label={sw.door} keyHint="Ctrl+K" onOpen={noop} />
          <div className="rs-convs" data-testid="rs-convs">
            {d === 0 ? <Beyond edge="above" rows={beyond.above} t={t} names={sectionName} /> : null}
            <NowSections
              yours={yours.map((r) => r.m)}
              running={running.map((r) => r.m)}
              quiet={
                <QuietSection
                  rows={quiet.map((r) => r.m)}
                  workspaces={w.workspaces.map((n) => ({ id: n, name: n, icon: iconOf(n) }))}
                  choice={{ sort: "newest", workspace: null }}
                  folded={folded}
                  onFold={(f) => {
                    reviewFolded = f;
                    setFolded(f);
                  }}
                />
              }
            />
            {d === 0 ? <Beyond edge="below" rows={beyond.below} t={t} names={sectionName} /> : null}
          </div>
        </>
      }
    >
      {shown.map((n) => (
        <WorkspaceNavRow
          key={n}
          name={n}
          href={`/workspaces/${n}`}
          icon={iconOf(n)}
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
  const title = TITLES[conv.n][lang === "fi" ? 0 : 1];
  return (
    <StatusBellProvider items={[]}>
      <div className="rs-shell" data-direction={d}>
        <AppShell
          mobileTitle={title}
          rail={rail}
          navigationBadge={yours.length}
          main={
            <div className="rs-main" id="main">
              <Conversation key={conv.id} title={title} ws={conv.ws} working={conv.state === "working"} t={t} />
            </div>
          }
        />
      </div>
      {d === 2 ? (
        <ShowAll
          t={t}
          hidden={hidden}
          expanded={expanded}
          onToggle={(k) =>
            setExpanded((x) => {
              const y = new Set(x);
              if (y.has(k)) y.delete(k);
              else y.add(k);
              return y;
            })
          }
        />
      ) : null}
    </StatusBellProvider>
  );
}

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(reviewLanguage);
  const [kind, setKind] = useState(reviewWorld);
  const [height, setHeight] = useState(reviewHeight);
  const bar = useRef<HTMLElement>(null);
  const t = TEXT[language];
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () =>
      document.documentElement.style.setProperty("--review-h", `${el.getBoundingClientRect().height}px`);
    set();
    const o = new ResizeObserver(set);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useLayoutEffect(() => {
    const px = height === "window" ? "" : `${height.slice(1)}px`;
    if (px) document.documentElement.style.setProperty("--rs-sim", px);
    else document.documentElement.style.removeProperty("--rs-sim");
    document.documentElement.toggleAttribute("data-rs-sim", !!px);
  }, [height]);
  const w = world(kind);
  return (
    <div className="rs-review" data-direction={direction} data-world={kind}>
      <header className="rs-bar" ref={bar}>
        <div className="rs-controls">
          <strong>{t.title}</strong>
          <label>
            {t.world}{" "}
            <select
              id="world"
              value={kind}
              onChange={(e) => {
                reviewWorld = e.target.value as typeof reviewWorld;
                setKind(reviewWorld);
              }}
            >
              <option value="crowded">{t.worlds.crowded}</option>
              <option value="modest">{t.worlds.modest}</option>
            </select>
          </label>
          <label>
            {t.height}{" "}
            <select
              id="height"
              value={height}
              onChange={(e) => {
                reviewHeight = e.target.value;
                setHeight(reviewHeight);
              }}
            >
              {(HEIGHTS.includes(height) ? HEIGHTS : [...HEIGHTS, height]).map((v) => (
                <option key={v} value={v}>
                  {v === "window" ? t.heights.window : `${v.slice(1)} px`}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.theme}{" "}
            <select
              id="theme"
              value={theme}
              onChange={(e) => {
                reviewTheme = e.target.value as typeof reviewTheme;
                setTheme(reviewTheme);
              }}
            >
              {(["light", "dark", "contrast"] as const).map((v) => (
                <option key={v} value={v}>
                  {t.themes[v]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.language}{" "}
            <select
              id="language"
              value={language}
              onChange={(e) => {
                reviewLanguage = e.target.value as "fi" | "en";
                setPersonalLanguage(reviewLanguage);
                setLanguage(reviewLanguage);
              }}
            >
              <option value="fi">suomi</option>
              <option value="en">English</option>
            </select>
          </label>
          <span className="rs-try">{t.tryIt}</span>
        </div>
        <ol className="rs-lines" data-testid="direction-lines">
          {t.lines.map((l, i) => (
            <li key={i} aria-current={i === direction ? "true" : undefined}>
              {l}
            </li>
          ))}
        </ol>
        <p className="rs-recommend" data-testid="recommendation">
          {t.recommend}
        </p>
      </header>
      <div className="rs-stage">
        <MemoryRouter initialEntries={[`/workspaces/${w.convs.find((c) => c.id === START)!.ws}?conversation=${START}`]}>
          <Main key={`${direction}-${language}-${kind}`} d={direction} t={t} lang={language} w={w} />
        </MemoryRouter>
      </div>
    </div>
  );
}

// ---------- Host stand-in: only what the production shell asks for ----------

const json = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, "http://prototype.test/").pathname;
  if (!path.startsWith("/api/")) return realFetch(input, init);
  if (path === "/api/v1/server")
    return json({ schema_version: 1, name: "Habitat", administrator: false, version: "0.0.0-proto" });
  return new Response("", { status: 404 });
};

if (reviewLanguage === "en") setPersonalLanguage("en");
const root = createRoot(document.getElementById("root")!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {
  set innerHTML(view: React.ReactNode) {
    flushSync(() => root.render(view === "" ? null : view));
  },
};
const start = Math.max(0, Math.min(2, Number(params.get("d") ?? 0) || 0));
const variants = directions.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement("nav");
picker.className = "proto-picker";
picker.setAttribute("aria-label", "Prototype variants");
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {
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
