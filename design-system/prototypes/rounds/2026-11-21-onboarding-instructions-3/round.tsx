import React, { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { Button } from "../../../../web/src/components/Primitives";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { githubOnboardingText } from "../../../../web/src/text/githubOnboarding";
import { piOnboardingText } from "../../../../web/src/text/piOnboarding";
import { statusText } from "../../../../web/src/text/status";
import "../../../../web/src/components/components.css";
import { TEXT, type Text } from "./text";
import "./round.css";

// new-user-agent-instructions-template, round 3 (Jari 21.11.2026 on round 2:
// direction A Keskustelu, but what the person is told is long and technical,
// and the file itself is shown after the conversation). The step stays the
// last one of the onboarding route and stays a small conversation. What
// changes between the variants is the wording (step title, lead, agent turns)
// and how the finished file is revealed before the route ends:
//   A1 Lyhyesti     two questions, the file as a readable list with what each
//                   part means under its heading;
//   A2 Muistilappu  "a note the agent reads first", the agent checks the fact
//                   it took from GitHub, the note with margin notes and the
//                   raw file only on request;
//   A3 Esittely     an introduction in the person's own voice, plain prose the
//                   person can edit before saving.
// Nothing technical (paths, AGENTS.md, Pi, Claude) is said in the
// conversation; the paths are behind "Missä ohjeet ovat?" after saving and,
// in A2, behind "Näytä tiedostona". The agent's turns are scripted; no model
// runs. The step's conversation is never shown in the rail (NOTES.md).

const directions = ["A1 Lyhyesti", "A2 Muistilappu", "A3 Esittely"];
const params = new URLSearchParams(location.search);
const noop = () => {};
const PI_FILE = "~/.pi/agent/AGENTS.md";
const CLAUDE_FILE = "~/.claude/CLAUDE.md";

type Lang = "fi" | "en";
type Scenario = "fresh" | "existing";
type Stage = "login" | "repos" | "ai" | "instructions" | "home";
type Outcome = "saved" | "merged" | "later" | "kept";
type Section = "who" | "lang" | "style" | "ask" | "extra";
/** What the agent has for the file: the same in every variant. */
type Fields = { work: boolean; style?: number; ask?: number; extra: string[]; letter?: string };
type Msg = { id: number; who: "agent" | "me"; text: string };
type Question = "confirm" | "style" | "ask";

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

const questions = (d: number): Question[] => (d === 1 ? ["confirm", "style", "ask"] : ["style", "ask"]);
const answered: Fields = { work: true, style: 1, ask: 0, extra: [] };

// ---------- The file the agent writes ----------

/** The list-shaped file (A1, A2) as sections, so a reveal can explain each. */
function sections(t: Text, f: Fields, sc: Scenario): { id: Section; heading: string; lines: string[] }[] {
  const all: { id: Section; heading: string; lines: string[] }[] = [
    { id: "who", heading: t.file.who, lines: sc === "existing" ? (f.work ? [t.file.work] : []) : [t.file.name(t.first), ...(f.work ? [t.file.work] : [])] },
    { id: "lang", heading: t.file.lang, lines: sc === "existing" ? [] : [t.file.lang1] },
    { id: "style", heading: t.file.style, lines: f.style === undefined ? [] : [t.choices.style[f.style].line] },
    { id: "ask", heading: t.file.ask, lines: f.ask === undefined ? [] : [t.choices.ask[f.ask].line] },
    { id: "extra", heading: t.file.extra, lines: f.extra },
  ];
  return all.filter((s) => s.lines.length);
}

function letterText(t: Text, f: Fields, sc: Scenario): string {
  if (f.letter !== undefined) return f.letter;
  const first = [t.letter.hello(t.first), f.work ? t.letter.work : ""].filter(Boolean).join(" ");
  const second = [sc === "existing" ? "" : t.letter.lang, f.style === undefined ? "" : t.choices.style[f.style].prose].filter(Boolean).join(" ");
  const third = f.ask === undefined ? "" : t.choices.ask[f.ask].prose;
  return [first, second, third, f.extra.join(" ")].filter(Boolean).join("\n\n");
}

/** Exactly what is written to disk; an addition comes after the kept text. */
function rawFile(t: Text, d: number, f: Fields, sc: Scenario): string {
  const body =
    d === 2
      ? letterText(t, f, sc)
      : sections(t, f, sc)
          .map((s) => `## ${s.heading}\n\n${s.lines.map((l) => `- ${l}`).join("\n")}`)
          .join("\n\n");
  if (sc === "existing") return `${t.existing}\n\n${body}`;
  return d === 2 ? body : `${t.file.title(t.first)}\n\n${t.file.lead}\n\n${body}`;
}

// ---------- The three reveals ----------

function Kept() {
  const t = useT();
  return (
    <div className="oi-kept" data-testid="reveal-kept">
      <p className="oi-kept-label">{t.keptLabel}</p>
      <pre>{t.existing}</pre>
    </div>
  );
}

function NewMark({ sc }: { sc: Scenario }) {
  const t = useT();
  return sc === "existing" ? (
    <span className="oi-new" data-testid="reveal-new">
      {t.newMark}
    </span>
  ) : null;
}

/** A1: a readable document; the meaning of each part under its heading. */
function RevealList({ f, sc }: { f: Fields; sc: Scenario }) {
  const t = useT();
  return (
    <section className="oi-reveal oi-reveal-list" data-testid="reveal" data-kind="list" aria-label={t.revealDoc}>
      <p className="oi-reveal-label">
        <Icon name="file" aria-hidden="true" />
        {t.revealDoc}
      </p>
      {sc === "existing" ? <Kept /> : null}
      <div data-testid="file-text">
        {sc === "fresh" ? <p className="oi-doc-lead">{t.file.lead}</p> : null}
        {sections(t, f, sc).map((s) => (
          <div key={s.id} className="oi-doc-sec" data-section={s.id} data-added={sc === "existing" ? "true" : undefined}>
            <h3>
              {s.heading} <NewMark sc={sc} />
            </h3>
            <p className="oi-means" data-testid="means">
              {t.means[s.id]}
            </p>
            <ul>
              {s.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** A2: a note card with margin notes; the raw file only on request. */
function RevealNote({ f, sc }: { f: Fields; sc: Scenario }) {
  const t = useT();
  const [raw, setRaw] = useState(false);
  return (
    <section className="oi-reveal oi-reveal-note" data-testid="reveal" data-kind="note" aria-label={t.revealNote}>
      <div className="oi-note-head">
        <p className="oi-reveal-label">
          <Icon name="paperclip" aria-hidden="true" />
          {t.revealNote}
        </p>
        <ControlButton size="inline" variant="quiet" data-testid="toggle-raw" aria-pressed={raw} onPress={() => setRaw(!raw)}>
          {raw ? t.asNote : t.asFile}
        </ControlButton>
      </div>
      {raw ? (
        <figure className="oi-raw" data-testid="raw-file">
          <figcaption>
            <code>{PI_FILE}</code>
          </figcaption>
          <pre data-testid="file-text">{rawFile(t, 1, f, sc)}</pre>
        </figure>
      ) : (
        <div className="oi-paper" data-testid="file-text">
          {sc === "existing" ? <Kept /> : null}
          {sections(t, f, sc).map((s) => (
            <div key={s.id} className="oi-paper-row" data-section={s.id} data-added={sc === "existing" ? "true" : undefined}>
              <div>
                <h3>
                  {s.heading} <NewMark sc={sc} />
                </h3>
                <ul>
                  {s.lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
              <p className="oi-margin" data-testid="means">
                {t.margin[s.id]}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** A3: the introduction as plain prose, editable before saving. */
function RevealLetter({ f, setF, sc }: { f: Fields; setF: (f: Fields) => void; sc: Scenario }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const text = letterText(t, f, sc);
  return (
    <section className="oi-reveal oi-reveal-letter" data-testid="reveal" data-kind="letter" aria-label={t.revealLetter}>
      <div className="oi-note-head">
        <p className="oi-reveal-label">
          <Icon name="user" aria-hidden="true" />
          {t.revealLetter}
        </p>
        <ControlButton size="inline" variant="quiet" data-testid="letter-edit" aria-pressed={editing} onPress={() => setEditing(!editing)}>
          {editing ? t.editDone : t.edit}
        </ControlButton>
      </div>
      {sc === "existing" ? <Kept /> : null}
      {editing ? (
        <textarea
          className="oi-letter-edit"
          data-testid="letter-text"
          aria-label={t.revealLetter}
          rows={8}
          value={text}
          onChange={(e) => setF({ ...f, letter: e.target.value })}
        />
      ) : (
        <div className="oi-letter" data-testid="file-text" data-added={sc === "existing" ? "true" : undefined}>
          {text.split("\n\n").map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
      <div className="oi-what" data-testid="means">
        <strong>{t.letterWhatTitle}</strong>
        <p>{t.letterWhat}</p>
      </div>
    </section>
  );
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
        <Markdown text={m.text} />
      </UserMessage>
    </div>
  );
}

function AskField({ onSend }: { onSend: (s: string) => void }) {
  const t = useT();
  const [v, setV] = useState("");
  return (
    <form
      className="oi-ask"
      onSubmit={(e) => {
        e.preventDefault();
        if (!v.trim()) return;
        onSend(v.trim());
        setV("");
      }}
    >
      <input data-testid="step-field" aria-label={t.fieldPlaceholder} placeholder={t.fieldPlaceholder} value={v} onChange={(e) => setV(e.target.value)} />
      <ControlButton size="row" type="submit" data-testid="step-send">
        {t.send}
      </ControlButton>
    </form>
  );
}

function askOf(t: Text, d: number, q: Question): string {
  const v = t.voices[d];
  if (q === "confirm") return v.confirm ?? "";
  if (q === "style") return v.askStyle;
  return v.askAsk;
}

function chipsOf(t: Text, d: number, q: Question): string[] {
  const v = t.voices[d];
  if (q === "confirm") return [v.confirmYes ?? "", v.confirmNo ?? ""];
  return (q === "style" ? t.choices.style : t.choices.ask).map((c) => c.label);
}

/** The scripted history up to question q, given the answers so far. */
function history(t: Text, d: number, sc: Scenario, f: Fields, upTo: number): Msg[] {
  const v = t.voices[d];
  const qs = questions(d);
  const out: Omit<Msg, "id">[] = [{ who: "agent", text: sc === "existing" ? v.helloExisting : v.hello }];
  qs.forEach((q, i) => {
    if (i > upTo) return;
    const ask = askOf(t, d, q);
    if (ask) out.push({ who: "agent", text: ask });
    if (i < upTo) {
      const label =
        q === "confirm" ? (f.work ? v.confirmYes ?? "" : v.confirmNo ?? "") : q === "style" ? t.choices.style[f.style ?? 0].label : t.choices.ask[f.ask ?? 0].label;
      out.push({ who: "me", text: label });
    }
  });
  if (upTo >= qs.length) out.push({ who: "agent", text: sc === "existing" ? v.readyExisting : v.ready });
  return out.map((m, i) => ({ ...m, id: i + 1 }));
}

function Step({ d, sc, onDone }: { d: number; sc: Scenario; onDone: (o: Outcome, f: Fields) => void }) {
  const t = useT();
  const v = t.voices[d];
  const qs = questions(d);
  const start = React.useContext(StartContext);
  const [f, setF] = useState<Fields>(() => (start.revealed ? { ...answered } : { work: true, extra: [] }));
  const [q, setQ] = useState(start.revealed ? qs.length : 0);
  const [extra, setExtra] = useState<Msg[]>([]);
  const revealed = q >= qs.length;
  const msgs = [...history(t, d, sc, f, q), ...extra.map((m, i) => ({ ...m, id: 100 + i }))];
  const thread = useRef<HTMLDivElement>(null);
  const reveal = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = thread.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);
  useEffect(() => {
    if (revealed && !start.revealed) reveal.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [revealed, start.revealed]);
  const choose = (i: number) => {
    const cur = qs[q];
    if (cur === "confirm") setF({ ...f, work: i === 0 });
    if (cur === "style") setF({ ...f, style: i });
    if (cur === "ask") setF({ ...f, ask: i });
    setQ(q + 1);
  };
  const ask = revealed ? undefined : qs[q];
  return (
    <section className="ah-onboarding-step oi-step" data-testid="instructions-step" data-direction={d} data-revealed={revealed} aria-labelledby="oi-step-title">
      <header>
        <p className="ah-eyebrow">{t.eyebrow}</p>
        <h1 id="oi-step-title" data-testid="instructions-title" tabIndex={-1}>
          {v.title}
        </h1>
        <p data-testid="instructions-lead">{sc === "existing" ? v.leadExisting : v.lead}</p>
      </header>
      <div className="oi-chat" data-testid="step-chat">
        <div className="oi-chat-thread" ref={thread} data-testid="step-thread">
          {msgs.map((m) => (
            <Bubble key={m.id} m={m} />
          ))}
          {ask ? (
            <div className="oi-chips" role="group" aria-label={askOf(t, d, ask) || v.hello} data-testid="quick-replies" data-question={ask}>
              {chipsOf(t, d, ask).map((c, i) => (
                <ControlButton key={c} size="row" data-testid="quick-reply" onPress={() => choose(i)}>
                  {c}
                </ControlButton>
              ))}
            </div>
          ) : null}
        </div>
        <AskField
          onSend={(s) => {
            setF({ ...f, extra: [...f.extra, s], letter: f.letter === undefined ? undefined : `${f.letter}\n\n${s}` });
            setExtra((o) => [...o, { id: 0, who: "me", text: s }, { id: 0, who: "agent", text: v.added }]);
          }}
        />
      </div>
      {revealed ? (
        <div ref={reveal} className="oi-reveal-slot">
          {d === 0 ? <RevealList f={f} sc={sc} /> : d === 1 ? <RevealNote f={f} sc={sc} /> : <RevealLetter f={f} setF={setF} sc={sc} />}
        </div>
      ) : null}
      <div className="ah-onboarding-actions">
        <Button
          data-testid="step-later"
          size="row"
          variant="quiet"
          label={sc === "existing" ? t.keep : t.later}
          onPress={() => onDone(sc === "existing" ? "kept" : "later", f)}
        />
        {revealed ? (
          <Button
            data-testid="step-save"
            size="row"
            variant="primary"
            label={sc === "existing" ? t.saveMerge : t.save}
            onPress={() => onDone(sc === "existing" ? "merged" : "saved", f)}
          />
        ) : null}
      </div>
    </section>
  );
}

/** Past the last step: one plain sentence, the technical facts folded away. */
function DoneCard({ outcome, d, f, sc, onEnter }: { outcome: Outcome; d: number; f: Fields; sc: Scenario; onEnter: () => void }) {
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
            {rawFile(t, d, f, sc)}
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

function Main({ d, sc }: { d: number; sc: Scenario }) {
  const gt = useText(githubOnboardingText);
  const t = useT();
  const [stage, setStage] = useState<Stage>(React.useContext(StartContext).stage);
  const [selected, setSelected] = useState<string[]>([repos[0].full_name]);
  const [outcome, setOutcome] = useState<Outcome>();
  const [fields, setFields] = useState<Fields>({ work: true, extra: [] });
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
          <DoneCard outcome={outcome} d={d} f={fields} sc={sc} onEnter={() => setStage("home")} />
        ) : (
          <Step
            d={d}
            sc={sc}
            onDone={(o, f) => {
              setFields(f);
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
              <Main key={`${direction}-${language}-${scenario}-${run}`} d={direction} sc={scenario} />
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
