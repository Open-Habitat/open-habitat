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
import {
  ConversationFrame,
  ConversationStream,
} from "../../../../web/src/components/ConversationFrame";
import { ControlButton } from "../../../../web/src/components/ControlElements";
import { HabitatMark } from "../../../../web/src/components/HabitatMark";
import { Icon } from "../../../../web/src/components/Icon";
import { Markdown } from "../../../../web/src/components/Markdown";
import {
  AgentHeader,
  AppShell,
  WorkspaceNavRow,
  WorkspaceRail,
} from "../../../../web/src/components/Navigation";
import { OnboardingFrame } from "../../../../web/src/components/OnboardingFrame";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { statusText } from "../../../../web/src/text/status";
import "../../../../web/src/components/components.css";
import { type Chip, type QuestionId, TEXT, type Text } from "./text";
import "./round.css";

// new-user-agent-instructions-template (Jari 21.11.2026): onboarding ends in
// a first conversation where the agent talks with the person and writes
// their own instructions, ~/.pi/agent/AGENTS.md, which Claude's
// ~/.claude/CLAUDE.md imports. Nothing Habitat already injects (the Open
// Habitat environment block) goes in the file. An existing file is never
// overwritten: the agent proposes additions. The walkthrough is scripted;
// no model runs. Built on production pieces: OnboardingFrame for the end of
// the route, AppShell, the rail, AgentHeader, ConversationFrame and its
// timeline, UserMessage, AssistantMessage, ToolRow, Markdown, ControlButton
// and the Composer, whose beforeField slot carries the onboarding band. The
// round's own parts are the quick replies, the draft file card, the form
// card, the home reminder and the settings section.
setPersonalLanguage("fi");

const directions = ["1 Haastattelu", "2 Luonnos ensin", "3 Lomake"];
const params = new URLSearchParams(location.search);
const noop = () => {};
const PI_FILE = "~/.pi/agent/AGENTS.md";
const CLAUDE_FILE = "~/.claude/CLAUDE.md";

type Lang = "fi" | "en";
type Scenario = "fresh" | "existing";
type Section = "who" | "lang" | "style" | "ask" | "extra";
type Answers = Record<Section, string[]>;
type Item =
  | { k: "agent"; id: string; text: string; at: string }
  | { k: "me"; id: string; text: string; at: string }
  | { k: "tools"; id: string; rows: { tool: string; target: string }[] }
  | { k: "draft"; id: string; text: string; base?: string; state: "open" | "replaced" | "saved" }
  | { k: "form"; id: string; state: "open" | "sent" }
  | { k: "line"; id: string; text: string; done?: boolean };
type Phase = "ask" | "draft" | "change" | "form" | "saved" | "later";
type Chat = {
  items: Item[];
  phase: Phase;
  q: number;
  answers: Answers;
  seq: number;
  minute: number;
  saves: number;
  file?: string;
};

const sectionOf: Record<QuestionId, Section> = {
  name: "who",
  work: "who",
  lang: "lang",
  style: "style",
  ask: "ask",
  extra: "extra",
};
const questionsFor = (sc: Scenario): QuestionId[] =>
  sc === "existing"
    ? ["name", "work", "style", "ask", "extra"]
    : ["name", "lang", "work", "style", "ask", "extra"];
/** A change chip names a line one of the questions also offers. */
function sectionOfLine(t: Text, line: string): Section {
  for (const q of Object.keys(t.chips) as QuestionId[])
    if (t.chips[q].some((c) => c.line === line)) return sectionOf[q];
  return "extra";
}
const empty = (): Answers => ({ who: [], lang: [], style: [], ask: [], extra: [] });
const add = (a: Answers, s: Section, line: string): Answers =>
  a[s].includes(line) ? a : { ...a, [s]: [...a[s], line] };

// ---------- The template the agent fills ----------

function buildDraft(t: Text, a: Answers, sc: Scenario): { text: string; base?: string } {
  const sections: [string, string[]][] = [
    [t.draft.who, a.who],
    [t.draft.lang, sc === "existing" ? [] : a.lang],
    [t.draft.style, a.style],
    [t.draft.ask, a.ask],
    [t.draft.extra, a.extra],
  ];
  const body = sections
    .filter(([, lines]) => lines.length)
    .map(([h, lines]) => `${h}\n\n${lines.map((l) => `- ${l}`).join("\n")}`)
    .join("\n\n");
  if (sc === "existing") return { base: t.existing, text: `${t.existing}\n\n${body}` };
  return { text: `${t.draft.title(t.person)}\n\n${t.draft.lead}\n\n${body}` };
}

// ---------- The script ----------

const clock = (c: Chat) => `14.${String(c.minute).padStart(2, "0")}`;
function push(c: Chat, ...items: Omit<Item, "id">[]): Chat {
  let seq = c.seq;
  const minute = c.minute + 1;
  const at = `14.${String(minute).padStart(2, "0")}`;
  const added = items.map((i) => ({ ...i, id: `i${++seq}`, ...("at" in i ? { at } : {}) }) as Item);
  return { ...c, seq, minute, items: [...c.items, ...added] };
}
const agent = (text: string) => ({ k: "agent" as const, text, at: "" });
const me = (text: string) => ({ k: "me" as const, text, at: "" });
const retire = (c: Chat): Chat => ({
  ...c,
  items: c.items.map((i) => (i.k === "draft" && i.state === "open" ? { ...i, state: "replaced" as const } : i)),
});

function begin(d: number, t: Text, sc: Scenario, lang: Lang): Chat {
  const c: Chat = { items: [], phase: "ask", q: 0, answers: empty(), seq: 0, minute: 4, saves: 0 };
  if (d === 0) {
    const qs = questionsFor(sc);
    return push(c, agent(`${sc === "existing" ? t.helloExisting : t.hello}\n\n${t.qIntro(qs.length)}`), agent(t.questions[qs[0]]));
  }
  if (d === 1) {
    let answers = empty();
    answers = add(answers, "who", t.chips.name[0].line!);
    answers = add(answers, "who", t.bio);
    if (sc === "fresh") answers = add(answers, "lang", t.chips.lang[lang === "fi" ? 0 : 2].line!);
    const draft = buildDraft(t, answers, sc);
    return {
      ...push(
        { ...c, answers },
        agent(sc === "existing" ? t.knownExisting : t.known),
        { k: "draft", ...draft, state: "open" },
        agent(t.twoMissing),
      ),
      phase: "change",
    };
  }
  return { ...push(c, agent(sc === "existing" ? t.formLeadExisting : t.formLead), { k: "form", state: "open" }), phase: "form" };
}

function showDraft(c0: Chat, t: Text, sc: Scenario, lead?: string): Chat {
  const c = retire(c0);
  const draft = buildDraft(t, c.answers, sc);
  return {
    ...push(c, agent(lead ?? (sc === "existing" ? t.draftReadyExisting : t.draftReady)), { k: "draft", ...draft, state: "open" }),
    phase: "draft",
  };
}

function save(c0: Chat, t: Text, sc: Scenario): Chat {
  const open = [...c0.items].reverse().find((i) => i.k === "draft" && i.state === "open") as
    | Extract<Item, { k: "draft" }>
    | undefined;
  if (!open) return c0;
  const c = { ...c0, items: c0.items.map((i) => (i === open ? { ...open, state: "saved" as const } : i)) };
  const verb = sc === "existing" || c.saves > 0 ? "edit" : "write";
  const rows = [{ tool: verb, target: PI_FILE }];
  if (c.saves === 0) rows.push({ tool: sc === "existing" ? "edit" : "write", target: CLAUDE_FILE });
  const after =
    c.saves === 0
      ? push(c, { k: "tools", rows }, agent(t.saved), { k: "line", text: t.doneLine, done: true })
      : push(c, { k: "tools", rows }, agent(t.savedAgain));
  return { ...after, phase: "saved", saves: c.saves + 1, file: open.text };
}

/** The person answers: a quick reply or their own words. */
function answer(c: Chat, t: Text, sc: Scenario, d: number, lang: Lang, chip?: Chip, own?: string): Chat {
  const said = own ?? chip!.label;
  if (chip?.action === "save") return save(push(c, me(said)), t, sc);
  if (c.phase === "ask") {
    const qs = questionsFor(sc);
    const q = qs[c.q];
    let next = push(c, me(said));
    if (chip?.action !== "draft") {
      const line = own ?? chip?.line;
      if (line) next = { ...next, answers: add(next.answers, sectionOf[q], line) };
    }
    const n = c.q + 1;
    if (chip?.action === "draft" || n >= qs.length) return showDraft(next, t, sc);
    const prefix = sc === "existing" && qs[n] === "work" ? `${t.langKnown}\n\n` : "";
    return { ...push(next, agent(prefix + t.questions[qs[n]])), q: n };
  }
  if (c.phase === "form") {
    const next = push(c, me(said), agent(t.freeNoted));
    return { ...next, answers: add(next.answers, "extra", said) };
  }
  if (c.phase === "later") return begin(d, t, sc, lang);
  // A change: to an open draft, or after saving, a new draft to save again.
  const line = own ?? chip?.line;
  let next = push(c, me(said));
  if (line) next = { ...next, answers: add(next.answers, own ? "extra" : sectionOfLine(t, line), line) };
  return { ...showDraft(next, t, sc, t.tweaked), phase: "change" };
}

function later(c: Chat, t: Text): Chat {
  return { ...push(retire(c), agent(t.later), { k: "line", text: t.doneLine, done: true }), phase: "later" };
}

// ---------- Review state ----------

let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: Lang = params.get("lang") === "en" ? "en" : "fi";
let reviewScenario: Scenario = params.get("scenario") === "existing" ? "existing" : "fresh";
// The default view is the conversation, where the directions differ; Alkuun
// replays the whole walkthrough from the end of the onboarding route.
const landingFirst = params.get("stage") === "landing";
const LangContext = React.createContext<Lang>("fi");
const useT = () => TEXT[React.useContext(LangContext)];

type Stage = "landing" | "chat" | "home" | "settings";
type Act = {
  chip: (c: Chip) => void;
  save: () => void;
  change: () => void;
  form: (a: Answers, summary: string) => void;
  go: (s: Stage) => void;
};

// ---------- Round pieces ----------

function HabitatLine({ children, testId, actions }: { children: ReactNode; testId: string; actions?: ReactNode }) {
  const t = useT();
  return (
    <div className="oi-line" data-testid={testId}>
      <HabitatMark size={16} state="idle" />
      <span className="oi-line-who">{t.habitat}</span>
      <span className="oi-line-text">{children}</span>
      {actions ? <span className="oi-line-actions">{actions}</span> : null}
    </div>
  );
}

function Chips({ chips, act, skip }: { chips: Chip[]; act: Act; skip?: boolean }) {
  const t = useT();
  return (
    <div className="oi-chips" data-testid="quick-replies" role="group" aria-label={t.composerPlaceholder}>
      {chips.map((c) => (
        <ControlButton key={c.label} size="row" variant={c.action === "save" ? "primary" : "secondary"} data-testid="quick-reply" onPress={() => act.chip(c)}>
          {c.label}
        </ControlButton>
      ))}
      {skip ? (
        <ControlButton size="row" variant="quiet" data-testid="quick-skip" onPress={() => act.chip({ label: t.skipChip })}>
          {t.skipChip}
        </ControlButton>
      ) : null}
    </div>
  );
}

function DraftCard({ item, act, sc }: { item: Extract<Item, { k: "draft" }>; act: Act; sc: Scenario }) {
  const t = useT();
  const lines = item.text.split("\n");
  const baseCount = item.base ? item.base.split("\n").length : 0;
  const tag =
    item.state === "replaced" ? t.draftReplaced : item.state === "saved" ? t.draftSavedTag : item.base ? t.draftMerge : t.draftNew;
  return (
    <section className="oi-draft" data-testid="draft-card" data-state={item.state} data-mode={item.base ? "merge" : "new"}>
      <header>
        <Icon name="file" aria-hidden="true" />
        <code className="oi-path">{PI_FILE}</code>
        <span className="oi-tag" data-state={item.state}>
          {item.state === "saved" ? <Icon name="check" aria-hidden="true" /> : null}
          {tag}
        </span>
      </header>
      {item.state === "replaced" ? null : (
        <pre className="oi-file" data-testid="draft-file">
          {lines.map((l, i) => {
            const added = item.base ? i >= baseCount && l.trim() !== "" : false;
            return (
              <span key={i} className="oi-row" data-added={added ? "true" : undefined} data-kept={item.base && i < baseCount ? "true" : undefined}>
                {item.base ? (
                  <span className="oi-mark" aria-hidden="true">
                    {added ? "+" : " "}
                  </span>
                ) : null}
                {l || " "}
                {"\n"}
              </span>
            );
          })}
        </pre>
      )}
      {item.state === "open" ? (
        <>
          <p className="oi-note" data-testid="draft-claude">
            <Icon name="info" aria-hidden="true" />
            <span>{sc === "existing" ? t.claudeExisting : t.claudeNew}</span>
          </p>
          <p className="oi-note oi-safe">{t.safeNote}</p>
          <footer>
            <ControlButton size="row" variant="primary" data-testid="draft-save" onPress={act.save}>
              {item.base ? t.saveMerge : t.save}
            </ControlButton>
            <ControlButton size="row" data-testid="draft-change" onPress={act.change}>
              {t.change}
            </ControlButton>
          </footer>
        </>
      ) : null}
    </section>
  );
}

function FormCard({ item, act, sc, extraSeed }: { item: Extract<Item, { k: "form" }>; act: Act; sc: Scenario; extraSeed: string[] }) {
  const t = useT();
  const [name, setName] = useState(t.first);
  const [lang, setLang] = useState(0);
  const [work, setWork] = useState<number[]>([]);
  const [workFree, setWorkFree] = useState("");
  const [style, setStyle] = useState<number | undefined>();
  const [ask, setAsk] = useState<number[]>([]);
  const [extra, setExtra] = useState("");
  const sent = item.state === "sent";
  const toggle = (list: number[], i: number) => (list.includes(i) ? list.filter((x) => x !== i) : [...list, i]);
  const submit = () => {
    let a = empty();
    let n = 0;
    if (name.trim()) {
      a = add(a, "who", t.chips.name[0].line!.replace(t.first, name.trim()));
      n++;
    }
    work.forEach((i) => (a = add(a, "who", t.chips.work[i].line!)));
    if (workFree.trim()) a = add(a, "who", workFree.trim());
    if (work.length || workFree.trim()) n++;
    if (sc === "fresh") {
      a = add(a, "lang", t.chips.lang[lang].line!);
      n++;
    }
    if (style !== undefined) {
      a = add(a, "style", t.chips.style[style].line!);
      n++;
    }
    ask.forEach((i) => (a = add(a, "ask", t.chips.ask[i].line!)));
    if (ask.length) n++;
    for (const e of [...extraSeed, extra.trim()].filter(Boolean)) a = add(a, "extra", e);
    if (extra.trim()) n++;
    act.form(a, t.form.sentSummary(n));
  };
  return (
    <form
      className="oi-form"
      data-testid="form-card"
      data-state={item.state}
      onSubmit={(e) => {
        e.preventDefault();
        if (!sent) submit();
      }}
    >
      <header>
        <Icon name="user" aria-hidden="true" />
        <strong>{t.form.title}</strong>
        {sent ? <span className="oi-tag" data-state="saved">{t.form.sent}</span> : null}
      </header>
      <fieldset disabled={sent}>
        <label className="oi-field">
          <span>{t.form.name}</span>
          <input data-testid="form-name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="oi-field" role="radiogroup" aria-label={t.form.lang}>
          <span>{t.form.lang}</span>
          {sc === "existing" ? (
            <small>{t.form.langHas}</small>
          ) : (
            <span className="oi-options">
              {t.chips.lang.map((c, i) => (
                <label key={c.label} className="oi-option">
                  <input type="radio" name="oi-lang" checked={lang === i} onChange={() => setLang(i)} />
                  {c.label}
                </label>
              ))}
            </span>
          )}
        </div>
        <div className="oi-field">
          <span>{t.form.work}</span>
          <span className="oi-options">
            {t.chips.work.map((c, i) => (
              <label key={c.label} className="oi-option">
                <input type="checkbox" data-testid={`form-work-${i}`} checked={work.includes(i)} onChange={() => setWork(toggle(work, i))} />
                {c.label}
              </label>
            ))}
          </span>
          <input data-testid="form-work-free" placeholder={t.form.workFree} aria-label={t.form.workFree} value={workFree} onChange={(e) => setWorkFree(e.target.value)} />
        </div>
        <div className="oi-field" role="radiogroup" aria-label={t.form.style}>
          <span>{t.form.style}</span>
          <span className="oi-options">
            {t.chips.style.map((c, i) => (
              <label key={c.label} className="oi-option">
                <input type="radio" name="oi-style" data-testid={`form-style-${i}`} checked={style === i} onChange={() => setStyle(i)} />
                {c.label}
              </label>
            ))}
          </span>
        </div>
        <div className="oi-field">
          <span>{t.form.ask}</span>
          <span className="oi-options">
            {t.chips.ask.slice(0, 2).map((c, i) => (
              <label key={c.label} className="oi-option">
                <input type="checkbox" data-testid={`form-ask-${i}`} checked={ask.includes(i)} onChange={() => setAsk(toggle(ask, i))} />
                {c.label}
              </label>
            ))}
          </span>
        </div>
        <label className="oi-field">
          <span>{t.form.extra}</span>
          <textarea data-testid="form-extra" rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} />
        </label>
      </fieldset>
      {sent ? null : (
        <footer>
          <ControlButton size="row" variant="primary" type="submit" data-testid="form-submit">
            {t.form.submit}
          </ControlButton>
        </footer>
      )}
    </form>
  );
}

function Thread({ c, act, sc, d }: { c: Chat; act: Act; sc: Scenario; d: number }) {
  const t = useT();
  const items: { id: string; kind?: string; content: ReactNode }[] = [];
  for (const i of c.items) {
    if (i.k === "me")
      items.push({
        id: i.id,
        kind: "user",
        content: (
          <div data-testid="person-message">
            <UserMessage sourceText={i.text} onCopy={noop} time={i.at}>
              <Markdown text={i.text} />
            </UserMessage>
          </div>
        ),
      });
    else if (i.k === "agent")
      items.push({
        id: i.id,
        kind: "assistant",
        content: (
          <div data-testid="agent-reply">
            <AssistantMessage streamState="complete" time={i.at} onCopy={noop}>
              <Markdown text={i.text} />
            </AssistantMessage>
          </div>
        ),
      });
    else if (i.k === "tools")
      i.rows.forEach((r, n) =>
        items.push({
          id: `${i.id}-${n}`,
          kind: "tool",
          content: (
            <div data-testid="file-tool" data-tool-target={r.target} data-tool={r.tool}>
              <ToolRow name={r.tool} targetText={r.target} statusLabel={t.draftSavedTag} state="succeeded" expanded={false} onToggle={noop} />
            </div>
          ),
        }),
      );
    else if (i.k === "draft") items.push({ id: i.id, content: <DraftCard item={i} act={act} sc={sc} /> });
    else if (i.k === "form")
      items.push({ id: i.id, content: <FormCard item={i} act={act} sc={sc} extraSeed={c.answers.extra} /> });
    else
      items.push({
        id: i.id,
        content: (
          <HabitatLine
            testId={i.done ? "done-line" : "habitat-line"}
            actions={
              i.done ? (
                <>
                  <ControlButton size="row" variant="primary" data-testid="to-workspaces" onPress={() => act.go("home")}>
                    {t.toWorkspaces}
                  </ControlButton>
                  <ControlButton size="row" data-testid="to-settings" onPress={() => act.go("settings")}>
                    {t.openSettings}
                  </ControlButton>
                </>
              ) : undefined
            }
          >
            {i.text}
          </HabitatLine>
        ),
      });
  }
  const chips =
    c.phase === "ask"
      ? { list: t.chips[questionsFor(sc)[c.q]], skip: questionsFor(sc)[c.q] !== "extra" }
      : c.phase === "change"
        ? {
            list:
              d === 1 && !c.items.some((i) => i.k === "me")
                ? [...t.chips.style.slice(0, 2), ...t.chips.ask.slice(0, 2), t.changeChips[3]]
                : t.changeChips,
            skip: false,
          }
        : undefined;
  if (chips) items.push({ id: `chips-${c.seq}`, content: <Chips chips={chips.list} act={act} skip={chips.skip} /> });
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

/** The onboarding band above the field: where in the conversation, and the way out. */
function Band({ c, sc, d, onLater }: { c: Chat; sc: Scenario; d: number; onLater: () => void }) {
  const t = useT();
  if (c.phase === "saved" || c.phase === "later") return null;
  const qs = questionsFor(sc);
  const where =
    c.phase === "ask" ? t.bandStep(c.q + 1, qs.length) : c.phase === "form" ? t.bandForm : t.bandDraft;
  return (
    <div className="oi-band" data-testid="onboarding-band" data-direction={d}>
      <HabitatMark size={14} state="idle" />
      <span className="oi-band-label">{t.bandLabel}</span>
      <span className="oi-band-where" data-testid="band-where">
        {where}
      </span>
      <ControlButton size="inline" variant="quiet" data-testid="band-later" onPress={onLater}>
        {t.bandLater}
      </ControlButton>
    </div>
  );
}

function Landing({ sc, go, onLater }: { sc: Scenario; go: () => void; onLater: () => void }) {
  const t = useT();
  return (
    <div className="oi-landing" data-testid="landing">
      <OnboardingFrame step="done">
        <main className="oi-land">
          <h1>{t.landTitle}</h1>
          <p>{t.landLead}</p>
          {sc === "existing" ? <p className="oi-land-existing" data-testid="landing-existing">{t.landExisting}</p> : null}
          <p className="oi-land-time">{t.landTime}</p>
          <div className="oi-land-actions">
            <ControlButton size="page" variant="primary" data-testid="landing-start" onPress={go}>
              {sc === "existing" ? t.landStartExisting : t.landStart}
            </ControlButton>
            <ControlButton size="page" data-testid="landing-later" onPress={onLater}>
              {t.landLater}
            </ControlButton>
          </div>
        </main>
      </OnboardingFrame>
    </div>
  );
}

function Home({ c, sc, go }: { c: Chat; sc: Scenario; go: (s: Stage) => void }) {
  const t = useT();
  return (
    <div className="oi-page" data-testid="home">
      <h1>{t.homeTitle}</h1>
      <p className="oi-page-meta">{t.homeEmpty}</p>
      {sc === "fresh" && !c.saves ? (
        <section className="oi-remind" data-testid="home-reminder">
          <header>
            <Icon name="user" aria-hidden="true" />
            <strong>{t.remindTitle}</strong>
          </header>
          <p>{t.remindLead}</p>
          <ControlButton size="row" variant="primary" data-testid="reminder-start" onPress={() => go("chat")}>
            {t.remindStart}
          </ControlButton>
        </section>
      ) : null}
      <ul className="oi-workspaces">
        <li>
          <Icon name="repo" aria-hidden="true" />
          <code>{t.workspace}</code>
        </li>
      </ul>
    </div>
  );
}

function Settings({ c, sc, file, setFile, go }: { c: Chat; sc: Scenario; file?: string; setFile: (s: string) => void; go: (s: Stage) => void }) {
  const t = useT();
  const [editing, setEditing] = useState<string | undefined>();
  const shown = file ?? (sc === "existing" ? t.existing : undefined);
  return (
    <div className="oi-page" data-testid="settings">
      <p className="oi-page-meta">{t.settingsCrumb}</p>
      <h1>{t.settingsTitle}</h1>
      <p>{t.settingsLead}</p>
      {shown === undefined ? (
        <section className="oi-remind" data-testid="settings-empty">
          <header>
            <Icon name="user" aria-hidden="true" />
            <strong>{t.remindTitle}</strong>
          </header>
          <p>{t.remindLead}</p>
          <ControlButton size="row" variant="primary" onPress={() => go("chat")}>
            {t.remindStart}
          </ControlButton>
        </section>
      ) : (
        <section className="oi-settings-file" data-testid="settings-file">
          <header>
            <Icon name="file" aria-hidden="true" />
            <code className="oi-path">{PI_FILE}</code>
            <span className="oi-page-meta">
              {c.saves ? `${t.settingsUpdated} ${clock(c)}` : ""}
            </span>
          </header>
          <p className="oi-note">
            <Icon name="info" aria-hidden="true" />
            <span>
              <code>{CLAUDE_FILE}</code> → <code>@{PI_FILE}</code>
            </span>
          </p>
          {editing === undefined ? (
            <div className="oi-rendered">
              <Markdown text={shown} />
            </div>
          ) : (
            <>
              <textarea className="oi-editor" data-testid="settings-editor" rows={14} value={editing} onChange={(e) => setEditing(e.target.value)} />
              <p className="oi-note oi-safe">{t.settingsEditing}</p>
            </>
          )}
          <footer>
            {editing === undefined ? (
              <>
                <ControlButton size="row" data-testid="settings-chat" onPress={() => go("chat")}>
                  {t.settingsChat}
                </ControlButton>
                <ControlButton size="row" data-testid="settings-edit" onPress={() => setEditing(shown)}>
                  {t.settingsEdit}
                </ControlButton>
              </>
            ) : (
              <>
                <ControlButton
                  size="row"
                  variant="primary"
                  data-testid="settings-save"
                  onPress={() => {
                    setFile(editing);
                    setEditing(undefined);
                  }}
                >
                  {t.settingsSave}
                </ControlButton>
                <ControlButton size="row" onPress={() => setEditing(undefined)}>
                  {t.settingsCancel}
                </ControlButton>
              </>
            )}
          </footer>
        </section>
      )}
    </div>
  );
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  const t = useT();
  const status = useText(statusText);
  const rail = (
    <WorkspaceRail
      collapsed={false}
      serverLabel="Habitat"
      connectionLabel={status.connected}
      connectionTone="success"
      filterValue=""
      resultSummary="1"
      listState="ready"
      onToggle={noop}
      onFilter={noop}
      onRefresh={noop}
      sessionActions={<AccountShelf profile={{ name: t.person, email: "", avatar_url: "" }} onSettings={noop} onLogout={noop} />}
    >
      <WorkspaceNavRow name={t.workspace} href={`/workspaces/${t.workspace}`} />
    </WorkspaceRail>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={title} rail={rail} main={<div className="oi-main" id="main">{children}</div>} />
    </StatusBellProvider>
  );
}

function Main({ d, sc, lang, from }: { d: number; sc: Scenario; lang: Lang; from: Stage }) {
  const t = useT();
  const [stage, setStage] = useState<Stage>(from);
  const [c, setC] = useState<Chat>(() => begin(d, t, sc, lang));
  const [file, setFile] = useState<string | undefined>();
  const [draft, setDraft] = useState("");
  const act: Act = {
    chip: (chip) => setC((x) => answer(x, t, sc, d, lang, chip)),
    save: () =>
      setC((x) => {
        const n = save(x, t, sc);
        setFile(n.file);
        return n;
      }),
    change: () => setC((x) => ({ ...push(x, agent(t.whatChange)), phase: "change" })),
    form: (a, summary) =>
      setC((x) =>
        showDraft(
          {
            ...push({ ...x, items: x.items.map((i) => (i.k === "form" ? { ...i, state: "sent" as const } : i)) }, me(summary)),
            answers: a,
          },
          t,
          sc,
        ),
      ),
    go: setStage,
  };
  const send = (text?: string) => {
    const body = (text ?? draft).trim();
    if (!body) return;
    setC((x) => answer(x, t, sc, d, lang, undefined, body));
    setDraft("");
  };
  if (stage === "landing")
    return (
      <Landing
        sc={sc}
        go={() => setStage("chat")}
        onLater={() => {
          setC((x) => ({ ...x, phase: "later" }));
          setStage("home");
        }}
      />
    );
  if (stage === "home")
    return (
      <Shell title={t.homeTitle}>
        <Home
          c={c}
          sc={sc}
          go={(s) => {
            if (s === "chat" && c.phase === "later") setC(begin(d, t, sc, lang));
            setStage(s);
          }}
        />
      </Shell>
    );
  if (stage === "settings")
    return (
      <Shell title={t.settingsTitle}>
        <Settings
          c={c}
          sc={sc}
          file={file}
          setFile={setFile}
          go={(s) => {
            if (s === "chat" && c.phase === "later") setC(begin(d, t, sc, lang));
            setStage(s);
          }}
        />
      </Shell>
    );
  return (
    <Shell title={t.convTitle}>
      <div className="oi-conv" data-testid="conversation" data-direction={d}>
        <ConversationFrame>
          <AgentHeader
            title={t.convTitle}
            workspaceLabel={t.home}
            workspaceHref="/"
            activityLabel=""
            controlLabel=""
            detailsExpanded={false}
            onToggleDetails={noop}
          />
          <ConversationStream>
            <Thread c={c} act={act} sc={sc} d={d} />
          </ConversationStream>
          <Composer
            value={draft}
            onChange={setDraft}
            activity="idle"
            selectedWorkingMode="steer"
            onModeChange={noop}
            onSendNow={send}
            onSteer={send}
            onFollowUp={send}
            idlePlaceholder={t.composerPlaceholder}
            beforeField={<Band c={c} sc={sc} d={d} onLater={() => setC((x) => later(x, t))} />}
          />
        </ConversationFrame>
      </div>
    </Shell>
  );
}

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(reviewLanguage);
  const [scenario, setScenario] = useState(reviewScenario);
  const [run, setRun] = useState(0);
  const [from, setFrom] = useState<"landing" | "chat">(landingFirst ? "landing" : "chat");
  const t = TEXT[language];
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
    document.documentElement.lang = language;
  }, [theme, language]);
  return (
    <LangContext.Provider value={language}>
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
                  reviewLanguage = e.target.value as Lang;
                  setPersonalLanguage(reviewLanguage);
                  setLanguage(reviewLanguage);
                  setFrom("chat");
                  setRun((r) => r + 1);
                }}
              >
                <option value="fi">suomi</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>
              {t.scenario}{" "}
              <select
                id="scenario"
                value={scenario}
                onChange={(e) => {
                  reviewScenario = e.target.value as Scenario;
                  setScenario(reviewScenario);
                  setFrom("chat");
                  setRun((r) => r + 1);
                }}
              >
                <option value="fresh">{t.scenarios.fresh}</option>
                <option value="existing">{t.scenarios.existing}</option>
              </select>
            </label>
            <span className="ra-hint">{t.hint}</span>
            <button
              type="button"
              className="ra-event"
              data-testid="event-reset"
              onClick={() => {
                setFrom("landing");
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
          <MemoryRouter key={run} initialEntries={["/"]}>
            <Main key={`${direction}-${language}-${scenario}-${run}`} d={direction} sc={scenario} lang={language} from={from} />
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
