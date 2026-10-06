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
  TurnSettlement,
  WorkingProgress,
} from "../components";
import { agentPresentation } from "../components/agentPresentation";
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
import type { Snapshot, Workspace } from "./snapshot";
import { useConversation } from "./useConversation";
import { useReadingPositionLayout } from "./useReadingPosition";

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
    stopConfirmation,
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
    if (!id || !opened || newestKey === "") return;
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
  }, [id, opened, recapKey, newestKey]);
  const recapCurrent = recapView?.key === recapKey ? recapView : null;
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
  // The ref becomes populated after mount, but must not re-focus abort on the
  // next live update after the user has moved focus to cancel.
  // biome-ignore lint/correctness/useExhaustiveDependencies: ref contents are read only when confirmation state changes.
  useEffect(() => {
    if (confirmStop && current?.state === "accepted")
      stopConfirmation.current?.querySelector("button")?.focus();
  }, [confirmStop, current?.state]);
  const closeStopConfirmation = () => {
    setConfirmStop(false);
    section.current
      ?.querySelector<HTMLElement>(".ah-composer .ah-button")
      ?.focus();
  };
  const canSend =
    controlled &&
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
            title={title ?? "Uusi keskustelu"}
            titleAction={
              controlled &&
              csrf &&
              !statusStale &&
              !serverUnavailable &&
              !problem
                ? {
                    label: "Luo uusi otsikko",
                    availability: { state: "enabled" },
                    pending: titlePending,
                    failureNotice: titleError
                      ? "Otsikkoa ei voitu luoda"
                      : undefined,
                    onPress: () => {
                      if (!id || titlePending) return;
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
                  }
                : undefined
            }
            activityLabel={
              presentation.operationLabel ?? presentation.activityLabel
            }
            activityKind={
              presentation.activity === "working" ? "working" : "unknown"
            }
            controlKind={controlled ? "neutral" : "read-only"}
            controlLabel={
              controlled ? "Selainohjaus" : "Ohjaus ei ole käytettävissä"
            }
            workspaceLabel={workspace.display_name ?? workspace.name}
            workspaceHref={`/workspaces/${workspace.workspace_id}`}
            detailsExpanded={details}
            onToggleDetails={() => setDetails(!details)}
          />
          {details ? <p>Natiivi tunniste: {id}</p> : null}
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
            <RecapCard
              recap={recapCurrent?.recap ?? null}
              stale={
                !!recapCurrent?.recap &&
                (recapCurrent.recap.through !== recapCurrent.latest ||
                  (controlled &&
                    current?.state !== "idle" &&
                    current?.state !== "rejected"))
              }
              pending={!!recapBusy}
              error={!!recapError}
              uncertain={!!recapUncertain}
              unverifiable={!!recapCurrent?.unavailable}
              unavailable={
                !controlled ||
                !csrf ||
                statusStale ||
                serverUnavailable ||
                !!problem ||
                current?.state !== "idle" ||
                !!recapCurrent?.unavailable
              }
              unavailableReason={
                current?.state !== "idle"
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
                  undefined,
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
                ...(current?.turn_settled?.state === "settled" &&
                entries.some(
                  (entry) =>
                    entry.entry_key === current.turn_settled?.native_key,
                )
                  ? [
                      {
                        id: `settled:${current.turn_settled.native_key}`,
                        kind: "settled",
                        content: (
                          <TurnSettlement
                            observedAt={current.turn_settled.observed_at}
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
                ...provisionalItems(
                  live ?? {
                    cursor: "",
                    instance: "",
                    sequence: 0,
                    fragments: [],
                    truncated: true,
                  },
                )
                  .filter(
                    (item) =>
                      item.kind !== "tool" ||
                      !item.callId ||
                      !entries.some((entry) =>
                        entry.blocks?.some(
                          (block) =>
                            block.type === "toolCall" &&
                            block.tool_call_id === item.callId,
                        ),
                      ),
                  )
                  .map((item) => ({
                    id: item.id,
                    kind: item.kind,
                    content:
                      item.kind === "thinking" ? (
                        <details className="ah-ordered-blocks" open>
                          <summary>Ajattelu · käynnissä</summary>
                          <pre>{item.text}</pre>
                        </details>
                      ) : item.kind === "assistant" ? (
                        <AssistantMessage
                          onCopy={() =>
                            void navigator.clipboard?.writeText(item.text)
                          }
                        >
                          <Markdown text={item.text} />
                        </AssistantMessage>
                      ) : item.kind === "tool" ? (
                        <PiToolUse
                          name={item.name ?? "Työkalu"}
                          state={
                            (item.state as
                              | "running"
                              | "succeeded"
                              | "failed"
                              | "cancelled") ?? "forming"
                          }
                        >
                          {item.arguments ? (
                            <>
                              <strong>Argumentit</strong>
                              <pre>{item.arguments}</pre>
                            </>
                          ) : null}
                          {item.output ? (
                            <>
                              <strong>Viimeisin päivitys</strong>
                              <pre>{item.output}</pre>
                            </>
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
                      ),
                  })),
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
          {confirmStop && !statusStale && current?.state === "accepted" ? (
            <fieldset ref={stopConfirmation} aria-label="Vahvista keskeytys">
              <p>
                Keskeytetäänkö Pi:n vuoro? Jo käynnistyneiden työkalujen
                päättymistä ei voida vahvistaa.
              </p>
              <Button
                label="Kyllä, keskeytä vuoro"
                onPress={() => void stopNow()}
                availability={
                  busy
                    ? { state: "unknown", reason: "Pyyntö kesken" }
                    : { state: "enabled" }
                }
              />
              <Button
                label="Jatka työskentelyä"
                variant="quiet"
                onPress={closeStopConfirmation}
              />
            </fieldset>
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
              onContinue={() => void continueEnded()}
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
                      reason: serverUnavailable
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
                  ? () => setConfirmStop(true)
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
