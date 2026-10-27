import { useSyncExternalStore } from "react";
import {
  type CloneJob,
  type CloneMode,
  cancelClone,
  cloneJobs,
  dismissClone,
  type ForgeCloneSource,
  GitHubError,
  type InterruptedClone,
  observe,
  type PlannedClone,
  removeInterrupted,
  startClone,
  startForgeClone,
  subscribeClone,
} from "./github";

// The clone jobs of the daemon, as the clone page and the rail block show
// them. The daemon owns each job and keeps it in memory only; this is a view
// of its list, refreshed after every action and followed while one runs. It is
// never a record of its own: a reload reads the list again, and a daemon
// restart turns a running job into an interrupted directory that the next
// read reports.
//
// The one exception is the queue. The daemon runs one clone at a time, and
// onboarding lets a person pick several repositories and go on to the AI
// sign-in at once, so the names not yet started wait here and are started one
// after another. The queue lives as long as this tab's session binding: a
// closed tab leaves the names it had not started unstarted, never half-written.

export type CloneView = {
  /** The list has been read at least once for this person. */
  loaded: boolean;
  /** The last read failed; what is shown may be old. */
  failed: boolean;
  jobs: CloneJob[];
  interrupted: InterruptedClone[];
  interruptedComplete: boolean;
  /** Names this tab has asked for and not yet handed to the daemon as a job. */
  queue: QueuedClone[];
  /** The site's defaults the daemon itself starts one by one (ADR 0030). */
  planned: PlannedClone[];
};

export type QueuedClone = {
  full_name: string;
  mode: CloneMode;
  /**
   * waiting: started when no clone runs; starting: its start is on its way;
   * present: the checkout was already there, so nothing was started;
   * refused: the daemon refused the start, and nothing was written; or its
   * reply was lost and the list has not shown a job for it yet (`before`).
   */
  state: "waiting" | "starting" | "present" | "refused";
  problem?: GitHubError["code"];
  /** A finished job this one replaces; forgotten once the new one starts. */
  replaces?: string;
  /** For a start whose reply was lost: the jobs known before it. A later
   * list with any other job of this name shows the start did happen. */
  before?: string[];
};

const empty: CloneView = {
  loaded: false,
  failed: false,
  jobs: [],
  interrupted: [],
  interruptedComplete: true,
  queue: [],
  planned: [],
};
const same = (a: string, b: string) =>
  a.toLocaleLowerCase() === b.toLocaleLowerCase();
const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });

export class CloneJobs {
  private view: CloneView = empty;
  private listeners = new Set<() => void>();
  private following = new Set<string>();
  private reading?: Promise<void>;
  private again?: Promise<void>;
  /** Counts confirmed writes; a list read that began before one is stale. */
  private writes = 0;
  private retry?: ReturnType<typeof setTimeout>;
  private readonly life = new AbortController();
  /** The session binding the queue's starts are sent with. */
  private csrf?: string;
  private pumping = false;
  private nudge?: ReturnType<typeof setTimeout>;
  /** A busy start waits for its delay before the next start is tried. */
  private backoff = false;
  /** Busy refusals in a row while the list shows no running clone. */
  private busyStreak = 0;
  constructor(
    /** Called when a job this view followed is confirmed: the workspace list changed. */
    private readonly onConfirmed: () => void = () => {},
    /** The session binding this store belongs to. The queue starts names
     * only with it, so another session's token never writes this queue. */
    readonly binding?: string,
  ) {}

  get = () => this.view;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  dispose() {
    this.life.abort();
    clearTimeout(this.retry);
    clearTimeout(this.nudge);
    this.listeners.clear();
  }
  private set(next: Partial<CloneView>) {
    if (this.life.signal.aborted) return;
    this.view = { ...this.view, ...next };
    for (const listener of this.listeners) listener();
  }
  private patch(jobId: string, change: Partial<CloneJob>) {
    this.set({
      jobs: this.view.jobs.map((j) =>
        j.job_id === jobId ? { ...j, ...change } : j,
      ),
    });
  }

  /** Reads the list. A call during a read is answered by one more read after
   * it, so a write that finished meanwhile is never hidden by an older list. */
  refresh(): Promise<void> {
    if (this.reading) {
      this.again ??= this.reading.then(() => {
        this.again = undefined;
        return this.refresh();
      });
      return this.again;
    }
    this.reading = this.read().finally(() => {
      this.reading = undefined;
    });
    return this.reading;
  }
  private async read() {
    const { signal } = this.life;
    clearTimeout(this.retry);
    const began = this.writes;
    try {
      const list = await cloneJobs(signal);
      // A write confirmed meanwhile is newer than this list; the read queued
      // after that write answers instead.
      if (began !== this.writes) return;
      this.set({
        loaded: true,
        failed: false,
        jobs: list.jobs,
        interrupted: list.interrupted,
        interruptedComplete: list.interrupted_complete,
        planned: list.planned ?? [],
        queue: this.view.queue.filter(
          (q) =>
            !q.before ||
            !list.jobs.some(
              (j) =>
                !j.source &&
                same(j.full_name, q.full_name) &&
                !q.before?.includes(j.job_id),
            ),
        ),
      });
      for (const job of list.jobs)
        if (job.state === "running") this.follow(job.job_id);
      // The daemon starts a waiting default by itself; only the list shows
      // when, so it is read again while one waits.
      if (list.planned?.some((p) => p.state === "waiting"))
        this.retry = setTimeout(() => void this.refresh(), 2000);
      this.pump();
    } catch (e) {
      if (signal.aborted) return;
      this.set({ failed: true });
      // A login problem is the app's to show; anything else is read again
      // while a clone was running, since a deploy restarts the daemon, or
      // while a lost start reply still waits for the list to settle it.
      if (
        !(e instanceof GitHubError && e.code === "login") &&
        (this.view.jobs.some((j) => j.state === "running") ||
          this.view.queue.some((q) => q.before))
      )
        this.retry = setTimeout(() => void this.refresh(), 5000);
    }
  }

  /** Follows one running job to its end. A stream that ends without a result
   * is opened again; a refused one means the job is gone, so the list is read. */
  private async follow(jobId: string) {
    if (this.following.has(jobId)) return;
    this.following.add(jobId);
    const { signal } = this.life;
    try {
      for (let attempt = 0; attempt < 60 && !signal.aborted; attempt++) {
        let terminal: Awaited<ReturnType<typeof subscribeClone>>;
        try {
          terminal = await subscribeClone(
            jobId,
            (frame) => {
              attempt = 0;
              this.patch(jobId, {
                stage: frame.stage,
                percent: frame.percent,
                received_bytes: frame.received_bytes,
              });
            },
            signal,
          );
        } catch {
          break;
        }
        if (terminal) {
          if (terminal.outcome === "confirmed") this.onConfirmed();
          break;
        }
        await pause(1000, signal);
      }
    } finally {
      this.following.delete(jobId);
    }
    if (!signal.aborted) await this.refresh();
  }

  /** Starts (or, for an interrupted clone, restarts) a clone; the job's own
   * refusal is thrown for the caller to explain. */
  async start(name: string, mode: CloneMode, csrf: string, restart = false) {
    try {
      const job = await startClone(name, mode, csrf, restart);
      this.writes++;
      this.set({
        jobs: [job, ...this.view.jobs.filter((j) => j.job_id !== job.job_id)],
        interrupted: this.view.interrupted.filter(
          (i) => i.source || i.full_name !== name,
        ),
      });
      void this.follow(job.job_id);
      return job;
    } finally {
      void this.refresh();
    }
  }
  /** Starts (or, over its interrupted clone, restarts) a clone of a Gitea
   * or GitLab connection's repository. */
  async startForge(source: ForgeCloneSource, csrf: string, restart = false) {
    try {
      const job = await startForgeClone(source, csrf, restart);
      this.writes++;
      this.set({
        jobs: [job, ...this.view.jobs.filter((j) => j.job_id !== job.job_id)],
        interrupted: this.view.interrupted.filter(
          (i) =>
            !restart ||
            i.source?.connection_id !== source.connection_id ||
            i.full_name !== job.full_name,
        ),
      });
      void this.follow(job.job_id);
      return job;
    } finally {
      void this.refresh();
    }
  }
  async cancel(jobId: string, csrf: string) {
    try {
      const job = await cancelClone(jobId, csrf);
      this.writes++;
      this.patch(jobId, job);
    } finally {
      await this.refresh();
    }
  }
  async dismiss(jobId: string, csrf: string) {
    try {
      await dismissClone(jobId, csrf);
      this.writes++;
      this.set({ jobs: this.view.jobs.filter((j) => j.job_id !== jobId) });
    } finally {
      void this.refresh();
    }
  }
  async remove(name: string, csrf: string, provider?: "gitea" | "gitlab") {
    try {
      const state = await removeInterrupted(name, csrf, provider);
      this.writes++;
      return state;
    } finally {
      await this.refresh();
    }
  }

  /** Queues names to be cloned one after another. A name already waiting or
   * running is not queued twice. */
  enqueue(names: readonly string[], mode: CloneMode, csrf: string) {
    if (!this.own(csrf)) return false;
    const queue = this.view.queue.filter(
      (q) =>
        !names.some((n) => same(n, q.full_name)) ||
        q.state === "waiting" ||
        q.state === "starting",
    );
    for (const name of names)
      if (
        !queue.some((q) => same(q.full_name, name)) &&
        !this.view.jobs.some(
          (j) => !j.source && j.state === "running" && same(j.full_name, name),
        )
      )
        queue.push({ full_name: name, mode, state: "waiting" });
    this.set({ queue });
    this.pump();
    return true;
  }
  /** Adopts csrf for the queue's starts when it is this store's session. */
  private own(csrf: string) {
    if (this.binding !== undefined && csrf !== this.binding) return false;
    this.csrf = csrf;
    return true;
  }
  /** Tries a refused name or a failed job again, through the queue. */
  retryClone(name: string, csrf: string) {
    if (!this.own(csrf)) return;
    const queued = this.view.queue.find((q) => same(q.full_name, name));
    const job = this.view.jobs.find(
      (j) => !j.source && same(j.full_name, name),
    );
    if (queued?.state === "waiting" || queued?.state === "starting") return;
    if (job?.state === "running") return;
    this.set({
      queue: [
        ...this.view.queue.filter((q) => !same(q.full_name, name)),
        {
          full_name: name,
          mode: job?.mode ?? queued?.mode ?? "full",
          state: "waiting",
          replaces:
            job && job.state !== "confirmed" && !queued
              ? job.job_id
              : undefined,
        },
      ],
    });
    this.pump();
  }
  /** Drops a name that has not been started. */
  unqueue(name: string) {
    this.set({
      queue: this.view.queue.filter(
        (q) => !same(q.full_name, name) || q.state === "starting",
      ),
    });
  }
  private patchQueue(name: string, change: Partial<QueuedClone> | undefined) {
    this.set({
      queue: change
        ? this.view.queue.map((q) =>
            same(q.full_name, name) ? { ...q, ...change } : q,
          )
        : this.view.queue.filter((q) => !same(q.full_name, name)),
    });
  }

  /** Starts the next waiting name when no clone runs. A clone running in
   * another tab answers busy; the list read after it ends calls this again. */
  private pump() {
    if (this.pumping || this.backoff || !this.csrf || this.life.signal.aborted)
      return;
    if (this.view.jobs.some((j) => j.state === "running")) return;
    const next = this.view.queue.find((q) => q.state === "waiting");
    if (!next) return;
    this.pumping = true;
    const csrf = this.csrf;
    const name = next.full_name;
    this.patchQueue(name, { state: "starting", problem: undefined });
    void this.startQueued(next, csrf).finally(() => {
      this.pumping = false;
      this.pump();
    });
  }
  private async startQueued(next: QueuedClone, csrf: string) {
    const name = next.full_name;
    const { signal } = this.life;
    // A checkout that is already there is the person's wish fulfilled; the
    // daemon would refuse the start as an existing destination.
    try {
      const seen = await observe(name, signal);
      if (signal.aborted) return;
      if (seen.state === "confirmed") {
        this.patchQueue(name, { state: "present" });
        return;
      }
      if (seen.state === "conflict" || seen.state === "interrupted") {
        this.patchQueue(name, { state: "refused", problem: "conflict" });
        return;
      }
    } catch (e) {
      if (signal.aborted) return;
      if (e instanceof GitHubError && e.code === "login") {
        this.csrf = undefined;
        this.patchQueue(name, { state: "waiting" });
        return;
      }
      // An unreadable observation is not a refusal; the start decides.
    }
    const known = new Set(this.view.jobs.map((j) => j.job_id));
    try {
      await this.start(name, next.mode, csrf);
      this.busyStreak = 0;
      this.patchQueue(name, undefined);
      if (next.replaces) void this.dismiss(next.replaces, csrf).catch(() => {});
    } catch (e) {
      if (signal.aborted) return;
      const code = e instanceof GitHubError ? e.code : "unavailable";
      if (code === "login") {
        this.csrf = undefined;
        this.patchQueue(name, { state: "waiting" });
      } else if (code === "busy") {
        // Another clone runs; wait for its end, or look again shortly if the
        // list does not show it.
        await this.refresh();
        if (this.view.jobs.some((j) => j.state === "running")) {
          this.busyStreak = 0;
          this.patchQueue(name, { state: "waiting" });
        } else if (++this.busyStreak > 30) {
          // A busy daemon whose list cannot be read is not asked forever.
          this.busyStreak = 0;
          this.patchQueue(name, { state: "refused", problem: code });
        } else {
          this.patchQueue(name, { state: "waiting" });
          this.backoff = true;
          this.nudge = setTimeout(() => {
            this.backoff = false;
            this.pump();
          }, 2000);
        }
      } else if (code === "unavailable") {
        // A lost reply is not proof that nothing started: the list decides,
        // so a started clone is never asked for a second time.
        await this.refresh();
        if (signal.aborted) return;
        const started = this.view.jobs.some(
          (j) => !j.source && same(j.full_name, name) && !known.has(j.job_id),
        );
        this.patchQueue(
          name,
          started
            ? undefined
            : { state: "refused", problem: code, before: [...known] },
        );
        // An unread list leaves the start unsettled; keep reading it.
        if (!started && this.view.failed) {
          clearTimeout(this.retry);
          this.retry = setTimeout(() => void this.refresh(), 5000);
        }
      } else this.patchQueue(name, { state: "refused", problem: code });
    }
  }
}

export function useCloneView(store: CloneJobs | undefined): CloneView {
  return useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    store?.get ?? emptyView,
  );
}
const noSubscribe = () => () => {};
const emptyView = () => empty;

/** What a job or interrupted directory says in a word, for the rail and the list. */
export function cloneLabel(
  job:
    | Pick<CloneJob, "state" | "stage" | "percent">
    | "interrupted"
    | "queued"
    | "refused",
): string {
  if (job === "interrupted") return "keskeytyi";
  if (job === "queued") return "jonossa";
  if (job === "refused") return "ei alkanut";
  if (job.state === "running")
    return job.stage === "receiving" && job.percent !== undefined
      ? `${job.percent} %`
      : "kloonataan";
  if (job.state === "failed") return "epäonnistui";
  if (job.state === "confirmed") return "valmis";
  return "keskeytetty";
}

/** One repository's clone as a compact list shows it. */
export type CloneRow = {
  full_name: string;
  state: "waiting" | "running" | "present" | "confirmed" | "failed";
  stage?: CloneJob["stage"];
  percent?: number;
  received_bytes?: number;
  /** The job's reason, or the refusal of a start that never became a job. */
  reason?: string;
  problem?: GitHubError["code"];
  /** Nothing of the failed attempt is left on disk, so another starts clean. */
  retryable: boolean;
};

/** Every clone this person has under way or just finished, oldest first: the
 * daemon's newest job per repository, its interrupted directories and this
 * tab's queue. A cancelled job that left nothing is not shown. */
export function cloneRows(view: CloneView): CloneRow[] {
  const queued = (name: string) =>
    view.queue.some((q) => same(q.full_name, name));
  const rows: CloneRow[] = [];
  const seen = new Set<string>();
  for (const job of view.jobs) {
    // These rows are GitHub onboarding's: a Gitea namesake is another repo.
    if (job.source) continue;
    const key = job.full_name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (job.state !== "running" && queued(job.full_name)) continue;
    if (job.state === "cancelled" && job.leftover === "removed") continue;
    if (
      job.state !== "running" &&
      view.interrupted.some(
        (i) => !i.source && same(i.full_name, job.full_name),
      )
    )
      continue;
    rows.unshift(
      job.state === "running"
        ? {
            full_name: job.full_name,
            state: "running",
            stage: job.stage,
            percent: job.percent,
            received_bytes: job.received_bytes,
            retryable: false,
          }
        : job.state === "confirmed"
          ? { full_name: job.full_name, state: "confirmed", retryable: false }
          : {
              full_name: job.full_name,
              state: "failed",
              reason: job.reason,
              retryable: job.leftover === "removed",
            },
    );
  }
  for (const i of view.interrupted)
    if (!i.source && !queued(i.full_name))
      rows.push({
        full_name: i.full_name,
        state: "failed",
        reason: "interrupted",
        retryable: false,
      });
  for (const q of view.queue) {
    if (
      view.jobs.some(
        (j) =>
          !j.source && j.state === "running" && same(j.full_name, q.full_name),
      )
    )
      continue;
    rows.push(
      q.state === "refused"
        ? {
            full_name: q.full_name,
            state: "failed",
            problem: q.problem,
            retryable: true,
          }
        : {
            full_name: q.full_name,
            state: q.state === "present" ? "present" : "waiting",
            retryable: false,
          },
    );
  }
  for (const p of view.planned) {
    if (
      queued(p.full_name) ||
      view.jobs.some(
        (j) =>
          !j.source && j.state === "running" && same(j.full_name, p.full_name),
      )
    )
      continue;
    rows.push(
      p.state === "refused"
        ? {
            full_name: p.full_name,
            state: "failed",
            problem:
              p.reason === "quota_full"
                ? "storage"
                : p.reason === "github_auth_unavailable"
                  ? "auth"
                  : p.reason === "checkout_exists"
                    ? "conflict"
                    : "unavailable",
            retryable: true,
          }
        : { full_name: p.full_name, state: "waiting", retryable: false },
    );
  }
  return rows;
}
