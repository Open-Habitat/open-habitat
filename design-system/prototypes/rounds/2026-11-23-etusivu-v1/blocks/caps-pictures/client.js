// The before/after line: the range input over the two pictures sets --p, and
// the CSS clips the enlarged picture there. Works in the step's own screen and
// in its copy in the sticky screen.
document.addEventListener('input', (e) => {
  const r = e.target.closest('[data-block="caps-pictures"] .cp-range');
  if (r) r.closest('.cp-up').style.setProperty('--p', `${r.value}%`);
});
