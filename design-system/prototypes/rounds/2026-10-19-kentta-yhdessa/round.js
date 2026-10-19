// Kenttä yhdessä (proto-composer-combined, 19.10.2026). Jarin yhdistelmä kierrokselta
// 2026-10-19-kentan-lisat: Komennot- ja Tiedosto-painikkeet, kirjoitettu `/` ja `@` kursorissa,
// `!`/`!!` vain kirjoitettuina ja Ctrl/⌘+P paletiksi. Kierros laajentaa kirjaston alakertaa
// (lib/composer.js) koskematta siihen: se kuuntelee samaa kenttää, sieppaa näppäimet ennen
// kentän omaa Enter-käsittelyä ja lisää omat palansa kentän ympärille. Painikkeen valikko ja
// kursorin lista ovat sama lista (`paintList`) kahdessa paikassa; suunnat eroavat vain siinä,
// missä painikkeet ovat ja kuinka painavia ne ovat.
(() => {
const comp = document.querySelector('.composer');
const ta = comp.querySelector('textarea');
const cbox = comp.querySelector('.cbox');
const cwrap = comp.querySelector('.cwrap');
const uiMainEl = document.querySelector('.main');
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';
const WS = '~/src/aurinkokello';
const XS = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON_SLASH = XS('<path d="M15 4 9 20"/>');
const ICON_AT = XS('<circle cx="12" cy="12" r="3.5"/><path d="M15.5 12v1.5a2.5 2.5 0 0 0 5 0V12a8.5 8.5 0 1 0-3.3 6.7"/>');
const ICON_FILE = XS('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>');
const ICON_DOWN = XS('<path d="m7 10 5 5 5-5"/>');
const ICON_RUN = XS('<path d="M7 5v14l11-7z"/>');
const ICON_STOP_SM = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>';

// ---------- Shared content: what Pi and the workspace would answer ----------
// The Pi command list as `get_commands` returns it (Pi 1.3.0), the daemon's recap command
// filtered out. In a conversation whose Pi is not running, the short-lived list-only helper
// answers the same list after about a second. Commands that need Pi's TUI are listed, not hidden.
const COMMANDS = [
  { name: 'skill:git-commit', d: 'Stage and commit working-tree changes as one or more well-formed commits with useful messages.', src: 'skill', scope: 'user', path: '~/.pi/agent/skills/git-commit/SKILL.md' },
  { name: 'skill:pytest-debug', d: 'Find why a pytest test fails and fix the smallest cause first.', src: 'skill', scope: 'project', path: `${WS}/.pi/skills/pytest-debug/SKILL.md` },
  { name: 'skill:issue', d: 'Manage issues and epics in issues/ with the issuectl CLI.', src: 'skill', scope: 'user', path: '~/.pi/agent/skills/issue/SKILL.md' },
  { name: 'skill:llm-review', d: 'Evidence-gated review of code, a diff, a plan, or a document for real defects.', src: 'skill', scope: 'user', path: '~/.pi/agent/skills/llm-review/SKILL.md' },
  { name: 'fix-tests', d: 'Fix failing tests', src: 'prompt', scope: 'project', args: '<polku>', path: `${WS}/.pi/prompts/fix-tests.md` },
  { name: 'review', d: 'Review the working-tree diff before committing', src: 'prompt', scope: 'user', path: '~/.pi/agent/prompts/review.md' },
  { name: 'changelog', d: 'Draft a changelog entry from the commits since the last tag', src: 'prompt', scope: 'user', path: '~/.pi/agent/prompts/changelog.md' },
  { name: 'mcp', d: 'Manage MCP servers: sign in, reconnect, enable or disable, and change exposure', src: 'extension', scope: 'builtin', path: 'builtin:mcp', tui: true },
  { name: 'llama', d: 'Manage llama.cpp router models', src: 'extension', scope: 'builtin', path: 'builtin:llama.cpp', tui: true },
];
// Browser actions for Pi's TUI built-ins (/new, /model) that the RPC list leaves out; they run at once.
const BROWSER = [
  { name: 'uusi', d: 'Uusi keskustelu työtilassa aurinkokello', act: () => newConversation() },
  { name: 'malli', d: 'Malli ja ajattelutaso', act: () => modelAction() },
];
const SRC = { skill: 'Taito', prompt: 'Pohja', extension: 'Laajennus' };
const SCOPE = { user: 'oma', project: 'projekti', builtin: 'Pi' };
// The workspace as `git ls-files --cached --others --exclude-standard` lists it, with
// `git status --porcelain` marks; ignored files never appear.
const FILES = [
  ['scripts/status_rows.py', 'M'], ['tests/test_status_rows.py', 'M'], ['notes/2026-10-13-status.md', '??'],
  ['status.md'], ['README.md'], ['pyproject.toml'], ['Makefile'], ['LICENSE'], ['.gitignore'],
  ['scripts/__init__.py'], ['scripts/aurinko.py'], ['scripts/kello.py'], ['scripts/sunrise_table.py'],
  ['tests/__init__.py'], ['tests/test_kello.py'], ['tests/test_sunrise_table.py'],
  ['tests/fixtures/status-2026-10.md'], ['tests/fixtures/paikat.json'],
  ['docs/kaytto.md'], ['docs/arkkitehtuuri.md'], ['data/paikat.csv'], ['data/aikavyohykkeet.json'],
  ['.github/workflows/ci.yml'],
].map(([p, g]) => ({ p, g }));
const PREVIEW = {
  'scripts/status_rows.py': { diff: [...OLD.split('\n').map(l => '-' + l), ...NEW.split('\n').map(l => '+' + l)] },
  'tests/test_status_rows.py': { diff: ['+def test_fixed_today():', '+    rows = select(ROWS, None, date(2026, 10, 13))', '+    assert [r["päivä"] for r in rows] == ["2026-10-07", "2026-10-13"]'] },
  'notes/2026-10-13-status.md': { text: '# Statusrivit 13.10.\n\n- --since oletus seitsemän päivää\n- taulukkotuloste --table\n- päivämäärä parametrina testejä varten' },
  'README.md': { text: '# aurinkokello\n\nPieni työkalu, joka laskee auringonnousun ja -laskun\npaikoille ja tulostaa viikon statusrivit.\n\n    make test\n    python3 scripts/status_rows.py --since 2026-10-06' },
  'pyproject.toml': { text: '[project]\nname = "aurinkokello"\nversion = "0.4.0"\nrequires-python = ">=3.11"\n\n[tool.pytest.ini_options]\ntestpaths = ["tests"]' },
  'Makefile': { text: 'test:\n\tpython3 -m pytest -q\n\nserve:\n\tpython3 -m http.server 8000 --directory docs' },
};
const OUT = {
  'git status': { lines: ['On branch main', "Your branch is up to date with 'origin/main'.", '', 'Changes not staged for commit:', '  (use "git add <file>..." to update what will be committed)', '\tmodified:   scripts/status_rows.py', '\tmodified:   tests/test_status_rows.py', '', 'Untracked files:', '\tnotes/2026-10-13-status.md', '', 'no changes added to commit (use "git add" and/or "git commit -a")'], exit: 0 },
  'git diff --stat': { lines: [' scripts/status_rows.py    | 14 +++++++++-----', ' tests/test_status_rows.py |  9 +++++++++', ' 2 files changed, 18 insertions(+), 5 deletions(-)'], exit: 0 },
  'ls': { lines: ['LICENSE  Makefile  README.md  data  docs  notes  pyproject.toml  scripts  status.md  tests'], exit: 0 },
  'pytest -q': { lines: ['..........F.', '=================================== FAILURES ===================================', '____________________________ test_since_default ____________________________', '    def test_since_default():', '>       assert len(select(ROWS, None, TODAY)) == 3', 'E       assert 2 == 3', 'tests/test_status_rows.py:41: AssertionError', '=========================== short test summary info ============================', 'FAILED tests/test_status_rows.py::test_since_default - assert 2 == 3', '1 failed, 11 passed in 0.84s'], exit: 1, step: 260 },
  'make serve': { lines: ['python3 -m http.server 8000 --directory docs', 'Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...', '127.0.0.1 - - [19/Oct/2026 10:42:07] "GET / HTTP/1.1" 200 -'], exit: null, step: 700 },
};
OUT['git diff'] = OUT['git diff --stat'];
OUT['make test'] = OUT['pytest -q'];
const outputFor = (cmd) => OUT[cmd.trim()] ?? { lines: [`(vedos: komennolle \`${cmd.trim()}\` ei ole esimerkkitulostetta)`], exit: 0 };
const shq = (p) => /^[\w@%+=:,./-]+$/.test(p) ? p : `'${p.replace(/'/g, `'\\''`)}'`;

// ---------- State ----------
// P is the open choice: { kind: 'cmd'|'file', place: 'caret'|'button'|'palette', start, end,
// query, sel, marks, tab, atStart, replace }. `replace` means accepting replaces start..end
// (the typed token); otherwise the choice is inserted at the caret the field had.
const X = { dir: 1, running: null, seq: 0, caret: null, listed: new Set() };
let P = null;
const dir = () => X.dir;
// As in Pi: a leading `!` runs the text in the workspace, `!!` keeps the output from Pi.
const shellActive = () => /^!/.test(ta.value);
const ctxActive = () => !/^!!/.test(ta.value);
const commandText = () => ta.value.replace(/^!!?/, '').trim();
const conv = () => selConv();
const isNew = () => isEmpty(conv());

// ---------- Matching ----------
function score(s, q) {
  if (!q) return 1;
  s = s.toLowerCase(); q = q.toLowerCase();
  let i = 0, last = -2, sc = 0;
  for (const ch of q) {
    const j = s.indexOf(ch, i); if (j < 0) return 0;
    sc += (j === last + 1 ? 3 : 1) + (j === 0 || '/._-:'.includes(s[j - 1]) ? 2 : 0); last = j; i = j + 1;
  }
  return sc + (s.includes(q) ? 6 : 0) - s.length * 0.01;
}
// A command chosen from a button or the palette goes to the start of the message, where Pi runs
// it; a typed `/` mid-line stays where it was typed and is only a mention.
const runsAtStart = () => P.place !== 'caret' || P.atStart;
const piLoading = () => isNew() && !X.listed.has(conv().id);
function cmdItems(q) {
  const start = runsAtStart();
  const by = (a, b) => b.s - a.s;
  const br = start ? BROWSER.map(c => ({ ...c, k: 'browser', s: score(c.name, q) })).filter(c => c.s > 0).sort(by).map(c => ({ ...c, group: 'Selain · ajetaan heti' })) : [];
  if (piLoading()) return [...br, { loading: true, group: 'Pi' }];
  const pi = COMMANDS.map(c => ({ ...c, k: 'pi', s: Math.max(score(c.name, q), score(c.d, q) * 0.4) })).filter(c => c.s > 0).sort(by);
  return [...br, ...pi.map(c => ({ ...c, group: start ? 'Pi · lisätään viestin alkuun, ajetaan lähetettäessä' : 'Pi · mainitaan tekstinä' }))];
}
function fileItems(q, tab) {
  let list = FILES.map(f => ({ ...f, s: score(f.p, q) })).filter(f => f.s > 0);
  if (tab === 'changed') list = list.filter(f => f.g);
  if (!q) return [...list.filter(f => f.g).map(f => ({ ...f, group: 'Muutetut' })), ...list.filter(f => !f.g).map(f => ({ ...f, group: 'Tiedostot' }))];
  return list.sort((a, b) => b.s - a.s).map(f => ({ ...f, group: 'Osumat' }));
}
const items = () => !P ? [] : (P.kind === 'cmd' ? cmdItems(P.query) : fileItems(P.query, P.tab));
const pickable = (it) => it && !it.loading && !it.tui;

// ---------- The token at the caret ----------
function caretToken() {
  const pos = ta.selectionStart; if (pos !== ta.selectionEnd) return null;
  if (shellActive()) return null; // in a command, `@` and `/` are the shell's own text
  const before = ta.value.slice(0, pos);
  let m = before.match(/(^|\s)@([^\s]*)$/);
  if (m) return { kind: 'file', start: pos - m[2].length - 1, end: pos, query: m[2] };
  // `/` opens only at a word start and only for name characters, so /tmp/notes.md closes it.
  m = before.match(/(^|\s)\/([\w:.-]*)$/);
  if (m) { const start = pos - m[2].length - 1; return { kind: 'cmd', start, end: pos, query: m[2], atStart: before.slice(0, start).trim() === '' }; }
  return null;
}
// Insertion goes through the editor's own insertText so Ctrl+Z undoes it like typing.
function replaceRange(start, end, text) {
  ta.focus(); ta.setSelectionRange(start, end);
  if (!document.execCommand('insertText', false, text)) { ta.setRangeText(text, start, end, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
}
function accept(i) {
  const list = P.list ?? [];
  const marked = P.marks?.size ? list.filter(it => P.marks.has(it.p)) : [list[i]].filter(Boolean);
  const it = marked[0]; if (!it || it.loading) return;
  if (it.tui) return toast(`/${it.name} käyttää Pi:n päätteen valikkoja, joten sitä ei voi ajaa selaimesta.`);
  const o = P; close();
  if (it.k === 'browser') { if (o.replace) replaceRange(o.start, o.end, ''); return it.act(); }
  if (it.k === 'pi') {
    if (o.place === 'caret' && o.replace) return replaceRange(o.start, o.end, `/${it.name} `);
    // From a button or the palette: at the start of the message, replacing a command already there.
    const lead = ta.value.match(/^\/[\w:.-]+ ?/);
    return replaceRange(0, lead ? lead[0].length : 0, `/${it.name} `);
  }
  const text = marked.map(f => shellActive() ? shq(f.p) : `@${f.p}`).join(' ') + ' ';
  if (o.replace) return replaceRange(o.start, o.end, text);
  const pad = o.start > 0 && !/\s/.test(ta.value[o.start - 1]) ? ' ' : '';
  replaceRange(o.start, o.end, pad + text);
}

// ---------- The one list, at the caret or at its button ----------
const listId = 'x-list';
function rowHtml(it, i, sel, marks) {
  const id = `x-opt-${i}`;
  const on = i === sel ? ' aria-selected="true"' : ' aria-selected="false"';
  if (it.loading) return `<li class="x-empty x-loading" role="presentation"><span class="live-dot"></span>Haetaan Pi:n komennot ja taidot työtilasta…</li>`;
  if (it.p) {
    const mark = marks ? `<span class="x-mark" aria-hidden="true">${marks.has(it.p) ? '●' : ''}</span>` : '';
    const slash = it.p.lastIndexOf('/');
    const git = it.g ? `<span class="x-git g-${it.g === 'M' ? 'm' : 'u'}" title="${it.g === 'M' ? 'muutettu' : 'uusi, ei versionhallinnassa'}">${it.g === 'M' ? 'M' : 'U'}</span>` : '';
    return `<li role="option" id="${id}" data-i="${i}"${on}>${mark}<span class="x-ic">${ICON_FILE}</span><span class="x-path"><span class="x-dir">${esc(it.p.slice(0, slash + 1))}</span>${esc(it.p.slice(slash + 1))}</span>${git}</li>`;
  }
  const tag = it.k === 'browser' ? '<span class="x-tag run">Selain</span>' : `<span class="x-tag s-${it.src}">${SRC[it.src]} · ${SCOPE[it.scope]}</span>`;
  const why = it.tui ? '<span class="x-why">vain Pi:n päätteessä</span>' : '';
  const d = it.name === 'malli' ? `${it.d}: ${isNew() ? 'Pi:n oletus' : `gpt-5.5 · ${THINKING}`}` : it.d;
  return `<li role="option" id="${id}" data-i="${i}"${on}${it.tui ? ' aria-disabled="true"' : ''}><span class="x-name">/${esc(it.name)}${it.args ? ` <span class="x-args">${esc(it.args)}</span>` : ''}</span><span class="x-desc">${esc(d)}</span>${why}${tag}</li>`;
}
function groupedList(list, sel, marks) {
  let g = null; let html = '';
  list.forEach((it, i) => { if (it.group !== g) { g = it.group; html += `<li class="x-group" role="presentation">${esc(g)}</li>`; } html += rowHtml(it, i, sel, marks); });
  return html || `<li class="x-empty" role="presentation">Ei osumia${P.query ? ` haulle “${esc(P.query)}”` : ''}.</li>`;
}
const headText = () => P.kind === 'cmd'
  ? (runsAtStart() ? 'Komennot ja taidot' : 'Mainitse komento: Pi ajaa komennon vain viestin alussa')
  : (shellActive() ? 'Tiedostot · lisätään komentoon polkuna' : 'Tiedostot · aurinkokello');
function keysText() {
  if (P.place === 'caret' && P.sel < 0) return `<kbd>Tab</kbd> lisää ylimmän · <kbd>↓</kbd> valitsee · <kbd>Enter</kbd> lähettää tekstin sellaisenaan · <kbd>Esc</kbd> sulje`;
  const more = P.kind === 'file' ? ` · <kbd>${MOD}</kbd><kbd>P</kbd> valitsin` : '';
  return `<kbd>↑</kbd><kbd>↓</kbd> valitse · <kbd>Enter</kbd> lisää · <kbd>Esc</kbd> sulje${more}`;
}
function caretX(pos) {
  const cs = getComputedStyle(ta); const m = document.createElement('div');
  for (const k of ['font', 'letterSpacing', 'padding', 'border', 'boxSizing', 'lineHeight']) m.style[k] = cs[k];
  Object.assign(m.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', width: ta.offsetWidth + 'px', top: '0', left: '0' });
  m.textContent = ta.value.slice(0, pos); const s = document.createElement('span'); s.textContent = '​'; m.appendChild(s);
  cbox.appendChild(m); const x = s.offsetLeft + ta.offsetLeft; m.remove(); return x;
}
const anchorBtn = () => cwrap.querySelector(`[data-x="${P.kind === 'cmd' ? 'cmds' : 'files'}"]`);
function paintList() {
  let pop = cbox.querySelector('.x-pop');
  const fresh = !pop || pop.dataset.place !== P.place || pop.dataset.kind !== P.kind;
  if (fresh) {
    pop?.remove();
    pop = document.createElement('div'); pop.className = 'x-pop'; pop.dataset.place = P.place; pop.dataset.kind = P.kind; cbox.appendChild(pop);
    pop.addEventListener('mousedown', (e) => { if (!e.target.closest('input')) e.preventDefault(); });
    pop.addEventListener('click', onListClick);
    // Opened from a button, the list has its own search line where the caret list has its title.
    const top = P.place === 'button'
      ? `<label class="x-search">${P.kind === 'cmd' ? ICON_SLASH : ICON_AT}<input type="text" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="${listId}" aria-label="${P.kind === 'cmd' ? 'Hae komentoa tai taitoa' : 'Hae tiedostoa'}" placeholder="${P.kind === 'cmd' ? 'Hae komentoa tai taitoa' : 'Hae tiedostoa'}"></label>`
      : '';
    pop.innerHTML = `<div class="x-head"><span class="x-title"></span></div>${top}<ul role="listbox" id="${listId}"></ul><div class="x-keys"></div>`;
    const inp = pop.querySelector('input');
    if (inp) {
      inp.value = P.query;
      inp.addEventListener('input', () => { P.query = inp.value; P.sel = 0; paintList(); });
      inp.addEventListener('keydown', listKeys);
      requestAnimationFrame(() => inp.focus());
    }
  }
  const list = items(); P.list = list;
  if (P.sel >= list.length) P.sel = Math.max(0, list.length - 1);
  if (P.sel >= 0 && !pickable(list[P.sel]) && list.some(pickable) && list[P.sel]?.loading) P.sel = list.findIndex(pickable);
  pop.querySelector('.x-title').textContent = headText();
  const ul = pop.querySelector('ul'); ul.setAttribute('aria-label', headText()); ul.innerHTML = groupedList(list, P.sel);
  pop.querySelector('.x-keys').innerHTML = keysText();
  position(pop);
  const inp = pop.querySelector('input');
  if (inp) inp.setAttribute('aria-activedescendant', list[P.sel] && !list[P.sel].loading ? `x-opt-${P.sel}` : '');
  else aria(true);
  pop.querySelector('[aria-selected="true"][role="option"]')?.scrollIntoView({ block: 'nearest' });
  for (const b of cwrap.querySelectorAll('[data-x="cmds"], [data-x="files"]')) b.setAttribute('aria-expanded', String(P.place === 'button' && b === anchorBtn()));
}
// Above the field either way: at the caret's x when typed, at the button's edge when clicked.
function position(pop) {
  const cb = cbox.getBoundingClientRect();
  const w = Math.min(cbox.clientWidth, P.kind === 'cmd' ? 460 : 400);
  let top = cb.top, left;
  if (P.place === 'button' && anchorBtn()) {
    const r = anchorBtn().getBoundingClientRect();
    top = Math.min(cb.top, r.top);
    left = dir() === 3 ? r.right - cb.left - w : r.left - cb.left - 4;
  } else left = caretX(P.start) - 14;
  pop.style.width = w + 'px';
  pop.style.left = Math.max(0, Math.min(left, cbox.clientWidth - w)) + 'px';
  pop.style.bottom = (cb.bottom - top + 6) + 'px';
}
function aria(open) {
  ta.setAttribute('aria-expanded', String(open));
  if (open) { ta.setAttribute('role', 'combobox'); ta.setAttribute('aria-controls', listId); ta.setAttribute('aria-activedescendant', P?.list?.length && P.sel >= 0 && !P.list[P.sel]?.loading ? `x-opt-${P.sel}` : ''); }
  else { ta.removeAttribute('aria-activedescendant'); ta.removeAttribute('aria-controls'); ta.removeAttribute('role'); }
}

// ---------- Ctrl/⌘+P: Ponnahdus's palette over the conversation ----------
function paintPalette() {
  let host = uiMainEl.querySelector('.x-pal-host');
  if (!host) {
    host = document.createElement('div'); host.className = 'x-pal-host';
    host.innerHTML = `<div class="x-scrim" data-x="close"></div><div class="x-pal" role="dialog" aria-modal="true" aria-label="Valitse tiedostot tai komento"><div class="x-tabs" role="tablist"></div><label class="x-search"><span class="x-sic"></span><input type="text" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="${listId}" aria-label="Hae"></label><div class="x-body"><ul role="listbox" id="${listId}"></ul><div class="x-prev" aria-live="polite"></div></div><div class="x-keys"></div></div>`;
    uiMainEl.appendChild(host);
    const inp = host.querySelector('input');
    inp.addEventListener('input', () => { P.query = inp.value; P.sel = 0; paintPal(); });
    inp.addEventListener('keydown', listKeys);
    host.addEventListener('click', (e) => {
      if (e.target.closest('[data-x="close"]')) return close(true);
      const tab = e.target.closest('[data-tab]'); if (tab) { setTab(tab.dataset.tab); return inp.focus(); }
      onListClick(e);
    });
  }
  const inp = host.querySelector('input');
  if (inp.value !== P.query) inp.value = P.query;
  paintPal();
  if (document.activeElement !== inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}
const TABS = [['changed', 'Muutetut'], ['all', 'Tiedostot'], ['cmd', 'Komennot']];
function setTab(t) { P.tab = t; P.kind = t === 'cmd' ? 'cmd' : 'file'; P.sel = 0; paintPal(); }
function paintPal() {
  const host = uiMainEl.querySelector('.x-pal-host'); if (!host || !P) return;
  const list = items(); P.list = list;
  if (P.sel >= list.length) P.sel = Math.max(0, list.length - 1);
  const changed = FILES.filter(f => f.g).length;
  host.querySelector('.x-tabs').innerHTML = TABS.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${P.tab === k}">${l}${k === 'changed' ? ` <span class="n">${changed}</span>` : ''}</button>`).join('');
  host.querySelector('.x-sic').innerHTML = P.tab === 'cmd' ? ICON_SLASH : ICON_AT;
  const inp = host.querySelector('input');
  inp.placeholder = P.tab === 'cmd' ? 'Hae komentoa tai taitoa' : 'Hae tiedostoa · Tab merkitsee useamman';
  inp.setAttribute('aria-activedescendant', list.length && !list[P.sel]?.loading ? `x-opt-${P.sel}` : '');
  host.querySelector('ul').innerHTML = groupedList(list, P.sel, P.tab === 'cmd' ? null : P.marks);
  host.querySelector('.x-prev').innerHTML = previewHtml(list[P.sel]);
  const n = P.marks.size;
  host.querySelector('.x-keys').innerHTML = (P.tab === 'cmd'
    ? `<kbd>↑</kbd><kbd>↓</kbd> valitse · <kbd>Enter</kbd> lisää viestin alkuun`
    : `<kbd>Tab</kbd> merkitse · <kbd>Enter</kbd> ${n > 1 ? `lisää ${n} polkua` : 'lisää polku'}`)
    + ` · <kbd>${MOD}</kbd><kbd>P</kbd> seuraava välilehti · <kbd>Esc</kbd> takaisin kenttään`
    + (P.tab === 'cmd' ? '' : `<span class="x-where">lisätään muodossa ${shellActive() ? '<code>polku</code> komentoon' : '<code>@polku</code>'}</span>`);
  host.querySelector('[aria-selected="true"][role="option"]')?.scrollIntoView({ block: 'nearest' });
}
function previewHtml(it) {
  if (!it) return '<p class="x-none">Ei valittua.</p>';
  if (it.loading) return '<p class="x-none">Pi:n komentolista haetaan työtilasta.</p>';
  if (!it.p) {
    const ex = it.k === 'browser' ? 'Ajetaan heti, kun valitset sen. Ei lähetä mitään Pi:lle.' : it.tui ? 'Tämä laajennuksen komento avaa Pi:n päätteen valikon, joten selain ei voi ajaa sitä.' : `Lisätään viestin alkuun. Kun lähetät viestin, Pi ${it.src === 'skill' ? 'lataa taidon' : 'laajentaa pohjan'} ja aloittaa työn.`;
    return `<h4>/${esc(it.name)}</h4><p>${esc(it.d)}</p><dl><dt>Lähde</dt><dd>${it.k === 'browser' ? 'Selain' : `${SRC[it.src]} · ${SCOPE[it.scope]}`}</dd>${it.path ? `<dt>Tiedosto</dt><dd class="mono">${esc(it.path)}</dd>` : ''}</dl><p class="x-explain">${ex}</p>`;
  }
  const pv = PREVIEW[it.p];
  if (pv?.diff) return `<h4 class="mono">${esc(it.p)} <span class="x-git g-m">M</span></h4><pre class="x-diff">${pv.diff.map(l => `<span class="${l[0] === '+' ? 'add' : 'del'}">${esc(l)}</span>`).join('\n')}</pre>`;
  if (pv?.text) return `<h4 class="mono">${esc(it.p)}${it.g ? ' <span class="x-git g-u">U</span>' : ''}</h4><pre>${esc(pv.text)}</pre>`;
  return `<h4 class="mono">${esc(it.p)}</h4><p class="x-none">Esikatselu: tiedoston alku luettaisiin tässä (vedoksessa ei sisältöä).</p>`;
}

// ---------- Opening and closing ----------
function paintChoice() { if (!P) return; if (P.place === 'palette') return paintPalette(); paintList(); }
function close(refocus) {
  const had = P; P = null;
  cbox.querySelector('.x-pop')?.remove(); uiMainEl.querySelector('.x-pal-host')?.remove();
  aria(false);
  for (const b of cwrap.querySelectorAll('[aria-expanded]')) if (b !== ta) b.setAttribute('aria-expanded', 'false');
  if (refocus && had) { ta.focus(); const at = had.replace ? had.end : had.start; ta.setSelectionRange(at, had.replace ? at : had.end); }
}
function onListClick(e) {
  const li = e.target.closest('li[data-i]'); if (!li || !P) return;
  P.sel = Number(li.dataset.i); accept(P.sel);
}
function move(d) {
  const list = P.list ?? []; const n = list.length; if (!list.some(pickable) && !list.some(it => it.tui)) return;
  let i = P.sel < 0 ? (d > 0 ? -1 : n) : P.sel;
  do { i = (i + d + n) % n; } while (list[i]?.loading);
  P.sel = i; paintChoice();
}
function listKeys(e) {
  if (e.isComposing || e.keyCode === 229) return;
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p') { e.preventDefault(); e.stopPropagation(); return P.place === 'palette' ? setTab(TABS[(TABS.findIndex(t => t[0] === P.tab) + 1) % TABS.length][0]) : toPalette(); }
  if (e.key === 'ArrowDown') { e.preventDefault(); return move(1); }
  if (e.key === 'ArrowUp') { e.preventDefault(); return move(-1); }
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return close(true); }
  if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    if (P.place === 'palette' && P.tab !== 'cmd') { const it = P.list[P.sel]; if (!it) return; P.marks.has(it.p) ? P.marks.delete(it.p) : P.marks.add(it.p); return move(1); }
    return accept(P.sel < 0 ? 0 : P.sel);
  }
  if (e.key === 'Enter') { e.preventDefault(); return accept(P.sel); }
}
function fromText() {
  if (P && P.place !== 'caret') return;
  const t = caretToken();
  if (!t) { if (P) close(); return; }
  const same = P && P.kind === t.kind && P.start === t.start;
  // Mid-line `/` opens with nothing highlighted, so Enter still sends the text as written.
  P = { ...t, place: 'caret', replace: true, sel: same ? P.sel : (t.kind === 'cmd' && !t.atStart ? -1 : 0), marks: null, tab: 'all' };
  paintChoice(); listPi();
}
// The field's caret when the button was pressed; a keyboard user has left the field by then.
function fieldCaret() {
  if (document.activeElement === ta) return [ta.selectionStart, ta.selectionEnd];
  return X.caret ?? [ta.value.length, ta.value.length];
}
function fromButton(kind) {
  if (P?.place === 'button' && P.kind === kind) return close(true);
  const [start, end] = fieldCaret();
  close();
  P = { kind, place: 'button', start, end, query: '', sel: 0, marks: null, tab: 'all', atStart: true, replace: false };
  paintChoice(); listPi();
}
// The picker key: from an `@` at the caret it takes the typed query along and replaces the token.
function toPalette() {
  const o = P; const [cs, ce] = fieldCaret();
  close();
  const fromCaret = o && o.place === 'caret' && o.kind === 'file';
  P = { kind: 'file', place: 'palette', start: fromCaret ? o.start : cs, end: fromCaret ? o.end : ce, replace: fromCaret, query: fromCaret ? o.query : '', sel: 0, marks: new Set(), tab: fromCaret && o.query ? 'all' : 'changed', atStart: true };
  paintChoice();
}
// A new conversation has no Pi yet; the list-only helper answers in about a second.
function listPi() {
  if (!P || P.kind !== 'cmd' || !piLoading() || X.loadingFor === conv().id) return;
  const id = X.loadingFor = conv().id;
  setTimeout(() => { X.listed.add(id); X.loadingFor = null; if (P && conv().id === id) paintChoice(); }, 1100);
}

// ---------- `!` commands, typed only ----------
function shellLabel() {
  const ctx = ctxActive();
  return `<span class="x-shlabel"><span class="x-bang">${ctx ? '!' : '!!'}</span><span class="x-shtext">Komento työtilassa <code>${WS}</code></span><span class="x-ctx">${ctx ? 'Pi näkee tulosteen' : 'vain sinulle, ei Pi:lle'}</span></span>`;
}
function paintShell() {
  const on = shellActive();
  cbox.classList.toggle('x-sh', on);
  ta.placeholder = on ? '' : (UI.working ? 'Ohjaa Pi:tä tai lisää jonoon…' : 'Kirjoita Pi:lle…');
  ta.setAttribute('aria-label', on ? `Komento työtilassa ${WS}` : 'Viesti Pi:lle');
  ta.spellcheck = !on;
  const send = comp.querySelector('.c-send');
  if (send && on) {
    send.innerHTML = ICON_RUN; send.setAttribute('aria-label', 'Aja komento'); send.title = 'Aja komento työtilassa';
    if (commandText()) send.removeAttribute('aria-disabled'); else send.setAttribute('aria-disabled', 'true');
  }
  paintButtons();
}
function now() { return new Date().toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' }).replace('.', ':'); }
function runBlock(r) {
  const state = r.done ? (r.cancelled ? '<span class="x-st stop">peruttu</span>' : r.exit === 0 ? `<span class="x-st ok">${ICON_CHECK}paluuarvo 0</span>` : `<span class="x-st err">paluuarvo ${r.exit}</span>`) : `<span class="x-st live"><span class="live-dot"></span>ajossa <span class="x-clock">0:00</span></span>`;
  const stop = r.done ? '' : `<button type="button" class="x-stop" data-x="stop" aria-label="Pysäytä komento" title="Pysäytä komento (Esc kentässä)">${ICON_STOP_SM}<span>Pysäytä</span></button>`;
  const body = r.done && r.lines.length ? `<div class="tool-body x-out">${xbox(`sh:${r.id}`, r.lines, { copyLabel: 'Kopioi tuloste' })}</div>` : `<pre class="x-live">${esc(r.lines.join('\n'))}${r.done ? '' : '<span class="caret"></span>'}</pre>`;
  const notes = [];
  if (r.ctx) notes.push(r.deferred ? 'Pi työskentelee: tuloste liitetään historiaan vuoron jälkeen, ja Pi näkee sen seuraavan viestisi mukana.' : 'Pi näkee tulosteen seuraavan viestisi mukana. Komento ei yksin käynnistä Pi:n vastausta.');
  else notes.push('Ei Pi:n kontekstissa: tuloste jää vain historiaan.');
  if (r.long && !r.done) notes.push('Komento jatkuu, kunnes pysäytät sen. Palvelimen tai muun pitkän ajon voi pyytää Pi:ltä prosessina: se näkyy silloin prosessipalkissa ja jatkuu omana ajonaan.');
  return `<header><strong>Sinä · komento</strong><time class="meta">${r.time}</time>${state}${stop}</header><div class="x-cmdline"><span class="x-sigil" aria-hidden="true">${r.ctx ? '!' : '!!'}</span><code>${esc(r.cmd)}</code>${copyBtn('Kopioi komento', r.cmd)}</div>${body}<p class="x-note">${notes.join(' ')}</p>`;
}
function runFromField() {
  const cmd = commandText(); if (!cmd) return;
  if (X.running) return toast('Edellinen komento on vielä käynnissä. Pysäytä se ensin.');
  if (conv().id !== 'c1') return toast('Tässä vedoksessa komennon voi ajaa Status-skriptissä.');
  const host = stage.querySelector('.vwrap'); if (!host) return;
  const o = outputFor(cmd);
  const r = { id: ++X.seq, cmd, ctx: ctxActive(), lines: [], done: false, exit: o.exit, cancelled: false, time: now(), deferred: UI.working, long: false, t0: performance.now() };
  X.running = r;
  host.insertAdjacentHTML('beforeend', `<section class="x-run ah-in" data-run="${r.id}" aria-label="Sinä · komento">${runBlock(r)}</section>`);
  following = true; stage.scrollTop = stage.scrollHeight;
  replaceAll(''); // the field clears, and with it `!`, as in Pi's TUI
  const el = () => stage.querySelector(`[data-run="${r.id}"]`);
  const repaint = () => { const n = el(); if (n) n.innerHTML = runBlock(r); };
  const tick = setInterval(() => { const c = el()?.querySelector('.x-clock'); if (!c) return; const s = Math.round((performance.now() - r.t0) / 1000); c.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; if (o.exit === null && s >= 4 && !r.long) { r.long = true; repaint(); } }, 500);
  let i = 0; const step = o.step ?? 90;
  const next = () => {
    if (r.done) return;
    if (i < o.lines.length) { r.lines.push(o.lines[i++]); const pre = el()?.querySelector('.x-live'); if (pre) pre.innerHTML = esc(r.lines.join('\n')) + '<span class="caret"></span>'; r.timer = setTimeout(next, step); return; }
    if (o.exit === null) return; // a server: runs until stopped
    finish(false);
  };
  r.timer = setTimeout(next, 250);
  r.finish = (cancelled) => { clearTimeout(r.timer); clearInterval(tick); r.done = true; r.cancelled = cancelled; X.running = null; repaint(); paintShell(); };
}
function finish(cancelled) { X.running?.finish(cancelled); }
function replaceAll(text) { ta.value = text; ta.dispatchEvent(new Event('input', { bubbles: true })); }
stage.addEventListener('click', (e) => { if (e.target.closest('[data-x="stop"]')) finish(true); });

// ---------- Browser actions ----------
function newConversation() {
  const w = UI.ws.find(x => x.id === 'aurinkokello'); const id = `n${++UI.created}`;
  w.convs.unshift({ id, title: 'Uusi keskustelu', st: 'new' }); w.open = true; openConv(id);
}
function modelAction() {
  if (isNew()) return toast('Mallin valitsin aukeaisi kentän alareunasta: Pi:n mallit ja ajattelutaso.');
  UI.pop = true; paint();
}

// ---------- The buttons: one function, three placements ----------
const btn = (x, icon, label, tip) => `<button type="button" class="x-btn" data-x="${x}" aria-haspopup="listbox" aria-expanded="false" aria-label="${label}" title="${tip}">${icon}<span class="x-lbl">${label}</span></button>`;
const cmdsBtn = () => btn('cmds', ICON_SLASH, 'Komennot', 'Komennot ja taidot · kirjoita myös / kentässä');
const filesBtn = () => btn('files', ICON_AT, 'Tiedosto', `Tiedosto · kirjoita myös @ kentässä, ${MOD}+P avaa valitsimen`);
// The new conversation's model chooser, which production already puts inside the field.
const modelPill = () => isNew() ? `<button type="button" class="x-model" data-x="model" aria-haspopup="dialog" title="Uuden keskustelun malli">Pi:n oletus · medium ${ICON_DOWN}</button>` : '';
// Rebuilt only when what it shows changes: a row rebuilt on every keystroke loses presses.
function paintButtons() {
  const sh = shellActive();
  const sig = `${dir()}|${sh}|${ctxActive()}|${isNew()}`;
  if (sig === X.rowSig && cwrap.querySelector('.x-btn')) return;
  X.rowSig = sig;
  cbox.querySelector('.x-row')?.remove(); cbox.querySelector('.x-icons')?.remove(); cbox.querySelector(':scope > .x-shlabel')?.remove();
  cwrap.querySelector('.x-above')?.remove();
  const keep = P?.place === 'button' ? P.kind : null;
  if (dir() === 1) {
    // Alarivi: the field's own bottom row, labelled; the `!` label takes the Komennot slot.
    cbox.insertAdjacentHTML('beforeend', `<div class="x-row">${sh ? shellLabel() : cmdsBtn()}${filesBtn()}<span class="x-grow"></span>${modelPill()}</div>`);
  } else if (dir() === 2) {
    // Yläpuolella: a light row outside and above the field.
    const hint = isNew() ? modelPill() : `<span class="x-hint"><kbd>${MOD}</kbd><kbd>P</kbd> tiedostot</span>`;
    cbox.insertAdjacentHTML('beforebegin', `<div class="x-above">${sh ? shellLabel() : cmdsBtn()}${filesBtn()}<span class="x-grow"></span>${hint}</div>`);
  } else {
    // Ikonit: two icons inside the field beside Send; the `!` label is a row on top, as in Kursorissa.
    if (sh) cbox.insertAdjacentHTML('afterbegin', shellLabel());
    cbox.insertAdjacentHTML('beforeend', `<div class="x-icons">${sh ? '' : cmdsBtn()}${filesBtn()}</div>`);
    if (isNew()) cbox.insertAdjacentHTML('beforeend', `<div class="x-row">${modelPill()}</div>`);
  }
  if (keep) { const b = cwrap.querySelector(`[data-x="${keep === 'cmd' ? 'cmds' : 'files'}"]`); b?.setAttribute('aria-expanded', 'true'); }
}
cwrap.addEventListener('mousedown', (e) => { if (e.target.closest('.x-btn, .x-model')) { X.caret = fieldCaret(); e.preventDefault(); } });
cwrap.addEventListener('click', (e) => {
  const b = e.target.closest('[data-x]'); if (!b || b.closest('.x-pop')) return;
  const a = b.dataset.x;
  if (a === 'cmds') return fromButton('cmd');
  if (a === 'files') return fromButton('file');
  if (a === 'model') return modelAction();
});

// ---------- Keys and text: captured before lib/composer.js handles Enter ----------
comp.addEventListener('keydown', (e) => {
  if (e.target !== ta) return;
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p') { e.preventDefault(); e.stopPropagation(); return toPalette(); }
  if (e.isComposing || e.keyCode === 229) return; // IME: the composition owns Enter and arrows
  if (P?.place === 'caret') {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); return move(e.key === 'ArrowDown' ? 1 : -1); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return close(); }
    if ((e.key === 'Enter' && !e.shiftKey && P.sel >= 0) || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault(); e.stopPropagation();
      return accept(P.sel < 0 ? Math.max(0, P.list.findIndex(pickable)) : P.sel);
    }
  }
  if (e.key === 'Escape' && X.running) { e.preventDefault(); return finish(true); }
  if (e.key === 'Enter' && !e.shiftKey && shellActive()) { e.preventDefault(); e.stopPropagation(); return runFromField(); }
}, true);
comp.addEventListener('click', (e) => {
  if (e.target.closest('.c-send') && shellActive()) { e.preventDefault(); e.stopPropagation(); if (comp.querySelector('.c-send').getAttribute('aria-disabled') !== 'true') runFromField(); }
}, true);
ta.addEventListener('input', () => { paintShell(); fromText(); });
ta.addEventListener('click', () => fromText());
ta.addEventListener('blur', () => { X.caret = [ta.selectionStart, ta.selectionEnd]; setTimeout(() => { if (P?.place === 'caret' && !comp.contains(document.activeElement)) close(); }, 120); });
document.addEventListener('mousedown', (e) => { if (P?.place === 'button' && !e.target.closest('.cwrap')) close(); });
document.addEventListener('keydown', (e) => {
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (!mod || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'p' || e.defaultPrevented) return;
  if (e.target.closest?.('.x-pal, .x-pop')) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target !== ta) return;
  e.preventDefault(); X.caret = X.caret ?? [ta.value.length, ta.value.length]; toPalette();
});
window.addEventListener('resize', () => { const pop = cbox.querySelector('.x-pop'); if (pop && P) position(pop); });
// A repaint keeps an open list (the turn ending repaints too) unless the conversation changed.
APP.painted.push(() => {
  if (X.conv !== conv().id) { X.conv = conv().id; if (P) close(); }
  paintShell(); if (P && P.place !== 'palette') paintList();
});

// ---------- Directions ----------
function setDir(n) {
  if (X.running) finish(true);
  close(); X.dir = n; X.caret = null;
  comp.dataset.xdir = String(n); uiMainEl.dataset.xdir = String(n);
  ta.value = ''; C.text = ''; ta.style.height = '';
  paintShell();
}
window.v1 = () => { setDir(1); return appView(); };
window.v2 = () => { setDir(2); return appView(); };
window.v3 = () => { setDir(3); return appView(); };

document.querySelector('.page-bar .hint').insertAdjacentHTML('beforebegin', `<span class="x-try">Kokeile: painikkeet · kentässä <kbd>/</kbd> <kbd>@</kbd> · <kbd>${MOD}</kbd>+<kbd>P</kbd> · <kbd>!</kbd> pytest -q · <kbd>/</kbd>uusi</span>`);
})();
