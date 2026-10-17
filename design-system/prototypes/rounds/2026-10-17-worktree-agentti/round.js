// Kierros 17.10.2026: käyttäjän oma, interaktiivinen worktree-agentti (issue
// proto-interactive-worktrees). Host-luonnoksen vaihtoehto A: daemon pyytää Taskfleetiltä
// caller-owned-ajon ja worktreen ja käynnistää siihen tavallisen selaimen Pi:n. Worktree-agentti
// on siis selainkeskustelu, jonka hakemisto on worktree: kaikki keskustelun kontrollit
// toimivat, ja Status-skripti on kirjaston elävä keskustelu worktreessä. Taskfleet omistaa
// lopun: Yhdistä (run merge), Lopeta ja säilytä työ (run cancel) ja Hylkää (run discard,
// vain lopetuksen tai epäonnistumisen jälkeen). Pysäytä on kentän tavallinen Stop eikä päätä
// ajoa. Spinoffit pysyvät ennallaan (ADR 0017): taustatyön merkit kentän yllä, vain luku.
// Suunnat eroavat vain siinä, missä worktreen merkit ja hallinta ovat keskustelun ympärillä;
// luonti, sivupalkki, työtilasivu ja tilat ovat samat kaikissa.
(() => {
const IC = {
  wt: SVG('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10"/><path d="M18 10c0 4-6 3-12 7"/>'),
  wtNew: SVG('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10"/><path d="M6 15c0-3 3-5 7-5"/><path d="M18 5v8M14 9h8"/>'),
  merge: SVG('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="14" r="2"/><path d="M6 7v10"/><path d="M6 7c0 5 6 7 10 7"/>'),
  keep: SVG('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9v6M15 9v6"/>'),
  trash: SVG('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>'),
  warn: SVG('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5"/><path d="M12 17.2h.01"/>'),
  up: SVG('<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>'),
  down: SVG('<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>'),
  fwd: SVG('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>'),
  side: SVG('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>'),
  copy: SVG('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  gh: SVG('<path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>'),
  pen: SVG('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  eyeOff: SVG('<path d="M3 3l18 18"/><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-2.6 3.2M6.4 7.4C4.3 8.9 3 12 3 12s4 6 9 6a8.6 8.6 0 0 0 3.6-.8"/><path d="M9.9 10a3 3 0 0 0 4.1 4.1"/>'),
  play: SVG('<path d="M8 5.5v13l10-6.5z"/>'),
};

// ---------- Fixture ----------
// Taskfleet places caller-owned checkouts at <source parent>/.taskfleet-worktrees/<run id>
// (host report, "Where it appears"). Branch names assume the report's ask 2 (a readable
// hint); today they are wt/<run id>.
const SRC = { branch: 'main', head: 'a41c9e2', dirty: 2, path: '~/src/aurinkokello' };
const WTROOT = '~/src/.taskfleet-worktrees/';
const AUR = UI.ws.find(w => w.id === 'aurinkokello');
const C1_COMMITS = [{ h: '6c2d9e1', s: 'status_rows: --table-lippu' }, { h: 'b83f0a4', s: 'status_rows: viime viikon rivit JSONina' }];
const C1_NEW = { h: 'e17a5c3', s: 'Testit: kiinteä päivä ja tyhjä taulukko' };
const C1_FILES = [['M', 'scripts/status_rows.py', '+6 −2'], ['?', 'tests/test_status_rows.py', 'uusi']];
const fresh = () => ({
  c1: { slug: 'status-skripti', rid: '01m55a3k7q2w9x4c8v6b1n5tdr', started: '14.28', run: 'open', ev: [] },
  list: [
    { id: 'w2', title: 'Aikavyöhyke tulosteeseen', st: 'working',
      wt: { slug: 'aikavyohyke', rid: '01m55b8d2x6q4k9w1c7v3n5hrt', started: '14.05', run: 'open', ahead: 1, behind: 0, ev: [],
        files: [['M', 'aurinkokello/format.py', '+14 −3'], ['M', 'tests/test_format.py', '+22 −0']],
        commits: [{ h: '0d9a6f2', s: 'format: aikaleimat paikalliseen aikaan' }], doing: 'Ajaa <span class="mono">pytest</span>', t0: performance.now() - 192000 },
      task: 'Näytä tulosteen aikaleimat paikallisessa aikavyöhykkeessä ja lisää `--utc`-lippu vanhaa muotoa varten.', msgs: [],
      rec: { age: 'nyt', recap: 'Aikaleimat tulostuvat paikallisessa ajassa, ja `--utc` palauttaa vanhan muodon. Testit ovat kesken.', next: '' } },
    { id: 'w3', title: 'Riippuvuuksien päivitys', st: 'failed',
      wt: { slug: 'riippuvuudet', rid: '01m55a1q7h3z8c2w6k4v9n5tbx', started: '12.51', run: 'failed', ahead: 2, behind: 1, files: [],
        commits: [{ h: '5af2b19', s: 'Taulukon tulostus richin uuteen rajapintaan' }, { h: '91c4e07', s: 'Riippuvuudet: rich 15, click 8.2' }],
        ev: [{ k: 'failed', t: '12.58', html: 'Yhdistäminen ei onnistunut: <span class="mono">pyproject.toml</span> muuttui main-haarassa (<span class="mono">7d03b18</span>) haaran luomisen jälkeen. Haara ja worktree ovat tallessa.' }] },
      task: 'Päivitä riippuvuudet uusimpiin ja korjaa, mitä hajoaa.',
      msgs: [{ reply: 'Päivitin yhdeksän riippuvuutta. `rich` 14 → 15 muutti taulukon rajapintaa, joten korjasin tulostuksen; testit menevät läpi (`pytest`: 41 ok). Haarassa on 2 committia.', t: '12.56' }],
      rec: { age: '1 t', recap: 'Riippuvuudet on päivitetty ja testit menevät läpi, mutta yhdistäminen kaatui konfliktiin tiedostossa `pyproject.toml`.', next: 'Pyydä agenttia ratkaisemaan konflikti tai hylkää työ.' } },
    { id: 'w4', title: 'Lokitason värit päätteessä', st: 'stopped',
      wt: { slug: 'lokivarit', rid: '01m54z3t7kd1q9fx5bw8nh2rcv', started: '13.31', run: 'open', ahead: 1, behind: 0,
        files: [['M', 'aurinkokello/log.py', '+9 −1']], commits: [{ h: 'c5e8a31', s: 'log: tason sana väreillä päätteessä' }],
        ev: [{ k: 'stopped', t: '13.52', html: 'Pi pysähtyi, kun palvelin käynnistyi uudelleen. Worktree, haara ja keskustelu ovat tallessa; seuraava viesti käynnistää Pi:n samaan worktreehen.' }] },
      task: 'Väritä lokitason sana tulosteessa, kun tuloste menee päätteeseen.',
      msgs: [{ reply: 'Lisäsin värit `colorize()`-funktioon; `NO_COLOR` ja putkitettu tuloste ohittavat ne. Seuraavaksi testit päätteettömälle tulosteelle.', t: '13.49' }],
      rec: { age: '50 min', recap: 'Lokitason sana väritetään päätteessä; `NO_COLOR` ja putki ohittavat värit. Testit puuttuvat vielä.', next: 'Kirjoita agentille, niin se jatkaa samassa worktreessä.' } },
    { id: 'w5', title: 'Vanhan --format-lipun poisto', st: 'cancelled',
      wt: { slug: 'format-poisto', rid: '01m54x8n5vr3k6hw2qz9td4mfy', started: '11.02', run: 'cancelled', ahead: 2, behind: 3, files: [],
        commits: [{ h: '2be71d0', s: 'README: --format pois esimerkeistä' }, { h: '8d40c96', s: 'Poista --format ja sen testit' }],
        ev: [{ k: 'cancelled', t: '11.40', html: 'Lopetettu: ”Odotetaan, että käyttäjät ehtivät siirtyä --output-lippuun.” Haara ja worktree jäivät talteen.' }] },
      task: 'Poista vanha `--format`-lippu ja sen testit.',
      msgs: [{ reply: 'Poistin lipun, sen testit ja README:n esimerkit. Testit menevät läpi.', t: '11.31' }],
      rec: { age: '3 t', recap: '`--format` on poistettu haarassa, mutta työ lopetettiin ennen yhdistämistä. Haara on tallessa.', next: 'Hylkää työ, kun sitä ei enää tarvita.' } },
    { id: 'w6', title: 'Kuun vaiheet tulosteeseen', st: 'merged',
      wt: { slug: 'kuun-vaiheet', rid: '01m54w2c6v9tq4hd7nx3bfza', started: '13.02', run: 'merged', ahead: 0, behind: 0, files: [], commits: [],
        out: { commit: 'f40b6d2', commits: 2, add: 64, del: 5, at: '13.40' }, ev: [] },
      task: 'Lisää päivän riville kuun vaihe.',
      msgs: [{ reply: 'Lisäsin kuun vaiheen laskennan `almanac.py`:hin ja päivän riville symbolin. Testit menevät läpi.', t: '13.38' }],
      rec: { age: '1 t', recap: '', next: '' } },
  ],
});
const merged = (c) => ({ k: 'merged', t: c.wt.out.at, html: `Yhdistetty main-haaraan: <span class="mono">${c.wt.out.commit}</span> · ${c.wt.out.commits} committia <span class="add">+${c.wt.out.add}</span> <span class="del">−${c.wt.out.del}</span>. Worktree ja haara <span class="mono">${branch(c)}</span> poistettiin.` });

const STEPS = ['Worktree ja haara', 'Pi käynnistyy worktreessä'];
let CUR = 'v1', PAGE = null, LAYER = false, EXPAND = false, SIDE = { desk: true, phone: false }, MADE = 0, C1DONE = false, PREVW = false;
const C1 = AUR.convs.find(c => c.id === 'c1');
function reset() {
  const f = fresh();
  AUR.convs = AUR.convs.filter(c => !c.wt || c.id === 'c1');
  C1.wt = f.c1; C1.title = 'Status-skripti';
  for (const c of f.list) { if (c.wt.run === 'merged') c.wt.ev.push(merged(c)); c.msgs.push(...c.wt.ev.map(ev => ({ ev }))); c.wt.ev = []; }
  AUR.convs.splice(2, 0, ...f.list);
  C1DONE = false; PREVW = false; MADE = 0;
  STRIP.reset();
  // The worktree agent's own background work: one spinoff it started and a test watcher.
  STRIP.B.spins = [{ id: 's4', rid: '01m55c2q8z5c1rv7kd2tx6hnwe', title: 'Testit aikavyöhykkeille', st: 'working', start: 14 * 3600 + 30 * 60 }];
  STRIP.B.procs = [{ id: 'proc_8c2e', name: 'testit', cmd: 'ptw tests/ -- -q', start: 14 * 3600 + 31 * 60, status: 'running', wake: false, out: ['Running: pytest tests/ -q', '36 passed in 1.42s', 'Odotetaan muutoksia…'] }];
}

// selConv() returns a copy; the round's actions change the conversation itself.
const sel = () => AUR.convs.find(x => x.id === UI.sel) ?? selConv();
const branch = (c) => `wt/${c.wt.slug}`;
const wtPath = (c) => `${WTROOT}${c.wt.rid}`;
const isPhone = () => uiFrame.getBoundingClientRect().width < 600;
// Worktree facts; Status-skripti's follow the library's live turn (it commits the tests).
function F(c) {
  if (c.id !== 'c1') return c.wt;
  const done = C1DONE && !C.stopped;
  return { ...c.wt, ahead: c.wt.ahead ?? (done ? 3 : 2), behind: c.wt.behind ?? 0, files: c.wt.files ?? (done ? [] : C1_FILES), commits: c.wt.commits ?? (done ? [C1_NEW, ...C1_COMMITS] : C1_COMMITS) };
}
// Display state: Taskfleet's settlement first, then Pi's activity.
const SETTLED = new Set(['creating', 'merging', 'merged', 'failed', 'cancelled', 'discarded']);
function ds(c) {
  if (!c.wt) return convState(c);
  if (c.wt.run === 'draft') return 'new';
  if (SETTLED.has(c.wt.run)) return c.wt.run;
  if (c.id === 'c1') return UI.working ? 'working' : 'waiting';
  return c.st;
}
const DS = {
  new: ['Ei aloitettu', '<span class="st-none"></span>'],
  creating: ['Luodaan', '<span class="st-dot working"></span>'],
  working: ['Työskentelee', '<span class="st-dot working"></span>'],
  waiting: ['Odottaa sinua', '<span class="st-dot waiting"></span>'],
  attention: ['Uusi vastaus', '<span class="st-dot attention"></span>'],
  stopped: ['Pysähtynyt', '<span class="st-dot stopped"></span>'],
  merging: ['Yhdistetään', '<span class="st-dot working"></span>'],
  merged: ['Yhdistetty', `<span class="wt-mk merged">${IC.merge}</span>`],
  failed: ['Ei yhdistetty · työ tallessa', `<span class="wt-mk failed">${IC.warn}</span>`],
  cancelled: ['Lopetettu · työ tallessa', `<span class="wt-mk kept">${IC.keep}</span>`],
  discarded: ['Hylätty', `<span class="wt-mk gone">${IC.trash}</span>`],
};
for (const [k, v] of Object.entries(DS)) STATES[k] ||= v;
const ORDER = { new: -1, failed: 0, attention: .5, waiting: 1, creating: 2, working: 2, merging: 2, stopped: 3, unknown: 3.5, cancelled: 4 };
const doneLike = (s) => s === 'done' || s === 'merged' || s === 'discarded';
const OPEN = (c) => c.wt && ['open', 'creating'].includes(c.wt.run);
const mark = (s) => { const [l, m] = DS[s] ?? STATES[s]; return `<span class="st" role="img" aria-label="${l}" title="${l}">${m}</span>`; };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const elapsed = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const sync = (f) => `${f.ahead ? `<span class="g-ahead" title="${f.ahead} committia, joita main-haarassa ei ole">${IC.up}${f.ahead}</span>` : ''}${f.behind ? `<span class="g-behind" title="main-haarassa ${f.behind} committia, joita tässä haarassa ei ole">${IC.down}${f.behind}</span>` : ''}`;
const dirty = (f) => f.files.length ? `<span class="g-dirty" title="Tallentamattomia muutoksia worktreessä">${plural(f.files.length, 'muutos', 'muutosta')}</span>` : '';

// What blocks merging, in the person's words; null when Yhdistä can run.
function mergeBlock(c) {
  const f = F(c); const s = ds(c);
  if (s === 'creating') return 'Worktree luodaan vielä.';
  if (f.files.length) return `Worktreessä on ${plural(f.files.length, 'tallentamaton muutos', 'tallentamatonta muutosta')}. Pyydä agenttia commitoimaan ne ensin.`;
  if (!f.ahead) return 'Haarassa ei ole vielä committeja.';
  return null;
}
// One line of where the worktree stands, for the bar, the panel and the cards.
function standing(c) {
  const f = F(c); const s = ds(c);
  if (s === 'new') return `Ensimmäinen viesti luo worktreen haarasta <span class="mono">${SRC.branch}</span>.`;
  if (s === 'creating') return `${STEPS[Math.min(c.wt.step, 1)]}…`;
  if (s === 'merging') return 'Yhdistää main-haaraan…';
  if (s === 'merged') return `Yhdistetty <span class="mono">${c.wt.out.commit}</span> · ${plural(c.wt.out.commits, 'commit', 'committia')}`;
  if (s === 'failed') return 'Yhdistäminen kaatui konfliktiin; työ on tallessa.';
  if (s === 'cancelled') return 'Lopetettu; haara ja worktree tallessa.';
  if (s === 'discarded') return 'Worktree ja haara poistettu.';
  if (s === 'working') return `${c.id === 'c1' ? 'Agentti työskentelee' : c.wt.doing || 'Työskentelee'} · <span class="wt-clock" data-t0="${c.id === 'c1' ? '' : c.wt.t0}">${c.id === 'c1' ? '' : elapsed(performance.now() - c.wt.t0)}</span>`;
  const b = mergeBlock(c);
  if (!b) return `Valmis yhdistettäväksi: ${plural(f.ahead, 'commit', 'committia')}${f.behind ? `, main ${f.behind} edellä` : ''}.`;
  return f.files.length ? `${plural(f.files.length, 'muutos', 'muutosta')} commitoimatta.` : b;
}

// ---------- Sidebar ----------
const libRow = APP.row, libList = APP.list;
APP.row = (c) => {
  if (!c.wt) return libRow(c);
  const s = ds(c); const [l] = DS[s];
  return `<a href="#" class="conv-row wt-row" data-conv="${c.id}"${c.id === UI.sel && !PAGE ? ' aria-current="page"' : ''} title="${esc(c.title)}${c.wt.slug ? ' · ' + branch(c) : ''}"><span class="wt-glyph" role="img" aria-label="Worktree-agentti" title="Worktree-agentti">${IC.wt}</span><span class="conv-title">${esc(c.title)}</span>${mark(s)}</a>`;
};
APP.list = (w, cs) => {
  if (w.id !== AUR.id) return libList(w, cs);
  const st = (c) => c.wt ? ds(c) : convState(c);
  const act = cs.filter(c => !doneLike(st(c))).sort((a, b) => (ORDER[st(a)] ?? 4) - (ORDER[st(b)] ?? 4));
  const done = cs.filter(c => doneLike(st(c)));
  const open = FOLDED[w.id] || (done.some(c => c.id === UI.sel) && !PAGE);
  return `<ul class="convs">${act.map(c => `<li>${APP.row(c)}</li>`).join('')}${done.length ? `<li><button type="button" class="done-fold" data-fold-done="${w.id}" aria-expanded="${open}">${CHEV}<span>Valmiit</span><span class="count">${done.length}</span></button></li>${open ? done.map(c => `<li>${APP.row(c)}</li>`).join('') : ''}` : ''}</ul>`;
};
// The rail's workspace row has only + (Jari 16.10.); the library's …-menu is removed.
const libPaintRail = window.paintRail;
window.paintRail = function () {
  libPaintRail();
  uiRail.querySelectorAll('.ws-more').forEach(b => b.remove());
  uiRail.querySelectorAll('.ws').forEach(s => s.querySelector('.ws-row').toggleAttribute('data-current', PAGE === s.querySelector('[data-ws-tog]').dataset.wsTog));
};

// ---------- The conversation ----------
const replyB = (text, time = '') => `<article class="bubble reply wt-reply"><div class="bar head"><span class="ok">${ICON_CHECK}Vastaus valmis</span><span class="model">${MODEL}</span>${copyBtn('Kopioi vastaus', text)}<time class="meta">${time}</time></div><div class="prose">${md(text)}</div></article>`;
const pendingB = (text) => `<article class="bubble user wt-pending"><div class="bubble-head"><span class="who">Sinä</span><span class="wt-wait">Odottaa Pi:tä</span></div><div class="prose">${md(text)}</div></article>`;
const EVI = { merged: IC.merge, failed: IC.warn, cancelled: IC.keep, discarded: IC.trash, stopped: IC.keep, resumed: IC.play, created: IC.wt };
const evRow = (e) => `<div class="wt-ev ${e.k}" role="note">${EVI[e.k]}<span>${e.html}</span><time>${e.t}</time></div>`;
const startRow = (c) => `<div class="wt-ev created" role="note">${IC.wt}<span>Worktree-agentti alkoi: <span class="mono">${branch(c)}</span> haarasta <span class="mono">${SRC.branch}</span> @ <span class="mono">${SRC.head}</span></span><time>${c.wt.started}</time></div>`;
function convo(c) {
  run++;
  const w = c.wt; const parts = [];
  if (w.run === 'draft') return `<div class="empty-convo wt-empty"><span class="wt-empty-ic">${IC.wtNew}</span><p class="lead">Uusi worktree-agentti työtilassa <span class="mono">${AUR.id}</span></p><p>Ensimmäinen viesti luo oman worktreen ja haaran haarasta <span class="mono">${SRC.branch}</span> @ <span class="mono">${SRC.head}</span> ja käynnistää siihen Pi:n. Otsikko syntyy keskustelusta.</p><p class="sub">Työtilan ${SRC.dirty} tallentamatonta muutosta eivät tule mukaan.</p></div>`;
  if (w.slug && w.run !== 'creating') parts.push(startRow(c));
  if (w.run === 'creating') parts.push(pendingB(c.task));
  else parts.push(userBubble({ md: c.task, time: w.started }, 0));
  for (const m of c.msgs) parts.push(m.ev ? evRow(m.ev) : m.user ? userBubble({ md: m.user, time: m.t || 'nyt' }, 0) : replyB(m.reply, m.t || 'nyt'));
  if (ds(c) === 'working' || ds(c) === 'merging') parts.push(`<div class="strip working wt-work"><span class="act"><span class="live-dot"></span>${ds(c) === 'merging' ? 'Yhdistää main-haaraan' : w.doing || 'Työskentelee'}</span><span class="clock wt-clock" data-t0="${w.t0}">${elapsed(performance.now() - w.t0)}</span></div>`);
  return `<div class="vwrap wt-convo">${parts.join('')}</div>`;
}
// Status-skripti is the library's live conversation; once settled it is drawn from history.
const C1_LAST = 'Testit menevät läpi (`pytest`: 9 ok). Lisäsin testin kiinteällä päivällä 2026-10-13 ja tyhjälle taulukolle, ja commitoin ne.';
const libContent = window.content;
window.content = function () {
  const c = selConv();
  if (!c.wt) return libContent();
  if (c.id !== 'c1') return convo(c);
  if (!C1DONE && !SETTLED.has(c.wt.run)) return withLive('', threadR());
  run++;
  return `${lanka('', { meta: 'top', fold: 'head', runs: 'separate' }).replace(/<\/div>\s*$/, '')}${replyB(C1_LAST, '14:37')}${c.wt.ev.map(evRow).join('')}</div>`;
};
// Details: the library's facts plus the Taskfleet run and the checkout.
const libDetails = window.detailsList;
window.detailsList = function (c) {
  const base = libDetails(c);
  if (!c.wt?.slug) return base;
  return base.replace('</dl>', `<dt>Taskfleet-ajo</dt><dd><span class="mono id">${c.wt.rid}</span>${copyBtn('Kopioi ajon tunniste', c.wt.rid)}</dd>
<dt>Worktree</dt><dd>${['merged', 'discarded'].includes(c.wt.run) ? '<span class="sub">poistettu</span>' : `<span class="mono">${wtPath(c)}</span>`}</dd></dl>`);
};
const libActions = APP.actions;
const ARCH_WHY = 'Worktree on auki. Yhdistä, lopeta tai hylkää se ensin.';
APP.actions = (c) => {
  let h = libActions(c);
  if (c.wt && OPEN(c)) h = h.replace('data-ui="archive" aria-label="Arkistoi" title="Arkistoi"', `data-ui="archive" aria-label="Arkistoi" title="${ARCH_WHY}" aria-disabled="true"`);
  if (c.wt?.slug && CUR === 'v3') h += `<button class="icon-btn tb-btn wt-side-tog" type="button" data-wt="side" aria-label="Worktree-paneeli" title="Worktree-paneeli" aria-expanded="${sideOpen()}">${IC.side}</button>`;
  return h;
};

// ---------- Shared worktree pieces: facts and controls ----------
const fileList = (f) => f.files.length ? `<ul class="g-files">${f.files.map(([s, p, n]) => `<li><span class="g-fs g-${s === '?' ? 'new' : 'mod'}" title="${s === '?' ? 'Uusi, ei vielä Gitissä' : 'Muutettu'}">${s === '?' ? 'U' : s}</span><span class="mono">${esc(p)}</span><span class="g-n">${n}</span></li>`).join('')}</ul>` : '<p class="g-clean">Ei tallentamattomia muutoksia.</p>';
const commitList = (f) => f.commits.length ? `<ul class="g-commits">${f.commits.map(x => `<li><span class="mono g-h">${x.h}</span><span class="g-s">${esc(x.s)}</span></li>`).join('')}</ul>` : '<p class="g-clean">Ei committeja, joita main-haarassa ei ole.</p>';
const branchLine = (c, f) => `<p class="g-branch">${IC.wt}<span class="mono">${branch(c)}</span><span class="wt-to">→</span><span class="mono wt-src">${SRC.branch}</span>${sync(f)}</p>`;
const b = (act, cls, icon, label, why, extra = '') => `<button type="button" class="${cls}" data-wt="${act}"${why ? ` aria-disabled="true" title="${esc(why)}"` : ` title="${esc(label)}"`}${extra}>${icon}<span>${label}</span></button>`;
const DISCARD_WHY = 'Hylkääminen on mahdollista, kun työ on lopetettu tai yhdistäminen on epäonnistunut.';
// The controls by state. `explain` adds one line under each (the side panel).
function controls(c, { explain = false, icons = false } = {}) {
  const s = ds(c); const f = F(c);
  const ex = (t) => explain ? `<small>${t}</small>` : '';
  const row = (btn, t) => explain ? `<div class="wt-ctl">${btn}${ex(t)}</div>` : btn;
  const lbl = (t) => icons ? '' : t;
  if (['creating', 'merging', 'merged', 'discarded', 'new'].includes(s)) return '';
  if (s === 'cancelled') return row(b('discard', 'wt-btn wt-danger', IC.trash, 'Hylkää…', null), 'Poistaa worktreen ja haaran. Ei peruttavissa.');
  const block = mergeBlock(c);
  const out = [];
  if (s === 'failed') out.push(row(b('resolve', 'wt-btn primary', IC.play, 'Pyydä agenttia ratkaisemaan', null), 'Agentti jatkaa samassa worktreessä ja tuo main-haaran muutokset.'));
  else {
    out.push(row(b('merge', 'wt-btn primary', IC.merge, 'Yhdistä main-haaraan', block), block && f.files.length ? 'Commitoimattomat muutokset jäisivät pois.' : `${plural(f.ahead, 'commit', 'committia')} main-haaraan; worktree ja haara poistetaan.`));
    if (block && f.files.length && s !== 'working') out.push(row(b('commit', 'wt-btn', IC.play, 'Pyydä commitoimaan', null), 'Lähettää agentille pyynnön commitoida muutokset.'));
  }
  out.push(row(b('cancel', `wt-btn${icons ? ' icon' : ''}`, IC.keep, lbl('Lopeta, säilytä työ'), null, icons ? ' aria-label="Lopeta, säilytä työ"' : ''), 'Pysäyttää Pi:n ja päättää ajon. Haara ja worktree jäävät.'));
  out.push(row(b('discard', `wt-btn wt-danger${icons ? ' icon' : ''}`, IC.trash, lbl('Hylkää…'), s === 'failed' ? null : DISCARD_WHY, icons ? ' aria-label="Hylkää…"' : ''), s === 'failed' ? 'Poistaa worktreen ja haaran. Ei peruttavissa.' : 'Vasta lopetuksen tai epäonnistumisen jälkeen.'));
  return out.join('');
}
// The facts as sections; the layer, the bar's panel and the side panel all use them.
function sections(c, { agent = false } = {}) {
  const f = F(c); const s = ds(c);
  if (s === 'new') return `<p class="wt-p">Worktree ja haara syntyvät ensimmäisestä viestistä haarasta <span class="mono">${SRC.branch}</span> @ <span class="mono">${SRC.head}</span>.</p>`;
  if (s === 'creating') return `<ol class="wt-steps">${STEPS.map((t, i) => `<li class="${i < c.wt.step ? 'done' : i === c.wt.step ? 'now' : ''}">${i < c.wt.step ? ICON_CHECK : i === c.wt.step ? '<span class="st-dot working"></span>' : '<span class="st-none"></span>'}<span>${i === 0 && c.wt.step > 0 ? `${t}: <span class="mono">${branch(c)}</span>` : t}</span></li>`).join('')}</ol>`;
  if (s === 'merged') return `${branchLine(c, f)}<dl class="wt-kv"><dt>Commit</dt><dd><span class="mono">${c.wt.out.commit}</span>${copyBtn('Kopioi commit', c.wt.out.commit)}</dd><dt>Muutokset</dt><dd class="mono">${plural(c.wt.out.commits, 'commit', 'committia')} · <span class="add">+${c.wt.out.add}</span> <span class="del">−${c.wt.out.del}</span></dd><dt>Siivous</dt><dd>Worktree ja haara poistettu</dd></dl>`;
  if (s === 'discarded') return `<p class="wt-p">Worktree <span class="mono">${wtPath(c)}</span> ja haara <span class="mono">${branch(c)}</span> poistettiin. Taskfleetin kuitti ja tämä keskustelu säilyvät.</p>`;
  const pi = { working: 'Työskentelee', waiting: 'Odottaa sinua', attention: 'Uusi vastaus', stopped: 'Ei käynnissä · seuraava viesti käynnistää', failed: 'Ei käynnissä · seuraava viesti käynnistää', cancelled: 'Lopetettu', merging: 'Pysäytetty yhdistämistä varten' }[s];
  return `${branchLine(c, f)}<p class="g-sub">haarasta <span class="mono">${SRC.branch}</span> @ <span class="mono">${SRC.head}</span> · ${f.behind ? `main on ${f.behind} committia edellä` : 'main ei ole liikkunut'}</p>
${agent ? `<h3 class="side-h">Agentti</h3><p class="wt-p">${pi}</p>` : ''}
<h3 class="side-h">Muutokset <span class="count plain">${f.files.length}</span></h3>${fileList(f)}
<h3 class="side-h">Commitit <span class="count plain">${f.commits.length}</span></h3>${commitList(f)}
<h3 class="side-h">Worktree</h3><p class="wt-path"><span class="mono">${wtPath(c)}</span>${copyBtn('Kopioi polku', wtPath(c).replace('~', '/home/maintainer'))}</p>`;
}

// ---------- V1 · Yläpalkissa: the branch pill and its layer ----------
function pill(c) {
  const f = F(c); const s = ds(c);
  const tail = s === 'merged' ? `<span class="g-ok">yhdistetty</span>` : s === 'discarded' ? `<span class="g-ok">hylätty</span>` : s === 'creating' ? `<span class="g-ok">luodaan…</span>` : `${dirty(f)}${sync(f)}`;
  const ready = s !== 'working' && OPEN(c) && !mergeBlock(c);
  return `<button type="button" class="wt-pill${ready ? ' ready' : ''}${['failed'].includes(s) ? ' failed' : ''}" data-wt="layer" aria-haspopup="dialog" aria-expanded="${LAYER}" title="${branch(c)} · worktree"><span class="wt-pill-ic">${s === 'merged' ? IC.merge : IC.wt}</span><span class="mono wt-pill-name">${c.wt.slug}</span>${tail}${ready ? '<span class="wt-ready-dot" aria-label="Valmis yhdistettäväksi"></span>' : ''}${CHEV}</button>`;
}
const layer = document.createElement('div'); layer.className = 'wl wt-layer'; layer.tabIndex = -1; layer.hidden = true; layer.setAttribute('role', 'dialog'); layer.setAttribute('aria-label', 'Worktree'); uiFrame.appendChild(layer);
const scrim = document.createElement('div'); scrim.className = 'wl-scrim'; scrim.hidden = true; uiFrame.appendChild(scrim);
function paintLayer() {
  const c = selConv();
  if (!LAYER || CUR !== 'v1' || PAGE || !c.wt?.slug) { layer.hidden = true; scrim.hidden = true; return; }
  const ctl = controls(c);
  layer.innerHTML = `<div class="wl-head"><span>Worktree · <span class="mono">${branch(c)}</span></span><button type="button" class="icon-btn wl-x" data-wt="layer" aria-label="Sulje" title="Sulje">${ICON_CLOSE}</button></div><div class="wl-git"><p class="wt-standing ${ds(c)}">${mark(ds(c))}<span>${standing(c)}</span></p>${sections(c)}</div>${ctl ? `<div class="wt-acts">${ctl}</div>` : ''}`;
  layer.hidden = false;
  const sheet = isPhone(); layer.classList.toggle('sheet', sheet); scrim.hidden = !sheet;
  const a = uiTop.querySelector('.wt-pill');
  if (sheet || !a) { layer.style.left = layer.style.top = ''; return; }
  const fr = uiFrame.getBoundingClientRect(), r = a.getBoundingClientRect();
  layer.style.left = Math.max(8, Math.min(r.left - fr.left, fr.width - layer.offsetWidth - 8)) + 'px';
  layer.style.top = (r.bottom - fr.top + 6) + 'px';
}
scrim.addEventListener('click', () => { LAYER = false; paint(); });

// ---------- V2 · Kentän yllä: the worktree bar over the composer ----------
const bar = document.createElement('section'); bar.className = 'wt-bar'; bar.setAttribute('aria-label', 'Worktree');
function barHtml(c) {
  const f = F(c); const s = ds(c);
  if (s === 'merged') return `<div class="wt-bar-line done">${IC.merge}<span class="wt-bar-say">Yhdistetty main-haaraan <span class="mono">${c.wt.out.commit}</span> · ${plural(c.wt.out.commits, 'commit', 'committia')} <span class="add">+${c.wt.out.add}</span> <span class="del">−${c.wt.out.del}</span></span><span class="wt-bar-note">Worktree poistettu; keskustelu säilyy luettavana.</span></div>`;
  if (s === 'discarded') return `<div class="wt-bar-line done">${IC.trash}<span class="wt-bar-say">Hylätty</span><span class="wt-bar-note">Worktree ja haara poistettu; keskustelu säilyy luettavana.</span></div>`;
  if (s === 'new') return `<div class="wt-bar-line">${IC.wtNew}<span class="wt-bar-say">Uusi worktree haarasta <span class="mono">${SRC.branch}</span> @ <span class="mono">${SRC.head}</span></span><span class="wt-bar-note">syntyy ensimmäisestä viestistä</span></div>`;
  if (s === 'creating') return `<div class="wt-bar-line"><span class="st-dot working"></span><span class="wt-bar-say">${STEPS[Math.min(c.wt.step, 1)]}…</span><span class="wt-bar-note">${c.wt.step ? `<span class="mono">${branch(c)}</span>` : ''}</span></div>`;
  if (s === 'merging') return `<div class="wt-bar-line"><span class="st-dot working"></span><span class="wt-bar-say">Yhdistetään main-haaraan…</span><span class="wt-bar-note">Agentille ei voi kirjoittaa sillä aikaa.</span></div>`;
  const id = `<button type="button" class="wt-bar-id" data-wt="expand" aria-expanded="${EXPAND}" title="Näytä muutokset ja commitit">${IC.wt}<span class="mono wt-bar-name">${branch(c)}</span><span class="wt-to">→</span><span class="mono wt-src">${SRC.branch}</span>${sync(f)}${dirty(f)}${CHEV}</button>`;
  const say = s === 'failed' ? `<span class="wt-bar-st failed">${IC.warn}Konflikti; työ tallessa</span>` : s === 'cancelled' ? `<span class="wt-bar-st">${IC.keep}Lopetettu; työ tallessa</span>` : '';
  return `<div class="wt-bar-line">${id}${say}<span class="grow"></span><span class="wt-bar-acts">${controls(c, { icons: true })}</span></div>${EXPAND ? `<div class="wt-bar-panel" role="region" aria-label="Worktreen muutokset"><p class="wt-standing ${s}">${mark(s)}<span>${standing(c)}</span></p>${sections(c)}</div>` : ''}`;
}

// ---------- V3 · Sivupaneelissa ----------
const side = document.createElement('aside'); side.className = 'wt-side'; side.setAttribute('aria-label', 'Worktree');
const sideScrim = document.createElement('div'); sideScrim.className = 'wl-scrim wt-side-scrim'; sideScrim.hidden = true;
const sideOpen = () => isPhone() ? SIDE.phone : SIDE.desk;
function sideHtml(c) {
  const s = ds(c); const ctl = controls(c, { explain: true });
  return `<div class="wt-side-head"><span class="wt-side-t">${IC.wt}Worktree</span><button type="button" class="icon-btn" data-wt="side" aria-label="Sulje worktree-paneeli" title="Sulje">${ICON_CLOSE}</button></div>
<p class="wt-standing ${s}">${mark(s)}<span><strong>${DS[s][0]}</strong><br>${standing(c)}</span></p>
<div class="wt-side-body">${sections(c, { agent: true })}</div>
${ctl ? `<h3 class="side-h">Lopetus</h3><div class="wt-side-ctl">${ctl}</div>` : ''}`;
}

// ---------- Dock: why the field is gone (V1, V3; V2's bar says it itself) ----------
const dock = document.createElement('div'); dock.className = 'wt-dock'; dock.setAttribute('role', 'status');
const RO = { merging: 'Yhdistetään main-haaraan. Agentille ei voi kirjoittaa sillä aikaa.', merged: 'Yhdistetty, ja worktree on poistettu, joten keskustelua ei voi jatkaa. Se säilyy luettavana.', cancelled: 'Lopetettu. Haara ja worktree ovat tallessa, mutta keskustelua ei voi jatkaa.', discarded: 'Hylätty. Worktree ja haara on poistettu; keskustelu säilyy luettavana.' };

// ---------- Workspace page (the implemented Ikonirivi page, plus worktree agents) ----------
const REC = {
  c1: () => C1DONE ? { age: 'nyt', recap: 'Skripti `scripts/status_rows.py` tulostaa viime viikon rivit JSONina tai `--table`-taulukkona. Testit kiinteällä päivällä on lisätty ja commitoitu.', next: 'Yhdistä haara main-haaraan, jos tulos kelpaa.' } : { age: '2 min', recap: 'Skripti `scripts/status_rows.py` tulostaa viime viikon rivit JSONina tai `--table`-taulukkona.', next: '' },
  c2: () => ({ age: '8 min', recap: 'Kuvat `assets/photos/` muunnettiin WebP-muotoon laadulla 82: 214 kuvaa, 38 Mt → 11 Mt. Alkuperäiset ovat yhä paikallaan.', next: 'Päätä, poistetaanko alkuperäiset vai siirretäänkö ne `originals/`-hakemistoon.' }),
};
const rec = (c) => REC[c.id]?.() ?? c.rec ?? { age: 'nyt', recap: c.msgs?.length ? c.msgs[c.msgs.length - 1].reply ?? '' : 'Keskustelulla ei vielä ole tilannekatsausta.', next: '' };
function card(c) {
  const s = c.wt ? ds(c) : convState(c); const r = rec(c); const [l] = DS[s] ?? STATES[s];
  const wt = c.wt?.slug ? (() => { const f = F(c); return `<p class="kc-wt">${IC.wt}<span class="mono">${branch(c)}</span><span class="wt-to">→</span><span class="mono">${SRC.branch}</span>${sync(f)}${dirty(f)}</p>`; })() : '';
  const doing = c.wt && ['working', 'creating', 'failed'].includes(s) ? `<p class="kc-doing ${s}">${standing(c)}</p>` : c.wt && OPEN(c) && !mergeBlock(c) && s !== 'working' ? `<p class="kc-doing ready">${IC.merge}${standing(c)}</p>` : '';
  return `<article class="kc ${s}${c.wt ? ' wt-kc' : ''}"><div class="kc-head">${mark(s)}<a href="#" class="kc-title" data-conv="${c.id}">${esc(c.title)}</a>${c.wt ? `<span class="wt-glyph" role="img" aria-label="Worktree-agentti" title="Worktree-agentti">${IC.wt}</span>` : ''}</div>
<p class="kc-meta"><span class="kc-st ${s}">${l}</span><time>${r.age === 'nyt' ? 'nyt' : r.age + ' sitten'}</time></p>${wt}${doing}
${r.recap ? `<p class="k-text">${inline(r.recap)}</p>` : ''}${r.next ? `<p class="k-next"><span class="k-label">Seuraavaksi</span><span>${inline(r.next)}</span></p>` : ''}
<a href="#" class="kc-go" data-conv="${c.id}">${s === 'waiting' ? 'Vastaa' : 'Avaa'}${IC.fwd}</a></article>`;
}
let PFOLD = false;
function pageHtml() {
  run++;
  const all = AUR.convs.filter(c => !c.archived && !(c.wt?.run === 'draft'));
  const st = (c) => c.wt ? ds(c) : convState(c);
  const open = all.filter(c => !doneLike(st(c))).sort((a, b) => (ORDER[st(a)] ?? 4) - (ORDER[st(b)] ?? 4));
  const done = all.filter(c => doneLike(st(c)));
  const tb = (act, icon, label, extra = '') => `<button type="button" class="icon-btn tb-btn" data-wt-page="${act}" aria-label="${label}" title="${label}"${extra}>${icon}</button>`;
  const nWt = open.filter(c => c.wt).length, you = open.filter(c => ['waiting', 'attention', 'failed'].includes(st(c))).length;
  return `<div class="wsp v2"><header class="wh"><div class="wh-id"><h1>${AUR.id}</h1><p class="wh-path"><span class="mono">${SRC.path}</span></p></div>
<div class="wh-act" role="toolbar" aria-label="Työtilan toiminnot">${tb('copy', IC.copy, 'Kopioi polku')}${tb('gh', IC.gh, 'Avaa GitHubissa · maintainer/aurinkokello')}${tb('rename', IC.pen, 'Muuta näyttönimeä…')}${tb('hide', IC.eyeOff, 'Piilota sivupalkista')}<button type="button" class="icon-btn tb-btn is-danger" data-wt-page="delete" aria-label="Poista työtila…" title="Työtilassa on avoimia worktree-agentteja." aria-disabled="true">${IC.trash}</button><span class="wh-div" aria-hidden="true"></span>
<button type="button" class="icon-btn wt-new-btn" data-wt="new" aria-label="Uusi worktree-agentti työtilassa ${AUR.id}" title="Uusi worktree-agentti: oma worktree ja haara">${IC.wtNew}</button><button type="button" class="icon-btn plus-btn" data-ws-add="${AUR.id}" aria-label="Uusi keskustelu työtilassa ${AUR.id}" title="Uusi keskustelu">${ICON_PLUS}</button></div></header>
<div class="wh-git"><button type="button" class="gitline" data-wt-page="git">${IC.wt}<span class="mono">${SRC.branch}</span><span class="g-dirty">${SRC.dirty} muutosta</span><span class="g-ahead">${IC.up}1</span>${CHEV}</button><span class="wh-sum">${you ? `<strong>${you} odottaa sinua</strong>` : 'mikään ei odota sinua'} · ${plural(nWt, 'worktree-agentti', 'worktree-agenttia')}</span></div>
<section class="grp"><h2 class="grp-h">Avoimet <span class="count">${open.length}</span></h2><div class="kgrid">${open.map(card).join('')}</div></section>
${done.length ? `<section class="grp"><button type="button" class="fold" data-wt-page="fold" aria-expanded="${PFOLD}">${CHEV}<span>Valmiit</span><span class="count plain">${done.length}</span></button>${PFOLD ? `<ul class="rows">${done.map(c => `<li><a href="#" class="row" data-conv="${c.id}">${mark(st(c))}${c.wt ? `<span class="wt-glyph">${IC.wt}</span>` : ''}<span class="row-title">${esc(c.title)}</span><span class="row-sub">${c.wt?.run === 'merged' ? `yhdistetty <span class="mono">${c.wt.out.commit}</span>` : c.wt?.run === 'discarded' ? 'hylätty' : ''}</span></a></li>`).join('')}</ul>` : ''}</section>` : ''}</div>`;
}
function showPage() { PAGE = AUR.id; LAYER = false; EXPAND = false; UI.pop = false; UI.drawer = false; paint(); following = false; stage.innerHTML = pageHtml(); stage.scrollTop = 0; lastTop = 0; }
function rerender() {
  if (PAGE) { const top = stage.scrollTop; stage.innerHTML = pageHtml(); stage.scrollTop = top; return; }
  const c = selConv(); if (!c.wt || c.id === 'c1') return;
  stage.innerHTML = convo(c); following = true; stage.scrollTop = stage.scrollHeight;
}

// ---------- Painting the frame per direction ----------
APP.painted.push(() => {
  const c = selConv();
  // Status-skripti's live turn settles: its commit lands and its facts change.
  if (PREVW && !UI.working && c.id === 'c1' && !C1DONE) C1DONE = true;
  PREVW = UI.working;
  const wt = !PAGE && c.wt;
  uiFrame.classList.toggle('is-wspage', !!PAGE);
  uiFrame.classList.toggle('wt-ro', !!(wt && RO[ds(c)]));
  uiFrame.dataset.wtv = CUR;
  if (PAGE) {
    uiRail.querySelectorAll('.conv-row[aria-current]').forEach(a => a.removeAttribute('aria-current'));
    uiTop.innerHTML = `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button><div class="tb-title"><strong class="mono">${AUR.id}</strong></div>`;
  } else if (wt) {
    const s = ds(c); const [l, m] = DS[s];
    const chip = uiTop.querySelector('.chip'); const html = `<span class="chip ${s}" role="status">${m}<span class="chip-label">${l}</span></span>`;
    if (chip) chip.outerHTML = html; else uiTop.querySelector('.tb-right')?.insertAdjacentHTML('afterbegin', html);
    if (CUR === 'v1' && c.wt.slug) uiTop.querySelector('.tb-ws')?.insertAdjacentHTML('afterend', pill(c));
    if (c.wt.run === 'draft') { const ta = document.querySelector('.composer textarea'); if (ta) ta.placeholder = 'Mitä agentti tekee omassa worktreessään?'; }
  }
  // V1 layer
  paintLayer();
  // V2 bar, above the background strip so the strip keeps its place by the field.
  const anchor = uiCol.querySelector('.bg-strip') || uiCol.querySelector('.composer');
  if (bar.nextSibling !== anchor) uiCol.insertBefore(bar, anchor);
  const showBar = CUR === 'v2' && wt; bar.hidden = !showBar;
  const bh = showBar ? barHtml(c) : '';
  if (bar.dataset.html !== bh) { bar.innerHTML = bh; bar.dataset.html = bh; }
  bar.className = `wt-bar ${showBar ? ds(c) : ''}`;
  // Dock (V1, V3)
  const comp = uiCol.querySelector('.composer');
  if (dock.nextSibling !== comp) uiCol.insertBefore(dock, comp);
  const dk = wt && CUR !== 'v2' && RO[ds(c)];
  dock.hidden = !dk; dock.innerHTML = dk ? `${EVI[ds(c)] || '<span class="st-dot working"></span>'}<span>${RO[ds(c)]}</span>` : '';
  // V3 side panel
  if (!side.isConnected) { uiBody.append(side); uiMain.append(sideScrim); }
  const showSide = CUR === 'v3' && wt && c.wt.slug !== undefined;
  side.hidden = !(showSide && sideOpen());
  sideScrim.hidden = !(showSide && isPhone() && SIDE.phone);
  side.classList.toggle('sheet', isPhone());
  if (!side.hidden) { const sh = sideHtml(c); if (side.dataset.html !== sh) { side.innerHTML = sh; side.dataset.html = sh; } }
});
sideScrim.addEventListener('click', () => { SIDE.phone = false; paint(); });
new ResizeObserver(() => paint()).observe(uiFrame);
// Clocks: update only the text, never repaint a live row for the clock.
setInterval(() => {
  const t0 = performance.now();
  document.querySelectorAll('.wt-clock[data-t0]').forEach(el => { if (el.dataset.t0) el.textContent = elapsed(t0 - +el.dataset.t0); });
  const live = stage.querySelector('.turn.live .clock');
  document.querySelectorAll('.wt-clock[data-t0=""]').forEach(el => { el.textContent = live?.textContent ?? ''; });
}, 1000);

// ---------- Lifecycle ----------
const later = (ms, f) => setTimeout(f, ms);
const nowT = () => new Date().toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
function changed() { paint(); rerender(); }
function event(c, k, html) {
  const e = { k, t: nowT(), html };
  if (c.id !== 'c1') { c.msgs.push({ ev: e }); return; }
  c.wt.ev.push(e);
  if (UI.sel === c.id && !PAGE) { stage.querySelector('.vwrap')?.insertAdjacentHTML('beforeend', evRow(e)); following = true; stage.scrollTop = stage.scrollHeight; }
}
function work(c, doing, ms, then) {
  c.st = 'working'; c.wt.run = 'open'; c.wt.doing = doing; c.wt.t0 = performance.now(); changed();
  later(ms, () => { then(); c.st = c.st === 'working' ? 'waiting' : c.st; changed(); });
}
function say(c, text) { c.msgs.push({ user: text, t: nowT().replace('.', ':') }); }
function answer(c, text) { c.msgs.push({ reply: text, t: nowT().replace('.', ':') }); }
const slugify = (s) => s.toLowerCase().replace(/[äå]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 3).join('-') || 'tyo';
function create(c, text) {
  const t = text.replace(/[`*]/g, '').split(/[.\n?!]/)[0].split(' ').slice(0, 5).join(' ');
  Object.assign(c.wt, { run: 'creating', step: 0, slug: slugify(t).slice(0, 24).replace(/-$/, ''), rid: `01m55d${MADE}k7q2w9x4c8v6b1n5tz`.slice(0, 26), started: nowT() });
  c.task = text; c.title = t.charAt(0).toUpperCase() + t.slice(1);
  changed();
  later(900, () => { c.wt.step = 1; changed();
    later(900, () => { c.wt.run = 'open'; work(c, 'Lukee koodia', 3800, () => {
      answer(c, 'Tein muutoksen ja ajoin testit; ne menevät läpi. Commitoin sen haaraan, joten haara on 1 commit main-haaraa edellä.');
      Object.assign(c.wt, { ahead: 1, behind: 0, files: [], commits: [{ h: '4e9b1c7', s: c.title }] });
    }); });
  });
}
function message(c, text) {
  const s = ds(c);
  if (s === 'new') return create(c, text);
  if (s === 'creating' || s === 'working') { say(c, text); changed(); return toast('Ohjaus toimitettiin Pi:lle työn välivaiheessa.'); }
  say(c, text);
  if (s === 'stopped' || s === 'failed') event(c, 'resumed', 'Pi käynnistyi samaan worktreehen ja jatkaa samaa keskustelua.');
  work(c, 'Jatkaa samaa keskustelua', 2600, () => {
    if (c.id === 'w4') { answer(c, 'Lisäsin testit päätteettömälle tulosteelle ja commitoin muutokset. Haara on 2 committia main-haaraa edellä, eikä worktreessä ole tallentamatonta.'); Object.assign(c.wt, { ahead: 2, files: [], commits: [{ h: '7a1f3d2', s: 'log: testit päätteettömälle tulosteelle' }, ...c.wt.commits] }); }
    else { answer(c, 'Selvä, tehty ja commitoitu.'); Object.assign(c.wt, { ahead: c.wt.ahead + 1, files: [], commits: [{ h: '3c8e0b5', s: 'Muutos pyynnöstä' }, ...c.wt.commits] }); }
  });
}
function doMerge(c) {
  if (c.id === 'c1' && UI.working) stopNow();
  const f = F(c);
  if (c.id === 'c1') Object.assign(c.wt, { ahead: f.ahead, behind: f.behind, files: f.files, commits: f.commits });
  c.wt.run = 'merging'; c.wt.t0 = performance.now(); LAYER = false; EXPAND = false; changed();
  later(1600, () => {
    c.wt.run = 'merged'; c.st = 'merged';
    c.wt.out = { commit: c.id === 'c1' ? 'c81d2fa' : '5be27d0', commits: f.ahead, add: c.id === 'c1' ? 58 : 19, del: c.id === 'c1' ? 3 : 6, at: nowT() };
    event(c, 'merged', merged(c).html); changed(); toast(`Yhdistetty main-haaraan: ${c.title}`);
  });
}
function act(c, a) {
  // A control closes the layer, the bar's panel and the phone sheet it was pressed in.
  LAYER = false; EXPAND = false; SIDE.phone = false; paint();
  if (a === 'merge') {
    const why = mergeBlock(c); if (why) return toast(why);
    const f = F(c); const busy = ds(c) === 'working';
    return confirmDlg({ title: 'Yhdistetäänkö main-haaraan?', body: `<p>${plural(f.ahead, 'commit', 'committia')} haarasta <span class="mono">${branch(c)}</span> yhdistetään työtilan <span class="mono">${AUR.id}</span> haaraan <span class="mono">${SRC.branch}</span>${f.behind ? `; main on ${f.behind} committia edellä, joten Taskfleet tuo ne ensin haaraan` : ''}.</p>${busy ? '<p class="wt-warn">Agentti työskentelee. Se pysäytetään ennen yhdistämistä.</p>' : ''}<p>Sen jälkeen worktree ja haara poistetaan, ja keskustelu jää luettavaksi. Työtilan omat ${SRC.dirty} tallentamatonta muutosta jäävät ennalleen.</p>`, ok: 'Yhdistä', icon: IC.merge }, () => doMerge(c));
  }
  if (a === 'cancel') return confirmDlg({ title: 'Lopetetaanko worktree-agentti?', body: `<p>Pi pysäytetään ja Taskfleet-ajo päättyy. Haara <span class="mono">${branch(c)}</span> (${plural(F(c).ahead, 'commit', 'committia')}) ja worktree jäävät talteen; työn voi myöhemmin hylätä tai ottaa käsin talteen.</p><p>Keskustelua ei voi lopetuksen jälkeen jatkaa.</p><label class="fld"><span>Syy <small>valinnainen, jää Taskfleetin kuittiin</small></span><input name="note" autocomplete="off"></label>`, ok: 'Lopeta', icon: IC.keep }, (fd) => {
    if (c.id === 'c1' && UI.working) stopNow();
    const f = F(c); if (c.id === 'c1') Object.assign(c.wt, { ahead: f.ahead, behind: f.behind, files: f.files, commits: f.commits });
    c.wt.run = 'cancelled'; c.st = 'cancelled'; LAYER = false; EXPAND = false;
    const note = String(fd.get('note') || '').trim();
    event(c, 'cancelled', `Lopetettu${note ? `: ”${esc(note)}”` : ''}. Haara ja worktree jäivät talteen.`); changed();
  });
  if (a === 'discard') {
    if (!['cancelled', 'failed'].includes(ds(c))) return toast(DISCARD_WHY);
    const f = F(c);
    return confirmDlg({ title: 'Hylätäänkö työ?', danger: true, body: `<p>Poistaa worktreen <span class="mono">${wtPath(c)}</span> ja haaran <span class="mono">${branch(c)}</span>. ${plural(f.ahead, 'commit', 'committia')}, joita main-haarassa ei ole, katoaa${f.files.length ? `, samoin ${plural(f.files.length, 'tallentamaton muutos', 'tallentamatonta muutosta')}` : ''}. Tätä ei voi perua.</p><label class="fld"><span>Syy</span><input name="reason" required autocomplete="off" placeholder="Miksi työ hylätään?"></label>`, ok: 'Hylkää työ', icon: IC.trash }, (fd) => {
      c.wt.run = 'discarded'; c.st = 'discarded'; LAYER = false; EXPAND = false;
      event(c, 'discarded', `Hylätty: ”${esc(String(fd.get('reason')).trim())}”. Worktree ja haara poistettiin; Taskfleetin kuitti säilyy.`); changed();
    });
  }
  if (a === 'resolve') { say(c, 'Ratkaise konflikti main-haaran kanssa ja kerro, kun voin yhdistää.'); c.wt.run = 'open'; event(c, 'resumed', 'Pi käynnistyi samaan worktreehen ja jatkaa samaa keskustelua.');
    return work(c, 'Tuo main-haaran muutokset haaraan', 2600, () => { answer(c, 'Toin main-haaran muutokset haaraan. Tiedostossa `pyproject.toml` molemmat muuttivat Pythonin versiorajaa; pidin main-haaran rajan 3.13 ja omat riippuvuuspäivitykseni. Testit menevät läpi (`pytest`: 41 ok). Voit yhdistää.'); Object.assign(c.wt, { behind: 0, commits: [{ h: 'd07c2e4', s: 'Yhdistä main: pyproject.toml' }, ...c.wt.commits], ahead: 3 }); }); }
  if (a === 'commit') { say(c, 'Commitoi muutokset.'); return work(c, 'Commitoi', 1800, () => { answer(c, 'Commitoitu.'); Object.assign(c.wt, { ahead: c.wt.ahead + 1, files: [], commits: [{ h: '9b2d4f0', s: 'Keskeneräiset muutokset' }, ...c.wt.commits] }); }); }
}
// One confirmation dialog for merge, cancel and discard.
const dlg = document.createElement('dialog'); dlg.className = 'confirm wt-dlg'; document.body.appendChild(dlg);
let onOk = null;
function confirmDlg({ title, body, ok, icon, danger }, then) {
  LAYER = false; paint(); onOk = then;
  dlg.innerHTML = `<form method="dialog"><h3>${title}</h3>${body}<div class="confirm-actions"><button class="secondary" value="cancel" formnovalidate>Peruuta</button><button class="primary${danger ? ' danger' : ''}" value="ok">${icon}${ok}</button></div></form>`;
  dlg.showModal(); (dlg.querySelector('input[required]') || dlg.querySelector('.primary')).focus();
}
dlg.addEventListener('close', () => { if (dlg.returnValue === 'ok' && onOk) onOk(new FormData(dlg.querySelector('form'))); onOk = null; });

function newWt() {
  const id = `nw${++MADE}`;
  AUR.convs.unshift({ id, title: 'Uusi worktree-agentti', st: 'new', task: '', msgs: [], wt: { run: 'draft', ev: [], ahead: 0, behind: 0, files: [], commits: [] } });
  AUR.open = true; PAGE = null; openConv(id);
}

// ---------- Clicks and the composer ----------
window.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.closest('.proto-picker')) return;
  const stop = () => { e.preventDefault(); e.stopPropagation(); };
  const wsName = t.closest('.ws-name[data-ui="ws"], .tb-ws[data-ui="ws"]');
  if (wsName) { const id = wsName.closest('.ws')?.querySelector('[data-ws-tog]')?.dataset.wsTog ?? selConv().ws.id; stop(); return id === AUR.id ? showPage() : toast('Tässä vedoksessa vain aurinkokellolla on työtilasivu.'); }
  if (t.closest('[data-conv], [data-ws-add]')) { PAGE = null; LAYER = false; EXPAND = false; SIDE.phone = false; return; }
  const cp = t.closest('.wt-layer [data-copy], .wt-side [data-copy], .wt-bar [data-copy]');
  if (cp) { stop(); try { await navigator.clipboard.writeText(cp.dataset.copy); } catch {} cp.setAttribute('data-done', ''); setTimeout(() => cp.removeAttribute('data-done'), 1200); return toast(`Kopioitu ${cp.dataset.copy}`); }
  const hit = t.closest('[data-wt], [data-wt-page]');
  if (!hit) { if (LAYER && !t.closest('.wt-layer')) { LAYER = false; paint(); } if (EXPAND && !t.closest('.wt-bar')) { EXPAND = false; paint(); } return; }
  stop();
  const c = selConv();
  if (hit.dataset.wtPage) {
    const a = hit.dataset.wtPage;
    if (a === 'fold') { PFOLD = !PFOLD; return rerender(); }
    if (a === 'copy') { try { await navigator.clipboard.writeText(SRC.path); } catch {} return toast(`Kopioitu ${SRC.path}`); }
    if (a === 'delete') return toast(hit.title);
    return toast({ gh: 'Avautuisi uuteen välilehteen: github.com/maintainer/aurinkokello', rename: 'Näyttönimen muutos kuten toteutuksessa.', hide: 'Piilotus kuten toteutuksessa.', git: 'Git-tiedot avautuvat kuten toteutuksessa.' }[a]);
  }
  const a = hit.dataset.wt;
  if (a === 'new') return newWt();
  if (a === 'layer') { LAYER = !LAYER; return paint(); }
  if (a === 'expand') { EXPAND = !EXPAND; return paint(); }
  if (a === 'side') { if (isPhone()) SIDE.phone = !SIDE.phone; else SIDE.desk = !SIDE.desk; return paint(); }
  if (hit.getAttribute('aria-disabled') === 'true') return toast(hit.title);
  if (c.wt) act(c, a);
}, true);
// Sending in a worktree agent other than the library's live one: create, resume or continue.
function sendWt(e) {
  const c = sel(); if (PAGE || !c.wt || c.id === 'c1') return;
  e.preventDefault(); e.stopPropagation();
  const ta = document.querySelector('.composer textarea'); const text = ta.value.trim(); if (!text) return;
  ta.value = ''; C.text = ''; ta.dispatchEvent(new Event('input'));
  message(c, text);
}
window.addEventListener('click', (e) => { if (e.target.closest('.composer [data-c="send"]')) sendWt(e); }, true);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (LAYER) { e.stopPropagation(); LAYER = false; return paint(); } if (EXPAND) { e.stopPropagation(); EXPAND = false; return paint(); } if (SIDE.phone && isPhone()) { e.stopPropagation(); SIDE.phone = false; return paint(); } return; }
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.target.closest?.('.composer textarea')) sendWt(e);
}, true);

const show = (v) => () => {
  CUR = v; reset(); PAGE = null; LAYER = false; EXPAND = false; SIDE = { desk: true, phone: false };
  UI.sel = 'c1'; UI.pop = false; AUR.open = true; paint();
  return content();
};
window.v1 = show('v1'); window.v2 = show('v2'); window.v3 = show('v3');
})();
