import { useEffect, useState } from "react";
import common from "../../../contracts/v1/common.schema.json";
import schema from "../../../contracts/v1/context-detail.schema.json";
import { LazyAjv } from "./lazyAjv";

type Part = { name: string; tokens: number; replaced?: boolean };
/** One file, command or tool target the agent used on the active path. */
export type ContextItem = {
  kind: "file" | "command" | "tool";
  name: string;
  tokens: number;
  in_context: boolean;
  kept_tokens?: number;
  ops: {
    verb: "read" | "wrote" | "edited" | "ran" | "used";
    at: string;
    added?: number;
    removed?: number;
  }[];
  ops_omitted: number;
};
/** Pi's reading of one session (contracts/v1/context-detail.schema.json). */
export interface ContextDetail {
  schema_version: 1;
  agent_id: string;
  harness: "pi" | "claude_code";
  model?: string;
  measured_tokens?: number;
  estimated_tokens: number;
  trailing_tokens: number;
  settings?: {
    enabled: boolean;
    reserve_tokens: number;
    keep_recent_tokens: number;
  };
  parts: {
    instructions: number;
    tools: number;
    summary: number;
    conversation: number;
    tool_output: number;
    attachments: number;
  };
  instructions: Part[];
  tools: Part[];
  conversation: {
    user: number;
    assistant: number;
    thinking: number;
    tool_calls: number;
    other: number;
  };
  largest_outputs: { name: string; turn: number; tokens: number }[];
  compactions: {
    at: string;
    after_turn: number;
    kept_from_turn: number;
    tokens_before: number;
    summary: string;
    summary_truncated: boolean;
    summary_tokens: number;
    read_files: string[];
    modified_files: string[];
    tokens_after?: number;
  }[];
  next_compaction: {
    from_turn: number;
    through_turn: number;
    kept_from_turn: number;
    split_turn: boolean;
    summarized_tokens: number;
    from_at?: string;
    through_at?: string;
    kept_from_at?: string;
    estimated_tokens_after: number;
  } | null;
  just_compacted: boolean;
  context_from_at?: string;
  items: ContextItem[];
  items_omitted: number;
  turns: {
    n: number;
    at: string;
    request: string;
    replies: number;
    context_tokens?: number;
    input: number;
    output: number;
    cache_read: number;
    cache_write: number;
    cost: number;
  }[];
  turns_omitted: number;
}

const ajv = new LazyAjv({ strict: false, addFormats: true });
ajv.addSchema(common);
const validate = ajv.compile(schema);

export function parseContextDetail(value: unknown, agent: string) {
  if (!validate(value)) throw new Error("context_unavailable");
  const detail = value as unknown as ContextDetail;
  if (detail.agent_id !== agent) throw new Error("context_unavailable");
  return detail;
}

export async function readContextDetail(agent: string, signal: AbortSignal) {
  const response = await fetch(`/api/v1/agents/${agent}/context`, { signal });
  if (response.status === 401) throw new Error("identity_lost");
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("context_unavailable");
  const text = await response.text();
  if (text.length > 2 * 1024 * 1024) throw new Error("context_unavailable");
  return parseContextDetail(JSON.parse(text), agent);
}

export type ContextDetailState =
  | { state: "loading"; detail?: ContextDetail }
  | { state: "ready"; detail: ContextDetail }
  | { state: "unavailable"; detail?: ContextDetail };

/**
 * The page's read while it is open. `revision` changes when the native
 * history does; each read runs Pi over the whole session, so a burst of
 * changes waits for a quiet moment. The live stream can show a reply before
 * Pi has written it to the session: while the reading's measurement differs
 * from `expected` (the ring's), it is read again a few times. A failed
 * reread keeps the last reading visible, marked as not current.
 */
export function useContextDetail(
  agent: string | undefined,
  open: boolean,
  revision: string,
  expected: number | undefined,
  onLogin?: () => void,
): ContextDetailState {
  const [value, setValue] = useState<ContextDetailState>({ state: "loading" });
  const [retry, setRetry] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision and retry trigger a reread.
  useEffect(() => {
    if (!agent || !open) {
      setValue({ state: "loading" });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        readContextDetail(agent, controller.signal).then(
          (detail) => {
            setValue({ state: "ready", detail });
            if (
              expected !== undefined &&
              detail.measured_tokens !== expected &&
              retry < 5
            )
              setRetry((n) => n + 1);
          },
          (error: unknown) => {
            if (controller.signal.aborted) return;
            if (error instanceof Error && error.message === "identity_lost")
              onLogin?.();
            setValue((previous) => ({
              state: "unavailable",
              detail: previous.detail,
            }));
          },
        );
      },
      value.detail ? 1500 : 0,
    );
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [agent, open, revision, retry, onLogin]);
  // A new revision or expectation earns its own retries.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on change only.
  useEffect(() => setRetry(0), [revision, expected]);
  return value;
}
