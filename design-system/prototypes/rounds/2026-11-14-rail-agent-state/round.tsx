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
  HabitatMark,
  type MarkState,
  type SubMarkState,
} from "../../../../web/src/components/HabitatMark";
import { Icon } from "../../../../web/src/components/Icon";
import {
  AgentNavItem,
  type AgentNavModel,
  AppShell,
  NavLink,
  WorkspaceNavRow,
  WorkspaceRail,
} from "../../../../web/src/components/Navigation";
import { ListRow } from "../../../../web/src/components/Primitives";
import { QuietSection } from "../../../../web/src/components/QuietSection";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { subMarks } from "../../../../web/src/components/markState";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { navigationText } from "../../../../web/src/text/navigation";
import { statusText } from "../../../../web/src/text/status";
import "../../../../web/src/components/components.css";
import { TEXT, type Text } from "./text";
import "./round.css";

// agent-sets-rail-state, round 1. Jari 14.11.2026: the agent could set its
// conversation's place in the rail through `open-habitat agent` ("waiting
// for workers", "needs your answer: <question>", "done, nothing pending"),
// and a worker's question goes to the parent agent, which asks the person
// only when it must. One view, the rail, built from production's pieces:
// WorkspaceRail, the section markup of NowSections, AgentNavItem (Nyt),
// QuietSection, HabitatMark with its sub-agent dots and NavLink's second
// line. The only round-own piece is RailRow: AgentNavItem's markup with a
// line of the round's choosing and the mark set by the declaration, which
// production's AgentNavItem cannot take yet (NOTES.md).
setPersonalLanguage("fi");

// No-break spaces: four labels share the phone's width.
const directions = ["Nyt", "1\u00a0Rivi", "2\u00a0Sama", "3\u00a0Kysymys"];
const params = new URLSearchParams(location.search);

// ---------- The synthetic world ----------

type Declared =
  | { kind: "workers"; count: number }
  | { kind: "answer"; question: string; fromWorker?: boolean }
  | { kind: "done" };

type Conv = {
  id: keyof Text["conv"];
  ws: "retkiopas" | "kotisivu" | "kirjanpito";
  /** Minutes since the last change. */
  age: number;
  /** The agent's own turn, as Habitat observes it today. */
  turn: "working" | "idle" | "reply";
  workers?: { working: number; idle: number };
  /** A worker's open question to this agent (Taskfleet). */
  ask?: "parent" | "escalated";
  declared?: Declared;
  /** Why a declaration ended, for the story panel. */
  ended?: "write" | "workers";
};

const START: Conv[] = [
  { id: "release", ws: "retkiopas", age: 1, turn: "working" },
  {
    id: "tiles",
    ws: "retkiopas",
    age: 6,
    turn: "idle",
    workers: { working: 2, idle: 0 },
    declared: { kind: "workers", count: 2 },
  },
  {
    id: "elevation",
    ws: "retkiopas",
    age: 0,
    turn: "working",
    workers: { working: 0, idle: 1 },
    ask: "parent",
  },
  {
    id: "notice",
    ws: "kotisivu",
    age: 12,
    turn: "reply",
    declared: { kind: "answer", question: "notice" },
  },
  { id: "a11y", ws: "kotisivu", age: 25, turn: "reply" },
  {
    id: "glossary",
    ws: "kirjanpito",
    age: 3,
    turn: "reply",
    declared: { kind: "done" },
  },
  {
    id: "backups",
    ws: "kirjanpito",
    age: 40,
    // Declared waiting_workers, then the daemon restarted and none of the
    // conversation's runs is observed working any more: the handoff lapses
    // (design.md §2.3) and the unread reply is placed by observation.
    turn: "reply",
    declared: { kind: "workers", count: 2 },
  },
  { id: "receipts", ws: "kirjanpito", age: 180, turn: "idle" },
  { id: "colors", ws: "retkiopas", age: 60 * 26, turn: "idle" },
];

type Event = "escalate" | "write" | "workers" | "reset";
function apply(world: Conv[], ev: Event): Conv[] {
  if (ev === "reset") return START;
  return world.map((c) => {
    if (ev === "escalate" && c.id === "elevation")
      // The parent ends its turn by asking the person the worker's question.
      return {
        ...c,
        turn: "reply",
        ask: "escalated",
        age: 0,
        declared: { kind: "answer", question: "worker", fromWorker: true },
      };
    if (ev === "write" && c.id === "notice")
      // The person's message ends the declaration; the turn runs.
      return { ...c, turn: "working", age: 0, declared: undefined, ended: "write" };
    if (ev === "workers" && c.id === "tiles")
      // The condition is met: the agent's wait returns and it carries on.
      return {
        ...c,
        turn: "working",
        age: 0,
        workers: { working: 0, idle: 0 },
        declared: undefined,
        ended: "workers",
      };
    return c;
  });
}

/** waiting_workers holds only while Habitat itself sees one of the
 * conversation's runs working (design.md §2.3). */
const lapsed = (c: Conv) =>
  c.declared?.kind === "workers" && (c.workers?.working ?? 0) === 0;
const live = (c: Conv) => (lapsed(c) ? undefined : c.declared);

// ---------- Rows ----------

type Line = { text: string; tone: "agent" | "question" | "stale" | "worker" };
type Row = {
  model: AgentNavModel;
  mark: MarkState;
  subs: SubMarkState[];
  line?: Line;
  /** Kysymysrivi: the question's own row under the conversation. */
  child?: { text: string; end: string; mark: MarkState };
};
type Placed = { yours: Row[]; running: Row[]; quiet: AgentNavModel[] };

// Production rows (Hiljaiset) count age from the real clock; so do these.
const NOW0 = Date.now();

type Words = ReturnType<typeof useText<typeof statusText>>["rail"];
function place(world: Conv[], d: number, t: Text, s: Words): Placed {
  const out: Placed = { yours: [], running: [], quiet: [] };
  for (const c of world) {
    const title = t.conv[c.id];
    const subs = subMarks(c.workers);
    const working = c.turn === "working";
    const busy = (c.workers?.working ?? 0) > 0;
    const question =
      c.declared?.kind === "answer"
        ? c.declared.question === "notice"
          ? t.noticeQuestion
          : t.workerQuestion
        : "";
    const decl = d === 0 ? undefined : live(c);
    const base: AgentNavModel = {
      agentId: c.id,
      href: `/workspaces/${c.ws}?conversation=${c.id}`,
      title,
      workspaceId: c.ws,
      workspaceName: c.ws,
      changedAt: NOW0 - c.age * 60000,
      activityLabel: "",
      controlLabel: "",
      spinoffCounts: c.workers,
      selected: c.id === "tiles",
    };
    // Today's production words and section (railNow), for Nyt and for every
    // row without a live declaration.
    const observedState = working
      ? c.ask === "parent" && d > 0
        ? t.answering
        : s.working
      : c.turn === "reply"
        ? s.newReply
        : busy
          ? s.workerWorking
          : (c.workers?.idle ?? 0) > 0
            ? s.workerWaiting
            : "";
    const say = (state: string, extra?: string) =>
      [c.ws, state, extra].filter(Boolean).join(" · ");
    if (!decl) {
      const stale =
        d > 0 && c.declared?.kind === "workers" && lapsed(c)
          ? c.declared
          : undefined;
      const model: AgentNavModel = {
        ...base,
        activity: working ? "working" : "waiting",
        activityLabel: observedState,
        attentionLabel: c.turn === "reply" ? s.newReply : undefined,
        spinoffWorking: busy,
        spinoffIdle: !busy && (c.workers?.idle ?? 0) > 0,
        detail: say(
          observedState,
          stale
            ? `${t.stale}: ${t.waitsWorkers(stale.count).toLowerCase()}`
            : undefined,
        ),
      };
      const mark: MarkState =
        c.turn === "reply" ? "waiting" : working || busy ? "working" : "done";
      const row: Row = { model, mark, subs };
      if (stale && d === 1)
        row.line = {
          text: t.staleLine(stale.count),
          tone: "stale",
        };
      if (c.ask === "parent" && d === 1)
        row.line = {
          text: t.workerAskedAnswering(t.workerName),
          tone: "worker",
        };
      if (c.ask === "parent" && d === 3)
        row.child = {
          text: t.workerAsksLine(t.workerName, t.workerQuestion),
          end: t.parentAnswers,
          mark: "working",
        };
      if (c.turn === "reply") out.yours.push(row);
      else if (working || busy || (c.workers?.idle ?? 0) > 0)
        out.running.push(row);
      else out.quiet.push({ ...model, activity: "waiting" });
      continue;
    }
    if (decl.kind === "done") {
      out.quiet.push({
        ...base,
        activity: "waiting",
        activityLabel: t.done,
        // Hiljaiset, with the unread mark kept until the reply is opened.
        attentionLabel: c.turn === "reply" ? s.newReply : undefined,
        detail: say(t.done, c.turn === "reply" ? s.newReply : t.agentSays),
      });
      continue;
    }
    if (decl.kind === "workers") {
      const words = t.waitsWorkers(decl.count);
      out.running.push({
        model: {
          ...base,
          activity: "waiting_background",
          activityLabel: words,
          spinoffWaited: true,
          detail: say(words, t.agentSays),
        },
        mark: "background",
        subs,
        line: d === 1 ? { text: words, tone: "agent" } : undefined,
      });
      continue;
    }
    // Needs the person's answer: Sinun vuorosi with the question.
    const from = decl.fromWorker ? t.fromWorker(t.workerName) : undefined;
    out.yours.push({
      model: {
        ...base,
        activity: "waiting",
        activityLabel: t.needsAnswer,
        question: true,
        detail: say(t.needsAnswerLine(question), from ?? t.agentSays),
      },
      mark: "waiting",
      subs,
      line:
        d === 1
          ? {
              // The rail is narrow: the question itself first, the asker
              // only when it is a worker's.
              text: decl.fromWorker ? `${t.workerName}: ${question}` : question,
              tone: "question",
            }
          : d === 2
            ? { text: question, tone: "question" }
            : undefined,
      child:
        d === 3
          ? {
              text: decl.fromWorker
                ? t.workerAsksLine(t.workerName, question)
                : question,
              // The section already says it is the person's turn; the
              // narrow row keeps its room for the question.
              end: "",
              mark: "waiting",
            }
          : undefined,
    });
  }
  return out;
}

function age(min: number, t: ReturnType<typeof useText<typeof navigationText>>) {
  if (min < 1) return t.ageNow;
  if (min < 60) return t.ageMinutes(min);
  if (min < 60 * 24) return t.ageHours(Math.floor(min / 60));
  return t.ageDays(Math.floor(min / 60 / 24));
}

/** AgentNavItem's markup (mark column, one-line NavLink, age) with a line
 * and a mark the declaration sets. */
function RailRow({ row, needs }: { row: Row; needs: string }) {
  const n = useText(navigationText);
  const m = row.model;
  const minutes = Math.round((NOW0 - (m.changedAt ?? NOW0)) / 60000);
  return (
    <>
      <li
        data-testid={`agent-item-${m.agentId}`}
        data-mark={row.mark}
        data-line={row.line?.tone}
        title={`${m.title} · ${m.detail}`}
        className="ah-agent-item"
      >
        <ListRow
          className="ah-sidebar-agent-row ah-now-row"
          indicator={
            <span className="ah-row-mark-hit">
              <HabitatMark
                className="ah-row-mark"
                data-testid="rail-mark"
                state={row.mark}
                size={20}
                subs={row.subs}
              />
            </span>
          }
        >
          <NavLink
            href={m.href}
            label={m.title}
            current={m.selected ? "page" : false}
            detail={m.detail}
            oneLine
            line={
              row.line ? (
                <span
                  className="ra-line"
                  data-testid="declared-line"
                  data-tone={row.line.tone}
                >
                  {row.line.tone === "agent" || row.line.tone === "question" ? (
                    <Icon name="message" className="ra-line-icon" />
                  ) : null}
                  <span className="ra-line-text">{row.line.text}</span>
                </span>
              ) : undefined
            }
            end={
              <time className="ah-nav-time">{age(minutes, n)}</time>
            }
          />
        </ListRow>
      </li>
      {row.child ? (
        <li
          className="ah-agent-item ra-child"
          data-testid={`question-row-${m.agentId}`}
          data-mark={row.child.mark}
        >
          <ListRow
            className="ah-sidebar-agent-row ah-now-row"
            indicator={
              <span className="ah-row-mark-hit ra-child-mark">
                <HabitatMark state={row.child.mark} size={14} />
              </span>
            }
          >
            <NavLink
              href={`${m.href}&question=1`}
              label={row.child.text}
              detail={[row.child.text, row.child.end || needs].join(" · ")}
              oneLine
              end={
                row.child.end ? (
                  <span className="ra-child-end">{row.child.end}</span>
                ) : undefined
              }
            />
          </ListRow>
        </li>
      ) : null}
    </>
  );
}

function Grouped({
  rows,
  render,
}: {
  rows: Row[];
  render: (r: Row) => ReactNode;
}) {
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r.model.workspaceName ?? "";
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

/** NowSections' markup with the round's rows. */
function Sections({
  placed,
  d,
  needs,
}: { placed: Placed; d: number; needs: string }) {
  const n = useText(navigationText);
  const yoursId = useId();
  const runningId = useId();
  const render = (r: Row) =>
    d === 0 ? (
      <AgentNavItem key={r.model.agentId} {...r.model} now={NOW0} />
    ) : (
      <RailRow key={r.model.agentId} row={r} needs={needs} />
    );
  return (
    <>
      <section className="ah-now" data-testid="rail-yours" aria-labelledby={yoursId}>
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

function command(c: Conv, t: Text) {
  const d = c.declared;
  if (!d) return undefined;
  // design.md §2: the agent's handoff for its own conversation.
  const base = "open-habitat agent handoff create --current --state";
  if (d.kind === "workers") return `${base} waiting_workers`;
  if (d.kind === "done") return `${base} done`;
  const q = d.question === "notice" ? t.noticeQuestion : t.workerQuestion;
  return `${base} needs_answer --text "${q}"${d.fromWorker ? " --worker-ask <run>/<ask>" : ""}`;
}

function Story({
  world,
  t,
  onEvent,
}: {
  world: Conv[];
  t: Text;
  onEvent: (e: Event) => void;
}) {
  const shown = world.filter((c) => c.declared || c.ask || c.ended);
  return (
    <section className="ra-story" data-testid="story">
      <h1>{t.storyHead}</h1>
      <p className="ra-lead">{t.storyLead}</p>
      <ul className="ra-cards">
        {shown.map((c) => {
          const cmd = command(c, t);
          const status = c.ended
            ? t.ended[c.ended]
            : lapsed(c)
              ? t.status.stale
              : c.declared
                ? t.status.live
                : t.status.observed;
          return (
            <li key={c.id} data-testid={`story-${c.id}`}>
              <strong>{t.conv[c.id]}</strong>
              <span className="ra-ws">{c.ws}</span>
              {c.ask === "parent" ? (
                <code>taskfleet node ask --question "{t.workerQuestion}"</code>
              ) : null}
              {cmd ? <code>{cmd}</code> : null}
              <span className="ra-status" data-status={c.ended ? "ended" : status === t.status.live ? "live" : "other"}>
                {c.ask === "parent" ? `${t.status.workerAsked} · ` : ""}
                {status}
              </span>
            </li>
          );
        })}
      </ul>
      <h2>{t.events}</h2>
      <div className="ra-events">
        {(["escalate", "write", "workers", "reset"] as Event[]).map((e) => (
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
      <p className="ra-phone-hint">{t.menuHint}</p>
    </section>
  );
}

// ---------- The page ----------

const noop = () => {};
let reviewTheme =
  (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: "fi" | "en" = params.get("lang") === "en" ? "en" : "fi";
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
      now={<Sections placed={placed} d={d} needs={t.needsAnswer} />}
    >
      <WorkspaceNavRow name="kirjanpito" href="/workspaces/kirjanpito" />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/kotisivu" />
      <WorkspaceNavRow name="retkiopas" href="/workspaces/retkiopas" />
    </WorkspaceRail>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell
        mobileTitle={t.conv.tiles}
        rail={rail}
        navigationBadge={placed.yours.length}
        main={
          <div className="ra-main" id="main">
            <Story world={world} t={t} onEvent={onEvent} />
          </div>
        }
      />
    </StatusBellProvider>
  );
}

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(reviewLanguage);
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
        <MemoryRouter initialEntries={["/workspaces/retkiopas?conversation=tiles"]}>
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
