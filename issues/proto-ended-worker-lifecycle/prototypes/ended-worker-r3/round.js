// Päättyneet workerit, kierros 3 (proto-ended-worker-lifecycle). Synthetic names and data only.
// Jari 28.10.2026 after round 2: "Kerro agentille" is the function itself, not a draft. Pressing
// it sends an agent a request to handle exactly that worktree; the agent inspects it and
// recommends what to do (merge, continue, discard), and the person answers in the conversation.
// "Käsittele kaikki" sends one request covering every unfinished row. Unchanged from round 2:
// a row is listed while its branch or worktree exists, an unfinished row carries a red ball,
// and the row disappears when the agent has removed the branch and the worktree.
//
// The variants differ on one axis: which conversation receives the request.
//   1 Vanhempi        — always the conversation that started the worker (the Workers panel
//                       lives there, so it is also the current one). Busy: the request waits
//                       in its follow-up queue. Closed: sending continues it.
//   2 Valittava       — the same by default; a caret beside every button chooses another
//                       conversation in the worker's workspace or a new one.
//   3 Uusi keskustelu — every press starts a new conversation in the worker's workspace;
//                       the parent conversation is never interrupted.
// The request text is the same in all three: it is the person's own message, sent through the
// composer's route, and names the run, branch and worktree so any agent can find them.
(() => {
const SVG = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IC = {
  branch: SVG('<circle cx="7" cy="6" r="2"/><path d="M7 8v10"/><path d="M7 12c0 3 3 4 7 4"/><circle cx="17" cy="16" r="2"/>'),
  stop: SVG('<rect x="7" y="7" width="10" height="10" rx="1.5"/>'),
  x: SVG('<path d="M6 6l12 12M18 6 6 18"/>'),
  check: SVG('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  merge: SVG('<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 8v8"/><path d="M6 8c0 3 4 4 10 4"/>'),
  chev: SVG('<path d="m9 6 6 6-6 6"/>'),
  down: SVG('<path d="m6 9 6 6 6-6"/>'),
  back: SVG('<path d="m15 6-6 6 6 6"/>'),
  menu: SVG('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  send: SVG('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  info: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5h.01"/>'),
  msg: SVG('<path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 17H10l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 5z"/>'),
  all: SVG('<path d="M4 6h10M4 12h10M4 18h7"/><path d="m15 16 2.5 2.5L22 14"/>'),
  plus: SVG('<path d="M12 5v14M5 12h14"/>'),
  out: SVG('<path d="M14 5h5v5"/><path d="m19 5-8 8"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>'),
  clock: SVG('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
};
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const V = ['vanhempi', 'valittava', 'uusi'];
const HOME = 'kasvimaa';
// Timings of the synthetic agent. Short, so the steps are visible without waiting long.
const T = { start: 700, check: 1200, act: 1000, leave: 1500, turn: 2600 };

// ---------- Facts: what the host would know ----------
// tf: Taskfleet's word for the run (run show: status, landed, preserved_work).
const ALL = [
  { id: 'w2', title: 'Vanhan rajapinnan poisto', st: 'working', age: '31 min', h: 'Claude', prof: 'tarkka', repo: 'kirjasto', branch: 'wt/t2v9-vanha-rajapinta' },
  { id: 'e2', rid: '01m5yq1t6wkd3r8n2c4h7pqa0e', title: 'test-guide: worker-näkymän koe', st: 'unmerged', end: '07.36', h: 'Pi', prof: 'builtin', repo: HOME, branch: 'wt/5yq1-test-guide-worker-nakyma',
    tf: 'done · landed: false', rec: 'merge',
    summary: 'Worker-näkymän koe on tehty ja havainnot kirjattu KOKEILTAVAA.md:hen. En mergennyt: main oli edennyt, ja KOKEILTAVAA.md törmäsi toisen workerin muutokseen.',
    look: ['Haarassa on 3 committia; main on edennyt sen jälkeen 5 commitilla.', 'KOKEILTAVAA.md törmää yhdessä kohdassa: molemmat lisäsivät kokeen samaan listaan.', 'Testit menevät läpi haarassa.'],
    why: '**Suosittelen mergeämistä**: rebase mainin päälle, törmäykseen molemmat kokeet, ja sitten haaran ja worktreen poisto. Taskfleet ei mergeä päättynyttä ajoa, joten teen sen Gitillä.',
    alt: 'Muut vaihtoehdot: jatka uudella workerilla samasta haarasta, tai hylkää (haara poistuu pysyvästi).', ask: 'Mergeänkö?' },
  { id: 'e4', rid: '01m5b5q3ndz4k7c1p8v6h2tm9r', title: 'Lomakkeen saavutettavuus', st: 'cancelled', end: '13.12', h: 'Claude', prof: 'tarkka', repo: HOME, branch: 'wt/b5q3-lomakkeen-saavutettavuus',
    tf: 'cancelled', rec: 'discard',
    summary: 'Pääagentti perui ajon, kun lomakkeen rakenne päätettiin tehdä toisin.',
    look: ['Haarassa on 1 commit ja 2 commitoimatonta muutosta Lomake.tsx:ssä.', 'Uusi lomakerakenne on jo mainissa (commit 8e1d0c4), eikä kenttäotsikoiden korjaus enää osu siihen.'],
    why: '**Suosittelen hylkäämistä**: taskfleet run discard poistaa haaran ja worktreen.',
    alt: 'Vaihtoehto: otan kaksi otsikkokorjausta käsin talteen uuteen rakenteeseen ennen hylkäystä.', ask: 'Hylkäänkö?' },
  { id: 'e5', rid: '01m5r7c1xa2f9w6n3q8k5d1tb7', title: 'Sääaseman CSV-vienti', st: 'interrupted', end: '11.05', h: 'Pi', prof: 'oletus', repo: HOME, branch: 'wt/r7c1-saaasema-csv',
    tf: 'running · valvoja ei käynnissä', rec: 'resume',
    summary: 'Ajo keskeytyi, kun palvelin käynnistettiin uudelleen.',
    look: ['Taskfleetin mukaan ajo on käynnissä, mutta sen valvoja ei ole.', 'Worker oli kirjoittanut testit ja puolet toteutuksesta; testit eivät vielä mene läpi.'],
    why: '**Suosittelen jatkamista**: taskfleet run reattach käynnistää valvojan, ja worker jatkaa samasta kohdasta.',
    alt: 'Vaihtoehto: taskfleet run salvage veisi nykyisen tilan perille, mutta testit eivät mene läpi.', ask: 'Jatkanko?' },
  { id: 'e1', rid: '01m5k8h2pcv6t1m9x3d5r2wq8b', title: 'Kuvien pakkaus', st: 'merged', end: '13.41', h: 'Pi', prof: 'oletus', repo: HOME, branch: 'wt/k8h2-kuvien-pakkaus',
    tf: 'done · landed: false', rec: 'cleanup',
    summary: 'Agentti mergesi haaran Gitillä mainiin, kun Taskfleet ei voinut. Haara ja worktree jäivät levylle.',
    look: ['Haara on jo mainissa; worktreessä ei ole muutoksia.'],
    why: '**Suosittelen siivousta**: poistan worktreen ja haaran.', alt: '', ask: 'Siivoanko?' },
];
const LIVE = ['working'];
const fresh = () => ({ open: false, ended: true, at: 'ilta', worker: null, note: '', drawer: false,
  convs: convsFor(S.scene, S.parent), over: {}, leaving: {}, extra: [], handling: {}, reqs: {}, choose: null, typed: {}, gen: (S.gen ?? 0) + 1 });
const S = { v: 0, scene: 'a', parent: 'idle' };

// ---------- Conversations in the workspace ----------
function convsFor(scene, parent) {
  const ilta = scene === 'b'
    ? [u('Aja test-guide: worker-näkymän koe workerille.'), a('Worker päättyi klo 07.36 mergeämättä: main oli edennyt, ja KOKEILTAVAA.md törmäsi. Työ on tallessa haarassa.')]
    : [u('Aja iltakierros workereille ja kerro, mitä jäi auki.'),
      a('Worker-näkymän koe päättyi mergeämättä, ja Lomakkeen saavutettavuuden perin, kun suunta muuttui; kummankin työ on tallessa haarassa. Sääaseman CSV-vienti keskeytyi palvelimen uudelleenkäynnistykseen. Kuvien pakkauksen mergesin Gitillä, mutta en vielä siivonnut sen worktreetä.'),
      a('Vanhan rajapinnan poisto on käynnissä kirjastossa; en odota sitä.')];
  if (parent === 'working') ilta.push(u('Päivitä vielä kastelun README vastaamaan uutta ajastusta.'));
  return {
    ilta: { id: 'ilta', title: 'Iltakierros', parent: true, state: parent === 'terminal' ? 'readonly' : parent, msgs: ilta, queue: [] },
    kalib: { id: 'kalib', title: 'Sääaseman kalibrointi', state: 'idle', msgs: [u('Kalibroi lämpötila-anturin poikkeama asemalla 2.'), a('Kalibrointi on tehty: poikkeama oli +0,8 °C, ja korjaus on asetuksissa. Testit menevät läpi.')], queue: [] },
  };
}
function u(text, req) { return { who: 'u', text, req }; }
function a(text) { return { who: 'a', text }; }

// ---------- Runs and rows ----------
function runs() {
  const base = S.scene === 'b' ? ALL.filter(r => r.id === 'e2') : ALL;
  return [...base, ...S.extra].map(r => ({ ...r, ...(S.over[r.id] ?? {}) }));
}
const byId = (id) => runs().find(r => r.id === id);
const ended = (r) => !LIVE.includes(r.st);
// Keskeneräinen: work on disk that has not reached the source branch.
const unfinished = (r) => ended(r) && !r.gone && r.st !== 'merged';
function facts() {
  const all = runs();
  const live = all.filter(r => !ended(r));
  // Real state: an ended row is listed only while its branch or worktree exists. A row whose
  // branch and worktree the agent just removed stays a moment to show why it leaves.
  const end = all.filter(r => ended(r) && (!r.gone || S.leaving[r.id]));
  const open = end.filter(unfinished);
  return { all, live, ended: end, open, free: open.filter(r => !S.handling[r.id]) };
}

// ---------- Words ----------
function stateWord(r) {
  if (r.st === 'working') return r.resumed ? 'jatkuu · agentti ei odota' : 'agentti ei odota';
  if (r.gone) return r.goneWord;
  if (r.st === 'merged') return 'mergetty · worktree jäljellä';
  if (r.st === 'unmerged') return 'ei mergetty · työ tallessa';
  if (r.st === 'cancelled') return 'peruttu · työ tallessa';
  if (r.st === 'interrupted') return 'keskeytyi · jatkettavissa';
  return 'epäonnistui';
}
const convName = (id) => S.convs[id]?.title ?? '';
const where = (id) => id === S.at && !S.worker ? 'tässä keskustelussa' : `keskustelussa ${convName(id)}`;
const PHASE = {
  queued: (c) => ['pyyntö jonossa', `lähtee, kun ${convName(c)} vapautuu`],
  starting: (c) => ['pyyntö lähetetty', S.convs[c]?.fresh ? 'uusi keskustelu käynnistyy' : `${convName(c)} jatkuu`],
  checking: (c) => ['agentti tarkistaa', where(c)],
  answer: (c) => ['odottaa vastaustasi', where(c)],
  acting: (c, r) => [ACT_WORD[S.handling[r.id]?.doing] ?? 'agentti työskentelee', where(c)],
};
const ACT_WORD = { merge: 'agentti mergeää', discard: 'agentti hylkää', resume: 'agentti jatkaa ajoa', cleanup: 'agentti siivoaa', continue: 'agentti käynnistää uuden workerin' };
const tone = (r) => r.st === 'working' ? 'muted' : r.gone ? 'ok' : S.handling[r.id] ? (S.handling[r.id].phase === 'answer' ? 'wait' : 'busy') : r.st === 'merged' ? 'ok' : unfinished(r) ? 'err' : 'muted';
const ball = '<span class="ball" role="img" aria-label="Keskeneräinen"></span>';
function mark(r) {
  if (r.st === 'working') return '<span class="nowait-dot"></span>';
  if (r.gone) return `<span class="mark-ic ok">${IC.check}</span>`;
  const h = S.handling[r.id];
  if (h) return h.phase === 'answer' ? '<span class="you-ring" role="img" aria-label="Odottaa vastaustasi"></span>' : '<span class="busy-ring" role="img" aria-label="Agentti käsittelee"></span>';
  if (r.st === 'merged') return `<span class="mark-ic ok">${IC.merge}</span>`;
  return unfinished(r) ? ball : `<span class="mark-ic">${IC.check}</span>`;
}
const repoTag = (r) => r.repo !== HOME ? `<span class="sep">·</span><span class="tag repo" title="Toinen repositorio kuin tämä keskustelu">${esc(r.repo)}</span>` : '';
const wtPath = (r) => `~/src/${r.repo}__worktrees/wt-${r.branch.slice(3)}`;

// ---------- The request: the person's own message ----------
function oneLine(r) {
  const what = { unmerged: 'päättyi klo ' + r.end + ', ei mergetty, työ tallessa', cancelled: 'peruttiin klo ' + r.end + ', työ tallessa', interrupted: 'keskeytyi klo ' + r.end + ', jatkettavissa', merged: 'mergetty, worktree jäljellä' }[r.st];
  return `”${r.title}” (Taskfleet-ajo ${r.rid}, haara ${r.branch}, worktree ${wtPath(r)}): ${what}`;
}
function requestText(list, conv) {
  const from = S.convs[conv]?.parent ? '' : ' Workerit käynnisti keskustelu ”Iltakierros”.';
  const tail = 'Älä muuta mitään ennen kuin vastaan.';
  if (list.length === 1) {
    const r = list[0];
    const verbs = r.st === 'merged' ? 'siivotaanko se' : 'mergeä, jatka tai hylkää';
    return `Käsittele worker ${oneLine(r)}.${from.replace('Workerit', 'Sen')} Tarkista sen tila ja suosittele, mitä sille tehdään: ${verbs}. ${tail}`;
  }
  return `Käsittele nämä ${list.length} keskeneräistä workeria:\n${list.map((r, i) => `${i + 1}. ${oneLine(r)}`).join('\n')}\n${from.trim() ? from.trim() + '\n' : ''}Tarkista kunkin tila ja suosittele, mitä niille tehdään: mergeä, jatka tai hylkää. ${tail}`;
}
function recommendation(list) {
  if (list.length === 1) {
    const r = list[0];
    return `Tarkistin workerin ”${r.title}”.\n\n${r.look.map(x => '- ' + x).join('\n')}\n\n${r.why}${r.alt ? '\n\n' + r.alt : ''} ${r.ask}`;
  }
  return `Tarkistin ${list.length} workeria:\n\n${list.map((r, i) => `${i + 1}. **${r.title}**: ${r.look[r.look.length - 1]} ${r.why}`).join('\n')}\n\nTeenkö nämä kaikki? Voit myös vastata kohta kohdalta, esimerkiksi ”mergeä 1, jätä muut”.`;
}
const DONE = {
  merge: (r) => [`Mergesin ”${r.title}”: rebase mainin päälle, KOKEILTAVAA.md:n törmäykseen molemmat kokeet. Poistin haaran ${r.branch} ja worktreen.`, { gone: true, goneWord: 'mergetty · haara ja worktree poistettu' }],
  salvage: (r) => [`Ajoin taskfleet run salvage ”${r.title}” -ajolle; työ laskeutui mainiin, ja Taskfleet poisti haaran ja worktreen.`, { gone: true, goneWord: 'laskeutui · haara ja worktree poistettu' }],
  discard: (r) => [`Hylkäsin ”${r.title}”: ${r.st === 'cancelled' ? 'taskfleet run discard' : r.st === 'interrupted' ? 'taskfleet run cancel ja discard' : 'git branch -D ja git worktree remove'} poisti haaran ja worktreen.`, { gone: true, goneWord: 'hylätty · haara ja worktree poistettu' }],
  resume: (r) => [`Käynnistin ”${r.title}” -ajon valvojan uudelleen (taskfleet run reattach); worker jatkaa siitä, mihin jäi.`, { st: 'working', resumed: true, age: '0 min' }],
  continue: (r) => [`Käynnistin uuden workerin ”${r.title} (jatko)” haarasta ${r.branch}. Vanhan ajon worktree on poistettu, ja haara on nyt uuden workerin.`, { gone: true, goneWord: 'jatkuu uutena workerina · vanha worktree poistettu' }],
  cleanup: (r) => [`Poistin ”${r.title}” -workerin worktreen ja haaran ${r.branch}; työ oli jo mainissa.`, { gone: true, goneWord: 'siivottu · haara ja worktree poistettu' }],
  leave: (r) => [`”${r.title}”: en tee nyt mitään. Työ pysyy haarassa, ja rivi jää listaan.`, null],
};
// What the person's answer asks for, per run. The synthetic agent understands a few words; a
// real one reads the answer as a person would.
function intent(text, r, i) {
  const t = text.toLowerCase();
  const nums = [...t.matchAll(/(\d)/g)].map(m => +m[1]);
  const mine = (re) => { const m = t.match(re); if (!m) return false; const own = [...m[0].matchAll(/\d/g)].map(x => +x[0]); return !own.length || own.includes(i + 1); };
  if (nums.length && /muut/.test(t) && !nums.includes(i + 1)) return /jätä muut|muut jätä/.test(t) ? 'leave' : /muut ok|muut kuten/.test(t) ? r.rec : 'leave';
  if (mine(/(jätä|myöhemmin|odota|älä)[^.,]*/)) return 'leave';
  if (mine(/hylkää[^.,]*/)) return 'discard';
  if (mine(/(uusi worker|uudella workerilla)[^.,]*/)) return r.st === 'merged' ? 'cleanup' : 'continue';
  if (mine(/jatka[^.,]*/)) return r.st === 'interrupted' ? 'resume' : 'continue';
  if (mine(/(mergeä|merge|vie perille)[^.,]*/)) return r.st === 'interrupted' ? 'salvage' : r.st === 'merged' ? 'cleanup' : 'merge';
  if (mine(/siivo[^.,]*/)) return 'cleanup';
  if (/kyllä|joo|ok|tee|selvä|suosit|ehdot|hyvä/.test(t)) return r.rec;
  return null;
}

// ---------- The agent: timers belong to one reset generation ----------
function later(ms, fn) { const g = S.gen; setTimeout(() => { if (g !== S.gen) return; fn(); repaint(); }, ms); }
let seq = 0;
// Send the request: target is a conversation id or 'new'.
function ask(ids, target, origin) {
  const list = ids.map(byId).filter(r => r && unfinished(r) || r && r.st === 'merged' && !r.gone).filter(r => !S.handling[r.id]);
  if (!list.length) return;
  let c;
  if (target === 'new') {
    const id = 'n' + (++seq);
    c = S.convs[id] = { id, title: list.length > 1 ? 'Workereiden käsittely' : `Worker: ${list[0].title}`, state: 'starting', msgs: [], queue: [], fresh: true };
  } else c = S.convs[target];
  if (c.state === 'readonly') return ask(ids, 'new', origin);
  const fellBack = target === 'new' && S.v < 2;
  const req = { id: 'q' + (++seq), conv: c.id, runs: list.map(r => r.id), text: requestText(list, c.id) };
  S.reqs[req.id] = req;
  const phase = c.state === 'working' ? 'queued' : c.state === 'idle' ? 'checking' : 'starting';
  for (const r of list) S.handling[r.id] = { req: req.id, conv: c.id, phase };
  S.choose = null;
  if (c.state === 'working') {
    // Pi is in a turn: the browser queues the message as a follow-up, as the composer does.
    c.queue.push(req.id);
    S.note = `Pyyntö jonossa: ${c.title} työskentelee, ja pyyntö lähtee, kun vuoro päättyy.`;
    if (!c.ending) { c.ending = true; later(T.turn, () => endTurn(c)); }
  } else if (c.state === 'closed' || c.state === 'starting') {
    // Closed: sending continues the native conversation first. New: Pi starts with the message held.
    c.msgs.push(u(req.text, req.id));
    S.note = !c.fresh ? `${c.title} oli suljettu; pyyntö jatkoi keskustelua.`
      : fellBack && S.convs.ilta.state === 'readonly' ? `Iltakierros on ajettu päätteessä, eikä selain voi kirjoittaa siihen. Pyyntö lähti uuteen keskusteluun ”${c.title}”.`
      : `Pyyntö lähti uuteen keskusteluun ”${c.title}”.`;
    c.state = 'starting';
    later(T.start, () => { c.state = 'working'; deliver(c, req); });
  } else {
    c.msgs.push(u(req.text, req.id));
    c.state = 'working';
    S.note = c.id === S.at ? 'Pyyntö lähti tähän keskusteluun.' : `Pyyntö lähti keskusteluun ${c.title}.`;
    deliver(c, req);
  }
  return origin;
}
function endTurn(c) {
  c.ending = false;
  c.msgs.push(a('README päivitetty: ajastuksen esimerkki ja uusi ympäristömuuttuja on kuvattu.'));
  c.state = 'idle';
  const next = c.queue.shift();
  if (next) { const req = S.reqs[next]; c.msgs.push(u(req.text, req.id)); c.state = 'working'; deliver(c, req); }
}
function deliver(c, req) {
  for (const id of req.runs) if (S.handling[id]) S.handling[id].phase = 'checking';
  c.state = 'working';
  later(T.check, () => {
    c.msgs.push(a(recommendation(req.runs.map(byId))));
    c.state = 'idle'; c.awaiting = req.id;
    for (const id of req.runs) if (S.handling[id]) S.handling[id].phase = 'answer';
  });
}
// The person answers in the conversation like any message.
function answer(c, text) {
  c.msgs.push(u(text));
  const req = S.reqs[c.awaiting];
  if (!req) {
    c.state = 'working';
    later(T.check, () => { c.msgs.push(a('Selvä. (Kokeessa vapaa viesti ei muuta mitään; kokeile Kerro agentille workerin riviltä.)')); c.state = 'idle'; });
    return;
  }
  const list = req.runs.map(byId).filter(r => S.handling[r.id]);
  const plan = list.map((r, i) => [r, intent(text, r, i)]);
  if (plan.every(([, x]) => !x)) {
    c.state = 'working';
    later(T.check, () => { c.msgs.push(a('En ole varma, mitä haluat. Vastaa esimerkiksi ”kyllä”, ”hylkää” tai ”jätä toistaiseksi”.')); c.state = 'idle'; });
    return;
  }
  c.awaiting = null; c.state = 'working';
  for (const [r, x] of plan) S.handling[r.id] = { ...S.handling[r.id], phase: 'acting', doing: x ?? 'leave' };
  later(T.act, () => {
    const lines = [];
    for (const [r, x] of plan) {
      const [line, change] = DONE[x ?? 'leave'](r);
      lines.push(line);
      delete S.handling[r.id];
      if (!change) continue;
      S.over[r.id] = { ...(S.over[r.id] ?? {}), ...change };
      if (x === 'continue') S.extra.push({ id: 'n' + r.id, title: `${r.title} (jatko)`, st: 'working', age: '0 min', h: r.h, prof: r.prof, repo: r.repo, branch: r.branch });
      if (change.gone) {
        S.leaving[r.id] = true;
        later(T.leave, () => { delete S.leaving[r.id]; S.note = `${r.title} poistui Workerit-listasta: haaraa ja worktreetä ei enää ole.`; });
      }
    }
    c.msgs.push(a(lines.join('\n\n')));
    c.state = 'idle';
  });
}

// ---------- The ask buttons: where they sit and which conversation they reach ----------
// One builder for all three places (row, panel header, pill), so the variant's routing is
// the same everywhere.
const targetWord = () => defaultTarget() === 'new' ? 'uuteen keskusteluun' : 'tähän keskusteluun';
function askBtn(ids, place, label, cls = '') {
  const key = `${place}`;
  const n = ids.length;
  const title = n > 1 ? `Lähettää yhden pyynnön ${targetWord()}: agentti tarkistaa ${n} workeria ja suosittelee` : `Lähettää pyynnön ${targetWord()}: agentti tarkistaa worktreen ja suosittelee`;
  const main = `<button type="button" class="btn sm tell ${cls}" data-act="ask" data-ids="${ids.join(',')}" data-place="${key}" title="${esc(title)}" aria-label="${esc(`${label}: ${title}`)}">${n > 1 ? IC.all : IC.msg}<span>${esc(label)}</span>${S.v === 2 ? `<span class="tgt">${IC.plus}</span>` : ''}</button>`;
  if (S.v !== 1) return main;
  const open = S.choose?.place === key;
  return `<span class="split${open ? ' open' : ''}">${main}<button type="button" class="btn sm caret" data-act="choose" data-ids="${ids.join(',')}" data-place="${key}" aria-expanded="${open}" aria-label="Valitse keskustelu, jolle pyyntö lähtee">${IC.down}</button></span>`;
}
function chooser() {
  const ch = S.choose; if (!ch) return '';
  const opts = Object.values(S.convs).filter(c => !c.gone);
  const stateLine = (c) => c.state === 'readonly' ? 'ajettu päätteessä · selain ei voi kirjoittaa siihen' : c.state === 'working' ? 'työskentelee · pyyntö menee jonoon' : c.state === 'closed' ? 'suljettu · lähettäminen jatkaa sitä' : c.state === 'starting' ? 'käynnistyy' : 'odottaa sinua';
  const item = (id, title, sub, primary) => `<button type="button" role="menuitem" class="ch-item${primary ? ' primary' : ''}" data-act="ask-to" data-to="${id}"${S.convs[id]?.state === 'readonly' ? ' disabled' : ''}>${id === 'new' ? IC.plus : IC.msg}<span class="ch-l"><span>${esc(title)}</span><span class="ch-sub">${esc(sub)}</span></span></button>`;
  return `<div class="chooser" role="menu" data-testid="chooser" aria-label="Kenelle pyyntö lähtee"><p class="ch-head">Kenelle pyyntö lähtee?</p>${opts.map(c => item(c.id, c.title, `${c.parent ? 'käynnisti workerit · ' : ''}${stateLine(c)}`, c.parent)).join('')}${item('new', 'Uusi keskustelu', `${HOME} · agentti aloittaa tyhjästä`)}</div>`;
}

// ---------- Rows ----------
function row(r) {
  const h = S.handling[r.id];
  let word = `<span class="w-word" data-tone="${tone(r)}">${stateWord(r)}</span>`;
  if (h) { const [w, sub] = PHASE[h.phase](h.conv, r); word = `<span class="w-word" data-tone="${tone(r)}" data-testid="phase">${esc(w)}</span><span class="sep">·</span><span class="w-where">${esc(sub)}</span>`; }
  const sub = h || r.gone ? word : `${word}<span class="sep">·</span>${r.h} · ${esc(r.prof)}${repoTag(r)}`;
  const main = `<button type="button" class="row-main" data-act="worker" data-id="${r.id}" aria-label="${esc(`${r.title}: ${stateWord(r)}. Avaa workerin näkymä.`)}"><span class="mark">${mark(r)}</span><span class="lines"><span class="line1"><span class="name">${esc(r.title)}</span><span class="meta">${r.end ?? r.age}</span></span><span class="line2">${sub}</span></span></button>`;
  let side = '';
  if (r.st === 'working') side = `<button type="button" class="icon-btn stop" aria-label="Lopeta: ${esc(r.title)}" data-act="toast" data-msg="Lopetus kuuluu aiempaan kierrokseen.">${IC.stop}</button>`;
  else if (r.gone) side = '';
  else if (h) side = `<button type="button" class="btn sm quiet open-conv" data-act="goto" data-to="${h.conv}" aria-label="Näytä keskustelu ${esc(convName(h.conv))}"><span>${h.conv === S.at ? 'Näytä' : 'Avaa'}</span><span class="hide-phone">keskustelu</span>${h.conv === S.at ? '' : IC.out}</button>`;
  else side = askBtn([r.id], `row:${r.id}`, 'Kerro agentille');
  const chooserHere = S.choose?.place === `row:${r.id}` ? chooser() : '';
  return `<div class="row two${r.gone ? ' leaving' : ''}${chooserHere ? ' open' : ''}" data-run="${r.id}" data-state="${r.st}" data-unfinished="${unfinished(r)}" data-phase="${h?.phase ?? (r.gone ? 'gone' : '')}"><div class="row-line">${main}${side}</div>${chooserHere}</div>`;
}
const group = (label, list) => `<div class="group" role="group" aria-label="${label}">${list.map(row).join('')}</div>`;
function panel(f) {
  const live = f.live.length ? group('Workerit: käynnissä', f.live) : '<p class="empty">Ei työskenteleviä workereita.</p>';
  if (!f.ended.length) return live;
  const order = (r) => r.gone ? 3 : S.handling[r.id] ? 1 : unfinished(r) ? 0 : 2;
  const rows = [...f.ended].sort((x, y) => order(x) - order(y));
  const all = f.free.length > 1 ? askBtn(f.free.map(r => r.id), 'head', `Käsittele kaikki (${f.free.length})`, 'all') : '';
  const head = `<div class="endhead"><button type="button" class="endfold" data-act="fold" aria-expanded="${S.ended}">${IC.chev}<span>${count(f.ended.length, 'päättynyt', 'päättynyttä')}</span>${f.free.length && !S.ended ? '<span class="attn-dot" role="img" aria-label="Keskeneräisiä"></span>' : ''}</button><span class="endhead-act">${all}</span></div>${S.choose?.place === 'head' ? chooser() : ''}`;
  const ro = S.convs.ilta.state === 'readonly';
  const how = ro && S.v < 2 ? `Tähän keskusteluun ei voi kirjoittaa selaimesta, joten Kerro agentille aloittaa uuden keskustelun${S.v === 1 ? '; ▾ valitsee toisen' : ''}`
    : ['Kerro agentille lähettää pyynnön tähän keskusteluun', 'Kerro agentille lähettää pyynnön tähän keskusteluun; ▾ valitsee toisen', 'Kerro agentille aloittaa uuden keskustelun'][S.v];
  const rule = `<p class="life" data-testid="rule">${how}. Agentti tarkistaa työn ja suosittelee, ja sinä päätät vastaamalla. Rivi poistuu, kun haaraa ja worktreetä ei enää ole.</p>`;
  return `${live}${head}${S.ended ? group('Workerit: päättyneet', rows) + rule : ''}`;
}

// ---------- The worker pill ----------
// One mark per live worker, one red ball per unfinished row nobody is handling, one ring per
// row an agent is handling. Beside it, Käsittele kaikki while a row waits for its request.
function strip(f) {
  if (!f.live.length && !f.ended.length) return '';
  const free = f.free.slice(0, 3).map(() => '<span class="ball"></span>').join('') + (f.free.length > 3 ? `<span class="more-n">+${f.free.length - 3}</span>` : '');
  const busy = f.open.filter(r => S.handling[r.id]);
  const rings = busy.map(r => S.handling[r.id].phase === 'answer' ? '<span class="you-ring"></span>' : '<span class="busy-ring"></span>').join('');
  const marks = `<span class="marks">${f.live.map(mark).join('')}${rings}${free}</span>`;
  const s = [`Workerit: ${f.live.length ? `${f.live.length} työskentelee` : 'ei työskentele'}`, f.free.length ? `${count(f.free.length, 'keskeneräinen', 'keskeneräistä')}` : '', busy.length ? `${busy.length} agentin käsittelyssä` : ''].filter(Boolean).join(', ');
  const pill = `<button type="button" class="pill${f.live.length ? '' : ' idle'}" data-act="pill" data-testid="chip-spin" aria-expanded="${S.open}" aria-label="${esc(s)}" title="${esc(s)}"><span class="ic">${IC.branch}</span>${f.live.length || f.open.length ? marks : '<span class="n">✓</span>'}</button>`;
  const companion = f.free.length ? `<span class="pill-act" data-testid="pill-all">${askBtn(f.free.map(r => r.id), 'pill', f.free.length > 1 ? `Käsittele kaikki (${f.free.length})` : 'Käsittele', 'pill-tell')}</span>` : '';
  const pop = S.open ? `<div class="pop" data-testid="panel" data-variant="${V[S.v]}"><div class="tabs" role="tablist" aria-label="Taustatyö"><button type="button" role="tab" class="tab" aria-selected="true">${IC.branch}Workerit<span class="tab-n">${f.live.length}</span></button><button type="button" class="icon-btn x" data-act="close" aria-label="Sulje">${IC.x}</button></div><div class="pop-body" role="tabpanel">${panel(f)}</div></div>` : '';
  const pillChooser = S.choose?.place === 'pill' ? `<div class="pill-chooser">${chooser()}</div>` : '';
  return `<section class="strip" aria-label="Taustatyö"><div class="strip-wrap">${pop}${pillChooser}<div class="badges" role="group" aria-label="Taustatyö">${pill}${companion}</div></div></section>`;
}

// ---------- The conversation ----------
function md(text) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return text.split('\n\n').map(block => {
    const lines = block.split('\n');
    if (lines.every(l => l.startsWith('- '))) return `<ul>${lines.map(l => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`;
    if (lines.every(l => /^\d+\. /.test(l))) return `<ol>${lines.map(l => `<li>${inline(l.replace(/^\d+\. /, ''))}</li>`).join('')}</ol>`;
    return `<p>${lines.map(inline).join('<br>')}</p>`;
  }).join('');
}
function thread(c) {
  const msgs = c.msgs.map(m => m.who === 'u'
    ? `<div class="msg user"${m.req ? ` data-testid="request" data-req="${m.req}"` : ''}><div class="bubble">${esc(m.text)}</div></div>`
    : `<div class="msg agent" data-testid="agent-msg">${md(m.text)}</div>`).join('');
  const busy = c.state === 'working' ? '<div class="msg agent busy" data-testid="busy"><span class="run-dot"></span>Työskentelee…</div>'
    : c.state === 'starting' ? `<div class="msg agent busy"><span class="run-dot"></span>${c.fresh ? 'Pi käynnistyy; viesti odottaa…' : 'Keskustelu jatkuu; viesti odottaa…'}</div>` : '';
  return `<div class="thread">${msgs}${busy}</div>`;
}
function stateChip(c) {
  if (c.state === 'working' || c.state === 'starting') return '<span class="state"><span class="run-dot"></span>Työskentelee</span>';
  if (c.state === 'closed') return '<span class="state closed">Suljettu</span>';
  if (c.state === 'readonly') return '<span class="state closed">Päätteessä</span>';
  return '<span class="state"><span class="wait-ring"></span>Odottaa sinua</span>';
}
function composer(c) {
  const q = c.queue.map(id => `<div class="queued" data-testid="queued"><span class="q-ic">${IC.clock}</span><p><strong>Jonossa</strong> · lähtee, kun vuoro päättyy: ${esc(S.reqs[id].text.slice(0, 90))}…</p></div>`).join('');
  const closed = c.state === 'closed' ? '<p class="cnote">Keskustelu on suljettu, eikä Pi ole käynnissä. Viestin lähettäminen jatkaa sitä.</p>'
    : c.state === 'readonly' ? '<p class="cnote">Keskustelu on ajettu päätteessä (tmux). Selaimesta sitä voi vain lukea.</p>' : '';
  const hint = c.awaiting ? 'Vastaa agentille, esim. ”kyllä” tai ”jätä toistaiseksi”…' : 'Kirjoita agentille…';
  return `<div class="composer">${q}${closed}<div class="cbox"><textarea aria-label="Viesti" data-conv="${c.id}" placeholder="${esc(hint)}" rows="1">${esc(S.typed[c.id] ?? '')}</textarea><button type="button" class="icon-btn send" data-act="send" aria-label="Lähetä">${IC.send}</button></div></div>`;
}

// ---------- The worker's own view (round 2's report, the same ask at its foot) ----------
function workerView(r) {
  const h = S.handling[r.id];
  const band = `<div class="wv-band" data-testid="worker-view"><button type="button" class="wv-back" data-act="back">${IC.back}Iltakierros</button><div class="wv-id"><span class="wv-kind">Worker</span><strong>${esc(r.title)}</strong></div><div class="wv-meta"><span class="mark">${mark(r)}</span><span class="w-word" data-tone="${tone(r)}">${stateWord(r)}</span><span class="sep">·</span>${r.h} · ${esc(r.prof)}<span class="sep">·</span><span class="mono">${esc(r.repo)}</span></div></div>`;
  const body = `<div class="thread"><div class="wv-result"><span class="mark">${mark(r)}</span><div><strong>${esc(stateWord(r))}</strong><p>${esc(r.summary ?? 'Työ on kesken.')}</p></div></div><dl class="wv-facts"><dt>Haara</dt><dd class="mono">${esc(r.branch)}</dd><dt>Worktree</dt><dd class="mono">${esc(wtPath(r))}</dd>${r.tf ? `<dt>Taskfleet</dt><dd class="mono">${esc(r.tf)}</dd>` : ''}</dl></div>`;
  let foot = '';
  if (ended(r) && !r.gone) {
    const status = h ? `<p class="wv-decide-head" data-testid="worker-phase"><strong>${esc(PHASE[h.phase](h.conv, r).join(' · '))}.</strong></p><div class="wv-acts"><button type="button" class="btn sm" data-act="goto" data-to="${h.conv}">Avaa keskustelu ${esc(convName(h.conv))}</button></div>`
      : `<p class="wv-decide-head"><strong>Mitä tälle työlle tehdään?</strong> Agentti tarkistaa sen ja suosittelee; sinä päätät vastaamalla keskustelussa.</p><div class="wv-acts">${askBtn([r.id], `worker:${r.id}`, 'Kerro agentille')}</div>${S.choose?.place === `worker:${r.id}` ? chooser() : ''}`;
    foot = `<div class="wv-decide" data-testid="worker-decide">${status}</div>`;
  }
  return `<div class="topbar"><button type="button" class="icon-btn menu" data-act="drawer" aria-label="Avaa valikko">${IC.menu}</button><div class="title"><strong>${esc(r.title)}</strong><span class="mono">${esc(r.repo)}</span></div></div>${band}<div class="scroll">${body}</div>${foot}`;
}

// ---------- Frame ----------
function rail() {
  const mk = (c) => c.state === 'working' || c.state === 'starting' ? '<span class="run-dot" role="img" aria-label="Työskentelee"></span>' : c.state === 'closed' || c.state === 'readonly' ? '' : c.id === 'kalib' ? `<span class="done">${IC.check}</span>` : '<span class="wait-ring" role="img" aria-label="Odottaa sinua"></span>';
  const item = (c) => `<a href="#" class="conv${S.at === c.id ? ' cur' : ''}${c.fresh ? ' new' : ''}" data-act="goto" data-to="${c.id}"${S.at === c.id ? ' aria-current="page"' : ''}><span>${esc(c.title)}</span>${mk(c)}</a>`;
  return `<aside class="rail" aria-label="Työtilat"><div class="brand">Habitat</div><div class="ws">${HOME}</div>
${Object.values(S.convs).map(item).join('')}
<div class="ws">kirjasto</div><a href="#" class="conv" data-act="toast" data-msg="Vain kasvimaan keskustelut ovat auki tässä kokeessa."><span>Hakusanojen negaatiot</span><span class="wait-ring"></span></a></aside>`;
}
function view() {
  const f = facts();
  const r = S.worker && byId(S.worker);
  const c = S.convs[S.at];
  let main;
  if (r) main = workerView(r);
  else main = `<div class="topbar"><button type="button" class="icon-btn menu" data-act="drawer" aria-label="Avaa valikko">${IC.menu}</button><div class="title"><strong>${esc(c.title)}</strong><span class="mono">${HOME}</span></div>${stateChip(c)}<button type="button" class="icon-btn" aria-label="Tiedot">${IC.info}</button></div>
<div class="scroll">${thread(c)}</div>${c.parent ? strip(f) : ''}${composer(c)}`;
  return `<div class="app v-${V[S.v]}${S.drawer ? ' drawer' : ''}" data-variant="${V[S.v]}">${rail()}${S.drawer ? '<div class="drawer-scrim" data-act="drawer"></div>' : ''}<div class="main${r ? ' worker' : ''}" data-conv="${r ? '' : c.id}">${main}<p class="toast" role="status">${esc(S.note)}</p></div></div>`;
}
let lastLen = {};
function repaint(focusSel) {
  const el = document.getElementById('stage');
  if (!el.querySelector('.app')) return;
  const active = document.activeElement;
  const keep = !focusSel && active && el.contains(active) && active.tagName === 'TEXTAREA' ? { sel: `textarea[data-conv="${active.dataset.conv}"]`, s: active.selectionStart } : null;
  const sc = el.querySelector('.pop-body')?.scrollTop;
  el.innerHTML = view();
  const body = el.querySelector('.pop-body'); if (body && sc) body.scrollTop = sc;
  // Follow the thread only when it grew, as the conversation view does.
  const th = el.querySelector('.main:not(.worker) .scroll');
  const n = S.convs[S.at]?.msgs.length + S.convs[S.at]?.state;
  if (th && lastLen[S.at] !== n) { th.scrollTop = th.scrollHeight; lastLen[S.at] = n; }
  if (focusSel) el.querySelector(focusSel)?.focus();
  else if (keep) { const t = el.querySelector(keep.sel); if (t) { t.focus(); t.setSelectionRange(keep.s, keep.s); } }
}
// The default target of a press: the variant decides.
// Vanhempi and Valittava fall back to a new conversation when the browser cannot write to the
// parent (a Pi started in a terminal: its history is read-only here).
const defaultTarget = () => S.v === 2 || S.convs.ilta.state === 'readonly' ? 'new' : 'ilta';
document.addEventListener('input', (e) => { if (e.target.matches('#stage textarea')) S.typed[e.target.dataset.conv] = e.target.value; });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && e.target.matches('#stage textarea')) { e.preventDefault(); e.target.closest('.cbox').querySelector('[data-act="send"]').click(); }
});
document.addEventListener('click', (e) => {
  const t = e.target.closest('#stage [data-act]'); if (!t) return;
  e.preventDefault();
  const act = t.dataset.act, id = t.dataset.id; let focus = null;
  S.note = '';
  if (act === 'pill') { S.open = !S.open; S.choose = null; focus = '.pill[data-act="pill"]'; }
  else if (act === 'close') { S.open = false; S.choose = null; focus = '.pill[data-act="pill"]'; }
  else if (act === 'fold') { S.ended = !S.ended; focus = '.endfold'; }
  else if (act === 'ask') {
    const ids = t.dataset.ids.split(','), place = t.dataset.place;
    ask(ids, defaultTarget(), place);
    // The panel stays open, so the person sees the row take the request.
    focus = place.startsWith('row:') ? `.row[data-run="${ids[0]}"] .open-conv` : place.startsWith('worker:') ? '[data-testid="worker-decide"] .btn' : '.pill[data-act="pill"]';
  }
  else if (act === 'choose') { const place = t.dataset.place; S.choose = S.choose?.place === place ? null : { place, ids: t.dataset.ids.split(',') }; focus = S.choose ? '.chooser .ch-item' : null; }
  else if (act === 'ask-to') { const ch = S.choose; ask(ch.ids, t.dataset.to, ch.place); focus = '.pill[data-act="pill"]'; }
  else if (act === 'goto') {
    const to = t.dataset.to;
    S.worker = null; S.drawer = false; S.choose = null;
    if (to === S.at) S.open = false; else { S.at = to; S.open = false; }
    focus = '.cbox textarea';
  }
  else if (act === 'worker') { S.worker = id; S.open = false; S.choose = null; focus = '.wv-back'; }
  else if (act === 'back') { S.worker = null; S.at = 'ilta'; S.open = true; focus = '.pop .x'; }
  else if (act === 'drawer') { S.drawer = !S.drawer; }
  else if (act === 'send') {
    const c = S.convs[t.closest('.main').dataset.conv];
    const text = (S.typed[c.id] ?? '').trim();
    if (!text) { S.note = 'Kirjoita viesti ensin.'; }
    else if (c.state === 'readonly') { S.note = 'Pääteistuntoon ei voi kirjoittaa selaimesta.'; }
    else if (c.state !== 'idle' && c.state !== 'closed') { S.note = 'Kokeessa vastataan, kun agentti on vapaa.'; }
    else { S.typed[c.id] = ''; if (c.state === 'closed') c.state = 'idle'; answer(c, text); }
    focus = '.cbox textarea';
  }
  else if (act === 'toast') { S.note = t.dataset.msg; }
  repaint(focus);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (S.choose) { const place = S.choose.place; S.choose = null; repaint(place === 'pill' ? '[data-testid="pill-all"] .caret' : place === 'head' ? '.endhead .caret' : place.startsWith('worker:') ? '[data-testid="worker-decide"] .caret' : `.row[data-run="${place.slice(4)}"] .caret`); return; }
  if (S.drawer) { S.drawer = false; repaint(); return; }
  if (S.open) { S.open = false; repaint('.pill[data-act="pill"]'); }
});
const theme = document.getElementById('theme');
const setTheme = (t) => { document.documentElement.dataset.theme = t; theme.textContent = t === 'dark' ? 'Vaalea' : 'Tumma'; };
setTheme(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
theme.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
const reset = () => { Object.assign(S, fresh()); lastLen = {}; seq = 0; };
document.getElementById('scene').addEventListener('change', (e) => { S.scene = e.target.value; reset(); repaint(); });
document.getElementById('parent').addEventListener('change', (e) => { S.parent = e.target.value; reset(); repaint(); });
const start = (i) => () => { S.v = i; reset(); return view(); };
window.PROTO = { S, T, repaint };
window.variants = V.map((_, i) => start(i));
})();
const variants = window.variants;
