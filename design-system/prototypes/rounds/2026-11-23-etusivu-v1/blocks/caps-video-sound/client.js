// The stems player: one clip plays at a time; its row shows how far it has
// played (--p on the row, which the CSS turns into the coloured part of the
// waveform) and the time left. Works in the step's own screen and in a copy
// of it, because everything is found from the clicked row.
const SEL = '[data-block="caps-video-sound"]';
const fmt = (s) => `0:${String(Math.max(0, Math.ceil(s))).padStart(2, '0')}`;
const stopAll = (except) => {
  for (const a of document.querySelectorAll(`${SEL} .vs-stem audio`)) if (a !== except && !a.paused) a.pause();
};
document.addEventListener('click', (e) => {
  const b = e.target.closest(`${SEL} [data-vs-play]`);
  if (!b) return;
  const row = b.closest('.vs-stem');
  const a = row.querySelector('audio');
  if (!a.dataset.wired) {
    a.dataset.wired = '1';
    const name = b.getAttribute('aria-label').replace(/^(Play|Pause): /, '');
    const set = (on) => { row.classList.toggle('is-playing', on); b.setAttribute('aria-label', `${on ? 'Pause' : 'Play'}: ${name}`); };
    a.addEventListener('play', () => set(true));
    a.addEventListener('pause', () => set(false));
    a.addEventListener('timeupdate', () => {
      if (!a.duration) return;
      row.style.setProperty('--p', `${(a.currentTime / a.duration) * 100}%`);
      row.querySelector('[data-vs-t]').textContent = fmt(a.duration - a.currentTime);
    });
    a.addEventListener('ended', () => { a.currentTime = 0; row.style.setProperty('--p', '0%'); row.querySelector('[data-vs-t]').textContent = fmt(a.duration); });
  }
  if (a.paused) { stopAll(a); a.play().catch(() => {}); } else a.pause();
});
