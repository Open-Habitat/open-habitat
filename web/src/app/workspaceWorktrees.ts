import Ajv from "ajv/dist/2020.js";
import common from "../../../contracts/v1/common.schema.json";
import schema from "../../../contracts/v1/workspace-worktrees.schema.json";
import { mutationFetch } from "./mutations";
import { readBounded, WorkspaceTrashError } from "./workspaceTrash";

// Worktree cleanup (ADR 0025). The host lists the linked worktrees of the
// person's Git workspaces from Git's registry and removes one with the
// Trash's safety rules. Replies are validated against the contract; the
// browser names a worktree by workspace ID, registry entry and the token of
// the listing it showed, never by a path.
const ajv = new Ajv({ strict: false });
ajv.addSchema(common);
const validate = ajv.compile(schema);

export type WorktreeBlocker = {
  kind:
    | "pi_session"
    | "process"
    | "taskfleet_run"
    | "contains_linked_worktree"
    | "nested_repository"
    | "mount"
    | "outside_home"
    | "last_workspace"
    | "unknown";
  check?: "processes" | "taskfleet" | "worktrees" | "mounts" | "workspaces";
  agent_id?: string;
  pid?: number;
  comm?: string;
  run_id?: string;
  path?: string;
};
export type WorktreeDisposal = "remove" | "commit" | "force" | "prune";
export type Worktree = {
  workspace_id: string;
  workspace_name: string;
  entry: string;
  name: string;
  /** Absent when the registry entry could not be read. */
  path?: string;
  state: "merged" | "unmerged" | "dirty" | "missing" | "locked" | "unknown";
  branch?: string;
  head?: string;
  base?: string;
  ahead?: number;
  changed: number;
  untracked: number;
  ignored: number;
  ignored_paths: string[];
  unreachable_head: boolean;
  locked_reason?: string;
  conversations?: number;
  size_bytes?: number;
  size_complete?: boolean;
  blockers: WorktreeBlocker[];
  actions: WorktreeDisposal[];
  observation_token: string;
};
export type WorktreeList = {
  schema_version: 1;
  state: "listed";
  workspace_id?: string;
  worktrees: Worktree[];
  truncated: boolean;
  complete: boolean;
  listing_token: string;
};
export type WorktreeRemoveResult = {
  schema_version: 1;
  state: "removed" | "pruned" | "blocked" | "partial";
  workspace_id: string;
  entry: string;
  branch?: string;
  branch_deleted?: true;
  branch_kept?: "not_merged" | "moved" | "checked_out";
  committed?: string;
  blockers?: WorktreeBlocker[];
  remaining?: number;
};
export type WorktreeCleanResult = {
  schema_version: 1;
  state: "cleaned";
  removed: number;
  kept: {
    workspace_id: string;
    entry: string;
    state: "blocked" | "partial" | "changed";
    blockers?: WorktreeBlocker[];
    remaining?: number;
  }[];
  branches_kept: {
    workspace_id: string;
    entry: string;
    branch: string;
    reason: "moved" | "checked_out" | "not_merged";
  }[];
};

export const worktreeRefusalCodes = [
  "workspace_busy",
  "workspace_changed",
  "workspace_missing",
  "workspace_uncertain",
  "worktree_missing",
  "worktree_changed",
  "worktrees_changed",
  "confirmation_mismatch",
  "commit_failed",
] as const;
const refusals = new Set<string>(worktreeRefusalCodes);

async function post(
  body: Record<string, unknown>,
  csrf: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await mutationFetch(
    "workspace.worktree",
    "/api/v1/workspaces",
    {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal,
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Host-CSRF": csrf,
        Origin: window.location.origin,
      },
      body: JSON.stringify(body),
    },
  );
  if (response.status === 401) throw new WorkspaceTrashError("identity_lost");
  const value = await readBounded(response);
  if (!response.ok) {
    const code =
      response.status === 409 &&
      value &&
      typeof value === "object" &&
      "error" in value &&
      value.error &&
      typeof value.error === "object" &&
      "code" in value.error &&
      typeof value.error.code === "string" &&
      refusals.has(value.error.code)
        ? value.error.code
        : "unavailable";
    throw new WorkspaceTrashError(code);
  }
  if (!validate(value)) throw new WorkspaceTrashError("invalid_reply");
  return value;
}

const stateOf = (value: unknown) =>
  value && typeof value === "object" && "state" in value
    ? value.state
    : undefined;

/** One workspace's worktrees, or every Git workspace's without an ID. */
export async function listWorktrees(
  csrf: string,
  workspaceId?: string,
  signal?: AbortSignal,
): Promise<WorktreeList> {
  const value = await post(
    workspaceId
      ? { action: "worktree_list", workspace_id: workspaceId }
      : { action: "worktree_list" },
    csrf,
    signal,
  );
  if (
    stateOf(value) !== "listed" ||
    (value as WorktreeList).workspace_id !== workspaceId
  )
    throw new WorkspaceTrashError("invalid_reply");
  return value as WorktreeList;
}

/** confirmation is the name the person typed, for force only. */
export async function removeWorktree(
  worktree: Pick<
    Worktree,
    "workspace_id" | "entry" | "observation_token" | "name"
  >,
  disposal: WorktreeDisposal,
  csrf: string,
  confirmation?: string,
): Promise<WorktreeRemoveResult> {
  const value = await post(
    {
      action: "worktree_remove",
      workspace_id: worktree.workspace_id,
      entry: worktree.entry,
      observation_token: worktree.observation_token,
      disposal,
      ...(disposal === "force" ? { confirmation } : {}),
    },
    csrf,
  );
  const result = value as WorktreeRemoveResult;
  if (
    !["removed", "pruned", "blocked", "partial"].includes(
      String(stateOf(value)),
    ) ||
    result.entry !== worktree.entry ||
    result.workspace_id !== worktree.workspace_id
  )
    throw new WorkspaceTrashError("invalid_reply");
  return result;
}

/** Removes the merged worktrees of exactly the listing the person saw. */
export async function cleanMergedWorktrees(
  listing: Pick<WorktreeList, "listing_token" | "workspace_id">,
  csrf: string,
): Promise<WorktreeCleanResult> {
  const value = await post(
    {
      action: "worktree_clean_merged",
      listing_token: listing.listing_token,
      ...(listing.workspace_id ? { workspace_id: listing.workspace_id } : {}),
    },
    csrf,
  );
  if (stateOf(value) !== "cleaned")
    throw new WorkspaceTrashError("invalid_reply");
  return value as WorktreeCleanResult;
}
