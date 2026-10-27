// Pysähtyneen agentin herätys (proto-wake-stopped-agent, kierros 1). Synteettinen ilta ja aamu:
// pääagentti käynnisti klo 19.47 kuusi spinoffia, ensimmäisen valmistuttua klo 20.10 vuoro
// päättyi virittämättä uutta odotusta, ja daemon pysäytti tyhjän Pi:n klo 20.20. Yön aikana
// neljä workeria päättyi ja yksi on yhä käynnissä. Aamulla klo 7.21 ihminen avaa keskustelun.
// Historia, kiinnikuromisen sisältö ja herätetty vuoro ovat samat kaikissa suunnissa; suunta
// päättää vain, mikä herättää. Kaikki nimet, tunnukset ja ajat ovat keksittyjä.
(() => {
  // ---------- Content ----------
  const RUN = {
    filters: { id: 's1', rid: '01m5q2a7c4tx8e1nvd9k3hrbw6', title: 'Hakusivun suodattimet', st: 'merged', at: '20.10' },
    contrast: { id: 's2', rid: '01m5q2b1f8kw3z6ycr0m5ehqa4', title: 'Kontrastikorjaukset', st: 'merged', at: '20.12' },
    alt: { id: 's3', rid: '01m5q2b9n2gv7d4xse8t1pkcz0', title: 'Kuvien alt-tekstit', st: 'merged', at: '20.13' },
    paging: { id: 's4', rid: '01m5q2c3r6hy1q8wma5f7zjtd2', title: 'Sivutuksen testit', st: 'failed', at: '20.31' },
    export: { id: 's5', rid: '01m5q2d0x4mb9s2kcf6v8ynre7', title: 'Lainaushistorian CSV-vienti', st: 'not_merged', at: '20.41', branch: 'wt/d0x-lainaushistoria-csv' },
    index: { id: 's6', rid: '01m5q2d8e7pz5w3jtn1b4xgqa9', title: 'Hakuindeksin uudelleenrakennus', st: 'working', at: '' },
  };
  const ST_TEXT = { merged: 'valmis ja yhdistetty', not_merged: 'valmis, ei yhdistetty', failed: 'epäonnistui', working: 'yhä käynnissä' };
  const SETTLED = ['contrast', 'alt', 'paging', 'export'];
  const launch = Object.values(RUN).map(r => `taskfleet run create --kind spinoff --title "${r.title}" --brief-file briefs/${r.id}.md`).join('\n');
  const launchOut = Object.values(RUN).map(r => `{"ok":true,"result":{"run_id":"${r.rid}","state":"working"}}`).join('\n');

  const ws = UI.ws[0];
  Object.assign(ws, { id: 'kirjasto', path: '~/src/kirjasto' });
  ws.convs.splice(0, ws.convs.length,
    { id: 'c1', title: 'Syksyn kierros: hakusivu' },
    { id: 'c2', title: 'Saavutettavuusraportin pohja', st: 'done' },
    { id: 'c3', title: 'Lainaussääntöjen tarkistus', st: 'done' });
  UI.titles = ['Syksyn kierros: hakusivu']; UI.titleIx = 0; UI.working = false;

  CONVO.splice(0, CONVO.length,
    { kind: 'marker', t: 'settings', time: '19.45', model: MODEL_ID, thinking: 'medium' },
    { kind: 'user', time: '19.45', md: 'Käynnistä nämä kuusi spinoffeina ja odota niitä: hakusivun suodattimet, kontrastikorjaukset, kuvien alt-tekstit, sivutuksen testit, lainaushistorian CSV-vienti ja hakuindeksin uudelleenrakennus. Kerro, kun ne ovat valmiita.' },
    { kind: 'turn', time: '19.47', blocks: [
      { t: 'think', md: '**Writing six briefs and launching the spinoffs**' },
      { t: 'tool', name: 'bash', target: 'taskfleet run create … (6 ajoa)', args: { command: launch }, result: launchOut },
      { t: 'tool', name: 'process', target: 'start odota-workereita', args: { action: 'start', name: 'odota-workereita', command: `taskfleet run wait ${Object.values(RUN).map(r => r.rid).join(' ')} --any --output json`, notify: 'exit' }, result: 'proc_21aa käynnissä; herättää, kun päättyy' },
      { t: 'reply', md: 'Kuusi workeria on käynnissä. Odotan niitä ja kerron, kun ne valmistuvat.' },
    ] },
    { kind: 'turn', time: '20.10', blocks: [
      { t: 'tool', name: 'bash', target: `taskfleet run show ${RUN.filters.rid}`, args: { command: `taskfleet run show ${RUN.filters.rid} --output json` }, result: '{"ok":true,"result":{"state":"merged","merged_at":"2026-10-26T20:10:22+02:00"}}' },
      { t: 'reply', md: '**Hakusivun suodattimet** on valmis ja yhdistetty. Viisi muuta on vielä kesken.' },
    ] },
  );

  // ---------- State ----------
  // phase: stopped (Pi not running) → starting → warm (running, no turn) → awake (woken turn played).
  const W = { dir: 'type', phase: 'stopped', armed: false, indexDone: false, open: false, held: false, left: 0, timer: 0, cause: '', gen: 0, waiters: [], total: 6 };
  const I = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON_REST = I('<path d="M19.5 14.2A7.8 7.8 0 1 1 9.8 4.5a6.2 6.2 0 0 0 9.7 9.7z"/>');
  const ICON_MERGE = I('<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 8v8"/><path d="M6 8c0 3 4 4 10 4"/>');
  const ICON_WARN = I('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4M12 17h.01"/>');
  const ICON_FAIL = I('<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6M15 9l-6 6"/>');
  const ICON_WAKE = I('<path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M18 12h3M16.3 7.7l2.1-2.1"/><path d="M7 17a5 5 0 0 1 10 0"/><path d="M3 20h18"/>');
  const resting = () => W.phase === 'stopped' || W.phase === 'starting';
  const settled = () => SETTLED.concat(W.indexDone ? ['index'] : []);

  // ---------- Sidebar and top bar: the resting conversation says so ----------
  STATES.resting = ['Lepää', `<span class="wk-st">${ICON_REST}</span>`];
  STATES.starting = ['Käynnistyy', '<span class="st-dot working"></span>'];
  const news = () => `${settled().length} päättynyttä työtä`;
  APP.row = (c) => c.id !== 'c1' || !resting() ? convRow(c)
    : `<a href="#" class="conv-row" data-conv="c1"${UI.sel === 'c1' ? ' aria-current="page"' : ''}><span class="conv-title">${esc(c.title)}</span><span class="wk-news" role="img" aria-label="Lepää, ${news()}" title="Lepää · ${news()}">${settled().length}</span><span class="st" aria-hidden="true">${STATES.resting[1]}</span></a>`;
  const baseChip = stateChip;
  stateChip = (c) => {
    if (c.id !== 'c1' || !resting()) return baseChip(c);
    const [label, mark] = STATES[W.phase === 'starting' ? 'starting' : 'resting'];
    return `<span class="chip wk-chip" role="status" title="${W.phase === 'starting' ? 'Pi käynnistyy' : 'Pi ei ole käynnissä. Historia on tallessa.'}">${mark}<span class="chip-label">${label}</span></span>`;
  };

  // ---------- The catch-up: what settled while Pi was stopped ----------
  function runMark(r) {
    if (r.st === 'working') return '<span class="pr-dot run" aria-hidden="true"></span>';
    return `<span class="wk-mk ${r.st}" aria-hidden="true">${r.st === 'merged' ? ICON_MERGE : r.st === 'failed' ? ICON_FAIL : ICON_WARN}</span>`;
  }
  function armSwitch() {
    return `<button type="button" class="wk-arm" role="switch" aria-checked="${W.armed}" data-wk="arm" title="Agentti herää kerran, kun tämä työ päättyy, vaikka et olisi paikalla."><span class="wk-sw" aria-hidden="true"></span><span>Herätä, kun valmistuu</span></button>`;
  }
  function runRow(key) {
    const r = RUN[key];
    const meta = r.st === 'working' ? (W.armed ? 'agentti herää, kun tämä päättyy' : 'kukaan ei odota sitä') : `${ST_TEXT[r.st]} · ${r.at}`;
    return `<li class="wk-run ${r.st}">${runMark(r)}<span class="wk-name">${esc(r.title)}</span><span class="wk-meta">${meta}</span>${r.st === 'working' && resting() ? armSwitch() : ''}</li>`;
  }
  const catchUp = () => `<p class="wk-sub">Päättyi sillä välin</p><ul class="wk-list">${settled().map(runRow).join('')}</ul>${W.indexDone ? '' : `<p class="wk-sub">Yhä käynnissä</p><ul class="wk-list">${runRow('index')}</ul>`}`;
  const why = 'Pi pysähtyi klo 20.20, kun se oli ollut 10 minuuttia jouten. Mikään työ ei katkennut, ja historia on tallessa.';

  // ---------- 1 Kirjoittaessa: the composer carries the state; typing starts Pi ----------
  const row = document.createElement('div'); row.className = 'wk-row'; row.hidden = true;
  function paintRow() {
    const cw = document.querySelector('.composer .cwrap');
    if (cw && row.parentNode !== cw) cw.prepend(row);
    row.hidden = W.dir !== 'type' || W.phase === 'awake' || selConv().id !== 'c1';
    if (row.hidden) return;
    const head = W.phase === 'stopped'
      ? `<span class="wk-ic">${ICON_REST}</span><span class="wk-line"><strong>Agentti lepää</strong> klo 20.20 alkaen · ${news()} sillä välin. Kirjoita, niin se herää.</span>`
      : W.phase === 'starting'
        ? `<span class="wk-ic"><span class="st-dot working"></span></span><span class="wk-line"><strong>Agentti käynnistyy</strong>, jotta vastaus alkaa heti, kun lähetät.</span>`
        : `<span class="wk-ic ok">${ICON_CHECK}</span><span class="wk-line"><strong>Agentti on hereillä.</strong> Se saa päättyneet työt viestisi mukana.</span>`;
    const html = `<div class="wk-rowhead">${head}<button type="button" class="quiet-btn wk-more" data-wk="more" aria-expanded="${W.open}" aria-controls="wk-rowbody">${CHEV}${W.open ? 'Piilota' : 'Mitä tapahtui'}</button></div><div class="wk-rowbody" id="wk-rowbody"${W.open ? '' : ' hidden'}><p class="wk-why">${why}</p>${catchUp()}</div>`;
    if (row.dataset.html !== html) { row.innerHTML = html; row.dataset.html = html; }
  }

  // ---------- 2 and 3: the resting card at the end of the thread ----------
  function cardHtml() {
    let acts;
    if (W.dir === 'open' && !W.held && W.phase === 'stopped') {
      acts = `<div class="wk-count" role="status"><span class="wk-bar" style="--wk-dur:${W.total}s" aria-hidden="true"></span><span class="wk-count-text">Agentti herää käsittelemään päättyneet työt <span class="wk-left">${W.left} s</span></span><button type="button" class="secondary" data-wk="hold">Älä herätä</button></div>`;
    } else if (W.phase === 'starting') {
      acts = `<div class="wk-acts"><button type="button" class="primary" aria-disabled="true" aria-busy="true"><span class="st-dot working on-accent"></span>Käynnistyy…</button></div>`;
    } else {
      acts = `<div class="wk-acts"><button type="button" class="primary" data-wk="wake">${ICON_WAKE}${W.dir === 'open' ? 'Herätä nyt' : 'Herätä ja jatka'}</button><span class="wk-or">${W.dir === 'open' ? 'Ei herännyt, koska perit. Herää myös, kun kirjoitat.' : 'tai kirjoita viesti, niin se herää siihen'}</span></div>`;
    }
    return `<section class="wk-card ah-in" aria-labelledby="wk-title"><header class="wk-head"><span class="wk-ic">${ICON_REST}</span><h3 id="wk-title">Agentti lepää</h3><span class="wk-since">klo 20.20 alkaen</span></header><p class="wk-why">${why}</p>${catchUp()}${acts}</section>`;
  }
  function paintCard() {
    const card = stage.querySelector('.wk-card'); if (!card) return;
    const html = cardHtml();
    if (card.dataset.html === html) return;
    const t = document.createElement('template'); t.innerHTML = html;
    const fresh = t.content.firstElementChild; fresh.classList.remove('ah-in'); fresh.dataset.html = html;
    const focus = document.activeElement && card.contains(document.activeElement) ? document.activeElement.dataset.wk : null;
    card.replaceWith(fresh);
    if (focus) fresh.querySelector(`[data-wk="${focus}"]`)?.focus();
  }

  // ---------- The composer's words while Pi rests ----------
  function paintComposer() {
    const ta = document.querySelector('.composer textarea'); if (!ta) return;
    if (selConv().id === 'c1' && resting()) ta.placeholder = W.dir === 'type' ? 'Kirjoita Pi:lle…' : 'Kirjoita Pi:lle, niin agentti herää…';
  }
  APP.painted.push(paintRow, paintCard, paintComposer);

  // ---------- Background strip: Taskfleet's own runs for this conversation ----------
  function stripFacts() {
    const B = STRIP.B;
    B.procs = []; B.open = null; B.win = null; B.ended = {}; B.conv = 'c1';
    B.spins = Object.values(RUN).map(r => ({ id: r.id, rid: r.rid, title: r.title, st: r.st === 'not_merged' ? 'failed' : r.st, branch: r.branch, start: 0, end: 0 }));
    // The working run started at 19.47 last night; the strip counts from its own 14.37 clock.
    B.spins.find(s => s.id === RUN.index.id).start = (14 * 3600 + 37 * 60) - (11 * 3600 + 34 * 60);
  }

  // ---------- The woken turn ----------
  const WAKE_TIME = '07.21';
  const replyText = () => `Huomenta. Yöllä päättyi ${W.indexDone ? 'viisi' : 'neljä'} workeria:

- **Kontrastikorjaukset** ja **Kuvien alt-tekstit** ovat valmiita ja yhdistetty.
- **Sivutuksen testit** epäonnistui: \`sivutus.spec.ts\` aikakatkaistiin rivillä 88. Testi odottaa sivunvaihtoa, jota suodattimet eivät enää tee; korjaan sen, jos haluat.
- **Lainaushistorian CSV-vienti** valmistui, mutta yhdistäminen törmäsi \`src/vienti/csv.ts\`:n muutokseen. Haara \`${RUN.export.branch}\` on tallessa.
${W.indexDone ? '- **Hakuindeksin uudelleenrakennus** on valmis ja yhdistetty. Kierroksen kuusi työtä ovat nyt kaikki päättyneet.' : `
**Hakuindeksin uudelleenrakennus** on yhä käynnissä. Viritin sille odotuksen, joten jatkan itse, kun se valmistuu.`}`;
  const showPaging = { name: 'bash', target: `taskfleet run show ${RUN.paging.rid}`, args: { command: `taskfleet run show ${RUN.paging.rid} --output json` }, lines: ['{"ok":true,"result":{"state":"failed","reason":"tests/sivutus.spec.ts:88: Timeout 30000ms exceeded waiting for page 2"}}'] };
  const showExport = { name: 'bash', target: `taskfleet run show ${RUN.export.rid}`, args: { command: `taskfleet run show ${RUN.export.rid} --output json` }, lines: [`{"ok":true,"result":{"state":"done","merge":"refused","reason":"conflict in src/vienti/csv.ts","branch":"${RUN.export.branch}"}}`] };
  const waitIndex = { name: 'process', target: 'start odota-indeksi', args: { action: 'start', name: 'odota-indeksi', command: `taskfleet run wait ${RUN.index.rid} --output json`, notify: 'exit' }, lines: ['proc_4b21 käynnissä; herättää, kun päättyy'] };
  function wakeScript() {
    const ev = []; let t = 0; const at = (d, fn) => { t += d; ev.push([t, fn]); };
    const stream = (text, id, gap) => { const words = text.split(/(?<=\s)/); let acc = ''; for (const w of words) { acc += w; const s = acc; at(gap, (S) => S.set(id, { text: s })); } };
    const tool = (id, spec, run = 700) => {
      at(350, (S) => S.add({ id, t: 'tool', ...spec, state: 'forming', out: [], expanded: false }));
      at(run, (S) => S.set(id, { state: 'running' }));
      spec.lines.forEach(l => at(500, (S) => S.push(id, l)));
      at(250, (S) => S.set(id, { state: 'done' }));
    };
    at(0, (S) => S.start());
    at(300, (S) => S.add({ id: 'k1', t: 'think', text: '', live: true }));
    stream('**Reading what settled while Pi was stopped**', 'k1', 90);
    at(250, (S) => S.set('k1', { live: false }));
    tool('t1', showPaging); tool('t2', showExport);
    if (!W.indexDone) tool('t3', waitIndex, 400);
    at(500, (S) => S.add({ id: 'r', t: 'reply', text: '', live: true }));
    stream(replyText(), 'r', 28);
    at(400, (S) => S.set('r', { live: false }));
    at(700, (S) => S.settle());
    return ev;
  }
  const wakeHead = () => `<span class="ok">${ICON_CHECK}Vastaus valmis</span><span class="model">${MODEL}</span>${copyBtn('Kopioi vastaus', replyText())}<time class="meta">${WAKE_TIME}</time>`;
  const wakeBlock = (b, s) => b.t === 'reply' && !b.live ? replyBubble(b, s, wakeHead()) : block(b, s);
  const R = () => ({ ...threadR(), block: wakeBlock });

  // ---------- Waking ----------
  const CAUSE = {
    message: 'Viestisi herätti agentin',
    button: 'Herätit agentin',
    open: 'Agentti heräsi, kun avasit keskustelun',
    armed: 'Hakuindeksin valmistuminen herätti agentin, kuten pyysit',
  };
  function marker(cause) {
    const items = settled().map(k => `<li>${esc(RUN[k].title)}: ${ST_TEXT[RUN[k].st]}</li>`).join('');
    const still = W.indexDone ? '' : `<li>Yhä käynnissä: ${esc(RUN.index.title)}</li>`;
    return `<aside class="wk-marker ah-in" role="note"><span>${CAUSE[cause]} · ${WAKE_TIME}</span><ul>${items}${still}</ul></aside>`;
  }
  // Every trigger shares one start: a send while Pi is starting waits for that start.
  function start(then) {
    if (W.phase === 'warm') return then();
    W.waiters.push(then);
    if (W.phase === 'starting') return;
    W.phase = 'starting'; paint();
    const g = W.gen;
    setTimeout(() => { if (g !== W.gen) return; W.phase = 'warm'; paint(); const ws = W.waiters.splice(0); ws.forEach(f => f()); }, document.getElementById('slow').checked ? 3000 : 1400);
  }
  function wake(cause, text) {
    if (W.phase === 'awake' || W.cause) return;
    W.cause = cause; clearInterval(W.timer);
    const host = stage.querySelector('.vwrap'); if (!host) return;
    if (text) host.insertAdjacentHTML('beforeend', userBubble({ md: text, time: WAKE_TIME }, 0));
    following = true; stage.scrollTop = stage.scrollHeight;
    start(() => {
      W.phase = 'awake';
      stage.querySelector('.wk-card')?.remove();
      host.insertAdjacentHTML('beforeend', marker(cause));
      if (!W.indexDone) STRIP.B.procs = [{ id: 'proc_4b21', name: 'odota-indeksi', cmd: `taskfleet run wait ${RUN.index.rid} --output json`, start: 14 * 3600 + 37 * 60, status: 'running', wake: true, waits: RUN.index.id, out: [] }];
      LIVE.reply = replyText();
      script = wakeScript;
      currentR = R();
      playLive(host, currentR);
      paint();
    });
  }
  // The library composer's send: a message to a resting agent wakes it with that message.
  const libSend = send;
  send = function (kind) {
    const text = C.text.trim();
    if (kind === 'now' && text && selConv().id === 'c1' && W.phase !== 'awake') {
      C.text = ''; const ta = comp.querySelector('textarea'); ta.value = ''; fit(ta); updateComposer();
      return wake('message', text);
    }
    if (kind === 'now' && W.phase === 'awake' && selConv().id === 'c1') { toast('Tämä vedos näyttää herätyksen. Keskustelu ei jatku tästä pidemmälle.'); return; }
    return libSend(kind);
  };
  // Kirjoittaessa: the first character starts Pi, without a turn.
  document.addEventListener('input', (e) => {
    if (W.dir !== 'type' || W.phase !== 'stopped' || !e.target.matches('.composer textarea') || !e.target.value.trim()) return;
    start(() => {});
  });
  // Avatessa: a short countdown the person can stop; then the conversation wakes itself.
  function countdown() {
    clearInterval(W.timer);
    const g = W.gen;
    W.timer = setInterval(() => {
      if (g !== W.gen || W.held || W.phase !== 'stopped') return clearInterval(W.timer);
      W.left--; const el = stage.querySelector('.wk-left');
      if (W.left <= 0) { clearInterval(W.timer); return wake('open'); }
      if (el) el.textContent = `${W.left} s`;
    }, 1000);
  }

  // ---------- Actions ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-wk]'); if (!t || t.getAttribute('aria-disabled') === 'true') return;
    e.preventDefault(); e.stopPropagation();
    const a = t.dataset.wk;
    if (a === 'more') { W.open = !W.open; paint(); return row.querySelector('[data-wk="more"]')?.focus(); }
    if (a === 'arm') {
      W.armed = !W.armed; paint();
      toast(W.armed ? 'Agentti herää kerran, kun hakuindeksin uudelleenrakennus päättyy.' : 'Herätys peruttu. Agentti lepää, kunnes herätät sen.');
      return;
    }
    if (a === 'wake') return wake('button');
    if (a === 'hold') { W.held = true; clearInterval(W.timer); paint(); return stage.querySelector('[data-wk="wake"]')?.focus(); }
    if (a === 'settle') return settleIndex();
  }, true);
  // Story: the still-running worker settles. Armed → it wakes the agent; otherwise it joins the catch-up.
  function settleIndex() {
    if (W.indexDone) return;
    W.indexDone = true; RUN.index.st = 'merged'; RUN.index.at = '07.24';
    const s = STRIP.B.spins.find(x => x.id === RUN.index.id); s.st = 'merged';
    if (W.phase === 'awake') { STRIP.B.procs.forEach(p => { p.status = 'exited'; p.code = 0; }); paint(); return toast('Agentin oma odotus päättyi. Agentti jatkaa itse (prosessin herätys, ei uusi laukaisin).'); }
    if (W.armed) return wake('armed');
    paint(); toast('Hakuindeksi valmistui. Agentti lepää edelleen; työ lisättiin päättyneisiin.');
  }
  document.querySelector('.page-bar .hint').insertAdjacentHTML('beforebegin', '<button type="button" class="page-btn" data-wk="settle" title="Simuloi: yhä käynnissä oleva worker päättyy">Hakuindeksi valmistuu</button>');

  // ---------- Directions ----------
  function view(dir) {
    W.gen++; clearInterval(W.timer);
    Object.assign(W, { dir, phase: 'stopped', armed: false, indexDone: false, open: false, held: false, cause: '', waiters: [], left: W.total });
    Object.assign(RUN.index, { st: 'working', at: '' });
    stripFacts();
    UI.sel = 'c1'; UI.pop = false; UI.working = false; run++;
    document.querySelectorAll('.float-bar').forEach(el => el.remove());
    C.text = ''; const ta = comp.querySelector('textarea'); if (ta) { ta.value = ''; fit(ta); }
    currentR = R();
    let html = lanka('wk-dir-' + dir, { meta: 'top', fold: 'head', runs: 'separate' });
    if (dir !== 'type') html = html.replace(/<\/div>$/, `${cardHtml()}</div>`);
    paint();
    if (dir === 'open') countdown();
    requestAnimationFrame(() => { following = true; stage.scrollTop = stage.scrollHeight; paintCard(); });
    return html;
  }
  window.wkType = () => view('type');
  window.wkButton = () => view('button');
  window.wkOpen = () => view('open');
  window.__wk = { W, RUN };
})();
