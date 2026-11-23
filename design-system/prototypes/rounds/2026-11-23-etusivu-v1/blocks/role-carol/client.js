// The tote turns on its own while its film is on screen. A reader who asked
// for reduced motion gets the still and the play button, and a reader who
// presses the button keeps control of the film from then on.
const FILM = '[data-block="role-carol"] .cr-tt-film';
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const onScreen = (v) => {
  if (!v.offsetParent) return false;
  const r = v.getBoundingClientRect();
  return r.bottom > 80 && r.top < innerHeight - 80;
};
document.addEventListener('click', (e) => {
  const b = e.target.closest(`${FILM} .cr-play`);
  if (!b) return;
  const v = b.parentElement.querySelector('video');
  v.dataset.mine = '1';
  if (v.paused) v.play().catch(() => {}); else v.pause();
});
// Media events do not bubble: listen while they are captured.
for (const ev of ['play', 'pause']) document.addEventListener(ev, (e) => {
  const film = e.target.closest?.(FILM);
  const b = film?.querySelector('.cr-play');
  if (!b) return;
  b.classList.toggle('on', ev === 'play');
  b.setAttribute('aria-label', ev === 'play' ? b.dataset.pause : b.dataset.play);
}, true);
setInterval(() => {
  if (calm.matches || document.hidden) return;
  for (const v of document.querySelectorAll(`${FILM} video`)) {
    if (v.dataset.mine) continue;
    if (onScreen(v)) { if (v.paused) v.play().catch(() => {}); } else if (!v.paused) v.pause();
  }
}, 700);
