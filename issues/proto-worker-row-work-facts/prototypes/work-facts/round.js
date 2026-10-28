// Workerin työ rivillä, kierros 1 (proto-worker-row-work-facts). Synthetic names and data only.
// The research report's idea 5 (issues/research-workmux-sidebar/report.md): a worker or worktree
// row tells before it is opened whether the worker has produced anything: commits on its branch,
// uncommitted changes, added and removed lines, how far its source branch has moved on, and its
// pull request with the checks. The same facts in three production places: the Workers panel
// above the composer, the rail's worktree conversations, and the worker view.
//
// The variants differ on one axis: how the row speaks those facts.
//   1 Lause    — words on the row's existing second line, right after the state word: the work
//                ("3 committia · 2 commitoimatta", "ei vielä muutoksia") and the PR in words
//                ("PR #412 · tarkistukset käynnissä"). No new marks.
//   2 Luvut    — the conversation Git chip's marks at the row's end (↑ ahead, ↓ behind, ● changed
//                files, +/− lines) and a PR tag with its checks mark. Zero counts are not shown,
//                as on the chip; the worker view gets the chip and its layer.
//   3 Työrivi  — a third line under the row: a diff bar, the counts in short words and a PR pill
//                with the checks counted. Nothing yet is said on that line too. The worker view
//                gets a Työ card at the top of its history.
// The data and the honesty rules are the same in all three: unknown is never shown as zero, a
// missing gh login hides PR facts with one panel note instead of saying "no PR", and a merged
// worker's row says nothing about work that is already in its source branch.
(() => {
const SVG = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IC = {
  branch: SVG('<circle cx="7" cy="6" r="2"/><path d="M7 8v10"/><path d="M7 12c0 3 3 4 7 4"/><circle cx="17" cy="16" r="2"/>'),
  worktree: SVG('<rect x="3.5" y="4" width="17" height="16" rx="2"/><circle cx="9" cy="9" r="1.6"/><path d="M9 10.6V16"/><path d="M9 12.5c0 2 2 2.5 5 2.5"/><circle cx="15.5" cy="15" r="1.6"/>'),
  stop: SVG('<rect x="7" y="7" width="10" height="10" rx="1.5"/>'),
  x: SVG('<path d="M6 6l12 12M18 6 6 18"/>'),
  check: SVG('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  warn: SVG('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5"/><path d="M12 17.2h.01"/>'),
  merge: SVG('<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 8v8"/><path d="M6 8c0 3 4 4 10 4"/>'),
  chev: SVG('<path d="m9 6 6 6-6 6"/>'),
  back: SVG('<path d="m15 6-6 6 6 6"/>'),
  menu: SVG('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  send: SVG('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  info: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5h.01"/>'),
  up: SVG('<path d="M12 19V6M6.5 11.5 12 6l5.5 5.5"/>'),
  down: SVG('<path d="M12 5v13M6.5 12.5 12 18l5.5-5.5"/>'),
  pr: SVG('<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M6 8v8"/><path d="M18 16V9.5A2.5 2.5 0 0 0 15.5 7H11"/><path d="m13 5-2 2 2 2"/>'),
  out: SVG('<path d="M14 5h5v5"/><path d="m19 5-8 8"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>'),
  q: SVG('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4"/><path d="M12 17h.01"/>'),
};
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const V = ['lause', 'luvut', 'oma'];
const HOME = 'kasvimaa';

// ---------- Facts: what the host would know ----------
// git: the worker's worktree read like a worktree place's git_summary, against the run's
//   source branch (a worker branch has no upstream): ahead, behind, dirty (changed files), and
//   add/del lines of everything the worker produced, committed or not (merge base → worktree).
//   null = Git did not answer. A merged run has no git: its work is in the source branch.
// pr: the person's own gh, `gh pr list --head <branch>`; null = no PR; 'unknown' = gh cannot say.
const F = (p, a, d) => ({ p, a, d });
const RUNS0 = () => [
  { id: 'w1', title: 'Sääaseman CSV-vienti', st: 'working', age: '18 min', h: 'Pi', prof: 'oletus', repo: HOME, waited: true, branch: 'wt/r7c1-saaasema-csv', src: 'main',
    git: { ahead: 2, behind: 0, dirty: 3, add: 146, del: 12, files: [F('src/saa/csv.ts', 98, 0), F('src/saa/csv.test.ts', 41, 0), F('src/saa/vienti.tsx', 7, 12)] }, pr: null,
    brief: 'Lisää sääaseman mittauksille CSV-vienti: aikaväli, sarakkeet ja testit. Mergeä valmiina.' },
  { id: 'w3', title: 'Kuvagallerian lataus', st: 'working', age: '6 min', h: 'Pi', prof: 'nopea', repo: HOME, waited: false, branch: 'wt/q2m8-galleria-lataus', src: 'main',
    git: { ahead: 4, behind: 1, dirty: 0, add: 88, del: 40, files: [F('src/galleria/Lataus.tsx', 61, 22), F('src/galleria/jono.ts', 27, 18)] },
    pr: { n: 412, state: 'draft', checks: [{ name: 'test', s: 'ok' }, { name: 'lint', s: 'ok' }, { name: 'e2e', s: 'run' }] },
    brief: 'Kuvagallerian lataus jonoon ja keskeytettäväksi. Avaa luonnos-PR, kun ensimmäinen versio toimii.' },
  { id: 'w2', title: 'Vanhan rajapinnan poisto', st: 'working', age: '2 min', h: 'Claude', prof: 'tarkka', repo: 'kirjasto', waited: false, branch: 'wt/t2v9-vanha-rajapinta', src: 'main',
    git: { ahead: 0, behind: 0, dirty: 0, add: 0, del: 0, files: [] }, pr: null,
    brief: 'Poista vanha /api/v0-rajapinta ja sen testit; varmista, ettei mikään kutsu sitä enää.' },
  { id: 'e2', title: 'test-guide: worker-näkymän koe', st: 'unmerged', preserved: true, end: '07.36', h: 'Pi', prof: 'oletus', repo: HOME, branch: 'wt/5yq1-test-guide-worker-nakyma', src: 'main',
    git: { ahead: 3, behind: 5, dirty: 0, add: 61, del: 4, files: [F('KOKEILTAVAA.md', 52, 4), F('web/lab/worker.mjs', 9, 0)] }, pr: null,
    summary: 'Koe tehty ja havainnot kirjattu KOKEILTAVAA.md:hen. En mergennyt: main oli edennyt, ja KOKEILTAVAA.md törmäsi toisen workerin muutokseen.' },
  { id: 'e4', title: 'Lomakkeen saavutettavuus', st: 'failed', preserved: true, end: '13.12', h: 'Claude', prof: 'tarkka', repo: HOME, branch: 'wt/b5q3-lomakkeen-saavutettavuus', src: 'main',
    git: { ahead: 1, behind: 2, dirty: 2, add: 23, del: 9, files: [F('src/Lomake.tsx', 17, 9), F('src/Lomake.test.tsx', 6, 0)] },
    pr: { n: 405, state: 'open', checks: [{ name: 'test', s: 'ok' }, { name: 'lint', s: 'ok' }, { name: 'typecheck', s: 'ok' }, { name: 'e2e', s: 'fail' }] },
    summary: 'e2e-testi kaatui lomakkeen fokusjärjestykseen; en saanut sitä korjattua aikarajassa.' },
  { id: 'e1', title: 'Kuvien pakkaus', st: 'merged', end: '13.41', h: 'Pi', prof: 'oletus', repo: HOME, branch: 'wt/k8h2-kuvien-pakkaus', src: 'main', git: undefined, pr: undefined,
    summary: 'Kuvat pakataan nyt WebP:ksi latauksessa. Laskeutui mainiin.' },
];
// The rail's worktree conversations: ordinary conversations in a linked worktree (ADR 0025),
// whose git_summary the snapshot already carries.
const PLACES0 = () => [
  { id: 'zoom', title: 'Galleria: nipistyszoomi', branch: 'zoom-nipistys', mark: 'wait', git: { ahead: 2, behind: 0, dirty: 1, add: 40, del: 3 }, pr: { n: 409, state: 'open', checks: [{ name: 'test', s: 'ok' }, { name: 'lint', s: 'ok' }] } },
  { id: 'siivo', title: 'Hakemiston siivous', branch: 'siivous', mark: 'done', merged: true, git: { ahead: 0, behind: 3, dirty: 0, add: 0, del: 0 }, pr: { n: 401, state: 'merged', checks: [] } },
];
const S = { v: 0, scene: 'a' };
const fresh = () => ({ open: true, ended: true, at: 'ilta', worker: null, note: '', drawer: false, layer: false, tick: 0, runs: RUNS0(), places: PLACES0() });

// The scene decides what the host can say: b = gh not logged in, c = Git does not answer for w1.
function runs() {
  return S.runs.map(r => {
    const x = { ...r };
    if (S.scene === 'b' && x.pr !== undefined) x.pr = 'unknown';
    if (S.scene === 'c' && x.id === 'w1') x.git = null;
    return x;
  });
}
function places() { return S.places.map(p => S.scene === 'b' ? { ...p, pr: 'unknown' } : p); }
const byId = (id) => runs().find(r => r.id === id);
const live = (r) => r.st === 'working' || r.st === 'waiting_parent';
const attention = (r) => (r.st === 'unmerged' || r.st === 'failed') && r.preserved;

// ---------- The facts in words, the same in every variant's accessible name ----------
const checksOf = (pr) => {
  const c = pr.checks;
  return { ok: c.filter(x => x.s === 'ok').length, fail: c.filter(x => x.s === 'fail').length, run: c.filter(x => x.s === 'run').length, all: c.length };
};
// The checks' one word and tone: a failure outranks a running check, which outranks success.
function checkWord(pr) {
  const k = checksOf(pr);
  if (pr.state === 'merged') return { text: 'yhdistetty', tone: 'ok', mark: 'merge' };
  if (!k.all) return { text: 'ei tarkistuksia', tone: 'muted', mark: '' };
  if (k.fail) return { text: k.fail === 1 ? 'tarkistus epäonnistui' : `${k.fail} tarkistusta epäonnistui`, tone: 'err', mark: 'fail' };
  if (k.run) return { text: 'tarkistukset käynnissä', tone: 'run', mark: 'run' };
  return { text: 'tarkistukset läpi', tone: 'ok', mark: 'ok' };
}
const prName = (pr) => `PR #${pr.n}${pr.state === 'draft' ? ' (luonnos)' : ''}`;
function sentence(x) {
  const g = x.git;
  if (x.st === 'merged') return 'Työ on lähtöhaarassa.';
  if (g === null) return 'Työn tila ei tiedossa: Git ei vastannut worktreestä.';
  const src = x.src ?? 'main';
  const parts = [];
  if (!g.ahead && !g.dirty) parts.push('Ei vielä muutoksia.');
  else {
    parts.push(`${count(g.ahead, 'commit', 'committia')} haarassa, ${count(g.dirty, 'tiedosto', 'tiedostoa')} commitoimatta.`);
    parts.push(`${g.add} riviä lisätty ja ${g.del} poistettu.`);
  }
  if (g.behind) parts.push(`${src} on edennyt ${count(g.behind, 'commitilla', 'commitilla')}.`);
  if (x.pr === 'unknown') parts.push('PR-tieto ei saatavilla.');
  else if (x.pr) parts.push(`${prName(x.pr)}: ${checkWord(x.pr).text}.`);
  else parts.push('Ei pull requestia.');
  return parts.join(' ');
}

// ---------- 1 Lause: words on the second line ----------
// The work clause first (it is what the row answers), then the PR clause. Zero is said once.
function workWords(x) {
  const g = x.git;
  if (g === null) return { text: 'työn tila ei tiedossa', tone: 'muted' };
  if (!g.ahead && !g.dirty) return { text: 'ei vielä muutoksia', tone: 'muted' };
  // "muutos/muutosta" as the home page's worktree card already says it (HomeWorkspaces.tsx).
  return { text: [g.ahead ? count(g.ahead, 'commit', 'committia') : '', g.dirty ? count(g.dirty, 'muutos', 'muutosta') : ''].filter(Boolean).join(' · '), tone: 'work' };
}
// The row is one button (production BackgroundStrip), so the PR is words here, not a link;
// the worker view's sentence opens it.
function prWords(x, short) {
  if (!x.pr || x.pr === 'unknown') return '';
  const w = checkWord(x.pr);
  const ck = short ? { 'tarkistukset läpi': 'läpi', 'tarkistukset käynnissä': 'käynnissä', 'tarkistus epäonnistui': 'epäonnistui', 'ei tarkistuksia': '' }[w.text] ?? w.text : w.text;
  return `<span class="f1-prc"><span class="f1-pr">${short ? '' : 'PR '}#${x.pr.n}${x.pr.state === 'draft' && !short ? ' luonnos' : ''}</span>${ck ? ` <span class="f1-check" data-tone="${w.tone}">${esc(ck)}</span>` : ''}</span>`;
}
function lause(x, short = false) {
  if (x.st === 'merged' || x.git === undefined) return '';
  const w = workWords(x), pr = prWords(x, short);
  return `<span class="f1" data-testid="facts" role="group" aria-label="${esc(sentence(x))}"><span class="f1-work" data-tone="${w.tone}">${esc(w.text)}</span>${pr ? `<span class="sep">·</span>${pr}` : ''}</span>`;
}

// ---------- 2 Luvut: the Git chip's marks at the row's end ----------
function prTag(x, cls = '') {
  if (!x.pr || x.pr === 'unknown') return '';
  const w = checkWord(x.pr);
  const mk = w.mark === 'ok' ? IC.check : w.mark === 'fail' ? IC.x : w.mark === 'merge' ? IC.merge : w.mark === 'run' ? '<span class="f-run"></span>' : '';
  return `<button type="button" class="f2-pr${cls}" data-act="pr" data-n="${x.pr.n}" data-tone="${w.tone}" data-draft="${x.pr.state === 'draft'}" title="${esc(`${prName(x.pr)}: ${w.text}`)}">${IC.pr}<span class="f2-prn">${x.pr.n}</span>${mk ? `<span class="f2-ck">${mk}</span>` : ''}</button>`;
}
function marks(g, opt = {}) {
  if (g === null) return '<span class="f2-unk" title="Työn tila ei tiedossa">–</span>';
  const n = (ic, v, t, cls = '') => v ? `<span class="f2-n${cls}" title="${esc(t)}">${ic}${v}</span>` : '';
  return [n(IC.up, g.ahead, count(g.ahead, 'commit', 'committia') + ' haarassa'),
    opt.behind === false ? '' : n(IC.down, g.behind, `lähtöhaara ${count(g.behind, 'commitin', 'commitia')} edellä`, ' behind'),
    g.dirty ? `<span class="f2-n" title="${esc(count(g.dirty, 'tiedosto', 'tiedostoa') + ' commitoimatta')}"><span class="f2-dot"></span>${g.dirty}</span>` : '',
    opt.lines === false || (!g.add && !g.del) ? '' : `<span class="f2-lines"><span class="add">+${g.add}</span><span class="del">−${g.del}</span></span>`].join('');
}
function luvut(x) {
  if (x.st === 'merged' || x.git === undefined) return '';
  return `<span class="f2" data-testid="facts" role="group" aria-label="${esc(sentence(x))}">${marks(x.git)}${prTag(x)}</span>`;
}

// ---------- 3 Työrivi: a third line ----------
// The bar has five cells like a forge's diffstat: green for added, red for removed lines.
function bar(g) {
  const tot = (g?.add ?? 0) + (g?.del ?? 0);
  const addCells = tot ? Math.round(5 * g.add / tot) : 0;
  const delCells = tot ? Math.min(5 - addCells, Math.max(g.del ? 1 : 0, Math.round(5 * g.del / tot))) : 0;
  return `<span class="f3-bar" aria-hidden="true">${Array.from({ length: 5 }, (_, i) => `<i data-c="${i < addCells ? 'a' : i < addCells + delCells ? 'd' : ''}"></i>`).join('')}</span>`;
}
function prPill(x, compact = false) {
  if (!x.pr || x.pr === 'unknown') return '';
  const w = checkWord(x.pr), k = checksOf(x.pr);
  const ck = x.pr.state === 'merged' ? 'yhdistetty' : !k.all ? 'ei tarkistuksia' : k.fail ? `${k.fail}/${k.all} epäonnistui` : k.run ? `${k.ok}/${k.all} · ${k.run} käynnissä` : `${k.ok}/${k.all} läpi`;
  return `<button type="button" class="f3-pr" data-act="pr" data-n="${x.pr.n}" data-tone="${w.tone}">${IC.pr}<span>#${x.pr.n}${x.pr.state === 'draft' && !compact ? ' luonnos' : ''}</span><span class="f3-ck">${w.mark === 'run' ? '<span class="f-run"></span>' : w.mark === 'ok' ? IC.check : w.mark === 'fail' ? IC.x : w.mark === 'merge' ? IC.merge : ''}${compact ? '' : esc(ck)}</span></button>`;
}
function oma(x, compact = false, pr = true) {
  if (x.st === 'merged' || x.git === undefined) return '';
  const g = x.git;
  let body;
  if (g === null) body = `<span class="f3-none">${IC.q}Työn tila ei tiedossa · Git ei vastannut</span>`;
  else if (!g.ahead && !g.dirty) body = `${bar(null)}<span class="f3-none">Ei vielä muutoksia</span>${pr ? prPill(x, compact) : ''}`;
  // The rail is narrow: the bar, the lines and the PR's mark; the words live in the panel.
  else body = `${bar(g)}<span class="f3-lines"><span class="add">+${g.add}</span> <span class="del">−${g.del}</span></span>${compact ? '' : `<span class="f3-words">${[g.ahead ? count(g.ahead, 'commit', 'committia') : '', g.dirty ? count(g.dirty, 'muutos', 'muutosta') : '', g.behind ? `${x.src ?? 'main'} edennyt ${g.behind}` : ''].filter(Boolean).join(' · ')}</span>`}${pr ? prPill(x, compact) : ''}`;
  return `<span class="f3" data-testid="facts" role="group" aria-label="${esc(sentence(x))}">${body}</span>`;
}

// ---------- The Workers panel ----------
function stateWord(r) {
  const kept = r.preserved ? ' · työ tallessa' : '';
  if (r.st === 'merged') return { text: 'laskeutui', tone: 'ok' };
  if (r.st === 'failed') return { text: `epäonnistui${kept}`, tone: 'err' };
  if (r.st === 'unmerged') return { text: `ei mergetty${kept}`, tone: r.preserved ? 'err' : 'muted' };
  return r.waited ? { text: 'agentti odottaa', tone: 'wait' } : { text: 'agentti ei odota', tone: 'muted' };
}
function mark(r) {
  if (live(r)) return r.waited ? '<span class="bgw-dot"></span>' : '<span class="nowait-dot"></span>';
  if (r.st === 'merged') return `<span class="mark-ic ok">${IC.merge}</span>`;
  return `<span class="mark-ic attn">${IC.warn}</span>`;
}
const repoTag = (r) => r.repo !== HOME ? `<span class="sep">·</span><span class="tag repo" title="Toinen repositorio kuin tämä keskustelu">${esc(r.repo)}</span>` : '';
function row(r) {
  const w = stateWord(r);
  const word = `<span class="w-word" data-tone="${w.tone}">${esc(w.text)}</span>`;
  const agent = `<span class="sep">·</span><span class="agent">${r.h} · ${esc(r.prof)}</span>${repoTag(r)}`;
  // Lause puts the work straight after the state word, so a narrow row cuts the agent, not it.
  const f1 = S.v === 0 ? lause(r) : '';
  const line2 = f1 ? `${word}<span class="sep">·</span>${f1}${agent}` : `${word}${agent}`;
  const f2 = S.v === 1 ? luvut(r) : '';
  const f3 = S.v === 2 ? oma(r) : '';
  const main = `<button type="button" class="row-main" data-act="worker" data-id="${r.id}" aria-label="${esc(`${r.title}: ${w.text}. ${sentence(r)} Avaa workerin näkymä.`)}"><span class="mark">${mark(r)}</span><span class="lines"><span class="line1"><span class="name">${esc(r.title)}</span><span class="meta">${r.end ?? r.age}</span></span><span class="line2">${line2}</span></span></button>`;
  const side = live(r) ? `<button type="button" class="icon-btn stop" aria-label="Lopeta: ${esc(r.title)}" data-act="toast" data-msg="Lopetus on tuotannon nykyinen toiminto; tämä kierros ei muuta sitä.">${IC.stop}</button>` : '<span class="gap"></span>';
  return `<div class="row two" data-run="${r.id}" data-state="${r.st}"><div class="row-line">${main}${f2}${side}</div>${f3 ? `<div class="f3-wrap">${f3}</div>` : ''}</div>`;
}
const group = (label, list) => `<div class="group" role="group" aria-label="${label}">${list.map(row).join('')}</div>`;
function panel() {
  const all = runs();
  const lv = all.filter(live), ended = all.filter(r => !live(r));
  const head = `<div class="endhead"><button type="button" class="endfold" data-act="fold" aria-expanded="${S.ended}">${IC.chev}<span>${count(ended.length, 'päättynyt', 'päättynyttä')}</span>${ended.some(attention) && !S.ended ? '<span class="attn-dot" role="img" aria-label="Keskeneräisiä"></span>' : ''}</button></div>`;
  const note = S.scene === 'b' ? `<p class="f-note" data-testid="pr-note">${IC.info}<span>PR-tiedot puuttuvat, koska gh ei ole kirjautunut GitHubiin. Muutokset näkyvät silti.</span><button type="button" class="link" data-act="toast" data-msg="Veisi Asetukset › GitHub -yhteyteen.">Yhdistä GitHub</button></p>` : '';
  return `${note}${group('Workerit: käynnissä', lv)}${head}${S.ended ? group('Workerit: päättyneet', ended) : ''}`;
}
function strip() {
  const all = runs();
  const lv = all.filter(live), attn = all.filter(attention);
  const m = `<span class="marks">${lv.map(mark).join('')}${attn.map(() => '<span class="ball"></span>').join('')}</span>`;
  const s = `Workerit: ${lv.length} työskentelee${attn.length ? `, ${count(attn.length, 'keskeneräinen', 'keskeneräistä')}` : ''}`;
  const pill = `<button type="button" class="pill" data-act="pill" data-testid="chip-spin" aria-expanded="${S.open}" aria-label="${esc(s)}" title="${esc(s)}"><span class="ic">${IC.branch}</span>${m}</button>`;
  const pop = S.open ? `<div class="pop" data-testid="panel" data-variant="${V[S.v]}"><div class="tabs" role="tablist" aria-label="Taustatyö"><button type="button" role="tab" class="tab" aria-selected="true">${IC.branch}Workerit<span class="tab-n">${lv.length}</span></button><button type="button" class="icon-btn x" data-act="close" aria-label="Sulje">${IC.x}</button></div><div class="pop-body" role="tabpanel">${panel()}</div></div>` : '';
  return `<section class="strip" aria-label="Taustatyö"><div class="strip-wrap">${pop}<div class="badges" role="group" aria-label="Taustatyö">${pill}</div></div></section>`;
}

// ---------- The rail ----------
function placeFacts(p) {
  const x = { ...p, st: p.merged ? 'merged' : 'working', src: 'main' };
  if (p.merged) return '';
  if (S.v === 0) return `<span class="conv-detail">${lause(x, true)}</span>`;
  // The rail row is a link, so its PR mark is not a second control.
  const inert = (h) => h.replace(/<button type="button" class="(f2-pr|f3-pr)" data-act="pr"/g, '<span class="$1"').replace(/<\/button>/g, '</span>');
  if (S.v === 1) return `<span class="conv-f2">${inert(luvut(x)).replace('class="f2"', 'class="f2 rail-f2"')}</span>`;
  return `<span class="conv-detail">${inert(oma(x, true))}</span>`;
}
function rail() {
  const pl = places();
  const cmk = (k) => k === 'wait' ? '<span class="wait-ring" role="img" aria-label="Odottaa sinua"></span>' : `<span class="done" role="img" aria-label="Valmis">${IC.check}</span>`;
  const conv = (id, title, mk, extra = '') => `<a href="#" class="conv${S.at === id && !S.worker ? ' cur' : ''}" data-act="goto" data-to="${id}"${S.at === id && !S.worker ? ' aria-current="page"' : ''}><span>${esc(title)}</span>${mk}</a>${extra}`;
  const place = (p) => `<a href="#" class="conv place${S.at === p.id && !S.worker ? ' cur' : ''}${p.merged ? ' merged' : ''}" data-act="goto" data-to="${p.id}" data-testid="place-${p.id}"${S.at === p.id && !S.worker ? ' aria-current="page"' : ''} aria-label="${esc(`${p.title}. Worktree-agentti${p.merged ? ', työ yhdistetty' : ''}. ${p.merged ? '' : sentence({ ...p, st: 'working', src: 'main' })}`)}"><span class="place-l"><span class="place-1"><span class="wt-ic${p.merged ? ' merged' : ''}">${p.merged ? IC.merge : IC.worktree}</span><span class="place-t">${esc(p.title)}</span>${S.v === 1 ? placeFacts(p) : ''}${cmk(p.mark)}</span>${S.v !== 1 ? placeFacts(p) : ''}</span></a>`;
  return `<aside class="rail" aria-label="Työtilat"><div class="brand">Habitat</div><div class="ws">${HOME}</div>
${conv('ilta', 'Iltakierros', '<span class="wait-ring" role="img" aria-label="Odottaa sinua"></span>')}
${pl.map(place).join('')}
${conv('kalib', 'Sääaseman kalibrointi', `<span class="done">${IC.check}</span>`)}
<div class="ws">kirjasto</div>${conv('haku', 'Hakusanojen negaatiot', '<span class="wait-ring"></span>')}</aside>`;
}

// ---------- The conversation ----------
const THREADS = {
  ilta: [['u', 'Käynnistä illan workerit: CSV-vienti, gallerian lataus ja kirjaston vanha rajapinta. Odota CSV-vientiä.'], ['a', 'Käynnistin kolme workeria. Odotan Sääaseman CSV-vientiä; muut jatkavat omillaan, ja näet niiden työn Workerit-paneelista.']],
  zoom: [['u', 'Tee galleriaan nipistyszoomi omassa worktreessä.'], ['a', 'Zoomi toimii puhelimessa; avasin PR #409:n, ja sen tarkistukset menivät läpi.']],
  siivo: [['a', 'Hakemiston siivous on yhdistetty mainiin (PR #401).']],
  kalib: [['a', 'Kalibrointitaulukko päivitetty.']],
  haku: [['a', 'Negaatiot toimivat nyt hakusanoissa.']],
};
const TITLES = { ilta: 'Iltakierros', kalib: 'Sääaseman kalibrointi', haku: 'Hakusanojen negaatiot' };
function thread(id) {
  return `<div class="thread">${(THREADS[id] ?? []).map(([w, t]) => w === 'u' ? `<div class="msg user"><div class="bubble">${esc(t)}</div></div>` : `<div class="msg agent"><p>${esc(t)}</p></div>`).join('')}</div>`;
}
// The production conversation Git chip (GitStatus.tsx), unchanged by this round.
function gitChip(id) {
  const p = places().find(x => x.id === id);
  if (!p) return `<span class="gchip" title="Git-tila">${IC.branch}</span>`;
  if (p.merged) return `<span class="gchip" title="Worktree · yhdistetty">${IC.merge}<span>yhdistetty</span></span>`;
  return `<span class="gchip" title="Worktree · avaa tiedot">${IC.worktree}${marks(p.git, { lines: false })}</span>`;
}
function composer() {
  return `<div class="composer"><div class="cbox"><textarea aria-label="Viesti" placeholder="Kirjoita agentille…" rows="1"></textarea><button type="button" class="icon-btn send" data-act="toast" data-msg="Lähettäminen ei kuulu tähän kokeeseen." aria-label="Lähetä">${IC.send}</button></div></div>`;
}

// ---------- The worker view ----------
function fileList(r) {
  if (!r.git || !r.git.files?.length) return '';
  return `<ul class="diff" data-testid="files">${r.git.files.map(f => `<li><span class="mono">${esc(f.p)}</span><span class="add">+${f.a}</span>${f.d ? `<span class="del">−${f.d}</span>` : ''}</li>`).join('')}</ul>`;
}
function checkList(r) {
  if (!r.pr || r.pr === 'unknown' || !r.pr.checks.length) return '';
  const mk = (s) => s === 'ok' ? `<span class="ck ok">${IC.check}</span>` : s === 'fail' ? `<span class="ck fail">${IC.x}</span>` : '<span class="ck run"><span class="f-run"></span></span>';
  const word = { ok: 'läpi', fail: 'epäonnistui', run: 'käynnissä' };
  return `<ul class="checks" data-testid="checks">${r.pr.checks.map(c => `<li>${mk(c.s)}<span class="mono">${esc(c.name)}</span><span class="muted">${word[c.s]}</span></li>`).join('')}</ul>`;
}
function workCard(r) {
  if (r.st === 'merged' || r.git === undefined) return '';
  const g = r.git;
  const prLine = r.pr === 'unknown' ? '<p class="muted">PR-tieto ei saatavilla: gh ei ole kirjautunut.</p>'
    : r.pr ? `<div class="wc-pr">${prPill(r)}<button type="button" class="link" data-act="pr" data-n="${r.pr.n}">Avaa GitHubissa${IC.out}</button></div>${checkList(r)}` : '<p class="muted">Ei pull requestia.</p>';
  const head = g === null ? `<p class="muted">${esc(sentence(r))}</p>` : `<p class="wc-sum">${oma(r, false, false)}</p>`;
  return `<section class="workcard" data-testid="workcard" aria-label="Työ"><header><strong>Työ</strong><span class="mono muted">${esc(r.branch)} → ${esc(r.src)}</span></header>${head}${g ? fileList(r) : ''}${prLine}</section>`;
}
function workerLayer(r) {
  if (!S.layer) return '';
  const g = r.git;
  return `<div class="glayer" role="dialog" aria-label="Workerin työ" data-testid="layer"><header><strong>${IC.branch}<span class="mono">${esc(r.branch)}</span></strong><button type="button" class="icon-btn" data-act="layer" aria-label="Sulje">${IC.x}</button></header>
<p class="gl-sent">${esc(sentence(r))}</p>${g ? fileList(r) : ''}${r.pr && r.pr !== 'unknown' ? `<div class="wc-pr">${prTag(r)}<span>${esc(prName(r.pr))}</span><button type="button" class="link" data-act="pr" data-n="${r.pr.n}">Avaa GitHubissa${IC.out}</button></div>${checkList(r)}` : ''}</div>`;
}
function workerView(r) {
  const w = stateWord(r);
  let facts = '';
  if (S.v === 0 && r.st !== 'merged') facts = `<span class="sep">·</span><span class="wv-sentence" data-testid="facts">${esc(sentence(r))}</span>${r.pr && r.pr !== 'unknown' ? `<button type="button" class="link" data-act="pr" data-n="${r.pr.n}">Avaa PR #${r.pr.n}${IC.out}</button>` : ''}`;
  const chip = S.v === 1 && r.st !== 'merged' ? `<button type="button" class="gchip wv-chip" data-act="layer" data-testid="worker-chip" aria-expanded="${S.layer}" aria-label="${esc(sentence(r) + ' Avaa työn tiedot.')}">${IC.worktree}${marks(r.git)}${r.pr && r.pr !== 'unknown' ? `<span class="f2-pr-in" data-tone="${checkWord(r.pr).tone}">#${r.pr.n}</span>` : ''}</button>` : '';
  const band = `<div class="wv-band" data-testid="worker-view"><button type="button" class="wv-back" data-act="back">${IC.back}Iltakierros</button><div class="wv-id"><span class="wv-kind">Worker</span><strong>${esc(r.title)}</strong></div><div class="wv-meta"><span class="mark">${mark(r)}</span><span class="w-word" data-tone="${w.tone}">${esc(w.text)}</span><span class="sep">·</span>${r.h} · ${esc(r.prof)}${facts}</div><div class="wv-tabs">${chip}</div></div>`;
  const brief = r.brief ? `<div class="msg user brief"><span class="who">Pääagentin tehtävä</span><div class="bubble">${esc(r.brief)}</div></div>` : '';
  const result = r.summary ? `<div class="wv-result"><span class="mark">${mark(r)}</span><div><strong>${esc(w.text)}</strong><p>${esc(r.summary)}</p></div></div>` : '';
  const progress = live(r) ? `<div class="msg agent"><p>${r.git?.ahead ? 'Testit menevät läpi; jatkan seuraavaan osaan.' : 'Luen nykyistä koodia ennen muutoksia.'}</p></div>` : '';
  const body = `<div class="thread">${S.v === 2 ? workCard(r) : ''}${brief}${progress}${result}</div>`;
  return `<div class="topbar"><button type="button" class="icon-btn menu" data-act="drawer" aria-label="Avaa valikko">${IC.menu}</button><div class="title"><strong>${esc(r.title)}</strong><span class="mono">${esc(r.repo)}</span></div></div>${band}${workerLayer(r)}<div class="scroll">${body}</div>`;
}

// ---------- Frame ----------
function view() {
  const r = S.worker && byId(S.worker);
  const p = S.places.find(x => x.id === S.at);
  let main;
  if (r) main = workerView(r);
  else main = `<div class="topbar"><button type="button" class="icon-btn menu" data-act="drawer" aria-label="Avaa valikko">${IC.menu}</button><div class="title"><strong>${esc(p?.title ?? TITLES[S.at])}</strong><span class="mono">${S.at === 'haku' ? 'kirjasto' : HOME}</span></div>${gitChip(S.at)}<span class="state"><span class="wait-ring"></span>Odottaa sinua</span></div>
<div class="scroll">${thread(S.at)}</div>${S.at === 'ilta' ? strip() : ''}${composer()}`;
  return `<div class="app v-${V[S.v]}${S.drawer ? ' drawer' : ''}" data-variant="${V[S.v]}">${rail()}${S.drawer ? '<div class="drawer-scrim" data-act="drawer"></div>' : ''}<div class="main${r ? ' worker' : ''}" data-conv="${r ? '' : S.at}">${main}<p class="toast" role="status">${esc(S.note)}</p></div></div>`;
}
function repaint(focusSel) {
  const el = document.getElementById('stage');
  if (!el.querySelector('.app')) return;
  const sc = el.querySelector('.pop-body')?.scrollTop;
  el.innerHTML = view();
  const body = el.querySelector('.pop-body'); if (body && sc) body.scrollTop = sc;
  if (focusSel) el.querySelector(focusSel)?.focus();
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('#stage [data-act]'); if (!t) return;
  e.preventDefault();
  const act = t.dataset.act; let focus = null;
  S.note = '';
  if (act === 'pill') { S.open = !S.open; focus = '.pill'; }
  else if (act === 'close') { S.open = false; focus = '.pill'; }
  else if (act === 'fold') { S.ended = !S.ended; focus = '.endfold'; }
  else if (act === 'worker') { S.worker = t.dataset.id; S.layer = false; focus = '.wv-back'; }
  else if (act === 'back') { S.worker = null; S.at = 'ilta'; S.open = true; S.layer = false; focus = '.pop .x'; }
  else if (act === 'goto') { S.worker = null; S.at = t.dataset.to; S.drawer = false; S.open = S.at === 'ilta'; S.layer = false; }
  else if (act === 'drawer') { S.drawer = !S.drawer; }
  else if (act === 'layer') { S.layer = !S.layer; focus = S.layer ? '.glayer .icon-btn' : '.wv-chip'; }
  else if (act === 'pr') { S.note = `Avaisi PR #${t.dataset.n}:n GitHubissa uuteen välilehteen.`; }
  else if (act === 'toast') { S.note = t.dataset.msg; }
  repaint(focus);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (S.layer) { S.layer = false; repaint('.wv-chip'); return; }
  if (S.drawer) { S.drawer = false; repaint(); return; }
  if (S.open) { S.open = false; repaint('.pill'); }
});
// "Worker etenee": the CSV worker commits once and edits more. The row's height must not change.
const STEPS = [{ ahead: 3, dirty: 1, add: 171, del: 15, files: [F('src/saa/csv.ts', 112, 0), F('src/saa/csv.test.ts', 52, 3), F('src/saa/vienti.tsx', 7, 12)] },
  { ahead: 4, dirty: 0, add: 188, del: 15, files: [F('src/saa/csv.ts', 112, 0), F('src/saa/csv.test.ts', 52, 3), F('src/saa/vienti.tsx', 7, 12), F('docs/saa.md', 17, 0)] }];
document.getElementById('tick').addEventListener('click', () => {
  const w = S.runs.find(r => r.id === 'w1');
  const step = STEPS[Math.min(S.tick, STEPS.length - 1)]; S.tick++;
  w.git = { ...w.git, ...step };
  repaint();
});
const theme = document.getElementById('theme');
const setTheme = (t) => { document.documentElement.dataset.theme = t; theme.textContent = t === 'dark' ? 'Vaalea' : 'Tumma'; };
setTheme(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
theme.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
const reset = () => Object.assign(S, fresh());
document.getElementById('scene').addEventListener('change', (e) => { S.scene = e.target.value; reset(); repaint(); });
const start = (i) => () => { S.v = i; reset(); return view(); };
window.PROTO = { S, repaint };
window.variants = V.map((_, i) => start(i));
})();
const variants = window.variants;
