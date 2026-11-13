import {
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router";
import {
  SpinoffContext,
  WorkerBrief,
  WorkerView,
  WorkerVoice,
  workerLive,
} from "../components/Spinoffs";
import { textNow, useText } from "../i18n";
import { spinoffConversationText } from "../text/spinoffConversation";
import { spinoffsText } from "../text/spinoffs";
import { useExperimentalFeature } from "./accountPreferences";
import { contextUsage } from "./contextUsage";
import type { timelineItems } from "./HistoryView";
import { readHelpersSeen, writeHelperSeen } from "./helpersSeen";
import { modelDisplayName, thinkingDisplayName, usePiModels } from "./PiModels";
import { latestSettings } from "./sessionSettings";
import { settingsHref } from "./settingsRoute";
import {
  readSpinoffs,
  type Spinoff,
  type Spinoffs,
  type WorkerTranscript,
} from "./spinoffs";
import { readSpinoffWork, type SpinoffWork } from "./spinoffWork";
import { useWorkerGit } from "./WorkerGitStatus";
import { WorkerTerminal } from "./WorkerTerminal";
import { askable } from "./workerRequests";
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
  /** gh's state as the snapshot last saw it, for the pull-request note. */
  githubState?: string;
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
  const [request, setRequest] = useState<string>();
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
  const work = useWorkerWork(parent, data);
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
  const helpers = useExperimentalFeature("named-workers");
  const [helpersSeen, setHelpersSeen] = useState(readHelpersSeen);
  // Opening a named worker's own conversation shows its report: the
  // chip's unseen mark clears (proto-named-workers round 2).
  // Only a conversation that was read shows the report.
  const seenRounds =
    data?.transcripts[0]?.availability === "available"
      ? (selected?.resident?.rounds ?? 0)
      : 0;
  useEffect(() => {
    if (helpers && run && seenRounds > 0)
      setHelpersSeen(writeHelperSeen(run, seenRounds));
  }, [helpers, run, seenRounds]);
  return (
    <SpinoffContext.Provider
      value={{
        data,
        stale,
        open: (r) => route(r.run_id),
        request,
        setRequest,
        work: work && new Map(work.runs.map((w) => [w.run_id, w])),
        workNote: work && workNote(work, place.githubState),
        helpers,
        helpersSeen,
      }}
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
          onTell={
            selected && askable(selected)
              ? () => {
                  setRequest(selected.run_id);
                  route();
                }
              : undefined
          }
        />
      ) : (
        children
      )}
    </SpinoffContext.Provider>
  );
}

/** Each work-facts read runs Git and asks GitHub once per worker branch,
 * so it follows the listed runs slowly rather than the spinoffs read's pace. */
function useWorkerWork(parent: string | undefined, data?: Spinoffs) {
  const [work, setWork] = useState<SpinoffWork>();
  // A new run or a state change asks again at once.
  const runs =
    data?.runs
      .filter((r) => r.state !== "merged")
      .map((r) => `${r.run_id}:${r.state}`)
      .join(",") ?? "";
  useEffect(() => {
    if (!parent || !runs) {
      setWork(undefined);
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const next = await readSpinoffWork(parent, controller.signal);
        if (!controller.signal.aborted) setWork(next);
      } catch {
        // Facts that could not be read are not shown as old ones.
        if (!controller.signal.aborted) setWork(undefined);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(load, 30000);
      }
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [parent, runs]);
  return work;
}

/** One note for the panel when gh said nothing about a worker that Git
 * answered for: the cause is the same for every row, so no row carries it. */
function workNote(work: SpinoffWork, githubState?: string) {
  if (
    !work.runs.some(
      (r) => r.git === "available" && r.pull_request_state === "unknown",
    )
  )
    return undefined;
  return githubState === "disconnected" || githubState === "expired"
    ? {
        text: textNow(spinoffConversationText).prSignedOut,
        href: settingsHref("koodipalvelut", "github"),
      }
    : { text: textNow(spinoffConversationText).prUnavailable };
}

function WorkerConversation({
  run,
  transcript,
  loading,
  stale,
  timeline,
  place,
  onLogin,
  onParent,
  onTell,
}: {
  run?: Spinoff;
  transcript?: WorkerTranscript;
  loading: boolean;
  stale: boolean;
  timeline?: Timeline;
  place: WorkerPlace;
  onLogin?: () => void;
  onParent: () => void;
  onTell?: () => void;
}) {
  // Habitat reads a Claude worker's session only once Claude has written
  // it: say so when it arrives while the person watches the terminal.
  const [arrived, setArrived] = useState(false);
  const spinoffs = useContext(SpinoffContext);
  const unreadable = useRef(false);
  const availability = transcript?.availability;
  useEffect(() => {
    if (!availability) return;
    if (availability !== "available") unreadable.current = true;
    else if (unreadable.current) setArrived(true);
  }, [availability]);
  const working = run?.state === "working";
  const entries = transcript?.entries;
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
    // A complete history starts with the task the main agent gave, shown
    // as the brief card: the task first, Taskfleet's run context on request.
    if (!transcript?.truncated && list[0]?.kind === "user") {
      const text = entries.find((e) => e.kind === "user")?.content.text;
      list[0] = {
        ...list[0],
        content: text ? (
          <WorkerBrief text={text} />
        ) : (
          <WorkerVoice voice="brief">{list[0].content}</WorkerVoice>
        ),
      };
    }
    return list;
  }, [
    timeline,
    entries,
    availability,
    working,
    transcript?.truncated,
    onLogin,
  ]);
  // The header's facts (worker-header-status): the model and context come
  // from the worker's own session as the view holds it, the same readings a
  // conversation's header makes; Claude Code records no usage Habitat reads.
  const txt = useText(spinoffsText);
  const { data: models } = usePiModels();
  const readable = availability === "available" && !!entries;
  const settings: { model?: string; thinking?: string } = readable
    ? latestSettings(entries)
    : {};
  const modelName = settings.model
    ? modelDisplayName(settings.model, models?.models)
    : undefined;
  const model = modelName
    ? {
        name: modelName,
        words: settings.thinking
          ? `${modelName} · ${thinkingDisplayName(settings.thinking)}`
          : modelName,
      }
    : undefined;
  const context =
    readable && run?.harness === "pi"
      ? contextUsage({ entries, model: settings.model, catalog: models })
      : undefined;
  const work = run ? spinoffs?.work?.get(run.run_id) : undefined;
  const git = useWorkerGit(
    run,
    work,
    spinoffs?.work !== undefined,
    txt.header.workerBranch,
  );
  const token = run?.terminal;
  const space = run?.terminal_workspace;
  const terminal =
    token && space && place.csrf && workerLive(run) ? (
      <WorkerTerminal
        workspaceId={space}
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
      work={work}
      git={git}
      context={context}
      model={model}
      onParent={onParent}
      onTell={onTell}
    />
  );
}
