// Kierros 15.10.2026: asetukset ja palvelimen ylläpito. Tilivalikon Asetukset ja
// Palvelimen ylläpito avaavat tämän näkymän; keskustelurivi palaa keskusteluun.
(() => {
const I = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IC = {
  user: I('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5"/>'),
  agent: I('<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M9 13h.01M15 13h.01"/>'),
  link: I('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  eye: I('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.5"/>'),
  disk: I('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 14h18M7 17h.01"/>'),
  server: I('<rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/><path d="M8 7.5h.01M8 16.5h.01"/>'),
  users: I('<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.9-3 3-4.5 5.5-4.5s4.6 1.5 5.5 4.5"/><path d="M16 6a3 3 0 0 1 0 5.6M17.5 14.6c1.6.6 2.6 2 3 4.4"/>'),
  key: I('<circle cx="8" cy="14" r="4"/><path d="M11 11l8-8M16 6l2 2M14 8l2 2"/>'),
  back: I('<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>'),
  ok: I('<path d="m5 12.5 4.5 4.5L19 7"/>'),
  warn: I('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4M12 17h.01"/>'),
};
// ---------- State (synthetic) ----------
const GiB = 1073741824;
const S = {
  page: null, v: 'v1', sec: 'tili', admin: true,
  name: 'Jari Mustonen', email: 'jari@example.invalid', login: 'maintainer',
  gitName: 'Jari Mustonen', gitEmail: 'person@example.test',
  gh: 'ok', pi: 'ok', model: 'openai-codex/gpt-5.4', models: ['openai-codex/gpt-5.4', 'openai-codex/gpt-5.4-mini', 'openai-codex/gpt-5.5'],
  apiKey: null, auth: 'sub', work: 'hidden',
  use: 3.2 * GiB, limit: 8 * GiB,
  srv: { name: 'open-habitat-test', ver: '0.0.0-pilot.92', def: 8 * GiB, cap: 37.2 * GiB, free: 32.3 * GiB },
  users: [
    { id: '101', login: 'maintainer', name: 'Jari Mustonen', admin: true, use: 3.2 * GiB, limit: 8 * GiB, seen: 'nyt' },
    { id: '202', login: 'kaisa', name: 'Kaisa', admin: false, use: 0.4 * GiB, limit: 8 * GiB, seen: 'eilen' },
    { id: '303', login: 'testaaja', name: 'Testaaja', admin: false, use: 7.6 * GiB, limit: 8 * GiB, seen: '3 pv' },
  ],
  edit: null, draft: {},
};
const gib = (b) => { const g = b / GiB; return `${g >= 10 ? Math.round(g) : g.toFixed(1).replace('.', ',')} GiB`; };
const pct = (a, b) => Math.min(100, Math.round(100 * a / b));
const over = () => S.users.reduce((s, u) => s + u.limit, 0) > S.srv.cap;

// ---------- Pieces ----------
const status = (kind, text) => `<span class="s-status ${kind}">${kind === 'ok' ? IC.ok : kind === 'warn' ? IC.warn : '<span class="dot"></span>'}${text}</span>`;
const bar = (a, b, label) => { const p = pct(a, b); return `<div class="s-bar${p >= 90 ? ' high' : ''}" role="img" aria-label="${label}: ${gib(a)} / ${gib(b)}"><span style="width:${p}%"></span></div>`; };
const btn = (act, text, cls = 'secondary', x = '') => `<button type="button" class="${cls}" data-s="${act}"${x}>${text}</button>`;
// A row: label and explanation left, value or control right. Editing opens below.
function row(id, label, desc, value, action = '', editor = '') {
  const open = S.edit === id;
  return `<div class="s-row${open ? ' editing' : ''}" id="row-${id}"><div class="s-lbl"><span class="s-name">${label}</span>${desc ? `<span class="s-desc">${desc}</span>` : ''}</div><div class="s-val">${value}${action}</div>${open ? `<div class="s-editor">${editor}</div>` : ''}</div>`;
}
const field = (k, label, val, mono = false, type = 'text') => `<label class="s-field"><span>${label}</span><input class="${mono ? 'mono' : ''}" data-draft="${k}" value="${esc(S.draft[k] ?? val ?? '')}" type="${type}" autocomplete="off"></label>`;
const saveBar = (act, hint = '') => `<div class="s-actions">${hint ? `<span class="s-hint">${hint}</span>` : ''}${btn('cancel', 'Peruuta')}${btn(act, 'Tallenna', 'primary')}</div>`;

// ---------- Sections ----------
const SECTIONS = [
  ['tili', 'Tili', IC.user], ['agentti', 'Agentti', IC.agent], ['yhteydet', 'Yhteydet', IC.link], ['ulkoasu', 'Ulkoasu', IC.eye], ['tila', 'Tallennustila', IC.disk],
];
const ADMIN = [['palvelin', 'Palvelin', IC.server], ['kayttajat', 'Käyttäjät', IC.users], ['levy', 'Levytila', IC.disk]];
const SEC = {
  tili: () => [
    `<div class="s-who"><span class="s-avatar">${S.name[0]}</span><div><strong>${esc(S.name)}</strong><span class="s-desc">${esc(S.email)} · GitHub <span class="mono">${S.login}</span></span></div>${btn('logout', 'Kirjaudu ulos…')}</div>`,
    row('git', 'Git-identiteetti', 'Commitien tekijä. Tallentuu tiedostoon <span class="mono">~/.gitconfig</span>.', `<span class="s-v2"><span>${esc(S.gitName)}</span><span class="mono s-desc">${esc(S.gitEmail)}</span></span>`, btn('edit:git', 'Muokkaa'),
      field('gitName', 'Nimi', S.gitName) + field('gitEmail', 'Sähköposti', S.gitEmail, true) + saveBar('save:git')),
  ],
  agentti: () => [
    row('model', 'Oletusmalli', 'Uudet keskustelut alkavat tällä mallilla. Avoimen keskustelun malli ei vaihdu.', `<select class="mono" data-s="model" aria-label="Oletusmalli">${S.models.map(m => `<option${m === S.model ? ' selected' : ''}>${m}</option>`).join('')}</select>`),
    row('auth', 'Pi:n käyttämä tunnus', 'Valitse, laskutetaanko ChatGPT-tilausta vai API-avainta.', `<div class="s-seg" role="group" aria-label="Pi:n käyttämä tunnus">${[['sub', 'ChatGPT-tilaus'], ['key', 'API-avain']].map(([v, l]) => `<button type="button" data-s="auth:${v}" aria-pressed="${S.auth === v}"${v === 'key' && !S.apiKey ? ' aria-disabled="true" title="Lisää ensin API-avain"' : ''}>${l}</button>`).join('')}</div>`),
    row('work', 'Agentin työ', 'Näytetäänkö agentin ajattelu ja työkalut keskustelussa oletuksena.', `<div class="s-seg" role="group" aria-label="Agentin työ">${[['hidden', 'Piilossa'], ['visible', 'Näkyvissä']].map(([v, l]) => `<button type="button" data-s="work:${v}" aria-pressed="${S.work === v}">${l}</button>`).join('')}</div>`),
  ],
  yhteydet: () => [
    row('gh', 'GitHub', 'Kloonaus ja push sinun GitHub-tunnuksillasi.', status('ok', 'Yhdistetty'), btn('toast:GitHub-yhteys tarkistettaisiin uudelleen.', 'Tarkista')),
    row('pi', 'ChatGPT-tilaus (Pi)', 'Pi:n oma kirjautuminen tällä palvelimella.', S.pi === 'ok' ? status('ok', 'Kirjautunut') : status('warn', 'Ei kirjautunut'), btn('toast:Pi:n laitekoodikirjautuminen alkaisi.', S.pi === 'ok' ? 'Kirjaudu uudelleen' : 'Kirjaudu')),
    row('key', 'OpenAI API-avain', 'Tallentuu vain Pi:n omiin tunnuksiin tällä palvelimella. Avainta ei näytetä tallennuksen jälkeen.', S.apiKey ? `<span class="mono">sk-…${S.apiKey.slice(-4)}</span>` : '<span class="s-desc">Ei avainta</span>',
      S.apiKey ? btn('edit:key', 'Vaihda') + btn('delkey', 'Poista', 'quiet') : btn('edit:key', 'Lisää avain'),
      field('apiKey', 'API-avain', '', true, 'password') + saveBar('save:key', 'Avain lähetetään kerran palvelimelle.')),
  ],
  ulkoasu: () => [
    row('theme', 'Teema', 'Järjestelmä seuraa laitteen asetusta. Koskee tätä selainta.', themeSeg()),
  ],
  tila: () => [
    row('own', 'Käyttö', 'Koko kotihakemistosi: työtilat, Pi:n historia ja välimuistit.', `<span class="s-v2 grow"><span><strong>${gib(S.use)}</strong> / ${gib(S.limit)}</span>${bar(S.use, S.limit, 'Oma tallennustila')}</span>`),
  ],
  palvelin: () => [
    row('srvname', 'Palvelimen nimi', 'Näkyy sivupalkin yläreunassa kaikille.', `<span class="mono">${esc(S.srv.name)}</span>`, btn('edit:srvname', 'Muokkaa'), field('srvName', 'Nimi', S.srv.name, true) + saveBar('save:srvname')),
    row('ver', 'Versio', '', `<span class="mono">${S.srv.ver}</span>`),
  ],
  kayttajat: () => [`<p class="s-note">Vain kirjautuneet GitHub-käyttäjät näkyvät. Ylläpitäjä ei näe muiden työtiloja, keskusteluja eikä tunnuksia.</p>`, userTable()],
  levy: () => [
    row('cap', 'Levy', over() ? 'Rajojen summa ylittää levyn koon. Se on sallittua, mutta levy voi täyttyä.' : 'Kotihakemistojen levy.', `<span class="s-v2 grow"><span><strong>${gib(S.srv.cap - S.srv.free)}</strong> käytössä · ${gib(S.srv.free)} vapaana</span>${bar(S.srv.cap - S.srv.free, S.srv.cap, 'Levy')}</span>`),
    row('def', 'Oletusraja', 'Uusien käyttäjien raja. Ei muuta nykyisiä.', `<span>${gib(S.srv.def)}</span>`, btn('edit:def', 'Muuta'), field('def', 'Raja (GiB)', String(S.srv.def / GiB)) + saveBar('save:def')),
  ],
};
function userTable() {
  return `<div class="s-table" role="table" aria-label="Käyttäjät"><div class="s-tr th" role="row"><span role="columnheader">Käyttäjä</span><span role="columnheader">Tallennustila</span><span role="columnheader">Rooli</span><span role="columnheader"><span class="sr">Toiminnot</span></span></div>${S.users.map(u => {
    const editing = S.edit === 'u' + u.id;
    return `<div class="s-tr${editing ? ' editing' : ''}" role="row"><span role="cell" class="s-user"><span class="s-avatar sm">${u.name[0]}</span><span><strong>${esc(u.name)}</strong><span class="s-desc mono">${u.login}</span></span></span><span role="cell" class="s-use"><span>${gib(u.use)} / ${gib(u.limit)}</span>${bar(u.use, u.limit, u.login)}</span><span role="cell">${u.admin ? '<span class="s-badge">Ylläpitäjä</span>' : '<span class="s-desc">Käyttäjä</span>'}</span><span role="cell" class="s-acts">${btn('edit:u' + u.id, 'Raja…', 'quiet')}${u.login === S.login ? '' : btn('role:' + u.id, u.admin ? 'Poista ylläpito' : 'Tee ylläpitäjäksi', 'quiet')}</span>${editing ? `<div class="s-editor" role="cell">${field('u' + u.id, `Raja käyttäjälle ${u.login} (GiB)`, String(u.limit / GiB))}${saveBar('save:u' + u.id, u.use > 0 ? `Käytössä ${gib(u.use)}. Pienempi raja estää uudet kirjoitukset.` : '')}</div>` : ''}</div>`;
  }).join('')}</div>`;
}
const secTitle = (id) => [...SECTIONS, ...ADMIN].find(s => s[0] === id)[1];
const secHtml = (id, h = 'h2') => `<section class="s-sec" id="sec-${id}" aria-labelledby="t-${id}"><${h} id="t-${id}">${secTitle(id)}</${h}><div class="s-card">${SEC[id]().join('')}</div></section>`;
const nav = (list, cur, attr = 'nav') => list.map(([id, l, ic]) => `<a href="#sec-${id}" class="s-nav-i" data-s="${attr}:${id}"${cur === id ? ' aria-current="true"' : ''}>${ic}<span>${l}</span></a>`).join('');

// ---------- V1 · Yksi sivu ----------
function v1Body() {
  const all = [...SECTIONS, ...(S.admin ? ADMIN : [])];
  return `<div class="s-page v1"><nav class="s-nav" aria-label="Asetusten osiot">${nav(SECTIONS, S.sec, 'jump')}${S.admin ? `<span class="s-nav-h">Palvelin</span>${nav(ADMIN, S.sec, 'jump')}` : ''}</nav>
<div class="s-main"><h1>Asetukset</h1>${SECTIONS.map(s => secHtml(s[0])).join('')}${S.admin ? `<h1 class="s-h1b" id="admin">Palvelimen ylläpito</h1><p class="s-note">Näkyy vain ylläpitäjille.</p>${ADMIN.map(s => secHtml(s[0])).join('')}` : ''}</div></div>`;
}
// ---------- V2 · Osiot ----------
function v2Body() {
  const isAdmin = ADMIN.some(a => a[0] === S.sec);
  return `<div class="s-page v2${S.v2detail ? ' detail' : ''}"><nav class="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>${nav(SECTIONS, S.sec)}${S.admin ? `<span class="s-nav-h">Palvelimen ylläpito</span>${nav(ADMIN, S.sec)}` : ''}</nav>
<div class="s-main"><button type="button" class="s-back quiet" data-s="v2back">${IC.back}Asetukset</button>${isAdmin ? '<p class="s-crumb">Palvelimen ylläpito</p>' : ''}${secHtml(S.sec, 'h1')}</div></div>`;
}
// ---------- V3 · Kaksi näkymää ----------
function v3Body() {
  if (S.page === 'admin') {
    const used = S.srv.cap - S.srv.free;
    return `<div class="s-page v3 admin"><div class="s-main"><header class="s-head"><h1>Palvelimen ylläpito</h1><span class="mono s-desc">${esc(S.srv.name)} · ${S.srv.ver}</span></header>
<div class="s-tiles"><div class="s-tile"><span class="s-desc">Levy</span><strong>${gib(used)} / ${gib(S.srv.cap)}</strong>${bar(used, S.srv.cap, 'Levy')}${over() ? `<span class="s-warn">${IC.warn}Rajojen summa ylittää levyn</span>` : ''}</div><div class="s-tile"><span class="s-desc">Käyttäjiä</span><strong>${S.users.length}</strong><span class="s-desc">${S.users.filter(u => u.admin).length} ylläpitäjä</span></div><div class="s-tile"><span class="s-desc">Oletusraja</span><strong>${gib(S.srv.def)}</strong>${btn('edit:def', 'Muuta', 'quiet')}</div></div>
${S.edit === 'def' ? `<div class="s-card pad">${field('def', 'Uusien käyttäjien raja (GiB)', String(S.srv.def / GiB))}${saveBar('save:def', 'Ei muuta nykyisiä rajoja.')}</div>` : ''}
<section class="s-sec"><h2>Käyttäjät</h2>${SEC.kayttajat().join('')}</section>
<section class="s-sec"><h2>Palvelin</h2><div class="s-card">${SEC.palvelin().join('')}</div></section></div></div>`;
  }
  return `<div class="s-page v3"><div class="s-main narrow"><header class="s-head"><h1>Asetukset</h1>${S.admin ? btn('goadmin', `${IC.server}Palvelimen ylläpito`, 'secondary') : ''}</header>${SECTIONS.map(s => secHtml(s[0])).join('')}</div></div>`;
}
const BODIES = { v1: v1Body, v2: v2Body, v3: v3Body };

// ---------- Wiring into the frame ----------
const render = () => { const y = stage.scrollTop; stage.innerHTML = BODIES[S.v](); stage.scrollTop = y; };
const show = (v) => () => { S.v = v; S.page = S.page || 'settings'; S.edit = null; S.draft = {}; S.v2detail = false; UI.pop = false; paint(); return BODIES[v](); };
window.v1 = show('v1'); window.v2 = show('v2'); window.v3 = show('v3');
APP.painted.push(() => {
  uiFrame.classList.toggle('is-settings', !!S.page);
  if (!S.page) return;
  uiRail.querySelectorAll('.conv-row[aria-current], .home-row[aria-current]').forEach(a => a.removeAttribute('aria-current'));
  const t = S.page === 'admin' ? 'Palvelimen ylläpito' : 'Asetukset';
  uiTop.innerHTML = `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button><div class="tb-title"><strong>${t}</strong></div>`;
});
const open = (page) => { S.page = page; S.edit = null; if (S.v === 'v2') { S.sec = page === 'admin' ? 'palvelin' : 'tili'; S.v2detail = page === 'admin'; } UI.drawer = false; paint(); stage.innerHTML = BODIES[S.v](); stage.scrollTop = 0; if (page === 'admin' && S.v === 'v1') requestAnimationFrame(() => stage.querySelector('#admin')?.scrollIntoView()); };
// Before the account menu's own handler (document capture): the menu's Asetukset and
// Palvelimen ylläpito open this view instead of a toast.
window.addEventListener('click', (e) => {
  if (e.target.closest('.proto-picker')) return;
  const p = e.target.closest('[data-p="settings"], [data-p="admin"]');
  if (p) { e.preventDefault(); e.stopPropagation(); document.querySelector('.p-menu')?.setAttribute('hidden', ''); return open(p.dataset.p === 'admin' ? 'admin' : 'settings'); }
  if (S.page && e.target.closest('[data-conv], [data-ui="home"]')) { S.page = null; uiFrame.classList.remove('is-settings'); }
}, true);
stage.addEventListener('click', (e) => {
  const t = e.target.closest('[data-s]'); if (!t || t.tagName === 'SELECT') return;
  e.preventDefault();
  if (t.getAttribute('aria-disabled') === 'true') return toast(t.title || 'Ei käytettävissä');
  const [a, arg] = t.dataset.s.split(/:(.*)/s);
  if (a === 'jump') { S.sec = arg; stage.querySelector('#sec-' + arg)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); stage.querySelectorAll('.s-nav-i').forEach(n => n.toggleAttribute('aria-current', n.dataset.s === t.dataset.s)); return; }
  if (a === 'nav') { S.sec = arg; S.edit = null; S.v2detail = true; render(); stage.scrollTop = 0; return; }
  if (a === 'v2back') { S.v2detail = false; return render(); }
  if (a === 'goadmin') return open('admin');
  if (a === 'edit') { S.edit = S.edit === arg ? null : arg; S.draft = {}; render(); stage.querySelector('.s-editor input')?.focus(); return; }
  if (a === 'cancel') { S.edit = null; S.draft = {}; return render(); }
  if (a === 'save') return save(arg);
  if (a === 'delkey') { S.apiKey = null; S.auth = 'sub'; render(); return toast('API-avain poistettiin Pi:n tunnuksista. Pi käyttää ChatGPT-tilausta.'); }
  if (a === 'auth') { S.auth = arg; render(); return toast(arg === 'key' ? 'Uudet keskustelut käyttävät API-avainta.' : 'Uudet keskustelut käyttävät ChatGPT-tilausta.'); }
  if (a === 'work') { S.work = arg; return render(); }
  if (a === 'role') { const u = S.users.find(x => x.id === arg); u.admin = !u.admin; render(); return toast(u.admin ? `${u.login} on nyt ylläpitäjä.` : `${u.login} ei ole enää ylläpitäjä.`); }
  if (a === 'logout') return toast('Kirjauduttaisiin ulos tästä selaimesta. Palvelimen yhteydet säilyvät.');
  if (a === 'toast') return toast(arg);
});
stage.addEventListener('input', (e) => { const k = e.target.dataset?.draft; if (k) S.draft[k] = e.target.value; });
stage.addEventListener('change', (e) => { if (e.target.dataset?.s === 'model') { S.model = e.target.value; toast(`Uudet keskustelut: ${S.model}`); } });
stage.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.closest('.s-editor input')) { e.preventDefault(); e.target.closest('.s-editor, .s-tr, .s-card').querySelector('[data-s^="save:"]')?.click(); } if (e.key === 'Escape' && S.edit) { S.edit = null; render(); } });
function save(id) {
  const d = S.draft; const num = (k, cur) => { const v = parseFloat(String(d[k] ?? '').replace(',', '.')); return isFinite(v) && v > 0 ? v * GiB : cur; };
  if (id === 'git') { S.gitName = d.gitName ?? S.gitName; S.gitEmail = d.gitEmail ?? S.gitEmail; toast('Git-identiteetti tallennettiin.'); }
  else if (id === 'key') { if (!/^sk-\S{8,}$/.test(d.apiKey || '')) return toast('Avain alkaa sk- ja on pidempi.'); S.apiKey = d.apiKey; S.auth = 'key'; toast('API-avain tallennettiin Pi:n tunnuksiin. Uudet keskustelut käyttävät sitä.'); }
  else if (id === 'srvname') { S.srv.name = d.srvName || S.srv.name; uiRail.querySelector('.srv').textContent = S.srv.name; toast('Nimi tallennettiin.'); }
  else if (id === 'def') { S.srv.def = num('def', S.srv.def); toast('Oletusraja tallennettiin.'); }
  else if (id.startsWith('u')) { const u = S.users.find(x => 'u' + x.id === id); u.limit = num(id, u.limit); toast(`Raja tallennettiin: ${u.login} ${gib(u.limit)}.`); }
  S.edit = null; S.draft = {}; render();
}
})();
