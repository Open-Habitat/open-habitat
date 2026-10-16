import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { getWorkPreference } from "../workPreference";
import { ControlButton } from "./ControlElements";
import { Markdown } from "./Markdown";

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
  const title = heading && !heading[1].includes("**") ? heading[1] : undefined;
  const body = title && heading ? text.slice(heading[0].length) : text;
  return (
    <div className="ah-think-long">
      <ControlButton
        variant="quiet"
        size="compact"
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

export function AgentTurn({
  model,
  work,
  reply,
  working = false,
  activity,
  duration,
  thinkingCount,
  toolCount,
  failureCount = 0,
}: {
  model?: string;
  work: ReactNode;
  reply?: ReactNode;
  working?: boolean;
  activity?: string;
  duration?: string;
  thinkingCount: number;
  toolCount: number;
  failureCount?: number;
}) {
  const [open, setOpen] = useState(
    () => working && getWorkPreference() === "visible",
  );
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
  }, [open]);
  const toggle = () => {
    pendingTop.current = button.current?.getBoundingClientRect().top ?? null;
    button.current
      ?.closest(".ah-conversation-stream")
      ?.dispatchEvent(new Event("ah:work-toggle"));
    setRevealing(!open);
    setOpen(!open);
  };
  return (
    <section className="ah-agent-turn" aria-label="Agentin vuoro">
      <div className="ah-turn-head">
        <span className="ah-turn-node" />
        <ControlButton
          variant="quiet"
          size="compact"
          isDisabled={working}
          aria-expanded={working ? undefined : open}
          onPress={working ? undefined : toggle}
        >
          {!working ? (
            <span aria-hidden="true" className="ah-disclosure-chevron" />
          ) : null}
          PI{model ? ` · ${model}` : ""}
          {!working
            ? ` · ${thinkingCount} ajatusta · ${toolCount} työkalua${duration ? ` · ${duration}` : ""}`
            : ""}
          {failureCount > 0 ? (
            <span className="ah-turn-failures">
              {" "}
              · {failureCount} epäonnistui
            </span>
          ) : null}
        </ControlButton>
      </div>
      {open ? (
        <div className={`ah-turn-work${revealing ? " ah-work-revealing" : ""}`}>
          {work}
        </div>
      ) : null}
      {working ? (
        <div className="ah-turn-strip ah-turn-working">
          <ControlButton
            ref={button}
            className="ah-show-work"
            variant="quiet"
            size="compact"
            aria-expanded={open}
            onPress={toggle}
          >
            <span className="ah-work-label">
              {open ? "Piilota työ" : "Näytä työ"}
            </span>
            <span aria-hidden="true" className="ah-disclosure-chevron" />
          </ControlButton>
          <span className="ah-turn-status" role="status">
            <span className="ah-turn-status-name">● Agentti työskentelee</span>
            <WorkClock activity={activity} duration={duration} />
          </span>
        </div>
      ) : null}
      {reply ? <div className="ah-turn-reply">{reply}</div> : null}
    </section>
  );
}
