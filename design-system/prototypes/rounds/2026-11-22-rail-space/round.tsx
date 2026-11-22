import React, { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import type { Workspace } from "../../../../web/src/app/snapshot";
import type { BrowserStatus, BrowserSummary } from "../../../../web/src/app/serverBrowser";
import { AccountIdentity, AccountShelf } from "../../../../web/src/components/Account";
import { AssistantMessage, ConversationTimeline, UserMessage } from "../../../../web/src/components/Conversation";
import { ConversationFrame, ConversationStream } from "../../../../web/src/components/ConversationFrame";
import { LinkRow } from "../../../../web/src/components/ControlElements";
import { Icon } from "../../../../web/src/components/Icon";
import { Markdown } from "../../../../web/src/components/Markdown";
import {
  AgentHeader,
  type AgentNavModel,
  AppShell,
  NowSections,
  WorkspaceNavRow,
  WorkspaceRail,
} from "../../../../web/src/components/Navigation";
import { Menu } from "../../../../web/src/components/Overlays";
import { RefreshIconButton } from "../../../../web/src/components/Primitives";
import { QuietSection } from "../../../../web/src/components/QuietSection";
import { BrowserChip, BrowserRailRow } from "../../../../web/src/components/ServerBrowser";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { SearchDoor } from "../../../../web/src/components/Switcher";
import { WorkspaceActions } from "../../../../web/src/components/WorkspaceActions";
import type { WorkspaceIconModel } from "../../../../web/src/components/WorkspaceIcon";
import { Composer } from "../../../../web/src/components/composer/Composer";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { accountText } from "../../../../web/src/text/account";
import { agentResourcesText } from "../../../../web/src/text/agentResources";
import { navigationText } from "../../../../web/src/text/navigation";
import { serverBrowserText } from "../../../../web/src/text/serverBrowser";
import { sharesText } from "../../../../web/src/text/shares";
import { statusText } from "../../../../web/src/text/status";
import { switcherText } from "../../../../web/src/text/switcher";
import "../../../../web/src/components/components.css";
import { ROWS_1280, TEXT, type Text, TITLES, WORKSPACES } from "./text";
import "./round.css";

// rail-space-small-screens (Jari 22.11.2026, from a laptop): the rail's fixed
// top block (Etusivu, Tuotokset, Oma selain, Agentin käytössä) and the search
// door take about the top half of a 764 px rail, so Sinun vuorosi, Käynnissä
// and Työtilat get a few rows each. The round asks where each of those items
// could live instead. The rail and the conversation are production
// components (WorkspaceRail, NowSections, QuietSection, WorkspaceNavRow,
// SearchDoor, BrowserRailRow, BrowserChip, AccountShelf, AgentHeader,
// Composer); round-own are A's icon row, B's title-row search and person
// menu entries, C's tile group and its one-scroll CSS, and the Työtilat
// heading's refresh and filter icons. Direction 4 is today's rail.
setPersonalLanguage("fi");

const params = new URLSearchParams(location.search);
const bare = params.has("bare");
if (bare) document.documentElement.toggleAttribute("data-bare", true);

// ---------- The synthetic world ----------

type State = "reply" | "question" | "working" | "idle";
type Conv = { id: string; n: number; ws: string; state: State; age: number; worktree?: boolean };
type WorldKind = "ordinary" | "like" | "crowded";
type World = { convs: Conv[]; workspaces: string[] };
const EMOJI = ["🗺️", "📒", "🏠", "🧾", "📦", "🛒", "📰", "🧪", "📊", "🔧", "🎨", "📷", "🗓️", "🍲"];
const SIZES: Record<WorldKind, { yours: number; running: number; quiet: number; ws: number }> = {
  ordinary: { yours: 4, running: 2, quiet: 12, ws: 18 },
  like: { yours: 3, running: 0, quiet: 5, ws: 6 },
  crowded: { yours: 6, running: 4, quiet: 30, ws: 40 },
};
/** Past this many workspaces A shows Työtilat's filter field. */
const FILTER_FROM = 12;

function world(kind: WorldKind): World {
  const s = SIZES[kind];
  const workspaces = Array.from({ length: s.ws }, (_, i) => WORKSPACES[Math.floor((i * WORKSPACES.length) / s.ws)]);
  const convs: Conv[] = [];
  let n = 0;
  const add = (count: number, state: State | "yours") => {
    for (let i = 0; i < count; i++, n++)
      convs.push({
        id: `c${n}`,
        n,
        ws: workspaces[(n * 7 + 3) % workspaces.length],
        state: state === "yours" ? (n % 2 ? "question" : "reply") : state,
        age: state === "working" ? 1 + n : n * n * 3 + 5,
        worktree: [7, 9, 13, 20, 27].includes(n),
      });
  };
  add(s.yours, "yours");
  add(s.running, "working");
  add(s.quiet, "idle");
  return { convs, workspaces };
}
const NOW0 = Date.now();
const hrefOf = (c: Conv) => `/workspaces/${c.ws}?conversation=${c.id}`;

function iconOf(name: string): WorkspaceIconModel {
  const i = WORKSPACES.indexOf(name);
  const letters = name.split("-").slice(0, 2).map((p) => p[0]).join("").toLocaleUpperCase("fi");
  return i % 3 === 0
    ? { name, glyph: { letters, hue: (i * 47) % 360 }, show: { kind: "emoji", value: EMOJI[i % EMOJI.length] }, source: "config", where: ".open-habitat.yaml" }
    : { name, glyph: { letters, hue: (i * 47) % 360 }, show: { kind: "glyph" }, source: "derived" };
}

type Words = ReturnType<typeof useText<typeof statusText>>["rail"];
function model(c: Conv, open: string, lang: "fi" | "en", s: Words): AgentNavModel {
  const label = c.state === "working" ? s.working : c.state === "reply" ? s.newReply : c.state === "question" ? s.asks : "";
  return {
    agentId: c.id,
    href: hrefOf(c),
    title: TITLES[c.n % TITLES.length][lang === "fi" ? 0 : 1],
    workspaceId: c.ws,
    workspaceName: c.ws,
    workspaceIcon: iconOf(c.ws),
    changedAt: NOW0 - c.age * 60000,
    activity: c.state === "working" ? "working" : "waiting",
    activityLabel: label,
    attentionLabel: c.state === "reply" ? s.newReply : undefined,
    question: c.state === "question",
    controlLabel: "",
    detail: [c.ws, label].filter(Boolean).join(" · "),
    selected: c.id === open,
    worktree: c.worktree ? { merged: false, work: { text: lang === "fi" ? "2 muutosta" : "2 changes", tone: "work" } } : undefined,
  };
}

// ---------- Oma selain: a synthetic status for production's row and chip ----------

type BrowserKind = "idle" | "ask";
function browserOf(kind: BrowserKind, lang: "fi" | "en"): { status: BrowserStatus; summary: BrowserSummary } {
  const windows = [{ id: "w1", title: lang === "fi" ? "Kirjanpito" : "Ledger", origin: "https://kirjanpito.example", agent: true }];
  const request = kind === "ask"
    ? { window: "w1", text: lang === "fi" ? "Vahvista kirjautuminen" : "Confirm the sign-in", age_ms: 20000 }
    : undefined;
  const status: BrowserStatus = { schema_version: 1, state: "running", survives_restart: true, control: "agent", agent_connected: false, windows, request };
  return { status, summary: request ? { kind: "ask", window: windows[0], text: request.text } : { kind: "idle" } };
}

// ---------- Toast: where a press would lead ----------

let toast: (s: string) => void = () => {};
function Toast() {
  const [text, setText] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  toast = (s) => {
    setText(s);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(""), 1800);
  };
  return text ? <div className="rsp-toast" role="status" data-testid="toast">{text}</div> : null;
}
const goes = (lang: "fi" | "en", where: string) => toast(lang === "fi" ? `Avaisi: ${where}` : `Would open: ${where}`);

// ---------- A: the icon row ----------

type Dest = { id: string; icon: "home" | "globe" | "link" | "user" | "shield" | "search"; label: string; badge?: string; dot?: "ask" | "idle"; current?: boolean };
function destinations(lang: "fi" | "en", browser: BrowserKind, home: boolean) {
  const nav = TEXT[lang];
  return {
    nav,
    home: { id: "home", icon: "home", label: lang === "fi" ? "Etusivu" : "Home", current: home } as Dest,
    // Production gives Tuotokset and Oma selain the same globe; as bare icons
    // they would be told apart only by their tooltips, so Tuotokset gets the link.
    shares: { id: "shares", icon: "link", label: lang === "fi" ? "Tuotokset" : "Outputs", badge: "1" } as Dest,
    browser: { id: "browser", icon: browser === "ask" ? "user" : "globe", label: lang === "fi" ? "Oma selain" : "Your browser", dot: browser } as Dest,
    resources: { id: "resources", icon: "shield", label: lang === "fi" ? "Agentin käytössä" : "Agent resources" } as Dest,
  };
}

function Dock({ lang, browser, home }: { lang: "fi" | "en"; browser: BrowserKind; home: boolean }) {
  const d = destinations(lang, browser, home);
  const bt = useText(serverBrowserText);
  const sw = useText(switcherText);
  const state = browser === "ask" ? bt.state.ask ?? "" : `${bt.state.idle} · ${bt.windows(1)}`;
  const items: (Dest & { tip: string })[] = [
    { ...d.home, tip: d.home.label },
    { ...d.shares, tip: `${d.shares.label} · 1` },
    { ...d.browser, tip: `${d.browser.label} · ${state}` },
    { ...d.resources, tip: d.resources.label },
    { id: "search", icon: "search", label: sw.door, tip: TEXT[lang].searchKey("Ctrl+K") },
  ];
  return (
    <div className="rsp-dock" role="toolbar" aria-label={lang === "fi" ? "Sivut ja haku" : "Pages and search"} data-testid="rsp-dock">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className="rsp-dock-item"
          data-testid={`rsp-dock-${it.id}`}
          aria-label={it.tip}
          title={it.tip}
          aria-current={it.current ? "page" : undefined}
          aria-keyshortcuts={it.id === "search" ? "Meta+K Control+K" : undefined}
          onClick={() => goes(lang, it.label)}
        >
          <Icon name={it.icon} />
          {it.badge ? <span className="rsp-badge">{it.badge}</span> : null}
          {it.dot ? <span className="rsp-dot" data-state={it.dot} /> : null}
        </button>
      ))}
    </div>
  );
}

// ---------- C: the fixed items as the list's first group ----------

function Group({ lang, browser, home }: { lang: "fi" | "en"; browser: BrowserKind; home: boolean }) {
  const d = destinations(lang, browser, home);
  const bt = useText(serverBrowserText);
  const t = TEXT[lang];
  const [open, setOpen] = useState(true);
  const tiles: (Dest & { small?: string })[] = [
    d.home,
    d.shares,
    { ...d.browser, small: browser === "ask" ? bt.state.ask ?? "" : bt.state.idle },
    d.resources,
  ];
  return (
    <section className="rsp-group" data-testid="rsp-group" data-open={open || undefined}>
      <button type="button" className="rsp-group-head" aria-expanded={open} data-testid="rsp-group-toggle" onClick={() => setOpen((x) => !x)}>
        <span>{t.group}</span>
        <Icon name={open ? "down" : "forward"} />
      </button>
      {open ? (
        <div className="rsp-tiles">
          {tiles.map((it) => (
            <button
              key={it.id}
              type="button"
              className="rsp-tile"
              data-testid={`rsp-tile-${it.id}`}
              aria-current={it.current ? "page" : undefined}
              data-state={it.dot}
              onClick={() => goes(lang, it.label)}
            >
              <Icon name={it.icon} />
              <span className="rsp-tile-text">
                <b>{it.label}{it.badge ? <span className="rsp-badge rsp-badge-inline">{it.badge}</span> : null}</b>
                {it.small ? <small>{it.small}</small> : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

// ---------- B: the person menu gains the destinations ----------

function PersonMenuB({ lang, browser }: { lang: "fi" | "en"; browser: BrowserKind }) {
  const a = useText(accountText);
  const bt = useText(serverBrowserText);
  const d = destinations(lang, browser, false);
  const person = { name: "Esimerkki Käyttäjä", email: "", avatar_url: "" };
  return (
    <div className="ah-account-shelf" data-account-controls>
      <Menu
        label={a.accountMenu}
        triggerLabel={a.accountMenuOf("Esimerkki")}
        triggerPresentation="account"
        triggerTestId="rsp-person-menu"
        trigger={<span className="ah-account-trigger"><AccountIdentity profile={person} compact /></span>}
        heading={<AccountIdentity profile={person} />}
        popoverClassName="ah-account-menu"
        placement="top start"
        items={[
          { id: "shares", label: `${d.shares.label} · 1`, group: "pages" },
          { id: "resources", label: d.resources.label, group: "pages" },
          { id: "browser", label: `${d.browser.label} · ${browser === "ask" ? bt.state.ask ?? "" : bt.state.idle}`, group: "pages" },
          { id: "settings", label: a.settings },
          { id: "logout", label: a.logout, danger: true },
        ]}
        onAction={(id) => goes(lang, id)}
      />
    </div>
  );
}

// ---------- Portals into production's rail: title row and Työtilat heading ----------

function usePortalTarget(selector: string, deps: unknown[]) {
  const [el, setEl] = useState<Element | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-found when the rail is redrawn.
  useLayoutEffect(() => {
    setEl(document.querySelector(selector));
  }, deps);
  return el;
}

function HeadTools({ d, lang, filterOpen, onFilterToggle }: { d: number; lang: "fi" | "en"; filterOpen: boolean; onFilterToggle: () => void }) {
  const head = usePortalTarget(".ah-rail-workspaces > .ah-rail-section-head", [d]);
  const title = usePortalTarget(".ah-rail-title", [d]);
  const t = TEXT[lang];
  return (
    <>
      {head && d !== 3
        ? createPortal(
            <span className="rsp-head-tools" data-testid="rsp-head-tools">
              {d === 1 ? (
                <button type="button" className="rsp-icon" aria-label={t.filterOpen} title={t.filterOpen} aria-expanded={filterOpen} data-testid="rsp-filter-toggle" onClick={onFilterToggle}>
                  <Icon name="search" />
                </button>
              ) : null}
              <span className="rsp-refresh" title={t.refresh}><RefreshIconButton onPress={() => goes(lang, t.refresh)} /></span>
            </span>,
            head,
          )
        : null}
      {title && d === 1
        ? createPortal(
            <button type="button" className="rsp-icon rsp-title-search" data-testid="rsp-title-search" aria-label={t.searchKey("Ctrl+K")} title={t.searchKey("Ctrl+K")} aria-keyshortcuts="Meta+K Control+K" onClick={() => goes(lang, t.searchKey("Ctrl+K"))}>
              <Icon name="search" />
            </button>,
            title,
          )
        : null}
    </>
  );
}

// ---------- The open conversation: production pieces ----------

const noop = () => {};
function Conversation({ title, ws, working, t, browser, lang }: { title: string; ws: string; working: boolean; t: Text; browser: BrowserKind; lang: "fi" | "en" }) {
  const s = useText(statusText);
  const [draft, setDraft] = useState("");
  const b = browserOf(browser, lang);
  return (
    <ConversationFrame>
      <AgentHeader
        title={title}
        activityLabel={working ? s.rail.working : s.rail.newReply}
        activityKind={working ? "working" : "unknown"}
        activityAnimated={working}
        controlLabel=""
        controlKind="neutral"
        workspaceLabel={ws}
        workspaceHref={`/workspaces/${ws}`}
        detailsExpanded={false}
        onToggleDetails={noop}
      />
      <ConversationStream label={title}>
        <ConversationTimeline
          state="ready"
          historyMode="pagedAccessible"
          onJumpToLatest={noop}
          items={[
            { id: "u", kind: "user", content: <UserMessage sourceText={t.asked} onCopy={noop} /> },
            { id: "a", kind: "assistant", content: <AssistantMessage onCopy={noop}><Markdown text={t.said} /></AssistantMessage> },
          ]}
        />
      </ConversationStream>
      <div className="sb-dock" data-testid="browser-dock">
        <BrowserChip status={b.status} summary={b.summary} open={false} onToggle={() => goes(lang, t.browser)} onStart={noop} />
      </div>
      <Composer
        value={draft}
        onChange={setDraft}
        activity={working ? "working" : "idle"}
        selectedWorkingMode="steer"
        onModeChange={noop}
        onSendNow={noop}
        onSteer={noop}
        onFollowUp={noop}
        csrf="prototype"
      />
    </ConversationFrame>
  );
}

// ---------- The page ----------

let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: "fi" | "en" = params.get("lang") === "en" ? "en" : "fi";
let reviewWorld: WorldKind = (["ordinary", "like", "crowded"] as const).find((w) => w === params.get("world")) ?? "ordinary";
let reviewBrowser: BrowserKind = params.get("browser") === "ask" ? "ask" : "idle";
const FRAMES = ["1280x720", "1440x800", "1920x1080", "window"];
let reviewFrame = FRAMES.includes(params.get("frame") ?? "") ? (params.get("frame") as string) : bare ? "window" : "1280x720";

function Main({ d, t, lang, w, browser }: { d: number; t: Text; lang: "fi" | "en"; w: World; browser: BrowserKind }) {
  const location = useLocation();
  const first = w.convs.find((c) => c.state === "working") ?? w.convs[0];
  const open = new URLSearchParams(location.search).get("conversation") ?? first.id;
  const conv = w.convs.find((c) => c.id === open) ?? first;
  const s = useText(statusText).rail;
  const sw = useText(switcherText);
  const status = useText(statusText);
  const nav = useText(navigationText);
  const shares = useText(sharesText);
  const resources = useText(agentResourcesText);
  // Hiljaiset folds itself while the rail is crowded, as in production
  // (WorkspaceRailView), until the person folds or opens it. C has no
  // regions to crowd: it starts folded there, as a crowded rail would.
  const [choice, setChoice] = useState<boolean | undefined>(d === 2 ? true : undefined);
  const [crowded, setCrowded] = useState(false);
  const folded = choice ?? crowded;
  const [filter, setFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const rows = w.convs.map((c) => ({ c, m: model(c, conv.id, lang, s) }));
  const yours = rows.filter((r) => r.c.state === "reply" || r.c.state === "question").map((r) => r.m);
  const running = rows.filter((r) => r.c.state === "working").map((r) => r.m);
  const quiet = rows.filter((r) => r.c.state === "idle").map((r) => r.m);
  const listed = w.workspaces.map((n) => ({ id: n, name: n, icon: iconOf(n) }));
  const b = browserOf(browser, lang);
  const browserRow = <BrowserRailRow summary={b.summary} windows={1} onOpen={() => goes(lang, t.browser)} />;
  const homeRow = (testid: string, href: string, icon: "globe" | "shield", label: string) => (
    <div className="ah-rail-home-row">
      <LinkRow href={href} data-testid={testid} kind="home" className="ah-rail-home">
        <Icon name={icon} />
        <span className="ah-rail-home-label">{label}</span>
      </LinkRow>
    </div>
  );
  // What the rail's head carries under the server's name, by direction.
  const pages =
    d === 3 ? (
      <>
        {homeRow("rail-shares", "/shares", "globe", `${shares.title} 1`)}
        {browserRow}
        {homeRow("rail-resources", "/resources", "shield", resources.railLabel)}
      </>
    ) : d === 0 ? (
      <>
        <Dock lang={lang} browser={browser} home={false} />
        {browser === "ask" ? browserRow : null}
      </>
    ) : d === 1 ? (
      browser === "ask" ? browserRow : null
    ) : null;
  const search =
    d === 3 ? (
      <SearchDoor label={sw.door} keyHint="Ctrl+K" onOpen={() => goes(lang, sw.door)} />
    ) : d === 2 ? (
      <>
        <Group lang={lang} browser={browser} home={false} />
        <div className="rsp-sticky-search">
          <SearchDoor label={sw.door} keyHint="Ctrl+K" onOpen={() => goes(lang, sw.door)} />
        </div>
      </>
    ) : null;
  const filterShown = d === 0 ? w.workspaces.length > FILTER_FROM : d === 1 ? filterOpen || !!filter : true;
  const shown = w.workspaces.filter((n) => n.includes(filter.toLocaleLowerCase()));

  const rail = (
    <WorkspaceRail
      collapsed={false}
      serverLabel="Habitat"
      connectionLabel={status.connected}
      connectionTone="success"
      homeCurrent={false}
      pages={pages}
      search={search}
      filterValue={filter}
      resultSummary={`${shown.length}`}
      listState={shown.length ? "ready" : "filtered-empty"}
      onToggle={noop}
      onFilter={setFilter}
      onRefresh={noop}
      onCreateWorkspace={noop}
      crowding={d === 2 ? undefined : { quietRows: quiet.length, onChange: setCrowded }}
      sessionActions={
        d === 1 ? (
          <PersonMenuB lang={lang} browser={browser} />
        ) : (
          <AccountShelf profile={{ name: "Esimerkki Käyttäjä", email: "", avatar_url: "" }} onSettings={noop} onLogout={noop} />
        )
      }
      now={
        <NowSections
          yours={yours}
          running={running}
          workspaces={listed}
          quiet={
            <QuietSection
              rows={quiet}
              workspaces={listed}
              choice={{ sort: "newest", workspace: null }}
              folded={folded}
              onFold={setChoice}
            />
          }
        />
      }
    >
      {shown.map((n) => (
        <WorkspaceNavRow
          key={n}
          name={n}
          href={`/workspaces/${n}`}
          icon={iconOf(n)}
          selected={n === conv.ws && false}
          workspaceMenu={
            <WorkspaceActions
              workspace={{ workspace_id: n, name: n, kind: "git_main_worktree", visibility: "visible" } as unknown as Workspace}
              onNew={noop}
              rail
            />
          }
        />
      ))}
    </WorkspaceRail>
  );
  const title = TITLES[conv.n % TITLES.length][lang === "fi" ? 0 : 1];
  void nav;
  return (
    <StatusBellProvider items={[]}>
      <div className="rsp-shell" data-direction={d} data-filter={filterShown ? "shown" : "hidden"}>
        <AppShell
          mobileTitle={title}
          rail={rail}
          navigationBadge={yours.length}
          main={
            <div className="rsp-main" id="main">
              <Conversation key={conv.id} title={title} ws={conv.ws} working={conv.state === "working"} t={t} browser={browser} lang={lang} />
            </div>
          }
        />
      </div>
      <HeadTools d={d} lang={lang} filterOpen={filterShown} onFilterToggle={() => setFilterOpen((x) => !x)} />
      <Toast />
    </StatusBellProvider>
  );
}

function Places({ t, d }: { t: Text; d: number }) {
  return (
    <details className="rsp-places" data-testid="rsp-places" open>
      <summary>{t.places}</summary>
      <table>
        <tbody>
          {t.placesByDirection[d].map(([item, where]) => (
            <tr key={item}>
              <th scope="row">{item}</th>
              <td>{where}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(reviewLanguage);
  const [kind, setKind] = useState(reviewWorld);
  const [frame, setFrame] = useState(reviewFrame);
  const [browser, setBrowser] = useState(reviewBrowser);
  const bar = useRef<HTMLElement>(null);
  const t = TEXT[language];
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el || bare) return;
    const set = () => document.documentElement.style.setProperty("--review-h", `${el.getBoundingClientRect().height}px`);
    set();
    const o = new ResizeObserver(set);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = language;
  }, [theme, language]);
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    if (frame === "window") {
      root.removeProperty("--frame-w");
      root.removeProperty("--frame-h");
    } else {
      const [fw, fh] = frame.split("x");
      root.setProperty("--frame-w", `${fw}px`);
      root.setProperty("--frame-h", `${fh}px`);
    }
    document.documentElement.toggleAttribute("data-framed", frame !== "window");
  }, [frame]);
  // Picker labels follow the language.
  useEffect(() => {
    document.querySelectorAll(".proto-picker-item").forEach((b, i) => {
      b.textContent = t.pickerNames[i];
    });
  }, [t]);
  const w = world(kind);
  const select = <V extends string>(id: string, label: string, value: V, options: [V, string][], set: (v: V) => void) => (
    <label>
      {label}{" "}
      <select id={id} value={value} onChange={(e) => set(e.target.value as V)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
  const first = w.convs.find((c) => c.state === "working") ?? w.convs[0];
  return (
    <div className="rsp-review" data-direction={direction} data-world={kind}>
      {bare ? null : (
        <header className="rsp-bar" ref={bar}>
          <div className="rsp-controls">
            <strong>{t.title}</strong>
            {select("world", t.world, kind, (Object.keys(t.worlds) as WorldKind[]).map((k) => [k, t.worlds[k]]), (v) => { reviewWorld = v; setKind(v); })}
            {select("frame", t.frame, frame, FRAMES.map((f) => [f, f === "window" ? t.frames.window : f.replace("x", " × ")]), (v) => { reviewFrame = v; setFrame(v); })}
            {select("browser", t.browser, browser, [["idle", t.browsers.idle], ["ask", t.browsers.ask]], (v) => { reviewBrowser = v; setBrowser(v); })}
            {select("theme", t.theme, theme, (["light", "dark", "contrast"] as const).map((v) => [v, t.themes[v]]), (v) => { reviewTheme = v; setTheme(v); })}
            {select("language", t.language, language, [["fi", "suomi"], ["en", "English"]], (v) => { reviewLanguage = v; setPersonalLanguage(v); setLanguage(v); })}
          </div>
          <ol className="rsp-lines" data-testid="direction-lines">
            {t.lines.map((l, i) => (
              <li key={i} aria-current={i === direction ? "true" : undefined}>
                {l}
                {i < 3 ? <b className="rsp-count"> {t.rows(ROWS_1280[i], ROWS_1280[3])}</b> : null}
              </li>
            ))}
          </ol>
          <p className="rsp-recommend" data-testid="recommendation">{t.recommend}</p>
          <Places t={t} d={direction} />
        </header>
      )}
      <div className="rsp-stage">
        <MemoryRouter initialEntries={[`/workspaces/${first.ws}?conversation=${first.id}`]}>
          <Main key={`${direction}-${language}-${kind}`} d={direction} t={t} lang={language} w={w} browser={browser} />
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
const NAMES = TEXT[reviewLanguage].pickerNames;
const start = Math.max(0, Math.min(3, Number(params.get("d") ?? 0) || 0));
const variants = NAMES.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement("nav");
picker.className = "proto-picker";
picker.setAttribute("aria-label", "Prototype variants");
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
NAMES.forEach((n, i) => {
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
if (start) (picker.querySelectorAll(".proto-picker-item")[start] as HTMLElement).click();
