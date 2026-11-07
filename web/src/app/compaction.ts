import common from "../../../contracts/v1/common.schema.json";
import schema from "../../../contracts/v1/compaction.schema.json";
import { continueConversation, status } from "./conversations";
import { LazyAjv } from "./lazyAjv";
import { jsonWrite, writeOutcome } from "./mutations";

// Tiivistä nyt (experimental, the context page): the browser's one write
// asks the daemon to send Pi's own RPC compact with the person's
// instructions (contracts/v1/compaction.schema.json).

const ajv = new LazyAjv({ strict: false, addFormats: true });
ajv.addSchema(common);
ajv.addSchema(schema);
const validResult = ajv.compile<CompactionResult>({
  $ref: `${schema.$id}#/$defs/result`,
});

export type CompactionResult = {
  schema_version: 1;
  agent_id: string;
  state: "done";
  tokens_before: number;
  estimated_tokens_after: number;
};

/** Why nothing was compacted; `uncertain` means Pi may have compacted. */
export type CompactionRefusal =
  | "already_compacted"
  | "nothing_to_compact"
  | "turn_running"
  | "compacting"
  | "cancelled"
  | "compaction_failed"
  | "unavailable";
export class CompactionFailed extends Error {
  constructor(
    readonly reason: CompactionRefusal | "uncertain" | "login" | "stopped",
  ) {
    super(`compaction ${reason}`);
  }
}
const refusals = new Set<string>([
  "already_compacted",
  "nothing_to_compact",
  "turn_running",
  "compacting",
  "cancelled",
  "compaction_failed",
]);

const agent = /^pi:[0-9a-fA-F-]{36}$/;

/** The one write. A lost answer is uncertain and never sent again. */
export async function sendCompaction(
  id: string,
  instructions: string,
  csrf: string,
): Promise<CompactionResult> {
  if (!agent.test(id)) throw new CompactionFailed("unavailable");
  let response: Response | undefined;
  try {
    response = await jsonWrite(
      "conversation.compact",
      `/api/v1/conversations/${id.slice(3)}/compact`,
      instructions.trim() ? { instructions: instructions.trim() } : {},
      csrf,
    );
  } catch {
    response = undefined;
  }
  const outcome = await writeOutcome(response);
  if (outcome.kind === "login") throw new CompactionFailed("login");
  if (outcome.kind === "refused")
    throw new CompactionFailed(
      refusals.has(outcome.code)
        ? (outcome.code as CompactionRefusal)
        : outcome.code === "resource_not_found"
          ? "stopped"
          : "unavailable",
    );
  if (outcome.kind !== "ok") throw new CompactionFailed("uncertain");
  let value: unknown;
  try {
    value = await outcome.response.json();
  } catch {
    throw new CompactionFailed("uncertain");
  }
  if (!validResult(value) || value.agent_id !== id)
    throw new CompactionFailed("uncertain");
  return value;
}

/** Pi must run for it to compact. The wake is the one typing starts; the
 * write follows once Pi is idle. */
async function wake(id: string, workspace: string, csrf: string) {
  const conversation = id.slice(3);
  await continueConversation(conversation, workspace, csrf);
  const until = Date.now() + 20000;
  while (Date.now() < until) {
    const now = await status(conversation);
    if (now.state === "idle") return;
    if (now.state === "start_failed" || now.state === "stopped") break;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new CompactionFailed("unavailable");
}

/** Compacts a conversation, waking its Pi first when it rests. */
export async function compactConversation(
  id: string,
  instructions: string,
  csrf: string,
  workspace: string,
  stopped: boolean,
): Promise<CompactionResult> {
  try {
    if (stopped) await wake(id, workspace, csrf);
    try {
      return await sendCompaction(id, instructions, csrf);
    } catch (e) {
      // A definite refusal wrote nothing: Pi was not running after all.
      if (!(e instanceof CompactionFailed) || e.reason !== "stopped" || stopped)
        throw e;
      await wake(id, workspace, csrf);
      return await sendCompaction(id, instructions, csrf);
    }
  } catch (e) {
    if (e instanceof CompactionFailed) throw e;
    if ((e as Error)?.message === "identity_lost")
      throw new CompactionFailed("login");
    // The wake was refused or did not finish; nothing was asked of Pi.
    throw new CompactionFailed("unavailable");
  }
}
