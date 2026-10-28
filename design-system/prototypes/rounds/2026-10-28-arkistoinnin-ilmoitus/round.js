// Arkistoinnin ilmoituksen paikka (proto-archive-notice-placement). Jari 28.10.2026: kun
// arkistoin työpuun, kelluva ilmoitus tulee seuraavan keskustelun tekstikentän tielle.
// Tuotannossa `ArchiveNotice` on `position: fixed; bottom: 20px` keskellä ja globaali
// (`#overlays`), joten se seuraa navigointia: arkistointi vie työtilasivulle, siitä avataan
// seuraava keskustelu, ja ilmoitus on kentän päällä 8 sekuntia tai niin kauan kuin osoitin
// tai fokus on siinä. Suunta päättää vain, missä kuittaus on; elinaika, kumoaminen ja fokus
// ovat kaikissa samat (paitsi Paikallaan, jossa rivi saa olla pidempään, koska se ei peitä
// mitään). Sivupalkin Nykyinen-valinta näyttää tuotannon paikan vertailuksi. Kaikki nimet,
// polut ja ajat ovat keksittyjä.
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
  const V = { dir: 'top', view: 'conv', notes: [], seq: 0, trashed: null };
  const LIFE = 8000, LIFE_PLACE = 30000;
  const I = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON_ARCH = I('<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>');
  const ICON_TRASH = I('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>');
  const current = () => document.getElementById('an-current')?.checked;

  // ---------- Hosts: where a floating notice can live ----------
  const topHost = document.createElement('div'); topHost.className = 'an-host an-top'; uiMain.appendChild(topHost);
  const curHost = document.createElement('div'); curHost.className = 'an-host an-cur'; uiMain.appendChild(curHost);
  const dockHost = document.createElement('div'); dockHost.className = 'an-host an-dock'; uiCol.insertBefore(dockHost, comp);
  // Paikallaan has no floating archive or trash notice; one without a place (the mode
  // change) falls back to the top.
  const hostFor = (n) => current() ? curHost : V.dir === 'top' ? topHost : V.dir === 'dock' ? dockHost : n.kind === 'mode' ? topHost : null;
  const inPlace = (n) => !hostFor(n);

  // ---------- Lifetime: 8 s, paused while pointed at or focused, held while busy ----------
  const life = (n) => inPlace(n) ? LIFE_PLACE : LIFE;
  const held = (n) => n.hover || n.focus || n.busy || n.problem;
  function tick(n) {
    clearTimeout(n.timer);
    if (n.t0) { n.left -= performance.now() - n.t0; n.t0 = 0; }
    if (held(n)) return lifeBars(n);
    n.t0 = performance.now(); n.timer = setTimeout(() => close(n), Math.max(0, n.left));
    lifeBars(n);
  }
  function lifeBars(n) {
    const spent = life(n) - n.left + (n.t0 ? performance.now() - n.t0 : 0);
    document.querySelectorAll(`[data-note="${n.key}"]`).forEach(el => {
      el.classList.toggle('held', !!held(n));
      const bar = el.querySelector('.an-life'); if (!bar) return;
      // Restart the bar from where the clock is, so pausing and resuming keeps its place.
      bar.style.animation = 'none'; void bar.offsetWidth;
      bar.style.animation = `an-life ${life(n)}ms linear ${-spent}ms forwards`;
      bar.style.animationPlayState = held(n) ? 'paused' : 'running';
    });
  }
  function add(n) {
    // A newer notice of the same kind replaces the older one.
    for (const o of V.notes.filter(o => o.kind === n.kind)) drop(o);
    Object.assign(n, { key: `n${++V.seq}`, left: 0, t0: 0, hover: false, focus: false, fresh: true });
    n.left = life(n);
    V.notes.push(n); render(); tick(n);
    return n;
  }
  function drop(n) { clearTimeout(n.timer); V.notes = V.notes.filter(o => o !== n); }
  function close(n) {
    const had = document.activeElement?.closest?.(`[data-note="${n.key}"]`);
    drop(n); render();
    // Focus that was inside the notice returns to where the person was going to work.
    if (had) (V.view === 'conv' ? comp.querySelector('textarea') : stage.querySelector('h1'))?.focus();
  }

  // ---------- Rendering ----------
  const textOf = (n) => `${esc(n.msg)}${n.title ? ` <b>${esc(n.title)}</b>` : ''}${n.problem ? `<span class="an-problem"> · ${esc(n.problem)}</span>` : ''}`;
  const btns = (n) => `${n.link ? `<button type="button" class="an-btn" data-an="link">${esc(n.link)}</button>` : ''}${n.restore ? `<button type="button" class="an-btn" data-an="restore"${n.busy ? ' aria-disabled="true"' : ''}>${n.busy && n.restoring ? 'Palautetaan…' : 'Palauta'}</button>` : ''}`;
  const pill = (n) => `<section class="an-note${n.wrap ? ' an-wrap' : ''}${n.fresh ? ' an-in' : ''}" role="status" data-note="${n.key}"><span class="an-text">${textOf(n)}</span>${btns(n)}<button type="button" class="an-btn an-x" data-an="close" aria-label="Sulje ilmoitus" title="Sulje (Esc)">×</button><span class="an-life" aria-hidden="true"></span></section>`;
  const receipt = (n, tag = 'div') => `<${tag} class="an-receipt${n.fresh ? ' an-in' : ''}" role="status" data-note="${n.key}"><span class="an-r-ic">${n.kind === 'trash' ? ICON_TRASH : ICON_ARCH}</span><span class="an-text">${n.kind === 'trash' ? 'Roskakorissa' : 'Arkistoitu'}: <b>${esc(n.title)}</b>${n.problem ? `<span class="an-problem"> · ${esc(n.problem)}</span>` : ''}</span>${btns(n)}<span class="an-life" aria-hidden="true"></span></${tag}>`;
  function render() {
    for (const h of [topHost, curHost, dockHost]) {
      const mine = V.notes.filter(n => hostFor(n) === h);
      // Newest closest to the anchor: below the top bar at the top, next to the field at the bottom.
      const order = h === topHost ? [...mine].reverse() : mine;
      // Redraw only when something changed, so a notice under the pointer keeps its element.
      const same = order.map(n => pill({ ...n, fresh: false })).join('');
      if (h.dataset.same !== same) { h.innerHTML = order.map(pill).join(''); h.dataset.same = same; }
    }
    topHost.style.top = `${uiTop.offsetHeight + 10}px`;
    paintRail();
    if (V.view === 'ws') { const l = stage.querySelector('.an-ws-list'); if (l) l.innerHTML = wsRows(); }
    for (const n of V.notes) { lifeBars(n); n.fresh = false; }
  }

  // ---------- Sidebar: receipts in place, and the trashed workspace's row ----------
  const libList = APP.list;
  APP.list = (w, convs) => {
    const html = libList(w, convs);
    if (current()) return html;
    const rs = V.notes.filter(n => n.kind === 'archive' && n.ws === w.id && inPlace(n)).map(n => `<li>${receipt(n)}</li>`).join('');
    if (!rs) return html;
    return html.startsWith('<ul class="convs">') ? html.replace('<ul class="convs">', `<ul class="convs">${rs}`) : `<ul class="convs">${rs}</ul>${html}`;
  };
  const accountPaintRail = paintRail;
  window.paintRail = function () {
    accountPaintRail();
    const n = V.notes.find(x => x.kind === 'trash' && inPlace(x));
    if (!n || !V.trashed) return;
    const list = uiRail.querySelector('.rail-list'); const before = list.children[V.trashed.at];
    const el = document.createElement('div'); el.className = 'an-ws-receipt'; el.innerHTML = receipt(n);
    list.insertBefore(el, before ?? null);
  };

  // ---------- Workspace page (where archiving lands, as in production) ----------
  const wsState = (c) => (STATES[convState(c)] ?? ['Ei aloitettu'])[0];
  const wsRows = () => {
    const rs = V.notes.filter(n => n.kind === 'archive' && inPlace(n) && !current()).map(n => receipt(n, 'li')).join('');
    return rs + ws.convs.filter(c => !c.archived).map(c => `<li><a href="#" class="an-ws-row" data-conv="${c.id}"><span class="conv-title">${esc(c.title)}</span><span class="an-ws-st">${wsState(c)}</span></a></li>`).join('');
  };
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
  // The worktree conversation shows its branch beside the workspace, as production does.
  const libTitle = titleBlock;
  window.titleBlock = (c) => libTitle(c).replace('</a></div>', `</a>${c.wt ? `<span class="an-wt mono">${esc(c.wt)}</span>` : ''}</div>`);

  // ---------- Archive and restore (production: no confirmation, optimistic, then confirmed) ----------
  window.askArchive = function () {
    const c = selConv(); const conv = ws.convs.find(x => x.id === c.id); if (!conv || conv.archived) return;
    conv.archived = true;
    const n = add({ kind: 'archive', ws: ws.id, msg: 'Arkistoitu', title: conv.title, busy: true, restore: () => restoreConv(n, conv) });
    showWs();
    setTimeout(() => { if (!V.notes.includes(n)) return; n.busy = false; render(); tick(n); }, 700);
  };
  function restoreConv(n, conv) {
    n.busy = true; n.restoring = true; render(); tick(n);
    setTimeout(() => { conv.archived = false; drop(n); openConv(conv.id); requestAnimationFrame(() => uiTop.querySelector('.tb-title strong')?.focus?.()); }, 600);
  }
  function trashWs() {
    if (V.trashed) return;
    const at = UI.ws.findIndex(w => w.id === 'fleetrepo'); if (at < 0) return;
    V.trashed = { at, w: UI.ws.splice(at, 1)[0] };
    const n = add({ kind: 'trash', msg: 'Siirretty roskakoriin', title: 'fleetrepo', link: 'Roskakori', restore: () => {
      n.busy = true; n.restoring = true; render(); tick(n);
      setTimeout(() => { UI.ws.splice(V.trashed.at, 0, V.trashed.w); V.trashed = null; drop(n); render(); }, 600);
    } });
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
      const n = noteOf(b); if (!n || b.getAttribute('aria-disabled') === 'true') return;
      if (b.dataset.an === 'close') return close(n);
      if (b.dataset.an === 'restore') return n.restore();
      if (b.dataset.an === 'link') { close(n); return toast('Roskakori avautuisi (oma näkymänsä).'); }
    }
    const w = e.target.closest('[data-ui="ws"]');
    if (w && !e.target.closest('.proto-picker')) { e.preventDefault(); e.stopPropagation(); return showWs(); }
  }, true);
  document.addEventListener('mouseover', (e) => { const n = noteOf(e.target); if (n && !n.hover) { n.hover = true; tick(n); } });
  document.addEventListener('mouseout', (e) => { const n = noteOf(e.target); if (n && n.hover && noteOf(e.relatedTarget) !== n) { n.hover = false; tick(n); } });
  document.addEventListener('focusin', (e) => { const n = noteOf(e.target); if (n && !n.focus) { n.focus = true; tick(n); } });
  document.addEventListener('focusout', (e) => { const n = noteOf(e.target); if (n && noteOf(e.relatedTarget) !== n) { n.focus = false; tick(n); } });
  // Esc closes a notice only from inside it: in the field, Esc belongs to the field.
  document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; const n = noteOf(document.activeElement); if (n) { e.stopPropagation(); close(n); } }, true);

  document.querySelector('.page-bar .hint').insertAdjacentHTML('beforebegin',
    `<label title="Tuotannon nykyinen paikka: keskellä alhaalla 20 px:n päässä reunasta"><input type="checkbox" id="an-current"> Nykyinen</label>`
    + `<button type="button" class="page-btn" id="an-trash">Poista työtila</button>`
    + `<button type="button" class="page-btn" id="an-mode">Tilanvaihto</button>`
    + `<button type="button" class="page-btn" id="an-again">Arkistoi alusta</button>`);
  document.getElementById('an-current').addEventListener('change', () => render());
  document.getElementById('an-trash').addEventListener('click', trashWs);
  document.getElementById('an-mode').addEventListener('click', modeNote);
  document.getElementById('an-again').addEventListener('click', () => { const v = { top: anTop, dock: anDock, place: anPlace }[V.dir]; stage.innerHTML = v(); });

  // ---------- Directions ----------
  function reset(dir) {
    for (const n of V.notes) clearTimeout(n.timer);
    V.notes = []; V.dir = dir; V.view = 'conv'; comp.hidden = false;
    if (V.trashed) { UI.ws.splice(V.trashed.at, 0, V.trashed.w); V.trashed = null; }
    ws.convs.splice(0, ws.convs.length, ...BASE());
    UI.sel = 'c2'; UI.working = false; UI.drawer = false;
    uiFrame.dataset.anDir = dir;
    requestAnimationFrame(render);
  }
  window.anTop = () => { reset('top'); return appView(); };
  window.anDock = () => { reset('dock'); return appView(); };
  window.anPlace = () => { reset('place'); return appView(); };
})();
