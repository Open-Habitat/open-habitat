// Prototype-only line diff and three-way merge. The editor already holds the
// three texts a merge needs: the version it opened (base), the person's buffer
// (mine) and a fresh read (theirs). A production merge would use a maintained
// library such as @codemirror/merge; this is only enough to show the states.

export type Hunk = {from: number; to: number; lines: string[]};

const split = (text: string) => text.split('\n');

/** Replacements turning a into b, as base line ranges [from, to). */
export function diff(a: string, b: string): Hunk[] {
  const x = split(a), y = split(b), n = x.length, m = y.length;
  const lcs = Array.from({length: n + 1}, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const hunks: Hunk[] = [];
  let i = 0, j = 0, open: Hunk | undefined;
  const close = () => { if (open) hunks.push(open); open = undefined; };
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) { close(); i++; j++; continue; }
    open ??= {from: i, to: i, lines: []};
    if (j < m && (i >= n || lcs[i][j + 1] >= lcs[i + 1][j])) open.lines.push(y[j++]);
    else { i++; open.to = i; }
  }
  close();
  return hunks;
}

export type Side = 'mine' | 'theirs';
export type Pick = 'mine' | 'theirs' | 'both';
export type Chunk =
  | {kind: 'same'; lines: string[]}
  | {kind: Side | 'agreed'; id: string; line: number; base: string[]; lines: string[]}
  | {kind: 'conflict'; id: string; line: number; base: string[]; mine: string[]; theirs: string[]};

const overlaps = (a: Hunk, b: Hunk) =>
  (a.from < b.to && b.from < a.to) || (a.from === b.from && (a.from === a.to || b.from === b.to));

/** diff3-style merge: changes to separate base lines combine, others conflict. */
export function merge(base: string, mine: string, theirs: string): Chunk[] {
  const b = split(base);
  const tagged = [
    ...diff(base, mine).map(h => ({...h, side: 'mine' as Side})),
    ...diff(base, theirs).map(h => ({...h, side: 'theirs' as Side})),
  ].sort((p, q) => p.from - q.from || p.to - q.to);
  const out: Chunk[] = [];
  let at = 0, n = 0;
  for (let k = 0; k < tagged.length;) {
    const group = [tagged[k++]];
    let from = group[0].from, to = group[0].to;
    while (k < tagged.length && group.some(g => overlaps(g, tagged[k]))) {
      group.push(tagged[k]); to = Math.max(to, tagged[k].to); k++;
    }
    from = Math.min(...group.map(g => g.from));
    if (from > at) out.push({kind: 'same', lines: b.slice(at, from)});
    const original = b.slice(from, to);
    // Rebuild each side's text over the whole group range.
    const side = (s: Side) => {
      const hs = group.filter(g => g.side === s);
      if (!hs.length) return undefined;
      const lines: string[] = [];
      let p = from;
      for (const h of hs) { lines.push(...b.slice(p, h.from), ...h.lines); p = h.to; }
      lines.push(...b.slice(p, to));
      return lines;
    };
    const m = side('mine'), t = side('theirs'), id = `c${n++}`, line = from + 1;
    if (m && t) {
      if (m.join('\n') === t.join('\n')) out.push({kind: 'agreed', id, line, base: original, lines: m});
      else out.push({kind: 'conflict', id, line, base: original, mine: m, theirs: t});
    } else out.push({kind: m ? 'mine' : 'theirs', id, line, base: original, lines: (m ?? t)!});
    at = to;
  }
  if (at < b.length) out.push({kind: 'same', lines: b.slice(at)});
  return out;
}

/** Joins a merge; an unresolved conflict keeps the person's text. */
export function join(chunks: Chunk[], picks: Record<string, Pick | undefined> = {}, skip: Set<string> = new Set()): string {
  const lines: string[] = [];
  for (const c of chunks) {
    if (c.kind === 'same') lines.push(...c.lines);
    else if (c.kind === 'conflict') {
      const p = picks[c.id] ?? 'mine';
      lines.push(...(p === 'mine' ? c.mine : p === 'theirs' ? c.theirs : [...c.mine, ...c.theirs]));
    } else lines.push(...(skip.has(c.id) ? c.base : c.lines));
  }
  return lines.join('\n');
}

/** Changed line numbers of b relative to a (1-based), for highlighting. */
export function changedLines(a: string, b: string): number[] {
  const out: number[] = [];
  let shift = 0;
  for (const h of diff(a, b)) {
    for (let k = 0; k < h.lines.length; k++) out.push(h.from + shift + k + 1);
    shift += h.lines.length - (h.to - h.from);
  }
  return out;
}
