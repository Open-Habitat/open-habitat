import React, {
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { MemoryRouter, useLocation } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import { AccountShelf } from "../../../../web/src/components/Account";
import { ArchiveNotice } from "../../../../web/src/components/ArchiveNotice";
import {
  AssistantMessage,
  ConversationTimeline,
  ToolRow,
  UserMessage,
} from "../../../../web/src/components/Conversation";
import { ArchivedFoot } from "../../../../web/src/components/ConversationArchive";
import {
  ConversationFrame,
  ConversationStream,
} from "../../../../web/src/components/ConversationFrame";
import { ControlButton } from "../../../../web/src/components/ControlElements";
import {
  HabitatMark,
  type MarkState,
} from "../../../../web/src/components/HabitatMark";
import "../../../../web/src/components/HelperArchive.css";
import { Icon } from "../../../../web/src/components/Icon";
import { Markdown } from "../../../../web/src/components/Markdown";
import {
  AgentHeader,
  AgentNavItem,
  type AgentNavModel,
  AppShell,
  type RailArchive,
  WorkspaceNavRow,
  WorkspaceRail,
} from "../../../../web/src/components/Navigation";
import { QuietSection } from "../../../../web/src/components/QuietSection";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { navigationText } from "../../../../web/src/text/navigation";
import { statusText } from "../../../../web/src/text/status";
import "../../../../web/src/components/components.css";
import { type Conv, TEXT, type Text } from "./text";
import "./round.css";

// scheduled-wake, round 2 (Jari 21.11.2026): round 1's direction 1, Aika
// rivillä, was accepted, and archiving a conversation with a pending wake
// cancels the wake after a confirmation. This round is that confirmation,
// from the rail row's archive button and from the conversation header's,
// built on production pieces: the rail and its rows with their real archive
// buttons, AgentHeader with its real archive control (the phone moves it
// into the header menu), the production archive notice with its undo, and
// the archived conversation's foot. The round's own parts are the three
// confirmations, the wake time on the row (round 1), the pending wake under
// the reply (round 1) and Habitat's line that tells what happened.
setPersonalLanguage("fi");

const directions = ["1 Rivillä", "2 Ikkuna", "3 Heti"];
const params = new URLSearchParams(location.search);

// ---------- The synthetic world ----------

const at = (day: number, h: number, m = 0, month = 10, year = 2026) =>
  new Date(year, month, day, h, m);
const CLOCK = at(17, 15, 20);
const REAL_NOW = Date.now();

type Wake = { at: Date; by: "person" | "agent"; note: keyof Text["notes"] };
type C = {
  id: Conv;
  ws: "koti" | "kirjanpito" | "kotisivu";
  changed: Date;
  base: "working" | "reply" | "quiet";
  /** Pending wakes, earliest first. */
  wakes: Wake[];
  /** Archived at; absent while open. */
  archived?: Date;
  /** The wakes the archive cancelled; they stay in the history. */
  cancelled?: Wake[];
  /** Restored from the archive after the notice was gone. */
  restored?: boolean;
};
type Notice = { id: Conv; before: C; cancelled: Wake[]; seq: number };
type World = { convs: C[]; notice?: Notice };

const START: World = {
  convs: [
    { id: "release", ws: "kotisivu", changed: at(17, 15, 19), base: "working", wakes: [] },
    { id: "a11y", ws: "kotisivu", changed: at(17, 14, 2), base: "reply", wakes: [] },
    {
      id: "backup",
      ws: "koti",
      changed: at(17, 15, 12),
      base: "quiet",
      wakes: [{ at: at(19, 9), by: "person", note: "backup" }],
    },
    {
      id: "order",
      ws: "koti",
      changed: at(17, 11, 5),
      base: "quiet",
      wakes: [{ at: at(18, 14), by: "agent", note: "order" }],
    },
    {
      id: "lease",
      ws: "kirjanpito",
      changed: at(16, 9, 40),
      base: "quiet",
      wakes: [
        { at: at(1, 10, 0, 11), by: "person", note: "lease1" },
        { at: at(4, 9, 0, 0, 2027), by: "agent", note: "lease2" },
      ],
    },
    { id: "receipts", ws: "kirjanpito", changed: at(15, 12), base: "quiet", wakes: [] },
  ],
};

const conv = (w: World, id: Conv) => w.convs.find((c) => c.id === id)!;
const put = (w: World, c: C): World => ({
  ...w,
  convs: w.convs.map((x) => (x.id === c.id ? c : x)),
});
function archive(w: World, id: Conv): World {
  const before = conv(w, id);
  const cancelled = before.wakes;
  return {
    ...put(w, { ...before, archived: CLOCK, wakes: [], cancelled, restored: false }),
    notice: { id, before, cancelled, seq: (w.notice?.seq ?? 0) + 1 },
  };
}
/** The notice's undo puts everything back, the wakes included. */
const undo = (w: World): World =>
  w.notice ? { ...put(w, w.notice.before), notice: undefined } : w;
/** A later restore from the archive brings the conversation back, not the
 * wakes: their time may have passed, and the agent sets a new one. */
const restore = (w: World, id: Conv): World => ({
  ...put(w, { ...conv(w, id), archived: undefined, restored: true }),
  notice: w.notice?.id === id ? undefined : w.notice,
});

// ---------- Times in words ----------

const pad = (n: number) => String(n).padStart(2, "0");
const isEn = (t: Text) => t === TEXT.en;
const clockText = (d: Date, t: Text) =>
  isEn(t) ? `${d.getHours()}:${pad(d.getMinutes())}` : `${d.getHours()}.${pad(d.getMinutes())}`;
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dateText = (d: Date, t: Text) =>
  isEn(t) ? `${d.getDate()} ${months[d.getMonth()]}` : `${d.getDate()}.${d.getMonth() + 1}.`;
const dayIndex = (d: Date) =>
  Math.floor(+new Date(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
const full = (d: Date, t: Text) =>
  `${t.weekdays[d.getDay()]} ${dateText(d, t)}${d.getFullYear() !== CLOCK.getFullYear() ? (isEn(t) ? ` ${d.getFullYear()}` : d.getFullYear()) : ""} ${t.at} ${clockText(d, t)}`;
/** The row's short form (round 1): weekday within a week, the date beyond. */
function short(d: Date, t: Text) {
  const days = dayIndex(d) - dayIndex(CLOCK);
  if (days === 0) return clockText(d, t);
  if (days > 0 && days < 7) return `${t.weekdays[d.getDay()]} ${clockText(d, t)}`;
  return `${dateText(d, t)} ${clockText(d, t)}`;
}
const list = (wakes: Wake[], t: Text, form = full) => {
  const parts = wakes.map((w) => form(w.at, t));
  return parts.length < 2
    ? parts.join("")
    : `${parts.slice(0, -1).join(", ")} ${t.and} ${parts.at(-1)}`;
};
const iso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}+02:00`;

// ---------- Rows ----------

type Placed = { yours: AgentNavModel[]; running: AgentNavModel[]; quiet: AgentNavModel[] };
type Words = ReturnType<typeof useText<typeof statusText>>["rail"];

function place(w: World, t: Text, s: Words, selected: Conv) {
  const out: Placed = { yours: [], running: [], quiet: [] };
  const ends = new Map<Conv, string>();
  for (const c of w.convs) {
    if (c.archived) continue;
    const yours = c.base === "reply";
    const state = c.base === "working" ? s.working : yours ? s.newReply : "";
    const next = c.wakes[0];
    const wakeWords = next
      ? c.wakes.length > 1
        ? t.waitsWakes(c.wakes.length, full(next.at, t))
        : t.waitsWake(full(next.at, t))
      : c.base === "quiet"
        ? t.quietReason
        : "";
    const model: AgentNavModel = {
      agentId: c.id,
      href: `/workspaces/${c.ws}?conversation=${c.id}`,
      title: t.conv[c.id],
      workspaceId: c.ws,
      workspaceName: c.ws,
      changedAt: REAL_NOW + +c.changed - +CLOCK,
      activity: c.base === "working" ? "working" : "waiting",
      activityLabel: state,
      controlLabel: "",
      attentionLabel: yours ? s.newReply : undefined,
      detail: [c.ws, state, wakeWords].filter(Boolean).join(" · "),
      selected: c.id === selected,
    };
    if (next) ends.set(c.id, short(next.at, t));
    if (c.base === "working") out.running.push(model);
    else if (yours) out.yours.push(model);
    else out.quiet.push(model);
  }
  return { out, ends };
}

function Grouped({ rows, render }: { rows: AgentNavModel[]; render: (r: AgentNavModel) => ReactNode }) {
  const groups = new Map<string, AgentNavModel[]>();
  for (const r of rows) groups.set(r.workspaceName ?? "", [...(groups.get(r.workspaceName ?? "") ?? []), r]);
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

/** NowSections' markup with production rows and their archive buttons. */
function Sections({
  placed,
  ends,
  archive,
}: {
  placed: Placed;
  ends: Map<Conv, string>;
  archive: RailArchive;
}) {
  const n = useText(navigationText);
  const yoursId = useId();
  const runningId = useId();
  const render = (r: AgentNavModel) => (
    <AgentNavItem key={r.agentId} {...r} now={REAL_NOW} archive={archive} />
  );
  // Round 1's wake time on the production row, where the age is; in
  // production an AgentNavModel field.
  useLayoutEffect(() => {
    for (const li of document.querySelectorAll<HTMLElement>("li[data-testid^='agent-item-']")) {
      const id = li.dataset.testid!.replace("agent-item-", "") as Conv;
      const time = li.querySelector<HTMLElement>("time.ah-nav-time");
      const end = ends.get(id);
      if (!time) continue;
      if (end) time.setAttribute("data-wake", end);
      else time.removeAttribute("data-wake");
    }
  });
  return (
    <>
      <section className="ah-now" data-testid="rail-yours" aria-labelledby={yoursId}>
        <h2 className="ah-rail-section-head" id={yoursId}>
          {n.yourTurn}
          {placed.yours.length ? (
            <span className="ah-rail-count ah-rail-count-attention">{placed.yours.length}</span>
          ) : null}
        </h2>
        {placed.yours.length ? <ul>{placed.yours.map(render)}</ul> : <p className="ah-now-empty">{n.nothingWaits}</p>}
      </section>
      <section className="ah-now" data-testid="rail-running" aria-labelledby={runningId}>
        <h2 className="ah-rail-section-head" id={runningId}>
          {n.running}
          {placed.running.length ? <span className="ah-rail-count">{placed.running.length}</span> : null}
        </h2>
        <Grouped rows={placed.running} render={render} />
      </section>
      <QuietSection
        rows={placed.quiet}
        workspaces={["kirjanpito", "koti", "kotisivu"].map((id) => ({ id, name: id }))}
        choice={{ sort: "newest", workspace: null }}
        archive={archive}
      />
    </>
  );
}

// ---------- The confirmations ----------

const noop = () => {};
let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: "fi" | "en" = params.get("lang") === "en" ? "en" : "fi";
const LangContext = React.createContext<"fi" | "en">("fi");
const useT = () => TEXT[React.useContext(LangContext)];

type Ask = { id: Conv; origin: "rail" | "header" };

/** 1 Rivillä: the small confirmation in the archive button's place. Its
 * Archive takes focus, so Enter archives and Esc keeps. */
function InlineConfirm({
  c,
  onArchive,
  onKeep,
  place,
}: {
  c: C;
  onArchive: () => void;
  onKeep: () => void;
  place: "row" | "header";
}) {
  const t = useT();
  const archiveRef = useRef<HTMLButtonElement>(null);
  // Takes focus once whatever opened it has let go: the phone's header menu
  // hands focus back to its trigger as it closes.
  useLayoutEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => archiveRef.current?.focus());
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const text =
    c.wakes.length > 1
      ? t.inlineMany(c.wakes.length, short(c.wakes[0].at, t))
      : t.inlineOne(short(c.wakes[0].at, t));
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Esc bubbles from its own buttons.
    <div
      className="wa-inline"
      data-place={place}
      data-testid="inline-confirm"
      role="group"
      aria-label={`${t.archive} ${t.conv[c.id]}`}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        onKeep();
      }}
    >
      <span className="wa-inline-text">
        <Icon name="clock" className="wa-clock" aria-hidden="true" />
        {text}
      </span>
      <span className="wa-inline-actions">
        <ControlButton
          ref={archiveRef}
          size="inline"
          variant="primary"
          data-testid="inline-archive"
          onPress={onArchive}
        >
          {t.archive}
        </ControlButton>
        <ControlButton size="inline" variant="quiet" data-testid="inline-keep" onPress={onKeep}>
          {t.keep}
        </ControlButton>
      </span>
    </div>
  );
}

/** Puts the row's confirmation inside the production row's own <li>, below
 * its line, without changing AgentNavItem. */
function RowPortal({ id, children }: { id: Conv; children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const li = document.querySelector<HTMLElement>(`li[data-testid="agent-item-${id}"]`);
    if (!li) return;
    const div = document.createElement("div");
    div.className = "wa-row-host";
    li.append(div);
    li.setAttribute("data-confirming", "");
    setHost(div);
    return () => {
      li.removeAttribute("data-confirming");
      div.remove();
    };
  }, [id]);
  return host ? createPortal(children, host) : null;
}

/** 2 Ikkuna: production's helper-archive window (HelperArchive.tsx), with
 * the wakes in place of the helpers. Esc and a press outside keep. */
function WakeArchiveDialog({
  c,
  onAnswer,
}: {
  c: C;
  onAnswer: (yes: boolean) => void;
}) {
  const t = useT();
  const many = c.wakes.length > 1;
  return (
    <ModalOverlay
      isOpen
      isDismissable
      className="ah-overlay"
      onOpenChange={(open) => {
        if (!open) onAnswer(false);
      }}
    >
      <Modal className="ah-modal">
        <AriaDialog
          className="ah-dialog ah-helper-dialog wa-dialog"
          role="alertdialog"
          aria-label={t.dialogTitle}
          data-testid="wake-archive-dialog"
        >
          <Heading slot="title">{t.dialogTitle}</Heading>
          <p>
            <strong>{t.conv[c.id]}</strong>
          </p>
          <p>{many ? t.dialogLeadMany(c.wakes.length) : t.dialogLeadOne}</p>
          <ul className="ah-helper-archive-rows wa-wakes">
            {c.wakes.map((w) => (
              <li key={+w.at} data-testid="dialog-wake">
                <Icon name="clock" className="wa-clock" aria-hidden="true" />
                <div>
                  <strong>{full(w.at, t)}</strong> · {t.setBy[w.by]}
                  <p>{t.notes[w.note]}</p>
                </div>
              </li>
            ))}
          </ul>
          <p>{t.dialogRule}</p>
          <div className="ah-dialog-actions">
            <ControlButton size="row" variant="quiet" data-testid="dialog-keep" onPress={() => onAnswer(false)}>
              {t.dialogCancel}
            </ControlButton>
            <ControlButton
              autoFocus
              size="row"
              variant="primary"
              data-testid="dialog-archive"
              onPress={() => onAnswer(true)}
            >
              {many ? t.dialogConfirmMany : t.dialogConfirm}
            </ControlButton>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

// ---------- The conversation ----------

function HabitatLine({ children, testId }: { children: ReactNode; testId: string }) {
  const t = useT();
  return (
    <div className="wa-line" data-testid={testId}>
      <HabitatMark size={16} state="idle" />
      <span className="wa-line-who">{t.habitat}</span>
      <span className="wa-line-text">{children}</span>
    </div>
  );
}

function Thread({ c, t }: { c: C; t: Text }) {
  const h = t.history[c.id];
  const time = clockText(c.changed, t);
  const set = c.wakes.length ? c.wakes : (c.cancelled ?? []);
  const items: { id: string; kind?: string; content: ReactNode }[] = [
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
  for (const w of set)
    items.push({
      id: `tool-${+w.at}`,
      kind: "tool",
      content: (
        <ToolRow
          name="bash"
          targetText={`open-habitat agent wake create --current --at ${iso(w.at)} --note "${t.notes[w.note]}"`}
          statusLabel={t.toolStatus}
          state="succeeded"
          expanded={false}
          onToggle={noop}
        />
      ),
    });
  items.push({
    id: "reply",
    kind: "assistant",
    content: (
      <AssistantMessage streamState={c.base === "working" ? "streaming" : "complete"} time={time} onCopy={noop}>
        <Markdown text={h.reply} />
      </AssistantMessage>
    ),
  });
  // Round 1's pending wake below the reply (its Muuta and Peru are left out:
  // this round is about the archive).
  for (const w of c.wakes)
    items.push({
      id: `pending-${+w.at}`,
      content: (
        <div className="wa-pending" data-testid="wake-pending">
          <Icon name="clock" className="wa-clock" aria-hidden="true" />
          <strong>{t.wakeSet(full(w.at, t))}</strong>
          <span className="wa-pending-by">· {t.setBy[w.by]}</span>
        </div>
      ),
    });
  if (c.cancelled?.length) {
    const many = c.cancelled.length > 1;
    const words = list(c.cancelled, t);
    items.push({
      id: "cancelled",
      content: (
        <HabitatLine testId="wake-cancelled">
          {many ? t.cancelledLineMany(words) : t.cancelledLine(words)}
          {c.restored ? (
            <span className="wa-agent" data-testid="agent-hears">
              {t.agentHears}
              <code>
                {many
                  ? t.agentMessageMany(words, full(CLOCK, t))
                  : t.agentMessage(words, full(CLOCK, t))}
              </code>
            </span>
          ) : null}
        </HabitatLine>
      ),
    });
  }
  return (
    <ConversationTimeline
      key={`${c.id}-${c.archived ? "a" : "o"}-${c.restored ? "r" : ""}`}
      state="ready"
      items={items.map((i) => ({ ...i, content: <div data-item={i.id}>{i.content}</div> }))}
      historyMode="pagedAccessible"
      onJumpToLatest={noop}
      emptyLabel={null}
    />
  );
}

// ---------- The page ----------

const focusSoon = (selector: string) =>
  requestAnimationFrame(() => {
    const el = [...document.querySelectorAll<HTMLElement>(selector)].find((e) => e.offsetParent !== null);
    el?.focus();
  });

function Main({
  d,
  t,
  world,
  setWorld,
}: {
  d: number;
  t: Text;
  world: World;
  setWorld: React.Dispatch<React.SetStateAction<World>>;
}) {
  const status = useText(statusText);
  const loc = useLocation();
  const selected = (new URLSearchParams(loc.search).get("conversation") ?? "backup") as Conv;
  const { out: placed, ends } = place(world, t, status.rail, selected);
  const [ask, setAsk] = useState<Ask>();
  const c = conv(world, selected);
  const doArchive = (id: Conv) => {
    setAsk(undefined);
    setWorld((w) => archive(w, id));
  };
  const request = (id: Conv, origin: Ask["origin"]) => {
    const target = conv(world, id);
    // Without a pending wake nothing is asked, in every direction: today's
    // archive with its undo.
    if (!target.wakes.length || d === 2) return doArchive(id);
    setAsk({ id, origin });
  };
  const keep = () => {
    const a = ask;
    setAsk(undefined);
    if (!a) return;
    // Back where the person pressed Archive.
    focusSoon(
      a.origin === "rail"
        ? `[data-archive-agent="${a.id}"]`
        : "[data-testid='archive-conversation'], [data-testid='conversation-menu']",
    );
  };
  const railArchive: RailArchive = { reason: () => "", run: (id) => request(id as Conv, "rail") };
  const asked = ask ? conv(world, ask.id) : undefined;
  const archivedOpen = !!c.archived;
  const activity: { label: string; mark: MarkState } = archivedOpen
    ? { label: t.activity.archived, mark: "done" }
    : c.base === "working"
      ? { label: t.activity.working, mark: "working" }
      : c.base === "reply"
        ? { label: t.activity.read, mark: "read" }
        : c.wakes.length
          ? { label: t.activity.waiting, mark: "done" }
          : { label: t.activity.done, mark: "done" };
  const notice = world.notice;
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
        <AccountShelf profile={{ name: "Esimerkki Käyttäjä", email: "", avatar_url: "" }} onSettings={noop} onLogout={noop} />
      }
      now={<Sections placed={placed} ends={ends} archive={railArchive} />}
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
          <div className="wa-main" id="main" data-testid="conversation" data-conversation={c.id}>
            <ConversationFrame>
              <AgentHeader
                title={t.conv[c.id]}
                workspaceLabel={c.ws}
                workspaceHref={`/workspaces/${c.ws}`}
                activityLabel={activity.label}
                activityMark={activity.mark}
                controlLabel=""
                detailsExpanded={false}
                onToggleDetails={noop}
                archive={{
                  state: archivedOpen ? "archived" : "active",
                  eligible: c.base !== "working",
                  busy: false,
                  onArchive: () => request(c.id, "header"),
                  onRestore: () => setWorld((w) => restore(w, c.id)),
                }}
              />
              <ConversationStream>
                {d === 0 && asked && ask?.origin === "header" ? (
                  <InlineConfirm c={asked} place="header" onArchive={() => doArchive(asked.id)} onKeep={keep} />
                ) : null}
                <Thread c={c} t={t} />
              </ConversationStream>
              {archivedOpen ? (
                <ArchivedFoot archivedAt={c.archived!.toISOString()} onRestore={() => setWorld((w) => restore(w, c.id))} />
              ) : null}
            </ConversationFrame>
            {d === 0 && asked && ask?.origin === "rail" ? (
              <RowPortal id={asked.id}>
                <InlineConfirm c={asked} place="row" onArchive={() => doArchive(asked.id)} onKeep={keep} />
              </RowPortal>
            ) : null}
            {d === 1 && asked ? (
              <WakeArchiveDialog
                c={asked}
                onAnswer={(yes) => (yes ? doArchive(asked.id) : keep())}
              />
            ) : null}
            {notice ? (
              <ArchiveNotice
                key={`${notice.id}-${notice.seq}`}
                title={t.conv[notice.id]}
                detail={
                  notice.cancelled.length > 1
                    ? t.noticeMany(notice.cancelled.length)
                    : notice.cancelled.length
                      ? t.noticeOne(short(notice.cancelled[0].at, t))
                      : undefined
                }
                busy={false}
                onRestore={() => setWorld(undo)}
                onClose={() => setWorld((w) => ({ ...w, notice: undefined }))}
              />
            ) : null}
          </div>
        }
      />
    </StatusBellProvider>
  );
}

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(reviewLanguage);
  const [world, setWorld] = useState(START);
  const [run, setRun] = useState(0);
  const bar = useRef<HTMLElement>(null);
  const t = TEXT[language];
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
            <span className="ra-hint">{t.hint}</span>
            <button
              type="button"
              className="ra-event"
              data-testid="event-reset"
              onClick={() => {
                setWorld(START);
                setRun(run + 1);
              }}
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
          <MemoryRouter key={run} initialEntries={["/workspaces/koti?conversation=backup"]}>
            <Main key={`${direction}-${language}-${run}`} d={direction} t={t} world={world} setWorld={setWorld} />
          </MemoryRouter>
        </div>
      </div>
    </LangContext.Provider>
  );
}

// ---------- Host stand-in: only what the production shell asks for ----------

const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
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
