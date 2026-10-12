// Näyttämö: vierityspalsta, teema, puhelinkehys ja kuvan sisäiset vuorovaikutukset.
const stage = document.getElementById('stage');
// Follow the newest content until the person scrolls up; resume when they return to the bottom.
let following = true; let lastTop = 0;
stage.addEventListener('scroll', () => { const gap = stage.scrollHeight - stage.scrollTop - stage.clientHeight; if (stage.scrollTop < lastTop - 1) following = false; else if (gap < 40) following = true; lastTop = stage.scrollTop; });

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
    if (sum && disc.classList.contains('head-btn') && !disc.closest('.v3')) sum.hidden = !open;
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
