// Runs inside one view's iframe, over the inert production twin. page.html
// defines X: { view, phone, riff, lang, explain, hover, pop, cards, kinds,
// state (this view's state guidance or null), blocked, toggles, has }.
// Round 7 (kept): no pinning; a press does what it always does and only lasting
// effects wait; on a phone the first tap explains and a second tap does it; the
// top bar's ? (round 7's chosen riff 2) opens the mode at the conversation's
// state. Round 8 adds, in every riff: a part explains only over what it shows
// (its content, not its empty width), and an invisible button never explains.
// The riffs (X.riff) differ on the corner cases: what empty space shows, and how
// a control that appears only under the pointer is reached and explained.
//   0 Kuten aina:        pointing hovers as outside the mode; empty space keeps the last card.
//   1 Kaikki esillä:     the mode shows every hover-only control; empty space shows nothing.
//   2 Kokonaisuus kertoo: a row's card names its hidden controls; empty space names its area.
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
    onlyHover: 'Näkyy vain, kun osoitin on rivillä. Kosketusnäytöllä se näkyy aina.',
    shownNow: 'Tavallisesti tämä näkyy vain, kun osoitin on rivillä; selitystila näyttää sen nyt.',
    alsoRow: 'Rivillä myös, kun osoitin on sen päällä:', waitsShort: '(odottaa selitystilassa)',
    chipClick: 'Napsauta, niin näet mitä voit tehdä.', chipTap: 'Napauta, niin näet mitä voit tehdä.',
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
    onlyHover: 'Shows only while the pointer is on the row. A touch screen always shows it.',
    shownNow: 'Usually this shows only while the pointer is on the row; the explain mode shows it now.',
    alsoRow: 'Also on the row, while the pointer is on it:', waitsShort: '(waits in explain mode)',
    chipClick: 'Click empty space to see what you can do.', chipTap: 'Tap to see what you can do.',
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

  // ---- round 7's chosen way to the state guidance: a lasting ? in the top bar
  const dot = document.querySelector('[data-testid="header-activity"]');
  const pop = null;
  let hint = null;
  const drawPop = () => {};
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

  // ---- round 8: controls that show only under the pointer
  // Production hides these until the pointer (or focus) is on their row; a
  // touch screen always shows them. HOVER_ONLY is that list.
  const HOVER_ONLY = '.ah-nav-archive, .ah-workspace-more';
  const R = X.riff;
  html.classList.toggle('xm-r0', R === 0);
  html.classList.toggle('xm-r1', R === 1);
  html.classList.toggle('xm-r2', R === 2);
  // Riff 1: every :hover rule of production also answers to .xm-hov, which
  // frame.js puts on the chain under the pointer, as a real hover would.
  if (R === 0) {
    const out = [];
    const walk = (rules) => {
      const acc = [];
      for (const r of rules) {
        if (r.selectorText && r.selectorText.includes(':hover')) acc.push(`${r.selectorText.replaceAll(':hover', '.xm-hov')}{${r.style.cssText}}`);
        else if (r.cssRules && r.conditionText !== undefined && r.constructor.name === 'CSSMediaRule') { const inner = walk(r.cssRules); if (inner) acc.push(`@media ${r.conditionText}{${inner}}`); }
        else if (r.cssRules && r.constructor.name === 'CSSSupportsRule') { const inner = walk(r.cssRules); if (inner) acc.push(`@supports ${r.conditionText}{${inner}}`); }
        else if (r.cssRules && r.constructor.name === 'CSSLayerBlockRule') { const inner = walk(r.cssRules); if (inner) acc.push(`@layer ${r.name}{${inner}}`); }
      }
      return acc.join('\n');
    };
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

  // Riff 3: the areas empty space names, first match from the pointed element up.
  const AREAS = X.regions;
  let chip = null;

  // ---- parts and cards
  const byId = Object.fromEntries(X.cards.map((c) => [c.id, c]));
  const usable = (c) => (!c.views || c.views.includes(X.view)) && (c.riff === undefined || c.riff === X.riff);
  const catcher = document.createElement('div');
  catcher.className = 'xm-catch';
  const layer = document.createElement('div');
  layer.className = 'xm-layer';
  let card = null;
  document.body.append(catcher, layer);

  // Round 8, every riff: what is invisible does not explain (a hover-only button
  // at opacity 0 used to answer at the row's end), and a part explains only over
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
    for (const c of X.cards) {
      if (!usable(c)) continue;
      let els;
      try { els = document.querySelectorAll(c.sel); } catch { continue; }
      for (const el of els) {
        if (el.closest('.xm-layer, .xm-card, .xm-chip')) continue;
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
    return all.find((n) => !n.closest('.xm-layer, .xm-catch, .xm-card, .xm-chip, .xm-cursor') && !faded(n));
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
  // The cards of the hover-only controls in the same row as el.
  function hiddenOf(el) {
    const row = el.closest('li');
    if (!row) return [];
    const out = [];
    for (const box of row.querySelectorAll(HOVER_ONLY)) {
      if (box.closest('li') !== row) continue;
      for (const c of X.cards) {
        if (!usable(c) || out.includes(c)) continue;
        try { if (box.matches(c.sel) || box.querySelector(c.sel)) out.push(c); } catch { /* own parts */ }
      }
    }
    return out;
  }

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
    // A hover-only control, shown: say that it is usually hidden.
    const hoverOnly = !X.phone && t.el.closest(HOVER_ONLY) ? `<p class="xm-note">${R === 1 ? T.shownNow : T.onlyHover}</p>` : '';
    // Riff 3: the row's card names the controls that appear only under the pointer.
    let also = '';
    if (R === 2 && !X.phone && !t.el.closest(HOVER_ONLY)) {
      const hid = hiddenOf(t.el);
      if (hid.length) also = `<div class="xm-also"><span>${T.alsoRow}</span><ul>${hid.map((h) => `<li><b>${esc(h[X.lang].name)}</b> ${esc(h[X.lang].lead)}${isBlocked(h.id) ? ` <i>${T.waitsShort}</i>` : ''}</li>`).join('')}</ul></div>`;
    }
    const x = X.phone ? `<button class="xm-x" data-xm-x aria-label="${T.close}">×</button>` : '';
    return `<div class="xm-top"><span class="xm-kind">${kind}</span>${c.key ? `<kbd>${esc(c.key)}</kbd>` : ''}<span class="xm-id">${c.id}</span>${x}</div>`
      + `<h2>${esc(L.name)}</h2><p>${esc(L.lead)}</p>${L.know ? `<p class="xm-know">${esc(L.know)}</p>` : ''}`
      + (disabled && L.grey ? `<p class="xm-grey">${esc(L.grey)}</p>` : '')
      + (inMenu && L.menu ? `<p class="xm-note">${esc(L.menu)}</p>` : '') + hoverOnly + also + foot;
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

  // Riff 3: the area the pointer is in, when it points at no part.
  function areaAt(x, y) {
    const el = under(x, y);
    if (!el) return null;
    for (const a of AREAS) {
      const box = el.closest(a.sel);
      if (box) {
        const q = box.getBoundingClientRect();
        return { ...a, el: box, x: q.left, y: q.top, w: q.width, h: q.height };
      }
    }
    return null;
  }
  function drawChip() {
    chip?.remove();
    chip = null;
    const a = state.area;
    if (!a) return;
    chip = document.createElement('div');
    chip.className = 'xm-chip';
    const conv = a.id === 'conversation' && S;
    chip.innerHTML = conv
      ? `<i class="xm-dot" data-dot="${S.dot}"></i><b>${T.now}: ${esc(SL.name)}</b><span>${X.phone ? T.chipTap : T.chipClick}</span>`
      : `<b>${esc(a[X.lang].name)}</b><span>${esc(a[X.lang].line)}</span>`;
    document.body.append(chip);
    const p = state.pt || { x: a.x + a.w / 2, y: a.y + 40 };
    const w = chip.offsetWidth, h = chip.offsetHeight;
    // A phone has no pointer to follow: the chip sits at its area's edge, inside the view.
    let cx = X.phone ? 8 : Math.min(Math.max(8, p.x + 14), innerWidth - w - 8);
    let cy = X.phone ? (a.y > innerHeight / 2 ? a.y - h - 8 : Math.min(a.y + a.h + 8, innerHeight - h - 8)) : p.y + 18;
    if (cy + h > innerHeight - 8) cy = p.y - h - 12;
    chip.style.left = `${Math.round(cx)}px`;
    chip.style.top = `${Math.round(cy)}px`;
  }

  function draw() {
    html.classList.toggle('xm-on', state.on);
    drawStrip();
    drawPop();
    layer.innerHTML = '';
    card?.remove();
    card = null;
    chip?.remove();
    chip = null;
    if (!state.on) { setHov(null); return; }
    const t = state.hover ? findTarget(state.hover, state.hoverEl) : null;
    card = document.createElement('div');
    card.setAttribute('role', 'dialog');
    if (t) {
      layer.innerHTML = hole(t, state.linger ? 'xm-hole xm-linger' : 'xm-hole');
      card.className = `xm-card${state.linger ? ' xm-linger' : ''}`;
      card.dataset.card = t.id;
      card.innerHTML = cardHTML(t);
      document.body.append(card);
      return place(card, t, state.cardX ?? (state.pt && !X.phone ? state.pt.x : null));
    }
    card = null;
    // Pointing at nothing. The state card is what the mode opens at (the ? or
    // the menu row), and stays until a part is pointed at; after that empty
    // space is the riff's question.
    if (S && state.entry && !state.stateHidden) {
      const r = stateRect();
      const ring = state.ring && findTarget(state.ring);
      layer.innerHTML = (r ? hole(r) : '<i class="xm-dim"></i>') + (ring ? hole(ring, 'xm-ring') : '');
      card = document.createElement('div');
      card.setAttribute('role', 'dialog');
      card.className = 'xm-card xm-state';
      card.dataset.card = S.id;
      card.innerHTML = stateHTML();
      document.body.append(card);
      return placeState(card, r);
    }
    if (R === 2 && state.area) {
      layer.innerHTML = hole(state.area, 'xm-area');
      return drawChip();
    }
    // Riff 2 (and anything else): empty space is empty, only a light veil says the mode is on.
    layer.innerHTML = '<i class="xm-veil"></i>';
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
    Object.assign(state, { on, hover: null, hoverEl: null, ring: null, stateHidden: false, entry: on, linger: false, area: null, cardX: null });
    post({ type: 'mode', on });
    draw();
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

  // The pointer at (x, y), real or the page's preset.
  function move(x, y) {
    state.pt = { x, y };
    let t;
    if (R === 0) {
      // Pointing hovers as it does outside the mode, so a row shows its hidden
      // controls and they can be pointed at. Over empty space the chain (and the
      // row it woke) stays with the card that lingers.
      const before = hovChain[0] || null;
      setHov(under(x, y));
      t = hit(x, y);
      if (!t && state.hover) setHov(before);
    } else t = hit(x, y);
    if (t) {
      const same = t.id === state.hover && t.el === state.hoverEl;
      Object.assign(state, { hover: t.id, hoverEl: t.el, entry: false, linger: false, area: null, cardX: x });
      if (!same) { state.ring = null; return draw(); }
      if (card) place(card, t, x);
      return;
    }
    if (state.entry && S) return; // the state card stays until a part is pointed at
    if (R === 0) {
      // Empty space: the last card stays where it was, quieter, until the next part.
      if (state.hover && !state.linger) { state.linger = true; draw(); }
      return;
    }
    if (R === 1) {
      if (state.hover) { state.hover = null; state.hoverEl = null; draw(); }
      return;
    }
    const a = areaAt(x, y);
    const changed = state.hover || (a?.id !== state.area?.id);
    state.hover = null; state.hoverEl = null;
    state.area = a;
    if (changed) draw();
    else if (chip) drawChip();
  }
  function tapEmpty(x, y) {
    // A phone's tap on nothing: riff 1 keeps the card, riff 2 clears it,
    // riff 3 names the area (and in a conversation brings the state card).
    if (R === 0) return draw();
    if (R === 1) { Object.assign(state, { hover: null, hoverEl: null, entry: false, stateHidden: false }); return draw(); }
    const a = areaAt(x, y);
    if (a?.id === 'conversation' && S) Object.assign(state, { hover: null, hoverEl: null, entry: true, stateHidden: false, area: null });
    else Object.assign(state, { hover: null, hoverEl: null, entry: false, area: a });
    return draw();
  }

  addEventListener('pointermove', (e) => {
    if (!state.on || e.pointerType === 'touch' || X.phone) return;
    document.querySelector('.xm-cursor')?.remove();
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
    if (below?.closest('[data-xm-toggle]')) return setOn(!state.on);
    if (below?.closest('.xm-strip-x')) { strip?.remove(); strip = null; return; }
    if (R === 0 && state.on && !X.phone) setHov(below);
    const t = hit(x, y);
    if (state.on && X.phone) {
      // First tap explains, a second tap on the same part does it.
      if (t && t.id === state.hover && t.el === state.hoverEl) return act(byId[t.id], t);
      if (!t) return tapEmpty(x, y);
      Object.assign(state, { hover: t.id, hoverEl: t.el, ring: null, entry: false, area: null });
      return draw();
    }
    if (t) return act(byId[t.id], t);
    // Riff 3: a click on the conversation's empty space opens its state.
    if (state.on && R === 2 && S && areaAt(x, y)?.id === 'conversation') {
      Object.assign(state, { hover: null, hoverEl: null, entry: true, stateHidden: false, area: null });
      return draw();
    }
  }
  addEventListener('click', (e) => { e.preventDefault(); press(e.clientX, e.clientY, e.target); }, true);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.on) { e.preventDefault(); setOn(false); }
    if (e.key === '?' && S) { e.preventDefault(); setOn(!state.on); }
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

  // The page's preset pointer: a named spot of the view, resolved here.
  // A path of points: the pointer comes from a neighbouring part, so riff 1's
  // lingering card shows; the last point is where the pointer rests.
  function spot(name) {
    const r = (sel, i = 0) => { const all = document.querySelectorAll(sel); const el = all[i < 0 ? all.length + i : i]; const q = el?.getBoundingClientRect(); return q && q.width ? q : null; };
    const mid = (q) => q && { x: q.left + q.width / 2, y: q.top + q.height / 2 };
    if (name === 'rivi') { const q = r('.ah-rail [data-testid="agent-link"]'); return q && [{ x: q.left + 70, y: q.top + q.height / 2 }]; }
    if (name === 'piilo') {
      // The row's end, where the hidden Arkistoi appears; where it already
      // shows (riff 2, a phone) the button itself.
      const q = r('.ah-rail [data-testid="agent-link"]');
      const shown = [...document.querySelectorAll('.ah-rail [data-testid="rail-archive-conversation"]')].find((el) => !faded(el));
      const b = shown ? mid(shown.getBoundingClientRect()) : null;
      return q && [{ x: q.left + 70, y: q.top + q.height / 2 }, b || { x: q.right - 12, y: q.top + q.height / 2 }];
    }
    if (name === 'tyhja-kentta') { const q = r('.ah-bg-strip'); const m = mid(r('.ah-bg-badges button')); return q && [m, { x: q.right - 160, y: q.top + q.height / 2 }].filter(Boolean); }
    if (name === 'tyhja-keskustelu') { const q = r('.ah-conversation-stream'); const m = mid(r('.ah-feed [data-testid="message"]', -1)); return q && [m, { x: q.left + 60, y: q.top + Math.min(160, q.height / 3) }].filter(Boolean); }
    return null;
  }
  state.entry = state.on && !!S;
  state.hover = X.hover || null;
  if (X.hover) { const t = findTarget(X.hover); if (t) { state.pt = { x: t.x + t.w / 2, y: t.y + t.h / 2 }; state.hoverEl = t.el; state.entry = false; } }
  draw();
  const path = state.on && X.pt ? spot(X.pt) : null;
  if (path?.length) {
    state.entry = false;
    const pt = path[path.length - 1];
    if (X.phone) for (const q of path) press(q.x, q.y, null);
    else {
      for (const q of path) move(q.x, q.y);
      // Show where the preset pointer is; the real pointer replaces it.
      const c = document.createElement('div');
      c.className = 'xm-cursor';
      c.style.left = `${Math.round(pt.x)}px`;
      c.style.top = `${Math.round(pt.y)}px`;
      c.innerHTML = '<svg viewBox="0 0 16 22" width="16" height="22"><path d="M1 1v17l4.5-4.2 3 6.7 2.6-1.2-3-6.6H14z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg>';
      document.body.append(c);
    }
  }
  window.XM = { state, targets, draw, setOn, hit, findTarget, under, stateRect, move, press, spot, areaAt, ids: () => [...new Set(targets().map((t) => t.id))] };
})();
