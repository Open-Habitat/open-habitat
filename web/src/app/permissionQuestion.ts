import { useEffect, useState } from "react";
import type {
  Permission,
  PermissionDecision,
} from "../components/PermissionQuestion";
import { NotAdmitted, respondQuestion, type Status } from "./conversations";

type Line = {
  requestId: string;
  action: string;
  decision?: PermissionDecision;
};

/** The permission question of one conversation: the open question (shown in
 * the composer's place until answered), the stream's lines, which turn from
 * waiting into the person's decision, and a notice when an answer's delivery
 * is in doubt or was refused.
 *
 * The answer is marked in session storage before it is sent, under the key
 * PiQuestion uses, so a reload never sends it twice and still shows the
 * decision while Pi has not yet moved on. Decision lines live while the turn
 * runs; Pi's history keeps the call itself (done, or blocked with the reason
 * the agent read) as the lasting record. */
export function usePermissionQuestion({
  question,
  agentId,
  identity,
  csrf,
  runActive,
  refresh,
  onLogin,
}: {
  question: Status["pending_question"] | undefined;
  agentId: string | undefined;
  identity: string;
  csrf?: string;
  runActive: boolean | undefined;
  refresh: () => Promise<void>;
  onLogin: () => void;
}) {
  const [decided, setDecided] = useState<{ agent?: string; lines: Line[] }>({
    lines: [],
  });
  // The last failed answer, by its request: a notice belongs to that
  // question only, never to the next one.
  const [failure, setFailure] = useState<{
    agent: string;
    requestId: string;
    outcome: "uncertain" | "stale";
  }>();
  const lines = decided.agent === agentId ? decided.lines : [];
  const permission: Permission | undefined =
    question?.question_kind === "permission" ? question.permission : undefined;
  const requestId = permission ? question?.request_id : undefined;
  const key = (request: string) =>
    `nah:${identity}:question:${agentId}:${request}`;
  const marked = requestId
    ? (sessionStorage.getItem(key(requestId)) ?? undefined)
    : undefined;
  // The turn ended: the decisions are in Pi's history as the calls' results.
  useEffect(() => {
    if (runActive === false && !requestId)
      setDecided((d) => (d.lines.length ? { lines: [] } : d));
  }, [runActive, requestId]);
  const shown: Line[] = [...lines];
  if (requestId && permission && !lines.some((l) => l.requestId === requestId))
    shown.push({
      requestId,
      action: permission.action,
      decision: marked === "allow" || marked === "deny" ? marked : undefined,
    });
  const open = permission && requestId && !marked ? permission : undefined;
  const failed =
    failure && failure.agent === agentId && failure.requestId === requestId
      ? failure.outcome
      : undefined;
  // Answered in an earlier page load and Pi still asks: whether that answer
  // arrived is not known here, and it is never sent again.
  // A refused answer reopens a question Pi still asks; answering it again
  // needs no warning.
  const notice =
    (failed === "stale" && open ? undefined : failed) ??
    (requestId && marked && !lines.some((l) => l.requestId === requestId)
      ? "uncertain"
      : undefined);
  const answer = async (decision: PermissionDecision) => {
    if (!open || !requestId || !agentId || !csrf) return;
    sessionStorage.setItem(key(requestId), decision);
    const line = { requestId, action: open.action, decision };
    setDecided((d) => ({
      agent: agentId,
      lines: [...(d.agent === agentId ? d.lines : []), line],
    }));
    try {
      await respondQuestion(
        agentId,
        requestId,
        "answer",
        csrf,
        decision === "allow",
      );
    } catch (error) {
      if ((error as Error).message === "identity_lost") onLogin();
      const stale = error instanceof NotAdmitted;
      // Refused before the daemon spent the request, so nothing reached Pi:
      // no decision, and while Pi still asks, the question is open again.
      if (stale) {
        sessionStorage.removeItem(key(requestId));
        setDecided((d) => ({
          ...d,
          lines: d.lines.filter((l) => l.requestId !== requestId),
        }));
      }
      setFailure({
        agent: agentId,
        requestId,
        outcome: stale ? "stale" : "uncertain",
      });
    } finally {
      void refresh(); // the next question, if Pi asks one
    }
  };
  return { open, requestId, lines: shown, notice, answer };
}
