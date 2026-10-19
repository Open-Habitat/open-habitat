// Selainpääte (proto-browser-shell, 19.10.2026). Henkilö avaa selaimessa tavallisen bashin
// omana Unix-käyttäjänään työtilan hakemistossa. Jokainen selaimen pääte on ikkuna tmux-
// istunnossa, joka on nimetty työtilan mukaan, joten se jatkaa palvelimella, kun selain
// suljetaan, ja sama ikkuna näkyy `tmux ls`:ssä; henkilön itse tekemät tmux-istunnot voi
// liittää ja irrottaa. Ensimmäinen avaus näyttää, mitä pääte saa (valinnaisesti
// uudelleentunnistus), puhelimessa on Esc/Tab/Ctrl/Alt/nuolet-rivi, valinta kopioidaan tai
// viedään keskusteluun ja monirivinen liitos vahvistetaan. Pääte ei ole agentin prosessi
// eikä näy taustatyön palkissa. Sisältö on sama kaikissa suunnissa; suunta päättää vain,
// mihin pääte kuuluu. Esitys-painikkeet sivun yläpalkissa esittävät selaimen ulkopuolisia
// tapahtumia (selain suljetaan, yhteys katkeaa, leikepöydällä on monta riviä).
(() => {
const IC = {
  term: SVG('<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="m7.5 9.5 3 2.5-3 2.5M13 15h3.5"/>'),
  plus: ICON_PLUS, x: ICON_CLOSE,
  hide: SVG('<path d="m6 9 6 6 6-6"/>'),
  max: SVG('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  min: SVG('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
  send: SVG('<path d="M5 6h9a5 5 0 0 1 0 10H8"/><path d="m11 12-4 4 4 4"/>'),
  paste: SVG('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h4"/>'),
  attach: SVG('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  detach: SVG('<path d="M14 4h6v6M20 4l-8 8"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>'),
  shield: SVG('<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/>'),
  back: SVG('<path d="m15 18-6-6 6-6"/>'),
  off: SVG('<path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0"/><path d="M12 19h.01"/><path d="m3 3 18 18"/>'),
};
const SRV = 'open-habitat-test', USER = 'jari', HOME = '/home/maintainer';
const MOD = 'github.com/Open-Habitat/open-habitat';
const OH = '~/Sources/open-habitat';
const k = (c, s) => `<span class="${c}">${esc(s)}</span>`;
const hm = (d = new Date()) => `${d.getHours()}.${String(d.getMinutes()).padStart(2, '0')}`;
const hms = (d = new Date()) => `${hm(d)}.${String(d.getSeconds()).padStart(2, '0')}`;

// ---------- The native facts the view reads (tmux, the shell, git) ----------
const DIRS = {
  '~': ['Sources/', 'src/'], '~/Sources': ['open-habitat/'], '~/src': ['aurinkokello/', 'fleetrepo/', 'issuectl/'],
  [OH]: ['AGENTS.md', 'CLAUDE.md', 'TESTING.md', 'TODO.md', 'contracts/', 'design-system/', 'docs/', 'go.mod', 'go.sum', 'internal/', 'issues/', 'scripts/', 'systemd/', 'web/'],
  [OH + '/internal']: ['AGENTS.md', 'cli/', 'contracts/', 'core/', 'daemon/', 'diagnostic/', 'gateway/', 'nativegh/', 'provision/', 'storagequota/', 'transport/', 'udssecure/'],
  [OH + '/web']: ['AGENTS.md', 'index.html', 'lab/', 'node_modules/', 'package-lock.json', 'package.json', 'src/', 'tsconfig.json', 'vite.config.ts'],
  [OH + '/web/src']: ['app/', 'app.css', 'components/', 'contracts/', 'main.tsx', 'test/', 'theme.ts'],
  '~/src/aurinkokello': ['README.md', 'pyproject.toml', 'scripts/', 'site/', 'src/', 'tests/'],
  '~/src/issuectl': ['Cargo.lock', 'Cargo.toml', 'README.md', 'src/', 'tests/'],
  '~/src/fleetrepo': ['README.md', 'dotfiles/', 'infra/', 'units/'],
};
for (const d of Object.keys(DIRS)) for (const n of DIRS[d]) if (n.endsWith('/') && !DIRS[`${d}/${n.slice(0, -1)}`]) DIRS[`${d}/${n.slice(0, -1)}`] = [];
const inRepo = (cwd) => [OH, '~/src/aurinkokello', '~/src/issuectl', '~/src/fleetrepo'].some(r => cwd === r || cwd.startsWith(r + '/'));
const promptHtml = (t) => `${k('tp-u', `${USER}@${SRV}`)}:${k('tp-d', t.cwd)}${inRepo(t.cwd) ? k('tp-g', ' (main)') : ''}$ `;
const cmdLine = (t, cmd) => promptHtml(t) + esc(cmd);
const LOG = [
  ['1a193564', 'idle-pi-holds-slots: result, KOKEILTAVAA; issue closed'],
  ['f46502d0', 'daemon: deletion keeps its fence when a stopped Pi is reaped late'],
  ['6ea2b5b9', 'web: name busy conversations in deletion, say why the limit refuses'],
  ['062f480f', 'daemon: idle Pi children yield their place, deletion and archive stop them'],
  ['981803f2', "issues: Jari's shell/file direction; prototype rounds for browser shell and file viewing"],
];
const okLine = (pkg, s) => `${k('tg', 'ok')}  ${esc(`${MOD}/${pkg}`)}  ${k('tm', s)}`;
const viteHmr = (file, d) => `${k('tm', hms(d))} ${k('tc', '[vite]')} (client) ${k('tg', 'hmr update')} ${esc(file)}`;

let SEQ = 0;
function mk(o) { return { id: `t${++SEQ}`, name: 'bash', ws: null, cwd: '~', sess: 'main', win: 0, own: false, open: true, lines: [], hist: [], hi: -1, input: '', pos: 0, busy: null, el: null, st: null, opened: '9.12', ...o }; }
function seed() {
  SEQ = 0;
  const bash = mk({ name: 'bash', ws: 'open-habitat', cwd: OH, sess: 'open-habitat', win: 0, hist: ['go test ./internal/gateway/...', 'git log --oneline -4'] });
  bash.lines = [cmdLine(bash, 'git log --oneline -4'), ...LOG.slice(0, 4).map(([h, s]) => `${k('ty', h)} ${esc(s)}`), cmdLine(bash, 'go test ./internal/gateway/...'), okLine('internal/gateway', '2.914s'), okLine('internal/gateway/session', '0.611s')];
  const vite = mk({ name: 'vite', ws: 'open-habitat', cwd: OH, sess: 'open-habitat', win: 1, opened: '9.14', busy: { cmd: 'npm run --prefix web dev', fg: 'node', timers: [], forever: true } });
  vite.lines = [cmdLine(vite, 'npm run --prefix web dev'), '', '&gt; open-habitat-web@0.0.0 dev', '&gt; vite', '', `  ${k('tg', 'VITE v8.3.0')}  ready in ${k('tb', '412')} ms`, '', `  ${k('tg', '➜')}  ${k('tb', 'Local')}:   ${k('tc', 'http://127.0.0.1:5173/')}`, `  ${k('tg', '➜')}  ${k('tm', 'Network: use --host to expose')}`, viteHmr('/src/app/PersonalStorage.tsx', new Date(2026, 9, 19, 14, 26, 41))];
  // The person's own tmux session (made earlier with `tmux new -s main`), not attached here yet.
  const levy = mk({ name: 'levy', ws: null, cwd: '~', sess: 'main', win: 0, own: true, open: false, opened: '18.10.', busy: { cmd: 'watch -n 60 df -h ~', fg: 'watch', timers: [], forever: true } });
  levy.lines = [`Every 60,0s: df -h ~${' '.repeat(18)}${SRV}: Sun Oct 19 14:36:00 2026`, '', 'Filesystem      Size  Used Avail Use% Mounted on', '/dev/vdb1        50G   35G   15G  70% /home'];
  return [bash, vite, levy];
}

// ---------- State ----------
let SH = [], CUR = 'v1', VIEW = 'conv', ACT = null, PANEL = true, MAX = false, PH = 280;
let GATE = true, REAUTH = false, OFFLINE = false, MENU2 = null, SELT = null;
const STICKY = { ctrl: false, alt: false };
const byId = (id) => SH.find(t => t.id === id);
const shown = () => SH.filter(t => t.open);
const others = () => SH.filter(t => t.own && !t.open);
const ofWs = (ws) => SH.filter(t => t.open && t.ws === ws);
const ownOpen = () => SH.filter(t => t.open && t.own);
// Paneeli shows the conversation's workspace and the person's attached own sessions.
const listNow = () => CUR === 'v1' ? [...ofWs(selConv().ws.id), ...ownOpen()] : CUR === 'v2' ? (byId(ACT)?.open ? [byId(ACT)] : []) : [...shown()].sort((a, b) => (a.own - b.own) || a.sess.localeCompare(b.sess) || a.win - b.win);
const active = () => { const t = byId(ACT); return t && t.open ? t : null; };
const wsPath = (ws) => UI.ws.find(w => w.id === ws)?.path ?? '~';

// ---------- Commands (what the shell would print) ----------
const norm = (cwd, arg) => {
  if (!arg || arg === '~') return '~';
  let parts = arg.startsWith('~') ? arg.split('/') : [...cwd.split('/'), ...arg.split('/')];
  const out = [];
  for (const p of parts) { if (!p || p === '.') continue; if (p === '..') { if (out.length > 1) out.pop(); continue; } out.push(p); }
  return out.join('/') || '~';
};
const abs = (cwd) => cwd.replace(/^~/, HOME);
function lsLines(dir) { const items = DIRS[dir] || []; return items.length ? [items.map(n => n.endsWith('/') ? k('tb', n.slice(0, -1)) : esc(n)).join('  ')] : []; }
function respond(t, cmd) {
  const [c0, ...rest] = cmd.split(/\s+/); const arg = rest.join(' ');
  const git = inRepo(t.cwd); const oh = t.cwd === OH || t.cwd.startsWith(OH + '/'); const inWeb = t.cwd === OH + '/web';
  if (!cmd) return {};
  if (c0 === 'ls') return { out: lsLines(rest.find(a => !a.startsWith('-')) ? norm(t.cwd, rest.find(a => !a.startsWith('-'))) : t.cwd) };
  if (c0 === 'pwd') return { out: [esc(abs(t.cwd))] };
  if (c0 === 'whoami') return { out: [USER] };
  if (c0 === 'hostname') return { out: [SRV] };
  if (c0 === 'date') { const d = new Date(); return { out: [`Sun Oct 19 ${hms(d).replace(/\./g, ':').padStart(8, '0')} EEST 2026`] }; }
  if (c0 === 'echo') return { out: [esc(arg.replace(/^["']|["']$/g, ''))] };
  if (c0 === 'clear') return { clear: true };
  if (c0 === 'exit' || c0 === 'logout') return { exit: true };
  if (c0 === 'cd') {
    const to = norm(t.cwd, arg);
    if (!DIRS[to]) return { out: [`bash: cd: ${esc(arg)}: No such file or directory`] };
    t.cwd = to; return {};
  }
  if (c0 === 'help') return { out: [k('tm', 'Tämä vedos tuntee: ls, cd, pwd, git status, git log, git diff --stat, go test, go build,'), k('tm', 'npm run lint / test (web), tmux ls, sleep, date, echo, clear, exit. Ctrl+C keskeyttää, Ctrl+L tyhjentää.')] };
  if (/^(vim|vi|nano|less|htop|top|man|pi)$/.test(c0)) return { out: [k('tm', `(vedos) ${c0} piirtäisi koko päätteen; oikea pääte (xterm.js) näyttää sen sellaisenaan.`)] };
  if (c0 === 'tmux') {
    if (rest[0] !== 'ls') return { out: [k('tm', '(vedos) Selain hoitaa liittämisen ja irrottamisen; tmux ls näyttää istunnot.')] };
    const sess = [...new Set(SH.map(x => x.sess))].sort();
    return { out: sess.map(s => { const ws = SH.filter(x => x.sess === s); return `${s}: ${ws.length} windows (created ${s === 'main' ? 'Sat Oct 18 21:04:11' : 'Sun Oct 19 09:12:40'} 2026)${ws.some(x => x.open) ? ' (attached)' : ''}`; }) };
  }
  if (c0 === 'git') {
    if (!git) return { out: ['fatal: not a git repository (or any of the parent directories): .git'] };
    if (rest[0] === 'status') return { out: oh ? ['On branch main', "Your branch is ahead of 'origin/main' by 1 commit.", '  (use "git push" to publish your local commits)', '', 'Changes not staged for commit:', '  (use "git add &lt;file&gt;..." to update what will be committed)', `        ${k('tr', 'modified:   web/src/app/PersonalStorage.test.tsx')}`, `        ${k('tr', 'modified:   web/src/app/PersonalStorage.tsx')}`, '', 'no changes added to commit (use "git add" and/or "git commit -a")'] : ['On branch main', "Your branch is up to date with 'origin/main'.", '', 'nothing to commit, working tree clean'] };
    if (rest[0] === 'log') { const n = Number((arg.match(/-(\d+)/) || [])[1] || 5); return { out: LOG.slice(0, n).map(([h, s]) => `${k('ty', h)} ${esc(s)}`) }; }
    if (rest[0] === 'diff') return { out: oh ? [` web/src/app/PersonalStorage.test.tsx | 8 ${k('tg', '++++')}${k('tr', '----')}`, ` web/src/app/PersonalStorage.tsx      | 6 ${k('tg', '+++')}${k('tr', '---')}`, ' 2 files changed, 7 insertions(+), 7 deletions(-)'] : [] };
    if (rest[0] === 'branch') return { out: [`* ${k('tg', 'main')}`] };
    return { out: [k('tm', `(vedos) git ${esc(rest[0] || '')} ajettaisiin sellaisenaan.`)] };
  }
  if (c0 === 'go' && oh) {
    if (rest[0] === 'build' || rest[0] === 'vet') return { async: [[900, null]], fg: 'go' };
    if (rest[0] === 'test') {
      const all = ['internal/cli 0.412s', 'internal/contracts 0.118s', 'internal/core 1.902s', 'internal/gateway 2.914s', 'internal/gateway/session 0.611s', 'internal/provision 0.734s', 'internal/storagequota 0.208s', 'internal/transport 1.377s', 'internal/udssecure 0.295s', 'internal/daemon 14.208s'];
      const want = arg.includes('gateway') ? all.filter(s => s.includes('gateway')) : arg.includes('daemon') ? all.filter(s => s.includes('daemon')) : all;
      return { async: want.map((s, i) => [i === want.length - 1 && s.includes('daemon') ? 2600 : 380 + (i % 3) * 260, okLine(...s.split(' '))]), fg: 'go' };
    }
  }
  if (c0 === 'npm' && (inWeb || cmd.includes('--prefix web'))) {
    if (/\blint\b/.test(cmd)) return { async: [[200, ''], [0, '&gt; open-habitat-web@0.0.0 lint'], [0, '&gt; biome lint --error-on-warnings .'], [0, ''], [700, 'Checked 412 files in 38ms. No fixes applied.']], fg: 'node' };
    if (/\btest\b/.test(cmd)) return { async: [[200, ''], [0, '&gt; open-habitat-web@0.0.0 test'], [0, '&gt; vitest run'], [0, ''], [900, ` ${k('tg', '✓')} src/app/PersonalStorage.test.tsx (6 tests) 212ms`], [1400, ` Test Files  ${k('tg', '97 passed')} (97)`], [0, `      Tests  ${k('tg', '1211 passed')} (1211)`], [0, `   Duration  ${k('tm', '9.84s')}`]], fg: 'node' };
    if (/\bdev\b/.test(cmd)) return { async: [[300, ''], [0, '&gt; open-habitat-web@0.0.0 dev'], [0, '&gt; vite'], [0, ''], [400, `  ${k('tg', 'VITE v8.3.0')}  ready in ${k('tb', '398')} ms`], [0, `  ${k('tg', '➜')}  ${k('tb', 'Local')}:   ${k('tc', 'http://127.0.0.1:5174/')}`]], fg: 'node', forever: true };
  }
  if (c0 === 'sleep') return { async: [[Math.min(60, Number(arg) || 1) * 1000, null]], fg: 'sleep' };
  if (c0 === 'cat' && rest[0] === 'go.mod' && t.cwd === OH) return { out: [`module ${MOD}`, '', 'go 1.27.1'] };
  return { out: [`bash: ${esc(c0)}: command not found`] };
}

// ---------- Terminal element (one per shell, kept across repaints like a tmux client) ----------
const lineHtml = (h) => `<div class="tl">${h || ' '}</div>`;
function termEl(t) {
  if (t.el) return t.el;
  const el = document.createElement('div'); el.className = 'term'; el.dataset.term = t.id;
  el.innerHTML = `<div class="term-scroll" role="log" aria-label="Päätteen ${esc(t.name)} tuloste"><div class="term-lines">${t.lines.map(lineHtml).join('')}</div><div class="term-in"></div></div><textarea class="term-kbd" rows="1" aria-label="Kirjoita päätteeseen ${esc(t.name)}" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"></textarea><div class="term-paste" hidden></div>`;
  t.el = el; paintIn(t);
  const kbd = el.querySelector('.term-kbd');
  el.addEventListener('click', (e) => { if (e.target.closest('.term-paste')) return; if (getSelection().isCollapsed) kbd.focus({ preventScroll: true }); });
  kbd.addEventListener('keydown', (e) => key(t, e));
  kbd.addEventListener('input', () => { const v = kbd.value; kbd.value = ''; if (v.length === 1) send(t, v, false, false); else if (v) typeText(t, v); });
  kbd.addEventListener('paste', (e) => { e.preventDefault(); pasteText(t, e.clipboardData.getData('text')); });
  el.querySelector('.term-scroll').addEventListener('scroll', (e) => { const s = e.target; t.follow = s.scrollHeight - s.scrollTop - s.clientHeight < 30; });
  return el;
}
function scrollEnd(t, force) { const s = t.el?.querySelector('.term-scroll'); if (s && (force || t.follow !== false)) s.scrollTop = s.scrollHeight; }
function push(t, ...hs) {
  t.lines.push(...hs);
  if (t.el) { t.el.querySelector('.term-lines').insertAdjacentHTML('beforeend', hs.map(lineHtml).join('')); scrollEnd(t); }
}
function paintIn(t) {
  const box = t.el?.querySelector('.term-in'); if (!box) return;
  const before = esc(t.input.slice(0, t.pos)), at = esc(t.input[t.pos] || ' '), after = esc(t.input.slice(t.pos + 1));
  box.innerHTML = `${t.busy ? '' : promptHtml(t)}${before}<span class="term-cur">${at}</span>${after}`;
  scrollEnd(t);
}
const mark = (t) => t.busy ? `<span class="st-dot working" role="img" aria-label="Ajossa: ${esc(t.busy.cmd)}"></span>` : `<span class="sh-prompt" role="img" aria-label="Kehotteessa">$</span>`;
const tip = (t) => t.busy ? `Ajossa: ${t.busy.cmd}` : `Kehotteessa · ${t.cwd}`;
function marks(t) {
  document.querySelectorAll(`[data-mark="${t.id}"]`).forEach(m => { m.innerHTML = mark(t); m.closest('[title]')?.setAttribute('title', tip(t)); });
  if (CUR === 'v2' && VIEW === 'shell' && ACT === t.id) paint();
}

// ---------- Input ----------
function key(t, e) {
  if (e.ctrlKey && (e.key === '`' || e.code === 'Backquote')) return;
  if (e.metaKey) return; // Cmd+C / Cmd+V belong to the browser on a Mac.
  if (e.ctrlKey && e.shiftKey && /^[cC]$/.test(e.key)) { e.preventDefault(); return copySel(); }
  if (e.ctrlKey && e.shiftKey && /^[vV]$/.test(e.key)) { e.preventDefault(); return clipPaste(t); }
  if (e.ctrlKey && /^[vV]$/.test(e.key)) return; // Ctrl+V pastes (the native paste event).
  if (e.key === 'Unidentified' || e.key === 'Process') return; // phone keyboards report through input
  if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
  e.preventDefault(); e.stopPropagation();
  send(t, e.key, e.ctrlKey, e.altKey);
}
function send(t, key, ctrl, alt) {
  ctrl = ctrl || STICKY.ctrl; alt = alt || STICKY.alt;
  if (STICKY.ctrl || STICKY.alt) { STICKY.ctrl = STICKY.alt = false; paintKeys(); }
  if (OFFLINE) return;
  if (ctrl) {
    const c = key.toLowerCase();
    if (c === 'c') return interrupt(t);
    if (c === 'l') return clearT(t);
    if (c === 'd') { if (!t.input && !t.busy) { push(t, cmdLine(t, '')); return endShell(t); } return; }
    if (c === 'u') { t.input = t.input.slice(t.pos); t.pos = 0; return paintIn(t); }
    if (c === 'a') { t.pos = 0; return paintIn(t); }
    if (c === 'e') { t.pos = t.input.length; return paintIn(t); }
    return;
  }
  if (alt && (key === 'b' || key === 'f')) { const re = key === 'b' ? /\S*\s*$/ : /^\s*\S*/; if (key === 'b') t.pos = t.input.slice(0, t.pos).replace(re, '').length; else t.pos += (t.input.slice(t.pos).match(re) || [''])[0].length; return paintIn(t); }
  switch (key) {
    case 'Enter': if (!t.busy) submit(t); return;
    case 'Backspace': if (t.pos) { t.input = t.input.slice(0, t.pos - 1) + t.input.slice(t.pos); t.pos--; } return paintIn(t);
    case 'Delete': t.input = t.input.slice(0, t.pos) + t.input.slice(t.pos + 1); return paintIn(t);
    case 'ArrowLeft': t.pos = Math.max(0, t.pos - 1); return paintIn(t);
    case 'ArrowRight': t.pos = Math.min(t.input.length, t.pos + 1); return paintIn(t);
    case 'Home': t.pos = 0; return paintIn(t);
    case 'End': t.pos = t.input.length; return paintIn(t);
    case 'ArrowUp': case 'ArrowDown': {
      if (t.busy || !t.hist.length) return;
      t.hi = key === 'ArrowUp' ? Math.min(t.hist.length - 1, t.hi + 1) : t.hi - 1;
      t.input = t.hi < 0 ? '' : t.hist[t.hi]; t.hi = Math.max(-1, t.hi); t.pos = t.input.length; return paintIn(t);
    }
    case 'Tab': return complete(t);
    case 'Escape': return; // readline's meta prefix; it belongs to the shell, never closes anything.
    default: if (key.length === 1) typeText(t, key);
  }
}
function typeText(t, s) { s = s.replace(/\r?\n/g, ''); t.input = t.input.slice(0, t.pos) + s + t.input.slice(t.pos); t.pos += s.length; paintIn(t); }
function complete(t) {
  if (t.busy) return;
  const head = t.input.slice(0, t.pos); const m = head.match(/(\S*)$/); const word = m[1];
  const slash = word.lastIndexOf('/'); const dirPart = slash >= 0 ? word.slice(0, slash) : ''; const base = word.slice(slash + 1);
  const dir = dirPart ? norm(t.cwd, dirPart) : t.cwd;
  const hits = (DIRS[dir] || []).filter(n => n.startsWith(base));
  if (!hits.length) return;
  if (hits.length === 1) { const add = hits[0].slice(base.length) + (hits[0].endsWith('/') ? '' : ' '); return typeText(t, add); }
  push(t, cmdLine(t, t.input), hits.map(n => n.endsWith('/') ? k('tb', n) : esc(n)).join('  '));
  paintIn(t);
}
function submit(t) {
  const cmd = t.input.trim(); push(t, cmdLine(t, t.input)); t.input = ''; t.pos = 0; t.hi = -1;
  if (cmd && t.hist[0] !== cmd) t.hist.unshift(cmd);
  run(t, cmd);
}
function run(t, cmd) {
  const r = respond(t, cmd);
  if (r.clear) return clearT(t);
  if (r.exit) return endShell(t);
  if (r.out) push(t, ...r.out);
  if (!r.async) return paintIn(t);
  t.busy = { cmd, fg: r.fg, timers: [], forever: r.forever }; paintIn(t); marks(t);
  let at = 0;
  for (const [ms, line] of r.async) { at += ms; t.busy.timers.push(setTimeout(() => { if (line !== null) push(t, line); }, at)); }
  if (!r.forever) t.busy.timers.push(setTimeout(() => { t.busy = null; paintIn(t); marks(t); }, at + 60));
}
function interrupt(t) {
  if (t.busy) { t.busy.timers.forEach(clearTimeout); t.busy = null; push(t, '^C'); }
  else { push(t, cmdLine(t, t.input) + '^C'); t.input = ''; t.pos = 0; }
  paintIn(t); marks(t);
}
function clearT(t) { t.lines = []; if (t.el) t.el.querySelector('.term-lines').innerHTML = ''; paintIn(t); }

// ---------- Copy, paste, send to the conversation ----------
const chip = document.createElement('div'); chip.className = 'sh-selchip'; chip.hidden = true;
chip.innerHTML = `<button type="button" data-sh="selcopy">${ICON_COPY}<span>Kopioi</span></button><button type="button" data-sh="selsend">${IC.send}<span>Vie keskusteluun</span></button>`;
uiFrame.appendChild(chip);
chip.addEventListener('mousedown', (e) => e.preventDefault());
document.addEventListener('selectionchange', () => {
  const s = getSelection(); const n = s.anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentElement);
  const term = el?.closest?.('.term-scroll')?.closest('.term');
  if (!term || !s.toString().trim()) { chip.hidden = true; SELT = null; return; }
  SELT = term.dataset.term;
  const r = s.getRangeAt(0).getBoundingClientRect(), f = uiFrame.getBoundingClientRect();
  chip.hidden = false;
  chip.style.left = Math.max(8, Math.min(r.left - f.left, f.width - chip.offsetWidth - 8)) + 'px';
  chip.style.top = (r.top - f.top > 48 ? r.top - f.top - 40 : r.bottom - f.top + 6) + 'px';
});
const selText = () => getSelection().toString().replace(/\u00a0/g, ' ').replace(/[ \t]+$/gm, '').trim();
async function copySel() {
  const txt = selText(); if (!txt) return;
  try { await navigator.clipboard.writeText(txt); } catch {}
  getSelection().removeAllRanges(); chip.hidden = true; toast('Valinta kopioitiin leikepöydälle.'); focusTerm();
}
function sendSel() {
  const txt = selText(); const t = byId(SELT); if (!txt || !t) return;
  getSelection().removeAllRanges(); chip.hidden = true;
  const target = CUR === 'v1' || !t.ws ? selConv() : (allConvs().find(c => c.ws.id === t.ws && !c.archived) || selConv());
  if (CUR !== 'v1') { UI.sel = target.id; VIEW = 'conv'; render(); }
  const ta = document.querySelector('.composer textarea');
  ta.value = `${ta.value ? ta.value.replace(/\s*$/, '\n\n') : ''}\`\`\`\n${txt}\n\`\`\`\n`;
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  toast(`Valinta lisättiin keskustelun ”${target.title}” kenttään. Lähetä, kun olet valmis.`);
}
function pasteText(t, text) {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n');
  if (lines.length < 2) return typeText(t, lines[0] || '');
  const bar = t.el.querySelector('.term-paste');
  bar.innerHTML = `<div class="tp-head">${IC.paste}<span><strong>Liitetäänkö ${lines.length} riviä?</strong> Pääte ajaa ne kuin kirjoitettuina, rivi kerrallaan.</span></div><pre class="tp-prev mono">${lines.slice(0, 4).map(esc).join('\n')}${lines.length > 4 ? `\n${k('tm', `… ja ${lines.length - 4} riviä lisää`)}` : ''}</pre><div class="tp-acts"><button type="button" class="secondary" data-sh="pastecancel:${t.id}">Peruuta</button><button type="button" class="primary" data-sh="pasteok:${t.id}">Liitä ja aja</button></div>`;
  bar.hidden = false; bar._lines = lines; bar.querySelector('.primary').focus({ preventScroll: true });
  bar.onkeydown = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); pasteDone(t, false); } };
}
function pasteDone(t, ok) {
  const bar = t.el.querySelector('.term-paste'); const q = ok ? [...bar._lines] : []; bar.hidden = true; bar.innerHTML = '';
  focusTerm();
  const next = () => { if (!q.length) return; if (t.busy) return setTimeout(next, 200); t.input = q.shift(); t.pos = t.input.length; submit(t); setTimeout(next, 160); };
  next();
}
async function clipPaste(t) {
  try { const s = await navigator.clipboard.readText(); return pasteText(t, s); }
  catch { toast('Selain ei antanut leikepöytää. Liitä Ctrl+V:llä tai pitkällä painalluksella.'); }
}

// ---------- Phone key row ----------
const KEYS = [['Escape', 'Esc'], ['Tab', 'Tab'], ['ctrl', 'Ctrl'], ['alt', 'Alt'], ['ArrowLeft', '←'], ['ArrowUp', '↑'], ['ArrowDown', '↓'], ['ArrowRight', '→'], ['t:|', '|'], ['t:-', '-'], ['t:/', '/'], ['t:~', '~']];
const keysHtml = () => `<div class="sh-keys" role="toolbar" aria-label="Päätteen näppäimet">${KEYS.map(([kk, l]) => `<button type="button" class="sh-key${kk.length > 3 && !kk.startsWith('t:') && !kk.startsWith('Arrow') ? ' wide' : ''}" data-sh="key:${kk}"${kk === 'ctrl' || kk === 'alt' ? ` aria-pressed="${STICKY[kk]}"` : ''} aria-label="${kk.startsWith('Arrow') ? { ArrowLeft: 'Vasen', ArrowUp: 'Ylös', ArrowDown: 'Alas', ArrowRight: 'Oikea' }[kk] : l}">${l}</button>`).join('')}<button type="button" class="sh-key wide paste" data-sh="clip" aria-label="Liitä leikepöydältä">${IC.paste}<span>Liitä</span></button></div>`;
function paintKeys() { document.querySelectorAll('.sh-key[aria-pressed]').forEach(b => b.setAttribute('aria-pressed', String(STICKY[b.dataset.sh.slice(4)]))); }
document.addEventListener('pointerdown', (e) => { if (e.target.closest('.sh-key')) e.preventDefault(); }, true);

// ---------- Opening, closing, attaching ----------
const gate = document.createElement('dialog'); gate.className = 'confirm sh-gate'; document.body.appendChild(gate);
const ask = document.createElement('dialog'); ask.className = 'confirm'; document.body.appendChild(ask);
let gateThen = null, askThen = null;
function gateHtml(wait) {
  return `<form method="dialog"><div class="sh-gate-ic">${IC.term}</div><h3>Avataanko pääte?</h3>
<p>Pääte ajaa komentoja käyttäjänä <span class="mono">${USER}</span> palvelimella <span class="mono">${SRV}</span>. Sillä on samat oikeudet kuin agenteillasi: kaikki kotihakemiston tiedostot, avaimet ja kirjautumiset.</p>
<p class="sub">Pääte jatkaa palvelimella, kun suljet selaimen, ja on tallessa, kun palaat. Lopeta se välilehden ×-painikkeella tai komennolla <span class="mono">exit</span>.</p>
${REAUTH ? `<p class="sh-reauth">${IC.shield}<span>${wait ? 'Odotetaan GitHubia… Vahvista kirjautuminen avautuneessa ikkunassa.' : 'Vahvista ensin, että olet sinä. GitHub kysyy kirjautumista uudelleen, ja vahvistus on voimassa tämän selainistunnon ajan.'}</span></p>` : ''}
<div class="confirm-actions"><button class="secondary" value="cancel">Peruuta</button><button class="primary" value="ok" autofocus${wait ? ' disabled' : ''}>${REAUTH ? (wait ? '<span class="sh-spin"></span>Odotetaan…' : 'Vahvista GitHubilla') : 'Avaa pääte'}</button></div></form>`;
}
gate.addEventListener('close', () => {
  const then = gateThen; if (gate.returnValue !== 'ok' || !then) { gateThen = null; return; }
  gate.returnValue = '';
  if (!REAUTH) { GATE = true; gateThen = null; return then(); }
  gate.innerHTML = gateHtml(true); gate.showModal();
  setTimeout(() => { gateThen = null; GATE = true; gate.close(); then(); toast('Henkilöllisyys vahvistettu GitHubilla tälle selainistunnolle.'); }, 1300);
});
ask.addEventListener('close', () => { const then = askThen; askThen = null; if (ask.returnValue === 'ok' && then) then(); ask.returnValue = ''; });
function nextName(ws) { const used = new Set(SH.map(t => t.name)); if (!used.has('bash')) return 'bash'; let i = 2; while (used.has(`bash-${i}`)) i++; return `bash-${i}`; }
function openShell(ws) {
  if (!GATE) { gateThen = () => openShell(ws); gate.innerHTML = gateHtml(false); return gate.showModal(); }
  const win = SH.filter(t => t.sess === ws).reduce((m, t) => Math.max(m, t.win + 1), 0);
  const t = mk({ name: nextName(ws), ws, cwd: wsPath(ws), sess: ws, win, opened: hm() });
  SH.push(t); ACT = t.id;
  if (CUR === 'v1') { if (selConv().ws.id !== ws) { const c = allConvs().find(x => x.ws.id === ws && !x.archived); if (c) UI.sel = c.id; } PANEL = true; } else VIEW = 'shell';
  render(); focusTerm();
}
function endShell(t, how = 'exit') {
  t.busy?.timers.forEach(clearTimeout);
  SH = SH.filter(x => x !== t);
  if (ACT === t.id) { const rest = CUR === 'v2' ? ofWs(t.ws) : listNow(); ACT = rest[0]?.id ?? null; if (CUR === 'v2' && !ACT) VIEW = 'conv'; }
  render(); if (ACT) focusTerm();
  toast(how === 'exit' ? `${t.name} päättyi (exit). tmux-ikkuna suljettiin.` : `${t.name} lopetettiin.`);
}
function closeShell(t) {
  if (t.own) { t.open = false; t.el = null; if (ACT === t.id) { ACT = (CUR === 'v2' ? [] : listNow())[0]?.id ?? null; if (CUR === 'v2') VIEW = 'conv'; } render(); return toast(`Irrotettiin ${t.sess}. Istunto jatkuu tmuxissa; liity uudelleen tmux-valikosta.`); }
  if (!t.busy) return endShell(t, 'kill');
  askThen = () => endShell(t, 'kill');
  ask.innerHTML = `<form method="dialog"><h3>Lopetetaanko ${esc(t.name)}?</h3><p>Siinä on käynnissä <span class="mono">${esc(t.busy.cmd)}</span>. Lopetus päättää sen ja sulkee tmux-ikkunan <span class="mono">${esc(t.sess)}:${t.win}</span>.</p><p class="sub">Jos haluat vain pois näkyvistä, ${CUR === 'v1' ? 'piilota paneeli: päätteet jatkavat' : 'siirry muualle: pääte jatkaa'}.</p><div class="confirm-actions"><button class="secondary" value="cancel" autofocus>Peruuta</button><button class="sh-danger" value="ok">Lopeta pääte</button></div></form>`;
  ask.showModal();
}
function attach(t) { t.open = true; ACT = t.id; if (CUR !== 'v1') VIEW = 'shell'; else PANEL = true; render(); focusTerm(); toast(`Liityttiin tmux-istuntoon ${t.sess}.`); }

// ---------- Small menus (attach, new in Oma näkymä) ----------
const shMenu = document.createElement('div'); shMenu.className = 'p-menu sh-menu'; shMenu.setAttribute('role', 'menu'); shMenu.hidden = true; uiFrame.appendChild(shMenu);
function openShMenu(kind, anchor) {
  if (MENU2 === kind) return closeShMenu();
  MENU2 = kind;
  shMenu.innerHTML = kind === 'attach'
    ? `<div class="sh-menu-h">Muut tmux-istunnot</div>${others().map(t => `<button type="button" role="menuitem" data-sh="attach:${t.id}">${IC.attach}<span><span class="mono">${esc(t.sess)}</span> <span class="sub">· ikkuna ${esc(t.name)}${t.busy ? ` · ajaa ${esc(t.busy.fg)}` : ''}</span></span></button>`).join('') || '<p class="sh-menu-empty">Ei muita istuntoja.</p>'}`
    : `<div class="sh-menu-h">Uusi pääte työtilaan</div>${UI.ws.map(w => `<button type="button" role="menuitem" data-sh="new:${w.id}">${IC.term}<span class="mono">${esc(w.id)}</span><span class="kbd mono">${esc(w.path)}</span></button>`).join('')}`;
  shMenu.hidden = false;
  const f = uiFrame.getBoundingClientRect(), a = anchor.getBoundingClientRect();
  shMenu.style.left = Math.max(8, Math.min(a.right - f.left - shMenu.offsetWidth, f.width - shMenu.offsetWidth - 8)) + 'px';
  shMenu.style.top = (a.bottom - f.top + 6) + 'px'; shMenu.style.bottom = '';
  if (a.bottom - f.top + 6 + shMenu.offsetHeight > f.height - 8) { shMenu.style.top = ''; shMenu.style.bottom = (f.bottom - a.top + 6) + 'px'; }
  anchor.setAttribute('aria-expanded', 'true');
  shMenu.querySelector('button')?.focus({ preventScroll: true });
}
function closeShMenu() { MENU2 = null; shMenu.hidden = true; document.querySelectorAll('[data-sh^="menu:"]').forEach(b => b.setAttribute('aria-expanded', 'false')); }

// ---------- The pane: tabs, terminal, keys, hint (shared by all directions) ----------
function tabsHtml(list, groups) {
  let h = '', last = null;
  for (const t of list) {
    if (groups && t.sess !== last) { h += `<span class="sh-group mono" aria-hidden="true">${esc(t.sess)}</span>`; last = t.sess; }
    const on = t.id === ACT;
    h += `<div class="sh-tab${on ? ' on' : ''}${t.own ? ' own' : ''}"><button type="button" role="tab" id="tab-${t.id}" aria-selected="${on}" aria-controls="sh-host" tabindex="${on ? 0 : -1}" data-sh="tab:${t.id}" title="${esc(tip(t))}"><span class="sh-mark" data-mark="${t.id}">${mark(t)}</span><span class="mono">${esc(t.name)}</span>${t.own && !groups ? `<span class="sh-own mono">${esc(t.sess)}</span>` : ''}</button><button type="button" class="sh-x" data-sh="close:${t.id}" aria-label="${t.own ? 'Irrota' : 'Lopeta'} ${esc(t.name)}" title="${t.own ? 'Irrota: istunto jatkuu tmuxissa' : 'Lopeta pääte'}">${t.own ? IC.detach : IC.x}</button></div>`;
  }
  return h;
}
const tool = (act, icon, label, extra = '') => `<button type="button" class="icon-btn sh-tool" data-sh="${act}" aria-label="${label}" title="${label}"${extra}>${icon}</button>`;
const attachTool = () => others().length ? `<button type="button" class="sh-tool sh-attach" data-sh="menu:attach" aria-haspopup="menu" aria-expanded="false" title="Liity omaan tmux-istuntoon">${IC.attach}<span>tmux</span><span class="sh-n">${others().length}</span></button>` : '';
function hintHtml() {
  const out = CUR === 'v2' ? 'vie fokuksen sivupalkin riviin' : 'vie fokuksen välilehtiin';
  return `<p class="sh-hint"><kbd>Ctrl</kbd>+<kbd>\`</kbd> ${out} ja takaisin · <kbd>Tab</kbd> ja <kbd>Esc</kbd> kuuluvat päätteelle · valinta: <kbd>Ctrl</kbd>+<kbd>C</kbd> kopioi, <kbd>Ctrl</kbd>+<kbd>V</kbd> liittää</p>`;
}
function paneHtml(list, o) {
  const bar = o.tabs ? `<div class="sh-bar">${o.lead || ''}<div class="sh-tabs" role="tablist" aria-label="${esc(o.label)}">${tabsHtml(list, o.groups)}</div><div class="sh-tools">${o.tools || ''}</div></div>` : '';
  return `<div class="sh-pane ${o.cls || ''}">${bar}<div class="sh-host${OFFLINE ? ' offline' : ''}" id="sh-host" role="tabpanel"${ACT && o.tabs ? ` aria-labelledby="tab-${ACT}"` : ''}>${list.length ? '' : o.empty}</div>${list.length ? keysHtml() + hintHtml() : ''}</div>`;
}
function mount() {
  const host = document.getElementById('sh-host'); const t = active();
  document.querySelectorAll('.term').forEach(el => { const x = byId(el.dataset.term); if (x) x.st = el.querySelector('.term-scroll').scrollTop; });
  if (!host || !t || !listNow().includes(t)) return;
  const el = termEl(t); host.appendChild(el); el.classList.toggle('offline', OFFLINE);
  el.querySelector('.term-kbd').readOnly = OFFLINE;
  if (t.st == null || t.follow !== false) scrollEnd(t, true); else el.querySelector('.term-scroll').scrollTop = t.st;
}
function focusTerm() { requestAnimationFrame(() => active()?.el?.querySelector('.term-kbd')?.focus({ preventScroll: true })); }

// ---------- Conversation stage (the conversation the panel sits under) ----------
const Q5 = { md: 'Tallennustilan näkymässä lukee "Käytetty 35,0 Gt / 50 Gt". Laita vapaa tila ensin ja tarkista, että `PersonalStorage`-testit menevät läpi.', time: '14.22' };
const A5 = 'Muutin `web/src/app/PersonalStorage.tsx`:n otsikon muotoon **Vapaana 15,0 Gt · käytössä 35,0 / 50 Gt** ja päivitin kaksi testiä. `npm run --prefix web test -- PersonalStorage` menee läpi (6 testiä). Vite-palvelin päivittää näkymän heti, jos se on auki.';
function convStage() {
  const c = selConv();
  if (c.id !== 'c5') return `<div class="empty-convo"><p>Tässä vedoksessa vain <strong>Kiintiönäkymän tekstit</strong> on auki.</p><p>${CUR === 'v1' ? 'Paneeli näyttää tämän työtilan päätteet' : 'Työtilan päätteet ovat sivupalkissa'}: <span class="mono">${esc(c.ws.id)}</span>.</p></div>`;
  return `<div class="vwrap">${userBubble(Q5, 0)}<article class="bubble reply"><div class="prose">${md(A5)}</div><div class="bar foot"><span class="ok">${ICON_CHECK}Vastaus valmis</span><span class="model">${MODEL}</span><time class="meta">14.26</time>${copyBtn('Kopioi vastaus', A5)}</div></article></div>`;
}
function emptyHtml(ws) {
  return `<div class="sh-empty">${IC.term}<p>${ws ? `Työtilassa <span class="mono">${esc(ws)}</span> ei ole päätettä.` : 'Ei avoimia päätteitä.'}</p><p class="sub">Pääte on tavallinen bash ${ws ? 'työtilan hakemistossa' : 'valitsemasi työtilan hakemistossa'}. Se jatkaa palvelimella, kun suljet selaimen.</p>${ws ? `<button type="button" class="primary" data-sh="new:${ws}">${IC.term}<span>Avaa pääte</span></button>` : `<button type="button" class="primary" data-sh="menu:new" aria-haspopup="menu" aria-expanded="false">${IC.term}<span>Avaa pääte…</span></button>`}${others().length ? `<button type="button" class="secondary" data-sh="menu:attach" aria-haspopup="menu" aria-expanded="false">${IC.attach}<span>Liity tmux-istuntoon</span></button>` : ''}</div>`;
}
function stageHtml() {
  if (CUR === 'v1' || VIEW === 'conv') return convStage();
  if (CUR === 'v2') return paneHtml(listNow(), { tabs: false, empty: emptyHtml(null) });
  return paneHtml(listNow(), { tabs: true, groups: true, label: 'Päätteet', tools: `${attachTool()}<button type="button" class="sh-tool sh-new" data-sh="menu:new" aria-haspopup="menu" aria-expanded="false" title="Uusi pääte">${IC.plus}<span>Uusi</span></button>`, empty: emptyHtml(null) });
}

// ---------- Paneeli: the dock under the conversation ----------
const dock = document.createElement('section'); dock.className = 'sh-dock'; dock.setAttribute('aria-label', 'Päätepaneeli'); dock.hidden = true; uiCol.appendChild(dock);
function paintDock() {
  const on = CUR === 'v1' && PANEL;
  dock.hidden = !on; uiFrame.classList.toggle('sh-docked', on); uiFrame.classList.toggle('sh-max', on && MAX);
  if (!on) { dock.innerHTML = ''; return; }
  const ws = selConv().ws.id; const list = listNow();
  if (!list.some(t => t.id === ACT)) ACT = list[0]?.id ?? null;
  dock.style.setProperty('--sh-h', PH + 'px');
  dock.innerHTML = `<div class="sh-grip" role="separator" aria-orientation="horizontal" aria-label="Paneelin korkeus" aria-valuenow="${PH}" aria-valuemin="160" aria-valuemax="640" tabindex="0"></div>` + paneHtml(list, {
    tabs: true, label: `Päätteet: ${ws}`,
    lead: `<button type="button" class="sh-back" data-sh="hide" aria-label="Takaisin keskusteluun">${IC.back}<span>Keskustelu</span></button><span class="sh-wsname mono" title="${esc(wsPath(ws))}">${esc(ws)}</span>`,
    tools: `${list.length ? tool(`new:${ws}`, IC.plus, `Uusi pääte työtilaan ${ws}`) : ''}${attachTool()}${tool('max', MAX ? IC.min : IC.max, MAX ? 'Palauta koko' : 'Suurenna', ` aria-pressed="${MAX}"`)}${tool('hide', IC.hide, 'Piilota paneeli (päätteet jatkavat)')}`,
    empty: emptyHtml(ws),
  });
}
dock.addEventListener('pointerdown', (e) => {
  const g = e.target.closest('.sh-grip'); if (!g) return;
  e.preventDefault(); const y0 = e.clientY, h0 = PH;
  const mv = (ev) => { PH = Math.max(160, Math.min(640, h0 + y0 - ev.clientY)); dock.style.setProperty('--sh-h', PH + 'px'); g.setAttribute('aria-valuenow', PH); };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
});
dock.addEventListener('keydown', (e) => {
  if (!e.target.classList.contains('sh-grip') || !/^Arrow(Up|Down)$/.test(e.key)) return;
  e.preventDefault(); PH = Math.max(160, Math.min(640, PH + (e.key === 'ArrowUp' ? 24 : -24))); dock.style.setProperty('--sh-h', PH + 'px'); e.target.setAttribute('aria-valuenow', PH);
});

// ---------- Frame hooks: sidebar rows, top bar, workspace menu ----------
const libList = APP.list, libActions = APP.actions;
const shRow = (t) => `<li><a href="#" class="conv-row sh-row" data-sh="sel:${t.id}"${VIEW === 'shell' && ACT === t.id ? ' aria-current="page"' : ''} title="${esc(tip(t))}"><span class="sh-ric">${IC.term}</span><span class="conv-title mono">${esc(t.name)}</span><span class="st" data-mark="${t.id}">${mark(t)}</span></a></li>`;
APP.list = (w, convs) => {
  const base = libList(w, convs);
  if (CUR !== 'v2') return base;
  const rows = ofWs(w.id); return rows.length ? base + `<ul class="convs sh-rows" aria-label="Päätteet: ${esc(w.id)}">${rows.map(shRow).join('')}</ul>` : base;
};
APP.actions = (c) => {
  const base = libActions(c);
  if (CUR === 'v1') { const n = listNow().length; return `<button class="icon-btn tb-btn sh-tb" type="button" data-sh="toggle" aria-pressed="${PANEL}" aria-label="Pääte" title="Pääte (Ctrl+\`)">${IC.term}${n ? `<span class="sh-count">${n}</span>` : ''}</button>` + base; }
  if (CUR === 'v3') return `<button class="icon-btn tb-btn" type="button" data-sh="open:${c.ws.id}" aria-label="Pääte työtilassa ${esc(c.ws.id)}" title="Pääte työtilassa ${esc(c.ws.id)} (Ctrl+\`)">${IC.term}</button>` + base;
  return base;
};
// The workspace … menu (lib/account.js, private) gets Uusi pääte after Uusi keskustelu.
const acctMenu = [...uiFrame.querySelectorAll('.p-menu')].find(m => !m.classList.contains('sh-menu'));
const closeAcctMenu = () => { if (acctMenu && !acctMenu.hidden) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); };
if (acctMenu) new MutationObserver(() => {
  const first = acctMenu.querySelector('[data-p^="new:"]');
  if (acctMenu.hidden || !first || acctMenu.querySelector('[data-sh^="new:"]')) return;
  first.insertAdjacentHTML('afterend', `<button type="button" role="menuitem" data-sh="new:${first.dataset.p.slice(4)}">${IC.term}<span>Uusi pääte</span></button>`);
}).observe(acctMenu, { childList: true, attributes: true, attributeFilter: ['hidden'] });
const libPaintRail2 = paintRail;
paintRail = function () {
  libPaintRail2();
  uiRail.querySelectorAll('.sh-home').forEach(x => x.remove());
  if (CUR === 'v2') {
    uiRail.querySelectorAll('.ws-row').forEach(r => { const id = r.querySelector('[data-ws-tog]').dataset.wsTog; r.querySelector('.ws-add').insertAdjacentHTML('beforebegin', `<button class="ws-add sh-ws-add" type="button" data-sh="new:${id}" aria-label="Uusi pääte työtilassa ${id}" title="Uusi pääte">${IC.term}</button>`); });
    const own = SH.filter(t => t.own);
    if (own.length) uiRail.querySelector('.rail-list').insertAdjacentHTML('beforeend', `<section class="ws sh-other"><div class="ws-row"><span class="sh-other-h">Muut tmux-istunnot</span></div><ul class="convs">${own.map(t => t.open ? shRow(t).replace('</span><span class="st"', `</span><span class="sh-own mono">${esc(t.sess)}</span><span class="st"`) : `<li><button type="button" class="conv-row sh-row sh-join" data-sh="attach:${t.id}" title="Liity: ${esc(t.sess)}"><span class="sh-ric">${IC.attach}</span><span class="conv-title"><span class="mono">${esc(t.sess)}</span> <span class="sub">· ${esc(t.name)}</span></span><span class="sh-joinl">Liity</span></button></li>`).join('')}</ul></section>`);
  }
  if (CUR === 'v3') {
    const n = shown().length;
    uiRail.querySelector('.home-row')?.insertAdjacentHTML('afterend', `<a href="#" class="home-row sh-home" data-sh="view"${VIEW === 'shell' ? ' aria-current="page"' : ''}>${IC.term}<span>Pääte</span>${n ? `<span class="sh-count">${n}</span>` : ''}</a>`);
  }
  if (VIEW === 'shell' && CUR !== 'v1') uiRail.querySelectorAll('.conv-row[aria-current]:not(.sh-row)').forEach(a => a.removeAttribute('aria-current'));
};
APP.painted.push(() => {
  const full = CUR !== 'v1' && VIEW === 'shell';
  uiFrame.classList.toggle('sh-full', full);
  if (!full) return;
  const menu = `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button>`;
  if (CUR === 'v2') {
    const t = active(); if (!t) return;
    const state = t.busy ? `<span class="chip working" role="status"><span class="st-dot working"></span><span class="chip-label">Ajaa <span class="mono">${esc(t.busy.fg)}</span></span></span>` : `<span class="chip" role="status"><span class="sh-prompt">$</span><span class="chip-label">Kehotteessa</span></span>`;
    uiTop.innerHTML = `${menu}<div class="tb-title"><strong class="mono">${esc(t.name)}</strong>${t.ws ? `<a href="#" class="tb-ws" data-ui="ws">${esc(t.ws)}</a>` : `<span class="tb-ws">tmux ${esc(t.sess)}</span>`}<span class="tb-ws sh-cwd">${esc(t.cwd)}</span></div><div class="tb-right">${state}<span class="tb-actions">${attachTool()}<button class="icon-btn tb-btn" type="button" data-sh="close:${t.id}" aria-label="${t.own ? 'Irrota' : 'Lopeta pääte'}" title="${t.own ? 'Irrota: istunto jatkuu tmuxissa' : 'Lopeta pääte'}">${t.own ? IC.detach : IC.x}</button></span></div>`;
  } else {
    const n = shown().length, s = new Set(shown().map(t => t.sess)).size;
    uiTop.innerHTML = `${menu}<div class="tb-title"><strong>Pääte</strong><span class="tb-ws">${n ? `${n} ${n === 1 ? 'pääte' : 'päätettä'} · ${s} tmux-${s === 1 ? 'istunto' : 'istuntoa'}` : 'ei avoimia'}</span></div>`;
  }
});

// ---------- Connection banner, away curtain, demo controls ----------
const banner = document.createElement('div'); banner.className = 'sh-offline'; banner.setAttribute('role', 'status'); banner.hidden = true;
banner.innerHTML = `${IC.off}<span><strong>Yhteys palvelimeen katkesi.</strong> Päätteet jatkavat palvelimella; näkymä palaa, kun yhteys palaa. Yritetään uudelleen…</span>`;
uiMain.insertBefore(banner, uiTop.nextSibling);
const curtain = document.createElement('div'); curtain.className = 'sh-away'; curtain.hidden = true; uiFrame.appendChild(curtain);
const bar = document.querySelector('.page-bar');
bar.querySelector('.hint').insertAdjacentHTML('beforebegin', `<span class="sh-demo" aria-label="Prototyypin esitys"><span>Esitys</span><button type="button" data-sh="demo:away">Sulje selain ja palaa</button><button type="button" data-sh="demo:offline">Yhteys katkeaa</button><button type="button" data-sh="demo:paste">Leikepöydällä 3 riviä</button><button type="button" data-sh="demo:fresh">Ei vielä päätteitä</button><label><input type="checkbox" id="sh-reauth"> Uudelleentunnistus</label></span>`);
bar.querySelector('#sh-reauth').addEventListener('change', (e) => { REAUTH = e.target.checked; });
function away() {
  closeShMenu(); chip.hidden = true;
  curtain.innerHTML = `<div><strong>Selain on suljettu</strong><span>Päätteet jatkavat palvelimella tmuxissa.</span></div>`; curtain.hidden = false;
  // While away, what keeps running keeps printing: vite rebuilds, a test run finishes.
  setTimeout(() => {
    const vite = SH.find(t => t.name === 'vite');
    if (vite) push(vite, viteHmr('/src/app/PersonalStorage.tsx'), viteHmr('/src/app/PersonalStorage.test.tsx'));
    for (const t of SH) { t.el = null; t.st = null; t.follow = true; }
    curtain.innerHTML = `<div><span class="sh-spin"></span><strong>Yhdistetään…</strong><span>tmux piirtää päätteet uudelleen.</span></div>`;
  }, 1300);
  setTimeout(() => { curtain.hidden = true; render(); focusTerm(); const n = shown().length; toast(n ? `Palattiin. ${n === 1 ? 'Pääte jatkoi' : `${n} päätettä jatkoivat`} palvelimella.` : 'Palattiin.'); }, 2000);
}
function offline() {
  OFFLINE = true; banner.hidden = false; render();
  setTimeout(() => { OFFLINE = false; banner.hidden = true; render(); focusTerm(); toast('Yhteys palasi.'); }, 3200);
}

// ---------- Events ----------
function render() {
  closeShMenu(); chip.hidden = true;
  paint(); paintDock();
  stage.innerHTML = stageHtml(); mount();
}
function showConv(id) { UI.sel = id; UI.drawer = false; VIEW = 'conv'; render(); }
window.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('.proto-picker')) return;
  const stop = () => { e.preventDefault(); e.stopPropagation(); };
  const conv = t.closest('[data-conv]'); if (conv) { stop(); return showConv(conv.dataset.conv); }
  if (t.closest('[data-ws-add]')) { stop(); return toast('Uusi keskustelu ei kuulu tähän vedokseen.'); }
  const h = t.closest('[data-sh]');
  if (!h) { if (MENU2 && !t.closest('.sh-menu')) closeShMenu(); return; }
  stop(); if (h.getAttribute('aria-disabled') === 'true') return;
  closeAcctMenu();
  const [a, arg] = h.dataset.sh.split(/:(.*)/s);
  const tt = active();
  switch (a) {
    case 'toggle': PANEL = !PANEL; render(); if (PANEL) focusTerm(); return;
    case 'hide': PANEL = false; MAX = false; render(); return uiTop.querySelector('[data-sh="toggle"]')?.focus();
    case 'max': MAX = !MAX; render(); return focusTerm();
    case 'new': closeShMenu(); return openShell(arg);
    case 'open': { VIEW = 'shell'; const f = ofWs(arg)[0]; if (!f) return openShell(arg); ACT = f.id; render(); return focusTerm(); }
    case 'view': VIEW = 'shell'; UI.drawer = false; if (!active()) ACT = listNow()[0]?.id ?? null; render(); return focusTerm();
    case 'tab': ACT = arg; render(); return focusTerm();
    case 'sel': ACT = arg; VIEW = 'shell'; UI.drawer = false; render(); return focusTerm();
    case 'close': return closeShell(byId(arg));
    case 'attach': closeShMenu(); UI.drawer = false; return attach(byId(arg));
    case 'menu': return openShMenu(arg, h);
    case 'selcopy': return copySel();
    case 'selsend': return sendSel();
    case 'pasteok': return pasteDone(byId(arg), true);
    case 'pastecancel': return pasteDone(byId(arg), false);
    case 'clip': if (tt) clipPaste(tt); return;
    case 'key': {
      if (!tt) return;
      if (arg === 'ctrl' || arg === 'alt') { STICKY[arg] = !STICKY[arg]; paintKeys(); return focusTerm(); }
      send(tt, arg.startsWith('t:') ? arg.slice(2) : arg, false, false); return focusTerm();
    }
    case 'demo':
      if (arg === 'away') return away();
      if (arg === 'offline') return offline();
      if (arg === 'paste') { if (!tt) return toast('Avaa ensin pääte.'); return pasteText(tt, 'cd web\nnpm run lint\ncd ..\n'); }
      if (arg === 'fresh') { for (const x of SH) x.busy?.timers.forEach(clearTimeout); SH = []; ACT = null; GATE = false; VIEW = CUR === 'v3' ? 'shell' : 'conv'; render(); return toast('Ei vielä päätteitä eikä tmux-istuntoja. Ensimmäinen avaus näyttää, mitä pääte saa.'); }
  }
}, true);
// Ctrl+` moves between the terminal and what surrounds it, in every direction.
window.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey && (e.key === '`' || e.code === 'Backquote'))) return;
  e.preventDefault(); e.stopPropagation();
  const inTerm = document.activeElement?.classList.contains('term-kbd');
  if (inTerm) {
    const el = CUR === 'v2' ? uiRail.querySelector(`[data-sh="sel:${ACT}"]`) : document.getElementById(`tab-${ACT}`);
    if (el) { if (CUR === 'v2') { UI.drawer = true; paint(); } return (CUR === 'v2' ? uiRail.querySelector(`[data-sh="sel:${ACT}"]`) : el).focus(); }
    return;
  }
  if (CUR === 'v1') { PANEL = true; render(); return focusTerm(); }
  if (!active()) ACT = listNow()[0]?.id ?? (CUR === 'v2' ? shown()[0]?.id : null) ?? null;
  if (CUR === 'v2' && !active()) return toast('Ei avoimia päätteitä. Avaa sivupalkin työtilan päätepainikkeesta.');
  VIEW = 'shell'; UI.drawer = false; render(); focusTerm();
}, true);
// Tabs: arrows choose (and show), Enter or ↓ goes into the terminal, Delete closes.
document.addEventListener('keydown', (e) => {
  const tab = e.target.closest?.('[role="tab"][data-sh^="tab:"]'); if (!tab) return;
  const tabs = [...document.querySelectorAll('[role="tab"][data-sh^="tab:"]')]; const i = tabs.indexOf(tab);
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]; ACT = n.dataset.sh.slice(4); render(); document.getElementById(`tab-${ACT}`)?.focus(); }
  else if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusTerm(); }
  else if (e.key === 'Delete') { e.preventDefault(); closeShell(byId(tab.dataset.sh.slice(4))); }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !MENU2) return;
  e.stopPropagation(); const k2 = MENU2; closeShMenu(); document.querySelector(`[data-sh="menu:${k2}"]`)?.focus();
}, true);

const pick = (v) => () => {
  CUR = v; SH = seed(); ACT = SH[0].id; GATE = true; OFFLINE = false; MAX = false; PANEL = true; PH = 280; banner.hidden = true; curtain.hidden = true;
  VIEW = v === 'v1' ? 'conv' : 'shell';
  const c5 = UI.ws.flatMap(w => w.convs).find(c => c.id === 'c5'); c5.st = 'waiting';
  UI.sel = 'c5'; UI.pop = false; UI.drawer = false;
  if (gate.open) gate.close(); if (ask.open) ask.close();
  closeShMenu(); paint(); paintDock();
  queueMicrotask(mount); // the picker sets the stage right after this returns
  return stageHtml();
};
window.v1 = pick('v1'); window.v2 = pick('v2'); window.v3 = pick('v3');
})();
