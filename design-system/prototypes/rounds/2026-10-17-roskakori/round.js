// Työtilan poisto ja roskakori (proto-trash-and-devices, 17.10.2026). Työtilasivu on
// tuotannon nykyinen (Ikonirivi: kopioi, GitHub, nimi, piilotus, poisto, +), ja roskakorin
// kuva on aina sama tieto: nimi, poistoaika, koko, mitä Gitissä on vain täällä ja montako
// keskustelua palaa palautuksessa. Poistovahvistus on yksi dialogi, joka tarkistaa ensin
// (daemonin tarkistukset ADR 0019:stä) ja näyttää sitten yhden kolmesta tapauksesta:
// estetty, roskakoriin tai heti pysyvästi (puhdas ja kokonaan pushattu). Sivupalkin rivi
// avaa työtilasivun kuten tuotannossa; kirjaston …-valikko poistetaan.
(() => {
const ICON_COPY = SVG('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>');
const ICON_GH = SVG('<path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>');
const ICON_PEN = SVG('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>');
const ICON_EYE_OFF = SVG('<path d="M3 3l18 18"/><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-2.6 3.2M6.4 7.4C4.3 8.9 3 12 3 12s4 6 9 6a8.6 8.6 0 0 0 3.6-.8"/><path d="M9.9 10a3 3 0 0 0 4.1 4.1"/>');
const ICON_TRASH = SVG('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>');
const ICON_BRANCH = SVG('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10"/><path d="M18 10c0 4-6 3-12 7"/>');
const ICON_UP = SVG('<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>');
const ICON_RESTORE = SVG('<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6"/><path d="M4 4v4.6h4.6"/>');
const ICON_TERM = SVG('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3"/><path d="M12 15h5"/>');
const ICON_FLEET = SVG('<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M8 6h3a3 3 0 0 1 3 3v0a3 3 0 0 0 2 2.8M8 18h3a3 3 0 0 0 3-3v0a3 3 0 0 1 2-2.8"/>');
const ICON_TREE = SVG('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 13h6M12 10v6"/>');
const ICON_PI = SVG('<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M9 13h.01M15 13h.01"/>');
const ICON_Q = SVG('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.6-.8 1.1v.5"/><path d="M12 16.8h.01"/>');
const ICON_OK = SVG('<path d="m5 12.5 4.5 4.5L19 7"/>');
const ICON_DOT = SVG('<circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/>');
const ICON_FOLDER = SVG('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>');
const ICON_CHAT = SVG('<path d="M5 18.5V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8z"/>');
const ICON_GEAR = SVG('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>');
const ICON_USER = SVG('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5"/>');
const ICON_LINK = SVG('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>');
const ICON_EYE = SVG('<path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.6"/>');
const ICON_DISK = SVG('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 14h18M7 17h.01"/>');

// ---------- Synthetic native facts ----------
// Git comes from the read-only Git layer without a fetch (ADR 0019); `mb` is the directory's
// size, which the daemon would have to measure (a host fact this view assumes).
const ow = UI.ws.find(w => w.id === 'open-habitat'); ow.path = '~/src/open-habitat';
UI.ws.find(w => w.id === 'issuectl').convs.find(c => c.id === 'c10').st = 'working';
UI.ws.push(
  { id: 'kokeilu-wasm', path: '~/src/kokeilu-wasm', open: false, convs: [{ id: 'k1', title: 'Laskenta WebAssemblyna', st: 'done' }] },
  { id: 'muistiinpanot', path: '~/src/muistiinpanot', open: false, convs: [] },
);
const FACTS = {
  aurinkokello: { gh: 'maintainer/aurinkokello', branch: 'main', up: 'origin/main', ahead: 1, changed: 2, untracked: 1, stash: 0, mb: 48, fetched: '6 min sitten' },
  issuectl: { gh: 'jarimustonen/issuectl', branch: 'search-negation', up: 'origin/search-negation', ahead: 3, changed: 0, untracked: 0, stash: 1, mb: 9.4, fetched: '25 min sitten' },
  fleetrepo: { gh: null, branch: 'main', up: null, ahead: 0, changed: 0, untracked: 0, stash: 0, mb: 2.1 },
  'open-habitat': { gh: 'Open-Habitat/open-habitat', branch: 'main', up: 'origin/main', ahead: 0, changed: 4, untracked: 0, stash: 2, mb: 610, fetched: '1 t sitten' },
  'kokeilu-wasm': { gh: 'maintainer/kokeilu-wasm', branch: 'main', up: 'origin/main', ahead: 0, changed: 0, untracked: 0, stash: 0, mb: 212, fetched: '2 t sitten', ignored: ['node_modules/', '.env'], ignoredMb: 211 },
  muistiinpanot: { gh: 'maintainer/muistiinpanot', branch: 'main', up: 'origin/main', ahead: 0, changed: 1, untracked: 0, stash: 0, mb: 3.1, fetched: 'eilen' },
};
// What blocks deleting issuectl right now: one of each kind the daemon checks (ADR 0019,
// checks 1–5); an unreadable process blocks as unknown.
const BLOCK = {
  issuectl: [
    { ic: ICON_PI, t: 'Pi työskentelee keskustelussa <b>Hakusyntaksin negaatiot</b>.', how: 'Odota, että vuoro päättyy, tai pysäytä se keskustelusta.', conv: 'c10' },
    { ic: ICON_TERM, t: 'Pääte <span class="mono">zsh</span> (PID 48213) on työtilan hakemistossa.', how: 'Sulje pääte tai siirry siinä pois hakemistosta.' },
    { ic: ICON_FLEET, t: 'Taskfleet-ajo <span class="mono">01m4q7bz…kd2</span> on käynnissä tästä checkoutista.', how: 'Odota, että ajo mergeytyy, tai peru se:', cmd: 'taskfleet run cancel 01m4q7bz2kd2' },
    { ic: ICON_TREE, t: 'Repolla on linkitetty worktree <span class="mono">~/tmp/issuectl-bisect</span>.', how: 'Poista se ensin, muuten se jäisi orvoksi:', cmd: 'git worktree remove ~/tmp/issuectl-bisect' },
    { ic: ICON_Q, t: 'Prosessia 51022 ei voitu tarkistaa.', how: 'Tuntematon estää poiston varmuuden vuoksi. Tarkista uudelleen hetken päästä.' },
  ],
};
let TRASH = [
  { name: 'vanha-deploy', when: '13.10. klo 16.40', mb: 1.2, f: { gh: 'maintainer/vanha-deploy', branch: 'main', up: 'origin/main', ahead: 2, changed: 0, untracked: 0, stash: 0 }, convs: ['Deploy-skriptin siivous', 'Ansible-roolien poisto'] },
  { name: 'kokeilu-rust', when: '4.10. klo 11.02', mb: 340, f: { gh: null, branch: 'main', up: null, ahead: 0, changed: 3, untracked: 2, stash: 0 }, convs: ['Laskenta Rustilla'] },
  { name: 'muistiinpanot', when: '29.9. klo 8.15', mb: 3.4, f: { gh: 'maintainer/muistiinpanot', branch: 'main', up: 'origin/main', ahead: 0, changed: 1, untracked: 0, stash: 0 }, convs: [] },
];
const facts = (id) => FACTS[id] || (FACTS[id] = { gh: null, branch: 'main', up: null, ahead: 0, changed: 0, untracked: 0, stash: 0, mb: 1 });

// ---------- Small helpers ----------
const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
const size = (mb) => mb >= 1024 ? `${(mb / 1024).toFixed(1).replace('.', ',')} GiB` : `${mb >= 10 ? Math.round(mb) : mb.toFixed(1).replace('.', ',')} MiB`;
const trashMb = () => TRASH.reduce((s, e) => s + e.mb, 0);
const clean = (f) => !!f.up && !f.ahead && !f.changed && !f.untracked && !f.stash;
// What exists only here: the facts the confirmation and the Trash repeat.
function onlyHere(f) {
  const out = [];
  if (!f.up) out.push('Ei etärepoa: koko Git-historia on vain tällä palvelimella.');
  if (f.changed) out.push(`${n(f.changed, 'muutettu tiedosto', 'muutettua tiedostoa')}, ei commitoitu`);
  if (f.untracked) out.push(`${n(f.untracked, 'uusi tiedosto', 'uutta tiedostoa')}, ei Gitissä`);
  if (f.ahead) out.push(`${n(f.ahead, 'commit', 'committia')} haarassa <span class="mono">${f.branch}</span>, ei GitHubissa`);
  if (f.stash) out.push(`${n(f.stash, 'stash-merkintä', 'stash-merkintää')}`);
  return out;
}
const chips = (f) => { const c = []; if (!f.up) c.push('ei etärepoa'); if (f.ahead) c.push(`${n(f.ahead, 'commit', 'committia')} vain täällä`); if (f.changed + f.untracked) c.push(n(f.changed + f.untracked, 'muutos', 'muutosta')); if (f.stash) c.push('stash'); return c.length ? c.map(t => `<span class="rk-chip warn">${t}</span>`).join('') : '<span class="rk-chip ok">kaikki GitHubissa</span>'; };
const WHERE = {
  v1: 'Roskakori on sivupalkin alareunassa.',
  v2: 'Se näkyy sivupalkin lopussa Roskakori-ryhmässä.',
  v3: 'Roskakori on kohdassa Asetukset › Tallennustila.',
};

// ---------- State ----------
let CUR = 'v1', PAGE = { kind: 'ws', id: 'aurinkokello' }, FOLD = true, SEC = 'tila';
const ws = (id) => UI.ws.find(w => w.id === id);
const entry = (name) => TRASH.find(e => e.name === name);

// ---------- Sidebar ----------
const libPaintRail = window.paintRail;
window.paintRail = function () {
  libPaintRail();
  uiRail.querySelectorAll('.ws-more').forEach(b => b.remove());
  uiRail.querySelectorAll('.ws').forEach(s => s.querySelector('.ws-row').toggleAttribute('data-current', PAGE.kind === 'ws' && PAGE.id === s.querySelector('[data-ws-tog]').dataset.wsTog));
  uiRail.querySelector('.rk-rail')?.remove();
  if (CUR === 'v1') uiRail.querySelector('.rail-foot').insertAdjacentHTML('beforebegin', `<a href="#" class="rk-rail" data-rk="trash"${PAGE.kind === 'trash' ? ' aria-current="page"' : ''}>${ICON_TRASH}<span>Roskakori</span>${TRASH.length ? `<span class="rk-n">${TRASH.length}</span>` : ''}</a>`);
  if (CUR === 'v2' && TRASH.length && !UI.filter) uiRail.querySelector('.rail-list').insertAdjacentHTML('beforeend', `<section class="rk-fold"><button type="button" class="rk-fold-h" data-rk="fold" aria-expanded="${FOLD}">${CHEV}${ICON_TRASH}<span>Roskakori</span><span class="rk-n">${TRASH.length}</span></button>${FOLD ? `<ul>${TRASH.map(e => `<li><a href="#" class="rk-trow" data-rk="tws:${e.name}"${PAGE.kind === 'tws' && PAGE.name === e.name ? ' aria-current="page"' : ''}><span class="mono">${esc(e.name)}</span><time>${e.when.split(' ')[0]}</time></a></li>`).join('')}</ul>` : ''}</section>`);
};
APP.painted.push(() => {
  uiFrame.classList.toggle('rk-paged', PAGE.kind !== 'conv');
  if (PAGE.kind === 'conv') return;
  uiRail.querySelectorAll('.conv-row[aria-current]').forEach(a => a.removeAttribute('aria-current'));
  const t = PAGE.kind === 'ws' ? `<strong class="mono">${esc(PAGE.id)}</strong>` : PAGE.kind === 'tws' ? `<strong class="mono">${esc(PAGE.name)}</strong>` : PAGE.kind === 'trash' ? '<strong>Roskakori</strong>' : '<strong>Asetukset</strong>';
  uiTop.innerHTML = `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button><div class="tb-title">${t}</div>`;
});

// ---------- Workspace page (production's Ikonirivi) ----------
function wsPage(w) {
  const f = facts(w.id);
  const b = (act, icon, lab, extra = '') => `<button type="button" class="icon-btn tb-btn${act === 'delete' ? ' is-danger' : ''}" data-wa="${act}" aria-label="${lab}" title="${lab}"${extra}>${icon}</button>`;
  const open = w.convs.filter(c => !c.archived && convState(c) !== 'done');
  const done = w.convs.length - open.length;
  return `<div class="rk-page"><header class="wh"><div class="wh-id"><h1>${esc(w.id)}</h1><p class="wh-path mono">${esc(w.path)}</p></div>
<div class="wh-act" role="toolbar" aria-label="Työtilan toiminnot">${b('copy', ICON_COPY, 'Kopioi polku')}${b('gh', ICON_GH, f.gh ? `Avaa GitHubissa · ${f.gh}` : 'Avaa GitHubissa', f.gh ? '' : ' aria-disabled="true"')}${b('rename', ICON_PEN, 'Muuta näyttönimeä…')}${b('hide', ICON_EYE_OFF, 'Piilota sivupalkista')}${b('delete', ICON_TRASH, 'Poista työtila…')}<span class="wh-div" aria-hidden="true"></span><button type="button" class="icon-btn plus-btn" data-wa="new" aria-label="Uusi keskustelu" title="Uusi keskustelu">${ICON_PLUS}</button></div></header>
<p class="gitline">${ICON_BRANCH}<span class="mono">${esc(f.branch)}</span>${f.changed + f.untracked ? `<span class="g-dirty">${n(f.changed + f.untracked, 'muutos', 'muutosta')}</span>` : ''}${f.ahead ? `<span class="g-ahead">${ICON_UP}${f.ahead}</span>` : ''}${f.up ? '' : '<span class="g-dirty">ei etärepoa</span>'}</p>
<section class="grp"><h2 class="grp-h">Avoimet <span class="count">${open.length}</span></h2>${open.length ? `<div class="kgrid">${open.map(c => { const [l, m] = STATES[convState(c)] ?? ['Ei aloitettu', '']; return `<a href="#" class="kc" data-conv="${c.id}"><span class="kc-head"><span class="st">${m}</span><strong>${esc(c.title)}</strong></span><span class="kc-st">${l}</span></a>`; }).join('')}</div>` : '<p class="grp-empty">Ei avoimia keskusteluja.</p>'}</section>
${done ? `<p class="grp-fold">${CHEV}Valmiit · ${done}</p>` : ''}</div>`;
}

// ---------- Trash pieces (same in every direction) ----------
const restoreBlock = (e) => ws(e.name) ? `~/src/${e.name} on jo käytössä. Nimeä tai poista se ensin; palautus ei nimeä mitään hiljaa uudelleen.` : '';
function actions(e, big = false) {
  const why = restoreBlock(e);
  return `<span class="rk-acts${big ? ' big' : ''}"><button type="button" class="secondary" data-rk="restore:${e.name}"${why ? ` aria-disabled="true" title="${why}"` : ''}>${ICON_RESTORE}Palauta</button><button type="button" class="rk-quiet rk-del" data-rk="purge:${e.name}">Poista pysyvästi…</button></span>`;
}
function trashRow(e) {
  const why = restoreBlock(e);
  return `<li class="rk-row"><span class="rk-ic">${ICON_FOLDER}</span><div class="rk-main"><span class="rk-name mono">${esc(e.name)}</span><span class="rk-meta">Poistettu ${e.when} · ${size(e.mb)}${e.convs.length ? ` · ${n(e.convs.length, 'keskustelu', 'keskustelua')}` : ''}</span><span class="rk-chips">${chips(e.f)}</span>${why ? `<span class="rk-why">${why}</span>` : ''}</div>${actions(e)}</li>`;
}
const trashIntro = () => `Poistetut työtilat säilyvät täällä kokonaisina Git-historioineen ja vievät tilaa, kunnes poistat ne pysyvästi. Mitään ei poisteta automaattisesti. Tämä on kotihakemistosi tavallinen roskakori (<span class="mono">~/.local/share/Trash</span>), joten myös esimerkiksi <span class="mono">gio trash</span> ja <span class="mono">trash-restore</span> näkevät ja palauttavat samat työtilat.`;
const trashList = () => TRASH.length ? `<ul class="rk-list">${TRASH.map(trashRow).join('')}</ul>` : `<p class="rk-empty">${ICON_TRASH}<span>Roskakori on tyhjä.</span></p>`;

// ---------- V1 · Oma sivu ----------
const trashPage = () => `<div class="rk-page"><header class="wh"><div class="wh-id"><h1 class="sans">Roskakori</h1><p class="wh-path">${TRASH.length ? `${n(TRASH.length, 'työtila', 'työtilaa')} · ${size(trashMb())}` : 'tyhjä'}</p></div></header><p class="rk-intro">${trashIntro()}</p>${trashList()}</div>`;

// ---------- V2 · Työtilojen joukossa: a trashed workspace's own page ----------
function trashWsPage(e) {
  const only = onlyHere(e.f);
  const why = restoreBlock(e);
  return `<div class="rk-page tws"><header class="wh"><div class="wh-id"><h1>${esc(e.name)}</h1><p class="wh-path"><span class="mono">~/src/${esc(e.name)}</span> · roskakorissa</p></div></header>
<div class="rk-banner">${ICON_TRASH}<div><strong>Roskakorissa ${e.when} alkaen</strong><span>Hakemisto on tallessa kokonaisena (${size(e.mb)}). Palautus siirtää sen takaisin samaan paikkaan, ja keskustelut palaavat sen mukana.</span>${why ? `<span class="rk-why">${why}</span>` : ''}</div>${actions(e, true)}</div>
<section class="grp"><h2 class="grp-h">Vain tällä palvelimella</h2>${only.length ? `<ul class="rk-facts">${only.map(t => `<li class="warn">${ICON_DOT}<span>${t}</span></li>`).join('')}</ul>` : `<p class="rk-ok">${ICON_OK}Kaikki on GitHubissa <span class="mono">${esc(e.f.gh)}</span>.</p>`}</section>
<section class="grp"><h2 class="grp-h">Keskustelut <span class="count plain">${e.convs.length}</span></h2>${e.convs.length ? `<ul class="rk-convs">${e.convs.map(t => `<li>${ICON_CHAT}<span>${esc(t)}</span></li>`).join('')}</ul><p class="grp-note">Pi:n historia ei ole työtilassa, joten keskustelut eivät ole roskakorissa. Ne avautuvat taas, kun työtila palautetaan.</p>` : '<p class="grp-empty">Ei keskusteluja.</p>'}</section></div>`;
}

// ---------- V3 · Tallennustilassa ----------
const NAV = [['tili', 'Tili', ICON_USER], ['agentit', 'Agentit', ICON_PI], ['yhteydet', 'Yhteydet', ICON_LINK], ['ulkoasu', 'Ulkoasu', ICON_EYE], ['tila', 'Tallennustila', ICON_DISK]];
function settingsPage() {
  const limit = 8192, wsMb = UI.ws.reduce((s, w) => s + facts(w.id).mb, 0), pi = 380, other = 1460, t = trashMb(), used = wsMb + pi + other + t;
  const seg = (mb, cls) => `<span class="${cls}" style="width:${(100 * mb / limit).toFixed(2)}%"></span>`;
  const line = (cls, l, mb) => `<li><span class="rk-sw ${cls}"></span><span>${l}</span><span class="mono">${size(mb)}</span></li>`;
  return `<div class="rk-set"><nav class="rk-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>${NAV.map(([id, l, ic]) => `<a href="#" class="rk-nav-i" data-rk="sec:${id}"${id === SEC ? ' aria-current="true"' : ''}>${ic}<span>${l}</span></a>`).join('')}</nav>
<div class="rk-set-main"><h2 class="rk-set-h">Tallennustila</h2><div class="rk-card"><div class="rk-use"><span><strong>${size(used)}</strong> / ${size(limit)}</span><span class="rk-bar" role="img" aria-label="Käytössä ${size(used)} / ${size(limit)}, roskakori ${size(t)}">${seg(wsMb, 'ws')}${seg(pi + other, 'oth')}${seg(t, 'tr')}</span><ul class="rk-legend">${line('ws', 'Työtilat', wsMb)}${line('oth', 'Pi:n historia ja välimuistit', pi + other)}${line('tr', 'Roskakori', t)}</ul></div></div>
<h2 class="rk-set-h" id="roskakori">Roskakori</h2><p class="rk-intro">${trashIntro()} Pysyvä poisto vapauttaa tilan.</p>${trashList()}</div></div>`;
}

// ---------- Delete confirmation (same in every direction) ----------
const dlg = document.createElement('dialog'); dlg.className = 'confirm rk-dlg'; document.body.appendChild(dlg);
let DLG = null;
function askDelete(id) {
  DLG = { kind: 'delete', id };
  dlg.innerHTML = `<div class="rk-checking" role="status"><span class="rk-spin" aria-hidden="true"></span>Tarkistetaan, käyttääkö jokin työtilaa <span class="mono">${esc(id)}</span>…</div>`;
  dlg.showModal();
  setTimeout(() => { if (DLG?.id === id && dlg.open) paintDelete(id); }, 180);
}
const factList = (items, cls) => `<ul class="rk-facts">${items.map(t => `<li class="${cls}">${cls === 'warn' ? ICON_DOT : ICON_OK}<span>${t}</span></li>`).join('')}</ul>`;
function paintDelete(id) {
  const w = ws(id), f = facts(id), conv = w.convs.length;
  const convNote = conv ? `<p class="rk-note">${ICON_CHAT}<span>${n(conv, 'keskustelu säilyy', 'keskustelua säilyy')} Pi:n historiassa; Pi:n historia ei ole työtilassa.</span></p>` : '';
  const blocks = BLOCK[id];
  if (blocks) {
    dlg.innerHTML = `<form method="dialog"><h3>Työtilaa <span class="mono">${esc(id)}</span> ei voi poistaa nyt</h3><p>Nämä käyttävät työtilaa. Poisto onnistuu, kun ne on lopetettu; mitään ei ole siirretty.</p>
<ul class="rk-blocks">${blocks.map(b => `<li>${b.ic}<div><span>${b.t}</span><span class="rk-how">${b.how}</span>${b.cmd ? `<span class="rk-cmd"><code>${esc(b.cmd)}</code><button type="button" class="icon-btn" data-copy="${esc(b.cmd)}" aria-label="Kopioi komento" title="Kopioi komento">${ICON_COPY}</button></span>` : ''}${b.conv ? `<button type="button" class="rk-link" data-goconv="${b.conv}">Avaa keskustelu</button>` : ''}</div></li>`).join('')}</ul>
<p class="rk-sub">Ei estä: keskustelut ja Gitin muutokset. Ne kulkevat roskakoriin työtilan mukana.</p>
<div class="confirm-actions"><button class="secondary" value="cancel">Sulje</button><button type="button" class="primary" data-recheck>Tarkista uudelleen</button></div></form>`;
    return;
  }
  if (clean(f)) {
    dlg.innerHTML = `<form method="dialog"><h3>Poistetaanko <span class="mono">${esc(id)}</span>?</h3><p>Kaikki on tallessa GitHubissa <span class="mono">${esc(f.gh)}</span>, joten työtila poistetaan heti pysyvästi eikä se mene roskakoriin. Sen saa takaisin kloonaamalla.</p>
${factList(['Ei muutoksia eikä uusia tiedostoja', `Kaikki commitit ovat GitHubissa (haettu ${f.fetched})`, 'Ei stash-merkintöjä'], 'ok')}
${f.ignored ? `<p class="rk-note warn">${ICON_DOT}<span>Gitin ohittamat tiedostot eivät ole GitHubissa ja häviävät: <span class="mono">${f.ignored.join(', ')}</span> (${size(f.ignoredMb)}).</span></p>` : ''}${convNote}
<div class="confirm-actions spread"><button class="rk-quiet" value="trash">Siirrä silti roskakoriin</button><span class="grow"></span><button class="secondary" value="cancel" autofocus>Peruuta</button><button class="danger" value="purge">Poista pysyvästi</button></div></form>`;
    return;
  }
  const only = onlyHere(f);
  dlg.innerHTML = `<form method="dialog"><h3>Siirretäänkö <span class="mono">${esc(id)}</span> roskakoriin?</h3><p>Hakemisto <span class="mono">${esc(w.path)}</span> siirtyy roskakoriin kokonaisena, ja sen voi palauttaa sieltä. ${WHERE[CUR]}</p>
<p class="rk-lead">Roskakoriin eikä suoraan pois, koska tämä on vain täällä:</p>${factList(only, 'warn')}${convNote}
<div class="confirm-actions"><button class="secondary" value="cancel" autofocus>Peruuta</button><button class="primary" value="trash">${ICON_TRASH}Siirrä roskakoriin</button></div></form>`;
}
function askPurge(name) {
  const e = entry(name); DLG = { kind: 'purge', name };
  const only = onlyHere(e.f);
  dlg.innerHTML = `<form method="dialog"><h3>Poistetaanko <span class="mono">${esc(name)}</span> pysyvästi?</h3><p>Tätä ei voi perua. ${size(e.mb)} vapautuu.</p>
${only.length ? `<p class="rk-lead">Häviää lopullisesti, koska se on vain täällä:</p>${factList(only, 'warn')}` : `<p class="rk-note">${ICON_OK}<span>Kaikki on GitHubissa <span class="mono">${esc(e.f.gh)}</span>.</span></p>`}
${e.convs.length ? `<p class="rk-note">${ICON_CHAT}<span>${n(e.convs.length, 'keskustelu säilyy', 'keskustelua säilyy')} Pi:n historiassa, mutta työtilaa ei ole enää palautettavaksi.</span></p>` : ''}
<label class="rk-type"><span>Kirjoita <b class="mono">${esc(name)}</b> vahvistukseksi</span><input class="mono" autocomplete="off" spellcheck="false" aria-label="Työtilan nimi"></label>
<div class="confirm-actions"><button class="secondary" value="cancel">Peruuta</button><button class="danger" value="purge" disabled>Poista pysyvästi</button></div></form>`;
  dlg.showModal(); dlg.querySelector('input').focus();
}
dlg.addEventListener('input', (e) => { if (DLG?.kind === 'purge') dlg.querySelector('button.danger').disabled = e.target.value.trim() !== DLG.name; });
dlg.addEventListener('click', async (e) => {
  const c = e.target.closest('[data-copy]'); if (c) { try { await navigator.clipboard.writeText(c.dataset.copy); } catch {} c.setAttribute('data-done', ''); return setTimeout(() => c.removeAttribute('data-done'), 1200); }
  if (e.target.closest('[data-recheck]')) { dlg.innerHTML = `<div class="rk-checking" role="status"><span class="rk-spin" aria-hidden="true"></span>Tarkistetaan uudelleen…</div>`; return setTimeout(() => { paintDelete(DLG.id); toast('Tilanne ei muuttunut.'); }, 400); }
  const g = e.target.closest('[data-goconv]'); if (g) { dlg.close(); PAGE = { kind: 'conv' }; return openConv(g.dataset.goconv); }
});
dlg.addEventListener('close', () => {
  const r = dlg.returnValue; dlg.returnValue = ''; const d = DLG; DLG = null;
  if (!d || !r || r === 'cancel') return;
  if (d.kind === 'delete' && r === 'trash') return moveToTrash(d.id);
  if (d.kind === 'delete' && r === 'purge') return purgeNow(d.id);
  if (d.kind === 'purge' && r === 'purge') return purgeEntry(d.name);
});

// ---------- Effects ----------
const today = () => 'tänään klo 9.41';
function moveToTrash(id) {
  const w = ws(id), f = facts(id);
  UI.ws.splice(UI.ws.indexOf(w), 1);
  TRASH.unshift({ name: id, when: today(), mb: f.mb, f, convs: w.convs.map(c => c.title), w });
  if (CUR === 'v2') { FOLD = true; PAGE = { kind: 'tws', name: id }; } else PAGE = { kind: 'ws', id: UI.ws[0].id };
  show();
  notice(`<b>${esc(id)}</b> siirretty roskakoriin`, 'Palauta', () => restore(id));
}
function purgeNow(id) {
  const w = ws(id), f = facts(id); UI.ws.splice(UI.ws.indexOf(w), 1);
  PAGE = { kind: 'ws', id: UI.ws[0].id }; show();
  toast(`${id} poistettu. Sen saa takaisin kloonaamalla ${f.gh}.`);
}
function restore(name) {
  const e = entry(name); if (!e) return;
  if (ws(name)) return toast(restoreBlock(e));
  TRASH = TRASH.filter(x => x !== e);
  const w = e.w || { id: name, path: `~/src/${name}`, open: true, convs: e.convs.map((t, i) => ({ id: `r${name}${i}`, title: t, st: 'done' })) };
  FACTS[name] = e.f; UI.ws.push(w); PAGE = { kind: 'ws', id: name }; show();
  toast(`${name} palautettu: ~/src/${name}${e.convs.length ? `. ${n(e.convs.length, 'keskustelu palasi', 'keskustelua palasi')}` : ''}.`);
}
function purgeEntry(name) {
  const e = entry(name); TRASH = TRASH.filter(x => x !== e);
  if (PAGE.kind === 'tws') PAGE = TRASH.length ? { kind: 'tws', name: TRASH[0].name } : { kind: 'ws', id: UI.ws[0].id };
  show(); toast(`${name} poistettu pysyvästi. ${size(e.mb)} vapautui.`);
}

// ---------- Hetki alhaalla (the floating notice, as on the workspace page) ----------
let NOTE = null;
function notice(text, act, undo) {
  NOTE?.el.remove(); clearTimeout(NOTE?.timer);
  const el = document.createElement('div'); el.className = 'an an-snack'; el.setAttribute('role', 'status');
  el.innerHTML = `<span class="an-text">${text}</span><button class="an-act" type="button">${act}</button><button class="icon-btn an-x" type="button" aria-label="Sulje ilmoitus" title="Sulje">${ICON_CLOSE}</button>`;
  uiMain.appendChild(el); const me = { el, timer: 0 }; NOTE = me;
  const end = () => { if (NOTE !== me) return; clearTimeout(me.timer); el.remove(); NOTE = null; };
  me.timer = setTimeout(end, 8000);
  el.addEventListener('pointerenter', () => clearTimeout(me.timer));
  el.addEventListener('pointerleave', () => { me.timer = setTimeout(end, 8000); });
  el.querySelector('.an-act').addEventListener('click', (e) => { e.stopPropagation(); end(); undo(); });
  el.querySelector('.an-x').addEventListener('click', (e) => { e.stopPropagation(); end(); });
}

// ---------- Rendering ----------
function body() {
  if (PAGE.kind === 'trash') return trashPage();
  if (PAGE.kind === 'tws') return trashWsPage(entry(PAGE.name));
  if (PAGE.kind === 'settings') return settingsPage();
  return wsPage(ws(PAGE.id) || UI.ws[0]);
}
function show() { UI.drawer = false; UI.pop = false; paint(); following = false; stage.innerHTML = body(); stage.scrollTop = 0; lastTop = 0; }
function render() { const y = stage.scrollTop; paintRail(); stage.innerHTML = body(); stage.scrollTop = y; }

window.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.closest('.proto-picker') || t.closest('.an') || t.closest('dialog')) return;
  const stop = () => { e.preventDefault(); e.stopPropagation(); };
  const p = t.closest('[data-p="settings"]');
  if (p) { stop(); document.querySelector('.p-menu')?.setAttribute('hidden', ''); PAGE = { kind: 'settings' }; SEC = 'tila'; return show(); }
  const wsName = t.closest('.ws-name[data-ui="ws"]');
  if (wsName) { stop(); PAGE = { kind: 'ws', id: wsName.closest('.ws').querySelector('[data-ws-tog]').dataset.wsTog }; return show(); }
  if (t.closest('[data-conv], [data-ws-add], [data-ui="home"]')) { PAGE = { kind: 'conv' }; return; }
  const r = t.closest('[data-rk]');
  if (r) {
    stop();
    if (r.getAttribute('aria-disabled') === 'true') return toast(r.title);
    const [a, arg] = r.dataset.rk.split(/:(.*)/s);
    if (a === 'trash') { PAGE = { kind: 'trash' }; return show(); }
    if (a === 'fold') { FOLD = !FOLD; return paintRail(); }
    if (a === 'tws') { PAGE = { kind: 'tws', name: arg }; return show(); }
    if (a === 'restore') return restore(arg);
    if (a === 'purge') return askPurge(arg);
    if (a === 'sec') { if (arg !== 'tila') return toast('Muut osiot ovat ennallaan; tässä vedoksessa vain Tallennustila.'); return; }
  }
  const wa = t.closest('[data-wa]');
  if (!wa || PAGE.kind !== 'ws') return;
  stop();
  if (wa.getAttribute('aria-disabled') === 'true') return toast('Työtilalla ei ole GitHub-originia.');
  const w = ws(PAGE.id);
  switch (wa.dataset.wa) {
    case 'delete': return askDelete(w.id);
    case 'copy': try { await navigator.clipboard.writeText(w.path); } catch {} return toast(`Kopioitu ${w.path}`);
    case 'new': { const id = `n${++UI.created}`; w.convs.unshift({ id, title: 'Uusi keskustelu', st: 'new' }); w.open = true; PAGE = { kind: 'conv' }; return openConv(id); }
    default: return toast('Toimii kuten tuotannossa; ei osa tätä kierrosta.');
  }
}, true);

const pick = (v) => () => { CUR = v; if (PAGE.kind === 'conv' || (PAGE.kind === 'tws' && v !== 'v2') || (PAGE.kind === 'trash' && v !== 'v1') || (PAGE.kind === 'settings' && v !== 'v3')) PAGE = { kind: 'ws', id: 'aurinkokello' }; if (PAGE.kind === 'ws' && !ws(PAGE.id)) PAGE.id = UI.ws[0].id; UI.pop = false; paint(); following = false; requestAnimationFrame(() => { stage.scrollTop = 0; lastTop = 0; }); return body(); };
window.v1 = pick('v1'); window.v2 = pick('v2'); window.v3 = pick('v3');
})();
