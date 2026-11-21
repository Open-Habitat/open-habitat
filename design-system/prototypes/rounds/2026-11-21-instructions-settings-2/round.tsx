import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import { AccountSettings, AccountShelf } from "../../../../web/src/components/Account";
import { AssistantMessage, Composer, ConversationTimeline, ToolRow, UserMessage } from "../../../../web/src/components/Conversation";
import { ConversationFrame, ConversationStream } from "../../../../web/src/components/ConversationFrame";
import { ControlButton } from "../../../../web/src/components/ControlElements";
import { Icon } from "../../../../web/src/components/Icon";
import { Markdown } from "../../../../web/src/components/Markdown";
import { AgentHeader, AppShell, WorkspaceNavRow, WorkspaceRail } from "../../../../web/src/components/Navigation";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { PiModelsProvider } from "../../../../web/src/app/PiModels";
import { type ShownSection, shownSettingsSections } from "../../../../web/src/app/settingsIndex";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { statusText } from "../../../../web/src/text/status";
import "../../../../web/src/components/components.css";
import { InstructionsEditor, type SaveResult } from "./editor";
import { type Lang, SCENARIO_IDS, type Scenario, TEXT, type Text } from "./text";
import "./round.css";

// new-user-agent-instructions-template, Settings round 2 (Jari 21.11.2026:
// Settings › Tili › Ohjeet agentille is direction B Teksti modified — an
// ordinary Markdown block that opens in Esikatselu; it implies a daemon read
// and a compare-and-swap write of the instructions file). The block is the
// shared editor (editor.tsx), the same one onboarding round 4 shows the note
// in, with a source line under it. The axis is the one open question the
// brief left: whether "Muokkaa agentin kanssa" stays beside the editor as a
// secondary action (B1) or the editor stands alone (B2). Situations: written
// in onboarding, no file yet, written by the person (Claude not reading it),
// and the file changing while the person edits (the agent wrote it in
// another conversation): the save is refused, the editor merges as the
// workspace editor does, and the person saves again. The page is
// production's AccountSettings on the Tili section; the round adds the block
// after its card and the row to the settings search index. The agent's
// conversation is scripted from production message cards; no model runs.

const NAMES = ["B1 Editori ja agentti", "B2 Pelkkä editori"];
const B1 = 0;
const params = new URLSearchParams(location.search);
const noop = () => {};
const PI_FILE = "~/.pi/agent/AGENTS.md";
const CLAUDE_FILE = "~/.claude/CLAUDE.md";
const IMPORT = "@~/.pi/agent/AGENTS.md";
let lang: Lang = params.get("lang") === "en" ? "en" : "fi";
setPersonalLanguage(lang);
const t = () => TEXT[lang];

// ---- The row in production's own settings index ----
for (const l of ["fi", "en"] as const) {
  const list = shownSettingsSections(l) as ShownSection[];
  const tili = list.find((s) => s.id === "tili");
  const x = TEXT[l];
  if (tili) (tili.rows as unknown as object[]).push({ id: "agent-instructions", label: x.heading, kw: x.rowKw, desc: x.rowDesc });
}

// ---- Host state: what the files say ----
type Claude = "imports" | "own" | "none";
type Host = {
  text: string | null;
  claude: Claude;
  claudeText: string;
  modified: string;
  updated: boolean;
  /** "Muuttuu sillä välin": the agent's write lands before the first save. */
  pendingTheirs: string | null;
  /** The host's compare-and-swap writes, for the check. */
  writes: { file: string; created: boolean }[];
};
const SCENARIOS: Record<Scenario, () => Host> = {
  habitat: () => ({ text: t().habitat, claude: "imports", claudeText: IMPORT, modified: t().dateHabitat, updated: false, pendingTheirs: null, writes: [] }),
  missing: () => ({ text: null, claude: "none", claudeText: "", modified: "", updated: false, pendingTheirs: null, writes: [] }),
  own: () => ({ text: t().own, claude: "own", claudeText: t().claudeOwn, modified: t().dateOwn, updated: false, pendingTheirs: null, writes: [] }),
  changed: () => ({ text: t().habitat, claude: "imports", claudeText: IMPORT, modified: t().dateHabitat, updated: false, pendingTheirs: t().habitatTheirs, writes: [] }),
};
let scenario: Scenario = SCENARIO_IDS.includes(params.get("s") as Scenario) ? (params.get("s") as Scenario) : "habitat";
let host: Host = SCENARIOS[scenario]();
const listeners = new Set<() => void>();
const set = (next: Partial<Host>) => {
  host = { ...host, ...next };
  listeners.forEach((f) => f());
};
function useHost() {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);
  return host;
}
(window as unknown as { __host: () => Host }).__host = () => host;

/** The write the editor implies: replace the instructions file only if it is
 * still the text the page read (compare-and-swap); create it only if it does
 * not exist, and then also create Claude's file pointing at it if that one
 * does not exist either. Claude's existing file is never edited from here. */
function writeInstructions(base: string, next: string): SaveResult {
  if (host.pendingTheirs !== null) {
    const theirs = host.pendingTheirs;
    set({ text: theirs, pendingTheirs: null });
    return { conflict: theirs };
  }
  if ((host.text ?? "") !== base) return { conflict: host.text ?? "" };
  const created = host.text === null;
  const writes = [{ file: PI_FILE, created }];
  const claudeCreated = created && host.claude === "none";
  if (claudeCreated) writes.push({ file: CLAUDE_FILE, created: true });
  set({
    text: next,
    modified: t().dateNow,
    updated: true,
    writes: [...host.writes, ...writes],
    ...(claudeCreated ? { claude: "imports" as Claude, claudeText: IMPORT } : {}),
  });
  return { ok: true };
}

// ---- Diff for the agent's proposal ----
type Diff = { k: "same" | "add" | "del"; s: string }[];
function diff(before: string, after: string): Diff {
  const a = before.split("\n"), b = after.split("\n");
  const m = a.map(() => new Array(b.length + 1).fill(0));
  m.push(new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) m[i][j] = a[i] === b[j] ? m[i + 1][j + 1] + 1 : Math.max(m[i + 1][j], m[i][j + 1]);
  const out: Diff = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { out.push({ k: "same", s: a[i] }); i++; j++; }
    else if (j < b.length && (i >= a.length || m[i][j + 1] >= m[i + 1][j])) out.push({ k: "add", s: b[j++] });
    else out.push({ k: "del", s: a[i++] });
  }
  return out;
}

// ---- The block ----
type Go = () => void;
/** Paths stay monospace inside running text. */
const paths = (s: string) => s.split(/(~\/[\w./-]+[\w])/).map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));

function Source() {
  const h = useHost(), x = t();
  const claude = h.claude === "imports" ? x.source.claudeImports : h.claude === "own" ? x.source.claudeOwn : x.source.claudeNone;
  return (
    <div className="ii-source" data-testid="source">
      <p>
        <Icon name="file" aria-hidden="true" />
        <span>
          {x.source.file} <code>{PI_FILE}</code>
          {h.text === null ? <span className="ii-dim"> · {x.source.notYet}</span> : <span className="ii-dim"> · {x.source.modified(h.modified)}</span>}
          {h.updated ? <span className="ii-tag" data-testid="updated-tag">{x.source.updatedNow}</span> : null}
        </span>
      </p>
      <p data-testid="source-pi">
        <Icon name="agent" aria-hidden="true" />
        <span>
          {x.source.pi}{" "}
          <span data-testid="source-claude" data-claude={h.claude} className={h.claude === "own" ? "ii-warn" : undefined}>
            {paths(claude)}
          </span>
        </span>
      </p>
    </div>
  );
}

function Block({ direction, go }: { direction: number; go: Go }) {
  const h = useHost(), x = t();
  const withAgent = direction === B1;
  const own = scenario === "own";
  const agent = withAgent ? (
    <ControlButton size="row" variant={h.text === null ? "primary" : "secondary"} data-testid="edit-with-agent" onPress={go}>
      {h.text === null ? x.writeWithAgent : x.editWithAgent}
    </ControlButton>
  ) : null;
  return (
    <div className="ii-block" data-testid={`direction-${direction === B1 ? "b1" : "b2"}`}>
      <div className="s-card ii-card">
        <InstructionsEditor
          value={h.text ?? ""}
          label={x.editorLabel}
          onSave={(next) => writeInstructions(h.text ?? "", next)}
          empty={
            <div className="ii-empty" data-testid="missing">
              <strong>{x.emptyTitle}</strong>
              <span>{withAgent ? x.emptyLeadB1 : x.emptyLeadB2}</span>
            </div>
          }
          source={<Source />}
          secondary={agent}
        />
      </div>
      {own ? (
        <p className="s-desc ii-note" data-testid="own-note">
          <Icon name="info" aria-hidden="true" />
          {x.ownNote}
          {!withAgent && h.claude === "own" ? ` ${x.claudeFixB2}` : ""}
        </p>
      ) : null}
      <p className="s-desc ii-note" data-testid="anywhere">
        <Icon name="message" aria-hidden="true" />
        {x.anywhere}
      </p>
    </div>
  );
}

// ---- The settings page ----
/** The round's slot in production's .s-main after the Tili card, above the
 * server version line every section ends with. */
function useSlot() {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const id = setInterval(() => {
      const main = document.querySelector<HTMLElement>(".s-main");
      if (!main || !main.querySelector(".s-card")) return;
      let slot = main.querySelector<HTMLElement>(":scope > .ii-section");
      if (!slot) {
        slot = document.createElement("div");
        slot.className = "ii-section";
        main.insertBefore(slot, main.querySelector(":scope > .s-version-line"));
      }
      setEl(slot);
      clearInterval(id);
    }, 10);
    return () => clearInterval(id);
  }, []);
  return el;
}
function Rail() {
  const x = t();
  const status = useText(statusText);
  return (
    <WorkspaceRail collapsed={false} serverLabel="Habitat" connectionLabel={status.connected} connectionTone="success"
      filterValue="" resultSummary="2" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf profile={{ name: x.person, email: "", avatar_url: "" }} onSettings={noop} onLogout={noop} />}>
      <WorkspaceNavRow name="kotikirjasto" href="/workspaces/kotikirjasto" />
      <WorkspaceNavRow name="python-harjoitukset" href="/workspaces/python-harjoitukset" />
    </WorkspaceRail>
  );
}
function SettingsPage({ direction, go }: { direction: number; go: Go }) {
  const slot = useSlot();
  const x = t();
  const main = (
    <div className="ah-settings-layer">
      <div className="ah-state">
        <AccountSettings routeSection="tili" onNavigate={noop} profile={{ name: x.person, email: "", avatar_url: "" }} csrf="prototype"
          nativeState="connected" nativeLogin="ainolaine" onReconnect={noop} onLogout={noop} workspaces={[]} onClose={noop} />
      </div>
    </div>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={x.heading} rail={<Rail />} main={main} />
      {slot
        ? createPortal(
            <section className="ii-wrap s-stack" data-settings-row="agent-instructions" tabIndex={-1} aria-labelledby="ii-h">
              <h3 className="s-h3" id="ii-h" data-testid="instructions-heading">{x.heading}</h3>
              <p className="s-intro">{x.intro}</p>
              <Block direction={direction} go={go} />
            </section>,
            slot,
          )
        : null}
    </StatusBellProvider>
  );
}

// ---- The conversation "Muokkaa agentin kanssa" opens (B1 only) ----
type Proposal = { file: "pi" | "claude"; before: string | null; after: string; state: "open" | "saved" | "cancelled" };
type Item =
  | { id: number; k: "me" | "agent"; text: string }
  | ({ id: number; k: "proposal" } & Proposal)
  | { id: number; k: "tool"; name: string; target: string }
  | { id: number; k: "back" };
type Chip = { label: string; act: () => void; primary?: boolean };

function ProposalCard({ p }: { p: Proposal }) {
  const x = t();
  const isNew = p.before === null;
  const rows = isNew ? p.after.split("\n").map((s) => ({ k: "add" as const, s })) : diff(p.before ?? "", p.after);
  return (
    <figure className="ii-proposal" data-testid="proposal" data-state={p.state} data-file={p.file}>
      <figcaption>
        <Icon name="file" aria-hidden="true" />
        <code>{p.file === "pi" ? PI_FILE : CLAUDE_FILE}</code>
        <span className="ii-tag" data-state={p.state === "saved" ? "saved" : undefined}>{p.state === "saved" ? x.saved : isNew ? x.newFile : x.changeFile}</span>
      </figcaption>
      <pre data-testid="proposal-text">
        {rows.map((r, i) => (
          <span key={i} className="ii-line" data-k={isNew ? undefined : r.k}>
            {isNew ? null : <span className="ii-mark" aria-hidden="true">{r.k === "add" ? "+" : r.k === "del" ? "−" : " "}</span>}
            {r.s || " "}
            {"\n"}
          </span>
        ))}
      </pre>
    </figure>
  );
}

/** One line added: the agent appends; a self-written file only ever gets
 * additions at the end. */
const appended = (text: string, line: string) => `${text.trimEnd()}\n\n${line}`;

function Chat({ back }: { back: () => void }) {
  const x = t();
  const h = host;
  const [items, setItems] = useState<Item[]>([
    { id: 1, k: "me", text: h.text === null ? x.openerMissing : x.opener },
    { id: 2, k: "agent", text: h.text === null ? x.helloMissing : scenario === "own" ? x.helloOwn : x.helloHabitat },
  ]);
  const [phase, setPhase] = useState<"ask" | "confirm" | "done">("ask");
  const [draft, setDraft] = useState("");
  const seq = useRef(3);
  const add = (...next: Omit<Item, "id">[]) => setItems((old) => [...old, ...next.map((n) => ({ ...n, id: seq.current++ }) as Item)]);
  const propose = (said: string, line: string) => {
    const before = host.text;
    const after = before === null ? x.newNote(line) : appended(before, line);
    add({ k: "me", text: said }, { k: "agent", text: before === null ? x.proposalNew : x.proposal }, { k: "proposal", file: "pi", before, after, state: "open" });
    setPhase("confirm");
  };
  const proposeClaude = () => {
    add({ k: "me", text: x.claudeChip }, { k: "agent", text: x.proposalClaude }, { k: "proposal", file: "claude", before: host.claudeText, after: `${IMPORT}\n\n${host.claudeText}`, state: "open" });
    setPhase("confirm");
  };
  const settle = (state: "saved" | "cancelled") => {
    const open = [...items].reverse().find((i): i is Extract<Item, { k: "proposal" }> => i.k === "proposal" && i.state === "open");
    if (!open) return;
    setItems((old) => old.map((i) => (i === open ? { ...open, state } : i)));
    const tools: Omit<Item, "id">[] = [];
    if (state === "saved") {
      if (open.file === "claude") {
        set({ claude: "imports", claudeText: open.after, updated: true });
        tools.push({ k: "tool", name: "edit", target: CLAUDE_FILE });
      } else {
        const created = open.before === null;
        tools.push({ k: "tool", name: created ? "write" : "edit", target: PI_FILE });
        if (created) tools.push({ k: "tool", name: "write", target: CLAUDE_FILE });
        set({ text: open.after, modified: x.dateNow, updated: true, ...(created ? { claude: "imports" as Claude, claudeText: IMPORT } : {}) });
      }
    }
    add({ k: "me", text: state === "saved" ? x.saveChip : x.cancelChip }, ...tools, { k: "agent", text: state === "saved" ? x.savedReply : x.cancelledReply }, { k: "back" });
    setPhase("done");
  };
  const c = x.chips;
  const chips: Chip[] =
    phase === "confirm"
      ? [{ label: x.saveChip, act: () => settle("saved"), primary: true }, { label: x.cancelChip, act: () => settle("cancelled") }]
      : phase === "done"
        ? []
        : h.text === null
          ? [c.shorter, c.explain].map((ch) => ({ label: ch.label, act: () => propose(ch.label, ch.line) }))
          : [
              ...(scenario === "own" && host.claude === "own" ? [{ label: x.claudeChip, act: proposeClaude }] : []),
              ...[c.shorter, c.delete].map((ch) => ({ label: ch.label, act: () => propose(ch.label, ch.line) })),
            ];
  const send = () => {
    const v = draft.trim();
    if (!v || phase !== "ask") return;
    setDraft("");
    propose(v, v);
  };
  const timeline = items.map((i) => {
    const content =
      i.k === "me" ? <div data-testid="person-message"><UserMessage sourceText={i.text} onCopy={noop}><Markdown text={i.text} /></UserMessage></div>
      : i.k === "agent" ? <div data-testid="agent-reply"><AssistantMessage streamState="complete" onCopy={noop}><Markdown text={i.text} /></AssistantMessage></div>
      : i.k === "proposal" ? <ProposalCard p={i} />
      : i.k === "tool" ? <div data-testid="ii-tool"><ToolRow name={i.name} targetText={i.target} statusLabel={x.saved} state="succeeded" expanded={false} onToggle={noop} /></div>
      : <div className="ii-chips"><ControlButton size="row" variant="primary" data-testid="back-to-settings" onPress={back}>{x.backToSettings}</ControlButton></div>;
    return { id: String(i.id), content };
  });
  if (chips.length)
    timeline.push({
      id: `chips-${seq.current}`,
      content: (
        <div className="ii-chips" role="group" aria-label={x.composerPlaceholder} data-testid="quick-replies">
          {chips.map((ch) => <ControlButton key={ch.label} size="row" variant={ch.primary ? "primary" : "secondary"} data-testid="quick-reply" onPress={ch.act}>{ch.label}</ControlButton>)}
        </div>
      ),
    });
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={x.convTitle} rail={<Rail />} main={
        <div className="ii-conv" data-testid="conversation">
          <ConversationFrame>
            <AgentHeader title={x.convTitle} workspaceLabel={x.home} workspaceHref="/" activityLabel="" controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
            <ConversationStream>
              <ConversationTimeline state="ready" items={timeline} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
            </ConversationStream>
            <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="steer" onModeChange={noop}
              onSendNow={send} onSteer={send} onFollowUp={send} idlePlaceholder={x.composerPlaceholder} />
          </ConversationFrame>
        </div>
      } />
    </StatusBellProvider>
  );
}

// ---- Synthetic host replies for the Tili section's production rows ----
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, "http://prototype.test/").pathname;
  if (!path.startsWith("/api/")) return realFetch(input, init);
  if (path === "/api/v1/pi/models") return json({ schema_version: 1, catalog_status: "native_cached", models: [] });
  if (path === "/api/v1/account/git-identity")
    return json({ schema_version: 1, name: "Aino Laine", email: "aino@example.invalid", source: "~/.gitconfig",
      suggested_name: "Aino Laine", suggested_email: "aino@example.invalid", emails: ["aino@example.invalid"] });
  if (path === "/api/v1/view-addresses") return new Response(null, { status: 204 });
  return new Response("", { status: 404 });
};

// ---- Review chrome ----
let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(lang);
  const [s, setS] = useState(scenario);
  const [generation, setGeneration] = useState(0);
  const [chat, setChat] = useState(false);
  const bar = useRef<HTMLElement>(null);
  const x: Text = TEXT[language];
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty("--review-h", `${el.getBoundingClientRect().height}px`);
    update();
    const o = new ResizeObserver(update);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const reset = (next = s) => { scenario = next; host = SCENARIOS[next](); setS(next); setChat(false); setGeneration((n) => n + 1); };
  return (
    <div className={`ii-review variant-${direction}`} data-direction={direction} data-scenario={s} data-stage={chat ? "chat" : "settings"}>
      <header className="ii-bar" ref={bar}>
        <div className="ii-controls">
          <strong>{x.title}</strong>
          <label>{x.scenario} <select id="scenario" value={s} onChange={(e) => reset(e.target.value as Scenario)}>
            {SCENARIO_IDS.map((id) => <option key={id} value={id}>{x.scenarios[id]}</option>)}</select></label>
          <label>{x.theme} <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value as typeof reviewTheme; setTheme(reviewTheme); }}>
            {(["light", "dark", "contrast"] as const).map((k) => <option key={k} value={k}>{x.themes[k]}</option>)}</select></label>
          <label>{x.language} <select id="language" value={language} onChange={(e) => {
            lang = e.target.value as Lang; setPersonalLanguage(lang); setLanguage(lang); reset();
          }}><option value="fi">Suomi</option><option value="en">English</option></select></label>
          <button type="button" className="ii-event" data-testid="event-reset" onClick={() => reset()}>{x.reset}</button>
        </div>
        <ol className="ii-lines" data-testid="direction-lines">
          {x.lines.map((l, i) => <li key={i} aria-current={i === direction ? "true" : undefined}>{l}</li>)}
        </ol>
        <p className="ii-recommend" data-testid="recommendation">{x.recommend}</p>
      </header>
      <div className="ii-stage">
        <PiModelsProvider key={`${generation}-${language}-${chat}`} enabled={false}>
          <MemoryRouter key={`${generation}-${language}-${chat}`} initialEntries={[chat ? "/workspaces/home" : "/settings/tili"]}>
            {chat ? <Chat back={() => setChat(false)} /> : <SettingsPage direction={direction} go={() => setChat(true)} />}
          </MemoryRouter>
        </PiModelsProvider>
      </div>
    </div>
  );
}

const reactRoot = createRoot(document.getElementById("root")!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = { set innerHTML(view: ReactNode) { host = SCENARIOS[scenario](); flushSync(() => reactRoot.render(view === "" ? null : view)); } };
const variants = NAMES.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement("nav");
picker.className = "proto-picker";
picker.setAttribute("aria-label", "Prototype variants");
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
NAMES.forEach((n, i) => {
  const button = document.createElement("button");
  button.className = "proto-picker-item";
  button.textContent = n;
  if (i === 0) { button.setAttribute("data-active", ""); button.setAttribute("aria-current", "true"); }
  picker.append(button);
});
document.body.append(picker);
new Function("stage", "variants", pickerSource)(stageSink, variants);
