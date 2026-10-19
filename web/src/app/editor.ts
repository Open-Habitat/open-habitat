// The workspace editor's host calls and the rules of its layout (Rinnakkain,
// proto-file-viewing-2). The editor itself runs on a separate origin; the app
// only asks whether it exists, mints the one-time hand-off its frame page
// redeems, and asks the person's daemon to open a file link in it.
import type { FileRef } from "../components/fileRefs";
import { mutationFetch, type WriteOutcome, writeOutcome } from "./mutations";

export type EditorState = "absent" | "unavailable" | "stopped" | "running";

const limit = 4096;
async function smallJSON(response: Response): Promise<unknown> {
  if (
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("unexpected editor reply");
  const text = await response.text();
  if (text.length > limit) throw new Error("unexpected editor reply");
  return JSON.parse(text);
}

/** Whether this person's daemon offers an editor; reading starts nothing.
 * "absent" means the installation has no editor origin at all. */
export async function editorStatus(signal?: AbortSignal): Promise<EditorState> {
  const response = await fetch("/api/v1/editor", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (response.status === 404) return "absent";
  if (!response.ok) throw new Error("editor status unavailable");
  const value = await smallJSON(response);
  if (
    !value ||
    typeof value !== "object" ||
    (value as { schema_version?: unknown }).schema_version !== 1
  )
    throw new Error("unexpected editor reply");
  const state = (value as { state?: unknown }).state;
  if (state !== "unavailable" && state !== "stopped" && state !== "running")
    throw new Error("unexpected editor reply");
  return state;
}

export interface EditorHandoff {
  token: string;
  origin: string;
}

/** A one-minute, single-use token for the editor origin's frame page. */
export async function mintEditorHandoff(csrf: string): Promise<EditorHandoff> {
  const response = await mutationFetch("editor.handoff", "/auth/editor", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "X-Agent-Host-CSRF": csrf },
  });
  if (!response.ok) throw new Error("editor hand-off refused");
  const value = (await smallJSON(response)) as Record<string, unknown>;
  const { token, origin } = value ?? {};
  if (
    value?.schema_version !== 1 ||
    typeof token !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(token) ||
    typeof origin !== "string" ||
    !/^https:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?$/.test(origin) ||
    origin === window.location.origin
  )
    throw new Error("unexpected editor reply");
  return { token, origin };
}

/** Shows a workspace file in the running editor. The daemon resolves the
 * path inside the workspace and refuses anything else. */
export async function openInEditor(
  csrf: string,
  workspaceId: string,
  ref: FileRef,
): Promise<WriteOutcome> {
  let response: Response | undefined;
  try {
    response = await mutationFetch("editor.open", "/api/v1/editor/open", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Host-CSRF": csrf,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        path: ref.path,
        ...(ref.line ? { line: ref.line } : {}),
        ...(ref.line && ref.end && ref.end > ref.line
          ? { end_line: ref.end }
          : {}),
      }),
    });
  } catch {
    response = undefined;
  }
  return writeOutcome(response);
}

/** The frame page's own address on the editor origin. */
export function editorFrameURL(origin: string, workspaceId: string): string {
  return `${origin}/_open-habitat/frame?workspace_id=${encodeURIComponent(workspaceId)}`;
}

// Layout: the conversation column beside the editor.
export const conversationMin = 320;
export const editorMin = 560;
export const conversationWidthKey = "oh-editor-conversation-width";

/** Until the person drags, the column takes about a third of the window:
 * 440 px on a laptop, at most 640. */
export function defaultConversationWidth(total: number): number {
  return Math.round(Math.min(640, Math.max(440, total * 0.3)));
}

export function maxConversationWidth(total: number): number {
  return Math.max(conversationMin, total - editorMin);
}

export function clampConversationWidth(width: number, total: number): number {
  return Math.round(
    Math.min(maxConversationWidth(total), Math.max(conversationMin, width)),
  );
}

/** The width is a per-browser preference, kept only in this browser. */
export function rememberedConversationWidth(): number | undefined {
  try {
    const value = Number(window.localStorage.getItem(conversationWidthKey));
    return Number.isFinite(value) && value >= conversationMin
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

export function rememberConversationWidth(width: number): void {
  try {
    window.localStorage.setItem(
      conversationWidthKey,
      String(Math.round(width)),
    );
  } catch {}
}

/** Ctrl+Alt+K, or ⌘⌥K on a Mac: the app's one key while the editor is open. */
export function isEditorKey(event: KeyboardEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) && event.altKey && event.code === "KeyK"
  );
}

/** Messages the editor origin's frame page may send; anything else from that
 * origin is ignored, since code-server's webviews share it. */
export type EditorFrameMessage =
  | { type: "need-token" }
  | { type: "starting" }
  | { type: "ready" }
  | { type: "toggle" }
  | { type: "failed"; reason: string };

export function editorFrameMessage(data: unknown): EditorFrameMessage | null {
  if (!data || typeof data !== "object") return null;
  const { source, type, reason } = data as Record<string, unknown>;
  if (source !== "open-habitat-editor") return null;
  if (
    type === "need-token" ||
    type === "starting" ||
    type === "ready" ||
    type === "toggle"
  )
    return { type };
  if (type === "failed")
    return {
      type,
      reason:
        reason === "session" || reason === "start" || reason === "workspace"
          ? reason
          : "unknown",
    };
  return null;
}
