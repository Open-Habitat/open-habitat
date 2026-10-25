// Synthetic sidebar round. All names, paths and texts are invented.
// Every value here stands for a host fact named in NOTES.md; nothing is fetched.
const WS = [
  { id: 'kirjasto-api', branch: 'main', dirty: 2 },
  { id: 'kotisivu', branch: 'main', dirty: 0 },
  { id: 'budjetti-2027', branch: 'main', dirty: 0 },
  { id: 'mokki-varaukset', branch: 'kalenteri', dirty: 1 },
  { id: 'reseptit', branch: 'main', dirty: 0 },
  { id: 'opinnaytetyo', branch: null, dirty: 0 },
  { id: 'valokuvat-skriptit', branch: 'main', dirty: 0 },
  { id: 'arduino-saaasema', branch: 'main', dirty: 0 },
];
// state: working | question | process | spinoff | idle | done
const AGENTS = [
  { id: 'a1', ws: 'kirjasto-api', title: 'Lainojen eräpäivämuistutus', state: 'spinoff', since: '18 min', spinoffs: 1 },
  { id: 'a2', ws: 'kirjasto-api', title: 'Muistutusten sähköpostipohja', state: 'working', since: '6 min', parent: 'a1', worktree: 'wt/muistutus-pohja', ahead: 3, run: 'taskfleet · työskentelee' },
  { id: 'a3', ws: 'kirjasto-api', title: 'Hakuindeksin korjaus', state: 'done', parent: 'a1', worktree: 'wt/hakuindeksi', merged: true, run: 'taskfleet · yhdistetty' },
  { id: 'a4', ws: 'kotisivu', title: 'Etusivun kuvagalleria', state: 'question', since: '4 min', question: 'Käytetäänkö galleriassa WebP- vai AVIF-kuvia? AVIF on pienempi, mutta vanha iPad ei näytä sitä.' },
  { id: 'a5', ws: 'kotisivu', title: 'Saavutettavuustestit', state: 'process', since: '3 min', process: 'npm test' },
  { id: 'a6', ws: 'budjetti-2027', title: 'Lokakuun kuukausiraportti', state: 'done', unread: true, reply: 'Raportti on valmis: menot jäivät 4 % alle budjetin. Taulukko on tiedostossa raportit/lokakuu.md.' },
  { id: 'a7', ws: 'mokki-varaukset', title: 'Kalenterin synkronointi', state: 'idle', notice: 'Kalenterin API-avain vanhenee kolmen päivän päästä.' },
  { id: 'a8', ws: 'mokki-varaukset', title: 'Hinnaston päivitys', state: 'done' },
  { id: 'a9', ws: 'reseptit', title: 'Ainesosien yksiköt', state: 'done' },
  { id: 'a10', ws: 'reseptit', title: 'Ostoslistan vienti', state: 'done' },
  { id: 'a11', ws: 'budjetti-2027', title: 'Kategorioiden siivous', state: 'done' },
  { id: 'a12', ws: 'valokuvat-skriptit', title: 'EXIF-päivämäärien korjaus', state: 'done' },
];
const PINS = ['ws:kotisivu', 'ws:opinnaytetyo', 'a10'];

const S = { selected: null, collapsed: false, drawer: false, filter: '', allOpen: false, switcherOpen: false, seen: new Set(), currentWs: 'kirjasto-api', pins: new Set(PINS), tab: 'inbox' };
const narrow = () => S.collapsed && !matchMedia('(max-width: 800px)').matches;
const agent = (id) => AGENTS.find((a) => a.id === id);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const unread = (a) => a.unread && !S.seen.has(a.id);
const needsYou = (a) => a.state === 'question' || unread(a);
const live = (a) => ['working', 'process', 'spinoff', 'idle', 'question'].includes(a.state);
const wsAgents = (w) => AGENTS.filter((a) => a.ws === w);
const STATE_LABEL = {
  working: 'Työskentelee', question: 'Kysyy sinulta', process: 'Odottaa prosessia', spinoff: 'Odottaa spinoffia',
  idle: 'Odottaa viestiä', done: 'Valmis',
};
function label(a) {
  if (unread(a)) return 'Uusi vastaus';
  if (a.state === 'process') return `Odottaa: ${a.process}`;
  return STATE_LABEL[a.state];
}
function mark(a) {
  const kind = unread(a) ? 'new' : a.state === 'question' ? 'ask' : a.state === 'done' ? (a.merged ? 'merged' : 'done') : a.state === 'working' ? 'working' : 'wait';
  const glyph = { new: '●', ask: '?', done: '✓', merged: '⑂', working: '', wait: '○' }[kind];
  return `<span class="mk mk-${kind}" aria-hidden="true">${glyph}</span>`;
}
function wsWeight(w) {
  return wsAgents(w).reduce((n, a) => n + (needsYou(a) ? 100 : live(a) ? 10 : 0), 0);
}
const sortedWs = () => [...WS].sort((a, b) => wsWeight(b.id) - wsWeight(a.id));
const initials = (w) => w.split('-').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

function agentRow(a, { ws = true, meta = true, depth = 0, extra = '' } = {}) {
  const cur = S.selected === a.id ? ' aria-current="page"' : '';
  const sub = [ws ? a.ws : null, meta ? label(a) : null, a.since && live(a) ? a.since : null].filter(Boolean).join(' · ');
  return `<a href="#${a.id}" class="row agent" data-open="${a.id}"${cur} style="--d:${depth}">
    ${mark(a)}<span class="row-main"><span class="row-title">${esc(a.title)}</span>${sub ? `<span class="row-sub">${esc(sub)}</span>` : ''}${extra}</span></a>`;
}
function wsRow(w, { count = true } = {}) {
  const items = wsAgents(w.id);
  const cur = S.selected === 'ws:' + w.id ? ' aria-current="page"' : '';
  const att = items.filter(needsYou).length;
  const run = items.filter((a) => live(a) && !needsYou(a)).length;
  const tail = count ? `${att ? `<span class="pill pill-att" title="Odottaa sinua">${att}</span>` : ''}${run ? `<span class="pill" title="Käynnissä">${run}</span>` : ''}` : '';
  return `<a href="#ws-${w.id}" class="row ws" data-open="ws:${w.id}"${cur}><span class="ws-icon" aria-hidden="true">▢</span><span class="row-title">${w.id}</span>${tail}</a>`;
}
function filterField(placeholder = 'Suodata työtiloja') {
  return `<label class="filter"><span class="vh">${placeholder}</span><input type="search" data-filter placeholder="${placeholder}" value="${esc(S.filter)}"></label>`;
}
const filtered = () => sortedWs().filter((w) => w.id.includes(S.filter.trim().toLowerCase()));
function railHead(title = 'Kotipalvelin') {
  return `<header class="rail-head"><a href="#home" data-open="home" class="server"${S.selected === null ? ' aria-current="page"' : ''}>
    <span class="home-glyph" aria-hidden="true">⌂</span><span class="label">${title}</span></a>
    <button class="icon-btn collapse-btn" data-collapse aria-label="${narrow() ? 'Levennä sivupalkki' : 'Kavenna sivupalkki'}">${narrow() ? '»' : '«'}</button></header>`;
}
function railFoot() {
  return `<footer class="rail-foot"><a href="#settings" class="row" data-open="settings"><span class="ws-icon" aria-hidden="true">⚙</span><span class="row-title">Asetukset</span></a></footer>`;
}
function compactAgent(a) {
  return `<a href="#${a.id}" class="dot-btn" data-open="${a.id}" title="${esc(a.title)} · ${esc(label(a))}"${S.selected === a.id ? ' aria-current="page"' : ''}>
    <span class="dot-letters">${initials(a.ws)}</span>${mark(a)}<span class="vh">${esc(a.title)}: ${esc(label(a))}</span></a>`;
}
function compactIcon(glyph, text, act, badge) {
  return `<button class="dot-btn" ${act} title="${text}" aria-label="${text}${badge ? ` (${badge})` : ''}"><span class="dot-letters">${glyph}</span>${badge ? `<span class="badge">${badge}</span>` : ''}</button>`;
}
// ---------- 1 · Nyt ----------
const V1 = {
  name: 'Nyt',
  rail() {
    const you = AGENTS.filter(needsYou), running = AGENTS.filter((a) => live(a) && !needsYou(a) && !a.parent);
    if (narrow()) return `${railHead()}<div class="dots">${you.map(compactAgent).join('')}<hr>${running.map(compactAgent).join('')}<hr>${compactIcon('▢', 'Kaikki työtilat', 'data-expand-all', 0)}</div>`;
    const tree = (a) => agentRow(a) + AGENTS.filter((c) => c.parent === a.id && live(c)).map((c) => agentRow(c, { ws: false, depth: 1, extra: `<span class="row-sub">⑂ ${c.worktree}</span>` })).join('');
    return `${railHead()}
      <div class="rail-scroll">
      <section class="sec"><h2 class="sec-h">Sinun vuorosi <span class="pill pill-att">${you.length}</span></h2><div class="list">${you.map((a) => agentRow(a)).join('') || '<p class="empty">Mikään ei odota sinua.</p>'}</div></section>
      <section class="sec"><h2 class="sec-h">Käynnissä <span class="muted">${AGENTS.filter((a) => live(a) && !needsYou(a)).length}</span></h2><div class="list">${running.map(tree).join('')}</div></section>
      <section class="sec"><h2 class="sec-h">Työtilat</h2>${filterField()}<div class="list">${filtered().map((w) => wsRow(w)).join('') || '<p class="empty">Ei osumia.</p>'}</div></section>
      </div>${railFoot()}`;
  },
  home() {
    return `<h1>Työtilat</h1><p class="lead">Sivupalkki näyttää jo sen, mikä odottaa sinua ja mikä on käynnissä. Etusivu on työtilojen yleiskuva ja paikka aloittaa uusi työ.</p>
      <div class="grid">${sortedWs().map(card).join('')}</div>`;
  },
  badge: () => AGENTS.filter(needsYou).length,
};
function card(w) {
  const items = wsAgents(w.id);
  const top = items.filter((a) => live(a) || needsYou(a)).slice(0, 2);
  return `<a class="card" href="#ws-${w.id}" data-open="ws:${w.id}"><strong>${w.id}</strong>
    <span class="muted">${w.branch ? `${w.branch}${w.dirty ? ` · ${w.dirty} muutosta` : ''}` : 'ei Git-repoa'} · ${items.length} keskustelua</span>
    ${top.map((a) => `<span class="card-line">${mark(a)} ${esc(a.title)}</span>`).join('') || '<span class="card-line muted">Ei käynnissä olevaa työtä</span>'}</a>`;
}

// ---------- 2 · Saapuneet ----------
function inboxItems() {
  const out = [];
  for (const a of AGENTS) {
    if (a.state === 'question') out.push({ key: a.id + ':q', a, kind: 'Kysyy', text: a.question });
    if (unread(a)) out.push({ key: a.id + ':r', a, kind: 'Uusi vastaus', text: a.reply });
    if (a.merged) out.push({ key: a.id + ':m', a, kind: 'Yhdistetty', text: `${a.worktree} on nyt mainissa.` });
    if (a.notice) out.push({ key: a.id + ':n', a, kind: 'Ilmoitus', text: a.notice });
  }
  const order = ['Kysyy', 'Uusi vastaus', 'Ilmoitus', 'Yhdistetty'];
  return out.filter((i) => !S.seen.has(i.key)).sort((x, y) => order.indexOf(x.kind) - order.indexOf(y.kind));
}
const V2 = {
  name: 'Saapuneet',
  rail() {
    const items = inboxItems(), bg = AGENTS.filter((a) => live(a) && a.state !== 'question');
    if (narrow()) return `${railHead()}<div class="dots">${compactIcon('✉', 'Saapuneet', 'data-tab="inbox" data-expand', items.length)}${compactIcon('◌', 'Taustalla', 'data-tab="bg" data-expand', bg.length)}${compactIcon('▢', 'Työtilat', 'data-tab="ws" data-expand', 0)}</div>`;
    const tabs = [['inbox', 'Saapuneet', items.length], ['bg', 'Taustalla', bg.length], ['ws', 'Työtilat', 0]];
    const body = S.tab === 'inbox'
      ? (items.map((i) => `<article class="msg${S.selected === i.a.id ? ' msg-cur' : ''}"><a href="#${i.a.id}" data-open="${i.a.id}" class="msg-link">
          <span class="msg-kind">${mark(i.a)} ${i.kind} · ${i.a.ws}</span><strong>${esc(i.a.title)}</strong><span class="msg-text">${esc(i.text)}</span></a>
          <button class="icon-btn" data-ack="${i.key}" aria-label="Kuittaa: ${esc(i.a.title)}" title="Kuittaa">✓</button></article>`).join('')
        || '<p class="empty big">Kaikki kuitattu. Taustalla on ' + bg.length + ' agenttia.</p>')
      : S.tab === 'bg' ? `<div class="list">${bg.map((a) => agentRow(a, { depth: a.parent ? 1 : 0 })).join('')}</div>`
        : `${filterField()}<div class="list">${filtered().map((w) => wsRow(w)).join('')}</div>`;
    return `${railHead()}<div class="tabs" role="tablist">${tabs.map(([k, t, n]) => `<button role="tab" data-tab="${k}" aria-selected="${S.tab === k}">${t}${n ? ` <span class="pill${k === 'inbox' ? ' pill-att' : ''}">${n}</span>` : ''}</button>`).join('')}</div>
      <div class="rail-scroll">${body}</div>${railFoot()}`;
  },
  home() {
    const ongoing = AGENTS.filter(live), recent = AGENTS.filter((a) => !live(a)).slice(0, 6);
    return `<h1>Jatka siitä, mihin jäit</h1><p class="lead">Saapuneet hoitaa sen, mikä vaatii sinua. Etusivu näyttää kaiken käynnissä olevan ja viimeisimmät keskustelut, kuten nykyinen paluunäkymä.</p>
      <h2>Käynnissä</h2><div class="list wide">${ongoing.map((a) => agentRow(a)).join('')}</div><h2>Muut keskustelut</h2><div class="list wide">${recent.map((a) => agentRow(a)).join('')}</div>`;
  },
  badge: () => inboxItems().length,
};

// ---------- 3 · Työpuu ----------
const V3 = {
  name: 'Työpuu',
  rail() {
    const roots = AGENTS.filter((a) => !a.parent && (live(a) || needsYou(a)));
    const groups = [...new Set(roots.map((a) => a.ws))];
    const quiet = WS.filter((w) => !groups.includes(w.id));
    if (narrow()) return `${railHead()}<div class="dots">${roots.map(compactAgent).join('')}<hr>${compactIcon('▢', 'Muut työtilat', 'data-expand-all', 0)}</div>`;
    const node = (a, d = 0) => {
      const kids = AGENTS.filter((c) => c.parent === a.id);
      const extra = a.worktree ? `<span class="row-sub chips"><span class="chip">⑂ ${a.worktree}</span>${a.merged ? '<span class="chip chip-ok">yhdistetty</span>' : `<span class="chip">+${a.ahead}</span>`}<span class="chip">${a.run}</span></span>` : '';
      return `<li>${agentRow(a, { ws: false, depth: d, extra })}${kids.length ? `<ul class="tree">${kids.map((k) => node(k, d + 1)).join('')}</ul>` : ''}</li>`;
    };
    return `${railHead()}<div class="rail-scroll">
      ${groups.map((g) => `<section class="sec"><a class="group-h" href="#ws-${g}" data-open="ws:${g}">${g}</a><ul class="tree root">${roots.filter((a) => a.ws === g).map((a) => node(a)).join('')}</ul></section>`).join('')}
      <section class="sec"><button class="sec-toggle" data-all aria-expanded="${S.allOpen}">Muut työtilat <span class="muted">${quiet.length}</span><span class="chev" aria-hidden="true">${S.allOpen ? '▾' : '▸'}</span></button>
      ${S.allOpen ? `${filterField()}<div class="list">${quiet.filter((w) => w.id.includes(S.filter.trim().toLowerCase())).map((w) => wsRow(w)).join('')}</div>` : ''}</section>
      </div>${railFoot()}`;
  },
  home() {
    const you = AGENTS.filter(needsYou), on = AGENTS.filter((a) => live(a) && !needsYou(a)), rest = AGENTS.filter((a) => !live(a) && !needsYou(a)).slice(0, 5);
    return `<h1>Jatka siitä, mihin jäit</h1><p class="lead">Etusivu pysyy nykyisenä paluunäkymänä. Sivupalkki näyttää saman työn puuna: kuka käynnisti kenet ja missä worktreessä työ on.</p>
      <h2>Odottaa sinua</h2><div class="list wide">${you.map((a) => agentRow(a)).join('')}</div><h2>Käynnissä</h2><div class="list wide">${on.map((a) => agentRow(a)).join('')}</div><h2>Muut keskustelut</h2><div class="list wide">${rest.map((a) => agentRow(a)).join('')}</div>`;
  },
  badge: () => AGENTS.filter(needsYou).length,
};

// ---------- 4 · Työtila kerrallaan ----------
const V4 = {
  name: 'Työtila kerrallaan',
  rail() {
    const w = WS.find((x) => x.id === S.currentWs), items = wsAgents(w.id);
    const elsewhere = AGENTS.filter((a) => a.ws !== w.id && needsYou(a));
    if (narrow()) return `${railHead()}<div class="dots">${sortedWs().map((x) => {
      const att = wsAgents(x.id).filter(needsYou).length, run = wsAgents(x.id).some(live);
      return `<button class="dot-btn ws-dot" data-switch="${x.id}" title="${x.id}" aria-label="${x.id}${att ? `, ${att} odottaa sinua` : ''}"${x.id === S.currentWs ? ' aria-current="true"' : ''}><span class="dot-letters">${initials(x.id)}</span>${att ? `<span class="badge">${att}</span>` : run ? '<span class="mk mk-working" aria-hidden="true"></span>' : ''}</button>`;
    }).join('')}</div>`;
    const active = items.filter((a) => live(a) || needsYou(a)), done = items.filter((a) => !live(a) && !needsYou(a));
    const switcher = `<div class="switcher"><button class="switch-btn" data-switcher aria-expanded="${S.switcherOpen}"><span class="ws-icon" aria-hidden="true">▢</span><span class="row-title">${w.id}</span>${elsewhere.length ? `<span class="pill pill-att" title="Muissa työtiloissa odottaa">${elsewhere.length}</span>` : ''}<span class="chev" aria-hidden="true">▾</span></button>
      ${S.switcherOpen ? `<div class="pop" role="dialog" aria-label="Vaihda työtilaa">${filterField('Hae työtila')}<div class="list">${filtered().map((x) => `<button class="row ws" data-switch="${x.id}"${x.id === S.currentWs ? ' aria-current="true"' : ''}><span class="ws-icon" aria-hidden="true">▢</span><span class="row-title">${x.id}</span>${wsAgents(x.id).filter(needsYou).length ? `<span class="pill pill-att">${wsAgents(x.id).filter(needsYou).length}</span>` : ''}</button>`).join('')}</div></div>` : ''}</div>`;
    const trees = AGENTS.filter((a) => a.ws === w.id && a.worktree);
    return `${railHead()}${switcher}<div class="rail-scroll">
      <section class="sec"><h2 class="sec-h">Keskustelut</h2><div class="list">${active.map((a) => agentRow(a, { ws: false, depth: a.parent ? 1 : 0 })).join('') || '<p class="empty">Ei käynnissä olevia.</p>'}
        <button class="row new" data-new><span class="ws-icon" aria-hidden="true">＋</span><span class="row-title">Uusi keskustelu</span></button>
        ${done.length ? `<details><summary class="row muted">Valmiit ${done.length}</summary>${done.map((a) => agentRow(a, { ws: false })).join('')}</details>` : ''}</div></section>
      <section class="sec"><h2 class="sec-h">Tässä työtilassa</h2><div class="list">
        <a class="row" href="#git" data-open="ws:${w.id}"><span class="ws-icon" aria-hidden="true">⎇</span><span class="row-title">${w.branch ?? 'Ei Git-repoa'}${w.dirty ? ` · ${w.dirty} muutosta` : ''}</span></a>
        ${trees.map((t) => `<a class="row" href="#${t.id}" data-open="${t.id}"><span class="ws-icon" aria-hidden="true">⑂</span><span class="row-title">${t.worktree}</span><span class="pill${t.merged ? ' pill-ok' : ''}">${t.merged ? 'yhdistetty' : '+' + t.ahead}</span></a>`).join('')}
        <a class="row" href="#files" data-open="ws:${w.id}"><span class="ws-icon" aria-hidden="true">≡</span><span class="row-title">Tiedostot</span></a>
        <a class="row" href="#term" data-open="ws:${w.id}"><span class="ws-icon" aria-hidden="true">›_</span><span class="row-title">Terminaali</span></a></div></section>
      ${elsewhere.length ? `<section class="sec elsewhere"><h2 class="sec-h">Muualla odottaa</h2><div class="list">${elsewhere.map((a) => agentRow(a)).join('')}</div></section>` : ''}
      </div>${railFoot()}`;
  },
  home() {
    const you = AGENTS.filter(needsYou);
    return `<h1>Kaikki työtilat</h1><p class="lead">Sivupalkki näyttää yhden työtilan kerrallaan, joten etusivu on ainoa näkymä kaikkien yli: mikä odottaa sinua, mikä on käynnissä ja millä työtilalla.</p>
      <h2>Odottaa sinua</h2><div class="list wide">${you.map((a) => agentRow(a)).join('')}</div><h2>Työtilat</h2><div class="grid">${sortedWs().map(card).join('')}</div>`;
  },
  badge: () => AGENTS.filter((a) => a.ws !== S.currentWs && needsYou(a)).length,
};

// ---------- 5 · Kiinnitetyt ja nyt ----------
const V5 = {
  name: 'Kiinnitetyt',
  rail() {
    const nowList = [...AGENTS.filter(needsYou), ...AGENTS.filter((a) => live(a) && !needsYou(a) && !a.parent)].slice(0, 5);
    const pins = [...S.pins];
    if (narrow()) return `${railHead()}<div class="dots">${nowList.map(compactAgent).join('')}<hr>${pins.map((p) => p.startsWith('ws:') ? `<a href="#" class="dot-btn" data-open="${p}" title="${p.slice(3)}"><span class="dot-letters">${initials(p.slice(3))}</span></a>` : compactAgent(agent(p))).join('')}<hr>${compactIcon('⌕', 'Hae', 'data-expand', 0)}</div>`;
    const q = S.filter.trim().toLowerCase();
    const results = q ? [...WS.filter((w) => w.id.includes(q)).map((w) => wsRow(w)), ...AGENTS.filter((a) => a.title.toLowerCase().includes(q)).map((a) => agentRow(a))] : null;
    const pinBtn = (key, name) => `<button class="icon-btn pin" data-pin="${key}" aria-label="${S.pins.has(key) ? 'Irrota' : 'Kiinnitä'} ${esc(name)}" title="${S.pins.has(key) ? 'Irrota' : 'Kiinnitä'}">${S.pins.has(key) ? '★' : '☆'}</button>`;
    return `${railHead()}<div class="search">${filterField('Hae työtila tai keskustelu')}</div><div class="rail-scroll">
      ${results ? `<section class="sec"><h2 class="sec-h">Osumat</h2><div class="list">${results.join('') || '<p class="empty">Ei osumia.</p>'}</div></section>` : `
      <section class="sec"><h2 class="sec-h">Nyt</h2><div class="list">${nowList.map((a) => agentRow(a)).join('')}</div></section>
      <section class="sec"><h2 class="sec-h">Kiinnitetyt</h2><div class="list">${pins.map((p) => `<div class="pinrow">${p.startsWith('ws:') ? wsRow(WS.find((w) => w.id === p.slice(3))) : agentRow(agent(p))}${pinBtn(p, p.startsWith('ws:') ? p.slice(3) : agent(p).title)}</div>`).join('') || '<p class="empty">Kiinnitä työtila tähdellä.</p>'}</div></section>
      <section class="sec"><button class="sec-toggle" data-all aria-expanded="${S.allOpen}">Kaikki työtilat <span class="muted">${WS.length}</span><span class="chev" aria-hidden="true">${S.allOpen ? '▾' : '▸'}</span></button>
      ${S.allOpen ? `<div class="list">${sortedWs().map((w) => `<div class="pinrow">${wsRow(w)}${pinBtn('ws:' + w.id, w.id)}</div>`).join('')}</div>` : ''}</section>`}
      </div>${railFoot()}`;
  },
  home() {
    const you = AGENTS.filter(needsYou), on = AGENTS.filter((a) => live(a) && !needsYou(a));
    return `<h1>Jatka siitä, mihin jäit</h1><p class="lead">Sivupalkin Nyt-lista on lyhyt (enintään viisi). Etusivu näyttää kaiken käynnissä olevan ja kaikki työtilat, myös kiinnittämättömät.</p>
      <h2>Odottaa sinua</h2><div class="list wide">${you.map((a) => agentRow(a)).join('')}</div><h2>Käynnissä</h2><div class="list wide">${on.map((a) => agentRow(a)).join('')}</div><h2>Työtilat</h2><div class="grid">${sortedWs().map(card).join('')}</div>`;
  },
  badge: () => AGENTS.filter(needsYou).length,
};
const VARIANTS = [V1, V2, V3, V4, V5];

// ---------- main area ----------
function mainView(v) {
  if (S.selected === null) return `<div class="page">${v.home()}</div>`;
  if (S.selected === 'settings') return `<div class="page"><h1>Asetukset</h1><p class="lead">Ei osa tätä kierrosta.</p></div>`;
  if (S.selected.startsWith('ws:')) {
    const w = S.selected.slice(3), items = wsAgents(w);
    return `<div class="page"><p class="crumb">Työtila</p><h1>${w}</h1><p class="lead">Työtilan sivu: sen keskustelut, worktreet, Git ja tiedostot. Tästä aloitetaan uusi keskustelu, vaikka työtilassa ei olisi mitään käynnissä.</p>
      <button class="primary" data-new>Uusi keskustelu</button><h2>Keskustelut</h2><div class="list wide">${items.map((a) => agentRow(a, { ws: false })).join('') || '<p class="empty">Tässä työtilassa ei ole vielä keskusteluja.</p>'}</div></div>`;
  }
  const a = agent(S.selected), parent = a.parent ? agent(a.parent) : null;
  const body = a.state === 'question'
    ? `<div class="q"><strong>Agentti kysyy</strong><p>${esc(a.question)}</p><div class="q-actions"><button class="primary">WebP</button><button>AVIF</button><button>Vastaa omin sanoin</button></div></div>`
    : a.reply ? `<div class="bubble">${esc(a.reply)}</div>`
      : `<div class="bubble">${a.state === 'done' ? 'Työ on valmis.' : 'Työskentelen tämän parissa…'}</div>`;
  return `<div class="convo"><header class="convo-h"><p class="crumb"><a href="#ws-${a.ws}" data-open="ws:${a.ws}">${a.ws}</a>${parent ? ` › <a href="#${parent.id}" data-open="${parent.id}">${esc(parent.title)}</a>` : ''}</p>
    <h1>${esc(a.title)}</h1><p class="state">${mark(a)} ${esc(label(a))}${a.worktree ? ` · ⑂ ${a.worktree}` : ''}</p></header>
    <div class="feed"><div class="bubble you">Synteettinen aiempi viesti: ${esc(a.title.toLowerCase())}.</div>${body}</div>
    <div class="composer"><span>Kirjoita viesti…</span><button class="primary" disabled>Lähetä</button></div></div>`;
}
const MOBILE_TITLE = () => S.selected === null ? 'Etusivu' : S.selected.startsWith('ws:') ? S.selected.slice(3) : S.selected === 'settings' ? 'Asetukset' : agent(S.selected).title;

function shell(v) {
  const badge = v.badge();
  return `<div class="app${narrow() ? ' collapsed' : ''}${S.drawer ? ' drawer' : ''}">
    <nav class="rail" aria-label="Sivupalkki · ${v.name}">${v.rail()}${S.drawer ? '<button class="icon-btn drawer-close" data-drawer-close aria-label="Sulje navigaatio">×</button>' : ''}</nav>
    ${S.drawer ? '<button class="scrim" data-drawer-close aria-label="Sulje valikko"></button>' : ''}
    <main class="main"${S.drawer ? ' inert' : ''}><div class="mtool"><button class="icon-btn" data-drawer aria-label="Avaa navigaatio${badge ? `, ${badge} odottaa sinua` : ''}">☰${badge ? `<span class="badge">${badge}</span>` : ''}</button><span class="mtitle">${esc(MOBILE_TITLE())}</span>${S.selected !== null ? '<a class="icon-btn" href="#home" data-open="home" aria-label="Etusivu">⌂</a>' : ''}</div>
    ${mainView(v)}</main></div>`;
}
let currentVariant = 0;
function render() {
  const focusFilter = document.activeElement?.matches?.('[data-filter]');
  const pos = focusFilter ? document.activeElement.selectionStart : 0;
  stage.innerHTML = shell(VARIANTS[currentVariant]);
  if (focusFilter) { const f = stage.querySelector('[data-filter]'); if (f) { f.focus(); f.setSelectionRange(pos, pos); } }
}
function installPrototype() {
  stage.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open],[data-collapse],[data-all],[data-expand-all],[data-expand],[data-tab],[data-ack],[data-switch],[data-switcher],[data-pin],[data-drawer],[data-drawer-close],[data-new]');
    if (!t) return;
    e.preventDefault();
    const d = t.dataset;
    if (d.open) {
      S.selected = d.open === 'home' ? null : d.open;
      if (S.selected && !S.selected.startsWith('ws:') && S.selected !== 'settings') { S.seen.add(S.selected); const a = agent(S.selected); if (currentVariant === 3) S.currentWs = a.ws; }
      if (S.selected?.startsWith('ws:') && currentVariant === 3) S.currentWs = S.selected.slice(3);
      S.drawer = false; S.switcherOpen = false;
    }
    if ('collapse' in d) S.collapsed = !S.collapsed;
    if ('all' in d) S.allOpen = !S.allOpen;
    if ('expandAll' in d) { S.collapsed = false; S.allOpen = true; }
    if ('expand' in d) S.collapsed = false;
    if (d.tab) S.tab = d.tab;
    if (d.ack) S.seen.add(d.ack);
    if (d.switch) { S.currentWs = d.switch; S.switcherOpen = false; S.selected = 'ws:' + d.switch; S.drawer = false; }
    if ('switcher' in d) S.switcherOpen = !S.switcherOpen;
    if (d.pin) S.pins.has(d.pin) ? S.pins.delete(d.pin) : S.pins.add(d.pin);
    if ('drawer' in d) S.drawer = true;
    if ('drawerClose' in d) S.drawer = false;
    if ('new' in d) { const n = document.getElementById('lab-feedback'); n.textContent = 'Uusi keskustelu: ei käynnistetä tässä kokeessa.'; }
    render();
    if ('drawer' in d) stage.querySelector('.rail a, .rail button')?.focus();
  });
  stage.addEventListener('input', (e) => { if (e.target.matches('[data-filter]')) { S.filter = e.target.value; render(); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && (S.drawer || S.switcherOpen)) { S.drawer = false; S.switcherOpen = false; render(); } });
  matchMedia('(max-width: 800px)').addEventListener('change', () => { S.drawer = false; render(); });
  const theme = document.getElementById('theme');
  const setTheme = (t) => { document.documentElement.dataset.theme = t; theme.textContent = t === 'dark' ? 'Vaalea' : 'Tumma'; };
  setTheme(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  theme.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  document.getElementById('reset').addEventListener('click', () => { Object.assign(S, { selected: null, collapsed: false, drawer: false, filter: '', allOpen: false, switcherOpen: false, seen: new Set(), currentWs: 'kirjasto-api', pins: new Set(PINS), tab: 'inbox' }); render(); });
}
// Picker re-mounts a variant from scratch; interactions keep state within it.
const variants = VARIANTS.map((v, i) => () => { currentVariant = i; return shell(v); });
