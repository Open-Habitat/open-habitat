// Shared by the three navigation variants: the page's sections and the
// reader's place in them, read from the page that render.mjs wrote, and the
// one way every variant jumps. In a port, render.mjs knows all of this at
// build time (blocks/index.js gives the order, the role and caps blocks their
// names) and writes the navigation's HTML; here it is read back from the DOM
// so the v1 round stays untouched.
//
// It runs in the same <script> as engine/client.js, after it, so it can use the
// engine's `reduced`, `wide` and `selfScroll`. The port names that dependency
// as an engine function (see NOTES.md, "jumpTo").
window.NAV = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const text = (el) => (el ? el.textContent.trim() : '');

  // ---------- The page's sections ----------
  // { id, label, title, el, end, kids: [{ id, href, label, sub, av, story, el }] }
  function model() {
    const day = $('#day');
    const aliceStory = $('.s1[data-story]');
    const firstStep = aliceStory && $('.s1-step[id]', aliceStory);
    const roles = $$('#roles .role');
    const caps = $$('#can .cap-g');
    return [
      { id: 'day', label: 'A day', title: text($('h2', day)), el: day, end: $('.day-end'),
        kids: [{ id: 'alice', href: `#${firstStep ? firstStep.id : 'day'}`, label: 'Alice', sub: 'Ten conversations, one Thursday', av: $('.s1-bar .av', aliceStory)?.outerHTML || '', story: aliceStory, el: aliceStory }] },
      { id: 'roles', label: 'The team', title: text($('#roles h2')), el: $('#roles'),
        kids: roles.map((r) => ({ id: r.id, href: `#${r.id}`, label: text($('.role-h h3', r)), sub: text($('.role-k', r)).split('·')[0].trim(), av: $('.role-h .av', r)?.outerHTML || '', story: $('.s1', r), el: r })) },
      { id: 'can', label: 'What it can do', title: text($('#can h2')), el: $('#can'),
        kids: caps.map((g) => ({ id: g.id, href: `#${g.id}`, label: text($('.cap-gh h3', g)), sub: text($('.cap-gh p', g)), av: '', story: $('.s1', g), el: g })) },
      { id: 'install', label: 'Install', title: text($('#install h2')), el: $('#install'), kids: [] },
    ];
  }
  let M = null;
  const sections = () => (M ||= model());

  // ---------- Where the reader is ----------
  // The reading line: a fixed share down the part of the viewport the
  // variant's chrome leaves free.
  const chromeH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 0;
  const line = () => chromeH() + (innerHeight - chromeH()) * 0.3;
  // A story's progress: the active step (the engine's .on) while the reader
  // is inside it, all of it once passed, none before.
  function progress(k) {
    const steps = k.story ? $$(':scope > .s1-steps > .s1-step', k.story) : [];
    const total = steps.length || 1;
    const r = k.el.getBoundingClientRect();
    const y = line();
    if (r.top > y) return { done: 0, total, state: 'next' };
    if (r.bottom < y) return { done: total, total, state: 'past' };
    if (!steps.length) return { done: 1, total, state: 'here' };
    const on = steps.findIndex((s) => s.classList.contains('on'));
    return { done: Math.max(1, on + 1), total, state: 'here' };
  }
  function where() {
    const y = line();
    const S = sections();
    let sec = null;
    for (const s of S) if (s.el && s.el.getBoundingClientRect().top <= y) sec = s;
    let kid = null;
    if (sec) for (const k of sec.kids) if (k.el.getBoundingClientRect().top <= y) kid = k;
    const max = document.documentElement.scrollHeight - innerHeight;
    return { sec, kid, page: max > 0 ? Math.min(1, scrollY / max) : 0, prog: new Map(S.flatMap((s) => s.kids).map((k) => [k, progress(k)])) };
  }

  // ---------- Jumping ----------
  // A jump lands the target at its scroll-margin (the step at the engine's
  // line, a section under any bar), records the hash, and moves focus there
  // so the next Tab continues from the place the reader went to.
  function go(href) {
    const top = href === '#top';
    const el = top ? $('.hero h1') : document.getElementById(href.slice(1));
    if (!el) return false;
    const smooth = !reduced();
    if (smooth) selfScroll = true; // engine: this scroll is ours, do not re-place a step when it ends
    if (top) scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
    else el.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
    history.pushState(null, '', top ? location.pathname + location.search : href);
    if (!el.matches('a, button, [tabindex]')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
    return true;
  }
  // Links inside a variant's chrome go through go(); a sheet closes first.
  function wire(root, signal, before) {
    root.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || !root.contains(a)) return;
      e.preventDefault();
      before?.(a);
      go(a.getAttribute('href'));
    }, { signal });
  }

  // ---------- Engine: the phone's line in a story without a status bar ----------
  // On the phone the engine's line is the status bar's bottom edge, or 0 in
  // a story that has none (the capability groups). Under a top bar that 0
  // must be the bar's bottom edge, or a capability step reached by its
  // anchor would land below a line it can never cross. The engine's
  // restLine is a global function declaration, so the prototype can wrap
  // it; the port changes the one line in client.js (NOTES.md).
  const engineLine = restLine;
  restLine = (st) => (!wide() && !st.bar ? chromeH() : engineLine(st));

  // ---------- Each variant's update on scroll ----------
  let active = null;
  let queued = false;
  const tick = () => { queued = false; if (active?.update) active.update(where()); };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(tick); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);

  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const mark = () => $('.top .brandword svg')?.outerHTML || '';
  const hero = () => $('.hero-band') || $('.hero');

  return {
    $, $$, el, esc, mark, hero, sections, where, go, wire, queue,
    variants: [],
    set active(v) { active = v; queue(); },
    get active() { return active; },
  };
})();
