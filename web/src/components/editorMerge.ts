// Line-level three-way merge for the browser editor over node-diff3 (MIT).
// The editor already holds the three texts a merge needs: the version it
// opened (origin), the person's buffer (mine) and a fresh read after someone
// else wrote the file (theirs). node-diff3 splits strings on whitespace by
// default, so every call here passes line arrays.
import { diff3MergeRegions, diffIndices, type IRegion } from "node-diff3";

const lines = (text: string) => text.split("\n");
const same = (a: string[], b: string[]) =>
  a.length === b.length && a.every((line, i) => line === b[i]);
const regions = (a: string, o: string, b: string): IRegion<string>[] =>
  diff3MergeRegions(lines(a), lines(o), lines(b));

export interface MergeConflict {
  /** 0-based line of the merged text where the person's lines start. */
  line: number;
  mine: string[];
  theirs: string[];
}
export interface Merged {
  text: string;
  /** 0-based [from, to) line ranges of the merged text that came from disk. */
  incoming: [number, number][];
  /** Lines both changed differently; the merged text keeps the person's. */
  conflicts: MergeConflict[];
}

/** Combines the disk's changes into the person's buffer. GNU diff3 rules:
 * changes to the same or adjacent base lines conflict. */
export function threeWay(mine: string, origin: string, theirs: string): Merged {
  const out: string[] = [];
  const incoming: [number, number][] = [];
  const conflicts: MergeConflict[] = [];
  for (const r of regions(mine, origin, theirs)) {
    const at = out.length;
    if (r.stable) {
      out.push(...r.bufferContent);
      if (r.buffer === "b") incoming.push([at, out.length]);
    } else if (same(r.aContent, r.bContent)) out.push(...r.aContent);
    else {
      out.push(...r.aContent);
      conflicts.push({ line: at, mine: r.aContent, theirs: r.bContent });
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
  return regions(saved, origin, theirs)
    .filter((r) =>
      r.stable ? r.buffer === "b" : !same(r.aContent, r.bContent),
    )
    .map((r) =>
      r.stable
        ? { line: r.bufferStart + 1, theirs: r.bufferContent }
        : { line: r.bStart + 1, theirs: r.bContent },
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
