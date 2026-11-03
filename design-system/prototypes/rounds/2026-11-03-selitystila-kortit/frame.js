// Runs inside one view's iframe, over the inert production twin. page.html
// defines X: { view, phone, dir, lang, explain, hover, pin, cards, kinds,
// samples, has (the views captured at this width) }. Every press is caught
// here: outside the mode a press on a part with a captured result opens that
// view (so the prototype can be walked), inside the mode it pins the card.
(() => {
  const html = document.documentElement;
  const fi = X.lang === 'fi';
  const T = fi ? {
    pinHint: X.phone ? '' : 'Napsauta, niin kortti pysyy.', free: 'Irrota',
    would: (t) => `Prototyyppi: tässä painallus tekisi: ${t}.`, wouldPlain: 'Prototyyppi: tätä painallusta ei ole kaapattu.',
    strip: 'Mitä näytöllä on?', stripText: X.phone ? 'Napauta mitä tahansa kohtaa, niin näet, mitä se tekee.' : 'Vie osoitin minkä tahansa kohdan päälle, niin näet, mitä se tekee.',
    stripGo: 'Selitä nämä mulle', stripEnd: 'Lopeta selitys', close: 'Sulje nauha', entry: 'Selitä tämä näkymä',
  } : {
    pinHint: X.phone ? '' : 'Click to keep the card.', free: 'Let go',
    would: (t) => `Prototype: here the press would: ${t}.`, wouldPlain: 'Prototype: this press was not captured.',
    strip: 'What is on the screen?', stripText: X.phone ? 'Tap any part to see what it does.' : 'Point at any part to see what it does.',
    stripGo: 'Explain these to me', stripEnd: 'Stop explaining', close: 'Close the strip', entry: 'Explain this view',
  };
  html.classList.toggle('xm-phone', X.phone);

  // Scroll positions as production left them.
  for (const el of document.querySelectorAll('[data-snapshot-scroll-top]')) el.scrollTop = +el.dataset.snapshotScrollTop;
  for (const el of document.querySelectorAll('[data-snapshot-scroll-left]')) el.scrollLeft = +el.dataset.snapshotScrollLeft;

  // ---- entry points the mode adds to today's views
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
      + `<button class="xm-strip-x" aria-label="${T.close}">×</button>`;
  }
  // ⋯ and the account menu get one row more, built like their own rows.
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

  // ---- state
  const state = { on: !!X.explain, hover: null, pin: null, pt: null };
  const byId = Object.fromEntries(X.cards.map((c) => [c.id, c]));
  const usable = (c) => (X.dir === 'suositus' || X.samples[c.id]) && (!c.views || c.views.includes(X.view));

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
    // Cut to every scrolling ancestor, so a part scrolled away is not lit.
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
  function findTarget(id) {
    return targets().find((t) => t.id === id) || null;
  }

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function cardHTML(t, pinned) {
    const c = byId[t.id];
    const L = c[X.lang];
    const kind = X.kinds[c.kind][X.lang];
    const disabled = t.el.matches('[disabled], [aria-disabled="true"], [data-disabled]') || !!t.el.closest('[aria-disabled="true"]');
    const inMenu = !!t.el.closest('[role="menu"]');
    let body;
    if (X.dir === 'suositus') {
      body = `<p>${esc(L.lead)}</p>${L.know ? `<p class="xm-know">${esc(L.know)}</p>` : ''}`
        + (disabled && L.grey ? `<p class="xm-grey">${esc(L.grey)}</p>` : '')
        + (inMenu && L.menu ? `<p class="xm-note">${esc(L.menu)}</p>` : '');
    } else body = `<p>${esc(X.samples[c.id][X.dir][X.lang])}</p>`;
    const key = c.key ? `<kbd>${esc(c.key)}</kbd>` : '';
    const foot = pinned
      ? `<div class="xm-foot">${L.try && X.dir !== 'lyhyt' ? `<button class="xm-try" data-xm-try>${fi ? 'Kokeile' : 'Try'}: ${esc(L.try.charAt(0).toLowerCase() + L.try.slice(1))}</button>` : ''}<button class="xm-free" data-xm-free>${T.free}</button></div>`
      : (T.pinHint ? `<div class="xm-foot"><span class="xm-hint">${T.pinHint}</span></div>` : '');
    return `<div class="xm-top"><span class="xm-kind">${kind}</span>${key}<span class="xm-id">${c.id}</span></div><h2>${esc(L.name)}</h2>${body}${foot}`;
  }

  function draw() {
    html.classList.toggle('xm-on', state.on);
    drawStrip();
    layer.innerHTML = '';
    card?.remove();
    card = null;
    if (!state.on) return;
    const id = state.pin || state.hover;
    const t = id ? findTarget(id) : null;
    if (!t) { layer.innerHTML = '<i class="xm-dim"></i>'; return; }
    layer.innerHTML = `<i class="xm-hole" style="left:${t.x - 3}px;top:${t.y - 3}px;width:${t.w + 6}px;height:${t.h + 6}px"></i>`;
    card = document.createElement('div');
    card.className = 'xm-card' + (state.pin ? ' pinned' : '');
    card.setAttribute('role', 'dialog');
    card.dataset.card = t.id;
    card.innerHTML = cardHTML(t, !!state.pin);
    document.body.append(card);
    place(card, t);
  }
  function place(el, t) {
    const w = el.offsetWidth, h = el.offsetHeight, gap = 10;
    const px = state.pt && !state.pin ? state.pt.x : t.x + t.w / 2;
    let x = Math.min(Math.max(8, px - w / 2), innerWidth - w - 8);
    let y = t.y + t.h + gap;
    if (y + h > innerHeight - 8) y = t.y - h - gap;
    if (y < 8) y = Math.min(innerHeight - h - 8, Math.max(8, t.y + t.h + gap));
    // A part taller than the room: lay the card over its lower end.
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
    const i = document.createElement('i');
    i.className = 'xm-flash';
    i.setAttribute('style', `left:${t.x - 3}px;top:${t.y - 3}px;width:${t.w + 6}px;height:${t.h + 6}px`);
    layer.append(i);
  }
  const post = (msg) => parent.postMessage({ xm: true, ...msg }, '*');
  function setOn(on) {
    state.on = on; state.hover = null; state.pin = null;
    post({ type: 'mode', on });
    draw();
  }
  // Kokeile and an ordinary press do the same: open the captured result, or
  // say what the press would do.
  function act(c, t) {
    if (c.go && X.has.includes(c.go)) return post({ type: 'go', view: c.go });
    draw();
    if (t) flash(t);
    toast(c[X.lang].try ? T.would(c[X.lang].try.toLowerCase()) : T.wouldPlain);
  }
  function under(x, y) {
    catcher.style.pointerEvents = 'none';
    const all = document.elementsFromPoint(x, y);
    catcher.style.pointerEvents = '';
    return all.find((n) => !n.closest('.xm-layer, .xm-catch, .xm-card'));
  }

  addEventListener('pointermove', (e) => {
    if (!state.on || state.pin || e.pointerType === 'touch') return;
    if (e.target.closest?.('.xm-card')) return;
    state.pt = { x: e.clientX, y: e.clientY };
    const t = hit(e.clientX, e.clientY);
    const id = t?.id || null;
    if (id !== state.hover) { state.hover = id; draw(); }
    else if (card && t) place(card, t);
  });
  addEventListener('click', (e) => {
    e.preventDefault();
    const own = e.target.closest?.('[data-xm-free], [data-xm-try]');
    if (own?.matches('[data-xm-free]')) { state.pin = null; state.hover = null; return draw(); }
    if (own?.matches('[data-xm-try]')) {
      const c = byId[state.pin], t = findTarget(state.pin);
      state.on = false; state.pin = null; post({ type: 'mode', on: false });
      return act(c, t);
    }
    if (e.target.closest?.('.xm-card')) return;
    const below = under(e.clientX, e.clientY);
    if (below?.closest('[data-xm-toggle]')) return setOn(!state.on);
    if (below?.closest('.xm-strip-x')) { strip?.remove(); strip = null; return; }
    const t = hit(e.clientX, e.clientY);
    if (state.on) {
      state.pt = { x: e.clientX, y: e.clientY };
      state.pin = t ? t.id : null;
      state.hover = state.pin;
      return draw();
    }
    if (t) act(byId[t.id], t);
  }, true);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.on) { e.preventDefault(); setOn(false); }
  });
  // The catcher covers the page, so the wheel is handed to what is under it.
  addEventListener('wheel', (e) => {
    e.preventDefault();
    for (let n = under(e.clientX, e.clientY); n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight) { n.scrollTop += e.deltaY; break; }
    }
    if (state.on) draw();
  }, { passive: false });
  addEventListener('resize', draw);
  // The mode bar lives above the frame, in the page; its Stop ends the mode here.
  addEventListener('message', (e) => { if (e.data?.xm && e.data.type === 'end' && state.on) setOn(false); });

  state.hover = X.hover || null;
  state.pin = X.pin || null;
  if (X.pin) { const t = findTarget(X.pin); if (t) state.pt = { x: t.x + t.w / 2, y: t.y + t.h / 2 }; }
  draw();
  // A first part under a given point, for the check's screenshots.
  window.XM = { state, targets, draw, setOn, hit, findTarget, under, ids: () => [...new Set(targets().map((t) => t.id))] };
})();
