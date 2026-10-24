// Line-level three-way merge for the browser editor over node-diff3 (MIT).
// The editor already holds the three texts a merge needs: the version it
// opened (origin), the person's buffer (mine) and a fresh read after someone
// else wrote the file (theirs). node-diff3 splits strings on whitespace by
// default, so every call here passes line arrays.
//
// The regions are grouped here from node-diff3's line diffs rather than taken
// from its diff3MergeRegions, which drops a side's pure deletions: a merge
// would then report no change while the disk had removed lines, and the next
// save would silently write them back. The grouping rule is the same (GNU
// diff3, as git): changes to the same or adjacent base lines conflict.
import { diffIndices } from "node-diff3";

const lines = (text: string) => text.split("\n");
const same = (a: string[], b: string[]) =>
  a.length === b.length && a.every((line, i) => line === b[i]);

type Region =
  | { kind: "same"; lines: string[] }
  | { kind: "mine" | "theirs"; lines: string[]; start: number }
  | { kind: "both"; mine: string[]; theirs: string[]; theirsStart: number };
function regions(mine: string, origin: string, theirs: string): Region[] {
  const a = lines(mine);
  const o = lines(origin);
  const b = lines(theirs);
  const hunks = [
    ...diffIndices(o, a).map((h) => ({ side: "a" as const, h })),
    ...diffIndices(o, b).map((h) => ({ side: "b" as const, h })),
  ].sort((x, y) => x.h.buffer1[0] - y.h.buffer1[0]);
  const out: Region[] = [];
  // How far each side's line numbers have moved from the base's so far.
  const shift = { a: 0, b: 0 };
  let offset = 0;
  while (hunks.length) {
    const first = hunks.shift();
    if (!first) break;
    const start = first.h.buffer1[0];
    let end = start + first.h.buffer1[1];
    const group = [first];
    while (hunks.length && hunks[0].h.buffer1[0] <= end) {
      const next = hunks.shift();
      if (!next) break;
      end = Math.max(end, next.h.buffer1[0] + next.h.buffer1[1]);
      group.push(next);
    }
    if (start > offset)
      out.push({ kind: "same", lines: o.slice(offset, start) });
    const moved = { a: 0, b: 0 };
    for (const { side, h } of group) moved[side] += h.buffer2[1] - h.buffer1[1];
    const slice = (side: "a" | "b") => {
      const from = start + shift[side];
      return {
        from,
        lines: (side === "a" ? a : b).slice(
          from,
          end + shift[side] + moved[side],
        ),
      };
    };
    const sides = new Set(group.map((g) => g.side));
    if (sides.size === 2) {
      const theirsSlice = slice("b");
      out.push({
        kind: "both",
        mine: slice("a").lines,
        theirs: theirsSlice.lines,
        theirsStart: theirsSlice.from,
      });
    } else {
      const side = first.side;
      const own = slice(side);
      out.push({
        kind: side === "a" ? "mine" : "theirs",
        lines: own.lines,
        start: own.from,
      });
    }
    shift.a += moved.a;
    shift.b += moved.b;
    offset = end;
  }
  if (offset < o.length) out.push({ kind: "same", lines: o.slice(offset) });
  return out;
}

export interface MergeConflict {
  /** 0-based line of the merged text where the person's lines start. */
  line: number;
  mine: string[];
  theirs: string[];
}
export interface Merged {
  text: string;
  /** 0-based [from, to) line ranges of the merged text that came from disk;
   * an empty range is a deletion. */
  incoming: [number, number][];
  /** Lines both changed differently; the merged text keeps the person's. */
  conflicts: MergeConflict[];
}

/** Combines the disk's changes into the person's buffer. */
export function threeWay(mine: string, origin: string, theirs: string): Merged {
  const out: string[] = [];
  const incoming: [number, number][] = [];
  const conflicts: MergeConflict[] = [];
  for (const r of regions(mine, origin, theirs)) {
    const at = out.length;
    if (r.kind === "both") {
      out.push(...r.mine);
      if (!same(r.mine, r.theirs))
        conflicts.push({ line: at, mine: r.mine, theirs: r.theirs });
    } else {
      out.push(...r.lines);
      if (r.kind === "theirs") incoming.push([at, out.length]);
    }
  }
  return { text: out.join("\n"), incoming, conflicts };
}

/** The number of separate changes a merge brings in. */
export const changeCount = (m: Merged) =>
  m.incoming.length + m.conflicts.length;

export interface ReplacedChange {
  /** 1-based line in the disk version that was replaced. */
  line: number;
  theirs: string[];
}
/** Disk changes still in `theirs` but not in `saved`: what a save replaced. */
export function replaced(
  saved: string,
  origin: string,
  theirs: string,
): ReplacedChange[] {
  return regions(saved, origin, theirs).flatMap((r) =>
    r.kind === "theirs"
      ? [{ line: r.start + 1, theirs: r.lines }]
      : r.kind === "both" && !same(r.mine, r.theirs)
        ? [{ line: r.theirsStart + 1, theirs: r.theirs }]
        : [],
  );
}

/** 0-based lines of `mine` where the disk's changes will land. */
export function landing(
  mine: string,
  origin: string,
  theirs: string,
): number[] {
  const toMine = diffIndices(lines(origin), lines(mine));
  const last = lines(mine).length - 1;
  const map = (o: number) => {
    let shift = 0;
    for (const h of toMine) {
      const [from, n] = h.buffer1;
      if (o >= from && o < from + n) return Math.min(h.buffer2[0], last);
      if (from + n <= o) shift += h.buffer2[1] - n;
    }
    return Math.min(o + shift, last);
  };
  const out = new Set<number>();
  for (const h of diffIndices(lines(origin), lines(theirs))) {
    const [from, n] = h.buffer1;
    for (let k = 0; k < Math.max(n, 1); k++) out.add(map(from + k));
  }
  return [...out].sort((x, y) => x - y);
}

export interface LineChange {
  from: number;
  to?: number;
  insert: string;
}
/** Minimal editor changes turning `now` into `next`, line by line, so the
 * cursor and the person's untouched lines stay where they are. */
export function lineChanges(now: string, next: string): LineChange[] {
  const cur = lines(now);
  const n = cur.length;
  const starts = [0];
  for (const line of cur)
    starts.push(starts[starts.length - 1] + line.length + 1);
  return diffIndices(cur, lines(next)).map((h) => {
    const [from, len] = h.buffer1;
    const to = from + len;
    const ins = h.buffer2Content;
    if (from >= n) return { from: now.length, insert: `\n${ins.join("\n")}` };
    if (to < n)
      return {
        from: starts[from],
        to: starts[to],
        insert: ins.map((l) => `${l}\n`).join(""),
      };
    // Through the last line, which has no newline of its own.
    if (!ins.length && from > 0)
      return { from: starts[from] - 1, to: now.length, insert: "" };
    return { from: starts[from], to: now.length, insert: ins.join("\n") };
  });
}

// The engine's state for changes from disk. It is defined here, apart from
// the engine, so the controller can use it without loading CodeMirror.
export type MergeSource = "agent" | "disk";
export interface ConflictMark {
  id: number;
  from: number;
  to: number;
  mine: string[];
  theirs: string[];
  /** The person's side is empty past the last line: theirs goes after it. */
  atEnd?: boolean;
}
export interface MergeState {
  source: MergeSource;
  /** An import is in the text (not undone). */
  imported: boolean;
  /** Separate changes the import brought in. */
  count: number;
  /** History depth right after the import, to tell whether it is the latest
   * change (and so what Ctrl+Z would undo). */
  depth: number;
  incoming: { from: number; to: number }[];
  conflicts: ConflictMark[];
  /** Line starts where waiting changes will land. */
  pending: number[];
}
export const emptyMerge: MergeState = {
  source: "agent",
  imported: false,
  count: 0,
  depth: 0,
  incoming: [],
  conflicts: [],
  pending: [],
};
export interface EditorChange {
  merge: MergeState;
  /** The person typed or deleted (not an import, a pick or undo). */
  typed: boolean;
  /** The import is the latest change in history. */
  importLatest: boolean;
}
/** What the controller asks of the engine for changes from disk. */
export interface EditorMergeApi {
  text: () => string;
  merge: () => MergeState;
  /** Brings a merge into the text as one undoable history event. */
  bring: (merged: Merged, source: MergeSource) => void;
  /** Marks where waiting changes will land (not history). */
  showPending: (lines: number[], source: MergeSource) => void;
  /** An unedited document follows the disk without a history event. */
  follow: (text: string) => void;
  /** After a save the highlights have done their job. */
  clear: () => void;
  undo: () => void;
}
