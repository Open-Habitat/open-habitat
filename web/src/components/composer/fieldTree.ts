// The in-field file list's rows (proto-composer-popover-placement, rounds 3
// and 4): browsing is one indented folder tree in which a folder holding a
// change starts open, so a changed file shows in its place with its Git mark;
// a search is one flat list, the name first and its folder after, in the
// daemon's order (rank=name). The rows are built from what the daemon read
// while the list is open; nothing here is kept after it closes.
import type { TreeFolder, WorkspaceFile } from "../../app/composerReads";
import type { Choice } from "./ChoiceList";

/** The folders read so far, by path ("" is the workspace itself). */
export type Listings = ReadonlyMap<string, TreeFolder>;

/** Folders opened or closed against their default. */
export type Folding = {
  opened: readonly string[];
  closed: readonly string[];
};
export const unfolded: Folding = { opened: [], closed: [] };

/** A folder holding a change starts open; the person's choice wins. */
export const isOpen = (f: Folding, path: string, changed: number) =>
  f.opened.includes(path) || (changed > 0 && !f.closed.includes(path));

/** Open a closed folder or close an open one. */
export function toggleFolder(
  f: Folding,
  path: string,
  changed: number,
): Folding {
  const open = isOpen(f, path, changed);
  return {
    opened: open
      ? f.opened.filter((p) => p !== path)
      : [...f.opened.filter((p) => p !== path), path],
    closed: open
      ? [...f.closed.filter((p) => p !== path), path]
      : f.closed.filter((p) => p !== path),
  };
}

/** The folders a path lies in, outermost first: `a/b/c.md` → `a/`, `a/b/`. */
export function foldersAbove(path: string): string[] {
  const out: string[] = [];
  for (let i = path.indexOf("/"); i >= 0 && i < path.length - 1; ) {
    out.push(path.slice(0, i + 1));
    i = path.indexOf("/", i + 1);
  }
  return out;
}

/** The folder a file or folder is in; "" for the workspace's top. */
export const parentFolder = (path: string) => path.replace(/[^/]+\/?$/, "");

/** A file's or folder's own name; a folder's keeps its slash. */
export const ownName = (path: string) => path.slice(parentFolder(path).length);

/** Lista's → : the tree opened down to the file, every other folder as it
 * starts. */
export const revealFolding = (path: string): Folding => ({
  opened: foldersAbove(path),
  closed: [],
});

/** The tree's rows from the top folder, or null until the top is read. A
 * folder that shows open before its contents are read has a loading row
 * naming it, which the list reads next. */
export function treeChoices(
  listings: Listings,
  folding: Folding,
  text: {
    loading: string;
    more: string;
    failed: string;
    /** Folders whose read failed: said once, not read again. */
    failedFolders: ReadonlySet<string>;
  },
): Choice[] | null {
  if (!listings.has("")) return null;
  const rows: Choice[] = [];
  const walk = (folder: string, depth: number) => {
    const listing = listings.get(folder);
    if (!listing && text.failedFolders.has(folder)) {
      rows.push({ type: "status", text: text.failed, depth });
      return;
    }
    if (!listing) {
      rows.push({
        type: "status",
        text: text.loading,
        loading: true,
        depth,
        folder,
      });
      return;
    }
    for (const entry of listing.entries) {
      if (entry.kind === "folder") {
        const changed = entry.changed ?? 0;
        const open = isOpen(folding, entry.path, changed);
        rows.push({ type: "folder", path: entry.path, changed, depth, open });
        if (open) walk(entry.path, depth + 1);
      } else
        rows.push({ type: "file", path: entry.path, git: entry.git, depth });
    }
    if (listing.truncated)
      rows.push({ type: "status", text: text.more, depth });
  };
  walk("", 0);
  return rows;
}

/** The folders the tree shows open but has not read: the deepest of each
 * chain is enough, since a folder's read brings the folders above it. */
export function foldersToRead(rows: readonly Choice[]): string[] {
  const wanted = rows.flatMap((r) =>
    r.type === "status" && r.folder !== undefined ? [r.folder] : [],
  );
  return wanted.filter(
    (f) => !wanted.some((other) => other !== f && other.startsWith(f)),
  );
}

/** Lista: one row a match, the name first and its folder after it;
 * / denotes the workspace root, not a subfolder named after the workspace. */
export function searchChoices(files: readonly WorkspaceFile[]): Choice[] {
  return files.map((f) => ({
    type: "file",
    path: f.path,
    git: f.git,
    where: parentFolder(f.path) || "/",
  }));
}

/** Where the selection rests when the rows change: the revealed file, else
 * the first changed file while browsing or the first file of a search,
 * never a folder; else the first row that can be picked. */
export function autoSelect(
  rows: readonly Choice[],
  o: { reveal?: string; searching: boolean },
): number {
  if (o.reveal) {
    const i = rows.findIndex((r) => r.type === "file" && r.path === o.reveal);
    if (i >= 0) return i;
  }
  const i = rows.findIndex(
    (r) => r.type === "file" && (o.searching || !!r.git),
  );
  if (i >= 0) return i;
  return rows.findIndex(
    (r) => r.type !== "status" && !(r.type === "command" && r.terminalOnly),
  );
}

/** What → or ← does on the row in hand: a folder opens or closes, an open
 * folder's → steps into it, ← steps out to the folder above, and a search
 * row's → shows the file in its folder. */
export type Sideways =
  | { do: "toggle"; path: string; changed: number }
  | { do: "select"; index: number }
  | { do: "reveal"; path: string }
  | null;
export function sideways(
  rows: readonly Choice[],
  sel: number,
  right: boolean,
): Sideways {
  const row = rows[sel];
  if (!row) return null;
  if (row.type === "folder") {
    if (right)
      return row.open
        ? rows[sel + 1] && rows[sel + 1].type !== "status"
          ? { do: "select", index: sel + 1 }
          : null
        : { do: "toggle", path: row.path, changed: row.changed };
    if (row.open) return { do: "toggle", path: row.path, changed: row.changed };
  }
  if (row.type === "file" && row.where !== undefined)
    return right ? { do: "reveal", path: row.path } : null;
  if (right || (row.type !== "file" && row.type !== "folder")) return null;
  const up = parentFolder(row.path);
  const index = rows.findIndex((r) => r.type === "folder" && r.path === up);
  return index >= 0 ? { do: "select", index } : null;
}
