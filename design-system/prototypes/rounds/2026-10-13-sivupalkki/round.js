// Kierros 13.10.2026 (conversation-actions-layout): sivupalkin keskustelurivit.
// Kirjaston kehys antaa rivin (`APP.row`) ja listan (`APP.list`) hookit; suunnat
// korvaavat ne. Työtiloihin lisätään vanhempia keskusteluja ja aikoja, jotta
// pitkän listan ero näkyy.

const MORE = {
  aurinkokello: [
    { id: 'c7', title: 'README:n esimerkkien päivitys', st: 'done', t: 'eilen' },
    { id: 'c8', title: 'Aikavyöhykkeen käsittely tulosteessa', st: 'done', t: 'ma' },
    { id: 'c9', title: 'Taulukkotulosteen sarakeleveydet', st: 'done', t: '9.10.' },
  ],
  issuectl: [
    { id: 'c10', title: 'Hakusyntaksin negaatiot', st: 'waiting', t: '25 min' },
    { id: 'c11', title: 'JSON-tulosteen skeema', st: 'done', t: '11.10.' },
  ],
};
const TIMES = { c1: 'nyt', c2: '8 min', c3: '2 t', c4: '3 t', c5: 'nyt', c6: 'ma' };
for (const w of UI.ws) {
  for (const c of w.convs) if (TIMES[c.id]) c.t = TIMES[c.id];
  if (MORE[w.id]) w.convs.push(...MORE[w.id]);
}
const label = (c) => STATES[convState(c)] ?? ['Ei aloitettu', '<span class="st-none"></span>'];
const cur = (c) => c.id === UI.sel ? ' aria-current="page"' : '';
const when = (c) => c.st === 'new' ? 'uusi' : (c.id === 'c1' && !UI.working ? '1 min' : c.t || '');

// V1 · Merkki oikealla: the library's row as it is.
const rowRight = convRow;
// V2 · Merkki ja aika: the mark leads the row, the last activity at the right.
function rowLead(c) {
  const [l, mark] = label(c); const s = convState(c);
  return `<a href="#" class="conv-row lead${s === 'attention' ? ' is-new' : ''}" data-conv="${c.id}"${cur(c)}><span class="st" role="img" aria-label="${l}" title="${l}">${mark}</span><span class="conv-title">${esc(c.title)}</span><time class="conv-when">${when(c)}</time></a>`;
}
// V3 · Huomio ensin: open work first; finished ones fold behind one line per workspace.
const FOLD = {};
function listByState(w, convs) {
  const active = convs.filter(c => convState(c) !== 'done');
  const done = convs.filter(c => convState(c) === 'done');
  const order = { new: -1, attention: 0, working: 1, waiting: 2, unknown: 3 };
  active.sort((a, b) => (order[convState(a) ?? a.st] ?? 4) - (order[convState(b) ?? b.st] ?? 4));
  const open = FOLD[w.id] || done.some(c => c.id === UI.sel);
  const rows = active.map(c => `<li>${rowLead(c)}</li>`).join('');
  const fold = done.length ? `<li><button type="button" class="done-fold" data-fold-ws="${w.id}" aria-expanded="${open}">${CHEV}<span>Valmiit</span><span class="count">${done.length}</span></button></li>${open ? done.map(c => `<li>${rowLead(c)}</li>`).join('') : ''}` : '';
  return rows || fold ? `<ul class="convs">${rows}${fold}</ul>` : '';
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-fold-ws]'); if (!b) return;
  FOLD[b.dataset.foldWs] = b.getAttribute('aria-expanded') !== 'true'; paintRail();
});

function show(v) {
  APP.row = v === 'v1' ? rowRight : rowLead;
  APP.list = v === 'v3' ? listByState : convList;
  return appView();
}
const v1 = () => show('v1');
const v2 = () => show('v2');
const v3 = () => show('v3');
