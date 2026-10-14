// Kierros 14.10.2026: vasen palkki. Palvelimen ylläpito siirtyy valikkoon, ja
// työtilojen hallinta (uusi työtila, työtilan …-valikko) saa paikan palkissa.
(() => {
const ICON_FOLDER = SVG('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>');
const ICON_FOLDER_PLUS = SVG('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v5M9.5 13.5h5"/>');
const ICON_GH = SVG('<path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>');
const ICON_MORE = SVG('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>');
const ICON_FWD = SVG('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>');
const ICON_COPY = SVG('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>');
const ICON_EXT = SVG('<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/>');
const ICON_TRASH = SVG('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>');
const ICON_GEAR = SVG('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>');
const ICON_SERVER = SVG('<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>');
const ICON_OUT = SVG('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>');
const ICON_UPDOWN = SVG('<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>');
const ICON_DOWN = SVG('<path d="m6 9 6 6 6-6"/>');
const ICON_SUN = SVG('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>');
const ICON_MOON = SVG('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>');
const ICON_AUTO = SVG('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>');

const ME = { name: 'Jari', full: 'Jari Mustonen', email: 'jari@esimerkki.fi', admin: true };
const SRV = { name: 'open-habitat-test', ver: '0.0.0-pilot.61', users: 3 };
const GHW = { aurinkokello: 'maintainer/aurinkokello', issuectl: 'jarimustonen/issuectl', fleetrepo: 'maintainer/fleetrepo', 'open-habitat': 'Open-Habitat/open-habitat' };
const GH = ['maintainer/reitti', 'maintainer/kuitit', 'maintainer/wilma-cli', 'jarimustonen/taskfleet'];
let CUR = 'v1', MENU = null, NWS = 'gh';

// ---------- Menus ----------
const item = (act, icon, label, extra = '') => `<button type="button" role="menuitem" data-p="${act}">${icon}<span>${label}</span>${extra}</button>`;
const themeNow = () => document.getElementById('theme').value;
const themeSeg = () => `<div class="p-theme" role="group" aria-label="Teema">${[['system', ICON_AUTO, 'Järjestelmä'], ['light', ICON_SUN, 'Vaalea'], ['dark', ICON_MOON, 'Tumma']].map(([v, i, l]) => `<button type="button" data-theme="${v}" aria-pressed="${themeNow() === v}" title="${l}" aria-label="${l}">${i}</button>`).join('')}</div>`;
const who = () => `<div class="p-who"><span class="avatar lg">J</span><span><strong>${ME.full}</strong><small>${ME.email}</small></span></div>`;
const srvInfo = () => `<div class="p-who"><span class="srv-ic">${ICON_SERVER}</span><span><strong class="mono">${SRV.name}</strong><small><span class="st-dot ok"></span> Yhdistetty · <span class="mono">${SRV.ver}</span></small></span></div>`;
const adminItem = () => ME.admin ? item('admin', ICON_SERVER, 'Palvelimen ylläpito', '<span class="p-badge">ylläpitäjä</span>') : '';
const MENUS = {
  user1: () => `${who()}<hr>${item('settings', ICON_GEAR, 'Asetukset')}${adminItem()}<hr><div class="p-row"><span>Teema</span>${themeSeg()}</div><hr>${item('logout', ICON_OUT, 'Kirjaudu ulos')}`,
  srv2: () => `${srvInfo()}<hr>${adminItem()}${item('copyver', ICON_COPY, 'Kopioi versio')}`,
  user2: () => `${who()}<hr>${item('settings', ICON_GEAR, 'Asetukset')}<div class="p-row"><span>Teema</span>${themeSeg()}</div><hr>${item('logout', ICON_OUT, 'Kirjaudu ulos')}`,
  user3: () => `${who()}<div class="p-srv"><span class="st-dot ok"></span><span class="mono">${SRV.name}</span><span class="mono sub">${SRV.ver}</span></div><hr>${item('settings', ICON_GEAR, 'Asetukset')}${adminItem()}<hr><div class="p-row"><span>Teema</span>${themeSeg()}</div><hr>${item('logout', ICON_OUT, 'Kirjaudu ulos')}`,
};
function wsMenu(id) {
  const w = UI.ws.find(x => x.id === id);
  return `${item(`new:${id}`, ICON_PLUS, 'Uusi keskustelu')}${item('wspage', ICON_FWD, 'Avaa työtilasivu')}<hr>${item(`copy:${w.path}`, ICON_COPY, 'Kopioi polku', `<span class="kbd mono">${esc(w.path)}</span>`)}${GHW[id] ? item(`gh:${GHW[id]}`, ICON_EXT, 'Avaa GitHubissa') : ''}<hr><button type="button" role="menuitem" class="danger" aria-disabled="true" title="Palautettava poisto suunnitellaan ensin (recoverable-workspace-deletion).">${ICON_TRASH}<span>Poista työtila…</span><span class="why">tulossa</span></button>`;
}
const pop = document.createElement('div'); pop.className = 'p-menu'; pop.setAttribute('role', 'menu'); pop.hidden = true; uiFrame.appendChild(pop);
function openMenu(key, anchor, place) {
  if (MENU === key) return closeMenu();
  MENU = key; pop.innerHTML = key.startsWith('ws:') ? wsMenu(key.slice(3)) : MENUS[key]();
  pop.hidden = false; pop.dataset.place = place;
  const f = uiFrame.getBoundingClientRect(), a = anchor.getBoundingClientRect();
  const left = Math.min(Math.max(8, a.left - f.left), f.width - pop.offsetWidth - 8);
  pop.style.left = (place === 'right' ? Math.min(a.right - f.left + 6, f.width - pop.offsetWidth - 8) : left) + 'px';
  if (place === 'up') { pop.style.top = ''; pop.style.bottom = (f.bottom - a.top + 6) + 'px'; }
  else if (place === 'right') { pop.style.bottom = ''; pop.style.top = Math.min(a.top - f.top, f.height - pop.offsetHeight - 8) + 'px'; }
  else { pop.style.bottom = ''; pop.style.top = (a.bottom - f.top + 6) + 'px'; }
  document.querySelectorAll('[data-menu]').forEach(b => b.setAttribute('aria-expanded', b.dataset.menu === key));
  pop.querySelector('button:not([aria-disabled])')?.focus({ preventScroll: true });
}
function closeMenu() { MENU = null; pop.hidden = true; document.querySelectorAll('[data-menu]').forEach(b => b.setAttribute('aria-expanded', 'false')); }

// ---------- New workspace dialog ----------
const dlg = document.createElement('dialog'); dlg.className = 'confirm nws'; document.body.appendChild(dlg);
function paintDlg() {
  const gh = NWS === 'gh';
  dlg.innerHTML = `<form method="dialog"><h3>Uusi työtila</h3>
<div class="seg" role="tablist"><button type="button" role="tab" aria-selected="${gh}" data-nws="gh">${ICON_GH}Kloonaa GitHubista</button><button type="button" role="tab" aria-selected="${!gh}" data-nws="dir">${ICON_FOLDER}Uusi hakemisto</button></div>
${gh ? `<label class="fld"><span>Repositorio</span><input name="v" class="mono" placeholder="omistaja/repo" autocomplete="off" required></label><ul class="sugg">${GH.filter(r => !UI.ws.some(w => w.id === r.split('/')[1])).map(r => `<li><button type="button" data-sugg="${r}" class="mono">${r}</button></li>`).join('')}</ul><p class="hint">Kloonataan hakemistoon <span class="mono">~/src/&lt;repo&gt;</span> sinun GitHub-tunnuksillasi.</p>`
    : `<label class="fld"><span>Nimi</span><input name="v" class="mono" placeholder="uusi-projekti" autocomplete="off" required pattern="[a-z0-9._-]+"></label><p class="hint">Luodaan <span class="mono">~/src/&lt;nimi&gt;</span> ja alustetaan Git-repoksi.</p>`}
<div class="confirm-actions"><button class="secondary" value="cancel" formnovalidate>Peruuta</button><button class="primary" value="ok">Luo työtila</button></div></form>`;
}
function openDlg() { closeMenu(); paintDlg(); dlg.showModal(); dlg.querySelector('input').focus(); }
dlg.addEventListener('click', (e) => {
  const t = e.target.closest('[data-nws], [data-sugg]'); if (!t) return;
  if (t.dataset.nws) { NWS = t.dataset.nws; paintDlg(); dlg.querySelector('input').focus(); } else dlg.querySelector('input').value = t.dataset.sugg;
});
dlg.addEventListener('close', () => {
  if (dlg.returnValue !== 'ok') return;
  const v = dlg.querySelector('input').value.trim(); const id = v.split('/').pop();
  if (!id || UI.ws.some(w => w.id === id)) return toast(`Työtila ${id} on jo olemassa.`);
  UI.ws.push({ id, path: `~/src/${id}`, open: true, convs: [] }); if (NWS === 'gh') GHW[id] = v;
  paint(); toast(NWS === 'gh' ? `Kloonattu ${v} → ~/src/${id}` : `Työtila ${id} luotu`);
});

// ---------- Sidebar per direction ----------
const closeBtn = `<button class="icon-btn rail-close" type="button" data-ui="drawer" aria-label="Sulje valikko" title="Sulje valikko">${ICON_CLOSE}</button>`;
const home = `<a class="home-row" href="#" data-ui="home">${ICON_HOME}<span>Etusivu</span></a>`;
const filter = `<label class="rail-filter">${ICON_SEARCH}<input type="search" placeholder="Suodata työtiloja" aria-label="Suodata työtiloja"></label>`;
const userBtn = (key, place) => `<button type="button" class="p-user" data-menu="${key}" data-place="${place}" aria-haspopup="menu" aria-expanded="false"><span class="avatar">J</span><span class="p-name">${ME.name}</span>${ICON_UPDOWN}</button>`;
const wsHead = (inline) => `<div class="p-section"><span>Työtilat</span>${inline ? '' : `<button type="button" class="icon-btn p-add" data-p="nws" aria-label="Uusi työtila" title="Uusi työtila">${ICON_FOLDER_PLUS}</button>`}</div>`;
const SHELL = {
  v1: () => `<div class="rail-head"><span class="srv">${SRV.name}</span><span class="conn"><span class="st-dot ok"></span>Yhdistetty</span>${closeBtn}</div>${home}${filter}${wsHead(false)}<nav class="rail-list"></nav><div class="rail-foot p-foot">${userBtn('user1', 'up')}</div>`,
  v2: () => `<div class="rail-head p-srvhead"><button type="button" class="p-srvbtn" data-menu="srv2" data-place="down" aria-haspopup="menu" aria-expanded="false"><span class="srv-ic">${ICON_SERVER}</span><span class="srv-txt"><span class="srv mono">${SRV.name}</span><span class="conn"><span class="st-dot ok"></span>Yhdistetty</span></span>${ICON_DOWN}</button>${closeBtn}</div>${home}${filter}${wsHead(true)}<nav class="rail-list"></nav><button type="button" class="p-newws" data-p="nws">${ICON_FOLDER_PLUS}<span>Uusi työtila</span></button><div class="rail-foot p-foot">${userBtn('user2', 'up')}</div>`,
  v3: () => `<div class="rail-head p-top"><button type="button" class="p-me" data-menu="user3" data-place="down" aria-haspopup="menu" aria-expanded="false" aria-label="Tili ja palvelin"><span class="avatar">J</span><span class="p-name">${ME.name}</span><span class="st-dot ok" title="Yhdistetty palvelimeen ${SRV.name}"></span>${ICON_DOWN}</button><span class="p-grow"></span><button type="button" class="icon-btn" data-p="search" aria-label="Hae" title="Hae">${ICON_SEARCH}</button><button type="button" class="icon-btn" data-p="nws" aria-label="Uusi työtila" title="Uusi työtila">${ICON_FOLDER_PLUS}</button>${closeBtn}</div>${home}<label class="rail-filter p-search" hidden>${ICON_SEARCH}<input type="search" placeholder="Suodata työtiloja" aria-label="Suodata työtiloja"></label><nav class="rail-list"></nav>`,
};
const libPaintRail = paintRail;
window.paintRail = function () {
  libPaintRail();
  uiRail.querySelectorAll('.ws-row').forEach(r => {
    const id = r.querySelector('[data-ws-tog]').dataset.wsTog;
    r.insertAdjacentHTML('beforeend', `<button type="button" class="ws-more" data-menu="ws:${id}" data-place="right" aria-haspopup="menu" aria-expanded="${MENU === 'ws:' + id}" aria-label="Työtilan ${id} toiminnot" title="Toiminnot">${ICON_MORE}</button>`);
  });
};
function build(v) {
  uiRail.className = `rail p-${v}`; uiRail.innerHTML = SHELL[v](); closeMenu();
  const q = uiRail.querySelector('.rail-filter input'); q.value = UI.filter;
}
uiRail.addEventListener('input', (e) => { if (e.target.matches('.rail-filter input')) { UI.filter = e.target.value.trim().toLowerCase(); paintRail(); } });

// ---------- Clicks ----------
document.addEventListener('click', async (e) => {
  if (e.target.closest('.proto-picker')) return;
  const m = e.target.closest('[data-menu]');
  if (m) { e.preventDefault(); e.stopPropagation(); return openMenu(m.dataset.menu, m, m.dataset.place); }
  const th = e.target.closest('[data-theme]');
  if (th) { e.stopPropagation(); const s = document.getElementById('theme'); s.value = th.dataset.theme; s.dispatchEvent(new Event('change')); pop.querySelectorAll('[data-theme]').forEach(b => b.setAttribute('aria-pressed', b === th)); return; }
  const dis = e.target.closest('.p-menu [aria-disabled="true"]');
  if (dis) { e.stopPropagation(); return toast(dis.title); }
  const p = e.target.closest('[data-p]');
  if (!p) { if (MENU && !e.target.closest('.p-menu')) closeMenu(); return; }
  e.preventDefault(); e.stopPropagation();
  const [a, arg] = p.dataset.p.split(/:(.*)/s);
  closeMenu();
  if (a === 'nws') return openDlg();
  if (a === 'search') { const l = uiRail.querySelector('.p-search'); l.hidden = !l.hidden; if (!l.hidden) l.querySelector('input').focus(); return; }
  if (a === 'new') { const w = UI.ws.find(x => x.id === arg); const id = `n${++UI.created}`; w.convs.unshift({ id, title: 'Uusi keskustelu', st: 'new' }); w.open = true; return openConv(id); }
  if (a === 'copy') { try { await navigator.clipboard.writeText(arg); } catch {} return toast(`Kopioitu ${arg}`); }
  if (a === 'gh') return toast(`Avautuisi github.com/${arg}`);
  if (a === 'copyver') return toast(`Kopioitu ${SRV.ver}`);
  if (a === 'wspage') return toast('Työtilasivu on oma kierroksensa.');
  if (a === 'settings') return toast('Asetukset avautuisivat (oma kierroksensa).');
  if (a === 'admin') return toast('Palvelimen ylläpito avautuisi (oma kierroksensa).');
  if (a === 'logout') return toast('Kirjauduttaisiin ulos.');
}, true);
document.addEventListener('keydown', (e) => {
  if (!MENU) return;
  if (e.key === 'Escape') { e.stopPropagation(); const k = MENU; closeMenu(); document.querySelector(`[data-menu="${k}"]`)?.focus(); return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); const bs = [...pop.querySelectorAll('button:not([aria-disabled])')]; const i = bs.indexOf(document.activeElement);
    bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length]?.focus();
  }
}, true);
// Menus stay open while the live turn scrolls the stage; only the sidebar's own scroll closes them.
uiRail.addEventListener('scroll', (e) => { if (e.target.classList?.contains('rail-list')) closeMenu(); }, true);

const show = (v) => () => { CUR = v; build(v); return appView(); };
window.v1 = show('v1'); window.v2 = show('v2'); window.v3 = show('v3');
})();
