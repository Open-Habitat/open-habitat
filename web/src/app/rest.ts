import { useCallback, useEffect, useRef, useState } from "react";
import common from "../../../contracts/v1/common.schema.json";
import editorSchema from "../../../contracts/v1/editor.schema.json";
import fileOfferSchema from "../../../contracts/v1/file-offer.schema.json";
import historySchema from "../../../contracts/v1/history.schema.json";
import noticeSchema from "../../../contracts/v1/notice.schema.json";
import processEventSchema from "../../../contracts/v1/process-event.schema.json";
import schema from "../../../contracts/v1/rest.schema.json";
import viewSchema from "../../../contracts/v1/view.schema.json";
import type {
  RestartNotice,
  RestStop,
  WakeState,
} from "../components/RestartNotice";
import { ContinuationRefused, continueConversation } from "./conversations";
import { LazyAjv } from "./lazyAjv";
import { refusalReason } from "./mutations";

// Refusals a send would meet again: the card says why instead of promising
// that the message starts Pi.
const lasting = new Set([
  "history_damaged",
  "quota_full",
  "storage_full",
  "writer_conflict",
  "capacity_exceeded",
]);

export interface RestReport {
  schema_version: 1;
  agent_id: string;
  availability: "available" | "partial" | "unavailable";
  report: RestartNotice;
}

const ajv = new LazyAjv({ strict: false, addFormats: true });
for (const s of [
  processEventSchema,
  noticeSchema,
  viewSchema,
  fileOfferSchema,
  editorSchema,
  common,
  historySchema,
])
  ajv.addSchema(s);
const validate = ajv.compile(schema);

/** GET .../rest: Habitat's report of a resting conversation. Reading it
 * starts nothing. */
export async function readRest(
  id: string,
  signal: AbortSignal,
): Promise<RestReport> {
  if (!/^pi:[0-9a-fA-F-]{36}$/.test(id)) throw new Error("invalid agent");
  const response = await fetch(`/api/v1/conversations/${id.slice(3)}/rest`, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (response.status === 401) throw new Error("identity_lost");
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("rest_unavailable");
  const text = await response.text();
  if (text.length > 1024 * 1024) throw new Error("rest_unavailable");
  const value: unknown = JSON.parse(text);
  if (!validate(value)) throw new Error("rest_unavailable");
  const report = value as unknown as RestReport;
  if (report.agent_id !== id) throw new Error("rest_unavailable");
  return report;
}

/** Whether a rest has anything to tell: work cut off when Pi stopped,
 * something that settled meanwhile, or a Taskfleet that could not be read
 * (unread is not empty). Otherwise the card is noise and is not shown, and the
 * agent's companion tells it nothing either (Jari, 2026-10-28). */
export function restHasNews(report: RestReport): boolean {
  const r = report.report;
  return (
    report.availability !== "available" ||
    r.processes.length > 0 ||
    r.runs.length > 0 ||
    !!r.interrupted_turn
  );
}

/**
 * A resting conversation's card and its wake (Kortti, Jari 2026-10-27). The
 * snapshot says whether the conversation rests; the report is read when it
 * does, and again when its rest or its working runs change, so work that
 * settles while the person looks updates the card without waking anyone.
 * Typing wakes Pi once per rest: no countdown, no wake on opening.
 */
export function useRest({
  id,
  workspaceId,
  rest,
  spinoffsWorking,
  csrf,
}: {
  id?: string;
  workspaceId: string;
  rest?: RestStop;
  spinoffsWorking?: number;
  csrf?: string;
}): {
  resting: boolean;
  /** The card is shown: the report has news, or it could not be read. */
  shown: boolean;
  /** The latest read failed; the report is as last read. */
  failed: boolean;
  report?: RestReport;
  wake: WakeState;
  /** Why the wake was refused, when a send would be refused too. */
  refusal?: string;
  onTyping: () => void;
  onSend: () => void;
} {
  const restKey = id && rest ? `${id}:${rest.cause}:${rest.at}` : "";
  const [report, setReport] = useState<{ key: string; value: RestReport }>();
  const [failed, setFailed] = useState("");
  const [attempt, setAttempt] = useState<{
    key: string;
    state: "waking" | "refused";
    reason?: string;
  }>();
  const tried = useRef(new Set<string>());
  useEffect(() => {
    if (!id || !restKey) return;
    void spinoffsWorking; // a run settling is news for the card
    const controller = new AbortController();
    readRest(id, controller.signal).then(
      (value) => {
        setReport({ key: restKey, value });
        setFailed("");
      },
      () => {
        // Nothing proves the rest quiet: the card says why Pi rests, with
        // the report as last read.
        if (!controller.signal.aborted) setFailed(restKey);
      },
    );
    return () => controller.abort();
  }, [id, restKey, spinoffsWorking]);
  const onTyping = useCallback(() => {
    if (!id || !csrf || !restKey || rest?.awake) return;
    if (tried.current.has(restKey)) return;
    tried.current.add(restKey);
    setAttempt({ key: restKey, state: "waking" });
    continueConversation(id, workspaceId, csrf).catch((error: unknown) => {
      // A refused or uncertain wake is never repeated: the send starts Pi.
      setAttempt({
        key: restKey,
        state: "refused",
        reason:
          error instanceof ContinuationRefused && lasting.has(error.code)
            ? refusalReason(error.code)
            : undefined,
      });
    });
  }, [id, csrf, restKey, rest?.awake, workspaceId]);
  // The message ends the rest; the catch-up it carries takes the card's
  // place in history.
  const [sent, setSent] = useState("");
  const onSend = useCallback(() => {
    if (restKey) setSent(restKey);
  }, [restKey]);
  const own = attempt?.key === restKey ? attempt.state : undefined;
  const refusal =
    !rest?.awake && attempt?.key === restKey ? attempt.reason : undefined;
  const current = report?.key === restKey ? report.value : undefined;
  return {
    resting: !!restKey && sent !== restKey,
    shown: failed === restKey || (!!current && restHasNews(current)),
    failed: failed === restKey,
    report: current,
    wake: rest?.awake ? "awake" : (own ?? "asleep"),
    refusal,
    onTyping,
    onSend,
  };
}
