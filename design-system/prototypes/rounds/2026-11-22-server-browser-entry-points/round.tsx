import React, { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import {
  type BrowserStatus,
  type BrowserWindow,
  summarize,
} from "../../../../web/src/app/serverBrowser";
import { AccountShelf } from "../../../../web/src/components/Account";
import {
  AssistantMessage,
  Composer,
  ConversationTimeline,
  ToolRow,
  UserMessage,
} from "../../../../web/src/components/Conversation";
import { ConversationFrame, ConversationStream } from "../../../../web/src/components/ConversationFrame";
import { Icon } from "../../../../web/src/components/Icon";
import { Markdown } from "../../../../web/src/components/Markdown";
import {
  type AgentNavModel,
  AgentHeader,
  AppShell,
  NowSections,
  WorkspaceNavRow,
  WorkspaceRail,
} from "../../../../web/src/components/Navigation";
import {
  BrowserChip,
  BrowserRailRow,
  BrowserSheet,
  BrowserStrip,
} from "../../../../web/src/components/ServerBrowser";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { setPersonalLanguage } from "../../../../web/src/i18n";
import "../../../../web/src/components/components.css";
import { type Conv, type Scene, TEXT, type Text } from "./text";
import "./round.css";

// server-browser-entry-points, round 1 (Claude redo, 22.11.2026). The
// experimental server browser has two doors today: the top row of the
// sidebar (ServerBrowserRail) and the chip above the composer in every
// conversation (ServerBrowserDock), which show the same whole browser. The
// axis here is which door the browser has and what each one is for:
//   1 Chip: the chip in every conversation is the browser's home; the
//     sidebar shows a row only while a window waits for you, naming the
//     conversation that asked.
//   2 Row: the sidebar row is the only door; the conversation whose agent
//     uses the browser shows that work in its own timeline (its windows and
//     its request), and other conversations show nothing.
//   3 Two: the sidebar row is the whole browser; a chip appears only in the
//     conversation whose agent uses the browser, scoped to its windows.
// The chip, strip, rail row and sheet are the production components fed a
// synthetic BrowserStatus; the attention row (1), the timeline frame (2) and
// the scope line (3) are this round's. Which conversation a window belongs
// to is read from that conversation's own browser commands (`agent browser
// goto` returns the tab, `agent browser request --window` names it); the
// host's status has no conversation in it. Synthetic content throughout.
setPersonalLanguage("fi");

const directions = ["1 Siru", "2 Rivi", "3 Kaksi"];
const params = new URLSearchParams(location.search);
const noop = () => {};

// ---------- The synthetic browser ----------

type WinKey = "laskut" | "kirjaudu" | "kirjasto";
const WIN: Record<WinKey, { id: string; origin: string }> = {
  laskut: { id: "7F2A", origin: "energia.example" },
  kirjaudu: { id: "9C41", origin: "tunnistus.example" },
  kirjasto: { id: "3B10", origin: "kirjasto.example" },
};
const keyOf = (id: string) => (Object.keys(WIN) as WinKey[]).find((k) => WIN[k].id === id) ?? "laskut";
/** The tabs conversation A's agent opened, as its own commands returned them. */
const OWN_A = [WIN.laskut.id, WIN.kirjaudu.id];

/** `resumed` is the agent carrying on after the person gave the browser back. */
type Phase = Scene | "resumed";
type World = { phase: Phase; mine: boolean };

const win = (t: Text, k: WinKey, agent = false): BrowserWindow => ({ id: WIN[k].id, title: t.windows[k], origin: WIN[k].origin, agent });

function status(t: Text, w: World): BrowserStatus {
  const base = { schema_version: 1 as const, survives_restart: true };
  switch (w.phase) {
    case "stopped":
      return { ...base, state: "stopped", agent_connected: false, windows: [] };
    case "idle":
      return { ...base, state: "running", control: w.mine ? "person" : "agent", agent_connected: false, windows: [win(t, "kirjasto")] };
    case "agent":
    case "resumed":
      return {
        ...base,
        state: "running",
        control: w.mine ? "person" : "agent",
        agent_connected: true,
        windows: [win(t, "laskut", true), win(t, "kirjasto")],
        pointer: { window: WIN.laskut.id, x: 0.62, y: 0.44, age_ms: 300, clicks: [{ x: 0.62, y: 0.44, age_ms: 300 }] },
      };
    default:
      return {
        ...base,
        state: "running",
        control: w.mine ? "person" : "agent",
        agent_connected: true,
        windows: [win(t, "laskut"), win(t, "kirjaudu", true), win(t, "kirjasto")],
        request: { window: WIN.kirjaudu.id, text: t.a.requestText, age_ms: 40_000 },
      };
  }
}

/** Only what conversation A's own commands name: its tabs and its request. */
function scoped(s: BrowserStatus): BrowserStatus {
  const windows = s.windows.filter((x) => OWN_A.includes(x.id));
  return {
    ...s,
    windows,
    request: s.request && OWN_A.includes(s.request.window) ? s.request : undefined,
    pointer: s.pointer && OWN_A.includes(s.pointer.window) ? s.pointer : undefined,
  };
}

/** A page's picture: a plain drawn page, standing in for the window JPEG. */
function picture(t: Text, k: WinKey, big = false) {
  const [head, line, button] = t.sheetPage[k];
  const hue = k === "kirjasto" ? "#3d6b4f" : k === "kirjaudu" ? "#3b4f7a" : "#8a4b1f";
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><rect width="640" height="400" fill="#fbfaf7"/><rect width="640" height="56" fill="${hue}"/><text x="28" y="36" font-family="sans-serif" font-size="20" fill="#fff">${esc(WIN[k].origin)}</text><text x="40" y="120" font-family="sans-serif" font-size="30" fill="#222">${esc(head)}</text><text x="40" y="170" font-family="sans-serif" font-size="20" fill="#555">${esc(line)}</text><rect x="40" y="200" width="420" height="10" rx="5" fill="#e4e1da"/><rect x="40" y="224" width="360" height="10" rx="5" fill="#e4e1da"/><rect x="40" y="290" width="${big ? 200 : 180}" height="48" rx="8" fill="${hue}"/><text x="60" y="321" font-family="sans-serif" font-size="18" fill="#fff">${esc(button)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
const picturesOf = (t: Text, s: BrowserStatus) =>
  Object.fromEntries(s.windows.map((x) => [x.id, picture(t, keyOf(x.id))]));

// ---------- Language and review state ----------

let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: "fi" | "en" = params.get("lang") === "en" ? "en" : "fi";
const firstScene = (params.get("scene") as Scene) || "ask";
const LangContext = React.createContext<"fi" | "en">("fi");
const useT = () => TEXT[React.useContext(LangContext)];
const sceneWorld = (s: Scene): World => (s === "person" ? { phase: "ask", mine: true } : { phase: s, mine: false });
const sceneOf = (w: World): Scene | "" =>
  w.phase === "resumed" ? "" : w.phase === "ask" && w.mine ? "person" : w.mine ? "" : (w.phase as Scene);

// ---------- The conversations ----------

type Tool = { cmd: string; state: "succeeded" | "running" };
type Item =
  | { k: "you"; id: string; text: string; at: string }
  | { k: "agent"; id: string; text: string; at: string; live?: boolean }
  | { k: "tool"; id: string; tool: Tool };

const GOTO = "open-habitat agent browser goto https://energia.example/laskut --json";
const TEXTCMD = `open-habitat agent browser text --tab ${WIN.laskut.id} --json`;
const REQ = `open-habitat agent browser request --window ${WIN.kirjaudu.id} --text-file pyynto.txt --json`;
const AGAIN = `open-habitat agent browser links --tab ${WIN.laskut.id} --json`;

function itemsA(t: Text, phase: Phase): Item[] {
  const you: Item = { k: "you", id: "a1", text: t.a.ask, at: "9.12" };
  if (phase === "agent")
    return [you, { k: "agent", id: "a2", text: t.a.working, at: "9.12", live: true }, { k: "tool", id: "t1", tool: { cmd: GOTO, state: "running" } }];
  const toLogin: Item[] = [
    you,
    { k: "tool", id: "t1", tool: { cmd: GOTO, state: "succeeded" } },
    { k: "tool", id: "t2", tool: { cmd: TEXTCMD, state: "succeeded" } },
    { k: "tool", id: "t3", tool: { cmd: REQ, state: "succeeded" } },
    { k: "agent", id: "a3", text: t.a.toLogin, at: "9.14" },
  ];
  if (phase === "ask") return toLogin;
  if (phase === "resumed") return [...toLogin, { k: "tool", id: "t4", tool: { cmd: AGAIN, state: "running" } }];
  return [...toLogin, { k: "tool", id: "t4", tool: { cmd: AGAIN, state: "succeeded" } }, { k: "agent", id: "a4", text: t.a.finished, at: "9.31" }];
}
const itemsB = (t: Text): Item[] => [
  { k: "you", id: "b1", text: t.b.ask, at: "8.40" },
  { k: "agent", id: "b2", text: t.b.reply, at: "8.42" },
];

function Thread({ items, extra }: { items: Item[]; extra?: ReactNode }) {
  const t = useT();
  const rows = items.map((i) => {
    if (i.k === "you")
      return {
        id: i.id,
        kind: "user",
        content: (
          <UserMessage sourceText={i.text} onCopy={noop} time={i.at}>
            <Markdown text={i.text} />
          </UserMessage>
        ),
      };
    if (i.k === "agent")
      return {
        id: i.id,
        kind: "assistant",
        content: (
          <AssistantMessage streamState={i.live ? "streaming" : "complete"} time={i.at} onCopy={noop}>
            <Markdown text={i.text} />
          </AssistantMessage>
        ),
      };
    return {
      id: i.id,
      kind: "tool",
      content: (
        <ToolRow
          name="bash"
          targetText={i.tool.cmd}
          statusLabel={i.tool.state === "running" ? t.running : t.tool}
          state={i.tool.state}
          expanded={false}
          onToggle={noop}
        />
      ),
    };
  });
  if (extra) rows.push({ id: "browser-trace", kind: "tool", content: <>{extra}</> });
  return (
    <ConversationTimeline
      state="ready"
      items={rows.map((r) => ({ ...r, content: <div data-item={r.id}>{r.content}</div> }))}
      historyMode="pagedAccessible"
      onJumpToLatest={noop}
      emptyLabel={null}
    />
  );
}

// ---------- The page ----------

type Act = {
  look: (window?: string) => void;
  takeFor: (window: string) => void;
  take: () => void;
  giveBack: () => void;
  start: () => void;
  stop: () => void;
};

/** The production strip, fed the given (possibly scoped) status. */
function Strip({ s, act }: { s: BrowserStatus; act: Act }) {
  const t = useT();
  return (
    <BrowserStrip
      status={s}
      summary={summarize(s)}
      pictures={picturesOf(t, s)}
      onLook={act.look}
      onTakeForRequest={act.takeFor}
      onGiveBack={act.giveBack}
    />
  );
}

/** Direction 1: the sidebar's row, only while a window waits for you. */
function AskRow({ s, onOpen }: { s: BrowserStatus; onOpen: () => void }) {
  const t = useT();
  const w = s.windows.find((x) => x.id === s.request?.window);
  return (
    <div className="sb-railrow-wrap eb-askrow">
      <button type="button" className="sb-railrow" data-state="ask" data-testid="rail-ask-row" onClick={onOpen}>
        <span className="sb-railrow-mark" aria-hidden="true">
          <Icon name="user" />
        </span>
        <span className="sb-railrow-text">
          <b>{t.railAsk(w?.title ?? "")}</b>
          <small>{t.railAskIn(t.convs.a)}</small>
        </span>
      </button>
    </div>
  );
}

/** Direction 2: the conversation's own record of its agent's browser work. */
function Trace({ s, phase, act }: { s: BrowserStatus; phase: Phase; act: Act }) {
  const t = useT();
  if (phase === "idle" || phase === "stopped")
    return (
      <p className="eb-trace-done" data-testid="trace-done">
        <Icon name="globe" />
        {t.traceDone}
      </p>
    );
  const own = scoped(s);
  return (
    <section className="eb-trace" data-testid="trace" data-ask={own.request ? "true" : undefined}>
      <p className="eb-trace-head">
        <Icon name="globe" />
        <span data-testid="trace-head">{t.traceLive(own.windows.length)}</span>
      </p>
      <Strip s={own} act={act} />
      <p className="eb-trace-where">{t.traceWhere}</p>
    </section>
  );
}

/** The chip and its strip above the field, as ServerBrowserDock lays them. */
function Dock({ s, scope, open, setOpen, act }: { s: BrowserStatus; scope?: { all: number }; open: boolean; setOpen: (v: boolean) => void; act: Act }) {
  const t = useT();
  const summary = summarize(s);
  const running = s.state === "running";
  return (
    <div className="sb-dock" data-testid="browser-dock" data-scope={scope ? "conversation" : "browser"}>
      {open && running ? (
        <>
          <Strip s={s} act={act} />
          {scope ? (
            <p className="eb-scope" data-testid="chip-scope">
              {t.scope(s.windows.length, scope.all)}
            </p>
          ) : null}
        </>
      ) : null}
      <BrowserChip status={s} summary={summary} open={open && running} onToggle={() => setOpen(!open)} onStart={act.start} />
    </div>
  );
}

/** The sheet's stand-in for the live view: the browser's tabs and the page. */
function Screen({ s, focus }: { s: BrowserStatus; focus?: string }) {
  const t = useT();
  const active = s.windows.find((x) => x.id === focus) ?? s.windows.find((x) => x.id === s.request?.window) ?? s.windows.find((x) => x.agent) ?? s.windows[0];
  if (!active) return null;
  return (
    <div className="eb-screen" data-testid="sheet-screen" data-window={active.id}>
      <div className="eb-tabs" aria-hidden="true">
        {s.windows.map((x) => (
          <span key={x.id} className="eb-tab" data-active={x.id === active.id || undefined}>
            {x.title}
          </span>
        ))}
      </div>
      <div className="eb-address" aria-hidden="true">
        {active.origin}
      </div>
      <img src={picture(t, keyOf(active.id), true)} alt="" />
    </div>
  );
}

function Main({ d, w, setW }: { d: number; w: World; setW: React.Dispatch<React.SetStateAction<World>> }) {
  const t = useT();
  const navigate = useNavigate();
  const { search } = useLocation();
  const conv: Conv = new URLSearchParams(search).get("conversation") === "b" ? "b" : "a";
  const [draft, setDraft] = useState("");
  const [sheet, setSheet] = useState<{ focus?: string }>();
  const s = status(t, w);
  const asking = !!s.request && !w.mine;
  // As in production, a new request opens the strip by itself once.
  const [stripOpen, setStripOpen] = useState(false);
  const seen = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const asked = s.request?.window;
    if (asked && asked !== seen.current) setStripOpen(true);
    seen.current = asked;
  }, [s.request?.window]);
  const go = (c: Conv) => navigate(`/workspaces/${c === "a" ? t.workspace : t.otherWorkspace}?conversation=${c}`);
  const act: Act = {
    look: (focus) => setSheet({ focus }),
    takeFor: (focus) => {
      setW((x) => ({ ...x, mine: true }));
      setSheet({ focus });
    },
    take: () => setW((x) => ({ ...x, mine: true })),
    // Giving back after a request: the person did what it asked, so the agent carries on.
    giveBack: () => setW((x) => ({ phase: x.phase === "ask" ? "resumed" : x.phase, mine: false })),
    start: () => setW({ phase: "idle", mine: false }),
    stop: () => {
      setW({ phase: "stopped", mine: false });
      setSheet(undefined);
    },
  };
  const railRow =
    d === 0 ? (
      asking ? (
        <AskRow
          s={s}
          onOpen={() => {
            go("a");
            setStripOpen(true);
          }}
        />
      ) : null
    ) : (
      <BrowserRailRow
        summary={summarize(s)}
        windows={s.windows.length}
        onOpen={() => {
          if (s.state === "stopped") act.start();
          setSheet({});
        }}
      />
    );
  const done = w.phase === "idle" || w.phase === "stopped";
  const rowA: AgentNavModel = {
    agentId: "pi:a",
    title: t.convs.a,
    href: `/workspaces/${t.workspace}?conversation=a`,
    activity: asking ? "waiting" : done ? "waiting" : "working",
    activityLabel: asking ? t.waits : done ? t.done : t.working,
    attentionLabel: asking ? t.waits : undefined,
    controlLabel: "",
    workspaceId: "ws_kotitalous00",
    workspaceName: t.workspace,
    detail: t.workspace,
    changedAt: Date.now() - 60_000,
    selected: conv === "a",
  };
  const rowB: AgentNavModel = {
    agentId: "pi:b",
    title: t.convs.b,
    href: `/workspaces/${t.otherWorkspace}?conversation=b`,
    activity: "waiting",
    activityLabel: t.done,
    controlLabel: "",
    workspaceId: "ws_yhdistys000",
    workspaceName: t.otherWorkspace,
    detail: t.otherWorkspace,
    changedAt: Date.now() - 32 * 60_000,
    turnMark: "read",
    selected: conv === "b",
  };
  const rail = (
    <WorkspaceRail
      collapsed={false}
      serverLabel="Habitat"
      connectionLabel=""
      connectionTone="success"
      filterValue=""
      resultSummary="2"
      listState="ready"
      onToggle={noop}
      onFilter={noop}
      onRefresh={noop}
      pages={railRow}
      now={<NowSections yours={asking || done ? [rowA, rowB] : [rowB]} running={asking || done ? [] : [rowA]} />}
      sessionActions={<AccountShelf profile={{ name: "Aino Laine", email: "", avatar_url: "" }} onSettings={noop} onLogout={noop} />}
    >
      <WorkspaceNavRow name={t.workspace} href={`/workspaces/${t.workspace}`} selected={conv === "a"} />
      <WorkspaceNavRow name={t.otherWorkspace} href={`/workspaces/${t.otherWorkspace}`} selected={conv === "b"} />
    </WorkspaceRail>
  );
  // What sits above the field, per direction.
  let dock: ReactNode = null;
  if (d === 0) dock = <Dock s={s} open={stripOpen} setOpen={setStripOpen} act={act} />;
  if (d === 2 && conv === "a" && !done)
    dock = <Dock s={scoped(s)} scope={{ all: s.windows.length }} open={stripOpen} setOpen={setStripOpen} act={act} />;
  const items = conv === "a" ? itemsA(t, w.phase) : itemsB(t);
  const trace = d === 1 && conv === "a" ? <Trace s={s} phase={w.phase} act={act} /> : undefined;
  return (
    <StatusBellProvider items={[]}>
      <AppShell
        mobileTitle={t.convs[conv]}
        navigationBadge={asking ? 1 : 0}
        rail={rail}
        main={
          <div className="eb-main" id="main" data-testid="conversation" data-conv={conv}>
            <ConversationFrame>
              <AgentHeader
                title={t.convs[conv]}
                workspaceLabel={conv === "a" ? t.workspace : t.otherWorkspace}
                workspaceHref={`/workspaces/${conv === "a" ? t.workspace : t.otherWorkspace}`}
                activityLabel=""
                controlLabel=""
                detailsExpanded={false}
                onToggleDetails={noop}
              />
              <ConversationStream>
                <Thread key={`${conv}-${w.phase}`} items={items} extra={trace} />
              </ConversationStream>
              {dock}
              <Composer
                value={draft}
                onChange={setDraft}
                activity="idle"
                selectedWorkingMode="steer"
                onModeChange={noop}
                onSendNow={() => setDraft("")}
                onSteer={() => setDraft("")}
                onFollowUp={() => setDraft("")}
                idlePlaceholder=""
              />
            </ConversationFrame>
          </div>
        }
      />
      {sheet ? (
        <BrowserSheet
          mode={w.mine ? "control" : "view"}
          running={s.state === "running"}
          onClose={() => setSheet(undefined)}
          onTakeControl={act.take}
          onGiveBack={act.giveBack}
          onStop={act.stop}
        >
          <Screen s={s} focus={sheet.focus} />
        </BrowserSheet>
      ) : null}
    </StatusBellProvider>
  );
}

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(reviewLanguage);
  const t = TEXT[language];
  const [w, setW] = useState<World>(() => sceneWorld(firstScene));
  const [run, setRun] = useState(0);
  const [conv, setConv] = useState<Conv>(params.get("conversation") === "b" ? "b" : "a");
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--review-h", `${el.getBoundingClientRect().height}px`);
    set();
    const o = new ResizeObserver(set);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  // Scroll each conversation to its end, where the browser work is.
  useLayoutEffect(() => {
    const end = () => [...document.querySelectorAll("[data-item]")].at(-1)?.scrollIntoView({ block: "end" });
    requestAnimationFrame(() => requestAnimationFrame(end));
  }, [run, language, conv, w.phase]);
  const restart = (next: World, c: Conv = conv) => {
    setW(next);
    setConv(c);
    setRun((r) => r + 1);
  };
  return (
    <LangContext.Provider value={language}>
      <div className="ra-review" data-direction={direction}>
        <header className="ra-bar" ref={bar}>
          <div className="ra-controls">
            <strong>{t.title}</strong>
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
                {(["light", "dark", "contrast"] as const).map((k) => (
                  <option key={k} value={k}>
                    {t.themes[k]}
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
                  setRun((r) => r + 1);
                }}
              >
                <option value="fi">suomi</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>
              {t.scene}{" "}
              <select id="scene" value={sceneOf(w)} onChange={(e) => restart(sceneWorld(e.target.value as Scene))}>
                {sceneOf(w) === "" ? <option value="">…</option> : null}
                {(["ask", "agent", "person", "idle", "stopped"] as const).map((k) => (
                  <option key={k} value={k}>
                    {t.scenes[k]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.conversation}{" "}
              <select id="conv" value={conv} onChange={(e) => restart(w, e.target.value as Conv)}>
                <option value="a">{t.convs.a}</option>
                <option value="b">{t.convs.b}</option>
              </select>
            </label>
            <span className="ra-hint">{t.hint}</span>
            <button type="button" className="ra-event" data-testid="event-reset" onClick={() => restart(sceneWorld("ask"), "a")}>
              {t.reset}
            </button>
          </div>
          <ol className="ra-lines" data-testid="direction-lines">
            {t.lines.map((l, i) => (
              <li key={i} aria-current={i === direction ? "true" : undefined}>
                {l}
              </li>
            ))}
          </ol>
          <p className="ra-recommend" data-testid="recommendation">
            {t.recommend}
          </p>
        </header>
        <div className="ra-stage">
          <MemoryRouter key={`${run}-${conv}`} initialEntries={[`/workspaces/${conv === "a" ? t.workspace : t.otherWorkspace}?conversation=${conv}`]}>
            <ConvSync conv={conv} setConv={setConv} />
            <Main key={`${direction}-${language}-${run}`} d={direction} w={w} setW={setW} />
          </MemoryRouter>
        </div>
      </div>
    </LangContext.Provider>
  );
}

/** Keeps the review bar's conversation select in step with the rail's links. */
function ConvSync({ conv, setConv }: { conv: Conv; setConv: (c: Conv) => void }) {
  const { search } = useLocation();
  const now: Conv = new URLSearchParams(search).get("conversation") === "b" ? "b" : "a";
  useLayoutEffect(() => {
    if (now !== conv) setConv(now);
  }, [now, conv, setConv]);
  return null;
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

export type { React };
