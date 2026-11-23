// The stand-in video plays: five captions over 30 seconds. Replace with a
// real <video> from assets.mjs and this file can go.
const CAPTIONS = ['Saturday at the market', 'Printed by hand in our studio', 'One block, one colour at a time', 'Wrapped while you wait', 'example.org/shop'];
document.addEventListener('click', (e) => {
  const play = e.target.closest('[data-block="alice-04-market-video"] .vid-play');
  if (!play) return;
  const v = play.closest('.vid'); const frame = v.querySelector('.vid-frame');
  if (!v.classList.toggle('playing')) { play.setAttribute('aria-label', 'Play'); return; }
  play.setAttribute('aria-label', 'Pause');
  const start = performance.now() - (+v.dataset.pos || 0);
  const step = () => {
    if (!v.isConnected || !v.classList.contains('playing')) return;
    const pos = (performance.now() - start) % 30000; v.dataset.pos = pos;
    const k = Math.min(4, Math.floor(pos / 6000));
    if (frame.dataset.k !== String(k)) { frame.dataset.k = k; frame.querySelector('.vid-cap').textContent = CAPTIONS[k]; }
    v.querySelector('.vid-prog').style.transform = `scaleX(${pos / 30000})`;
    v.querySelector('.vid-t').textContent = `0:${String(Math.floor(pos / 1000)).padStart(2, '0')}`;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
});
