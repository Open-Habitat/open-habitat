import { useEffect, useRef, useState } from "react";
import type { GitSummaryFacts } from "../components/GitStatus";
import type { WorkerGitView } from "../components/WorkerHeader";
import type { Spinoff } from "./spinoffs";
import type { WorkerWork } from "./spinoffWork";
import { type WorkspaceGit, workspaceGit } from "./workspaceGit";

/** The counts spinoff-work read against the worker's source branch, in the
 * chip's shape: what the chip shows until (or without) a worktree reading. */
export function workSummary(
  run: Spinoff,
  work: WorkerWork | undefined,
  /** The branch's name when the run names none (a live run). */
  fallback: string,
): GitSummaryFacts | undefined {
  if (work?.git !== "available") return undefined;
  const source = run.source_branch;
  return {
    branch: run.branch || fallback,
    // A run that kept only its branch has no worktree: nothing uncommitted.
    dirty_count: work.dirty_count ?? 0,
    base:
      source && work.ahead !== undefined && work.behind !== undefined
        ? {
            name: source,
            ref: source,
            source: "recorded",
            ahead: work.ahead,
            behind: work.behind,
            merged: work.ahead === 0,
          }
        : undefined,
  };
}

/**
 * The worker's Git for its header (worker-header-status). While the worktree
 * is registered (`git_workspace`), the workspace Git route reads it as the
 * person: on opening the view, on opening the layer, and whenever
 * spinoff-work's periodic counts for this worker change, the worker's
 * equivalent of a conversation's new snapshot observation. Without it the
 * chip shows spinoff-work's counts. Nothing is fetched from the browser.
 */
export function useWorkerGit(
  run: Spinoff | undefined,
  work: WorkerWork | undefined,
  /** spinoff-work has answered for the parent's workers at least once. */
  workRead: boolean,
  branchFallback: string,
): WorkerGitView | undefined {
  const id = run?.git_workspace;
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<WorkspaceGit>();
  const [readAt, setReadAt] = useState<number>();
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const generation = useRef(0);
  const reader = useRef<AbortController>(undefined);
  const read = () => {
    if (!id) return;
    reader.current?.abort();
    const controller = new AbortController();
    reader.current = controller;
    const version = ++generation.current;
    setLoading(true);
    void workspaceGit(id, controller.signal)
      .then((value) => {
        if (version !== generation.current) return;
        setDetail(value);
        setReadAt(Date.now());
        setReadError(false);
      })
      .catch(() => {
        if (version === generation.current && !controller.signal.aborted)
          setReadError(true);
      })
      .finally(() => {
        if (version === generation.current) setLoading(false);
      });
  };
  const readRef = useRef(read);
  readRef.current = read;
  // spinoff-work saw the worker's counts move (or its state change).
  const workKey = JSON.stringify([
    run?.state,
    work?.dirty_count,
    work?.ahead,
    work?.behind,
    work?.added,
    work?.removed,
  ]);
  const lastWork = useRef(workKey);
  // Another worktree: nothing carries over; read the new one at once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the worktree's ID is the reset key.
  useEffect(() => {
    ++generation.current;
    reader.current?.abort();
    setDetail(undefined);
    setReadError(false);
    setLoading(false);
    // This reading covers the counts known now; only a later change rereads.
    lastWork.current = workKey;
    readRef.current();
  }, [id]);
  useEffect(() => () => reader.current?.abort(), []);
  useEffect(() => {
    if (lastWork.current === workKey) return;
    lastWork.current = workKey;
    readRef.current();
  }, [workKey]);
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [open]);
  if (!run) return undefined;
  const summary = workSummary(run, work, branchFallback);
  // A failed reread leaves the last reading in the layer (with its error),
  // but the chip follows spinoff-work's newer counts when it has them.
  const facts: GitSummaryFacts | undefined =
    (id && detail && !(readError && summary) ? detail : undefined) ||
    summary ||
    (id ? detail : undefined);
  if (!facts) {
    if (run.state === "merged") return { state: "landed" };
    // Something may still answer: the worktree's reading or spinoff-work's
    // next round, which the panel asks for every listed run.
    return (id && !readError) || (!id && !workRead)
      ? { state: "reading" }
      : { state: "unknown" };
  }
  return {
    state: "known",
    facts,
    merged: run.state === "merged" && !!facts.base?.merged,
    path: run.worktree || undefined,
    open,
    onOpenChange: (value) => {
      setOpen(value);
      if (value) read();
    },
    details: {
      detail: id ? detail : undefined,
      readAt,
      now,
      loading: !!id && loading,
      readError: !!id && readError,
      fetching: false,
      onFetch: () => {},
    },
  };
}
