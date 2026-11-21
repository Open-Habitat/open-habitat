import { useEffect, useRef, useState } from "react";
import { type AnswerLanguage, answerLanguages } from "../app/answerLanguage";
import { useText } from "../i18n";
import { agentNoteText } from "../text/agentNote";
import {
  type NoteAnswers,
  type NoteQuestion,
  noteQuestions,
  noteText,
  tidyOwnWords,
} from "./agentNote";
import { ControlButton } from "./ControlElements";
import { AssistantMessage, UserMessage } from "./Conversation";
import { Icon } from "./Icon";
import {
  InstructionsEditor,
  type InstructionsSaveResult,
} from "./InstructionsEditor";
import { Markdown } from "./Markdown";
import { TextArea } from "./Primitives";
import "./AgentNoteStep.css";

type Msg = { id: number; who: "agent" | "me"; text: string };

const copy = (text: string) => {
  void navigator.clipboard?.writeText(text).catch(() => undefined);
};

function Bubble({ m }: { m: Msg }) {
  return m.who === "agent" ? (
    <div data-testid="agent-reply">
      <AssistantMessage
        streamState="complete"
        sourceText={m.text}
        onCopy={() => copy(m.text)}
      >
        <Markdown text={m.text} />
      </AssistantMessage>
    </div>
  ) : (
    <div data-testid="person-message">
      <UserMessage sourceText={m.text} onCopy={() => copy(m.text)}>
        <Markdown text={m.text} breaks />
      </UserMessage>
    </div>
  );
}

function OwnWords({
  onSubmit,
  onSkip,
}: {
  onSubmit: (s: string) => void;
  onSkip: () => void;
}) {
  const t = useText(agentNoteText);
  const [v, setV] = useState("");
  return (
    <div className="an-own" data-testid="own-step">
      <TextArea
        data-testid="own-field"
        label={t.ownTitle}
        hint={t.ownLead}
        placeholder={t.ownPlaceholder}
        rows={4}
        value={v}
        onChange={setV}
      />
      <div className="an-own-actions">
        <ControlButton
          size="row"
          variant="quiet"
          data-testid="own-skip"
          onPress={onSkip}
        >
          {t.ownSkip}
        </ControlButton>
        <ControlButton
          size="row"
          variant="primary"
          data-testid="own-submit"
          isDisabled={!v.trim()}
          onPress={() => {
            if (v.trim()) onSubmit(v.trim().replace(/\r\n?/g, "\n"));
          }}
        >
          {t.ownAdd}
        </ControlButton>
      </div>
    </div>
  );
}

/** The note for the agent as a short scripted conversation (issue
 * new-user-agent-instructions-template, A4.1 Keskustelu): the language the
 * agent answers in first, then how it answers and what it asks first, the
 * person's own words last, and the note shown whole in the instructions
 * editor before anything is written. The questions are the product's own
 * and no model runs; the page writes the note through the daemon, never an
 * agent's tools. Onboarding's last step and Settings' "Kirjoita agentin
 * kanssa" both show it. */
export function AgentNoteStep({
  name,
  defaultLanguage,
  existing,
  settings = false,
  onSave,
  onLater,
}: {
  /** The person's name as GitHub gives it; may be empty. */
  name: string;
  /** The preselected answer language (app/answerLanguage.ts). */
  defaultLanguage: AnswerLanguage;
  /** The note already on disk, kept as it is; undefined when there is none. */
  existing?: string;
  /** Opened from Settings rather than as onboarding's last step. */
  settings?: boolean;
  onSave: (text: string) => Promise<InstructionsSaveResult>;
  /** Tee myöhemmin / Jätä ennalleen: nothing is written. */
  onLater: () => void;
}) {
  const t = useText(agentNoteText);
  const has = existing !== undefined;
  const first = name.trim().split(/\s+/)[0] ?? "";
  const [answers, setAnswers] = useState<NoteAnswers>({});
  const [queue, setQueue] = useState<NoteQuestion[]>(() => noteQuestions(has));
  const [pendingOwn, setPendingOwn] = useState<string>();
  const seq = useRef(2);
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    {
      id: 1,
      who: "agent",
      text: has ? t.helloExisting(first) : t.hello(first),
    },
  ]);
  const say = (...m: Omit<Msg, "id">[]) =>
    setMsgs((old) => [...old, ...m.map((x) => ({ ...x, id: seq.current++ }))]);
  const q = queue[0];
  const done = queue.length === 0;
  const thread = useRef<HTMLDivElement>(null);
  const reveal = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new message or question scrolls the thread to its end.
  useEffect(() => {
    const el = thread.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, q]);
  useEffect(() => {
    if (done) reveal.current?.scrollIntoView?.({ block: "start" });
  }, [done]);

  const order: AnswerLanguage[] = [
    defaultLanguage,
    ...answerLanguages.filter((l) => l !== defaultLanguage),
  ];
  const advance = (rest: NoteQuestion[], extra: Omit<Msg, "id">[] = []) => {
    setQueue(rest);
    say(
      ...extra,
      ...(rest.length === 0
        ? [{ who: "agent" as const, text: has ? t.readyExisting : t.ready }]
        : []),
    );
  };
  const ownArrives = (raw: string) => {
    const rest = queue.slice(1);
    setAnswers((o) => ({ ...o, own: raw }));
    const fixed = tidyOwnWords(raw);
    if (fixed !== raw) {
      setPendingOwn(fixed);
      setQueue(["tidy", ...rest]);
      say({ who: "me", text: raw });
    } else
      advance(rest, [
        { who: "me", text: raw },
        { who: "agent", text: t.ownAdded },
      ]);
  };
  const choose = (i: number) => {
    const rest = queue.slice(1);
    if (q === "lang") {
      setAnswers((o) => ({ ...o, lang: order[i] }));
      return advance(rest, [{ who: "me", text: t.langChip[order[i]] }]);
    }
    if (q === "style") {
      setAnswers((o) => ({ ...o, style: i }));
      return advance(rest, [{ who: "me", text: t.choices.style[i].label }]);
    }
    if (q === "ask") {
      setAnswers((o) => ({ ...o, ask: i }));
      return advance(rest, [{ who: "me", text: t.choices.ask[i].label }]);
    }
    if (q === "tidy") {
      const use = i === 1;
      if (use && pendingOwn) setAnswers((o) => ({ ...o, own: pendingOwn }));
      setPendingOwn(undefined);
      return advance(rest, [
        { who: "me", text: use ? t.tidyUse : t.tidyKeep },
        { who: "agent", text: use ? t.tidyUsed : t.tidyKept },
      ]);
    }
  };
  const ask = (x: NoteQuestion): string =>
    x === "lang"
      ? t.askLang(t.langName[defaultLanguage])
      : x === "style"
        ? t.askStyle
        : x === "ask"
          ? t.askAsk
          : x === "own"
            ? t.askOwn
            : `${t.tidy}\n\n> ${(pendingOwn ?? "").replace(/\n/g, "\n> ")}`;
  const chips = (x: NoteQuestion): { label: string; primary?: boolean }[] =>
    x === "lang"
      ? order.map((l, i) => ({ label: t.langChip[l], primary: i === 0 }))
      : x === "tidy"
        ? [{ label: t.tidyKeep }, { label: t.tidyUse }]
        : (x === "style" ? t.choices.style : t.choices.ask).map((c) => ({
            label: c.label,
          }));
  const note = noteText(
    {
      ...t.note,
      langLine: t.langLine,
      style: t.choices.style,
      ask: t.choices.ask,
    },
    answers,
    name,
    existing,
  );
  const later = (
    <ControlButton
      data-testid="step-later"
      size="row"
      variant="quiet"
      onPress={onLater}
    >
      {has ? t.keep : t.later}
    </ControlButton>
  );

  return (
    <section
      className="ah-onboarding-step an-step"
      data-testid="instructions-step"
      data-revealed={done}
      aria-labelledby="an-step-title"
    >
      <header>
        {settings ? null : <p className="ah-eyebrow">{t.eyebrow}</p>}
        <h1
          id="an-step-title"
          ref={heading}
          data-testid="instructions-title"
          tabIndex={-1}
        >
          {settings ? t.titleSettings : t.title}
        </h1>
        <p>{has ? t.leadExisting : t.lead}</p>
      </header>
      <div className="an-chat" data-testid="step-chat">
        <div
          className="an-thread"
          ref={thread}
          data-testid="step-thread"
          role="log"
          aria-label={t.thread}
        >
          {msgs.map((m) => (
            <Bubble key={m.id} m={m} />
          ))}
          {q ? <Bubble m={{ id: 0, who: "agent", text: ask(q) }} /> : null}
        </div>
        {q && q !== "own" ? (
          <fieldset
            className="an-chips"
            aria-label={t.replies}
            data-testid="quick-replies"
            data-question={q}
          >
            {chips(q).map((c, i) => (
              <ControlButton
                key={c.label}
                size="row"
                variant={c.primary ? "primary" : "secondary"}
                data-testid="quick-reply"
                onPress={() => choose(i)}
              >
                {c.label}
              </ControlButton>
            ))}
          </fieldset>
        ) : null}
        {q === "own" ? (
          <OwnWords
            onSubmit={ownArrives}
            onSkip={() =>
              advance(queue.slice(1), [{ who: "me", text: t.ownSkipped }])
            }
          />
        ) : null}
      </div>
      {done ? (
        <div ref={reveal} className="an-reveal" data-testid="reveal">
          <p className="an-reveal-label">
            <Icon name="paperclip" aria-hidden="true" />
            {t.noteLabel}
          </p>
          <InstructionsEditor
            value={note}
            origin={existing ?? ""}
            label={t.editorLabel}
            keptPrefix={existing}
            alwaysSavable
            saveLabel={has ? t.saveMerge : t.save}
            onSave={onSave}
            secondary={later}
          />
        </div>
      ) : (
        <div className="ah-onboarding-actions">
          {later}
          <span />
        </div>
      )}
    </section>
  );
}
