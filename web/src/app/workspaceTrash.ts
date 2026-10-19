import Ajv from "ajv/dist/2020.js";
import common from "../../../contracts/v1/common.schema.json";
import schema from "../../../contracts/v1/workspace-deletion.schema.json";
import { mutationFetch } from "./mutations";
import type { Workspace } from "./snapshot";

// Workspace deletion and the Trash (ADR 0019). Every reply is validated
// against the contract before it reaches a view; the host names entries and
// workspaces by ID or entry name, never by a path the browser chose.
const ajv = new Ajv({ strict: false });
ajv.addSchema(common);
const validate = ajv.compile(schema);

/** Why a conversation blocks deletion; an idle one never does. */
export type PiActivity = "turn" | "question" | "processes" | "unknown";
export type DeletionBlocker = {
  kind:
    | "pi_session"
    | "process"
    | "taskfleet_run"
    | "linked_worktree"
    | "locked_worktree"
    | "is_linked_worktree"
    | "contains_linked_worktree"
    | "mount"
    | "different_filesystem"
    | "last_workspace"
    | "unknown";
  check?:
    | "processes"
    | "taskfleet"
    | "worktrees"
    | "mounts"
    | "trash"
    | "workspaces";
  agent_id?: string;
  /** For pi_session: what the busy conversation is doing. */
  activity?: PiActivity;
  pid?: number;
  comm?: string;
  run_id?: string;
  path?: string;
};
export type DeletionGit = {
  state: "observed" | "unknown";
  branch?: string;
  has_commits: boolean;
  remote_refs: boolean;
  changed: number;
  untracked: number;
  ignored: number;
  ignored_paths: string[];
  stash: number;
  unpushed: number;
  nested_repositories: number;
  fetched_at?: number;
};
export type DeletionFacts = {
  kind: "directory" | "git";
  git?: DeletionGit;
  conversations?: number;
  stale_worktrees: number;
  size_bytes: number;
  size_complete: boolean;
};
export type DeletionCheck = {
  schema_version: 1;
  state: "checked" | "blocked";
  workspace_id: string;
  observation_token: string;
  outcome: "blocked" | "trash" | "permanent";
  blockers: DeletionBlocker[];
  facts: DeletionFacts;
};
export type DeletionResult =
  | DeletionCheck
  | {
      schema_version: 1;
      state: "trashed" | "deleted" | "partial" | "replaced";
      workspace_id: string;
      entry?: string;
      kept_reason?: "changed_after_check" | "process_inside" | "fetch_failed";
      processes_inside?: { pid: number; comm?: string }[];
      remaining?: number;
    };
export type TrashEntry = {
  entry: string;
  kind: "workspace" | "unlabelled";
  name?: string;
  deleted_at?: string;
  restore: "available" | "name_taken" | "unavailable";
  conversations?: number;
  size_bytes?: number;
  size_complete?: boolean;
};
export type TrashList = {
  schema_version: 1;
  state: "listed";
  entries: TrashEntry[];
  truncated: boolean;
  listing_token: string;
};
export type TrashInspection = {
  schema_version: 1;
  state: "inspected";
  entry: TrashEntry;
  facts: DeletionFacts;
};
export type RestoreResult = {
  schema_version: 1;
  state: "restored" | "partial";
  workspace_id: string;
  name: string;
};
export type TrashDeleteResult = {
  schema_version: 1;
  state: "deleted" | "partial" | "blocked";
  entry: string;
  remaining?: number;
  blockers?: DeletionBlocker[];
};

export type TrashEmptyResult = {
  schema_version: 1;
  state: "emptied";
  deleted: number;
  kept: {
    entry: string;
    state: "blocked" | "partial" | "missing";
    remaining?: number;
    blockers?: DeletionBlocker[];
  }[];
};

// A refusal the host named. The code is one of a fixed set; the host's
// message text never reaches the view.
export const refusalCodes = [
  "workspace_busy",
  "workspace_changed",
  "workspace_missing",
  "workspace_uncertain",
  "workspace_not_clean",
  "workspace_exists",
  "workspace_partial",
  "trash_unavailable",
  "trash_entry_missing",
  "confirmation_mismatch",
  "trash_changed",
] as const;
const refusals = new Set<string>(refusalCodes);
export class WorkspaceTrashError extends Error {
  constructor(readonly code: string) {
    super("Työtilan poistoa ei voitu vahvistaa.");
  }
}

async function post(
  body: Record<string, unknown>,
  csrf: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await mutationFetch(
    "workspace.delete",
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

// The reply body under a 1 MiB cap, as JSON; shared with the worktree client.
export async function readBounded(response: Response): Promise<unknown> {
  if (
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new WorkspaceTrashError("unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new WorkspaceTrashError("unavailable");
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) {
        await reader.cancel();
        throw new WorkspaceTrashError("invalid_reply");
      }
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
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new WorkspaceTrashError("invalid_reply");
  }
}

function has(value: unknown, state: readonly string[]): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    "state" in value &&
    typeof value.state === "string" &&
    state.includes(value.state)
  );
}

// The checks deletion would run, without moving anything. The outcome says
// which of the three cases the confirmation shows.
export async function checkWorkspaceDeletion(
  workspace: Pick<Workspace, "workspace_id" | "observation_token">,
  csrf: string,
  signal?: AbortSignal,
): Promise<DeletionCheck> {
  const value = await post(
    {
      action: "delete_check",
      workspace_id: workspace.workspace_id,
      observation_token: workspace.observation_token,
    },
    csrf,
    signal,
  );
  if (
    !has(value, ["checked"]) ||
    (value as DeletionCheck).workspace_id !== workspace.workspace_id
  )
    throw new WorkspaceTrashError("invalid_reply");
  return value as DeletionCheck;
}

// Moves the workspace to the Trash, or removes it outright when disposal is
// permanent and the host verifies again that its remote holds everything.
// A blocked reply carries the blockers; nothing moved.
export async function deleteWorkspace(
  workspace: Pick<Workspace, "workspace_id" | "observation_token">,
  disposal: "trash" | "permanent",
  csrf: string,
): Promise<DeletionResult> {
  const value = await post(
    {
      action: "delete",
      workspace_id: workspace.workspace_id,
      observation_token: workspace.observation_token,
      disposal,
    },
    csrf,
  );
  if (
    !has(value, ["blocked", "trashed", "deleted", "partial", "replaced"]) ||
    (value as DeletionResult).workspace_id !== workspace.workspace_id
  )
    throw new WorkspaceTrashError("invalid_reply");
  return value as DeletionResult;
}

export async function listTrash(
  csrf: string,
  signal?: AbortSignal,
): Promise<TrashList> {
  const value = await post({ action: "trash_list" }, csrf, signal);
  if (!has(value, ["listed"])) throw new WorkspaceTrashError("invalid_reply");
  return value as TrashList;
}

export async function inspectTrashEntry(
  entry: string,
  csrf: string,
  signal?: AbortSignal,
): Promise<TrashInspection> {
  const value = await post({ action: "trash_inspect", entry }, csrf, signal);
  if (
    !has(value, ["inspected"]) ||
    (value as TrashInspection).entry.entry !== entry
  )
    throw new WorkspaceTrashError("invalid_reply");
  return value as TrashInspection;
}

export async function restoreTrashEntry(
  entry: string,
  csrf: string,
): Promise<RestoreResult> {
  const value = await post({ action: "trash_restore", entry }, csrf);
  if (!has(value, ["restored", "partial"]))
    throw new WorkspaceTrashError("invalid_reply");
  return value as RestoreResult;
}

// confirmation is the name the person typed: the entry's workspace name, or
// the entry name for a directory without one.
export async function deleteTrashEntry(
  entry: string,
  confirmation: string,
  csrf: string,
): Promise<TrashDeleteResult> {
  const value = await post(
    { action: "trash_delete", entry, confirmation },
    csrf,
  );
  if (
    !has(value, ["deleted", "partial", "blocked"]) ||
    (value as TrashDeleteResult).entry !== entry
  )
    throw new WorkspaceTrashError("invalid_reply");
  return value as TrashDeleteResult;
}

// Removes permanently exactly the entries of the listing the person
// confirmed; a Trash that changed since then is refused with trash_changed.
export async function emptyTrash(
  listing: Pick<TrashList, "listing_token">,
  csrf: string,
): Promise<TrashEmptyResult> {
  const value = await post(
    { action: "trash_empty", listing_token: listing.listing_token },
    csrf,
  );
  if (!has(value, ["emptied"])) throw new WorkspaceTrashError("invalid_reply");
  return value as TrashEmptyResult;
}
