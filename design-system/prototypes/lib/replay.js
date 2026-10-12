// Single-direction wiring: no picker, R replays the turn. Expects `stage` and `variants`.
function mount() { stage.innerHTML = ''; requestAnimationFrame(() => { stage.innerHTML = variants[0](); }); }
document.addEventListener('keydown', (e) => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'r' || e.key === 'R') mount();
});
mount();
