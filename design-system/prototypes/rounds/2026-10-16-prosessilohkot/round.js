// Kierros 16.10.2026: prosessilohkot ja odotustilat (issue proto-processes-blocks).
// Riffi kierroksesta 2026-10-16-prosessit: paikka on valittu suunta 3, Kentän yllä, nyt
// "Poista päättyneet" -painikkeen kanssa. Sama tarina kaikissa suunnissa: agentti
// käynnistää taustaprosesseja, päättynyt prosessi tulee agentille ohjauksena kesken työn
// tai herättää sen, kun vuoro on päättynyt, ja `taskfleet run wait` näkyy spinoffina,
// jota se odottaa. Tilamalliin tulevat "Odottaa prosessia" ja "Odottaa spinoffia".
// Suunnat eroavat vain siinä, kuinka kovaa prosessi puhuu langassa.
(() => {
const IC = {
  term: SVG('<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="m7.5 9.5 3 2.5-3 2.5M13 15h3.5"/>'),
  stop: SVG('<rect x="7" y="7" width="10" height="10" rx="1.5"/>'),
  pause: SVG('<path d="M9 6.5v11M15 6.5v11"/>'),
  follow: SVG('<path d="M12 5v13"/><path d="m6.5 12.5 5.5 5.5 5.5-5.5"/>'),
  fail: SVG('<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6M15 9l-6 6"/>'),
  warn: SVG('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4M12 17h.01"/>'),
  // Same glyph as the spinoff round (proto-spinoff-agents): a branch leaving its parent.
  spin: SVG('<circle cx="7" cy="6" r="2"/><path d="M7 8v10"/><path d="M7 12c0 3 3 4 7 4"/><circle cx="17" cy="16" r="2"/>'),
  merge: SVG('<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 8v8"/><path d="M6 8c0 3 4 4 10 4"/>'),
  // The process will wake the agent when it ends.
  wake: SVG('<path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6z"/><path d="M10 19.5a2 2 0 0 0 4 0"/>'),
  steer: SVG('<path d="M5 4v6a4 4 0 0 0 4 4h10"/><path d="m15 10 4 4-4 4"/>'),
  trash: SVG('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>'),
  ext: SVG('<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/>'),
};

// ---------- Synthetic native facts ----------
// The conversation started 13.10. at 14.28; the page opens at 14.37:00 and the clock runs.
const T0 = performance.now(); const BASE = 14 * 3600 + 37 * 60;
const nowS = () => BASE + Math.floor((performance.now() - T0) / 1000);
const hm = (s) => `${Math.floor(s / 3600)}.${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;
const hms = (s) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const dur = (s) => s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.floor(s / 60) % 60} min`;
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const T = (h, m, s = 0) => h * 3600 + m * 60 + s;
const access = (s, path, code = 200) => ({ s: 'err', t: `127.0.0.1 - - [13/Oct/2026 ${hms(s)}] "GET ${path} HTTP/1.1" ${code} -` });
const dots = (n, fail) => '.'.repeat(n - (fail ? 1 : 0)) + (fail ? 'F' : '') + ' '.repeat(Math.max(1, 73 - n)) + '[100%]';
const ptwRun = (s, changed) => [
  ...(changed ? [{ s: 'out', t: '' }, { s: 'out', t: `[${hms(s)}] Change detected: ${changed}` }] : []),
  { s: 'out', t: `[Tue Oct 13 ${hms(s)} 2026] Running: py.test tests/ -q` }, { s: 'out', t: dots(35) }, { s: 'out', t: '35 passed in 0.29s' },
];
const ISSUES = ['daemon: historian lohkoluku', 'web: kontrollitilat', 'provision: sysusers-malli', 'web: vuoron asettelu', 'gateway: istunnon uusinta', 'daemon: kiintiön luku', 'web: tilannekatsaus', 'docs: arkkitehtuurin kartta'];
// `wake`: the start call's notify config makes the end of this process start a turn
// (the extension's attention "turn"); the host reads it from the start tool result.
function procs0() {
  return [
    { id: 'proc_8c2e', name: 'testit', cmd: 'ptw tests/ -- -q', start: T(14, 31, 8), status: 'running', wake: false, omitted: 0,
      lines: [...ptwRun(T(14, 31, 8)), ...ptwRun(T(14, 34, 51), 'scripts/status_rows.py'), ...ptwRun(T(14, 36, 12), 'tests/test_status_rows.py')] },
    { id: 'proc_3f1a', name: 'sivu', cmd: 'python3 -u -m http.server 8000 --directory site', start: T(14, 34, 18), status: 'running', wake: false, omitted: 0,
      lines: [{ s: 'out', t: 'Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...' }, access(T(14, 34, 20), '/'), access(T(14, 34, 20), '/status.css'),
        ...Array.from({ length: 40 }, (_, i) => access(T(14, 34, 24) + i * 3, '/status.json'))] },
    { id: 'proc_51d0', name: 'haku', cmd: 'GITHUB_TOKEN=••• python3 scripts/fetch_status.py --since 2026-09-01', start: T(14, 34, 30), end: T(14, 35, 11), status: 'exited', code: 0, wake: true, omitted: 1186,
      lines: [...Array.from({ length: 40 }, (_, i) => ({ s: 'out', t: `#${1201 + i}  ${ISSUES[i % ISSUES.length].padEnd(32)} ${i % 3 ? 'valmis' : 'kesken'}` })),
        { s: 'out', t: 'haettu 1 240 issueta 26 sivulta' }, { s: 'err', t: 'varoitus: 3 issueta ilman päivämäärää ohitettiin' }, { s: 'out', t: 'kirjoitettu status.md: 62 riviä, 4 viikkoa' }, { s: 'out', t: 'valmis 41 s' }] },
    { id: 'proc_0b77', name: 'kello', cmd: 'python3 scripts/watch_status.py --interval 60', start: T(14, 35, 40), end: T(14, 35, 42), status: 'exited', code: 1, wake: true, omitted: 0,
      lines: ['Traceback (most recent call last):', '  File "scripts/watch_status.py", line 7, in <module>', '    from watchdog.observers import Observer', "ModuleNotFoundError: No module named 'watchdog'"].map(t => ({ s: 'err', t })) },
  ];
}
// The spinoff the agent starts later in the story; its states are the spinoff round's.
const RID = '01m51k8w2c6v9tq4hd7nx3bfza';
const SP0 = () => ({ id: 'r5t', rid: RID, branch: 'wt/r5t-readme-today', title: 'README: --today-esimerkki', st: 'none', t0: 0, end: 0 });
const SS = {
  working: ['Työskentelee', '<span class="st-dot working"></span>'],
  merged: ['Mergetty', `<span class="sp-mk merged">${IC.merge}</span>`],
  failed: ['Ei mergetty · työ tallessa', `<span class="sp-mk failed">${IC.warn}</span>`],
  none: ['Ei vielä käynnissä', '<span class="st-dot unknown"></span>'],
};

// ---------- Round state ----------
const P = { v: 'v1', scn: 'live', procs: procs0(), removed: new Set(), sel: null, open: false, aw: false, home: false };
let SP = SP0();
const F = {}; // per process view: { follow, fresh }
const fv = (id) => (F[id] ??= { follow: true, fresh: 0 });
const proc = (id) => P.procs.find(p => p.id === id);
const LIVE_ST = new Set(['running', 'terminating', 'terminate_timeout']);
const running = () => P.procs.filter(p => LIVE_ST.has(p.status));
const finished = () => P.procs.filter(p => !LIVE_ST.has(p.status));
const SCN = {
  live: { label: 'Spinoff onnistuu' },
  fail: { label: 'Spinoff ei mergeä' },
  terminal: { label: 'Terminaalista ohjattu', why: 'Tätä keskustelua ohjataan terminaalista. Sen prosessit näkyvät siellä komennolla /ps, eivät selaimessa, joten selain ei tiedä, odottaako agentti niitä.' },
};
const avail = () => P.scn === 'terminal' ? 'unavailable' : 'available';
const LIFE_TEXT = 'Prosessit jatkavat, vaikka suljet selaimen, ja pysähtyvät Pi:n mukana.';

// ---------- The state model: what the agent is waiting for ----------
// The turn has ended and a running process whose end will start a turn exists: the agent
// is waiting for its processes, not for you. A recognised `taskfleet run wait` is the
// spinoff it waits on. Without a process inventory the host does not claim either.
const waitingOn = () => avail() === 'available' ? running().filter(p => p.wake) : [];
function c1State() {
  if (P.aw) return 'working';
  const w = waitingOn();
  if (w.some(p => p.wait)) return 'spinwait';
  if (w.length) return 'procwait';
  return 'waiting';
}
const pst = (c) => c.id === 'c1' ? c1State() : c.st;
STATES.procwait = ['Odottaa prosessia', `<span class="st-proc">${IC.term}</span>`];
STATES.spinwait = ['Odottaa spinoffia', `<span class="st-spin">${IC.spin}</span>`];
// Background work the agent will return from by itself sorts with working, before "Odottaa sinua".
STATE_ORDER.procwait = 1.4; STATE_ORDER.spinwait = 1.5;
// Other conversations in the frame show the new states as they would arrive from the host.
const ws0 = UI.ws.find(w => w.id === 'aurinkokello');
if (!ws0.convs.some(c => c.id === 'p1')) ws0.convs.splice(1, 0, { id: 'p1', title: 'Julkaisu 0.4: valmistelu', st: 'spinwait' });
UI.ws.find(w => w.id === 'issuectl').convs.find(c => c.id === 'c10').st = 'procwait';
const WAIT_TEXT = { p1: 'Jatkaa itse, kun spinoff CI:n pip-välimuisti valmistuu.', c10: 'Jatkaa itse, kun prosessi <span class="mono">bench</span> päättyy.' };

const mark = (s) => { const [l, m] = STATES[s] ?? ['Ei aloitettu', '<span class="st-none"></span>']; return `<span class="st" role="img" aria-label="${l}" title="${l}">${m}</span>`; };
APP.row = (c) => `<a href="#" class="conv-row" data-conv="${c.id}"${c.id === UI.sel && !P.home ? ' aria-current="page"' : ''}><span class="conv-title">${esc(c.title)}</span>${mark(pst(c))}</a>`;
APP.list = (w, convs) => {
  const active = convs.filter(c => pst(c) !== 'done').sort((a, b) => (STATE_ORDER[pst(a)] ?? 4) - (STATE_ORDER[pst(b)] ?? 4));
  const done = convs.filter(c => pst(c) === 'done');
  const open = FOLDED[w.id] || done.some(c => c.id === UI.sel);
  const fold = done.length ? `<li><button type="button" class="done-fold" data-fold-done="${w.id}" aria-expanded="${open}">${CHEV}<span>Valmiit</span><span class="count">${done.length}</span></button></li>${open ? done.map(c => `<li>${APP.row(c)}</li>`).join('') : ''}` : '';
  const rows = active.map(c => `<li>${APP.row(c)}</li>`).join('');
  return rows || fold ? `<ul class="convs">${rows}${fold}</ul>` : '';
};
const spMark = (s = SP) => `<span class="st sp-st" role="img" aria-label="${SS[s.st][0]}" title="${SS[s.st][0]}">${SS[s.st][1]}</span>`;
const spClock = () => SP.st === 'working' ? `<span class="sp-clock" data-spclock>${clock(Math.max(0, nowS() - SP.t0))}</span>` : '';
const names = (ps) => ps.map(p => p.name).join(', ');
// Top bar: the waiting states name what the agent waits for; the chip opens it.
const libChip = stateChip;
stateChip = (c) => {
  if (c.archived || isEmpty(c)) return libChip(c);
  if (c.id !== 'c1') { const [l, m] = STATES[pst(c)]; return `<span class="chip ${pst(c)}" role="status">${m}<span class="chip-label">${l}</span></span>`; }
  const s = pst(c); const w = waitingOn();
  if (s === 'spinwait') return `<button type="button" class="chip spinwait wait-chip" data-pact="chip" title="Agentin vuoro päättyi. Se jatkaa itse, kun spinoff ${esc(SP.title)} valmistuu (${SS[SP.st][0].toLowerCase()})."><span class="st-spin">${IC.spin}</span><span class="chip-label">Odottaa spinoffia</span>${spMark()}</button>`;
  if (s === 'procwait') return `<button type="button" class="chip procwait wait-chip" data-pact="chip" title="Agentin vuoro päättyi. Se jatkaa itse, kun ${esc(names(w))} päättyy."><span class="st-proc">${IC.term}</span><span class="chip-label">Odottaa prosessia</span><span class="chip-sub mono">${esc(w[0].name)}${w.length > 1 ? ` +${w.length - 1}` : ''}</span></button>`;
  const [label, m] = STATES[s];
  const why = s === 'waiting' && avail() === 'unavailable' ? ' title="Selain ei näe terminaalista ohjatun keskustelun prosesseja, joten se ei tiedä, odottaako agentti niitä."' : '';
  return `<span class="chip ${s}" role="status"${why}>${m}<span class="chip-label">${label}</span></span>`;
};
const libDetails = detailsList;
detailsList = (c) => {
  const html = libDetails(c); if (c.id !== 'c1') return html;
  const v = avail() === 'unavailable' ? '<span class="sub" style="flex-basis:auto">Ohjataan terminaalista</span>' : `${running().length} käynnissä, ${finished().length} päättynyttä`;
  return html.replace('</dl>', `<dt>Prosessit</dt><dd>${v}</dd></dl>`);
};

// ---------- Process status pieces shared by every direction ----------
function stInfo(p) {
  const n = nowS();
  switch (p.status) {
    case 'running': return { cls: 'run', mark: '<span class="pr-dot run"></span>', label: 'Käynnissä', meta: `<span data-dur="${p.id}">${dur(n - p.start)}</span>` };
    case 'terminating': return { cls: 'stopping', mark: '<span class="pr-dot stopping"></span>', label: 'Pysäytetään…', meta: 'SIGTERM lähetetty' };
    case 'killed': return { cls: 'killed', mark: '<span class="pr-dot killed"></span>', label: 'Pysäytetty', meta: `${hm(p.end)} · ${p.signal}` };
    default: return p.code === 0
      ? { cls: 'ok', mark: `<span class="pr-ic ok">${ICON_CHECK}</span>`, label: 'Valmis', meta: `${hm(p.end)} · ${dur(p.end - p.start)}` }
      : { cls: 'fail', mark: `<span class="pr-ic err">${IC.fail}</span>`, label: `Virhe · koodi ${p.code}`, meta: `${hm(p.end)} · ${dur(p.end - p.start)}` };
  }
}
const wakeMark = (p) => p.wake && LIVE_ST.has(p.status) ? `<span class="pr-wake" role="img" aria-label="Herättää agentin" title="${p.wait ? 'Agentti jatkaa, kun spinoff valmistuu' : 'Agentti jatkaa, kun tämä päättyy'}">${IC.wake}</span>` : '';
// The live state of a process the agent started, for its tool row and its card.
function liveState(pid, wait) {
  if (wait) return `${spMark()}<span class="ps-l">${SS[SP.st][0]}</span>${spClock()}`;
  if (avail() === 'unavailable') return '<span class="ps-l muted">tila ei tiedossa</span>';
  if (P.removed.has(pid)) return '<span class="ps-l muted">poistettu</span>';
  const p = proc(pid); if (!p) return '<span class="ps-l muted">ei tiedossa</span>';
  const s = stInfo(p); return `<span class="pr-mark" aria-hidden="true">${s.mark}</span><span class="ps-l ${s.cls}">${s.label}</span>`;
}
const stopBtn = (p) => LIVE_ST.has(p.status) ? `<button type="button" class="icon-btn pr-stop" data-pact="stop" data-id="${p.id}" aria-label="${p.wait ? 'Lopeta odotus' : `Pysäytä ${p.name}`}" title="${p.wait ? 'Lopettaa odottamisen. Spinoff jatkaa työtään, eikä agentti saa ilmoitusta.' : `Pysäytä prosessi ${p.name}. Agentti ei saa tästä ilmoitusta.`}"${p.status === 'terminating' ? ' aria-disabled="true"' : ''}>${IC.stop}</button>` : '';
function row(p) {
  const selected = P.sel === p.id;
  if (p.wait) {
    return `<div class="pr-row spin${selected ? ' sel' : ''}" data-row="${p.id}"><button type="button" class="pr-main" data-pact="open" data-id="${p.id}" aria-expanded="${selected}">${CHEV}<span class="pr-mark" aria-hidden="true"><span class="st-spin">${IC.spin}</span></span><span class="pr-name sp-name">${esc(SP.title)}</span><span class="pr-cmd">spinoff · <span class="mono">${esc(SP.branch)}</span></span><span class="pr-meta">${spMark()}<span class="pr-label">${SS[SP.st][0]}</span>${spClock()}</span></button>${wakeMark(p)}${stopBtn(p)}</div>`;
  }
  const s = stInfo(p);
  return `<div class="pr-row ${s.cls}${selected ? ' sel' : ''}" data-row="${p.id}"><button type="button" class="pr-main" data-pact="open" data-id="${p.id}" aria-expanded="${selected}">${CHEV}<span class="pr-mark" aria-hidden="true">${s.mark}</span><span class="pr-name mono">${esc(p.name)}</span><span class="pr-cmd mono">${esc(p.cmd)}</span><span class="pr-meta"><span class="pr-label">${s.label}</span><span class="pr-sep" aria-hidden="true">·</span>${s.meta}</span></button>${wakeMark(p)}${stopBtn(p)}</div>`;
}
// One process's combined output, as in the accepted direction.
function lineHTML(l) { return `<div class="ln${l.s === 'err' ? ' e' : ''}"><span class="g" aria-label="${l.s === 'err' ? 'stderr' : 'stdout'}">${l.s === 'err' ? '2' : ''}</span><span class="t">${esc(l.t) || ' '}</span></div>`; }
const endLine = (p) => p.status === 'killed' ? `Pysäytetty ${hm(p.end)} (${p.signal})` : `Päättyi ${hm(p.end)} · koodi ${p.code}`;
function outHead(p) {
  const s = stInfo(p); const v = fv(p.id); const live = LIVE_ST.has(p.status);
  return `<div class="po-head"><span class="pr-mark" aria-hidden="true">${s.mark}</span><span class="pr-name mono">${esc(p.name)}</span><span class="po-state ${s.cls}">${s.label}<span class="pr-sep" aria-hidden="true">·</span>${s.meta}</span>
<span class="po-tools">${live ? `<button type="button" class="icon-btn" data-pact="follow" data-id="${p.id}" aria-pressed="${!v.follow}" aria-label="${v.follow ? 'Pysäytä seuraaminen' : 'Seuraa loppua'}" title="${v.follow ? 'Pysäytä seuraaminen. Prosessi jatkaa, ja uudet rivit odottavat.' : 'Seuraa loppua'}">${v.follow ? IC.pause : IC.follow}</button>` : ''}
<button type="button" class="icon-btn" data-pcopy="${p.id}" aria-label="Kopioi tuloste" title="Kopioi näkyvä tuloste">${ICON_COPY}</button>${stopBtn(p)}</span></div>
<div class="po-cmd"><span class="mono">$ ${esc(p.cmd)}</span><span class="po-since">alkoi ${hm(p.start)}</span></div>`;
}
function outBody(p) {
  const v = fv(p.id);
  const tail = p.omitted ? `<div class="po-mark">Alusta jätetty pois ${p.omitted.toLocaleString('fi-FI')} riviä · näytetään viimeiset ${p.lines.length}</div>` : '';
  const ended = !LIVE_ST.has(p.status) ? `<div class="po-end">${endLine(p)}</div>` : '';
  return `<div class="po-wrap"><div class="po-body" role="log" aria-label="Tuloste: ${esc(p.name)}" tabindex="0" data-body="${p.id}">${tail}${p.lines.map(lineHTML).join('')}${ended}</div>
<button type="button" class="po-resume" data-pact="resume" data-id="${p.id}"${v.follow ? ' hidden' : ''}>${IC.follow}<span>${v.fresh ? `${v.fresh} uutta riviä · ` : ''}Seuraa</span></button></div>`;
}
const outView = (p) => `<div class="po" data-out="${p.id}">${outHead(p)}${outBody(p)}</div>`;
// The wait process opens as the spinoff it waits on; its own output is one line at the end.
function spinView(p) {
  const res = SP.st === 'merged' ? `<dt>Tulos</dt><dd>Mergetty main-haaraan · <span class="mono">4be71d0</span> · 1 commit, <span class="add">+6</span> <span class="del">−1</span></dd>`
    : SP.st === 'failed' ? `<dt>Tulos</dt><dd>Konflikti: <span class="mono">README.md</span> muuttui main-haarassa. Työ on tallessa haarassa <span class="mono">${esc(SP.branch)}</span>.</dd>` : '';
  return `<div class="spv"><dl class="spv-facts"><dt>Tila</dt><dd>${spMark()}<span>${SS[SP.st][0]}</span>${spClock()}</dd>${res}<dt>Haara</dt><dd class="mono">${esc(SP.branch)}</dd><dt>Ajo</dt><dd class="mono">${RID}</dd><dt>Prosessi</dt><dd><span class="mono">${esc(p.name)}</span> · ${LIVE_ST.has(p.status) ? 'odottaa' : endLine(p)}<span class="spv-cmd mono">$ ${esc(p.cmd)}</span></dd></dl>
<div class="spv-acts"><button type="button" class="secondary" data-pact="spin">${IC.ext}<span>Avaa spinoff</span></button><span class="spv-note">Spinoffia ohjaa agentti, ei tämä näkymä. Odotuksen lopetus ei pysäytä spinoffia.</span></div></div>`;
}

// ---------- Live: new lines, follow and pause ----------
let prog = false;
const toEnd = (b) => { prog = true; b.scrollTop = b.scrollHeight; requestAnimationFrame(() => { prog = false; }); };
function push(id, lines) {
  const p = proc(id); if (!p || !LIVE_ST.has(p.status)) return;
  p.lines.push(...lines);
  const v = fv(id);
  for (const b of document.querySelectorAll(`[data-body="${id}"]`)) { b.insertAdjacentHTML('beforeend', lines.map(lineHTML).join('')); if (v.follow) toEnd(b); }
  for (const el of document.querySelectorAll(`[data-plast="${id}"]`)) el.textContent = lines[lines.length - 1].t || ' ';
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

// ---------- Stop and clear ----------
function stop(id) {
  const p = proc(id); if (!p || p.status !== 'running') return;
  p.status = 'terminating'; paint();
  setTimeout(() => {
    p.status = 'killed'; p.end = nowS(); p.signal = 'SIGTERM'; fv(id).follow = true; fv(id).fresh = 0;
    paint(); toast(p.wait ? 'Odotus lopetettiin. Spinoff jatkaa, eikä agentti saa ilmoitusta.' : `${p.name} pysäytetty. Agentti ei saa tästä ilmoitusta; kerro sille tarvittaessa.`);
  }, 1100);
}
// The extension's clear removes finished records and their logs; history keeps the calls.
function clearFinished() {
  const f = finished(); if (!f.length) return;
  for (const p of f) P.removed.add(p.id);
  P.procs = running(); if (P.removed.has(P.sel)) P.sel = null;
  paint(); toast(`${f.length} päättynyttä prosessia ja niiden lokit poistettiin. Keskustelun historia säilyy.`);
}

// ---------- The tray above the field (direction 3 of the previous round, chosen) ----------
const tray = document.createElement('section'); tray.className = 'pr-tray'; tray.setAttribute('aria-label', 'Prosessit');
function placeTray() { const anchor = uiCol.querySelector('.recap-host') || uiCol.querySelector('.composer'); if (tray.nextSibling !== anchor) uiCol.insertBefore(tray, anchor); }
function trayList() {
  const w = running().filter(p => p.wake); const o = running().filter(p => !p.wake); const f = finished();
  const grp = (label, ps, extra = '') => ps.length ? `<div class="pt-gh"><h4 class="pr-h">${label}</h4>${extra}</div><div class="pr-group" role="group" aria-label="${label}">${ps.map(p => row(p) + (P.sel === p.id ? `<div class="pt-out">${p.wait ? spinView(p) : outView(p)}</div>` : '')).join('')}</div>` : '';
  return `<div class="pt-list">${grp(P.aw ? 'Ilmoittavat agentille' : 'Agentti odottaa', w)}${grp(w.length ? 'Muut käynnissä' : 'Käynnissä', o)}${grp('Päättyneet', f, `<button type="button" class="pt-clear" data-pact="clear" title="Poistaa päättyneet prosessit ja niiden lokit. Keskustelun historia säilyy.">${IC.trash}<span>Poista päättyneet</span></button>`)}<p class="pr-life">${LIFE_TEXT}</p></div>`;
}
function trayBar() {
  const r = running(); const w = waitingOn(); const f = finished().length;
  let sum;
  if (!P.aw && w.some(p => p.wait)) sum = `<strong>Agentti odottaa spinoffia</strong><span class="pt-names">${esc(SP.title)}</span>`;
  else if (!P.aw && w.length) sum = `<strong>Agentti odottaa: <span class="mono">${esc(names(w))}</span></strong>${r.length > w.length ? `<span class="pt-names">${r.length - w.length} muuta käynnissä</span>` : ''}`;
  else sum = r.length ? `<strong>${r.length} ${r.length === 1 ? 'prosessi' : 'prosessia'} käynnissä</strong><span class="pt-names mono">${esc(names(r))}</span>` : '<strong>Ei käynnissä olevia prosesseja</strong>';
  const ic = !P.aw && w.length ? (w.some(p => p.wait) ? `<span class="st-spin">${IC.spin}</span>` : `<span class="st-proc">${IC.term}</span>`) : r.length ? '<span class="pr-dot run"></span>' : IC.term;
  return `<button type="button" class="pt-bar${!P.aw && w.length ? ' waiting' : ''}" data-pact="tray" aria-expanded="${P.open}">${CHEV}<span class="pt-ic">${ic}</span><span class="pt-sum">${sum}</span>${f ? `<span class="pt-done">${f} päättynyttä</span>` : ''}</button>`;
}
function paintTray() {
  placeTray();
  const show = !P.home && UI.sel === 'c1' && (avail() === 'unavailable' || P.procs.length);
  tray.hidden = !show; if (!show) return;
  if (avail() === 'unavailable') { tray.innerHTML = `<div class="pt-bar muted"><span class="pt-ic">${IC.term}</span><span class="pt-sum">${SCN.terminal.why}</span></div>`; return; }
  // Which rows sit in which group; a change in membership redraws the list.
  const sig = [P.aw, ...P.procs.map(x => `${x.id}:${LIVE_ST.has(x.status)}:${x.wake}`)].join('|');
  const keep = P.open && P.sel && tray.dataset.sig === sig && tray.querySelector(`[data-body="${P.sel}"]`);
  tray.dataset.sig = sig;
  if (keep) {
    // Keep the scrolling output; refresh the bar, the rows and the output head only.
    tray.querySelector('.pt-barwrap').innerHTML = trayBar();
    for (const x of P.procs) { const el = tray.querySelector(`[data-row="${x.id}"]`); if (el) el.outerHTML = row(x); }
    const p = proc(P.sel); const po = tray.querySelector(`[data-out="${p.id}"]`);
    const tmp = document.createElement('div'); tmp.innerHTML = outHead(p);
    po.querySelector('.po-head').replaceWith(tmp.children[0]); po.querySelector('.po-cmd').replaceWith(tmp.children[0]);
    if (!LIVE_ST.has(p.status)) for (const b of tray.querySelectorAll(`[data-body="${p.id}"]`)) if (!b.querySelector('.po-end')) { b.insertAdjacentHTML('beforeend', `<div class="po-end">${endLine(p)}</div>`); toEnd(b); }
    syncResume(p.id); return;
  }
  tray.innerHTML = `<div class="pt-barwrap">${trayBar()}</div>${P.open ? trayList() : ''}`;
  settleBodies();
}
function showProc(id) {
  if (!proc(id)) { toast(P.removed.has(id) ? 'Prosessi ja sen loki on poistettu. Historia säilyttää käynnistyksen.' : 'Prosessia ei ole enää prosessilistassa.'); return; }
  P.open = true; P.sel = id; paint(); tray.scrollIntoView({ block: 'nearest' });
}

// ---------- Thread blocks: the start call, the completion and the spinoff wait ----------
// The agent's `process` start call. Its status column follows the process, not the call.
function procBody(b) {
  const p = proc(b.pid);
  const wakes = b.wait ? 'herättää agentin, kun spinoff valmistuu' : b.wake ? 'herättää agentin' : 'kertoo agentille vain, jos se työskentelee';
  const dl = `<dl><dt>Nimi</dt><dd class="mono">${esc(b.args.name)}</dd><dt>Komento</dt><dd class="mono">${esc(b.args.command)}</dd><dt>Kun päättyy</dt><dd>${wakes}</dd>${b.wait ? `<dt>Odottaa</dt><dd>spinoffia ${esc(SP.title)} · <span class="mono">${esc(SP.branch)}</span></dd>` : ''}</dl>`;
  const btn = b.wait ? `<button type="button" class="secondary" data-pact="show" data-id="${b.pid}">Näytä spinoff</button>` : p || P.removed.has(b.pid) ? `<button type="button" class="secondary" data-pact="show" data-id="${b.pid}">Näytä prosessi</button>` : '';
  return `<div class="tool-body ptool-body"><div><h4>Käynnistys</h4>${dl}</div><div><h4>Tulos</h4><pre>${esc(b.result)}</pre>${btn ? `<div class="pr-hist">${btn}</div>` : ''}</div></div>`;
}
function procToolRow(b, id, expanded) {
  const target = b.wait ? `odottaa spinoffia · ${SP.title}` : `start · ${b.args.name}`;
  return `<section class="tool ptool"><button class="disc" type="button" aria-expanded="${expanded}" aria-controls="${id}">${CHEV}<span class="names"><span class="name">process</span><span class="target">${b.wait ? `<span class="st-spin tgt-ic">${IC.spin}</span>` : ''}${esc(target)}</span></span><span class="pst" data-pst="${b.pid}"${b.wait ? ' data-wait' : ''}>${liveState(b.pid, b.wait)}</span></button><div id="${id}"${expanded ? '' : ' hidden'}>${procBody(b)}</div></section>`;
}
const libToolRow = toolRow;
toolRow = (b, i) => b.name === 'process' ? procToolRow(b, nid(), false) : libToolRow(b, i);
const libLiveRow = liveToolRow;
liveToolRow = (b) => b.name === 'process' && b.state !== 'forming' ? procToolRow(b, `live-${b.id}`, !!b.expanded) : libLiveRow(b);

// What a finished process tells the agent. `n` is the persisted notification: process name,
// kind, exit code, duration and how it arrived (steer while working, wake when idle).
const kindIcon = (n) => n.spin ? (n.spinSt === 'merged' ? `<span class="sp-mk merged">${IC.merge}</span>` : `<span class="sp-mk failed">${IC.warn}</span>`) : n.kind === 'success' ? `<span class="pr-ic ok">${ICON_CHECK}</span>` : `<span class="pr-ic err">${IC.fail}</span>`;
const outcome = (n) => n.spin ? (n.spinSt === 'merged' ? 'mergetty main-haaraan · <span class="mono">4be71d0</span>' : 'ei mergetty · työ tallessa') : n.kind === 'success' ? `valmis · koodi 0 · ${dur(n.dur)}` : `virhe · koodi ${n.code} · ${dur(n.dur)}`;
const how = (n) => n.delivery === 'steer' ? `<span class="pn-how steer">${IC.steer}Ohjaus kesken työn</span>` : `<span class="pn-how wake">${IC.wake}Herätti agentin</span>`;
const who = (n) => n.spin ? `<span class="pn-spin">Spinoff</span> <strong>${esc(SP.title)}</strong>` : `<span class="mono">${esc(n.name)}</span>`;
function tailLines(n, k = 3) {
  if (n.spin) return n.spinSt === 'merged' ? '<div class="pn-tail plain">1 commit · <span class="add">+6</span> <span class="del">−1</span> · <span class="mono">README.md</span></div>' : `<div class="pn-tail plain">Konflikti: <span class="mono">README.md</span> muuttui main-haarassa. Työ on tallessa haarassa <span class="mono">${esc(SP.branch)}</span>.</div>`;
  const p = proc(n.pid);
  if (!p) return `<div class="pn-tail plain muted">${P.removed.has(n.pid) ? 'Tuloste poistettiin Poista päättyneet -toiminnolla.' : avail() === 'unavailable' ? 'Tuloste ei ole selaimen saatavilla.' : 'Tulostetta ei ole enää saatavilla.'}</div>`;
  return `<div class="pn-tail mono">${p.lines.slice(-k).map(l => `<div class="${l.s === 'err' ? 'e' : ''}">${esc(l.t) || ' '}</div>`).join('')}</div>`;
}
const showBtn = (n) => n.spin ? `<button type="button" class="pn-btn" data-pact="spin">${IC.ext}<span>Avaa spinoff</span></button>` : `<button type="button" class="pn-btn" data-pact="show" data-id="${n.pid}">Näytä prosessi</button>`;
// Direction 1: a quiet row of the session-marker family.
const note1 = (n) => `<div class="pn pn-row ${n.delivery}" role="note"><span class="pn-ic">${kindIcon(n)}</span><span class="pn-txt">${who(n)} <span class="pn-out">${outcome(n)}</span></span>${how(n)}<time class="meta">${n.time}</time></div>`;
// Direction 2: a card with the outcome and the last lines of the output.
const note2 = (n) => `<section class="pn pn-card ${n.delivery}${n.spin ? ' spin' : ''}" aria-label="${n.spin ? 'Spinoff' : 'Prosessi'} ${esc(n.spin ? SP.title : n.name)} päättyi"><header><span class="pn-ic">${kindIcon(n)}</span><span class="pn-txt">${who(n)}</span><span class="pn-out">${outcome(n)}</span>${how(n)}<time class="meta">${n.time}</time></header>${tailLines(n)}<footer>${showBtn(n)}</footer></section>`;
// Direction 3: the process speaks to the agent, as it natively does.
function note3(n) {
  const text = n.spin
    ? (n.spinSt === 'merged' ? 'Valmis ja mergetty main-haaraan: <span class="mono">4be71d0</span>, 1 commit, <span class="add">+6</span> <span class="del">−1</span>.' : 'Ei mergetty: <span class="mono">README.md</span> muuttui main-haarassa. Työ on tallessa haarassa <span class="mono">' + esc(SP.branch) + '</span>.')
    : n.kind === 'success' ? `Päättyin onnistuneesti, ajo kesti ${dur(n.dur)} (koodi 0).` : `Päätyin virheeseen, ajo kesti ${dur(n.dur)} (koodi ${n.code}).`;
  return `<article class="bubble pmsg ${n.delivery}"><div class="bubble-head"><span class="pm-av">${n.spin ? IC.spin : IC.term}</span><span class="pm-who">${n.spin ? esc(SP.title) : `<span class="mono">${esc(n.name)}</span>`}</span><span class="pm-kind">${n.spin ? 'spinoff' : 'prosessi'}</span>${how(n)}<time class="meta">${n.time}</time></div><div class="prose"><p>${kindIcon(n)} ${text}</p></div>${n.spin ? '' : `<div class="pm-foot">${showBtn(n)}</div>`}</article>`;
}
const noteHTML = (n) => ({ v1: note1, v2: note2, v3: note3 })[P.v](n);
// Direction 2 also leaves a live card under the turn that started background processes.
function startCards(blocks) {
  const rows = blocks.map(b => {
    if (b.wait) return `<li class="pc-row spin"><span class="st-spin">${IC.spin}</span><span class="pc-name">${esc(SP.title)}</span><span class="pst" data-pst="${b.pid}" data-wait>${liveState(b.pid, true)}</span><span class="pr-wake" role="img" aria-label="Herättää agentin" title="Agentti jatkaa, kun spinoff valmistuu">${IC.wake}</span><button type="button" class="pn-btn" data-pact="show" data-id="${b.pid}">Näytä</button></li>`;
    const p = proc(b.pid); const last = p?.lines[p.lines.length - 1]?.t ?? '';
    return `<li class="pc-row"><span class="pc-name mono">${esc(b.args.name)}</span><span class="pst" data-pst="${b.pid}">${liveState(b.pid)}</span>${b.wake ? `<span class="pr-wake" role="img" aria-label="Herättää agentin" title="Agentti jatkaa, kun tämä päättyy">${IC.wake}</span>` : '<span class="pr-wake off" aria-hidden="true"></span>'}<button type="button" class="pn-btn" data-pact="show" data-id="${b.pid}">Näytä</button><span class="pc-last mono" data-plast="${b.pid}">${esc(last) || ' '}</span></li>`;
  }).join('');
  return `<section class="pc" aria-label="Taustalle käynnistetyt"><header>${IC.term}<span>Käynnisti taustalle</span></header><ul>${rows}</ul></section>`;
}

// ---------- History: the story of this conversation's processes ----------
const pStart = (pid, name, command, result, extra = {}) => ({ t: 'tool', name: 'process', target: `start · ${name}`, pid, args: { action: 'start', name, command }, result, ...extra });
const turns = CONVO.filter(m => m.kind === 'turn');
if (!turns.some(t => t.blocks.some(b => b.name === 'process'))) {
  turns[0].blocks.splice(6, 0, pStart('proc_8c2e', 'testit', 'ptw tests/ -- -q', 'Started process testit (proc_8c2e) with pid 48211.'));
  turns[2].blocks.splice(3, 0, pStart('proc_3f1a', 'sivu', 'python3 -u -m http.server 8000 --directory site', 'Started process sivu (proc_3f1a) with pid 48544.'),
    pStart('proc_51d0', 'haku', 'GITHUB_TOKEN=••• python3 scripts/fetch_status.py --since 2026-09-01', 'Started process haku (proc_51d0) with pid 48551.', { wake: true }));
  // haku ended while the turn had ended: its notification woke the agent.
  const ui = CONVO.findIndex(m => m.kind === 'user' && m.md.startsWith('Selitä'));
  CONVO.splice(ui, 0, { kind: 'marker', t: 'pwake', note: { pid: 'proc_51d0', name: 'haku', kind: 'success', code: 0, dur: 41, time: '14:35', delivery: 'wake' } },
    { kind: 'turn', time: '14:35', blocks: [
      { t: 'think', md: '**Reading the refreshed status table**' },
      { t: 'tool', name: 'read', target: 'status.md', args: { path: 'status.md' }, result: '| päivä | kohde | tila | huomio |\n|---|---|---|---|\n| 2026-10-12 | daemon | valmis | historian lohkoluku |\n…' },
      pStart('proc_0b77', 'kello', 'python3 scripts/watch_status.py --interval 60', 'Started process kello (proc_0b77) with pid 48610.', { wake: true }),
      { t: 'reply', md: 'Haku valmistui: 1 240 issueta 26 sivulta, ja `status.md` on päivitetty (62 riviä, neljä viikkoa). Kolme issueta ilman päivämäärää ohitettiin. Käynnistin `kello`-prosessin, joka päivittää taulukon minuutin välein.' },
    ] });
  // kello failed while the agent was explaining: its notification arrived as steering.
  const t3 = CONVO.filter(m => m.kind === 'turn')[4];
  t3.blocks.splice(2, 0, { t: 'pnote', note: { pid: 'proc_0b77', name: 'kello', kind: 'failure', code: 1, dur: 2, time: '14:35', delivery: 'steer' } }, { t: 'think', md: '**Noting that kello failed; finishing the explanation first**' });
  const r = t3.blocks.find(b => b.t === 'reply'); r.md = `${r.md}\n\nKesken selityksen tuli tieto, että \`kello\` kaatui heti: \`watchdog\`-kirjastoa ei ole asennettu. Selitys ei riipu siitä; asennanko kirjaston?`;
}
// Wake markers sit between turns like the user's message would.
const libMarker = markerR;
markerR = (m, i) => m.t === 'pwake' ? `<div class="pn-wakehost ah-in" style="--i:${i}">${noteHTML(m.note)}</div>` : libMarker(m, i);
// The history thread, with a steering notification between the work it split. The
// notification is not the agent's work, so it stays visible when the work is hidden.
lanka = function (cls) {
  let i = 0; const out = [];
  const summary = (m) => `${m.blocks.filter(b => b.t === 'think').length} ajatusta · ${m.blocks.filter(b => b.t === 'tool').length} työkalua`;
  for (const m of CONVO) {
    if (m.kind === 'user') { out.push(userBubble(m, i++)); continue; }
    if (m.kind === 'marker') { out.push(markerR(m, i++)); continue; }
    const rows = [];
    const row = (node, cell, pos = '') => rows.push(`<div class="rail-cell ${pos} ah-in" style="--i:${i}">${node}</div><div class="cell ah-in" style="--i:${i++}">${cell}</div>`);
    const workId = nid(); const sum = summary(m);
    row(`<span class="node head" aria-hidden="true"></span>`, `<div class="head-cell"><button class="head-btn" type="button" aria-expanded="true" aria-controls="${workId}" data-sum="${esc(sum)}">${CHEV}<span class="who">Pi</span></button><span class="model">${MODEL}</span><span class="sum">${sum}</span></div>`, 'first');
    rows.push(`<div class="work" id="${workId}">`);
    for (const b of m.blocks) {
      if (b.t === 'think') {
        if (isShort(b.md)) row(`<span class="node" aria-hidden="true"></span>`, `<div class="think-row"><span class="lbl">Ajattelu</span><span class="prose">${md(b.md)}</span></div>`);
        else { const id = nid(); row(`<span class="node" aria-hidden="true"></span>`, `<div><button class="quiet-btn think-btn" type="button" aria-expanded="false" aria-controls="${id}">${CHEV}Ajattelu</button><div id="${id}" class="think-quote" hidden style="margin-top:6px">${md(b.md)}</div></div>`); }
      } else if (b.t === 'tool') row(`<span class="node tool done" aria-hidden="true"></span>`, toolRow(b, i).replace(' ah-in', ''));
      else if (b.t === 'pnote') { rows.push('</div>'); row(`<span class="node pn-node" aria-hidden="true"></span>`, noteHTML(b.note)); rows.push(`<div class="work" id="${nid()}" data-mirror="${workId}">`); }
    }
    rows.push('</div>');
    const reply = m.blocks.find(b => b.t === 'reply');
    row(`<span class="node done" aria-hidden="true"></span>`, `<article class="bubble reply"><div class="bar head"><span class="ok">${ICON_CHECK}Vastaus valmis</span><span class="model">${MODEL}</span>${copyBtn('Kopioi vastaus', reply.md)}<time class="meta">${m.time}</time></div><div class="prose">${md(reply.md)}</div></article>`, 'last');
    out.push(`<div class="turn">${rows.join('')}</div>`);
    const starts = m.blocks.filter(b => b.t === 'tool' && b.name === 'process');
    if (P.v === 'v2' && starts.length) out.push(startCards(starts));
  }
  return `<div class="vwrap ${cls}">${out.join('')}</div>`;
};
// The split work follows its head: hidden and shown together.
new MutationObserver((ms) => {
  for (const m of ms) { const t = m.target; if (t.classList?.contains('work') && t.id && !t.dataset.mirror) for (const x of stage.querySelectorAll(`[data-mirror="${t.id}"]`)) x.hidden = t.hidden; }
}).observe(stage, { subtree: true, attributes: true, attributeFilter: ['hidden'] });

// ---------- The live turn and what follows it ----------
// The library's turn (run the tests, fix, rerun) ends here by starting the slow tests in
// the background. When they finish, the agent wakes, starts a spinoff for the README and
// waits for it with `taskfleet run wait`; when the spinoff lands, the agent wakes again.
const SLOW = { id: 'proc_9d4b', name: 'hidas-testi', cmd: 'python3 -m pytest tests/ -q -m slow' };
const WAITP = { id: 'proc_e21c', name: 'spinoff', cmd: `taskfleet run wait ${RID} --any --timeout 2h` };
LIVE.reply = `Testit menevät läpi. Yksi testi kaatui, koska oletusikkuna laskettiin koneen kellosta; nyt \`--today\` on parametri ja testi antaa sen kiinteänä.

Hitaat testit ajetaan taustalla prosessina \`hidas-testi\`. Jatkan itse, kun ne ovat valmiit.`;
const SEQ = { tok: 0, next: null, timer: 0, vw: null, startsOfLive: [] };
const startProc = (spec, extra = {}) => { if (!proc(spec.id)) P.procs.push({ ...spec, start: nowS(), status: 'running', wake: true, omitted: 0, lines: [], ...extra }); };
function endProc(id, code, lines = []) {
  const p = proc(id); if (!p || !LIVE_ST.has(p.status)) return null;
  push(id, lines); p.status = 'exited'; p.code = code; p.end = nowS(); return p;
}
const setAW = (on) => { P.aw = on; paint(); };
// Plays one turn of events after the given trigger, in the direction's grammar.
function playTurn(events, R) { script = () => events; playLive(SEQ.vw, R); }
const wakeR = () => {
  const R = threadR(); R.startOpen = false;
  R.strip = (s) => s.status === 'working' ? `<div class="info-row"><button type="button" class="show-work" data-fold aria-expanded="${s.open}"><span class="lbl"><span class="when-closed">Näytä työ</span><span class="when-open">Piilota työ</span></span>${CHEV}</button><span class="act"><span class="live-dot"></span>Agentti jatkaa</span><span class="info-now">${activity(s)}</span><span class="clock">${elapsed(s)}</span></div>` : '';
  return R;
};
function evs(build) { const ev = []; let t = 0; const at = (d, fn) => { t += d; ev.push([t, fn]); }; const stream = (text, id, gap) => { let acc = ''; for (const w of text.split(/(?<=\s)/)) { acc += w; const s = acc; at(gap, (S) => S.set(id, { text: s })); } }; build(at, stream); return ev; }
const tok = () => SEQ.tok;
// Schedule the next host event; the page bar's "Seuraava tapahtuma" runs it at once.
function later(ms, fn) { const k = tok(); clearTimeout(SEQ.timer); SEQ.next = () => { SEQ.next = null; clearTimeout(SEQ.timer); if (k === tok()) fn(); }; SEQ.timer = setTimeout(() => SEQ.next?.(), ms * (document.getElementById('slow').checked ? 2.2 : 1)); }
function appendAfterTurn(html) { const turnsEl = SEQ.vw.querySelectorAll(':scope > .turn'); turnsEl[turnsEl.length - 1].insertAdjacentHTML('afterend', html); }
function wake(note) {
  SEQ.vw.insertAdjacentHTML('beforeend', `<div class="pn-wakehost pn-in">${noteHTML(note)}</div>`);
}
// The first live turn, as the library plays it, plus the background start at the end.
const firstTurn = () => evs((at, stream) => {
  at(0, (S) => { S.start(); setAW(true); });
  at(350, (S) => S.add({ id: 'k1', t: 'think', text: '', live: true })); stream(LIVE.think1, 'k1', 55); at(300, (S) => S.set('k1', { live: false }));
  at(350, (S) => S.add({ id: 't1', t: 'tool', ...LIVE.test1, state: 'forming', out: [], expanded: true }));
  at(700, (S) => S.set('t1', { state: 'running' }));
  LIVE.test1.lines.forEach((l, i) => at(i === 0 ? 400 : (i < 4 ? 220 : 90), (S) => S.push('t1', l)));
  at(300, (S) => S.set('t1', { state: 'done' }));
  at(500, (S) => S.add({ id: 'k2', t: 'think', text: '', live: true })); stream(LIVE.think2, 'k2', 120); at(250, (S) => S.set('k2', { live: false }));
  at(400, (S) => S.add({ id: 'e1', t: 'tool', ...LIVE.edit, state: 'forming', out: [], expanded: true }));
  at(900, (S) => S.set('e1', { state: 'running' }));
  at(400, (S) => { S.push('e1', LIVE.edit.lines[0]); S.set('e1', { state: 'done' }); });
  at(500, (S) => S.add({ id: 't2', t: 'tool', ...LIVE.test2, state: 'running', out: [], expanded: false }));
  LIVE.test2.lines.forEach((l) => at(700, (S) => S.push('t2', l)));
  at(300, (S) => S.set('t2', { state: 'done' }));
  const b = pStart(SLOW.id, SLOW.name, SLOW.cmd, 'Started process hidas-testi (proc_9d4b) with pid 48902.', { wake: true });
  at(400, (S) => S.add({ id: 'p1', ...b, state: 'forming', out: [], expanded: false }));
  at(600, (S) => { startProc(SLOW); S.set('p1', { state: 'done' }); paint(); });
  at(500, (S) => S.add({ id: 'r', t: 'reply', text: '', live: true })); stream(LIVE.reply, 'r', 40); at(500, (S) => S.set('r', { live: false }));
  at(900, (S) => { S.settle(); afterTurn([b]); setAW(false); later(9000, slowDone); });
});
function afterTurn(starts) { if (P.v === 'v2') appendAfterTurn(startCards(starts)); }
// The slow tests finish; their notification starts a turn.
function slowDone() {
  const p = endProc(SLOW.id, 0, [{ s: 'out', t: dots(12) }, { s: 'out', t: '12 passed in 8.42s' }]); if (!p) return;
  const note = { pid: SLOW.id, name: SLOW.name, kind: 'success', code: 0, dur: p.end - p.start, time: '14:37', delivery: 'wake' };
  paint(); wake(note);
  const call = pStart(WAITP.id, WAITP.name, WAITP.cmd, 'Started process spinoff (proc_e21c) with pid 49117.', { wake: true, wait: true });
  playTurn(evs((at, stream) => {
    at(0, (S) => { S.start(); setAW(true); });
    at(400, (S) => S.add({ id: 'w1k', t: 'think', text: '**Slow tests passed; the README needs the --today example**', live: false }));
    at(500, (S) => S.add({ id: 'w1b', t: 'tool', name: 'bash', target: 'taskfleet run create --kind spinoff …', args: { command: 'taskfleet run create --kind spinoff --task "README: lisää --today-esimerkki ja aja se" --json' }, state: 'running', out: [], expanded: false }));
    at(900, (S) => { S.push('w1b', `{"run_id":"${RID}","branch":"wt/r5t-readme-today","status":"running"}`); S.set('w1b', { state: 'done' }); SP.st = 'working'; SP.t0 = nowS(); });
    at(400, (S) => S.add({ id: 'w1p', ...call, state: 'forming', out: [], expanded: false }));
    at(600, (S) => { startProc(WAITP, { wait: [SP.id] }); S.set('w1p', { state: 'done' }); paint(); });
    at(400, (S) => S.add({ id: 'w1r', t: 'reply', text: '', live: true }));
    stream('Hitaat testit menivät läpi (12 passed). README:n `--today`-esimerkki tehdään spinoffissa omassa worktreessaan. Jatkan, kun se on mergetty.', 'w1r', 40);
    at(400, (S) => S.set('w1r', { live: false }));
    at(700, (S) => { S.settle(); afterTurn([call]); setAW(false); later(11000, spinDone); });
  }), wakeR());
}
// The spinoff settles; the wait process exits and wakes the agent.
function spinDone() {
  const ok = P.scn !== 'fail';
  SP.st = ok ? 'merged' : 'failed'; SP.end = nowS();
  const p = endProc(WAITP.id, 0, [{ s: 'out', t: ok ? `{"run_id":"${RID}","status":"done","landed":true,"report":{"commit":"4be71d0","commits":1}}` : `{"run_id":"${RID}","status":"failed","landed":false,"summary":"merge conflict: README.md"}` }]); if (!p) return;
  const note = { pid: WAITP.id, name: WAITP.name, spin: SP.id, spinSt: SP.st, kind: 'success', code: 0, dur: p.end - p.start, time: '14:37', delivery: 'wake' };
  paint(); wake(note);
  playTurn(evs((at, stream) => {
    at(0, (S) => { S.start(); setAW(true); });
    at(400, (S) => S.add({ id: 'w2k', t: 'think', text: ok ? '**The spinoff merged; checking main**' : '**The spinoff could not merge; reading its result**', live: false }));
    at(500, (S) => S.add({ id: 'w2b', t: 'tool', name: 'bash', target: ok ? 'git log --oneline -1 -- README.md' : `taskfleet run show ${RID} --json`, args: { command: ok ? 'git log --oneline -1 -- README.md' : `taskfleet run show ${RID} --json` }, state: 'running', out: [], expanded: false }));
    at(800, (S) => { S.push('w2b', ok ? '4be71d0 docs: README:n --today-esimerkki' : '{"status":"failed","landed":false,"preserved_work":[{"branch":"wt/r5t-readme-today"}]}'); S.set('w2b', { state: 'done' }); });
    at(400, (S) => S.add({ id: 'w2r', t: 'reply', text: '', live: true }));
    stream(ok ? 'README:n esimerkki on nyt main-haarassa (`4be71d0`). Testit, korjaus ja dokumentaatio ovat valmiit, eikä mitään jäänyt kesken.' : 'Spinoff ei saanut mergettyä: `README.md` oli muuttunut main-haarassa. Työ on tallessa haarassa `wt/r5t-readme-today`. Teenkö mergen itse?', 'w2r', 40);
    at(400, (S) => S.set('w2r', { live: false }));
    at(700, (S) => { S.settle(); setAW(false); });
  }), wakeR());
}

// ---------- Recap: what the agent waits for, from host facts, not from the model ----------
function paintRecapWait() {
  const r = kHost.querySelector('.recap'); if (!r || r.querySelector('.k-wait')) return;
  const s = c1State(); if (s !== 'procwait' && s !== 'spinwait') return;
  const w = waitingOn();
  const line = s === 'spinwait' ? `<span class="st-spin">${IC.spin}</span><span>Agentti jatkaa itse, kun spinoff <strong>${esc(SP.title)}</strong> valmistuu.</span>${spMark()}<span class="k-wst">${SS[SP.st][0]}</span>${spClock()}`
    : `<span class="st-proc">${IC.term}</span><span>Agentti jatkaa itse, kun <span class="mono">${esc(names(w))}</span> päättyy.</span>`;
  r.querySelector('.k-head').insertAdjacentHTML('afterend', `<p class="k-wait">${line}</p>`);
}

// ---------- Home page: the same state marks on the cards ----------
const CARD = {
  c1: () => ({ working: 'Agentti työskentelee.', procwait: 'Testit menevät läpi ja `--today` on parametri; hitaat testit ajetaan taustalla.', spinwait: 'Hitaat testit menivät läpi; README:n `--today`-esimerkki tehdään spinoffissa.' })[c1State()] ?? (SP.st === 'failed' ? 'Spinoff ei mergennyt; työ on tallessa haarassa.' : 'Testit, korjaus ja README ovat valmiit.'),
  p1: () => 'Neljä spinoffia 0.4-julkaisua varten; kaksi on valmiina.',
  c2: () => 'WebP-muunnos on valmis ja odottaa katselmointia.',
  c10: () => 'Negaatio jäsentyy; vertailuajo on käynnissä.',
  c5: () => 'Kiintiön tekstit päivitetään kolmeen näkymään.',
  c4: () => 'Syklin tunnistus jäi kesken.',
};
function homeWait(c) {
  const s = pst(c);
  if (c.id === 'c1' && s === 'procwait') return `<p class="h-wait"><span class="st-proc">${IC.term}</span><span>Jatkaa itse, kun <span class="mono">${esc(names(waitingOn()))}</span> päättyy.</span></p>`;
  if (c.id === 'c1' && s === 'spinwait') return `<p class="h-wait"><span class="st-spin">${IC.spin}</span><span>Jatkaa itse, kun spinoff ${esc(SP.title)} valmistuu</span>${spMark()}</p>`;
  return WAIT_TEXT[c.id] && (s === 'procwait' || s === 'spinwait') ? `<p class="h-wait">${STATES[s][1]}<span>${WAIT_TEXT[c.id]}</span></p>` : '';
}
function homeHTML() {
  const all = UI.ws.flatMap(w => w.convs.filter(c => !c.archived).map(c => ({ c, w })));
  const n = (f) => all.filter(({ c }) => f(pst(c))).length;
  const you = n(s => s === 'waiting' || s === 'attention'), work = n(s => s === 'working'), bg = n(s => s === 'procwait' || s === 'spinwait');
  const sum = [you ? `<strong>${you} odottaa sinua</strong>` : 'mikään ei odota sinua', work ? `${work} työskentelee` : '', bg ? `${bg} odottaa prosessia tai spinoffia` : ''].filter(Boolean).join(' · ');
  const card = (c) => { const s = pst(c); return `<a href="#" class="h-card" data-hconv="${c.id}"><span class="h-top">${mark(s)}<span class="h-st ${s}">${(STATES[s] ?? ['Ei aloitettu'])[0]}</span></span><strong class="h-title">${esc(c.title)}</strong><span class="h-text">${inline((CARD[c.id] ?? (() => ''))())}</span>${homeWait(c)}</a>`; };
  const sections = UI.ws.map(w => { const cs = w.convs.filter(c => !c.archived && pst(c) !== 'done').sort((a, b) => (STATE_ORDER[pst(a)] ?? 4) - (STATE_ORDER[pst(b)] ?? 4)); return cs.length ? `<section class="h-ws"><h2 class="mono">${esc(w.id)}</h2><div class="h-grid">${cs.map(card).join('')}</div></section>` : ''; }).join('');
  return `<div class="h-page"><header class="h-head"><h1>Etusivu</h1><p class="h-sub">${sum}</p></header>${sections}</div>`;
}
let SAVED = null;
function goHome() {
  if (P.home) return; P.home = true; UI.drawer = false; UI.pop = false;
  SAVED = document.createDocumentFragment(); while (stage.firstChild) SAVED.appendChild(stage.firstChild);
  following = false; uiCol.classList.add('oh-home'); paint(); stage.scrollTop = 0;
}
function leaveHome() {
  P.home = false; stage.innerHTML = ''; if (SAVED) stage.appendChild(SAVED); SAVED = null;
  uiCol.classList.remove('oh-home'); UI.sel = 'c1'; paint(); following = true; stage.scrollTop = stage.scrollHeight; lastTop = stage.scrollTop;
}
const libPaintTop = paintTop;
paintTop = () => { if (!P.home) return libPaintTop(); uiTop.innerHTML = `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button><div class="tb-title"><strong>Etusivu</strong><span class="tb-ws">Kaikki työtilat</span></div>`; };
document.addEventListener('click', (e) => {
  if (e.target.closest('.proto-picker')) return;
  if (e.target.closest('[data-ui="home"]')) { e.preventDefault(); e.stopImmediatePropagation(); goHome(); return; }
  const c = e.target.closest('[data-conv], [data-hconv]'); if (!c || !P.home) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const id = c.dataset.conv || c.dataset.hconv; leaveHome(); if (id !== 'c1') openConv(id);
}, true);

APP.painted.push(() => {
  uiRail.querySelector('.home-row')?.toggleAttribute('aria-current', P.home);
  if (P.home) stage.innerHTML = homeHTML();
  paintTray(); paintRecapWait();
  for (const el of document.querySelectorAll('[data-pst]')) { const h = liveState(el.dataset.pst, el.hasAttribute('data-wait')); if (el.innerHTML !== h) el.innerHTML = h; }
});

// ---------- Clock: durations, spinoff time and new output ----------
let tick = 0;
setInterval(() => {
  tick++;
  for (const el of document.querySelectorAll('[data-dur]')) { const p = proc(el.dataset.dur); if (p) el.textContent = dur(nowS() - p.start); }
  for (const el of document.querySelectorAll('[data-spclock]')) el.textContent = clock(Math.max(0, nowS() - SP.t0));
  if (avail() !== 'available') return;
  if (tick % 3 === 0) push('proc_3f1a', [access(nowS(), '/status.json')]);
  if (tick % 2 === 0) push(SLOW.id, [{ s: 'out', t: `tests/test_slow.py::test_window_${tick} PASSED` }]);
}, 1000);

// ---------- Interactions ----------
document.addEventListener('click', async (e) => {
  const cp = e.target.closest('[data-pcopy]');
  if (cp) { const p = proc(cp.dataset.pcopy); try { await navigator.clipboard.writeText(p.lines.map(l => l.t).join('\n')); } catch {} toast('Tuloste kopioitu.'); return; }
  const t = e.target.closest('[data-pact]'); if (!t) return;
  e.preventDefault(); e.stopPropagation();
  if (t.getAttribute('aria-disabled') === 'true') return;
  const a = t.dataset.pact; const id = t.dataset.id;
  if (a === 'tray') { P.open = !P.open; return paint(); }
  if (a === 'stop') return stop(id);
  if (a === 'clear') return clearFinished();
  if (a === 'follow') return setFollow(id, !fv(id).follow);
  if (a === 'resume') return setFollow(id, true);
  if (a === 'show') return showProc(id);
  if (a === 'chip') { const w = waitingOn()[0]; if (w) showProc(w.id); return; }
  if (a === 'spin') return toast('Spinoff avautuu vain luettavaksi: sen keskustelu ja tulos (kierros 2026-10-16-spinoffit).');
  if (a === 'open') { P.sel = P.sel === id ? null : id; return paint(); }
}, true);

// ---------- Page bar: scenario and the next host event (demonstration, not product) ----------
const bar = document.querySelector('.page-bar');
bar.querySelector('.hint').insertAdjacentHTML('beforebegin', `<label>Tilanne <select id="pb-scn">${Object.entries(SCN).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></label><button type="button" id="pb-next" class="page-btn" title="Ajaa seuraavan odottavan tapahtuman heti: prosessi päättyy tai spinoff valmistuu">Seuraava tapahtuma</button>`);
document.getElementById('pb-scn').addEventListener('change', (e) => { P.scn = e.target.value; remount(); });
document.getElementById('pb-next').addEventListener('click', () => {
  if (P.aw) return toast('Agentti työskentelee; seuraava tapahtuma odottaa vuoron loppua.');
  if (!SEQ.next) return toast('Ei odottavia tapahtumia. R soittaa tarinan alusta.');
  SEQ.next();
});
function remount() { stage.innerHTML = ''; requestAnimationFrame(() => { stage.innerHTML = window[P.v](); }); }

// Opening the conversation plays its story from the start; leaving it ends the story.
function resetStory() {
  SEQ.tok++; clearTimeout(SEQ.timer); SEQ.next = null;
  P.sel = null; P.open = false; P.aw = false; P.procs = procs0(); P.removed.clear(); SP = SP0(); for (const k in F) delete F[k];
  script = firstTurn; paint();
  requestAnimationFrame(() => { SEQ.vw = stage.querySelector('.vwrap'); });
}
const libContent = window.content;
window.content = function () {
  if (selConv().id === 'c1') resetStory(); else { SEQ.tok++; clearTimeout(SEQ.timer); SEQ.next = null; P.aw = false; }
  return libContent();
};
function start(v) {
  if (P.home) { P.home = false; SAVED = null; uiCol.classList.remove('oh-home'); }
  P.v = v; UI.sel = 'c1';
  return appView();
}
window.v1 = () => start('v1');
window.v2 = () => start('v2');
window.v3 = () => start('v3');
})();
