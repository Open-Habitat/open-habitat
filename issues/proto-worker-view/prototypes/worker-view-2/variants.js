// Worker view round 2, on Kehys (round 1's variant 2): the worker opens in
// place of the parent with a persistent worker band; workers are not nested
// in the rail. The round asks two things: how a Claude Code worker reads while
// only its terminal can be shown, and how it switches to the conversation once
// its native history is readable; and how the missing composer is explained
// (the main agent can message a live Pi worker, so the person asks through
// the parent conversation). Markup copies the production conversation's DOM
// (round 1's captured/), so production CSS styles it; round.css holds only the
// round's own pieces. Synthetic content only; nothing here talks to a host.

const SVG = (body, cls = '') => `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${cls ? ` class="${cls}"` : ''}>${body}</svg>`;
const ICON = {
  back: '<path d="m15 5-7 7 7 7"/>',
  forward: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  cross: '<path d="M5 5 19 19M19 5 5 19"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 8 4 4-4 4M14 16h3"/>',
  branch: '<circle cx="7" cy="6" r="2"/><path d="M7 8v10M7 12c0 3 3 4 7 4"/><circle cx="17" cy="16" r="2"/>',
  merge: '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 8v8M6 8c0 3 4 4 10 4"/>',
  warning: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  message: '<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
  ask: '<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M10 9.2a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6.9M12 13.6h.01"/>',
  expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
  agent: '<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M9 13h.01M15 13h.01"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4M12 8v4l3 2"/>',
};
const icon = (n, cls) => SVG(ICON[n], cls);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const md = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

// ---------------------------------------------------------------- facts ---
const PARENT = { title: 'Kellonäkymän kesäaika', workspace: 'aurinkokello' };
const WORKER = {
  title: 'Aikavyöhyketestit kellonäkymälle',
  issue: 'kello-dst',
  run: '01m5wkr7c2v9tq4h8zx3n6dpae',
  branch: 'wt/kello-dst',
  worktree: '~/src/aurinkokello__worktrees/wt-kello-dst',
  source: 'main',
  started: '14:02',
};
const HARNESS = {
  pi: { name: 'Pi', profile: 'toteutus', model: 'openai-codex/gpt-5-codex' },
  claude: { name: 'Claude Code', profile: 'toteutus-claude', model: 'claude-sonnet-5' },
};
const STATES = {
  running: { label: 'Työskentelee', tone: 'info', kind: 'working', elapsed: '6 min', live: true },
  waiting: { label: 'Odottaa päätteessä', tone: 'warning', kind: 'neutral', elapsed: '9 min', live: true },
  landed: { label: 'Valmis · laskeutui', tone: 'success', kind: 'success', elapsed: '11 min', live: false },
  failed: { label: 'Ei mergetty · työ tallessa', tone: 'danger', kind: 'error', elapsed: '14 min', live: false },
};
// history: whether the Claude worker's native history is readable.
//   none    — Habitat cannot read Claude Code history at all (today);
//   pending — it can, but this worker's history is not found yet;
//   ready   — readable.
// A Pi worker's history is always readable here (round 1 established that).
const HISTORY = { none: 'Habitat ei lue', pending: 'Ei vielä löytynyt', ready: 'Luettavissa' };
const S = { state: 'running', harness: 'claude', history: 'pending', view: 'auto', arrived: false, terminal: false, details: false, parent: false, draft: '', stages: {} };

const readable = () => S.harness === 'pi' || S.history === 'ready';
const st = () => STATES[S.state];
const harness = () => HARNESS[S.harness];

// ---------------------------------------------------- production pieces ---
const BTN = '_button_4cxqu_5 _surface_10v9u_2';
const B2 = `${BTN} _secondary_4cxqu_47 _sizeInline_4cxqu_32 ah-button ah-button-secondary wv-btn`;
const BQ = `${BTN} _quiet_4cxqu_53 _sizeInline_4cxqu_32 ah-button ah-button-quiet wv-btn`;
const BI = `${BTN} _quiet_4cxqu_53 _sizeRow_4cxqu_25 _icon_4cxqu_121 ah-button ah-button-quiet ah-topbar-icon`;
const statusMark = (kind, tone, label, extra = '') => {
  const glyph = kind === 'success' ? icon('check') : kind === 'error' ? icon('cross')
    : `<span aria-hidden="true" class="ah-status-dot${kind === 'working' ? ' ah-running' : ''}"></span>`;
  return `<span data-kind="${kind}" data-testid="status-mark" class="ah-status ah-tone-${tone} ah-status-${kind}${extra}">${glyph}${esc(label)}</span>`;
};
const copyBtn = (label) => `<button data-ah-primitive="button" data-ah-size="row" class="${BTN} _quiet_4cxqu_53 _sizeRow_4cxqu_25 _messageIcon_4cxqu_207 ah-button ah-button-quiet " type="button" aria-label="Kopioi viesti: ${esc(label)}">${icon('copy')}</button>`;
const prose = (html) => `<div class="ah-prose"><div class="ah-ordered-blocks"><div><div class="ah-markdown">${html}</div></div></div></div>`;

function briefMessage() {
  const label = 'Pääagentti · tehtävä';
  return `<li data-kind="user"><article data-testid="message" class="ah-message wv-brief"><header><strong>${label}</strong>${copyBtn(label)}</header>
<div class="ah-prose"><div class="ah-user-content"><div class="ah-ordered-blocks"><div><span class="ah-user-text">Lisää kellonäkymälle testit kesäajan vaihtumiselle (issue kello-dst). Älä muuta src/clock/format.ts:n julkista rajapintaa. Kun testit menevät läpi, mergeä taskfleet run merge -komennolla.</span></div></div></div></div></article></li>`;
}
function reply(role, html) {
  const interim = role === 'interim';
  const label = interim ? 'Worker · välivastaus' : 'Worker · vastaus';
  return `<div data-reply-kind="${role}" data-reply-role="${role}" class="ah-turn-reply${interim ? ' ah-turn-interim' : ''}"><article data-testid="message"${interim ? ' data-interim="true"' : ' data-reply-complete="true"'} class="ah-message ah-message-reply${interim ? ' ah-message-interim' : ''}"><header><strong>${interim ? icon('message') : icon('check')}${esc(label)}</strong>${copyBtn(label)}</header>${prose(html)}</article></div>`;
}
const STATE_TOOL = {
  succeeded: () => statusMark('success', 'neutral', 'valmis'),
  failed: () => statusMark('error', 'danger', 'epäonnistui'),
  running: () => statusMark('working', 'info', 'käynnissä'),
  waiting: () => statusMark('neutral', 'warning', 'odottaa syötettä'),
};
function tool(name, target, stat, state, output) {
  const id = `t${tool.n++}`;
  const open = output && S.stages[id];
  const body = open ? `<div class="ah-disclosure-panel"><div class="ah-output-box"><div class="ah-bash-window"><pre tabindex="0" class="ah-output-viewport ah-output-all"><code class="ah-syntax">${esc(output)}
</code></pre></div></div></div>` : '';
  return `<div class="ah-ordered-blocks"><div class="ah-pi-tool-use"><section data-testid="tool-row" data-tool-name="${name}" class="ah-tool-row" data-state="${state === 'waiting' ? 'running' : state}">
<button data-ah-primitive="disclosure" class="_disclosure_4cxqu_294 _surface_10v9u_2 _toolDisclosure_4cxqu_406 ah-disclosure-button" type="button" aria-expanded="${!!open}"${output ? ` data-wv-toggle="${id}"` : ''}>${icon('forward', open ? 'ah-icon-expanded' : '')}
<span class="ah-tool-names"><span class="ah-tool-name">${name}</span></span>${target ? `<span class="ah-tool-target wv-tool-target">${esc(target)}</span>` : ''}${stat ? `<span class="ah-file-stat">${esc(stat)}</span>` : ''}<span>${STATE_TOOL[state]()}</span></button>${body}</section></div></div>`;
}
tool.n = 0;
const think = (text) => `<div class="ah-ordered-blocks"><div class="ah-think-row"><span>Ajattelu</span><div class="ah-markdown"><p>${md(text)}</p></div></div></div>`;
function stageBlock(id, sum, elapsed, work, { defaultOpen = false, failures = 0 } = {}) {
  const open = S.stages[id] ?? defaultOpen;
  return `<div data-testid="turn-stage" class="ah-turn-stage"><button data-tool-count="1" data-failures="${failures}" data-ah-primitive="button" data-ah-size="row" class="${BTN} _quiet_4cxqu_53 _sizeRow_4cxqu_25 _text_4cxqu_60 ah-button-text ah-button ah-button-quiet " type="button" aria-expanded="${open}" data-wv-toggle="${id}" data-wv-default="${defaultOpen}"><span aria-hidden="true" class="ah-disclosure-chevron"></span><span class="ah-stage-sum">${esc(sum)}</span>${elapsed ? ` · <span class="ah-stage-elapsed">${esc(elapsed)}</span>` : ''}</button></div>${open ? `<div class="ah-turn-work">${work}</div>` : ''}`;
}
const working = (activity, clock) => `<div class="ah-turn-strip ah-turn-working"><button data-ah-primitive="button" data-ah-size="inline" class="${BTN} _secondary_4cxqu_47 _sizeInline_4cxqu_32 _pill_4cxqu_69 ah-button ah-button-secondary ah-show-work" type="button" aria-expanded="true"><span class="ah-work-label">Piilota työ</span><span aria-hidden="true" class="ah-disclosure-chevron"></span></button><span data-working="true" class="ah-turn-status" role="status"><span class="ah-turn-status-name">${statusMark('working', 'neutral', 'Worker työskentelee')}</span><span class="ah-turn-activity">${esc(activity)}</span><span class="ah-turn-clock" aria-live="off">${clock}</span></span></div>`;
const turn = (inner) => `<li data-kind="assistant"><section data-testid="agent-turn" class="ah-agent-turn">${inner}</section></li>`;

// ------------------------------------------------------ the conversation ---
const TEST_OK = '> aurinkokello@0.4.0 test\n> vitest run clock\n\n ✓ tests/clock.test.ts (15)\n   ✓ kesäaika › kevään siirto 03:00 → 04:00\n   ✓ kesäaika › syksyn toistuva tunti\n   ✓ kesäaika › --tz ohittaa järjestelmän\n\n Test Files  1 passed (1)\n      Tests  15 passed (15)';
const TEST_FAIL = '> vitest run clock\n\n ✗ tests/clock.test.ts (15)\n   ✓ kesäaika › kevään siirto 03:00 → 04:00\n   ✗ kesäaika › syksyn toistuva tunti\n     Expected "03:30 (EET)" to be "03:30 (EEST)"\n   ✓ kesäaika › --tz ohittaa järjestelmän\n\n      Tests  1 failed | 14 passed (15)';
const SSH_PROMPT = "The authenticity of host 'git.aurinkokello.example' can't be established.\nED25519 key fingerprint is SHA256:Xq3c…Vb0.\nAre you sure you want to continue connecting (yes/no/[fingerprint])?";

/** The worker's turns after the brief, as the conversation components would show them. */
function workerTurns() {
  tool.n = 0;
  const s = S.state;
  const items = [turn(
    reply('interim', '<p>Luen ensin nykyiset testit ja kellon muotoilun.</p>') +
    stageBlock('s1', 'Ajattelu · 3 työkalua', '48 s',
      think('Kesäaikaa ei testata lainkaan; `formatClock` lukee vyöhykkeen `Intl`-oliolta.') +
      tool('read', 'src/clock/format.ts', '84 riviä', 'succeeded') +
      tool('read', 'tests/clock.test.ts', '120 riviä', 'succeeded') +
      tool('bash', 'npm test -- clock', '', 'succeeded', TEST_OK.replace(/15/g, '12').replace(/\n {3}✓ kesäaika[^\n]*/g, ''))) +
    reply('interim', '<p>Kesäajan vaihde puuttuu testeistä. Lisään kolme tapausta: kevään siirto, syksyn toistuva tunti ja <code>--tz</code>-ohitus.</p>'))];
  const edit = tool('edit', 'tests/clock.test.ts', '+48 −0', 'succeeded');
  if (s === 'running') {
    items.push(turn(`<div class="ah-turn-work">${edit}${tool('bash', 'npm test -- clock', '', 'running')}</div>` + working('Ajaa testejä · npm test -- clock', '0:42')));
  } else if (s === 'waiting') {
    items.push(turn(stageBlock('s2', '2 työkalua', '1 min 10 s', edit + tool('bash', 'npm test -- clock', '', 'succeeded', TEST_OK)) +
      reply('interim', '<p>Testit menevät läpi. Haen vielä mainin muutokset ennen mergeä.</p>') +
      `<div class="ah-turn-work">${tool('bash', 'git fetch origin', '', 'waiting')}</div>` + waitingPrompt()));
  } else if (s === 'landed') {
    items.push(turn(stageBlock('s2', '3 työkalua', '1 min 40 s', edit + tool('bash', 'npm test -- clock', '', 'succeeded', TEST_OK) +
      tool('bash', 'taskfleet run merge', '', 'succeeded', 'rebased wt/kello-dst onto main\nmerged 3f9c2ab into main\nreport submitted (via: explicit-merge)')) +
      reply('final', '<p>Valmis. Lisäsin kolme kesäaikatestiä tiedostoon <code>tests/clock.test.ts</code>; kaikki 15 testiä menevät läpi. <code>format.ts</code> ei muuttunut. Työ laskeutui mainiin commitina <code>3f9c2ab</code>.</p>')));
  } else {
    items.push(turn(stageBlock('s2', '3 työkalua · 1 epäonnistui', '3 min 05 s', edit + tool('bash', 'npm test -- clock', '', 'failed', TEST_FAIL) +
      think('Korjaus vaatisi `formatClock`-funktiolle uuden parametrin, ja tehtävä kieltää sen.') +
      tool('bash', 'npm test -- clock', '', 'failed', TEST_FAIL), { defaultOpen: true, failures: 2 }) +
      reply('final', '<p>En saanut syksyn toistuvaa tuntia läpi muuttamatta <code>format.ts</code>:n julkista rajapintaa, jota tehtävä kielsi. Testit ovat haarassa <code>wt/kello-dst</code>; en mergennyt. Pääagentin pitää päättää, saako rajapinta muuttua.</p>')));
  }
  return items.join('');
}
// The prompt exists only in the terminal. A steering message cannot answer a
// native prompt, so the card offers the terminal and the parent, not a reply.
function waitingPrompt() {
  return `<div class="wv-prompt" role="status"><span class="wv-prompt-head">${icon('warning')}<strong>Worker odottaa vastausta päätteessä</strong></span>
<pre>${esc(SSH_PROMPT)}</pre>
<span class="wv-prompt-actions"><button type="button" class="${B2}" data-wv="view-term">${icon('terminal')}Näytä pääte</button><button type="button" class="${BQ}" data-wv="ask">Kysy pääagentilta →</button></span>
<small>Kehotteeseen vastataan workerin natiivissa päätteessä (<code>taskfleet run attach</code>). Selaimen pääte on vain luku.</small></div>`;
}
function resultCard() {
  if (S.state === 'landed') return `<aside class="wv-result" data-tone="ok"><header>${icon('merge')}<strong>Laskeutui mainiin</strong><span>commit <code>3f9c2ab</code> · 11 min</span></header><p>Kolme kesäaikatestiä lisätty; 15/15 testiä läpi. Worktree ja haara on poistettu.</p></aside>`;
  if (S.state === 'failed') return `<aside class="wv-result" data-tone="err"><header>${icon('warning')}<strong>Ei mergetty · työ tallessa</strong><span><code>${WORKER.branch}</code></span></header><p>Syksyn toistuva tunti vaatisi rajapintamuutoksen. Pääagentti päättää jatkosta.</p></aside>`;
  return '';
}
const feed = (inner) => `<section data-testid="conversation-timeline" aria-label="Workerin keskusteluhistoria" class="ah-timeline"><ol class="ah-feed">${inner}</ol></section>`;

// ------------------------------------------------------------- terminal ---
function terminalLines() {
  const claude = S.harness === 'claude';
  const base = [
    claude ? '╭─ Claude Code · claude-sonnet-5 ─────────────────────────╮' : '╭─ pi · toteutus · openai-codex/gpt-5-codex ─────────────╮',
    '│ ~/src/aurinkokello__worktrees/wt-kello-dst  (wt/kello-dst) │',
    '╰─────────────────────────────────────────────────────────╯',
    '',
    '● Luen ensin nykyiset testit ja kellon muotoilun.',
    '  ⎿ read src/clock/format.ts (84 riviä)',
    '  ⎿ read tests/clock.test.ts (120 riviä)',
    '  ⎿ $ npm test -- clock   ✓ 12 passed',
    '● Kesäajan vaihde puuttuu testeistä. Lisään kolme tapausta…',
    '  ⎿ edit tests/clock.test.ts (+48 −0)',
  ];
  if (S.state === 'running') base.push('  ⎿ $ npm test -- clock', '    ⠼ running 0:42');
  if (S.state === 'waiting') base.push('  ⎿ $ npm test -- clock   ✓ 15 passed', '  ⎿ $ git fetch origin', ...SSH_PROMPT.split('\n').map((l) => '    ' + l), '    █');
  if (S.state === 'landed') base.push('  ⎿ $ npm test -- clock   ✓ 15 passed', '  ⎿ $ taskfleet run merge   merged 3f9c2ab', '● Valmis. Työ laskeutui mainiin commitina 3f9c2ab.', '', '[taskfleet] node n-0001 reported success · window closes');
  if (S.state === 'failed') base.push('  ⎿ $ npm test -- clock   ✗ 1 failed | 14 passed', '  ⎿ $ npm test -- clock   ✗ 1 failed | 14 passed', '● En saanut syksyn toistuvaa tuntia läpi…', '', '[taskfleet] node n-0001 reported failure · work preserved on wt/kello-dst');
  return base.join('\n');
}
const termPre = () => `<pre class="wv-term">${esc(terminalLines())}</pre>`;
function terminalDock({ max = false, close = true } = {}) {
  return `<div class="ah-terminal-dock wv-terminal"${max ? ' data-max=""' : ''}><div class="ah-terminal-bar"><span class="ah-terminal-ws">${esc(WORKER.worktree.split('/').pop())}</span><div class="ah-terminal-tabs" role="tablist"><span class="ah-terminal-tab" data-active=""><button role="tab" aria-selected="true" type="button"><span class="ah-terminal-mark">${icon('agent')}</span>worker · ${esc(harness().name)} <span class="ah-terminal-ro">vain luku</span></button></span></div>
<span class="ah-terminal-tools">${close ? `<button type="button" class="${BI}" aria-label="Sulje pääte" data-wv="terminal-off">${icon('cross')}</button>` : ''}</span></div>
<div class="ah-terminal-host"><div class="ah-terminal-surface" data-fixed="">${termPre()}</div></div></div>`;
}

// A finished worker's agent process has exited and `run merge` tears its
// window down, so there is no terminal left; without readable history only
// the report remains.
function closedTerminal() {
  return `<div class="wv-closed">${icon('terminal')}<p><strong>Workerin pääte on suljettu.</strong> Worker on päättynyt${readable() ? '' : ', eikä sen keskustelua voi vielä lukea'}. Jäljellä on raportti.</p>${resultCard()}</div>`;
}
const termBody = () => st().live ? `<div class="wv-termview">${terminalDock({ close: false })}</div>` : closedTerminal();

// ------------------------------------------------------ worker identity ---
const stateMark = () => statusMark(st().kind, st().tone, st().label, ' wv-state');
function detailsList() {
  const h = harness();
  const hist = S.harness === 'claude' ? `<dt>Historia</dt><dd>${{ none: 'Habitat ei lue Claude Code -historiaa', pending: 'Istuntoa ei ole vielä löytynyt', ready: 'Luettavissa' }[S.history]}</dd>` : '';
  return `<dl class="wv-dl"><dt>Pääkeskustelu</dt><dd><a href="#" data-wv="ask">${esc(PARENT.title)}</a></dd><dt>Tehtävä</dt><dd>${esc(WORKER.title)} · issue <code>${WORKER.issue}</code></dd>
<dt>Agentti</dt><dd>${h.name} · profiili <code>${h.profile}</code> · <code>${h.model}</code></dd>${hist}<dt>Tila</dt><dd>${esc(st().label)} · alkoi ${WORKER.started}, ${st().elapsed}</dd>
<dt>Haara</dt><dd><code>${WORKER.source}</code> ← <code>${WORKER.branch}</code></dd><dt>Run</dt><dd><code>${WORKER.run}</code></dd></dl>`;
}
function frameHeader() {
  return `<header data-activity="${S.state === 'running' ? 'working' : 'neutral'}" data-control="read-only" class="ah-agent-header"><div class="ah-agent-topline"><div class="ah-title-row" aria-busy="false"><h1 title="${esc(WORKER.title)}">${esc(WORKER.title)}</h1></div>
<a class="_link_4cxqu_214 _surface_10v9u_2 _header_4cxqu_432 ah-header-workspace" href="#">${PARENT.workspace}</a>${stateMark()}
<button type="button" class="${BI} ah-details-toggle" aria-label="Tiedot" aria-expanded="${S.details}" data-wv="details" title="Tiedot">${icon('info')}</button></div></header>`;
}
const detailsPop = () => S.details ? `<div class="wv-details" role="dialog" aria-label="Workerin tiedot">${detailsList()}</div>` : '';

// The band from round 1's Kehys. `right` is what the variant puts at its end.
function band(right) {
  return `<div class="wv-band" data-state="${S.state}"><span class="wv-band-kind">${icon('branch')}Worker</span><a href="#" class="wv-band-parent" data-wv="ask" title="Pääkeskustelu">${icon('back')}<span>${esc(PARENT.title)}</span></a><span class="wv-band-meta"><code>${WORKER.issue}</code><span>${harness().name} · ${harness().profile}</span></span>${right}</div>`;
}
// Keskustelu | Pääte. Conversation is disabled while the history is unreadable;
// `fresh` marks it once it becomes readable while the person reads the terminal.
function tabs(view, { fresh = false, pending = false } = {}) {
  const off = !readable();
  const why = S.history === 'none' ? 'Habitat ei vielä lue Claude Code -historiaa' : 'Historia ei ole vielä luettavissa';
  return `<div class="wv-seg" role="tablist" aria-label="Näkymä"><button role="tab" type="button" aria-selected="${view === 'conv'}" data-wv="view-conv"${off ? ` disabled title="${why}"` : ''}>${pending ? '<span class="wv-seg-wait" aria-hidden="true"></span>' : ''}Keskustelu${fresh ? '<span class="wv-seg-new" aria-label="uusi"></span>' : ''}</button><button role="tab" type="button" aria-selected="${view === 'term'}" data-wv="view-term"${st().live ? '' : ' disabled title="Workerin pääte on suljettu"'}>Pääte</button></div>`;
}

// ---------------------------------------------------------- the notice ---
// What the person can do instead of writing: ask through the parent. Only a
// live Pi worker can receive a message (taskfleet run message is Pi-only), so
// the sentence depends on the harness and on whether the worker still runs.
function askCopy() {
  if (!st().live) return { lead: 'Worker on päättynyt.', body: 'Pääagentti on saanut sen raportin. Kysy jatkosta pääkeskustelussa.', short: 'Pääagentti on saanut raportin', cta: 'Pääkeskusteluun' };
  if (S.harness === 'pi') return { lead: 'Workerille ei kirjoiteta suoraan.', body: 'Pääagentti voi lähettää sille viestin. Kysy pääkeskustelussa, niin pääagentti välittää kysymyksen.', short: 'Pääagentti välittää viestin', cta: 'Kysy pääkeskustelussa' };
  return { lead: 'Workerille ei kirjoiteta suoraan.', body: 'Claude Code -workerille ei voi lähettää viestiä kesken työn, mutta pääagentti näkee sen tilan. Kysy pääkeskustelussa.', short: 'Pääagentti näkee tilan', cta: 'Kysy pääkeskustelussa' };
}
// Variant 1's notice: a fixed bar in the composer's place.
function askBar() {
  const c = askCopy();
  return `<div class="wv-ask" role="note">${icon(st().live ? 'ask' : 'info', 'wv-ask-ic')}<p><strong>${c.lead}</strong> ${c.body}</p><button type="button" class="${B2}" data-wv="ask">${esc(c.cta)} ${icon('forward')}</button></div>`;
}

// ------------------------------------------------------------- variants ---
// 1 Välilehti: the terminal is the Pääte tab and Keskustelu waits disabled.
// When the history becomes readable, the tab and a line above the terminal
// say so; the view changes only when the person chooses.
function tab() {
  // A worker opened with readable history opens in the conversation; one whose
  // history arrives while the person reads the terminal stays there.
  const view = !readable() ? 'term' : !st().live ? 'conv' : S.view === 'auto' ? (S.arrived ? 'term' : 'conv') : S.view;
  const fresh = S.arrived && view === 'term' && S.view === 'auto';
  let body;
  if (view === 'term') {
    const line = S.harness === 'pi' ? '' : fresh
      ? `<div class="wv-histline" data-tone="ready">${icon('history')}<span><strong>Keskustelu on nyt luettavissa.</strong> Pääte jatkuu omalla välilehdellään.</span><button type="button" class="${B2}" data-wv="view-conv">Näytä keskustelu</button></div>`
      : S.history === 'none'
        ? `<div class="wv-histline">${icon('terminal')}<span>Tästä workerista näkyy vain pääte: Habitat ei vielä lue Claude Code -keskusteluja.</span></div>`
        : S.history === 'pending'
          ? `<div class="wv-histline"><span class="wv-wait" aria-hidden="true"></span><span>Keskustelu tulee luettavaksi, kun Claude Code -istunto löytyy. Siihen asti näet päätteen.</span></div>` : '';
    body = `${st().live ? line : ''}${termBody()}`;
  } else {
    body = `<section class="ah-conversation-stream" aria-label="Workerin keskustelu">${feed(briefMessage() + workerTurns())}${resultCard()}</section>`;
  }
  return app(`<section class="ah-conversation-frame ah-reading-view wv-framed">${band(tabs(view, { fresh, pending: S.harness === 'claude' && S.history === 'pending' }))}${frameHeader()}${detailsPop()}${body}${askBar()}</section>`);
}

// 2 Vaihtuu itse: the same terminal, but when the history becomes readable the
// view switches to the conversation and says why, with a way back. The
// composer's place holds a question box that drafts into the parent.
function auto() {
  if (S.parent) return parentWithDraft();
  const view = !readable() ? 'term' : !st().live ? 'conv' : S.view === 'auto' ? 'conv' : S.view;
  let body;
  if (view === 'term') {
    const line = S.harness === 'pi' ? '' : S.history === 'none'
      ? `<div class="wv-histline">${icon('terminal')}<span>Vain pääte: Habitat ei vielä lue Claude Code -keskusteluja.</span></div>`
      : S.history === 'pending'
        ? `<div class="wv-histline"><span class="wv-wait" aria-hidden="true"></span><span>Näkymä vaihtuu keskusteluun itse, kun Claude Code -istunto löytyy.</span></div>` : '';
    body = `${st().live ? line : ''}${termBody()}`;
  } else {
    const switched = S.arrived && S.view === 'auto'
      ? `<div class="wv-switched" role="status">${icon('history')}<span>Näkymä vaihtui keskusteluun, koska workerin historia tuli luettavaksi.</span><button type="button" class="${BQ}" data-wv="view-term">Takaisin päätteeseen</button></div>` : '';
    body = `${switched}<section class="ah-conversation-stream" aria-label="Workerin keskustelu">${feed(briefMessage() + workerTurns())}${resultCard()}</section>`;
  }
  return app(`<section class="ah-conversation-frame ah-reading-view wv-framed">${band(tabs(view, { pending: S.harness === 'claude' && S.history === 'pending' }))}${frameHeader()}${detailsPop()}${body}${askBox()}</section>`);
}
function askBox() {
  const c = askCopy();
  const ph = st().live ? 'Kysy workerista pääagentilta…' : 'Kysy jatkosta pääagentilta…';
  return `<section class="wv-askbox" aria-label="Kysy pääagentin kautta"><div class="wv-askbox-field"><span class="wv-askbox-to">${icon('back')}Pääagentille</span><textarea rows="1" placeholder="${ph}" data-wv-draft aria-label="Kysymys pääagentille">${esc(S.draft)}</textarea><button type="button" class="${B2}" data-wv="ask-draft">Pääkeskusteluun ${icon('forward')}</button></div><p class="wv-askbox-why"><strong>${c.lead}</strong> ${c.body.replace(' Kysy pääkeskustelussa, niin pääagentti välittää kysymyksen.', ' Kysymys aukeaa pääkeskusteluun luonnoksena; sinä lähetät sen.').replace(' Kysy pääkeskustelussa.', ' Kysymys aukeaa pääkeskusteluun luonnoksena.').replace(' Kysy jatkosta pääkeskustelussa.', ' Kysymys aukeaa pääkeskusteluun luonnoksena.')}</p></section>`;
}
// Where "Pääkeskusteluun" leads in variant 2: the parent with the question drafted.
function parentWithDraft() {
  const ask = S.draft.trim() || 'Miten testit etenevät?';
  const draft = `Workerista »${WORKER.title}«: ${ask}`;
  const composer = COMPOSER.replace(' disabled title="Prototyyppi: ei lähetä"', ' title="Prototyyppi: ei lähetä"').replace(/(<textarea[^>]*)rows="1"([^>]*>)<\/textarea>/, `$1rows="2"$2${esc(draft)}</textarea>`).replace('ah-composer-empty', '');
  const crumb = `<div class="wv-crumb wv-back-worker"><a href="#" data-wv="parent-close">${icon('back')}Takaisin workeriin</a><span>${esc(WORKER.title)}</span></div>`;
  return app(parentFrame(crumb, composer));
}

// 3 Pääte keskustelussa: no tabs. The brief is shown as the conversation's
// first message; until the history is readable the terminal sits under it as
// a card, and then the turns fill in and the terminal folds into a row. The
// notice lives in the band as an action, so there is no footer at all.
function inline() {
  const c = askCopy();
  const ask = `<button type="button" class="wv-band-ask" data-wv="ask" title="${esc(c.lead + ' ' + c.body)}">${icon(st().live ? 'ask' : 'info')}<span class="wv-band-ask-long">${S.state === 'landed' || S.state === 'failed' ? 'Päättynyt · kysy jatkosta pääagentilta' : 'Vain luku · kysy pääagentin kautta'}</span><span class="wv-band-ask-short">Kysy</span></button>`;
  if (S.terminal) return app(`<section class="ah-conversation-frame ah-reading-view wv-framed">${band(ask)}${frameHeader()}${detailsPop()}${terminalDock({ max: true })}</section>`);
  let items = briefMessage();
  if (readable()) {
    items += workerTurns() + (!st().live ? '' : `<li class="wv-termrow-li"><button type="button" class="wv-termrow" data-wv="terminal">${icon('terminal')}<span>Pääte · vain luku</span><span class="wv-termrow-tail">${S.state === 'waiting' ? 'odottaa syötettä' : S.state === 'running' ? 'npm test -- clock' : 'päättynyt'}</span>${icon('expand')}</button></li>`);
  } else if (!st().live) {
    items += `<li class="wv-termcard-li">${closedTerminal()}</li>`;
  } else {
    const why = S.history === 'none' ? 'Habitat ei vielä lue Claude Code -keskusteluja, joten workerin työ näkyy päätteenä.' : 'Workerin vastaukset ja työkalut korvaavat päätteen tässä, kun Claude Code -istunto löytyy.';
    items += `<li class="wv-termcard-li"><section class="wv-termcard" aria-label="Workerin pääte"><header>${icon('terminal')}<strong>Pääte</strong><span class="ah-terminal-ro">vain luku</span><span class="wv-termcard-grow"></span><button type="button" class="${BI}" aria-label="Avaa pääte koko näkymään" data-wv="terminal">${icon('expand')}</button></header><div class="wv-termcard-body">${termPre()}</div><p class="wv-termcard-why">${S.history === 'pending' ? '<span class="wv-wait" aria-hidden="true"></span>' : ''}${why}</p></section></li>`;
  }
  const merged = S.arrived ? `<li class="wv-filled-li"><p class="wv-filled" role="status">${icon('history')}Historia tuli luettavaksi: pääte on nyt keskustelun lopussa.</p></li>` : '';
  return app(`<section class="ah-conversation-frame ah-reading-view wv-framed">${band(ask)}${frameHeader()}${detailsPop()}<section class="ah-conversation-stream" aria-label="Workerin keskustelu">${feed(items + merged)}${readable() ? resultCard() : ''}</section></section>`);
}

// ------------------------------------------------------------ the parent ---
function parentFrame(top, composer) {
  const h = HARNESS.pi;
  const header = `<header data-activity="neutral" class="ah-agent-header"><div class="ah-agent-topline"><div class="ah-title-row"><h1 title="${esc(PARENT.title)}">${esc(PARENT.title)}</h1></div><a class="_link_4cxqu_214 _surface_10v9u_2 _header_4cxqu_432 ah-header-workspace" href="#">${PARENT.workspace}</a>${statusMark('neutral', 'info', 'Valmis')}<button type="button" class="${BTN} _secondary_4cxqu_47 _sizeInline_4cxqu_32 _pill_4cxqu_69 ah-button ah-button-secondary ah-set-chip"><span class="ah-set-model">${h.model}</span><span class="ah-set-separator" aria-hidden="true"> · </span><span>Agentti</span></button></div></header>`;
  const user = `<li data-kind="user"><article data-testid="message" class="ah-message"><header><strong>Sinä</strong>${copyBtn('Sinä')}</header><div class="ah-prose"><div class="ah-user-content"><div class="ah-ordered-blocks"><div><span class="ah-user-text">Kesäajan vaihtuessa kellonäkymä näyttää tunnin väärin. Korjaa, ja anna testit workerille.</span></div></div></div></div></article></li>`;
  const pReply = (html) => `<div data-reply-kind="final" data-reply-role="final" class="ah-turn-reply"><article data-testid="message" data-reply-complete="true" class="ah-message ah-message-reply"><header><strong>${icon('check')}Vastaus valmis</strong>${copyBtn('Vastaus')}</header>${prose(html)}</article></div>`;
  const spawn = turn(pReply(`<p>Käynnistin workerin <strong>${esc(WORKER.title)}</strong> testeille ja korjaan sillä aikaa <code>format.ts</code>:n itse.</p>`));
  return `<section class="ah-conversation-frame ah-reading-view wv-parent">${header}${top}<section class="ah-conversation-stream"><section class="ah-timeline"><ol class="ah-feed">${user}${spawn}</ol></section></section>${stripHtml()}${composer}</section>`;
}
function stripHtml() {
  return `<section class="ah-bg-strip" aria-label="Taustatyö"><div class="ah-bg-wrap"><div class="ah-bg-badges" role="group" aria-label="Taustatyö"><button data-kind="spin" type="button" class="${BTN} _secondary_4cxqu_47 _sizeInline_4cxqu_32 _pill_4cxqu_69 ah-button ah-button-secondary ah-bg-badge${st().live ? '' : ' idle'}" aria-label="Workerit" data-wv="parent-close">${icon('branch', 'ah-bg-kind-ic')}<span class="ah-bg-n">${st().live ? 1 : 0}</span></button></div></div></section>`;
}

// ----------------------------------------------------------- app shell ---
// Workers are not listed in the rail (Jari, 2026-10-26). The parent row keeps
// production's spinoff mark while its worker runs and stays current, because
// the worker view belongs to it.
const SPIN_MARK = '<svg class="ah-nav-spinoff" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="6" r="2"/><path d="M7 8v10"/><g class="ah-nav-spinoff-branch"><path d="M7 12c0 3 3 4 7 4"/><circle cx="17" cy="16" r="2"/></g></svg>';
function app(frame) {
  let shell = SHELL.replace('<!--FRAME-->', frame);
  const parentRow = `<li class="ah-agent-item${st().live ? ' ah-waiting-spinoff' : ''}" style="--ah-depth: 0;"><div class="ah-list-row ah-sidebar-agent-row"><div class="ah-list-row-content"><a class="_link_4cxqu_214 _surface_10v9u_2 _agent_4cxqu_229 ah-nav-link" href="#" data-wv="ask" aria-current="page"><span class="ah-nav-label">${esc(PARENT.title)}</span></a></div>${st().live ? `<div class="ah-list-row-trailing">${SPIN_MARK}</div>` : ''}</div></li>`;
  return shell.replace(/(<section class="ah-workspace">[\s\S]*?<ul>)/, `$1${parentRow}`);
}

// -------------------------------------------------------------- wiring ---
const stage = document.getElementById('stage');
const variants = [tab, auto, inline];
let keepScroll = false;
new MutationObserver(() => {
  for (const t of stage.querySelectorAll('.ah-terminal-surface, .wv-termcard-body')) t.scrollTop = t.scrollHeight;
  if (!keepScroll) for (const s of stage.querySelectorAll('.ah-conversation-stream')) s.scrollTop = s.scrollHeight;
  keepScroll = false;
}).observe(stage, { childList: true });
function rerender(keep = true) {
  const scroll = stage.querySelector('.ah-conversation-stream')?.scrollTop;
  keepScroll = keep;
  stage.innerHTML = variants[current]();
  const s = stage.querySelector('.ah-conversation-stream');
  if (keep && s && scroll != null) s.scrollTop = scroll;
}
stage.addEventListener('input', (e) => { if (e.target.matches('[data-wv-draft]')) S.draft = e.target.value; });
stage.addEventListener('click', (e) => {
  const t = e.target.closest('[data-wv], [data-wv-toggle]');
  if (!t || t.disabled) return;
  e.preventDefault();
  const id = t.dataset.wvToggle;
  if (id) S.stages[id] = !(S.stages[id] ?? t.dataset.wvDefault === 'true');
  const a = t.dataset.wv;
  let keep = true;
  if (a === 'view-conv') { S.view = 'conv'; keep = false; }
  if (a === 'view-term') { S.view = 'term'; keep = false; }
  if (a === 'terminal') S.terminal = !S.terminal;
  if (a === 'terminal-off') S.terminal = false;
  if (a === 'details') S.details = !S.details;
  if (a === 'ask') toast(`Avaisi pääkeskustelun ”${PARENT.title}”.`);
  if (a === 'ask-draft') { S.parent = true; keep = false; }
  if (a === 'parent-close') { S.parent = false; keep = false; }
  rerender(keep);
});
function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 2200);
}
// The history arriving while the person watches: what each variant does then.
function arrive() {
  if (S.harness !== 'claude' || S.history === 'ready') return;
  S.history = 'ready';
  S.arrived = true; // variant 1 waits for the person; 2 and 3 change by themselves
  S.view = 'auto';
  document.getElementById('wv-history').value = 'ready';
  syncLab();
  rerender(false);
}
function syncLab() {
  const claude = S.harness === 'claude';
  document.getElementById('wv-history').disabled = !claude;
  document.getElementById('wv-arrive').disabled = !claude || S.history === 'ready';
}
const reset = () => { S.stages = {}; S.view = 'auto'; S.arrived = false; S.terminal = false; S.parent = false; syncLab(); mount(current); };
const pick = (id, key) => document.getElementById(id).addEventListener('change', (e) => { S[key] = e.target.value; reset(); });
pick('wv-state', 'state');
pick('wv-harness', 'harness');
pick('wv-history', 'history');
document.getElementById('wv-arrive').addEventListener('click', arrive);
document.getElementById('wv-theme').addEventListener('click', (e) => {
  const dark = document.documentElement.getAttribute('data-theme') !== 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  e.target.textContent = dark ? 'Vaalea' : 'Tumma';
});
const q = new URLSearchParams(location.search);
if (STATES[q.get('state')]) S.state = document.getElementById('wv-state').value = q.get('state');
if (HARNESS[q.get('harness')]) S.harness = document.getElementById('wv-harness').value = q.get('harness');
if (HISTORY[q.get('history')]) S.history = document.getElementById('wv-history').value = q.get('history');
if (q.get('arrived') === '1' && S.harness === 'claude') { S.history = document.getElementById('wv-history').value = 'ready'; S.arrived = true; }
if (q.get('theme') === 'dark') document.getElementById('wv-theme').click();
syncLab();
