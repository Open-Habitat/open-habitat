// Runs inside a view's iframe over the inert lab snapshot. build.mjs defines
// MENU (the open ⋯ popover as production rendered it in this situation);
// <html data-dir/data-sit> select the direction and the situation.
//
// The five things the desktop row shows (Jari 3.11.): the workspace (the
// repository), Git, the context in use, the model and the activity. Every
// direction carries all five in the phone's one row; ⋯ holds only actions.
// The lab knows no model, so the view shows Opus 5.5 with its 200k window,
// and a running conversation is shown working.
(() => {
  const html = document.documentElement;
  const dir = html.dataset.dir;
  const running = html.dataset.sit === 'kaynnissa';
  const topline = document.querySelector('.ah-agent-topline');
  const $ = (sel, root = topline) => root?.querySelector(sel);
  const make = (markup) => {
    const t = document.createElement('template');
    t.innerHTML = markup.trim();
    return t.content.firstElementChild;
  };
  const text = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  // ---- Facts, as the header already has them ----------------------------
  const activity = $('.ah-header-activity');
  const status = running ? 'Työskentelee' : (activity?.getAttribute('aria-label') ?? '');
  if (activity && running) {
    const mark = $('.ah-status', activity);
    mark.className = 'ah-status ah-tone-info ah-status-working';
    mark.dataset.kind = 'working';
    mark.dataset.animated = 'running';
    mark.lastChild.textContent = status;
    activity.setAttribute('aria-label', status);
    $('.ah-header-tip', activity).textContent = status;
  }
  const workspace = $('.ah-header-workspace')?.textContent.trim() ?? '';
  const letters = (() => {
    const parts = workspace.split(/[-_.\s]+/).filter(Boolean);
    return (parts.length > 1 ? parts.map((p) => p[0]).join('') : workspace).slice(0, 2).toLocaleUpperCase('fi');
  })();
  const gitChip = $('.ah-gs-chip');
  const git = gitChip?.dataset ?? {};
  const branchIcon = gitChip?.querySelector(':scope > svg')?.outerHTML ?? '';
  const counts = gitChip?.querySelector('.ah-gs-counts')?.outerHTML ?? '';
  const ctxChip = $('.ah-ctx-chip');
  const tokens = ctxChip ? +ctxChip.dataset.tokens : 0;
  const WINDOW = 200000;
  const percent = (tokens / WINDOW) * 100;
  const pct = `${Math.max(1, Math.round(percent))} %`;
  const ring = `<svg class="ah-ctx-ring" viewBox="0 0 20 20" aria-hidden="true"><circle class="ah-ctx-track" cx="10" cy="10" r="7"></circle>`
    + `<circle class="ah-ctx-arc" cx="10" cy="10" r="7" pathLength="100" stroke-dasharray="${percent.toFixed(1)} 100" transform="rotate(-90 10 10)"></circle></svg>`;
  if (ctxChip) {
    ctxChip.dataset.level = 'ok';
    ctxChip.querySelector('.ah-ctx-ring').outerHTML = ring;
    ctxChip.querySelector('.ah-ctx-value').textContent = pct;
  }
  const MODEL = 'Opus 5.5';
  const THINKING = 'Medium';
  const statusDot = activity?.querySelector('.ah-status')?.outerHTML ?? '';
  const k = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

  // The full values, as one popover lists them (directions 1 and 2) and as
  // each of direction 3's marks opens its own.
  const ROWS = {
    status: ['Tila', status],
    workspace: ['Työtila', workspace, 'Avaa työtila'],
    git: ['Git', [git.branch, `↑${git.upstreamAhead} ↓${git.upstreamBehind}`, `${git.changes} muuttunutta`].join(' · '), 'Avaa Git-tiedot'],
    context: ['Konteksti', `${pct} · ${k(tokens)} / ${k(WINDOW)} tokenia`, 'Avaa erittely'],
    model: ['Malli', `${MODEL} · ${THINKING}`, running ? 'Mallin tiedot' : 'Vaihda malli'],
  };
  const order = ['status', 'workspace', 'git', ...(ctxChip ? ['context'] : []), 'model'];

  // ---- Popovers: production's menu popover with production's items -------
  let open = null;
  function close() {
    open?.pop.remove();
    open?.anchor.setAttribute('aria-expanded', 'false');
    open = null;
  }
  function popover(anchor, build) {
    if (open?.anchor === anchor) return close();
    close();
    const holder = document.createElement('div');
    holder.innerHTML = MENU;
    const pop = holder.querySelector('.ah-popover');
    pop.removeAttribute('style');
    pop.classList.add('p-menu');
    const menu = pop.querySelector('[role="menu"]');
    const items = Object.fromEntries([...menu.querySelectorAll('[data-menu-item]')].map((el) => [el.dataset.menuItem, el]));
    const template = items.rename;
    const row = (id, label, detail) => {
      const el = template.cloneNode(false);
      el.dataset.menuItem = id;
      el.dataset.testid = `menu-${id}`;
      el.removeAttribute('id');
      el.innerHTML = `<span>${text(label)}</span>${detail ? `<small>${text(detail)}</small>` : ''}`;
      return el;
    };
    menu.replaceChildren(...build(items, row));
    document.body.append(pop);
    const r = anchor.getBoundingClientRect();
    const w = Math.min(320, innerWidth - 16);
    pop.style.width = `${w}px`;
    pop.style.top = `${r.bottom + 6 + scrollY}px`;
    pop.style.left = `${Math.min(Math.max(8, r.left), innerWidth - w - 8)}px`;
    if (anchor.classList.contains('ah-header-more')) pop.style.left = `${Math.max(8, r.right - w)}px`;
    anchor.setAttribute('aria-expanded', 'true');
    open = { pop, anchor };
  }
  // A state row: the value large, what it is and where a tap goes below.
  const stateRows = (ids, row) => ids.map((id) => {
    const [role, value, action] = ROWS[id];
    return row(id, value, action ? `${role} · ${action}` : role);
  });

  // ⋯: only actions. On a phone the panels join the conversation's actions.
  const more = $('.ah-header-more');
  more?.addEventListener('click', (event) => {
    event.stopPropagation();
    popover(more, (items, row) => {
      if (dir === '0') return Object.values(items);
      const list = [];
      if (items.workspace) list.push(row('workspace', 'Avaa työtila', ''));
      const phone = matchMedia('(max-width: 800px)').matches;
      if (phone)
        for (const [sel, id] of [['.ah-editor-toggle', 'editor'], ['.ah-terminal-toggle', 'terminal'], ['.ah-files-toggle', 'files'], ['.ah-guide-toggle', 'guide']]) {
          const el = $(sel);
          if (el) list.push(row(id, el.getAttribute('aria-label'), ''));
        }
      for (const id of ['rename', 'retitle', 'recap', 'details', 'archive', 'close']) if (items[id]) list.push(items[id]);
      return list;
    });
  });
  document.addEventListener('click', (event) => {
    if (open && !open.pop.contains(event.target) && !open.anchor.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  // The activity dot's tooltip opens on a tap, as in production.
  activity?.addEventListener('click', () => activity.toggleAttribute('data-open'));

  if (dir === '0') return;
  topline.classList.add('p-five');

  // ---- 1 · Alarivi: the five as a quiet line under the title -------------
  if (dir === '1') {
    const line = make(`<button type="button" class="p-sub" data-testid="p-status" aria-expanded="false"
      aria-label="${text(order.map((id) => ROWS[id].slice(0, 2).join(' ')).join(', '))}. Avaa tilan tiedot.">
      <span class="p-sub-ws">${text(workspace)}</span>
      ${gitChip ? `<span class="p-sub-git">${branchIcon}<span class="p-wide">${text(git.branch)}</span>${counts}</span>` : ''}
      ${ctxChip ? `<span class="p-sub-ctx" data-level="ok">${ring}<span class="p-pct">${pct}</span></span>` : ''}
      <span class="p-sub-model">${MODEL}<span class="p-wide">&nbsp;· ${THINKING}</span></span>
    </button>`);
    $('.ah-title-row').append(line);
    line.addEventListener('click', (e) => { e.stopPropagation(); popover(line, (_, row) => stateRows(order, row)); });
  }

  // ---- 2 · Yksi siru: all five in one chip after the title ----------------
  if (dir === '2') {
    const chip = make(`<button type="button" class="p-chip" data-testid="p-status" aria-expanded="false"
      aria-label="${text(order.map((id) => ROWS[id].slice(0, 2).join(' ')).join(', '))}. Avaa tilan tiedot.">
      ${statusDot}
      <span class="p-chip-ws"><span class="p-narrow p-letters">${text(letters)}</span><span class="p-wide">${text(workspace)}</span></span>
      ${gitChip ? `<span class="p-chip-git"><span class="p-wide">${branchIcon}</span>${counts}</span>` : ''}
      ${ctxChip ? `<span class="p-chip-ctx" data-level="ok">${ring}<span class="p-wide">${pct}</span></span>` : ''}
      <span class="p-chip-model"><span class="p-narrow">Opus</span><span class="p-wide">${MODEL} · ${THINKING}</span></span>
    </button>`);
    $('.ah-title-row').after(chip);
    chip.addEventListener('click', (e) => { e.stopPropagation(); popover(chip, (_, row) => stateRows(order, row)); });
  }

  // ---- 3 · Omat merkit: each its own short mark --------------------------
  if (dir === '3') {
    // The workspace's initials carry the activity ball, as the narrow rail's
    // agents already do; the Git, context and model marks stay production's
    // own chips, shortened on a phone.
    const badge = make(`<button type="button" class="p-badge" data-testid="p-workspace" aria-expanded="false"
      aria-label="${text(`${workspace}, ${status}`)}"><span class="p-letters">${text(letters)}</span>${statusDot}</button>`);
    topline.prepend(badge);
    badge.addEventListener('click', (e) => { e.stopPropagation(); popover(badge, (_, row) => stateRows(['workspace', 'status'], row)); });
    const model = $(':scope > :is(.md-chip-picker, .ah-set-chip)');
    $('.ah-set-model')?.insertAdjacentHTML('beforebegin', '<span class="p-narrow">Opus</span>');
    for (const [el, id] of [[gitChip, 'git'], [ctxChip, 'context'], [model?.matches('details') ? model.querySelector('summary') : model, 'model']]) {
      el?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        popover(el, (_, row) => stateRows([id], row));
      });
    }
  }
})();
