import Ajv from "ajv/dist/2020.js";
import schema from "../../../contracts/v1/spinoffs.schema.json";
export interface Spinoff {
  preserved: boolean;
  branch: string;
  worktree: string;
  source_branch: string;
  run_id: string;
  title: string;
  created_at: string;
  state: "working" | "waiting_parent" | "merged" | "unmerged" | "unknown";
  summary: string;
}
export interface Spinoffs {
  schema_version: 1;
  parent_id: string;
  availability: "available" | "unavailable" | "partial";
  runs: Spinoff[];
  transcripts: {
    node_id: string;
    availability: "available" | "unavailable" | "unsupported";
    truncated: boolean;
    messages: {
      key: string;
      kind: "user" | "assistant" | "tool";
      text: string;
    }[];
  }[];
}
const validate = new Ajv({ strict: false }).compile(schema);
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
      if (size > 2 * 1024 * 1024) {
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
    unknown: "Tila ei tiedossa",
  }[run.state];
}
