import type { Dispatch, RefObject, SetStateAction } from "react";
import type { NavigateFunction } from "react-router";
import { InlineNotice } from "../components";
import {
  abortTurn,
  ContinuationRefused,
  type ContinueRefusal,
  clearQueue,
  continueConversation,
  create,
  NotAdmitted,
  queueMessage,
  type Session,
  type Status,
  send,
} from "./conversations";
import type { Workspace } from "./snapshot";

type Observation = {
  text: string;
  state: "pending" | "accepted" | "rejected" | "uncertain";
};
// Write outcomes stay distinct: an unacknowledged send must not be retried automatically.
export function useConversationActions({
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
  controlled,
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
}: {
  workspace: Workspace;
  id?: string;
  csrf?: string;
  ambiguous: string | null;
  busy: boolean;
  current?: Status;
  continuation?: "pending" | "uncertain" | ContinueRefusal;
  draft: string;
  receipt: string;
  sendObservation?: Observation;
  problem: string;
  controlled: boolean;
  alive: RefObject<boolean>;
  generation: RefObject<number>;
  submittedKey: string;
  sendKey: string;
  continuationKey: string;
  uncertainKey: string;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setReceipt: Dispatch<SetStateAction<string>>;
  setSendObservation: Dispatch<SetStateAction<Observation | undefined>>;
  setContinuation: Dispatch<
    SetStateAction<"pending" | "uncertain" | ContinueRefusal | undefined>
  >;
  setConfirmStop: Dispatch<SetStateAction<boolean>>;
  changeDraft: (value: string) => void;
  refresh: (proof?: boolean, history?: boolean) => Promise<void>;
  onLogin: () => void;
  onSessionCreated: (session: Session) => void;
  navigate: NavigateFunction;
}) {
  const start = async () => {
    if (busy || !csrf || ambiguous) return;
    setBusy(true);

    try {
      const token = csrf;
      if (!alive.current) return;
      sessionStorage.setItem(uncertainKey, "create");
      setReceipt("Luodaan · tulos odottaa");
      const result = await create(workspace.workspace_id, token);
      if (!alive.current) return;
      sessionStorage.removeItem(uncertainKey);
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
      if (alive.current && error instanceof NotAdmitted) {
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
  return {
    start,
    continueEnded,
    submit,
    submitQueue,
    clearNativeQueue,
    stopNow,
    notices,
  };
}
