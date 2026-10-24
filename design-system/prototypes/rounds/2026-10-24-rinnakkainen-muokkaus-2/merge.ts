// Line-level three-way merge over node-diff3 (vendored, MIT). The editor
// already holds the three texts a merge needs: the version it opened (origin),
// the person's buffer (mine) and the fresh read after the agent's write
// (theirs). node-diff3 splits strings on whitespace by default, so every call
// here passes line arrays.
import {diff3MergeRegions, diffIndices} from './vendor/node-diff3.mjs';

type Stable = {stable: true; buffer: 'a' | 'o' | 'b'; bufferStart: number; bufferLength: number; bufferContent: string[]};
type Unstable = {stable: false; aStart: number; aContent: string[]; oStart: number; oContent: string[]; bStart: number; bContent: string[]};
type Region = Stable | Unstable;
type Hunk = {buffer1: [number, number]; buffer2: [number, number]; buffer2Content: string[]};

const lines = (text: string) => text.split('\n');
const same = (a: string[], b: string[]) => a.length === b.length && a.every((l, i) => l === b[i]);
const regions = (a: string, o: string, b: string) => diff3MergeRegions(lines(a), lines(o), lines(b)) as Region[];
const hunks = (a: string, b: string) => diffIndices(lines(a), lines(b)) as Hunk[];

export type Conflict = {line: number; mine: string[]; theirs: string[]};
export type Merged = {
  text: string;
  /** 0-based [from, to) line ranges of the merged text that came from the agent. */
  agent: [number, number][];
  /** Lines both changed differently; the merged text keeps the person's lines. */
  conflicts: Conflict[];
};

/** Combines the agent's changes into the person's buffer. GNU diff3 rules:
 * changes to the same or adjacent base lines conflict. */
export function threeWay(mine: string, origin: string, theirs: string): Merged {
  const out: string[] = [], agent: [number, number][] = [], conflicts: Conflict[] = [];
  for (const r of regions(mine, origin, theirs)) {
    const at = out.length;
    if (r.stable) {
      out.push(...r.bufferContent);
      if (r.buffer === 'b') agent.push([at, out.length]);
    } else if (same(r.aContent, r.bContent)) out.push(...r.aContent);
    else {
      out.push(...r.aContent);
      conflicts.push({line: at, mine: r.aContent, theirs: r.bContent});
    }
  }
  return {text: out.join('\n'), agent, conflicts};
}

/** Agent changes still in `theirs` but not in `saved`: what a save replaced. */
export function replaced(saved: string, origin: string, theirs: string): {line: number; theirs: string[]}[] {
  return regions(saved, origin, theirs)
    .filter(r => r.stable ? r.buffer === 'b' : !same(r.aContent, r.bContent))
    .map(r => r.stable ? {line: r.bufferStart + 1, theirs: r.bufferContent} : {line: r.bStart + 1, theirs: r.bContent});
}

/** 0-based lines of `mine` where the agent's changes will land. */
export function landing(mine: string, origin: string, theirs: string): number[] {
  const toMine = hunks(origin, mine), last = lines(mine).length - 1;
  const map = (o: number) => {
    let shift = 0;
    for (const h of toMine) {
      const [from, n] = h.buffer1;
      if (o >= from && o < from + n) return h.buffer2[0];
      if (from + n <= o) shift += h.buffer2[1] - n;
    }
    return Math.min(o + shift, last);
  };
  const out = new Set<number>();
  for (const h of hunks(origin, theirs)) {
    const [from, n] = h.buffer1;
    for (let k = 0; k < Math.max(n, 1); k++) out.add(map(from + k));
  }
  return [...out].sort((x, y) => x - y);
}

/** Minimal CodeMirror changes turning `now` into `next`, line by line, so the
 * cursor and the person's untouched lines stay where they are. */
export function lineChanges(now: string, next: string): {from: number; to?: number; insert: string}[] {
  const cur = lines(now), n = cur.length;
  const offset = (line: number) => cur.slice(0, line).reduce((s, l) => s + l.length + 1, 0);
  return hunks(now, next).map(h => {
    const [from, len] = h.buffer1, to = from + len, ins = h.buffer2Content;
    if (from >= n) return {from: now.length, insert: `\n${ins.join('\n')}`};
    if (to < n) return {from: offset(from), to: offset(to), insert: ins.map(l => `${l}\n`).join('')};
    // Through the last line, which has no newline of its own.
    if (!ins.length && from > 0) return {from: offset(from) - 1, to: now.length, insert: ''};
    return {from: offset(from), to: now.length, insert: ins.join('\n')};
  });
}
