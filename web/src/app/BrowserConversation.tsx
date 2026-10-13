import { useEffect, useState } from "react";
import {
  AgentHeader,
  AssistantMessage,
  Button,
  Composer,
  ConversationFrame,
  ConversationStream,
  ConversationTimeline,
  EndedConversationControl,
  InlineNotice,
  Markdown,
  QueuePanel,
  SendObservation,
  WorkingProgress,
} from "../components";
import { AgentTurn, ThinkingRow } from "../components/AgentTurn";
import { ArchiveControls } from "../components/ArchiveControls";
import { agentPresentation } from "../components/agentPresentation";
import { BashToolCard } from "../components/BashToolCard";
import { FileToolCard, fileStat } from "../components/FileToolCard";
import { PiToolUse } from "../components/PiBlocks";
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

export function BrowserConversation({
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
  onStatusEvent: (listener: (id: string, kind: string) => void) => () => void;
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
    if (current?.state !== "accepted") return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [current?.state]);
  const started = live?.fragments.find(
    (event) =>
      event.kind === "pi.lifecycle" && event.payload.signal === "turn_start",
  );
  const elapsed = started
    ? Math.max(
        0,
        Math.floor((clockNow - Date.parse(started.emitted_at)) / 1000),
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
          <fieldset className="ah-actions ah-conversation-actions">
            <legend className="ah-visually-hidden">
              Pi-keskustelun toiminnot
            </legend>
            <Button
              label="Aloita uusi Pi-keskustelu"
              availability={
                !csrf
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
              onPress={() => void start()}
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
            activityKind={
              presentation.activity === "working"
                ? "working"
                : presentation.activity === "unknown"
                  ? "unknown"
                  : "neutral"
            }
            settings={latestSettings(entries)}
            detailsFacts={[
              {
                label: "Työtila",
                value: workspace.path ?? "Ei tiedossa",
                copy: !!workspace.path,
              },
              {
                label: "Malli",
                value: latestSettings(entries).model ?? "Pi:n oletus",
                copy: !!latestSettings(entries).model,
              },
              {
                label: "Ajattelutaso",
                value: latestSettings(entries).thinking ?? "Pi:n oletus",
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
            onToggleDetails={() => setDetails(!details)}
          />
          <ConversationStream
            streamRef={feed}
            onScroll={() => {
              const el = feed.current;
              if (!el) return;
              wasAtBottom.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 60;
              setAwayFromLatest(!wasAtBottom.current);
              if (wasAtBottom.current) {
                readingAnchor.current = undefined;
                if (id) store.savePosition(id);
                setUnseen(0);
              } else captureAnchor();
            }}
          >
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
                        id: `live-turn-${provisional[0].id}`,
                        kind: "assistant",
                        content: (
                          <AgentTurn
                            working={
                              current?.state === "working" ||
                              current?.state === "accepted"
                            }
                            activity={
                              last?.kind === "tool" && last.name
                                ? `Ajaa ${last.name}`
                                : last?.kind === "thinking"
                                  ? "Ajattelee"
                                  : "Vastaa"
                            }
                            duration={duration}
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
                                    <PiToolUse
                                      name={item.name ?? "Työkalu"}
                                      stat={fileStat(
                                        item.name ?? "",
                                        item.arguments ?? "",
                                        item.output,
                                      )}
                                      initiallyExpanded={item.name === "bash"}
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
                                      {item.name === "bash" ? (
                                        <BashToolCard
                                          command={bashCommand(
                                            item.arguments ?? "",
                                          )}
                                          output={item.output}
                                          running={item.state === "running"}
                                        />
                                      ) : ["read", "write", "edit"].includes(
                                          item.name ?? "",
                                        ) ? (
                                        <FileToolCard
                                          name={item.name ?? ""}
                                          argumentsText={item.arguments ?? ""}
                                          output={item.output}
                                        />
                                      ) : item.arguments ? (
                                        <pre>{item.arguments}</pre>
                                      ) : null}
                                      {![
                                        "bash",
                                        "read",
                                        "write",
                                        "edit",
                                      ].includes(item.name ?? "") &&
                                      item.output ? (
                                        <pre>{item.output}</pre>
                                      ) : null}
                                    </PiToolUse>
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
              showJumpToLatest={awayFromLatest}
              onJumpToLatest={() => {
                wasAtBottom.current = true;
                readingAnchor.current = undefined;
                if (id) store.savePosition(id);
                setAwayFromLatest(false);
                feed.current?.scrollTo({ top: feed.current.scrollHeight });
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
            {next ? (
              <Button
                label="Lataa seuraava historiasivu"
                onPress={() => {
                  captureAnchor();
                  void store.older(id);
                }}
              />
            ) : null}
            {current?.auth_error === "pi_auth_failed" ? (
              <InlineNotice
                title="Kielimallikirjautuminen ei ole kunnossa"
                description="Kirjaudu OpenAI-tilillesi uudelleen ja jatka sitten keskustelua. Viestiä ei lähetetä automaattisesti uudelleen."
                tone="danger"
                actions={[
                  {
                    label: "Kirjaudu",
                    onPress: () => navigate("/workspaces?pi_sign_in=1"),
                  },
                ]}
              />
            ) : null}
            {statusStale ? (
              <InlineNotice
                title="Keskustelun tila vanhentui"
                description="Näytetään viimeisin tunnettu historia. Tarkista tila ennen ohjaamista."
                tone="warning"
              />
            ) : null}
            {journalOffline ? (
              <InlineNotice
                title="Tapahtumayhteys katkesi"
                description="Tila ja natiivi historia tarkistetaan uudelleen. Viestiä ei lähetetä uudelleen."
                tone="warning"
              />
            ) : null}
            {showMissedEvents(!!live?.truncated, current) ? (
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
          {ambiguous ||
          statusStale ||
          current?.state === "uncertain" ||
          historyError ||
          (continuation && !["ready", "pending"].includes(continuation)) ||
          details ? (
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
          <div className="ah-conversation-notices">{notices}</div>
          {!recapDismissed &&
            (recapCurrent?.recap ||
              recapBusy ||
              recapError ||
              recapUncertain) && (
              <RecapCard
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
            <Composer
              value={draft}
              onChange={changeDraft}
              activity={current?.state === "accepted" ? "working" : "idle"}
              selectedWorkingMode={workingMode}
              queueSummary={`Jonossa ${(current?.queue?.steering.length ?? 0) + (current?.queue?.follow_up.length ?? 0)}`}
              queueKnown={!!current?.queue}
              queueOpen={queueOpen}
              sendState={busy ? "pending" : ambiguous ? "uncertain" : "idle"}
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
                            : serverUnavailable
                              ? "Palvelinyhteys katkesi. Luonnos säilyy."
                              : statusStale
                                ? "Tila on vanhentunut. Tarkista keskustelun tila ennen lähettämistä."
                                : "Odota vahvistettua joutotilaa; epävarmaa viestiä ei lähetetä uudelleen.",
                    }
              }
              onSendNow={() => void submit()}
              onSteer={() => void submitQueue("steer")}
              onFollowUp={() => void submitQueue("follow_up")}
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
                current?.state === "accepted" && !statusStale
                  ? () => void stopNow()
                  : undefined
              }
            />
          ) : null}
        </ConversationFrame>
      )}
      {!id ? notices : null}
    </section>
  );
}
