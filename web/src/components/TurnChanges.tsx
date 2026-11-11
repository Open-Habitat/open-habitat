import { Fragment, useId, useState } from "react";
import {
  type Counts,
  eventCounts,
  type FileChange,
  type FileEvent,
  totalCounts,
  unifiedDiff,
} from "../app/turnChanges";
import { liveText } from "../i18n";
import { turnChangesText } from "../text/turnChanges";
import { ControlButton } from "./ControlElements";
import { FileToolCard } from "./FileToolCard";
import { Icon } from "./Icon";
import "./TurnChanges.css";

const txt = liveText(turnChangesText);

// Muutokset (turn-changes, experimental; proto-turn-changes round 2, Tiivis
// with Aikajana on the line, Jari 11.11.2026): one collapsed line under a
// finished turn's reply. It opens in place to the turn's files, each opening
// its whole change; the timeline button shows the same files on the turn's
// clock instead of the list. Every diff is the conversation's FileToolCard.

export type TurnChangesProps = {
  files: FileChange[];
  /** The turn's start and end and its interim replies, epoch ms. */
  start?: number;
  end?: number;
  interims?: number[];
  /** Opens a workspace file in the editor; absent where none is offered. */
  onOpen?: (path: string, line?: number) => void;
};

function CountsText({ c }: { c?: Counts }) {
  if (!c || (!c.add && !c.del)) return null;
  return (
    <span className="ah-tc-counts">
      {c.add ? <span className="ah-tc-add">+{c.add}</span> : null}
      {c.del ? <span className="ah-tc-del">−{c.del}</span> : null}
    </span>
  );
}

function FileName({ path }: { path: string }) {
  const cut = path.lastIndexOf("/") + 1;
  return (
    <span className="ah-tc-path" title={path}>
      {cut ? <span className="ah-tc-dir">{path.slice(0, cut)}</span> : null}
      <span className="ah-tc-base">{path.slice(cut)}</span>
    </span>
  );
}

function Tags({ f }: { f: FileChange }) {
  const edits = f.events.filter((e) => e.tool !== "bash").length;
  return (
    <span className="ah-tc-tags">
      {f.change === "written" ? (
        <span className="ah-tc-tag" data-tag="written">
          {txt.written}
        </span>
      ) : null}
      {f.change === "deleted" ? (
        <span className="ah-tc-tag" data-tag="deleted">
          {txt.deleted}
        </span>
      ) : null}
      {f.command ? (
        <span className="ah-tc-tag" data-tag="command">
          {txt.byCommand}
        </span>
      ) : null}
      {edits > 1 ? (
        <span className="ah-tc-tag-plain" data-testid="turn-changes-edits">
          {txt.edits(edits)}
        </span>
      ) : null}
    </span>
  );
}

function Note({
  icon,
  children,
}: {
  icon: "terminal" | "file";
  children: React.ReactNode;
}) {
  return (
    <p className="ah-tc-note">
      <Icon name={icon} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** The turn's whole change to one file. */
function FileDiff({
  f,
  onOpen,
}: {
  f: FileChange;
  onOpen?: TurnChangesProps["onOpen"];
}) {
  const edits = f.events.flatMap((e) => e.edits ?? []);
  const lastWrite = f.events.findLast((e) => e.content !== undefined);
  let body: React.ReactNode = null;
  if (f.change === "deleted")
    body = (
      <>
        <Note icon="file">
          {f.before !== undefined
            ? txt.deletedLines(f.counts?.del ?? 0)
            : txt.deletedNote}
        </Note>
        {f.before ? (
          <FileToolCard
            name="edit"
            argumentsText={JSON.stringify({ path: f.path })}
            output={unifiedDiff(f.path, f.before, "")}
          />
        ) : null}
      </>
    );
  else if (f.before !== undefined && f.after !== undefined)
    body = (
      <FileToolCard
        name="edit"
        argumentsText={JSON.stringify({ path: f.path })}
        output={unifiedDiff(f.path, f.before, f.after)}
      />
    );
  else if (f.change === "written" && f.after !== undefined)
    body = (
      <>
        <Note icon="file">{txt.writtenNote}</Note>
        <FileToolCard
          name="write"
          argumentsText={JSON.stringify({ path: f.path, content: f.after })}
        />
      </>
    );
  else if (lastWrite && f.after !== undefined)
    body = (
      <FileToolCard
        name="write"
        argumentsText={JSON.stringify({ path: f.path, content: f.after })}
      />
    );
  else if (edits.length)
    body = (
      <>
        {f.command ? null : <Note icon="file">{txt.editsNote}</Note>}
        <FileToolCard
          name="edit"
          argumentsText={JSON.stringify({ path: f.path, edits })}
        />
      </>
    );
  const editor =
    onOpen && f.inWorkspace && f.change !== "deleted" ? (
      <ControlButton
        data-testid="turn-changes-open-editor"
        size="inline"
        variant="secondary"
        onPress={() => onOpen(f.path, f.firstLine)}
      >
        <Icon name="editor" aria-hidden="true" />
        {f.firstLine ? txt.openEditorAt(f.firstLine) : txt.openEditor}
      </ControlButton>
    ) : null;
  return (
    <div className="ah-tc-diff" data-testid="turn-changes-diff">
      {f.command ? (
        <Note icon="terminal">
          {txt.commandNote} <code>{f.command}</code>. {txt.commandSource}
        </Note>
      ) : null}
      {body}
      {editor ? <div className="ah-tc-actions">{editor}</div> : null}
    </div>
  );
}

/** One event as its tool card showed it. */
function EventDiff({ e, f }: { e: FileEvent; f: FileChange }) {
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
  return (
    <div className="ah-tc-diff">
      <Note icon="terminal">
        {txt.commandNote} <code>{e.command}</code>. {txt.commandSource}
      </Note>
    </div>
  );
}

const clock = (ms: number) => {
  const sec = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
};

function Timeline({
  files,
  start,
  end,
  interims,
  onOpen,
}: Required<Pick<TurnChangesProps, "files" | "interims">> &
  Pick<TurnChangesProps, "start" | "end" | "onOpen">) {
  const [pick, setPick] = useState<[string, number] | undefined>();
  const moments = files.flatMap((f) =>
    f.events.flatMap((e) => (e.at === undefined ? [] : [e.at])),
  );
  const from = start ?? Math.min(...moments);
  const until = Math.max(end ?? from, ...moments, from + 1000);
  const span = until - from;
  const pos = (at: number) =>
    `${Math.min(100, Math.max(0, ((at - from) / span) * 100))}%`;
  const inner = interims.filter((at) => at > from && at < until);
  const stages = [from, ...inner, until];
  return (
    <div className="ah-tc-grid" data-testid="turn-changes-timeline">
      <div className="ah-tc-axis" aria-hidden="true">
        <span />
        <div className="ah-tc-track ah-tc-scale">
          {stages.length > 2
            ? stages.slice(0, -1).map((at, i) => (
                <span
                  key={at}
                  className="ah-tc-stage"
                  style={{
                    left: pos(at),
                    width: `calc(${pos(stages[i + 1])} - ${pos(at)})`,
                  }}
                >
                  {txt.stage(i + 1)}
                </span>
              ))
            : null}
          <span className="ah-tc-tick" style={{ left: 0 }}>
            0:00
          </span>
          <span className="ah-tc-tick ah-tc-tick-end" style={{ left: "100%" }}>
            {clock(span)}
          </span>
        </div>
      </div>
      {files.map((f) => {
        const chosen = pick?.[0] === f.path ? pick[1] : undefined;
        return (
          <Fragment key={f.path}>
            <div className="ah-tc-row" data-testid="turn-changes-timeline-row">
              <button
                type="button"
                className="ah-tc-name"
                aria-pressed={chosen === -1}
                aria-label={txt.finalOf(f.path)}
                onClick={() =>
                  setPick(chosen === -1 ? undefined : [f.path, -1])
                }
              >
                <FileName path={f.path} />
                <CountsText c={f.counts} />
              </button>
              <div className="ah-tc-track">
                {inner.map((at) => (
                  <span
                    key={at}
                    className="ah-tc-interim"
                    style={{ left: pos(at) }}
                    aria-hidden="true"
                  />
                ))}
                {f.events.map((e, i) =>
                  e.at === undefined ? null : (
                    <button
                      type="button"
                      key={e.callId}
                      className="ah-tc-mark"
                      data-testid="turn-changes-mark"
                      data-tool={e.tool}
                      data-change={f.change}
                      aria-pressed={chosen === i}
                      aria-label={txt.marker(f.path, i + 1, clock(e.at - from))}
                      style={{ left: pos(e.at) }}
                      onClick={() =>
                        setPick(chosen === i ? undefined : [f.path, i])
                      }
                    />
                  ),
                )}
              </div>
            </div>
            {chosen !== undefined ? (
              <div className="ah-tc-detail" data-testid="turn-changes-detail">
                <div className="ah-tc-detail-head">
                  <fieldset className="ah-tc-segment" aria-label={txt.steps}>
                    {f.events.map((e, i) => (
                      <button
                        type="button"
                        key={e.callId}
                        aria-pressed={chosen === i}
                        onClick={() => setPick([f.path, i])}
                      >
                        {e.at === undefined ? i + 1 : clock(e.at - from)}
                        <CountsText c={eventCounts(e)} />
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-pressed={chosen === -1}
                      onClick={() => setPick([f.path, -1])}
                    >
                      {txt.final}
                      <CountsText c={f.counts} />
                    </button>
                  </fieldset>
                  <span className="ah-tc-what">
                    {chosen >= 0 ? (
                      txt.eventLabel(
                        chosen + 1,
                        f.events.length,
                        f.events[chosen].at === undefined
                          ? ""
                          : clock((f.events[chosen].at ?? from) - from),
                        f.events[chosen].tool,
                      )
                    ) : (
                      <Tags f={f} />
                    )}
                  </span>
                </div>
                {chosen >= 0 ? (
                  <EventDiff e={f.events[chosen]} f={f} />
                ) : (
                  <FileDiff f={f} onOpen={onOpen} />
                )}
              </div>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}

export function TurnChanges({
  files,
  start,
  end,
  interims = [],
  onOpen,
}: TurnChangesProps) {
  const [open, setOpen] = useState(false);
  const [timeline, setTimeline] = useState(false);
  const [rows, setRows] = useState<Record<string, boolean>>({});
  const body = useId();
  if (!files.length) return null;
  const one = files.length === 1 ? files[0] : undefined;
  const timed = files.some((f) => f.events.some((e) => e.at !== undefined));
  return (
    <section
      className="ah-turn-changes"
      data-testid="turn-changes"
      data-open={open || undefined}
      aria-label={txt.changes}
    >
      <div className="ah-tc-head">
        <button
          type="button"
          className="ah-tc-toggle"
          data-testid="turn-changes-toggle"
          aria-expanded={open}
          aria-controls={open ? body : undefined}
          aria-label={`${txt.showChanges}: ${one ? one.path : txt.files(files.length)}`}
          onClick={() => setOpen(!open)}
        >
          <span aria-hidden="true" className="ah-disclosure-chevron" />
          <Icon name="file" aria-hidden="true" />
          <span className="ah-tc-line">
            <span className="ah-tc-title">{txt.changes}</span>
            <span className="ah-tc-meta" data-testid="turn-changes-meta">
              {one ? (
                <FileName path={one.path} />
              ) : (
                <span>{txt.files(files.length)}</span>
              )}
              <CountsText c={totalCounts(files)} />
            </span>
          </span>
        </button>
        {timed ? (
          <button
            type="button"
            className="ah-tc-timeline-button"
            data-testid="turn-changes-timeline-toggle"
            aria-pressed={open && timeline}
            aria-label={txt.timelineLabel}
            onClick={() => {
              if (!open) {
                setOpen(true);
                setTimeline(true);
              } else setTimeline(!timeline);
            }}
          >
            <Icon name="clock" aria-hidden="true" />
            <span>{txt.timeline}</span>
          </button>
        ) : null}
      </div>
      {open ? (
        <div id={body} className="ah-tc-body">
          {timeline && timed ? (
            <Timeline
              files={files}
              start={start}
              end={end}
              interims={interims}
              onOpen={onOpen}
            />
          ) : (
            <ul className="ah-tc-list">
              {files.map((f) => {
                const expanded = !!rows[f.path];
                return (
                  <li key={f.path} data-path={f.path}>
                    <button
                      type="button"
                      className="ah-tc-file"
                      data-testid="turn-changes-file"
                      aria-expanded={expanded}
                      aria-label={txt.showDiff(f.path)}
                      onClick={() => setRows({ ...rows, [f.path]: !expanded })}
                    >
                      <span
                        aria-hidden="true"
                        className="ah-disclosure-chevron"
                      />
                      <FileName path={f.path} />
                      <Tags f={f} />
                      <CountsText c={f.counts} />
                    </button>
                    {expanded ? <FileDiff f={f} onOpen={onOpen} /> : null}
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
