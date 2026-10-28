// Päättyneet workerit, kierros 1 (proto-ended-worker-lifecycle). Synthetic names and data only.
// Production context: the Workerit panel as it is after worker-panel-rivi (two-line rows), the
// worker pill above the composer, and the worker's own view. One conversation (Iltakierros,
// repository kasvimaa) with one live worker and five ended ones, one per ended state: landed,
// not merged with work preserved (Jari's pilot.456 case), failed without work, cancelled with
// work, and interrupted but resumable.
//
// The directions differ on one axis: what takes an ended row off the list.
//   1 Kuittaus  — the person: every ended row has Kuittaa; acknowledged rows fold away.
//   2 Ratkaisu  — the work: a row stays while work remains; rows without work age out.
//   3 Siivous   — a rule, at once: the panel keeps only rows that wait for a decision;
//                 everything else is in Workerihistoria.
// The actions are the same in all three and say what kind they are: a view of the work
// (Katso), a request the person sends to the main agent (the draft names the Taskfleet or Git
// command the agent will run), or a change to this view only. The browser never merges,
// discards or cancels a run itself.
(() => {
const SVG = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IC = {
  branch: SVG('<circle cx="7" cy="6" r="2"/><path d="M7 8v10"/><path d="M7 12c0 3 3 4 7 4"/><circle cx="17" cy="16" r="2"/>'),
  term: SVG('<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="m7.5 9.5 3 2.5-3 2.5M13 15h3.5"/>'),
  stop: SVG('<rect x="7" y="7" width="10" height="10" rx="1.5"/>'),
  x: SVG('<path d="M6 6l12 12M18 6 6 18"/>'),
  check: SVG('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  warn: SVG('<path d="M12 4 3 19h18z"/><path d="M12 10v4"/><path d="M12 16.5h.01"/>'),
  fail: SVG('<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6M15 9l-6 6"/>'),
  merge: SVG('<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 8v8"/><path d="M6 8c0 3 4 4 10 4"/>'),
  pause: SVG('<circle cx="12" cy="12" r="8.5"/><path d="M10 9v6M14 9v6"/>'),
  cancel: SVG('<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/>'),
  chev: SVG('<path d="m9 6 6 6-6 6"/>'),
  down: SVG('<path d="m6 9 6 6 6-6"/>'),
  back: SVG('<path d="m15 6-6 6 6 6"/>'),
  menu: SVG('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  send: SVG('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  info: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5h.01"/>'),
  eye: SVG('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>'),
  msg: SVG('<path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 17H10l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 5z"/>'),
  dots: SVG('<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>'),
  copy: SVG('<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h2"/>'),
  folder: SVG('<path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17z"/>'),
  hist: SVG('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/><path d="M12 8v4l3 2"/>'),
};
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const V = ['kuittaus', 'ratkaisu', 'siivous'];
const HOME = 'kasvimaa';
const fresh = () => ({ open: false, ended: false, acksOpen: false, acked: {}, confirmAck: null, resolved: {}, acts: null, worker: null, tab: null, draft: null, sent: [], history: false, note: '', extra: [] });
const S = { v: 0, scene: 'a', later: false, ...fresh() };

// ---------- Facts: what the host would know ----------
// tf: the Taskfleet facts behind the row (status, landed, preserved work). The spinoffs
// contract today carries state merged/unmerged/failed/working/waiting_parent/unknown,
// preserved, branch, worktree, summary, ended_at. "cancelled" and "interrupted" are folded
// into unmerged and unknown; the diff and a hand merge are not known at all. See result.md.
const ALL = [
  { id: 'w1', title: 'Kastelun ajastus', st: 'working', waits: true, age: '12 min', h: 'Pi', prof: 'oletus', repo: HOME, branch: 'wt/ka2r-kastelun-ajastus' },
  { id: 'e2', rid: '01m5yq1t6wkd3r8n2c4h7pqa0e', title: 'test-guide: worker-näkymän koe', st: 'unmerged', preserved: true, end: '07.36', h: 'Pi', prof: 'builtin', repo: HOME, branch: 'wt/5yq1-test-guide-worker-nakyma', tf: 'done · landed: false · haara ja worktree tallessa',
    summary: 'Worker-näkymän koe on tehty ja havainnot kirjattu KOKEILTAVAA.md:hen. En mergennyt: main oli edennyt, ja KOKEILTAVAA.md törmäsi toisen workerin muutokseen.',
    diff: { add: 42, del: 7, files: [['KOKEILTAVAA.md', 31, 5], ['issues/worker-view-conversation/result.md', 9, 2], ['web/tests/worker-view.spec.ts', 2, 0]] } },
  { id: 'e1', rid: '01m5k8h2pcv6t1m9x3d5r2wq8b', title: 'Kuvien pakkaus', st: 'merged', end: '13.41', h: 'Pi', prof: 'oletus', repo: HOME, branch: 'wt/k8h2-kuvien-pakkaus', tf: 'done · landed: true · haara poistettu',
    summary: 'Pakkaus siirretty build-vaiheeseen, testit vihreinä. Laskeutui mainiin.' },
  { id: 'e4', rid: '01m5b5q3ndz4k7c1p8v6h2tm9r', title: 'Lomakkeen saavutettavuus', st: 'cancelled', preserved: true, end: '13.12', h: 'Claude', prof: 'tarkka', repo: HOME, branch: 'wt/b5q3-lomakkeen-saavutettavuus', tf: 'cancelled · haara ja worktree tallessa',
    summary: 'Pääagentti perui ajon, kun lomakkeen rakenne päätettiin tehdä toisin. Workerin kenttäotsikoiden korjaukset jäivät haaraan.',
    diff: { add: 18, del: 11, files: [['web/src/components/Lomake.tsx', 14, 9], ['web/src/components/Lomake.test.tsx', 4, 2]] } },
  { id: 'e5', rid: '01m5r7c1xa2f9w6n3q8k5d1tb7', title: 'Sääaseman CSV-vienti', st: 'interrupted', preserved: true, end: '11.05', h: 'Pi', prof: 'oletus', repo: HOME, branch: 'wt/r7c1-saaasema-csv', tf: 'running · valvoja ei käynnissä · worktree tallessa',
    summary: 'Ajo keskeytyi, kun palvelin käynnistettiin uudelleen. Worker oli kirjoittanut testit ja puolet toteutuksesta.',
    diff: { add: 64, del: 3, files: [['src/vienti/csv.ts', 41, 0], ['src/vienti/csv.test.ts', 23, 0], ['src/vienti/index.ts', 0, 3]] } },
  { id: 'e3', rid: '01m5t2v9fe8h3b6z1x4m7c2pq5', title: 'Vanhan rajapinnan poisto', st: 'failed', end: '12.58', h: 'Claude', prof: 'tarkka', repo: 'kirjasto', branch: 'wt/t2v9-vanha-rajapinta', tf: 'failed · ei tallessa olevaa työtä',
    summary: 'Kaksi kutsujaa käyttää yhä vanhaa rajapintaa, testit eivät menneet läpi. Worker ei jättänyt tallennettavaa työtä.' },
];
const LIVE = ['working', 'waiting_parent'];
function runs() {
  const base = S.scene === 'b' ? ALL.filter(r => r.id === 'e2') : ALL;
  return [...base, ...S.extra].map(r => {
    const x = S.resolved[r.id];
    return x ? { ...r, ...x, was: r } : { ...r };
  });
}
// A row with work left needs a decision; the red dot follows it (Jari 16.10.2026: until the
// branch is gone, not until it has been looked at), except in Kuittaus, where the person can
// acknowledge it away.
const hasWork = (r) => !!r.preserved;
function facts() {
  const all = runs().map(r => ({ ...r, waited: !!r.waits }));
  const live = all.filter(r => LIVE.includes(r.st));
  let ended = all.filter(r => !live.includes(r));
  // Ratkaisu: a row without work leaves a day after it ended (ended_at exists today).
  if (S.v === 1 && S.later) ended = ended.filter(hasWork);
  const acked = S.v === 0 ? ended.filter(r => S.acked[r.id]) : [];
  const shown = S.v === 0 ? ended.filter(r => !S.acked[r.id]) : ended;
  const decide = ended.filter(hasWork);
  const attention = S.v === 0 ? decide.filter(r => !S.acked[r.id]) : decide;
  return { all, live, ended, shown, acked, decide, attention };
}
const byId = (id) => runs().find(r => r.id === id);

// ---------- Words ----------
function stateWord(r) {
  if (r.st === 'working') return r.waited ? 'agentti odottaa' : 'agentti ei odota';
  if (r.st === 'merged') return r.byHand ? 'mergetty käsin' : 'laskeutui';
  if (r.st === 'discarded') return 'työ hylätty';
  if (r.st === 'continued') return 'jatkuu uudessa workerissa';
  if (r.st === 'unmerged') return 'ei mergetty · työ tallessa';
  if (r.st === 'cancelled') return 'peruttu · työ tallessa';
  if (r.st === 'interrupted') return 'keskeytyi · jatkettavissa';
  return 'epäonnistui · ei tallessa olevaa työtä';
}
function stateSentence(r) {
  if (r.st === 'working') return 'Agentti odottaa tätä workeria ja jatkaa, kun se valmistuu.';
  if (r.st === 'merged') return r.byHand ? 'Agentti mergesi työn käsin. Haaraa ei enää ole.' : `Laskeutui klo ${r.end}. Haaraa ei enää ole.`;
  if (r.st === 'discarded') return 'Työ hylättiin, ja haara ja worktree poistettiin.';
  if (r.st === 'continued') return 'Työ jatkuu uudessa workerissa samasta haarasta.';
  if (r.st === 'unmerged') return `Päättyi klo ${r.end} mergeämättä. Työ on tallessa haarassa.`;
  if (r.st === 'cancelled') return `Peruttiin klo ${r.end}. Työ on tallessa haarassa.`;
  if (r.st === 'interrupted') return `Keskeytyi klo ${r.end}. Worktree on tallessa, ja ajoa voi jatkaa.`;
  return `Epäonnistui klo ${r.end}. Työtä ei jäänyt talteen.`;
}
const tone = (r) => r.st === 'working' ? 'wait' : r.st === 'merged' ? 'ok' : hasWork(r) ? 'attn' : r.st === 'failed' ? 'err' : 'muted';
function mark(r) {
  if (r.st === 'working') return r.waited ? '<span class="bgw-dot"></span>' : '<span class="nowait-dot"></span>';
  if (r.st === 'merged') return `<span class="mark-ic ok">${IC.merge}</span>`;
  if (r.st === 'interrupted') return `<span class="mark-ic attn">${IC.pause}</span>`;
  if (r.st === 'cancelled') return `<span class="mark-ic attn">${IC.cancel}</span>`;
  if (hasWork(r)) return `<span class="mark-ic attn">${IC.warn}</span>`;
  if (r.st === 'failed') return `<span class="mark-ic err">${IC.fail}</span>`;
  return `<span class="mark-ic">${IC.check}</span>`;
}
const when = (r) => r.end ?? r.age;
const repoTag = (r) => r.repo !== HOME ? `<span class="sep">·</span><span class="tag repo" title="Toinen repositorio kuin tämä keskustelu">${esc(r.repo)}</span>` : '';

// ---------- Actions: the same set in every direction ----------
// kind: 'view' (Katso: reads, changes nothing), 'ask' (a request the person sends to the main
// agent; `runs` is what the agent will run), 'local' (this view only).
function actions(r) {
  if (!r.end) return [];
  const a = [];
  a.push({ id: 'report', kind: 'view', label: 'Raportti', icon: IC.eye });
  if (hasWork(r)) {
    a.push({ id: 'changes', kind: 'view', label: `Muutokset (+${r.diff.add} −${r.diff.del})`, icon: IC.eye });
    a.push({ id: 'editor', kind: 'view', label: 'Worktree editorissa', icon: IC.folder });
    if (r.st === 'interrupted') {
      a.push({ id: 'resume', kind: 'ask', label: 'Pyydä jatkamaan samaa ajoa', runs: `taskfleet run reattach ${r.rid}` });
      a.push({ id: 'merge', kind: 'ask', label: 'Pyydä mergeämään nykyinen tila', runs: `taskfleet run salvage ${r.rid}` });
    } else {
      // A done or cancelled run cannot be salvaged; its branch is merged with Git.
      a.push({ id: 'merge', kind: 'ask', label: 'Pyydä mergeämään', runs: 'git rebase + merge, sitten haaran ja worktreen poisto' });
      a.push({ id: 'continue', kind: 'ask', label: 'Uusi worker samasta haarasta', runs: `taskfleet run create (haarasta ${r.branch})` });
    }
    a.push({ id: 'discard', kind: 'ask', label: 'Pyydä hylkäämään työ', danger: true,
      runs: r.st === 'cancelled' ? `taskfleet run discard ${r.rid} --force`
        : r.st === 'interrupted' ? `taskfleet run cancel ${r.rid}, sitten run discard --force`
        : 'git worktree remove + git branch -D (Taskfleet hylkää vain epäonnistuneen tai perutun ajon)' });
  }
  return a;
}
const KIND = { view: 'Katso · ei muuta mitään', ask: 'Pyydä pääagentilta · luonnos kenttään, sinä lähetät', local: 'Vain tämä näkymä' };
function actionList(r, where) {
  const acts = actions(r);
  const by = (k) => acts.filter(a => a.kind === k);
  const btn = (a) => `<button type="button" class="act${a.danger ? ' danger' : ''}" data-act="do" data-do="${a.id}" data-id="${r.id}">${a.kind === 'ask' ? IC.msg : a.icon}<span class="act-l"><span>${esc(a.label)}</span>${a.runs ? `<span class="act-runs mono">${esc(a.runs)}</span>` : ''}</span></button>`;
  const group = (k, list) => list.length ? `<div class="act-group" data-kind="${k}"><p class="act-kind">${KIND[k]}</p><div class="act-items">${list.map(btn).join('')}</div></div>` : '';
  const local = S.v === 0 && !S.acked[r.id] ? [{ id: 'ack', kind: 'local', label: 'Kuittaa ja piilota rivi', icon: IC.check }] : [];
  const leave = S.v === 1 ? `<p class="act-leave">${hasWork(r) ? 'Rivi pysyy, kunnes työ on mergetty tai hylätty.' : 'Rivi poistuu vuorokauden kuluttua päättymisestä.'}</p>`
    : S.v === 2 && hasWork(r) ? '<p class="act-leave">Rivi siirtyy historiaan, kun työ on mergetty tai hylätty.</p>' : '';
  return `<div class="acts" data-testid="actions" data-where="${where}">${group('view', by('view'))}${group('ask', by('ask'))}${group('local', local)}${!hasWork(r) && r.end && S.v !== 0 ? `<p class="act-leave">Ei päätettävää: haaraa ei ole.</p>` : ''}${leave}</div>`;
}

// ---------- Rows ----------
function row(r, opts = {}) {
  const word = `<span class="w-word" data-tone="${tone(r)}">${stateWord(r)}</span>`;
  const sub = `${word}<span class="sep">·</span>${r.h} · ${esc(r.prof)}${repoTag(r)}`;
  const main = `<button type="button" class="row-main" data-act="worker" data-id="${r.id}" aria-label="${esc(`${r.title}: ${stateSentence(r)} Avaa workerin näkymä.`)}"><span class="mark">${mark(r)}</span><span class="lines"><span class="line1"><span class="name">${esc(r.title)}</span><span class="meta">${when(r)}</span></span><span class="line2">${sub}</span></span></button>`;
  const open = S.acts === r.id;
  let side = '<span class="gap" aria-hidden="true"></span>';
  if (r.st === 'working') side = `<button type="button" class="icon-btn stop" aria-label="Lopeta odotus: ${esc(r.title)}" data-act="toast" data-msg="Odotuksen lopetus kuuluu edelliseen kierrokseen.">${IC.stop}</button>`;
  else if (!opts.history && (actions(r).length > 1 || S.v === 0)) side = `<button type="button" class="icon-btn more" data-act="acts" data-id="${r.id}" aria-expanded="${open}" aria-label="Toiminnot: ${esc(r.title)}" title="Toiminnot">${IC.dots}</button>`;
  let ack = '';
  if (S.v === 0 && r.end && !opts.history) {
    ack = S.acked[r.id]
      ? `<button type="button" class="btn quiet sm" data-act="unack" data-id="${r.id}">Palauta</button>`
      : `<button type="button" class="btn quiet sm ack" data-act="ack" data-id="${r.id}" aria-label="Kuittaa: ${esc(r.title)}" title="Piilottaa rivin tästä listasta. Ei muuta Taskfleetia eikä haaraa.">${IC.check}<span>Kuittaa</span></button>`;
  }
  const confirm = S.confirmAck === r.id ? `<div class="confirm" role="group" aria-label="Kuittaa tallessa oleva työ"><p>Työ jää haaraan <span class="mono">${esc(r.branch)}</span>. Kuittaus vain piilottaa rivin ja punaisen pisteen; haara ja worktree jäävät levylle. Rivin saa takaisin Kuitatuista.</p><div class="d-actions"><button type="button" class="btn" data-act="ack-yes" data-id="${r.id}">Kuittaa silti</button><button type="button" class="btn quiet" data-act="ack-no">Peru</button></div></div>` : '';
  return `<div class="row two${open ? ' open' : ''}${S.acked[r.id] ? ' acked' : ''}" data-run="${r.id}" data-state="${r.st}"><div class="row-line">${main}${ack}${side}</div>${confirm}${open ? actionList(r, 'row') : ''}</div>`;
}
const group = (label, list, opts) => `<div class="group" role="group" aria-label="${label}">${list.map(r => row(r, opts)).join('')}</div>`;
function liveBlock(f) {
  return f.live.length ? group('Workerit: käynnissä', f.live) : '<p class="empty">Ei työskenteleviä workereita.</p>';
}
function fold(key, n, word, open, rows, dot) {
  if (!n) return '';
  return `<div class="endhead"><button type="button" class="endfold" data-act="fold" data-key="${key}" aria-expanded="${open}">${IC.chev}<span>${word}</span>${dot && !open ? '<span class="attn-dot" role="img" aria-label="Vaatii huomiota"></span>' : ''}</button></div>${open ? rows : ''}`;
}

// 1 Kuittaus: the production fold, a Kuittaa on every ended row, acknowledged rows fold away.
function panelKuittaus(f) {
  const ended = fold('ended', f.shown.length, count(f.shown.length, 'päättynyt', 'päättynyttä'), S.ended, group('Workerit: päättyneet', f.shown), f.attention.length);
  const acked = fold('acked', f.acked.length, count(f.acked.length, 'kuitattu', 'kuitattua'), S.acksOpen, group('Workerit: kuitatut', f.acked), false);
  return `${liveBlock(f)}${ended}${acked}`;
}
// 2 Ratkaisu: no hide; rows with work stay until it is merged or discarded, the rest age out.
function panelRatkaisu(f) {
  const rows = [...f.ended.filter(hasWork), ...f.ended.filter(r => !hasWork(r))];
  const note = f.ended.some(r => !hasWork(r)) ? '<p class="life">Rivit, joilla ei ole haaraa, poistuvat vuorokauden kuluttua päättymisestä.</p>' : '';
  return `${liveBlock(f)}${fold('ended', f.ended.length, count(f.ended.length, 'päättynyt', 'päättynyttä'), S.ended, group('Workerit: päättyneet', rows) + note, f.attention.length)}`;
}
// 3 Siivous: only what waits for a decision stays, unfolded; everything else is history.
function panelSiivous(f) {
  if (S.history) {
    const hist = f.ended.filter(r => !hasWork(r));
    return `<div class="hist-head"><button type="button" class="wv-back" data-act="hist-back">${IC.back}Workerit</button><strong>Workerihistoria</strong><span class="grp-n">${hist.length}</span></div><p class="grp-sub hist-sub">Päättyneet ajot, joilla ei ole enää haaraa. Taskfleet säilyttää ne; mitään ei tarvitse tehdä.</p>${hist.length ? group('Workerihistoria', hist, { history: true }) : '<p class="empty">Historia on tyhjä.</p>'}`;
  }
  const decide = f.decide.length ? `<section class="grp" data-group="attn" aria-label="Odottaa päätöstäsi"><h3 class="grp-head"><span class="mark-ic attn">${IC.warn}</span>Odottaa päätöstäsi<span class="grp-n">${f.decide.length}</span></h3><p class="grp-sub">Näiden työ on yhä haarassa. Vie se perille tai hylkää se.</p>${group('Odottaa päätöstäsi', f.decide)}</section>` : '';
  const n = f.ended.length - f.decide.length;
  const hist = n ? `<div class="endhead"><button type="button" class="endfold" data-act="history">${IC.hist}<span>Workerihistoria · ${n}</span>${IC.chev}</button></div>` : '';
  return `${liveBlock(f)}${decide}${hist}`;
}

// ---------- The worker pill ----------
function strip(f) {
  const marks = f.live.length ? `<span class="marks">${f.live.map(mark).join('')}</span>` : '<span class="n">0</span>';
  const attn = f.attention.length ? '<span class="corner attn" aria-hidden="true"></span>' : '';
  const s = [`Workerit: ${f.live.length ? `${f.live.length} työskentelee` : 'ei työskentele'}`, f.attention.length ? `${f.attention.length} odottaa päätöstä, työ tallessa` : ''].filter(Boolean).join(', ');
  const pill = `<button type="button" class="pill${f.live.length ? '' : ' idle'}" data-act="pill" data-testid="chip-spin" aria-expanded="${S.open}" aria-label="${esc(s)}" title="${esc(s)}"><span class="ic">${IC.branch}</span>${marks}${attn}</button>`;
  const body = [panelKuittaus, panelRatkaisu, panelSiivous][S.v](f);
  const pop = S.open ? `<div class="pop" data-testid="panel" data-variant="${V[S.v]}"><div class="tabs" role="tablist" aria-label="Taustatyö"><button type="button" role="tab" class="tab" aria-selected="true">${IC.branch}Workerit<span class="tab-n">${f.live.length}</span></button><button type="button" class="icon-btn x" data-act="close" aria-label="Sulje">${IC.x}</button></div><div class="pop-body" role="tabpanel">${body}</div></div>` : '';
  return `<section class="strip" aria-label="Taustatyö"><div class="strip-wrap">${pop}<div class="badges" role="group" aria-label="Taustatyö">${pill}</div></div></section>`;
}

// ---------- Requests to the main agent ----------
// The browser only drafts; the person sends. The agent, running as the person, runs the
// Taskfleet or Git command named in the draft.
function requestText(r, act) {
  const id = `${r.title} (${r.rid})`;
  if (act === 'merge' && r.st === 'interrupted') return `Vie workerin ”${id}” nykyinen tila perille: taskfleet run salvage. Kerro, jos testit eivät mene läpi.`;
  if (act === 'merge') return `Vie workerin ”${id}” työ perille: rebasea haara ${r.branch} mainin päälle, ratkaise törmäykset ja mergeä. Taskfleet ei mergeä ${r.st === 'cancelled' ? 'perutun' : 'päättyneen'} ajon haaraa, joten tee se Gitillä ja poista sitten haara ja worktree.`;
  if (act === 'continue') return `Käynnistä uusi worker jatkamaan workerin ”${id}” työtä haarasta ${r.branch}. Sen raportti: ${r.summary}`;
  if (act === 'resume') return `Jatka keskeytynyttä workeria ”${id}”: taskfleet run reattach. Jos worker ei herää, kerro.`;
  return `Hylkää workerin ”${id}” työ: ${actions(r).find(a => a.id === 'discard').runs}. Haara ${r.branch} poistuu pysyvästi.`;
}
const OUTCOME = {
  merge: (r) => [`Rebasesin haaran ${r.branch} mainin päälle ja mergesin sen; KOKEILTAVAA.md:n törmäys ratkesi ottamalla molemmat kohdat. Haara ja worktree on poistettu.`, { st: 'merged', byHand: true, preserved: false }],
  continue: (r) => [`Käynnistin workerin ”${r.title} (jatko)” haarasta ${r.branch}. Vanha ajo jää historiaan.`, { st: 'continued', preserved: false }],
  resume: (r) => ['Käynnistin ajon valvojan uudelleen (taskfleet run reattach), ja worker jatkaa siitä, mihin jäi.', { st: 'working', waits: false, age: '0 min', end: undefined, preserved: false }],
  discard: (r) => [`Hylkäsin työn. Haara ${r.branch} ja sen worktree on poistettu.`, { st: 'discarded', preserved: false }],
};

// ---------- The conversation ----------
const user = (t) => `<div class="msg user"><div class="bubble">${esc(t)}</div></div>`;
const agent = (t) => `<div class="msg agent"><p>${esc(t)}</p></div>`;
function thread() {
  const base = S.scene === 'b'
    ? [user('Aja test-guide: worker-näkymän koe workerille.'), agent('Worker päättyi klo 07.36 mergeämättä: main oli edennyt, ja KOKEILTAVAA.md törmäsi. Työ on tallessa haarassa.')]
    : [user('Aja iltakierros workereille ja kerro, mitä jäi auki.'),
      agent('Kuvien pakkaus laskeutui. Worker-näkymän koe päättyi mergeämättä ja Lomakkeen saavutettavuuden perin, kun suunta muuttui; kummankin työ on tallessa haarassa. Sääaseman CSV-vienti keskeytyi palvelimen uudelleenkäynnistykseen. Vanhan rajapinnan poisto epäonnistui ilman tallessa olevaa työtä.'),
      agent('Kastelun ajastus on käynnissä, ja odotan sitä taustalla.')];
  return `<div class="thread">${[...base, ...S.sent.map(([who, t]) => who === 'u' ? user(t) : agent(t))].join('')}</div>`;
}

// ---------- The worker's own view ----------
function workerView(r) {
  const ended = !!r.end;
  const tab = S.tab ?? (ended ? 'report' : 'conv');
  const tabs = ended ? [['report', 'Raportti'], ...(hasWork(r) ? [['changes', 'Muutokset']] : []), ['conv', 'Keskustelu']] : [['conv', 'Keskustelu'], ['term', 'Pääte']];
  const tabsHtml = `<div class="wv-tabs" role="tablist" aria-label="Workerin näkymä">${tabs.map(([k, l]) => `<button type="button" role="tab" class="tab" data-act="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}</div>`;
  const band = `<div class="wv-band" data-testid="worker-view"><button type="button" class="wv-back" data-act="back">${IC.back}Iltakierros</button><div class="wv-id"><span class="wv-kind">Worker</span><strong>${esc(r.title)}</strong></div><div class="wv-meta"><span class="mark">${mark(r)}</span><span class="w-word" data-tone="${tone(r)}">${stateWord(r)}</span><span class="sep">·</span>${r.h} · ${esc(r.prof)}<span class="sep">·</span><span class="mono">${esc(r.repo)}</span></div>${tabsHtml}</div>`;
  let body;
  if (tab === 'report') {
    body = `<div class="thread"><div class="wv-result" data-tone="${tone(r)}"><span class="mark">${mark(r)}</span><div><strong>${esc(stateSentence(r))}</strong><p>${esc(r.summary)}</p></div></div>
<dl class="wv-facts"><dt>Haara</dt><dd class="mono">${hasWork(r) ? esc(r.branch) : `<s>${esc(r.branch)}</s> <span class="muted">(poistettu)</span>`}</dd>${hasWork(r) ? `<dt>Worktree</dt><dd class="mono">~/src/${esc(r.repo)}__worktrees/${esc(r.branch.slice(3))}</dd>` : ''}<dt>Taskfleet</dt><dd class="mono">${esc(r.was?.tf ?? r.tf ?? '')}</dd></dl></div>`;
  } else if (tab === 'changes') {
    const d = r.diff;
    body = `<div class="thread"><p class="wv-why">Haara <span class="mono">${esc(r.branch)}</span> verrattuna kohteeseen <span class="mono">main</span>: ${count(d.files.length, 'tiedosto', 'tiedostoa')}, <span class="add">+${d.add}</span> <span class="del">−${d.del}</span>.</p><ul class="diff" data-testid="diff">${d.files.map(([p, a, x]) => `<li><span class="mono">${esc(p)}</span><span class="add">+${a}</span><span class="del">−${x}</span></li>`).join('')}</ul><button type="button" class="btn" data-act="do" data-do="editor" data-id="${r.id}">${IC.folder}Avaa worktree editorissa</button></div>`;
  } else {
    body = `<div class="thread"><div class="msg user brief"><div class="bubble"><span class="who">Pääagentti · tehtävä</span>${esc(r.title)}: tee muutos haarassa <span class="mono">${esc(r.branch)}</span>, aja testit ja vie perille.</div></div><div class="msg agent"><span class="who">Worker</span><p>${esc(r.summary ?? 'Testit kirjoitettu; toteutus on puolivälissä.')}</p></div></div>`;
  }
  const foot = ended && (actions(r).length > 1 || S.v === 0)
    ? `<div class="wv-decide" data-testid="worker-decide"><p class="wv-decide-head"><strong>${hasWork(r) ? 'Mitä tälle työlle tehdään?' : 'Ei päätettävää.'}</strong> Workerille ei kirjoiteta suoraan; pyynnöt menevät pääagentille.</p>${actionList(r, 'worker')}</div>`
    : `<div class="wv-notice"><p><strong>Workerille ei kirjoiteta suoraan.</strong> ${ended ? 'Pääagentilla on sen raportti.' : 'Pääagentti voi lähettää sille viestin.'}</p><button type="button" class="btn quiet" data-act="back">Kysy pääkeskustelussa ›</button></div>`;
  return `<div class="topbar"><button type="button" class="icon-btn menu" aria-label="Avaa valikko">${IC.menu}</button><div class="title"><strong>${esc(r.title)}</strong><span class="mono">${esc(r.repo)}</span></div><button type="button" class="icon-btn" aria-label="Tiedot">${IC.info}</button></div>
${band}<div class="scroll">${body}</div>${foot}`;
}

// ---------- Frame ----------
function rail(f) {
  const row = (t, m, cur) => `<a href="#" class="conv${cur ? ' cur' : ''}" data-act="${cur ? 'back' : 'toast'}" data-msg="Vain Iltakierros on auki tässä kokeessa."${cur ? ' aria-current="page"' : ''}><span>${t}</span>${m}</a>`;
  return `<aside class="rail" aria-label="Työtilat"><div class="brand">Habitat</div><div class="ws">${HOME}</div>
${row('Iltakierros', f.live.some(r => r.waited) ? '<span class="bgw-dot" role="img" aria-label="Odottaa taustatyötä"></span>' : '<span class="wait-ring" role="img" aria-label="Odottaa sinua"></span>', true)}
${row('Sääaseman kalibrointi', `<span class="done">${IC.check}</span>`)}
<div class="ws">kirjasto</div>${row('Hakusanojen negaatiot', '<span class="wait-ring" role="img" aria-label="Odottaa sinua"></span>')}</aside>`;
}
function composer() {
  const d = S.draft;
  const chip = d ? `<div class="draft" data-testid="draft"><span class="draft-ic">${IC.msg}</span><p><strong>Pyyntö pääagentille</strong> · ${esc(d.label)}. Agentti ajaa: <span class="mono">${esc(d.runs)}</span>. Mitään ei tapahdu ennen kuin lähetät.</p><button type="button" class="icon-btn" data-act="draft-x" aria-label="Hylkää luonnos">${IC.x}</button></div>` : '';
  return `<div class="composer">${chip}<div class="cbox"><textarea aria-label="Viesti" placeholder="Kirjoita agentille…" rows="${d ? 3 : 1}">${d ? esc(d.text) : ''}</textarea><button type="button" class="icon-btn send" data-act="send" aria-label="Lähetä">${IC.send}</button></div></div>`;
}
function view() {
  const f = facts();
  const r = S.worker && byId(S.worker);
  let main;
  if (r) main = workerView(r);
  else {
    const state = f.live.some(x => x.waited) ? '<span class="state"><span class="bgw-dot"></span>Odottaa taustatyötä</span>' : '<span class="state"><span class="wait-ring"></span>Odottaa sinua</span>';
    main = `<div class="topbar"><button type="button" class="icon-btn menu" aria-label="Avaa valikko">${IC.menu}</button><div class="title"><strong>Iltakierros</strong><span class="mono">${HOME}</span></div>${state}<button type="button" class="icon-btn" aria-label="Tiedot">${IC.info}</button></div>
<div class="scroll">${thread()}</div>${strip(f)}${composer()}`;
  }
  return `<div class="app v-${V[S.v]}" data-variant="${V[S.v]}">${rail(f)}<div class="main${r ? ' worker' : ''}">${main}<p class="toast" role="status">${esc(S.note)}</p></div></div>`;
}
function repaint(focusSel) {
  const el = document.getElementById('stage');
  const sc = el.querySelector('.pop-body')?.scrollTop;
  el.innerHTML = view();
  const body = el.querySelector('.pop-body'); if (body && sc) body.scrollTop = sc;
  const th = el.querySelector('.main:not(.worker) .scroll'); if (th) th.scrollTop = th.scrollHeight;
  if (focusSel) el.querySelector(focusSel)?.focus();
}
function doAction(id, act) {
  const r = byId(id);
  if (act === 'report' || act === 'changes') { S.worker = id; S.tab = act; S.open = false; S.acts = null; return '.wv-back'; }
  if (act === 'editor') { S.note = `Editori avaisi kansion ~/src/${r.repo}__worktrees/${r.branch.slice(3)}. Kokeessa se ei aukea.`; return null; }
  if (act === 'ack') { S.acked[id] = true; S.acts = null; return '.pop .x'; }
  const a = actions(r).find(x => x.id === act);
  S.draft = { id, act, label: a.label, runs: a.runs, text: requestText(r, act) };
  S.open = false; S.acts = null; S.worker = null;
  return '.cbox textarea';
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('#stage [data-act]'); if (!t) return;
  e.preventDefault();
  const a = t.dataset.act, id = t.dataset.id; let focus = null;
  S.note = '';
  if (a === 'pill') { S.open = !S.open; S.history = false; focus = '.pill[data-act="pill"]'; }
  else if (a === 'close') { S.open = false; focus = '.pill[data-act="pill"]'; }
  else if (a === 'fold') { if (t.dataset.key === 'acked') S.acksOpen = !S.acksOpen; else S.ended = !S.ended; focus = `.endfold[data-key="${t.dataset.key}"]`; }
  else if (a === 'acts') { S.acts = S.acts === id ? null : id; S.confirmAck = null; focus = `.more[data-id="${id}"]`; }
  else if (a === 'ack') { if (hasWork(byId(id))) { S.confirmAck = id; focus = '.confirm .btn'; } else { S.acked[id] = true; focus = '.pop .x'; } }
  else if (a === 'ack-yes') { S.acked[id] = true; S.confirmAck = null; S.acts = null; S.note = 'Rivi kuitattiin. Työ on yhä haarassa.'; focus = '.pop .x'; }
  else if (a === 'ack-no') { S.confirmAck = null; }
  else if (a === 'unack') { delete S.acked[id]; focus = '.pop .x'; }
  else if (a === 'history') { S.history = true; focus = '.hist-head .wv-back'; }
  else if (a === 'hist-back') { S.history = false; focus = '.endfold'; }
  else if (a === 'do') focus = doAction(id, t.dataset.do);
  else if (a === 'draft-x') { S.draft = null; focus = '.cbox textarea'; }
  else if (a === 'send') {
    const d = S.draft;
    if (!d) { S.note = 'Kokeessa vapaata viestiä ei lähetetä; kokeile pyyntöä workerin toiminnoista.'; }
    else {
      const r = byId(d.id); const [reply, change] = OUTCOME[d.act](r);
      S.sent.push(['u', document.querySelector('.cbox textarea').value], ['a', reply]);
      S.resolved[d.id] = change;
      if (d.act === 'continue') S.extra.push({ id: 'n' + d.id, title: `${r.title} (jatko)`, st: 'working', waits: false, age: '0 min', h: r.h, prof: r.prof, repo: r.repo, branch: r.branch });
      S.draft = null;
      S.note = [
        'Kuittaus: rivi jää Päättyneisiin uudella tilallaan, kunnes kuittaat sen.',
        'Ratkaisu: haaraa ei enää ole, joten rivi poistuu vuorokauden kuluttua.',
        'Siivous: rivi siirtyi Workerihistoriaan.',
      ][S.v];
    }
  }
  else if (a === 'worker') { S.worker = id; S.tab = null; S.open = false; S.acts = null; focus = '.wv-back'; }
  else if (a === 'back') { if (!S.worker) return; S.worker = null; S.open = true; focus = '.pop .x'; }
  else if (a === 'tab') { S.tab = t.dataset.tab; focus = `.wv-tabs [data-tab="${t.dataset.tab}"]`; }
  else if (a === 'toast') { S.note = t.dataset.msg; }
  repaint(focus);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.open) { S.open = false; repaint('.pill[data-act="pill"]'); }
});
const theme = document.getElementById('theme');
const setTheme = (t) => { document.documentElement.dataset.theme = t; theme.textContent = t === 'dark' ? 'Vaalea' : 'Tumma'; };
setTheme(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
theme.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
document.getElementById('scene').addEventListener('change', (e) => { S.scene = e.target.value; Object.assign(S, fresh()); repaint(); });
document.getElementById('later').addEventListener('change', (e) => { S.later = e.target.checked; repaint(); });
const start = (i) => () => { Object.assign(S, { v: i }, fresh()); return view(); };
window.PROTO = { S, repaint };
window.variants = V.map((_, i) => start(i));
})();
const variants = window.variants;
