import {
  type ComponentProps,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router";
import "./composerStack.css";
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
import {
  type ArchiveControlsProps,
  archiveAction,
} from "../components/ArchiveControls";
import { agentPresentation } from "../components/agentPresentation";
import { BackgroundStrip, type WorkerAsk } from "../components/BackgroundStrip";
import { BashToolCard } from "../components/BashToolCard";
import { CompactionNotice } from "../components/CompactionNotice";
import { ComposerModelPicker } from "../components/ComposerModelPicker";
import { ContextPage } from "../components/ContextPage";
import { ContextRing } from "../components/ContextRing";
import { ContextView } from "../components/ContextView";
import { ControlButton, controlClassName } from "../components/ControlElements";
import { ArchivedFoot } from "../components/ConversationArchive";
import { ConversationWeight } from "../components/ConversationWeight";
import { CommandRun } from "../components/composer/CommandRun";
import { EditorReplaceNote } from "../components/EditorReplaceNote";
import { FileToolCard, fileStat } from "../components/FileToolCard";
import type { MarkState } from "../components/HabitatMark";
import { Icon } from "../components/Icon";
import { ModelChip, modelSummary } from "../components/ModelChip";
import { activityMark } from "../components/markState";
import { NoticeStack, NoticeStackProvider } from "../components/NoticeStack";
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
import { goalRequest } from "../components/StartHere";
import { WarningBanner } from "../components/WarningBanner";
import { UnpresentedEvents } from "../components/WorkingProgress";
import { formatDate, liveText } from "../i18n";
import { browserConversationText } from "../text/browserConversation";
import {
  AISignedInNotice,
  AISignInWarning,
  useAISignIn,
  useOpenConversation,
  wentAfterSignIn,
} from "./AISignIn";
import { useExperimentalFeature } from "./accountPreferences";
import {
  type AIProvider,
  clearWaiting,
  conversationProvider,
  failuresSeen,
  markRestored,
  refusedTurn,
  restoredFrom,
  sendCommand,
  signedInFor,
  signIns,
  useWaiting,
  waitingLine,
  writeWaiting,
} from "./aiSignIn";
import { useBrowserShell } from "./BrowserShell";
import { toolStopped } from "./bashFailure";
import { useConversationActions } from "./ConversationActions";
import { ConversationGitStatus } from "./ConversationGitStatus";
import { compactionNotice } from "./compactionNotice";
import { useCompaction } from "./compactionView";
import {
  readCommands,
  readFiles,
  readFileTree,
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
import { messageFor } from "./editorChanges";
import {
  authoredGoals,
  composerGoals,
  conversationGoal,
  creationGuideOwner,
  goalConversationName,
  guideOpensItself,
  guideOwner,
  prepareField,
  readFirstSkill,
  setGuide,
  useGuide,
  usePreparedField,
} from "./goalGuide";
import { ArchivedHelpers, HelperRestoreNote } from "./HelperArchiveFlow";
import { type LiveTurnInput, TurnText, timelineItems } from "./HistoryView";
import { piNotRunning, restoreToDraft, useHeldMessages } from "./heldMessages";
import { startProblemReason } from "./mutations";
import { type NextWaiting, NextWaitingDock } from "./NextWaitingDock";
import {
  nameRefused,
  namingRefusal,
  titleModelUnavailable,
} from "./namingRefusal";
import { useNextWaitingWindow } from "./nextWaiting";
import { sshTarget } from "./ownMachines";
import {
  OwnMachineUseProvider,
  useOpenMachines,
  useOwnMachineHosts,
} from "./ownMachineUse";
import {
  type Creation,
  CreationNotice,
  CreationStream,
  creationBlock,
  creationHeader,
  LoadingStream,
  loadingHeader,
  useCreation,
} from "./PendingConversation";
import {
  type Choice,
  ConversationModelInfo,
  PiModelSelector,
} from "./PiModelSelector";
import { shortModel, usePiModels } from "./PiModels";
import { PiQuestion } from "./PiQuestion";
import { useBridgeExpected } from "./processWarmup";
import { useRecapHold, useRecapPresentationHold } from "./recapHold";
import { useRest } from "./rest";
import { useRewind, withRewind } from "./rewindView";
import { ServerBrowserDock } from "./ServerBrowser";
import { SpinoffProvider } from "./SpinoffConversation";
import { StartPageRead } from "./StartPageRead";
import { useStoragePressure } from "./StoragePressure";
import { useSentMessages, shownQueue as withSentQueue } from "./sentMessages";
import { latestSettings } from "./sessionSettings";
import { settingsHref } from "./settingsRoute";
import type { Agent, Snapshot, Workspace } from "./snapshot";
import { TurnChangesRoot } from "./TurnChangesSource";
import { useTurnIdentity } from "./turnIdentity";
import { historyCardDelay, useConversation } from "./useConversation";
import {
  isReadingIntro,
  useFollowLatest,
  useReadingPositionLayout,
} from "./useReadingPosition";
import { useSettledWarning } from "./useSettledWarning";
import { GuideHeaderControl, NoticeEntry, useAssetsControl } from "./ViewHost";
import {
  EditorHeaderControls,
  useEditorActivity,
  useReplaceNotes,
} from "./WorkspaceEditor";
import { requestPhases, requestText } from "./workerRequests";

const txt = liveText(browserConversationText);

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
  // One view per conversation. A conversation created here keeps the view
  // (and the field the person is typing in) that it was created in.
  const view = props.viewKey ?? `${props.identity}:${props.id}`;
  return (
    <SpinoffProvider
      key={view}
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
        key={view}
        id={props.id}
        csrf={props.csrf}
        onLogin={props.onLogin}
        onStatusEvent={props.onStatusEvent}
      >
        <OwnMachineUseProvider key={view}>
          <NoticeStackProvider>
            <BrowserConversationContent
              {...props}
              onNativeHistory={setNativeHistory}
            />
          </NoticeStackProvider>
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
  onRename,
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
  creation,
}: {
  /** A conversation this tab is creating, shown until it has an ID. */
  creation?: Creation;
  /** Names the view instead of the conversation ID; see BrowserConversation. */
  viewKey?: string;
  /** The walk to the next conversation waiting for the person (experimental). */
  nextWaiting?: NextWaiting;
  /** The person's GitHub connection, when it needs saying here: the app
   * reads it from the snapshot, not from this conversation. */
  github?: ReactNode;
  workspace: Workspace;
  archive?: Agent;
  onArchive?: (agent: Agent, archived: boolean) => Promise<boolean>;
  onClose?: (agent: Agent) => Promise<unknown>;
  onRename?: (id: string, name: string, workspaceId: string) => Promise<void>;
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
  const creating = !id && !!creation;
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
    answeredKey,
    sentAfterKey,
    resentKey,
    lostSend,
    endUnknown,
    releaseUnknown,
    changeDraft,
    refresh,
    setBusy,
    setReceipt,
    setSendObservation,
    setContinuation,
    navigate,
    historyError,
    historyCut,
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
  // The card waits for the quiet re-read (useConversation): a refusal it
  // fixes is never shown. A cut record is shown at once.
  const historyCard = useSettledWarning(
    historyError,
    `${identity}/${id ?? ""}`,
    historyCut ? 800 : historyCardDelay,
  );
  // An explicit check shows that it ran: Checking… while it runs, and for
  // a history that still cannot be read, that it was checked.
  const [recheck, setRecheck] = useState<{
    key: string;
    state: "running" | "done";
    /** When it was done: a press that finds the same shows a new time. */
    at?: number;
  }>();
  const recheckKey = `${identity}/${id ?? ""}`;
  const recheckState = recheck?.key === recheckKey ? recheck.state : undefined;
  const checkedAt = formatDate(recheck?.at ?? Date.now(), {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
  const runRecheck = () => {
    if (
      continuation &&
      continuation !== "uncertain" &&
      continuation !== "pending"
    )
      setContinuation(undefined);
    setRecheck({ key: recheckKey, state: "running" });
    // An explicit check may prove an ended conversation.
    void refresh(true, true).finally(() =>
      setRecheck((r) =>
        r?.key === recheckKey && r.state === "running"
          ? { key: recheckKey, state: "done", at: Date.now() }
          : r,
      ),
    );
  };
  // A result belongs to the failure it checked: once the history reads
  // again, a later failure starts without one.
  useEffect(() => {
    if (!historyError) setRecheck(undefined);
  }, [historyError]);
  // Likewise a check belongs to the send whose outcome it looked for.
  useEffect(() => {
    void sendObservation?.command;
    setRecheck(undefined);
  }, [sendObservation?.command]);
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
    ) ?? txt.modelUnknown;
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
  // A compaction from the page reads it again when Pi has answered.
  const [contextRead, setContextRead] = useState(0);
  const contextDetail = useContextDetail(
    id,
    contextOpen,
    `${entries.at(-1)?.entry_key}:${entries.length}:${contextState?.phase}:${contextRead}`,
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
    if (contextWasOpen.current && !contextOpen) {
      const phoneTrigger = document.querySelector<HTMLElement>(
        ".ah-agent-header .ah-phone-facts",
      );
      if (phoneTrigger?.getClientRects().length) phoneTrigger.focus();
      else
        document
          .querySelector<HTMLElement>(
            ".ah-agent-header [data-testid='context-ring']",
          )
          ?.focus();
    }
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
    document.title = txt.attention(old);
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
  const { held: recapHeld, reveal: revealRecap } = useRecapPresentationHold({
    key: recapKey,
    fingerprint: recapFingerprint,
    received: !!recapCurrent,
    automatic: recapCurrent?.recap?.trigger === "automatic",
    activity: recapHold,
  });
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
      ? txt.resting
      : current?.state !== "idle" && current?.state !== "rejected"
        ? txt.waitTurn
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

  const waitingWindow = useNextWaitingWindow(
    id,
    current,
    statusStale,
    archive?.archive === "archived",
  );
  const {
    start,
    submit: submitDirect,
    submitQueue: submitQueueDirect,
    clearNativeQueue,
    stopNow,
    stopAttempt,
    clearStopAttempt,
    restoredQueue,
    notices,
    sendUncertain,
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
    answeredKey,
    sentAfterKey,
    resentKey,
    lostSend,
    setBusy,
    setReceipt,
    setSendObservation,
    setConfirmStop,
    changeDraft,
    onSent,
    onQueued,
    queued,
    onSendOutcome: waitingWindow.outcome,
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
    onSendOutcome: waitingWindow.outcome,
  });
  // A message that carries the text of one whose outcome is unknown is that
  // message sent again by the person (Jari 9.11.2026): its record ends, so
  // no warning claims the text is still in the field and nothing gives it
  // back or sends it a second time.
  const submit = async (
    text = draft,
    keepDraft = false,
    commandId?: string,
  ) => {
    held.setNotice("");
    const sent = await submitDirect(text, keepDraft, commandId);
    // A held message's lasting outcome notice is over once another send goes.
    if (sent) {
      held.release(text);
      held.setNotice("");
    }
    return sent;
  };
  const submitQueue: typeof submitQueueDirect = (kind, text, keepDraft) => {
    held.setNotice("");
    return submitQueueDirect(kind, text, keepDraft);
  };
  const sendHeld: typeof held.submit = (text, ...rest) => {
    releaseUnknown(text);
    // A notice about an earlier send's outcome is over once a new one goes,
    // as a direct send's progress replaces it.
    setReceipt("");
    held.submit(text, ...rest);
  };
  // One warning says that a message's outcome is unknown: this tab's direct
  // send, or messages it sent while the agent was not running. It says the
  // text is in the field only while the field holds it.
  const unknownSend =
    sendUncertain ?? (held.uncertain.length ? ("held" as const) : undefined);
  const unknownInField = (
    sendUncertain && sendObservation ? [sendObservation.text] : held.uncertain
  ).every((text) => draft.includes(text.trim()));
  const creationView = useCreation(
    creating ? creation : undefined,
    held.takeBack,
    section,
  );
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
      ? txt.archived
      : archive?.archive === "unknown"
        ? txt.archiveUnknown
        : modelBlocked
          ? txt.chooseOtherModel
          : serverUnavailable
            ? txt.serverLost
            : statusStale
              ? txt.statusStale
              : txt.waitIdleUncertain;
  // While the conversation opens, or an earlier send or Stop is on its way,
  // the view cannot act on a message yet; one sent meanwhile is kept (below)
  // and goes when it can. Any other block, a lost status read included, is
  // a refusal the composer words: nothing refused is sent later.
  // The person's last command was answered and its outcome is on its way.
  const awaitingOutcome = sendObservation?.state === "pending";
  const sendRefused =
    archive?.archive === "archived" ||
    archive?.archive === "unknown" ||
    (!!ambiguous && !notStarted && !busy && !awaitingOutcome) ||
    statusStale ||
    serverUnavailable ||
    modelBlocked ||
    current?.auth_error === "pi_model_unsupported" ||
    !!problem;
  const sendWhenReady =
    !sendRefused &&
    (!controlled ||
      busy ||
      (!!ambiguous && awaitingOutcome) ||
      held.busy ||
      current.state === "pending" ||
      current.state === "accepted" ||
      current.state === "stopping");
  // The first character wakes a resting agent; nothing else does. A
  // character typed before the view knows of a rest (while it opens) wakes
  // the agent once it does.
  const restKnown = controlled && !!archive && !statusStale;
  const typedUnknown = useRef<string | undefined>(undefined);
  const typed = (value: string) => {
    if (!value.trim()) return;
    if (resting) rest.onTyping();
    else if (!restKnown) typedUnknown.current = id;
  };
  useEffect(() => {
    if (!restKnown || !typedUnknown.current) return;
    if (typedUnknown.current === id && resting) rest.onTyping();
    typedUnknown.current = undefined;
  }, [restKnown, resting, id, rest.onTyping]);
  // *Kerro agentille* sends at once, the way the composer's send button would
  // now: during a turn in the selected working mode, otherwise directly or
  // held until Pi starts. The person's draft stays as it is.
  const tellWorking =
    !notStarted && (current?.run_active ?? current?.state === "accepted");
  const tellBlocked = !canSend
    ? sendBlocked
    : !notStarted && !tellWorking && current?.state === "accepted"
      ? txt.waitIdle
      : undefined;
  const tell = (text: string) => {
    dismissRecapOnSend();
    rest.onSend();
    if (notStarted)
      sendHeld(text, canChooseFirstModel ? modelChoice : undefined, true);
    else if (tellWorking) void submitQueue(workingMode, text, true);
    else void submit(text, true);
  };
  // An AI provider refusing the person's sign-in (aiSignIn.ts). This
  // conversation is refused when its own newest reply was refused and the
  // host has not since reported the refusal over, or when its provider is
  // refused anywhere. Its failed message waits in the field and goes by
  // itself once the provider takes the person back; so does one sent while
  // refused.
  const aiSignIn = useAISignIn();
  useOpenConversation(id);
  const [, signedInTick] = useState(0);
  const chatProvider = conversationProvider(entries, current?.startup_choice);
  const ownFailure = useMemo(() => {
    const turn = refusedTurn(entries);
    if (turn)
      return {
        ...turn,
        at: entries.find((e) => e.entry_key === turn.key)?.timestamp,
      };
    // The daemon's own classification, before or without a saved reply.
    if (current?.auth_error !== "pi_auth_failed") return undefined;
    // A status that still names the command this tab's newer send replaced
    // was read before the host took that send; the send's own message is
    // not the refused one. A refusal of any later command still counts.
    if (
      sendObservation?.supersedes &&
      sendObservation.supersedes === current.command_id &&
      sendObservation.command !== current.command_id &&
      sendObservation.state !== "rejected"
    )
      return undefined;
    const asked =
      sendObservation && sendObservation.command === current.command_id
        ? sendObservation.text
        : (entries.findLast((e) => e.kind === "user")?.content.text ?? "");
    return {
      provider: chatProvider ?? ("openai-codex" as const),
      key: `cmd:${current.command_id ?? ""}`,
      text: asked.trim(),
      at: undefined,
    };
  }, [entries, current, sendObservation, chatProvider]);
  useEffect(() => {
    if (id && ownFailure)
      failuresSeen.set(id, {
        provider: ownFailure.provider,
        key: ownFailure.key,
      });
  }, [id, ownFailure]);
  useEffect(() => {
    const heard = () => signedInTick((n) => n + 1);
    signIns.addEventListener("signed-in", heard);
    return () => signIns.removeEventListener("signed-in", heard);
  }, []);
  const capturedAt = recoverySnapshot?.captured_at;
  const ownRefused =
    ownFailure &&
    !signedInFor.has(`${id}:${ownFailure.key}`) &&
    // A snapshot taken after the refusal that no longer names the provider:
    // signed in elsewhere, or answered since.
    !(
      ownFailure.at &&
      capturedAt &&
      Date.parse(capturedAt) > Date.parse(ownFailure.at) &&
      !aiSignIn.refused.includes(ownFailure.provider)
    )
      ? ownFailure.provider
      : undefined;
  const refusedHere =
    ownRefused ??
    (chatProvider && aiSignIn.refused.includes(chatProvider)
      ? chatProvider
      : undefined);
  const waiting = useWaiting(identity, id);
  const draftNow = () =>
    (id && sessionStorage.getItem(`nah:${identity}:draft:${id}`)) ?? draft;
  // The refused message comes back into the field once per failed reply.
  const viewId = useRef(id);
  viewId.current = id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per failed reply.
  useEffect(() => {
    if (!id || !ownRefused || !ownFailure?.text) return;
    if (restoredFrom(identity, id) === ownFailure.key) return;
    markRestored(identity, id, ownFailure.key);
    const { key, text, provider } = ownFailure;
    const field = draftNow();
    const next = field.includes(text) ? field : restoreToDraft([text], field);
    if (next !== field) changeDraft(next);
    // The marker keeps the refused message alone: anything else the field
    // held makes it an edited message, and the line under the field says
    // that all of it goes.
    writeWaiting(identity, id, {
      command: crypto.randomUUID(),
      provider,
      text,
      ...(key.startsWith("cmd:") ? {} : { from: key }),
    });
  }, [id, identity, ownRefused, ownFailure?.key]);
  // A send while refused waits in the field, as it is.
  const holdForSignIn = (text: string) => {
    if (!id || !refusedHere || !text.trim()) return false;
    if (text !== draftNow()) changeDraft(text);
    writeWaiting(identity, id, {
      command: waiting?.command ?? crypto.randomUUID(),
      provider: refusedHere,
      text,
      ...(waiting?.from ? { from: waiting.from } : {}),
    });
    return true;
  };
  // An emptied field stops the wait.
  useEffect(() => {
    if (id && waiting && !draft.trim()) clearWaiting(identity, id);
  }, [id, identity, waiting, draft]);
  // Once the provider takes the person back the waiting message goes, as
  // the field holds it then. The host must have been heard from: a view
  // still opening does not know yet whether the refusal is over.
  const [signedInNotice, setSignedInNotice] = useState<{
    id: string;
    provider: AIProvider;
    went: boolean;
  }>();
  useEffect(() => {
    if (!id) return;
    const went = wentAfterSignIn.get(id);
    if (!went) return;
    wentAfterSignIn.delete(id);
    setSignedInNotice({ id, provider: went, went: true });
  }, [id]);
  const resendNow =
    !!id &&
    !!waiting &&
    !!draft.trim() &&
    !refusedHere &&
    !!recoverySnapshot &&
    !statusStale &&
    canSend &&
    current?.run_active !== true &&
    (notStarted || current?.state === "idle" || current?.state === "rejected");
  // biome-ignore lint/correctness/useExhaustiveDependencies: when it becomes possible, as the field holds it then.
  useEffect(() => {
    if (!resendNow || !id || !waiting) return;
    const text = draft;
    const done = () => {
      clearWaiting(identity, id);
      setSignedInNotice({ id, provider: waiting.provider, went: true });
    };
    void sendCommand(id, waiting, text).then(async (command) => {
      if (viewId.current !== id || draftNow() !== text) return;
      if (notStarted) {
        sendHeld(text, undefined, false, command);
        done();
      } else if (await submit(text, false, command)) done();
    });
  }, [resendNow, draft]);
  // A lost send proven never to have reached a stopped Pi goes again by
  // itself, once, under its own command ID, held as the composer would send
  // it now: the held message owns it from then on (one bubble, its own
  // receipt), and the direct record ends. The daemon answers an ID it has
  // already taken as that same message, so a duplicated tab cannot double it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: when it becomes possible, as the field holds it then.
  useEffect(() => {
    if (
      !lostSend ||
      !current ||
      !piNotRunning(current.state) ||
      !csrf ||
      serverUnavailable ||
      held.busy ||
      sessionStorage.getItem(sendKey) !== lostSend.command
    )
      return;
    const { command, text } = lostSend;
    held.submit(text, undefined, true, command);
    endUnknown(command);
    if (draftNow() === text) changeDraft("");
  }, [lostSend, current, csrf, serverUnavailable, held.busy]);
  const aiNotice =
    !statusStale && refusedHere ? (
      <AISignInWarning
        provider={refusedHere}
        onFix={() => aiSignIn.open(refusedHere)}
      />
    ) : signedInNotice?.id === id && signedInNotice ? (
      <AISignedInNotice
        provider={signedInNotice.provider}
        went={signedInNotice.went}
      />
    ) : null;
  // Messages sent before the view could act on them, in order. The text
  // leaves the field as a sent one does and waits as a bubble; each goes
  // the way the send button would send it then, once it can. A view that
  // turns out unable to send gives them back into the field and says why,
  // and so does leaving the conversation before they went.
  const keptKey = `${identity}:${id ?? ""}`;
  // Stored as they are kept, so a reload or a closed tab loses none of them.
  const keptStorage = id ? `nah:${identity}:kept:${id}` : "";
  const draftStorage = id ? `nah:${identity}:draft:${id}` : "";
  type Kept = { id: string; text: string; mode?: "steer" | "follow_up" };
  const [kept, setKeptState] = useState<{ key: string; items: Kept[] }>();
  const keptItems = kept?.key === keptKey ? kept.items : [];
  const setKept = (change: (items: Kept[]) => Kept[]) =>
    setKeptState((old) => {
      const items = change(old?.key === keptKey ? old.items : []);
      if (keptStorage)
        if (items.length)
          sessionStorage.setItem(keptStorage, JSON.stringify(items));
        else sessionStorage.removeItem(keptStorage);
      return { key: keptKey, items };
    });
  const keep = (text: string, mode?: "steer" | "follow_up") => {
    if (!text.trim()) return;
    setKept((items) => [...items, { id: crypto.randomUUID(), text, mode }]);
    changeDraft("");
  };
  const keeps = keptItems.length > 0 || (!canSend && sendWhenReady);
  // Into the field as it is now: another restore may have just changed it.
  const restoreKept = (texts: string[]) =>
    changeDraft(
      restoreToDraft(
        texts,
        (draftStorage && sessionStorage.getItem(draftStorage)) ?? draft,
      ),
    );
  const giveBackKept = (reason?: string) => {
    setKept(() => []);
    restoreKept(keptItems.map((k) => k.text));
    if (reason) held.setNotice(txt.keptNotSent(reason));
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: the first kept message goes when the view's state allows it.
  useEffect(() => {
    const next = keptItems[0];
    if (!next || (tellBlocked && sendWhenReady)) return;
    if (tellBlocked)
      return giveBackKept(
        controlled || sendRefused ? tellBlocked : problem || txt.loading,
      );
    setKept((items) => items.slice(1));
    if (next.mode && tellWorking) void submitQueue(next.mode, next.text, true);
    else tell(next.text);
  }, [keptItems, tellBlocked, sendWhenReady]);
  // Messages kept by a view that is gone (left, reloaded) were never sent:
  // they come back into the field rather than go later unasked.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per conversation shown.
  useEffect(() => {
    if (!keptStorage) return;
    let left: Kept[] = [];
    try {
      left = JSON.parse(sessionStorage.getItem(keptStorage) ?? "[]");
    } catch {
      /* Unreadable: nothing to give back. */
    }
    sessionStorage.removeItem(keptStorage);
    if (Array.isArray(left) && left.length)
      restoreKept(left.map((k) => String(k.text)));
  }, [keptStorage]);
  // Kerro agentille on an ended worker's row: this conversation started it.
  // A request during a turn waits as a follow-up; a steer would redirect
  // the turn the person started.
  const spinoffs = useContext(SpinoffContext);
  const assets = useAssetsControl(id);
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
        sendHeld(text, canChooseFirstModel ? modelChoice : undefined, true);
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
      : ({ state: "unknown", reason: txt.waitConfirmed } as const);
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
          error instanceof NotAdmitted ? txt.bashRefused : txt.bashUncertain,
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
        setReceipt(txt.bashStopUncertain);
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
          ? txt.bashNotStarted(bash.command)
          : txt.bashUnknown(bash.command),
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
  const goals = composerGoals(page);
  const guide = id
    ? guideOwner(identity, id)
    : creating
      ? creationGuideOwner(identity, workspace.workspace_id)
      : undefined;
  const startedGoal = useGuide(guide)?.goal;
  const preparedPlaceholder =
    startedGoal &&
    !startedGoal.skill &&
    !entries.length &&
    !next &&
    !held.waiting.length
      ? goalRequest(startedGoal).placeholder
      : undefined;
  // A goal chosen before this conversation existed keeps its selection.
  usePreparedField(guide, section);
  const loadedGoal = conversationGoal(page, startedGoal, entries, draft);
  // Older history holds the first message: read just its start, once.
  const [first, setFirst] = useState<{ key: string; skill?: string }>();
  const firstWanted =
    !!next && !loadedGoal && authoredGoals(page).some((g) => g.skill);
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
                  reason: txt.waitConfirmed,
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
      files: (query: string, signal: AbortSignal, rank?: "name") =>
        readFiles(runWorkspace, query, signal, rank),
      preview: (path: string, signal: AbortSignal) =>
        readPreview(runWorkspace, path, signal),
      tree: (folder: string | null, signal: AbortSignal) =>
        readFileTree(runWorkspace, folder, signal),
      workspaceName: workspace.display_name ?? workspace.name,
    }),
    [sourcesKey],
  );
  // A conversation that opens without another focus target gives the field
  // the focus, so the person can type at once: as it starts loading, or, if
  // something else still had the focus then (the link that opened it), once
  // it has opened. The same field stays through the loading.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs are only used for the first opening focus.
  useEffect(() => {
    if (!id || (opened && !controlled) || focusedOnOpen.current) return;
    // The heading the app focuses on navigation is where the route lands,
    // not a target the person chose.
    const active = document.activeElement;
    const free =
      !active ||
      active === document.body ||
      (active.tagName === "H1" && !!section.current?.contains(active));
    if (controlled || free) focusedOnOpen.current = true;
    if (!free) return;
    const field = section.current?.querySelector<HTMLTextAreaElement>(
      ".ah-composer textarea",
    );
    if (!field) return;
    // A draft kept from an earlier visit goes on from its end instead of
    // having the next words land in front of it.
    field.focus({ preventScroll: true });
    field.setSelectionRange(field.value.length, field.value.length);
  }, [id, opened && !controlled, controlled]);
  const presentation = agentPresentation({
    process: statusStale ? "stale" : "daemon_managed_live",
    command: current && !statusStale ? current.state : undefined,
    runActive: statusStale ? undefined : current?.run_active,
    waitingOn: archive?.waiting_on,
    pendingQuestion: !statusStale && !!current?.pending_question,
  });
  // The header's mark: a stop in progress, then the live turn's phase where
  // it is known, then a failure the rail would show too, then the activity.
  const failedTurn =
    presentation.activity !== "working" &&
    !statusStale &&
    (archive?.failure !== undefined ||
      (archive?.rest?.cause === "crash" && !archive.rest.awake));
  const headerMark: MarkState =
    current?.state === "stopping"
      ? "stopping"
      : failedTurn
        ? "error"
        : activityMark(presentation.activity);
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
          name={item.name ?? txt.tool}
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
          <summary>{txt.bashRunning}</summary>
          <pre>{item.text}</pre>
        </details>
      ) : storagePressure.full ? null : (
        <InlineNotice
          title={
            item.kind === "bash"
              ? txt.bashOutput
              : item.kind === "extension"
                ? txt.extensionNotice
                : txt.agentStatus
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
            ? txt.runs(activeToolName)
            : last?.kind === "tool" && last.name
              ? txt.runs(last.name)
              : last?.kind === "thinking"
                ? txt.thinking
                : txt.replying,
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
  // Palaa tähän (experimental): the own messages' menu, the sheet above the
  // composer and the rows a return leaves.
  // The context view (experimental): the page's list and Tiivistä nyt.
  const contextViewOn = useExperimentalFeature("conversation-context-view");
  const compaction = useCompaction({
    id,
    csrf,
    enabled: contextViewOn && controlled,
    busy: controlled && turnUnderway(current?.state, current?.run_active),
    stopped: notStarted,
    workspaceId: runWorkspace,
    onLogin,
    onSettled: () => setContextRead((n) => n + 1),
  });
  // The conversation says when the agent compacts and why it did not.
  const compactionState = compactionNotice(compaction, live?.fragments);
  const rewindOn = useExperimentalFeature("rewind-conversation");
  const helpersOn = useExperimentalFeature("named-workers");
  const rewind = useRewind({
    id,
    csrf,
    enabled: rewindOn && opened && controlled && !!csrf,
    busy: controlled && turnUnderway(current?.state, current?.run_active),
    stopped: notStarted,
    workspaceId: runWorkspace,
    onLogin,
    onDraft: (text) =>
      changeDraft(
        restoreToDraft(
          [text],
          (draftStorage && sessionStorage.getItem(draftStorage)) ?? draft,
        ),
      ),
    onChanged: () => {
      if (id) void store.reconnect(id);
    },
    renderEntries: (list) => (
      <ol className="ah-feed">
        {timelineItems(list).map((item) => (
          <li key={item.id}>{item.content}</li>
        ))}
      </ol>
    ),
  });
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
    rewind.target,
    archive?.rest?.cause === "restart" && !!archive.interrupted_turn,
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
  const timeline = withRewind(settled.timeline, rewind.controls);
  const composer: ComponentProps<typeof Composer> =
    creating && creation
      ? {
          csrf,
          speech,
          onDictating: creation.onDictating,
          modelPicker: (
            <span
              className={`md-pill ${controlClassName({ size: "inline", presentation: "pill" })}`}
              aria-disabled="true"
            >
              {displayModel} · {selectedThinking ?? txt.agent}
            </span>
          ),
          value: draft,
          goals,
          preparedPlaceholder,
          sources: composerSources,
          onChange: changeDraft,
          activity: "idle",
          selectedWorkingMode: "follow_up",
          editorAvailability: { state: "enabled" },
          availability: creationBlock(creation)
            ? { state: "disabled", reason: creationBlock(creation) ?? "" }
            : { state: "enabled" },
          onSendNow: (text = draft) => {
            if (!text.trim() || creationBlock(creation)) return;
            const first = !held.waiting.length;
            sendHeld(text);
            creationView.setNotice("");
            if (first) creation.worktree?.onFirstMessage?.(text);
          },
          onSteer: () => {},
          onFollowUp: () => {},
          onModeChange: () => {},
          onStopWaiting:
            held.waiting.length && !creation.problem
              ? creationView.giveBack
              : undefined,
        }
      : {
          csrf,
          speech,
          modelPicker:
            canChooseFirstModel && controlled ? (
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
            ) : !controlled ? (
              <span
                className={`md-pill ${controlClassName({ size: "inline", presentation: "pill" })}`}
                aria-disabled="true"
              >
                {txt.agent}
              </span>
            ) : undefined,
          value: draft,
          goals,
          preparedPlaceholder,
          onChange: (value) => {
            changeDraft(value);
            typed(value);
          },
          idlePlaceholder:
            restCard && rest.wake !== "awake" ? txt.wakePlaceholder : undefined,
          onActivity: recapHold.note,
          activity:
            !notStarted &&
            (current?.run_active ?? current?.state === "accepted")
              ? "working"
              : "idle",
          selectedWorkingMode: workingMode,
          queue: shownQueue
            ? {
                steering: shownQueue.steering,
                followUp: shownQueue.follow_up,
              }
            : undefined,
          queueKnown: !!current?.queue,
          onRestoreQueue: () => void clearNativeQueue(),
          restoreAvailability: queueRestoreAvailability,
          shell: composerShell,
          stopState:
            current?.state === "stopping"
              ? "pending"
              : current?.state === "uncertain"
                ? "uncertain"
                : stopPhase,
          sources: composerSources,
          sendState: busy
            ? "pending"
            : ambiguous && !notStarted
              ? "uncertain"
              : "idle",
          // The outage/status notice already explains the block and its remedy.
          // Keep the control's reason accessible, but do not show a second warning.
          refusalSubject: unknownSend ? "send" : undefined,
          suppressAvailabilityReason:
            archive?.archive !== "archived" &&
            archive?.archive !== "unknown" &&
            (serverUnavailable ||
              statusStale ||
              journalOffline ||
              showMissedEvents(!!live?.missed, current) ||
              Boolean(ambiguous && sendObservation?.state === "uncertain")),
          // Status refreshes (including turn completion) guard host writes,
          // not the local draft. Disabling the textarea here drops focus
          // and the caret even if the next status read succeeds.
          editorAvailability: { state: "enabled" },
          availability: canSend
            ? { state: "enabled" }
            : {
                state: "unknown",
                reason:
                  controlled || sendRefused
                    ? sendBlocked
                    : problem || txt.loading,
              },
          sendWhenReady,
          waiting:
            waiting && refusedHere
              ? waitingLine(waiting.provider, draft !== waiting.text)
              : undefined,
          onSendNow: (text = draft) => {
            if (holdForSignIn(text)) return;
            setSignedInNotice(undefined);
            if (keeps) return keep(text);
            if (text !== draft) changeDraft(text);
            if (draft.trim() && canSend) {
              dismissRecapOnSend();
              rest.onSend();
            }
            if (notStarted) {
              // A new conversation's first message carries the model
              // chosen in its field, as a direct first send does.
              if (canSend)
                sendHeld(text, canChooseFirstModel ? modelChoice : undefined);
            } else void submit(text);
          },
          onSteer: (text = draft) => {
            if (keeps) return keep(text, "steer");
            if (text !== draft) changeDraft(text);
            if (draft.trim()) dismissRecapOnSend();
            void submitQueue("steer", text);
          },
          onFollowUp: (text = draft) => {
            if (keeps) return keep(text, "follow_up");
            if (text !== draft) changeDraft(text);
            if (draft.trim()) dismissRecapOnSend();
            void submitQueue("follow_up", text);
          },
          onModeChange: setWorkingMode,
          onInterrupt:
            (current?.run_active ?? current?.state === "accepted") &&
            !statusStale
              ? () => void stopNow()
              : undefined,
          onStopWaiting: keptItems.length
            ? () => giveBackKept()
            : waitingForPi && current?.state === "starting" && !statusStale
              ? () => void held.cancel()
              : undefined,
        };
  // Creation, loading and the opened conversation are one view: the frame,
  // the top bar and the composer stay the same elements through them, so
  // what the person is typing, its focus and caret, an open list or a
  // dictation carry on while the conversation becomes ready.
  const view = id ? (opened ? "opened" : "loading") : creating && "creation";
  const headerArchive: ArchiveControlsProps = {
    state: archive?.archive ?? "unknown",
    empty:
      entries.length === 0 &&
      !historyError &&
      !next &&
      !!current &&
      current.native_history !== "unavailable",
    blockedReason: archiveAwaitingSnapshot
      ? txt.awaitingArchive
      : archive
        ? undefined
        : txt.loadingArchive,
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
  };

  return (
    <section ref={section} className="ah-reading-view">
      {!view ? (
        <>
          <h2>{txt.conversations}</h2>
          <NoticeStack />
          <details className="md-new">
            <summary
              className={`md-new-toggle ${controlClassName({ size: "row", text: true })}`}
            >
              {displayModel} · {selectedThinking ?? txt.agent}
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
            <legend className="ah-visually-hidden">{txt.actions}</legend>
            <Button
              data-testid="new-conversation"
              size="page"
              label={txt.startNew}
              availability={
                modelBlocked
                  ? {
                      state: "disabled",
                      reason: txt.chooseModelFirst,
                    }
                  : !csrf
                    ? {
                        state: "unknown",
                        reason: problem
                          ? txt.sessionUnconfirmed
                          : txt.sessionLoading,
                      }
                    : ambiguous
                      ? {
                          state: "unknown",
                          reason: txt.createUncertain,
                        }
                      : busy
                        ? { state: "unknown", reason: txt.creating }
                        : serverUnavailable
                          ? {
                              state: "unknown",
                              reason: txt.serverLostShort,
                            }
                          : { state: "enabled" }
              }
              onPress={() => void start(modelChoice)}
            />
          </fieldset>
        </>
      ) : (
        <ConversationFrame
          view={view}
          className={
            view === "opened" && contextOpen ? "ah-frame-context" : undefined
          }
        >
          {view !== "opened" ? (
            <AgentHeader
              terminal={shell.toggle}
              editorControl={<EditorHeaderControls />}
              titleAction={{
                label: txt.retitle,
                availability: {
                  state: "disabled",
                  reason: txt.nothingToName,
                },
                onPress: () => {},
              }}
              archive={
                creation?.refused && creation.onClose
                  ? {
                      state: "active",
                      empty: true,
                      eligible: true,
                      busy: false,
                      onClose: creation.onClose,
                      onArchive: () => {},
                      onRestore: () => {},
                    }
                  : undefined
              }
              {...(view === "loading" || !creation
                ? loadingHeader(workspace, problem, details, () =>
                    setDetails(!details),
                  )
                : creationHeader(
                    workspace,
                    creation,
                    held.waiting.length,
                    details,
                    () => setDetails(!details),
                    <GuideHeaderControl
                      owner={guide}
                      goal={goal}
                      page={page && !("state" in page) ? page.title : undefined}
                    />,
                  ))}
            />
          ) : (
            <AgentHeader
              openMachines={openMachines}
              data-model={selectedModel}
              data-thinking={selectedThinking}
              editorControl={<EditorHeaderControls />}
              guideControl={
                <GuideHeaderControl
                  owner={guide}
                  goal={goal}
                  page={page && !("state" in page) ? page.title : undefined}
                />
              }
              archive={headerArchive}
              title={title ?? txt.newConversation}
              titlePending={archive?.title.generation_state === "pending"}
              recapAction={
                id
                  ? {
                      availability: recapUnavailable
                        ? {
                            state: "disabled",
                            reason: recapUnavailableReason ?? txt.noControl,
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
                        if (recapFingerprint) revealRecap();
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
                              reason: txt.noControl,
                            }
                          : { state: "enabled" },
                      onSave: async (name) => {
                        if (onRename)
                          await onRename(id, name, workspace.workspace_id);
                        else
                          await renameConversation(
                            id,
                            workspace.workspace_id,
                            name,
                            csrf,
                          ).catch((error: unknown) => {
                            throw nameRefused(error);
                          });
                      },
                    }
                  : undefined
              }
              titleAction={{
                label: txt.retitle,
                availability:
                  entries.length === 0
                    ? {
                        state: "disabled",
                        reason: txt.nothingToName,
                      }
                    : !controlled ||
                        !csrf ||
                        statusStale ||
                        serverUnavailable ||
                        problem
                      ? {
                          state: "disabled",
                          reason: txt.noControl,
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
                      // A refusal wrote nothing: say why, not that the
                      // outcome is unknown.
                      const description =
                        namingRefusal(error) ??
                        (reason === "model_unavailable"
                          ? titleModelUnavailable()
                          : reason === "model_timeout" ||
                              reason === "model_invalid_response"
                            ? txt.titleInvalid
                            : txt.titleUncertain);
                      setTitleActionState((previous) =>
                        previous?.key === key
                          ? {
                              key,
                              version,
                              pending: false,
                              error: description,
                            }
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
                    ? txt.rests
                    : (presentation.operationLabel ??
                      presentation.activityLabel)
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
              activityMark={
                // The resident breathes while Pi thinks (live turn activity).
                headerMark === "working" &&
                liveWorking &&
                !activeToolName &&
                last?.kind === "thinking"
                  ? "thinking"
                  : headerMark
              }
              settings={nativeSettings}
              emptyConversation={emptyConversation}
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
                        const phoneTrigger = event.currentTarget
                          .closest("header")
                          ?.querySelector<HTMLElement>(".ah-phone-facts");
                        if (phoneTrigger?.getClientRects().length)
                          phoneTrigger.focus();
                        else
                          event.currentTarget.querySelector("summary")?.focus();
                      }
                    }}
                    onToggle={(event) => {
                      setChipOpen(event.currentTarget.open);
                      if (
                        event.currentTarget.open &&
                        window.matchMedia("(max-width: 800px)").matches
                      )
                        event.currentTarget
                          .querySelector<HTMLElement>(".md-pop")
                          ?.focus();
                    }}
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
                    <div className="md-pop" tabIndex={-1}>
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
                  label={txt.modelSettings}
                  variant="quiet"
                  size="row"
                  onPress={() => navigate("/settings")}
                />
              }
              detailsFacts={[
                ...(workspace.place
                  ? [
                      {
                        label: txt.workspace,
                        value: workspace.place.parent.path ?? txt.unknown,
                        copy: !!workspace.place.parent.path,
                      },
                      {
                        label: txt.worktree,
                        value: workspace.path || txt.unknown,
                        copy: !!workspace.path,
                      },
                      {
                        label: txt.branch,
                        value: workspace.place.worktree.branch ?? txt.unknown,
                      },
                    ]
                  : [
                      {
                        label: txt.workspace,
                        value: workspace.path ?? txt.unknown,
                        copy: !!workspace.path,
                      },
                    ]),
                {
                  label: txt.model,
                  value: nativeSettings.model ?? txt.agentDefault,
                  copy: !!nativeSettings.model,
                },
                {
                  label: txt.thinkingLevel,
                  value: nativeSettings.thinking ?? txt.agentDefault,
                },
                {
                  label: txt.control,
                  value: controlled ? txt.browserControl : txt.notAvailable,
                },
                {
                  label: txt.started,
                  value: archive?.started_at
                    ? formatDate(new Date(archive.started_at), {
                        dateStyle: "short",
                        timeStyle: "medium",
                      })
                    : txt.unknown,
                },
                { label: txt.nativeId, value: id ?? "", copy: true },
              ]}
              controlKind={controlled ? "neutral" : "read-only"}
              controlLabel={
                controlled ? txt.browserControl : txt.controlUnavailable
              }
              workspaceLabel={workspace.display_name ?? workspace.name}
              workspaceHref={`/workspaces/${(workspace.place?.parent ?? workspace).workspace_id}`}
              detailsExpanded={details}
              onToggleDetails={() => {
                setDetails(!details);
                setModelExpanded(false);
              }}
            />
          )}
          {view === "opened" && contextOpen ? (
            <ContextPage
              detail={contextDetail}
              usage={contextState}
              title={title ?? txt.conversation}
              onClose={toggleContext}
              view={
                contextViewOn
                  ? (detail) => (
                      <ContextView
                        detail={detail}
                        usage={contextState}
                        compaction={compaction}
                      />
                    )
                  : undefined
              }
            />
          ) : null}
          {view === "opened" ? (
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
                    label={txt.loadOlder}
                    onPress={() => {
                      captureAnchor();
                      if (id) void store.older(id);
                    }}
                  />
                </div>
              ) : null}
              {transientNotices.map((notice) => (
                <NoticeEntry key={notice.notice_id} notice={notice} />
              ))}
              {storagePressure.full ? null : (
                <UnpresentedEvents
                  events={events}
                  liveEvents={live?.fragments}
                />
              )}
              {cutOff && (
                <WarningBanner
                  data-testid="history-cut-off"
                  tone="neutral"
                  title={txt.cutOff}
                  actions={
                    <Button
                      size="row"
                      variant="secondary"
                      label={txt.newConversation}
                      onPress={() =>
                        navigate(`/workspaces/${workspace.workspace_id}`)
                      }
                    />
                  }
                >
                  {txt.cutOffDetail}
                </WarningBanner>
              )}
              <TurnChangesRoot.Provider value={workspace.path}>
                <ConversationTimeline
                  suppressProblem
                  problem={{
                    title: txt.historyUnavailable,
                    description: txt.historyUnavailableDetail,
                  }}
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
                    visibleHistoryError
                      ? entries.length
                        ? "stale"
                        : "error"
                      : // A live turn ends the start page even before its
                        // native history is read; otherwise the intro would stay
                        // above it and keep the view from following the work.
                        entries.length ||
                          held.waiting.length ||
                          keptItems.length ||
                          liveRow ||
                          ownMessage
                        ? "ready"
                        : "empty"
                  }
                  items={[
                    ...timeline,
                    ...(restCard
                      ? [
                          {
                            id: "rest-card",
                            kind: "receipt",
                            content: restCard,
                          },
                        ]
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
                                  ownMessage.pending ? txt.sending : undefined
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
                          // way; a reload knows only that one is. An unknown
                          // outcome is the one warning above the composer, and
                          // its text is back in the field.
                          sendObservation.state !== "uncertain" &&
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
                          onCopy={() =>
                            void navigator.clipboard?.writeText(w.text)
                          }
                        />
                      ),
                    })),
                    ...keptItems.map((k) => ({
                      id: `kept:${k.id}`,
                      kind: "user",
                      content: (
                        <WaitingMessage
                          text={k.text}
                          state="waiting"
                          onCopy={() =>
                            void navigator.clipboard?.writeText(k.text)
                          }
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
                                reason={startProblemReason(
                                  current?.start_problem,
                                )}
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
                    (current?.state === "working" ||
                      current?.state === "accepted")
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
              </TurnChangesRoot.Provider>
              {compactionState ? (
                <CompactionNotice notice={compactionState} />
              ) : null}
              {(!current?.pending_question || statusStale) &&
              questionOutcome ? (
                <WarningBanner subject="question" tone="neutral">
                  {questionOutcome === "stale"
                    ? txt.questionStale
                    : txt.questionUncertain}
                </WarningBanner>
              ) : null}
              {/* Normal progress belongs to the turn header, not a second row
                that mounts/unmounts beneath streaming content. */}
              {current?.state === "stopping" ||
              current?.state === "uncertain" ? (
                <WorkingProgress state={current.state} events={events} />
              ) : current?.state === "stopped" &&
                current.interrupted &&
                !held.waiting.length ? (
                <WorkingProgress state="uncertain" events={events} />
              ) : null}
              {statusStale && !serverUnavailable ? (
                <WarningBanner
                  data-testid="conversation-stale"
                  title={txt.stale}
                  tone="neutral"
                  actions={
                    <Button
                      size="row"
                      variant="secondary"
                      label={txt.check}
                      onPress={() => {
                        if (
                          continuation &&
                          continuation !== "uncertain" &&
                          continuation !== "pending"
                        )
                          setContinuation(undefined);
                        void refresh(true, true);
                      }}
                    />
                  }
                >
                  {txt.staleDetail}
                </WarningBanner>
              ) : null}
              {journalOffline && !statusStale && !serverUnavailable ? (
                <WarningBanner
                  subject="connection"
                  title={txt.journalLost}
                  tone="neutral"
                >
                  {txt.journalLostDetail}
                </WarningBanner>
              ) : null}
              {!statusStale &&
              !serverUnavailable &&
              showMissedEvents(!!live?.missed, current) ? (
                <WarningBanner
                  data-testid="event-gap"
                  title={txt.missed}
                  tone="neutral"
                >
                  {txt.missedDetail}
                </WarningBanner>
              ) : null}
              {events.length && current?.native_history !== "present" ? (
                <p role="status">{txt.eventsBeforeHistory}</p>
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
              {id ? <HelperRestoreNote agent={id} /> : null}
            </ConversationStream>
          ) : view === "loading" || !creation ? (
            <LoadingStream
              waiting={keptItems.map((k) => k.text)}
              problem={problem || undefined}
              onRetry={() => setOpenAttempt((n) => n + 1)}
            />
          ) : (
            <CreationStream
              workspace={workspace}
              creation={creation}
              waiting={held.waiting}
              draft={draft}
              guide={guide ?? ""}
              snapshot={recoverySnapshot}
              csrf={csrf}
              onChange={changeDraft}
              onPage={(read) => setStartPage({ key: pageKey, page: read })}
              onGiveBack={creationView.giveBack}
            />
          )}
          <div className="ah-composer-stack">
            <NoticeStack />
            {storagePressure.full ? (
              <WarningBanner
                data-testid="storage-full-notice"
                tone="danger"
                title={txt.storageFull}
              >
                {txt.storageFullDetail}
              </WarningBanner>
            ) : null}
            {view === "opened" ? (
              <>
                <div className="ah-actionable-notices">
                  {github}
                  {aiNotice}
                  {id && archive?.archive !== "archived" ? (
                    <ConversationWeight
                      agentId={id}
                      bytes={archive?.native_bytes}
                      onNewConversation={() =>
                        navigate(`/workspaces/${workspace.workspace_id}`)
                      }
                    />
                  ) : null}
                  {!statusStale &&
                  current?.auth_error === "pi_model_unsupported" ? (
                    <WarningBanner
                      data-testid="model-unavailable"
                      tone="danger"
                      title={txt.modelUnsupported}
                      actions={
                        <ControlButton
                          data-testid="notice-action"
                          size="row"
                          onPress={() => {
                            setModelExpanded(!modelExpanded);
                          }}
                        >
                          {txt.chooseModel}
                        </ControlButton>
                      }
                    >
                      {txt.modelUnsupportedDetail}
                    </WarningBanner>
                  ) : null}
                  {!statusStale &&
                  current?.auth_error === "pi_model_unsupported" &&
                  modelExpanded ? (
                    <PiModelSelector
                      csrf={csrf}
                      scope="recovery"
                      onChoice={(choice) =>
                        void start(
                          choice,
                          !entries.some((e) => e.kind === "user"),
                        )
                      }
                    />
                  ) : null}
                </div>
                {!statusStale && historyCard && historyCut ? (
                  <div className="ah-status-check">
                    <WarningBanner
                      data-testid="history-unavailable"
                      data-reason="storage_cut"
                      subject="send"
                      tone="neutral"
                      title={txt.historyCut}
                      actions={
                        <Button
                          size="row"
                          variant="secondary"
                          label={txt.newConversation}
                          onPress={() =>
                            navigate(`/workspaces/${workspace.workspace_id}`)
                          }
                        />
                      }
                    >
                      {txt.historyCutDetail}
                      {unknownSend
                        ? ` ${txt.historyUnavailableSend(unknownInField)}`
                        : null}
                    </WarningBanner>
                  </div>
                ) : !statusStale && historyCard ? (
                  <div className="ah-status-check">
                    <WarningBanner
                      data-testid="history-unavailable"
                      subject="send"
                      data-state={recheckState}
                      tone="neutral"
                      title={txt.historyUnavailable}
                      actions={
                        <Button
                          data-testid="conversation-recheck"
                          size="row"
                          variant="secondary"
                          label={
                            recheckState === "running"
                              ? txt.rechecking
                              : txt.recheck
                          }
                          pending={recheckState === "running"}
                          onPress={runRecheck}
                        />
                      }
                    >
                      {/* The one warning also says what the person's own
                        message is waiting for. */}
                      {recheckState === "done"
                        ? txt.historyStillUnavailable(checkedAt)
                        : txt.historyUnavailableDetail}
                      {unknownSend
                        ? ` ${txt.historyUnavailableSend(unknownInField)}`
                        : null}
                    </WarningBanner>
                  </div>
                ) : !statusStale && unknownSend ? (
                  <div className="ah-status-check">
                    <WarningBanner
                      data-testid="send-uncertain"
                      subject="send"
                      data-reason={unknownSend}
                      data-state={recheckState}
                      tone="neutral"
                      title={txt.sendUncertain}
                      actions={
                        <Button
                          data-testid="conversation-recheck"
                          size="row"
                          variant="secondary"
                          label={
                            recheckState === "running"
                              ? txt.rechecking
                              : txt.recheck
                          }
                          pending={recheckState === "running"}
                          onPress={runRecheck}
                        />
                      }
                    >
                      {recheckState === "done"
                        ? txt.sendStillUnknown(checkedAt, unknownInField)
                        : unknownSend === "failed"
                          ? txt.sendUncertainFailed
                          : unknownSend === "held"
                            ? txt.sendUncertainHeld(unknownInField)
                            : txt.sendUncertainDetail(unknownInField)}
                    </WarningBanner>
                  </div>
                ) : !storagePressure.full &&
                  !statusStale &&
                  (visibleRecovery || details) ? (
                  <div className="ah-status-check">
                    <Button
                      data-testid="conversation-recheck"
                      size="row"
                      label={
                        recheckState === "running"
                          ? txt.rechecking
                          : txt.recheck
                      }
                      variant="quiet"
                      pending={recheckState === "running"}
                      onPress={runRecheck}
                    />
                  </div>
                ) : null}
                <div className="ah-conversation-notices">
                  {titleError ? (
                    <WarningBanner
                      data-testid="title-error"
                      tone="danger"
                      title={txt.titleFailed}
                      lifetime="event"
                    >
                      {titleError}
                    </WarningBanner>
                  ) : null}
                  {statusStale ? null : notices}
                  {held.notice ? (
                    <WarningBanner
                      data-testid="held-message-notice"
                      tone={held.noticeLasts ? "danger" : "neutral"}
                      lifetime="event"
                      actions={
                        <ControlButton
                          data-testid="notice-close"
                          size="inline"
                          variant="quiet"
                          presentation="icon"
                          aria-label={txt.dismissNotice}
                          onPress={() => {
                            section.current
                              ?.querySelector<HTMLTextAreaElement>(
                                '[data-testid="message-input"]',
                              )
                              ?.focus();
                            held.setNotice("");
                          }}
                        >
                          <Icon name="cross" />
                        </ControlButton>
                      }
                    >
                      {held.notice}
                    </WarningBanner>
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
                                localStorage.setItem(
                                  dismissalKey,
                                  recapFingerprint,
                                );
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
                    onOpenSettings={() =>
                      navigate(settingsHref("tilannekatsaus"))
                    }
                  />
                )}
              </>
            ) : (
              <CreationNotice notice={creationView.notice} />
            )}
            {view === "opened" ? rewind.sheet : null}
            {view === "opened" && archive?.archive === "archived" ? (
              // Archived: read-only, and the composer's place says so.
              <ArchivedFoot
                archivedAt={archive.archived_at}
                restoreReason={archiveAction(headerArchive).reason || undefined}
                onRestore={headerArchive.onRestore}
              >
                {helpersOn && id ? <ArchivedHelpers agent={id} /> : null}
              </ArchivedFoot>
            ) : view !== "opened" || controlled ? (
              <>
                <ServerBrowserDock identity={identity} csrf={csrf} />
                <Composer
                  {...composer}
                  beforeField={
                    view === "opened" && controlled ? (
                      <>
                        <BackgroundStrip
                          agentIdle={
                            presentation.activity === "waiting_background" ||
                            presentation.activity === "waiting"
                          }
                          piNotRunning={bridgeExpected}
                          ask={workerAsk}
                          assets={assets}
                        />
                        {id ? (
                          <NextWaitingDock
                            next={nextWaiting}
                            agentId={id}
                            open={waitingWindow.open && draft.length === 0}
                          />
                        ) : null}
                      </>
                    ) : null
                  }
                />
              </>
            ) : null}
          </div>
          {view === "opened" ? shell.panel : null}
        </ConversationFrame>
      )}
      {!id ? notices : null}
    </section>
  );
}
