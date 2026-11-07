import common from "../../../contracts/v1/common.schema.json";
import editorSchema from "../../../contracts/v1/editor.schema.json";
import fileOfferSchema from "../../../contracts/v1/file-offer.schema.json";
import historySchema from "../../../contracts/v1/history.schema.json";
import noticeSchema from "../../../contracts/v1/notice.schema.json";
import processEventSchema from "../../../contracts/v1/process-event.schema.json";
import rewindSchema from "../../../contracts/v1/rewind.schema.json";
import viewSchema from "../../../contracts/v1/view.schema.json";
import type { HistoryEntry } from "./history";
import { LazyAjv } from "./lazyAjv";
import { jsonWrite, writeOutcome } from "./mutations";

// Palaa tähän (experimental). The daemon's own Pi extension does the work and
// records it in the native session; these are the browser's reads and its
// one write (contracts/v1/rewind.schema.json).

const ajv = new LazyAjv({ strict: false, addFormats: true });
for (const schema of [
  processEventSchema,
  common,
  noticeSchema,
  viewSchema,
  fileOfferSchema,
  editorSchema,
  historySchema,
  rewindSchema,
])
  ajv.addSchema(schema);
const validPreview = ajv.compile<RewindPreview>({
  $ref: `${rewindSchema.$id}#/$defs/preview`,
});
const validBranch = ajv.compile<RewindBranch>({
  $ref: `${rewindSchema.$id}#/$defs/branch`,
});
const validResult = ajv.compile<RewindResult>({
  $ref: `${rewindSchema.$id}#/$defs/result`,
});

export type RewindFile = {
  path: string;
  change: "modified" | "created" | "deleted";
  additions?: number;
  deletions?: number;
  /** A commit after the message changed it; the restore leaves the commit. */
  committed?: true;
};
export type RewindPreview = {
  schema_version: 1;
  agent_id: string;
  entry_key: string;
  own: number;
  replies: number;
  checkpoint: boolean;
  files: RewindFile[];
  files_more: number;
  file_errors: number;
  commands: string[];
  commands_more: number;
};
export type RewindBranch = {
  schema_version: 1;
  agent_id: string;
  marker_key: string;
  entries: HistoryEntry[];
  complete: boolean;
};
export type RewindResult = {
  schema_version: 1;
  agent_id: string;
  action: "rewind" | "switch" | "undo";
  state: "done";
  restored: number;
  file_errors: number;
};
export type RewindRequest =
  | {
      action: "rewind";
      entry_key: string;
      conversation: boolean;
      files: boolean;
      stop?: boolean;
    }
  | { action: "switch"; marker_key: string; files: boolean; stop?: boolean }
  | { action: "undo"; marker_key: string; stop?: boolean };

const agent = /^pi:[0-9a-fA-F-]{36}$/;
const key = /^[A-Za-z0-9_-]{1,128}$/;
function url(id: string, query?: string) {
  if (!agent.test(id)) throw new Error("invalid agent");
  return `/api/v1/conversations/${id.slice(3)}/rewind${query ? `?${query}` : ""}`;
}

async function read(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (response.status === 401) throw new Error("identity_lost");
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("unavailable");
  const text = await response.text();
  if (text.length > 2 * 1024 * 1024) throw new Error("oversize");
  return JSON.parse(text);
}

/** What going back before one of the person's messages leaves behind. */
export async function readRewindPreview(
  id: string,
  entry: string,
  signal?: AbortSignal,
): Promise<RewindPreview> {
  if (!key.test(entry)) throw new Error("invalid entry");
  const value = await read(
    url(id, `entry=${encodeURIComponent(entry)}`),
    signal,
  );
  if (
    !validPreview(value) ||
    value.agent_id !== id ||
    value.entry_key !== entry
  )
    throw new Error("invalid preview");
  return value;
}

/** The continuation a marker replaced, oldest first. */
export async function readRewindBranch(
  id: string,
  marker: string,
  signal?: AbortSignal,
): Promise<RewindBranch> {
  if (!key.test(marker)) throw new Error("invalid marker");
  const value = await read(
    url(id, `branch=${encodeURIComponent(marker)}`),
    signal,
  );
  if (
    !validBranch(value) ||
    value.agent_id !== id ||
    value.marker_key !== marker
  )
    throw new Error("invalid branch");
  return value;
}

/** Why the host did nothing; `uncertain` means it may have done it. */
export type RewindRefusal =
  | "turn_running"
  | "queued"
  | "busy"
  | "no_checkpoint"
  | "not_switchable"
  | "already_undone"
  | "cancelled"
  | "not_found"
  | "unavailable"
  // Pi is not running in this conversation: wake it, then ask once more.
  | "stopped";
export class RewindFailed extends Error {
  constructor(readonly reason: RewindRefusal | "uncertain" | "login") {
    super(`rewind ${reason}`);
  }
}
const refusals = new Set<string>([
  "turn_running",
  "queued",
  "busy",
  "no_checkpoint",
  "not_switchable",
  "already_undone",
  "cancelled",
]);

/** The one write. A lost answer is uncertain and never sent again. */
export async function sendRewind(
  id: string,
  body: RewindRequest,
  csrf: string,
): Promise<RewindResult> {
  let response: Response | undefined;
  try {
    response = await jsonWrite("conversation.rewind", url(id), body, csrf);
  } catch {
    response = undefined;
  }
  const outcome = await writeOutcome(response);
  if (outcome.kind === "login") throw new RewindFailed("login");
  if (outcome.kind === "refused")
    throw new RewindFailed(
      refusals.has(outcome.code)
        ? (outcome.code as RewindRefusal)
        : outcome.code === "resource_not_found"
          ? "stopped"
          : outcome.status === 404
            ? "not_found"
            : "unavailable",
    );
  if (outcome.kind !== "ok") throw new RewindFailed("uncertain");
  let value: unknown;
  try {
    value = await outcome.response.json();
  } catch {
    throw new RewindFailed("uncertain");
  }
  if (!validResult(value) || value.agent_id !== id)
    throw new RewindFailed("uncertain");
  return value;
}
