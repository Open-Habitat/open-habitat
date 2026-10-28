// Shared synthetic Habitat for research-workmux-sidebar's rounds. Synthetic names and data only.
// The fixture is one evening of a stint: a conductor in `kasvimaa` with eight workers, a few
// conversations elsewhere, three of them the person's turn. Rows follow railNow.ts: Sinun vuorosi
// (a question or a new reply), Käynnissä (working, waiting for a message, waiting on background
// work), then the workspaces alphabetically. Every row carries the time since its last change,
// which the host does not publish today (report.md, idea 2).
//
// A round sets F.hooks: { running(list) -> html for Käynnissä, workspaces() -> html for the
// workspace list, topbar(c) -> extra topbar html, strip() -> html under the topbar,
// streamEnd(c) -> html at the end of the conversation, onKey(e) -> handled? }.
(() => {
const SVG = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IC = {
  folder: SVG('<path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17z"/>'),
  worktree: SVG('<circle cx="7" cy="6" r="2"/><path d="M7 8v10"/><path d="M7 12c0 3 3 4 7 4"/><circle cx="17" cy="16" r="2"/>'),
  menu: SVG('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  home: SVG('<path d="M4 11.5 12 5l8 6.5"/><path d="M6 10v9h12v-9"/>'),
  down: SVG('<path d="m6 9 6 6 6-6"/>'),
  right: SVG('<path d="m9 6 6 6-6 6"/>'),
  next: SVG('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  arrow: SVG('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  x: SVG('<path d="M6 6l12 12M18 6 6 18"/>'),
  dots: SVG('<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>'),
};
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WS = ['kasvimaa', 'kirjasto', 'kotisivu', 'muistiinpanot', 'resepti', 'saaasema'];
// t: minutes since the conversation's last change. kind: question | new | working | waiting |
// background. worker: a Taskfleet worker's own conversation (its own row, never nested).
const ALL = [
  { id: 'c1', title: 'Iltakierros', ws: 'kasvimaa', kind: 'question', t: 4, ask: 'Mergetäänkö satokalenterin prototyyppi nyt vai odotetaanko valintaasi?', opts: ['Odota valintaa', 'Mergeä nyt'] },
  { id: 'c2', title: 'Kuvien pakkaus', ws: 'kirjasto', kind: 'new', t: 12, reply: 'Pakkaus on nyt build-vaiheessa ja testit ovat vihreinä. Kuvien koko pieneni keskimäärin 38 %.' },
  { id: 'c3', title: 'Sääaseman CSV-vienti', ws: 'saaasema', kind: 'new', t: 64, reply: 'Vienti kirjoittaa nyt yhden tiedoston vuorokautta kohden. Aikavyöhyke on UTC, kuten pyysit.' },
  { id: 'c4', title: 'Rupeama 29', ws: 'kasvimaa', kind: 'background', t: 25, waits: '6 workeria' },
  { id: 'w1', title: 'Kastelun ajastus', ws: 'kasvimaa', kind: 'working', t: 12, worker: true },
  { id: 'w2', title: 'Lomakkeen saavutettavuus', ws: 'kasvimaa', kind: 'working', t: 8, worker: true },
  { id: 'w3', title: 'Kuvagallerian lataus', ws: 'kasvimaa', kind: 'working', t: 3, worker: true },
  { id: 'w4', title: 'Tutkimus: sääennusteen rajapinnat', ws: 'kasvimaa', kind: 'working', t: 21, worker: true },
  { id: 'w5', title: 'Prototyyppi: satokalenteri', ws: 'kasvimaa', kind: 'working', t: 5, worker: true },
  { id: 'w6', title: 'Vanhan rajapinnan poisto', ws: 'kasvimaa', kind: 'working', t: 0.7, worker: true },
  { id: 'w7', title: 'Mobiilinäkymän otsikko', ws: 'kasvimaa', kind: 'waiting', t: 130, worker: true },
  { id: 'w8', title: 'Kylvökalenterin testit', ws: 'kasvimaa', kind: 'waiting', t: 310, worker: true },
  { id: 'c5', title: 'Lainaushistoria', ws: 'kirjasto', kind: 'working', t: 2 },
  { id: 'c6', title: 'Hakuindeksi', ws: 'kirjasto', kind: 'waiting', t: 190 },
  { id: 'c7', title: 'Anturien kalibrointi', ws: 'saaasema', kind: 'background', t: 15, waits: 'kalibrointi.sh' },
  { id: 'c8', title: 'Blogin RSS', ws: 'kotisivu', kind: 'waiting', t: 1500 },
];
const FEW = ['c2', 'c5', 'c6'];
const LABEL = { question: 'Kysyy sinulta', new: 'Uusi vastaus', working: 'Työskentelee', waiting: 'Odottaa viestiä', background: 'Odottaa taustatyötä' };
const QUIET_MIN = 60; // waiting for a message for over an hour: nobody is on it right now
const ago = (m) => m < 1 ? `${Math.round(m * 60)} s` : m < 60 ? `${Math.round(m)} min` : m < 1440 ? `${Math.floor(m / 60)} h` : `${Math.floor(m / 1440)} pv`;

const fresh = () => ({ cur: 'c4', seen: new Set(), answered: new Set(), drawer: false, open: {}, toast: '', bump: 0 });
const S = { v: 0, scene: 'many', ...fresh() };

function convs() {
  const base = S.scene === 'few' ? ALL.filter(c => FEW.includes(c.id) || c.id === 'c4') : ALL;
  return base.map(c => {
    const x = { ...c };
    if (x.kind === 'new' && S.seen.has(x.id)) x.kind = 'waiting';
    if (x.kind === 'question' && S.answered.has(x.id)) { x.kind = 'working'; x.t = 0.2; }
    if (S.scene === 'few' && x.id === 'c4') { x.kind = 'waiting'; x.t = 70; }
    return x;
  });
}
const byId = (id) => convs().find(c => c.id === id);
const isYours = (c) => c.kind === 'question' || c.kind === 'new';
const quiet = (c) => c.kind === 'waiting' && c.t >= QUIET_MIN;
// Sinun vuorosi in the order "Seuraava" walks: the most recent change first.
const yours = () => convs().filter(isYours).sort((a, b) => a.t - b.t);
const running = () => convs().filter(c => !isYours(c));

function mark(kind) { return `<span class="mk ${kind}" aria-hidden="true"></span>`; }
function detail(c, { ws = true } = {}) {
  return [ws ? c.ws : null, LABEL[c.kind], c.waits && c.kind === 'background' ? c.waits : null].filter(Boolean).join(' · ');
}
function row(c, opts = {}) {
  const cur = c.id === S.cur ? ' aria-current="page"' : '';
  const one = opts.one;
  return `<li><button type="button" class="row${one ? ' one' : ''}${quiet(c) ? ' quiet' : ''}" data-open="${c.id}" data-testid="row-${c.id}"${cur} title="${esc(c.title)} · ${esc(detail(c))} · ${ago(c.t)}">
    ${mark(c.kind)}<span class="txt"><span class="ttl">${esc(c.title)}</span>${one ? '' : `<span class="det">${esc(detail(c, opts))}</span>`}</span>
    ${c.worker ? `<span class="wt" title="Workerin keskustelu">${IC.worktree}</span>` : ''}<time>${ago(c.t)}</time></button></li>`;
}
function flatRunning(list) {
  return list.length ? `<ul>${list.map(c => row(c)).join('')}</ul>` : '<p class="empty">Mikään ei ole käynnissä.</p>';
}
function wsHint(ws) {
  const cs = convs().filter(c => c.ws === ws);
  const y = cs.filter(isYours).length;
  if (y) return `<span class="count attn">${y}</span>`;
  if (cs.some(c => c.kind === 'working')) return mark('working');
  if (cs.some(c => c.kind === 'background')) return mark('background');
  if (cs.some(c => c.kind === 'waiting')) return mark('waiting');
  return '';
}
function plainWorkspaces() {
  return `<section class="ws-list" aria-label="Työtilat"><h2 class="sec-head">Työtilat</h2><ul>${WS.map(w => `<li><button type="button" class="ws-row" data-ws="${w}">${IC.folder}<span class="nm">${w}</span>${wsHint(w)}</button></li>`).join('')}</ul></section>`;
}
function rail() {
  const y = yours(), r = running();
  const H = F.hooks;
  return `<nav class="rail" aria-label="Navigaatio" data-testid="rail">
    <div class="rail-head"><div class="rail-title"><span class="srv">kotipalvelin</span><span class="conn">Yhdistetty</span></div>
      <a class="rail-home" href="#" data-act="home">${IC.home}Etusivu</a></div>
    <div class="rail-scroll" data-testid="rail-scroll">
      <section class="now" data-testid="rail-yours" aria-label="Sinun vuorosi"><h2 class="sec-head">Sinun vuorosi${y.length ? `<span class="count attn">${y.length}</span>` : ''}</h2>
        ${y.length ? `<ul>${y.map(c => row(c)).join('')}</ul>` : '<p class="empty">Mikään ei odota sinua.</p>'}</section>
      ${H.running ? H.running(r) : `<section class="now" data-testid="rail-running" aria-label="Käynnissä"><h2 class="sec-head">Käynnissä${r.length ? `<span class="count">${r.length}</span>` : ''}</h2>${flatRunning(r)}</section>`}
      ${H.workspaces ? H.workspaces() : plainWorkspaces()}
      ${H.railEnd ? H.railEnd() : ''}
    </div>
    <div class="rail-foot"><span class="avatar">A</span>Aino</div>
  </nav>`;
}
function body(c) {
  if (!c) return '<p class="empty">Keskustelu ei ole enää listalla.</p>';
  const user = { c1: 'Aja iltakierros: katso workerit ja kerro, mitä pitää päättää.', c4: 'Aloita rupeama 29 TODO.md:n mukaan.' }[c.id] ?? `Tee ${c.title.toLocaleLowerCase('fi')} valmiiksi.`;
  let agent = '';
  const was = ALL.find(x => x.id === c.id);
  if (was.kind === 'question' && c.kind === 'question') agent = `<div class="ask" data-testid="ask"><p>${esc(was.ask)}</p><div class="opts">${was.opts.map(o => `<button type="button" data-answer="${c.id}">${esc(o)}</button>`).join('')}</div></div>`;
  else if (was.reply) agent = `<p>${esc(was.reply)}</p>`;
  else if (c.kind === 'background') agent = `<p>Käynnistin työt. Odotan nyt: ${esc(c.waits)}.</p>`;
  else if (c.kind === 'waiting') agent = '<p>Valmista. Kerro, jatketaanko seuraavaan vaiheeseen.</p>';
  else agent = '<p>Luen ensin nykyisen toteutuksen ja testit.</p>';
  const work = c.kind === 'working' || c.kind === 'background' ? `<p class="working-line">${mark(c.kind)}${LABEL[c.kind]} · ${ago(c.t)}</p>` : '';
  return `<div class="msg-user">${esc(user)}</div><div class="msg-agent"><span class="who">Pi</span>${agent}</div>${work}`;
}
function main() {
  const c = byId(S.cur);
  const H = F.hooks;
  const yc = yours().length;
  return `<main class="main" data-testid="main">
    <header class="topbar">
      <button type="button" class="ibtn menu" data-act="drawer" aria-label="Avaa navigaatio${yc ? `, ${yc} odottaa sinua` : ''}" data-testid="menu">${IC.menu}${yc ? `<span class="badge" aria-hidden="true">${yc}</span>` : ''}</button>
      <div class="title"><strong data-testid="conv-title">${esc(c ? c.title : '—')}</strong><span class="ws">${esc(c ? c.ws : '')}</span></div>
      ${c ? `<span class="state" title="${LABEL[c.kind]}">${mark(c.kind)}<span class="lbl">${LABEL[c.kind]}</span></span>` : ''}
      ${H.topbar ? H.topbar(c) : ''}
    </header>
    ${H.strip ? H.strip() : ''}
    <div class="stream" data-testid="stream"><div class="col">${body(c)}${H.streamEnd ? H.streamEnd(c) : ''}</div></div>
    <div class="composer"><form data-testid="composer"><textarea rows="1" placeholder="Kirjoita viesti" aria-label="Viesti"></textarea><button class="send" type="submit">Lähetä</button></form></div>
  </main>`;
}
function view() {
  return `<div class="app" data-variant="${F.names[S.v]}"${S.drawer ? ' data-drawer' : ''}>${rail()}<div class="scrim" data-act="drawer-close"></div>${main()}${S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : ''}</div>`;
}
let toastTimer;
function repaint(focus) {
  const stage = document.getElementById('stage');
  const scroll = stage.querySelector('[data-testid="rail-scroll"]')?.scrollTop ?? 0;
  stage.innerHTML = view();
  const sc = stage.querySelector('[data-testid="rail-scroll"]');
  if (sc) sc.scrollTop = scroll;
  if (focus) stage.querySelector(focus)?.focus();
  F.hooks.after?.();
  if (S.toast) { clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = ''; stage.querySelector('.toast')?.remove(); }, 2600); }
}
function open(id) {
  const c = byId(id);
  if (!c) return;
  S.cur = id;
  if (c.kind === 'new') S.seen.add(id);
  S.drawer = false;
  repaint(`[data-open="${id}"]`);
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-open],[data-act],[data-answer],[data-ws]');
  if (!t || !t.closest('#stage')) return;
  if (t.dataset.open) { e.preventDefault(); open(t.dataset.open); return; }
  if (t.dataset.answer) { S.answered.add(t.dataset.answer); S.toast = 'Vastaus lähetetty.'; repaint(); return; }
  if (t.dataset.ws) { S.toast = `Työtilan ${t.dataset.ws} sivu (ei tässä prototyypissä).`; repaint(); return; }
  const a = t.dataset.act;
  if (a === 'home') { e.preventDefault(); S.toast = 'Etusivu (ei tässä prototyypissä).'; repaint(); }
  else if (a === 'drawer') { S.drawer = !S.drawer; repaint(S.drawer ? '[data-testid="rail"] .row, [data-testid="rail"] .rail-home' : '[data-testid="menu"]'); }
  else if (a === 'drawer-close') { S.drawer = false; repaint('[data-testid="menu"]'); }
  else F.hooks.click?.(t, a, e);
});
document.addEventListener('submit', (e) => {
  if (!e.target.closest('#stage')) return;
  e.preventDefault();
  const txt = e.target.querySelector('textarea');
  if (!txt.value.trim()) return;
  const c = byId(S.cur);
  if (c && c.kind === 'question') S.answered.add(c.id);
  S.toast = 'Viesti lähetetty.';
  repaint();
});
document.addEventListener('keydown', (e) => {
  if (!document.querySelector('#stage .app')) return;
  if (e.key === 'Escape' && S.drawer) { S.drawer = false; repaint('[data-testid="menu"]'); return; }
  F.hooks.onKey?.(e);
});
function setup(names) {
  F.names = names;
  const theme = document.getElementById('theme');
  const setTheme = (t) => { document.documentElement.dataset.theme = t; theme.textContent = t === 'dark' ? 'Vaalea' : 'Tumma'; };
  setTheme(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  theme.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  document.getElementById('scene').addEventListener('change', (e) => { S.scene = e.target.value; Object.assign(S, fresh()); repaint(); });
  document.getElementById('reset').addEventListener('click', () => { Object.assign(S, fresh()); repaint(); });
  return names.map((_, i) => () => { Object.assign(S, { v: i }, fresh()); setTimeout(() => F.hooks.after?.(), 0); return view(); });
}
window.F = { IC, esc, WS, S, ago, convs, byId, isYours, quiet, yours, running, mark, detail, row, flatRunning, wsHint, plainWorkspaces, repaint, open, view, setup, LABEL, hooks: {} };
})();
