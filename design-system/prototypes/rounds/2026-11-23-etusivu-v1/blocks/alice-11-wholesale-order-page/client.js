// The order page beside the conversation really counts: + and − change the
// quantity, the item count and the order total. (The tabs need no code: the
// engine's data-view / data-set toggle switches them and the address.)
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-block="alice-11-wholesale-order-page"] .ws-b');
  if (!b) return;
  const out = b.closest('.ws-card').querySelector('output');
  out.textContent = Math.max(0, +out.textContent + +b.dataset.d);
  const shop = b.closest('.ws-shop');
  let n = 0; let sum = 0;
  shop.querySelectorAll('.ws-card').forEach((c) => { const q = +c.querySelector('output').textContent; n += q; sum += q * +c.dataset.p; });
  shop.querySelector('.ws-n').textContent = n;
  shop.querySelector('.ws-sum').textContent = `€${sum.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
});
