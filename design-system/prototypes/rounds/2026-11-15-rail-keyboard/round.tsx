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
import { Markdown } from "../../../../web/src/components/Markdown";
import {
  AgentHeader,
  AgentNavItem,
  type AgentNavModel,
  AppShell,
  WorkspaceNavRow,
  WorkspaceRail,
} from "../../../../web/src/components/Navigation";
import "../../../../web/src/components/NextWaitingRow.css";
import { QuietSection } from "../../../../web/src/components/QuietSection";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { Composer } from "../../../../web/src/components/composer/Composer";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { navigationText } from "../../../../web/src/text/navigation";
import { nextWaitingRowText } from "../../../../web/src/text/nextWaitingRow";
import { quietRailText } from "../../../../web/src/text/quietRail";
import { statusText } from "../../../../web/src/text/status";
import "../../../../web/src/components/components.css";
import { type Keys, keysFor, TEXT, type Text } from "./text";
import "./round.css";

// proto-rail-keyboard-navigation, round 1. Jari 15.11.2026: no keyboard
// shortcut moves up and down the rail's conversations. The browser's tab
// keys are taken, but something must exist. One view: the production rail
// (WorkspaceRail, NowSections' markup, AgentNavItem, QuietSection) and the
// open conversation (ConversationFrame, AgentHeader, ConversationTimeline,
// Composer). Each direction is keyboard-live: its keys really move the open
// conversation in this rail, from inside the composer too. Round-own pieces
// are the key handling, the first-use tip, the switcher, the rail-mode band
// and NextRow, production's NextWaitingRow markup with the direction's key
// (production's names ⌥↓ from navigator.platform and cannot follow the
// review's keyboard choice).
setPersonalLanguage("fi");

const directions = ["1 Suoraan", "2 Vaihtaja", "3 Selaa"];
const params = new URLSearchParams(location.search);

// ---------- The synthetic world ----------

type ConvId = keyof Text["conv"];
type Conv = {
  id: ConvId;
  ws: "retkiopas" | "kotisivu" | "kirjanpito";
  state: "reply" | "question" | "working" | "idle";
  /** Minutes since the last change. */
  age: number;
};
const WORLD: Conv[] = [
  { id: "notice", ws: "kotisivu", state: "reply", age: 12 },
  { id: "a11y", ws: "kotisivu", state: "question", age: 25 },
  { id: "tiles", ws: "retkiopas", state: "working", age: 1 },
  { id: "elevation", ws: "retkiopas", state: "working", age: 3 },
  { id: "backups", ws: "kirjanpito", state: "working", age: 6 },
  { id: "glossary", ws: "kirjanpito", state: "idle", age: 50 },
  { id: "receipts", ws: "kirjanpito", state: "idle", age: 180 },
  { id: "colors", ws: "retkiopas", state: "idle", age: 60 * 26 },
];
const START: ConvId = "tiles";
const NOW0 = Date.now();
const byId = (id: string) => WORLD.find((c) => c.id === id);
const hrefOf = (c: Conv) => `/workspaces/${c.ws}?conversation=${c.id}`;
const markOf = (c: Conv): MarkState =>
  c.state === "reply" || c.state === "question"
    ? "waiting"
    : c.state === "working"
      ? "working"
      : "done";

type Words = ReturnType<typeof useText<typeof statusText>>["rail"];
function model(c: Conv, open: string, t: Text, s: Words): AgentNavModel {
  const label =
    c.state === "working"
      ? s.working
      : c.state === "reply"
        ? s.newReply
        : c.state === "question"
          ? s.asks
          : "";
  return {
    agentId: c.id,
    href: hrefOf(c),
    title: t.conv[c.id],
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

// ---------- The rail: production pieces ----------

/** The visible rail order, as the person sees it: the DOM order of the
 * rail's conversation rows (a folded Hiljaiset is not in it). */
const railOrder = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '.ah-rail li[data-testid^="agent-item-"]',
    ),
  ].map((li) => li.dataset.testid!.slice("agent-item-".length));
const yoursOrder = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '[data-testid="rail-yours"] li[data-testid^="agent-item-"]',
    ),
  ].map((li) => li.dataset.testid!.slice("agent-item-".length));
const railLink = (id: string) =>
  document.querySelector<HTMLAnchorElement>(
    `.ah-rail [data-testid="agent-item-${id}"] a.ah-nav-link`,
  );
const field = () =>
  document.querySelector<HTMLTextAreaElement>('[data-testid="message-input"]');

function Grouped({ rows }: { rows: AgentNavModel[] }) {
  const groups = new Map<string, AgentNavModel[]>();
  for (const r of rows) {
    const k = r.workspaceName ?? "";
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return (
    <>
      {[...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b, "fi"))
        .map(([name, g]) => (
          // biome-ignore lint/a11y/useSemanticElements: production's group markup.
          <div key={name} className="ah-now-group" role="group">
            <h3 className="ah-now-group-head">
              <span className="ah-now-group-name">{name}</span>
              <span className="ah-rail-count">{g.length}</span>
            </h3>
            <ul>
              {g.map((r) => (
                <AgentNavItem key={r.agentId} {...r} now={NOW0} />
              ))}
            </ul>
          </div>
        ))}
    </>
  );
}

function Sections({ open, t, tip }: { open: string; t: Text; tip: ReactNode }) {
  const n = useText(navigationText);
  const s = useText(statusText).rail;
  const yoursId = useId();
  const runningId = useId();
  const rows = WORLD.map((c) => ({ c, m: model(c, open, t, s) }));
  const yours = rows.filter((r) => r.c.state === "reply" || r.c.state === "question");
  const running = rows.filter((r) => r.c.state === "working");
  const quiet = rows.filter((r) => r.c.state === "idle");
  return (
    <>
      <section className="ah-now" data-testid="rail-yours" aria-labelledby={yoursId}>
        <h2 className="ah-rail-section-head" id={yoursId}>
          {n.yourTurn}
          <span className="ah-rail-count ah-rail-count-attention">
            {yours.length}
          </span>
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
        <Grouped rows={running.map((r) => r.m)} />
      </section>
      <QuietSection
        rows={quiet.map((r) => r.m)}
        workspaces={["kirjanpito", "kotisivu", "retkiopas"].map((w) => ({
          id: w,
          name: w,
        }))}
        choice={{ sort: "newest", workspace: null }}
      />
      {tip}
    </>
  );
}

// ---------- Discoverability ----------

function Tip({ d, t, k, onClose }: { d: number; t: Text; k: Keys; onClose: () => void }) {
  const text = [t.hint1, t.hint2, t.hint3][d](k);
  return (
    <aside className="rk-tip" data-testid="first-use-tip" aria-label={t.hintHead}>
      <p>
        <strong>{t.hintHead}</strong> {text}
      </p>
      <p className="rk-tip-why">{t.hintWhy}</p>
      <button type="button" data-testid="tip-ok" onClick={onClose}>
        {t.hintOk}
      </button>
    </aside>
  );
}

/** Production's NextWaitingRow markup and catalog, with the direction's key. */
function NextRow({
  waiting,
  keyLabel,
  aria,
  onStart,
}: {
  waiting: Conv[];
  keyLabel: string;
  aria: string;
  onStart: () => void;
}) {
  const txt = useText(nextWaitingRowText);
  const t = TEXT[useLang()];
  if (!waiting.length) return null;
  return (
    <div className="ah-next-waiting" data-testid="next-waiting" data-waiting={waiting.length}>
      <button
        type="button"
        className="ah-next-open"
        data-testid="next-open"
        aria-keyshortcuts={aria}
        title={`${txt.go} (${keyLabel})`}
        onClick={onStart}
      >
        <span className="ah-next-label">{txt.meanwhile}</span>
        <span className="ah-next-ball" aria-hidden="true" />
        <span className="ah-next-title">{txt.waiting(waiting.length)}</span>
        <span className="ah-next-det">{waiting.map((c) => t.conv[c.id]).join(", ")}</span>
        <span className="ah-next-go">
          {txt.go} <kbd data-testid="next-key">{keyLabel}</kbd>
        </span>
      </button>
    </div>
  );
}

// ---------- Direction 2: the switcher ----------

function Switcher({
  t,
  open,
  previous,
  onPick,
  onClose,
}: {
  t: Text;
  open: string;
  previous?: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const n = useText(navigationText);
  const q = useText(quietRailText);
  const [query, setQuery] = useState("");
  const order = useRef(railOrder()).current;
  const yours = useRef(new Set(yoursOrder())).current;
  const listId = useId();
  const words = query.trim().toLocaleLowerCase();
  const shown = order
    .map((id) => byId(id)!)
    .filter(
      (c) =>
        !words ||
        t.conv[c.id].toLocaleLowerCase().includes(words) ||
        c.ws.includes(words),
    );
  const initial = () => {
    const prev = shown.findIndex((c) => c.id === previous && c.id !== open);
    if (prev >= 0) return prev;
    const other = shown.findIndex((c) => c.id !== open);
    return other >= 0 ? other : 0;
  };
  const [sel, setSel] = useState(initial);
  // A new query chooses afresh: its best is the first match.
  const [lastWords, setLastWords] = useState(words);
  if (lastWords !== words) {
    setLastWords(words);
    setSel(words ? 0 : initial());
  }
  const section = (c: Conv) =>
    yours.has(c.id) ? n.yourTurn : c.state === "working" ? n.running : q.title;
  const keys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!shown.length) return;
      setSel((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = shown[sel];
      if (c) onPick(c.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the backdrop closes on a press, as production's dialogs do.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Esc in the field closes.
    <div className="rk-switcher-back" data-testid="switcher" onClick={onClose}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: only stops the backdrop's press. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.switcherLabel}
        className="rk-switcher"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          // biome-ignore lint/a11y/noAutofocus: the switcher exists to be typed into.
          autoFocus
          data-testid="switcher-input"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={shown[sel] ? `${listId}-${shown[sel].id}` : undefined}
          placeholder={t.switcherPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={keys}
        />
        <ul role="listbox" id={listId} aria-label={t.switcherLabel}>
          {shown.map((c, i) => {
            const head = i === 0 || section(shown[i - 1]) !== section(c);
            return (
              <React.Fragment key={c.id}>
                {head ? (
                  <li role="presentation" className="rk-sw-head">
                    {section(c)}
                  </li>
                ) : null}
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: the field's keys choose. */}
                <li
                  role="option"
                  id={`${listId}-${c.id}`}
                  data-testid={`switcher-option-${c.id}`}
                  aria-selected={i === sel}
                  aria-current={c.id === open ? "page" : undefined}
                  onMouseMove={() => setSel(i)}
                  onClick={() => onPick(c.id)}
                >
                  <HabitatMark state={markOf(c)} size={16} />
                  <span className="rk-sw-title">{t.conv[c.id]}</span>
                  {c.id === previous && c.id !== open ? (
                    <span className="rk-sw-prev">{t.switcherPrevious}</span>
                  ) : null}
                  <span className="rk-sw-ws">{c.ws}</span>
                </li>
              </React.Fragment>
            );
          })}
          {shown.length ? null : <li className="rk-sw-empty">{t.switcherEmpty}</li>}
        </ul>
        <p className="rk-sw-foot">{t.switcherFoot}</p>
      </div>
    </div>
  );
}

// ---------- The open conversation: production pieces ----------

const noop = () => {};
const drafts: Partial<Record<ConvId, string>> = {};

function Conversation({
  c,
  t,
  next,
}: {
  c: Conv;
  t: Text;
  next: ReactNode;
}) {
  const s = useText(statusText);
  const [, redraw] = useState(0);
  const working = c.state === "working";
  return (
    <ConversationFrame>
      <AgentHeader
        title={t.conv[c.id]}
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
      <ConversationStream label={t.conv[c.id]}>
        <ConversationTimeline
          state="ready"
          historyMode="pagedAccessible"
          onJumpToLatest={noop}
          items={[
            {
              id: `${c.id}-u`,
              kind: "user",
              content: <UserMessage sourceText={t.asked[c.id]} onCopy={noop} />,
            },
            {
              id: `${c.id}-a`,
              kind: "assistant",
              content: (
                <AssistantMessage onCopy={noop}>
                  <Markdown text={t.said[c.id]} />
                </AssistantMessage>
              ),
            },
          ]}
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
        beforeField={next}
      />
    </ConversationFrame>
  );
}

// ---------- The page: keys per direction ----------

let tipShown = [true, true, true];
let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: "fi" | "en" = params.get("lang") === "en" ? "en" : "fi";
let reviewMac =
  params.get("kbd") === "mac" ||
  (params.get("kbd") !== "pc" && /Mac|iPhone|iPad/.test(navigator.platform));
let reviewExplain = false;
const LangContext = React.createContext<"fi" | "en">("fi");
const useLang = () => React.useContext(LangContext);

const plain = (e: KeyboardEvent) => !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
const altArrow = (e: KeyboardEvent, shift: boolean) =>
  e.altKey &&
  !e.ctrlKey &&
  !e.metaKey &&
  e.shiftKey === shift &&
  !e.isComposing &&
  (e.code === "ArrowDown" || e.code === "ArrowUp");
const modK = (e: KeyboardEvent) =>
  (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.code === "KeyK";

function Main({ d, t, k }: { d: number; t: Text; k: Keys }) {
  const navigate = useNavigate();
  const location = useLocation();
  const open = new URLSearchParams(location.search).get("conversation") ?? START;
  const conv = byId(open) ?? byId(START)!;
  const [tip, setTip] = useState(tipShown[d]);
  const [switcher, setSwitcher] = useState(false);
  const [railMode, setRailMode] = useState(false);
  const previous = useRef<string>();
  const shown = useRef(open);
  if (shown.current !== open) {
    previous.current = shown.current;
    shown.current = open;
  }
  const returnTo = useRef<HTMLElement | null>(null);
  const go = (id: string) => {
    const c = byId(id);
    if (!c || id === state.current.open) return;
    // Held keys repeat faster than the view redraws: step from the target.
    state.current.open = id;
    // The conversation's view is new; a person typing stays in the field.
    refocus.current = document.activeElement === field();
    navigate(hrefOf(c));
  };
  const refocus = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once the new conversation is drawn.
  useEffect(() => {
    if (refocus.current) field()?.focus();
    refocus.current = false;
  }, [open]);
  const waiting = WORLD.filter(
    (c) => (c.state === "reply" || c.state === "question") && c.id !== open,
  );
  /** Next or previous waiting for you, cycling, from the open one. */
  const nextWaiting = (dir: 1 | -1) => {
    const ys = yoursOrder();
    if (!ys.length) return undefined;
    const now = state.current.open;
    const at = ys.indexOf(now);
    if (at < 0) return dir === 1 ? ys[0] : ys[ys.length - 1];
    const id = ys[(at + dir + ys.length) % ys.length];
    return id === now ? undefined : id;
  };

  // One window-capture listener per direction: it runs before the composer,
  // the rail and the review picker, and swallows only the keys it uses.
  const state = useRef({ open, switcher, railMode });
  state.current = { open, switcher, railMode };
  useEffect(() => {
    const take = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const step = (from: string, dir: number) => {
      const order = railOrder();
      const at = order.indexOf(from);
      if (at < 0) return order[0];
      return order[Math.min(order.length - 1, Math.max(0, at + dir))];
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const { open: now, switcher: sw, railMode: rail } = state.current;
      const dir = e.code === "ArrowDown" ? 1 : -1;
      if (d === 0) {
        if (altArrow(e, false)) {
          take(e);
          go(step(now, dir) ?? now);
        } else if (altArrow(e, true)) {
          take(e);
          const id = nextWaiting(dir as 1 | -1);
          if (id) go(id);
        }
        return;
      }
      if (d === 1) {
        if (modK(e)) {
          take(e);
          if (sw) setSwitcher(false);
          else {
            returnTo.current = document.activeElement as HTMLElement | null;
            setSwitcher(true);
          }
        } else if (altArrow(e, false) && dir === 1 && !sw) {
          // Today's key, unchanged: the next one waiting for you.
          const id = waiting[0]?.id;
          if (id) {
            take(e);
            go(id);
          }
        }
        return;
      }
      // d === 2: browse the rail first.
      const inRail = (document.activeElement as HTMLElement | null)?.closest(".ah-rail");
      const focused = (document.activeElement as HTMLElement | null)
        ?.closest<HTMLElement>('li[data-testid^="agent-item-"]')
        ?.dataset.testid?.slice("agent-item-".length);
      if (altArrow(e, false)) {
        take(e);
        if (!rail) returnTo.current = document.activeElement as HTMLElement | null;
        const from = inRail && focused ? focused : now;
        const id = step(from, dir) ?? from;
        setRailMode(true);
        railLink(id)?.focus();
      } else if (altArrow(e, true)) {
        take(e);
        const id = nextWaiting(dir as 1 | -1);
        if (id) go(id);
      } else if (rail && inRail && plain(e)) {
        if (e.code === "ArrowDown" || e.code === "ArrowUp") {
          take(e);
          railLink(step(focused ?? now, dir) ?? now)?.focus();
        } else if (e.key === "Home" || e.key === "End") {
          take(e);
          const order = railOrder();
          railLink(e.key === "Home" ? order[0] : order[order.length - 1])?.focus();
        } else if (e.key === "Enter" && focused) {
          take(e);
          setRailMode(false);
          go(focused);
          refocus.current = true;
        } else if (e.key === "Escape") {
          take(e);
          setRailMode(false);
          (returnTo.current?.isConnected ? returnTo.current : field())?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });
  // Rail mode ends when focus leaves the rail by any other way (a press, Tab).
  useEffect(() => {
    if (!railMode) return;
    const out = (e: FocusEvent) => {
      const to = e.relatedTarget as HTMLElement | null;
      if (!to?.closest(".ah-rail")) setRailMode(false);
    };
    document.addEventListener("focusout", out);
    return () => document.removeEventListener("focusout", out);
  }, [railMode]);

  const closeSwitcher = (id?: string) => {
    setSwitcher(false);
    const back = returnTo.current;
    if (id && id !== open && back?.dataset.testid === "message-input") {
      go(id);
      refocus.current = true;
    } else {
      if (id) go(id);
      requestAnimationFrame(() => (back?.isConnected ? back : field())?.focus());
    }
  };

  const nextKey = d === 1 ? k.alt("↓") : k.altShift("↓");
  const next = (
    <NextRow
      waiting={waiting}
      keyLabel={nextKey}
      aria={d === 1 ? "Alt+ArrowDown" : "Alt+Shift+ArrowDown"}
      onStart={() => waiting[0] && go(waiting[0].id)}
    />
  );
  const status = useText(statusText);
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
      now={
        <Sections
          open={open}
          t={t}
          tip={
            tip ? (
              <Tip
                d={d}
                t={t}
                k={k}
                onClose={() => {
                  tipShown = tipShown.map((v, i) => (i === d ? false : v));
                  setTip(false);
                }}
              />
            ) : null
          }
        />
      }
    >
      <WorkspaceNavRow name="kirjanpito" href="/workspaces/kirjanpito" />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/kotisivu" />
      <WorkspaceNavRow name="retkiopas" href="/workspaces/retkiopas" />
    </WorkspaceRail>
  );
  return (
    <StatusBellProvider items={[]}>
      <div className="rk-shell" data-rail-mode={railMode || undefined}>
        <AppShell
          mobileTitle={t.conv[conv.id]}
          rail={rail}
          navigationBadge={WORLD.filter((c) => c.state === "reply" || c.state === "question").length}
          main={
            <div className="rk-main" id="main">
              <Conversation key={conv.id} c={conv} t={t} next={next} />
            </div>
          }
        />
        {railMode ? (
          <p className="rk-rail-band" data-testid="rail-mode" role="status">
            {t.railMode}
          </p>
        ) : null}
        {reviewExplain ? (
          <aside className="rk-explain" data-testid="explain-card">
            <strong>{t.explainHead}</strong>
            <span>{[t.explain1, t.explain2, t.explain3][d](k)}</span>
          </aside>
        ) : null}
      </div>
      {switcher ? (
        <Switcher
          t={t}
          open={open}
          previous={previous.current}
          onPick={(id) => closeSwitcher(id)}
          onClose={() => closeSwitcher()}
        />
      ) : null}
    </StatusBellProvider>
  );
}

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(reviewLanguage);
  const [mac, setMac] = useState(reviewMac);
  const [explain, setExplain] = useState(reviewExplain);
  const bar = useRef<HTMLElement>(null);
  const t = TEXT[language];
  const k = keysFor(mac);
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
    <LangContext.Provider value={language}>
      <div className="rk-review" data-direction={direction}>
        <header className="rk-bar" ref={bar}>
          <div className="rk-controls">
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
                {(["light", "dark", "contrast"] as const).map((v) => (
                  <option key={v} value={v}>
                    {t.themes[v]}
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
              {t.keyboard}{" "}
              <select
                id="keyboard"
                value={mac ? "mac" : "pc"}
                onChange={(e) => {
                  reviewMac = e.target.value === "mac";
                  setMac(reviewMac);
                }}
              >
                <option value="mac">{t.keyboards.mac}</option>
                <option value="pc">{t.keyboards.pc}</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                id="explain"
                checked={explain}
                onChange={(e) => {
                  reviewExplain = e.target.checked;
                  setExplain(reviewExplain);
                }}
              />{" "}
              {t.explainHead}
            </label>
            <span className="rk-try">{t.tryIt}</span>
          </div>
          <ol className="rk-lines" data-testid="direction-lines">
            {t.lines(k).map((l, i) => (
              <li key={i} aria-current={i === direction ? "true" : undefined}>
                {l}
              </li>
            ))}
          </ol>
          <p className="rk-recommend" data-testid="recommendation">
            {t.recommend(k)}
          </p>
        </header>
        <div className="rk-stage">
          <MemoryRouter initialEntries={[`/workspaces/retkiopas?conversation=${START}`]}>
            <Main key={`${direction}-${language}-${mac}-${explain}`} d={direction} t={t} k={k} />
          </MemoryRouter>
        </div>
      </div>
    </LangContext.Provider>
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
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
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
