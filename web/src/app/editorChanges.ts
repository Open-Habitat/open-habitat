// What the conversation tells the browser editor about the agent's tool
// calls, and what the editor tells the conversation back when a save replaced
// the agent's changes. Both are view state of this tab: nothing is written to
// Pi's history or any new store, so a note is gone after a reload.
import type { ReplacedChange } from "../components/editorMerge";
import { liveText } from "../i18n";
import { appMessagesText } from "../text/appMessages";

/** A finished agent tool call, as the conversation saw it. */
export interface ToolReport {
  workspace: string;
  conversation: string;
  tool: string;
  /** The `path` argument of a file tool, as the agent wrote it. */
  path?: string;
}
/** Shown at the end of the conversation whose agent's changes a save
 * replaced. */
export interface ReplaceNote {
  id: number;
  workspace: string;
  conversation: string;
  path: string;
  at: string;
  changes: ReplacedChange[];
}

// Pi's own tools that cannot change a file. Anything else, bash and
// extension tools included, may have, so the editor reads its file again.
const readOnly = new Set(["read", "grep", "find", "ls"]);
const fileTools = new Set(["edit", "write"]);

export const mayWrite = (tool: string) => !readOnly.has(tool);

/** The `path` argument of a tool call's (possibly truncated) JSON text. */
export function toolPath(argumentsText?: string): string | undefined {
  if (!argumentsText) return undefined;
  try {
    const value = JSON.parse(argumentsText) as { path?: unknown };
    return typeof value.path === "string" ? value.path : undefined;
  } catch {
    // The live journal bounds argument text; `path` normally comes first.
    const match = /"path"\s*:\s*("(?:[^"\\]|\\.)*")/.exec(argumentsText);
    if (!match) return undefined;
    try {
      return JSON.parse(match[1]) as string;
    } catch {
      return undefined;
    }
  }
}

/** How a report bears on the open document: the agent's file tool wrote it,
 * some other tool may have (only a read tells), or it was another file. */
export function attribution(
  report: ToolReport,
  documentPath: string,
): "agent" | "maybe" | "other" {
  if (!mayWrite(report.tool)) return "other";
  if (!fileTools.has(report.tool)) return "maybe";
  if (report.path === undefined) return "maybe";
  // Pi resolves a path relative to the workspace and strips a leading `@`.
  // An absolute path is compared by its workspace-relative tail.
  const path = report.path.replace(/^@/, "").replace(/^(\.\/)+/, "");
  return path === documentPath || path.endsWith(`/${documentPath}`)
    ? "agent"
    : "other";
}

/** What *Kerro agentille* sends: short, since the agent reads the file again
 * itself rather than trusting a quote of it. */
export const messageFor = (note: ReplaceNote) =>
  liveText(appMessagesText).replacedMessage(note.path);
