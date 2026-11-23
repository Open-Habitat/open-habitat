// The market video: the first click on the poster's play button adds the native
// controls and plays the clip (muted). Nothing autoplays, also not with reduced
// motion. The screen also appears as a copy in the sticky screen, so everything
// is resolved from the clicked element.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-block="alice-04-market-video"] .mv-play');
  if (!btn) return;
  const v = btn.parentElement.querySelector('.mv-video');
  btn.hidden = true;
  v.controls = true;
  v.play().catch(() => {});
  v.addEventListener('ended', () => { v.controls = false; v.load(); btn.hidden = false; }, { once: true });
});
