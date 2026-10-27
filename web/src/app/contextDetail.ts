import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { useEffect, useState } from "react";
import common from "../../../contracts/v1/common.schema.json";
import schema from "../../../contracts/v1/context-detail.schema.json";

type Part = { name: string; tokens: number; replaced?: boolean };
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
  } | null;
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

const ajv = addFormats(new Ajv({ strict: false }));
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
 * changes waits for a quiet moment. A failed reread keeps the last reading
 * visible, marked as not current.
 */
export function useContextDetail(
  agent: string | undefined,
  open: boolean,
  revision: string,
  onLogin?: () => void,
): ContextDetailState {
  const [value, setValue] = useState<ContextDetailState>({ state: "loading" });
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision is the trigger for a reread.
  useEffect(() => {
    if (!agent || !open) {
      setValue({ state: "loading" });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        readContextDetail(agent, controller.signal).then(
          (detail) => setValue({ state: "ready", detail }),
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
  }, [agent, open, revision, onLogin]);
  return value;
}
