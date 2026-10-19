import {
  Fragment,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { getWorkPreference } from "../workPreference";
import { ControlButton } from "./ControlElements";
import { AssistantMessage, InterimMessage } from "./Conversation";
import { Markdown } from "./Markdown";

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
  if (redacted)
    return <div className="ah-think-row">Ajattelu · piilotettu</div>;
  if (live)
    return (
      <div className="ah-think-row">
        <span>Ajattelee</span>
        <span className="ah-think-live">
          <Markdown text={text.split("\n").filter(Boolean).at(-1) ?? "…"} />
        </span>
      </div>
    );
  if (!text.includes("\n"))
    return (
      <div className="ah-think-row">
        <span>Ajattelu</span>
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
        variant="quiet"
        size="row"
        aria-expanded={open}
        aria-label={title ? `Ajattelu · ${title}` : undefined}
        onPress={() => setOpen(!open)}
      >
        <span>Ajattelu</span>
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
      <span className="ah-turn-activity">{activity ?? "Ajattelee"}</span>
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
export type TurnStep =
  | { kind: "thinking"; key: string; node: ReactNode }
  | {
      kind: "tool";
      key: string;
      node: ReactNode;
      /** What the stage summary names the call by, such as a bash command. */
      target?: ReactNode;
      failed?: boolean;
    }
  | { kind: "other"; key: string; node: ReactNode }
  | {
      kind: "text";
      key: string;
      node: ReactNode;
      /** The text a copy button copies. */
      text: string;
      model?: string;
    };

type Stage = {
  work: Exclude<TurnStep, { kind: "text" }>[];
  end?: Extract<TurnStep, { kind: "text" }>;
};

export function turnStages(steps: TurnStep[]): Stage[] {
  const stages: Stage[] = [];
  let work: Stage["work"] = [];
  for (const step of steps) {
    if (step.kind === "text") {
      stages.push({ work, end: step });
      work = [];
    } else work.push(step);
  }
  // A running turn always has a stage in progress, even before its first step.
  if (work.length || !stages.length) stages.push({ work });
  return stages;
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** "1 ajatus · 2 työkalua": a kind the stage has none of is left out. */
export function stageSummary(work: Stage["work"]): string {
  const thoughts = work.filter((step) => step.kind === "thinking").length;
  const tools = work.filter((step) => step.kind === "tool").length;
  const parts = [
    thoughts ? plural(thoughts, "ajatus", "ajatusta") : "",
    tools ? plural(tools, "työkalu", "työkalua") : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Työ";
}

function StageRow({
  work,
  open,
  onToggle,
}: {
  work: Stage["work"];
  open: boolean;
  onToggle: () => void;
}) {
  const target = work.findLast((step) => step.kind === "tool")?.target;
  const failures = work.filter(
    (step) => step.kind === "tool" && step.failed,
  ).length;
  return (
    <div className="ah-turn-stage">
      <ControlButton
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
            <span className="ah-turn-failures">{failures} epäonnistui</span>
          </>
        ) : null}
        {target ? (
          <>
            {" · "}
            <code className="ah-stage-target">{target}</code>
          </>
        ) : null}
      </ControlButton>
    </div>
  );
}

function StageReply({
  step,
  role,
  model,
}: {
  step: Extract<TurnStep, { kind: "text" }>;
  role: "interim" | "final" | "streaming";
  model?: string;
}) {
  const copy = () => void navigator.clipboard?.writeText(step.text);
  return (
    <div
      className={`ah-turn-reply${role === "interim" ? " ah-turn-interim" : ""}`}
    >
      {role === "interim" ? (
        <InterimMessage onCopy={copy}>{step.node}</InterimMessage>
      ) : (
        <AssistantMessage
          streamState={role === "final" ? "complete" : "streaming"}
          modelLabel={step.model ?? model}
          onCopy={copy}
        >
          {step.node}
        </AssistantMessage>
      )}
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
  model,
  working = false,
  activity,
  duration,
}: {
  steps: TurnStep[];
  /** The model the final answer names when its own step does not. */
  model?: string;
  working?: boolean;
  activity?: string;
  duration?: string;
}) {
  const stages = turnStages(steps);
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
  const lastText = steps.findLastIndex((step) => step.kind === "text");
  const finalStep =
    !working && lastText === steps.length - 1 ? steps[lastText] : undefined;
  return (
    <section className="ah-agent-turn" aria-label="Agentin vuoro">
      {stages.map((stage, index) => {
        const running = index === current;
        const open = running ? live : (opened[index] ?? false);
        const role = !stage.end
          ? undefined
          : running
            ? "streaming"
            : stage.end === finalStep
              ? "final"
              : "interim";
        return (
          // Stages only grow at the end, so the index is a stable identity:
          // a running stage keeps its open rows when Pi starts writing.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above.
          <Fragment key={index}>
            {!running && stage.work.length ? (
              <StageRow
                work={stage.work}
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
                  className="ah-show-work"
                  size="inline"
                  presentation="pill"
                  aria-expanded={live}
                  onPress={toggleLive}
                >
                  <span className="ah-work-label">
                    {live ? "Piilota työ" : "Näytä työ"}
                  </span>
                  <span aria-hidden="true" className="ah-disclosure-chevron" />
                </ControlButton>
                <span className="ah-turn-status" role="status">
                  <span className="ah-turn-status-name">
                    ● Agentti työskentelee
                  </span>
                  <WorkClock activity={activity} duration={duration} />
                </span>
              </div>
            ) : null}
            {stage.end && role ? (
              <StageReply step={stage.end} role={role} model={model} />
            ) : null}
          </Fragment>
        );
      })}
    </section>
  );
}
