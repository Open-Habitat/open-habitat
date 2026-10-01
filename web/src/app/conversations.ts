// The private provisional controller protocol is validated independently of the
// published snapshot contract. No host-supplied HTML or error text is rendered.
export type Session = { agent_id: string; workspace_id: string; state: string };
export type Status = Session & {
  command_id: string;
  ack: string;
  event_cursor: number;
  events: unknown[];
  event_loss: boolean;
  auth_error?: "" | "pi_auth_failed";
  native_history: string;
  continuation:
    | "eligible"
    | "writer_present"
    | "read_only_history"
    | "unproven";
  native_revision: string;
  history_query: string;
  queue?: { revision: number; steering: string[]; follow_up: string[] };
  send_receipt?: "" | "pending" | "accepted" | "rejected" | "uncertain";
  turn_settled?: {
    state: "settled" | "unknown";
    observed_at: string;
    native_key: string;
  } | null;
  pending_question?: {
    request_id: string;
    question_kind: "input" | "confirm" | "select" | "unknown";
    prompt: string;
    choices: string[];
  } | null;
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
export class NotAdmitted extends Error {}
export class ConversationNotFound extends Error {}
export type ContinueRefusal =
  | "writer_conflict"
  | "read_only_history"
  | "control_uncertain"
  | "capacity_exceeded";
export class ContinuationRefused extends Error {
  constructor(readonly code: ContinueRefusal) {
    super(code);
  }
}
async function json(response: Response): Promise<unknown> {
  if (response.status === 401) throw new Error("identity_lost");
  if (response.status === 404) throw new ConversationNotFound("not found");
  if (response.status === 409) throw new NotAdmitted("state changed");
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("unavailable");
  return readBody(response);
}
async function readBody(response: Response): Promise<unknown> {
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
  if (response.status === 401) throw new Error("identity_lost");
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
  continuation = false,
): Promise<Status> {
  return parseStatus(
    await request(
      `${path(id)}/status${continuation ? "?continuation=true" : ""}`,
      signal,
    ),
    id,
  );
}
export function parseStatus(v: unknown, id: string): Status {
  if (!agent.test(id)) throw new Error("invalid agent");
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
    (v.auth_error !== undefined &&
      v.auth_error !== "" &&
      v.auth_error !== "pi_auth_failed") ||
    !["missing", "unavailable", "present"].includes(String(v.native_history)) ||
    !["eligible", "writer_present", "read_only_history", "unproven"].includes(
      String(v.continuation),
    ) ||
    typeof v.native_revision !== "string" ||
    v.native_revision.length > 256 ||
    (v.queue !== undefined &&
      (!object(v.queue) ||
        !Number.isSafeInteger(v.queue.revision) ||
        (v.queue.revision as number) < 0 ||
        !Array.isArray(v.queue.steering) ||
        !Array.isArray(v.queue.follow_up) ||
        v.queue.steering.length + v.queue.follow_up.length > 128 ||
        ![...v.queue.steering, ...v.queue.follow_up].every(
          (t: unknown) =>
            typeof t === "string" &&
            new TextEncoder().encode(t).length <= 65536,
        ))) ||
    v.history_query !== `/api/v1/agents/${id}/history` ||
    (v.send_receipt !== undefined &&
      !["", "pending", "accepted", "rejected", "uncertain"].includes(
        String(v.send_receipt),
      )) ||
    (v.turn_settled != null &&
      (!object(v.turn_settled) ||
        !["settled", "unknown"].includes(String(v.turn_settled.state)) ||
        typeof v.turn_settled.observed_at !== "string" ||
        !Number.isFinite(Date.parse(v.turn_settled.observed_at)) ||
        typeof v.turn_settled.native_key !== "string" ||
        v.turn_settled.native_key.length > 128 ||
        (v.turn_settled.state === "settled" && !v.turn_settled.native_key))) ||
    (v.pending_question != null &&
      (!object(v.pending_question) ||
        typeof v.pending_question.request_id !== "string" ||
        !v.pending_question.request_id ||
        v.pending_question.request_id.length > 200 ||
        !["input", "confirm", "select", "unknown"].includes(
          String(v.pending_question.question_kind),
        ) ||
        typeof v.pending_question.prompt !== "string" ||
        !v.pending_question.prompt ||
        v.pending_question.prompt.length > 1000 ||
        !Array.isArray(v.pending_question.choices) ||
        v.pending_question.choices.length > 100 ||
        !v.pending_question.choices.every(
          (c: unknown) => typeof c === "string" && c.length <= 500,
        )))
  )
    throw new Error("invalid status");
  return v as Status;
}
// A 404 is absence of evidence, not rejection. Never re-issue the send.
export async function sendReceipt(
  id: string,
  commandId: string,
): Promise<"pending" | "accepted" | "rejected" | "uncertain" | undefined> {
  if (!uuid.test(commandId)) throw new Error("invalid command");
  const response = await fetch(
    `${path(id)}/receipt?command_id=${encodeURIComponent(commandId)}`,
    {
      credentials: "same-origin",
      cache: "no-store",
    },
  );
  if (response.status === 401) throw new Error("identity_lost");
  if (response.status === 404) return undefined;
  const v = await json(response);
  if (
    !object(v) ||
    v.schema_version !== 1 ||
    v.command_id !== commandId ||
    !["pending", "accepted", "rejected", "uncertain"].includes(String(v.state))
  )
    throw new Error("invalid receipt");
  return v.state as "pending" | "accepted" | "rejected" | "uncertain";
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
export async function continueConversation(
  id: string,
  workspace: string,
  csrf: string,
): Promise<void> {
  if (!ws.test(workspace)) throw new Error("invalid workspace");
  // No body, including an empty JSON object. A lost response is never replayed.
  const response = await fetch(`${path(id)}/continue`, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "X-Agent-Host-CSRF": csrf, Origin: window.location.origin },
  });
  if (response.status === 409 || response.status === 429) {
    const error = await readJSON(response);
    if (
      object(error) &&
      error.schema_version === 1 &&
      object(error.error) &&
      ((response.status === 409 &&
        ["writer_conflict", "read_only_history", "control_uncertain"].includes(
          String(error.error.code),
        )) ||
        (response.status === 429 && error.error.code === "capacity_exceeded"))
    )
      throw new ContinuationRefused(error.error.code as ContinueRefusal);
    throw new Error("invalid refusal");
  }
  if (response.status === 401) throw new Error("identity_lost");
  const v = await json(response);
  if (
    !object(v) ||
    v.schema_version !== 1 ||
    !session(v) ||
    v.agent_id !== id ||
    v.workspace_id !== workspace ||
    v.state !== "idle" ||
    v.prior_outcome !== "uncertain"
  )
    throw new Error("invalid continuation");
}

// The same bounded read used for successes also protects error parsing.
async function readJSON(response: Response): Promise<unknown> {
  if (
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("unavailable");
  return readBody(response);
}
export async function abortTurn(id: string, commandId: string, csrf: string) {
  if (!uuid.test(commandId)) throw new Error("invalid command");
  const v = await request(
    `${path(id)}/abort`,
    undefined,
    { command_id: commandId },
    csrf,
  );
  if (
    !object(v) ||
    v.schema_version !== 1 ||
    v.command_id !== commandId ||
    v.state !== "pending"
  )
    throw new Error("invalid abort");
}

export async function stop(id: string, csrf: string) {
  const v = await request(`${path(id)}/stop`, undefined, undefined, csrf);
  if (!object(v) || v.schema_version !== 1 || v.state !== "termination_unknown")
    throw new Error("invalid stop");
}

export async function queueMessage(
  id: string,
  message: string,
  commandId: string,
  csrf: string,
  kind: "steer" | "follow_up",
) {
  if (
    !message ||
    new TextEncoder().encode(message).length > 65536 ||
    !uuid.test(commandId)
  )
    throw new Error("invalid message");
  const v = await request(
    `${path(id)}/${kind}`,
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
    throw new Error("invalid queue send");
}
export async function clearQueue(
  id: string,
  commandId: string,
  csrf: string,
): Promise<{ steering: string[]; follow_up: string[] }> {
  if (!uuid.test(commandId)) throw new Error("invalid command");
  const v = await request(
    `${path(id)}/clear_queue`,
    undefined,
    { command_id: commandId },
    csrf,
  );
  if (
    !object(v) ||
    v.schema_version !== 1 ||
    v.command_id !== commandId ||
    v.state !== "accepted" ||
    !object(v.removed_queue)
  )
    throw new Error("invalid clear");
  const q = v.removed_queue;
  if (
    !Array.isArray(q.steering) ||
    !Array.isArray(q.follow_up) ||
    q.steering.length + q.follow_up.length > 128 ||
    ![...q.steering, ...q.follow_up].every(
      (t: unknown) =>
        typeof t === "string" && new TextEncoder().encode(t).length <= 65536,
    )
  )
    throw new Error("invalid clear");
  return {
    steering: q.steering as string[],
    follow_up: q.follow_up as string[],
  };
}
