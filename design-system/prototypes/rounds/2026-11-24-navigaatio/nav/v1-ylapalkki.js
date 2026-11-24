// Variant 1, Kiinteä yläpalkki: a slim bar fixed at the top that takes over
// the moment the hero's own top bar scrolls away. Four sections, the current
// one marked; the mark goes back to the top. On the phone the bar is compact
// (mark, current section, Sections) and Sections opens a sheet.
//
// The bar is always there once it has appeared, on both sizes: hiding it on
// scroll down would put a third action (scroll up, open, choose) between the
// bottom of the page and a section on the phone, and move the stories' status
// bar under the reader's thumb every time the direction changes. The stories
// make room for it with one variable, --nav-h (v1-ylapalkki.css).
NAV.variants.push({
  name: 'Yläpalkki',
  mount() {
    const { el, esc, mark, sections, wire } = NAV;
    const S = sections();
    const ac = new AbortController();
    const { signal } = ac;
    const REPO = 'https://github.com/Open-Habitat/open-habitat';
    const links = S.map((s) => `<a href="#${s.id}" data-sec="${s.id}">${esc(s.label)}</a>`).join('');
    // First in the page, so Tab from the top reaches it (and shows it).
    const bar = el(`<header class="tb" data-shown="false">
  <div class="tb-in">
    <a class="tb-logo" href="#top" aria-label="Open Habitat, back to the top">${mark()}<span>Open Habitat</span></a>
    <nav class="tb-nav" aria-label="Sections">${links}</nav>
    <span class="tb-now" aria-hidden="true"></span>
    <span class="tb-ext"><a href="/docs/">Docs</a><a href="${REPO}">GitHub</a></span>
    <button type="button" class="tb-menu" aria-haspopup="dialog" aria-controls="tb-sheet" aria-expanded="false"><span>Sections</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5.5h10M3 10.5h10"/></svg></button>
  </div>
</header>`);
    const sheet = el(`<dialog class="tb-sheet" id="tb-sheet" aria-label="Sections">
  <div class="tb-sheet-h"><span>On this page</span><button type="button" class="tb-close" aria-label="Close">✕</button></div>
  <nav aria-label="Sections"><ol>${S.map((s, i) => `<li><a href="#${s.id}" data-sec="${s.id}"><b>${esc(s.label)}</b><small>${esc(s.title)}</small><span class="tb-n">${i + 1}</span></a></li>`).join('')}</ol></nav>
  <p class="tb-sheet-f"><a href="#top">↑ Back to the top</a><a href="/docs/">Docs</a><a href="${REPO}">GitHub</a></p>
</dialog>`);
    const pg = document.querySelector('.pg');
    pg.prepend(sheet);
    pg.prepend(bar);
    const menu = bar.querySelector('.tb-menu');
    const close = () => { if (sheet.open) sheet.close(); };
    menu.addEventListener('click', () => { sheet.showModal(); menu.setAttribute('aria-expanded', 'true'); }, { signal });
    sheet.addEventListener('close', () => menu.setAttribute('aria-expanded', 'false'), { signal });
    sheet.querySelector('.tb-close').addEventListener('click', close, { signal });
    // A tap on the backdrop (outside the sheet's box) closes it.
    sheet.addEventListener('click', (e) => { const r = sheet.getBoundingClientRect(); if (e.clientY > r.bottom || e.clientY < r.top) close(); }, { signal });
    wire(bar, signal);
    wire(sheet, signal, close);
    // Shown once the hero's own bar has left the viewport, or while focused.
    const heroTop = document.querySelector('.top');
    // Entries can arrive batched (a deep link scrolls right after load): the last one is the state.
    const io = new IntersectionObserver((es) => { bar.dataset.shown = String(!es[es.length - 1].isIntersecting); });
    io.observe(heroTop);
    bar.addEventListener('focusin', () => bar.classList.add('tb-focus'), { signal });
    bar.addEventListener('focusout', (e) => { if (!bar.contains(e.relatedTarget)) bar.classList.remove('tb-focus'); }, { signal });
    this.bar = bar; this.sheet = sheet;
    this.unmount = () => { ac.abort(); io.disconnect(); close(); bar.remove(); sheet.remove(); };
  },
  update({ sec }) {
    const id = sec ? sec.id : null;
    for (const a of [...this.bar.querySelectorAll('[data-sec]'), ...this.sheet.querySelectorAll('[data-sec]')]) {
      if (a.dataset.sec === id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    }
    this.bar.querySelector('.tb-now').textContent = sec ? sec.label : '';
  },
});
