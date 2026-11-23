// "Undo this too" toggles the recorded undo.
document.addEventListener('click', (e) => {
  const undo = e.target.closest('[data-block="alice-10-undo-one-page"] [data-undo]');
  if (!undo) return;
  const sp = undo.parentElement.querySelector('span');
  const undone = undo.toggleAttribute('data-undone');
  undo.textContent = undone ? 'Redo' : 'Undo this too';
  sp.textContent = undone ? 'Undone 15:34 · wholesale back at 30 days' : 'Recorded 15:31 · e93b4d0';
});
