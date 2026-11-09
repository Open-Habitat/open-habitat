import { useState } from "react";
import { bytes } from "../app/trashText";
import type {
  Worktree,
  WorktreeDisposal,
  WorktreeOwner,
} from "../app/workspaceWorktrees";
import { plainBlocker, worktreeName } from "../app/worktreeText";
import {
  currentLanguage,
  formatDate,
  localeOf,
  useLanguage,
  useText,
} from "../i18n";
import { worktreeAttentionText } from "../text/worktreeAttention";
import { worktreesText } from "../text/worktrees";
import { ControlButton, LinkRow } from "./ControlElements";
import { Icon } from "./Icon";
import { WorkerMark, type WorkerMarkKind } from "./WorkerMark";
import "./WorktreeAttention.css";

// A workspace page's worktrees, direction 1 Huomio of the worktree list
// prototype (Jari 8.11.2026): each row is named by what it is for the person
// from the Taskfleet run that owns it, only the rows that need the person
// are in view, and the rest is one line. Habitat stops, merges or cancels no
// run: an owned row leads to the conversation where its agent does that.

/** The conversation that started a worktree's run, from the person's list. */
export type OwnerConversation = {
  id: string;
  title: string;
  href: string;
  archived: boolean;
};

type Need = "you" | "self" | "working";
type Row = {
  w: Worktree;
  owner?: WorktreeOwner;
  conversation?: OwnerConversation;
  need: Need;
  label: string;
  mark: WorkerMarkKind;
  kind: "helper" | "worker" | "ended" | "none";
};

/** Which group a row belongs to, and its mark. An interactive worker whose
 * conversation is archived waits forever unless the person restores it; one
 * whose conversation is active is its agent's to decide. */
function rowOf(
  w: Worktree,
  conversation: (id: string) => OwnerConversation | undefined,
): Row {
  const owner = w.owner;
  const c = owner?.conversation_id
    ? conversation(owner.conversation_id)
    : undefined;
  const base = { w, owner, conversation: c };
  if (!owner)
    return {
      ...base,
      need: "you",
      label: worktreeName(w),
      mark: w.state === "merged" ? "merged" : "unmerged",
      kind: "none",
    };
  const label = worktreeName(w);
  const kind = owner.role;
  switch (owner.state) {
    case "ended":
      return {
        ...base,
        need: "you",
        label,
        kind,
        mark: w.state === "merged" ? "merged" : "unmerged",
      };
    case "working":
      return { ...base, need: "working", label, kind, mark: "working" };
    case "attention":
      return { ...base, need: "you", label, kind, mark: "unknown" };
    case "waiting":
      if (owner.role === "helper")
        return { ...base, need: "self", label, kind, mark: "waiting_parent" };
      return c?.archived
        ? { ...base, need: "you", label, kind, mark: "answer" }
        : { ...base, need: "self", label, kind, mark: "waiting_parent" };
  }
}

/** "tänään klo 23.23", "huomenna klo 7.05", or a date further away. */
function releaseWhen(
  at: Date,
  now: number,
  t: typeof worktreeAttentionText.fi,
) {
  const time = formatDate(at, { hour: "numeric", minute: "2-digit" });
  const day = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(day.getDate() + 1);
  if (at.toDateString() === day.toDateString()) return t.today(time);
  if (at.toDateString() === tomorrow.toDateString()) return t.tomorrow(time);
  return t.on(
    formatDate(at, {
      weekday: "short",
      day: "numeric",
      month: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  );
}

const names = (rows: Row[]) =>
  new Intl.ListFormat(localeOf(currentLanguage()), {
    type: "conjunction",
  }).format(rows.map((r) => r.label));

export function WorktreeAttention({
  worktrees,
  conversation,
  now,
  busy,
  onAction,
  onOpen,
}: {
  worktrees: Worktree[];
  conversation: (id: string) => OwnerConversation | undefined;
  /** The clock a helper's release time is read against. */
  now: number;
  /** Key (workspace_id/entry) of the worktree being removed; "*" for all. */
  busy?: string;
  onAction: (worktree: Worktree, disposal: WorktreeDisposal) => void;
  /** Restores an archived conversation, then opens it. */
  onOpen?: (conversation: OwnerConversation) => void;
}) {
  useLanguage();
  const t = useText(worktreeAttentionText);
  const rows = worktrees.map((w) => rowOf(w, conversation));
  const you = rows.filter((r) => r.need === "you");
  const rest = rows.filter((r) => r.need !== "you");
  const [more, setMore] = useState(false);
  // Only a helper whose worktree is merged releases it by itself; one with
  // unlanded work waits for its agent like a waiting worker.
  const releases = (r: Row) =>
    r.owner?.role === "helper" && !!r.owner.releases_at;
  const releasing = rest.filter((r) => r.need === "self" && releases(r));
  const waiting = rest.filter((r) => r.need === "self" && !releases(r));
  const working = rest.filter((r) => r.need === "working");
  const restLine = [
    releasing.length ? t.restRelease(names(releasing), releasing.length) : "",
    waiting.length ? t.restWaiting(names(waiting), waiting.length) : "",
    working.length ? t.restWorking(names(working), working.length) : "",
  ]
    .filter(Boolean)
    .join(", ");
  const line = (r: Row, quiet: boolean) => (
    <AttentionRow
      key={`${r.w.workspace_id}/${r.w.entry}`}
      row={r}
      quiet={quiet}
      now={now}
      busy={busy}
      onAction={onAction}
      onOpen={onOpen}
    />
  );
  return (
    <>
      {you.length ? (
        <ul className="ah-wt-list" data-testid="worktree-attention">
          {you.map((r) => line(r, false))}
        </ul>
      ) : (
        <p className="ah-wt-empty" data-testid="worktree-attention-empty">
          <Icon name="check" /> {t.nothing}
        </p>
      )}
      {rest.length ? (
        <div className="ah-wt-rest">
          <button
            type="button"
            className="ah-wt-rest-toggle"
            aria-expanded={more}
            data-testid="worktree-rest"
            onClick={() => setMore(!more)}
          >
            <span className="ah-wt-chev" aria-hidden="true" />
            <span>
              <b>{t.rest(rest.length)}</b>
              {restLine ? ` · ${restLine}` : ""}
            </span>
          </button>
          {more ? (
            <ul className="ah-wt-list" data-testid="worktree-rest-list">
              {rest.map((r) => line(r, true))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function AttentionRow({
  row: r,
  quiet,
  now,
  busy,
  onAction,
  onOpen,
}: {
  row: Row;
  quiet: boolean;
  now: number;
  busy?: string;
  onAction: (worktree: Worktree, disposal: WorktreeDisposal) => void;
  onOpen?: (conversation: OwnerConversation) => void;
}) {
  const t = useText(worktreeAttentionText);
  const wt = useText(worktreesText);
  const [git, setGit] = useState(false);
  const { w, owner, conversation: c } = r;
  const key = `${w.workspace_id}/${w.entry}`;
  const releaseAt = owner?.releases_at ? new Date(owner.releases_at) : null;
  const gitSentence =
    w.state === "merged"
      ? t.merged
      : w.state === "dirty"
        ? t.dirty
        : w.state === "missing"
          ? t.missing
          : w.state === "unmerged" && w.ahead
            ? t.ahead(w.ahead)
            : "";
  const keeper = (() => {
    const archived = c?.archived ? t.archivedNobody : "";
    if (!owner) return t.none + gitSentence;
    switch (owner.state) {
      case "ended":
        return t.ended + gitSentence;
      case "working":
        return owner.role === "helper" ? t.helperWorking : t.workerWorking;
      case "attention":
        return (
          (owner.role === "helper" ? t.helperAttention : t.workerAttention) +
          archived
        );
      case "waiting":
        return owner.role === "helper"
          ? t.helperWaiting + (releaseAt ? t.helperLanded : "")
          : t.workerWaiting + archived;
    }
  })();
  // Habitat leads to the conversation; it removes only what nobody keeps.
  const owned = owner && owner.state !== "ended";
  const action =
    owned && r.need === "you" && c && onOpen ? (
      <ControlButton
        data-testid={
          c.archived
            ? "worktree-restore-conversation"
            : "worktree-open-conversation"
        }
        size="row"
        variant="secondary"
        isDisabled={!!busy}
        onPress={() => onOpen(c)}
      >
        {c.archived ? t.restore : t.open}
      </ControlButton>
    ) : !owned ? (
      w.actions.map((a) => (
        <ControlButton
          data-testid={`worktree-${a}`}
          key={a}
          variant={a === "force" ? "danger-subtle" : "secondary"}
          size="row"
          isDisabled={!!busy}
          isPending={busy === key}
          aria-label={`${wt.action[a].replace("…", "")} ${r.label}${a === "prune" ? "" : "…"}`}
          onPress={() => onAction(w, a)}
        >
          {wt.action[a]}
        </ControlButton>
      ))
    ) : null;
  // Blockers other than the owning run itself still say why nothing can be
  // removed (a process in the directory, an unread check).
  const why = w.blockers
    .filter((b) => b.kind !== "taskfleet_run")
    .map(plainBlocker)
    .join(" ");
  return (
    <li
      className={`ah-wt-row${quiet ? " quiet" : ""}`}
      data-testid={`worktree-row-${w.name}`}
      data-need={r.need}
      data-state={w.state}
      data-blocked={w.blockers.length > 0}
    >
      <div className="ah-wt-main">
        <span className="ah-wt-who">
          <span className="ah-wt-mark">
            <WorkerMark kind={r.mark} />
          </span>
          <span className="ah-wt-lines">
            <span className="ah-wt-name">
              <b>{r.label}</b>
              <span className="ah-wt-kind">{t.kind[r.kind]}</span>
            </span>
            {c ? (
              <span className="ah-wt-from">
                {t.from(
                  <LinkRow
                    kind="inline"
                    href={c.href}
                    data-testid="worktree-conversation"
                  >
                    {c.title}
                  </LinkRow>,
                  <span className={`ah-wt-tag${c.archived ? "" : " live"}`}>
                    {c.archived ? t.archived : t.active}
                  </span>,
                )}
              </span>
            ) : null}
          </span>
        </span>
        <p className="ah-wt-keeper">
          {keeper}
          {releaseAt ? (
            <>
              {" "}
              <b data-testid="worktree-releases">
                {releaseAt.getTime() <= now
                  ? t.releasesSoon
                  : t.releases(releaseWhen(releaseAt, now, t))}
              </b>
            </>
          ) : null}
        </p>
        {w.state === "locked" ? (
          <p className="ah-wt-keeper">
            {wt.locked}
            {w.locked_reason ? (
              <>
                : <q>{w.locked_reason}</q>
              </>
            ) : null}
            {wt.lockedEnd}
          </p>
        ) : null}
        {why ? <p className="ah-wt-keeper ah-wt-why">{why}</p> : null}
        <button
          type="button"
          className="ah-wt-disclose"
          aria-expanded={git}
          data-testid="worktree-git-toggle"
          onClick={() => setGit(!git)}
        >
          <Icon name="branch" /> {t.gitFacts}
        </button>
        {git ? (
          <dl className="ah-wt-git" data-testid="worktree-git">
            {w.path ? (
              <>
                <dt>{t.directory}</dt>
                <dd>
                  <code>{w.path}</code>
                </dd>
              </>
            ) : null}
            {w.branch ? (
              <>
                <dt>{t.branch}</dt>
                <dd>
                  <code>{w.branch}</code>
                  {w.base ? (
                    <>
                      {" → "}
                      <code>{w.base}</code>
                      {" · "}
                      {w.ahead
                        ? t.aheadOf(w.ahead, w.base)
                        : w.state === "merged"
                          ? t.mergedInto
                          : wt.state[w.state]}
                    </>
                  ) : null}
                </dd>
              </>
            ) : null}
            {w.size_bytes !== undefined ? (
              <>
                <dt>{t.size}</dt>
                <dd>
                  {w.size_complete ? "" : wt.over}
                  {bytes(w.size_bytes)}
                </dd>
              </>
            ) : null}
            {owner ? (
              <>
                <dt>{t.run}</dt>
                <dd>
                  <code>{owner.run_id}</code>
                </dd>
              </>
            ) : null}
          </dl>
        ) : null}
      </div>
      {action ? <span className="ah-wt-actions">{action}</span> : null}
    </li>
  );
}

/** The section's count and the disk its worktrees take. */
export function worktreeTotal(worktrees: Worktree[]) {
  return bytes(worktrees.reduce((n, w) => n + (w.size_bytes ?? 0), 0));
}
