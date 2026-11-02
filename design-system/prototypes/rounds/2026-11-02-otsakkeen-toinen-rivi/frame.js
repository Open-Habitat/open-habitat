// Runs inside a view's iframe over the inert lab snapshot. build.mjs defines
// MENU (the open ⋯ popover as production rendered it) and CHIP (the new
// conversation's composer model chip); <html data-dir/data-sit> select the
// direction and the situation.
(() => {
  const html = document.documentElement;
  const dir = html.dataset.dir;
  const sit = html.dataset.sit;
  const topline = document.querySelector('.ah-agent-topline');
  const activity = topline?.querySelector('.ah-header-activity');
  const word = activity?.querySelector('.ah-header-tip')?.textContent.trim() ?? '';

  // 2: the activity chip carries its word.
  if (dir === '2' && activity) {
    const label = document.createElement('span');
    label.className = 'p-act-label';
    label.textContent = word;
    activity.append(label);
  }

  // 3: the model always lives in the composer, also once the conversation runs.
  if (dir === '3' && !document.querySelector('.ah-composer-model')) {
    const grow = document.querySelector('.ah-composer .ah-crow-grow');
    if (grow) grow.insertAdjacentHTML('afterend', CHIP);
  }

  // ⋯ opens the production menu. In 3 it starts with what the row gave up.
  const more = topline?.querySelector('.ah-header-more');
  let open = null;
  function close() {
    open?.remove();
    open = null;
    more?.setAttribute('aria-expanded', 'false');
  }
  function stateRows() {
    const rows = [];
    const git = topline.querySelector('.ah-gs-chip');
    if (git) {
      const n = [...git.querySelectorAll('.ah-gs-n')].map((el) => el.textContent.trim());
      const dirty = git.querySelector('.ah-gs-dirty')?.textContent.trim();
      const parts = [];
      if (n[0] || n[1]) parts.push([n[0] && `↑${n[0]}`, n[1] && `↓${n[1]}`].filter(Boolean).join(' '));
      if (dirty) parts.push(`${dirty} muuttunutta`);
      rows.push(['Git', git.querySelector('svg')?.outerHTML ?? '', parts.join(' · ')]);
    }
    const ctx = topline.querySelector('.ah-ctx-chip');
    if (ctx) rows.push(['Konteksti', ctx.querySelector('svg')?.outerHTML ?? '', ctx.textContent.trim() + ' tokenia']);
    if (!rows.length) return '';
    return `<div class="p-menu-state" role="group" aria-label="Tila">${rows
      .map(([k, icon, v]) => `<div class="p-menu-state-row" role="menuitem">${icon}<b>${k}</b><span>${v}</span></div>`)
      .join('')}</div>`;
  }
  more?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (open) return close();
    const holder = document.createElement('div');
    holder.innerHTML = MENU;
    const pop = holder.querySelector('.ah-popover');
    pop.removeAttribute('style');
    pop.classList.add('p-menu');
    const menu = pop.querySelector('[role="menu"]');
    // The menu was captured in a new conversation; it heads the shown one.
    pop.querySelector('.ah-header-full-title').textContent = topline.querySelector('h1').textContent;
    if (sit === 'kaynnissa') {
      const retitle = menu.querySelector('[data-menu-item="retitle"]');
      retitle?.removeAttribute('aria-disabled');
      retitle?.removeAttribute('data-disabled');
      retitle?.querySelector('small')?.remove();
    }
    // A desktop row still shows the workspace; the menu lists only the rest.
    const ws = topline.querySelector('.ah-header-workspace');
    if (ws && ws.getClientRects().length) menu.querySelector('[data-menu-item="workspace"]')?.remove();
    if (dir === '3') menu.insertAdjacentHTML('afterbegin', stateRows());
    document.body.append(pop);
    const r = more.getBoundingClientRect();
    const w = Math.min(320, innerWidth - 16);
    pop.style.width = `${w}px`;
    pop.style.top = `${r.bottom + 6 + scrollY}px`;
    pop.style.left = `${Math.max(8, r.right - w)}px`;
    more.setAttribute('aria-expanded', 'true');
    open = pop;
  });
  document.addEventListener('click', (event) => {
    if (open && !open.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
})();
