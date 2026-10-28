// Kierros 2 (proto-markdown-full-preview-button, 28.10.2026). Jari valitsi suunnan Painike:
// ikonipainikkeet, ei rinnakkaista esikatselua, ja sama koko näkymän esikatselu myös CSV:lle ja
// muille muodoille, joissa se on mielekäs. Sisältö, muodot ja näppäimet ovat samat kaikissa
// suunnissa; suunnat eroavat siinä, missä ikonirivi on ja mitä kuvakkeita siinä on.
(() => {
const FILES = window.FILES;
const S_ = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
// Paths from production Icon.tsx: eye, pencil, table, image, back, forward, cross.
const I = {
  eye: S_('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.5"/>'),
  pencil: S_('<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z"/>'),
  table: S_('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>'),
  image: S_('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5-5 4 4 3-3 4 4"/>'),
  back: S_('<path d="m15 5-7 7 7 7"/>'),
  forward: S_('<path d="m9 5 7 7-7 7"/>'),
  cross: S_('<path d="M5 5 19 19M19 5 5 19"/>'),
  chat: S_('<circle cx="12" cy="12" r="8"/>'),
};
const esc = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Formats: which files get a preview, and what it is ----------
// `pv: null` = no preview: the row is absent and the keys do nothing (production attaches the
// listener only for a previewable file, so ⌘⇧V stays the browser's plain-text paste there).
const FMT = {
  md: { path: 'suunnitelmat/saaristoretki-2027.md', pv: { icon: 'eye', label: 'Esikatselu' } },
  csv: { path: 'suunnitelmat/ilmoittautuneet.csv', pv: { icon: 'table', label: 'Taulukko' } },
  svg: { path: 'suunnitelmat/reittikartta.svg', pv: { icon: 'image', label: 'Kuva' } },
  html: { path: 'suunnitelmat/kutsu.html', pv: { icon: 'eye', label: 'Sivu' } },
  json: { path: 'suunnitelmat/asetukset.json', pv: null },
};
const VARIANTS = {
  row: { name: 'Tiedostorivi', note: 'Ikonipari työkalurivillä tiedostonimen ja Tallennan välissä: kynä (teksti) ja muodon kuvake (esikatselu). Kumpi on auki, näkyy painettuna.' },
  head: { name: 'Otsikkopalkki', note: 'Yksi kuvake editorin otsikkopalkissa ikkunapainikkeiden vieressä, kuten VS Coden esikatselukuvake. Painettu = esikatselu auki, uusi painallus palaa tekstiin.' },
  corner: { name: 'Kulma', note: 'Kelluva ikonipari dokumentin oikeassa yläkulmassa, puhelimessa oikeassa alakulmassa peukalon ulottuvilla. Työkalurivi pysyy ennallaan.' },
};

// ---------- State ----------
const mac = /Mac|iPhone|iPad/.test(navigator.platform);
const S = { v: 'row', file: 'md', mode: 'text', conv: false, kbd: mac ? 'mac' : 'pc', texts: {}, dirty: {}, saved: {}, srcTop: {} };
const reset = () => { for (const k in FMT) { S.texts[k] = FILES[k]; S.dirty[k] = false; S.saved[k] = false; S.srcTop[k] = 0; } S.mode = 'text'; };
reset();
const fmt = () => FMT[S.file];
const text = () => S.texts[S.file];
const keys = () => S.kbd === 'mac' ? { fast: '⌘E', vs: '⌘⇧V' } : { fast: 'Ctrl+E', vs: 'Ctrl+Shift+V' };
const ARIA = 'Meta+E Control+E Meta+Shift+V Control+Shift+V';

// ---------- Source: highlighted rows under a transparent textarea ----------
function hlMd(l, fence) {
  if (fence) return `<span class="sx-c">${esc(l)}</span>`;
  if (/^#{1,6} /.test(l)) return `<span class="sx-h">${esc(l)}</span>`;
  let s = esc(l).replace(/`([^`]+)`/g, '<span class="sx-s">`$1`</span>').replace(/\*\*([^*]+)\*\*/g, '<span class="sx-b">**$1**</span>');
  s = s.replace(/^(\s*)(- |\d+\. |&gt; )/, '$1<span class="sx-k">$2</span>');
  if (/^\|/.test(l)) s = s.replace(/\|/g, '<span class="sx-k">|</span>');
  return s;
}
const hlCsv = (l, i) => i === 0 ? `<span class="sx-h">${esc(l).replace(/;/g, '<span class="sx-k">;</span>')}</span>` : esc(l).replace(/;/g, '<span class="sx-k">;</span>');
const hlMarkup = (l) => esc(l)
  .replace(/(&lt;!--.*?--&gt;)/g, '<span class="sx-c">$1</span>')
  .replace(/(&quot;[^&]*?&quot;)/g, '<span class="sx-s">$1</span>')
  .replace(/(&lt;\/?)([a-zA-Z0-9!]+)/g, '$1<span class="sx-k">$2</span>');
const hlJson = (l) => esc(l)
  .replace(/(&quot;[^&]*?&quot;)(\s*:)/g, '<span class="sx-h">$1</span>$2')
  .replace(/(:\s*|\[\s*|,\s*)(&quot;[^&]*?&quot;)/g, '$1<span class="sx-s">$2</span>')
  .replace(/([:\[,]\s*)(-?\d[\d.]*)/g, '$1<span class="sx-n">$2</span>');
function rows(t) {
  let fence = false;
  return t.split('\n').map((l, i) => {
    let html, fold = false;
    if (S.file === 'md') {
      const isFence = l.startsWith('```'); const inFence = fence || isFence; if (isFence) fence = !fence;
      fold = !inFence && /^#{1,6} /.test(l); html = hlMd(l, inFence);
    } else if (S.file === 'csv') html = hlCsv(l, i);
    else if (S.file === 'json') { html = hlJson(l); fold = /[{[]\s*$/.test(l); }
    else { html = hlMarkup(l); fold = /^\s*<(g|head|body|style)\b[^/]*>\s*$/.test(l); }
    return `<div class="ln${fold ? ' fold' : ''}" data-n="${i + 1}">${html || '\u200b'}</div>`;
  }).join('');
}

// ---------- Previews ----------
function inline(s) {
  return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
// A small Markdown renderer for the synthetic file: headings, paragraphs, lists, tables,
// quotes and fences. Production uses the app's own Markdown component.
function md(t) {
  const L = t.split('\n'); const out = []; let i = 0;
  while (i < L.length) {
    const l = L[i];
    if (!l.trim()) { i++; continue; }
    if (l.startsWith('```')) { const b = []; i++; while (i < L.length && !L[i].startsWith('```')) b.push(L[i++]); i++; out.push(`<pre><code>${esc(b.join('\n'))}</code></pre>`); continue; }
    const h = /^(#{1,6}) (.*)$/.exec(l); if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (l.startsWith('> ')) { const b = []; while (i < L.length && L[i].startsWith('> ')) b.push(L[i++].slice(2)); out.push(`<blockquote><p>${inline(b.join(' '))}</p></blockquote>`); continue; }
    if (l.startsWith('|')) {
      const b = []; while (i < L.length && L[i].startsWith('|')) b.push(L[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      out.push(`<table><thead><tr>${cells(b[0]).map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${b.slice(2).map(r => `<tr>${cells(r).map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    if (/^(- |\d+\. )/.test(l)) {
      const ol = /^\d/.test(l); const b = []; while (i < L.length && /^(- |\d+\. )/.test(L[i])) b.push(L[i++].replace(/^(- |\d+\. )/, ''));
      out.push(`<${ol ? 'ol' : 'ul'}>${b.map(x => `<li>${inline(x)}</li>`).join('')}</${ol ? 'ol' : 'ul'}>`); continue;
    }
    const b = []; while (i < L.length && L[i].trim() && !/^(#|>|\||- |\d+\. |```)/.test(L[i])) b.push(L[i++]);
    out.push(`<p>${inline(b.join(' '))}</p>`);
  }
  return out.join('');
}
// The separator rule of production `csvSeparator`: the most common of , ; tab on the first row.
function csv(t) {
  const first = t.split('\n')[0]; const sep = [';', '\t', ','].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const R = t.split('\n').filter(Boolean).map(r => r.split(sep));
  const num = (c) => /^-?\d+(,\d+)?$/.test(c);
  return `<div class="cap">${R.length - 1} riviä · ${R[0].length} saraketta · erotin ${sep === ';' ? 'puolipiste' : sep === ',' ? 'pilkku' : 'sarkain'}</div>
  <table><thead><tr><th class="rn">1</th>${R[0].map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
  <tbody>${R.slice(1).map((r, i) => `<tr data-line="${i + 1}"><td class="rn">${i + 2}</td>${r.map(c => `<td${num(c) ? ' class="num"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
// SVG drawn as an image: an <img> runs no script and fetches nothing. Production would use a
// blob: URL of the buffer.
function svg(t) {
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(t);
  return `<div class="checker"><img alt="${esc(FMT.svg.path.split('/').pop())}" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(t)}"></div>
  <div class="cap">${vb ? `${vb[1]} × ${vb[2]} · ` : ''}läpinäkyvä tausta ruudukkona</div>`;
}
// HTML in an inert frame: sandbox without allow-scripts, and a CSP with no network, the
// production pattern of the Word preview (documentPreview.ts frameCSP).
const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:";
function html(t) {
  const doc = t.replace(/<head>/i, `<head><meta http-equiv="Content-Security-Policy" content="${CSP}">`);
  return `<div class="cap">Esikatselu ei suorita skriptejä eikä hae mitään verkosta. Linkit eivät avaudu.</div>
  <iframe sandbox="" title="${esc(FMT.html.path.split('/').pop())}" srcdoc="${esc(doc)}"></iframe>`;
}
function preview() {
  const t = text();
  if (S.file === 'md') return `<section class="pv pv-md" tabindex="0" aria-label="Esikatselu"><div class="doc">${md(t)}</div></section>`;
  if (S.file === 'csv') return `<section class="pv pv-csv" tabindex="0" aria-label="Taulukko">${csv(t)}</section>`;
  if (S.file === 'svg') return `<section class="pv pv-img" tabindex="0" aria-label="Kuva">${svg(t)}</section>`;
  return `<section class="pv pv-html" tabindex="0" aria-label="Sivu">${html(t)}</section>`;
}

// ---------- Controls per variant ----------
const tip = (s) => `data-tip="${s}"`;
function textBtn(cls = 'ib') {
  const on = S.mode === 'text';
  return `<button type="button" class="${cls}" data-act="text" aria-pressed="${on}" aria-label="Teksti" aria-keyshortcuts="Escape" ${tip(on ? 'Teksti' : 'Takaisin tekstiin · Esc')}>${I.pencil}</button>`;
}
function pvBtn(single) {
  const p = fmt().pv, on = S.mode === 'preview', k = keys();
  const label = single && on ? 'Takaisin tekstiin' : p.label;
  return `<button type="button" class="ib" data-act="${single ? 'toggle' : 'preview'}" aria-pressed="${on}" aria-label="${p.label}" aria-keyshortcuts="${ARIA}" ${tip(`${label} · ${single && on ? 'Esc' : k.fast}`)}>${I[p.icon]}</button>`;
}
const rowCtl = () => S.v === 'row' && fmt().pv ? `<span class="pair" role="group" aria-label="Näkymä">${textBtn()}${pvBtn(false)}</span>` : '';
const headCtl = () => S.v === 'head' && fmt().pv ? `${pvBtn(true)}<span class="sep" aria-hidden="true"></span>` : '';
const cornerCtl = () => S.v === 'corner' && fmt().pv ? `<div class="corner" role="group" aria-label="Näkymä">${textBtn()}${pvBtn(false)}</div>` : '';

// ---------- Page ----------
const state = () => S.dirty[S.file] ? 'Muokattu' : S.saved[S.file] ? 'Tallennettu' : '';
function conversation() {
  return `<section class="conv" aria-label="Keskustelu">
    <div class="conv-head"><strong>Saaristoretken suunnitelma</strong><span>Valmis</span></div>
    <div class="conv-body">
      <article class="user">Päivitä ilmoittautuneet ja tee kutsusta HTML-sivu seuran sivuille.</article>
      <article><p>Päivitin tiedoston <code>${FMT.csv.path}</code> (34 ilmoittautunutta) ja tein kutsun tiedostoon <code>${FMT.html.path}</code>. Reittikartta on <code>${FMT.svg.path}</code>.</p></article>
    </div>
    <div class="compose">Kirjoita agentille…</div>
  </section>`;
}
function render() {
  const f = fmt();
  return `<div class="app" data-v="${S.v}" data-file="${S.file}">
    ${S.conv ? conversation() : ''}
    <section class="ed" aria-label="Editori">
      <header class="ed-head"><h2>CodeMirror 6</h2>${headCtl()}
        <button type="button" class="ib" aria-label="Editori koko ikkunaan">${S.conv ? I.forward : I.back}</button>
        <button type="button" class="ib" aria-label="Sulje editori">${I.cross}</button></header>
      <div class="ed-tools">
        <button type="button" class="b" data-act="files">Tiedostot</button>
        <code class="ed-file">${f.path}</code>
        <span class="ed-state" role="status">${state()}</span>
        ${rowCtl()}
        <button type="button" class="b" data-act="save" ${S.dirty[S.file] ? '' : 'disabled'}>Tallenna</button>
      </div>
      <div class="ed-body" data-mode="${S.mode}">
        <div class="src"><div class="code"><pre class="rows" aria-hidden="true">${rows(text())}</pre><textarea spellcheck="false" aria-label="Tiedoston teksti">${esc(text())}</textarea></div></div>
        ${S.mode === 'preview' ? preview() : ''}
        ${cornerCtl()}
      </div>
    </section>
    ${S.conv ? '' : `<aside class="rail">${I.chat}<span>Keskustelu</span></aside>`}
  </div>`;
}

// ---------- Behaviour ----------
const stage = document.getElementById('stage');
const $ = (sel) => stage.querySelector(sel);
let ro = null;
function sizeArea() { const ta = $('.code textarea'); if (ta) { ta.style.height = '0'; ta.style.height = $('.rows').offsetHeight + 'px'; } }
function watch() { ro?.disconnect(); const b = $('.ed-body'); if (!b) return; ro = new ResizeObserver(sizeArea); ro.observe(b); sizeArea(); }
function paint() {
  const src = $('.src'); if (src && src.offsetParent) S.srcTop[S.file] = src.scrollTop;
  stage.innerHTML = render(); watch();
  const s2 = $('.src'); if (s2 && s2.offsetParent) s2.scrollTop = S.srcTop[S.file];
}
// Same place both ways. Markdown: headings in the same order in the source and the preview,
// and the relative position inside the section. CSV: line n is row n. SVG/HTML: one picture.
const lineRows = () => [...stage.querySelectorAll('.rows .ln')];
function srcLine() { const src = $('.src'); return Math.max(0, lineRows().findIndex(r => r.offsetTop + r.offsetHeight > src.scrollTop + 2)); }
function headLines(t) { const out = []; let fence = false; t.split('\n').forEach((l, i) => { if (l.startsWith('```')) fence = !fence; else if (!fence && /^#{1,6} /.test(l)) out.push(i); }); return out; }
function pvHeads(pv) { const base = pv.firstElementChild.offsetTop; return [...pv.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => h.offsetTop - base); }
function lineToPv(line) {
  const pv = $('.pv'); if (!pv) return;
  if (S.file === 'csv') {
    const r = pv.querySelector(`tr[data-line="${line}"]`);
    pv.scrollTop = r ? r.getBoundingClientRect().top - pv.getBoundingClientRect().top + pv.scrollTop - pv.querySelector('thead th').offsetHeight : 0;
    return;
  }
  if (S.file !== 'md') return;
  const hs = headLines(text()), ys = pvHeads(pv), total = text().split('\n').length;
  let k = -1; hs.forEach((h, i) => { if (h <= line) k = i; });
  if (k < 0) { pv.scrollTop = 0; return; }
  const a = hs[k], b = hs[k + 1] ?? total, f = (line - a) / Math.max(1, b - a);
  const ya = ys[k], yb = ys[k + 1] ?? pv.scrollHeight;
  pv.scrollTop = Math.max(0, ya + f * (yb - ya) - 12);
}
function pvLine() {
  const pv = $('.pv');
  if (S.file === 'csv') { const head = pv.querySelector('thead th').getBoundingClientRect().bottom; const r = [...pv.querySelectorAll('tbody tr')].find(r => r.getBoundingClientRect().top >= head - 2); return r && pv.scrollTop > 0 ? +r.dataset.line : 0; }
  if (S.file !== 'md') return 0;
  const y = pv.scrollTop + 12, hs = headLines(text()), ys = pvHeads(pv), total = text().split('\n').length;
  let k = -1; ys.forEach((h, i) => { if (h <= y) k = i; });
  if (k < 0) return 0;
  const ya = ys[k], yb = ys[k + 1] ?? pv.scrollHeight, f = (y - ya) / Math.max(1, yb - ya);
  const a = hs[k], b = hs[k + 1] ?? total;
  return Math.floor(a + f * (b - a));
}
function setMode(want) {
  if (!fmt().pv) return;
  const next = want === 'toggle' ? (S.mode === 'text' ? 'preview' : 'text') : want;
  if (next === S.mode) return;
  const line = S.mode === 'preview' ? pvLine() : srcLine();
  const holder = document.activeElement?.matches('.code textarea') ? 'src' : $('.pv')?.contains(document.activeElement) ? 'pv' : null;
  S.mode = next; paint();
  if (next === 'text') {
    const r = lineRows()[line]; $('.src').scrollTop = r ? r.offsetTop : 0;
    // Focus follows the part that is left (production rule in BrowserEditor `toggle`).
    if (holder) $('.code textarea').focus({ preventScroll: true });
  } else {
    lineToPv(line);
    if (holder) $('.pv').focus({ preventScroll: true });
  }
}
const inEditor = () => document.activeElement === document.body || !!stage.querySelector('.ed')?.contains(document.activeElement);
// Captured before the editor sees them. e.code, not e.key, so a layout or Option never
// changes which key matches; AltGr (Ctrl+Alt on Windows) is excluded by !altKey.
document.addEventListener('keydown', (e) => {
  if (!stage.querySelector('.app') || !inEditor() || !fmt().pv) return;
  const mod = S.kbd === 'mac' ? e.metaKey || e.ctrlKey : e.ctrlKey || e.metaKey;
  if (mod && !e.altKey && ((e.shiftKey && e.code === 'KeyV') || (!e.shiftKey && e.code === 'KeyE'))) { e.preventDefault(); e.stopPropagation(); setMode('toggle'); }
  else if (e.key === 'Escape' && S.mode === 'preview') { e.preventDefault(); e.stopPropagation(); setMode('text'); }
}, true);
stage.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  if (act === 'save') { S.dirty[S.file] = false; S.saved[S.file] = true; paint(); return; }
  if (act === 'files') return;
  setMode(act);
});
// Arrows and digits in the preview scroll it; they must not reach the picker's document listener.
stage.addEventListener('keydown', (e) => { if (e.target.closest?.('.pv')) e.stopPropagation(); });
stage.addEventListener('input', (e) => {
  const ta = e.target.closest('.code textarea'); if (!ta) return;
  S.texts[S.file] = ta.value; S.dirty[S.file] = true; S.saved[S.file] = false;
  $('.rows').innerHTML = rows(ta.value); sizeArea();
  $('.ed-state').textContent = state(); $('[data-act="save"]').disabled = false;
});
// Harness settings live outside the stage.
document.addEventListener('change', (e) => {
  const s = e.target.closest('[data-set]'); if (!s) return;
  const k = s.dataset.set;
  if (k === 'file') { const src = $('.src'); if (src && src.offsetParent) S.srcTop[S.file] = src.scrollTop; S.file = s.value; S.mode = 'text'; }
  if (k === 'conv') S.conv = s.value === '1';
  if (k === 'kbd') S.kbd = s.value;
  paint();
});

function start(v) {
  reset(); S.v = v;
  document.getElementById('hn-name').textContent = VARIANTS[v].name;
  document.getElementById('hn-note').textContent = VARIANTS[v].note;
  for (const el of document.querySelectorAll('[data-set]')) el.value = el.dataset.set === 'file' ? S.file : el.dataset.set === 'conv' ? (S.conv ? '1' : '0') : S.kbd;
  requestAnimationFrame(watch);
  return render();
}
window.variants = [() => start('row'), () => start('head'), () => start('corner')];
// Test hook for verify.mjs.
window.__pv = { S, setMode };
})();
