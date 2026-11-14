import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  type Spinoff,
  type Spinoffs,
  spinoffStateLabel,
  splitBrief,
  type WorkerTranscript,
} from "../app/spinoffs";
import type { WorkerWork } from "../app/spinoffWork";
import { useText } from "../i18n";
import { spinoffsText } from "../text/spinoffs";
import { type ContextUsage, contextSentence } from "./ContextRing";
import { ControlButton } from "./ControlElements";
import {
  ConversationTimeline,
  ConversationVoice,
  UserMessage,
} from "./Conversation";
import { ConversationFrame, ConversationStream } from "./ConversationFrame";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";
import { workerMark } from "./markState";
import { AgentHeader } from "./Navigation";
import { PiBoundary } from "./PiBlocks";
import { Button } from "./Primitives";
import { InlineNotice, type StatusKind } from "./Status";
import type { TimelineItem } from "./types";
import {
  prFact,
  WorkerContext,
  WorkerGit,
  type WorkerGitView,
  WorkerModel,
  WorkerPr,
} from "./WorkerHeader";
import "./Spinoffs.css";
export const SpinoffContext = createContext<{
  data?: Spinoffs;
  stale?: boolean;
  open: (run: Spinoff) => void;
  /** A run whose Kerro agentille was pressed in its own view: the parent
   * conversation sends the request once it is back. */
  request?: string;
  setRequest?: (run?: string) => void;
  /** Each worker's work facts by run id, only while the person has the
   * worker-row sentence on (Kokeelliset ominaisuudet). */
  work?: ReadonlyMap<string, WorkerWork>;
  /** One panel note when gh could not say anything about pull requests. */
  workNote?: { text: string; href?: string };
  /** The person has Avustajat on (Kokeelliset ominaisuudet): named workers
   * get their own chip beside the Workers pill. */
  helpers?: boolean;
  /** Rounds of each named worker the person has seen, by run id. */
  helpersSeen?: ReadonlyMap<string, number>;
} | null>(null);

const harnessName = { pi: "Pi", claude: "Claude Code" };

/** Whether the worker can still be at work: its window may exist. */
export function workerLive(run?: Spinoff) {
  return (
    !!run &&
    (run.state === "working" ||
      run.state === "idle" ||
      run.state === "waiting_parent" ||
      run.state === "unknown")
  );
}

/** Whether the worker's run has ended in Taskfleet's own words. */
export function workerEnded(run: Spinoff) {
  return (
    run.state === "merged" || run.state === "unmerged" || run.state === "failed"
  );
}

function stateKind(run: Spinoff): StatusKind {
  if (run.state === "working") return "working";
  if (run.state === "merged") return "success";
  if (run.state === "unmerged" || run.state === "failed") return "error";
  if (run.state === "unknown") return "unknown";
  return "neutral";
}

/**
 * Instead of a composer: the person asks through the main agent, so the chip
 * goes straight to the main conversation (Jari 28.10.2026: a dialog whose
 * only action led back there was clumsy).
 */
function WorkerAsk({ run, onParent }: { run?: Spinoff; onParent: () => void }) {
  const txt = useText(spinoffsText);
  const live = workerLive(run);
  return (
    <ControlButton
      data-testid="worker-ask"
      size="inline"
      presentation="pill"
      variant="secondary"
      className="ah-worker-ask"
      onPress={onParent}
    >
      <Icon name={live ? "message" : "info"} />
      <span className="ah-worker-ask-long">
        {live ? txt.askLive : txt.askEnded}
      </span>
      <span className="ah-worker-ask-short">{txt.ask}</span>
    </ControlButton>
  );
}

/** What the worker's run ended in, from Taskfleet's own report. */
function WorkerResult({ run, onTell }: { run: Spinoff; onTell?: () => void }) {
  const txt = useText(spinoffsText);
  if (!workerEnded(run)) return null;
  const merged = run.state === "merged";
  return (
    <aside
      className="ah-worker-result"
      data-tone={merged ? "ok" : "err"}
      data-testid="spinoff-result"
      aria-label={txt.result}
    >
      <header>
        <Icon name={merged ? "merge" : "warning"} />
        <strong>
          {merged ? txt.landed(run.source_branch) : spinoffStateLabel(run)}
        </strong>
        {!merged && run.branch ? <code>{run.branch}</code> : null}
      </header>
      {run.summary ? <Markdown text={run.summary} /> : null}
      {!merged ? (
        <p className="ah-worker-recover">
          {txt.recover} <code>taskfleet run show {run.run_id}</code> ·{" "}
          <code>taskfleet run salvage {run.run_id}</code>
        </p>
      ) : null}
      {onTell ? (
        <div className="ah-worker-decide" data-testid="worker-decide">
          <p>
            <strong>{txt.decideQuestion}</strong> {txt.decide}
          </p>
          <ControlButton
            data-testid="worker-tell"
            size="row"
            variant="secondary"
            onPress={onTell}
          >
            <Icon name="message" />
            {txt.tell}
          </ControlButton>
        </div>
      ) : null}
    </aside>
  );
}

/**
 * A Taskfleet worker's view in place of its parent conversation (Kehys with
 * Pääte keskustelussa, Jari 26.10.2026): the worker's own native
 * conversation in the conversation's components, no composer, a band that
 * says whose worker this is, and the worker's terminal inside the
 * conversation: a card under the task while its history cannot be read,
 * then one row at the end.
 */
export function WorkerView({
  run,
  transcript,
  items,
  stale,
  loading = false,
  parentTitle,
  workspaceLabel,
  workspaceHref,
  terminal,
  historyArrived = false,
  work,
  git,
  context,
  model,
  onParent,
  onTell,
}: {
  run?: Spinoff;
  transcript?: WorkerTranscript;
  /** The worker's history in conversation form; empty when unreadable. */
  items: TimelineItem[];
  stale: boolean;
  loading?: boolean;
  parentTitle?: string;
  workspaceLabel: string;
  workspaceHref: string;
  /** The live worker's read-only terminal, when its window is known. */
  terminal?: ReactNode;
  /** The history became readable while this view was open. */
  historyArrived?: boolean;
  /** What the worker has produced and its pull request (spinoff-work). */
  work?: WorkerWork;
  /** The worker's Git for the header's chip; absent before anything is read. */
  git?: WorkerGitView;
  /** How full the worker's context is, from its Pi session. */
  context?: ContextUsage;
  /** The worker's model as its session names it. */
  model?: { name: string; words: string };
  onParent: () => void;
  /** Sends the parent conversation a request about this worker's work. */
  onTell?: () => void;
}) {
  const txt = useText(spinoffsText);
  const [full, setFull] = useState(false);
  const [details, setDetails] = useState(false);
  // Follow the worker's newest work, unless the reader scrolled up.
  const stream = useRef<HTMLElement>(null);
  const follow = useRef(true);
  const live = workerLive(run);
  const readable = transcript?.availability === "available";
  const harness =
    run?.harness === "pi" || run?.harness === "claude"
      ? harnessName[run.harness]
      : txt.agent;
  const toggleDetails = () => setDetails((open) => !open);
  // A fact the host could not give says why in its own chip.
  const contextUnknown =
    run?.harness === "claude"
      ? txt.header.contextClaude
      : readable
        ? txt.header.contextFirst
        : transcript?.availability === "unsupported" ||
            run?.harness === "unknown"
          ? txt.header.contextUnsupported
          : txt.header.contextUnread;
  const modelUnknown = txt.header.modelUnknown(
    readable
      ? "unnamed"
      : transcript?.availability === "unsupported" || run?.harness === "unknown"
        ? "unsupported"
        : "unread",
    run?.profile,
  );
  const pr = run && run.state !== "merged" ? work?.pull_request : undefined;
  const why = !transcript
    ? txt.historyUnread
    : transcript.availability === "unsupported"
      ? txt.unsupported(harness)
      : txt.replaces;
  const feed: (TimelineItem & { kind?: string })[] = [];
  // The brief opens the conversation whenever the history does not show it
  // itself: before it can be read, or when only its newest part is read.
  if (run?.brief && (!readable || transcript.truncated || !items.length))
    feed.push({
      id: "worker-brief",
      kind: "user",
      content: <WorkerBrief text={run.brief} />,
    });
  if (readable && transcript.truncated)
    feed.push({
      id: "worker-truncated",
      kind: "marker",
      content: <PiBoundary>{txt.truncated}</PiBoundary>,
    });
  if (readable) feed.push(...items);
  if (run?.awaiting_input && live)
    feed.push({
      id: "worker-prompt",
      kind: "marker",
      content: (
        <div className="ah-worker-prompt" role="status">
          <span>
            <Icon name="warning" />
            <strong>{txt.promptTitle}</strong>
          </span>
          {terminal ? (
            <Button
              data-testid="worker-prompt-terminal"
              size="inline"
              variant="secondary"
              label={txt.showTerminal}
              onPress={() => setFull(true)}
            />
          ) : null}
          <small>
            {txt.promptHow(<code>taskfleet run attach {run.run_id}</code>)}
          </small>
        </div>
      ),
    });
  if (live && !readable && run)
    feed.push({
      id: "worker-terminal-card",
      kind: "marker",
      content: (
        <section
          className="ah-worker-termcard"
          data-testid="worker-terminal-card"
          aria-label={txt.terminalLabel}
        >
          <header>
            <Icon name="terminal" />
            <strong>{txt.terminal}</strong>
            <span className="ah-terminal-ro">{txt.readOnly}</span>
            <span className="ah-worker-grow" />
            {terminal ? (
              <Button
                data-testid="worker-terminal-expand"
                size="row"
                variant="quiet"
                icon="expand"
                label={txt.expand}
                ariaLabel={txt.expand}
                onPress={() => setFull(true)}
              />
            ) : null}
          </header>
          {terminal && !full ? (
            <div className="ah-worker-termcard-body">{terminal}</div>
          ) : !terminal ? (
            <p className="ah-worker-termcard-none">{txt.terminalMissing}</p>
          ) : null}
          <p className="ah-worker-termcard-why">
            {transcript?.availability === "unavailable" ? (
              <span className="ah-worker-wait" aria-hidden="true" />
            ) : null}
            {why}
          </p>
        </section>
      ),
    });
  if (!live && !readable && run)
    feed.push({
      id: "worker-closed",
      kind: "marker",
      content: (
        <p className="ah-worker-closed" data-testid="worker-closed">
          <Icon name="terminal" />
          <span>
            <strong>{txt.closedTitle}</strong>{" "}
            {txt.closed(
              transcript?.availability === "unsupported" ? harness : undefined,
            )}
          </span>
        </p>
      ),
    });
  if (historyArrived && readable && live && terminal)
    feed.push({
      id: "worker-history-arrived",
      kind: "marker",
      content: (
        <p className="ah-worker-arrived" role="status">
          <Icon name="restore" />
          {txt.arrived}
        </p>
      ),
    });
  if (run && workerEnded(run))
    feed.push({
      id: "worker-result",
      kind: "marker",
      content: <WorkerResult run={run} onTell={onTell} />,
    });
  const last = feed.at(-1)?.id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new last item or a returned stream is the trigger.
  useLayoutEffect(() => {
    const el = stream.current;
    if (el && follow.current) el.scrollTop = el.scrollHeight;
  }, [last, feed.length, full, items]);
  return (
    <ConversationFrame className="ah-worker-frame">
      <div
        className="ah-worker-band"
        data-testid="worker-band"
        data-state={run?.state}
      >
        <span className="ah-worker-kind">
          <Icon name="branch" />
          {txt.worker}
        </span>
        <ControlButton
          data-testid="parent-top"
          size="inline"
          variant="quiet"
          className="ah-worker-parent"
          aria-label={txt.toParent(parentTitle ?? txt.mainAgent)}
          onPress={onParent}
        >
          <Icon name="back" />
          <span>{parentTitle || txt.mainConversation}</span>
        </ControlButton>
        {run ? (
          <span className="ah-worker-meta">
            <span>
              {harness}
              {run.profile ? ` · ${run.profile}` : ""}
            </span>
          </span>
        ) : null}
        <WorkerAsk run={run} onParent={onParent} />
      </div>
      <AgentHeader
        title={run?.title || txt.worker}
        activityLabel={run ? spinoffStateLabel(run) : ""}
        activityKind={run ? stateKind(run) : "neutral"}
        activityMark={run ? workerMark(run.state) : "loading"}
        controlLabel={txt.readOnlyControl}
        workspaceLabel={workspaceLabel}
        workspaceHref={workspaceHref}
        detailsExpanded={details}
        onToggleDetails={toggleDetails}
        gitStatus={
          run ? (
            // A fragment, not a wrapper: the header's phone readout and
            // shortening find the chips as the row's own children.
            <>
              <WorkerGit
                git={git ?? { state: "reading" }}
                source={run.source_branch}
                branchOnly={!run.git_workspace}
                onUnknown={toggleDetails}
              />
              <WorkerPr pr={pr} />
            </>
          ) : undefined
        }
        contextIndicator={
          run ? (
            <WorkerContext
              usage={context}
              unknown={contextUnknown}
              open={details}
              onToggle={toggleDetails}
            />
          ) : undefined
        }
        modelPicker={
          run ? (
            <WorkerModel
              name={model?.name}
              words={model?.words}
              unknown={modelUnknown}
              open={details}
              onToggle={toggleDetails}
            />
          ) : undefined
        }
        detailsFacts={
          run
            ? [
                {
                  label: txt.facts.parent,
                  value: parentTitle || txt.facts.unknown,
                },
                {
                  label: txt.facts.agent,
                  value: `${harness}${run.profile ? txt.facts.profile(run.profile) : ""}`,
                },
                { label: txt.facts.model, value: model?.words ?? modelUnknown },
                {
                  label: txt.facts.context,
                  value: context ? contextSentence(context) : contextUnknown,
                },
                ...(pr
                  ? [
                      {
                        label: txt.facts.pullRequest,
                        value: prFact(pr, txt.header),
                      },
                      // The phone hides the pill: the address stays copyable.
                      {
                        label: txt.facts.pullRequestUrl,
                        value: pr.url,
                        copy: true,
                      },
                    ]
                  : []),
                {
                  label: txt.facts.history,
                  value: readable
                    ? txt.facts.readable
                    : transcript?.availability === "unsupported"
                      ? txt.facts.unsupported
                      : txt.facts.notFound,
                },
                { label: txt.facts.state, value: spinoffStateLabel(run) },
                {
                  label: txt.facts.source,
                  value: run.source_branch || txt.facts.unknown,
                },
                {
                  label: txt.facts.branch,
                  value: run.branch || txt.facts.unknown,
                  copy: !!run.branch,
                },
                {
                  label: txt.facts.worktree,
                  value: run.worktree || txt.facts.unknown,
                  copy: !!run.worktree,
                },
                { label: txt.facts.run, value: run.run_id, copy: true },
              ]
            : undefined
        }
      />
      {stale ? (
        <InlineNotice
          data-testid="worker-stale"
          tone="warning"
          title={txt.stale}
        />
      ) : null}
      {full && terminal ? (
        <section
          className="ah-worker-termview"
          data-testid="worker-terminal-full"
          aria-label={txt.terminalLabel}
        >
          <header>
            <Icon name="terminal" />
            <strong>{txt.terminal}</strong>
            <span className="ah-terminal-ro">{txt.readOnly}</span>
            <span className="ah-worker-grow" />
            <Button
              data-testid="worker-terminal-close"
              size="row"
              variant="quiet"
              icon="cross"
              label={txt.back}
              ariaLabel={txt.back}
              onPress={() => setFull(false)}
            />
          </header>
          <div className="ah-worker-termview-body">{terminal}</div>
        </section>
      ) : (
        <ConversationStream
          label={txt.conversation}
          streamRef={stream}
          onScroll={() => {
            const el = stream.current;
            if (el)
              follow.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          }}
        >
          <WorkerVoice>
            <ConversationTimeline
              state={
                loading
                  ? "loading"
                  : feed.length || run
                    ? "ready"
                    : stale
                      ? "error"
                      : "empty"
              }
              items={feed}
              historyMode="pagedAccessible"
              emptyLabel={txt.empty}
              onJumpToLatest={() => {}}
              problem={{
                title: txt.problemTitle,
                description: txt.problem,
              }}
            />
          </WorkerVoice>
        </ConversationStream>
      )}
    </ConversationFrame>
  );
}

/** The task the main agent gave, first; Taskfleet's run context that opens
 * every worker's prompt only on request (Jari 28.10.2026). */
export function WorkerBrief({ text }: { text: string }) {
  const txt = useText(spinoffsText);
  const { task, context } = splitBrief(text);
  return (
    <WorkerVoice voice="brief">
      <UserMessage
        sourceText={task}
        onCopy={() => void navigator.clipboard?.writeText(text)}
      />
      {context ? (
        <details className="ah-worker-runcontext" data-testid="run-context">
          <summary>{txt.runContext}</summary>
          <Markdown text={context} />
        </details>
      ) : null}
    </WorkerVoice>
  );
}

/** Messages below speak in a worker's conversation (Pääagentti, Worker). */
export function WorkerVoice({
  voice = "worker",
  children,
}: {
  voice?: "worker" | "brief";
  children: ReactNode;
}) {
  return (
    <ConversationVoice.Provider value={voice}>
      {children}
    </ConversationVoice.Provider>
  );
}

export function useOpenSpinoff() {
  const ctx = useContext(SpinoffContext);
  return (id: string) => {
    const run = ctx?.data?.runs.find((r) => r.run_id === id);
    if (!run) return false;
    ctx?.open(run);
    return true;
  };
}
