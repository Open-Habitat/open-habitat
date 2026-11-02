import schema from "../../../contracts/v1/spinoff-work.schema.json";
import { LazyAjv } from "./lazyAjv";

/** What one worker has produced, read against the branch it started from,
 * and its pull request as the person's own gh sees it. */
export interface WorkerWork {
  run_id: string;
  git: "available" | "unavailable";
  dirty_count?: number;
  ahead?: number;
  behind?: number;
  added?: number;
  removed?: number;
  pull_request_state: "found" | "none" | "unknown" | "unsupported";
  pull_request?: WorkerPullRequest;
}
export interface WorkerPullRequest {
  number: number;
  state: "open" | "draft" | "closed" | "merged";
  url: string;
  checks: { passed: number; failed: number; pending: number };
}
export interface SpinoffWork {
  schema_version: 1;
  parent_id: string;
  availability: "available" | "unavailable" | "partial";
  runs: WorkerWork[];
}
const validate = new LazyAjv({ strict: false }).compile(schema);
export function parseSpinoffWork(value: unknown): SpinoffWork {
  if (!validate(value)) throw new Error("spinoff_work_unavailable");
  return value as unknown as SpinoffWork;
}

/** Reads the parent's workers' work facts. Asked only while the person has
 * the worker-row sentence on: each read runs Git and one GitHub call per
 * worker branch as the person. */
export async function readSpinoffWork(
  parent: string,
  signal: AbortSignal,
): Promise<SpinoffWork> {
  const response = await fetch(`/api/v1/agents/${parent}/spinoff-work`, {
    signal,
  });
  if (response.status === 401) throw new Error("identity_lost");
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("spinoff_work_unavailable");
  const text = await response.text();
  if (text.length > 256 * 1024) throw new Error("spinoff_work_unavailable");
  const result = parseSpinoffWork(JSON.parse(text));
  if (result.parent_id !== parent) throw new Error("spinoff_work_unavailable");
  return result;
}
