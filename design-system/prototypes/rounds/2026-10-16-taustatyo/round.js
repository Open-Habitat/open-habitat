// Kierros 16.10.2026: prosessit ja spinoffit kentän yllä tasavertaisina (issue
// proto-composer-strip, aihe 2). Rivi, tilamerkit ja "Poista päättyneet" tulevat valitusta
// prosessirivistä (2026-10-16-prosessit suunta 3), odotuksen sanat prosessilohkojen
// suunnasta 1 ("Odotan …") ja spinoffin tilat spinoff-kierroksen suunnasta 1. Agentin
// `taskfleet run wait` -prosessia ei listata prosessina: se on odotetun spinoffin merkki.
// Suunnat eroavat vain siinä, miten kaksi lajia jakavat kentän yläpuolen.
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
  ext: SVG('<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/>'),
  stack: SVG('<rect x="4" y="5" width="16" height="5" rx="1.5"/><rect x="4" y="14" width="16" height="5" rx="1.5"/>'),
};

// ---------- Synthetic native facts ----------
// Clock: the page opens at 14.37:00 and runs. Times are seconds of the day.
const T0 = performance.now(); const BASE = 14 * 3600 + 37 * 60;
const nowS = () => BASE + Math.floor((performance.now() - T0) / 1000);
const T = (h, m, s = 0) => h * 3600 + m * 60 + s;
const hm = (s) => `${Math.floor(s / 3600)}.${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;
const dur = (s) => s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min ${s % 60 ? `${s % 60} s` : ''}`.trim() : `${Math.floor(s / 3600)} h ${Math.floor(s / 60) % 60} min`;
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const RID = '01m51k8w2c6v9tq4hd7nx3bfza';
// The process inventory as pi-processes lists it. `wake`: the start call asked for the end
// to start a turn. `waits`: a recognised `taskfleet run wait` for that spinoff, shown as it.
const PROCS0 = () => [
  { id: 'proc_8c2e', name: 'testit', cmd: 'ptw tests/ -- -q', start: T(14, 31, 8), status: 'running', wake: false,
    out: ['[14:36:12] tests/test_status_rows.py muuttui', 'Running: pytest tests/ -q', '....................................', '36 passed in 1.42s', 'Odotetaan muutoksia…'] },
  { id: 'proc_3f1a', name: 'sivu', cmd: 'python3 -u -m http.server 8000 --directory site', start: T(14, 34, 18), status: 'running', wake: false,
    out: ['Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...', ...[20, 24, 27, 30, 33].map(s => `127.0.0.1 - - [13/Oct/2026 14:34:${s}] "GET /status.json HTTP/1.1" 200 -`)] },
  { id: 'proc_7d40', name: 'hidas-testi', cmd: 'python3 -m pytest tests/slow -q', start: T(14, 35, 2), status: 'running', wake: true,
    out: ['tests/slow/test_backfill.py ........                                  [ 40%]', 'tests/slow/test_history.py ......                                    [ 70%]'] },
  { id: 'proc_51d0', name: 'haku', cmd: 'GITHUB_TOKEN=••• python3 scripts/fetch_status.py --since 2026-09-01', start: T(14, 34, 30), end: T(14, 35, 11), status: 'exited', code: 0, wake: true,
    out: ['haettu 1 240 issueta 26 sivulta', 'varoitus: 3 issueta ilman päivämäärää ohitettiin', 'kirjoitettu status.md: 62 riviä, 4 viikkoa', 'valmis 41 s'] },
  { id: 'proc_0b77', name: 'kello', cmd: 'python3 scripts/watch_status.py --interval 60', start: T(14, 35, 40), end: T(14, 35, 42), status: 'exited', code: 1, wake: true,
    out: ['Traceback (most recent call last):', '  File "scripts/watch_status.py", line 7, in <module>', '    from watchdog.observers import Observer', "ModuleNotFoundError: No module named 'watchdog'"] },
  { id: 'proc_c911', name: 'odota-readme', cmd: `taskfleet run wait ${RID} --output json`, start: T(14, 33, 40), status: 'running', wake: true, waits: 's1', out: [] },
];
// Spinoffs as Taskfleet reports them for this conversation (spinoff round's states).
const SPIN0 = () => [
  { id: 's1', rid: RID, title: 'README: --today-esimerkki', branch: 'wt/r5t-readme-today', st: 'working', start: T(14, 33, 31) },
  { id: 's2', rid: '01m51h2d7q0x4kc8vbe9t5mwra', title: 'CI: pip-välimuisti', branch: 'wt/h2d-ci-pip-cache', st: 'merged', start: T(14, 12, 4), end: T(14, 21, 40), landed: '4be71d0 · 1 commit, +6 −1' },
  { id: 's3', rid: '01m51j6r3n8w2ty5qc0hd4ks1v', title: 'Aikavyöhyke tulosteeseen', branch: 'wt/j6r-timezone', st: 'failed', start: T(14, 14, 50), end: T(14, 29, 3), why: 'Konflikti: scripts/status_rows.py muuttui main-haarassa.' },
];
const SS = {
  working: ['Työskentelee', '<span class="st-dot working"></span>'],
  merged: ['Mergetty', `<span class="sp-mk merged">${IC.merge}</span>`],
  failed: ['Ei mergetty · työ tallessa', `<span class="sp-mk failed">${IC.warn}</span>`],
  unknown: ['Tila ei tiedossa', '<span class="st-dot unknown"></span>'],
};

// ---------- Round state ----------
const B = { v: 'v1', scn: 'all', procs: PROCS0(), spins: SPIN0(), open: {}, sel: null, step: 0, token: 0 };
const LIVE_ST = new Set(['running', 'terminating']);
const procOk = () => B.scn !== 'noproc' && B.scn !== 'none' && B.scn !== 'spinonly';
const spinOk = () => B.scn !== 'nospin' && B.scn !== 'none' && B.scn !== 'proconly';
// The inventory knows the wait process even when Taskfleet does not answer; without the
// process inventory the browser still sees spinoffs but not who waits on them.
const waitFor = (s) => procOk() ? B.procs.find(p => p.waits === s.id && LIVE_ST.has(p.status)) : null;
// Items: one shape for both kinds, so rows, chips and groups treat them alike.
function items() {
  const out = [];
  if (B.scn !== 'none' && B.scn !== 'proconly') for (const s of B.spins) {
    const st = spinOk() ? s.st : (waitFor(s) || procOk() && B.procs.some(p => p.waits === s.id) ? 'unknown' : null);
    if (!st) continue;
    out.push({ kind: 'spin', id: s.id, s, st, live: st === 'working' || (st === 'unknown' && !!waitFor(s)), waited: !!waitFor(s) });
  }
  if (procOk()) for (const p of B.procs) if (!p.waits) out.push({ kind: 'proc', id: p.id, p, live: LIVE_ST.has(p.status), waited: p.wake && LIVE_ST.has(p.status) });
  return out;
}
const waited = () => items().filter(i => i.waited);
const running = () => items().filter(i => i.live && !i.waited);
const ended = () => items().filter(i => !i.live);
const nameOf = (i) => i.kind === 'spin' ? i.s.title : i.p.name;

// ---------- The state model (prosessilohkot direction 1) ----------
STATES.procwait = ['Odottaa prosessia', `<span class="st-proc">${IC.term}</span>`];
STATES.spinwait = ['Odottaa spinoffia', `<span class="st-spin">${IC.spin}</span>`];
STATE_ORDER.procwait = 1.4; STATE_ORDER.spinwait = 1.5;
function c1State() {
  if (UI.working) return 'working';
  const w = waited();
  if (w.some(i => i.kind === 'spin')) return 'spinwait';
  if (w.length) return 'procwait';
  return 'waiting';
}
const pst = (c) => c.id === 'c1' ? c1State() : c.st;
const mark = (s) => { const [l, m] = STATES[s] ?? ['Ei aloitettu', '<span class="st-none"></span>']; return `<span class="st${s === 'spinwait' || s === 'procwait' ? ' st-waitown' : ''}" role="img" aria-label="${l}" title="${l}">${m}</span>`; };
APP.row = (c) => `<a href="#" class="conv-row" data-conv="${c.id}"${c.id === UI.sel ? ' aria-current="page"' : ''}><span class="conv-title">${esc(c.title)}</span>${mark(pst(c))}</a>`;
const libChip = stateChip;
stateChip = (c) => {
  if (c.archived || isEmpty(c) || c.id !== 'c1') return libChip(c);
  const s = pst(c);
  if (s === 'spinwait' || s === 'procwait') {
    const [label, m] = STATES[s];
    return `<button type="button" class="chip ${s} wait-chip" data-bg="chip" title="Agentin vuoro päättyi. Se jatkaa itse, kun ${esc(waited().map(nameOf).join(' ja '))} valmistuu.">${m}<span class="chip-label">${label}</span></button>`;
  }
  return libChip(c);
};

// ---------- Shared pieces: one row anatomy for both kinds ----------
const since = (t) => `<span data-since="${t}">${dur(Math.max(0, nowS() - t))}</span>`;
function procInfo(p) {
  if (p.status === 'running') return { cls: 'run', mark: '<span class="pr-dot run"></span>', label: 'Käynnissä', meta: since(p.start) };
  if (p.status === 'killed') return { cls: 'killed', mark: '<span class="pr-dot killed"></span>', label: 'Pysäytetty', meta: hm(p.end) };
  return p.code === 0
    ? { cls: 'ok', mark: `<span class="pr-ic ok">${ICON_CHECK}</span>`, label: 'Valmis', meta: `${hm(p.end)} · ${dur(p.end - p.start)}` }
    : { cls: 'fail', mark: `<span class="pr-ic err">${IC.fail}</span>`, label: `Virhe · koodi ${p.code}`, meta: `${hm(p.end)} · ${dur(p.end - p.start)}` };
}
function spinInfo(i) {
  const [label, m] = SS[i.st];
  const meta = i.st === 'working' ? since(i.s.start) : i.st === 'unknown' ? '' : hm(i.s.end);
  return { cls: `sp ${i.st}`, mark: m, label, meta };
}
const info = (i) => i.kind === 'spin' ? spinInfo(i) : procInfo(i.p);
const wakeMark = (i) => i.waited ? `<span class="bg-wake" role="img" aria-label="Agentti odottaa tätä" title="${i.kind === 'spin' ? 'Agentti jatkaa, kun spinoff valmistuu' : 'Agentti jatkaa, kun tämä päättyy'}">${IC.wake}</span>` : '';
const sub = (i) => i.kind === 'spin' ? `spinoff · <span class="mono">${esc(i.s.branch)}</span>` : `<span class="mono">${esc(i.p.cmd)}</span>`;
function action(i) {
  if (i.kind === 'proc' && i.live) return `<button type="button" class="icon-btn bg-stop" data-bg="stop" data-id="${i.id}" aria-label="Pysäytä ${esc(i.p.name)}" title="Pysäytä prosessi ${esc(i.p.name)}. Agentti ei saa tästä ilmoitusta.">${IC.stop}</button>`;
  if (i.kind === 'spin' && i.waited) return `<button type="button" class="icon-btn bg-stop" data-bg="unwait" data-id="${i.id}" aria-label="Lopeta odotus" title="Lopettaa agentin odotuksen. Spinoff jatkaa työtään, eikä agentti saa ilmoitusta.">${IC.stop}</button>`;
  return '<span class="bg-act-gap" aria-hidden="true"></span>';
}
function row(i) {
  const n = info(i); const sel = B.sel === i.id;
  const name = i.kind === 'spin' ? `<span class="bg-name sp-name">${esc(i.s.title)}</span>` : `<span class="bg-name mono">${esc(i.p.name)}</span>`;
  return `<div class="bg-row ${n.cls}${sel ? ' sel' : ''}" data-row="${i.id}"><button type="button" class="bg-main" data-bg="sel" data-id="${i.id}" aria-expanded="${sel}">${CHEV}<span class="bg-mark" aria-hidden="true">${n.mark}</span>${name}<span class="bg-sub">${sub(i)}</span><span class="bg-meta"><span class="bg-label">${n.label}</span>${n.meta ? `<span class="bg-sep">·</span>${n.meta}` : ''}</span></button>${wakeMark(i)}${action(i)}</div>${sel ? `<div class="bg-detail">${detail(i)}</div>` : ''}`;
}
function detail(i) {
  if (i.kind === 'proc') {
    const p = i.p; const end = LIVE_ST.has(p.status) ? '' : `<div class="bg-end">${p.status === 'killed' ? `Pysäytetty ${hm(p.end)}` : `Päättyi ${hm(p.end)} · koodi ${p.code}`}</div>`;
    return `<div class="bg-out" tabindex="0" aria-label="Tuloste: ${esc(p.name)}">${p.out.map(l => `<div class="ln"><span class="t">${esc(l)}</span></div>`).join('')}${end}</div>`;
  }
  const s = i.s; const w = B.procs.find(p => p.waits === s.id);
  const res = i.st === 'merged' ? `<dt>Tulos</dt><dd>Mergetty main-haaraan · <span class="mono">${esc(s.landed)}</span></dd>` : i.st === 'failed' ? `<dt>Tulos</dt><dd>${esc(s.why)} Työ on tallessa haarassa <span class="mono">${esc(s.branch)}</span>.</dd>` : i.st === 'unknown' ? '<dt>Tila</dt><dd>Taskfleet ei vastaa; ajo tunnetaan agentin odotusprosessista.</dd>' : '';
  const waitLine = w && procOk() ? `<dt>Odotus</dt><dd>${LIVE_ST.has(w.status) ? 'Agentti odottaa' : 'Odotus päättyi'} · <span class="mono">${esc(w.cmd)}</span></dd>` : '';
  return `<dl class="bg-facts">${res}<dt>Ajo</dt><dd class="mono">${esc(s.rid)}</dd>${waitLine}</dl><div class="bg-acts"><button type="button" class="secondary" data-bg="openspin" data-id="${s.id}">${IC.ext}<span>Avaa spinoff</span></button><span class="bg-note">Vain luku: spinoffia ohjaa agentti.</span></div>`;
}
const clearBtn = () => procOk() && B.procs.some(p => !p.waits && !LIVE_ST.has(p.status)) ? `<button type="button" class="bg-clear" data-bg="clear" title="Poistaa päättyneet prosessit ja niiden lokit. Päättyneet spinoffit jäävät: ne ovat Taskfleetin ajoja.">${IC.trash}<span>Poista päättyneet</span></button>` : '';
const LIFE = 'Prosessit ja spinoffit jatkavat, vaikka suljet selaimen.';
const grp = (label, list, extra = '') => list.length ? `<div class="bg-gh"><h4 class="bg-h">${label}</h4>${extra}</div><div class="bg-group" role="group" aria-label="${label}">${list.map(row).join('')}</div>` : '';
const muted = (txt) => `<p class="bg-unavail">${txt}</p>`;
const NOPROC = 'Prosessiyhteys ei ole saatavilla: Pi:tä ohjataan terminaalista, joten selain ei näe sen prosesseja.';
const NOSPIN = 'Spinoffien tilaa ei saada: Taskfleet ei vastaa. Agentin odottama ajo näkyy odotusprosessista.';

// Summaries: "Odotan …" names what the agent waits for (prosessilohkot, Jari 16.10.2026).
const odotan = (w) => {
  const sp = w.filter(i => i.kind === 'spin'), pr = w.filter(i => i.kind === 'proc');
  if (sp.length && !pr.length) return `<strong>Odotan spinoffia</strong><span class="bg-names">${esc(sp.map(nameOf).join(', '))}</span>`;
  if (pr.length && !sp.length) return `<strong>Odotan:&nbsp;<span class="mono">${esc(pr.map(nameOf).join(', '))}</span></strong>`;
  return `<strong>Odotan</strong><span class="bg-names">spinoffia ${esc(sp.map(nameOf).join(', '))} ja <span class="mono">${esc(pr.map(nameOf).join(', '))}</span></span>`;
};
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---------- 1 · Yksi palkki ----------
function v1Html() {
  const all = items(); if (!all.length && procOk()) return '';
  const w = waited(), r = running(), e = ended();
  const nP = [...w, ...r].filter(i => i.kind === 'proc').length, nS = [...w, ...r].filter(i => i.kind === 'spin').length;
  const parts = [nS ? count(nS, 'spinoff', 'spinoffia') : '', nP ? count(nP, 'prosessi', 'prosessia') : ''].filter(Boolean).join(' · ');
  let sum;
  if (!UI.working && w.length) sum = `${odotan(w)}${r.length ? `<span class="bg-names">${r.length} muuta käynnissä</span>` : ''}`;
  else sum = parts ? `<strong>Taustatyö</strong><span class="bg-names">${parts} käynnissä</span>` : '<strong>Taustatyö</strong><span class="bg-names">ei käynnissä</span>';
  const ic = !UI.working && w.length ? (w.some(i => i.kind === 'spin') ? `<span class="st-spin">${IC.spin}</span>` : `<span class="st-proc">${IC.term}</span>`) : (w.length || r.length) ? '<span class="pr-dot run"></span>' : IC.stack;
  const open = !!B.open.all;
  const bar = `<button type="button" class="bg-bar${!UI.working && w.length ? ' waiting' : ''}" data-bg="toggle" data-key="all" aria-expanded="${open}">${CHEV}<span class="bg-ic">${ic}</span><span class="bg-sum">${sum}</span>${e.length ? `<span class="bg-done">${count(e.length, 'päättynyt', 'päättynyttä')}</span>` : ''}${!procOk() && B.scn === 'noproc' ? '<span class="bg-done">prosessit ei tiedossa</span>' : ''}</button>`;
  const list = open ? `<div class="bg-list">${!procOk() && B.scn === 'noproc' ? muted(NOPROC) : ''}${!spinOk() && B.scn === 'nospin' ? muted(NOSPIN) : ''}${grp('Agentti odottaa', w)}${grp('Käynnissä', r)}${grp('Päättyneet', e, clearBtn())}<p class="bg-life">${LIFE}</p></div>` : '';
  return `<div class="bg-one">${bar}${list}</div>`;
}

// ---------- 2 · Kaksi palkkia ----------
function kindBar(kind) {
  const all = items().filter(i => i.kind === kind);
  const ok = kind === 'proc' ? procOk() : spinOk();
  const key = kind; const open = !!B.open[key];
  const label = kind === 'spin' ? 'Spinoffit' : 'Prosessit';
  const icon = kind === 'spin' ? IC.spin : IC.term;
  if (!ok && !all.length) {
    const reason = kind === 'proc' ? 'Prosessiyhteys ei ole saatavilla' : 'Spinoffien tilaa ei saada';
    return `<div class="bg-bar muted" title="${kind === 'proc' ? NOPROC : NOSPIN}"><span class="bg-ic">${icon}</span><span class="bg-sum"><strong>${label}</strong><span class="bg-names">${reason}</span></span></div>`;
  }
  if (!all.length) return '';
  const w = all.filter(i => i.waited), r = all.filter(i => i.live && !i.waited), e = all.filter(i => !i.live);
  const live = w.length + r.length;
  const word = kind === 'spin' ? (n) => `${n} työskentelee` : (n) => `${n} käynnissä`;
  const sum = !UI.working && w.length ? `${odotan(w)}${r.length ? `<span class="bg-names">${r.length} muuta ${kind === 'spin' ? 'työskentelee' : 'käynnissä'}</span>` : ''}` : `<strong>${label}</strong><span class="bg-names">${live ? word(live) : 'ei käynnissä'}</span>`;
  const ic = !UI.working && w.length ? `<span class="${kind === 'spin' ? 'st-spin' : 'st-proc'}">${icon}</span>` : `<span class="bg-kind">${icon}</span>`;
  const bar = `<button type="button" class="bg-bar${!UI.working && w.length ? ' waiting' : ''}" data-bg="toggle" data-key="${key}" aria-expanded="${open}">${CHEV}<span class="bg-ic">${ic}</span><span class="bg-sum">${sum}</span>${live && (UI.working || !w.length) ? '<span class="pr-dot run" aria-hidden="true"></span>' : ''}${e.length ? `<span class="bg-done">${count(e.length, 'päättynyt', 'päättynyttä')}</span>` : ''}</button>`;
  const note = kind === 'spin' && !spinOk() ? muted(NOSPIN) : '';
  const list = open ? `<div class="bg-list">${note}${grp('Agentti odottaa', w)}${grp(kind === 'spin' ? 'Työskentelee' : 'Käynnissä', r)}${grp('Päättyneet', e, kind === 'proc' ? clearBtn() : '')}${kind === 'proc' ? `<p class="bg-life">${LIFE}</p>` : ''}</div>` : '';
  return `<div class="bg-one">${bar}${list}</div>`;
}
const v2Html = () => `<div class="bg-two">${kindBar('spin')}${kindBar('proc')}</div>`;

// ---------- 3 · Sirut ----------
function chip(i) {
  const n = info(i); const on = B.sel === i.id;
  const name = i.kind === 'spin' ? `<span class="bg-chip-kind" aria-hidden="true">${IC.spin}</span><span class="sp-name">${esc(i.s.title)}</span>` : `<span class="bg-chip-kind" aria-hidden="true">${IC.term}</span><span class="mono">${esc(i.p.name)}</span>`;
  const t = i.kind === 'spin' ? (i.st === 'working' ? `<span class="bg-chip-t" data-clock="${i.s.start}">${clock(Math.max(0, nowS() - i.s.start))}</span>` : '') : `<span class="bg-chip-t" data-clock="${i.p.start}">${clock(Math.max(0, nowS() - i.p.start))}</span>`;
  return `<button type="button" class="bg-chip${i.waited ? ' waited' : ''}${i.kind === 'spin' ? ' spin' : ''}" data-bg="chip-sel" data-id="${i.id}" aria-expanded="${on}" title="${esc(`${i.kind === 'spin' ? 'Spinoff' : 'Prosessi'} ${nameOf(i)} · ${n.label}${i.waited ? ' · agentti odottaa tätä' : ''}`)}">${i.waited ? `<span class="bg-chip-wake" aria-label="Agentti odottaa">${IC.wake}</span>` : `<span class="bg-mark" aria-hidden="true">${n.mark}</span>`}${name}${t}</button>`;
}
function v3Html() {
  const w = waited(), r = running(), e = ended();
  if (!w.length && !r.length && !e.length && procOk() && spinOk()) return '';
  const sel = items().find(i => i.id === B.sel);
  const endOpen = B.sel === 'ended';
  let panel = '';
  if (sel) panel = `<div class="bg-pop" role="region" aria-label="${esc(nameOf(sel))}"><div class="bg-group">${row({ ...sel })}</div></div>`;
  else if (endOpen) panel = `<div class="bg-pop" role="region" aria-label="Päättyneet">${grp('Päättyneet', e, clearBtn())}<p class="bg-life">${LIFE}</p></div>`;
  const lead = !UI.working && w.length ? `<span class="bg-lead">Odotan</span>` : '';
  const unk = [!procOk() && B.scn === 'noproc' ? `<span class="bg-chip muted" title="${NOPROC}"><span class="bg-chip-kind" aria-hidden="true">${IC.term}</span>Prosessit ei tiedossa</span>` : '', !spinOk() && B.scn === 'nospin' && !items().some(i => i.kind === 'spin') ? `<span class="bg-chip muted" title="${NOSPIN}"><span class="bg-chip-kind" aria-hidden="true">${IC.spin}</span>Spinoffit ei tiedossa</span>` : ''].join('');
  const endChip = e.length ? `<button type="button" class="bg-chip ended" data-bg="chip-sel" data-id="ended" aria-expanded="${endOpen}">${CHEV}${count(e.length, 'päättynyt', 'päättynyttä')}</button>` : '';
  return `<div class="bg-chips-wrap">${panel}<div class="bg-chips" role="group" aria-label="Taustatyö">${lead}${[...w, ...r].map(chip).join('')}${unk}${endChip}</div></div>`;
}

// ---------- The strip above the field ----------
const strip = document.createElement('section'); strip.className = 'bg-strip'; strip.setAttribute('aria-label', 'Taustatyö');
function paintStrip() {
  const anchor = uiCol.querySelector('.recap-host') || uiCol.querySelector('.composer');
  if (strip.nextSibling !== anchor) uiCol.insertBefore(strip, anchor);
  const html = UI.sel !== 'c1' ? '' : B.v === 'v1' ? v1Html() : B.v === 'v2' ? v2Html() : v3Html();
  strip.hidden = !html; strip.className = `bg-strip ${B.v}`;
  if (strip.dataset.html !== html) { strip.innerHTML = html; strip.dataset.html = html; }
}
APP.painted.push(paintStrip);
// The clock changes text only; rows and chips keep their elements (and clicks).
setInterval(() => {
  for (const el of strip.querySelectorAll('[data-since]')) el.textContent = dur(Math.max(0, nowS() - +el.dataset.since));
  for (const el of strip.querySelectorAll('[data-clock]')) el.textContent = clock(Math.max(0, nowS() - +el.dataset.clock));
}, 1000);

// ---------- Actions ----------
const proc = (id) => B.procs.find(p => p.id === id);
const spin = (id) => B.spins.find(s => s.id === id);
function act(t) {
  const a = t.dataset.bg; const id = t.dataset.id;
  // Two bars open one list at a time, so the thread keeps its room (phone especially).
  if (a === 'toggle') { const k = t.dataset.key; const on = !B.open[k]; B.open = { [k]: on }; B.sel = null; return paint(); }
  if (a === 'sel') { B.sel = B.sel === id ? null : id; return paint(); }
  if (a === 'chip-sel') { B.sel = B.sel === id ? null : id; return paint(); }
  if (a === 'stop') { const p = proc(id); p.status = 'killed'; p.end = nowS(); toast(`Prosessi ${p.name} pysäytettiin.`); return paint(); }
  if (a === 'unwait') { const w = B.procs.find(p => p.waits === id && LIVE_ST.has(p.status)); if (w) { w.status = 'killed'; w.end = nowS(); } toast('Odotus lopetettiin. Spinoff jatkaa työtään.'); return paint(); }
  if (a === 'clear') { const n = B.procs.filter(p => !p.waits && !LIVE_ST.has(p.status)).length; B.procs = B.procs.filter(p => p.waits || LIVE_ST.has(p.status)); if (items().every(i => i.id !== B.sel)) B.sel = null; toast(`${count(n, 'päättynyt prosessi', 'päättynyttä prosessia')} ja ${n === 1 ? 'sen loki' : 'niiden lokit'} poistettiin. Historia säilyy.`); return paint(); }
  if (a === 'openspin') return toast(`Avaa spinoffin ${spin(id).title} vain luku -näkymän (kierros 2026-10-16-spinoffit).`);
  if (a === 'chip') {
    // The top-bar chip opens what the agent waits for.
    const w = waited()[0]; if (!w) return;
    if (B.v === 'v1') B.open = { all: true }; else if (B.v === 'v2') B.open = { [w.kind]: true };
    B.sel = w.id; paint(); strip.scrollIntoView({ block: 'nearest' }); return;
  }
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-bg]'); if (!t || t.closest('.proto-picker')) return;
  e.preventDefault(); e.stopPropagation(); act(t);
}, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && B.v === 'v3' && B.sel) { B.sel = null; paint(); } });

// ---------- Page bar: the situation, and the next event in the story ----------
const SCN = { all: 'Prosessit ja spinoffit', proconly: 'Vain prosesseja', spinonly: 'Vain spinoffeja', none: 'Ei taustatyötä', noproc: 'Prosessiyhteys puuttuu', nospin: 'Spinoffien tila ei saatavilla' };
document.querySelector('.page-bar .hint').insertAdjacentHTML('beforebegin', `<label>Tilanne <select id="bg-scn">${Object.entries(SCN).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label><button type="button" id="bg-next" class="page-btn" title="hidas-testi valmistuu, sitten spinoff mergetään">Seuraava tapahtuma</button>`);
document.getElementById('bg-scn').addEventListener('change', (e) => { B.scn = e.target.value; B.sel = null; paint(); });
document.getElementById('bg-next').addEventListener('click', () => {
  const t = nowS();
  if (B.step === 0) { const p = proc('proc_7d40'); if (p) { p.status = 'exited'; p.code = 0; p.end = t; p.out.push('tests/slow/test_rollup.py .........                                   [100%]', '23 passed in 118.40s'); } B.step = 1; toast(UI.working ? 'hidas-testi valmistui: ilmoitus menee agentille ohjauksena.' : 'hidas-testi valmistui: agentti odottaa vielä spinoffia.'); }
  else if (B.step === 1) { const s = spin('s1'); s.st = 'merged'; s.end = t; s.landed = '9a1c2e7 · 1 commit, +7 −0'; const w = proc('proc_c911'); w.status = 'exited'; w.code = 0; w.end = t; B.step = 2; toast(UI.working ? 'Spinoff mergettiin: tieto menee agentille ohjauksena.' : 'Spinoff mergettiin ja herätti agentin.'); }
  else { B.procs = PROCS0(); B.spins = SPIN0(); B.step = 0; toast('Tarina alkaa alusta.'); }
  paint();
});

// ---------- Directions ----------
function view(v) {
  Object.assign(B, { v, sel: null, open: {} });
  UI.sel = 'c1';
  return appView();
}
window.v1 = () => view('v1');
window.v2 = () => view('v2');
window.v3 = () => view('v3');
})();
