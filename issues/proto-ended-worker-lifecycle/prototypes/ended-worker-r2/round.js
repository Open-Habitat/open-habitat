// Päättyneet workerit, kierros 2 (proto-ended-worker-lifecycle). Synthetic names and data only.
// Jari 28.10.2026 after round 1: no acknowledgement. The list reflects real state: a row exists
// while its worker runs or while its branch or worktree is on disk, and disappears when the
// agent has cleaned them up. An unfinished row carries a red ball, and the typical reaction is
// to tell the agent something: a request drafted into the parent conversation's composer. Base:
// round 1's Ratkaisu without the day-long grace.
//
// Production context: the Workerit panel after worker-panel-rivi (two-line rows), the worker
// pill above the composer (Merkit, Pisteet) and the worker's own view. One conversation
// (Iltakierros, repository kasvimaa) with two live workers and four ended rows: not merged
// with work preserved (Jari's pilot.456 case), cancelled with work, interrupted but resumable,
// and merged by hand with its worktree left. Landed and failed-without-work runs are lab
// events: the live row ends and, having nothing left on disk, leaves the list.
//
// The variants differ on one axis: what the browser removes itself.
//   1 Pyyntö      — nothing. Every change to the work is a request to the main agent.
//   2 Yhdistetty  — only a worktree whose branch is already merged, through the existing
//                   worktree_remove (ADR 0025): checkout and branch go, nothing is lost.
//   3 Worktree    — any worktree the existing flow accepts. For an unmerged branch it removes
//                   the checkout and keeps the branch, so the row and its red ball stay.
// The requests are the same in all three. The browser never merges, discards or cancels a run.
(() => {
const SVG = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IC = {
  branch: SVG('<circle cx="7" cy="6" r="2"/><path d="M7 8v10"/><path d="M7 12c0 3 3 4 7 4"/><circle cx="17" cy="16" r="2"/>'),
  stop: SVG('<rect x="7" y="7" width="10" height="10" rx="1.5"/>'),
  x: SVG('<path d="M6 6l12 12M18 6 6 18"/>'),
  check: SVG('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  merge: SVG('<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 8v8"/><path d="M6 8c0 3 4 4 10 4"/>'),
  chev: SVG('<path d="m9 6 6 6-6 6"/>'),
  back: SVG('<path d="m15 6-6 6 6 6"/>'),
  menu: SVG('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  send: SVG('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  info: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5h.01"/>'),
  eye: SVG('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>'),
  msg: SVG('<path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 17H10l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 5z"/>'),
  pen: SVG('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  trash: SVG('<path d="M4 7h16"/><path d="M9 7V4.5h6V7"/><path d="M6.5 7l1 12.5h9l1-12.5"/><path d="M10 11v5M14 11v5"/>'),
  folder: SVG('<path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17z"/>'),
  lock: SVG('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
};
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const V = ['pyynto', 'yhdistetty', 'worktree'];
const HOME = 'kasvimaa';
const fresh = () => ({ open: false, ended: false, menu: null, resolved: {}, worker: null, tab: null, draft: null, sent: [], note: '', extra: [], events: {}, dialog: null });
const S = { v: 0, scene: 'a', ...fresh() };

// ---------- Facts: what the host would know ----------
// tf: Taskfleet's word for the run (run show: status, landed, preserved_work).
// wt: the worktree as the existing worktree_list reads it from Git (state merged / unmerged /
// dirty, ahead, changed, blockers). Today the spinoffs contract carries neither the split of
// done/cancelled/interrupted nor the worktree's state; result.md lists what each needs.
const ALL = [
  { id: 'w1', title: 'Kastelun ajastus', st: 'working', waits: true, age: '12 min', h: 'Pi', prof: 'oletus', repo: HOME, branch: 'wt/ka2r-kastelun-ajastus' },
  { id: 'w2', title: 'Vanhan rajapinnan poisto', st: 'working', waits: false, age: '31 min', h: 'Claude', prof: 'tarkka', repo: 'kirjasto', branch: 'wt/t2v9-vanha-rajapinta' },
  { id: 'e2', rid: '01m5yq1t6wkd3r8n2c4h7pqa0e', title: 'test-guide: worker-näkymän koe', st: 'unmerged', branchOn: true, worktreeOn: true, end: '07.36', h: 'Pi', prof: 'builtin', repo: HOME, branch: 'wt/5yq1-test-guide-worker-nakyma',
    tf: 'done · landed: false', wt: { state: 'unmerged', ahead: 3, changed: 0 },
    summary: 'Worker-näkymän koe on tehty ja havainnot kirjattu KOKEILTAVAA.md:hen. En mergennyt: main oli edennyt, ja KOKEILTAVAA.md törmäsi toisen workerin muutokseen.',
    diff: { add: 42, del: 7, files: [['KOKEILTAVAA.md', 31, 5], ['issues/worker-view-conversation/result.md', 9, 2], ['web/tests/worker-view.spec.ts', 2, 0]] } },
  { id: 'e4', rid: '01m5b5q3ndz4k7c1p8v6h2tm9r', title: 'Lomakkeen saavutettavuus', st: 'cancelled', branchOn: true, worktreeOn: true, end: '13.12', h: 'Claude', prof: 'tarkka', repo: HOME, branch: 'wt/b5q3-lomakkeen-saavutettavuus',
    tf: 'cancelled', wt: { state: 'dirty', ahead: 1, changed: 2 },
    summary: 'Pääagentti perui ajon, kun lomakkeen rakenne päätettiin tehdä toisin. Kenttäotsikoiden korjaukset jäivät haaraan, ja kaksi tiedostoa on muutettu commitoimatta.',
    diff: { add: 18, del: 11, files: [['web/src/components/Lomake.tsx', 14, 9], ['web/src/components/Lomake.test.tsx', 4, 2]] } },
  { id: 'e5', rid: '01m5r7c1xa2f9w6n3q8k5d1tb7', title: 'Sääaseman CSV-vienti', st: 'interrupted', branchOn: true, worktreeOn: true, end: '11.05', h: 'Pi', prof: 'oletus', repo: HOME, branch: 'wt/r7c1-saaasema-csv',
    tf: 'running · valvoja ei käynnissä', wt: { state: 'unmerged', ahead: 2, changed: 0, blocked: true },
    summary: 'Ajo keskeytyi, kun palvelin käynnistettiin uudelleen. Worker oli kirjoittanut testit ja puolet toteutuksesta.',
    diff: { add: 64, del: 3, files: [['src/vienti/csv.ts', 41, 0], ['src/vienti/csv.test.ts', 23, 0], ['src/vienti/index.ts', 0, 3]] } },
  { id: 'e1', rid: '01m5k8h2pcv6t1m9x3d5r2wq8b', title: 'Kuvien pakkaus', st: 'merged', byHand: true, branchOn: true, worktreeOn: true, end: '13.41', h: 'Pi', prof: 'oletus', repo: HOME, branch: 'wt/k8h2-kuvien-pakkaus',
    tf: 'done · landed: false', wt: { state: 'merged', ahead: 0, changed: 0 },
    summary: 'Agentti mergesi haaran Gitillä mainiin, kun Taskfleet ei voinut. Haara ja worktree jäivät levylle.' },
];
const LIVE = ['working'];
// Lab events: a live worker ends, and Taskfleet leaves nothing on disk.
const EVENTS = {
  land: { id: 'w1', label: 'Kastelu laskeutuu', change: { st: 'merged', branchOn: false, worktreeOn: false, end: '14.02', tf: 'done · landed: true' },
    reply: 'Kastelun ajastus laskeutui mainiin klo 14.02 (taskfleet run merge). Haara ja worktree on poistettu.' },
  fail: { id: 'w2', label: 'Rajapinta epäonnistuu', change: { st: 'failed', branchOn: false, worktreeOn: false, end: '14.05', tf: 'failed' },
    reply: 'Vanhan rajapinnan poisto epäonnistui klo 14.05: kaksi kutsujaa käyttää yhä vanhaa rajapintaa, eikä worker jättänyt tallennettavaa työtä. Ehdotan, että poistetaan ensin kutsut.' },
};
function runs() {
  const base = S.scene === 'b' ? ALL.filter(r => r.id === 'e2') : ALL;
  return [...base, ...S.extra].map(r => {
    const x = S.resolved[r.id];
    return x ? { ...r, ...x, was: r } : { ...r };
  });
}
const onDisk = (r) => !!(r.branchOn || r.worktreeOn);
// Keskeneräinen: there is work on disk that has not reached the source branch.
const unfinished = (r) => !LIVE.includes(r.st) && onDisk(r) && r.st !== 'merged';
function facts() {
  const all = runs();
  const live = all.filter(r => LIVE.includes(r.st));
  // Real state: an ended row is listed only while its branch or worktree exists.
  const ended = all.filter(r => !LIVE.includes(r.st) && onDisk(r));
  return { all, live, ended, open: ended.filter(unfinished) };
}
const byId = (id) => runs().find(r => r.id === id);

// ---------- Words ----------
function stateWord(r) {
  if (r.st === 'working') return r.waits ? 'agentti odottaa' : 'agentti ei odota';
  if (r.st === 'merged') return r.worktreeOn ? 'mergetty · worktree jäljellä' : 'mergetty · haara jäljellä';
  const kept = r.worktreeOn ? 'työ tallessa' : 'haara tallessa, worktree poistettu';
  if (r.st === 'unmerged') return `ei mergetty · ${kept}`;
  if (r.st === 'cancelled') return `peruttu · ${kept}`;
  if (r.st === 'interrupted') return 'keskeytyi · jatkettavissa';
  return 'epäonnistui';
}
function stateSentence(r) {
  if (r.st === 'working') return r.waits ? 'Agentti odottaa tätä workeria ja jatkaa, kun se valmistuu.' : 'Agentti ei odota tätä workeria.';
  if (r.st === 'merged') return `Työ on mainissa, mutta ${r.worktreeOn ? 'haara ja worktree ovat' : 'haara on'} yhä levyllä.`;
  const where = r.worktreeOn ? 'haarassa ja worktreessä' : 'haarassa; worktree on poistettu';
  if (r.st === 'unmerged') return `Päättyi klo ${r.end} mergeämättä. Työ on tallessa ${where}.`;
  if (r.st === 'cancelled') return `Peruttiin klo ${r.end}. Työ on tallessa ${where}.`;
  if (r.st === 'interrupted') return `Keskeytyi klo ${r.end}. Worktree on tallessa, ja ajoa voi jatkaa.`;
  return `Epäonnistui klo ${r.end}.`;
}
const tone = (r) => r.st === 'working' ? (r.waits ? 'wait' : 'muted') : r.st === 'merged' ? 'ok' : unfinished(r) ? 'err' : 'muted';
const ball = '<span class="ball" role="img" aria-label="Keskeneräinen"></span>';
function mark(r) {
  if (r.st === 'working') return r.waits ? '<span class="bgw-dot"></span>' : '<span class="nowait-dot"></span>';
  if (r.st === 'merged') return `<span class="mark-ic ok">${IC.merge}</span>`;
  if (unfinished(r)) return ball;
  return `<span class="mark-ic">${IC.check}</span>`;
}
const when = (r) => r.end ?? r.age;
const repoTag = (r) => r.repo !== HOME ? `<span class="sep">·</span><span class="tag repo" title="Toinen repositorio kuin tämä keskustelu">${esc(r.repo)}</span>` : '';
const wtName = (r) => `wt-${r.branch.slice(3)}`;
const wtPath = (r) => `~/src/${r.repo}__worktrees/${wtName(r)}`;

// ---------- Requests: the same in every variant ----------
// Each names what the main agent will run as the person. Taskfleet refuses discard and
// salvage for a done run (round 1's dry-runs), so a done run's branch is settled with Git.
function requests(r) {
  if (r.st === 'merged') return [{ id: 'cleanup', label: 'Pyydä siivoamaan', runs: 'git worktree remove + git branch -d (haara on jo mainissa)' }];
  const a = [];
  if (r.st === 'interrupted') {
    a.push({ id: 'resume', label: 'Pyydä jatkamaan samaa ajoa', runs: `taskfleet run reattach ${r.rid}` });
    a.push({ id: 'merge', label: 'Pyydä viemään nykyinen tila perille', runs: `taskfleet run salvage ${r.rid}` });
  } else {
    a.push({ id: 'merge', label: 'Pyydä mergeämään', runs: 'git rebase + merge, sitten haaran ja worktreen poisto' });
    a.push({ id: 'continue', label: 'Uusi worker samasta haarasta', runs: `taskfleet run create (haarasta ${r.branch})` });
  }
  a.push({ id: 'discard', label: 'Pyydä hylkäämään työ', danger: true,
    runs: r.st === 'cancelled' ? `taskfleet run discard ${r.rid}`
      : r.st === 'interrupted' ? `taskfleet run cancel ${r.rid}, sitten run discard`
      : `git branch -D${r.worktreeOn ? ' + git worktree remove' : ''} (Taskfleet hylkää vain epäonnistuneen tai perutun ajon)` });
  return a;
}

// ---------- The browser's own removal, per variant ----------
// The existing flow (WorktreeCleanup → worktree_remove) accepts a worktree whose run has ended
// for Taskfleet (done, cancelled, failed) and refuses one a live run owns. Its disposal follows
// Git's state: merged → remove checkout and branch; unmerged → remove checkout, keep branch;
// dirty → commit to the branch and remove, or force.
function removal(r) {
  if (!r.worktreeOn || !r.wt || S.v === 0) return null;
  if (r.wt.blocked) return S.v === 2 ? { blocked: true } : null;
  if (S.v === 1 && r.wt.state !== 'merged') return null;
  return { state: r.wt.state };
}
function removalNote(r) {
  if (S.v === 0) return 'Selain ei poista mitään itse. Rivi poistuu, kun agentti on poistanut haaran ja worktreen.';
  if (S.v === 1) return r.st === 'merged' ? 'Haara on jo mainissa, joten selain voi poistaa worktreen ja haaran itse.' : 'Selain poistaa itse vain worktreen, jonka haara on jo mergetty. Tämän haaraa ei ole.';
  if (r.wt?.blocked) return `Worktreetä ei voi poistaa selaimesta: Taskfleet-ajo ${r.rid.slice(0, 10)}… omistaa sen, koska ajo ei ole Taskfleetin mukaan päättynyt.`;
  if (!r.worktreeOn) return 'Worktree on poistettu. Haara on yhä olemassa, joten rivi ja punainen pallo jäävät.';
  return r.st === 'merged' ? 'Haara on jo mainissa: Poista worktree vie myös haaran.' : 'Poista worktree jättää haaran, joten rivi ja punainen pallo jäävät, kunnes agentti mergeää tai hylkää sen.';
}

// ---------- Rows ----------
function menu(r, where) {
  const reqs = requests(r);
  const btn = (a) => `<button type="button" class="act${a.danger ? ' danger' : ''}" data-act="ask" data-do="${a.id}" data-id="${r.id}">${IC.msg}<span class="act-l"><span>${esc(a.label)}</span><span class="act-runs mono">${esc(a.runs)}</span></span></button>`;
  const own = `<button type="button" class="act own" data-act="ask" data-do="own" data-id="${r.id}">${IC.pen}<span class="act-l"><span>Kirjoita oma viesti</span><span class="act-runs">Kenttään tulee viittaus tähän workeriin</span></span></button>`;
  const views = `<div class="view-links"><button type="button" class="link" data-act="view" data-do="report" data-id="${r.id}">${IC.eye}Raportti</button>${r.diff && r.st !== 'merged' ? `<button type="button" class="link" data-act="view" data-do="changes" data-id="${r.id}">${IC.eye}Muutokset <span class="add">+${r.diff.add}</span> <span class="del">−${r.diff.del}</span></button>` : ''}${r.worktreeOn ? `<button type="button" class="link" data-act="view" data-do="editor" data-id="${r.id}">${IC.folder}Worktree editorissa</button>` : ''}</div>`;
  const rm = removal(r);
  const rmBtn = where === 'worker' && rm && !rm.blocked ? `<button type="button" class="btn rm" data-act="remove" data-id="${r.id}">${IC.trash}Poista worktree…</button>` : '';
  return `<div class="acts" data-testid="requests" data-where="${where}"><div class="act-group" data-kind="ask"><p class="act-kind">Kerro pääagentille · luonnos kenttään, sinä lähetät</p><div class="act-items">${reqs.map(btn).join('')}${own}</div></div>${views}<p class="act-leave" data-testid="removal-note">${rm?.blocked ? IC.lock : ''}${esc(removalNote(r))}</p>${rmBtn}</div>`;
}
function row(r) {
  const word = `<span class="w-word" data-tone="${tone(r)}">${stateWord(r)}</span>`;
  const sub = `${word}<span class="sep">·</span>${r.h} · ${esc(r.prof)}${repoTag(r)}`;
  const main = `<button type="button" class="row-main" data-act="worker" data-id="${r.id}" aria-label="${esc(`${r.title}: ${stateSentence(r)} Avaa workerin näkymä.`)}"><span class="mark">${mark(r)}</span><span class="lines"><span class="line1"><span class="name">${esc(r.title)}</span><span class="meta">${when(r)}</span></span><span class="line2">${sub}</span></span></button>`;
  const open = S.menu === r.id;
  let side = '';
  if (r.st === 'working') side = `<button type="button" class="icon-btn stop" aria-label="Lopeta odotus: ${esc(r.title)}" data-act="toast" data-msg="Odotuksen lopetus kuuluu aiempaan kierrokseen.">${IC.stop}</button>`;
  else {
    const rm = removal(r);
    const trash = rm && !rm.blocked ? `<button type="button" class="icon-btn rm" data-act="remove" data-id="${r.id}" aria-label="Poista worktree: ${esc(r.title)}" title="Poista worktree">${IC.trash}</button>` : '';
    side = `${trash}<button type="button" class="btn sm tell" data-act="menu" data-id="${r.id}" aria-expanded="${open}" aria-label="Kerro agentille: ${esc(r.title)}">${IC.msg}<span>Kerro agentille</span></button>`;
  }
  return `<div class="row two${open ? ' open' : ''}" data-run="${r.id}" data-state="${r.st}" data-unfinished="${unfinished(r)}"><div class="row-line">${main}${side}</div>${open ? menu(r, 'row') : ''}</div>`;
}
const group = (label, list) => `<div class="group" role="group" aria-label="${label}">${list.map(row).join('')}</div>`;
function panel(f) {
  const live = f.live.length ? group('Workerit: käynnissä', f.live) : '<p class="empty">Ei työskenteleviä workereita.</p>';
  if (!f.ended.length) return live;
  const rows = [...f.ended.filter(unfinished), ...f.ended.filter(r => !unfinished(r))];
  const head = `<div class="endhead"><button type="button" class="endfold" data-act="fold" aria-expanded="${S.ended}">${IC.chev}<span>${count(f.ended.length, 'päättynyt', 'päättynyttä')}</span>${f.open.length && !S.ended ? '<span class="attn-dot" role="img" aria-label="Keskeneräisiä"></span>' : ''}</button></div>`;
  const rule = '<p class="life" data-testid="rule">Päättynyt worker näkyy täällä niin kauan kuin sen haara tai worktree on olemassa.</p>';
  return `${live}${head}${S.ended ? group('Workerit: päättyneet', rows) + rule : ''}`;
}

// ---------- The worker pill ----------
// One mark per live worker (Pisteet) and one red ball per unfinished row, so an idle pill no
// longer reads "0". The pill is gone when there is nothing to list.
function strip(f) {
  if (!f.live.length && !f.ended.length) return '';
  const balls = f.open.slice(0, 3).map(() => '<span class="ball"></span>').join('') + (f.open.length > 3 ? `<span class="more-n">+${f.open.length - 3}</span>` : '');
  const marks = `<span class="marks">${f.live.map(mark).join('')}${balls}</span>`;
  const idleDone = !f.live.length && !f.open.length ? '<span class="n">✓</span>' : '';
  const s = [`Workerit: ${f.live.length ? `${f.live.length} työskentelee` : 'ei työskentele'}`, f.open.length ? `${count(f.open.length, 'keskeneräinen', 'keskeneräistä')}, työ tallessa` : '', f.ended.length - f.open.length ? `${f.ended.length - f.open.length} siivottavana` : ''].filter(Boolean).join(', ');
  const pill = `<button type="button" class="pill${f.live.length ? '' : ' idle'}" data-act="pill" data-testid="chip-spin" aria-expanded="${S.open}" aria-label="${esc(s)}" title="${esc(s)}"><span class="ic">${IC.branch}</span>${f.live.length || f.open.length ? marks : idleDone}</button>`;
  const pop = S.open ? `<div class="pop" data-testid="panel" data-variant="${V[S.v]}"><div class="tabs" role="tablist" aria-label="Taustatyö"><button type="button" role="tab" class="tab" aria-selected="true">${IC.branch}Workerit<span class="tab-n">${f.live.length}</span></button><button type="button" class="icon-btn x" data-act="close" aria-label="Sulje">${IC.x}</button></div><div class="pop-body" role="tabpanel">${panel(f)}</div></div>` : '';
  return `<section class="strip" aria-label="Taustatyö"><div class="strip-wrap">${pop}<div class="badges" role="group" aria-label="Taustatyö">${pill}</div></div></section>`;
}

// ---------- Drafts to the main agent ----------
function requestText(r, act) {
  const id = `${r.title} (${r.rid})`;
  if (act === 'own') return `Workerista ”${id}”: `;
  if (act === 'cleanup') return `Workerin ”${id}” haara ${r.branch} on jo mainissa. Poista sen worktree ja haara.`;
  if (act === 'merge' && r.st === 'interrupted') return `Vie workerin ”${id}” nykyinen tila perille: taskfleet run salvage. Kerro, jos testit eivät mene läpi.`;
  if (act === 'merge') return `Vie workerin ”${id}” työ perille: rebasea haara ${r.branch} mainin päälle, ratkaise törmäykset ja mergeä. Taskfleet ei mergeä ${r.st === 'cancelled' ? 'perutun' : 'päättyneen'} ajon haaraa, joten tee se Gitillä ja poista sitten haara${r.worktreeOn ? ' ja worktree' : ''}.`;
  if (act === 'continue') return `Käynnistä uusi worker jatkamaan workerin ”${id}” työtä haarasta ${r.branch}${r.worktreeOn ? ', ja poista vanha worktree' : ''}. Sen raportti: ${r.summary}`;
  if (act === 'resume') return `Jatka keskeytynyttä workeria ”${id}”: taskfleet run reattach. Jos worker ei herää, kerro.`;
  return `Hylkää workerin ”${id}” työ: ${requests(r).find(a => a.id === 'discard').runs}. Haara ${r.branch} poistuu pysyvästi.`;
}
const GONE = { branchOn: false, worktreeOn: false };
const OUTCOME = {
  merge: (r) => [r.st === 'interrupted' ? 'Ajoin taskfleet run salvage; testit menivät läpi, ja työ laskeutui mainiin. Taskfleet poisti haaran ja worktreen.' : `Rebasesin haaran ${r.branch} mainin päälle ja mergesin sen; KOKEILTAVAA.md:n törmäys ratkesi ottamalla molemmat kohdat. Haara${r.worktreeOn ? ' ja worktree on' : ' on'} poistettu.`, { st: 'merged', ...GONE }],
  continue: (r) => [`Käynnistin workerin ”${r.title} (jatko)” haarasta ${r.branch}. Vanhan ajon worktree on poistettu, ja haara on nyt uuden workerin.`, GONE],
  resume: () => ['Käynnistin ajon valvojan uudelleen (taskfleet run reattach), ja worker jatkaa siitä, mihin jäi.', { st: 'working', waits: false, age: '0 min', end: undefined }],
  discard: (r) => [`Hylkäsin työn. Haara ${r.branch}${r.worktreeOn ? ' ja sen worktree on' : ' on'} poistettu.`, GONE],
  cleanup: (r) => [`Poistin worktreen ja haaran ${r.branch}; työ on mainissa.`, GONE],
  own: (r) => [`Selvä, katson workerin ”${r.title}” tilanteen. (Kokeessa vapaa viesti ei muuta mitään.)`, null],
};

// ---------- The removal dialog (the existing WorktreeRemoveDialog's words) ----------
function dialog() {
  const d = S.dialog; if (!d) return '';
  const r = byId(d.id); const w = r.wt; const name = wtName(r);
  const facts = [w.changed ? count(w.changed, 'muutettu tiedosto', 'muutettua tiedostoa') : '', w.state !== 'dirty' && w.ahead ? `${count(w.ahead, 'commit', 'committia')}, joita ei ole haarassa main` : ''].filter(Boolean);
  const factList = facts.length ? `<ul class="facts">${facts.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  let title, lead, buttons;
  if (w.state === 'merged') {
    title = `Poistetaanko <code>${esc(name)}</code>?`;
    lead = `<p>Haara <code>${esc(r.branch)}</code> on yhdistetty haaraan <code>main</code>, joten worktreen hakemisto ja haara poistetaan. Mitään commitoitua ei häviä.</p>`;
    buttons = `<button type="button" class="btn primary" data-act="rm-do" data-disposal="remove">Poista</button>`;
  } else if (w.state === 'dirty' && d.disposal !== 'force') {
    title = `Tallennetaanko muutokset ja poistetaan <code>${esc(name)}</code>?`;
    lead = `<p>Kaikki muutokset ja uudet tiedostot commitoidaan haaraan <code>${esc(r.branch)}</code>, ja worktreen hakemisto poistetaan. Haara säilyy, joten työn saa takaisin komennolla <code>git worktree add</code>.</p>${factList}`;
    buttons = `<button type="button" class="btn primary" data-act="rm-do" data-disposal="commit">Tallenna ja poista</button><button type="button" class="btn quiet danger" data-act="rm-force">Poista pakolla…</button>`;
  } else if (d.disposal === 'force') {
    title = `Poistetaanko <code>${esc(name)}</code> pakolla?`;
    lead = `<p>Hakemisto poistetaan, ja nämä häviävät lopullisesti. Tätä ei voi perua.</p>${factList}<p class="sub">Haara <code>${esc(r.branch)}</code> ja sen commitit säilyvät.</p><label class="typed">Kirjoita worktreen nimi <input id="typed" autocomplete="off" spellcheck="false"></label>`;
    buttons = `<button type="button" class="btn primary danger" data-act="rm-do" data-disposal="force">Poista pakolla</button>`;
  } else {
    title = `Poistetaanko <code>${esc(name)}</code>?`;
    lead = `<p>Worktreen hakemisto poistetaan. Haara <code>${esc(r.branch)}</code> säilyy, joten sen commitit eivät häviä.</p>${factList}`;
    buttons = `<button type="button" class="btn primary" data-act="rm-do" data-disposal="remove">Poista</button>`;
  }
  const after = w.state === 'merged' ? 'Kun haara ja worktree ovat poissa, rivi poistuu Workerit-listasta.' : 'Haara jää, joten rivi ja punainen pallo jäävät listaan. Mergeäminen tai hylkääminen on agentin työtä: Kerro agentille.';
  return `<div class="scrim" data-act="rm-close"></div><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-t" data-testid="remove-dialog"><h2 id="dlg-t">${title}</h2>${lead}<p class="after" data-testid="remove-after">${esc(after)}</p><p class="err" role="alert">${esc(d.err ?? '')}</p><div class="d-actions">${buttons}<button type="button" class="btn quiet" data-act="rm-close">Peru</button></div></div>`;
}
function removeDone(r, disposal) {
  const name = wtName(r);
  if (r.wt.state === 'merged') {
    S.resolved[r.id] = { ...(S.resolved[r.id] ?? {}), ...GONE };
    return `${name} poistettu. Haara ${r.branch} poistettiin. Rivi poistui listasta.`;
  }
  S.resolved[r.id] = { ...(S.resolved[r.id] ?? {}), worktreeOn: false };
  const saved = disposal === 'commit' ? ' Muutokset tallennettiin haaraan commitiksi 3f9c2a1.' : '';
  return `${name} poistettu.${saved} Haara ${r.branch} säilyy, joten rivi jää.`;
}

// ---------- The conversation ----------
const user = (t) => `<div class="msg user"><div class="bubble">${esc(t)}</div></div>`;
const agent = (t) => `<div class="msg agent"><p>${esc(t)}</p></div>`;
function thread() {
  const base = S.scene === 'b'
    ? [user('Aja test-guide: worker-näkymän koe workerille.'), agent('Worker päättyi klo 07.36 mergeämättä: main oli edennyt, ja KOKEILTAVAA.md törmäsi. Työ on tallessa haarassa.')]
    : [user('Aja iltakierros workereille ja kerro, mitä jäi auki.'),
      agent('Worker-näkymän koe päättyi mergeämättä, ja Lomakkeen saavutettavuuden perin, kun suunta muuttui; kummankin työ on tallessa haarassa. Sääaseman CSV-vienti keskeytyi palvelimen uudelleenkäynnistykseen. Kuvien pakkauksen mergesin Gitillä, mutta en vielä siivonnut sen worktreetä.'),
      agent('Kastelun ajastus ja Vanhan rajapinnan poisto ovat käynnissä. Odotan Kastelun ajastusta taustalla.')];
  return `<div class="thread">${[...base, ...S.sent.map(([who, t]) => who === 'u' ? user(t) : agent(t))].join('')}</div>`;
}

// ---------- The worker's own view ----------
function workerView(r) {
  const ended = !!r.end;
  const tab = S.tab ?? (ended ? 'report' : 'conv');
  const tabs = ended ? [['report', 'Raportti'], ...(r.diff && r.st !== 'merged' ? [['changes', 'Muutokset']] : []), ['conv', 'Keskustelu']] : [['conv', 'Keskustelu']];
  const tabsHtml = `<div class="wv-tabs" role="tablist" aria-label="Workerin näkymä">${tabs.map(([k, l]) => `<button type="button" role="tab" class="tab" data-act="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}</div>`;
  const band = `<div class="wv-band" data-testid="worker-view"><button type="button" class="wv-back" data-act="back">${IC.back}Iltakierros</button><div class="wv-id"><span class="wv-kind">Worker</span><strong>${esc(r.title)}</strong></div><div class="wv-meta"><span class="mark">${mark(r)}</span><span class="w-word" data-tone="${tone(r)}">${stateWord(r)}</span><span class="sep">·</span>${r.h} · ${esc(r.prof)}<span class="sep">·</span><span class="mono">${esc(r.repo)}</span></div>${tabsHtml}</div>`;
  let body;
  if (tab === 'report') {
    const wtLine = r.worktreeOn ? `<dt>Worktree</dt><dd class="mono">${esc(wtPath(r))} <span class="muted">(${esc(r.wt.state === 'dirty' ? `${r.wt.changed} commitoimatonta muutosta` : r.wt.state === 'merged' ? 'yhdistetty' : 'ei yhdistetty')})</span></dd>` : '<dt>Worktree</dt><dd class="muted">poistettu</dd>';
    body = `<div class="thread"><div class="wv-result" data-tone="${tone(r)}"><span class="mark">${mark(r)}</span><div><strong>${esc(stateSentence(r))}</strong><p>${esc(r.summary)}</p></div></div>
<dl class="wv-facts"><dt>Haara</dt><dd class="mono">${esc(r.branch)}</dd>${wtLine}<dt>Taskfleet</dt><dd class="mono">${esc(r.tf)}</dd></dl></div>`;
  } else if (tab === 'changes') {
    const d = r.diff;
    body = `<div class="thread"><p class="wv-why">Haara <span class="mono">${esc(r.branch)}</span> verrattuna kohteeseen <span class="mono">main</span>: ${count(d.files.length, 'tiedosto', 'tiedostoa')}, <span class="add">+${d.add}</span> <span class="del">−${d.del}</span>.</p><ul class="diff" data-testid="diff">${d.files.map(([p, a, x]) => `<li><span class="mono">${esc(p)}</span><span class="add">+${a}</span><span class="del">−${x}</span></li>`).join('')}</ul></div>`;
  } else {
    body = `<div class="thread"><div class="msg user brief"><div class="bubble"><span class="who">Pääagentti · tehtävä</span>${esc(r.title)}: tee muutos haarassa <span class="mono">${esc(r.branch)}</span>, aja testit ja vie perille.</div></div><div class="msg agent"><span class="who">Worker</span><p>${esc(r.summary ?? 'Työ on kesken.')}</p></div></div>`;
  }
  const foot = ended
    ? `<div class="wv-decide" data-testid="worker-decide"><p class="wv-decide-head"><strong>${unfinished(r) ? 'Mitä tälle työlle tehdään?' : 'Työ on mainissa; jäljellä on siivous.'}</strong> Workerille ei kirjoiteta suoraan; pyynnöt menevät pääagentille.</p>${menu(r, 'worker')}</div>`
    : `<div class="wv-notice"><p><strong>Workerille ei kirjoiteta suoraan.</strong> Pääagentti voi lähettää sille viestin.</p><button type="button" class="btn quiet" data-act="back">Kysy pääkeskustelussa ›</button></div>`;
  return `<div class="topbar"><button type="button" class="icon-btn menu" aria-label="Avaa valikko">${IC.menu}</button><div class="title"><strong>${esc(r.title)}</strong><span class="mono">${esc(r.repo)}</span></div><button type="button" class="icon-btn" aria-label="Tiedot">${IC.info}</button></div>
${band}<div class="scroll">${body}</div>${foot}`;
}

// ---------- Frame ----------
function rail(f) {
  const row = (t, m, cur) => `<a href="#" class="conv${cur ? ' cur' : ''}" data-act="${cur ? 'back' : 'toast'}" data-msg="Vain Iltakierros on auki tässä kokeessa."${cur ? ' aria-current="page"' : ''}><span>${t}</span>${m}</a>`;
  return `<aside class="rail" aria-label="Työtilat"><div class="brand">Habitat</div><div class="ws">${HOME}</div>
${row('Iltakierros', f.live.some(r => r.waits) ? '<span class="bgw-dot" role="img" aria-label="Odottaa taustatyötä"></span>' : '<span class="wait-ring" role="img" aria-label="Odottaa sinua"></span>', true)}
${row('Sääaseman kalibrointi', `<span class="done">${IC.check}</span>`)}
<div class="ws">kirjasto</div>${row('Hakusanojen negaatiot', '<span class="wait-ring" role="img" aria-label="Odottaa sinua"></span>')}</aside>`;
}
function composer() {
  const d = S.draft;
  const chip = d ? `<div class="draft" data-testid="draft"><span class="draft-ic">${IC.msg}</span><p><strong>Pyyntö pääagentille</strong> · ${esc(d.label)}${d.runs ? `. Agentti ajaa: <span class="mono">${esc(d.runs)}</span>` : ''}. Mitään ei tapahdu ennen kuin lähetät.</p><button type="button" class="icon-btn" data-act="draft-x" aria-label="Hylkää luonnos">${IC.x}</button></div>` : '';
  return `<div class="composer">${chip}<div class="cbox"><textarea aria-label="Viesti" placeholder="Kirjoita agentille…" rows="${d ? 3 : 1}">${d ? esc(d.text) : ''}</textarea><button type="button" class="icon-btn send" data-act="send" aria-label="Lähetä">${IC.send}</button></div></div>`;
}
function view() {
  const f = facts();
  const r = S.worker && byId(S.worker);
  let main;
  if (r) main = workerView(r);
  else {
    const state = f.live.some(x => x.waits) ? '<span class="state"><span class="bgw-dot"></span>Odottaa taustatyötä</span>' : '<span class="state"><span class="wait-ring"></span>Odottaa sinua</span>';
    main = `<div class="topbar"><button type="button" class="icon-btn menu" aria-label="Avaa valikko">${IC.menu}</button><div class="title"><strong>Iltakierros</strong><span class="mono">${HOME}</span></div>${state}<button type="button" class="icon-btn" aria-label="Tiedot">${IC.info}</button></div>
<div class="scroll">${thread()}</div>${strip(f)}${composer()}`;
  }
  return `<div class="app v-${V[S.v]}" data-variant="${V[S.v]}">${rail(f)}<div class="main${r ? ' worker' : ''}">${main}<p class="toast" role="status">${esc(S.note)}</p>${dialog()}</div></div>`;
}
function syncLab() {
  for (const [k, e] of Object.entries(EVENTS)) {
    const b = document.querySelector(`[data-event="${k}"]`); if (!b) continue;
    b.disabled = S.scene === 'b' || !!S.events[k];
    b.textContent = e.label;
  }
}
function repaint(focusSel) {
  const el = document.getElementById('stage');
  const sc = el.querySelector('.pop-body')?.scrollTop;
  el.innerHTML = view();
  const body = el.querySelector('.pop-body'); if (body && sc) body.scrollTop = sc;
  const th = el.querySelector('.main:not(.worker) .scroll'); if (th) th.scrollTop = th.scrollHeight;
  syncLab();
  if (focusSel) el.querySelector(focusSel)?.focus();
}
function draftFor(id, act) {
  const r = byId(id);
  const a = act === 'own' ? { label: 'Oma viesti', runs: '' } : requests(r).find(x => x.id === act);
  S.draft = { id, act, label: a.label, runs: a.runs, text: requestText(r, act) };
  S.open = false; S.menu = null; S.worker = null;
}
// Opening the panel unfolds the ended rows when one is unfinished, as production does.
const openPanel = () => { S.open = true; S.menu = null; if (facts().open.length) S.ended = true; };
document.addEventListener('click', (e) => {
  const t = e.target.closest('#stage [data-act]'); if (!t) return;
  e.preventDefault();
  const a = t.dataset.act, id = t.dataset.id; let focus = null;
  S.note = '';
  if (a === 'pill') { if (S.open) S.open = false; else openPanel(); focus = '.pill[data-act="pill"]'; }
  else if (a === 'close') { S.open = false; focus = '.pill[data-act="pill"]'; }
  else if (a === 'fold') { S.ended = !S.ended; focus = '.endfold'; }
  else if (a === 'menu') { S.menu = S.menu === id ? null : id; focus = `.tell[data-id="${id}"]`; }
  else if (a === 'ask') { draftFor(id, t.dataset.do); focus = '.cbox textarea'; }
  else if (a === 'view') {
    if (t.dataset.do === 'editor') { const r = byId(id); S.note = `Editori avaisi kansion ${wtPath(r)}. Kokeessa se ei aukea.`; }
    else { S.worker = id; S.tab = t.dataset.do; S.open = false; S.menu = null; focus = '.wv-back'; }
  }
  else if (a === 'remove') { S.dialog = { id, back: S.worker ? '.wv-decide .btn.rm' : `.tell[data-id="${id}"]` }; focus = '.dialog .btn.primary'; }
  else if (a === 'rm-force') { S.dialog.disposal = 'force'; focus = '#typed'; }
  else if (a === 'rm-close') { const back = S.dialog?.back; S.dialog = null; focus = back; }
  else if (a === 'rm-do') {
    const r = byId(S.dialog.id); const disposal = t.dataset.disposal;
    if (disposal === 'force' && document.getElementById('typed').value !== wtName(r)) { S.dialog.err = `Kirjoita ${wtName(r)} vahvistukseksi.`; repaint('#typed'); return; }
    S.note = removeDone(r, disposal); S.dialog = null;
    if (!onDisk(byId(r.id))) { S.worker = null; S.menu = null; }
    focus = S.worker ? '.wv-back' : `.tell[data-id="${r.id}"]`;
    if (!document.querySelector(focus)) focus = '.pop .x';
  }
  else if (a === 'draft-x') { S.draft = null; focus = '.cbox textarea'; }
  else if (a === 'send') {
    const d = S.draft;
    if (!d) { S.note = 'Kokeessa vapaata viestiä ei lähetetä; kokeile pyyntöä workerin riviltä.'; }
    else {
      const r = byId(d.id); const [reply, change] = OUTCOME[d.act](r);
      S.sent.push(['u', document.querySelector('.cbox textarea').value], ['a', reply]);
      if (change) S.resolved[d.id] = { ...(S.resolved[d.id] ?? {}), ...change };
      if (d.act === 'continue') S.extra.push({ id: 'n' + d.id, title: `${r.title} (jatko)`, st: 'working', waits: false, age: '0 min', h: r.h, prof: r.prof, repo: r.repo, branch: r.branch });
      S.draft = null;
      if (change) S.note = onDisk(byId(d.id)) || LIVE.includes(byId(d.id).st) ? 'Rivi päivittyi.' : `${r.title} poistui Workerit-listasta: haaraa ja worktreetä ei enää ole.`;
    }
  }
  else if (a === 'worker') { S.worker = id; S.tab = null; S.open = false; S.menu = null; focus = '.wv-back'; }
  else if (a === 'back') { if (!S.worker) return; S.worker = null; openPanel(); focus = '.pop .x'; }
  else if (a === 'tab') { S.tab = t.dataset.tab; focus = `.wv-tabs [data-tab="${t.dataset.tab}"]`; }
  else if (a === 'toast') { S.note = t.dataset.msg; }
  repaint(focus);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (S.dialog) { const back = S.dialog.back; S.dialog = null; repaint(back); return; }
  if (S.open) { S.open = false; repaint('.pill[data-act="pill"]'); }
});
document.querySelectorAll('[data-event]').forEach(b => b.addEventListener('click', () => {
  const ev = EVENTS[b.dataset.event];
  S.events[b.dataset.event] = true;
  S.resolved[ev.id] = ev.change;
  S.sent.push(['a', ev.reply]);
  S.note = `${byId(ev.id).title} päättyi eikä jättänyt haaraa tai worktreetä, joten se poistui Workerit-listasta.`;
  repaint();
}));
const theme = document.getElementById('theme');
const setTheme = (t) => { document.documentElement.dataset.theme = t; theme.textContent = t === 'dark' ? 'Vaalea' : 'Tumma'; };
setTheme(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
theme.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
document.getElementById('scene').addEventListener('change', (e) => { S.scene = e.target.value; Object.assign(S, fresh()); repaint(); });
const start = (i) => () => { Object.assign(S, { v: i }, fresh()); queueMicrotask(syncLab); return view(); };
window.PROTO = { S, repaint };
window.variants = V.map((_, i) => start(i));
})();
const variants = window.variants;
