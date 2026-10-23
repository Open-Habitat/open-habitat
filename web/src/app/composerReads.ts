import {
  validCommandList,
  validFileList,
  validFilePreview,
  validStartPageReply,
} from "./composerContract";

// The composer's reads: Pi's own command list and the workspace's file names
// and one file's preview. Each read is made when the list opens; nothing is
// kept as a second copy of what Pi or the workspace says.

export type PiCommand = {
  name: string;
  description: string;
  source: "extension" | "prompt" | "skill";
  scope: "user" | "project" | "temporary" | "builtin";
  terminal_only: boolean;
};
export type StartGoal = {
  title: string;
  when: string;
  what: string;
  steps: string[];
  prompt: string;
  skill?: string;
};
export type StartPage =
  | { title: string; body: string; goals: StartGoal[] }
  | { state: "needs_update" };
export type CommandList = {
  start_page?: StartPage | null;
  answered_by: "running" | "helper";
  commands: PiCommand[];
};
export type GitMark =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "untracked"
  | "conflict";
export type WorkspaceFile = { path: string; git?: GitMark };
export type FileList = { files: WorkspaceFile[]; truncated: boolean };
export type FilePreview = {
  path: string;
  kind: "diff" | "text" | "binary";
  text: string;
  truncated: boolean;
};

export class ComposerReadFailed extends Error {}

async function read(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (response.status === 401) throw new Error("identity_lost");
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new ComposerReadFailed(String(response.status));
  const text = await response.text();
  if (text.length > 2 * 1024 * 1024) throw new ComposerReadFailed("size");
  return JSON.parse(text) as unknown;
}

/** A conversation's list comes from its running Pi or a list-only Pi; a new
 * conversation's from a list-only Pi in its workspace. */
export async function readCommands(
  target: { agentId: string } | { workspaceId: string },
  signal?: AbortSignal,
): Promise<CommandList> {
  const url =
    "agentId" in target
      ? `/api/v1/conversations/${encodeURIComponent(target.agentId.replace(/^pi:/, ""))}/commands`
      : `/api/v1/workspaces/commands?workspace_id=${encodeURIComponent(target.workspaceId)}`;
  const v = await read(url, signal);
  if (!validCommandList(v)) throw new ComposerReadFailed("invalid");
  return v as unknown as CommandList;
}

export async function readFiles(
  workspaceId: string,
  query: string,
  signal?: AbortSignal,
): Promise<FileList> {
  const params = new URLSearchParams({ workspace_id: workspaceId });
  if (query) params.set("query", query.slice(0, 200));
  const v = await read(`/api/v1/workspaces/files?${params}`, signal);
  if (!validFileList(v)) throw new ComposerReadFailed("invalid");
  return v as unknown as FileList;
}

export async function readPreview(
  workspaceId: string,
  path: string,
  signal?: AbortSignal,
): Promise<FilePreview> {
  const params = new URLSearchParams({ workspace_id: workspaceId, path });
  const v = await read(`/api/v1/workspaces/file_preview?${params}`, signal);
  if (!validFilePreview(v) || (v as FilePreview).path !== path)
    throw new ComposerReadFailed("invalid");
  return v as unknown as FilePreview;
}

/** The authored file is independent of Pi's (potentially slow) command discovery. */
export async function readStartPage(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<StartPage | null> {
  const v = await read(
    `/api/v1/workspaces/start_page?workspace_id=${encodeURIComponent(workspaceId)}`,
    signal,
  );
  if (!validStartPageReply(v)) throw new ComposerReadFailed("invalid");
  return (v as { start_page: StartPage | null }).start_page;
}

/** Native command names win collisions; only installed skills have short aliases. */
export function resolveSkillAlias(text: string, commands: PiCommand[]): string {
  const name = text.match(/^\/([A-Za-z0-9][A-Za-z0-9._-]*)(?=\s|$)/)?.[1];
  if (!name || commands.some((c) => c.name === name)) return text;
  return commands.some(
    (c) =>
      c.source === "skill" && c.name === `skill:${name}` && !c.terminal_only,
  )
    ? `/skill:${text.slice(1)}`
    : text;
}
