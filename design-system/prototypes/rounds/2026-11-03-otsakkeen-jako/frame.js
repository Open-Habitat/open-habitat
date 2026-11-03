// Runs inside a view's iframe over the inert lab snapshot. build.mjs defines
// MENU (the open ⋯ popover as production rendered it in this situation) and
// CHIP (the new conversation's composer model chip); <html data-dir/data-sit>
// select the direction and the situation.
(() => {
  const html = document.documentElement;
  const dir = html.dataset.dir;
  const topline = document.querySelector('.ah-agent-topline');
  const shown = (el) => !!el && el.getClientRects().length > 0;

  // Every direction: the model always lives in the composer.
  if (dir !== '0' && !document.querySelector('.ah-composer-model')) {
    const grow = document.querySelector('.ah-composer .ah-crow-grow');
    if (grow) grow.insertAdjacentHTML('afterend', CHIP);
  }

  const more = topline?.querySelector('.ah-header-more');
  let open = null;
  function close() {
    open?.remove();
    open = null;
    more?.setAttribute('aria-expanded', 'false');
  }

  // ⋯ grouped by role, listing only what the row does not show. Production's
  // own items are moved as they are; a state or panel row is a copy of one of
  // them with the value as its description.
  function grouped(menu) {
    const items = Object.fromEntries([...menu.querySelectorAll('[data-menu-item]')].map((el) => [el.dataset.menuItem, el]));
    const template = items.rename ?? Object.values(items)[0];
    const row = (id, label, value) => {
      const el = template.cloneNode(false);
      el.dataset.menuItem = id;
      el.dataset.testid = `menu-${id}`;
      el.removeAttribute('id');
      el.removeAttribute('aria-disabled');
      el.removeAttribute('data-disabled');
      el.innerHTML = `<span></span>${value ? '<small></small>' : ''}`;
      el.querySelector('span').textContent = label;
      if (value) el.querySelector('small').textContent = value;
      return el;
    };
    const hidden = (sel) => {
      const el = topline.querySelector(sel);
      return el && !shown(el) ? el : null;
    };

    const conversation = ['rename', 'retitle', 'recap', 'details', 'archive', 'close']
      .map((id) => items[id]).filter(Boolean);

    const workspace = [];
    const ws = topline.querySelector('.ah-header-workspace');
    if (!shown(ws) && items.workspace) {
      const open = items.workspace;
      open.querySelector('span').textContent = open.querySelector('small')?.textContent ?? '';
      open.querySelector('small')?.remove();
      workspace.push(open);
    }
    const git = hidden('.ah-gs-chip');
    if (git) {
      const [branch, ...counts] = (git.dataset.menuSummary ?? '').split(' ');
      const dirty = counts.find((c) => c.startsWith('●'));
      const ab = counts.filter((c) => c !== dirty).join(' ');
      workspace.push(row('git', 'Git', [branch, ab, dirty && `${dirty.slice(1)} muuttunutta`].filter(Boolean).join(' · ')));
    }
    for (const [sel, id] of [['.ah-guide-toggle', 'guide'], ['.ah-files-toggle', 'files'], ['.ah-editor-toggle', 'editor'], ['.ah-terminal-toggle', 'terminal']]) {
      const el = topline.querySelector(sel);
      const holder = el?.closest('.ah-agent-topline > *');
      if (el && !shown(holder)) workspace.push(row(id, el.getAttribute('aria-label'), ''));
    }

    const agent = [];
    const ctx = hidden('.ah-ctx-chip');
    if (ctx) agent.push(row('context', 'Konteksti', `${ctx.querySelector('.ah-ctx-value')?.textContent.trim()} tokenia`));

    const groups = [
      ['Keskustelu', '', conversation],
      ['Työtila', ws?.textContent.trim() ?? '', workspace],
      ['Agentti', '', agent],
    ].filter(([, , list]) => list.length);
    menu.replaceChildren(...groups.map(([name, detail, list], i) => {
      const group = document.createElement('div');
      group.className = 'p-menu-group';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-labelledby', `p-menu-head-${i}`);
      group.innerHTML = `<div class="p-menu-head" id="p-menu-head-${i}" role="presentation"></div>`;
      const head = group.firstChild;
      head.textContent = name;
      if (detail) {
        const span = document.createElement('span');
        span.textContent = detail;
        head.append(span);
      }
      group.append(...list);
      return group;
    }));
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
    if (dir === '0') {
      // Today: production's flat list; a desktop row still shows the workspace.
      const ws = topline.querySelector('.ah-header-workspace');
      if (shown(ws)) menu.querySelector('[data-menu-item="workspace"]')?.remove();
    } else grouped(menu);
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
