// Workerit-paneeli, kierros 1 (proto-worker-panel). Synthetic names and data only.
// One conversation (a conductor in repository kasvimaa) with seven workers: waited and not,
// one waiting on its parent, one in another repository, Pi and Claude, landed, preserved and
// failed. The directions differ on one axis: where a row's details and the meaning of the
// wait live — on the row itself (Rivi), in the panel's group headings (Ryhmät), or in a
// details block the row opens (Avattava). Every row's name opens the worker's own view
// (a simplified Kehys, proto-worker-view).
(() => {
const SVG = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IC = {
  branch: SVG('<circle cx="7" cy="6" r="2"/><path d="M7 8v10"/><path d="M7 12c0 3 3 4 7 4"/><circle cx="17" cy="16" r="2"/>'),
  term: SVG('<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="m7.5 9.5 3 2.5-3 2.5M13 15h3.5"/>'),
  bell: SVG('<path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6z"/><path d="M10 19.5a2 2 0 0 0 4 0"/>'),
  stop: SVG('<rect x="7" y="7" width="10" height="10" rx="1.5"/>'),
  x: SVG('<path d="M6 6l12 12M18 6 6 18"/>'),
  check: SVG('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  warn: SVG('<path d="M12 4 3 19h18z"/><path d="M12 10v4"/><path d="M12 16.5h.01"/>'),
  fail: SVG('<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6M15 9l-6 6"/>'),
  merge: SVG('<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 8v8"/><path d="M6 8c0 3 4 4 10 4"/>'),
  chev: SVG('<path d="m9 6 6 6-6 6"/>'),
  down: SVG('<path d="m6 9 6 6 6-6"/>'),
  back: SVG('<path d="m15 6-6 6 6 6"/>'),
  menu: SVG('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  send: SVG('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  info: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5h.01"/>'),
  open: SVG('<path d="M14 5h5v5"/><path d="m19 5-8 8"/><path d="M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"/>'),
};
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const V = ['rivi', 'ryhmat', 'avattava'];
const HOME = 'kasvimaa';
const S = { v: 0, scene: 'a', open: false, ended: false, details: null, stopped: {}, worker: null, tab: null, note: '' };

// ---------- Facts: what the host would know ----------
// state, preserved, summary, branch, created_at and the wait join exist in the spinoffs
// contract today. harness, profile, repo, the end time and "failed" (Taskfleet status
// failed) are Taskfleet facts the contract does not carry yet; see result.md.
const ALL = [
  { id: 'w1', title: 'Kastelun ajastus', st: 'working', waits: true, waitAge: '2 min', age: '18 min', start: '13.52', h: 'Pi', prof: 'oletus', repo: HOME, branch: 'wt/ka2r-kastelun-ajastus' },
  { id: 'w3', title: 'Hakuindeksin päivitys', st: 'working', waits: true, waitAge: '9 min', age: '11 min', start: '13.59', h: 'Pi', prof: 'nopea', repo: 'kirjasto', branch: 'wt/m3qd-hakuindeksi' },
  { id: 'w2', title: 'Lomakkeen saavutettavuus', st: 'working', waits: false, age: '6 min', start: '14.04', h: 'Claude', prof: 'tarkka', repo: HOME, branch: 'wt/b5q3-lomakkeen-saavutettavuus' },
  { id: 'w4', title: 'Sääaseman CSV-vienti', st: 'waiting_parent', waits: false, age: '24 min', start: '13.46', h: 'Pi', prof: 'oletus', repo: HOME, branch: 'wt/r7c1-saaasema-csv' },
  { id: 'e2', title: 'Kasvilajien tuonti', st: 'unmerged', preserved: true, end: '13.20', start: '12.51', h: 'Pi', prof: 'oletus', repo: HOME, branch: 'wt/9xk2-kasvilajien-tuonti', summary: 'Rebase törmäsi tiedostoon lajit.json. Työ on tallessa haarassa.' },
  { id: 'e1', title: 'Kuvien pakkaus', st: 'merged', end: '13.41', start: '13.05', h: 'Pi', prof: 'oletus', repo: HOME, branch: 'wt/k8h2-kuvien-pakkaus', summary: 'Pakkaus siirretty build-vaiheeseen, testit vihreinä. Laskeutui mainiin.' },
  { id: 'e3', title: 'Vanhan rajapinnan poisto', st: 'unmerged', failed: true, end: '12.58', start: '12.30', h: 'Claude', prof: 'tarkka', repo: 'kirjasto', branch: 'wt/t2v9-vanha-rajapinta', summary: 'Kaksi kutsujaa käyttää yhä vanhaa rajapintaa, testit eivät menneet läpi. Worker ei jättänyt tallennettavaa työtä.' },
];
function facts() {
  const runs = (S.scene === 'b' ? ALL.filter(r => !['working', 'waiting_parent'].includes(r.st)) : ALL).map(r => ({ ...r, waited: !!r.waits && !S.stopped[r.id] }));
  const live = runs.filter(r => r.st === 'working' || r.st === 'waiting_parent');
  const ended = runs.filter(r => !live.includes(r));
  return { runs, live, ended, attention: ended.filter(r => r.preserved), agentWaits: live.some(r => r.waited) };
}
const byId = (id) => facts().runs.find(r => r.id === id);

// ---------- Shared words ----------
// What the row's state is, in one short phrase, and the longer sentence a screen reader
// and the details block get.
function stateWord(r) {
  if (r.st === 'working') return r.waited ? 'agentti odottaa' : 'agentti ei odota';
  if (r.st === 'waiting_parent') return 'odottaa pääagenttia';
  if (r.st === 'merged') return 'laskeutui';
  if (r.preserved) return 'ei mergetty · työ tallessa';
  return 'epäonnistui';
}
function stateSentence(r) {
  if (r.st === 'working') return r.waited ? 'Agentti odottaa tätä workeria ja jatkaa, kun se valmistuu.' : 'Agentti ei odota tätä workeria: se ei herää, kun worker valmistuu. Tulos jää tähän paneeliin ja workerin näkymään.';
  if (r.st === 'waiting_parent') return 'Worker on pysähtynyt odottamaan pääagentin vastausta.';
  if (r.st === 'merged') return `Laskeutui klo ${r.end}.`;
  if (r.preserved) return `Päättyi klo ${r.end} mergeämättä. Työ on tallessa haarassa, joten sen voi vielä viedä perille.`;
  return `Epäonnistui klo ${r.end}. Työtä ei jäänyt talteen.`;
}
const tone = (r) => r.st === 'merged' ? 'ok' : r.preserved ? 'attn' : r.failed ? 'err' : r.waited ? 'wait' : 'muted';
function mark(r) {
  if (r.st === 'working') return r.waited ? '<span class="bgw-dot"></span>' : '<span class="nowait-dot"></span>';
  if (r.st === 'waiting_parent') return '<span class="other-dot"></span>';
  if (r.st === 'merged') return `<span class="mark-ic ok">${IC.merge}</span>`;
  if (r.preserved) return `<span class="mark-ic attn">${IC.warn}</span>`;
  return `<span class="mark-ic err">${IC.fail}</span>`;
}
const when = (r) => r.end ?? r.age;
const repoTag = (r) => r.repo !== HOME ? `<span class="tag repo" title="Toinen repositorio kuin tämä keskustelu">${esc(r.repo)}</span>` : '';
const harnessTag = (r) => `<span class="tag h">${r.h}</span>`;
const openBtn = (r, inner, cls = 'row-main') => `<button type="button" class="${cls}" data-act="worker" data-id="${r.id}" aria-label="${esc(`${r.title}: ${stateSentence(r)} Avaa workerin näkymä.`)}">${inner}</button>`;
const stopBtn = (r) => r.waited ? `<button type="button" class="icon-btn stop" data-act="unwait" data-id="${r.id}" aria-label="Lopeta odotus: ${esc(r.title)}" title="Lopettaa agentin odotuksen. Worker jatkaa työtään, eikä agentti herää sen valmistuessa.">${IC.stop}</button>` : '<span class="gap" aria-hidden="true"></span>';

// ---------- 1 Rivi: two-line rows, the wait meaning in the row's own words ----------
function rowRivi(r) {
  const word = `<span class="w-word" data-tone="${tone(r)}">${stateWord(r)}</span>`;
  const sub = `${word}<span class="sep">·</span>${r.h} · ${esc(r.prof)}${r.repo !== HOME ? `<span class="sep">·</span>${repoTag(r)}` : ''}`;
  return `<div class="row two" data-run="${r.id}" data-waited="${r.waited}" data-state="${r.st}">${openBtn(r, `<span class="mark">${mark(r)}</span><span class="lines"><span class="line1"><span class="name">${esc(r.title)}</span><span class="meta">${when(r)}</span></span><span class="line2">${sub}</span></span>`)}${stopBtn(r)}</div>`;
}
function panelRivi(f) {
  const live = f.live.length ? `<div class="group" role="group" aria-label="Workerit: käynnissä">${f.live.map(rowRivi).join('')}</div>` : '<p class="empty">Ei työskenteleviä workereita.</p>';
  return `${live}${endedFold(f, f.ended.map(rowRivi).join(''))}`;
}

// ---------- 2 Ryhmät: the meaning in group headings, rows stay one line ----------
function rowRyhma(r) {
  return `<div class="row" data-run="${r.id}" data-waited="${r.waited}" data-state="${r.st}">${openBtn(r, `<span class="mark">${mark(r)}</span><span class="name">${esc(r.title)}</span>${repoTag(r)}${harnessTag(r)}<span class="meta">${when(r)}</span>`)}${stopBtn(r)}</div>`;
}
function panelRyhmat(f) {
  const group = (key, head, sub, rows) => rows.length ? `<section class="grp" data-group="${key}" aria-label="${esc(head)}"><h3 class="grp-head">${head}<span class="grp-n">${rows.length}</span></h3>${sub ? `<p class="grp-sub">${sub}</p>` : ''}<div class="group">${rows.map(rowRyhma).join('')}</div></section>` : '';
  const working = f.live.filter(r => r.st === 'working');
  const out = [
    group('waited', '<span class="bgw-dot"></span>Agentti odottaa', 'Agentti jatkaa, kun nämä valmistuvat.', working.filter(r => r.waited)),
    group('nowait', '<span class="nowait-dot"></span>Ei odotusta', 'Agentti ei herää, kun nämä valmistuvat.', working.filter(r => !r.waited)),
    group('parent', '<span class="other-dot"></span>Odottaa pääagenttia', 'Worker on pysähtynyt odottamaan vastausta.', f.live.filter(r => r.st === 'waiting_parent')),
    group('attn', `<span class="mark-ic attn">${IC.warn}</span>Työ tallessa, ei mergetty`, 'Haara on yhä olemassa. Avaa worker nähdäksesi, mihin se pysähtyi.', f.attention),
  ].join('');
  const rest = f.ended.filter(r => !r.preserved);
  return `${f.live.length ? '' : '<p class="empty">Ei työskenteleviä workereita.</p>'}${out}${endedFold({ ended: rest, attention: [] }, rest.map(rowRyhma).join(''))}`;
}

// ---------- 3 Avattava: compact rows, the details behind a disclosure ----------
function rowAvattava(r) {
  const open = S.details === r.id;
  const toggle = `<button type="button" class="icon-btn more" data-act="details" data-id="${r.id}" aria-expanded="${open}" aria-label="Tiedot: ${esc(r.title)}" title="Näytä tiedot">${IC.down}</button>`;
  const head = `<div class="row-line">${openBtn(r, `<span class="mark">${mark(r)}</span><span class="name">${esc(r.title)}</span>${repoTag(r)}<span class="meta">${when(r)}</span>`)}${toggle}</div>`;
  if (!open) return `<div class="row det" data-run="${r.id}" data-waited="${r.waited}" data-state="${r.st}">${head}</div>`;
  const dl = [
    ['Ajo', `${r.h} · profiili ${esc(r.prof)}`],
    ['Repositorio', r.repo === HOME ? esc(r.repo) : `${esc(r.repo)} <span class="muted">(ei tämän keskustelun)</span>`],
    ['Haara', `<span class="mono">${esc(r.branch)}</span>`],
    ['Aloitettu', `${r.start}${r.end ? ` · päättyi ${r.end}` : ` · ${r.age} sitten`}`],
    ...(r.summary ? [['Raportti', esc(r.summary)]] : []),
  ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  const actions = `${r.waited ? `<button type="button" class="btn quiet" data-act="unwait" data-id="${r.id}">${IC.stop}Lopeta odotus</button>` : ''}<button type="button" class="btn" data-act="worker" data-id="${r.id}">Avaa workerin näkymä${IC.chev}</button>`;
  return `<div class="row det open" data-run="${r.id}" data-waited="${r.waited}" data-state="${r.st}">${head}<div class="details" data-testid="details"><p class="d-state" data-tone="${tone(r)}">${stateSentence(r)}</p><dl>${dl}</dl><div class="d-actions">${actions}</div></div></div>`;
}
function panelAvattava(f) {
  const live = f.live.length ? `<div class="group" role="group" aria-label="Workerit: käynnissä">${f.live.map(rowAvattava).join('')}</div>` : '<p class="empty">Ei työskenteleviä workereita.</p>';
  return `${live}${endedFold(f, f.ended.map(rowAvattava).join(''))}`;
}

function endedFold(f, rows) {
  if (!f.ended.length) return '';
  const dot = f.attention.length && !S.ended ? '<span class="attn-dot" role="img" aria-label="Vaatii huomiota"></span>' : '';
  return `<div class="endhead"><button type="button" class="endfold" data-act="endfold" aria-expanded="${S.ended}">${IC.chev}<span>${count(f.ended.length, 'päättynyt', 'päättynyttä')}</span>${dot}</button></div>${S.ended ? `<div class="group" role="group" aria-label="Workerit: päättyneet">${rows}</div>` : ''}`;
}

// ---------- The worker pill (Pisteet, as in production) ----------
function spinSentence(f) {
  const w = f.live.filter(r => r.st === 'working');
  return [`Workerit: ${w.length ? `${w.length} työskentelee` : 'ei työskentele'}`,
    f.live.length > w.length ? `${f.live.length - w.length} muussa tilassa` : '',
    w.some(r => r.waited) ? `odotetaan: ${w.filter(r => r.waited).map(r => r.title).join(', ')}` : '',
    w.some(r => !r.waited) ? `${w.filter(r => !r.waited).length} ilman odotusta` : '',
    f.attention.length ? `${f.attention.length} ei mergetty, työ tallessa` : '',
    f.ended.length ? count(f.ended.length, 'päättynyt', 'päättynyttä') : ''].filter(Boolean).join(', ');
}
function strip(f) {
  const marks = f.live.length ? `<span class="marks">${f.live.map(mark).join('')}</span>` : '<span class="n">0</span>';
  const attn = f.attention.length ? '<span class="corner attn" aria-hidden="true"></span>' : '';
  const s = spinSentence(f);
  const pill = `<button type="button" class="pill${f.live.length ? '' : ' idle'}" data-act="pill" data-testid="chip-spin" aria-expanded="${S.open}" aria-label="${esc(s)}" title="${esc(s)}"><span class="ic">${IC.branch}</span>${marks}${attn}</button>`;
  const proc = `<button type="button" class="pill" data-act="toast" data-msg="Prosessit-välilehti ei kuulu tähän kierrokseen." aria-label="Prosessit: 1 käynnissä"><span class="ic">${IC.term}</span><span class="n">1</span></button>`;
  const body = [panelRivi, panelRyhmat, panelAvattava][S.v](f);
  const pop = S.open ? `<div class="pop" data-testid="panel" data-variant="${V[S.v]}"><div class="tabs" role="tablist" aria-label="Taustatyö"><button type="button" role="tab" class="tab" aria-selected="true">${IC.branch}Workerit<span class="tab-n">${f.live.filter(r => r.st === 'working').length}</span></button><button type="button" role="tab" class="tab" aria-selected="false" data-act="toast" data-msg="Prosessit-välilehti ei kuulu tähän kierrokseen.">${IC.term}Prosessit<span class="tab-n">1</span></button><button type="button" class="icon-btn x" data-act="close" aria-label="Sulje">${IC.x}</button></div><div class="pop-body" role="tabpanel">${body}</div></div>` : '';
  return `<section class="strip" aria-label="Taustatyö"><div class="strip-wrap">${pop}<div class="badges" role="group" aria-label="Taustatyö">${pill}${proc}</div></div></section>`;
}

// ---------- The conversation ----------
const user = (t) => `<div class="msg user"><div class="bubble">${t}</div></div>`;
const agent = (t) => `<div class="msg agent"><p>${t}</p></div>`;
function thread() {
  return `<div class="thread">
${user('Aja iltakierros: kastelun ajastus, hakuindeksi ja lomakkeen saavutettavuus workereille. Kerro, kun ensimmäiset ovat valmiita.')}
${agent('Kuvien pakkaus laskeutui jo, ja Kasvilajien tuonti jäi rebase-törmäykseen; sen työ on tallessa. Vanhan rajapinnan poisto epäonnistui, koska kirjastossa on yhä kaksi kutsujaa.')}
${agent('Käynnistin Kastelun ajastuksen ja Hakuindeksin päivityksen ja odotan niitä taustalla. Lomakkeen saavutettavuus on Claude-worker, jota en jää odottamaan: katson sen tuloksen, kun palaat.')}
</div>`;
}

// ---------- The worker's own view (simplified Kehys, proto-worker-view) ----------
function workerView(r) {
  const tab = S.tab ?? (r.h === 'Claude' ? 'term' : 'conv');
  const tabs = `<div class="wv-tabs" role="tablist" aria-label="Workerin näkymä"><button type="button" role="tab" class="tab" data-act="tab" data-tab="conv" aria-selected="${tab === 'conv'}">Keskustelu</button><button type="button" role="tab" class="tab" data-act="tab" data-tab="term" aria-selected="${tab === 'term'}">Pääte</button></div>`;
  const band = `<div class="wv-band" data-testid="worker-view"><button type="button" class="wv-back" data-act="back">${IC.back}Iltakierros</button><div class="wv-id"><span class="wv-kind">Worker</span><strong>${esc(r.title)}</strong></div><div class="wv-meta"><span class="mark">${mark(r)}</span><span class="w-word" data-tone="${tone(r)}">${stateWord(r)}</span><span class="sep">·</span>${r.h} · ${esc(r.prof)}<span class="sep">·</span><span class="mono">${esc(r.repo)}</span></div>${tabs}</div>`;
  const result = r.end ? `<div class="wv-result" data-tone="${tone(r)}"><span class="mark">${mark(r)}</span><div><strong>${r.st === 'merged' ? 'Laskeutui' : r.preserved ? 'Ei mergetty · työ tallessa' : 'Epäonnistui'}</strong><p>${esc(r.summary)}</p></div></div>` : '';
  const conv = `<div class="thread">
<div class="msg user brief"><div class="bubble"><span class="who">Pääagentti · tehtävä</span>${esc(r.title)}: tee muutos haarassa <span class="mono">${esc(r.branch)}</span>, aja testit ja vie perille.</div></div>
<div class="msg agent"><span class="who">Worker</span><p>Luin tehtävän ja nykyisen toteutuksen. Muutan ensin testit kuvaamaan uuden käytöksen.</p></div>
<div class="msg agent"><span class="who">Worker</span><p>${r.end ? esc(r.summary) : 'Testit kirjoitettu; toteutus on puolivälissä.'}</p></div>
${result}</div>`;
  const term = `<div class="thread">${r.h === 'Claude' ? '<p class="wv-why">Habitat ei vielä lue Claude Coden historiaa, joten workerin työ näkyy päätteenä.</p>' : ''}<pre class="wv-term">${r.end ? '[ikkuna suljettu, kun ajo päättyi]' : `$ npm test\n  ✓ 41 testiä läpi (2,3 s)\n$ npx playwright test lomake\n  … ajossa`}</pre>${result}</div>`;
  return `<div class="topbar"><button type="button" class="icon-btn menu" aria-label="Avaa valikko">${IC.menu}</button><div class="title"><strong>${esc(r.title)}</strong><span class="mono">${esc(r.repo)}</span></div><button type="button" class="icon-btn" aria-label="Tiedot">${IC.info}</button></div>
${band}
<div class="scroll">${tab === 'conv' ? conv : term}</div>
<div class="wv-notice"><p><strong>Workerille ei kirjoiteta suoraan.</strong> ${r.end ? 'Pääagentilla on sen raportti.' : r.h === 'Pi' ? 'Pääagentti voi lähettää sille viestin.' : 'Pääagentti näkee sen tilan.'}</p><button type="button" class="btn quiet" data-act="back">Kysy pääkeskustelussa ›</button></div>`;
}

// ---------- Frame ----------
function rail(f) {
  const row = (t, m, cur) => `<a href="#" class="conv${cur ? ' cur' : ''}" data-act="${cur ? 'back' : 'toast'}" data-msg="Vain Iltakierros on auki tässä kokeessa."${cur ? ' aria-current="page"' : ''}><span>${t}</span>${m}</a>`;
  return `<aside class="rail" aria-label="Työtilat"><div class="brand">Habitat</div><div class="ws">${HOME}</div>
${row('Iltakierros', f.agentWaits ? '<span class="bgw-dot" role="img" aria-label="Odottaa taustatyötä"></span>' : '<span class="wait-ring" role="img" aria-label="Odottaa sinua"></span>', true)}
${row('Sääaseman kalibrointi', `<span class="done">${IC.check}</span>`)}
<div class="ws">kirjasto</div>${row('Hakusanojen negaatiot', '<span class="wait-ring" role="img" aria-label="Odottaa sinua"></span>')}</aside>`;
}
function view() {
  const f = facts();
  const r = S.worker && byId(S.worker);
  let main;
  if (r) main = workerView(r);
  else {
    const state = f.agentWaits ? `<span class="state" title="Odotetaan: ${esc(f.live.filter(x => x.waited).map(x => x.title).join(', '))}"><span class="bgw-dot"></span>Odottaa taustatyötä</span>` : '<span class="state"><span class="wait-ring"></span>Odottaa sinua</span>';
    main = `<div class="topbar"><button type="button" class="icon-btn menu" aria-label="Avaa valikko">${IC.menu}</button><div class="title"><strong>Iltakierros</strong><span class="mono">${HOME}</span></div>${state}<button type="button" class="icon-btn" aria-label="Tiedot">${IC.info}</button></div>
<div class="scroll">${thread()}</div>
${strip(f)}
<div class="composer"><div class="cbox"><textarea aria-label="Viesti" placeholder="Kirjoita agentille…" rows="1"></textarea><button type="button" class="icon-btn send" data-act="toast" data-msg="Kokeessa viestiä ei lähetetä." aria-label="Lähetä">${IC.send}</button></div></div>`;
  }
  return `<div class="app v-${V[S.v]}" data-variant="${V[S.v]}">${rail(f)}<div class="main${r ? ' worker' : ''}">${main}<p class="toast" role="status">${esc(S.note)}</p></div></div>`;
}
function repaint(focusSel) {
  const el = document.getElementById('stage');
  el.innerHTML = view();
  if (focusSel) el.querySelector(focusSel)?.focus();
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('#stage [data-act]'); if (!t) return;
  e.preventDefault();
  const a = t.dataset.act; let focus = null;
  S.note = '';
  if (a === 'pill') { S.open = !S.open; focus = '.pill[data-act="pill"]'; }
  else if (a === 'close') { S.open = false; focus = '.pill[data-act="pill"]'; }
  else if (a === 'endfold') { S.ended = !S.ended; focus = '.endfold'; }
  else if (a === 'details') { S.details = S.details === t.dataset.id ? null : t.dataset.id; focus = `.more[data-id="${t.dataset.id}"]`; }
  else if (a === 'unwait') { S.stopped[t.dataset.id] = true; S.note = 'Odotus lopetettiin. Worker jatkaa työtään, eikä agentti herää sen valmistuessa.'; focus = '.pop .x'; }
  else if (a === 'worker') { S.worker = t.dataset.id; S.tab = null; S.open = false; focus = '.wv-back'; }
  else if (a === 'back') { if (!S.worker) return; S.worker = null; focus = '.pill[data-act="pill"]'; }
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
document.getElementById('scene').addEventListener('change', (e) => { S.scene = e.target.value; S.stopped = {}; S.note = ''; S.worker = null; repaint(); });
const start = (i) => () => { Object.assign(S, { v: i, open: false, ended: false, details: null, stopped: {}, worker: null, tab: null, note: '' }); return view(); };
window.PROTO = { S, repaint };
window.variants = V.map((_, i) => start(i));
})();
const variants = window.variants;
