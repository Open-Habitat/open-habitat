// Riffikierros 13.10.2026: tulosteen ja koodin laatikko. Näkymä (alku ja loppu,
// vieritettävä ikkuna, kaikki) on tila ja näkyy painettuna; Alkuun ja Loppuun ovat tekoja,
// jotka ovat estettyjä tai piilossa, kun laatikko on jo siinä päässä. Rivitys on tila.
// Laatikon tila on BX:ssä avaimella; elävän vuoron laatikko piirtyy uudelleen lib/live.js:n
// patchilla, muut tämä tiedosto piirtää itse.

// Jari chose Ryhmät on 2026-10-13; it is now the library box (xbox in lib/output.js). This
// file keeps all three directions in its own scope so the round still builds.
(() => {
const ICON_SCROLLWIN = SVG('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M16 8v5"/>');
const ICON_WRAP = SVG('<path d="M4 6h16M4 12h12a3 3 0 0 1 0 6h-4"/><path d="m14 16-2 2 2 2"/><path d="M4 18h4"/>');
const ICON_VIEW = SVG('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>');
const ICON_UP = SVG('<path d="M12 19V5M6 11l6-6 6 6"/>');
const ICON_DOWN = SVG('<path d="M12 5v14M6 13l6 6 6-6"/>');

let V = 'v1';
const BX = {}; const REG = {};
const bx = (key) => (BX[key] ??= { mode: null, wrap: null, pos: 0, follow: true });
const modeOf = (s, o, long) => !long ? 'all' : s.mode ?? (V !== 'v2' && o.live ? 'scroll' : 'edges');
const wrapOf = (s) => s.wrap ?? (V === 'v2');
const MODES = {
  edges: ['Alku ja loppu', ICON_EDGES],
  scroll: ['Vieritettävä ikkuna', ICON_SCROLLWIN],
  all: ['Kaikki rivit', ICON_EXPAND],
};
const linesHtml = (arr) => arr.map(l => `<span class="ln">${esc(l) || ' '}</span>`).join('');
const ibtn = (act, label, icon, x = {}) => `<button class="icon-btn" type="button" data-act="${act}"${x.mode ? ` data-mode="${x.mode}"` : ''} aria-label="${label}" title="${x.tip || label}"${x.pressed !== undefined ? ` aria-pressed="${x.pressed}"` : ''}${x.disabled ? ' aria-disabled="true"' : ''}>${icon}</button>`;
const tcopy = (lines, text) => `<button class="${text ? 'tbtn' : 'icon-btn'}" type="button" data-tcopy="${esc(lines.join('\n'))}" aria-label="Kopioi" title="Kopioi">${ICON_COPY}${text ? '<span>Kopioi</span>' : ''}</button>`;

function body(key, lines, mode, wrap, live) {
  const n = lines.length; const w = wrap ? ' wrap' : ''; const caret = live ? '<span class="caret"></span>' : '';
  const pre = (cls, arr, c = '') => `<pre class="viewport ${cls}${w}${live ? ' stream' : ''}" data-bx="${key}" tabindex="0">${linesHtml(arr)}${c}</pre>`;
  if (mode === 'all') return pre('all', lines, caret);
  if (mode === 'scroll') {
    const jumps = V === 'v3' ? `<button class="jump top" type="button" data-act="x-top" hidden>${ICON_UP}<span>Alkuun</span></button><button class="jump bottom" type="button" data-act="x-bottom" hidden>${ICON_DOWN}<span>Loppuun</span></button>` : '';
    return `<div class="vp">${pre('', lines, caret)}${jumps}</div>`;
  }
  return `<div class="edges">${pre('part head', lines.slice(0, 3))}<button class="gap" type="button" data-act="x-mode" data-mode="all">${n - 10} riviä välistä · Näytä kaikki</button>${pre('part tail', lines.slice(-7), caret)}</div>`;
}

function xbox(key, lines, o) {
  REG[key] = { lines, o };
  const s = bx(key); const n = lines.length; const long = n > 10;
  const mode = modeOf(s, o, long); const wrap = wrapOf(s);
  const metaTxt = [o.lang ? `<span class="cb-lang">${esc(o.lang)}</span>` : '', long ? `<span>${rivit(n)}</span>` : ''].filter(Boolean).join('<span aria-hidden="true">·</span>');
  const b = body(key, lines, mode, wrap, o.live);
  const open = ibtn('open', 'Avaa omassa ikkunassa', ICON_OPEN);
  const wrapBtn = ibtn('x-wrap', wrap ? 'Älä rivitä pitkiä rivejä' : 'Rivitä pitkät rivit', ICON_WRAP, { pressed: wrap });
  let html;
  if (V === 'v1') {
    const seg = long ? `<div class="grp seg" role="group" aria-label="Näkymä">${Object.entries(MODES).map(([m, [label, icon]]) => ibtn('x-mode', label, icon, { mode: m, pressed: mode === m })).join('')}</div>` : '';
    const jumps = mode === 'scroll' ? `<div class="grp jumps" role="group" aria-label="Siirry">${ibtn('x-top', 'Alkuun', ICON_TOP, { disabled: true })}${ibtn('x-bottom', 'Loppuun', ICON_BOTTOM, { disabled: true })}</div>` : '';
    const rail = `<div class="out-rail ga"><div class="grp">${tcopy(lines)}</div>${seg}${jumps}<div class="grp">${wrapBtn}${long ? open : ''}</div></div>`;
    html = `<div class="out-win">${b}${rail}</div>${metaTxt ? `<div class="out-meta">${metaTxt}</div>` : ''}`;
  } else if (V === 'v2') {
    const seg = long ? `<div class="seg-t" role="group" aria-label="Näkymä">${['edges', 'all'].map(m => `<button type="button" data-act="x-mode" data-mode="${m}" aria-pressed="${mode === m}">${m === 'edges' ? 'Alku ja loppu' : 'Kaikki'}</button>`).join('')}</div>` : '';
    const wrapT = `<button class="tbtn" type="button" data-act="x-wrap" aria-pressed="${wrap}">${ICON_WRAP}<span>Rivitä</span></button>`;
    const openT = long ? `<button class="tbtn" type="button" data-act="open">${ICON_OPEN}<span>Ikkuna</span></button>` : '';
    html = `${b}<div class="out-bar"><span class="meta-l">${metaTxt}</span>${seg}${wrapT}${tcopy(lines, true)}${openT}</div>`;
  } else {
    const menuId = `m-${key.replace(/[^\w-]/g, '_')}`;
    const item = (act, m, label, checked, role) => `<button type="button" role="${role}" data-act="${act}"${m ? ` data-mode="${m}"` : ''} aria-checked="${checked}"><span class="mark" aria-hidden="true"></span>${label}</button>`;
    const menu = `<div class="vmenu" id="${menuId}" role="menu" hidden>${long ? `<div class="vm-h">Näkymä</div>${Object.entries(MODES).map(([m, [label]]) => item('x-mode', m, label, mode === m, 'menuitemradio')).join('')}<div class="vm-sep"></div>` : ''}${item('x-wrap', '', 'Rivitä pitkät rivit', wrap, 'menuitemcheckbox')}</div>`;
    const viewBtn = `<button class="icon-btn vmenu-btn" type="button" aria-label="Näkymä" title="Näkymä: ${long ? MODES[mode][0].toLowerCase() : 'kaikki rivit'}${wrap ? ', rivitetty' : ''}" aria-haspopup="menu" aria-expanded="false" aria-controls="${menuId}">${ICON_VIEW}</button>`;
    const rail = `<div class="out-rail gc">${tcopy(lines)}${viewBtn}${long ? open : ''}${menu}</div>`;
    html = `<div class="out-win">${b}${rail}</div>${metaTxt ? `<div class="out-meta">${metaTxt}</div>` : ''}`;
  }
  return `<div class="out x-${V}" data-key="${esc(key)}">${html}</div>`;
}

// ---------- The library's box and code box go through xbox ----------
box = (lines, view, kind, b, live) => xbox(`live:${b?.id}:${kind}`, lines, { live, b });
ikkuna = (id) => { const c = CB[id]; return xbox(`cb:${id}`, c.lines, { lang: langName(c.lang), name: langName(c.lang) || 'koodi', target: 'Pi:n vastaus', plain: true }); };
// History bash cards open into the same box.
const libToolBody = toolBody;
toolBody = (b) => b.name === 'bash'
  ? `<div class="tool-body"><pre class="bash-cmd">${esc(b.args.command)}</pre>${xbox(`h:${b.args.command}`, b.result.split('\n'), { name: 'bash', target: b.target })}</div>`
  : libToolBody(b);

// ---------- Honest state: jumps and edge fades follow the real scroll position ----------
function upd(pre) {
  const key = pre.dataset.bx; const s = BX[key]; const root = pre.closest('.out'); if (!root) return;
  const atTop = pre.scrollTop <= 1; const atBottom = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 2;
  const scrolls = pre.scrollHeight > pre.clientHeight + 1;
  if (s && !pre.classList.contains('part') && !pre.classList.contains('all')) { s.pos = pre.scrollTop; s.follow = atBottom; }
  for (const t of root.querySelectorAll('[data-act="x-top"]')) { if (t.classList.contains('jump')) t.hidden = !scrolls || atTop; else t.setAttribute('aria-disabled', String(!scrolls || atTop)); }
  for (const t of root.querySelectorAll('[data-act="x-bottom"]')) { if (t.classList.contains('jump')) t.hidden = !scrolls || atBottom; else t.setAttribute('aria-disabled', String(!scrolls || atBottom)); }
  const wide = pre.scrollWidth > pre.clientWidth + 1;
  pre.classList.toggle('more-right', wide && pre.scrollLeft + pre.clientWidth < pre.scrollWidth - 1);
  pre.classList.toggle('more-left', wide && pre.scrollLeft > 1);
}
function restore(pre) {
  const s = BX[pre.dataset.bx];
  if (s && !pre.classList.contains('part') && !pre.classList.contains('all')) pre.scrollTop = s.follow ? pre.scrollHeight : s.pos;
  upd(pre);
}
new MutationObserver((muts) => {
  for (const m of muts) for (const nd of m.addedNodes) if (nd.nodeType === 1) {
    if (nd.matches?.('pre[data-bx]')) restore(nd);
    for (const p of nd.querySelectorAll?.('pre[data-bx]') ?? []) restore(p);
  }
}).observe(stage, { childList: true, subtree: true });
addEventListener('resize', () => stage.querySelectorAll('pre[data-bx]').forEach(upd));
document.addEventListener('scroll', (e) => {
  const pre = e.target.closest?.('pre[data-bx]'); if (!pre) return;
  // Head and tail of "alku ja loppu" scroll sideways together.
  if (pre.classList.contains('part')) { const other = pre.parentElement.querySelector(`pre.part.${pre.classList.contains('head') ? 'tail' : 'head'}`); if (other && other.scrollLeft !== pre.scrollLeft) other.scrollLeft = pre.scrollLeft; }
  upd(pre);
}, true);

// ---------- Actions: ahead of the library's handlers ----------
function rerender(key) {
  const el = stage.querySelector(`.out[data-key="${CSS.escape(key)}"]`); const r = REG[key]; if (!el || !r) return;
  const tmp = document.createElement('div'); tmp.innerHTML = xbox(key, r.lines, r.o); el.replaceWith(tmp.firstElementChild);
}
document.addEventListener('click', async (e) => {
  const cp = e.target.closest('[data-tcopy]');
  if (cp) {
    e.stopImmediatePropagation(); e.preventDefault();
    try { await navigator.clipboard.writeText(cp.dataset.tcopy); } catch {}
    const html = cp.innerHTML; cp.setAttribute('data-done', ''); cp.innerHTML = cp.classList.contains('tbtn') ? `${ICON_CHECK}<span>Kopioitu</span>` : ICON_CHECK;
    setTimeout(() => { cp.removeAttribute('data-done'); cp.innerHTML = html; }, 1200);
    return;
  }
  // Close an open view menu when clicking elsewhere.
  for (const m of document.querySelectorAll('.vmenu:not([hidden])')) if (!m.contains(e.target) && !e.target.closest(`[aria-controls="${m.id}"]`)) { m.hidden = true; document.querySelector(`[aria-controls="${m.id}"]`)?.setAttribute('aria-expanded', 'false'); }
  const t = e.target.closest('.out[data-key] [data-act]'); if (!t) return;
  const root = t.closest('.out[data-key]'); const key = root.dataset.key; const s = bx(key); const a = t.dataset.act; const r = REG[key];
  if (t.getAttribute('aria-disabled') === 'true') { e.stopImmediatePropagation(); return; }
  if (a === 'x-top' || a === 'x-bottom') {
    e.stopImmediatePropagation();
    const pre = root.querySelector('pre[data-bx]:not(.part)'); pre.scrollTo({ top: a === 'x-top' ? 0 : pre.scrollHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    return;
  }
  if (a === 'open') { if (key.startsWith('live:')) return; e.stopImmediatePropagation(); return openDialog({ name: r.o.name, target: r.o.target, plain: r.o.plain }, r.lines); }
  if (a === 'x-mode') { s.mode = t.dataset.mode; s.pos = 0; s.follow = s.mode === 'scroll' && key.startsWith('live:'); }
  else if (a === 'x-wrap') s.wrap = !wrapOf(s);
  else return;
  if (key.startsWith('live:')) return; // lib/live.js patches the block for an unknown action
  e.stopImmediatePropagation(); rerender(key);
}, true);

function view(v) { V = v; for (const k in BX) delete BX[k]; return appView(); }
window.v1 = () => view('v1');
window.v2 = () => view('v2');
window.v3 = () => view('v3');
})();
