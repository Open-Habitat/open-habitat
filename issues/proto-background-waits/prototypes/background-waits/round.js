// Taustaodotukset, kierros 1 (proto-background-waits). Synthetic names and data only.
// One conversation: a conductor that started two workers, waits on one of them, waits on an
// external release watcher and keeps a dev server running. The variants differ in where a
// wait is shown (on its process or on the run it waits for) and how a process's exit reads.
(() => {
const SVG = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IC = {
  branch: SVG('<circle cx="7" cy="6" r="2"/><path d="M7 8v10"/><path d="M7 12c0 3 3 4 7 4"/><circle cx="17" cy="16" r="2"/>'),
  term: SVG('<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="m7.5 9.5 3 2.5-3 2.5M13 15h3.5"/>'),
  bell: SVG('<path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6z"/><path d="M10 19.5a2 2 0 0 0 4 0"/>'),
  stop: SVG('<rect x="7" y="7" width="10" height="10" rx="1.5"/>'),
  x: SVG('<path d="M6 6l12 12M18 6 6 18"/>'),
  check: SVG('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  system: SVG('<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M7 9h10M7 13h6"/>'),
  fail: SVG('<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6M15 9l-6 6"/>'),
  neutral: SVG('<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12h7"/>'),
  skip: SVG('<circle cx="12" cy="12" r="8.5"/><path d="m10 8.5 4 3.5-4 3.5"/>'),
  merge: SVG('<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 8v8"/><path d="M6 8c0 3 4 4 10 4"/>'),
  chev: SVG('<path d="m9 6 6 6-6 6"/>'),
  menu: SVG('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  send: SVG('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  info: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5h.01"/>'),
};
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const RID1 = '01m6ka2r7w9c4tq1hd8nx5bfza', RID2 = '01m6kb5q3z8c1rv7kd2tx6hnwe';
const V = ['now', 'words', 'marks', 'nested'];
const S = { v: 0, scene: 'a', open: null, ended: { spin: false, proc: false }, expanded: {}, stopped: {}, note: '' };

// ---------- Facts: what the host knows ----------
// Taskfleet's runs of this conversation and pi-processes' inventory. `runs` is the daemon's
// join of a `taskfleet run wait` command to its run ids; in "Nyt" the conductor's real command
// shape (`cd … && … --check-in 45m`) falls outside the narrow grammar, so the join is empty.
// `declared` is what the agent said, when starting, that an exit code means (a fact that
// does not exist today).
function facts() {
  const working = S.scene === 'c';
  const runs = [
    { id: 'w1', rid: RID1, title: 'Kastelun ajastus', st: 'working', age: '18 min' },
    { id: 'w2', rid: RID2, title: 'Lomakkeen saavutettavuus', st: 'working', age: '6 min' },
    { id: 'w3', rid: '01m6k8h2d7q0x4kc8vbe9t5mwr', title: 'Kuvien pakkaus', st: 'merged', age: '13.41' },
  ];
  const wait = (run, name, start) => ({ id: 'wait-' + run.id, name, cmd: `cd ~/src/kasvimaa && taskfleet run wait ${run.rid} --check-in 45m --output json`, status: 'running', age: start, wakes: true, runs: V[S.v] === 'now' ? [] : [run.id] });
  const procs = [
    { id: 'p-dev', name: 'dev-palvelin', cmd: 'npm run dev -- --port 5173', status: 'running', age: '42 min', wakes: false, runs: [] },
    { id: 'p-rel', name: 'julkaisuvahti', cmd: 'ssh testi "release-watch wait --source 4f2c9e1 --json"', status: 'running', age: '1 min', wakes: true, runs: [], declared: { 0: 'asennettu', 3: 'ohitettu: ei tuotemuutosta' } },
  ];
  if (!S.stopped.w1) procs.push(wait(runs[0], 'odota-kastelu', '2 min'));
  if (S.scene !== 'a' && !S.stopped.w2) procs.push(wait(runs[1], 'odota-lomake', '5 min'));
  const ended = [
    { id: 'e-test', name: 'testit', cmd: 'npm test', status: 'exited', code: 1, at: '14.02', runs: [] },
    { id: 'e-check', name: 'odota-kastelu', cmd: `cd ~/src/kasvimaa && taskfleet run wait ${RID1} --check-in 45m --output json`, status: 'exited', code: 4, at: '13.58', runs: V[S.v] === 'now' ? [] : ['w1'] },
    { id: 'e-rel', name: 'julkaisuvahti', cmd: 'ssh testi "release-watch wait --source 9b13d07 --json"', status: 'exited', code: 3, at: '13.51', runs: [], declared: { 0: 'asennettu', 3: 'ohitettu: ei tuotemuutosta' } },
  ];
  for (const id of ['w1', 'w2']) if (S.stopped[id]) ended.unshift({ id: 'e-stop-' + id, name: id === 'w1' ? 'odota-kastelu' : 'odota-lomake', cmd: 'taskfleet run wait …', status: 'killed', at: '14.10', runs: V[S.v] === 'now' ? [] : [id] });
  const waits = procs.filter(p => p.runs.length);
  const spin = runs.map(r => ({ r, live: r.st === 'working', wait: waits.find(p => p.runs.includes(r.id)) }));
  return {
    working,
    spin,
    live: [...spin.filter(i => i.live && i.wait), ...spin.filter(i => i.live && !i.wait)],
    spinEnded: spin.filter(i => !i.live),
    procLive: procs.filter(p => !p.runs.length),
    procEnded: ended.filter(p => !p.runs.length || V[S.v] === 'now'),
    waitEnded: ended.filter(p => p.runs.length),
    agentWaits: !working && procs.some(p => p.wakes),
  };
}

// ---------- How an exit reads ----------
// Returns tone (ok | neutral | err), the label, an icon and an optional explanation.
function exitReading(p, v = V[S.v]) {
  if (p.status === 'killed') return { tone: 'neutral', label: 'pysäytetty', icon: IC.stop };
  if (p.code === 0) return { tone: 'ok', label: 'valmis', icon: IC.check };
  const wait = p.runs.length > 0;
  // Today the note itself is grey; only the panel's ended row turns red ("Virhe · koodi 3").
  if (v === 'now') return { tone: 'now', label: 'kaatui', code: p.code, icon: IC.system };
  if (wait && p.code === 4) return { tone: 'neutral', label: 'välitarkistus', icon: IC.neutral, why: 'Taskfleet palautti tilannekuvan sovitun ajan jälkeen (--check-in). Worker työskentelee yhä; agentti käynnistää odotuksen uudelleen.' };
  if (wait && p.code === 2) return { tone: 'neutral', label: 'odotus aikakatkaistiin', icon: IC.neutral };
  if (v === 'words' || v === 'nested') return { tone: 'neutral', label: 'päättyi', code: p.code, icon: IC.neutral, why: 'Habitat ei tiedä, mitä koodi tälle komennolle tarkoittaa. Agentti kertoo sen seuraavassa viestissään. Punainen on varattu signaalille ja käynnistysvirheelle.' };
  const said = p.declared?.[p.code];
  if (said) return { tone: 'neutral', label: said, code: p.code, icon: IC.skip, why: `Agentti kertoi käynnistäessään, että koodi ${p.code} on odotettu tulos: ”${said}”.` };
  return { tone: 'err', label: 'epäonnistui', code: p.code, icon: IC.fail, why: p.declared ? 'Koodi ei ole agentin odotetuiksi ilmoittamien joukossa.' : 'Agentti ei ilmoittanut tälle komennolle odotettuja tuloksia, joten muu kuin 0 on virhe.' };
}

// ---------- The conversation's thread ----------
const EVENTS = {
  rel: { id: 'n-rel', proc: { name: 'julkaisuvahti', code: 3, runs: [], declared: { 0: 'asennettu', 3: 'ohitettu: ei tuotemuutosta' }, cmd: 'ssh testi "release-watch wait --source 9b13d07 --json"' }, delivery: 'wake' },
  check: { id: 'n-check', proc: { name: 'odota-kastelu', code: 4, runs: ['w1'], cmd: `cd ~/src/kasvimaa && taskfleet run wait ${RID1} --check-in 45m --output json` }, delivery: 'wake' },
  test: { id: 'n-test', proc: { name: 'testit', code: 1, runs: [], cmd: 'npm test' }, delivery: 'context' },
};
const DELIVERY = { wake: 'herätti agentin', context: 'agentin kontekstiin' };
function note(e) {
  const v = V[S.v];
  const p = { ...e.proc, status: 'exited', runs: v === 'now' ? [] : e.proc.runs };
  const r = exitReading(p);
  const open = !!S.expanded[e.id];
  // "Sisäkkäin": a wait's end is told in the run's terms, not as a process.
  const asRun = v === 'nested' && p.runs.length;
  const name = asRun ? 'Kastelun ajastus' : p.name;
  const label = asRun ? `${r.label} · työskentelee yhä` : r.label;
  const code = r.code !== undefined && !asRun ? ` · koodi ${r.code}` : '';
  const details = open ? `<div class="pc-details">${r.why ? `<p>${esc(r.why)}</p>` : ''}<p class="mono">$ ${esc(p.cmd)}</p>${r.code !== undefined && (asRun || v === 'marks') ? `<p>Koodi ${r.code}.</p>` : ''}${asRun ? '<p>Odotusprosessi: <span class="mono">odota-kastelu</span>.</p>' : ''}<p>Merkintä säilyy historiassa.</p></div>` : '';
  return `<div class="pc" data-tone="${r.tone}" data-testid="completion" role="note"><span class="pc-ic">${asRun ? IC.branch : r.icon}</span><button type="button" class="pc-toggle" data-act="note" data-id="${e.id}" aria-expanded="${open}"><span class="pc-name${asRun ? '' : ' mono'}">${esc(name)}</span> · <span class="pc-label">${esc(label)}</span>${code} · ${DELIVERY[e.delivery]}</button>${details}</div>`;
}
const user = (t) => `<div class="msg user"><div class="bubble">${t}</div></div>`;
const agent = (t) => `<div class="msg agent"><p>${t}</p></div>`;
function thread() {
  return `<div class="thread">
${user('Aja kierros: kastelun ajastus ja lomakkeen saavutettavuus workereille. Vie testikoneelle, kun ne ovat valmiita.')}
${agent('Käynnistin kaksi workeria ja jäin odottamaan Kastelun ajastusta taustalle. Puskin edellisen muutoksen; julkaisuvahti kertoo, asentuiko se.')}
${note(EVENTS.rel)}
${agent('Vahti ohitti julkaisun, koska muutos koski vain dokumentaatiota. Mitään ei kaatunut.')}
${note(EVENTS.check)}
${agent('Välitarkistus: Kastelun ajastus ajaa yhä testejään. Jatkan odotusta.')}
${note(EVENTS.test)}
${agent('Paikallinen testiajo epäonnistui oikeasti: kaksi testiä odottaa uutta skeemaa. Korjaan sen, kun workerit ovat valmiita.')}
</div>`;
}

// ---------- The worker chip and panel ----------
const dotFor = (i) => i.wait ? '<span class="bgw-dot" aria-hidden="true"></span>' : '<span class="nowait-dot" aria-hidden="true"></span>';
function spinSentence(f) {
  const waited = f.live.filter(i => i.wait).length, not = f.live.length - waited;
  if (V[S.v] === 'now') return `Workerit: ${f.live.length} työskentelee, ${count(f.spinEnded.length, 'päättynyt', 'päättynyttä')}`;
  return `Workerit: ${f.live.length} työskentelee, ${waited} odotetaan, ${not} ilman odotusta, ${count(f.spinEnded.length, 'päättynyt', 'päättynyttä')}`;
}
function spinChip(f) {
  const v = V[S.v];
  const waited = f.live.filter(i => i.wait).length, not = f.live.length - waited;
  let inner = `<span class="ic">${IC.branch}</span>`;
  let corner = '';
  if (v === 'marks') inner += `<span class="marks">${f.live.map(dotFor).join('')}</span>`;
  else inner += `<span class="n">${f.live.length}</span>`;
  if (v === 'words') inner += not ? `<span class="chip-word nowait">${not === f.live.length ? 'ei odotusta' : `${not} ei odotusta`}</span>` : waited ? '<span class="chip-word">odotetaan</span>' : '';
  if ((v === 'words' || v === 'now') && waited && !f.working) corner = `<span class="corner wait" aria-hidden="true">${IC.bell}</span>`;
  if (v === 'nested' && f.live.length) corner = not ? '<span class="corner nowait" aria-hidden="true"></span>' : !f.working ? `<span class="corner wait" aria-hidden="true">${IC.bell}</span>` : '';
  const s = spinSentence(f);
  return `<button type="button" class="pill" data-act="kind" data-kind="spin" data-testid="chip-spin" aria-expanded="${S.open === 'spin'}" aria-label="${esc(s)}" title="${esc(s)}">${inner}${corner}</button>`;
}
function spinRow(i) {
  const v = V[S.v], r = i.r;
  const stop = i.wait ? `<button type="button" class="icon-btn stop" data-act="unwait" data-id="${r.id}" aria-label="Lopeta odotus: ${esc(r.title)}" title="Lopettaa agentin odotuksen. Worker jatkaa työtään, eikä agentti saa ilmoitusta.">${IC.stop}</button>` : '<span class="gap" aria-hidden="true"></span>';
  if (!i.live) return `<div class="row" data-state="${r.st}"><button type="button" class="row-main" data-act="toast" data-msg="Avaa workerin ${esc(r.title)} vain luku -näkymän."><span class="mark ok">${IC.merge}</span><span class="name">${esc(r.title)}</span><span class="meta"><span class="ok-label">Mergetty</span> ${r.age}</span></button><span class="gap" aria-hidden="true"></span></div>`;
  const runDot = '<span class="run-dot"></span>';
  if (v === 'now') return `<div class="row" data-state="working"><button type="button" class="row-main" data-act="toast" data-msg="Avaa workerin ${esc(r.title)} vain luku -näkymän."><span class="mark">${runDot}</span><span class="name">${esc(r.title)}</span><span class="meta">${r.age}</span></button>${stop}</div>`;
  const word = i.wait ? `<span class="wait-word">odotetaan</span>` : `<span class="wait-word nowait">ei odotusta</span>`;
  if (v === 'nested') {
    const sub = i.wait
      ? `<div class="sub" data-testid="wait-sub"><span class="sub-mark">${IC.bell}</span><span>Odotus käynnissä ${i.wait.age} · agentti jatkaa, kun tämä valmistuu</span>${stop}</div>`
      : `<div class="sub nowait" data-testid="wait-sub"><span class="sub-mark"><span class="nowait-dot"></span></span><span>Ei odotusta · agentti ei herää, kun tämä valmistuu</span><span class="gap" aria-hidden="true"></span></div>`;
    return `<div class="row nest" data-state="working"><div class="row-line"><button type="button" class="row-main" data-act="toast" data-msg="Avaa workerin ${esc(r.title)} vain luku -näkymän."><span class="mark">${runDot}</span><span class="name">${esc(r.title)}</span><span class="meta">${r.age}</span></button></div>${sub}</div>`;
  }
  const mark = v === 'marks' ? dotFor(i) : runDot;
  const bell = v === 'words' && i.wait ? `<span class="wake" role="img" aria-label="Agentti odottaa tätä">${IC.bell}</span>` : '';
  return `<div class="row" data-state="working" data-waited="${!!i.wait}"><button type="button" class="row-main" data-act="toast" data-msg="Avaa workerin ${esc(r.title)} vain luku -näkymän."><span class="mark">${mark}</span><span class="name">${esc(r.title)}</span><span class="meta">${word} · ${r.age}</span></button>${bell}${stop}</div>`;
}
function spinPanel(f) {
  const live = f.live.length ? `<div class="group" role="group" aria-label="Workerit: käynnissä">${f.live.map(spinRow).join('')}</div>` : '<p class="empty">Ei työskenteleviä workereita.</p>';
  const v = V[S.v];
  let waitEnded = '';
  if (v === 'nested' && f.waitEnded.length) waitEnded = `<p class="life">Päättyneet odotukset näkyvät keskustelussa workerin nimellä.</p>`;
  const legend = v === 'marks' ? '<p class="legend"><span class="bgw-dot"></span> odotetaan <span class="nowait-dot"></span> ei odotusta: agentti ei herää, kun worker valmistuu</p>' : '';
  return `${legend}${live}${ended('spin', f.spinEnded, f.spinEnded.map(spinRow).join(''))}${waitEnded}<p class="life">Workerit ovat Taskfleetin ajoja; selain vain näyttää ne.</p>`;
}

// ---------- The terminal chip and panel ----------
function procSentence(f) {
  const waking = f.procLive.filter(p => p.wakes);
  return [`Prosessit: ${f.procLive.length} käynnissä`, waking.length && !f.working ? `agentti odottaa: ${waking.map(p => p.name).join(', ')}` : '', f.procEnded.length ? count(f.procEnded.length, 'päättynyt', 'päättynyttä') : ''].filter(Boolean).join(', ');
}
function procChip(f) {
  const bell = f.procLive.some(p => p.wakes) && !f.working ? `<span class="corner wait" aria-hidden="true">${IC.bell}</span>` : '';
  const s = procSentence(f);
  return `<button type="button" class="pill" data-act="kind" data-kind="proc" data-testid="chip-proc" aria-expanded="${S.open === 'proc'}" aria-label="${esc(s)}" title="${esc(s)}"><span class="ic">${IC.term}</span><span class="n">${f.procLive.length}</span>${bell}</button>`;
}
function procRow(p) {
  const live = p.status === 'running';
  let mark, meta, tone = '';
  if (live) { mark = '<span class="run-dot"></span>'; meta = p.age; }
  else {
    const r = exitReading(p);
    tone = V[S.v] === 'now' && p.code ? 'err' : r.tone;
    const label = V[S.v] === 'now' && p.code ? `Virhe · koodi ${p.code}` : r.code !== undefined ? `${r.label[0].toUpperCase()}${r.label.slice(1)} · koodi ${r.code}` : `${r.label[0].toUpperCase()}${r.label.slice(1)}`;
    mark = `<span class="mark-ic">${V[S.v] === 'now' && p.code ? IC.fail : r.icon}</span>`; meta = `<span class="end-label">${esc(label)}</span> ${p.at}`;
  }
  const wake = live && p.wakes ? `<span class="wake" role="img" aria-label="Agentti odottaa tätä" title="Agentti jatkaa, kun tämä päättyy">${IC.bell}</span>` : '';
  const stop = live ? `<button type="button" class="icon-btn stop" data-act="toast" data-msg="Pysäyttää prosessin ${esc(p.name)}. (Ei toteutettu kokeessa.)" aria-label="Pysäytä ${esc(p.name)}">${IC.stop}</button>` : '<span class="gap" aria-hidden="true"></span>';
  return `<div class="row" data-kind="proc" data-tone="${tone}"><button type="button" class="row-main" data-act="toast" data-msg="Avaa prosessin ${esc(p.name)} ikkunan."><span class="mark">${mark}</span><span class="name mono">${esc(p.name)}</span><code class="cmd">${esc(p.cmd)}</code><span class="meta">${meta}</span></button>${wake}${stop}</div>`;
}
function procPanel(f) {
  const live = f.procLive.length ? `<div class="group" role="group" aria-label="Prosessit: käynnissä">${f.procLive.map(procRow).join('')}</div>` : '<p class="empty">Ei käynnissä olevia prosesseja.</p>';
  const hint = V[S.v] === 'now' ? '' : '<p class="life">Workerien odotukset näkyvät Workerit-välilehdellä.</p>';
  return `${live}${ended('proc', f.procEnded, f.procEnded.map(procRow).join(''))}${hint}`;
}
function ended(kind, list, rows) {
  if (!list.length) return '';
  const open = S.ended[kind];
  return `<div class="endhead"><button type="button" class="endfold" data-act="endfold" data-kind="${kind}" aria-expanded="${open}">${IC.chev}<span>${count(list.length, 'päättynyt', 'päättynyttä')}</span></button></div>${open ? `<div class="group" role="group" aria-label="${kind === 'spin' ? 'Workerit' : 'Prosessit'}: päättyneet">${rows}</div>` : ''}`;
}
function strip(f) {
  const tab = (k, label, ic, n) => `<button type="button" role="tab" class="tab" data-act="kind" data-kind="${k}" aria-selected="${S.open === k}">${ic}${label}<span class="tab-n">${n}</span></button>`;
  const pop = S.open ? `<div class="pop" data-testid="panel"><div class="tabs" role="tablist" aria-label="Taustatyö">${tab('spin', 'Workerit', IC.branch, f.live.length)}${tab('proc', 'Prosessit', IC.term, f.procLive.length)}<button type="button" class="icon-btn x" data-act="close" aria-label="Sulje">${IC.x}</button></div><div class="pop-body" role="tabpanel">${S.open === 'spin' ? spinPanel(f) : procPanel(f)}</div></div>` : '';
  return `<section class="strip" aria-label="Taustatyö"><div class="strip-wrap">${pop}<div class="badges" role="group" aria-label="Taustatyö">${spinChip(f)}${procChip(f)}</div></div></section>`;
}

// ---------- Frame ----------
function rail() {
  const row = (t, mark, cur) => `<a href="#" class="conv${cur ? ' cur' : ''}" data-act="toast" data-msg="Vain Iltakierros on auki tässä kokeessa."${cur ? ' aria-current="page"' : ''}><span>${t}</span>${mark}</a>`;
  return `<aside class="rail" aria-label="Työtilat"><div class="brand">Habitat</div><div class="ws">kasvimaa</div>
${row('Iltakierros', facts().agentWaits ? '<span class="bgw-dot" role="img" aria-label="Odottaa taustatyötä"></span>' : '<span class="run-dot" role="img" aria-label="Työskentelee"></span>', true)}
${row('Sääaseman CSV', `<span class="done">${IC.check}</span>`)}
${row('Kuvien pakkaus', `<span class="done">${IC.check}</span>`)}
<div class="ws">kirjasto</div>${row('Hakusanojen negaatiot', '<span class="wait-ring" role="img" aria-label="Odottaa sinua"></span>')}</aside>`;
}
function view() {
  const f = facts();
  const state = f.working ? '<span class="state"><span class="run-dot"></span>Työskentelee</span>' : f.agentWaits ? '<span class="state" title="Odotetaan: julkaisuvahti, Kastelun ajastus"><span class="bgw-dot"></span>Odottaa taustatyötä</span>' : '<span class="state"><span class="wait-ring"></span>Odottaa sinua</span>';
  return `<div class="app v-${V[S.v]}" data-variant="${V[S.v]}">${rail()}<div class="main">
<div class="topbar"><button type="button" class="icon-btn menu" aria-label="Avaa valikko">${IC.menu}</button><div class="title"><strong>Iltakierros</strong><span class="mono">kasvimaa</span></div>${state}<button type="button" class="icon-btn" aria-label="Tiedot">${IC.info}</button></div>
<div class="scroll">${thread()}</div>
${strip(f)}
<div class="composer"><div class="cbox"><textarea aria-label="Viesti" placeholder="Kirjoita agentille…" rows="1"></textarea><button type="button" class="icon-btn send" data-act="toast" data-msg="Kokeessa viestiä ei lähetetä." aria-label="Lähetä">${IC.send}</button></div></div>
<p class="toast" role="status">${esc(S.note)}</p>
</div></div>`;
}
function repaint(focusSel) {
  const stageEl = document.getElementById('stage');
  stageEl.innerHTML = view();
  if (focusSel) stageEl.querySelector(focusSel)?.focus();
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('#stage [data-act]'); if (!t) return;
  e.preventDefault();
  const a = t.dataset.act; let focus = null;
  if (a === 'kind') { S.open = S.open === t.dataset.kind && t.classList.contains('pill') ? null : t.dataset.kind; focus = t.classList.contains('pill') ? `.pill[data-kind="${t.dataset.kind}"]` : `.tab[data-kind="${t.dataset.kind}"]`; }
  else if (a === 'close') { const k = S.open; S.open = null; focus = `.pill[data-kind="${k}"]`; }
  else if (a === 'endfold') { S.ended[t.dataset.kind] = !S.ended[t.dataset.kind]; focus = `.endfold[data-kind="${t.dataset.kind}"]`; }
  else if (a === 'note') { S.expanded[t.dataset.id] = !S.expanded[t.dataset.id]; focus = `[data-act="note"][data-id="${t.dataset.id}"]`; }
  else if (a === 'unwait') { S.stopped[t.dataset.id] = true; S.note = 'Odotus lopetettiin. Worker jatkaa työtään, eikä agentti saa ilmoitusta.'; focus = '.pop .x'; }
  else if (a === 'toast') { S.note = t.dataset.msg; }
  repaint(focus);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.open) { const k = S.open; S.open = null; repaint(`.pill[data-kind="${k}"]`); }
});
const theme = document.getElementById('theme');
const setTheme = (t) => { document.documentElement.dataset.theme = t; theme.textContent = t === 'dark' ? 'Vaalea' : 'Tumma'; };
setTheme(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
theme.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
document.getElementById('scene').addEventListener('change', (e) => { S.scene = e.target.value; S.stopped = {}; S.note = ''; repaint(); });
const start = (i) => () => { S.v = i; S.open = null; S.ended = { spin: false, proc: false }; S.expanded = {}; S.stopped = {}; S.note = ''; return view(); };
window.PROTO = { S, repaint };
window.variants = V.map((_, i) => start(i));
})();
const variants = window.variants;
