// Kierros 15.10.2026: koodilohkon otsake. The library draws the caption (.out-meta)
// below the box; each direction moves it as the box is drawn. A MutationObserver
// callback runs before the frame is painted, so the caption never shows below first.
(() => {
let MODE = 'v1';
function place(meta) {
  const out = meta.parentElement; const win = out.querySelector(':scope > .out-win'); if (!win) return;
  const text = meta.textContent.replace(/\s*·\s*/g, ' · ').trim();
  if (MODE === 'v3') {
    for (const b of out.querySelectorAll('[data-tcopy]')) { const lang = meta.querySelector('.cb-lang')?.textContent; if (lang && !b.dataset.named) { b.dataset.named = '1'; const l = `${b.getAttribute('aria-label')} (${lang})`; b.setAttribute('aria-label', l); b.title = l; } }
    win.title = text; meta.remove(); return;
  }
  meta.classList.add(MODE === 'v1' ? 'on-edge' : 'in-corner');
  meta.setAttribute('aria-label', text);
  win.prepend(meta);
}
const sweep = () => { for (const m of stage.querySelectorAll('.out > .out-meta')) place(m); };
new MutationObserver(sweep).observe(stage, { childList: true, subtree: true });
for (const v of ['v1', 'v2', 'v3']) window[v] = () => { MODE = v; uiFrame.dataset.cap = v; return appView(); };
})();
