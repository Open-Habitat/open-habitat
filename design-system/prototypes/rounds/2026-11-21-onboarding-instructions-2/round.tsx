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

// new-user-agent-instructions-template, round 2 (Jari 21.11.2026): the
// person's own agent instructions are the last step of the onboarding route
// itself, after the AI account, drawn in the route's progress like the other
// steps. Inside the step the agent knows what GitHub and Habitat already
// told it, asks what is missing and writes ~/.pi/agent/AGENTS.md, which
// ~/.claude/CLAUDE.md imports. An existing file is never overwritten: the
// step proposes marked additions. The agent's turns are scripted; no model
// runs. Production pieces: OnboardingFrame and OnboardingRoute (with the
// build's one-line step-label patch, see build.mjs), LoginCard,
// GitHubRepoChooser, the AI step's AIOfferList and PiDeviceSignIn,
// AssistantMessage, UserMessage, ToolRow, Markdown, ControlButton, Button,
// AppShell and the rail. The round's own parts are the three step bodies,
// the file preview and the Habitat reminder.

const directions = ["A Keskustelu", "B Tiedosto", "C Lomake"];
const params = new URLSearchParams(location.search);
const noop = () => {};
const PI_FILE = "~/.pi/agent/AGENTS.md";
const CLAUDE_FILE = "~/.claude/CLAUDE.md";

type Lang = "fi" | "en";
type Scenario = "fresh" | "existing";
type Stage = "login" | "repos" | "ai" | "instructions" | "done" | "home" | "settings";
type Outcome = "saved" | "merged" | "later" | "kept";
/** What the agent has for the file: the same in every direction. */
type Fields = { call: string; work: string; style?: number; ask: number[]; extra: string[] };
type Msg = { id: number; who: "agent" | "me"; text: string } | { id: number; who: "draft" };

let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: Lang = params.get("lang") === "en" ? "en" : "fi";
let reviewScenario: Scenario = params.get("scenario") === "existing" ? "existing" : "fresh";
const startStage: Stage = params.get("stage") === "login" ? "login" : "instructions";
const LangContext = React.createContext<Lang>("fi");
const useT = () => TEXT[React.useContext(LangContext)];
// The production frame names the new step through the build's patch.
(globalThis as { __roundStepLabel?: () => string }).__roundStepLabel = () => TEXT[reviewLanguage].stepLabel;
const StartContext = React.createContext<Stage>("instructions");
const INSTRUCTIONS = "instructions" as unknown as OnboardingStepId;

// ---------- The template the agent fills ----------

function buildFile(t: Text, f: Fields, sc: Scenario): { text: string; base?: string } {
  const sections: [string, string[]][] = [
    [t.draft.who, [f.call.trim() ? t.draft.call(f.call.trim()) : "", f.work.trim()].filter(Boolean)],
    [t.draft.lang, sc === "existing" ? [] : [t.draft.langLine]],
    [t.draft.style, f.style === undefined ? [] : [t.choices.style[f.style].line]],
    [t.draft.ask, f.ask.map((i) => t.choices.ask[i].line)],
    [t.draft.extra, f.extra],
  ];
  const body = sections
    .filter(([, lines]) => lines.length)
    .map(([h, lines]) => `${h}\n\n${lines.map((l) => `- ${l}`).join("\n")}`)
    .join("\n\n");
  if (sc === "existing") return { base: t.existing, text: `${t.existing}\n\n${body}` };
  return { text: `${t.draft.title(t.person)}\n\n${t.draft.lead}\n\n${body}` };
}

const known = (t: Text, call = t.first): Fields => ({ call, work: t.bio, ask: [], extra: [] });

/** The file as it would be written; an addition marks its new lines. */
function FilePreview({ f, sc, compact }: { f: Fields; sc: Scenario; compact?: boolean }) {
  const t = useT();
  const { text, base } = buildFile(t, f, sc);
  const kept = base ? base.split("\n").length : 0;
  return (
    <figure className="oi-file" data-testid="file-preview" data-mode={base ? "merge" : "new"} data-compact={compact ? "true" : undefined}>
      <figcaption>
        <Icon name="file" aria-hidden="true" />
        <code className="oi-path">{PI_FILE}</code>
        <span className="oi-tag">{base ? t.mergeFile : t.newFile}</span>
      </figcaption>
      <pre data-testid="file-text">
        {text.split("\n").map((l, i) => {
          const added = base ? i >= kept && l.trim() !== "" : false;
          return (
            <span key={i} className="oi-row" data-added={added ? "true" : undefined} data-kept={base && i < kept ? "true" : undefined}>
              {base ? <span className="oi-mark" aria-hidden="true">{added ? "+" : " "}</span> : null}
              {l || " "}
              {"\n"}
            </span>
          );
        })}
      </pre>
    </figure>
  );
}

function ClaudeNote({ sc }: { sc: Scenario }) {
  const t = useT();
  return (
    <p className="oi-note" data-testid="claude-note">
      <Icon name="info" aria-hidden="true" />
      <span>{sc === "existing" ? t.claudeExisting : t.claudeNew}</span>
    </p>
  );
}

function Bubble({ m }: { m: Extract<Msg, { text: string }> }) {
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

/** The step's own small field: free text to the agent, never a conversation of its own. */
function AskField({ onSend }: { onSend: (s: string) => void }) {
  const t = useT();
  const [v, setV] = useState("");
  const send = () => {
    if (!v.trim()) return;
    onSend(v.trim());
    setV("");
  };
  return (
    <form
      className="oi-ask"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <input data-testid="step-field" aria-label={t.fieldPlaceholder} placeholder={t.fieldPlaceholder} value={v} onChange={(e) => setV(e.target.value)} />
      <ControlButton size="row" type="submit" data-testid="step-send">
        {t.send}
      </ControlButton>
    </form>
  );
}

function useAutoScroll(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [dep]);
  return ref;
}

// ---------- A: a small chat inside the step ----------

function ChatBody({ f, setF, sc }: { f: Fields; setF: (f: Fields) => void; sc: Scenario }) {
  const t = useT();
  const [q, setQ] = useState(0); // 0 style, 1 ask, 2 ready
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    { id: 1, who: "agent", text: sc === "existing" ? t.knownExisting : t.known },
    { id: 2, who: "draft" },
    { id: 3, who: "agent", text: t.askStyle },
  ]);
  const add = (...m: Omit<Extract<Msg, { text: string }>, "id">[]) =>
    setMsgs((old) => [...old, ...m.map((x, i) => ({ ...x, id: old.length + i + 1 }) as Msg)]);
  const scroller = useAutoScroll(msgs.length);
  const choose = (i: number) => {
    const c = (q === 0 ? t.choices.style : t.choices.ask)[i];
    if (q === 0) setF({ ...f, style: i });
    else setF({ ...f, ask: [i] });
    add({ who: "me", text: c.label }, { who: "agent", text: q === 0 ? t.askAsk : sc === "existing" ? t.readyExisting : t.ready });
    setQ(q + 1);
  };
  const choices = q === 0 ? t.choices.style : q === 1 ? t.choices.ask : [];
  return (
    <div className="oi-chat" data-testid="step-chat">
      <div className="oi-chat-thread" ref={scroller} data-testid="step-thread">
        {msgs.map((m) =>
          m.who === "draft" ? (
            <div key={m.id} className="oi-chat-draft">
              <FilePreview f={f} sc={sc} compact />
            </div>
          ) : (
            <Bubble key={m.id} m={m} />
          ),
        )}
        {choices.length ? (
          <div className="oi-chips" role="group" aria-label={q === 0 ? t.askStyle : t.askAsk} data-testid="quick-replies">
            {choices.map((c, i) => (
              <ControlButton key={c.label} size="row" data-testid="quick-reply" onPress={() => choose(i)}>
                {c.label}
              </ControlButton>
            ))}
          </div>
        ) : null}
      </div>
      <AskField
        onSend={(s) => {
          setF({ ...f, extra: [...f.extra, s] });
          add({ who: "me", text: s }, { who: "agent", text: t.added });
        }}
      />
    </div>
  );
}

// ---------- B: the file with inline choices, a small chat beside ----------

function Source({ s }: { s: keyof Text["sources"] }) {
  const t = useT();
  return <span className="oi-src" data-testid={`source-${s}`}>{t.sources[s]}</span>;
}

function InlinePick({ list, picked, onPick, label }: { list: Text["choices"]["style"]; picked: number[]; onPick: (i: number) => void; label: string }) {
  const t = useT();
  return (
    <div className="oi-pick" role="group" aria-label={label} data-testid="inline-pick">
      <span className="oi-pick-label">{t.pick}:</span>
      {list.map((c, i) => (
        <ControlButton
          key={c.label}
          size="inline"
          variant={picked.includes(i) ? "primary" : "secondary"}
          data-testid="inline-choice"
          aria-pressed={picked.includes(i)}
          onPress={() => onPick(i)}
        >
          {c.label}
        </ControlButton>
      ))}
    </div>
  );
}

function FileBody({ f, setF, sc }: { f: Fields; setF: (f: Fields) => void; sc: Scenario }) {
  const t = useT();
  const [msgs, setMsgs] = useState<Msg[]>(() => [{ id: 1, who: "agent", text: sc === "existing" ? t.sideHelloExisting : t.sideHello }]);
  const [readySaid, setReadySaid] = useState(false);
  const scroller = useAutoScroll(msgs.length);
  const say = (...m: Omit<Extract<Msg, { text: string }>, "id">[]) =>
    setMsgs((old) => [...old, ...m.map((x, i) => ({ ...x, id: old.length + i + 1 }) as Msg)]);
  const update = (n: Fields) => {
    setF(n);
    if (!readySaid && n.style !== undefined && n.ask.length) {
      setReadySaid(true);
      say({ who: "agent", text: t.sideReady });
    }
  };
  const line = (text: string, src: keyof Text["sources"]) => (
    <li className="oi-fline" data-added={sc === "existing" ? "true" : undefined}>
      <span>- {text}</span>
      <Source s={src} />
    </li>
  );
  return (
    <div className="oi-filestep" data-testid="step-file">
      <section className="oi-file oi-file-live" aria-label={PI_FILE} data-mode={sc === "existing" ? "merge" : "new"}>
        <header className="oi-file-head">
          <Icon name="file" aria-hidden="true" />
          <code className="oi-path">{PI_FILE}</code>
          <span className="oi-tag">{sc === "existing" ? t.mergeFile : t.newFile}</span>
        </header>
        <div className="oi-file-body" data-testid="file-text">
          {sc === "existing" ? (
            <pre className="oi-kept" data-testid="file-kept">{t.existing}</pre>
          ) : (
            <>
              <p className="oi-h1">{t.draft.title(t.person)}</p>
              <p className="oi-dim">{t.draft.lead}</p>
            </>
          )}
          <p className="oi-h2">{t.draft.who}</p>
          <ul>
            {line(t.draft.call(f.call), "github")}
            {line(f.work, "bio")}
          </ul>
          {sc === "fresh" ? (
            <>
              <p className="oi-h2">{t.draft.lang}</p>
              <ul>{line(t.draft.langLine, "habitat")}</ul>
            </>
          ) : null}
          <p className="oi-h2">{t.draft.style}</p>
          <ul>{f.style !== undefined ? line(t.choices.style[f.style].line, "you") : null}</ul>
          <InlinePick list={t.choices.style} picked={f.style === undefined ? [] : [f.style]} label={t.askStyle} onPick={(i) => update({ ...f, style: i })} />
          <p className="oi-h2">{t.draft.ask}</p>
          <ul>{f.ask.map((i) => <React.Fragment key={i}>{line(t.choices.ask[i].line, "you")}</React.Fragment>)}</ul>
          <InlinePick
            list={t.choices.ask}
            picked={f.ask}
            label={t.askAsk}
            onPick={(i) => update({ ...f, ask: f.ask.includes(i) ? f.ask.filter((x) => x !== i) : [...f.ask, i].sort() })}
          />
          {f.extra.length ? (
            <>
              <p className="oi-h2">{t.draft.extra}</p>
              <ul>{f.extra.map((e) => <React.Fragment key={e}>{line(e, "you")}</React.Fragment>)}</ul>
            </>
          ) : null}
        </div>
      </section>
      <aside className="oi-side" aria-label={t.agent} data-testid="side-chat">
        <p className="oi-side-title">{t.agent}</p>
        <div className="oi-side-thread" ref={scroller}>
          {msgs.map((m) => (m.who === "draft" ? null : <Bubble key={m.id} m={m} />))}
        </div>
        <AskField
          onSend={(s) => {
            setF({ ...f, extra: [...f.extra, s] });
            say({ who: "me", text: s }, { who: "agent", text: t.added });
          }}
        />
      </aside>
    </div>
  );
}

// ---------- C: a short guided form with an agent helper ----------

type FieldId = "call" | "work" | "style" | "ask" | "extra";

function FormBody({ f, setF, sc }: { f: Fields; setF: (f: Fields) => void; sc: Scenario }) {
  const t = useT();
  const [help, setHelp] = useState<FieldId[]>([]);
  const [preview, setPreview] = useState(false);
  const helper = (id: FieldId, use?: () => void) => (
    <>
      <ControlButton
        size="inline"
        variant="quiet"
        data-testid={`helper-${id}`}
        aria-expanded={help.includes(id)}
        onPress={() => setHelp(help.includes(id) ? help.filter((x) => x !== id) : [...help, id])}
      >
        {t.form.helper}
      </ControlButton>
      {help.includes(id) ? (
        <div className="oi-helper" data-testid={`helper-${id}-reply`}>
          <AssistantMessage streamState="complete" onCopy={noop}>
            <Markdown text={t.helperSays[id]} />
          </AssistantMessage>
          {use ? (
            <ControlButton
              size="row"
              data-testid={`helper-${id}-use`}
              onPress={() => {
                use();
                setHelp(help.filter((x) => x !== id));
              }}
            >
              {t.form.use}
            </ControlButton>
          ) : null}
        </div>
      ) : null}
    </>
  );
  return (
    <div className="oi-formstep" data-testid="step-form">
      <p className="oi-dim">{t.form.optional}</p>
      <div className="oi-field">
        <label htmlFor="oi-call">{t.form.call}</label>
        <div className="oi-field-row">
          <input id="oi-call" data-testid="form-call" value={f.call} onChange={(e) => setF({ ...f, call: e.target.value })} />
          <Source s="github" />
        </div>
        {helper("call", () => setF({ ...f, call: t.helperValue.call }))}
      </div>
      <div className="oi-field">
        <label htmlFor="oi-work">{t.form.work}</label>
        <div className="oi-field-row">
          <textarea id="oi-work" data-testid="form-work" rows={2} value={f.work} onChange={(e) => setF({ ...f, work: e.target.value })} />
          <Source s="bio" />
        </div>
        {helper("work", () => setF({ ...f, work: t.helperValue.work }))}
      </div>
      {sc === "existing" ? <p className="oi-dim" data-testid="form-lang-has">{t.form.langHas}</p> : null}
      <fieldset className="oi-field">
        <legend>{t.form.style}</legend>
        <div className="oi-options">
          {t.choices.style.map((c, i) => (
            <label key={c.label} className="oi-option">
              <input type="radio" name="oi-style" data-testid={`form-style-${i}`} checked={f.style === i} onChange={() => setF({ ...f, style: i })} />
              {c.label}
            </label>
          ))}
        </div>
        {helper("style", () => setF({ ...f, style: 1 }))}
      </fieldset>
      <fieldset className="oi-field">
        <legend>{t.form.ask}</legend>
        <div className="oi-options">
          {t.choices.ask.map((c, i) => (
            <label key={c.label} className="oi-option">
              <input
                type="checkbox"
                data-testid={`form-ask-${i}`}
                checked={f.ask.includes(i)}
                onChange={() => setF({ ...f, ask: f.ask.includes(i) ? f.ask.filter((x) => x !== i) : [...f.ask, i].sort() })}
              />
              {c.label}
            </label>
          ))}
        </div>
        {helper("ask", () => setF({ ...f, ask: [0, 1] }))}
      </fieldset>
      <div className="oi-field">
        <label htmlFor="oi-extra">{t.form.extra}</label>
        <textarea
          id="oi-extra"
          data-testid="form-extra"
          rows={2}
          value={f.extra.join("\n")}
          onChange={(e) => setF({ ...f, extra: e.target.value ? e.target.value.split("\n") : [] })}
        />
        {helper("extra")}
      </div>
      <div>
        <ControlButton size="inline" variant="quiet" data-testid="form-preview" aria-expanded={preview} onPress={() => setPreview(!preview)}>
          {preview ? t.form.hidePreview : t.form.preview}
        </ControlButton>
        {preview ? <FilePreview f={{ ...f, extra: f.extra.filter((e) => e.trim()) }} sc={sc} compact /> : null}
      </div>
    </div>
  );
}

// ---------- The step ----------

function InstructionsStep({ d, sc, onDone, framed = true }: { d: number; sc: Scenario; onDone: (o: Outcome, f: Fields) => void; framed?: boolean }) {
  const t = useT();
  const [f, setF] = useState<Fields>(() => known(t, d === 2 ? t.person : t.first));
  const body =
    d === 0 ? <ChatBody f={f} setF={setF} sc={sc} /> : d === 1 ? <FileBody f={f} setF={setF} sc={sc} /> : <FormBody f={f} setF={setF} sc={sc} />;
  return (
    <section className="ah-onboarding-step oi-step" data-testid="instructions-step" data-direction={d} data-framed={framed} aria-labelledby="oi-step-title">
      <header>
        {framed ? <p className="ah-eyebrow">{t.eyebrow}</p> : null}
        <h1 id="oi-step-title" data-testid="instructions-title" tabIndex={-1}>
          {t.stepTitle}
        </h1>
        <p data-testid="instructions-lead">{sc === "existing" ? t.leadExisting : t.lead}</p>
      </header>
      {body}
      <ClaudeNote sc={sc} />
      <p className="oi-note oi-safe">{t.safe}</p>
      <div className="ah-onboarding-actions">
        <Button
          data-testid="step-later"
          size="row"
          variant="quiet"
          label={sc === "existing" ? t.keep : t.later}
          onPress={() => onDone(sc === "existing" ? "kept" : "later", f)}
        />
        <Button
          data-testid="step-save"
          size="row"
          variant="primary"
          label={sc === "existing" ? t.saveMerge : t.save}
          onPress={() => onDone(sc === "existing" ? "merged" : "saved", f)}
        />
      </div>
    </section>
  );
}

/** Past the last step: what was written, and the way into Habitat. */
function DoneCard({ outcome, f, sc, onEnter }: { outcome: Outcome; f: Fields; sc: Scenario; onEnter: () => void }) {
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
        <>
          <div className="oi-tools">
            {[PI_FILE, CLAUDE_FILE].map((p) => (
              <div key={p} data-testid="file-tool" data-tool={sc === "existing" ? "edit" : "write"} data-tool-target={p}>
                <ToolRow name={sc === "existing" ? "edit" : "write"} targetText={p} statusLabel={t.wrote} state="succeeded" expanded={false} onToggle={noop} />
              </div>
            ))}
          </div>
          <FilePreview f={f} sc={sc} compact />
        </>
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

function Main({ d, sc }: { d: number; sc: Scenario }) {
  const t = useT();
  const gt = useText(githubOnboardingText);
  const [stage, setStage] = useState<Stage>(React.useContext(StartContext));
  const [selected, setSelected] = useState<string[]>([repos[0].full_name]);
  const [outcome, setOutcome] = useState<Outcome>();
  const [fields, setFields] = useState<Fields>(() => known(t));
  const route: OnboardingRouteStep[] = [
    { id: "github", note: gt.signedIn },
    { id: "repositories", note: gt.fetched },
    { id: "ai", note: "ChatGPT" },
    { id: INSTRUCTIONS, note: outcome ? t.notes[outcome] : undefined, skipped: outcome === "later" || outcome === "kept" },
  ];
  const done = (o: Outcome, f: Fields) => {
    setOutcome(o);
    setFields(f);
  };
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
  if (stage === "instructions" || stage === "done")
    return page(
      <OnboardingFrame step={outcome ? "done" : INSTRUCTIONS}>
        {outcome ? (
          <DoneCard outcome={outcome} f={fields} sc={sc} onEnter={() => setStage("home")} />
        ) : (
          <InstructionsStep d={d} sc={sc} onDone={done} />
        )}
      </OnboardingFrame>,
    );
  if (stage === "settings")
    return (
      <Shell title={t.settingsTitle}>
        <div className="oi-page" data-testid="settings">
          <p className="oi-crumb">{t.settingsCrumb}</p>
          <div className="oi-settings-card">
            <InstructionsStep
              d={d}
              sc={sc}
              framed={false}
              onDone={(o, f) => {
                if (o === "saved" || o === "merged") done(o, f);
                setStage("home");
              }}
            />
          </div>
        </div>
      </Shell>
    );
  const remind = outcome === "later";
  return (
    <Shell title={t.homeTitle}>
      <div className="oi-page" data-testid="home">
        <h1>{t.homeTitle}</h1>
        {remind ? (
          <section className="oi-remind" data-testid="home-reminder">
            <header>
              <Icon name="user" aria-hidden="true" />
              <strong>{t.remindTitle}</strong>
            </header>
            <p>{t.remindLead}</p>
            <ControlButton size="row" variant="primary" data-testid="reminder-start" onPress={() => setStage("settings")}>
              {t.remindStart}
            </ControlButton>
          </section>
        ) : null}
        <ul className="oi-workspaces">
          <li>
            <Icon name="repo" aria-hidden="true" />
            <code>{t.workspace}</code>
            <span className="oi-dim">{t.homeMeta}</span>
          </li>
        </ul>
      </div>
    </Shell>
  );
}

// ---------- Review chrome ----------

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(reviewLanguage);
  const [scenario, setScenario] = useState(reviewScenario);
  const [run, setRun] = useState(0);
  const [from, setFrom] = useState<Stage>(startStage);
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
                  setFrom("instructions");
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
                  setFrom("instructions");
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
                setFrom("login");
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
            <StartAt stage={from}>
              <Main key={`${direction}-${language}-${scenario}-${run}`} d={direction} sc={scenario} />
            </StartAt>
          </MemoryRouter>
        </div>
      </div>
    </LangContext.Provider>
  );
}

function StartAt({ stage, children }: { stage: Stage; children: ReactNode }) {
  return <StartContext.Provider value={stage}>{children}</StartContext.Provider>;
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
else setPersonalLanguage("fi");
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
