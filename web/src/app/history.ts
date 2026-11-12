import common from "../../../contracts/v1/common.schema.json";
import editorSchema from "../../../contracts/v1/editor.schema.json";
import fileOfferSchema from "../../../contracts/v1/file-offer.schema.json";
import historySchema from "../../../contracts/v1/history.schema.json";
import noticeSchema from "../../../contracts/v1/notice.schema.json";
import processEventSchema from "../../../contracts/v1/process-event.schema.json";
import viewSchema from "../../../contracts/v1/view.schema.json";
import type { AgentNotice } from "../components/AgentNotice";
import type { RestartNotice } from "../components/RestartNotice";
import type { WaitReminder } from "../components/WaitReminder";
import type { AIProvider } from "./aiSignIn";
import type { BashFailure } from "./bashFailure";
import { LazyAjv } from "./lazyAjv";

const ajv = new LazyAjv({ strict: false, addFormats: true });
ajv.addSchema(processEventSchema);
ajv.addSchema(noticeSchema);
ajv.addSchema(viewSchema);
ajv.addSchema(fileOfferSchema);
ajv.addSchema(editorSchema);
ajv.addSchema(common);
ajv.addSchema(historySchema);
const validate = ajv.getSchema(historySchema.$id);
export interface HistoryContent {
  media_type: "text/plain" | "text/markdown" | "text/x-diff";
  text: string;
  complete: boolean;
  truncated?: boolean;
}
export interface HistoryBlock {
  type:
    | "text"
    | "thinking"
    | "image"
    | "toolCall"
    | "unknown"
    | "process_event";
  process_event?: import("./processes").ProcessEvent;
  text?: string;
  redacted?: boolean;
  mime_type?: string;
  /** An image's decoded size. */
  bytes?: number;
  tool_call_id?: string;
  tool_name?: string;
  readable?: boolean;
}
export interface HistoryEntry {
  skill?: { name: string; description?: string };
  notice?: AgentNotice;
  restart?: RestartNotice;
  wait_reminder?: WaitReminder;
  entry_key: string;
  timestamp?: string;
  kind:
    | "user"
    | "assistant"
    | "tool"
    | "model_change"
    | "unknown"
    | "bash"
    | "recap"
    | "rewind";
  recap?: {
    recap: string;
    next: string;
    through: string;
    generated_at: number;
  };
  /** Palaa tähän's record (contracts/v1/history.schema.json#/$defs/rewind). */
  rewind?: import("../components/Rewind").RewindRowMarker & {
    at?: string;
    of?: string;
  };
  content: HistoryContent;
  blocks?: HistoryBlock[];
  tool_call_id?: string;
  is_error?: boolean;
  failure_cause?: BashFailure;
  stop_reason?: string;
  /** On a failed reply: the AI provider that refused the sign-in. */
  refused_by?: AIProvider;
  model?: string;
  /** Context size Pi recorded with this assistant reply. */
  context_tokens?: number;
  exit_code?: number;
  cancelled?: boolean;
  output_truncated?: boolean;
  exclude_from_context?: boolean;
  entry_type?:
    | "model_change"
    | "thinking_level_change"
    | "session_info"
    | "label"
    | "compaction"
    | "branch_summary"
    | "context_edit";
  truncated_blocks?: boolean;
  native_revision?: string;
}
export interface HistoryPage {
  cut_off?: boolean;
  schema_version: 1;
  agent_id: string;
  native_revision: string;
  entries: HistoryEntry[];
  complete?: boolean;
  next_after?: string;
  older_complete?: boolean;
  boundary_found?: boolean;
  next_before?: string;
}
export interface BlockChunk {
  part?: "skill_arguments";
  schema_version: 1;
  agent_id: string;
  native_revision: string;
  entry_key: string;
  block_index: number;
  offset: number;
  chunk: {
    media_type: string;
    text?: string;
    data?: string;
    complete: boolean;
    next_offset?: number;
  };
}
export async function readHistory(
  response: Response,
): Promise<HistoryPage | BlockChunk> {
  if (response.status === 401) throw new Error("identity_lost");
  const json =
    response.headers.get("content-type")?.split(";")[0] === "application/json";
  if (!response.ok) {
    // The one refusal a person can act on: a full storage quota cut a
    // record of the history. Every other refusal reads as unavailable.
    const code = json
      ? await response
          .json()
          .then((v: { error?: { code?: unknown } }) => v?.error?.code)
          .catch(() => undefined)
      : undefined;
    throw new Error(
      code === "native_history_cut" ? "history_cut" : "history unavailable",
    );
  }
  if (!json) throw new Error("history unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("missing history body");
  let size = 0;
  const parts: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) throw new Error("oversize history");
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  const value: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  );
  if (!validate(value)) throw new Error("invalid history");
  return value as HistoryPage | BlockChunk;
}

/** A native block's whole text, read in bounded chunks of one revision. */
export async function fullTextBlock(
  agentId: string,
  revision: string,
  entryKey: string,
  index: number,
  signal: AbortSignal,
): Promise<string> {
  let offset = 0,
    text = "";
  for (;;) {
    const url = `/api/v1/agents/${agentId}/entries/${entryKey}/blocks/${index}?${new URLSearchParams({ revision, offset: String(offset), limit_bytes: "65536" })}`;
    const value = await readHistory(
      await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
        signal,
      }),
    );
    if (
      !("chunk" in value) ||
      value.agent_id !== agentId ||
      value.native_revision !== revision ||
      value.entry_key !== entryKey ||
      value.block_index !== index ||
      value.offset !== offset ||
      value.chunk.media_type !== "text/plain"
    )
      throw new Error("invalid block");
    text += value.chunk.text ?? "";
    if (text.length > 64 * 1024 * 1024) throw new Error("oversize block");
    if (value.chunk.complete) return text;
    if (
      value.chunk.next_offset === undefined ||
      value.chunk.next_offset <= offset
    )
      throw new Error("invalid block");
    offset = value.chunk.next_offset;
  }
}
