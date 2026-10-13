// Tulosteen ja komennon laatikot (valittu kierroksilla 5 ja 6).
// The own window is offered for every long output (Jari 13.10.2026); the earlier forty-line threshold hid it.
const liveCaret = (b) => b.state === 'running' ? '<span class="caret"></span>' : '';
const lineText = (lines) => esc(lines.join('\n'));
const rivit = (n) => `${n} riviä`;
function outMeta(b, parts) { return `<div class="out-meta">${parts.filter(Boolean).join('')}</div>`; }
function openDialog(b, lines = b.out) {
  const dlg = document.getElementById('outdlg');
  dlg.innerHTML = `<div class="dlg-head"><span class="name">${esc(b.name)}</span><span class="target">${esc(b.target)}</span>${copyBtn('Kopioi', lines.join('\n'))}<button class="quiet-btn" type="button" data-close>Sulje</button></div><div class="dlg-body"><pre>${lines.map((l, i) => `<code><span class="lineno">${i + 1}</span>${!b.plain && /FAILED|Error/.test(l) ? `<span class="fail">${esc(l)}</span>` : esc(l) || ' '}</code>`).join('')}</pre></div>`;
  dlg.showModal();
}
document.getElementById('outdlg').addEventListener('click', (e) => { const d = e.currentTarget; if (e.target.closest('[data-close]') || e.target === d) d.close(); });

// ---------- The output box (chosen 13.10.2026, Ryhmät, round 2026-10-13-laatikko) ----------
// Bash output and reply code share one box. The view (alku ja loppu, vieritettävä ikkuna,
// kaikki rivit) is the only pressed state; Alkuun and Loppuun are actions, offered in the
// scroll view and disabled at the end the box is already at. The side rail is grouped:
// copy · view · jumps · wrap and own window. Long lines do not wrap by default; an inner
// shadow at the edge says the line goes on, and wrapping hangs the continuation.
const OSV = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON_SCROLLWIN = OSV('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M16 8v5"/>');
const ICON_WRAP = OSV('<path d="M4 6h16M4 12h12a3 3 0 0 1 0 6h-4"/><path d="m14 16-2 2 2 2"/><path d="M4 18h4"/>');
const BX = {}; const REG = {};
const bx = (key) => (BX[key] ??= { mode: null, wrap: null, pos: 0, follow: true });
const BOX_MODES = { edges: ['Alku ja loppu', ICON_EDGES], scroll: ['Vieritettävä ikkuna', ICON_SCROLLWIN], all: ['Kaikki rivit', ICON_EXPAND] };
const boxBtn = (act, label, icon, x = {}) => `<button class="icon-btn" type="button" data-act="${act}"${x.mode ? ` data-mode="${x.mode}"` : ''} aria-label="${label}" title="${label}"${x.pressed !== undefined ? ` aria-pressed="${x.pressed}"` : ''}${x.disabled ? ' aria-disabled="true"' : ''}>${icon}</button>`;
function boxBody(key, lines, mode, wrap, live) {
  const w = wrap ? ' wrap' : ''; const caret = live ? '<span class="caret"></span>' : '';
  const pre = (cls, arr, c = '') => `<pre class="viewport ${cls}${w}${live ? ' stream' : ''}" data-bx="${key}" tabindex="0">${arr.map(l => `<span class="ln">${esc(l) || ' '}</span>`).join('')}${c}</pre>`;
  if (mode === 'all') return pre('all', lines, caret);
  if (mode === 'scroll') return `<div class="vp">${pre('', lines, caret)}</div>`;
  return `<div class="edges">${pre('part head', lines.slice(0, 3))}<button class="gap" type="button" data-act="x-mode" data-mode="all">${lines.length - 10} riviä välistä · Näytä kaikki</button>${pre('part tail', lines.slice(-7), caret)}</div>`;
}
function xbox(key, lines, o) {
  REG[key] = { lines, o };
  const s = bx(key); const n = lines.length; const long = n > 10;
  const mode = !long ? 'all' : s.mode ?? (o.live ? 'scroll' : 'edges'); const wrap = !!s.wrap;
  const meta = [o.lang ? `<span class="cb-lang">${esc(o.lang)}</span>` : '', long ? `<span>${rivit(n)}</span>` : ''].filter(Boolean).join('<span aria-hidden="true">·</span>');
  const copy = `<button class="icon-btn" type="button" data-tcopy="${esc(lines.join('\n'))}" aria-label="${o.copyLabel || 'Kopioi'}" title="${o.copyLabel || 'Kopioi'}">${ICON_COPY}</button>`;
  const seg = long ? `<div class="grp seg" role="group" aria-label="Näkymä">${Object.entries(BOX_MODES).map(([m, [label, icon]]) => boxBtn('x-mode', label, icon, { mode: m, pressed: mode === m })).join('')}</div>` : '';
  const jumps = mode === 'scroll' ? `<div class="grp jumps" role="group" aria-label="Siirry">${boxBtn('x-top', 'Alkuun', ICON_TOP, { disabled: true })}${boxBtn('x-bottom', 'Loppuun', ICON_BOTTOM, { disabled: true })}</div>` : '';
  const tail = `<div class="grp">${boxBtn('x-wrap', wrap ? 'Älä rivitä pitkiä rivejä' : 'Rivitä pitkät rivit', ICON_WRAP, { pressed: wrap })}${long ? boxBtn('open', 'Avaa omassa ikkunassa', ICON_OPEN) : ''}</div>`;
  return `<div class="out" data-key="${esc(key)}"><div class="out-win">${boxBody(key, lines, mode, wrap, o.live)}<div class="out-rail ga"><div class="grp">${copy}</div>${seg}${jumps}${tail}</div></div>${meta ? `<div class="out-meta">${meta}</div>` : ''}</div>`;
}
// Callers: the live turn passes its block; the box keeps its own view state by key.
function box(lines, view, kind, b, live) {
  return xbox(`live:${b?.id}:${kind}`, lines, { live, b, copyLabel: { cmd: 'Kopioi komento', code: 'Kopioi koodi' }[kind] || 'Kopioi tuloste' });
}

// Honest state: jumps and edge shadows follow the real scroll position.
function boxUpd(pre) {
  const s = BX[pre.dataset.bx]; const root = pre.closest('.out'); if (!root) return;
  const atTop = pre.scrollTop <= 1; const atBottom = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 2;
  const scrolls = pre.scrollHeight > pre.clientHeight + 1;
  if (s && !pre.classList.contains('part') && !pre.classList.contains('all')) { s.pos = pre.scrollTop; s.follow = atBottom; }
  for (const t of root.querySelectorAll('[data-act="x-top"]')) t.setAttribute('aria-disabled', String(!scrolls || atTop));
  for (const t of root.querySelectorAll('[data-act="x-bottom"]')) t.setAttribute('aria-disabled', String(!scrolls || atBottom));
  const wide = pre.scrollWidth > pre.clientWidth + 1;
  pre.classList.toggle('more-right', wide && pre.scrollLeft + pre.clientWidth < pre.scrollWidth - 1);
  pre.classList.toggle('more-left', wide && pre.scrollLeft > 1);
}
function boxRestore(pre) {
  const s = BX[pre.dataset.bx];
  if (s && !pre.classList.contains('part') && !pre.classList.contains('all')) pre.scrollTop = s.follow ? pre.scrollHeight : s.pos;
  boxUpd(pre);
}
new MutationObserver((muts) => {
  for (const m of muts) for (const nd of m.addedNodes) if (nd.nodeType === 1) {
    if (nd.matches?.('pre[data-bx]')) boxRestore(nd);
    for (const p of nd.querySelectorAll?.('pre[data-bx]') ?? []) boxRestore(p);
  }
}).observe(stage, { childList: true, subtree: true });
addEventListener('resize', () => stage.querySelectorAll('pre[data-bx]').forEach(boxUpd));
document.addEventListener('scroll', (e) => {
  const pre = e.target.closest?.('pre[data-bx]'); if (!pre) return;
  // Head and tail of "alku ja loppu" scroll sideways together.
  if (pre.classList.contains('part')) { const other = pre.parentElement.querySelector(`pre.part.${pre.classList.contains('head') ? 'tail' : 'head'}`); if (other && other.scrollLeft !== pre.scrollLeft) other.scrollLeft = pre.scrollLeft; }
  boxUpd(pre);
}, true);
// Actions run ahead of the library's other handlers. A live box is redrawn by lib/live.js,
// which patches the block for an action it does not know; other boxes redraw here.
document.addEventListener('click', async (e) => {
  const cp = e.target.closest('[data-tcopy]');
  if (cp) {
    e.stopImmediatePropagation(); e.preventDefault();
    try { await navigator.clipboard.writeText(cp.dataset.tcopy); } catch {}
    const label = cp.getAttribute('aria-label'); cp.setAttribute('data-done', ''); cp.setAttribute('aria-label', 'Kopioitu'); cp.innerHTML = ICON_CHECK;
    setTimeout(() => { cp.removeAttribute('data-done'); cp.setAttribute('aria-label', label); cp.innerHTML = ICON_COPY; }, 1200);
    return;
  }
  const t = e.target.closest('.out[data-key] [data-act]'); if (!t) return;
  const root = t.closest('.out[data-key]'); const key = root.dataset.key; const r = REG[key];
  if (!r) return; // a round's own box
  const s = bx(key); const a = t.dataset.act;
  if (t.getAttribute('aria-disabled') === 'true') { e.stopImmediatePropagation(); return; }
  if (a === 'x-top' || a === 'x-bottom') {
    e.stopImmediatePropagation();
    const pre = root.querySelector('pre[data-bx]:not(.part)'); pre.scrollTo({ top: a === 'x-top' ? 0 : pre.scrollHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    return;
  }
  if (a === 'open') { if (key.startsWith('live:')) return; e.stopImmediatePropagation(); return openDialog({ name: r.o.name, target: r.o.target, plain: r.o.plain }, r.lines); }
  if (a === 'x-mode') { s.mode = t.dataset.mode; s.pos = 0; s.follow = s.mode === 'scroll' && key.startsWith('live:'); }
  else if (a === 'x-wrap') s.wrap = !s.wrap;
  else return;
  if (key.startsWith('live:')) return;
  e.stopImmediatePropagation();
  const tmp = document.createElement('div'); tmp.innerHTML = xbox(key, r.lines, r.o); root.replaceWith(tmp.firstElementChild);
}, true);
const outView = (b) => b.view ?? (b.state === 'running' ? 'end' : 'edges');
const cmdLines = (b) => b.args.command.split('\n');
const plainCmd = (b) => `<pre class="bash-cmd">${esc(b.args.command)}</pre>`;
function heredoc(lines) {
  const i = lines.findIndex(l => /<<-?\s*'?"?\w+'?"?\s*$/.test(l)); if (i < 0) return null;
  const marker = lines[i].match(/<<-?\s*'?"?(\w+)/)[1]; const j = lines.findIndex((l, k) => k > i && l.trim() === marker); if (j < 0) return null;
  return { head: lines.slice(0, i + 1), body: lines.slice(i + 1, j), marker, tail: lines.slice(j + 1) };
}

// ---------- Command (chosen in round 6, Rivi): first line, the rest opens in place ----------
const cmdRivi = (b) => {
  const lines = cmdLines(b); if (lines.length === 1) return plainCmd(b);
  const open = !!b.cmdOpen;
  return `<div><div class="cmd-first${open ? ' open' : ''}">${esc(lines[0])}</div>${open ? `<pre class="cmd-rest">${lineText(lines.slice(1))}</pre>` : ''}<div class="cmd-foot"><span>${rivit(lines.length)}</span><button class="quiet-btn" type="button" data-act="cmd-toggle" aria-expanded="${open}">${open ? 'Vain ensimmäinen rivi' : 'Näytä koko komento'}</button></div></div>`;
};

// ---------- Code in a reply (chosen 13.10.2026, Ikkuna): the same box as output ----------
// Language and line count sit under the box; the rail starts with copy.
const langName = (l) => ({ bash: 'shell', sh: 'shell', zsh: 'shell', py: 'python' }[l] || l);
const codeLines = (t) => t.replace(/\n$/, '').split('\n');
const CB = {}; let cbSeq = 0;
function codeBox(lang, text) { const id = `cb${++cbSeq}`; CB[id] = { lang, lines: codeLines(text) }; return `<div class="cb o" data-cb="${id}">${ikkuna(id)}</div>`; }
function ikkuna(id) { const c = CB[id]; return xbox(`cb:${id}`, c.lines, { lang: langName(c.lang), name: langName(c.lang) || 'koodi', target: 'Pi:n vastaus', plain: true, copyLabel: 'Kopioi koodi' }); }
mdCode = codeBox;
