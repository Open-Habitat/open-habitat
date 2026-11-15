import common from "../../../contracts/v1/common.schema.json";
import searchSchema from "../../../contracts/v1/search.schema.json";
import { LazyAjv } from "./lazyAjv";

const ajv = new LazyAjv({ strict: false, addFormats: true });
ajv.addSchema(common);
ajv.addSchema(searchSchema);
const validate = ajv.getSchema(searchSchema.$id);

/** contracts/v1/search.schema.json */
export interface SearchHit {
  entry_key: string;
  role: "user" | "assistant";
  at: string;
  snippet: string;
}
export interface SearchConversation {
  agent_id: string;
  hit_count: number;
  /** The best hit first, then the rest newest first. */
  hits: SearchHit[];
}
export interface SearchReply {
  schema_version: 1;
  terms: string[];
  index: { state: "building" | "ready"; indexed: number; total: number };
  conversations: SearchConversation[];
}

const cap = 1024 * 1024;

/** The person's daemon's search across their conversations' messages
 * (ADR 0036). Fails with generic messages: reply text never reaches the UI. */
export async function searchConversations(
  q: string,
  signal: AbortSignal,
): Promise<SearchReply> {
  const response = await fetch(`/api/v1/search?${new URLSearchParams({ q })}`, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (response.status === 401) throw new Error("identity_lost");
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("search unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("search unavailable");
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > cap) {
        await reader.cancel();
        throw new Error("oversize search");
      }
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
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("invalid search");
  }
  if (!validate(value)) throw new Error("invalid search");
  return value as SearchReply;
}
