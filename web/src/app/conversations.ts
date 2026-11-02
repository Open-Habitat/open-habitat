import common from "../../../contracts/v1/common.schema.json";
import editorSchema from "../../../contracts/v1/editor.schema.json";
import fileOfferSchema from "../../../contracts/v1/file-offer.schema.json";
import historySchema from "../../../contracts/v1/history.schema.json";
import noticeSchema from "../../../contracts/v1/notice.schema.json";
import heldSchema from "../../../contracts/v1/pi-held.schema.json";
import startupChoiceSchema from "../../../contracts/v1/pi-startup-choice.schema.json";
import processEventSchema from "../../../contracts/v1/process-event.schema.json";
import recapSchema from "../../../contracts/v1/recap.schema.json";
import viewSchema from "../../../contracts/v1/view.schema.json";
import type { PiProvider } from "../components/ModelPicker";
import { validBashReply, validBashStatus } from "./composerContract";
import { conversationName } from "./conversationName";
import { LazyAjv } from "./lazyAjv";
import {
  jsonWrite,
  type MutationCommand,
  mutationFetch,
  WriteRefused,
  writeOutcome,
} from "./mutations";

const validStartupChoice = new LazyAjv({
  strict: false,
  addFormats: true,
}).compile(startupChoiceSchema);

const heldValidator = new LazyAjv({ strict: false, addFormats: true });
heldValidator.addSchema(common);
heldValidator.addSchema(heldSchema);
const validHeldList = heldValidator.compile({
  $ref: `${heldSchema.$id}#/$defs/heldList`,
});

const recapValidator = new LazyAjv({ strict: false, addFormats: true });
recapValidator.addSchema(processEventSchema);
recapValidator.addSchema(common);
recapValidator.addSchema(noticeSchema);
recapValidator.addSchema(viewSchema);
recapValidator.addSchema(fileOfferSchema);
recapValidator.addSchema(editorSchema);
recapValidator.addSchema(historySchema);
recapValidator.addSchema(recapSchema);

// The private provisional controller protocol is validated independently of the
// published snapshot contract. No host-supplied HTML or error text is rendered.
export type Session = {
  agent_id: string;
  workspace_id: string;
  /** A new worktree agent: workspace_id is its place, this its workspace. */
  worktree_of?: string;
  state: string;
  startup_choice?: {
    provider?: PiProvider;
    model: string;
    thinking?: string;
  } | null;
};
export type Status = Session & {
  run_active?: boolean;
  command_id: string;
  ack: string;
  event_cursor: number;
  /** The journal position the daemon read this status at: it reflects every
   * event up to that cursor. Absent without a journal. */
  journal_cursor?: string;
  events: unknown[];
  event_loss: boolean;
  auth_error?: "" | "pi_auth_failed" | "pi_model_unsupported";
  native_history: string;
  continuation:
    | "eligible"
    | "writer_present"
    | "read_only_history"
    | "history_damaged"
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
  /** The conversation's last `!` command in this daemon incarnation. */
  bash?: BashStatus | null;
  /** Why the newest recap attempt failed, for the message it was about. */
  recap_failure?: RecapFailure | null;
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
/** The daemon's reasons a recap was not written (recap_linux.go). */
export const recapFailureReasons = [
  "no_message",
  "no_model",
  "model_error",
  "model_timeout",
  "model_incomplete",
  "invalid_response",
  "superseded",
  "busy",
  "write_failed",
  "history_unavailable",
  "command_unavailable",
  "controller_unavailable",
  "outcome_unknown",
  "not_written",
] as const;
export type RecapFailureReason = (typeof recapFailureReasons)[number];
export type RecapFailure = {
  reason: RecapFailureReason;
  through: string;
  trigger: "automatic" | "manual";
};
const recapFailureReason = (v: unknown): v is RecapFailureReason =>
  (recapFailureReasons as readonly unknown[]).includes(v);
export type BashStatus = {
  command_id: string;
  command: string;
  exclude_from_context: boolean;
  state:
    | "held"
    | "running"
    | "finished"
    | "cancelled"
    | "failed"
    | "not_started"
    | "uncertain";
  exit_code?: number;
  truncated: boolean;
  started_at?: string;
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
/** A definite refusal: nothing was written. `code` is the host's fixed
 * error code, or "" when the reply did not carry one. */
export class NotAdmitted extends Error {
  constructor(readonly code = "") {
    super("state changed");
  }
}
export class ConversationNotFound extends Error {}
export type ContinueRefusal =
  | "writer_conflict"
  | "read_only_history"
  | "control_uncertain"
  | "history_damaged"
  | "quota_full"
  | "storage_full"
  | "capacity_exceeded";
export class ContinuationRefused extends Error {
  constructor(readonly code: ContinueRefusal) {
    super(code);
  }
}
async function json(response: Response): Promise<unknown> {
  if (response.status === 401) throw new Error("identity_lost");
  if (response.status === 404) throw new ConversationNotFound("not found");
  if (response.status === 409)
    throw new NotAdmitted(await refusalCode(response));
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("unavailable");
  return readBody(response);
}
async function refusalCode(response: Response) {
  try {
    const v = await readBody(response);
    const code = object(v) && object(v.error) ? v.error.code : undefined;
    return typeof code === "string" && /^[a-z_]{1,64}$/.test(code) ? code : "";
  } catch {
    return "";
  }
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
// Writes are named by their path: one command per control endpoint.
const writeCommands: [RegExp, MutationCommand][] = [
  [/\/question$/, "conversation.question"],
  [/\/recap$/, "conversation.recap"],
  [/\/presence$/, "conversation.presence"],
  [/\/(regenerate_title|history_title)$/, "conversation.title"],
  [/\/name$/, "conversation.name"],
  [/\/send$/, "conversation.send"],
  [/\/(steer|follow_up)$/, "conversation.queue"],
  [/\/cancel_held$/, "conversation.cancel_held"],
  [/\/clear_queue$/, "conversation.clear_queue"],
  [/\/abort$/, "conversation.abort"],
  [/\/bash$/, "conversation.bash"],
  [/\/abort_bash$/, "conversation.abort_bash"],
  [/\/stop$/, "conversation.stop"],
  [/^\/api\/v1\/conversations$/, "conversation.create"],
];
async function request(
  path: string,
  signal?: AbortSignal,
  body?: object,
  csrf?: string,
) {
  let response: Response;
  if (body || csrf) {
    const command = writeCommands.find(([pattern]) => pattern.test(path))?.[1];
    if (!command || !csrf) throw new Error("unknown write");
    response = await jsonWrite(command, path, body, csrf, { signal });
  } else
    response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      signal,
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
// A recap describes the native branch only up to the message it was made
// through. A later message or a running turn makes it a description of the
// past, so it is not shown as the current situation; the daemon writes a new
// one once the conversation has been idle (Jari 25.10.2026).
export function currentRecap(
  recap: Recap | null,
  latest: string,
  running = false,
): Recap | null {
  return recap && !running && recap.through === latest ? recap : null;
}
/** Whether Pi may be taking a turn that outdates the recap. A resting,
 * starting or stopping Pi is not: its recap stays current, and a stopped
 * conversation is exactly where the person returns to read it (Jari
 * 29.10.2026). An uncertain controller may still be running a turn. */
export function turnUnderway(state?: string, runActive?: boolean): boolean {
  return (
    runActive === true ||
    state === "pending" ||
    state === "accepted" ||
    state === "uncertain"
  );
}
export type RecapRead = {
  recap: Recap | null;
  latest_message: string;
  // The native time of latest_message: the recap card counts from it, not
  // from when the recap was written (Jari 27.10.2026).
  latest_message_at: string | null;
};
export async function readRecap(id: string): Promise<RecapRead> {
  const reply = await request(
    `/api/v1/agents/${encodeURIComponent(id).replace("%3A", ":")}/recap`,
  );
  if (!recapValidator.getSchema(recapSchema.$id)(reply))
    throw new Error("invalid recap");
  const result = reply as RecapRead;
  return {
    recap: result.recap,
    latest_message: result.latest_message,
    latest_message_at: result.latest_message_at,
  };
}
/** The daemon answered that no recap was written, and why. */
export class RecapGenerationFailed extends Error {
  constructor(readonly reason: RecapFailureReason | undefined) {
    super("recap generation failed");
  }
}
export async function requestRecap(id: string, csrf: string): Promise<void> {
  const reply = await request(`${path(id)}/recap`, undefined, undefined, csrf);
  if (object(reply) && reply.schema_version === 1 && reply.state === "done")
    return;
  throw new RecapGenerationFailed(
    object(reply) && recapFailureReason(reply.reason)
      ? reply.reason
      : undefined,
  );
}
/** Tells the daemon the person is writing or reading here, which postpones
 * its automatic recap. Nothing depends on the answer. */
export async function notePresence(id: string, csrf: string): Promise<void> {
  await request(`${path(id)}/presence`, undefined, undefined, csrf);
}
export class TitleGenerationFailed extends Error {
  constructor(readonly reason: string) {
    super("title generation failed");
  }
}
export function titleReply(reply: unknown): void {
  if (object(reply) && reply.schema_version === 1) {
    if (reply.state === "done") return;
    if (
      reply.state === "failed" &&
      typeof reply.reason === "string" &&
      [
        "model_unavailable",
        "model_timeout",
        "model_invalid_response",
        "native_name_unavailable",
        "native_name_changed",
        "controller_unavailable",
        "name_write_failed",
      ].includes(reply.reason)
    )
      throw new TitleGenerationFailed(reply.reason);
  }
  throw new Error("invalid title reply");
}

export async function regenerateTitle(id: string, csrf: string): Promise<void> {
  const reply = await request(
    `${path(id)}/regenerate_title`,
    undefined,
    undefined,
    csrf,
  );
  titleReply(reply);
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
  titleReply(reply);
}

/**
 * Name a conversation by hand. Pi records it as the session's native name,
 * so it is the title everywhere and no automatic title replaces it. A Pi
 * still starting writes it once ready ("held").
 */
export async function renameConversation(
  id: string,
  workspace: string,
  name: string,
  csrf: string,
): Promise<"done" | "held"> {
  if (!ws.test(workspace)) throw new Error("invalid workspace");
  if (!name || conversationName(name) !== name) throw new Error("invalid name");
  const reply = await request(
    `${path(id)}/name`,
    undefined,
    { workspace_id: workspace, name },
    csrf,
  );
  return nameReply(reply).state;
}

export function nameReply(reply: unknown): {
  state: "done" | "held";
  event_cursor?: string;
} {
  if (!object(reply) || reply.schema_version !== 1)
    throw new Error("invalid name reply");
  if (reply.state !== "held") titleReply(reply);
  if (
    reply.event_cursor !== undefined &&
    reply.event_cursor !== "" &&
    !(typeof reply.event_cursor === "string" && cursor.test(reply.event_cursor))
  )
    throw new Error("invalid name cursor");
  return {
    state: reply.state as "done" | "held",
    event_cursor: reply.event_cursor as string | undefined,
  };
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
  newWorktree?: string,
  name?: string,
): Promise<Session | undefined> {
  if (!stillCurrent()) return;
  const attempt = crypto.randomUUID();
  sessionStorage.setItem(uncertainKey, `create:${attempt}`);
  pendingCreations.add(uncertainKey);
  try {
    const result = await create(workspace, csrf, choice, newWorktree, name);
    if (!stillCurrent()) return;
    sessionStorage.removeItem(uncertainKey);
    return result;
  } catch (error) {
    // The host said no: nothing was created, so nothing is uncertain.
    if (error instanceof WriteRefused && stillCurrent())
      sessionStorage.removeItem(uncertainKey);
    throw error;
  } finally {
    pendingCreations.delete(uncertainKey);
  }
}

export async function create(
  workspace: string,
  csrf: string,
  choice?: {
    provider?: PiProvider;
    model: string;
    thinking?: string;
  },
  newWorktree?: string,
  /** The conversation's name from the start, such as a goal's. */
  name?: string,
): Promise<Session> {
  if (!ws.test(workspace)) throw new Error("invalid workspace");
  if (name !== undefined && (!name || conversationName(name) !== name))
    throw new Error("invalid name");
  if (newWorktree !== undefined && !worktreeName.test(newWorktree))
    throw new Error("invalid worktree name");
  let response: Response | undefined;
  try {
    response = await jsonWrite(
      "conversation.create",
      base,
      {
        workspace_id: workspace,
        ...choice,
        ...(newWorktree !== undefined
          ? { new_worktree: { name: newWorktree } }
          : {}),
        ...(name !== undefined ? { name } : {}),
      },
      csrf,
    );
  } catch {
    response = undefined;
  }
  // A typed 4xx such as 429 capacity_exceeded is a definite "not created";
  // only a lost reply or a 5xx may have created something.
  const outcome = await writeOutcome(response);
  if (outcome.kind === "login") throw new Error("identity_lost");
  if (outcome.kind === "refused")
    throw new WriteRefused(outcome.status, outcome.code);
  if (outcome.kind === "uncertain") throw new Error("unavailable");
  const v = await json(outcome.response);
  if (
    !object(v) ||
    v.schema_version !== 1 ||
    !session(v) ||
    (v.run_active !== undefined && typeof v.run_active !== "boolean") ||
    (newWorktree === undefined
      ? v.workspace_id !== workspace || v.worktree_of !== undefined
      : v.worktree_of !== workspace || v.workspace_id === workspace) ||
    (v.state !== "starting" && v.state !== "idle")
  )
    throw new Error("invalid create");
  return v;
}

const worktreeName = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** The name a worktree agent's branch and directory start from: the first
 * words of its first message. The daemon makes it unique. */
export function worktreeNameFrom(text: string): string {
  const words = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  let name = "";
  for (const word of words.slice(0, 4)) {
    const next = name ? `${name}-${word}` : word;
    if (next.length > 40) break;
    name = next;
  }
  if (!name && words[0]) name = words[0].slice(0, 40);
  return worktreeName.test(name) ? name : "agentti";
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
    ![
      "eligible",
      "writer_present",
      "read_only_history",
      "history_damaged",
      "unproven",
    ].includes(String(v.continuation))
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
    ![
      "eligible",
      "writer_present",
      "read_only_history",
      "history_damaged",
      "unproven",
    ].includes(String(v.continuation)) ||
    (v.journal_cursor !== undefined &&
      v.journal_cursor !== "" &&
      (typeof v.journal_cursor !== "string" ||
        !/^ev1:[0-9a-fA-F-]{36}:(0|[1-9][0-9]*)$/.test(v.journal_cursor))) ||
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
    (v.bash !== undefined && !validBashStatus(v.bash)) ||
    (v.interrupted !== undefined && typeof v.interrupted !== "boolean") ||
    (v.recap_failure != null &&
      (!object(v.recap_failure) ||
        !recapFailureReason(v.recap_failure.reason) ||
        typeof v.recap_failure.through !== "string" ||
        v.recap_failure.through.length > 128 ||
        !["automatic", "manual"].includes(String(v.recap_failure.trigger)))) ||
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
    !heldValidator.getSchema(heldSchema.$id)(v) ||
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
  const response = await mutationFetch(
    "conversation.continue",
    `${path(id)}/continue`,
    {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "X-Agent-Host-CSRF": csrf, Origin: window.location.origin },
    },
  );
  if (
    response.status === 409 ||
    response.status === 429 ||
    response.status === 507
  ) {
    const error = await readJSON(response);
    if (
      object(error) &&
      error.schema_version === 1 &&
      object(error.error) &&
      ((response.status === 409 &&
        [
          "writer_conflict",
          "read_only_history",
          "control_uncertain",
          "history_damaged",
        ].includes(String(error.error.code))) ||
        (response.status === 429 && error.error.code === "capacity_exceeded") ||
        (response.status === 507 &&
          ["quota_full", "storage_full"].includes(String(error.error.code))))
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
    // A wake is idempotent: an already running Pi is the answer.
    (v.state !== "starting" && v.state !== "idle" && v.state !== "running") ||
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
  await readCloseResult(await sendCloseEmpty(id, csrf));
}
export function sendCloseEmpty(
  id: string,
  csrf: string,
  signal?: AbortSignal,
): Promise<Response> {
  return jsonWrite(
    "conversation.close_empty",
    `${path(id)}/close`,
    undefined,
    csrf,
    { signal },
  );
}
export async function readCloseResult(
  response: Response,
): Promise<{ event_cursor?: string }> {
  const v = await json(response);
  if (
    !object(v) ||
    v.schema_version !== 1 ||
    v.state !== "closed" ||
    (v.event_cursor !== undefined &&
      !(typeof v.event_cursor === "string" && cursor.test(v.event_cursor)))
  )
    throw new Error("invalid close result");
  return { event_cursor: v.event_cursor as string | undefined };
}

export async function stop(id: string, csrf: string) {
  const v = await request(`${path(id)}/stop`, undefined, undefined, csrf);
  if (!object(v) || v.schema_version !== 1 || v.state !== "termination_unknown")
    throw new Error("invalid stop");
}

/** Relay a typed `!` (or `!!`, exclude) command to the conversation's Pi.
 * held: Pi is not running; the command runs once the Pi this starts is ready. */
export async function runBash(
  id: string,
  command: string,
  excludeFromContext: boolean,
  commandId: string,
  csrf: string,
): Promise<"running" | "held"> {
  if (
    !command.trim() ||
    new TextEncoder().encode(command).length > 8192 ||
    !uuid.test(commandId)
  )
    throw new Error("invalid command");
  const v = await request(
    `${path(id)}/bash`,
    undefined,
    {
      command,
      command_id: commandId,
      exclude_from_context: excludeFromContext,
    },
    csrf,
  );
  if (
    !validBashReply(v) ||
    (v as { command_id: string }).command_id !== commandId ||
    (v as { state: string }).state === "accepted"
  )
    throw new Error("invalid bash");
  return (v as { state: "running" | "held" }).state;
}
/** Stop the conversation's `!` command; Pi's turn is not touched. */
export async function abortBash(id: string, commandId: string, csrf: string) {
  if (!uuid.test(commandId)) throw new Error("invalid command");
  const v = await request(
    `${path(id)}/abort_bash`,
    undefined,
    { command_id: commandId },
    csrf,
  );
  if (
    !validBashReply(v) ||
    (v as { command_id: string }).command_id !== commandId ||
    (v as { state: string }).state !== "accepted"
  )
    throw new Error("invalid abort");
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
/** Takes Pi's queued messages back. A Stop also asks for the queued messages
 * Pi delivered that the model has not answered yet: the stopped turn never
 * will, so they go back to the person too. */
export async function clearQueue(
  id: string,
  commandId: string,
  csrf: string,
  stop = false,
): Promise<{ steering: string[]; follow_up: string[]; unanswered: string[] }> {
  if (!uuid.test(commandId)) throw new Error("invalid command");
  const v = await request(
    `${path(id)}/clear_queue`,
    undefined,
    stop
      ? { command_id: commandId, unanswered: true }
      : { command_id: commandId },
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
  const unanswered = stop ? v.unanswered : [];
  if (
    !Array.isArray(q.steering) ||
    !Array.isArray(q.follow_up) ||
    !Array.isArray(unanswered) ||
    q.steering.length + q.follow_up.length > 128 ||
    unanswered.length > 128 ||
    ![...q.steering, ...q.follow_up, ...unanswered].every(
      (t: unknown) =>
        typeof t === "string" && new TextEncoder().encode(t).length <= 65536,
    )
  )
    throw new Error("invalid clear");
  return {
    steering: q.steering as string[],
    follow_up: q.follow_up as string[],
    unanswered: unanswered as string[],
  };
}

// Annotation writes are never retried automatically after a lost reply. The
// reply carries the new archive fact and its journal position (ADR 0023).
export function sendArchive(
  id: string,
  workspace: string,
  observation: string,
  archived: boolean,
  csrf: string,
  commandId: string,
  signal?: AbortSignal,
): Promise<Response> {
  if (!agent.test(id) || !ws.test(workspace) || !observation)
    throw new Error("invalid archive target");
  return jsonWrite(
    "conversation.archive",
    "/api/v1/workspaces",
    {
      action: "conversation_archive",
      agent_id: id,
      workspace_id: workspace,
      observation_token: observation,
      archived,
      // The button names the transition, so the prior state is its opposite;
      // a queued restore after an archive is checked against that archive.
      previous_archive: archived ? "active" : "archived",
      client_command_id: commandId,
    },
    csrf,
    { signal },
  );
}
const cursor = /^ev1:[0-9a-fA-F-]{36}:[0-9]+$/;
export async function readArchiveResult(
  response: Response,
  id: string,
  archived: boolean,
  commandId: string,
): Promise<{ archive: "active" | "archived"; event_cursor?: string }> {
  const value = await json(response);
  if (
    !object(value) ||
    value.schema_version !== 1 ||
    value.agent_id !== id ||
    value.archive !== (archived ? "archived" : "active") ||
    (value.client_command_id !== undefined &&
      value.client_command_id !== commandId) ||
    (value.event_cursor !== undefined &&
      !(
        typeof value.event_cursor === "string" &&
        cursor.test(value.event_cursor)
      ))
  )
    throw new Error("invalid archive result");
  return {
    archive: value.archive as "active" | "archived",
    event_cursor: value.event_cursor as string | undefined,
  };
}
