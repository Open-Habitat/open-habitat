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

// proto-rail-keyboard-navigation, round 2. Jari 15.11.2026: the ⌘K
// switcher of round 1 (direction 2) is wanted too, with a real full-text
// search across every agent conversation. One view: the production rail
// and open conversation, with the switcher over it. The axis is how name
// matches and message matches share the switcher: one compact list, a wide
// dialog with filters and a preview, or name jumping plus a separate search
// page. Search here runs over the synthetic conversations below with the
// matching the host would do (word-start/substring match with a light
// Finnish ending strip, see NOTES.md). Each hit opens its conversation at
// the matching message.
setPersonalLanguage("fi");

// No-break spaces: at 390 the centred picker has half the width to shrink into.
const directions = ["1\u00a0Lista", "2\u00a0Esikatselu", "3\u00a0Hakusivu"];
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
  { id: "tiles", ws: "retkiopas", state: "working", age: 1, who: ["me", "agent", "tool", "me", "agent"], days: [0, 0, 0, 0, 0] },
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

// ---------- Matching, as the host's index would ----------

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
const plain = (s: string) => s.replace(/```/g, "").trim();

type Filters = {
  who: "all" | "me" | "agent";
  ws: Ws | null;
  when: "any" | "7" | "30";
  archived: boolean;
  tools: boolean;
};
const FILTERS0: Filters = { who: "all", ws: null, when: "any", archived: true, tools: false };
type Hit = { c: Conv; i: number; who: Who; days: number; text: string };

function search(t: Text, q: string, f: Filters, building: boolean) {
  const stems = stemsOf(q);
  const visible = (c: Conv) => (f.archived || !c.archived) && (!f.ws || c.ws === f.ws);
  const names = WORLD.filter(
    (c) => visible(c) && (has(t.conv[c.id].title, stems) || has(c.ws, stems)),
  );
  const hits: Hit[] = [];
  for (const c of WORLD) {
    if (!visible(c)) continue;
    c.who.forEach((who, i) => {
      const days = c.days[i];
      if (who === "tool" ? !f.tools : f.who !== "all" && f.who !== who) return;
      if (f.when !== "any" && days > Number(f.when)) return;
      // While the index builds it reads newest first: older messages wait.
      if (building && days > 1) return;
      const text = t.conv[c.id].msgs[i];
      if (has(text, stems)) hits.push({ c, i, who, days, text });
    });
  }
  hits.sort((a, b) => a.days - b.days || WORLD.indexOf(a.c) - WORLD.indexOf(b.c) || a.i - b.i);
  return { stems, names, hits };
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
/** The matching sentence and some of its neighbours, not the whole message. */
function snippet(text: string, stems: string[], room = 150) {
  const s = plain(text).replace(/\s+/g, " ");
  if (s.length <= room) return s;
  const at = Math.max(0, Math.min(...stems.map((x) => norm(s).indexOf(x)).filter((n) => n >= 0)));
  let from = Math.max(0, s.lastIndexOf(" ", Math.max(0, at - room / 3)));
  if (at - from > room / 2) from = at;
  const end = s.indexOf(" ", from + room);
  return `${from > 0 ? "…" : ""}${s.slice(from, end < 0 ? undefined : end).trim()}${end < 0 ? "" : "…"}`;
}

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
  | { kind: "conv"; c: Conv; previous?: boolean }
  | { kind: "hit"; h: Hit; more?: number }
  | { kind: "continue"; q: string }
  | { kind: "page"; q: string };
type Item = Row | { kind: "head"; label: string; meta?: string };
const selectable = (r: Item): r is Row => r.kind !== "head";
const rowKey = (r: Row) =>
  r.kind === "conv" ? `c-${r.c.id}` : r.kind === "hit" ? `h-${r.h.c.id}-${r.h.i}` : r.kind;

let lastQuery = "";
let review = {
  theme: (params.get("theme") as "light" | "dark" | "contrast") || "light",
  lang: (params.get("lang") === "en" ? "en" : "fi") as "fi" | "en",
  mac:
    params.get("kbd") === "mac" ||
    (params.get("kbd") !== "pc" && /Mac|iPhone|iPad/.test(navigator.platform)),
  building: params.get("building") === "1",
};

function ConvRow({ c, t, extra }: { c: Conv; t: Text; extra?: ReactNode }) {
  return (
    <>
      <HabitatMark state={markOf(c)} size={16} />
      <span className="sw-title">{t.conv[c.id].title}</span>
      {extra}
      {c.archived ? <span className="sw-tag">{t.archived}</span> : null}
      <span className="sw-ws">{c.ws}</span>
    </>
  );
}

function HitRow({ h, t, stems, showConv, more }: { h: Hit; t: Text; stems: string[]; showConv: boolean; more?: number }) {
  return (
    <>
      <span className={`sw-who sw-who-${h.who}`}>{t.who[h.who]}</span>
      <span className="sw-hit-body">
        <span className="sw-snippet">
          <Marked text={snippet(h.text, stems)} stems={stems} />
        </span>
        <span className="sw-hit-meta">
          {showConv ? (
            <>
              <span className="sw-hit-conv">{t.conv[h.c.id].title}</span>
              <span className="sw-ws">{h.c.ws}</span>
            </>
          ) : null}
          {h.c.archived && showConv ? <span className="sw-tag">{t.archived}</span> : null}
          <span>{t.ago(h.days)}</span>
          {more ? <span className="sw-more">{t.more(more)}</span> : null}
        </span>
      </span>
    </>
  );
}

function Chips({ t, f, set }: { t: Text; f: Filters; set: (f: Filters) => void }) {
  const cycle = <T,>(list: T[], v: T) => list[(list.indexOf(v) + 1) % list.length];
  return (
    <div className="sw-chips" role="group" aria-label={t.filters} data-testid="filters">
      <button type="button" data-testid="f-who" aria-pressed={f.who !== "all"} onClick={() => set({ ...f, who: cycle(["all", "me", "agent"] as Filters["who"][], f.who) })}>
        {t.fWho[f.who]}
      </button>
      <button type="button" data-testid="f-ws" aria-pressed={!!f.ws} onClick={() => set({ ...f, ws: cycle([null, ...WORKSPACES], f.ws) })}>
        {f.ws ? <code>{f.ws}</code> : t.fWsAll}
      </button>
      <button type="button" data-testid="f-when" aria-pressed={f.when !== "any"} onClick={() => set({ ...f, when: cycle(["any", "7", "30"] as Filters["when"][], f.when) })}>
        {t.fWhen[f.when]}
      </button>
      <button type="button" data-testid="f-archived" aria-pressed={f.archived} onClick={() => set({ ...f, archived: !f.archived })}>
        {t.fArchived}
      </button>
      <button type="button" data-testid="f-tools" aria-pressed={f.tools} onClick={() => set({ ...f, tools: !f.tools })}>
        {t.fTools}
      </button>
    </div>
  );
}

function Preview({ row, t, k, stems }: { row?: Row; t: Text; k: Keys; stems: string[] }) {
  if (!row || (row.kind !== "conv" && row.kind !== "hit")) return <aside className="sw-preview" data-testid="preview" />;
  const c = row.kind === "conv" ? row.c : row.h.c;
  const msgs = t.conv[c.id].msgs;
  const at = row.kind === "hit" ? row.h.i : msgs.length - 1;
  const from = row.kind === "hit" ? Math.max(0, at - 1) : Math.max(0, msgs.length - 2);
  const to = Math.min(msgs.length - 1, row.kind === "hit" ? at + 1 : at);
  const shown = [];
  for (let i = from; i <= to; i++) shown.push(i);
  return (
    <aside className="sw-preview" data-testid="preview" aria-label={t.preview}>
      <header>
        <strong>{t.conv[c.id].title}</strong>
        <span className="sw-ws">{c.ws}</span>
        {c.archived ? <span className="sw-tag">{t.archived}</span> : null}
        <span className="sw-preview-kind">{row.kind === "conv" ? t.previewConv : t.ago(row.h.days)}</span>
      </header>
      <ol>
        {shown.map((i) => (
          <li key={i} className={`sw-pmsg sw-pmsg-${c.who[i]}`} data-hit={row.kind === "hit" && i === at ? "" : undefined}>
            <span className="sw-pwho">
              {t.who[c.who[i]]} · {t.ago(c.days[i])}
            </span>
            <span className="sw-ptext">
              {row.kind === "hit" && i === at ? <Marked text={plain(msgs[i])} stems={stems} /> : plain(msgs[i])}
            </span>
          </li>
        ))}
      </ol>
      <footer>{row.kind === "hit" ? t.previewOpen(k) : `${k.enter}`}</footer>
    </aside>
  );
}

function Switcher({
  d,
  t,
  k,
  open,
  previous,
  initialQuery,
  initialHit,
  building,
  onOpen,
  onPage,
  onClose,
}: {
  d: number;
  t: Text;
  k: Keys;
  open: string;
  previous?: string;
  initialQuery: string;
  initialHit?: boolean;
  building: boolean;
  onOpen: (id: string, hit?: number, q?: string) => void;
  onPage: (q: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [f, setF] = useState<Filters>(FILTERS0);
  const listId = useId();
  const q = query.trim();
  const { stems, names, hits } = search(t, q, d === 1 ? f : FILTERS0, building);
  const items: Item[] = [];
  if (!q) {
    items.push({ kind: "head", label: t.recent });
    const order = previous && previous !== open ? [previous, ...RECENT.filter((r) => r !== previous)] : RECENT;
    for (const id of order) if (id !== open) items.push({ kind: "conv", c: byId(id)!, previous: id === previous });
    if (lastQuery) items.push({ kind: "continue", q: lastQuery });
  } else if (d === 2) {
    if (names.length) items.push({ kind: "head", label: t.names });
    for (const c of names) items.push({ kind: "conv", c });
    items.push({ kind: "page", q });
  } else {
    if (names.length) items.push({ kind: "head", label: t.names });
    for (const c of names.slice(0, 5)) items.push({ kind: "conv", c });
    if (hits.length) items.push({ kind: "head", label: t.inMessages, meta: t.hits(hits.length) });
    if (d === 0) {
      const per = new Map<string, number>();
      const kept: Row[] = [];
      for (const h of hits) {
        const n = (per.get(h.c.id) ?? 0) + 1;
        per.set(h.c.id, n);
        if (n <= 2) kept.push({ kind: "hit", h });
      }
      for (const r of kept) {
        if (r.kind !== "hit") continue;
        const total = per.get(r.h.c.id)!;
        const last = kept.filter((x) => x.kind === "hit" && x.h.c.id === r.h.c.id).at(-1);
        if (last === r && total > 2) r.more = total - 2;
        items.push(r);
      }
    } else {
      const groups = new Map<ConvId, Hit[]>();
      for (const h of hits) groups.set(h.c.id, [...(groups.get(h.c.id) ?? []), h]);
      for (const [id, g] of groups) {
        const c = byId(id)!;
        items.push({ kind: "head", label: t.conv[id].title, meta: `${c.ws} · ${t.hits(g.length)}` });
        for (const h of g) items.push({ kind: "hit", h });
      }
    }
  }
  const rows = items.filter(selectable);
  const firstHit = () => Math.max(0, rows.findIndex((r) => r.kind === "hit"));
  const [sel, setSel] = useState(() => (initialHit ? firstHit() : 0));
  const [lastQ, setLastQ] = useState(q);
  const [lastF, setLastF] = useState(f);
  if (lastQ !== q || lastF !== f) {
    setLastQ(q);
    setLastF(f);
    setSel(0);
  }
  const at = Math.min(sel, Math.max(0, rows.length - 1));
  const choose = (r: Row | undefined, toPage = false) => {
    if (!r) return;
    if (toPage && q) return onPage(q);
    if (r.kind === "conv") {
      if (q) lastQuery = q;
      onOpen(r.c.id);
    } else if (r.kind === "hit") {
      lastQuery = q;
      onOpen(r.h.c.id, r.h.i, q);
    } else if (r.kind === "continue") setQuery(r.q);
    else onPage(r.q);
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
      choose(rows[at], e.metaKey || e.ctrlKey);
    }
  };
  const wide = d === 1;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the backdrop closes on a press, as production's dialogs do.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Esc closes.
    <div className="sw-back" data-testid="switcher" data-direction={d} onClick={onClose}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: only stops the backdrop's press. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.dialog}
        className={`sw-dialog${wide ? " sw-wide" : ""}`}
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
            // biome-ignore lint/a11y/noAutofocus: the switcher exists to be typed into.
            autoFocus
            data-testid="switcher-input"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={rows[at] ? `${listId}-${rowKey(rows[at])}` : undefined}
            placeholder={d === 2 ? t.placeholderNames : t.placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={keys}
          />
          <kbd className="sw-esc">Esc</kbd>
        </div>
        {wide ? <Chips t={t} f={f} set={setF} /> : null}
        {building && q && d !== 2 ? (
          <p className="sw-building" data-testid="building" role="status">
            <span className="sw-bar" aria-hidden="true">
              <span />
            </span>
            {t.buildingLine}
          </p>
        ) : null}
        <div className="sw-body">
          <ul role="listbox" id={listId} aria-label={t.dialog} ref={listRef}>
            {items.map((it, n) => {
              if (it.kind === "head")
                return (
                  <li key={`head-${n}`} role="presentation" className="sw-head">
                    <span>{it.label}</span>
                    {it.meta ? <span className="sw-head-meta">{it.meta}</span> : null}
                  </li>
                );
              const i = rows.indexOf(it);
              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: the field's keys choose.
                <li
                  key={rowKey(it)}
                  role="option"
                  id={`${listId}-${rowKey(it)}`}
                  data-testid={`row-${rowKey(it)}`}
                  data-kind={it.kind}
                  aria-selected={i === at}
                  onMouseMove={() => i !== at && setSel(i)}
                  onClick={() => choose(it)}
                >
                  {it.kind === "conv" ? (
                    <ConvRow c={it.c} t={t} extra={it.previous ? <span className="sw-prev">{t.previous}</span> : null} />
                  ) : it.kind === "hit" ? (
                    <HitRow h={it.h} t={t} stems={stems} showConv={d === 0} more={it.more} />
                  ) : it.kind === "continue" ? (
                    <>
                      <Icon name="search" />
                      <span className="sw-title">{t.continueSearch(it.q)}</span>
                    </>
                  ) : (
                    <>
                      <Icon name="search" />
                      <span className="sw-title">{t.searchAll(it.q)}</span>
                      <kbd>{k.mod(k.enter)}</kbd>
                    </>
                  )}
                </li>
              );
            })}
            {q && !rows.length ? <li className="sw-empty">{t.empty}</li> : null}
          </ul>
          {wide ? <Preview row={rows[at]} t={t} k={k} stems={stems} /> : null}
        </div>
        <p className="sw-foot">{[t.foot, t.footD2, t.footD3][d](k)}</p>
      </div>
    </div>
  );
}

// ---------- Direction 3: the search page ----------

let pageFilters: Filters = FILTERS0;
function SearchPage({
  t,
  k,
  query: q0,
  building,
  onQuery,
  onOpen,
  onBack,
}: {
  t: Text;
  k: Keys;
  query: string;
  building: boolean;
  onQuery: (q: string) => void;
  onOpen: (id: string, hit?: number, q?: string) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState(q0);
  const [f, setF] = useState(pageFilters);
  const q = query.trim();
  const { stems, names, hits } = search(t, q, f, building);
  const rows: Row[] = [...names.map((c) => ({ kind: "conv" as const, c })), ...hits.map((h) => ({ kind: "hit" as const, h }))];
  const [sel, setSel] = useState(() => Math.max(0, rows.findIndex((r) => r.kind === "hit")));
  const at = Math.min(sel, Math.max(0, rows.length - 1));
  const set = (nf: Filters) => {
    pageFilters = nf;
    setF(nf);
    setSel(0);
  };
  const choose = (r?: Row) => {
    if (!r) return;
    lastQuery = q;
    if (r.kind === "conv") onOpen(r.c.id);
    else if (r.kind === "hit") onOpen(r.h.c.id, r.h.i, q);
  };
  const keys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (rows.length) setSel((at + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(rows[at]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onBack();
    }
  };
  const radio = <K extends "who" | "when">(key: K, values: Filters[K][], label: (v: Filters[K]) => string, legend: string) => (
    <fieldset>
      <legend>{legend}</legend>
      {values.map((v) => (
        <label key={String(v)}>
          <input type="radio" name={key} checked={f[key] === v} onChange={() => set({ ...f, [key]: v })} /> {label(v)}
        </label>
      ))}
    </fieldset>
  );
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  });
  return (
    <section className="sw-page" data-testid="search-page" aria-label={t.pageTitle}>
      <header className="sw-page-head">
        <button type="button" className="sw-page-back" data-testid="page-back" onClick={onBack}>
          ← {t.pageBack}
        </button>
        <div className="sw-field">
          <Icon name="search" />
          <input
            // biome-ignore lint/a11y/noAutofocus: the page is opened to search.
            autoFocus
            data-testid="page-input"
            aria-label={t.placeholder}
            placeholder={t.placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onQuery(e.target.value);
              setSel(0);
            }}
            onKeyDown={keys}
          />
        </div>
        {building && q ? (
          <p className="sw-building" data-testid="building" role="status">
            <span className="sw-bar" aria-hidden="true">
              <span />
            </span>
            {t.buildingLine}
          </p>
        ) : null}
      </header>
      <div className="sw-page-body">
        <aside className="sw-page-filters" data-testid="filters" aria-label={t.filters}>
          {radio("who", ["all", "me", "agent"], (v) => t.fWho[v], t.fWhoLabel)}
          <fieldset>
            <legend>{t.fWs}</legend>
            {[null, ...WORKSPACES].map((w) => (
              <label key={w ?? "all"}>
                <input type="radio" name="ws" checked={f.ws === w} onChange={() => set({ ...f, ws: w })} /> {w ? <code>{w}</code> : t.fWsAll}
              </label>
            ))}
          </fieldset>
          {radio("when", ["any", "7", "30"], (v) => t.fWhen[v], t.fWhenLabel)}
          <fieldset>
            <label>
              <input type="checkbox" checked={f.archived} onChange={() => set({ ...f, archived: !f.archived })} /> {t.fArchived}
            </label>
            <label>
              <input type="checkbox" checked={f.tools} onChange={() => set({ ...f, tools: !f.tools })} /> {t.fTools}
            </label>
          </fieldset>
        </aside>
        <div className="sw-page-results" ref={listRef} role="listbox" aria-label={t.pageTitle}>
          {names.length ? <h3>{t.names}</h3> : null}
          {names.map((c) => {
            const i = rows.findIndex((r) => r.kind === "conv" && r.c === c);
            return (
              // biome-ignore lint/a11y/useKeyWithClickEvents: the field's keys choose.
              <div key={c.id} role="option" className="sw-page-row" data-testid={`row-c-${c.id}`} aria-selected={i === at} onClick={() => choose(rows[i])}>
                <ConvRow c={c} t={t} />
              </div>
            );
          })}
          {hits.length ? (
            <h3>
              {t.inMessages} <span className="sw-head-meta">{t.hits(hits.length)}</span>
            </h3>
          ) : null}
          {hits.map((h) => {
            const i = rows.findIndex((r) => r.kind === "hit" && r.h === h);
            const msgs = t.conv[h.c.id].msgs;
            return (
              // biome-ignore lint/a11y/useKeyWithClickEvents: the field's keys choose.
              <div key={`${h.c.id}-${h.i}`} role="option" className="sw-page-row sw-page-hit" data-testid={`row-h-${h.c.id}-${h.i}`} aria-selected={i === at} onClick={() => choose(rows[i])}>
                <div className="sw-page-hit-head">
                  <HabitatMark state={markOf(h.c)} size={14} />
                  <strong>{t.conv[h.c.id].title}</strong>
                  <span className="sw-ws">{h.c.ws}</span>
                  {h.c.archived ? <span className="sw-tag">{t.archived}</span> : null}
                  <span className="sw-hit-meta">{t.ago(h.days)}</span>
                </div>
                {h.i > 0 ? (
                  <p className="sw-page-ctx">
                    {t.who[h.c.who[h.i - 1]]}: {snippet(msgs[h.i - 1], [], 110)}
                  </p>
                ) : null}
                <p className="sw-page-match">
                  <span className={`sw-who sw-who-${h.who}`}>{t.who[h.who]}</span>{" "}
                  <Marked text={snippet(h.text, stems, 240)} stems={stems} />
                </p>
              </div>
            );
          })}
          {q && !rows.length ? <p className="sw-empty">{t.empty}</p> : null}
          <p className="sw-foot">{t.foot(k)}</p>
        </div>
      </div>
    </section>
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

const LangContext = React.createContext<"fi" | "en">("fi");
const modK = (e: KeyboardEvent) =>
  (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.code === "KeyK";
const editable = (el: Element | null) =>
  !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement).isContentEditable);
const field = () => document.querySelector<HTMLTextAreaElement>('[data-testid="message-input"]');

function Main({ d, t, k, building }: { d: number; t: Text; k: Keys; building: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const p = new URLSearchParams(location.search);
  const open = p.get("conversation") ?? START;
  const conv = byId(open) ?? byId(START)!;
  const hit = p.has("hit") ? Number(p.get("hit")) : undefined;
  const hitQ = p.get("q") ?? "";
  const page = p.get("search");
  // The review opens on each direction's search with the example query.
  const [sw, setSw] = useState<{ q: string; hit?: boolean } | null>(d === 2 ? null : { q: t.query, hit: true });
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
  }, [open, hit, page]);
  useHighlight(stemsOf(hitQ), hit !== undefined && page === null);

  const go = (id: string, h?: number, q?: string, from?: string) => {
    const c = byId(id);
    if (!c) return;
    const sp = new URLSearchParams({ conversation: id });
    if (h !== undefined) {
      sp.set("hit", String(h));
      sp.set("q", q ?? "");
    }
    if (from) sp.set("from", from);
    refocus.current = true;
    navigate(`/workspaces/${c.ws}?${sp}`);
  };
  const toPage = (q: string) => {
    setSw(null);
    navigate(`/search?${new URLSearchParams({ conversation: open, search: q })}`);
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
    requestAnimationFrame(() => (back?.isConnected && back !== document.body ? back : (document.querySelector<HTMLElement>('[data-testid="page-input"]') ?? field()))?.focus());
  };
  const status = useText(statusText);
  const band =
    hit !== undefined ? (
      <div className="sw-jump" data-testid="jump-band" role="status">
        <Icon name="search" />
        <span>{t.jump(hitQ, t.who[conv.who[hit] ?? "me"], t.ago(conv.days[hit] ?? 0))}</span>
        {p.get("from") ? (
          <button type="button" data-testid="jump-back" onClick={() => toPage(p.get("from")!)}>
            ← {t.jumpBackPage}
          </button>
        ) : (
          <span className="sw-jump-key">{t.jumpBack(k)}</span>
        )}
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
          open={page === null ? open : ""}
          t={t}
          entry={
            <SearchEntry
              t={t}
              k={k}
              onOpen={() => {
                returnTo.current = null;
                if (d === 2) toPage(lastQuery);
                else setSw({ q: "" });
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
          mobileTitle={page !== null ? t.pageTitle : t.conv[conv.id].title}
          rail={rail}
          navigationBadge={2}
          main={
            <div className="sw-main" id="main">
              {page !== null ? (
                <SearchPage
                  key={page}
                  t={t}
                  k={k}
                  query={page}
                  building={building}
                  onQuery={(q) => {
                    lastQuery = q;
                  }}
                  onOpen={(id, h, q) => go(id, h, q, q ?? page)}
                  onBack={() => go(open)}
                />
              ) : (
                <Conversation key={`${conv.id}-${hit}`} c={conv} t={t} hit={hit} band={band} />
              )}
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
          initialHit={sw.hit}
          building={building}
          onOpen={(id, h, q) => {
            setSw(null);
            go(id, h, q);
          }}
          onPage={toPage}
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
  const [building, setBuilding] = useState(review.building);
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
  const start =
    direction === 2
      ? `/search?${new URLSearchParams({ conversation: START, search: t.query })}`
      : `/workspaces/retkiopas?conversation=${START}`;
  return (
    <LangContext.Provider value={language}>
      <div className="sw-review" data-direction={direction}>
        <header className="sw-reviewbar" ref={bar}>
          <div className="sw-controls">
            <strong>{t.title}</strong>
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
            <label>
              <input type="checkbox" id="building" checked={building} onChange={(e) => { review.building = e.target.checked; setBuilding(review.building); }} /> {t.building}
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
          <MemoryRouter initialEntries={[start]}>
            <Main key={`${direction}-${language}-${mac}-${building}`} d={direction} t={t} k={k} building={building} />
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
