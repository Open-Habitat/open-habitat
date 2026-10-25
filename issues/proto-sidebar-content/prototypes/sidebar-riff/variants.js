// Synthetic sidebar riff, round 2. All names, paths and texts are invented.
// Every value stands for a host fact named in NOTES.md; nothing is fetched.
// host/owner: git_remote with github_repo or gitea_origin.full_name; hidden: visibility.
const WS = [
  { id: 'kirjasto-api', branch: 'main', dirty: 2, host: 'github', owner: 'maintainer' },
  { id: 'kotisivu', branch: 'main', dirty: 0, host: 'github', owner: 'maintainer' },
  { id: 'budjetti-2027', branch: 'main', dirty: 0, host: 'gitea', owner: 'jari' },
  { id: 'mokki-varaukset', branch: 'kalenteri', dirty: 1, host: 'gitea', owner: 'perhe' },
  { id: 'reseptit', branch: 'main', dirty: 0, host: 'github', owner: 'tailspin' },
  { id: 'opinnaytetyo', branch: null, dirty: 0, host: 'none' },
  { id: 'valokuvat-skriptit', branch: 'main', dirty: 0, host: 'gitea', owner: 'jari' },
  { id: 'arduino-saaasema', branch: 'main', dirty: 0, host: 'github', owner: 'maintainer' },
  { id: 'asiakasportaali', branch: 'laskutus', dirty: 4, host: 'github', owner: 'tailspin' },
  { id: 'dotfiles', branch: 'main', dirty: 0, host: 'github', owner: 'maintainer' },
  { id: 'kuoro-nuotit', branch: 'main', dirty: 0, host: 'none' },
  { id: 'laskutus-cli', branch: 'main', dirty: 0, host: 'github', owner: 'tailspin' },
  { id: 'matkapaivakirja', branch: 'main', dirty: 3, host: 'none' },
  { id: 'sauna-anturit', branch: 'main', dirty: 0, host: 'gitea', owner: 'jari' },
  { id: 'vanha-blogi', branch: 'main', dirty: 0, host: 'github', owner: 'maintainer', hidden: true },
  { id: 'kesatyo-2024', branch: 'main', dirty: 0, host: 'none', hidden: true },
];
// state: working | bg (Odottaa taustatyötä: process or Taskfleet worker) | question | idle | done
// ago: minutes since the conversation's started_at.
const AGENTS = [
  { id: 'a1', ws: 'kirjasto-api', title: 'Lainojen eräpäivämuistutus', state: 'bg', ago: 18, waits: 'worker: Muistutusten sähköpostipohja' },
  { id: 'a2', ws: 'kirjasto-api', title: 'Muistutusten sähköpostipohja', state: 'working', ago: 6, parent: 'a1', worktree: 'wt/muistutus-pohja', ahead: 3 },
  { id: 'a3', ws: 'kirjasto-api', title: 'Hakuindeksin korjaus', state: 'done', ago: 40, parent: 'a1', worktree: 'wt/hakuindeksi', merged: true },
  { id: 'a4', ws: 'kotisivu', title: 'Etusivun kuvagalleria', state: 'question', ago: 4, question: 'Käytetäänkö galleriassa WebP- vai AVIF-kuvia? AVIF on pienempi, mutta vanha iPad ei näytä sitä.' },
  { id: 'a5', ws: 'kotisivu', title: 'Saavutettavuustestit', state: 'bg', ago: 3, waits: 'npm test' },
  { id: 'a6', ws: 'budjetti-2027', title: 'Lokakuun kuukausiraportti', state: 'done', ago: 55, unread: true, reply: 'Raportti on valmis: menot jäivät 4 % alle budjetin. Taulukko on tiedostossa raportit/lokakuu.md.' },
  { id: 'a7', ws: 'mokki-varaukset', title: 'Kalenterin synkronointi', state: 'idle', ago: 130 },
  { id: 'a8', ws: 'mokki-varaukset', title: 'Hinnaston päivitys', state: 'done', ago: 2900 },
  { id: 'a9', ws: 'reseptit', title: 'Ainesosien yksiköt', state: 'done', ago: 3100 },
  { id: 'a10', ws: 'reseptit', title: 'Ostoslistan vienti', state: 'done', ago: 2950 },
  { id: 'a11', ws: 'budjetti-2027', title: 'Kategorioiden siivous', state: 'done', ago: 9000 },
  { id: 'a12', ws: 'valokuvat-skriptit', title: 'EXIF-päivämäärien korjaus', state: 'done', ago: 7300 },
  { id: 'a13', ws: 'asiakasportaali', title: 'Laskutusnäkymän taulukko', state: 'working', ago: 12 },
  { id: 'a14', ws: 'dotfiles', title: 'Tmux-teeman päivitys', state: 'done', ago: 1500 },
  { id: 'a15', ws: 'laskutus-cli', title: 'ALV-kannan muutos', state: 'done', ago: 10500 },
  { id: 'a16', ws: 'kuoro-nuotit', title: 'PDF-nuottien nimeäminen', state: 'done', ago: 20000 },
  { id: 'a17', ws: 'arduino-saaasema', title: 'Anturin kalibrointi', state: 'done', ago: 31000 },
  { id: 'a18', ws: 'sauna-anturit', title: 'Lämpötilahälytys', state: 'done', ago: 40000 },
  { id: 'a19', ws: 'vanha-blogi', title: 'Hugo-version päivitys', state: 'done', ago: 140000 },
  { id: 'a20', ws: 'asiakasportaali', title: 'Kirjautumisen virheilmoitukset', state: 'done', ago: 4400 },
  { id: 'a21', ws: 'kotisivu', title: 'Yhteydenottolomake', state: 'done', ago: 6000 },
];

const INITIAL = () => ({ selected: null, collapsed: false, drawer: false, filter: '', allOpen: false, archivedOpen: false, closedGroups: new Set(), seen: new Set(), wsFilter: '', wsState: 'all' });
const S = INITIAL();
const narrow = () => S.collapsed && !matchMedia('(max-width: 800px)').matches;
const agent = (id) => AGENTS.find((a) => a.id === id);
const ws = (id) => WS.find((w) => w.id === id);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const unread = (a) => a.unread && !S.seen.has(a.id);
const needsYou = (a) => a.state === 'question' || unread(a);
const live = (a) => ['working', 'bg', 'idle', 'question'].includes(a.state);
const wsAgents = (w) => AGENTS.filter((a) => a.ws === w);
const visible = () => WS.filter((w) => !w.hidden);
const archived = () => WS.filter((w) => w.hidden);
const alpha = (list) => [...list].sort((a, b) => a.id.localeCompare(b.id, 'fi'));
const lastAgo = (w) => Math.min(...wsAgents(w).map((a) => a.ago), Infinity);
const byRecent = (list) => [...list].sort((a, b) => lastAgo(a.id) - lastAgo(b.id));
function ago(m) {
  if (m === Infinity) return '';
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.round(m / 60)} h`;
  if (m < 2880) return 'eilen';
  if (m < 10080) return `${Math.round(m / 1440)} pv`;
  return `${Math.round(m / 10080)} vk`;
}
const STATE_LABEL = { working: 'Työskentelee', question: 'Kysyy sinulta', bg: 'Odottaa taustatyötä', idle: 'Odottaa viestiä', done: 'Valmis' };
const label = (a) => unread(a) ? 'Uusi vastaus' : STATE_LABEL[a.state];
function markKind(a) {
  if (unread(a)) return 'new';
  if (a.state === 'question') return 'ask';
  if (a.state === 'done') return a.merged ? 'merged' : 'done';
  return { working: 'working', bg: 'bg', idle: 'wait' }[a.state];
}
function mark(a) {
  const kind = markKind(a);
  const glyph = { new: '●', ask: '?', done: '✓', merged: '⑂', working: '', bg: '', wait: '○' }[kind];
  return `<span class="mk mk-${kind}" aria-hidden="true">${glyph}</span>`;
}
// The strongest state in a workspace, as one hint for a workspace row.
function wsHint(w) {
  const items = wsAgents(w);
  const att = items.filter(needsYou).length, run = items.filter((a) => live(a) && !needsYou(a));
  if (att) return { kind: 'att', n: att, text: `${att} odottaa sinua` };
  if (run.some((a) => a.state === 'working')) return { kind: 'working', n: run.length, text: `${run.length} käynnissä` };
  if (run.some((a) => a.state === 'bg')) return { kind: 'bg', n: run.length, text: `${run.length} odottaa taustatyötä` };
  if (run.length) return { kind: 'wait', n: run.length, text: `${run.length} odottaa viestiä` };
  return null;
}
function hintMark(h) {
  if (!h) return '';
  if (h.kind === 'att') return `<span class="pill pill-att" title="${h.text}">${h.n}</span>`;
  return `<span class="mk mk-${h.kind}" title="${h.text}" aria-hidden="true">${h.kind === 'wait' ? '○' : ''}</span>`;
}
const initials = (w) => (w.includes('-') ? w.split('-').map((p) => p[0]).join('') : w).slice(0, 2).toUpperCase();
const hostName = (w) => w.host === 'github' ? 'GitHub' : w.host === 'gitea' ? 'Gitea' : null;
const repoLine = (w) => [w.host === 'none' ? (w.branch ? 'paikallinen Git' : 'ei Git-repoa') : `${hostName(w)} · ${w.owner}/${w.id}`, w.branch, w.dirty ? `${w.dirty} muutosta` : null].filter(Boolean).join(' · ');

function agentRow(a, { showWs = true, depth = 0, extra = '', time = false } = {}) {
  const cur = S.selected === a.id ? ' aria-current="page"' : '';
  const sub = [showWs ? a.ws : null, label(a), a.state === 'bg' ? a.waits : null, time ? ago(a.ago) : null].filter(Boolean).join(' · ');
  return `<a href="#${a.id}" class="row agent" data-open="${a.id}"${cur} style="--d:${depth}">
    ${mark(a)}<span class="row-main"><span class="row-title">${esc(a.title)}</span><span class="row-sub">${esc(sub)}</span>${extra}</span></a>`;
}
function wsRow(w, { tail = '', sub = '' } = {}) {
  const cur = S.selected === 'ws:' + w.id ? ' aria-current="page"' : '';
  const h = wsHint(w.id);
  return `<a href="#ws-${w.id}" class="row ws${sub ? ' two' : ''}" data-open="ws:${w.id}" data-ws="${w.id}"${cur}${h ? ` aria-description="${h.text}"` : ''}><span class="ws-icon" aria-hidden="true">▢</span>${sub ? `<span class="row-main"><span class="row-title">${w.id}</span><span class="row-sub">${esc(sub)}</span></span>` : `<span class="row-title">${w.id}</span>`}${tail}${hintMark(h)}</a>`;
}
function filterField(placeholder = 'Suodata työtiloja', attr = 'data-filter') {
  return `<label class="filter"><span class="vh">${placeholder}</span><input type="search" ${attr} placeholder="${placeholder}" value="${esc(attr === 'data-filter' ? S.filter : S.wsFilter)}"></label>`;
}
const q = () => S.filter.trim().toLowerCase();
const matches = (list) => list.filter((w) => w.id.includes(q()));
function railHead() {
  return `<header class="rail-head"><a href="#home" data-open="home" class="server"${S.selected === null ? ' aria-current="page"' : ''}>
    <span class="home-glyph" aria-hidden="true">⌂</span><span class="label">Kotipalvelin</span></a>
    <button class="icon-btn collapse-btn" data-collapse aria-label="${narrow() ? 'Levennä sivupalkki' : 'Kavenna sivupalkki'}">${narrow() ? '»' : '«'}</button></header>`;
}
const railFoot = () => `<footer class="rail-foot"><a href="#settings" class="row" data-open="settings"><span class="ws-icon" aria-hidden="true">⚙</span><span class="row-title">Asetukset</span></a></footer>`;
function compactAgent(a) {
  return `<a href="#${a.id}" class="dot-btn" data-open="${a.id}" title="${esc(a.title)} · ${esc(label(a))}"${S.selected === a.id ? ' aria-current="page"' : ''}>
    <span class="dot-letters">${initials(a.ws)}</span>${mark(a)}<span class="vh">${esc(a.title)}: ${esc(label(a))}</span></a>`;
}
function compactWs(w) {
  const h = wsHint(w.id);
  return `<a href="#ws-${w.id}" class="dot-btn ws-dot" data-open="ws:${w.id}" title="${w.id}"${S.selected === 'ws:' + w.id ? ' aria-current="page"' : ''}><span class="dot-letters">${initials(w.id)}</span>${h?.kind === 'att' ? `<span class="badge">${h.n}</span>` : h ? hintMark(h) : ''}<span class="vh">${w.id}${h ? ', ' + h.text : ''}</span></a>`;
}
const compactIcon = (glyph, text, act) => `<button class="dot-btn" ${act} title="${text}" aria-label="${text}"><span class="dot-letters">${glyph}</span></button>`;

// ---------- Shared top: Sinun vuorosi and Käynnissä (round 1 verdict) ----------
const you = () => AGENTS.filter(needsYou);
const running = () => AGENTS.filter((a) => live(a) && !needsYou(a));
function nowSections() {
  const roots = running().filter((a) => !a.parent || !running().some((p) => p.id === a.parent));
  const tree = (a) => agentRow(a) + running().filter((c) => c.parent === a.id).map((c) => agentRow(c, { showWs: false, depth: 1, extra: `<span class="row-sub">⑂ ${c.worktree}</span>` })).join('');
  return `<section class="sec" data-sec="you"><h2 class="sec-h">Sinun vuorosi <span class="pill pill-att">${you().length}</span></h2><div class="list">${you().map((a) => agentRow(a)).join('') || '<p class="empty">Mikään ei odota sinua.</p>'}</div></section>
    <section class="sec" data-sec="running"><h2 class="sec-h">Käynnissä <span class="muted">${running().length}</span></h2><div class="list">${roots.map(tree).join('')}</div></section>`;
}
function nowDots() {
  return `${you().map(compactAgent).join('')}<hr>${running().filter((a) => !a.parent).map(compactAgent).join('')}<hr>`;
}
function archivedBlock(list = archived()) {
  if (!list.length) return '';
  const open = S.archivedOpen || !!q();
  return `<div class="archived"><button class="sec-toggle sub" data-archived aria-expanded="${open}"><span class="chev-l" aria-hidden="true">${open ? '▾' : '▸'}</span>Arkistoidut <span class="muted">${list.length}</span></button>
    ${open ? `<div class="list">${list.map((w) => wsRow(w)).join('')}</div>` : ''}</div>`;
}
function shellRail(workspaces, dots) {
  if (narrow()) return `${railHead()}<div class="dots">${nowDots()}${dots}</div>`;
  return `${railHead()}<div class="rail-scroll">${nowSections()}<section class="sec" data-sec="workspaces">${workspaces}</section></div>${railFoot()}`;
}

// ---------- 1 · Aakkoset ----------
const V1 = {
  name: 'Aakkoset',
  rail() {
    const list = matches(alpha(visible()));
    const hiddenHits = q() ? matches(archived()) : archived();
    return shellRail(`<h2 class="sec-h">Työtilat <span class="muted">${visible().length}</span></h2>${filterField()}
      <div class="list tight">${list.map((w) => wsRow(w)).join('') || '<p class="empty">Ei osumia.</p>'}</div>${archivedBlock(hiddenHits)}`,
      compactIcon('▢', 'Kaikki työtilat', 'data-expand'));
  },
  page: pageByState,
};
// Workspace page 1: the rail's own vocabulary, Sinun vuorosi / Käynnissä / Aiemmat.
function pageByState(w) {
  const items = wsAgents(w.id), mine = items.filter(needsYou), on = items.filter((a) => live(a) && !needsYou(a)), rest = items.filter((a) => !live(a) && !needsYou(a));
  const block = (t, list) => list.length ? `<h2>${t}</h2><div class="list wide">${list.map((a) => agentRow(a, { showWs: false, depth: a.parent ? 1 : 0, time: true })).join('')}</div>` : '';
  return block('Sinun vuorosi', mine) + block('Käynnissä', on) + block('Aiemmat', rest);
}

// ---------- 2 · Viimeisimmät ----------
const RECENT = 5;
const V2 = {
  name: 'Viimeisimmät',
  rail() {
    const recent = byRecent(visible()).slice(0, RECENT);
    const all = `<button class="sec-toggle" data-all aria-expanded="${S.allOpen}">Kaikki työtilat <span class="muted">${visible().length}</span><span class="chev" aria-hidden="true">${S.allOpen ? '▾' : '▸'}</span></button>
      ${S.allOpen ? `${filterField()}<div class="list tight">${matches(alpha(visible())).map((w) => wsRow(w)).join('') || '<p class="empty">Ei osumia.</p>'}</div>${archivedBlock(q() ? matches(archived()) : archived())}` : ''}`;
    return shellRail(`<h2 class="sec-h">Viimeksi käytetyt</h2><div class="list">${recent.map((w) => wsRow(w, { tail: `<span class="when">${ago(lastAgo(w.id))}</span>` })).join('')}</div>${all}`,
      `${recent.map(compactWs).join('')}${compactIcon('⋯', 'Kaikki työtilat', 'data-expand-all')}`);
  },
  // Workspace page 2: newest first, one list, time on every row.
  page(w) {
    const items = [...wsAgents(w.id)].sort((a, b) => a.ago - b.ago);
    return `<h2>Keskustelut, uusin ensin</h2><div class="list wide">${items.map((a) => agentRow(a, { showWs: false, time: true })).join('')}</div>`;
  },
};

// ---------- 3 · Ryhmät ----------
function groupsOf(list) {
  const key = (w) => w.host === 'none' ? 'local' : `${w.host}:${w.owner}`;
  const order = [...new Set(alpha(list).sort((a, b) => (a.host === 'none') - (b.host === 'none') || a.host.localeCompare(b.host) || (a.owner || '').localeCompare(b.owner || '')).map(key))];
  return order.map((k) => {
    const members = alpha(list.filter((w) => key(w) === k));
    const [host, owner] = k.split(':');
    return { key: k, title: k === 'local' ? 'Paikalliset' : owner, sub: k === 'local' ? 'ei etärepoa' : host === 'github' ? 'GitHub' : 'Gitea', members };
  });
}
// Two owners may share a prefix (jari, maintainer); fall back to first and last letter.
const groupLetters = (g, all) => (all.some((o) => o !== g && o.title.slice(0, 2) === g.title.slice(0, 2)) ? g.title[0] + g.title.at(-1) : g.title.slice(0, 2)).toUpperCase();
const V3 = {
  name: 'Ryhmät',
  rail() {
    const groups = groupsOf(matches(visible()));
    const body = groups.map((g) => {
      const open = q() || !S.closedGroups.has(g.key);
      const att = g.members.reduce((n, w) => n + (wsHint(w.id)?.kind === 'att' ? wsHint(w.id).n : 0), 0);
      const run = g.members.filter((w) => wsHint(w.id) && wsHint(w.id).kind !== 'att').length;
      return `<div class="group"><button class="sec-toggle sub" data-group="${g.key}" aria-expanded="${!!open}"><span class="chev-l" aria-hidden="true">${open ? '▾' : '▸'}</span>${g.title}<span class="muted small">${g.sub}</span><span class="grp-tail">${!open && att ? `<span class="pill pill-att">${att}</span>` : ''}${!open && run ? '<span class="mk mk-working" aria-hidden="true"></span>' : ''}<span class="muted">${g.members.length}</span></span></button>
        ${open ? `<div class="list tight indent">${g.members.map((w) => wsRow(w)).join('')}</div>` : ''}</div>`;
    }).join('') || '<p class="empty">Ei osumia.</p>';
    return shellRail(`<h2 class="sec-h">Työtilat <span class="muted">${visible().length}</span></h2>${filterField()}${body}${archivedBlock(q() ? matches(archived()) : archived())}`,
      groupsOf(visible()).map((g, i, all) => compactIcon(g.key === 'local' ? '⌂' : groupLetters(g, all), `${g.title} (${g.sub})`, `data-expand-group="${g.key}"`)).join(''));
  },
  // Workspace page 3: grouped by worktree, so a worker sits in its own place under the main checkout.
  page(w) {
    const items = wsAgents(w.id), main = items.filter((a) => !a.worktree), trees = [...new Set(items.filter((a) => a.worktree).map((a) => a.worktree))];
    const place = (name, meta, list) => `<section class="place"><header><span class="ws-icon" aria-hidden="true">${name === w.branch || !w.branch ? '⎇' : '⑂'}</span><strong>${name}</strong><span class="muted">${meta}</span></header><div class="list">${list.map((a) => agentRow(a, { showWs: false, time: true })).join('') || '<p class="empty">Ei keskusteluja.</p>'}</div></section>`;
    return `<h2>Paikat ja niiden keskustelut</h2>${place(w.branch ?? 'kansio', w.branch ? `päätyöpuu${w.dirty ? ` · ${w.dirty} muutosta` : ''}` : 'ei Git-repoa', main)}
      ${trees.map((t) => { const a = items.find((x) => x.worktree === t); return place(t, a.merged ? 'yhdistetty' : `+${a.ahead} · worker`, items.filter((x) => x.worktree === t)); }).join('')}`;
  },
};

// ---------- 4 · Haku ensin ----------
const V4 = {
  name: 'Haku ensin',
  rail() {
    const term = q();
    let body;
    if (term) {
      const hitsWs = WS.filter((w) => w.id.includes(term));
      const hitsA = AGENTS.filter((a) => a.title.toLowerCase().includes(term));
      body = `<h2 class="sec-h">Työtilat</h2><div class="list tight">${hitsWs.map((w) => wsRow(w, { tail: w.hidden ? '<span class="pill">arkistoitu</span>' : '' })).join('') || '<p class="empty">Ei osumia.</p>'}</div>
        ${hitsA.length ? `<h2 class="sec-h">Keskustelut</h2><div class="list">${hitsA.map((a) => agentRow(a, { time: true })).join('')}</div>` : ''}`;
    } else {
      const recent = byRecent(visible()).slice(0, 3);
      body = `<h2 class="sec-h">Viimeksi</h2><div class="list tight">${recent.map((w) => wsRow(w)).join('')}</div>
        <a class="row more" href="#home" data-open="home"><span class="ws-icon" aria-hidden="true">▦</span><span class="row-title">Kaikki työtilat</span><span class="muted">${visible().length} →</span></a>`;
    }
    return shellRail(`<div class="search-box">${filterField('Siirry työtilaan tai keskusteluun')}<kbd title="Pikanäppäin">/</kbd></div>${body}`,
      compactIcon('⌕', 'Hae työtila', 'data-expand-search'));
  },
  // Workspace page 4: one compact list with its own filter and state chips.
  page(w) {
    const t = S.wsFilter.trim().toLowerCase();
    const items = wsAgents(w.id).filter((a) => a.title.toLowerCase().includes(t))
      .filter((a) => S.wsState === 'all' || (S.wsState === 'live' ? live(a) || needsYou(a) : !live(a) && !needsYou(a)));
    const chip = (k, txt) => `<button class="chip-btn" data-ws-state="${k}" aria-pressed="${S.wsState === k}">${txt}</button>`;
    return `<h2>Keskustelut</h2><div class="ws-tools">${filterField('Suodata keskusteluja', 'data-ws-filter')}<div class="chips-row">${chip('all', 'Kaikki')}${chip('live', 'Käynnissä')}${chip('done', 'Valmiit')}</div></div>
      <div class="table">${items.sort((a, b) => a.ago - b.ago).map((a) => `<a class="trow" href="#${a.id}" data-open="${a.id}">${mark(a)}<span class="row-title">${esc(a.title)}</span><span class="muted">${esc(label(a))}</span><span class="muted when">${ago(a.ago)}</span></a>`).join('') || '<p class="empty">Ei osumia.</p>'}</div>`;
  },
};
const VARIANTS = [V1, V2, V3, V4];

// ---------- main area ----------
function card(w) {
  const top = wsAgents(w.id).filter((a) => live(a) || needsYou(a)).slice(0, 2);
  return `<a class="card" href="#ws-${w.id}" data-open="ws:${w.id}"><strong>${w.id}</strong>
    <span class="muted">${esc(repoLine(w))}</span>
    ${top.map((a) => `<span class="card-line">${mark(a)} ${esc(a.title)}</span>`).join('') || `<span class="card-line muted">${lastAgo(w.id) === Infinity ? 'Ei keskusteluja' : 'Viimeksi ' + ago(lastAgo(w.id))}</span>`}</a>`;
}
function home(v) {
  const lead = v === V4
    ? 'Haku ensin -muunnelmassa sivupalkissa ei ole koko listaa, joten etusivu on työtilojen hakemisto: kaikki työtilat kortteina, viimeksi käytetyt ensin.'
    : 'Sivupalkki näyttää sen, mikä odottaa sinua ja mikä on käynnissä. Etusivu on työtilojen yleiskuva ja paikka aloittaa uusi työ.';
  return `<h1>Työtilat</h1><p class="lead">${lead}</p><div class="grid">${byRecent(visible()).map(card).join('')}</div>`;
}
function mainView(v) {
  if (S.selected === null) return `<div class="page">${home(v)}</div>`;
  if (S.selected === 'settings') return `<div class="page"><h1>Asetukset</h1><p class="lead">Ei osa tätä kierrosta.</p></div>`;
  if (S.selected.startsWith('ws:')) {
    const w = ws(S.selected.slice(3)), n = wsAgents(w.id).length;
    return `<div class="page ws-page"><p class="crumb">Työtila</p><h1>${w.id}</h1><p class="repo">${esc(repoLine(w))}</p>
      ${w.hidden ? '<p class="note">Arkistoitu: ei näy sivupalkin listassa. <button class="link" data-new>Palauta</button></p>' : ''}
      <div class="actions"><button class="primary" data-new>Uusi keskustelu</button><button data-new>Tiedostot</button><button data-new>Terminaali</button></div>
      ${n ? v.page(w) : '<h2>Keskustelut</h2><p class="empty">Tässä työtilassa ei ole vielä keskusteluja. Aloita ensimmäinen yllä.</p>'}</div>`;
  }
  const a = agent(S.selected), parent = a.parent ? agent(a.parent) : null;
  const body = a.state === 'question'
    ? `<div class="q"><strong>Agentti kysyy</strong><p>${esc(a.question)}</p><div class="q-actions"><button class="primary">WebP</button><button>AVIF</button><button>Vastaa omin sanoin</button></div></div>`
    : a.reply ? `<div class="bubble">${esc(a.reply)}</div>`
      : `<div class="bubble">${a.state === 'done' ? 'Työ on valmis.' : a.state === 'bg' ? `Odotan taustatyötä: ${esc(a.waits)}.` : 'Työskentelen tämän parissa…'}</div>`;
  return `<div class="convo"><header class="convo-h"><p class="crumb"><a href="#ws-${a.ws}" data-open="ws:${a.ws}">${a.ws}</a>${parent ? ` › <a href="#${parent.id}" data-open="${parent.id}">${esc(parent.title)}</a>` : ''}</p>
    <h1>${esc(a.title)}</h1><p class="state">${mark(a)} ${esc(label(a))}${a.worktree ? ` · ⑂ ${a.worktree}` : ''}</p></header>
    <div class="feed"><div class="bubble you">Synteettinen aiempi viesti: ${esc(a.title.toLowerCase())}.</div>${body}</div>
    <div class="composer"><span>Kirjoita viesti…</span><button class="primary" disabled>Lähetä</button></div></div>`;
}
const MOBILE_TITLE = () => S.selected === null ? 'Etusivu' : S.selected.startsWith('ws:') ? S.selected.slice(3) : S.selected === 'settings' ? 'Asetukset' : agent(S.selected).title;

function shell(v) {
  const badge = you().length;
  return `<div class="app${narrow() ? ' collapsed' : ''}${S.drawer ? ' drawer' : ''}">
    <nav class="rail" aria-label="Sivupalkki · ${v.name}">${v.rail()}${S.drawer ? '<button class="icon-btn drawer-close" data-drawer-close aria-label="Sulje navigaatio">×</button>' : ''}</nav>
    ${S.drawer ? '<button class="scrim" data-drawer-close aria-label="Sulje valikko"></button>' : ''}
    <main class="main"${S.drawer ? ' inert' : ''}><div class="mtool"><button class="icon-btn" data-drawer aria-label="Avaa navigaatio${badge ? `, ${badge} odottaa sinua` : ''}">☰${badge ? `<span class="badge">${badge}</span>` : ''}</button><span class="mtitle">${esc(MOBILE_TITLE())}</span>${S.selected !== null ? '<a class="icon-btn" href="#home" data-open="home" aria-label="Etusivu">⌂</a>' : ''}</div>
    ${mainView(v)}</main></div>`;
}
let currentVariant = 0;
function render() {
  const f = document.activeElement?.matches?.('input[type=search]') ? document.activeElement : null;
  const which = f ? (f.hasAttribute('data-ws-filter') ? '[data-ws-filter]' : '[data-filter]') : null;
  const pos = f ? f.selectionStart : 0;
  stage.innerHTML = shell(VARIANTS[currentVariant]);
  if (which) { const n = stage.querySelector(which); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
}
function focusSearch() { const n = stage.querySelector('.rail [data-filter]'); n?.focus(); }
function installPrototype() {
  stage.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open],[data-collapse],[data-all],[data-archived],[data-group],[data-expand],[data-expand-all],[data-expand-group],[data-expand-search],[data-drawer],[data-drawer-close],[data-new],[data-ws-state]');
    if (!t) return;
    e.preventDefault();
    const d = t.dataset;
    if (d.open) {
      S.selected = d.open === 'home' ? null : d.open;
      if (S.selected && !S.selected.startsWith('ws:') && S.selected !== 'settings') S.seen.add(S.selected);
      if (S.selected?.startsWith('ws:')) { S.wsFilter = ''; S.wsState = 'all'; }
      S.drawer = false;
    }
    if ('collapse' in d) S.collapsed = !S.collapsed;
    if ('all' in d) S.allOpen = !S.allOpen;
    if ('archived' in d) S.archivedOpen = !S.archivedOpen;
    if (d.group) S.closedGroups.has(d.group) ? S.closedGroups.delete(d.group) : S.closedGroups.add(d.group);
    if ('expand' in d) S.collapsed = false;
    if ('expandAll' in d) { S.collapsed = false; S.allOpen = true; }
    if (d.expandGroup) { S.collapsed = false; S.closedGroups = new Set(groupsOf(visible()).map((g) => g.key).filter((k) => k !== d.expandGroup)); }
    if ('expandSearch' in d) S.collapsed = false;
    if (d.wsState) S.wsState = d.wsState;
    if ('drawer' in d) S.drawer = true;
    if ('drawerClose' in d) S.drawer = false;
    if ('new' in d) document.getElementById('lab-feedback').textContent = 'Ei toteutettu tässä kokeessa.';
    render();
    if ('drawer' in d) stage.querySelector('.rail a, .rail button')?.focus();
    if ('expandSearch' in d) focusSearch();
  });
  stage.addEventListener('input', (e) => {
    if (e.target.matches('[data-filter]')) { S.filter = e.target.value; render(); }
    if (e.target.matches('[data-ws-filter]')) { S.wsFilter = e.target.value; render(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && S.drawer) { S.drawer = false; render(); }
    if (e.key === 'Escape' && e.target.matches?.('.rail [data-filter]') && S.filter) { S.filter = ''; render(); focusSearch(); }
    // Search-first: "/" jumps to the search field from anywhere outside a text field.
    if (e.key === '/' && currentVariant === 3 && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) { e.preventDefault(); if (S.collapsed) { S.collapsed = false; render(); } focusSearch(); }
  });
  matchMedia('(max-width: 800px)').addEventListener('change', () => { S.drawer = false; render(); });
  const theme = document.getElementById('theme');
  const setTheme = (t) => { document.documentElement.dataset.theme = t; theme.textContent = t === 'dark' ? 'Vaalea' : 'Tumma'; };
  setTheme(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  theme.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  document.getElementById('reset').addEventListener('click', () => { Object.assign(S, INITIAL()); render(); });
}
// Picker re-mounts a variant from scratch; interactions keep state within it.
const variants = VARIANTS.map((v, i) => () => { currentVariant = i; return shell(v); });
