// Runs inside a view's iframe over the inert lab snapshot. build.mjs defines
// PLACES: production's own places as the lab opened them on a phone in this
// situation (the ⋯ menu popover, the Git sheet, the model card, the context
// page). <html data-dir/data-sit/data-start> select the riff, the situation
// and whether the riff starts open.
//
// Jari chose round 3's bottom row (Alarivi) for the phone, the status as a dot
// only, the desktop untouched (6.11.). This round riffs what the bottom row
// opens, where, and how it closes:
//   A Valikko     the line is one button; production's menu popover opens under
//                 it with the five, and each row leads to that fact's own place.
//   B Alalaatikko the line is one button; production's Git sheet rises from the
//                 bottom carrying all five in full.
//   C Omat napit  every part of the line is its own button and opens that
//                 fact's own production place, as the desktop's chips do.
// The lab knows no model, so the view shows Opus 5.5 with its 200k window,
// and a running conversation is shown working.
(() => {
  const html = document.documentElement;
  const dir = html.dataset.dir;
  const running = html.dataset.sit === 'kaynnissa';
  const phone = matchMedia('(max-width: 800px)').matches;
  const topline = document.querySelector('.ah-agent-topline');
  const $ = (sel, root = topline) => root?.querySelector(sel);
  const make = (markup) => {
    const t = document.createElement('template');
    t.innerHTML = markup.trim();
    return t.content.firstElementChild;
  };
  const text = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const icon = (d) => `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const chevronRight = icon('<path d="m9 5 7 7-7 7"></path>');

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
  // The status's dot alone; its word stays out of the row (Jari 6.11.).
  const statusDot = (() => {
    const mark = activity?.querySelector('.ah-status')?.cloneNode(true);
    if (!mark) return '';
    for (const n of [...mark.childNodes]) if (!n.classList?.contains('ah-status-dot')) n.remove();
    return mark.outerHTML;
  })();
  const k = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  const gitValue = [git.branch, `↑${git.upstreamAhead} ↓${git.upstreamBehind}`, `${git.changes} muuttunutta`].join(' · ');
  const ctxValue = `${pct} · ${k(tokens)} / ${k(WINDOW)} tokenia`;

  // ---- Production's places ----------------------------------------------
  // Exactly one place is open at a time; close() returns to the plain view.
  let open = null;
  function close() {
    if (!open) return;
    open.remove();
    open.anchor?.setAttribute('aria-expanded', 'false');
    open = null;
  }
  function place(anchor, remove) {
    close();
    anchor?.setAttribute('aria-expanded', 'true');
    open = { anchor, remove };
  }
  let toastTimer = 0;
  function toast(message) {
    document.querySelector('.p-toast')?.remove();
    const el = make(`<div class="p-toast" role="status">${text(message)}</div>`);
    document.body.append(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2200);
  }
  const openWorkspace = () => {
    close();
    toast(`Tästä aukeaa työtila ${workspace}.`);
  };

  // The menu popover as production renders ⋯, filled with given rows.
  function menuPopover(anchor, heading, rows, align = 'start') {
    const holder = document.createElement('div');
    holder.innerHTML = PLACES.menu;
    const pop = holder.querySelector('.ah-popover');
    pop.removeAttribute('style');
    pop.classList.add('p-menu');
    const menu = pop.querySelector('[role="menu"]');
    const template = menu.querySelector('[data-menu-item]');
    const head = pop.querySelector('.ah-menu-heading');
    if (heading) {
      head.className = 'ah-menu-heading p-state';
      head.innerHTML = heading;
    } else head?.remove();
    menu.replaceChildren(...rows.map(({ id, label, detail, action }) => {
      const el = template.cloneNode(false);
      el.dataset.menuItem = id;
      el.dataset.testid = `menu-${id}`;
      el.removeAttribute('id');
      el.innerHTML = `<span>${label}</span>${detail ? `<small>${text(detail)}</small>` : ''}`;
      if (action) el.addEventListener('click', (e) => { e.stopPropagation(); action(); });
      else el.dataset.static = '';
      return el;
    }));
    document.body.append(pop);
    const r = anchor.getBoundingClientRect();
    const w = Math.min(320, innerWidth - 16);
    pop.style.width = `${w}px`;
    pop.style.top = `${r.bottom + 6 + scrollY}px`;
    pop.style.left = align === 'end' ? `${Math.max(8, r.right - w)}px` : `${Math.min(Math.max(8, r.left - 4), innerWidth - w - 8)}px`;
    place(anchor, () => pop.remove());
    return pop;
  }

  // The Git sheet as production opens it on a phone: closes from ✕, from the
  // scrim, by dragging its handle down, and with Esc.
  function sheet(anchor, fill) {
    const holder = document.createElement('div');
    holder.innerHTML = PLACES.git;
    const overlay = holder.firstElementChild;
    overlay.classList.add('p-sheet');
    if (fill) fill(overlay);
    document.body.append(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelectorAll('[slot="close"]').forEach((b) => b.addEventListener('click', close));
    const modal = overlay.querySelector('.ah-modal');
    let startY = null;
    modal.addEventListener('pointerdown', (e) => {
      if (e.clientY - modal.getBoundingClientRect().top < 32) { startY = e.clientY; modal.setPointerCapture(e.pointerId); }
    });
    modal.addEventListener('pointermove', (e) => {
      if (startY !== null) modal.style.transform = `translateY(${Math.max(0, e.clientY - startY)}px)`;
    });
    modal.addEventListener('pointerup', (e) => {
      if (startY === null) return;
      const moved = e.clientY - startY;
      startY = null;
      modal.style.transform = '';
      if (moved > 80) close();
    });
    place(anchor, () => overlay.remove());
    return overlay;
  }
  const openGit = (anchor) => sheet(anchor);

  // The model card as the header's model chip opens it: closes from a tap
  // outside it and with Esc.
  function openModel(anchor) {
    const card = make(PLACES.model);
    card.classList.add('p-modelcard');
    card.open = true;
    card.querySelector('summary')?.addEventListener('click', (e) => e.preventDefault());
    document.body.append(card);
    place(anchor, () => card.remove());
  }

  // The context page takes the conversation's place under the header; its
  // back button, the anchor again, or Esc returns.
  function openContext(anchor) {
    const frame = document.querySelector('.ah-conversation-frame');
    const page = make(PLACES.ctx);
    frame.append(page);
    frame.classList.add('ah-frame-context');
    // Production measures the header into --ah-header-height; the snapshot
    // keeps today's taller value, so the page starts where this header ends.
    page.style.top = `${frame.querySelector(':scope > .ah-agent-header').offsetHeight}px`;
    page.querySelector('.ah-cd-back')?.addEventListener('click', close);
    place(anchor, () => { page.remove(); frame.classList.remove('ah-frame-context'); });
  }

  document.addEventListener('click', (event) => {
    if (!open) return;
    const inside = event.target.closest('.p-menu, .p-sheet, .p-modelcard, .ah-cd-page');
    if (!inside && !open.anchor?.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  // ⋯ keeps production's actions; on the chosen phone row the panels join it.
  const more = $('.ah-header-more');
  more?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (open?.anchor === more) return close();
    const holder = document.createElement('div');
    holder.innerHTML = PLACES.menu;
    const items = [...holder.querySelectorAll('[data-menu-item]')];
    const byId = Object.fromEntries(items.map((el) => [el.dataset.menuItem, el]));
    const rows = [];
    if (dir !== '0' && phone) {
      if (byId.workspace) rows.push({ id: 'workspace', label: 'Avaa työtila', action: openWorkspace });
      for (const [sel, id] of [['.ah-editor-toggle', 'editor'], ['.ah-terminal-toggle', 'terminal'], ['.ah-files-toggle', 'files'], ['.ah-guide-toggle', 'guide']]) {
        const el = $(sel);
        if (el) rows.push({ id, label: text(el.getAttribute('aria-label')), action: close });
      }
      for (const id of ['rename', 'retitle', 'recap', 'details', 'archive', 'close'])
        if (byId[id]) rows.push({ id, label: byId[id].querySelector('span')?.innerHTML ?? '', detail: byId[id].querySelector('small')?.textContent, action: close });
    } else {
      for (const el of items) rows.push({ id: el.dataset.menuItem, label: el.querySelector('span')?.innerHTML ?? '', detail: el.querySelector('small')?.textContent, action: close });
    }
    const title = holder.querySelector('.ah-menu-heading')?.innerHTML;
    menuPopover(more, null, rows, 'end');
    if (title) open && document.querySelector('.p-menu [role="menu"]').insertAdjacentHTML('beforebegin', `<div class="ah-menu-heading">${title}</div>`);
  });
  // The activity dot's word opens on a tap, as in production.
  activity?.addEventListener('click', (e) => { e.stopPropagation(); activity.toggleAttribute('data-open'); });

  // Today, and the desktop in every riff, stay production's own.
  if (dir === '0' || !phone) return;
  topline.classList.add('p-five');

  // ---- The chosen row: the five as a quiet line under the title ----------
  const label = [`Tila ${status}`, `Työtila ${workspace}`, gitChip && `Git ${gitValue}`, ctxChip && `Konteksti ${ctxValue}`, `Malli ${MODEL} · ${THINKING}`].filter(Boolean).join(', ');
  const parts = {
    workspace: `<span class="p-sub-ws">${text(workspace)}</span>`,
    git: gitChip ? `<span class="p-sub-git">${branchIcon}${counts}</span>` : '',
    context: ctxChip ? `<span class="p-sub-ctx" data-level="ok">${ring}</span>` : '',
    model: `<span class="p-sub-model">${MODEL}</span>`,
  };
  const segment = (id, aria) => parts[id] && parts[id].replace(/^<span class="([^"]+)"/, `<button type="button" class="p-seg $1" data-seg="${id}" data-testid="p-seg-${id}" aria-expanded="false" aria-label="${text(aria)}"`).replace(/<\/span>$/, '</button>');

  let line;
  if (dir === 'C') {
    line = make(`<div class="p-sub" data-testid="p-line">
      ${segment('workspace', `Työtila ${workspace}. Avaa työtila.`)}
      ${gitChip ? segment('git', `Git ${gitValue}. Avaa Git-tiedot.`) : ''}
      ${ctxChip ? segment('context', `Konteksti ${ctxValue}. Avaa erittely.`) : ''}
      ${segment('model', `Malli ${MODEL} · ${THINKING}. Avaa mallin tiedot.`)}
    </div>`);
  } else {
    line = make(`<button type="button" class="p-sub" data-testid="p-line" aria-expanded="false" aria-label="${text(label)}. Avaa tiedot.">
      ${Object.values(parts).join('')}
    </button>`);
  }
  $('.ah-title-row').append(line);

  // ---- A · Valikko --------------------------------------------------------
  // The status heads the menu as a dot and its word; the four rows below each
  // say their full value and lead where that fact's chip leads on a desktop.
  const rowsA = () => [
    { id: 'workspace', label: text(workspace), detail: 'Työtila · Avaa työtila', action: openWorkspace },
    ...(gitChip ? [{ id: 'git', label: text(gitValue), detail: 'Git · Näytä tiedot', action: () => openGit(line) }] : []),
    ...(ctxChip ? [{ id: 'context', label: text(ctxValue), detail: 'Konteksti · Avaa erittely', action: () => openContext(line) }] : []),
    { id: 'model', label: `${MODEL} · ${THINKING}`, detail: 'Malli · Mallin tiedot', action: () => openModel(line) },
  ];
  const openA = () => menuPopover(line, `${statusDot}<span>${text(status)}</span>`, rowsA());

  // ---- B · Alalaatikko ----------------------------------------------------
  // Production's Git sheet with the status and the workspace on top, model and
  // context as rows, then the Git details as production shows them.
  const openB = () => sheet(line, (overlay) => {
    const panel = overlay.querySelector('.ah-gs-panel');
    const top = panel.querySelector('.ah-gs-top');
    const closeBtn = top.querySelector('[slot="close"]');
    const branch = top.querySelector('.ah-gs-branch')?.outerHTML ?? '';
    const path = top.querySelector('.ah-gs-path')?.textContent ?? '';
    const head = make(`<div class="p-sheet-top"><div class="p-sheet-state">
        <h2 slot="title" tabindex="-1">${statusDot}<span>${text(status)}</span></h2>
      </div></div>`);
    head.append(closeBtn);
    const rows = make(`<section class="ah-gs-sec p-sheet-rows" aria-label="Keskustelu">
      <button type="button" class="p-sheet-row" data-testid="p-row-workspace"><span class="p-role">Työtila</span><span class="p-val"><span class="p-mono">${text(workspace)}</span><span class="p-path">${text(path)}</span></span>${chevronRight}</button>
      ${ctxChip ? `<button type="button" class="p-sheet-row" data-testid="p-row-context"><span class="p-role">Konteksti</span><span class="p-val" data-level="ok">${ring}${text(ctxValue)}</span>${chevronRight}</button>` : ''}
      <button type="button" class="p-sheet-row" data-testid="p-row-model"><span class="p-role">Malli</span><span class="p-val">${MODEL} · ${THINKING}</span>${chevronRight}</button>
    </section>`);
    rows.querySelector('[data-testid="p-row-workspace"]').addEventListener('click', openWorkspace);
    rows.querySelector('[data-testid="p-row-context"]')?.addEventListener('click', () => openContext(line));
    rows.querySelector('[data-testid="p-row-model"]').addEventListener('click', () => openModel(line));
    const gitHead = make(`<h3 class="p-git-h">Git ${branchIcon}${branch}</h3>`);
    top.replaceWith(head);
    head.after(rows, gitHead);
    overlay.querySelector('section[role="dialog"]').setAttribute('aria-label', 'Keskustelun tila');
  });

  // ---- C · Omat napit -----------------------------------------------------
  if (dir === 'C') {
    const act = {
      workspace: (b) => menuPopover(b, null, [{ id: 'workspace', label: text(workspace), detail: 'Työtila · Avaa työtila', action: openWorkspace }]),
      git: (b) => openGit(b),
      context: (b) => openContext(b),
      model: (b) => openModel(b),
    };
    line.querySelectorAll('.p-seg').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (open?.anchor === b) return close();
      act[b.dataset.seg](b);
    }));
  } else {
    line.addEventListener('click', (e) => {
      e.stopPropagation();
      if (open?.anchor === line) return close();
      (dir === 'A' ? openA : openB)();
    });
  }

  // Each riff starts with what its tap opens, so the difference shows at once.
  if (html.dataset.start === 'open') {
    if (dir === 'C') line.querySelector(gitChip ? '[data-seg="git"]' : '[data-seg="model"]').click();
    else line.click();
  }
})();
