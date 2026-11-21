import React, { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import { AccountShelf } from "../../../../web/src/components/Account";
import { AIOfferList, type AIOption } from "../../../../web/src/components/AIOfferList";
import { AssistantMessage, ToolRow, UserMessage } from "../../../../web/src/components/Conversation";
import { ControlButton } from "../../../../web/src/components/ControlElements";
import { GitHubRepoChooser } from "../../../../web/src/components/GitHubRepoChooser";
import { Icon } from "../../../../web/src/components/Icon";
import { LoginCard } from "../../../../web/src/components/LoginCard";
import { Markdown } from "../../../../web/src/components/Markdown";
import { AppShell, WorkspaceNavRow, WorkspaceRail } from "../../../../web/src/components/Navigation";
import {
  OnboardingFrame,
  OnboardingRoute,
  type OnboardingRouteStep,
  type OnboardingStepId,
} from "../../../../web/src/components/OnboardingFrame";
import { PiDeviceSignIn } from "../../../../web/src/components/PiDeviceSignIn";
import { Button, Select, TextArea } from "../../../../web/src/components/Primitives";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { githubOnboardingText } from "../../../../web/src/text/githubOnboarding";
import { piOnboardingText } from "../../../../web/src/text/piOnboarding";
import { statusText } from "../../../../web/src/text/status";
import "../../../../web/src/components/components.css";
import { InstructionsEditor } from "../2026-11-21-instructions-settings-2/editor";
import { ANSWER_LANGS, type AnswerLang, TEXT, type Text } from "./text";
import "./round.css";

// new-user-agent-instructions-template, round 4 (Jari 21.11.2026 on round 3:
// A2 Muistilappu's words are best, A3 Esittely's field behaviour is best —
// the person edits a free-form text themselves). The step stays the last one
// of the onboarding route and stays a small conversation in A2's words. The
// note is free-form Markdown shown in the shared instructions editor
// (../2026-11-21-instructions-settings-2/editor.tsx), the same block Settings
// › Tili › Ohjeet agentille uses: it opens in Esikatselu, Muokkaa shows the
// raw text, Tallenna writes. New in this round: a step for the person's own
// words (the agent may fix capitals and punctuation, the words stay theirs)
// and the language the agent answers in, preselected from Habitat's
// language. The variants differ in where those two sit:
//   A4.1 Keskustelu  the language is the agent's first question, the
//                   own words its last; the note at the end;
//   A4.2 Ensin itse  the person writes first and picks the language on
//                   a card above the conversation; the agent asks only
//                   what is missing;
//   A4.3 Vieressä    the note is on screen beside the conversation from
//                   the start, the language at its top and the own
//                   words under it; editing opens when the questions
//                   are done.
// Kept from round 3: the note is shown before Save, nothing technical (paths,
// AGENTS.md, Pi, Claude) is said in the step, and its conversation never
// appears in the rail. The agent's turns are scripted; no model runs.

const directions = ["A4.1 Keskustelu", "A4.2 Ensin itse", "A4.3 Vieressä"];
const CHAT = 0, OWN_FIRST = 1, SIDE = 2;
const params = new URLSearchParams(location.search);
const noop = () => {};
const PI_FILE = "~/.pi/agent/AGENTS.md";
const CLAUDE_FILE = "~/.claude/CLAUDE.md";

type Lang = "fi" | "en";
type Scenario = "fresh" | "existing";
type Stage = "login" | "repos" | "ai" | "instructions" | "home";
type Outcome = "saved" | "merged" | "later" | "kept";
type Question = "lang" | "confirm" | "style" | "ask" | "own" | "tidy";
/** What the agent has for the note: the same facts in every variant. */
type Fields = {
  /** The answer language; undefined until A4.1 asks it. */
  lang?: AnswerLang;
  work?: boolean;
  style?: number;
  ask?: number;
  /** The person's own words, exactly as they will be written. */
  own?: string;
  /** A4.2/A4.3: the own-words card or box was answered or skipped. */
  ownDone?: boolean;
};
type Msg = { id: number; who: "agent" | "me"; text: string };

let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: Lang = params.get("lang") === "en" ? "en" : "fi";
let reviewScenario: Scenario = params.get("scenario") === "existing" ? "existing" : "fresh";
const startStage: Stage = params.get("stage") === "login" ? "login" : "instructions";
const startRevealed = params.get("stage") === "reveal";
const LangContext = React.createContext<Lang>("fi");
const useT = () => TEXT[React.useContext(LangContext)];
(globalThis as { __roundStepLabel?: () => string }).__roundStepLabel = () => TEXT[reviewLanguage].stepLabel;
const StartContext = React.createContext<{ stage: Stage; revealed: boolean }>({ stage: "instructions", revealed: false });
const INSTRUCTIONS = "instructions" as unknown as OnboardingStepId;

/** The agent's questions, in order, for a variant and account. */
function questions(d: number, sc: Scenario): Question[] {
  if (d === CHAT) return [...(sc === "existing" ? [] : (["lang"] as Question[])), "confirm", "style", "ask", "own"];
  return ["confirm", "style", "ask"];
}

// ---------- The person's words, tidied the least possible ----------

/** Capitals at sentence starts and on the few names the agent recognises,
 * a full stop at the end. Nothing else changes: the words stay theirs. */
function tidy(raw: string): string {
  const names = ["tampere", "tampereella", "tampereelle", "helsinki", "helsingissä", "python"];
  let s = raw.trim().replace(/\s+/g, " ");
  s = s.replace(/\b\p{L}+\b/gu, (w) => (names.includes(w.toLowerCase()) ? w[0].toUpperCase() + w.slice(1) : w));
  s = s.replace(/\bi\b/g, "I").replace(/\bdont\b/g, "don't");
  s = s.replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_, a: string, b: string) => a + b.toUpperCase());
  if (!/[.!?]$/.test(s)) s += ".";
  return s;
}

// ---------- The note the agent writes ----------

/** Exactly what would be written: free-form Markdown, the person's own
 * words under their own heading so later edits by the agent leave them be. */
function noteText(t: Text, f: Fields, sc: Scenario): string {
  const choose = <T,>(v: number | undefined, list: T[]) => (v === undefined ? undefined : list[v]);
  const lang = sc === "existing" ? undefined : f.lang;
  const p1 = [sc === "existing" ? "" : t.note.me(t.person), f.work ? t.note.work : ""].filter(Boolean).join(" ");
  const p2 = [lang ? t.langLine[lang] : "", choose(f.style, t.choices.style)?.prose ?? ""].filter(Boolean).join(" ");
  const p3 = choose(f.ask, t.choices.ask)?.prose ?? "";
  const own = f.own ? `${t.note.own}\n\n${f.own}` : "";
  const body = [p1, p2, p3, own].filter(Boolean);
  if (sc === "existing") return [t.existing, t.note.titleAdded, ...body].join("\n\n");
  return [t.note.title, ...body].join("\n\n");
}

// ---------- The conversation ----------

function Bubble({ m }: { m: Msg }) {
  return m.who === "agent" ? (
    <div data-testid="agent-reply">
      <AssistantMessage streamState="complete" onCopy={noop}>
        <Markdown text={m.text} />
      </AssistantMessage>
    </div>
  ) : (
    <div data-testid="person-message">
      <UserMessage sourceText={m.text} onCopy={noop}>
        <Markdown text={m.text} breaks />
      </UserMessage>
    </div>
  );
}

/** The own-words field: in A4.1 the conversation's last turn, in A4.2 the
 * card before it, in A4.3 the box under the note. */
function OwnWords({
  title,
  lead,
  submitLabel,
  skipLabel,
  onSubmit,
  onSkip,
  testid,
  initial = "",
}: {
  title: string;
  lead: string;
  submitLabel: string;
  skipLabel: string;
  onSubmit: (s: string) => void;
  onSkip?: () => void;
  testid: string;
  initial?: string;
}) {
  const t = useT();
  const [v, setV] = useState(initial);
  return (
    <div className="oi-own" data-testid={testid}>
      <TextArea data-testid="own-field" label={title} hint={lead} placeholder={t.ownPlaceholder} rows={4} value={v} onChange={setV} />
      <div className="oi-own-actions">
        {onSkip ? (
          <ControlButton size="row" variant="quiet" data-testid="own-skip" onPress={onSkip}>
            {skipLabel}
          </ControlButton>
        ) : null}
        <ControlButton
          size="row"
          variant="primary"
          data-testid="own-submit"
          isDisabled={!v.trim() && !onSkip}
          onPress={() => {
            if (!v.trim()) return onSkip?.();
            onSubmit(v.trim());
            setV("");
          }}
        >
          {submitLabel}
        </ControlButton>
      </div>
    </div>
  );
}

/** The answer language: preselected from Habitat's language. */
function LangChoice({ value, onChange, ui, sc, compact }: { value: AnswerLang; onChange: (l: AnswerLang) => void; ui: Lang; sc: Scenario; compact?: boolean }) {
  const t = useT();
  if (sc === "existing")
    return (
      <p className="oi-lang oi-dim" data-testid="lang-choice" data-existing="true">
        <Icon name="info" aria-hidden="true" />
        {t.langExisting}
      </p>
    );
  return (
    <div className={`oi-lang ${compact ? "oi-lang-compact" : ""}`} data-testid="lang-choice">
      <Select label={t.langLabel} value={value} onChange={onChange} options={ANSWER_LANGS.map((l) => ({ value: l, label: t.langName[l] }))} />
      <p className="oi-dim" data-testid="lang-default">
        {value === ui ? t.langDefault(t.langName[ui]) : t.langOther}
      </p>
    </div>
  );
}

function Step({ d, sc, ui, onDone }: { d: number; sc: Scenario; ui: Lang; onDone: (o: Outcome, text: string) => void }) {
  const t = useT();
  const start = React.useContext(StartContext);
  const [f, setF] = useState<Fields>(() =>
    start.revealed
      ? { lang: ui, work: true, style: 1, ask: 0, own: tidy(t.sampleOwn), ownDone: true }
      : { lang: d === CHAT ? undefined : ui },
  );
  const [queue, setQueue] = useState<Question[]>(() => (start.revealed ? [] : d === OWN_FIRST ? [] : questions(d, sc)));
  const [started, setStarted] = useState(start.revealed || d !== OWN_FIRST);
  const [pendingOwn, setPendingOwn] = useState<string>();
  const seq = useRef(10);
  const firstTurns = (): Msg[] => {
    if (start.revealed)
      return [
        { id: 1, who: "agent", text: sc === "existing" ? t.helloExisting : t.helloFirst },
        { id: 2, who: "agent", text: sc === "existing" ? t.readyExisting : d === SIDE ? t.readySide : t.ready },
      ];
    if (d === OWN_FIRST) return [];
    return [{ id: 1, who: "agent", text: sc === "existing" ? t.helloExisting : t.helloFirst }];
  };
  const [msgs, setMsgs] = useState<Msg[]>(firstTurns);
  const [finalText, setFinalText] = useState("");
  const say = (...m: Omit<Msg, "id">[]) => setMsgs((old) => [...old, ...m.map((x) => ({ ...x, id: seq.current++ }))]);
  const q = queue[0];
  const done = started && queue.length === 0;
  const revealed = done;
  const thread = useRef<HTMLDivElement>(null);
  const reveal = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = thread.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, q]);
  useEffect(() => {
    if (revealed && !start.revealed && d !== SIDE) reveal.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [revealed, start.revealed, d]);
  const readyLine = sc === "existing" ? t.readyExisting : d === SIDE ? t.readySide : t.ready;
  /** Moves past the current question; the hand-over turn when none is left. */
  const readySaid = useRef(start.revealed);
  const advance = (rest: Question[], extra: Omit<Msg, "id">[] = []) => {
    setQueue(rest);
    const hand = rest.length === 0 && !readySaid.current;
    if (hand) readySaid.current = true;
    say(...extra, ...(hand ? [{ who: "agent" as const, text: readyLine }] : []));
  };
  /** Own words arrive: shown as written; a tidier version is offered. */
  const ownArrives = (raw: string, rest: Question[], before: Omit<Msg, "id">[] = []) => {
    setF((o) => ({ ...o, own: raw, ownDone: true }));
    const fixed = tidy(raw);
    if (fixed !== raw) {
      setPendingOwn(fixed);
      setQueue(["tidy", ...rest]);
      say(...before);
    } else advance(rest, [...before, { who: "agent", text: t.ownAdded }]);
  };
  const chooseChip = (i: number) => {
    const rest = queue.slice(1);
    if (q === "lang") {
      const order = langOrder(ui);
      setF((o) => ({ ...o, lang: order[i] }));
      return advance(rest, [{ who: "me", text: t.langChip[order[i]] }]);
    }
    if (q === "confirm") {
      setF((o) => ({ ...o, work: i === 0 }));
      return advance(rest, [{ who: "me", text: i === 0 ? t.confirmYes : t.confirmNo }]);
    }
    if (q === "style") {
      setF((o) => ({ ...o, style: i }));
      return advance(rest, [{ who: "me", text: t.choices.style[i].label }]);
    }
    if (q === "ask") {
      setF((o) => ({ ...o, ask: i }));
      return advance(rest, [{ who: "me", text: t.choices.ask[i].label }]);
    }
    if (q === "tidy") {
      if (i === 1 && pendingOwn) setF((o) => ({ ...o, own: pendingOwn }));
      setPendingOwn(undefined);
      return advance(rest, [{ who: "me", text: i === 1 ? t.tidyUse : t.tidyKeep }, { who: "agent", text: i === 1 ? t.tidyUsed : t.tidyKept }]);
    }
  };
  const askText = (x: Question): string =>
    x === "lang" ? t.askLang(t.langName[ui]) : x === "confirm" ? t.confirmGitHub : x === "style" ? t.askStyle : x === "ask" ? t.askAsk : x === "own" ? t.askOwn : `${t.tidy}\n\n> ${pendingOwn ?? ""}`;
  const chips = (x: Question): { label: string; primary?: boolean }[] =>
    x === "lang"
      ? langOrder(ui).map((l, i) => ({ label: t.langChip[l], primary: i === 0 }))
      : x === "confirm"
        ? [{ label: t.confirmYes }, { label: t.confirmNo }]
        : x === "tidy"
          ? [{ label: t.tidyKeep }, { label: t.tidyUse }]
          : (x === "style" ? t.choices.style : t.choices.ask).map((c) => ({ label: c.label }));
  const note = noteText(t, f, sc);
  const keptPrefix = sc === "existing" ? t.existing : undefined;
  const later = (
    <Button data-testid="step-later" size="row" variant="quiet" label={sc === "existing" ? t.keep : t.later} onPress={() => onDone(sc === "existing" ? "kept" : "later", "")} />
  );
  const onDraft = useCallback((s: string) => setFinalText(s), []);
  const editor = (
    <InstructionsEditor
      key={d === SIDE ? "side" : "reveal"}
      value={note}
      label={t.editorLabel}
      keptPrefix={keptPrefix}
      alwaysSavable={done}
      saveLabel={sc === "existing" ? t.saveMerge : t.save}
      editLocked={done ? undefined : t.sideLocked}
      onDraft={onDraft}
      onSave={(text) => {
        onDone(sc === "existing" ? "merged" : "saved", text);
        return { ok: true };
      }}
      secondary={later}
      beforeActions={
        d === SIDE && !f.ownDone ? (
          <OwnWords
            testid="own-side"
            title={t.ownSideTitle}
            lead={t.ownSideLead}
            submitLabel={t.ownAdd}
            skipLabel=""
            onSubmit={(s) => ownArrives(s, queue, [{ who: "me", text: s }])}
          />
        ) : null
      }
    />
  );

  const chat = (
    <div className="oi-chat" data-testid="step-chat">
      <div className="oi-chat-thread" ref={thread} data-testid="step-thread">
        {msgs.map((m) => (
          <Bubble key={m.id} m={m} />
        ))}
        {q ? <Bubble m={{ id: 0, who: "agent", text: askText(q) }} /> : null}
        {q && q !== "own" ? (
          <div className="oi-chips" role="group" aria-label={askText(q)} data-testid="quick-replies" data-question={q}>
            {chips(q).map((c, i) => (
              <ControlButton key={c.label} size="row" variant={c.primary ? "primary" : "secondary"} data-testid="quick-reply" onPress={() => chooseChip(i)}>
                {c.label}
              </ControlButton>
            ))}
          </div>
        ) : null}
        {q === "own" ? (
          <OwnWords
            testid="own-step"
            title={t.ownTitle}
            lead={t.ownLead}
            submitLabel={t.ownAdd}
            skipLabel={t.ownSkip}
            onSubmit={(s) => ownArrives(s, queue.slice(1), [{ who: "me", text: s }])}
            onSkip={() => advance(queue.slice(1), [{ who: "me", text: t.ownSkipped }])}
          />
        ) : null}
      </div>
    </div>
  );

  const header = (
    <header>
      <p className="ah-eyebrow">{t.eyebrow}</p>
      <h1 id="oi-step-title" data-testid="instructions-title" tabIndex={-1}>
        {t.stepTitle}
      </h1>
      <p data-testid="instructions-lead">{sc === "existing" ? t.leadExisting : t.lead}</p>
    </header>
  );
  const setLang = (l: AnswerLang) => setF((o) => ({ ...o, lang: l }));

  return (
    <section
      className={`ah-onboarding-step oi-step oi-v${d}`}
      data-testid="instructions-step"
      data-direction={d}
      data-revealed={revealed}
      aria-labelledby="oi-step-title"
      data-final={finalText ? "true" : undefined}
    >
      {header}
      {d === OWN_FIRST && !started ? (
        <div className="oi-first" data-testid="own-first">
          <LangChoice value={f.lang ?? ui} onChange={setLang} ui={ui} sc={sc} />
          <OwnWords
            testid="own-card"
            title={t.ownTitle}
            lead={t.ownLead}
            submitLabel={t.ownContinue}
            skipLabel={t.ownSkipFirst}
            onSubmit={(s) => {
              setStarted(true);
              ownArrives(s, questions(d, sc), [{ who: "agent", text: t.helloAfterOwn }]);
            }}
            onSkip={() => {
              setStarted(true);
              setF((o) => ({ ...o, ownDone: true }));
              setQueue(questions(d, sc));
              say({ who: "agent", text: t.helloFirst });
            }}
          />
        </div>
      ) : null}
      {d === OWN_FIRST && started ? <LangChoice value={f.lang ?? ui} onChange={setLang} ui={ui} sc={sc} compact /> : null}
      {d === SIDE ? (
        <div className="oi-side-grid">
          {chat}
          <aside className="oi-side" data-testid="reveal" data-kind="side" aria-label={t.revealLabel}>
            <div className="oi-side-head">
              <p className="oi-reveal-label">
                <Icon name="paperclip" aria-hidden="true" />
                {t.revealLabel}
              </p>
              <LangChoice value={f.lang ?? ui} onChange={setLang} ui={ui} sc={sc} compact />
            </div>
            {editor}
          </aside>
        </div>
      ) : d === OWN_FIRST && !started ? null : (
        chat
      )}
      {revealed && d !== SIDE ? (
        <div ref={reveal} className="oi-reveal-slot" data-testid="reveal" data-kind="editor">
          <p className="oi-reveal-label">
            <Icon name="paperclip" aria-hidden="true" />
            {t.revealLabel}
          </p>
          {editor}
        </div>
      ) : null}
      {revealed || d === SIDE ? null : <div className="ah-onboarding-actions">{later}<span /></div>}
    </section>
  );
}

/** The chips of the language question, Habitat's language first. */
const langOrder = (ui: Lang): AnswerLang[] => [ui, ...ANSWER_LANGS.filter((l) => l !== ui)];

/** Past the last step: one plain sentence, the technical facts folded away. */
function DoneCard({ outcome, text, sc, onEnter }: { outcome: Outcome; text: string; sc: Scenario; onEnter: () => void }) {
  const t = useT();
  const wrote = outcome === "saved" || outcome === "merged";
  const title = { saved: t.doneSaved, merged: t.doneMerged, later: t.doneLater, kept: t.doneKept }[outcome];
  const lead = wrote ? t.doneSavedLead : outcome === "later" ? t.doneLaterLead : t.doneKeptLead;
  return (
    <section className="ah-onboarding-step" data-testid="route-done" data-outcome={outcome} aria-labelledby="oi-done-title">
      <header>
        <p className="ah-eyebrow">{t.eyebrow}</p>
        <h1 id="oi-done-title" tabIndex={-1}>
          {title}
        </h1>
        <p>{lead}</p>
      </header>
      {wrote ? (
        <details className="oi-where" data-testid="where">
          <summary>{t.where}</summary>
          <p>{t.whereText}</p>
          <div className="oi-tools">
            {[PI_FILE, CLAUDE_FILE].map((p) => (
              <div key={p} data-testid="file-tool" data-tool={sc === "existing" ? "edit" : "write"} data-tool-target={p}>
                <ToolRow name={sc === "existing" ? "edit" : "write"} targetText={p} statusLabel={t.wrote} state="succeeded" expanded={false} onToggle={noop} />
              </div>
            ))}
          </div>
          <pre className="oi-written" data-testid="written-file">
            {text}
          </pre>
        </details>
      ) : null}
      <div className="ah-onboarding-actions">
        <span />
        <Button data-testid="enter-habitat" size="row" variant="primary" label={t.enter} onPress={onEnter} />
      </div>
    </section>
  );
}

// ---------- The earlier steps, quick to click through ----------

const repos = [
  { full_name: "ainolaine/kotikirjasto", private: false, pushed_at: "2026-11-18T12:00:00Z", description: "Kirjaston lainat ja muistiinpanot" },
  { full_name: "ainolaine/python-harjoitukset", private: true, pushed_at: "2026-10-02T12:00:00Z", description: null },
];

function AIStep({ onNext }: { onNext: () => void }) {
  const t = useT();
  const pt = useText(piOnboardingText);
  const [choice, setChoice] = useState<AIOption>("chatgpt");
  return (
    <OnboardingFrame step="ai">
      <section className="ah-onboarding-step ah-ai-step" aria-labelledby="pi-sign-in-title">
        <header>
          <p className="ah-eyebrow">{pt.eyebrow}</p>
          <h1 id="pi-sign-in-title" data-testid="pi-sign-in-title" tabIndex={-1}>
            {pt.title}
          </h1>
        </header>
        <AIOfferList
          offer="all"
          choice={choice}
          onChoose={setChoice}
          body={() => (
            <PiDeviceSignIn embedded view={{ phase: "ready", verificationUri: "https://auth.openai.com/codex/device", userCode: "AINO-2611" }} onCancel={noop} />
          )}
        />
        <button type="button" className="ra-event" data-testid="simulate-signed-in" onClick={onNext}>
          {t.simulate}
        </button>
      </section>
    </OnboardingFrame>
  );
}

/** Habitat after the route. The step's conversation ran in ~ and has no
 * workspace, so the rail has nothing to show for it. */
function Home() {
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
      <AppShell
        mobileTitle={t.homeTitle}
        rail={rail}
        main={
          <div className="oi-main" id="main">
            <div className="oi-page" data-testid="home">
              <h1>{t.homeTitle}</h1>
              <ul className="oi-workspaces">
                <li>
                  <Icon name="repo" aria-hidden="true" />
                  <code>{t.workspace}</code>
                  <span className="oi-dim">{t.homeMeta}</span>
                </li>
              </ul>
            </div>
          </div>
        }
      />
    </StatusBellProvider>
  );
}

function Main({ d, sc, ui }: { d: number; sc: Scenario; ui: Lang }) {
  const gt = useText(githubOnboardingText);
  const t = useT();
  const [stage, setStage] = useState<Stage>(React.useContext(StartContext).stage);
  const [selected, setSelected] = useState<string[]>([repos[0].full_name]);
  const [outcome, setOutcome] = useState<Outcome>();
  const [text, setText] = useState("");
  const route: OnboardingRouteStep[] = [
    { id: "github", note: gt.signedIn },
    { id: "repositories", note: gt.fetched },
    { id: "ai", note: "ChatGPT" },
    { id: INSTRUCTIONS, note: outcome ? t.notes[outcome] : undefined, skipped: outcome === "later" || outcome === "kept" },
  ];
  const page = (children: ReactNode) => (
    <div className="oi-route" data-testid={`stage-${stage}`}>
      <OnboardingRoute steps={route}>{children}</OnboardingRoute>
    </div>
  );
  if (stage === "login") return page(<LoginCard onLogin={() => setStage("repos")} />);
  if (stage === "repos")
    return page(
      <GitHubRepoChooser
        view={{ phase: "catalog", repositories: repos }}
        selectedNames={selected}
        onToggle={(n, yes) => setSelected((o) => (yes ? [...o, n] : o.filter((x) => x !== n)))}
        onProceed={() => setStage("ai")}
      />,
    );
  if (stage === "ai") return page(<AIStep onNext={() => setStage("instructions")} />);
  if (stage === "instructions")
    return page(
      <OnboardingFrame step={outcome ? "done" : INSTRUCTIONS}>
        {outcome ? (
          <DoneCard outcome={outcome} text={text} sc={sc} onEnter={() => setStage("home")} />
        ) : (
          <Step
            d={d}
            sc={sc}
            ui={ui}
            onDone={(o, written) => {
              setText(written);
              setOutcome(o);
            }}
          />
        )}
      </OnboardingFrame>,
    );
  return <Home />;
}

// ---------- Review chrome ----------

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(reviewLanguage);
  const [scenario, setScenario] = useState(reviewScenario);
  const [run, setRun] = useState(0);
  const [from, setFrom] = useState<{ stage: Stage; revealed: boolean }>({ stage: startStage, revealed: startRevealed });
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
  const restart = (stage: Stage, revealed = false) => {
    setFrom({ stage, revealed });
    setRun((r) => r + 1);
  };
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
                  restart("instructions");
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
                  restart("instructions");
                }}
              >
                <option value="fresh">{t.scenarios.fresh}</option>
                <option value="existing">{t.scenarios.existing}</option>
              </select>
            </label>
            <span className="ra-hint">{t.hint}</span>
            <button type="button" className="ra-event" data-testid="event-reveal" onClick={() => restart("instructions", true)}>
              {t.jump}
            </button>
            <button type="button" className="ra-event" data-testid="event-reset" onClick={() => restart("login")}>
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
            <StartContext.Provider value={from}>
              <Main key={`${direction}-${language}-${scenario}-${run}`} d={direction} sc={scenario} ui={language} />
            </StartContext.Provider>
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
