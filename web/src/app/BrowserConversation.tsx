import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";
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
  NativeQuestion,
  QueuePanel,
  SendObservation,
  TurnSettlement,
  WorkingProgress,
} from "../components";
import { UnpresentedEvents } from "../components/WorkingProgress";
import {
  applyTurnEvent,
  initialTurn,
  type LiveTurn,
  parseConversationEvent,
  provisionalItems,
} from "./conversationEvents";
import {
  abortTurn,
  ContinuationRefused,
  type ContinueRefusal,
  clearQueue,
  continueConversation,
  create,
  ConversationNotFound,
  NotAdmitted,
  queueMessage,
  type Session,
  type Status,
  send,
  sendReceipt,
  status,
} from "./conversations";
import { readHistoryFetch, timelineItems } from "./HistoryView";
import type { HistoryEntry } from "./history";
import type { Snapshot, Workspace } from "./snapshot";

export function BrowserConversation({
  workspace,
  id,
  title,
  identity,
  snapshot,
  onResnapshot,
  csrf,
  onLogin,
  onSessionCreated,
}: {
  workspace: Workspace;
  id?: string;
  title?: string;
  identity: string;
  snapshot: Snapshot;
  onResnapshot: () => void;
  csrf?: string;
  onLogin: () => void;
  onSessionCreated: (session: Session) => void;
}) {
  const navigate = useNavigate();
  const [current, setCurrent] = useState<Status>();
  const [opened, setOpened] = useState(false);
  const [openAttempt, setOpenAttempt] = useState(0);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [next, setNext] = useState<string>();
  const [draft, setDraft] = useState("");
  const [receipt, setReceipt] = useState("");
  const [sendObservation, setSendObservation] = useState<{
    text: string;
    state: "pending" | "accepted" | "rejected" | "uncertain";
  }>();
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [continuation, setContinuation] = useState<
    "pending" | "uncertain" | ContinueRefusal
  >();
  const [unseen, setUnseen] = useState(0);
  const [events, setEvents] = useState<unknown[]>([]);
  const [live, setLive] = useState<LiveTurn>();
  const [journalOffline, setJournalOffline] = useState(false);
  const continuationProof = useRef<
    { id: string; revision: string; result: Status["continuation"] } | undefined
  >(undefined);
  const openedProof = useRef("");
  const streamFailures = useRef(0);
  const pendingNativeEntry = useRef<string | undefined>(undefined);
  const [confirmStop, setConfirmStop] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [awayFromLatest, setAwayFromLatest] = useState(false);
  const [workingMode, setWorkingMode] = useState<"steer" | "follow_up">(
    "follow_up",
  );
  const [finishedInBackground, setFinishedInBackground] = useState(false);
  const wasWorking = useRef(false);
  const wasAtBottom = useRef(true);
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
  const uncertainKey = storage("uncertain");
  const ambiguous = sessionStorage.getItem(uncertainKey);
  const alive = useRef(true);
  const generation = useRef(0);
  const feed = useRef<HTMLElement>(null);
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
  const latest = useRef({ entries, next, unseen });
  latest.current = { entries, next, unseen };
  const readingAnchor = useRef<{ key: string; offset: number } | undefined>(
    undefined,
  );
  const captureAnchor = useCallback(() => {
    const viewport = feed.current;
    if (!viewport || wasAtBottom.current) return;
    const rows = viewport.querySelectorAll<HTMLElement>(".ah-feed > li");
    const top = viewport.getBoundingClientRect().top;
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (rect.bottom > top && latest.current.entries[i]) {
        readingAnchor.current = {
          key: latest.current.entries[i].entry_key,
          offset: rect.top - top,
        };
        return;
      }
    }
  }, []);
  const restoreAnchor = useCallback(
    (
      anchor: { key: string; offset: number } | undefined,
      pages: HistoryEntry[],
    ) => {
      const viewport = feed.current;
      if (!viewport || !anchor) return false;
      const index = pages.findIndex((e) => e.entry_key === anchor.key);
      const row =
        viewport.querySelectorAll<HTMLElement>(".ah-feed > li")[index];
      if (!row) return false;
      viewport.scrollTop +=
        row.getBoundingClientRect().top -
        viewport.getBoundingClientRect().top -
        anchor.offset;
      return true;
    },
    [],
  );
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
    setCurrent(undefined);
    setOpened(false);
    setEntries([]);
    setLive(undefined);
    setHistoryError(false);
    setProblem("");
    // Both reads are one open transition. Never publish a partial view.
    void (async () => {
      try {
        const [stateResult, historyResult] = await Promise.allSettled([
          status(id, controller.signal).then(async (initial) =>
            initial.state === "uncertain"
              ? status(id, controller.signal, true)
              : initial,
          ),
          readHistoryFetch(id, undefined, controller.signal),
        ]);
        if (!alive.current || version !== generation.current) return;
        if (stateResult.status === "rejected") throw stateResult.reason;
        const state = stateResult.value;
        if (
          historyResult.status === "rejected" &&
          !(
            state.native_history === "missing" &&
            (historyResult.reason as Error).message === "history_missing"
          )
        )
          throw historyResult.reason;
        if (state.workspace_id !== workspace.workspace_id)
          throw new Error("invalid workspace");
        setCurrent(state);
        setOpened(true);
        setEntries(
          historyResult.status === "fulfilled"
            ? historyResult.value.entries
            : [],
        );
        setNext(
          historyResult.status === "fulfilled"
            ? historyResult.value.next_after
            : undefined,
        );
        setEvents(state.events);
        openReady.current = true;
        if (queuedRefresh.current) {
          queuedRefresh.current = false;
          void latestRefresh.current(false, true);
        }
        openedProof.current = `${identity}:${id}`;
        continuationProof.current = {
          id,
          revision: state.native_revision,
          result: state.continuation,
        };
      } catch (error) {
        if (alive.current && version === generation.current) {
          if ((error as Error).message === "identity_lost") onLogin();
          else if (error instanceof ConversationNotFound)
            navigate(`/agents/${id}`, { replace: true });
          else setProblem("Keskustelua ei voitu ladata. Yritä uudelleen.");
        }
      }
    })();
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
  ]);
  useEffect(() => {
    setDraft(sessionStorage.getItem(draftKey) ?? "");
    setContinuation(
      (sessionStorage.getItem(continuationKey) as
        | "uncertain"
        | ContinueRefusal
        | null) ?? undefined,
    );
    const text = sessionStorage.getItem(submittedKey);
    if (text !== null && sessionStorage.getItem(uncertainKey))
      setSendObservation({ text, state: "uncertain" });
  }, [draftKey, continuationKey, submittedKey, uncertainKey]);
  const changeDraft = useCallback(
    (value: string) => {
      setDraft(value);
      sessionStorage.setItem(draftKey, value);
    },
    [draftKey],
  );
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
        setEvents(nextStatus.events);
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
          const page = await readHistoryFetch(id);
          if (!alive.current || version !== generation.current) return;
          const old = latest.current.entries;
          const prefix =
            old.length > 0 &&
            page.entries.every((e, i) => old[i]?.entry_key === e.entry_key);
          let merged = prefix ? [...old] : [...page.entries];
          let cursor = prefix
            ? (old.at(-1)?.entry_key ?? page.next_after)
            : page.next_after;
          if (prefix && !page.next_after && old.length === page.entries.length)
            cursor = undefined;
          for (let n = 0; cursor && n < 16; n++) {
            const additional = await readHistoryFetch(id, cursor);
            if (!alive.current || version !== generation.current) return;
            if (!additional.entries.length && additional.complete) {
              cursor = undefined;
              break;
            }
            if (
              !additional.entries.length ||
              additional.entries.some((e) =>
                merged.some((m) => m.entry_key === e.entry_key),
              )
            ) {
              setHistoryError(true);
              return;
            }
            merged = [...merged, ...additional.entries];
            cursor = additional.next_after;
          }
          if (merged.length > old.length && !wasAtBottom.current)
            setUnseen((n) => n + merged.length - old.length);
          captureAnchor();
          setEntries(merged);
          setNext(cursor);
          setHistoryError(false);
          if (reconcileContinuation) {
            sessionStorage.removeItem(continuationKey);
            setContinuation(undefined);
            setReceipt(
              "Jatkaminen kuitattiin. Aiemman vuoron tulos on epävarma; tarkista natiivi historia.",
            );
          }
          if (pendingNativeEntry.current) {
            if (
              merged.some((e) => e.entry_key === pendingNativeEntry.current)
            ) {
              pendingNativeEntry.current = undefined;
              setLive(
                (old) => old && { ...old, fragments: [], truncated: false },
              );
            } else {
              scheduleRetry(false, true);
            }
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
      clearRetry,
      scheduleRetry,
      navigate,
      onLogin,
      changeDraft,
    ],
  );
  latestRefresh.current = refresh;
  const initialSnapshot = useRef(snapshot);
  const recovering = useRef(false);
  const [streamEpoch, setStreamEpoch] = useState(0);
  useEffect(() => {
    if (recovering.current && initialSnapshot.current !== snapshot) {
      initialSnapshot.current = snapshot;
      recovering.current = false;
      setStreamEpoch((n) => n + 1);
    }
  }, [snapshot]);
  const resnapshot = useRef(onResnapshot);
  resnapshot.current = onResnapshot;
  useEffect(() => {
    void streamEpoch; // reconnect only after cursor recovery
    if (!id) return;
    let removed = false;
    let source: EventSource | undefined;
    let retry: number | undefined;
    let turn: LiveTurn;
    const recover = (historyOnly = false) => {
      if (removed) return;
      if (historyOnly) {
        turn = { ...turn, fragments: [], truncated: true };
        setLive(turn);
        void latestRefresh.current(false, true);
        return;
      }
      source?.close();
      source = undefined;
      setJournalOffline(true);
      recovering.current = true;
      resnapshot.current();
      void latestRefresh.current(false, true);
    };
    try {
      const tail =
        initialSnapshot.current.agents.find(
          (a) => a.agent_id === id && a.workspace_id === workspace.workspace_id,
        )?.live_tail ?? [];
      turn = initialTurn(
        initialSnapshot.current.event_cursor,
        tail.map((frame) => parseConversationEvent(JSON.stringify(frame))),
      );
      setLive(turn);
    } catch {
      resnapshot.current();
      return;
    }
    const connect = () => {
      if (removed) return;
      source = new EventSource(
        `/api/v1/events?after=${encodeURIComponent(turn.cursor)}`,
      );
      source.onopen = () => {
        streamFailures.current = 0;
        setJournalOffline(false);
      };
      for (const kind of [
        "snapshot.invalidated",
        "history.entry",
        "assistant.delta",
        "tool.started",
        "tool.updated",
        "tool.finished",
        "queue.changed",
        "turn.settled",
        "command.changed",
        "agent.changed",
        "workspace.changed",
        "title.changed",
        "source.warning",
        "question.requested",
        "question.resolved",
        "operation.changed",
        "unknown.native",
      ])
        source.addEventListener(kind, (message) => {
          try {
            const event = parseConversationEvent(
              (message as MessageEvent).data,
            );
            if ((message as MessageEvent).lastEventId !== event.cursor)
              throw new Error("mismatched SSE id");
            if (
              event.server_instance_id === turn.instance &&
              event.sequence <= turn.sequence
            )
              return;
            const result = applyTurnEvent(turn, event, id);
            turn = result.turn;
            if (result.recover) {
              recover(result.recover === "history");
              return;
            }
            if (result.entry) {
              pendingNativeEntry.current = result.entry.entry_key;
              void latestRefresh.current(false, true);
            } else if (!pendingNativeEntry.current) setLive(turn);
            if (event.kind === "snapshot.invalidated") {
              continuationProof.current = undefined;
              resnapshot.current();
              void latestRefresh.current(false, true);
            } else if (
              [
                "turn.settled",
                "command.changed",
                "queue.changed",
                "question.requested",
                "question.resolved",
              ].includes(event.kind)
            )
              void latestRefresh.current(false, event.kind === "turn.settled");
          } catch {
            recover();
          }
        });
      source.onerror = () => {
        if (removed) return;
        source?.close();
        source = undefined;
        setJournalOffline(true);
        // EventSource conceals 401/409. A bounded probe identifies a session
        // loss or cursor gap; it never becomes a second live stream.
        void (async () => {
          try {
            const response = await fetch(
              `/api/v1/events?after=${encodeURIComponent(turn.cursor)}`,
              {
                credentials: "same-origin",
                cache: "no-store",
                signal: AbortSignal.timeout(5000),
              },
            );
            await response.body?.cancel();
            if (removed) return;
            if (response.status === 401) {
              onLogin();
              return;
            }
            if (response.status === 409) {
              recover();
              return;
            }
          } catch {
            /* offline; slow fallback will read status */
          }
          if (!removed)
            retry = window.setTimeout(
              connect,
              Math.min(3000 * ++streamFailures.current, 30000),
            );
        })();
      };
    };
    connect();
    return () => {
      removed = true;
      source?.close();
      if (retry) window.clearTimeout(retry);
    };
    // Stream ownership is per identity and conversation; snapshot updates do not remount it.
  }, [id, workspace.workspace_id, onLogin, streamEpoch]);
  useEffect(() => {
    if (!id || !journalOffline) return;
    const timer = window.setInterval(
      () => void latestRefresh.current(false, true),
      60000,
    );
    return () => window.clearInterval(timer);
  }, [id, journalOffline]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a live fragment changes the feed height without changing native entries.
  useLayoutEffect(() => {
    if (wasAtBottom.current && feed.current) {
      feed.current.scrollTop = feed.current.scrollHeight;
      setUnseen(0);
    } else {
      restoreAnchor(readingAnchor.current, entries);
    }
  }, [entries, live, restoreAnchor]);
  // Footer controls can change the stream height without changing history.
  // Keep the native reading anchor for readers, or follow the latest turn.
  // biome-ignore lint/correctness/useExhaustiveDependencies: footer state changes are the layout-only trigger.
  useLayoutEffect(() => {
    const viewport = feed.current;
    if (!viewport) return;
    if (wasAtBottom.current) viewport.scrollTop = viewport.scrollHeight;
    else restoreAnchor(readingAnchor.current, entries);
  }, [
    queueOpen,
    receipt,
    problem,
    details,
    confirmStop,
    current?.state,
    events,
    restoreAnchor,
    entries,
  ]);
  useEffect(() => {
    if (!finishedInBackground) return;
    const old = document.title;
    document.title = `Pi tarvitsee huomiota · ${old}`;
    return () => {
      document.title = old;
    };
  }, [finishedInBackground]);
  const start = async () => {
    if (busy || !csrf || ambiguous) return;
    setBusy(true);

    try {
      const token = csrf;
      if (!alive.current) return;
      sessionStorage.setItem(uncertainKey, "create");
      setReceipt("Luodaan · tulos odottaa");
      const result = await create(workspace.workspace_id, token);
      sessionStorage.removeItem(uncertainKey);
      if (!alive.current) return;
      onSessionCreated(result);
      navigate(
        `/workspaces/${workspace.workspace_id}?conversation=${result.agent_id}`,
      );
    } catch (error) {
      if ((error as Error).message === "identity_lost") onLogin();
      if (alive.current) {
        setReceipt(
          sessionStorage.getItem(uncertainKey)
            ? "Luonnin tulos epävarma. Älä luo uudelleen tässä istunnossa. Tarkista tilannekuva ja natiivi historia."
            : "Istuntoa ei voitu vahvistaa. Luontia ei lähetetty.",
        );
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const continueEnded = async () => {
    if (
      busy ||
      !csrf ||
      !id ||
      !current ||
      current.continuation !== "eligible" ||
      continuation ||
      !controlled
    )
      return;
    const version = generation.current;
    setBusy(true);
    let sent = false;
    try {
      const token = csrf;
      if (!alive.current || version !== generation.current) return;
      // Persist before the native write; reload must not quietly repost it.
      sessionStorage.setItem(continuationKey, "uncertain");
      setContinuation("pending");
      sent = true;
      await continueConversation(id, workspace.workspace_id, token);
      if (
        !alive.current ||
        version !== generation.current ||
        sessionStorage.getItem(continuationKey) !== "uncertain"
      )
        return;
      setContinuation("uncertain");
      setReceipt(
        "Jatkaminen kuitattiin. Tarkistetaan tila ja historia; aiemman vuoron tulos on epävarma.",
      );
      void refresh(false, true);
    } catch (error) {
      if ((error as Error).message === "identity_lost") onLogin();
      if (!alive.current || version !== generation.current) return;
      if (sent && sessionStorage.getItem(continuationKey) !== "uncertain")
        return;
      if (error instanceof ContinuationRefused) {
        // A 409 is a definite refusal, not an ambiguous write. Retain its
        // explanation until the person's next explicit status check.
        sessionStorage.removeItem(continuationKey);
        setContinuation(error.code);
      } else if (sent) {
        setContinuation("uncertain");
      } else {
        setReceipt("Istuntoa ei voitu vahvistaa. Jatkamista ei lähetetty.");
      }
    } finally {
      if (alive.current && version === generation.current) setBusy(false);
    }
  };
  const submit = async () => {
    if (
      busy ||
      !current ||
      (current.state !== "idle" && current.state !== "rejected") ||
      !draft.trim() ||
      ambiguous ||
      continuation ||
      !csrf
    )
      return;
    const text = draft;
    const command = crypto.randomUUID();
    setBusy(true);

    try {
      const token = csrf;
      if (!alive.current) return;
      sessionStorage.setItem(submittedKey, text);
      sessionStorage.setItem(sendKey, command);
      setSendObservation({ text, state: "pending" });
      setReceipt("Viesti odottaa kuittausta");
      await send(current.agent_id, text, command, token);
      if (!alive.current) return;
      setReceipt("Viesti odottaa natiivia hyväksyntää");
      await refresh();
    } catch (error) {
      if ((error as Error).message === "identity_lost") onLogin();
      else if (alive.current && error instanceof NotAdmitted) {
        sessionStorage.removeItem(sendKey);
        setSendObservation({ text, state: "rejected" });
        setReceipt("Viesti hylättiin. Tarkista keskustelun tila.");
      } else if (alive.current) {
        sessionStorage.setItem(uncertainKey, command);
        setSendObservation({ text, state: "uncertain" });
        setReceipt(
          "Lähetyksen tulos epävarma. Viestiä ei lähetetä automaattisesti uudelleen. Tarkista tila ja natiivi historia.",
        );
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const submitQueue = async (kind: "steer" | "follow_up") => {
    if (
      busy ||
      !current ||
      current.state !== "accepted" ||
      !draft.trim() ||
      ambiguous ||
      !csrf
    )
      return;
    const text = draft,
      command = crypto.randomUUID();
    setBusy(true);
    try {
      const token = csrf;
      if (!alive.current) return;
      sessionStorage.setItem(sendKey, command);
      setSendObservation({ text, state: "pending" });
      sessionStorage.setItem(submittedKey, text);
      setReceipt("Viesti odottaa kuittausta");
      await queueMessage(current.agent_id, text, command, token, kind);
      if (alive.current) await refresh();
    } catch (error) {
      if ((error as Error).message === "identity_lost") onLogin();
      if (error instanceof NotAdmitted) {
        sessionStorage.removeItem(sendKey);
        sessionStorage.removeItem(submittedKey);
        setSendObservation({ text, state: "rejected" });
        if (alive.current) {
          setReceipt(
            "Tila muuttui. Viestiä ei lähetetty. Tarkista keskustelun tila.",
          );
          void refresh();
        }
      } else if (
        alive.current &&
        (error as Error).message !== "identity_lost"
      ) {
        sessionStorage.setItem(uncertainKey, command);
        setSendObservation({ text, state: "uncertain" });
        setReceipt(
          "Lähetyksen tulos epävarma. Älä lähetä automaattisesti uudelleen.",
        );
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const clearNativeQueue = async () => {
    if (
      busy ||
      !current ||
      !csrf ||
      ambiguous ||
      current.state === "pending" ||
      current.state === "uncertain" ||
      current.state === "stopping"
    )
      return;
    setBusy(true);
    let sent = false;
    try {
      const token = csrf;
      if (!alive.current) return;
      sent = true;
      const removed = await clearQueue(
        current.agent_id,
        crypto.randomUUID(),
        token,
      );
      if (!alive.current) return;
      // The two groups are restored in Pi's reported order, never from an
      // earlier observation of the queue. Do not overwrite an edited draft.
      const restored = [...removed.steering, ...removed.follow_up].join("\n\n");
      if (restored) changeDraft(draft ? `${draft}\n\n${restored}` : restored);
      setReceipt(
        restored
          ? "Jonosta poistetut viestit palautettiin kirjoituskenttään."
          : "Jono oli jo tyhjä.",
      );
      void refresh();
    } catch {
      if (alive.current)
        setReceipt(
          sent
            ? "Jonon tyhjennyksen tulos epävarma. Tarkista tila; viestejä ei palautettu ilman kuittausta."
            : "Istuntoa ei voitu vahvistaa.",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const stopNow = async () => {
    if (busy || !current || !csrf) return;
    setBusy(true);

    let sent = false;
    try {
      const token = csrf;
      if (!alive.current) return;
      sent = true;
      setReceipt("Keskeytystä pyydetään");
      const commandId = crypto.randomUUID();
      await abortTurn(current.agent_id, commandId, token);
      if (alive.current)
        setReceipt(
          "Keskeytyspyyntö vastaanotettiin. Pi:n kuittaus näkyy tilassa; työkalujen päättymistä ei ole vahvistettu.",
        );
    } catch (error) {
      if (alive.current)
        setReceipt(
          error instanceof NotAdmitted
            ? "Keskeytystä ei hyväksytty. Tarkista keskustelun tila."
            : sent
              ? "Keskeytyksen tulos epävarma. Tarkista tila; pyyntöä ei lähetetä uudelleen."
              : "Istuntoa ei voitu vahvistaa. Keskeytystä ei pyydetty.",
        );
    } finally {
      if (alive.current) {
        setBusy(false);
        setConfirmStop(false);
        void refresh();
      }
    }
  };
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
  const controlled =
    opened && !!current && current.workspace_id === workspace.workspace_id;
  const canSend =
    controlled &&
    !busy &&
    !ambiguous &&
    !continuation &&
    (current.state === "idle" ||
      current.state === "rejected" ||
      current.state === "accepted");
  useEffect(() => {
    if (!id || !controlled || focusedOnOpen.current) return;
    focusedOnOpen.current = true;
    if (document.activeElement === document.body)
      section.current
        ?.querySelector("textarea")
        ?.focus({ preventScroll: true });
  }, [id, controlled]);
  const notices = (
    <>
      {receipt &&
      sendObservation?.state !== "uncertain" &&
      !/^(Viesti hyväksyttiin|Viesti odottaa|Varmistetaan istuntoa|Jono oli jo tyhjä)/.test(
        receipt,
      ) ? (
        <InlineNotice title={receipt} tone="warning" />
      ) : null}
      {problem ? <InlineNotice title={problem} tone="danger" /> : null}
      {ambiguous && sendObservation?.state === "uncertain" ? (
        <InlineNotice
          title="Aiemman pyynnön tulos epävarma"
          description="Tarkista tila ja natiivi historia. Viestiä ei lähetetä automaattisesti uudelleen."
          tone="warning"
        />
      ) : null}
    </>
  );
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
            activityLabel={
              current
                ? ({
                    idle: "Valmis",
                    pending: "Odottaa kuittausta",
                    accepted: "Pi työskentelee",
                    rejected: "Viesti hylättiin",
                    uncertain: "Tila epävarma",
                    stopping: "Pysäytetään",
                  }[current.state] ?? "Tila ei tiedossa")
                : "Tila ei tiedossa"
            }
            activityKind={
              !current || current.state === "uncertain"
                ? "unknown"
                : current.state === "accepted"
                  ? "working"
                  : "neutral"
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
                ...timelineItems(entries),
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
                ...(current?.pending_question
                  ? [
                      {
                        id: `question:${current.pending_question.request_id}`,
                        kind: "question",
                        content: (
                          <NativeQuestion
                            kind={current.pending_question.question_kind}
                            prompt={current.pending_question.prompt}
                            choices={current.pending_question.choices}
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
                    item.kind === "assistant" ? (
                      <AssistantMessage
                        onCopy={() =>
                          void navigator.clipboard?.writeText(item.text)
                        }
                      >
                        <Markdown text={item.text} />
                      </AssistantMessage>
                    ) : (
                      <LiveToolRow
                        name={item.name ?? "Työkalu"}
                        state={
                          item.state as
                            | "running"
                            | "succeeded"
                            | "failed"
                            | "cancelled"
                        }
                      />
                    ),
                })),
              ]}
              historyMode="pagedAccessible"
              newContentCount={unseen}
              showJumpToLatest={awayFromLatest}
              onJumpToLatest={() => {
                wasAtBottom.current = true;
                setAwayFromLatest(false);
                feed.current?.scrollTo({ top: feed.current.scrollHeight });
                setUnseen(0);
              }}
            />
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
                onPress={() =>
                  void readHistoryFetch(id, next)
                    .then((p) => {
                      captureAnchor();
                      setEntries((old) => [
                        ...old,
                        ...p.entries.filter(
                          (e) => !old.some((o) => o.entry_key === e.entry_key),
                        ),
                      ]);
                      setNext(p.next_after);
                    })
                    .catch(() => {
                      setHistoryError(true);
                    })
                }
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
            {journalOffline ? (
              <InlineNotice
                title="Tapahtumayhteys katkesi"
                description="Tila ja natiivi historia tarkistetaan uudelleen. Viestiä ei lähetetä uudelleen."
                tone="warning"
              />
            ) : null}
            {live?.truncated || current?.event_loss ? (
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
          {confirmStop && current?.state === "accepted" ? (
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
          {controlled && (continuation || current?.state === "uncertain") ? (
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
                      reason:
                        "Odota vahvistettua joutotilaa; epävarmaa viestiä ei lähetetä uudelleen.",
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
                current?.state === "accepted"
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
