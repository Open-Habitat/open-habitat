import React, {
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import { AccountShelf } from "../../../../web/src/components/Account";
import {
  AgentNavItem,
  type AgentNavModel,
  AppShell,
  WorkspaceNavRow,
  WorkspaceRail,
} from "../../../../web/src/components/Navigation";
import { QuietSection } from "../../../../web/src/components/QuietSection";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { navigationText } from "../../../../web/src/text/navigation";
import { statusText } from "../../../../web/src/text/status";
import "../../../../web/src/components/components.css";
import { TEXT, type Text } from "./text";
import "./round.css";

// mark-hides-background-work, round 1. Jari 16.11.2026: the small
// background-service dot at the row's end is fine and is the baseline; could
// the conversation's background work also show in the Open Habitat mark at
// the row's start, which already animates the conversation's state? One
// view, the rail, built from production's pieces only: WorkspaceRail,
// NowSections' section markup, AgentNavItem (with its own RowMark and the
// ah-nav-service dot) and QuietSection. No round-own row: each direction
// is round CSS on the production mark, keyed by a data-bg attribute the
// round sets on rows whose conversation has a process running. What the
// host would need for that attribute is in NOTES.md.
setPersonalLanguage("fi");

// No-break spaces: four labels share the phone's width.
const directions = ["Nyt", "1 Lamppu", "2 Ovi", "3 Huone"];
const params = new URLSearchParams(location.search);

// ---------- The synthetic world ----------

type Proc = {
  /** The process's name as Pi's process tool reports it. */
  name: string;
  /** Wakes the agent when it ends (Pi's notify), so the agent waits on it
   * unless it has answered the person since. */
  wakes: boolean;
  /** Started before the person's latest message: the agent has answered
   * since, so it is a service left running (waitedFor in production). */
  beforeTurn: boolean;
};
type Conv = {
  id: keyof Text["conv"];
  ws: "retkiopas" | "kotisivu" | "kirjanpito";
  /** Minutes since the last change. */
  age: number;
  /** working: a turn runs; waits: the turn ended waiting on a process;
   * reply: an unread reply; read: read and not answered; quiet: Hiljaiset
   * (nothing asked, or Ei nyt said). */
  turn: "working" | "waits" | "reply" | "read" | "quiet";
  procs: Proc[];
};

const START: Conv[] = [
  { id: "release", ws: "retkiopas", age: 1, turn: "working", procs: [] },
  {
    id: "tiles",
    ws: "retkiopas",
    age: 0,
    turn: "working",
    // A dev server from an earlier turn while a new turn runs.
    procs: [{ name: "npm run dev", wakes: true, beforeTurn: true }],
  },
  {
    id: "bench",
    ws: "retkiopas",
    age: 4,
    turn: "waits",
    procs: [{ name: "npm run bench", wakes: true, beforeTurn: false }],
  },
  {
    id: "preview",
    ws: "kotisivu",
    age: 2,
    turn: "reply",
    procs: [
      { name: "python3 -m http.server 8080", wakes: true, beforeTurn: true },
    ],
  },
  {
    id: "form",
    ws: "kotisivu",
    age: 18,
    turn: "read",
    procs: [{ name: "vite --port 5174", wakes: true, beforeTurn: true }],
  },
  { id: "a11y", ws: "kotisivu", age: 25, turn: "reply", procs: [] },
  {
    id: "report",
    ws: "kirjanpito",
    age: 9,
    turn: "quiet",
    // Started without a wake; the person said Ei nyt to the reply.
    procs: [{ name: "sleep 900", wakes: false, beforeTurn: true }],
  },
  { id: "receipts", ws: "kirjanpito", age: 180, turn: "quiet", procs: [] },
];

type Event = "read" | "stop" | "reset";
function apply(world: Conv[], ev: Event): Conv[] {
  if (ev === "reset") return START;
  return world.map((c) =>
    ev === "read" && c.id === "preview"
      ? { ...c, turn: "read" }
      : ev === "stop" && c.id === "report"
        ? { ...c, procs: [] }
        : c,
  );
}

/** What today's host reports (snapshot waiting_on): only processes that
 * wake the agent, and only while no turn runs. */
const reportedToday = (c: Conv) =>
  c.turn === "working" ? [] : c.procs.filter((p) => p.wakes);
/** What a direction assumes the host reports: every running process. */
const reported = (c: Conv, d: number) => (d === 0 ? reportedToday(c) : c.procs);
/** production waitedFor: the conversation waits on a process it started in
 * the current turn. */
const waited = (p: Proc) => !p.beforeTurn && p.wakes;

// ---------- Rows ----------

type Placed = {
  yours: AgentNavModel[];
  running: AgentNavModel[];
  quiet: AgentNavModel[];
};
const NOW0 = Date.now();
type Words = ReturnType<typeof useText<typeof statusText>>["rail"];

function place(world: Conv[], d: number, t: Text, s: Words): Placed {
  const out: Placed = { yours: [], running: [], quiet: [] };
  for (const c of world) {
    const procs = reported(c, d);
    const waits = procs.filter(waited).map((p) => p.name);
    const services = procs.filter((p) => !waited(p)).map((p) => p.name);
    const state =
      c.turn === "working"
        ? s.working
        : c.turn === "waits"
          ? s.background
          : c.turn === "reply"
            ? s.newReply
            : c.turn === "read"
              ? s.readReply
              : "";
    // railNow's description: workspace, state, what it waits for, services.
    const detail = [
      c.ws,
      state,
      waits.join(", "),
      services.length ? s.backgroundService(services.join(", ")) : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const model: AgentNavModel = {
      agentId: c.id,
      href: `/workspaces/${c.ws}?conversation=${c.id}`,
      title: t.conv[c.id],
      workspaceId: c.ws,
      workspaceName: c.ws,
      changedAt: NOW0 - c.age * 60000,
      activity:
        c.turn === "working"
          ? "working"
          : c.turn === "waits"
            ? "waiting_background"
            : "waiting",
      activityLabel: state,
      controlLabel: "",
      attentionLabel: c.turn === "reply" ? s.newReply : undefined,
      turnMark: c.turn === "read" ? "read" : undefined,
      backgroundService: services.length ? services.join(", ") : undefined,
      detail,
      selected: c.id === "form",
    };
    if (c.turn === "reply" || c.turn === "read") out.yours.push(model);
    else if (c.turn === "quiet") out.quiet.push(model);
    else out.running.push(model);
  }
  return out;
}

function Grouped({
  rows,
  render,
}: {
  rows: AgentNavModel[];
  render: (r: AgentNavModel) => ReactNode;
}) {
  const groups = new Map<string, AgentNavModel[]>();
  for (const r of rows) {
    const k = r.workspaceName ?? "";
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return (
    <>
      {[...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b, "fi"))
        .map(([name, g]) => (
          // biome-ignore lint/a11y/useSemanticElements: production's group markup.
          <div
            key={name}
            className="ah-now-group"
            data-testid={`rail-group-${name}`}
            role="group"
          >
            <h3 className="ah-now-group-head">
              <span className="ah-now-group-name">{name}</span>
              <span className="ah-rail-count">{g.length}</span>
            </h3>
            <ul>{g.map(render)}</ul>
          </div>
        ))}
    </>
  );
}

/** NowSections' markup with production rows. */
function Sections({
  placed,
  world,
  d,
}: {
  placed: Placed;
  world: Conv[];
  d: number;
}) {
  const n = useText(navigationText);
  const yoursId = useId();
  const runningId = useId();
  const render = (r: AgentNavModel) => (
    <AgentNavItem key={r.agentId} {...r} now={NOW0} />
  );
  // The directions' sign: the round marks rows whose conversation has a
  // process running; round.css draws the sign on the production mark. In
  // production this would be a prop of AgentNavItem passed to RowMark.
  useLayoutEffect(() => {
    for (const c of world) {
      const li = document.querySelector(`[data-testid="agent-item-${c.id}"]`);
      if (!li) continue;
      if (d > 0 && reported(c, d).length) li.setAttribute("data-bg", "");
      else li.removeAttribute("data-bg");
    }
  });
  return (
    <>
      <section
        className="ah-now"
        data-testid="rail-yours"
        aria-labelledby={yoursId}
      >
        <h2 className="ah-rail-section-head" id={yoursId}>
          {n.yourTurn}
          {placed.yours.length ? (
            <span className="ah-rail-count ah-rail-count-attention">
              {placed.yours.length}
            </span>
          ) : null}
        </h2>
        {placed.yours.length ? (
          <ul>{placed.yours.map(render)}</ul>
        ) : (
          <p className="ah-now-empty">{n.nothingWaits}</p>
        )}
      </section>
      <section
        className="ah-now"
        data-testid="rail-running"
        aria-labelledby={runningId}
      >
        <h2 className="ah-rail-section-head" id={runningId}>
          {n.running}
          {placed.running.length ? (
            <span className="ah-rail-count">{placed.running.length}</span>
          ) : null}
        </h2>
        <Grouped rows={placed.running} render={render} />
      </section>
      <QuietSection
        rows={placed.quiet}
        workspaces={["kirjanpito", "kotisivu", "retkiopas"].map((w) => ({
          id: w,
          name: w,
        }))}
        choice={{ sort: "newest", workspace: null }}
      />
    </>
  );
}

// ---------- The story beside the rail ----------

function Story({
  world,
  d,
  t,
  onEvent,
}: {
  world: Conv[];
  d: number;
  t: Text;
  onEvent: (e: Event) => void;
}) {
  const shown = world.filter((c) => c.procs.length);
  return (
    <section className="ra-story" data-testid="story">
      <h1>{t.storyHead}</h1>
      <p className="ra-lead">{t.storyLead}</p>
      <ul className="ra-cards">
        {shown.map((c) => (
          <li key={c.id} data-testid={`story-${c.id}`}>
            <strong>{t.conv[c.id]}</strong>
            <span className="ra-ws">{c.ws}</span>
            {c.procs.map((p) => {
              const host =
                c.turn === "working"
                  ? t.hostNow.during
                  : p.wakes
                    ? t.hostNow.shown
                    : t.hostNow.hidden;
              return (
                <React.Fragment key={p.name}>
                  <code>{p.name}</code>
                  <span className="ra-status">
                    {[
                      p.wakes ? t.procWakes : t.procQuiet,
                      p.beforeTurn ? null : t.procDuring,
                      waited(p) ? t.waited : t.leftRunning,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span
                    className="ra-host"
                    data-host={host === t.hostNow.shown ? "shown" : "missing"}
                  >
                    {host}
                  </span>
                </React.Fragment>
              );
            })}
          </li>
        ))}
      </ul>
      <h2>{t.events}</h2>
      <div className="ra-events">
        {(["read", "stop", "reset"] as Event[]).map((e) => (
          <button
            key={e}
            type="button"
            data-testid={`event-${e}`}
            onClick={() => onEvent(e)}
          >
            {t.ev[e]}
          </button>
        ))}
      </div>
      <h2>{t.phoneHead}</h2>
      <p className="ra-phone" data-testid="phone-note">
        {t.phone[0]} {t.phone[d]}
      </p>
      <p className="ra-phone-hint">{t.menuHint}</p>
    </section>
  );
}

// ---------- The page ----------

const noop = () => {};
let reviewTheme =
  (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: "fi" | "en" = params.get("lang") === "en" ? "en" : "fi";
let reviewStill = params.get("motion") === "reduced";
let reviewWorld: Conv[] = START;

function Main({ d, t }: { d: number; t: Text }) {
  const status = useText(statusText);
  const [world, setWorld] = useState(reviewWorld);
  const placed = place(world, d, t, status.rail);
  const onEvent = (e: Event) => {
    reviewWorld = apply(world, e);
    setWorld(reviewWorld);
  };
  const rail = (
    <WorkspaceRail
      collapsed={false}
      serverLabel="Habitat"
      connectionLabel={status.connected}
      connectionTone="success"
      filterValue=""
      resultSummary="3"
      listState="ready"
      onToggle={noop}
      onFilter={noop}
      onRefresh={noop}
      sessionActions={
        <AccountShelf
          profile={{ name: "Esimerkki Käyttäjä", email: "", avatar_url: "" }}
          onSettings={noop}
          onLogout={noop}
        />
      }
      now={<Sections placed={placed} world={world} d={d} />}
    >
      <WorkspaceNavRow name="kirjanpito" href="/workspaces/kirjanpito" />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/kotisivu" />
      <WorkspaceNavRow name="retkiopas" href="/workspaces/retkiopas" />
    </WorkspaceRail>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell
        mobileTitle={t.conv.form}
        rail={rail}
        navigationBadge={placed.yours.length}
        main={
          <div className="ra-main" id="main">
            <Story world={world} d={d} t={t} onEvent={onEvent} />
          </div>
        }
      />
    </StatusBellProvider>
  );
}

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(reviewLanguage);
  const [still, setStill] = useState(reviewStill);
  const bar = useRef<HTMLElement>(null);
  const t = TEXT[language];
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () =>
      document.documentElement.style.setProperty(
        "--review-h",
        `${el.getBoundingClientRect().height}px`,
      );
    set();
    const o = new ResizeObserver(set);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <div
      className={`ra-review${still ? " ra-still" : ""}`}
      data-direction={direction}
    >
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
            {t.motion}{" "}
            <select
              id="motion"
              value={still ? "off" : "on"}
              onChange={(e) => {
                reviewStill = e.target.value === "off";
                setStill(reviewStill);
              }}
            >
              <option value="on">{t.motions.on}</option>
              <option value="off">{t.motions.off}</option>
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
        <MemoryRouter
          initialEntries={["/workspaces/kotisivu?conversation=form"]}
        >
          <Main key={`${direction}-${language}`} d={direction} t={t} />
        </MemoryRouter>
      </div>
    </div>
  );
}

// ---------- Host stand-in: only what the production shell asks for ----------

const json = (value: unknown) =>
  new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const path = new URL(url, "http://prototype.test/").pathname;
  if (!path.startsWith("/api/")) return realFetch(input, init);
  if (path === "/api/v1/server")
    return json({
      schema_version: 1,
      name: "Habitat",
      administrator: false,
      version: "0.0.0-proto",
    });
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
const variants = directions.map((_, direction) => () => (
  <App key={direction} direction={direction} />
));
const picker = document.createElement("nav");
picker.className = "proto-picker";
picker.setAttribute("aria-label", "Prototype variants");
picker.innerHTML =
  '<span class="proto-picker-highlight" aria-hidden="true"></span>';
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
