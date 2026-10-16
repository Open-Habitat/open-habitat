import Ajv from "ajv/dist/2020.js";
import eventSchema from "../../../contracts/v1/process-event.schema.json";
import schema from "../../../contracts/v1/process.schema.json";

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
  if (run.state)
    return {
      working: "Työskentelee",
      waiting_parent: "Odottaa pääagenttia",
      merged: "Mergetty",
      unmerged: run.preserved ? "Ei mergetty · työ tallessa" : "Ei mergetty",
      unknown: "Tila ei tiedossa",
    }[run.state];
  return run.status === "pending" || run.status === "running"
    ? "Työskentelee"
    : run.landed
      ? "Mergetty"
      : run.status === "cancelled"
        ? "Peruttu · työ tallessa"
        : "Ei mergetty · työ tallessa";
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
const ajv = new Ajv({ strict: false });
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
    await fetch(
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
export function processLabel(p: ProcessRecord) {
  return {
    running: "Käynnissä",
    terminating: "Pysäytetään…",
    terminate_timeout: "Ei pysähtynyt",
    killed: "Pysäytetty",
    exited: p.exit_code === 0 ? "Valmis" : "Epäonnistui",
  }[p.status];
}
