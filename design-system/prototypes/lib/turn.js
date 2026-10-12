// Lanka: yksi pystylanka vastaukseen päättyvää toimea kohti (historia).
// ---------- Lanka builder: one rail per thread (or per run of threads) ----------
// opts.meta: 'top' | 'bottom' | 'thread'   where the author/status row lives
// opts.fold: 'head' | 'button' | 'auto'     how the work is collapsed
// opts.runs: 'separate' | 'merged'           consecutive threads: own head each, or one rail
function lanka(cls, opts) {
  let i = 0; const out = [];
  const summary = (m) => { const th = m.blocks.filter(b => b.t === 'think').length, to = m.blocks.filter(b => b.t === 'tool').length; return `${th} ajatusta · ${to} työkalua`; };
  const userB = (m) => {
    if (opts.meta === 'bottom') return `<article class="bubble user ah-in" style="--i:${i++}"><div class="prose">${md(m.md)}</div><div class="bar foot"><span class="who">Sinä</span><time class="meta">${m.time}</time>${copyBtn('Kopioi viesti', m.md)}</div></article>`;
    return userBubble(m, i++);
  };
  const replyB = (m, b) => {
    const copy = copyBtn('Kopioi vastaus', b.md);
    if (opts.meta === 'top') return `<article class="bubble reply"><div class="bar head"><span class="ok">${ICON_CHECK}Vastaus valmis</span><span class="model">${MODEL}</span>${copy}<time class="meta">${m.time}</time></div><div class="prose">${md(b.md)}</div></article>`;
    if (opts.meta === 'thread') return `<article class="bubble reply bare"><span class="corner">${copy}</span><div class="prose">${md(b.md)}</div></article>`;
    return `<article class="bubble reply"><div class="prose">${md(b.md)}</div><div class="bar foot"><span class="ok">${ICON_CHECK}Vastaus valmis</span><span class="model">${MODEL}</span><time class="meta">${m.time}</time>${copy}</div></article>`;
  };
  let k = 0;
  while (k < CONVO.length) {
    const m = CONVO[k];
    if (m.kind === 'user') { out.push(userB(m)); k++; continue; }
    // A run of consecutive threads.
    const run = []; while (k < CONVO.length && CONVO[k].kind === 'turn') run.push(CONVO[k++]);
    const rows = [];
    const row = (node, cell, pos) => rows.push(`<div class="rail-cell ${pos || ''} ah-in" style="--i:${i}">${node}</div><div class="cell ah-in" style="--i:${i++}">${cell}</div>`);
    const threads = opts.runs === 'merged' ? [run] : run.map(t => [t]);
    threads.forEach((group, gi) => {
      if (opts.runs !== 'merged' && gi > 0) rows.push(`<div class="cell" style="grid-column:1/-1;height:2px"></div>`);
      const workId = nid();
      const sum = summary(group[0]);
      const folded = opts.fold === 'auto';
      let head;
      if (opts.fold === 'head') head = `<div class="head-cell"><button class="head-btn" type="button" aria-expanded="${!folded}" aria-controls="${workId}" data-sum="${esc(sum)}">${CHEV}<span class="who">Pi</span></button><span class="model">${MODEL}</span><span class="sum" hidden>${sum}</span></div>`;
      else if (opts.fold === 'button') head = `<div class="head-cell"><span class="who">Pi</span><span class="sum" hidden>${sum}</span><button class="quiet-btn" type="button" aria-expanded="true" aria-controls="${workId}" data-open="Tiivistä" data-closed="Näytä työ">Tiivistä</button></div>`;
      else head = `<div class="head-cell"><button class="head-btn" type="button" aria-expanded="false" aria-controls="${workId}">${CHEV}<span class="who">Pi</span></button><span class="model">${MODEL}</span><time class="meta">${group[group.length - 1].time}</time><span class="sum">${sum}</span></div>`;
      row(`<span class="node head" aria-hidden="true"></span>`, head, 'first');
      // Work and replies. In a merged run, all work of all threads is in one foldable group only
      // when folding is per run; otherwise each thread's work folds separately but shares the rail.
      group.forEach((t, ti) => {
        const wid = ti === 0 ? workId : nid();
        if (ti > 0) {
          // A continuation thread on the same rail: a small head-less fold control.
          const s = summary(t);
          if (opts.fold === 'button') row(`<span class="node" aria-hidden="true"></span>`, `<div class="head-cell"><span class="sum" hidden>${s}</span><button class="quiet-btn" type="button" aria-expanded="true" aria-controls="${wid}" data-open="Tiivistä" data-closed="Näytä työ">Tiivistä</button></div>`);
        }
        rows.push(`<div class="work" id="${wid}"${folded ? ' hidden' : ''}>`);
        for (const b of t.blocks) {
          if (b.t === 'think') {
            if (isShort(b.md)) row(`<span class="node" aria-hidden="true"></span>`, `<div class="think-row"><span class="lbl">Ajattelu</span><span class="prose">${md(b.md)}</span></div>`);
            else { const id = nid(); row(`<span class="node" aria-hidden="true"></span>`, `<div><button class="quiet-btn think-btn" type="button" aria-expanded="false" aria-controls="${id}">${CHEV}Ajattelu</button><div id="${id}" class="think-quote" hidden style="margin-top:6px">${md(b.md)}</div></div>`); }
          } else if (b.t === 'tool') row(`<span class="node tool done" aria-hidden="true"></span>`, toolRow(b, i).replace(' ah-in', ''));
        }
        rows.push(`</div>`);
        const reply = t.blocks.find(b => b.t === 'reply');
        const lastOfRun = ti === group.length - 1;
        row(`<span class="node done" aria-hidden="true"></span>`, replyB(t, reply), lastOfRun ? 'last' : '');
      });
    });
    out.push(`<div class="turn">${rows.join('')}</div>`);
  }
  return `<div class="vwrap ${cls}">${out.join('')}</div>`;
}
