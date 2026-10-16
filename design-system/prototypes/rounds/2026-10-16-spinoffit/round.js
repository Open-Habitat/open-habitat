// Spinoff-agentit (proto-spinoff-agents, 16.10.2026). Arkkitehtuuri:
// issues/manage-agent-worktrees/architecture.md. Pääkeskustelun agentti käynnistää spinoffit
// itse (`taskfleet run create --kind spinoff`); selain vain näkee ne. Spinoffin avaaminen
// näyttää sen keskustelun ja tuloksen vain luettavana, ilman kenttää. Pääagentti saa tuloksen
// natiivisti omasta `taskfleet run wait` -kutsustaan; kun se on jouten, selain näyttää
// Taskfleetin havainnon erillisenä, hillittynä rivinä. Työtilasivu on valittu suunta 1
// (Keskustelut edellä) Git-painikkeineen sellaisenaan; + aloittaa keskustelun suoraan.
// Suunnat eroavat vain siinä, missä spinoffit näkyvät.
(() => {
const ICON_MORE = SVG('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>');
const ICON_BRANCH = SVG('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10"/><path d="M18 10c0 4-6 3-12 7"/>');
const ICON_MERGE = SVG('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="14" r="2"/><path d="M6 7v10"/><path d="M6 7c0 5 6 7 10 7"/>');
// Spinoff: a small branch leaving its parent.
const ICON_SPIN = SVG('<circle cx="7" cy="6" r="2"/><path d="M7 8v10"/><path d="M7 12c0 3 3 4 7 4"/><circle cx="17" cy="16" r="2"/>');
const ICON_WARN = SVG('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5"/><path d="M12 17.2h.01"/>');
const ICON_FWD = SVG('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>');
const ICON_BACK = SVG('<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>');
const ICON_EYE = SVG('<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>');
const ICON_COPY2 = SVG('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>');
const ICON_EXT = SVG('<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/>');
const ICON_TRASH = SVG('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>');
const ICON_EYE_OFF = SVG('<path d="M3 3l18 18"/><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-2.6 3.2M6.4 7.4C4.3 8.9 3 12 3 12s4 6 9 6a8.6 8.6 0 0 0 3.6-.8"/><path d="M9.9 10a3 3 0 0 0 4.1 4.1"/>');
const ICON_PEN = SVG('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>');
const ICON_ARCH = SVG('<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>');
const ICON_UP = SVG('<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>');
const ICON_DOWN = SVG('<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>');

// ---------- Fixture ----------
const WSID = 'aurinkokello', PID = 'p1', SRC = { branch: 'main', head: '7d03b18' };
const PARENT = { id: PID, title: 'Julkaisu 0.4: valmistelu', st: 'waiting' };
UI.ws.find(w => w.id === WSID).convs.unshift(PARENT);
const WTROOT = '~/src/aurinkokello__wt-';
// Spinoff runs as Taskfleet reports them; the transcript is the spinoff's own Pi session.
const SPIN0 = () => [
  { id: 's1', rid: '01m50y9e4rk2n8bw6dq3tg7hsm', slug: 'a2c-readme', title: 'README-esimerkit ajan tasalle', st: 'merged', self: true, started: '14.06', t: '14.22',
    task: 'Päivitä README:n esimerkit vastaamaan nykyisiä lippuja ja tarkista jokainen ajamalla se. Mergeä itse, kun testit menevät läpi.',
    work: [['bash', 'python3 scripts/status_rows.py --help', 'usage: status_rows.py [-h] [--since DATE] [--today DATE] [--table]'], ['edit', 'README.md', 'Applied 4 edits', { oldText: 'python3 scripts/status_rows.py --days 7', newText: 'python3 scripts/status_rows.py --since 2026-10-09' }], ['bash', 'pytest -q', '14 passed in 0.41s'], ['bash', 'taskfleet run merge 01m50y9e4rk2n8bw6dq3tg7hsm', '{"status":"done","landed":true,"commit":"9f3e1c2"}']],
    reply: 'Esimerkit on päivitetty ja jokainen ajettu: kolme vanhentunutta lippua korjattu ja `--since`-esimerkki lisätty. Testit menevät läpi. Mergesin haaran main-haaraan.',
    out: { commit: '9f3e1c2', commits: 3, add: 42, del: 8, files: ['README.md', 'docs/usage.md'] } },
  { id: 's2', rid: '01m51d2p8sx4k7mf3vq9hc1jzt', slug: 'k4x-pip-valimuisti', title: 'CI:n pip-välimuisti', st: 'working', self: true, started: '14.06', t: 'nyt', clock: 214,
    task: 'Lisää CI:hin pip-pakettien välimuisti, jonka avain on `requirements.txt`:n tiiviste. Mergeä itse, kun CI-ajo menee läpi.',
    work: [['read', '.github/workflows/ci.yml', 'name: ci\non: [push, pull_request]\n…'], ['edit', '.github/workflows/ci.yml', 'Applied 1 edit', { oldText: '      - uses: actions/setup-python@v5', newText: '      - uses: actions/setup-python@v5\n        with:\n          cache: pip\n          cache-dependency-path: requirements.txt' }], ['bash', 'act -j test --dryrun', 'Job succeeded']],
    doing: 'Ajaa <span class="mono">pytest</span>' },
  { id: 's3', rid: '01m51a6h3wq9z2kc8vn4mr7tdx', slug: 'm7q-ci-aikakatkaisu', title: 'Maanantain CI-aikakatkaisu', st: 'failed', self: true, started: '14.06', t: '14.38',
    task: 'Selvitä, miksi CI aikakatkaistaan maanantaiaamuisin, ja korjaa se. Mergeä itse, kun korjaus on testattu.',
    work: [['bash', 'gh run list --workflow ci --limit 20', 'X  ci  main  schedule  1h 0m  ma\n✓  ci  main  push      6m 12s  pe\n…'], ['edit', '.github/workflows/ci.yml', 'Applied 2 edits', { oldText: '    timeout-minutes: 10', newText: '    timeout-minutes: 20' }], ['bash', 'taskfleet run merge 01m51a6h3wq9z2kc8vn4mr7tdx', '{"error":{"code":"merge_conflict","message":"rebase onto main stopped at .github/workflows/ci.yml"}}']],
    reply: 'Syy on välimuisti, joka vanhenee viikonlopun yli: maanantain ensimmäinen ajo rakentaa riippuvuudet alusta ja ylittää 10 minuutin rajan. Nostin rajan 20 minuuttiin ja lisäsin välimuistin avaimeen viikon numeron.\n\nMergeäminen ei onnistunut: `.github/workflows/ci.yml` on muuttunut main-haarassa haaran luomisen jälkeen.',
    fail: { reason: 'Konflikti: <span class="mono">.github/workflows/ci.yml</span> muuttui main-haarassa (<span class="mono">7d03b18</span>) haaran luomisen jälkeen.', commits: 2, dirty: 1 } },
  { id: 's4', rid: '01m51c7k2qv8d4hx9tbn3fr6wa', slug: 'p8d-aikavyohyke', title: 'Aikavyöhyke tulosteeseen', st: 'parent', self: false, started: '14.07', t: '14.31',
    task: 'Näytä tulosteen aikaleimat paikallisessa aikavyöhykkeessä ja lisää `--utc`-lippu vanhaa muotoa varten. Älä mergeä: minä mergeän, kun olen katsonut muutoksen.',
    work: [['edit', 'scripts/status_rows.py', 'Applied 3 edits', { oldText: 'stamp = ts.strftime("%Y-%m-%d %H:%M")', newText: 'stamp = (ts if args.utc else ts.astimezone()).strftime("%Y-%m-%d %H:%M %z")' }], ['write', 'tests/test_timezone.py', 'Wrote 38 lines', { content: 'from scripts.status_rows import format_stamp\n\n\ndef test_utc_flag_keeps_old_format():\n    ...' }], ['bash', 'pytest -q', '16 passed in 0.47s']],
    reply: 'Aikaleimat tulostuvat nyt paikallisessa ajassa ja `--utc` palauttaa vanhan muodon. Testit menevät läpi (16 ok). Haarassa on 2 committia, +58 −3. Työ on valmis; odotan, että mergeät sen.',
    ready: { commits: 2, add: 58, del: 3 }, out: { commit: 'c81d2fa', commits: 2, add: 58, del: 3, files: ['scripts/status_rows.py', 'tests/test_timezone.py'] } },
];
let SPIN = SPIN0();
const spin = (id) => SPIN.find(s => s.id === id);
const branch = (s) => `wt/${s.slug}`;
const SS = {
  working: ['Työskentelee', '<span class="st-dot working"></span>'],
  parent: ['Odottaa pääagenttia', '<span class="st-dot sp-parent"></span>'],
  failed: ['Ei mergetty · työ tallessa', `<span class="sp-mk failed">${ICON_WARN}</span>`],
  merged: ['Mergetty', `<span class="sp-mk merged">${ICON_MERGE}</span>`],
};
const ORDER = { parent: 0, failed: 1, working: 2, merged: 3 };
const sorted = () => [...SPIN].sort((a, b) => ORDER[a.st] - ORDER[b.st]);
const mark = (s) => `<span class="st" role="img" aria-label="${SS[s.st][0]}" title="${SS[s.st][0]}">${SS[s.st][1]}</span>`;
const elapsed = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
const clockOf = (s) => `<span class="sp-clock" data-t0="${s.t0}">${elapsed(Math.round((performance.now() - s.t0) / 1000))}</span>`;
// One line of what is going on, for rows and panels.
function line(s) {
  if (s.st === 'working') return `${s.doing} · ${clockOf(s)}`;
  if (s.st === 'merged') return `main-haaraan <span class="mono">${s.out.commit}</span> · ${s.out.commits} committia`;
  if (s.st === 'failed') return 'Konflikti tiedostossa <span class="mono">ci.yml</span> · haara tallessa';
  return `Valmis · ${s.ready.commits} committia · odottaa pääagentin mergeä`;
}
setInterval(() => document.querySelectorAll('.sp-clock[data-t0]').forEach(el => { el.textContent = elapsed(Math.max(0, Math.round((performance.now() - +el.dataset.t0) / 1000))); }), 1000);

// Git: the workspace page keeps direction 1's Git pill from 2026-10-16-tyotilasivu as it was
// prototyped there (Jari 16.10.2026): branch, changes and sync in one button that opens the
// Git layer, shown whether or not the checkout is up to date. Same synthetic facts.
const GIT = {
  aurinkokello: { branch: 'main', upstream: 'origin/main', ahead: 1, behind: 0, fetched: '6 min sitten',
    files: [['M', 'scripts/status_rows.py', '+38 −4'], ['?', 'tests/test_status_rows.py', 'uusi']],
    commits: [
      { h: 'a41c9e2', s: 'Statusrivien jäsennin omaksi moduulikseen', t: '40 min', local: true },
      { h: '7d03b18', s: 'CI: macOS-ajo käyttää Python 3.13:a', t: 'eilen' },
      { h: 'e92f4a0', s: 'README: --json-esimerkki ja aikavyöhyke', t: 'ma' },
      { h: '3bb1c57', s: 'Auringonlaskun pyöristys minuutteihin', t: '9.10.' },
    ] },
  issuectl: { branch: 'search-negation', upstream: 'origin/search-negation', ahead: 3, behind: 1, fetched: '25 min sitten', files: [],
    commits: [{ h: '5e0a771', s: 'Haku: NOT-avainsana jäsentimeen', t: '25 min', local: true }, { h: '9a6e3c0', s: 'JSON-skeeman versio 3', t: 'eilen' }] },
};
const git = (id) => GIT[id] || (GIT[id] = { branch: 'main', upstream: null, ahead: 0, behind: 0, fetched: null, files: [], commits: [{ h: '1f2e3d4', s: 'Ensimmäinen commit', t: '1.10.' }] });
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const syncIcons = (d) => `${d.ahead ? `<span class="g-ahead" title="${d.ahead} committia ei ole vielä originissa">${ICON_UP}${d.ahead}</span>` : ''}${d.behind ? `<span class="g-behind" title="${d.behind} committia originissa, joita täällä ei ole">${ICON_DOWN}${d.behind}</span>` : ''}`;
const gitPill = (id) => { const d = git(id); return `<button type="button" class="gitline" data-git aria-haspopup="dialog" aria-expanded="${LAYER?.kind === 'git'}">${ICON_BRANCH}<span class="mono">${esc(d.branch)}</span>${d.files.length ? `<span class="g-dirty">${plural(d.files.length, 'muutos', 'muutosta')}</span>` : '<span class="g-ok">ei muutoksia</span>'}${syncIcons(d)}${CHEV}</button>`; };
const REC = {
  p1: { age: '14.41', recap: 'Neljä spinoffia 0.4-julkaisua varten. README-esimerkit on mergetty. Maanantain aikakatkaisu jäi konfliktiin `ci.yml`:ssä; työ on tallessa. Aikavyöhyke on valmis ja odottaa mergeä. Pip-välimuisti on kesken.', next: 'Kerro, mergeänkö aikavyöhykkeen.' },
  c1: { age: '1 min', recap: 'Skripti `scripts/status_rows.py` lukee `status.md`:n taulukon ja tulostaa viime viikon rivit. `--since` antaa rajan käsin, ja `--today` tekee päivästä testattavan; testit menevät läpi.', next: 'Kerro, lisätäänkö JSON-tuloste samaan ajoon vai omaksi lipukseen.' },
  c2: { age: '8 min', recap: 'Kuvat `assets/photos/` muunnettiin WebP-muotoon laadulla 82: 214 kuvaa, yhteensä 38 Mt → 11 Mt. `build.sh` käyttää nyt `.webp`-tiedostoja.', next: 'Päätä, poistetaanko alkuperäiset vai siirretäänkö ne `originals/`-hakemistoon.' },
  c10: { age: '25 min', recap: 'Hakusyntaksiin lisättiin negaatio. Jäsennin hyväksyy jo molemmat muodot, mutta dokumentaatioon pitää valita yksi.', next: 'Valitse muoto, niin päivitän README:n.' },
  c4: { age: '3 t', recap: 'Syklin tunnistus toimii pienissä graafeissa. Suuressa graafissa ajo keskeytyi.', next: 'Tarkista, onko Pi yhä käynnissä terminaalissa.' },
  c5: { age: '14 min', recap: 'Kiintiönäkymän tekstit on kirjoitettu uudelleen; Storybookin tarinat on päivitetty.', next: 'Aja testit ja tarkista puhelinleveys.' },
};
const DONE_T = { c3: 'eilen', c7: 'ma', c8: '9.10.', c11: '8.10.', c6: '3.10.' };
const ARCHIVED = { aurinkokello: [{ id: 'a1', title: 'Vanha deploy-skripti', t: '2.10.' }], issuectl: [{ id: 'a3', title: 'Lanejen järjestys', t: '30.9.' }] };

// The parent conversation's native history (Pi), with the spinoff group between its two
// threads in V1. Tool rows are the agent's own Taskfleet calls.
const tf = (cmd, result) => ({ t: 'tool', name: 'bash', target: cmd, args: { command: cmd }, result });
const createCall = (s) => tf(`taskfleet run create --kind spinoff${s.self ? '' : ' --interactive'} --title "${s.title}" --task "…"`, `{"run_id":"${s.rid}","kind":"spinoff","status":"pending","worktree_path":"${WTROOT}${s.slug}"}`);
const HIST0 = () => {
  const [s1, s2, s3, s4] = SPIN;
  return [
    { kind: 'marker', t: 'settings', time: '14:02', model: MODEL_ID, thinking: 'high' },
    { kind: 'user', time: '14:02', md: 'Valmistellaan 0.4-julkaisu. Neljä asiaa: README:n esimerkit ajan tasalle, pip-välimuisti CI:hin, maanantaiaamujen CI-aikakatkaisu ja aikavyöhyke tulosteeseen. Tee erilliset asiat spinoffeina, niin ne eivät sotke toisiaan.' },
    { kind: 'turn', time: '14:07', blocks: [
      { t: 'think', md: 'Neljä toisistaan riippumatonta muutosta. Aikavyöhyke muuttaa tulosteen oletusmuotoa, joten se odottakoon, että katson sen ennen mergeä.' },
      tf('git status --short', ''),
      createCall(s1), createCall(s2), createCall(s3), createCall(s4),
      { t: 'reply', md: 'Käynnistin neljä spinoffia, kukin omassa worktreessaan. Aikavyöhyke muuttaa tulosteen oletusmuotoa, joten se odottaa, että mergeän sen itse; muut mergeävät itsensä, kun testit menevät läpi. Odotan tuloksia.' },
    ] },
    { kind: 'marker', t: 'spins' },
    { kind: 'turn', time: '14:41', blocks: [
      tf(`taskfleet run wait ${s1.rid} ${s2.rid} ${s3.rid} --any --timeout 45m`, `{"run_id":"${s1.rid}","status":"done","landed":true,"report":{"commit":"9f3e1c2","commits":3}}`),
      tf(`taskfleet run wait ${s2.rid} ${s3.rid} --any --timeout 45m`, `{"run_id":"${s3.rid}","status":"failed","landed":false,"summary":"merge conflict: .github/workflows/ci.yml","preserved_work":[{"branch":"wt/${s3.slug}","worktree_path":"${WTROOT}${s3.slug}"}]}`),
      tf(`taskfleet run show ${s4.rid}`, `{"run_id":"${s4.rid}","lifecycle":"interactive","status":"pending","attention_required":true,"summary":"valmis; odottaa run merge -kutsua"}`),
      { t: 'reply', md: '**README-esimerkit** on mergetty main-haaraan (`9f3e1c2`, 3 committia).\n\n**Maanantain aikakatkaisu** ei mennyt läpi: `ci.yml` oli muuttunut main-haarassa, ja rebase pysähtyi siihen. Haara ja worktree ovat tallessa. Korjaan konfliktin, kun välimuisti-spinoff on valmis, koska se muuttaa samaa tiedostoa.\n\n**Aikavyöhyke** on valmis: aikaleimat tulostuvat paikallisessa ajassa ja `--utc` palauttaa vanhan muodon. Testit menevät läpi, 2 committia.\n\nMergeänkö aikavyöhykkeen main-haaraan?' },
    ] },
  ];
};
let HIST = HIST0();

// ---------- State ----------
let CUR = 'v1', VIEW = 'conv', SEL = null, PAGE = null, POP = false, LAYER = null, OBS = 0;
const KIDFOLD = { merged: false };
const PFOLD = { done: false, arch: false };
const ws = () => UI.ws.find(w => w.id === (PAGE || WSID));

// ---------- Rendering with the library's thread builder ----------
// lanka() reads the global CONVO; swap in the history to draw, then restore it.
function drawConvo(hist) {
  const keep = CONVO.splice(0, CONVO.length, ...hist);
  const html = lanka('', { meta: 'top', fold: 'head', runs: 'separate' });
  CONVO.splice(0, CONVO.length, ...keep);
  return html;
}
// V1: the spinoff group sits in the parent's thread where the agent started them; the
// host's own observation (Taskfleet saw an outcome the idle parent has not read) is a
// separate, dashed row so it is never mistaken for Pi's history.
const libMarker = markerR;
markerR = (m, i) => {
  if (m.t === 'spins') return CUR === 'v1' ? spinGroup(i) : '';
  if (m.t === 'obs') return CUR === 'v1' ? obsRow(m, i) : '';
  if (m.t === 'from-parent') return `<div class="sp-start ah-in" style="--i:${i}" role="note">${ICON_SPIN}<span>${m.html}</span></div>`;
  return libMarker(m, i);
};
const spinRowV1 = (s) => `<li><a href="#" class="sp-row st-${s.st}" data-spin="${s.id}">${mark(s)}<span class="sp-title">${esc(s.title)}</span><span class="sp-line">${line(s)}</span>${ICON_FWD}</a></li>`;
const spinGroup = (i) => `<section class="sp-group ah-in" style="--i:${i}" aria-label="Spinoffit, jotka agentti käynnisti"><header class="sp-ghead">${ICON_SPIN}<span>Agentti käynnisti ${SPIN.length} spinoffia</span><time class="meta">14.07</time></header><ul class="sp-rows">${SPIN.map(spinRowV1).join('')}</ul></section>`;
const obsRow = (m, i) => { const s = spin(m.id); return `<div class="sp-obs ah-in" style="--i:${i}" role="note"><span class="sp-obs-k">${ICON_EYE}Taskfleet</span><a href="#" data-spin="${s.id}">${esc(s.title)}</a><span>mergetty main-haaraan <span class="mono">${s.out.commit}</span>. Pääagentti näkee tämän seuraavalla vuorollaan.</span><time class="meta">${m.time}</time></div>`; };

function parentView() {
  run++;
  requestAnimationFrame(() => { following = true; stage.scrollTop = stage.scrollHeight; lastTop = stage.scrollTop; });
  const html = drawConvo(HIST);
  return PWORK ? html.replace(/<\/div>$/, `<div class="strip working sp-pwork"><span class="act"><span class="live-dot"></span>${PWORK}</span></div></div>`) : html;
}
let PWORK = '';

// ---------- Spinoff view (read-only) ----------
function spinHist(s) {
  const parentLink = `<a href="#" data-conv="${PID}">${esc(PARENT.title)}</a>`;
  const h = [
    { kind: 'marker', t: 'from-parent', html: `Pääagentti käynnisti tämän spinoffin klo ${s.started} keskustelussa ${parentLink} · <span class="mono">${branch(s)}</span> haarasta <span class="mono">${SRC.branch}</span> @ <span class="mono">${SRC.head}</span>` },
    { kind: 'user', time: s.started.replace('.', ':'), md: s.task },
  ];
  const blocks = s.work.map(([name, target, result, args]) => name === 'bash' ? tf(target, result) : { t: 'tool', name, target, args: { path: target, ...args }, result });
  if (s.reply) h.push({ kind: 'turn', time: s.t.replace('.', ':'), blocks: [...blocks, { t: 'reply', md: s.reply }] });
  return { h, blocks };
}
function outcome(s) {
  if (s.st === 'merged') return `<section class="sp-out merged" aria-label="Mergetty"><header>${ICON_MERGE}<strong>Mergetty main-haaraan</strong><span class="grow"></span><time>${s.t}</time></header>
<dl class="sp-kv"><dt>Commit</dt><dd><span class="mono">${s.out.commit}</span>${copyBtn('Kopioi commit', s.out.commit)}</dd><dt>Muutokset</dt><dd class="mono">${s.out.commits} committia · <span class="add">+${s.out.add}</span> <span class="del">−${s.out.del}</span></dd><dt>Tiedostot</dt><dd>${s.out.files.map(f => `<span class="mono">${esc(f)}</span>`).join(', ')}</dd><dt>Siivous</dt><dd>Worktree ja haara <span class="mono">${branch(s)}</span> poistettu. Tämä keskustelu säilyy luettavana.</dd></dl></section>`;
  if (s.st === 'failed') return `<section class="sp-out failed" aria-label="Ei mergetty, työ tallessa"><header>${ICON_WARN}<strong>Ei mergetty · työ on tallessa</strong><span class="grow"></span><time>${s.t}</time></header>
<p>${s.fail.reason}</p>
<dl class="sp-kv"><dt>Haara</dt><dd><span class="mono">${branch(s)}</span> · ${s.fail.commits} committia</dd><dt>Worktree</dt><dd><span class="mono">${WTROOT}${s.slug}</span> · ${s.fail.dirty} tallentamaton tiedosto</dd></dl>
<p class="sp-who">Pääagentti päättää jatkosta. Jos haluat vaikuttaa siihen, kirjoita pääagentille.</p>
<details class="sp-cli"><summary>${CHEV}Komentorivillä</summary><p>Tallessa olevan työn voi viimeistellä tai hylätä Taskfleetillä.</p>${cmd(`taskfleet run show ${s.rid}`)}${cmd(`taskfleet run salvage ${s.rid}`)}</details></section>`;
  if (s.st === 'parent') return `<section class="sp-out parent" aria-label="Valmis, odottaa pääagenttia"><header>${ICON_MERGE}<strong>Valmis · odottaa pääagentin mergeä</strong><span class="grow"></span><span class="mono sp-diff">${s.ready.commits} committia · <span class="add">+${s.ready.add}</span> <span class="del">−${s.ready.del}</span></span></header>
<p>Haara <span class="mono">${branch(s)}</span> → <span class="mono">${SRC.branch}</span>. Pääagentti mergeää tai hylkää sen; se on kysynyt asiaa sinulta keskustelussa <a href="#" data-conv="${PID}">${esc(PARENT.title)}</a>.</p></section>`;
  return `<div class="strip working sp-work"><span class="act"><span class="live-dot"></span>${s.doing}</span>${clockOf(s)}</div>`;
}
const cmd = (c) => `<div class="sp-cmd"><code class="mono">${esc(c)}</code>${copyBtn('Kopioi komento', c)}</div>`;
function spinView(s) {
  run++;
  const { h, blocks } = spinHist(s);
  let html = drawConvo(h).replace('<span class="who">Sinä</span>', '<span class="who">Pääagentti</span>');
  // A working spinoff's unfinished thread: its finished tool calls, then the live strip.
  if (!s.reply) html = html.replace(/<\/div>$/, `<div class="sp-sofar"><p class="sp-sofar-h">Tähän mennessä</p>${blocks.map((b, i) => toolRow(b, i)).join('')}</div></div>`);
  return html.replace(/<\/div>$/, `${outcome(s)}</div>`);
}

// ---------- Workspace page (direction 1, Keskustelut edellä) ----------
const st = (c) => convState(c);
const cmark = (s) => { const [l, m] = STATES[s] ?? ['Ei aloitettu', '<span class="st-none"></span>']; return `<span class="st" role="img" aria-label="${l}" title="${l}">${m}</span>`; };
const openConvs = (w) => w.convs.filter(c => !c.archived && st(c) !== 'done').sort((a, b) => (STATE_ORDER[st(a)] ?? 4) - (STATE_ORDER[st(b)] ?? 4));
const doneConvs = (w) => w.convs.filter(c => !c.archived && st(c) === 'done');
// V2: one line of the parent's spinoffs on its card; V3: the spinoffs as child rows.
const cardSpinsV2 = () => `<a href="#" class="sp-cardline" data-spinpanel>${ICON_SPIN}<span>Spinoffit</span>${sorted().map(s => `<span class="sp-pill st-${s.st}" title="${esc(s.title)}: ${SS[s.st][0]}">${mark(s)}<span>${esc(s.title)}</span></span>`).join('')}</a>`;
const kidRow = (s, cls = '') => `<li class="sp-kid st-${s.st} ${cls}"><a href="#" data-spin="${s.id}"${VIEW === 'spin' && SEL === s.id ? ' aria-current="page"' : ''}><span class="sp-tree" aria-hidden="true"></span>${mark(s)}<span class="sp-title">${esc(s.title)}</span><span class="sp-line">${line(s)}</span></a></li>`;
function cardKidsV3() {
  const live = sorted().filter(s => s.st !== 'merged'), done = SPIN.filter(s => s.st === 'merged');
  return `<ul class="sp-kids in-card" aria-label="Spinoffit">${live.map(s => kidRow(s)).join('')}${done.length ? `<li class="sp-kid sp-kidfold"><button type="button" data-kidfold aria-expanded="${KIDFOLD.merged}"><span class="sp-tree" aria-hidden="true"></span>${CHEV}<span>${plural(done.length, 'mergetty', 'mergettyä')}</span></button></li>${KIDFOLD.merged ? done.map(s => kidRow(s)).join('') : ''}` : ''}</ul>`;
}
function recapCard(c) {
  const r = REC[c.id] || { age: 'nyt', recap: 'Keskustelulla ei vielä ole tilannekatsausta.', next: '' }; const s = st(c);
  const extra = c.id === PID ? (CUR === 'v2' ? cardSpinsV2() : CUR === 'v3' ? cardKidsV3() : '') : '';
  return `<article class="kc ${s}"><a href="#" class="kc-head" data-conv="${c.id}">${cmark(s)}<strong>${esc(c.title)}</strong><span class="grow"></span><time>${r.age}</time></a>
<p class="k-text">${inline(r.recap)}</p>${r.next ? `<p class="k-next"><span class="k-label">Seuraavaksi</span><span>${inline(r.next)}</span></p>` : ''}${extra}
<a href="#" class="kc-go" data-conv="${c.id}">${s === 'attention' ? 'Lue vastaus' : s === 'waiting' ? 'Vastaa' : 'Avaa'}${ICON_FWD}</a></article>`;
}
function page() {
  run++;
  const w = ws(); const o = openConvs(w), d = doneConvs(w), a = [...w.convs.filter(c => c.archived).map(c => ({ id: c.id, title: c.title, t: 'nyt' })), ...(ARCHIVED[w.id] || [])];
  const fold = (k, label, n, rows) => n ? `<section class="grp"><button type="button" class="fold" data-pfold="${k}" aria-expanded="${PFOLD[k]}">${CHEV}<span>${label}</span><span class="count plain">${n}</span></button>${PFOLD[k] ? rows : ''}</section>` : '';
  const sum = o.length ? plural(o.length, 'avoin keskustelu', 'avointa keskustelua') : 'ei avoimia keskusteluja';
  return `<div class="wsp p1"><div class="p1-head">${gitPill(w.id)}<span class="p1-sum">${sum}</span></div>
<section class="grp" aria-labelledby="o-h"><h2 id="o-h" class="grp-h">Avoimet <span class="count">${o.length}</span></h2>${o.length ? `<div class="kgrid">${o.map(recapCard).join('')}</div>` : '<p class="grp-empty">Ei avoimia keskusteluja.</p>'}</section>
${fold('done', 'Valmiit', d.length, `<ul class="rows">${d.map(c => `<li><a href="#" class="row" data-conv="${c.id}">${cmark('done')}<span class="row-title">${esc(c.title)}</span><time>${DONE_T[c.id] ?? ''}</time></a></li>`).join('')}</ul>`)}
${fold('arch', 'Arkisto', a.length, `<ul class="rows">${a.map(c => `<li class="row arch">${ICON_ARCH}<span class="row-title">${esc(c.title)}</span><time>${c.t}</time><button type="button" class="quiet-btn" data-restore="${c.id}">Palauta</button></li>`).join('')}</ul><p class="grp-note">Palautus tuo keskustelun takaisin listaan; Pi ei käynnisty.</p>`)}</div>`;
}

// ---------- Sidebar (V3: child rows under the parent conversation) ----------
const libRow = APP.row;
APP.row = (c) => {
  const row = libRow(c);
  if (c.id !== PID || CUR !== 'v3') return row;
  const live = sorted().filter(s => s.st !== 'merged'), done = SPIN.filter(s => s.st === 'merged');
  const kid = (s) => `<a href="#" class="conv-row sp-rail" data-spin="${s.id}"${VIEW === 'spin' && SEL === s.id ? ' aria-current="page"' : ''} title="${esc(s.title)}: ${SS[s.st][0]}"><span class="sp-tree" aria-hidden="true"></span><span class="conv-title">${esc(s.title)}</span>${mark(s)}</a>`;
  const open = KIDFOLD.merged || (VIEW === 'spin' && spin(SEL)?.st === 'merged');
  // The library wraps each row in <li>; the child rows become sibling <li>s after it.
  const items = [...live.map(kid), ...(done.length ? [`<button type="button" class="conv-row sp-rail sp-railfold" data-kidfold aria-expanded="${open}"><span class="sp-tree" aria-hidden="true"></span><span class="conv-title">${plural(done.length, 'mergetty', 'mergettyä')}</span>${CHEV}</button>`] : []), ...(open ? done.map(kid) : [])];
  return items.length ? `${row}</li>${items.map(x => `<li class="sp-li">${x}`).join('</li>')}` : row;
};

// ---------- Top bars ----------
// V2: the spinoff mark in the parent's top bar: count plus the states that need a look.
function spinChip() {
  const n = (k) => SPIN.filter(s => s.st === k).length;
  const marks = ['parent', 'failed', 'working'].filter(k => n(k)).map(k => `<span class="sp-cnt">${SS[k][1]}${n(k)}</span>`).join('');
  return `<button type="button" class="sp-chip${OBS ? ' fresh' : ''}" data-spinpanel aria-haspopup="dialog" aria-expanded="${POP}" aria-label="Spinoffit: ${SPIN.length}" title="Spinoffit, jotka tämän keskustelun agentti käynnisti">${ICON_SPIN}<span class="sp-chip-n">${SPIN.length}</span>${marks}</button>`;
}
function spinPanel() {
  return `<div class="sp-panel-h"><span>Agentin käynnistämät spinoffit</span><button type="button" class="icon-btn" data-spinpanel aria-label="Sulje" title="Sulje">${ICON_CLOSE}</button></div><ul class="sp-prows">${sorted().map(s => `<li><a href="#" class="sp-prow st-${s.st}" data-spin="${s.id}">${mark(s)}<span class="sp-ptxt"><span class="sp-title">${esc(s.title)}</span><span class="sp-line">${line(s)}</span></span><time>${s.t}</time></a></li>`).join('')}</ul><p class="sp-panel-note">Spinoffit tekevät yhden asian omassa worktreessaan ja mergeävät sen. Niitä ohjaa pääagentti, ei tämä näkymä.</p>`;
}
const panel = document.createElement('div'); panel.className = 'sp-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Spinoffit'); panel.hidden = true; uiMain.appendChild(panel);
function spinTop(s) {
  return `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button>
<div class="tb-title"><strong>${esc(s.title)}</strong><span class="tb-sub sp-crumb"><span class="sp-tag">${ICON_SPIN}Spinoff</span><a href="#" class="tb-ws" data-conv="${PID}">${esc(PARENT.title)}</a></span></div>
<div class="tb-right"><span class="chip sp-chipst st-${s.st}" role="status">${SS[s.st][1]}<span class="chip-label">${SS[s.st][0]}</span></span><span class="tag ro" title="Spinoffille ei kirjoiteta">Vain luku</span><span class="tb-actions"><button class="icon-btn tb-btn" type="button" data-ui="info" aria-label="Tiedot" title="Tiedot" aria-expanded="${UI.pop}">${ICON_INFO}</button></span></div>`;
}
function spinDetails(s) {
  return `<h3>Spinoff</h3><dl class="facts">
<dt>Aloitti</dt><dd><a href="#" data-conv="${PID}">${esc(PARENT.title)}</a> <span class="sub">pääagentti klo ${s.started}</span></dd>
<dt>Haara</dt><dd><span class="mono">${branch(s)}</span>${copyBtn('Kopioi haara', branch(s))}</dd>
<dt>Worktree</dt><dd>${s.st === 'merged' ? '<span class="sub">poistettu mergen jälkeen</span>' : `<span class="mono">${WTROOT}${s.slug}</span>`}</dd>
<dt>Lähtökohta</dt><dd><span class="mono">${SRC.branch} @ ${SRC.head}</span></dd>
<dt>Kun valmis</dt><dd>${s.self ? 'Mergeää itse' : 'Odottaa pääagentin mergeä'}</dd>
<dt>Taskfleet-ajo</dt><dd><span class="mono id">${s.rid}</span>${copyBtn('Kopioi ajon tunniste', s.rid)}</dd>
<dt>Agentti</dt><dd>Pi · <span class="mono">${MODEL_ID}</span></dd></dl>`;
}
function pageTop() {
  const w = ws();
  return `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button>
<div class="tb-title"><strong class="mono">${esc(w.id)}</strong><span class="tb-ws mono">${esc(w.path)}</span></div>
<div class="tb-right"><span class="tb-actions"><button type="button" class="icon-btn plus-btn" data-newconv aria-label="Uusi keskustelu työtilassa ${esc(w.id)}" title="Uusi keskustelu">${ICON_PLUS}</button><button type="button" class="icon-btn tb-btn" data-wsmore aria-haspopup="menu" aria-expanded="${LAYER?.kind === 'more'}" aria-label="Työtilan toiminnot" title="Työtilan toiminnot">${ICON_MORE}</button></span></div>`;
}

// Dock in place of the composer in a spinoff: nobody writes to it.
const dock = document.createElement('div'); dock.className = 'sp-dock'; dock.setAttribute('role', 'note');
comp.parentNode.insertBefore(dock, comp);

APP.painted.push(() => {
  uiFrame.classList.toggle('sp-page', VIEW === 'page');
  uiFrame.classList.toggle('sp-spin', VIEW === 'spin');
  uiRail.querySelectorAll('.ws-row').forEach(r => r.toggleAttribute('data-current', VIEW === 'page' && r.querySelector('[data-ws-tog]').dataset.wsTog === PAGE));
  if (VIEW !== 'conv') uiRail.querySelectorAll('.conv-row[aria-current]:not([data-spin])').forEach(a => { if (!(VIEW === 'spin' && CUR !== 'v3' && a.dataset.conv === PID)) a.removeAttribute('aria-current'); });
  if (VIEW === 'spin' && CUR !== 'v3') uiRail.querySelector(`.conv-row[data-conv="${PID}"]`)?.setAttribute('aria-current', 'page');
  dock.innerHTML = VIEW === 'spin' ? `${ICON_SPIN}<span>Spinoffille ei kirjoiteta: sitä ohjaa agentti, joka käynnisti sen.</span><a href="#" class="sp-dock-go" data-conv="${PID}">Kirjoita pääagentille${ICON_FWD}</a>` : '';
  if (VIEW === 'page') uiTop.innerHTML = pageTop();
  if (VIEW === 'spin') { const s = spin(SEL); uiTop.innerHTML = spinTop(s); if (UI.pop) uiPop.innerHTML = spinDetails(s); }
  if (VIEW === 'conv' && UI.sel === PID && CUR === 'v2') uiTop.querySelector('.tb-right')?.insertAdjacentHTML('afterbegin', spinChip());
  panel.hidden = !(POP && VIEW === 'conv' && UI.sel === PID && CUR === 'v2');
  if (!panel.hidden) panel.innerHTML = spinPanel();
});
const libContent = content;
window.content = function () {
  if (VIEW === 'conv' && UI.sel === PID) return parentView();
  return libContent();
};

// ---------- Git and workspace layers (from 2026-10-16-tyotilasivu) ----------
const layer = document.createElement('div'); layer.className = 'wl'; layer.tabIndex = -1; layer.hidden = true; uiFrame.appendChild(layer);
const scrim = document.createElement('div'); scrim.className = 'wl-scrim'; scrim.hidden = true; uiFrame.appendChild(scrim);
scrim.addEventListener('click', () => closeLayer());
const syncText = (d) => !d.upstream ? 'ei etärepoa' : d.ahead || d.behind ? [d.ahead ? `${d.ahead} edellä` : '', d.behind ? `${d.behind} jäljessä` : ''].filter(Boolean).join(', ') + ` ${d.upstream}` : `ajan tasalla ${d.upstream}`;
const fileList = (d) => d.files.length ? `<ul class="g-files">${d.files.map(([s, p, n]) => `<li><span class="g-fs g-${s === '?' ? 'new' : s === 'D' ? 'del' : 'mod'}" title="${s === '?' ? 'Uusi, ei vielä Gitissä' : s === 'D' ? 'Poistettu' : 'Muutettu'}">${s === '?' ? 'U' : s}</span><span class="mono">${esc(p)}</span><span class="g-n">${n}</span></li>`).join('')}</ul>` : '<p class="g-clean">Ei muutoksia; työhakemisto vastaa viimeisintä committia.</p>';
const commitList = (d) => `<ul class="g-commits">${d.commits.map(c => `<li><span class="mono g-h">${c.h}</span><span class="g-s">${esc(c.s)}</span>${c.local ? '<span class="g-local" title="Ei vielä originissa">paikallinen</span>' : ''}<time>${c.t}</time></li>`).join('')}</ul>`;
const gitFacts = (d) => `<p class="g-branch">${ICON_BRANCH}<span class="mono">${esc(d.branch)}</span>${syncIcons(d)}<span class="g-sync">${syncText(d)}</span></p>${d.fetched ? `<p class="g-fetched">Origin tarkistettu ${d.fetched}</p>` : ''}`;
function gitLayer() { const d = git(PAGE); return `<div class="wl-head"><span>Git</span><button type="button" class="icon-btn wl-x" data-wl-close aria-label="Sulje" title="Sulje">${ICON_CLOSE}</button></div><div class="wl-git">${gitFacts(d)}<h3 class="side-h">Muutokset <span class="count plain">${d.files.length}</span></h3>${fileList(d)}<h3 class="side-h">Viimeisimmät commitit</h3>${commitList(d)}</div>`; }
function moreLayer() {
  const w = ws();
  const it = (act, icon, label, extra = '') => `<button type="button" role="menuitem" data-wm="${act}">${icon}<span>${label}</span>${extra}</button>`;
  return `${it('copy', ICON_COPY2, 'Kopioi polku', `<span class="kbd mono">${esc(w.path)}</span>`)}${it('gh', ICON_EXT, 'Avaa GitHubissa')}<hr>${it('rename', ICON_PEN, 'Muuta näyttönimeä…')}${it('hide', ICON_EYE_OFF, 'Piilota sivupalkista')}<hr><button type="button" role="menuitem" class="danger" aria-disabled="true" title="Palautettava poisto suunnitellaan ensin (recoverable-workspace-deletion).">${ICON_TRASH}<span>Poista työtila…</span><span class="why">tulossa</span></button>`;
}
function openLayer(kind, anchor) {
  if (LAYER?.kind === kind) return closeLayer();
  LAYER = { kind, anchor }; layer.className = `wl wl-${kind}`; layer.setAttribute('role', kind === 'git' ? 'dialog' : 'menu');
  layer.setAttribute('aria-label', kind === 'git' ? 'Git' : 'Työtilan toiminnot');
  layer.innerHTML = kind === 'git' ? gitLayer() : moreLayer(); layer.hidden = false;
  // On a phone the Git layer is a bottom sheet over a scrim, as in 2026-10-16-tyotilasivu.
  const sheet = uiFrame.getBoundingClientRect().width < 600 && kind === 'git'; layer.classList.toggle('sheet', sheet); scrim.hidden = !sheet;
  anchor.setAttribute('aria-expanded', 'true');
  if (sheet) { layer.style.left = layer.style.top = ''; return layer.focus({ preventScroll: true }); }
  const f = uiFrame.getBoundingClientRect(), a = anchor.getBoundingClientRect(), wd = layer.offsetWidth;
  const right = kind === 'more';
  layer.dataset.place = right ? 'down-right' : 'down';
  layer.style.left = Math.max(8, Math.min(right ? a.right - f.left - wd : a.left - f.left, f.width - wd - 8)) + 'px';
  layer.style.top = (a.bottom - f.top + 6) + 'px';
  anchor.setAttribute('aria-expanded', 'true');
  (layer.querySelector('[role="menuitem"]:not([aria-disabled])') || layer).focus({ preventScroll: true });
}
function closeLayer(focusBack = false) {
  if (!LAYER) return; const a = LAYER.anchor; LAYER = null; layer.hidden = true; scrim.hidden = true;
  if (a?.isConnected) { a.setAttribute('aria-expanded', 'false'); if (focusBack) a.focus({ preventScroll: true }); }
}

// ---------- Navigation ----------
function showPage(id) { stage.classList.remove('sp-static'); VIEW = 'page'; PAGE = id; POP = false; UI.pop = false; UI.drawer = false; closeLayer(); paint(); following = false; stage.innerHTML = page(); stage.scrollTop = 0; lastTop = 0; }
function openSpin(id) {
  stage.classList.remove('sp-static'); VIEW = 'spin'; SEL = id; POP = false; UI.pop = false; UI.drawer = false; closeLayer(); paint();
  stage.innerHTML = ''; requestAnimationFrame(() => { stage.innerHTML = spinView(spin(id)); following = true; stage.scrollTop = stage.scrollHeight; lastTop = stage.scrollTop; });
}
// Re-render whatever is showing after a spinoff or the parent changed.
// A re-render does not replay the entrance animation of the whole thread.
function changed() {
  stage.classList.add('sp-static'); paint();
  if (VIEW === 'page') { const top = stage.scrollTop; stage.innerHTML = page(); stage.scrollTop = top; }
  else if (VIEW === 'spin') { const top = stage.scrollTop; stage.innerHTML = spinView(spin(SEL)); stage.scrollTop = top; }
  else if (UI.sel === PID) stage.innerHTML = parentView();
}

// ---------- Simulation: a spinoff finishes; the person answers the parent ----------
function mergeS2() {
  const s = spin('s2'); if (s.st !== 'working') return;
  Object.assign(s, { st: 'merged', t: 'nyt', reply: 'Välimuisti on käytössä: avain on `requirements.txt`:n tiiviste, ja toinen ajo palautti 41 pakettia välimuistista. CI-ajo meni läpi (6 min 40 s → 2 min 05 s). Mergesin haaran main-haaraan.', out: { commit: '5be27d0', commits: 1, add: 9, del: 1, files: ['.github/workflows/ci.yml'] } });
  s.work = [...s.work, ['bash', 'pytest -q', '16 passed in 0.44s'], ['bash', `taskfleet run merge ${s.rid}`, '{"status":"done","landed":true,"commit":"5be27d0"}']];
  // The parent is idle, so it has not seen this yet; Taskfleet has.
  if (!PWORK) { HIST.push({ kind: 'marker', t: 'obs', id: 's2', time: 'nyt' }); OBS++; }
  REC.p1.recap = REC.p1.recap.replace('Pip-välimuisti on kesken.', 'Pip-välimuisti on mergetty.');
  changed();
}
function answerParent(text) {
  HIST.push({ kind: 'user', time: '14:52', md: text });
  PARENT.st = 'working'; PWORK = 'Mergeää aikavyöhykkeen'; changed();
  setTimeout(() => {
    const s4 = spin('s4'); s4.st = 'merged'; s4.t = 'nyt';
    const s2 = spin('s2'); const s2done = s2.st === 'merged';
    HIST.push({ kind: 'turn', time: '14:53', blocks: [
      tf(`taskfleet run merge ${s4.rid}`, `{"run_id":"${s4.rid}","status":"done","landed":true,"report":{"commit":"c81d2fa","commits":2}}`),
      tf(`taskfleet run show ${s2.rid}`, s2done ? `{"run_id":"${s2.rid}","status":"done","landed":true,"report":{"commit":"5be27d0"}}` : `{"run_id":"${s2.rid}","status":"running"}`),
      { t: 'reply', md: `Mergesin aikavyöhykkeen main-haaraan (\`c81d2fa\`, 2 committia). ${s2done ? 'Pip-välimuistikin on mergetty (`5be27d0`), joten aloitan seuraavaksi aikakatkaisun konfliktin korjaamisen uuden mainin päältä.' : 'Pip-välimuisti on vielä kesken; korjaan aikakatkaisun konfliktin, kun se on valmis.'}` },
    ] });
    // Seen while open: the reply leaves the parent waiting, not marked as new (design.md).
    PWORK = ''; PARENT.st = VIEW === 'conv' && UI.sel === PID ? 'waiting' : 'attention'; OBS = 0;
    REC.p1 = { age: 'nyt', recap: `README-esimerkit ja aikavyöhyke on mergetty. ${s2done ? 'Pip-välimuisti on mergetty.' : 'Pip-välimuisti on kesken.'} Maanantain aikakatkaisu odottaa konfliktin korjausta; työ on tallessa.`, next: s2done ? 'Agentti korjaa aikakatkaisun konfliktin.' : 'Odota välimuisti-spinoffia.' };
    changed();
  }, 1600);
}
// Page-bar helper: let the working spinoff finish now.
document.querySelector('.page-bar .hint').insertAdjacentHTML('beforebegin', '<button type="button" id="sp-finish" class="page-btn">Välimuisti valmistuu</button>');
document.getElementById('sp-finish').addEventListener('click', mergeS2);

// ---------- Clicks ----------
window.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.closest('.proto-picker, .page-bar')) return;
  const stop = () => { e.preventDefault(); e.stopPropagation(); };
  const wsName = t.closest('.ws-name[data-ui="ws"]');
  if (wsName) { stop(); return showPage(wsName.closest('.ws').querySelector('[data-ws-tog]').dataset.wsTog); }
  const tbWs = t.closest('.tb-ws[data-ui="ws"]');
  if (tbWs) { stop(); return showPage(selConv().ws.id); }
  const wsp = t.closest('.p-menu [data-p="wspage"]');
  if (wsp) { const id = wsp.closest('.p-menu').querySelector('[data-p^="new:"]').dataset.p.slice(4); setTimeout(() => { uiToast.classList.remove('on'); showPage(id); }); return; }
  // The composer of the parent conversation: the person answers the parent, never a spinoff.
  const send = t.closest('.composer [data-c="send"]');
  if (send && VIEW === 'conv' && UI.sel === PID) {
    stop(); const ta = comp.querySelector('textarea'); const text = ta.value.trim(); if (!text || PWORK) return;
    ta.value = ''; C.text = ''; fit(ta); updateComposer(); return answerParent(text);
  }
  const conv = t.closest('[data-conv], [data-ws-add]');
  if (conv) { stage.classList.remove('sp-static'); VIEW = 'conv'; POP = false; PAGE = null; closeLayer(); if (conv.dataset.conv === PID) OBS = 0; return; }
  const hit = t.closest('[data-spin], [data-spinpanel], [data-kidfold], [data-pfold], [data-git], [data-wsmore], [data-wl-close], [data-newconv], [data-wm], .wl [aria-disabled="true"], [data-restore]');
  if (!hit) {
    if (LAYER && !t.closest('.wl')) closeLayer();
    if (POP && !t.closest('.sp-panel')) { POP = false; paint(); }
    return;
  }
  stop();
  const d = hit.dataset;
  if (d.spin) return openSpin(d.spin);
  if (d.spinpanel !== undefined) {
    if (VIEW === 'page') { VIEW = 'conv'; PAGE = null; POP = true; return openConv(PID); }
    POP = !POP; OBS = 0; return paint();
  }
  if (d.kidfold !== undefined) { KIDFOLD.merged = !KIDFOLD.merged; return changed(); }
  if (d.pfold) { PFOLD[d.pfold] = !PFOLD[d.pfold]; return changed(); }
  if (d.wlClose !== undefined) return closeLayer(true);
  if (d.git !== undefined) return openLayer('git', hit);
  if (d.wsmore !== undefined) return openLayer('more', hit);
  if (d.newconv !== undefined) { const w = ws(); const id = `n${++UI.created}`; w.convs.unshift({ id, title: 'Uusi keskustelu', st: 'new' }); w.open = true; VIEW = 'conv'; PAGE = null; return openConv(id); }
  if (hit.getAttribute('aria-disabled') === 'true') return toast(hit.title);
  if (d.wm) {
    const w = ws(); closeLayer();
    if (d.wm === 'copy') { try { await navigator.clipboard.writeText(w.path); } catch {} return toast(`Kopioitu ${w.path}`); }
    if (d.wm === 'gh') return toast(`Avautuisi github.com/maintainer/${w.id}`);
    if (d.wm === 'hide') return toast(`${w.id} piilotettaisiin sivupalkista; se löytyy Asetuksista ja säilyy levyllä.`);
    if (d.wm === 'rename') return toast('Näyttönimen muutos avautuisi pieneen ikkunaan (kierros 2026-10-16-tyotilasivu).');
  }
  if (d.restore) {
    const c = ws().convs.find(x => x.id === d.restore);
    if (c) c.archived = false; else { const a = ARCHIVED[PAGE]; const [r] = a.splice(a.findIndex(x => x.id === d.restore), 1); ws().convs.push({ id: r.id, title: r.title, st: 'done' }); DONE_T[r.id] = r.t; }
    changed(); return toast('Palautettu listaan. Pi ei käynnistynyt.');
  }
}, true);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && e.target.matches?.('.composer textarea') && VIEW === 'conv' && UI.sel === PID) {
    e.preventDefault(); e.stopPropagation(); comp.querySelector('[data-c="send"]')?.click(); return;
  }
  if (e.key !== 'Escape') return;
  if (LAYER) { e.stopPropagation(); return closeLayer(true); }
  if (POP) { e.stopPropagation(); POP = false; paint(); uiTop.querySelector('.sp-chip')?.focus(); }
}, true);

const show = (v) => () => {
  stage.classList.remove('sp-static'); CUR = v; VIEW = 'conv'; SEL = null; PAGE = null; POP = false; OBS = 0; PWORK = ''; closeLayer();
  SPIN = SPIN0(); for (const s of SPIN) if (s.st === 'working') s.t0 = performance.now() - s.clock * 1000;
  HIST = HIST0(); PARENT.st = 'waiting';
  REC.p1 = { age: '14.41', recap: 'Neljä spinoffia 0.4-julkaisua varten. README-esimerkit on mergetty. Maanantain aikakatkaisu jäi konfliktiin `ci.yml`:ssä; työ on tallessa. Aikavyöhyke on valmis ja odottaa mergeä. Pip-välimuisti on kesken.', next: 'Kerro, mergeänkö aikavyöhykkeen.' };
  UI.sel = PID; UI.pop = false; UI.drawer = false; UI.ws.find(w => w.id === WSID).open = true;
  paint(); return parentView();
};
window.v1 = show('v1'); window.v2 = show('v2'); window.v3 = show('v3');
})();
