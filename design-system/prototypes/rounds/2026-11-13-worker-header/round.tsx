import React, {
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import { AccountShelf } from "../../../../web/src/components/Account";
import {
  ContextRing,
  type ContextUsage,
  contextSentence,
  Ring,
} from "../../../../web/src/components/ContextRing";
import { ConversationTimeline } from "../../../../web/src/components/Conversation";
import {
  ConversationFrame,
  ConversationStream,
} from "../../../../web/src/components/ConversationFrame";
import {
  ControlButton,
  controlClassName,
} from "../../../../web/src/components/ControlElements";
import {
  type GitDetailFacts,
  GitStatusChip,
  GitStatusDetails,
  type GitSummaryFacts,
} from "../../../../web/src/components/GitStatus";
import { Icon } from "../../../../web/src/components/Icon";
import { Markdown } from "../../../../web/src/components/Markdown";
import type { ModelChoice } from "../../../../web/src/components/ModelPicker";
import {
  modelDisplayName,
  thinkingDisplayName,
} from "../../../../web/src/components/modelPresentation";
import {
  AgentHeader,
  AgentNavItem,
  type AgentNavModel,
  AppShell,
  WorkspaceNavRow,
  WorkspaceRail,
} from "../../../../web/src/components/Navigation";
import {
  WorkerBrief,
  WorkerVoice,
} from "../../../../web/src/components/Spinoffs";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { spinoffsText } from "../../../../web/src/text/spinoffs";
import "../../../../web/src/components/components.css";
import { TEXT, type Text } from "./text";
import "./round.css";

// proto-worker-header-status, round 1. Jari 13.11.2026: the worker view's
// header should carry the same at-a-glance facts a conversation's header
// has, as buttons: Git changes (opening the changes), context fill (the
// ring) and the model, read-only where the browser cannot change the worker.
// The two directions differ only in where those buttons sit. The pieces
// are production's: the band's classes, AgentHeader and its existing
// gitStatus / contextIndicator / modelPicker slots, GitStatusChip with
// GitStatusDetails, and ContextRing. Only the honest "unknown" chips are
// the round's own, built from the same ControlButton, Ring and classes.
setPersonalLanguage("fi");

const directions = ["Otsikkorivillä", "Nauhassa"];
type CaseId = "alussa" | "pr" | "lukematon";
const params = new URLSearchParams(location.search);

// ---------- Synthetic workers ----------

type Worker = {
  harness: "claude" | "pi";
  profile: string;
  title: string;
  state: string;
  working: boolean;
  runId: string;
  branch: string;
  source: string;
  worktree: string;
  /** Git against the source branch; undefined when Git could not answer. */
  git?: GitDetailFacts;
  pr?: {
    number: number;
    state: "open" | "draft";
    checks: [number, number, number];
  };
  /** Pi's / Claude Code's recorded usage; undefined when unknown. */
  context?: ContextUsage;
  model?: string;
  thinking?: string;
  history: boolean;
};

const CATALOG: ModelChoice[] = [
  {
    id: "claude-opus-5-5",
    name: "Claude Opus 5.5",
    provider: "anthropic",
    context_window: 1_000_000,
  },
  {
    id: "gpt-5.5",
    name: "GPT-5.5",
    provider: "openai-codex",
    context_window: 400_000,
    compaction_reserve_tokens: 16_384,
  },
];

const T = Math.floor(Date.UTC(2026, 10, 13, 9, 40) / 1000);
const base = (ahead: number) => ({
  name: "main",
  ref: "main",
  source: "recorded" as const,
  ahead,
  behind: 0,
  merged: false,
});
const WORKERS: Record<CaseId, Worker> = {
  alussa: {
    harness: "claude",
    profile: "prototype-opus",
    title: "Brändikierros: teemat ja tilamerkki oikeassa käyttöliittymässä",
    state: "Työskentelee",
    working: true,
    runId: "01m7examplerun0000000alussa",
    branch: "wt/k3x-brand-round",
    source: "main",
    worktree: "~/src/retkiopas__worktrees/wt-k3x-brand-round",
    git: {
      branch: "wt/k3x-brand-round",
      dirty_count: 0,
      base: base(0),
      files: [],
      files_truncated: false,
      commits: [],
      commits_available: true,
    },
    context: {
      phase: "known",
      tokens: 86_400,
      window: 1_000_000,
      model: "Opus 5.5",
    },
    model: "claude-opus-5-5",
    history: true,
  },
  pr: {
    harness: "pi",
    profile: "pi-codex",
    title: "Reittihaun korkeuserot karttanäkymään",
    state: "Työskentelee",
    working: true,
    runId: "01m7examplerun000000000000pr",
    branch: "wt/q8n-elevation",
    source: "main",
    worktree: "~/src/retkiopas__worktrees/wt-q8n-elevation",
    git: {
      branch: "wt/q8n-elevation",
      dirty_count: 2,
      base: base(3),
      files: [
        { status: "M", path: "src/kartta/korkeus.ts", added: 41, deleted: 6 },
        { status: "??", path: "src/kartta/profiili.tsx", added: 88 },
      ],
      files_truncated: false,
      commits: [
        {
          hash: "a1c9e02",
          subject: "kartta: korkeusprofiili reitin alle",
          timestamp: T - 600,
          pushed: true,
        },
        {
          hash: "77be310",
          subject: "reitit: nousu ja lasku haun tulokseen",
          timestamp: T - 1900,
          pushed: true,
        },
        {
          hash: "4f02d5c",
          subject: "kartta: korkeusdatan välimuisti",
          timestamp: T - 3100,
          pushed: true,
        },
      ],
      commits_available: true,
      base_ahead_commits: [
        {
          hash: "a1c9e02",
          subject: "kartta: korkeusprofiili reitin alle",
          timestamp: T - 600,
        },
        {
          hash: "77be310",
          subject: "reitit: nousu ja lasku haun tulokseen",
          timestamp: T - 1900,
        },
        {
          hash: "4f02d5c",
          subject: "kartta: korkeusdatan välimuisti",
          timestamp: T - 3100,
        },
      ],
    },
    pr: { number: 418, state: "open", checks: [4, 0, 2] },
    context: {
      phase: "known",
      tokens: 352_000,
      window: 400_000,
      autoCompaction: true,
      reserve: 16_384,
      model: "GPT-5.5",
    },
    model: "openai-codex/gpt-5.5",
    thinking: "high",
    history: true,
  },
  lukematon: {
    harness: "claude",
    profile: "prototype-opus",
    title: "Karttatasojen välimuisti",
    state: "Tila ei tiedossa",
    working: false,
    runId: "01m7examplerun00000lukematon",
    branch: "wt/z2p-tile-cache",
    source: "main",
    worktree: "~/src/retkiopas__worktrees/wt-z2p-tile-cache",
    history: false,
  },
};
const PARENT = "Retkioppaan kevään julkaisu";

// ---------- The header's buttons ----------

const noop = () => {};

function summaryFacts(g: GitDetailFacts): GitSummaryFacts {
  return {
    branch: g.branch,
    dirty_count: g.dirty_count,
    base: g.base,
  };
}

/** Git: production's chip and layer for a known state, else an honest "?". */
function WorkerGit({
  w,
  t,
  onUnknown,
}: {
  w: Worker;
  t: Text;
  onUnknown: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (!w.git)
    return (
      <ControlButton
        data-testid="git-chip"
        data-unknown
        size="inline"
        presentation="pill"
        className="ah-gs-chip ah-gs-worktree wh-unknown"
        aria-label={`${t.gitUnknown} ${t.openDetails}`}
        title={t.gitUnknown}
        onPress={onUnknown}
      >
        <Icon name="worktree" />
        <span className="ah-gs-counts">{t.gitUnknownValue}</span>
      </ControlButton>
    );
  return (
    <GitStatusChip
      facts={summaryFacts(w.git)}
      open={open}
      onOpenChange={setOpen}
      worktree={{ merged: false }}
    >
      <GitStatusDetails
        summary={summaryFacts(w.git)}
        detail={w.git}
        path={w.worktree}
        readAt={T * 1000}
        now={T * 1000 + 40_000}
        loading={false}
        readError={false}
        fetching={false}
        onFetch={noop}
        fetchUnavailable={t.fetchWorker}
      />
    </GitStatusChip>
  );
}

/** The pull request, when gh found one: a link out, as the band's is. */
function WorkerPr({ w, t }: { w: Worker; t: Text }) {
  if (!w.pr) return null;
  const [passed, failed, pending] = w.pr.checks;
  return (
    <a
      data-testid="worker-pr"
      className={`${controlClassName({ size: "inline", presentation: "pill", variant: "quiet" })} wh-pr`}
      href={`https://github.com/example/retkiopas/pull/${w.pr.number}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`${t.prOpen(w.pr.number)} ${t.prChecks(passed, failed, pending)}`}
    >
      <Icon name="github" />
      <span>{t.pr(w.pr.number)}</span>
      <span className="wh-pr-state">{t.prState[w.pr.state]}</span>
    </a>
  );
}

function WorkerContext({
  w,
  t,
  open,
  onToggle,
}: {
  w: Worker;
  t: Text;
  open: boolean;
  onToggle: () => void;
}) {
  if (w.context)
    return <ContextRing usage={w.context} open={open} onToggle={onToggle} />;
  return (
    <ControlButton
      data-testid="context-ring"
      data-unknown
      data-level="nowindow"
      size="inline"
      presentation="pill"
      variant="quiet"
      className="ah-ctx-chip wh-unknown"
      aria-label={`${t.contextUnknown} ${t.openDetails}`}
      aria-pressed={open}
      title={t.contextUnknown}
      onPress={onToggle}
    >
      <Ring level="nowindow" />
      <span className="ah-ctx-value">{t.contextUnknownValue}</span>
    </ControlButton>
  );
}

function modelWords(w: Worker) {
  if (!w.model) return undefined;
  const name = modelDisplayName(w.model, CATALOG);
  return w.thinking ? `${name} · ${thinkingDisplayName(w.thinking)}` : name;
}

/** The model, read-only: it opens the worker's details like the
 * conversation header's fallback chip, never a picker. */
function WorkerModel({
  w,
  t,
  open,
  onToggle,
}: {
  w: Worker;
  t: Text;
  open: boolean;
  onToggle: () => void;
}) {
  const words = modelWords(w);
  return (
    <ControlButton
      data-testid="worker-model"
      data-unknown={words ? undefined : true}
      data-menu-summary={words ?? t.modelUnknown}
      size="inline"
      presentation="pill"
      className={`ah-set-chip ah-set-compact${words ? "" : " wh-unknown"}`}
      aria-label={`${words ?? t.modelUnknown} ${t.openDetails}`}
      aria-expanded={open}
      title={words ?? t.modelUnknown}
      onPress={onToggle}
    >
      <span className="ah-set-model">
        {w.model ? modelDisplayName(w.model, CATALOG) : t.modelUnknownValue}
      </span>
    </ControlButton>
  );
}

/** Production's WorkerAsk (not exported), the same classes and words. */
function Ask({ onPress }: { onPress: () => void }) {
  const txt = useText(spinoffsText);
  return (
    <ControlButton
      data-testid="worker-ask"
      size="inline"
      presentation="pill"
      variant="secondary"
      className="ah-worker-ask"
      onPress={onPress}
    >
      <Icon name="message" />
      <span className="ah-worker-ask-long">{txt.askLive}</span>
      <span className="ah-worker-ask-short">{txt.ask}</span>
    </ControlButton>
  );
}

// ---------- The worker view ----------

const harnessName = { pi: "Pi", claude: "Claude Code" };

function WorkerFrame({
  direction,
  w,
  t,
  onParent,
}: {
  direction: number;
  w: Worker;
  t: Text;
  onParent: () => void;
}) {
  const txt = useText(spinoffsText);
  const [details, setDetails] = useState(false);
  const toggle = () => setDetails((d) => !d);
  const harness = harnessName[w.harness];
  const buttons = (
    <>
      <WorkerGit w={w} t={t} onUnknown={toggle} />
      <WorkerPr w={w} t={t} />
      <WorkerContext w={w} t={t} open={details} onToggle={toggle} />
      <WorkerModel w={w} t={t} open={details} onToggle={toggle} />
    </>
  );
  const facts = [
    { label: txt.facts.parent, value: PARENT },
    {
      label: txt.facts.agent,
      value: `${harness}${txt.facts.profile(w.profile)}`,
    },
    {
      label: t.factModel,
      value: modelWords(w) ?? t.modelUnknown,
    },
    {
      label: t.factContext,
      value: w.context ? contextSentence(w.context) : t.contextUnknown,
    },
    {
      label: txt.facts.history,
      value: w.history ? txt.facts.readable : txt.facts.notFound,
    },
    { label: txt.facts.state, value: w.state },
    { label: txt.facts.source, value: w.source },
    { label: txt.facts.branch, value: w.branch, copy: true },
    { label: txt.facts.worktree, value: w.worktree, copy: true },
    { label: txt.facts.run, value: w.runId, copy: true },
  ];
  const band = (
    <div
      className="ah-worker-band"
      data-testid="worker-band"
      data-direction={direction}
    >
      <span className="ah-worker-kind">
        <Icon name="branch" />
        {txt.worker}
      </span>
      <ControlButton
        data-testid="parent-top"
        size="inline"
        variant="quiet"
        className="ah-worker-parent"
        aria-label={txt.toParent(PARENT)}
        onPress={onParent}
      >
        <Icon name="back" />
        <span>{PARENT}</span>
      </ControlButton>
      <span className="ah-worker-meta">
        <span>
          {harness} · {w.profile}
        </span>
      </span>
      {direction === 1 ? (
        <span className="wh-band-buttons" data-testid="header-buttons">
          {buttons}
        </span>
      ) : null}
      <Ask onPress={onParent} />
    </div>
  );
  const inHeader = direction === 0;
  const items = [
    {
      id: "brief",
      kind: "user",
      content: (
        <WorkerBrief
          text={`Tee ${w.title.toLowerCase()}. Pidä muutos pienenä ja aja testit ennen yhdistämistä.`}
        />
      ),
    },
    ...(w.history
      ? [
          {
            id: "a1",
            kind: "assistant",
            content: (
              <Markdown
                text={
                  w.git?.dirty_count || w.git?.base?.ahead
                    ? "Korkeusprofiili piirtyy nyt reitin alle. Kolme committia on haarassa, ja kaksi tiedostoa on vielä kesken: `src/kartta/korkeus.ts` ja `src/kartta/profiili.tsx`. Ajan testit seuraavaksi."
                    : "Luin teematiedostot ja tilamerkin nykyisen toteutuksen. Aloitan vaaleasta teemasta; muutoksia ei ole vielä tehty."
                }
              />
            ),
          },
        ]
      : [
          {
            id: "closed",
            kind: "marker",
            content: (
              <p className="ah-worker-closed">
                <Icon name="terminal" />
                <span>{txt.historyUnread}</span>
              </p>
            ),
          },
        ]),
  ];
  return (
    <ConversationFrame className="ah-worker-frame">
      {band}
      {/* No wrapper: production's rules expect the header as the frame's
          own child. */}
      <AgentHeader
        title={w.title}
        activityLabel={w.state}
        activityKind={w.working ? "working" : "unknown"}
        activityAnimated={w.working}
        controlLabel={txt.readOnlyControl}
        controlKind="neutral"
        workspaceLabel="retkiopas"
        workspaceHref="/workspaces/ws_retki"
        detailsExpanded={details}
        onToggleDetails={toggle}
        detailsFacts={facts}
        gitStatus={
          inHeader ? (
            // A fragment, not a wrapper: production's phone and shortening
            // rules find the chips as the row's own children.
            <>
              <WorkerGit w={w} t={t} onUnknown={toggle} />
              <WorkerPr w={w} t={t} />
            </>
          ) : undefined
        }
        contextIndicator={
          inHeader ? (
            <WorkerContext w={w} t={t} open={details} onToggle={toggle} />
          ) : undefined
        }
        modelPicker={
          inHeader ? (
            <WorkerModel w={w} t={t} open={details} onToggle={toggle} />
          ) : undefined
        }
      />
      <ConversationStream label={txt.conversation}>
        <WorkerVoice>
          <ConversationTimeline
            state="ready"
            items={items}
            historyMode="pagedAccessible"
            onJumpToLatest={noop}
          />
        </WorkerVoice>
      </ConversationStream>
    </ConversationFrame>
  );
}

function Main({ direction, c, t }: { direction: number; c: CaseId; t: Text }) {
  const w = WORKERS[c];
  const [toast, setToast] = useState("");
  const onParent = () => setToast(PARENT);
  const now0 = Date.now();
  const nav = (
    id: string,
    title: string,
    working: boolean,
    selected: boolean,
  ): AgentNavModel => ({
    agentId: id,
    href: `/workspaces/ws_retki?conversation=${id}`,
    title,
    workspaceId: "ws_retki",
    workspaceName: "retkiopas",
    changedAt: now0 - 4 * 60000,
    activity: working ? "working" : "waiting",
    activityLabel: working ? "Työskentelee" : "Odottaa viestiä",
    controlLabel: "",
    detail: `retkiopas · ${working ? "Työskentelee" : "Odottaa viestiä"}`,
    selected,
  });
  const rail = (
    <WorkspaceRail
      collapsed={false}
      serverLabel="Habitat"
      connectionLabel="Yhdistetty"
      connectionTone="success"
      filterValue=""
      resultSummary="2 työtilaa"
      listState="ready"
      onToggle={noop}
      onFilter={noop}
      onRefresh={noop}
      sessionActions={
        <AccountShelf
          name="Esimerkki Käyttäjä"
          onSettings={noop}
          onLogout={noop}
        />
      }
      now={
        <section className="ah-now">
          <ul>
            <AgentNavItem {...nav("a", PARENT, false, false)} now={now0} />
          </ul>
        </section>
      }
    >
      <WorkspaceNavRow name="retkiopas" href="/workspaces/ws_retki" />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_koti" />
    </WorkspaceRail>
  );
  const main = (
    <div className="wh-main">
      <WorkerFrame direction={direction} w={w} t={t} onParent={onParent} />
    </div>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={w.title} rail={rail} main={main} />
      {toast ? (
        <p className="wh-toast" role="status" data-testid="parent-toast">
          → {toast}
        </p>
      ) : null}
    </StatusBellProvider>
  );
}

// ---------- The review page ----------

let reviewTheme = params.get("theme") === "dark" ? "dark" : "light";
let reviewCase: CaseId = (params.get("case") as CaseId) || "pr";
let reviewLanguage: "fi" | "en" = "fi";

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [c, setCase] = useState<CaseId>(reviewCase);
  const [language, setLanguage] = useState(reviewLanguage);
  const bar = useRef<HTMLElement>(null);
  const t = TEXT[language];
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
    <div className="wh-review" data-direction={direction}>
      <header className="wh-bar" ref={bar}>
        <div className="wh-controls">
          <strong>{t.title}</strong>
          <label>
            {t.caseLabel}{" "}
            <select
              id="case"
              value={c}
              onChange={(e) => {
                reviewCase = e.target.value as CaseId;
                setCase(reviewCase);
              }}
            >
              {(Object.keys(t.cases) as CaseId[]).map((k) => (
                <option key={k} value={k}>
                  {t.cases[k]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.theme}{" "}
            <select
              id="theme"
              value={theme}
              onChange={(e) => {
                reviewTheme = e.target.value;
                setTheme(reviewTheme);
              }}
            >
              <option value="light">{t.light}</option>
              <option value="dark">{t.dark}</option>
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
        </div>
        <ol className="wh-lines" data-testid="direction-lines">
          {t.lines.map((l, i) => (
            <li key={i} aria-current={i === direction ? "true" : undefined}>
              {l}
            </li>
          ))}
        </ol>
        <p className="wh-recommend" data-testid="recommendation">
          {t.recommend}
        </p>
      </header>
      <div className="wh-stage">
        <MemoryRouter
          initialEntries={["/workspaces/ws_retki?worker=01m7example"]}
        >
          <Main key={`${c}-${language}`} direction={direction} c={c} t={t} />
        </MemoryRouter>
      </div>
    </div>
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
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
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
picker.innerHTML =
  '<span class="proto-picker-highlight" aria-hidden="true"></span>';
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
