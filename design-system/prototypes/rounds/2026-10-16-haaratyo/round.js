// Kierros 16.10.2026: haaratyö eli Taskfleetin worktree-agentti selaimessa (issue
// proto-worktree-agents, arkkitehtuuri issues/manage-agent-worktrees/architecture.md).
// Työtilasivulla aloitetaan haaratyö (+ → Uusi haaratyö); Taskfleet luo ajon ja worktreen,
// daemon käynnistää Pi:n siihen. Haaratyö joko yhdistää itse tai kysyy ensin. Tilat:
// luodaan, työskentelee, odottaa sinua, yhdistetään, yhdistetty, ei yhdistetty (työ
// tallessa), agentti pysähtyi ja terminaalissa (vain luku). Suunnat eroavat siinä, mitä
// haaratyö näkymässä on: keskustelu, tehtävä vai paikka. Sisältö on sama kaikissa.
(() => {
const ICON_BRANCH = SVG('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10"/><path d="M18 10c0 4-6 3-12 7"/>');
const ICON_MERGE = SVG('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="14" r="2"/><path d="M6 7v10"/><path d="M6 7c0 5 6 7 10 7"/>');
const ICON_CHAT = SVG('<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M9 10.5h.01M12 10.5h.01M15 10.5h.01"/>');
const ICON_TERM = SVG('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m7 10 3 2-3 2"/><path d="M12 15h5"/>');
const ICON_WARN = SVG('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5"/><path d="M12 17.2h.01"/>');
const ICON_FWD = SVG('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>');
const ICON_PLAY = SVG('<path d="M8 5.5v13l10-6.5z"/>');
const ICON_DOWN = SVG('<path d="m6 9 6 6 6-6"/>');

// ---------- Fixture: one workspace, six worktree runs in every state ----------
const WSID = 'aurinkokello';
const SRC = { branch: 'main', head: 'a41c9e0', dirty: 2, path: '~/src/aurinkokello' };
const WTROOT = '~/src/aurinkokello__worktrees';
const RUNS = [
  { id: 'r1', mode: 'ask', st: 'waiting', title: 'JSON-tuloste statusriveille', slug: 'k4x-json-tuloste', t: '6 min',
    rid: '01m51c7k2qv8d4hx9tbn3fr6wa', pi: '6f1d2a90-3c4b-4e7a-9d21-0b8e5f7c3a14', started: '15.10. klo 13.40',
    task: 'Lisää `scripts/status_rows.py`:hin `--json`-lippu, joka tulostaa viime viikon rivit listana. Kysy ennen kuin yhdistät.',
    reply: 'Lisäsin `--json`-lipun: jokainen rivi on objekti, jossa ovat `date`, `target`, `state` ja `note`. Testit menevät läpi (`pytest`: 14 ok). Haarassa on 2 committia, +58 −3.\n\nYhdistänkö main-haaraan?',
    say: 'Valmis: 2 committia, testit läpi. Yhdistänkö main-haaraan?', diff: { commits: 2, add: 58, del: 3 } },
  { id: 'r2', mode: 'auto', st: 'working', title: 'Aikavyöhyke tulosteeseen', slug: 'p8d-aikavyohyke', t: 'nyt',
    rid: '01m51d2p8sx4k7mf3vq9hc1jzt', pi: 'a3c95e12-77d0-4f3b-8a6e-2d4b1c9f0e57', started: '15.10. klo 14.05',
    task: 'Näytä tulosteen aikaleimat paikallisessa aikavyöhykkeessä ja lisää `--utc`-lippu vanhaa muotoa varten.',
    doing: 'Ajaa <span class="mono">pytest</span>', clock: 192 },
  { id: 'r3', mode: 'auto', st: 'merged', title: 'README-esimerkit ajan tasalle', slug: 'a2c-readme', t: '14.22',
    rid: '01m50y9e4rk2n8bw6dq3tg7hsm', pi: '0c7e4b21-9a85-4d16-b3f2-6e1a8d5c9b40', started: '15.10. klo 13.58',
    task: 'Päivitä README:n esimerkit vastaamaan nykyisiä lippuja ja tarkista ne ajamalla.',
    reply: 'Esimerkit on päivitetty ja jokainen ajettu: kolme vanhentunutta lippua korjattu, `--since`-esimerkki lisätty. Testit menevät läpi. Yhdistin haaran main-haaraan.',
    out: { commit: '9f3e1c2', commits: 3, add: 42, del: 8, at: '14.22' } },
  { id: 'r4', mode: 'auto', st: 'failed', title: 'Maanantain CI-aikakatkaisu', slug: 'm7q-ci-aikakatkaisu', t: '38 min',
    rid: '01m51a6h3wq9z2kc8vn4mr7tdx', pi: 'd8b2f6c4-1e39-4a7d-92c5-7f0e3b6a1d28', started: '15.10. klo 12.51',
    task: 'Selvitä, miksi CI aikakatkaistaan maanantaiaamuisin, ja korjaa se.',
    reply: 'Syy on välimuisti, joka vanhenee viikonlopun yli: maanantain ensimmäinen ajo rakentaa riippuvuudet alusta ja ylittää 10 minuutin rajan. Nostin rajan 20 minuuttiin ja lisäsin välimuistin avaimeen viikon numeron.\n\nYhdistäminen ei onnistunut: `.github/workflows/ci.yml` on muuttunut main-haarassa haaran luomisen jälkeen.',
    say: 'Konflikti tiedostossa <span class="mono">ci.yml</span>; haara ja worktree ovat tallessa.',
    fail: { reason: 'Konflikti: <span class="mono">.github/workflows/ci.yml</span> on muuttunut main-haarassa haaran luomisen jälkeen.', commits: 2, dirty: 1 } },
  { id: 'r5', mode: 'ask', st: 'lost', title: 'Lokitason värit päätteessä', slug: 'r3n-lokivarit', t: '13.52',
    rid: '01m50z3t7kd1q9fx5bw8nh2rcv', pi: '41e7a0d3-5b62-4c98-8f1e-9a3d7c2b6e05', started: '15.10. klo 13.31',
    task: 'Väritä lokitason sana tulosteessa, kun tuloste menee päätteeseen. Kysy ennen yhdistämistä.',
    reply: 'Lisäsin värit `colorize()`-funktioon; `NO_COLOR` ja putkitettu tuloste ohittavat ne. Seuraavaksi testit päätteettömälle tulosteelle.',
    say: 'Pysähtyi palvelimen uudelleenkäynnistyksessä; haara ja historia tallessa.' },
  { id: 'r6', mode: 'auto', st: 'terminal', title: 'Riippuvuuksien päivitys', slug: 't5h-riippuvuudet', t: '1 t',
    rid: '01m51b8n5vr3k6hw2qz9td4mfy', pi: null, started: '15.10. klo 13.12',
    task: 'Päivitä riippuvuudet ja aja testit.',
    reply: 'Päivitetty 6/9 riippuvuutta; `rich` 14 → 15 vaatii muutoksen taulukon tulostukseen, teen sen seuraavaksi.',
    say: 'Aloitettu terminaalista; keskustelu on vain luku.' },
];
const RS = {
  creating: ['Luodaan', '<span class="st-dot working"></span>'],
  working: ['Työskentelee', '<span class="st-dot working"></span>'],
  merging: ['Yhdistetään', '<span class="st-dot working"></span>'],
  waiting: ['Odottaa sinua', '<span class="st-dot waiting"></span>'],
  merged: ['Yhdistetty', `<span class="wt-mk merged">${ICON_MERGE}</span>`],
  failed: ['Ei yhdistetty · työ tallessa', `<span class="wt-mk failed">${ICON_WARN}</span>`],
  lost: ['Agentti pysähtyi', '<span class="st-dot unknown"></span>'],
  terminal: ['Terminaalissa · vain luku', `<span class="wt-mk term">${ICON_TERM}</span>`],
};
const ORDER = { waiting: 0, failed: 1, lost: 2, creating: 3, working: 3, merging: 3, terminal: 4, merged: 9 };
const MODES = {
  auto: ['Yhdistää itse', ICON_MERGE, 'Agentti yhdistää haaran itse, kun työ on valmis'],
  ask: ['Kysyy ensin', ICON_CHAT, 'Agentti odottaa lupaasi ennen yhdistämistä'],
};
// Three separate facts (design.md of decide-taskfleet-browser-integration): Taskfleet run,
// Pi activity and browser control are different things.
const FACTS = {
  creating: ['Luodaan', 'Käynnistyy', '—'],
  working: ['Auki', 'Työskentelee', 'Selain'],
  merging: ['Yhdistetään', 'Lopettaa', 'Suljettu'],
  waiting: ['Auki', 'Odottaa', 'Selain'],
  merged: ['Valmis · yhdistetty', 'Lopetettu', 'Vain luku'],
  failed: ['Auki · yhdistäminen epäonnistui', 'Odottaa', 'Selain'],
  lost: ['Auki', 'Ei käynnissä', 'Ei ohjausta'],
  terminal: ['Auki', 'Terminaalissa', 'Vain luku'],
};
const STEPS = ['Taskfleet-ajo luotu', 'Worktree ja haara valmiina', 'Pi käynnistyi'];

let CUR = 'v1', VIEW = 'ws', RUN = null, MENU = false, MADE = 0, WTFOLD = true, MERGEDFOLD = false;
const runOf = (id) => RUNS.find(r => r.id === id);
const ws = () => UI.ws.find(w => w.id === WSID);
const branch = (r) => `wt/${r.slug}`;
const wtPath = (r) => `${WTROOT}/wt-${r.slug}`;
const mark = (r) => `<span class="st" role="img" aria-label="${RS[r.st][0]}" title="${RS[r.st][0]}">${RS[r.st][1]}</span>`;
const brTag = (r, cls = '') => `<span class="wt-br mono ${cls}" title="Haara ${branch(r)}">${ICON_BRANCH}<span>${esc(r.slug)}</span></span>`;
const modeTag = (r, label = true) => { const [l, ic, tip] = MODES[r.mode]; return `<span class="wt-mode ${r.mode}" title="${tip}"${label ? '' : ` role="img" aria-label="${l}"`}>${ic}${label ? `<span>${l}</span>` : ''}</span>`; };
const elapsed = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
// One line of what is going on, for rows and cards.
function doing(r) {
  if (r.st === 'creating') return `${STEPS[Math.min(r.step, 2)]}…`;
  if (r.st === 'working') return `${r.doing || 'Työskentelee'} · <span class="wt-clock" data-t0="${r.t0}">${elapsed(Math.round((performance.now() - r.t0) / 1000))}</span>`;
  if (r.st === 'merging') return 'Yhdistää main-haaraan…';
  if (r.st === 'merged') return `main-haaraan <span class="mono">${r.out.commit}</span> · ${r.out.commits} committia`;
  return r.say || '';
}
for (const r of RUNS) if (r.st === 'working') r.t0 = performance.now() - r.clock * 1000;
const convs = () => ws().convs.filter(c => !c.archived);
const cst = (c) => convState(c);

// ---------- Sidebar: the workspace's list per direction ----------
const runRow = (r, cls = '') => `<a href="#" class="conv-row wt-row ${cls}" data-run="${r.id}"${VIEW === 'run' && RUN === r.id ? ' aria-current="page"' : ''} title="${esc(r.title)} · ${branch(r)}"><span class="wt-glyph">${ICON_BRANCH}</span><span class="conv-title">${esc(r.title)}</span>${mark(r)}</a>`;
const childRow = (r) => `<a href="#" class="conv-row wt-child" data-run="${r.id}"${VIEW === 'run' && RUN === r.id ? ' aria-current="page"' : ''} title="${esc(r.title)}"><span class="wt-tree" aria-hidden="true"></span><span class="wt-glyph">${ICON_BRANCH}</span><span class="conv-title mono">${esc(r.slug)}</span>${mark(r)}</a>`;
const activeRuns = () => RUNS.filter(r => r.st !== 'merged').sort((a, b) => ORDER[a.st] - ORDER[b.st]);
const mergedRuns = () => RUNS.filter(r => r.st === 'merged');
const libList = APP.list;
APP.list = (w, cs) => {
  if (w.id !== WSID) return libList(w, cs);
  const fold = (key, label, n, open, rows) => n ? `<li><button type="button" class="done-fold" data-wt-fold="${key}" aria-expanded="${open}">${CHEV}<span>${label}</span><span class="count">${n}</span></button></li>${open ? rows : ''}` : '';
  if (CUR === 'v1') {
    // One list: conversations and worktree runs together in attention order.
    const conv = cs.filter(c => cst(c) !== 'done').map(c => ({ o: (STATE_ORDER[cst(c)] ?? 4) - .5, h: APP.row(c) }));
    const runs = activeRuns().map(r => ({ o: ORDER[r.st], h: runRow(r) }));
    const rows = [...conv, ...runs].sort((a, b) => a.o - b.o).map(x => `<li>${x.h}</li>`).join('');
    const done = [...cs.filter(c => cst(c) === 'done').map(c => APP.row(c)), ...mergedRuns().map(r => runRow(r))];
    const open = FOLDED[w.id] || (VIEW === 'run' && runOf(RUN)?.st === 'merged');
    return `<ul class="convs">${rows}${fold('done', 'Valmiit', done.length, open, done.map(h => `<li>${h}</li>`).join(''))}</ul>`;
  }
  const base = libList(w, cs).replace(/^<ul class="convs">|<\/ul>$/g, '');
  if (CUR === 'v2') {
    const rows = [...activeRuns(), ...mergedRuns()].map(r => `<li>${runRow(r, 'in-group')}</li>`).join('');
    return `<ul class="convs">${base}${fold('wt', 'Haaratyöt', RUNS.length, WTFOLD, rows)}</ul>`;
  }
  // v3: worktrees are places under the workspace, named by their branch.
  const kids = activeRuns().map(r => `<li>${childRow(r)}</li>`).join('');
  const merged = fold('merged', 'Yhdistetyt haarat', mergedRuns().length, MERGEDFOLD || (VIEW === 'run' && runOf(RUN)?.st === 'merged'), mergedRuns().map(r => `<li class="wt-kid">${childRow(r)}</li>`).join(''));
  return `<ul class="convs">${base}</ul><ul class="convs wt-kids" aria-label="Haarat: ${WSID}">${kids}${merged}</ul>`;
};

// ---------- Workspace page ----------
const gitLine = () => `<span class="git mono">${ICON_BRANCH}${SRC.branch}<span class="dirty" title="${SRC.dirty} tallentamatonta muutosta">+${SRC.dirty}</span></span>`;
const newMenu = () => `<span class="h-anchor"><button type="button" class="h-primary" data-wt-menu aria-haspopup="menu" aria-expanded="${MENU}">${ICON_PLUS}<span>Uusi</span>${ICON_DOWN}</button>${MENU ? `<div class="h-menu wt-menu" role="menu" aria-label="Uusi työtilassa ${WSID}">
<button type="button" role="menuitem" data-wt-newconv>${ICON_CHAT}<span><strong>Keskustelu</strong><small>tässä työtilassa, haarassa main</small></span></button>
<button type="button" role="menuitem" data-wt-new>${ICON_BRANCH}<span><strong>Haaratyö…</strong><small>oma haara ja worktree Taskfleetin kautta</small></span></button>
</div>` : ''}</span>`;
function pageHead() {
  const open = activeRuns().length, waiting = RUNS.filter(r => ['waiting', 'failed', 'lost'].includes(r.st)).length;
  return `<header class="h-head"><div><h1 class="mono">${WSID}</h1><p class="h-sub"><span class="mono">${SRC.path}</span> · ${gitLine()} · ${open} haaratyötä${waiting ? ` · <strong>${waiting} odottaa sinua</strong>` : ''}</p></div><div class="h-acts">${newMenu()}</div></header>`;
}
const convHrow = (c) => { const [l, m] = STATES[cst(c)] ?? ['Ei aloitettu', '<span class="st-none"></span>']; return `<a href="#" class="hrow" data-conv="${c.id}"><span class="st" role="img" aria-label="${l}" title="${l}">${m}</span><span class="hrow-title">${esc(c.title)}</span><span class="hrow-doing">${l}</span></a>`; };
const runHrow = (r) => `<a href="#" class="hrow wt-hrow st-${r.st}" data-run="${r.id}">${mark(r)}<span class="hrow-main"><span class="hrow-title">${esc(r.title)}</span><span class="hrow-sub">${brTag(r)}${modeTag(r, false)}<span class="hrow-doing">${doing(r)}</span></span></span><time>${r.t}</time></a>`;
const convSection = (h = 'Keskustelut') => {
  const act = convs().filter(c => cst(c) !== 'done').sort((a, b) => (STATE_ORDER[cst(a)] ?? 4) - (STATE_ORDER[cst(b)] ?? 4));
  const done = convs().filter(c => cst(c) === 'done');
  return `<section aria-labelledby="wc-h"><h2 id="wc-h">${h}</h2><div class="hrows">${act.map(convHrow).join('')}${done.length ? `<button type="button" class="hrow fold-row" data-wt-pfold="convdone" aria-expanded="${!!PF.convdone}">${CHEV}<span class="hrow-title">Valmiit</span><span class="count">${done.length}</span></button>${PF.convdone ? done.map(convHrow).join('') : ''}` : ''}</div></section>`;
};
const PF = {};
const facts = (r) => { const [run, pi, ctl] = FACTS[r.st]; return `<dl class="wt-facts"><div><dt>Ajo</dt><dd>${run}</dd></div><div><dt>Pi</dt><dd>${pi}</dd></div><div><dt>Ohjaus</dt><dd>${ctl}</dd></div></dl>`; };
const stepsList = (r) => `<ol class="wt-steps">${STEPS.map((s, i) => `<li class="${i < r.step ? 'done' : i === r.step ? 'now' : ''}">${i < r.step ? ICON_CHECK : i === r.step ? '<span class="st-dot working"></span>' : '<span class="st-none"></span>'}<span>${i === 1 && i < r.step ? `${s}: <span class="mono">${branch(r)}</span>` : s}</span></li>`).join('')}</ol>`;
const goLabel = (r) => ({ waiting: 'Vastaa', failed: 'Katso tulos', lost: 'Jatka', merged: 'Lue keskustelu', terminal: 'Lue' })[r.st] || 'Avaa';
function runCard(r, { go = true } = {}) {
  return `<article class="wtc st-${r.st}">
<${go ? `a href="#" data-run="${r.id}"` : 'div'} class="wtc-head">${mark(r)}<strong>${esc(r.title)}</strong><span class="kc-grow"></span><time>${r.t}</time></${go ? 'a' : 'div'}>
<div class="wtc-meta">${brTag(r)}${modeTag(r)}</div>
${facts(r)}
${r.st === 'creating' ? stepsList(r) : `<p class="wtc-say">${doing(r)}</p>`}
${go ? `<a href="#" class="kc-go" data-run="${r.id}">${goLabel(r)}${ICON_FWD}</a>` : ''}
</article>`;
}
// v3 lane: the trunk on the left, each worktree forks from it; a merged one returns.
function lane(r) {
  return `<li class="lane st-${r.st}"><span class="lane-g" aria-hidden="true"><span class="fork"></span>${r.st === 'merged' ? '<span class="join"></span>' : ''}<span class="knot">${RS[r.st][1]}</span></span>
<a href="#" class="lane-body" data-run="${r.id}"><span class="lane-top"><span class="lane-name mono">${ICON_BRANCH}${esc(r.slug)}</span>${modeTag(r, false)}<time>${r.t}</time></span><span class="lane-title">${esc(r.title)}</span><span class="lane-st">${mark(r)}<span>${RS[r.st][0]}</span>${r.st === 'creating' || r.st === 'working' || r.st === 'merged' ? ` · ${doing(r)}` : ''}</span></a></li>`;
}
function page() {
  run++;
  if (CUR === 'v1') {
    const act = [...convs().filter(c => cst(c) !== 'done').map(c => ({ o: (STATE_ORDER[cst(c)] ?? 4) - .5, h: convHrow(c) })), ...activeRuns().map(r => ({ o: ORDER[r.st], h: runHrow(r) }))].sort((a, b) => a.o - b.o);
    const done = [...convs().filter(c => cst(c) === 'done').map(convHrow), ...mergedRuns().map(runHrow)];
    return `<div class="home wsp w1">${pageHead()}
<section aria-labelledby="w1-h"><h2 id="w1-h">Keskustelut ja haaratyöt</h2><div class="hrows">${act.map(x => x.h).join('')}<button type="button" class="hrow fold-row" data-wt-pfold="done" aria-expanded="${!!PF.done}">${CHEV}<span class="hrow-title">Valmiit</span><span class="count">${done.length}</span></button>${PF.done ? done.join('') : ''}</div></section></div>`;
  }
  if (CUR === 'v2') {
    return `<div class="home wsp w2">${pageHead()}${convSection()}
<section aria-labelledby="w2-h"><h2 id="w2-h">Haaratyöt <span class="count">${activeRuns().length}</span><button type="button" class="h-link" data-wt-new>${ICON_PLUS}Uusi haaratyö</button></h2>
<div class="wtgrid">${activeRuns().map(r => runCard(r)).join('')}</div>
${mergedRuns().length ? `<div class="hrows wt-merged-rows"><button type="button" class="hrow fold-row" data-wt-pfold="merged" aria-expanded="${!!PF.merged}">${CHEV}<span class="hrow-title">Yhdistetyt</span><span class="count">${mergedRuns().length}</span></button>${PF.merged ? mergedRuns().map(runHrow).join('') : ''}</div>` : ''}</section></div>`;
  }
  const lanes = [...activeRuns(), ...mergedRuns()];
  return `<div class="home wsp w3">${pageHead()}
<section aria-labelledby="w3-h"><h2 id="w3-h">Haarat</h2><ol class="lanes">
<li class="lane trunk"><span class="lane-g" aria-hidden="true"><span class="knot">${ICON_BRANCH}</span></span><div class="lane-body"><span class="lane-top"><span class="lane-name mono">${SRC.branch}</span><span class="mono lane-head">${SRC.head}</span></span><span class="lane-title">Työtilan oma checkout · <span class="mono">${SRC.path}</span></span><span class="lane-st"><span class="dirty mono">+${SRC.dirty}</span> tallentamatonta muutosta</span></div></li>
${lanes.map(lane).join('')}</ol></section>
${convSection('Keskustelut haarassa main')}</div>`;
}

// ---------- Conversation of one worktree run ----------
const reply = (text, time = '') => `<article class="bubble reply wt-reply"><div class="bar head"><span class="ok">${ICON_CHECK}Vastaus valmis</span><span class="model">${MODEL}</span>${copyBtn('Kopioi vastaus', text)}<time class="meta">${time}</time></div><div class="prose">${md(text)}</div></article>`;
const cmd = (c) => `<div class="wt-cmd"><code class="mono">${esc(c)}</code>${copyBtn('Kopioi komento', c)}</div>`;
function outcome(r) {
  if (r.st === 'waiting' && r.diff) return `<section class="wt-out ready" aria-label="Valmis yhdistettäväksi"><header>${ICON_MERGE}<strong>Valmis yhdistettäväksi</strong><span class="kc-grow"></span><span class="mono wt-diff">${r.diff.commits} committia · <span class="add">+${r.diff.add}</span> <span class="del">−${r.diff.del}</span></span></header>
<p>Haara <span class="mono">${branch(r)}</span> → <span class="mono">${SRC.branch}</span>. Agentti yhdistää Taskfleetin kautta, kun annat luvan.</p>
<div class="wt-acts"><button type="button" class="h-primary" data-wt-act="merge">${ICON_MERGE}Yhdistä main-haaraan</button><button type="button" class="h-secondary" data-wt-act="change">Pyydä muutoksia</button></div></section>`;
  if (r.st === 'merged') return `<section class="wt-out merged" aria-label="Yhdistetty"><header>${ICON_MERGE}<strong>Yhdistetty main-haaraan</strong><span class="kc-grow"></span><time>${r.out.at}</time></header>
<dl class="wt-kv"><dt>Commit</dt><dd><span class="mono">${r.out.commit}</span>${copyBtn('Kopioi commit', r.out.commit)}</dd><dt>Muutokset</dt><dd class="mono">${r.out.commits} committia · <span class="add">+${r.out.add}</span> <span class="del">−${r.out.del}</span></dd><dt>Siivous</dt><dd>Worktree ja haara <span class="mono">${branch(r)}</span> poistettu; Taskfleetin raportti ja tämä keskustelu säilyvät.</dd></dl></section>`;
  if (r.st === 'failed') return `<section class="wt-out failed" aria-label="Ei yhdistetty, työ tallessa"><header>${ICON_WARN}<strong>Ei yhdistetty · työ on tallessa</strong></header>
<p>${r.fail.reason}</p>
<dl class="wt-kv"><dt>Haara</dt><dd><span class="mono">${branch(r)}</span> · ${r.fail.commits} committia</dd><dt>Worktree</dt><dd><span class="mono">${wtPath(r)}</span> · ${r.fail.dirty} tallentamaton tiedosto</dd></dl>
<div class="wt-acts"><button type="button" class="h-primary" data-wt-act="resolve">Pyydä agenttia ratkaisemaan</button></div>
<details class="wt-cli"><summary>${CHEV}Komentorivillä</summary><p>Peruminen ja tallessa olevan työn hylkääminen tehdään Taskfleetillä.</p>${cmd(`taskfleet run show ${r.rid}`)}${cmd(`taskfleet run cancel ${r.rid} --settlement-key <avain> --note "<syy>"`)}</details></section>`;
  if (r.st === 'lost') return `<div class="wt-note" role="note">${ICON_WARN}<span>Pi pysähtyi klo 13.52, kun palvelin käynnistyi uudelleen. Taskfleet-ajo on yhä auki; haara, worktree ja historia ovat tallessa.</span></div>`;
  if (r.st === 'terminal') return `<div class="wt-note" role="note">${ICON_TERM}<span>Tämä haaratyö aloitettiin terminaalista, ja agentti ajaa tmux-ikkunassa <span class="mono">wt-${r.slug}</span>. Selain näyttää keskustelun.</span></div>`;
  return '';
}
const startRow = (r) => `<div class="wt-start" role="note">${ICON_BRANCH}<span>Haaratyö alkoi ${r.started.replace('15.10. ', '')} · <span class="mono">${branch(r)}</span> haarasta <span class="mono">${SRC.branch}</span> @ <span class="mono">${SRC.head}</span> · ${MODES[r.mode][0].toLowerCase()}</span></div>`;
function convo(r) {
  run++;
  const parts = [CUR === 'v2' ? runCard(r, { go: false }) : startRow(r)];
  if (r.st === 'creating') parts.push(stepsList(r));
  parts.push(userBubble({ md: r.task, time: r.started.split('klo ')[1] }, 0));
  if (r.reply) parts.push(reply(r.reply, r.t.includes('.') ? r.t : ''));
  for (const x of r.extra || []) parts.push(x.user ? userBubble({ md: x.user, time: 'nyt' }, 0) : reply(x.reply, 'nyt'));
  if (r.st === 'working' || r.st === 'merging') parts.push(`<div class="strip working wt-work"><span class="act"><span class="live-dot"></span>${r.st === 'merging' ? 'Yhdistää main-haaraan' : r.doing || 'Työskentelee'}</span><span class="clock wt-clock" data-t0="${r.t0}">${elapsed(Math.round((performance.now() - r.t0) / 1000))}</span></div>`);
  parts.push(outcome(r));
  return `<div class="wt-convo">${parts.join('')}</div>`;
}
// Clocks: update only the text (lib/AGENTS.md: never repaint a live row for the clock).
setInterval(() => document.querySelectorAll('.wt-clock[data-t0]').forEach(el => { el.textContent = elapsed(Math.max(0, Math.round((performance.now() - +el.dataset.t0) / 1000))); }), 1000);

// ---------- Frame: top bar, dock under the conversation, details ----------
const dock = document.createElement('div'); dock.className = 'wt-dock'; dock.setAttribute('role', 'status');
const comp = document.querySelector('.composer'); comp.parentNode.insertBefore(dock, comp);
const RO = { merged: 1, terminal: 1, lost: 1, creating: 1, merging: 1 };
function dockHtml(r) {
  if (r.st === 'merged') return `${ICON_MERGE}<span>Yhdistetty ja worktree poistettu, joten keskustelua ei voi jatkaa. Se säilyy luettavana.</span>`;
  if (r.st === 'terminal') return `${ICON_TERM}<span>Ajaa terminaalissa · vain luku. Kirjoita agentille sen tmux-ikkunassa.</span>`;
  if (r.st === 'lost') return `<span>Agentti ei ole käynnissä. Jatka käynnistää Pi:n samaan worktreehen ja samaan keskusteluun.</span><button type="button" class="h-primary" data-wt-act="resume">${ICON_PLAY}Jatka</button>`;
  if (r.st === 'merging') return `<span class="st-dot working"></span><span>Yhdistetään. Kun yhdistäminen on alkanut, agentille ei voi enää kirjoittaa.</span>`;
  return `<span class="st-dot working"></span><span>Haaratyö käynnistyy: ${STEPS[Math.min(r.step, 2)].toLowerCase()}…</span>`;
}
function runTop(r) {
  const [l, m] = RS[r.st];
  const sub = CUR === 'v3'
    ? `<span class="tb-sub wt-crumb"><a href="#" class="tb-ws" data-wt-ws>${WSID}</a><span aria-hidden="true">/</span><a href="#" class="tb-ws mono" data-run="${r.id}">${ICON_BRANCH}${esc(r.slug)}</a></span>`
    : `<span class="tb-sub"><a href="#" class="tb-ws" data-wt-ws>${WSID}</a>${brTag(r)}</span>`;
  return `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button>
<div class="tb-title"><strong>${esc(r.title)}</strong>${sub}</div>
<div class="tb-right"><span class="chip ${r.st === 'waiting' ? 'waiting' : r.st}" role="status">${m}<span class="chip-label">${l}</span></span>${modeTag(r)}<span class="tb-actions"><button class="icon-btn tb-btn" type="button" data-ui="info" aria-label="Tiedot" title="Tiedot" aria-expanded="${UI.pop}">${ICON_INFO}</button></span></div>`;
}
function runDetails(r) {
  const [run, pi, ctl] = FACTS[r.st];
  return `<h3>Haaratyö</h3><dl class="facts">
<dt>Haara</dt><dd><span class="mono">${branch(r)}</span>${copyBtn('Kopioi haara', branch(r))}</dd>
<dt>Worktree</dt><dd>${r.st === 'merged' ? '<span class="sub">poistettu yhdistämisen jälkeen</span>' : `<span class="mono">${wtPath(r)}</span>`}</dd>
<dt>Lähtökohta</dt><dd><span class="mono">${SRC.branch} @ ${SRC.head}</span></dd>
<dt>Kun valmis</dt><dd>${MODES[r.mode][0]}</dd>
<dt>Taskfleet-ajo</dt><dd><span class="mono id">${r.rid}</span>${copyBtn('Kopioi ajon tunniste', r.rid)}<span class="sub">${run}</span></dd>
<dt>Pi</dt><dd>${pi} · ohjaus: ${ctl.toLowerCase()}</dd>
<dt>Natiivi tunniste</dt><dd>${r.pi ? `<span class="mono id">${r.pi}</span>${copyBtn('Kopioi tunniste', r.pi)}` : '<span class="sub">terminaalin Pi, ei selaimen sidosta</span>'}</dd>
<dt>Aloitettu</dt><dd>${r.started}</dd></dl>`;
}
APP.painted.push(() => {
  const r = VIEW === 'run' ? runOf(RUN) : null;
  uiFrame.classList.toggle('wt-page', VIEW === 'ws');
  uiFrame.classList.toggle('wt-ro', !!(r && RO[r.st]));
  dock.innerHTML = r && RO[r.st] ? dockHtml(r) : '';
  if (VIEW === 'ws') {
    uiRail.querySelectorAll('.conv-row[aria-current]').forEach(a => a.removeAttribute('aria-current'));
    uiTop.innerHTML = `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button><div class="tb-title"><strong class="mono">${WSID}</strong><span class="tb-sub">Työtila</span></div>`;
    uiRail.querySelectorAll('.ws-name').forEach(a => a.toggleAttribute('aria-current', a.closest('.ws')?.querySelector(`[data-ws-tog="${WSID}"]`) != null));
  } else uiRail.querySelectorAll('.ws-name[aria-current]').forEach(a => a.removeAttribute('aria-current'));
  if (r) {
    uiRail.querySelectorAll('.conv-row[aria-current]:not([data-run])').forEach(a => a.removeAttribute('aria-current'));
    uiTop.innerHTML = runTop(r);
    if (UI.pop) uiPop.innerHTML = runDetails(r);
  }
});

// ---------- Lifecycle simulation ----------
function changed(r) {
  paintRail();
  if (VIEW === 'ws') stage.innerHTML = page();
  else if (VIEW === 'run' && RUN === r.id) { const keep = stage.scrollTop; stage.innerHTML = convo(r); paint(); stage.scrollTop = following ? stage.scrollHeight : keep; }
}
const later = (ms, f) => setTimeout(f, ms);
function work(r, what, ms, next) { r.st = 'working'; r.doing = what; r.t0 = performance.now(); r.t = 'nyt'; changed(r); later(ms, next); }
function merge(r, out, ms = 1500) {
  r.st = 'merging'; changed(r);
  later(ms, () => { r.st = 'merged'; r.out = { at: 'nyt', ...out }; r.t = 'nyt'; changed(r); toast(`Yhdistetty main-haaraan: ${r.title}`); });
}
const say = (r, user) => { (r.extra ||= []).push({ user }); };
function act(r, a) {
  if (a === 'merge') { say(r, 'Yhdistä main-haaraan.'); work(r, 'Yhdistää: rebase ja testit', 1800, () => merge(r, { commit: 'c81d2fa', commits: r.diff.commits, add: r.diff.add, del: r.diff.del })); }
  if (a === 'resolve') { say(r, 'Ratkaise konflikti ja yhdistä uudelleen.'); work(r, 'Ratkaisee konfliktia tiedostossa <span class="mono">ci.yml</span>', 2400, () => merge(r, { commit: '5be27d0', commits: 3, add: 19, del: 6 })); }
  if (a === 'resume') work(r, 'Jatkaa samaa keskustelua', 2600, () => {
    r.st = 'waiting'; r.extra = [...(r.extra || []), { reply: 'Testit päätteettömälle tulosteelle lisätty ja ne menevät läpi. Haarassa on 3 committia, +31 −4.\n\nYhdistänkö main-haaraan?' }];
    r.diff = { commits: 3, add: 31, del: 4 }; r.say = 'Valmis: 3 committia. Yhdistänkö main-haaraan?'; r.t = 'nyt'; changed(r);
  });
  if (a === 'change') { const ta = document.querySelector('.composer textarea'); ta?.focus(); }
}
const slugify = (s) => s.toLowerCase().replace(/[äå]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 3).join('-') || 'tyo';
function create(task, title, mode) {
  const t = title || task.replace(/[`*]/g, '').split(/[.\n]/)[0].split(' ').slice(0, 5).join(' ');
  const r = { id: `n${++MADE}`, mode, st: 'creating', step: 0, title: t, slug: `${['x9z', 'b2v', 'q7f'][MADE % 3]}-${slugify(t)}`, t: 'nyt',
    rid: `01m51e${MADE}h4c8z2kq6vn3dr9tw5x`.slice(0, 26), pi: `9b3e${MADE}c71-2f84-4d6a-b0e9-5c1a7d3f8e26`, started: '15.10. klo 14.12', task, isNew: true };
  RUNS.unshift(r); changed(r);
  const step = () => { r.step++; if (r.step < 3) { changed(r); later(800, step); } else work(r, 'Lukee koodia', 4200, () => {
    if (mode === 'auto') { r.reply = 'Tehty ja testattu. Yhdistän haaran main-haaraan.'; merge(r, { commit: 'e5b07a4', commits: 1, add: 12, del: 2 }); }
    else { r.st = 'waiting'; r.reply = 'Tehty ja testattu: 1 commit, +12 −2.\n\nYhdistänkö main-haaraan?'; r.diff = { commits: 1, add: 12, del: 2 }; r.say = 'Valmis: 1 commit. Yhdistänkö main-haaraan?'; r.t = 'nyt'; changed(r); }
  }); };
  later(800, step);
  toast(`Haaratyö aloitettu: ${t}`);
}
const dlg = document.createElement('dialog'); dlg.className = 'confirm wt-new'; document.body.appendChild(dlg);
function openNew() {
  MENU = false; if (VIEW === 'ws') stage.innerHTML = page();
  dlg.innerHTML = `<form method="dialog"><h3>Uusi haaratyö</h3>
<p class="wt-src">${ICON_BRANCH}<span>Työtilasta <span class="mono">${WSID}</span>, haarasta <span class="mono">${SRC.branch}</span> @ <span class="mono">${SRC.head}</span></span></p>
<label class="fld"><span>Tehtävä</span><textarea name="task" rows="4" required placeholder="Mitä agentin pitää tehdä?"></textarea></label>
<label class="fld"><span>Otsikko <small>valinnainen, syntyy muuten tehtävästä</small></span><input name="title" autocomplete="off"></label>
<fieldset class="wt-modes"><legend>Kun työ on valmis</legend>
<label class="wt-opt"><input type="radio" name="mode" value="auto" checked><span class="wt-opt-box">${ICON_MERGE}<span><strong>Yhdistää itse</strong><small>Agentti yhdistää haaran main-haaraan, kun työ ja testit ovat valmiit. Palaa sinulle vain, jos ei pysty.</small></span></span></label>
<label class="wt-opt"><input type="radio" name="mode" value="ask"><span class="wt-opt-box">${ICON_CHAT}<span><strong>Kysyy ensin</strong><small>Agentti pysähtyy valmiin työn kohdalle ja odottaa lupaasi yhdistää.</small></span></span></label>
</fieldset>
<p class="hint">Taskfleet nimeää haaran ja worktreen. Työtilan ${SRC.dirty} tallentamatonta muutosta eivät tule haaraan mukaan, ja ne estävät yhdistämisen, kunnes ne on commitoitu.</p>
<div class="confirm-actions"><button class="secondary" value="cancel" formnovalidate>Peruuta</button><button class="primary" value="ok">${ICON_BRANCH}Aloita haaratyö</button></div></form>`;
  dlg.showModal(); dlg.querySelector('textarea').focus();
}
dlg.addEventListener('close', () => {
  if (dlg.returnValue !== 'ok') return;
  const f = new FormData(dlg.querySelector('form'));
  const task = String(f.get('task')).trim(); if (!task) return;
  create(task, String(f.get('title')).trim(), f.get('mode'));
});

// ---------- Navigation and actions ----------
function showPage() { VIEW = 'ws'; RUN = null; UI.pop = false; UI.drawer = false; MENU = false; paint(); stage.innerHTML = ''; requestAnimationFrame(() => { stage.innerHTML = page(); stage.scrollTop = 0; }); }
function openRun(id) {
  const r = runOf(id); VIEW = 'run'; RUN = id; UI.pop = false; UI.drawer = false; MENU = false; r.isNew = false;
  paint(); stage.innerHTML = ''; requestAnimationFrame(() => { stage.innerHTML = convo(r); following = true; stage.scrollTop = stage.scrollHeight; });
}
document.addEventListener('click', (e) => {
  if (e.target.closest('.proto-picker')) return;
  const t = e.target.closest('[data-run], [data-wt-menu], [data-wt-new], [data-wt-newconv], [data-wt-ws], [data-wt-act], [data-wt-fold], [data-wt-pfold], .ws-name[data-ui="ws"], .tb-ws[data-ui="ws"], [data-conv], [data-ws-add]');
  if (!t) { if (MENU && !e.target.closest('.wt-menu')) { MENU = false; if (VIEW === 'ws') stage.innerHTML = page(); } return; }
  // Library conversations keep working; they leave this round's views.
  if (t.matches('[data-conv], [data-ws-add]')) { VIEW = 'conv'; RUN = null; MENU = false; return; }
  e.preventDefault(); e.stopPropagation();
  const d = t.dataset;
  if (t.matches('.ws-name[data-ui="ws"]')) { const id = t.closest('.ws')?.querySelector('[data-ws-tog]')?.dataset.wsTog; return id === WSID ? showPage() : toast('Tässä vedoksessa vain aurinkokellolla on työtilasivu.'); }
  if (t.matches('.tb-ws[data-ui="ws"]') || d.wtWs !== undefined) return showPage();
  if (d.run) return openRun(d.run);
  if (d.wtMenu !== undefined) { MENU = !MENU; stage.innerHTML = page(); return; }
  if (d.wtNew !== undefined) return openNew();
  if (d.wtNewconv !== undefined) { MENU = false; VIEW = 'conv'; const id = `n${++UI.created}`; ws().convs.unshift({ id, title: 'Uusi keskustelu', st: 'new' }); return openConv(id); }
  if (d.wtFold) { if (d.wtFold === 'done') FOLDED[WSID] = !FOLDED[WSID]; if (d.wtFold === 'wt') WTFOLD = !WTFOLD; if (d.wtFold === 'merged') MERGEDFOLD = !MERGEDFOLD; return paintRail(); }
  if (d.wtPfold) { PF[d.wtPfold] = !PF[d.wtPfold]; stage.innerHTML = page(); return; }
  if (d.wtAct) { const r = runOf(RUN); if (r && !t.disabled) { if (d.wtAct !== 'change') t.disabled = true; act(r, d.wtAct); } }
}, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && MENU) { MENU = false; stage.innerHTML = page(); } });

const show = (v) => () => { CUR = v; VIEW = 'ws'; RUN = null; MENU = false; UI.sel = 'c1'; UI.pop = false; ws().open = true; paint(); return page(); };
window.v1 = show('v1'); window.v2 = show('v2'); window.v3 = show('v3');
})();
