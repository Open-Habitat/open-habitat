import { type ReactNode, useState } from "react";
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
  return (
    <div className="ah-think-long">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        Ajattelu
      </button>
      {open ? (
        <blockquote>
          <Markdown text={text} />
        </blockquote>
      ) : null}
    </div>
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
}: {
  model?: string;
  work: ReactNode;
  reply?: ReactNode;
  working?: boolean;
  activity?: string;
  duration?: string;
  thinkingCount: number;
  toolCount: number;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="ah-agent-turn" aria-label="Agentin vuoro">
      <div className="ah-turn-head">
        <span className="ah-turn-node" />
        <button
          type="button"
          disabled={working}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          PI{model ? ` · ${model}` : ""}
          {!open ? ` · ${thinkingCount} ajatusta · ${toolCount} työkalua` : ""}
        </button>
      </div>
      {open ? <div className="ah-turn-work">{work}</div> : null}
      {reply ? <div className="ah-turn-reply">{reply}</div> : null}
      <div
        className={working ? "ah-turn-strip ah-turn-working" : "ah-turn-strip"}
      >
        {working ? (
          <span role="status">
            ● {activity ?? "Työskentelee"}
            {duration ? ` · ${duration}` : ""}
          </span>
        ) : (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            Työ · {thinkingCount} ajatusta · {toolCount} työkalua
            {duration ? ` · ${duration}` : ""}
          </button>
        )}
      </div>
    </section>
  );
}
