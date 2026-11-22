import React, { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import { AccountShelf } from "../../../../web/src/components/Account";
import { AssistantMessage, ConversationTimeline, UserMessage } from "../../../../web/src/components/Conversation";
import { ConversationFrame, ConversationStream } from "../../../../web/src/components/ConversationFrame";
import { Markdown } from "../../../../web/src/components/Markdown";
import {
  AgentHeader,
  type AgentNavModel,
  AppShell,
  NowSections,
  WorkspaceNavRow,
  WorkspaceRail,
} from "../../../../web/src/components/Navigation";
import { QuietSection } from "../../../../web/src/components/QuietSection";
import { BrowserRowMarks } from "../../../../web/src/components/ServerBrowser";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { Composer } from "../../../../web/src/components/composer/Composer";
import { setPersonalLanguage } from "../../../../web/src/i18n";
import "../../../../web/src/components/components.css";
import { CONVS, DIRECTIONS, type Kind, type Lang, SCRIPT, type State, TEXT, type Text, WORKSPACES } from "./text";
import "./round.css";

// rail-state-change-visual (Jari 22.11.2026): how the left rail shows that a
// conversation changed state, so the change is noticed without sound and
// while the person reads another conversation. One axis: the visual means
// of the change. The same eight scripted events play in every direction:
// a start (Hiljaiset → Käynnissä), a turn ending (Käynnissä → Sinun
// vuorosi), the browser waiting for the person, a failure, a scroll that
// leaves Sinun vuorosi out of view, a question out of view, five changes at
// once, and the person opening a changed conversation.
//   Nyt: production; the row only changes section and mark.
//   A Slide: the row slides to its new place (FLIP) and glows, fading.
//   B Mark: an edge bar and the word "uusi" in the time's place until the
//     conversation is opened; a start gets no mark.
//   C Counter and chip: the section's count pulses once and "+n" stays; the
//     production edge chip gets "+n" for changes out of view.
//   D Edge: the rail's edge glows twice and stays a thin line; the
//     Työtilat row says how many are new in that workspace.
//   E Combined: B + C's chip + one A glow (no slide), no glow in a burst of
//     three or more, and a polite live announcement.
// The shell, rail, sections, rows, marks, edge chips, header, timeline and
// composer are production components. The effects are this round's: data
// attributes the round sets on production's rows, counts and chips after
// each render, styled in round.css. Synthetic content throughout.

const params = new URLSearchParams(location.search);
const noop = () => {};
type Theme = "light" | "dark" | "contrast";
type Section = "yours" | "running" | "quiet";
type Flags = { slide?: boolean; flash?: boolean; mark?: boolean; counter?: boolean; chip?: boolean; edge?: boolean; live?: boolean; calmBurst?: boolean };
const FLAGS: Flags[] = [
  {},
  { slide: true, flash: true },
  { mark: true },
  { counter: true, chip: true },
  { edge: true },
  { flash: true, mark: true, chip: true, live: true, calmBurst: true },
];
/** A burst: this many changes in one event count as noise (E). */
const BURST = 3;
const FLASH_MS = 3500;
const FLASH_REDUCED_MS = 6000;

const sectionOf = (s: State): Section =>
  s === "reply" || s === "question" ? "yours" : s === "quiet" ? "quiet" : "running";
const kindOf = (s: State): Kind | undefined =>
  s === "reply" ? "reply" : s === "question" ? "question" : s === "fail" ? "fail" : s === "browser" ? "browser" : s === "work" ? "start" : undefined;
const strong = (k?: Kind) => !!k && k !== "start";

type World = {
  states: Record<string, State>;
  at: Record<string, number>;
  /** Strong changes the person has not opened yet, with their kind. */
  fresh: Record<string, Kind>;
};
function initial(): World {
  const now = Date.now();
  const states: Record<string, State> = {};
  const at: Record<string, number> = {};
  let q = 0;
  CONVS.forEach((c, i) => {
    states[c.id] = c.state;
    at[c.id] = c.id === "o" ? now - 3 * 60_000 : c.state === "quiet" ? now - (2 + q++ * 5) * 3_600_000 : now - (4 + i * 3) * 60_000;
  });
  return { states, at, fresh: {} };
}

function wsName(i: number, lang: Lang) {
  return WORKSPACES[i][lang];
}
const hrefOf = (id: string, lang: Lang) => {
  const c = CONVS.find((x) => x.id === id)!;
  return `/workspaces/${encodeURIComponent(wsName(c.ws, lang))}?conversation=${id}`;
};

function model(id: string, w: World, t: Text, lang: Lang, selected: string, showFresh: boolean): AgentNavModel {
  const c = CONVS.find((x) => x.id === id)!;
  const s = w.states[id];
  const ws = wsName(c.ws, lang);
  const label =
    s === "reply" ? t.newReply : s === "question" ? t.asks : s === "fail" ? t.failed : s === "quiet" ? t.done : t.working;
  return {
    agentId: id,
    title: c[lang],
    href: hrefOf(id, lang),
    activity: s === "work" || s === "browser" ? "working" : s === "fail" ? "closed" : "waiting",
    activityLabel: label,
    attentionLabel: s === "reply" ? t.newReply : undefined,
    question: s === "question" || undefined,
    failed: s === "fail" || undefined,
    controlLabel: "",
    workspaceId: `ws_${c.ws}`,
    workspaceName: ws,
    // The words a mark would add to the row's description (its screen
    // reader text); production would put them in AgentNavItem's `said`.
    detail: [ws, label, showFresh && w.fresh[id] ? t.fresh : ""].filter(Boolean).join(" · "),
    changedAt: w.at[id],
    selected: id === selected,
  };
}

// ---------- DOM decoration of production's rail ----------

/** Restart a CSS animation keyed on an attribute. */
function restart(el: Element, attr: string, value = "") {
  el.removeAttribute(attr);
  void (el as HTMLElement).offsetWidth;
  el.setAttribute(attr, value);
}
const setAttr = (el: Element, attr: string, value: string | null) => {
  if (value === null) el.removeAttribute(attr);
  else if (el.getAttribute(attr) !== value) el.setAttribute(attr, value);
};
const rowOf = (root: ParentNode, id: string) => root.querySelector<HTMLElement>(`li[data-testid="agent-item-${id}"]`);

/** How many fresh rows lie wholly past each edge of the conversations'
 * region, per section, by production's own line (railRegions.tsx). */
function freshBeyond(region: HTMLElement, fresh: Record<string, Kind>, w: World) {
  const out = { above: {} as Record<Section, number>, below: {} as Record<Section, number> };
  const box = region.getBoundingClientRect();
  const CUE = 26;
  for (const id of Object.keys(fresh)) {
    const li = rowOf(region, id);
    if (!li) continue;
    const r = li.getBoundingClientRect();
    const sec = sectionOf(w.states[id]);
    if (r.bottom - 8 <= box.top + CUE) out.above[sec] = (out.above[sec] ?? 0) + 1;
    else if (r.top + 8 >= box.bottom - CUE) out.below[sec] = (out.below[sec] ?? 0) + 1;
  }
  return out;
}

// ---------- The page ----------

type Ctx = { lang: Lang; d: number; reduced: boolean; auto: boolean };

function Main({ lang, d, reduced, auto, run, onStep }: Ctx & { run: number; onStep: (i: number) => void }) {
  const t = TEXT[lang];
  const f = FLAGS[d];
  const loc = useLocation();
  const navigate = useNavigate();
  const selected = new URLSearchParams(loc.search).get("conversation") ?? "o";
  const [w, setW] = useState<World>(initial);
  const [step, setStep] = useState(0);
  const [flashing, setFlashing] = useState<Record<string, number>>({});
  const [pulse, setPulse] = useState<{ n: number; sections: Section[] }>({ n: 0, sections: [] });
  const [glow, setGlow] = useState(0);
  const [said, setSaid] = useState("");
  const shell = useRef<HTMLDivElement>(null);
  const before = useRef<Map<string, DOMRect>>(new Map());
  const done = useRef({ pulse: 0, glow: 0 });
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Opening a row is looking at it: its mark goes.
  useEffect(() => {
    setW((old) => {
      if (!old.fresh[selected]) return old;
      const fresh = { ...old.fresh };
      delete fresh[selected];
      return { ...old, fresh };
    });
  }, [selected]);

  const region = () => shell.current?.querySelector<HTMLElement>('[data-testid="rail-conversations"]') ?? null;

  const advance = useCallback(() => {
    if (step >= SCRIPT.length) return;
    const s = SCRIPT[step];
    const changes = s.changes ?? [];
    if (f.slide && !reduced && shell.current) {
      before.current = new Map();
      for (const c of changes) {
        const li = rowOf(shell.current, c.id);
        if (li) before.current.set(c.id, li.getBoundingClientRect());
      }
    }
    if (changes.length) {
      const now = Date.now();
      setW((old) => {
        const states = { ...old.states };
        const at = { ...old.at };
        const fresh = { ...old.fresh };
        for (const c of changes) {
          states[c.id] = c.to;
          at[c.id] = now;
          const k = kindOf(c.to);
          if (strong(k) && c.id !== selected) fresh[c.id] = k!;
          else delete fresh[c.id];
        }
        return { states, at, fresh };
      });
      const calm = f.calmBurst && changes.length >= BURST;
      if (f.flash && !calm) {
        const until = Date.now() + (reduced ? FLASH_REDUCED_MS : FLASH_MS);
        setFlashing((old) => {
          const n = { ...old };
          for (const c of changes) n[c.id] = until;
          return n;
        });
        timers.current.push(
          window.setTimeout(
            () => setFlashing((old) => Object.fromEntries(Object.entries(old).filter(([, u]) => u > Date.now() + 50))),
            (reduced ? FLASH_REDUCED_MS : FLASH_MS) + 60,
          ),
        );
      }
      setPulse((p) => ({ n: p.n + 1, sections: [...new Set(changes.map((c) => sectionOf(c.to)))] }));
      if (changes.some((c) => strong(kindOf(c.to)))) setGlow((g) => g + 1);
      if (f.live) {
        if (changes.length >= BURST) setSaid(t.announceMany(changes.length));
        else
          setSaid(
            changes
              .map((c) => t.announce(CONVS.find((x) => x.id === c.id)![lang], t.where[kindOf(c.to) ?? "start"]))
              .join(". "),
          );
      }
    }
    if (s.open) navigate(hrefOf(s.open, lang));
    if (s.scroll) {
      // After the commit, so the region has its new rows.
      requestAnimationFrame(() => {
        const r = region();
        if (r) r.scrollTop = s.scroll === "bottom" ? r.scrollHeight : 0;
      });
    }
    setStep(step + 1);
  }, [step, f, reduced, selected, lang, t, navigate]);

  useEffect(() => onStep(step), [step, onStep]);
  useEffect(() => {
    const go = () => advance();
    window.addEventListener("rsc-next", go);
    return () => window.removeEventListener("rsc-next", go);
  }, [advance]);
  useEffect(() => {
    if (!auto || step >= SCRIPT.length) return;
    const id = window.setTimeout(advance, step === 0 ? 1600 : 3400);
    return () => clearTimeout(id);
  }, [auto, step, advance]);

  // The slide (A): each moved row from where it was (FLIP).
  useLayoutEffect(() => {
    if (!before.current.size || !shell.current) return;
    for (const [id, old] of before.current) {
      const li = rowOf(shell.current, id);
      if (!li) continue;
      const now = li.getBoundingClientRect();
      const dy = old.top - now.top;
      if (Math.abs(dy) < 2) continue;
      li.animate([{ transform: `translateY(${dy}px)`, zIndex: 2 }, { transform: "none", zIndex: 2 }], {
        duration: 520,
        easing: "cubic-bezier(.2,.7,.3,1)",
      });
    }
    before.current = new Map();
  });

  // Decorate production's rows, counts, chips and Työtilat after every render
  // and while the region scrolls.
  const decorate = useCallback(() => {
    const root = shell.current;
    if (!root) return;
    root.toggleAttribute("data-reduced", reduced);
    for (const li of root.querySelectorAll<HTMLElement>('li[data-testid^="agent-item-"]')) {
      const id = li.dataset.testid!.slice("agent-item-".length);
      setAttr(li, "data-rsc-mark", f.mark && w.fresh[id] ? w.fresh[id] : null);
      setAttr(li, "data-rsc-flash", f.flash && flashing[id] ? (reduced ? "still" : "fade") : null);
      const time = li.querySelector(".ah-nav-time");
      if (time) setAttr(time, "data-rsc-tag", f.mark && w.fresh[id] ? t.tag : null);
    }
    const count = (sec: Section) => Object.keys(w.fresh).filter((id) => sectionOf(w.states[id]) === sec).length;
    for (const sec of ["yours", "running"] as Section[]) {
      const el = root.querySelector(`[data-testid="rail-${sec}-count"]`);
      if (!el) continue;
      const n = count(sec);
      setAttr(el, "data-rsc-plus", f.counter && n ? `+${n}` : null);
    }
    if (pulse.n !== done.current.pulse) {
      done.current.pulse = pulse.n;
      if (f.counter && !reduced)
        for (const sec of pulse.sections) {
          const el = root.querySelector(`[data-testid="rail-${sec}-count"]`);
          if (el) restart(el, "data-rsc-pulse");
        }
    }
    for (const a of root.querySelectorAll<HTMLElement>('a[data-testid^="workspace-"]')) {
      const name = a.dataset.workspaceName;
      const li = a.closest("li");
      if (!name || !li) continue;
      const i = WORKSPACES.findIndex((x) => x[lang] === name);
      const n = Object.keys(w.fresh).filter((id) => CONVS.find((c) => c.id === id)!.ws === i).length;
      setAttr(li, "data-rsc-ws", f.edge && n ? t.tagMany(n) : null);
    }
    const rail = root.querySelector(".ah-rail");
    if (rail) {
      setAttr(rail, "data-rsc-edge", f.edge && Object.keys(w.fresh).length ? "on" : null);
      if (glow !== done.current.glow) {
        done.current.glow = glow;
        if (f.edge && !reduced) restart(rail, "data-rsc-glow");
      }
    }
    const reg = region();
    root.querySelectorAll("[data-rsc-new]").forEach((el) => el.removeAttribute("data-rsc-new"));
    if (reg && f.chip) {
      const beyond = freshBeyond(reg, w.fresh, w);
      for (const edge of ["above", "below"] as const)
        for (const [sec, n] of Object.entries(beyond[edge])) {
          const chip = root.querySelector(`[data-testid="rail-beyond-${edge}-${sec}"]`);
          if (chip && n) chip.setAttribute("data-rsc-new", `+${n}`);
        }
    }
  }, [f, w, flashing, pulse, glow, reduced, lang, t]);
  useLayoutEffect(() => decorate());
  useEffect(() => {
    // Production's chips come and go with the region's scroll; follow them.
    const id = window.setInterval(decorate, 200);
    return () => clearInterval(id);
  }, [decorate]);

  const ids = CONVS.map((c) => c.id);
  const byNewest = (a: string, b: string) => w.at[b] - w.at[a];
  const m = (id: string) => model(id, w, t, lang, selected, !!f.mark);
  const yours = ids.filter((id) => sectionOf(w.states[id]) === "yours").sort(byNewest).map(m);
  const running = ids.filter((id) => sectionOf(w.states[id]) === "running").map(m);
  const quiet = ids.filter((id) => sectionOf(w.states[id]) === "quiet").sort(byNewest).map(m);
  const browser = new Map(ids.filter((id) => w.states[id] === "browser").map((id) => [id, "ask" as const]));
  const listed = WORKSPACES.map((x, i) => ({ id: `ws_${i}`, name: x[lang] }));
  const open = CONVS.find((c) => c.id === selected) ?? CONVS[7];
  const openWs = wsName(open.ws, lang);

  const rail = (
    <WorkspaceRail
      collapsed={false}
      serverLabel="Habitat"
      connectionLabel=""
      connectionTone="success"
      homeCurrent={false}
      filterValue=""
      resultSummary={`${WORKSPACES.length}`}
      listState="ready"
      onToggle={noop}
      onFilter={noop}
      onRefresh={noop}
      sessionActions={<AccountShelf profile={{ name: "Esimerkki Käyttäjä", email: "", avatar_url: "" }} onSettings={noop} onLogout={noop} />}
      now={
        <NowSections
          yours={yours}
          running={running}
          workspaces={listed}
          quiet={<QuietSection rows={quiet} workspaces={listed} choice={{ sort: "newest", workspace: null }} />}
        />
      }
    >
      {WORKSPACES.map((x, i) => {
        const n = Object.keys(w.fresh).filter((id) => CONVS.find((c) => c.id === id)!.ws === i).length;
        return (
          <WorkspaceNavRow
            key={x.fi}
            name={x[lang]}
            href={`/workspaces/${encodeURIComponent(x[lang])}`}
            selected={i === open.ws}
            summary={f.edge && n ? t.wsNew(n) : undefined}
          />
        );
      })}
    </WorkspaceRail>
  );
  const items = [
    {
      id: "u1",
      kind: "user",
      content: (
        <UserMessage sourceText={t.ask} onCopy={noop} time="9.12">
          <Markdown text={t.ask} />
        </UserMessage>
      ),
    },
    {
      id: "a1",
      kind: "assistant",
      content: (
        <AssistantMessage streamState="complete" time="9.13" onCopy={noop}>
          <Markdown text={t.reply} />
        </AssistantMessage>
      ),
    },
  ];
  return (
    <BrowserRowMarks.Provider value={browser}>
      <StatusBellProvider items={[]}>
        <div className="rsc-shell" ref={shell} data-direction={d} data-step={step} data-run={run}>
          <AppShell
            mobileTitle={open[lang]}
            navigationBadge={yours.length}
            rail={rail}
            main={
              <div className="rsc-main" data-testid="conversation">
                <ConversationFrame>
                  <AgentHeader
                    title={open[lang]}
                    workspaceLabel={openWs}
                    workspaceHref={`/workspaces/${encodeURIComponent(openWs)}`}
                    activityLabel=""
                    controlLabel=""
                    detailsExpanded={false}
                    onToggleDetails={noop}
                  />
                  <ConversationStream>
                    <ConversationTimeline state="ready" items={items} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
                  </ConversationStream>
                  <Composer
                    value=""
                    onChange={noop}
                    activity="idle"
                    selectedWorkingMode="steer"
                    onModeChange={noop}
                    onSendNow={noop}
                    onSteer={noop}
                    onFollowUp={noop}
                    idlePlaceholder=""
                  />
                </ConversationFrame>
              </div>
            }
          />
          <p className="ah-visually-hidden" role="status" aria-live="polite" data-testid="rsc-live">
            {said}
          </p>
        </div>
      </StatusBellProvider>
    </BrowserRowMarks.Provider>
  );
}

// ---------- Review page ----------

const firstTheme = (["light", "dark", "contrast"].includes(params.get("theme") ?? "") ? params.get("theme") : "light") as Theme;
let reviewTheme: Theme = firstTheme;
let reviewLanguage: Lang = params.get("lang") === "en" ? "en" : "fi";
const systemReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let reviewReduced = systemReduced || params.get("reduce") === "1";
let reviewAuto = params.get("auto") !== "0";

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [lang, setLang] = useState(reviewLanguage);
  const [reduced, setReduced] = useState(reviewReduced);
  const [auto, setAuto] = useState(reviewAuto);
  const [run, setRun] = useState(0);
  const [step, setStep] = useState(0);
  const t = TEXT[lang];
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--review-h", `${el.getBoundingClientRect().height}px`);
    set();
    const o = new ResizeObserver(set);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  const restartRun = () => setRun((r) => r + 1);
  const caption = step === 0 ? t.start : t.steps[step - 1];
  return (
    <div className="rsc-review" data-direction={direction}>
      <header className="rsc-bar" ref={bar}>
        <div className="rsc-controls">
          <strong>{t.title}</strong>
          <label>
            {t.theme}{" "}
            <select
              id="theme"
              value={theme}
              onChange={(e) => {
                reviewTheme = e.target.value as Theme;
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
              value={lang}
              onChange={(e) => {
                reviewLanguage = e.target.value as Lang;
                setPersonalLanguage(reviewLanguage);
                setLang(reviewLanguage);
                restartRun();
              }}
            >
              <option value="fi">suomi</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              data-testid="reduce"
              checked={reduced}
              onChange={(e) => {
                reviewReduced = e.target.checked;
                setReduced(reviewReduced);
                restartRun();
              }}
            />{" "}
            {t.reduce}
          </label>
          <label>
            <input
              type="checkbox"
              data-testid="auto"
              checked={auto}
              onChange={(e) => {
                reviewAuto = e.target.checked;
                setAuto(reviewAuto);
              }}
            />{" "}
            {t.auto}
          </label>
          <button
            type="button"
            className="rsc-next"
            data-testid="event-next"
            disabled={step >= SCRIPT.length}
            onClick={() => window.dispatchEvent(new Event("rsc-next"))}
          >
            {t.next} ›
          </button>
          <button type="button" data-testid="event-reset" onClick={restartRun}>
            {t.reset}
          </button>
        </div>
        <p className="rsc-caption" data-testid="event-caption">
          <b>{t.stepOf(step, SCRIPT.length)}</b> {caption}
        </p>
        <ol className="rsc-lines" data-testid="direction-lines">
          {t.lines.map((l, i) => (
            <li key={l} aria-current={i === direction ? "true" : undefined} title={l}>
              {l}
            </li>
          ))}
        </ol>
        <p className="rsc-recommend" data-testid="recommendation">
          {t.recommend}
        </p>
      </header>
      <div className="rsc-stage" data-testid="desktop-stage">
        <MemoryRouter key={`${run}-${lang}`} initialEntries={[hrefOf("o", lang)]}>
          <Main key={`${direction}-${run}-${lang}-${reduced}`} lang={lang} d={direction} reduced={reduced} auto={auto} run={run} onStep={setStep} />
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

setPersonalLanguage(reviewLanguage);
const root = createRoot(document.getElementById("root")!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {
  set innerHTML(view: ReactNode) {
    flushSync(() => root.render(view === "" ? null : view));
  },
};
const variants = DIRECTIONS.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement("nav");
picker.className = "proto-picker";
picker.setAttribute("aria-label", "Prototype variants");
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
DIRECTIONS.forEach((n, i) => {
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
