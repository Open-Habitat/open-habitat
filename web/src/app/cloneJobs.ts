import { useSyncExternalStore } from "react";
import {
  type CloneJob,
  type CloneMode,
  cancelClone,
  cloneJobs,
  dismissClone,
  GitHubError,
  removeInterrupted,
  startClone,
  subscribeClone,
} from "./github";

// The clone jobs of the daemon, as the clone page and the rail block show
// them. The daemon owns each job and keeps it in memory only; this is a view
// of its list, refreshed after every action and followed while one runs. It is
// never a record of its own: a reload reads the list again, and a daemon
// restart turns a running job into an interrupted directory that the next
// read reports.

export type CloneView = {
  /** The list has been read at least once for this person. */
  loaded: boolean;
  /** The last read failed; what is shown may be old. */
  failed: boolean;
  jobs: CloneJob[];
  interrupted: { full_name: string; size_bytes: number }[];
  interruptedComplete: boolean;
};

const empty: CloneView = {
  loaded: false,
  failed: false,
  jobs: [],
  interrupted: [],
  interruptedComplete: true,
};
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
  private retry?: ReturnType<typeof setTimeout>;
  private readonly life = new AbortController();
  constructor(
    /** Called when a job this view followed is confirmed: the workspace list changed. */
    private readonly onConfirmed: () => void = () => {},
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
    try {
      const list = await cloneJobs(signal);
      this.set({
        loaded: true,
        failed: false,
        jobs: list.jobs,
        interrupted: list.interrupted,
        interruptedComplete: list.interrupted_complete,
      });
      for (const job of list.jobs)
        if (job.state === "running") this.follow(job.job_id);
    } catch (e) {
      if (signal.aborted) return;
      this.set({ failed: true });
      // A login problem is the app's to show; anything else is read again
      // while a clone was running, since a deploy restarts the daemon.
      if (
        !(e instanceof GitHubError && e.code === "login") &&
        this.view.jobs.some((j) => j.state === "running")
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
      this.set({
        jobs: [job, ...this.view.jobs.filter((j) => j.job_id !== job.job_id)],
        interrupted: this.view.interrupted.filter((i) => i.full_name !== name),
      });
      void this.follow(job.job_id);
      return job;
    } finally {
      void this.refresh();
    }
  }
  async cancel(jobId: string, csrf: string) {
    try {
      this.patch(jobId, await cancelClone(jobId, csrf));
    } finally {
      await this.refresh();
    }
  }
  async dismiss(jobId: string, csrf: string) {
    try {
      await dismissClone(jobId, csrf);
      this.set({ jobs: this.view.jobs.filter((j) => j.job_id !== jobId) });
    } finally {
      void this.refresh();
    }
  }
  async remove(name: string, csrf: string) {
    try {
      return await removeInterrupted(name, csrf);
    } finally {
      await this.refresh();
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
  job: Pick<CloneJob, "state" | "stage" | "percent"> | "interrupted",
): string {
  if (job === "interrupted") return "keskeytyi";
  if (job.state === "running")
    return job.stage === "receiving" && job.percent !== undefined
      ? `${job.percent} %`
      : "kloonataan";
  if (job.state === "failed") return "epäonnistui";
  if (job.state === "confirmed") return "valmis";
  return "keskeytetty";
}
