// ===== Etusivu: copy of ../../etusivu/round.js (the chosen home page), so the loader hands off
// to the real home. Only change: the home renders through window.__home instead of window[CUR].
// Also: its click handler and rerender stand still while the loader (window.__loading) is on.
// Toinen riffi 14.10.2026 (Kortit kertovat): jokainen sinua odottava keskustelu näyttää
// tilannekatsauksensa kokonaan ja sanatarkasti; juuri valmistunut ilman katsausta näyttää
// vain nimensä (Jari 14.10.). Sivupalkin Etusivu palaa tähän.
// keskustelurivi avaa kirjaston keskustelun. Jokaisella työtilalla on valikko
// (…) työtilan hallintaan, ja uuden työtilan voi luoda GitHubista tai hakemistona.
(() => {
const ICON_FOLDER = SVG('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>');
const ICON_GH = SVG('<path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>');
const ICON_MORE = SVG('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>');
const ICON_FWD = SVG('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>');
const ICON_COPY = SVG('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>');
const ICON_EXT = SVG('<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/>');
const ICON_TRASH = SVG('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>');
const ICON_ARCH = SVG('<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>');
const ICON_BRANCH = SVG('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10"/><path d="M18 10c0 4-6 3-12 7"/>');

// Lisää työtiloja, jotta skaalautuminen näkyy, ja tiedot korteille.
const EXTRA = [
  { id: 'reitti', path: '~/src/reitti', open: false, convs: [{ id: 'r1', title: 'Pysäkkihaun sumea vertailu', st: 'done' }, { id: 'r2', title: 'HSL-rajapinnan virheviestit', st: 'done' }] },
  { id: 'kuitit', path: '~/src/kuitit', open: false, convs: [{ id: 'k1', title: 'OCR-tuloksen päivämäärät', st: 'done' }] },
  { id: 'wilma-cli', path: '~/src/wilma-cli', open: false, convs: [] },
  { id: 'taskfleet', path: '~/src/taskfleet', open: false, convs: [{ id: 't1', title: 'run wait --any -tulosteen muoto', st: 'done' }, { id: 't2', title: 'Supervisorin uudelleenkäynnistys', st: 'done' }, { id: 't3', title: 'Profiilien dry-run', st: 'done' }] },
];
for (const w of EXTRA) if (!UI.ws.some(x => x.id === w.id)) UI.ws.push(w);
const WS = {
  aurinkokello: { branch: 'main', dirty: 2, gh: 'maintainer/aurinkokello', t: '1 min' },
  issuectl: { branch: 'search-negation', dirty: 0, gh: 'jarimustonen/issuectl', t: '25 min' },
  fleetrepo: { branch: 'main', dirty: 0, gh: 'maintainer/fleetrepo', t: 'ma' },
  'open-habitat': { branch: 'main', dirty: 5, gh: 'Open-Habitat/open-habitat', t: 'nyt' },
  reitti: { branch: 'main', dirty: 0, gh: 'maintainer/reitti', t: '9.10.' },
  kuitit: { branch: 'main', dirty: 0, gh: 'maintainer/kuitit', t: '2.10.' },
  'wilma-cli': { branch: 'main', dirty: 0, gh: null, t: 'luotu 1.10.' },
  taskfleet: { branch: 'main', dirty: 0, gh: 'jarimustonen/taskfleet', t: 'eilen' },
};
const INFO = {
  c2: { t: '8 min', say: 'Pakkaus valmis: 214 kuvaa, 38 Mt → 11 Mt. Poistanko alkuperäiset, vai jätetäänkö ne <span class="mono">originals/</span>-hakemistoon?' },
  c10: { t: '25 min', say: 'Kumpi muoto: <span class="mono">-label:bug</span> vai <span class="mono">NOT label:bug</span>? Ensimmäinen on lyhyempi, jälkimmäinen sama kuin GitHubissa.' },
  c1: { t: '1 min', say: 'Skripti tulostaa nyt viime viikon statusrivit. Lisätäänkö JSON-tuloste samaan ajoon?' },
  c5: { t: 'nyt', doing: 'ajaa <span class="mono">npm test</span> · 2 min' },
  c4: { t: '3 t', say: 'Prosessin tilaa ei saatu luettua.' },
};
const GH = ['maintainer/reitti', 'maintainer/kuitit', 'maintainer/wilma-cli', 'jarimustonen/taskfleet'];
let HOME = true, CUR = 'v1', MENU = null, NWS = 'gh', OPEN = { aurinkokello: true, issuectl: true, 'open-habitat': true };
const st = (c) => convState(c);
const info = (c) => INFO[c.id] || {};
const mark = (c) => { const [l, m] = STATES[st(c)] ?? ['Ei aloitettu', '<span class="st-none"></span>']; return `<span class="st" role="img" aria-label="${l}" title="${l}">${m}</span>`; };
const convsOf = (w) => w.convs.filter(c => !c.archived);
const active = (w) => convsOf(w).filter(c => st(c) !== 'done').sort((a, b) => (STATE_ORDER[st(a)] ?? 4) - (STATE_ORDER[st(b)] ?? 4));
const count = (w, s) => convsOf(w).filter(c => st(c) === s).length;
const weight = (w) => count(w, 'attention') * 100 + count(w, 'waiting') * 10 + count(w, 'working');
const sorted = () => [...UI.ws].sort((a, b) => weight(b) - weight(a));
const needs = () => UI.ws.flatMap(w => convsOf(w).map(c => ({ ...c, ws: w }))).filter(c => ['attention', 'waiting'].includes(st(c))).sort((a, b) => (st(a) === 'attention' ? 0 : 1) - (st(b) === 'attention' ? 0 : 1));
const pills = (w) => [['attention', 'uusi'], ['waiting', 'odottaa'], ['working', 'käynnissä']].map(([s, l]) => { const k = count(w, s); return k ? `<span class="pill ${s}">${STATES[s][1]}${k} ${l}</span>` : ''; }).join('');
const meta = (w) => WS[w.id] || { branch: 'main', dirty: 0, gh: null, t: 'nyt' };
const gitLine = (w) => { const m = meta(w); return `<span class="git mono">${ICON_BRANCH}${esc(m.branch)}${m.dirty ? `<span class="dirty" title="${m.dirty} muuttunutta tiedostoa">+${m.dirty}</span>` : ''}</span>`; };

// ---------- Workspace menu (…) ----------
function wsMenu(w) {
  const m = meta(w);
  return `<div class="h-menu" role="menu" aria-label="Työtila ${w.id}">
<button type="button" role="menuitem" data-h-new="${w.id}">${ICON_PLUS}<span>Uusi keskustelu</span></button>
<button type="button" role="menuitem" data-h-ws="${w.id}">${ICON_FWD}<span>Avaa työtilasivu</span></button>
<hr>
<button type="button" role="menuitem" data-h-copy="${w.path}">${ICON_COPY}<span>Kopioi polku</span><span class="kbd mono">${esc(w.path)}</span></button>
${m.gh ? `<button type="button" role="menuitem" data-h-gh="${m.gh}">${ICON_EXT}<span>Avaa GitHubissa</span></button>` : ''}
<button type="button" role="menuitem" data-h-arch="${w.id}">${ICON_ARCH}<span>Piilota etusivulta</span></button>
<hr>
<button type="button" role="menuitem" class="danger" aria-disabled="true" title="Palautettava poisto suunnitellaan ensin (recoverable-workspace-deletion).">${ICON_TRASH}<span>Poista työtila…</span><span class="why">tulossa</span></button>
</div>`;
}
const moreBtn = (w) => `<span class="h-anchor"><button type="button" class="icon-btn more" data-h-more="${w.id}" aria-haspopup="menu" aria-expanded="${MENU === w.id}" aria-label="Työtilan ${w.id} toiminnot" title="Toiminnot">${ICON_MORE}</button>${MENU === w.id ? wsMenu(w) : ''}</span>`;
const addBtn = (w) => `<button type="button" class="icon-btn" data-h-new="${w.id}" aria-label="Uusi keskustelu työtilassa ${w.id}" title="Uusi keskustelu">${ICON_PLUS}</button>`;
const nwsBtn = (cls = 'h-primary') => `<button type="button" class="${cls}" data-h-nws>${ICON_FOLDER}<span>Uusi työtila</span></button>`;

function newConv(wsId) {
  const w = UI.ws.find(x => x.id === wsId); const id = `n${++UI.created}`;
  w.convs.unshift({ id, title: 'Uusi keskustelu', st: 'new' }); w.open = true;
  HOME = false; MENU = null; openConv(id);
}
const dlg = document.createElement('dialog'); dlg.className = 'confirm nws'; document.body.appendChild(dlg);
function paintDlg() {
  const gh = NWS === 'gh';
  dlg.innerHTML = `<form method="dialog"><h3>Uusi työtila</h3>
<div class="seg" role="tablist"><button type="button" role="tab" aria-selected="${gh}" data-nws="gh">${ICON_GH}Kloonaa GitHubista</button><button type="button" role="tab" aria-selected="${!gh}" data-nws="dir">${ICON_FOLDER}Uusi hakemisto</button></div>
${gh ? `<label class="fld"><span>Repositorio</span><input name="v" class="mono" placeholder="omistaja/repo" autocomplete="off" required></label>
<ul class="sugg">${GH.filter(r => !UI.ws.some(w => w.id === r.split('/')[1])).concat(['maintainer/dotfiles', 'maintainer/kirjasto']).map(r => `<li><button type="button" data-sugg="${r}" class="mono">${r}</button></li>`).join('')}</ul>
<p class="hint">Kloonataan hakemistoon <span class="mono">~/src/&lt;repo&gt;</span> sinun GitHub-tunnuksillasi.</p>`
    : `<label class="fld"><span>Nimi</span><input name="v" class="mono" placeholder="uusi-projekti" autocomplete="off" required pattern="[a-z0-9._-]+"></label>
<p class="hint">Luodaan <span class="mono">~/src/&lt;nimi&gt;</span> ja alustetaan Git-repoksi.</p>`}
<div class="confirm-actions"><button class="secondary" value="cancel" formnovalidate>Peruuta</button><button class="primary" value="ok">Luo työtila</button></div></form>`;
}
function openDlg() { MENU = null; paintDlg(); dlg.showModal(); dlg.querySelector('input').focus(); }
dlg.addEventListener('click', (e) => {
  const t = e.target.closest('[data-nws], [data-sugg]'); if (!t) return;
  if (t.dataset.nws) { NWS = t.dataset.nws; paintDlg(); dlg.querySelector('input').focus(); }
  else dlg.querySelector('input').value = t.dataset.sugg;
});
dlg.addEventListener('close', () => {
  if (dlg.returnValue !== 'ok') return;
  const v = dlg.querySelector('input').value.trim(); const id = v.split('/').pop();
  if (!id || UI.ws.some(w => w.id === id)) return toast(`Työtila ${id} on jo olemassa.`);
  UI.ws.push({ id, path: `~/src/${id}`, open: true, convs: [] });
  WS[id] = { branch: 'main', dirty: 0, gh: NWS === 'gh' ? v : null, t: 'luotu nyt' }; OPEN[id] = true;
  paint(); rerender(); toast(NWS === 'gh' ? `Kloonattu ${v} → ~/src/${id}` : `Työtila ${id} luotu`);
});

// ---------- Home state across the library frame ----------
function rerender() { if (HOME && !window.__loading) stage.innerHTML = window.__home(true); }
APP.painted.push(() => {
  uiFrame.classList.toggle('is-home', HOME);
  uiRail.querySelector('.home-row').toggleAttribute('aria-current', HOME);
  if (HOME) {
    uiRail.querySelectorAll('.conv-row[aria-current]').forEach(a => a.removeAttribute('aria-current'));
    uiTop.innerHTML = `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button><div class="tb-title"><strong>Etusivu</strong></div>`;
  }
});
document.addEventListener('click', async (e) => {
  if (e.target.closest(".proto-picker") || window.__loading) return;
  if (e.target.closest('[data-ui="home"]')) { e.preventDefault(); e.stopPropagation(); HOME = true; UI.drawer = false; MENU = null; paint(); stage.innerHTML = window.__home(true); return; }
  if (e.target.closest('[data-conv], [data-ws-add]')) { HOME = false; MENU = null; return; }
  const t = e.target.closest('[data-h-more], [data-h-new], [data-h-nws], [data-h-ws], [data-h-copy], [data-h-gh], [data-h-arch], [data-h-tog], .h-menu [aria-disabled]');
  if (!t) { if (MENU && !e.target.closest('.h-menu')) { MENU = null; rerender(); } return; }
  e.preventDefault(); e.stopPropagation();
  const d = t.dataset;
  if (t.getAttribute('aria-disabled') === 'true') return toast(t.title);
  if (d.hMore) { MENU = MENU === d.hMore ? null : d.hMore; return rerender(); }
  if (d.hNew) return newConv(d.hNew);
  if (d.hNws !== undefined) return openDlg();
  if (d.hTog) { OPEN[d.hTog] = !OPEN[d.hTog]; return rerender(); }
  MENU = null; rerender();
  if (d.hWs) return toast('Työtilasivu on oma kierroksensa.');
  if (d.hCopy) { try { await navigator.clipboard.writeText(d.hCopy); } catch {} return toast(`Kopioitu ${d.hCopy}`); }
  if (d.hGh) return toast(`Avautuisi github.com/${d.hGh}`);
  if (d.hArch) return toast('Piilotus etusivulta on ehdotus; työtila säilyy levyllä ja sivupalkissa.');
}, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && MENU) { MENU = null; rerender(); } });

const head = (h, sub) => `<header class="h-head"><div><h1>${h}</h1>${sub ? `<p class="h-sub">${sub}</p>` : ''}</div><div class="h-acts">${nwsBtn()}</div></header>`;
const summary = () => { const n = needs().length, k = UI.ws.reduce((s, w) => s + count(w, 'working'), 0); return `${UI.ws.length} työtilaa · ${n ? `<strong>${n} odottaa sinua</strong>` : 'mikään ei odota sinua'}${k ? ` · ${k} käynnissä` : ''}`; };

// ---------- Katsaukset ----------
// Juuri valmistunut keskustelu ilman katsausta (vain nimi).
const hb = UI.ws.find(w => w.id === 'fleetrepo');
if (!hb.convs.some(c => c.id === 'c12')) hb.convs.unshift({ id: 'c12', title: 'Lokien kierrätys ja säilytysaika', st: 'attention' });
const REC = {
  c2: { age: '8 min sitten', recap: 'Kuvat `assets/photos/` muunnettiin WebP-muotoon laadulla 82: 214 kuvaa, yhteensä 38 Mt → 11 Mt. `build.sh` käyttää nyt `.webp`-tiedostoja ja säilyttää JPEG-varakuvan vanhoille selaimille `<picture>`-elementissä. Alkuperäiset ovat yhä paikallaan.', next: 'Päätä, poistetaanko alkuperäiset vai siirretäänkö ne `originals/`-hakemistoon.' },
  c1: { age: '1 min sitten', recap: 'Skripti `scripts/status_rows.py` lukee `status.md`:n taulukon ja tulostaa viime viikon rivit. `--since` antaa rajan käsin, ja `--today` tekee päivästä testattavan; testit menevät läpi.', next: 'Kerro, lisätäänkö JSON-tuloste samaan ajoon vai omaksi lipukseen.' },
  c10: { age: '25 min sitten', recap: 'Hakusyntaksiin lisättiin negaatio. Jäsennin hyväksyy jo molemmat muodot, mutta dokumentaatioon ja virheviesteihin pitää valita yksi. `-label:bug` on lyhyempi; `NOT label:bug` on sama kuin GitHubin haussa.', next: 'Valitse muoto, niin päivitän README:n ja virheviestit.' },
  c5: { age: '14 min sitten', stale: true, recap: 'Kiintiönäkymän tekstit on kirjoitettu uudelleen: täynnä oleva levy kertoo nyt, mikä työtila vie eniten tilaa ja miten sitä vapautetaan. Storybookin tarinat on päivitetty.', next: 'Aja testit ja tarkista puhelinleveys.' },
  c4: { age: '3 t sitten', recap: 'Syklin tunnistus toimii pienissä graafeissa. Suuressa graafissa ajo keskeytyi, eikä prosessin tilaa ole sen jälkeen saatu luettua.', next: 'Tarkista, onko Pi yhä käynnissä terminaalissa.' },
};
const LIVEDO = { c5: 'Pi työskentelee: ajaa <span class="mono">npm test</span> · 2 min' };
const isJust = (c) => st(c) === 'attention' && !REC[c.id];
const shown = (w) => convsOf(w).filter(c => st(c) !== 'done').sort((a, b) => (STATE_ORDER[st(a)] ?? 4) - (STATE_ORDER[st(b)] ?? 4));
const doneN = (w) => convsOf(w).filter(c => st(c) === 'done').length;

function recapCard(c, { ws = false } = {}) {
  const r = REC[c.id]; const s = st(c);
  if (!r) return `<a href="#" class="kc just" data-conv="${c.id}">${mark(c)}<strong>${esc(c.title)}</strong>${ws ? `<span class="mono kc-ws">${esc(c.ws.id)}</span>` : ''}<span class="kc-just">valmistui juuri · katsaus syntyy pian</span></a>`;
  return `<article class="kc ${s}">
<a href="#" class="kc-head" data-conv="${c.id}">${mark(c)}<strong>${esc(c.title)}</strong>${ws ? `<span class="mono kc-ws">${esc(c.ws.id)}</span>` : ''}<span class="kc-grow"></span><span class="kc-age">${r.age}</span>${r.stale ? '<span class="k-stale" title="Keskustelussa on katsauksen jälkeen uusia viestejä">uusia viestejä</span>' : ''}</a>
${LIVEDO[c.id] ? `<p class="kc-live">${LIVEDO[c.id]}</p>` : ''}
<p class="k-text">${inline(r.recap)}</p>
<p class="k-next"><span class="k-label">Seuraavaksi</span><span>${inline(r.next)}</span></p>
<a href="#" class="kc-go" data-conv="${c.id}">${s === 'attention' ? 'Lue vastaus' : s === 'waiting' ? 'Vastaa' : 'Avaa'}${ICON_FWD}</a>
</article>`;
}
const quietRow = (w) => `<li class="qrow"><a href="#" class="mono" data-h-ws="${w.id}">${esc(w.id)}</a>${gitLine(w)}<span class="q-done">${[shown(w).length ? `${shown(w).length} avoin${shown(w).length > 1 ? 'ta' : ''}` : '', doneN(w) ? `${doneN(w)} valmis${doneN(w) > 1 ? 'ta' : ''}` : ''].filter(Boolean).join(' · ') || 'ei keskusteluja'}</span><time>${esc(meta(w).t)}</time><span class="wsrow-acts">${addBtn(w)}${moreBtn(w)}</span></li>`;
const quiet = () => { const q = sorted().filter(w => !shown(w).length); return q.length ? `<section aria-labelledby="q-h"><h2 id="q-h">Ei avointa työtä</h2><ul class="qrows">${q.map(quietRow).join('')}</ul></section>` : ''; };
const wsHead = (w, tag = 'header') => `<${tag} class="wsh"><a href="#" class="wscard-name mono" data-h-ws="${w.id}">${esc(w.id)}</a>${gitLine(w)}<span class="kc-grow"></span>${doneN(w) ? `<span class="q-done">${doneN(w)} valmis${doneN(w) > 1 ? 'ta' : ''}</span>` : ''}${addBtn(w)}${moreBtn(w)}</${tag}>`;

// V1 · Työtilakortit
function v1Body() {
  const busy = sorted().filter(w => shown(w).length);
  return `<div class="home k1">${head('Työtilat', summary())}
${busy.map(w => `<article class="wsbox">${wsHead(w)}<div class="kcs">${shown(w).map(c => recapCard(c)).join('')}</div></article>`).join('')}
${quiet()}</div>`;
}
// V2 · Työtilaosiot
function v2Body() {
  const busy = sorted().filter(w => shown(w).length);
  return `<div class="home k2">${head('Työtilat', summary())}
${busy.map(w => `<section class="wssec">${wsHead(w, 'div')}<div class="kgrid">${shown(w).map(c => recapCard(c)).join('')}</div></section>`).join('')}
${quiet()}</div>`;
}
// V3 · Tilan mukaan
function v3Body() {
  const all = sorted().flatMap(w => shown(w).map(c => ({ ...c, ws: w })));
  const g = [['Uusi vastaus', all.filter(c => st(c) === 'attention')], ['Odottaa sinua', all.filter(c => st(c) === 'waiting')], ['Käynnissä', all.filter(c => st(c) === 'working')], ['Tila ei tiedossa', all.filter(c => st(c) === 'unknown')]].filter(x => x[1].length);
  return `<div class="home k3">${head('Etusivu', summary())}
${g.map(([h, cs], i) => `<section aria-labelledby="g${i}"><h2 id="g${i}">${h} <span class="count">${cs.length}</span></h2><div class="kcs">${cs.map(c => recapCard(c, { ws: true })).join('')}</div></section>`).join('')}
<section aria-labelledby="t-h"><h2 id="t-h">Työtilat <span class="count plain">${UI.ws.length}</span></h2><ul class="qrows">${sorted().map(quietRow).join('')}</ul></section>
</div>`;
}
const show = (v) => (keep) => { CUR = v; HOME = true; if (!keep) MENU = null; UI.sel = 'c1'; UI.pop = false; paint(); return { v1: v1Body, v2: v2Body, v3: v3Body }[v](); };
window.__home = show('v2');
})();

// ===== Kierros 16.10.2026: latausnäkymä =====
// Every direction plays the same synthetic load. Its steps follow App.tsx load(): the
// bundle (index.html has painted, React has not run yet), the account session, the Pi
// status (first load only), then /api/v1/snapshot. Two rules are shared by the three new
// directions: nothing loader-like appears before 300 ms from navigation, and a loader
// that did appear stays at least 500 ms, so a fast load paints the home page straight
// away and a borderline one does not blink. Nykyinen behaves as production does today.
(() => {
const SHOW_AFTER = 300, MIN_SHOWN = 500, SLOW_AFTER = 8000;
const SCEN = {
  slow: { label: 'Hidas (n. 5 s)', steps: [['bundle', 600], ['session', 400], ['pi', 700], ['snapshot', 3300]] },
  fast: { label: 'Nopea (0,2 s)', steps: [['bundle', 110], ['session', 30], ['pi', 30], ['snapshot', 60]] },
  vslow: { label: 'Hyvin hidas (n. 15 s)', steps: [['bundle', 700], ['session', 500], ['pi', 900], ['snapshot', 12500]] },
  fail: { label: 'Epäonnistuu', steps: [['bundle', 600], ['session', 400], ['pi', 700], ['snapshot', 2600, 'fail']] },
};
// Yritä uudelleen re-reads the session and the snapshot; Pi was checked already (App.tsx piChecked).
const RETRY = [['session', 300], ['pi', 0, 'skip'], ['snapshot', 1500]];
const NAME = { bundle: 'Sovellus latautuu', session: 'Istunto', pi: 'Pi', snapshot: 'Työtilat' };
const SRV = 'open-habitat-test';
const MARK = `<svg class="ld-mark" viewBox="0 0 48 48" aria-hidden="true"><rect x="2.5" y="2.5" width="43" height="43" rx="12" fill="var(--ah-accent-soft)" stroke="var(--ah-accent-line)"/><path d="M14 36V23a10 10 0 0 1 20 0v13" fill="none" stroke="var(--ah-accent)" stroke-width="3" stroke-linecap="round"/><circle class="ld-dot" cx="24" cy="28.5" r="3.2" fill="var(--ah-accent)"/></svg>`;
const ICON_X = SVG('<path d="M7 7l10 10M17 7 7 17"/>');

// ---------- Page bar: which load to play ----------
const bar = document.querySelector('.page-bar');
const ctl = document.createElement('span'); ctl.className = 'ld-ctl';
ctl.innerHTML = `<label>Lataus <select id="ld-scen">${Object.entries(SCEN).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('')}</select></label><button type="button" id="ld-replay">Lataa uudelleen</button><span id="ld-clock" class="ld-clock"></span>`;
bar.insertBefore(ctl, bar.querySelector('.hint'));
const scenSel = ctl.querySelector('#ld-scen'), clock = ctl.querySelector('#ld-clock');
const fromUrl = new URLSearchParams(location.search).get('load'); if (SCEN[fromUrl]) scenSel.value = fromUrl;
const replay = () => document.querySelector('.proto-picker-replay')?.click();
scenSel.addEventListener('change', () => { const u = new URL(location); u.searchParams.set('load', scenSel.value); history.replaceState(null, '', u); replay(); });
ctl.querySelector('#ld-replay').addEventListener('click', replay);

// ---------- Load state ----------
const frame = document.querySelector('.frame');
const CLS = ['ld', 'ld-v1', 'ld-v2', 'ld-v3', 'ld-v4', 'ld-pre', 'ld-vis', 'ld-slow', 'ld-fail', 'ld-enter', 'ld-was-v1'];
let L = { v: 'v1', timers: [] };
const now = () => performance.now();
const later = (ms, f) => L.timers.push(setTimeout(f, ms));
const stopAll = () => { L.timers.forEach(clearTimeout); L.timers = []; clearInterval(L.tick); };
const cur = () => L.steps[L.i] || {};
const done = (k) => L.steps.some(s => s.k === k && (s.st === 'done' || s.st === 'skip'));
const sec = (ms) => (ms / 1000).toFixed(1).replace('.', ',') + ' s';

function start(v) {
  stopAll();
  L = { v, timers: [], t0: now(), steps: SCEN[scenSel.value].steps.map(([k, ms, how]) => ({ k, ms, how, st: 'wait' })), i: 0, shownAt: null, phase: 'pre' };
  window.__loading = true;
  // The loader and the home page read from the top; stage.js would follow the bottom.
  following = false;
  resetHome();
  frame.classList.remove(...CLS); frame.classList.add('ld', 'ld-' + v, 'ld-pre');
  // Nykyinen shows its text as soon as React runs; the others wait SHOW_AFTER from navigation.
  if (v !== 'v4') later(SHOW_AFTER, reveal);
  later(SLOW_AFTER, () => { if (L.phase !== 'fail') { frame.classList.add('ld-slow'); update(); } });
  L.tick = setInterval(tick, 100);
  later(0, () => { paintChrome(); update(); step(0); });
  return VIEW[v].body();
}
function reveal() { if (L.shownAt === null && window.__loading) { L.shownAt = now(); frame.classList.add('ld-vis'); } }
function step(i) {
  L.i = i;
  if (i >= L.steps.length) return succeed();
  const s = L.steps[i];
  if (s.how === 'skip') { s.st = 'skip'; return step(i + 1); }
  s.st = 'active'; s.at = now(); update();
  later(s.ms, () => {
    if (s.how === 'fail') { s.st = 'fail'; return fail(); }
    s.st = 'done'; s.took = now() - s.at;
    if (s.k === 'bundle') { L.phase = 'js'; frame.classList.remove('ld-pre'); if (L.v === 'v4') reveal(); }
    if (s.k === 'session') L.profile = 'Jari';
    paintChrome(); update(); step(i + 1);
  });
}
function succeed() {
  const wait = L.shownAt === null || L.v === 'v4' ? 0 : Math.max(0, L.shownAt + MIN_SHOWN - now());
  later(wait, () => {
    const shown = L.shownAt !== null, took = now() - L.t0;
    stopAll(); window.__loading = false; L.phase = 'home';
    frame.classList.remove(...CLS);
    following = false; stage.innerHTML = window.__home(); stage.scrollTop = 0;
    // Only a page that showed a loader cross-fades into the home; a fast load just paints it.
    if (shown && L.v !== 'v4') { frame.classList.add('ld-enter', ...(L.v === 'v1' ? ['ld-was-v1'] : [])); later(400, () => frame.classList.remove('ld-enter', 'ld-was-v1')); }
    clock.textContent = `Etusivu ${sec(took)}${shown ? '' : ' · latausnäkymää ei näytetty'}`;
  });
}
function fail() { L.phase = 'fail'; frame.classList.remove('ld-pre', 'ld-slow'); frame.classList.add('ld-fail'); reveal(); paintChrome(); update(); }
function retry() {
  L.steps = RETRY.map(([k, ms, how]) => ({ k, ms, how, st: 'wait' }));
  L.phase = 'js'; L.t0 = now(); L.shownAt = now(); frame.classList.remove('ld-fail', 'ld-slow');
  later(SLOW_AFTER, () => { if (L.phase !== 'fail' && window.__loading) { frame.classList.add('ld-slow'); update(); } });
  clearInterval(L.tick); L.tick = setInterval(tick, 100);
  paintChrome(); update(); step(0);
}
function tick() {
  if (!window.__loading) return;
  const s = cur();
  clock.textContent = `${sec(now() - L.t0)} · ${L.phase === 'fail' ? 'epäonnistui' : NAME[s.k] || 'valmis'}`;
  for (const el of stage.querySelectorAll('[data-ld-el]')) {
    const st = L.steps.find(x => x.k === el.dataset.ldEl), t = st && st.st === 'active' ? Math.floor((now() - st.at) / 1000) : 0;
    const txt = t >= 1 ? `${t} s` : '';
    if (el.textContent !== txt) el.textContent = txt;
  }
}
// The home copy keeps HOME/MENU in its own scope; returning to the home page resets them.
function resetHome() { UI.drawer = false; UI.sel = 'c1'; paint(); }

// ---------- Frame during the load ----------
const rail = document.querySelector('.rail');
const sk = (w, cls = '') => `<span class="ld-sk ld-sk-line ${cls}" style="width:${w}px"></span>`;
const railSkeleton = () => [[96, [140, 118, 152]], [70, [126]], [84, []], [110, [98, 134]]].map(([w, rows]) => `<div class="ld-sk-ws">${sk(w)}</div>${rows.map(r => `<div class="ld-sk-row">${sk(r)}</div>`).join('')}`).join('');
function paintChrome() {
  const conn = rail.querySelector('.rail-head .conn'), foot = rail.querySelector('.rail-foot');
  if (!window.__loading) { conn.innerHTML = '<span class="st-dot ok"></span>Yhdistetty'; foot.innerHTML = '<span class="avatar">J</span><span>Jari</span>'; return; }
  const failed = L.phase === 'fail';
  conn.innerHTML = failed ? '<span class="st-dot ld-err"></span>Ei yhteyttä' : '<span class="st-dot ld-wait"></span>Yhdistetään';
  foot.innerHTML = L.profile ? '<span class="avatar">J</span><span>Jari</span>' : `<span class="avatar ld-sk"></span>${sk(52)}`;
  rail.querySelector('.rail-list').innerHTML = failed ? '<p class="rail-empty">Työtiloja ei saatu.</p>' : L.v === 'v2' ? railSkeleton() : '';
  const top = document.querySelector('.topbar');
  if (L.v !== 'v4') top.innerHTML = `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button><div class="tb-title"><strong>Etusivu</strong></div>`;
  else top.innerHTML = failed ? '' : '<div class="ld4-banner"><strong>Ladataan palvelimen tilaa</strong><span>Haetaan tuoreita tietoja…</span></div>';
}
APP.painted.push(() => { if (window.__loading) paintChrome(); });
document.addEventListener('click', (e) => {
  if (!window.__loading || e.target.closest('.proto-picker, .page-bar')) return;
  if (e.target.closest('[data-ld-retry]')) { e.preventDefault(); e.stopPropagation(); return retry(); }
  if (e.target.closest('[data-ui="drawer"]')) return;
  if (e.target.closest('[data-ui], [data-conv], [data-ws-add], [data-ws-tog], a')) { e.preventDefault(); e.stopPropagation(); }
}, true);
const retryBtn = (cls = 'ld-btn') => `<button type="button" class="${cls}" data-ld-retry>${ICON_REFRESH}<span>Yritä uudelleen</span></button>`;
const SLOW = 'Palvelin vastaa tavallista hitaammin. Odotetaan yhä; voit jättää sivun auki.';
const FAILTXT = 'Palvelin ei vastannut. Tämä ei tarkoita, että työtilasi olisivat kadonneet.';
const set = (sel, html) => { const el = stage.querySelector(sel); if (el && el.innerHTML !== html) el.innerHTML = html; };
const update = () => VIEW[L.v].update();

// ---------- The directions ----------
const VIEW = {
  // V1 · Merkki: the landing is the product's own moment, not the app. index.html can
  // carry this markup statically, so it is already there before the bundle runs.
  v1: {
    body: () => `<div class="ld1"><div class="ld1-in ld-late">${MARK}<p class="ld1-word">Open Habitat</p><p class="ld1-srv mono">${SRV}</p><div class="ld1-bar" aria-hidden="true"><span></span></div><p class="ld1-say" role="status" data-ld-say></p><div class="ld1-more" data-ld-more></div></div></div>`,
    update() {
      const failed = L.phase === 'fail';
      set('[data-ld-say]', failed ? '<strong>Työtiloja ei saatu näkyviin</strong>' : L.profile ? 'Hei Jari. Haetaan työtilojasi…' : 'Yhdistetään palvelimeen…');
      set('[data-ld-more]', failed ? `<p>${FAILTXT}</p>${retryBtn()}` : frame.classList.contains('ld-slow') ? `<p>${SLOW}</p>` : '');
    },
  },
  // V2 · Runko: the frame and the home page's own shape; content fills into place.
  v2: {
    body: () => {
      const card = (n) => `<div class="kc ld-kc">${sk(170 - n * 20)}${sk(260, 'ld-w')}${sk(230, 'ld-w')}${sk(150)}<span class="ld-kc-next">${sk(70)}${sk(180)}</span></div>`;
      return `<div class="home k2 ld2"><header class="h-head"><div><h1>Työtilat</h1><p class="h-sub ld-late">${sk(230)}</p></div></header>
<p class="ld-sr" role="status" data-ld-say></p><div data-ld-more></div>
${[[2, 108], [1, 76]].map(([n, w]) => `<section class="wssec ld-late"><div class="wsh">${sk(w, 'ld-mono')}${sk(64)}</div><div class="kgrid">${Array.from({ length: n }, (_, i) => card(i)).join('')}</div></section>`).join('')}
<section class="ld-late"><h2>${sk(96)}</h2><div class="ld-qrows">${[84, 62, 104].map(w => `<div class="ld-qrow">${sk(w, 'ld-mono')}${sk(56)}<span class="kc-grow"></span>${sk(40)}</div>`).join('')}</div></section></div>`;
    },
    update() {
      const failed = L.phase === 'fail';
      set('[data-ld-say]', failed ? '' : 'Ladataan työtiloja');
      set('[data-ld-more]', failed ? `<div class="ld-notice err" role="alert"><div><strong>Työtiloja ei voitu hakea</strong><p>${FAILTXT}</p></div>${retryBtn('ld-btn')}</div>` : frame.classList.contains('ld-slow') ? `<p class="ld-slowline">${SLOW}</p>` : '');
    },
  },
  // V3 · Vaiheet: the steps the host really takes, in the place the home page will fill.
  v3: {
    body: () => `<div class="home k2 ld3"><header class="h-head"><div><h1>Työtilat</h1><p class="h-sub ld-late" data-ld-sub></p></div></header>
<ol class="ld3-steps ld-late" aria-label="Latauksen vaiheet">${['session', 'pi', 'snapshot'].map(k => `<li data-k="${k}"><span class="ld3-mark"></span><span class="ld3-name">${NAME[k]}</span><span class="ld3-say"></span><span class="ld3-el" data-ld-el="${k}"></span></li>`).join('')}</ol>
<div class="ld3-after ld-late" role="status" data-ld-more></div></div>`,
    update() {
      const failed = L.phase === 'fail';
      const SAY = {
        session: { active: 'Tarkistetaan kirjautumista…', done: 'Kirjautunut GitHubilla: Jari', skip: 'Kirjautunut GitHubilla: Jari' },
        pi: { active: 'Tarkistetaan Pi:n kirjautumista…', done: 'Pi on käytettävissä', skip: 'Pi on käytettävissä' },
        snapshot: { active: `Luetaan työtiloja palvelimelta <span class="mono">${SRV}</span>…`, done: '8 työtilaa', fail: 'Palvelin ei vastannut.' },
      };
      for (const li of stage.querySelectorAll('.ld3-steps li')) {
        const s = L.steps.find(x => x.k === li.dataset.k) || { st: done(li.dataset.k) ? 'done' : 'wait' };
        const st = s.st === 'skip' ? 'done' : s.st;
        li.className = 'st-' + st;
        const mark = st === 'done' ? `<span class="st-check">${ICON_CHECK}</span>` : st === 'active' ? '<span class="st-dot working"></span>' : st === 'fail' ? `<span class="ld3-x">${ICON_X}</span>` : '<span class="st-none"></span>';
        const m = li.querySelector('.ld3-mark'); if (m.dataset.st !== st) { m.dataset.st = st; m.innerHTML = mark; }
        const say = (SAY[li.dataset.k] || {})[s.st] || ''; const el = li.querySelector('.ld3-say'); if (el.innerHTML !== say) el.innerHTML = say;
      }
      set('[data-ld-sub]', failed ? 'Ei yhteyttä palvelimeen' : 'Haetaan…');
      set('[data-ld-more]', failed ? `<p>Kirjautuminen ja Pi ovat kunnossa; vain työtilojen haku epäonnistui. Työtilasi ovat tallessa palvelimella.</p>${retryBtn()}` : frame.classList.contains('ld-slow') ? `<p class="ld-slowline">${SLOW}</p>` : '');
    },
  },
  // V4 · Nykyinen: production today (App.tsx phase loading / daemon_unavailable, Status.tsx banner).
  v4: {
    body: () => `<div class="ld4" data-ld-more></div>`,
    update() {
      if (L.phase === 'pre') return set('[data-ld-more]', '');
      set('[data-ld-more]', L.phase === 'fail'
        ? `<h1>Yhteyttä ei saatu</h1><div class="ld-notice err" role="alert"><div><strong>Työtiloja ei voitu näyttää</strong><p>Tietoja ei voitu tarkistaa. Tämä ei tarkoita, että työtilasi olisivat kadonneet. Tarkista yhteys ja yritä uudelleen.</p></div>${retryBtn('ld-btn secondary')}</div>`
        : '<h1>Ladataan</h1><p>Haetaan työtiloja…</p>');
    },
  },
};
window.v1 = () => start('v1'); window.v2 = () => start('v2'); window.v3 = () => start('v3'); window.v4 = () => start('v4');
})();
