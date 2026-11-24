// Variant 3, Osioiden väliotsikot + paluu: nothing on screen while a story
// is read. Navigation lives in the page itself:
//   - between sections a "where next" strip: the next section as the obvious
//     way on, the people or groups inside it as cards, and the other sections;
//     after the install section a last strip covers the whole page, so from
//     the bottom every section is one tap away;
//   - each main section's heading sticks for the length of its intro
//     (v3-valiotsikot.css), so the reader entering a section sees its name;
//   - a small back-to-top button appears only when the reader scrolls up a
//     little (intent to go back), and leaves again on scroll down.
// In a port the strips are written by render.mjs between the sections; here
// they are inserted on mount, before the reader has scrolled, so they never
// shift a story under the reader.
NAV.variants.push({
  name: 'Väliotsikot',
  mount() {
    const { el, esc, sections, wire, $ } = NAV;
    const S = sections();
    const by = Object.fromEntries(S.map((s) => [s.id, s]));
    const ac = new AbortController();
    const { signal } = ac;
    const DESC = { day: 'Ten conversations in one Thursday', roles: 'Six colleagues, three moments each', can: 'Eight kinds of work, from video to maps', install: 'One server, set up once' };
    const path = (here) => `<ol class="wn-path" aria-label="Sections">${[['top', 'Top'], ...S.map((s) => [s.id, s.label])].map(([id, l]) => `<li><a href="#${id}"${id === here ? ' aria-current="location"' : ''}>${esc(l)}</a></li>`).join('')}</ol>`;
    const people = () => `<ul class="wn-people" aria-label="People">${by.roles.kids.map((k) => `<li><a href="${k.href}">${k.av}<span><b>${esc(k.label)}</b>${esc(k.sub)}</span></a></li>`).join('')}</ul>`;
    const groups = () => `<ul class="wn-groups" aria-label="Capability groups">${by.can.kids.map((k) => `<li><a href="${k.href}">${esc(k.label)}</a></li>`).join('')}</ul>`;
    const card = (id, kicker) => `<a class="wn-card" href="#${id}"><small>${kicker}</small><b>${esc(by[id].title)}</b><span>${esc(DESC[id])}</span></a>`;
    const strip = (n, here, next, inner, others, last = false) => el(`<aside class="wn${last ? ' wn-last' : ''}" aria-labelledby="wn-h-${n}">
  <div class="wn-in">
    <div class="wn-head"><h2 class="wn-k" id="wn-h-${n}">${last ? 'Back through the page' : `End of ${esc(by[here].label.toLowerCase())} · where next`}</h2>${path(here)}</div>
    ${next ? `<div class="wn-next">${card(next, 'Next')}${inner}</div>` : inner}
    ${others.length ? `<div class="wn-others">${others.map((id) => (id === 'top' ? '<a class="wn-o wn-top-link" href="#top">↑ Back to the top</a>' : `<a class="wn-o" href="#${id}">${esc(by[id].label)}</a>`)).join('')}</div>` : ''}
  </div>
</aside>`);
    const strips = [
      [$('.day-end'), strip(1, 'day', 'roles', people(), ['can', 'install', 'top'])],
      [by.roles.el, strip(2, 'roles', 'can', groups(), ['day', 'install', 'top'])],
      [by.can.el, strip(3, 'can', 'install', '', ['day', 'roles', 'top'])],
      [by.install.el, strip(4, 'install', null, `<div class="wn-all">${card('day', 'One person')}<div class="wn-col">${card('roles', 'The team')}${people()}</div><div class="wn-col">${card('can', 'What it can do')}${groups()}</div></div>`, ['top'], true)],
    ];
    for (const [after, s] of strips) { after.after(s); wire(s, signal); }
    // ---------- Back to the top, on scroll-up intent ----------
    const btn = el(`<a class="wn-up" href="#top" data-shown="false"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/></svg><span>Top</span></a>`);
    document.querySelector('.pg').append(btn);
    wire(btn, signal);
    let lastY = scrollY; let up = 0; let down = 0;
    const UP = 56; const DOWN = 16;
    addEventListener('scroll', () => {
      const y = scrollY; const dy = y - lastY; lastY = y;
      if (dy < 0) { up -= dy; down = 0; } else if (dy > 0) { down += dy; up = 0; }
      const far = y > innerHeight * 1.5;
      if (!far || down > DOWN) btn.dataset.shown = 'false';
      else if (up > UP) btn.dataset.shown = 'true';
    }, { passive: true, signal });
    this.strips = strips.map(([, s]) => s);
    this.unmount = () => { ac.abort(); this.strips.forEach((s) => s.remove()); btn.remove(); };
  },
});
