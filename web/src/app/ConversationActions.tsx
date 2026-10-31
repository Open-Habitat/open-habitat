import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
  useState,
} from "react";
import type { NavigateFunction } from "react-router";
import { InlineNotice } from "../components";
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
  type SendObservationValue as Observation,
  type OwnSend,
  type QueuedSend,
  userKeys,
} from "./sentMessages";
import type { Workspace } from "./snapshot";

/** Why the host refused a message and what the person can do. A refusal
 * means nothing was written: the text is back in the field. (A message the
 * host already took and is sent again is not refused; the daemon answers
 * it as the same message.) */
function messageRefusal(code: string, kind: "send" | "queue") {
  if (code === "read_only_history")
    return "Viestiä ei lähetetty, koska tätä keskustelua voi nyt vain lukea. Teksti on kentässä: jatka keskustelua tai aloita uusi.";
  return kind === "send"
    ? "Viestiä ei lähetetty, koska keskustelun tila muuttui, esimerkiksi agentti ehti aloittaa työn. Teksti on kentässä: lähetä se uudelleen. Jos agentti työskentelee, viesti menee ohjauksena tai jonoon."
    : "Viestiä ei lähetetty, koska agentin vuoro ehti päättyä tai keskustelun tila muuttui. Teksti on kentässä: lähetä se uudelleen.";
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
  inFlightSend,
  setBusy,
  setReceipt,
  setSendObservation,
  setConfirmStop,
  changeDraft,
  onSent,
  onQueued,
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
  inFlightSend: RefObject<string | undefined>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setReceipt: Dispatch<SetStateAction<string>>;
  setSendObservation: Dispatch<SetStateAction<Observation | undefined>>;
  setConfirmStop: Dispatch<SetStateAction<boolean>>;
  changeDraft: (value: string) => void;
  /** Draws a direct send as the person's message. */
  onSent: (message: OwnSend) => void;
  /** Draws a steering or follow-up message, or with `clear` drops them all. */
  onQueued: (message: QueuedSend | "clear") => void;
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
      setReceipt("Luodaan · tulos odottaa");
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
          if (alive.current)
            setReceipt(
              "Edellistä tyhjää keskustelua ei voitu sulkea. Sulje se erikseen listasta.",
            );
        }
      }
    } catch (error) {
      if ((error as Error).message === "identity_lost") onLogin();
      if (alive.current) {
        setReceipt(
          error instanceof WriteRefused
            ? `Uutta keskustelua ei luotu: ${refusalReason(error.code, error.status)}`
            : sessionStorage.getItem(uncertainKey)
              ? "Luonnin tulos epävarma. Päivitä tiedot ennen uutta yritystä; pyyntöä ei lähetetä automaattisesti uudelleen."
              : "Istuntoa ei voitu vahvistaa. Luontia ei lähetetty.",
        );
      }
    } finally {
      if (alive.current && !handedOff) setBusy(false);
    }
  };
  // The text leaves the field at once and is drawn where it is going; a
  // refused or unknown outcome gives it back (see sentMessages.ts). A message
  // not typed in the field (the editor's note) keeps the draft.
  const submit = async (text = draft, keepDraft = false) => {
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
      return;
    const command = crypto.randomUUID();
    setBusy(true);

    try {
      const token = csrf;
      if (!alive.current) return;
      sessionStorage.setItem(submittedKey, text);
      sessionStorage.setItem(sendKey, command);
      sessionStorage.setItem(uncertainKey, command);
      inFlightSend.current = command;
      setSendObservation({ text, state: "pending", command, kind: "send" });
      onSent({ command, text, before: userKeys(entries) });
      if (!keepDraft) changeDraft("");
      setReceipt("Viesti odottaa kuittausta");
      await send(current.agent_id, text, command, token, firstChoice);
      inFlightSend.current = undefined;
      if (!alive.current) return;
      setReceipt("Viesti odottaa natiivia hyväksyntää");
      await refresh();
    } catch (error) {
      if (inFlightSend.current === command) inFlightSend.current = undefined;
      if ((error as Error).message === "identity_lost") onLogin();
      else if (alive.current && error instanceof NotAdmitted) {
        sessionStorage.removeItem(sendKey);
        sessionStorage.removeItem(uncertainKey);
        setSendObservation({ text, state: "rejected", command });
        setReceipt(messageRefusal(error.code, "send"));
        void refresh();
      } else if (alive.current) {
        sessionStorage.setItem(uncertainKey, command);
        setSendObservation({ text, state: "uncertain", command });
        setReceipt(
          "Lähetysvirhe. Tarkistetaan alkuperäisen viestin kuittaus automaattisesti.",
        );
        void refresh();
      }
    } finally {
      if (alive.current) setBusy(false);
    }
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
      setReceipt("Viesti odottaa kuittausta");
      await queueMessage(current.agent_id, text, command, token, kind);
      if (alive.current) await refresh();
    } catch (error) {
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
        (error as Error).message !== "identity_lost"
      ) {
        sessionStorage.setItem(uncertainKey, command);
        setSendObservation({ text, state: "uncertain", command });
        setReceipt(
          "Lähetysvirhe. Tarkistetaan alkuperäisen viestin kuittaus automaattisesti.",
        );
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
        setReceipt(
          restored
            ? "Jonosta poistetut viestit palautettiin kirjoituskenttään."
            : "Jono oli jo tyhjä.",
        );
        void refresh();
      }
    } catch (error) {
      if ((error as Error).message === "identity_lost") onLogin();
      else if (alive.current)
        setReceipt(
          sent
            ? "Jonon tyhjennyksen tulos epävarma. Tarkista tila; viestejä ei palautettu ilman kuittausta."
            : "Istuntoa ei voitu vahvistaa.",
        );
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
  const stopNow = async () => {
    if (busy || !current || !csrf) return;
    const command = crypto.randomUUID();
    const id = current.agent_id;
    const settle = (phase: StopAttempt["phase"]) =>
      setStopAttempt((attempt) =>
        attempt?.command === command ? { ...attempt, phase } : attempt,
      );
    setStopAttempt({ id, command, phase: "pending" });
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
  const notices = (
    <>
      {receipt &&
      sendObservation?.state !== "uncertain" &&
      !/^(Viesti hyväksyttiin|Viesti odottaa|Varmistetaan istuntoa|Jono oli jo tyhjä)/.test(
        receipt,
      ) ? (
        <InlineNotice
          data-testid="send-receipt"
          title={receipt}
          tone="warning"
        />
      ) : null}
      {problem &&
      (!serverUnavailable ||
        problem !== "Yhteys katkesi. Näytetään viimeisin tunnettu tila.") ? (
        <InlineNotice
          data-testid="conversation-problem"
          title={problem}
          tone="danger"
        />
      ) : null}
      {ambiguous && sendObservation?.state === "uncertain" ? (
        <InlineNotice
          data-testid="send-error"
          title={
            receipt.startsWith("Lähetysvirhe")
              ? "Lähetysvirhe · tulos epävarma"
              : "Aiemman pyynnön tulos epävarma"
          }
          description={
            receipt.startsWith("Lähetysvirhe")
              ? "Alkuperäisen viestin kuittaus tarkistetaan yhteyden palattua. Viestiä ei lähetetä uudelleen."
              : "Alkuperäisen viestin kuittaus ei vahvista tulosta. Viestiä ei lähetetä uudelleen."
          }
          tone="warning"
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
  };
}
