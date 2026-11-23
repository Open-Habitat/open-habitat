// "Undo this too": the undo is itself undoable, and each undo is recorded as a
// new entry at the top of the page's history (the copy in the sticky screen
// works the same way, so everything is found from the clicked button).
const HASHES = ['f02c6a1', '5d81b3e', '9a07c42', '3be6f10', 'c51d8a9', '7e2f0b4'];
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-block="alice-10-undo-one-page"] [data-undo]');
  if (!btn) return;
  const view = btn.closest('.hi');
  const list = view.querySelector('[data-hist]');
  const days = view.querySelector('[data-days]');
  const top = list.querySelector('.hi-now');
  const prev = top.querySelector('.hi-meta code').textContent;
  const n = list.querySelectorAll('[data-added]').length;
  const from = days.textContent;
  const to = from === '14 days' ? '30 days' : '14 days';
  const li = document.createElement('li');
  li.className = 'hi-e hi-now';
  li.dataset.added = '';
  li.innerHTML = '<span class="hi-node" aria-hidden="true"></span><div class="hi-card"><p class="hi-top"><b></b><span class="hi-tag hi-tag-undo">Undo</span></p><p class="hi-meta"></p><p class="hi-body"></p><p class="hi-ch"><span class="hi-from"></span><span aria-hidden="true">→</span><span class="hi-to"></span></p></div>';
  li.querySelector('.hi-top b').textContent = to === '30 days' ? 'Wholesale back to 30 days' : 'Wholesale keeps 14-day returns';
  // The agent's avatar is copied from the entry it undoes' sibling markup.
  const meta = li.querySelector('.hi-meta');
  meta.append(view.querySelector('.hi-av-agent').cloneNode(true));
  for (const [tag, text] of [['span', 'Alice, by her agent'], ['span', `Today 15:${String(34 + n).padStart(2, '0')}`], ['code', HASHES[n % HASHES.length]]]) {
    const el = document.createElement(tag); el.textContent = text; meta.append(el);
  }
  li.querySelector('.hi-body').textContent = `Undoes ${prev}. Recorded like every other change.`;
  li.querySelector('.hi-from').textContent = from;
  li.querySelector('.hi-to').textContent = to;
  li.querySelector('.hi-card').append(btn.parentElement);
  top.classList.remove('hi-now');
  list.prepend(li);
  days.textContent = to;
  const count = view.querySelector('.hi-file span');
  count.textContent = `${list.children.length} changes`;
});
