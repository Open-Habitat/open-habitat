// The minute of the meeting plays: the waveform fills, and the transcript line
// being spoken is marked. Nothing is fetched before the reader presses play.
// The screen exists twice (the sticky copy and the step's own), so everything
// is found from the pressed button, and only one copy plays at a time.
const ROOT = '[data-block="alice-06-planning-memo"] .pm';
const stop = (pm) => {
  pm.classList.remove('playing');
  const b = pm.querySelector('.pm-play'); b.setAttribute('aria-label', b.dataset.play);
};
const show = (pm, audio) => {
  const t = audio.currentTime; const d = audio.duration || +pm.dataset.d || 1;
  pm.querySelector('.pm-wave').style.setProperty('--p', `${Math.min(100, (t / d) * 100).toFixed(2)}%`);
  pm.querySelectorAll('.pm-tr li').forEach((li) => li.classList.toggle('on', t >= +li.dataset.s - 0.25 && t < +li.dataset.e + 0.3));
};
const follow = (pm, audio) => {
  if (!pm.isConnected || !pm.classList.contains('playing')) { if (!pm.isConnected) audio.pause(); return; }
  show(pm, audio);
  requestAnimationFrame(() => follow(pm, audio));
};
document.addEventListener('click', (e) => {
  const play = e.target.closest(`${ROOT} .pm-play`);
  if (!play) return;
  const pm = play.closest('.pm'); const audio = pm.querySelector('audio');
  if (pm.classList.contains('playing')) { audio.pause(); stop(pm); return; }
  document.querySelectorAll(`${ROOT}.playing`).forEach((other) => { other.querySelector('audio').pause(); stop(other); });
  if (!audio.dataset.wired) {
    audio.dataset.wired = '1';
    audio.addEventListener('ended', () => { stop(pm); pm.classList.remove('started'); pm.querySelectorAll('.pm-tr li.on').forEach((li) => li.classList.remove('on')); });
  }
  // The transcript is what to watch while it plays.
  pm.dataset.state = 'tr';
  pm.querySelectorAll('[data-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.set === 'tr')));
  pm.classList.add('playing', 'started'); play.setAttribute('aria-label', play.dataset.pause);
  requestAnimationFrame(() => follow(pm, audio));
  // A browser that cannot play it (or refuses to) leaves the picture as it was.
  Promise.resolve(audio.play()).catch(() => { stop(pm); pm.classList.remove('started'); });
});
