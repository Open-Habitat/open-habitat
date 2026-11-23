// The flight around the 3D model plays, in a loop, while "3D model" is the
// chosen view, and stops when the reader picks another. With reduced motion
// it waits for the reader's own press on play. Works in the step's own screen
// and in its copy in the sticky screen.
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-block="caps-maps"] .cm-park [data-set]');
  if (!b) return;
  const v = b.closest('.cm-park').querySelector('video');
  if (!v) return;
  v.loop = true;
  if (b.dataset.set !== 'model') v.pause();
  else if (!matchMedia('(prefers-reduced-motion: reduce)').matches) v.play().catch(() => {});
});
