// The story engine, browser half, and the behaviour every screen shares.
// It holds no content: everything comes from the HTML that build.mjs wrote
// (story.mjs). A block's own behaviour is its blocks/<id>/client.js, which
// build.mjs appends after this file, each in its own scope.
//
// Scrolling (Jari chose "Yläreuna" on 23.11.2026, round 2026-11-23-vieritys):
// free scrolling; a step is active once its text has come within 64px of the
// line where the sticky screen's top edge rests (on the phone: the bottom
// edge of the page's sticky bar). Each text is sticky at that line inside its
// step and fades with its distance from it.
//
// Navigation (24.11.2026): on the desktop the index rail at the left edge
// (round 2026-11-24-navigaatio, "Hakemisto") fills with the steps read; on the
// phone each story is a timeline of rows that open in place, under a sticky
// bar that says whose day and which moment is under it and opens the list of
// people and capability groups (round 2026-11-24-mobiili, "Aikajana").
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wide = () => matchMedia('(min-width: 901px)').matches; // the engine's own breakpoint (page.css)

// ---------- Shared interactions (delegated, so a cloned screen works too) ----------
document.addEventListener('click', (e) => {
  // A stage's summary row opens that stage's work; the label says which way it goes.
  const st = e.target.closest('.ah-stage-toggle');
  if (st) {
    const open = st.getAttribute('aria-expanded') !== 'true';
    st.setAttribute('aria-expanded', String(open));
    st.setAttribute('aria-label', open ? st.dataset.hide : st.dataset.show);
    st.parentElement.nextElementSibling.hidden = !open;
    const pill = st.querySelector('.ah-stage-pill'); if (pill) pill.textContent = open ? 'Hide work' : 'Show work';
    return;
  }
  const disc = e.target.closest('.ah-tool-disclosure');
  if (disc) {
    const open = disc.getAttribute('aria-expanded') !== 'true';
    disc.setAttribute('aria-expanded', String(open));
    disc.nextElementSibling.hidden = !open;
    return;
  }
  const dl = e.target.closest('.ah-offer-b');
  if (dl) { const s = dl.querySelector('span'); const t = s.textContent; s.textContent = dl.dataset.done; dl.dataset.done = t; dl.classList.toggle('done'); return; }
  // Toggles inside a view (before/after, oak/black): one attribute on the view.
  const tg = e.target.closest('[data-set]');
  if (tg) {
    const host = tg.closest('[data-view]');
    host.dataset.state = tg.dataset.set;
    host.querySelectorAll('[data-set]').forEach((b) => b.setAttribute('aria-pressed', String(b === tg)));
    const lbl = host.querySelector(':not(button)[data-label]');
    if (lbl && tg.dataset.label) lbl.textContent = tg.dataset.label;
  }
});

// ---------- Story sections ----------
const stories = [];
function initStory(sec) {
  const els = [...sec.querySelectorAll(':scope > .s1-steps > .s1-step')];
  const rail = sec.querySelector('.s1-rail');
  const main = sec.querySelector('.s1-main');
  const top = sec.querySelector('.s1-top');
  const txt = els.map((s) => s.querySelector(':scope > .s1-txt'));
  const part = (i, p) => els[i].querySelector('template.s1-state').content.querySelector(`[data-part="${p}"]`)?.innerHTML;
  const screenOf = (i, sid) => {
    const k = sid && JSON.parse(els[i].dataset.rows || '{}')[sid];
    if (!k || k === 'own') return els[i].querySelector('.s1-inline').innerHTML;
    return sec.querySelector(`template.s1-scr[data-k="${k}"]`).innerHTML;
  };
  let cur = -1;
  // The screen opens at its newest content, as a conversation does.
  const anchor = () => { main.scrollTop = main.scrollHeight; };
  // Rows that change section glide to their new place (FLIP).
  const flip = (host, html) => {
    const before = new Map([...host.querySelectorAll('.rl-row')].map((r) => [r.dataset.s, r.getBoundingClientRect()]));
    host.innerHTML = html;
    if (reduced()) return;
    for (const r of host.querySelectorAll('.rl-row')) {
      const b = before.get(r.dataset.s); const a = r.getBoundingClientRect();
      if (!b) { r.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }); continue; }
      const dy = b.top - a.top;
      if (Math.abs(dy) > 1) r.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    }
  };
  const show = (i) => {
    if (i === cur) return;
    cur = i;
    els.forEach((s, j) => { s.classList.toggle('on', j === i); s.classList.toggle('past', j < i); }); // SCROLL: .past
    top.innerHTML = part(i, 'top');
    if (rail) flip(rail, part(i, 'rail'));
    main.innerHTML = screenOf(i);
    anchor();
  };
  show(0);
  // A sidebar row opens that conversation as it stood at the moment shown.
  sec.addEventListener('click', (e) => {
    const r = e.target.closest('.rl-row');
    if (r && sec.contains(r)) {
      const html = screenOf(cur, r.dataset.s);
      sec.querySelectorAll('.rl-row').forEach((x) => (x.dataset.s === r.dataset.s ? x.setAttribute('aria-current', 'true') : x.removeAttribute('aria-current')));
      main.innerHTML = html; anchor();
    }
  });
  // SCROLL: the v1 IntersectionObserver is gone; activation is in update().
  // The part of the page that is this story: a person's or group's block, or
  // for the day its intro, the steps and its end.
  const own = sec.closest('.role, .cap-g');
  const prev = sec.previousElementSibling; const next = sec.nextElementSibling;
  const first = own || (prev?.matches('.day-intro') ? prev : sec);
  const last = own || (next?.matches('.day-end') ? next : sec);
  stories.push({ sec, key: sec.dataset.story, els, txt, show, first, last, cur: () => cur });
}
document.querySelectorAll('.s1[data-story]').forEach(initStory);

// ---------- SCROLL: activation at the screen's top line ----------
// The line where a step's box rests when it is "in place": the sticky
// screen's top (its CSS `top`) on the desktop, the status bar's bottom on the
// phone. A step is active once its top is within `band` of that line. Each
// variant's band (px, or a fraction of the viewport when < 1):
//   1 Napsahdus   0.3   (phone 48, no snap there) snapping brings the step to the line; while the reader
//                       is between snap points the screen follows the step
//                       about to snap in
//   2 Kiinnitetty 2     the text swaps exactly when the next one pins
//   3 Yläreuna    64    a short activation band just under the line
const BAND = 64; // px under the line
const pnBar = document.querySelector('.pn-bar');
// The phone's line is the sticky bar's bottom edge (0 on a page without it).
const barLine = () => (pnBar ? Math.max(0, pnBar.getBoundingClientRect().bottom) : 0);
function restLine(st) {
  if (wide()) return parseFloat(getComputedStyle(st.sec.querySelector('.s1-app')).top) || 0;
  return barLine();
}
function update() {
  for (const st of stories) {
    const r = st.sec.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) continue;
    const line = restLine(st) + BAND;
    let i = 0;
    st.els.forEach((s, j) => { if (s.getBoundingClientRect().top <= line) i = j; });
    // Desktop: once more than half of the active text has been pushed above
    // the line by the next one, the next one takes over, so the text in focus
    // is never the one leaving.
    if (wide() && i + 1 < st.els.length) {
      const t = st.txt[i].getBoundingClientRect();
      const rl = restLine(st);
      if (t.height > 0 && (t.bottom - rl) / t.height < 0.5) i += 1;
    }
    st.show(i);
    // Variant 3: inactive text fades with its distance from the line, not all at once.
    if (wide()) {
      const rl = restLine(st);
      for (const s of st.els) {
        const t = s.querySelector(':scope > .s1-txt').getBoundingClientRect().top;
        const d = Math.abs(t - rl) / (innerHeight * 0.6);
        s.style.setProperty('--vr-o', String(Math.max(0.2, 1 - 0.8 * Math.min(1, d)).toFixed(3)));
      }
    } else st.els.forEach((s) => s.style.removeProperty('--vr-o'));
  }
  if (wide()) railUpdate(); else barUpdate();
}

// ---------- Navigation ----------
const storyOfStep = (step) => stories.find((s) => s.els.includes(step));
const span = (st) => ({ top: st.first.getBoundingClientRect().top, bottom: st.last.getBoundingClientRect().bottom });

// The phone's rows: a tap opens the step's text and screen in place, one open
// per story, and the tapped row keeps its place on screen.
// The browser's scroll anchoring is off meanwhile, or it would make the same
// correction a frame later and the row would jump by the closed one's height.
function setOpen(st, i, open, keep) {
  const html = document.documentElement;
  const y0 = keep?.getBoundingClientRect().top;
  html.style.overflowAnchor = 'none';
  st.els.forEach((s, j) => {
    const want = open && j === i;
    s.classList.toggle('s1-open', want);
    s.querySelector(':scope > .s1-row button')?.setAttribute('aria-expanded', String(want));
  });
  if (keep) { const d = keep.getBoundingClientRect().top - y0; if (Math.abs(d) >= 1) { selfScroll = true; scrollBy(0, d); } }
  requestAnimationFrame(() => requestAnimationFrame(() => html.style.removeProperty('overflow-anchor')));
  queue();
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('.s1-row button');
  if (!b) return;
  const step = b.closest('.s1-step'); const st = storyOfStep(step);
  setOpen(st, st.els.indexOf(step), b.getAttribute('aria-expanded') !== 'true', b);
});

// The phone's bar: whose day and which moment is under it (an open row the
// reader is looking at wins over the row at the line), and the list of people
// and capability groups it opens. The name and avatar are the list's own.
const pnWho = pnBar?.querySelector('.pn-who');
const pnMenu = pnBar?.querySelector('.pn-menu');
const pnNow = pnBar?.querySelector('.pn-now');
let barShown = null;
function barUpdate() {
  if (!pnBar) return;
  const line = barLine() + 32;
  let cur = null; let step = null;
  for (const st of stories) { const r = span(st); if (r.top <= line && r.bottom > line) cur = st; }
  if (cur) { step = cur.els[0]; for (const s of cur.els) if (s.getBoundingClientRect().top <= line) step = s; }
  for (const st of stories) for (const s of st.els) {
    if (!s.classList.contains('s1-open')) continue;
    const r = s.getBoundingClientRect();
    if (r.top < innerHeight * 0.6 && r.bottom > line) { cur = st; step = s; }
  }
  const key = cur ? `${cur.key}/${step.dataset.i}` : '';
  if (key === barShown) return;
  barShown = key;
  const item = cur && pnMenu.querySelector(`a[data-story="${cur.key}"]`);
  pnWho.querySelector('.pn-av').innerHTML = item?.querySelector('.av')?.outerHTML || '';
  pnWho.querySelector('b').textContent = item ? item.querySelector('b').textContent : 'Whose day';
  pnNow.textContent = step ? step.dataset.now : '';
  pnMenu.querySelectorAll('a[data-story]').forEach((a) => (a === item ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
}
const setMenu = (open) => { pnMenu.hidden = !open; pnWho.setAttribute('aria-expanded', String(open)); };
if (pnBar) {
  document.addEventListener('click', (e) => {
    if (e.target.closest('.pn-who')) { setMenu(pnMenu.hidden); return; }
    if (!pnMenu.hidden && !e.target.closest('.pn-menu')) setMenu(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pnMenu.hidden) { setMenu(false); pnWho.focus(); } });
}

// The desktop's rail: the current section, and per person or group how many
// of its steps are read (all once passed, none before, the active step's
// number while inside it). It comes in once the hero is past.
const navRail = document.querySelector('.ix-rail');
const hero = document.querySelector('.hero');
function railUpdate() {
  if (!navRail) return;
  navRail.dataset.shown = String(!hero || hero.getBoundingClientRect().bottom < 0);
  const y = innerHeight * 0.3;
  let secA = null;
  for (const a of navRail.querySelectorAll('.ix-sec-a')) { const el = document.getElementById(a.getAttribute('href').slice(1)); if (el && el.getBoundingClientRect().top <= y) secA = a; }
  navRail.querySelectorAll('.ix-sec-a').forEach((a) => (a === secA ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current')));
  for (const li of navRail.querySelectorAll('.ix-kid[data-story]')) {
    const st = stories.find((s) => s.key === li.dataset.story);
    if (!st) continue;
    const n = st.els.length; const r = span(st);
    const state = r.top > y ? 'next' : r.bottom < y ? 'past' : 'here';
    const done = state === 'next' ? 0 : state === 'past' ? n : Math.max(1, st.cur() + 1);
    li.dataset.state = state;
    li.style.setProperty('--p', String(done / n));
    li.querySelector('.ix-n').textContent = `${done}/${n}`;
    const a = li.firstElementChild;
    if (state === 'here') a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
  }
}

let queued = false;
const queue = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } };
addEventListener('scroll', queue, { passive: true });
addEventListener('resize', queue);
update();

// ---------- SCROLL: landing ----------
// A scroll the reader did not drive with the wheel, keys or a finger is a jump
// made for them: find-in-page, a screen reader moving its cursor. The browser
// centres what it found, which leaves the found step's text in the middle and
// (variant 2) invisible; when such a scroll ends with a step's top in the
// upper middle of the viewport, that step is moved to the line.
let lastInput = 0; let selfScroll = false;
for (const ev of ['wheel', 'keydown', 'touchstart', 'pointerdown']) addEventListener(ev, () => { lastInput = performance.now(); }, { passive: true, capture: true });
function placeStep(st, i, smooth) {
  const s = st.els[i];
  const y = scrollY + s.getBoundingClientRect().top - restLine(st);
  if (Math.abs(y - scrollY) < 1) return;
  // The placement's own scrollend is ours too, instant or smooth: clearing
  // this before it arrives would land the next step, and the next, down a
  // page of short rows.
  selfScroll = true;
  scrollTo({ top: y, behavior: smooth && !reduced() ? 'smooth' : 'auto' });
  queue();
}
addEventListener('scrollend', () => {
  if (selfScroll) { selfScroll = false; return; }
  if (performance.now() - lastInput < 700) return;
  for (const st of stories) {
    const rl = restLine(st);
    // On the phone a closed row reads where it is; only an open one, with its
    // text and screen below it, is worth moving to the bar's edge.
    const hit = st.els.findIndex((s) => { const t = s.getBoundingClientRect().top; return t > rl + 8 && t < innerHeight * 0.62 && (wide() || s.classList.contains('s1-open')); });
    if (hit >= 0) { placeStep(st, hit, true); return; }
  }
});

// ---------- Jumps ----------
// A jump made for the reader (the rail, the phone's bar and list, a
// capability line pointing at someone's day): SCROLL: the target lands at its
// scroll-margin (a step at the line, a section under the phone's bar), not
// the centre; the hash is recorded; and focus moves there, so the next Tab
// continues from the place the reader went to. On the phone a step is a row,
// so it is opened first. `#top` is the top of the page and its headline.
function jumpTo(href) {
  const top = href === '#top';
  const el = top ? document.querySelector('.hero h1') : document.getElementById(href.slice(1));
  if (!el) return false;
  if (!wide()) {
    const step = el.closest('.s1-step'); const st = step && storyOfStep(step);
    if (st) setOpen(st, st.els.indexOf(step), true);
  }
  const smooth = !reduced();
  const y = top ? 0 : scrollY + el.getBoundingClientRect().top - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
  if (Math.abs(y - scrollY) > 1) {
    selfScroll = smooth;
    scrollTo({ top: Math.max(0, y), behavior: smooth ? 'smooth' : 'auto' });
  }
  history.pushState(null, '', top ? location.pathname + location.search : href);
  // Focus: on the phone a story's first row, otherwise the target itself.
  const f = (!wide() && !el.matches('.s1-step') && el.querySelector('.s1-row button')) || el;
  if (!f.matches('a, button, [tabindex]')) f.setAttribute('tabindex', '-1');
  f.focus({ preventScroll: true });
  queue();
  return true;
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-jump], a.cap-role');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (pnMenu && !pnMenu.hidden) setMenu(false);
  if (jumpTo(a.getAttribute('href'))) e.preventDefault();
});
// Arriving at a step's address on the phone opens its row.
if (!wide() && /^#g-/.test(location.hash)) {
  const step = document.getElementById(location.hash.slice(1));
  const st = step && storyOfStep(step);
  if (st) { setOpen(st, st.els.indexOf(step), true); step.scrollIntoView({ block: 'start' }); }
}
