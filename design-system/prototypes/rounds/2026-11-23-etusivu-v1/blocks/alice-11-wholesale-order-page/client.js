// The order page beside the conversation really counts: + and − change the order total.
document.addEventListener('click', (e) => {
  const ob = e.target.closest('[data-block="alice-11-wholesale-order-page"] .op-b');
  if (!ob) return;
  const row = ob.closest('.op-row'); const out = row.querySelector('output');
  out.textContent = Math.max(0, +out.textContent + +ob.dataset.d);
  const op = ob.closest('[data-op]');
  const sum = [...op.querySelectorAll('.op-row')].reduce((a, r) => a + +r.dataset.p * +r.querySelector('output').textContent, 0);
  op.querySelector('.op-sum').textContent = `€${sum.toFixed(2)}`;
});
