import React, {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import { AccountShelf } from "../../../../web/src/components/Account";
import {
  AssistantMessage,
  ConversationTimeline,
  UserMessage,
} from "../../../../web/src/components/Conversation";
import {
  ConversationFrame,
  ConversationStream,
} from "../../../../web/src/components/ConversationFrame";
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
import { QuietSection } from "../../../../web/src/components/QuietSection";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { Composer } from "../../../../web/src/components/composer/Composer";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { navigationText } from "../../../../web/src/text/navigation";
import { statusText } from "../../../../web/src/text/status";
import "../../../../web/src/components/components.css";
import { type ConvId, type Keys, keysFor, TEXT, type Text } from "./text";
import "./round.css";

// proto-rail-keyboard-navigation, round 3. Jari 15.11.2026 chose round 2's
// narrow list (no preview pane), but its results were confusing:
// conversations at the top and message hits as separate lists below. One
// view: the production rail and open conversation with the narrow ⌘K list
// over it. The axis is what one row of the list is, and where the rest of
// the hits go: a conversation with its best sentence inside (more hits
// expand under it), one matching message per row, or conversations first
// and their hits as a second stage. Key, search and the jump to the message
// stay as in round 2 (its NOTES.md); the matching below is round 2's.
setPersonalLanguage("fi");

// No-break spaces: at 390 the centred picker has half the width to shrink into.
const directions = ["1 Keskustelut", "2 Viestit", "3 Kaksi vaihetta"];
const params = new URLSearchParams(location.search);

// ---------- The synthetic world ----------

type Who = "me" | "agent" | "tool";
type Ws = "retkiopas" | "kotisivu" | "kirjanpito";
type Conv = {
  id: ConvId;
  ws: Ws;
  state: "reply" | "question" | "working" | "idle";
  /** Minutes since the last change. */
  age: number;
  archived?: boolean;
  who: Who[];
  /** Days ago, per message. */
  days: number[];
};
const WORLD: Conv[] = [
  { id: "notice", ws: "kotisivu", state: "reply", age: 12, who: ["me", "agent"], days: [0, 0] },
  { id: "a11y", ws: "kotisivu", state: "question", age: 25, who: ["me", "agent", "agent"], days: [1, 1, 0] },
  { id: "tiles", ws: "retkiopas", state: "working", age: 1, who: ["me", "agent", "tool", "me", "agent", "me", "agent"], days: [2, 2, 2, 1, 1, 0, 0] },
  { id: "elevation", ws: "retkiopas", state: "working", age: 3, who: ["me", "agent", "me", "agent"], days: [1, 1, 0, 0] },
  { id: "backups", ws: "kirjanpito", state: "working", age: 6, who: ["me", "agent"], days: [0, 0] },
  { id: "colors", ws: "retkiopas", state: "idle", age: 60 * 50, who: ["me", "agent"], days: [2, 2] },
  { id: "glossary", ws: "kirjanpito", state: "idle", age: 60 * 74, who: ["me", "agent"], days: [3, 3] },
  { id: "receipts", ws: "kirjanpito", state: "idle", age: 60 * 122, who: ["me", "agent"], days: [5, 5] },
  { id: "provider", ws: "retkiopas", state: "idle", age: 60 * 24 * 39, archived: true, who: ["me", "agent", "me"], days: [40, 40, 39] },
];
const WORKSPACES: Ws[] = ["kirjanpito", "kotisivu", "retkiopas"];
/** Opened by this person, newest first (kept in the browser, as round 1's
 * previous conversation is). */
const RECENT: ConvId[] = ["notice", "a11y", "elevation", "backups", "glossary", "colors", "receipts"];
const START: ConvId = "tiles";
const NOW0 = Date.now();
const byId = (id: string | null | undefined) => WORLD.find((c) => c.id === id);
const markOf = (c: Conv): MarkState =>
  c.state === "reply" || c.state === "question"
    ? "waiting"
    : c.state === "working"
      ? "working"
      : "done";

// ---------- Matching, as the host's index would (round 2) ----------

const norm = (s: string) => s.toLocaleLowerCase();
/** Query words, each cut to a stem: words of five letters or more lose one
 * common case ending, their final vowels and a doubled consonant (kartta,
 * kartan, kartalle → kart, which also finds tilikartta). A stand-in for the
 * index's Finnish analysis. */
export const stemsOf = (q: string) =>
  norm(q)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2)
    .map((w) =>
      w.length >= 5
        ? w
            .replace(/(ssa|ssä|sta|stä|lla|llä|lta|ltä|lle|ksi|na|nä|n|t)$/u, "")
            .replace(/[aeiouyäö]+$/u, "")
            .replace(/(\p{L})\1$/u, "$1")
        : w,
    );
const has = (s: string, stems: string[]) =>
  stems.length > 0 && stems.every((x) => norm(s).includes(x));
/** A stem at the start of a word ranks above one inside a compound. */
const atWordStart = (s: string, stems: string[]) =>
  stems.some((x) => new RegExp(`(^|[^\\p{L}])${x}`, "u").test(norm(s)));
const plain = (s: string) => s.replace(/```/g, "").trim();

type Hit = { c: Conv; i: number; who: Who; days: number; text: string };
/** One conversation's share of a result: whether its name matched, its
 * message hits newest first, and the one hit that best stands for it. */
type Group = { c: Conv; title: boolean; hits: Hit[]; best?: Hit };

function search(t: Text, q: string) {
  const stems = stemsOf(q);
  const hits: Hit[] = [];
  for (const c of WORLD)
    c.who.forEach((who, i) => {
      // Tool output is not searched by default (round 2's decision).
      if (who === "tool") return;
      const text = t.conv[c.id].msgs[i];
      if (has(text, stems)) hits.push({ c, i, who, days: c.days[i], text });
    });
  hits.sort((a, b) => a.days - b.days || WORLD.indexOf(a.c) - WORLD.indexOf(b.c) || b.i - a.i);
  const groups: Group[] = [];
  for (const c of WORLD) {
    const title = has(t.conv[c.id].title, stems) || has(c.ws, stems);
    const own = hits.filter((h) => h.c === c);
    if (!title && !own.length) continue;
    const best = [...own].sort((a, b) => Number(atWordStart(b.text, stems)) - Number(atWordStart(a.text, stems)))[0];
    groups.push({ c, title, hits: own, best });
  }
  // A name match first, archived last within each, then the newest hit, then the most hits.
  const newest = (g: Group) => g.hits[0]?.days ?? 999;
  groups.sort(
    (a, b) =>
      Number(b.title) - Number(a.title) ||
      Number(!!a.c.archived) - Number(!!b.c.archived) ||
      newest(a) - newest(b) ||
      b.hits.length - a.hits.length ||
      WORLD.indexOf(a.c) - WORLD.indexOf(b.c),
  );
  return { stems, hits, groups };
}

/** The text with every word containing a stem marked. */
function Marked({ text, stems }: { text: string; stems: string[] }) {
  const parts = text.split(/(\p{L}[\p{L}\p{N}'’-]*)/u);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 && stems.some((x) => norm(p).includes(x)) ? (
          <mark key={i}>{p}</mark>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}
/** The sentence that matched, cut to fit around the match: a row says why
 * it is there in one line, not with the whole message. */
function sentence(text: string, stems: string[], room = 130) {
  const s = plain(text).replace(/\s+/g, " ");
  const parts = s.split(/(?<=[.!?…])\s+/u);
  const one = parts.find((p) => stems.some((x) => norm(p).includes(x))) ?? parts.at(-1) ?? s;
  if (one.length <= room) return one;
  const found = stems.map((x) => norm(one).indexOf(x)).filter((n) => n >= 0);
  const at = found.length ? Math.min(...found) : 0;
  let from = Math.max(0, one.lastIndexOf(" ", Math.max(0, at - room / 3)));
  if (at - from > room / 2) from = at;
  const end = one.indexOf(" ", from + room);
  return `${from > 0 ? "…" : ""}${one.slice(from, end < 0 ? undefined : end).trim()}${end < 0 ? "" : "…"}`;
}
const lastOf = (c: Conv) => c.who.length - 1;

// ---------- The rail: production pieces ----------

type Words = ReturnType<typeof useText<typeof statusText>>["rail"];
function model(c: Conv, open: string, t: Text, s: Words): AgentNavModel {
  const label =
    c.state === "working" ? s.working : c.state === "reply" ? s.newReply : c.state === "question" ? s.asks : "";
  return {
    agentId: c.id,
    href: `/workspaces/${c.ws}?conversation=${c.id}`,
    title: t.conv[c.id].title,
    workspaceId: c.ws,
    workspaceName: c.ws,
    changedAt: NOW0 - c.age * 60000,
    activity: c.state === "working" ? "working" : "waiting",
    activityLabel: label,
    attentionLabel: c.state === "reply" ? s.newReply : undefined,
    question: c.state === "question",
    controlLabel: "",
    detail: [c.ws, label].filter(Boolean).join(" · "),
    selected: c.id === open,
  };
}

function Sections({ open, t, entry }: { open: string; t: Text; entry: ReactNode }) {
  const n = useText(navigationText);
  const s = useText(statusText).rail;
  const yoursId = useId();
  const runningId = useId();
  const rows = WORLD.filter((c) => !c.archived).map((c) => ({ c, m: model(c, open, t, s) }));
  const yours = rows.filter((r) => r.c.state === "reply" || r.c.state === "question");
  const running = rows.filter((r) => r.c.state === "working");
  const quiet = rows.filter((r) => r.c.state === "idle");
  return (
    <>
      {entry}
      <section className="ah-now" data-testid="rail-yours" aria-labelledby={yoursId}>
        <h2 className="ah-rail-section-head" id={yoursId}>
          {n.yourTurn}
          <span className="ah-rail-count ah-rail-count-attention">{yours.length}</span>
        </h2>
        <ul>
          {yours.map((r) => (
            <AgentNavItem key={r.c.id} {...r.m} now={NOW0} />
          ))}
        </ul>
      </section>
      <section className="ah-now" data-testid="rail-running" aria-labelledby={runningId}>
        <h2 className="ah-rail-section-head" id={runningId}>
          {n.running}
          <span className="ah-rail-count">{running.length}</span>
        </h2>
        <ul>
          {running.map((r) => (
            <AgentNavItem key={r.c.id} {...r.m} now={NOW0} />
          ))}
        </ul>
      </section>
      <QuietSection
        rows={quiet.map((r) => r.m)}
        workspaces={WORKSPACES.map((w) => ({ id: w, name: w }))}
        choice={{ sort: "newest", workspace: null }}
      />
    </>
  );
}

/** The rail's own door to search: the touch entry, and the place a mouse
 * user learns the key. */
function SearchEntry({ t, k, onOpen }: { t: Text; k: Keys; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="sw-entry"
      data-testid="search-entry"
      aria-keyshortcuts="Meta+K Control+K /"
      onClick={onOpen}
    >
      <Icon name="search" />
      <span>{t.entry}</span>
      <kbd>{k.mod("K")}</kbd>
    </button>
  );
}

// ---------- The switcher ----------

type Row =
  | { kind: "conv"; c: Conv; g?: Group; previous?: boolean; open?: boolean }
  | { kind: "hit"; h: Hit; sub?: boolean; ctx?: boolean }
  | { kind: "continue"; q: string };
type Item = Row | { kind: "head"; label: string } | { kind: "crumb"; g: Group };
const selectable = (r: Item): r is Row => r.kind === "conv" || r.kind === "hit" || r.kind === "continue";
const rowKey = (r: Row) =>
  r.kind === "conv" ? `c-${r.c.id}` : r.kind === "hit" ? `h-${r.h.c.id}-${r.h.i}` : r.kind;

let lastQuery = "";
type Example = "empty" | "many" | "title" | "none";
const review = {
  theme: (params.get("theme") as "light" | "dark" | "contrast") || "light",
  lang: (params.get("lang") === "en" ? "en" : "fi") as "fi" | "en",
  mac:
    params.get("kbd") === "mac" ||
    (params.get("kbd") !== "pc" && /Mac|iPhone|iPad/.test(navigator.platform)),
  example: ((["empty", "many", "title", "none"] as const).find((x) => x === params.get("example")) ?? "many") as Example,
};

function Who({ who, t }: { who: Who; t: Text }) {
  return <span className={`sw-who sw-who-${who}`}>{t.who[who]}</span>;
}
function Title({ c, t, stems, marked }: { c: Conv; t: Text; stems: string[]; marked?: boolean }) {
  return (
    <span className="sw-title">
      {marked ? <Marked text={t.conv[c.id].title} stems={stems} /> : t.conv[c.id].title}
    </span>
  );
}
const Archived = ({ c, t }: { c: Conv; t: Text }) => (c.archived ? <span className="sw-tag">{t.archived}</span> : null);

/** One line per conversation: the empty query in 2 and 3, a name match in
 * 2, and 3's first stage. */
function ConvLine({ r, t, stems, d, onDrill }: { r: Extract<Row, { kind: "conv" }>; t: Text; stems: string[]; d: number; onDrill: () => void }) {
  const g = r.g;
  return (
    <>
      <HabitatMark state={markOf(r.c)} size={16} />
      <Title c={r.c} t={t} stems={stems} marked={g?.title} />
      {r.previous ? <span className="sw-prev">{t.previous}</span> : null}
      <Archived c={r.c} t={t} />
      {g && d === 1 ? <span className="sw-tag sw-tag-name">{t.inTitle}</span> : null}
      {g && d === 2 ? (
        g.hits.length ? (
          <button
            type="button"
            className="sw-count"
            data-testid={`drill-${r.c.id}`}
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onDrill();
            }}
          >
            {t.hits(g.hits.length)} <span aria-hidden="true">›</span>
          </button>
        ) : (
          <span className="sw-tag sw-tag-name">{t.inTitle}</span>
        )
      ) : null}
      <span className="sw-ws">{r.c.ws}</span>
    </>
  );
}

/** Direction 1's row: the conversation, and inside it the sentence that
 * stands for it. With no query, or a name-only match, the latest message. */
function ConvCard({ r, t, stems, onMore }: { r: Extract<Row, { kind: "conv" }>; t: Text; stems: string[]; onMore: () => void }) {
  const g = r.g;
  const h = g?.best;
  const i = h ? h.i : lastOf(r.c);
  const text = t.conv[r.c.id].msgs[i];
  const more = g ? g.hits.length - 1 : 0;
  return (
    <>
      <HabitatMark state={markOf(r.c)} size={16} />
      <span className="sw-card-top">
        <Title c={r.c} t={t} stems={stems} marked={g?.title} />
        {r.previous ? <span className="sw-prev">{t.previous}</span> : null}
        <Archived c={r.c} t={t} />
      </span>
      <span className="sw-card-meta">
        <span className="sw-ws">{r.c.ws}</span>
        <span>{t.ago(r.c.days[i])}</span>
      </span>
      <span className={`sw-card-line${h ? "" : " sw-quiet"}`}>
        <Who who={r.c.who[i]} t={t} />
        <span className="sw-card-text">{h ? <Marked text={sentence(text, stems)} stems={stems} /> : sentence(text, [])}</span>
      </span>
      {more > 0 ? (
        <button
          type="button"
          className="sw-count"
          data-testid={`more-${r.c.id}`}
          aria-expanded={!!r.open}
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onMore();
          }}
        >
          {t.more(more)} <span aria-hidden="true">{r.open ? "←" : "→"}</span>
        </button>
      ) : null}
    </>
  );
}

/** A message hit. Direction 2 labels it with its conversation; inside a
 * conversation (1's expanded rows, 3's second stage) it needs no label. */
function HitLine({ r, t, stems, label }: { r: Extract<Row, { kind: "hit" }>; t: Text; stems: string[]; label: boolean }) {
  const { h } = r;
  const msgs = t.conv[h.c.id].msgs;
  return (
    <>
      <Who who={h.who} t={t} />
      <span className="sw-hit-body">
        {r.ctx && h.i > 0 ? (
          <span className="sw-ctx" data-testid="context">
            <strong>{t.who[h.c.who[h.i - 1]]}</strong> {sentence(msgs[h.i - 1], [], 160)}
          </span>
        ) : null}
        <span className={`sw-snippet${r.ctx ? " sw-full" : ""}`}>
          <Marked text={r.ctx ? plain(h.text) : sentence(h.text, stems)} stems={stems} />
        </span>
        {label ? (
          <span className="sw-hit-meta">
            <span className="sw-label">
              <HabitatMark state={markOf(h.c)} size={12} />
              {t.conv[h.c.id].title}
            </span>
            <span className="sw-ws">{h.c.ws}</span>
            <Archived c={h.c} t={t} />
            <span>{t.ago(h.days)}</span>
          </span>
        ) : null}
      </span>
      {label ? null : <span className="sw-ago">{t.ago(h.days)}</span>}
    </>
  );
}

function Switcher({
  d,
  t,
  k,
  open,
  previous,
  initialQuery,
  onOpen,
  onClose,
}: {
  d: number;
  t: Text;
  k: Keys;
  open: string;
  previous?: string;
  initialQuery: string;
  onOpen: (id: string, hit?: number, q?: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [sel, setSel] = useState(0);
  const [expanded, setExpanded] = useState<ConvId[]>([]);
  const [ctx, setCtx] = useState<string[]>([]);
  const [drill, setDrill] = useState<{ id: ConvId; from: number } | null>(null);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const q = query.trim();
  const { stems, hits, groups } = search(t, q);
  const items: Item[] = [];
  if (!q) {
    items.push({ kind: "head", label: t.recent });
    const order = previous && previous !== open ? [previous, ...RECENT.filter((r) => r !== previous)] : RECENT;
    for (const id of order) if (id !== open) items.push({ kind: "conv", c: byId(id)!, previous: id === previous });
    if (lastQuery) items.push({ kind: "continue", q: lastQuery });
  } else if (d === 0) {
    for (const g of groups) {
      const on = expanded.includes(g.c.id);
      items.push({ kind: "conv", c: g.c, g, open: on });
      if (on) for (const h of g.hits) if (h !== g.best) items.push({ kind: "hit", h, sub: true });
    }
  } else if (d === 1) {
    for (const g of groups) if (g.title) items.push({ kind: "conv", c: g.c, g });
    for (const h of hits) items.push({ kind: "hit", h, ctx: ctx.includes(`${h.c.id}-${h.i}`) });
  } else {
    const g = drill && groups.find((x) => x.c.id === drill.id);
    if (g) {
      items.push({ kind: "crumb", g });
      for (const h of g.hits) items.push({ kind: "hit", h, sub: true });
    } else for (const x of groups) items.push({ kind: "conv", c: x.c, g: x });
  }
  const rows = items.filter(selectable);
  const at = Math.min(sel, Math.max(0, rows.length - 1));
  const cur = rows[at];
  const retype = (v: string) => {
    setQuery(v);
    setSel(0);
    setExpanded([]);
    setCtx([]);
    setDrill(null);
  };
  const choose = (r: Row | undefined) => {
    if (!r) return;
    if (r.kind === "continue") return retype(r.q);
    if (q) lastQuery = q;
    if (r.kind === "hit") return onOpen(r.h.c.id, r.h.i, q);
    // A conversation opens where its row points: 1 at the sentence it shows,
    // 3 at its newest hit, a name match (2) at its latest message.
    const h = r.g ? (d === 0 ? r.g.best : d === 2 ? r.g.hits[0] : undefined) : undefined;
    onOpen(r.c.id, h?.i, h ? q : undefined);
  };
  const toggle = (id: ConvId, index: number, on: boolean) => {
    setExpanded((x) => (on ? [...x.filter((y) => y !== id), id] : x.filter((y) => y !== id)));
    setSel(on ? index + 1 : index);
  };
  const drillInto = (id: ConvId, index: number) => {
    setDrill({ id, from: index });
    setSel(0);
  };
  // → and ← belong to the field's caret unless the list has something to
  // open or close: → only at the end of the text, ← only when open.
  const right = (): boolean => {
    const el = inputRef.current;
    if (!el || el.selectionStart !== el.value.length || el.selectionEnd !== el.value.length || !q || !cur) return false;
    if (d === 0 && cur.kind === "conv" && cur.g && cur.g.hits.length > 1) {
      toggle(cur.c.id, at, true);
      return true;
    }
    if (d === 1 && cur.kind === "hit" && cur.h.i > 0 && !cur.ctx) {
      setCtx((x) => [...x, `${cur.h.c.id}-${cur.h.i}`]);
      return true;
    }
    if (d === 2 && !drill && cur.kind === "conv" && cur.g?.hits.length) {
      drillInto(cur.c.id, at);
      return true;
    }
    return false;
  };
  const left = (): boolean => {
    if (!cur) return false;
    if (d === 0 && cur.kind === "hit" && cur.sub) {
      const parent = rows.findIndex((r) => r.kind === "conv" && r.c === cur.h.c);
      toggle(cur.h.c.id, parent, false);
      return true;
    }
    if (d === 0 && cur.kind === "conv" && cur.open) {
      toggle(cur.c.id, at, false);
      return true;
    }
    if (d === 1 && cur.kind === "hit" && cur.ctx) {
      setCtx((x) => x.filter((y) => y !== `${cur.h.c.id}-${cur.h.i}`));
      return true;
    }
    if (d === 2 && drill) {
      setSel(drill.from);
      setDrill(null);
      return true;
    }
    return false;
  };
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  });
  const keys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (rows.length) setSel((at + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(cur);
    } else if (e.key === "ArrowRight" && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
      if (right()) e.preventDefault();
    } else if (e.key === "ArrowLeft" && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
      if (left()) e.preventDefault();
    }
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the backdrop closes on a press, as production's dialogs do.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Esc closes.
    <div className="sw-back" data-testid="switcher" data-direction={d} onClick={onClose}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: only stops the backdrop's press. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.dialog}
        className="sw-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="sw-field">
          <Icon name="search" />
          <input
            ref={inputRef}
            // biome-ignore lint/a11y/noAutofocus: the switcher exists to be typed into.
            autoFocus
            data-testid="switcher-input"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={cur ? `${listId}-${rowKey(cur)}` : undefined}
            placeholder={t.placeholder}
            value={query}
            onChange={(e) => retype(e.target.value)}
            onKeyDown={keys}
          />
          <kbd className="sw-esc">Esc</kbd>
        </div>
        <div className="sw-body">
          <ul role="listbox" id={listId} aria-label={t.dialog} ref={listRef}>
            {items.map((it, n) => {
              if (it.kind === "head")
                return (
                  <li key={`head-${n}`} role="presentation" className="sw-head">
                    {it.label}
                  </li>
                );
              if (it.kind === "crumb")
                return (
                  <li key="crumb" role="presentation" className="sw-crumb" data-testid="crumb">
                    <button
                      type="button"
                      tabIndex={-1}
                      data-testid="crumb-back"
                      onClick={() => {
                        setSel(drill?.from ?? 0);
                        setDrill(null);
                        inputRef.current?.focus();
                      }}
                    >
                      ← {t.back}
                    </button>
                    <HabitatMark state={markOf(it.g.c)} size={14} />
                    <strong>
                      <Marked text={t.conv[it.g.c.id].title} stems={it.g.title ? stems : []} />
                    </strong>
                    <span className="sw-ws">{it.g.c.ws}</span>
                    <span className="sw-crumb-n">{t.hits(it.g.hits.length)}</span>
                  </li>
                );
              const i = rows.indexOf(it);
              const card = d === 0 && it.kind === "conv";
              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: the field's keys choose.
                <li
                  key={rowKey(it)}
                  role="option"
                  id={`${listId}-${rowKey(it)}`}
                  data-testid={`row-${rowKey(it)}`}
                  data-kind={it.kind}
                  data-sub={it.kind === "hit" && it.sub ? "" : undefined}
                  className={card ? "sw-card" : undefined}
                  aria-selected={i === at}
                  aria-expanded={card && it.g && it.g.hits.length > 1 ? !!it.open : undefined}
                  onMouseMove={() => i !== at && setSel(i)}
                  onClick={() => choose(it)}
                >
                  {it.kind === "conv" ? (
                    card ? (
                      <ConvCard r={it} t={t} stems={stems} onMore={() => toggle(it.c.id, i, !it.open)} />
                    ) : (
                      <ConvLine r={it} t={t} stems={stems} d={d} onDrill={() => drillInto(it.c.id, i)} />
                    )
                  ) : it.kind === "hit" ? (
                    <HitLine r={it} t={t} stems={stems} label={d === 1} />
                  ) : (
                    <>
                      <Icon name="search" />
                      <span className="sw-title">{t.continueSearch(it.q)}</span>
                    </>
                  )}
                </li>
              );
            })}
            {q && !rows.length ? (
              <li className="sw-empty" data-testid="empty">
                {t.empty(q)}
              </li>
            ) : null}
          </ul>
        </div>
        <p className="sw-foot">{t.foot(k)[d]}</p>
      </div>
    </div>
  );
}

// ---------- The open conversation: production pieces ----------

const noop = () => {};
const drafts: Partial<Record<ConvId, string>> = {};

/** Marks the query's words inside the production message with the CSS
 * Custom Highlight API, so the message component stays production's. */
function useHighlight(stems: string[], on: boolean) {
  useEffect(() => {
    const registry = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
    const H = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
    if (!registry || !H) return;
    registry.delete("sw-hit");
    if (!on) return;
    const place = () => {
      const target = document.querySelector('[data-testid="jump-target"]');
      if (!target) return;
      target.scrollIntoView({ block: "center" });
      const ranges: Range[] = [];
      const walk = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const s = n.textContent ?? "";
        for (const m of s.matchAll(/\p{L}[\p{L}\p{N}'’-]*/gu)) {
          if (!stems.some((x) => norm(m[0]).includes(x))) continue;
          const r = new Range();
          r.setStart(n, m.index!);
          r.setEnd(n, m.index! + m[0].length);
          ranges.push(r);
        }
      }
      registry.set("sw-hit", new H(...ranges));
    };
    const id = requestAnimationFrame(() => setTimeout(place, 30));
    return () => cancelAnimationFrame(id);
  });
}

function Conversation({ c, t, hit, band }: { c: Conv; t: Text; hit?: number; band: ReactNode }) {
  const s = useText(statusText);
  const [, redraw] = useState(0);
  const working = c.state === "working";
  const msgs = t.conv[c.id].msgs;
  return (
    <ConversationFrame>
      <AgentHeader
        title={t.conv[c.id].title}
        activityLabel={working ? s.rail.working : s.rail.newReply}
        activityKind={working ? "working" : "unknown"}
        activityAnimated={working}
        controlLabel=""
        controlKind="neutral"
        workspaceLabel={c.ws}
        workspaceHref={`/workspaces/${c.ws}`}
        detailsExpanded={false}
        onToggleDetails={noop}
      />
      <ConversationStream label={t.conv[c.id].title}>
        <ConversationTimeline
          state="ready"
          historyMode="pagedAccessible"
          onJumpToLatest={noop}
          items={c.who.map((who, i) => ({
            id: `${c.id}-${i}`,
            kind: who === "me" ? "user" : "assistant",
            content: (
              <div
                className={i === hit ? "sw-target" : undefined}
                data-testid={i === hit ? "jump-target" : undefined}
                data-msg={i}
              >
                {who === "me" ? (
                  <UserMessage sourceText={msgs[i]} onCopy={noop} />
                ) : (
                  <AssistantMessage onCopy={noop}>
                    <Markdown text={msgs[i]} />
                  </AssistantMessage>
                )}
              </div>
            ),
          }))}
        />
      </ConversationStream>
      <Composer
        value={drafts[c.id] ?? ""}
        onChange={(v: string) => {
          drafts[c.id] = v;
          redraw((x) => x + 1);
        }}
        activity={working ? "working" : "idle"}
        selectedWorkingMode="steer"
        onModeChange={noop}
        onSendNow={noop}
        onSteer={noop}
        onFollowUp={noop}
        csrf="prototype"
        beforeField={band}
      />
    </ConversationFrame>
  );
}

// ---------- The page ----------

const modK = (e: KeyboardEvent) =>
  (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.code === "KeyK";
const editable = (el: Element | null) =>
  !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement).isContentEditable);
const field = () => document.querySelector<HTMLTextAreaElement>('[data-testid="message-input"]');

function Main({ d, t, k, example }: { d: number; t: Text; k: Keys; example: Example }) {
  const navigate = useNavigate();
  const location = useLocation();
  const p = new URLSearchParams(location.search);
  const open = p.get("conversation") ?? START;
  const conv = byId(open) ?? byId(START)!;
  const hit = p.has("hit") ? Number(p.get("hit")) : undefined;
  const hitQ = p.get("q") ?? "";
  // The review opens on the chosen case: empty, many hits, a name match, nothing.
  const [sw, setSw] = useState<{ q: string } | null>({ q: t.queries[example] });
  const previous = useRef<string>("notice");
  const shown = useRef(open);
  if (shown.current !== open) {
    previous.current = shown.current;
    shown.current = open;
  }
  const returnTo = useRef<HTMLElement | null>(null);
  const refocus = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once the new conversation is drawn.
  useEffect(() => {
    if (refocus.current) requestAnimationFrame(() => field()?.focus());
    refocus.current = false;
  }, [open, hit]);
  useHighlight(stemsOf(hitQ), hit !== undefined);

  const go = (id: string, h?: number, q?: string) => {
    const c = byId(id);
    if (!c) return;
    const sp = new URLSearchParams({ conversation: id });
    if (h !== undefined) {
      sp.set("hit", String(h));
      sp.set("q", q ?? "");
    }
    refocus.current = true;
    navigate(`/workspaces/${c.ws}?${sp}`);
  };

  const state = useRef({ sw });
  state.current = { sw };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      // The terminal keeps Ctrl+K (readline kill-line); the page never takes it there.
      if ((document.activeElement as HTMLElement | null)?.closest(".ah-terminal-surface")) return;
      const slash = e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !editable(document.activeElement);
      if (modK(e) || (slash && !state.current.sw)) {
        e.preventDefault();
        e.stopPropagation();
        if (state.current.sw) setSw(null);
        else {
          returnTo.current = document.activeElement as HTMLElement | null;
          setSw({ q: "" });
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const close = () => {
    setSw(null);
    const back = returnTo.current;
    requestAnimationFrame(() => (back?.isConnected && back !== document.body ? back : field())?.focus());
  };
  const status = useText(statusText);
  const band =
    hit !== undefined ? (
      <div className="sw-jump" data-testid="jump-band" role="status">
        <Icon name="search" />
        <span>{t.jump(hitQ, t.who[conv.who[hit] ?? "me"], t.ago(conv.days[hit] ?? 0))}</span>
        <span className="sw-jump-key">{t.jumpBack(k)}</span>
        <button type="button" className="sw-jump-x" aria-label={t.close} data-testid="jump-close" onClick={() => go(conv.id)}>
          ×
        </button>
      </div>
    ) : null;
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
      now={
        <Sections
          open={open}
          t={t}
          entry={
            <SearchEntry
              t={t}
              k={k}
              onOpen={() => {
                returnTo.current = null;
                setSw({ q: "" });
              }}
            />
          }
        />
      }
    >
      {WORKSPACES.map((w) => (
        <WorkspaceNavRow key={w} name={w} href={`/workspaces/${w}`} />
      ))}
    </WorkspaceRail>
  );
  return (
    <StatusBellProvider items={[]}>
      <div className="sw-shell">
        <AppShell
          mobileTitle={t.conv[conv.id].title}
          rail={rail}
          navigationBadge={2}
          main={
            <div className="sw-main" id="main">
              <Conversation key={`${conv.id}-${hit}`} c={conv} t={t} hit={hit} band={band} />
            </div>
          }
        />
      </div>
      {sw ? (
        <Switcher
          d={d}
          t={t}
          k={k}
          open={open}
          previous={previous.current}
          initialQuery={sw.q}
          onOpen={(id, h, q) => {
            setSw(null);
            go(id, h, q);
          }}
          onClose={close}
        />
      ) : null}
    </StatusBellProvider>
  );
}

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(review.theme);
  const [language, setLanguage] = useState(review.lang);
  const [mac, setMac] = useState(review.mac);
  const [example, setExample] = useState(review.example);
  const bar = useRef<HTMLElement>(null);
  const t = TEXT[language];
  const k = keysFor(mac);
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
    <div className="sw-review" data-direction={direction}>
      <header className="sw-reviewbar" ref={bar}>
        <div className="sw-controls">
          <strong>{t.title}</strong>
          <label>
            {t.example}{" "}
            <select id="example" value={example} onChange={(e) => { review.example = e.target.value as Example; lastQuery = ""; setExample(review.example); }}>
              {(["empty", "many", "title", "none"] as const).map((v) => (
                <option key={v} value={v}>{t.examples[v]}</option>
              ))}
            </select>
          </label>
          <label>
            {t.theme}{" "}
            <select id="theme" value={theme} onChange={(e) => { review.theme = e.target.value as typeof review.theme; setTheme(review.theme); }}>
              {(["light", "dark", "contrast"] as const).map((v) => (
                <option key={v} value={v}>{t.themes[v]}</option>
              ))}
            </select>
          </label>
          <label>
            {t.language}{" "}
            <select id="language" value={language} onChange={(e) => { review.lang = e.target.value as "fi" | "en"; setPersonalLanguage(review.lang); lastQuery = ""; setLanguage(review.lang); }}>
              <option value="fi">suomi</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            {t.keyboard}{" "}
            <select id="keyboard" value={mac ? "mac" : "pc"} onChange={(e) => { review.mac = e.target.value === "mac"; setMac(review.mac); }}>
              <option value="mac">{t.keyboards.mac}</option>
              <option value="pc">{t.keyboards.pc}</option>
            </select>
          </label>
          <span className="sw-try">{t.tryIt(k)}</span>
        </div>
        <ol className="sw-lines" data-testid="direction-lines">
          {t.lines(k).map((l, i) => (
            <li key={i} aria-current={i === direction ? "true" : undefined}>{l}</li>
          ))}
        </ol>
        <p className="sw-recommend" data-testid="recommendation">{t.recommend(k)}</p>
      </header>
      <div className="sw-stage">
        <MemoryRouter initialEntries={[`/workspaces/retkiopas?conversation=${START}`]}>
          <Main key={`${direction}-${language}-${mac}-${example}`} d={direction} t={t} k={k} example={example} />
        </MemoryRouter>
      </div>
    </div>
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

if (review.lang === "en") setPersonalLanguage("en");
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
