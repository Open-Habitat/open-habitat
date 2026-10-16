import Ajv from "ajv/dist/2020.js";
import schema from "../../../contracts/v1/workspace-git.schema.json";

const validate = new Ajv({ strict: false }).compile(schema);
export type WorkspaceGit = {
  schema_version: 1;
  workspace_id: string;
  branch: string;
  dirty_count: number;
  files_truncated: boolean;
  commits_available: boolean;
  upstream?: string;
  ahead?: number;
  behind?: number;
  fetched_at?: number;
  files: { status: string; path: string; previous_path?: string }[];
  commits: {
    hash: string;
    subject: string;
    timestamp: number;
    pushed?: boolean;
  }[];
};
export async function workspaceGit(
  id: string,
  signal: AbortSignal,
): Promise<WorkspaceGit> {
  const response = await fetch(
    `/api/v1/workspaces/git?${new URLSearchParams({ workspace_id: id })}`,
    { signal, credentials: "same-origin", cache: "no-store" },
  );
  if (!response.ok) throw new Error("Git-tilaa ei voitu lukea.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Git-tilaa ei voitu lukea.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("Git-vastaus ylitti lukurajan.");
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
    offset += chunk.byteLength;
  }
  const value: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  );
  if (!validate(value) || (value as WorkspaceGit).workspace_id !== id)
    throw new Error("Git-tilaa ei voitu vahvistaa.");
  return value as WorkspaceGit;
}
