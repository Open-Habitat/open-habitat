// Näyttämö: vierityspalsta, teema, puhelinkehys ja kuvan sisäiset vuorovaikutukset.
const stage = document.getElementById('stage');
// Follow the newest content until the person scrolls up; resume when they return to the bottom.
// Only the reader's own scrolling (wheel, touch, keys, scrollbar) stops following: content that
// shrinks when blocks close also lowers scrollTop, and must not count (Jari 15.10.2026).
let following = true; let lastTop = 0; let intentAt = -Infinity;
const intent = () => { intentAt = performance.now(); };
stage.addEventListener('wheel', intent, { passive: true });
stage.addEventListener('touchmove', intent, { passive: true });
stage.addEventListener('pointerdown', (e) => { if (e.target === stage) intent(); });
stage.addEventListener('keydown', (e) => { if (/^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End| )$/.test(e.key)) intent(); });
stage.addEventListener('scroll', () => {
  const gap = stage.scrollHeight - stage.scrollTop - stage.clientHeight;
  const byReader = performance.now() - intentAt < 500;
  if (byReader && stage.scrollTop < lastTop - 1) following = false; else if (gap < 40) following = true;
  lastTop = stage.scrollTop;
});
// Height changes (blocks opening, closing, streaming) keep a following view at the bottom.
{ let q = false; new MutationObserver(() => { if (!following || q) return; q = true; requestAnimationFrame(() => { q = false; if (following) { stage.scrollTop = stage.scrollHeight; lastTop = stage.scrollTop; } }); }).observe(stage, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'class', 'aria-expanded', 'style'] }); }

// ---------- Interactions inside the stage (event delegation) ----------
stage.addEventListener('click', async (e) => {
  const copy = e.target.closest('[data-copy]');
  if (copy) {
    try { await navigator.clipboard.writeText(copy.dataset.copy); } catch {}
    const label = copy.getAttribute('aria-label');
    copy.setAttribute('data-done', ''); copy.setAttribute('aria-label', 'Kopioitu'); copy.title = 'Kopioitu';
    copy.innerHTML = ICON_CHECK.replace('<svg', '<svg style="width:14px;height:14px"');
    setTimeout(() => { copy.removeAttribute('data-done'); copy.setAttribute('aria-label', label); copy.title = label; copy.innerHTML = ICON_COPY; }, 1200);
    return;
  }
  const disc = e.target.closest('[aria-expanded][aria-controls]');
  if (disc) {
    const open = disc.getAttribute('aria-expanded') === 'true';
    const panel = document.getElementById(disc.getAttribute('aria-controls'));
    disc.setAttribute('aria-expanded', String(!open));
    panel.hidden = open;
    const sum = disc.parentElement.querySelector('.sum');
    if (sum && disc.classList.contains('quiet-btn') && disc.dataset.open) { sum.hidden = !open; disc.textContent = open ? disc.dataset.closed : disc.dataset.open; }
    return;
  }
});

// ---------- Page chrome: theme and phone frame ----------
const themeSel = document.getElementById('theme');
const mq = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const v = themeSel.value;
  document.documentElement.dataset.theme = v === 'system' ? (mq.matches ? 'dark' : 'light') : v;
}
themeSel.addEventListener('change', applyTheme); mq.addEventListener('change', applyTheme); applyTheme();
document.getElementById('phone').addEventListener('change', (e) => document.getElementById('wrap').classList.toggle('phone', e.target.checked));
