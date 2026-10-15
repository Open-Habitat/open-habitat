// Elävä vuoro: avainnetut rivit langassa, siirtyvä tilanauha ja taittaminen.
// `R` kuvaa yhden suunnan: pään, nauhan, lohkojen ja komennon piirtäjät.
let run = 0;
function playLive(host, R) {
  const token = ++run;
  const state = { status: 'idle', blocks: [], t0: 0, dur: 0, open: R.startOpen !== false };
  const rows = new Map();
  const turn = document.createElement('div'); turn.className = 'turn live'; host.appendChild(turn);
  let headRail, headCell;
  if (R.head) { headRail = document.createElement('div'); headRail.className = 'rail-cell'; headCell = document.createElement('div'); headCell.className = 'cell'; turn.append(headRail, headCell); }
  let stripRail, stripCell;
  if (R.strip) { stripRail = document.createElement('div'); stripRail.className = 'rail-cell'; stripCell = document.createElement('div'); stripCell.className = 'cell'; turn.append(stripRail, stripCell); }
  let floatEl = null;
  const sum = () => `${state.blocks.filter(b => b.t === 'think').length} ajatusta · ${state.blocks.filter(b => b.t === 'tool').length} työkalua`;
  const isWork = (b) => b.t !== 'reply';
  const relayout = () => {
    // Visibility by fold, then first/last on the visible rail cells.
    for (const b of state.blocks) { const r = rows.get(b.id); const hide = !state.open && isWork(b); r.rail.hidden = hide; r.cell.hidden = hide; }
    const cells = [...turn.querySelectorAll(':scope > .rail-cell:not([hidden])')];
    cells.forEach((c, i) => { c.classList.toggle('first', i === 0); c.classList.toggle('last', state.status === 'settled' && i === cells.length - 1); c.classList.toggle('tail', state.status === 'working' && i === cells.length - 1); });
  };
  const renderChrome = () => {
    // Morph rather than replace: a button that survives the clock tick keeps its clicks and hover.
    if (R.head) { morph(headRail, R.headNode(state)); morph(headCell, R.head(state, sum())); }
    // A strip that renders nothing leaves the rail (e.g. no settled summary at the end).
    if (R.strip) { const html = R.strip(state, sum()); stripRail.hidden = stripCell.hidden = !html; morph(stripRail, html ? `<span class="node strip-node" aria-hidden="true"></span>` : ''); morph(stripCell, html); }
    if (R.float) {
      if (state.status === 'working') { if (!floatEl) { floatEl = document.createElement('div'); floatEl.className = 'float-bar'; floatEl.setAttribute('role', 'status'); document.body.appendChild(floatEl); } floatEl.innerHTML = R.float(state); }
      else if (floatEl) { floatEl.remove(); floatEl = null; }
    }
    relayout();
  };
  const follow = () => { if (following) stage.scrollTop = stage.scrollHeight; };
  const applyScroll = (cell) => { for (const v of cell.querySelectorAll('pre.viewport[data-scroll]')) v.scrollTop = v.dataset.scroll === 'start' ? 0 : v.scrollHeight; };
  const patch = (id) => {
    const b = state.blocks.find(x => x.id === id); const r = rows.get(id); const last = state.blocks[state.blocks.length - 1] === b;
    r.rail.className = `rail-cell${r.fresh ? ' row-in' : ''}`;
    r.rail.innerHTML = `<span class="node${b.t === 'tool' ? ' tool' : ''}${last && state.status === 'working' ? ' active' : ' done'}" aria-hidden="true"></span>`;
    r.cell.innerHTML = R.block(b, state, last); r.cell.dataset.live = id;
    applyScroll(r.cell); follow();
  };
  const S = {
    start() { state.status = 'working'; state.t0 = performance.now(); turn.classList.add('working'); renderChrome(); },
    add(b) {
      state.blocks.push(b);
      const rail = document.createElement('div'); const cell = document.createElement('div'); cell.className = 'cell';
      rows.set(b.id, { rail, cell, fresh: true });
      const beforeStrip = R.strip && (R.stripPos === 'end' || (R.stripPos === 'beforeReply' && isWork(b)));
      if (beforeStrip) { turn.insertBefore(rail, stripRail); turn.insertBefore(cell, stripRail); } else turn.append(rail, cell);
      for (const p of state.blocks) if (p !== b) { rows.get(p.id).fresh = false; patch(p.id); }
      patch(b.id); renderChrome();
    },
    set(id, delta) { Object.assign(state.blocks.find(x => x.id === id), delta); patch(id); renderChrome(); },
    push(id, line) { state.blocks.find(x => x.id === id).out.push(line); patch(id); },
    settle() { state.status = 'settled'; state.dur = elapsed(state); state.open = !R.foldOnSettle; turn.classList.remove('working'); for (const b of state.blocks) { rows.get(b.id).fresh = false; patch(b.id); } renderChrome(); },
  };
  const slow = document.getElementById('slow').checked ? 2.2 : 1;
  for (const [t, fn] of script()) setTimeout(() => { if (token === run) fn(S); }, t * slow);
  const tick = () => { if (token !== run) { floatEl?.remove(); return; } if (state.status === 'working') renderChrome(); if (state.status !== 'settled') setTimeout(tick, 1000); };
  setTimeout(tick, 1000);
  turn.addEventListener('click', (e) => {
    const fold = e.target.closest('[data-fold]');
    if (fold) { state.open = !state.open; renderChrome(); e.stopPropagation(); return; }
    const act = e.target.closest('[data-act]');
    if (act) {
      const id = act.closest('[data-live]').dataset.live; const b = state.blocks.find(x => x.id === id); const a = act.dataset.act;
      const key = act.dataset.for === 'cmd' ? 'cmdView' : 'view';
      if (a === 'edges' || a === 'start' || a === 'end') b[key] = a;
      else if (a === 'all') b[key] = (b[key] ?? (key === 'view' ? outView(b) : 'edges')) === 'all' ? 'edges' : 'all';
      else if (a === 'cmd-toggle') b.cmdOpen = !b.cmdOpen; else if (a === 'hd-toggle') b.hdOpen = !b.hdOpen;
      else if (a === 'open') { openDialog(b, act.dataset.for === 'cmd' ? cmdLines(b) : b.out); e.stopPropagation(); return; }
      patch(id); e.stopPropagation(); return;
    }
    const disc = e.target.closest('.disc[aria-controls]'); if (!disc) return;
    const id = disc.closest('[data-live]').dataset.live; const b = state.blocks.find(x => x.id === id);
    b.expanded = !b.expanded; patch(id); e.stopPropagation();
  }, true);
}

// ---------- Shared live pieces ----------
// Bring `el`'s children to `html` in place: same-shaped elements are kept and only
// their attributes and text change, so a live row's button stays the same element.
function morph(el, html) {
  const t = document.createElement('template'); t.innerHTML = html; sync(el, t.content);
}
function sync(cur, next) {
  const a = [...cur.childNodes], b = [...next.childNodes];
  b.forEach((n, i) => {
    const o = a[i];
    if (!o || o.nodeType !== n.nodeType || o.nodeName !== n.nodeName) { o ? cur.replaceChild(n, o) : cur.appendChild(n); return; }
    if (n.nodeType !== 1) { if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue; return; }
    for (const { name } of [...o.attributes]) if (!n.hasAttribute(name)) o.removeAttribute(name);
    for (const { name, value } of [...n.attributes]) if (o.getAttribute(name) !== value) o.setAttribute(name, value);
    sync(o, n);
  });
  for (const o of a.slice(b.length)) o.remove();
}
const elapsed = (state) => { const s = Math.max(0, Math.round((performance.now() - state.t0) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const activity = (state) => { const b = state.blocks[state.blocks.length - 1]; if (!b) return 'Aloittaa'; if (b.t === 'think') return 'Ajattelee'; if (b.t === 'tool') return b.state === 'forming' ? `Muodostaa ${b.name}-kutsua` : b.state === 'running' ? `Ajaa ${b.name}` : 'Jatkaa'; return b.live ? 'Vastaa' : 'Viimeistelee'; };
const toolLabels = { forming: 'muodostaa kutsua…', running: 'ajossa', done: 'valmis' };
function liveToolRow(b) {
  const id = `live-${b.id}`;
  const status = b.state === 'done' ? okMark() : b.state === 'running' ? `<span class="running">ajossa</span>` : `<span class="muted">${toolLabels.forming}</span>`;
  const btn = b.state === 'forming'
    ? `<div class="disc" role="status"><span class="chev"></span><span class="names"><span class="name">${esc(b.name)}</span></span>${status}</div>`
    : `<button class="disc" type="button" aria-expanded="${b.expanded}" aria-controls="${id}">${CHEV}<span class="names"><span class="name">${esc(b.name)}</span><span class="target">${esc(b.target)}</span></span>${status}</button>`;
  let body = '';
  if (b.expanded && b.state !== 'forming') {
    const out = b.out.join('\n');
    body = b.name === 'bash'
      ? `<div class="tool-body">${currentR.cmd(b)}${box(b.out, outView(b), 'out', b, b.state === 'running')}</div>`
      : toolBody({ ...b, result: out || '…' });
  }
  return `<section class="tool">${btn}<div id="${id}"${b.expanded ? '' : ' hidden'}>${body}</div></section>`;
}
function doneThink(b) {
  if (isShort(b.text)) return `<div class="think-row"><span class="lbl">Ajattelu</span><span class="prose">${md(b.text)}</span></div>`;
  const id = `live-${b.id}`;
  return `<div><button class="quiet-btn think-btn" type="button" aria-expanded="${!!b.expanded}" aria-controls="${id}">${CHEV}Ajattelu</button><div id="${id}" class="think-quote"${b.expanded ? '' : ' hidden'} style="margin-top:6px">${md(b.text)}</div></div>`;
}
function liveThink(b) { const lines = b.text.split('\n').filter(Boolean); return `<div class="think-tick"><span class="lbl">Ajattelee</span><span class="line">${inline(lines[lines.length - 1] || '…')}</span></div>`; }
function replyBubble(b, state, head) {
  const body = md(b.text); const caret = b.live && !/<\/(pre|figure|div|ol|ul|blockquote)>$/.test(body) ? '<span class="caret"></span>' : '';
  return `<article class="bubble reply"><div class="bar head">${head}</div><div class="prose">${body}${caret}</div></article>`;
}
const replyHeadDone = () => `<span class="ok">${ICON_CHECK}Vastaus valmis</span><span class="model">${MODEL}</span>${copyBtn('Kopioi vastaus', LIVE.reply)}<time class="meta">14:37</time>`;
const replyHeadLive = () => `<span class="meta" style="font-weight:500">Vastaa</span><span class="model">${MODEL}</span>`;
const block = (b, s) => b.t === 'think' ? (b.live ? liveThink(b) : doneThink(b)) : b.t === 'tool' ? liveToolRow(b) : replyBubble(b, s, b.live ? replyHeadLive() : replyHeadDone());
const workingStrip = (s, withAuthor) => `<div class="strip working">${withAuthor ? `<span class="who">Pi</span><span class="model">${MODEL}</span>` : ''}<span class="act"><span class="live-dot"></span>${activity(s)}</span><span class="clock">${elapsed(s)}</span></div>`;
const settledStrip = (s, sum, withAuthor) => `<button class="strip-btn" type="button" data-fold aria-expanded="${s.open}">${CHEV}${withAuthor ? `<span class="who">Pi</span><span class="model">${MODEL}</span>` : ''}<span class="sum">${sum}</span><span class="dur">${s.dur}</span></button>`;

// ---------- The chosen combination: head once, strip at the end, thread open after settling ----------
let currentR = null;
const threadR = (cmd = cmdRivi) => ({
  headNode: () => `<span class="node head" aria-hidden="true"></span>`,
  // The settled thread's summary and fold live in its head; no strip at the end (Jari 13.10.2026).
  head: (s, sum) => `<div class="head-cell">${s.status === 'settled' ? `<button class="head-btn" type="button" data-fold aria-expanded="${s.open}">${CHEV}<span class="who">Pi</span></button>` : '<span class="who" style="padding-left:1px">Pi</span>'}<span class="model">${MODEL}</span>${s.status === 'settled' ? `<span class="sum">${sum} · ${s.dur}</span>` : ''}</div>`,
  strip: (s) => s.status === 'working' ? workingStrip(s, false) : '', stripPos: 'end', foldOnSettle: false, block, cmd,
});

// Render the history, then play the live turn after it. Cancels a previous play first.
function withLive(cls, R) {
  run++; document.querySelectorAll('.float-bar').forEach(el => el.remove());
  currentR = R;
  const html = lanka(cls, { meta: 'top', fold: 'head', runs: 'separate' });
  requestAnimationFrame(() => { const host = stage.querySelector('.vwrap'); if (host) { following = true; stage.scrollTop = stage.scrollHeight; lastTop = stage.scrollTop; playLive(host, R); } });
  return html;
}
