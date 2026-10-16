// Kierros 16.10.2026: agentin taustaprosessit selaimessa (issue proto-processes).
// Pi:n pi-processes-laajennus omistaa prosessit; näkymä näyttää sen inventaarion, yhden
// prosessin yhdistetyn tulosteen elävänä ja pysäytyksen. Kolme suuntaa eroavat siinä,
// missä prosessit asuvat keskusteluun nähden; sisältö, tilat ja toiminnot ovat samat.
(() => {
const IC = {
  term: SVG('<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="m7.5 9.5 3 2.5-3 2.5M13 15h3.5"/>'),
  stop: SVG('<rect x="7" y="7" width="10" height="10" rx="1.5"/>'),
  pause: SVG('<path d="M9 6.5v11M15 6.5v11"/>'),
  follow: SVG('<path d="M12 5v13"/><path d="m6.5 12.5 5.5 5.5 5.5-5.5"/>'),
  back: SVG('<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>'),
  fail: SVG('<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6M15 9l-6 6"/>'),
  warn: SVG('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4M12 17h.01"/>'),
  win: SVG('<path d="M14 4h6v6"/><path d="M20 4l-8 8"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>'),
};

// ---------- Synthetic native facts ----------
// The conversation started 13.10. at 14.28; the page opens at 14.37:00 and the clock runs.
const T0 = performance.now(); const BASE = 14 * 3600 + 37 * 60;
const nowS = () => BASE + Math.floor((performance.now() - T0) / 1000);
const hm = (s) => `${Math.floor(s / 3600)}.${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;
const hms = (s) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const dur = (s) => s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.floor(s / 60) % 60} min`;
const at = (h, m, s = 0) => h * 3600 + m * 60 + s;
const access = (s, path, code = 200) => ({ s: 'err', t: `127.0.0.1 - - [13/Oct/2026 ${hms(s)}] "GET ${path} HTTP/1.1" ${code} -` });
const dots = (n, fail) => '.'.repeat(n - (fail ? 1 : 0)) + (fail ? 'F' : '') + ' '.repeat(Math.max(1, 73 - n)) + '[100%]';
const ptwRun = (s, changed, fail) => [
  ...(changed ? [{ s: 'out', t: '' }, { s: 'out', t: `[${hms(s)}] Change detected: ${changed}` }] : []),
  { s: 'out', t: `[Tue Oct 13 ${hms(s)} 2026] Running: py.test tests/ -q` },
  { s: 'out', t: dots(35, fail) },
  ...(fail ? [
    '=================================== FAILURES ===================================',
    '______________________________ test_since_default ______________________________',
    '', '    def test_since_default(sample):', '        rows = status_rows.select(sample)',
    '>       assert len(rows) == 4', 'E       AssertionError: expected 4 rows, got 5', '',
    'tests/test_status_rows.py:118: AssertionError',
    '=========================== short test summary info ============================',
    'FAILED tests/test_status_rows.py::test_since_default - AssertionError: expected 4 rows, got 5',
    '1 failed, 34 passed in 0.31s',
  ].map(t => ({ s: 'out', t })) : [{ s: 'out', t: '35 passed in 0.29s' }]),
];
const ISSUES = ['daemon: historian lohkoluku', 'web: kontrollitilat', 'provision: sysusers-malli', 'web: vuoron asettelu', 'gateway: istunnon uusinta', 'daemon: kiintiön luku', 'web: tilannekatsaus', 'docs: arkkitehtuurin kartta'];
function procs0() {
  return [
    { id: 'proc_8c2e', name: 'testit', cmd: 'ptw tests/ -- -q', start: at(14, 31, 8), status: 'running', omitted: 0,
      lines: [...ptwRun(at(14, 31, 8)), ...ptwRun(at(14, 34, 51), 'scripts/status_rows.py'), ...ptwRun(at(14, 36, 12), 'tests/test_status_rows.py', true)] },
    { id: 'proc_3f1a', name: 'sivu', cmd: 'python3 -u -m http.server 8000 --directory site', start: at(14, 34, 18), status: 'running', omitted: 0,
      lines: [{ s: 'out', t: 'Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...' }, access(at(14, 34, 20), '/'), access(at(14, 34, 20), '/status.css'),
        { s: 'err', t: `127.0.0.1 - - [13/Oct/2026 ${hms(at(14, 34, 21))}] code 404, message File not found` }, access(at(14, 34, 21), '/favicon.ico', 404),
        ...Array.from({ length: 14 }, (_, i) => access(at(14, 34, 24) + i * 11, '/status.json'))] },
    // The agent wrote the token into the command; the host shows it redacted.
    { id: 'proc_51d0', name: 'haku', cmd: 'GITHUB_TOKEN=••• python3 scripts/fetch_status.py --since 2026-09-01', start: at(14, 34, 30), end: at(14, 35, 11), status: 'exited', code: 0, omitted: 1186,
      lines: [...Array.from({ length: 56 }, (_, i) => ({ s: 'out', t: `#${1185 + i}  ${ISSUES[i % ISSUES.length].padEnd(32)} ${i % 3 ? 'valmis' : 'kesken'}` })),
        { s: 'out', t: 'haettu 1 240 issueta 26 sivulta' }, { s: 'err', t: 'varoitus: 3 issueta ilman päivämäärää ohitettiin' }, { s: 'out', t: 'kirjoitettu status.md: 62 riviä, 4 viikkoa' }, { s: 'out', t: 'valmis 41 s' }] },
    { id: 'proc_0b77', name: 'kello', cmd: 'python3 scripts/watch_status.py --interval 60', start: at(14, 35, 40), end: at(14, 35, 42), status: 'exited', code: 1, omitted: 0,
      lines: ['Traceback (most recent call last):', '  File "scripts/watch_status.py", line 7, in <module>', '    from watchdog.observers import Observer', "ModuleNotFoundError: No module named 'watchdog'"].map(t => ({ s: 'err', t })) },
  ];
}

// ---------- Round state ----------
const P = { v: 'v1', scn: 'live', procs: procs0(), sel: null, open: false, phoneSel: false, stuckNext: false };
const F = {}; // per process view: { follow, fresh }
const fv = (id) => (F[id] ??= { follow: true, fresh: 0 });
const proc = (id) => P.procs.find(p => p.id === id);
const LIVE_ST = new Set(['running', 'terminating', 'terminate_timeout']);
const running = () => P.procs.filter(p => LIVE_ST.has(p.status));
const finished = () => P.procs.filter(p => !LIVE_ST.has(p.status));
const SCN = {
  live: { label: 'Prosesseja käynnissä' },
  stuck: { label: 'Pysäytys jumittuu' },
  empty: { label: 'Ei prosesseja' },
  stopped: { label: 'Pi ei käynnissä', why: 'Pi ei ole käynnissä, joten keskustelulla ei ole prosesseja. Kun Pi pysähtyy, esimerkiksi palvelun uudelleenkäynnistyksessä, sen käynnistämät prosessit pysähtyvät ja niiden lokit poistuvat.', short: 'Pi ei ole käynnissä' },
  terminal: { label: 'Terminaalista ohjattu', why: 'Tätä keskustelua ohjataan terminaalista. Sen prosessit näkyvät siellä komennolla /ps, eivät selaimessa.', short: 'Ohjataan terminaalista' },
  noext: { label: 'Ei laajennusta', why: 'Prosessit näkyvät, kun Pi:hin on asennettu pi-processes-laajennus.', short: 'Laajennusta ei ole' },
};
const avail = () => ['live', 'stuck', 'empty'].includes(P.scn) ? 'available' : 'unavailable';
const EMPTY_TEXT = 'Agentti ei ole käynnistänyt taustaprosesseja tässä keskustelussa.';
const LIFE_TEXT = 'Prosessit jatkavat, vaikka suljet selaimen, ja pysähtyvät Pi:n mukana.';

// ---------- Pieces shared by every direction ----------
function stInfo(p) {
  const n = nowS();
  switch (p.status) {
    case 'running': return { cls: 'run', mark: '<span class="pr-dot run"></span>', label: 'Käynnissä', meta: `<span data-dur="${p.id}">${dur(n - p.start)}</span>` };
    case 'terminating': return { cls: 'stopping', mark: '<span class="pr-dot stopping"></span>', label: 'Pysäytetään…', meta: 'SIGTERM lähetetty' };
    case 'terminate_timeout': return { cls: 'stuck', mark: `<span class="pr-ic err">${IC.warn}</span>`, label: 'Ei pysähtynyt', meta: '3 s ilman vastausta' };
    case 'killed': return { cls: 'killed', mark: '<span class="pr-dot killed"></span>', label: 'Pysäytetty', meta: `${hm(p.end)} · ${p.signal}` };
    default: return p.code === 0
      ? { cls: 'ok', mark: `<span class="pr-ic ok">${ICON_CHECK}</span>`, label: 'Valmis', meta: `${hm(p.end)} · ${dur(p.end - p.start)}` }
      : { cls: 'fail', mark: `<span class="pr-ic err">${IC.fail}</span>`, label: `Virhe · koodi ${p.code}`, meta: `${hm(p.end)} · ${dur(p.end - p.start)}` };
  }
}
const stopBtn = (p, cls = 'icon-btn') => p.status === 'terminate_timeout'
  ? `<button type="button" class="pr-force" data-pact="force" data-id="${p.id}" title="Lähettää SIGKILL-signaalin koko prosessiryhmälle">Pakota lopetus</button>`
  : LIVE_ST.has(p.status) ? `<button type="button" class="${cls} pr-stop" data-pact="stop" data-id="${p.id}" aria-label="Pysäytä ${p.name}" title="Pysäytä prosessi ${p.name}. Agentti ei saa tästä ilmoitusta."${p.status === 'terminating' ? ' aria-disabled="true"' : ''}>${IC.stop}</button>` : '';
// One inventory row. `extra` carries the direction's own trailing controls.
function row(p, { selected = false, expandable = false, stop = true } = {}) {
  const s = stInfo(p);
  const open = expandable ? ` aria-expanded="${selected}"` : selected ? ' aria-current="true"' : '';
  return `<div class="pr-row ${s.cls}${selected ? ' sel' : ''}" data-row="${p.id}">
<button type="button" class="pr-main" data-pact="open" data-id="${p.id}"${open}>${expandable ? CHEV : ''}<span class="pr-mark" aria-hidden="true">${s.mark}</span><span class="pr-name mono">${esc(p.name)}</span><span class="pr-cmd mono">${esc(p.cmd)}</span><span class="pr-meta"><span class="pr-label">${s.label}</span><span class="pr-sep" aria-hidden="true">·</span>${s.meta}</span></button>${stop ? stopBtn(p) : ''}</div>`;
}
function list(opts = {}) {
  if (avail() === 'unavailable') return `<p class="pr-why">${SCN[P.scn].why}</p>`;
  if (!P.procs.length) return `<p class="pr-why">${EMPTY_TEXT}</p>`;
  const r = running(), f = finished();
  return `${r.length ? `<div class="pr-group" role="group" aria-label="Käynnissä">${r.map(p => row(p, { ...opts, selected: P.sel === p.id })).join('')}</div>` : ''}
${f.length ? `<h4 class="pr-h">Päättyneet</h4><div class="pr-group" role="group" aria-label="Päättyneet">${f.map(p => row(p, { ...opts, selected: P.sel === p.id })).join('')}</div>` : ''}
<p class="pr-life">${LIFE_TEXT}</p>`;
}
// One process's combined output: stdout and stderr in arrival order, stderr marked in
// the gutter (many tools log there; it is not an error colour). Follows the end until
// the reader scrolls up or pauses; Seuraa returns to the end.
function lineHTML(l) { return `<div class="ln${l.s === 'err' ? ' e' : ''}"><span class="g" aria-label="${l.s === 'err' ? 'stderr' : 'stdout'}">${l.s === 'err' ? '2' : ''}</span><span class="t">${esc(l.t) || ' '}</span></div>`; }
function outHead(p, { back = false, close = false, win = false } = {}) {
  const s = stInfo(p); const v = fv(p.id); const live = LIVE_ST.has(p.status);
  return `<div class="po-head">${back ? `<button type="button" class="icon-btn" data-pact="back" aria-label="Takaisin listaan" title="Takaisin listaan">${IC.back}</button>` : ''}
<span class="pr-mark" aria-hidden="true">${s.mark}</span><span class="pr-name mono">${esc(p.name)}</span><span class="po-state ${s.cls}">${s.label}<span class="pr-sep" aria-hidden="true">·</span>${s.meta}</span>
<span class="po-tools">${live ? `<button type="button" class="icon-btn" data-pact="follow" data-id="${p.id}" aria-pressed="${!v.follow}" aria-label="${v.follow ? 'Pysäytä seuraaminen' : 'Seuraa loppua'}" title="${v.follow ? 'Pysäytä seuraaminen. Prosessi jatkaa, ja uudet rivit odottavat.' : 'Seuraa loppua'}">${v.follow ? IC.pause : IC.follow}</button>` : ''}
<button type="button" class="icon-btn" data-pcopy="${p.id}" aria-label="Kopioi tuloste" title="Kopioi näkyvä tuloste">${ICON_COPY}</button>
${win ? `<button type="button" class="icon-btn" data-pact="win" data-id="${p.id}" aria-label="Avaa omaan ikkunaan" title="Avaa omaan ikkunaan">${IC.win}</button>` : ''}${stopBtn(p)}${close ? `<button type="button" class="icon-btn" data-pact="close" aria-label="Sulje" title="Sulje">${ICON_CLOSE}</button>` : ''}</span></div>
<div class="po-cmd"><span class="mono">$ ${esc(p.cmd)}</span><span class="po-since">alkoi ${hm(p.start)}</span></div>`;
}
function outBody(p) {
  const v = fv(p.id);
  const tail = p.omitted ? `<div class="po-mark">Alusta jätetty pois ${p.omitted.toLocaleString('fi-FI')} riviä · näytetään viimeiset ${p.lines.length}</div>` : '';
  const ended = !LIVE_ST.has(p.status) ? `<div class="po-end">${p.status === 'killed' ? `Pysäytetty ${hm(p.end)} (${p.signal})` : `Päättyi ${hm(p.end)} · koodi ${p.code}`}</div>` : '';
  return `<div class="po-wrap"><div class="po-body" role="log" aria-label="Tuloste: ${esc(p.name)}" tabindex="0" data-body="${p.id}">${tail}${p.lines.map(lineHTML).join('')}${ended}</div>
<button type="button" class="po-resume" data-pact="resume" data-id="${p.id}"${v.follow ? ' hidden' : ''}>${IC.follow}<span>${v.fresh ? `${v.fresh} uutta riviä · ` : ''}Seuraa</span></button></div>`;
}
const outView = (p, o = {}) => `<div class="po" data-out="${p.id}">${outHead(p, o)}${outBody(p)}</div>`;

// ---------- Live: new lines, follow and pause ----------
let prog = false;
const toEnd = (b) => { prog = true; b.scrollTop = b.scrollHeight; requestAnimationFrame(() => { prog = false; }); };
function push(id, lines) {
  const p = proc(id); if (!p || !LIVE_ST.has(p.status)) return;
  p.lines.push(...lines);
  const v = fv(id);
  for (const b of document.querySelectorAll(`[data-body="${id}"]`)) {
    b.insertAdjacentHTML('beforeend', lines.map(lineHTML).join(''));
    if (v.follow) toEnd(b);
  }
  if (!v.follow) { v.fresh += lines.length; syncResume(id); }
}
function syncResume(id) {
  const v = fv(id);
  for (const r of document.querySelectorAll(`.po-resume[data-id="${id}"]`)) { r.hidden = v.follow; r.querySelector('span').textContent = `${v.fresh ? `${v.fresh} uutta riviä · ` : ''}Seuraa`; }
  for (const b of document.querySelectorAll(`[data-out="${id}"] [data-pact="follow"]`)) {
    b.setAttribute('aria-pressed', !v.follow); b.innerHTML = v.follow ? IC.pause : IC.follow;
    b.setAttribute('aria-label', v.follow ? 'Pysäytä seuraaminen' : 'Seuraa loppua'); b.title = v.follow ? 'Pysäytä seuraaminen. Prosessi jatkaa, ja uudet rivit odottavat.' : 'Seuraa loppua';
  }
}
function setFollow(id, on) {
  const v = fv(id); v.follow = on; if (on) v.fresh = 0;
  if (on) for (const b of document.querySelectorAll(`[data-body="${id}"]`)) toEnd(b);
  syncResume(id);
}
// Only the reader's own scrolling pauses following; growth does not.
let intentAt = -1e9;
for (const ev of ['wheel', 'touchmove', 'keydown', 'pointerdown']) document.addEventListener(ev, (e) => { if (e.target.closest?.('.po-body')) intentAt = performance.now(); }, { capture: true, passive: true });
document.addEventListener('scroll', (e) => {
  const b = e.target; if (!(b instanceof Element) || !b.matches('.po-body') || prog) return;
  if (performance.now() - intentAt > 600) return;
  const id = b.dataset.body; const atEnd = b.scrollHeight - b.scrollTop - b.clientHeight < 6;
  const v = fv(id);
  if (!atEnd && v.follow && LIVE_ST.has(proc(id)?.status)) { v.follow = false; syncResume(id); }
  else if (atEnd && !v.follow) setFollow(id, true);
}, true);
const settleBodies = () => requestAnimationFrame(() => { for (const b of document.querySelectorAll('[data-body]')) if (fv(b.dataset.body).follow || !LIVE_ST.has(proc(b.dataset.body)?.status)) toEnd(b); });

// The page polls the preview server; the watcher re-runs when the agent's patch lands.
let tick = 0; let patched = false;
setInterval(() => {
  tick++;
  for (const el of document.querySelectorAll('[data-dur]')) { const p = proc(el.dataset.dur); if (p) el.textContent = dur(nowS() - p.start); }
  if (avail() !== 'available' || P.scn === 'empty') return;
  if (tick % 3 === 0) push('proc_3f1a', [access(nowS(), '/status.json')]);
  if (tick % 17 === 0) push('proc_3f1a', [access(nowS(), '/'), access(nowS(), '/status.css', 304)]);
}, 1000);
new MutationObserver(() => {
  const done = /patched scripts\/status_rows\.py/.test(stage.textContent);
  if (!done) { patched = false; return; }
  if (patched) return; patched = true;
  const s = nowS(); const run = ptwRun(s + 1, 'scripts/status_rows.py');
  run.forEach((l, i) => setTimeout(() => push('proc_8c2e', [l]), 300 + i * (i < 3 ? 250 : 500)));
}).observe(stage, { subtree: true, childList: true, characterData: true });

// ---------- Stop ----------
function stop(id, force = false) {
  const p = proc(id); if (!p || !LIVE_ST.has(p.status) || (p.status === 'terminating' && !force)) return;
  const hang = !force && P.stuckNext; if (hang) P.stuckNext = false;
  p.status = 'terminating'; repaint();
  setTimeout(() => {
    if (hang) { p.status = 'terminate_timeout'; repaint(); toast(`${p.name} ei pysähtynyt SIGTERM-signaaliin. Voit pakottaa lopetuksen.`); return; }
    p.status = 'killed'; p.end = nowS(); p.signal = force ? 'SIGKILL' : 'SIGTERM'; fv(id).follow = true; fv(id).fresh = 0;
    repaint(); toast(`${p.name} pysäytetty. Agentti ei saa tästä ilmoitusta; kerro sille tarvittaessa.`);
  }, force ? 400 : hang ? 3000 : 1100);
}

// ---------- Directions ----------
const host = { pop: null, dlg: null, panel: null, tray: null };
function ensureHosts() {
  if (!host.pop) { host.pop = document.createElement('div'); host.pop.className = 'pr-pop'; host.pop.hidden = true; uiMain.appendChild(host.pop); }
  if (!host.dlg) { host.dlg = document.createElement('dialog'); host.dlg.className = 'pr-dlg'; document.body.appendChild(host.dlg); host.dlg.addEventListener('close', () => { if (P.v === 'v1') { P.sel = null; } }); }
  if (!host.panel) { host.panel = document.createElement('aside'); host.panel.className = 'pr-panel'; host.panel.setAttribute('aria-label', 'Prosessit'); uiBody.appendChild(host.panel); }
  if (!host.tray) { host.tray = document.createElement('section'); host.tray.className = 'pr-tray'; host.tray.setAttribute('aria-label', 'Prosessit'); }
  const anchor = uiCol.querySelector('.recap-host') || uiCol.querySelector('.composer');
  if (host.tray.nextSibling !== anchor) uiCol.insertBefore(host.tray, anchor);
}
const countBadge = () => { const n = running().length; return n ? `<span class="pr-badge">${n}</span>` : ''; };
const libActions = topActions;
APP.actions = (c) => {
  const base = libActions(c); if (c.id !== 'c1') return base;
  if (P.v === 'v1') {
    if (avail() !== 'available' || !P.procs.length) return base;
    const n = running().length;
    return `<button type="button" class="pr-chip${n ? ' on' : ''}" data-pact="pop" aria-expanded="${P.open}" title="Agentin prosessit">${IC.term}<span class="pr-chip-l">${n ? `${n} käynnissä` : 'Prosessit'}</span><span class="pr-chip-n" aria-hidden="true">${n || ''}</span></button>` + base;
  }
  if (P.v === 'v2') return `<button class="icon-btn tb-btn pr-tb${P.open ? ' on' : ''}" type="button" data-pact="panel" aria-expanded="${P.open}" aria-label="Prosessit${running().length ? `, ${running().length} käynnissä` : ''}" title="Prosessit">${IC.term}${countBadge()}</button>` + base;
  return base;
};
// The details popover names the availability in every direction.
const libDetails = detailsList;
detailsList = (c) => {
  const html = libDetails(c); if (c.id !== 'c1') return html;
  const r = running().length;
  const v = avail() === 'unavailable' ? `<span class="sub" style="flex-basis:auto">${SCN[P.scn].short}</span>` : P.procs.length ? `${r} käynnissä, ${finished().length} päättynyttä` : 'ei prosesseja';
  return html.replace('</dl>', `<dt>Prosessit</dt><dd>${v}</dd></dl>`);
};

function paintV2() {
  const on = P.v === 'v2' && P.open;
  host.panel.hidden = !on; uiBody.classList.toggle('pr-docked', on);
  if (!on) return;
  const p = proc(P.sel);
  host.panel.classList.toggle('has-sel', !!p && P.phoneSel);
  const keep = p && host.panel.querySelector(`[data-body="${p.id}"]`);
  const head = `<div class="pp-head"><h3>Prosessit</h3>${avail() === 'available' && P.procs.length ? `<span class="pr-hint">${running().length} käynnissä</span>` : ''}<button type="button" class="icon-btn" data-pact="panel" aria-label="Sulje prosessit" title="Sulje prosessit">${ICON_CLOSE}</button></div>`;
  const listHTML = `<div class="pp-list">${list()}</div>`;
  if (keep) {
    host.panel.querySelector('.pp-headwrap').innerHTML = head; host.panel.querySelector('.pp-listwrap').innerHTML = listHTML;
    swapHead(host.panel, p, { back: true }); refreshEnd(p);
  } else host.panel.innerHTML = `<div class="pp-headwrap">${head}</div><div class="pp-listwrap">${listHTML}</div>${p ? `<div class="pp-out">${outView(p, { back: true })}</div>` : avail() === 'available' && P.procs.length ? '<div class="pp-out pp-none"><p>Valitse prosessi nähdäksesi sen tulosteen.</p></div>' : ''}`;
  settleBodies();
}
function paintV3() {
  const show = P.v === 'v3' && (P.procs.length && avail() === 'available' || ['stopped', 'terminal'].includes(P.scn));
  host.tray.hidden = !show; if (!show) return;
  if (avail() === 'unavailable') { host.tray.innerHTML = `<div class="pt-bar muted"><span class="pt-ic">${IC.term}</span><span class="pt-sum">${SCN[P.scn].why}</span></div>`; return; }
  const r = running(); const p = proc(P.sel);
  const names = (r.length ? r : P.procs).map(x => x.name).join(', ');
  const sum = r.length ? `<strong>${r.length} ${r.length === 1 ? 'prosessi' : 'prosessia'} käynnissä</strong>` : '<strong>Ei käynnissä olevia prosesseja</strong>';
  const bar = `<button type="button" class="pt-bar" data-pact="tray" aria-expanded="${P.open}">${CHEV}<span class="pt-ic">${r.length ? '<span class="pr-dot run"></span>' : IC.term}</span><span class="pt-sum">${sum}<span class="pt-names mono">${esc(names)}</span></span>${finished().length ? `<span class="pt-done">${finished().length} päättynyttä</span>` : ''}</button>`;
  const keep = p && P.open && host.tray.querySelector(`[data-body="${p.id}"]`);
  if (keep) {
    host.tray.querySelector('.pt-barwrap').innerHTML = bar;
    for (const x of P.procs) { const el = host.tray.querySelector(`[data-row="${x.id}"]`); if (el) el.outerHTML = row(x, { expandable: true, selected: P.sel === x.id }); }
    swapHead(host.tray, p, {}); refreshEnd(p); return;
  }
  const rows = P.open ? `<div class="pt-list">${[...r, ...finished()].map(x => row(x, { expandable: true, selected: P.sel === x.id }) + (P.sel === x.id ? `<div class="pt-out">${outView(x, { win: true })}</div>` : '')).join('')}<p class="pr-life">${LIFE_TEXT}</p></div>` : '';
  host.tray.innerHTML = `<div class="pt-barwrap">${bar}</div>${rows}`;
  settleBodies();
}
// Re-render a process view's head without touching its scrolling body.
function swapHead(root, p, o) {
  const po = root.querySelector(`[data-out="${p.id}"]`); if (!po) return;
  const tmp = document.createElement('div'); tmp.innerHTML = outHead(p, o);
  po.querySelector('.po-head').replaceWith(tmp.children[0]); po.querySelector('.po-cmd').replaceWith(tmp.children[0]);
}
function refreshEnd(p) {
  if (LIVE_ST.has(p.status)) return;
  for (const b of document.querySelectorAll(`[data-body="${p.id}"]`)) if (!b.querySelector('.po-end')) { b.insertAdjacentHTML('beforeend', `<div class="po-end">${p.status === 'killed' ? `Pysäytetty ${hm(p.end)} (${p.signal})` : `Päättyi ${hm(p.end)} · koodi ${p.code}`}</div>`); toEnd(b); }
  syncResume(p.id);
}
function repaint() { paint(); }
APP.painted.push(() => { ensureHosts(); paintV1(); paintV2(); paintV3(); });

// ---------- Interactions ----------
document.addEventListener('click', async (e) => {
  const cp = e.target.closest('[data-pcopy]');
  if (cp) { const p = proc(cp.dataset.pcopy); try { await navigator.clipboard.writeText(p.lines.map(l => l.t).join('\n')); } catch {} cp.setAttribute('data-done', ''); setTimeout(() => cp.removeAttribute('data-done'), 1200); toast('Tuloste kopioitu.'); return; }
  const t = e.target.closest('[data-pact]');
  if (!t) { if (P.v === 'v1' && P.open && !e.target.closest('.pr-pop')) { P.open = false; paint(); } return; }
  e.preventDefault(); e.stopPropagation();
  if (t.getAttribute('aria-disabled') === 'true') return;
  const a = t.dataset.pact; const id = t.dataset.id;
  if (a === 'pop') { P.open = !P.open; UI.pop = false; return paint(); }
  if (a === 'panel') { P.open = !P.open; P.phoneSel = false; return paint(); }
  if (a === 'tray') { P.open = !P.open; return paint(); }
  if (a === 'stop') return stop(id);
  if (a === 'force') return stop(id, true);
  if (a === 'follow') return setFollow(id, !fv(id).follow);
  if (a === 'resume') return setFollow(id, true);
  if (a === 'back') { P.phoneSel = false; if (narrow()) P.sel = null; return paint(); }
  if (a === 'close') { host.dlg.close(); return; }
  if (a === 'win') { P.sel = id; openDlg(id); return; }
  if (a === 'hist') { P.sel = id; if (P.v === 'v1') return openDlg(id); P.open = true; P.phoneSel = true; paint(); if (P.v === 'v3') host.tray.scrollIntoView({ block: 'nearest' }); return; }
  if (a === 'open') {
    if (P.v === 'v1') { P.open = false; P.sel = id; paint(); openDlg(id); return; }
    if (P.v === 'v2') { P.sel = id; P.phoneSel = true; fv(id); return paint(); }
    P.sel = P.sel === id ? null : id; return paint();
  }
}, true);
const narrow = () => uiFrame.getBoundingClientRect().width <= 760;
function openDlg(id) {
  const p = proc(id); host.dlg.innerHTML = outView(p, { close: true }); host.dlg.showModal(); settleBodies();
}
// In the dialog, a status change replaces only the head; lines keep flowing into the body.
function paintV1() {
  host.pop.hidden = !(P.v === 'v1' && P.open);
  if (!host.pop.hidden) host.pop.innerHTML = `<div class="pr-pop-head"><h3>Prosessit</h3><span class="pr-hint">Agentin käynnistämät tässä keskustelussa</span></div>${list()}`;
  if (host.dlg.open) { const p = proc(host.dlg.querySelector('[data-out]')?.dataset.out); if (p) { swapHead(host.dlg, p, { close: true }); refreshEnd(p); } }
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && P.open && P.v === 'v1') { P.open = false; paint(); } });

// History: the agent's own `process` tool calls lead to the same process.
// Inserted after the write in the first thread and after the table run in the third.
const START = [
  [0, 6, { action: 'start', name: 'testit', command: 'ptw tests/ -- -q' }, 'Started testit (proc_8c2e), pid 48211.', 'proc_8c2e'],
  [2, 3, { action: 'start', name: 'sivu', command: 'python3 -u -m http.server 8000 --directory site' }, 'Started sivu (proc_3f1a), pid 48544.', 'proc_3f1a'],
  [2, 4, { action: 'start', name: 'haku', command: 'GITHUB_TOKEN=••• python3 scripts/fetch_status.py --since 2026-09-01' }, 'Started haku (proc_51d0), pid 48551.', 'proc_51d0'],
];
const turns = CONVO.filter(m => m.kind === 'turn');
if (!turns.some(t => t.blocks.some(b => b.name === 'process')))
  for (const [ti, pos, args, result, pid] of START) turns[ti].blocks.splice(pos, 0, { t: 'tool', name: 'process', target: `start · ${args.name}`, args, result, pid });
const libBody = toolBody;
toolBody = (b) => {
  if (b.name !== 'process') return libBody(b);
  const p = proc(b.pid);
  const now = p && avail() === 'available' ? `<div class="pr-hist">${stInfo(p).mark}<span>${esc(p.name)}: ${stInfo(p).label.toLowerCase()}</span><button type="button" class="secondary" data-pact="hist" data-id="${p.id}">Näytä prosessi</button></div>` : '';
  return `<div class="tool-body"><div><h4>Argumentit</h4><dl>${Object.entries(b.args).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div><div><h4>Tulos</h4><pre>${esc(b.result)}</pre>${now}</div></div>`;
};
// ---------- Scenario switch in the page bar (demonstration, not product) ----------
const bar = document.querySelector('.page-bar');
bar.querySelector('.hint').insertAdjacentHTML('beforebegin', `<label>Tilanne <select id="pr-scn">${Object.entries(SCN).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></label>`);
document.getElementById('pr-scn').addEventListener('change', (e) => {
  P.scn = e.target.value; P.sel = null; P.phoneSel = false; if (host.dlg?.open) host.dlg.close();
  P.procs = P.scn === 'live' || P.scn === 'stuck' ? procs0() : [];
  P.stuckNext = P.scn === 'stuck'; for (const k in F) delete F[k];
  paint();
  if (P.scn === 'stuck') toast('Seuraava pysäytys ei saa prosessia loppumaan SIGTERM-signaalilla.');
});

function start(v, open) {
  P.v = v; P.sel = null; P.phoneSel = false; P.open = open; if (host.dlg?.open) host.dlg.close();
  P.procs = P.scn === 'live' || P.scn === 'stuck' ? procs0() : []; P.stuckNext = P.scn === 'stuck'; for (const k in F) delete F[k];
  return appView();
}
window.v1 = () => start('v1', false);
// The panel opens at desktop width with the busiest process selected, as after a click.
window.v2 = () => { const html = start('v2', !document.getElementById('phone').checked); P.sel = 'proc_3f1a'; paint(); return html; };
window.v3 = () => start('v3', false);
})();
