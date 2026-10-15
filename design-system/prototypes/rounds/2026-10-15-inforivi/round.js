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
const infoRow = (s) => {
  const label = s.open ? 'Piilota työ' : 'Näytä työ';
  if (P.style === 'v2') return `<div class="info-row r2"><span class="act"><span class="live-dot"></span>Agentti työskentelee</span><span class="info-now">${activity(s)}</span><span class="clock">${elapsed(s)}</span><button type="button" class="show-work" data-fold aria-expanded="${s.open}">${label}${CHEV}</button></div>`;
  if (P.style === 'v3') return `<button type="button" class="info-row r3" data-fold aria-expanded="${s.open}" aria-label="Agentti työskentelee: ${activity(s)}. ${s.open ? 'Piilota vaiheet' : 'Näytä vaiheet'}"><span class="act"><span class="live-dot"></span>Agentti työskentelee</span><span class="info-now">${activity(s)} · ${elapsed(s)}</span><span class="steps">${steps(s)} vaihetta</span><span class="more">${s.open ? 'Piilota' : 'Näytä vaiheet'}${CHEV}</span></button>`;
  return `<button type="button" class="info-row r1" data-fold aria-expanded="${s.open}" title="${label}" aria-label="Agentti työskentelee: ${activity(s)}. ${label}">${CHEV}<span class="act"><span class="live-dot"></span>Agentti työskentelee</span><span class="info-now">${activity(s)}</span><span class="clock">${elapsed(s)}</span></button>`;
};
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
