// Välivastaukset (proto-interim-replies, 19.10.2026). Kirjaston `lanka` tuntee vuorossa vain
// yhden vastauksen, joten kierros piirtää vuoronsa itse samalla kielellä (lanka, solmut,
// työkalurivit, kuplat, inforivi) ja soittaa elävän vuoron omalla soittimellaan. Sama
// piirtäjä palvelee historiaa ja elävää vuoroa: tila muuttuu, ja vuoro piirretään uudelleen
// `morph`illa, jotta painikkeet säilyvät samoina elementteinä.
(() => {
const M = 'Claude Opus 5.5';
const M_ID = 'anthropic/claude-opus-5-5';

// The conversation lives in fleetrepo, as Jari's real one did.
const c1 = UI.ws[0].convs.find(c => c.id === 'c1');
UI.ws[0].convs = UI.ws[0].convs.filter(c => c !== c1);
const hb = UI.ws.find(w => w.id === 'fleetrepo'); hb.open = true; hb.convs.unshift(c1);
c1.title = 'Repojen synkkaus'; UI.titles = ['Repojen synkkaus', 'Fleetrepo ja open-habitat ajan tasalle'];
// The top bar's model chip names this conversation's model, not the library's.
const libActions = APP.actions;
APP.actions = (c) => libActions(c).replace('<span class="mono">gpt-5.5</span>', '<span class="mono">claude-opus-5-5</span>');

// ---------- Fixture: two finished turns and one live turn ----------
const sh = (command, result) => ({ t: 'tool', name: 'bash', target: command.split('\n')[0], args: { command }, result });
const HISTORY = [
  { kind: 'marker', t: 'settings', time: '09:11', model: M_ID, thinking: 'high' },
  { kind: 'user', time: '09:12', md: 'Synkkaa fleetrepo originin kanssa ja aja fleet doctor.' },
  { kind: 'turn', id: 'a', dur: '3:48', blocks: [
    { t: 'think', md: '**Checking the repository state before pulling**' },
    sh('git status --short --branch', '## main...origin/main [behind 3]'),
    sh('git rev-list --count origin/main..HEAD', '0'),
    { t: 'note', time: '09:13', md: 'Working tree on puhdas, ei paikallisia committeja — pelkkä pull riittää, pushattavaa ei ole.' },
    sh('git pull --rebase', `Updating 4f2a1c9..b81d0e3
Fast-forward
 dotfiles/src/AGENTS.md         | 12 +++++++-----
 infra/open-habitat-test/hosts  |  2 ++
 units/issuectl.toml            |  2 +-
 3 files changed, 11 insertions(+), 5 deletions(-)`),
    { t: 'think', md: '**Running the fleet doctor across machines**' },
    sh('fleetrepo fleet doctor', `alder     converged    main@b81d0e3
maple  converged    main@b81d0e3
cedar   converged    main@b81d0e3
rowan     unreachable  ssh: connect to host rowan port 22: timed out after 10s
willow   converged    main@b81d0e3

4 converged, 1 unreachable`),
    { t: 'note', time: '09:15', md: 'Pull meni läpi, kolme uutta committia. Doctorin mukaan `rowan` ei vastaa — katson vielä, onko kone vain unessa vai oikeasti rikki.' },
    sh('ping -c 2 -W 2 rowan.local', `PING rowan.local (192.168.1.23): 56 data bytes
Request timeout for icmp_seq 0
Request timeout for icmp_seq 1

--- rowan.local ping statistics ---
2 packets transmitted, 0 packets received, 100.0% packet loss`),
    { t: 'reply', time: '09:16', md: `Fleetrepo on ajan tasalla: \`main\` on nyt \`b81d0e3\`.

- \`alder\`, \`maple\`, \`cedar\` ja \`willow\` ovat konvergoituneet.
- \`rowan\` ei vastaa SSH:hon eikä pingiin. Kone on todennäköisesti unessa; sitä ei ole todennettu, joten en merkitse sitä rikkinäiseksi.

Kun kone herää, aja \`fleetrepo fleet doctor rowan\`.` },
  ] },
  { kind: 'user', time: '09:18', md: 'Selvä. Tarkista vielä, että Gitean yöllinen varmuuskopio on ajettu ja ehjä.' },
  { kind: 'turn', id: 'b', dur: '3:37', blocks: [
    { t: 'think', md: '**Finding the backup timer and its last run**' },
    sh('systemctl list-timers gitea-backup.timer', `NEXT                         LEFT      LAST                         PASSED   UNIT                ACTIVATES
Tue 2026-10-20 03:00:00 EEST 17h left  Mon 2026-10-19 03:00:04 EEST 6h ago   gitea-backup.timer  gitea-backup.service

1 timers listed.`),
    sh('journalctl -u gitea-backup --since today --no-pager', `Oct 19 03:00:04 alder systemd[1]: Starting gitea-backup.service...
Oct 19 03:00:05 alder gitea-backup[81234]: dumping gitea database (postgres)
Oct 19 03:00:46 alder gitea-backup[81234]: warning: repository is locked by maple (pid 4417) since 2026-10-18 22:14, waited 41s
Oct 19 03:01:52 alder gitea-backup[81234]: restic: snapshot 7c1e0a94 saved
Oct 19 03:02:41 alder systemd[1]: gitea-backup.service: Deactivated successfully.`),
    { t: 'note', time: '09:19', md: `Ajo on tehty ja päättyi onnistuneesti, mutta lokissa on kaksi asiaa, jotka kannattaa tietää ennen kuin jatkan:

1. **Lukko oli varattuna.** \`maple\` piti restic-repon lukkoa eilisillasta 22:14 asti, ja yön ajo joutui odottamaan 41 sekuntia. Todennäköisesti läppärin oma varmuuskopio jäi kesken, kun kansi suljettiin. Tämä ei rikkonut mitään, mutta jos lukko jää pysyväksi, seuraava ajo epäonnistuu.
2. **Tilannevedos on pienempi kuin edellinen.** \`7c1e0a94\` on noin 180 Mt pienempi kuin perjantain vedos. Se voi olla siivottua LFS-sisältöä, mutta en oleta sitä.

Tarkistan seuraavaksi arkiston eheyden \`restic check\`illä ja vertaan vedoksia. Se kestää noin minuutin; en poista lukkoa enkä muuta mitään.` },
    sh('restic -r /srv/backup/gitea check --read-data-subset=5%', `using temporary cache in /var/tmp/restic-check-cache-1736
repository 3e8a91c2 opened (version 2, compression level auto)
load indexes
check all packs
check snapshots, trees and blobs
read 5.0% of data packs
[0:41] 100.00%  37 / 37 packs
no errors were found`),
    sh('restic -r /srv/backup/gitea diff 51d9f3b2 7c1e0a94 | tail -6', `Files:         212 new,    37 removed,   508 changed
Dirs:           18 new,     6 removed
Others:          0 new,     0 removed
Data Blobs:    143 new,  1102 removed
Added:   94.208 MiB
Removed: 275.733 MiB`),
    { t: 'think', md: '**The removed data matches Friday’s LFS cleanup**' },
    // An interim reply immediately before the final answer: nothing between them.
    { t: 'note', time: '09:21', md: 'Eheystarkistus ei löytänyt virheitä, ja pienentyminen selittyy perjantain LFS-siivouksella (276 Mt pois, 94 Mt uutta).' },
    { t: 'reply', time: '09:21', md: `Gitean varmuuskopio on kunnossa.

- Yön ajo 03:00 onnistui, tilannevedos \`7c1e0a94\`.
- \`restic check\` (5 % datasta luettu) ei löytänyt virheitä.
- Pienempi koko johtuu perjantain LFS-siivouksesta, ei puuttuvasta datasta.

Yksi asia jää sinulle: \`maple\`in vanha lukko. Jos haluat sen pois ennen ensi yötä, aja läppärillä \`restic unlock\`. En tehnyt sitä täältä, koska lukko kuuluu toisen koneen prosessille.` },
  ] },
  { kind: 'user', time: '09:24', md: 'Aja sama synkkaus open-habitatille. Siellä voi olla jotain kesken.' },
];
const LIVE_THINK = 'Tarkistan ensin työpuun ja haaran tilan. Jos jotain on kesken, en koske siihen ennen kuin tiedän, mitä se on.';
const LIVE_NOTE = 'Täällä on kesken kaksi asiaa: `TODO.md` on muokattu ja `notes.md` on uusi, eikä kumpikaan ole commitissa. Lisäksi `main` on kaksi committia originia edellä. En koske muokkauksiin — teen pullin `--autostash`illa ja pushaan vain nuo kaksi committia.';
const LIVE_REPLY = `Synkattu. \`main\` on nyt sama kuin originissa (\`a41c2e7\`), ja kaksi committiasi on pushattu.

Keskeneräiset muutokset ovat ennallaan: \`TODO.md\` on yhä muokattu ja \`notes.md\` seuraamaton. Niitä ei commitoitu eikä pushattu.`;

// ---------- Shared pieces ----------
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// A stage summary leaves out a kind it has none of ("1 työkalu", not "0 ajatusta · 1 työkalu").
const counts = (bs, skipZero = false) => [[bs.filter(b => b.t === 'think').length, 'ajatus', 'ajatusta'], [bs.filter(b => b.t === 'tool').length, 'työkalu', 'työkalua']].filter(([n]) => n || !skipZero).map(([n, a, b]) => plural(n, a, b)).join(' · ');
const textOf = (b) => b.md ?? b.text ?? '';
const caretFor = (html, live) => live && !/<\/(pre|figure|div|ol|ul|blockquote)>$/.test(html) ? '<span class="caret"></span>' : '';
const prose = (b) => { const h = md(textOf(b)); return `<div class="prose">${h}${caretFor(h, b.live)}</div>`; };
const ICON_MSG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/></svg>';

function thinkCell(T, b) {
  if (b.live) return liveThink({ text: textOf(b) });
  const t = textOf(b);
  if (isShort(t)) return `<div class="think-row"><span class="lbl">Ajattelu</span><span class="prose">${md(t)}</span></div>`;
  const id = `${T.id}-${b.id}`;
  return `<div><button class="quiet-btn think-btn" type="button" aria-expanded="${!!b.expanded}" aria-controls="${id}">${CHEV}Ajattelu</button><div id="${id}" class="think-quote"${b.expanded ? '' : ' hidden'} style="margin-top:6px">${md(t)}</div></div>`;
}
function toolCell(T, b) {
  if (T.live) return liveToolRow(b);
  const id = `${T.id}-${b.id}`;
  return `<section class="tool"><button class="disc" type="button" aria-expanded="${!!b.expanded}" aria-controls="${id}">${CHEV}<span class="names"><span class="name">${esc(b.name)}</span><span class="target">${esc(b.target)}</span></span>${okMark()}</button><div id="${id}"${b.expanded ? '' : ' hidden'}>${b.expanded ? toolBody(b) : ''}</div></section>`;
}
const workCell = (T, b) => b.t === 'think' ? thinkCell(T, b) : toolCell(T, b);
const workNode = (T, b, last) => `<span class="node${b.t === 'tool' ? ' tool' : ''}${last && T.status === 'working' ? ' active' : ' done'}" aria-hidden="true"></span>`;

// The final answer's card head, as in the library: done, or still streaming.
const finalHead = (b) => b.live
  ? `<span class="meta" style="font-weight:500">Vastaa</span><span class="model">${M}</span>`
  : `<span class="ok">${ICON_CHECK}Vastaus valmis</span><span class="model">${M}</span>${copyBtn('Kopioi vastaus', textOf(b))}<time class="meta">${b.time}</time>`;
const finalCard = (b) => `<article class="bubble reply"><div class="bar head">${finalHead(b)}</div>${prose(b)}</article>`;
// An interim reply as a message of its own (Viesti langassa, Vaiheet).
const noteCard = (b) => `<article class="bubble reply iv-msg"><div class="bar head"><span class="iv-lbl">${ICON_MSG}${b.live ? 'Kirjoittaa' : 'Välivastaus'}</span>${b.live ? '' : `${copyBtn('Kopioi välivastaus', textOf(b))}<time class="meta">${b.time}</time>`}</div>${prose(b)}</article>`;

function activityOf(T) {
  const b = T.blocks[T.blocks.length - 1];
  if (!b) return 'Aloittaa';
  if (b.t === 'think') return 'Ajattelee';
  if (b.t === 'tool') return b.state === 'forming' ? `Muodostaa ${b.name}-kutsua` : b.state === 'running' ? `Ajaa ${b.target}` : 'Jatkaa';
  if (b.t === 'note') return b.live ? 'Kirjoittaa sinulle' : 'Jatkaa';
  return b.live ? 'Vastaa' : 'Viimeistelee';
}
const clockOf = (T) => { const s = Math.max(0, Math.round((performance.now() - T.t0) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
// The library's information row (lib/quiet.js) with its Näytä työ button at the start.
const infoRow = (T, open = T.open) => `<div class="info-row"><button type="button" class="show-work" data-fold aria-expanded="${open}"><span class="lbl"><span class="when-closed">Näytä työ</span><span class="when-open">Piilota työ</span></span>${CHEV}</button><span class="act"><span class="live-dot"></span>Agentti työskentelee</span><span class="info-now">${esc(activityOf(T))}</span><span class="clock">${clockOf(T)}</span></div>`;
function headCell(T, open) {
  if (T.status === 'working') return `<div class="head-cell"><span class="who" style="padding-left:1px">Pi</span><span class="model">${M}</span></div>`;
  return `<div class="head-cell"><button class="head-btn" type="button" data-fold aria-expanded="${open}">${CHEV}<span class="who">Pi</span></button><span class="model">${M}</span><span class="sum">${counts(T.blocks)} · ${T.dur}</span></div>`;
}

// ---------- Directions: each returns the turn's rows { node, cell, show } ----------
const row = (node, cell, show = true, cls = '') => ({ node, cell, show, cls });
const NODE = (cls) => `<span class="node ${cls}" aria-hidden="true"></span>`;
const isLast = (T, b) => T.blocks[T.blocks.length - 1] === b;

// Nykyinen: the production look of 19.10. The interim text is a plain line in the work.
function rowsNow(T) {
  const rows = [row(NODE('head'), headCell(T, T.open))];
  for (const b of T.blocks) {
    if (b.t === 'reply') rows.push(row(NODE('done'), finalCard(b)));
    else if (b.t === 'note') rows.push(row(NODE(''), `<div class="iv-plain">${prose(b)}</div>`, T.open));
    else rows.push(row(workNode(T, b, isLast(T, b)), workCell(T, b), T.open));
  }
  if (T.status === 'working') rows.push(row(NODE('strip-node'), infoRow(T)));
  return rows;
}

// Viesti langassa: the interim reply is a card of its own in its place; only work folds.
function rowsThread(T) {
  const rows = [row(NODE('head'), headCell(T, T.open))];
  for (const b of T.blocks) {
    if (b.t === 'reply') rows.push(row(NODE('done'), finalCard(b)));
    else if (b.t === 'note') rows.push(row(NODE('iv-node'), noteCard(b)));
    else rows.push(row(workNode(T, b, isLast(T, b)), workCell(T, b), T.open));
  }
  if (T.status === 'working') rows.push(row(NODE('strip-node'), infoRow(T)));
  return rows;
}

// Osa vastausta: every word Pi addressed to the person in this turn is in one card at the
// end. The open work keeps a reference row where the interim reply was written.
function rowsAnswer(T) {
  const rows = [row(NODE('head'), headCell(T, T.open))];
  const notes = T.blocks.filter(b => b.t === 'note');
  const reply = T.blocks.find(b => b.t === 'reply');
  for (const b of T.blocks) {
    if (b.t === 'reply') continue;
    if (b.t === 'note') {
      const first = textOf(b).split('\n')[0].replace(/[*`]/g, '');
      rows.push(row(NODE('iv-node iv-small'), `<button type="button" class="iv-anchor" data-goto="${T.id}-${b.id}">${ICON_MSG}<span class="iv-a-lbl">${b.live ? 'Kirjoittaa sinulle' : `Kirjoitti sinulle ${b.time}`}</span><span class="iv-snip">${esc(first)}</span></button>`, T.open));
    } else rows.push(row(workNode(T, b, isLast(T, b)), workCell(T, b), T.open));
  }
  if (notes.length || reply) {
    const head = reply ? finalHead(reply) : `<span class="iv-lbl">${ICON_MSG}Työn aikana</span><span class="model">${M}</span>`;
    const entries = notes.map(b => `<div class="iv-entry" id="${T.id}-${b.id}"><time class="meta">${b.live ? 'nyt' : b.time}</time>${prose(b)}</div>`).join('');
    const pre = notes.length ? `<div class="iv-pre"${reply ? '' : ' data-alone'}>${reply ? `<div class="iv-sec">Työn aikana</div>` : ''}${entries}</div>` : '';
    rows.push(row(NODE(reply && !reply.live ? 'done' : 'iv-node'), `<article class="bubble reply iv-card"><div class="bar head">${head}</div>${pre}${reply ? `<div class="iv-final">${prose(reply)}</div>` : ''}</article>`));
  }
  if (T.status === 'working') rows.push(row(NODE('strip-node'), infoRow(T)));
  return rows;
}

// Vaiheet: each interim reply closes a stage of work. A stage has its own summary row that
// opens just that stage; the turn's head opens or closes them all.
function stagesOf(T) {
  const out = []; let cur = { work: [] };
  for (const b of T.blocks) {
    if (b.t === 'note' || b.t === 'reply') { cur.end = b; out.push(cur); cur = { work: [] }; } else cur.work.push(b);
  }
  if (cur.work.length || !out.length) out.push(cur);
  return out;
}
function rowsStages(T) {
  const stages = stagesOf(T); T.seg ??= {};
  const isOpen = (k) => T.seg[k] ?? false;
  const all = stages.every((s, k) => !s.work.length || isOpen(k));
  const rows = [row(NODE('head'), headCell(T, all && stages.some(s => s.work.length)))];
  stages.forEach((s, k) => {
    const trailing = T.status === 'working' && !s.end;
    // The stage still in progress is opened by the information row's Näytä työ, like today.
    const open = trailing ? T.open : isOpen(k);
    if (s.work.length && !trailing) {
      const last = s.work.filter(b => b.t === 'tool').pop();
      rows.push(row(NODE('iv-seg'), `<button type="button" class="iv-seg-btn" data-seg="${k}" aria-expanded="${open}">${CHEV}<span class="sum">${counts(s.work, true)}</span>${last ? `<span class="iv-last">${esc(last.target)}</span>` : ''}</button>`));
    }
    for (const b of s.work) rows.push(row(workNode(T, b, isLast(T, b)), workCell(T, b), open));
    if (s.end) rows.push(s.end.t === 'reply' ? row(NODE('done'), finalCard(s.end)) : row(NODE('iv-node'), noteCard(s.end)));
  });
  if (T.status === 'working') rows.push(row(NODE('strip-node'), infoRow(T)));
  return rows;
}

const DIRS = { thread: rowsThread, answer: rowsAnswer, stages: rowsStages, now: rowsNow };
let dir = 'thread';

// ---------- Rendering a turn ----------
function render(T) {
  const rows = DIRS[dir](T);
  const vis = rows.filter(r => r.show);
  const html = rows.map(r => {
    const k = vis.indexOf(r);
    const pos = !r.show ? '' : [k === 0 ? 'first' : '', k === vis.length - 1 ? (T.status === 'working' ? 'tail' : 'last') : ''].join(' ').trim();
    const h = r.show ? '' : ' hidden';
    return `<div class="rail-cell ${pos}"${h}>${r.node}</div><div class="cell ${r.cls}"${h}>${r.cell}</div>`;
  }).join('');
  morph(T.el, html);
  for (const v of T.el.querySelectorAll('pre.viewport[data-scroll]')) v.scrollTop = v.scrollHeight;
}

function mountTurn(host, T) {
  T.el = document.createElement('div');
  T.el.className = `turn iv-turn${T.live ? ' live' : ''}`;
  host.appendChild(T.el);
  T.el.addEventListener('click', (e) => onTurnClick(T, e), true);
  render(T);
}
function onTurnClick(T, e) {
  const fold = e.target.closest('[data-fold]');
  if (fold) {
    if (dir === 'stages' && T.status !== 'working') {
      // The head opens every stage, or closes them all when all are open.
      const stages = stagesOf(T); const open = fold.getAttribute('aria-expanded') !== 'true';
      stages.forEach((s, k) => { T.seg[k] = open; });
    } else T.open = !T.open;
    render(T); e.stopPropagation(); return;
  }
  const seg = e.target.closest('[data-seg]');
  if (seg) { const k = +seg.dataset.seg; T.seg[k] = !(T.seg[k] ?? false); render(T); e.stopPropagation(); return; }
  const go = e.target.closest('[data-goto]');
  if (go) {
    const el = document.getElementById(go.dataset.goto); if (!el) return;
    following = false; el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    e.stopPropagation(); return;
  }
  const btn = e.target.closest('.disc[aria-controls], .think-btn[aria-controls]');
  if (btn) {
    const id = btn.getAttribute('aria-controls').replace(/^live-/, '').replace(`${T.id}-`, '');
    const b = T.blocks.find(x => x.id === id); if (!b) return;
    b.expanded = !b.expanded; render(T); e.stopPropagation();
  }
}

// ---------- History ----------
function historyHtml() {
  let i = 0;
  return HISTORY.map(m => m.kind === 'user' ? userBubble(m, i++) : m.kind === 'marker' ? markerR(m, i++) : `<div data-turn="${m.id}"></div>`).join('');
}
function mountHistory(host) {
  for (const m of HISTORY.filter(x => x.kind === 'turn')) {
    const slot = host.querySelector(`[data-turn="${m.id}"]`);
    const T = { id: `h${m.id}`, status: 'settled', open: false, seg: {}, dur: m.dur, blocks: m.blocks.map((b, k) => ({ ...b, id: `b${k}`, expanded: false })) };
    const frag = document.createElement('div'); mountTurn(frag, T); slot.replaceWith(T.el);
  }
}

// ---------- The live turn as events in time ----------
function script() {
  const ev = []; let t = 0; const at = (d, fn, phase) => { t += d; ev.push([t, fn, phase]); };
  const stream = (text, id, gap) => { let acc = ''; for (const w of text.split(/(?<=\s)/)) { acc += w; const s = acc; at(gap, (S) => S.set(id, { text: s })); } };
  const tool = (id, command, lines, phase) => {
    at(400, (S) => S.add({ id, t: 'tool', name: 'bash', target: command, args: { command }, state: 'forming', out: [], expanded: false }));
    at(450, (S) => S.set(id, { state: 'running' }), phase);
    lines.forEach((l) => at(180, (S) => S.push(id, l)));
    at(300, (S) => S.set(id, { state: 'done' }));
  };
  at(0, (S) => S.start());
  at(300, (S) => S.add({ id: 'k1', t: 'think', text: '', live: true }));
  stream(LIVE_THINK, 'k1', 45);
  at(250, (S) => S.set('k1', { live: false }));
  tool('t1', 'git status --short --branch', ['## main...origin/main [ahead 2, behind 1]', ' M TODO.md', '?? issues/proto-interim-replies/notes.md']);
  tool('t2', 'git log --oneline origin/main..HEAD', ['a41c2e7 web: distinguish git fetch from local reread', '9be0d13 KOKEILTAVAA: 19.10. test pass']);
  at(500, (S) => S.add({ id: 'n1', t: 'note', text: '', live: true, time: '09:25' }), 'note-start');
  stream(LIVE_NOTE, 'n1', 70);
  at(200, (S) => S.set('n1', { live: false }), 'note-done');
  tool('t3', 'git pull --rebase --autostash', ['Created autostash: 5c0e2d1', 'Successfully rebased and updated refs/heads/main.', 'Applied autostash.'], 'pull-running');
  tool('t4', 'git push', ['To gitea.koti:jari/open-habitat.git', '   033d194..a41c2e7  main -> main']);
  at(400, (S) => S.add({ id: 'k2', t: 'think', text: '', live: true }));
  stream('**Confirming the local changes survived the rebase**', 'k2', 90);
  at(200, (S) => S.set('k2', { live: false }));
  tool('t5', 'git status --short', [' M TODO.md', '?? issues/proto-interim-replies/notes.md']);
  at(500, (S) => S.add({ id: 'r', t: 'reply', text: '', live: true, time: '09:26' }), 'reply-start');
  stream(LIVE_REPLY, 'r', 40);
  at(300, (S) => S.set('r', { live: false }));
  at(700, (S) => S.settle(), 'settled');
  return ev;
}
function playTurn(host) {
  const token = ++run;
  const T = { id: 'live', live: true, status: 'idle', open: false, seg: {}, blocks: [], t0: performance.now(), dur: '' };
  const S = {
    start() { T.status = 'working'; T.t0 = performance.now(); mountTurn(host, T); T.el.classList.add('working'); },
    add(b) { T.blocks.push(b); render(T); },
    set(id, d) { Object.assign(T.blocks.find(x => x.id === id), d); render(T); },
    push(id, line) { T.blocks.find(x => x.id === id).out.push(line); render(T); },
    settle() {
      T.status = 'settled'; T.dur = clockOf(T);
      for (const b of T.blocks) if (b.t === 'tool') b.result = b.out.join('\n');
      T.el.classList.remove('working'); render(T);
    },
  };
  const slow = document.getElementById('slow').checked ? 2.2 : 1;
  for (const [t, fn, phase] of script()) setTimeout(() => { if (token !== run) return; fn(S); if (phase) window.IV_PHASE = phase; }, t * slow);
  const tick = () => { if (token !== run) return; if (T.status === 'working') { render(T); setTimeout(tick, 1000); } };
  setTimeout(tick, 1000);
}
// The composer's Lähetä plays this round's live turn again after the new message.
playLive = (host) => playTurn(host);

const libContent = window.content;
window.content = function () {
  if (selConv().id !== 'c1') return libContent();
  run++; window.IV_PHASE = 'idle'; currentR = threadR();
  // Mount after the stage has taken the HTML (the picker and openConv both set it in a frame).
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const host = stage.querySelector('.vwrap.iv'); if (!host || host.dataset.mounted) return;
    host.dataset.mounted = '1'; mountHistory(host);
    following = true; stage.scrollTop = stage.scrollHeight; lastTop = stage.scrollTop;
    playTurn(host);
  }));
  return `<div class="vwrap iv iv-${dir}">${historyHtml()}</div>`;
};
const view = (d) => () => { dir = d; return appView(); };
window.v1 = view('thread');
window.v2 = view('answer');
window.v3 = view('stages');
window.v4 = view('now');
})();
