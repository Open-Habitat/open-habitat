// Kierros 13.10.2026: tiedostotyökalut. Fixture saa kirjoitetun tiedoston koko sisällön,
// sen lukemisen ja muokkauksen, jossa yksi rivi muuttuu, yksi siirtyy sisennykseen ja
// kolme tulee lisää. Pi:n edit antaa vanhan ja uuden tekstin; diffi lasketaan niistä.

const STATUS_PY = `#!/usr/bin/env python3
"""Print status.md rows from the last week as JSON."""
import argparse
import json
import sys
from datetime import date, timedelta


def parse_table(text):
    """Yield one dict per data row of the first Markdown table in text."""
    lines = iter(text.splitlines())
    for line in lines:
        if line.lstrip().startswith("|"):
            header = [c.strip().lower() for c in line.strip().strip("|").split("|")]
            break
    else:
        return
    for line in lines:
        line = line.strip()
        if not line.startswith("|"):
            break
        if set(line) <= set("|-: "):
            continue
        yield dict(zip(header, (c.strip() for c in line.strip("|").split("|"))))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--since", type=date.fromisoformat)
    args = parser.parse_args()
    text = open("status.md", encoding="utf-8").read()
    rows = select(parse_table(text), args.since)
    print(json.dumps(rows, ensure_ascii=False, indent=2))`;
const OLD = `    rows = select(parse_table(text), args.since)
    print(json.dumps(rows, ensure_ascii=False, indent=2))`;
const NEW = `    rows = select(parse_table(text), args.since, args.today)
    if args.table:
        print_table(rows)
    else:
        print(json.dumps(rows, ensure_ascii=False, indent=2))`;
for (const m of CONVO) for (const b of m.blocks ?? []) {
  if (b.name === 'write') { b.args.content = STATUS_PY; b.result = `Wrote ${STATUS_PY.split('\n').length} lines to scripts/status_rows.py`; }
  if (b.name === 'edit') { b.args = { path: 'scripts/status_rows.py', oldText: OLD, newText: NEW }; }
  if (b.name === 'read' && b.target === 'scripts/status_rows.py') b.result = STATUS_PY;
}

// ---------- Line and word diffs ----------
function lcs(a, b, eq = (x, y) => x === y) {
  const n = a.length, m = b.length; const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n && j < m) { if (eq(a[i], b[j])) { ops.push([' ', a[i]]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push(['-', a[i++]]); else ops.push(['+', b[j++]]); }
  while (i < n) ops.push(['-', a[i++]]); while (j < m) ops.push(['+', b[j++]]);
  return ops;
}
const lineOps = (o, n) => lcs(o.split('\n'), n.split('\n'));
const stat = (ops) => ({ add: ops.filter(x => x[0] === '+').length, del: ops.filter(x => x[0] === '-').length });
// Pair each run of removed lines with the following run of added lines.
function hunks(ops) {
  const out = []; let k = 0;
  while (k < ops.length) {
    if (ops[k][0] === ' ') { out.push({ ctx: ops[k][1] }); k++; continue; }
    const del = [], add = []; while (k < ops.length && ops[k][0] === '-') del.push(ops[k++][1]); while (k < ops.length && ops[k][0] === '+') add.push(ops[k++][1]);
    out.push({ del, add });
  }
  return out;
}
const tok = (s) => s.match(/\s+|[\w.]+|[^\w\s]/g) ?? [];
function wordLine(o, n) {
  const ops = lcs(tok(o), tok(n)); let html = '';
  for (const [t, s] of ops) html += t === ' ' ? esc(s) : t === '-' ? `<del>${esc(s)}</del>` : `<ins>${esc(s)}</ins>`;
  return html;
}

// ---------- Edit renderers ----------
const sg = (t) => `<span class="sg" aria-hidden="true">${t === '+' ? '+' : t === '-' ? '−' : t === '~' ? '±' : ' '}</span>`;
const dline = (t, html) => `<span class="dl ${t === '+' ? 'add' : t === '-' ? 'del' : t === '~' ? 'chg' : 'ctx'}">${sg(t)}<span class="dt">${html || ' '}</span></span>`;
const srOnly = (t) => t === '+' ? '<span class="sr">lisätty: </span>' : t === '-' ? '<span class="sr">poistettu: </span>' : '';
const EDIT = {
  v1: (b) => `<pre class="diff">${lineOps(b.args.oldText, b.args.newText).map(([t, s]) => dline(t, srOnly(t) + esc(s))).join('')}</pre>`,
  v2: (b) => {
    const rows = [];
    for (const h of hunks(lineOps(b.args.oldText, b.args.newText))) {
      if ('ctx' in h) { rows.push([esc(h.ctx), esc(h.ctx), 'ctx', 'ctx']); continue; }
      for (let i = 0; i < Math.max(h.del.length, h.add.length); i++) rows.push([h.del[i] !== undefined ? esc(h.del[i]) : null, h.add[i] !== undefined ? esc(h.add[i]) : null, 'del', 'add']);
    }
    const cell = (v, cls) => v === null ? '<span class="sx empty"> </span>' : `<span class="sx ${cls}">${v || ' '}</span>`;
    return `<div class="sbs"><div class="sbs-h"><span>Ennen</span><span>Jälkeen</span></div><div class="sbs-cols"><pre class="sbs-col old">${rows.map(r => cell(r[0], r[2])).join('')}</pre><pre class="sbs-col new">${rows.map(r => cell(r[1], r[3])).join('')}</pre></div></div>`;
  },
  v3: (b) => {
    const out = [];
    for (const h of hunks(lineOps(b.args.oldText, b.args.newText))) {
      if ('ctx' in h) { out.push(dline(' ', esc(h.ctx))); continue; }
      // A removed line that closely matches an added one is shown once, with its word changes.
      const add = [...h.add]; const del = [];
      for (const d of h.del) {
        const ix = add.findIndex(a => a.trim() === d.trim() || lcs(tok(d), tok(a)).filter(x => x[0] === ' ').length / Math.max(tok(d).length, 1) > .6);
        if (ix >= 0) { out.push(dline('~', wordLine(d, add[ix]))); add.splice(ix, 1); } else del.push(d);
      }
      for (const d of del) out.push(dline('-', srOnly('-') + esc(d)));
      for (const a of add) out.push(dline('+', srOnly('+') + esc(a)));
    }
    return `<pre class="diff words">${out.join('')}</pre>`;
  },
};

let V = 'v1';
const langOf = (p) => ({ py: 'python', md: 'markdown', ts: 'typescript', tsx: 'typescript', js: 'javascript', sh: 'shell', go: 'go', json: 'json' }[p.split('.').pop()] || '');
const statLabel = (b) => {
  if (b.name === 'read') return `${b.result.split('\n').length} riviä`;
  if (b.name === 'write') return `uusi · ${b.args.content.split('\n').length} riviä`;
  if (b.name === 'edit') { const s = stat(lineOps(b.args.oldText, b.args.newText)); return `<span class="s-add">+${s.add}</span> <span class="s-del">−${s.del}</span>`; }
  return '';
};
const libToolBody = toolBody;
toolBody = (b) => {
  if (b.name === 'read') return `<div class="tool-body">${xbox(`h:read:${b.target}:${b.result.length}`, b.result.split('\n'), { lang: langOf(b.args.path), name: 'read', target: b.target, copyLabel: 'Kopioi sisältö' })}</div>`;
  if (b.name === 'write') return `<div class="tool-body">${xbox(`h:write:${b.target}`, b.args.content.split('\n'), { lang: langOf(b.args.path), name: 'write', target: b.target, copyLabel: 'Kopioi sisältö' })}</div>`;
  if (b.name === 'edit') return `<div class="tool-body"><div class="out"><div class="out-win">${EDIT[V](b)}<div class="out-rail ga"><div class="grp"><button class="icon-btn" type="button" data-tcopy="${esc(b.args.newText)}" aria-label="Kopioi uusi teksti" title="Kopioi uusi teksti">${ICON_COPY}</button></div></div></div><div class="out-meta"><span class="cb-lang">${esc(langOf(b.args.path))}</span><span aria-hidden="true">·</span><span>1 muutos</span></div></div></div>`;
  return libToolBody(b);
};
toolRow = (b, i) => {
  const id = nid(); const st = statLabel(b);
  return `<section class="tool ah-in" style="--i:${i}"><button class="disc" type="button" aria-expanded="false" aria-controls="${id}">${CHEV}<span class="names"><span class="name">${esc(b.name)}</span><span class="target">${esc(b.target)}</span></span>${st ? `<span class="tstat">${st}</span>` : ''}${okMark()}</button><div id="${id}" hidden>${toolBody(b)}</div></section>`;
};

function view(v) { V = v; const html = appView(); requestAnimationFrame(() => { const d = [...stage.querySelectorAll('section.tool')].find(s => /edit/.test(s.querySelector('.name')?.textContent)); d?.querySelector('.disc')?.click(); }); return html; }
const v1 = () => view('v1');
const v2 = () => view('v2');
const v3 = () => view('v3');
