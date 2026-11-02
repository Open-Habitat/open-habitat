import schema from "../../../contracts/v1/process.schema.json";
import eventSchema from "../../../contracts/v1/process-event.schema.json";
import { liveText } from "../i18n";
import { processesText } from "../text/processes";
import { LazyAjv } from "./lazyAjv";
import { mutationFetch } from "./mutations";

const txt = liveText(processesText);

export interface ProcessSpinoff {
  state?: import("./spinoffs").Spinoff["state"];
  preserved?: boolean;
  run_id: string;
  title: string;
  status: "pending" | "running" | "done" | "failed" | "cancelled";
  landed: boolean;
  commit: string | null;
}
export function spinoffLabel(run: ProcessSpinoff): string {
  const t = txt.run;
  if (run.state)
    return {
      working: t.working,
      idle: t.idle,
      waiting_parent: t.waiting_parent,
      merged: t.merged,
      unmerged: run.preserved ? t.unmergedKept : t.unmerged,
      failed: run.preserved ? t.failedKept : t.failed,
      unknown: t.unknown,
    }[run.state];
  return run.status === "pending" || run.status === "running"
    ? t.working
    : run.landed
      ? t.merged
      : run.status === "cancelled"
        ? t.cancelledKept
        : t.unmergedKept;
}
export interface ProcessRecord {
  spinoff?: ProcessSpinoff[];
  id: string;
  name: string;
  command_preview: string;
  process_token: string;
  status: "running" | "terminating" | "terminate_timeout" | "exited" | "killed";
  started_at: number;
  ended_at: number | null;
  exit_code: number | null;
  signal: string | null;
  end_reason: string | null;
  wakes_agent: boolean | null;
  run_ids: string[];
}
export interface ProcessEvent {
  summary?: string;
  spinoff?: ProcessSpinoff[];
  notification_key?: string;
  kind:
    | "success"
    | "failure"
    | "crash"
    | "killed"
    | "log_match"
    | "log_match_suppressed";
  process_id: string;
  process_name: string;
  command_preview: string;
  exit_code: number | null;
  signal: string | null;
  end_reason: string | null;
  delivery: "steer" | "wake" | "context" | null;
  run_ids: string[];
}
/** A process an earlier Pi started and never saw end; read from the branch. */
export interface InterruptedProcess {
  id: string;
  name: string;
  command_preview: string;
  started_at: number;
  reason: "server_restart" | "pi_stopped";
  wakes_agent: boolean;
  run_ids: string[];
}
export interface ProcessInventory {
  schema_version: 1;
  owner_generation: string | null;
  availability: "available" | "unavailable";
  unavailable_reason:
    | null
    | "pi_not_running"
    | "terminal_control"
    | "extension_missing"
    | "bridge_unavailable"
    | "error";
  processes: ProcessRecord[];
  interrupted: InterruptedProcess[];
}
export interface ProcessOutput {
  schema_version: 1;
  owner_generation: string;
  process_id: string;
  process_token: string;
  lines: { stream: "stdout" | "stderr"; text: string }[];
  omitted_before: number | null;
  retention_restarted: boolean | null;
}
const ajv = new LazyAjv({ strict: false });
ajv.addSchema(eventSchema);
ajv.addSchema(schema);
const inventoryValidator = ajv.compile({
  $ref: `${schema.$id}#/$defs/inventory`,
});
const outputValidator = ajv.compile({ $ref: `${schema.$id}#/$defs/output` });
const actionValidator = ajv.compile({ $ref: `${schema.$id}#/$defs/action` });
export function parseInventory(value: unknown): ProcessInventory {
  if (!inventoryValidator(value)) throw new Error("process_unavailable");
  return value as ProcessInventory;
}
export function parseOutput(value: unknown): ProcessOutput {
  if (!outputValidator(value)) throw new Error("process_unavailable");
  const output = value as ProcessOutput;
  if (
    output.lines.reduce(
      (size, line) => size + new TextEncoder().encode(line.text).byteLength,
      0,
    ) >
    128 * 1024
  )
    throw new Error("process_unavailable");
  return output;
}
async function read(response: Response): Promise<unknown> {
  if (response.status === 401) throw new Error("identity_lost");
  if (response.status === 409) throw new Error("stale_process");
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("process_unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("process_unavailable");
  let size = 0;
  const parts: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("process_unavailable");
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
    offset += part.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function processPath(id: string): string {
  if (!/^pi:[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/.test(id))
    throw new Error("invalid conversation");
  return `/api/v1/conversations/${id.slice(3)}/processes`;
}
export async function fetchProcesses(id: string, signal: AbortSignal) {
  return parseInventory(
    await read(
      await fetch(processPath(id), {
        signal,
        credentials: "same-origin",
        cache: "no-store",
      }),
    ),
  );
}
export async function fetchProcessOutput(
  id: string,
  owner: string,
  process: ProcessRecord,
  signal: AbortSignal,
) {
  const query = new URLSearchParams({
    owner_generation: owner,
    process_token: process.process_token,
    tail_lines: "200",
  });
  const output = parseOutput(
    await read(
      await fetch(
        `${processPath(id)}/${encodeURIComponent(process.id)}/output?${query}`,
        { signal, credentials: "same-origin", cache: "no-store" },
      ),
    ),
  );
  if (
    output.owner_generation !== owner ||
    output.process_id !== process.id ||
    output.process_token !== process.process_token
  )
    throw new Error("stale_process");
  return output;
}
export async function controlProcess(
  id: string,
  owner: string,
  csrf: string,
  process?: ProcessRecord,
  force = false,
) {
  const reply = await read(
    await mutationFetch(
      "process.control",
      `${processPath(id)}/${process ? `${encodeURIComponent(process.id)}/stop` : "clear-finished"}`,
      {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Host-CSRF": csrf,
        },
        body: JSON.stringify(
          process
            ? {
                owner_generation: owner,
                process_token: process.process_token,
                force,
              }
            : { owner_generation: owner },
        ),
      },
    ),
  );
  if (!actionValidator(reply)) throw new Error("process_unavailable");
  const result = (reply as { result: string }).result;
  if (
    process
      ? !["killed", "terminate_timeout", "not_found", "error"].includes(result)
      : result !== "cleared"
  )
    throw new Error("process_unavailable");
  return result;
}
export const processLive = (p: ProcessRecord) =>
  ["running", "terminating", "terminate_timeout"].includes(p.status);
export const interruptedLabel = (p: InterruptedProcess) =>
  p.reason === "server_restart"
    ? txt.interruptedRestart
    : txt.interruptedStopped;
/** How an ended process reads. */
export interface ExitReading {
  /** ok: exit 0; neutral: ended as the agent may have expected; err: failed. */
  tone: "ok" | "neutral" | "err";
  /** Lower-case, for the middle of a sentence. */
  label: string;
}
// Jari 26.10.2026 (proto-background-waits, direction 2): a non-zero exit code
// is a fact the agent explains in its next message, not a crash. A release
// watcher's "skipped, no product change" and a wait's check-in are ordinary
// outcomes, and Habitat cannot tell them from a real failure, so every exit
// code reads neutral. Red is kept for what is a failure whatever the command:
// a signal, and a process that never started or was lost. A recognised
// Taskfleet wait (run ids joined) names its own codes.
export function exitReading(p: {
  killed: boolean;
  exit_code: number | null;
  signal: string | null;
  end_reason: string | null;
  run_ids: string[];
}): ExitReading {
  if (p.killed) return { tone: "neutral", label: txt.exit.killed };
  if (p.end_reason === "spawn_error" || p.end_reason === "missing_pid")
    return { tone: "err", label: txt.exit.notStarted };
  if (p.end_reason === "lost") return { tone: "err", label: txt.exit.lost };
  if (p.exit_code === 0) return { tone: "ok", label: txt.exit.done };
  if (p.signal) return { tone: "err", label: txt.exit.crashed };
  if (p.exit_code === null) return { tone: "err", label: txt.exit.failed };
  if (p.run_ids.length) {
    // `taskfleet run wait`: 2 timeout, 3 a settled run failed
    // (--fail-on-error), 4 check-in snapshot. The run's own failure shows on
    // the worker; the wait did what it was asked.
    const wait = {
      2: txt.exit.waitTimeout,
      3: txt.exit.runFailed,
      4: txt.exit.checkIn,
    }[p.exit_code];
    if (wait) return { tone: "neutral", label: wait };
  }
  return { tone: "neutral", label: txt.exit.ended };
}
export const recordExit = (p: ProcessRecord) =>
  exitReading({ ...p, killed: p.status === "killed" });
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export function processLabel(p: ProcessRecord) {
  return {
    running: txt.status.running,
    terminating: txt.status.terminating,
    terminate_timeout: txt.status.terminate_timeout,
    killed: txt.status.killed,
    exited: capital(recordExit(p).label),
  }[p.status];
}
