// Kierros 15.10.2026: liike. Käytös on "säikeet kiinni" -kierroksen; tämä lisää
// sulkemisen, avaamisen ja saapumisen liikkeen kolmella tavalla.
(() => {
const P = { threads: 'closed', pinned: new Map(), prog: false, v: 'v1' };
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const slow = () => document.getElementById('slow').checked ? 3 : 1;
const isOpen = (b) => b.getAttribute('aria-expanded') === 'true';
const threadBtns = () => [...stage.querySelectorAll('.head-btn[aria-controls], [data-fold][aria-expanded]')];
const blockBtns = () => [...stage.querySelectorAll('.tool .disc[aria-expanded], .think-btn[aria-expanded]')];
const tKey = (b) => { if (!b.hasAttribute('data-fold')) return 'h:' + b.getAttribute('aria-controls'); const t = b.closest('.turn'); if (!t.dataset.k) t.dataset.k = Math.random().toString(36).slice(2); return 'live:' + t.dataset.k; };
const bKey = (b) => { const l = b.closest('[data-live]'); return l ? 'live:' + l.dataset.live : 'h:' + b.getAttribute('aria-controls'); };
const running = (b) => !!b.closest('.tool')?.querySelector('.running');

// ---------- Motion ----------
function keepBottom(ms) { if (!following) return; const end = performance.now() + ms; const f = () => { if (!following) return; stage.scrollTop = stage.scrollHeight; lastTop = stage.scrollTop; if (performance.now() < end) requestAnimationFrame(f); }; requestAnimationFrame(f); }
// The element whose height changes when this toggle flips.
const box = (b) => b.hasAttribute('data-fold') || b.classList.contains('head-btn') ? b.closest('.turn') : (b.closest('.cell') || b.closest('.tool'));
const findAgain = (b, key) => key.startsWith('live:') && !b.isConnected ? stage.querySelector(`[data-live="${key.slice(5)}"]`)?.closest('.cell') : box(b);
function animateToggle(b, key, flip) {
  if (reduced.matches) { flip(); return; }
  const el = box(b); if (!el) { flip(); return; }
  const closing = isOpen(b); const k = slow(); const h0 = el.offsetHeight;
  let ghost = null;
  if (closing && P.v === 'v3') { ghost = el.cloneNode(true); ghost.classList.add('m-ghost'); ghost.removeAttribute('id'); ghost.querySelectorAll('[id]').forEach(n => n.removeAttribute('id')); }
  flip();
  const now = findAgain(b, key) || el; const h1 = now.offsetHeight;
  if (Math.abs(h1 - h0) < 2) return;
  const dur = (P.v === 'v1' ? 200 : P.v === 'v2' ? 220 : 180) * k;
  const delay = ghost ? 110 * k : 0;
  if (ghost) {
    now.style.position = 'relative'; now.appendChild(ghost);
    ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120 * k, easing: 'ease-out', fill: 'forwards' }).finished.then(() => ghost.remove());
  }
  now.animate([{ height: h0 + 'px', overflow: 'hidden' }, { height: h1 + 'px', overflow: 'hidden' }], { duration: dur, delay, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  if (!closing) {
    const id = b.getAttribute('aria-controls'); const panel = id && document.getElementById(id);
    if (panel && P.v === 'v3') panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 * k, delay: dur * .5, easing: 'ease-out', fill: 'backwards' });
  }
  if (closing && P.v === 'v2') {
    const head = now.querySelector('.disc, .head-cell, .think-btn') || now;
    head.animate([{ backgroundColor: 'var(--ah-accent-soft)' }, { backgroundColor: 'transparent' }], { duration: 700 * k, easing: 'ease-out' });
    const ok = head.querySelector('.ok svg, .status svg, .chev');
    ok?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 260 * k, delay: dur * .6, easing: 'ease-out' });
  }
  keepBottom(dur + delay + 40);
}
function setTo(b, key, open) {
  if (isOpen(b) === open) return;
  animateToggle(b, key, () => { P.prog = true; b.click(); P.prog = false; });
}

// New rows arriving in the live turn.
new MutationObserver((ms) => {
  if (reduced.matches) return;
  const k = slow();
  for (const m of ms) for (const n of m.addedNodes) {
    if (!(n instanceof HTMLElement) || !n.closest('.turn.live') || !n.matches('.cell, .rail-cell')) continue;
    if (n.matches('.rail-cell')) { if (P.v === 'v3') n.querySelector('.node')?.animate([{ transform: 'scale(1.8)', background: 'var(--ah-accent)' }, { transform: 'scale(1)' }], { duration: 320 * k, easing: 'ease-out' }); continue; }
    if (P.v === 'v1') n.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 200 * k, easing: 'ease-out' });
    else if (P.v === 'v2') { const h = n.offsetHeight; n.animate([{ height: '0px', opacity: 0, overflow: 'hidden' }, { height: h + 'px', opacity: 1, overflow: 'hidden' }], { duration: 220 * k, easing: 'cubic-bezier(.2,.8,.2,1)' }); }
    else n.animate([{ opacity: 0, transform: 'translateX(-12px)' }, { opacity: 1, transform: 'none' }], { duration: 220 * k, easing: 'ease-out' });
    keepBottom(260 * k);
  }
}).observe(stage, { subtree: true, childList: true });

// ---------- Behaviour: säikeet kiinni ----------
let queued = false;
function pass() {
  queued = false;
  for (const b of threadBtns()) { const key = tKey(b); setTo(b, key, P.pinned.has(key) ? P.pinned.get(key) : P.threads === 'open'); }
  for (const b of blockBtns()) { const key = bKey(b); setTo(b, key, P.pinned.has(key) ? P.pinned.get(key) : running(b)); }
}
const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(pass); } };
new MutationObserver(schedule).observe(stage, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
// The reader's own click: remember it, and animate it the same way.
stage.addEventListener('click', (e) => {
  if (P.prog || !e.isTrusted) return;
  const t = e.target.closest('.head-btn[aria-controls], [data-fold][aria-expanded]');
  const b = t || e.target.closest('.tool .disc[aria-expanded], .think-btn[aria-expanded]'); if (!b) return;
  const key = t ? tKey(t) : bKey(b); P.pinned.set(key, !isOpen(b));
  // Let the library flip it, then animate from the measured height.
  if (reduced.matches) return;
  const el = box(b); const h0 = el?.offsetHeight; const closing = isOpen(b); const k = slow();
  let ghost = null;
  if (closing && P.v === 'v3' && el) { ghost = el.cloneNode(true); ghost.classList.add('m-ghost'); ghost.querySelectorAll('[id]').forEach(n => n.removeAttribute('id')); }
  requestAnimationFrame(() => {
    const now = findAgain(b, key) || el; if (!now) return; const h1 = now.offsetHeight; if (Math.abs(h1 - h0) < 2) return;
    const dur = 200 * k, delay = ghost ? 110 * k : 0;
    if (ghost) { now.style.position = 'relative'; now.appendChild(ghost); ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120 * k, fill: 'forwards' }).finished.then(() => ghost.remove()); }
    now.animate([{ height: h0 + 'px', overflow: 'hidden' }, { height: h1 + 'px', overflow: 'hidden' }], { duration: dur, delay, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    if (closing && P.v === 'v2') (now.querySelector('.disc, .head-cell, .think-btn') || now).animate([{ backgroundColor: 'var(--ah-accent-soft)' }, { backgroundColor: 'transparent' }], { duration: 700 * k });
  });
}, true);

window.v1 = () => { P.v = 'v1'; P.pinned.clear(); return appView(); };
window.v2 = () => { P.v = 'v2'; P.pinned.clear(); return appView(); };
window.v3 = () => { P.v = 'v3'; P.pinned.clear(); return appView(); };
})();
