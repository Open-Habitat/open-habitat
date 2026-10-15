// Kierros 15.10.2026: blokkien avaus ja sulkeminen. Sääntö toimii näyttämön
// päällä: uusi blokki saa tilansa käytösmallista, lukijan oma avaus tai sulkeminen
// kirjataan, ja yläpalkin painike avaa tai sulkee kaikki ja asettaa oletuksen.
(() => {
const ICON_EXPAND = SVG('<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>');
const ICON_COLLAPSE = SVG('<path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/>');
const P = { v: 'v1', mode: 'closed', types: {}, pinned: new Map(), seen: new Set(), auto: new Set(), turnOpen: new WeakSet(), prog: false };
const reset = (v) => { P.v = v; P.mode = 'closed'; P.types = {}; P.pinned.clear(); P.seen.clear(); P.auto.clear(); P.turnOpen = new WeakSet(); };
const buttons = () => [...stage.querySelectorAll('.tool .disc[aria-expanded], .think-btn[aria-expanded]')];
const keyOf = (b) => { const l = b.closest('[data-live]'); return l ? 'live:' + l.dataset.live : 'h:' + b.getAttribute('aria-controls'); };
const typeOf = (b) => b.classList.contains('think-btn') ? 'ajattelu' : (b.querySelector('.name')?.textContent.trim() || 'työkalu');
const isOpen = (b) => b.getAttribute('aria-expanded') === 'true';
const running = (b) => !!b.closest('.tool')?.querySelector('.running');
function desired(b, key) {
  if (P.pinned.has(key)) return P.pinned.get(key);
  const turn = b.closest('.turn');
  if (P.v === 'v1') return P.types[typeOf(b)] ?? (P.mode === 'open');
  if (P.v === 'v2') return (turn && turn.classList.contains('working') && P.turnOpen.has(turn)) || P.mode === 'open';
  return running(b) || P.mode === 'open';
}
function set(b, open) { if (isOpen(b) === open) return; P.prog = true; b.click(); P.prog = false; }
let queued = false;
function pass() {
  queued = false;
  for (const b of buttons()) {
    const key = keyOf(b);
    if (!P.seen.has(key)) { P.seen.add(key); P.auto.add(key); set(b, desired(b, key)); continue; }
    // Automatically managed blocks follow the rule as the work moves on (v2 turn end,
    // v3 running) and after the live turn re-renders a block.
    if (P.auto.has(key) || P.pinned.has(key)) set(b, desired(b, key));
  }
}
const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(pass); } };
new MutationObserver(schedule).observe(stage, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
// The reader's own click: remember it according to the direction.
stage.addEventListener('click', (e) => {
  if (P.prog || !e.isTrusted) return;
  const b = e.target.closest('.tool .disc[aria-expanded], .think-btn[aria-expanded]'); if (!b) return;
  const key = keyOf(b); const willOpen = !isOpen(b);
  P.auto.delete(key); P.pinned.set(key, willOpen);
  if (P.v === 'v1') P.types[typeOf(b)] = willOpen;
  if (P.v === 'v2' && willOpen) { const t = b.closest('.turn.working'); if (t) P.turnOpen.add(t); }
  setTimeout(paintFoldBtn, 0);
}, true);
// v2: when a turn ends, its automatically opened blocks close.
// (pass() re-evaluates auto keys; desired() turns false once .working is gone.)

// ---------- Top bar: Avaa kaikki / Sulje kaikki ----------
const anyOpen = () => buttons().some(isOpen);
function foldBtn() {
  const open = anyOpen(); const label = open ? 'Sulje kaikki blokit' : 'Avaa kaikki blokit';
  return `<button class="icon-btn tb-btn fold-all" type="button" data-fold-all="${open ? 'closed' : 'open'}" aria-label="${label}" title="${label}">${open ? ICON_COLLAPSE : ICON_EXPAND}</button>`;
}
const libActions = APP.actions;
APP.actions = (c) => foldBtn() + libActions(c);
function paintFoldBtn() { const el = uiTop.querySelector('.fold-all'); if (el) el.outerHTML = foldBtn(); }
document.addEventListener('click', (e) => {
  const f = e.target.closest('[data-fold-all]'); if (!f) return;
  e.preventDefault(); e.stopPropagation();
  P.mode = f.dataset.foldAll; P.pinned.clear(); P.types = {}; P.turnOpen = new WeakSet();
  for (const b of buttons()) { P.auto.add(keyOf(b)); set(b, P.mode === 'open'); }
  paintFoldBtn(); toast(P.mode === 'open' ? 'Blokit avataan jatkossa auki.' : 'Blokit pidetään jatkossa kiinni.');
}, true);
new MutationObserver(() => { const el = uiTop.querySelector('.fold-all'); if (el && (el.dataset.foldAll === 'open') === anyOpen()) paintFoldBtn(); }).observe(stage, { subtree: true, attributes: true, attributeFilter: ['aria-expanded'] });

const show = (v) => () => { reset(v); return appView(); };
window.v1 = show('v1'); window.v2 = show('v2'); window.v3 = show('v3');
})();
