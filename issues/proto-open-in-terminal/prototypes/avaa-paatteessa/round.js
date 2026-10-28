// Päätteessä aloitettu keskustelu (proto-open-in-terminal). Keskustelu Status-skripti on
// aloitettu SSH:n yli henkilön omassa tmux-istunnossa `work`, ikkunassa 2. Selain lukee sen
// historiaa vain luettavana (daemonin kirjoittajatarkistus näkee päätteen Pi:n). Kolme
// tilannetta: Pi tmuxissa, Pi päätteessä ilman tmuxia, Pi suljettu. Suunnat eroavat siinä,
// mitä alareunan Vain luku -palkki ja päätepaneeli tekevät.

const OT_ICON = {
  term: SVG('<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m7 9 3 3-3 3"/><path d="M13 15h4"/>'),
  copy: SVG('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  eye: SVG('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  play: SVG('<path d="M7 5v14l11-7z"/>'),
  link: SVG('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  detach: SVG('<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  x: SVG('<path d="M6 6l12 12M18 6 6 18"/>'),
  max: SVG('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  down: SVG('<path d="m6 9 6 6 6-6"/>'),
  back: SVG('<path d="m15 6-6 6 6 6"/>'),
  plus: SVG('<path d="M12 5v14M5 12h14"/>'),
  info: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5h.01"/>'),
};

// ---------- Synthetic host facts ----------
const OT_WS = '~/src/aurinkokello';
const OT_SESSION = '019a3c7e-5d2b-7f41-9a0e-4c1d8b2e6f90';
const OT_SHORT = OT_SESSION.slice(0, 8);
const OT_RESUME = `pi --session ${OT_SHORT}`;
const OT_ATTACH = 'tmux attach -t work:2';
const OT_PROMPT = `<span class="tp-u">jari@birch</span>:<span class="tp-d">${OT_WS}</span><span class="tp-g"> (main)</span>$ `;
const OT_SCEN = {
  tmux: 'Pi tmuxissa (SSH)',
  bare: 'Pi päätteessä ilman tmuxia',
  ended: 'Pi suljettu',
};
const lastUser = [...CONVO].reverse().find(m => m.kind === 'user');

const OT = {
  v: 'tell', scen: new URLSearchParams(location.search).get('s') || 'tmux',
  dock: false, max: false, tabs: [], act: null, seq: 0, extra: [],
  tui: { working: false, words: 0, typed: '', lines: [], exited: false },
  timer: null, hint: null,
};
if (!OT_SCEN[OT.scen]) OT.scen = 'tmux';
const running = () => OT.scen !== 'ended';

// The conversation in the sidebar is this one, started in a terminal.
UI.ws[0].convs[0] = { id: 'ct', title: 'Status-skripti', st: 'term' };
UI.sel = 'ct';
STATES.term = ['Käynnissä päätteessä', `<span class="ot-st">${OT_ICON.term}</span>`];

// ---------- Page controls: scenario and the person's own terminal ----------
const otBar = document.querySelector('.page-bar');
const otScenLabel = document.createElement('label');
otScenLabel.innerHTML = `Tilanne <select id="ot-scen">${Object.entries(OT_SCEN).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>`;
const otQuit = document.createElement('button');
otQuit.type = 'button'; otQuit.id = 'ot-quit'; otQuit.className = 'ot-demo';
otQuit.textContent = 'Sulje Pi SSH-päätteessä';
otBar.insertBefore(otQuit, otBar.querySelector('.hint'));
otBar.insertBefore(otScenLabel, otQuit);
const otScenSel = otScenLabel.querySelector('select');
otScenSel.value = OT.scen;
otScenSel.addEventListener('change', () => { setScen(otScenSel.value, true); });
otQuit.addEventListener('click', () => quitPi());

function setScen(s, reset) {
  OT.scen = s; otScenSel.value = s;
  const url = new URL(location); url.searchParams.set('s', s); history.replaceState(null, '', url);
  UI.ws[0].convs[0].st = running() ? 'term' : 'done';
  if (reset) { resetTabs(); OT.extra = []; startTui(); }
  otPaint();
}
// The person quits Pi in their SSH terminal: the tmux window stays, now at a shell prompt.
function quitPi() {
  if (OT.scen !== 'tmux' && OT.scen !== 'bare') return;
  const wasTmux = OT.scen === 'tmux';
  OT.tui.exited = true; OT.tui.working = false; clearInterval(OT.timer);
  setScen('ended', false);
  for (const t of OT.tabs) if (t.kind === 'mirror' || t.kind === 'attach') { t.exited = true; t.busy = false; t.sub = wasTmux ? 'Pi päättyi; ikkuna jatkaa tmuxissa' : ''; }
  otToast('Pi suljettiin SSH-päätteessä. Keskustelu on nyt levossa.');
  otPaint();
}

// ---------- The terminal Pi's screen (synthetic Pi TUI) ----------
const REPLY = 'Oletus on nyt viime maanantai, ja testit menevät läpi (14 ok). Lisäsin README:hen esimerkin.';
function startTui() {
  clearInterval(OT.timer);
  Object.assign(OT.tui, { working: running(), words: 0, typed: '', lines: [], exited: !running() });
  if (!running()) return;
  OT.timer = setInterval(() => {
    const t = OT.tui; if (!t.working) return;
    t.words += 2;
    if (t.words >= REPLY.split(' ').length) { t.working = false; clearInterval(OT.timer); }
    paintTerm(); if (!t.working) otPaint();
  }, 260);
}
const tw = (s) => esc(s);
function tuiHtml(tab) {
  const t = OT.tui; const L = [];
  const rule = `<span class="tm">${'─'.repeat(64)}</span>`;
  L.push(`<span class="tui-pi">pi</span> <span class="tm">${OT_WS} · gpt-5.5 · medium</span>`);
  L.push(rule);
  L.push(`<span class="tb">›</span> ${tw(lastUser.md)}`);
  L.push(`<span class="tg">●</span> <span class="tm">bash</span> python -m pytest -q <span class="tg">14 passed</span>`);
  L.push(`<span class="tg">●</span> <span class="tm">edit</span> README.md <span class="tg">+6</span>`);
  const words = REPLY.split(' ');
  const shown = t.exited && !t.words ? words : words.slice(0, Math.max(t.words, t.working ? t.words : words.length));
  L.push(`  ${tw(shown.join(' '))}${t.working ? '<span class="tui-cur"> </span>' : ''}`);
  for (const m of t.lines) L.push(m);
  if (t.exited) {
    L.push(''); L.push(`<span class="tm">Istunto tallennettu: ${OT_SESSION}.jsonl</span>`);
    L.push(OT_PROMPT + '<span class="term-cur"> </span>');
    return L;
  }
  L.push(rule);
  L.push(t.working ? `<span class="tc">⠋ Vastaa…</span> <span class="tm">Esc keskeyttää</span>` : `<span class="tm">valmis · 12,4k / 272k</span>`);
  const typing = tab && tab.kind !== 'mirror';
  L.push(`<span class="tm">╭${'─'.repeat(62)}╮</span>`);
  L.push(`<span class="tm">│</span> ${tw(t.typed)}${typing ? '<span class="term-cur"> </span>' : ''}`);
  L.push(`<span class="tm">╰${'─'.repeat(62)}╯</span>`);
  L.push(`<span class="tm">${OT_WS} (main) · ${tab && tab.kind === 'resume' ? 'selaimen pääte' : 'tmux work:2'}</span>`);
  return L;
}
function shellHtml(tab) {
  const L = [`<span class="tm">Pääte avattu 9.12 · bash työtilassa ${OT_WS}</span>`, OT_PROMPT + '<span class="tm">git status --short</span>', ' M status.py', ' M README.md'];
  if (tab.kind === 'staged') L.push(OT_PROMPT + esc(OT_RESUME) + '<span class="term-cur"> </span>');
  else L.push(OT_PROMPT + '<span class="term-cur"> </span>');
  return L;
}

// ---------- Panel tabs ----------
function resetTabs() { OT.tabs = [{ key: 'b1', name: 'bash', kind: 'shell' }]; OT.act = 'b1'; OT.dock = false; OT.max = false; }
resetTabs();
// A plain shell is always new; the other kinds open once and are focused again after that.
function addTab(tab) {
  const same = OT.tabs.find(t => t.kind === tab.kind && t.kind !== 'shell');
  if (same) { OT.act = same.key; } else { tab.key = `t${++OT.seq}`; OT.tabs.push(tab); OT.act = tab.key; }
  OT.dock = true; otPaint();
  requestAnimationFrame(() => document.querySelector('.ot-term')?.focus());
}
const actTab = () => OT.tabs.find(t => t.key === OT.act);
function closeTab(key) {
  const t = OT.tabs.find(x => x.key === key); if (!t) return;
  OT.tabs = OT.tabs.filter(x => x !== t);
  if (OT.act === key) OT.act = OT.tabs[OT.tabs.length - 1]?.key ?? null;
  if (t.kind === 'mirror') otToast('Irrotettu. Pi jatkaa tmuxissa.');
  else if (t.kind === 'attach') otToast('Irrotettu tmuxista. Pi jatkaa ikkunassa work:2.');
  else if (t.kind === 'resume' && !t.exited) otToast('Pääte ja sen Pi suljettiin. Keskustelu on levossa.');
  if (t.kind === 'resume') { OT.scen = 'ended'; UI.ws[0].convs[0].st = 'done'; }
  otPaint();
}
const tabMark = (t) => t.kind === 'shell' || t.kind === 'staged' || t.exited ? `<span class="sh-prompt" aria-label="Kehotteessa" role="img">$</span>` : `<span class="st-dot working" role="img" aria-label="Ajossa: pi"></span>`;
const tabLabel = (t) => t.kind === 'mirror' ? 'work:2' : t.kind === 'attach' ? 'work:2' : t.kind === 'resume' ? 'pi' : 'bash';
const tabTag = (t) => t.kind === 'mirror' ? '<span class="ot-ro">vain luku</span>' : t.kind === 'attach' ? '<span class="ot-ro shared">jaettu</span>' : '';
const tabTip = (t) => t.kind === 'mirror' ? 'Henkilön tmux work:2 · vain luku' : t.kind === 'attach' ? 'Henkilön tmux work:2 · myös SSH-yhteys näkee tämän' : t.kind === 'resume' ? `Ajossa: ${OT_RESUME}` : 'Kehotteessa';

function dockHtml() {
  const t = actTab();
  const tabs = OT.tabs.map(x => `<div class="sh-tab${x.key === OT.act ? ' on' : ''}" data-kind="${x.kind}"><button type="button" role="tab" aria-selected="${x.key === OT.act}" data-ot="tab:${x.key}" title="${esc(tabTip(x))}"><span class="sh-mark">${tabMark(x)}</span><span class="mono">${tabLabel(x)}</span>${tabTag(x)}</button><button type="button" class="sh-x" data-ot="close:${x.key}" aria-label="${x.kind === 'mirror' || x.kind === 'attach' ? 'Irrota' : 'Lopeta'} ${tabLabel(x)}" title="${x.kind === 'mirror' || x.kind === 'attach' ? 'Irrota: Pi jatkaa tmuxissa' : 'Lopeta pääte'}">${x.kind === 'mirror' || x.kind === 'attach' ? OT_ICON.detach : OT_ICON.x}</button></div>`).join('');
  const body = t ? `<div class="ot-term" tabindex="0" role="textbox" aria-multiline="true" aria-readonly="${t.kind === 'mirror'}" aria-label="Pääte ${tabLabel(t)}" data-kind="${t.kind}"><div class="ot-lines"></div></div>${bannerHtml(t)}`
    : `<div class="sh-empty">${OT_ICON.term}<p>Työtilassa <span class="mono">aurinkokello</span> ei ole päätettä.</p><button class="primary" type="button" data-ot="newshell">${OT_ICON.term}Avaa pääte</button></div>`;
  return `<div class="sh-grip" aria-hidden="true"></div><div class="sh-bar"><button type="button" class="sh-back" data-ot="dock">${OT_ICON.back}<span>Keskustelu</span></button><span class="sh-wsname mono">aurinkokello</span><div class="sh-tabs" role="tablist" aria-label="Päätteet: aurinkokello">${tabs}</div><div class="sh-tools"><button class="icon-btn sh-tool" type="button" data-ot="newshell" aria-label="Uusi pääte" title="Uusi pääte">${OT_ICON.plus}</button><button class="icon-btn sh-tool ot-maxbtn" type="button" data-ot="max" aria-pressed="${OT.max}" aria-label="${OT.max ? 'Palauta koko' : 'Suurenna'}" title="${OT.max ? 'Palauta koko' : 'Suurenna'}">${OT_ICON.max}</button><button class="icon-btn sh-tool" type="button" data-ot="dock" aria-label="Piilota paneeli (päätteet jatkavat)" title="Piilota paneeli (päätteet jatkavat)">${OT_ICON.down}</button></div></div><div class="sh-host">${body}</div>`;
}
// A line over the terminal that says whose screen this is and what typing does.
function bannerHtml(t) {
  if (t.kind === 'mirror') return `<div class="ot-banner">${OT_ICON.eye}<span>${t.exited ? 'Pi päättyi. Ikkuna jatkaa tmuxissa; peili näyttää sen kehotteen.' : 'Peili henkilön tmux-ikkunasta <span class="mono">work:2</span>. Kirjoita SSH-päätteessä: selain ei lähetä näppäimiä.'}</span>${OT.hint ? `<strong class="ot-nudge">${OT.hint}</strong>` : ''}</div>`;
  if (t.kind === 'attach') return `<div class="ot-banner shared">${OT_ICON.link}<span>${t.exited ? 'Pi päättyi; olet yhä tmux-ikkunassa <span class="mono">work:2</span>.' : 'Liitetty tmux-ikkunaan <span class="mono">work:2</span> toisena asiakkaana. SSH-pääte näkee saman ja kirjoittaa samaan.'}</span></div>`;
  if (t.kind === 'staged') return `<div class="ot-banner">${OT_ICON.info}<span>Komento odottaa kehotteessa. Paina <kbd>Enter</kbd>, niin keskustelu jatkuu tässä päätteessä.</span></div>`;
  if (t.kind === 'resume') return `<div class="ot-banner">${OT_ICON.play}<span>${t.exited ? 'Pi suljettiin; pääte jatkaa.' : `Keskustelu jatkuu Pi:ssä tässä päätteessä (<span class="mono">${esc(OT_RESUME)}</span>). Yläpuolen historia päivittyy samalla.`}</span></div>`;
  return '';
}
function paintTerm() {
  const host = document.querySelector('.ot-term .ot-lines'); const t = actTab();
  if (!host || !t) return;
  const tuiTab = (t.kind === 'mirror' || t.kind === 'attach' || t.kind === 'resume');
  const L = tuiTab ? tuiHtml(t) : shellHtml(t);
  host.innerHTML = L.map(l => `<div class="tl">${l || ' '}</div>`).join('');
  const sc = host.parentElement; sc.scrollTop = sc.scrollHeight;
}

// ---------- Footer: where the read-only conversation says what to do ----------
const cmdBox = (cmd, label) => `<div class="ot-cmd"><code class="mono">${esc(cmd)}</code><button class="icon-btn" type="button" data-ot="copy:${esc(cmd)}" aria-label="${label}" title="${label}">${OT_ICON.copy}</button></div>`;
const where = () => OT.scen === 'tmux'
  ? `tmux-istunnossa <span class="mono">work</span>, ikkunassa 2 <span class="mono">pi</span>`
  : `päätteessä <span class="mono">pts/4</span> ilman tmuxia`;
function footHtml() {
  const v = OT.v, s = OT.scen;
  const head = (title, text) => `<div class="ot-text"><strong data-testid="read-only-indicator">${title}</strong><p>${text}</p></div>`;
  const newConv = `<a class="ot-link" href="#" data-ot="newconv">Uusi keskustelu</a>`;
  if (s === 'ended') {
    const done = 'Päätteen Pi on suljettu. Keskustelu on aloitettu päätteessä, joten selain ei jatka sitä itse.';
    if (v === 'tell') return `<div class="ro-foot">${head('Vain luku', `${done} Jatka missä tahansa päätteessä työtilan hakemistossa:`)}${cmdBox(`cd ${OT_WS} && ${OT_RESUME}`, 'Kopioi jatkokomento')}<div class="ot-acts"><button class="secondary" type="button" data-ot="newshell">${OT_ICON.term}Avaa pääte</button>${newConv}</div></div>`;
    if (v === 'watch') return `<div class="ro-foot">${head('Vain luku', `${done} Paneeli voi valmistella jatkokomennon; sinä painat Enteriä.`)}<div class="ot-acts"><button class="primary" type="button" data-ot="stage">${OT_ICON.term}Avaa päätteessä</button>${newConv}</div></div>`;
    return `<div class="ro-foot">${head('Vain luku', `${done} Jatka sitä Pi:ssä selaimen päätteessä; historia päivittyy tähän.`)}<div class="ot-acts"><button class="primary" type="button" data-ot="resume">${OT_ICON.play}Jatka päätteessä</button>${newConv}</div></div>`;
  }
  if (s === 'resumed') return `<div class="ro-foot">${head('Käynnissä selaimen päätteessä', 'Jatkat tätä keskustelua Pi:ssä päätepaneelin välilehdellä <span class="mono">pi</span>. Historia päivittyy tähän; viestit kirjoitetaan päätteessä.')}<div class="ot-acts"><button class="secondary" type="button" data-ot="show">${OT_ICON.term}Näytä pääte</button></div></div>`;
  const lead = `Pi kirjoittaa tähän keskusteluun ${where()}. Selain näyttää historian vain luettavana.`;
  if (s === 'bare') {
    const no = v === 'tell' ? 'Jatka siinä päätteessä.' : v === 'watch' ? 'Selain ei näe päätettä, joka ei ole tmuxissa.' : 'Selain ei voi liittyä päätteeseen, joka ei ole tmuxissa. Sulje Pi siellä, niin voit jatkaa täällä.';
    const btn = v === 'tell' ? '' : `<button class="primary" type="button" aria-disabled="true" aria-describedby="ot-why" title="${v === 'watch' ? 'Pääte ei ole tmuxissa' : 'Pääte ei ole tmuxissa'}">${v === 'watch' ? OT_ICON.eye + 'Katso päätteessä' : OT_ICON.link + 'Jatka päätteessä'}</button><span id="ot-why" hidden>Pääte ei ole tmuxissa</span>`;
    return `<div class="ro-foot">${head('Käynnissä päätteessä', `${lead} ${no}`)}<div class="ot-acts">${btn}${newConv}</div></div>`;
  }
  if (v === 'tell') return `<div class="ro-foot">${head('Käynnissä päätteessä', `${lead} Jatka siellä, tai liitä tmux mistä tahansa SSH-yhteydestä:`)}${cmdBox(OT_ATTACH, 'Kopioi liittymiskomento')}<div class="ot-acts">${newConv}</div></div>`;
  if (v === 'watch') return `<div class="ro-foot">${head('Käynnissä päätteessä', `${lead} Paneeli näyttää ikkunan sellaisenaan, mutta ei kirjoita siihen.`)}<div class="ot-acts"><button class="primary" type="button" data-ot="mirror">${OT_ICON.eye}Katso päätteessä</button>${newConv}</div></div>`;
  return `<div class="ro-foot">${head('Käynnissä päätteessä', `${lead} Liity samaan tmux-ikkunaan ja jatka siinä; SSH-yhteys näkee saman.`)}<div class="ot-acts"><button class="primary" type="button" data-ot="attach">${OT_ICON.link}Jatka päätteessä</button>${newConv}</div></div>`;
}

// ---------- Frame hooks: top bar actions and the details popover ----------
APP.actions = (c) => {
  const n = OT.tabs.length;
  return `<span class="tag ro">Vain luku</span><button class="set-chip" type="button" data-ui="info" title="Malli ja ajattelutaso · avaa tiedot"><span class="mono">gpt-5.5</span><span class="dot" aria-hidden="true">·</span><span>medium</span></button>`
    + `<button class="icon-btn tb-btn sh-tb" type="button" data-ot="dock" aria-pressed="${OT.dock}" aria-label="${n ? `Pääte (${n})` : 'Pääte'}" title="Pääte (Ctrl+Alt+T)">${OT_ICON.term}${n ? `<span class="sh-count" aria-hidden="true">${n}</span>` : ''}</button>`
    + `<button class="icon-btn tb-btn" type="button" data-ui="info" aria-label="Tiedot" title="Tiedot" aria-expanded="${UI.pop}">${OT_ICON.info}</button>`;
};
function factsHtml() {
  const proc = OT.scen === 'tmux' ? `Käynnissä päätteessä<span class="sub mono">PID 48121 · tmux work:2 · 1 SSH-asiakas</span>`
    : OT.scen === 'bare' ? `Käynnissä päätteessä<span class="sub mono">PID 48121 · pts/4 · ei tmuxia</span>`
    : OT.scen === 'resumed' ? `Käynnissä selaimen päätteessä<span class="sub mono">PID 50277 · ${esc(OT_RESUME)}</span>` : 'Ei käynnissä';
  return `<h3>Tiedot</h3><dl class="facts">
<dt>Työtila</dt><dd><span class="mono">aurinkokello</span><span class="sub mono">${OT_WS}</span></dd>
<dt>Malli</dt><dd><span class="mono">${MODEL_ID}</span></dd>
<dt>Ohjaus</dt><dd>Aloitettu päätteessä<span class="sub">Selaimessa vain luku</span></dd>
<dt>Pi</dt><dd>${proc}</dd>
<dt>Natiivi tunniste</dt><dd><span class="mono id">${OT_SESSION}</span></dd>
</dl>`;
}
APP.painted.push(() => { if (!uiPop.hidden) uiPop.innerHTML = factsHtml(); });

// ---------- Painting ----------
let otFoot = null, otDock = null;
function ensureParts() {
  const col = document.querySelector('.col');
  if (!otFoot) { otFoot = document.createElement('div'); otFoot.className = 'ot-foot'; col.appendChild(otFoot); }
  if (!otDock) { otDock = document.createElement('section'); otDock.className = 'sh-dock'; otDock.setAttribute('aria-label', 'Päätepaneeli'); col.appendChild(otDock); }
  document.querySelector('.composer').hidden = true;
}
function otPaint() {
  ensureParts();
  paint();
  otFoot.innerHTML = footHtml();
  otDock.hidden = !OT.dock;
  if (OT.dock) { otDock.innerHTML = dockHtml(); paintTerm(); }
  const col = document.querySelector('.col');
  col.classList.toggle('ot-docked', OT.dock); col.classList.toggle('sh-max', OT.dock && OT.max);
  document.querySelector('.frame').dataset.otDir = OT.v;
  document.querySelector('.frame').dataset.otScen = OT.scen;
  otQuit.disabled = OT.scen !== 'tmux' && OT.scen !== 'bare';
  paintExtra();
}
// Messages typed in a browser terminal reach the history as Pi writes them.
function paintExtra() {
  const host = stage.querySelector('.vwrap'); if (!host) return;
  host.querySelectorAll('.ot-extra').forEach(n => n.remove());
  for (const m of OT.extra) host.insertAdjacentHTML('beforeend', `<div class="ot-extra">${userBubble(m, 0)}</div>`);
}
function otView(v) {
  return () => {
    OT.v = v; resetTabs(); OT.extra = []; OT.hint = null;
    UI.sel = 'ct'; UI.pop = false; UI.ws[0].convs[0].st = running() ? 'term' : 'done';
    run++; document.querySelectorAll('.float-bar').forEach(el => el.remove());
    currentR = threadR();
    startTui();
    requestAnimationFrame(() => { otPaint(); following = true; stage.scrollTop = stage.scrollHeight; });
    return lanka('', { meta: 'top', fold: 'head', runs: 'separate' });
  };
}
const otTell = otView('tell'), otWatch = otView('watch'), otTake = otView('take');

let otToastTimer;
function otToast(text) { uiToast.textContent = text; uiToast.classList.add('on'); clearTimeout(otToastTimer); otToastTimer = setTimeout(() => uiToast.classList.remove('on'), 3200); }

// ---------- Actions ----------
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-ot]'); if (!b || b.closest('.proto-picker')) return;
  e.preventDefault();
  if (b.getAttribute('aria-disabled') === 'true') return;
  const [a, arg] = [b.dataset.ot.split(':')[0], b.dataset.ot.slice(b.dataset.ot.indexOf(':') + 1)];
  if (a === 'dock') { OT.dock = !OT.dock; if (!OT.dock) OT.max = false; return otPaint(); }
  if (a === 'max') { OT.max = !OT.max; return otPaint(); }
  if (a === 'tab') { OT.act = arg; OT.hint = null; return otPaint(); }
  if (a === 'close') return closeTab(arg);
  if (a === 'newshell') return addTab({ kind: 'shell' });
  if (a === 'show') { OT.dock = true; OT.act = OT.tabs.find(t => t.kind === 'resume')?.key ?? OT.act; return otPaint(); }
  if (a === 'mirror') return addTab({ kind: 'mirror' });
  if (a === 'attach') return addTab({ kind: 'attach' });
  if (a === 'stage') return addTab({ kind: 'staged' });
  if (a === 'resume') return resumeHere();
  if (a === 'newconv') return otToast('Uusi keskustelu ei kuulu tähän vedokseen.');
  if (a === 'copy') { try { await navigator.clipboard.writeText(arg); } catch {} return otToast('Komento kopioitu.'); }
});
// The ended conversation continues in Pi inside a new browser shell.
function resumeHere() {
  OT.scen = 'resumed'; UI.ws[0].convs[0].st = 'term';
  Object.assign(OT.tui, { working: false, words: 99, typed: '', lines: [`<span class="tm">Jatkettu istunto ${OT_SHORT} · ${OT_WS}</span>`], exited: false });
  addTab({ kind: 'resume' });
}
OT_SCEN.resumed = 'Pi selaimen päätteessä';

// Typing: a mirror drops keys and says so; an attached or resumed Pi takes them.
document.addEventListener('keydown', (e) => {
  const term = e.target.closest?.('.ot-term'); if (!term) return;
  const t = actTab(); if (!t) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  e.stopPropagation();
  if (t.kind === 'mirror') { OT.hint = 'Näppäimet eivät mene peiliin'; e.preventDefault(); otPaint(); document.querySelector('.ot-term')?.focus(); return; }
  if (t.kind === 'staged' && e.key === 'Enter') { e.preventDefault(); OT.tabs = OT.tabs.filter(x => x !== t); return resumeHere(); }
  if (t.kind !== 'attach' && t.kind !== 'resume' || t.exited) return;
  const tui = OT.tui;
  if (e.key === 'Enter' && tui.typed.trim()) {
    e.preventDefault();
    const text = tui.typed.trim(); tui.typed = '';
    tui.lines.push(`<span class="tb">›</span> ${esc(text)}`, `<span class="tg">●</span> <span class="tm">read</span> status.py`);
    tui.working = true; paintTerm();
    setTimeout(() => {
      OT.extra.push({ kind: 'user', time: hmNow(), md: text });
      tui.lines.push(`  Selvä, katson sitä.`); tui.working = false;
      otPaint(); stage.scrollTop = stage.scrollHeight; document.querySelector('.ot-term')?.focus();
    }, 900);
    return;
  }
  if (e.key === 'Backspace') { e.preventDefault(); tui.typed = tui.typed.slice(0, -1); return paintTerm(); }
  if (e.key.length === 1) { e.preventDefault(); tui.typed += e.key; paintTerm(); }
}, true);
const hmNow = () => { const d = new Date(); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
window.__ot = { OT, quitPi, setScen };
