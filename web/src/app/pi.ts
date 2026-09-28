import Ajv from "ajv/dist/2020.js";
import statusSchema from "../../../contracts/v1/pi-status.schema.json";
import attemptSchema from "../../../contracts/v1/pi-attempt.schema.json";

const ajv = new Ajv({ strict: false });
const statusValid = ajv.compile(statusSchema);
const attemptValid = ajv.compile(attemptSchema);
export type PiState = "usable" | "missing" | "unknown";
export type Attempt = {
  state: "pending" | "device_code" | "completed" | "unknown";
  pi_state: PiState;
  verification_uri?: string;
  user_code?: string;
};

async function boundedJSON(response: Response): Promise<unknown> {
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("invalid response");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("missing body");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 4096) {
        await reader.cancel();
        throw new Error("oversize response");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  ) as unknown;
}
export async function piStatus(
  signal?: AbortSignal,
): Promise<PiState | "login"> {
  const response = await fetch("/api/v1/onboarding/pi/status", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (response.status === 401) return "login";
  const value = await boundedJSON(response);
  if (!statusValid(value)) throw new Error("invalid Pi status");
  return (value as { pi: { state: PiState } }).pi.state;
}
export async function sessionCSRF(
  signal?: AbortSignal,
): Promise<string | "login"> {
  const session = await fetch("/auth/session", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (session.status === 401) return "login";
  const value = await boundedJSON(session);
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !== "csrf,provider,schema_version" ||
    !("schema_version" in value) ||
    value.schema_version !== 1 ||
    !("provider" in value) ||
    value.provider !== "github" ||
    !("csrf" in value) ||
    typeof value.csrf !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(value.csrf)
  )
    throw new Error("invalid session");
  return value.csrf;
}
export async function piAttempt(
  method: "GET" | "POST" | "DELETE",
  boundCSRF?: string,
  signal?: AbortSignal,
): Promise<Attempt | "absent" | "login" | "busy"> {
  const headers: Record<string, string> = {};
  if (method !== "GET") {
    if (!boundCSRF || !/^[A-Za-z0-9_-]{43}$/.test(boundCSRF))
      throw new Error("missing session binding");
    const current = await sessionCSRF(signal);
    if (current === "login") return "login";
    if (current !== boundCSRF) throw new Error("session changed");
    headers.Origin = window.location.origin;
    headers["X-Agent-Host-CSRF"] = boundCSRF;
  }
  const response = await fetch("/api/v1/onboarding/pi/attempt", {
    method,
    headers,
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (response.status === 401) return "login";
  if (response.status === 404) return "absent";
  if (response.status === 409) return "busy";
  const value = await boundedJSON(response);
  if (!attemptValid(value)) throw new Error("invalid Pi attempt");
  return (value as { attempt: Attempt }).attempt;
}
