import { useEffect, useMemo, useRef, useState } from "react";
import {
  AgentHeader,
  Button,
  Composer,
  ConversationFrame,
  ConversationStream,
  ConversationTimeline,
  HeldStartFailure,
  Icon,
  InlineNotice,
  Markdown,
  SendObservation,
  WaitingMessage,
  WorkingProgress,
} from "../components";
import { AgentTurn, ThinkingRow, type TurnStep } from "../components/AgentTurn";
import { ArchiveControls } from "../components/ArchiveControls";
import { agentPresentation } from "../components/agentPresentation";
import { BackgroundStrip } from "../components/BackgroundStrip";
import { BashToolCard } from "../components/BashToolCard";
import { controlClassName } from "../components/ControlElements";
import { CommandRun } from "../components/composer/CommandRun";
import { FileToolCard, fileStat } from "../components/FileToolCard";
import {
  ProcessAwareToolUse,
  ProcessProvider,
  ProcessStartCard,
  ProcessWaitingChip,
  useProcessView,
} from "../components/ProcessTray";
import { RecapCard } from "../components/RecapCard";
import { UnpresentedEvents } from "../components/WorkingProgress";
import { useBrowserShell } from "./BrowserShell";
import { useConversationActions } from "./ConversationActions";
import { ConversationGitStatus } from "./ConversationGitStatus";
import { readCommands, readFiles, readPreview } from "./composerReads";
import { provisionalItems } from "./conversationEvents";
import type { ConversationStore } from "./conversationStore";
import {
  abortBash,
  NotAdmitted,
  type Recap,
  readRecap,
  regenerateTitle,
  requestRecap,
  retitleHistory,
  runBash,
  type Session,
  type Status,
} from "./conversations";
import { type LiveTurnInput, timelineItems, toolTarget } from "./HistoryView";
import { piNotRunning, useHeldMessages } from "./heldMessages";
import { capacityReason } from "./mutations";
import { PendingConversation } from "./PendingConversation";
import {
  ConversationModelInfo,
  type Choice,
  PiModelSelector,
} from "./PiModelSelector";
import {
  modelDisplayName,
  shortModel,
  thinkingDisplayName,
  usePiModels,
} from "./PiModels";
import { PiQuestion } from "./PiQuestion";
import { useBridgeExpected } from "./processWarmup";
import { SpinoffProvider } from "./SpinoffConversation";
import { useStoragePressure } from "./StoragePressure";
import { latestSettings } from "./sessionSettings";
import type { Agent, Snapshot, Workspace } from "./snapshot";
import { useConversation } from "./useConversation";
import { useReadingPositionLayout } from "./useReadingPosition";
import { useSettledWarning } from "./useSettledWarning";
import { EditorHeaderControls, useEditorActivity } from "./WorkspaceEditor";

function bashCommand(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      parsed &&
      typeof parsed === "object" &&
      "command" in parsed &&
      typeof parsed.command === "string"
    )
      return parsed.command;
  } catch {
    /* Keep native text. */
  }
  return value;
}

// The status RPC retains only 64 diagnostic native events. Its loss bit is
// expected in long sessions even when the journal and native history are intact.
// Only a live turn is drawn from the event tail: a fresh or settled
// conversation reads native history, from which nothing can be missed.
export function showMissedEvents(liveTruncated: boolean, current?: Status) {
  const live =
    current?.run_active ??
    (current?.state === "accepted" || current?.state === "pending");
  return (
    !!live &&
    (liveTruncated ||
      !!(current?.event_loss && current.native_history !== "present"))
  );
}

export function BrowserConversation(
  props: Parameters<typeof BrowserConversationContent>[0],
) {
  return (
    <SpinoffProvider
      key={`${props.identity}:${props.id}`}
      parent={props.id}
      onLogin={props.onLogin}
    >
      <ProcessProvider
        key={`${props.identity}:${props.id}`}
        id={props.id}
        csrf={props.csrf}
        onLogin={props.onLogin}
        onStatusEvent={props.onStatusEvent}
      >
        <BrowserConversationContent {...props} />
      </ProcessProvider>
    </SpinoffProvider>
  );
}
function BrowserConversationContent({
  workspace,
  archive,
  onArchive,
  onClose,
  archiveBusy,
  closeBusy,
  archiveAwaitingSnapshot,
  id,
  title,
  identity,
  store,
  journalOffline,
  serverUnavailable,
  recoverySnapshot,
  onStatusEvent,
  csrf,
  onLogin,
  onSessionCreated,
}: {
  workspace: Workspace;
  archive?: Agent;
  onArchive?: (agent: Agent, archived: boolean) => Promise<boolean>;
  onClose?: (agent: Agent) => Promise<void>;
  archiveBusy?: boolean;
  closeBusy?: boolean;
  archiveAwaitingSnapshot?: boolean;
  id?: string;
  title?: string;
  identity: string;
  store: ConversationStore;
  journalOffline: boolean;
  serverUnavailable: boolean;
  recoverySnapshot?: Snapshot;
  onStatusEvent: (
    listener: (
      id: string,
      kind: string,
      payload?: Record<string, unknown>,
    ) => void,
  ) => () => void;
  csrf?: string;
  onLogin: () => void;
  onSessionCreated: (session: Session) => void;
}) {
  const {
    current,
    statusStale,
    opened,
    setOpenAttempt,
    entries,
    next,
    historyRevision,
    draft,
    receipt,
    sendObservation,
    problem,
    busy,
    continuation,
    events,
    live,
    confirmStop,
    setConfirmStop,
    workingMode,
    setWorkingMode,
    finishedInBackground,
    details,
    setDetails,
    section,
    focusedOnOpen,
    feed,
    wasAtBottom,
    readingAnchor,
    unseen,
    setUnseen,
    awayFromLatest,
    setAwayFromLatest,
    captureAnchor,
    restoreAnchor,
    ambiguous,
    alive,
    generation,
    submittedKey,
    sendKey,
    uncertainKey,
    inFlightSend,
    changeDraft,
    refresh,
    setBusy,
    setReceipt,
    setSendObservation,
    setContinuation,
    navigate,
    historyError,
    cutOff,
  } = useConversation({
    workspace,
    id,
    identity,
    store,
    journalOffline,
    recoverySnapshot,
    onStatusEvent,
    onLogin,
  });
  const storagePressure = useStoragePressure();
  useEffect(() => {
    if (storagePressure.check) void refresh(true, true);
  }, [storagePressure.check, refresh]);
  const visibleHistoryError = useSettledWarning(
    historyError,
    `${identity}/${id ?? ""}`,
  );
  const visibleRecovery = useSettledWarning(
    !!(
      (ambiguous && !busy && sendObservation?.state !== "pending") ||
      current?.state === "uncertain" ||
      historyError ||
      (continuation && !["ready", "pending"].includes(continuation))
    ),
    `${identity}/${id ?? ""}`,
  );
  const nativeSettings = latestSettings(entries);
  const [modelExpanded, setModelExpanded] = useState(false);
  const [modelChoice, setModelChoice] = useState<Choice>();
  const [modelBlocked, setModelBlocked] = useState(false);
  const [chipOpen, setChipOpen] = useState(false);
  const { data: models } = usePiModels();
  const emptyConversation = !entries.some((e) => e.kind === "user");
  const canChooseFirstModel =
    emptyConversation && !current?.command_id && !busy && !ambiguous;
  const selectedModel =
    (emptyConversation && modelChoice
      ? `${modelChoice.provider ?? "openai-codex"}/${modelChoice.model}`
      : undefined) ??
    nativeSettings.model ??
    (current?.startup_choice
      ? `${current.startup_choice.provider ?? "openai-codex"}/${current.startup_choice.model}`
      : undefined);
  const displayModel =
    shortModel(
      selectedModel ?? (!id ? (models?.default_model ?? undefined) : undefined),
    ) ?? "Malli ei tiedossa";
  const selectedThinking =
    (emptyConversation ? modelChoice?.thinking : undefined) ??
    nativeSettings.thinking ??
    current?.startup_choice?.thinking ??
    (!id ? models?.default_thinking : undefined);
  const emptyPicker = useRef<HTMLDetailsElement>(null);
  // Choices are transient intents, never preferences shared across workspaces.
  // biome-ignore lint/correctness/useExhaustiveDependencies: route change resets local picker state.
  useEffect(() => {
    setModelChoice(undefined);
    setModelBlocked(false);
    setModelExpanded(false);
    setChipOpen(false);
  }, [workspace.workspace_id, id]);
  useReadingPositionLayout({
    entries,
    live,
    // The queue card above the field changes the reading area's height.
    queueOpen:
      (current?.queue?.steering.length ?? 0) +
        (current?.queue?.follow_up.length ?? 0) >
      0,
    receipt,
    problem,
    details,
    confirmStop,
    currentState: current?.state,
    events,
    feed,
    wasAtBottom,
    readingAnchor,
    restoreAnchor,
    setUnseen,
  });
  const userScrollIntent = useRef(0);
  // Only reader input can suspend following. Layout-induced scrolls (including
  // the browser clamping scrollTop when work collapses) are not reader input.
  // biome-ignore lint/correctness/useExhaustiveDependencies: opened binds listeners when the stream mounts.
  useEffect(() => {
    const viewport = feed.current;
    if (!viewport) return;
    let intentTimer: number | undefined;
    const intent = () => {
      userScrollIntent.current = Date.now();
      window.clearTimeout(intentTimer);
      intentTimer = window.setTimeout(() => {
        if (wasAtBottom.current) viewport.scrollTop = viewport.scrollHeight;
        userScrollIntent.current = 0;
      }, 650);
    };
    const atEnd = () =>
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 1;
    const wheel = (event: WheelEvent) => {
      if (event.deltaY < 0 || !atEnd()) intent();
    };
    let touchY = 0;
    const touchstart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? 0;
    };
    const touchmove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? 0;
      if (y > touchY || !atEnd()) intent();
      touchY = y;
    };
    const keys = (event: KeyboardEvent) => {
      if (
        ["ArrowUp", "PageUp", "Home"].includes(event.key) ||
        (["ArrowDown", "PageDown", "End", " "].includes(event.key) && !atEnd())
      )
        intent();
    };
    const toggle = () => {
      userScrollIntent.current = 0;
      wasAtBottom.current = false;
      setAwayFromLatest(
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight >
          120,
      );
    };
    const scrollbar = (event: PointerEvent) => {
      if (event.target === viewport) intent();
    };
    viewport.addEventListener("wheel", wheel, { passive: true });
    viewport.addEventListener("touchstart", touchstart, { passive: true });
    viewport.addEventListener("touchmove", touchmove, { passive: true });
    viewport.addEventListener("pointerdown", scrollbar);
    viewport.addEventListener("keydown", keys);
    viewport.addEventListener("ah:work-toggle", toggle);
    return () => {
      window.clearTimeout(intentTimer);
      viewport.removeEventListener("wheel", wheel);
      viewport.removeEventListener("touchstart", touchstart);
      viewport.removeEventListener("touchmove", touchmove);
      viewport.removeEventListener("pointerdown", scrollbar);
      viewport.removeEventListener("keydown", keys);
      viewport.removeEventListener("ah:work-toggle", toggle);
    };
  }, [feed, id, opened, wasAtBottom, setAwayFromLatest]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Rebind when native entries mount the stream; the ref itself is stable.
  useEffect(() => {
    const viewport = feed.current;
    if (!viewport) return;
    const update = () => {
      // Growth keeps a following view at the bottom. A stale intent without a
      // resulting scroll expires, such as a downward wheel nudge at the end.
      if (wasAtBottom.current && Date.now() - userScrollIntent.current >= 600)
        viewport.scrollTop = viewport.scrollHeight;
      setAwayFromLatest(
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight >
          120,
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    for (const child of viewport.children) observer.observe(child);
    update();
    return () => observer.disconnect();
  }, [feed, id, opened, entries.length, wasAtBottom]);
  useEffect(() => {
    if (!finishedInBackground) return;
    const old = document.title;
    document.title = `Agentti tarvitsee huomiota · ${old}`;
    return () => {
      document.title = old;
    };
  }, [finishedInBackground]);
  const controlled =
    opened && !!current && current.workspace_id === workspace.workspace_id;
  // The workspace's shells: the top bar's toggle and the dock under the
  // composer. Vie keskusteluun adds a selection to this draft, unsent.
  const shell = useBrowserShell({
    workspaceId: workspace.workspace_id,
    workspaceLabel: workspace.display_name ?? workspace.name,
    csrf,
    onLogin,
    onSendToConversation: controlled
      ? (text) => {
          const fence = text.includes("```") ? "````" : "```";
          const block = `${fence}\n${text}\n${fence}\n`;
          changeDraft(
            draft.trim() ? `${draft.replace(/\s*$/, "\n\n")}${block}` : block,
          );
          requestAnimationFrame(() => {
            const field = document.querySelector<HTMLTextAreaElement>(
              ".ah-conversation-frame .ah-composer textarea",
            );
            field?.focus();
            field?.setSelectionRange(field.value.length, field.value.length);
          });
        }
      : undefined,
  });
  const [questionOutcome, setQuestionOutcome] = useState<
    "uncertain" | "stale" | null
  >(null);
  const [titleActionState, setTitleActionState] = useState<{
    key: string;
    version: number;
    pending: boolean;
    error: boolean;
  } | null>(null);
  const titleActionKey = `${identity}/${workspace.workspace_id}/${id ?? ""}`;
  const titleStateCurrent =
    titleActionState?.key === titleActionKey &&
    titleActionState.version === generation.current;
  const titlePending = !!titleStateCurrent && titleActionState.pending;
  const titleError = !!titleStateCurrent && titleActionState.error;
  const [recapView, setRecapView] = useState<{
    key: string;
    recap: Recap | null;
    latest: string;
    unavailable: boolean;
  } | null>(null);
  const [recapAction, setRecapAction] = useState<{
    key: string;
    pending: boolean;
    error: boolean;
    uncertain: boolean;
  } | null>(null);
  const recapKey = `${identity}/${id ?? ""}`;
  const newestKey = entries.at(-1)?.entry_key;
  useEffect(() => {
    // A new native history entry can make a previously current recap stale.
    if (!id || !opened || !newestKey) return;
    // A recap is a native custom entry: revision changes without a new message key.
    void historyRevision;
    let cancelled = false;
    void readRecap(id)
      .then((result) => {
        if (!cancelled) {
          setRecapView({
            key: recapKey,
            recap: result.recap,
            latest: result.latest_message,
            unavailable: false,
          });
          if (result.recap?.through === result.latest_message)
            setRecapAction((previous) =>
              previous?.key === recapKey && previous.uncertain
                ? {
                    key: recapKey,
                    pending: false,
                    error: false,
                    uncertain: false,
                  }
                : previous,
            );
        }
      })
      .catch(() => {
        if (!cancelled)
          setRecapView((previous) => ({
            key: recapKey,
            recap: previous?.key === recapKey ? previous.recap : null,
            latest: previous?.key === recapKey ? previous.latest : "",
            unavailable: true,
          }));
      });
    return () => {
      cancelled = true;
    };
  }, [id, opened, recapKey, newestKey, historyRevision]);
  const recapCurrent = recapView?.key === recapKey ? recapView : null;
  const [recapNow, setRecapNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setRecapNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const [dismissedRecap, setDismissedRecap] = useState("");
  const dismissalKey = `oh:recap-dismissed:${recapKey}`;
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === dismissalKey)
        setDismissedRecap(`${dismissalKey}:${event.newValue ?? ""}`);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [dismissalKey]);
  const recapFingerprint = recapCurrent?.recap
    ? `${recapCurrent.recap.through}:${recapCurrent.recap.generated_at}`
    : "";
  let storedDismissal = "";
  try {
    storedDismissal = localStorage.getItem(dismissalKey) ?? "";
  } catch {
    /* Browser storage can be denied. */
  }
  const recapDismissed =
    !!recapFingerprint &&
    (dismissedRecap === `${dismissalKey}:${recapFingerprint}` ||
      storedDismissal === recapFingerprint);
  const dismissRecapOnSend = () => {
    if (!recapFingerprint) return;
    setDismissedRecap(`${dismissalKey}:${recapFingerprint}`);
    try {
      localStorage.setItem(dismissalKey, recapFingerprint);
    } catch {
      /* Keep it dismissed in this tab. */
    }
  };
  const recapBusy = recapAction?.key === recapKey && recapAction.pending;
  const recapError = recapAction?.key === recapKey && recapAction.error;
  const recapUncertain = recapAction?.key === recapKey && recapAction.uncertain;

  const { start, submit, submitQueue, clearNativeQueue, stopNow, notices } =
    useConversationActions({
      firstChoice: canChooseFirstModel ? modelChoice : undefined,
      workspace,
      id,
      csrf,
      ambiguous,
      busy,
      current,
      draft,
      receipt,
      sendObservation,
      problem,
      serverUnavailable,
      alive,
      generation,
      submittedKey,
      sendKey,
      uncertainKey,
      inFlightSend,
      setBusy,
      setReceipt,
      setSendObservation,
      setConfirmStop,
      changeDraft,
      refresh,
      onLogin,
      onSessionCreated,
      navigate,
    });
  const held = useHeldMessages({
    id,
    identity,
    workspaceId: workspace.workspace_id,
    csrf,
    current,
    entries,
    draft,
    changeDraft,
    refresh: () => refresh(false, true),
    onLogin,
  });
  // Pi is not running: a send is held by the daemon and starts Pi. A previous
  // uncertain send does not block a new message then; it is never resent.
  const notStarted = piNotRunning(current?.state);
  const bridgeExpected = useBridgeExpected(
    notStarted,
    useProcessView()?.inventory,
  );
  const waitingForPi =
    notStarted && held.waiting.some((w) => w.state === "waiting");
  const startFailed =
    current?.state === "start_failed" &&
    held.waiting.some((w) => w.state === "failed");
  useEffect(() => {
    if (!held.notice) return;
    const timer = window.setTimeout(() => held.setNotice(""), 6000);
    return () => window.clearTimeout(timer);
  }, [held.notice, held.setNotice]);
  const canSend =
    controlled &&
    archive?.archive !== "archived" &&
    archive?.archive !== "unknown" &&
    !busy &&
    !held.busy &&
    (!ambiguous || notStarted) &&
    !statusStale &&
    !serverUnavailable &&
    !modelBlocked &&
    current?.auth_error !== "pi_model_unsupported" &&
    !problem &&
    (current.state === "idle" ||
      current.state === "rejected" ||
      current.state === "accepted" ||
      notStarted);
  // Stop is immediate and asks nothing (Jari 13.10.). Pi keeps its queue over
  // an abort, so the queued messages are first taken back into the field, as
  // Pi's TUI does on Esc, instead of waiting for the next turn.
  const stopPi = async () => {
    if (
      (current?.queue?.steering.length ?? 0) +
      (current?.queue?.follow_up.length ?? 0)
    )
      await clearNativeQueue();
    await stopNow();
  };
  const queueRestoreAvailability =
    !busy &&
    !ambiguous &&
    !statusStale &&
    !serverUnavailable &&
    current?.queue &&
    current.state !== "pending" &&
    current.state !== "uncertain" &&
    current.state !== "stopping"
      ? ({ state: "enabled" } as const)
      : ({ state: "unknown", reason: "Odota vahvistettua tilaa." } as const);
  const bash = current?.bash ?? undefined;
  const [bashBusy, setBashBusy] = useState(false);
  const runCommand = async (command: string, exclude: boolean) => {
    if (!current || !csrf || bashBusy) return;
    const commandId = crypto.randomUUID();
    setBashBusy(true);
    try {
      await runBash(current.agent_id, command, exclude, commandId, csrf);
      // The field clears after a run, as in Pi's TUI; the command and its
      // output are now Pi's.
      if (alive.current) changeDraft("");
    } catch (error) {
      if ((error as Error).message === "identity_lost") onLogin();
      else if (alive.current)
        setReceipt(
          error instanceof NotAdmitted
            ? "Komentoa ei ajettu. Edellinen komento voi olla vielä käynnissä; tarkista tila."
            : "Komennon tulos epävarma. Tarkista tila; komentoa ei ajeta uudelleen.",
        );
    } finally {
      if (alive.current) {
        setBashBusy(false);
        void refresh();
      }
    }
  };
  const [bashStop, setBashStop] = useState<{
    id: string;
    state: "pending" | "uncertain";
  }>();
  const bashStopState =
    bashStop?.id === bash?.command_id &&
    (bash?.state === "running" || bash?.state === "held")
      ? statusStale || serverUnavailable
        ? "uncertain"
        : bashStop?.state
      : undefined;
  const stopCommand = async () => {
    if (!current || !csrf || bashBusy || bashStopState || !bash) return;
    setBashStop({ id: bash.command_id, state: "pending" });
    setBashBusy(true);
    try {
      await abortBash(current.agent_id, crypto.randomUUID(), csrf);
    } catch (error) {
      if ((error as Error).message === "identity_lost") onLogin();
      else if (alive.current) {
        setBashStop({ id: bash.command_id, state: "uncertain" });
        setReceipt(
          "Komennon pysäytyksen tulos epävarma. Tarkista tila; pyyntöä ei lähetetä uudelleen.",
        );
      }
    } finally {
      if (alive.current) {
        setBashBusy(false);
        void refresh();
      }
    }
  };
  // A command whose Pi did not start, or whose outcome is unknown, is said
  // once; it is never run again.
  const toldBash = useRef("");
  useEffect(() => {
    if (!bash || toldBash.current === bash.command_id) return;
    if (bash.state === "not_started" || bash.state === "uncertain") {
      toldBash.current = bash.command_id;
      setReceipt(
        bash.state === "not_started"
          ? `Komentoa ${bash.command} ei ajettu: agentti ei käynnistynyt tai komento otettiin takaisin.`
          : `Komennon ${bash.command} tulos ei tiedossa. Komentoa ei ajeta uudelleen.`,
      );
    }
  }, [bash, setReceipt]);
  const runWorkspace = current?.workspace_id ?? workspace.workspace_id;
  const workspacePath = workspace.place
    ? undefined
    : workspace.path?.match(/\/src\/.+$/)?.[0];
  const composerShell =
    controlled && csrf
      ? {
          workspaceLabel: workspacePath
            ? `~${workspacePath}`
            : (workspace.display_name ?? workspace.name),
          running:
            bash && (bash.state === "held" || bash.state === "running")
              ? {
                  command: bash.command,
                  excludeFromContext: bash.exclude_from_context,
                  state: bash.state,
                  startedAt: bash.started_at
                    ? Date.parse(bash.started_at)
                    : undefined,
                }
              : undefined,
          onRun: (command: string, exclude: boolean) =>
            void runCommand(command, exclude),
          onStop: () => void stopCommand(),
          stopState: bashStopState,
          runAvailability:
            canSend && !bashBusy
              ? ({ state: "enabled" } as const)
              : ({
                  state: "unknown",
                  reason: "Odota vahvistettua tilaa.",
                } as const),
        }
      : undefined;
  const sourcesKey = `${current?.agent_id ?? ""}|${runWorkspace}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: one source per conversation and workspace.
  const composerSources = useMemo(
    () => ({
      commands: (signal: AbortSignal) =>
        readCommands(
          current?.agent_id
            ? { agentId: current.agent_id }
            : { workspaceId: runWorkspace },
          signal,
        ),
      files: (query: string, signal: AbortSignal) =>
        readFiles(runWorkspace, query, signal),
      preview: (path: string, signal: AbortSignal) =>
        readPreview(runWorkspace, path, signal),
      workspaceName: workspace.display_name ?? workspace.name,
    }),
    [sourcesKey],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs are only used for the first opening focus.
  useEffect(() => {
    if (!id || !controlled || focusedOnOpen.current) return;
    focusedOnOpen.current = true;
    if (document.activeElement === document.body)
      section.current
        ?.querySelector("textarea")
        ?.focus({ preventScroll: true });
  }, [id, controlled]);
  const presentation = agentPresentation({
    process: statusStale ? "stale" : "daemon_managed_live",
    command: current && !statusStale ? current.state : undefined,
    runActive: statusStale ? undefined : current?.run_active,
    waitingOn: archive?.waiting_on,
    pendingQuestion: !statusStale && !!current?.pending_question,
  });
  useEditorActivity(
    presentation.activity === "working",
    presentation.activityShortLabel,
  );
  const liveItems = provisionalItems(
    live ?? {
      cursor: "",
      instance: "",
      sequence: 0,
      fragments: [],
      truncated: true,
    },
  );
  // A tool already joined into native history still owns live activity until
  // its result arrives. Filtering its duplicate row must not imply an answer.
  const activeToolName = liveItems.find(
    (item) => item.kind === "tool" && item.state === "running",
  )?.name;
  const savedCalls = new Set(
    entries.flatMap(
      (entry) =>
        entry.blocks?.flatMap((block) =>
          block.type === "toolCall" && block.tool_call_id
            ? [block.tool_call_id]
            : [],
        ) ?? [],
    ),
  );
  // Mid-turn, saved messages arrive by history re-read while their streamed
  // fragments stay until the turn settles. A message whose tool call is saved
  // is saved whole, so its streamed text and reasoning are not shown twice.
  const lastSaved = liveItems.findLastIndex(
    (item) =>
      item.kind === "tool" && !!item.callId && savedCalls.has(item.callId),
  );
  // The person's `!` command streams into its own block, not Pi's turn, until
  // Pi's history entry for it arrives (and retires its streamed output).
  const bashOutput = liveItems
    .filter((item) => item.kind === "bash")
    .map((item) => item.text)
    .join("");
  const showRun =
    !!bash &&
    (bash.state === "held" ||
      bash.state === "running" ||
      (bashOutput !== "" &&
        (bash.state === "finished" || bash.state === "cancelled")));
  const provisional = liveItems.filter(
    (item, index) =>
      !(showRun && item.kind === "bash") &&
      !(item.kind === "tool" && item.callId && savedCalls.has(item.callId)) &&
      !(
        index < lastSaved &&
        (item.kind === "assistant" || item.kind === "thinking")
      ),
  );
  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => {
    if (
      !(
        current?.run_active ??
        (current?.state === "accepted" || current?.state === "working")
      )
    )
      return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [current?.state, current?.run_active]);
  const started = live?.fragments.find(
    (event) =>
      event.kind === "pi.lifecycle" && event.payload.signal === "turn_start",
  );
  const fallbackClock = useRef({ key: "", at: Date.now() });
  const turnClockKey = `${id ?? ""}:${current?.command_id || started?.event_id || liveItems[0]?.id || ""}`;
  if (fallbackClock.current.key !== turnClockKey)
    fallbackClock.current = { key: turnClockKey, at: Date.now() };
  const nativeStart = started ? Date.parse(started.emitted_at) : NaN;
  const liveWorking = !!(
    current?.run_active ??
    (current?.state === "working" || current?.state === "accepted")
  );
  const elapsed =
    provisional.length || liveWorking
      ? Math.max(
          0,
          Math.floor(
            (clockNow -
              (Number.isFinite(nativeStart)
                ? nativeStart
                : fallbackClock.current.at)) /
              1000,
          ),
        )
      : undefined;
  const duration =
    elapsed !== undefined && Number.isFinite(elapsed)
      ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`
      : undefined;
  const last = provisional.at(-1);
  const liveNode = (item: (typeof provisional)[number]) => (
    <div key={item.id} className="ah-live-work">
      {item.kind === "thinking" ? (
        <ThinkingRow text={item.text} live />
      ) : item.kind === "tool" ? (
        <ProcessAwareToolUse
          argumentsText={item.arguments}
          result={item.output}
          failureCause={item.failureCause}
          name={item.name ?? "Työkalu"}
          stat={fileStat(
            item.name ?? "",
            item.arguments ?? "",
            item.output,
            item.state === "failed",
          )}
          expansion={
            id && item.callId ? store.toolExpansion(id, item.callId) : undefined
          }
          targetText={
            item.name === "bash"
              ? bashCommand(item.arguments ?? "").split("\n")[0]
              : undefined
          }
          state={
            (item.state as "running" | "succeeded" | "failed" | "cancelled") ??
            "forming"
          }
        >
          {item.name === "process" ? (
            <ProcessStartCard
              argumentsText={item.arguments ?? ""}
              result={item.output}
            />
          ) : item.name === "bash" ? (
            <BashToolCard
              command={bashCommand(item.arguments ?? "")}
              output={item.output}
              failureCause={item.failureCause}
              running={item.state === "running"}
            />
          ) : ["read", "write", "edit"].includes(item.name ?? "") ? (
            <FileToolCard
              name={item.name ?? ""}
              argumentsText={item.arguments ?? ""}
              output={item.output}
              failed={item.state === "failed"}
            />
          ) : item.arguments ? (
            <pre>{item.arguments}</pre>
          ) : null}
          {!["bash", "process", "read", "write", "edit"].includes(
            item.name ?? "",
          ) && item.output ? (
            <pre>{item.output}</pre>
          ) : null}
        </ProcessAwareToolUse>
      ) : item.kind === "bash" ? (
        <details>
          <summary>Paikallisen komennon tuloste · käynnissä</summary>
          <pre>{item.text}</pre>
        </details>
      ) : storagePressure.full ? null : (
        <InlineNotice
          title={
            item.kind === "bash"
              ? "Paikallisen komennon tuloste"
              : item.kind === "extension"
                ? "Laajennuksen ilmoitus"
                : "Agentin tila"
          }
          description={item.text}
        />
      )}
    </div>
  );
  const liveTurn: LiveTurnInput | undefined =
    liveWorking || provisional.length
      ? {
          working: liveWorking,
          activity: activeToolName
            ? `Ajaa ${activeToolName}`
            : last?.kind === "tool" && last.name
              ? `Ajaa ${last.name}`
              : last?.kind === "thinking"
                ? "Ajattelee"
                : "Vastaa",
          duration,
          steps: provisional.map(
            (item): TurnStep =>
              item.kind === "assistant"
                ? {
                    kind: "text",
                    key: item.id,
                    text: item.text,
                    node: <Markdown text={item.text} />,
                  }
                : item.kind === "thinking"
                  ? { kind: "thinking", key: item.id, node: liveNode(item) }
                  : item.kind === "tool"
                    ? {
                        kind: "tool",
                        key: item.id,
                        target: toolTarget(item.name, item.arguments),
                        failed: item.state === "failed",
                        node: liveNode(item),
                      }
                    : { kind: "other", key: item.id, node: liveNode(item) },
          ),
        }
      : undefined;
  const timeline = timelineItems(
    entries,
    onLogin,
    id,
    historyRevision,
    new Map(
      provisionalItems(
        live ?? {
          cursor: "",
          instance: "",
          sequence: 0,
          fragments: [],
          truncated: true,
        },
      ).flatMap((item) =>
        item.kind === "tool" && item.callId
          ? [[item.callId, item] as const]
          : [],
      ),
    ),
    id ? (callId) => store.toolExpansion(id, callId) : undefined,
    liveTurn,
  );
  const liveMerged = timeline.some((item) => item.live);
  return (
    <section ref={section} className="ah-reading-view">
      {!id ? (
        <>
          <h2>Agenttikeskustelut</h2>
          <details className="md-new">
            <summary
              className={`md-new-toggle ${controlClassName({ size: "row", text: true })}`}
            >
              {displayModel} · {selectedThinking ?? "Agentti"}
            </summary>
            <PiModelSelector
              csrf={csrf}
              scope="new"
              current={selectedModel}
              currentThinking={selectedThinking}
              onChoice={setModelChoice}
              onBlocked={setModelBlocked}
            />
          </details>
          <fieldset className="ah-actions ah-conversation-actions">
            <legend className="ah-visually-hidden">
              Agenttikeskustelun toiminnot
            </legend>
            <Button
              size="page"
              label="Aloita uusi agenttikeskustelu"
              availability={
                modelBlocked
                  ? {
                      state: "disabled",
                      reason:
                        "Valitse toinen malli ennen uuden keskustelun aloittamista.",
                    }
                  : !csrf
                    ? {
                        state: "unknown",
                        reason: problem
                          ? "Istuntoa ei voitu vahvistaa."
                          : "Ladataan istuntoa.",
                      }
                    : ambiguous
                      ? {
                          state: "unknown",
                          reason: "Edellisen luonnin tulos on epävarma.",
                        }
                      : busy
                        ? { state: "unknown", reason: "Luonti on käynnissä." }
                        : serverUnavailable
                          ? {
                              state: "unknown",
                              reason: "Palvelinyhteys katkesi.",
                            }
                          : { state: "enabled" }
              }
              onPress={() => void start(modelChoice)}
            />
          </fieldset>
        </>
      ) : !opened ? (
        <PendingConversation
          workspace={workspace}
          message="Ladataan keskustelua…"
          problem={problem}
          onRetry={() => setOpenAttempt((n) => n + 1)}
          value={draft}
          onChange={changeDraft}
        />
      ) : (
        <ConversationFrame>
          <AgentHeader
            editorControl={<EditorHeaderControls />}
            archiveControl={
              <ArchiveControls
                state={archive?.archive ?? "unknown"}
                empty={
                  entries.length === 0 &&
                  !historyError &&
                  !next &&
                  !!current &&
                  current.native_history !== "unavailable"
                }
                blockedReason={
                  archiveAwaitingSnapshot
                    ? "Odotetaan arkiston tilan vahvistusta."
                    : archive
                      ? undefined
                      : "Ladataan arkiston tilaa."
                }
                eligible={
                  !busy &&
                  !statusStale &&
                  !serverUnavailable &&
                  (current?.state === "idle" ||
                    (current?.state === "stopped" && !held.waiting.length) ||
                    current?.continuation === "eligible")
                }
                busy={!!archiveBusy || !!closeBusy}
                onArchive={() => {
                  if (archive) void onArchive?.(archive, true);
                }}
                onClose={
                  archive &&
                  controlled &&
                  csrf &&
                  !serverUnavailable &&
                  !statusStale &&
                  current?.state === "idle" &&
                  !busy
                    ? () => {
                        // Close removes this view immediately. Fence in-flight
                        // status reads before they can turn its expected 404
                        // into a late navigation back to deleted history.
                        alive.current = false;
                        ++generation.current;
                        void onClose?.(archive);
                      }
                    : undefined
                }
                onRestore={() => {
                  if (archive) void onArchive?.(archive, false);
                }}
              />
            }
            title={title ?? "Uusi keskustelu"}
            titleAction={{
              label: "Luo uusi otsikko",
              availability:
                entries.length === 0
                  ? {
                      state: "disabled",
                      reason: "Keskustelussa ei ole vielä nimettävää sisältöä.",
                    }
                  : !controlled ||
                      !csrf ||
                      statusStale ||
                      serverUnavailable ||
                      problem
                    ? {
                        state: "disabled",
                        reason: "Ohjaus ei ole käytettävissä.",
                      }
                    : { state: "enabled" },
              pending: titlePending,
              onPress: () => {
                if (
                  !id ||
                  !csrf ||
                  !controlled ||
                  entries.length === 0 ||
                  titlePending
                )
                  return;
                const key = titleActionKey;
                const version = generation.current;
                setTitleActionState({
                  key,
                  version,
                  pending: true,
                  error: false,
                });
                // A restored conversation has no live RPC handle. Use the
                // native-history operation, which proves there is no writer;
                // never retry a failed live write through the other operation.
                const operation =
                  current?.state === "stopped" ||
                  current?.state === "start_failed"
                    ? retitleHistory(id, workspace.workspace_id, csrf)
                    : regenerateTitle(id, csrf);
                void operation
                  .then(() => {
                    if (generation.current !== version || !alive.current)
                      return;
                    setTitleActionState((previous) =>
                      previous?.key === key
                        ? { key, version, pending: false, error: false }
                        : previous,
                    );
                  })
                  .catch(() => {
                    if (generation.current !== version || !alive.current)
                      return;
                    setTitleActionState((previous) =>
                      previous?.key === key
                        ? { key, version, pending: false, error: true }
                        : previous,
                    );
                  });
              },
            }}
            activityLabel={
              // No top-bar state while messages wait for Pi: the dashed
              // bubble says it (Jari 16.10.2026).
              notStarted && held.waiting.length
                ? ""
                : (presentation.operationLabel ?? presentation.activityLabel)
            }
            activityControl={
              presentation.activity === "waiting_process" ||
              presentation.activity === "waiting_spinoff" ? (
                <ProcessWaitingChip label={presentation.activityLabel} />
              ) : undefined
            }
            activityKind={
              presentation.activity === "working"
                ? "working"
                : presentation.activity === "unknown"
                  ? "unknown"
                  : "neutral"
            }
            settings={nativeSettings}
            terminal={shell.toggle}
            gitStatus={
              <ConversationGitStatus
                workspace={workspace}
                csrf={csrf}
                working={presentation.activity === "working"}
              />
            }
            modelPicker={
              emptyConversation ? (
                <span
                  className={`ah-set-chip ${controlClassName({ size: "inline", presentation: "pill" })}`}
                >
                  {modelDisplayName(selectedModel)} <Icon name="thinking" />{" "}
                  {thinkingDisplayName(selectedThinking)}
                </span>
              ) : (
                // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Native details closes on Escape bubbling from its controls.
                <details
                  className="md-chip-picker"
                  key={id}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.currentTarget.open = false;
                      setChipOpen(false);
                      event.currentTarget.querySelector("summary")?.focus();
                    }
                  }}
                  onToggle={(event) => setChipOpen(event.currentTarget.open)}
                >
                  <summary
                    className={`ah-set-chip ${controlClassName({ size: "inline", presentation: "pill" })}`}
                    aria-label={`Malli ja ajattelutaso: ${modelDisplayName(selectedModel)}, ${thinkingDisplayName(selectedThinking)}`}
                  >
                    {modelDisplayName(selectedModel)} <Icon name="thinking" />{" "}
                    {thinkingDisplayName(selectedThinking)}
                  </summary>
                  <div className="md-pop">
                    {chipOpen ? (
                      <ConversationModelInfo
                        model={selectedModel}
                        thinking={selectedThinking}
                      />
                    ) : null}
                  </div>
                </details>
              )
            }
            detailsExtra={
              <Button
                label="Oletusmallin asetukset"
                variant="quiet"
                size="row"
                onPress={() => navigate("/settings")}
              />
            }
            detailsFacts={[
              ...(workspace.place
                ? [
                    {
                      label: "Työtila",
                      value: workspace.place.parent.path ?? "Ei tiedossa",
                      copy: !!workspace.place.parent.path,
                    },
                    {
                      label: "Worktree",
                      value: workspace.path || "Ei tiedossa",
                      copy: !!workspace.path,
                    },
                    {
                      label: "Haara",
                      value: workspace.place.worktree.branch ?? "Ei tiedossa",
                    },
                  ]
                : [
                    {
                      label: "Työtila",
                      value: workspace.path ?? "Ei tiedossa",
                      copy: !!workspace.path,
                    },
                  ]),
              {
                label: "Malli",
                value: nativeSettings.model ?? "Agentin oletus",
                copy: !!nativeSettings.model,
              },
              {
                label: "Ajattelutaso",
                value: nativeSettings.thinking ?? "Agentin oletus",
              },
              {
                label: "Ohjaus",
                value: controlled ? "Selainohjaus" : "Ei käytettävissä",
              },
              {
                label: "Aloitettu",
                value: archive?.started_at
                  ? new Date(archive.started_at).toLocaleString("fi-FI")
                  : "Ei tiedossa",
              },
              { label: "Natiivi tunniste", value: id, copy: true },
            ]}
            controlKind={controlled ? "neutral" : "read-only"}
            controlLabel={
              controlled ? "Selainohjaus" : "Ohjaus ei ole käytettävissä"
            }
            workspaceLabel={workspace.display_name ?? workspace.name}
            workspaceHref={`/workspaces/${(workspace.place?.parent ?? workspace).workspace_id}`}
            detailsExpanded={details}
            onToggleDetails={() => {
              setDetails(!details);
              setModelExpanded(false);
            }}
          />
          <ConversationStream
            streamRef={feed}
            onScroll={() => {
              const el = feed.current;
              if (!el) return;
              const atBottom =
                el.scrollHeight - el.scrollTop - el.clientHeight < 60;
              if (atBottom) {
                wasAtBottom.current = true;
                setAwayFromLatest(false);
                userScrollIntent.current = 0;
                readingAnchor.current = undefined;
                if (id) store.savePosition(id);
                setUnseen(0);
              } else {
                if (Date.now() - userScrollIntent.current < 600) {
                  userScrollIntent.current = 0;
                  wasAtBottom.current = false;
                  setAwayFromLatest(
                    el.scrollHeight - el.scrollTop - el.clientHeight > 120,
                  );
                }
                captureAnchor();
              }
            }}
          >
            {next ? (
              <div className="ah-history-pager">
                <Button
                  size="row"
                  label="Lataa vanhempi historiasivu"
                  onPress={() => {
                    captureAnchor();
                    void store.older(id);
                  }}
                />
              </div>
            ) : null}
            {storagePressure.full ? null : (
              <UnpresentedEvents events={events} />
            )}
            {cutOff && (
              <InlineNotice
                tone="warning"
                title="Keskustelun loppu katkesi"
                description="Näytetään kokonaan tallentuneet viestit. Alkuperäistä tiedostoa ei ole muutettu. Voit jatkaa uudessa keskustelussa."
                actions={[
                  {
                    label: "Uusi keskustelu",
                    onPress: () =>
                      navigate(`/workspaces/${workspace.workspace_id}`),
                  },
                ]}
              />
            )}
            <ConversationTimeline
              state={
                visibleHistoryError && !storagePressure.full
                  ? entries.length
                    ? "stale"
                    : "error"
                  : entries.length || held.waiting.length
                    ? "ready"
                    : "empty"
              }
              items={[
                ...timeline,
                ...(sendObservation
                  ? [
                      {
                        id: "send-observation",
                        kind: "receipt",
                        content: (
                          <SendObservation
                            text={sendObservation.text}
                            state={sendObservation.state}
                            showText
                            onCopy={() =>
                              void navigator.clipboard?.writeText(
                                sendObservation.text,
                              )
                            }
                          />
                        ),
                      },
                    ]
                  : []),
                ...held.waiting.map((w) => ({
                  id: `held:${w.command_id}`,
                  kind: "user",
                  content: (
                    <WaitingMessage
                      text={w.text}
                      state={w.state}
                      onCopy={() => void navigator.clipboard?.writeText(w.text)}
                    />
                  ),
                })),
                ...(startFailed
                  ? [
                      {
                        id: "held-start-failure",
                        kind: "receipt",
                        content: (
                          <HeldStartFailure
                            count={held.waiting.length}
                            reason={
                              current?.start_problem === "capacity_exceeded"
                                ? capacityReason
                                : undefined
                            }
                            onRetry={() => void held.retry()}
                            onEdit={() => void held.cancel()}
                          />
                        ),
                      },
                    ]
                  : []),
                ...(!statusStale && current?.pending_question
                  ? [
                      {
                        id: `question:${current.pending_question.request_id}`,
                        kind: "question",
                        content: (
                          <PiQuestion
                            question={current.pending_question}
                            agentId={current.agent_id}
                            identity={identity}
                            csrf={csrf}
                            refresh={refresh}
                            onLogin={onLogin}
                            onOutcome={setQuestionOutcome}
                          />
                        ),
                      },
                    ]
                  : []),
                ...(liveTurn && !liveMerged && provisional.length
                  ? [
                      {
                        // The first provisional block may be retired when native
                        // history catches up; it is not the identity of the turn.
                        id: `live-turn-${current?.command_id || started?.event_id || provisional[0].id}`,
                        kind: "assistant",
                        content: (
                          <AgentTurn
                            steps={liveTurn.steps}
                            working={liveTurn.working}
                            activity={liveTurn.activity}
                            duration={liveTurn.duration}
                          />
                        ),
                      },
                    ]
                  : []),
              ]}
              historyMode="pagedAccessible"
              newContentCount={unseen}
              latestWorking={
                current?.run_active ??
                (current?.state === "working" || current?.state === "accepted")
              }
              latestDuration={duration}
              showJumpToLatest={awayFromLatest}
              onJumpToLatest={() => {
                wasAtBottom.current = true;
                readingAnchor.current = undefined;
                if (id) store.savePosition(id);
                setAwayFromLatest(false);
                feed.current?.scrollTo({
                  top: feed.current.scrollHeight,
                  behavior: window.matchMedia(
                    "(prefers-reduced-motion: reduce)",
                  ).matches
                    ? "instant"
                    : "smooth",
                });
                feed.current?.focus({ preventScroll: true });
                setUnseen(0);
              }}
            />
            {showRun && bash ? (
              <CommandRun
                command={bash.command}
                excludeFromContext={bash.exclude_from_context}
                state={bashStopState === "uncertain" ? "uncertain" : bash.state}
                exitCode={bash.exit_code}
                startedAt={
                  bash.started_at ? Date.parse(bash.started_at) : undefined
                }
                output={bashOutput}
                stopping={bashStopState === "pending"}
              />
            ) : null}
            {(!current?.pending_question || statusStale) && questionOutcome ? (
              <p className="ah-native-question" role="status">
                {questionOutcome === "stale"
                  ? "? Pyyntö voi olla vanhentunut tai toimitus epävarma. Tarkista tila."
                  : "? Ei tiedossa, käsittelikö agentti pyynnön. Älä lähetä uudelleen."}
              </p>
            ) : null}
            {/* Normal progress belongs to the turn header, not a second row
                that mounts/unmounts beneath streaming content. */}
            {current?.state === "stopping" || current?.state === "uncertain" ? (
              <WorkingProgress state={current.state} events={events} />
            ) : current?.state === "stopped" &&
              current.interrupted &&
              !held.waiting.length ? (
              <WorkingProgress state="uncertain" events={events} />
            ) : null}
            {!storagePressure.full && statusStale && !serverUnavailable ? (
              <InlineNotice
                title="Keskustelun tila vanhentui"
                description="Näytetään viimeisin tunnettu historia. Tarkista tila ennen ohjaamista."
                tone="warning"
                actions={[
                  {
                    label: "Tarkista tila",
                    onPress: () => {
                      if (
                        continuation &&
                        continuation !== "uncertain" &&
                        continuation !== "pending"
                      )
                        setContinuation(undefined);
                      void refresh(true, true);
                    },
                  },
                ]}
              />
            ) : null}
            {!storagePressure.full &&
            journalOffline &&
            !statusStale &&
            !serverUnavailable ? (
              <InlineNotice
                title="Tapahtumayhteys katkesi"
                description="Tila ja natiivi historia tarkistetaan uudelleen. Viestiä ei lähetetä uudelleen."
                tone="warning"
              />
            ) : null}
            {!statusStale &&
            !serverUnavailable &&
            showMissedEvents(!!live?.truncated, current) ? (
              <InlineNotice
                title="Tapahtumia jäi väliin"
                description="Live-tapahtumien häntä ei ole täydellinen. Tarkista natiivi historia."
                tone="warning"
              />
            ) : null}
            {events.length && current?.native_history !== "present" ? (
              <p role="status">
                Agentin tapahtumia vastaanotettu; historiaa odotetaan.
              </p>
            ) : null}
          </ConversationStream>
          <div className="ah-actionable-notices">
            {!statusStale && current?.auth_error === "pi_auth_failed" ? (
              <InlineNotice
                title="Kielimallikirjautuminen ei ole kunnossa"
                description="Kirjaudu OpenAI-tilillesi uudelleen ja jatka sitten keskustelua. Viestiä ei lähetetä automaattisesti uudelleen; luonnos säilyy."
                tone="danger"
                actions={[
                  {
                    label: "Kirjaudu uudelleen",
                    onPress: () =>
                      navigate(
                        `/workspaces/${(workspace.place?.parent ?? workspace).workspace_id}?conversation=${encodeURIComponent(id ?? "")}&pi_sign_in=1`,
                      ),
                  },
                ]}
              />
            ) : null}
            {!statusStale && current?.auth_error === "pi_model_unsupported" ? (
              <InlineNotice
                title="Valittu kielimalli ei ole käytettävissä"
                description="Agentti ilmoitti, ettei valittu malli ole tuettu tällä ChatGPT-tilillä. Valitse toinen malli ja aloita uusi keskustelu. Viestiä ei toisteta; luonnos säilyy."
                tone="danger"
                actions={[
                  {
                    label: "Valitse toinen malli",
                    onPress: () => {
                      setModelExpanded(!modelExpanded);
                    },
                  },
                ]}
              />
            ) : null}
            {!statusStale &&
            current?.auth_error === "pi_model_unsupported" &&
            modelExpanded ? (
              <PiModelSelector
                csrf={csrf}
                scope="recovery"
                onChoice={(choice) =>
                  void start(choice, !entries.some((e) => e.kind === "user"))
                }
              />
            ) : null}
          </div>
          {!storagePressure.full &&
          !statusStale &&
          (visibleRecovery || details) ? (
            <div className="ah-status-check">
              <Button
                size="row"
                label="Tarkista keskustelun tila"
                variant="quiet"
                onPress={() => {
                  if (
                    continuation &&
                    continuation !== "uncertain" &&
                    continuation !== "pending"
                  )
                    setContinuation(undefined);
                  void refresh(true, true); // explicit check may prove an ended conversation
                }}
              />
            </div>
          ) : null}
          <div className="ah-conversation-notices">
            {titleError ? (
              <InlineNotice
                title="Otsikkoa ei voitu luoda"
                description="Tarkista tila ennen uutta yritystä."
                tone="danger"
              />
            ) : null}
            {statusStale || storagePressure.full ? null : notices}
            {held.notice ? (
              <p className="ah-held-notice" role="status">
                {held.notice}
              </p>
            ) : null}
          </div>
          {!recapDismissed &&
            (recapCurrent?.recap ||
              recapBusy ||
              recapError ||
              recapUncertain) && (
              <RecapCard
                // Only "Tilannekatsaus": the header and sidebar already say
                // who is waiting (Jari 16.10.2026).
                recap={recapCurrent?.recap ?? null}
                now={recapNow}
                stale={
                  !!recapCurrent?.recap &&
                  (recapCurrent.recap.through !== recapCurrent.latest ||
                    (controlled &&
                      current?.state !== "idle" &&
                      current?.state !== "rejected"))
                }
                pending={!!recapBusy}
                onDismiss={
                  recapFingerprint
                    ? () => {
                        setDismissedRecap(
                          `${dismissalKey}:${recapFingerprint}`,
                        );
                        try {
                          localStorage.setItem(dismissalKey, recapFingerprint);
                        } catch {
                          /* Keep it dismissed in this tab. */
                        }
                      }
                    : undefined
                }
                error={!!recapError}
                uncertain={!!recapUncertain}
                unverifiable={!!recapCurrent?.unavailable}
                unavailable={
                  !controlled ||
                  !csrf ||
                  statusStale ||
                  serverUnavailable ||
                  !!problem ||
                  current?.run_active === true ||
                  (current?.state !== "idle" &&
                    current?.state !== "rejected") ||
                  !!recapCurrent?.unavailable
                }
                unavailableReason={
                  current?.state !== "idle" && current?.state !== "rejected"
                    ? "Odota agentin vuoron päättymistä."
                    : undefined
                }
                onRequest={
                  controlled && csrf && id
                    ? () => {
                        if (recapBusy) return;
                        const key = recapKey;
                        setRecapAction({
                          key,
                          pending: true,
                          error: false,
                          uncertain: false,
                        });
                        void requestRecap(id, csrf)
                          .then(async () => {
                            const result = await readRecap(id);
                            if (!alive.current || key !== `${identity}/${id}`)
                              return;
                            setRecapView({
                              key,
                              recap: result.recap,
                              latest: result.latest_message,
                              unavailable: false,
                            });
                            setRecapAction({
                              key,
                              pending: false,
                              error: false,
                              uncertain: false,
                            });
                          })
                          .catch(async (failure: unknown) => {
                            // A lost POST reply does not mean Pi failed: check its
                            // native entry before reporting an unknown result.
                            try {
                              const result = await readRecap(id);
                              if (
                                result.recap?.through === result.latest_message
                              ) {
                                if (
                                  alive.current &&
                                  key === `${identity}/${id}`
                                ) {
                                  setRecapView({
                                    key,
                                    recap: result.recap,
                                    latest: result.latest_message,
                                    unavailable: false,
                                  });
                                  setRecapAction({
                                    key,
                                    pending: false,
                                    error: false,
                                    uncertain: false,
                                  });
                                }
                                return;
                              }
                            } catch {
                              /* Native read may also be unavailable. */
                            }
                            if (alive.current && key === `${identity}/${id}`)
                              setRecapAction({
                                key,
                                pending: false,
                                error:
                                  failure instanceof Error &&
                                  failure.message === "recap generation failed",
                                uncertain: !(
                                  failure instanceof Error &&
                                  failure.message === "recap generation failed"
                                ),
                              });
                          });
                      }
                    : undefined
                }
              />
            )}
          {controlled ? (
            <>
              {/* The bell is the strip's only waiting cue; the top bar
                  already says Odottaa spinoffia (Jari 16.10.2026). */}
              <BackgroundStrip
                agentIdle={
                  presentation.activity === "waiting_spinoff" ||
                  presentation.activity === "waiting_process" ||
                  presentation.activity === "waiting"
                }
                piNotRunning={bridgeExpected}
              />
              <Composer
                csrf={csrf}
                modelPicker={
                  canChooseFirstModel ? (
                    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Escape closes the native disclosure and returns focus.
                    <details
                      className="md-empty-picker"
                      key={id}
                      ref={emptyPicker}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.currentTarget.open = false;
                          event.currentTarget.querySelector("summary")?.focus();
                        }
                      }}
                    >
                      <summary
                        className={`md-pill ${controlClassName({ size: "inline", presentation: "pill" })}`}
                        aria-label="Uuden keskustelun malli"
                      >
                        {displayModel} · {selectedThinking ?? "Agentti"}{" "}
                        <Icon name="down" />
                      </summary>
                      <div className="md-pop md-pop-up">
                        <PiModelSelector
                          csrf={csrf}
                          scope="empty"
                          onBlocked={setModelBlocked}
                          current={selectedModel}
                          currentThinking={selectedThinking}
                          onChoice={(choice) => {
                            setModelChoice(choice);
                            if (emptyPicker.current) {
                              emptyPicker.current.open = false;
                              emptyPicker.current
                                .querySelector("summary")
                                ?.focus();
                            }
                          }}
                        />
                      </div>
                    </details>
                  ) : undefined
                }
                value={draft}
                onChange={changeDraft}
                activity={
                  !notStarted &&
                  (current?.run_active ?? current?.state === "accepted")
                    ? "working"
                    : "idle"
                }
                selectedWorkingMode={workingMode}
                queue={
                  current?.queue
                    ? {
                        steering: current.queue.steering,
                        followUp: current.queue.follow_up,
                      }
                    : undefined
                }
                queueKnown={!!current?.queue}
                onRestoreQueue={() => void clearNativeQueue()}
                restoreAvailability={queueRestoreAvailability}
                shell={composerShell}
                stopState={
                  current?.state === "stopping"
                    ? "pending"
                    : current?.state === "uncertain"
                      ? "uncertain"
                      : undefined
                }
                sources={composerSources}
                sendState={
                  busy
                    ? "pending"
                    : ambiguous && !notStarted
                      ? "uncertain"
                      : "idle"
                }
                // The outage/status notice already explains the block and its remedy.
                // Keep the control's reason accessible, but do not show a second warning.
                suppressAvailabilityReason={
                  archive?.archive !== "archived" &&
                  archive?.archive !== "unknown" &&
                  (serverUnavailable ||
                    statusStale ||
                    journalOffline ||
                    showMissedEvents(!!live?.truncated, current) ||
                    Boolean(
                      ambiguous && sendObservation?.state === "uncertain",
                    ))
                }
                // Status refreshes (including turn completion) guard host writes,
                // not the local draft. Disabling the textarea here drops focus
                // and the caret even if the next status read succeeds.
                editorAvailability={{ state: "enabled" }}
                availability={
                  canSend
                    ? { state: "enabled" }
                    : {
                        state: "unknown",
                        reason:
                          archive?.archive === "archived"
                            ? "Palauta keskustelu arkistosta ennen viestin lähettämistä."
                            : archive?.archive === "unknown"
                              ? "Arkiston tila on epävarma. Päivitä tiedot."
                              : modelBlocked
                                ? "Valitse toinen malli uuden keskustelun kentän valitsimesta."
                                : serverUnavailable
                                  ? "Palvelinyhteys katkesi. Luonnos säilyy."
                                  : statusStale
                                    ? "Tila on vanhentunut. Tarkista keskustelun tila ennen lähettämistä."
                                    : "Odota vahvistettua joutotilaa; epävarmaa viestiä ei lähetetä uudelleen.",
                      }
                }
                onSendNow={() => {
                  if (draft.trim() && canSend) dismissRecapOnSend();
                  if (notStarted) {
                    // A new conversation's first message carries the model
                    // chosen in its field, as a direct first send does.
                    if (canSend)
                      held.submit(
                        draft,
                        canChooseFirstModel ? modelChoice : undefined,
                      );
                  } else void submit();
                }}
                onSteer={() => {
                  if (draft.trim()) dismissRecapOnSend();
                  void submitQueue("steer");
                }}
                onFollowUp={() => {
                  if (draft.trim()) dismissRecapOnSend();
                  void submitQueue("follow_up");
                }}
                onModeChange={setWorkingMode}
                onInterrupt={
                  (current?.run_active ?? current?.state === "accepted") &&
                  !statusStale
                    ? () => void stopPi()
                    : undefined
                }
                onStopWaiting={
                  waitingForPi && current?.state === "starting" && !statusStale
                    ? () => void held.cancel()
                    : undefined
                }
              />
            </>
          ) : null}
          {shell.panel}
        </ConversationFrame>
      )}
      {!id ? notices : null}
    </section>
  );
}
