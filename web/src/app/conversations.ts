import Ajv from "ajv/dist/2020.js";
import common from "../../../contracts/v1/common.schema.json";
import historySchema from "../../../contracts/v1/history.schema.json";
import heldSchema from "../../../contracts/v1/pi-held.schema.json";
import startupChoiceSchema from "../../../contracts/v1/pi-startup-choice.schema.json";
import processEventSchema from "../../../contracts/v1/process-event.schema.json";
import recapSchema from "../../../contracts/v1/recap.schema.json";

const validStartupChoice = new Ajv({ strict: false }).compile(
  startupChoiceSchema,
);

const heldValidator = new Ajv({ strict: false });
heldValidator.addSchema(common);
heldValidator.addSchema(heldSchema);
const validHeldList = heldValidator.compile({
  $ref: `${heldSchema.$id}#/$defs/heldList`,
});

const recapValidator = new Ajv({ strict: false });
recapValidator.addSchema(processEventSchema);
recapValidator.addSchema(common);
recapValidator.addSchema(historySchema);
recapValidator.addSchema(recapSchema);

// The private provisional controller protocol is validated independently of the
// published snapshot contract. No host-supplied HTML or error text is rendered.
export type Session = {
  agent_id: string;
  workspace_id: string;
  state: string;
  startup_choice?: {
    provider?: "openai" | "openai-codex" | "claude-bridge";
    model: string;
    thinking?: string;
  } | null;
};
export type Status = Session & {
  run_active?: boolean;
  command_id: string;
  ack: string;
  event_cursor: number;
  events: unknown[];
  event_loss: boolean;
  auth_error?: "" | "pi_auth_failed" | "pi_model_unsupported";
  native_history: string;
  continuation:
    | "eligible"
    | "writer_present"
    | "read_only_history"
    | "unproven";
  native_revision: string;
  history_query: string;
  queue?: { revision: number; steering: string[]; follow_up: string[] };
  /** Messages the daemon holds until Pi runs, in send order. */
  held?: HeldMessage[];
  /** Fixed code of a failed Pi start; the held messages are kept. */
  start_problem?: string;
  /** Pi ended during a turn; whether that work finished is not known. */
  interrupted?: boolean;
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
export type HeldMessage = { command_id: string; text: string };
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
  // Pi is not running: being started, never started in this daemon
  // incarnation, or its start failed. A send is held and starts it.
  "starting",
  "stopped",
  "start_failed",
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
    states.includes(v.state) &&
    (v.startup_choice === undefined || validStartupChoice(v.startup_choice))
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
// Leave headroom for the request ID and JSON envelope under the daemon's 66000-byte limit.
export function questionTextFits(value: string): boolean {
  return new TextEncoder().encode(JSON.stringify(value)).length <= 60000;
}
export async function respondQuestion(
  id: string,
  requestId: string,
  action: "answer" | "cancel",
  csrf: string,
  value?: string | boolean,
): Promise<void> {
  if (
    !requestId ||
    requestId.length > 200 ||
    !csrf ||
    (action === "answer" &&
      (value === undefined ||
        (typeof value === "string" && !questionTextFits(value))))
  )
    throw new Error("invalid question");
  const result = await request(
    `${path(id)}/question`,
    undefined,
    action === "cancel"
      ? { request_id: requestId, action }
      : { request_id: requestId, action, value },
    csrf,
  );
  if (
    !object(result) ||
    result.schema_version !== 1 ||
    result.request_id !== requestId ||
    result.state !== "uncertain"
  )
    throw new Error("invalid question reply");
}
export type Recap = {
  recap: string;
  next: string;
  through: string;
  generated_at: number;
  trigger?: "manual" | "automatic";
};
export async function readRecap(
  id: string,
): Promise<{ recap: Recap | null; latest_message: string }> {
  const reply = await request(
    `/api/v1/agents/${encodeURIComponent(id).replace("%3A", ":")}/recap`,
  );
  if (!recapValidator.getSchema(recapSchema.$id)?.(reply))
    throw new Error("invalid recap");
  const result = reply as { recap: Recap | null; latest_message: string };
  return { recap: result.recap, latest_message: result.latest_message };
}
export async function requestRecap(id: string, csrf: string): Promise<void> {
  const reply = await request(`${path(id)}/recap`, undefined, undefined, csrf);
  if (!object(reply) || reply.schema_version !== 1 || reply.state !== "done")
    throw new Error("recap generation failed");
}
export async function regenerateTitle(id: string, csrf: string): Promise<void> {
  const reply = await request(
    `${path(id)}/regenerate_title`,
    undefined,
    undefined,
    csrf,
  );
  if (!object(reply) || reply.schema_version !== 1 || reply.state !== "done")
    throw new Error("title generation failed");
}

export async function retitleHistory(
  id: string,
  workspace: string,
  csrf: string,
): Promise<void> {
  if (!ws.test(workspace)) throw new Error("invalid workspace");
  const reply = await request(
    `${path(id)}/history_title`,
    undefined,
    { workspace_id: workspace },
    csrf,
  );
  if (!object(reply) || reply.schema_version !== 1 || reply.state !== "done")
    throw new Error("title generation failed");
}

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
const pendingCreations = new Set<string>();
export function canRecheckCreation(key: string): boolean {
  return (
    !pendingCreations.has(key) &&
    /^create(?::|$)/.test(sessionStorage.getItem(key) ?? "")
  );
}

/** Existing identity-scoped uncertainty marker shared by every creation surface.
 * Never clear it from a response belonging to an abandoned login/view. */
export async function createTracked(
  workspace: string,
  csrf: string,
  uncertainKey: string,
  stillCurrent: () => boolean,
  choice?: Parameters<typeof create>[2],
): Promise<Session | undefined> {
  if (!stillCurrent()) return;
  const attempt = crypto.randomUUID();
  sessionStorage.setItem(uncertainKey, `create:${attempt}`);
  pendingCreations.add(uncertainKey);
  try {
    const result = await create(workspace, csrf, choice);
    if (!stillCurrent()) return;
    sessionStorage.removeItem(uncertainKey);
    return result;
  } finally {
    pendingCreations.delete(uncertainKey);
  }
}

export async function create(
  workspace: string,
  csrf: string,
  choice?: {
    provider?: "openai" | "openai-codex" | "claude-bridge";
    model: string;
    thinking?: string;
  },
): Promise<Session> {
  if (!ws.test(workspace)) throw new Error("invalid workspace");
  const v = await request(
    base,
    undefined,
    { workspace_id: workspace, ...choice },
    csrf,
  );
  if (
    !object(v) ||
    v.schema_version !== 1 ||
    !session(v) ||
    (v.run_active !== undefined && typeof v.run_active !== "boolean") ||
    v.workspace_id !== workspace ||
    (v.state !== "starting" && v.state !== "idle")
  )
    throw new Error("invalid create");
  return v;
}
function path(id: string) {
  if (!agent.test(id)) throw new Error("invalid agent");
  return `${base}/${id.slice(3)}`;
}
export async function historyEligibility(
  id: string,
  signal?: AbortSignal,
): Promise<{
  process: "writer_present" | "not_observed" | "unknown";
  continuation: Status["continuation"];
}> {
  const v = await request(`${path(id)}/eligibility`, signal);
  if (
    !object(v) ||
    v.schema_version !== 1 ||
    v.agent_id !== id ||
    !["writer_present", "not_observed", "unknown"].includes(
      String(v.process),
    ) ||
    !["eligible", "writer_present", "read_only_history", "unproven"].includes(
      String(v.continuation),
    )
  )
    throw new Error("invalid eligibility");
  return {
    process: v.process as "writer_present" | "not_observed" | "unknown",
    continuation: v.continuation as Status["continuation"],
  };
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
    (v.run_active !== undefined && typeof v.run_active !== "boolean") ||
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
      v.auth_error !== "pi_auth_failed" &&
      v.auth_error !== "pi_model_unsupported") ||
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
    (v.held !== undefined && !validHeldList(v.held)) ||
    (v.interrupted !== undefined && typeof v.interrupted !== "boolean") ||
    (v.start_problem !== undefined &&
      (typeof v.start_problem !== "string" ||
        !/^(|[a-z][a-z0-9_]{2,63})$/.test(v.start_problem))) ||
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
const receipts = [
  "pending",
  "accepted",
  "rejected",
  "uncertain",
  "held",
  "cancelled",
];
/** held: the daemon keeps it until Pi runs. cancelled: taken back before Pi ran. */
export type Receipt =
  | "pending"
  | "accepted"
  | "rejected"
  | "uncertain"
  | "held"
  | "cancelled";
// A 404 is absence of evidence, not rejection. Never re-issue the send.
export async function sendReceipt(
  id: string,
  commandId: string,
): Promise<Receipt | undefined> {
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
    !receipts.includes(String(v.state))
  )
    throw new Error("invalid receipt");
  return v.state as Receipt;
}
export async function send(
  id: string,
  message: string,
  commandId: string,
  csrf: string,
  choice?: { provider?: string; model: string; thinking?: string },
): Promise<"pending" | "held"> {
  if (
    !message ||
    new TextEncoder().encode(message).length > 65536 ||
    !uuid.test(commandId)
  )
    throw new Error("invalid message");
  const v = await request(
    `${path(id)}/send`,
    undefined,
    {
      message,
      command_id: commandId,
      ...(choice ? { first_choice: choice } : {}),
    },
    csrf,
  );
  if (
    !object(v) ||
    v.schema_version !== 1 ||
    v.command_id !== commandId ||
    (v.state !== "pending" && v.state !== "held")
  )
    throw new Error("invalid send");
  return v.state;
}
/** Take back every held message; returns exactly the texts Pi never received. */
export async function cancelHeld(
  id: string,
  commandId: string,
  csrf: string,
): Promise<HeldMessage[]> {
  if (!uuid.test(commandId)) throw new Error("invalid command");
  const v = await request(
    `${path(id)}/cancel_held`,
    undefined,
    { command_id: commandId },
    csrf,
  );
  if (
    !heldValidator.getSchema(heldSchema.$id)?.(v) ||
    (v as { command_id: string }).command_id !== commandId
  )
    throw new Error("invalid cancel");
  return (v as { returned: HeldMessage[] }).returned;
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
    (v.run_active !== undefined && typeof v.run_active !== "boolean") ||
    v.agent_id !== id ||
    v.workspace_id !== workspace ||
    (v.state !== "starting" && v.state !== "idle") ||
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

export async function closeEmpty(id: string, csrf: string): Promise<void> {
  const v = await request(`${path(id)}/close`, undefined, undefined, csrf);
  if (!object(v) || v.schema_version !== 1 || v.state !== "closed")
    throw new Error("invalid close result");
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

// Annotation writes are never retried automatically after a lost reply. A fresh
// snapshot is the only evidence that a presentation change actually landed.
export async function setArchive(
  id: string,
  workspace: string,
  observation: string,
  archived: boolean,
  previousArchive: "active" | "archived",
  csrf: string,
): Promise<void> {
  if (!agent.test(id) || !ws.test(workspace) || !observation)
    throw new Error("invalid archive target");
  const value = await request(
    "/api/v1/workspaces",
    undefined,
    {
      action: "conversation_archive",
      agent_id: id,
      workspace_id: workspace,
      observation_token: observation,
      archived,
      previous_archive: previousArchive,
    },
    csrf,
  );
  if (
    !object(value) ||
    value.schema_version !== 1 ||
    value.agent_id !== id ||
    value.archive !== (archived ? "archived" : "active")
  )
    throw new Error("invalid archive result");
}
