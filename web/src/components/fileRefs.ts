import { createContext } from "react";

/** A workspace-relative file or trailing-slash directory a message names, with an optional line range. */
export interface FileRef {
  path: string;
  line?: number;
  end?: number;
}

// A relative directory ends in a slash; a file has an extension, optionally followed
// by :line, :line-end or :line:column. Absolute paths, home paths, URLs and
// paths that climb out (..) stay text: the browser never names anything
// outside the workspace, and the daemon checks again.
const token =
  /^(?:\.\/)?((?:[A-Za-z0-9_@+-][A-Za-z0-9_.@+-]*\/)*[A-Za-z0-9_@+-][A-Za-z0-9_.@+-]*\.[A-Za-z][A-Za-z0-9]{0,9})(?::([1-9][0-9]{0,6})(?:([-:])([1-9][0-9]{0,6}))?)?$/;

const directoryToken = /^(?:[A-Za-z0-9_@+-][A-Za-z0-9_.@+-]*\/)+$/;

/** Bare addresses are ambiguous with filenames. Recognise common web suffixes;
 * an explicit ./ always means a workspace path (including e.g. ./example.com).
 * Do not guess from an arbitrary extension: notes.txt and docs/asennus.md are files.
 */
export function webAddress(text: string): string | null {
  if (/^https?:\/\/[^\s]+$/i.test(text)) return text;
  if (
    /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|org|net|edu|gov|mil|int|io|ai|app|dev|cloud|online|site|info|biz|me|tv|xyz|tech|fi|se|no|dk|de|fr|uk|eu|us|ca|au|nz|jp|cn|in)(?::[0-9]{1,5})?(?:[/?#][^\s]*)?$/i.test(
      text,
    )
  )
    return `https://${text}`;
  return null;
}

export function parseFileRef(text: string): FileRef | null {
  if (webAddress(text.trim())) return null;
  const directory = text.trim().replace(/^\.\//, "");
  if (directory.length <= 1024 && directoryToken.test(directory))
    return { path: directory };
  // GitHub-style Markdown anchors are another common model output form.
  const normalized = text
    .trim()
    .replace(
      /#L([1-9][0-9]{0,6})(?:-L?([1-9][0-9]{0,6}))?$/,
      (_, start, end) => `:${start}${end ? `-${end}` : ""}`,
    );
  const m = token.exec(normalized);
  if (!m) return null;
  const path = m[1];
  if (path.length > 1024 || path.split("/").some((part) => part === ".."))
    return null;
  const line = m[2] ? Number(m[2]) : undefined;
  const end = m[3] === "-" && m[4] ? Number(m[4]) : undefined;
  if (line && end && end < line) return { path, line };
  return { path, ...(line ? { line } : {}), ...(end ? { end } : {}) };
}

/** How a recognised file link is opened, and which link text opened the
 * editor last (it keeps a mark); null where the editor is not offered (no
 * editor, a phone), and links then stay plain code. */
export interface FileLinks {
  open: (ref: FileRef, text: string) => void;
  opened?: string;
  /** The workspace whose files these links open. */
  workspace?: string;
}
export const FileLinkContext = createContext<FileLinks | null>(null);
