// Arkistoinnin ilmoitus ylhäällä, kierros 2 (proto-archive-notice-placement). Jari valitsi
// 28.10.2026 kierroksen 1 suunnan Ylhäällä: kuittaus yläpalkin alle, pois seuraavan keskustelun
// kentän tieltä. Tämä kierros vaihtaa vain ilmeen, ja jokainen ilme tuo oman elinaikansa ja
// pinoamistapansa. Kaikille yhteistä: kuittaus ei koskaan ota fokusta, Esc sulkee sen vain
// sen sisältä, osoitin tai fokus ilmoitusalueella pysäyttää kellon, kesken oleva tai
// epäonnistunut toiminto pitää sen auki, ja saman lajin uusi ilmoitus korvaa vanhan.
// Kaikki nimet, polut ja ajat ovat keksittyjä.
(() => {
  // ---------- Content ----------
  const ws = UI.ws[0];
  const BASE = () => [
    { id: 'c2', title: 'Kuvien pakkaus WebP-muotoon', st: 'done', wt: 'wt/webp-pakkaus' },
    { id: 'c1', title: 'Status-skripti' },
    { id: 'c3', title: 'CI-ajon aikakatkaisu maanantaiaamuisin', st: 'attention' },
    { id: 'c7', title: 'README:n esimerkkien päivitys', st: 'done' },
    { id: 'c8', title: 'Aikavyöhykkeen käsittely tulosteessa', st: 'done' },
  ];
  const ARCH = [
    { kind: 'marker', t: 'settings', time: '09.12', model: MODEL_ID, thinking: 'medium' },
    { kind: 'user', time: '09.12', md: 'Pakkaa `static/img`-hakemiston PNG-kuvat WebP-muotoon omassa työpuussa ja päivitä viittaukset. Yhdistä, kun testit menevät läpi.' },
    { kind: 'turn', time: '09.31', blocks: [
      { t: 'think', md: '**Converting 42 images and updating references**' },
      { t: 'tool', name: 'bash', target: 'scripts/to-webp.sh static/img', args: { command: 'scripts/to-webp.sh static/img' }, result: '42 kuvaa muunnettu · 18,4 Mt → 6,1 Mt' },
      { t: 'tool', name: 'bash', target: 'npm test', args: { command: 'npm test' }, result: 'Tests: 128 passed, 128 total' },
      { t: 'tool', name: 'bash', target: 'git merge --ff-only wt/webp-pakkaus', args: { command: 'git switch main && git merge --ff-only wt/webp-pakkaus' }, result: 'Fast-forward\n 46 files changed' },
      { t: 'reply', md: 'Valmis. 42 kuvaa on nyt WebP-muodossa (18,4 Mt → 6,1 Mt), viittaukset on päivitetty ja testit menevät läpi. Haara `wt/webp-pakkaus` on yhdistetty päähaaraan, joten työpuun voi arkistoida.' },
    ] },
  ];
  const NEXT = [
    { kind: 'marker', t: 'settings', time: '08.40', model: MODEL_ID, thinking: 'medium' },
    { kind: 'user', time: '08.40', md: 'Tee skripti, joka parsii `status.md`:n taulukon ja tulostaa viime viikon rivit JSONina.' },
    { kind: 'turn', time: '08.44', blocks: [
      { t: 'tool', name: 'bash', target: 'python3 status.py --since 7', args: { command: 'python3 status.py --since 7' }, result: '[{"pvm":"2026-10-21","tila":"valmis"}, …]' },
      { t: 'reply', md: 'Skripti on tiedostossa `status.py`. Se lukee taulukon, valitsee viimeisen seitsemän päivän rivit ja tulostaa ne JSON-listana. Haluatko, että lisään vielä `--table`-lipun?' },
    ] },
  ];

  // ---------- State ----------
  // over: the pointer or focus is on the notice area. open: Otsakerivi's folded lines are shown.
  const V = { look: 'card', view: 'conv', notes: [], seq: 0, trashed: null, over: false, focus: false, open: false };
  // Lifetime per look: the louder the look, the shorter its stay.
  const LIFE = { card: 8000, band: 10000, head: 20000 };
  const I = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON = {
    archive: I('<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>'),
    trash: I('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>'),
    mode: I('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>'),
    bad: I('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>'),
  };

  // ---------- Hosts: all three live under the top bar ----------
  const cardHost = document.createElement('div'); cardHost.className = 'an-host an-card-host';
  const bandHost = document.createElement('div'); bandHost.className = 'an-host an-band-host';
  const headHost = document.createElement('div'); headHost.className = 'an-host an-head-host';
  uiMain.append(cardHost, bandHost);
  uiMain.insertBefore(headHost, uiTop.nextSibling);
  const hostOf = () => ({ card: cardHost, band: bandHost, head: headHost })[V.look];
  // Newest first everywhere: the newest is the one nearest the top bar.
  const newest = () => [...V.notes].reverse();

  // ---------- Lifetime ----------
  // Kortti and Otsakerivi show one notice at a time; the others wait with their clock stopped,
  // so a notice that arrives second does not lose its undo time behind the first.
  const waiting = (n) => V.look === 'band' ? false : V.look === 'card' ? !V.over && !V.focus && newest()[0] !== n : !V.open && newest()[0] !== n;
  const held = (n) => V.over || V.focus || n.busy || !!n.problem || waiting(n);
  function tick(n) {
    clearTimeout(n.timer);
    if (n.t0) { n.left -= performance.now() - n.t0; n.t0 = 0; }
    if (!held(n)) { n.t0 = performance.now(); n.timer = setTimeout(() => close(n), Math.max(0, n.left)); }
    lifeBar(n);
  }
  function lifeBar(n) {
    const el = document.querySelector(`[data-note="${n.key}"]`); if (!el) return;
    el.classList.toggle('held', held(n));
    const bar = el.querySelector('.an-life'); if (!bar) return;
    const spent = n.life - n.left + (n.t0 ? performance.now() - n.t0 : 0);
    // Restart the bar from where the clock is, so pausing and resuming keeps its place.
    bar.style.animation = 'none'; void bar.offsetWidth;
    bar.style.animation = `an-life ${n.life}ms linear ${-spent}ms forwards`;
    bar.style.animationPlayState = held(n) ? 'paused' : 'running';
  }
  function add(n) {
    for (const o of V.notes.filter(o => o.kind === n.kind)) drop(o);
    Object.assign(n, { key: `n${++V.seq}`, life: LIFE[V.look], t0: 0, fresh: true });
    n.left = n.life;
    V.notes.push(n); render();
    return n;
  }
  function drop(n) { clearTimeout(n.timer); V.notes = V.notes.filter(o => o !== n); }
  function close(n) {
    const had = document.activeElement?.closest?.(`[data-note], .an-host`);
    drop(n);
    if (!V.notes.length) { V.over = false; V.focus = false; V.open = false; }
    render();
    // Focus that was inside the notice returns to where the person was going to work.
    if (had && !hostOf().contains(document.activeElement)) (V.view === 'conv' ? comp.querySelector('textarea') : stage.querySelector('h1'))?.focus();
  }

  // ---------- Rendering ----------
  const iconOf = (n) => ICON[n.problem ? 'bad' : n.kind];
  const textOf = (n) => `${esc(n.msg)}${n.title ? ` <b>${esc(n.title)}</b>` : ''}${n.problem ? `<span class="an-problem"> · ${esc(n.problem)}</span>` : ''}`;
  const btns = (n) => `${n.link ? `<button type="button" class="an-btn" data-an="link">${esc(n.link)}</button>` : ''}${n.restore ? `<button type="button" class="an-btn" data-an="restore"${n.busy ? ' aria-disabled="true"' : ''}>${n.busy && n.restoring ? 'Palautetaan…' : 'Palauta'}</button>` : ''}<button type="button" class="an-btn an-x" data-an="close" aria-label="Sulje ilmoitus" title="Sulje">×</button>`;
  const life = (n) => n.problem ? '' : '<span class="an-life" aria-hidden="true"></span>';
  const cls = (n, base) => `${base}${n.wrap ? ' an-wrap' : ''}${n.problem ? ' an-bad' : ''}${n.fresh ? ' an-in' : ''}`;

  const card = (n, depth, more) => `<section class="${cls(n, 'an-card')}" role="status" data-note="${n.key}" data-depth="${Math.min(depth, 3)}"><span class="an-ic">${iconOf(n)}</span><span class="an-text">${textOf(n)}</span>${more ? `<span class="an-more" title="Osoita nähdäksesi kaikki">+${more}</span>` : ''}${btns(n)}${life(n)}</section>`;
  const row = (n) => `<section class="${cls(n, 'an-row')}" role="status" data-note="${n.key}"><span class="an-ic">${iconOf(n)}</span><span class="an-text">${textOf(n)}</span>${btns(n)}${life(n)}</section>`;
  const line = (n, i, more) => `<section class="${cls(n, 'an-line')}" role="status" data-note="${n.key}"${i > 0 && !V.open ? ' hidden' : ''}><span class="an-ic">${iconOf(n)}</span><span class="an-text">${textOf(n)}</span>${i === 0 && more ? `<button type="button" class="an-count" data-an="more" aria-expanded="${V.open}">${V.open ? 'Piilota' : `+${more}`}</button>` : ''}${btns(n)}</section>`;

  function render() {
    const atEnd = stage.scrollHeight - stage.scrollTop - stage.clientHeight < 4;
    const ns = newest(); const more = ns.length - 1;
    if (V.open && !more) V.open = false;
    const html = {
      card: ns.map((n, i) => card(n, i, i === 0 ? more : 0)).join(''),
      band: ns.map(row).join(''),
      head: ns.map((n, i) => line(n, i, more)).join(''),
    };
    for (const [look, h] of [['card', cardHost], ['band', bandHost], ['head', headHost]]) {
      const want = V.look === look ? html[look] : '';
      // Redraw only when something changed, so a notice under the pointer keeps its element.
      const key = want.replace(/ an-in/g, '');
      if (h.dataset.same !== key) { const keep = h.contains(document.activeElement) && document.activeElement.dataset.an; h.innerHTML = want; h.dataset.same = key; if (keep) h.querySelector(`[data-note="${ns[0]?.key}"] [data-an="${keep}"]`)?.focus(); }
    }
    cardHost.classList.toggle('open', V.over || V.focus);
    cardHost.style.top = `${uiTop.offsetHeight + 8}px`;
    bandHost.style.top = `${uiTop.offsetHeight}px`;
    // Otsakerivi makes the top bar taller; a thread that was at its end stays at its end.
    if (atEnd && V.look === 'head') { stage.scrollTop = stage.scrollHeight; following = true; lastTop = stage.scrollTop; }
    for (const n of V.notes) { tick(n); n.fresh = false; }
  }

  // ---------- Workspace page (where archiving lands, as in production) ----------
  const wsState = (c) => (STATES[convState(c)] ?? ['Ei aloitettu'])[0];
  const wsRows = () => ws.convs.filter(c => !c.archived).map(c => `<li><a href="#" class="an-ws-row" data-conv="${c.id}"><span class="conv-title">${esc(c.title)}</span><span class="an-ws-st">${wsState(c)}</span></a></li>`).join('');
  const wsPage = () => `<div class="an-wspage"><header><div><h1 tabindex="-1">${esc(ws.id)}</h1><p><code>${esc(ws.path)}</code></p></div><button type="button" class="secondary" data-ws-add="${ws.id}">${SVG('<path d="M12 5v14M5 12h14"/>')}Uusi keskustelu</button></header><h2>Keskustelut</h2><ul class="an-ws-list">${wsRows()}</ul></div>`;
  function showWs() {
    V.view = 'ws'; comp.hidden = true; UI.pop = false; UI.drawer = false; run++;
    paint(); stage.innerHTML = wsPage(); render();
    // Production moves focus to the page heading after an archive.
    stage.querySelector('h1').focus({ preventScroll: true });
  }
  const libPaintTop = paintTop;
  window.paintTop = function () {
    if (V.view !== 'ws') return libPaintTop();
    uiTop.innerHTML = `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button><div class="tb-title"><strong>${esc(ws.id)}</strong><span class="tb-ws">työtila</span></div>`;
  };

  // ---------- Conversations ----------
  const libContent = window.content;
  window.content = function () {
    const c = selConv(); const set = c.id === 'c2' ? ARCH : c.id === 'c1' ? NEXT : null;
    if (!set) return libContent();
    run++; CONVO.splice(0, CONVO.length, ...set);
    requestAnimationFrame(() => { following = true; stage.scrollTop = stage.scrollHeight; lastTop = stage.scrollTop; });
    return lanka('', { meta: 'top', fold: 'head', runs: 'separate' });
  };
  const libOpen = openConv;
  window.openConv = function (id) { V.view = 'conv'; comp.hidden = false; libOpen(id); requestAnimationFrame(render); };
  const libTitle = titleBlock;
  window.titleBlock = (c) => libTitle(c).replace('</a></div>', `</a>${c.wt ? `<span class="an-wt mono">${esc(c.wt)}</span>` : ''}</div>`);

  // ---------- Archive and restore (production: no confirmation, optimistic, then confirmed) ----------
  window.askArchive = function () {
    const c = selConv(); const conv = ws.convs.find(x => x.id === c.id); if (!conv || conv.archived) return;
    conv.archived = true;
    const n = add({ kind: 'archive', msg: 'Arkistoitu', title: conv.title, busy: true, restore: () => restoreConv(n, conv) });
    showWs();
    setTimeout(() => { if (!V.notes.includes(n)) return; n.busy = false; render(); }, 700);
  };
  function restoreConv(n, conv) {
    n.busy = true; n.restoring = true; render();
    setTimeout(() => { conv.archived = false; drop(n); openConv(conv.id); requestAnimationFrame(() => uiTop.querySelector('.tb-title strong')?.focus?.()); }, 600);
  }
  function trashWs(problem) {
    if (V.trashed) return;
    const at = UI.ws.findIndex(w => w.id === 'fleetrepo'); if (at < 0) return;
    V.trashed = { at, w: UI.ws.splice(at, 1)[0] };
    const n = add({ kind: 'trash', msg: problem ? 'Ei poistettu kokonaan:' : 'Siirretty roskakoriin', title: 'fleetrepo', link: 'Roskakori', problem, restore: () => {
      n.busy = true; n.restoring = true; render();
      setTimeout(() => { UI.ws.splice(V.trashed.at, 0, V.trashed.w); V.trashed = null; drop(n); paint(); render(); }, 600);
    } });
    paint(); render();
  }
  function modeNote() {
    add({ kind: 'mode', msg: 'Yksi työtila jäljellä: sivupalkki näyttää nyt sen keskustelut suoraan ilman työtilaryhmiä.', wrap: true });
  }

  // ---------- Interactions ----------
  const noteOf = (el) => V.notes.find(n => n.key === el?.closest?.('[data-note]')?.dataset.note);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-an]');
    if (b) {
      e.preventDefault(); e.stopPropagation();
      if (b.dataset.an === 'more') { V.open = !V.open; return render(); }
      const n = noteOf(b); if (!n || b.getAttribute('aria-disabled') === 'true') return;
      if (b.dataset.an === 'close') return close(n);
      if (b.dataset.an === 'restore') return n.restore();
      if (b.dataset.an === 'link') { close(n); return toast('Roskakori avautuisi (oma näkymänsä).'); }
    }
    const w = e.target.closest('[data-ui="ws"]');
    if (w && !e.target.closest('.proto-picker')) { e.preventDefault(); e.stopPropagation(); return showWs(); }
  }, true);
  // The whole notice area pauses: in Kortti it also opens the deck.
  const inArea = (el) => !!el?.closest?.('.an-host');
  document.addEventListener('mouseover', (e) => { if (inArea(e.target) && !V.over) { V.over = true; render(); } });
  document.addEventListener('mouseout', (e) => { if (V.over && inArea(e.target) && !inArea(e.relatedTarget)) { V.over = false; render(); } });
  document.addEventListener('focusin', (e) => { const on = inArea(e.target); if (on !== V.focus) { V.focus = on; render(); } });
  document.addEventListener('focusout', (e) => { if (V.focus && !inArea(e.relatedTarget)) { V.focus = false; render(); } });
  // Esc closes a notice only from inside it: in the field, Esc belongs to the field.
  document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; const n = noteOf(document.activeElement); if (n) { e.stopPropagation(); close(n); } }, true);

  document.querySelector('.page-bar .hint').insertAdjacentHTML('beforebegin',
    `<button type="button" class="page-btn" id="an-trash">Poista työtila</button>`
    + `<button type="button" class="page-btn" id="an-stuck">Poisto jää kesken</button>`
    + `<button type="button" class="page-btn" id="an-mode">Tilanvaihto</button>`
    + `<button type="button" class="page-btn" id="an-again">Arkistoi alusta</button>`);
  document.getElementById('an-trash').addEventListener('click', () => trashWs());
  document.getElementById('an-stuck').addEventListener('click', () => trashWs('node on yhä sen hakemistossa'));
  document.getElementById('an-mode').addEventListener('click', modeNote);
  document.getElementById('an-again').addEventListener('click', () => { stage.innerHTML = ({ card: anCard, band: anBand, head: anHead })[V.look](); });

  // ---------- Looks ----------
  function reset(look) {
    for (const n of V.notes) clearTimeout(n.timer);
    Object.assign(V, { notes: [], look, view: 'conv', over: false, focus: false, open: false });
    comp.hidden = false;
    if (V.trashed) { UI.ws.splice(V.trashed.at, 0, V.trashed.w); V.trashed = null; }
    ws.convs.splice(0, ws.convs.length, ...BASE());
    UI.sel = 'c2'; UI.working = false; UI.drawer = false;
    uiFrame.dataset.anLook = look;
    requestAnimationFrame(render);
  }
  window.anCard = () => { reset('card'); return appView(); };
  window.anBand = () => { reset('band'); return appView(); };
  window.anHead = () => { reset('head'); return appView(); };
})();
