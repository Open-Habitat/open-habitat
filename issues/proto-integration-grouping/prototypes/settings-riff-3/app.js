// Tekoäly page riff, round 3 of proto-integration-grouping: four forms of the
// default-model row from which round 2's accepted picker opens. Synthetic
// people, keys and models only; a key never shows beyond its last four characters.
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
  updown: svg('<path d="M8 9l4-4 4 4"/><path d="M8 15l4 4 4-4"/>'),
  send: svg('<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>'),
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

const S = { v: 0, scenario: 'ok', page: 'tekoaly', detail: false,
  open: null, pick: 'openai-codex', form: null, dialog: null, status: '', flash: null, focus: null, saving: 0 };
function resetScenario() {
  const s = SCENARIOS[S.scenario];
  S.acc = JSON.parse(JSON.stringify(s.acc));
  S.def = { ...s.def };
  S.pick = S.def.p; S.open = null; S.form = null; S.dialog = null; S.status = '';
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
<p class="md-note">Tallentuu Pi:n omaan oletukseen (~/.pi/agent/settings.json), joten sama oletus on käytössä myös SSH:lla. Avoimet keskustelut pitävät mallinsa.</p>
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

// ---- Round 3: four forms of the default-model row ------------------------
// Everything below the row is round 2's accepted Ponnahdus page. The row is
// the only thing that differs, and every form opens the same picker: a
// popover on desktop, a bottom sheet on phones.

const thinkWord = () => S.def.t[0].toUpperCase() + S.def.t.slice(1);
// Which route the default goes through, in words a person recognizes.
function routeName(p) {
  const r = ROUTES[p];
  if (r.kind === 'sub') return r.label;
  return `${company(p)} API${S.acc[p].source === 'site' ? ' · ylläpitäjän avain' : ''}`;
}
function popover(cls = '') {
  if (S.open !== 'default') return '';
  return `<div class="scrim sheet-scrim" data-act="close-pop"></div><div class="pop ${cls}" role="dialog" aria-label="Oletusmalli" id="def-panel"><div class="pop-head"><strong>Oletusmalli</strong><button class="btn quiet icon" data-act="close-pop" aria-label="Sulje">${I.x}</button></div>${modelPicker('d')}</div>`;
}
const expanded = () => `aria-expanded="${S.open === 'default'}" aria-haspopup="dialog"`;
const flash = () => (S.flash === 'default' ? ' flash' : '');

// 1 · Valintakenttä: a labelled form field, the full width of the card.
function row1() {
  const r = ROUTES[S.def.p];
  const problem = defProblem();
  return `<div class="s-row plain f1${flash()}" id="row-default" tabindex="-1"><div class="f1-body">
<label class="f1-label" for="def-trigger">Oletusmalli</label>
<div class="pop-anchor"><button class="f1-field${problem ? ' bad' : ''}" id="def-trigger" data-act="toggle" data-id="default" ${expanded()}>
${mark(r.mark, r.tone, true)}<span class="f1-model">${esc(defModel().name)}</span><span class="f1-route">${esc(routeName(S.def.p))}</span>
<span class="f1-think">${I.think}${thinkWord()}</span><span class="f1-caret">${I.updown}</span></button>${popover('pop-under')}</div>
${problem ? `<p class="s-desc bad" role="note">${problem}</p>` : '<p class="s-desc">Uudet keskustelut alkavat tällä mallilla. Avoin keskustelu pitää mallinsa; sen mallin vaihdat keskustelun kirjoituskentästä.</p>'}
</div></div>`;
}

// 2 · Asetusrivi: the whole row is the control; the value reads as text.
function row2() {
  const problem = defProblem();
  return `<div class="pop-anchor r2-wrap${flash()}" id="row-default" tabindex="-1"><button class="r2${problem ? ' bad' : ''}" id="def-trigger" data-act="toggle" data-id="default" ${expanded()}>
<span class="s-lbl"><strong>Oletusmalli</strong><span class="s-desc">Uusille keskusteluille</span></span>
<span class="r2-val"><span class="r2-model">${problem ? I.alert : ''}${esc(defModel().name)}</span><span class="r2-sub">${esc(routeName(S.def.p))} · ajattelu ${thinkWord()}</span></span>
<span class="r2-caret">${I.updown}</span></button>${popover()}
${problem ? `<p class="s-desc bad r2-prob" role="note">${problem}</p>` : ''}</div>`;
}

// 3 · Peili: the composer's own chip, in a sketch of a new conversation.
function row3() {
  const problem = defProblem();
  return `<div class="s-row plain f3${flash()}" id="row-default" tabindex="-1"><div class="f3-body">
<div class="s-lbl"><strong>Uuden keskustelun malli</strong><span class="s-desc">Näin jokainen uusi keskustelu alkaa. Sama siru on kirjoituskentässä.</span></div>
<div class="f3-mock" aria-label="Esikatselu: uuden keskustelun kirjoituskenttä"><span class="f3-ph" aria-hidden="true">Kirjoita tehtävä agentille…</span>
<div class="f3-bar"><div class="pop-anchor"><button class="mchip${problem ? ' bad' : ''}" id="def-trigger" data-act="toggle" data-id="default" ${expanded()} aria-label="Oletusmalli: ${esc(defModel().name)}, ajattelu ${thinkWord()}">${esc(defModel().name)} ${I.think}${thinkWord()}</button>${popover('pop-left')}</div>
<span class="f3-send" aria-hidden="true">${I.send}</span></div></div>
${problem ? `<p class="s-desc bad" role="note">${problem}</p>` : `<p class="s-desc">Palvelu: ${esc(routeName(S.def.p))}. Kun vaihdat mallin keskustelussa, muutos koskee vain sitä keskustelua.</p>`}
</div></div>`;
}

// 4 · Erittely: the three facts side by side, one explicit button.
function row4() {
  const r = ROUTES[S.def.p];
  const problem = defProblem();
  const rs = routeState(S.def.p);
  return `<div class="s-row plain f4${flash()}" id="row-default" tabindex="-1">
<div class="f4-head"><strong>Oletusmalli</strong><div class="pop-anchor"><button class="btn${problem ? ' primary' : ''}" id="def-trigger" data-act="toggle" data-id="default" ${expanded()}>Vaihda…</button>${popover()}</div></div>
<dl class="f4-dl">
<div><dt>Malli</dt><dd class="f4-model">${esc(defModel().name)}</dd></div>
<div><dt>Palvelu</dt><dd class="f4-route">${mark(r.mark, r.tone, true)}<span>${esc(routeName(S.def.p))}</span>${st(rs, rs === 'ok' ? (r.kind === 'sub' ? 'Kirjautunut' : 'Toimii') : 'Vaatii toimia')}</dd></div>
<div><dt>Ajattelutaso</dt><dd><code>${S.def.t}</code></dd></div>
</dl>
${problem ? `<p class="s-desc bad" role="note">${problem}</p>` : ''}
<p class="f4-rel">${I.info}<span><strong>Uudet keskustelut</strong> alkavat tällä. <strong>Avoin keskustelu</strong> pitää mallinsa; vaihto keskustelussa ei muuta oletusta.</span></p></div>`;
}

function tekoaly() {
  const def = [row1, row2, row3, row4][S.v]();
  const agent = `<div class="s-row plain"><div class="s-lbl"><strong>Agentin työ</strong><span class="s-desc">Ajattelu ja työkalut keskustelussa oletuksena.</span></div><div class="s-val"><div class="seg" role="group" aria-label="Agentin työ"><button aria-pressed="true" data-act="seg">Piilossa</button><button aria-pressed="false" data-act="seg">Näkyvissä</button></div></div></div>`;
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
<div class="s-card">${def}${agent}</div>
<h3 class="s-h3">Tilaukset</h3><div class="s-card">${subs}</div>
<h3 class="s-h3">API-avaimet <span class="count">${present.length}</span></h3><div class="s-card">${keys}${add}</div>`;
}

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
  let body;
  if (S.page === 'tekoaly') body = tekoaly();
  else if (S.page === 'koodi') body = code();
  else body = `<div class="s-card"><div class="s-row plain"><p class="s-desc">Tämä osio ei muutu tällä kierroksella. Kokeile Tekoäly-sivua.</p></div></div>`;
  return `<div class="s-main"><button class="btn quiet s-back" data-act="back">← Asetukset</button><h2 id="section-title" tabindex="-1">${esc(label)}</h2>${body}<p class="s-status" role="status" id="status">${esc(S.status.startsWith('Valinta') ? '' : S.status)}</p></div>`;
}
function renderApp() {
  const dlg = S.dialog?.kind === 'remove' ? removeDialog() : S.dialog?.kind === 'add' ? addDialog() : '';
  return `<div class="s-page${S.detail ? ' detail' : ''}" data-variant="${S.v + 1}">${nav()}${main()}</div>${dlg ? `<div class="dlg-layer">${dlg}</div>` : ''}`;
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
  rerender();
}
function onClick(e) {
  if (S.open === 'default' && !e.target.closest('.pop, #def-trigger')) {
    S.open = null; S.focus = 'def-trigger'; rerender();
    if (!e.target.closest('[data-act]') || e.target.closest('[data-act="close-pop"]')) return;
  }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const p = el.dataset.p;
  switch (el.dataset.act) {
    case 'nav': S.page = el.dataset.page; S.detail = true; S.open = null; S.form = null; S.status = ''; S.focus = 'section-title'; break;
    case 'back': S.detail = false; S.focus = null; S.status = ''; break;
    case 'toggle': S.open = S.open ? null : 'default'; S.pick = S.def.p; S.status = ''; S.focus = S.open ? `pk-d-${S.def.p}-${S.def.id}`.replace(/\./g, '_') : 'def-trigger'; break;
    case 'close-pop': S.open = null; S.focus = 'def-trigger'; break;
    case 'tab': S.pick = p; S.focus = null; break;
    case 'think': if (S.def.t === el.dataset.l) return; S.def.t = el.dataset.l; S.saving += 1; S.status = ''; rerender(); setTimeout(() => { S.saving -= 1; if (!S.saving) { S.status = 'Valinta vahvistettu.'; rerender(); } }, 450); return;
    case 'goto': S.open = null; S.flash = el.dataset.row; S.focus = 'row-' + el.dataset.row; break;
    case 'signin': S.acc[p] = 'ok'; S.status = `Simuloitu: ${ROUTES[p].label} kirjautunut. Oikeassa sovelluksessa kirjautuminen avautuu dialogiin.`; S.focus = 'row-' + p; break;
    case 'dlg-add': S.dialog = { kind: 'add', from: el.id || `row-${p}` }; S.form = p ? { p, value: '', err: '' } : null; S.focus = p ? 'kf-input' : 'dlg-title'; S.status = ''; break;
    case 'dlg-prov': S.form = { p, value: '', err: '' }; S.focus = 'kf-input'; break;
    case 'form-cancel': if (S.dialog) { S.focus = S.dialog.from; S.dialog = null; } else S.focus = 'row-' + S.form.p; S.form = null; break;
    case 'sample': case 'sample-bad': S.form.value = SAMPLE(p, el.dataset.act === 'sample-bad'); S.form.err = ''; S.focus = 'kf-save'; break;
    case 'ask-remove': S.dialog = { kind: 'remove', p, from: `row-${p}` }; S.focus = 'dlg-title'; break;
    case 'dialog-close': S.focus = S.dialog?.from; S.dialog = null; S.form = null; break;
    case 'remove': S.acc[p] = K('off'); S.dialog = null; S.status = `Simuloitu: ${company(p)}-avain poistettu tältä palvelimelta.`; S.focus = 'add-key'; break;
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
  if (S.dialog) { S.focus = S.dialog.from; S.dialog = null; S.form = null; rerender(); }
  else if (S.open === 'default') { S.open = null; S.focus = 'def-trigger'; rerender(); }
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
const variants = [0, 1, 2, 3].map((i) => () => { S.v = i; S.open = null; S.form = null; S.dialog = null; S.status = ''; return renderApp(); });

