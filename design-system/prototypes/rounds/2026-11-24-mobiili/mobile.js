// ---- rounds/2026-11-24-mobiili/mobile.js ----
// The phone layer over the landing page v1. The page below it is the v1
// render with the v1 engine running; this file only rearranges it while the
// viewport is at most 900px wide, and takes every change back when it is not
// (or when the picker switches variant). It holds no content: people, times,
// asks and result lines are read from the HTML the engine wrote. Nodes are
// moved, never cloned, so the engine's and the blocks' listeners stay on them.
//
//   1 Valinta         a chooser after the hero; a day opens as its own view,
//                     one step at a time
//   2 Pyyhkäisy       each day a horizontal deck of step cards, a person
//                     switcher and step indicator on top, install at the bottom
//   3 Aikajana        each day a timeline of rows; a row opens its screen
(() => {
  const root = document.documentElement;
  const PHONE = matchMedia('(max-width: 900px)');
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smooth = () => (still() ? 'auto' : 'smooth');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const pg = $('.pg');

  // ---------- Everything a layer does is undone in reverse ----------
  let undo = [];
  const U = (fn) => undo.push(fn);
  const ins = (el, parent, before = null) => { parent.insertBefore(el, before); U(() => el.remove()); return el; };
  const mv = (el, parent, before = null) => { const p = el.parentNode; const n = el.nextSibling; parent.insertBefore(el, before); U(() => p.insertBefore(el, n)); };
  const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); U(() => t.removeEventListener(ev, fn, o)); };
  const sweep = (...names) => U(() => { for (const n of names) $$(`.${n}`).forEach((e) => e.classList.remove(n)); });
  const onScroll = (fn) => { let q = false; const run = () => { if (!q) { q = true; requestAnimationFrame(() => { q = false; fn(); }); } }; on(window, 'scroll', run, { passive: true }); on(window, 'resize', run); };

  // ---------- The stories, read from the page ----------
  // { id, kind: day|role|cap, name, title, sub, color, sec (.s1), boxes (what
  //   is this story on the page), steps: [{ el, time, ask, tag, line, state, turn, run }] }
  function readStories() {
    const step = (el) => {
      const st = el.querySelector('template.s1-state').content;
      const cur = st.querySelector('[data-part="rail"] .rl-row[aria-current]');
      const n = (k) => parseInt(st.querySelector(`[data-part="chips"] .c-${k}`)?.textContent, 10) || 0;
      return { el, time: el.querySelector('.s1-when .when > b')?.textContent || '', ask: el.querySelector('.ask').textContent.replace(/^“|”$/g, ''), tag: el.querySelector('.cap-tag')?.textContent || '', line: cur?.querySelector('.rl-l').textContent || '', state: (cur?.className.match(/rl-(turn|run|quiet)/) || [])[1] || '', turn: n('turn'), run: n('run') };
    };
    const steps = (sec) => $$(':scope > .s1-steps > .s1-step', sec).map(step);
    const out = [];
    const day = $('.pg > .s1[data-story]') || $('.m2-days > .s1[data-story]');
    const intro = $('#day'); const top = day.querySelector('template.s1-state').content;
    out.push({ id: day.dataset.story, kind: 'day', name: top.querySelector('[data-part="top"] b').textContent, title: intro.querySelector('h2').textContent.replace(/\.$/, ''), sub: intro.querySelector('.kicker').textContent, color: top.querySelector('.av').style.getPropertyValue('--av'), sec: day, boxes: [intro, day, $('.day-end')], steps: steps(day) });
    for (const r of $$('.roles > .role')) {
      const name = r.querySelector('.role-h h3').textContent;
      out.push({ id: r.id.replace(/^role-/, ''), kind: 'role', name, title: `${name}’s Thursday`, sub: r.querySelector('.role-k').textContent.split(' · ')[0], color: r.querySelector('.role-h .av').style.getPropertyValue('--av'), sec: r.querySelector('.s1'), boxes: [r], steps: steps(r.querySelector('.s1')) });
    }
    const counts = Object.fromEntries($$('.cap-nav a').map((a) => [a.getAttribute('href').slice(1), a.querySelector('b').textContent]));
    for (const g of $$('.caps > .cap-g')) {
      const sec = g.querySelector('.s1'); if (!sec) continue;
      const name = g.querySelector('.cap-gh h3').textContent;
      out.push({ id: g.id, kind: 'cap', name, title: name, sub: `${counts[g.id] || ''} examples`.trim(), color: '', sec, boxes: [g], steps: steps(sec) });
    }
    return out;
  }
  const av = (s, px) => `<span class="av" style="--av:${s.color}; --px:${px}px" aria-hidden="true">${esc(s.name[0])}</span>`;
  const navLinks = () => { const a = $$('.top nav a'); return { docs: a.find((x) => /docs/i.test(x.textContent))?.getAttribute('href') || '/docs/', repo: a.at(-1).getAttribute('href') }; };
  const ctaStrip = () => { const l = navLinks(); return `<p class="mb-cta"><a class="btn" href="#install">Install on your server</a><a href="${esc(l.docs)}">Docs</a><a href="${esc(l.repo)}">GitHub</a></p>`; };
  // Where an in-page link points: a story (and step), or just an element.
  const resolve = (M, id) => {
    const el = id && document.getElementById(id);
    if (!el) return null;
    for (const s of M) { const i = s.steps.findIndex((st) => st.el === el); if (i >= 0) return { s, i }; if (s.boxes.includes(el)) return { s, i: 0 }; }
    return { el };
  };
  const hashLink = (e) => { const a = e.target.closest?.('a[href^="#"]'); return a && !a.closest('.proto-picker') ? a : null; };

  // =====================================================================
  // 1 Valinta: hub and spoke
  // =====================================================================
  function mount1(M) {
    const people = M.filter((s) => s.kind !== 'cap'); const caps = M.filter((s) => s.kind === 'cap');
    const bar = ins(h(`<header class="m1-bar">
      <a class="m1-brand brandword" href="#">${$('.top .brandword').innerHTML}</a>
      <button type="button" class="m1-back" hidden aria-label="Back to choosing whose day"><span aria-hidden="true">‹</span> Choose</button>
      <p class="m1-title" aria-live="polite" hidden></p>
      <a class="m1-days" href="#day">Whose day?</a>
      <a class="m1-install" href="#install">Install</a></header>`), pg, pg.firstChild);
    const card = (s) => `<li><button type="button" class="m1-card" data-open="${s.id}">${av(s, 40)}<span class="m1-c"><b>${esc(s.title)}</b><span class="m1-c-k">${esc(s.sub)}</span></span><span class="m1-c-m">${s.steps.length} moments<br>${s.steps[0].time}–${s.steps.at(-1).time}</span></button></li>`;
    const home = ins(h(`<section class="m1-choose" id="m1-people" aria-labelledby="m1-people-h">
      <h2 id="m1-people-h" tabindex="-1">Whose day?</h2>
      <p>One Thursday at Example Studio. Pick a person.</p>
      <ul class="m1-list m1-people">${people.map(card).join('')}</ul></section>`), pg, $('#day'));
    ins(h(`<div class="m1-choose m1-capchoose"><ul class="m1-list m1-caps" aria-label="Capability groups">${caps.map((s) => `<li><button type="button" class="m1-card" data-open="${s.id}"><span class="m1-c"><b>${esc(s.name)}</b><span class="m1-c-m">${esc(s.sub)}</span></span></button></li>`).join('')}</ul>${ctaStrip()}</div>`), $('.caps'), $('.caps > .cap-g'));
    const end = ins(h(`<div class="m1-end">${ctaStrip()}</div>`), pg);
    const pager = ins(h('<nav class="m1-pager" aria-label="Steps of this day"><button type="button" class="m1-prev">‹ Previous</button><span class="m1-prog" aria-hidden="true"></span><button type="button" class="m1-next"></button></nav>'), pg);
    const back = $('.m1-back', bar); const title = $('.m1-title', bar); const brand = $('.m1-brand', bar); const toDays = $('.m1-days', bar);
    sweep('m1-off', 'm1-cur');
    U(() => { delete root.dataset.m1; delete root.dataset.m1First; delete root.dataset.m1Last; });

    let cur = null; let idx = 0;
    const pageTop = () => pg.getBoundingClientRect().top + scrollY;
    function paint() {
      const n = cur.steps.length; const next = M[M.indexOf(cur) + 1];
      cur.steps.forEach((st, j) => st.el.classList.toggle('m1-cur', j === idx));
      root.toggleAttribute('data-m1-first', idx === 0); root.toggleAttribute('data-m1-last', idx === n - 1);
      title.textContent = `${cur.title} · ${idx + 1} / ${n}`;
      $('.m1-prog', pager).innerHTML = cur.steps.map((_, j) => `<i${j <= idx ? ' class="on"' : ''}></i>`).join('');
      $('.m1-prev', pager).disabled = idx === 0;
      $('.m1-next', pager).textContent = idx < n - 1 ? 'Next ›' : next ? `${next.name} ›` : 'Install ›';
      $('.m1-next', pager).setAttribute('aria-label', idx < n - 1 ? 'Next step' : next ? `Next: ${next.title}` : 'Install on your server');
    }
    function open(s, i = 0, { push = true, focus = true } = {}) {
      $$('.m1-off').forEach((e) => e.classList.remove('m1-off')); $$('.m1-cur').forEach((e) => e.classList.remove('m1-cur'));
      const was = cur; cur = s; idx = Math.max(0, Math.min(s.steps.length - 1, i));
      // Only this story's boxes, their ancestors and the layer's own chrome stay.
      const keep = new Set([bar, pager, end]);
      for (const b of s.boxes) for (let e = b; e && e !== pg; e = e.parentElement) keep.add(e);
      for (const e of [...keep]) if (e.parentElement && e.parentElement !== pg.parentElement) for (const sib of e.parentElement.children) if (!keep.has(sib) && e.parentElement !== document.body) sib.classList.add('m1-off');
      root.dataset.m1 = s.id;
      back.hidden = false; title.hidden = false; brand.hidden = true; toDays.hidden = true;
      paint();
      const url = `#/${s.id}/${idx + 1}`;
      if (push && !was) history.pushState(null, '', url); else history.replaceState(null, '', url);
      scrollTo(0, pageTop());
      if (focus) { const a = s.steps[idx].el.querySelector('.ask'); a.tabIndex = -1; a.focus({ preventScroll: true }); }
    }
    function close({ to = null, replace = true } = {}) {
      const was = cur; cur = null;
      $$('.m1-off').forEach((e) => e.classList.remove('m1-off')); $$('.m1-cur').forEach((e) => e.classList.remove('m1-cur'));
      delete root.dataset.m1; root.removeAttribute('data-m1-first'); root.removeAttribute('data-m1-last');
      back.hidden = true; title.hidden = true; brand.hidden = false; toDays.hidden = false; title.textContent = '';
      if (replace) history.replaceState(null, '', location.pathname + location.search);
      if (to) to.scrollIntoView({ block: 'start' });
      else if (was) { home.scrollIntoView({ block: 'start' }); $(`.m1-card[data-open="${was.id}"]`)?.focus({ preventScroll: true }); }
    }
    const byId = (id) => M.find((s) => s.id === id);
    on(document, 'click', (e) => {
      const c = e.target.closest('.m1-card'); if (c) { open(byId(c.dataset.open)); return; }
      if (e.target.closest('.m1-back')) { close(); return; }
      if (e.target.closest('.m1-prev')) { if (idx > 0) open(cur, idx - 1); return; }
      if (e.target.closest('.m1-next')) {
        if (idx < cur.steps.length - 1) open(cur, idx + 1);
        else { const next = M[M.indexOf(cur) + 1]; if (next) open(next, 0); else close({ to: $('#install') }); }
      }
    });
    // In-page links: a day or a step opens as a story; the hero's "See a day"
    // and the top go to the chooser; anything else leaves the story first.
    on(document, 'click', (e) => {
      const a = hashLink(e); if (!a) return;
      const id = a.getAttribute('href').slice(1);
      const hit = id === 'day' || id === 'roles' ? { el: home } : id === '' ? { el: pg } : resolve(M, id);
      if (!hit) return;
      e.preventDefault(); e.stopPropagation();
      if (hit.s) open(hit.s, hit.i);
      else { if (cur) close(); hit.el.scrollIntoView({ block: 'start', behavior: smooth() }); if (hit.el === home) $('h2', home).focus({ preventScroll: true }); }
    }, true);
    const fromHash = () => { const m = location.hash.match(/^#\/([\w-]+)\/(\d+)$/); const s = m && byId(m[1]); if (s) open(s, m[2] - 1, { push: false, focus: false }); else if (cur) close({ replace: false }); };
    on(window, 'popstate', fromHash);
    fromHash();
    if (!cur && location.hash.length > 1) { const hit = resolve(M, location.hash.slice(1)); if (hit?.s) open(hit.s, hit.i, { push: false, focus: false }); }
  }

  // =====================================================================
  // 2 Pyyhkäisy: a deck per story
  // =====================================================================
  function mount2(M) {
    const alice = M[0];
    const days = ins(h('<div class="m2-days" id="m2-days"></div>'), pg, $('#day'));
    mv($('#day'), days); mv(alice.sec, days); mv($('.roles'), days);
    const groups = [{ key: 'days', label: 'Whose day', list: M.filter((s) => s.kind !== 'cap') }, { key: 'caps', label: 'Capability groups', list: M.filter((s) => s.kind === 'cap') }];
    const groupOf = (s) => groups.find((g) => g.list.includes(s));
    for (const g of groups) {
      g.sw = h(`<div class="m2-sw m2-sw-${g.key}"><div class="m2-chips" role="group" aria-label="${g.label}">${g.list.map((s) => `<button type="button" class="m2-chip" data-id="${s.id}" aria-pressed="false" aria-label="${esc(s.title)}">${s.kind === 'cap' ? '' : av(s, 28)}<span>${esc(s.name)}</span></button>`).join('')}</div><div class="m2-ind"><button type="button" class="m2-prev" aria-label="Previous step">‹</button><p class="m2-pos" aria-live="polite"></p><button type="button" class="m2-next" aria-label="Next step">›</button><span class="m2-segs" aria-hidden="true"></span></div></div>`);
      g.cur = g.list[0];
    }
    // A sticky bar's own box says where it is stuck, not where its section
    // starts; a mark in front of it does.
    for (const [g, parent, before] of [[groups[0], days, days.firstChild], [groups[1], $('.caps'), $('.caps > .cap-g')]]) { g.mark = ins(h('<span class="m2-mark" aria-hidden="true"></span>'), parent, before); ins(g.sw, parent, before); }
    const PAD = 16;
    M.forEach((s, k) => {
      s.deck = s.sec.querySelector('.s1-steps');
      const next = M[k + 1];
      const end = ins(h(`<article class="m2-end"><div class="m2-end-b"><p class="m2-end-t">End of ${esc(s.title)}</p></div><p class="m2-end-a">${next ? `<button type="button" class="btn ghost m2-go" data-id="${next.id}">Next: ${esc(next.title)}</button>` : ''}<a class="btn" href="#install">Install on your server</a></p></article>`), s.deck);
      if (s === alice) { end.querySelector('.m2-end-t').remove(); mv($('.day-end'), end.querySelector('.m2-end-b')); }
      for (const st of s.steps) ins(h('<button type="button" class="m2-more" aria-expanded="false">Show the whole screen</button>'), st.el, st.el.querySelector('.s1-inline'));
      s.cards = [...s.steps.map((st) => st.el), end];
      s.at = 0;
      let q = false;
      on(s.deck, 'scroll', () => { if (!q) { q = true; requestAnimationFrame(() => { q = false; track(s); }); } }, { passive: true });
    });
    const cta = ins(h('<div class="m2-cta"><button type="button" class="m2-who">Whose day?</button><a class="btn" href="#install">Install on your server</a></div>'), pg);
    sweep('m2-on', 'm2-open');

    const left = (s, i) => s.cards[i].offsetLeft - PAD;
    function paint(g) {
      const s = g.cur; const n = s.steps.length; const i = s.at;
      const txt = `<b>${esc(s.title)}</b> · ${i < n ? `${i + 1} / ${n}` : 'end'}`;
      const pos = $('.m2-pos', g.sw); if (pos.innerHTML !== txt) pos.innerHTML = txt;
      $('.m2-segs', g.sw).innerHTML = s.steps.map((_, j) => `<i${j <= i ? ' class="on"' : ''}></i>`).join('');
      $('.m2-prev', g.sw).disabled = i === 0; $('.m2-next', g.sw).disabled = i === n;
    }
    const setOpen = (el, open) => { el.classList.toggle('m2-open', open); const b = el.querySelector('.m2-more'); b.setAttribute('aria-expanded', String(open)); b.textContent = open ? 'Show less' : 'Show the whole screen'; };
    function track(s) {
      const x = s.deck.scrollLeft; let i = 0;
      s.cards.forEach((c, j) => { if (Math.abs(c.offsetLeft - PAD - x) < Math.abs(left(s, i) - x)) i = j; });
      if (i === s.at) return;
      s.at = i;
      // A card left behind closes; if that shortens the deck under the reader, the deck's top comes back.
      const openOnes = s.steps.filter((st, j) => j !== i && st.el.classList.contains('m2-open'));
      if (openOnes.length) { openOnes.forEach((st) => setOpen(st.el, false)); const g = groupOf(s); const t = s.deck.getBoundingClientRect().top; const b = g.sw.getBoundingClientRect().bottom; if (t < b) scrollBy(0, t - b); }
      if (groupOf(s).cur === s) paint(groupOf(s));
      clearOfBars(s);
    }
    // Keyboard focus inside a deck stays between the bar on top and the bar
    // at the bottom, also after a card closing has moved it.
    function clearOfBars(s) {
      const a = document.activeElement;
      if (!a || !s.deck.contains(a) || !a.matches(':focus-visible')) return;
      const r = a.getBoundingClientRect(); const top = groupOf(s).sw.getBoundingClientRect().bottom + 8; const bottom = cta.getBoundingClientRect().top - 8;
      if (r.bottom > bottom) scrollBy(0, r.bottom - bottom); else if (r.top < top) scrollBy(0, r.top - top);
    }
    function select(s, { i = 0, scroll = false } = {}) {
      const g = groupOf(s); g.cur = s;
      for (const x of g.list) for (const b of x.boxes) b.classList.toggle('m2-on', x === s);
      $$('.m2-chip', g.sw).forEach((c) => { const me = c.dataset.id === s.id; c.setAttribute('aria-pressed', String(me)); if (me) { const row = c.parentElement; row.scrollTo({ left: c.offsetLeft - row.clientWidth / 2 + c.offsetWidth / 2 }); } });
      s.steps.forEach((st) => setOpen(st.el, false));
      s.at = Math.max(0, Math.min(s.cards.length - 1, i));
      s.deck.scrollLeft = left(s, s.at);
      paint(g);
      const top = g.mark.getBoundingClientRect().top;
      if (scroll || top < 0) scrollTo({ top: top + scrollY, behavior: scroll ? smooth() : 'auto' });
    }
    const go = (s, i) => s.deck.scrollTo({ left: left(s, i), behavior: smooth() });
    const byId = (id) => M.find((s) => s.id === id);
    on(document, 'click', (e) => {
      const chip = e.target.closest('.m2-chip'); if (chip) { select(byId(chip.dataset.id)); return; }
      const nx = e.target.closest('.m2-go'); if (nx) { select(byId(nx.dataset.id), { scroll: true }); $(`.m2-chip[data-id="${nx.dataset.id}"]`).focus({ preventScroll: true }); return; }
      const ar = e.target.closest('.m2-prev, .m2-next'); if (ar) { const s = groups.find((g) => g.sw.contains(ar)).cur; go(s, Math.max(0, Math.min(s.cards.length - 1, s.at + (ar.matches('.m2-next') ? 1 : -1)))); return; }
      const more = e.target.closest('.m2-more'); if (more) { const el = more.closest('.s1-step'); setOpen(el, !el.classList.contains('m2-open')); return; }
      if (e.target.closest('.m2-who')) { select(groups[0].cur, { i: groups[0].cur.at, scroll: true }); $('.m2-chip[aria-pressed="true"]', groups[0].sw).focus({ preventScroll: true }); }
    });
    // A control reached by keyboard inside a clipped screen opens the screen.
    on(document, 'focusin', (e) => { const inl = e.target.closest?.('.s1-inline'); const st = inl?.closest('.s1-step'); if (st && !st.classList.contains('m2-open') && e.target.matches(':focus-visible')) setOpen(st, true); const deck = e.target.closest?.('.s1-steps'); const s = deck && M.find((x) => x.deck === deck); if (s) requestAnimationFrame(() => clearOfBars(s)); });
    on(document, 'click', (e) => {
      const a = hashLink(e); if (!a) return;
      const hit = resolve(M, a.getAttribute('href').slice(1));
      if (!hit?.s) return;
      e.preventDefault(); e.stopPropagation();
      select(hit.s, { i: hit.i, scroll: true });
    }, true);
    for (const g of groups) select(g.cur);
    const hit = location.hash.length > 1 && resolve(M, location.hash.slice(1));
    if (hit?.s) select(hit.s, { i: hit.i, scroll: true });
  }

  // =====================================================================
  // 3 Aikajana: rows that open
  // =====================================================================
  function mount3(M) {
    const people = M.filter((s) => s.kind !== 'cap'); const caps = M.filter((s) => s.kind === 'cap');
    for (const s of M) for (const st of s.steps) {
      const chip = st.line ? `<span class="m3-chip m3-${st.state}">${esc(st.line)}</span>` : `<span class="m3-chip m3-tag">${esc(st.tag)}</span>`;
      st.row = ins(h(`<h3 class="m3-h"><button type="button" class="m3-row" aria-expanded="false"><span class="m3-time">${esc(st.time)}</span>${chip}<span class="m3-ask">“${esc(st.ask)}”</span><span class="m3-chev" aria-hidden="true"></span></button></h3>`), st.el, st.el.firstChild).firstElementChild;
    }
    const item = (s) => `<li><button type="button" data-go="${s.id}">${s.kind === 'cap' ? '' : av(s, 28)}<span><b>${esc(s.name)}</b><small>${esc(s.sub)}</small></span></button></li>`;
    const bar = ins(h(`<div class="m3-bar">
      <a class="m3-mark" href="#" aria-label="Open Habitat, top of the page">${$('.top .brandword .oh-mark').outerHTML}</a>
      <button type="button" class="m3-who" aria-expanded="false" aria-controls="m3-menu"><span class="m3-av"></span><b>Whose day</b><span class="m3-car" aria-hidden="true"></span></button>
      <span class="m3-now"></span>
      <a class="m3-install" href="#install">Install</a>
      <nav id="m3-menu" class="m3-menu" aria-label="Days and capabilities" hidden><ul class="m3-people">${people.map(item).join('')}</ul><p class="m3-menu-h">What it can do</p><ul class="m3-caps">${caps.map(item).join('')}</ul>${ctaStrip()}</nav></div>`), pg, pg.firstChild);
    ins(h(ctaStrip()), pg, $('.pg > .roles'));
    ins(h(ctaStrip()), pg, $('.pg > .caps'));
    sweep('m3-open');
    const who = $('.m3-who', bar); const menu = $('.m3-menu', bar); const now = $('.m3-now', bar);
    const setMenu = (open) => { menu.hidden = !open; who.setAttribute('aria-expanded', String(open)); };
    function setOpen(s, st, open, keep) {
      const y0 = keep?.getBoundingClientRect().top;
      for (const o of s.steps) { const want = o === st && open; o.el.classList.toggle('m3-open', want); o.row.setAttribute('aria-expanded', String(want)); }
      if (keep) scrollBy(0, keep.getBoundingClientRect().top - y0);
      track();
    }
    // The bar says whose day is under it and which moment: the open row if
    // there is one in this story, otherwise the row at the line under the bar.
    let shown = '';
    function track() {
      const line = bar.getBoundingClientRect().bottom + 32;
      let s = null; let st = null;
      for (const x of M) if (x.boxes[0].getBoundingClientRect().top <= line && x.boxes.at(-1).getBoundingClientRect().bottom > line) s = x;
      if (s) { st = s.steps[0]; for (const o of s.steps) if (o.el.getBoundingClientRect().top <= line) st = o; }
      // An open row the reader is looking at wins over the row at the line.
      for (const x of M) for (const o of x.steps) if (o.el.classList.contains('m3-open')) { const r = o.el.getBoundingClientRect(); if (r.top < innerHeight * 0.6 && r.bottom > line) { s = x; st = o; } }
      const key = s ? `${s.id}/${s.steps.indexOf(st)}` : '';
      if (key === shown) return;
      shown = key;
      $('.m3-av', who).innerHTML = s && s.kind !== 'cap' ? av(s, 26) : '';
      $('b', who).textContent = s ? s.name : 'Whose day';
      now.textContent = !s ? '' : s.kind === 'cap' ? st.tag : `${st.time} · ${st.turn ? `${st.turn} waiting` : st.run ? `${st.run} running` : 'all quiet'}`;
      $$('[data-go]', menu).forEach((b) => (b.dataset.go === s?.id ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
    }
    onScroll(track); track();
    const stepOf = (el) => { for (const s of M) for (const st of s.steps) if (st.el === el) return [s, st]; return null; };
    on(document, 'click', (e) => {
      const row = e.target.closest('.m3-row');
      if (row) { const [s, st] = stepOf(row.closest('.s1-step')); setOpen(s, st, row.getAttribute('aria-expanded') !== 'true', row); return; }
      if (e.target.closest('.m3-who')) { setMenu(menu.hidden); return; }
      const goBtn = e.target.closest('.m3-menu [data-go]');
      if (goBtn) { const s = M.find((x) => x.id === goBtn.dataset.go); setMenu(false); s.boxes[0].scrollIntoView({ block: 'start', behavior: smooth() }); s.steps[0].row.focus({ preventScroll: true }); return; }
      if (!menu.hidden && !e.target.closest('.m3-menu')) setMenu(false);
    });
    on(document, 'keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); who.focus(); } });
    // A link to a step opens that row before the page scrolls to it.
    on(document, 'click', (e) => {
      const a = hashLink(e); if (!a) return;
      if (a.closest('.m3-menu')) setMenu(false);
      const hit = resolve(M, a.getAttribute('href').slice(1));
      if (hit?.s && a.getAttribute('href').startsWith('#g-')) setOpen(hit.s, hit.s.steps[hit.i], true);
    }, true);
    const hit = location.hash.startsWith('#g-') && resolve(M, location.hash.slice(1));
    if (hit?.s) { setOpen(hit.s, hit.s.steps[hit.i], true); hit.s.steps[hit.i].el.scrollIntoView({ block: 'start' }); }
  }

  // ---------- Mounting ----------
  const LAYERS = [mount1, mount2, mount3];
  let v = +root.dataset.v || 1;
  function remount() {
    while (undo.length) undo.pop()();
    root.classList.remove('mb-on');
    if (!PHONE.matches) return;
    root.classList.add('mb-on');
    // The engine's landing (a scroll nobody drove ends with a step in the
    // upper middle: move it to the line) would pull a step under this layer's
    // own bar after every scroll the layer makes. Off while a layer is on.
    on(window, 'scrollend', (e) => e.stopPropagation(), true);
    LAYERS[v - 1](readStories());
  }
  PHONE.addEventListener('change', remount);
  window.MOBIILI = {
    // The picker's mount(): the layer is taken off and put back on, so a
    // variant always starts from the page as v1 rendered it.
    mount(n) {
      v = n; root.dataset.v = n;
      const line = $('.mb-line'); if (line && window.VARIANTS) line.textContent = window.VARIANTS[n - 1][1];
      if (/^#\/[\w-]+\/\d+$/.test(location.hash) && n !== 1) history.replaceState(null, '', location.pathname + location.search);
      remount();
    },
  };
})();
