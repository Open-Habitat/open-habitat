import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { liveText } from "../i18n";
import { useConversationText } from "../text/useConversation";
import {
  type ConversationStore,
  useConversationMetadata,
  useWindow,
} from "./conversationStore";
import {
  type ContinueRefusal,
  ConversationNotFound,
  type Status,
  sendReceipt,
  status,
} from "./conversations";
import {
  lostSendArrived,
  lostSendVerdict,
  ownWrites,
  type SendObservationValue,
} from "./sentMessages";
import type { Snapshot, Workspace } from "./snapshot";
import { useConversationDraft } from "./useConversationDraft";
import { useReadingPosition } from "./useReadingPosition";

const txt = liveText(useConversationText);

// Owns the native read model and journal recovery for one conversation.
/** The first quiet re-read of a refused history comes this soon; the card
 * that says so waits for it (historyCardDelay). */
export const historyRetryFirst = 1_500;
/** A refused read that the quiet re-read did not fix is shown after this. */
export const historyCardDelay = 4_000;

export function useConversation({
  workspace,
  id,
  identity,
  store,
  journalOffline,
  recoverySnapshot,
  onStatusEvent,
  onLogin,
}: {
  workspace: Workspace;
  id?: string;
  identity: string;
  store: ConversationStore;
  journalOffline: boolean;
  recoverySnapshot?: Snapshot;
  onStatusEvent: (
    listener: (
      id: string,
      kind: string,
      payload?: Record<string, unknown>,
    ) => void,
  ) => () => void;
  onLogin: () => void;
}) {
  const navigate = useNavigate();
  const metadata = useConversationMetadata(store);
  const windowView = useWindow(store, id ?? "");
  const current = id ? metadata.statuses.get(id) : undefined;
  const setCurrent = useCallback(
    (value: Status) => store.applyStatus(value.agent_id, value),
    [store],
  );
  const [opened, setOpened] = useState(false);
  const [openAttempt, setOpenAttempt] = useState(0);
  const entries = windowView?.entries ?? [];
  const next = windowView?.next;
  const { draft, changeDraft } = useConversationDraft(
    identity,
    workspace.workspace_id,
    id,
  );
  const [receipt, setReceipt] = useState("");
  const [sendObservation, setSendObservation] =
    useState<SendObservationValue>();
  // The host was found not to know this tab's command (its receipt is gone),
  // and how many history reads had begun by then: only a later read can
  // prove that Pi never got the message.
  const [forgotten, setForgotten] = useState<{
    command: string;
    after: number;
  }>();
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const historyError =
    windowView?.state === "stale" || windowView?.state === "error";
  const setHistoryError = (value: boolean) => {
    if (value && id) store.markStale(id);
  };
  const [continuation, setContinuation] = useState<
    "pending" | "uncertain" | ContinueRefusal
  >();
  const events = current?.events ?? [];
  const [localId, setLocalId] = useState(id);
  const localReady = localId === id;
  const live = windowView?.live;
  const continuationProof = useRef<
    { id: string; revision: string; result: Status["continuation"] } | undefined
  >(undefined);
  const openedProof = useRef("");
  const pendingNativeEntry = useRef<string | undefined>(undefined);
  const [confirmStop, setConfirmStop] = useState(false);
  // Enter steers while Pi works, as in Pi's TUI; Alt+Enter goes once the
  // other way (Rivillä, Jari 20.10.2026).
  const [workingMode, setWorkingMode] = useState<"steer" | "follow_up">(
    "steer",
  );
  const [finishedInBackground, setFinishedInBackground] = useState(false);
  const wasWorking = useRef(false);
  const [details, setDetails] = useState(false);
  const pending = useRef(false);
  const openReady = useRef(false);
  const queuedRefresh = useRef(false);
  const queuedProof = useRef(false);
  const queuedHistory = useRef(false);
  // A refresh asked for while one runs settles with the rerun it queued, so
  // an explicit check ends when its own reads have, not when it was queued.
  const queuedDone = useRef<(() => void)[]>([]);
  const latestRefresh = useRef<
    (proof?: boolean, history?: boolean) => Promise<void>
  >(async () => {});
  const retryTimer = useRef<number | undefined>(undefined);
  const retryDelay = useRef(0);
  const retryProof = useRef(false);
  const retryHistory = useRef(false);
  const clearRetry = useCallback((unmount = false) => {
    // A simultaneous ordinary refresh may succeed while an opening proof is
    // still waiting to retry. It does not discharge that explicit request.
    if ((retryProof.current || retryHistory.current) && !unmount) return;
    if (retryTimer.current !== undefined)
      window.clearTimeout(retryTimer.current);
    retryTimer.current = undefined;
    retryDelay.current = 0;
    if (unmount) {
      retryProof.current = false;
      retryHistory.current = false;
    }
  }, []);
  const scheduleRetry = useCallback((proof = false, history = false) => {
    retryProof.current ||= proof;
    retryHistory.current ||= history;
    if (retryTimer.current !== undefined || !alive.current) return;
    retryDelay.current = Math.min(
      retryDelay.current ? retryDelay.current * 2 : 3000,
      30000,
    );
    retryTimer.current = window.setTimeout(() => {
      retryTimer.current = undefined;
      const needsProof = retryProof.current;
      const needsHistory = retryHistory.current;
      retryProof.current = false;
      retryHistory.current = false;
      void latestRefresh.current(needsProof, needsHistory);
    }, retryDelay.current);
  }, []);
  const storage = (kind: string, key = id ?? workspace.workspace_id) =>
    `nah:${identity}:${kind}:${key}`;
  const submittedKey = storage("submitted");
  const sendKey = storage("last-send");
  // The last command whose request the host answered: it holds the command,
  // so its outcome is pending until a receipt or status says otherwise.
  const answeredKey = storage("answered");
  const continuationKey = storage("continue");
  const uncertainKey = storage("uncertain");
  // The newest native user message when the last command was sent
  // (lastUserKey), so that history can show it arrived after its outcome
  // was lost.
  const sentAfterKey = storage("sent-after");
  // The command this tab sent again after it proved undelivered: once.
  const resentKey = storage("resent");
  const ambiguous = sessionStorage.getItem(uncertainKey);
  const alive = useRef(true);
  const generation = useRef(0);
  const stopConfirmation = useRef<HTMLFieldSetElement>(null);
  const section = useRef<HTMLElement>(null);
  const focusedOnOpen = useRef(false);
  const {
    feed,
    wasAtBottom,
    readingAnchor,
    unseen,
    setUnseen,
    awayFromLatest,
    setAwayFromLatest,
    captureAnchor,
    restoreAnchor,
  } = useReadingPosition(entries, next, id, store);
  useEffect(() => {
    void openAttempt; // explicit retry of the parallel open loader
    alive.current = true;
    const controller = new AbortController();
    const version = ++generation.current;
    if (!id)
      return () => {
        alive.current = false;
        controller.abort();
      };
    openReady.current = false;
    setLocalId(id);
    setOpened(false);
    setProblem("");
    setSendObservation(undefined);
    setReceipt("");
    setConfirmStop(false);
    setDetails(false);
    setFinishedInBackground(false);
    setWorkingMode("steer");
    focusedOnOpen.current = false;
    pendingNativeEntry.current = undefined;
    wasWorking.current = false;
    store.view(id, false, true); // Buffer stream events before the cold status proof returns.
    const cached = store.status(id);
    if (cached && cached.workspace_id === workspace.workspace_id) {
      store.view(id);
      setOpened(true);
      openReady.current = true;
      openedProof.current = `${identity}:${id}`;
      continuationProof.current = {
        id,
        revision: cached.native_revision,
        result: cached.continuation,
      };
      // A send made before switching away is resumed from its record; its
      // reply may have come while this view was not there to read it.
      if (sessionStorage.getItem(sendKey)) void latestRefresh.current();
    } else {
      // Cold status is needed to prove a missing history and control ownership.
      void (async () => {
        try {
          const state = await status(id, controller.signal).then(
            async (initial) =>
              initial.state === "uncertain"
                ? status(id, controller.signal, true)
                : initial,
          );
          if (!alive.current || version !== generation.current) return;
          if (state.workspace_id !== workspace.workspace_id)
            throw new Error("invalid workspace");
          setCurrent(state);
          store.view(id, state.native_history === "missing");
          setOpened(true);
          openReady.current = true;
          openedProof.current = `${identity}:${id}`;
          continuationProof.current = {
            id,
            revision: state.native_revision,
            result: state.continuation,
          };
          if (
            sessionStorage.getItem(sendKey) ||
            sessionStorage.getItem(continuationKey) === "uncertain"
          )
            void latestRefresh.current(false, true);
          if (queuedRefresh.current) void latestRefresh.current(false, true);
        } catch (error) {
          if (alive.current && version === generation.current) {
            if ((error as Error).message === "identity_lost") onLogin();
            else if (error instanceof ConversationNotFound)
              navigate(`/agents/${id}`, {
                replace: true,
                state: { readOnly: true },
              });
            else setProblem(txt.loadFailed);
          }
        }
      })();
    }
    return () => {
      alive.current = false;
      ++generation.current;
      controller.abort();
      clearRetry(true);
    };
  }, [
    id,
    identity,
    workspace.workspace_id,
    clearRetry,
    onLogin,
    openAttempt,
    navigate,
    sendKey,
    continuationKey,
    store,
    setCurrent,
  ]);
  useEffect(() => {
    setContinuation(
      (sessionStorage.getItem(continuationKey) as
        | "uncertain"
        | ContinueRefusal
        | null) ?? undefined,
    );
    const text = sessionStorage.getItem(submittedKey);
    const command = sessionStorage.getItem(uncertainKey);
    // A command still on its way, or one the host answered, is pending: only
    // a reload that lost its request makes its outcome unknown.
    setSendObservation(
      text !== null && command
        ? {
            text,
            state:
              ownWrites.snapshot().has(command) ||
              sessionStorage.getItem(answeredKey) === command
                ? "pending"
                : "uncertain",
            command,
          }
        : undefined,
    );
  }, [continuationKey, submittedKey, uncertainKey, answeredKey]);
  // The person's command ends where the record of its command_id says so:
  // its receipt, or any status naming it, whichever reader applied that
  // status. A newer command is never settled by an older one's record.
  // undelivered: Pi never received it whole, so nothing of it ran; the
  // refusal says why.
  const settleCommand = useCallback(
    (command: string, outcome: "accepted" | "rejected" | "undelivered") => {
      const text = sessionStorage.getItem(submittedKey);
      if (sessionStorage.getItem(sendKey) !== command || text === null) return;
      // What the send itself recorded (its kind) stays with its outcome.
      setSendObservation((old) => ({
        ...(old?.command === command && old.text === text ? old : undefined),
        text,
        command,
        state: outcome === "accepted" ? "accepted" : "rejected",
      }));
      setReceipt(
        outcome === "rejected"
          ? txt.rejected
          : outcome === "undelivered"
            ? txt.undelivered
            : "",
      );
      sessionStorage.removeItem(sendKey);
      sessionStorage.removeItem(uncertainKey);
      sessionStorage.removeItem(submittedKey);
      sessionStorage.removeItem(answeredKey);
      sessionStorage.removeItem(sentAfterKey);
      sessionStorage.removeItem(resentKey);
      setForgotten(undefined);
    },
    [sendKey, uncertainKey, submittedKey, answeredKey, sentAfterKey, resentKey],
  );
  // The record of this tab's send whose outcome is unknown ends without an
  // outcome: the person sent its text again, or it went again held.
  const endUnknown = useCallback(
    (command: string) => {
      if (sessionStorage.getItem(sendKey) !== command) return;
      for (const key of [
        sendKey,
        uncertainKey,
        submittedKey,
        answeredKey,
        sentAfterKey,
        resentKey,
      ])
        sessionStorage.removeItem(key);
      setForgotten(undefined);
      setSendObservation(undefined);
      setReceipt("");
    },
    [sendKey, uncertainKey, submittedKey, answeredKey, sentAfterKey, resentKey],
  );
  // A message the person sends that carries the unknown send's text is that
  // send made again by them (Jari 9.11.2026): its record ends, so no warning
  // claims the text is still in the field, nothing sends it again, and a
  // later view does not give it back a second time.
  const releaseUnknown = useCallback(
    (text: string) => {
      const command = sessionStorage.getItem(uncertainKey);
      const lost = sessionStorage.getItem(submittedKey)?.trim();
      if (
        command &&
        lost &&
        text.includes(lost) &&
        sendObservation?.state === "uncertain" &&
        sendObservation.command === command
      )
        endUnknown(command);
    },
    [uncertainKey, submittedKey, sendObservation, endUnknown],
  );
  // A send whose outcome was lost (its request failed, or a host restart
  // forgot its acknowledgement) has arrived once Pi's own history shows it:
  // that is a stronger record than the acknowledgement, and the only one a
  // restart keeps.
  useEffect(() => {
    if (!localReady || sendObservation?.state !== "uncertain") return;
    const command = sessionStorage.getItem(sendKey);
    const after = sessionStorage.getItem(sentAfterKey);
    if (
      command &&
      command === sendObservation.command &&
      lostSendArrived(entries, sendObservation.text, after)
    )
      settleCommand(command, "accepted");
  }, [
    entries,
    sendObservation,
    localReady,
    sendKey,
    sentAfterKey,
    settleCommand,
  ]);
  useEffect(() => {
    const command = sessionStorage.getItem(sendKey);
    if (!localReady || !command || current?.command_id !== command) return;
    const outcome = current.send_receipt || current.ack;
    if (
      outcome === "accepted" ||
      outcome === "rejected" ||
      outcome === "undelivered"
    )
      settleCommand(command, outcome);
  }, [current, localReady, sendKey, settleCommand]);
  // A lost send the host does not know either: proven undelivered it is sent
  // again once (ConversationActions), after the conversation moved on its
  // text stays in the field, and otherwise the warning stays.
  const statusStaleHere = id ? metadata.staleStatuses.has(id) : false;
  const lostCommand =
    localReady &&
    id &&
    sendObservation?.state === "uncertain" &&
    sendObservation.command &&
    forgotten?.command === sendObservation.command &&
    sessionStorage.getItem(sendKey) === sendObservation.command &&
    !statusStaleHere &&
    !problem
      ? sendObservation.command
      : undefined;
  const lostVerdict =
    lostCommand && id && forgotten && sendObservation
      ? lostSendVerdict({
          text: sendObservation.text,
          command: lostCommand,
          after: sessionStorage.getItem(sentAfterKey),
          entries,
          status: current,
          historyCurrent:
            (windowView?.state === "ready" || windowView?.state === "empty") &&
            store.newestRead(id) > forgotten.after &&
            store.historyFollowsStatus(id),
        })
      : undefined;
  const lostSend =
    lostCommand &&
    sendObservation &&
    (lostVerdict === "moved-on" ||
      (lostVerdict === "resend" &&
        sessionStorage.getItem(resentKey) !== lostCommand))
      ? {
          command: lostCommand,
          text: sendObservation.text,
          verdict: lostVerdict,
        }
      : undefined;
  // The history shown may be older than the finding or than the status
  // held now: read it again, once per such pair, after any read already
  // running.
  const historyAsked = useRef("");
  const historyAsk =
    lostVerdict === "read-history" && id
      ? `${lostCommand}:${store.newestRead(id)}:${store.statusVersion(id)}`
      : "";
  useEffect(() => {
    if (!historyAsk || !id || historyAsked.current === historyAsk) return;
    historyAsked.current = historyAsk;
    store.readNewest(id);
  }, [historyAsk, id, store]);
  // Moved on: nothing is sent, the record ends and the text, already given
  // back to the field as unknown, stays there.
  const movedOn = lostSend?.verdict === "moved-on" ? lostSend : undefined;
  useEffect(() => {
    if (!movedOn || sessionStorage.getItem(sendKey) !== movedOn.command) return;
    for (const key of [
      sendKey,
      uncertainKey,
      submittedKey,
      answeredKey,
      sentAfterKey,
      resentKey,
    ])
      sessionStorage.removeItem(key);
    setForgotten(undefined);
    setSendObservation({
      text: movedOn.text,
      command: movedOn.command,
      state: "rejected",
    });
    setReceipt(txt.movedOn);
  }, [
    movedOn,
    sendKey,
    uncertainKey,
    submittedKey,
    answeredKey,
    sentAfterKey,
    resentKey,
  ]);
  // Ref contents are sampled when refresh runs, not part of callback identity.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mutable reading refs do not drive refresh recreation.
  const refresh = useCallback(
    async (requestContinuation = false, readHistory = false) => {
      if (!id || !alive.current) return;
      if (!openReady.current) {
        queuedRefresh.current = true;
        queuedProof.current ||= requestContinuation;
        queuedHistory.current ||= readHistory;
        return;
      }
      if (pending.current) {
        queuedRefresh.current = true;
        queuedProof.current ||= requestContinuation;
        queuedHistory.current ||= readHistory;
        return new Promise<void>((resolve) => {
          queuedDone.current.push(resolve);
        });
      }
      pending.current = true;
      const version = generation.current;
      let receiptPending = false;
      // A command sent after these reads started, or not yet answered when
      // they did, may be newer than what they saw: not finding it there
      // proves nothing.
      const unanswered = ownWrites.snapshot();
      const commandBefore = sessionStorage.getItem(sendKey);
      try {
        let nextStatus = await status(id);
        if (requestContinuation && nextStatus.state === "uncertain")
          nextStatus = await status(id, undefined, true);
        if (!alive.current || version !== generation.current) return;
        if (nextStatus.workspace_id !== workspace.workspace_id)
          throw new Error("invalid workspace");
        if (requestContinuation)
          continuationProof.current = {
            id,
            revision: nextStatus.native_revision,
            result: nextStatus.continuation,
          };
        else if (
          nextStatus.state === "uncertain" &&
          continuationProof.current?.id === id &&
          continuationProof.current.revision === nextStatus.native_revision
        )
          nextStatus.continuation = continuationProof.current.result;
        // A read older than the status held says nothing new about the
        // conversation; it can still name this tab's command.
        const latest = setCurrent(nextStatus)
          ? nextStatus
          : (store.status(id) ?? nextStatus);
        const working = ["pending", "accepted", "stopping"].includes(
          latest.state,
        );
        if (
          !working &&
          wasWorking.current &&
          document.visibilityState === "hidden"
        )
          setFinishedInBackground(true);
        wasWorking.current = working;
        setProblem("");
        const command = sessionStorage.getItem(sendKey);
        if (command) {
          let outcome =
            nextStatus.command_id === command
              ? nextStatus.send_receipt ||
                (nextStatus.ack === "pending" ||
                nextStatus.ack === "accepted" ||
                nextStatus.ack === "rejected"
                  ? nextStatus.ack
                  : undefined)
              : undefined;
          let unknownToHost = false;
          if (!outcome) {
            try {
              const receipt = await sendReceipt(id, command);
              unknownToHost = receipt === undefined;
              // A held message is not yet delivered; a cancelled one never was.
              outcome =
                receipt === "held"
                  ? "pending"
                  : receipt === "cancelled"
                    ? "rejected"
                    : receipt;
            } catch (error) {
              if ((error as Error).message === "identity_lost") throw error;
              receiptPending = true;
            }
          }
          if (!alive.current || version !== generation.current) return;
          if (
            !outcome &&
            (command !== commandBefore ||
              unanswered.has(command) ||
              ownWrites.snapshot().has(command))
          )
            outcome = "pending";
          const text = sessionStorage.getItem(submittedKey);
          // Do not let an older in-flight read settle a newer command.
          if (sessionStorage.getItem(sendKey) === command && text !== null) {
            // What the send itself recorded (its kind) stays with the same
            // command's later outcomes.
            const same = (old?: SendObservationValue) =>
              old?.command === command && old.text === text ? old : undefined;
            if (
              outcome === "accepted" ||
              outcome === "rejected" ||
              outcome === "undelivered"
            )
              settleCommand(command, outcome);
            else {
              sessionStorage.setItem(uncertainKey, command);
              const state = outcome === "pending" ? "pending" : "uncertain";
              setSendObservation((old) => ({
                ...same(old),
                text,
                command,
                state,
              }));
              setReceipt(outcome === "pending" ? txt.pending : txt.uncertain);
              if (outcome === "pending") receiptPending = true;
            }
            // Kept from the first such finding: the history reads begun
            // after it are the ones that can prove the message undelivered.
            setForgotten((old) =>
              !outcome && unknownToHost
                ? old?.command === command
                  ? old
                  : { command, after: store.readsBegun() }
                : old?.command === command
                  ? undefined
                  : old,
            );
          }
        }
        const reconcileContinuation =
          sessionStorage.getItem(continuationKey) === "uncertain" &&
          latest.state === "idle" &&
          latest.native_history === "present";
        if (
          (readHistory || reconcileContinuation) &&
          latest.native_history === "present"
        ) {
          await store.reconnect(id);
          if (!alive.current || version !== generation.current) return;
          if (
            store.read(id)?.state === "stale" ||
            store.read(id)?.state === "error"
          ) {
            scheduleRetry(false, true);
            return;
          }
          if (reconcileContinuation) {
            sessionStorage.removeItem(continuationKey);
            setContinuation(undefined);
            setReceipt(txt.continued);
          }
          if (pendingNativeEntry.current) {
            if (
              store
                .read(id)
                ?.entries.some(
                  (e) => e.entry_key === pendingNativeEntry.current,
                )
            )
              pendingNativeEntry.current = undefined;
            else scheduleRetry(false, true);
          }
        }
        clearRetry();
        if (receiptPending) scheduleRetry();
      } catch (error) {
        if (alive.current && version === generation.current) {
          if ((error as Error).message === "identity_lost") onLogin();
          else if (error instanceof ConversationNotFound) {
            if (sessionStorage.getItem(sendKey)) {
              // A restarted daemon no longer knows this controller or its
              // receipt. Keep the readable window and the unknown draft.
              store.markStale(id);
              setProblem(txt.controlGone);
            } else
              navigate(`/agents/${id}`, {
                replace: true,
                state: { readOnly: true },
              });
          } else {
            setProblem(txt.disconnected);
            scheduleRetry(requestContinuation, readHistory);
          }
        }
      } finally {
        pending.current = false;
        const rerun = queuedRefresh.current && alive.current;
        const proof = queuedProof.current;
        const history = queuedHistory.current;
        queuedRefresh.current = false;
        queuedProof.current = false;
        queuedHistory.current = false;
        const done = queuedDone.current;
        queuedDone.current = [];
        const settle = () => {
          for (const resolve of done) resolve();
        };
        if (rerun) void latestRefresh.current(proof, history).finally(settle);
        else settle();
      }
    },
    [
      id,
      workspace.workspace_id,
      sendKey,
      submittedKey,
      uncertainKey,
      answeredKey,
      continuationKey,
      captureAnchor,
      store,
      settleCommand,
      clearRetry,
      scheduleRetry,
      navigate,
      onLogin,
    ],
  );
  latestRefresh.current = refresh;
  // A successful HTTP snapshot is a connectivity proof even if no SSE event
  // follows it. A restarted daemon has no old controller handle: check it
  // even without a pending send, so the view can return to native history.
  const statusStale = id ? metadata.staleStatuses.has(id) : false;
  useEffect(() => {
    if (
      id &&
      recoverySnapshot &&
      (statusStale || sessionStorage.getItem(sendKey))
    )
      void latestRefresh.current();
  }, [recoverySnapshot, id, sendKey, statusStale]);
  // A tab-wide journal dispatches active status events here; background status
  // observations are owned by the store and never trigger reads on switch.
  useEffect(
    () =>
      onStatusEvent((agentId, kind) => {
        if (agentId !== id || kind === "process.output") return;
        if (kind === "snapshot.invalidated")
          continuationProof.current = undefined;
        void latestRefresh.current(
          false,
          kind === "turn.settled" || kind === "snapshot.invalidated",
        );
      }),
    [id, onStatusEvent],
  );
  // A refused history read is usually momentary (a busy disk, the daemon
  // restarting): read again quietly, sooner first, for as long as it lasts.
  // Before this the window waited for the next event, and a turn whose one
  // tool ran for an hour kept "history unavailable" up that long (12.11.2026).
  // A record a full quota cut stays cut; reading again would not help.
  const historyCut = !!windowView?.historyCut;
  useEffect(() => {
    if (!historyError || historyCut || !id) return;
    let delay = historyRetryFirst;
    let timer: number;
    const next = () => {
      timer = window.setTimeout(() => {
        void store.reconnect(id);
        delay = Math.min(delay * 3, 30_000);
        next();
      }, delay);
    };
    next();
    return () => window.clearTimeout(timer);
  }, [historyError, historyCut, id, store]);
  return {
    cutOff: windowView?.cutOff,
    historyCut,
    current,
    statusStale: id ? metadata.staleStatuses.has(id) : false,
    opened: id
      ? !!current && !!windowView && windowView.state !== "loading"
      : opened,
    openAttempt,
    setOpenAttempt,
    entries,
    next,
    historyRevision: windowView?.revision,
    draft,
    receipt: localReady ? receipt : "",
    sendObservation: localReady ? sendObservation : undefined,
    problem: localReady ? problem : "",
    busy: localReady && busy,
    continuation: localReady ? continuation : undefined,
    events,
    live,
    journalOffline,
    confirmStop: localReady && confirmStop,
    setConfirmStop,
    workingMode,
    setWorkingMode,
    finishedInBackground: localReady && finishedInBackground,
    details: localReady && details,
    setDetails,
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
    answeredKey,
    sentAfterKey,
    resentKey,
    lostSend: lostSend?.verdict === "resend" ? lostSend : undefined,
    endUnknown,
    releaseUnknown,
    changeDraft,
    refresh,
    setBusy,
    setReceipt,
    setSendObservation,
    setContinuation,
    navigate,
    setProblem,
    setFinishedInBackground,
    historyError,
    setHistoryError,
  };
}
