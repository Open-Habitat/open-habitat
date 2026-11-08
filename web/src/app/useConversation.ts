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
import { ownWrites, type SendObservationValue } from "./sentMessages";
import type { Snapshot, Workspace } from "./snapshot";
import { useConversationDraft } from "./useConversationDraft";
import { useReadingPosition } from "./useReadingPosition";

const txt = liveText(useConversationText);

// Owns the native read model and journal recovery for one conversation.
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
  const settleCommand = useCallback(
    (command: string, outcome: "accepted" | "rejected") => {
      const text = sessionStorage.getItem(submittedKey);
      if (sessionStorage.getItem(sendKey) !== command || text === null) return;
      // What the send itself recorded (its kind) stays with its outcome.
      setSendObservation((old) => ({
        ...(old?.command === command && old.text === text ? old : undefined),
        text,
        command,
        state: outcome,
      }));
      setReceipt(outcome === "rejected" ? txt.rejected : "");
      sessionStorage.removeItem(sendKey);
      sessionStorage.removeItem(uncertainKey);
      sessionStorage.removeItem(submittedKey);
      sessionStorage.removeItem(answeredKey);
    },
    [sendKey, uncertainKey, submittedKey, answeredKey],
  );
  useEffect(() => {
    const command = sessionStorage.getItem(sendKey);
    if (!localReady || !command || current?.command_id !== command) return;
    const outcome = current.send_receipt || current.ack;
    if (outcome === "accepted" || outcome === "rejected")
      settleCommand(command, outcome);
  }, [current, localReady, sendKey, settleCommand]);
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
          if (!outcome) {
            try {
              const receipt = await sendReceipt(id, command);
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
            if (outcome === "accepted" || outcome === "rejected")
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
  return {
    cutOff: windowView?.cutOff,
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
