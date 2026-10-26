import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  SpinoffContext,
  WorkerView,
  WorkerVoice,
  workerLive,
} from "../components/Spinoffs";
import type { timelineItems } from "./HistoryView";
import type { HistoryEntry } from "./history";
import {
  readSpinoffs,
  type Spinoff,
  type Spinoffs,
  type WorkerTranscript,
} from "./spinoffs";
import { WorkerTerminal } from "./WorkerTerminal";
// An incomplete read is not proof that a run vanished: Taskfleet keeps
// settled runs. Keep the runs it did not mention until a complete read.
export function keepKnownRuns(previous: Spinoffs | undefined, next: Spinoffs) {
  if (next.availability === "available" || !previous) return next;
  const seen = new Set(next.runs.map((r) => r.run_id));
  return {
    ...next,
    runs: [
      ...next.runs,
      ...previous.runs.filter((r) => !seen.has(r.run_id)),
    ].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}
/** The conversation's own timeline builder, handed in by the view that owns it. */
export type Timeline = typeof timelineItems;
type WorkerPlace = {
  /** The parent conversation's title, for the worker band's link back. */
  parentTitle?: string;
  workspaceId?: string;
  workspaceName?: string;
  csrf?: string;
};
export function SpinoffProvider({
  parent,
  recheck,
  onLogin,
  timeline,
  place = {},
  children,
}: {
  parent?: string;
  /** Native-session readability as the page knows it. While the daemon
   * has no readable session for the parent, polling waits for this to
   * change instead of collecting a 404 every few seconds. */
  recheck?: string;
  onLogin?: () => void;
  timeline?: Timeline;
  place?: WorkerPlace;
  children: ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const run = new URLSearchParams(location.search).get("spinoff");
  const [data, setData] = useState<Spinoffs>();
  const [stale, setStale] = useState(false);
  const resume = useRef<() => void>(undefined);
  useEffect(() => {
    resume.current = undefined;
    setData(undefined);
    setStale(false);
    if (!parent) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      let missing = false;
      try {
        const next = await readSpinoffs(parent, run, controller.signal);
        if (!controller.signal.aborted) {
          setData((previous) => keepKnownRuns(previous, next));
          setStale(false);
        }
      } catch (e) {
        missing = e instanceof Error && e.message === "parent_missing";
        if (missing) {
          // Nothing can be attributed to a session that does not exist.
          if (!controller.signal.aborted)
            resume.current = () => {
              clearTimeout(timer);
              void load();
            };
        } else if (!controller.signal.aborted) {
          setStale(true);
          if (e instanceof Error && e.message === "identity_lost") {
            setData(undefined);
            onLogin?.();
          }
        }
      } finally {
        // A missed signal must not hide spinoffs for good: reread slowly.
        if (!controller.signal.aborted)
          timer = setTimeout(load, missing ? 60000 : 3000);
      }
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [parent, run, onLogin]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: recheck is the trigger, not read inside the effect.
  useEffect(() => {
    const again = resume.current;
    resume.current = undefined;
    again?.();
  }, [recheck]);
  const route = (id?: string) => {
    const q = new URLSearchParams(location.search);
    if (id) q.set("spinoff", id);
    else q.delete("spinoff");
    navigate(`${location.pathname}?${q}`);
  };
  const selected = data?.runs.find((r) => r.run_id === run);
  return (
    <SpinoffContext.Provider
      value={{ data, stale, open: (r) => route(r.run_id) }}
    >
      {run ? (
        <WorkerConversation
          key={run}
          run={selected}
          transcript={data?.transcripts[0]}
          loading={!data && !stale}
          stale={stale || (!!data && data.availability !== "available")}
          timeline={timeline}
          place={place}
          onLogin={onLogin}
          onParent={() => route()}
        />
      ) : (
        children
      )}
    </SpinoffContext.Provider>
  );
}

// The newest history entry, for noticing that the worker moved on.
const lastKey = (entries: HistoryEntry[]) => entries.at(-1)?.entry_key;

function WorkerConversation({
  run,
  transcript,
  loading,
  stale,
  timeline,
  place,
  onLogin,
  onParent,
}: {
  run?: Spinoff;
  transcript?: WorkerTranscript;
  loading: boolean;
  stale: boolean;
  timeline?: Timeline;
  place: WorkerPlace;
  onLogin?: () => void;
  onParent: () => void;
}) {
  // Habitat reads a Claude worker's session only once Claude has written
  // it: say so when it arrives while the person watches the terminal.
  const [arrived, setArrived] = useState(false);
  const unreadable = useRef(false);
  const availability = transcript?.availability;
  useEffect(() => {
    if (!availability) return;
    if (availability !== "available") unreadable.current = true;
    else if (unreadable.current) setArrived(true);
  }, [availability]);
  const working = run?.state === "working";
  const entries = transcript?.entries;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new poll with the same newest entry draws the same timeline.
  const items = useMemo(() => {
    if (!timeline || !entries || availability !== "available") return [];
    const list = timeline(
      entries,
      onLogin,
      undefined,
      undefined,
      undefined,
      undefined,
      working ? { working: true, steps: [] } : undefined,
    );
    // A complete history starts with the task the main agent gave.
    if (!transcript?.truncated && list[0]?.kind === "user")
      list[0] = {
        ...list[0],
        content: <WorkerVoice voice="brief">{list[0].content}</WorkerVoice>,
      };
    return list;
  }, [
    timeline,
    entries && lastKey(entries),
    entries?.length,
    availability,
    working,
    transcript?.truncated,
    onLogin,
  ]);
  const token = run?.terminal;
  const terminal =
    token && place.csrf && place.workspaceId && workerLive(run) ? (
      <WorkerTerminal
        workspaceId={place.workspaceId}
        token={token}
        csrf={place.csrf}
        onLogin={onLogin}
      />
    ) : undefined;
  return (
    <WorkerView
      run={run}
      transcript={transcript}
      items={items}
      loading={loading}
      stale={stale}
      parentTitle={place.parentTitle}
      workspaceLabel={place.workspaceName ?? ""}
      workspaceHref={
        place.workspaceId ? `/workspaces/${place.workspaceId}` : "/workspaces"
      }
      terminal={terminal}
      historyArrived={arrived}
      onParent={onParent}
    />
  );
}
