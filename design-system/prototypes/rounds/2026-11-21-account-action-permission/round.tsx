import React, { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
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
import { Icon } from "../../../../web/src/components/Icon";
import { Markdown } from "../../../../web/src/components/Markdown";
import { AgentHeader, AppShell, WorkspaceNavRow, WorkspaceRail } from "../../../../web/src/components/Navigation";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { statusText } from "../../../../web/src/text/status";
import "../../../../web/src/components/components.css";
import { type IconId, TEXT, type Text } from "./text";
import "./round.css";

// agent-account-instructions-clarity (Jari 21.11.2026): before a delete or a
// calendar share on a connected account, Habitat's tool_call hook pauses the
// call and asks the person through the browser question Habitat already
// shows (Pi's extension_ui_request "confirm"). The round shows that question
// three ways, and five candidates for its icon. Built on production pieces:
// AppShell, the rail, AgentHeader, ConversationFrame and its timeline,
// UserMessage, AssistantMessage, ToolRow and Composer. The question, the
// waiting line and the icons are the round's own.
setPersonalLanguage("fi");

const directions = ["1 Kortti", "2 Kenttä", "3 Työkalurivi"];
const params = new URLSearchParams(location.search);
const noop = () => {};

// ---------- Icon candidates (24 grid, 1.8 stroke, round caps: Icon.tsx) ----------

const ICON_IDS: IconId[] = ["shieldAsk", "keyAsk", "agentAsk", "hand", "personCheck"];
const iconPaths: Record<IconId, ReactNode> = {
  // The settings shield (Icon "shield") with a question for its exclamation.
  shieldAsk: (
    <>
      <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" />
      <path d="M9.9 9.4a2.2 2.2 0 1 1 3.3 1.9c-.8.5-1.2 1-1.2 1.9" />
      <path d="M12 16h.01" />
    </>
  ),
  keyAsk: (
    <>
      <circle cx="7.5" cy="16.5" r="3.5" />
      <path d="m10 14 4.5-4.5m-2 2 2 2" />
      <path d="M15.3 4.6a2.2 2.2 0 1 1 3.3 1.9c-.8.5-1.2 1-1.2 1.9" />
      <path d="M17.4 11.2h.01" />
    </>
  ),
  agentAsk: (
    <>
      <rect x="4" y="7" width="16" height="12" rx="3" />
      <path d="M12 3v4" />
      <path d="M10.2 11.1a1.9 1.9 0 1 1 2.9 1.6c-.7.4-1.1.8-1.1 1.5" />
      <path d="M12 16.7h.01" />
    </>
  ),
  hand: (
    <path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V11m0-.5v-6a1.5 1.5 0 0 1 3 0V11m0-.5V6a1.5 1.5 0 0 1 3 0v8.5a6.5 6.5 0 0 1-6.5 6.5h-.6a5.6 5.6 0 0 1-4.4-2.1l-2.4-3.2a1.5 1.5 0 0 1 2.3-1.9L8 15.5" />
  ),
  personCheck: (
    <>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20c1.1-3.4 3.7-5 6.5-5 1.3 0 2.5.3 3.6.9" />
      <path d="m15 18.2 2 2 4-4.4" />
    </>
  ),
};

function AskIcon({ id, size = 16 }: { id: IconId; size?: number }) {
  return (
    <svg
      className="ap-icon"
      data-icon={id}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[id]}
    </svg>
  );
}

// ---------- The synthetic world ----------

type Decision = "allow" | "deny";
type PermId = "p1" | "p2" | "p3";
type ActionKey = keyof Text["actions"];
const ACTION: Record<PermId, ActionKey> = { p1: "deleteFolder", p2: "shareCalendar", p3: "deleteEvent" };
const TOOL: Record<PermId, { name: string; target: Record<"fi" | "en", string> }> = {
  p1: { name: "delete-mail-folder", target: { fi: "Laskut 2024", en: "Laskut 2024" } },
  p2: { name: "create-calendar-permission", target: { fi: "Perhe → ville.virtanen@contoso.test", en: "Perhe → ville.virtanen@contoso.test" } },
  p3: { name: "delete-calendar-event", target: { fi: "Hammaslääkäri 25.11.", en: "Hammaslääkäri 25 Nov" } },
};
type World = { decisions: Partial<Record<PermId, Decision>>; second: boolean };
const start = (): World => ({ decisions: {}, second: false });

/** The question Pi is waiting on: Pi's confirm is one at a time. */
function openPerm(w: World): PermId | undefined {
  if (!w.decisions.p1) return "p1";
  if (!w.decisions.p2) return "p2";
  if (w.second && !w.decisions.p3) return "p3";
  return undefined;
}
const firstDone = (w: World) => !!w.decisions.p1 && !!w.decisions.p2;

type Step =
  | { k: "user"; id: string; text: string; at: string }
  | { k: "reply"; id: string; text: string; at: string }
  | { k: "tool"; id: string; tool: string; target: string; state: "succeeded" | "blocked" }
  | { k: "perm"; id: PermId };

function steps(w: World, t: Text): Step[] {
  const s: Step[] = [
    { k: "user", id: "u1", text: t.c.ask, at: "9.41" },
    { k: "reply", id: "a1", text: t.c.lead, at: "9.41" },
    ...t.c.tools.map((x, i): Step => ({ k: "tool", id: `t${i}`, tool: x.tool, target: x.target, state: "succeeded" })),
    { k: "perm", id: "p1" },
  ];
  if (w.decisions.p1) s.push({ k: "perm", id: "p2" });
  if (firstDone(w))
    s.push({ k: "reply", id: "a2", text: t.c.final(w.decisions.p1 === "allow", w.decisions.p2 === "allow"), at: "9.43" });
  if (w.second) {
    s.push({ k: "user", id: "u2", text: t.c.ask2, at: "9.45" }, { k: "perm", id: "p3" });
    if (w.decisions.p3) s.push({ k: "reply", id: "a3", text: t.c.final2(w.decisions.p3 === "allow"), at: "9.45" });
  }
  return s;
}

// ---------- Review state ----------

let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: "fi" | "en" = params.get("lang") === "en" ? "en" : "fi";
const LangContext = React.createContext<"fi" | "en">("fi");
const useLang = () => React.useContext(LangContext);
const useT = () => TEXT[useLang()];
const IconContext = React.createContext<IconId>("shieldAsk");

type Act = { decide: (id: PermId, d: Decision) => void };

// ---------- The question's parts, shared by the directions ----------

function Technical({ id }: { id: PermId }) {
  const t = useT();
  const a = t.actions[ACTION[id]];
  return (
    <details className="ap-tech" data-testid="perm-technical">
      <summary>{t.technical}</summary>
      <code>{a.tool}</code>
      <code className="ap-args">{a.args}</code>
    </details>
  );
}

function Answer({ id, act, size = "row" }: { id: PermId; act: Act; size?: "row" | "page" }) {
  const t = useT();
  return (
    <div className="ap-answer">
      <ControlButton size={size} variant="secondary" data-testid="perm-deny" onPress={() => act.decide(id, "deny")}>
        {t.deny}
      </ControlButton>
      <ControlButton size={size} variant="primary" data-testid="perm-allow" onPress={() => act.decide(id, "allow")}>
        {t.allow}
      </ControlButton>
    </div>
  );
}

function Decided({ d }: { d: Decision }) {
  const t = useT();
  return (
    <span className="ap-decided" data-decision={d} data-testid="perm-decided">
      <Icon name={d === "allow" ? "check" : "cross"} />
      {d === "allow" ? t.allowed : t.denied}
    </span>
  );
}

function AccountLine() {
  const t = useT();
  return (
    <span className="ap-account">
      <Icon name="mail" />
      {t.onAccount(t.account, t.provider)}
    </span>
  );
}

/** The whole question: what, on which account, what follows, the answer. */
function Question({ id, act, dock = false }: { id: PermId; act: Act; dock?: boolean }) {
  const t = useT();
  const icon = React.useContext(IconContext);
  const a = t.actions[ACTION[id]];
  return (
    <section className="ap-question" data-dock={dock || undefined} data-testid="perm-question" aria-label={t.asks}>
      <header className="ap-q-head">
        <span className="ap-q-icon">
          <AskIcon id={icon} size={20} />
        </span>
        <span className="ap-q-who">{t.asks}</span>
        <AccountLine />
      </header>
      <h3 className="ap-q-title" data-testid="perm-title">
        {a.title}
      </h3>
      <p className="ap-q-stake">{a.stake}</p>
      <div className="ap-q-foot">
        <Technical id={id} />
        <Answer id={id} act={act} size={dock ? "page" : "row"} />
      </div>
    </section>
  );
}

/** 1 Kortti: the question in the stream; decided, a one-line record. */
function PermCard({ id, w, act }: { id: PermId; w: World; act: Act }) {
  const t = useT();
  const icon = React.useContext(IconContext);
  const d = w.decisions[id];
  if (!d) return <Question id={id} act={act} />;
  return (
    <section className="ap-record" data-testid="perm-record" data-decision={d}>
      <AskIcon id={icon} size={16} />
      <Decided d={d} />
      <span className="ap-record-title">{t.actions[ACTION[id]].title}</span>
      <Technical id={id} />
    </section>
  );
}

/** 2 Kentän paikalla: the stream only marks where the agent stopped. */
function PermLine({ id, w }: { id: PermId; w: World }) {
  const t = useT();
  const icon = React.useContext(IconContext);
  const d = w.decisions[id];
  const title = t.actions[ACTION[id]].title;
  return (
    <div className="ap-line" data-testid="perm-line" data-open={!d || undefined}>
      <AskIcon id={icon} size={16} />
      {d ? (
        <>
          <Decided d={d} />
          <span className="ap-line-text">{title}</span>
        </>
      ) : (
        <span className="ap-line-text">
          <strong>{t.inLine}</strong> · {title}
        </span>
      )}
    </div>
  );
}

/** 3 Työkalurivi: the waiting tool row is the question. */
function PermToolRow({ id, w, act }: { id: PermId; w: World; act: Act }) {
  const t = useT();
  const lang = useLang();
  const icon = React.useContext(IconContext);
  const d = w.decisions[id];
  const [open, setOpen] = useState(false);
  const a = t.actions[ACTION[id]];
  return (
    <div className="ap-toolq" data-testid="perm-toolrow" data-open={!d || undefined} data-decision={d}>
      <span className="ap-toolq-icon">
        <AskIcon id={icon} size={16} />
      </span>
      <ToolRow
        name={TOOL[id].name}
        targetText={TOOL[id].target[lang]}
        statusLabel={!d ? t.c.toolWaiting : d === "allow" ? t.c.toolDone : t.c.toolDenied}
        state={!d ? "running" : d === "allow" ? "succeeded" : "blocked"}
        expanded={!d || open}
        onToggle={() => setOpen((x) => !x)}
      >
        <div className="ap-toolq-body">
          <p className="ap-toolq-title" data-testid="perm-title">
            <strong>{a.title}</strong> <AccountLine />
          </p>
          <p className="ap-q-stake">{a.stake}</p>
          {!d ? <Answer id={id} act={act} /> : <Decided d={d} />}
          <Technical id={id} />
        </div>
      </ToolRow>
    </div>
  );
}

// ---------- The conversation ----------

function Thread({ d, w, act }: { d: number; w: World; act: Act }) {
  const lang = useLang();
  const t = useT();
  const items: { id: string; kind?: string; content: ReactNode }[] = [];
  for (const s of steps(w, t)) {
    if (s.k === "user")
      items.push({
        id: s.id,
        kind: "user",
        content: (
          <UserMessage sourceText={s.text} onCopy={noop} time={s.at}>
            <Markdown text={s.text} />
          </UserMessage>
        ),
      });
    else if (s.k === "reply")
      items.push({
        id: s.id,
        kind: "assistant",
        content: (
          <div data-testid="agent-reply">
            <AssistantMessage streamState="complete" time={s.at} onCopy={noop}>
              <Markdown text={s.text} />
            </AssistantMessage>
          </div>
        ),
      });
    else if (s.k === "tool")
      items.push({
        id: s.id,
        kind: "tool",
        content: (
          <ToolRow
            name={s.tool}
            targetText={s.target}
            statusLabel={s.state === "blocked" ? t.c.toolDenied : t.c.toolDone}
            state={s.state}
            expanded={false}
            onToggle={noop}
          />
        ),
      });
    else {
      const dec = w.decisions[s.id];
      if (d === 2) {
        items.push({ id: s.id, kind: "tool", content: <PermToolRow id={s.id} w={w} act={act} /> });
        continue;
      }
      items.push({
        id: s.id,
        content: d === 0 ? <PermCard id={s.id} w={w} act={act} /> : <PermLine id={s.id} w={w} />,
      });
      // In 1 and 2 the call itself follows the decision as an ordinary tool row.
      if (dec)
        items.push({
          id: `${s.id}-call`,
          kind: "tool",
          content: (
            <ToolRow
              name={TOOL[s.id].name}
              targetText={TOOL[s.id].target[lang]}
              statusLabel={dec === "allow" ? t.c.toolDone : t.c.toolDenied}
              state={dec === "allow" ? "succeeded" : "blocked"}
              expanded={false}
              onToggle={noop}
            />
          ),
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

function Main({ d, w, setW }: { d: number; w: World; setW: React.Dispatch<React.SetStateAction<World>> }) {
  const t = useT();
  const status = useText(statusText);
  const [draft, setDraft] = useState("");
  const pending = openPerm(w);
  const act: Act = { decide: (id, dec) => setW((x) => ({ ...x, decisions: { ...x.decisions, [id]: dec } })) };
  const stream = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const s = stream.current?.querySelector<HTMLElement>('[data-testid="conversation-stream"]');
    if (s) s.scrollTop = s.scrollHeight;
  }, [w, d]);
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
      sessionActions={<AccountShelf profile={{ name: "Aino Virtanen", email: "", avatar_url: "" }} onSettings={noop} onLogout={noop} />}
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
          <div className="ap-main" id="main" data-testid="conversation" data-waiting={pending ? "true" : undefined} ref={stream}>
            <ConversationFrame>
              <AgentHeader
                title={t.convTitle}
                workspaceLabel={t.workspace}
                workspaceHref={`/workspaces/${t.workspace}`}
                activityLabel={pending ? t.waiting : ""}
                activityDetail={pending ? t.actions[ACTION[pending]].title : undefined}
                activityMark={pending ? "waiting" : undefined}
                controlLabel=""
                detailsExpanded={false}
                onToggleDetails={noop}
              />
              <ConversationStream>
                <Thread d={d} w={w} act={act} />
              </ConversationStream>
              {d === 1 && pending ? (
                <div className="ap-dock" data-testid="perm-dock">
                  <Question key={pending} id={pending} act={act} dock />
                </div>
              ) : (
                <Composer
                  value={draft}
                  onChange={setDraft}
                  activity={pending ? "working" : "idle"}
                  selectedWorkingMode="steer"
                  onModeChange={noop}
                  onSendNow={noop}
                  onSteer={noop}
                  onFollowUp={noop}
                  idlePlaceholder={t.composerPlaceholder}
                />
              )}
            </ConversationFrame>
          </div>
        }
      />
    </StatusBellProvider>
  );
}

// ---------- The icon sheet ----------

function IconSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <aside className="ap-sheet" data-testid="icon-sheet" aria-label={t.sheetTitle}>
      <header>
        <h2>{t.sheetTitle}</h2>
        <button type="button" className="ra-event" data-testid="icon-sheet-close" onClick={onClose}>
          ✕
        </button>
      </header>
      <p className="ap-sheet-lead">{t.sheetLead}</p>
      <div className="ap-sheet-grid">
        {ICON_IDS.map((id) => (
          <section key={id} className="ap-cand" data-testid="icon-candidate" data-icon={id} data-recommended={id === "shieldAsk" || undefined}>
            <h3>
              {t.icons[id].name}
              {id === "shieldAsk" ? <span className="ap-badge">{t.recommended}</span> : null}
            </h3>
            <div className="ap-sizes">
              {[16, 20, 24].map((s) => (
                <figure key={s}>
                  <AskIcon id={id} size={s} />
                  <figcaption>{s}</figcaption>
                </figure>
              ))}
              <figure className="ap-neighbours">
                <span>
                  <Icon name="shield" width={16} height={16} />
                  <Icon name="mail" width={16} height={16} />
                  <AskIcon id={id} size={16} />
                  <Icon name="calendar" width={16} height={16} />
                  <Icon name="trash" width={16} height={16} />
                </span>
                <figcaption>16 · shield, mail, ?, calendar, trash</figcaption>
              </figure>
            </div>
            <div className="ap-contexts">
              <div className="ap-line" data-open>
                <AskIcon id={id} size={16} />
                <span className="ap-line-text">
                  <strong>{t.inLine}</strong> · {t.actions.deleteFolder.title}
                </span>
              </div>
              <div className="ap-q-head">
                <span className="ap-q-icon">
                  <AskIcon id={id} size={20} />
                </span>
                <span className="ap-q-who">{t.asks}</span>
              </div>
              <div className="ap-headerchip">
                <HabitatMark size={16} state="waiting" />
                <span>{t.waiting}</span>
                <AskIcon id={id} size={16} />
              </div>
            </div>
            <p className="ap-why">{t.icons[id].why}</p>
          </section>
        ))}
      </div>
    </aside>
  );
}

// ---------- Review page ----------

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(reviewLanguage);
  const [icon, setIcon] = useState<IconId>((params.get("icon") as IconId) || "shieldAsk");
  const [sheet, setSheet] = useState(params.get("sheet") === "1");
  const t = TEXT[language];
  const [w, setW] = useState(start);
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
  return (
    <LangContext.Provider value={language}>
      <IconContext.Provider value={icon}>
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
                    setW(start());
                    setRun((r) => r + 1);
                  }}
                >
                  <option value="fi">suomi</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label>
                {t.iconLabel}{" "}
                <select id="icon" value={icon} onChange={(e) => setIcon(e.target.value as IconId)}>
                  {ICON_IDS.map((id) => (
                    <option key={id} value={id}>
                      {t.icons[id].name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="ra-event" data-testid="icon-sheet-open" aria-pressed={sheet} onClick={() => setSheet((x) => !x)}>
                {t.sheetTitle}
              </button>
              <span className="ra-hint">{t.hint}</span>
              <button
                type="button"
                className="ra-event"
                data-testid="event-again"
                disabled={!firstDone(w) || w.second}
                onClick={() => setW((x) => ({ ...x, second: true }))}
              >
                {t.again}
              </button>
              <button
                type="button"
                className="ra-event"
                data-testid="event-reset"
                onClick={() => {
                  setW(start());
                  setRun((r) => r + 1);
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
            <MemoryRouter key={run} initialEntries={[`/workspaces/${t.workspace}?conversation=siivous`]}>
              <Main key={`${direction}-${language}-${run}`} d={direction} w={w} setW={setW} />
            </MemoryRouter>
          </div>
          {sheet ? <IconSheet onClose={() => setSheet(false)} /> : null}
        </div>
      </IconContext.Provider>
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
