// Runs inside one view's iframe, over the inert production twin. page.html
// defines X: { view, phone, way, lang, explain, hover, cards, kinds, state
// (this view's state guidance or null), blocked, toggles, has, scene }.
// The mode as rounds 7 and 8 left it: no pinning; a press does what it always
// does and only lasting effects wait; on a phone the first tap explains and a
// second tap does it; pointing hovers as outside the mode (riff 1, Kuten aina),
// so a row shows its hidden controls; a part explains only over what it shows;
// over empty space the last card stays, quieter. The top bar's ? opens the
// mode at the state card.
// Round 9's ways back to the state card once other parts have been pointed at
// (X.way):
//   0 Selitä-painike:   the ? brings it back; Esc or Lopeta ends the mode.
//   1 Tyhjä kohta:      a click (a tap) on empty conversation space brings it.
//   2 Palkin tilanne:   the mode's bar names the state; its press brings it
//                       (the bar is the page's, so the press arrives as a message).
// X.scene, when set, is one still of the page's picture sequences: the mode
// on or off, the part pointed at before, and the action marked or done.
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
    now: 'Tilanne nyt', can: 'Voit nyt', help: 'Selitä',
    onlyHover: 'Näkyy vain, kun osoitin on rivillä. Kosketusnäytöllä se näkyy aina.',
  } : {
    clickHint: (t) => `A click: ${t}.`, clickGo: 'A click opens it; the explain mode stays on.',
    tapAgain: 'Tap again to do it.', open: 'Open', close: 'Close the card',
    blocked: 'In explain mode this waits, so nothing happens by accident. Stop the mode and the button works.',
    blockedToast: 'In explain mode this does nothing. Stop the mode (Esc) and the button works.',
    would: (t) => `Prototype: here the press would: ${t}.`, wouldPlain: 'Prototype: this press was not captured.',
    strip: 'What is on the screen?', stripText: X.phone ? 'Tap any part to see what it does.' : 'Point at any part to see what it does.',
    stripGo: 'Explain these to me', stripEnd: 'Stop explaining', closeStrip: 'Close the strip', entry: 'Explain this view',
    now: 'Right now', can: 'You can now', help: 'Explain',
    onlyHover: 'Shows only while the pointer is on the row. A touch screen always shows it.',
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


  // ---- round 7's chosen way into the mode: a lasting ? in the top bar
  const dot = document.querySelector('[data-testid="header-activity"]');
  if (S) {
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

  // ---- round 8's riff 1: pointing hovers as it does outside the mode
  // Every :hover rule of production also answers to .xm-hov, which frame.js
  // puts on the chain under the pointer, as a real hover would. A real
  // implementation lets the pointer through its layer instead.
  const HOVER_ONLY = '.ah-nav-archive, .ah-workspace-more';
  {
    const walk = (rules) => {
      const acc = [];
      for (const r of rules) {
        if (r.selectorText && r.selectorText.includes(':hover')) acc.push(`${r.selectorText.replaceAll(':hover', '.xm-hov')}{${r.style.cssText}}`);
        else if (r.cssRules && r.constructor.name === 'CSSMediaRule') { const inner = walk(r.cssRules); if (inner) acc.push(`@media ${r.conditionText}{${inner}}`); }
        else if (r.cssRules && r.constructor.name === 'CSSSupportsRule') { const inner = walk(r.cssRules); if (inner) acc.push(`@supports ${r.conditionText}{${inner}}`); }
        else if (r.cssRules && r.constructor.name === 'CSSLayerBlockRule') { const inner = walk(r.cssRules); if (inner) acc.push(`@layer ${r.name}{${inner}}`); }
      }
      return acc.join('\n');
    };
    const out = [];
    for (const sh of document.styleSheets) { try { out.push(walk(sh.cssRules)); } catch { /* none */ } }
    const st = document.createElement('style');
    st.textContent = out.join('\n');
    document.head.append(st);
  }
  let hovChain = [];
  const setHov = (el) => {
    const chain = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) chain.push(n);
    for (const n of hovChain) if (!chain.includes(n)) n.classList.remove('xm-hov');
    for (const n of chain) n.classList.add('xm-hov');
    hovChain = chain;
  };

  // ---- parts and cards
  const W = X.way;
  const byId = {};
  const usable = (c) => (!c.views || c.views.includes(X.view)) && (c.way === undefined || c.way === W);
  for (const c of X.cards) if (usable(c)) byId[c.id] = c;
  const catcher = document.createElement('div');
  catcher.className = 'xm-catch';
  const layer = document.createElement('div');
  layer.className = 'xm-layer';
  let card = null;
  document.body.append(catcher, layer);

  // Round 8: what is invisible does not explain, and a part explains only over
  // its content: a wide, mostly empty band like Taustatyö answers only where its
  // marks are. A control (button, link, field) keeps its whole box, because a
  // press there does something.
  const CONTROL = 'button, a, input, textarea, select, summary, [role="button"], [role="menuitem"], [role="option"], [role="tab"], [role="switch"], label';
  const VISUAL = 'button, a, input, textarea, select, img, svg, canvas, [role="button"], kbd, hr';
  let opMemo = new Map();
  function opacity(n) {
    if (!n || n === document.documentElement) return 1;
    if (opMemo.has(n)) return opMemo.get(n);
    const s = getComputedStyle(n);
    const op = s.visibility === 'hidden' ? 0 : +s.opacity * opacity(n.parentElement);
    opMemo.set(n, op);
    return op;
  }
  const faded = (el) => opacity(el) < 0.15;
  function hull(el) {
    const r = el.getBoundingClientRect();
    if (el.matches(CONTROL) || r.width * r.height < 6000) return r;
    let l = Infinity, t = Infinity, rr = -Infinity, b = -Infinity;
    const add = (q) => { if (q.width < 1 || q.height < 1) return; l = Math.min(l, q.left); t = Math.min(t, q.top); rr = Math.max(rr, q.right); b = Math.max(b, q.bottom); };
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.nodeValue.trim() || n.parentElement.closest('svg')) continue;
      if (faded(n.parentElement)) continue;
      range.selectNodeContents(n);
      for (const q of range.getClientRects()) add(q);
    }
    for (const v of el.querySelectorAll(VISUAL)) if (!v.closest('svg svg') && !faded(v)) add(v.getBoundingClientRect());
    if (l === Infinity) return r;
    const pad = 4;
    return { left: Math.max(r.left, l - pad), top: Math.max(r.top, t - pad), right: Math.min(r.right, rr + pad), bottom: Math.min(r.bottom, b + pad), width: 1, height: 1 };
  }
  function visibleRect(el) {
    const r0 = el.getBoundingClientRect();
    if (r0.width < 3 || r0.height < 3) return null;
    if (faded(el)) return null;
    const r = hull(el);
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
    return { x: left, y: top, w: right - left, h: bottom - top, el };
  }
  function targets() {
    opMemo = new Map();
    const out = [];
    for (const c of Object.values(byId)) {
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
    // What the eye sees here: an invisible (hover-only) control is not on top.
    return all.find((n) => !n.closest('.xm-layer, .xm-catch, .xm-card, .xm-cursor, .xm-tap') && !faded(n));
  }
  function hit(x, y) {
    let best = null;
    // Only what is on top here: a part under an open list or menu is covered.
    const top = under(x, y);
    for (const t of targets()) {
      if (x < t.x || x > t.x + t.w || y < t.y || y > t.y + t.h) continue;
      if (top && !t.el.contains(top) && !top.closest('.xm-strip, [data-xm-entry]')?.contains(t.el)) continue;
      if (!best || t.w * t.h < best.w * best.h) best = t;
    }
    return best;
  }
  const findTarget = (id, el) => targets().find((t) => t.id === id && (!el || t.el === el)) || targets().find((t) => t.id === id) || null;
  const anchorEl = () => (S ? [...document.querySelectorAll(S.anchor)].pop() : null);
  const stateRect = () => { const el = anchorEl(); return el ? visibleRect(el) : null; };
  const isBlocked = (id) => X.blocked.includes(id);
  const acts = (c) => !!(c[X.lang].try || c.go || X.toggles[c.id]);
  // Way B: empty space of the conversation itself (no part here, inside its stream).
  const emptyConversation = (x, y) => !!(S && under(x, y)?.closest('.ah-conversation-stream') && !hit(x, y));

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
    const hoverOnly = !X.phone && t.el.closest(HOVER_ONLY) ? `<p class="xm-note">${T.onlyHover}</p>` : '';
    const x = X.phone ? `<button class="xm-x" data-xm-x aria-label="${T.close}">×</button>` : '';
    return `<div class="xm-top"><span class="xm-kind">${kind}</span>${c.key ? `<kbd>${esc(c.key)}</kbd>` : ''}<span class="xm-id">${c.id}</span>${x}</div>`
      + `<h2>${esc(L.name)}</h2><p>${esc(L.lead)}</p>${L.know ? `<p class="xm-know">${esc(L.know)}</p>` : ''}`
      + (disabled && L.grey ? `<p class="xm-grey">${esc(L.grey)}</p>` : '')
      + (inMenu && L.menu ? `<p class="xm-note">${esc(L.menu)}</p>` : '') + hoverOnly + foot;
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

  const post = (msg) => parent.postMessage({ xm: true, ...msg }, '*');
  let stateShown = null;
  function draw() {
    html.classList.toggle('xm-on', state.on);
    drawStrip();
    layer.innerHTML = '';
    card?.remove();
    card = null;
    if (!state.on) setHov(null);
    else {
      const t = state.hover ? findTarget(state.hover, state.hoverEl) : null;
      if (t) {
        layer.innerHTML = hole(t, state.linger ? 'xm-hole xm-linger' : 'xm-hole');
        card = document.createElement('div');
        card.setAttribute('role', 'dialog');
        card.className = `xm-card${state.linger ? ' xm-linger' : ''}`;
        card.dataset.card = t.id;
        card.innerHTML = cardHTML(t);
        document.body.append(card);
        place(card, t, state.cardX ?? (state.pt && !X.phone ? state.pt.x : null));
      } else if (S && state.entry && !state.stateHidden) {
        // The state card: what the mode opens at, and what each way brings back.
        // It stays until a part is pointed at.
        const r = stateRect();
        const ring = state.ring && findTarget(state.ring);
        layer.innerHTML = (r ? hole(r) : '<i class="xm-dim"></i>') + (ring ? hole(ring, 'xm-ring') : '');
        card = document.createElement('div');
        card.setAttribute('role', 'dialog');
        card.className = 'xm-card xm-state';
        card.dataset.card = S.id;
        card.innerHTML = stateHTML();
        document.body.append(card);
        placeState(card, r);
      } else layer.innerHTML = '<i class="xm-veil"></i>';
    }
    // Way C's bar button shows whether the state card is open.
    const shown = !!card?.classList.contains('xm-state');
    if (shown !== stateShown) { stateShown = shown; post({ type: 'statecard', open: shown }); }
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
  function setOn(on) {
    Object.assign(state, { on, hover: null, hoverEl: null, ring: null, stateHidden: false, entry: on, linger: false, cardX: null });
    post({ type: 'mode', on });
    draw();
  }
  // Every way's goal: the state card again, wherever the pointer has been.
  function showState() {
    if (!S) return;
    Object.assign(state, { hover: null, hoverEl: null, ring: null, entry: true, stateHidden: false, linger: false, cardX: null });
    draw();
  }
  // The ? (and the ? key): in way A it brings the state card back while the
  // mode is on; otherwise a second press ends the mode.
  function help() {
    if (state.on && W === 0) return showState();
    setOn(!state.on);
  }
  // A press does what it does outside the mode too, and the mode stays as it is.
  function act(c, t) {
    if (state.on && isBlocked(c.id)) { draw(); flash(t); return toast(T.blockedToast); }
    if (c.id === 'Y03') { dot?.toggleAttribute('data-open'); return draw(); }
    const to = X.toggles[c.id] || (c.go && X.has.includes(c.go) ? c.go : null);
    if (to) return post({ type: 'go', view: to, keep: state.on });
    draw();
    flash(t);
    toast(c[X.lang].try ? T.would(lc(c[X.lang].try)) : T.wouldPlain);
  }

  // The pointer at (x, y), real or a picture's preset. It hovers as outside
  // the mode; over empty space the chain (and the row it woke) stays with the
  // card that lingers.
  function move(x, y) {
    state.pt = { x, y };
    const before = hovChain[0] || null;
    setHov(under(x, y));
    const t = hit(x, y);
    if (!t && state.hover) setHov(before);
    if (t) {
      const same = t.id === state.hover && t.el === state.hoverEl;
      Object.assign(state, { hover: t.id, hoverEl: t.el, entry: false, linger: false, cardX: x });
      if (!same) { state.ring = null; return draw(); }
      if (card) place(card, t, x);
      return;
    }
    if (state.entry && S) return; // the state card stays until a part is pointed at
    if (state.hover && !state.linger) { state.linger = true; draw(); }
  }

  addEventListener('pointermove', (e) => {
    if (!state.on || e.pointerType === 'touch' || X.phone) return;
    document.querySelector('.xm-cursor')?.remove();
    document.querySelector('.xm-tap')?.remove();
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
    move(e.clientX, e.clientY);
  });
  function press(x, y, target) {
    const own = target?.closest?.('[data-xm-can], [data-xm-do], [data-xm-x]');
    // A phone's ×: a part's card gives way to the state, the state card to the view.
    if (own?.matches('[data-xm-x]')) {
      if (state.hover) { state.hover = null; state.hoverEl = null; } else state.stateHidden = true;
      return draw();
    }
    if (own?.matches('[data-xm-do]')) { const id = state.hover; return act(byId[id], findTarget(id, state.hoverEl)); }
    if (own?.matches('[data-xm-can]')) {
      const id = own.dataset.xmCan, t = findTarget(id);
      if (X.phone) { Object.assign(state, { hover: id, hoverEl: t?.el || null, ring: null, entry: false }); return draw(); }
      return act(byId[id], t);
    }
    if (target?.closest?.('.xm-card')) return;
    const below = under(x, y);
    if (below?.closest('[data-xm-help]')) return help();
    if (below?.closest('[data-xm-toggle]')) return setOn(!state.on);
    if (below?.closest('.xm-strip-x')) { strip?.remove(); strip = null; return; }
    if (state.on && !X.phone) setHov(below);
    // Way B: a click (a tap) on the conversation's empty space brings the state card.
    if (state.on && W === 1 && emptyConversation(x, y)) return showState();
    const t = hit(x, y);
    if (state.on && X.phone) {
      // First tap explains, a second tap on the same part does it; a tap on
      // nothing keeps the card (round 8, riff 1).
      if (t && t.id === state.hover && t.el === state.hoverEl) return act(byId[t.id], t);
      if (!t) return draw();
      Object.assign(state, { hover: t.id, hoverEl: t.el, ring: null, entry: false });
      return draw();
    }
    if (t) return act(byId[t.id], t);
  }
  addEventListener('click', (e) => { e.preventDefault(); press(e.clientX, e.clientY, e.target); }, true);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.on) { e.preventDefault(); setOn(false); }
    if (e.key === '?' && S) { e.preventDefault(); help(); }
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
  addEventListener('message', (e) => {
    if (!e.data?.xm) return;
    if (e.data.type === 'end' && state.on) setOn(false);
    // Way C: the bar's state, pressed on the page above the frame.
    if (e.data.type === 'state' && state.on) showState();
  });

  // ---- the pictures' named spots
  function spot(name) {
    const mid = (q) => q && { x: q.x + q.w / 2, y: q.y + q.h / 2 };
    // The part pointed at before: the latest message of yours, else the field.
    if (name === 'osoitus') {
      for (const id of ['K01', 'A01', 'V01']) { const all = targets().filter((t) => t.id === id); if (all.length) return mid(all[all.length - 1]); }
      return null;
    }
    if (name === 'help') { const el = document.querySelector('[data-xm-help]'); const q = el?.getBoundingClientRect(); return q?.width ? { x: q.left + q.width / 2, y: q.top + q.height / 2 } : null; }
    if (name === 'tyhja') {
      // Empty conversation space nearest the latest reply's side, clear of every
      // part and of the state card's usual place.
      const box = document.querySelector('.ah-conversation-stream')?.getBoundingClientRect();
      if (!box) return null;
      const near = mid(stateRect()) || { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      // Not under an open card, which takes a phone's tap.
      const open = document.querySelector('.xm-card')?.getBoundingClientRect();
      let best = null;
      for (let y = box.top + 30; y < box.bottom - 30; y += 12) for (let x = box.left + 16; x < box.right - 16; x += 12) {
        if (open && x >= open.left - 8 && x <= open.right + 8 && y >= open.top - 8 && y <= open.bottom + 8) continue;
        if (!emptyConversation(x, y)) continue;
        const d = Math.hypot(x - near.x, (y - near.y) * 1.5);
        if (!best || d < best.d) best = { x, y, d };
      }
      return best && { x: best.x, y: best.y };
    }
    return null;
  }
  // A mark where the picture's action happens: the pointer on a desktop, a
  // tap's ring on a phone; `ring` adds the press's ring around it. Its size
  // undoes the picture's scale so it reads at thumbnail size.
  function mark(p, ring) {
    document.querySelector('.xm-cursor')?.remove();
    document.querySelector('.xm-tap')?.remove();
    const k = X.scene?.k || 1;
    if (ring || X.phone) {
      const r = document.createElement('i');
      r.className = 'xm-tap';
      const d = Math.round((X.phone ? 34 : 30) * k);
      r.setAttribute('style', `left:${Math.round(p.x - d / 2)}px;top:${Math.round(p.y - d / 2)}px;width:${d}px;height:${d}px;border-width:${Math.max(2, Math.round(2.5 * k))}px`);
      document.body.append(r);
    }
    if (X.phone) return;
    const c = document.createElement('div');
    c.className = 'xm-cursor';
    c.style.left = `${Math.round(p.x)}px`;
    c.style.top = `${Math.round(p.y)}px`;
    c.style.transform = `scale(${k})`;
    c.innerHTML = '<svg viewBox="0 0 16 22" width="16" height="22"><path d="M1 1v17l4.5-4.2 3 6.7 2.6-1.2-3-6.6H14z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg>';
    document.body.append(c);
  }

  state.entry = state.on && !!S;
  state.hover = X.hover || null;
  if (X.hover) { const t = findTarget(X.hover); if (t) { state.pt = { x: t.x + t.w / 2, y: t.y + t.h / 2 }; state.hoverEl = t.el; state.entry = false; } }
  draw();
  // A picture: point at the part first (a tap on a phone), then mark or do the action.
  const sc = X.scene;
  if (sc) {
    if (sc.point) {
      const p = spot(sc.point);
      if (p) { if (X.phone) press(p.x, p.y, null); else move(p.x, p.y); }
    }
    const p = sc.at === 'bar' ? null : sc.at && spot(sc.at);
    if (p && state.on && !X.phone) move(p.x, p.y);
    if (sc.done) {
      if (sc.at === 'bar') showState();
      else if (p) press(p.x, p.y, null);
    }
    if (p) mark(p, !sc.done);
    else if (sc.cursorAt) { const q = spot(sc.cursorAt); if (q) mark(q, false); }
  }
  window.XM = { state, targets, draw, setOn, hit, findTarget, under, stateRect, move, press, spot, showState, emptyConversation, ids: () => [...new Set(targets().map((t) => t.id))] };
})();
