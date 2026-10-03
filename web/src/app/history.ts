import Ajv from "ajv/dist/2020.js";
import common from "../../../contracts/v1/common.schema.json";
import historySchema from "../../../contracts/v1/history.schema.json";

const ajv = new Ajv({ strict: false });
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
  type: "text" | "thinking" | "image" | "toolCall" | "unknown";
  text?: string;
  redacted?: boolean;
  mime_type?: string;
  tool_call_id?: string;
  tool_name?: string;
  readable?: boolean;
}
export interface HistoryEntry {
  entry_key: string;
  kind: "user" | "assistant" | "tool" | "model_change" | "unknown" | "bash";
  content: HistoryContent;
  blocks?: HistoryBlock[];
  tool_call_id?: string;
  is_error?: boolean;
  stop_reason?: string;
  model?: string;
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
    | "branch_summary";
  truncated_blocks?: boolean;
  native_revision?: string;
}
export interface HistoryPage {
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
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("history unavailable");
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
  if (!validate?.(value)) throw new Error("invalid history");
  return value as HistoryPage | BlockChunk;
}
