import React, { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { type Lang, SCENARIO_IDS, SECTION_IDS, type Scenario, type SectionId, TEXT, type Text } from "./text";
import "./round.css";

// new-user-agent-instructions-template, Settings round (Jari 21.11.2026):
// existing accounts reach their own agent instructions from Settings › Tili
// › Ohjeet agentille, and can continue the instruction conversation from
// there or in any conversation. The block shows the file Pi reads
// (~/.pi/agent/AGENTS.md), where it comes from and whether Claude reads it
// (~/.claude/CLAUDE.md importing it), and a way to edit it with the agent.
// Axis: how the instructions are shown and changed on the first view.
// A renders the file read-only with one button to the agent; B shows the
// file as text and also lets the person edit it themselves; C shows the
// file as sections, each changed with the agent. Situations: written by
// onboarding, no file yet, written by the person (no sections, Claude not
// importing). The page is production's AccountSettings on the Tili
// section; the round adds the block after its card and the row to the
// settings search index. "Muokkaa agentin kanssa" opens a scripted
// conversation built from production message cards, tool rows and the
// composer; no model runs.

const NAMES = ["A Luku", "B Teksti", "C Osiot"];
const A = 0, B = 1, C = 2;
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

// ---- The file ----
function habitatFile(x: Text, style = x.choices.style[1].line, ask: string | null = x.choices.ask[1].line): string {
  const n = x.sectionNames;
  const parts = [
    x.file.title, x.file.lead,
    `## ${n.who}\n\n- ${x.file.call}\n- ${x.file.bio}`,
    `## ${n.lang}\n\n- ${x.file.lang}`,
    `## ${n.style}\n\n- ${style}`,
  ];
  if (ask) parts.push(`## ${n.ask}\n\n- ${ask}`);
  return parts.join("\n\n");
}
/** Sets or adds one bullet under a heading; a missing heading is appended. */
function setLine(text: string, heading: string, line: string, mode: "replace" | "add"): string {
  const lines = text.split("\n");
  const at = lines.indexOf(`## ${heading}`);
  if (at < 0) return `${text.trimEnd()}\n\n## ${heading}\n\n- ${line}`;
  let end = lines.findIndex((l, i) => i > at && l.startsWith("## "));
  if (end < 0) end = lines.length;
  const bullets = lines.map((l, i) => (i > at && i < end && l.startsWith("- ") ? i : -1)).filter((i) => i >= 0);
  if (mode === "replace" && bullets.length) {
    const kept = lines.filter((_, i) => !bullets.includes(i));
    kept.splice(bullets[0], 0, `- ${line}`);
    return kept.join("\n");
  }
  const after = bullets.length ? bullets[bullets.length - 1] + 1 : at + 1;
  lines.splice(after, 0, bullets.length ? `- ${line}` : `\n- ${line}`);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}
type Sections = Partial<Record<SectionId, string[]>>;
function sections(x: Text, text: string): Sections | null {
  const ids = Object.fromEntries(SECTION_IDS.map((id) => [x.sectionNames[id], id])) as Record<string, SectionId>;
  const out: Sections = {};
  let cur: SectionId | null = null;
  let any = false;
  for (const l of text.split("\n")) {
    // Text outside the template's sections (a file the person wrote) has no
    // place among the rows: such a file is shown as it is.
    if (!any && l.trim() && !l.startsWith("# ") && !l.startsWith("## ") && l !== x.file.lead) return null;
    if (l.startsWith("## ")) { cur = ids[l.slice(3).trim()] ?? null; if (cur) { out[cur] = []; any = true; } }
    else if (cur && l.startsWith("- ")) out[cur]!.push(l.slice(2));
  }
  return any ? out : null;
}
type Diff = { k: "same" | "add" | "del"; s: string }[];
function diff(before: string, after: string): Diff {
  const a = before.split("\n"), b = after.split("\n");
  const m = a.map(() => new Array(b.length + 1).fill(0));
  m.push(new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--)
    m[i][j] = a[i] === b[j] ? m[i + 1][j + 1] + 1 : Math.max(m[i + 1][j], m[i][j + 1]);
  const out: Diff = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { out.push({ k: "same", s: a[i] }); i++; j++; }
    else if (j < b.length && (i >= a.length || m[i][j + 1] >= m[i + 1][j])) out.push({ k: "add", s: b[j++] });
    else out.push({ k: "del", s: a[i++] });
  }
  return out;
}

// ---- Host state: what the files say ----
type Claude = "imports" | "own" | "none";
type Host = { text: string | null; claude: Claude; claudeText: string; modified: string; updated: boolean };
const SCENARIOS: Record<Scenario, () => Host> = {
  habitat: () => ({ text: habitatFile(t()), claude: "imports", claudeText: IMPORT, modified: t().dateHabitat, updated: false }),
  missing: () => ({ text: null, claude: "none", claudeText: "", modified: "", updated: false }),
  own: () => ({ text: t().own, claude: "own", claudeText: t().claudeOwn, modified: t().dateOwn, updated: false }),
};
let scenario: Scenario = SCENARIO_IDS.includes(params.get("s") as Scenario) ? (params.get("s") as Scenario) : "habitat";
let host: Host = SCENARIOS[scenario]();
const listeners = new Set<() => void>();
const set = (next: Partial<Host>) => { host = { ...host, ...next }; listeners.forEach((f) => f()); };
function useHost() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return host;
}
let toast: (s: string) => void = noop;
type Go = (section?: SectionId) => void;

// ---- Shared pieces of the block ----
/** Paths stay monospace inside running text. */
const paths = (s: string) => s.split(/(~\/[\w./-]+[\w])/).map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));
function Source() {
  const h = useHost(), x = t();
  const claude = h.claude === "imports" ? x.source.claudeImports : h.claude === "own" ? x.source.claudeOwn : x.source.claudeNone;
  return (
    <div className="ii-source" data-testid="source">
      <p><Icon name="file" aria-hidden="true" /><span>{x.source.file} <code>{PI_FILE}</code>{h.text ? null : <span className="ii-dim"> · {x.notYet.toLowerCase()}</span>}</span></p>
      <p data-testid="source-pi"><Icon name="agent" aria-hidden="true" /><span>{x.source.pi} <span data-testid="source-claude" data-claude={h.claude} className={h.claude === "own" ? "ii-warn" : undefined}>{paths(claude)}</span></span></p>
      {h.text ? (
        <p className="ii-dim"><Icon name="clock" aria-hidden="true" /><span>{x.source.modified(h.modified)}</span>
          {h.updated ? <span className="ii-tag" data-testid="updated-tag">{x.source.updatedNow}</span> : null}</p>
      ) : null}
    </div>
  );
}
function AgentButton({ go, section }: { go: Go; section?: SectionId }) {
  const h = useHost(), x = t();
  return (
    <ControlButton size="row" variant="primary" data-testid="edit-with-agent" onPress={() => go(section)}>
      {h.text ? x.editWithAgent : x.writeWithAgent}
    </ControlButton>
  );
}
function Missing({ children }: { children?: ReactNode }) {
  const x = t();
  return (
    <div className="ii-missing" data-testid="missing">
      <strong>{x.missingTitle}</strong>
      <span className="s-desc">{x.missingLead}</span>
      {children}
    </div>
  );
}
function Footnotes() {
  const h = useHost(), x = t();
  return (
    <>
      {scenario === "own" && h.text ? <p className="s-desc ii-note" data-testid="own-note"><Icon name="info" aria-hidden="true" />{x.ownNote}</p> : null}
      <p className="s-desc ii-note" data-testid="anywhere"><Icon name="message" aria-hidden="true" />{x.anywhere}</p>
    </>
  );
}

// ---- A Luku: rendered, read-only, one button ----
function DirectionA({ go }: { go: Go }) {
  const h = useHost();
  return (
    <div className="ii-block" data-testid="direction-a">
      <div className="s-card">
        {h.text ? <div className="ii-doc" data-testid="file-rendered"><Markdown text={h.text} document /></div> : <Missing />}
        <Source />
        <div className="ii-actions"><AgentButton go={go} /></div>
      </div>
      <Footnotes />
    </div>
  );
}

// ---- B Teksti: the file as text; edit it yourself or with the agent ----
function DirectionB({ go }: { go: Go }) {
  const h = useHost(), x = t();
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;
  return (
    <div className="ii-block" data-testid="direction-b">
      <div className="s-card">
        {editing ? (
          <div className="ii-editor-wrap">
            <textarea className="ii-editor" data-testid="text-editor" aria-label={x.editorLabel} value={draft} rows={Math.max(8, draft.split("\n").length + 1)}
              onChange={(e) => setDraft(e.target.value)} autoFocus />
            <p className="s-desc">{x.editorNote}</p>
          </div>
        ) : h.text ? (
          <pre className="ii-raw" data-testid="file-raw">{h.text}</pre>
        ) : <Missing />}
        <Source />
        <div className="ii-actions">
          {editing ? (
            <>
              <ControlButton size="row" variant="primary" data-testid="text-save" onPress={() => {
                const text = draft.trim() ? draft.trimEnd() : null;
                set({ text, modified: x.dateNow, updated: true, ...(text && host.claude === "none" ? { claude: "imports" as Claude, claudeText: IMPORT } : {}) });
                setDraft(null); toast(x.savedToast);
              }}>{x.save}</ControlButton>
              <ControlButton size="row" variant="secondary" data-testid="text-cancel" onPress={() => setDraft(null)}>{x.cancel}</ControlButton>
            </>
          ) : (
            <>
              <AgentButton go={go} />
              <ControlButton size="row" variant="secondary" data-testid="edit-as-text" onPress={() => setDraft(h.text ?? "")}>
                {h.text ? x.editAsText : x.writeYourself}
              </ControlButton>
            </>
          )}
        </div>
      </div>
      <Footnotes />
    </div>
  );
}

// ---- C Osiot: the file as sections, each changed with the agent ----
function DirectionC({ go }: { go: Go }) {
  const h = useHost(), x = t();
  const [open, setOpen] = useState(false);
  const secs = h.text ? sections(x, h.text) : {};
  return (
    <div className="ii-block" data-testid="direction-c">
      {secs ? (
        <div className="s-card" data-testid="section-list">
          {!h.text ? <Missing /> : null}
          {SECTION_IDS.map((id) => {
            const lines = secs[id] ?? [];
            return (
              <div key={id} className="s-row ii-sec" data-testid={`section-${id}`} data-empty={lines.length ? undefined : "true"}>
                <div className="s-lbl">
                  <strong>{x.sectionNames[id]}</strong>
                  <span className={lines.length ? "ii-sec-text" : "s-desc"}>{lines.length ? lines.join(" ") : x.notYet}</span>
                </div>
                <div className="s-val">
                  <ControlButton size="row" variant="secondary" data-testid={`section-change-${id}`} onPress={() => go(id)}>
                    {lines.length ? x.change : x.add}
                  </ControlButton>
                </div>
              </div>
            );
          })}
          <Source />
          <div className="ii-actions">
            {h.text ? (
              <ControlButton size="row" variant="quiet" data-testid="show-file" onPress={() => setOpen(!open)}>{open ? x.hideFile : x.showFile}</ControlButton>
            ) : <AgentButton go={go} />}
          </div>
          {open && h.text ? <pre className="ii-raw" data-testid="file-raw">{h.text}</pre> : null}
        </div>
      ) : (
        <div className="s-card">
          <p className="s-desc ii-pad" data-testid="no-sections">{x.noSections}</p>
          <div className="ii-doc" data-testid="file-rendered"><Markdown text={h.text ?? ""} document /></div>
          <Source />
          <div className="ii-actions"><AgentButton go={go} /></div>
        </div>
      )}
      <Footnotes />
    </div>
  );
}

// ---- The settings page ----
/** The round's slot in production's .s-main after the Tili card, above
 * the server version line every section ends with. */
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
      setEl(slot); clearInterval(id);
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
  const body = direction === A ? <DirectionA go={go} /> : direction === B ? <DirectionB go={go} /> : <DirectionC go={go} />;
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
      {slot ? createPortal(
        <section className="ii-wrap s-stack" data-settings-row="agent-instructions" tabIndex={-1} aria-labelledby="ii-h">
          <h3 className="s-h3" id="ii-h" data-testid="instructions-heading">{x.heading}</h3>
          <p className="s-intro">{x.intro}</p>
          {body}
        </section>, slot) : null}
    </StatusBellProvider>
  );
}

// ---- The conversation "Muokkaa agentin kanssa" opens ----
type Proposal = { file: "pi" | "claude"; before: string | null; after: string; state: "open" | "saved" | "cancelled" };
type Item =
  | { id: number; k: "me" | "agent"; text: string }
  | ({ id: number; k: "proposal" } & Proposal)
  | { id: number; k: "tool"; name: string; target: string }
  | { id: number; k: "back" };
type Chip = { label: string; act: () => void; primary?: boolean };

function ProposalCard({ p }: { p: Proposal }) {
  const x = t();
  const rows = p.before === null ? p.after.split("\n").map((s) => ({ k: "add" as const, s })) : diff(p.before, p.after);
  const isNew = p.before === null;
  return (
    <figure className="ii-proposal" data-testid="proposal" data-state={p.state} data-file={p.file}>
      <figcaption>
        <Icon name="file" aria-hidden="true" />
        <code>{p.file === "pi" ? PI_FILE : CLAUDE_FILE}</code>
        <span className="ii-tag" data-state={p.state === "saved" ? "saved" : undefined}>
          {p.state === "saved" ? x.saved : isNew ? x.newFile : x.changeFile}
        </span>
      </figcaption>
      <pre data-testid="proposal-text">
        {rows.map((r, i) => (
          <span key={i} className="ii-line" data-k={isNew ? undefined : r.k}>
            {isNew ? null : <span className="ii-mark" aria-hidden="true">{r.k === "add" ? "+" : r.k === "del" ? "−" : " "}</span>}
            {r.s || " "}{"\n"}
          </span>
        ))}
      </pre>
    </figure>
  );
}

function Chat({ section, back }: { section?: SectionId; back: () => void }) {
  const x = t();
  const h = host;
  const sc = scenario;
  const secName = section ? x.sectionNames[section] : "";
  const nowLine = section && h.text ? (sections(x, h.text)?.[section] ?? []).join(" ") : "";
  const opener = !h.text ? x.openerMissing : section ? x.openerSection(secName) : x.opener;
  const hello = !h.text ? x.helloMissing : section ? x.helloSection(secName, nowLine) : sc === "own" ? x.helloOwn : x.helloHabitat;
  const [items, setItems] = useState<Item[]>([{ id: 1, k: "me", text: opener }, { id: 2, k: "agent", text: hello }]);
  const [phase, setPhase] = useState<"ask" | "confirm" | "done">("ask");
  const [draft, setDraft] = useState("");
  const seq = useRef(3);
  const add = (...next: Omit<Item, "id">[]) => setItems((old) => [...old, ...next.map((n) => ({ ...n, id: seq.current++ }) as Item)]);
  const mode = (kind: SectionId): "replace" | "add" => (sc === "own" || kind !== "style" ? "add" : "replace");
  /** The agent's proposal for one line in one section. */
  const propose = (said: string, kind: SectionId, line: string, reply = x.proposal) => {
    const before = host.text;
    const after = before === null ? habitatFile(x, kind === "style" ? line : x.choices.style[0].line, kind === "ask" ? line : null) : setLine(before, x.sectionNames[kind], line, mode(kind));
    const withExtra = before === null && kind !== "style" && kind !== "ask" ? setLine(after, x.sectionNames[kind], line, "add") : after;
    add({ k: "me", text: said }, { k: "agent", text: before === null ? x.proposalNew : reply }, { k: "proposal", file: "pi", before, after: withExtra, state: "open" });
    setPhase("confirm");
  };
  const proposeClaude = () => {
    add({ k: "me", text: x.claudeChip }, { k: "agent", text: x.proposalClaude },
      { k: "proposal", file: "claude", before: host.claudeText, after: `${IMPORT}\n\n${host.claudeText}`, state: "open" });
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
    add({ k: "me", text: state === "saved" ? x.saveChip : x.cancelChip }, ...tools,
      { k: "agent", text: state === "saved" ? x.savedReply : x.cancelledReply }, { k: "back" });
    setPhase("done");
  };
  const style = x.choices.style.map((c): Chip => ({ label: c.label, act: () => propose(c.label, "style", c.line) }));
  const ask = x.choices.ask.map((c): Chip => ({ label: c.label, act: () => propose(c.label, "ask", c.line) }));
  const chips: Chip[] =
    phase === "confirm" ? [{ label: x.saveChip, act: () => settle("saved"), primary: true }, { label: x.cancelChip, act: () => settle("cancelled") }]
    : phase === "done" ? []
    : !h.text ? style
    : section === "style" ? style
    : section === "ask" ? ask
    : section ? []
    : sc === "own" && h.claude === "own" ? [{ label: x.claudeChip, act: proposeClaude }, ...ask]
    : [...style, ...ask];
  const send = () => {
    const v = draft.trim();
    if (!v || phase === "confirm") return;
    setDraft("");
    const kind: SectionId = section && section !== "style" && section !== "ask" ? section : "extra";
    propose(v, kind, v, kind === "extra" ? `${x.extraReply} ${x.proposal}` : x.proposal);
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
    timeline.push({ id: `chips-${seq.current}`, content: (
      <div className="ii-chips" role="group" aria-label={x.composerPlaceholder} data-testid="quick-replies">
        {chips.map((c) => <ControlButton key={c.label} size="row" variant={c.primary ? "primary" : "secondary"} data-testid="quick-reply" onPress={c.act}>{c.label}</ControlButton>)}
      </div>
    ) });
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
let reviewTheme = params.get("theme") === "dark" ? "dark" : "light";
function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(lang);
  const [s, setS] = useState(scenario);
  const [generation, setGeneration] = useState(0);
  const [stage, setStage] = useState<{ chat: boolean; section?: SectionId }>({ chat: false });
  const [note, setNote] = useState("");
  const bar = useRef<HTMLElement>(null);
  const x = TEXT[language];
  toast = setNote;
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
  useEffect(() => { if (!note) return; const id = setTimeout(() => setNote(""), 2500); return () => clearTimeout(id); }, [note]);
  const reset = (next = s) => { scenario = next; host = SCENARIOS[next](); setS(next); setNote(""); setStage({ chat: false }); setGeneration((n) => n + 1); };
  return (
    <div className={`ii-review variant-${direction}`} data-direction={direction} data-scenario={s} data-stage={stage.chat ? "chat" : "settings"}>
      <header className="ii-bar" ref={bar}>
        <div className="ii-controls">
          <strong>{x.title}</strong>
          <label>{x.scenario} <select id="scenario" value={s} onChange={(e) => reset(e.target.value as Scenario)}>
            {SCENARIO_IDS.map((id) => <option key={id} value={id}>{x.scenarios[id]}</option>)}</select></label>
          <label>{x.theme} <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
            <option value="light">{x.themes.light}</option><option value="dark">{x.themes.dark}</option></select></label>
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
        <PiModelsProvider key={`${generation}-${language}-${stage.chat}`} enabled={false}>
          <MemoryRouter key={`${generation}-${language}-${stage.chat}`} initialEntries={[stage.chat ? "/workspaces/home" : "/settings/tili"]}>
            {stage.chat
              ? <Chat section={stage.section} back={() => setStage({ chat: false })} />
              : <SettingsPage direction={direction} go={(section) => setStage({ chat: true, section })} />}
          </MemoryRouter>
        </PiModelsProvider>
      </div>
      {note ? <p className="ii-toast" role="status" data-testid="toast">{note}</p> : null}
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
  button.textContent = n.replaceAll(" ", " ");
  if (i === 0) { button.setAttribute("data-active", ""); button.setAttribute("aria-current", "true"); }
  picker.append(button);
});
document.body.append(picker);
new Function("stage", "variants", pickerSource)(stageSink, variants);
