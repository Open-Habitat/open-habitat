// Riffi 14.10.2026 etusivun Työtilat-suunnasta. Sivupalkin Etusivu palaa tähän;
// keskustelurivi avaa kirjaston keskustelun. Jokaisella työtilalla on valikko
// (…) työtilan hallintaan, ja uuden työtilan voi luoda GitHubista tai hakemistona.
(() => {
const ICON_FOLDER = SVG('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>');
const ICON_GH = SVG('<path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>');
const ICON_MORE = SVG('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>');
const ICON_FWD = SVG('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>');
const ICON_COPY = SVG('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>');
const ICON_EXT = SVG('<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/>');
const ICON_TRASH = SVG('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>');
const ICON_ARCH = SVG('<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>');
const ICON_BRANCH = SVG('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10"/><path d="M18 10c0 4-6 3-12 7"/>');

// Lisää työtiloja, jotta skaalautuminen näkyy, ja tiedot korteille.
const EXTRA = [
  { id: 'reitti', path: '~/src/reitti', open: false, convs: [{ id: 'r1', title: 'Pysäkkihaun sumea vertailu', st: 'done' }, { id: 'r2', title: 'HSL-rajapinnan virheviestit', st: 'done' }] },
  { id: 'kuitit', path: '~/src/kuitit', open: false, convs: [{ id: 'k1', title: 'OCR-tuloksen päivämäärät', st: 'done' }] },
  { id: 'wilma-cli', path: '~/src/wilma-cli', open: false, convs: [] },
  { id: 'taskfleet', path: '~/src/taskfleet', open: false, convs: [{ id: 't1', title: 'run wait --any -tulosteen muoto', st: 'done' }, { id: 't2', title: 'Supervisorin uudelleenkäynnistys', st: 'done' }, { id: 't3', title: 'Profiilien dry-run', st: 'done' }] },
];
for (const w of EXTRA) if (!UI.ws.some(x => x.id === w.id)) UI.ws.push(w);
const WS = {
  aurinkokello: { branch: 'main', dirty: 2, gh: 'maintainer/aurinkokello', t: '1 min' },
  issuectl: { branch: 'search-negation', dirty: 0, gh: 'jarimustonen/issuectl', t: '25 min' },
  fleetrepo: { branch: 'main', dirty: 0, gh: 'maintainer/fleetrepo', t: 'ma' },
  'open-habitat': { branch: 'main', dirty: 5, gh: 'Open-Habitat/open-habitat', t: 'nyt' },
  reitti: { branch: 'main', dirty: 0, gh: 'maintainer/reitti', t: '9.10.' },
  kuitit: { branch: 'main', dirty: 0, gh: 'maintainer/kuitit', t: '2.10.' },
  'wilma-cli': { branch: 'main', dirty: 0, gh: null, t: 'luotu 1.10.' },
  taskfleet: { branch: 'main', dirty: 0, gh: 'jarimustonen/taskfleet', t: 'eilen' },
};
const INFO = {
  c2: { t: '8 min', say: 'Pakkaus valmis: 214 kuvaa, 38 Mt → 11 Mt. Poistanko alkuperäiset, vai jätetäänkö ne <span class="mono">originals/</span>-hakemistoon?' },
  c10: { t: '25 min', say: 'Kumpi muoto: <span class="mono">-label:bug</span> vai <span class="mono">NOT label:bug</span>? Ensimmäinen on lyhyempi, jälkimmäinen sama kuin GitHubissa.' },
  c1: { t: '1 min', say: 'Skripti tulostaa nyt viime viikon statusrivit. Lisätäänkö JSON-tuloste samaan ajoon?' },
  c5: { t: 'nyt', doing: 'ajaa <span class="mono">npm test</span> · 2 min' },
  c4: { t: '3 t', say: 'Prosessin tilaa ei saatu luettua.' },
};
const GH = ['maintainer/reitti', 'maintainer/kuitit', 'maintainer/wilma-cli', 'jarimustonen/taskfleet'];
let HOME = true, CUR = 'v1', MENU = null, NWS = 'gh', OPEN = { aurinkokello: true, issuectl: true, 'open-habitat': true };
const st = (c) => convState(c);
const info = (c) => INFO[c.id] || {};
const mark = (c) => { const [l, m] = STATES[st(c)] ?? ['Ei aloitettu', '<span class="st-none"></span>']; return `<span class="st" role="img" aria-label="${l}" title="${l}">${m}</span>`; };
const convsOf = (w) => w.convs.filter(c => !c.archived);
const active = (w) => convsOf(w).filter(c => st(c) !== 'done').sort((a, b) => (STATE_ORDER[st(a)] ?? 4) - (STATE_ORDER[st(b)] ?? 4));
const count = (w, s) => convsOf(w).filter(c => st(c) === s).length;
const weight = (w) => count(w, 'attention') * 100 + count(w, 'waiting') * 10 + count(w, 'working');
const sorted = () => [...UI.ws].sort((a, b) => weight(b) - weight(a));
const needs = () => UI.ws.flatMap(w => convsOf(w).map(c => ({ ...c, ws: w }))).filter(c => ['attention', 'waiting'].includes(st(c))).sort((a, b) => (st(a) === 'attention' ? 0 : 1) - (st(b) === 'attention' ? 0 : 1));
const pills = (w) => [['attention', 'uusi'], ['waiting', 'odottaa'], ['working', 'käynnissä']].map(([s, l]) => { const k = count(w, s); return k ? `<span class="pill ${s}">${STATES[s][1]}${k} ${l}</span>` : ''; }).join('');
const meta = (w) => WS[w.id] || { branch: 'main', dirty: 0, gh: null, t: 'nyt' };
const gitLine = (w) => { const m = meta(w); return `<span class="git mono">${ICON_BRANCH}${esc(m.branch)}${m.dirty ? `<span class="dirty" title="${m.dirty} muuttunutta tiedostoa">+${m.dirty}</span>` : ''}</span>`; };

// ---------- Workspace menu (…) ----------
function wsMenu(w) {
  const m = meta(w);
  return `<div class="h-menu" role="menu" aria-label="Työtila ${w.id}">
<button type="button" role="menuitem" data-h-new="${w.id}">${ICON_PLUS}<span>Uusi keskustelu</span></button>
<button type="button" role="menuitem" data-h-ws="${w.id}">${ICON_FWD}<span>Avaa työtilasivu</span></button>
<hr>
<button type="button" role="menuitem" data-h-copy="${w.path}">${ICON_COPY}<span>Kopioi polku</span><span class="kbd mono">${esc(w.path)}</span></button>
${m.gh ? `<button type="button" role="menuitem" data-h-gh="${m.gh}">${ICON_EXT}<span>Avaa GitHubissa</span></button>` : ''}
<button type="button" role="menuitem" data-h-arch="${w.id}">${ICON_ARCH}<span>Piilota etusivulta</span></button>
<hr>
<button type="button" role="menuitem" class="danger" aria-disabled="true" title="Palautettava poisto suunnitellaan ensin (recoverable-workspace-deletion).">${ICON_TRASH}<span>Poista työtila…</span><span class="why">tulossa</span></button>
</div>`;
}
const moreBtn = (w) => `<span class="h-anchor"><button type="button" class="icon-btn more" data-h-more="${w.id}" aria-haspopup="menu" aria-expanded="${MENU === w.id}" aria-label="Työtilan ${w.id} toiminnot" title="Toiminnot">${ICON_MORE}</button>${MENU === w.id ? wsMenu(w) : ''}</span>`;
const addBtn = (w) => `<button type="button" class="icon-btn" data-h-new="${w.id}" aria-label="Uusi keskustelu työtilassa ${w.id}" title="Uusi keskustelu">${ICON_PLUS}</button>`;
const nwsBtn = (cls = 'h-primary') => `<button type="button" class="${cls}" data-h-nws>${ICON_FOLDER}<span>Uusi työtila</span></button>`;

function newConv(wsId) {
  const w = UI.ws.find(x => x.id === wsId); const id = `n${++UI.created}`;
  w.convs.unshift({ id, title: 'Uusi keskustelu', st: 'new' }); w.open = true;
  HOME = false; MENU = null; openConv(id);
}
const dlg = document.createElement('dialog'); dlg.className = 'confirm nws'; document.body.appendChild(dlg);
function paintDlg() {
  const gh = NWS === 'gh';
  dlg.innerHTML = `<form method="dialog"><h3>Uusi työtila</h3>
<div class="seg" role="tablist"><button type="button" role="tab" aria-selected="${gh}" data-nws="gh">${ICON_GH}Kloonaa GitHubista</button><button type="button" role="tab" aria-selected="${!gh}" data-nws="dir">${ICON_FOLDER}Uusi hakemisto</button></div>
${gh ? `<label class="fld"><span>Repositorio</span><input name="v" class="mono" placeholder="omistaja/repo" autocomplete="off" required></label>
<ul class="sugg">${GH.filter(r => !UI.ws.some(w => w.id === r.split('/')[1])).concat(['maintainer/dotfiles', 'maintainer/kirjasto']).map(r => `<li><button type="button" data-sugg="${r}" class="mono">${r}</button></li>`).join('')}</ul>
<p class="hint">Kloonataan hakemistoon <span class="mono">~/src/&lt;repo&gt;</span> sinun GitHub-tunnuksillasi.</p>`
    : `<label class="fld"><span>Nimi</span><input name="v" class="mono" placeholder="uusi-projekti" autocomplete="off" required pattern="[a-z0-9._-]+"></label>
<p class="hint">Luodaan <span class="mono">~/src/&lt;nimi&gt;</span> ja alustetaan Git-repoksi.</p>`}
<div class="confirm-actions"><button class="secondary" value="cancel" formnovalidate>Peruuta</button><button class="primary" value="ok">Luo työtila</button></div></form>`;
}
function openDlg() { MENU = null; paintDlg(); dlg.showModal(); dlg.querySelector('input').focus(); }
dlg.addEventListener('click', (e) => {
  const t = e.target.closest('[data-nws], [data-sugg]'); if (!t) return;
  if (t.dataset.nws) { NWS = t.dataset.nws; paintDlg(); dlg.querySelector('input').focus(); }
  else dlg.querySelector('input').value = t.dataset.sugg;
});
dlg.addEventListener('close', () => {
  if (dlg.returnValue !== 'ok') return;
  const v = dlg.querySelector('input').value.trim(); const id = v.split('/').pop();
  if (!id || UI.ws.some(w => w.id === id)) return toast(`Työtila ${id} on jo olemassa.`);
  UI.ws.push({ id, path: `~/src/${id}`, open: true, convs: [] });
  WS[id] = { branch: 'main', dirty: 0, gh: NWS === 'gh' ? v : null, t: 'luotu nyt' }; OPEN[id] = true;
  paint(); rerender(); toast(NWS === 'gh' ? `Kloonattu ${v} → ~/src/${id}` : `Työtila ${id} luotu`);
});

// ---------- Home state across the library frame ----------
function rerender() { if (HOME) stage.innerHTML = window[CUR](true); }
APP.painted.push(() => {
  uiFrame.classList.toggle('is-home', HOME);
  uiRail.querySelector('.home-row').toggleAttribute('aria-current', HOME);
  if (HOME) {
    uiRail.querySelectorAll('.conv-row[aria-current]').forEach(a => a.removeAttribute('aria-current'));
    uiTop.innerHTML = `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button><div class="tb-title"><strong>Etusivu</strong></div>`;
  }
});
document.addEventListener('click', async (e) => {
  if (e.target.closest('.proto-picker')) return;
  if (e.target.closest('[data-ui="home"]')) { e.preventDefault(); e.stopPropagation(); HOME = true; UI.drawer = false; MENU = null; paint(); stage.innerHTML = window[CUR](true); return; }
  if (e.target.closest('[data-conv], [data-ws-add]')) { HOME = false; MENU = null; return; }
  const t = e.target.closest('[data-h-more], [data-h-new], [data-h-nws], [data-h-ws], [data-h-copy], [data-h-gh], [data-h-arch], [data-h-tog], .h-menu [aria-disabled]');
  if (!t) { if (MENU && !e.target.closest('.h-menu')) { MENU = null; rerender(); } return; }
  e.preventDefault(); e.stopPropagation();
  const d = t.dataset;
  if (t.getAttribute('aria-disabled') === 'true') return toast(t.title);
  if (d.hMore) { MENU = MENU === d.hMore ? null : d.hMore; return rerender(); }
  if (d.hNew) return newConv(d.hNew);
  if (d.hNws !== undefined) return openDlg();
  if (d.hTog) { OPEN[d.hTog] = !OPEN[d.hTog]; return rerender(); }
  MENU = null; rerender();
  if (d.hWs) return toast('Työtilasivu on oma kierroksensa.');
  if (d.hCopy) { try { await navigator.clipboard.writeText(d.hCopy); } catch {} return toast(`Kopioitu ${d.hCopy}`); }
  if (d.hGh) return toast(`Avautuisi github.com/${d.hGh}`);
  if (d.hArch) return toast('Piilotus etusivulta on ehdotus; työtila säilyy levyllä ja sivupalkissa.');
}, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && MENU) { MENU = null; rerender(); } });

const head = (h, sub) => `<header class="h-head"><div><h1>${h}</h1>${sub ? `<p class="h-sub">${sub}</p>` : ''}</div><div class="h-acts">${nwsBtn()}</div></header>`;
const summary = () => { const n = needs().length, k = UI.ws.reduce((s, w) => s + count(w, 'working'), 0); return `${UI.ws.length} työtilaa · ${n ? `<strong>${n} odottaa sinua</strong>` : 'mikään ei odota sinua'}${k ? ` · ${k} käynnissä` : ''}`; };

// ---------- V1 · Kortit kertovat ----------
function card1(w) {
  const a = active(w); const top = a[0]; const rest = a.slice(1, 3); const m = meta(w);
  const lead = top && info(top).say ? `<a href="#" class="lead ${st(top)}" data-conv="${top.id}"><span class="lead-head">${mark(top)}<strong>${esc(top.title)}</strong><time>${info(top).t}</time></span><span class="lead-say">${info(top).say}</span></a>`
    : top ? `<a href="#" class="row1" data-conv="${top.id}">${mark(top)}<span>${esc(top.title)}</span>${info(top).doing ? `<em>${info(top).doing}</em>` : ''}</a>` : '';
  const done = convsOf(w).length - a.length;
  return `<article class="wscard c1${a.length ? '' : ' quiet'}">
<header><a href="#" class="wscard-name mono" data-h-ws="${w.id}">${esc(w.id)}</a>${addBtn(w)}${moreBtn(w)}</header>
<div class="wscard-sub">${gitLine(w)}<span class="dotsep">·</span><span>${esc(m.t)}</span></div>
${lead}${rest.length ? `<ul class="wscard-list">${rest.map(c => `<li><a href="#" data-conv="${c.id}">${mark(c)}<span>${esc(c.title)}</span>${info(c).doing ? `<em>${info(c).doing}</em>` : ''}</a></li>`).join('')}</ul>` : ''}
${a.length ? '' : `<p class="wscard-quiet">${convsOf(w).length ? 'Ei avointa työtä.' : 'Ei vielä keskusteluja.'}</p>`}
<footer>${done ? `${done} valmis${done > 1 ? 'ta' : ''}` : ''}${a.length > 3 ? ` · ${a.length - 3} muuta avointa` : ''}</footer>
</article>`;
}
function v1Body() {
  const ws = sorted(); const busy = ws.filter(w => active(w).length), calm = ws.filter(w => !active(w).length);
  return `<div class="home r1">${head('Työtilat', summary())}
<div class="wsgrid big">${busy.map(card1).join('')}</div>
${calm.length ? `<section aria-labelledby="calm-h"><h2 id="calm-h">Ei avointa työtä</h2><div class="wsgrid">${calm.map(card1).join('')}<button type="button" class="wscard add" data-h-nws>${ICON_PLUS}<span>Uusi työtila</span><small>Kloonaa GitHubista tai luo hakemisto</small></button></div></section>` : ''}
</div>`;
}

// ---------- V2 · Työtilaluettelo ----------
function row2(w) {
  const a = active(w); const open = !!OPEN[w.id] && a.length; const m = meta(w);
  return `<li class="wsrow${open ? ' open' : ''}">
<div class="wsrow-main">
<button type="button" class="tog" data-h-tog="${w.id}" aria-expanded="${!!open}" aria-label="${open ? 'Piilota' : 'Näytä'} avoin työ: ${w.id}"${a.length ? '' : ' disabled'}>${CHEV}</button>
<a href="#" class="wsrow-name" data-h-ws="${w.id}"><span class="mono name">${esc(w.id)}</span><span class="mono path">${esc(w.path)}</span></a>
<span class="pills">${pills(w)}</span>
${gitLine(w)}
<time>${esc(m.t)}</time>
<span class="wsrow-acts">${addBtn(w)}${moreBtn(w)}</span>
</div>
${open ? `<ul class="wsrow-convs">${a.map(c => `<li><a href="#" data-conv="${c.id}">${mark(c)}<span class="t">${esc(c.title)}</span><span class="s">${info(c).say || info(c).doing || ''}</span><time>${info(c).t || ''}</time></a></li>`).join('')}</ul>` : ''}
</li>`;
}
let Q = '';
function v2Body() {
  const ws = sorted().filter(w => !Q || w.id.includes(Q));
  return `<div class="home r2">${head('Työtilat', summary())}
<div class="r2-tools"><label class="rail-filter r2-filter">${ICON_SEARCH}<input type="search" placeholder="Hae työtilaa" aria-label="Hae työtilaa" value="${esc(Q)}"></label></div>
<ul class="wsrows">${ws.map(row2).join('') || '<li class="h-empty">Ei osumia.</li>'}</ul>
</div>`;
}
document.addEventListener('input', (e) => {
  const i = e.target.closest?.('.r2-filter input'); if (!i) return;
  Q = i.value.trim().toLowerCase(); const pos = i.selectionStart; rerender();
  const n = stage.querySelector('.r2-filter input'); n.focus(); n.setSelectionRange(pos, pos);
});

// ---------- V3 · Kaksi kerrosta ----------
function tile(w) {
  const m = meta(w); const a = active(w);
  return `<article class="tile${a.length ? '' : ' quiet'}">
<header><a href="#" class="mono tile-name" data-h-ws="${w.id}">${esc(w.id)}</a>${moreBtn(w)}</header>
<div class="tile-mid">${pills(w) || `<span class="tile-calm">${convsOf(w).length ? 'Ei avointa työtä' : 'Tyhjä'}</span>`}</div>
<footer>${gitLine(w)}<time>${esc(m.t)}</time><button type="button" class="tile-new" data-h-new="${w.id}">${ICON_PLUS}<span>Uusi</span></button></footer>
</article>`;
}
function v3Body() {
  const n = needs(); const k = UI.ws.flatMap(w => convsOf(w).map(c => ({ ...c, ws: w }))).filter(c => st(c) === 'working');
  return `<div class="home r3">
${n.length || k.length ? `<section class="layer" aria-labelledby="l-h"><h2 id="l-h">Odottaa sinua <span class="count">${n.length}</span></h2>
<ul class="needs">${n.map(c => `<li><a href="#" class="need ${st(c)}" data-conv="${c.id}"><span class="need-head">${mark(c)}<span class="need-title">${esc(c.title)}</span><span class="need-ws mono">${esc(c.ws.id)}</span><time>${info(c).t || ''}</time></span>${info(c).say ? `<span class="need-say">${info(c).say}</span>` : ''}</a></li>`).join('')}
${k.map(c => `<li><a href="#" class="need working" data-conv="${c.id}"><span class="need-head">${mark(c)}<span class="need-title">${esc(c.title)}</span><span class="need-ws mono">${esc(c.ws.id)}</span><time>${info(c).t || ''}</time></span>${info(c).doing ? `<span class="need-say">${info(c).doing}</span>` : ''}</a></li>`).join('')}</ul></section>` : ''}
<section aria-labelledby="t-h"><div class="h-head"><h2 id="t-h">Työtilat <span class="count plain">${UI.ws.length}</span></h2><div class="h-acts">${nwsBtn('h-secondary')}</div></div>
<div class="tiles">${sorted().map(tile).join('')}</div></section>
</div>`;
}

const show = (v) => (keep) => { CUR = v; HOME = true; if (!keep) MENU = null; UI.sel = 'c1'; UI.pop = false; paint(); return { v1: v1Body, v2: v2Body, v3: v3Body }[v](); };
window.v1 = show('v1'); window.v2 = show('v2'); window.v3 = show('v3');
})();
