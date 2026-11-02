import common from "../../../contracts/v1/common.schema.json";
import schema from "../../../contracts/v1/workspace-editor-files.schema.json";
import { LazyAjv } from "./lazyAjv";
import { mutationFetch, writeOutcome } from "./mutations";

const ajv = new LazyAjv({ strict: false, addFormats: true });
ajv.addSchema(common);
ajv.addSchema(schema);
const validates = Object.fromEntries(
  ["readResult", "saveResult", "listResult", "statResult"].map((name) => [
    name,
    ajv.compile({ $ref: `${schema.$id}#/$defs/${name}` }),
  ]),
);
const prefix = "/api/v1/workspaces/editor/";
export interface EditorDocument {
  schema_version: 1;
  workspace_id: string;
  path: string;
  content: string;
  version: string;
  bom: boolean;
  newline: "lf" | "crlf" | "none";
  encoding: "utf-8";
  size_bytes: number;
  mode: number;
}
export interface EditorListing {
  workspace_id: string;
  path: string;
  entries: { name: string; kind: "file" | "directory" | "unsupported" }[];
  truncated: boolean;
}
export class EditorReadError extends Error {
  constructor(public code: string) {
    super("editor read unavailable");
  }
}
function validPath(path: string, root = false): boolean {
  if (!path) return root;
  const bytes = new TextEncoder();
  const parts = path.split("/");
  return (
    bytes.encode(path).byteLength <= 1024 &&
    parts.length <= 64 &&
    validEditorText(path) &&
    ![...path].some((char) => {
      const code = char.codePointAt(0) ?? 0;
      return char === "\\" || code < 32 || (code >= 127 && code <= 159);
    }) &&
    parts.every(
      (part) =>
        part !== "" &&
        part !== "." &&
        part !== ".." &&
        part !== ".git" &&
        part !== ".agent-host" &&
        bytes.encode(part).byteLength <= 255,
    )
  );
}
export function validEditorText(text: string) {
  if (/[\r\0]/.test(text)) return false;
  for (let i = 0; i < text.length; i++) {
    const n = text.charCodeAt(i);
    if (n >= 0xdc00 && n <= 0xdfff) return false;
    if (n >= 0xd800 && n <= 0xdbff) {
      const low = text.charCodeAt(++i);
      if (!(low >= 0xdc00 && low <= 0xdfff)) return false;
    }
  }
  return true;
}
async function bounded(response: Response): Promise<unknown> {
  if (
    response.headers.get("content-type")?.split(";")[0] !==
      "application/json" ||
    !response.body
  )
    throw new EditorReadError("unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8 * 1024 * 1024) throw new EditorReadError("unavailable");
      chunks.push(value);
    }
    const data = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
async function read(
  op: "file" | "list",
  workspace: string,
  path: string,
  signal?: AbortSignal,
) {
  if (!validPath(path, op === "list")) throw new EditorReadError("unavailable");
  const response = await fetch(
    `${prefix}${op}?${new URLSearchParams({ workspace_id: workspace, path })}`,
    {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    },
  );
  if (!response.ok)
    throw new EditorReadError(
      response.status === 415
        ? "unsupported"
        : response.status === 413
          ? "too_large"
          : "unavailable",
    );
  const value = await bounded(response);
  const validate = validates[op === "file" ? "readResult" : "listResult"];
  if (!validate(value)) throw new EditorReadError("unavailable");
  const result = value as EditorDocument | EditorListing;
  if (result.workspace_id !== workspace || result.path !== path)
    throw new EditorReadError("unavailable");
  if (op === "file" && !validEditorText((result as EditorDocument).content))
    throw new EditorReadError("unavailable");
  if (
    op === "list" &&
    (result as EditorListing).entries.some(
      (entry) => !validPath(path ? `${path}/${entry.name}` : entry.name),
    )
  )
    throw new EditorReadError("unavailable");
  return result;
}
export const readEditorFile = (
  workspace: string,
  path: string,
  signal?: AbortSignal,
) => read("file", workspace, path, signal) as Promise<EditorDocument>;
export const listEditorFiles = (
  workspace: string,
  path: string,
  signal?: AbortSignal,
) => read("list", workspace, path, signal) as Promise<EditorListing>;
export async function saveEditorFile(
  doc: EditorDocument,
  content: string,
  csrf: string,
) {
  if (!validEditorText(content)) return { kind: "invalid" } as const;
  let response: Response | undefined;
  try {
    response = await mutationFetch("editor.save", `${prefix}file`, {
      method: "PUT",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Host-CSRF": csrf,
      },
      body: JSON.stringify({
        workspace_id: doc.workspace_id,
        path: doc.path,
        base_version: doc.version,
        content,
        bom: doc.bom,
        newline:
          doc.newline === "none" && content.includes("\n") ? "lf" : doc.newline,
      }),
    });
  } catch {
    /* Lost replies are uncertain, never a retry instruction. */
  }
  const outcome = await writeOutcome(response);
  if (outcome.kind !== "ok") return outcome;
  try {
    const value = await bounded(response as Response);
    if (!validates.saveResult(value)) return { kind: "uncertain" } as const;
    const saved = value as Pick<
      EditorDocument,
      "workspace_id" | "path" | "version" | "mode" | "size_bytes"
    >;
    if (saved.workspace_id !== doc.workspace_id || saved.path !== doc.path)
      return { kind: "uncertain" } as const;
    return {
      kind: "ok",
      document: {
        ...doc,
        ...saved,
        content,
        newline:
          doc.newline === "none" && content.includes("\n") ? "lf" : doc.newline,
      } as EditorDocument,
    } as const;
  } catch {
    return { kind: "uncertain" } as const;
  }
}
