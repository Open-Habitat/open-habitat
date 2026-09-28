// The private provisional controller protocol is validated independently of the
// published snapshot contract. No host-supplied HTML or error text is rendered.
export type Session = { agent_id: string; workspace_id: string; state: string };
export type Status = Session & {
  command_id: string;
  ack: string;
  event_cursor: number;
  events: unknown[];
  event_loss: boolean;
  native_history: string;
  native_revision: string;
  history_query: string;
};
const uuid = /^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/;
const agent = /^pi:[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/;
const ws = /^ws_[A-Za-z0-9_-]{8,64}$/;
const states = [
  "idle",
  "pending",
  "accepted",
  "rejected",
  "uncertain",
  "stopping",
];
const acks = ["", "pending", "accepted", "rejected", "uncertain"];
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
function session(v: unknown): v is Session & Record<string, unknown> {
  return (
    object(v) &&
    typeof v.agent_id === "string" &&
    agent.test(v.agent_id) &&
    typeof v.workspace_id === "string" &&
    ws.test(v.workspace_id) &&
    typeof v.state === "string" &&
    states.includes(v.state)
  );
}
async function json(response: Response): Promise<unknown> {
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("unavailable");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1048576) {
        await reader.cancel();
        throw new Error("unavailable");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  ) as unknown;
}
async function request(
  path: string,
  signal?: AbortSignal,
  body?: object,
  csrf?: string,
) {
  const response = await fetch(path, {
    method: body || csrf ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal,
    headers: csrf
      ? {
          "Content-Type": "application/json",
          "X-Agent-Host-CSRF": csrf,
          Origin: window.location.origin,
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 401 || response.status === 428)
    throw new Error("identity_lost");
  return json(response);
}
const base = "/api/v1/conversations";
export async function list(signal?: AbortSignal): Promise<Session[]> {
  const v = await request(base, signal);
  if (
    !object(v) ||
    v.schema_version !== 1 ||
    !Array.isArray(v.sessions) ||
    v.sessions.length > 128 ||
    !v.sessions.every(session)
  )
    throw new Error("invalid list");
  return v.sessions;
}
export async function create(
  workspace: string,
  csrf: string,
): Promise<Session> {
  if (!ws.test(workspace)) throw new Error("invalid workspace");
  const v = await request(base, undefined, { workspace_id: workspace }, csrf);
  if (
    !object(v) ||
    v.schema_version !== 1 ||
    !session(v) ||
    v.workspace_id !== workspace ||
    v.state !== "idle"
  )
    throw new Error("invalid create");
  return v;
}
function path(id: string) {
  if (!agent.test(id)) throw new Error("invalid agent");
  return `${base}/${id.slice(3)}`;
}
export async function status(
  id: string,
  signal?: AbortSignal,
): Promise<Status> {
  const v = await request(`${path(id)}/status`, signal);
  if (
    !session(v) ||
    !object(v) ||
    v.schema_version !== 1 ||
    v.agent_id !== id ||
    typeof v.command_id !== "string" ||
    (v.command_id !== "" && !uuid.test(v.command_id)) ||
    typeof v.ack !== "string" ||
    !acks.includes(v.ack) ||
    !Number.isSafeInteger(v.event_cursor) ||
    (v.event_cursor as number) < 0 ||
    !Array.isArray(v.events) ||
    v.events.length > 64 ||
    !v.events.every(
      (e: unknown) => object(e) && JSON.stringify(e).length <= 8192,
    ) ||
    typeof v.event_loss !== "boolean" ||
    !["missing", "unavailable", "readable"].includes(
      String(v.native_history),
    ) ||
    typeof v.native_revision !== "string" ||
    v.native_revision.length > 256 ||
    v.history_query !== `/api/v1/agents/${id}/history`
  )
    throw new Error("invalid status");
  return v as Status;
}
export async function send(
  id: string,
  message: string,
  commandId: string,
  csrf: string,
) {
  if (
    !message ||
    new TextEncoder().encode(message).length > 65536 ||
    !uuid.test(commandId)
  )
    throw new Error("invalid message");
  const v = await request(
    `${path(id)}/send`,
    undefined,
    { message, command_id: commandId },
    csrf,
  );
  if (
    !object(v) ||
    v.schema_version !== 1 ||
    v.command_id !== commandId ||
    v.state !== "pending"
  )
    throw new Error("invalid send");
}
export async function stop(id: string, csrf: string) {
  const v = await request(`${path(id)}/stop`, undefined, undefined, csrf);
  if (!object(v) || v.schema_version !== 1 || v.state !== "termination_unknown")
    throw new Error("invalid stop");
}
