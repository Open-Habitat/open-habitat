// The story engine, browser half, and the behaviour every screen shares.
// It holds no content: everything comes from the HTML that build.mjs wrote
// (story.mjs). A block's own behaviour is its blocks/<id>/client.js, which
// build.mjs appends after this file, each in its own scope.
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Shared interactions (delegated, so a cloned screen works too) ----------
document.addEventListener('click', (e) => {
  // A stage's summary row opens that stage's work; the label says which way it goes.
  const st = e.target.closest('.ah-stage-toggle');
  if (st) {
    const open = st.getAttribute('aria-expanded') !== 'true';
    st.setAttribute('aria-expanded', String(open));
    st.setAttribute('aria-label', open ? st.dataset.hide : st.dataset.show);
    st.parentElement.nextElementSibling.hidden = !open;
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
    els.forEach((s, j) => s.classList.toggle('on', j === i));
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
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && show(+e.target.dataset.i)), { rootMargin: '-45% 0px -45% 0px' });
  els.forEach((s) => io.observe(s));
}
document.querySelectorAll('.s1[data-story]').forEach(initStory);

// A capability line that points at someone's day scrolls there smoothly.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a.cap-role');
  if (!a) return;
  const el = document.getElementById(a.getAttribute('href').slice(1));
  if (!el) return;
  e.preventDefault();
  el.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
});
