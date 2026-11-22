import React, { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import "../../../../web/src/components/components.css";
import "../../../../web/src/components/Multiplayer.css";
import "../../../../web/src/components/ServerBrowser.css";
import controls from "../../../../web/src/components/Controls.module.css";
import type { FileChange } from "../../../../web/src/app/turnChanges";
import { AccountShelf } from "../../../../web/src/components/Account";
import { AgentTurn, type TurnStep } from "../../../../web/src/components/AgentTurn";
import { BashToolCard } from "../../../../web/src/components/BashToolCard";
import { AssistantMessage, Composer, ConversationTimeline, UserMessage } from "../../../../web/src/components/Conversation";
import { ConversationFrame, ConversationStream } from "../../../../web/src/components/ConversationFrame";
import { ControlButton, LinkRow } from "../../../../web/src/components/ControlElements";
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
import { PiToolUse } from "../../../../web/src/components/PiBlocks";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { TurnChanges } from "../../../../web/src/components/TurnChanges";
import { setPersonalLanguage } from "../../../../web/src/i18n";
import { type Conv, type Phase, TEXT, type Text } from "./text";
import "./round.css";

// server-browser-entry-points, round 3 (22.11.2026). Round 2's direction 2
// (Rivi) is the basis: the browser lives in the sidebar, and a request from
// a conversation shows in the sidebar, not above every composer. Jari: what
// the conversation shows is far too big. This round shows the browser's
// request and the agent's browser activity tidily in three places:
//   1 the rail's Oma selain item (a plain row like Tuotokset, its own icon);
//   2 the conversation's own row in the rail (a browser mark at its end);
//   3 inside the conversation, as one family with the accepted visit-record
//     card (browser-visit-record, direction 2 Kortti).
// Places 1 and 2 are the same in every direction so the comparison stays on
// one axis: the size and form of place 3.
//   1 Rivi    — one line while live; the record card when done.
//   2 Kortti  — the record card itself throughout, changing state in place.
//   3 Ikkuna  — the card with a small picture of the window.
// The sheet follows the accepted control round (direction 1 Kehys): the frame
// tells who controls, the turn and Valmis ride on its tab.
// Production components: the shell, rail, rows, turn, tool cards, Muutokset,
// composer. The round's own: the three places' pieces, the window icon, the
// sheet's Kehys stand-in and the drawn page pictures. Synthetic throughout.
setPersonalLanguage("fi");

const directions = ["1 Rivi", "2 Kortti", "3 Ikkuna"];
const params = new URLSearchParams(location.search);
const noop = () => {};
const PHASES: Phase[] = ["stopped", "idle", "working", "ask", "control", "done"];

// ---------- The window icon (proposed for Icon.tsx as `browser`) ----------

/** A browser window: frame, tab bar, address line. Tuotokset keeps the
 * globe (public addresses on the web); Oma selain gets this. */
function BrowserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      data-icon="browser"
      {...props}
    >
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 9h18" />
      <path d="M6.5 6.5h.01M9 6.5h.01" />
      <path d="M7 13.5h6" />
    </svg>
  );
}

// ---------- The synthetic browser ----------

type WinKey = "laskut" | "kirjaudu" | "kirjasto" | "posti" | "kalenteri";
const WIN: Record<WinKey, { id: string; origin: string; hue: string }> = {
  laskut: { id: "7F2A", origin: "energia.example", hue: "#8a4b1f" },
  kirjaudu: { id: "9C41", origin: "tunnistus.example", hue: "#3b4f7a" },
  kirjasto: { id: "3B10", origin: "kirjasto.example", hue: "#3d6b4f" },
  posti: { id: "5D22", origin: "posti.example", hue: "#6b3d63" },
  kalenteri: { id: "8E07", origin: "kalenteri.example", hue: "#4f5a3d" },
};
type World = { phase: Phase; resumed: boolean; many: boolean };
type Win = { key: WinKey; agent: boolean };

/** The browser's windows in a world: the person's own, and the agent's while it works. */
function windowsOf(w: World): Win[] {
  if (w.phase === "stopped") return [];
  const own: Win[] = [{ key: "kirjasto", agent: false }];
  if (w.many) own.push({ key: "posti", agent: false }, { key: "kalenteri", agent: false });
  if (w.phase === "working") return [{ key: "laskut", agent: true }, ...own];
  if (w.phase === "ask" || w.phase === "control")
    return [{ key: "laskut", agent: true }, { key: "kirjaudu", agent: true }, ...own];
  return own;
}
const asking = (w: World) => w.phase === "ask" || w.phase === "control";
/** The window the conversation's piece is about. */
const focusOf = (w: World): WinKey => (asking(w) ? "kirjaudu" : "laskut");

/** A page's picture: a plain drawn page standing in for the window JPEG.
 * A third-party page keeps its own colours whatever Habitat's theme. */
function picture(t: Text, k: WinKey) {
  const [head, line, button] = t.sheetPage[k];
  const hue = WIN[k].hue;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><rect width="640" height="400" fill="#fbfaf7"/><rect width="640" height="56" fill="${hue}"/><text x="28" y="36" font-family="sans-serif" font-size="20" fill="#fff">${esc(WIN[k].origin)}</text><text x="40" y="120" font-family="sans-serif" font-size="30" fill="#222">${esc(head)}</text><text x="40" y="170" font-family="sans-serif" font-size="20" fill="#555">${esc(line)}</text><rect x="40" y="200" width="420" height="10" rx="5" fill="#e4e1da"/><rect x="40" y="224" width="360" height="10" rx="5" fill="#e4e1da"/><rect x="40" y="290" width="190" height="48" rx="8" fill="${hue}"/><text x="60" y="321" font-family="sans-serif" font-size="18" fill="#fff">${esc(button)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ---------- The visit, from the agent's own browser commands ----------

const CLI = "open-habitat agent browser";
const DIR = "~/Downloads/energia-2026/";
type Page = { at: string; origin: string; path: string; title: string };
type Visit = { start: string; end?: string; pages: Page[]; downloads: string[]; actions: { at: string; sel: string }[]; open: boolean };
const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"];

function visitOf(t: Text, w: World): Visit {
  const p1: Page = { at: "9.12", origin: "energia.example", path: "/laskut", title: t.windows.laskut };
  const p2: Page = { at: "9.13", origin: "tunnistus.example", path: "/vahvista", title: t.windows.kirjaudu };
  const p3: Page = { at: "9.19", origin: "energia.example", path: "/laskut", title: t.windows.laskut };
  const bills: Page[] = MONTHS.map((m, i) => ({ at: `9.${20 + i}`, origin: "energia.example", path: `/laskut/2026-${m}`, title: `${t.sheetPage.laskut[0]} 2026-${m}` }));
  const base = { start: "9.12", downloads: [] as string[], actions: [] as { at: string; sel: string }[], open: true };
  if (w.phase === "working" && !w.resumed) return { ...base, pages: [p1] };
  if (asking(w)) return { ...base, pages: [p1, p2], actions: [{ at: "9.13", sel: "a.kirjaudu" }] };
  if (w.phase === "working") return { ...base, pages: [p1, p2, p3], actions: [{ at: "9.13", sel: "a.kirjaudu" }] };
  return {
    ...base,
    end: "9.31",
    open: false,
    pages: [p1, p2, p3, ...bills],
    downloads: MONTHS.map((m) => `lasku-2026-${m}.pdf`),
    actions: [
      { at: "9.13", sel: "a.kirjaudu" },
      { at: "9.19", sel: "select#vuosi" },
    ],
  };
}
const origins = (v: Visit) => {
  const m = new Map<string, number>();
  for (const p of v.pages) m.set(p.origin, (m.get(p.origin) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

// ---------- Review state ----------

let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: "fi" | "en" = params.get("lang") === "en" ? "en" : "fi";
const firstPhase = (PHASES.includes(params.get("state") as Phase) ? params.get("state") : "ask") as Phase;
const LangContext = React.createContext<"fi" | "en">("fi");
const useT = () => TEXT[React.useContext(LangContext)];

type Act = {
  look: (focus?: WinKey) => void;
  take: () => void;
  giveBack: () => void;
  openBrowser: () => void;
};

// ---------- Place 1: the rail's Oma selain item ----------

function railLabel(t: Text, w: World) {
  const n = windowsOf(w).length;
  switch (w.phase) {
    case "stopped":
      return { state: "stopped", shown: t.railState.stopped, said: t.railSaid.stopped };
    case "working":
      return { state: "agent", shown: `${t.railState.agent} · ${t.railState.windows(n)}`, said: t.railSaid.agent(n) };
    case "ask":
      return { state: "ask", shown: t.railState.ask, said: t.railSaid.ask(t.convs.a) };
    case "control":
      return { state: "control", shown: t.railState.control, said: t.railSaid.control };
    default:
      return { state: "idle", shown: t.railState.windows(n), said: t.railSaid.idle(n) };
  }
}

/** A plain row with the same shape as Tuotokset: icon, name, a short state at its end. */
function BrowserItem({ w, onOpen }: { w: World; onOpen: () => void }) {
  const t = useT();
  const l = railLabel(t, w);
  return (
    <div className="ah-rail-home-row">
      <button
        type="button"
        className={`${controls.link} ${controls.home} ah-rail-home bp-item`}
        data-testid="rail-browser"
        data-state={l.state}
        aria-label={l.said}
        onClick={onOpen}
      >
        <BrowserIcon />
        <span className="ah-rail-home-label">{t.ownBrowser}</span>
        <span className="bp-item-state" data-testid="rail-browser-state" aria-hidden="true">
          {l.state === "agent" ? <Icon name="agent" /> : l.state === "control" ? <Icon name="user" /> : null}
          {l.shown}
        </span>
      </button>
    </div>
  );
}

// ---------- Place 2: the conversation's own row ----------

/** Appends the browser mark into the production row of conversation A. */
function RowMark({ w }: { w: World }) {
  const t = useT();
  const [host, setHost] = useState<HTMLElement | null>(null);
  // The row is re-created when it moves between sections and when the
  // phone drawer mounts the rail, so follow the DOM rather than renders.
  useLayoutEffect(() => {
    let slot: HTMLElement | null = null;
    const attach = () => {
      const link = document.querySelector<HTMLElement>('[data-testid="agent-item-pi:a"] a.ah-nav-link');
      if (slot && link && slot.parentElement === link) return;
      slot?.remove();
      slot = null;
      if (link) {
        slot = document.createElement("span");
        slot.className = "bp-rowmark-slot";
        link.append(slot);
      }
      setHost(slot);
    };
    attach();
    const o = new MutationObserver(attach);
    o.observe(document.getElementById("root")!, { childList: true, subtree: true });
    return () => {
      o.disconnect();
      slot?.remove();
    };
  }, []);
  const state = w.phase === "working" ? "working" : w.phase === "ask" ? "ask" : w.phase === "control" ? "control" : undefined;
  if (!host || !state) return null;
  return createPortal(
    <span className="bp-rowmark" data-testid="row-browser" data-state={state} aria-hidden="true">
      {state === "control" ? <Icon name="user" /> : <BrowserIcon />}
      {state === "ask" ? t.rowWord.ask : state === "control" ? t.rowWord.control : null}
    </span>,
    host,
  );
}

// ---------- Place 3: inside the conversation ----------

function Sites({ v }: { v: Visit }) {
  return (
    <span className="bp-sites">
      {origins(v).map(([o]) => (
        <code key={o}>{o}</code>
      ))}
    </span>
  );
}

function counts(t: Text, v: Visit, live: boolean) {
  const parts = [t.pages(v.pages.length)];
  if (v.downloads.length) parts.push(t.downloads(v.downloads.length));
  if (!live) parts.push(t.actionsShort(v.actions.length));
  return `${parts.join(" · ")}${live ? ` ${t.soFar}` : ""}`;
}

/** The opened record: the accepted visit-record list, plus the span the
 * person controlled the browser. */
function Detail({ v, live }: { v: Visit; live: boolean }) {
  const t = useT();
  return (
    <div className="bp-detail" data-testid="visit-detail">
      <p className="bp-tabstate">
        {live ? <Icon name="agent" /> : <Icon name="check" />}
        {live ? t.inWindow(t.windows.laskut) : t.tabClosed}
      </p>
      <section>
        <h4>
          <BrowserIcon />
          {t.sectionPages} <span className="bp-n">{v.pages.length}</span>
        </h4>
        {origins(v).map(([o, n]) => (
          <div key={o} className="bp-origin">
            <p className="bp-origin-head">
              <code>{o}</code> <span className="bp-n">{t.pages(n)}</span>
            </p>
            <ol className="bp-pages">
              {v.pages
                .filter((p) => p.origin === o)
                .map((p, i) => (
                  <li key={i}>
                    <time>{p.at}</time>
                    <span className="bp-page-title">{p.title}</span>
                    <code className="bp-path">{p.path}</code>
                  </li>
                ))}
            </ol>
          </div>
        ))}
      </section>
      {v.downloads.length ? (
        <section>
          <h4>
            <Icon name="download" />
            {t.sectionDownloads} <span className="bp-n">{v.downloads.length}</span>
          </h4>
          <p className="bp-saved">{t.savedTo(DIR)}</p>
          <ul className="bp-files">
            {v.downloads.map((d) => (
              <li key={d}>
                <Icon name="file" />
                <code>{d}</code>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {v.actions.length ? (
        <section>
          <h4>
            <Icon name="pencil" />
            {t.sectionActions} <span className="bp-n">{v.actions.length}</span>
          </h4>
          <ol className="bp-pages">
            {v.actions.map((a, i) => (
              <li key={i}>
                <time>{a.at}</time>
                <span className="bp-page-title">{t.actionClick}</span>
                <code className="bp-path">{a.sel}</code>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {!live ? (
        <section>
          <h4>
            <Icon name="user" />
            {t.sectionYou}
          </h4>
          <p className="bp-saved" data-testid="visit-you">
            {t.youSpan}
          </p>
        </section>
      ) : null}
      <p className="bp-coverage">{t.coverage}</p>
    </div>
  );
}

/** The accepted record card (visit-record 2 Kortti), with the window icon. */
function RecordCard({ v }: { v: Visit }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <section className="ah-turn-changes bp-card" data-testid="browser-piece" data-state="done" data-form="card" data-open={open || undefined} aria-label={t.recordTitle}>
      <div className="ah-tc-head">
        <button type="button" className="ah-tc-toggle" data-testid="piece-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span aria-hidden="true" className="ah-disclosure-chevron" />
          <BrowserIcon />
          <span className="ah-tc-line">
            <span className="ah-tc-title">{t.recordTitle}</span>
            <span className="ah-tc-meta bp-meta">
              <Sites v={v} />
              <span>{counts(t, v, false)}</span>
              <span className="bp-when">
                {v.start}–{v.end}
              </span>
            </span>
          </span>
        </button>
      </div>
      {open ? (
        <div className="ah-tc-body bp-card-body">
          <Detail v={v} live={false} />
        </div>
      ) : null}
    </section>
  );
}

type LiveState = "working" | "ask" | "control";
const liveOf = (w: World): LiveState | undefined =>
  w.phase === "working" ? "working" : w.phase === "ask" ? "ask" : w.phase === "control" ? "control" : undefined;

/** The buttons of a live piece; the same in every form. */
function LiveActions({ s, act, compact }: { s: LiveState; act: Act; compact?: boolean }) {
  const t = useT();
  if (s === "working")
    return (
      <button type="button" className="bp-act" data-testid="piece-look" onClick={() => act.look("laskut")}>
        <Icon name="eye" />
        <span>{t.look}</span>
      </button>
    );
  if (s === "ask")
    return (
      <>
        <button type="button" className="bp-act bp-act-primary" data-testid="piece-take" onClick={act.take}>
          <Icon name="user" />
          <span>{compact ? t.takeShort : t.take}</span>
        </button>
        <button type="button" className="bp-act" data-testid="piece-look" onClick={() => act.look("kirjaudu")}>
          <Icon name="eye" />
          <span>{t.lookFirst}</span>
        </button>
      </>
    );
  return (
    <>
      <button type="button" className="bp-act" data-testid="piece-open" onClick={() => act.look("kirjaudu")}>
        <span>{t.open}</span>
      </button>
      <button type="button" className="bp-act bp-act-primary" data-testid="piece-give-back" onClick={act.giveBack}>
        <Icon name="agent" />
        <span>{t.giveBack}</span>
      </button>
    </>
  );
}

const liveTitle = (t: Text, s: LiveState) => (s === "working" ? t.live : s === "ask" ? t.askTitle : t.controlTitle);
const liveMeta = (t: Text, s: LiveState, v: Visit) =>
  s === "working" ? counts(t, v, true) : s === "ask" ? t.request : t.controlMeta;

/** 1 Rivi: one line, the request and its button on it. */
function LiveLine({ s, v, act }: { s: LiveState; v: Visit; act: Act }) {
  const t = useT();
  return (
    <p className="bp-line" role="note" data-testid="browser-piece" data-state={s} data-form="line">
      <span className="bp-line-mark" aria-hidden="true">
        {s === "control" ? <Icon name="user" /> : <BrowserIcon />}
      </span>
      <span className="bp-line-text">
        <strong>{liveTitle(t, s)}</strong>
        {s === "ask" ? ": " : " · "}
        {s === "working" ? (
          <>
            <code>{origins(v)[0]?.[0]}</code> · {counts(t, v, true)}
          </>
        ) : s === "ask" ? (
          t.request
        ) : (
          t.controlMeta
        )}
      </span>
      <span className="bp-line-actions">
        <LiveActions s={s} act={act} compact />
      </span>
    </p>
  );
}

/** 2 Kortti: the record card itself, live. Expanding shows the list so far. */
function LiveCard({ s, v, act, picture: pic }: { s: LiveState; v: Visit; act: Act; picture?: { src: string; key: WinKey } }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <section
      className="ah-turn-changes bp-card bp-live"
      data-testid="browser-piece"
      data-state={s}
      data-form={pic ? "window" : "card"}
      data-open={open || undefined}
      aria-label={liveTitle(t, s)}
    >
      <div className="ah-tc-head bp-live-head">
        {pic ? (
          <button
            type="button"
            className="bp-thumb"
            data-testid="piece-thumb"
            data-control={s === "control" ? "person" : s === "ask" ? "ask" : "agent"}
            aria-label={`${t.look}: ${t.windows[pic.key]}`}
            onClick={() => act.look(pic.key)}
          >
            <img src={pic.src} alt="" draggable={false} />
            {s === "working" ? <span className="bp-thumb-ptr" aria-hidden="true" /> : null}
          </button>
        ) : null}
        <button type="button" className="ah-tc-toggle" data-testid="piece-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span aria-hidden="true" className="ah-disclosure-chevron" />
          {s === "control" ? <Icon name="user" /> : <BrowserIcon />}
          <span className="ah-tc-line">
            <span className="ah-tc-title">{s === "working" && !pic ? t.liveCard : liveTitle(t, s)}</span>
            <span className="ah-tc-meta bp-meta">
              {pic && s === "working" ? <span className="bp-wintitle">{t.windows[pic.key]}</span> : null}
              <span className="bp-says">{liveMeta(t, s, v)}</span>
              {s === "working" && !pic ? <Sites v={v} /> : null}
              {s === "working" ? <span className="bp-when">{v.start}–</span> : null}
            </span>
          </span>
        </button>
        <span className="bp-live-actions">
          <LiveActions s={s} act={act} />
        </span>
      </div>
      {open ? (
        <div className="ah-tc-body bp-card-body">
          <Detail v={v} live />
        </div>
      ) : null}
    </section>
  );
}

function Piece({ d, w, act }: { d: number; w: World; act: Act }) {
  const t = useT();
  const v = visitOf(t, w);
  const s = liveOf(w);
  if (!s) return null;
  if (d === 0) return <LiveLine s={s} v={v} act={act} />;
  if (d === 1) return <LiveCard s={s} v={v} act={act} />;
  const k = focusOf(w);
  return <LiveCard s={s} v={v} act={act} picture={{ src: picture(t, k), key: k }} />;
}

// ---------- The conversations ----------

const GOTO = `${CLI} goto https://energia.example/laskut --json`;
const TEXTCMD = `${CLI} text --tab 7F2A --json`;
const REQ = `${CLI} request --window 9C41 --text-file pyynto.txt --json`;
const AGAIN = `${CLI} links --tab 7F2A --json`;
const DL = `${CLI} download --tab 7F2A --all 'a.pdf' --to ${DIR} --json`;

const CSV = ["kuukausi,summa", ...MONTHS.map((m, i) => `2026-${m},${(52 + i * 1.7).toFixed(2)}`)].join("\n");
const CHANGES: FileChange[] = [
  {
    path: "kulut/sahkolaskut-2026.csv",
    inWorkspace: true,
    change: "written",
    events: [{ callId: "w1", tool: "write", content: CSV }],
    after: CSV,
    counts: { add: CSV.split("\n").length, del: 0 },
  },
];

function toolStep(cmd: string, i: number, running: boolean): TurnStep {
  return {
    kind: "tool",
    key: `b${i}`,
    node: (
      <div className="ah-ordered-blocks">
        <PiToolUse name="bash" state={running ? "running" : "succeeded"} targetText={cmd}>
          <BashToolCard command={cmd} output={'{"ok": true}'} running={running} />
        </PiToolUse>
      </div>
    ),
  };
}

function Thread({ d, w, conv, act }: { d: number; w: World; conv: Conv; act: Act }) {
  const t = useT();
  const items: { id: string; kind?: string; content: ReactNode }[] = [];
  const you = (id: string, text: string, at: string) =>
    items.push({
      id,
      kind: "user",
      content: (
        <UserMessage sourceText={text} onCopy={noop} time={at}>
          <Markdown text={text} />
        </UserMessage>
      ),
    });
  const agent = (id: string, text: string, at: string) =>
    items.push({
      id,
      kind: "assistant",
      content: (
        <AssistantMessage streamState="complete" time={at} onCopy={noop}>
          <Markdown text={text} />
        </AssistantMessage>
      ),
    });
  if (conv === "b") {
    you("b1", t.b.ask, "8.40");
    agent("b2", t.b.reply, "8.42");
  } else {
    you("a0", t.a.earlierAsk, "8.55");
    agent("a0r", t.a.earlierReply, "8.56");
    if (w.phase !== "idle" && w.phase !== "stopped") {
      you("a1", t.a.ask, "9.12");
      const first = w.phase === "working" && !w.resumed;
      const cmds1 = first ? [GOTO, TEXTCMD] : [GOTO, TEXTCMD, REQ];
      const steps1 = cmds1.map((c, i) => toolStep(c, i, first && i === cmds1.length - 1));
      if (!first) steps1.push({ kind: "text", key: "ask", text: t.a.toLogin, node: <Markdown text={t.a.toLogin} /> });
      const piece = <Piece d={d} w={w} act={act} />;
      items.push({
        id: "turn1",
        kind: "assistant",
        content: (
          <div className="bp-turn">
            <AgentTurn steps={steps1} working={first} activity={first ? t.activity : undefined} duration={first ? "0:42" : undefined} />
            {!w.resumed ? piece : null}
          </div>
        ),
      });
      if (w.resumed) {
        items.push({
          id: "back",
          content: (
            <p className="ah-mp-line" role="note">
              <span className="ah-mp-line-mark" aria-hidden="true" />
              {t.a.gaveBack}
            </p>
          ),
        });
        const done = w.phase === "done";
        const steps2 = [toolStep(AGAIN, 10, !done), ...(done ? [toolStep(DL, 11, false)] : [])];
        if (done) steps2.push({ kind: "text", key: "fin", text: t.a.finished, node: <Markdown text={t.a.finished} /> });
        items.push({
          id: "turn2",
          kind: "assistant",
          content: (
            <div className="bp-turn">
              <AgentTurn
                steps={steps2}
                working={!done}
                activity={done ? undefined : t.activity}
                duration={done ? undefined : "1:05"}
                changes={
                  done ? (
                    <>
                      <TurnChanges files={CHANGES} />
                      <RecordCard v={visitOf(t, w)} />
                    </>
                  ) : undefined
                }
              />
              {!done ? piece : null}
            </div>
          ),
        });
      }
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

// ---------- The sheet (control round, direction 1 Kehys) ----------

function Sheet({ w, focus, act, onClose }: { w: World; focus?: WinKey; act: Act; onClose: () => void }) {
  const t = useT();
  const wins = windowsOf(w);
  const active = wins.find((x) => x.key === focus) ?? wins.find((x) => x.key === "kirjaudu") ?? wins.find((x) => x.agent) ?? wins[0];
  const control = w.phase === "control" ? "person" : "agent";
  const turn = w.phase === "control" ? t.sheetTurn.control : w.phase === "ask" ? t.sheetTurn.ask : w.phase === "working" ? t.sheetTurn.agent : t.sheetTurn.idle;
  return (
    <ModalOverlay className="ah-overlay sb-sheet-overlay" isDismissable isOpen onOpenChange={(o) => !o && onClose()}>
      <Modal className="ah-modal sb-sheet">
        <AriaDialog className="sb-sheet-dialog" data-testid="browser-sheet" data-control={control} aria-label={t.ownBrowser}>
          <div className="sb-sheet-head">
            <Heading slot="title">{t.ownBrowser}</Heading>
            <ControlButton size="row" variant="quiet" onPress={noop}>
              {t.stop}
            </ControlButton>
            <ControlButton size="row" presentation="icon" variant="quiet" aria-label={t.close} data-testid="sheet-close" onPress={onClose}>
              <Icon name="cross" />
            </ControlButton>
          </div>
          <div className="bp-frame-wrap">
            <div className="bp-frame" data-control={control} data-testid="sheet-frame">
              <div className="bp-frame-tab">
                {control === "person" || w.phase === "ask" ? <Icon name="user" /> : <Icon name="agent" />}
                <strong data-testid="sheet-turn">{turn}</strong>
                {w.phase === "ask" ? <span className="bp-frame-says">{t.request}</span> : null}
                {control === "person" ? (
                  <ControlButton size="row" variant="primary" data-testid="sheet-done" onPress={act.giveBack}>
                    {t.doneControl}
                  </ControlButton>
                ) : (
                  <ControlButton size="row" data-testid="sheet-take" onPress={act.take}>
                    {t.takeControl}
                  </ControlButton>
                )}
              </div>
              {active ? (
                <div className="bp-screen" data-window={active.key} data-testid="sheet-screen">
                  <div className="bp-tabs" aria-hidden="true">
                    {wins.map((x) => (
                      <span key={x.key} className="bp-tab" data-active={x.key === active.key || undefined}>
                        {x.agent ? <Icon name="agent" /> : null}
                        {t.windows[x.key]}
                      </span>
                    ))}
                  </div>
                  <div className="bp-address" aria-hidden="true">
                    {WIN[active.key].origin}
                  </div>
                  <img src={picture(t, active.key)} alt="" />
                </div>
              ) : null}
            </div>
          </div>
          <p className="sb-truth">{t.truth}</p>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

// ---------- The page ----------

function Main({ d, w, setW, railOpen }: { d: number; w: World; setW: (f: (x: World) => World) => void; railOpen: number }) {
  const t = useT();
  const navigate = useNavigate();
  const { search } = useLocation();
  const conv: Conv = new URLSearchParams(search).get("conversation") === "b" ? "b" : "a";
  const [draft, setDraft] = useState("");
  const [sheet, setSheet] = useState<{ focus?: WinKey }>();
  const act: Act = {
    look: (focus) => setSheet({ focus }),
    take: () => {
      setW((x) => ({ ...x, phase: "control" }));
      setSheet({ focus: "kirjaudu" });
    },
    // Giving back after the request: the agent carries on in one window.
    giveBack: () => setW((x) => (x.phase === "control" ? { ...x, phase: "working", resumed: true } : x)),
    openBrowser: () => {
      setW((x) => (x.phase === "stopped" ? { ...x, phase: "idle" } : x));
      setSheet({});
    },
  };
  // The review bar's Sivupalkki button opens the phone drawer.
  useLayoutEffect(() => {
    if (railOpen) document.querySelector<HTMLElement>(".ah-navigation-open")?.click();
  }, [railOpen]);
  const ask = w.phase === "ask" || w.phase === "control";
  const working = w.phase === "working";
  const done = w.phase === "done";
  const rowA: AgentNavModel = {
    agentId: "pi:a",
    title: t.convs.a,
    href: `/workspaces/${t.workspace}?conversation=a`,
    activity: working ? "working" : "waiting",
    activityLabel: working ? t.working : ask ? t.waits : t.done,
    attentionLabel: ask ? t.waits : undefined,
    detail: working ? t.rowSaid.working : w.phase === "ask" ? t.rowSaid.ask : w.phase === "control" ? t.rowSaid.control : done ? t.rowSaid.done : t.rowSaid.idle,
    turnMark: done ? "read" : undefined,
    controlLabel: "",
    workspaceId: "ws_kotitalous00",
    workspaceName: t.workspace,
    changedAt: Date.now() - 60_000,
    selected: conv === "a",
  };
  const rowB: AgentNavModel = {
    agentId: "pi:b",
    title: t.convs.b,
    href: `/workspaces/${t.otherWorkspace}?conversation=b`,
    activity: "waiting",
    activityLabel: t.done,
    detail: t.unread,
    controlLabel: "",
    workspaceId: "ws_yhdistys000",
    workspaceName: t.otherWorkspace,
    changedAt: Date.now() - 32 * 60_000,
    turnMark: "read",
    selected: conv === "b",
  };
  const pages = (
    <>
      <div className="ah-rail-home-row">
        <LinkRow href="/shares" data-testid="rail-shares" kind="home" className="ah-rail-home">
          <Icon name="globe" />
          <span className="ah-rail-home-label">{t.outputs}</span>
        </LinkRow>
      </div>
      <BrowserItem w={w} onOpen={act.openBrowser} />
      <div className="ah-rail-home-row">
        <LinkRow href="/resources" data-testid="rail-resources" kind="home" className="ah-rail-home ar-rail-link">
          <Icon name="shield" />
          <span className="ah-rail-home-label">{t.resources}</span>
        </LinkRow>
      </div>
    </>
  );
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
      pages={pages}
      now={<NowSections yours={working ? [rowB] : [rowA, rowB]} running={working ? [rowA] : []} />}
      sessionActions={<AccountShelf profile={{ name: "Aino Laine", email: "", avatar_url: "" }} onSettings={noop} onLogout={noop} />}
    >
      <WorkspaceNavRow name={t.workspace} href={`/workspaces/${t.workspace}`} selected={conv === "a"} />
      <WorkspaceNavRow name={t.otherWorkspace} href={`/workspaces/${t.otherWorkspace}`} selected={conv === "b"} />
    </WorkspaceRail>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell
        mobileTitle={t.convs[conv]}
        navigationBadge={w.phase === "ask" ? 1 : 0}
        rail={rail}
        main={
          <div className="bp-main" id="main" data-testid="conversation" data-conv={conv}>
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
                <Thread key={`${conv}-${w.phase}-${w.resumed}`} d={d} w={w} conv={conv} act={act} />
              </ConversationStream>
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
      <RowMark w={w} />
      {sheet && w.phase !== "stopped" ? <Sheet w={w} focus={sheet.focus} act={act} onClose={() => setSheet(undefined)} /> : null}
    </StatusBellProvider>
  );
}

/** The stepper's order: give back resumes the agent before it is done. */
function nextWorld(w: World): World {
  if (w.phase === "stopped") return { ...w, phase: "idle", resumed: false };
  if (w.phase === "idle") return { ...w, phase: "working", resumed: false };
  if (w.phase === "working") return w.resumed ? { ...w, phase: "done" } : { ...w, phase: "ask" };
  if (w.phase === "ask") return { ...w, phase: "control" };
  if (w.phase === "control") return { ...w, phase: "working", resumed: true };
  return { ...w, phase: "idle", resumed: false };
}
const worldAt = (p: Phase, many: boolean): World => ({ phase: p, resumed: p === "done", many });

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(reviewLanguage);
  const t = TEXT[language];
  const [w, setW] = useState<World>(() => worldAt(firstPhase, params.get("many") === "1"));
  const [run, setRun] = useState(0);
  const [railOpen, setRailOpen] = useState(0);
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
  // Keep the end of the conversation in view, where the browser piece is.
  useLayoutEffect(() => {
    const end = () => [...document.querySelectorAll("[data-item]")].at(-1)?.scrollIntoView({ block: "end" });
    requestAnimationFrame(() => requestAnimationFrame(end));
  }, [run, language, conv, w.phase, w.resumed]);
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
              {t.conversation}{" "}
              <select id="conv" value={conv} onChange={(e) => restart(w, e.target.value as Conv)}>
                <option value="a">{t.convs.a}</option>
                <option value="b">{t.convs.b}</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                id="many"
                checked={w.many}
                onChange={(e) => setW((x) => ({ ...x, many: e.target.checked }))}
              />{" "}
              {t.many}
            </label>
            <button type="button" className="ra-event ra-phone-only" data-testid="show-rail" onClick={() => setRailOpen((n) => n + 1)}>
              {t.showRail}
            </button>
            <button type="button" className="ra-event" data-testid="event-reset" onClick={() => restart(worldAt("ask", false), "a")}>
              {t.reset}
            </button>
          </div>
          <div className="ra-stepper" role="group" aria-label={t.state} data-testid="stepper">
            {PHASES.map((p) => (
              <button
                key={p}
                type="button"
                className="ra-event ra-step"
                data-phase={p}
                aria-pressed={w.phase === p}
                onClick={() => restart(worldAt(p, w.many))}
              >
                {t.phases[p]}
              </button>
            ))}
            <button type="button" className="ra-event ra-next" data-testid="step-next" onClick={() => setW(nextWorld)}>
              {t.next} →
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
            <Main key={`${direction}-${language}-${run}`} d={direction} w={w} setW={setW} railOpen={railOpen} />
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
