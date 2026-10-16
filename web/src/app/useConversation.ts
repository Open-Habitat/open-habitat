import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
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
import type { Snapshot, Workspace } from "./snapshot";
import { useReadingPosition } from "./useReadingPosition";

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
  const [draftState, setDraftState] = useState({ key: "", value: "" });
  const [receipt, setReceipt] = useState("");
  const [sendObservation, setSendObservation] = useState<{
    text: string;
    state: "pending" | "accepted" | "rejected" | "uncertain";
  }>();
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  // The HTTP send may still be held after a status/receipt read returns 404.
  const inFlightSend = useRef<string | undefined>(undefined);
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
  const [queueOpen, setQueueOpen] = useState(false);
  const [workingMode, setWorkingMode] = useState<"steer" | "follow_up">(
    "follow_up",
  );
  const [finishedInBackground, setFinishedInBackground] = useState(false);
  const wasWorking = useRef(false);
  const [details, setDetails] = useState(false);
  const pending = useRef(false);
  const openReady = useRef(false);
  const queuedRefresh = useRef(false);
  const queuedProof = useRef(false);
  const queuedHistory = useRef(false);
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
  const continuationKey = storage("continue");
  const draftKey = storage("draft");
  const draft =
    draftState.key === draftKey
      ? draftState.value
      : (sessionStorage.getItem(draftKey) ?? "");
  const uncertainKey = storage("uncertain");
  const ambiguous = sessionStorage.getItem(uncertainKey);
  const alive = useRef(true);
  const generation = useRef(0);
  const queuePanel = useRef<HTMLElement>(null);
  const queueReturn = useRef<
    | {
        top: number;
        atBottom: boolean;
        anchor?: { key: string; offset: number };
      }
    | undefined
  >(undefined);
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
    setQueueOpen(false);
    setDetails(false);
    setFinishedInBackground(false);
    setWorkingMode("follow_up");
    focusedOnOpen.current = false;
    queueReturn.current = undefined;
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
            else setProblem("Keskustelua ei voitu ladata. Yritä uudelleen.");
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
    setDraftState({
      key: draftKey,
      value: sessionStorage.getItem(draftKey) ?? "",
    });
    setContinuation(
      (sessionStorage.getItem(continuationKey) as
        | "uncertain"
        | ContinueRefusal
        | null) ?? undefined,
    );
    const text = sessionStorage.getItem(submittedKey);
    setSendObservation(
      text !== null && sessionStorage.getItem(uncertainKey)
        ? { text, state: "uncertain" }
        : undefined,
    );
  }, [draftKey, continuationKey, submittedKey, uncertainKey]);
  const changeDraft = useCallback(
    (value: string) => {
      setDraftState({ key: draftKey, value });
      sessionStorage.setItem(draftKey, value);
    },
    [draftKey],
  );
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
        return;
      }
      pending.current = true;
      const version = generation.current;
      let receiptPending = false;
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
        const working = ["pending", "accepted", "stopping"].includes(
          nextStatus.state,
        );
        if (
          !working &&
          wasWorking.current &&
          document.visibilityState === "hidden"
        )
          setFinishedInBackground(true);
        wasWorking.current = working;
        setCurrent(nextStatus);
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
          if (!outcome && inFlightSend.current === command) outcome = "pending";
          const text = sessionStorage.getItem(submittedKey);
          // Do not let an older in-flight read settle a newer command.
          if (sessionStorage.getItem(sendKey) === command && text !== null) {
            if (outcome === "accepted" || outcome === "rejected") {
              setSendObservation({ text, state: outcome });
              setReceipt(outcome === "rejected" ? "Viesti hylättiin." : "");
              sessionStorage.removeItem(sendKey);
              sessionStorage.removeItem(uncertainKey);
              sessionStorage.removeItem(submittedKey);
              if (
                outcome === "accepted" &&
                sessionStorage.getItem(draftKey) === text
              )
                changeDraft("");
              if (outcome === "rejected" && !sessionStorage.getItem(draftKey))
                changeDraft(text);
            } else {
              sessionStorage.setItem(uncertainKey, command);
              setSendObservation({
                text,
                state: outcome === "pending" ? "pending" : "uncertain",
              });
              setReceipt(
                outcome === "pending"
                  ? "Viesti odottaa kuittausta. Tarkistetaan uudelleen."
                  : "Lähetyksen tulos on yhä epävarma. Viestiä ei lähetetä uudelleen.",
              );
              if (outcome === "pending") receiptPending = true;
            }
          }
        }
        const reconcileContinuation =
          sessionStorage.getItem(continuationKey) === "uncertain" &&
          nextStatus.state === "idle" &&
          nextStatus.native_history === "present";
        if (
          (readHistory || reconcileContinuation) &&
          nextStatus.native_history === "present"
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
            setReceipt(
              "Jatkaminen kuitattiin. Aiemman vuoron tulos on epävarma; tarkista natiivi historia.",
            );
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
              setProblem(
                "Ohjaus ei ole enää käytettävissä. Lähetyksen tulos on epävarma.",
              );
            } else
              navigate(`/agents/${id}`, {
                replace: true,
                state: { readOnly: true },
              });
          } else {
            setProblem("Yhteys katkesi. Näytetään viimeisin tunnettu tila.");
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
        if (rerun) void latestRefresh.current(proof, history);
      }
    },
    [
      id,
      workspace.workspace_id,
      sendKey,
      submittedKey,
      uncertainKey,
      continuationKey,
      draftKey,
      captureAnchor,
      store,
      clearRetry,
      scheduleRetry,
      navigate,
      onLogin,
      changeDraft,
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
    queueOpen: localReady && queueOpen,
    setQueueOpen,
    workingMode,
    setWorkingMode,
    finishedInBackground: localReady && finishedInBackground,
    details: localReady && details,
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
    inFlightSend,
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
