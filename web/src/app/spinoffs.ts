import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import common from "../../../contracts/v1/common.schema.json";
import editorSchema from "../../../contracts/v1/editor.schema.json";
import historySchema from "../../../contracts/v1/history.schema.json";
import noticeSchema from "../../../contracts/v1/notice.schema.json";
import processEventSchema from "../../../contracts/v1/process-event.schema.json";
import schema from "../../../contracts/v1/spinoffs.schema.json";
import viewSchema from "../../../contracts/v1/view.schema.json";
import type { HistoryEntry } from "./history";
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
    | "waiting_parent"
    | "merged"
    | "unmerged"
    | "failed"
    | "unknown";
  summary: string;
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
const ajv = addFormats(new Ajv({ strict: false }));
for (const s of [
  processEventSchema,
  noticeSchema,
  viewSchema,
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
export function spinoffStateLabel(run: Spinoff) {
  return {
    working: "Työskentelee",
    waiting_parent: "Odottaa pääagenttia",
    merged: "Mergetty",
    unmerged: run.preserved ? "Ei mergetty · työ tallessa" : "Ei mergetty",
    failed: run.preserved ? "Epäonnistui · työ tallessa" : "Epäonnistui",
    unknown: "Tila ei tiedossa",
  }[run.state];
}
