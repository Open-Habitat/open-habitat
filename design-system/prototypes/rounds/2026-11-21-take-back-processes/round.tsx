import React, { type ReactNode, useLayoutEffect, useRef, useState } from "react";
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
  Composer,
  ConversationTimeline,
  ToolRow,
  UserMessage,
} from "../../../../web/src/components/Conversation";
import { ConversationFrame, ConversationStream } from "../../../../web/src/components/ConversationFrame";
import { ControlButton } from "../../../../web/src/components/ControlElements";
import { HabitatMark } from "../../../../web/src/components/HabitatMark";
import "../../../../web/src/components/HelperArchive.css";
import { Icon } from "../../../../web/src/components/Icon";
import { Markdown } from "../../../../web/src/components/Markdown";
import { AgentHeader, AppShell, WorkspaceNavRow, WorkspaceRail } from "../../../../web/src/components/Navigation";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { setPersonalLanguage } from "../../../../web/src/i18n";
import "../../../../web/src/components/components.css";
import { type ProcId, TEXT, type Text, type Who } from "./text";
import "./round.css";

// multiplayer-take-back-prototype, round 2 (Jari 21.11.2026: direction 1
// Heti; the participant's run continues as text only; the participant's
// processes are offered for stopping, never stopped automatically). The view
// opens just after the owner took full rights back with one tap. What the
// directions share: the take-back line with Pysäytä ajo, the identity of each
// process (command, the participant's message that started it, when, whether
// it still prints and its last line), stopping one or all, Habitat lines that
// everybody sees when something stops, and a participant who sees those lines
// but never the offer. The directions differ in where the offer lives and
// what becomes of it when the owner ignores it.
setPersonalLanguage("fi");

const directions = ["1 Kortti", "2 Merkit", "3 Kysymys"];
const params = new URLSearchParams(location.search);
const noop = () => {};

// ---------- The synthetic world ----------

type ToolState = "succeeded" | "running" | "blocked" | "interrupted";
type ToolDone = { tool: string; target: string; state: ToolState };
type Mode = "tools" | "text" | "live";
type Item =
  | { k: "msg"; id: string; who: Who; text: string; at: string }
  | { k: "reply"; id: string; to: Who; mode: Mode; text: string; at: string; tools: ToolDone[] }
  | { k: "line"; id: string; text: string; ville?: string; taken?: boolean }
  | { k: "offer"; id: string };
type ProcState = "running" | "stopped" | "exited";
type Proc = { id: ProcId | "watch"; cmd: string; by: Who; since: number; msg?: string; state: ProcState; quietFrom?: number };
type Offer = "open" | "kept";
type World = {
  items: Item[];
  procs: Proc[];
  run: "textOnly" | "doneText" | "stopped";
  minute: number;
  seq: number;
  offer: Offer;
  panel: boolean;
  details: boolean;
  /** Index in items from which Habitat lines are news to Ville. */
  takenAt: number;
};

const FILE = "content/events/kevatkokous.md";
const CHECK = "node scripts/check-links.mjs";
const TAKEN = 31;
const at = (m: number) => `14.${String(m).padStart(2, "0")}`;

const start = (t: Text, d: number): World => {
  const items: Item[] = [
    { k: "msg", id: "a1", who: "aino", text: t.c.a1, at: at(2) },
    {
      k: "reply", id: "r1", to: "aino", mode: "tools", text: t.c.r1, at: at(4),
      tools: [
        { tool: "edit", target: FILE, state: "succeeded" },
        { tool: "bash", target: "npm run build -- --watch", state: "succeeded" },
      ],
    },
    { k: "line", id: "g1", text: t.lineGranted(at(5)) },
    { k: "msg", id: "v1", who: "ville", text: t.c.v1, at: at(20) },
    { k: "reply", id: "rv1", to: "ville", mode: "tools", text: t.c.rv1, at: at(20), tools: [{ tool: "bash", target: "npm run preview", state: "succeeded" }] },
    { k: "msg", id: "v1b", who: "ville", text: t.c.v1b, at: at(24) },
    { k: "reply", id: "rv1b", to: "ville", mode: "tools", text: t.c.rv1b, at: at(24), tools: [{ tool: "bash", target: "npm test -- --watch", state: "succeeded" }] },
    { k: "msg", id: "v2", who: "ville", text: t.c.v2, at: at(29) },
    {
      k: "reply", id: "rv2", to: "ville", mode: "live", text: t.c.rv2Live, at: at(29),
      tools: [
        { tool: "read", target: FILE, state: "succeeded" },
        { tool: "bash", target: CHECK, state: "running" },
      ],
    },
    { k: "line", id: "taken", text: `${t.lineTaken(at(TAKEN))} ${t.lineRunText}`, taken: true },
    { k: "offer", id: "offer" },
  ];
  return {
    items,
    seq: 10,
    minute: TAKEN,
    run: "textOnly",
    offer: "open",
    panel: d === 1,
    details: false,
    takenAt: items.length - 2,
    procs: [
      { id: "watch", cmd: "npm run build -- --watch", by: "aino", since: 4, state: "running" },
      { id: "preview", cmd: t.procs.preview.cmd, by: "ville", since: 20, msg: "v1", state: "running" },
      { id: "tests", cmd: t.procs.tests.cmd, by: "ville", since: 24, msg: "v1b", state: "running", quietFrom: 25 },
    ],
  };
};

const tick = (w: World, by = 0): World => ({ ...w, minute: w.minute + by, seq: w.seq + 1 });
const add = (w: World, item: Item): World => ({ ...w, items: [...w.items, item] });
/** A Habitat line everybody sees; `ville` is its wording on his side. */
const line = (w0: World, text: string, ville?: string): World => {
  const w = tick(w0);
  return add(w, { k: "line", id: `l${w.seq}`, text, ville });
};
const villeProcs = (w: World) => w.procs.filter((p) => p.by === "ville");
const liveVille = (w: World) => villeProcs(w).filter((p) => p.state === "running");
const ownLive = (w: World) => w.procs.filter((p) => p.by === "aino" && p.state === "running");
const mapReply = (w: World, f: (r: Extract<Item, { k: "reply" }>) => Extract<Item, { k: "reply" }>): World => ({
  ...w,
  items: w.items.map((i) => (i.id === "rv2" && i.k === "reply" ? f(i) : i)),
});

const listOf = (t: Text, ps: Proc[]) => ps.map((p) => `\`${p.cmd}\``).join(t === TEXT.en ? " and " : " ja ");

function stopProcs(w0: World, t: Text, ids: string[]): World {
  const hit = w0.procs.filter((p) => ids.includes(p.id) && p.state === "running");
  if (!hit.length) return w0;
  const w = { ...w0, procs: w0.procs.map((p) => (hit.includes(p) ? { ...p, state: "stopped" as const } : p)) };
  return hit.length === 1
    ? line(w, t.lineStopped(hit[0].cmd), t.villeStopped(hit[0].cmd))
    : line(w, t.lineStoppedAll(hit.length), t.villeStoppedAll(listOf(t, hit)));
}

function stopRun(w0: World, t: Text): World {
  if (w0.run !== "textOnly") return w0;
  const w = mapReply(w0, (r) => ({
    ...r,
    mode: "text",
    text: t.c.rv2Stopped,
    tools: r.tools.map((x) => (x.state === "running" ? { ...x, state: "interrupted" } : x)),
  }));
  return line({ ...w, run: "stopped" }, t.lineRunStopped, t.sideRunStopped);
}

/** The text-only run ends: the started check finishes, the edit is blocked. */
function runEnds(w0: World, t: Text): World {
  if (w0.run !== "textOnly") return w0;
  const w = mapReply(tick(w0, 1), (r) => ({
    ...r,
    mode: "text",
    text: t.c.rv2Text,
    tools: [...r.tools.map((x) => (x.state === "running" ? { ...x, state: "succeeded" as const } : x)), { tool: "edit", target: FILE, state: "blocked" }],
  }));
  return { ...w, run: "doneText" };
}

/** The owner ignores the offer and writes on. */
function ownerCarriesOn(w0: World, t: Text, d: number): World {
  let w = tick(w0, 2);
  w = add(w, { k: "msg", id: `m${w.seq}`, who: "aino", text: t.ownerSays, at: at(w.minute) });
  if (d === 1) w = { ...w, panel: false };
  if (d === 2) w = { ...w, offer: "kept", details: false };
  return w;
}

function testsExit(w0: World, t: Text): World {
  const p = w0.procs.find((x) => x.id === "tests");
  if (!p || p.state !== "running") return w0;
  return line({ ...tick(w0, 1), procs: w0.procs.map((x) => (x.id === "tests" ? { ...x, state: "exited" as const } : x)) }, t.lineExited(p.cmd));
}

// ---------- Language and review state ----------

let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: "fi" | "en" = params.get("lang") === "en" ? "en" : "fi";
const LangContext = React.createContext<"fi" | "en">("fi");
const useT = () => TEXT[React.useContext(LangContext)];

// ---------- Pieces ----------

const tone: Record<Who, number> = { aino: 0, ville: 1, maija: 2 };

function Avatar({ who, size = "m" }: { who: Who; size?: "s" | "m" | "xs" }) {
  const t = useT();
  return (
    <span className="mp-avatar" data-size={size} data-tone={tone[who]} aria-hidden="true">
      {t.names[who].slice(0, 1)}
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

function ModeMark({ mode, live }: { mode: Mode; live: boolean }) {
  const t = useT();
  const text = mode !== "tools";
  return (
    <span className="mp-mode" data-mode={text ? "text" : "trusted"} data-testid="mode-mark">
      <Icon name={text ? "lock" : "shield"} aria-hidden="true" />
      {text ? t.textOnly : t.toolsOn}
      {live ? ` · ${t.running}` : ""}
    </span>
  );
}

type Act = {
  stop: (ids: string[]) => void;
  stopRun: () => void;
  keep: () => void;
  reopen: () => void;
  show: (msg: string) => void;
  panel: (open: boolean) => void;
  details: (open: boolean) => void;
};

function HabitatLine({ i, w, act }: { i: Extract<Item, { k: "line" }>; w: World; act: Act }) {
  const t = useT();
  return (
    <div className="mp-line" data-testid={i.taken ? "taken-line" : "habitat-line"}>
      <HabitatMark size={16} state="idle" />
      <span className="mp-line-who">{t.habitat}</span>
      <span className="mp-line-text">
        <Markdown text={i.text} />
      </span>
      {i.taken && w.run === "textOnly" ? (
        <ControlButton size="inline" variant="quiet" data-testid="stop-run" onPress={act.stopRun}>
          <Icon name="stop" aria-hidden="true" />
          {t.stopRun}
        </ControlButton>
      ) : null}
    </div>
  );
}

const procText = (t: Text, p: Proc) => (p.id === "watch" ? undefined : t.procs[p.id]);

/** One process, identified: command, the message that started it, when, and
 * whether it still prints. Shared by every direction. */
function ProcRow({ p, w, act, dense = false }: { p: Proc; w: World; act: Act; dense?: boolean }) {
  const t = useT();
  const own = procText(t, p);
  const msg = w.items.find((i) => i.id === p.msg) as Extract<Item, { k: "msg" }> | undefined;
  const live = p.state === "running";
  const quiet = p.quietFrom !== undefined;
  const output = !live
    ? p.state === "stopped"
      ? t.stoppedNow
      : t.exited
    : quiet
      ? t.outputQuiet(w.minute - p.quietFrom!)
      : t.outputLive(w.minute === TAKEN ? 5 : 3);
  return (
    <li className="tp-proc" data-testid={`proc-${p.id}`} data-state={p.state} data-dense={dense || undefined}>
      <div className="tp-proc-head">
        <Icon name="terminal" aria-hidden="true" />
        <code className="tp-cmd">{p.cmd}</code>
        {live ? (
          <ControlButton size="inline" variant="quiet" data-testid={`stop-${p.id}`} onPress={() => act.stop([p.id])}>
            <Icon name="stop" aria-hidden="true" />
            {t.stop}
          </ControlButton>
        ) : (
          <span className="tp-proc-end" data-testid={`ended-${p.id}`}>
            <Icon name={p.state === "stopped" ? "check" : "info"} aria-hidden="true" />
            {output}
          </span>
        )}
      </div>
      {msg && own ? (
        <div className="tp-proc-from" data-testid={`from-${p.id}`}>
          <Avatar who="ville" size="xs" />
          <span>
            {t.fromMessage(msg.at)}
            {dense ? null : <q className="tp-quote">{own.quote}</q>}
          </span>
          <button type="button" className="tp-link" data-testid={`show-${p.id}`} onClick={() => act.show(msg.id)}>
            {t.showMessage}
          </button>
        </div>
      ) : null}
      {live ? (
        <div className="tp-proc-meta">
          <span data-testid={`started-${p.id}`}>{t.started(at(p.since), w.minute - p.since)}</span>
          <span className="tp-output" data-testid={`output-${p.id}`} data-output={quiet ? "quiet" : "live"}>
            <i className="tp-dot" aria-hidden="true" />
            {output}
          </span>
          {own && !dense ? <code className="tp-last" data-testid={`last-${p.id}`}>{own.last}</code> : null}
        </div>
      ) : null}
    </li>
  );
}

function OwnNote({ w }: { w: World }) {
  const t = useT();
  const n = ownLive(w).length;
  return n ? (
    <p className="tp-own" data-testid="own-note">
      {t.ownNote(n)}
    </p>
  ) : null;
}


/** 1 Kortti: the full list in the conversation, until resolved. */
function Card({ w, act }: { w: World; act: Act }) {
  const t = useT();
  const live = liveVille(w);
  if (!live.length)
    return (
      <div className="mp-line tp-folded" data-testid="offer-done">
        <Icon name="check" aria-hidden="true" />
        <span className="mp-line-text">{t.cardDone}</span>
      </div>
    );
  if (w.offer === "kept")
    return (
      <div className="mp-line tp-folded" data-testid="offer-folded">
        <Icon name="terminal" aria-hidden="true" />
        <span className="mp-line-text">
          <Markdown text={t.cardKept(listOf(t, live))} />
        </span>
        <ControlButton size="inline" variant="quiet" data-testid="offer-reopen" onPress={act.reopen}>
          {t.cardReopen}
        </ControlButton>
      </div>
    );
  return (
    <section className="mp-card tp-card" data-testid="offer-card" aria-label={t.procsTitle(live.length)}>
      <header>
        <Icon name="terminal" aria-hidden="true" />
        <strong>{t.procsTitle(live.length)}</strong>
        <span className="tp-owner-only">
          <Icon name="eye" aria-hidden="true" />
          {t.ownerOnly}
        </span>
      </header>
      <p className="mp-card-lead">{t.procsLead}</p>
      <ul className="tp-procs">
        {villeProcs(w).map((p) => (
          <ProcRow key={p.id} p={p} w={w} act={act} />
        ))}
      </ul>
      <OwnNote w={w} />
      <footer className="tp-actions">
        <ControlButton size="row" variant="quiet" data-testid="offer-keep" onPress={act.keep}>
          {t.keep}
        </ControlButton>
        {live.length > 1 ? (
          <ControlButton size="row" variant="primary" data-testid="offer-stop-all" onPress={() => act.stop(live.map((p) => p.id))}>
            <Icon name="stop" aria-hidden="true" />
            {t.stopAll(live.length)}
          </ControlButton>
        ) : null}
      </footer>
    </section>
  );
}

/** 2 Merkit: only a line in the conversation; the list is the process panel. */
function StripLine({ w, act }: { w: World; act: Act }) {
  const t = useT();
  const live = liveVille(w);
  if (!live.length)
    return (
      <div className="mp-line tp-folded" data-testid="offer-done">
        <Icon name="check" aria-hidden="true" />
        <span className="mp-line-text">{t.cardDone}</span>
      </div>
    );
  return (
    <div className="mp-line tp-folded" data-testid="offer-strip-line">
      <Icon name="terminal" aria-hidden="true" />
      <span className="mp-line-text">{t.stripLine(live.length)}</span>
      <ControlButton size="inline" variant="quiet" data-testid="offer-open-panel" onPress={() => act.panel(true)}>
        {t.stripOpen}
      </ControlButton>
    </div>
  );
}

function ProcessPill({ w, act }: { w: World; act: Act }) {
  const t = useT();
  const live = w.procs.filter((p) => p.state === "running");
  const ville = liveVille(w);
  if (!live.length) return null;
  return (
    <div className="tp-strip" data-testid="strip">
      <button
        type="button"
        className="tp-pill"
        data-testid="pill"
        aria-expanded={w.panel}
        aria-label={t.pillLabel(live.length)}
        onClick={() => act.panel(!w.panel)}
      >
        <Icon name="terminal" aria-hidden="true" />
        <span>{live.length}</span>
        {ville.length ? (
          <span className="tp-pill-ville" data-testid="pill-ville">
            <Avatar who="ville" size="xs" />
            {ville.length}
          </span>
        ) : null}
      </button>
      {w.panel ? (
        <div className="tp-panel" data-testid="panel" role="dialog" aria-label={t.panelTitle}>
          <header>
            <strong>{t.panelTitle}</strong>
            <button type="button" className="tp-panel-close" data-testid="panel-close" aria-label={t.close} onClick={() => act.panel(false)}>
              <Icon name="cross" aria-hidden="true" />
            </button>
          </header>
          {villeProcs(w).length ? (
            <section className="tp-group" data-testid="panel-ville" data-who="ville">
              <h3>
                <Avatar who="ville" size="xs" />
                {t.panelFromVille}
                {ville.length > 1 ? (
                  <ControlButton size="inline" variant="quiet" data-testid="panel-stop-ville" onPress={() => act.stop(ville.map((p) => p.id))}>
                    <Icon name="stop" aria-hidden="true" />
                    {t.panelStopVille}
                  </ControlButton>
                ) : null}
              </h3>
              <ul className="tp-procs">
                {villeProcs(w).map((p) => (
                  <ProcRow key={p.id} p={p} w={w} act={act} dense />
                ))}
              </ul>
            </section>
          ) : null}
          <section className="tp-group" data-testid="panel-own">
            <h3>{t.panelOwn}</h3>
            <ul className="tp-procs">
              {w.procs
                .filter((p) => p.by === "aino")
                .map((p) => (
                  <li key={p.id} className="tp-proc" data-dense data-testid={`own-${p.id}`}>
                    <div className="tp-proc-head">
                      <Icon name="terminal" aria-hidden="true" />
                      <code className="tp-cmd">{p.cmd}</code>
                      <span className="tp-proc-end">{t.started(at(p.since), w.minute - p.since)}</span>
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}

/** 3 Kysymys: a compact question; folds into a line once the owner moves on. */
function Ask({ w, act }: { w: World; act: Act }) {
  const t = useT();
  const live = liveVille(w);
  if (!live.length)
    return (
      <div className="mp-line tp-folded" data-testid="offer-done">
        <Icon name="check" aria-hidden="true" />
        <span className="mp-line-text">{t.cardDone}</span>
      </div>
    );
  if (w.offer === "kept")
    return (
      <div className="mp-line tp-folded" data-testid="offer-folded">
        <Icon name="terminal" aria-hidden="true" />
        <span className="mp-line-text">
          <Markdown text={t.askFolded(listOf(t, live))} />
        </span>
        <ControlButton size="inline" variant="quiet" data-testid="offer-reopen" onPress={act.reopen}>
          {t.askFoldedStop}
        </ControlButton>
      </div>
    );
  return (
    <section className="tp-ask" data-testid="offer-ask" aria-label={t.askQ(live.length)}>
      <p className="tp-ask-q">
        <Icon name="terminal" aria-hidden="true" />
        <strong>{t.askQ(live.length)}</strong>
        <span className="tp-owner-only">
          <Icon name="eye" aria-hidden="true" />
          {t.ownerOnly}
        </span>
      </p>
      <p className="tp-ask-cmds" data-testid="ask-cmds">
        {live.map((p) => (
          <code key={p.id}>{p.cmd}</code>
        ))}
      </p>
      <div className="tp-ask-actions">
        <ControlButton size="inline" variant="primary" data-testid="offer-stop-all" onPress={() => act.stop(live.map((p) => p.id))}>
          <Icon name="stop" aria-hidden="true" />
          {live.length === 2 ? t.stopBoth : live.length === 1 ? t.stop : t.stopAll(live.length)}
        </ControlButton>
        <ControlButton size="inline" variant="quiet" data-testid="offer-keep" onPress={act.keep}>
          {t.keep}
        </ControlButton>
        <button type="button" className="tp-link" data-testid="ask-details" aria-expanded={w.details} onClick={() => act.details(!w.details)}>
          <Icon name={w.details ? "up" : "down"} aria-hidden="true" />
          {t.details}
        </button>
      </div>
      {w.details ? (
        <>
          <ul className="tp-procs" data-testid="ask-list">
            {villeProcs(w).map((p) => (
              <ProcRow key={p.id} p={p} w={w} act={act} />
            ))}
          </ul>
          <OwnNote w={w} />
        </>
      ) : null}
    </section>
  );
}

function Offer({ d, w, act }: { d: number; w: World; act: Act }) {
  return d === 0 ? <Card w={w} act={act} /> : d === 1 ? <StripLine w={w} act={act} /> : <Ask w={w} act={act} />;
}

// ---------- The conversation ----------

function Thread({ d, w, act, flash }: { d: number; w: World; act: Act; flash?: string }) {
  const t = useT();
  const items: { id: string; kind?: string; content: ReactNode }[] = [];
  for (const i of w.items) {
    if (i.k === "msg") {
      const name = i.who === "aino" ? t.you : t.names[i.who];
      items.push({
        id: i.id,
        kind: "user",
        content: (
          <div className="mp-authored" data-author={i.who} data-testid="authored-message" data-msg={i.id} data-flash={flash === i.id || undefined}>
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
      items.push({ id: i.id, content: <HabitatLine i={i} w={w} act={act} /> });
      continue;
    }
    if (i.k === "offer") {
      items.push({ id: i.id, content: <Offer d={d} w={w} act={act} /> });
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
              statusLabel={tool.state === "blocked" ? t.blocked : tool.state === "interrupted" ? t.interrupted : tool.state === "running" ? t.running : t.tool}
              state={tool.state === "blocked" || tool.state === "interrupted" ? "failed" : tool.state}
              expanded={false}
              onToggle={noop}
            />
          </div>
        ),
      }),
    );
    const live = i.id === "rv2" && w.run === "textOnly";
    const mode: Mode = i.id === "rv2" ? "text" : i.mode;
    items.push({
      id: i.id,
      kind: "assistant",
      content: (
        <div className="mp-reply" data-mode={mode} data-testid="agent-reply" data-reply={i.id}>
          <AssistantMessage streamState={live ? "streaming" : "complete"} time={i.at} onCopy={noop}>
            <Markdown text={i.text} />
          </AssistantMessage>
          <HeaderSlot className="mp-reply-meta">
            <span className="mp-reply-to">{t.replyTo(i.to === "aino" ? t.you.toLocaleLowerCase() : t.names[i.to].split(" ")[0])}</span>
            {i.to !== "aino" ? <ModeMark mode={mode} live={live} /> : null}
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

function PeopleBand({ d, w, onJump }: { d: number; w: World; onJump: () => void }) {
  const t = useT();
  const live = liveVille(w);
  return (
    <div className="mp-band" data-testid="people-band">
      <span className="mp-band-people">
        <span className="mp-stack">
          <Avatar who="aino" size="s" />
          <Avatar who="ville" size="s" />
          <Avatar who="maija" size="s" />
        </span>
        <span className="mp-band-count">{t.peopleCount(3)}</span>
      </span>
      {d === 0 && live.length ? (
        <button type="button" className="tp-band-chip" data-testid="band-procs" onClick={onJump}>
          <Icon name="terminal" aria-hidden="true" />
          {t.bandProcs(live.length)}
        </button>
      ) : null}
    </div>
  );
}

// ---------- The participant's side ----------

function SideView({ w, open, onClose }: { w: World; open: boolean; onClose: () => void }) {
  const t = useT();
  const run = w.run === "textOnly" ? t.sideRunText : w.run === "stopped" ? t.sideRunStopped : t.sideRunWaiting;
  const news = w.items.slice(w.takenAt).filter((i): i is Extract<Item, { k: "line" }> => i.k === "line" && !i.taken);
  return (
    <aside className="tb-side" data-testid="side" data-open={open || undefined} aria-label={t.sideTitle}>
      <header className="tb-side-head">
        <Avatar who="ville" size="s" />
        <strong>{t.sideTitle}</strong>
        <button type="button" className="tb-side-close" data-testid="side-close" onClick={onClose} aria-label={t.close}>
          <Icon name="cross" aria-hidden="true" />
        </button>
      </header>
      <section>
        <h3>{t.sideShared}</h3>
        <p className="tb-side-item" data-testid="side-shared">
          <Avatar who="aino" size="s" />
          <span>
            <strong>{t.convTitle}</strong>
            <span className="tb-hint">{t.sideFrom(t.gen.aino)}</span>
          </span>
        </p>
      </section>
      <section>
        <p className="tb-side-strip" data-testid="side-strip">
          <Icon name="lock" aria-hidden="true" />
          <span>{t.sideText(at(TAKEN))}</span>
        </p>
        <p className="tb-side-run" data-testid="side-run">
          {run}
        </p>
        <h3>{t.sideRecent}</h3>
        <ol className="tb-side-recent" data-testid="side-lines">
          {news.length ? (
            news.map((i) => (
              <li key={i.id} data-kind="line">
                <span className="tb-side-text">
                  <Markdown text={i.ville ?? i.text} />
                </span>
              </li>
            ))
          ) : (
            <li className="tb-hint">{t.sideNoLines}</li>
          )}
        </ol>
        <p className="tb-hint" data-testid="side-no-offer">
          {t.sideNoOffer}
        </p>
      </section>
    </aside>
  );
}

// ---------- The page ----------

function Main({ d, w, setW, side, setSide }: { d: number; w: World; setW: React.Dispatch<React.SetStateAction<World>>; side: boolean; setSide: (v: boolean) => void }) {
  const t = useT();
  const [draft, setDraft] = useState("");
  const [flash, setFlash] = useState<string>();
  const scrollTo = (sel: string) => {
    requestAnimationFrame(() => document.querySelector(sel)?.scrollIntoView({ block: "center" }));
  };
  const act: Act = {
    stop: (ids) => setW((x) => stopProcs(x, t, ids)),
    stopRun: () => setW((x) => stopRun(x, t)),
    keep: () => setW((x) => ({ ...x, offer: "kept", details: false })),
    reopen: () => setW((x) => ({ ...x, offer: "open", details: true })),
    show: (msg) => {
      setW((x) => ({ ...x, panel: false }));
      setFlash(msg);
      scrollTo(`[data-msg="${msg}"]`);
      setTimeout(() => setFlash((f) => (f === msg ? undefined : f)), 2400);
    },
    panel: (open) => setW((x) => ({ ...x, panel: open })),
    details: (open) => setW((x) => ({ ...x, details: open })),
  };
  const send = (text?: string) => {
    const body = (text ?? draft).trim();
    if (!body) return;
    setW((x) => {
      const n = tick(x, 1);
      return add(n, { k: "msg", id: `m${n.seq}`, who: "aino", text: body, at: at(n.minute) });
    });
    setDraft("");
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
              <PeopleBand
                d={d}
                w={w}
                onJump={() => {
                  setW((x) => ({ ...x, offer: "open" }));
                  scrollTo('[data-item="offer"]');
                }}
              />
              <ConversationStream>
                <Thread d={d} w={w} act={act} flash={flash} />
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
                idlePlaceholder=""
                beforeField={d === 1 ? <ProcessPill w={w} act={act} /> : undefined}
              />
            </ConversationFrame>
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
  // Open on the take-back, as the owner sees it right after the tap.
  useLayoutEffect(() => {
    requestAnimationFrame(() => document.querySelector('[data-item="taken"]')?.scrollIntoView({ block: "start" }));
  }, [run, language]);
  const reset = (lang = language) => {
    setW(start(TEXT[lang], direction));
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
                  reset(reviewLanguage);
                }}
              >
                <option value="fi">suomi</option>
                <option value="en">English</option>
              </select>
            </label>
            <span className="ra-hint">{t.hint}</span>
            <button type="button" className="ra-event" data-testid="event-owner" onClick={() => setW((x) => ownerCarriesOn(x, t, direction))}>
              {t.events.owner}
            </button>
            <button type="button" className="ra-event" data-testid="event-exit" disabled={w.procs.find((p) => p.id === "tests")?.state !== "running"} onClick={() => setW((x) => testsExit(x, t))}>
              {t.events.exit}
            </button>
            <button type="button" className="ra-event" data-testid="event-advance" disabled={w.run !== "textOnly"} onClick={() => setW((x) => runEnds(x, t))}>
              {t.events.advance}
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
            <Main key={`${direction}-${language}-${run}`} d={direction} w={w} setW={setW} side={side} setSide={setSide} />
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
