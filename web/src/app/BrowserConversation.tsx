import { agentPresentation } from "../components/agentPresentation";
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
  LiveToolRow,
  Markdown,
  QueuePanel,
  SendObservation,
  TurnSettlement,
  WorkingProgress,
} from "../components";
import { UnpresentedEvents } from "../components/WorkingProgress";
import { useConversationActions } from "./ConversationActions";
import { provisionalItems } from "./conversationEvents";
import type { ConversationStore } from "./conversationStore";
import { regenerateTitle, type Session, type Status } from "./conversations";
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
              agentPresentation({
                process: statusStale ? "stale" : "daemon_managed_live",
                command: current && !statusStale ? current.state : undefined,
              }).operationLabel ??
              agentPresentation({
                process: statusStale ? "stale" : "daemon_managed_live",
                command: current && !statusStale ? current.state : undefined,
              }).activityLabel
            }
            activityKind={
              agentPresentation({
                process: statusStale ? "stale" : "daemon_managed_live",
                command: current && !statusStale ? current.state : undefined,
              }).activity === "working"
                ? "working"
                : "unknown"
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
                ...timelineItems(entries, onLogin),
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
                ).map((item) => ({
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
                      <section>
                        <LiveToolRow
                          name={item.name ?? "Työkalu"}
                          state={
                            (item.state ?? "running") as
                              | "running"
                              | "succeeded"
                              | "failed"
                              | "cancelled"
                          }
                        />
                        {item.arguments ? (
                          <details>
                            <summary>Näytä kutsun argumentit</summary>
                            <pre>{item.arguments}</pre>
                          </details>
                        ) : null}
                        {item.output ? (
                          <details>
                            <summary>Näytä työkalun tuloste</summary>
                            <pre>{item.output}</pre>
                          </details>
                        ) : null}
                      </section>
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
