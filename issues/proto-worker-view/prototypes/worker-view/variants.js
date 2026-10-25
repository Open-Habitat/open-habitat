// Worker view round 1. Markup copies the production conversation's DOM (see
// captured/*.html, dumped from the synthetic lab), so the production CSS in
// captured/production.css styles it. Only the worker identity, the result
// card, the side panel and the inline card are new and live in round.css.
// Synthetic content only; nothing here talks to a host.

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
  external: '<path d="M13 5h6v6M19 5l-9 9"/><path d="M19 14v5H5V5h5"/>',
  expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
  agent: '<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M9 13h.01M15 13h.01"/>',
};
const icon = (n, cls) => SVG(ICON[n], cls);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const md = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

// ---------------------------------------------------------------- facts ---
// What the round assumes the host knows about one worker. Each field names
// where it would come from; NOTES.md says which exist today.
const PARENT = { title: 'Kellonäkymän kesäaika', workspace: 'aurinkokello' };
const WORKER = {
  title: 'Aikavyöhyketestit kellonäkymälle', // taskfleet run: title
  issue: 'kello-dst', // not a Taskfleet field: parsed from the brief or a run label
  run: '01m5wkr7c2v9tq4h8zx3n6dpae', // run_id
  branch: 'wt/kello-dst', // branch / preserved_work[].branch
  worktree: '~/src/aurinkokello__worktrees/wt-kello-dst',
  source: 'main', // source_branch
  started: '14:02',
};
const HARNESS = {
  pi: { name: 'Pi', profile: 'toteutus', model: 'openai-codex/gpt-5-codex' },
  claude: { name: 'Claude Code', profile: 'toteutus-claude', model: 'claude-sonnet-5' },
};
const STATES = {
  running: { label: 'Työskentelee', short: 'Työskentelee', tone: 'info', kind: 'working', elapsed: '6 min' },
  waiting: { label: 'Odottaa päätteessä', short: 'Odottaa', tone: 'warning', kind: 'neutral', elapsed: '9 min' },
  landed: { label: 'Valmis · laskeutui', short: 'Laskeutui', tone: 'success', kind: 'success', elapsed: '11 min' },
  failed: { label: 'Ei mergetty · työ tallessa', short: 'Epäonnistui', tone: 'danger', kind: 'error', elapsed: '14 min' },
};
const S = { state: 'running', harness: 'pi', terminal: false, details: false, panel: true, inline: true, full: false, view: 'conv', stages: {} };

// ---------------------------------------------------- production pieces ---
const BTN = '_button_4cxqu_5 _surface_10v9u_2';
const statusMark = (kind, tone, label, extra = '') => {
  const glyph = kind === 'success' ? icon('check') : kind === 'error' ? icon('cross')
    : `<span aria-hidden="true" class="ah-status-dot${kind === 'working' ? ' ah-running' : ''}"></span>`;
  return `<span data-kind="${kind}" data-testid="status-mark" class="ah-status ah-tone-${tone} ah-status-${kind}${extra}">${glyph}${esc(label)}</span>`;
};
const copyBtn = (label) => `<button data-ah-primitive="button" data-ah-size="row" class="${BTN} _quiet_4cxqu_53 _sizeRow_4cxqu_25 _messageIcon_4cxqu_207 ah-button ah-button-quiet " type="button" aria-label="Kopioi viesti: ${esc(label)}">${icon('copy')}</button>`;
const prose = (html) => `<div class="ah-prose"><div class="ah-ordered-blocks"><div><div class="ah-markdown">${html}</div></div></div></div>`;

function briefMessage(label) {
  return `<li data-kind="user"><article data-testid="message" class="ah-message wv-brief"><header><strong>${esc(label)}</strong>${copyBtn(label)}</header>
<div class="ah-prose"><div class="ah-user-content"><div class="ah-ordered-blocks"><div><span class="ah-user-text">Lisää kellonäkymälle testit kesäajan vaihtumiselle (issue kello-dst). Älä muuta src/clock/format.ts:n julkista rajapintaa. Kun testit menevät läpi, mergeä taskfleet run merge -komennolla.</span></div></div></div></div></article></li>`;
}
function reply(role, html, who) {
  const interim = role === 'interim';
  const label = interim ? (who ? `${who} · välivastaus` : 'Välivastaus') : (who ? `${who} · vastaus` : 'Vastaus valmis');
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

/** The worker's own native history, as the conversation components would show it. */
function workerTimeline(who) {
  tool.n = 0;
  const st = S.state;
  const items = [briefMessage('Pääagentti · tehtävä')];
  items.push(turn(
    reply('interim', '<p>Luen ensin nykyiset testit ja kellon muotoilun.</p>', who) +
    stageBlock('s1', 'Ajattelu · 3 työkalua', '48 s',
      think('Kesäaikaa ei testata lainkaan; `formatClock` lukee vyöhykkeen `Intl`-oliolta.') +
      tool('read', 'src/clock/format.ts', '84 riviä', 'succeeded') +
      tool('read', 'tests/clock.test.ts', '120 riviä', 'succeeded') +
      tool('bash', 'npm test -- clock', '', 'succeeded', TEST_OK.replace(/15/g, '12').replace(/\n {3}✓ kesäaika[^\n]*/g, ''))) +
    reply('interim', '<p>Kesäajan vaihde puuttuu testeistä. Lisään kolme tapausta: kevään siirto, syksyn toistuva tunti ja <code>--tz</code>-ohitus.</p>', who)));
  const edit = tool('edit', 'tests/clock.test.ts', '+48 −0', 'succeeded');
  if (st === 'running') {
    items.push(turn(`<div class="ah-turn-work">${edit}${tool('bash', 'npm test -- clock', '', 'running')}</div>` + working('Ajaa testejä · npm test -- clock', '0:42')));
  } else if (st === 'waiting') {
    items.push(turn(stageBlock('s2', '2 työkalua', '1 min 10 s', edit + tool('bash', 'npm test -- clock', '', 'succeeded', TEST_OK)) +
      reply('interim', '<p>Testit menevät läpi. Haen vielä mainin muutokset ennen mergeä.</p>', who) +
      `<div class="ah-turn-work">${tool('bash', 'git fetch origin', '', 'waiting')}</div>` + waitingStrip()));
  } else if (st === 'landed') {
    items.push(turn(stageBlock('s2', '3 työkalua', '1 min 40 s', edit + tool('bash', 'npm test -- clock', '', 'succeeded', TEST_OK) +
      tool('bash', 'taskfleet run merge', '', 'succeeded', 'rebased wt/kello-dst onto main\nmerged 3f9c2ab into main\nreport submitted (via: explicit-merge)')) +
      reply('final', '<p>Valmis. Lisäsin kolme kesäaikatestiä tiedostoon <code>tests/clock.test.ts</code>; kaikki 15 testiä menevät läpi. <code>format.ts</code> ei muuttunut. Työ laskeutui mainiin commitina <code>3f9c2ab</code>.</p>', who)));
  } else {
    items.push(turn(stageBlock('s2', '3 työkalua · 1 epäonnistui', '3 min 05 s', edit + tool('bash', 'npm test -- clock', '', 'failed', TEST_FAIL) +
      think('Korjaus vaatisi `formatClock`-funktiolle uuden parametrin, ja tehtävä kieltää sen.') +
      tool('bash', 'npm test -- clock', '', 'failed', TEST_FAIL), { defaultOpen: true, failures: 2 }) +
      reply('final', '<p>En saanut syksyn toistuvaa tuntia läpi muuttamatta <code>format.ts</code>:n julkista rajapintaa, jota tehtävä kielsi. Testit ovat haarassa <code>wt/kello-dst</code>; en mergennyt. Pääagentin pitää päättää, saako rajapinta muuttua.</p>', who)));
  }
  return items.join('');
}
// A worker stuck at a native prompt: the conversation shows the pending tool;
// the prompt itself only exists in the terminal, so the row points there.
function waitingStrip() {
  return `<div class="wv-prompt" role="status"><span class="wv-prompt-head">${icon('warning')}<strong>Worker odottaa vastausta päätteessä</strong></span>
<pre>${esc(SSH_PROMPT)}</pre>
<span class="wv-prompt-actions"><button type="button" class="${BTN} _secondary_4cxqu_47 _sizeInline_4cxqu_32 ah-button ah-button-secondary wv-btn" data-wv="terminal-on">${icon('terminal')}Näytä pääte</button><button type="button" class="${BTN} _quiet_4cxqu_53 _sizeInline_4cxqu_32 ah-button ah-button-quiet wv-btn" data-wv="parent">Pyydä pääagenttia ratkaisemaan →</button></span>
<small>Selain ei kirjoita workerin päätteeseen. Pääagentti voi vastata (<code>taskfleet run message</code>) tai sinä päätteestä.</small></div>`;
}
const timelineFor = (who) => S.harness === 'claude' ? unavailable() :
  `<section data-testid="conversation-timeline" aria-label="Workerin keskusteluhistoria" class="ah-timeline"><ol class="ah-feed">${workerTimeline(who)}</ol></section>`;
// Claude workers today: Taskfleet reports no session file (support: unsupported).
function unavailable() {
  return `<div class="wv-unavailable"><p><strong>Tämän workerin keskustelua ei voi vielä näyttää.</strong></p><p>Taskfleet ei kerro Claude Code -workerin istuntotiedostoa, joten näkymä näyttää päätteen.</p></div>`;
}

// ------------------------------------------------------------- terminal ---
function terminalLines() {
  const base = [
    S.harness === 'claude' ? '╭─ Claude Code · claude-sonnet-5 ────────────────────────╮' : '╭─ pi · toteutus · openai-codex/gpt-5-codex ─────────────╮',
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
function terminalDock(max) {
  return `<div class="ah-terminal-dock wv-terminal"${max ? ' data-max=""' : ''}><div class="ah-terminal-bar"><span class="ah-terminal-ws">${esc(WORKER.worktree.split('/').pop())}</span><div class="ah-terminal-tabs" role="tablist"><span class="ah-terminal-tab" data-active=""><button role="tab" aria-selected="true" type="button"><span class="ah-terminal-mark">${icon('agent')}</span>worker · ${esc(HARNESS[S.harness].name)} <span class="ah-terminal-ro">vain luku</span></button></span></div>
<span class="ah-terminal-tools"><button type="button" class="${BTN} _quiet_4cxqu_53 _sizeRow_4cxqu_25 _icon_4cxqu_121 ah-button ah-button-quiet" aria-label="Sulje pääte" data-wv="terminal-off">${icon('cross')}</button></span></div>
${S.harness === 'claude' ? '<p class="wv-term-why">Keskustelua ei voi vielä näyttää: Taskfleet ei kerro Claude Code -workerin istuntotiedostoa.</p>' : ''}<div class="ah-terminal-host"><div class="ah-terminal-surface" data-fixed=""><pre class="wv-term">${esc(terminalLines())}</pre></div></div></div>`;
}

// ------------------------------------------------------ worker identity ---
const st = () => STATES[S.state];
const harness = () => HARNESS[S.harness];
const stateMark = () => statusMark(st().kind, st().tone, st().label, ' wv-state');
function detailsList() {
  const h = harness();
  const preserved = S.state === 'failed' ? `<dt>Työ tallessa</dt><dd><code>${WORKER.branch}</code> · <code>${WORKER.worktree}</code></dd>` : '';
  const landed = S.state === 'landed' ? `<dt>Laskeutui</dt><dd><code>main</code> · <code>3f9c2ab</code></dd>` : '';
  return `<dl class="wv-dl"><dt>Pääkeskustelu</dt><dd><a href="#" data-wv="parent">${esc(PARENT.title)}</a></dd><dt>Tehtävä</dt><dd>${esc(WORKER.title)} · issue <code>${WORKER.issue}</code></dd>
<dt>Agentti</dt><dd>${h.name} · profiili <code>${h.profile}</code> · <code>${h.model}</code></dd><dt>Tila</dt><dd>${esc(st().label)} · alkoi ${WORKER.started}, ${st().elapsed}</dd>${landed}${preserved}
<dt>Haara</dt><dd><code>${WORKER.source}</code> ← <code>${WORKER.branch}</code></dd><dt>Run</dt><dd><code>${WORKER.run}</code></dd></dl>`;
}
function resultCard() {
  if (S.state === 'landed') return `<aside class="wv-result" data-tone="ok"><header>${icon('merge')}<strong>Laskeutui mainiin</strong><span>commit <code>3f9c2ab</code> · 11 min</span></header><p>Kolme kesäaikatestiä lisätty; 15/15 testiä läpi. Worktree ja haara on poistettu.</p></aside>`;
  if (S.state === 'failed') return `<aside class="wv-result" data-tone="err"><header>${icon('warning')}<strong>Ei mergetty · työ tallessa</strong><span><code>${WORKER.branch}</code></span></header><p>Syksyn toistuva tunti vaatisi rajapintamuutoksen. Pääagentti päättää jatkosta: <code>taskfleet run show</code>, <code>taskfleet run salvage</code>.</p></aside>`;
  return '';
}
function frameHeader({ chips = true, terminal = true, extraClass = '' } = {}) {
  const h = harness();
  return `<header data-activity="${S.state === 'running' ? 'working' : 'neutral'}" data-control="read-only" class="ah-agent-header ${extraClass}"><div class="ah-agent-topline"><div class="ah-title-row" aria-busy="false"><h1 title="${esc(WORKER.title)}">${esc(WORKER.title)}</h1></div>
<a class="_link_4cxqu_214 _surface_10v9u_2 _header_4cxqu_432 ah-header-workspace" href="#">${PARENT.workspace}</a>${stateMark()}${chips ? `<span data-kind="read-only" class="ah-status ah-tone-neutral ah-status-read-only wv-worker-mark"><span aria-hidden="true" class="ah-status-dot"></span>Worker</span>
<button type="button" class="${BTN} _secondary_4cxqu_47 _sizeInline_4cxqu_32 _pill_4cxqu_69 ah-button ah-button-secondary ah-set-chip wv-profile-chip" title="Profiili ja malli"><span class="ah-set-model">${h.profile}</span><span class="ah-set-separator" aria-hidden="true"> · </span><span>${h.model.split('/').pop()}</span></button>` : ''}
${terminal ? `<button type="button" class="${BTN} _quiet_4cxqu_53 _sizeRow_4cxqu_25 _icon_4cxqu_121 ah-button ah-button-quiet ah-topbar-icon ah-terminal-toggle" aria-label="Pääte" aria-pressed="${S.terminal}" data-wv="terminal" title="Workerin pääte (vain luku)">${icon('terminal')}</button>` : ''}
<button type="button" class="${BTN} _quiet_4cxqu_53 _sizeRow_4cxqu_25 _icon_4cxqu_121 ah-button ah-button-quiet ah-details-toggle ah-topbar-icon" aria-label="Tiedot" aria-expanded="${S.details}" data-wv="details" title="Tiedot">${icon('info')}</button></div></header>`;
}
const detailsPop = () => S.details ? `<div class="wv-details" role="dialog" aria-label="Workerin tiedot">${detailsList()}</div>` : '';
const showTerminal = () => S.terminal || S.harness === 'claude';

// ------------------------------------------------------------- variants ---
// 1 Hiljainen: in place of the parent, today's read-only conversation frame
// with a "Worker" mark; the read-only footer names the parent.
function quiet() {
  const stream = `<section class="ah-conversation-stream" aria-label="Workerin keskustelu">${timelineFor('')}${resultCard()}</section>`;
  const footer = `<div class="ah-read-only-footer wv-ro"><div><strong>Worker · vain luku</strong><p>Tätä workeria ohjaa keskustelu <a href="#" data-wv="parent">${esc(PARENT.title)}</a>.</p></div><a href="#" class="_link_4cxqu_214 _surface_10v9u_2 _inline_4cxqu_426 " data-wv="parent">Pääkeskusteluun</a></div>`;
  return app(`<section class="ah-conversation-frame ah-reading-view wv-quiet">${frameHeader()}${detailsPop()}${S.harness === 'claude' && !S.terminal ? '' : stream}${footer}${showTerminal() ? terminalDock(S.harness === 'claude') : ''}</section>`, { nest: false });
}

// 2 Kehys: in place, with a persistent worker band above the header, the
// worker's replies labelled, a result card, and conversation/terminal tabs.
function framed() {
  const tabs = `<div class="wv-seg" role="tablist" aria-label="Näkymä"><button role="tab" type="button" aria-selected="${S.view === 'conv'}" data-wv="view-conv"${S.harness === 'claude' ? ' disabled' : ''}>Keskustelu</button><button role="tab" type="button" aria-selected="${S.view === 'term' || S.harness === 'claude'}" data-wv="view-term">Pääte</button></div>`;
  const band = `<div class="wv-band" data-state="${S.state}"><span class="wv-band-kind">${icon('branch')}Worker</span><a href="#" class="wv-band-parent" data-wv="parent">${icon('back')}<span>${esc(PARENT.title)}</span></a><span class="wv-band-meta"><code>${WORKER.issue}</code><span>${harness().name} · ${harness().profile}</span></span>${tabs}</div>`;
  const term = S.view === 'term' || S.harness === 'claude';
  const stream = `<section class="ah-conversation-stream" aria-label="Workerin keskustelu">${timelineFor('Worker')}${resultCard()}</section>`;
  const footer = `<div class="wv-foot">Workerille ei kirjoiteta. <a href="#" data-wv="parent">Kirjoita pääkeskusteluun →</a></div>`;
  return app(`<section class="ah-conversation-frame ah-reading-view wv-framed">${band}${frameHeader({ chips: false, terminal: false })}${detailsPop()}${term ? terminalDock(true) : stream + footer}</section>`, { nest: true });
}

// 3 Sivupaneeli: the parent conversation keeps its place and composer; the
// worker opens beside it (a full-screen sheet on a phone).
function side() {
  const panel = S.panel ? `<aside class="wv-side" aria-label="Worker: ${esc(WORKER.title)}"><header class="wv-side-head"><button type="button" class="${BTN} _quiet_4cxqu_53 _sizeRow_4cxqu_25 _icon_4cxqu_121 ah-button ah-button-quiet wv-side-back" aria-label="Takaisin pääkeskusteluun" data-wv="panel-close">${icon('back')}</button>
<div class="wv-side-title"><small>${icon('branch')}Worker · ${harness().name}</small><strong title="${esc(WORKER.title)}">${esc(WORKER.title)}</strong></div>${stateMark()}
<button type="button" class="${BTN} _quiet_4cxqu_53 _sizeRow_4cxqu_25 _icon_4cxqu_121 ah-button ah-button-quiet ah-topbar-icon" aria-label="Pääte" aria-pressed="${S.terminal}" data-wv="terminal">${icon('terminal')}</button>
<button type="button" class="${BTN} _quiet_4cxqu_53 _sizeRow_4cxqu_25 _icon_4cxqu_121 ah-button ah-button-quiet ah-topbar-icon" aria-label="Tiedot" aria-expanded="${S.details}" data-wv="details">${icon('info')}</button>
<button type="button" class="${BTN} _quiet_4cxqu_53 _sizeRow_4cxqu_25 _icon_4cxqu_121 ah-button ah-button-quiet ah-topbar-icon wv-side-x" aria-label="Sulje worker" data-wv="panel-close">${icon('cross')}</button></header>
${detailsPop()}${S.harness === 'claude' && !S.terminal ? '' : `<section class="ah-conversation-stream wv-side-stream">${timelineFor('')}${resultCard()}</section>`}${showTerminal() ? terminalDock(S.harness === 'claude') : ''}
<footer class="wv-side-foot">Vain luku · ohjaa vasemmalla olevassa keskustelussa</footer></aside>` : '';
  return app(`<div class="wv-split${S.panel ? ' wv-split-open' : ''}">${parentFrame(parentTimeline(false))}${panel}</div>`, { nest: false });
}

// 4 Keskustelun sisällä: the worker is a card in the parent's timeline where
// it was started; it shows the worker's latest steps and opens fully in place.
function inline() {
  if (S.full) {
    const back = `<div class="wv-crumb"><a href="#" data-wv="full-close">${icon('back')}${esc(PARENT.title)}</a><span>/ worker</span></div>`;
    const footer = `<div class="ah-read-only-footer wv-ro"><div><strong>Worker · vain luku</strong><p>Tätä workeria ohjaa keskustelu <a href="#" data-wv="full-close">${esc(PARENT.title)}</a>.</p></div><a href="#" class="_link_4cxqu_214 _surface_10v9u_2 _inline_4cxqu_426 " data-wv="full-close">Pääkeskusteluun</a></div>`;
    return app(`<section class="ah-conversation-frame ah-reading-view">${back}${frameHeader()}${detailsPop()}${S.harness === 'claude' && !S.terminal ? '' : `<section class="ah-conversation-stream">${timelineFor('')}${resultCard()}</section>`}${footer}${showTerminal() ? terminalDock(S.harness === 'claude') : ''}</section>`, { nest: false });
  }
  return app(parentFrame(parentTimeline(true)), { nest: false });
}
function workerCard() {
  const s = st();
  const tail = S.harness === 'claude' ? `<p class="wv-card-none">Keskustelua ei voi näyttää (Claude Code). <a href="#" data-wv="full-open">Avaa pääte</a></p>` : {
    running: `<ol class="wv-card-tail"><li>${icon('check')}edit <code>tests/clock.test.ts</code> +48 −0</li><li data-live>${statusMark('working', 'info', '')}bash <code>npm test -- clock</code> · 0:42</li></ol>`,
    waiting: `<ol class="wv-card-tail"><li>${icon('check')}Testit menevät läpi. Haen vielä mainin muutokset ennen mergeä.</li><li data-wait>${icon('warning')}<span>Odottaa päätteessä: <code>Are you sure you want to continue connecting (yes/no)?</code></span></li></ol>`,
    landed: `<p class="wv-card-final">Valmis. Lisäsin kolme kesäaikatestiä; kaikki 15 testiä menevät läpi. Laskeutui mainiin <code>3f9c2ab</code>.</p>`,
    failed: `<p class="wv-card-final">En saanut syksyn toistuvaa tuntia läpi muuttamatta <code>format.ts</code>:n rajapintaa. Työ tallessa haarassa <code>wt/kello-dst</code>.</p>`,
  }[S.state];
  return `<li data-kind="tool"><section class="wv-card" data-state="${S.state}"><button type="button" class="wv-card-head" aria-expanded="${S.inline}" data-wv="inline">${icon('branch', 'wv-card-ic')}<span class="wv-card-name"><small>Worker · ${harness().name}</small><strong>${esc(WORKER.title)}</strong></span>${statusMark(s.kind, s.tone, s.short)}<span class="wv-card-time">${s.elapsed}</span></button>
${S.inline ? `<div class="wv-card-body">${tail}<div class="wv-card-actions"><button type="button" class="${BTN} _secondary_4cxqu_47 _sizeInline_4cxqu_32 ah-button ah-button-secondary wv-btn" data-wv="full-open">Avaa workerin keskustelu ${icon('forward')}</button>${S.state === 'waiting' ? `<button type="button" class="${BTN} _quiet_4cxqu_53 _sizeInline_4cxqu_32 ah-button ah-button-quiet wv-btn" data-wv="full-term">${icon('terminal')}Näytä pääte</button>` : ''}</div></div>` : ''}</section></li>`;
}

// ------------------------------------------------- the parent, for 3 & 4 ---
function parentTimeline(withCard) {
  const user = `<li data-kind="user"><article data-testid="message" class="ah-message"><header><strong>Sinä</strong>${copyBtn('Sinä')}</header><div class="ah-prose"><div class="ah-user-content"><div class="ah-ordered-blocks"><div><span class="ah-user-text">Kesäajan vaihtuessa kellonäkymä näyttää tunnin väärin. Korjaa, ja anna testit workerille.</span></div></div></div></div></article></li>`;
  const spawn = turn(reply('interim', '<p>Korjaan muotoilun itse ja käynnistän workerin testeille.</p>') +
    stageBlock('p1', '1 työkalu', '4 s', tool('bash', 'taskfleet run create --kind spinoff …', '', 'succeeded')));
  const after = turn(reply('final', `<p>Worker <strong>${esc(WORKER.title)}</strong> on käynnissä. Teen sillä aikaa korjauksen <code>format.ts</code>:ään.</p>`));
  return user + spawn + (withCard ? workerCard() : '') + after;
}
function parentFrame(items) {
  const h = HARNESS.pi;
  const header = `<header data-activity="neutral" class="ah-agent-header"><div class="ah-agent-topline"><div class="ah-title-row"><h1 title="${esc(PARENT.title)}">${esc(PARENT.title)}</h1></div><a class="_link_4cxqu_214 _surface_10v9u_2 _header_4cxqu_432 ah-header-workspace" href="#">${PARENT.workspace}</a>${statusMark('neutral', 'info', 'Valmis')}<button type="button" class="${BTN} _secondary_4cxqu_47 _sizeInline_4cxqu_32 _pill_4cxqu_69 ah-button ah-button-secondary ah-set-chip"><span class="ah-set-model">${h.model}</span><span class="ah-set-separator" aria-hidden="true"> · </span><span>Agentti</span></button></div></header>`;
  return `<section class="ah-conversation-frame ah-reading-view wv-parent">${header}<section class="ah-conversation-stream"><section class="ah-timeline"><ol class="ah-feed">${items}</ol></section></section>${stripHtml()}${COMPOSER}</section>`;
}
// Today's background strip pill, which opens the worker in variants 1-3.
function stripHtml() {
  const live = S.state === 'running' || S.state === 'waiting';
  return `<section class="ah-bg-strip" aria-label="Taustatyö"><div class="ah-bg-wrap"><div class="ah-bg-badges" role="group" aria-label="Taustatyö"><button data-kind="spin" type="button" class="${BTN} _secondary_4cxqu_47 _sizeInline_4cxqu_32 _pill_4cxqu_69 ah-button ah-button-secondary ah-bg-badge${live ? '' : ' idle'}" aria-label="Workerit" data-wv="panel-open" aria-expanded="${S.panel}">${icon('branch', 'ah-bg-kind-ic')}<span class="ah-bg-n">${live ? 1 : 0}</span></button></div></div></section>`;
}

// ----------------------------------------------------------- app shell ---
function app(frame, { nest }) {
  let shell = SHELL.replace('<!--FRAME-->', frame);
  // The parent conversation, and in variant 2 the worker nested under it.
  const parentRow = `<li class="ah-agent-item${nest ? '' : ' wv-current'}" style="--ah-depth: 0;"><div class="ah-list-row ah-sidebar-agent-row"><div class="ah-list-row-content"><a class="_link_4cxqu_214 _surface_10v9u_2 _agent_4cxqu_229 ah-nav-link" href="#" data-wv="parent"${nest ? '' : ' aria-current="page"'}><span class="ah-nav-label">${esc(PARENT.title)}</span></a></div></div></li>`;
  const workerRow = nest ? `<li class="ah-agent-item wv-rail-worker" style="--ah-depth: 1;"><div class="ah-list-row ah-sidebar-agent-row"><div class="ah-list-row-content"><a class="_link_4cxqu_214 _surface_10v9u_2 _agent_4cxqu_229 ah-nav-link" href="#" aria-current="page">${icon('branch', 'wv-rail-ic')}<span class="ah-nav-label">${esc(WORKER.title)}</span><span class="wv-rail-state" data-state="${S.state}" title="${esc(st().label)}"></span></a></div></div></li>` : '';
  shell = shell.replace(/(<section class="ah-workspace">[\s\S]*?<ul>)/, `$1${parentRow}${workerRow}`);
  return shell;
}

// -------------------------------------------------------------- wiring ---
const stage = document.getElementById('stage');
const variants = [quiet, framed, side, inline];
// A conversation opens at its latest step and a terminal at its cursor; an
// in-place change (a disclosure) keeps the reader where they were.
let keepScroll = false;
new MutationObserver(() => {
  for (const t of stage.querySelectorAll('.ah-terminal-surface')) t.scrollTop = t.scrollHeight;
  if (!keepScroll) for (const s of stage.querySelectorAll('.ah-conversation-stream')) s.scrollTop = s.scrollHeight;
  keepScroll = false;
}).observe(stage, { childList: true });
function rerender() {
  const scroll = stage.querySelector('.ah-conversation-stream')?.scrollTop;
  keepScroll = true;
  stage.innerHTML = variants[current]();
  const s = stage.querySelector('.ah-conversation-stream');
  if (s && scroll != null) s.scrollTop = scroll;
}
stage.addEventListener('click', (e) => {
  const t = e.target.closest('[data-wv], [data-wv-toggle]');
  if (!t) return;
  e.preventDefault();
  const id = t.dataset.wvToggle;
  if (id) S.stages[id] = !(S.stages[id] ?? t.dataset.wvDefault === 'true');
  const a = t.dataset.wv;
  if (a === 'terminal') S.terminal = !S.terminal;
  if (a === 'terminal-on') { S.terminal = true; S.view = 'term'; }
  if (a === 'terminal-off') { S.terminal = false; S.view = 'conv'; }
  if (a === 'details') S.details = !S.details;
  if (a === 'view-conv') S.view = 'conv';
  if (a === 'view-term') S.view = 'term';
  if (a === 'panel-open') S.panel = true;
  if (a === 'panel-close') { S.panel = false; S.terminal = false; }
  if (a === 'inline') S.inline = !S.inline;
  if (a === 'full-open') S.full = true;
  if (a === 'full-term') { S.full = true; S.terminal = true; }
  if (a === 'full-close') { S.full = false; S.terminal = false; }
  if (a === 'parent') toast(`Avaisi pääkeskustelun ”${PARENT.title}”.`);
  rerender();
});
function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 2200);
}
const pick = (id, key) => document.getElementById(id).addEventListener('change', (e) => { S[key] = e.target.value; S.stages = {}; mount(current); });
pick('wv-state', 'state');
pick('wv-harness', 'harness');
document.getElementById('wv-theme').addEventListener('click', (e) => {
  const dark = document.documentElement.getAttribute('data-theme') !== 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  e.target.textContent = dark ? 'Vaalea' : 'Tumma';
});
const q = new URLSearchParams(location.search);
if (STATES[q.get('state')]) S.state = document.getElementById('wv-state').value = q.get('state');
if (HARNESS[q.get('harness')]) S.harness = document.getElementById('wv-harness').value = q.get('harness');
if (q.get('theme') === 'dark') document.getElementById('wv-theme').click();
