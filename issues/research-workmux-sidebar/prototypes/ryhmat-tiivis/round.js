// Round 3a (research-workmux-sidebar): Ryhmät, compact. Jari 2026-10-28 chose Ryhmät from round 1
// and asked whether a worker fits on one tight line when a coloured ball alone tells its state.
// Every row is one line: ball, name, and at most one short fact. The ball has four meanings:
// working (teal, pulses), your turn (amber: a question or an unread reply), done (green: finished,
// waits for a message) and failed (red: the Taskfleet run failed, Pi crashed or the turn ended in
// an error). Waiting on background work is working: the agent goes on by itself.
//
// The directions differ on one axis: how dense the line is and what it keeps besides the name.
//   1 Nimi — 22 px rows, nothing but the ball and the name; the time is in the tooltip.
//   2 Aika — 24 px rows, the time since the last change at the end.
//   3 Tieto — 26 px rows, the one fact that matters for that state: how long it has
//                     worked, kysyy/vastasi, how long ago it finished, why it failed, what
//                     background work it waits for.
// The same in all three: Sinun vuorosi above, Käynnissä grouped per workspace (round 1's Ryhmät),
// done rows quiet for over an hour fold per group, all-quiet workspaces under Hiljaiset, the
// current conversation never folds away, rows 40 px on the phone for the thumb.
const { IC, esc, WS, S, ago, quiet, isYours } = F;
const NAMES = ['Nimi', 'Aika', 'Tieto'];
const W = (id, title, kind, t, more = {}) => ({ id, title, ws: 'kasvimaa', kind, t, worker: true, ...more });
F.fixture({
  cur: 'c4',
  few: ['c2', 'c5', 'c6', 'c9'],
  labels: { waiting: 'Valmis', failed: 'Epäonnistui' },
  all: [
    { id: 'c1', title: 'Iltakierros', ws: 'kasvimaa', kind: 'question', t: 4, ask: 'Mergetäänkö satokalenterin prototyyppi nyt vai odotetaanko valintaasi?', opts: ['Odota valintaa', 'Mergeä nyt'] },
    { id: 'c2', title: 'Kuvien pakkaus', ws: 'kirjasto', kind: 'new', t: 12, reply: 'Pakkaus on nyt build-vaiheessa ja testit ovat vihreinä. Kuvien koko pieneni keskimäärin 38 %.' },
    { id: 'c3', title: 'Sääaseman CSV-vienti', ws: 'saaasema', kind: 'new', t: 64, reply: 'Vienti kirjoittaa nyt yhden tiedoston vuorokautta kohden. Aikavyöhyke on UTC, kuten pyysit.' },
    W('w9', 'Siemenluettelon haku', 'question', 6, { ask: 'Haetaanko myös lajikkeen latinankielisellä nimellä?', opts: ['Kyllä', 'Ei'] }),
    { id: 'c4', title: 'Rupeama 29', ws: 'kasvimaa', kind: 'background', t: 25, waits: '6 workeria' },
    W('w1', 'Kastelun ajastus', 'working', 12),
    W('w2', 'Lomakkeen saavutettavuus', 'working', 8),
    W('w3', 'Kuvagallerian lataus', 'working', 3),
    W('w4', 'Tutkimus: sääennusteen rajapinnat', 'working', 21),
    W('w5', 'Prototyyppi: satokalenteri', 'working', 5),
    W('w6', 'Vanhan rajapinnan poisto', 'working', 0.7),
    W('w8', 'Kylvökalenterin testit', 'failed', 18, { why: 'epäonnistui', fail: 'Taskfleet merkitsi ajon epäonnistuneeksi: testit eivät menneet läpi kolmella yrityksellä.' }),
    W('w10', 'Kuvatekstien käännös', 'waiting', 35),
    W('w7', 'Mobiilinäkymän otsikko', 'waiting', 130),
    { id: 'c5', title: 'Lainaushistoria', ws: 'kirjasto', kind: 'working', t: 2 },
    { id: 'c6', title: 'Hakuindeksi', ws: 'kirjasto', kind: 'waiting', t: 190 },
    { id: 'c9', title: 'Varmuuskopion palautus', ws: 'muistiinpanot', kind: 'failed', t: 50, why: 'kaatui', fail: 'Pi päättyi kesken vuoron (kaatui). Keskustelu jatkuu, kun kirjoitat.' },
    { id: 'c10', title: 'Ainesosien yksiköt', ws: 'resepti', kind: 'waiting', t: 9 },
    { id: 'c7', title: 'Anturien kalibrointi', ws: 'saaasema', kind: 'background', t: 15, waits: 'kalibrointi.sh' },
    { id: 'c8', title: 'Blogin RSS', ws: 'kotisivu', kind: 'waiting', t: 1500 },
  ],
});

// The four balls. A row's kind maps to one of them; the tooltip and the accessible name say it.
const BALL = { question: 'you', new: 'you', working: 'work', background: 'work', waiting: 'done', done: 'done', failed: 'fail' };
const BALL_LABEL = { you: 'Sinun vuorosi', work: 'Työskentelee', done: 'Valmis', fail: 'Epäonnistui' };
const ball = (c) => `<span class="ball ${BALL[c.kind]}" aria-hidden="true"></span>`;
// The one fact direction 3 keeps: what the person would ask next about a row in that state.
function fact(c) {
  if (c.kind === 'question') return 'kysyy';
  if (c.kind === 'new') return 'vastasi';
  if (c.kind === 'background') return c.waits;
  if (c.kind === 'failed') return c.why;
  return ago(c.t);
}
const keep = (c) => c.id === S.cur;
function line(c) {
  const cur = c.id === S.cur ? ' aria-current="page"' : '';
  const state = isYours(c) ? `${BALL_LABEL.you}: ${c.kind === 'question' ? 'kysyy' : 'uusi vastaus'}` : BALL_LABEL[BALL[c.kind]];
  const tip = [c.title, c.ws, state, c.kind === 'background' ? `odottaa: ${c.waits}` : null, c.why ?? null, ago(c.t)].filter(Boolean).join(' · ');
  const end = S.v === 1 ? `<time>${ago(c.t)}</time>` : S.v === 2 ? `<span class="fact ${BALL[c.kind]}">${esc(fact(c))}</span>` : '';
  return `<li><button type="button" class="line" data-open="${c.id}" data-testid="row-${c.id}" data-ball="${BALL[c.kind]}"${cur} title="${esc(tip)}" aria-label="${esc(`${c.title}, ${state}, ${ago(c.t)}`)}">
    ${ball(c)}<span class="ttl">${esc(c.title)}</span>${end}</button></li>`;
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function toggle(key, label, n, extra = '') {
  const openNow = !!S.open[key];
  return `<li><button type="button" class="fold${extra}" data-act="fold" data-key="${esc(key)}" aria-expanded="${openNow}" data-testid="fold-${esc(key)}">
    <span class="chev" aria-hidden="true">${openNow ? IC.down : IC.right}</span><span class="fl">${esc(label)}</span><span class="count">${n}</span></button></li>`;
}
// Round 1's Ryhmät with one-line rows. A failed row never folds: it needs a look.
function grouped(list) {
  const total = list.length;
  const groups = WS.map(ws => ({ ws, rows: list.filter(c => c.ws === ws) })).filter(g => g.rows.length);
  const live = groups.filter(g => g.rows.some(c => !quiet(c) || keep(c)));
  const dormant = groups.filter(g => !live.includes(g));
  const part = (g) => {
    const shown = g.rows.filter(c => !quiet(c) || keep(c));
    const hidden = g.rows.filter(c => quiet(c) && !keep(c));
    const key = 'q:' + g.ws;
    return `<div class="grp" data-testid="group-${g.ws}"><h3 class="grp-head">${esc(g.ws)}<span class="count">${g.rows.length}</span></h3>
      <ul>${shown.map(line).join('')}
      ${hidden.length ? toggle(key, plural(hidden.length, 'hiljainen', 'hiljaista'), '', ' quietfold') : ''}
      ${hidden.length && S.open[key] ? hidden.map(line).join('') : ''}</ul></div>`;
  };
  const sleeper = (g) => {
    const key = 'd:' + g.ws;
    return `${toggle(key, g.ws, g.rows.length, ' dormant')}${S.open[key] ? g.rows.map(line).join('') : ''}`;
  };
  return `<section class="now" data-testid="rail-running" aria-label="Käynnissä"><h2 class="sec-head">Käynnissä${total ? `<span class="count">${total}</span>` : ''}</h2>
    ${total ? live.map(part).join('') : '<p class="empty">Mikään ei ole käynnissä.</p>'}
    ${dormant.length ? `<p class="rule" data-testid="rule-quiet"><span>Hiljaiset · yli tunnin</span></p><ul>${dormant.map(sleeper).join('')}</ul>` : ''}</section>`;
}
// The top bar's state chip uses the same ball, so the conversation and its row agree.
function topState(c) {
  return c ? `<span class="ballstate" data-testid="top-ball">${ball(c)}<span class="lbl">${BALL_LABEL[BALL[c.kind]]}</span></span>` : '';
}

// Lab only: the legend Jari can open to check whether the ball alone is readable.
const legend = document.getElementById('legend');
const pop = document.createElement('div');
pop.className = 'legend-pop'; pop.hidden = true; pop.dataset.testid = 'legend';
pop.innerHTML = Object.entries(BALL_LABEL).map(([k, l]) => `<p><span class="ball ${k}"></span>${l}${k === 'work' ? ' · sykkii' : k === 'you' ? ' · kysymys tai lukematon vastaus' : k === 'done' ? ' · odottaa viestiä' : ' · ajo epäonnistui tai Pi kaatui'}</p>`).join('');
document.body.append(pop);
legend.addEventListener('click', () => { pop.hidden = !pop.hidden; legend.setAttribute('aria-expanded', String(!pop.hidden)); });

F.hooks = {
  row: (c) => line(c),
  running: (list) => grouped(list),
  topbar: (c) => topState(c),
  click: (t, a) => {
    if (a === 'fold') { const k = t.dataset.key; S.open[k] = !S.open[k]; F.repaint(`[data-key="${k}"]`); }
  },
};
const variants = F.setup(NAMES);
