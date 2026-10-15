// Kierros 16.10.2026: Claude Code ja Codex Pi:n rinnalla (proto-agent-harnesses).
// Suositeltu polku (ADR 0016, ehdotus): erilliset natiivit agentit käyttäjän omalla
// Unix-tunnuksella. Kaikille suunnille yhteistä: kirjautuminen agentti kerrallaan
// (Asetukset → Agentit), agentti ja malli yläpalkissa, langan päässä ja tiedoissa, ja
// agentilta puuttuvat ohjaimet näkyvät estettyinä syineen. Suunnat eroavat siinä,
// missä uuden keskustelun agentti valitaan. Neljäs sivu on Pi-laajennusvaihtoehto.
(() => {
const ICON_DOWN = SVG('<path d="m6 9 6 6 6-6"/>');
const ICON_LOCK = SVG('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>');
const ICON_OK = SVG('<path d="m5 12.5 4.5 4.5L19 7"/>');
const ICON_WARN = SVG('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4M12 17h.01"/>');
const ICON_EXT = SVG('<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/>');
const ICON_GEAR = SVG('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>');
const ICON_STEER = SVG('<path d="M5 4v6a4 4 0 0 0 4 4h10"/><path d="m15 10 4 4-4 4"/>');
const ICON_QUEUE = SVG('<path d="M4 6h12M4 12h9M4 18h6"/><path d="M18 13v7M14.5 16.5h7"/>');

// ---------- Agents and what each lacks (synthetic; host facts listed in result.md) ----------
const AG = {
  pi: { name: 'Pi', badge: 'Pi', to: 'Pi:lle', obj: 'Pi:tä', gen: 'Pi:n', ade: 'Pi:llä', all: 'Pi:lle', vendor: 'OpenAI', sub: 'ChatGPT-tilaus', key: 'OpenAI API-avain', keyHint: 'sk-', home: '~/.pi/agent', models: ['gpt-5.5', 'gpt-5.4'], think: 'medium', id: 'pi:019a3c7e-5d2b-7f41-9a0e-4c1d8b2e6f90', no: [] },
  claude: { name: 'Claude Code', badge: 'Cl', short: 'Claude', to: 'Claudelle', obj: 'Claudea', gen: 'Claude Coden', ade: 'Claude Codella', all: 'Claude Codelle', vendor: 'Anthropic', sub: 'Claude-tilaus', key: 'Anthropic API-avain', keyHint: 'sk-ant-', home: '~/.claude', models: ['claude-sonnet-5', 'claude-opus-5-5'], think: null, id: 'claude:5f0c2b9e-81d4-4c3a-9e57-2a6b1d0f8c34', no: ['steer', 'recap', 'ask'] },
  codex: { name: 'Codex', badge: 'Cx', to: 'Codexille', obj: 'Codexia', gen: 'Codexin', ade: 'Codexilla', all: 'Codexille', vendor: 'OpenAI', sub: 'ChatGPT-tilaus', key: 'OpenAI API-avain', keyHint: 'sk-', home: '~/.codex', models: ['gpt-5.5', 'gpt-5.4'], think: 'medium', id: 'codex:0199f2d4-6a1e-7c38-b5d2-93e07a4c1f6b', no: ['recap', 'ask'] },
};
const CAP = {
  steer: ['Ohjaus kesken työn', 'Viesti lähtee, kun vuoro päättyy. Claude Coden ohjausta kesken työn ei ole vielä varmistettu.'],
  recap: ['Tilannekatsaus', 'Katsaus tehdään Pi-laajennuksella, jota muut agentit eivät lataa.'],
  ask: ['Kysymykset selaimessa', 'Työkalujen luvat tulevat agentin omista asetuksista; selain ei kysy niitä.'],
};
const GATE = {
  claude: 'Anthropic ei salli kolmannen osapuolen palvelun tarjota claude.ai-kirjautumista ilman sen hyväksyntää.',
  codex: 'OpenAI ei salli Codexin tilauskirjautumista hostatuissa palveluissa ilman sen hyväksyntää.',
};
const short = (a) => AG[a].short || AG[a].name;
const badge = (a, extra = '') => `<span class="ag-b ag-${a}${extra}" aria-hidden="true">${AG[a].badge}</span>`;

// ---------- State ----------
const S = {
  v: 'v1', alt: false, settings: false, focus: null, flow: null, last: 'pi', menu: null,
  approved: false,
  auth: { pi: { sub: true, key: null }, claude: { sub: false, key: 'sk-ant-synthetic-7Q2k' }, codex: { sub: false, key: null } },
  model: { pi: 'gpt-5.5', claude: 'claude-sonnet-5', codex: 'gpt-5.5' },
  // Alternative: Claude models inside Pi through an extension and an Anthropic API key.
  altKey: 'sk-ant-…7Q2k',
};
const subOk = (a) => S.auth[a].sub && (a === 'pi' || S.approved);
const signedIn = (a) => subOk(a) || !!S.auth[a].key;
const via = (a) => subOk(a) ? AG[a].sub : S.auth[a].key ? 'API-avain' : null;
const real = (id) => UI.ws.flatMap(w => w.convs).find(c => c.id === id);
const agentOf = (c) => S.alt ? 'pi' : (c?.agent || 'pi');
const modelOf = (c) => c?.model || S.model[agentOf(c)];
const caps = (c) => S.alt ? [] : AG[agentOf(c)].no;
const fresh = (c) => c?.st === 'new';
const ALTMODELS = [['gpt-5.5', 'OpenAI'], ['gpt-5.4', 'OpenAI'], ['claude-sonnet-5', 'Claude · laajennus'], ['claude-opus-5-5', 'Claude · laajennus']];

// Synthetic conversations run by the other agents. A history in this draft is the shared
// fixture, relabelled per agent.
const aur = UI.ws.find(w => w.id === 'aurinkokello');
const SEED = () => {
  for (const w of UI.ws) w.convs = w.convs.filter(c => !/^n\d/.test(c.id));
  if (!real('c20')) aur.convs.splice(1, 0, { id: 'c20', title: 'Statusrivien testit', st: 'waiting', agent: 'claude' });
  const c20 = real('c20'); Object.assign(c20, { st: 'waiting', agent: 'claude', model: S.alt ? 'claude-sonnet-5' : undefined });
  const c10 = real('c10'); Object.assign(c10, { st: 'waiting', agent: 'codex' });
  real('c11').agent = 'codex';
};

// ---------- Page bar: the prototype's approval switch ----------
document.querySelector('.page-bar .hint').insertAdjacentHTML('beforebegin', `<label title="Vedoksen ohjain: näyttää kirjautumisnäkymät ennen palveluntarjoajien hyväksyntää ja sen jälkeen">Tilauslupa <select id="approval"><option value="no">Ei hyväksytty</option><option value="yes">Hyväksytty</option></select></label>`);
document.getElementById('approval').addEventListener('change', (e) => { S.approved = e.target.value === 'yes'; refresh(); });

// ---------- Top bar chip, details and sidebar rows ----------
const libActions = APP.actions;
APP.actions = (c) => libActions(c).replace(/<button class="set-chip"[\s\S]*?<\/button>/, '') ;
const chip = (c) => {
  if (S.settings) return '';
  if (fresh(c) && S.v !== 'v2') return '';
  const a = agentOf(c), m = modelOf(c); const t = AG[a].think;
  return `<button class="set-chip ag-chip" type="button" data-ui="info" title="Agentti ja malli · avaa tiedot">${badge(a)}<span class="ag-chip-name">${AG[a].name}</span><span class="dot" aria-hidden="true">·</span><span class="mono">${m}</span>${t && !fresh(c) ? `<span class="dot" aria-hidden="true">·</span><span>${t}</span>` : ''}</button>`;
};
const libRow = APP.row;
const myState = (c) => {
  if (c.id === UI.sel && UI.working) return 'working';
  if (c.id === 'c1') return 'waiting';
  return c.st;
};
APP.row = (c) => {
  const html = libRow({ ...c, st: myState(c) });
  // Plus-valikko: the row tells the agent, because the conversation is born with it.
  if (S.v !== 'v2' || S.alt) return html;
  const a = agentOf(c);
  return html.replace('<span class="conv-title">', `${badge(a, ' row')}<span class="sr">${AG[a].name}: </span><span class="conv-title">`);
};
window.detailsList = function (c) {
  const a = agentOf(c), m = modelOf(c), empty = fresh(c), how = via(a);
  const missing = caps(c);
  const altNote = S.alt && /^claude/.test(m) ? `<dt>Reitti</dt><dd>Pi:n Claude-laajennus<span class="sub">Anthropic API-avain · Pi omistaa historian</span></dd>` : '';
  return `<dl class="facts">
<dt>Agentti</dt><dd>${badge(a)} ${AG[a].name}<span class="sub">${how ? `Kirjautunut: ${how}` : 'Ei kirjautunut'}</span></dd>
<dt>Työtila</dt><dd><span class="mono">${esc(c.ws.id)}</span><span class="sub mono">${esc(c.ws.path)}</span></dd>
<dt>Malli</dt><dd><span class="mono">${m}</span>${empty ? '<span class="sub">uusien keskustelujen oletus</span>' : copyBtn('Kopioi mallin tunniste', m)}</dd>
${AG[a].think ? `<dt>Ajattelutaso</dt><dd>${empty ? `<span class="sub">${AG[a].gen} oletus</span>` : AG[a].think}</dd>` : ''}${altNote}
<dt>Natiivi tunniste</dt><dd>${empty ? `<span class="sub">syntyy ensimmäisestä viestistä</span>` : `<span class="mono id">${AG[a].id}</span>${copyBtn('Kopioi tunniste', AG[a].id)}`}</dd>
${missing.length ? `<dt>Ei käytössä</dt><dd><ul class="ag-no">${missing.map(k => `<li><strong>${CAP[k][0]}</strong><span class="sub">${CAP[k][1]}</span></li>`).join('')}</ul></dd>` : ''}
</dl>`;
};
APP.painted.push(() => {
  uiFrame.classList.toggle('is-settings', S.settings);
  if (S.settings) {
    uiRail.querySelectorAll('.conv-row[aria-current]').forEach(a => a.removeAttribute('aria-current'));
    uiTop.innerHTML = `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button><div class="tb-title"><strong>Agentit</strong><span class="tb-ws">Asetukset</span></div>`;
    return;
  }
  const c = selConv(); if (!c) return;
  uiTop.querySelector('.tb-actions')?.insertAdjacentHTML('afterbegin', chip(c));
  // The library's state chip only follows the live turn for c1.
  const st = myState(c); const old = uiTop.querySelector('.tb-right .chip');
  if (old && st && STATES[st] && c.id !== 'c1') { const [label, mark] = STATES[st]; old.outerHTML = `<span class="chip ${st}" role="status">${mark}<span class="chip-label">${label}</span></span>`; }
  updateK();
});

// ---------- Stage content ----------
const libContent = window.content;
const infoRow = (s) => `<div class="info-row"><button type="button" class="show-work" data-fold aria-expanded="${s.open}"><span class="lbl"><span class="when-closed">Näytä työ</span><span class="when-open">Piilota työ</span></span>${CHEV}</button><span class="act"><span class="live-dot"></span>Agentti työskentelee</span><span class="info-now">${activity(s)}</span><span class="clock">${elapsed(s)}</span></div>`;
const quietR = () => { const R = threadR(); R.startOpen = false; R.strip = (s) => s.status === 'working' ? infoRow(s) : ''; return R; };
const hhmm = () => new Date().toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
window.content = function () {
  if (S.settings) return settingsHtml();
  const c = real(UI.sel); const cv = selConv();
  if (fresh(c)) return emptyView(cv);
  if (c.first) { // started in this draft: the first message and the live turn
    run++; currentR = quietR();
    requestAnimationFrame(() => { const host = stage.querySelector('.vwrap'); if (host) { following = true; playLive(host, currentR); } });
    return `<div class="vwrap">${userBubble({ md: c.first, time: c.at }, 0)}</div>`;
  }
  if (c.agent && c.id !== 'c1') { currentR = quietR(); return withLive('', currentR); }
  return libContent();
};
// Relabel the shared fixture for the conversation's agent and model.
const relabel = () => {
  if (S.settings) return;
  const c = real(UI.sel); if (!c || fresh(c)) return;
  const a = agentOf(c), m = modelOf(c);
  const who = short(a), mid = a === 'pi' && !S.alt ? 'openai-codex/' + m : m;
  for (const el of stage.querySelectorAll('.who')) if (el.textContent === 'Pi' && who !== 'Pi') el.textContent = who;
  for (const el of stage.querySelectorAll('.model')) if (el.textContent === 'GPT-5.5' && m !== 'gpt-5.5') el.textContent = m;
  for (const el of stage.querySelectorAll('.mono')) if (el.textContent === 'openai-codex/gpt-5.5' && mid !== el.textContent) el.textContent = mid;
  for (const el of stage.querySelectorAll('[data-copy="openai-codex/gpt-5.5"]')) el.dataset.copy = mid;
};
new MutationObserver(relabel).observe(stage, { subtree: true, childList: true, characterData: true });

function emptyView(c) {
  const a = agentOf(c), ws = `<span class="mono">${esc(c.ws.id)}</span>`;
  if (S.v === 'v3') return `<div class="ag-start"><p class="lead">Uusi keskustelu työtilassa ${ws}</p><h2 id="ag-pick-h">Valitse agentti</h2><div class="ag-cards" role="radiogroup" aria-labelledby="ag-pick-h">${Object.keys(AG).map(k => card(k, k === a)).join('')}</div><p class="ag-foot">Agentti käynnistyy, kun lähetät ensimmäisen viestin, eikä vaihdu sen jälkeen. <a href="#" data-k="settings">Agentit ja kirjautuminen</a></p></div>`;
  if (S.alt) return `<div class="empty-convo"><p class="lead">Uusi keskustelu työtilassa ${ws}</p><p>Pi käynnistyy, kun lähetät ensimmäisen viestin. Malli valitaan kentän vasemmasta reunasta; Claude-mallit tulevat Pi:n laajennuksesta.</p></div>`;
  const how = S.v === 'v2' ? `Agentti valittiin, kun keskustelu luotiin.` : `Agentin voi vaihtaa kentän vasemmasta reunasta ennen ensimmäistä viestiä.`;
  return `<div class="empty-convo"><p class="lead">Uusi keskustelu työtilassa ${ws}</p><p>${AG[a].name} käynnistyy, kun lähetät ensimmäisen viestin. ${how}</p>${missingLine(a)}</div>`;
}
const missingLine = (a) => AG[a].no.length ? `<p class="ag-miss">${ICON_WARN}<span>${AG[a].ade} ei ole: ${AG[a].no.map(k => CAP[k][0].toLowerCase()).join(', ')}.</span></p>` : '';
function statusLine(a) {
  if (signedIn(a)) return `<span class="ag-st ok">${ICON_OK}${via(a)}</span>`;
  return `<span class="ag-st warn">${ICON_WARN}Ei kirjautunut</span>`;
}
function card(a, on) {
  return `<div class="ag-card${on ? ' on' : ''}${signedIn(a) ? '' : ' off'}" role="radio" tabindex="${on ? 0 : -1}" aria-checked="${on}" data-k="choose:${a}">
<div class="ag-card-h">${badge(a, ' lg')}<span><strong>${AG[a].name}</strong><span class="sub">${AG[a].vendor} · <span class="mono">${S.model[a]}</span></span></span></div>
${statusLine(a)}${signedIn(a) ? '' : `<button type="button" class="ag-link" data-k="signin:${a}">Kirjaudu…</button>`}
<ul class="ag-caps">${AG[a].no.length ? AG[a].no.map(k => `<li class="no">${CAP[k][0]}</li>`).join('') : '<li class="yes">Kaikki nykyiset ohjaimet</li>'}</ul></div>`;
}

// ---------- Composer: the library's look, the agent's capabilities ----------
APP.painted.splice(APP.painted.indexOf(updateComposer), 1);
const K = { text: '', mode: 'steer', queue: [], was: false };
comp.innerHTML = `<div class="cwrap"><div class="queue" aria-label="Jono" hidden></div><div class="cbox"><textarea rows="1"></textarea><div class="cbar"></div></div><div class="c-side"></div><div class="c-tools" hidden></div></div>`;
const kta = comp.querySelector('textarea');
document.getElementById('long-draft')?.remove();
kta.addEventListener('input', () => { K.text = kta.value; fit(kta); updateK(); });
kta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendK(); } });
const kWorking = () => UI.working && !S.settings;
function updateK() {
  if (!comp.querySelector('.cbar')) return;
  const c = real(UI.sel); if (!c) return;
  const a = agentOf(c), w = kWorking(), steer = !caps(c).includes('steer');
  if (!steer) K.mode = 'follow';
  if (!w && K.was && K.queue.length) { const n = K.queue.filter(q => q.kind === 'follow').length; K.queue = []; if (n) toast(`Työn jälkeen -viesti lähtisi nyt ${AG[a].to}.`); }
  K.was = w;
  const pick = fresh(c) && (S.v === 'v1' || S.alt);
  const v3none = fresh(c) && S.v === 'v3' && !signedIn(a);
  kta.disabled = v3none;
  kta.setAttribute('aria-label', `Viesti ${AG[a].to}`);
  kta.placeholder = v3none ? 'Valitse kirjautunut agentti yllä' : w ? (steer ? `Ohjaa ${AG[a].obj} tai lisää jonoon…` : `Viesti lähtee, kun ${short(a)} on valmis…`) : `Kirjoita ${AG[a].to}…`;
  const bar = comp.querySelector('.cbar');
  bar.innerHTML = pick ? (S.alt
    ? `<button type="button" class="ag-pill" data-k="menu:model" aria-haspopup="menu" aria-expanded="${S.menu === 'model'}" title="Valitse malli"><span class="mono">${modelOf(c)}</span>${ICON_DOWN}</button>`
    : `<button type="button" class="ag-pill" data-k="menu:pill" aria-haspopup="menu" aria-expanded="${S.menu === 'pill'}" title="Valitse agentti">${badge(a)}<span>${AG[a].name}</span>${signedIn(a) ? '' : `<span class="ag-pill-warn">ei kirjautunut</span>`}${ICON_DOWN}</button>`) : '';
  bar.hidden = !pick;
  const q = comp.querySelector('.queue');
  q.hidden = !K.queue.length;
  q.innerHTML = K.queue.length ? `<div class="q-head"><span>Jonossa ${K.queue.length}</span><button type="button" class="q-clear" data-k="clear">Tyhjennä jono</button></div><ul>${K.queue.map(x => `<li><span class="q-kind ${x.kind}">${x.kind === 'steer' ? ICON_STEER + 'Ohjaus' : ICON_QUEUE + 'Työn jälkeen'}</span><span class="q-text">${esc(x.text)}</span></li>`).join('')}</ul>` : '';
  const tools = comp.querySelector('.c-tools'); tools.hidden = !w;
  const why = CAP.steer[1];
  tools.innerHTML = w ? `<button class="c-stop" type="button" data-k="stop" aria-label="Pysäytä ${AG[a].gen} työ" title="Pysäytä ${AG[a].gen} työ"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg></button><span class="grow"></span>${steer ? '' : `<span class="ag-why" id="steer-why">Ohjaus ei käytössä</span>`}<div class="c-seg" role="group" aria-label="Viestin tapa työn aikana"><button type="button" data-k="mode:steer" aria-pressed="${K.mode === 'steer'}"${steer ? ' title="Ohjaa: viesti välivaiheessa"' : ` aria-disabled="true" aria-describedby="steer-why" title="${why}"`}>${ICON_STEER}<span>Ohjaa</span></button><button type="button" data-k="mode:follow" aria-pressed="${K.mode === 'follow'}" title="Työn jälkeen: viesti lähtee, kun vuoro päättyy">${ICON_QUEUE}<span>Työn jälkeen</span></button></div>` : '';
  const has = !!K.text.trim();
  comp.querySelector('.c-side').innerHTML = `<button class="c-send" type="button" data-k="send" aria-label="${w ? (K.mode === 'steer' ? 'Ohjaa' : 'Työn jälkeen') : 'Lähetä'}" title="${w ? (K.mode === 'steer' ? 'Ohjaa' : 'Työn jälkeen') : 'Lähetä'}"${has && !v3none ? '' : ' aria-disabled="true"'}>${SVG('<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>', ' stroke-width="2.2"')}</button>`;
}
// Stop at once, as in the library; its own stop only knows the Pi conversation.
function stopK() {
  const t = stage.querySelector('.turn.live.working'); if (!t) return;
  run++;
  const row = t.querySelector('.info-row, .strip.working');
  if (row) row.outerHTML = `<div class="strip stopped"><span class="act"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>Pysäytetty</span></div>`;
  t.classList.remove('working');
}
function sendK() {
  const text = K.text.trim(); if (!text) return;
  const c = real(UI.sel); const a = agentOf(c);
  if (!signedIn(a)) { toast(`${AG[a].name} ei ole kirjautunut.`); return openSettings(a); }
  if (kWorking()) {
    const item = { kind: K.mode, text }; K.queue.push(item);
    if (K.mode === 'steer') setTimeout(() => { if (!K.queue.includes(item)) return; K.queue = K.queue.filter(x => x !== item); toast(`Ohjaus toimitettiin ${AG[a].to} työn välivaiheessa.`); updateK(); }, 2600);
  } else if (fresh(c)) {
    // The first message starts the agent; from now on the agent and model are fixed.
    Object.assign(c, { st: 'waiting', first: text, at: hhmm(), title: text.length > 42 ? text.slice(0, 40) + '…' : text, agent: c.agent || a, model: modelOf(c) });
    S.last = c.agent; paint(); stage.innerHTML = content();
  } else {
    const host = stage.querySelector('.vwrap'); if (!host) return;
    host.insertAdjacentHTML('beforeend', userBubble({ md: text, time: hhmm() }, 0));
    following = true; stage.scrollTop = stage.scrollHeight; playLive(host, currentR || quietR());
  }
  K.text = ''; kta.value = ''; fit(kta); kta.focus(); updateK();
}
comp.addEventListener('click', (e) => {
  const b = e.target.closest('[data-k]'); if (!b) return;
  const [act, arg] = b.dataset.k.split(/:(.*)/s);
  if (b.getAttribute('aria-disabled') === 'true') { if (act === 'mode') toast(CAP.steer[1]); return; }
  if (act === 'send') return sendK();
  if (act === 'stop') return stopK();
  if (act === 'mode') { K.mode = arg; return updateK(); }
  if (act === 'clear') { K.queue = []; return updateK(); }
  if (act === 'menu') { e.stopPropagation(); return toggleMenu(arg, b); }
});

// ---------- Agent menu: composer pill (v1), plus button (v2), model pill (v4) ----------
const menu = document.createElement('div'); menu.className = 'ag-menu'; menu.setAttribute('role', 'menu'); menu.hidden = true; uiFrame.appendChild(menu);
let menuWs = 'aurinkokello';
function agentItems(cur) {
  return Object.keys(AG).map(a => `<button type="button" role="menuitemradio" aria-checked="${a === cur}" data-k="${signedIn(a) ? 'pick' : 'signin'}:${a}">${badge(a, ' lg')}<span class="ag-mi"><span class="ag-mi-t"><strong>${AG[a].name}</strong><span class="mono sub">${S.model[a]}</span></span>${signedIn(a) ? `<span class="sub">${via(a)}${AG[a].no.length ? ` · ei ${AG[a].no.map(k => CAP[k][0].toLowerCase()).join(', ')}` : ''}</span>` : `<span class="ag-st warn">${ICON_WARN}Ei kirjautunut · Kirjaudu…</span>`}</span>${a === cur ? `<span class="ag-tick">${ICON_OK}</span>` : ''}</button>`).join('');
}
function menuHtml(kind) {
  const c = real(UI.sel);
  if (kind === 'model') {
    const m = modelOf(c);
    return `<div class="ag-mh">Malli · Pi</div>${ALTMODELS.map(([id, src]) => `<button type="button" role="menuitemradio" aria-checked="${id === m}" data-k="model:${id}"><span class="ag-mi"><span class="ag-mi-t"><strong class="mono">${id}</strong></span><span class="sub">${src}${/^claude/.test(id) ? ' · Anthropic API-avain' : ' · ChatGPT-tilaus'}</span></span>${id === m ? `<span class="ag-tick">${ICON_OK}</span>` : ''}</button>`).join('')}<hr><button type="button" role="menuitem" data-k="settings" class="ag-more">${ICON_GEAR}<span>Agentit ja kirjautuminen…</span></button>`;
  }
  const head = kind === 'plus' ? `<div class="ag-mh">Uusi keskustelu · <span class="mono">${esc(menuWs)}</span></div>` : `<div class="ag-mh">Agentti tälle keskustelulle</div>`;
  return `${head}${agentItems(kind === 'plus' ? null : agentOf(c))}<hr><button type="button" role="menuitem" data-k="settings" class="ag-more">${ICON_GEAR}<span>Agentit ja kirjautuminen…</span></button>`;
}
function toggleMenu(kind, anchor) {
  if (S.menu === kind) return closeMenu();
  S.menu = kind; menu.innerHTML = menuHtml(kind); menu.hidden = false;
  const f = uiFrame.getBoundingClientRect(), r = anchor.getBoundingClientRect();
  const sheet = !r.width || f.width < 600;
  menu.classList.toggle('sheet', sheet);
  if (sheet) { menu.style.left = menu.style.top = menu.style.bottom = ''; }
  else if (kind === 'plus') { menu.style.bottom = ''; menu.style.left = Math.min(r.right - f.left + 6, f.width - menu.offsetWidth - 8) + 'px'; menu.style.top = Math.min(r.top - f.top, f.height - menu.offsetHeight - 8) + 'px'; }
  else { menu.style.top = ''; menu.style.left = Math.max(8, r.left - f.left) + 'px'; menu.style.bottom = (f.bottom - r.top + 6) + 'px'; }
  updateK();
  menu.querySelector('[aria-checked="true"], button')?.focus({ preventScroll: true });
}
function closeMenu() { if (!S.menu) return; S.menu = null; menu.hidden = true; updateK(); }
menu.addEventListener('click', (e) => {
  const b = e.target.closest('[data-k]'); if (!b) return;
  e.stopPropagation();
  const [act, arg] = b.dataset.k.split(/:(.*)/s); const kind = S.menu; closeMenu();
  if (act === 'settings') return openSettings();
  if (act === 'signin') return openSettings(arg, true);
  if (act === 'model') { real(UI.sel).model = arg; paint(); return; }
  if (act === 'pick' && kind === 'plus') return newConv(menuWs, arg);
  if (act === 'pick') { const c = real(UI.sel); c.agent = arg; S.last = arg; paint(); stage.innerHTML = content(); kta.focus(); }
});
document.addEventListener('click', (e) => { if (S.menu && !e.target.closest('.ag-menu')) closeMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.menu) { closeMenu(); e.stopPropagation(); } }, true);
function newConv(wsId, agent) {
  const w = UI.ws.find(x => x.id === wsId); const id = `n${++UI.created}`;
  w.convs.unshift({ id, title: 'Uusi keskustelu', st: 'new', agent }); w.open = true;
  openConv(id);
}
// v2: the plus button and the workspace menu's "Uusi keskustelu" open the agent menu.
window.addEventListener('click', (e) => {
  if (e.target.closest('.proto-picker')) return;
  const p = e.target.closest('[data-p="settings"]');
  if (p) { e.preventDefault(); e.stopPropagation(); document.querySelector('.p-menu')?.setAttribute('hidden', ''); return openSettings(); }
  const add = e.target.closest('[data-ws-add], [data-p^="new:"]');
  if (add && S.v === 'v2' && !S.alt) {
    e.preventDefault(); e.stopPropagation();
    menuWs = add.dataset.wsAdd || add.dataset.p.slice(4);
    document.querySelector('.p-menu')?.setAttribute('hidden', '');
    const anchor = add.dataset.wsAdd ? add : uiRail.querySelector(`[data-ws-add="${menuWs}"]`);
    return toggleMenu('plus', anchor);
  }
  if (add) { // other directions: a new conversation starts with the agent used last
    S.settings = false; uiFrame.classList.remove('is-settings');
    setTimeout(() => { const c = real(UI.sel); if (fresh(c) && !c.agent) { c.agent = S.last; paint(); stage.innerHTML = content(); } });
  }
  if (S.settings && e.target.closest('[data-conv], [data-ui="home"]')) { S.settings = false; S.flow = null; uiFrame.classList.remove('is-settings'); }
}, true);
// v3 cards: choosing, keyboard and sign-in.
stage.addEventListener('click', (e) => {
  const b = e.target.closest('[data-k]'); if (!b) return;
  e.preventDefault();
  const [act, arg] = b.dataset.k.split(/:(.*)/s);
  if (act === 'signin') { e.stopPropagation(); return openSettings(arg, true); }
  if (act === 'choose') { const c = real(UI.sel); c.agent = arg; if (signedIn(arg)) S.last = arg; paint(); stage.innerHTML = content(); stage.querySelector('.ag-card.on')?.focus(); return; }
  if (act === 'settings') return openSettings();
  settingsClick(act, arg, b);
});
stage.addEventListener('keydown', (e) => {
  const cur = e.target.closest('.ag-card'); if (!cur) return;
  const all = [...stage.querySelectorAll('.ag-card')]; const i = all.indexOf(cur);
  const n = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
  if (n) { e.preventDefault(); all[(i + n + all.length) % all.length].click(); }
  else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); kta.focus(); }
});

// ---------- Asetukset → Agentit: sign-in per agent ----------
function openSettings(focus = null, start = false) {
  S.settings = true; S.focus = focus; S.flow = start && focus ? (!subAvail(focus) || subOk(focus) ? { a: focus, kind: 'key' } : { a: focus, kind: 'sub', step: 0 }) : null;
  UI.drawer = false; UI.pop = false; closeMenu(); paint();
  following = false; stage.innerHTML = settingsHtml(); stage.scrollTop = 0;
  if (focus) requestAnimationFrame(() => { stage.querySelector('#agc-' + focus)?.scrollIntoView({ block: 'start' }); stage.querySelector(`#agc-${focus} .ag-flow input, #agc-${focus} .ag-flow button`)?.focus({ preventScroll: true }); });
}
const subAvail = (a) => a === 'pi' || S.approved;
const sbtn = (k, text, cls = 'secondary', x = '') => `<button type="button" class="${cls}" data-k="${k}"${x}>${text}</button>`;
function srow(name, desc, val, act = '', extra = '') { return `<div class="s-row"><div class="s-lbl"><span class="s-name">${name}</span>${desc ? `<span class="s-desc">${desc}</span>` : ''}</div><div class="s-val">${val}${act}</div>${extra}</div>`; }
function flowHtml(a) {
  const f = S.flow; if (!f || f.a !== a) return '';
  if (f.kind === 'key') return `<div class="ag-flow"><label class="s-field"><span>${AG[a].key}</span><input type="password" class="mono" data-key="${a}" placeholder="${AG[a].keyHint}…" autocomplete="off"></label><p class="s-desc">Avain annetaan kerran ${AG[a].all}, joka tallentaa sen omiin tunnuksiinsa hakemistossa <span class="mono">${AG[a].home}</span>. Sitä ei näytetä tallennuksen jälkeen.</p><div class="s-actions">${sbtn('cancel', 'Peruuta')}${sbtn('savekey:' + a, 'Tallenna', 'primary')}</div></div>`;
  if (a === 'claude') return f.step === 0
    ? `<div class="ag-flow"><ol class="ag-steps"><li><span>Avaa Clauden kirjautumissivu ja hyväksy.</span>${sbtn('open:claude', `${ICON_EXT}Avaa kirjautumissivu`, 'primary')}</li><li><span>Sivu näyttää koodin. Liitä se tähän.</span><label class="s-field"><span class="sr">Kirjautumiskoodi</span><input class="mono" data-code="claude" placeholder="koodi" autocomplete="off"></label></li></ol><p class="s-desc">Claude Code tekee kirjautumisen itse sinun Unix-tunnuksellasi ja tallentaa tunnukset tiedostoon <span class="mono">~/.claude/.credentials.json</span>. Sama kirjautuminen toimii SSH:lla.</p><div class="s-actions">${sbtn('cancel', 'Peruuta')}${sbtn('code:claude', 'Vahvista', 'primary')}</div></div>` : '';
  return `<div class="ag-flow"><div class="ag-code"><span class="mono">KQ7M-4TZP</span>${copyBtn('Kopioi koodi', 'KQ7M-4TZP')}</div><p class="s-desc">Avaa ${a === 'codex' ? 'OpenAI:n laitekirjautuminen' : 'Pi:n kirjautumissivu'} ja syötä koodi. Kirjautuminen valmistuu tähän itsestään.</p><div class="s-actions"><span class="s-hint ag-wait"><span class="st-dot working"></span>Odottaa vahvistusta…</span>${sbtn('cancel', 'Peruuta')}${sbtn('open:' + a, `${ICON_EXT}Avaa sivu`, 'primary')}</div></div>`;
}
function agentCard(a) {
  const st = signedIn(a) ? `<span class="s-status ok">${ICON_OK}Kirjautunut</span>` : `<span class="s-status warn">${ICON_WARN}Ei kirjautunut</span>`;
  const subRow = subAvail(a)
    ? srow(AG[a].sub, a === 'claude' ? 'Kirjaudu claude.ai-tilillä. Käyttö lasketaan tilauksesi rajoihin.' : `Kirjaudu ChatGPT-tilillä${a === 'pi' ? ' Pi:n laitekoodilla' : ' laitekoodilla'}.`, subOk(a) ? `<span class="s-status ok">${ICON_OK}Käytössä</span>` : '', subOk(a) ? sbtn('subout:' + a, 'Kirjaudu ulos', 'quiet') : sbtn('sub:' + a, 'Kirjaudu'))
    : srow(AG[a].sub, GATE[a], `<span class="s-status off">${ICON_LOCK}Ei käytössä tällä palvelimella</span>`);
  const keyRow = srow(AG[a].key, 'Käyttöperusteinen laskutus palveluntarjoajalta.', S.auth[a].key ? `<span class="mono">${AG[a].keyHint}…${S.auth[a].key.slice(-4)}</span>` : '<span class="s-desc">Ei avainta</span>', S.auth[a].key ? sbtn('key:' + a, 'Vaihda') + sbtn('delkey:' + a, 'Poista', 'quiet') : sbtn('key:' + a, 'Lisää avain'));
  const model = srow('Oletusmalli', 'Uudet keskustelut alkavat tällä. Avoimen keskustelun malli ei vaihdu.', `<select class="mono" data-model="${a}" aria-label="${AG[a].name}: oletusmalli">${AG[a].models.map(m => `<option${m === S.model[a] ? ' selected' : ''}>${m}</option>`).join('')}</select>`);
  const no = AG[a].no.length ? `<div class="s-row ag-norow"><div class="s-lbl"><span class="s-name">Ei käytössä ${AG[a].ade}</span><ul class="ag-no">${AG[a].no.map(k => `<li><strong>${CAP[k][0]}</strong> <span class="s-desc">${CAP[k][1]}</span></li>`).join('')}</ul></div></div>` : '';
  const home = srow('Natiivi hakemisto', 'Asetukset, tunnukset ja historia ovat agentin omia.', `<span class="mono">${AG[a].home}</span>`);
  const altRows = S.alt && a === 'pi' ? srow('Claude-mallit (laajennus)', 'Pi kutsuu Claudea laajennuksella. Keskustelu, historia ja ohjaimet ovat Pi:n.', `<span class="s-status ok">${ICON_OK}Asennettu</span>`)
    + srow('Claude-tilaus laajennukselle', 'Anthropic ei salli tilauskirjautumista Agent SDK:n kautta ilman hyväksyntää. Hyväksyntä ei koske tätä polkua, vaikka se koskisi Claude Codea.', `<span class="s-status off">${ICON_LOCK}Ei sallittu</span>`)
    + srow('Anthropic API-avain', 'Laajennus käyttää tätä. Käyttöperusteinen laskutus.', `<span class="mono">sk-ant-…${S.altKey.slice(-4)}</span>`, sbtn('toast:Avain vaihdettaisiin Pi:n tunnuksiin.', 'Vaihda')) : '';
  return `<section class="ag-sec${S.focus === a ? ' focus' : ''}" id="agc-${a}" aria-labelledby="agt-${a}"><header class="ag-sec-h">${badge(a, ' lg')}<span><strong id="agt-${a}">${AG[a].name}</strong><span class="s-desc">${AG[a].vendor}${signedIn(a) ? ` · ${via(a)}` : ''}</span></span>${st}</header><div class="s-card">${subRow}${keyRow}${flowHtml(a)}${altRows}${model}${no}${home}</div></section>`;
}
function settingsHtml() {
  const list = S.alt ? ['pi'] : Object.keys(AG);
  return `<div class="ag-set"><h1>Agentit</h1><p class="s-note">Kukin agentti on oma natiivi ohjelmansa, joka toimii sinun Unix-tunnuksellasi. Kirjautumiset ovat agenttien omia ja toimivat samoin SSH:lla; Open Habitat ei säilytä niitä erikseen.${S.alt ? ' <strong>Vaihtoehto:</strong> Claude on Pi:n malli, joten erillistä Claude Code -agenttia ei ole.' : ''}</p>${list.map(agentCard).join('')}</div>`;
}
function settingsClick(act, arg) {
  if (act === 'cancel') { S.flow = null; return rerender(); }
  if (act === 'sub') { S.flow = { a: arg, kind: 'sub', step: 0 }; rerender(); if (arg !== 'claude') setTimeout(() => { if (S.flow?.a === arg && S.flow.kind === 'sub') { S.auth[arg].sub = true; S.flow = null; rerender(); toast(`${AG[arg].name} kirjautui ChatGPT-tilillä. Tunnukset: ${AG[arg].home}`); } }, 3200); return; }
  if (act === 'subout') { S.auth[arg].sub = false; rerender(); return toast(`${AG[arg].name} kirjautui ulos tilauksesta.`); }
  if (act === 'key') { S.flow = { a: arg, kind: 'key' }; rerender(); return stage.querySelector('.ag-flow input')?.focus(); }
  if (act === 'delkey') { S.auth[arg].key = null; rerender(); return toast(`API-avain poistettiin ${AG[arg].gen} tunnuksista.`); }
  if (act === 'savekey') { const v = stage.querySelector(`[data-key="${arg}"]`).value.trim(); if (!v.startsWith(AG[arg].keyHint) || v.length < AG[arg].keyHint.length + 8) return toast(`Avain alkaa ${AG[arg].keyHint} ja on pidempi.`); S.auth[arg].key = v; S.flow = null; rerender(); return toast(`${AG[arg].name} tallensi avaimen omiin tunnuksiinsa.`); }
  if (act === 'open') return toast(arg === 'claude' ? 'Clauden kirjautumissivu avautuisi uuteen välilehteen.' : 'Kirjautumissivu avautuisi uuteen välilehteen.');
  if (act === 'code') { const v = stage.querySelector('[data-code="claude"]').value.trim(); if (!v) return toast('Liitä sivun näyttämä koodi.'); S.auth.claude.sub = true; S.flow = null; rerender(); return toast('Claude Code kirjautui claude.ai-tilillä.'); }
  if (act === 'toast') return toast(arg);
}
function rerender() { const y = stage.scrollTop; following = false; paint(); stage.innerHTML = settingsHtml(); stage.scrollTop = y; }
stage.addEventListener('change', (e) => { const a = e.target.dataset?.model; if (a) { S.model[a] = e.target.value; toast(`${AG[a].name}: uudet keskustelut alkavat mallilla ${S.model[a]}.`); } });
stage.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.closest('.ag-flow input')) { e.preventDefault(); e.target.closest('.ag-flow').querySelector('.primary[data-k^="savekey"], .primary[data-k^="code"]')?.click(); } });
function refresh() { if (S.settings) return rerender(); paint(); if (fresh(real(UI.sel))) stage.innerHTML = content(); if (S.menu) menu.innerHTML = menuHtml(S.menu); }

// ---------- Directions ----------
const show = (v) => () => {
  S.v = v; S.alt = v === 'v4'; S.settings = false; S.flow = null; S.focus = null; closeMenu();
  SEED(); K.queue = []; UI.pop = false; UI.drawer = false;
  if (v === 'v2') {
    // Open on the Claude conversation with the plus menu shown, as after pressing +.
    UI.sel = 'c20'; paint();
    setTimeout(() => { menuWs = 'aurinkokello'; const b = uiRail.querySelector('[data-ws-add="aurinkokello"]'); if (b && !S.menu) toggleMenu('plus', b); }, 60);
    return content();
  }
  const id = `n${++UI.created}`;
  aur.convs.unshift({ id, title: 'Uusi keskustelu', st: 'new', agent: S.last }); aur.open = true;
  UI.sel = id; paint();
  return content();
};
window.v1 = show('v1'); window.v2 = show('v2'); window.v3 = show('v3'); window.v4 = show('v4');
})();
