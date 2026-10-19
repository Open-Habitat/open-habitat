// Kentän lisät (proto-composer-commands, 19.10.2026). Kierros laajentaa kirjaston valittua
// alakertaa (lib/composer.js) koskematta siihen: se kuuntelee samaa kenttää, sieppaa
// näppäimet ennen kentän omaa Enter-käsittelyä ja lisää omat palansa kentän ympärille.
// Sisältö on sama kaikissa suunnissa; ne eroavat siinä, missä valinta tapahtuu.
(() => {
const comp = document.querySelector('.composer');
const ta = comp.querySelector('textarea');
const cbox = comp.querySelector('.cbox');
const uiMainEl = document.querySelector('.main');
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';
const WS = '~/src/aurinkokello';
const XS = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON_TERM = XS('<path d="m5 8 4 4-4 4"/><path d="M12 16h7"/>');
const ICON_SLASH = XS('<path d="M15 4 9 20"/>');
const ICON_AT = XS('<circle cx="12" cy="12" r="3.5"/><path d="M15.5 12v1.5a2.5 2.5 0 0 0 5 0V12a8.5 8.5 0 1 0-3.3 6.7"/>');
const ICON_FILE = XS('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>');
const ICON_RUN = XS('<path d="M7 5v14l11-7z"/>', '');
const ICON_STOP_SM = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>';

// ---------- Shared content: what Pi and the workspace would answer ----------
// The Pi command list as `get_commands` returns it (Pi 1.3.0): extension commands, prompt
// templates and skills with their description and source. The daemon's own recap command
// (`oh-conversation-recap`) is filtered out. Extension commands that need Pi's terminal UI
// cannot run from the browser; the list says so instead of hiding them.
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
// Browser actions that Pi's TUI has as built-in commands (/new, /model). Pi's RPC list
// leaves them out; here they run at once instead of being inserted.
const BROWSER = [
  { name: 'uusi', d: 'Uusi keskustelu työtilassa aurinkokello', act: () => toast('Uusi keskustelu avautuisi tässä. (Vedoksessa vain Status-skripti on auki.)') },
  { name: 'malli', d: 'Malli ja ajattelutaso: gpt-5.5 · medium', act: () => { UI.pop = true; paint(); } },
];
const SRC = { skill: 'Taito', prompt: 'Pohja', extension: 'Laajennus' };
const SCOPE = { user: 'oma', project: 'projekti', builtin: 'Pi' };
// The workspace as `git ls-files --cached --others --exclude-standard` lists it, with
// `git status --porcelain` marks. Ignored files (.venv, __pycache__) never appear.
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
// Fixed outputs for the commands the page knows; anything else gets a generic line.
const OUT = {
  'git status': { lines: ['On branch main', "Your branch is up to date with 'origin/main'.", '', 'Changes not staged for commit:', '  (use "git add <file>..." to update what will be committed)', '\tmodified:   scripts/status_rows.py', '\tmodified:   tests/test_status_rows.py', '', 'Untracked files:', '\tnotes/2026-10-13-status.md', '', 'no changes added to commit (use "git add" and/or "git commit -a")'], exit: 0 },
  'git diff --stat': { lines: [' scripts/status_rows.py    | 14 +++++++++-----', ' tests/test_status_rows.py |  9 +++++++++', ' 2 files changed, 18 insertions(+), 5 deletions(-)'], exit: 0 },
  'ls': { lines: ['LICENSE  Makefile  README.md  data  docs  notes  pyproject.toml  scripts  status.md  tests'], exit: 0 },
  'pytest -q': { lines: ['..........F.', '=================================== FAILURES ===================================', '____________________________ test_since_default ____________________________', '    def test_since_default():', '>       assert len(select(ROWS, None, TODAY)) == 3', 'E       assert 2 == 3', 'tests/test_status_rows.py:41: AssertionError', '=========================== short test summary info ============================', 'FAILED tests/test_status_rows.py::test_since_default - assert 2 == 3', '1 failed, 11 passed in 0.84s'], exit: 1, step: 260 },
  'python3 scripts/status_rows.py --since 2026-10-06': { lines: ['[', '  {"päivä": "2026-10-07", "kohde": "aurinkokello", "tila": "valmis"},', '  {"päivä": "2026-10-13", "kohde": "status", "tila": "kesken"}', ']'], exit: 0 },
  'make serve': { lines: ['python3 -m http.server 8000 --directory docs', 'Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...', '127.0.0.1 - - [19/Oct/2026 10:42:07] "GET / HTTP/1.1" 200 -'], exit: null, step: 700 },
};
OUT['git diff'] = OUT['git diff --stat'];
OUT['make test'] = OUT['pytest -q'];
const outputFor = (cmd) => OUT[cmd.trim()] ?? { lines: [`(vedos: komennolle \`${cmd.trim()}\` ei ole esimerkkitulostetta)`], exit: 0 };
const shq = (p) => /^[\w@%+=:,./-]+$/.test(p) ? p : `'${p.replace(/'/g, `'\\''`)}'`;

// ---------- State ----------
const X = { dir: 1, shell: false, ctx: true, running: null, seq: 0 };
let P = null; // the open choice: { kind: 'cmd'|'file', start, end, query, sel, own, marks, tab, atStart }
const dir = () => X.dir;
// Kursorissa reads the mode from the text, as Pi does: `!` runs, `!!` keeps output from Pi.
const shellActive = () => dir() === 1 ? /^!/.test(ta.value) : X.shell;
const ctxActive = () => dir() === 1 ? !/^!!/.test(ta.value) : X.ctx;
const commandText = () => dir() === 1 ? ta.value.replace(/^!!?/, '').trim() : ta.value.trim();

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
function cmdItems(q, atStart) {
  const pi = COMMANDS.map(c => ({ ...c, k: 'pi', s: Math.max(score(c.name, q), score(c.d, q) * 0.4) })).filter(c => c.s > 0);
  const br = atStart ? BROWSER.map(c => ({ ...c, k: 'browser', s: score(c.name, q) })).filter(c => c.s > 0) : [];
  const by = (a, b) => b.s - a.s;
  return [...br.sort(by).map(c => ({ ...c, group: 'Selain · ajetaan heti' })), ...pi.sort(by).map(c => ({ ...c, group: atStart ? 'Pi · lisätään, ajetaan lähetettäessä' : 'Pi · mainitaan tekstinä' }))];
}
function fileItems(q, tab) {
  let list = FILES.map(f => ({ ...f, s: score(f.p, q) })).filter(f => f.s > 0);
  if (tab === 'changed') list = list.filter(f => f.g);
  if (!q) return [...list.filter(f => f.g).map(f => ({ ...f, group: 'Muutetut' })), ...list.filter(f => !f.g).map(f => ({ ...f, group: 'Tiedostot' }))];
  return list.sort((a, b) => b.s - a.s).map(f => ({ ...f, group: 'Osumat' }));
}
function items() {
  if (!P) return [];
  if (P.kind === 'cmd' || P.tab === 'cmd') return cmdItems(P.query, P.atStart);
  return fileItems(P.query, P.tab);
}

// ---------- The token at the caret ----------
function caretToken() {
  const pos = ta.selectionStart; if (pos !== ta.selectionEnd) return null;
  const before = ta.value.slice(0, pos);
  if (shellActive()) return null;
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
function accept(list, i) {
  const marked = P.marks?.size ? list.filter(it => P.marks.has(it.p ?? it.name)) : [list[i]].filter(Boolean);
  if (!marked.length) return;
  const it = marked[0];
  const { start, end } = P;
  if (it.k === 'browser') { close(); replaceRange(start, end, ''); return it.act(); }
  if (it.k === 'pi') {
    if (it.tui) return toast(`/${it.name} käyttää Pi:n päätteen valikkoja, joten sitä ei voi ajaa selaimesta.`);
    close(); return replaceRange(start, end, `/${it.name} `);
  }
  const text = marked.map(f => shellActive() ? shq(f.p) : `@${f.p}`).join(' ') + ' ';
  close(); replaceRange(start, end, text);
}

// ---------- Rendering the choice ----------
const listId = 'x-list';
function rowHtml(it, i, sel, marks) {
  const id = `x-opt-${i}`;
  const on = i === sel ? ' aria-selected="true"' : ' aria-selected="false"';
  if (it.p) {
    const mark = marks ? `<span class="x-mark" aria-hidden="true">${marks.has(it.p) ? '●' : ''}</span>` : '';
    const slash = it.p.lastIndexOf('/');
    return `<li role="option" id="${id}" data-i="${i}"${on}>${mark}<span class="x-ic">${ICON_FILE}</span><span class="x-path"><span class="x-dir">${esc(it.p.slice(0, slash + 1))}</span>${esc(it.p.slice(slash + 1))}</span>${it.g ? `<span class="x-git g-${it.g === 'M' ? 'm' : 'u'}" title="${it.g === 'M' ? 'muutettu' : 'uusi, ei versionhallinnassa'}">${it.g === 'M' ? 'M' : 'U'}</span>` : ''}</li>`;
  }
  const tag = it.k === 'browser' ? '<span class="x-tag run">Selain</span>' : `<span class="x-tag s-${it.src}">${SRC[it.src]} · ${SCOPE[it.scope]}</span>`;
  const why = it.tui ? '<span class="x-why">vain Pi:n päätteessä</span>' : '';
  return `<li role="option" id="${id}" data-i="${i}"${on}${it.tui ? ' aria-disabled="true"' : ''}><span class="x-name">/${esc(it.name)}${it.args ? ` <span class="x-args">${esc(it.args)}</span>` : ''}</span><span class="x-desc">${esc(it.d)}</span>${why}${tag}</li>`;
}
function groupedList(list, sel, marks) {
  let g = null; let html = '';
  list.forEach((it, i) => { if (it.group !== g) { g = it.group; html += `<li class="x-group" role="presentation">${esc(g)}</li>`; } html += rowHtml(it, i, sel, marks); });
  return html || `<li class="x-empty" role="presentation">Ei osumia${P.query ? ` haulle “${esc(P.query)}”` : ''}.</li>`;
}
const headText = () => P.kind === 'cmd'
  ? (P.atStart ? 'Komennot ja taidot' : 'Mainitse komento: Pi ajaa komennon vain viestin alussa')
  : (shellActive() ? 'Tiedostot · lisätään komentoon polkuna' : `Tiedostot · aurinkokello`);
const keysText = () => P.sel < 0
  ? `<kbd>Tab</kbd> lisää ylimmän · <kbd>↓</kbd> valitsee · <kbd>Enter</kbd> lähettää tekstin sellaisenaan · <kbd>Esc</kbd> sulje`
  : `<kbd>↑</kbd><kbd>↓</kbd> valitse · <kbd>Enter</kbd> lisää · <kbd>Esc</kbd> sulje`;

// Kursorissa: a small list just above the line being written, at the caret's x.
function caretX(pos) {
  const cs = getComputedStyle(ta); const m = document.createElement('div');
  for (const k of ['font', 'letterSpacing', 'padding', 'border', 'boxSizing', 'lineHeight']) m.style[k] = cs[k];
  Object.assign(m.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', width: ta.offsetWidth + 'px', top: '0', left: '0' });
  m.textContent = ta.value.slice(0, pos); const s = document.createElement('span'); s.textContent = '​'; m.appendChild(s);
  cbox.appendChild(m); const x = s.offsetLeft; m.remove(); return x;
}
function paintInline() {
  let pop = cbox.querySelector('.x-pop');
  if (!pop) { pop = document.createElement('div'); pop.className = 'x-pop'; cbox.appendChild(pop); pop.addEventListener('mousedown', (e) => e.preventDefault()); pop.addEventListener('click', onListClick); }
  const list = items(); P.list = list;
  pop.innerHTML = `<div class="x-head"><span class="x-title">${headText()}</span></div><ul role="listbox" id="${listId}" aria-label="${esc(headText())}">${groupedList(list, P.sel)}</ul><div class="x-keys">${keysText()}</div>`;
  const w = Math.min(cbox.clientWidth, P.kind === 'cmd' ? 460 : 380);
  pop.style.width = w + 'px';
  pop.style.left = Math.max(0, Math.min(caretX(P.start) - 14, cbox.clientWidth - w)) + 'px';
  aria(true);
  pop.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
}

// Ponnahdus: one palette over the conversation, as tmux's popup is over the pane.
function paintPalette() {
  let pal = uiMainEl.querySelector('.x-pal');
  if (!pal) {
    pal = document.createElement('div'); pal.className = 'x-pal-host';
    pal.innerHTML = `<div class="x-scrim" data-x="close"></div><div class="x-pal" role="dialog" aria-modal="true" aria-label="Valitse"><div class="x-tabs" role="tablist"></div><label class="x-search">${ICON_AT}<input type="text" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="${listId}"></label><div class="x-body"><ul role="listbox" id="${listId}"></ul><div class="x-prev" aria-live="polite"></div></div><div class="x-keys"></div></div>`;
    uiMainEl.appendChild(pal);
    const inp = pal.querySelector('input');
    inp.addEventListener('input', () => { P.query = inp.value; P.sel = 0; paint2(); });
    inp.addEventListener('keydown', paletteKeys);
    pal.addEventListener('click', (e) => {
      if (e.target.closest('[data-x="close"]')) return close(true);
      const tab = e.target.closest('[data-tab]'); if (tab) { P.tab = tab.dataset.tab; P.kind = P.tab === 'cmd' ? 'cmd' : 'file'; P.sel = 0; paint2(); return inp.focus(); }
      onListClick(e);
    });
  }
  const inp = pal.querySelector('input');
  if (inp.value !== P.query) inp.value = P.query;
  paint2();
  if (document.activeElement !== inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}
function paint2() {
  const pal = uiMainEl.querySelector('.x-pal-host'); if (!pal || !P) return;
  const list = items(); P.list = list;
  if (P.sel >= list.length) P.sel = Math.max(0, list.length - 1);
  const changed = FILES.filter(f => f.g).length;
  const tabs = [['changed', `Muutetut <span class="n">${changed}</span>`], ['all', 'Tiedostot'], ['cmd', 'Komennot']];
  pal.querySelector('.x-tabs').innerHTML = tabs.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${P.tab === k}">${l}</button>`).join('');
  pal.querySelector('.x-search svg')?.replaceWith(document.createRange().createContextualFragment(P.tab === 'cmd' ? ICON_SLASH : ICON_AT));
  pal.querySelector('input').placeholder = P.tab === 'cmd' ? 'Hae komentoa tai taitoa' : 'Hae tiedostoa · Tab merkitsee useamman';
  pal.querySelector('input').setAttribute('aria-activedescendant', list.length ? `x-opt-${P.sel}` : '');
  pal.querySelector('ul').innerHTML = groupedList(list, P.sel, P.tab === 'cmd' ? null : P.marks);
  pal.querySelector('.x-prev').innerHTML = previewHtml(list[P.sel]);
  const n = P.marks.size;
  pal.querySelector('.x-keys').innerHTML = P.tab === 'cmd'
    ? `<kbd>↑</kbd><kbd>↓</kbd> valitse · <kbd>Enter</kbd> lisää kenttään · <kbd>Esc</kbd> takaisin kenttään`
    : `<kbd>Tab</kbd> merkitse · <kbd>Enter</kbd> ${n > 1 ? `lisää ${n} polkua` : 'lisää polku'} · <kbd>Esc</kbd> takaisin kenttään<span class="x-where">lisätään muodossa ${shellActive() ? '<code>polku</code> komentoon' : '<code>@polku</code>'}</span>`;
  pal.querySelector('[aria-selected="true"][role="option"]')?.scrollIntoView({ block: 'nearest' });
}
function previewHtml(it) {
  if (!it) return '<p class="x-none">Ei valittua.</p>';
  if (!it.p) {
    const ex = it.k === 'browser' ? 'Ajetaan heti, kun valitset sen. Ei lähetä mitään Pi:lle.' : it.tui ? 'Tämä laajennuksen komento avaa Pi:n päätteen valikon, joten selain ei voi ajaa sitä.' : P.atStart ? `Lisätään kenttään. Kun lähetät viestin, joka alkaa <code>/${esc(it.name)}</code>, Pi ${it.src === 'skill' ? 'lataa taidon' : 'laajentaa pohjan'} ja aloittaa työn.` : 'Viestin keskellä komento on vain tekstiä: Pi lukee sen mainintana.';
    return `<h4>/${esc(it.name)}</h4><p>${esc(it.d)}</p><dl><dt>Lähde</dt><dd>${it.k === 'browser' ? 'Selain' : `${SRC[it.src]} · ${SCOPE[it.scope]}`}</dd>${it.path ? `<dt>Tiedosto</dt><dd class="mono">${esc(it.path)}</dd>` : ''}</dl><p class="x-explain">${ex}</p>`;
  }
  const pv = PREVIEW[it.p];
  if (pv?.diff) return `<h4 class="mono">${esc(it.p)} <span class="x-git g-m">M</span></h4><pre class="x-diff">${pv.diff.map(l => `<span class="${l[0] === '+' ? 'add' : 'del'}">${esc(l)}</span>`).join('\n')}</pre>`;
  if (pv?.text) return `<h4 class="mono">${esc(it.p)}${it.g ? ' <span class="x-git g-u">U</span>' : ''}</h4><pre>${esc(pv.text)}</pre>`;
  return `<h4 class="mono">${esc(it.p)}</h4><p class="x-none">Esikatselu: tiedoston alku luettaisiin tässä (vedoksessa ei sisältöä).</p>`;
}

// Painikkeet: a menu above the field's own button row; on a phone a sheet from below.
function paintMenu() {
  let m = cbox.querySelector('.x-menu');
  if (!m) { m = document.createElement('div'); m.className = 'x-menu'; cbox.appendChild(m); m.addEventListener('mousedown', (e) => { if (!e.target.closest('input')) e.preventDefault(); }); m.addEventListener('click', onListClick); }
  const list = items(); P.list = list;
  if (P.sel >= list.length) P.sel = Math.max(0, list.length - 1);
  const search = P.own ? `<label class="x-search">${P.kind === 'cmd' ? ICON_SLASH : ICON_AT}<input type="text" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="${listId}" placeholder="${P.kind === 'cmd' ? 'Hae komentoa' : 'Hae tiedostoa'}"></label>` : '';
  const had = m.querySelector('input'); const keep = had && document.activeElement === had;
  if (!keep) {
    m.innerHTML = `<div class="x-head"><span class="x-title">${headText()}</span><button type="button" class="x-close" data-x="close" aria-label="Sulje">${ICON_CLOSE}</button></div>${search}<ul role="listbox" id="${listId}"></ul>`;
    const inp = m.querySelector('input');
    if (inp) { inp.value = P.query; inp.addEventListener('input', () => { P.query = inp.value; P.sel = 0; paintMenu(); }); inp.addEventListener('keydown', paletteKeys); requestAnimationFrame(() => inp.focus()); }
  }
  m.querySelector('ul').innerHTML = groupedList(list, P.sel);
  m.querySelector('[aria-selected="true"][role="option"]')?.scrollIntoView({ block: 'nearest' });
  if (!P.own) aria(true);
}
function aria(open) {
  ta.setAttribute('aria-expanded', String(open));
  if (open) { ta.setAttribute('role', 'combobox'); ta.setAttribute('aria-controls', listId); ta.setAttribute('aria-activedescendant', P?.list?.length && P.sel >= 0 ? `x-opt-${P.sel}` : ''); }
  else { ta.removeAttribute('aria-activedescendant'); ta.removeAttribute('aria-controls'); ta.removeAttribute('role'); }
}
function paintChoice() {
  if (!P) return;
  if (dir() === 2 && (P.own || P.palette)) return paintPalette();
  if (dir() === 3) return paintMenu();
  paintInline();
}
function close(refocus) {
  const had = P; P = null;
  cbox.querySelector('.x-pop')?.remove(); cbox.querySelector('.x-menu')?.remove(); uiMainEl.querySelector('.x-pal-host')?.remove();
  aria(false); paintButtons();
  if (refocus && had) { ta.focus(); ta.setSelectionRange(had.end, had.end); }
}
function onListClick(e) {
  if (e.target.closest('[data-x="close"]')) return close(true);
  const li = e.target.closest('li[data-i]'); if (!li || !P) return;
  const i = Number(li.dataset.i);
  if (P.list[i]?.tui) return toast(`/${P.list[i].name} käyttää Pi:n päätteen valikkoja, joten sitä ei voi ajaa selaimesta.`);
  P.sel = i; accept(P.list, i);
}
function move(d) {
  const list = P.list ?? []; if (!list.length) return;
  P.sel = P.sel < 0 ? (d > 0 ? 0 : list.length - 1) : (P.sel + d + list.length) % list.length;
  paintChoice();
}
function paletteKeys(e) {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); return move(1); }
  if (e.key === 'ArrowUp') { e.preventDefault(); return move(-1); }
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return close(true); }
  if (e.key === 'Tab' && dir() === 2 && P.tab !== 'cmd') {
    e.preventDefault(); const it = P.list[P.sel]; if (!it) return;
    P.marks.has(it.p) ? P.marks.delete(it.p) : P.marks.add(it.p); return move(1);
  }
  if (e.key === 'Enter') { e.preventDefault(); if (P.list[P.sel]?.tui) return toast(`/${P.list[P.sel].name} toimii vain Pi:n päätteessä.`); return accept(P.list, P.sel); }
}

// Opening: from typed text (all directions), or summoned (Ctrl/⌘+P, buttons).
function fromText() {
  if (P?.own || P?.palette) return;
  // A summoned list (Kursorissa, Ctrl/⌘+P) filters by what is typed after the caret it opened at.
  if (P?.summoned) {
    const pos = ta.selectionStart; const q = ta.value.slice(P.start, pos);
    if (pos < P.start || /\s/.test(q)) return close();
    P.query = q; P.end = pos; P.sel = 0; return paintChoice();
  }
  const t = caretToken();
  if (!t) { if (P) close(); return; }
  // Typed `@` or `/` in Ponnahdus opens the palette straight away, as the picker key does.
  if (dir() === 2) { P = { ...t, sel: 0, palette: true, own: true, marks: new Set(), tab: t.kind === 'cmd' ? 'cmd' : 'all' }; return paintChoice(); }
  const same = P && P.kind === t.kind && P.start === t.start;
  // Mid-line `/` opens with nothing highlighted, so Enter still sends the text as written.
  P = { ...t, sel: same ? P.sel : (t.kind === 'cmd' && !t.atStart ? -1 : 0), marks: null, tab: t.kind === 'cmd' ? 'cmd' : 'all' };
  paintChoice();
}
function summon(kind) {
  const pos = ta.selectionStart ?? ta.value.length;
  close();
  const atStart = ta.value.slice(0, pos).trim() === '';
  P = { kind, start: pos, end: ta.selectionEnd ?? pos, query: '', sel: 0, own: dir() !== 1, summoned: true, palette: dir() === 2, marks: new Set(), tab: kind === 'cmd' ? 'cmd' : (dir() === 2 ? 'changed' : 'all'), atStart };
  if (dir() === 1) ta.focus();
  paintChoice(); paintButtons();
}

// ---------- `!` commands ----------
function shellLabel() {
  const ctx = ctxActive();
  if (dir() === 1) return `<div class="x-shlabel"><span class="x-bang">${ctx ? '!' : '!!'}</span>Komento työtilassa <code>${WS}</code><span class="x-ctx">${ctx ? 'Pi näkee tulosteen' : 'vain sinulle, ei Pi:lle'}</span></div>`;
  if (dir() === 2) return `<button type="button" class="x-ctxchip" data-x="ctx" aria-pressed="${ctx}" title="Vaihda: näkeekö Pi tulosteen">${ctx ? 'Pi näkee tulosteen' : 'Vain sinulle'}</button>`;
  return `<label class="x-ctxbox"><input type="checkbox" data-x="ctx"${ctx ? ' checked' : ''}> Pi näkee tulosteen</label>`;
}
function paintShell() {
  const on = shellActive();
  cbox.classList.toggle('x-sh', on);
  cbox.querySelector('.x-shlabel, .x-ctxchip')?.remove();
  cbox.querySelector('.x-prompt')?.remove();
  if (on && dir() !== 3) cbox.insertAdjacentHTML(dir() === 1 ? 'afterbegin' : 'beforeend', shellLabel());
  if (on && dir() === 2) cbox.insertAdjacentHTML('afterbegin', '<span class="x-prompt" aria-hidden="true">$</span>');
  ta.placeholder = on ? (dir() === 1 ? '' : `Komento työtilassa ${WS}`) : (UI.working ? 'Ohjaa Pi:tä tai lisää jonoon…' : 'Kirjoita Pi:lle…');
  ta.setAttribute('aria-label', on ? `Komento työtilassa ${WS}` : 'Viesti Pi:lle');
  ta.spellcheck = !on;
  const send = comp.querySelector('.c-send');
  if (send) {
    const has = !!commandText();
    if (on) { send.innerHTML = ICON_RUN; send.setAttribute('aria-label', 'Aja komento'); send.title = 'Aja komento työtilassa'; send.toggleAttribute('data-run', true); if (has) send.removeAttribute('aria-disabled'); else send.setAttribute('aria-disabled', 'true'); }
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
  if (selConv().id !== 'c1') return toast('Tässä vedoksessa komennon voi ajaa Status-skriptissä.');
  const host = stage.querySelector('.vwrap'); if (!host) return;
  const o = outputFor(cmd);
  const r = { id: ++X.seq, cmd, ctx: ctxActive(), lines: [], done: false, exit: o.exit, cancelled: false, time: now(), deferred: UI.working, long: false, t0: performance.now() };
  X.running = r;
  host.insertAdjacentHTML('beforeend', `<section class="x-run ah-in" data-run="${r.id}" aria-label="Sinä · komento">${runBlock(r)}</section>`);
  following = true; stage.scrollTop = stage.scrollHeight;
  // Kursorissa clears the field (and with it `!`), as Pi's TUI does; the others keep the mode.
  replaceAll('');
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

// ---------- Painikkeet: the field's own button row ----------
function paintButtons() {
  let row = cbox.querySelector('.x-row');
  if (dir() !== 3) { row?.remove(); return; }
  if (!row) { row = document.createElement('div'); row.className = 'x-row'; cbox.appendChild(row); }
  const on = X.shell;
  const open = (k) => P && P.kind === k;
  row.innerHTML = `<button type="button" class="x-btn" data-x="shell" aria-pressed="${on}" title="Komento työtilassa (kirjoita ! tyhjään kenttään)">${ICON_TERM}<span>Komento</span></button>${on ? shellLabel() : `<button type="button" class="x-btn" data-x="cmds" aria-expanded="${open('cmd')}" title="Komennot ja taidot (/)">${ICON_SLASH}<span>Komennot</span></button>`}<button type="button" class="x-btn" data-x="files" aria-expanded="${open('file')}" title="Tiedosto (@ tai ${MOD}+P)">${ICON_AT}<span>Tiedosto</span></button>`;
}
cbox.addEventListener('mousedown', (e) => { if (e.target.closest('.x-row .x-btn')) e.preventDefault(); });
cbox.addEventListener('click', (e) => {
  const b = e.target.closest('[data-x]'); if (!b) return;
  const a = b.dataset.x;
  if (a === 'shell') { X.shell = !X.shell; close(); paintShell(); return ta.focus(); }
  if (a === 'cmds') return P?.kind === 'cmd' ? close(true) : summon('cmd');
  if (a === 'files') return P?.kind === 'file' ? close(true) : summon('file');
  if (a === 'ctx' && b.tagName === 'BUTTON') { X.ctx = !X.ctx; paintShell(); return ta.focus(); }
});
cbox.addEventListener('change', (e) => { if (e.target.matches('input[data-x="ctx"]')) { X.ctx = e.target.checked; ta.focus(); } });

// ---------- Keys and text: captured before lib/composer.js handles Enter ----------
comp.addEventListener('keydown', (e) => {
  if (e.target !== ta) return;
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p') { e.preventDefault(); e.stopPropagation(); return summon('file'); }
  if (e.isComposing || e.keyCode === 229) return; // IME: the composition owns Enter and arrows
  if (P && !P.own) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); return move(e.key === 'ArrowDown' ? 1 : -1); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return close(); }
    if ((e.key === 'Enter' && !e.shiftKey && P.sel >= 0) || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault(); e.stopPropagation();
      return accept(P.list, P.sel < 0 ? 0 : P.sel);
    }
  }
  if (e.key === 'Escape' && X.running) { e.preventDefault(); return finish(true); }
  if (e.key === 'Enter' && !e.shiftKey && shellActive()) { e.preventDefault(); e.stopPropagation(); return runFromField(); }
  if (e.key === 'Backspace' && dir() !== 1 && X.shell && ta.value === '' ) { e.preventDefault(); X.shell = false; return paintShell(); }
  // Ponnahdus and Painikkeet consume `!` in an empty field; in shell mode a second `!` flips the context.
  // Only the `!` right after the entering one counts as `!!`; later a `!` is ordinary text.
  if (e.key === '!' && dir() !== 1 && ta.value === '' && !mod && (!X.shell || X.justEntered)) { e.preventDefault(); if (X.shell) { X.ctx = !X.ctx; X.justEntered = false; } else { X.shell = true; X.ctx = true; X.justEntered = true; } return paintShell(); }
  if (e.key.length === 1 || e.key === 'Backspace') X.justEntered = false;
}, true);
comp.addEventListener('click', (e) => {
  if (e.target.closest('.c-send') && shellActive()) { e.preventDefault(); e.stopPropagation(); if (comp.querySelector('.c-send').getAttribute('aria-disabled') !== 'true') runFromField(); }
}, true);
ta.addEventListener('input', () => { paintShell(); fromText(); });
ta.addEventListener('click', () => fromText());
ta.addEventListener('blur', () => setTimeout(() => { if (P && !P.own && !comp.contains(document.activeElement)) close(); }, 120));
// A pasted `!command` into an empty field enters command mode in the directions that consume `!`.
ta.addEventListener('paste', (e) => {
  if (dir() === 1 || ta.value !== '') return;
  const t = e.clipboardData?.getData('text') ?? '';
  if (!t.startsWith('!')) return;
  e.preventDefault(); X.shell = true; X.ctx = !t.startsWith('!!'); replaceAll(t.replace(/^!!?/, ''));
});
document.addEventListener('keydown', (e) => {
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (!mod || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'p' || e.defaultPrevented) return;
  if (e.target.closest?.('.x-pal, .x-menu')) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target !== ta) return;
  e.preventDefault(); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); summon('file');
});
APP.painted.push(() => paintShell());

// ---------- Directions ----------
function setDir(n) {
  if (X.running) finish(true);
  close(); X.dir = n; X.shell = false; X.ctx = true;
  comp.dataset.xdir = String(n); uiMainEl.dataset.xdir = String(n);
  ta.value = ''; C.text = ''; ta.style.height = '';
  paintShell(); paintButtons();
}
window.v1 = () => { setDir(1); return appView(); };
window.v2 = () => { setDir(2); return appView(); };
window.v3 = () => { setDir(3); return appView(); };

// Page-bar helper: what to try.
document.querySelector('.page-bar .hint').insertAdjacentHTML('beforebegin', `<span class="x-try">Kokeile kentässä: <kbd>!</kbd> git status · <kbd>/</kbd> · <kbd>@</kbd> · <kbd>${MOD}</kbd>+<kbd>P</kbd> · <kbd>!</kbd> make serve</span>`);
})();
