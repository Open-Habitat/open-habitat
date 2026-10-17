// Git-tila keskustelunäkymässä (issue proto-git-status-panel). Sama natiivi havainto
// kaikissa suunnissa: työtilasivun Git-kerroksen tiedot (haara, seurantahaara, ↑↓,
// muutokset, viimeisin haku) ja niiden lisäksi host-tiedot, joita tuotanto ei vielä anna:
// pohjahaaran vertailu, saapuvat ja lähettämättömät commitit nimeltä, rivimäärät ja
// Hae etärepo (`git fetch` käyttäjänä). Suunnat piirtävät saman tiedon eri paikkaan.
(() => {
const IC = {
  branch: SVG('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10"/><path d="M18 9c0 5-6 4-12 8"/>'),
  up: SVG('<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>', ' stroke-width="2.2"'),
  down: SVG('<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>', ' stroke-width="2.2"'),
  file: SVG('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>'),
  fetch: SVG('<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>'),
  reread: SVG('<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/>'),
  x: SVG('<path d="M6 6l12 12M18 6 6 18"/>'),
  side: SVG('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>'),
};

// ---------- Synthetic native facts ----------
const T0 = performance.now(); const NOW0 = 14 * 60 + 37; // minutes since midnight
const nowM = () => NOW0 + Math.floor((performance.now() - T0) / 60000);
const hm = (m) => `${Math.floor(m / 60)}.${String(m % 60).padStart(2, '0')}`;
const ago = (m) => { const d = nowM() - m; return d < 1 ? 'juuri nyt' : `${d} min sitten`; };
const C = (h, s, t) => ({ h, s, t });
const G0 = () => ({
  branch: 'status-rivit', upstream: 'origin/status-rivit', base: 'main', baseRef: 'origin/main',
  fetchedAt: NOW0 - 25, readAt: NOW0, fetching: false, fresh: '',
  // HEAD..@{u} and @{u}..HEAD
  unpushed: [C('a41c9e2', 'Statusrivit: --since-suodatus', 14 * 60 + 31), C('7be03d1', 'Statusrivien jäsennys omaksi funktioksi', 14 * 60 + 18)],
  incoming: [C('3d8f0a1', 'README: statusskriptin käyttöesimerkki', 13 * 60 + 55)],
  // origin/main..HEAD and HEAD..origin/main
  baseAhead: [C('9c1e5b2', 'Statusrivit JSON-muotoon', 12 * 60 + 40), C('0f7a3d4', 'Lue status.md:n polku argumentista', 12 * 60 + 2), C('6be2c90', 'Statusskriptin ensimmäinen versio', 11 * 60 + 47)],
  baseBehind: [C('e19f4b0', 'CI: pip-välimuisti', 13 * 60 + 20), C('c7d2e18', 'Aikavyöhyke tulosteeseen', 12 * 60 + 55), C('52aa0c3', 'Päivitä riippuvuudet', 10 * 60 + 12)],
  files: [
    { st: ' M', path: 'scripts/status_rows.py', add: 18, del: 4 },
    { st: '??', path: 'tests/test_status_rows.py', add: 52, del: 0 },
    { st: 'M ', path: 'README.md', add: 9, del: 1 },
    { st: ' M', path: 'pyproject.toml', add: 2, del: 0 },
  ],
});
let G = G0();
const ST = { ' M': 'Muutettu', 'M ': 'Muutettu · indeksissä', 'MM': 'Muutettu', '??': 'Uusi, ei seurannassa', ' D': 'Poistettu', 'A ': 'Lisätty' };
const STK = { ' M': 'm', 'M ': 'm', 'MM': 'm', '??': 'u', ' D': 'd', 'A ': 'a' };
const STL = { ' M': 'M', 'M ': 'M', 'MM': 'M', '??': 'U', ' D': 'D', 'A ': 'A' };
const ahead = () => G.unpushed.length; const behind = () => G.incoming.length;
const baseAhead = () => G.unpushed.length + G.baseAhead.length; const baseBehind = () => G.baseBehind.length;
const dirty = () => G.files.length;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const sentence = () => `Haara ${G.branch}: ${ahead()} lähettämättä ja ${behind()} tulossa ${G.upstream}-haarasta, ${baseAhead()} edellä ja ${baseBehind()} jäljessä ${G.base}-haaraa, ${plural(dirty(), 'muuttunut tiedosto', 'muuttunutta tiedostoa')}. Etärepo haettu ${ago(G.fetchedAt)}.`;

// Hae etärepo: `git fetch` as the person; main has moved on in the meantime.
function fetchRemote() {
  if (G.fetching) return;
  G.fetching = true; paint();
  setTimeout(() => {
    G.fetching = false; G.fetchedAt = nowM(); G.readAt = nowM();
    if (!G.baseBehind.some(c => c.h === 'b8e2f17')) { G.baseBehind.unshift(C('b8e2f17', 'Korjaa maanantain CI-aikakatkaisu', nowM() - 1)); G.fresh = 'base'; }
    else G.fresh = '';
    const said = !!G.fresh; paint(); setTimeout(() => { G.fresh = ''; }, 2500); toast(said ? 'Etärepo haettu. main on saanut yhden uuden commitin.' : 'Etärepo haettu. Ei uutta.');
  }, 1300);
}
function reread() { G.readAt = nowM(); G.fresh = ''; paint(); toast('Git-tila luettu uudelleen.'); }
// The turn's edit lands in scripts/status_rows.py; the view re-reads when the turn ends.
let wasWorking = false;
APP.painted.unshift(() => {
  if (wasWorking && !UI.working) { const f = G.files[0]; f.add = 26; f.del = 5; G.readAt = nowM(); G.fresh = 'files'; setTimeout(() => { G.fresh = ''; }, 2500); }
  wasWorking = UI.working;
});

// ---------- Shared pieces ----------
const arrows = (a, b, cls = '') => `<span class="gs-ab ${cls}"><span class="gs-n${a ? '' : ' zero'}" title="${plural(a, 'commit', 'committia')} lähettämättä">${IC.up}${a}</span><span class="gs-n${b ? '' : ' zero'}" title="${plural(b, 'commit', 'committia')} tulossa">${IC.down}${b}</span></span>`;
const dirtyMark = () => `<span class="gs-dirty" title="${plural(dirty(), 'muuttunut tiedosto', 'muuttunutta tiedostoa')}"><span class="gs-dot" aria-hidden="true"></span>${dirty()}</span>`;
const commit = (c, kind) => `<li class="gs-commit ${kind}"><code class="gs-hash">${c.h}</code><span class="gs-subj">${esc(c.s)}</span><time>${hm(c.t)}</time></li>`;
const commits = (list, kind) => `<ul class="gs-commits">${list.map(c => commit(c, kind)).join('')}</ul>`;
const OPEN = {};
function fold(key, label, list, kind, opts = {}) {
  const open = opts.always || (OPEN[key] ?? false);
  if (!list.length) return `<div class="gs-fold empty"><span class="gs-fold-label">${label}</span><span class="gs-none">ei yhtään</span></div>`;
  const head = opts.always ? `<div class="gs-fold-head static"><span class="gs-fold-label">${label}</span><span class="gs-count">${list.length}</span></div>`
    : `<button type="button" class="gs-fold-head" data-gs="fold" data-key="${key}" aria-expanded="${open}">${CHEV}<span class="gs-fold-label">${label}</span><span class="gs-count">${list.length}</span></button>`;
  return `<div class="gs-fold${opts.fresh ? ' fresh' : ''}">${head}${open ? commits(list, kind) : ''}</div>`;
}
const stat = (f, bars) => {
  const n = f.add + f.del; const w = bars ? Math.max(2, Math.round(Math.min(1, n / 60) * 48)) : 0;
  return `<span class="gs-stat"><span class="add">+${f.add}</span>${f.del ? `<span class="del">−${f.del}</span>` : ''}${bars ? `<span class="gs-bar" style="width:${w}px"><i style="flex:${f.add}"></i><b style="flex:${f.del}"></b></span>` : ''}</span>`;
};
const fileRow = (f, bars) => {
  const slash = f.path.lastIndexOf('/');
  return `<li class="gs-file${G.fresh === 'files' && f === G.files[0] ? ' fresh' : ''}"><span class="gs-st ${STK[f.st]}" title="${ST[f.st]}">${STL[f.st]}</span><span class="gs-path mono"><span class="dir">${esc(f.path.slice(0, slash + 1))}</span>${esc(f.path.slice(slash + 1))}</span>${stat(f, bars)}</li>`;
};
const files = (bars) => `<ul class="gs-files">${G.files.map(f => fileRow(f, bars)).join('')}</ul>`;
const fetchBtn = (cls = 'secondary') => `<button type="button" class="${cls} gs-fetch" data-gs="fetch"${G.fetching ? ' aria-disabled="true" aria-busy="true"' : ''} title="Ajaa git fetch -komennon omana käyttäjänäsi. Ei muuta haaraa eikä tiedostoja.">${IC.fetch}<span>${G.fetching ? 'Haetaan…' : 'Hae etärepo'}</span></button>`;
const rereadBtn = () => `<button type="button" class="gs-quiet" data-gs="reread" title="Lukee Git-tilan levyltä uudelleen. Ei hae verkosta.">${IC.reread}<span>Lue uudelleen</span></button>`;
const freshness = () => `<p class="gs-note">Etärepo haettu <strong>${ago(G.fetchedAt)}</strong> (${hm(G.fetchedAt)}). Tulossa olevat commitit ovat sen haun tietoa; tila on luettu ${hm(G.readAt)}.</p>`;
// Two comparisons: the tracking branch (push/pull) and the base branch (merge).
function cmpRow(label, sub, a, b, aWord, bWord) {
  return `<div class="gs-cmp"><div class="gs-cmp-name"><span class="mono">${esc(label)}</span><span class="gs-sub">${sub}</span></div><div class="gs-cmp-n"><span class="gs-n${a ? '' : ' zero'}">${IC.up}${a} <span class="w">${aWord}</span></span><span class="gs-n${b ? '' : ' zero'}">${IC.down}${b} <span class="w">${bWord}</span></span></div></div>`;
}
const upCmp = () => cmpRow(G.upstream, 'seurantahaara', ahead(), behind(), 'lähettämättä', 'tulossa');
const baseCmp = () => cmpRow(G.base, `pohjahaara · ${G.baseRef}`, baseAhead(), baseBehind(), 'edellä', 'jäljessä');
const branchHead = () => `<div class="gs-head"><span class="gs-br-ic">${IC.branch}</span><span class="gs-br mono">${esc(G.branch)}</span><span class="gs-ws mono">~/src/aurinkokello</span></div>`;

// ---------- State per direction ----------
const V = { dir: 'v1', open: false, tab: 'files' };
function close() { if (!V.open) return; V.open = false; paint(); }

// ===== 1 · Yläpalkissa: chip beside the model, anchored popover / phone sheet =====
const baseActions = APP.actions;
function chipV1() {
  return `<button type="button" class="gs-chip" data-gs="toggle" aria-expanded="${V.open}" aria-haspopup="dialog" aria-label="${esc(sentence())}" title="Git-tila · avaa tiedot">${IC.branch}<span class="gs-chip-br mono">${esc(G.branch)}</span>${arrows(ahead(), behind())}${dirtyMark()}</button>`;
}
function bodyV1() {
  return `<div class="gs-panel gs-compact" role="dialog" aria-label="Git-tila"><div class="gs-panel-top">${branchHead()}<button type="button" class="icon-btn gs-x" data-gs="close" aria-label="Sulje">${IC.x}</button></div>
<section class="gs-sec">${upCmp()}${fold('v1-unp', 'Lähettämättä', G.unpushed, 'out')}${fold('v1-inc', 'Tulossa', G.incoming, 'in')}</section>
<section class="gs-sec${G.fresh === 'base' ? ' fresh' : ''}">${baseCmp()}${fold('v1-bb', `Jäljessä ${G.base}-haarasta`, G.baseBehind, 'in', { fresh: G.fresh === 'base' })}</section>
<section class="gs-sec"><h4>Muutokset <span class="gs-count">${dirty()}</span></h4>${files(false)}</section>
<div class="gs-foot">${freshness()}<div class="gs-acts">${fetchBtn()}${rereadBtn()}</div></div></div>`;
}

// ===== 2 · Kentän yllä: a badge with the background badges, the same floating panel =====
function badgeV2() {
  return `<button type="button" class="bg-badge gs-badge${G.fresh ? ' pulse' : ''}" data-gs="toggle" aria-expanded="${V.open}" aria-label="${esc(sentence())}" title="${esc(sentence())}"><span class="bg-kind-ic">${IC.branch}</span><span class="gs-badge-br mono">${esc(G.branch)}</span>${arrows(ahead(), behind())}${dirtyMark()}</button>`;
}
function popV2() {
  const tab = (k, label, n) => `<button type="button" role="tab" class="bg-tab" data-gs="tab" data-key="${k}" aria-selected="${V.tab === k}">${label}<span class="bg-tab-n">${n}</span></button>`;
  const body = V.tab === 'files'
    ? `${files(false)}<p class="gs-note pad">Työpuu verrattuna viimeisimpään committiin. Agentin muutokset näkyvät, kun vuoro päättyy.</p>`
    : `<div class="gs-cmpbox">${upCmp()}${fold('v2-unp', 'Lähettämättä', G.unpushed, 'out', { always: true })}${fold('v2-inc', 'Tulossa', G.incoming, 'in', { always: true })}</div>
<div class="gs-cmpbox${G.fresh === 'base' ? ' fresh' : ''}">${baseCmp()}${fold('v2-ba', `Edellä ${G.base}-haaraa`, [...G.unpushed, ...G.baseAhead], 'out')}${fold('v2-bb', `Jäljessä ${G.base}-haarasta`, G.baseBehind, 'in', { fresh: G.fresh === 'base' })}</div>`;
  return `<div class="bg-pop gs-pop" role="dialog" aria-label="Git-tila"><div class="bg-tabs" role="tablist" aria-label="Git">${tab('files', 'Muutokset', dirty())}${tab('commits', 'Commitit', `↑${ahead()} ↓${behind()}`)}<span class="gs-tabs-br mono">${IC.branch}${esc(G.branch)}</span><button type="button" class="icon-btn bg-x" data-gs="close" aria-label="Sulje">${IC.x}</button></div>
<div class="bg-pop-body" role="tabpanel">${body}</div><div class="gs-foot row">${freshness()}<div class="gs-acts">${fetchBtn()}${rereadBtn()}</div></div></div>`;
}

// ===== 3 · Haararivi: a full-width line under the top bar, a side panel with everything open =====
function lineV3() {
  const part = (cls, html) => `<span class="gs-part ${cls}">${html}</span>`;
  return `<button type="button" class="gs-line-btn" data-gs="toggle" aria-expanded="${V.open}" aria-controls="gs-side" aria-label="${esc(sentence())} Avaa Git-tiedot.">
${part('br', `${IC.branch}<span class="mono">${esc(G.branch)}</span>`)}
${part('up', `<span class="gs-n${ahead() ? '' : ' zero'}">${IC.up}${ahead()}</span><span class="gs-n${behind() ? '' : ' zero'}">${IC.down}${behind()}</span><span class="w">${esc(G.upstream)}</span>`)}
${part('base', `<span class="w">${G.base}:</span> ${baseAhead()} edellä, ${baseBehind()} jäljessä`)}
${part('files', `${dirtyMark()}<span class="w">${dirty() === 1 ? 'muutos' : 'muutosta'}</span>`)}
${part('age', `haettu ${ago(G.fetchedAt)}`)}
<span class="gs-line-ic">${IC.side}</span></button>`;
}
function sideV3() {
  return `<aside class="gs-side" id="gs-side" role="dialog" aria-label="Git-tila"><div class="gs-panel-top">${branchHead()}<button type="button" class="icon-btn gs-x" data-gs="close" aria-label="Sulje">${IC.x}</button></div>
<div class="gs-side-fetch">${fetchBtn('primary')}${rereadBtn()}</div>${freshness()}
<section class="gs-sec"><h4>${esc(G.upstream)} <span class="gs-sub">seurantahaara</span></h4>${fold('v3-unp', `${IC.up} Lähettämättä`, G.unpushed, 'out', { always: true })}${fold('v3-inc', `${IC.down} Tulossa`, G.incoming, 'in', { always: true })}</section>
<section class="gs-sec${G.fresh === 'base' ? ' fresh' : ''}"><h4>${G.base} <span class="gs-sub">pohjahaara · ${G.baseRef}</span></h4>${fold('v3-ba', `${IC.up} Edellä`, [...G.unpushed, ...G.baseAhead], 'out', { always: true })}${fold('v3-bb', `${IC.down} Jäljessä`, G.baseBehind, 'in', { always: true, fresh: G.fresh === 'base' })}</section>
<section class="gs-sec"><h4>Muutokset <span class="gs-count">${dirty()}</span><span class="gs-total">${stat({ add: G.files.reduce((s, f) => s + f.add, 0), del: G.files.reduce((s, f) => s + f.del, 0) }, false)}</span></h4>${files(true)}</section></aside>`;
}

// ---------- Mounting ----------
const line = document.createElement('div'); line.className = 'gs-line';
const pop = document.createElement('div'); pop.className = 'gs-host';
function paintGit() {
  const c1 = UI.sel === 'c1';
  // 1: chip in the top bar (APP.actions), panel anchored under it.
  // 2: badge before the background badges; the strip is repainted by its own hook first.
  if (V.dir === 'v2' && c1) {
    let wrap = document.querySelector('.bg-strip .bg-badges-wrap');
    const strip = document.querySelector('.bg-strip');
    if (strip && !wrap) { strip.hidden = false; strip.innerHTML = '<div class="bg-badges-wrap"><div class="bg-badges" role="group" aria-label="Taustatyö"></div></div>'; strip.dataset.html = ''; wrap = strip.firstChild; }
    if (wrap) {
      for (const el of wrap.querySelectorAll('.gs-badge, .gs-sep, .gs-pop')) el.remove();
      wrap.querySelector('.bg-badges').insertAdjacentHTML('afterbegin', badgeV2() + '<span class="gs-sep" aria-hidden="true"></span>');
      if (V.open) wrap.insertAdjacentHTML('afterbegin', popV2());
    }
  }
  // 3: the line between the top bar and the body.
  if (V.dir === 'v3' && c1) { if (line.parentNode !== uiMain) uiMain.insertBefore(line, uiTop.nextSibling); line.innerHTML = lineV3(); }
  else line.remove();
  if (pop.parentNode !== uiMain) uiMain.appendChild(pop);
  pop.className = `gs-host ${V.dir}${V.open && c1 ? ' on' : ''}`;
  pop.innerHTML = !c1 || !V.open ? '' : V.dir === 'v1' ? `<div class="gs-scrim" data-gs="close"></div>${bodyV1()}` : V.dir === 'v3' ? `<div class="gs-scrim" data-gs="close"></div>${sideV3()}` : '';
  if (line.isConnected) pop.style.setProperty('--gs-top', `${line.offsetTop + line.offsetHeight}px`);
  uiFrame.classList.toggle('gs-side-open', V.dir === 'v3' && V.open && c1);
}
APP.painted.push(paintGit);
APP.actions = (c) => {
  const html = baseActions(c);
  return V.dir === 'v1' && c.id === 'c1' ? chipV1() + html : html;
};
// Clock-only refresh: the line's "haettu … sitten" without rebuilding buttons.
setInterval(() => { for (const el of document.querySelectorAll('.gs-part.age')) el.textContent = `haettu ${ago(G.fetchedAt)}`; }, 15000);

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-gs]');
  if (!t) {
    if (V.open && V.dir !== 'v3' && !e.target.closest('.gs-panel, .gs-pop, .gs-chip, .gs-badge, .proto-picker')) close();
    return;
  }
  e.preventDefault(); e.stopPropagation();
  if (t.getAttribute('aria-disabled') === 'true') return;
  const a = t.dataset.gs;
  if (a === 'toggle') { V.open = !V.open; if (V.open) { UI.pop = false; if (window.STRIP) STRIP.B.open = null; } }
  else if (a === 'close') V.open = false;
  else if (a === 'tab') V.tab = t.dataset.key;
  else if (a === 'fold') OPEN[t.dataset.key] = !(OPEN[t.dataset.key] ?? false);
  else if (a === 'fetch') return fetchRemote();
  else if (a === 'reread') return reread();
  paint();
}, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && V.open) { V.open = false; paint(); } });

function view(dir) {
  return () => { V.dir = dir; V.open = false; V.tab = 'files'; G = G0(); wasWorking = false; for (const k in OPEN) delete OPEN[k]; STRIP.reset(); UI.sel = 'c1'; return appView(); };
}
window.v1 = view('v1'); window.v2 = view('v2'); window.v3 = view('v3');
})();
