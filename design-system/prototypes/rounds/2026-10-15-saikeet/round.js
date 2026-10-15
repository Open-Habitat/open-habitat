// Kierros 15.10.2026: säikeet kiinni (Jarin kuvaus). Sääntö toimii näyttämön päällä.
(() => {
const P = { threads: 'closed', pinned: new Map(), seen: new Set(), prog: false };
const isOpen = (b) => b.getAttribute('aria-expanded') === 'true';
const click = (b) => { P.prog = true; b.click(); P.prog = false; };
const setTo = (b, open) => { if (b && isOpen(b) !== open) click(b); };
// Thread toggles: history heads (aria-controls) and the live turn's fold (data-fold).
const threadBtns = () => [...stage.querySelectorAll('.head-btn[aria-controls], [data-fold][aria-expanded]')];
const blockBtns = () => [...stage.querySelectorAll('.tool .disc[aria-expanded], .think-btn[aria-expanded]')];
const tKey = (b) => { if (!b.hasAttribute('data-fold')) return 'h:' + b.getAttribute('aria-controls'); const t = b.closest('.turn'); if (!t.dataset.k) t.dataset.k = Math.random().toString(36).slice(2); return 'live:' + t.dataset.k; };
const bKey = (b) => { const l = b.closest('[data-live]'); return l ? 'live:' + l.dataset.live : 'h:' + b.getAttribute('aria-controls'); };
const running = (b) => !!b.closest('.tool')?.querySelector('.running') || (b.classList.contains('think-btn') && !!b.closest('.turn.working') && !b.closest('[data-live]')?.nextElementSibling);
let queued = false;
function pass() {
  queued = false;
  for (const b of threadBtns()) {
    const k = tKey(b);
    if (P.pinned.has(k)) { setTo(b, P.pinned.get(k)); continue; }
    setTo(b, P.threads === 'open');
  }
  for (const b of blockBtns()) {
    const k = bKey(b);
    if (P.pinned.has(k)) { setTo(b, P.pinned.get(k)); continue; }
    setTo(b, running(b));
  }
}
const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(pass); } };
new MutationObserver(schedule).observe(stage, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
// The reader's own choice sticks for that thread or block.
stage.addEventListener('click', (e) => {
  if (P.prog || !e.isTrusted) return;
  const t = e.target.closest('.head-btn[aria-controls], [data-fold][aria-expanded]');
  if (t) { P.pinned.set(tKey(t), !isOpen(t)); return; }
  const b = e.target.closest('.tool .disc[aria-expanded], .think-btn[aria-expanded]');
  if (b) P.pinned.set(bKey(b), !isOpen(b));
}, true);

// ---------- Default in the account menu: Säikeet Kiinni / Auki ----------
const seg = () => `<div class="p-row p-threads"><span>Säikeet</span><div class="p-theme" role="group" aria-label="Säikeiden oletus">${[['closed', 'Kiinni'], ['open', 'Auki']].map(([v, l]) => `<button type="button" class="txt" data-threads="${v}" aria-pressed="${P.threads === v}">${l}</button>`).join('')}</div></div>`;
new MutationObserver(() => {
  const m = uiFrame.querySelector('.p-menu:not([hidden])'); if (!m || m.querySelector('.p-threads')) return;
  const theme = m.querySelector('.p-theme')?.closest('.p-row'); if (theme) theme.insertAdjacentHTML('afterend', seg());
}).observe(uiFrame, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
document.addEventListener('click', (e) => {
  const s = e.target.closest('[data-threads]'); if (!s) return;
  e.stopPropagation();
  P.threads = s.dataset.threads; P.pinned.clear();
  s.parentElement.querySelectorAll('[data-threads]').forEach(x => x.setAttribute('aria-pressed', x === s));
  schedule(); toast(P.threads === 'open' ? 'Säikeet näytetään jatkossa auki.' : 'Säikeet näytetään jatkossa kiinni.');
}, true);

window.v1 = () => { P.pinned.clear(); P.seen.clear(); return appView(); };
})();
