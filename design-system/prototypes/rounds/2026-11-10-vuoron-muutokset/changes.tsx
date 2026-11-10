import { Fragment, useState } from "react";
import { ControlButton, IconButton } from "../../../../web/src/components/ControlElements";
import { FileToolCard } from "../../../../web/src/components/FileToolCard";
import { Icon } from "../../../../web/src/components/Icon";
import type { Text } from "./text";
import { counts, eventCounts, type FileChange, type FileEvent, firstLine, lineCount, type Turn, unified } from "./turn";

// The three directions' pieces. Every diff is production's FileToolCard: one
// edit as Pi's edit arguments, exactly as its tool card shows it, and the
// turn's net change as the native unified diff the card already reads.

export type Shared = {
  t: Text;
  files: FileChange[];
  running: boolean;
  /** null where production offers no editor (a phone). */
  onOpen: ((path: string, line?: number) => void) | null;
};

/** Files in the order the turn first changed them. */
export const ordered = (files: FileChange[]) => [...files].sort((a, b) => a.events[0].at - b.events[0].at);

const total = (files: FileChange[]) =>
  files.reduce((s, f) => {
    const c = counts(f);
    return c ? { add: s.add + c.add, del: s.del + c.del } : s;
  }, { add: 0, del: 0 });

export function Counts({ c }: { c?: { add: number; del: number } }) {
  if (!c) return null;
  return (
    <span className="vm-counts">
      {c.add ? <span className="vm-add">+{c.add}</span> : null}
      {c.del ? <span className="vm-del">−{c.del}</span> : null}
    </span>
  );
}

export function FileName({ path }: { path: string }) {
  const cut = path.lastIndexOf("/") + 1;
  return (
    <span className="vm-path" title={path}>
      {cut ? <span className="vm-dir">{path.slice(0, cut)}</span> : null}
      <span className="vm-base">{path.slice(cut)}</span>
    </span>
  );
}

const byCommand = (f: FileChange) => f.events.find((e) => e.tool === "bash");

export function Tags({ f, t, edits = true }: { f: FileChange; t: Text; edits?: boolean }) {
  return (
    <span className="vm-tags">
      {f.change === "created" ? <span className="vm-tag" data-tag="created">{t.created}</span> : null}
      {f.change === "deleted" ? <span className="vm-tag" data-tag="deleted">{t.deleted}</span> : null}
      {f.binary ? <span className="vm-tag">{t.binary}</span> : null}
      {byCommand(f) ? <span className="vm-tag" data-tag="command">{t.byCommand}</span> : null}
      {edits && f.events.length > 1 ? <span className="vm-tag-plain" data-testid="edit-count">{t.edits(f.events.length)}</span> : null}
    </span>
  );
}

function CommandNote({ e, t }: { e: FileEvent; t: Text }) {
  return (
    <p className="vm-note" data-testid="command-note">
      <Icon name="terminal" aria-hidden="true" />
      <span>
        {t.commandNote} <code>{e.command}</code>. {t.commandSource}
      </span>
    </p>
  );
}

function OpenButton({ f, s }: { f: FileChange; s: Shared }) {
  if (!s.onOpen || f.change === "deleted" || f.binary) return null;
  const line = firstLine(f);
  return (
    <ControlButton data-testid="open-editor" size="inline" variant="secondary" onPress={() => s.onOpen?.(f.path, line)}>
      <Icon name="editor" aria-hidden="true" />
      {line ? s.t.openEditorAt(line) : s.t.openEditor}
    </ControlButton>
  );
}

/** The turn's net change to one file. */
export function FileDiff({ f, s }: { f: FileChange; s: Shared }) {
  const command = byCommand(f);
  const args = JSON.stringify({ path: f.path });
  return (
    <div className="vm-diff" data-testid="file-diff">
      {command ? <CommandNote e={command} t={s.t} /> : null}
      {f.binary ? (
        <p className="vm-note" data-testid="binary-note">
          <Icon name="file" aria-hidden="true" />
          <span>{s.t.binaryNote(s.t.bytes(f.binary.bytes))}</span>
        </p>
      ) : f.change === "created" ? (
        <FileToolCard name="write" argumentsText={JSON.stringify({ path: f.path, content: f.after })} />
      ) : (
        <>
          {f.change === "deleted" ? <p className="vm-note">{s.t.deletedNote(lineCount(f.before ?? ""))}</p> : null}
          <FileToolCard name="edit" argumentsText={args} output={unified(f.path, f.before, f.after)} />
        </>
      )}
      <div className="vm-diff-actions">
        <OpenButton f={f} s={s} />
      </div>
    </div>
  );
}

/** One event as its tool card showed it. */
function EventDiff({ e, f, s }: { e: FileEvent; f: FileChange; s: Shared }) {
  if (e.edits) return <FileToolCard name="edit" argumentsText={JSON.stringify({ path: f.path, edits: e.edits })} />;
  if (e.content !== undefined) return <FileToolCard name="write" argumentsText={JSON.stringify({ path: f.path, content: e.content })} />;
  return <FileDiff f={f} s={{ ...s, onOpen: null }} />;
}

function Head({ s, title }: { s: Shared; title: string }) {
  return (
    <>
      <Icon name="file" aria-hidden="true" />
      <span className="vm-head-title">{s.running ? `${title} · ${s.t.soFar.toLowerCase()}` : title}</span>
      <span className="vm-head-meta">
        {s.t.files(s.files.length)} <Counts c={total(s.files)} />
      </span>
    </>
  );
}

// ---------- 1 Yhteenveto: a compact list under the reply ----------

export function Summary({ s, initial }: { s: Shared; initial?: string }) {
  const [open, setOpen] = useState<Record<string, boolean>>(initial ? { [initial]: true } : {});
  const files = ordered(s.files);
  if (!files.length) return null;
  return (
    <section className="vm-card vm-summary" data-testid="turn-changes" aria-label={s.t.changes}>
      <h3 className="vm-head">
        <Head s={s} title={s.t.changes} />
      </h3>
      {s.running ? <p className="vm-running">{s.t.running}</p> : null}
      <ul className="vm-list">
        {files.map((f) => {
          const expanded = !!open[f.path];
          return (
            <li key={f.path} data-path={f.path}>
              <button
                type="button"
                className="vm-row"
                data-testid="change-row"
                aria-expanded={expanded}
                aria-label={s.t.showDiff(f.path)}
                onClick={() => setOpen({ ...open, [f.path]: !expanded })}
              >
                <span aria-hidden="true" className="ah-disclosure-chevron" />
                <FileName path={f.path} />
                <Tags f={f} t={s.t} />
                <Counts c={counts(f)} />
              </button>
              {expanded ? <FileDiff f={f} s={s} /> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------- 2 Katselmointi: a panel beside the conversation ----------

export function ReviewLink({ s, onOpen, open }: { s: Shared; onOpen: () => void; open: boolean }) {
  if (!s.files.length) return null;
  return (
    <div className="vm-review-link">
      <ControlButton data-testid="review-open" size="inline" variant="secondary" aria-expanded={open} onPress={onOpen}>
        <Icon name="file" aria-hidden="true" />
        {s.t.reviewOpen(s.files.length)}
        <Counts c={total(s.files)} />
      </ControlButton>
    </div>
  );
}

export function ReviewPanel({ s, selected, onSelect, onClose, phone }: { s: Shared; selected: string; onSelect: (path: string) => void; onClose: () => void; phone: boolean }) {
  const files = ordered(s.files);
  const index = Math.max(0, files.findIndex((f) => f.path === selected));
  const f = files[index];
  if (!f) return null;
  return (
    <aside className="vm-panel" data-testid="review-panel" aria-label={s.t.review}>
      <header className="vm-panel-head">
        {phone ? (
          <ControlButton size="inline" variant="quiet" onPress={onClose} data-testid="review-close">
            <Icon name="back" aria-hidden="true" />
            {s.t.backToConversation}
          </ControlButton>
        ) : null}
        <h2 className="vm-head">
          <Head s={s} title={s.t.review} />
        </h2>
        {!phone ? (
          <IconButton size="inline" variant="quiet" aria-label={s.t.close} onPress={onClose} data-testid="review-close">
            <Icon name="cross" />
          </IconButton>
        ) : null}
      </header>
      {s.running ? <p className="vm-running">{s.t.running}</p> : null}
      <ul className="vm-panel-files">
        {files.map((x) => (
          <li key={x.path}>
            <button type="button" className="vm-file" data-testid="review-file" aria-current={x === f ? "true" : undefined} onClick={() => onSelect(x.path)}>
              <FileName path={x.path} />
              <Tags f={x} t={s.t} edits={false} />
              <Counts c={counts(x)} />
            </button>
          </li>
        ))}
      </ul>
      <div className="vm-panel-file">
        <div className="vm-panel-file-head">
          <FileName path={f.path} />
          <Tags f={f} t={s.t} />
          <span className="vm-panel-nav">
            <IconButton size="inline" variant="quiet" aria-label={s.t.prev} isDisabled={index === 0} onPress={() => onSelect(files[index - 1].path)} data-testid="review-prev">
              <Icon name="up" />
            </IconButton>
            <span className="vm-pos" data-testid="review-position">{s.t.position(index + 1, files.length)}</span>
            <IconButton size="inline" variant="quiet" aria-label={s.t.next} isDisabled={index === files.length - 1} onPress={() => onSelect(files[index + 1].path)} data-testid="review-next">
              <Icon name="down" />
            </IconButton>
          </span>
        </div>
        <FileDiff key={f.path} f={f} s={s} />
      </div>
    </aside>
  );
}

// ---------- 3 Aikajana: each file's edits on the turn's clock ----------

const clock = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function Timeline({ s, turn, now, initial }: { s: Shared; turn: Turn; now: number; initial?: [string, number] }) {
  const files = ordered(s.files);
  const [pick, setPick] = useState<[string, number] | undefined>(initial);
  const end = turn.steps.at(-1)?.at ?? now;
  // A running turn's end is not known: the scale is what has passed, with room.
  const span = s.running ? Math.max(now * 1.15, 1) : end;
  const pos = (at: number) => `${Math.min(100, (at / span) * 100)}%`;
  const interims = turn.steps.filter((x) => x.kind === "text" && x !== turn.steps.at(-1) && x.at <= now);
  const stages = [0, ...interims.map((x) => x.at), s.running ? now : end];
  if (!files.length) return null;
  return (
    <section className="vm-card vm-timeline" data-testid="turn-changes" aria-label={s.t.timeline}>
      <h3 className="vm-head">
        <Head s={s} title={s.t.timeline} />
      </h3>
      {s.running ? <p className="vm-running">{s.t.running}</p> : null}
      <div className="vm-tl-grid">
        <div className="vm-tl-axis" aria-hidden="true">
          <span />
          <div className="vm-tl-track vm-tl-scale">
            {stages.slice(0, -1).map((from, i) => (
              <span key={from} className="vm-tl-stage" style={{ left: pos(from), width: `calc(${pos(stages[i + 1])} - ${pos(from)})` }}>
                {s.t.stage(i + 1)}
              </span>
            ))}
            <span className="vm-tl-tick" style={{ left: 0 }}>0:00</span>
            <span className="vm-tl-tick vm-tl-tick-end" style={{ left: pos(s.running ? now : end) }}>
              {s.running ? `${s.t.now} ${clock(now)}` : clock(end)}
            </span>
          </div>
        </div>
        {files.map((f) => {
          const chosen = pick?.[0] === f.path ? pick[1] : undefined;
          return (
            <Fragment key={f.path}>
              <div className="vm-tl-row" data-path={f.path} data-testid="timeline-row">
                <button type="button" className="vm-tl-name" aria-pressed={chosen === -1} aria-label={s.t.finalOf(f.path)} onClick={() => setPick(chosen === -1 ? undefined : [f.path, -1])}>
                  <FileName path={f.path} />
                  <Counts c={counts(f)} />
                </button>
                <div className="vm-tl-track">
                  {interims.map((x) => (
                    <span key={x.key} className="vm-tl-interim" style={{ left: pos(x.at) }} aria-hidden="true" />
                  ))}
                  {s.running ? <span className="vm-tl-now" style={{ left: pos(now) }} aria-hidden="true" /> : null}
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
                      onClick={() => setPick(chosen === i ? undefined : [f.path, i])}
                    />
                  ))}
                </div>
              </div>
              {chosen !== undefined ? (
                <div className="vm-tl-detail" data-testid="timeline-detail">
                  <div className="vm-tl-detail-head">
                    <span className="vm-tl-segment" role="group">
                      {f.events.map((e, i) => (
                        <button type="button" key={e.step} aria-pressed={chosen === i} onClick={() => setPick([f.path, i])} data-testid="timeline-step">
                          {clock(e.at)}
                          <Counts c={eventCounts(e, f)} />
                        </button>
                      ))}
                      <button type="button" aria-pressed={chosen === -1} onClick={() => setPick([f.path, -1])} data-testid="timeline-final">
                        {s.t.final}
                        <Counts c={counts(f)} />
                      </button>
                    </span>
                    <span className="vm-tl-what">
                      {chosen >= 0 ? s.t.eventLabel(chosen + 1, f.events.length, clock(f.events[chosen].at), f.events[chosen].tool) : <Tags f={f} t={s.t} />}
                    </span>
                  </div>
                  {chosen >= 0 ? <EventDiff e={f.events[chosen]} f={f} s={s} /> : <FileDiff f={f} s={s} />}
                </div>
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}
