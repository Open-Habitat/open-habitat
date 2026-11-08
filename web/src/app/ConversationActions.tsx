import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import type { NavigateFunction } from "react-router";
import { InlineNotice } from "../components";
import { type Language, liveText } from "../i18n";
import { conversationActionsText } from "../text/conversationActions";
import { useConversationText } from "../text/useConversation";
import {
  abortTurn,
  clearQueue,
  closeEmpty,
  createTracked,
  NotAdmitted,
  queueMessage,
  type Session,
  type Status,
  send,
} from "./conversations";
import type { HistoryEntry } from "./history";
import { refusalReason, WriteRefused } from "./mutations";
import {
  lastUserKey,
  type SendObservationValue as Observation,
  type OwnSend,
  ownWrites,
  type QueuedSend,
  userKeys,
} from "./sentMessages";
import type { Workspace } from "./snapshot";

const txt = liveText(conversationActionsText);

// A receipt or problem stays in the language it was written in, so a check
// against one accepts both.
function inEitherLanguage(
  message: string,
  messages: (language: Language) => string[],
) {
  return (["fi", "en"] as const).some((l) => messages(l).includes(message));
}

/** Progress receipts that need no notice of their own. */
const quietReceipt = (receipt: string) =>
  inEitherLanguage(receipt, (l) => [
    conversationActionsText[l].awaitingAck,
    conversationActionsText[l].awaitingNative,
    conversationActionsText[l].queueEmpty,
    useConversationText[l].pending,
  ]);

/** Why the host refused a message and what the person can do. A refusal
 * means nothing was written: the text is back in the field. (A message the
 * host already took and is sent again is not refused; the daemon answers
 * it as the same message.) */
function messageRefusal(code: string, kind: "send" | "queue") {
  if (code === "read_only_history") return txt.readOnlyRefusal;
  if (code === "invalid_attachments") return refusalReason(code, 400);
  return kind === "send" ? txt.sendRefusal : txt.queueRefusal;
}
/** One Stop press on a running turn. Its outcome is read from status: the
 * turn ending is the success, so success needs no message of its own. */
export type StopAttempt = {
  id: string;
  command: string;
  phase: "pending" | "rejected" | "uncertain";
};
/** Queue texts already put back into the field, by the queue revision they
 * were removed from, so a status read from before the removal does not show
 * them a second time beside the field. */
export type RestoredQueue = { id: string; revision: number };
// Write outcomes stay distinct: an unacknowledged send must not be retried automatically.
export function useConversationActions({
  firstChoice,
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
  setBusy,
  setReceipt,
  setSendObservation,
  setConfirmStop,
  changeDraft,
  onSent,
  onQueued,
  queued = [],
  onSendOutcome,
  refresh,
  onLogin,
  onSessionCreated,
  navigate,
}: {
  firstChoice?: { provider?: string; model: string; thinking?: string };
  workspace: Workspace;
  id?: string;
  csrf?: string;
  ambiguous: string | null;
  busy: boolean;
  current?: Status;
  /** Native history as this page shows it. */
  entries: HistoryEntry[];
  draft: string;
  receipt: string;
  sendObservation?: Observation;
  problem: string;
  serverUnavailable: boolean;
  alive: RefObject<boolean>;
  generation: RefObject<number>;
  submittedKey: string;
  sendKey: string;
  uncertainKey: string;
  answeredKey: string;
  sentAfterKey: string;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setReceipt: Dispatch<SetStateAction<string>>;
  setSendObservation: Dispatch<SetStateAction<Observation | undefined>>;
  setConfirmStop: Dispatch<SetStateAction<boolean>>;
  changeDraft: (value: string) => void;
  /** Draws a direct send as the person's message. */
  onSent: (message: OwnSend) => void;
  /** Draws a steering or follow-up message, or with `clear` drops them all. */
  onQueued: (message: QueuedSend | "clear") => void;
  /** This tab's queued messages Pi has not shown in history yet. */
  queued?: readonly QueuedSend[];
  /** This visit's send window; never inferred from restored receipts. */
  onSendOutcome?: (event: import("./nextWaiting").SendWindowEvent) => void;
  refresh: (proof?: boolean, history?: boolean) => Promise<void>;
  onLogin: () => void;
  onSessionCreated: (session: Session) => void;
  navigate: NavigateFunction;
}) {
  const [stopAttempt, setStopAttempt] = useState<StopAttempt>();
  const [restoredQueue, setRestoredQueue] = useState<RestoredQueue>();
  // Any other revision is newer truth about Pi's queue; the mark is spent.
  const queueRevision = current?.queue?.revision;
  useEffect(() => {
    if (restoredQueue && restoredQueue.revision !== queueRevision)
      setRestoredQueue(undefined);
  }, [restoredQueue, queueRevision]);
  const start = async (
    choice?: { model: string; thinking?: string },
    replaceEmpty = false,
  ) => {
    if (busy || !csrf || ambiguous || serverUnavailable) return;
    setBusy(true);
    let handedOff = false;

    try {
      const token = csrf;
      if (!alive.current) return;
      const version = generation.current;
      setReceipt(txt.creating);
      const result = await createTracked(
        workspace.workspace_id,
        token,
        uncertainKey,
        () => alive.current && generation.current === version,
        choice,
      );
      if (!result) return;
      // Stop old status callbacks before closing the replaced child. React's
      // route effect cleanup can otherwise lose to its expected late 404.
      setBusy(false);
      handedOff = true;
      alive.current = false;
      ++generation.current;
      onSessionCreated(result);
      navigate(
        `/workspaces/${workspace.workspace_id}?conversation=${result.agent_id}`,
      );
      // Only the composer's explicitly empty replacement asks for cleanup.
      // The daemon rechecks emptiness/writers; another tab's message must not
      // be removed even if this view still looks empty.
      if (replaceEmpty && id) {
        try {
          await closeEmpty(id, token);
        } catch {
          if (alive.current) setReceipt(txt.closeEmptyFailed);
        }
      }
    } catch (error) {
      if ((error as Error).message === "identity_lost") onLogin();
      if (alive.current) {
        setReceipt(
          error instanceof WriteRefused
            ? txt.createRefused(refusalReason(error.code, error.status))
            : sessionStorage.getItem(uncertainKey)
              ? txt.createUncertain
              : txt.createUnconfirmed,
        );
      }
    } finally {
      if (alive.current && !handedOff) setBusy(false);
    }
  };
  // The host answered: it holds the command, whose outcome is now pending
  // whether or not this view is still there to read it (useConversation).
  const answered = (command: string) => {
    ownWrites.end(command);
    if (sessionStorage.getItem(sendKey) === command)
      sessionStorage.setItem(answeredKey, command);
  };
  // History can later show that a send whose outcome was lost arrived, but
  // only if nothing else could be the newer message carrying its text: no
  // message in Pi's queue (another tab's included) and none of this tab's
  // delivered but not yet in history. Otherwise the send keeps no mark and
  // only its receipt or a status can settle it.
  const markSent = () => {
    const queue = current?.queue;
    if (queued.length || queue?.steering.length || queue?.follow_up.length)
      sessionStorage.removeItem(sentAfterKey);
    else sessionStorage.setItem(sentAfterKey, lastUserKey(entries));
  };
  // The text leaves the field at once and is drawn where it is going; a
  // refused or unknown outcome gives it back (see sentMessages.ts). A message
  // not typed in the field (the editor's note) keeps the draft.
  // A message that waited for an AI sign-in brings its own command ID
  // (aiSignIn.ts). Resolves false when the view could not send it now.
  const submit = async (
    text = draft,
    keepDraft = false,
    commandId?: string,
  ): Promise<boolean> => {
    if (
      busy ||
      !current ||
      current.run_active === true ||
      (current.state !== "idle" && current.state !== "rejected") ||
      !text.trim() ||
      ambiguous ||
      serverUnavailable ||
      problem ||
      sessionStorage.getItem(sendKey) ||
      !csrf
    )
      return false;
    const command = commandId ?? crypto.randomUUID();
    setBusy(true);

    try {
      const token = csrf;
      if (!alive.current) return true;
      sessionStorage.setItem(submittedKey, text);
      sessionStorage.setItem(sendKey, command);
      sessionStorage.setItem(uncertainKey, command);
      markSent();
      ownWrites.begin(command);
      setSendObservation({ text, state: "pending", command, kind: "send" });
      onSent({ command, text, before: userKeys(entries) });
      if (!keepDraft) changeDraft("");
      setReceipt(txt.awaitingAck);
      onSendOutcome?.("pending");
      await send(current.agent_id, text, command, token, firstChoice);
      answered(command);
      onSendOutcome?.("accepted");
      if (!alive.current) return true;
      setReceipt(txt.awaitingNative);
      await refresh();
    } catch (error) {
      onSendOutcome?.("failed");
      ownWrites.end(command);
      if ((error as Error).message === "identity_lost") onLogin();
      else if (alive.current && error instanceof NotAdmitted) {
        sessionStorage.removeItem(sendKey);
        sessionStorage.removeItem(uncertainKey);
        setSendObservation({ text, state: "rejected", command });
        setReceipt(messageRefusal(error.code, "send"));
        void refresh();
      } else if (alive.current && sessionStorage.getItem(sendKey) === command) {
        // A status read while the reply was on its way may have settled the
        // command already; a reply lost after that (a host restart) does not
        // make a known outcome unknown again.
        sessionStorage.setItem(uncertainKey, command);
        setSendObservation({ text, state: "uncertain", command });
        setReceipt(txt.sendError);
        void refresh();
      }
    } finally {
      if (alive.current) setBusy(false);
    }
    return true;
  };
  const submitQueue = async (
    kind: "steer" | "follow_up",
    text = draft,
    keepDraft = false,
  ) => {
    if (
      busy ||
      !current ||
      !(current.run_active ?? current.state === "accepted") ||
      !text.trim() ||
      ambiguous ||
      serverUnavailable ||
      problem ||
      sessionStorage.getItem(sendKey) ||
      !csrf
    )
      return;
    const command = crypto.randomUUID();
    setBusy(true);
    try {
      const token = csrf;
      if (!alive.current) return;
      sessionStorage.setItem(sendKey, command);
      sessionStorage.setItem(uncertainKey, command);
      markSent();
      ownWrites.begin(command);
      setSendObservation({ text, state: "pending", command, kind: "queue" });
      sessionStorage.setItem(submittedKey, text);
      onQueued({
        command,
        kind,
        text,
        preexisting: entries
          .filter((e) => e.kind === "user" && e.content?.text?.includes(text))
          .map((e) => e.entry_key),
      });
      if (!keepDraft) changeDraft("");
      setReceipt(txt.awaitingAck);
      onSendOutcome?.("pending");
      await queueMessage(current.agent_id, text, command, token, kind);
      answered(command);
      onSendOutcome?.("accepted");
      if (alive.current) await refresh();
    } catch (error) {
      onSendOutcome?.("failed");
      ownWrites.end(command);
      if ((error as Error).message === "identity_lost") onLogin();
      if (alive.current && error instanceof NotAdmitted) {
        sessionStorage.removeItem(sendKey);
        sessionStorage.removeItem(uncertainKey);
        sessionStorage.removeItem(submittedKey);
        setSendObservation({ text, state: "rejected", command });
        if (alive.current) {
          setReceipt(messageRefusal(error.code, "queue"));
          void refresh();
        }
      } else if (
        alive.current &&
        (error as Error).message !== "identity_lost" &&
        sessionStorage.getItem(sendKey) === command
      ) {
        sessionStorage.setItem(uncertainKey, command);
        setSendObservation({ text, state: "uncertain", command });
        setReceipt(txt.sendError);
        void refresh();
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  // stop: the restored texts in the field are the whole outcome.
  const clearNativeQueue = async (stop = false) => {
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
        stop,
      );
      if (!alive.current) return;
      // Restored in Pi's reported order, never from an earlier observation
      // of the queue: first what Pi delivered and the stopped turn left
      // unanswered, then what was still queued. Do not overwrite an edited
      // draft.
      const restored = [
        ...removed.unanswered,
        ...removed.steering,
        ...removed.follow_up,
      ].join("\n\n");
      if (restored) changeDraft(draft ? `${draft}\n\n${restored}` : restored);
      // Pi's answer is the whole truth about its queue now; a delivered
      // message this tab still drew is in native history or soon will be.
      onQueued("clear");
      if (current.queue)
        setRestoredQueue({
          id: current.agent_id,
          revision: current.queue.revision,
        });
      // Stop reads status after its abort; an earlier read here would only
      // hold that one back.
      if (!stop) {
        setReceipt(restored ? txt.queueRestored : txt.queueEmpty);
        void refresh();
      }
    } catch (error) {
      if ((error as Error).message === "identity_lost") onLogin();
      else if (alive.current)
        setReceipt(sent ? txt.clearUncertain : txt.sessionUnconfirmed);
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  // Stop is immediate and asks nothing (Jari 13.10.). Pi keeps its queue over
  // an abort, so the queued messages are first taken back into the field, as
  // Pi's TUI does on Esc, instead of waiting for the next turn. Pi is asked
  // even when this view shows no queue: a message queued a moment ago, or one
  // Pi just delivered that the stopped turn will never answer, is only in
  // Pi's answer (Jari 25.10.2026). The composer
  // shows the stop in progress until status shows the turn ended; only a
  // refused or unknown outcome gets a message, and only while the turn
  // still runs (a turn that ended on its own needs no stop).
  // A press is only recorded here; the effect below, which always sees this
  // render's state, runs it. A Stop pressed while the person's message is
  // still on its way, or sent and not yet taken, waits for that instead of
  // being dropped: the message may be in Pi's queue by then, and Pi refuses
  // to clear a queue while a command is pending.
  const stopWanted = useRef<StopAttempt | undefined>(undefined);
  useEffect(() => {
    const wanted = stopWanted.current;
    if (!wanted) return;
    if (wanted.id !== current?.agent_id) {
      stopWanted.current = undefined;
      return;
    }
    // A pending observation is read from this render even when the command
    // was just settled: this render's guards still see it outstanding.
    const command = sessionStorage.getItem(sendKey);
    if (
      busy ||
      sendObservation?.state === "pending" ||
      (command && ownWrites.snapshot().has(command))
    )
      return;
    stopWanted.current = undefined;
    void runStop(wanted.command);
  });
  const stopNow = () => {
    if (!current || !csrf) return;
    const wanted = {
      id: current.agent_id,
      command: crypto.randomUUID(),
      phase: "pending",
    } as const;
    stopWanted.current = wanted;
    setStopAttempt(wanted);
  };
  const runStop = async (command: string) => {
    if (!current || !csrf) return;
    const id = current.agent_id;
    const settle = (phase: StopAttempt["phase"]) =>
      setStopAttempt((attempt) =>
        attempt?.command === command ? { ...attempt, phase } : attempt,
      );
    await clearNativeQueue(true);
    if (!alive.current) return;
    setBusy(true);
    try {
      await abortTurn(id, command, csrf);
    } catch (error) {
      if ((error as Error).message === "identity_lost") onLogin();
      else if (alive.current) {
        // Read status first: a turn that ended just before the press refuses
        // the abort, and that is not a failure worth a message.
        const phase = error instanceof NotAdmitted ? "rejected" : "uncertain";
        setBusy(false);
        await refresh();
        settle(phase);
        return;
      }
    } finally {
      if (alive.current) {
        setBusy(false);
        setConfirmStop(false);
      }
    }
    if (alive.current) void refresh();
  };
  const clearStopAttempt = () => setStopAttempt(undefined);
  const sendFailed = inEitherLanguage(receipt, (l) => [
    conversationActionsText[l].sendError,
  ]);
  const notices = (
    <>
      {receipt &&
      sendObservation?.state !== "uncertain" &&
      !quietReceipt(receipt) ? (
        <InlineNotice
          data-testid="send-receipt"
          title={receipt}
          tone="warning"
        />
      ) : null}
      {problem &&
      (!serverUnavailable ||
        !inEitherLanguage(problem, (l) => [
          useConversationText[l].disconnected,
        ])) ? (
        <InlineNotice
          data-testid="conversation-problem"
          title={problem}
          tone="danger"
        />
      ) : null}
    </>
  );
  return {
    start,
    submit,
    submitQueue,
    clearNativeQueue,
    stopNow,
    stopAttempt,
    clearStopAttempt,
    restoredQueue,
    notices,
    // One warning, drawn with its check by the view, says that a send's
    // outcome is unknown; `failed` when this tab's own request just failed.
    sendUncertain:
      ambiguous && sendObservation?.state === "uncertain"
        ? sendFailed
          ? ("failed" as const)
          : ("unknown" as const)
        : undefined,
  };
}
