// Round 2 (research-workmux-sidebar): how the person moves to the next conversation that needs
// them. Ideas from workmux (report.md §1.5): `last-done` walks the done and waiting agents most
// recent first and cycles on repeat; Alt+j/k and Alt+1…9 follow the order the list shows; the
// top bar of chips (position: top) replaces the sidebar where there is no room.
//
// The directions differ on one axis: where the route to the next one lives.
//   1 Yläpalkki — a Seuraava button in the conversation's top bar with the count of the others.
//   2 Sirut     — a strip of chips under the top bar: Sinun vuorosi first, then Käynnissä,
//                 numbered 1–9 for Alt+1…9.
//   3 Lopussa   — at the end of the conversation, where the reading stops, a card names the
//                 next one and opens it.
// The same in all three: Alt+↓ (and Alt+↑ back) walks Sinun vuorosi, most recent change first,
// skipping the ones already visited in this round of the walk, like `workmux last-done`. The rail
// is today's (flat Käynnissä), with the time on every row.
const { IC, esc, S, ago, yours, convs, isYours, mark, byId, LABEL } = F;
const NAMES = ['Yläpalkki', 'Sirut', 'Lopussa'];
let visited = [];
// The next conversation that needs the person: most recent first, not yet visited in this walk.
function nextOne() {
  const list = yours().filter(c => c.id !== S.cur);
  if (!list.length) return null;
  return list.find(c => !visited.includes(c.id)) ?? list[0];
}
function go(dir = 1) {
  if (dir < 0) {
    const back = visited.slice(0, -1).reverse().find(id => id !== S.cur && byId(id));
    if (!back) { S.toast = 'Ei edellistä tällä kierroksella.'; F.repaint(); return; }
    visited = visited.slice(0, visited.lastIndexOf(back));
    F.open(back);
    return;
  }
  const n = nextOne();
  if (!n) { S.toast = 'Mikään muu ei odota sinua.'; F.repaint(); return; }
  if (!yours().filter(c => c.id !== S.cur).some(c => !visited.includes(c.id))) visited = [];
  F.open(n.id);
}
function nextTitle(n) { return n ? `Seuraava sinun vuorosi: ${n.title} · ${n.ws} (Alt+↓)` : 'Mikään muu ei odota sinua'; }

// 1 Yläpalkki
function topbarButton() {
  const n = nextOne();
  const others = yours().filter(c => c.id !== S.cur).length;
  return `<button type="button" class="nextbtn" data-act="next" data-testid="next" title="${esc(nextTitle(n))}" aria-label="${esc(nextTitle(n))}"${n ? '' : ' aria-disabled="true"'}>
    ${IC.next}<span class="nl">Seuraava</span>${others ? `<span class="badge" aria-hidden="true">${others}</span>` : ''}</button>`;
}

// 2 Sirut
function strip() {
  const y = yours(), r = convs().filter(c => !isYours(c));
  let i = 0;
  const chip = (c) => {
    i++;
    const cur = c.id === S.cur ? ' aria-current="page"' : '';
    return `<li><button type="button" class="chip${isYours(c) ? ' yours' : ''}" data-open="${c.id}" data-testid="chip-${c.id}"${cur} title="${esc(c.title)} · ${esc(c.ws)} · ${LABEL[c.kind]} · ${ago(c.t)}${i <= 9 ? ` (Alt+${i})` : ''}">
      ${i <= 9 ? `<span class="key" aria-hidden="true">${i}</span>` : ''}${mark(c.kind)}<span class="ct">${esc(c.title)}</span><time>${ago(c.t)}</time></button></li>`;
  };
  return `<nav class="strip" aria-label="Keskustelut" data-testid="strip"><ul>
    ${y.map(chip).join('')}${y.length ? '<li class="sep" aria-hidden="true"></li>' : '<li class="none">Mikään ei odota sinua</li><li class="sep" aria-hidden="true"></li>'}${r.map(chip).join('')}</ul></nav>`;
}
function chipAt(k) {
  const order = [...yours(), ...convs().filter(c => !isYours(c))];
  return order[k - 1];
}

// 3 Lopussa
function endCard(c) {
  const n = nextOne();
  if (!n) return `<p class="nextnone" data-testid="next-none">${c && isYours(c) ? 'Muut eivät odota sinua.' : 'Mikään ei odota sinua.'}</p>`;
  const others = yours().filter(x => x.id !== S.cur).length - 1;
  const src = { c1: 'Mergetäänkö satokalenterin prototyyppi nyt vai odotetaanko valintaasi?', c2: 'Pakkaus on nyt build-vaiheessa ja testit ovat vihreinä.', c3: 'Vienti kirjoittaa nyt yhden tiedoston vuorokautta kohden.' }[n.id] ?? '';
  return `<aside class="nextcard" aria-label="Seuraavaksi sinun vuorosi" data-testid="next-card">
    <p class="nh">Seuraavaksi sinun vuorosi${others > 0 ? ` <span class="count">+${others} muuta</span>` : ''}</p>
    <button type="button" class="nb" data-act="next" data-testid="next" title="${esc(nextTitle(n))}">
      ${mark(n.kind)}<span class="txt"><span class="ttl">${esc(n.title)}</span><span class="det">${esc(n.ws)} · ${LABEL[n.kind]} · ${ago(n.t)}</span>${src ? `<span class="ex">${esc(src)}</span>` : ''}</span>
      <span class="go">Avaa ${IC.arrow}</span></button>
    <p class="kh">Alt+↓ avaa seuraavan myös näppäimistöltä.</p></aside>`;
}

F.hooks = {
  topbar: () => S.v === 0 ? topbarButton() : '',
  strip: () => S.v === 1 ? strip() : '',
  streamEnd: (c) => S.v === 2 ? endCard(c) : '',
  // Any route into a conversation (rail, chip, card, key) counts as a visit in this walk.
  after: () => { if (visited[visited.length - 1] !== S.cur) visited.push(S.cur); document.querySelector('.strip [aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); },
  click: (t, a) => { if (a === 'next') go(1); },
  onKey: (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); go(-1); }
    else if (S.v === 1 && /^Digit[1-9]$/.test(e.code)) { const c = chipAt(Number(e.code.slice(5))); if (c) { e.preventDefault(); F.open(c.id); } }
  },
};
const variants = F.setup(NAMES).map(fn => () => { visited = []; return fn(); });
