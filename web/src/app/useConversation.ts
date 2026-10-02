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
import type { Workspace } from "./snapshot";
import { useReadingPosition } from "./useReadingPosition";

// Owns the native read model and journal recovery for one conversation.
export function useConversation({
  workspace,
  id,
  identity,
  store,
  journalOffline,
  onStatusEvent,
  onLogin,
}: {
  workspace: Workspace;
  id?: string;
  identity: string;
  store: ConversationStore;
  journalOffline: boolean;
  onStatusEvent: (listener: (id: string, kind: string) => void) => () => void;
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
  } = useReadingPosition(entries, next, id);
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
              navigate(`/agents/${id}`, { replace: true });
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
                (nextStatus.ack === "accepted" || nextStatus.ack === "rejected"
                  ? nextStatus.ack
                  : undefined)
              : undefined;
          if (!outcome) {
            try {
              outcome = await sendReceipt(id, command);
            } catch (error) {
              if ((error as Error).message === "identity_lost") throw error;
            }
          }
          if (!alive.current || version !== generation.current) return;
          const text = sessionStorage.getItem(submittedKey);
          if (text !== null && outcome) {
            setSendObservation({ text, state: outcome });
            if (outcome === "uncertain")
              sessionStorage.setItem(uncertainKey, command);
            if (outcome === "accepted" || outcome === "rejected") {
              sessionStorage.removeItem(uncertainKey);
              if (
                outcome === "accepted" &&
                sessionStorage.getItem(draftKey) === text
              )
                changeDraft("");
              if (outcome === "rejected" && !sessionStorage.getItem(draftKey))
                changeDraft(text);
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
      } catch (error) {
        if (alive.current && version === generation.current) {
          if ((error as Error).message === "identity_lost") onLogin();
          else if (error instanceof ConversationNotFound)
            navigate(`/agents/${id}`, { replace: true });
          else {
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
  // A tab-wide journal dispatches active status events here; background status
  // observations are owned by the store and never trigger reads on switch.
  useEffect(
    () =>
      onStatusEvent((agentId, kind) => {
        if (agentId !== id) return;
        void latestRefresh.current(false, kind === "turn.settled");
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
