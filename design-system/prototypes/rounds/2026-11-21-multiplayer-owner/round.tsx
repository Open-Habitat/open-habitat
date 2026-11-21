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

// multiplayer-conversations, owner's view (Jari 21.11.2026). Anyone in the
// conversation may write and the agent answers; on a turn that answers a
// non-owner the agent has no tools, text only. The owner releases it with
// "Voit jatkaa" (an owner message, so the ordinary rule applies) or approves
// each step; the owner's own message restores all tools. Whoever sent the
// latest message defines the tool mode. A trusted participant's messages get
// tools like the owner's. Built on production pieces: AppShell, the rail,
// AgentHeader, ConversationFrame and its timeline, UserMessage,
// AssistantMessage, ToolRow, Composer (its beforeField slot carries
// direction 1's strip) and production's dialog structure. The round's own
// parts are the authorship on cards (in production a speaker prop on the
// message), the mode marks, the release controls, the people band with its
// panel, and the invite and trust windows.
setPersonalLanguage("fi");

const directions = ["1 Kaista", "2 Merkki", "3 Kortti"];
const params = new URLSearchParams(location.search);
const noop = () => {};

// ---------- The synthetic world ----------

type OpKind = "editLink" | "deploy" | "editTitle";
type Op = { kind: OpKind; tool: string; target: string; decision?: "allow" | "deny" };
type Outcome = "owner" | "goOn" | "each";
type Mode = "tools" | "text" | "trusted" | "each";
type ToolDone = { tool: string; target: string; state: "succeeded" | "denied" };
type Script = "v1" | "v2";
type Item =
  | { k: "msg"; id: string; who: Who; text: string; at: string }
  | {
      k: "reply";
      id: string;
      to: Who;
      mode: Mode;
      text: string;
      at: string;
      tools: ToolDone[];
      stop?: { script: Script; ops: Op[]; outcome?: Outcome };
    }
  | { k: "line"; id: string; text: string };
type Member = { who: Who; state: "present" | "away" | "invited"; trusted: boolean };
type World = { items: Item[]; members: Member[]; seq: number; minute: number };

const FILE = "content/events/kevatkokous.md";
const opsFor = (s: Script): Op[] =>
  s === "v1"
    ? [
        { kind: "editLink", tool: "edit", target: FILE },
        { kind: "deploy", tool: "bash", target: "npm run deploy" },
      ]
    : [{ kind: "editTitle", tool: "edit", target: FILE }];

const start = (t: Text): World => ({
  seq: 10,
  minute: 14,
  members: [
    { who: "ville", state: "present", trusted: false },
    { who: "maija", state: "present", trusted: false },
  ],
  items: [
    { k: "msg", id: "a1", who: "aino", text: t.c.a1, at: "14.02" },
    {
      k: "reply",
      id: "r1",
      to: "aino",
      mode: "tools",
      text: t.c.r1,
      at: "14.03",
      tools: [
        { tool: "edit", target: FILE, state: "succeeded" },
        { tool: "bash", target: "npm run build", state: "succeeded" },
      ],
    },
    { k: "msg", id: "v1", who: "ville", text: t.c.v1, at: "14.11" },
    {
      k: "reply",
      id: "rv1",
      to: "ville",
      mode: "text",
      text: t.c.rv1,
      at: "14.11",
      tools: [],
      stop: { script: "v1", ops: opsFor("v1") },
    },
  ],
});

const first = (t: Text, w: Who) => t.names[w].split(" ")[0];
const member = (w: World, who: Who) => w.members.find((m) => m.who === who);
const isTrusted = (w: World, who: Who) => !!member(w, who)?.trusted;
const clock = (w: World) => `14.${String(w.minute).padStart(2, "0")}`;
const tick = (w: World, by = 1): World => ({ ...w, minute: w.minute + by, seq: w.seq + 1 });
const pending = (w: World) =>
  [...w.items].reverse().find(
    (i): i is Extract<Item, { k: "reply" }> => i.k === "reply" && !!i.stop && !i.stop.outcome,
  );
const setStop = (w: World, id: string, f: (s: NonNullable<Extract<Item, { k: "reply" }>["stop"]>) => void): World => ({
  ...w,
  items: w.items.map((i) => {
    if (i.id !== id || i.k !== "reply" || !i.stop) return i;
    const stop = { ...i.stop, ops: i.stop.ops.map((o) => ({ ...o })) };
    f(stop);
    return { ...i, stop };
  }),
});
const lastReply = (w: World) =>
  [...w.items].reverse().find((i): i is Extract<Item, { k: "reply" }> => i.k === "reply");
/** The tool mode now: whoever sent the latest message. */
function modeNow(w: World): { mode: Mode; who: Who } {
  const last = [...w.items].reverse().find((i) => i.k === "msg") as Extract<Item, { k: "msg" }>;
  if (last.who === "aino") return { mode: "tools", who: "aino" };
  return { mode: isTrusted(w, last.who) ? "trusted" : "text", who: last.who };
}

/** A participant writes: text only unless trusted. */
function guestWrites(w0: World, t: Text, who: Who): World {
  let w = tick(w0, 2);
  const at = clock(w);
  const trusted = isTrusted(w, who);
  const msg: Item = { k: "msg", id: `m${w.seq}`, who, text: who === "ville" ? t.c.v2 : t.c.m1, at };
  w = tick(w);
  let reply: Item;
  if (who === "maija")
    reply = { k: "reply", id: `r${w.seq}`, to: who, mode: trusted ? "trusted" : "text", text: t.c.rm1, at, tools: [] };
  else if (trusted)
    reply = {
      k: "reply",
      id: `r${w.seq}`,
      to: who,
      mode: "trusted",
      text: t.c.rv2Done,
      at,
      tools: [{ tool: "edit", target: FILE, state: "succeeded" }],
    };
  else
    reply = {
      k: "reply",
      id: `r${w.seq}`,
      to: who,
      mode: "text",
      text: t.c.rv2,
      at,
      tools: [],
      stop: { script: "v2", ops: opsFor("v2") },
    };
  return { ...w, items: [...w.items, msg, reply] };
}

/** The owner writes (also "Voit jatkaa"): all tools again. A pending stop is
 * settled by it; the turn carries the stop's work when there was one. */
function ownerWrites(w0: World, t: Text, text: string, outcome: Outcome = "owner"): World {
  const p = pending(w0);
  let w = p ? setStop(w0, p.id, (s) => (s.outcome = outcome)) : w0;
  w = tick(w, 1);
  const at = clock(w);
  const msg: Item = { k: "msg", id: `m${w.seq}`, who: "aino", text, at };
  w = tick(w);
  const script = p?.stop?.script;
  const tools: ToolDone[] = script
    ? opsFor(script).map((o) => ({ tool: o.tool, target: o.target, state: "succeeded" }))
    : [{ tool: "read", target: FILE, state: "succeeded" }];
  const replyText =
    outcome === "goOn" && script
      ? script === "v1"
        ? t.c.rv1Done
        : t.c.rv2Done
      : script === "v1"
        ? t.c.owner
        : t.c.ownerFree;
  const reply: Item = { k: "reply", id: `r${w.seq}`, to: "aino", mode: "tools", text: replyText, at, tools };
  return { ...w, items: [...w.items, msg, reply] };
}

/** Step-by-step approval finished: the agent goes on with what was allowed. */
function finishEach(w0: World, t: Text, id: string, decisions: ("allow" | "deny")[]): World {
  let w = setStop(w0, id, (s) => {
    s.outcome = "each";
    s.ops.forEach((o, i) => (o.decision = decisions[i]));
  });
  const src = w.items.find((i) => i.id === id) as Extract<Item, { k: "reply" }>;
  const ops = src.stop!.ops;
  w = tick(w);
  const allowed = ops.filter((o) => o.decision === "allow").length;
  const text =
    src.stop!.script === "v1"
      ? allowed === 2
        ? t.c.rv1Done
        : allowed === 1 && ops[0].decision === "allow"
          ? t.c.rv1Partial
          : allowed === 0
            ? t.c.rv1None
            : t.c.rv1Partial
      : allowed
        ? t.c.rv2Done
        : t.c.rv2None;
  const reply: Item = {
    k: "reply",
    id: `r${w.seq}`,
    to: src.to,
    mode: "each",
    text,
    at: clock(w),
    tools: ops.map((o) => ({ tool: o.tool, target: o.target, state: o.decision === "allow" ? "succeeded" : "denied" })),
  };
  // Directly after the stop it settles.
  const at = w.items.findIndex((i) => i.id === id);
  const items = [...w.items];
  let after = at + 1;
  while (after < items.length && items[after].k === "line") after++;
  items.splice(after, 0, reply);
  return { ...w, items };
}

const line = (w: World, text: string): World => {
  const n = tick(w);
  return { ...n, items: [...n.items, { k: "line", id: `l${n.seq}`, text }] };
};

// ---------- Language and review state ----------

let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: "fi" | "en" = params.get("lang") === "en" ? "en" : "fi";
const LangContext = React.createContext<"fi" | "en">("fi");
const useT = () => TEXT[React.useContext(LangContext)];
const DirContext = React.createContext(0);

// ---------- People ----------

const tone: Record<Who, number> = { aino: 0, ville: 1, maija: 2, pekka: 3 };

function Avatar({ who, size = "m", presence }: { who: Who; size?: "s" | "m"; presence?: Member["state"] }) {
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
  const trusted = isTrusted(w, who);
  return (
    <span className="mp-role" data-role={trusted ? "trusted" : "participant"}>
      {trusted ? <Icon name="shield" aria-hidden="true" /> : null}
      {trusted ? t.trusted : t.participant}
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

// ---------- Mode marks ----------

function ModeMark({ mode }: { mode: Mode }) {
  const t = useT();
  const label =
    mode === "text"
      ? t.textOnly
      : mode === "trusted"
        ? `${t.toolsOn} · ${t.trusted.toLocaleLowerCase()}`
        : mode === "each"
          ? `${t.toolsOn} · ${t.each.toLocaleLowerCase()}`
          : t.toolsOn;
  return (
    <span className="mp-mode" data-mode={mode} data-testid="mode-mark">
      <Icon name={mode === "text" ? "lock" : mode === "trusted" ? "shield" : "check"} aria-hidden="true" />
      {label}
    </span>
  );
}

// ---------- Release controls ----------

type Act = {
  goOn: (replyId: string) => void;
  each: (replyId: string) => void;
  decide: (replyId: string, index: number, d: "allow" | "deny") => void;
};

function OpLine({ op, t }: { op: Op; t: Text }) {
  return (
    <span className="mp-op">
      <span className="mp-op-kind">{t.ops[op.kind]}</span>
      <code className="mp-op-tool">{op.tool}</code>
      <code className="mp-op-target">{op.target}</code>
    </span>
  );
}

function ReleaseButtons({ id, act, testPrefix }: { id: string; act: Act; testPrefix: string }) {
  const t = useT();
  return (
    <span className="mp-release">
      <ControlButton size="row" variant="primary" data-testid={`${testPrefix}-go-on`} onPress={() => act.goOn(id)}>
        {t.goOn}
      </ControlButton>
      <ControlButton size="row" variant="quiet" data-testid={`${testPrefix}-each`} onPress={() => act.each(id)}>
        {t.approveEach}
      </ControlButton>
    </span>
  );
}

/** 3 Kortti: where the agent stopped. */
function StopCard({ r, act }: { r: Extract<Item, { k: "reply" }>; act: Act }) {
  const t = useT();
  const stop = r.stop!;
  const open = !stop.outcome;
  return (
    <section className="mp-card" data-testid="stop-card" data-open={open || undefined} aria-label={t.cardTitleShort}>
      <header>
        <Icon name="lock" aria-hidden="true" />
        <strong>{t.cardTitle(first(t, r.to))}</strong>
      </header>
      <p className="mp-card-lead">{t.cardLead}</p>
      <ol className="mp-card-ops">
        {stop.ops.map((o, i) => {
          const d = stop.outcome === "goOn" || stop.outcome === "owner" ? "allow" : o.decision;
          return (
            <li key={o.kind} data-testid="card-op" data-decision={d}>
              <OpLine op={o} t={t} />
              {open && !o.decision ? (
                <span className="mp-card-row-actions">
                  <ControlButton size="inline" variant="quiet" data-testid="card-deny" onPress={() => act.decide(r.id, i, "deny")}>
                    {t.deny}
                  </ControlButton>
                  <ControlButton size="inline" variant="primary" data-testid="card-allow" onPress={() => act.decide(r.id, i, "allow")}>
                    {t.allow}
                  </ControlButton>
                </span>
              ) : d ? (
                <span className="mp-card-decision" data-decision={d}>
                  <Icon name={d === "allow" ? "check" : "cross"} aria-hidden="true" />
                  {d === "allow" ? t.allowed : t.denied}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      {open && !stop.ops.some((o) => o.decision) ? (
        <footer>
          <ControlButton size="row" variant="primary" data-testid="card-go-on" onPress={() => act.goOn(r.id)}>
            {t.allowAll}
          </ControlButton>
        </footer>
      ) : null}
      {stop.outcome ? <p className="mp-card-outcome" data-testid="stop-outcome">{t.decided[stop.outcome]}</p> : null}
    </section>
  );
}

function HabitatLine({ children, testId }: { children: ReactNode; testId: string }) {
  const t = useT();
  return (
    <div className="mp-line" data-testid={testId}>
      <HabitatMark size={16} state="idle" />
      <span className="mp-line-who">{t.habitat}</span>
      <span className="mp-line-text">{children}</span>
    </div>
  );
}

// ---------- The conversation ----------

function Thread({ w, act }: { w: World; act: Act }) {
  const t = useT();
  const d = React.useContext(DirContext);
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
              <RoleTag who={i.who} w={w} />
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
    i.tools.forEach((tool, n) =>
      items.push({
        id: `${i.id}-tool-${n}`,
        kind: "tool",
        content: (
          <div className="mp-tool" data-state={tool.state}>
            <ToolRow
              name={tool.tool}
              targetText={tool.target}
              statusLabel={tool.state === "denied" ? t.denied : t.c.tool}
              state={tool.state === "denied" ? "blocked" : "succeeded"}
              expanded={false}
              onToggle={noop}
            />
          </div>
        ),
      }),
    );
    const showMark = d === 1 || i.mode === "text";
    items.push({
      id: i.id,
      kind: "assistant",
      content: (
        <div className="mp-reply" data-mode={i.mode} data-testid="agent-reply" data-to={i.to}>
          <AssistantMessage streamState="complete" time={i.at} onCopy={noop}>
            <Markdown text={i.text} />
          </AssistantMessage>
          <HeaderSlot className="mp-reply-meta">
            <span className="mp-reply-to">{t.replyTo(i.to === "aino" ? t.you.toLocaleLowerCase() : first(t, i.to))}</span>
            {showMark ? <ModeMark mode={i.mode} /> : null}
          </HeaderSlot>
        </div>
      ),
    });
    if (i.stop) {
      if (d === 2) items.push({ id: `${i.id}-card`, content: <StopCard r={i} act={act} /> });
      else if (!i.stop.outcome && d === 1)
        items.push({
          id: `${i.id}-release`,
          content: (
            <div className="mp-under" data-testid="under-reply">
              <ReleaseButtons id={i.id} act={act} testPrefix="under" />
            </div>
          ),
        });
      else if (i.stop.outcome)
        items.push({
          id: `${i.id}-outcome`,
          content: <HabitatLine testId="stop-outcome">{t.decided[i.stop.outcome]}</HabitatLine>,
        });
    }
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

/** 1 Kaista: the mode above the field. */
function ModeStrip({ w, act }: { w: World; act: Act }) {
  const t = useT();
  const { mode, who } = modeNow(w);
  const p = pending(w);
  const because =
    who === "aino" ? t.modeBecause.owner : mode === "trusted" ? t.modeBecause.trusted(first(t, who)) : t.modeBecause.guest(first(t, who));
  return (
    <div className="mp-strip" data-mode={mode} data-testid="mode-strip" role="status">
      <span className="mp-strip-state">
        <Icon name={mode === "text" ? "lock" : mode === "trusted" ? "shield" : "check"} aria-hidden="true" />
        <strong>{mode === "text" ? t.textOnly : t.toolsOn}</strong>
        <span className="mp-strip-why">· {because}</span>
      </span>
      {mode === "text" ? <span className="mp-strip-help">{t.stripTextHelp}</span> : null}
      {p && (mode !== "text" || who !== p.to || p !== lastReply(w)) ? (
        <span className="mp-strip-waiting" data-testid="strip-waiting">
          {t.waitingFrom(first(t, p.to), p.at)}
        </span>
      ) : null}
      {p ? <ReleaseButtons id={p.id} act={act} testPrefix="strip" /> : null}
    </div>
  );
}

// ---------- People band, panel, invite, trust ----------

function PeopleBand({ w, onOpen, onInvite }: { w: World; onOpen: () => void; onInvite: () => void }) {
  const t = useT();
  const here = w.members.filter((m) => m.state === "present").length + 1;
  return (
    <div className="mp-band" data-testid="people-band">
      <button type="button" className="mp-band-people" data-testid="people-open" onClick={onOpen} aria-label={`${t.people}: ${t.peopleCount(here)}`}>
        <span className="mp-stack">
          <Avatar who="aino" size="s" presence="present" />
          {w.members.map((m) => (
            <Avatar key={m.who} who={m.who} size="s" presence={m.state} />
          ))}
        </span>
        <span className="mp-band-count">{t.peopleCount(here)}</span>
        {w.members.some((m) => m.trusted) ? (
          <span className="mp-band-trusted" data-testid="band-trusted">
            <Icon name="shield" aria-hidden="true" />
            {w.members.filter((m) => m.trusted).map((m) => first(t, m.who)).join(", ")}
          </span>
        ) : null}
      </button>
      <ControlButton size="row" variant="quiet" data-testid="invite-open" onPress={onInvite}>
        <Icon name="plus" aria-hidden="true" />
        {t.invite}
      </ControlButton>
    </div>
  );
}

function Window({
  label,
  testId,
  onClose,
  children,
  wide = false,
}: {
  label: string;
  testId: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <ModalOverlay isOpen isDismissable className="ah-overlay" onOpenChange={(open) => !open && onClose()}>
      <Modal className="ah-modal">
        <AriaDialog className={`ah-dialog ah-helper-dialog mp-dialog${wide ? " mp-dialog-wide" : ""}`} aria-label={label} data-testid={testId}>
          {children}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

function PeoplePanel({
  w,
  onClose,
  onTrust,
  onRevoke,
  onRemove,
}: {
  w: World;
  onClose: () => void;
  onTrust: (who: Who) => void;
  onRevoke: (who: Who) => void;
  onRemove: (who: Who) => void;
}) {
  const t = useT();
  const stateWord = (s: Member["state"]) => (s === "present" ? t.present : s === "away" ? t.away : t.invited);
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
            <Avatar who={m.who} presence={m.state} />
            <span className="mp-person">
              <strong>{t.names[m.who]}</strong>
              <span className="mp-person-meta">
                <RoleTag who={m.who} w={w} /> · {stateWord(m.state)}
              </span>
            </span>
            <span className="mp-person-actions">
              {m.trusted ? (
                <ControlButton size="inline" variant="quiet" data-testid={`revoke-${m.who}`} onPress={() => onRevoke(m.who)}>
                  {t.revokeTrusted}
                </ControlButton>
              ) : (
                <ControlButton size="inline" variant="quiet" data-testid={`trust-${m.who}`} onPress={() => onTrust(m.who)}>
                  <Icon name="shield" aria-hidden="true" />
                  {t.markTrusted}
                </ControlButton>
              )}
              <ControlButton size="inline" variant="quiet" data-testid={`remove-${m.who}`} onPress={() => onRemove(m.who)}>
                {t.remove}
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

function TrustDialog({ who, onAnswer }: { who: Who; onAnswer: (yes: boolean) => void }) {
  const t = useT();
  return (
    <ModalOverlay isOpen isDismissable className="ah-overlay" onOpenChange={(open) => !open && onAnswer(false)}>
      <Modal className="ah-modal">
        <AriaDialog className="ah-dialog ah-helper-dialog mp-dialog" role="alertdialog" aria-label={t.trustTitle(first(t, who))} data-testid="trust-dialog">
          <Heading slot="title">{t.trustTitle(first(t, who))}</Heading>
          <p className="mp-dialog-person">
            <Avatar who={who} /> <strong>{t.names[who]}</strong>
          </p>
          <p>{t.trustBody(first(t, who))}</p>
          <div className="ah-dialog-actions">
            <ControlButton size="row" variant="quiet" autoFocus data-testid="trust-cancel" onPress={() => onAnswer(false)}>
              {t.cancel}
            </ControlButton>
            <ControlButton size="row" variant="primary" data-testid="trust-confirm" onPress={() => onAnswer(true)}>
              {t.trustConfirm}
            </ControlButton>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

function InviteDialog({ w, onClose, onSend }: { w: World; onClose: () => void; onSend: (who: Who[]) => void }) {
  const t = useT();
  const server: Who[] = ["ville", "maija", "pekka"];
  const [chosen, setChosen] = useState<Who[]>([]);
  const free = server.filter((s) => !member(w, s));
  return (
    <Window label={t.inviteTitle} testId="invite-dialog" onClose={onClose}>
      <Heading slot="title">{t.inviteTitle}</Heading>
      <p>{t.inviteLead}</p>
      <ul className="mp-people mp-invite">
        {server.map((s) => {
          const inIt = !!member(w, s);
          return (
            <li key={s}>
              <label data-testid={`invite-${s}`}>
                <input
                  type="checkbox"
                  disabled={inIt}
                  checked={inIt || chosen.includes(s)}
                  onChange={(e) => setChosen(e.target.checked ? [...chosen, s] : chosen.filter((c) => c !== s))}
                />
                <Avatar who={s} />
                <span className="mp-person">
                  <strong>{t.names[s]}</strong>
                  {inIt ? <span className="mp-person-meta">{t.already}</span> : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {free.length ? null : <p>{t.inviteNone}</p>}
      <p className="mp-dialog-rule">
        <Icon name="lock" aria-hidden="true" /> {t.inviteRule}
      </p>
      <div className="ah-dialog-actions">
        <ControlButton size="row" variant="quiet" data-testid="invite-cancel" onPress={onClose}>
          {t.cancel}
        </ControlButton>
        <ControlButton
          size="row"
          variant="primary"
          data-testid="invite-send"
          isDisabled={!chosen.length}
          onPress={() => onSend(chosen)}
        >
          {t.inviteSend}
        </ControlButton>
      </div>
    </Window>
  );
}

/** 1 and 2: one step at a time in production's dialog. */
function StepDialog({
  r,
  index,
  onAnswer,
}: {
  r: Extract<Item, { k: "reply" }>;
  index: number;
  onAnswer: (d: "allow" | "deny") => void;
}) {
  const t = useT();
  const ops = r.stop!.ops;
  const op = ops[index];
  return (
    <ModalOverlay isOpen className="ah-overlay">
      <Modal className="ah-modal">
        <AriaDialog className="ah-dialog ah-helper-dialog mp-dialog" role="alertdialog" aria-label={t.dialogTitle} data-testid="step-dialog">
          <Heading slot="title">{t.dialogTitle}</Heading>
          <p className="mp-dialog-person">
            <Avatar who={r.to} size="s" /> {t.dialogLead(first(t, r.to), index + 1, ops.length)}
          </p>
          <p className="mp-dialog-op" data-testid="step-op">
            <OpLine op={op} t={t} />
          </p>
          <p>{t.dialogRule}</p>
          <div className="ah-dialog-actions">
            <ControlButton size="row" variant="quiet" data-testid="step-deny" onPress={() => onAnswer("deny")}>
              {t.deny}
            </ControlButton>
            <ControlButton size="row" variant="primary" autoFocus data-testid="step-allow" onPress={() => onAnswer("allow")}>
              {t.allow}
            </ControlButton>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

// ---------- The page ----------

type Overlay =
  | { k: "people" }
  | { k: "invite" }
  | { k: "trust"; who: Who }
  | { k: "step"; id: string; index: number; decisions: ("allow" | "deny")[] };

function Main({ d, w, setW }: { d: number; w: World; setW: React.Dispatch<React.SetStateAction<World>> }) {
  const t = useT();
  const status = useText(statusText);
  const [draft, setDraft] = useState(t.ownerDraft);
  const [overlay, setOverlay] = useState<Overlay>();
  const act: Act = {
    goOn: () => setW((x) => ownerWrites(x, t, t.goOnMessage, "goOn")),
    each: (id) => setOverlay({ k: "step", id, index: 0, decisions: [] }),
    decide: (id, index, dec) =>
      setW((x) => {
        const r = x.items.find((i) => i.id === id) as Extract<Item, { k: "reply" }>;
        const decisions = r.stop!.ops.map((o, i) => (i === index ? dec : o.decision)) as ("allow" | "deny" | undefined)[];
        if (decisions.every(Boolean)) return finishEach(x, t, id, decisions as ("allow" | "deny")[]);
        return setStop(x, id, (s) => (s.ops[index].decision = dec));
      }),
  };
  const send = (text?: string) => {
    const body = (text ?? draft).trim();
    if (!body) return;
    setW((x) => ownerWrites(x, t, body));
    setDraft("");
  };
  const stepReply = overlay?.k === "step" ? (w.items.find((i) => i.id === overlay.id) as Extract<Item, { k: "reply" }>) : undefined;
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
              <PeopleBand w={w} onOpen={() => setOverlay({ k: "people" })} onInvite={() => setOverlay({ k: "invite" })} />
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
                beforeField={d === 0 ? <ModeStrip w={w} act={act} /> : undefined}
              />
            </ConversationFrame>
            {overlay?.k === "people" ? (
              <PeoplePanel
                w={w}
                onClose={() => setOverlay(undefined)}
                onTrust={(who) => setOverlay({ k: "trust", who })}
                onRevoke={(who) =>
                  setW((x) =>
                    line(
                      { ...x, members: x.members.map((m) => (m.who === who ? { ...m, trusted: false } : m)) },
                      t.lineRevoked(first(t, who)),
                    ),
                  )
                }
                onRemove={(who) =>
                  setW((x) => line({ ...x, members: x.members.filter((m) => m.who !== who) }, t.lineRemoved(t.names[who])))
                }
              />
            ) : null}
            {overlay?.k === "trust" ? (
              <TrustDialog
                who={overlay.who}
                onAnswer={(yes) => {
                  const who = overlay.who;
                  if (yes)
                    setW((x) =>
                      line(
                        { ...x, members: x.members.map((m) => (m.who === who ? { ...m, trusted: true } : m)) },
                        t.lineTrusted(first(t, who)),
                      ),
                    );
                  setOverlay({ k: "people" });
                }}
              />
            ) : null}
            {overlay?.k === "invite" ? (
              <InviteDialog
                w={w}
                onClose={() => setOverlay(undefined)}
                onSend={(who) => {
                  setW((x) =>
                    line(
                      { ...x, members: [...x.members, ...who.map((s) => ({ who: s, state: "invited" as const, trusted: false }))] },
                      t.lineInvited(who.map((s) => t.names[s]).join(", ")),
                    ),
                  );
                  setOverlay(undefined);
                }}
              />
            ) : null}
            {overlay?.k === "step" && stepReply ? (
              <StepDialog
                key={overlay.index}
                r={stepReply}
                index={overlay.index}
                onAnswer={(dec) => {
                  const decisions = [...overlay.decisions, dec];
                  if (decisions.length < stepReply.stop!.ops.length)
                    setOverlay({ ...overlay, index: overlay.index + 1, decisions });
                  else {
                    setOverlay(undefined);
                    setW((x) => finishEach(x, t, overlay.id, decisions));
                  }
                }}
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
  const t = TEXT[language];
  const [w, setW] = useState(() => start(t));
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
  const writes = (who: Who) => setW((x) => (member(x, who) ? guestWrites(x, t, who) : x));
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
                    setW(start(TEXT[reviewLanguage]));
                    setRun((r) => r + 1);
                  }}
                >
                  <option value="fi">suomi</option>
                  <option value="en">English</option>
                </select>
              </label>
              <span className="ra-hint">{t.hint}</span>
              <button type="button" className="ra-event" data-testid="event-ville" disabled={!member(w, "ville")} onClick={() => writes("ville")}>
                {t.villeWrites}
              </button>
              <button type="button" className="ra-event" data-testid="event-maija" disabled={!member(w, "maija")} onClick={() => writes("maija")}>
                {t.maijaWrites}
              </button>
              <button
                type="button"
                className="ra-event"
                data-testid="event-reset"
                onClick={() => {
                  setW(start(t));
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
            <MemoryRouter key={run} initialEntries={[`/workspaces/${t.workspace}?conversation=kevatkokous`]}>
              <Main key={`${direction}-${language}-${run}`} d={direction} w={w} setW={setW} />
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
