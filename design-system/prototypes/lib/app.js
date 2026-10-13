// Sovelluskehys: sivupalkki, keskustelun yläpalkki ja niiden toiminnot näyttämön
// ympärillä. Valittu 13.10.2026 (conversation-actions-layout, kierros
// rounds/2026-10-13-ylapalkki, suunta Ikonirivi). Kehys on mukana, kun kierros vie
// `app = true`; `appView()` piirtää valitun keskustelun näyttämölle. Kierros voi
// vaihtaa palan korvaamalla APP-hookin (`row`, `actions`) ennen piirtoa.

const SVG = (d, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${extra}>${d}</svg>`;
// Otsikon päivitys: H ja sen nurkassa päivityksen kaksi kiertävää nuolta (Jari 13.10.).
const ICON_RETITLE = SVG('<path d="M3 4v11M11 4v11M3 9.5h8"/><path d="M22 17a4.5 4.5 0 1 1-1.3-3.2"/><path d="M21.2 10.8v3h-3"/>');
const ICON_REFRESH = SVG('<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/>');
const ICON_ARCHIVE = SVG('<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>');
const ICON_INFO = SVG('<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5h.01"/>');
const ICON_PLUS = SVG('<path d="M12 5v14M5 12h14"/>');
const ICON_MENU = SVG('<path d="M4 7h16M4 12h16M4 17h16"/>');
const ICON_CLOSE = SVG('<path d="M6 6l12 12M18 6 6 18"/>');
const ICON_HOME = SVG('<path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/>');
const ICON_SEARCH = SVG('<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>');

const UI = {
  ws: [
    { id: 'aurinkokello', path: '~/src/aurinkokello', open: true, convs: [
      { id: 'c1', title: 'Status-skripti' },
      { id: 'c2', title: 'Kuvien pakkaus WebP-muotoon', st: 'attention' },
      { id: 'c3', title: 'CI-ajon aikakatkaisu, joka toistuu vain maanantaiaamuisin', st: 'done' },
    ] },
    { id: 'issuectl', path: '~/src/issuectl', open: true, convs: [
      { id: 'c4', title: 'Riippuvuusgraafin syklin tunnistus', st: 'unknown' },
    ] },
    { id: 'fleetrepo', path: '~/src/fleetrepo', open: false, convs: [
      { id: 'c6', title: 'Varmuuskopioiden ajastus', st: 'done' },
    ] },
    { id: 'open-habitat', path: '~/Sources/open-habitat', open: true, convs: [
      { id: 'c5', title: 'Kiintiönäkymän tekstit', st: 'working' },
    ] },
  ],
  sel: 'c1', working: false, pending: false, titles: ['Status-skripti', 'Viime viikon statusrivit JSONiksi'], titleIx: 0,
  pop: false, drawer: false, filter: '', created: 0,
};
const STATES = {
  working: ['Työskentelee', '<span class="st-dot working"></span>'],
  attention: ['Uusi vastaus', '<span class="st-dot attention"></span>'],
  waiting: ['Odottaa sinua', '<span class="st-dot waiting"></span>'],
  done: ['Valmis', `<span class="st-check">${ICON_CHECK}</span>`],
  unknown: ['Tila ei tiedossa', '<span class="st-dot unknown"></span>'],
};
const allConvs = () => UI.ws.flatMap(w => w.convs.map(c => ({ ...c, ws: w })));
const selConv = () => allConvs().find(c => c.id === UI.sel);
const convState = (c) => c.id === 'c1' ? (UI.working ? 'working' : 'waiting') : c.st;
const isEmpty = (c) => c.st === 'new';

// ---------- Shell: sidebar beside the existing frame content ----------
const uiFrame = document.querySelector('.frame');
const uiMain = document.createElement('div'); uiMain.className = 'main';
while (uiFrame.firstChild) uiMain.appendChild(uiFrame.firstChild);
const uiBody = document.createElement('div'); uiBody.className = 'body';
const uiCol = document.createElement('div'); uiCol.className = 'col';
const uiTop = uiMain.querySelector('.topbar');
uiMain.insertBefore(uiBody, uiTop.nextSibling);
for (const el of [...uiMain.children]) if (el !== uiTop && el !== uiBody) uiCol.appendChild(el);
uiBody.append(uiCol);
const uiRail = document.createElement('aside'); uiRail.className = 'rail'; uiRail.setAttribute('aria-label', 'Työtilat');
uiRail.innerHTML = `<div class="rail-head"><span class="srv">open-habitat-test</span><span class="conn"><span class="st-dot ok"></span>Yhdistetty</span><button class="icon-btn rail-close" type="button" data-ui="drawer" aria-label="Sulje valikko" title="Sulje valikko">${ICON_CLOSE}</button></div>
<a class="home-row" href="#" data-ui="home">${ICON_HOME}<span>Etusivu</span></a>
<label class="rail-filter">${ICON_SEARCH}<input type="search" placeholder="Suodata työtiloja" aria-label="Suodata työtiloja"></label>
<nav class="rail-list"></nav>
<div class="rail-foot"><span class="avatar">J</span><span>Jari</span></div>`;
const uiScrim = document.createElement('div'); uiScrim.className = 'scrim'; uiScrim.dataset.ui = 'drawer';
uiFrame.append(uiRail, uiMain, uiScrim);
const uiPop = document.createElement('div'); uiPop.className = 'popover'; uiPop.hidden = true; uiMain.appendChild(uiPop);
const uiToast = document.createElement('div'); uiToast.className = 'toast'; uiToast.setAttribute('role', 'status'); uiMain.appendChild(uiToast);
const uiConfirm = document.createElement('dialog'); uiConfirm.className = 'confirm'; document.body.appendChild(uiConfirm);
uiRail.querySelector('input').addEventListener('input', (e) => { UI.filter = e.target.value.trim().toLowerCase(); paintRail(); });

// ---------- Sidebar ----------
function convRow(c) {
  const [label, mark] = STATES[convState(c)] ?? ['Ei aloitettu', '<span class="st-none"></span>'];
  return `<a href="#" class="conv-row" data-conv="${c.id}"${c.id === UI.sel ? ' aria-current="page"' : ''}><span class="conv-title">${esc(c.title)}</span><span class="st" role="img" aria-label="${label}" title="${label}">${mark}</span></a>`;
}
function paintRail() {
  const list = UI.ws.filter(w => !UI.filter || w.id.includes(UI.filter));
  uiRail.querySelector('.rail-list').innerHTML = list.length ? list.map(w => {
    const rows = w.convs.filter(c => !c.archived).map(c => `<li>${APP.row(c)}</li>`).join('');
    return `<section class="ws"><div class="ws-row"><button class="ws-tog" type="button" data-ws-tog="${w.id}" aria-expanded="${w.open}" aria-label="${w.open ? 'Piilota' : 'Näytä'} keskustelut: ${w.id}">${CHEV}</button><a href="#" class="ws-name" data-ui="ws">${esc(w.id)}</a><button class="ws-add" type="button" data-ws-add="${w.id}" aria-label="Uusi keskustelu työtilassa ${w.id}" title="Uusi keskustelu">${ICON_PLUS}</button></div>${w.open && rows ? `<ul class="convs">${rows}</ul>` : ''}</section>`;
  }).join('') : `<p class="rail-empty">Ei osumia.</p>`;
}

// ---------- Top bar, per direction ----------
const btn = (act, icon, label, opts = {}) => `<button class="icon-btn tb-btn${opts.cls ? ' ' + opts.cls : ''}" type="button" data-ui="${act}" aria-label="${label}" title="${opts.reason || label}"${opts.disabled ? ` aria-disabled="true" aria-describedby="arch-why"` : ''}${opts.expanded !== undefined ? ` aria-expanded="${opts.expanded}"` : ''}>${icon}</button>`;
function stateChip(c) {
  if (c.archived) return `<span class="tag archived">Arkistoitu</span>`;
  if (isEmpty(c)) return '';
  const s = convState(c); const [label, mark] = STATES[s];
  return `<span class="chip ${s}" role="status">${mark}<span class="chip-label">${label}</span></span>`;
}
const archiveReason = 'Pi työskentelee. Arkistoi, kun vuoro on päättynyt.';
function titleBlock(c) {
  return `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button>
<div class="tb-title"><strong${UI.pending ? ' class="pending" aria-busy="true"' : ''}>${esc(c.title)}</strong><a href="#" class="tb-ws" data-ui="ws">${esc(c.ws.id)}</a></div>`;
}
// Ikonirivi: uusi otsikko, arkistointi ja tiedot näkyvinä ikoneina oikealla.
function topActions(c) {
  const archOpts = UI.working && c.id === 'c1' ? { disabled: true, reason: archiveReason } : {};
  return (!isEmpty(c) && !c.archived ? btn('retitle', ICON_RETITLE, 'Luo uusi otsikko', { cls: UI.pending ? 'spin-badge' : '' }) : '')
    + (c.archived ? '' : btn('archive', ICON_ARCHIVE, 'Arkistoi', archOpts))
    + btn('info', ICON_INFO, 'Tiedot', { expanded: UI.pop })
    + (archOpts.disabled ? `<span id="arch-why" hidden>${archiveReason}</span>` : '');
}
const APP = { row: convRow, actions: topActions };
function paintTop() {
  const c = selConv();
  uiTop.innerHTML = `${titleBlock(c)}<div class="tb-right">${stateChip(c)}<span class="tb-actions">${APP.actions(c)}</span></div>`;
}

// ---------- Details popover ----------
function detailsList(c) {
  const empty = isEmpty(c);
  const id = '019a3c7e-5d2b-7f41-9a0e-4c1d8b2e6f90';
  return `<dl class="facts">
<dt>Työtila</dt><dd><span class="mono">${esc(c.ws.id)}</span><span class="sub mono">${esc(c.ws.path)}</span></dd>
<dt>Malli</dt><dd>${empty ? '<span class="sub">Pi:n oletus, valitaan ensimmäisellä viestillä</span>' : MODEL}</dd>
<dt>Ohjaus</dt><dd>Selainohjaus</dd>
<dt>Aloitettu</dt><dd>${empty ? '<span class="sub">ei vielä</span>' : '13.10. klo 14.28'}</dd>
<dt>Natiivi tunniste</dt><dd>${empty ? '<span class="sub">syntyy ensimmäisestä viestistä</span>' : `<span class="mono id">${id}</span>${copyBtn('Kopioi tunniste', id)}`}</dd>
</dl>`;
}
function paintPop() {
  uiPop.hidden = !UI.pop;
  if (!uiPop.hidden) { uiPop.className = 'popover details'; uiPop.innerHTML = `<h3>Tiedot</h3>${detailsList(selConv())}`; }
}
function paint() { paintRail(); paintTop(); paintPop(); uiFrame.classList.toggle('drawer-open', UI.drawer); }

// ---------- Stage content ----------
function content() {
  const c = selConv();
  if (c.id === 'c1') return withLive('', threadR());
  run++;
  if (isEmpty(c)) return `<div class="empty-convo"><p class="lead">Uusi keskustelu työtilassa <span class="mono">${esc(c.ws.id)}</span></p><p>Pi käynnistyy, kun lähetät ensimmäisen viestin. Otsikko syntyy keskustelusta.</p></div>`;
  return `<div class="empty-convo"><p>Tässä vedoksessa vain Status-skripti ja uudet keskustelut ovat auki.</p></div>`;
}
function openConv(id) {
  UI.sel = id; UI.pop = false; UI.drawer = false; UI.pending = false; paint();
  stage.innerHTML = ''; requestAnimationFrame(() => { stage.innerHTML = content(); if (isEmpty(selConv())) document.querySelector('.composer textarea').focus(); });
}
// A variant's render function: repaint the frame, return the stage content.
function appView() { UI.pop = false; paint(); return content(); }

// ---------- Actions ----------
let toastTimer;
function toast(text) { uiToast.textContent = text; uiToast.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => uiToast.classList.remove('on'), 4000); }
function retitle() {
  const c = selConv(); if (UI.pending || isEmpty(c)) return;
  UI.pending = true; UI.pop = false; paint();
  setTimeout(() => {
    UI.pending = false;
    if (c.id === 'c1') { UI.titleIx = (UI.titleIx + 1) % UI.titles.length; c.ws.convs.find(x => x.id === 'c1').title = UI.titles[UI.titleIx]; }
    paint();
  }, 1400);
}
function askArchive() {
  const c = selConv(); UI.pop = false; paint();
  uiConfirm.innerHTML = `<form method="dialog"><h3>Arkistoidaanko keskustelu?</h3><p><strong>${esc(c.title)}</strong> siirtyy työtilan <span class="mono">${esc(c.ws.id)}</span> Arkisto-osioon. Pi:n historia säilyy, ja keskustelun voi palauttaa sieltä.</p><div class="confirm-actions"><button class="secondary" value="cancel" autofocus>Peruuta</button><button class="primary" value="ok">Arkistoi</button></div></form>`;
  uiConfirm.showModal();
}
uiConfirm.addEventListener('close', () => {
  if (uiConfirm.returnValue !== 'ok') return;
  const c = selConv(); const conv = c.ws.convs.find(x => x.id === c.id);
  // The row leaves the sidebar list; the open conversation stays readable here.
  conv.archived = true; paint(); toast('Keskustelu arkistoitu. Se löytyy työtilan Arkisto-osiosta.');
});

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-ui], [data-conv], [data-ws-add], [data-ws-tog]');
  if (!t) { if (UI.pop && !e.target.closest('.popover')) { UI.pop = false; paint(); } return; }
  if (t.closest('.proto-picker')) return;
  e.preventDefault();
  if (t.getAttribute('aria-disabled') === 'true') return;
  if (t.dataset.conv) return openConv(t.dataset.conv);
  if (t.dataset.wsTog) { const w = UI.ws.find(x => x.id === t.dataset.wsTog); w.open = !w.open; return paintRail(); }
  if (t.dataset.wsAdd) {
    const w = UI.ws.find(x => x.id === t.dataset.wsAdd); const id = `n${++UI.created}`;
    w.convs.unshift({ id, title: 'Uusi keskustelu', st: 'new' }); w.open = true; return openConv(id);
  }
  const a = t.dataset.ui;
  if (a === 'drawer') { UI.drawer = !UI.drawer; return paint(); }
  if (a === 'home' || a === 'ws') return toast(a === 'home' ? 'Etusivu ei kuulu tähän vedokseen.' : 'Työtilasivu ei kuulu tähän vedokseen.');
  if (a === 'retitle') return retitle();
  if (a === 'archive') return askArchive();
  if (a === 'info') { UI.pop = !UI.pop; return paint(); }
});
uiPop.addEventListener('click', async (e) => {
  const copy = e.target.closest('[data-copy]'); if (!copy) return;
  try { await navigator.clipboard.writeText(copy.dataset.copy); } catch {}
  copy.setAttribute('data-done', ''); setTimeout(() => copy.removeAttribute('data-done'), 1200);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (UI.pop) { UI.pop = false; paint(); } else if (UI.drawer) { UI.drawer = false; paint(); }
});
// Working state follows the live turn the library plays.
new MutationObserver(() => {
  const w = !!stage.querySelector('.turn.live.working');
  if (w !== UI.working) { UI.working = w; paint(); }
}).observe(stage, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
