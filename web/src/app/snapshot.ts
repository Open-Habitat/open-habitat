import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
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
import viewSchema from "../../../contracts/v1/view.schema.json";
import workspaceChange from "../../../contracts/v1/workspace-change.schema.json";
import type { GitSummaryFacts } from "../components/GitStatus";

const ajv = new Ajv({ strict: false, allErrors: false });
ajv.addSchema(processEventSchema);
ajv.addSchema(noticeSchema);
ajv.addSchema(viewSchema);
ajv.addSchema(fileOfferSchema);
ajv.addSchema(editorSchema);
addFormats(ajv);
for (const definition of [
  common,
  annotations,
  command,
  event,
  history,
  operation,
  schema,
  workspaceChange,
])
  ajv.addSchema(definition);
const validate = ajv.getSchema(schema.$id);
/** The reply of a workspace write, with the change it made (ADR 0023). */
export const validWorkspaceResult = ajv.getSchema(workspaceChange.$id);
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
export interface Agent {
  agent_id: string;
  workspace_id: string;
  /** The conversation runs in this worktree place of the workspace. */
  worktree_id?: string;
  started_at?: string;
  archive?: "active" | "archived" | "unknown";
  observation_token?: string;
  history: "readable" | "missing" | "corrupt" | "unavailable";
  process: string;
  control: string;
  title: {
    display: string;
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
  /** Pi rests and the agent has not been told what happened meanwhile. */
  rest?: import("../components/RestartNotice").RestStop;
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
  user_observation_token?: string;
  server_instance_id: string;
  identity: { web_identity_id: string; display_name: string };
  sources: Fact[];
  workspaces: Workspace[];
  agents: Agent[];
  write_state: string;
  auth?: {
    native_github: {
      state:
        | "connected"
        | "disconnected"
        | "expired"
        | "pending"
        | "partial"
        | "unknown";
      login?: string;
    };
  };
}
export function parseSnapshot(value: unknown): Snapshot {
  if (!validate?.(value)) throw new Error("invalid snapshot");
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
