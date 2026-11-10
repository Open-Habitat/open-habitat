import { Fragment, useId, useState } from "react";
import { FileToolCard } from "../../../../web/src/components/FileToolCard";
import { Icon } from "../../../../web/src/components/Icon";
import {
  Counts,
  FileDiff,
  FileName,
  ordered,
  Tags,
} from "../2026-11-10-vuoron-muutokset/changes";
import {
  counts,
  eventCounts,
  type FileChange,
  type FileEvent,
  type Turn,
} from "../2026-11-10-vuoron-muutokset/turn";
import type { Text } from "./text";

// Round 2: Yhteenveto (round 1's direction 1) as the base, collapsed by
// default as Katselmointi's button was, and Aikajana's per-file tracks behind
// an optional button. The variants differ only where a question is still
// open: what the collapsed line says, and where the timeline button sits.
// Every diff is still production's FileToolCard through round 1's FileDiff.

export type Variant = "tiivis" | "nimet" | "rivilla";

export type Shared = {
  t: Text;
  files: FileChange[];
  running: boolean;
  /** null where production offers no editor (a phone). */
  onOpen: ((path: string, line?: number) => void) | null;
};

const total = (files: FileChange[]) =>
  files.reduce(
    (s, f) => {
      const c = counts(f);
      return c ? { add: s.add + c.add, del: s.del + c.del } : s;
    },
    { add: 0, del: 0 },
  );

const base = (path: string) => path.slice(path.lastIndexOf("/") + 1);
/** How many names the Nimet line lists before "+N muuta". */
const NAMES = 4;

export function Changes({
  s,
  variant,
  turn,
  now,
}: {
  s: Shared;
  variant: Variant;
  turn: Turn;
  now: number;
}) {
  const [open, setOpen] = useState(false);
  const [timeline, setTimeline] = useState(false);
  const [rows, setRows] = useState<Record<string, boolean>>({});
  const body = useId();
  const files = ordered(s.files);
  if (!files.length) return null;
  const one = files.length === 1 ? files[0] : undefined;
  const sum = total(files);
  // The timeline button is on the line itself only in Aikajana rivillä;
  // elsewhere it appears once the list is open.
  const timelineButton = open || variant === "rivilla";
  return (
    <section
      className="vm-card v2-changes"
      data-testid="turn-changes"
      data-open={open ? "true" : undefined}
      data-variant={variant}
      aria-label={s.t.changes}
    >
      <div className="v2-head">
        <button
          type="button"
          className="v2-toggle"
          data-testid="changes-toggle"
          aria-expanded={open}
          aria-controls={body}
          aria-label={`${s.t.showChanges}: ${one ? one.path : s.t.files(files.length)}`}
          onClick={() => setOpen(!open)}
        >
          <span aria-hidden="true" className="ah-disclosure-chevron" />
          <Icon name="file" aria-hidden="true" />
          <span className="v2-line">
            <span className="v2-title">
              {s.t.changes}
              {s.running ? (
                <span className="v2-sofar"> · {s.t.soFarLine}</span>
              ) : null}
            </span>
            <span className="v2-meta" data-testid="changes-meta">
              {one ? (
                <FileName path={one.path} />
              ) : (
                <span>{s.t.files(files.length)}</span>
              )}
              <Counts c={sum} />
            </span>
          </span>
          {variant === "nimet" && !one ? (
            <span className="v2-names" data-testid="changes-names">
              {files.slice(0, NAMES).map((f, i) => (
                <Fragment key={f.path}>
                  {i ? ", " : null}
                  <span className="v2-name" data-change={f.change}>
                    {base(f.path)}
                  </span>
                </Fragment>
              ))}
              {files.length > NAMES ? (
                <span className="v2-more">
                  {" "}
                  {s.t.more(files.length - NAMES)}
                </span>
              ) : null}
            </span>
          ) : null}
        </button>
        {timelineButton ? (
          <button
            type="button"
            className="v2-tl-button"
            data-testid="timeline-toggle"
            aria-pressed={open && timeline}
            aria-label={s.t.timelineOn}
            onClick={() => {
              if (!open) {
                setOpen(true);
                setTimeline(true);
              } else setTimeline(!timeline);
            }}
          >
            <Icon name="clock" aria-hidden="true" />
            <span>{s.t.timelineButton}</span>
          </button>
        ) : null}
      </div>
      {open ? (
        <div id={body} className="v2-body">
          {s.running ? <p className="vm-running">{s.t.running}</p> : null}
          {timeline ? (
            <TimelineBody s={s} files={files} turn={turn} now={now} />
          ) : (
            <ul className="vm-list">
              {files.map((f) => {
                const expanded = !!rows[f.path];
                return (
                  <li key={f.path} data-path={f.path}>
                    <button
                      type="button"
                      className="vm-row"
                      data-testid="change-row"
                      aria-expanded={expanded}
                      aria-label={s.t.showDiff(f.path)}
                      onClick={() => setRows({ ...rows, [f.path]: !expanded })}
                    >
                      <span
                        aria-hidden="true"
                        className="ah-disclosure-chevron"
                      />
                      <FileName path={f.path} />
                      <Tags f={f} t={s.t} />
                      <Counts c={counts(f)} />
                    </button>
                    {expanded ? <FileDiff f={f} s={s} /> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}

// ---------- Aikajana behind the button: round 1's tracks without their card ----------

const clock = (ms: number) => {
  const sec = Math.round(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
};

/** One event as its tool card showed it. */
function EventDiff({ e, f, s }: { e: FileEvent; f: FileChange; s: Shared }) {
  if (e.edits)
    return (
      <FileToolCard
        name="edit"
        argumentsText={JSON.stringify({ path: f.path, edits: e.edits })}
      />
    );
  if (e.content !== undefined)
    return (
      <FileToolCard
        name="write"
        argumentsText={JSON.stringify({ path: f.path, content: e.content })}
      />
    );
  return <FileDiff f={f} s={{ ...s, onOpen: null }} />;
}

function TimelineBody({
  s,
  files,
  turn,
  now,
}: {
  s: Shared;
  files: FileChange[];
  turn: Turn;
  now: number;
}) {
  const [pick, setPick] = useState<[string, number] | undefined>();
  const end = turn.steps.at(-1)?.at ?? now;
  // A running turn's end is not known: the scale is what has passed, with room.
  const span = s.running ? Math.max(now * 1.15, 1) : end;
  const pos = (at: number) => `${Math.min(100, (at / span) * 100)}%`;
  const interims = turn.steps.filter(
    (x) => x.kind === "text" && x !== turn.steps.at(-1) && x.at <= now,
  );
  const stages = [0, ...interims.map((x) => x.at), s.running ? now : end];
  return (
    <div className="vm-tl-grid" data-testid="timeline">
      <div className="vm-tl-axis" aria-hidden="true">
        <span />
        <div className="vm-tl-track vm-tl-scale">
          {stages.slice(0, -1).map((from, i) => (
            <span
              key={from}
              className="vm-tl-stage"
              style={{
                left: pos(from),
                width: `calc(${pos(stages[i + 1])} - ${pos(from)})`,
              }}
            >
              {s.t.stage(i + 1)}
            </span>
          ))}
          <span className="vm-tl-tick" style={{ left: 0 }}>
            0:00
          </span>
          <span
            className="vm-tl-tick vm-tl-tick-end"
            style={{ left: pos(s.running ? now : end) }}
          >
            {s.running ? `${s.t.now} ${clock(now)}` : clock(end)}
          </span>
        </div>
      </div>
      {files.map((f) => {
        const chosen = pick?.[0] === f.path ? pick[1] : undefined;
        return (
          <Fragment key={f.path}>
            <div
              className="vm-tl-row"
              data-path={f.path}
              data-testid="timeline-row"
            >
              <button
                type="button"
                className="vm-tl-name"
                aria-pressed={chosen === -1}
                aria-label={s.t.finalOf(f.path)}
                onClick={() =>
                  setPick(chosen === -1 ? undefined : [f.path, -1])
                }
              >
                <FileName path={f.path} />
                <Counts c={counts(f)} />
              </button>
              <div className="vm-tl-track">
                {interims.map((x) => (
                  <span
                    key={x.key}
                    className="vm-tl-interim"
                    style={{ left: pos(x.at) }}
                    aria-hidden="true"
                  />
                ))}
                {s.running ? (
                  <span
                    className="vm-tl-now"
                    style={{ left: pos(now) }}
                    aria-hidden="true"
                  />
                ) : null}
                {f.events.map((e, i) => (
                  <button
                    type="button"
                    key={e.step}
                    className="vm-tl-mark"
                    data-testid="timeline-mark"
                    data-tool={e.tool}
                    data-change={f.change}
                    aria-pressed={chosen === i}
                    aria-label={s.t.marker(f.path, i + 1, clock(e.at))}
                    style={{ left: pos(e.at) }}
                    onClick={() =>
                      setPick(chosen === i ? undefined : [f.path, i])
                    }
                  />
                ))}
              </div>
            </div>
            {chosen !== undefined ? (
              <div className="vm-tl-detail" data-testid="timeline-detail">
                <div className="vm-tl-detail-head">
                  <span className="vm-tl-segment" role="group">
                    {f.events.map((e, i) => (
                      <button
                        type="button"
                        key={e.step}
                        aria-pressed={chosen === i}
                        onClick={() => setPick([f.path, i])}
                        data-testid="timeline-step"
                      >
                        {clock(e.at)}
                        <Counts c={eventCounts(e, f)} />
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-pressed={chosen === -1}
                      onClick={() => setPick([f.path, -1])}
                      data-testid="timeline-final"
                    >
                      {s.t.final}
                      <Counts c={counts(f)} />
                    </button>
                  </span>
                  <span className="vm-tl-what">
                    {chosen >= 0 ? (
                      s.t.eventLabel(
                        chosen + 1,
                        f.events.length,
                        clock(f.events[chosen].at),
                        f.events[chosen].tool,
                      )
                    ) : (
                      <Tags f={f} t={s.t} />
                    )}
                  </span>
                </div>
                {chosen >= 0 ? (
                  <EventDiff e={f.events[chosen]} f={f} s={s} />
                ) : (
                  <FileDiff f={f} s={s} />
                )}
              </div>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
