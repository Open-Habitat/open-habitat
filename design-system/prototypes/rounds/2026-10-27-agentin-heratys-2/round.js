// Pysähtyneen agentin herätys (proto-wake-stopped-agent, kierros 2). Sama ilta ja aamu kuin
// kierroksella 1: pääagentti käynnisti klo 19.47 kuusi spinoffia, ensimmäisen valmistuttua klo
// 20.10 vuoro päättyi virittämättä uutta odotusta, ja daemon pysäytti tyhjän Pi:n klo 20.20.
// Aamulla klo 7.21 ihminen avaa keskustelun. Jarin valinnat kierrokselta 1: kirjoittaminen
// herättää, ja selostus (milloin ja miksi pysähtyi, mitä valmistui) näkyy ennen herätystä
// hostin tiedoista eikä herätetyn agentin vastauksesta. Suunta päättää vain, missä selostus
// on. Kaikki nimet, tunnukset ja ajat ovat keksittyjä.
(() => {
  // ---------- Content: Taskfleet's own facts for this conversation's runs ----------
  const RUN = {
    filters: { id: 's1', rid: '01m5q2a7c4tx8e1nvd9k3hrbw6', title: 'Hakusivun suodattimet', st: 'merged', at: '20.10' },
    contrast: { id: 's2', rid: '01m5q2b1f8kw3z6ycr0m5ehqa4', title: 'Kontrastikorjaukset', st: 'merged', at: '20.12', sum: 'Korjasi 14 kontrastivirhettä hakusivulla ja lainausnäkymässä. axe-tarkistus on puhdas.' },
    alt: { id: 's3', rid: '01m5q2b9n2gv7d4xse8t1pkcz0', title: 'Kuvien alt-tekstit', st: 'merged', at: '20.13', sum: 'Lisäsi alt-tekstin 38 kuvalle; koristekuvat merkittiin tyhjällä alt-tekstillä.' },
    paging: { id: 's4', rid: '01m5q2c3r6hy1q8wma5f7zjtd2', title: 'Sivutuksen testit', st: 'failed', at: '20.31', sum: '`tests/sivutus.spec.ts:88` aikakatkaistiin: testi odottaa sivunvaihtoa, jota uudet hakusuodattimet eivät enää tee.' },
    export: { id: 's5', rid: '01m5q2d0x4mb9s2kcf6v8ynre7', title: 'Lainaushistorian CSV-vienti', st: 'unmerged', at: '20.41', branch: 'wt/d0x-lainaushistoria-csv', sum: 'Vienti on valmis, mutta yhdistäminen törmäsi `src/vienti/csv.ts`:n muutokseen.' },
    index: { id: 's6', rid: '01m5q2d8e7pz5w3jtn1b4xgqa9', title: 'Hakuindeksin uudelleenrakennus', st: 'working', at: '' },
  };
  const INDEX_DONE = { st: 'merged', at: '07.24', sum: 'Rakensi hakuindeksin uudelleen 12 400 teokselle; haun mediaani laski 180 ms:sta 95 ms:iin.' };
  const ST_TEXT = { merged: 'yhdistetty', unmerged: 'ei yhdistetty · haara tallessa', failed: 'epäonnistui', working: 'käynnissä 19.47 alkaen' };
  const ST_EVENT = { merged: 'valmistui ja yhdistettiin', unmerged: 'valmistui, mutta sitä ei voitu yhdistää', failed: 'epäonnistui' };
  const SETTLED = ['contrast', 'alt', 'paging', 'export'];
  const launch = Object.values(RUN).map(r => `taskfleet run create --kind spinoff --title "${r.title}" --brief-file briefs/${r.id}.md`).join('\n');
  const launchOut = Object.values(RUN).map(r => `{"ok":true,"result":{"run_id":"${r.rid}","state":"working"}}`).join('\n');

  // Why Pi stopped: the daemon's own record of the stop, one of four causes (page bar).
  const STOP = {
    idle: { label: 'Jouten', why: 'Pi pysähtyi klo 20.20, kun se oli ollut 10 minuuttia jouten. Mikään työ ei katkennut.', short: '10 min jouten' },
    upgrade: { label: 'Päivitys', why: 'Pi pysähtyi klo 20.20, kun Habitat päivitettiin. Workerit jatkoivat, koska ne eivät ole Pi:n lapsia.', short: 'Habitat päivitettiin' },
    crash: { label: 'Kaatui', why: 'Pi pysähtyi odottamatta klo 20.20 (signaali 9). Vuoro oli jo päättynyt, joten mitään ei jäänyt kesken.', short: 'kaatui' },
    stop: { label: 'Pysäytit', why: 'Pysäytit agentin klo 20.20. Workerit jatkoivat omaa työtään.', short: 'pysäytit sen' },
  };

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
  // phase: stopped (Pi not running) → starting → warm (running, no turn yet) → awake (the person's message woke it).
  const W = { dir: 'card', phase: 'stopped', cause: 'idle', indexDone: false, pick: '', gen: 0, waiters: [], woke: '' };
  const I = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON_REST = I('<path d="M19.5 14.2A7.8 7.8 0 1 1 9.8 4.5a6.2 6.2 0 0 0 9.7 9.7z"/>');
  const ICON_MERGE = I('<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 8v8"/><path d="M6 8c0 3 4 4 10 4"/>');
  const ICON_WARN = I('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4M12 17h.01"/>');
  const ICON_FAIL = I('<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6M15 9l-6 6"/>');
  const ICON_CLIP = I('<path d="M20 11.5 12.2 19.3a5 5 0 0 1-7-7l8-8a3.4 3.4 0 0 1 4.8 4.8l-8 8a1.7 1.7 0 0 1-2.4-2.4l7.3-7.3"/>');
  const asleep = () => W.phase === 'stopped' || W.phase === 'starting';
  const settled = () => SETTLED.concat(W.indexDone ? ['index'] : []);
  const nowTime = () => W.indexDone ? '07.24' : '07.21';
  const inl = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
  const stop = () => STOP[W.cause];
  const restTitle = () => W.cause === 'stop' ? 'Pysäytit agentin' : 'Agentti lepää';

  // ---------- Sidebar and top bar: the resting conversation says so ----------
  STATES.resting = ['Lepää', `<span class="wk-st">${ICON_REST}</span>`];
  STATES.starting = ['Käynnistyy', '<span class="st-dot working"></span>'];
  const news = () => `${settled().length} päättynyttä työtä`;
  APP.row = (c) => c.id !== 'c1' || !asleep() ? convRow(c)
    : `<a href="#" class="conv-row" data-conv="c1"${UI.sel === 'c1' ? ' aria-current="page"' : ''}><span class="conv-title">${esc(c.title)}</span><span class="wk-news" role="img" aria-label="Lepää, ${news()}" title="Lepää · ${news()}">${settled().length}</span><span class="st" aria-hidden="true">${STATES.resting[1]}</span></a>`;
  const baseChip = stateChip;
  stateChip = (c) => {
    if (c.id !== 'c1' || !asleep()) return baseChip(c);
    const [label, mark] = STATES[W.phase === 'starting' ? 'starting' : 'resting'];
    return `<span class="chip wk-chip" role="status" title="${W.phase === 'starting' ? 'Pi käynnistyy' : 'Pi ei ole käynnissä. Historia on tallessa.'}">${mark}<span class="chip-label">${label}</span></span>`;
  };

  // ---------- Shared pieces ----------
  function runMark(r) {
    if (r.st === 'working') return '<span class="pr-dot run" aria-hidden="true"></span>';
    return `<span class="wk-mk ${r.st}" aria-hidden="true">${r.st === 'merged' ? ICON_MERGE : r.st === 'failed' ? ICON_FAIL : ICON_WARN}</span>`;
  }
  const runMeta = (r) => r.st === 'working' ? `${ST_TEXT.working} · ${W.phase === 'awake' ? 'agentti odottaa sitä' : 'kukaan ei odota sitä'}` : `${ST_TEXT[r.st]} · ${r.at}`;
  const runSum = (r) => (r.sum ? `<p class="wk-sum">${inl(r.sum)}</p>` : '') + (r.branch ? `<p class="wk-branch"><code>${esc(r.branch)}</code></p>` : '');
  function runItem(key) {
    const r = RUN[key];
    return `<li class="wk-run ${r.st}">${runMark(r)}<div class="wk-body"><div class="wk-line1"><span class="wk-name">${esc(r.title)}</span><span class="wk-meta">${runMeta(r)}</span></div>${runSum(r)}</div></li>`;
  }
  // The wake line: where the direction shows that typing wakes the agent.
  function wakeLine() {
    if (W.phase === 'starting') return `<span class="wk-ic"><span class="st-dot working"></span></span><span><strong>Agentti käynnistyy</strong>, jotta vastaus alkaa heti, kun lähetät.</span>`;
    if (W.phase === 'warm') return `<span class="wk-ic ok">${ICON_CHECK}</span><span><strong>Agentti on hereillä.</strong> Lähetä, niin se vastaa.</span>`;
    return `<span class="wk-ic">${ICON_REST}</span><span>Kirjoita, niin agentti herää. Se saa tämän saman selostuksen viestisi mukana.</span>`;
  }

  // ---------- 1 Kortti: the report closes the thread and stays as its record ----------
  function cardHtml() {
    const done = W.phase === 'awake';
    const head = done ? `Agentti lepäsi 20.20–${W.woke}` : restTitle();
    const foot = done
      ? `<p class="wk-foot done">${ICON_CHECK}<span>Viestisi herätti agentin klo ${W.woke}. Agentti sai tämän selostuksen.</span></p>`
      : `<p class="wk-foot" role="status">${wakeLine()}</p>`;
    const still = W.indexDone ? '' : `<p class="wk-sub">Yhä käynnissä</p><ul class="wk-list">${runItem('index')}</ul>`;
    return `<section class="wk-card${done ? ' done' : ''}" aria-labelledby="wk-title"><header class="wk-head"><span class="wk-ic">${ICON_REST}</span><h3 id="wk-title">${head}</h3><span class="wk-src">Habitat</span></header><p class="wk-why">${stop().why}</p><p class="wk-sub">Päättyi sillä välin</p><ul class="wk-list">${settled().map(runItem).join('')}</ul>${still}${foot}</section>`;
  }

  // ---------- 2 Aikajana: the same facts as events at their own times ----------
  function timeHtml() {
    const ev = [];
    const at = (t, cls, mark, html) => ev.push({ t, html: `<li class="wk-ev ${cls}"><time>${t}</time><span class="wk-evmk">${mark}</span><div class="wk-body">${html}</div></li>` });
    for (const k of settled()) {
      const r = RUN[k];
      at(r.at, r.st, runMark(r), `<div class="wk-line1"><span class="wk-name">${esc(r.title)}</span> <span class="wk-verb">${ST_EVENT[r.st]}</span></div>${runSum(r)}`);
    }
    at('20.20', 'stop', ICON_REST, `<div class="wk-line1"><span class="wk-name">${W.cause === 'stop' ? 'Pysäytit agentin' : 'Pi pysähtyi'}</span> <span class="wk-verb">· ${stop().short}</span></div><p class="wk-sum">${stop().why}</p>`);
    // Evening first, then the morning after.
    const key = (t) => parseFloat(t) + (parseFloat(t) < 12 ? 24 : 0);
    ev.sort((a, b) => key(a.t) - key(b.t));
    if (!W.indexDone) ev.push({ html: `<li class="wk-ev working"><time></time><span class="wk-evmk">${runMark(RUN.index)}</span><div class="wk-body"><div class="wk-line1"><span class="wk-name">${esc(RUN.index.title)}</span> <span class="wk-verb">on yhä käynnissä</span></div><p class="wk-sum">19.47 alkaen · ${W.phase === 'awake' ? 'agentti odottaa sitä' : 'kukaan ei odota sitä'}</p></div></li>` });
    const now = W.phase === 'awake'
      ? `<li class="wk-ev now done"><time>${W.woke}</time><span class="wk-evmk ok">${ICON_CHECK}</span><div class="wk-body"><div class="wk-line1">Viestisi herätti agentin. Agentti sai nämä tapahtumat.</div></div></li>`
      : `<li class="wk-ev now"><time>${nowTime()}</time><span class="wk-evmk"></span><div class="wk-body"><div class="wk-line1 wk-wake" role="status">${wakeLine()}</div></div></li>`;
    return `<section class="wk-time" aria-label="Agentin viimeisen vuoron jälkeen"><p class="wk-time-head"><span>Agentin viimeisen vuoron jälkeen</span><span class="wk-src">Habitat</span></p><ol class="wk-evs">${ev.map(e => e.html).join('')}${now}</ol></section>`;
  }

  // ---------- 3 Viestin mukana: the report rides on the next message ----------
  const tray = document.createElement('div'); tray.className = 'wk-tray'; tray.hidden = true;
  function chip(key) {
    const r = RUN[key];
    return `<button type="button" class="wk-chipbtn ${r.st}" data-wk="pick" data-run="${key}" aria-pressed="${W.pick === key}">${runMark(r)}<span>${esc(r.title)}</span></button>`;
  }
  function trayHtml() {
    const r = RUN[W.pick];
    const detail = r ? `<div class="wk-detail"><div class="wk-line1"><span class="wk-name">${esc(r.title)}</span><span class="wk-meta">${runMeta(r)}</span></div>${runSum(r)}</div>` : '';
    const chips = settled().map(chip).join('') + (W.indexDone ? '' : chip('index'));
    return `<div class="wk-trayhead"><span class="wk-ic">${ICON_REST}</span><span class="wk-traytitle"><strong>${restTitle()}</strong> · ${stop().why}</span></div><p class="wk-trayfor">${ICON_CLIP}<span>Lähtee agentille viestisi mukana</span></p><div class="wk-chips">${chips}</div>${detail}<p class="wk-traywake" role="status">${wakeLine().replace('Se saa tämän saman selostuksen viestisi mukana.', '')}</p>`;
  }
  function paintTray() {
    const cw = document.querySelector('.composer .cwrap');
    if (cw && tray.parentNode !== cw) cw.prepend(tray);
    tray.hidden = W.dir !== 'attach' || W.phase === 'awake' || selConv().id !== 'c1';
    if (tray.hidden) return;
    swap(tray, trayHtml(), true);
  }
  function sentAttach() {
    const items = settled().map(k => `<li>${runMark(RUN[k])}<span>${esc(RUN[k].title)}</span></li>`).join('') + (W.indexDone ? '' : `<li>${runMark(RUN.index)}<span>${esc(RUN.index.title)}</span></li>`);
    return `<div class="wk-sent"><p>${ICON_CLIP}<span>Mukana Habitatin selostus: ${stop().short} klo 20.20, ${news()}</span></p><ul>${items}</ul></div>`;
  }

  // ---------- Painting ----------
  // Replace only when the markup changed, keeping focus on the same control.
  function swap(el, html, inner) {
    if (!el || el.dataset.html === html) return;
    const focus = document.activeElement && el.contains(document.activeElement) ? document.activeElement.dataset.run || document.activeElement.dataset.wk : null;
    let target = el;
    if (inner) el.innerHTML = html;
    else { const t = document.createElement('template'); t.innerHTML = html; target = t.content.firstElementChild; el.replaceWith(target); }
    target.dataset.html = html;
    if (focus) target.querySelector(`[data-run="${focus}"], [data-wk="${focus}"]`)?.focus();
  }
  function paintHost() {
    if (W.dir === 'card') swap(stage.querySelector('.wk-card'), cardHtml());
    if (W.dir === 'time') swap(stage.querySelector('.wk-time'), timeHtml());
  }
  function paintComposer() {
    const ta = document.querySelector('.composer textarea'); if (!ta) return;
    if (selConv().id === 'c1' && asleep()) ta.placeholder = 'Kirjoita, niin agentti herää…';
  }
  APP.painted.push(paintHost, paintTray, paintComposer);

  // ---------- Background strip: Taskfleet's own runs for this conversation ----------
  function stripFacts() {
    const B = STRIP.B;
    B.procs = []; B.open = null; B.win = null; B.ended = {}; B.conv = 'c1';
    B.spins = Object.values(RUN).map(r => ({ id: r.id, rid: r.rid, title: r.title, st: r.st === 'unmerged' ? 'failed' : r.st, branch: r.branch, start: 0, end: 0 }));
    // The working run started at 19.47 last night; the strip counts from its own 14.37 clock.
    B.spins.find(s => s.id === RUN.index.id).start = (14 * 3600 + 37 * 60) - (11 * 3600 + 34 * 60);
  }

  // ---------- The woken turn: it answers the message, the report is already on screen ----------
  const FIX = { id: 's7', rid: '01m5qhy2k8c1v6x0zt4n9sbd3e', title: 'Sivutuksen testin korjaus' };
  const REMERGE = { id: 's8', rid: '01m5qhy3p5f8w2m7gq1r6kca0h', title: 'CSV-viennin yhdistäminen' };
  const waitIds = () => [FIX.rid, REMERGE.rid].concat(W.indexDone ? [] : [RUN.index.rid]).join(' ');
  const replyText = () => `Käynnistin kaksi workeria:

- **${FIX.title}** päivittää \`sivutus.spec.ts\`:n odottamaan suodattimien uutta käytöstä.
- **${REMERGE.title}** rebasaa haaran \`${RUN.export.branch}\` ja ratkaisee \`csv.ts\`:n ristiriidan.

Odotan ${W.indexDone ? 'niitä' : 'niitä ja hakuindeksin uudelleenrakennusta'} ja kerron, kun ne ovat valmiita.`;
  const createFix = { name: 'bash', target: 'taskfleet run create … (2 ajoa)', args: { command: [FIX, REMERGE].map(r => `taskfleet run create --kind spinoff --title "${r.title}" --brief-file briefs/${r.id}.md`).join('\n') }, lines: [FIX, REMERGE].map(r => `{"ok":true,"result":{"run_id":"${r.rid}","state":"working"}}`) };
  const waitAll = () => ({ name: 'process', target: 'start odota-workereita', args: { action: 'start', name: 'odota-workereita', command: `taskfleet run wait ${waitIds()} --any --output json`, notify: 'exit' }, lines: ['proc_4b21 käynnissä; herättää, kun päättyy'] });
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
    stream('**Launching the paging fix and the CSV re-merge**', 'k1', 90);
    at(250, (S) => S.set('k1', { live: false }));
    tool('t1', createFix); tool('t2', waitAll(), 400);
    at(500, (S) => S.add({ id: 'r', t: 'reply', text: '', live: true }));
    stream(replyText(), 'r', 28);
    at(400, (S) => S.set('r', { live: false }));
    at(700, (S) => S.settle());
    return ev;
  }
  const wakeHead = () => `<span class="ok">${ICON_CHECK}Vastaus valmis</span><span class="model">${MODEL}</span>${copyBtn('Kopioi vastaus', replyText())}<time class="meta">${W.woke}</time>`;
  const wakeBlock = (b, s) => b.t === 'reply' && !b.live ? replyBubble(b, s, wakeHead()) : block(b, s);
  const R = () => ({ ...threadR(), block: wakeBlock });

  // ---------- Waking: typing starts Pi, the message starts the turn ----------
  // Every start is shared: a send while Pi is starting waits for that start.
  function start(then) {
    if (W.phase === 'warm') return then();
    W.waiters.push(then);
    if (W.phase === 'starting') return;
    W.phase = 'starting'; paint();
    const g = W.gen;
    setTimeout(() => { if (g !== W.gen) return; W.phase = 'warm'; paint(); const ws = W.waiters.splice(0); ws.forEach(f => f()); }, document.getElementById('slow').checked ? 3000 : 1400);
  }
  function wake(text) {
    if (W.phase === 'awake' || W.woke) return;
    W.woke = nowTime();
    const host = stage.querySelector('.vwrap'); if (!host) return;
    let bubble = userBubble({ md: text, time: W.woke }, 0);
    if (W.dir === 'attach') bubble = bubble.replace(/<\/article>$/, `${sentAttach()}</article>`);
    host.insertAdjacentHTML('beforeend', bubble);
    following = true; stage.scrollTop = stage.scrollHeight;
    start(() => {
      W.phase = 'awake';
      STRIP.B.spins.push(...[FIX, REMERGE].map(r => ({ id: r.id, rid: r.rid, title: r.title, st: 'working', start: 14 * 3600 + 37 * 60, end: 0 })));
      STRIP.B.procs = [{ id: 'proc_4b21', name: 'odota-workereita', cmd: `taskfleet run wait ${waitIds()} --any --output json`, start: 14 * 3600 + 37 * 60, status: 'running', wake: true, waits: FIX.id, out: [] }];
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
    if (kind === 'now' && text && selConv().id === 'c1' && !W.woke) {
      C.text = ''; const ta = comp.querySelector('textarea'); ta.value = ''; fit(ta); updateComposer();
      return wake(text);
    }
    if (kind === 'now' && W.woke && selConv().id === 'c1') { toast('Tämä vedos näyttää herätyksen. Keskustelu ei jatku tästä pidemmälle.'); return; }
    return libSend(kind);
  };
  // The first typed character starts Pi without a turn.
  document.addEventListener('input', (e) => {
    if (W.phase !== 'stopped' || !e.target.matches('.composer textarea') || !e.target.value.trim()) return;
    start(() => {});
  });

  // ---------- Actions ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-wk]'); if (!t) return;
    e.preventDefault(); e.stopPropagation();
    const a = t.dataset.wk;
    if (a === 'pick') { W.pick = W.pick === t.dataset.run ? '' : t.dataset.run; return paint(); }
    if (a === 'settle') return settleIndex();
  }, true);
  // Story: the still-running worker settles while the person looks. The report is the host's,
  // so it updates without the agent; once awake, the agent's own wait carries it.
  function settleIndex() {
    if (W.indexDone) return;
    W.indexDone = true; Object.assign(RUN.index, INDEX_DONE);
    const s = STRIP.B.spins.find(x => x.id === RUN.index.id); s.st = 'merged';
    if (W.phase === 'awake') { paint(); return toast('Agentin oma odotus kattaa tämän. Agentti jatkaa itse, kun se herää odotukseensa.'); }
    paint(); toast('Hakuindeksi valmistui. Selostus päivittyi; agentti lepää edelleen.');
  }
  const hint = document.querySelector('.page-bar .hint');
  hint.insertAdjacentHTML('beforebegin', `<label class="wk-cause">Pysähtyi <select id="wk-cause" aria-label="Pysähtymisen syy">${Object.entries(STOP).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></label><button type="button" class="page-btn" data-wk="settle" title="Simuloi: yhä käynnissä oleva worker päättyy">Hakuindeksi valmistuu</button>`);
  document.getElementById('wk-cause').addEventListener('change', () => document.querySelector('.proto-picker-replay')?.click());

  // ---------- Directions ----------
  function view(dir) {
    W.gen++;
    Object.assign(W, { dir, phase: 'stopped', cause: document.getElementById('wk-cause').value, indexDone: false, pick: '', waiters: [], woke: '' });
    Object.assign(RUN.index, { st: 'working', at: '', sum: undefined });
    stripFacts();
    UI.sel = 'c1'; UI.pop = false; UI.working = false; run++;
    document.querySelectorAll('.float-bar').forEach(el => el.remove());
    C.text = ''; const ta = comp.querySelector('textarea'); if (ta) { ta.value = ''; fit(ta); }
    currentR = R();
    let html = lanka('wk-dir-' + dir, { meta: 'top', fold: 'head', runs: 'separate' });
    if (dir === 'card') html = html.replace(/<\/div>$/, `${cardHtml()}</div>`);
    if (dir === 'time') html = html.replace(/<\/div>$/, `${timeHtml()}</div>`);
    paint();
    requestAnimationFrame(() => { following = true; stage.scrollTop = stage.scrollHeight; paintHost(); });
    return html;
  }
  window.wkCard = () => view('card');
  window.wkTime = () => view('time');
  window.wkAttach = () => view('attach');
  window.__wk = { W, RUN };
})();
