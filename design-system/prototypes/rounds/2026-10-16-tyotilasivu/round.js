// Työtilasivu ja +-valikko (proto-workspace-page, 16.10.2026). Sivu avautuu sivupalkin
// työtilan nimestä ja työtilarivin …-valikon "Avaa työtilasivu" -kohdasta. Yläpalkissa on
// työtilan nimi ja polku sekä oikealla + (uusi) ja … (työtilan toiminnot). + avaa oman
// kerroksensa: työpöydällä ankkuroituna painikkeeseen, puhelimessa alalaatikkona; sama
// kerros avautuu sivupalkin työtilarivin +:sta, joka ei enää luo keskustelua suoraan.
// Worktree-agenttien ryhmä ja +-kerroksen worktree-kohdat ovat paikka, jonka sisällön
// kierros proto-worktree-agents määrittelee.
(() => {
const ICON_MORE = SVG('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>');
const ICON_BRANCH = SVG('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10"/><path d="M18 10c0 4-6 3-12 7"/>');
const ICON_COPY = SVG('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>');
const ICON_EXT = SVG('<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/>');
const ICON_TRASH = SVG('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>');
const ICON_EYE_OFF = SVG('<path d="M3 3l18 18"/><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-2.6 3.2M6.4 7.4C4.3 8.9 3 12 3 12s4 6 9 6a8.6 8.6 0 0 0 3.6-.8"/><path d="M9.9 10a3 3 0 0 0 4.1 4.1"/>');
const ICON_PEN = SVG('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>');
const ICON_CHAT = SVG('<path d="M5 18.5V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8.5z"/>');
const ICON_TREE = SVG('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 7v10"/><path d="M8 5h4a4 4 0 0 1 4 4v1"/>');
const ICON_MERGE = SVG('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="15" r="2"/><path d="M6 7v10"/><path d="M6 7c0 5 5 8 10 8"/>');
const ICON_UP = SVG('<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>');
const ICON_DOWN = SVG('<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>');
const ICON_ARCH = SVG('<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>');
const ICON_FWD = SVG('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>');

// ---------- Synthetic workspace facts ----------
// Git: branch, changed files and sync come from native git in the checkout; commits are
// the last few on the current branch. Worktrees are the main checkout's linked worktrees
// that a Taskfleet run owns (ADR 0010); their rows here are placeholders for the
// proto-worktree-agents round.
const WSD = {
  aurinkokello: {
    gh: 'maintainer/aurinkokello', branch: 'main', upstream: 'origin/main', ahead: 1, behind: 0, fetched: '6 min sitten',
    files: [['M', 'scripts/status_rows.py', '+38 −4'], ['?', 'tests/test_status_rows.py', 'uusi']],
    commits: [
      { h: 'a41c9e2', s: 'Statusrivien jäsennin omaksi moduulikseen', t: '40 min', local: true },
      { h: '7d03b18', s: 'CI: macOS-ajo käyttää Python 3.13:a', t: 'eilen' },
      { h: 'e92f4a0', s: 'README: --json-esimerkki ja aikavyöhyke', t: 'ma' },
      { h: '3bb1c57', s: 'Auringonlaskun pyöristys minuutteihin', t: '9.10.' },
    ],
    wts: [
      { id: 'w1', branch: 'wt/webp-fallback', title: 'JPEG-varakuvat vanhoille selaimille', mode: 'self', st: 'working', line: 'Ajaa <span class="mono">pytest</span> · 3 min', ahead: 3, path: '~/src/aurinkokello__worktrees/webp-fallback' },
      { id: 'w2', branch: 'wt/tz-output', title: 'Aikavyöhyke tulosteen otsakkeeseen', mode: 'interactive', st: 'waiting', line: 'Kysyy: näytetäänkö UTC-poikkeama aina vai vain kesäaikana?', ahead: 2, path: '~/src/aurinkokello__worktrees/tz-output' },
      { id: 'w3', branch: 'wt/ci-cache', title: 'CI-välimuisti pip-paketeille', mode: 'self', st: 'merged', line: 'Mergetty mainiin 2 t sitten · 4 committia · worktree poistettu', ahead: 0 },
    ],
    archived: [{ id: 'a1', title: 'Vanha deploy-skripti', t: '2.10.' }, { id: 'a2', title: 'Kokeilu: laskenta Rustilla', t: '28.9.' }],
  },
  issuectl: {
    gh: 'jarimustonen/issuectl', branch: 'search-negation', upstream: 'origin/search-negation', ahead: 3, behind: 1, fetched: '25 min sitten',
    files: [],
    commits: [
      { h: '5e0a771', s: 'Haku: NOT-avainsana jäsentimeen', t: '25 min', local: true },
      { h: 'c39d2b4', s: 'Haku: -label:bug -muoto', t: '40 min', local: true },
      { h: '0f81aa9', s: 'Testit negaatiolle', t: '1 t', local: true },
      { h: '9a6e3c0', s: 'JSON-skeeman versio 3', t: 'eilen' },
    ],
    wts: [], archived: [{ id: 'a3', title: 'Lanejen järjestys', t: '30.9.' }],
  },
};
const wsd = (id) => WSD[id] || (WSD[id] = { gh: null, branch: 'main', upstream: null, ahead: 0, behind: 0, fetched: null, files: [], commits: [{ h: '1f2e3d4', s: 'Ensimmäinen commit', t: '1.10.' }], wts: [], archived: [] });
// Recaps (the conversation's own tilannekatsaus, verbatim) and last activity.
const REC = {
  c1: { age: '1 min', recap: 'Skripti `scripts/status_rows.py` lukee `status.md`:n taulukon ja tulostaa viime viikon rivit. `--since` antaa rajan käsin, ja `--today` tekee päivästä testattavan; testit menevät läpi.', next: 'Kerro, lisätäänkö JSON-tuloste samaan ajoon vai omaksi lipukseen.' },
  c2: { age: '8 min', recap: 'Kuvat `assets/photos/` muunnettiin WebP-muotoon laadulla 82: 214 kuvaa, yhteensä 38 Mt → 11 Mt. `build.sh` käyttää nyt `.webp`-tiedostoja. Alkuperäiset ovat yhä paikallaan.', next: 'Päätä, poistetaanko alkuperäiset vai siirretäänkö ne `originals/`-hakemistoon.' },
  c10: { age: '25 min', recap: 'Hakusyntaksiin lisättiin negaatio. Jäsennin hyväksyy jo molemmat muodot, mutta dokumentaatioon ja virheviesteihin pitää valita yksi.', next: 'Valitse muoto, niin päivitän README:n ja virheviestit.' },
  c4: { age: '3 t', recap: 'Syklin tunnistus toimii pienissä graafeissa. Suuressa graafissa ajo keskeytyi, eikä prosessin tilaa ole sen jälkeen saatu luettua.', next: 'Tarkista, onko Pi yhä käynnissä terminaalissa.' },
  c5: { age: '14 min', recap: 'Kiintiönäkymän tekstit on kirjoitettu uudelleen; Storybookin tarinat on päivitetty.', next: 'Aja testit ja tarkista puhelinleveys.' },
};
const DONE_T = { c3: 'eilen', c7: 'ma', c8: '9.10.', c11: '8.10.', c6: '3.10.' };

let PAGE = null, CUR = 'v1', LAYER = null;
const OPEN = new Set(), FOLD = { done: false, arch: false, files: false, commits: false };
const ws = () => UI.ws.find(w => w.id === PAGE);
const st = (c) => convState(c);
const mark = (s) => { const [l, m] = STATES[s] ?? ['Ei aloitettu', '<span class="st-none"></span>']; return `<span class="st" role="img" aria-label="${l}" title="${l}">${m}</span>`; };
const openConvs = (w) => w.convs.filter(c => !c.archived && st(c) !== 'done').sort((a, b) => (STATE_ORDER[st(a)] ?? 4) - (STATE_ORDER[st(b)] ?? 4));
const doneConvs = (w) => w.convs.filter(c => !c.archived && st(c) === 'done');
const archConvs = (w) => [...w.convs.filter(c => c.archived).map(c => ({ id: c.id, title: c.title, t: 'nyt', live: true })), ...wsd(w.id).archived];
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---------- Shared pieces ----------
const syncText = (d) => !d.upstream ? 'ei etärepoa' : d.ahead || d.behind ? [d.ahead ? `${d.ahead} edellä` : '', d.behind ? `${d.behind} jäljessä` : ''].filter(Boolean).join(', ') + ` ${d.upstream}` : `ajan tasalla ${d.upstream}`;
const syncIcons = (d) => `${d.ahead ? `<span class="g-ahead" title="${d.ahead} committia ei ole vielä originissa">${ICON_UP}${d.ahead}</span>` : ''}${d.behind ? `<span class="g-behind" title="${d.behind} committia originissa, joita täällä ei ole">${ICON_DOWN}${d.behind}</span>` : ''}`;
const fileList = (d) => d.files.length ? `<ul class="g-files">${d.files.map(([s, p, n]) => `<li><span class="g-fs g-${s === '?' ? 'new' : s === 'D' ? 'del' : 'mod'}" title="${s === '?' ? 'Uusi, ei vielä Gitissä' : s === 'D' ? 'Poistettu' : 'Muutettu'}">${s === '?' ? 'U' : s}</span><span class="mono">${esc(p)}</span><span class="g-n">${n}</span></li>`).join('')}</ul>` : '<p class="g-clean">Ei muutoksia; työhakemisto vastaa viimeisintä committia.</p>';
const commitList = (d) => `<ul class="g-commits">${d.commits.map(c => `<li><span class="mono g-h">${c.h}</span><span class="g-s">${esc(c.s)}</span>${c.local ? '<span class="g-local" title="Ei vielä originissa">paikallinen</span>' : ''}<time>${c.t}</time></li>`).join('')}</ul>`;
const gitFacts = (d) => `<p class="g-branch">${ICON_BRANCH}<span class="mono">${esc(d.branch)}</span>${syncIcons(d)}<span class="g-sync">${syncText(d)}</span></p>${d.fetched ? `<p class="g-fetched">Origin tarkistettu ${d.fetched}</p>` : ''}`;

function recapCard(c) {
  const r = REC[c.id] || { age: 'nyt', recap: 'Keskustelulla ei vielä ole tilannekatsausta.', next: '' }; const s = st(c);
  return `<article class="kc ${s}"><a href="#" class="kc-head" data-conv="${c.id}">${mark(s)}<strong>${esc(c.title)}</strong><span class="grow"></span><time>${r.age}</time></a>
<p class="k-text">${inline(r.recap)}</p>${r.next ? `<p class="k-next"><span class="k-label">Seuraavaksi</span><span>${inline(r.next)}</span></p>` : ''}
<a href="#" class="kc-go" data-conv="${c.id}">${s === 'attention' ? 'Lue vastaus' : s === 'waiting' ? 'Vastaa' : 'Avaa'}${ICON_FWD}</a></article>`;
}
// A compact conversation row; its disclosure shows the same recap the cards show.
function convRowX(c) {
  const r = REC[c.id]; const s = st(c); const open = OPEN.has(c.id);
  return `<li class="xr ${s}${open ? ' open' : ''}"><div class="xr-line">${r ? `<button type="button" class="xr-tog" data-x="${c.id}" aria-expanded="${open}" aria-label="${open ? 'Piilota' : 'Näytä'} katsaus: ${esc(c.title)}">${CHEV}</button>` : '<span class="xr-tog"></span>'}<a href="#" class="xr-main" data-conv="${c.id}">${mark(s)}<span class="xr-title">${esc(c.title)}</span>${r?.next ? `<span class="xr-next">${inline(r.next)}</span>` : ''}</a><time>${r?.age ?? ''}</time></div>
${open && r ? `<div class="xr-body"><p class="k-text">${inline(r.recap)}</p><p class="k-next"><span class="k-label">Seuraavaksi</span><span>${inline(r.next)}</span></p></div>` : ''}</li>`;
}
const wtMark = (t) => t.st === 'merged' ? `<span class="st wt-merged" role="img" aria-label="Mergetty" title="Mergetty">${ICON_MERGE}</span>` : mark(t.st);
const modeTag = (t) => `<span class="wt-mode ${t.mode}" title="${t.mode === 'self' ? 'Agentti tekee työn, ajaa testit ja mergeää itse' : 'Sinä päätät, milloin haara mergetään'}">${t.mode === 'self' ? 'mergeää itse' : 'interaktiivinen'}</span>`;
const wtRow = (t, { branch = true } = {}) => `<li class="wt ${t.st}"><a href="#" class="wt-main" data-wt="${t.id}">${wtMark(t)}<span class="wt-title">${esc(t.title)}</span>${branch ? modeTag(t) : ''}${branch ? `<span class="mono wt-branch">${esc(t.branch)}</span>` : ''}</a><p class="wt-line">${t.line}</p></li>`;
// The worktree-agent group: where proto-worktree-agents puts its rows and states.
const wtGroup = (w, h = 'h2') => { const t = wsd(w.id).wts; return `<section class="grp wt-grp" aria-labelledby="wt-h"><${h} id="wt-h" class="grp-h">${ICON_TREE}Worktree-agentit <span class="count">${t.length}</span></${h}>${t.length ? `<ul class="wts">${t.map(x => wtRow(x)).join('')}</ul>` : `<p class="grp-empty">Ei worktree-agentteja. Aloita sellainen <button type="button" class="linkish" data-plus-inline>+</button>-valikosta.</p>`}</section>`; };
const doneGroup = (w) => { const d = doneConvs(w); if (!d.length) return ''; return `<section class="grp"><button type="button" class="fold" data-fold="done" aria-expanded="${FOLD.done}">${CHEV}<span>Valmiit</span><span class="count plain">${d.length}</span></button>${FOLD.done ? `<ul class="rows">${d.map(c => `<li><a href="#" class="row" data-conv="${c.id}">${mark('done')}<span class="row-title">${esc(c.title)}</span><time>${DONE_T[c.id] ?? ''}</time></a></li>`).join('')}</ul>` : ''}</section>`; };
const archGroup = (w) => { const a = archConvs(w); if (!a.length) return ''; return `<section class="grp"><button type="button" class="fold" data-fold="arch" aria-expanded="${FOLD.arch}">${CHEV}<span>Arkisto</span><span class="count plain">${a.length}</span></button>${FOLD.arch ? `<ul class="rows">${a.map(c => `<li class="row arch">${ICON_ARCH}<span class="row-title">${esc(c.title)}</span><time>${c.t}</time><button type="button" class="quiet-btn" data-restore="${c.id}">Palauta</button></li>`).join('')}</ul><p class="grp-note">Palautus tuo keskustelun takaisin listaan; Pi ei käynnisty.</p>` : ''}</section>`; };
const counts = (w) => { const o = openConvs(w), t = wsd(w.id).wts.filter(x => x.st !== 'merged'); return [o.length ? plural(o.length, 'avoin keskustelu', 'avointa keskustelua') : 'ei avoimia keskusteluja', t.length ? plural(t.length, 'worktree-agentti', 'worktree-agenttia') : ''].filter(Boolean).join(' · '); };

// ---------- V1 · Keskustelut edellä ----------
function v1Body(w) {
  const d = wsd(w.id); const o = openConvs(w);
  return `<div class="wsp p1">
<div class="p1-head"><button type="button" class="gitline" data-git aria-haspopup="dialog" aria-expanded="${LAYER?.kind === 'git'}">${ICON_BRANCH}<span class="mono">${esc(d.branch)}</span>${d.files.length ? `<span class="g-dirty">${plural(d.files.length, 'muutos', 'muutosta')}</span>` : '<span class="g-ok">ei muutoksia</span>'}${syncIcons(d)}${CHEV}</button><span class="p1-sum">${counts(w)}</span></div>
<section class="grp" aria-labelledby="o-h"><h2 id="o-h" class="grp-h">Avoimet <span class="count">${o.length}</span></h2>${o.length ? `<div class="kgrid">${o.map(recapCard).join('')}</div>` : '<p class="grp-empty">Ei avoimia keskusteluja.</p>'}</section>
${wtGroup(w)}${doneGroup(w)}${archGroup(w)}</div>`;
}
// ---------- V2 · Git rinnalla ----------
function v2Body(w) {
  const d = wsd(w.id); const o = openConvs(w);
  return `<div class="wsp p2"><div class="p2-work">
<section class="grp" aria-labelledby="o-h"><h2 id="o-h" class="grp-h">Avoimet <span class="count">${o.length}</span></h2>${o.length ? `<ul class="xrs">${o.map(convRowX).join('')}</ul>` : '<p class="grp-empty">Ei avoimia keskusteluja.</p>'}</section>
${wtGroup(w)}${doneGroup(w)}${archGroup(w)}</div>
<aside class="p2-side" aria-label="Git ja työtila">
<section class="side-card"><h2 class="grp-h">Git</h2>${gitFacts(d)}<h3 class="side-h">Muutokset <span class="count plain">${d.files.length}</span></h3>${fileList(d)}<h3 class="side-h">Viimeisimmät commitit</h3>${commitList(d)}</section>
<section class="side-card"><h2 class="grp-h">Työtila</h2><dl class="side-facts"><dt>Polku</dt><dd><span class="mono">${esc(w.path)}</span><button type="button" class="icon-btn" data-copy-path aria-label="Kopioi polku" title="Kopioi polku">${ICON_COPY}</button></dd>${d.gh ? `<dt>GitHub</dt><dd><a href="#" class="mono" data-gh>${esc(d.gh)}</a></dd>` : '<dt>GitHub</dt><dd class="sub">ei GitHub-originia</dd>'}</dl></section>
</aside></div>`;
}
// ---------- V3 · Haaroittain ----------
function v3Body(w) {
  const d = wsd(w.id); const o = openConvs(w); const live = d.wts.filter(t => t.st !== 'merged'), merged = d.wts.filter(t => t.st === 'merged');
  return `<div class="wsp p3">
<section class="co main-co" aria-label="Päächeckout ${esc(d.branch)}"><header class="co-head">${ICON_BRANCH}<span class="mono co-branch">${esc(d.branch)}</span><span class="co-tag">päächeckout</span>${syncIcons(d)}<span class="grow"></span><span class="mono co-path">${esc(w.path)}</span></header>
<div class="co-git"><button type="button" class="fold small" data-fold="files" aria-expanded="${FOLD.files}">${CHEV}<span>${d.files.length ? plural(d.files.length, 'muutettu tiedosto', 'muutettua tiedostoa') : 'Ei muutoksia'}</span></button><span class="g-sync">${syncText(d)}</span><button type="button" class="fold small" data-fold="commits" aria-expanded="${FOLD.commits}">${CHEV}<span>Commitit</span></button></div>
${FOLD.files ? fileList(d) : ''}${FOLD.commits ? commitList(d) : ''}
<h2 class="grp-h">Keskustelut tässä checkoutissa <span class="count">${o.length}</span></h2>${o.length ? `<ul class="xrs">${o.map(convRowX).join('')}</ul>` : '<p class="grp-empty">Ei avoimia keskusteluja.</p>'}</section>
<section class="grp wt-grp" aria-labelledby="wt-h"><h2 id="wt-h" class="grp-h">${ICON_TREE}Worktree-agentit <span class="count">${d.wts.length}</span></h2>
${live.map(t => `<section class="co wt-co ${t.st}" aria-label="Worktree ${esc(t.branch)}"><header class="co-head">${ICON_BRANCH}<span class="mono co-branch">${esc(t.branch)}</span>${modeTag(t)}<span class="g-ahead" title="${t.ahead} committia edellä mainia">${ICON_UP}${t.ahead}</span><span class="grow"></span><span class="mono co-path">${esc(t.path)}</span></header><ul class="wts">${wtRow(t, { branch: false })}</ul></section>`).join('')}
${merged.length ? `<ul class="wts merged">${merged.map(t => wtRow(t)).join('')}</ul>` : ''}${d.wts.length ? '' : '<p class="grp-empty">Ei worktree-agentteja. Aloita sellainen <button type="button" class="linkish" data-plus-inline>+</button>-valikosta.</p>'}</section>
${doneGroup(w)}${archGroup(w)}</div>`;
}
const BODY = { v1: v1Body, v2: v2Body, v3: v3Body };

// ---------- Top bar on the workspace page ----------
function paintPageTop() {
  const w = ws();
  uiTop.innerHTML = `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button>
<div class="tb-title"><strong class="mono">${esc(w.id)}</strong><span class="tb-ws mono">${esc(w.path)}</span></div>
<div class="tb-right"><span class="tb-actions"><button type="button" class="icon-btn plus-btn" data-plus="top" aria-haspopup="menu" aria-expanded="${LAYER?.kind === 'plus' && LAYER.from === 'top'}" aria-label="Uusi työtilassa ${esc(w.id)}" title="Uusi keskustelu tai worktree-työ">${ICON_PLUS}</button><button type="button" class="icon-btn tb-btn" data-wsmore aria-haspopup="menu" aria-expanded="${LAYER?.kind === 'more'}" aria-label="Työtilan toiminnot" title="Työtilan toiminnot">${ICON_MORE}</button></span></div>`;
}
APP.painted.push(() => {
  uiFrame.classList.toggle('is-wspage', !!PAGE);
  uiRail.querySelectorAll('.ws-row').forEach(r => r.toggleAttribute('data-current', !!PAGE && r.querySelector('[data-ws-tog]').dataset.wsTog === PAGE));
  uiRail.querySelectorAll('.ws-add').forEach(b => { b.setAttribute('aria-haspopup', 'menu'); b.title = 'Uusi keskustelu tai worktree-työ'; });
  if (!PAGE) return;
  uiRail.querySelectorAll('.conv-row[aria-current]').forEach(a => a.removeAttribute('aria-current'));
  paintPageTop();
});

// ---------- Layers: "+", Git and the workspace menu ----------
const layer = document.createElement('div'); layer.className = 'wl'; layer.tabIndex = -1; layer.hidden = true; uiFrame.appendChild(layer);
const scrim = document.createElement('div'); scrim.className = 'wl-scrim'; scrim.hidden = true; uiFrame.appendChild(scrim);
const isPhone = () => uiFrame.getBoundingClientRect().width < 600;
function plusLayer(wsId) {
  const w = UI.ws.find(x => x.id === wsId); const d = wsd(wsId);
  const opt = (act, icon, title, sub, extra = '') => `<button type="button" role="menuitem" class="wl-opt" data-new="${act}:${wsId}"${extra}><span class="wl-ic">${icon}</span><span class="wl-txt"><strong>${title}</strong><small>${sub}</small></span></button>`;
  return `<div class="wl-head"><span>Uusi työtilassa <span class="mono">${esc(w.id)}</span></span><button type="button" class="icon-btn wl-x" data-wl-close aria-label="Sulje" title="Sulje">${ICON_CLOSE}</button></div>
<div class="wl-sec">Tässä hakemistossa</div>
${opt('conv', ICON_CHAT, 'Keskustelu', `Pi<span class="sep">·</span><span class="mono">gpt-5.5</span><span class="sep">·</span>high<span class="sep">·</span><span class="mono">${esc(d.branch)}</span>`)}
<div class="wl-sec">Omassa worktreessa <span class="wl-note">Taskfleet tekee haaran ja worktreen</span></div>
${opt('wt-int', ICON_TREE, 'Interaktiivinen worktree-agentti', 'Oma haara; sinä päätät, milloin se mergetään')}
${opt('wt-self', ICON_MERGE, 'Itse mergeävä agentti', `Tekee työn, ajaa testit ja mergeää <span class="mono">${esc(d.branch)}</span>-haaraan`)}`;
}
function gitLayer() { const d = wsd(PAGE); return `<div class="wl-head"><span>Git</span><button type="button" class="icon-btn wl-x" data-wl-close aria-label="Sulje" title="Sulje">${ICON_CLOSE}</button></div><div class="wl-git">${gitFacts(d)}<h3 class="side-h">Muutokset <span class="count plain">${d.files.length}</span></h3>${fileList(d)}<h3 class="side-h">Viimeisimmät commitit</h3>${commitList(d)}</div>`; }
function moreLayer() {
  const w = ws(); const d = wsd(w.id);
  const it = (act, icon, label, extra = '') => `<button type="button" role="menuitem" data-wm="${act}">${icon}<span>${label}</span>${extra}</button>`;
  return `${it('copy', ICON_COPY, 'Kopioi polku', `<span class="kbd mono">${esc(w.path)}</span>`)}${d.gh ? it('gh', ICON_EXT, 'Avaa GitHubissa') : ''}<hr>${it('rename', ICON_PEN, 'Muuta näyttönimeä…')}${it('hide', ICON_EYE_OFF, 'Piilota sivupalkista')}<hr><button type="button" role="menuitem" class="danger" aria-disabled="true" title="Palautettava poisto suunnitellaan ensin (recoverable-workspace-deletion).">${ICON_TRASH}<span>Poista työtila…</span><span class="why">tulossa</span></button>`;
}
function openLayer(kind, anchor, opts = {}) {
  if (LAYER && LAYER.kind === kind && LAYER.from === opts.from) return closeLayer();
  LAYER = { kind, from: opts.from, ws: opts.ws ?? PAGE, anchor };
  layer.className = `wl wl-${kind}`; layer.setAttribute('role', kind === 'git' ? 'dialog' : 'menu');
  layer.setAttribute('aria-label', kind === 'plus' ? `Uusi työtilassa ${LAYER.ws}` : kind === 'git' ? 'Git' : 'Työtilan toiminnot');
  layer.innerHTML = kind === 'plus' ? plusLayer(LAYER.ws) : kind === 'git' ? gitLayer() : moreLayer();
  layer.hidden = false; const sheet = isPhone() && kind !== 'more'; layer.classList.toggle('sheet', sheet); scrim.hidden = !sheet;
  place(); syncExpanded();
  (layer.querySelector('[role="menuitem"]:not([aria-disabled])') || layer).focus({ preventScroll: true });
}
function place() {
  if (!LAYER || layer.classList.contains('sheet')) { layer.style.left = layer.style.top = ''; return; }
  const f = uiFrame.getBoundingClientRect(), a = LAYER.anchor.getBoundingClientRect(), wd = layer.offsetWidth;
  if (LAYER.from === 'rail') { layer.dataset.place = 'right'; layer.style.left = Math.min(a.right - f.left + 6, f.width - wd - 8) + 'px'; layer.style.top = Math.max(8, Math.min(a.top - f.top - 6, f.height - layer.offsetHeight - 8)) + 'px'; return; }
  const right = LAYER.from === 'top' || LAYER.kind === 'more';
  layer.dataset.place = right ? 'down-right' : 'down';
  layer.style.left = Math.max(8, Math.min(right ? a.right - f.left - wd : a.left - f.left, f.width - wd - 8)) + 'px';
  layer.style.top = (a.bottom - f.top + 6) + 'px';
}
function closeLayer(focusBack = false) {
  if (!LAYER) return; const a = LAYER.anchor; LAYER = null; layer.hidden = true; scrim.hidden = true; syncExpanded();
  if (focusBack && a?.isConnected) a.focus({ preventScroll: true });
}
function syncExpanded() {
  document.querySelectorAll('[data-plus], [data-git], [data-wsmore], .ws-add').forEach(b => {
    const on = !!LAYER && b === LAYER.anchor; b.setAttribute('aria-expanded', on);
  });
}

// ---------- Rendering ----------
function render() {
  if (!PAGE) return;
  const top = stage.scrollTop; following = false;
  stage.innerHTML = BODY[CUR](ws());
  stage.scrollTop = top; lastTop = stage.scrollTop;
}
function showPage(id) {
  PAGE = id; UI.drawer = false; UI.pop = false; OPEN.clear(); closeLayer();
  paint(); following = false; stage.innerHTML = BODY[CUR](ws()); stage.scrollTop = 0; lastTop = 0;
}
function startConv(wsId) {
  const w = UI.ws.find(x => x.id === wsId); const id = `n${++UI.created}`;
  w.convs.unshift({ id, title: 'Uusi keskustelu', st: 'new' }); w.open = true;
  PAGE = null; closeLayer(); openConv(id);
}

// ---------- Name dialog ----------
const nameDlg = document.createElement('dialog'); nameDlg.className = 'confirm wsp-name'; document.body.appendChild(nameDlg);
nameDlg.addEventListener('close', () => {
  if (nameDlg.returnValue !== 'ok') return;
  const v = nameDlg.querySelector('input').value.trim(); if (!v) return;
  toast(`Näyttönimi on nyt "${v}". Hakemisto ${ws().path} ei muutu.`);
});

// ---------- Clicks ----------
// Window capture runs before the library's document listeners, so the workspace name, the
// sidebar "+" and the …-menu's "Avaa työtilasivu" can open this page and layer.
window.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.closest('.proto-picker')) return;
  const stop = () => { e.preventDefault(); e.stopPropagation(); };
  const wsName = t.closest('.ws-name[data-ui="ws"]');
  if (wsName) { stop(); return showPage(wsName.closest('.ws').querySelector('[data-ws-tog]').dataset.wsTog); }
  const tbWs = t.closest('.tb-ws[data-ui="ws"]');
  if (tbWs) { stop(); return showPage(selConv().ws.id); }
  const railAdd = t.closest('[data-ws-add]');
  if (railAdd) { stop(); return openLayer('plus', railAdd, { from: 'rail', ws: railAdd.dataset.wsAdd }); }
  const wsp = t.closest('.p-menu [data-p="wspage"]');
  if (wsp) { const id = wsp.closest('.p-menu').querySelector('[data-p^="new:"]').dataset.p.slice(4); setTimeout(() => { uiToast.classList.remove('on'); showPage(id); }); return; }
  if (t.closest('[data-conv]')) { PAGE = null; closeLayer(); return; }

  const hit = t.closest('[data-plus], [data-plus-inline], [data-git], [data-wsmore], [data-new], [data-wl-close], [data-wm], .wl [aria-disabled="true"], [data-x], [data-fold], [data-wt], [data-restore], [data-copy-path], [data-gh]');
  if (!hit) { if (LAYER && !t.closest('.wl')) closeLayer(); return; }
  stop();
  const d = hit.dataset;
  if (d.plus) return openLayer('plus', hit, { from: 'top' });
  if (d.plusInline !== undefined) return openLayer('plus', uiTop.querySelector('[data-plus]'), { from: 'top' });
  if (d.git !== undefined) return openLayer('git', hit, { from: 'page' });
  if (d.wsmore !== undefined) return openLayer('more', hit, { from: 'top' });
  if (d.wlClose !== undefined) return closeLayer(true);
  if (hit.getAttribute('aria-disabled') === 'true') return toast(hit.title);
  if (d.new) {
    const [kind, wsId] = d.new.split(':');
    if (kind === 'conv') return startConv(wsId);
    closeLayer();
    return toast(kind === 'wt-int' ? 'Interaktiivisen worktree-agentin aloitus: kierros proto-worktree-agents.' : 'Itse mergeävän agentin aloitus: kierros proto-worktree-agents.');
  }
  if (d.wm) {
    const w = ws(); closeLayer();
    if (d.wm === 'copy') { try { await navigator.clipboard.writeText(w.path); } catch {} return toast(`Kopioitu ${w.path}`); }
    if (d.wm === 'gh') return toast(`Avautuisi github.com/${wsd(w.id).gh}`);
    if (d.wm === 'hide') return toast(`${w.id} piilotettaisiin sivupalkista; se löytyy Asetuksista ja säilyy levyllä.`);
    if (d.wm === 'rename') { nameDlg.innerHTML = `<form method="dialog"><h3>Työtilan näyttönimi</h3><label class="fld"><span>Näyttönimi</span><input value="${esc(w.id)}" autocomplete="off"></label><p class="hint">Vain tämän näkymän nimi; hakemisto <span class="mono">${esc(w.path)}</span> pysyy ennallaan.</p><div class="confirm-actions"><button class="secondary" value="cancel" formnovalidate>Peruuta</button><button class="primary" value="ok">Tallenna</button></div></form>`; nameDlg.showModal(); nameDlg.querySelector('input').select(); return; }
  }
  if (d.x) { OPEN.has(d.x) ? OPEN.delete(d.x) : OPEN.add(d.x); return render(); }
  if (d.fold) { FOLD[d.fold] = !FOLD[d.fold]; return render(); }
  if (d.wt) return toast('Worktree-agentin keskustelu ja tilat: kierros proto-worktree-agents.');
  if (d.restore) {
    const c = ws().convs.find(x => x.id === d.restore);
    if (c) { c.archived = false; paint(); render(); return toast(`${c.title} palautettu listaan.`); }
    const a = wsd(PAGE).archived; const i = a.findIndex(x => x.id === d.restore); const [r] = a.splice(i, 1);
    ws().convs.push({ id: r.id, title: r.title, st: 'done' }); DONE_T[r.id] = r.t; paint(); render();
    return toast(`${r.title} palautettu valmiisiin. Pi ei käynnistynyt.`);
  }
  if (d.copyPath !== undefined) { try { await navigator.clipboard.writeText(ws().path); } catch {} return toast(`Kopioitu ${ws().path}`); }
  if (d.gh !== undefined) return toast(`Avautuisi github.com/${wsd(PAGE).gh}`);
}, true);
window.addEventListener('keydown', (e) => {
  if (!LAYER) return;
  if (e.key === 'Escape') { e.stopPropagation(); return closeLayer(true); }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const bs = [...layer.querySelectorAll('[role="menuitem"]:not([aria-disabled])')]; if (!bs.length) return;
    e.preventDefault(); const i = bs.indexOf(document.activeElement);
    bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus();
  }
}, true);
new ResizeObserver(() => { if (LAYER) { const sheet = isPhone() && LAYER.kind !== 'more'; layer.classList.toggle('sheet', sheet); scrim.hidden = !sheet; place(); } }).observe(uiFrame);
scrim.addEventListener('click', () => closeLayer());

const show = (v) => () => { CUR = v; PAGE = PAGE || 'aurinkokello'; UI.pop = false; closeLayer(); paint(); following = false; requestAnimationFrame(() => { stage.scrollTop = 0; lastTop = 0; }); return BODY[v](ws()); };
window.v1 = show('v1'); window.v2 = show('v2'); window.v3 = show('v3');
})();
