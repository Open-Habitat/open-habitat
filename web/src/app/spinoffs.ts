import common from "../../../contracts/v1/common.schema.json";
import editorSchema from "../../../contracts/v1/editor.schema.json";
import fileOfferSchema from "../../../contracts/v1/file-offer.schema.json";
import historySchema from "../../../contracts/v1/history.schema.json";
import noticeSchema from "../../../contracts/v1/notice.schema.json";
import processEventSchema from "../../../contracts/v1/process-event.schema.json";
import schema from "../../../contracts/v1/spinoffs.schema.json";
import viewSchema from "../../../contracts/v1/view.schema.json";
import { liveText } from "../i18n";
import { spinoffStateText } from "../text/spinoffState";
import type { HistoryEntry } from "./history";
import { LazyAjv } from "./lazyAjv";

const txt = liveText(spinoffStateText);
export type WorkerHarness = "pi" | "claude" | "unknown";
export interface Spinoff {
  harness?: WorkerHarness;
  /** Taskfleet's selection profile. */
  profile?: string;
  /** The worker's repository, only when the parent does not run in it. */
  other_repository?: string;
  /** When an ended run ended (its manifest's last write). */
  ended_at?: string;
  /** Waiting for input at the worker's own terminal prompt. */
  awaiting_input?: boolean;
  /** The live worker's Taskfleet window (browser shell token). */
  terminal?: string;
  /** The workspace whose terminal route lists that window. */
  terminal_workspace?: string;
  /** The ID the workspace Git route reads the worker's worktree under;
   * only for the selected run while its worktree is registered. */
  git_workspace?: string;
  /** The task Taskfleet gave the worker; only for the selected run. */
  brief?: string;
  preserved: boolean;
  branch: string;
  worktree: string;
  source_branch: string;
  run_id: string;
  title: string;
  created_at: string;
  state:
    | "working"
    | "idle"
    | "waiting_parent"
    | "merged"
    | "unmerged"
    | "failed"
    | "unknown";
  summary: string;
  /** A named support worker (Taskfleet resident run): its rounds. */
  resident?: Resident;
}
/** Taskfleet's round state of a named worker (avustaja). */
export interface Resident {
  name: string;
  round_state: "working" | "waiting" | "dormant";
  /** Rounds it has reported. */
  rounds: number;
  /** Its latest round report, in its own words. */
  report?: string;
  reported_at?: string;
  /** The latest round landed into the source branch. */
  landed_round?: number;
  /** Idle expiry kept work not yet landed on its branch. */
  unlanded?: boolean;
}
/** A named worker that still works in rounds: its run is live. */
export function liveHelper(run: Spinoff) {
  return (
    !!run.resident &&
    ["working", "idle", "waiting_parent", "unknown"].includes(run.state)
  );
}
export interface Spinoffs {
  schema_version: 1;
  parent_id: string;
  availability: "available" | "unavailable" | "partial";
  runs: Spinoff[];
  transcripts: WorkerTranscript[];
}
export interface WorkerTranscript {
  node_id: string;
  harness: WorkerHarness;
  availability: "available" | "unavailable" | "unsupported";
  truncated: boolean;
  entries: HistoryEntry[];
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
export function parseSpinoffs(value: unknown): Spinoffs {
  if (!validate(value)) throw new Error("spinoffs_unavailable");
  return value as unknown as Spinoffs;
}
export async function readSpinoffs(
  parent: string,
  run: string | null,
  signal: AbortSignal,
): Promise<Spinoffs> {
  const response = await fetch(
    `/api/v1/agents/${parent}/spinoffs${run ? `?run=${encodeURIComponent(run)}` : ""}`,
    { signal },
  );
  if (response.status === 401) throw new Error("identity_lost");
  // No readable native session (yet): a new conversation before its first turn.
  if (response.status === 404) throw new Error("parent_missing");
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("spinoffs_unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("spinoffs_unavailable");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      // A selected run carries the worker's conversation.
      if (size > 4 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("spinoffs_unavailable");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.length;
  }
  const result = parseSpinoffs(
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
  );
  if (
    result.parent_id !== parent ||
    (run &&
      !result.runs.some((r) => r.run_id === run) &&
      result.availability === "available")
  )
    throw new Error("spinoffs_unavailable");
  return result;
}
/** Taskfleet opens every worker's prompt with its own run context (run id,
 * issue filing, closing) and ends it with this line before the task the
 * main agent wrote. */
const runContextEnd =
  /\n---[ \t]*\n\s*The original task brief follows\.[ \t]*\n/;

/** The main agent's task, and Taskfleet's run context before it if any. */
export function splitBrief(text: string): { task: string; context?: string } {
  if (!text.startsWith("# Taskfleet run context")) return { task: text };
  const end = runContextEnd.exec(text);
  const task = end ? text.slice(end.index + end[0].length).trim() : "";
  if (!end || !task) return { task: text };
  return { task, context: text.slice(0, end.index).trim() };
}
export function spinoffStateLabel(run: Spinoff) {
  const r = run.resident;
  if (r && liveHelper(run) && run.state !== "unknown")
    return r.round_state === "working"
      ? txt.roundWorking(r.rounds + 1)
      : r.round_state === "dormant"
        ? txt.roundDormant(r.rounds)
        : txt.roundWaiting(r.rounds);
  return {
    working: txt.working,
    idle: run.awaiting_input ? txt.awaitingInput : txt.idle,
    waiting_parent: txt.waiting_parent,
    merged: txt.merged,
    unmerged: run.preserved ? txt.unmergedKept : txt.unmerged,
    failed: run.preserved ? txt.failedKept : txt.failed,
    unknown: txt.unknown,
  }[run.state];
}
