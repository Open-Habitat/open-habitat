import { type ReactNode, useState } from "react";
import { liveHelper, type Spinoff } from "../app/spinoffs";
import { formatDate, useLanguage, useText } from "../i18n";
import { conversationArchiveText } from "../text/conversationArchive";
import { ControlButton, LinkRow } from "./ControlElements";
import { Icon } from "./Icon";
import { Button, TextField } from "./Primitives";
import { WorkerMark, type WorkerMarkKind } from "./WorkerMark";
import "./ConversationArchive.css";

type Text = (typeof conversationArchiveText)["fi"];

/** What a conversation left behind, as a mark and two words. */
export type ArchiveTrace = {
  key: string;
  mark: WorkerMarkKind;
  short: string;
  detail: string;
  /** Work that still waits for someone. */
  attention: boolean;
};

export type ArchiveRow = {
  id: string;
  title: string;
  href: string;
  archivedAt?: string;
  /** Said beside the title when the conversation's history cannot be read. */
  note?: string;
  traces: ArchiveTrace[];
  /** Why the row's restore cannot be pressed now. */
  restoreReason?: string;
};

const dayStart = (t: number) => new Date(t).setHours(0, 0, 0, 0);
function daysAgo(at: number, now: number) {
  return Math.round((dayStart(now) - dayStart(at)) / 86400000);
}

type Group = keyof Text["groups"];
/** Today, yesterday, the six days before, and older; undated rows last. */
export function archiveGroup(at: string | undefined, now: number): Group {
  const t = at ? Date.parse(at) : Number.NaN;
  if (Number.isNaN(t)) return "older";
  const n = daysAgo(t, now);
  return n <= 0 ? "today" : n === 1 ? "yesterday" : n < 7 ? "week" : "older";
}

/** The row's short date: a time today and yesterday, a weekday this week,
 * the day before that, with the year once it is another year. */
export function archiveWhen(at: string | undefined, now: number, t: Text) {
  const time = at ? Date.parse(at) : Number.NaN;
  if (Number.isNaN(time)) return "";
  const clock = formatDate(time, { hour: "numeric", minute: "2-digit" });
  const n = daysAgo(time, now);
  if (n <= 0) return t.today(clock);
  if (n === 1) return t.yesterday(clock);
  if (n < 7)
    return formatDate(time, {
      weekday: "short",
      day: "numeric",
      month: "numeric",
    });
  return formatDate(time, {
    day: "numeric",
    month: "numeric",
    year:
      new Date(time).getFullYear() === new Date(now).getFullYear()
        ? undefined
        : "numeric",
  });
}

/** Newest archived first; a row without a known time sinks to the end. */
export function byArchivedAt(a: { archivedAt?: string }, b: typeof a) {
  const ta = a.archivedAt ? Date.parse(a.archivedAt) : Number.NaN;
  const tb = b.archivedAt ? Date.parse(b.archivedAt) : Number.NaN;
  if (Number.isNaN(ta) || Number.isNaN(tb))
    return Number.isNaN(ta) ? (Number.isNaN(tb) ? 0 : 1) : -1;
  return tb - ta;
}

/** A conversation's helpers and workers as row marks: each helper by name,
 * workers counted by how they ended. The exact state and the branch are
 * where the conversation is read. */
export function archiveTraces(runs: Spinoff[], helpers: boolean, t: Text) {
  const out: ArchiveTrace[] = [];
  for (const run of runs) {
    const r = run.resident;
    // An ended helper's run is counted with the workers below.
    if (!r || !helpers || !liveHelper(run)) continue;
    const working = r.round_state === "working";
    const unknown = run.state === "unknown";
    const open = working || !!r.unlanded || r.rounds > (r.landed_round ?? 0);
    out.push({
      key: `helper:${run.run_id}`,
      mark: unknown ? "unknown" : working ? "working" : "waiting_parent",
      short: t.traces.helper(r.name),
      detail: unknown
        ? t.traces.helperUnknown(r.name)
        : working
          ? t.traces.helperWorking(r.name)
          : open
            ? t.traces.helperOpen(r.name)
            : t.traces.helperLanded(r.name),
      attention: open || unknown,
    });
  }
  const kinds = [
    ["unmerged", ["unmerged"], true],
    ["failed", ["failed"], true],
    ["working", ["working", "idle", "waiting_parent"], false],
    ["merged", ["merged"], false],
  ] as const;
  for (const [kind, states, attention] of kinds) {
    const these = runs.filter(
      (run) =>
        !liveHelper(run) && (states as readonly string[]).includes(run.state),
    );
    if (!these.length) continue;
    out.push({
      key: `workers:${kind}`,
      mark: kind,
      short: t.traces[kind](these.length),
      detail: these.map((run) => run.title).join(" · "),
      attention,
    });
  }
  return out;
}

export function ArchiveTraces({ traces }: { traces: ArchiveTrace[] }) {
  if (!traces.length) return null;
  return (
    <span className="ah-archive-traces" data-testid="archive-traces">
      {traces.map((x) => (
        <span
          key={x.key}
          className="ah-archive-trace"
          data-attention={x.attention || undefined}
          title={x.detail}
        >
          <WorkerMark kind={x.mark} />
          <span>{x.short}</span>
        </span>
      ))}
    </span>
  );
}

/** The workspace's archived conversations, grouped by when each was
 * archived and filterable by title. The title opens the conversation to
 * read; the quiet icon brings it back among the open ones. */
export function ConversationArchiveList({
  rows,
  count,
  now,
  onRestore,
  children,
}: {
  rows: ArchiveRow[];
  /** The heading's count; "?" while the archive cannot be read. */
  count: number | string;
  now: number;
  onRestore: (row: ArchiveRow) => void;
  /** Notices above the list: an incomplete read, a restore's outcome. */
  children?: ReactNode;
}) {
  const t = useText(conversationArchiveText);
  const language = useLanguage();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase(language);
  const shown = [...rows]
    .filter((r) => r.title.toLocaleLowerCase(language).includes(needle))
    .sort(byArchivedAt);
  const groups: [Group, ArchiveRow[]][] = [];
  for (const row of shown) {
    const g = archiveGroup(row.archivedAt, now);
    const last = groups[groups.length - 1];
    if (last && last[0] === g) last[1].push(row);
    else groups.push([g, [row]]);
  }
  return (
    <section
      className="ah-archive"
      data-testid="workspace-archive-panel"
      aria-labelledby="ah-archive-heading"
    >
      <div className="ah-archive-head">
        <h2 id="ah-archive-heading" data-testid="archive-title">
          {t.heading} <span>{count}</span>
        </h2>
        {rows.length ? (
          <div className="ah-archive-filter">
            <TextField
              data-testid="archive-filter"
              label={t.filter}
              value={query}
              onChange={setQuery}
            />
          </div>
        ) : null}
      </div>
      {children}
      {rows.length && !shown.length ? (
        <p className="ah-archive-empty" data-testid="archive-no-match">
          {t.noMatch(query.trim())}
        </p>
      ) : null}
      {groups.map(([g, list]) => (
        <div key={g} className="ah-archive-group" data-testid="archive-group">
          <h3>{t.groups[g]}</h3>
          <ul>
            {list.map((row) => (
              <li
                key={row.id}
                className="ah-archive-row"
                data-testid="archive-row"
              >
                <span className="ah-archive-row-main">
                  <LinkRow
                    href={row.href}
                    kind="inline"
                    className="ah-archive-row-open"
                    data-testid="archive-row-open"
                  >
                    {row.title}
                  </LinkRow>
                  {row.note ? (
                    <span className="ah-archive-row-note">{row.note}</span>
                  ) : null}
                  <ArchiveTraces traces={row.traces} />
                </span>
                {row.archivedAt ? (
                  <time
                    className="ah-archive-row-date"
                    dateTime={row.archivedAt}
                  >
                    {archiveWhen(row.archivedAt, now, t)}
                  </time>
                ) : (
                  <span className="ah-archive-row-date" />
                )}
                <ControlButton
                  data-testid="restore-conversation"
                  size="inline"
                  variant="quiet"
                  presentation="icon"
                  className="ah-archive-row-restore"
                  aria-label={t.restore(row.title)}
                  title={row.restoreReason || t.restore(row.title)}
                  aria-description={row.restoreReason || undefined}
                  isDisabled={Boolean(row.restoreReason)}
                  onPress={() => onRestore(row)}
                >
                  <Icon name="restore" />
                </ControlButton>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** An archived conversation's foot, in its composer's place: when it was
 * archived, what it left behind, and the one action that continues it. */
export function ArchivedFoot({
  archivedAt,
  restoreReason,
  onRestore,
  children,
}: {
  archivedAt?: string;
  restoreReason?: string;
  onRestore: () => void;
  /** The conversation's helpers, as their own rows. */
  children?: ReactNode;
}) {
  const t = useText(conversationArchiveText);
  useLanguage();
  const at = archivedAt ? Date.parse(archivedAt) : Number.NaN;
  return (
    <footer className="ah-archived-foot" data-testid="archived-foot">
      <p>
        <Icon name="archive" />{" "}
        <span>
          {Number.isNaN(at)
            ? t.foot.archivedUndated
            : t.foot.archived(
                formatDate(at, {
                  weekday: "short",
                  day: "numeric",
                  month: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }),
              )}
        </span>
      </p>
      {children ? (
        <div className="ah-archived-foot-traces">{children}</div>
      ) : null}
      <Button
        data-testid="archived-foot-restore"
        size="row"
        variant="primary"
        label={t.foot.restore}
        onPress={onRestore}
        availability={
          restoreReason
            ? { state: "disabled", reason: restoreReason }
            : { state: "enabled" }
        }
      />
    </footer>
  );
}
