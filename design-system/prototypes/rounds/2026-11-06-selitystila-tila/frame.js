// Runs inside one view's iframe, over the inert production twin. page.html
// defines X: { view, phone, riff, lang, explain, hover, pop, cards, kinds,
// state (this view's state guidance or null), blocked, toggles, has }.
// Round 7: there is no pinning. In the mode a pointed part shows its card and a
// press does what it always does (opens the captured result, keeping the mode
// on); only lasting effects wait. On a phone the first tap shows the card and a
// second tap on the same part, or the card's button, does it. While nothing is
// pointed at in a conversation, the card is the conversation's state.
(() => {
  const html = document.documentElement;
  const fi = X.lang === 'fi';
  const T = fi ? {
    clickHint: (t) => `Napsautus: ${t}.`, clickGo: 'Napsautus avaa sen; selitystila pysyy päällä.',
    tapAgain: 'Napauta uudelleen, niin se tapahtuu.', open: 'Avaa', close: 'Sulje kortti',
    blocked: 'Selitystilassa tämä odottaa, jotta mitään ei tapahdu vahingossa. Lopeta tila, niin painike toimii.',
    blockedToast: 'Selitystilassa tämä ei tee mitään. Lopeta tila (Esc), niin painike toimii.',
    would: (t) => `Prototyyppi: tässä painallus tekisi: ${t}.`, wouldPlain: 'Prototyyppi: tätä painallusta ei ole kaapattu.',
    strip: 'Mitä näytöllä on?', stripText: X.phone ? 'Napauta mitä tahansa kohtaa, niin näet, mitä se tekee.' : 'Vie osoitin minkä tahansa kohdan päälle, niin näet, mitä se tekee.',
    stripGo: 'Selitä nämä mulle', stripEnd: 'Lopeta selitys', closeStrip: 'Sulje nauha', entry: 'Selitä tämä näkymä',
    now: 'Tilanne nyt', can: 'Voit nyt', ask: 'Mitä nyt?', askGo: 'Selitä tilanne', help: 'Selitä', hintX: 'Älä näytä tätä',
    hint: { alku: 'Keskustelu ei ole vielä alkanut.', tyossa: 'Agentti työskentelee. Mitä voit tehdä sillä aikaa?', vuorosi: 'Vuoro on sinun. Mitä voit tehdä nyt?',
      pysaytetty: 'Pysäytit vuoron. Mitä siitä jäi?', virhe: 'Vuoro epäonnistui. Mitä nyt kannattaa tehdä?', tausta: 'Työ jatkuu taustalla. Mitä voit tehdä sillä aikaa?' },
  } : {
    clickHint: (t) => `A click: ${t}.`, clickGo: 'A click opens it; the explain mode stays on.',
    tapAgain: 'Tap again to do it.', open: 'Open', close: 'Close the card',
    blocked: 'In explain mode this waits, so nothing happens by accident. Stop the mode and the button works.',
    blockedToast: 'In explain mode this does nothing. Stop the mode (Esc) and the button works.',
    would: (t) => `Prototype: here the press would: ${t}.`, wouldPlain: 'Prototype: this press was not captured.',
    strip: 'What is on the screen?', stripText: X.phone ? 'Tap any part to see what it does.' : 'Point at any part to see what it does.',
    stripGo: 'Explain these to me', stripEnd: 'Stop explaining', closeStrip: 'Close the strip', entry: 'Explain this view',
    now: 'Right now', can: 'You can now', ask: 'What now?', askGo: 'Explain the state', help: 'Explain', hintX: 'Do not show this',
    hint: { alku: 'The conversation has not started yet.', tyossa: 'The agent is working. What can you do meanwhile?', vuorosi: 'It is your turn. What can you do now?',
      pysaytetty: 'You stopped the turn. What was left?', virhe: 'The turn failed. What is worth doing now?', tausta: 'Work goes on in the background. What can you do meanwhile?' },
  };
  html.classList.toggle('xm-phone', X.phone);
  const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  // Scroll positions as production left them.
  // A scroller left at its end (the conversation follows its latest turn)
  // stays at its end when the mode's bar makes the view shorter.
  const sticky = [];
  for (const el of document.querySelectorAll('[data-snapshot-scroll-top]')) {
    el.scrollTop = +el.dataset.snapshotScrollTop;
    if (el.scrollHeight - el.clientHeight - el.scrollTop <= 48) sticky.push(el);
  }
  const stick = () => { for (const el of sticky) el.scrollTop = el.scrollHeight; };
  stick();
  for (const el of document.querySelectorAll('[data-snapshot-scroll-left]')) el.scrollLeft = +el.dataset.snapshotScrollLeft;

  const state = { on: !!X.explain, hover: null, pt: null, ring: null, stateHidden: false };
  const S = X.state;
  const SL = S && S[X.lang];

  // ---- entry points round 6 added: the start page's strip, the menus' row
  const startPage = document.querySelector('[data-testid="start-here"]');
  let strip = null;
  if (startPage) {
    strip = document.createElement('section');
    strip.className = 'xm-strip';
    strip.setAttribute('aria-label', T.strip);
    startPage.prepend(strip);
  }
  function drawStrip() {
    if (!strip) return;
    strip.innerHTML = `<div><b>${T.strip}</b><span>${T.stripText}</span></div>`
      + `<button class="xm-strip-go" data-xm-toggle>${state.on ? T.stripEnd : T.stripGo}</button>`
      + `<button class="xm-strip-x" aria-label="${T.closeStrip}">×</button>`;
  }
  for (const [menuSel, after] of [['[data-testid="disclosure-toggle"]', '[data-testid="menu-settings"]'], ['[role="menu"]', '[data-testid="menu-details"]']]) {
    const menu = document.querySelector(menuSel);
    const model = menu?.querySelector(after);
    if (!model || menu.querySelector('[data-xm-entry]')) continue;
    const row = model.cloneNode(true);
    row.removeAttribute('id');
    row.dataset.testid = 'menu-explain';
    row.setAttribute('data-xm-entry', '');
    row.setAttribute('data-xm-toggle', '');
    const label = [...row.querySelectorAll('span, div')].find((n) => !n.children.length && n.textContent.trim()) || row;
    label.textContent = T.entry;
    row.querySelector('small')?.remove();
    model.after(row);
  }

  // ---- the riff's way to the state guidance after the start
  const dot = document.querySelector('[data-testid="header-activity"]');
  let pop = null;
  if (X.riff === 0 && dot && S) {
    // 1 Tilapisteestä: the dot's own tip grows one row.
    pop = document.createElement('div');
    pop.className = 'xm-pop';
    pop.innerHTML = `<p>${esc(dot.getAttribute('aria-label') || SL.name)}</p>`
      + `<button data-xm-dotask data-xm-toggle><span>${T.ask}</span> ${T.askGo}</button>`;
    document.body.append(pop);
  }
  function drawPop() {
    if (!pop) return;
    pop.hidden = !X.pop || state.on;
    if (pop.hidden) return;
    const r = dot.getBoundingClientRect();
    pop.style.top = `${Math.round(r.bottom + 8)}px`;
    pop.style.left = `${Math.round(Math.min(Math.max(8, r.left + r.width / 2 - pop.offsetWidth / 2), innerWidth - pop.offsetWidth - 8))}px`;
  }
  if (X.riff === 1 && S) {
    // 2 Selitä-painike: a lasting ? in the top bar, built like its neighbour.
    const model = document.querySelector('.ah-agent-header [data-testid="toggle-terminal"]');
    if (model) {
      const b = model.cloneNode(true);
      b.removeAttribute('id');
      b.dataset.testid = 'explain-toggle';
      b.setAttribute('data-xm-help', '');
      b.setAttribute('data-xm-toggle', '');
      b.setAttribute('aria-label', `${T.help} (?)`);
      b.removeAttribute('aria-pressed');
      b.removeAttribute('data-selected');
      b.innerHTML = '<span class="xm-q" aria-hidden="true">?</span>';
      model.after(b);
    }
  }
  let hint = null;
  if (X.riff === 2 && S && X.state.id !== 'alku') {
    // 3 Tilanne tarjoaa: a quiet row beside the state, the first times it is seen.
    const anchor = [...document.querySelectorAll(S.anchor)].pop();
    if (anchor) {
      hint = document.createElement('div');
      hint.className = 'xm-hint-row';
      hint.setAttribute('data-xm-hint', '');
      hint.innerHTML = `<span class="xm-q" aria-hidden="true">?</span><span>${esc(T.hint[S.id])}</span>`
        + `<button data-xm-toggle>${T.askGo}</button><button class="xm-hint-x" aria-label="${T.hintX}">×</button>`;
      // A block of its own below the turn, not inside the state's row.
      if (S.id === 'tausta') anchor.before(hint);
      else (anchor.closest('[data-testid="agent-turn"]') || anchor).after(hint);
    }
  }

  // ---- parts and cards
  const byId = Object.fromEntries(X.cards.map((c) => [c.id, c]));
  const usable = (c) => (!c.views || c.views.includes(X.view)) && (c.riff === undefined || c.riff === X.riff);
  const catcher = document.createElement('div');
  catcher.className = 'xm-catch';
  const layer = document.createElement('div');
  layer.className = 'xm-layer';
  let card = null;
  document.body.append(catcher, layer);

  function visibleRect(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 3 || r.height < 3) return null;
    let { left, top, right, bottom } = r;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.visibility === 'hidden' || s.display === 'none') return null;
      if (/(auto|scroll|hidden|clip)/.test(s.overflow + s.overflowY + s.overflowX)) {
        const q = p.getBoundingClientRect();
        left = Math.max(left, q.left); top = Math.max(top, q.top); right = Math.min(right, q.right); bottom = Math.min(bottom, q.bottom);
      }
    }
    left = Math.max(left, 0); top = Math.max(top, 0); right = Math.min(right, innerWidth); bottom = Math.min(bottom, innerHeight);
    if (right - left < 3 || bottom - top < 3) return null;
    if (getComputedStyle(el).visibility === 'hidden') return null;
    return { x: left, y: top, w: right - left, h: bottom - top, el };
  }
  function targets() {
    const out = [];
    for (const c of X.cards) {
      if (!usable(c)) continue;
      let els;
      try { els = document.querySelectorAll(c.sel); } catch { continue; }
      for (const el of els) {
        if (el.closest('.xm-layer, .xm-card')) continue;
        const r = visibleRect(el);
        if (r) out.push({ ...r, id: c.id });
      }
    }
    return out;
  }
  function under(x, y) {
    catcher.style.pointerEvents = 'none';
    const all = document.elementsFromPoint(x, y);
    catcher.style.pointerEvents = '';
    return all.find((n) => !n.closest('.xm-layer, .xm-catch, .xm-card'));
  }
  function hit(x, y) {
    let best = null;
    // Only what is on top here: a part under an open list or menu is covered.
    const top = under(x, y);
    for (const t of targets()) {
      if (x < t.x || x > t.x + t.w || y < t.y || y > t.y + t.h) continue;
      if (top && !t.el.contains(top) && !top.closest('.xm-strip, [data-xm-entry], .xm-pop, [data-xm-hint]')?.contains(t.el)) continue;
      if (!best || t.w * t.h < best.w * best.h) best = t;
    }
    return best;
  }
  const findTarget = (id) => targets().find((t) => t.id === id) || null;
  const anchorEl = () => (S ? [...document.querySelectorAll(S.anchor)].pop() : null);
  const stateRect = () => { const el = anchorEl(); return el ? visibleRect(el) : null; };
  const isBlocked = (id) => X.blocked.includes(id);
  const acts = (c) => !!(c[X.lang].try || c.go || X.toggles[c.id]);

  function cardHTML(t) {
    const c = byId[t.id];
    const L = c[X.lang];
    const kind = X.kinds[c.kind][X.lang];
    const disabled = t.el.matches('[disabled], [aria-disabled="true"], [data-disabled]') || !!t.el.closest('[aria-disabled="true"]');
    const inMenu = !!t.el.closest('[role="menu"]');
    let foot = '';
    if (isBlocked(c.id)) foot = `<p class="xm-wait">${T.blocked}</p>`;
    else if (acts(c) && !disabled) {
      foot = X.phone
        ? `<div class="xm-foot"><button class="xm-do" data-xm-do>${esc(L.try || T.open)}</button><span class="xm-hint">${T.tapAgain}</span></div>`
        : `<div class="xm-foot"><span class="xm-hint">${L.try ? T.clickHint(lc(L.try)) : T.clickGo}</span></div>`;
    }
    const x = X.phone ? `<button class="xm-x" data-xm-x aria-label="${T.close}">×</button>` : '';
    return `<div class="xm-top"><span class="xm-kind">${kind}</span>${c.key ? `<kbd>${esc(c.key)}</kbd>` : ''}<span class="xm-id">${c.id}</span>${x}</div>`
      + `<h2>${esc(L.name)}</h2><p>${esc(L.lead)}</p>${L.know ? `<p class="xm-know">${esc(L.know)}</p>` : ''}`
      + (disabled && L.grey ? `<p class="xm-grey">${esc(L.grey)}</p>` : '')
      + (inMenu && L.menu ? `<p class="xm-note">${esc(L.menu)}</p>` : '') + foot;
  }
  function stateHTML() {
    const rows = SL.can.filter(([id]) => byId[id] && findTarget(id))
      .map(([id, text]) => `<li><button data-xm-can="${id}">${esc(text)}<span aria-hidden="true">›</span></button></li>`).join('');
    const x = X.phone ? `<button class="xm-x" data-xm-x aria-label="${T.close}">×</button>` : '';
    return `<div class="xm-top"><span class="xm-kind xm-kind-now">${T.now}</span><i class="xm-dot" data-dot="${S.dot}"></i><span class="xm-id">${S.id}</span>${x}</div>`
      + `<h2>${esc(SL.name)}</h2><p>${esc(SL.lead)}</p><p class="xm-know">${esc(SL.know)}</p>`
      + (rows ? `<div class="xm-can"><span>${T.can}</span><ul>${rows}</ul></div>` : '');
  }
  const hole = (r, cls = 'xm-hole') => `<i class="${cls}" style="left:${r.x - 3}px;top:${r.y - 3}px;width:${r.w + 6}px;height:${r.h + 6}px"></i>`;

  function draw() {
    html.classList.toggle('xm-on', state.on);
    drawStrip();
    drawPop();
    layer.innerHTML = '';
    card?.remove();
    card = null;
    if (!state.on) return;
    const t = state.hover ? findTarget(state.hover) : null;
    card = document.createElement('div');
    card.setAttribute('role', 'dialog');
    if (t) {
      layer.innerHTML = hole(t);
      card.className = 'xm-card';
      card.dataset.card = t.id;
      card.innerHTML = cardHTML(t);
      document.body.append(card);
      return place(card, t, state.pt && !X.phone ? state.pt.x : null);
    }
    if (!S || state.stateHidden) { layer.innerHTML = '<i class="xm-dim"></i>'; card = null; return; }
    // Pointing at nothing in a conversation: the conversation's state.
    const r = stateRect();
    const ring = state.ring && findTarget(state.ring);
    layer.innerHTML = (r ? hole(r) : '<i class="xm-dim"></i>') + (ring ? hole(ring, 'xm-ring') : '');
    card.className = 'xm-card xm-state';
    card.dataset.card = S.id;
    card.innerHTML = stateHTML();
    document.body.append(card);
    placeState(card, r);
  }
  // The state card covers neither its anchor nor the parts its rows point at,
  // when the view has room for that; otherwise as little of them as it can.
  function placeState(el, r) {
    const w = el.offsetWidth, h = el.offsetHeight, gap = 12;
    const keep = [r, ...SL.can.map(([id]) => findTarget(id))].filter(Boolean);
    const cx = r ? r.x + r.w / 2 : innerWidth / 2, cy = r ? r.y + r.h / 2 : innerHeight / 2;
    const xs = r ? [r.x + r.w + gap, r.x - w - gap, cx - w / 2, r.x, r.x + r.w - w] : [cx - w / 2];
    const ys = r ? [r.y - h - gap, r.y + r.h + gap, r.y, r.y + r.h - h] : [];
    for (let y = 8; y < innerHeight - h; y += 16) ys.push(y);
    let best = null;
    for (const x0 of xs) for (const y0 of ys) {
      const x = Math.min(Math.max(8, x0), innerWidth - w - 8), y = Math.min(Math.max(8, y0), innerHeight - h - 8);
      let cover = 0;
      for (const k of keep) cover += Math.max(0, Math.min(x + w, k.x + k.w + 4) - Math.max(x, k.x - 4)) * Math.max(0, Math.min(y + h, k.y + k.h + 4) - Math.max(y, k.y - 4));
      const score = cover * 1000 + Math.hypot(x + w / 2 - cx, y + h / 2 - cy);
      if (!best || score < best.score) best = { x, y, score };
    }
    el.style.left = `${Math.round(best.x)}px`;
    el.style.top = `${Math.round(best.y)}px`;
  }
  function place(el, t, px) {
    const w = el.offsetWidth, h = el.offsetHeight, gap = 10;
    const cx = px ?? t.x + t.w / 2;
    let x = Math.min(Math.max(8, cx - w / 2), innerWidth - w - 8);
    let y = t.y + t.h + gap;
    if (y + h > innerHeight - 8) y = t.y - h - gap;
    if (y < 8) y = Math.min(innerHeight - h - 8, Math.max(8, t.y + t.h + gap));
    if (y + h > innerHeight - 8) y = innerHeight - h - 8;
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
  }
  let toastTimer;
  function toast(text) {
    document.querySelector('.xm-toast')?.remove();
    const el = document.createElement('div');
    el.className = 'xm-toast';
    el.textContent = text;
    document.body.append(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 3200);
  }
  function flash(t) {
    if (!t) return;
    const i = document.createElement('i');
    i.className = 'xm-flash';
    i.setAttribute('style', `left:${t.x - 3}px;top:${t.y - 3}px;width:${t.w + 6}px;height:${t.h + 6}px`);
    layer.append(i);
  }
  const post = (msg) => parent.postMessage({ xm: true, ...msg }, '*');
  function setOn(on) {
    state.on = on; state.hover = null; state.ring = null; state.stateHidden = false;
    X.pop = false;
    post({ type: 'mode', on });
    draw();
  }
  // A press does what it does outside the mode too, and the mode stays as it is.
  function act(c, t) {
    if (state.on && isBlocked(c.id)) { draw(); flash(t); return toast(T.blockedToast); }
    if (c.id === 'Y03') {
      if (pop) { X.pop = !X.pop; return draw(); }
      dot?.toggleAttribute('data-open');
      return draw();
    }
    const to = X.toggles[c.id] || (c.go && X.has.includes(c.go) ? c.go : null);
    if (to) return post({ type: 'go', view: to, keep: state.on });
    draw();
    flash(t);
    toast(c[X.lang].try ? T.would(lc(c[X.lang].try)) : T.wouldPlain);
  }

  addEventListener('pointermove', (e) => {
    if (!state.on || e.pointerType === 'touch' || X.phone) return;
    const inCard = e.target.closest?.('.xm-card');
    if (inCard) {
      // Over the state card: its rows light the part they mean.
      const row = e.target.closest('[data-xm-can]');
      const ring = row ? row.dataset.xmCan : null;
      if (ring !== state.ring && inCard.classList.contains('xm-state')) {
        state.ring = ring;
        layer.querySelector('.xm-ring')?.remove();
        const r = ring && findTarget(ring);
        if (r) layer.insertAdjacentHTML('beforeend', hole(r, 'xm-ring'));
      }
      return;
    }
    state.pt = { x: e.clientX, y: e.clientY };
    const t = hit(e.clientX, e.clientY);
    const id = t?.id || null;
    if (id !== state.hover) { state.hover = id; state.ring = null; draw(); }
    else if (card && t) place(card, t, e.clientX);
  });
  addEventListener('click', (e) => {
    e.preventDefault();
    const own = e.target.closest?.('[data-xm-can], [data-xm-do], [data-xm-x]');
    // A phone's ×: a part's card gives way to the state, the state card to the view.
    if (own?.matches('[data-xm-x]')) { if (state.hover) state.hover = null; else state.stateHidden = true; return draw(); }
    if (own?.matches('[data-xm-do]')) { const id = state.hover; return act(byId[id], findTarget(id)); }
    if (own?.matches('[data-xm-can]')) {
      const id = own.dataset.xmCan, t = findTarget(id);
      if (X.phone) { state.hover = id; state.ring = null; return draw(); }
      return act(byId[id], t);
    }
    if (e.target.closest?.('.xm-card')) return;
    const below = under(e.clientX, e.clientY);
    if (below?.closest('.xm-hint-x')) { hint?.remove(); hint = null; return draw(); }
    if (below?.closest('[data-xm-toggle]')) return setOn(!state.on);
    if (below?.closest('.xm-strip-x')) { strip?.remove(); strip = null; return; }
    const t = hit(e.clientX, e.clientY);
    if (state.on && X.phone) {
      // First tap explains, a second tap on the same part does it.
      if (t && t.id === state.hover) return act(byId[t.id], t);
      // A tap on nothing brings the state card back.
      if (!t) state.stateHidden = false;
      state.hover = t ? t.id : null;
      state.ring = null;
      return draw();
    }
    if (t) act(byId[t.id], t);
    else if (pop && X.pop) { X.pop = false; draw(); }
  }, true);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.on) { e.preventDefault(); setOn(false); }
    if (e.key === '?' && X.riff === 1 && S) { e.preventDefault(); setOn(!state.on); }
  });
  addEventListener('wheel', (e) => {
    e.preventDefault();
    for (let n = under(e.clientX, e.clientY); n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight) { n.scrollTop += e.deltaY; break; }
    }
    draw();
  }, { passive: false });
  addEventListener('resize', () => { stick(); draw(); });
  addEventListener('message', (e) => { if (e.data?.xm && e.data.type === 'end' && state.on) setOn(false); });

  state.hover = X.hover || null;
  if (X.hover) { const t = findTarget(X.hover); if (t) state.pt = { x: t.x + t.w / 2, y: t.y + t.h / 2 }; }
  draw();
  window.XM = { state, targets, draw, setOn, hit, findTarget, under, stateRect, ids: () => [...new Set(targets().map((t) => t.id))] };
})();
