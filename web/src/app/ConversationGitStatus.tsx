import { useEffect, useRef, useState } from "react";
import { GitStatusChip, GitStatusDetails } from "../components/GitStatus";
import type { Workspace } from "./snapshot";
import {
  fetchFailureReason,
  fetchWorkspaceGit,
  type WorkspaceGit,
  workspaceGit,
} from "./workspaceGit";

/** What Hae etärepo brought, measured against the reading before it. */
function fetchedNews(before: WorkspaceGit | undefined, after: WorkspaceGit) {
  const parts: string[] = [];
  const upstream = (after.behind ?? 0) - (before?.behind ?? after.behind ?? 0);
  if (upstream > 0 && after.upstream)
    parts.push(
      `${after.upstream} on saanut ${upstream === 1 ? "yhden uuden commitin" : `${upstream} uutta committia`}`,
    );
  const base =
    (after.base?.behind ?? 0) -
    (before?.base?.behind ?? after.base?.behind ?? 0);
  if (base > 0 && after.base)
    parts.push(
      `${after.base.name} on saanut ${base === 1 ? "yhden uuden commitin" : `${base} uutta committia`}`,
    );
  return parts.length
    ? `Etärepo haettu. ${parts.join(", ")}.`
    : "Etärepo haettu. Ei uutta.";
}

/**
 * One workspace's Git status for the browser: the snapshot's git_summary until
 * a newer on-demand reading exists. Readings happen when the details open,
 * when the agent's turn ends, on Lue uudelleen and (eager) on mount; never
 * polled. Hae etärepo is the only write.
 */
export function useGitStatus(
  workspace: Workspace,
  csrf: string | undefined,
  {
    working = false,
    eager = false,
  }: { working?: boolean; eager?: boolean } = {},
) {
  const id = workspace.workspace_id;
  const summary = workspace.git_summary;
  const isGit =
    workspace.kind === "git_main_worktree" ||
    workspace.kind === "git_linked_worktree";
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<WorkspaceGit>();
  const [readAt, setReadAt] = useState<number>();
  const [useDetail, setUseDetail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchMessage, setFetchMessage] = useState<{
    text: string;
    failed: boolean;
  }>();
  const [now, setNow] = useState(() => Date.now());
  const generation = useRef(0);
  // The fetch's own lifetime: a reading started meanwhile may supersede its
  // result, but must not leave the button busy for good.
  const fetchSeq = useRef(0);
  const reader = useRef<AbortController>(undefined);

  const read = () => {
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
        setUseDetail(true);
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

  // Another workspace is another repository: nothing carries over.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the workspace ID is the reset key.
  useEffect(() => {
    ++generation.current;
    ++fetchSeq.current;
    reader.current?.abort();
    setOpen(false);
    setDetail(undefined);
    setUseDetail(false);
    setReadError(false);
    setLoading(false);
    setFetching(false);
    setFetchMessage(undefined);
  }, [id]);
  useEffect(() => () => reader.current?.abort(), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: one eager reading per workspace.
  useEffect(() => {
    if (eager && isGit) readRef.current();
  }, [eager, isGit, id]);

  // A new snapshot observation is newer than the last reading.
  const summaryKey = JSON.stringify(summary ?? null);
  const lastSummary = useRef(summaryKey);
  useEffect(() => {
    if (lastSummary.current === summaryKey) return;
    lastSummary.current = summaryKey;
    setUseDetail(false);
    if (open) readRef.current();
  }, [summaryKey, open]);

  // The agent's turn ended: its edits are on disk now.
  const wasWorking = useRef(working);
  useEffect(() => {
    if (wasWorking.current && !working && isGit) readRef.current();
    wasWorking.current = working;
  }, [working, isGit]);

  useEffect(() => {
    if (!open && !eager) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [open, eager]);

  const chipFacts = (useDetail && detail) || summary || detail;
  const fetchRemote = () => {
    if (!csrf || fetching) return;
    const before = detail;
    const mine = ++fetchSeq.current;
    const version = ++generation.current;
    reader.current?.abort();
    setFetching(true);
    setLoading(false);
    setFetchMessage(undefined);
    void fetchWorkspaceGit(id, csrf)
      .then((value) => {
        if (mine !== fetchSeq.current) return;
        // The reply was read after the fetch, so it supersedes any reading
        // started while the fetch ran (closing and reopening, a turn end).
        if (version !== generation.current) {
          ++generation.current;
          reader.current?.abort();
          setLoading(false);
        }
        setDetail(value);
        setReadAt(Date.now());
        setUseDetail(true);
        setReadError(false);
        setFetchMessage({ text: fetchedNews(before, value), failed: false });
      })
      .catch((error: unknown) => {
        if (mine !== fetchSeq.current) return;
        setFetchMessage({ text: fetchFailureReason(error), failed: true });
      })
      .finally(() => {
        if (mine === fetchSeq.current) setFetching(false);
      });
  };
  return {
    isGit,
    open,
    setOpen: (value: boolean) => {
      setOpen(value);
      if (value) {
        setFetchMessage(undefined);
        read();
      }
    },
    facts: chipFacts,
    detail,
    readError,
    details: {
      detail,
      readAt,
      now,
      loading,
      readError,
      fetching,
      fetchMessage: fetchMessage?.text,
      fetchFailed: fetchMessage?.failed,
      fetchUnavailable: csrf ? undefined : "Ladataan istuntoa.",
      onFetch: fetchRemote,
      onReread: () => {
        setFetchMessage(undefined);
        read();
      },
    },
  };
}

/** The conversation's Git status in the top bar (Yläpalkissa). */
export function ConversationGitStatus({
  workspace,
  csrf,
  working,
}: {
  workspace: Workspace;
  csrf?: string;
  working: boolean;
}) {
  const git = useGitStatus(workspace, csrf, { working });
  if (!git.isGit || !git.facts) return null;
  return (
    <GitStatusChip facts={git.facts} open={git.open} onOpenChange={git.setOpen}>
      <GitStatusDetails
        summary={git.facts}
        path={`~/src/${workspace.name}`}
        {...git.details}
      />
    </GitStatusChip>
  );
}
