import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
  Popover,
} from "react-aria-components";
import { formatDate, liveText } from "../i18n";
import { gitStatusText } from "../text/gitStatus";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import "./GitStatus.css";

// Git status of the conversation's workspace (Yläpalkissa, Jari 18.10.2026,
// issue implement-git-status-topbar): a chip in the top bar beside the model,
// anchored details on desktop and a bottom sheet on a phone.

export type GitCommit = { hash: string; subject: string; timestamp: number };
export type GitBase = {
  name: string;
  ref: string;
  source: "recorded" | "origin_head" | "local";
  ahead: number;
  behind: number;
  merged: boolean;
};
export type GitFile = {
  status: string;
  path: string;
  previous_path?: string;
  added?: number;
  deleted?: number;
};
/** What the chip needs; the snapshot's git_summary has exactly this. */
export type GitSummaryFacts = {
  branch: string;
  dirty_count: number;
  upstream?: string;
  ahead?: number;
  behind?: number;
  base?: GitBase;
};
/** The details: the workspace Git observation read on demand. */
export type GitDetailFacts = GitSummaryFacts & {
  files: GitFile[];
  files_truncated: boolean;
  commits: (GitCommit & { pushed?: boolean })[];
  commits_available: boolean;
  fetched_at?: number;
  unpushed_commits?: GitCommit[];
  incoming_commits?: GitCommit[];
  base_ahead_commits?: GitCommit[];
  base_behind_commits?: GitCommit[];
};

const txt = liveText(gitStatusText);

/** The arrows the chip shows: against the upstream, or against the base
 * branch when there is no upstream (a fresh worktree branch). */
export function gitArrows(f: GitSummaryFacts) {
  if (f.upstream && f.ahead !== undefined && f.behind !== undefined)
    return { up: f.ahead, down: f.behind, against: f.upstream, base: false };
  if (f.base)
    return {
      up: f.base.ahead,
      down: f.base.behind,
      against: f.base.ref,
      base: true,
    };
  return undefined;
}

/** The chip's accessible name says in words what the marks say. */
export function gitSentence(f: GitSummaryFacts, inner = false): string {
  const parts = [inner ? txt.branchLower(f.branch) : txt.branch(f.branch)];
  if (f.upstream)
    parts.push(
      f.ahead !== undefined && f.behind !== undefined
        ? txt.upstream(f.ahead, f.behind, f.upstream)
        : txt.upstreamUnknown(f.upstream),
    );
  if (f.base)
    parts.push(
      f.base.merged
        ? txt.baseMerged(f.base.name, f.base.behind)
        : txt.baseCounts(f.base.ahead, f.base.behind, f.base.name),
    );
  parts.push(txt.changedFiles(f.dirty_count));
  return `${parts.join(", ")}.`;
}

/** The chip's counts: only the ones that are not zero (round 2 of
 * proto-conversation-header); the sentence and the layer give all of them. */
function Arrows({
  up,
  down,
  title,
}: {
  up: number;
  down: number;
  title: [string, string];
}) {
  if (!up && !down) return null;
  return (
    <span className="ah-gs-ab">
      {up ? (
        <span className="ah-gs-n" title={title[0]}>
          <Icon name="arrowUp" />
          {up}
        </span>
      ) : null}
      {down ? (
        <span className="ah-gs-n" title={title[1]}>
          <Icon name="arrowDown" />
          {down}
        </span>
      ) : null}
    </span>
  );
}

/** Phone widths take details as a bottom sheet rather than an anchored layer. */
export function usePhone() {
  const [phone, setPhone] = useState(
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 700px)").matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 700px)");
    const update = () => setPhone(media.matches);
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }, []);
  return phone;
}

/** The top-bar chip and its layer. The caller owns the facts and reads. */
export function GitStatusChip({
  facts,
  open,
  onOpenChange,
  worktree,
  children,
}: {
  facts: GitSummaryFacts;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The conversation runs in a worktree agent's own worktree; merged says
   * its work is in the base branch (ADR 0025). */
  worktree?: { merged: boolean };
  children: ReactNode;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const phone = usePhone();
  const arrows = gitArrows(facts);
  const merged = !!worktree?.merged && !!facts.base;
  const sentence = `${worktree ? txt.worktreeOf : ""}${
    merged && facts.base
      ? txt.worktreeMerged(facts.branch, facts.base.name)
      : worktree
        ? // A fresh branch is also "in the base"; until its work is merged
          // the chip counts commits instead of saying so.
          gitSentence(
            {
              ...facts,
              base: facts.base && { ...facts.base, merged: false },
            },
            true,
          )
        : gitSentence(facts)
  }`;
  // What the header's ⋯ menu shows when the counts no longer fit beside
  // the title: "main ↑3 ●2".
  const summary = [
    facts.branch,
    merged ? txt.merged : "",
    !merged && arrows?.up ? `↑${arrows.up}` : "",
    !merged && arrows?.down ? `↓${arrows.down}` : "",
    !merged && facts.dirty_count ? `●${facts.dirty_count}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const content = (
    <Dialog
      data-testid="git-dialog"
      className="ah-dialog ah-gs-dialog"
      aria-label={txt.dialog}
    >
      {children}
    </Dialog>
  );
  return (
    <DialogTrigger
      isOpen={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value)
          queueMicrotask(() => {
            const phoneTrigger = trigger.current
              ?.closest("header")
              ?.querySelector<HTMLElement>(".ah-phone-facts");
            if (phoneTrigger?.getClientRects().length) phoneTrigger.focus();
            else trigger.current?.focus();
          });
      }}
    >
      <ControlButton
        data-testid="git-chip"
        data-merged={merged}
        data-branch={facts.branch}
        data-base-ahead={facts.base?.ahead}
        data-base-behind={facts.base?.behind}
        data-upstream-ahead={facts.ahead}
        data-upstream-behind={facts.behind}
        data-changes={facts.dirty_count}
        size="inline"
        presentation="pill"
        ref={trigger}
        className={`ah-gs-chip${worktree ? " ah-gs-worktree" : ""}${merged ? " merged" : ""}`}
        aria-label={txt.chipLabel(sentence)}
        data-menu-summary={summary}
        data-phone-summary={[
          merged ? txt.merged : "",
          !merged && arrows?.up ? `↑${arrows.up}` : "",
          !merged && facts.dirty_count ? `●${facts.dirty_count}` : "",
        ]
          .filter(Boolean)
          .join(" ")}
        title={worktree ? txt.chipTitleWorktree : txt.chipTitle}
      >
        <Icon name={merged ? "merge" : worktree ? "worktree" : "branch"} />
        {/* The branch is named in the layer's heading and the chip's name,
            not on the chip: a long one took the title's room. */}
        {merged || arrows?.up || arrows?.down || facts.dirty_count ? (
          <span className="ah-gs-counts">
            {merged ? (
              <span className="ah-gs-chip-merged">{txt.merged}</span>
            ) : arrows ? (
              <Arrows
                up={arrows.up}
                down={arrows.down}
                title={
                  arrows.base
                    ? [
                        txt.aheadOf(txt.commits(arrows.up), arrows.against),
                        txt.behindOf(txt.commits(arrows.down), arrows.against),
                      ]
                    : [
                        txt.unpushedN(txt.commits(arrows.up)),
                        txt.incomingN(txt.commits(arrows.down)),
                      ]
                }
              />
            ) : null}
            {!merged && facts.dirty_count ? (
              <span
                className="ah-gs-dirty"
                title={txt.changedFiles(facts.dirty_count)}
              >
                <span className="ah-gs-dot" aria-hidden="true" />
                {facts.dirty_count}
              </span>
            ) : null}
          </span>
        ) : null}
      </ControlButton>
      {phone ? (
        <ModalOverlay className="ah-overlay ah-gs-sheet" isDismissable>
          <Modal className="ah-modal">{content}</Modal>
        </ModalOverlay>
      ) : (
        <Popover placement="bottom end" className="ah-popover ah-gs-layer">
          {content}
        </Popover>
      )}
    </DialogTrigger>
  );
}

const statusLetter = (status: string) => {
  if (status === "??")
    return { letter: "U", kind: "u", word: txt.status.untracked };
  // Unmerged pairs (porcelain "u" records) are conflicts whatever the letters.
  if (["DD", "AU", "UD", "UA", "DU", "AA", "UU"].includes(status))
    return { letter: "U", kind: "d", word: txt.status.conflict };
  const x = status[0] !== " " ? status[0] : status[1];
  const staged = status[0] !== " " && status[1] === " ";
  const word =
    x === "D"
      ? txt.status.deleted
      : x === "A"
        ? txt.status.added
        : x === "R"
          ? txt.status.renamed
          : x === "C"
            ? txt.status.copied
            : txt.status.modified;
  const kind = x === "D" ? "d" : x === "A" ? "a" : "m";
  return { letter: x, kind, word: staged ? txt.status.staged(word) : word };
};

const clock = (seconds: number) =>
  formatDate(seconds * 1000, { hour: "numeric", minute: "2-digit" });
const age = (seconds: number, now: number) => {
  const minutes = Math.max(0, Math.floor((now - seconds * 1000) / 60000));
  if (minutes < 1) return txt.justNow;
  if (minutes < 60) return txt.minutesAgo(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return txt.hoursAgo(hours);
  return txt.daysAgo(Math.floor(hours / 24));
};

function Commits({ list, kind }: { list: GitCommit[]; kind: "in" | "out" }) {
  return (
    <ul className="ah-gs-commits">
      {list.map((commit) => (
        <li key={commit.hash} className={`ah-gs-commit ${kind}`}>
          <code className="ah-gs-hash">{commit.hash.slice(0, 7)}</code>
          <span className="ah-gs-subject">{commit.subject}</span>
          <time dateTime={new Date(commit.timestamp * 1000).toISOString()}>
            {clock(commit.timestamp)}
          </time>
        </li>
      ))}
    </ul>
  );
}

/** A folded commit list; the count is the total even when the list is cut. */
function Fold({
  label,
  total,
  list,
  kind,
}: {
  label: string;
  total: number;
  list?: GitCommit[];
  kind: "in" | "out";
}) {
  if (!total)
    return (
      <div className="ah-gs-fold empty">
        <span>{label}</span>
        <span className="ah-gs-none">{txt.none}</span>
      </div>
    );
  return (
    <details data-testid={`git-commits-${kind}`} className="ah-gs-fold">
      <summary>
        <span>{label}</span>
        <span className="ah-gs-count">{total}</span>
      </summary>
      {list ? (
        <>
          <Commits list={list} kind={kind} />
          {list.length < total ? (
            <p className="ah-gs-note">
              {txt.showingNewest(list.length, total)}
            </p>
          ) : null}
        </>
      ) : (
        <p className="ah-gs-note">{txt.commitsUnreadable}</p>
      )}
    </details>
  );
}

function Comparison({
  name,
  sub,
  up,
  down,
  words,
}: {
  name: string;
  sub: string;
  up?: number;
  down?: number;
  words: [string, string];
}) {
  return (
    <div className="ah-gs-cmp">
      <div className="ah-gs-cmp-name">
        <span className="ah-gs-mono">{name}</span>
        <span className="ah-gs-sub">{sub}</span>
      </div>
      {up !== undefined && down !== undefined ? (
        <div className="ah-gs-cmp-n">
          <span className={`ah-gs-n${up ? "" : " zero"}`}>
            <Icon name="arrowUp" />
            {up} <span className="w">{words[0]}</span>
          </span>
          <span className={`ah-gs-n${down ? "" : " zero"}`}>
            <Icon name="arrowDown" />
            {down} <span className="w">{words[1]}</span>
          </span>
        </div>
      ) : (
        <span className="ah-gs-sub">{txt.notLocal}</span>
      )}
    </div>
  );
}

/** The details. `detail` is the latest on-demand reading; before it arrives
 * the summary draws the comparisons and the rest says it is loading. */
export function GitStatusDetails({
  summary,
  detail,
  path,
  readAt,
  now = Date.now(),
  loading,
  readError,
  fetching,
  fetchMessage,
  fetchFailed,
  onFetch,
  fetchUnavailable,
  filesNote,
  embedded = false,
}: {
  summary: GitSummaryFacts;
  detail?: GitDetailFacts;
  path?: string;
  readAt?: number;
  now?: number;
  loading: boolean;
  readError: boolean;
  fetching: boolean;
  fetchMessage?: string;
  fetchFailed?: boolean;
  onFetch: () => void;
  fetchUnavailable?: string;
  /** Why no file list will come, when no reading can give one (a worker
   * whose worktree Habitat cannot read: its counts come from its branch). */
  filesNote?: string;
  /** Inside another layer that has its own heading and close. */
  embedded?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Focus the heading once when the layer opens, not on every new reading.
  useEffect(() => heading.current?.focus(), []);
  const facts: GitSummaryFacts = detail ?? summary;
  const files = detail?.files ?? [];
  const base = facts.base;
  return (
    <div className="ah-gs-panel">
      {embedded ? null : (
        <div className="ah-gs-top">
          <Heading
            slot="title"
            className="ah-gs-head"
            tabIndex={-1}
            ref={heading}
          >
            <Icon name="branch" />
            <span className="ah-gs-branch">{facts.branch}</span>
            {path ? <span className="ah-gs-path">{path}</span> : null}
          </Heading>
          <ControlButton
            data-testid="dialog-close"
            size="inline"
            variant="quiet"
            slot="close"
            aria-label={txt.close}
            title={txt.close}
          >
            <Icon name="cross" />
          </ControlButton>
        </div>
      )}
      {facts.upstream ? (
        <section
          className="ah-gs-sec"
          data-section="upstream"
          aria-label={txt.upstreamLabel}
        >
          <Comparison
            name={facts.upstream}
            sub={txt.upstreamSub}
            up={facts.ahead}
            down={facts.behind}
            words={[txt.unpushed, txt.incoming]}
          />
          {facts.ahead !== undefined && facts.behind !== undefined ? (
            <>
              <Fold
                label={txt.unpushedTitle}
                total={facts.ahead}
                list={detail?.unpushed_commits}
                kind="out"
              />
              <Fold
                label={txt.incomingTitle}
                total={facts.behind}
                list={detail?.incoming_commits}
                kind="in"
              />
            </>
          ) : null}
        </section>
      ) : (
        <p className="ah-gs-note">{txt.noUpstream}</p>
      )}
      {base ? (
        <section
          className="ah-gs-sec"
          data-section="base"
          aria-label={txt.baseLabel}
        >
          <Comparison
            name={base.name}
            sub={txt.baseSub(base.ref, base.source === "recorded")}
            up={base.ahead}
            down={base.behind}
            words={[txt.ahead, txt.behind]}
          />
          {base.merged ? (
            <p className="ah-gs-merged">
              <Icon name="check" />
              {txt.allInBase(base.name)}
            </p>
          ) : (
            <Fold
              label={txt.aheadTitle(base.name)}
              total={base.ahead}
              list={detail?.base_ahead_commits}
              kind="out"
            />
          )}
          <Fold
            label={txt.behindTitle(base.name)}
            total={base.behind}
            list={detail?.base_behind_commits}
            kind="in"
          />
        </section>
      ) : null}
      {!facts.upstream && !base && detail?.commits.length ? (
        <section
          className="ah-gs-sec"
          data-section="recent"
          aria-label={txt.recentCommits}
        >
          <h4>{txt.recentCommits}</h4>
          <Commits list={detail.commits} kind="out" />
        </section>
      ) : null}
      <section
        className="ah-gs-sec"
        data-section="changes"
        aria-label={txt.changes}
      >
        <h4>
          {txt.changes} <span className="ah-gs-count">{facts.dirty_count}</span>
        </h4>
        {readError ? (
          <p className="ah-gs-note" role="status">
            {txt.readError}
          </p>
        ) : !detail ? (
          <p className="ah-gs-note">
            {loading ? txt.reading : (filesNote ?? "")}
          </p>
        ) : !files.length ? (
          <p className="ah-gs-note">{txt.noChanges}</p>
        ) : (
          <ul className="ah-gs-files">
            {files.map((file) => {
              const st = statusLetter(file.status);
              const slash = file.path.lastIndexOf("/");
              return (
                <li key={`${file.status}:${file.path}`} className="ah-gs-file">
                  <span className={`ah-gs-st ${st.kind}`} title={st.word}>
                    {st.letter}
                    <span className="ah-visually-hidden">{` ${st.word}`}</span>
                  </span>
                  <span
                    className="ah-gs-file-path"
                    title={
                      file.previous_path
                        ? `${file.previous_path} → ${file.path}`
                        : file.path
                    }
                  >
                    <span className="dir">{file.path.slice(0, slash + 1)}</span>
                    {file.path.slice(slash + 1)}
                  </span>
                  {file.added !== undefined ? (
                    <span className="ah-gs-stat">
                      <span className="add">+{file.added}</span>
                      {file.deleted ? (
                        <span className="del">−{file.deleted}</span>
                      ) : null}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {detail?.files_truncated ? (
          <p className="ah-gs-note">
            {txt.showingFirst(files.length, facts.dirty_count)}
          </p>
        ) : null}
      </section>
      <div className="ah-gs-foot">
        <p className="ah-gs-note">
          {detail?.fetched_at !== undefined
            ? txt.fetchedAt(
                <strong>{age(detail.fetched_at, now)}</strong>,
                clock(detail.fetched_at),
              )
            : detail
              ? txt.fetchUnknown
              : null}
          {txt.incomingNote(readAt ? clock(readAt / 1000) : undefined)}
        </p>
        {fetchMessage ? (
          <p
            className={`ah-gs-note${fetchFailed ? " ah-gs-error" : ""}`}
            role={fetchFailed ? "alert" : "status"}
          >
            {fetchMessage}
          </p>
        ) : null}
        <div className="ah-gs-acts">
          <ControlButton
            data-testid="fetch-git"
            size="inline"
            variant="secondary"
            className="ah-gs-fetch"
            // Busy, not disabled: disabling the focused button would drop
            // focus out of the layer (and Escape with it).
            isDisabled={!!fetchUnavailable}
            aria-busy={fetching || undefined}
            title={fetchUnavailable ?? txt.fetchTitle}
            onPress={() => {
              if (!fetching) onFetch();
            }}
          >
            <Icon name="refresh" />
            {fetching ? txt.fetching : txt.fetch}
          </ControlButton>
        </div>
        <p className="ah-gs-note">{txt.fetchNote}</p>
      </div>
    </div>
  );
}
