import common from "../../../contracts/v1/common.schema.json";
import schema from "../../../contracts/v1/workspace-git.schema.json";
import type { GitDetailFacts } from "../components/GitStatus";
import { liveText } from "../i18n";
import { workspaceGitText } from "../text/workspaceGit";
import { LazyAjv } from "./lazyAjv";
import { jsonWrite, WriteRefused, writeOutcome } from "./mutations";

const ajv = new LazyAjv({ strict: false, addFormats: true });
ajv.addSchema(common);
const validate = ajv.compile(schema);
const txt = liveText(workspaceGitText);
export type WorkspaceGit = GitDetailFacts & {
  schema_version: 1;
  workspace_id: string;
};
export async function workspaceGit(
  id: string,
  signal: AbortSignal,
): Promise<WorkspaceGit> {
  const response = await fetch(
    `/api/v1/workspaces/git?${new URLSearchParams({ workspace_id: id })}`,
    { signal, credentials: "same-origin", cache: "no-store" },
  );
  if (!response.ok) throw new Error(txt.unreadable);
  return readGit(response, id);
}

/** Päivitä tila: `git fetch` as the person; the reply is the state read again. */
export async function fetchWorkspaceGit(
  id: string,
  csrf: string,
): Promise<WorkspaceGit> {
  const outcome = await writeOutcome(
    await jsonWrite(
      "workspace.git_fetch",
      "/api/v1/workspaces/git/fetch",
      { workspace_id: id },
      csrf,
    ).catch(() => undefined),
  );
  if (outcome.kind === "refused")
    throw new WriteRefused(outcome.status, outcome.code);
  if (outcome.kind !== "ok") throw new Error(outcome.kind);
  return readGit(outcome.response, id);
}

/** Why Päivitä tila did not fetch, in words the person can act on. */
export function fetchFailureReason(error: unknown): string {
  const code = error instanceof WriteRefused ? error.code : "";
  const known =
    code === "workspace_unavailable"
      ? txt.fetch.workspace_changed
      : Object.hasOwn(txt.fetch, code)
        ? txt.fetch[code]
        : undefined;
  if (known) return known;
  return error instanceof WriteRefused
    ? txt.refused
    : error instanceof Error && error.message === "login"
      ? txt.login
      : txt.uncertain;
}

async function readGit(response: Response, id: string): Promise<WorkspaceGit> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error(txt.unreadable);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new Error(txt.tooLarge);
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
    throw new Error(txt.unconfirmed);
  return value as WorkspaceGit;
}
