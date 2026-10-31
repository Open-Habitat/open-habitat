import {
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router";
import {
  AgentHeader,
  Button,
  Composer,
  ConversationFrame,
  ConversationStream,
  ConversationTimeline,
  HeldStartFailure,
  InlineNotice,
  SendObservation,
  UserMessage,
  WaitingMessage,
  WorkingProgress,
} from "../components";
import {
  AgentTurn,
  elapsedLabel,
  ThinkingRow,
  type TurnStep,
} from "../components/AgentTurn";
import { agentPresentation } from "../components/agentPresentation";
import { BackgroundStrip, type WorkerAsk } from "../components/BackgroundStrip";
import { BashToolCard } from "../components/BashToolCard";
import { ComposerModelPicker } from "../components/ComposerModelPicker";
import { ContextPage } from "../components/ContextPage";
import { ContextRing } from "../components/ContextRing";
import { ControlButton, controlClassName } from "../components/ControlElements";
import { CommandRun } from "../components/composer/CommandRun";
import { EditorReplaceNote } from "../components/EditorReplaceNote";
import { FileToolCard, fileStat } from "../components/FileToolCard";
import { ModelChip, modelSummary } from "../components/ModelChip";
import {
  ProcessAwareToolUse,
  ProcessProvider,
  ProcessStartCard,
  ProcessWaitingChip,
  useProcessView,
} from "../components/ProcessTray";
import { RecapCard, useMinuteNow } from "../components/RecapCard";
import { RestCard } from "../components/RestartNotice";
import { SpinoffContext } from "../components/Spinoffs";
import { WarningBanner } from "../components/WarningBanner";
import { UnpresentedEvents } from "../components/WorkingProgress";
import { useBrowserShell } from "./BrowserShell";
import { toolStopped } from "./bashFailure";
import { useConversationActions } from "./ConversationActions";
import { ConversationGitStatus } from "./ConversationGitStatus";
import {
  readCommands,
  readFiles,
  readPreview,
  type StartPage,
} from "./composerReads";
import { useContextDetail } from "./contextDetail";
import { contextUsage } from "./contextUsage";
import { provisionalItems } from "./conversationEvents";
import type { ConversationStore } from "./conversationStore";
import { useAgentNotices } from "./conversationStore";
import {
  abortBash,
  currentRecap,
  NotAdmitted,
  type Recap,
  type RecapFailureReason,
  RecapGenerationFailed,
  readRecap,
  regenerateTitle,
  renameConversation,
  requestRecap,
  retitleHistory,
  runBash,
  type Session,
  type Status,
  TitleGenerationFailed,
  turnUnderway,
} from "./conversations";
import { messageFor, toolPath } from "./editorChanges";
import {
  composerGoals,
  conversationGoal,
  goalConversationName,
  guideOpensItself,
  guideOwner,
  prepareField,
  readFirstSkill,
  setGuide,
  useGuide,
  usePreparedField,
} from "./goalGuide";
import { type LiveTurnInput, TurnText, timelineItems } from "./HistoryView";
import { piNotRunning, useHeldMessages } from "./heldMessages";
import { startProblemReason } from "./mutations";
import { type NextWaiting, NextWaitingDock } from "./NextWaitingDock";
import { sshTarget } from "./ownMachines";
import {
  OwnMachineUseProvider,
  useOpenMachines,
  useOwnMachineHosts,
} from "./ownMachineUse";
import { PendingConversation } from "./PendingConversation";
import {
  type Choice,
  ConversationModelInfo,
  PiModelSelector,
} from "./PiModelSelector";
import { shortModel, usePiModels } from "./PiModels";
import { PiQuestion } from "./PiQuestion";
import { useBridgeExpected } from "./processWarmup";
import { useRecapHold } from "./recapHold";
import { useRest } from "./rest";
import { SpinoffProvider } from "./SpinoffConversation";
import { StartPageRead } from "./StartPageRead";
import { useStoragePressure } from "./StoragePressure";
import { useSentMessages, shownQueue as withSentQueue } from "./sentMessages";
import { latestSettings } from "./sessionSettings";
import { settingsHref } from "./settingsRoute";
import type { Agent, Snapshot, Workspace } from "./snapshot";
import { useTurnIdentity } from "./turnIdentity";
import { useConversation } from "./useConversation";
import {
  isReadingIntro,
  useFollowLatest,
  useReadingPositionLayout,
} from "./useReadingPosition";
import { useSettledWarning } from "./useSettledWarning";
import {
  FilesHeaderControl,
  GuideHeaderControl,
  NoticeEntry,
} from "./ViewHost";
import {
  EditorHeaderControls,
  useEditorActivity,
  useEditorToolReport,
  useReplaceNotes,
} from "./WorkspaceEditor";
import { requestPhases, requestText } from "./workerRequests";

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
// conversation reads native history, from which nothing can be missed. A live
// tail given up at its bound is no gap either: the stream stayed contiguous
// and native history holds everything saved. Only events the browser missed
// are, until a native read begun after them has joined.
export function showMissedEvents(liveMissed: boolean, current?: Status) {
  const live =
    current?.run_active ??
    (current?.state === "accepted" || current?.state === "pending");
  return (
    !!live &&
    (liveMissed ||
      !!(current?.event_loss && current.native_history !== "present"))
  );
}

export function BrowserConversation(
  props: Parameters<typeof BrowserConversationContent>[0],
) {
  // Status and snapshot each learn when the native session becomes readable.
  const [nativeHistory, setNativeHistory] = useState<string>();
  const snapshotHistory = props.recoverySnapshot?.agents.find(
    (agent) => agent.agent_id === props.id,
  )?.history;
  return (
    <SpinoffProvider
      key={`${props.identity}:${props.id}`}
      parent={props.id}
      recheck={`${snapshotHistory}:${nativeHistory}`}
      onLogin={props.onLogin}
      timeline={timelineItems}
      place={{
        parentTitle: props.title,
        workspaceId: props.workspace.workspace_id,
        workspaceName: props.workspace.display_name ?? props.workspace.name,
        csrf: props.csrf,
        githubState: props.recoverySnapshot?.auth?.native_github.state,
      }}
    >
      <ProcessProvider
        key={`${props.identity}:${props.id}`}
        id={props.id}
        csrf={props.csrf}
        onLogin={props.onLogin}
        onStatusEvent={props.onStatusEvent}
      >
        <OwnMachineUseProvider key={`${props.identity}:${props.id}`}>
          <BrowserConversationContent
            {...props}
            onNativeHistory={setNativeHistory}
          />
        </OwnMachineUseProvider>
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
  onNativeHistory,
  github,
  nextWaiting,
}: {
  /** The walk to the next conversation waiting for the person (experimental). */
  nextWaiting?: NextWaiting;
  /** The person's GitHub connection, when it needs saying here: the app
   * reads it from the snapshot, not from this conversation. */
  github?: ReactNode;
  workspace: Workspace;
  archive?: Agent;
  onArchive?: (agent: Agent, archived: boolean) => Promise<boolean>;
  onClose?: (agent: Agent) => Promise<unknown>;
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
  onNativeHistory?: (history?: string) => void;
}) {
  const transientNotices = useAgentNotices(store, id ?? "");
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
  // One object per page, so the composer keeps its dictation engine.
  const speech = useMemo(
    () => ({ onOpenSettings: () => navigate(settingsHref("sanelu")) }),
    [navigate],
  );
  const nativeHistory = current?.native_history;
  useEffect(() => {
    onNativeHistory?.(nativeHistory);
  }, [nativeHistory, onNativeHistory]);
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
  const openMachines = useOpenMachines();
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
  const contextState = contextUsage({
    entries,
    fragments: live?.fragments,
    model: selectedModel,
    catalog: models,
  });
  // The context page (Sivu) replaces the conversation below the top bar;
  // the route says it is open so a reload or a shared link keeps it.
  const location = useLocation();
  const contextOpen =
    !!id && new URLSearchParams(location.search).get("context") === "1";
  const contextDetail = useContextDetail(
    id,
    contextOpen,
    `${entries.at(-1)?.entry_key}:${entries.length}:${contextState?.phase}`,
    contextState?.phase === "known" ? contextState.tokens : undefined,
    onLogin,
  );
  const toggleContext = () => {
    const q = new URLSearchParams(location.search);
    if (!contextOpen) {
      q.set("context", "1");
      navigate(`${location.pathname}?${q}`, { state: { contextFrom: true } });
      return;
    }
    // Opened from here: going back is closing. A direct link closes in place.
    if ((location.state as { contextFrom?: boolean } | null)?.contextFrom)
      navigate(-1);
    else {
      q.delete("context");
      navigate(`${location.pathname}${q.size ? `?${q}` : ""}`, {
        replace: true,
      });
    }
  };
  const contextWasOpen = useRef(contextOpen);
  useEffect(() => {
    if (contextWasOpen.current && !contextOpen)
      document
        .querySelector<HTMLElement>(
          ".ah-agent-header [data-testid='context-ring']",
        )
        ?.focus();
    contextWasOpen.current = contextOpen;
  }, [contextOpen]);
  const selectedThinking =
    (emptyConversation ? modelChoice?.thinking : undefined) ??
    nativeSettings.thinking ??
    current?.startup_choice?.thinking ??
    (!id ? models?.default_thinking : undefined);
  // Choices are transient intents, never preferences shared across workspaces.
  // biome-ignore lint/correctness/useExhaustiveDependencies: route change resets local picker state.
  useEffect(() => {
    setModelChoice(undefined);
    setModelBlocked(false);
    setModelExpanded(false);
    setChipOpen(false);
  }, [workspace.workspace_id, id]);
  const {
    own: ownMessage,
    onSent,
    queued,
    onQueued,
  } = useSentMessages({
    scope: `${identity}:${id ?? ""}`,
    entries,
    queue: current?.queue,
    sendObservation,
    draft,
    changeDraft,
  });
  useReadingPositionLayout({
    entries,
    live,
    // The queue card above the field changes the reading area's height.
    queueOpen:
      (current?.queue?.steering.length ?? 0) +
        (current?.queue?.follow_up.length ?? 0) +
        queued.length >
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
  const { scrolled } = useFollowLatest({
    feed,
    id,
    opened,
    rows: entries.length,
    wasAtBottom,
    setAwayFromLatest,
  });
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
    error: string | null;
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
    latestAt: string | null;
    unavailable: boolean;
  } | null>(null);
  const [recapAction, setRecapAction] = useState<{
    key: string;
    pending: boolean;
    error: boolean;
    uncertain: boolean;
    reason?: RecapFailureReason;
    /** The latest message when the person asked; a failure is about it. */
    through?: string;
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
            latestAt: result.latest_message_at,
            unavailable: false,
          });
          if (result.recap?.through === result.latest_message)
            setRecapAction((previous) =>
              previous?.key === recapKey &&
              (previous.uncertain || previous.error)
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
            latestAt: previous?.key === recapKey ? previous.latestAt : null,
            unavailable: true,
          }));
      });
    return () => {
      cancelled = true;
    };
  }, [id, opened, recapKey, newestKey, historyRevision]);
  const recapCurrent = recapView?.key === recapKey ? recapView : null;
  const recapNow = useMinuteNow();
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
  // A recap the daemon finished while the person was typing or reading waits
  // until they pause; one already showing stays, and one they asked for shows.
  const recapHold = useRecapHold({
    id,
    csrf,
    controlled,
    draft,
    feed,
    opened,
  });
  const [recapSeen, setRecapSeen] = useState<{
    key: string;
    fingerprint: string;
  } | null>(null);
  // The first read decides what was already there when the conversation
  // opened, unless the person was already typing or reading while it loaded.
  const recapHeld =
    recapCurrent?.recap?.trigger === "automatic" &&
    (recapSeen?.key === recapKey
      ? recapHold.active && recapSeen.fingerprint !== recapFingerprint
      : recapHold.recent);
  useEffect(() => {
    if (!recapCurrent || recapHeld) return;
    setRecapSeen((previous) =>
      previous?.key === recapKey && previous.fingerprint === recapFingerprint
        ? previous
        : { key: recapKey, fingerprint: recapFingerprint },
    );
  }, [recapCurrent, recapHeld, recapKey, recapFingerprint]);
  const dismissRecapOnSend = () => {
    if (!recapFingerprint) return;
    setDismissedRecap(`${dismissalKey}:${recapFingerprint}`);
    try {
      localStorage.setItem(dismissalKey, recapFingerprint);
    } catch {
      /* Keep it dismissed in this tab. */
    }
  };
  const shownRecap =
    recapCurrent && !recapHeld
      ? currentRecap(
          recapCurrent.recap,
          recapCurrent.latest,
          controlled && turnUnderway(current?.state, current?.run_active),
        )
      : null;
  // An outdated automatic recap simply waits for the daemon's next idle
  // recap. One the person asked for keeps its card as a quiet request, so
  // they need not wait for that idle interval.
  const outdatedRequest =
    !shownRecap &&
    !!recapCurrent?.recap &&
    recapCurrent.recap.trigger !== "automatic" &&
    controlled &&
    !!csrf &&
    !!id;
  const recapBusy = recapAction?.key === recapKey && recapAction.pending;
  // A failed request no longer describes the conversation once it moved on.
  const recapError =
    recapAction?.key === recapKey &&
    recapAction.error &&
    recapAction.through === recapCurrent?.latest;
  const recapUncertain = recapAction?.key === recapKey && recapAction.uncertain;
  // The daemon's newest attempt for the latest message failed. Without this
  // the card never appears when no recap was ever written, and an automatic
  // failure would look the same as a recap not yet due.
  const recapFailed =
    controlled &&
    !shownRecap &&
    recapCurrent?.latest &&
    current?.recap_failure?.through === recapCurrent.latest
      ? current.recap_failure
      : undefined;
  const recapFailedDismissed =
    !!recapFailed &&
    dismissedRecap === `${dismissalKey}:failed:${recapFailed.through}`;
  const recapReason =
    (recapError ? recapAction?.reason : undefined) ?? recapFailed?.reason;
  // Whether a recap can be made now, for the card's refresh and the header.
  const recapUnavailable =
    !controlled ||
    !csrf ||
    statusStale ||
    serverUnavailable ||
    !!problem ||
    current?.run_active === true ||
    (current?.state !== "idle" && current?.state !== "rejected") ||
    !!recapCurrent?.unavailable;
  const recapUnavailableReason =
    current?.state === "stopped"
      ? "Agentti lepää. Kirjoittaminen herättää sen."
      : current?.state !== "idle" && current?.state !== "rejected"
        ? "Odota agentin vuoron päättymistä."
        : undefined;
  // Make a recap now: the card's refresh and the header's button.
  const requestRecapNow =
    controlled && csrf && id
      ? () => {
          if (recapBusy) return;
          const key = recapKey;
          const through = recapCurrent?.latest;
          setRecapAction({
            key,
            pending: true,
            error: false,
            uncertain: false,
            through,
          });
          void requestRecap(id, csrf)
            .then(async () => {
              const result = await readRecap(id);
              if (!alive.current || key !== `${identity}/${id}`) return;
              setRecapView({
                key,
                recap: result.recap,
                latest: result.latest_message,
                latestAt: result.latest_message_at,
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
                if (result.recap?.through === result.latest_message) {
                  if (alive.current && key === `${identity}/${id}`) {
                    setRecapView({
                      key,
                      recap: result.recap,
                      latest: result.latest_message,
                      latestAt: result.latest_message_at,
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
                  error: failure instanceof RecapGenerationFailed,
                  uncertain: !(failure instanceof RecapGenerationFailed),
                  through,
                  reason:
                    failure instanceof RecapGenerationFailed
                      ? failure.reason
                      : undefined,
                });
            });
        }
      : undefined;

  const {
    start,
    submit,
    submitQueue,
    clearNativeQueue,
    stopNow,
    stopAttempt,
    clearStopAttempt,
    restoredQueue,
    notices,
  } = useConversationActions({
    firstChoice: canChooseFirstModel ? modelChoice : undefined,
    workspace,
    id,
    csrf,
    ambiguous,
    busy,
    current,
    entries,
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
    onSent,
    onQueued,
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
  // Habitat's card of a rest, and the wake the person's typing starts.
  const rest = useRest({
    id,
    workspaceId: workspace.workspace_id,
    rest:
      controlled && archive?.archive === "active" && !statusStale
        ? archive.rest
        : undefined,
    spinoffsWorking: archive?.spinoffs_working,
    csrf,
  });
  // Typing wakes a resting Pi whether or not the rest had anything to tell;
  // the card is shown only when it does.
  const resting = rest.resting && !!archive?.rest && !held.waiting.length;
  const restCard =
    resting && archive?.rest && rest.shown ? (
      <RestCard
        stop={archive.rest}
        notice={rest.report?.report}
        unavailable={
          rest.failed ||
          (!!rest.report && rest.report.availability !== "available")
        }
        wake={rest.wake}
        refusal={rest.refusal}
      />
    ) : null;
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
  const sendBlocked =
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
              : "Odota vahvistettua joutotilaa; epävarmaa viestiä ei lähetetä uudelleen.";
  // *Kerro agentille* sends at once, the way the composer's send button would
  // now: during a turn in the selected working mode, otherwise directly or
  // held until Pi starts. The person's draft stays as it is.
  const tellWorking =
    !notStarted && (current?.run_active ?? current?.state === "accepted");
  const tellBlocked = !canSend
    ? sendBlocked
    : !notStarted && !tellWorking && current?.state === "accepted"
      ? "Odota vahvistettua joutotilaa."
      : undefined;
  const tell = (text: string) => {
    dismissRecapOnSend();
    rest.onSend();
    if (notStarted)
      held.submit(text, canChooseFirstModel ? modelChoice : undefined, true);
    else if (tellWorking) void submitQueue(workingMode, text, true);
    else void submit(text, true);
  };
  // Kerro agentille on an ended worker's row: this conversation started it.
  // A request during a turn waits as a follow-up; a steer would redirect
  // the turn the person started.
  const spinoffs = useContext(SpinoffContext);
  const workerAsk: WorkerAsk = {
    target: "here",
    blocked: tellBlocked,
    phases: requestPhases({
      runs: spinoffs?.data?.runs ?? [],
      entries,
      queued: [
        ...(current?.queue?.steering ?? []),
        ...(current?.queue?.follow_up ?? []),
      ],
      sent: [
        ...held.waiting.map((w) => w.text),
        // A refused send is not on its way; the row waits again.
        ...(sendObservation && sendObservation.state !== "rejected"
          ? [sendObservation.text]
          : []),
      ],
      working: !!tellWorking,
    }),
    send: (runs) => {
      const text = requestText(runs);
      dismissRecapOnSend();
      rest.onSend();
      if (notStarted)
        held.submit(text, canChooseFirstModel ? modelChoice : undefined, true);
      else if (tellWorking) void submitQueue("follow_up", text);
      else void submit(text);
    },
  };
  const turnRunning = current?.run_active ?? current?.state === "accepted";
  // A stop attempt ends with its turn; the next turn starts without one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on turn end or route change.
  useEffect(() => {
    if (!turnRunning) clearStopAttempt();
  }, [turnRunning, id]);
  const stopAttemptHere =
    stopAttempt?.id === current?.agent_id && turnRunning
      ? stopAttempt
      : undefined;
  // Pi may refuse an abort it received; the daemon reports that as the
  // command's acknowledgement.
  const stopPhase =
    stopAttemptHere?.phase === "pending" &&
    current?.command_id === stopAttemptHere.command &&
    current.ack === "rejected"
      ? "rejected"
      : stopAttemptHere?.phase;
  // Queue texts already restored into the field are not shown again from a
  // status read that predates their removal.
  const shownQueue = withSentQueue(
    current?.queue &&
      restoredQueue?.id === current.agent_id &&
      restoredQueue.revision === current.queue.revision
      ? { ...current.queue, steering: [], follow_up: [] }
      : current?.queue,
    queued,
  );
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
  // The start page names the goals whose skill calls the conversation shows
  // as a goal: a chip in the draft, the guide beside a recorded call.
  const pageKey = `${identity}:${current?.agent_id ?? ""}:${runWorkspace}`;
  const [startPage, setStartPage] = useState<{
    key: string;
    page: StartPage | null;
  }>();
  const page = startPage?.key === pageKey ? startPage.page : undefined;
  const pageWanted =
    entries.some((entry) => entry.skill) ||
    draft.startsWith("/skill:") ||
    !!next;
  useEffect(() => {
    const agentId = current?.agent_id;
    if (!agentId || !controlled || !pageWanted || startPage?.key === pageKey)
      return;
    let live = true;
    // The empty view's read is the same cached promise.
    store.startPage(agentId, runWorkspace).then(
      (read) => {
        if (live) setStartPage({ key: pageKey, page: read });
      },
      () => {
        // No goal is shown without the page; nothing else depends on it.
      },
    );
    return () => {
      live = false;
    };
  }, [
    current?.agent_id,
    controlled,
    pageWanted,
    startPage?.key,
    pageKey,
    store,
    runWorkspace,
  ]);
  const goals = useMemo(() => composerGoals(page), [page]);
  const guide = id ? guideOwner(identity, id) : undefined;
  const startedGoal = useGuide(guide)?.goal;
  // A goal chosen before this conversation existed keeps its selection.
  usePreparedField(guide, section);
  const loadedGoal = conversationGoal(page, startedGoal, entries, draft);
  // Older history holds the first message: read just its start, once.
  const [first, setFirst] = useState<{ key: string; skill?: string }>();
  const firstWanted = !!next && !loadedGoal && goals.length > 0;
  useEffect(() => {
    const agentId = current?.agent_id;
    if (!agentId || !firstWanted || first?.key === pageKey) return;
    const controller = new AbortController();
    readFirstSkill(agentId, controller.signal).then(
      (skill) => setFirst({ key: pageKey, skill }),
      () => {
        // Without it the guide waits until older history is loaded.
      },
    );
    return () => controller.abort();
  }, [current?.agent_id, firstWanted, first?.key, pageKey]);
  const goal =
    loadedGoal ??
    conversationGoal(
      page,
      undefined,
      [],
      "",
      first?.key === pageKey ? first.skill : undefined,
    );
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
  // A finished agent tool call may have changed the file open in the browser
  // editor beside this conversation; the editor reads it again.
  const reportTool = useEditorToolReport();
  const reportedTools = useRef(new Set<string>());
  useEffect(() => {
    if (!reportTool || !id || !live) return;
    for (const item of provisionalItems(live)) {
      if (item.kind !== "tool" || !item.callId || !item.name) continue;
      if (item.state !== "succeeded" && item.state !== "failed") continue;
      const key = `${id}:${item.callId}`;
      if (reportedTools.current.has(key)) continue;
      reportedTools.current.add(key);
      reportTool({
        workspace: workspace.workspace_id,
        conversation: id,
        tool: item.name,
        path: toolPath(item.arguments),
      });
    }
  }, [live, reportTool, id, workspace.workspace_id]);
  const replaceNotes = useReplaceNotes(workspace.workspace_id, id);
  // The note's buttons go with it; focus moves on to the field, not the page.
  const closeReplaceNote = (noteId: number) => {
    replaceNotes.dismiss(noteId);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLTextAreaElement>(
          ".ah-conversation-frame .ah-composer textarea",
        )
        ?.focus(),
    );
  };
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
  useOwnMachineHosts(
    liveItems.flatMap((item) =>
      item.kind === "tool" && item.name === "bash"
        ? [
            {
              command: bashCommand(item.arguments ?? ""),
              done: item.state === "succeeded" || item.state === "failed",
            },
          ]
        : [],
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
          remoteHost={
            item.name === "bash"
              ? sshTarget(bashCommand(item.arguments ?? ""))
              : undefined
          }
          state={
            item.state === "failed" && toolStopped(item.failureCause)
              ? "cancelled"
              : ((item.state as
                  | "running"
                  | "succeeded"
                  | "failed"
                  | "cancelled") ?? "forming")
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
                    node: (
                      <TurnText
                        block={{ type: "text", text: item.text }}
                        index={0}
                        entryKey={item.id}
                      />
                    ),
                  }
                : item.kind === "thinking"
                  ? { kind: "thinking", key: item.id, node: liveNode(item) }
                  : item.kind === "tool"
                    ? {
                        kind: "tool",
                        key: item.id,
                        failed:
                          item.state === "failed" &&
                          !toolStopped(item.failureCause),
                        node: liveNode(item),
                      }
                    : { kind: "other", key: item.id, node: liveNode(item) },
          ),
        }
      : undefined;
  const savedTimeline = timelineItems(
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
  const liveMerged = savedTimeline.some((item) => item.live);
  const liveRow = !!liveTurn && !liveMerged && provisional.length > 0;
  // The first provisional block may be retired when native history catches
  // up; it is not the identity of the turn.
  const settled = useTurnIdentity(
    `${identity}:${id ?? ""}`,
    savedTimeline,
    liveRow
      ? `live-turn-${current?.command_id || started?.event_id || provisional[0].id}`
      : undefined,
  );
  const timeline = settled.timeline;
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
              data-testid="new-conversation"
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
          onChange={(value) => {
            recapHold.note();
            changeDraft(value);
          }}
        />
      ) : (
        <ConversationFrame
          className={contextOpen ? "ah-frame-context" : undefined}
        >
          <AgentHeader
            openMachines={openMachines}
            data-model={selectedModel}
            data-thinking={selectedThinking}
            editorControl={<EditorHeaderControls />}
            filesControl={<FilesHeaderControl conversationId={id} />}
            guideControl={
              <GuideHeaderControl
                owner={guide}
                goal={goal}
                page={page && !("state" in page) ? page.title : undefined}
              />
            }
            archive={{
              state: archive?.archive ?? "unknown",
              empty:
                entries.length === 0 &&
                !historyError &&
                !next &&
                !!current &&
                current.native_history !== "unavailable",
              blockedReason: archiveAwaitingSnapshot
                ? "Odotetaan arkiston tilan vahvistusta."
                : archive
                  ? undefined
                  : "Ladataan arkiston tilaa.",
              eligible:
                !busy &&
                !statusStale &&
                !serverUnavailable &&
                (current?.state === "idle" ||
                  (current?.state === "stopped" && !held.waiting.length) ||
                  current?.continuation === "eligible"),
              busy: !!archiveBusy || !!closeBusy,
              onArchive: () => {
                if (archive) void onArchive?.(archive, true);
              },
              onClose:
                archive &&
                controlled &&
                csrf &&
                !serverUnavailable &&
                !statusStale &&
                // A Pi stopped for idleness before the first message leaves
                // nothing to archive; the daemon closes that one too.
                (current?.state === "idle" ||
                  (current?.state === "stopped" && !held.waiting.length)) &&
                !busy
                  ? () => {
                      // Close removes this view immediately. Fence in-flight
                      // status reads before they can turn its expected 404
                      // into a late navigation back to deleted history.
                      alive.current = false;
                      ++generation.current;
                      void onClose?.(archive);
                    }
                  : undefined,
              onRestore: () => {
                if (archive) void onArchive?.(archive, false);
              },
            }}
            title={title ?? "Uusi keskustelu"}
            titlePending={archive?.title.generation_state === "pending"}
            recapAction={
              id
                ? {
                    availability: recapUnavailable
                      ? {
                          state: "disabled",
                          reason:
                            recapUnavailableReason ??
                            "Ohjaus ei ole käytettävissä.",
                        }
                      : { state: "enabled" },
                    pending: !!recapBusy,
                    onPress: () => {
                      // The person asked to see one: a dismissed or held
                      // current recap shows again.
                      setDismissedRecap("");
                      try {
                        localStorage.removeItem(dismissalKey);
                      } catch {
                        /* Browser storage can be denied. */
                      }
                      if (recapFingerprint)
                        setRecapSeen({
                          key: recapKey,
                          fingerprint: recapFingerprint,
                        });
                      requestRecapNow?.();
                    },
                  }
                : undefined
            }
            rename={
              id && csrf
                ? {
                    availability:
                      !controlled || statusStale || serverUnavailable
                        ? {
                            state: "disabled",
                            reason: "Ohjaus ei ole käytettävissä.",
                          }
                        : { state: "enabled" },
                    onSave: async (name) => {
                      await renameConversation(
                        id,
                        workspace.workspace_id,
                        name,
                        csrf,
                      );
                    },
                  }
                : undefined
            }
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
                  error: null,
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
                        ? { key, version, pending: false, error: null }
                        : previous,
                    );
                  })
                  .catch((error: unknown) => {
                    if (generation.current !== version || !alive.current)
                      return;
                    const reason =
                      error instanceof TitleGenerationFailed
                        ? error.reason
                        : "uncertain";
                    const description =
                      reason === "model_unavailable"
                        ? "Otsikointimalli ei vastannut. Tarkista mallipalvelun kirjautuminen asetuksista ja yritä uudelleen."
                        : reason === "model_timeout" ||
                            reason === "model_invalid_response"
                          ? "Mallilta ei saatu kelvollista otsikkoa. Voit yrittää uudelleen."
                          : "Otsikon muutos jäi epävarmaksi. Tarkista nykyinen otsikko ja keskustelun tila ennen uutta yritystä.";
                    setTitleActionState((previous) =>
                      previous?.key === key
                        ? { key, version, pending: false, error: description }
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
                : restCard && rest.wake !== "awake"
                  ? "Lepää"
                  : (presentation.operationLabel ?? presentation.activityLabel)
            }
            activityControl={
              presentation.activity === "waiting_background" ? (
                <ProcessWaitingChip label={presentation.activityLabel} />
              ) : undefined
            }
            activityDetail={
              presentation.activity === "working" && liveTurn?.working
                ? [
                    liveTurn.activity,
                    elapsed === undefined ? "" : elapsedLabel(elapsed),
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : undefined
            }
            activityKind={
              presentation.activity === "working"
                ? "working"
                : presentation.activity === "unknown"
                  ? "unknown"
                  : "neutral"
            }
            settings={nativeSettings}
            contextIndicator={
              contextState ? (
                <ContextRing
                  usage={contextState}
                  open={contextOpen}
                  onToggle={toggleContext}
                />
              ) : undefined
            }
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
                <ModelChip
                  compact
                  model={selectedModel}
                  thinking={selectedThinking}
                  models={models?.models}
                />
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
                  <ModelChip
                    as="summary"
                    data-testid="conversation-model"
                    compact
                    model={selectedModel}
                    thinking={selectedThinking}
                    models={models?.models}
                    aria-label={modelSummary(
                      selectedModel,
                      selectedThinking,
                      models?.models,
                    )}
                  />
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
          {contextOpen ? (
            <ContextPage
              detail={contextDetail}
              usage={contextState}
              title={title ?? "Keskustelu"}
              onClose={toggleContext}
            />
          ) : null}
          <ConversationStream
            streamRef={feed}
            onScroll={() => {
              const el = feed.current;
              if (!el || isReadingIntro(el)) return;
              const move = scrolled(el);
              if (move === "end") {
                wasAtBottom.current = true;
                setAwayFromLatest(false);
                readingAnchor.current = undefined;
                if (id) store.savePosition(id);
                setUnseen(0);
              } else {
                if (move === "left") {
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
                  data-testid="older-history"
                  size="row"
                  label="Lataa vanhempi historiasivu"
                  onPress={() => {
                    captureAnchor();
                    void store.older(id);
                  }}
                />
              </div>
            ) : null}
            {transientNotices.map((notice) => (
              <NoticeEntry key={notice.notice_id} notice={notice} />
            ))}
            {storagePressure.full ? null : (
              <UnpresentedEvents events={events} liveEvents={live?.fragments} />
            )}
            {cutOff && (
              <InlineNotice
                data-testid="history-cut-off"
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
              emptyLabel={
                controlled ? (
                  <StartPageRead
                    key={`${identity}:${runWorkspace}:${current?.agent_id ?? ""}`}
                    workspaceId={runWorkspace}
                    agentId={current?.agent_id}
                    store={store}
                    draft={draft}
                    onChange={changeDraft}
                    onPage={(read) =>
                      setStartPage({ key: pageKey, page: read })
                    }
                    onStarted={(started, title, prepared) => {
                      // A goal names the conversation it starts, until the
                      // person renames it.
                      const name = goalConversationName(started);
                      if (current?.agent_id && csrf && name)
                        void renameConversation(
                          current.agent_id,
                          workspace.workspace_id,
                          name,
                          csrf,
                        ).catch(() => {
                          /* The automatic title then stands. */
                        });
                      if (!guide) return;
                      prepareField(guide, {
                        text: prepared.text,
                        start: prepared.selectionStart,
                        end: prepared.selectionEnd,
                      });
                      setGuide(guide, {
                        goal: started,
                        page: title,
                        open: guideOpensItself(),
                      });
                    }}
                  />
                ) : undefined
              }
              state={
                visibleHistoryError && !storagePressure.full
                  ? entries.length
                    ? "stale"
                    : "error"
                  : // A live turn ends the start page even before its
                    // native history is read; otherwise the intro would stay
                    // above it and keep the view from following the work.
                    entries.length ||
                      held.waiting.length ||
                      liveRow ||
                      ownMessage
                    ? "ready"
                    : "empty"
              }
              items={[
                ...timeline,
                ...(restCard
                  ? [{ id: "rest-card", kind: "receipt", content: restCard }]
                  : []),
                ...(ownMessage
                  ? [
                      {
                        id: `sent:${ownMessage.command}`,
                        kind: "user",
                        content: (
                          <UserMessage
                            delivery={
                              ownMessage.pending ? "pending" : "accepted"
                            }
                            sourceText={ownMessage.text}
                            deliveryState={
                              ownMessage.pending ? "Lähetetään" : undefined
                            }
                            onCopy={() =>
                              void navigator.clipboard?.writeText(
                                ownMessage.text,
                              )
                            }
                          />
                        ),
                      },
                    ]
                  : sendObservation &&
                      // The bubble or the queue card shows a message on its
                      // way; a reload knows only that one is.
                      !(
                        sendObservation.kind &&
                        sendObservation.state === "pending"
                      )
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
                            reason={startProblemReason(current?.start_problem)}
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
                ...(showRun && bash
                  ? [
                      {
                        id: `bash:${bash.command_id}`,
                        kind: "bash",
                        content: (
                          <CommandRun
                            command={bash.command}
                            excludeFromContext={bash.exclude_from_context}
                            state={
                              bashStopState === "uncertain"
                                ? "uncertain"
                                : bash.state
                            }
                            exitCode={bash.exit_code}
                            startedAt={
                              bash.started_at
                                ? Date.parse(bash.started_at)
                                : undefined
                            }
                            output={bashOutput}
                            stopping={bashStopState === "pending"}
                          />
                        ),
                      },
                    ]
                  : []),
                ...(liveTurn && settled.liveKey
                  ? [
                      {
                        id: settled.liveKey,
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
                data-testid="conversation-stale"
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
            showMissedEvents(!!live?.missed, current) ? (
              <InlineNotice
                data-testid="event-gap"
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
            {replaceNotes.notes.map((note) => (
              <EditorReplaceNote
                key={note.id}
                path={note.path}
                at={note.at}
                changes={note.changes}
                tellBlocked={tellBlocked}
                onTell={() => {
                  tell(messageFor(note));
                  closeReplaceNote(note.id);
                }}
                onDismiss={() => closeReplaceNote(note.id)}
              />
            ))}
          </ConversationStream>
          <div className="ah-actionable-notices">
            {github}
            {!statusStale && current?.auth_error === "pi_auth_failed" ? (
              <WarningBanner
                data-testid="provider-auth-error"
                tone="danger"
                title="Kielimallikirjautuminen ei ole kunnossa"
                actions={
                  <ControlButton
                    data-testid="notice-action"
                    size="row"
                    variant="primary"
                    onPress={() =>
                      navigate(
                        `/workspaces/${(workspace.place?.parent ?? workspace).workspace_id}?conversation=${encodeURIComponent(id ?? "")}&pi_sign_in=1`,
                      )
                    }
                  >
                    Kirjaudu uudelleen
                  </ControlButton>
                }
              >
                Kirjaudu OpenAI-tilillesi uudelleen ja jatka sitten keskustelua.
                Viestiä ei lähetetä automaattisesti uudelleen; luonnos säilyy.
              </WarningBanner>
            ) : null}
            {!statusStale && current?.auth_error === "pi_model_unsupported" ? (
              <WarningBanner
                data-testid="model-unavailable"
                tone="danger"
                title="Valittu kielimalli ei ole käytettävissä"
                actions={
                  <ControlButton
                    data-testid="notice-action"
                    size="row"
                    onPress={() => {
                      setModelExpanded(!modelExpanded);
                    }}
                  >
                    Valitse toinen malli
                  </ControlButton>
                }
              >
                Agentti ilmoitti, ettei valittu malli ole tuettu tällä
                ChatGPT-tilillä. Valitse toinen malli ja aloita uusi keskustelu.
                Viestiä ei toisteta; luonnos säilyy.
              </WarningBanner>
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
                data-testid="conversation-recheck"
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
                data-testid="title-error"
                title="Otsikkoa ei voitu luoda"
                description={titleError || undefined}
                tone="danger"
              />
            ) : null}
            {statusStale || storagePressure.full ? null : notices}
            {held.notice ? (
              <p
                data-testid="held-message-notice"
                className="ah-held-notice"
                role="status"
              >
                {held.notice}
              </p>
            ) : null}
          </div>
          {(recapFailed
            ? !recapFailedDismissed
            : !recapDismissed &&
              (shownRecap ||
                outdatedRequest ||
                recapBusy ||
                recapError ||
                recapUncertain)) && (
            <RecapCard
              // Only "Tilannekatsaus": the header and sidebar already say
              // who is waiting (Jari 16.10.2026).
              recap={shownRecap}
              latestAt={recapCurrent?.latestAt}
              now={recapNow}
              pending={!!recapBusy}
              onDismiss={
                recapFailed
                  ? () =>
                      setDismissedRecap(
                        `${dismissalKey}:failed:${recapFailed.through}`,
                      )
                  : recapFingerprint
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
              error={!!recapError || (!recapBusy && !!recapFailed)}
              failure={recapBusy ? undefined : recapReason}
              uncertain={!!recapUncertain}
              unverifiable={!!recapCurrent?.unavailable}
              unavailable={recapUnavailable}
              unavailableReason={recapUnavailableReason}
              onRequest={requestRecapNow}
              settingsHref={settingsHref("tilannekatsaus")}
              onOpenSettings={() => navigate(settingsHref("tilannekatsaus"))}
            />
          )}
          {controlled ? (
            <>
              {/* The top bar says Odottaa taustatyötä (Jari 16.10.2026);
                  the strip marks only which work is waited on. */}
              <BackgroundStrip
                agentIdle={
                  presentation.activity === "waiting_background" ||
                  presentation.activity === "waiting"
                }
                piNotRunning={bridgeExpected}
                ask={workerAsk}
              />
              {id ? (
                <NextWaitingDock
                  next={nextWaiting}
                  agentId={id}
                  working={presentation.activity === "working"}
                  needsYou={
                    statusStale || !current || !!current.pending_question
                  }
                />
              ) : null}
              <Composer
                csrf={csrf}
                speech={speech}
                modelPicker={
                  canChooseFirstModel ? (
                    <ComposerModelPicker
                      key={id}
                      model={selectedModel}
                      thinking={selectedThinking}
                      models={models?.models}
                    >
                      {(close) => (
                        <PiModelSelector
                          csrf={csrf}
                          scope="empty"
                          onBlocked={setModelBlocked}
                          current={selectedModel}
                          currentThinking={selectedThinking}
                          onChoice={(choice) => {
                            setModelChoice(choice);
                            close();
                          }}
                        />
                      )}
                    </ComposerModelPicker>
                  ) : undefined
                }
                value={draft}
                goals={goals}
                onChange={(value) => {
                  changeDraft(value);
                  // The first character wakes a resting agent; nothing else does.
                  if (value.trim() && resting) rest.onTyping();
                }}
                idlePlaceholder={
                  restCard && rest.wake !== "awake"
                    ? "Kirjoita, niin agentti herää…"
                    : undefined
                }
                onActivity={recapHold.note}
                activity={
                  !notStarted &&
                  (current?.run_active ?? current?.state === "accepted")
                    ? "working"
                    : "idle"
                }
                selectedWorkingMode={workingMode}
                queue={
                  shownQueue
                    ? {
                        steering: shownQueue.steering,
                        followUp: shownQueue.follow_up,
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
                      : stopPhase
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
                    showMissedEvents(!!live?.missed, current) ||
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
                    : { state: "unknown", reason: sendBlocked }
                }
                onSendNow={(text = draft) => {
                  if (text !== draft) changeDraft(text);
                  if (draft.trim() && canSend) {
                    dismissRecapOnSend();
                    rest.onSend();
                  }
                  if (notStarted) {
                    // A new conversation's first message carries the model
                    // chosen in its field, as a direct first send does.
                    if (canSend)
                      held.submit(
                        text,
                        canChooseFirstModel ? modelChoice : undefined,
                      );
                  } else void submit(text);
                }}
                onSteer={(text = draft) => {
                  if (text !== draft) changeDraft(text);
                  if (draft.trim()) dismissRecapOnSend();
                  void submitQueue("steer", text);
                }}
                onFollowUp={(text = draft) => {
                  if (text !== draft) changeDraft(text);
                  if (draft.trim()) dismissRecapOnSend();
                  void submitQueue("follow_up", text);
                }}
                onModeChange={setWorkingMode}
                onInterrupt={
                  (current?.run_active ?? current?.state === "accepted") &&
                  !statusStale
                    ? () => void stopNow()
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
