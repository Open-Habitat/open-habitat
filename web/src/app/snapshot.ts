import annotations from "../../../contracts/v1/annotations.schema.json";
import command from "../../../contracts/v1/command.schema.json";
import common from "../../../contracts/v1/common.schema.json";
import editorSchema from "../../../contracts/v1/editor.schema.json";
import event from "../../../contracts/v1/event.schema.json";
import fileOfferSchema from "../../../contracts/v1/file-offer.schema.json";
import history from "../../../contracts/v1/history.schema.json";
import noticeSchema from "../../../contracts/v1/notice.schema.json";
import operation from "../../../contracts/v1/operation.schema.json";
import processEventSchema from "../../../contracts/v1/process-event.schema.json";
import schema from "../../../contracts/v1/snapshot.schema.json";
import turnMark from "../../../contracts/v1/turn-mark.schema.json";
import viewSchema from "../../../contracts/v1/view.schema.json";
import workspaceChange from "../../../contracts/v1/workspace-change.schema.json";
import workspaceIconSuggestions from "../../../contracts/v1/workspace-icon-suggestions.schema.json";
import type { GitSummaryFacts } from "../components/GitStatus";
import type { AIProvider } from "./aiSignIn";
import { LazyAjv } from "./lazyAjv";

const ajv = new LazyAjv({ strict: false, allErrors: false, addFormats: true });
ajv.addSchema(processEventSchema);
ajv.addSchema(noticeSchema);
ajv.addSchema(viewSchema);
ajv.addSchema(fileOfferSchema);
ajv.addSchema(editorSchema);
for (const definition of [
  common,
  annotations,
  command,
  event,
  history,
  operation,
  schema,
  turnMark,
  workspaceChange,
  workspaceIconSuggestions,
])
  ajv.addSchema(definition);
const validate = ajv.getSchema(schema.$id);
/** The reply of a workspace write, with the change it made (ADR 0023). */
export const validWorkspaceResult = ajv.getSchema(workspaceChange.$id);
/** The answer of an icon suggestion request. */
export const validIconSuggestions = ajv.getSchema(workspaceIconSuggestions.$id);
export interface Fact {
  source: string;
  state: "confirmed" | "absent" | "unknown" | "unavailable" | "conflicting";
  observed_at: string;
}
export interface Workspace {
  workspace_id: string;
  path?: string;
  observation_token?: string;
  name: string;
  display_name?: string;
  /** The icon the daemon found in the repository: its .open-habitat.yaml
   * `icon`, else its logo. Absent: the browser derives a glyph. */
  icon?:
    | { kind: "emoji" | "letters"; source: "config"; value: string }
    | {
        kind: "image";
        source: "config" | "logo";
        path: string;
        version: string;
      };
  /** The config says `icon: auto`: the chain without it, no suggestions. */
  icon_auto?: true;
  /** The repository's logo whatever the config says, for the picker. */
  icon_logo?: { path: string; version: string };
  kind: string;
  git_remote?: "github" | "other" | "none" | "unknown";
  git_summary?: GitSummaryFacts & { github_repo?: string };
  /** The connected Gitea base and owner/name the daemon matched this main
   * checkout's origin to; absent for any other origin. */
  gitea_origin?: { base_url: string; full_name: string };
  /** The connected GitLab base and full project path the daemon matched
   * this main checkout's origin to; absent for any other origin. */
  gitlab_origin?: { base_url: string; full_name: string };
  publish_continuation?: boolean;
  /** Linked worktrees of a main checkout, each a place conversations run in
   * (ADR 0025). */
  worktrees?: WorktreePlace[];
  /** Browser-side only: this object stands for a worktree place of
   * `parent`, so a conversation there reads its own Git status. */
  place?: { parent: Workspace; worktree: WorktreePlace };
  visibility: string;
  mutation_state: string;
  presence: string;
  facts: Fact[];
}
export interface WorktreePlace {
  worktree_id: string;
  entry: string;
  name: string;
  path: string;
  branch?: string;
  git_summary?: GitSummaryFacts;
  /** Commits were made on the branch since it was created. */
  branch_moved?: boolean;
}
/** A worktree's work is merged when Git says its branch is in the base and
 * the branch has moved since it was made: a fresh branch is also "in the
 * base", but nothing was done on it yet. */
export function worktreeMerged(place: WorktreePlace | undefined) {
  const summary = place?.git_summary;
  return (
    !!summary?.base?.merged &&
    place?.branch_moved === true &&
    summary.dirty_count === 0
  );
}
/** The place a conversation runs in, standing in for its workspace. */
export function placeWorkspace(
  workspace: Workspace,
  worktree: WorktreePlace,
): Workspace {
  return {
    ...workspace,
    workspace_id: worktree.worktree_id,
    path: worktree.path,
    kind: "git_linked_worktree",
    git_summary: worktree.git_summary,
    worktrees: undefined,
    place: { parent: workspace, worktree },
  };
}
/** raised: Nosta at `at`. not_now: Ei nyt at `at` to the reply `reply_id`
 * (none when the conversation had no reply). */
export type TurnMark =
  | { state: "raised"; at: string }
  | { state: "not_now"; at: string; reply_id?: string };
export interface Agent {
  agent_id: string;
  workspace_id: string;
  /** The conversation runs in this worktree place of the workspace. */
  worktree_id?: string;
  started_at?: string;
  /** When the person archived it; only while archive is archived. */
  archived_at?: string;
  /** When the conversation last changed: its Pi session file's mtime. */
  changed_at?: string;
  /** The size of its Pi session file, read with changed_at. */
  native_bytes?: number;
  archive?: "active" | "archived" | "unknown";
  observation_token?: string;
  history: "readable" | "missing" | "corrupt" | "unavailable";
  process: string;
  control: string;
  title: {
    display: string;
    /** Where the title comes from; read the name through agentTitle(). */
    source?:
      | "new_conversation"
      | "first_message_fallback"
      | "generated"
      | "native_session";
    generation_state?:
      | "not_requested"
      | "pending"
      | "succeeded"
      | "failed"
      | "unknown";
  };
  live_tail: { kind: string }[];
  activity?: "idle" | "running" | "settling" | "unknown";
  pending_question?: unknown;
  run_active?: boolean;
  /** This conversation's own Taskfleet spinoffs working now, wait or no wait. */
  spinoffs_working?: number;
  /** Own spinoffs Taskfleet runs while their Pi waits at its prompt. */
  spinoffs_idle?: number;
  /** Pi rests and the agent has not been told what happened meanwhile. */
  rest?: import("../components/RestartNotice").RestStop;
  /** Resting, and its Pi stopped mid-turn (the native branch ends in work
   * the model never answered), for example in a daemon restart. */
  interrupted_turn?: true;
  /** The model's finished answer that ends the last turn, by native entry
   * ID; read while Pi runs or rests unarchived. */
  last_reply?: { id: string; at: string };
  /** The person's own Nosta or Ei nyt, kept by their daemon. */
  turn_mark?: TurnMark;
  /** The work ended in a failure nobody has acted on: the last reply ended
   * in an error (read while Pi runs), or an own Taskfleet run failed after
   * the conversation last changed. */
  failure?: "turn_error" | "worker_failed";
  waiting_on?: import("../components/agentPresentation").WaitingOn[];
  capabilities?: Record<string, { state: string; reason_code: string }>;
}
/** The browser started this conversation: it opens with a composer and its Pi
 * starts when the person sends. Terminal history stays read-only. */
export function browserOwned(
  agent: Pick<
    Agent,
    "agent_id" | "workspace_id" | "worktree_id" | "capabilities"
  >,
  sessions: { agent_id: string; workspace_id: string }[],
) {
  // A conversation in a worktree started under the place's own ID.
  const place = agent.worktree_id ?? agent.workspace_id;
  return (
    agent.capabilities?.agent_resume?.state === "supported" ||
    sessions.some(
      (s) => s.agent_id === agent.agent_id && s.workspace_id === place,
    )
  );
}
export interface Snapshot {
  schema_version: 1;
  snapshot_id?: string;
  event_cursor: string;
  /** Host time of the snapshot. */
  captured_at?: string;
  user_observation_token?: string;
  server_instance_id: string;
  identity: { web_identity_id: string; display_name: string };
  sources: Fact[];
  workspaces: Workspace[];
  agents: Agent[];
  write_state: string;
  auth?: {
    provider: "github" | "google";
    /** AI providers refusing the person's sign-in now (aiSignIn.ts). */
    ai_refused?: { provider: AIProvider; since: string }[];
    native_github: {
      state:
        | "connected"
        | "disconnected"
        | "expired"
        | "pending"
        | "partial"
        | "unknown"
        | "unreachable"
        | "verifying";
      reason?: "checking" | "timeout" | "github_error" | "unrecognized";
      login?: string;
      /** The token's OAuth scopes, only with state connected; null when
       * the host could not read them. */
      scopes?: string[] | null;
      retry?: {
        attempt: number;
        attempts: number;
        since: string;
        next_at: string;
      };
      restricted_orgs?: {
        owner: string;
        restriction: "oauth_app" | "saml";
      }[];
    };
  };
}
export function parseSnapshot(value: unknown): Snapshot {
  if (!validate(value)) throw new Error("invalid snapshot");
  return value as Snapshot;
}
export async function readSnapshot(response: Response): Promise<Snapshot> {
  // Cap even when Content-Length is missing or dishonest. Never expose response text.
  const reader = response.body?.getReader();
  if (!reader) throw new Error("missing snapshot body");
  let size = 0;
  const parts: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16 * 1024 * 1024) throw new Error("oversize snapshot");
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return parseSnapshot(
    JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    ) as unknown,
  );
}
export function sourceState(snapshot: Snapshot) {
  return (
    snapshot.sources.find((fact) => fact.source === "filesystem")?.state ??
    "unknown"
  );
}
