// Taustatyön palkki: Merkit (Jari 16.10.2026, kierros 2026-10-16-taustatyo-riff, issue
// implement-background-strip). Kaksi pientä merkkiä kentän yllä, spinoffit ja prosessit;
// levossa merkki kertoo vain, onko lajia käynnissä (kuvake ja luku), odottaako agentin
// päättynyt vuoro sitä (kello) ja tarvitseeko spinoff minua (punainen piste, kunnes sen haara
// on poissa). Merkki avaa kelluvan paneelin, jossa lajit ovat välilehtinä; prosessi avautuu
// omaan ikkunaansa. `taskfleet run wait` on spinoffinsa kello, ei koskaan prosessi. Poista
// päättyneet poistaa vain prosesseja, eikä "suljet selaimen" -lupausta sanota missään.
// Kierros ottaa palkin käyttöön viemällä `strip = true`; `STRIP` antaa tilan ja tarinan.
(() => {
const IC = {
  term: SVG('<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="m7.5 9.5 3 2.5-3 2.5M13 15h3.5"/>'),
  stop: SVG('<rect x="7" y="7" width="10" height="10" rx="1.5"/>'),
  fail: SVG('<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6M15 9l-6 6"/>'),
  warn: SVG('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4M12 17h.01"/>'),
  spin: SVG('<circle cx="7" cy="6" r="2"/><path d="M7 8v10"/><path d="M7 12c0 3 3 4 7 4"/><circle cx="17" cy="16" r="2"/>'),
  merge: SVG('<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 8v8"/><path d="M6 8c0 3 4 4 10 4"/>'),
  wake: SVG('<path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6z"/><path d="M10 19.5a2 2 0 0 0 4 0"/>'),
  trash: SVG('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>'),
  x: SVG('<path d="M6 6l12 12M18 6 6 18"/>'),
};
const T0 = performance.now(); const BASE = 14 * 3600 + 37 * 60;
const nowS = () => BASE + Math.floor((performance.now() - T0) / 1000);
const T = (h, m, s = 0) => h * 3600 + m * 60 + s;
const hm = (s) => `${Math.floor(s / 3600)}.${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;
const dur = (s) => s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.floor(s / 60) % 60} min`;
const RID = '01m51k8w2c6v9tq4hd7nx3bfza';
// pi-processes' inventory (`wake`: the end starts a turn; `waits`: a recognised wait for a
// spinoff) and Taskfleet's runs for this conversation (`branch`: the preserved branch exists).
const PROCS0 = () => [
  { id: 'proc_7d40', name: 'hidas-testi', cmd: 'python3 -m pytest tests/slow -q', start: T(14, 35, 2), status: 'running', wake: true, out: ['tests/slow/test_backfill.py ........                                  [ 40%]', 'tests/slow/test_history.py ......                                    [ 70%]'] },
  { id: 'proc_8c2e', name: 'testit', cmd: 'ptw tests/ -- -q', start: T(14, 31, 8), status: 'running', wake: false, out: ['Running: pytest tests/ -q', '36 passed in 1.42s', 'Odotetaan muutoksia…'] },
  { id: 'proc_3f1a', name: 'sivu', cmd: 'python3 -u -m http.server 8000 --directory site', start: T(14, 34, 18), status: 'running', wake: false, out: ['Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...'] },
  { id: 'proc_51d0', name: 'haku', cmd: 'python3 scripts/fetch_status.py --since 2026-09-01', start: T(14, 34, 30), end: T(14, 35, 11), status: 'exited', code: 0, wake: true, out: ['haettu 1 240 issueta 26 sivulta', 'valmis 41 s'] },
  { id: 'proc_0b77', name: 'kello', cmd: 'python3 scripts/watch_status.py --interval 60', start: T(14, 35, 40), end: T(14, 35, 42), status: 'exited', code: 1, wake: true, out: ["ModuleNotFoundError: No module named 'watchdog'"] },
  { id: 'proc_c911', name: 'odota-readme', cmd: `taskfleet run wait ${RID} --output json`, start: T(14, 33, 40), status: 'running', wake: true, waits: 's1', out: [] },
];
const SPIN0 = () => [
  { id: 's1', rid: RID, title: 'README: --today-esimerkki', st: 'working', start: T(14, 33, 31) },
  { id: 's4', rid: '01m51m3q8z5c1rv7kd2tx6hnwe', title: 'Testit aikavyöhykkeille', st: 'working', start: T(14, 30, 12) },
  { id: 's2', rid: '01m51h2d7q0x4kc8vbe9t5mwra', title: 'CI: pip-välimuisti', st: 'merged', start: T(14, 12, 4), end: T(14, 21, 40) },
  { id: 's3', rid: '01m51j6r3n8w2ty5qc0hd4ks1v', title: 'Aikavyöhyke tulosteeseen', st: 'failed', branch: 'wt/j6r-timezone', start: T(14, 14, 50), end: T(14, 29, 3) },
];
const LIVE_ST = new Set(['running', 'terminating', 'terminate_timeout']);
const B = { procs: PROCS0(), spins: SPIN0(), open: null, win: null, follow: true, ended: {}, conv: 'c1' };
const waitFor = (s) => B.procs.find(p => p.waits === s.id && LIVE_ST.has(p.status));
function facts(kind) {
  if (kind === 'spin') {
    const all = B.spins.map(s => ({ kind, id: s.id, s, live: s.st === 'working' || s.st === 'unknown', waited: !!waitFor(s), attn: s.st === 'failed' && !!s.branch }));
    const live = [...all.filter(i => i.live && i.waited), ...all.filter(i => i.live && !i.waited)];
    return { all, live, ended: all.filter(i => !i.live), bell: !UI.working && live.some(i => i.waited), attn: all.filter(i => i.attn).length };
  }
  const all = B.procs.filter(p => !p.waits).map(p => ({ kind, id: p.id, p, live: LIVE_ST.has(p.status), waited: p.wake && LIVE_ST.has(p.status) }));
  const live = [...all.filter(i => i.live && i.waited), ...all.filter(i => i.live && !i.waited)];
  return { all, live, ended: all.filter(i => !i.live), bell: !UI.working && live.some(i => i.waited), attn: 0 };
}
const KIND = { spin: { label: 'Spinoffit', icon: IC.spin, word: 'työskentelee' }, proc: { label: 'Prosessit', icon: IC.term, word: 'käynnissä' } };
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function sentence(kind) {
  const f = facts(kind); const k = KIND[kind];
  return [`${k.label}: ${f.live.length ? `${f.live.length} ${k.word}` : 'ei käynnissä'}`, f.bell ? `agentti odottaa: ${f.live.filter(i => i.waited).map(i => i.s?.title ?? i.p.name).join(', ')}` : '', f.attn ? `${f.attn} ei mergetty, työ tallessa` : '', f.ended.length ? count(f.ended.length, 'päättynyt', 'päättynyttä') : ''].filter(Boolean).join(', ');
}
const since = (t) => `<span data-since="${t}">${dur(Math.max(0, nowS() - t))}</span>`;
function row(i) {
  if (i.kind === 'spin') {
    const s = i.s;
    const mark = i.live ? '<span class="pr-dot run"></span>' : `<span class="sp-mk ${s.st}">${s.st === 'merged' ? IC.merge : IC.warn}</span>`;
    const meta = s.st === 'working' ? since(s.start) : `<span class="bg-label">${s.st === 'merged' ? 'Mergetty' : s.st === 'unknown' ? 'Tila ei tiedossa' : s.branch ? 'Ei mergetty · työ tallessa' : 'Ei mergetty'}</span>`;
    const stop = i.waited ? `<button type="button" class="icon-btn bg-stop" data-bg="unwait" data-id="${s.id}" aria-label="Lopeta odotus: ${esc(s.title)}" title="Lopettaa agentin odotuksen. Spinoff jatkaa työtään, eikä agentti saa ilmoitusta.">${IC.stop}</button>` : '<span class="bg-act-gap" aria-hidden="true"></span>';
    return `<div class="bg-row sp ${s.st}"><button type="button" class="bg-main" data-bg="openspin" data-id="${s.id}"><span class="bg-mark" aria-hidden="true">${mark}</span><span class="bg-name sp-name">${esc(s.title)}</span><span class="bg-meta">${meta}</span></button>${i.waited ? `<span class="bg-wake" role="img" aria-label="Agentti odottaa tätä">${IC.wake}</span>` : ''}${stop}</div>`;
  }
  const p = i.p;
  const mark = p.status === 'running' ? '<span class="pr-dot run"></span>' : p.status === 'killed' ? '<span class="pr-dot killed"></span>' : p.code === 0 ? `<span class="pr-ic ok">${ICON_CHECK}</span>` : `<span class="pr-ic err">${IC.fail}</span>`;
  const meta = p.status === 'running' ? since(p.start) : p.status === 'killed' ? `<span class="bg-label">Pysäytetty</span> ${hm(p.end)}` : p.code === 0 ? `<span class="bg-label">Valmis</span> ${hm(p.end)}` : `<span class="bg-label">Virhe · koodi ${p.code}</span>`;
  const stop = i.live ? `<button type="button" class="icon-btn bg-stop" data-bg="stop" data-id="${p.id}" aria-label="Pysäytä ${esc(p.name)}">${IC.stop}</button>` : '<span class="bg-act-gap" aria-hidden="true"></span>';
  // Jari 16.10.2026: the name, then a short piece of the command; the row opens a window.
  return `<div class="bg-row ${p.code > 0 ? 'fail' : ''}"><button type="button" class="bg-main" data-bg="win" data-id="${p.id}" aria-haspopup="dialog"><span class="bg-mark" aria-hidden="true">${mark}</span><span class="bg-name mono">${esc(p.name)}</span><span class="bg-cmd mono">${esc(p.cmd)}</span><span class="bg-meta">${meta}</span></button>${i.waited ? `<span class="bg-wake" role="img" aria-label="Agentti odottaa tätä">${IC.wake}</span>` : ''}${stop}</div>`;
}
function kindList(kind) {
  const f = facts(kind); const k = KIND[kind];
  const live = f.live.length ? `<div class="bg-group" role="group" aria-label="${k.label}: ${k.word}">${f.live.map(row).join('')}</div>` : `<p class="bg-empty">Ei ${kind === 'spin' ? 'työskenteleviä spinoffeja' : 'käynnissä olevia prosesseja'}.</p>`;
  const open = B.ended[kind] ?? (kind === 'spin' && f.attn > 0);
  const clear = kind === 'proc' && open ? `<button type="button" class="bg-clear" data-bg="clear" title="Poistaa päättyneet prosessit ja niiden lokit. Päättyneet spinoffit jäävät: ne ovat Taskfleetin ajoja.">${IC.trash}<span>Poista päättyneet</span></button>` : '';
  const ended = f.ended.length ? `<div class="bg-endhead"><button type="button" class="bg-endfold" data-bg="endfold" data-key="${kind}" aria-expanded="${open}">${CHEV}<span>${count(f.ended.length, 'päättynyt', 'päättynyttä')}</span>${f.attn && !open ? '<span class="bg-attn-dot" role="img" aria-label="Vaatii huomiota"></span>' : ''}</button>${clear}</div>${open ? `<div class="bg-group" role="group" aria-label="${k.label}: päättyneet">${f.ended.map(row).join('')}</div>` : ''}` : '';
  return `${live}${ended}${kind === 'spin' ? '<p class="bg-life">Spinoffit ovat Taskfleetin ajoja; selain vain näyttää ne.</p>' : ''}`;
}
function badge(kind) {
  const f = facts(kind); if (!f.all.length) return '';
  return `<button type="button" class="bg-badge ${kind}${f.live.length ? '' : ' idle'}" data-bg="kind" data-key="${kind}" aria-expanded="${B.open === kind}" aria-label="${esc(sentence(kind))}" title="${esc(sentence(kind))}"><span class="bg-kind-ic">${KIND[kind].icon}</span><span class="bg-n">${f.live.length}</span>${f.bell ? `<span class="bg-corner wait" aria-hidden="true">${IC.wake}</span>` : ''}${f.attn ? '<span class="bg-corner attn" aria-hidden="true"></span>' : ''}</button>`;
}
function stripHtml() {
  const kinds = ['spin', 'proc'].filter(k => facts(k).all.length);
  if (!kinds.length) return '';
  if (B.open && !kinds.includes(B.open)) B.open = null;
  const tabs = kinds.map(k => `<button type="button" role="tab" class="bg-tab" data-bg="kind" data-key="${k}" aria-selected="${B.open === k}"><span class="bg-kind-ic">${KIND[k].icon}</span>${KIND[k].label}<span class="bg-tab-n">${facts(k).live.length}</span></button>`).join('');
  const pop = B.open ? `<div class="bg-pop"><div class="bg-tabs" role="tablist" aria-label="Taustatyö">${tabs}<button type="button" class="icon-btn bg-x" data-bg="close" aria-label="Sulje">${IC.x}</button></div><div class="bg-pop-body" role="tabpanel">${kindList(B.open)}</div></div>` : '';
  return `<div class="bg-badges-wrap">${pop}<div class="bg-badges" role="group" aria-label="Taustatyö">${kinds.map(badge).join('')}</div></div>`;
}
// The process window: output with follow or pause, stop, force stop and clearing what has
// finished (pi-processes clears finished processes together).
function winHtml(p) {
  const live = LIVE_ST.has(p.status);
  const state = p.status === 'running' ? 'Käynnissä' : p.status === 'killed' ? 'Pysäytetty' : p.code === 0 ? 'Valmis' : `Virhe · koodi ${p.code}`;
  const acts = live
    ? `<button type="button" class="secondary" data-bg="stop" data-id="${p.id}">${IC.stop}<span>Pysäytä</span></button><button type="button" class="quiet" data-bg="kill" data-id="${p.id}">Pakota lopetus</button>`
    : `<button type="button" class="secondary" data-bg="clear">${IC.trash}<span>Poista päättyneet</span></button>`;
  return `<div class="bg-win" role="dialog" aria-modal="true" aria-label="Prosessi ${esc(p.name)}"><div class="bg-win-head"><span class="bg-win-title mono">${esc(p.name)}</span><span class="bg-win-state">${state}</span><button type="button" class="icon-btn bg-x" data-bg="winclose" aria-label="Sulje">${IC.x}</button></div><div class="bg-cmd mono wrap">$ ${esc(p.cmd)}</div><div class="bg-win-follow"><button type="button" class="quiet" data-bg="follow" aria-pressed="${!B.follow}">${B.follow ? 'Pysäytä seuraaminen' : 'Seuraa loppua'}</button></div><div class="bg-out" tabindex="0" aria-label="Prosessin tuloste">${p.out.map(l => `<div class="ln"><span class="t">${esc(l)}</span></div>`).join('')}</div><div class="bg-acts">${acts}</div></div>`;
}
const strip = document.createElement('section'); strip.className = 'bg-strip'; strip.setAttribute('aria-label', 'Taustatyö');
const win = document.createElement('div'); win.className = 'bg-win-scrim';
function paintStrip() {
  const anchor = uiCol.querySelector('.recap-host') || uiCol.querySelector('.composer');
  if (anchor && strip.nextSibling !== anchor) uiCol.insertBefore(strip, anchor);
  const html = UI.sel !== B.conv ? '' : stripHtml();
  strip.hidden = !html;
  if (strip.dataset.html !== html) { strip.innerHTML = html; strip.dataset.html = html; }
  const p = B.win && B.procs.find(x => x.id === B.win);
  if (!win.isConnected) uiFrame.append(win);
  win.hidden = !p; win.innerHTML = p ? winHtml(p) : '';
}
APP.painted.push(paintStrip);
setInterval(() => { for (const el of strip.querySelectorAll('[data-since]')) el.textContent = dur(Math.max(0, nowS() - +el.dataset.since)); }, 1000);
function act(t) {
  const a = t.dataset.bg; const id = t.dataset.id; const p = B.procs.find(x => x.id === id);
  if (a === 'kind') B.open = B.open === t.dataset.key && t.classList.contains('bg-badge') ? null : t.dataset.key;
  else if (a === 'close') B.open = null;
  else if (a === 'endfold') { const k = t.dataset.key; B.ended[k] = !(B.ended[k] ?? (k === 'spin' && facts(k).attn > 0)); }
  else if (a === 'win') { B.win = id; B.follow = true; }
  else if (a === 'winclose') B.win = null;
  else if (a === 'follow') B.follow = !B.follow;
  else if (a === 'stop' || a === 'kill') { p.status = 'killed'; p.end = nowS(); toast(`Prosessi ${p.name} pysäytettiin. Agentti ei saa tästä ilmoitusta.`); }
  else if (a === 'unwait') { const w = waitFor(B.spins.find(s => s.id === id)); if (w) { w.status = 'killed'; w.end = nowS(); } toast('Odotus lopetettiin. Spinoff jatkaa työtään.'); }
  else if (a === 'clear') { B.procs = B.procs.filter(x => x.waits || LIVE_ST.has(x.status)); B.win = null; toast('Päättyneet prosessit ja niiden lokit poistettiin. Spinoffit jäävät.'); }
  else if (a === 'openspin') return toast(`Avaa spinoffin ${B.spins.find(s => s.id === id).title} vain luku -näkymän.`);
  paint();
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('.bg-strip [data-bg], .bg-win [data-bg]'); if (!t) return;
  e.preventDefault(); e.stopPropagation(); act(t);
}, true);
document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; if (B.win) B.win = null; else if (B.open) B.open = null; else return; paint(); });
// A round replaces the story with its own facts and resets the view.
window.STRIP = { B, reset: () => Object.assign(B, { procs: PROCS0(), spins: SPIN0(), open: null, win: null, ended: {} }), facts };
})();
