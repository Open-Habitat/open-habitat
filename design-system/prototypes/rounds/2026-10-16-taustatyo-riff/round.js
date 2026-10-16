// Kierros 16.10.2026: Yksi palkki -suunnan riffi (issue proto-background-strip-riff).
// Levossa palkki vastaa vain kolmeen kysymykseen: onko jotain käynnissä, kumpaa lajia, ja
// tarvitseeko jokin minua. Spinoffit ja prosessit ovat aina erillään: oma nimi, oma kuvake,
// oma lista. Yksityiskohdat (komento, haara, tuloste, ajo) ovat rivin takana. Päätetyt
// käytökset säilyvät: `taskfleet run wait` näkyy spinoffinaan, Poista päättyneet ei poista
// spinoffeja, ja odotusmerkki vilkkuu vain sivupalkissa.
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
  x: SVG('<path d="M6 6l12 12M18 6 6 18"/>'),
};

// ---------- Synthetic native facts (the base round's, plus a second running spinoff) ----------
const T0 = performance.now(); const BASE = 14 * 3600 + 37 * 60;
const nowS = () => BASE + Math.floor((performance.now() - T0) / 1000);
const T = (h, m, s = 0) => h * 3600 + m * 60 + s;
const hm = (s) => `${Math.floor(s / 3600)}.${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;
const dur = (s) => s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.floor(s / 60) % 60} min`;
const RID = '01m51k8w2c6v9tq4hd7nx3bfza';
// pi-processes' inventory. `wake`: the end starts a turn. `waits`: a recognised
// `taskfleet run wait` for that spinoff, shown as the spinoff, never as a process.
const PROCS0 = () => [
  { id: 'proc_8c2e', name: 'testit', cmd: 'ptw tests/ -- -q', start: T(14, 31, 8), status: 'running', wake: false,
    out: ['[14:36:12] tests/test_status_rows.py muuttui', 'Running: pytest tests/ -q', '....................................', '36 passed in 1.42s', 'Odotetaan muutoksia…'] },
  { id: 'proc_3f1a', name: 'sivu', cmd: 'python3 -u -m http.server 8000 --directory site', start: T(14, 34, 18), status: 'running', wake: false,
    out: ['Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...', ...[20, 24, 27, 30, 33].map(s => `127.0.0.1 - - [16/Oct/2026 14:34:${s}] "GET /status.json HTTP/1.1" 200 -`)] },
  { id: 'proc_7d40', name: 'hidas-testi', cmd: 'python3 -m pytest tests/slow -q', start: T(14, 35, 2), status: 'running', wake: true,
    out: ['tests/slow/test_backfill.py ........                                  [ 40%]', 'tests/slow/test_history.py ......                                    [ 70%]'] },
  { id: 'proc_51d0', name: 'haku', cmd: 'GITHUB_TOKEN=••• python3 scripts/fetch_status.py --since 2026-09-01', start: T(14, 34, 30), end: T(14, 35, 11), status: 'exited', code: 0, wake: true,
    out: ['haettu 1 240 issueta 26 sivulta', 'varoitus: 3 issueta ilman päivämäärää ohitettiin', 'kirjoitettu status.md: 62 riviä, 4 viikkoa', 'valmis 41 s'] },
  { id: 'proc_0b77', name: 'kello', cmd: 'python3 scripts/watch_status.py --interval 60', start: T(14, 35, 40), end: T(14, 35, 42), status: 'exited', code: 1, wake: true,
    out: ['Traceback (most recent call last):', '  File "scripts/watch_status.py", line 7, in <module>', '    from watchdog.observers import Observer', "ModuleNotFoundError: No module named 'watchdog'"] },
  { id: 'proc_c911', name: 'odota-readme', cmd: `taskfleet run wait ${RID} --output json`, start: T(14, 33, 40), status: 'running', wake: true, waits: 's1', out: [] },
];
const SPIN0 = () => [
  { id: 's1', rid: RID, title: 'README: --today-esimerkki', branch: 'wt/r5t-readme-today', st: 'working', start: T(14, 33, 31) },
  { id: 's4', rid: '01m51m3q8z5c1rv7kd2tx6hnwe', title: 'Testit aikavyöhykkeille', branch: 'wt/m3q-tz-tests', st: 'working', start: T(14, 30, 12) },
  { id: 's2', rid: '01m51h2d7q0x4kc8vbe9t5mwra', title: 'CI: pip-välimuisti', branch: 'wt/h2d-ci-pip-cache', st: 'merged', start: T(14, 12, 4), end: T(14, 21, 40), landed: '4be71d0 · 1 commit, +6 −1' },
  { id: 's3', rid: '01m51j6r3n8w2ty5qc0hd4ks1v', title: 'Aikavyöhyke tulosteeseen', branch: 'wt/j6r-timezone', st: 'failed', start: T(14, 14, 50), end: T(14, 29, 3), why: 'Konflikti: scripts/status_rows.py muuttui main-haarassa.' },
];

// ---------- Round state ----------
// open: which kind's list is open ('spin' | 'proc' | null). seen: failed spinoffs whose list
// has been opened; "needs me" asks for one look, it is not a standing alarm.
const B = { v: 'v1', scn: 'all', procs: PROCS0(), spins: SPIN0(), open: null, sel: null, ended: {}, seen: new Set(), step: 0 };
const LIVE_ST = new Set(['running', 'terminating']);
const procOk = () => !['noproc', 'none', 'spinonly'].includes(B.scn);
const spinOk = () => !['nospin', 'none', 'proconly'].includes(B.scn);
const waitFor = (s) => procOk() ? B.procs.find(p => p.waits === s.id && LIVE_ST.has(p.status)) : null;
function items() {
  const out = [];
  if (B.scn !== 'none' && B.scn !== 'proconly') for (const s of B.spins) {
    const st = spinOk() ? s.st : (waitFor(s) ? 'unknown' : null);
    if (!st) continue;
    out.push({ kind: 'spin', id: s.id, s, st, live: st === 'working' || st === 'unknown', waited: !!waitFor(s) });
  }
  if (procOk()) for (const p of B.procs) if (!p.waits) out.push({ kind: 'proc', id: p.id, p, live: LIVE_ST.has(p.status), waited: p.wake && LIVE_ST.has(p.status) });
  return out;
}
const nameOf = (i) => i.kind === 'spin' ? i.s.title : i.p.name;
const KIND = {
  spin: { label: 'Spinoffit', one: 'spinoff', icon: IC.spin, liveWord: 'työskentelee', ok: spinOk, unavail: 'Spinoffien tilaa ei saada: Taskfleet ei vastaa. Agentin odottama ajo näkyy sen odotusprosessista.' },
  proc: { label: 'Prosessit', one: 'prosessi', icon: IC.term, liveWord: 'käynnissä', ok: procOk, unavail: 'Prosessiyhteys ei ole saatavilla: Pi:tä ohjataan terminaalista, joten selain ei näe sen prosesseja.' },
};
// Everything the strip says at rest about one kind.
function facts(kind) {
  const all = items().filter(i => i.kind === kind);
  const live = [...all.filter(i => i.live && i.waited), ...all.filter(i => i.live && !i.waited)];
  const w = all.filter(i => i.waited);
  const attn = kind === 'spin' ? all.filter(i => i.st === 'failed' && !B.seen.has(i.id)) : [];
  const ok = KIND[kind].ok();
  const absentByChoice = kind === 'spin' ? ['none', 'proconly'].includes(B.scn) : ['none', 'spinonly'].includes(B.scn);
  return { all, live, ended: all.filter(i => !i.live), w, attn, ok, present: !absentByChoice && (all.length > 0 || !ok), idleWait: !UI.working && w.length > 0 };
}
const waited = () => items().filter(i => i.waited);
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// One sentence for screen readers and tooltips; the eye gets only the marks.
function sentence(kind, f) {
  const k = KIND[kind];
  if (!f.ok && !f.all.length) return `${k.label}: ei tiedossa`;
  const bits = [f.live.length ? `${f.live.length} ${k.liveWord}` : 'ei käynnissä'];
  if (f.idleWait) bits.push(`agentti odottaa: ${f.w.map(nameOf).join(', ')}`);
  if (f.attn.length) bits.push(`${count(f.attn.length, 'ei mergetty', 'ei mergetty')}, työ tallessa`);
  if (f.ended.length) bits.push(count(f.ended.length, 'päättynyt', 'päättynyttä'));
  return `${k.label}: ${bits.join(', ')}`;
}

// ---------- The state model (prosessilohkot direction 1; unchanged from the base) ----------
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

// ---------- The open list: one kind, one line per item, details behind the row ----------
const since = (t) => `<span data-since="${t}">${dur(Math.max(0, nowS() - t))}</span>`;
function info(i) {
  if (i.kind === 'spin') {
    if (i.st === 'working') return { cls: 'sp working', mark: '<span class="pr-dot run"></span>', meta: since(i.s.start) };
    if (i.st === 'unknown') return { cls: 'sp unknown', mark: '<span class="pr-dot unknown"></span>', meta: '<span class="bg-label">Tila ei tiedossa</span>' };
    if (i.st === 'merged') return { cls: 'sp merged', mark: `<span class="sp-mk merged">${IC.merge}</span>`, meta: `<span class="bg-label">Mergetty</span> ${hm(i.s.end)}` };
    return { cls: 'sp failed', mark: `<span class="sp-mk failed">${IC.warn}</span>`, meta: '<span class="bg-label">Ei mergetty · työ tallessa</span>' };
  }
  const p = i.p;
  if (p.status === 'running') return { cls: 'run', mark: '<span class="pr-dot run"></span>', meta: since(p.start) };
  if (p.status === 'killed') return { cls: 'killed', mark: '<span class="pr-dot killed"></span>', meta: `<span class="bg-label">Pysäytetty</span> ${hm(p.end)}` };
  return p.code === 0
    ? { cls: 'ok', mark: `<span class="pr-ic ok">${ICON_CHECK}</span>`, meta: `<span class="bg-label">Valmis</span> ${hm(p.end)}` }
    : { cls: 'fail', mark: `<span class="pr-ic err">${IC.fail}</span>`, meta: `<span class="bg-label">Virhe · koodi ${p.code}</span>` };
}
const wakeMark = (i) => i.waited ? `<span class="bg-wake" role="img" aria-label="Agentti odottaa tätä" title="${i.kind === 'spin' ? 'Agentti jatkaa, kun spinoff valmistuu' : 'Agentti jatkaa, kun tämä päättyy'}">${IC.wake}</span>` : '';
function action(i) {
  if (i.kind === 'proc' && i.live) return `<button type="button" class="icon-btn bg-stop" data-bg="stop" data-id="${i.id}" aria-label="Pysäytä ${esc(i.p.name)}" title="Pysäytä prosessi ${esc(i.p.name)}. Agentti ei saa tästä ilmoitusta.">${IC.stop}</button>`;
  if (i.kind === 'spin' && i.waited) return `<button type="button" class="icon-btn bg-stop" data-bg="unwait" data-id="${i.id}" aria-label="Lopeta odotus" title="Lopettaa agentin odotuksen. Spinoff jatkaa työtään, eikä agentti saa ilmoitusta.">${IC.stop}</button>`;
  return '<span class="bg-act-gap" aria-hidden="true"></span>';
}
function row(i) {
  const n = info(i); const sel = B.sel === i.id;
  const name = i.kind === 'spin' ? `<span class="bg-name sp-name">${esc(i.s.title)}</span>` : `<span class="bg-name mono">${esc(i.p.name)}</span>`;
  return `<div class="bg-row ${n.cls}${sel ? ' sel' : ''}"><button type="button" class="bg-main" data-bg="sel" data-id="${i.id}" aria-expanded="${sel}">${CHEV}<span class="bg-mark" aria-hidden="true">${n.mark}</span>${name}<span class="bg-meta">${n.meta}</span></button>${wakeMark(i)}${action(i)}</div>${sel ? `<div class="bg-detail">${detail(i)}</div>` : ''}`;
}
function detail(i) {
  if (i.kind === 'proc') {
    const p = i.p; const end = LIVE_ST.has(p.status) ? '' : `<div class="bg-end">${p.status === 'killed' ? `Pysäytetty ${hm(p.end)}` : `Päättyi ${hm(p.end)} · koodi ${p.code} · kesti ${dur(p.end - p.start)}`}</div>`;
    return `<div class="bg-cmd"><span class="mono">$ ${esc(p.cmd)}</span></div><div class="bg-out" tabindex="0" aria-label="Tuloste: ${esc(p.name)}">${p.out.map(l => `<div class="ln"><span class="t">${esc(l)}</span></div>`).join('')}${end}</div>`;
  }
  const s = i.s; const w = B.procs.find(p => p.waits === s.id);
  const res = i.st === 'merged' ? `<dt>Tulos</dt><dd>Mergetty main-haaraan · <span class="mono">${esc(s.landed)}</span></dd>` : i.st === 'failed' ? `<dt>Tulos</dt><dd>${esc(s.why)} Työ on tallessa haarassa.</dd>` : i.st === 'unknown' ? '<dt>Tila</dt><dd>Taskfleet ei vastaa; ajo tunnetaan agentin odotusprosessista.</dd>' : '';
  const waitLine = w && procOk() ? `<dt>Odotus</dt><dd>${LIVE_ST.has(w.status) ? 'Agentti odottaa' : 'Odotus päättyi'} · <span class="mono">${esc(w.cmd)}</span></dd>` : '';
  return `<dl class="bg-facts">${res}<dt>Haara</dt><dd class="mono">${esc(s.branch)}</dd><dt>Ajo</dt><dd class="mono">${esc(s.rid)}</dd>${waitLine}</dl><div class="bg-acts"><button type="button" class="secondary" data-bg="openspin" data-id="${s.id}">${IC.ext}<span>Avaa spinoff</span></button><span class="bg-note">Vain luku: spinoffia ohjaa agentti.</span></div>`;
}
const clearBtn = () => procOk() && B.procs.some(p => !p.waits && !LIVE_ST.has(p.status)) ? `<button type="button" class="bg-clear" data-bg="clear" title="Poistaa päättyneet prosessit ja niiden lokit. Päättyneet spinoffit jäävät: ne ovat Taskfleetin ajoja.">${IC.trash}<span>Poista päättyneet</span></button>` : '';
function kindList(kind) {
  const f = facts(kind); const k = KIND[kind];
  const note = !f.ok ? `<p class="bg-unavail">${k.unavail}</p>` : '';
  const live = f.live.length ? `<div class="bg-group" role="group" aria-label="${k.label}: ${k.liveWord}">${f.live.map(row).join('')}</div>` : (f.ok ? `<p class="bg-empty">Ei ${kind === 'spin' ? 'työskenteleviä spinoffeja' : 'käynnissä olevia prosesseja'}.</p>` : '');
  const eo = !!B.ended[kind];
  const ended = f.ended.length ? `<div class="bg-endhead"><button type="button" class="bg-endfold" data-bg="endfold" data-key="${kind}" aria-expanded="${eo}">${CHEV}<span>${count(f.ended.length, 'päättynyt', 'päättynyttä')}</span>${f.attn.length && !eo ? '<span class="bg-attn-dot" aria-label="Vaatii huomiota"></span>' : ''}</button>${eo && kind === 'proc' ? clearBtn() : ''}</div>${eo ? `<div class="bg-group" role="group" aria-label="${k.label}: päättyneet">${f.ended.map(row).join('')}</div>` : ''}` : '';
  const life = kind === 'spin' ? 'Spinoffit ovat Taskfleetin ajoja; selain vain näyttää ne.' : 'Prosessit jatkavat, vaikka suljet selaimen.';
  return `${note}${live}${ended}<p class="bg-life">${life}</p>`;
}
// Opening a kind is the one look that "needs me" asks for: its failures count as seen,
// and the finished part opens by itself when something there needs attention.
function openKind(kind) {
  if (B.open === kind) { B.open = null; B.sel = null; return; }
  const f = facts(kind);
  if (f.attn.length) B.ended[kind] = true;
  for (const i of f.attn) B.seen.add(i.id);
  B.open = kind; B.sel = null;
}

// ---------- Marks shared by the three directions ----------
const bell = (f) => f.idleWait ? `<span class="bg-bell" aria-hidden="true">${IC.wake}</span>` : '';
const attnDot = (f) => f.attn.length ? '<span class="bg-attn-dot" aria-hidden="true"></span>' : '';
const liveDot = (f) => f.live.length ? '<span class="pr-dot run" aria-hidden="true"></span>' : '';

// ---------- 1 · Kaksi lokeroa ----------
function seg(kind) {
  const f = facts(kind); if (!f.present) return '';
  const k = KIND[kind]; const open = B.open === kind;
  const n = !f.ok && !f.all.length ? '<span class="bg-n muted">?</span>' : f.live.length ? `<span class="bg-n">${f.live.length}</span>` : '<span class="bg-n zero">0</span>';
  return `<button type="button" class="bg-seg ${kind}${!f.live.length ? ' idle' : ''}" data-bg="kind" data-key="${kind}" aria-expanded="${open}" aria-label="${esc(sentence(kind, f))}" title="${esc(sentence(kind, f))}"><span class="bg-kind-ic">${k.icon}</span><span class="bg-kind-l">${k.label}</span>${n}<span class="bg-seg-marks">${bell(f)}${attnDot(f)}</span></button>`;
}
function v1Html() {
  const segs = ['spin', 'proc'].map(seg).filter(Boolean);
  if (!segs.length) return '';
  const list = B.open ? `<div class="bg-list" role="region" aria-label="${KIND[B.open].label}">${kindList(B.open)}</div>` : '';
  return `<div class="bg-one">${list}<div class="bg-segbar${B.open ? ' open' : ''}">${segs.join('<span class="bg-div" aria-hidden="true"></span>')}</div></div>`;
}

// ---------- 2 · Rivi lajille ----------
// The one fact a kind's line says: the agent's wait, else what needs me, else how many run.
function lineFact(kind, f) {
  const k = KIND[kind];
  if (!f.ok && !f.all.length) return { html: '<span class="bg-fact muted">ei tiedossa</span>', used: '' };
  if (f.idleWait) return { html: `<span class="bg-fact wait">${IC.wake}<span>Odotan</span><span class="${kind === 'proc' ? 'mono' : ''} bg-fact-n">${esc(f.w.map(nameOf).join(', '))}</span></span>`, used: 'wait' };
  if (f.attn.length) return { html: `<span class="bg-fact attn">${count(f.attn.length, 'ei mergetty', 'ei mergetty')} · työ tallessa</span>`, used: 'attn' };
  if (f.live.length) return { html: `<span class="bg-fact">${f.live.length} ${k.liveWord}</span>`, used: '' };
  return { html: '<span class="bg-fact muted">ei käynnissä</span>', used: '' };
}
function line(kind) {
  const f = facts(kind); if (!f.present) return '';
  const k = KIND[kind]; const open = B.open === kind; const fact = lineFact(kind, f);
  const extra = `${fact.used !== 'attn' ? attnDot(f) : ''}${fact.used !== 'wait' && fact.used !== 'attn' ? '' : (f.live.length ? `<span class="bg-more">${f.live.length} ${k.liveWord}</span>` : '')}`;
  const btn = `<button type="button" class="bg-line ${kind}" data-bg="kind" data-key="${kind}" aria-expanded="${open}" aria-label="${esc(sentence(kind, f))}"><span class="bg-kind-ic">${k.icon}</span><span class="bg-kind-l">${k.label}</span>${fact.html}<span class="bg-line-end">${extra}${CHEV}</span></button>`;
  return `<div class="bg-lineblock${open ? ' open' : ''}">${open ? `<div class="bg-list" role="region" aria-label="${k.label}">${kindList(kind)}</div>` : ''}${btn}</div>`;
}
function v2Html() {
  const ls = ['spin', 'proc'].map(line).filter(Boolean);
  return ls.length ? `<div class="bg-lines">${ls.join('')}</div>` : '';
}

// ---------- 3 · Merkit ----------
function badge(kind) {
  const f = facts(kind); if (!f.present) return '';
  const k = KIND[kind]; const open = B.open === kind;
  const n = !f.ok && !f.all.length ? '?' : String(f.live.length);
  return `<button type="button" class="bg-badge ${kind}${!f.live.length ? ' idle' : ''}" data-bg="kind" data-key="${kind}" aria-expanded="${open}" aria-label="${esc(sentence(kind, f))}" title="${esc(sentence(kind, f))}"><span class="bg-kind-ic">${k.icon}</span><span class="bg-n">${n}</span>${f.idleWait ? `<span class="bg-corner wait" aria-hidden="true">${IC.wake}</span>` : ''}${f.attn.length ? '<span class="bg-corner attn" aria-hidden="true"></span>' : ''}</button>`;
}
function v3Html() {
  const kinds = ['spin', 'proc'].filter(k => facts(k).present);
  if (!kinds.length) return '';
  const tabs = kinds.map(kind => { const f = facts(kind); return `<button type="button" role="tab" class="bg-tab" data-bg="tab" data-key="${kind}" aria-selected="${B.open === kind}"><span class="bg-kind-ic">${KIND[kind].icon}</span>${KIND[kind].label}<span class="bg-tab-n">${f.ok || f.all.length ? f.live.length : '?'}</span></button>`; }).join('');
  const pop = B.open ? `<div class="bg-pop" role="dialog" aria-label="Taustatyö"><div class="bg-tabs" role="tablist">${tabs}<button type="button" class="icon-btn bg-x" data-bg="close" aria-label="Sulje">${IC.x}</button></div><div class="bg-pop-body" role="tabpanel">${kindList(B.open)}</div></div>` : '';
  return `<div class="bg-badges-wrap">${pop}<div class="bg-badges" role="group" aria-label="Taustatyö">${kinds.map(badge).join('')}</div></div>`;
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
setInterval(() => { for (const el of strip.querySelectorAll('[data-since]')) el.textContent = dur(Math.max(0, nowS() - +el.dataset.since)); }, 1000);

// ---------- Actions ----------
const proc = (id) => B.procs.find(p => p.id === id);
const spin = (id) => B.spins.find(s => s.id === id);
function act(t) {
  const a = t.dataset.bg; const id = t.dataset.id;
  if (a === 'kind') { openKind(t.dataset.key); return paint(); }
  if (a === 'tab') { if (B.open !== t.dataset.key) openKind(t.dataset.key); return paint(); }
  if (a === 'close') { B.open = null; B.sel = null; return paint(); }
  if (a === 'sel') { B.sel = B.sel === id ? null : id; return paint(); }
  if (a === 'endfold') { const k = t.dataset.key; B.ended[k] = !B.ended[k]; return paint(); }
  if (a === 'stop') { const p = proc(id); p.status = 'killed'; p.end = nowS(); toast(`Prosessi ${p.name} pysäytettiin.`); return paint(); }
  if (a === 'unwait') { const w = B.procs.find(p => p.waits === id && LIVE_ST.has(p.status)); if (w) { w.status = 'killed'; w.end = nowS(); } toast('Odotus lopetettiin. Spinoff jatkaa työtään.'); return paint(); }
  if (a === 'clear') { const n = B.procs.filter(p => !p.waits && !LIVE_ST.has(p.status)).length; B.procs = B.procs.filter(p => p.waits || LIVE_ST.has(p.status)); if (items().every(i => i.id !== B.sel)) B.sel = null; toast(`${count(n, 'päättynyt prosessi', 'päättynyttä prosessia')} ja ${n === 1 ? 'sen loki' : 'niiden lokit'} poistettiin. Spinoffit jäävät.`); return paint(); }
  if (a === 'openspin') return toast(`Avaa spinoffin ${spin(id).title} vain luku -näkymän (kierros 2026-10-16-spinoffit).`);
  if (a === 'chip') {
    // The top-bar chip opens what the agent waits for.
    const w = waited().find(i => i.kind === 'spin') || waited()[0]; if (!w) return;
    if (B.open !== w.kind) openKind(w.kind);
    B.sel = w.id; paint(); strip.scrollIntoView({ block: 'nearest' }); return;
  }
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-bg]'); if (!t || t.closest('.proto-picker')) return;
  e.preventDefault(); e.stopPropagation(); act(t);
}, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && B.open) { B.open = null; B.sel = null; paint(); } });

// ---------- Page bar: the situation, and the next event in the story ----------
const SCN = { all: 'Prosessit ja spinoffit', proconly: 'Vain prosesseja', spinonly: 'Vain spinoffeja', none: 'Ei taustatyötä', noproc: 'Prosessiyhteys puuttuu', nospin: 'Spinoffien tila ei saatavilla' };
document.querySelector('.page-bar .hint').insertAdjacentHTML('beforebegin', `<label>Tilanne <select id="bg-scn">${Object.entries(SCN).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label><button type="button" id="bg-next" class="page-btn" title="hidas-testi valmistuu, sitten README-spinoff mergetään, sitten aikavyöhyketestit epäonnistuvat">Seuraava tapahtuma</button>`);
document.getElementById('bg-scn').addEventListener('change', (e) => { B.scn = e.target.value; B.sel = null; B.open = null; paint(); });
document.getElementById('bg-next').addEventListener('click', () => {
  const t = nowS();
  if (B.step === 0) { const p = proc('proc_7d40'); if (p) { p.status = 'exited'; p.code = 0; p.end = t; p.out.push('tests/slow/test_rollup.py .........                                   [100%]', '23 passed in 118.40s'); } B.step = 1; toast(UI.working ? 'hidas-testi valmistui: ilmoitus menee agentille ohjauksena.' : 'hidas-testi valmistui: agentti odottaa vielä spinoffia.'); }
  else if (B.step === 1) { const s = spin('s1'); s.st = 'merged'; s.end = t; s.landed = '9a1c2e7 · 1 commit, +7 −0'; const w = proc('proc_c911'); w.status = 'exited'; w.code = 0; w.end = t; B.step = 2; toast(UI.working ? 'Spinoff mergettiin: tieto menee agentille ohjauksena.' : 'Spinoff mergettiin ja herätti agentin.'); }
  else if (B.step === 2) { const s = spin('s4'); s.st = 'failed'; s.end = t; s.why = 'Testit eivät menneet läpi main-haaran päällä.'; B.step = 3; toast('Spinoff Testit aikavyöhykkeille päättyi mergeämättä: työ on tallessa.'); }
  else { B.procs = PROCS0(); B.spins = SPIN0(); B.seen = new Set(); B.ended = {}; B.step = 0; toast('Tarina alkaa alusta.'); }
  paint();
});

// ---------- Directions ----------
function view(v) {
  // Every direction starts from the same facts, so the three can be compared.
  Object.assign(B, { v, sel: null, open: null, ended: {}, seen: new Set(), procs: PROCS0(), spins: SPIN0(), step: 0 });
  UI.sel = 'c1';
  return appView();
}
window.v1 = () => view('v1');
window.v2 = () => view('v2');
window.v3 = () => view('v3');
})();
