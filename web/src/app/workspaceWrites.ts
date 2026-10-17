import { jsonWrite, type MutationCommand } from "./mutations";
import { validWorkspaceResult } from "./snapshot";
import type { HostChange } from "./store";

export type WorkspaceChange = (HostChange & { kind: "workspace" })["change"];
export type WorkspaceResult = {
  schema_version: 1;
  workspace_id: string;
  state: "created" | "updated";
  client_command_id?: string;
  workspace?: WorkspaceChange;
  event_cursor?: string;
};

/** Sends one `POST /api/v1/workspaces` command with its client command id. */
export function sendWorkspace(
  command: MutationCommand,
  input: Record<string, unknown>,
  csrf: string,
  commandId?: string,
  signal?: AbortSignal,
): Promise<Response> {
  return jsonWrite(
    command,
    "/api/v1/workspaces",
    commandId ? { ...input, client_command_id: commandId } : input,
    csrf,
    { signal },
  );
}

/** A reply that does not validate, or answers another command, is not a
 * confirmation: the caller treats it as uncertain. */
export async function readWorkspaceResult(
  response: Response,
  commandId?: string,
): Promise<WorkspaceResult> {
  if (
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("unreadable reply");
  const text = await response.text();
  if (text.length > 8192) throw new Error("unreadable reply");
  const value: unknown = JSON.parse(text);
  if (!validWorkspaceResult?.(value)) throw new Error("invalid reply");
  const result = value as WorkspaceResult;
  if (commandId && result.client_command_id !== commandId)
    throw new Error("reply for another command");
  return result;
}

/** The change a reply carried, ready for `hostChanged`. */
export const workspaceChange = (
  result: WorkspaceResult,
): HostChange | undefined =>
  result.workspace
    ? {
        kind: "workspace",
        change: result.workspace,
        cursor: result.event_cursor,
      }
    : undefined;
