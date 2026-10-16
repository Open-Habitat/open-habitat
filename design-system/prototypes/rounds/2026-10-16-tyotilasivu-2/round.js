// Koko työtilasivu ilman kontekstivalikoita (proto-workspace-page-2, 16.10.2026). Sivu
// avautuu sivupalkin työtilan nimestä ja keskustelun yläpalkin työtilalinkistä. Sivupalkin
// työtilarivillä on vain nimi ja +, joka luo keskustelun suoraan (kirjaston toiminta);
// kirjaston …-valikko poistetaan rivistä. Sivun otsake on tuotannon tapaan sivulla itsellään,
// ja yläpalkki näkyy vain puhelimessa valikkopainikkeen vuoksi. Suunnat eroavat vain siinä,
// missä työtilan omat toiminnot ovat; muu sivu on sama.
(() => {
const ICON_BRANCH = SVG('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10"/><path d="M18 10c0 4-6 3-12 7"/>');
const ICON_COPY = SVG('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>');
const ICON_EXT = SVG('<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/>');
const ICON_GH = SVG('<path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>');
const ICON_TRASH = SVG('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>');
const ICON_EYE_OFF = SVG('<path d="M3 3l18 18"/><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-2.6 3.2M6.4 7.4C4.3 8.9 3 12 3 12s4 6 9 6a8.6 8.6 0 0 0 3.6-.8"/><path d="M9.9 10a3 3 0 0 0 4.1 4.1"/>');
const ICON_EYE = SVG('<path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.6"/>');
const ICON_PEN = SVG('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>');
const ICON_UP = SVG('<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>');
const ICON_DOWN = SVG('<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>');
const ICON_ARCH = SVG('<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>');
const ICON_FWD = SVG('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>');
const ICON_TERM = SVG('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3"/><path d="M12 15h5"/>');

// ---------- Synthetic workspace facts ----------
// Git comes from native git in the checkout (the implemented read-only endpoint); recaps are
// each conversation's own tilannekatsaus; waiting states come from pi-processes and Taskfleet
// as in 2026-10-16-prosessilohkot and -spinoffit.
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
    archived: [{ id: 'a1', title: 'Vanha deploy-skripti', t: '2.10.' }, { id: 'a2', title: 'Kokeilu: laskenta Rustilla', t: '28.9.' }],
  },
  issuectl: {
    gh: 'jarimustonen/issuectl', branch: 'search-negation', upstream: 'origin/search-negation', ahead: 3, behind: 1, fetched: '25 min sitten',
    files: [],
    commits: [
      { h: '5e0a771', s: 'Haku: NOT-avainsana jäsentimeen', t: '25 min', local: true },
      { h: 'c39d2b4', s: 'Haku: -label:bug -muoto', t: '40 min', local: true },
      { h: '9a6e3c0', s: 'JSON-skeeman versio 3', t: 'eilen' },
    ],
    archived: [{ id: 'a3', title: 'Lanejen järjestys', t: '30.9.' }],
  },
  fleetrepo: { gh: null, branch: 'main', upstream: null, ahead: 0, behind: 0, fetched: null, files: [], commits: [{ h: '1f2e3d4', s: 'Varmuuskopioiden ajastus', t: '3.10.' }], archived: [] },
};
const wsd = (id) => WSD[id] || (WSD[id] = { gh: null, branch: 'main', upstream: null, ahead: 0, behind: 0, fetched: null, files: [], commits: [{ h: '1f2e3d4', s: 'Ensimmäinen commit', t: '1.10.' }], archived: [] });

// The new waiting states (Jari 16.10.: "Odotan …"; the spinoff wait's dot blinks).
STATES.procwait = ['Odottaa prosessia', `<span class="st-proc">${ICON_TERM}</span>`];
STATES.spinwait = ['Odottaa spinoffia', '<span class="st-dot spinwait"></span>'];
STATE_ORDER.procwait = 1.4; STATE_ORDER.spinwait = 1.5;
const aur = UI.ws.find(w => w.id === 'aurinkokello');
aur.convs.splice(1, 0,
  { id: 'p1', title: 'Julkaisu 0.4: valmistelu', st: 'spinwait' },
  { id: 'c9', title: 'Testiajon nopeutus', st: 'procwait' },
  { id: 'c12', title: 'Kuukausinäkymän tulostus', st: 'working' });
const REC = {
  c1: { age: '1 min', recap: 'Skripti `scripts/status_rows.py` lukee `status.md`:n taulukon ja tulostaa viime viikon rivit. `--since` antaa rajan käsin, ja `--today` tekee päivästä testattavan; testit menevät läpi.', next: 'Kerro, lisätäänkö JSON-tuloste samaan ajoon vai omaksi lipukseen.' },
  c2: { age: '8 min', recap: 'Kuvat `assets/photos/` muunnettiin WebP-muotoon laadulla 82: 214 kuvaa, yhteensä 38 Mt → 11 Mt. `build.sh` käyttää nyt `.webp`-tiedostoja. Alkuperäiset ovat yhä paikallaan.', next: 'Päätä, poistetaanko alkuperäiset vai siirretäänkö ne `originals/`-hakemistoon.' },
  p1: { age: '4 min', recap: 'Julkaisuun 0.4 lähti neljä spinoffia. README-esimerkit on mergetty, ja aikavyöhykkeen spinoff odottaa mergeä. CI-aikakatkaisun korjaus ei mergeytynyt; työ on tallessa.', next: 'Jatkan itse, kun pip-välimuisti on valmis: mergeän odottavan ja kirjoitan muutoslokin.' },
  c9: { age: '12 min', recap: 'Hitaimmat testit ovat `tests/test_almanac.py`:ssä: vuoden taulukko lasketaan joka testissä uudelleen. Siirsin laskennan fixtureen.', next: 'Jatkan itse, kun vertailuajo päättyy, ja kerron ajat ennen ja jälkeen.' },
  c12: { age: 'nyt', recap: 'Kuukausinäkymä tulostaa viikot riveinä. Viikkonumerot tulevat ISO 8601:n mukaan.', next: '' },
  c10: { age: '25 min', recap: 'Hakusyntaksiin lisättiin negaatio. Jäsennin hyväksyy jo molemmat muodot, mutta dokumentaatioon ja virheviesteihin pitää valita yksi.', next: 'Valitse muoto, niin päivitän README:n ja virheviestit.' },
  c4: { age: '3 t', recap: 'Syklin tunnistus toimii pienissä graafeissa. Suuressa graafissa ajo keskeytyi, eikä prosessin tilaa ole sen jälkeen saatu luettua.', next: 'Tarkista, onko Pi yhä käynnissä terminaalissa.' },
  c5: { age: '14 min', recap: 'Kiintiönäkymän tekstit on kirjoitettu uudelleen; Storybookin tarinat on päivitetty.', next: '' },
};
// What the conversation is doing or waiting for, in the agent's own words (production's
// waitingSummary and activity line).
const DOING = {
  p1: () => `Odotan spinoffia <strong>CI:n pip-välimuisti</strong> · jatkan itse, kun se valmistuu.`,
  c9: () => `Odotan: <span class="mono">vertailuajo</span> · jatkan itse, kun se päättyy.`,
  c12: () => `Ajaa <span class="mono">python -m aurinkokello month</span>`,
  c5: () => `Ajaa <span class="mono">npm test</span>`,
};
const DONE_T = { c3: 'eilen', c7: 'ma', c8: '9.10.', c11: '8.10.', c6: '3.10.' };

let PAGE = null, CUR = 'v1', LAYER = null, EDIT = false;
const FOLD = { done: false, arch: false };
const LABEL = {}, HIDDEN = new Set();
const ws = () => UI.ws.find(w => w.id === PAGE);
const label = (w) => LABEL[w.id] ?? w.id;
const st = (c) => convState(c);
const mark = (s) => { const [l, m] = STATES[s] ?? ['Ei aloitettu', '<span class="st-none"></span>']; return `<span class="st" role="img" aria-label="${l}" title="${l}">${m}</span>`; };
const openConvs = (w) => w.convs.filter(c => !c.archived && st(c) !== 'done').sort((a, b) => (STATE_ORDER[st(a)] ?? 4) - (STATE_ORDER[st(b)] ?? 4));
const doneConvs = (w) => w.convs.filter(c => !c.archived && st(c) === 'done');
const archConvs = (w) => [...w.convs.filter(c => c.archived).map(c => ({ id: c.id, title: c.title, t: 'juuri nyt', live: true })), ...wsd(w.id).archived];
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const DELETE_WHY = 'Palautettava poisto suunnitellaan ensin (recoverable-workspace-deletion).';
const HIDE_WHY = 'Työtila katoaa sivupalkista. Se löytyy Asetuksista ja säilyy levyllä.';

// ---------- Sidebar: name and + only ----------
// The library's account.js adds the …-menu to every workspace row; this round removes it,
// hides the hidden workspaces and shows display names.
const libPaintRail = window.paintRail;
window.paintRail = function () {
  libPaintRail();
  uiRail.querySelectorAll('.ws-more').forEach(b => b.remove());
  uiRail.querySelectorAll('.ws').forEach(s => {
    const id = s.querySelector('[data-ws-tog]').dataset.wsTog;
    if (HIDDEN.has(id)) { s.remove(); return; }
    if (LABEL[id]) s.querySelector('.ws-name').textContent = LABEL[id];
    s.querySelector('.ws-row').toggleAttribute('data-current', PAGE === id);
  });
};

// ---------- Git ----------
const syncText = (d) => !d.upstream ? 'ei etärepoa' : d.ahead || d.behind ? [d.ahead ? `${d.ahead} edellä` : '', d.behind ? `${d.behind} jäljessä` : ''].filter(Boolean).join(', ') + ` ${d.upstream}` : `ajan tasalla ${d.upstream}`;
const syncIcons = (d) => `${d.ahead ? `<span class="g-ahead" title="${d.ahead} committia ei ole vielä originissa">${ICON_UP}${d.ahead}</span>` : ''}${d.behind ? `<span class="g-behind" title="${d.behind} committia originissa, joita täällä ei ole">${ICON_DOWN}${d.behind}</span>` : ''}`;
const fileList = (d) => d.files.length ? `<ul class="g-files">${d.files.map(([s, p, n]) => `<li><span class="g-fs g-${s === '?' ? 'new' : s === 'D' ? 'del' : 'mod'}" title="${s === '?' ? 'Uusi, ei vielä Gitissä' : s === 'D' ? 'Poistettu' : 'Muutettu'}">${s === '?' ? 'U' : s}</span><span class="mono">${esc(p)}</span><span class="g-n">${n}</span></li>`).join('')}</ul>` : '<p class="g-clean">Ei muutoksia; työhakemisto vastaa viimeisintä committia.</p>';
const commitList = (d) => `<ul class="g-commits">${d.commits.map(c => `<li><span class="mono g-h">${c.h}</span><span class="g-s">${esc(c.s)}</span>${c.local ? '<span class="g-local" title="Ei vielä originissa">paikallinen</span>' : ''}<time>${c.t}</time></li>`).join('')}</ul>`;
const gitFacts = (d) => `<p class="g-branch">${ICON_BRANCH}<span class="mono">${esc(d.branch)}</span>${syncIcons(d)}<span class="g-sync">${syncText(d)}</span></p>${d.fetched ? `<p class="g-fetched">Viimeisin kirjattu haku ${d.fetched}</p>` : ''}`;
const gitPill = (d) => `<button type="button" class="gitline" data-git aria-haspopup="dialog" aria-expanded="${LAYER === 'git'}">${ICON_BRANCH}<span class="mono">${esc(d.branch)}</span>${d.files.length ? `<span class="g-dirty">${plural(d.files.length, 'muutos', 'muutosta')}</span>` : ''}${syncIcons(d)}${CHEV}</button>`;

// ---------- Work: recap cards, Valmiit, Arkisto ----------
const archBlock = (c) => ({ working: 'Agentti työskentelee. Arkistoi, kun vuoro on päättynyt.', procwait: 'Agentti odottaa prosessia ja jatkaa itse. Arkistoi, kun se on valmis.', spinwait: 'Agentti odottaa spinoffia ja jatkaa itse. Arkistoi, kun se on valmis.' })[st(c)];
function recapCard(c) {
  const r = REC[c.id] || { age: 'nyt', recap: 'Keskustelulla ei vielä ole tilannekatsausta.', next: '' }; const s = st(c);
  const why = archBlock(c);
  const doing = DOING[c.id] ? `<p class="kc-doing ${s}">${DOING[c.id]()}</p>` : '';
  return `<article class="kc ${s}" data-card="${c.id}"><div class="kc-head">${mark(s)}<a href="#" class="kc-title" data-conv="${c.id}">${esc(c.title)}</a><button type="button" class="icon-btn kc-arch" data-archive="${c.id}" aria-label="Arkistoi ${esc(c.title)}" title="${why ?? 'Arkistoi'}"${why ? ' aria-disabled="true"' : ''}>${ICON_ARCH}</button></div>
<p class="kc-meta"><span class="kc-st ${s}">${(STATES[s] ?? ['Ei aloitettu'])[0]}</span><time>${r.age === 'nyt' ? 'nyt' : r.age + ' sitten'}</time></p>${doing}
<p class="k-text">${inline(r.recap)}</p>${r.next ? `<p class="k-next"><span class="k-label">Seuraavaksi</span><span>${inline(r.next)}</span></p>` : ''}
<a href="#" class="kc-go" data-conv="${c.id}">${s === 'attention' ? 'Lue vastaus' : s === 'waiting' ? 'Vastaa' : 'Avaa'}${ICON_FWD}</a></article>`;
}
const doneGroup = (w) => { const d = doneConvs(w); if (!d.length) return ''; return `<section class="grp"><button type="button" class="fold" data-fold="done" aria-expanded="${FOLD.done}">${CHEV}<span>Valmiit</span><span class="count plain">${d.length}</span></button>${FOLD.done ? `<ul class="rows">${d.map(c => `<li><a href="#" class="row" data-conv="${c.id}">${mark('done')}<span class="row-title">${esc(c.title)}</span><time>${DONE_T[c.id] ?? ''}</time></a></li>`).join('')}</ul>` : ''}</section>`; };
const archGroup = (w) => { const a = archConvs(w); if (!a.length) return ''; return `<section class="grp" id="arch-grp"><button type="button" class="fold" data-fold="arch" aria-expanded="${FOLD.arch}">${CHEV}<span>Arkisto</span><span class="count plain">${a.length}</span></button>${FOLD.arch ? `<ul class="rows">${a.map(c => `<li class="row arch">${ICON_ARCH}<span class="row-title">${esc(c.title)}</span><time>${c.t}</time><button type="button" class="quiet-btn" data-restore="${c.id}">Palauta</button></li>`).join('')}</ul><p class="grp-note">Palautus tuo keskustelun takaisin listaan; Pi ei käynnisty.</p>` : ''}</section>`; };
function summary(w) {
  const o = openConvs(w); const n = (f) => o.filter(c => f(st(c))).length;
  const you = n(s => s === 'waiting' || s === 'attention'), work = n(s => s === 'working'), bg = n(s => s === 'procwait' || s === 'spinwait');
  if (!o.length) return 'ei avoimia keskusteluja';
  return [you ? `<strong>${you} odottaa sinua</strong>` : 'mikään ei odota sinua', work ? `${work} työskentelee` : '', bg ? `${bg} odottaa prosessia tai spinoffia` : ''].filter(Boolean).join(' · ');
}
function work(w) {
  const o = openConvs(w);
  return `<section class="grp" aria-labelledby="o-h"><h2 id="o-h" class="grp-h">Avoimet <span class="count">${o.length}</span></h2>${o.length ? `<div class="kgrid">${o.map(recapCard).join('')}</div>` : '<p class="grp-empty">Ei avoimia keskusteluja. Aloita uusi +-painikkeesta.</p>'}</section>${doneGroup(w)}${archGroup(w)}`;
}

// ---------- Head pieces ----------
const plusBtn = (w) => `<button type="button" class="icon-btn plus-btn" data-newconv aria-label="Uusi keskustelu työtilassa ${esc(label(w))}" title="Uusi keskustelu">${ICON_PLUS}</button>`;
const hiddenTag = (w) => HIDDEN.has(w.id) ? `<span class="wh-hidden">${ICON_EYE_OFF}Piilotettu sivupalkista<button type="button" class="linkbtn" data-wa="unhide">Näytä</button></span>` : '';
const nameEdit = (w) => `<form class="wh-edit" data-nameform><label class="sr" for="wname">Näyttönimi</label><input id="wname" class="mono" value="${esc(label(w))}" autocomplete="off" spellcheck="false"><button type="submit" class="mini primary">Tallenna</button><button type="button" class="mini" data-wa="cancel">Peruuta</button></form>`;
const nameNote = (w) => `<p class="wh-note">Vain näkymän nimi; hakemisto <span class="mono">${esc(w.path)}</span> ei muutu.</p>`;
const ghHref = (d) => `github.com/${d.gh}`;

// ---------- V1 · Asioiden vieressä ----------
function v1Head(w, d) {
  return `<header class="wh">
<div class="wh-id">${EDIT ? nameEdit(w) + nameNote(w) : `<h1>${esc(label(w))}<button type="button" class="icon-btn wh-pen" data-wa="rename" aria-label="Muuta näyttönimeä" title="Muuta näyttönimeä">${ICON_PEN}</button></h1>`}
<p class="wh-path"><span class="mono">${esc(w.path)}</span><button type="button" class="icon-btn wh-mini" data-wa="copy" aria-label="Kopioi polku" title="Kopioi polku">${ICON_COPY}</button>${d.gh ? `<span class="wh-sep" aria-hidden="true">·</span><a href="#" class="wh-gh" data-wa="gh" title="Avaa GitHubissa">${ICON_GH}<span class="mono">${esc(d.gh)}</span>${ICON_EXT}</a>` : ''}</p>${hiddenTag(w)}</div>
<div class="wh-act">${plusBtn(w)}</div></header>`;
}
function v1Foot(w) {
  return `<footer class="wf"><span class="wf-label">Työtila</span>${HIDDEN.has(w.id) ? `<button type="button" class="quiet-btn" data-wa="unhide">${ICON_EYE}Näytä sivupalkissa</button>` : `<button type="button" class="quiet-btn" data-wa="hide" title="${HIDE_WHY}">${ICON_EYE_OFF}Piilota sivupalkista</button>`}<button type="button" class="quiet-btn is-danger" data-wa="delete" aria-disabled="true" aria-describedby="del-why">${ICON_TRASH}Poista työtila…</button><span id="del-why" class="wf-why">Tulossa: palautettava poisto.</span></footer>`;
}
// ---------- V2 · Ikonirivi ----------
function v2Head(w, d) {
  const b = (act, icon, lab, extra = '') => `<button type="button" class="icon-btn tb-btn" data-wa="${act}" aria-label="${lab}" title="${lab}"${extra}>${icon}</button>`;
  const hidden = HIDDEN.has(w.id);
  return `<header class="wh">
<div class="wh-id"><h1>${esc(label(w))}</h1><p class="wh-path"><span class="mono">${esc(w.path)}</span></p>${hiddenTag(w)}</div>
<div class="wh-act" role="toolbar" aria-label="Työtilan toiminnot">${b('copy', ICON_COPY, 'Kopioi polku')}${d.gh ? b('gh', ICON_GH, `Avaa GitHubissa · ${d.gh}`) : `<button type="button" class="icon-btn tb-btn" data-wa="gh" aria-label="Avaa GitHubissa" title="Työtilalla ei ole GitHub-originia." aria-disabled="true">${ICON_GH}</button>`}${b('rename-dlg', ICON_PEN, 'Muuta näyttönimeä…')}${b(hidden ? 'unhide' : 'hide', hidden ? ICON_EYE : ICON_EYE_OFF, hidden ? 'Näytä sivupalkissa' : 'Piilota sivupalkista', ` aria-pressed="${hidden}"`)}<button type="button" class="icon-btn tb-btn is-danger" data-wa="delete" aria-label="Poista työtila…" title="${DELETE_WHY}" aria-disabled="true">${ICON_TRASH}</button><span class="wh-div" aria-hidden="true"></span>${plusBtn(w)}</div></header>`;
}
// ---------- V3 · Työtila-osio ----------
function v3Head(w) {
  return `<header class="wh"><div class="wh-id"><h1>${esc(label(w))}</h1><p class="wh-path"><span class="mono">${esc(w.path)}</span></p>${hiddenTag(w)}</div><div class="wh-act">${plusBtn(w)}</div></header>`;
}
function v3Section(w, d) {
  const hidden = HIDDEN.has(w.id);
  const row = (k, v, act) => `<div class="ts-row"><dt>${k}</dt><dd><span class="ts-v">${v}</span>${act}</dd></div>`;
  const qb = (a, icon, t, extra = '') => `<button type="button" class="quiet-btn" data-wa="${a}"${extra}>${icon}${t}</button>`;
  return `<section class="grp ts" aria-labelledby="ts-h"><h2 id="ts-h" class="grp-h">Työtila</h2><dl class="ts-list">
${row('Näyttönimi', EDIT ? nameEdit(w) : `<span class="mono">${esc(label(w))}</span>`, EDIT ? '' : qb('rename', ICON_PEN, 'Muuta'))}
${row('Polku', `<span class="mono">${esc(w.path)}</span>`, qb('copy', ICON_COPY, 'Kopioi'))}
${row('GitHub', d.gh ? `<span class="mono">${esc(d.gh)}</span>` : '<span class="sub">ei GitHub-originia</span>', d.gh ? qb('gh', ICON_EXT, 'Avaa') : '')}
${row('Sivupalkissa', hidden ? '<span class="sub">piilotettu; löytyy myös Asetuksista</span>' : 'näkyy', hidden ? qb('unhide', ICON_EYE, 'Näytä') : qb('hide', ICON_EYE_OFF, 'Piilota', ` title="${HIDE_WHY}"`))}
${row('Poisto', '<span class="sub">Tulossa: palautettava poisto, jossa työtilan voi palauttaa.</span>', `<button type="button" class="quiet-btn is-danger" data-wa="delete" aria-disabled="true" title="${DELETE_WHY}">${ICON_TRASH}Poista…</button>`)}
</dl></section>`;
}

function body(w) {
  const d = wsd(w.id);
  const head = CUR === 'v1' ? v1Head(w, d) : CUR === 'v2' ? v2Head(w, d) : v3Head(w);
  return `<div class="wsp ${CUR}">${head}<div class="wh-git">${gitPill(d)}<span class="wh-sum">${summary(w)}</span></div>
${work(w)}${CUR === 'v1' ? v1Foot(w) : CUR === 'v3' ? v3Section(w, d) : ''}</div>`;
}

// ---------- Top bar: only the phone's menu button and the name ----------
APP.painted.push(() => {
  uiFrame.classList.toggle('is-wspage', !!PAGE);
  if (!PAGE) return;
  uiRail.querySelectorAll('.conv-row[aria-current]').forEach(a => a.removeAttribute('aria-current'));
  uiTop.innerHTML = `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button><div class="tb-title"><strong class="mono">${esc(label(ws()))}</strong></div>`;
});

// ---------- Git layer (anchored on desktop, bottom sheet on the phone) ----------
const layer = document.createElement('div'); layer.className = 'wl'; layer.tabIndex = -1; layer.hidden = true; layer.setAttribute('role', 'dialog'); layer.setAttribute('aria-label', 'Git'); uiFrame.appendChild(layer);
const scrim = document.createElement('div'); scrim.className = 'wl-scrim'; scrim.hidden = true; uiFrame.appendChild(scrim);
const isPhone = () => uiFrame.getBoundingClientRect().width < 600;
function openGit(anchor) {
  if (LAYER) return closeGit(true);
  LAYER = 'git'; const d = wsd(PAGE);
  layer.innerHTML = `<div class="wl-head"><span>Git · <span class="mono">${esc(label(ws()))}</span></span><button type="button" class="icon-btn wl-x" data-wl-close aria-label="Sulje" title="Sulje">${ICON_CLOSE}</button></div><div class="wl-git">${gitFacts(d)}<h3 class="side-h">Muutokset <span class="count plain">${d.files.length}</span></h3>${fileList(d)}<h3 class="side-h">Viimeisimmät commitit</h3>${commitList(d)}</div>`;
  layer.hidden = false; place(anchor); anchor.setAttribute('aria-expanded', 'true'); layer.focus({ preventScroll: true });
}
function place(anchor = stage.querySelector('[data-git]')) {
  const sheet = isPhone(); layer.classList.toggle('sheet', sheet); scrim.hidden = !sheet;
  if (sheet || !anchor) { layer.style.left = layer.style.top = ''; return; }
  const f = uiFrame.getBoundingClientRect(), a = anchor.getBoundingClientRect();
  layer.style.left = Math.max(8, Math.min(a.left - f.left, f.width - layer.offsetWidth - 8)) + 'px';
  layer.style.top = (a.bottom - f.top + 6) + 'px';
}
function closeGit(focusBack = false) {
  if (!LAYER) return; LAYER = null; layer.hidden = true; scrim.hidden = true;
  const a = stage.querySelector('[data-git]'); a?.setAttribute('aria-expanded', 'false'); if (focusBack) a?.focus({ preventScroll: true });
}
scrim.addEventListener('click', () => closeGit());
stage.addEventListener('scroll', () => { if (LAYER && !isPhone()) closeGit(); });
new ResizeObserver(() => { if (LAYER) place(); }).observe(uiFrame);

// ---------- Hetki alhaalla: the floating notice (archive and hide share it) ----------
const LIFE = 8000; let NOTE = null;
function notice(text, act, undo) {
  NOTE?.el.remove(); clearTimeout(NOTE?.timer);
  const el = document.createElement('div'); el.className = 'an an-snack'; el.setAttribute('role', 'status');
  el.innerHTML = `<span class="an-text">${text}</span><button class="an-act" type="button">${act}</button><button class="icon-btn an-x" type="button" aria-label="Sulje ilmoitus" title="Sulje">${ICON_CLOSE}</button>`;
  uiMain.appendChild(el);
  const me = { el, timer: 0 }; NOTE = me;
  const end = () => { if (NOTE !== me) return; clearTimeout(me.timer); el.remove(); NOTE = null; };
  const run = () => { clearTimeout(me.timer); me.timer = setTimeout(end, LIFE); };
  // The time pauses while the pointer or focus is on the notice.
  el.addEventListener('pointerenter', () => clearTimeout(me.timer));
  el.addEventListener('pointerleave', () => { if (!el.contains(document.activeElement)) run(); });
  el.addEventListener('focusin', () => clearTimeout(me.timer));
  el.addEventListener('focusout', (e) => { if (NOTE === me && !el.contains(e.relatedTarget) && !el.matches(':hover')) run(); });
  el.querySelector('.an-act').addEventListener('click', (e) => { e.stopPropagation(); end(); undo(); });
  el.querySelector('.an-x').addEventListener('click', (e) => { e.stopPropagation(); end(); });
  run();
}

// ---------- Rendering ----------
function render() {
  if (!PAGE) return;
  const top = stage.scrollTop; following = false;
  stage.innerHTML = body(ws());
  stage.scrollTop = top; lastTop = stage.scrollTop;
  if (EDIT) { const i = stage.querySelector('#wname'); i?.focus({ preventScroll: true }); i?.select(); }
}
function showPage(id) {
  PAGE = id; EDIT = false; UI.drawer = false; UI.pop = false; closeGit();
  paint(); following = false; stage.innerHTML = body(ws()); stage.scrollTop = 0; lastTop = 0;
}
function newConv(w) {
  const id = `n${++UI.created}`; w.convs.unshift({ id, title: 'Uusi keskustelu', st: 'new' }); w.open = true;
  PAGE = null; closeGit(); openConv(id);
}
function archive(id) {
  const w = ws(); const c = w.convs.find(x => x.id === id); c.archived = true;
  const card = stage.querySelector(`[data-card="${id}"]`);
  const done = () => { paint(); render(); notice(`Arkistoitu <b>${esc(c.title)}</b>`, 'Palauta', () => { c.archived = false; paint(); render(); toast(`${c.title} palautettu. Pi ei käynnistynyt.`); }); };
  if (card && !matchMedia('(prefers-reduced-motion: reduce)').matches) { card.classList.add('leaving'); setTimeout(done, 160); } else done();
}
function setHidden(on) {
  const w = ws();
  if (on) { HIDDEN.add(w.id); paint(); render(); notice(`<b>${esc(label(w))}</b> piilotettu sivupalkista`, 'Kumoa', () => { HIDDEN.delete(w.id); paint(); render(); }); }
  else { HIDDEN.delete(w.id); paint(); render(); toast(`${label(w)} näkyy taas sivupalkissa.`); }
}
function saveName(v) {
  const w = ws(); v = v.trim(); EDIT = false;
  if (v && v !== label(w)) { if (v === w.id) delete LABEL[w.id]; else LABEL[w.id] = v; paint(); toast(`Näyttönimi on nyt ${v}. Hakemisto ${w.path} ei muutu.`); }
  render();
}

// ---------- Rename dialog (V2) ----------
const nameDlg = document.createElement('dialog'); nameDlg.className = 'confirm wsp-name'; document.body.appendChild(nameDlg);
nameDlg.addEventListener('close', () => { if (nameDlg.returnValue === 'ok') saveName(nameDlg.querySelector('input').value); });

// ---------- Clicks ----------
// Window capture runs before the library's document listeners, so the workspace name and the
// conversation's workspace link can open this page.
window.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.closest('.proto-picker') || t.closest('.an')) return;
  const stop = () => { e.preventDefault(); e.stopPropagation(); };
  const wsName = t.closest('.ws-name[data-ui="ws"]');
  if (wsName) { stop(); return showPage(wsName.closest('.ws').querySelector('[data-ws-tog]').dataset.wsTog); }
  const tbWs = t.closest('.tb-ws[data-ui="ws"]');
  if (tbWs) { stop(); return showPage(selConv().ws.id); }
  if (t.closest('[data-ws-add]')) { PAGE = null; closeGit(); return; }
  if (t.closest('[data-conv]')) { PAGE = null; EDIT = false; closeGit(); return; }
  if (!PAGE) return;
  const hit = t.closest('[data-git], [data-wl-close], [data-newconv], [data-archive], [data-fold], [data-restore], [data-wa]');
  if (!hit) { if (LAYER && !t.closest('.wl')) closeGit(); return; }
  if (hit.matches('[type="submit"]')) return;
  stop();
  const d = hit.dataset;
  if (hit.getAttribute('aria-disabled') === 'true') return toast(hit.title || DELETE_WHY);
  if (d.git !== undefined) return openGit(hit);
  if (d.wlClose !== undefined) return closeGit(true);
  if (d.newconv !== undefined) return newConv(ws());
  if (d.archive) return archive(d.archive);
  if (d.fold) { FOLD[d.fold] = !FOLD[d.fold]; return render(); }
  if (d.restore) {
    const c = ws().convs.find(x => x.id === d.restore);
    if (c) { c.archived = false; paint(); render(); return toast(`${c.title} palautettu listaan. Pi ei käynnistynyt.`); }
    const a = wsd(PAGE).archived; const [r] = a.splice(a.findIndex(x => x.id === d.restore), 1);
    ws().convs.push({ id: r.id, title: r.title, st: 'done' }); DONE_T[r.id] = r.t; paint(); render();
    return toast(`${r.title} palautettu valmiisiin. Pi ei käynnistynyt.`);
  }
  const w = ws();
  switch (d.wa) {
    case 'copy': try { await navigator.clipboard.writeText(w.path); } catch {} hit.setAttribute('data-done', ''); setTimeout(() => hit.removeAttribute('data-done'), 1200); return toast(`Kopioitu ${w.path}`);
    case 'gh': return toast(`Avautuisi uuteen välilehteen: ${ghHref(wsd(w.id))}`);
    case 'rename': EDIT = true; return render();
    case 'cancel': EDIT = false; render(); return stage.querySelector('[data-wa="rename"]')?.focus();
    case 'rename-dlg': nameDlg.innerHTML = `<form method="dialog"><h3>Työtilan näyttönimi</h3><label class="fld"><span>Näyttönimi</span><input value="${esc(label(w))}" autocomplete="off" spellcheck="false"></label><p class="hint">Vain tämän näkymän nimi; hakemisto <span class="mono">${esc(w.path)}</span> pysyy ennallaan.</p><div class="confirm-actions"><button class="secondary" value="cancel" formnovalidate>Peruuta</button><button class="primary" value="ok">Tallenna</button></div></form>`; nameDlg.showModal(); return nameDlg.querySelector('input').select();
    case 'hide': return setHidden(true);
    case 'unhide': return setHidden(false);
  }
}, true);
document.addEventListener('submit', (e) => {
  if (!e.target.matches('[data-nameform]')) return;
  e.preventDefault(); saveName(e.target.querySelector('input').value);
});
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (LAYER) { e.stopPropagation(); return closeGit(true); }
  if (EDIT && e.target.id === 'wname') { e.stopPropagation(); EDIT = false; render(); }
}, true);

const show = (v) => () => { CUR = v; PAGE = PAGE || 'aurinkokello'; EDIT = false; UI.pop = false; closeGit(); paint(); following = false; requestAnimationFrame(() => { stage.scrollTop = 0; lastTop = 0; }); return body(ws()); };
window.v1 = show('v1'); window.v2 = show('v2'); window.v3 = show('v3');
})();
