// Variant 2, Sisällysluettelo / etenemispalkki: an index of the whole page
// with the reader's progress in every part of it.
//   Desktop: a thin rail at the left edge. Each person and capability group is
//   a short segment, Alice's day one long one; the segment fills with the
//   steps read (Alice 5/12). It takes no room from the stories: collapsed it
//   is 4 px of line in the page margin; hover or keyboard focus lays the
//   labels over the page beside the same segments, which do not move.
//   Phone: a button in the bottom corner (thumb reach) showing where the
//   reader is (Alice 5/12) opens a sheet with the full index: the day, the
//   six people, the eight groups, install, and back to the top at the bottom
//   of the sheet, under the thumb.
// Nothing moves in the stories: no top chrome, so the engine's line stays.
NAV.variants.push({
  name: 'Hakemisto',
  mount() {
    const { el, esc, sections, wire } = NAV;
    const S = sections();
    const ac = new AbortController();
    const { signal } = ac;
    const total = (k) => (k.story ? k.story.querySelectorAll(':scope > .s1-steps > .s1-step').length : 1);
    // ---------- Desktop rail ----------
    const seg = (k) => `<li class="ix-kid" data-kid="${k.id}" style="--h:${Math.max(14, Math.min(72, total(k) * 5))}px"><a href="${k.href}"><span class="ix-seg"><i></i></span><span class="ix-lbl">${esc(k.label)} <small class="ix-n">0/${total(k)}</small></span></a></li>`;
    const rail = el(`<nav class="ix-rail" aria-label="Page index">
  <a class="ix-top" href="#top"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/></svg><span class="ix-lbl">Back to the top</span></a>
  <ol class="ix-secs">${S.map((s) => `<li class="ix-sec" data-sec="${s.id}"><a class="ix-sec-a" href="#${s.id}"><span class="ix-dot"></span><span class="ix-lbl">${esc(s.label)}</span></a>${s.kids.length ? `<ol class="ix-kids">${s.kids.map(seg).join('')}</ol>` : ''}</li>`).join('')}</ol>
</nav>`);
    // ---------- Phone: button and sheet ----------
    const fab = el(`<button type="button" class="ix-fab" aria-haspopup="dialog" aria-controls="ix-sheet" aria-expanded="false"><svg class="ix-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15"/><circle class="ix-ring-p" cx="18" cy="18" r="15" pathLength="100"/><path d="M12.5 14h11M12.5 18h11M12.5 22h7"/></svg><span class="ix-fab-t"><b>Contents</b><small></small></span></button>`);
    const kidRow = (k) => `<li><a href="${k.href}" data-kid="${k.id}">${k.av || ''}<span class="ix-k-t"><b>${esc(k.label)}</b><small>${esc(k.sub)}</small></span><span class="ix-k-p"><span class="ix-bar" style="--n:${total(k)}"><i></i></span><small class="ix-n">0/${total(k)}</small></span></a></li>`;
    const sheet = el(`<dialog class="ix-sheet" id="ix-sheet" aria-label="Page contents">
  <div class="ix-sh-h"><span>On this page</span><button type="button" class="ix-close" aria-label="Close">✕</button></div>
  <div class="ix-sh-b">${S.map((s) => `<section class="ix-sh-sec" data-sec="${s.id}"><a class="ix-sh-a" href="#${s.id}" data-sec="${s.id}"><b>${esc(s.label)}</b><small>${esc(s.title)}</small></a>${s.kids.length ? `<ul class="ix-sh-kids${s.id === 'can' ? ' ix-two' : ''}">${s.kids.map(kidRow).join('')}</ul>` : ''}</section>`).join('')}</div>
  <p class="ix-sh-f"><a href="#top">↑ Back to the top</a></p>
</dialog>`);
    const pg = document.querySelector('.pg');
    pg.prepend(sheet); pg.prepend(fab); pg.prepend(rail);
    const close = () => { if (sheet.open) sheet.close(); };
    fab.addEventListener('click', () => {
      sheet.showModal(); fab.setAttribute('aria-expanded', 'true');
      // Open at the reader's place, not at the top of a long list.
      sheet.querySelector('[data-kid][aria-current], [data-sec][aria-current]')?.scrollIntoView({ block: 'center' });
    }, { signal });
    sheet.addEventListener('close', () => fab.setAttribute('aria-expanded', 'false'), { signal });
    sheet.querySelector('.ix-close').addEventListener('click', close, { signal });
    // A tap on the backdrop above the sheet closes it.
    sheet.addEventListener('click', (e) => { if (e.clientY < sheet.getBoundingClientRect().top) close(); }, { signal });
    wire(rail, signal);
    wire(sheet, signal, close);
    // The rail and the button come in once the hero is past, or on focus.
    const io = new IntersectionObserver((es) => { const e = es[es.length - 1]; const on = String(!e.isIntersecting && e.boundingClientRect.top < 0); rail.dataset.shown = on; fab.dataset.shown = on; });
    io.observe(document.querySelector('.hero'));
    this.rail = rail; this.fab = fab; this.sheet = sheet;
    this.unmount = () => { ac.abort(); io.disconnect(); close(); rail.remove(); fab.remove(); sheet.remove(); };
  },
  update({ sec, kid, page, prog }) {
    const mark = (nodes, on, val = 'location') => nodes.forEach((n) => (on(n) ? n.setAttribute('aria-current', val) : n.removeAttribute('aria-current')));
    mark(this.rail.querySelectorAll('.ix-sec-a'), (a) => sec && a.getAttribute('href') === `#${sec.id}`);
    mark(this.sheet.querySelectorAll('.ix-sh-a'), (a) => sec && a.dataset.sec === sec.id);
    for (const [k, p] of prog) {
      const f = String(p.done / p.total);
      for (const host of [this.rail, this.sheet]) {
        const a = host.querySelector(`[data-kid="${k.id}"]`);
        if (!a) continue;
        a.style.setProperty('--p', f);
        a.dataset.state = p.state;
        a.querySelector('.ix-n').textContent = `${p.done}/${p.total}`;
      }
    }
    mark(this.rail.querySelectorAll('.ix-kid > a'), (a) => kid && a.parentElement.dataset.kid === kid.id, 'step');
    mark(this.sheet.querySelectorAll('a[data-kid]'), (a) => kid && a.dataset.kid === kid.id, 'step');
    // The button says where the reader is.
    const p = kid && prog.get(kid);
    const here = kid ? `${kid.label} ${p.done}/${p.total}` : sec ? sec.label : 'Top';
    this.fab.querySelector('.ix-fab-t small').textContent = here;
    this.fab.setAttribute('aria-label', `Contents. You are at ${sec ? sec.label + (kid ? `, ${kid.label}, ${p.done} of ${p.total}` : '') : 'the top'}.`);
    this.fab.querySelector('.ix-ring-p').setAttribute('stroke-dasharray', `${(page * 100).toFixed(1)} 100`);
  },
});
