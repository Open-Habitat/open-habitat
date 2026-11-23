// The story engine's browser half with the scroll mechanism rewritten: the
// landing page v1's engine/client.js, unchanged except where marked "SCROLL".
// The v1 engine activated a step when it crossed the middle band of the
// viewport (IntersectionObserver, rootMargin -45%) while the sticky screen
// sat at the top, so the text in focus sat below the screen's top edge. Here
// a step is active when its top has reached the line where the screen's top
// edge rests (on the phone: the sticky status bar's bottom edge), plus a
// variant's band; each variant's scroll.css decides how the text gets to that
// line. A picker switches variants (html[data-v]); build.mjs sets
// window.VARIANTS.
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
  const bar = sec.querySelector('.s1-bar');
  const drop = sec.querySelector('.s1-drop');
  const tog = sec.querySelector('.s1-tog');
  const part = (i, p) => els[i].querySelector('template.s1-state').content.querySelector(`[data-part="${p}"]`)?.innerHTML;
  const screenOf = (i, sid) => {
    const k = sid && JSON.parse(els[i].dataset.rows || '{}')[sid];
    if (!k || k === 'own') return els[i].querySelector('.s1-inline').innerHTML;
    return sec.querySelector(`template.s1-scr[data-k="${k}"]`).innerHTML;
  };
  // SCROLL: the step's text (time, ask, story, hand, count) in one box, so it
  // can be pinned beside the screen as a unit. In the port, story.mjs writes
  // this <div class="s1-txt"> itself.
  for (const s of els) {
    const txt = document.createElement('div');
    txt.className = 's1-txt';
    s.prepend(txt);
    for (const c of [...s.children]) if (c !== txt && !c.matches('.s1-inline, template')) txt.append(c);
  }
  // SCROLL: where we are, beside the screen (desktop) and in the status bar
  // (phone). Shown only by the pinned-caption variant; aria-hidden because the
  // steps themselves are read in order.
  const n = els.length;
  const count = document.createElement('div');
  count.className = 'vr-count'; count.setAttribute('aria-hidden', 'true');
  count.innerHTML = `<span class="vr-num"><b>1</b> / ${n}</span><span class="vr-ticks">${'<i></i>'.repeat(n)}</span>`;
  sec.append(count); // a grid item beside the steps (scroll.css), not among them: the engine's :first-child/:last-child rules stay true
  let cap = null;
  if (bar) {
    cap = document.createElement('div');
    cap.className = 'vr-cap'; cap.setAttribute('aria-hidden', 'true');
    bar.insertBefore(cap, drop);
  }
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
    if (bar) {
      bar.querySelector('.s1-bar-row > .av').outerHTML = part(i, 'av');
      bar.querySelector('.s1-bar-row > .when').outerHTML = part(i, 'when');
      tog.innerHTML = part(i, 'chips');
      flip(drop, part(i, 'rail'));
    }
    // SCROLL: the counter and the phone's caption follow the step.
    count.querySelector('b').textContent = i + 1;
    count.querySelectorAll('.vr-ticks i').forEach((t, j) => t.classList.toggle('on', j <= i));
    if (cap) {
      cap.innerHTML = `<span class="vr-n">${i + 1} / ${n}</span><span class="vr-ask">${els[i].querySelector('.ask').innerHTML}</span>`;
      if (!reduced()) cap.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'ease-out' });
    }
  };
  show(0);
  // A sidebar row opens that conversation as it stood at the moment shown.
  sec.addEventListener('click', (e) => {
    const r = e.target.closest('.rl-row');
    if (r && sec.contains(r)) {
      const html = screenOf(cur, r.dataset.s);
      sec.querySelectorAll('.rl-row').forEach((x) => (x.dataset.s === r.dataset.s ? x.setAttribute('aria-current', 'true') : x.removeAttribute('aria-current')));
      if (r.closest('.s1-drop')) {
        const host = els[cur].querySelector('.s1-inline'); host.innerHTML = html;
        drop.hidden = true; tog.setAttribute('aria-expanded', 'false');
        host.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
      } else { main.innerHTML = html; anchor(); }
      return;
    }
    if (tog && e.target.closest('.s1-tog') === tog) { const open = drop.hidden; drop.hidden = !open; tog.setAttribute('aria-expanded', String(open)); }
  });
  // SCROLL: the v1 IntersectionObserver is gone; activation is in update().
  stories.push({ sec, els, bar, show, cur: () => cur });
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
const BAND = { 1: [0.3, 48], 2: [2, 24], 3: [64, 48] };
const variant = () => +document.documentElement.dataset.v || 1;
const px = (b) => (b < 1 ? b * innerHeight : b);
function restLine(st) {
  if (wide()) return parseFloat(getComputedStyle(st.sec.querySelector('.s1-app')).top) || 0;
  return st.bar ? st.bar.getBoundingClientRect().bottom : 0;
}
function update() {
  const v = variant();
  const [bd, bp] = BAND[v];
  // The phone's step is placed below the bar by scroll-margin; keep it measured.
  const b0 = stories.find((s) => s.bar)?.bar;
  if (b0) document.documentElement.style.setProperty('--vr-bar', `${Math.round(b0.offsetHeight)}px`);
  for (const st of stories) {
    const r = st.sec.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) continue;
    const line = restLine(st) + px(wide() ? bd : bp);
    let i = 0;
    st.els.forEach((s, j) => { if (s.getBoundingClientRect().top <= line) i = j; });
    st.show(i);
    // Variant 3: inactive text fades with its distance from the line, not all at once.
    if (v === 3 && wide()) {
      const rl = restLine(st);
      for (const s of st.els) {
        const t = s.firstElementChild.getBoundingClientRect().top;
        const d = Math.abs(t - rl) / (innerHeight * 0.6);
        s.style.setProperty('--vr-o', String(Math.max(0.2, 1 - 0.8 * Math.min(1, d)).toFixed(3)));
      }
    } else st.els.forEach((s) => s.style.removeProperty('--vr-o'));
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
  selfScroll = true;
  scrollTo({ top: y, behavior: smooth && !reduced() ? 'smooth' : 'auto' });
  if (!smooth || reduced()) { selfScroll = false; queue(); }
}
addEventListener('scrollend', () => {
  if (selfScroll) { selfScroll = false; return; }
  if (performance.now() - lastInput < 700) return;
  for (const st of stories) {
    const rl = restLine(st);
    const hit = st.els.findIndex((s) => { const t = s.getBoundingClientRect().top; return t > rl + 8 && t < innerHeight * 0.62; });
    if (hit >= 0) { placeStep(st, hit, true); return; }
  }
});

// A capability line that points at someone's day scrolls there: SCROLL: to
// the step's place at the line (scroll-margin-top in scroll.css), not the centre.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a.cap-role');
  if (!a) return;
  const el = document.getElementById(a.getAttribute('href').slice(1));
  if (!el) return;
  e.preventDefault();
  history.pushState(null, '', a.getAttribute('href'));
  selfScroll = true;
  el.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
  if (reduced()) { selfScroll = false; queue(); }
});

// ---------- Prototype harness: the variant picker (PICKER.md, verbatim behaviour) ----------
{
  const picker = document.querySelector('.proto-picker');
  const highlight = picker.querySelector('.proto-picker-highlight');
  const items = [...picker.querySelectorAll('.proto-picker-item:not(.proto-picker-replay)')];
  const VARIANTS = window.VARIANTS;
  let current = 0;
  function moveHighlight() {
    const el = items[current];
    highlight.style.width = el.offsetWidth + 'px';
    highlight.style.transform = `translateX(${el.offsetLeft}px)`;
  }
  // "Mounting" a variant here is switching the scroll mechanism under the same
  // page; the step the reader is at stays the step they are at.
  function mount(i) {
    const st = stories.find((s) => { const r = s.sec.getBoundingClientRect(); return r.top < innerHeight * 0.5 && r.bottom > innerHeight * 0.5; });
    const at = st ? st.cur() : -1;
    document.documentElement.dataset.v = i + 1;
    document.querySelector('.vr-line').textContent = VARIANTS[i][1];
    if (st && at >= 0) placeStep(st, at, false);
    queue();
  }
  function setActive(i) {
    if (i < 0 || i >= VARIANTS.length) return;
    current = i;
    items.forEach((el, j) => {
      el.toggleAttribute('data-active', j === i);
      if (j === i) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
    });
    moveHighlight();
    const url = new URL(location);
    url.searchParams.set('v', i + 1);
    history.replaceState(null, '', url);
    mount(i);
  }
  items.forEach((el, i) => el.addEventListener('click', () => setActive(i)));
  window.addEventListener('resize', moveHighlight);
  document.addEventListener('keydown', (e) => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= VARIANTS.length) setActive(num - 1);
    else if (e.key === 'ArrowRight') setActive((current + 1) % VARIANTS.length);
    else if (e.key === 'ArrowLeft') setActive((current - 1 + VARIANTS.length) % VARIANTS.length);
  });
  // First mount without moving the reader (a #fragment keeps its place).
  current = (parseInt(new URLSearchParams(location.search).get('v'), 10) || 1) - 1;
  if (current < 0 || current >= VARIANTS.length) current = 0;
  items.forEach((el, j) => { el.toggleAttribute('data-active', j === current); if (j === current) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current'); });
  moveHighlight();
  document.documentElement.dataset.v = current + 1;
  document.querySelector('.vr-line').textContent = VARIANTS[current][1];
  queue();
  requestAnimationFrame(() => requestAnimationFrame(() => picker.setAttribute('data-ready', '')));
}
