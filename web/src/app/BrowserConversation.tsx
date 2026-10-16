import { useEffect, useRef, useState } from "react";
import {
  AgentHeader,
  AssistantMessage,
  Button,
  Composer,
  ConversationFrame,
  ConversationStream,
  ConversationTimeline,
  EndedConversationControl,
  Icon,
  InlineNotice,
  Markdown,
  QueuePanel,
  SendObservation,
  WorkingProgress,
} from "../components";
import { AgentTurn, ThinkingRow } from "../components/AgentTurn";
import { ArchiveControls } from "../components/ArchiveControls";
import {
  agentPresentation,
  waitingSummary,
} from "../components/agentPresentation";
import { BashToolCard } from "../components/BashToolCard";
import { FileToolCard, fileStat } from "../components/FileToolCard";
import {
  ProcessAwareToolUse,
  ProcessProvider,
  ProcessStartCard,
  ProcessTraySlot,
  ProcessWaitingChip,
} from "../components/ProcessTray";
import { RecapCard } from "../components/RecapCard";
import { UnpresentedEvents } from "../components/WorkingProgress";
import { useConversationActions } from "./ConversationActions";
import { provisionalItems } from "./conversationEvents";
import type { ConversationStore } from "./conversationStore";
import {
  type Recap,
  readRecap,
  regenerateTitle,
  requestRecap,
  type Session,
  type Status,
} from "./conversations";
import { timelineItems } from "./HistoryView";
import { type Choice, PiModelSelector } from "./PiModelSelector";
import { shortModel, usePiModels } from "./PiModels";
import { PiQuestion } from "./PiQuestion";
import { latestSettings } from "./sessionSettings";
import type { Agent, Snapshot, Workspace } from "./snapshot";
import { useConversation } from "./useConversation";
import { useReadingPositionLayout } from "./useReadingPosition";

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
export function showMissedEvents(liveTruncated: boolean, current?: Status) {
  return (
    liveTruncated ||
    !!(current?.event_loss && current.native_history !== "present")
  );
}

export function BrowserConversation(
  props: Parameters<typeof BrowserConversationContent>[0],
) {
  return (
    <ProcessProvider
      key={`${props.identity}:${props.id}`}
      id={props.id}
      csrf={props.csrf}
      onLogin={props.onLogin}
      onStatusEvent={props.onStatusEvent}
    >
      <BrowserConversationContent {...props} />
    </ProcessProvider>
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
    queueOpen,
    setQueueOpen,
    workingMode,
    setWorkingMode,
    finishedInBackground,
    details,
    setDetails,
    queueReturn,
    queuePanel,
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
    continuationKey,
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
    queueOpen,
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
    document.title = `Pi tarvitsee huomiota · ${old}`;
    return () => {
      document.title = old;
    };
  }, [finishedInBackground]);
  const controlled =
    opened && !!current && current.workspace_id === workspace.workspace_id;
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

  const {
    start,
    continueEnded,
    submit,
    submitQueue,
    clearNativeQueue,
    stopNow,
    notices,
  } = useConversationActions({
    firstChoice: canChooseFirstModel ? modelChoice : undefined,
    workspace,
    id,
    csrf,
    ambiguous,
    busy,
    current,
    continuation,
    draft,
    receipt,
    sendObservation,
    problem,
    controlled: controlled && !statusStale,
    serverUnavailable,
    alive,
    generation,
    submittedKey,
    sendKey,
    continuationKey,
    uncertainKey,
    inFlightSend,
    setBusy,
    setReceipt,
    setSendObservation,
    setContinuation,
    setConfirmStop,
    changeDraft,
    refresh,
    onLogin,
    onSessionCreated,
    navigate,
  });
  const canSend =
    controlled &&
    archive?.archive !== "archived" &&
    archive?.archive !== "unknown" &&
    !busy &&
    !ambiguous &&
    !statusStale &&
    !serverUnavailable &&
    !modelBlocked &&
    current?.auth_error !== "pi_model_unsupported" &&
    !problem &&
    !continuation &&
    (current.state === "idle" ||
      current.state === "rejected" ||
      current.state === "accepted");
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
  const provisional = provisionalItems(
    live ?? {
      cursor: "",
      instance: "",
      sequence: 0,
      fragments: [],
      truncated: true,
    },
  ).filter(
    (item) =>
      item.kind !== "tool" ||
      !item.callId ||
      !entries.some((entry) =>
        entry.blocks?.some(
          (block) =>
            block.type === "toolCall" && block.tool_call_id === item.callId,
        ),
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
  const turnClockKey = `${id ?? ""}:${current?.command_id || started?.event_id || provisional[0]?.id || ""}`;
  if (fallbackClock.current.key !== turnClockKey)
    fallbackClock.current = { key: turnClockKey, at: Date.now() };
  const nativeStart = started ? Date.parse(started.emitted_at) : NaN;
  const elapsed = provisional.length
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
  return (
    <section ref={section} className="ah-reading-view">
      {!id ? (
        <>
          <h2>Pi-keskustelut</h2>
          <details className="md-new">
            <summary className="md-btn">
              {displayModel} · {selectedThinking ?? "Pi"}
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
              Pi-keskustelun toiminnot
            </legend>
            <Button
              label="Aloita uusi Pi-keskustelu"
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
        <div role="status">
          <h2>Ladataan keskustelua</h2>
          {problem ? (
            <InlineNotice
              title={problem}
              tone="danger"
              actions={[
                {
                  label: "Yritä uudelleen",
                  onPress: () => setOpenAttempt((n) => n + 1),
                },
              ]}
            />
          ) : null}
        </div>
      ) : (
        <ConversationFrame>
          <AgentHeader
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
              failureNotice: titleError ? "Otsikkoa ei voitu luoda" : undefined,
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
                void regenerateTitle(id, csrf)
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
              presentation.operationLabel ?? presentation.activityLabel
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
            modelPicker={
              emptyConversation ? (
                <span className="ah-set-chip">
                  {displayModel} · {selectedThinking ?? "Pi"}
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
                  <summary className="ah-set-chip">
                    {displayModel} · {selectedThinking ?? "Pi"}
                  </summary>
                  <div className="md-pop">
                    {chipOpen ? (
                      <PiModelSelector
                        csrf={csrf}
                        scope="conversation"
                        current={
                          nativeSettings.model ??
                          (current?.startup_choice
                            ? `${current.startup_choice.provider ?? "openai-codex"}/${current.startup_choice.model}`
                            : undefined)
                        }
                        currentThinking={
                          nativeSettings.thinking ??
                          current?.startup_choice?.thinking
                        }
                        onChoice={(choice) =>
                          void start(
                            choice,
                            !entries.some((e) => e.kind === "user"),
                          )
                        }
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
                size="compact"
                onPress={() => navigate("/settings")}
              />
            }
            detailsFacts={[
              {
                label: "Työtila",
                value: workspace.path ?? "Ei tiedossa",
                copy: !!workspace.path,
              },
              {
                label: "Malli",
                value: nativeSettings.model ?? "Pi:n oletus",
                copy: !!nativeSettings.model,
              },
              {
                label: "Ajattelutaso",
                value: nativeSettings.thinking ?? "Pi:n oletus",
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
            workspaceHref={`/workspaces/${workspace.workspace_id}`}
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
                  label="Lataa vanhempi historiasivu"
                  onPress={() => {
                    captureAnchor();
                    void store.older(id);
                  }}
                />
              </div>
            ) : null}
            <UnpresentedEvents events={events} />
            <ConversationTimeline
              state={
                historyError
                  ? entries.length
                    ? "stale"
                    : "error"
                  : entries.length
                    ? "ready"
                    : "empty"
              }
              items={[
                ...timelineItems(
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
                ),
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
                ...(provisional.length
                  ? [
                      {
                        // The first provisional block may be retired when native
                        // history catches up; it is not the identity of the turn.
                        id: `live-turn-${current?.command_id || started?.event_id || provisional[0].id}`,
                        kind: "assistant",
                        content: (
                          <AgentTurn
                            working={
                              current?.run_active ??
                              (current?.state === "working" ||
                                current?.state === "accepted")
                            }
                            activity={
                              last?.kind === "tool" && last.name
                                ? `Ajaa ${last.name}`
                                : last?.kind === "thinking"
                                  ? "Ajattelee"
                                  : "Vastaa"
                            }
                            duration={duration}
                            failureCount={
                              provisional.filter(
                                (item) =>
                                  item.kind === "tool" &&
                                  item.state === "failed",
                              ).length
                            }
                            thinkingCount={
                              provisional.filter(
                                (item) => item.kind === "thinking",
                              ).length
                            }
                            toolCount={
                              provisional.filter((item) => item.kind === "tool")
                                .length
                            }
                            work={provisional
                              .filter((item) => item.kind !== "assistant")
                              .map((item) => (
                                <div key={item.id} className="ah-live-work">
                                  {item.kind === "thinking" ? (
                                    <ThinkingRow text={item.text} live />
                                  ) : item.kind === "assistant" ? (
                                    <AssistantMessage
                                      onCopy={() =>
                                        void navigator.clipboard?.writeText(
                                          item.text,
                                        )
                                      }
                                    >
                                      <Markdown text={item.text} />
                                    </AssistantMessage>
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
                                        id && item.callId
                                          ? store.toolExpansion(id, item.callId)
                                          : undefined
                                      }
                                      targetText={
                                        item.name === "bash"
                                          ? bashCommand(
                                              item.arguments ?? "",
                                            ).split("\n")[0]
                                          : undefined
                                      }
                                      state={
                                        (item.state as
                                          | "running"
                                          | "succeeded"
                                          | "failed"
                                          | "cancelled") ?? "forming"
                                      }
                                    >
                                      {item.name === "process" ? (
                                        <ProcessStartCard
                                          argumentsText={item.arguments ?? ""}
                                          result={item.output}
                                        />
                                      ) : item.name === "bash" ? (
                                        <BashToolCard
                                          command={bashCommand(
                                            item.arguments ?? "",
                                          )}
                                          output={item.output}
                                          failureCause={item.failureCause}
                                          running={item.state === "running"}
                                        />
                                      ) : ["read", "write", "edit"].includes(
                                          item.name ?? "",
                                        ) ? (
                                        <FileToolCard
                                          name={item.name ?? ""}
                                          argumentsText={item.arguments ?? ""}
                                          output={item.output}
                                          failed={item.state === "failed"}
                                        />
                                      ) : item.arguments ? (
                                        <pre>{item.arguments}</pre>
                                      ) : null}
                                      {![
                                        "bash",
                                        "process",
                                        "read",
                                        "write",
                                        "edit",
                                      ].includes(item.name ?? "") &&
                                      item.output ? (
                                        <pre>{item.output}</pre>
                                      ) : null}
                                    </ProcessAwareToolUse>
                                  ) : item.kind === "bash" ? (
                                    <details>
                                      <summary>
                                        Paikallisen komennon tuloste · käynnissä
                                      </summary>
                                      <pre>{item.text}</pre>
                                    </details>
                                  ) : (
                                    <InlineNotice
                                      title={
                                        item.kind === "bash"
                                          ? "Paikallisen komennon tuloste"
                                          : item.kind === "extension"
                                            ? "Laajennuksen ilmoitus"
                                            : "Pi-tila"
                                      }
                                      description={item.text}
                                    />
                                  )}
                                </div>
                              ))}
                            reply={provisional
                              .filter((item) => item.kind === "assistant")
                              .map((item) => (
                                <AssistantMessage
                                  key={item.id}
                                  streamState="streaming"
                                  onCopy={() =>
                                    void navigator.clipboard?.writeText(
                                      item.text,
                                    )
                                  }
                                >
                                  <Markdown text={item.text} />
                                </AssistantMessage>
                              ))}
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
                  : "? Ei tiedossa, käsittelikö Pi pyynnön. Älä lähetä uudelleen."}
              </p>
            ) : null}
            <WorkingProgress
              state={current?.state}
              events={events}
              activeToolName={
                provisionalItems(
                  live ?? {
                    cursor: "",
                    instance: "",
                    sequence: 0,
                    fragments: [],
                    truncated: true,
                  },
                ).find(
                  (item) => item.kind === "tool" && item.state === "running",
                )?.name
              }
            />
            {statusStale && !serverUnavailable ? (
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
            {journalOffline && !statusStale && !serverUnavailable ? (
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
                Pi:n tapahtumia vastaanotettu; historiaa odotetaan.
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
                        `/workspaces/${workspace.workspace_id}?conversation=${encodeURIComponent(id ?? "")}&pi_sign_in=1`,
                      ),
                  },
                ]}
              />
            ) : null}
            {!statusStale && current?.auth_error === "pi_model_unsupported" ? (
              <InlineNotice
                title="Valittu kielimalli ei ole käytettävissä"
                description="Pi ilmoitti, ettei valittu malli ole tuettu tällä ChatGPT-tilillä. Valitse toinen malli ja aloita uusi keskustelu. Viestiä ei toisteta; luonnos säilyy."
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
          {!statusStale &&
          (ambiguous ||
            current?.state === "uncertain" ||
            historyError ||
            (continuation && !["ready", "pending"].includes(continuation)) ||
            details) ? (
            <Button
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
          ) : null}
          {controlled &&
          (queueOpen ||
            !!(
              (current?.queue?.steering.length ?? 0) +
              (current?.queue?.follow_up.length ?? 0)
            )) ? (
            <QueuePanel
              panelRef={queuePanel}
              steeringTexts={current?.queue?.steering ?? []}
              followUpTexts={current?.queue?.follow_up ?? []}
              state={current?.queue ? "ready" : "error"}
              clearAvailability={
                !busy &&
                !ambiguous &&
                !statusStale &&
                !serverUnavailable &&
                current?.queue &&
                current.state !== "pending" &&
                current.state !== "uncertain" &&
                current.state !== "stopping"
                  ? { state: "enabled" }
                  : { state: "unknown", reason: "Odota vahvistettua tilaa." }
              }
              onClearAll={() => void clearNativeQueue()}
            />
          ) : null}
          <div className="ah-conversation-notices">
            {statusStale ? null : notices}
          </div>
          {!recapDismissed &&
            (recapCurrent?.recap ||
              recapBusy ||
              recapError ||
              recapUncertain) && (
              <RecapCard
                activityLabel={
                  (presentation.activity === "waiting_process" ||
                  presentation.activity === "waiting_spinoff"
                    ? waitingSummary(archive?.waiting_on)
                    : undefined) ?? presentation.activityLabel
                }
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
                    ? "Odota Pi:n vuoron päättymistä."
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
          {controlled &&
          !statusStale &&
          (continuation || current?.state === "uncertain") ? (
            <EndedConversationControl
              state={
                continuation ??
                (current?.continuation === "eligible"
                  ? "ready"
                  : current?.continuation === "writer_present"
                    ? "writer_conflict"
                    : current?.continuation === "read_only_history"
                      ? "read_only_history"
                      : "control_uncertain")
              }
              onContinue={() => {
                if (archive?.archive === "archived") {
                  if (onArchive)
                    void onArchive(archive, false).then((ok) => {
                      if (ok) void continueEnded();
                    });
                } else void continueEnded();
              }}
              retryAvailable={false}
            />
          ) : controlled ? (
            <>
              <ProcessTraySlot />
              <Composer
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
                        className="md-pill"
                        aria-label="Uuden keskustelun malli"
                      >
                        {displayModel} · {selectedThinking ?? "Pi"}{" "}
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
                  (current?.run_active ?? current?.state === "accepted")
                    ? "working"
                    : "idle"
                }
                selectedWorkingMode={workingMode}
                queueSummary={`Jonossa ${(current?.queue?.steering.length ?? 0) + (current?.queue?.follow_up.length ?? 0)}`}
                queueKnown={!!current?.queue}
                queueOpen={queueOpen}
                sendState={busy ? "pending" : ambiguous ? "uncertain" : "idle"}
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
                  void submit();
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
                onOpenQueue={() => {
                  if (queueOpen) {
                    setQueueOpen(false);
                    const saved = queueReturn.current;
                    requestAnimationFrame(() => {
                      if (!saved || !feed.current) return;
                      feed.current.scrollTop = saved.top;
                      if (saved.anchor) restoreAnchor(saved.anchor, entries);
                      wasAtBottom.current = saved.atBottom;
                      readingAnchor.current = saved.anchor;
                      queueReturn.current = undefined;
                    });
                  } else {
                    captureAnchor();
                    queueReturn.current = {
                      top: feed.current?.scrollTop ?? 0,
                      atBottom: wasAtBottom.current,
                      anchor: readingAnchor.current,
                    };
                    setQueueOpen(true);
                    requestAnimationFrame(() => queuePanel.current?.focus());
                  }
                }}
                onInterrupt={
                  (current?.run_active ?? current?.state === "accepted") &&
                  !statusStale
                    ? () => void stopNow()
                    : undefined
                }
              />
            </>
          ) : null}
        </ConversationFrame>
      )}
      {!id ? notices : null}
    </section>
  );
}
