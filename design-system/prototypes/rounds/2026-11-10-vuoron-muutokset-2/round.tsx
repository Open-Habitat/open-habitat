import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import { AccountShelf } from "../../../../web/src/components/Account";
import {
  AgentTurn,
  elapsedLabel,
  ThinkingRow,
  type TurnStep,
} from "../../../../web/src/components/AgentTurn";
import { BashToolCard } from "../../../../web/src/components/BashToolCard";
import {
  ConversationTimeline,
  UserMessage,
} from "../../../../web/src/components/Conversation";
import {
  ConversationFrame,
  ConversationStream,
} from "../../../../web/src/components/ConversationFrame";
import {
  Composer,
  type ComposerSources,
} from "../../../../web/src/components/composer/Composer";
import {
  FileToolCard,
  fileStat,
} from "../../../../web/src/components/FileToolCard";
import { Markdown } from "../../../../web/src/components/Markdown";
import {
  AgentHeader,
  type AgentNavModel,
  AgentNavItem,
  AppShell,
  WorkspaceNavRow,
  WorkspaceRail,
} from "../../../../web/src/components/Navigation";
import { PiToolUse } from "../../../../web/src/components/PiBlocks";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { PiModelsProvider } from "../../../../web/src/app/PiModels";
import { setPersonalLanguage } from "../../../../web/src/i18n";
import "../../../../web/src/components/components.css";
import "../2026-11-10-vuoron-muutokset/round.css";
import {
  MANY,
  SMALL,
  type Step,
  type Turn,
  turnAt,
} from "../2026-11-10-vuoron-muutokset/turn";
import { Changes, type Shared, type Variant } from "./changes";
import { TEXT } from "./text";
import "./round.css";

// proto-turn-changes, round 2. Jari 10.11.2026 on round 1: Yhteenveto is
// the base; from Katselmointi it takes being collapsed by default; Aikajana's
// per-file timeline sits behind an optional button. The three variants are
// the same card and differ only where a question remains open: what the
// collapsed line says, and where the timeline button sits. Round 1's turns,
// cases, controls and diff pieces are reused unchanged from its directory.
setPersonalLanguage("fi");

const directions = ["Tiivis", "Nimet", "Aikajana"];
const VARIANTS: Variant[] = ["tiivis", "nimet", "rivilla"];
const LINES = {
  fi: [
    "Tiivis: kiinni oleva rivi kertoo vain tiedostojen määrän ja rivimäärät. Aikajana-painike tulee näkyviin, kun listan avaa.",
    "Nimet: rivi kertoo lisäksi ensimmäisten tiedostojen nimet (+N muuta), jolloin näkee avaamatta, mihin agentti koski. Aikajana kuten Tiiviissä.",
    "Aikajana: rivi kuten Tiiviissä, mutta Aikajana-painike on jo kiinni olevalla rivillä ja avaa muutokset suoraan aikajanana.",
  ],
  en: [
    "Compact: the collapsed line gives only the number of files and the line counts. The Timeline button appears once the list is open.",
    "Names: the line also names the first files (+N more), so you see what the agent touched without opening it. Timeline as in Compact.",
    "Timeline: the line as in Compact, but the Timeline button is already on the collapsed line and opens the changes straight as a timeline.",
  ],
};

type CaseId = "monta" | "pieni" | "kesken";
const TURNS: Record<CaseId, Turn> = { monta: MANY, pieni: SMALL, kesken: MANY };
const T0 = Date.UTC(2026, 10, 10, 9, 12);
const params = new URLSearchParams(location.search);

// ---------- The page clock ----------
// Only the running case uses it. It starts part way through the turn and
// stops on its own before the turn ends, so the turn stays running; Jatka
// lets it finish. `?at=<ms>` stops it at that moment for the screenshots,
// and `?warp=<n>` runs it n times faster for the checks.
const START = 62_000;
const sim = {
  now: START,
  paused: false,
  holdAt: MANY.holdAt ?? Infinity,
  listeners: new Set<() => void>(),
};
const notify = () => sim.listeners.forEach((l) => l());
const TICK = 100;
const WARP = Number(params.get("warp")) || 1;
setInterval(() => {
  if (sim.paused) return;
  if (sim.now >= sim.holdAt) {
    sim.paused = true;
    notify();
    return;
  }
  sim.now = Math.min(sim.now + TICK * WARP, sim.holdAt);
  notify();
}, TICK);
function resetClock() {
  const at = Number(params.get("at"));
  sim.now = at || START;
  sim.holdAt = at || MANY.holdAt || Infinity;
  sim.paused = false;
}

// ---------- The turn as production renders it ----------

const noop = () => {};
function nodes(steps: Step[], now: number): TurnStep[] {
  return steps.map((s): TurnStep => {
    if (s.kind === "thinking")
      return {
        kind: "thinking",
        key: s.key,
        at: T0 + s.at,
        node: <ThinkingRow text={s.text} />,
      };
    if (s.kind === "text")
      return {
        kind: "text",
        key: s.key,
        at: T0 + s.at,
        text: s.text,
        node: <Markdown text={s.text} />,
      };
    if (s.kind === "bash") {
      const running = now < s.at + s.ms;
      const state = running ? "running" : s.failed ? "failed" : "succeeded";
      return {
        kind: "tool",
        key: s.key,
        at: T0 + s.at + s.ms,
        failed: state === "failed",
        node: (
          <PiToolUse
            name="bash"
            state={state}
            targetText={s.command}
            keepMounted
          >
            <BashToolCard
              command={s.command}
              output={running ? "" : s.output}
              running={running}
            />
          </PiToolUse>
        ),
      };
    }
    const args = JSON.stringify(
      s.kind === "read"
        ? { path: s.path }
        : s.kind === "write"
          ? { path: s.path, content: s.content }
          : { path: s.path, edits: s.edits },
    );
    const output = s.kind === "read" ? s.output : undefined;
    return {
      kind: "tool",
      key: s.key,
      at: T0 + s.at,
      node: (
        <PiToolUse
          name={s.kind}
          state="succeeded"
          targetText={s.path}
          stat={fileStat(s.kind, args, output)}
        >
          <FileToolCard name={s.kind} argumentsText={args} output={output} />
        </PiToolUse>
      ),
    };
  });
}

const sources: ComposerSources = {
  commands: async () => ({ commands: [], truncated: false }) as never,
  files: async () => ({ files: [], truncated: false }),
  workspaceName: "retkiopas",
};

function usePhone() {
  // Production offers the editor only above 800 px (fileRefs, WorkspaceEditor).
  const [phone, setPhone] = useState(() => window.innerWidth <= 800);
  useEffect(() => {
    const on = () => setPhone(window.innerWidth <= 800);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return phone;
}

function Main({
  direction,
  c,
  now,
  language,
}: {
  direction: number;
  c: CaseId;
  now: number;
  language: "fi" | "en";
}) {
  const t = TEXT[language];
  const turn = TURNS[c];
  const at = c === "kesken" ? now : Infinity;
  const { steps, files, running } = turnAt(turn, at);
  const phone = usePhone();
  const [toast, setToast] = useState("");
  const timer = useRef(0);
  const open = (path: string, line?: number) => {
    // Production: POST /api/v1/editor/open {workspace, path, line}.
    setToast(t.opened(path, line));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(""), 3200);
  };
  const shared: Shared = { t, files, running, onOpen: phone ? null : open };
  const title =
    c === "pieni" ? "README:n kirjoitusvirhe" : "Reittihaun korkeuserot";
  const extra = (
    <Changes s={shared} variant={VARIANTS[direction]} turn={turn} now={at} />
  );
  const items = [
    {
      id: "u1",
      kind: "user",
      content: (
        <UserMessage sourceText={turn.ask} onCopy={noop} time="11.12">
          <Markdown text={turn.ask} />
        </UserMessage>
      ),
    },
    {
      id: "a1",
      kind: "assistant",
      content: (
        <div className="vm-turn">
          <AgentTurn
            steps={nodes(steps, at)}
            startedAt={T0}
            working={running}
            activity={
              running
                ? language === "fi"
                  ? "Ajaa komentoa"
                  : "Running a command"
                : undefined
            }
            duration={running ? elapsedLabel(now / 1000) : undefined}
          />
          {extra}
        </div>
      ),
    },
  ];
  const now0 = Date.now();
  const convs = [
    { id: "a", title, since: 0, working: running },
    { id: "b", title: "Karttatasojen välimuisti", since: 95, working: false },
  ];
  const model = (x: (typeof convs)[number]): AgentNavModel => ({
    agentId: x.id,
    href: `/workspaces/ws_retki?conversation=${x.id}`,
    title: x.title,
    workspaceId: "ws_retki",
    workspaceName: "retkiopas",
    changedAt: now0 - x.since * 60000,
    activity: x.working ? "working" : "waiting",
    activityLabel: x.working ? "Työskentelee" : "Odottaa viestiä",
    controlLabel: "",
    detail: `retkiopas · ${x.working ? "Työskentelee" : "Odottaa viestiä"}`,
    selected: x.id === "a",
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
            {convs.map((x) => (
              <AgentNavItem key={x.id} {...model(x)} now={now0} />
            ))}
          </ul>
        </section>
      }
    >
      <WorkspaceNavRow name="retkiopas" href="/workspaces/ws_retki" />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_koti" />
    </WorkspaceRail>
  );
  // The page opens on the end of the turn, as production does after a reply:
  // the direction's addition in view, the reply above it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new file is the trigger.
  useLayoutEffect(() => {
    const id = window.setTimeout(() => {
      const stream = document.querySelector<HTMLElement>(
        ".ah-conversation-stream",
      );
      if (!stream) return;
      const card = stream.querySelector<HTMLElement>(
        '[data-testid="turn-changes"]',
      );
      stream.scrollTop = card
        ? card.getBoundingClientRect().top -
          stream.getBoundingClientRect().top +
          stream.scrollTop -
          stream.clientHeight * 0.22
        : stream.scrollHeight;
    }, 60);
    return () => window.clearTimeout(id);
  }, [files.length, steps.length]);
  const main = (
    <div className="vm-main">
      <ConversationFrame>
        <AgentHeader
          title={title}
          workspaceLabel="retkiopas"
          workspaceHref="/workspaces/ws_retki"
          activityLabel={running ? "Työskentelee" : ""}
          activityAnimated={running}
          activityKind={running ? "working" : "neutral"}
          controlLabel=""
          detailsExpanded={false}
          onToggleDetails={noop}
        />
        <ConversationStream>
          <ConversationTimeline
            state="ready"
            items={items}
            historyMode="pagedAccessible"
            onJumpToLatest={noop}
          />
        </ConversationStream>
        <Composer
          value=""
          onChange={noop}
          activity={running ? "working" : "idle"}
          selectedWorkingMode="steer"
          onModeChange={noop}
          onSendNow={noop}
          onSteer={noop}
          onFollowUp={noop}
          onInterrupt={noop}
          sources={sources}
          csrf="prototype"
          modelPicker={
            <button type="button" className="md-pill">
              Claude Sonnet 5 · medium
            </button>
          }
        />
      </ConversationFrame>
    </div>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={title} rail={rail} main={main} />
      {toast ? (
        <p className="vm-toast" role="status" data-testid="editor-toast">
          {toast}
        </p>
      ) : null}
    </StatusBellProvider>
  );
}

let reviewTheme = "light";
let reviewCase: CaseId = (params.get("case") as CaseId) || "monta";
let reviewLanguage: "fi" | "en" = "fi";
let reviewMotion = "system";

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [c, setCase] = useState<CaseId>(reviewCase);
  const [language, setLanguage] = useState(reviewLanguage);
  const [motion, setMotion] = useState(reviewMotion);
  const [generation, setGeneration] = useState(0);
  const [now, setNow] = useState(sim.now);
  const [paused, setPaused] = useState(sim.paused);
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
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    if (motion === "reduce") document.documentElement.dataset.motion = "reduce";
    else delete document.documentElement.dataset.motion;
  }, [motion]);
  useEffect(() => {
    const l = () => {
      setNow(sim.now);
      setPaused(sim.paused);
    };
    sim.listeners.add(l);
    return () => void sim.listeners.delete(l);
  }, []);
  // Every new stage starts the running turn again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the keys are the trigger.
  useLayoutEffect(() => {
    resetClock();
    setNow(sim.now);
    setPaused(false);
  }, [generation, c, direction]);
  return (
    <div
      className={`vm-review variant-${direction}`}
      data-direction={direction}
    >
      <header className="vm-bar" ref={bar}>
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
          {t.motion}{" "}
          <select
            id="motion"
            value={motion}
            onChange={(e) => {
              reviewMotion = e.target.value;
              setMotion(reviewMotion);
            }}
          >
            <option value="system">{t.motionSystem}</option>
            <option value="reduce">{t.motionReduce}</option>
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
        {c === "kesken" ? (
          <button
            type="button"
            data-testid="vm-pause"
            aria-pressed={paused}
            onClick={() => {
              sim.paused = !sim.paused;
              // Jatka goes on past the stop, to the end of the turn.
              if (!sim.paused) sim.holdAt = Infinity;
              notify();
            }}
          >
            {paused ? t.resume : t.pause}
          </button>
        ) : null}
        <button
          type="button"
          data-testid="vm-reset"
          onClick={() => setGeneration((g) => g + 1)}
        >
          {t.reset}
        </button>
        <ol className="vm-lines" data-testid="direction-lines">
          {LINES[language].map((l, i) => (
            <li key={i} aria-current={i === direction ? "true" : undefined}>
              {l}
            </li>
          ))}
        </ol>
      </header>
      <div className="vm-stage">
        <PiModelsProvider key={`${generation}-${c}-${language}`} enabled>
          <MemoryRouter
            initialEntries={["/workspaces/ws_retki?conversation=a"]}
          >
            <Main
              key={`${generation}-${c}-${language}`}
              direction={direction}
              c={c}
              now={now}
              language={language}
            />
          </MemoryRouter>
        </PiModelsProvider>
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
  if (path === "/api/v1/pi/models")
    return json({
      schema_version: 1,
      default_provider: "anthropic",
      default_model: "claude-sonnet-5",
      default_thinking: "medium",
      catalog_status: "native_cached",
      models: [
        {
          id: "claude-sonnet-5",
          name: "Claude Sonnet 5",
          provider: "anthropic",
        },
      ],
    });
  return new Response("", { status: 404 });
};

// For the check script: the page clock.
(window as unknown as { __sim: unknown }).__sim = {
  get now() {
    return sim.now;
  },
  get paused() {
    return sim.paused;
  },
};

const root = createRoot(document.getElementById("root")!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {
  set innerHTML(view: React.ReactNode) {
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
