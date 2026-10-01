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
  content_id?: string;
  next_offset?: number;
}
export interface HistoryEntry {
  entry_key: string;
  kind: "user" | "assistant" | "tool" | "model_change" | "unknown";
  content: HistoryContent;
}
export interface HistoryPage {
  schema_version: 1;
  agent_id: string;
  native_revision: string;
  entries: HistoryEntry[];
  complete: boolean;
  next_after?: string;
}
export interface ContentChunk {
  schema_version: 1;
  content_id: string;
  offset: number;
  content: HistoryContent;
}
export async function readHistory(
  response: Response,
): Promise<HistoryPage | ContentChunk> {
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
  return value as HistoryPage | ContentChunk;
}
