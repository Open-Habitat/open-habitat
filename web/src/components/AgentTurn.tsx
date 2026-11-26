import {
  Fragment,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { formatDate, liveText } from "../i18n";
import { agentTurnText } from "../text/agentTurn";
import { conversationTimesText } from "../text/conversationTimes";
import { getWorkPreference } from "../workPreference";
import { ControlButton } from "./ControlElements";
import {
  AssistantMessage,
  ConversationVoice,
  InterimMessage,
  type MessageAt,
} from "./Conversation";
import { MessageTime } from "./ConversationTimes";
import { minutesLabel, turnMinutes } from "./conversationTimes";
import { Markdown } from "./Markdown";
import { ReplyCornerButton } from "./ReplyQuote";
import { StatusMark } from "./Status";

const txt = liveText(agentTurnText);
const timesTxt = liveText(conversationTimesText);

/**
 * A one-line title for reasoning that brings none (Claude's, for example): the
 * first line of the first paragraph without its Markdown marks.
 */
export function thinkingPreview(text: string): string | undefined {
  const line = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  if (!line) return undefined;
  const plain = line
    .replace(/^(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return undefined;
  return plain.length > 120 ? `${plain.slice(0, 119).trimEnd()}…` : plain;
}

export function ThinkingRow({
  text,
  redacted = false,
  live = false,
}: {
  text: string;
  redacted?: boolean;
  live?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (redacted) return <div className="ah-think-row">{txt.thinkingHidden}</div>;
  if (live)
    return (
      <div className="ah-think-row">
        <span>{txt.thinkingNow}</span>
        <span className="ah-think-live">
          <Markdown text={text.split("\n").filter(Boolean).at(-1) ?? "…"} />
        </span>
      </div>
    );
  if (!text.includes("\n"))
    return (
      <div className="ah-think-row">
        <span>{txt.thinking}</span>
        <Markdown text={text} />
      </div>
    );
  // Pi reasoning summaries use a standalone leading bold heading. Move only
  // that line into the disclosure; leave the remaining Markdown untouched.
  const heading = /^(?:[\t ]*\r?\n)*[\t ]*\*\*([^\r\n]+?)\*\*[\t ]*\r?\n/.exec(
    text,
  );
  const extracted =
    heading && !heading[1].includes("**") ? heading[1] : undefined;
  const body = extracted && heading ? text.slice(heading[0].length) : text;
  // Without a heading the first line is only a preview; the body keeps it.
  const title = extracted ?? thinkingPreview(text);
  return (
    <div className="ah-think-long">
      <ControlButton
        data-testid="thinking-toggle"
        variant="quiet"
        size="row"
        aria-expanded={open}
        aria-label={title ? txt.thinkingTitled(title) : undefined}
        onPress={() => setOpen(!open)}
      >
        <span>{txt.thinking}</span>
        {title ? (
          <span className="ah-think-title" title={title}>
            {`· ${title}`}
          </span>
        ) : null}
      </ControlButton>
      {open ? (
        <blockquote>
          <Markdown text={body} />
        </blockquote>
      ) : null}
    </div>
  );
}

/** A separate subtree for changing status text; the disclosure button never remounts on a tick. */
function WorkClock({
  activity,
  duration,
}: {
  activity?: string;
  duration?: string;
}) {
  return (
    <>
      <span className="ah-turn-activity">{activity ?? txt.thinkingNow}</span>
      {duration ? (
        <span className="ah-turn-clock" aria-live="off">
          {duration}
        </span>
      ) : null}
    </>
  );
}

/**
 * One piece of a turn in the order Pi wrote it. A text step closes a stage:
 * the work before it is that stage's work, and the text is Pi's message to
 * the person. The last text of a settled turn is the final answer; every
 * earlier one is an interim reply (Vaiheet, Jari 19.10.2026).
 */
export type TurnStep = (
  | { kind: "thinking"; key: string; node: ReactNode }
  | { kind: "tool"; key: string; node: ReactNode; failed?: boolean }
  | { kind: "other"; key: string; node: ReactNode }
  /** A message the agent sent to another conversation of the person
   * (agent-agent-messages): drawn where it was sent, in place of its tool
   * row, and closing the stage as a reply does. */
  | { kind: "message"; key: string; node: ReactNode }
  | {
      kind: "text";
      key: string;
      node: ReactNode;
      /** The text a copy button copies. */
      text: string;
      /** Native text exists beyond the bounded history preview. */
      readable?: boolean;
      /** The saved agent message a reply can answer: set on its first text
       * (reply-to-message). A streamed text has none yet. */
      replyEntry?: string;
    }
) & {
  /** When native history saved the step's entry, in epoch milliseconds. */
  at?: number;
};

type Stage = {
  work: Exclude<TurnStep, { kind: "text" | "message" }>[];
  end?: Extract<TurnStep, { kind: "text" | "message" }>;
};

export function turnStages(steps: TurnStep[]): Stage[] {
  const stages: Stage[] = [];
  let work: Stage["work"] = [];
  for (const step of steps) {
    if (step.kind === "text") {
      // Native/streamed blocks may exist before their first visible delta.
      // An empty reply still mounts a card and a grid gap, lifting the
      // bottom-filled activity line until that placeholder disappears.
      if (!step.text.trim() && !step.readable) continue;
      stages.push({ work, end: step });
      work = [];
    } else if (step.kind === "message") {
      stages.push({ work, end: step });
      work = [];
    } else work.push(step);
  }
  // A running turn always has a stage in progress, even before its first step.
  if (work.length || !stages.length) stages.push({ work });
  return stages;
}

/** "1 ajatus · 2 työkalua": a kind the stage has none of is left out. */
export function stageSummary(work: Stage["work"]): string {
  const thoughts = work.filter((step) => step.kind === "thinking").length;
  const tools = work.filter((step) => step.kind === "tool").length;
  const parts = [
    thoughts ? txt.thoughts(thoughts) : "",
    tools ? txt.tools(tools) : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : txt.work;
}

/** "14 s", "1 min 05 s", "2 h 03 min": how long a closed stage took. */
export function elapsedLabel(seconds: number): string {
  const s = Math.round(seconds);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${pad(s % 60)} s`;
  return `${Math.floor(s / 3600)} h ${pad(Math.floor((s % 3600) / 60))} min`;
}

/**
 * A stage runs from the entry that preceded it (the person's message, or the
 * reply that closed the previous stage) to the entry that closed it. Native
 * history saves an entry when it is complete, so these are the moments Pi
 * finished each piece. Without both ends the time is unknown, not zero.
 */
export function stageElapsed(
  stage: Stage,
  since: number | undefined,
): number | undefined {
  const until = stage.end?.at ?? stage.work.at(-1)?.at;
  if (since === undefined || until === undefined || until < since)
    return undefined;
  return (until - since) / 1000;
}

function StageRow({
  work,
  elapsed,
  open,
  onToggle,
}: {
  work: Stage["work"];
  elapsed?: number;
  open: boolean;
  onToggle: () => void;
}) {
  const failures = work.filter(
    (step) => step.kind === "tool" && step.failed,
  ).length;
  return (
    <div data-testid="turn-stage" className="ah-turn-stage">
      <ControlButton
        data-tool-count={work.filter((step) => step.kind === "tool").length}
        data-thinking-count={
          work.filter((step) => step.kind === "thinking").length
        }
        data-failures={failures}
        data-elapsed-seconds={
          elapsed === undefined ? undefined : Math.round(elapsed)
        }
        data-testid="history-stage-toggle"
        variant="quiet"
        size="row"
        aria-expanded={open}
        onPress={onToggle}
      >
        <span aria-hidden="true" className="ah-disclosure-chevron" />
        <span className="ah-stage-sum">{stageSummary(work)}</span>
        {failures ? (
          <>
            {" · "}
            <span data-testid="turn-failures" className="ah-turn-failures">
              {txt.failures(failures)}
            </span>
          </>
        ) : null}
        {elapsed !== undefined ? (
          <>
            {" · "}
            <span className="ah-stage-elapsed">{elapsedLabel(elapsed)}</span>
          </>
        ) : null}
      </ControlButton>
    </div>
  );
}

function StageReply({
  step,
  role,
  at,
}: {
  step: Extract<TurnStep, { kind: "text" }>;
  role: "interim" | "final" | "streaming" | "failed";
  /** The saved time after the name (conversation-times). */
  at?: MessageAt;
}) {
  const copy = () => void navigator.clipboard?.writeText(step.text);
  // Only a finished message is answered: a streamed one has no saved text.
  const actions =
    step.replyEntry && (role === "final" || role === "interim") ? (
      <ReplyCornerButton
        entryKey={step.replyEntry}
        time={
          step.at === undefined
            ? undefined
            : formatDate(new Date(step.at), {
                hour: "2-digit",
                minute: "2-digit",
              })
        }
      />
    ) : undefined;
  return (
    <div
      data-reply-kind={role}
      data-testid="stage-reply"
      data-reply-role={role}
      className={`ah-turn-reply${role === "interim" ? " ah-turn-interim" : ""}`}
    >
      {role === "interim" ? (
        <InterimMessage onCopy={copy} actions={actions} at={at}>
          {step.node}
        </InterimMessage>
      ) : (
        <AssistantMessage
          streamState={
            role === "failed"
              ? "failed"
              : role === "final"
                ? "complete"
                : "streaming"
          }
          onCopy={copy}
          actions={actions}
          at={at}
        >
          {step.node}
        </AssistantMessage>
      )}
    </div>
  );
}

/**
 * The quiet end of a turn the person stopped. Without it a stopped turn looks
 * like one that ended by itself (Jari 24.10.2026). Pi saves a turn the
 * daemon's restart cut the same way; that one says the server cut it, since
 * the person did nothing.
 */
function StoppedRow({
  at,
  by,
  times = false,
  took,
}: {
  at?: number;
  by?: "restart";
  /** conversation-times: the time follows the verb as it follows a
   * message's name ("Keskeytit 14.52"), and a long multi-stage turn's
   * duration joins it. */
  times?: boolean;
  took?: string;
}) {
  const time = at === undefined ? undefined : new Date(at);
  if (times && at !== undefined)
    return (
      <div
        data-testid="turn-stopped"
        data-by={by ?? "person"}
        className="ah-turn-stopped"
      >
        <span className="ah-turn-stopped-text">
          {by === "restart" ? txt.stoppedRestart : txt.stopped}{" "}
          <MessageTime at={at} took={took} />
        </span>
      </div>
    );
  return (
    <div
      data-testid="turn-stopped"
      data-by={by ?? "person"}
      className="ah-turn-stopped"
    >
      <span className="ah-turn-stopped-text">
        {by === "restart" ? txt.stoppedRestart : txt.stopped}
        {time ? (
          <>
            {" · "}
            <time
              dateTime={time.toISOString()}
              title={formatDate(time, {
                dateStyle: "short",
                timeStyle: "medium",
              })}
            >
              {formatDate(time, { hour: "2-digit", minute: "2-digit" })}
            </time>
          </>
        ) : null}
      </span>
    </div>
  );
}

/**
 * A native turn as stages. There is no turn head: each stage that did work
 * has a quiet summary row that opens only that stage, followed by the message
 * that closed it. While the turn runs, its current stage is the information
 * row (Näytä työ · Agentti työskentelee) in that stage's place.
 */
export function AgentTurn({
  steps,
  startedAt,
  stopped,
  failed = false,
  failure,
  working = false,
  activity,
  duration,
  changes,
  browser,
  times = false,
}: {
  steps: TurnStep[];
  /** When native history saved the message that started the turn. */
  startedAt?: number;
  /** Pi recorded the turn's end as an abort, saved at `at` when known;
   * `by` says a server restart, not the person, cut it. */
  stopped?: { at?: number; by?: "restart" };
  failed?: boolean;
  /** What the failed reply says instead of the provider's own words, in one
   * short row (an AI sign-in the provider refused). */
  failure?: ReactNode;
  working?: boolean;
  activity?: string;
  duration?: string;
  /** What the turn changed, under its reply once it has finished. */
  changes?: ReactNode;
  /** The Selain card: the browser the turn used, under its working row
   * while it runs and beside Muutokset once it has finished. */
  browser?: ReactNode;
  /** Times in a conversation (conversation-times, experimental): each
   * saved reply's time after its name, and a settled multi-stage turn's
   * duration on its final answer or its stopped row. */
  times?: boolean;
}) {
  const voice = useContext(ConversationVoice);
  const stages = turnStages(steps);
  // A running turn that has just sent a message works on below it.
  if (working && stages.at(-1)?.end?.kind === "message")
    stages.push({ work: [] });
  const current = working ? stages.length - 1 : -1;
  const [live, setLive] = useState(
    () => working && getWorkPreference() === "visible",
  );
  const [opened, setOpened] = useState<Record<number, boolean>>({});
  // A stage that was open while it ran stays open when it closes, so the
  // reader's view does not jump when Pi moves on or the turn settles.
  const [wasCurrent, setWasCurrent] = useState(current);
  if (wasCurrent !== current) {
    if (wasCurrent >= 0 && live && opened[wasCurrent] === undefined)
      setOpened({ ...opened, [wasCurrent]: true });
    setWasCurrent(current);
  }
  const button = useRef<HTMLButtonElement>(null);
  const pendingTop = useRef<number | null>(null);
  const [revealing, setRevealing] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the open commit is the layout trigger; refs alone do not trigger effects.
  useLayoutEffect(() => {
    if (pendingTop.current === null || !button.current) return;
    const viewport = button.current.closest<HTMLElement>(
      ".ah-conversation-stream",
    );
    if (viewport)
      viewport.scrollTop +=
        button.current.getBoundingClientRect().top - pendingTop.current;
    pendingTop.current = null;
  }, [live]);
  const toggleLive = () => {
    pendingTop.current = button.current?.getBoundingClientRect().top ?? null;
    button.current
      ?.closest(".ah-conversation-stream")
      ?.dispatchEvent(new Event("ah:work-toggle"));
    setRevealing(!live);
    setLive(!live);
  };
  const lastStage = stages.at(-1);
  const lastEnd = !working ? lastStage?.end : undefined;
  const finalStep = lastEnd?.kind === "text" ? lastEnd : undefined;
  const minutes =
    times && !working && (stopped || !failed)
      ? turnMinutes({
          startedAt,
          endedAt: stopped ? stopped.at : finalStep?.at,
          stages: stages.length,
        })
      : undefined;
  const took =
    minutes === undefined
      ? undefined
      : timesTxt.turnTook(minutesLabel(minutes));
  const replyAt = (
    step: Extract<TurnStep, { kind: "text" }>,
    role: string,
  ): MessageAt | undefined =>
    times && role !== "streaming" && step.at !== undefined
      ? {
          ms: step.at,
          took: !stopped && step === finalStep ? took : undefined,
        }
      : undefined;
  return (
    // Unnamed, so not a landmark: a conversation holds many turns, and
    // landmark navigation would list them as identical entries. The
    // conversation list item is how a screen reader moves between turns.
    <section data-testid="agent-turn" className="ah-agent-turn">
      {stages.map((stage, index) => {
        const running = index === current;
        const open = running ? live : (opened[index] ?? false);
        const role = !stage.end
          ? undefined
          : running
            ? "streaming"
            : stage.end === finalStep
              ? failed
                ? "failed"
                : "final"
              : "interim";
        return (
          // Stages only grow at the end, so the index is a stable identity:
          // a running stage keeps its open rows when Pi starts writing.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above.
          <Fragment key={index}>
            {!running && stage.work.length ? (
              <StageRow
                work={stage.work}
                elapsed={stageElapsed(
                  stage,
                  index ? stages[index - 1].end?.at : startedAt,
                )}
                open={open}
                onToggle={() => setOpened({ ...opened, [index]: !open })}
              />
            ) : null}
            {open && stage.work.length ? (
              <div
                className={`ah-turn-work${running && revealing ? " ah-work-revealing" : ""}`}
              >
                {stage.work.map((step) => (
                  <Fragment key={step.key}>{step.node}</Fragment>
                ))}
              </div>
            ) : null}
            {running ? (
              <div className="ah-turn-strip ah-turn-working">
                <ControlButton
                  ref={button}
                  data-testid="turn-work-toggle"
                  className="ah-show-work"
                  size="inline"
                  presentation="pill"
                  aria-expanded={live}
                  onPress={toggleLive}
                >
                  <span className="ah-work-label">
                    {live ? txt.hideWork : txt.showWork}
                  </span>
                  <span aria-hidden="true" className="ah-disclosure-chevron" />
                </ControlButton>
                <span
                  data-working={running}
                  data-testid="turn-progress"
                  className="ah-turn-status"
                  role="status"
                >
                  <span className="ah-turn-status-name">
                    <StatusMark
                      kind="working"
                      mark="working"
                      label={
                        voice === "person"
                          ? txt.agentWorking
                          : txt.workerWorking
                      }
                    />
                  </span>
                  <WorkClock activity={activity} duration={duration} />
                </span>
              </div>
            ) : null}
            {stage.end?.kind === "message" ? (
              <div className="ah-turn-reply" data-testid="stage-message">
                {stage.end.node}
              </div>
            ) : stage.end && role ? (
              <StageReply
                step={stage.end}
                role={role}
                at={replyAt(stage.end, role)}
              />
            ) : null}
          </Fragment>
        );
      })}
      {failed && !working && (!finalStep || failure) ? (
        <div
          data-reply-kind="failed"
          data-testid="stage-reply"
          data-reply-role="failed"
          className="ah-turn-reply"
        >
          <AssistantMessage streamState="failed" onCopy={() => {}}>
            {failure ? (
              <p className="ah-turn-short" data-testid="turn-short">
                {failure}
              </p>
            ) : null}
          </AssistantMessage>
        </div>
      ) : null}
      {!working ? changes : null}
      {browser}
      {stopped && !working ? (
        <StoppedRow at={stopped.at} by={stopped.by} times={times} took={took} />
      ) : null}
    </section>
  );
}
