// The slider under "On the printer": shows the frame for the chosen layer and
// writes its number. Works in the step's own screen and in its copy in the
// sticky screen.
document.addEventListener('input', (e) => {
  const r = e.target.closest('[data-block="caps-3d"] .c3-range');
  if (!r) return;
  const host = r.closest('.c3');
  const frames = host.querySelectorAll('.c3-layer');
  frames.forEach((f, i) => f.classList.toggle('on', i === Number(r.value)));
  host.querySelector('.c3-at').textContent = frames[Number(r.value)].dataset.layer;
});
