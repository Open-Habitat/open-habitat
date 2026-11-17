import React, {
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import { AccountShelf } from "../../../../web/src/components/Account";
import {
  AssistantMessage,
  ConversationTimeline,
  ToolRow,
  UserMessage,
} from "../../../../web/src/components/Conversation";
import {
  ConversationFrame,
  ConversationStream,
} from "../../../../web/src/components/ConversationFrame";
import { ControlButton } from "../../../../web/src/components/ControlElements";
import {
  HabitatMark,
  type MarkState,
} from "../../../../web/src/components/HabitatMark";
import { Icon } from "../../../../web/src/components/Icon";
import { Markdown } from "../../../../web/src/components/Markdown";
import {
  AgentHeader,
  AgentNavItem,
  type AgentNavModel,
  AppShell,
  WorkspaceNavRow,
  WorkspaceRail,
} from "../../../../web/src/components/Navigation";
import { Menu } from "../../../../web/src/components/Overlays";
import { QuietSection } from "../../../../web/src/components/QuietSection";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { navigationText } from "../../../../web/src/text/navigation";
import { statusText } from "../../../../web/src/text/status";
import "../../../../web/src/components/components.css";
import { type Conv, TEXT, type Text } from "./text";
import "./round.css";

// scheduled-wake, round 1. Jari 17.11.2026: the agent can schedule its own
// wake. The conversation waits in Hiljaiset and, at the set time, the agent
// is woken and the conversation rises to Sinun vuorosi. The view is the
// rail, built from production pieces (WorkspaceRail, NowSections' section
// markup, AgentNavItem, QuietSection), with just enough conversation
// (ConversationFrame, AgentHeader, the production messages and tool row) to
// read the flow: the reply that sets the wake and the moment it wakes. The
// round's own parts are the wake's line, bar and header control in the
// conversation, the wake time on the row and the clock in the mark; what
// each would need from the host is in NOTES.md.
setPersonalLanguage("fi");

// No-break spaces: four labels share the phone's width.
const directions = ["Nyt", "1\u00a0Aika", "2\u00a0Osio", "3\u00a0Kello"];
const params = new URLSearchParams(location.search);

// ---------- The synthetic world ----------

/** Local wall-clock times; the review page formats them itself. */
const at = (day: number, h: number, m = 0, month = 10) =>
  new Date(2026, month, day, h, m);
const CLOCK0 = at(17, 15, 20);
const REAL_NOW = Date.now();
const DOWN = { from: at(17, 7, 40), to: at(17, 10, 35) };

type Wake = {
  at: Date;
  set: Date;
  by: "person" | "agent";
  status: "pending" | "woke" | "cancelled";
  /** When the agent was actually woken; later than `at` when the server
   * was down at the time. */
  wokeAt?: Date;
  /** The person moved the wake from this time. */
  movedFrom?: Date;
};
type C = {
  id: Conv;
  ws: "koti" | "kirjanpito" | "kotisivu";
  /** When it last changed, before any wake. */
  changed: Date;
  base: "working" | "reply" | "quiet";
  wake?: Wake;
};
type World = { clock: Date; convs: C[]; read: Conv[] };

const START: World = {
  clock: CLOCK0,
  read: [],
  convs: [
    { id: "release", ws: "kotisivu", changed: at(17, 15, 19), base: "working" },
    { id: "a11y", ws: "kotisivu", changed: at(17, 14, 2), base: "reply" },
    {
      id: "invoices",
      ws: "kirjanpito",
      changed: at(16, 18, 30),
      base: "quiet",
      // Due at 8.00; the server was down, so it woke as soon as it was up.
      wake: {
        at: at(17, 8),
        set: at(16, 18, 30),
        by: "person",
        status: "woke",
        wokeAt: at(17, 10, 36),
      },
    },
    {
      id: "backup",
      ws: "koti",
      changed: at(17, 15, 12),
      base: "quiet",
      wake: { at: at(19, 9), set: at(17, 15, 12), by: "person", status: "pending" },
    },
    {
      id: "order",
      ws: "koti",
      changed: at(17, 11, 5),
      base: "quiet",
      wake: { at: at(18, 14), set: at(17, 11, 5), by: "agent", status: "pending" },
    },
    {
      id: "lease",
      ws: "kirjanpito",
      changed: at(16, 9, 40),
      base: "quiet",
      wake: { at: at(1, 10, 0, 11), set: at(16, 9, 40), by: "person", status: "pending" },
    },
    { id: "receipts", ws: "kirjanpito", changed: at(15, 12), base: "quiet" },
  ],
};

const pendingAt = (w: World) =>
  w.convs
    .filter((c) => c.wake?.status === "pending")
    .map((c) => c.wake!.at)
    .sort((a, b) => +a - +b)[0];

function advance(w: World): World {
  const next = pendingAt(w);
  if (!next) return w;
  return {
    ...w,
    clock: next,
    convs: w.convs.map((c) =>
      c.wake?.status === "pending" && +c.wake.at <= +next
        ? { ...c, wake: { ...c.wake, status: "woke", wokeAt: c.wake.at } }
        : c,
    ),
  };
}
const setWake = (w: World, id: Conv, f: (wake: Wake) => Wake): World => ({
  ...w,
  convs: w.convs.map((c) => (c.id === id && c.wake ? { ...c, wake: f(c.wake) } : c)),
});

// ---------- Times in words ----------

const pad = (n: number) => String(n).padStart(2, "0");
const clockText = (d: Date, t: Text) =>
  t === TEXT.en
    ? `${d.getHours()}:${pad(d.getMinutes())}`
    : `${d.getHours()}.${pad(d.getMinutes())}`;
const dateText = (d: Date, t: Text) =>
  t === TEXT.en
    ? `${d.getDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]}`
    : `${d.getDate()}.${d.getMonth() + 1}.`;
const dayIndex = (d: Date) => Math.floor(+new Date(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
/** "to 19.11. klo 9.00" / "Thu 19 Nov at 9:00". */
const full = (d: Date, t: Text) =>
  `${t.weekdays[d.getDay()]} ${dateText(d, t)} ${t.at} ${clockText(d, t)}`;
/** The row's short form: the time today, the weekday within a week, the
 * date beyond it. */
function short(d: Date, now: Date, t: Text) {
  const days = dayIndex(d) - dayIndex(now);
  if (days === 0) return clockText(d, t);
  if (days > 0 && days < 7) return `${t.weekdays[d.getDay()]} ${clockText(d, t)}`;
  return `${dateText(d, t)} ${clockText(d, t)}`;
}
const inputValue = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

// ---------- Rows ----------

type Placed = {
  yours: AgentNavModel[];
  running: AgentNavModel[];
  wakes: AgentNavModel[];
  quiet: AgentNavModel[];
};
type Words = ReturnType<typeof useText<typeof statusText>>["rail"];

/** What the row says about its wake: its end text (Aika rivillä, the wake
 * section) and whether the mark shows the clock (Kello merkissä). */
type RowWake = { end?: string; woke?: boolean; clock?: boolean };

const wakes = (d: number, c: C) => (d === 0 ? undefined : c.wake);

function place(w: World, d: number, t: Text, s: Words, selected: Conv) {
  const out: Placed = { yours: [], running: [], wakes: [], quiet: [] };
  const signs = new Map<Conv, RowWake>();
  for (const c of w.convs) {
    const wake = wakes(d, c);
    const woke = wake?.status === "woke";
    const pending = wake?.status === "pending";
    const read = w.read.includes(c.id) || (woke && c.id === selected);
    const yours = c.base === "reply" || woke;
    const state =
      c.base === "working"
        ? s.working
        : yours
          ? read
            ? s.readReply
            : s.newReply
          : "";
    const wakeWords = pending
      ? t.waitsWake(full(wake.at, t))
      : woke
        ? +wake.wokeAt! > +wake.at
          ? t.wokeLate(clockText(wake.at, t), clockText(wake.wokeAt!, t))
          : t.wokeAt(full(wake.wokeAt!, t))
        : c.base === "quiet"
          ? t.quietReason
          : "";
    const model: AgentNavModel = {
      agentId: c.id,
      href: `/workspaces/${c.ws}?conversation=${c.id}`,
      title: t.conv[c.id],
      workspaceId: c.ws,
      workspaceName: c.ws,
      // Ages read against the simulated clock; QuietSection's rows take
      // the real one, so the times are shifted onto it.
      changedAt: REAL_NOW + +(woke ? wake.wokeAt! : c.changed) - +w.clock,
      activity: c.base === "working" ? "working" : "waiting",
      activityLabel: state,
      controlLabel: "",
      attentionLabel: yours && !read ? s.newReply : undefined,
      turnMark: yours && read ? "read" : undefined,
      detail: [c.ws, state, wakeWords].filter(Boolean).join(" · "),
      selected: c.id === selected,
    };
    if (d === 1 && pending) signs.set(c.id, { end: short(wake.at, w.clock, t) });
    if (d === 1 && woke && !read)
      signs.set(c.id, { end: clockText(wake.wokeAt!, t), woke: true });
    if (d === 2 && pending) signs.set(c.id, { end: short(wake.at, w.clock, t) });
    if (d === 3 && pending) signs.set(c.id, { clock: true });
    if (c.base === "working") out.running.push(model);
    else if (yours) out.yours.push(model);
    else if (d === 2 && pending) out.wakes.push(model);
    else out.quiet.push(model);
  }
  const when = (m: AgentNavModel) =>
    +(w.convs.find((c) => c.id === m.agentId)?.wake?.at ?? 0);
  out.wakes.sort((a, b) => when(a) - when(b));
  return { out, signs };
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
      {[...groups.entries()].map(([name, g]) => (
        // biome-ignore lint/a11y/useSemanticElements: production's group markup.
        <div key={name} className="ah-now-group" role="group">
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

/** NowSections' markup with production rows, and in direction 2 the round's
 * Herätykset section between Käynnissä and Hiljaiset. */
function Sections({
  placed,
  signs,
  clock,
  t,
}: {
  placed: Placed;
  signs: Map<Conv, RowWake>;
  clock: Date;
  t: Text;
}) {
  const n = useText(navigationText);
  const yoursId = useId();
  const runningId = useId();
  const wakesId = useId();
  const render = (r: AgentNavModel) => (
    <AgentNavItem key={r.agentId} {...r} now={REAL_NOW} />
  );
  // The round's signs on production rows: the wake time in the end slot
  // where the age is, and the clock in the mark. In production these would
  // be AgentNavModel fields read by AgentNavItem and RowMark.
  useLayoutEffect(() => {
    for (const li of document.querySelectorAll<HTMLElement>(
      "li[data-testid^='agent-item-']",
    )) {
      const id = li.dataset.testid!.replace("agent-item-", "") as Conv;
      const sign = signs.get(id);
      const time = li.querySelector<HTMLElement>("time.ah-nav-time");
      if (time) {
        if (sign?.end) time.setAttribute("data-wake", sign.end);
        else time.removeAttribute("data-wake");
        if (sign?.woke) time.setAttribute("data-woke", "");
        else time.removeAttribute("data-woke");
      }
      if (sign?.clock) li.setAttribute("data-wake-clock", "");
      else li.removeAttribute("data-wake-clock");
    }
  });
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
      <section className="ah-now" data-testid="rail-running" aria-labelledby={runningId}>
        <h2 className="ah-rail-section-head" id={runningId}>
          {n.running}
          {placed.running.length ? (
            <span className="ah-rail-count">{placed.running.length}</span>
          ) : null}
        </h2>
        <Grouped rows={placed.running} render={render} />
      </section>
      {placed.wakes.length ? (
        <section
          className="ah-now sw-wakes"
          data-testid="rail-wakes"
          aria-labelledby={wakesId}
        >
          <h2 className="ah-rail-section-head" id={wakesId}>
            <Icon name="clock" className="sw-wakes-icon" aria-hidden="true" />
            {t.wakeSection}
            <span className="ah-rail-count">{placed.wakes.length}</span>
          </h2>
          <ul>{placed.wakes.map(render)}</ul>
        </section>
      ) : null}
      <QuietSection
        rows={placed.quiet}
        workspaces={["kirjanpito", "koti", "kotisivu"].map((id) => ({ id, name: id }))}
        choice={{ sort: "newest", workspace: null }}
      />
    </>
  );
}

// ---------- The conversation ----------

const noop = () => {};

/** Open Habitat's own line in the conversation, as the stopped agent's
 * report card is Habitat's and not the agent's (wake-stopped-agent). */
function HabitatLine({
  children,
  testId,
  tone,
}: {
  children: ReactNode;
  testId: string;
  tone?: "late";
}) {
  const t = TEXT[useLang()];
  return (
    <div className="sw-line" data-testid={testId} data-tone={tone}>
      <HabitatMark size={16} state={tone === "late" ? "unknown" : "idle"} />
      <span className="sw-line-who">{t.habitat}</span>
      <span className="sw-line-text">{children}</span>
    </div>
  );
}

function WakeEditor({
  wake,
  onSave,
  onClose,
}: {
  wake: Wake;
  onSave: (d: Date) => void;
  onClose: () => void;
}) {
  const t = TEXT[useLang()];
  const [value, setValue] = useState(inputValue(wake.at));
  const id = useId();
  return (
    <form
      className="sw-editor"
      data-testid="wake-editor"
      onSubmit={(e) => {
        e.preventDefault();
        const d = new Date(value);
        if (!Number.isNaN(+d)) onSave(d);
      }}
    >
      <label htmlFor={id}>{t.newTime}</label>
      <input
        id={id}
        type="datetime-local"
        data-testid="wake-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <ControlButton type="submit" variant="primary" size="row" data-testid="wake-save">
        {t.save}
      </ControlButton>
      <ControlButton variant="quiet" size="row" data-testid="wake-keep" onPress={onClose}>
        {t.keep}
      </ControlButton>
    </form>
  );
}

/** The pending wake with its two actions: below the reply (1) or as the bar
 * at the conversation's foot (2). */
function PendingWake({
  wake,
  clock,
  place,
  onChange,
  onCancel,
}: {
  wake: Wake;
  clock: Date;
  place: "line" | "bar";
  onChange: (d: Date) => void;
  onCancel: () => void;
}) {
  const t = TEXT[useLang()];
  const [editing, setEditing] = useState(false);
  const body = (
    <>
      <span className="sw-pending-what">
        <Icon name="clock" className="sw-pending-icon" aria-hidden="true" />
        <strong>{t.wakeSet(full(wake.at, t))}</strong>
        <span className="sw-pending-by">· {t.wakeSetBy[wake.by]}</span>
      </span>
      <span className="sw-pending-actions">
        <ControlButton
          variant="secondary"
          size="inline"
          data-testid="wake-change"
          onPress={() => setEditing(true)}
        >
          {t.change}
        </ControlButton>
        <ControlButton
          variant="quiet"
          size="inline"
          data-testid="wake-cancel"
          onPress={onCancel}
        >
          {t.cancel}
        </ControlButton>
      </span>
      {editing ? (
        <WakeEditor
          wake={wake}
          onClose={() => setEditing(false)}
          onSave={(d) => {
            setEditing(false);
            if (+d > +clock) onChange(d);
          }}
        />
      ) : null}
    </>
  );
  return place === "bar" ? (
    <aside className="sw-bar" data-testid="wake-bar">
      {body}
    </aside>
  ) : (
    <div className="sw-pending" data-testid="wake-pending">
      {body}
    </div>
  );
}

type Item = { id: string; kind?: string; content: ReactNode };

function Thread({
  c,
  d,
  t,
  clock,
  onChange,
  onCancel,
}: {
  c: C;
  d: number;
  t: Text;
  clock: Date;
  onChange: (d: Date) => void;
  onCancel: () => void;
}) {
  const h = t.history[c.id] as { ask: string; reply: string; replyNow?: string; woke?: string };
  const wake = wakes(d, c);
  const time = clockText(wake?.set ?? c.changed, t);
  const items: Item[] = [
    {
      id: "ask",
      kind: "user",
      content: (
        <UserMessage sourceText={h.ask} onCopy={noop} time={time}>
          <Markdown text={h.ask} />
        </UserMessage>
      ),
    },
  ];
  if (wake) {
    const iso = `${inputValue(wake.movedFrom ?? wake.at)}+02:00`;
    items.push({
      id: "tool",
      kind: "tool",
      content: (
        <ToolRow
          name="bash"
          targetText={`open-habitat agent wake create --current --at ${iso} --note "${t.conv[c.id]}"`}
          statusLabel={t.toolStatus}
          state="succeeded"
          expanded={false}
          onToggle={noop}
        />
      ),
    });
  }
  const reply = d === 0 && h.replyNow ? h.replyNow : h.reply;
  items.push({
    id: "reply",
    kind: "assistant",
    content: (
      <AssistantMessage streamState={c.base === "working" ? "streaming" : "complete"} time={time} onCopy={noop}>
        <Markdown text={reply} />
      </AssistantMessage>
    ),
  });
  if (wake?.movedFrom)
    items.push({
      id: "moved",
      content: (
        <HabitatLine testId="wake-moved">
          {t.changed(full(wake.movedFrom, t), full(wake.at, t))}
        </HabitatLine>
      ),
    });
  if (wake?.status === "pending" && d === 1)
    items.push({
      id: "pending",
      content: (
        <PendingWake wake={wake} clock={clock} place="line" onChange={onChange} onCancel={onCancel} />
      ),
    });
  if (wake?.status === "cancelled")
    items.push({
      id: "cancelled",
      content: <HabitatLine testId="wake-cancelled">{t.cancelled(full(wake.at, t))}</HabitatLine>,
    });
  if (wake?.status === "woke") {
    const late = +wake.wokeAt! > +wake.at;
    items.push({
      id: "woke",
      content: (
        <HabitatLine testId="wake-woke" tone={late ? "late" : undefined}>
          {late
            ? t.wokeLateLine(
                full(wake.at, t),
                clockText(wake.wokeAt!, t),
                `${clockText(DOWN.from, t)}–${clockText(DOWN.to, t)}`,
              )
            : t.woke(full(wake.at, t), full(wake.set, t))}
        </HabitatLine>
      ),
    });
    items.push({
      id: "woke-reply",
      kind: "assistant",
      content: (
        <AssistantMessage streamState="complete" time={clockText(wake.wokeAt!, t)} onCopy={noop}>
          <Markdown text={h.woke ?? ""} />
        </AssistantMessage>
      ),
    });
  }
  return (
    <ConversationTimeline
      key={`${c.id}-${d}`}
      state="ready"
      items={items.map((i) => ({ ...i, content: <div data-item={i.id}>{i.content}</div> }))}
      historyMode="pagedAccessible"
      onJumpToLatest={noop}
      emptyLabel={null}
    />
  );
}

/** Kello merkissä: the wake in the header beside the state, a menu for
 * changing and cancelling it. */
function HeaderWake({
  wake,
  onEdit,
  onCancel,
}: {
  wake: Wake;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const t = TEXT[useLang()];
  return (
    <span className="sw-header-wake" data-testid="wake-header">
      <Menu
        label={t.menuLabel}
        triggerLabel={t.wakeSet(full(wake.at, t))}
        triggerTestId="wake-menu"
        trigger={
          <span className="sw-header-chip">
            <Icon name="clock" aria-hidden="true" />
            {full(wake.at, t)}
          </span>
        }
        placement="bottom start"
        items={[
          { id: "change", label: t.menuChange },
          { id: "cancel", label: t.menuCancel, danger: true },
        ]}
        onAction={(id) => (id === "change" ? onEdit() : onCancel())}
      />
    </span>
  );
}

// ---------- The page ----------

let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: "fi" | "en" = params.get("lang") === "en" ? "en" : "fi";
const LangContext = React.createContext<"fi" | "en">("fi");
const useLang = () => React.useContext(LangContext);

function Main({
  d,
  t,
  world,
  setWorld,
}: {
  d: number;
  t: Text;
  world: World;
  setWorld: (w: World) => void;
}) {
  const status = useText(statusText);
  const loc = useLocation();
  const selected = (new URLSearchParams(loc.search).get("conversation") ?? "backup") as Conv;
  const { out: placed, signs } = place(world, d, t, status.rail, selected);
  const [editing, setEditing] = useState(false);
  // Opening a woken conversation reads its reply.
  useLayoutEffect(() => {
    const c = world.convs.find((x) => x.id === selected);
    if (c?.wake?.status === "woke" && d > 0 && !world.read.includes(c.id)) {
      setWorld({ ...world, read: [...world.read, c.id] });
    }
  });
  const c = world.convs.find((x) => x.id === selected) ?? world.convs[0];
  const wake = wakes(d, c);
  const change = (when: Date) => {
    setWorld(setWake(world, c.id, (w) => ({ ...w, movedFrom: w.movedFrom ?? w.at, at: when })));
  };
  const cancel = () => {
    setWorld(setWake(world, c.id, (w) => ({ ...w, status: "cancelled" })));
  };
  const isYours = c.base === "reply" || wake?.status === "woke";
  const activity: { label: string; mark: MarkState } =
    c.base === "working"
      ? { label: t.activity.working, mark: "working" }
      : isYours
        ? { label: t.activity.read, mark: "read" }
        : wake?.status === "pending"
          ? { label: t.activity.waiting, mark: "done" }
          : { label: t.activity.done, mark: "done" };
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
      now={<Sections placed={placed} signs={signs} clock={world.clock} t={t} />}
    >
      <WorkspaceNavRow name="kirjanpito" href="/workspaces/kirjanpito" />
      <WorkspaceNavRow name="koti" href="/workspaces/koti" />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/kotisivu" />
    </WorkspaceRail>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell
        mobileTitle={t.conv[c.id]}
        rail={rail}
        navigationBadge={placed.yours.length}
        main={
          <div className="sw-main" id="main" data-testid="conversation" data-conversation={c.id}>
            <ConversationFrame>
              <AgentHeader
                title={t.conv[c.id]}
                workspaceLabel={c.ws}
                workspaceHref={`/workspaces/${c.ws}`}
                activityLabel={activity.label}
                activityMark={activity.mark}
                activityControl={
                  d === 3 && wake?.status === "pending" ? (
                    <HeaderWake wake={wake} onEdit={() => setEditing(true)} onCancel={cancel} />
                  ) : undefined
                }
                controlLabel=""
                detailsExpanded={false}
                onToggleDetails={noop}
              />
              <ConversationStream>
                {d === 3 && editing && wake?.status === "pending" ? (
                  <div className="sw-header-editor">
                    <WakeEditor
                      wake={wake}
                      onClose={() => setEditing(false)}
                      onSave={(when) => {
                        setEditing(false);
                        if (+when > +world.clock) change(when);
                      }}
                    />
                  </div>
                ) : null}
                <Thread c={c} d={d} t={t} clock={world.clock} onChange={change} onCancel={cancel} />
                {d === 2 && wake?.status === "pending" ? (
                  <PendingWake wake={wake} clock={world.clock} place="bar" onChange={change} onCancel={cancel} />
                ) : null}
              </ConversationStream>
            </ConversationFrame>
          </div>
        }
      />
    </StatusBellProvider>
  );
}

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(reviewLanguage);
  // Each direction starts from the same world.
  const [world, setWorld] = useState(START);
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
  const next = direction === 0 ? undefined : pendingAt(world);
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
                }}
              >
                <option value="fi">suomi</option>
                <option value="en">English</option>
              </select>
            </label>
            <span className="ra-clock" data-testid="clock">
              {t.clockLabel}: {full(world.clock, t)}
            </span>
            <button
              type="button"
              className="ra-event"
              data-testid="event-advance"
              disabled={!next}
              onClick={() => setWorld(advance(world))}
            >
              {next ? `${t.advance}: ${full(next, t)}` : t.noMore}
            </button>
            <button
              type="button"
              className="ra-event"
              data-testid="event-reset"
              onClick={() => setWorld(START)}
            >
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
          <MemoryRouter initialEntries={["/workspaces/koti?conversation=backup"]}>
            <Main key={`${direction}-${language}`} d={direction} t={t} world={world} setWorld={setWorld} />
          </MemoryRouter>
        </div>
      </div>
    </LangContext.Provider>
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
