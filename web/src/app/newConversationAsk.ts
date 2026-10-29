import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { WorkerAsk } from "../components/BackgroundStrip";
import { create, send } from "./conversations";
import { refusalReason, WriteRefused } from "./mutations";
import type { Spinoff } from "./spinoffs";
import { requestText } from "./workerRequests";

/**
 * Kerro agentille when the browser cannot write to the conversation that
 * started the workers (a Pi run in a terminal, or one with another writer):
 * the request starts a new conversation in the same workspace and names the
 * parent. Nothing reads the new conversation from here, so the row says only
 * that the request went there. This tab remembers which conversation took
 * which run, so opening the worker's view and coming back keeps the link
 * instead of offering a second request.
 */
export function useNewConversationAsk({
  identity,
  parentId,
  workspaceId,
  parentTitle,
  csrf,
  onLogin,
}: {
  identity: string;
  parentId: string;
  workspaceId: string;
  parentTitle: string;
  csrf?: string;
  onLogin: () => void;
}): WorkerAsk | undefined {
  const navigate = useNavigate();
  const key = `nah:${identity}:worker-requests:${parentId}`;
  const [asked, setAsked] = useState<Record<string, string>>(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(key) ?? "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const inFlight = useRef(false);
  if (!csrf) return undefined;
  const ask = async (runs: Spinoff[]) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setProblem("");
    try {
      const session = await create(workspaceId, csrf);
      // Pi starts with the message held, as when the person writes first.
      await send(
        session.agent_id,
        requestText(runs, parentTitle),
        crypto.randomUUID(),
        csrf,
      );
      setAsked((old) => {
        const next = {
          ...old,
          ...Object.fromEntries(runs.map((r) => [r.run_id, session.agent_id])),
        };
        try {
          sessionStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* Kept for this view only. */
        }
        return next;
      });
    } catch (error) {
      if ((error as Error).message === "identity_lost") onLogin();
      setProblem(
        error instanceof WriteRefused
          ? `Pyyntöä ei lähetetty: ${refusalReason(error.code, error.status)}`
          : "Pyynnön tulos epävarma. Tarkista keskustelulista; pyyntöä ei lähetetä uudelleen automaattisesti.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return {
    target: "new",
    blocked: busy ? "Pyyntö on lähdössä." : undefined,
    phases: Object.fromEntries(Object.keys(asked).map((id) => [id, "sent"])),
    problem,
    send: (runs) => void ask(runs),
    open: (run) => {
      const id = asked[run.run_id];
      if (id) navigate(`/workspaces/${workspaceId}?conversation=${id}`);
    },
  };
}
