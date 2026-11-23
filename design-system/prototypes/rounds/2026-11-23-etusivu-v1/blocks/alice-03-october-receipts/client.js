// alice-03-october-receipts: the folder's "Show all 23" opens the rest of the list.
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-block="alice-03-october-receipts"] .rc-toggle');
  if (!b) return;
  const open = b.getAttribute('aria-expanded') !== 'true';
  b.setAttribute('aria-expanded', String(open));
  b.textContent = open ? b.dataset.hide : b.dataset.show;
  b.previousElementSibling.hidden = !open;
});
