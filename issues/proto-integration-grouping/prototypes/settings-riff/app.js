// Tekoäly page riff (round 2 of proto-integration-grouping): the default model
// and API keys inside "Kolme sivua". Synthetic people, keys and models only;
// a key is never shown beyond the four last characters, as in production.
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  devices: svg('<rect x="3" y="4" width="13" height="10" rx="1.5"/><rect x="17" y="9" width="5" height="11" rx="1"/><path d="M7 18h6"/>'),
  agent: svg('<path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3z"/><path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z"/>'),
  code: svg('<path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/><path d="M13.5 5l-3 14"/>'),
  plug: svg('<path d="M9 3v5M15 3v5"/><path d="M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v4"/>'),
  eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  editor: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  disk: svg('<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/>'),
  server: svg('<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/>'),
  key: svg('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>'),
  steer: svg('<path d="M5 19V9a4 4 0 0 1 4-4h10"/><path d="M15 1l4 4-4 4"/>'),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.2 3.5 5"/>'),
  check: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>'),
  dash: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>'),
  alert: svg('<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17h.01"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  chev: svg('<path d="M9 6l6 6-6 6"/>'),
  down: svg('<path d="M6 9l6 6 6-6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  folder: svg('<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/>'),
  think: svg('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>'),
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mark = (m, tone, sm) => `<span class="mark${sm ? ' sm' : ''} tone-${tone}" aria-hidden="true">${m}</span>`;

// Pi's five providers, as production's PiModelSelector names them. A route is
// one way to reach models: a subscription sign-in or one stored API key.
const ROUTES = {
  'openai-codex': { label: 'ChatGPT-tilaus', short: 'ChatGPT', mark: 'Ch', tone: 1, company: 'openai', kind: 'sub' },
  openai: { label: 'OpenAI API', short: 'OpenAI-avain', mark: 'OA', tone: 1, company: 'openai', kind: 'key' },
  anthropic: { label: 'Anthropic API', short: 'Anthropic-avain', mark: 'An', tone: 2, company: 'anthropic', kind: 'key' },
  deepseek: { label: 'DeepSeek API', short: 'DeepSeek-avain', mark: 'DS', tone: 3, company: 'deepseek', kind: 'key' },
  'claude-bridge': { label: 'Claude-tilaus', short: 'Claude', mark: 'Cl', tone: 2, company: 'anthropic', kind: 'sub' },
};
const ORDER = ['openai-codex', 'openai', 'anthropic', 'deepseek', 'claude-bridge'];
const KEYS = ['openai', 'anthropic', 'deepseek'];
const COMPANY = {
  openai: { name: 'OpenAI', mark: 'OA', tone: 1, routes: ['openai-codex', 'openai'] },
  anthropic: { name: 'Anthropic', mark: 'An', tone: 2, routes: ['claude-bridge', 'anthropic'] },
  deepseek: { name: 'DeepSeek', mark: 'DS', tone: 3, routes: ['deepseek'] },
};
const LV = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
const M = (p, id, name, levels, older) => ({ p, id, name, levels, older: !!older });
const MODELS = [
  M('openai-codex', 'gpt-5.5-codex', 'GPT 5.5 Codex', ['low', 'medium', 'high', 'xhigh']),
  M('openai-codex', 'gpt-5.5', 'GPT 5.5', ['minimal', 'low', 'medium', 'high']),
  M('openai-codex', 'gpt-5-mini', 'GPT 5 mini', ['minimal', 'low', 'medium']),
  M('openai-codex', 'gpt-5.1-codex', 'GPT 5.1 Codex', ['low', 'medium', 'high'], true),
  M('openai', 'gpt-5.5', 'GPT 5.5', ['minimal', 'low', 'medium', 'high']),
  M('openai', 'gpt-5-mini', 'GPT 5 mini', ['minimal', 'low', 'medium']),
  M('openai', 'gpt-4.1', 'GPT 4.1', ['off'], true),
  M('anthropic', 'claude-opus-5-5', 'Opus 5.5', ['off', 'low', 'medium', 'high', 'max']),
  M('anthropic', 'claude-sonnet-5', 'Sonnet 5', ['off', 'low', 'medium', 'high']),
  M('anthropic', 'claude-haiku-4-5', 'Haiku 4.5', ['off', 'low']),
  M('anthropic', 'claude-sonnet-4-5', 'Sonnet 4.5', ['off', 'low', 'medium', 'high'], true),
  M('claude-bridge', 'claude-opus-5-5', 'Opus 5.5', ['off', 'low', 'medium', 'high', 'max']),
  M('claude-bridge', 'claude-sonnet-5', 'Sonnet 5', ['off', 'low', 'medium', 'high']),
  M('deepseek', 'deepseek-v4', 'DeepSeek V4', ['off', 'high']),
  M('deepseek', 'deepseek-r2', 'DeepSeek R2', ['high']),
];
const modelsOf = (p) => MODELS.filter((m) => m.p === p);
const find = (p, id) => MODELS.find((m) => m.p === p && m.id === id);

// Scenarios. Keys: state ok | off | rejected | quota; source own | site; a
// site copy is `current` while the site still stores the same key.
const K = (state, suffix, source = 'own', at = '3.10.', current = true) => ({ state, suffix, source, at, current });
const SCENARIOS = {
  ok: { label: 'Kaikki kunnossa',
    acc: { 'openai-codex': 'ok', 'claude-bridge': 'ok', openai: K('ok', '7Qx2'), anthropic: K('off'), deepseek: K('ok', 'm9Tz', 'own', '18.10.') },
    def: { p: 'claude-bridge', id: 'claude-sonnet-5', t: 'medium' } },
  err: { label: 'Virheitä',
    acc: { 'openai-codex': 'ok', 'claude-bridge': 'expired', openai: K('quota', '7Qx2'), anthropic: K('rejected', 'Lp4w', 'site', '2.10.', false), deepseek: K('off') },
    def: { p: 'anthropic', id: 'claude-sonnet-5', t: 'high' } },
  site: { label: 'Uusi henkilö, ylläpitäjän avain',
    acc: { 'openai-codex': 'off', 'claude-bridge': 'off', openai: K('off'), anthropic: K('ok', 'Hb7k', 'site', '24.10.'), deepseek: K('off') },
    def: { p: 'anthropic', id: 'claude-sonnet-5', t: 'medium' } },
};

// What a route can do now: ok, refused (present, provider says no) or none.
function routeState(p) {
  const a = S.acc[p];
  if (ROUTES[p].kind === 'sub') return a === 'ok' ? 'ok' : a === 'expired' ? 'refused' : 'none';
  return a.state === 'ok' ? 'ok' : a.state === 'off' ? 'none' : 'refused';
}
const company = (p) => COMPANY[ROUTES[p].company].name;
const GEN = { openai: 'OpenAI:n', anthropic: 'Anthropicin', deepseek: 'DeepSeekin' };
const companyGen = (p) => GEN[ROUTES[p].company];
function routeProblem(p) {
  const a = S.acc[p];
  if (p === 'claude-bridge' && a === 'expired') return 'Claude-kirjautumista ei ole vahvistettu, joten Claude-malleja ei tarjota.';
  if (p === 'openai-codex' && a === 'expired') return 'ChatGPT-kirjautuminen vanhentui.';
  if (ROUTES[p].kind !== 'key') return '';
  if (a.state === 'quota') return `${company(p)} ilmoitti kiintiön täyttyneen tänään klo 8.40. Avain on voimassa: lisää saldoa ${companyGen(p)} laskutuksesta tai käytä toista mallia.`;
  if (a.state === 'rejected' && a.source === 'site') return `Ylläpitäjä on vaihtanut palvelimen avaimen, ja ${company(p)} hylkää tämän vanhan kopion. Lisää oma avain tai pyydä ylläpitäjältä uusi.`;
  if (a.state === 'rejected') return `${company(p)} hylkäsi avaimen tänään klo 9.12. Avain on ehkä peruttu tai kirjoitettu väärin.`;
  return '';
}
function keyLine(p) {
  const a = S.acc[p];
  if (a.state === 'off') return 'Ei avainta';
  return `${p === 'anthropic' ? 'sk-ant-' : 'sk-'}…${a.suffix}`;
}
function keySource(p) {
  const a = S.acc[p];
  if (a.source !== 'site') return `Oma avain, lisätty ${a.at} ${company(p)} laskuttaa käytöstä.`;
  return a.current
    ? `Ylläpitäjän antama ${a.at} Käyttö laskutetaan palvelimen tililtä.`
    : `Ylläpitäjän antama ${a.at} Palvelin on sittemmin vaihtanut avaimensa.`;
}
const unlocks = (p) => modelsOf(p).filter((m) => !m.older);
const defModel = () => find(S.def.p, S.def.id);
const defOk = () => routeState(S.def.p) === 'ok';
const anyProblem = () => ORDER.some((p) => routeState(p) === 'refused') || !defOk();

const S = { v: 0, scenario: 'ok', page: 'tekoaly', detail: false, sub: null, filter: 'all',
  open: null, pick: 'openai-codex', form: null, dialog: null, status: '', flash: null, focus: null, saving: 0 };
function resetScenario() {
  const s = SCENARIOS[S.scenario];
  S.acc = JSON.parse(JSON.stringify(s.acc));
  S.def = { ...s.def };
  S.pick = S.def.p; S.open = null; S.form = null; S.dialog = null; S.status = ''; S.sub = null; S.filter = 'all';
}
resetScenario();

// ---- Shared pieces ---------------------------------------------------------

function st(state, label) {
  if (state === 'ok') return `<span class="st ok">${I.check}${label || 'Käytössä'}</span>`;
  if (state === 'refused') return `<span class="st err">${I.alert}${label || 'Vaatii toimia'}</span>`;
  if (state === 'warn') return `<span class="st warn">${I.info}${label}</span>`;
  return `<span class="st off">${I.dash}${label || 'Ei käytössä'}</span>`;
}
const badge = (text, tone = '') => `<span class="badge ${tone}">${esc(text)}</span>`;
function chips(p) {
  const st8 = routeState(p);
  return `<ul class="mchips${st8 === 'refused' ? ' refused' : ''}" aria-label="${esc(ROUTES[p].label)}: mallit">${unlocks(p).map((m) => `<li>${esc(m.name)}</li>`).join('')}</ul>`;
}
const defLabel = () => `${esc(defModel().name)} <span class="think">${I.think}${S.def.t[0].toUpperCase() + S.def.t.slice(1)}</span>`;

// Production ModelPicker, scope "default": provider tabs, radio rows, older
// models behind a disclosure, thinking levels in mono. The choice is saved at
// once and Pi confirms it in the background.
function modelPicker(ctx) {
  const tabs = ORDER.filter((p) => (p !== 'anthropic' && p !== 'deepseek') || p === S.pick || routeState(p) !== 'none');
  const seg = tabs.map((p) => {
    const off = !modelsOf(p).length || routeState(p) !== 'ok';
    return `<button type="button" data-act="tab" data-p="${p}" aria-pressed="${S.pick === p}"${off ? ' disabled' : ''}>${ROUTES[p].label}</button>`;
  }).join('');
  const claude = routeState('claude-bridge') !== 'ok'
    ? `<p class="md-note">Claude-tilaus ei ole käytettävissä: kirjautumista ei ole vahvistettu. <button class="inline" data-act="goto" data-row="claude-bridge">Claude-tilaus</button></p>` : '';
  const refused = routeState(S.pick) === 'refused';
  const row = (m) => {
    const id = `pk-${ctx}-${m.p}-${m.id}`.replace(/\./g, '_');
    const sel = S.def.p === m.p && S.def.id === m.id;
    return `<label class="md-row"><input type="radio" id="${id}" name="pk-${ctx}" data-act="model" data-p="${m.p}" data-id="${m.id}"${sel ? ' checked' : ''}${refused ? ' disabled' : ''}><span class="md-t">${esc(m.name)}</span>${refused ? '<span class="md-note">Ei käytettävissä</span>' : ''}</label>`;
  };
  const list = modelsOf(S.pick);
  const older = list.filter((m) => m.older);
  const cur = defModel();
  const think = LV.map((l) => `<button type="button" data-act="think" data-l="${l}" aria-pressed="${S.def.t === l && S.def.p === S.pick}"${S.def.p === S.pick && cur.levels.includes(l) ? '' : ' disabled'}>${l}</button>`).join('');
  return `<div class="md-pick">
<div class="seg md-prov" role="group" aria-label="Palveluntarjoaja">${seg}</div>${claude}
${refused ? `<p class="md-note bad" role="alert">${esc(routeProblem(S.pick))}</p>` : ''}
<div class="md-rows">${list.filter((m) => !m.older).map(row).join('')}</div>
${older.length ? `<details class="md-more"${older.some((m) => m.p === S.def.p && m.id === S.def.id) ? ' open' : ''}><summary>Vanhemmat mallit (${older.length})</summary><div class="md-rows">${older.map(row).join('')}</div></details>` : ''}
<div class="md-think"><span>Ajattelutaso</span><div class="seg md-seg" role="group" aria-label="Ajattelutaso">${think}</div></div>
<p class="md-note">Tallentuu Pi:n omaan oletukseen (~/.pi/agent/settings.json), joten sama malli on käytössä myös SSH:lla. Avoimet keskustelut eivät vaihdu.</p>
<p class="md-note" role="status" id="save-state">${esc(S.saving ? 'Agentti vahvistaa valintaa…' : S.status.startsWith('Valinta') ? S.status : '')}</p></div>`;
}

// The default's own trouble: shown on the default row in every variant.
function defProblem() {
  if (defOk()) return '';
  const r = ROUTES[S.def.p];
  return `${esc(defModel().name)} (${esc(r.label)}) ei nyt vastaa. ${esc(routeProblem(S.def.p))} Uusi keskustelu kysyy mallin, kunnes valitset toisen oletuksen tai korjaat ${r.kind === 'key' ? 'avaimen' : 'kirjautumisen'}.`;
}

// Key form: production's literal-key rule, with a pre-save check proposed.
const literalKey = /^sk-[A-Za-z0-9_-]{20,200}$/;
const keyFits = (p, k) => literalKey.test(k) && (p === 'anthropic' ? k.startsWith('sk-ant-') : !k.startsWith('sk-ant-'));
const SAMPLE = (p, bad) => (p === 'anthropic' ? 'sk-ant-' : 'sk-') + (bad ? 'EI-OIKEA-hylatty-esimerkki-0002' : 'EI-OIKEA-esimerkkiavain-0001');
function keyForm(p, opts = {}) {
  const f = S.form;
  const a = S.acc[p];
  const replacing = a.state !== 'off';
  const wrong = f.value && !keyFits(p, f.value);
  const hint = wrong ? `Tämä ei näytä ${company(p)}-avaimelta (alkaa ${p === 'anthropic' ? 'sk-ant-' : 'sk-'}).`
    : `Avain tallentuu vain omalle käyttäjällesi eikä sitä näytetä uudelleen. ${company(p)} laskuttaa käytöstä.`;
  const after = replacing
    ? (a.source === 'site' ? `Oma avaimesi korvaa ylläpitäjän antaman kopion (${keyLine(p)}). Käyttö laskutetaan sen jälkeen sinulta.` : `Uusi avain korvaa nykyisen (${keyLine(p)}).`)
    : `Palvelun ensimmäinen avain vaihtaa uusien keskustelujen oletukseksi sen mallin; avoimet keskustelut eivät muutu.`;
  return `<form class="kf" data-form="${p}" novalidate>
${opts.title === false ? '' : `<strong class="kf-title">${replacing ? 'Uusi ' : ''}${company(p)} API-avain</strong>`}
<label class="kf-field"><span class="sr">${company(p)} API-avain</span><input id="kf-input" type="password" autocomplete="off" spellcheck="false" maxlength="203" placeholder="${p === 'anthropic' ? 'sk-ant-…' : 'sk-…'}" value="${esc(f.value)}"${wrong ? ' aria-invalid="true"' : ''}></label>
<p class="kf-hint${wrong ? ' bad' : ''}" id="kf-hint"${wrong ? ' role="alert"' : ''}>${esc(hint)}</p>
${f.err ? `<p class="kf-err" role="alert">${I.alert}<span>${esc(f.err)}</span></p>` : ''}
<p class="s-desc">${esc(after)}</p>
<div class="kf-lab" aria-label="Prototyyppi"><span>Prototyyppi:</span><button type="button" class="inline" data-act="sample" data-p="${p}">täytä esimerkkiavain</button><button type="button" class="inline" data-act="sample-bad" data-p="${p}">täytä avain, jonka ${company(p)} hylkää</button></div>
<div class="kf-actions"><button type="button" class="btn" data-act="form-cancel">Peruuta</button><button type="submit" class="btn primary" id="kf-save"${keyFits(p, f.value) ? '' : ' disabled'}>${f.checking ? 'Tarkistetaan…' : 'Tarkista ja tallenna'}</button></div></form>`;
}
function removeDialog() {
  const p = S.dialog.p;
  const a = S.acc[p];
  const defNote = S.def.p === p ? ` Oletusmalli ${defModel().name} käyttää tätä avainta, joten uusi keskustelu kysyy sen jälkeen mallin.` : '';
  return `<div class="scrim" data-act="dialog-close"></div><div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-title"><h2 id="dlg-title" tabindex="-1">Poistetaanko API-avain?</h2>
<p>${a.source === 'site' ? 'Ylläpitäjän antama kopio poistuu' : 'Avain poistuu'} vain Pi:n tunnuksista tällä palvelimella. Avainta ei peruta palvelussa ${company(p)}. Avainta käyttävät keskustelut eivät voi jatkaa ennen uuden avaimen lisäämistä. Tilauskirjautumiset säilyvät.${esc(defNote)}</p>
<div class="dlg-actions"><button class="btn" data-act="dialog-close">Peruuta</button><button class="btn danger-soft" data-act="remove" data-p="${p}">Poista avain</button></div></div>`;
}
// Variant 2's add-key dialog: provider first, then the key.
function addDialog() {
  const p = S.form?.p;
  const opts = KEYS.map((k) => {
    const a = S.acc[k];
    const note = a.state === 'off' ? `${unlocks(k).length} mallia` : a.source === 'site' ? `korvaa ylläpitäjän avaimen ${keyLine(k)}` : `korvaa avaimen ${keyLine(k)}`;
    return `<button type="button" class="prov-opt" data-act="dlg-prov" data-p="${k}" aria-pressed="${p === k}">${mark(ROUTES[k].mark, ROUTES[k].tone)}<span class="s-lbl"><strong>${company(k)}</strong><span class="s-desc">${esc(note)}</span></span></button>`;
  }).join('');
  return `<div class="scrim" data-act="dialog-close"></div><div class="dlg wide" role="dialog" aria-modal="true" aria-labelledby="dlg-title"><h2 id="dlg-title" tabindex="-1">Lisää API-avain</h2>
<p class="s-desc">Avaimella voi käyttää palveluntarjoajan malleja ilman tilausta. Kullekin palvelulle tallentuu yksi avain.</p>
<div class="prov-opts" role="group" aria-label="Palveluntarjoaja">${opts}</div>
${p ? `<div class="dlg-unlock"><span class="s-desc">Avaa mallit:</span>${chips(p)}</div>${keyForm(p, { title: false })}` : '<div class="kf-actions"><button type="button" class="btn" data-act="dialog-close">Peruuta</button></div>'}</div>`;
}

// ---- Variant 1 · Paikallaan: providers own their routes; all in place ----

function v1() {
  const open = S.open === 'default';
  const problem = defProblem();
  const r = ROUTES[S.def.p];
  const defRow = `<div class="s-row def-row${S.flash === 'default' ? ' flash' : ''}" id="row-default" tabindex="-1">${mark(r.mark, r.tone)}
<div class="s-lbl"><strong>Oletusmalli</strong><span class="def-now">${defLabel()} <span class="s-desc">· ${esc(r.label)}</span></span>${problem ? `<span class="s-desc bad">${problem}</span>` : '<span class="s-desc">Uudet keskustelut alkavat tällä mallilla.</span>'}</div>
<div class="s-val"><button class="btn${problem && !open ? ' primary' : ''}" data-act="toggle" data-id="default" id="def-trigger" aria-expanded="${open}" aria-controls="def-panel">${open ? 'Valmis' : problem ? 'Valitse toinen' : 'Vaihda'}${open ? '' : I.down}</button></div>
${open ? `<div class="s-more inplace" id="def-panel">${modelPicker('v1')}${relation()}</div>` : ''}</div>`;
  const work = `<div class="s-row plain"><div class="s-lbl"><strong>Agentin työ</strong><span class="s-desc">Ajattelu ja työkalut keskustelussa oletuksena.</span></div><div class="s-val"><div class="seg" role="group" aria-label="Agentin työ"><button aria-pressed="true" data-act="seg">Piilossa</button><button aria-pressed="false" data-act="seg">Näkyvissä</button></div></div></div>`;
  const companies = Object.entries(COMPANY).map(([c, info]) => {
    const isOpen = S.open === c || (S.form && ROUTES[S.form.p].company === c);
    const states = info.routes.map(routeState);
    const worst = states.includes('refused') ? 'refused' : states.includes('ok') ? 'ok' : 'none';
    const count = info.routes.filter((p) => routeState(p) === 'ok').reduce((n, p) => n + unlocks(p).length, 0);
    const summary = info.routes.map((p) => {
      const s = routeState(p);
      if (ROUTES[p].kind === 'sub') return `${ROUTES[p].label}: ${s === 'ok' ? 'kirjautunut' : s === 'refused' ? 'vanhentunut' : 'ei'}`;
      const a = S.acc[p];
      return `API-avain: ${a.state === 'off' ? 'ei' : `${keyLine(p)}${a.source === 'site' ? ', ylläpitäjän antama' : ''}`}`;
    }).join(' · ');
    const routes = info.routes.map((p) => v1Route(p)).join('');
    return `<div class="s-row prov${worst === 'refused' ? ' has-err' : ''}" id="row-co-${c}" data-company="${c}" tabindex="-1">${mark(info.mark, info.tone)}
<div class="s-lbl"><strong>${info.name}</strong><span class="s-desc">${esc(summary)}</span></div>
<div class="s-val">${st(worst, worst === 'ok' ? `${count} mallia` : worst === 'refused' ? 'Vaatii toimia' : 'Ei käytössä')}<button class="btn" data-act="toggle" data-id="${c}" aria-expanded="${!!isOpen}">${isOpen ? 'Sulje' : worst === 'none' ? 'Ota käyttöön' : 'Hallitse'}</button></div>
${isOpen ? `<div class="s-more routes">${routes}</div>` : ''}</div>`;
  }).join('');
  return `<p class="s-intro">Mallit, joita agentit käyttävät, ja tilaukset tai avaimet, joilla ne saadaan.</p>
<h3 class="s-h3">Oletus</h3><div class="s-card">${defRow}${work}</div>
<h3 class="s-h3">Palveluntarjoajat</h3><div class="s-card">${companies}</div>
<p class="s-foot">Tilaus ja API-avain ovat Pi:lle eri reittejä samoihin malleihin: tilaus laskutetaan kuukausimaksussa, avain käytön mukaan.</p>`;
}
function v1Route(p) {
  const r = ROUTES[p];
  const s = routeState(p);
  const prob = routeProblem(p);
  let head, actions = '', extra = '';
  if (r.kind === 'sub') {
    head = `<strong>${r.label}</strong><span class="s-desc${prob ? ' bad' : ''}">${prob || (s === 'ok' ? 'Kirjautunut. Käyttö kuuluu tilaukseesi.' : 'Kirjaudu tilillä, niin sen mallit tulevat mallivalitsimeen.')}</span>`;
    actions = `<button class="btn${s === 'refused' ? ' primary' : ''}" data-act="signin" data-p="${p}">${s === 'ok' ? 'Kirjaudu uudelleen' : 'Kirjaudu'}</button>`;
  } else {
    const a = S.acc[p];
    head = `<strong>API-avain ${a.state !== 'off' ? `<code>${keyLine(p)}</code>` : ''} ${a.source === 'site' && a.state !== 'off' ? badge('Ylläpitäjän antama', a.current ? 'info' : 'warn') : ''}</strong><span class="s-desc${prob ? ' bad' : ''}">${prob ? esc(prob) : a.state === 'off' ? `Avaimella saat ${companyGen(p)} mallit ilman tilausta. ${company(p)} laskuttaa käytöstä.` : esc(keySource(p))}</span>`;
    if (!(S.form && S.form.p === p)) {
      actions = a.state === 'off' ? `<button class="btn" data-act="add" data-p="${p}">Lisää avain</button>`
        : `<button class="btn${prob ? ' primary' : ''}" data-act="add" data-p="${p}">${a.source === 'site' ? 'Vaihda omaan…' : 'Vaihda…'}</button><button class="btn quiet" data-act="ask-remove" data-p="${p}">Poista…</button>`;
    } else extra = keyForm(p);
  }
  return `<div class="route-row${S.flash === p ? ' flash' : ''}" id="row-${p}" data-route="${p}" data-state="${s}" tabindex="-1">${mark(r.mark, r.tone, true)}<div class="s-lbl">${head}</div>${st(s, s === 'ok' ? 'Käytössä' : s === 'refused' ? (r.kind === 'key' && S.acc[p].state === 'quota' ? 'Kiintiö täynnä' : r.kind === 'key' ? 'Hylätty' : 'Vanhentunut') : 'Ei')}
<div class="route-act">${actions}</div><div class="route-models"><span class="s-desc">${s === 'none' ? 'Avaisi' : 'Avaa'} ${unlocks(p).length} mallia:</span>${chips(p)}</div>${extra}</div>`;
}
const relation = () => `<div class="relation" aria-label="Oletuksen ja keskustelun malli"><p><strong>Oletus</strong> koskee uusia keskusteluja. Kirjoituskentän mallivalitsimella voit aloittaa yksittäisen keskustelun toisella mallilla muuttamatta oletusta.</p><p><strong>Keskustelu pitää mallinsa.</strong> Kun oletus vaihtuu, avoimet keskustelut jatkavat omalla mallillaan.</p></div>`;

// ---- Variant 2 · Ponnahdus: the composer's picker; keys as a list --------

function v2() {
  const problem = defProblem();
  const r = ROUTES[S.def.p];
  const open = S.open === 'default';
  const def = `<div class="s-row def2${S.flash === 'default' ? ' flash' : ''}" id="row-default" tabindex="-1"><div class="s-lbl"><strong>Oletusmalli</strong>${problem ? `<span class="s-desc bad">${problem}</span>` : `<span class="s-desc">Uudet keskustelut alkavat tällä. Sama valitsin on kirjoituskentässä keskustelukohtaisesti.</span>`}</div>
<div class="s-val pop-anchor"><button class="pill${problem ? ' bad' : ''}" data-act="toggle" data-id="default" id="def-trigger" aria-expanded="${open}" aria-haspopup="dialog">${mark(r.mark, r.tone, true)}${defLabel()}${I.down}</button>
${open ? `<div class="scrim sheet-scrim" data-act="close-pop"></div><div class="pop" role="dialog" aria-label="Oletusmalli" id="def-panel"><div class="pop-head"><strong>Oletusmalli</strong><button class="btn quiet icon" data-act="close-pop" aria-label="Sulje">${I.x}</button></div>${modelPicker('v2')}<p class="md-note pop-rel">Tämä on uusien keskustelujen oletus. Yksittäisen keskustelun mallin valitset kirjoituskentästä; keskustelu pitää mallinsa.</p></div>` : ''}</div></div>
<div class="s-row plain"><div class="s-lbl"><strong>Agentin työ</strong><span class="s-desc">Ajattelu ja työkalut keskustelussa oletuksena.</span></div><div class="s-val"><div class="seg" role="group" aria-label="Agentin työ"><button aria-pressed="true" data-act="seg">Piilossa</button><button aria-pressed="false" data-act="seg">Näkyvissä</button></div></div></div>`;
  const subs = ['openai-codex', 'claude-bridge'].map((p) => {
    const s = routeState(p);
    const ro = ROUTES[p];
    const prob = routeProblem(p);
    return `<div class="s-row${S.flash === p ? ' flash' : ''}" id="row-${p}" data-route="${p}" data-state="${s}" tabindex="-1">${mark(ro.mark, ro.tone)}<div class="s-lbl"><strong>${ro.label}</strong><span class="s-desc${prob ? ' bad' : ''}">${prob || (s === 'ok' ? `Kirjautunut. ${unlocks(p).length} mallia: ${unlocks(p).map((m) => m.name).join(', ')}.` : 'Kirjaudu tilillä, niin sen mallit tulevat mallivalitsimeen.')}</span></div>
<div class="s-val">${st(s, s === 'ok' ? 'Kirjautunut' : s === 'refused' ? 'Vaatii toimia' : 'Ei kirjautunut')}<button class="btn${s === 'refused' ? ' primary' : ''}" data-act="signin" data-p="${p}">${s === 'ok' ? 'Hallitse' : s === 'refused' ? 'Kirjaudu uudelleen' : 'Kirjaudu'}</button></div></div>`;
  }).join('');
  const present = KEYS.filter((p) => S.acc[p].state !== 'off');
  const keys = present.map((p) => {
    const a = S.acc[p];
    const ro = ROUTES[p];
    const s = routeState(p);
    const prob = routeProblem(p);
    return `<div class="s-row key${S.flash === p ? ' flash' : ''}" id="row-${p}" data-route="${p}" data-state="${s}" tabindex="-1">${mark(ro.mark, ro.tone)}
<div class="s-lbl"><strong>${company(p)} <code>${keyLine(p)}</code> ${a.source === 'site' ? badge('Ylläpitäjän antama', a.current ? 'info' : 'warn') : badge('Oma')}</strong><span class="s-desc${prob ? ' bad' : ''}">${esc(prob || keySource(p))}</span></div>
<div class="s-val">${st(s, s === 'ok' ? 'Toimii' : a.state === 'quota' ? 'Kiintiö täynnä' : 'Hylätty')}<button class="btn${prob ? ' primary' : ''}" data-act="dlg-add" data-p="${p}">${a.source === 'site' ? 'Vaihda omaan…' : 'Vaihda…'}</button><button class="btn quiet" data-act="ask-remove" data-p="${p}">Poista…</button></div>
<div class="s-more key-models"><span class="s-desc">Avaa:</span>${chips(p)}</div></div>`;
  }).join('');
  const missing = KEYS.filter((p) => S.acc[p].state === 'off').map((p) => company(p));
  const add = `<div class="s-row plain add-row"><p class="s-desc">${present.length ? `Ei avainta: ${missing.join(', ') || '–'}.` : 'Ei API-avaimia. Avaimella voi käyttää malleja ilman tilausta; palveluntarjoaja laskuttaa käytöstä.'}</p><div class="s-val"><button class="btn" data-act="dlg-add" id="add-key"${missing.length ? '' : ' disabled'}>${I.plus}Lisää API-avain</button></div></div>`;
  return `<p class="s-intro">Mallit, joita agentit käyttävät, ja tilaukset tai avaimet, joilla ne saadaan.</p>
<div class="s-card">${def}</div>
<h3 class="s-h3">Tilaukset</h3><div class="s-card">${subs}</div>
<h3 class="s-h3">API-avaimet <span class="count">${present.length}</span></h3><div class="s-card">${keys}${add}</div>`;
}

// ---- Variant 3 · Mallit edellä: models first, routes explain them ---------

function v3() {
  const problem = defProblem();
  const r = ROUTES[S.def.p];
  const hero = `<button class="hero${problem ? ' bad' : ''}${S.flash === 'default' ? ' flash' : ''}" data-act="models" id="row-default"><span class="hero-k">Oletusmalli</span><span class="hero-m">${defLabel()}</span><span class="hero-r">${mark(r.mark, r.tone, true)}${esc(r.label)}</span>${problem ? `<span class="s-desc bad">${problem}</span>` : ''}<span class="hero-go">Kaikki mallit ${I.chev}</span></button>`;
  const flow = `<ol class="flow" aria-label="Mistä keskustelu saa mallinsa"><li><strong>Oletus</strong><span>Tämä sivu. Tallentuu Pi:hin, joten sama myös SSH:lla.</span></li><li><strong>Uusi keskustelu</strong><span>Alkaa oletuksella; kirjoituskentän valitsimella voit valita toisen.</span></li><li><strong>Keskustelu pitää mallinsa</strong><span>Oletuksen vaihto ei muuta avoimia keskusteluja.</span></li></ol>`;
  const routes = ORDER.map((p) => {
    const ro = ROUTES[p];
    const s = routeState(p);
    const prob = routeProblem(p);
    const a = S.acc[p];
    const isKey = ro.kind === 'key';
    let what;
    if (isKey) what = a.state === 'off' ? `Ei avainta. ${company(p)} laskuttaa käytöstä.` : `${keyLine(p)} · ${keySource(p)}`;
    else what = s === 'ok' ? 'Kirjautunut. Käyttö kuuluu tilaukseesi.' : s === 'refused' ? '' : 'Ei kirjautunut.';
    let actions;
    if (S.form && S.form.p === p) actions = '';
    else if (isKey) actions = a.state === 'off' ? `<button class="btn" data-act="add" data-p="${p}">Lisää avain</button>` : `<button class="btn${prob ? ' primary' : ''}" data-act="add" data-p="${p}">${a.source === 'site' ? 'Vaihda omaan…' : 'Vaihda…'}</button><button class="btn quiet" data-act="ask-remove" data-p="${p}">Poista…</button>`;
    else actions = `<button class="btn${s === 'refused' ? ' primary' : ''}" data-act="signin" data-p="${p}">${s === 'ok' ? 'Kirjaudu uudelleen' : 'Kirjaudu'}</button>`;
    const n = unlocks(p).length;
    return `<div class="s-row r3${S.flash === p ? ' flash' : ''}" id="row-${p}" data-route="${p}" data-state="${s}" tabindex="-1">${mark(ro.mark, ro.tone)}
<div class="s-lbl"><strong>${ro.label} ${isKey && a.source === 'site' && a.state !== 'off' ? badge('Ylläpitäjän antama', a.current ? 'info' : 'warn') : ''}</strong><span class="s-desc${prob ? ' bad' : ''}">${esc(prob || what)}</span><button class="inline r3-n" data-act="models" data-filter="${p}">${s === 'none' ? `Avaisi ${n} mallia` : s === 'refused' ? `${n} mallia ei nyt käytettävissä` : `Avaa ${n} mallia`} ›</button></div>
<div class="s-val">${st(s, s === 'ok' ? 'Käytössä' : s === 'refused' ? (isKey && a.state === 'quota' ? 'Kiintiö täynnä' : isKey ? 'Hylätty' : 'Vanhentunut') : 'Ei')}${actions}</div>${S.form && S.form.p === p ? `<div class="s-more">${keyForm(p)}</div>` : ''}</div>`;
  }).join('');
  return `<p class="s-intro">Mallit, joita agentit käyttävät, ja tilaukset tai avaimet, joilla ne saadaan.</p>
${hero}${flow}
<h3 class="s-h3">Pääsy malleihin</h3><div class="s-card">${routes}</div>
<div class="s-card"><div class="s-row plain"><div class="s-lbl"><strong>Agentin työ</strong><span class="s-desc">Ajattelu ja työkalut keskustelussa oletuksena.</span></div><div class="s-val"><div class="seg" role="group" aria-label="Agentin työ"><button aria-pressed="true" data-act="seg">Piilossa</button><button aria-pressed="false" data-act="seg">Näkyvissä</button></div></div></div></div>`;
}
// Tekoäly › Mallit: one row per model; each route that offers it is a choice.
function v3Models() {
  const names = [...new Set(MODELS.map((m) => m.name))];
  const shown = names.filter((n) => S.filter === 'all' || MODELS.some((m) => m.name === n && m.p === S.filter));
  const row = (n) => {
    const offers = MODELS.filter((m) => m.name === n);
    const isDef = offers.some((m) => m.p === S.def.p && m.id === S.def.id);
    const pills = offers.map((m) => {
      const s = routeState(m.p);
      const ro = ROUTES[m.p];
      const pressed = m.p === S.def.p && m.id === S.def.id;
      if (s === 'none') return `<button class="rp locked" data-act="unlock" data-p="${m.p}" title="${esc(ro.label)}: ei käytössä">${mark(ro.mark, ro.tone, true)}${ro.kind === 'key' ? `Lisää ${company(m.p)}-avain` : `Kirjaudu: ${ro.short}`}</button>`;
      if (s === 'refused') return `<button class="rp refused" disabled title="${esc(routeProblem(m.p))}">${mark(ro.mark, ro.tone, true)}${esc(ro.short)} · ${ro.kind === 'key' && S.acc[m.p].state === 'quota' ? 'kiintiö täynnä' : ro.kind === 'key' ? 'avain hylätty' : 'vanhentunut'}</button>`;
      return `<button class="rp" data-act="pick3" data-p="${m.p}" data-id="${m.id}" id="rp-${m.p}-${m.id.replace(/\./g, '_')}" aria-pressed="${pressed}">${mark(ro.mark, ro.tone, true)}${esc(ro.short)}${pressed ? ' · oletus' : ''}</button>`;
    }).join('');
    return `<div class="m3${isDef ? ' is-def' : ''}"><div class="m3-name"><strong>${esc(n)}</strong>${isDef ? badge('Oletus', 'info') : ''}</div><div class="m3-routes" role="group" aria-label="${esc(n)}: reitit">${pills}</div></div>`;
  };
  const cur = shown.filter((n) => !MODELS.find((m) => m.name === n).older);
  const old = shown.filter((n) => MODELS.find((m) => m.name === n).older);
  const filters = ['all', ...ORDER].map((f) => `<button class="chip${S.filter === f ? ' on' : ''}" data-act="filter" data-filter="${f}" aria-pressed="${S.filter === f}">${f === 'all' ? 'Kaikki' : mark(ROUTES[f].mark, ROUTES[f].tone, true) + ROUTES[f].short}</button>`).join('');
  const cm = defModel();
  const think = LV.map((l) => `<button type="button" data-act="think" data-l="${l}" aria-pressed="${S.def.t === l}"${cm.levels.includes(l) ? '' : ' disabled'}>${l}</button>`).join('');
  return `<p class="s-intro">Kaikki mallit, joihin Pi pääsee. Sama malli voi tulla tilauksen tai API-avaimen kautta; valitse reitti, jolla oletus ajetaan.</p>
<div class="filters" role="group" aria-label="Näytä reitin mallit">${filters}</div>
${problemBanner()}
<div class="s-card m3-list">${cur.map(row).join('') || '<div class="m3"><span class="s-desc">Tällä reitillä ei ole malleja.</span></div>'}</div>
${old.length ? `<details class="md-more"><summary>Vanhemmat mallit (${old.length})</summary><div class="s-card m3-list">${old.map(row).join('')}</div></details>` : ''}
<div class="m3-foot"><div class="md-think"><span>Ajattelutaso · ${esc(cm.name)}</span><div class="seg md-seg" role="group" aria-label="Ajattelutaso">${think}</div></div>
<p class="md-note" role="status" id="save-state">${esc(S.saving ? 'Agentti vahvistaa valintaa…' : S.status.startsWith('Valinta') ? S.status : 'Valinta tallentuu Pi:n oletukseen heti. Avoimet keskustelut eivät vaihdu.')}</p></div>`;
}
const problemBanner = () => (defOk() ? '' : `<div class="warn" role="note">${I.alert}<div>${defProblem()}</div></div>`);

// ---- Shell -----------------------------------------------------------------

const NAV = [['tili', 'Tili', 'user'], ['laitteet', 'Laitteet', 'devices'], ['tekoaly', 'Tekoäly', 'agent'], ['koodi', 'Koodipalvelut', 'code'], ['tiedot', 'Tiedot agenteille', 'plug'], ['ulkoasu', 'Ulkoasu', 'eye'], ['editori', 'Editori', 'editor'], ['tila', 'Tallennustila', 'disk']];
const ADMIN = [['palvelin', 'Palvelin', 'server'], ['palvelinintegraatiot', 'Palvelinintegraatiot', 'plug'], ['aiavain', 'AI-avain', 'key'], ['kayttoonotto', 'Käyttöönotto', 'steer'], ['kayttajat', 'Käyttäjät ja pääsy', 'users'], ['levy', 'Levytila', 'disk']];
function nav() {
  const item = ([id, label, icon]) => `<button class="s-nav-i" data-act="nav" data-page="${id}"${id === S.page ? ' aria-current="page"' : ''}>${I[icon]}${label}${id === 'tekoaly' && anyProblem() ? '<span class="alert"></span><span class="sr">, vaatii toimia</span>' : ''}</button>`;
  return `<nav class="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>${NAV.map(item).join('')}<span class="s-nav-h">Palvelimen ylläpito</span>${ADMIN.map(item).join('')}</nav>`;
}
function code() {
  const rows = [
    ['GH', 0, 'GitHub', 'Kirjautunut käyttäjänä aino-demo. Git ja gh toimivat työtiloissa.'],
    ['Gt', 3, 'Gitea', 'git.kotiverkko.example · käyttäjä aino. Repot näkyvät uuden työtilan listassa.'],
  ].map(([m, t, n, d]) => `<div class="s-row">${mark(m, t)}<div class="s-lbl"><strong>${n}</strong><span class="s-desc">${d}</span></div><div class="s-val">${st('ok', 'Yhdistetty')}<button class="btn" data-act="noop">Hallitse</button></div></div>`).join('');
  const ws = [['saaasema', 'aino-demo/saaasema', 'GH', 0], ['kirjasto-ui', 'aino-demo/kirjasto-ui', 'GH', 0], ['puutarha-anturit', 'kotiverkko/puutarha-anturit', 'Gt', 3]]
    .map(([n, r, m, t]) => `<div class="ws">${I.folder}<strong>${n}</strong>${mark(m, t, true)}<span class="s-desc"><code>${r}</code></span></div>`).join('');
  return `<p class="s-intro">Palvelut, joista työtilat kloonataan ja joihin agentit pushaavat.</p><div class="s-card">${rows}</div><h3 class="s-h3">Tuodut työtilat <span class="count">3</span></h3><div class="s-card">${ws}</div><p class="s-foot">Sama kuin kierroksella 1; tekoälypalvelut käyttävät nyt samoja kirjainmerkkejä.</p>`;
}
function main() {
  const label = [...NAV, ...ADMIN].find(([id]) => id === S.page)[1];
  let body, title = label, back = '← Asetukset', backTo = 'list', crumb = '';
  if (S.page === 'tekoaly' && S.v === 2 && S.sub === 'models') {
    title = 'Mallit'; back = '← Tekoäly'; backTo = 'tekoaly';
    crumb = `<p class="s-crumb"><button class="inline" data-act="back" data-to="tekoaly">Tekoäly</button> ${I.chev.replace('<svg', '<svg width="12" height="12"')} Mallit</p>`;
    body = v3Models();
  } else if (S.page === 'tekoaly') body = [v1, v2, v3][S.v]();
  else if (S.page === 'koodi') body = code();
  else body = `<div class="s-card"><div class="s-row plain"><p class="s-desc">Tämä osio ei muutu tällä kierroksella. Kokeile Tekoäly-sivua.</p></div></div>`;
  return `<div class="s-main"><button class="btn quiet s-back" data-act="back" data-to="${backTo}">${back}</button>${crumb}<h2 id="section-title" tabindex="-1">${esc(title)}</h2>${body}<p class="s-status" role="status" id="status">${esc(S.status.startsWith('Valinta') ? '' : S.status)}</p></div>`;
}
function renderApp() {
  const dlg = S.dialog?.kind === 'remove' ? removeDialog() : S.dialog?.kind === 'add' ? addDialog() : '';
  return `<div class="s-page${S.detail ? ' detail' : ''}${S.open === 'default' && S.v === 1 ? ' popped' : ''}" data-variant="${S.v + 1}">${nav()}${main()}</div>${dlg ? `<div class="dlg-layer">${dlg}</div>` : ''}`;
}

const stageEl = () => document.getElementById('stage');
function rerender() {
  const scrollY = window.scrollY;
  stageEl().innerHTML = renderApp();
  const target = S.focus;
  S.focus = null;
  if (S.flash) {
    const el = document.getElementById('row-' + S.flash);
    el?.scrollIntoView({ block: 'center' });
    S.flash = null; // the class lives until the next render
  } else if (!target || target !== 'section-title') window.scrollTo(0, scrollY);
  if (target) document.getElementById(target)?.focus({ preventScroll: target !== 'section-title' });
}
function choose(p, id, focus) {
  const m = find(p, id);
  const t = m.levels.includes(S.def.t) ? S.def.t : m.levels[0];
  S.def = { p, id, t };
  S.saving += 1;
  S.status = '';
  S.focus = focus;
  rerender();
  setTimeout(() => {
    S.saving -= 1;
    if (!S.saving) { S.status = `Valinta vahvistettu: ${m.name} · ${ROUTES[p].label}.`; const f = document.activeElement?.id; S.focus = f; rerender(); }
  }, 450);
}
function save(p) {
  const f = S.form;
  if (!keyFits(p, f.value)) return;
  if (/hylatty/i.test(f.value)) {
    f.err = `${company(p)} hylkäsi avaimen tarkistuksessa. Avainta ei tallennettu; ${S.acc[p].state === 'off' ? 'tunnuksesi pysyivät ennallaan' : `nykyinen ${keyLine(p)} on yhä käytössä`}.`;
    f.value = '';
    S.focus = 'kf-input';
    rerender();
    return;
  }
  const first = S.acc[p].state === 'off';
  S.acc[p] = K('ok', f.value.slice(-4), 'own', '25.10.');
  S.form = null; S.dialog = null;
  let note = '';
  if (first || S.def.p === p) {
    if (first) { const m = unlocks(p)[0]; S.def = { p, id: m.id, t: m.levels.includes(S.def.t) ? S.def.t : m.levels[0] }; note = ` Oletusmalliksi vaihtui ${m.name}.`; }
  }
  S.status = `Simuloitu: ${company(p)}-avain ${keyLine(p)} tallennettu ja tarkistettu. ${unlocks(p).length} mallia käytettävissä.${note}`;
  S.flash = p; S.focus = 'row-' + p;
  if (S.v === 0) S.open = ROUTES[p].company;
  rerender();
}
function onClick(e) {
  if (S.open === 'default' && S.v === 1 && !e.target.closest('.pop, #def-trigger')) {
    S.open = null; S.focus = 'def-trigger'; rerender();
    if (!e.target.closest('[data-act]') || e.target.closest('[data-act="close-pop"]')) return;
  }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const p = el.dataset.p;
  switch (el.dataset.act) {
    case 'nav': S.page = el.dataset.page; S.detail = true; S.sub = null; S.open = null; S.form = null; S.status = ''; S.focus = 'section-title'; break;
    case 'back': if (el.dataset.to === 'tekoaly') { S.sub = null; S.flash = 'default'; S.focus = 'section-title'; } else { S.detail = false; S.focus = null; } S.status = ''; break;
    case 'toggle': S.open = S.open === el.dataset.id ? null : el.dataset.id; if (el.dataset.id === 'default') { S.pick = S.def.p; S.status = ''; } if (S.form && S.open !== ROUTES[S.form.p].company) S.form = null; S.focus = S.open === 'default' && S.v === 1 ? `pk-v2-${S.def.p}-${S.def.id}`.replace(/\./g, '_') : el.id || null; if (!S.focus) S.focus = COMPANY[el.dataset.id] ? `row-co-${el.dataset.id}` : `row-${el.dataset.id}`; break;
    case 'close-pop': S.open = null; S.focus = 'def-trigger'; break;
    case 'tab': S.pick = p; S.focus = null; break;
    case 'think': if (S.def.t === el.dataset.l) return; S.def.t = el.dataset.l; S.saving += 1; S.status = ''; rerender(); setTimeout(() => { S.saving -= 1; if (!S.saving) { S.status = 'Valinta vahvistettu.'; rerender(); } }, 450); return;
    case 'goto': S.open = S.v === 0 ? ROUTES[el.dataset.row].company : null; S.flash = el.dataset.row; S.focus = 'row-' + el.dataset.row; break;
    case 'signin': S.acc[p] = 'ok'; S.status = `Simuloitu: ${ROUTES[p].label} kirjautunut. Oikeassa sovelluksessa kirjautuminen avautuu dialogiin.`; S.focus = 'row-' + p; break;
    case 'add': S.form = { p, value: '', err: '' }; S.focus = 'kf-input'; S.status = ''; break;
    case 'dlg-add': S.dialog = { kind: 'add', from: el.id || `row-${p}` }; S.form = p ? { p, value: '', err: '' } : null; S.focus = p ? 'kf-input' : 'dlg-title'; S.status = ''; break;
    case 'dlg-prov': S.form = { p, value: '', err: '' }; S.focus = 'kf-input'; break;
    case 'form-cancel': if (S.dialog) { S.focus = S.dialog.from; S.dialog = null; } else S.focus = 'row-' + S.form.p; S.form = null; break;
    case 'sample': case 'sample-bad': S.form.value = SAMPLE(p, el.dataset.act === 'sample-bad'); S.form.err = ''; S.focus = 'kf-save'; break;
    case 'ask-remove': S.dialog = { kind: 'remove', p, from: `row-${p}` }; S.focus = 'dlg-title'; break;
    case 'dialog-close': S.focus = S.dialog?.from; S.dialog = null; S.form = S.v === 1 ? null : S.form; break;
    case 'remove': S.acc[p] = K('off'); S.dialog = null; S.status = `Simuloitu: ${company(p)}-avain poistettu tältä palvelimelta.`; S.focus = S.v === 0 ? 'row-co-' + ROUTES[p].company : S.v === 1 ? 'add-key' : 'row-' + p; break;
    case 'models': S.sub = 'models'; S.filter = el.dataset.filter || 'all'; S.status = ''; S.focus = 'section-title'; break;
    case 'filter': S.filter = el.dataset.filter; S.focus = null; break;
    case 'pick3': choose(p, el.dataset.id, el.id); return;
    case 'unlock': S.sub = null; S.flash = p; if (ROUTES[p].kind === 'key') { S.form = { p, value: '', err: '' }; S.focus = 'kf-input'; } else S.focus = 'row-' + p; break;
    case 'seg': [...el.parentNode.children].forEach((b) => b.setAttribute('aria-pressed', String(b === el))); return;
    case 'noop': S.status = 'Koodipalvelut ovat kierroksen 1 mukaiset.'; break;
    default: return;
  }
  rerender();
}
function onChange(e) {
  const el = e.target;
  if (el.dataset.act === 'model') choose(el.dataset.p, el.dataset.id, el.id);
}
function onInput(e) {
  if (e.target.id !== 'kf-input') return;
  const p = S.form.p;
  S.form.value = e.target.value;
  const wrong = S.form.value && !keyFits(p, S.form.value);
  document.getElementById('kf-save').disabled = !keyFits(p, S.form.value);
  const hint = document.getElementById('kf-hint');
  hint.classList.toggle('bad', !!wrong);
  if (wrong) { hint.setAttribute('role', 'alert'); hint.textContent = `Tämä ei näytä ${company(p)}-avaimelta (alkaa ${p === 'anthropic' ? 'sk-ant-' : 'sk-'}).`; e.target.setAttribute('aria-invalid', 'true'); }
  else { hint.removeAttribute('role'); hint.textContent = `Avain tallentuu vain omalle käyttäjällesi eikä sitä näytetä uudelleen. ${company(p)} laskuttaa käytöstä.`; e.target.removeAttribute('aria-invalid'); }
}
function onSubmit(e) {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  save(form.dataset.form);
}
function onKey(e) {
  if (e.key !== 'Escape') return;
  if (S.dialog) { S.focus = S.dialog.from; S.dialog = null; if (S.v === 1) S.form = null; rerender(); }
  else if (S.open === 'default' && S.v === 1) { S.open = null; S.focus = 'def-trigger'; rerender(); }
  else return;
  e.stopPropagation();
}
function installPrototype() {
  const root = document.documentElement;
  root.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const theme = document.getElementById('theme');
  const label = () => { theme.textContent = root.dataset.theme === 'dark' ? 'Vaalea' : 'Tumma'; };
  label();
  theme.onclick = () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; label(); };
  const scenario = document.getElementById('scenario');
  scenario.onchange = () => { S.scenario = scenario.value; resetScenario(); rerender(); };
  const stage = stageEl();
  stage.addEventListener('click', onClick);
  stage.addEventListener('change', onChange);
  stage.addEventListener('input', onInput);
  stage.addEventListener('submit', onSubmit);
  document.addEventListener('keydown', onKey, true);
}
// Picker render functions: a switch keeps the page and the scenario.
const variants = [0, 1, 2].map((i) => () => { S.v = i; S.open = null; S.form = null; S.dialog = null; S.sub = null; S.status = ''; return renderApp(); });
