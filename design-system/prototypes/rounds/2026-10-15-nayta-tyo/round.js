// Riffi 15.10.2026: inforivin painettavuus hiljaisen työn päällä (kolme tapaa).
// Kierros 15.10.2026: hiljainen työ. Oletuksena työ on piilossa: säikeet kiinni,
// käynnissä olevasta vuorosta näkyy yksi inforivi, jonka painaminen näyttää työn.
(() => {
const P = { work: 'hidden', pinned: new Map(), prog: false, style: 'v1' };
const isOpen = (b) => b.getAttribute('aria-expanded') === 'true';
const tKey = (b) => { if (!b.hasAttribute('data-fold')) return 'h:' + b.getAttribute('aria-controls'); const t = b.closest('.turn'); if (!t.dataset.k) t.dataset.k = Math.random().toString(36).slice(2); return 'live:' + t.dataset.k; };
const setTo = (b, open) => { if (isOpen(b) !== open) { P.prog = true; b.click(); P.prog = false; } };
let queued = false;
function pass() {
  queued = false;
  // History and settled threads: closed unless the reader opened one.
  for (const b of stage.querySelectorAll('.head-btn[aria-controls], .turn.live:not(.working) [data-fold][aria-expanded]')) {
    const k = tKey(b); setTo(b, P.pinned.has(k) ? P.pinned.get(k) : P.work === 'visible' ? false : false);
  }
  // Inside an opened thread, the streaming block is open and finished ones close.
  for (const b of stage.querySelectorAll('.tool .disc[aria-expanded], .think-btn[aria-expanded]')) {
    const l = b.closest('[data-live]'); const k = l ? 'live:' + l.dataset.live : 'h:' + b.getAttribute('aria-controls');
    setTo(b, P.pinned.has(k) ? P.pinned.get(k) : !!b.closest('.tool')?.querySelector('.running'));
  }
}
const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(pass); } };
new MutationObserver(schedule).observe(stage, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
stage.addEventListener('click', (e) => {
  if (P.prog || !e.isTrusted) return;
  const t = e.target.closest('.head-btn[aria-controls], [data-fold][aria-expanded]');
  if (t) { P.pinned.set(tKey(t), !isOpen(t)); return; }
  const b = e.target.closest('.tool .disc[aria-expanded], .think-btn[aria-expanded]');
  if (b) { const l = b.closest('[data-live]'); P.pinned.set(l ? 'live:' + l.dataset.live : 'h:' + b.getAttribute('aria-controls'), !isOpen(b)); }
}, true);

// The live turn: work hidden by default; the information row opens it on request.
const steps = (s) => s.blocks.filter(b => b.t !== 'reply').length;
const infoRow = (s) => `<div class="info-row q2"><button type="button" class="show-work" data-fold aria-expanded="${s.open}"><span class="lbl"><span class="when-closed">Näytä työ</span><span class="when-open">Piilota työ</span></span>${CHEV}</button><span class="act"><span class="live-dot"></span>Agentti työskentelee</span><span class="info-now">${activity(s)}</span><span class="clock">${elapsed(s)}</span></div>`;

// ---------- Behaviour of the button ----------
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const slow = () => document.getElementById('slow').checked ? 3 : 1;
stage.addEventListener('click', (e) => {
  const btn = e.target.closest('.show-work'); if (!btn || !e.isTrusted) return;
  const turn = btn.closest('.turn'); const opening = btn.getAttribute('aria-expanded') !== 'true';
  const top0 = btn.getBoundingClientRect().top; const h0 = turn.offsetHeight;
  const before = new Set([...turn.children].filter(c => !c.hidden));
  const k = slow();
  // The library flips the work in its capture listener on the turn, which runs after this
  // one. A listener added to the turn now runs right after it, before the frame is painted,
  // so the scroll compensation never shows the button out of place.
  turn.addEventListener('click', () => {
    const nb = turn.querySelector('.show-work');
    if (P.style !== 'v1') {
      // Keep the button under the pointer: compensate the scroll for what appeared above it.
      following = false; stage.scrollTop += nb.getBoundingClientRect().top - top0; lastTop = stage.scrollTop;
    }
    if (reduced.matches) return;
    if (P.style === 'v1') {
      const h1 = turn.offsetHeight;
      turn.animate([{ height: h0 + 'px', overflow: 'hidden' }, { height: h1 + 'px', overflow: 'hidden' }], { duration: 220 * k, easing: 'cubic-bezier(.2,.8,.2,1)' });
      if (following) { const end = performance.now() + 240 * k; const f = () => { stage.scrollTop = stage.scrollHeight; if (performance.now() < end) requestAnimationFrame(f); }; requestAnimationFrame(f); }
    }
    if (opening) {
      const shown = [...turn.children].filter(c => !c.hidden && !before.has(c) && c.classList.contains('cell'));
      shown.forEach((c, i) => c.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 160 * k, delay: (P.style === 'v3' ? i * 45 : 0) * k, easing: 'ease-out', fill: 'backwards' }));
    }
  }, { capture: true, once: true });
}, true);
const libContent = content;
window.content = function () {
  const c = selConv();
  if (c.id !== 'c1') return libContent();
  const R = threadR();
  R.startOpen = P.work === 'visible';
  if (P.work === 'hidden') R.strip = (s) => s.status === 'working' ? infoRow(s) : '';
  return withLive('', R);
};

// ---------- Account menu: Agentin työ Piilossa / Näkyvissä ----------
const seg = () => `<div class="p-row p-work"><span>Agentin työ</span><div class="p-theme" role="group" aria-label="Agentin työ">${[['hidden', 'Piilossa'], ['visible', 'Näkyvissä']].map(([v, l]) => `<button type="button" class="txt" data-work="${v}" aria-pressed="${P.work === v}">${l}</button>`).join('')}</div></div>`;
new MutationObserver(() => {
  const m = uiFrame.querySelector('.p-menu:not([hidden])'); if (!m || m.querySelector('.p-work')) return;
  const theme = m.querySelector('.p-theme')?.closest('.p-row'); if (theme) theme.insertAdjacentHTML('afterend', seg());
}).observe(uiFrame, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
document.addEventListener('click', (e) => {
  const s = e.target.closest('[data-work]'); if (!s) return;
  e.stopPropagation(); P.work = s.dataset.work; P.pinned.clear();
  s.parentElement.querySelectorAll('[data-work]').forEach(x => x.setAttribute('aria-pressed', x === s));
  toast(P.work === 'hidden' ? 'Agentin työ piilotetaan. R soittaa vuoron uudelleen.' : 'Agentin työ näytetään. R soittaa vuoron uudelleen.');
}, true);

for (const v of ['v1', 'v2', 'v3']) window[v] = () => { P.style = v; P.pinned.clear(); return appView(); };
})();
