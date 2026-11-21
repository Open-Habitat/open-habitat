import React, {
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import { AccountShelf } from "../../../../web/src/components/Account";
import {
  AssistantMessage,
  ConversationTimeline,
  ToolOutput,
  ToolRow,
  UserMessage,
} from "../../../../web/src/components/Conversation";
import {
  ConversationFrame,
  ConversationStream,
} from "../../../../web/src/components/ConversationFrame";
import { ControlButton } from "../../../../web/src/components/ControlElements";
import { HabitatMark } from "../../../../web/src/components/HabitatMark";
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
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { Composer } from "../../../../web/src/components/composer/Composer";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { statusText } from "../../../../web/src/text/status";
import "../../../../web/src/components/components.css";
import { type Op, TEXT, type Text } from "./text";
import "./round.css";

// multiplayer-conversations, the participant's (guest's) view (Jari
// 21.11.2026). Anyone in the conversation may write and the agent answers,
// but on a turn that answers someone other than the owner the agent has no
// tools: it answers with text only. The owner then says Voit jatkaa, or
// approves each action; when the owner speaks the agent has all its tools
// again. Whoever sent the latest message defines the tool mode. The owner
// can mark a participant trusted, who then uses the chat normally.
//
// Built on production pieces: AppShell, WorkspaceRail with AgentNavItem
// rows, AgentHeader, ConversationTimeline with UserMessage,
// AssistantMessage, ToolRow and ToolOutput, and the production Composer
// (its beforeField slot carries direction 1's strip). The round's own
// parts: the people's names, avatars and roles on messages (production
// UserMessage always says Sinä), the invite, the three ways of showing the
// tool mode, Habitat's lines, and the stand-in for Aino's answers.
setPersonalLanguage("fi");

const directions = ["1 Kaista", "2 Merkki", "3 Kortti"];
const params = new URLSearchParams(location.search);
const noop = () => {};

// ---------- The synthetic world ----------

type Person = "aino" | "sanna" | "ville";
const NAMES: Record<Person, string> = { aino: "Aino", sanna: "Sanna", ville: "Ville" };
type Phase = "invite" | "declined" | "joined" | "pending" | "continued" | "perOp";
type Extra = { text: string; trusted: boolean };
type World = { phase: Phase; trusted: boolean; ville?: string; extras: Extra[] };
type Step = "invite" | "pending" | "continued" | "perOp" | "trusted";

const STEPS: Record<Step, World> = {
  invite: { phase: "invite", trusted: false, extras: [] },
  pending: { phase: "pending", trusted: false, extras: [] },
  continued: { phase: "continued", trusted: false, extras: [] },
  perOp: { phase: "perOp", trusted: false, extras: [] },
  trusted: { phase: "continued", trusted: true, extras: [{ text: "", trusted: true }] },
};
const START: Step = (params.get("step") as Step) in STEPS ? (params.get("step") as Step) : "pending";

type OpState = "waiting" | "approved" | "declined" | "done";
const opStates = (w: World): Record<Op, OpState> =>
  w.phase === "continued"
    ? { edit: "done", deploy: "done" }
    : w.phase === "perOp"
      ? { edit: "done", deploy: "declined" }
      : { edit: "waiting", deploy: "waiting" };
const joined = (w: World) => w.phase !== "invite" && w.phase !== "declined";
const sent = (w: World) => joined(w) && w.phase !== "joined";
const waiting = (w: World) => w.phase === "pending" && !w.trusted;

// ---------- Language and theme ----------

let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: "fi" | "en" = params.get("lang") === "en" ? "en" : "fi";
const LangContext = React.createContext<"fi" | "en">("fi");
const useT = () => TEXT[React.useContext(LangContext)];

// ---------- People on messages ----------

/** The round's avatar: production's account avatar (initial in a circle),
 * coloured per person so a glance tells people apart; the name and role
 * beside it carry the meaning. */
function Avatar({ who }: { who: Person }) {
  return (
    <span className="ah-account-avatar mg-avatar" data-person={who} aria-hidden="true">
      {NAMES[who].slice(0, 1)}
    </span>
  );
}

function roleOf(who: Person, w: World): keyof Text["roles"] | null {
  if (who === "aino") return "owner";
  if (who === "sanna") return "trusted";
  return w.trusted ? "trusted" : null;
}

function Role({ role }: { role: keyof Text["roles"] }) {
  const t = useT();
  return (
    <span className="mg-role" data-role={role} data-testid="role">
      {t.roles[role]}
    </span>
  );
}

/** Puts children at the start (or the end) of the production message's
 * own header, without changing Message. */
function IntoHeader({ children, at = "start", wrap }: { children: ReactNode; at?: "start" | "end"; wrap: React.RefObject<HTMLDivElement | null> }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const span = document.createElement("span");
    span.className = `mg-host mg-host-${at}`;
    let frame = 0;
    // The timeline may mount its items a frame later than this effect.
    const place = () => {
      const header = wrap.current?.querySelector<HTMLElement>("article > header");
      if (!header) {
        frame = requestAnimationFrame(place);
        return;
      }
      if (at === "start") header.prepend(span);
      else header.append(span);
      setHost(span);
    };
    place();
    return () => {
      cancelAnimationFrame(frame);
      span.remove();
    };
  }, [wrap, at]);
  return host ? createPortal(children, host) : null;
}

/** A person's message: production UserMessage with the author's avatar,
 * name and role in its header in place of Sinä (hidden by CSS). In
 * production this is an author field on the message. */
function PersonMessage({ who, text, time, w }: { who: Person; text: string; time: string; w: World }) {
  const t = useT();
  const wrap = useRef<HTMLDivElement>(null);
  const role = roleOf(who, w);
  const own = who === "ville";
  return (
    <div className="mg-person" ref={wrap} data-person={who} data-testid={`msg-${who}`}>
      <IntoHeader wrap={wrap}>
        <Avatar who={who} />
        <strong className="mg-name">{own ? `${NAMES[who]} (${t.you})` : NAMES[who]}</strong>
        {role ? <Role role={role} /> : null}
      </IntoHeader>
      <UserMessage sourceText={text} time={time} onCopy={noop}>
        <Markdown text={text} />
      </UserMessage>
    </div>
  );
}

// ---------- The tool mode, three ways ----------

type Turn = { from: Person; tools: boolean };

/** 2 Merkki: the turn's mode in the reply's header. */
function Badge({ turn, wrap }: { turn: Turn; wrap: React.RefObject<HTMLDivElement | null> }) {
  const t = useT();
  return (
    <IntoHeader wrap={wrap} at="end">
      <span className="mg-badge" data-tools={turn.tools ? "on" : "off"} data-testid="turn-badge">
        <Icon name={turn.tools ? "run" : "message"} aria-hidden="true" />
        {turn.tools ? t.badgeTools(NAMES[turn.from]) : t.badgeTextOnly(NAMES[turn.from])}
      </span>
    </IntoHeader>
  );
}

function Reply({ d, turn, time, children }: { d: number; turn: Turn; time: string; children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  return (
    <div ref={wrap} className="mg-reply" data-tools={turn.tools ? "on" : "off"} data-from={turn.from}>
      {d === 1 ? <Badge turn={turn} wrap={wrap} /> : null}
      <AssistantMessage streamState="complete" time={time} onCopy={noop}>
        {children}
      </AssistantMessage>
    </div>
  );
}

const OPS: Op[] = ["edit", "deploy"];

function OpLine({ op, state }: { op: Op; state: OpState }) {
  const t = useT();
  return (
    <li className="mg-op" data-op={op} data-state={state} data-testid="card-op">
      <span className="mg-op-what">
        {t.ops[op].verb} <code>{t.ops[op].target}</code>
      </span>
      <span className="mg-op-state" data-testid="op-state">
        <Icon
          name={state === "waiting" ? "clock" : state === "declined" ? "cross" : "check"}
          aria-hidden="true"
        />
        {t.opState[state]}
      </span>
    </li>
  );
}

/** 3 Kortti: where the agent stopped. The owner's view shows the same card
 * with Voit jatkaa and per-action approval; the guest reads its states. */
function StopCard({ w }: { w: World }) {
  const t = useT();
  const states = opStates(w);
  const open = OPS.some((o) => states[o] === "waiting");
  return (
    <section className="mg-card" data-open={open || undefined} data-testid="stop-card" aria-label={t.cardHead}>
      <header>
        <Icon name={open ? "clock" : "check"} aria-hidden="true" />
        <strong>{t.cardHead}</strong>
        <span className="mg-card-mode">{t.textOnly}</span>
      </header>
      <ul>
        {OPS.map((o) => (
          <OpLine key={o} op={o} state={states[o]} />
        ))}
      </ul>
      <p>{open ? t.cardLead : t.cardDone}</p>
    </section>
  );
}

/** 2 Merkki's quiet line under the text-only reply while actions wait. */
function PendingLine({ w }: { w: World }) {
  const t = useT();
  if (!waiting(w)) return null;
  return (
    <p className="mg-pending-line" data-testid="pending-line">
      <Icon name="clock" aria-hidden="true" />
      {t.pendingN(OPS.length)}
    </p>
  );
}

/** 1 Kaista: above the field, the mode the next message gets. */
function Strip({ w }: { w: World }) {
  const t = useT();
  const states = opStates(w);
  return (
    <div className="mg-strip" data-tools={w.trusted ? "on" : "off"} data-testid="mode-strip" role="status">
      <span className="mg-strip-mode">
        <Icon name={w.trusted ? "run" : "message"} aria-hidden="true" />
        {w.trusted ? t.toolsOn : t.textOnly}
      </span>
      <span className="mg-strip-text">{w.trusted ? t.stripTrusted : t.stripTextOnly}</span>
      {waiting(w) ? (
        <ul className="mg-strip-ops" data-testid="strip-ops" aria-label={t.pending}>
          {OPS.map((o) => (
            <OpLine key={o} op={o} state={states[o]} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ---------- The conversation ----------

function HabitatLine({ children, testId }: { children: ReactNode; testId: string }) {
  const t = useT();
  return (
    <div className="mg-line" data-testid={testId}>
      <HabitatMark size={16} state="idle" />
      <span className="mg-line-who">{t.habitat}</span>
      <span className="mg-line-text">{children}</span>
    </div>
  );
}

/** A tool row as a participant sees it: name, target and state; the
 * output is the owner's unless the participant is trusted. */
function Tool({ id, name, target, output, w, open, toggle }: { id: string; name: string; target: string; output: string; w: World; open: Set<string>; toggle: (id: string) => void }) {
  const t = useT();
  return (
    <ToolRow
      name={name}
      targetText={target}
      statusLabel={t.toolOk}
      state="succeeded"
      expanded={open.has(id)}
      onToggle={() => toggle(id)}
    >
      {w.trusted ? (
        <ToolOutput text={output} streamSemantics="replacement" sourceState="complete" onCopy={noop} />
      ) : (
        <p className="mg-hidden-output" data-testid="hidden-output">
          <Icon name="lock" aria-hidden="true" />
          {t.hiddenOutput}
        </p>
      )}
    </ToolRow>
  );
}

function Thread({ d, w, t }: { d: number; w: World; t: Text }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const h = t.history;
  const tool = (id: string, name: string, target: string, output: string) => ({
    id,
    kind: "tool",
    content: <Tool id={id} name={name} target={target} output={output} w={w} open={open} toggle={toggle} />,
  });
  const items: { id: string; kind?: string; content: ReactNode }[] = [
    { id: "aino1", kind: "user", content: <PersonMessage who="aino" text={h.aino1} time="13.58" w={w} /> },
    tool("t-read", "read", "src/pages/index.astro", "---\nconst ohjelma = syksy2025;\n---\n<Etusivu ohjelma={ohjelma} />"),
    { id: "reply1", kind: "assistant", content: <Reply d={d} turn={{ from: "aino", tools: true }} time="13.59"><Markdown text={h.reply1} /></Reply> },
    { id: "sanna", kind: "user", content: <PersonMessage who="sanna" text={h.sanna} time="14.05" w={w} /> },
    tool("t-contact", "edit", "src/data/yhteys.json", '-  "email": "edellinen@esimerkki.fi"\n+  "email": "sihteeri@esimerkki.fi"'),
    { id: "reply2", kind: "assistant", content: <Reply d={d} turn={{ from: "sanna", tools: true }} time="14.06"><Markdown text={h.reply2} /></Reply> },
  ];
  if (joined(w)) items.push({ id: "joined", content: <HabitatLine testId="joined-line">{t.joinedLine}</HabitatLine> });
  if (sent(w)) {
    items.push({ id: "ville", kind: "user", content: <PersonMessage who="ville" text={w.ville ?? h.ville} time="14.31" w={w} /> });
    items.push({
      id: "textonly",
      kind: "assistant",
      content: (
        <div data-testid="text-only-reply">
          <Reply d={d} turn={{ from: "ville", tools: false }} time="14.31"><Markdown text={h.textOnly} /></Reply>
          {d === 1 ? <PendingLine w={w} /> : null}
        </div>
      ),
    });
    if (d === 2) items.push({ id: "card", content: <StopCard w={w} /> });
  }
  if (w.phase === "continued") {
    items.push({ id: "ainoGo", kind: "user", content: <PersonMessage who="aino" text={h.ainoGo} time="14.34" w={w} /> });
    items.push(tool("t-events", "edit", "src/data/tapahtumat.json", '+  { "nimi": "Talkoot", "pvm": "2026-04-12" },\n+  { "nimi": "Kevätkokous", "pvm": "2026-04-26" }'));
    items.push(tool("t-deploy", "bash", "npm run deploy", "> seura-sivut@1.0.0 deploy\nBuilt 14 pages in 2.1 s\nPublished."));
    items.push({ id: "replyGo", kind: "assistant", content: <Reply d={d} turn={{ from: "aino", tools: true }} time="14.35"><Markdown text={h.replyGo} /></Reply> });
  }
  if (w.phase === "perOp") {
    items.push({ id: "perOpLine", content: <HabitatLine testId="per-op-line">{t.perOpLine}</HabitatLine> });
    items.push(tool("t-events", "edit", "src/data/tapahtumat.json", '+  { "nimi": "Talkoot", "pvm": "2026-04-12" },\n+  { "nimi": "Kevätkokous", "pvm": "2026-04-26" }'));
    items.push({ id: "replyPerOp", kind: "assistant", content: <Reply d={d} turn={{ from: "aino", tools: true }} time="14.35"><Markdown text={h.replyPerOp} /></Reply> });
  }
  if (w.trusted) items.push({ id: "trusted", content: <HabitatLine testId="trusted-line">{t.trustedLine}</HabitatLine> });
  w.extras.forEach((x, i) => {
    const text = x.text || h.villeTrusted;
    items.push({ id: `x${i}`, kind: "user", content: <PersonMessage who="ville" text={text} time="14.40" w={w} /> });
    if (x.trusted) {
      items.push(tool(`tx${i}`, "edit", "src/data/tapahtumat.json", '+    "linkki": "/kevatkokous/esityslista.pdf"'));
      items.push({ id: `rx${i}`, kind: "assistant", content: <Reply d={d} turn={{ from: "ville", tools: true }} time="14.41"><Markdown text={h.replyTrusted} /></Reply> });
    } else {
      items.push({ id: `rx${i}`, kind: "assistant", content: <Reply d={d} turn={{ from: "ville", tools: false }} time="14.41"><Markdown text={h.textOnly.split("\n\n").at(-1) ?? ""} /></Reply> });
    }
  });
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

/** Who is in the conversation, under the header. */
function People({ w }: { w: World }) {
  const t = useT();
  return (
    <ul className="mg-people" data-testid="people" aria-label={t.people}>
      {(["aino", "sanna", "ville"] as Person[]).map((p) => {
        const role = roleOf(p, w) ?? "participant";
        return (
          <li key={p} data-person={p}>
            <Avatar who={p} />
            <span>{p === "ville" ? t.you : NAMES[p]}</span>
            <Role role={role} />
          </li>
        );
      })}
      <li className="mg-people-note">{t.noWorkspace}</li>
    </ul>
  );
}

/** The invite, before anything of the conversation is shown. */
function Invite({ w, onJoin, onDecline }: { w: World; onJoin: () => void; onDecline: () => void }) {
  const t = useT();
  const headId = useId();
  return (
    <section className="mg-invite" data-testid="invite" aria-labelledby={headId}>
      <header>
        <Avatar who="aino" />
        <div>
          <h2 id={headId}>{t.inviteHead}</h2>
          <p className="mg-invite-title">
            <strong>{t.convTitle}</strong> · <code>seura-sivut</code>
          </p>
        </div>
      </header>
      <ul>
        {t.inviteFacts.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>
      <p className="mg-invite-model">
        {t.inviteModel}: <code>anthropic/claude-sonnet-5-5</code>
      </p>
      {w.phase === "declined" ? (
        <p className="mg-invite-declined" data-testid="invite-declined">{t.declined}</p>
      ) : null}
      <div className="ah-dialog-actions">
        <ControlButton size="row" variant="quiet" data-testid="invite-decline" onPress={onDecline}>
          {t.notNow}
        </ControlButton>
        <ControlButton size="row" variant="primary" data-testid="invite-join" onPress={onJoin}>
          {t.join}
        </ControlButton>
      </div>
    </section>
  );
}

// ---------- The page ----------

const REAL_NOW = Date.now();

function Main({ d, t, w, setW }: { d: number; t: Text; w: World; setW: React.Dispatch<React.SetStateAction<World>> }) {
  const status = useText(statusText);
  const [draft, setDraft] = useState("");
  const invited = !joined(w);
  const send = (text?: string) => {
    const body = (text ?? draft).trim();
    setDraft("");
    setW((x) =>
      x.phase === "joined" && !x.trusted
        ? { ...x, phase: "pending", ville: body || undefined }
        : { ...x, extras: [...x.extras, { text: body, trusted: x.trusted }] },
    );
  };
  const row: AgentNavModel = {
    agentId: "shared",
    href: "/shared/aino/seura-sivut?conversation=kevat",
    title: t.convTitle,
    workspaceId: "seura-sivut",
    workspaceName: "seura-sivut",
    changedAt: REAL_NOW - 60_000,
    activity: "waiting",
    activityLabel: invited ? t.invited : waiting(w) ? t.activity.waiting : "",
    controlLabel: "",
    attentionLabel: invited ? t.invited : undefined,
    detail: [t.byOwner, invited ? t.invited : waiting(w) ? t.activity.waiting : ""].filter(Boolean).join(" · "),
    selected: true,
  };
  const sharedId = useId();
  const stream = useRef<HTMLElement>(null);
  // Follow the latest, as production does when the person is at the end.
  useLayoutEffect(() => {
    const el = stream.current;
    if (!el) return;
    const end = () => {
      el.scrollTop = el.scrollHeight;
    };
    end();
    const frame = requestAnimationFrame(end);
    return () => cancelAnimationFrame(frame);
  }, [w]);
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
      sessionActions={<AccountShelf profile={{ name: "Ville Esimerkki", email: "", avatar_url: "" }} onSettings={noop} onLogout={noop} />}
      now={
        <section className="ah-now mg-shared" data-testid="rail-shared" aria-labelledby={sharedId}>
          <h2 className="ah-rail-section-head" id={sharedId}>
            {t.shared}
            <span className={`ah-rail-count${invited ? " ah-rail-count-attention" : ""}`}>1</span>
          </h2>
          <ul>
            <AgentNavItem {...row} now={REAL_NOW} />
          </ul>
        </section>
      }
    >
      <WorkspaceNavRow name="kuvat" href="/workspaces/kuvat" />
      <WorkspaceNavRow name="pyorareitit" href="/workspaces/pyorareitit" />
    </WorkspaceRail>
  );
  const activity = waiting(w)
    ? { label: t.activity.waiting, mark: "done" as const }
    : { label: t.activity.done, mark: "done" as const };
  return (
    <StatusBellProvider items={[]}>
      <AppShell
        mobileTitle={t.convTitle}
        rail={rail}
        navigationBadge={invited ? 1 : 0}
        main={
          <div className="mg-main" id="main" data-testid="conversation" data-phase={w.phase} data-trusted={w.trusted || undefined}>
            <ConversationFrame>
              <AgentHeader
                title={t.convTitle}
                workspaceLabel={`Aino · seura-sivut`}
                workspaceHref=""
                activityLabel={invited ? t.invited : activity.label}
                activityMark={activity.mark}
                controlLabel=""
                detailsExpanded={false}
                onToggleDetails={noop}
              />
              <ConversationStream streamRef={stream}>
                {invited ? (
                  <Invite w={w} onJoin={() => setW((x) => ({ ...x, phase: "joined" }))} onDecline={() => setW((x) => ({ ...x, phase: "declined" }))} />
                ) : (
                  <>
                    <People w={w} />
                    <Thread d={d} w={w} t={t} />
                  </>
                )}
              </ConversationStream>
              {invited ? null : (
                <Composer
                  value={draft}
                  onChange={setDraft}
                  activity="idle"
                  selectedWorkingMode="steer"
                  onModeChange={noop}
                  onSendNow={send}
                  onSteer={send}
                  onFollowUp={send}
                  csrf="prototype"
                  idlePlaceholder={w.trusted ? t.placeholderTrusted : t.placeholderGuest}
                  beforeField={d === 0 ? <Strip w={w} /> : undefined}
                />
              )}
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
  const [world, setWorld] = useState<World>(STEPS[START]);
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
  const go = (s: Step) => {
    setWorld(STEPS[s]);
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
                }}
              >
                <option value="fi">suomi</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>
              {t.stepsLabel}{" "}
              <select id="step" data-testid="step" value="" onChange={(e) => go(e.target.value as Step)}>
                <option value="" disabled>
                  …
                </option>
                {(Object.keys(STEPS) as Step[]).map((s) => (
                  <option key={s} value={s}>
                    {t.steps[s]}
                  </option>
                ))}
              </select>
            </label>
            <span className="ra-events">
              {t.events}
              <button type="button" className="ra-event" data-testid="event-continue" disabled={!waiting(world)} onClick={() => setWorld((w) => ({ ...w, phase: "continued" }))}>
                {t.evContinue}
              </button>
              <button type="button" className="ra-event" data-testid="event-perop" disabled={!waiting(world)} onClick={() => setWorld((w) => ({ ...w, phase: "perOp" }))}>
                {t.evPerOp}
              </button>
              <button type="button" className="ra-event" data-testid="event-trust" disabled={!joined(world) || world.trusted} onClick={() => setWorld((w) => ({ ...w, trusted: true }))}>
                {t.evTrust}
              </button>
            </span>
            <span className="ra-hint">{t.hint}</span>
            <button type="button" className="ra-event" data-testid="event-reset" onClick={() => go(START)}>
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
          <MemoryRouter key={run} initialEntries={["/shared/aino/seura-sivut?conversation=kevat"]}>
            <Main key={`${direction}-${language}-${run}`} d={direction} t={t} w={world} setW={setWorld} />
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
