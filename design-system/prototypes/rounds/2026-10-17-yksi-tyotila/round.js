// Yhden työtilan tila (proto-single-workspace-mode, 17.10.2026). Kun työtiloja on yksi,
// kehys on mietitty sille: palvelimen nimen paikalla on työtilan nimi, ja se vie etusivulle
// (Jari 17.10., rail-home-and-hover); palvelin ja yhteys siirtyvät tilivalikkoon. Tila
// johdetaan työtilojen määrästä: Lisää työtila kloonaa toisen, ja kehys vaihtuu kirjaston
// nykyiseen monen työtilan sivupalkkiin ja etusivuun. Kun toinen siirtyy roskakoriin, yksi
// työtila jää ja kehys palaa. Suunnat eroavat vain siinä, missä yksi työtila itse asuu.
(() => {
const ICON_BRANCH = SVG('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10"/><path d="M18 10c0 4-6 3-12 7"/>');
const ICON_COPY = SVG('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>');
const ICON_GH = SVG('<path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>');
const ICON_TRASH = SVG('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>');
const ICON_PEN = SVG('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>');
const ICON_UP = SVG('<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>');
const ICON_ARCH = SVG('<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>');
const ICON_FWD = SVG('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>');
const ICON_REPO = SVG('<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/><path d="M9 7h6"/>');
const ICON_FOLDER_PLUS = SVG('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v5M9.5 13.5h5"/>');
const ICON_DOWN = SVG('<path d="m6 9 6 6 6-6"/>');
const ICON_UPDOWN = SVG('<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>');
const ICON_EXT = SVG('<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/>');

// ---------- One workspace: aurinkokello ----------
// The library's fixture has four workspaces; this round starts from the person's only one.
const SERVER = 'open-habitat-test';
UI.ws.splice(1);
const AUR = UI.ws[0];
AUR.convs.splice(2, 0, { id: 'c12', title: 'Kuukausinäkymän tulostus', st: 'working' });
const GIT = {
  aurinkokello: { gh: 'maintainer/aurinkokello', branch: 'main', upstream: 'origin/main', ahead: 1, behind: 0, fetched: '6 min sitten',
    files: [['M', 'scripts/status_rows.py', '+38 −4'], ['?', 'tests/test_status_rows.py', 'uusi']],
    commits: [{ h: 'a41c9e2', s: 'Statusrivien jäsennin omaksi moduulikseen', t: '40 min', local: true }, { h: '7d03b18', s: 'CI: macOS-ajo käyttää Python 3.13:a', t: 'eilen' }, { h: 'e92f4a0', s: 'README: --json-esimerkki ja aikavyöhyke', t: 'ma' }] },
};
const ARCHIVED = { aurinkokello: [{ id: 'a1', title: 'Vanha deploy-skripti', t: '2.10.' }, { id: 'a2', title: 'Kokeilu: laskenta Rustilla', t: '28.9.' }] };
const REC = {
  c1: { age: '1 min', recap: 'Skripti `scripts/status_rows.py` lukee `status.md`:n taulukon ja tulostaa viime viikon rivit. `--since` antaa rajan käsin, ja testit menevät läpi.', next: 'Kerro, lisätäänkö JSON-tuloste samaan ajoon vai omaksi lipukseen.' },
  c2: { age: '8 min', recap: 'Kuvat `assets/photos/` muunnettiin WebP-muotoon laadulla 82: 214 kuvaa, 38 Mt → 11 Mt. `build.sh` käyttää nyt `.webp`-tiedostoja.', next: 'Päätä, poistetaanko alkuperäiset vai siirretäänkö ne `originals/`-hakemistoon.' },
  c12: { age: 'nyt', recap: 'Kuukausinäkymä tulostaa viikot riveinä. Viikkonumerot tulevat ISO 8601:n mukaan.', next: '' },
};
const DONE_T = { c3: 'eilen', c7: 'ma', c8: '9.10.' };
// Repositories the add dialog offers (the full chooser is round 2026-10-17-repon-valinta).
const POOL = [
  { id: 'reitti', gh: 'maintainer/reitti', desc: 'HSL-reittihaku komentoriviltä', commit: { h: '9c1d2e7', s: 'Pysäkkihaku lähimmän mukaan', t: 'tänään' } },
  { id: 'kuitit', gh: 'maintainer/kuitit', desc: 'Kuittien nimeäminen ja arkistointi', commit: { h: '41aa0c3', s: 'Laskujen tunnistus PDF:stä', t: 'ke' } },
  { id: 'taskfleet', gh: 'jarimustonen/taskfleet', desc: 'Agenttiworktreiden ajonhallinta', commit: { h: 'e03f9b1', s: 'run wait: aikakatkaisu sekunteina', t: 'eilen' } },
];

let CUR = 'v1', PAGE = 'home', LAYER = null, MENU = false, FRESH = null;
const FOLD = { done: false, arch: false };
const single = () => UI.ws.length === 1;
const only = () => UI.ws[0];
const git = (id) => GIT[id];
const st = (c) => convState(c);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const mark = (s) => { const [l, m] = STATES[s] ?? ['Ei aloitettu', '<span class="st-none"></span>']; return `<span class="st" role="img" aria-label="${l}" title="${l}">${m}</span>`; };
const openConvs = (w) => w.convs.filter(c => !c.archived && st(c) !== 'done').sort((a, b) => (STATE_ORDER[st(a)] ?? 4) - (STATE_ORDER[st(b)] ?? 4));
const doneConvs = (w) => w.convs.filter(c => !c.archived && st(c) === 'done');
const closeBtn = `<button class="icon-btn rail-close" type="button" data-ui="drawer" aria-label="Sulje valikko" title="Sulje valikko">${ICON_CLOSE}</button>`;
const conn = `<span class="sw-conn" title="Yhdistetty palvelimeen ${SERVER}"><span class="st-dot ok"></span><span class="sr">Yhdistetty palvelimeen ${SERVER}</span></span>`;
const userBtn = `<button type="button" class="p-user" data-menu="user3" data-place="up" aria-haspopup="menu" aria-expanded="false"><span class="avatar">J</span><span class="p-name">Jari</span>${ICON_UPDOWN}</button>`;
const homeCur = () => PAGE === 'home' ? ' aria-current="page"' : '';

// ---------- Git pieces (as on the implemented workspace page) ----------
const syncIcons = (d) => d.ahead ? `<span class="g-ahead" title="${d.ahead} committia ei ole vielä originissa">${ICON_UP}${d.ahead}</span>` : '';
const gitPill = (d, cls = '') => `<button type="button" class="gitline${cls}" data-git aria-haspopup="dialog" aria-expanded="${LAYER === 'git'}">${ICON_BRANCH}<span class="mono">${esc(d.branch)}</span>${d.files.length ? `<span class="g-dirty">${plural(d.files.length, 'muutos', 'muutosta')}</span>` : ''}${syncIcons(d)}${CHEV}</button>`;
const fileList = (d) => d.files.length ? `<ul class="g-files">${d.files.map(([s, p, n]) => `<li><span class="g-fs g-${s === '?' ? 'new' : 'mod'}" title="${s === '?' ? 'Uusi, ei vielä Gitissä' : 'Muutettu'}">${s === '?' ? 'U' : s}</span><span class="mono">${esc(p)}</span><span class="g-n">${n}</span></li>`).join('')}</ul>` : '<p class="g-clean">Ei muutoksia; työhakemisto vastaa viimeisintä committia.</p>';
const commitList = (d) => `<ul class="g-commits">${d.commits.map(c => `<li><span class="mono g-h">${c.h}</span><span class="g-s">${esc(c.s)}</span>${c.local ? '<span class="g-local" title="Ei vielä originissa">paikallinen</span>' : ''}<time>${c.t}</time></li>`).join('')}</ul>`;
const syncText = (d) => d.ahead ? `${d.ahead} edellä ${d.upstream}` : `ajan tasalla ${d.upstream}`;

// ---------- Work: recap cards, Valmiit, Arkisto (same in every direction) ----------
function recapCard(c) {
  const r = REC[c.id] || { age: 'nyt', recap: 'Keskustelulla ei vielä ole tilannekatsausta.', next: '' }; const s = st(c);
  const busy = s === 'working';
  return `<article class="kc ${s}"><div class="kc-head">${mark(s)}<a href="#" class="kc-title" data-conv="${c.id}">${esc(c.title)}</a><button type="button" class="icon-btn kc-arch" data-arch="${c.id}" aria-label="Arkistoi ${esc(c.title)}" title="${busy ? 'Agentti työskentelee. Arkistoi, kun vuoro on päättynyt.' : 'Arkistoi'}"${busy ? ' aria-disabled="true"' : ''}>${ICON_ARCH}</button></div>
<p class="kc-meta"><span class="kc-st ${s}">${(STATES[s] ?? ['Ei aloitettu'])[0]}</span><time>${r.age === 'nyt' ? 'nyt' : r.age + ' sitten'}</time></p>
<p class="k-text">${inline(r.recap)}</p>${r.next ? `<p class="k-next"><span class="k-label">Seuraavaksi</span><span>${inline(r.next)}</span></p>` : ''}
<a href="#" class="kc-go" data-conv="${c.id}">${s === 'attention' ? 'Lue vastaus' : s === 'waiting' ? 'Vastaa' : 'Avaa'}${ICON_FWD}</a></article>`;
}
function summary(w) {
  const o = openConvs(w); if (!o.length) return 'ei avoimia keskusteluja';
  const you = o.filter(c => ['waiting', 'attention'].includes(st(c))).length, work = o.filter(c => st(c) === 'working').length;
  return [you ? `<strong>${you} odottaa sinua</strong>` : 'mikään ei odota sinua', work ? `${work} työskentelee` : ''].filter(Boolean).join(' · ');
}
function work(w) {
  const o = openConvs(w), d = doneConvs(w), a = ARCHIVED[w.id] || [];
  const done = d.length ? `<section class="grp"><button type="button" class="fold" data-fold="done" aria-expanded="${FOLD.done}">${CHEV}<span>Valmiit</span><span class="count plain">${d.length}</span></button>${FOLD.done ? `<ul class="rows">${d.map(c => `<li><a href="#" class="row" data-conv="${c.id}">${mark('done')}<span class="row-title">${esc(c.title)}</span><time>${DONE_T[c.id] ?? 'juuri nyt'}</time></a></li>`).join('')}</ul>` : ''}</section>` : '';
  const arch = a.length ? `<section class="grp"><button type="button" class="fold" data-fold="arch" aria-expanded="${FOLD.arch}">${CHEV}<span>Arkisto</span><span class="count plain">${a.length}</span></button>${FOLD.arch ? `<ul class="rows">${a.map(c => `<li class="row arch">${ICON_ARCH}<span class="row-title">${esc(c.title)}</span><time>${c.t}</time></li>`).join('')}</ul>` : ''}</section>` : '';
  return `<section class="grp" aria-labelledby="o-h"><h2 id="o-h" class="grp-h">Avoimet <span class="count">${o.length}</span></h2>${o.length ? `<div class="kgrid">${o.map(recapCard).join('')}</div>` : '<p class="grp-empty">Ei avoimia keskusteluja.</p>'}</section>${done}${arch}`;
}
const newConvBtn = (w, label = true) => label
  ? `<button type="button" class="sw-primary" data-newconv="${w.id}">${ICON_PLUS}<span>Uusi keskustelu</span></button>`
  : `<button type="button" class="icon-btn plus-btn" data-newconv="${w.id}" aria-label="Uusi keskustelu" title="Uusi keskustelu">${ICON_PLUS}</button>`;

// ---------- V1 · Etusivulla: the home page is the workspace page ----------
function v1Home(w) {
  const d = git(w.id);
  const b = (act, icon, lab) => `<button type="button" class="icon-btn tb-btn" data-wa="${act}" aria-label="${lab}" title="${lab}">${icon}</button>`;
  return `<header class="wh"><div class="wh-id"><h1>${esc(w.id)}</h1><p class="wh-path"><span class="mono">${esc(w.path)}</span></p></div>
<div class="wh-act" role="toolbar" aria-label="Työtilan toiminnot">${b('copy', ICON_COPY, 'Kopioi polku')}${b('gh', ICON_GH, `Avaa GitHubissa · ${d.gh}`)}${b('rename', ICON_PEN, 'Muuta näyttönimeä…')}<button type="button" class="icon-btn tb-btn is-danger" data-wa="trash" aria-label="Siirrä roskakoriin…" title="Siirrä roskakoriin…">${ICON_TRASH}</button><span class="wh-div" aria-hidden="true"></span>${newConvBtn(w, false)}</div></header>
<div class="wh-git">${gitPill(d)}<span class="wh-sum">${summary(w)}</span></div>${work(w)}`;
}
// ---------- V2 · Sivupalkissa: the home page is only the work ----------
function v2Home(w) {
  return `<header class="sw-h"><div><h1>Keskustelut</h1><p class="wh-sum">${summary(w)}</p></div>${newConvBtn(w)}</header>${work(w)}`;
}
// ---------- V3 · Yläpalkissa: the home page carries the conversations and Git ----------
function v3Home(w) {
  return `<header class="sw-h"><div><h1>Keskustelut</h1><p class="wh-sum">${summary(w)}</p></div>${gitPill(git(w.id))}</header>${work(w)}`;
}

// ---------- Multi-workspace home (today's overview, shortened) ----------
function multiHome() {
  const all = UI.ws;
  const sec = (w) => {
    const d = git(w.id), o = openConvs(w);
    return `<section class="ov-sec${FRESH === w.id ? ' sw-fresh' : ''}" data-sec="${w.id}"><div class="ov-head"><a href="#" class="ov-name mono" data-wsname="${w.id}">${esc(w.id)}</a><span class="ov-branch">${ICON_BRANCH}<span class="mono">${esc(d.branch)}</span>${d.files.length ? ` · ${plural(d.files.length, 'muutos', 'muutosta')}` : ''}</span>${FRESH === w.id ? '<span class="ov-new">uusi</span>' : ''}<span class="grow"></span><button type="button" class="icon-btn" data-trash="${w.id}" aria-label="Siirrä ${esc(w.id)} roskakoriin…" title="Siirrä roskakoriin…">${ICON_TRASH}</button>${newConvBtn(w, false)}</div>
${o.length ? `<div class="kgrid">${o.map(recapCard).join('')}</div>` : `<p class="ov-empty">Ei vielä keskusteluja. <button type="button" class="linkbtn" data-newconv="${w.id}">Aloita ensimmäinen</button></p>`}</section>`;
  };
  return `<div class="sw-page multi"><header class="sw-h"><div><h1>Työtilat</h1><p class="wh-sum">${plural(all.length, 'työtila', 'työtilaa')} · ${summary({ convs: all.flatMap(w => w.convs) })}</p></div><button type="button" class="sw-primary" data-addws>${ICON_FOLDER_PLUS}<span>Uusi työtila</span></button></header>${all.map(sec).join('')}</div>`;
}

function body() {
  if (!single()) return multiHome();
  const w = only();
  return `<div class="sw-page ${CUR}">${CUR === 'v1' ? v1Home(w) : CUR === 'v2' ? v2Home(w) : v3Home(w)}</div>`;
}

// ---------- Sidebar ----------
// Multi mode restores the library's sidebar exactly as account.js built it.
const MULTI_CLASS = uiRail.className, MULTI_RAIL = uiRail.innerHTML;
const SINGLE_RAIL = {
  v1: (w) => `<div class="rail-head sw-head"><a href="#" class="sw-name" data-home${homeCur()} title="Etusivu">${ICON_REPO}<span class="mono">${esc(w.id)}</span></a>${conn}${closeBtn}</div>
<button type="button" class="sw-row sw-newconv" data-newconv="${w.id}">${ICON_PLUS}<span>Uusi keskustelu</span></button>
<nav class="rail-list" aria-label="Keskustelut">${APP.list(w, w.convs.filter(c => !c.archived))}<button type="button" class="p-newws sw-addws" data-addws>${ICON_FOLDER_PLUS}<span>Lisää työtila</span></button></nav>
<div class="rail-foot p-foot">${userBtn}</div>`,
  v2: (w) => `<div class="sw-ws"><div class="rail-head sw-head"><a href="#" class="sw-name" data-home${homeCur()} title="Etusivu">${ICON_REPO}<span class="mono">${esc(w.id)}</span></a><button type="button" class="icon-btn sw-more" data-wsmenu aria-haspopup="menu" aria-expanded="${MENU}" aria-label="Työtilan ${esc(w.id)} toiminnot" title="Työtilan toiminnot">${ICON_DOWN}</button>${closeBtn}</div>
<p class="sw-path">${conn}<span class="mono">${esc(w.path)}</span></p>${gitPill(git(w.id), ' sw-git')}</div>
<button type="button" class="sw-row sw-newconv" data-newconv="${w.id}">${ICON_PLUS}<span>Uusi keskustelu</span></button>
<nav class="rail-list" aria-label="Keskustelut">${APP.list(w, w.convs.filter(c => !c.archived))}</nav>
<div class="rail-foot p-foot">${userBtn}</div>`,
  v3: () => '',
};
const libPaintRail = window.paintRail;
window.paintRail = function () {
  if (!single()) {
    if (uiRail.dataset.mode !== 'multi') { uiRail.className = MULTI_CLASS; uiRail.innerHTML = MULTI_RAIL; uiRail.dataset.mode = 'multi'; }
    libPaintRail();
    uiRail.querySelector('.home-row')?.toggleAttribute('aria-current', PAGE === 'home');
    if (FRESH) uiRail.querySelector(`[data-ws-tog="${FRESH}"]`)?.closest('.ws').classList.add('sw-fresh');
    return;
  }
  uiRail.dataset.mode = 'single'; uiRail.className = `rail sw-rail sw-${CUR}`;
  uiRail.setAttribute('aria-label', 'Työtila ja keskustelut');
  uiRail.innerHTML = SINGLE_RAIL[CUR](only());
  if (PAGE === 'home') uiRail.querySelectorAll('.conv-row[aria-current]').forEach(a => a.removeAttribute('aria-current'));
};

// ---------- V3's top bar ----------
const bar = document.createElement('header'); bar.className = 'sw-bar'; uiMain.insertBefore(bar, uiMain.firstChild);
function paintBar() {
  const w = only();
  bar.innerHTML = `<a href="#" class="sw-name" data-home${homeCur()} title="Etusivu">${ICON_REPO}<span class="mono">${esc(w.id)}</span></a><button type="button" class="icon-btn sw-more" data-wsmenu aria-haspopup="menu" aria-expanded="${MENU}" aria-label="Työtilan ${esc(w.id)} toiminnot" title="Työtilan toiminnot">${ICON_DOWN}</button>${conn}<span class="grow"></span><button type="button" class="sw-primary sw-bar-new" data-newconv="${w.id}" aria-label="Uusi keskustelu">${ICON_PLUS}<span>Uusi keskustelu</span></button><button type="button" class="p-me sw-me" data-menu="user3" data-place="down" aria-haspopup="menu" aria-expanded="false" aria-label="Tili ja palvelin"><span class="avatar">J</span><span class="p-name">Jari</span>${ICON_DOWN}</button>`;
}

// ---------- Frame: mode, top bar, current rows ----------
APP.painted.push(() => {
  const one = single();
  uiFrame.classList.toggle('sw-single', one);
  uiFrame.classList.toggle('sw-norail', one && CUR === 'v3');
  uiFrame.classList.toggle('sw-home', PAGE === 'home');
  if (one && CUR === 'v3') paintBar();
  if (PAGE === 'home') {
    uiRail.querySelectorAll('.conv-row[aria-current]').forEach(a => a.removeAttribute('aria-current'));
    uiTop.innerHTML = `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button><div class="tb-title"><strong${one ? ' class="mono"' : ''}>${one ? esc(only().id) : 'Etusivu'}</strong></div>`;
  } else if (one) {
    // One workspace: the conversation's workspace link would only repeat the sidebar head.
    uiTop.querySelector('.tb-ws')?.remove();
  }
});

// ---------- Workspace menu (V2, V3) ----------
const menu = document.createElement('div'); menu.className = 'p-menu sw-menu'; menu.setAttribute('role', 'menu'); menu.hidden = true; uiFrame.appendChild(menu);
const mi = (act, icon, label, extra = '', cls = '') => `<button type="button" role="menuitem" data-wa="${act}"${cls ? ` class="${cls}"` : ''}>${icon}<span>${label}</span>${extra}</button>`;
function openMenu(anchor) {
  if (MENU) return closeMenu();
  const w = only(); MENU = true; closeGit();
  menu.innerHTML = `<div class="p-who"><span class="srv-ic">${ICON_REPO}</span><span><strong class="mono">${esc(w.id)}</strong><small class="mono">${esc(w.path)}</small></span></div><hr>${mi('copy', ICON_COPY, 'Kopioi polku')}${mi('gh', ICON_EXT, 'Avaa GitHubissa', `<span class="kbd mono">${git(w.id).gh}</span>`)}${mi('rename', ICON_PEN, 'Muuta näyttönimeä…')}<hr>${mi('add', ICON_FOLDER_PLUS, 'Lisää työtila…')}<hr>${mi('trash', ICON_TRASH, 'Siirrä roskakoriin…', '', 'danger')}`;
  menu.hidden = false;
  const f = uiFrame.getBoundingClientRect(), a = anchor.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(a.left - f.left - 160, f.width - menu.offsetWidth - 8)) + 'px';
  menu.style.top = (a.bottom - f.top + 6) + 'px';
  document.querySelectorAll('[data-wsmenu]').forEach(b => b.setAttribute('aria-expanded', 'true'));
  menu.querySelector('button').focus({ preventScroll: true });
}
function closeMenu(focusBack = false) {
  if (!MENU) return; MENU = false; menu.hidden = true;
  const b = [...document.querySelectorAll('[data-wsmenu]')].find(x => x.offsetParent); b?.setAttribute('aria-expanded', 'false'); if (focusBack) b?.focus();
}

// ---------- Git layer (anchored on desktop, bottom sheet on the phone) ----------
const layer = document.createElement('div'); layer.className = 'wl'; layer.tabIndex = -1; layer.hidden = true; layer.setAttribute('role', 'dialog'); layer.setAttribute('aria-label', 'Git'); uiFrame.appendChild(layer);
const lscrim = document.createElement('div'); lscrim.className = 'wl-scrim'; lscrim.hidden = true; uiFrame.appendChild(lscrim);
const isPhone = () => uiFrame.getBoundingClientRect().width < 600;
function openGit(anchor) {
  if (LAYER) return closeGit(true);
  LAYER = 'git'; closeMenu(); const w = only(), d = git(w.id);
  layer.innerHTML = `<div class="wl-head"><span>Git · <span class="mono">${esc(w.id)}</span></span><button type="button" class="icon-btn wl-x" data-wl-close aria-label="Sulje" title="Sulje">${ICON_CLOSE}</button></div><div class="wl-git"><p class="g-branch">${ICON_BRANCH}<span class="mono">${esc(d.branch)}</span>${syncIcons(d)}<span class="g-sync">${syncText(d)}</span></p><p class="g-fetched">Viimeisin kirjattu haku ${d.fetched}</p><h3 class="side-h">Muutokset <span class="count plain">${d.files.length}</span></h3>${fileList(d)}<h3 class="side-h">Viimeisimmät commitit</h3>${commitList(d)}</div>`;
  layer.hidden = false;
  const sheet = isPhone(); layer.classList.toggle('sheet', sheet); lscrim.hidden = !sheet;
  if (!sheet) {
    const f = uiFrame.getBoundingClientRect(), a = anchor.getBoundingClientRect();
    const right = a.left - f.left < 300; // the sidebar's pill opens to its right
    layer.style.left = (right ? Math.min(a.right - f.left + 8, f.width - layer.offsetWidth - 8) : Math.max(8, Math.min(a.left - f.left, f.width - layer.offsetWidth - 8))) + 'px';
    layer.style.top = (right ? a.top - f.top : a.bottom - f.top + 6) + 'px';
  } else { layer.style.left = layer.style.top = ''; }
  anchor.setAttribute('aria-expanded', 'true'); layer.focus({ preventScroll: true });
}
function closeGit(focusBack = false) {
  if (!LAYER) return; LAYER = null; layer.hidden = true; lscrim.hidden = true;
  const a = [...document.querySelectorAll('[data-git]')].find(x => x.getAttribute('aria-expanded') === 'true');
  a?.setAttribute('aria-expanded', 'false'); if (focusBack) a?.focus({ preventScroll: true });
}
lscrim.addEventListener('click', () => closeGit());
stage.addEventListener('scroll', () => { if (LAYER && !isPhone()) closeGit(); });

// ---------- Hetki alhaalla: the floating notice ----------
const LIFE = 9000; let NOTE = null;
function notice(text, act, undo) {
  NOTE?.el.remove(); clearTimeout(NOTE?.timer);
  const el = document.createElement('div'); el.className = 'an an-snack'; el.setAttribute('role', 'status');
  el.innerHTML = `<span class="an-text">${text}</span>${act ? `<button class="an-act" type="button">${act}</button>` : ''}<button class="icon-btn an-x" type="button" aria-label="Sulje ilmoitus" title="Sulje">${ICON_CLOSE}</button>`;
  uiMain.appendChild(el);
  const me = { el, timer: 0 }; NOTE = me;
  const end = () => { if (NOTE !== me) return; clearTimeout(me.timer); el.remove(); NOTE = null; };
  const run = () => { clearTimeout(me.timer); me.timer = setTimeout(end, LIFE); };
  el.addEventListener('pointerenter', () => clearTimeout(me.timer));
  el.addEventListener('pointerleave', () => { if (!el.contains(document.activeElement)) run(); });
  el.addEventListener('focusin', () => clearTimeout(me.timer));
  el.addEventListener('focusout', (e) => { if (NOTE === me && !el.contains(e.relatedTarget) && !el.matches(':hover')) run(); });
  el.querySelector('.an-act')?.addEventListener('click', (e) => { e.stopPropagation(); end(); undo(); });
  el.querySelector('.an-x').addEventListener('click', (e) => { e.stopPropagation(); end(); });
  run();
}

// ---------- Mode changes ----------
// The frame follows the workspace count; the rail or the whole sidebar eases in so the change
// is seen, not just found.
function swap() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  uiRail.classList.remove('sw-in'); void uiRail.offsetWidth; uiRail.classList.add('sw-in');
}
const TRASH = [];
function addWorkspace(p) {
  if (UI.ws.some(w => w.id === p.id)) return;
  UI.ws.push({ id: p.id, path: `~/src/${p.id}`, open: true, convs: [] });
  GIT[p.id] = { gh: p.gh, branch: 'main', upstream: 'origin/main', ahead: 0, behind: 0, fetched: 'juuri nyt', files: [], commits: [p.commit] };
  const wasSingle = UI.ws.length === 2; FRESH = p.id;
  showHome(); if (wasSingle) swap();
  notice(wasSingle ? `<b>${esc(p.id)}</b> kloonattu. Työtiloja on nyt kaksi, joten sivupalkki näyttää ne ryhminä.` : `<b>${esc(p.id)}</b> kloonattu.`);
  setTimeout(() => { if (FRESH === p.id) { FRESH = null; document.querySelectorAll('.sw-fresh').forEach(n => n.classList.remove('sw-fresh')); } }, 2400);
}
function trashWorkspace(id) {
  const i = UI.ws.findIndex(w => w.id === id); const [w] = UI.ws.splice(i, 1); TRASH.push({ w, i });
  if (selConv().ws === w) UI.sel = only().convs[0].id;
  showHome(); if (single()) swap();
  notice(single() ? `<b>${esc(id)}</b> siirtyi roskakoriin. Jäljellä on yksi työtila, joten näkymä keskittyy siihen.` : `<b>${esc(id)}</b> siirtyi roskakoriin.`, 'Palauta', () => {
    const t = TRASH.pop(); if (!t) return; const back = single(); UI.ws.splice(t.i, 0, t.w); showHome(); if (back) swap(); toast(`${t.w.id} palautettu roskakorista.`);
  });
}
const confirmDlg = document.createElement('dialog'); confirmDlg.className = 'confirm sw-confirm'; document.body.appendChild(confirmDlg);
let PENDING = null;
function askTrash(id) {
  closeMenu(); PENDING = id;
  const last = UI.ws.length === 1;
  confirmDlg.innerHTML = `<form method="dialog"><h3>Siirretäänkö <span class="mono">${esc(id)}</span> roskakoriin?</h3><p>Hakemisto <span class="mono">~/src/${esc(id)}</span> siirtyy roskakoriin, josta sen voi palauttaa. ${last ? 'Se on ainoa työtilasi, joten etusivu näyttää sen jälkeen aloituksen: kloonaa repo tai luo hakemisto.' : UI.ws.length === 2 ? 'Jäljelle jää yksi työtila, ja näkymä keskittyy siihen.' : ''}</p><div class="confirm-actions"><button class="secondary" value="cancel" autofocus>Peruuta</button><button class="primary danger" value="ok">Siirrä roskakoriin</button></div></form>`;
  confirmDlg.showModal();
}
confirmDlg.addEventListener('close', () => {
  if (confirmDlg.returnValue !== 'ok' || !PENDING) return;
  if (UI.ws.length === 1) { toast('Tämä vedos ei näytä aloitusnäkymää; viimeinen työtila jää paikalleen.'); PENDING = null; return; }
  trashWorkspace(PENDING); PENDING = null;
});

// ---------- Add workspace dialog (short; the chooser itself is its own round) ----------
const addDlg = document.createElement('dialog'); addDlg.className = 'confirm sw-add'; document.body.appendChild(addDlg);
function openAdd() {
  closeMenu(); closeGit(); UI.drawer = false; paint();
  const free = POOL.filter(p => !UI.ws.some(w => w.id === p.id));
  addDlg.innerHTML = `<form method="dialog"><h3>Lisää työtila</h3><p class="sw-add-sub">Kloonaa repo GitHubista hakemistoon <span class="mono">~/src</span>.${single() ? ' Kun työtiloja on kaksi, sivupalkki näyttää ne ryhminä.' : ''}</p><ul class="sw-repos">${free.map(p => `<li><button type="button" class="sw-repo" data-repo="${p.id}">${ICON_GH}<span><span class="mono">${p.gh}</span><small>${esc(p.desc)}</small></span>${ICON_FWD}</button></li>`).join('')}</ul><div class="sw-prog" hidden></div><div class="confirm-actions"><button class="secondary" value="cancel">Peruuta</button></div></form>`;
  addDlg.showModal();
}
addDlg.addEventListener('click', (e) => {
  const b = e.target.closest('[data-repo]'); if (!b || addDlg.dataset.busy) return;
  const p = POOL.find(x => x.id === b.dataset.repo); addDlg.dataset.busy = '1';
  const prog = addDlg.querySelector('.sw-prog'); prog.hidden = false;
  prog.innerHTML = `<p>Kloonataan <span class="mono">${p.gh}</span> → <span class="mono">~/src/${p.id}</span></p><span class="sw-bar-track"><span class="sw-bar-fill"></span></span>`;
  addDlg.querySelector('.sw-repos').classList.add('busy');
  setTimeout(() => { delete addDlg.dataset.busy; addDlg.close('ok'); addWorkspace(p); }, 1100);
});
addDlg.addEventListener('cancel', (e) => { if (addDlg.dataset.busy) e.preventDefault(); });

// ---------- Rendering ----------
function render() {
  const top = stage.scrollTop; following = false;
  stage.innerHTML = body(); stage.scrollTop = top; lastTop = stage.scrollTop;
}
function showHome() {
  PAGE = 'home'; UI.drawer = false; UI.pop = false; closeMenu(); closeGit();
  paint(); following = false; stage.innerHTML = body(); stage.scrollTop = 0; lastTop = 0;
}
function newConv(w) {
  const id = `n${++UI.created}`; w.convs.unshift({ id, title: 'Uusi keskustelu', st: 'new' }); w.open = true;
  PAGE = 'conv'; closeMenu(); closeGit(); openConv(id);
}

// ---------- Clicks ----------
// Window capture runs before the library's document listeners, so home and the workspace
// controls take their clicks first; conversations still open through the library.
window.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.closest('.proto-picker') || t.closest('.an') || t.closest('dialog')) return;
  const stop = () => { e.preventDefault(); e.stopPropagation(); };
  if (MENU && !t.closest('.sw-menu') && !t.closest('[data-wsmenu]')) closeMenu();
  if (LAYER && !t.closest('.wl') && !t.closest('[data-git]')) closeGit();
  if (t.closest('[data-home], [data-ui="home"], .rail-head .srv')) { stop(); return showHome(); }
  const wsn = t.closest('[data-wsname], .ws-name[data-ui="ws"], .tb-ws[data-ui="ws"]');
  if (wsn) {
    stop(); const id = wsn.dataset.wsname || wsn.closest('.ws')?.querySelector('[data-ws-tog]')?.dataset.wsTog || selConv().ws.id;
    showHome(); return stage.querySelector(`[data-sec="${id}"]`)?.scrollIntoView({ block: 'start' });
  }
  // The library sidebar's Uusi työtila opens this round's dialog, which knows the Git facts.
  if (t.closest('[data-p="nws"]')) { stop(); return openAdd(); }
  if (t.closest('[data-conv], [data-ws-add]')) { PAGE = 'conv'; closeMenu(); closeGit(); return; }
  const hit = t.closest('[data-git], [data-wl-close], [data-newconv], [data-addws], [data-wsmenu], [data-wa], [data-trash], [data-fold], [data-arch]');
  if (!hit) return;
  stop();
  const d = hit.dataset;
  if (hit.getAttribute('aria-disabled') === 'true') return toast(hit.title);
  if (d.git !== undefined) return openGit(hit);
  if (d.wlClose !== undefined) return closeGit(true);
  if (d.newconv) return newConv(UI.ws.find(w => w.id === d.newconv));
  if (d.addws !== undefined) return openAdd();
  if (d.wsmenu !== undefined) return openMenu(hit);
  if (d.trash) return askTrash(d.trash);
  if (d.fold) { FOLD[d.fold] = !FOLD[d.fold]; return render(); }
  if (d.arch) {
    const c = AUR.convs.find(x => x.id === d.arch); c.archived = true; (ARCHIVED.aurinkokello ||= []).unshift({ id: c.id, title: c.title, t: 'juuri nyt' });
    paint(); render();
    return notice(`Arkistoitu <b>${esc(c.title)}</b>`, 'Palauta', () => { c.archived = false; ARCHIVED.aurinkokello.shift(); paint(); render(); });
  }
  const w = only(); closeMenu();
  switch (d.wa) {
    case 'copy': try { await navigator.clipboard.writeText(w.path); } catch {} return toast(`Kopioitu ${w.path}`);
    case 'gh': return toast(`Avautuisi uuteen välilehteen: github.com/${git(w.id).gh}`);
    case 'rename': return toast('Näyttönimi muutettaisiin kuten työtilasivulla; hakemisto ei muutu.');
    case 'add': return openAdd();
    case 'trash': return askTrash(w.id);
  }
}, true);
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (MENU) { e.stopPropagation(); return closeMenu(true); }
  if (LAYER) { e.stopPropagation(); return closeGit(true); }
}, true);
menu.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault(); const bs = [...menu.querySelectorAll('button')]; const i = bs.indexOf(document.activeElement);
  bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length]?.focus();
});

// Every direction starts from the same single workspace.
const show = (v) => () => {
  CUR = v; FRESH = null; NOTE?.el.remove(); NOTE = null;
  for (const id of UI.ws.slice(1).map(w => w.id)) delete GIT[id];
  UI.ws.splice(1); TRASH.length = 0;
  PAGE = 'home'; UI.drawer = false; UI.pop = false; closeMenu(); closeGit(); paint();
  following = false; requestAnimationFrame(() => { stage.scrollTop = 0; lastTop = 0; });
  return body();
};
window.v1 = show('v1'); window.v2 = show('v2'); window.v3 = show('v3');
})();
