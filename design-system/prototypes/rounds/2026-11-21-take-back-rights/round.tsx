import React, {
  type ReactNode,
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
import { MemoryRouter } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import { AccountShelf } from "../../../../web/src/components/Account";
import {
  AssistantMessage,
  Composer,
  ConversationTimeline,
  ToolRow,
  UserMessage,
} from "../../../../web/src/components/Conversation";
import {
  ConversationFrame,
  ConversationStream,
} from "../../../../web/src/components/ConversationFrame";
import { ControlButton } from "../../../../web/src/components/ControlElements";
import { HabitatMark } from "../../../../web/src/components/HabitatMark";
import "../../../../web/src/components/HelperArchive.css";
import { Icon } from "../../../../web/src/components/Icon";
import { Markdown } from "../../../../web/src/components/Markdown";
import {
  AgentHeader,
  AppShell,
  WorkspaceNavRow,
  WorkspaceRail,
} from "../../../../web/src/components/Navigation";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { statusText } from "../../../../web/src/text/status";
import "../../../../web/src/components/components.css";
import { TEXT, type Text, type Who } from "./text";
import "./round.css";


// multiplayer-take-back-prototype (Jari 21.11.2026; ADR 0038 section 7 and
// question 3). Täydet oikeudet lends the owner's Unix user to a participant
// through the agent. This round shows the owner taking it back, and
// removing the participant, with the participant's side beside it. What the
// directions share is ADR 0038's behaviour: a run the participant started
// turns text-only from the next tool call (a call already started finishes),
// processes earlier turns started keep running until someone stops them,
// a participant who keeps the share still reads everything, a removed one
// reads nothing, and an archived conversation opens only for its owner.
// The directions differ in how the owner takes rights back: one tap with a
// summary afterwards, a sheet before, or a grant that ends by itself.
setPersonalLanguage("fi");

const directions = ["1 Heti", "2 Arkki", "3 Määräaika"];
const params = new URLSearchParams(location.search);
const noop = () => {};

// ---------- The synthetic world ----------

type ToolState = "succeeded" | "running" | "blocked" | "interrupted";
type ToolDone = { tool: string; target: string; state: ToolState };
type Mode = "tools" | "text" | "live";
type Phase = "running" | "textOnly" | "doneTools" | "doneText" | "stopped";
type How = "taken" | "expired" | "removed";
type Item =
  | { k: "msg"; id: string; who: Who; text: string; at: string }
  | { k: "reply"; id: string; to: Who; mode: Mode; text: string; at: string; tools: ToolDone[] }
  | { k: "line"; id: string; text: string }
  | { k: "summary"; id: string; how: How; at: string; hadRun: boolean }
  | { k: "waiting"; id: string; who: Who; reply: string; settled?: "allow" | "deny" };
type Member = { who: Who; full: boolean; until?: number };
type Proc = { id: string; cmd: string; by: Who; since: number; stopped?: boolean };
type Access = "full" | "text" | "removed" | "archived";
type World = {
  items: Item[];
  members: Member[];
  procs: Proc[];
  run?: { reply: string; phase: Phase };
  seq: number;
  minute: number;
  access: Access;
  taken?: { at: string; how: "taken" | "expired" };
  archived: boolean;
};

const FILE = "content/events/kevatkokous.md";
const CHECK = "node scripts/check-links.mjs";
const START = 31;
const at = (m: number) => `14.${String(m).padStart(2, "0")}`;

const start = (t: Text, d: number): World => ({
  seq: 10,
  minute: START,
  access: "full",
  archived: false,
  members: [
    { who: "ville", full: true, until: d === 2 ? 65 : undefined },
    { who: "maija", full: false },
  ],
  procs: [
    { id: "watch", cmd: "npm run build -- --watch", by: "aino", since: 4 },
    { id: "preview", cmd: "npm run preview", by: "ville", since: 20 },
  ],
  run: { reply: "rv2", phase: "running" },
  items: [
    { k: "msg", id: "a1", who: "aino", text: t.c.a1, at: at(2) },
    {
      k: "reply",
      id: "r1",
      to: "aino",
      mode: "tools",
      text: t.c.r1,
      at: at(4),
      tools: [
        { tool: "edit", target: FILE, state: "succeeded" },
        { tool: "bash", target: "npm run build -- --watch", state: "succeeded" },
      ],
    },
    { k: "line", id: "g1", text: t.lineGranted(t.all.ville, at(5), d === 2 ? t.durations.hour : undefined) },
    { k: "msg", id: "v1", who: "ville", text: t.c.v1, at: at(20) },
    {
      k: "reply",
      id: "rv1",
      to: "ville",
      mode: "tools",
      text: t.c.rv1,
      at: at(20),
      tools: [{ tool: "bash", target: "npm run preview", state: "succeeded" }],
    },
    { k: "msg", id: "v2", who: "ville", text: t.c.v2, at: at(29) },
    {
      k: "reply",
      id: "rv2",
      to: "ville",
      mode: "live",
      text: t.c.rv2Live,
      at: at(29),
      tools: [
        { tool: "read", target: FILE, state: "succeeded" },
        { tool: "bash", target: CHECK, state: "running" },
      ],
    },
  ],
});

const first = (t: Text, w: Who) => t.names[w].split(" ")[0];
const member = (w: World, who: Who) => w.members.find((m) => m.who === who);
const isFull = (w: World, who: Who) => !!member(w, who)?.full;
const tick = (w: World, by = 0): World => ({ ...w, minute: w.minute + by, seq: w.seq + 1 });
const add = (w: World, item: Item): World => ({ ...w, items: [...w.items, item] });
const line = (w0: World, text: string): World => {
  const w = tick(w0);
  return add(w, { k: "line", id: `l${w.seq}`, text });
};
const mapReply = (w: World, id: string, f: (r: Extract<Item, { k: "reply" }>) => Extract<Item, { k: "reply" }>): World => ({
  ...w,
  items: w.items.map((i) => (i.id === id && i.k === "reply" ? f(i) : i)),
});
const runActive = (w: World) => w.run && (w.run.phase === "running" || w.run.phase === "textOnly");
/** What the agent did with tools for Ville's messages while he had full rights. */
const villeActions = (w: World) =>
  w.items.flatMap((i) => (i.k === "reply" && i.to === "ville" && i.mode !== "text" ? i.tools.filter((x) => x.state !== "blocked") : []));
const villeProcs = (w: World) => w.procs.filter((p) => p.by === "ville");
const liveProcs = (w: World) => villeProcs(w).filter((p) => !p.stopped);

function stopRun(w0: World, t: Text): World {
  if (!w0.run || !runActive(w0)) return w0;
  let w = mapReply(w0, w0.run.reply, (r) => ({
    ...r,
    mode: r.mode === "live" && w0.run!.phase === "running" ? "tools" : "text",
    text: t.c.rv2Stopped,
    tools: r.tools.map((x) => (x.state === "running" ? { ...x, state: "interrupted" } : x)),
  }));
  w = { ...w, run: { ...w0.run, phase: "stopped" } };
  return line(w, t.lineRunStopped);
}

function stopProc(w0: World, t: Text, id: string): World {
  const p = w0.procs.find((x) => x.id === id);
  if (!p || p.stopped) return w0;
  return line({ ...w0, procs: w0.procs.map((x) => (x.id === id ? { ...x, stopped: true } : x)) }, t.lineStopped(p.cmd));
}

/** The run goes on one step: with tools while Ville has them, otherwise the
 * started command finishes and the next call is blocked. */
function advance(w0: World, t: Text): World {
  if (!w0.run || !runActive(w0)) return w0;
  const textOnly = w0.run.phase === "textOnly";
  let w = mapReply(tick(w0, 1), w0.run.reply, (r) => ({
    ...r,
    mode: textOnly ? "text" : "tools",
    text: textOnly ? t.c.rv2Text : t.c.rv2Tools,
    tools: [
      ...r.tools.map((x) => (x.state === "running" ? { ...x, state: "succeeded" as const } : x)),
      { tool: "edit", target: FILE, state: textOnly ? "blocked" : "succeeded" },
    ],
  }));
  w = { ...w, run: { ...w0.run, phase: textOnly ? "doneText" : "doneTools" } };
  if (textOnly) w = add(tick(w), { k: "waiting", id: `w${w.seq + 1}`, who: "ville", reply: w0.run.reply });
  return w;
}

type TakeBack = { how: How; stopRun: boolean; stopProcs: string[]; card: boolean };
function takeBack(w0: World, t: Text, o: TakeBack): World {
  const hadRun = !!runActive(w0);
  let w = tick(w0);
  const when = at(w.minute);
  w = {
    ...w,
    members: o.how === "removed" ? w.members.filter((m) => m.who !== "ville") : w.members.map((m) => (m.who === "ville" ? { ...m, full: false, until: undefined } : m)),
    access: o.how === "removed" ? "removed" : "text",
    taken: { at: when, how: o.how === "expired" ? "expired" : "taken" },
  };
  if (o.how === "removed" && isFull(w0, "ville")) w = line(w, t.lineTaken(t.ela.ville));
  w = line(w, o.how === "removed" ? t.lineRemoved(t.names.ville) : o.how === "expired" ? t.lineExpired(t.gen.ville) : t.lineTaken(t.ela.ville));
  if (hadRun) {
    if (o.stopRun) w = stopRun(w, t);
    else w = { ...mapReply(w, w.run!.reply, (r) => ({ ...r, mode: "live" })), run: { ...w.run!, phase: "textOnly" } };
  }
  for (const id of o.stopProcs) w = stopProc(w, t, id);
  if (o.card) {
    w = tick(w);
    w = add(w, { k: "summary", id: `s${w.seq}`, how: o.how, at: when, hadRun });
  }
  return w;
}

function villeWrites(w0: World, t: Text): World {
  let w = tick(w0, 2);
  const msg: Item = { k: "msg", id: `m${w.seq}`, who: "ville", text: t.c.v3, at: at(w.minute) };
  w = add(w, msg);
  w = tick(w);
  const full = isFull(w, "ville");
  w = add(w, {
    k: "reply",
    id: `r${w.seq}`,
    to: "ville",
    mode: full ? "tools" : "text",
    text: full ? t.c.rv3Tools : t.c.rv3Text,
    at: at(w.minute),
    tools: full ? [{ tool: "edit", target: FILE, state: "succeeded" }] : [],
  });
  if (!full) {
    const reply = `r${w.seq}`;
    w = tick(w);
    w = add(w, { k: "waiting", id: `w${w.seq}`, who: "ville", reply });
  }
  return w;
}

function settle(w0: World, t: Text, id: string, d: "allow" | "deny"): World {
  const item = w0.items.find((i) => i.id === id) as Extract<Item, { k: "waiting" }>;
  let w: World = { ...w0, items: w0.items.map((i) => (i.id === id ? { ...item, settled: d } : i)) };
  w = line(w, d === "allow" ? t.lineAllowed(t.gen[item.who]) : t.lineDenied(t.gen[item.who]));
  if (d === "allow") {
    w = tick(w, 1);
    w = add(w, {
      k: "reply",
      id: `r${w.seq}`,
      to: item.who,
      mode: "tools",
      text: item.reply === "rv2" ? t.c.rv2Allowed : t.c.rv3Tools,
      at: at(w.minute),
      tools: [{ tool: "edit", target: FILE, state: "succeeded" }],
    });
  }
  return w;
}

// ---------- Language and review state ----------

let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: "fi" | "en" = params.get("lang") === "en" ? "en" : "fi";
const LangContext = React.createContext<"fi" | "en">("fi");
const useT = () => TEXT[React.useContext(LangContext)];
const DirContext = React.createContext(0);

// ---------- People (from the multiplayer rounds) ----------

const tone: Record<Who, number> = { aino: 0, ville: 1, maija: 2 };

function Avatar({ who, size = "m", presence }: { who: Who; size?: "s" | "m"; presence?: "present" }) {
  const t = useT();
  return (
    <span className="mp-avatar" data-size={size} data-tone={tone[who]} aria-hidden="true">
      {t.names[who].slice(0, 1)}
      {presence ? <i className="mp-presence" data-presence={presence} /> : null}
    </span>
  );
}

function RoleTag({ who, w }: { who: Who; w: World }) {
  const t = useT();
  if (who === "aino") return <span className="mp-role" data-role="owner">{t.owner}</span>;
  const full = isFull(w, who);
  return (
    <span className="mp-role" data-role={full ? "trusted" : "participant"} data-testid={`role-${who}`}>
      {full ? <Icon name="shield" aria-hidden="true" /> : null}
      {full ? t.full : t.participant}
    </span>
  );
}

/** A portal into the production card's header, before its own name. */
function HeaderSlot({ children, className }: { children: ReactNode; className: string }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const header = anchor.current?.parentElement?.querySelector<HTMLElement>("article > header");
    if (!header) return;
    const span = document.createElement("span");
    span.className = className;
    header.prepend(span);
    setHost(span);
    return () => span.remove();
  }, [className]);
  return (
    <>
      <span ref={anchor} hidden />
      {host ? createPortal(children, host) : null}
    </>
  );
}

function ModeMark({ mode, phase }: { mode: Mode; phase?: Phase }) {
  const t = useT();
  const text = mode === "text" || (mode === "live" && phase === "textOnly");
  const label = text ? t.textOnly : t.toolsOn;
  return (
    <span className="mp-mode" data-mode={text ? "text" : "trusted"} data-testid="mode-mark">
      <Icon name={text ? "lock" : "shield"} aria-hidden="true" />
      {label}
      {mode === "live" ? ` · ${t.running}` : ""}
    </span>
  );
}

function HabitatLine({ children, testId }: { children: ReactNode; testId: string }) {
  const t = useT();
  return (
    <div className="mp-line" data-testid={testId}>
      <HabitatMark size={16} state="idle" />
      <span className="mp-line-who">{t.habitat}</span>
      <span className="mp-line-text">
        <Markdown text={String(children)} />
      </span>
    </div>
  );
}

// ---------- Owner actions ----------

type Act = {
  takeBack: (how: "taken" | "removed") => void;
  stopRun: () => void;
  stopProc: (id: string) => void;
  settle: (id: string, d: "allow" | "deny") => void;
};

/** 1 and 3: what happened, after the fact, with stop buttons. Owner only. */
function SummaryCard({ s, w, act }: { s: Extract<Item, { k: "summary" }>; w: World; act: Act }) {
  const t = useT();
  const title =
    s.how === "removed"
      ? t.sumRemovedTitle(t.names.ville, s.at)
      : s.how === "expired"
        ? t.sumExpiredTitle(t.gen.ville, s.at)
        : t.sumTitle(t.ela.ville, s.at);
  const phase = w.run?.phase;
  const did = villeActions(w);
  return (
    <section className="mp-card tb-summary" data-testid="summary-card" data-how={s.how} aria-label={title}>
      <header>
        <Icon name={s.how === "expired" ? "clock" : "lock"} aria-hidden="true" />
        <strong>{title}</strong>
        <span className="tb-owner-only">{t.sumOwnerOnly}</span>
      </header>
      <dl className="tb-sum">
        {s.hadRun ? (
          <div data-testid="sum-run" data-phase={phase}>
            <dt>{t.sumRun}</dt>
            <dd>
              <span className="tb-sum-text">
                <Markdown
                  text={phase === "textOnly" ? t.sumRunRunning(CHECK) : phase === "stopped" ? t.sumRunStopped : t.sumRunDone}
                />
              </span>
              {phase === "textOnly" ? (
                <ControlButton size="inline" variant="quiet" data-testid="sum-stop-run" onPress={act.stopRun}>
                  <Icon name="stop" aria-hidden="true" />
                  {t.stopRun}
                </ControlButton>
              ) : null}
            </dd>
          </div>
        ) : null}
        <div data-testid="sum-procs">
          <dt>{t.sumProcs(t.gen.ville)}</dt>
          <dd>
            <ul className="tb-procs">
              {villeProcs(w).map((p) => (
                <li key={p.id} data-testid={`sum-proc-${p.id}`} data-stopped={p.stopped || undefined}>
                  <code>{p.cmd}</code>
                  <span className="tb-proc-meta">{p.stopped ? t.stopped : `${t.running} · ${t.sinceMin(w.minute - p.since)}`}</span>
                  {p.stopped ? null : (
                    <ControlButton size="inline" variant="quiet" data-testid={`sum-stop-${p.id}`} onPress={() => act.stopProc(p.id)}>
                      <Icon name="stop" aria-hidden="true" />
                      {t.stop}
                    </ControlButton>
                  )}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt>
            <details className="tb-did" data-testid="sum-did">
              <summary>{t.sumDid(t.gen.ville, did.length)}</summary>
              <ul>
                {did.map((x, n) => (
                  <li key={n}>
                    <code className="mp-op-tool">{x.tool}</code> <code>{x.target}</code>
                  </li>
                ))}
              </ul>
            </details>
          </dt>
        </div>
      </dl>
      <p className="mp-card-outcome" data-testid="sum-reads">
        {s.how === "removed" ? t.sumReadsRemoved(first(t, "ville")) : t.sumReads(first(t, "ville"))}
      </p>
    </section>
  );
}

function WaitingRow({ i, act }: { i: Extract<Item, { k: "waiting" }>; act: Act }) {
  const t = useT();
  if (i.settled) return null;
  return (
    <div className="tb-waiting" data-testid="waiting">
      <Icon name="lock" aria-hidden="true" />
      <span>{t.waiting(t.gen[i.who])}</span>
      <span className="mp-release">
        <ControlButton size="inline" variant="quiet" data-testid="waiting-deny" onPress={() => act.settle(i.id, "deny")}>
          {t.deny}
        </ControlButton>
        <ControlButton size="inline" variant="primary" data-testid="waiting-allow" onPress={() => act.settle(i.id, "allow")}>
          {t.allowAll}
        </ControlButton>
      </span>
    </div>
  );
}

// ---------- The conversation ----------

function Thread({ w, act }: { w: World; act: Act }) {
  const t = useT();
  const items: { id: string; kind?: string; content: ReactNode }[] = [];
  for (const i of w.items) {
    if (i.k === "msg") {
      const name = i.who === "aino" ? t.you : t.names[i.who];
      items.push({
        id: i.id,
        kind: "user",
        content: (
          <div className="mp-authored" data-author={i.who} data-testid="authored-message">
            <UserMessage sourceText={i.text} onCopy={noop} time={i.at}>
              <Markdown text={i.text} />
            </UserMessage>
            <HeaderSlot className="mp-who">
              <Avatar who={i.who} size="s" />
              <strong data-testid="author-name">{name}</strong>
            </HeaderSlot>
          </div>
        ),
      });
      continue;
    }
    if (i.k === "line") {
      items.push({ id: i.id, content: <HabitatLine testId="habitat-line">{i.text}</HabitatLine> });
      continue;
    }
    if (i.k === "summary") {
      items.push({ id: i.id, content: <SummaryCard s={i} w={w} act={act} /> });
      continue;
    }
    if (i.k === "waiting") {
      if (!i.settled) items.push({ id: i.id, content: <WaitingRow i={i} act={act} /> });
      continue;
    }
    i.tools.forEach((tool, n) =>
      items.push({
        id: `${i.id}-tool-${n}`,
        kind: "tool",
        content: (
          <div className="mp-tool" data-state={tool.state} data-testid="tool" data-tool={tool.target}>
            <ToolRow
              name={tool.tool}
              targetText={tool.target}
              statusLabel={tool.state === "blocked" ? t.blocked : tool.state === "interrupted" ? t.interrupted : tool.state === "running" ? t.running : t.c.tool}
              state={tool.state === "blocked" || tool.state === "interrupted" ? "failed" : tool.state}
              expanded={false}
              onToggle={noop}
            />
          </div>
        ),
      }),
    );
    const phase = w.run?.reply === i.id ? w.run.phase : undefined;
    items.push({
      id: i.id,
      kind: "assistant",
      content: (
        <div
          className="mp-reply"
          data-mode={i.mode === "live" ? (phase === "textOnly" ? "text" : "live") : i.mode}
          data-testid="agent-reply"
          data-to={i.to}
          data-reply={i.id}
        >
          <AssistantMessage streamState={i.mode === "live" ? "streaming" : "complete"} time={i.at} onCopy={noop}>
            <Markdown text={i.text} />
          </AssistantMessage>
          <HeaderSlot className="mp-reply-meta">
            <span className="mp-reply-to">{t.replyTo(i.to === "aino" ? t.you.toLocaleLowerCase() : first(t, i.to))}</span>
            {i.to !== "aino" ? <ModeMark mode={i.mode} phase={phase} /> : null}
          </HeaderSlot>
        </div>
      ),
    });
  }
  return (
    <ConversationTimeline
      state="ready"
      items={items.map((i) => ({ ...i, content: <div data-item={i.id}>{i.content}</div> }))}
      historyMode="pagedAccessible"
      onJumpToLatest={noop}
      emptyLabel={null}
    />
  );
}

// ---------- People band ----------

function PeopleBand({ w, onOpen, act, onSheet }: { w: World; onOpen: () => void; act: Act; onSheet: () => void }) {
  const t = useT();
  const d = React.useContext(DirContext);
  const here = w.members.length + 1;
  const ville = member(w, "ville");
  const busy = t.bandBusy(runActive(w) ? 1 : 0, liveProcs(w).length);
  return (
    <div className="mp-band" data-testid="people-band">
      <button type="button" className="mp-band-people" data-testid="people-open" onClick={onOpen} aria-label={`${t.people}: ${t.peopleCount(here)}`}>
        <span className="mp-stack">
          <Avatar who="aino" size="s" presence="present" />
          {w.members.map((m) => (
            <Avatar key={m.who} who={m.who} size="s" presence="present" />
          ))}
        </span>
        <span className="mp-band-count">{t.peopleCount(here)}</span>
      </button>
      {ville?.full ? (
        <span className="tb-chip" data-testid="full-chip" data-dir={d}>
          <Icon name={d === 2 ? "clock" : "shield"} aria-hidden="true" />
          <strong>{t.bandFull(first(t, "ville"))}</strong>
          {d === 2 && ville.until ? (
            <span className="tb-chip-left" data-testid="time-left">
              {t.left(ville.until - w.minute)}
            </span>
          ) : busy ? (
            <span className="tb-chip-busy">{busy}</span>
          ) : null}
          <ControlButton
            size="inline"
            variant={d === 1 ? "quiet" : "primary"}
            data-testid="chip-take-back"
            onPress={() => (d === 1 ? onSheet() : act.takeBack("taken"))}
          >
            {d === 1 ? t.takeBackMore : t.takeBack}
          </ControlButton>
        </span>
      ) : null}
    </div>
  );
}

function Window({ label, testId, onClose, children, wide = false, alert = false }: { label: string; testId: string; onClose: () => void; children: ReactNode; wide?: boolean; alert?: boolean }) {
  return (
    <ModalOverlay isOpen isDismissable className="ah-overlay" onOpenChange={(open) => !open && onClose()}>
      <Modal className="ah-modal">
        <AriaDialog
          className={`ah-dialog ah-helper-dialog mp-dialog${wide ? " mp-dialog-wide" : ""}`}
          role={alert ? "alertdialog" : "dialog"}
          aria-label={label}
          data-testid={testId}
        >
          {children}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

function PeoplePanel({ w, onClose, onGrant, onTake, onRemove, onExtend }: { w: World; onClose: () => void; onGrant: (who: Who) => void; onTake: (who: Who) => void; onRemove: (who: Who) => void; onExtend: (who: Who) => void }) {
  const t = useT();
  const d = React.useContext(DirContext);
  return (
    <Window label={t.panelTitle} testId="people-panel" onClose={onClose} wide>
      <Heading slot="title">{t.panelTitle}</Heading>
      <p>{t.panelLead}</p>
      <ul className="mp-people">
        <li data-testid="person-aino">
          <Avatar who="aino" presence="present" />
          <span className="mp-person">
            <strong>
              {t.names.aino} ({t.you.toLocaleLowerCase()})
            </strong>
            <span className="mp-person-meta">
              <RoleTag who="aino" w={w} /> · {t.present}
            </span>
          </span>
        </li>
        {w.members.map((m) => (
          <li key={m.who} data-testid={`person-${m.who}`}>
            <Avatar who={m.who} presence="present" />
            <span className="mp-person">
              <strong>{t.names[m.who]}</strong>
              <span className="mp-person-meta">
                <RoleTag who={m.who} w={w} /> · {t.present}
                {m.full && m.until ? <> · {t.left(m.until - w.minute)}</> : null}
              </span>
            </span>
            <span className="mp-person-actions">
              {m.full ? (
                <>
                  <ControlButton size="inline" variant="quiet" data-testid={`take-${m.who}`} onPress={() => onTake(m.who)}>
                    {d === 1 ? `${t.takeFull}…` : t.takeFull}
                  </ControlButton>
                  {d === 2 && m.until ? (
                    <ControlButton size="inline" variant="quiet" data-testid={`extend-${m.who}`} onPress={() => onExtend(m.who)}>
                      <Icon name="clock" aria-hidden="true" />
                      {t.extend}
                    </ControlButton>
                  ) : null}
                </>
              ) : (
                <ControlButton size="inline" variant="quiet" data-testid={`grant-${m.who}`} onPress={() => onGrant(m.who)}>
                  <Icon name="shield" aria-hidden="true" />
                  {t.giveFull}
                </ControlButton>
              )}
              <ControlButton size="inline" variant="quiet" data-testid={`remove-${m.who}`} onPress={() => onRemove(m.who)}>
                {d === 1 && m.full ? `${t.remove}…` : t.remove}
              </ControlButton>
            </span>
          </li>
        ))}
      </ul>
      <div className="ah-dialog-actions">
        <ControlButton size="row" variant="quiet" data-testid="people-close" onPress={onClose}>
          {t.close}
        </ControlButton>
      </div>
    </Window>
  );
}

type Duration = keyof Text["durations"];
function GrantDialog({ who, onAnswer }: { who: Who; onAnswer: (yes: boolean, d: Duration) => void }) {
  const t = useT();
  const d = React.useContext(DirContext);
  const [dur, setDur] = useState<Duration>("hour");
  return (
    <Window label={t.grantTitle(t.all[who])} testId="grant-dialog" onClose={() => onAnswer(false, dur)} alert>
      <Heading slot="title">{t.grantTitle(t.all[who])}</Heading>
      <p className="mp-dialog-person">
        <Avatar who={who} /> <strong>{t.names[who]}</strong>
      </p>
      <p>{t.grantBody(first(t, who))}</p>
      {d === 2 ? (
        <fieldset className="tb-choice" data-testid="grant-duration">
          <legend>{t.grantFor}</legend>
          {(Object.keys(t.durations) as Duration[]).map((k) => (
            <label key={k}>
              <input type="radio" name="duration" checked={dur === k} onChange={() => setDur(k)} /> {t.durations[k]}
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className="ah-dialog-actions">
        <ControlButton size="row" variant="quiet" autoFocus data-testid="grant-cancel" onPress={() => onAnswer(false, dur)}>
          {t.cancel}
        </ControlButton>
        <ControlButton size="row" variant="primary" data-testid="grant-confirm" onPress={() => onAnswer(true, dur)}>
          {t.grantConfirm}
        </ControlButton>
      </div>
    </Window>
  );
}

/** 2 Arkki: what was lent and what still runs, chosen before confirming. */
function TakeSheet({ w, remove, onClose, onConfirm }: { w: World; remove: boolean; onClose: () => void; onConfirm: (o: TakeBack) => void }) {
  const t = useT();
  const [stop, setStop] = useState(false);
  const procs = liveProcs(w);
  const [chosen, setChosen] = useState<string[]>(procs.map((p) => p.id));
  const [alsoRemove, setAlsoRemove] = useState(remove);
  const did = villeActions(w);
  const own = w.procs.filter((p) => p.by === "aino" && !p.stopped).length;
  return (
    <Window label={t.sheetTitle(t.gen.ville)} testId="take-sheet" onClose={onClose} wide alert>
      <Heading slot="title">{t.sheetTitle(t.gen.ville)}</Heading>
      <section className="tb-sheet-sec">
        <h3>{t.sheetLent}</h3>
        <p>{t.sheetLentBody(at(5))}</p>
        <details className="tb-did" data-testid="sheet-did">
          <summary>{t.sheetUsed(t.gen.ville, did.length)}</summary>
          <ul>
            {did.map((x, n) => (
              <li key={n}>
                <code className="mp-op-tool">{x.tool}</code> <code>{x.target}</code>
              </li>
            ))}
          </ul>
        </details>
      </section>
      <section className="tb-sheet-sec">
        <h3>{t.sheetNow}</h3>
        {runActive(w) ? (
          <fieldset className="tb-choice" data-testid="sheet-run">
            <legend>{t.runChoiceLabel(t.gen.ville)}</legend>
            <label>
              <input type="radio" name="run" checked={!stop} onChange={() => setStop(false)} data-testid="sheet-run-finish" /> {t.runFinish}
              <span className="tb-hint">{t.runFinishHint}</span>
            </label>
            <label>
              <input type="radio" name="run" checked={stop} onChange={() => setStop(true)} data-testid="sheet-run-stop" /> {t.runStop}
            </label>
          </fieldset>
        ) : null}
        <fieldset className="tb-choice" data-testid="sheet-procs">
          <legend>{t.procsLabel(t.gen.ville)}</legend>
          {procs.length ? (
            procs.map((p) => (
              <label key={p.id}>
                <input
                  type="checkbox"
                  data-testid={`sheet-proc-${p.id}`}
                  checked={chosen.includes(p.id)}
                  onChange={(e) => setChosen(e.target.checked ? [...chosen, p.id] : chosen.filter((c) => c !== p.id))}
                />{" "}
                {t.stop} <code>{p.cmd}</code>
                <span className="tb-hint">
                  {t.running} · {t.sinceMin(w.minute - p.since)}
                </span>
              </label>
            ))
          ) : (
            <p>{t.sumNoProcs}</p>
          )}
          {own ? <p className="tb-hint">{t.ownProcs(own)}</p> : null}
        </fieldset>
        <label className="tb-also">
          <input type="checkbox" data-testid="sheet-remove" checked={alsoRemove} onChange={(e) => setAlsoRemove(e.target.checked)} /> {t.alsoRemove(first(t, "ville"))}
        </label>
      </section>
      <div className="ah-dialog-actions">
        <ControlButton size="row" variant="quiet" data-testid="sheet-cancel" onPress={onClose}>
          {t.cancel}
        </ControlButton>
        <ControlButton
          size="row"
          variant="primary"
          data-testid="sheet-confirm"
          onPress={() => onConfirm({ how: alsoRemove ? "removed" : "taken", stopRun: stop, stopProcs: chosen, card: false })}
        >
          {alsoRemove ? t.remove : t.sheetConfirm}
        </ControlButton>
      </div>
    </Window>
  );
}

function ArchiveDialog({ w, onAnswer }: { w: World; onAnswer: (yes: boolean) => void }) {
  const t = useT();
  const names = w.members.map((m) => first(t, m.who)).join(t === TEXT.en ? " and " : " ja ");
  return (
    <Window label={t.archiveTitle} testId="archive-dialog" onClose={() => onAnswer(false)} alert>
      <Heading slot="title">{t.archiveTitle}</Heading>
      <p>{t.archiveBody(names)}</p>
      <div className="ah-dialog-actions">
        <ControlButton size="row" variant="quiet" autoFocus data-testid="archive-cancel" onPress={() => onAnswer(false)}>
          {t.cancel}
        </ControlButton>
        <ControlButton size="row" variant="primary" data-testid="archive-confirm" onPress={() => onAnswer(true)}>
          {t.archiveConfirm}
        </ControlButton>
      </div>
    </Window>
  );
}

// ---------- The participant's side ----------

function SideView({ w, open, onClose }: { w: World; open: boolean; onClose: () => void }) {
  const t = useT();
  const d = React.useContext(DirContext);
  const ville = member(w, "ville");
  const reads = w.access === "full" || w.access === "text";
  const phase = w.run?.phase;
  const waiting = w.items.some((i) => i.k === "waiting" && i.who === "ville" && !i.settled);
  const run =
    phase === "running"
      ? t.sideRunRunning
      : phase === "textOnly"
        ? t.sideRunText
        : phase === "stopped"
          ? t.sideRunStopped
          : waiting
            ? t.sideRunWaiting
            : phase
              ? t.sideRunDone
              : "";
  const recent = w.items.filter((i) => i.k === "msg" || i.k === "reply").slice(-3) as Extract<Item, { k: "msg" | "reply" }>[];
  return (
    <aside className="tb-side" data-testid="side" data-open={open || undefined} data-access={w.access} aria-label={t.sideTitle}>
      <header className="tb-side-head">
        <Avatar who="ville" size="s" />
        <strong>{t.sideTitle}</strong>
        <button type="button" className="tb-side-close" data-testid="side-close" onClick={onClose} aria-label={t.close}>
          <Icon name="cross" aria-hidden="true" />
        </button>
      </header>
      <section className="tb-side-rail">
        <h3>{t.sideShared}</h3>
        {reads ? (
          <p className="tb-side-item" data-testid="side-shared">
            <Avatar who="aino" size="s" />
            <span>
              <strong>{t.convTitle}</strong>
              <span className="tb-hint">{t.sideFrom(t.gen.aino)}</span>
            </span>
          </p>
        ) : (
          <p className="tb-hint" data-testid="side-shared-none">
            {t.sideSharedNone}
          </p>
        )}
      </section>
      {reads ? (
        <section className="tb-side-conv">
          <p className="tb-side-strip" data-testid="side-strip" data-mode={w.access}>
            <Icon name={w.access === "full" ? "shield" : "lock"} aria-hidden="true" />
            <span>
              {w.access === "full"
                ? t.sideFull + (d === 2 && ville?.until ? t.sideFullLeft(ville.until - w.minute) : "")
                : t.sideText(w.taken!.at, w.taken!.how)}
            </span>
          </p>
          {run ? (
            <p className="tb-side-run" data-testid="side-run">
              {run}
            </p>
          ) : null}
          <h3>{t.sideRecent}</h3>
          <ol className="tb-side-recent">
            {recent.map((i) => (
              <li key={i.id} data-kind={i.k}>
                <strong>{i.k === "msg" ? (i.who === "ville" ? t.you : first(t, i.who)) : t.agent}</strong>{" "}
                {i.k === "reply" ? <ModeMark mode={i.mode} phase={w.run?.reply === i.id ? phase : undefined} /> : null}
                <span className="tb-side-text">{i.text.replace(/`/g, "")}</span>
              </li>
            ))}
          </ol>
          <p className="tb-hint" data-testid="side-reads">
            {t.sideReads}
          </p>
          <div className="tb-side-composer" aria-hidden="true">
            {t.sideComposer}
          </div>
        </section>
      ) : (
        <section className="tb-side-gone" data-testid="side-gone">
          <Icon name={w.access === "archived" ? "archive" : "lock"} aria-hidden="true" />
          <strong>{t.sideGone}</strong>
          <p>{w.access === "archived" ? t.sideArchived : t.sideRemoved(t.names.aino)}</p>
        </section>
      )}
    </aside>
  );
}

// ---------- The page ----------

type Overlay = { k: "people" } | { k: "grant"; who: Who } | { k: "sheet"; remove: boolean } | { k: "archive" };

function Main({ d, w, setW, overlay, setOverlay, side, setSide }: { d: number; w: World; setW: React.Dispatch<React.SetStateAction<World>>; overlay?: Overlay; setOverlay: (o?: Overlay) => void; side: boolean; setSide: (v: boolean) => void }) {
  const t = useT();
  const status = useText(statusText);
  const [draft, setDraft] = useState("");
  const act: Act = {
    takeBack: (how) => {
      if (d === 1) return setOverlay({ k: "sheet", remove: how === "removed" });
      setW((x) => takeBack(x, t, { how, stopRun: false, stopProcs: [], card: true }));
      setOverlay(undefined);
    },
    stopRun: () => setW((x) => stopRun(x, t)),
    stopProc: (id) => setW((x) => stopProc(x, t, id)),
    settle: (id, dec) => setW((x) => settle(x, t, id, dec)),
  };
  const send = (text?: string) => {
    const body = (text ?? draft).trim();
    if (!body) return;
    setW((x) => {
      let n = tick(x, 1);
      n = add(n, { k: "msg", id: `m${n.seq}`, who: "aino", text: body, at: at(n.minute) });
      return n;
    });
    setDraft("");
  };
  const rail = (
    <WorkspaceRail
      collapsed={false}
      serverLabel="Habitat"
      connectionLabel={status.connected}
      connectionTone="success"
      filterValue=""
      resultSummary="2"
      listState="ready"
      onToggle={noop}
      onFilter={noop}
      onRefresh={noop}
      sessionActions={<AccountShelf profile={{ name: t.names.aino, email: "", avatar_url: "" }} onSettings={noop} onLogout={noop} />}
    >
      <WorkspaceNavRow name="kotikirjasto" href="/workspaces/kotikirjasto" />
      <WorkspaceNavRow name={t.workspace} href={`/workspaces/${t.workspace}`} />
    </WorkspaceRail>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell
        mobileTitle={t.convTitle}
        rail={rail}
        main={
          <div className="mp-main" id="main" data-testid="conversation">
            <ConversationFrame>
              <AgentHeader
                title={t.convTitle}
                workspaceLabel={t.workspace}
                workspaceHref={`/workspaces/${t.workspace}`}
                activityLabel=""
                controlLabel=""
                detailsExpanded={false}
                onToggleDetails={noop}
              />
              {w.archived ? (
                <p className="tb-archived" data-testid="archived-note">
                  <Icon name="archive" aria-hidden="true" /> {t.archivedNote}
                </p>
              ) : (
                <PeopleBand w={w} onOpen={() => setOverlay({ k: "people" })} act={act} onSheet={() => setOverlay({ k: "sheet", remove: false })} />
              )}
              <ConversationStream>
                <Thread w={w} act={act} />
              </ConversationStream>
              <Composer
                value={draft}
                onChange={setDraft}
                activity="idle"
                selectedWorkingMode="steer"
                onModeChange={noop}
                onSendNow={send}
                onSteer={send}
                onFollowUp={send}
                idlePlaceholder={t.composerPlaceholder}
              />
            </ConversationFrame>
            {overlay?.k === "people" ? (
              <PeoplePanel
                w={w}
                onClose={() => setOverlay(undefined)}
                onGrant={(who) => setOverlay({ k: "grant", who })}
                onTake={() => act.takeBack("taken")}
                onRemove={(who) => {
                  if (who === "ville") return act.takeBack("removed");
                  setW((x) => line({ ...x, members: x.members.filter((m) => m.who !== who) }, t.lineRemoved(t.names[who])));
                }}
                onExtend={(who) =>
                  setW((x) => line({ ...x, members: x.members.map((m) => (m.who === who && m.until ? { ...m, until: m.until + 60 } : m)) }, t.lineExtended(t.gen[who])))
                }
              />
            ) : null}
            {overlay?.k === "grant" ? (
              <GrantDialog
                who={overlay.who}
                onAnswer={(yes, dur) => {
                  const who = overlay.who;
                  if (yes)
                    setW((x) => {
                      const until = d === 2 ? (dur === "hour" ? x.minute + 60 : dur === "day" ? x.minute + 9 * 60 : undefined) : undefined;
                      const n = { ...x, members: x.members.map((m) => (m.who === who ? { ...m, full: true, until } : m)), access: who === "ville" ? ("full" as const) : x.access };
                      return line(n, t.lineGranted(t.all[who], at(x.minute), d === 2 ? t.durations[dur] : undefined));
                    });
                  setOverlay({ k: "people" });
                }}
              />
            ) : null}
            {overlay?.k === "sheet" ? (
              <TakeSheet
                w={w}
                remove={overlay.remove}
                onClose={() => setOverlay(undefined)}
                onConfirm={(o) => {
                  setW((x) => takeBack(x, t, o));
                  setOverlay(undefined);
                }}
              />
            ) : null}
            {overlay?.k === "archive" ? (
              <ArchiveDialog
                w={w}
                onAnswer={(yes) => {
                  if (yes)
                    setW((x) => line({ ...x, archived: true, members: [], access: x.access === "removed" ? "removed" : "archived" }, t.lineArchived));
                  setOverlay(undefined);
                }}
              />
            ) : null}
            <SideView w={w} open={side} onClose={() => setSide(false)} />
          </div>
        }
      />
    </StatusBellProvider>
  );
}

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(reviewLanguage);
  const t = TEXT[language];
  const [w, setW] = useState(() => start(t, direction));
  const [overlay, setOverlay] = useState<Overlay>();
  const [side, setSide] = useState(false);
  const [run, setRun] = useState(0);
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
  const reset = (lang = language) => {
    setW(start(TEXT[lang], direction));
    setOverlay(undefined);
    setRun((r) => r + 1);
  };
  const ville = member(w, "ville");
  return (
    <LangContext.Provider value={language}>
      <DirContext.Provider value={direction}>
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
                    reset(reviewLanguage);
                  }}
                >
                  <option value="fi">suomi</option>
                  <option value="en">English</option>
                </select>
              </label>
              <span className="ra-hint">{t.hint}</span>
              <button type="button" className="ra-event" data-testid="event-advance" disabled={!runActive(w)} onClick={() => setW((x) => advance(x, t))}>
                {t.events.advance}
              </button>
              <button type="button" className="ra-event" data-testid="event-ville" disabled={!ville || !!runActive(w)} onClick={() => setW((x) => villeWrites(x, t))}>
                {t.events.villeWrites}
              </button>
              {direction === 2 ? (
                <button
                  type="button"
                  className="ra-event"
                  data-testid="event-expire"
                  disabled={!ville?.until}
                  onClick={() => setW((x) => takeBack({ ...x, minute: (member(x, "ville")?.until ?? x.minute) - 1 }, t, { how: "expired", stopRun: false, stopProcs: [], card: true }))}
                >
                  {t.events.expire}
                </button>
              ) : null}
              <button type="button" className="ra-event" data-testid="event-archive" disabled={w.archived} onClick={() => setOverlay({ k: "archive" })}>
                {t.events.archive}
              </button>
              <button type="button" className="ra-event tb-side-toggle" data-testid="event-side" aria-pressed={side} onClick={() => setSide(!side)}>
                {t.events.side}
              </button>
              <button type="button" className="ra-event" data-testid="event-reset" onClick={() => reset()}>
                {t.events.reset}
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
            <MemoryRouter key={run} initialEntries={[`/workspaces/${t.workspace}?conversation=kevatkokous`]}>
              <Main key={`${direction}-${language}-${run}`} d={direction} w={w} setW={setW} overlay={overlay} setOverlay={setOverlay} side={side} setSide={setSide} />
            </MemoryRouter>
          </div>
        </div>
      </DirContext.Provider>
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
