import schema from "../../../contracts/v1/agent-instructions.schema.json";
import { LazyAjv } from "./lazyAjv";
import { jsonWrite, writeOutcome } from "./mutations";
import { readJSON } from "./readJSON";

// The person's own agent instructions, ~/.pi/agent/AGENTS.md, read and
// written by their daemon as them (contracts/v1/agent-instructions.schema.json).
// Nothing here keeps a copy: every view reads the file, and a save names the
// version it started from, so a change made meanwhile (an agent in another
// conversation, another tab) is refused and merged in the browser.

export type ClaudeReads = "imports" | "own" | "none" | "unknown";
export type AgentInstructions = {
  exists: boolean;
  /** The version a save must name; null while the file is absent. */
  version: string | null;
  content: string;
  modified: string | null;
  claude: ClaudeReads;
};

type Reply = AgentInstructions & {
  schema_version: 1;
  web_identity_id: string;
};
const validate = new LazyAjv({ strict: false }).compile<Reply>(schema);
const url = "/api/v1/account/agent-instructions";
// 256 KiB of text JSON-escaped, with room for the envelope.
const replyLimit = 2 << 20;

export class InstructionsError extends Error {
  constructor(
    /** file_unsupported, file_too_large, unavailable or login. */
    readonly code: string,
  ) {
    super(code);
  }
}

function of(value: unknown, identity?: string): AgentInstructions {
  if (!validate(value)) throw new InstructionsError("unavailable");
  const reply = value as Reply;
  if (identity && reply.web_identity_id !== identity)
    throw new InstructionsError("unavailable");
  const { exists, version, content, modified, claude } = reply;
  return { exists, version, content, modified, claude };
}

export async function readAgentInstructions(
  signal?: AbortSignal,
  identity?: string,
): Promise<AgentInstructions> {
  let response: Response;
  try {
    response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new InstructionsError("unavailable");
  }
  if (response.status === 401) throw new InstructionsError("login");
  if (response.status === 413) throw new InstructionsError("file_too_large");
  if (response.status === 415) throw new InstructionsError("file_unsupported");
  if (!response.ok) throw new InstructionsError("unavailable");
  return of(await readJSON(response, replyLimit).catch(() => null), identity);
}

/** What a save came to. `changed`: the file is no longer the one the page
 * started from and nothing was written. `uncertain`: the answer was lost and
 * the file may or may not hold the text; it is never sent again by itself. */
export type SaveOutcome =
  | { kind: "saved"; file: AgentInstructions }
  | { kind: "changed" }
  | { kind: "refused"; code: string }
  | { kind: "uncertain" }
  | { kind: "login" };

export async function saveAgentInstructions(
  csrf: string,
  content: string,
  base: string | null,
): Promise<SaveOutcome> {
  const body =
    base === null ? { create: true, content } : { base_version: base, content };
  let response: Response | undefined;
  try {
    response = await jsonWrite("account.agent_instructions", url, body, csrf, {
      method: "PUT",
    });
  } catch {
    response = undefined;
  }
  const outcome = await writeOutcome(response);
  if (outcome.kind === "login") return { kind: "login" };
  if (outcome.kind === "uncertain") return { kind: "uncertain" };
  if (outcome.kind === "refused")
    return outcome.code === "file_changed"
      ? { kind: "changed" }
      : { kind: "refused", code: outcome.code };
  try {
    return {
      kind: "saved",
      file: of(await readJSON(outcome.response, replyLimit)),
    };
  } catch {
    return { kind: "uncertain" };
  }
}
