// The soprano practice track. The video is the part with a playhead and the
// sound; the browser's own controls would cover the music, so one button
// under the page plays and pauses it. Nothing loads or plays before the click.
// The screen also appears as a copy in the sticky screen, so everything is
// resolved from the clicked element.
(() => {
  const B = '[data-block="caps-print"]';
  const show = (btn, playing) => {
    btn.setAttribute('aria-pressed', String(playing));
    btn.querySelector('.cp-play-l').textContent = playing ? btn.dataset.pause : btn.dataset.play;
  };
  document.addEventListener('click', (e) => {
    const btn = e.target.closest(`${B} .cp-play`);
    if (btn) {
      const v = btn.closest('.cp-score').querySelector('.cp-video');
      if (!v.dataset.wired) {
        v.dataset.wired = '1';
        v.addEventListener('pause', () => show(btn, false));
        v.addEventListener('play', () => show(btn, true));
        v.addEventListener('ended', () => v.load()); // back to the clean page
      }
      if (v.paused) v.play().catch(() => {}); else v.pause();
      return;
    }
    // Switching to the part as written hides the video: stop it.
    const tg = e.target.closest(`${B} .cp-score [data-set]`);
    if (tg) tg.closest('.cp-score').querySelectorAll('video').forEach((v) => v.pause());
  });
})();
