// Settings grouping prototype. Synthetic people, hosts and accounts only;
// nothing here is imported by production.
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  devices: svg('<rect x="3" y="4" width="13" height="10" rx="1.5"/><rect x="17" y="9" width="5" height="11" rx="1"/><path d="M7 18h6"/>'),
  agent: svg('<path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3z"/><path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z"/>'),
  code: svg('<path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/><path d="M13.5 5l-3 14"/>'),
  plug: svg('<path d="M9 3v5M15 3v5"/><path d="M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v4"/>'),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
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
  shield: svg('<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/>'),
  chev: svg('<path d="M9 6l6 6-6 6"/>'),
  folder: svg('<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/>'),
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// One entry per account the person can connect. `group` is what it is for.
const ACCOUNTS = [
  { id: 'sitekey', group: 'ai', name: 'Palvelimen AI-avain', mark: 'Hb', tone: 0, managed: true,
    ok: 'Ylläpitäjä on antanut tälle palvelimelle avaimen. Agentit voivat käyttää sitä, kunnes liität oman tilauksen.' },
  { id: 'chatgpt', group: 'ai', name: 'ChatGPT-tilaus', mark: 'Ch', tone: 1, verb: 'Kirjaudu',
    ok: 'Pi on kirjautunut tilillä aino.esimerkki@example.com. Codex-mallit ovat käytettävissä.',
    off: 'Kirjaudu ChatGPT-tilauksella, niin Pi voi käyttää sen malleja.',
    err: 'Kirjautuminen vanhentui. Pi ei saa nyt ChatGPT-malleja.', fix: 'Kirjaudu uudelleen',
    more: ['Kirjautuminen tehty 12.10.2026', 'Tämä ei vahvista käyttöoikeutta yksittäiseen malliin.'] },
  { id: 'claude', group: 'ai', name: 'Claude-tilaus', mark: 'Cl', tone: 2, verb: 'Kirjaudu',
    ok: 'Kirjautuminen vahvistettu. Claude-mallit ovat mallivalitsimessa.',
    off: 'Kirjaudu Claude-tilauksella, niin sen mallit tulevat mallivalitsimeen.',
    err: 'Kirjautumista ei ole vahvistettu, joten Claude-malleja ei tarjota mallivalitsimessa.', fix: 'Kirjaudu uudelleen',
    more: ['Vahvistettu 21.10.2026'] },
  { id: 'apikeys', group: 'ai', name: 'API-avaimet', mark: 'Av', tone: 0, verb: 'Lisää avain',
    ok: 'OpenAI-avain tallessa. Anthropic ja DeepSeek: ei avainta.',
    off: 'Avaimella voi käyttää malleja ilman tilausta. Avain tallentuu vain kotihakemistoosi.',
    err: 'OpenAI hylkäsi tallennetun avaimen.', fix: 'Vaihda avain',
    more: ['OpenAI · sk-…7Qx2 · lisätty 3.10.2026'] },
  { id: 'github', group: 'code', name: 'GitHub', mark: 'GH', tone: 0, verb: 'Yhdistä',
    ok: 'Kirjautunut käyttäjänä aino-demo. Git ja gh toimivat työtiloissa.',
    off: 'GitHub-yhteyttä ei löytynyt. Kloonaus ja push vaativat kirjautumisen.',
    err: 'Osittainen yhteys: gh-valtuutus puuttuu tältä palvelimelta. Push ei välttämättä onnistu.', fix: 'Viimeistele yhteys',
    more: ['Selaimesta uloskirjautuminen ei poista palvelimen valtuutusta.'] },
  { id: 'gitea', group: 'code', name: 'Gitea', mark: 'Gt', tone: 3, verb: 'Liitä Gitea',
    ok: 'git.kotiverkko.example · käyttäjä aino. Repot näkyvät uuden työtilan listassa.',
    off: 'Liitä oma Gitea-palvelin sovellustunnuksella.',
    err: 'Gitea hylkäsi tunnuksen (git.kotiverkko.example). Pull ja push eivät onnistu ennen uutta tunnusta.', fix: 'Vaihda tunnus',
    more: ['Tunnus luotu Giteassa: Asetukset → Sovellukset', 'Oikeudet: repository, user (luku)'] },
  { id: 'google', group: 'data', name: 'Google', mark: 'G', tone: 1, verb: 'Yhdistä',
    ok: 'aino.esimerkki@example.com · synkronoitu 12 min sitten',
    off: 'Gmail, Google-kalenteri, yhteystiedot ja Drive.',
    err: 'Palvelimen Google-sovellusasetukset puuttuvat, joten synkronointi ei etene. Kirjautumisesi on tallessa; pyydä ylläpitäjää korjaamaan Palvelinintegraatiot.', fix: 'Näytä tiedot',
    services: ['Gmail', 'Google-kalenteri', 'Google Drive · 3 kansiota, 1,2 Gt'] },
  { id: 'microsoft', group: 'data', name: 'Microsoft 365', mark: 'M', tone: 2, verb: 'Yhdistä',
    ok: 'aino@kotitoimisto.example · synkronoitu 3 min sitten',
    off: 'Outlook-posti, kalenteri, yhteystiedot, OneDrive ja SharePoint.',
    err: 'Kirjautuminen vanhentunut.', fix: 'Kirjaudu uudelleen',
    services: ['Outlook-posti', 'Outlook-kalenteri', 'OneDrive · 1 kansio'] },
  { id: 'icloud', group: 'data', name: 'Apple (iCloud)', mark: 'iC', tone: 3, verb: 'Yhdistä',
    ok: 'aino@icloud.example · sovelluskohtainen salasana', off: 'iCloud-posti, kalenteri ja yhteystiedot sovelluskohtaisella salasanalla.',
    err: 'Sovelluskohtainen salasana ei enää kelpaa.', fix: 'Uusi salasana', services: ['iCloud-posti', 'iCloud-kalenteri'] },
  { id: 'dropbox', group: 'data', name: 'Dropbox', mark: 'D', tone: 3, verb: 'Yhdistä',
    ok: 'aino.esimerkki@example.com', off: 'Valitut kansiot kotihakemistoon.', err: 'Kirjautuminen vanhentunut.', fix: 'Kirjaudu uudelleen', services: ['2 kansiota'] },
  { id: 'dav', group: 'data', name: 'Muu posti tai kalenteri', mark: '@', tone: 0, verb: 'Lisää',
    ok: 'posti.yhdistys.example (IMAP)', off: 'IMAP-, CalDAV- tai CardDAV-palvelin sovellussalasanalla.', err: 'Tunnus tai salasana ei kelpaa.', fix: 'Vaihda salasana', services: ['Sähköposti (IMAP)'] },
];
const BY_ID = Object.fromEntries(ACCOUNTS.map((a) => [a.id, a]));
const SCENARIOS = {
  ok: { label: 'Kaikki kunnossa', acc: { chatgpt: 'ok', claude: 'ok', apikeys: 'ok', github: 'ok', gitea: 'ok', google: 'ok', microsoft: 'off', icloud: 'off', dropbox: 'off', dav: 'off' }, ws: true },
  err: { label: 'Virheitä', acc: { chatgpt: 'ok', claude: 'err', apikeys: 'off', github: 'err', gitea: 'err', google: 'err', microsoft: 'ok', icloud: 'off', dropbox: 'off', dav: 'ok' }, ws: true },
  new: { label: 'Uusi henkilö', acc: { sitekey: 'ok', chatgpt: 'off', claude: 'off', apikeys: 'off', github: 'ok', gitea: 'off', google: 'off', microsoft: 'off', icloud: 'off', dropbox: 'off', dav: 'off' }, ws: false },
};
const WORKSPACES = [
  { name: 'saaasema', repo: 'aino-demo/saaasema', host: 'github' },
  { name: 'kirjasto-ui', repo: 'aino-demo/kirjasto-ui', host: 'github' },
  { name: 'reittikartta', repo: 'retkikunta/reittikartta', host: 'github' },
  { name: 'puutarha-anturit', repo: 'kotiverkko/puutarha-anturit', host: 'gitea' },
];
const GROUP = {
  ai: { title: 'Tekoälypalvelut', icon: 'agent', blurb: 'Tilaukset ja avaimet, joilla agentit käyttävät malleja.' },
  code: { title: 'Koodipalvelut', icon: 'code', blurb: 'Palvelut, joista työtilat kloonataan ja joihin agentit pushaavat.' },
  data: { title: 'Tiedot agenteille', icon: 'plug', blurb: 'Posti, kalenterit ja tiedostot, joita agentit voivat käyttää.' },
};

// The three groupings. `topic` is what the person is after; each variant
// resolves it to its own page so a switch keeps the person on the same subject.
const OTHER = [['tili', 'Tili', 'user'], ['laitteet', 'Laitteet', 'devices']];
const TAIL = [['ulkoasu', 'Ulkoasu', 'eye'], ['editori', 'Editori', 'editor'], ['tila', 'Tallennustila', 'disk']];
const ADMIN = [['palvelin', 'Palvelin', 'server'], ['palvelinintegraatiot', 'Palvelinintegraatiot', 'plug'], ['aiavain', 'AI-avain', 'key'], ['kayttoonotto', 'Käyttöönotto', 'steer'], ['kayttajat', 'Käyttäjät ja pääsy', 'users'], ['levy', 'Levytila', 'disk']];
const VARIANTS = [
  { name: 'Kolme sivua',
    nav: [['tekoaly', 'Tekoäly', 'agent', ['ai']], ['koodi', 'Koodipalvelut', 'code', ['code']], ['tiedot', 'Tiedot agenteille', 'plug', ['data']]],
    resolve: { ai: ['tekoaly'], agents: ['tekoaly'], code: ['koodi'], data: ['tiedot'], connections: ['koodi'] } },
  { name: 'Kaksi sivua',
    nav: [['agentit', 'Agentit ja mallit', 'agent', ['ai']], ['yhteydet', 'Yhteydet', 'link', ['code', 'data']]],
    resolve: { connections: ['yhteydet'], ai: ['agentit'], agents: ['agentit'], code: ['yhteydet'], data: ['yhteydet'] } },
  { name: 'Keskus',
    nav: [['agentit', 'Agentit', 'agent', []], ['yhteydet', 'Yhteydet', 'link', ['ai', 'code', 'data']]],
    resolve: { connections: ['yhteydet'], ai: ['yhteydet', 'ai'], agents: ['agentit'], code: ['yhteydet', 'code'], data: ['yhteydet', 'data'] } },
];

// Where each origin outside settings leads, as a topic and the row to show.
const ORIGINS = {
  'model-claude': { topic: 'ai', row: 'claude' },
  'model-default': { topic: 'agents', row: 'model' },
  'onb-code': { topic: 'code', row: 'github' },
  'onb-data': { topic: 'data', row: 'google' },
  'onb-ai': { topic: 'ai', row: 'chatgpt' },
  'ws-gitea': { topic: 'code', row: 'gitea' },
  'agents-manage': { topic: 'ai', row: 'chatgpt' },
  'sitekey': { topic: 'ai', row: 'sitekey' },
};

const S = { v: 0, view: 'settings', scenario: 'ok', topic: 'connections', detail: false, open: null, flash: null, focus: null, status: '' };
const resetScenario = () => { S.acc = { ...SCENARIOS[S.scenario].acc }; S.open = null; S.status = ''; };
resetScenario();
const V = () => VARIANTS[S.v];
const place = (topic = S.topic) => V().resolve[topic] || [topic];
const accountsIn = (group) => ACCOUNTS.filter((a) => a.group === group && S.acc[a.id]);
const hasErr = (groups) => groups.some((g) => accountsIn(g).some((a) => S.acc[a.id] === 'err'));
function pageTitle(p, sub) {
  if (sub) return GROUP[sub].title;
  const item = [...OTHER, ...V().nav, ...TAIL, ...ADMIN].find(([id]) => id === p);
  return item ? item[1] : '';
}
function pathOf(topic, row) {
  const [p, sub] = place(topic);
  const parts = ['Asetukset', pageTitle(p)];
  if (sub) parts.push(GROUP[sub].title);
  if (row && BY_ID[row]) parts.push(BY_ID[row].name);
  if (row === 'model') parts.push('Oletusmalli');
  return parts.join(' › ');
}

function st(state) {
  if (state === 'ok') return `<span class="st ok">${I.check}Yhdistetty</span>`;
  if (state === 'err') return `<span class="st err">${I.alert}Vaatii toimia</span>`;
  return `<span class="st off">${I.dash}Ei yhdistetty</span>`;
}
function row(a) {
  const state = S.acc[a.id];
  const open = S.open === a.id;
  let actions = '';
  if (a.managed) actions = '';
  else if (state === 'ok') actions = `<button class="btn" data-act="toggle" data-id="${a.id}" aria-expanded="${open}">Hallitse</button>`;
  else if (state === 'err') actions = `<button class="btn primary" data-act="fix" data-id="${a.id}">${a.fix}</button>`;
  else actions = `<button class="btn" data-act="connect" data-id="${a.id}">${a.verb}</button>`;
  const desc = state === 'ok' ? a.ok : state === 'err' ? a.err : a.off;
  let more = '';
  if (open) {
    const lines = (a.services || []).map((s) => `<li><span class="mark sm tone-${a.tone}" aria-hidden="true">${a.mark}</span>${esc(s)}${st('ok')}</li>`)
      .concat((a.more || []).map((m) => `<li>${esc(m)}</li>`)).join('');
    more = `<div class="s-more">${lines ? `<ul>${lines}</ul>` : ''}<div><button class="btn danger" data-act="disconnect" data-id="${a.id}">Irrota ${esc(a.name)}…</button></div></div>`;
  }
  return `<div class="s-row${S.flash === a.id ? ' flash' : ''}" id="row-${a.id}" data-row="${a.id}" data-state="${state}" tabindex="-1">
<span class="mark tone-${a.tone}" aria-hidden="true">${a.mark}</span>
<div class="s-lbl"><strong>${esc(a.name)}</strong><span class="s-desc${state === 'err' ? ' bad' : ''}">${esc(desc)}</span></div>
<div class="s-val">${st(state)}${actions}</div>${more}</div>`;
}
const card = (list) => `<div class="s-card">${list.map(row).join('')}</div>`;
const warning = `<div class="warn" role="note">${I.shield}<div><strong>Agentit voivat lukea ja käyttää kaikkea, mitä tähän liität.</strong> Ne voivat lähettää postia, muuttaa kalenteria ja muokata tai poistaa tiedostoja sinun nimissäsi. Liitä vain se, mitä haluat agenttien käyttävän.</div></div>`;

function modelCard(sameaccounts) {
  const opts = [];
  if (S.acc.chatgpt === 'ok') opts.push('GPT-5 Codex · ChatGPT-tilaus');
  if (S.acc.claude === 'ok') opts.push('Claude Sonnet · Claude-tilaus');
  if (S.acc.apikeys === 'ok') opts.push('GPT-5 mini · OpenAI-avain');
  if (S.acc.sitekey === 'ok') opts.push('GPT-5 mini · palvelimen avain');
  const select = opts.length ? `<select class="select" aria-label="Oletusmalli">${opts.map((o) => `<option>${o}</option>`).join('')}</select>`
    : '<select class="select" aria-label="Oletusmalli" disabled><option>Ei käytettäviä malleja</option></select>';
  const claudeNote = S.acc.claude && S.acc.claude !== 'ok'
    ? `<div class="s-row plain"><p class="s-desc">Claude-malleja ei tarjota: Claude-kirjautumista ei ole vahvistettu. <button class="inline" data-go="model-claude">${sameaccounts ? 'Kirjaudu yllä' : 'Yhteydet › Tekoälypalvelut'}</button></p></div>` : '';
  return `<div class="s-card"><div class="s-row plain${S.flash === 'model' ? ' flash' : ''}" id="row-model" tabindex="-1"><div class="s-lbl"><strong>Oletusmalli</strong><span class="s-desc">Uusien keskustelujen malli. Mallivalitsin näyttää vain mallit, joihin sinulla on kirjautuminen tai avain.</span></div><div class="s-val">${select}</div></div>${claudeNote}
<div class="s-row plain"><div class="s-lbl"><strong>Agentin työ</strong><span class="s-desc">Ajattelu ja työkalut keskustelussa oletuksena.</span></div><div class="s-val"><div class="seg" role="group" aria-label="Agentin työ"><button aria-pressed="true" data-act="seg">Piilossa</button><button aria-pressed="false" data-act="seg">Näkyvissä</button></div></div></div></div>`;
}
function workspaces(full) {
  const list = SCENARIOS[S.scenario].ws ? WORKSPACES : [];
  const count = (h) => list.filter((w) => w.host === h).length;
  const button = '<button class="btn" data-act="new-ws">Uusi työtila…</button>';
  if (!full) {
    return `<p class="s-foot">${list.length ? `Tuodut työtilat: ${count('github')} GitHubista, ${count('gitea')} Giteasta. ` : 'Näistä palveluista ei ole vielä tuotu työtiloja. '}<button class="inline" data-act="new-ws">Uusi työtila…</button></p>`;
  }
  const rows = list.map((w) => {
    const host = BY_ID[w.host];
    const bad = S.acc[w.host] === 'err' ? `<span class="s-desc bad">${w.host === 'gitea' ? 'Pull ja push eivät onnistu' : 'Push ei välttämättä onnistu'} ennen kuin ${host.name}-yhteys on korjattu. Paikallinen työ jatkuu.</span>`
      : S.acc[w.host] !== 'ok' ? `<span class="s-desc">${host.name} ei ole yhdistetty: paikallinen kopio toimii, synkronointi ei.</span>` : '';
    return `<div class="ws">${I.folder}<strong>${esc(w.name)}</strong><span class="mark sm tone-${host.tone}" title="${host.name}">${host.mark}</span><span class="s-desc"><code>${esc(w.repo)}</code> · ${host.name}</span>${bad}</div>`;
  }).join('');
  return `<h3 class="s-h3">Tuodut työtilat <span class="count">${list.length}</span></h3>
<div class="s-card">${rows || '<div class="ws"><span></span><span class="s-desc">Ei vielä tuotuja työtiloja. Uusi työtila listaa yllä olevien palvelujen repot.</span></div>'}
<div class="s-row plain"><p class="s-desc">Työtilat avataan ja poistetaan sivupalkista; täällä näkyy, minkä palvelun tunnuksella kukin synkronoi.</p><div class="s-val">${button}</div></div></div>`;
}
function dataSection() {
  const all = accountsIn('data');
  const on = all.filter((a) => S.acc[a.id] !== 'off');
  const off = all.filter((a) => S.acc[a.id] === 'off');
  return `${warning}${on.length ? `<h3 class="s-h3">Yhdistetyt tilit</h3>${card(on)}` : ''}${off.length ? `<h3 class="s-h3">Lisää tili</h3>${card(off)}` : ''}`;
}
const aiAccounts = () => card(accountsIn('ai'));

function main() {
  const [p, sub] = place();
  const v = S.v;
  const status = `<p class="s-status" role="status" id="status">${esc(S.status)}</p>`;
  let back = '← Asetukset', backTo = 'list', body = '', crumb = '';
  if (p === 'tekoaly') {
    body = `<p class="s-intro">Mallit, joita agentit käyttävät, ja tilaukset tai avaimet, joilla ne saadaan.</p>
<h3 class="s-h3">Kirjautumiset ja avaimet</h3>${aiAccounts()}<h3 class="s-h3">Mallit</h3>${modelCard(true)}`;
  } else if (p === 'koodi') {
    body = `<p class="s-intro">${GROUP.code.blurb}</p>${card(accountsIn('code'))}${workspaces(true)}`;
  } else if (p === 'tiedot') {
    body = `<p class="s-intro">Liitä muiden palvelujen tilisi, niin agenttisi voivat käyttää niiden tiedostoja, postia ja kalentereita.</p>${dataSection()}`;
  } else if (p === 'agentit' && v === 1) {
    body = `<p class="s-intro">Agenttien mallit ja tilaukset tai avaimet, joilla ne saadaan.</p>
<h3 class="s-h3">Kirjautumiset ja avaimet</h3>${aiAccounts()}<h3 class="s-h3">Mallit</h3>${modelCard(true)}`;
  } else if (p === 'agentit') {
    body = `<div class="s-card"><div class="s-row plain"><div class="s-lbl"><strong>Kirjautumiset</strong><span class="s-desc">ChatGPT- ja Claude-tilaukset sekä API-avaimet ovat kohdassa Yhteydet › Tekoälypalvelut.</span></div><div class="s-val"><button class="btn" data-go="agents-manage">Hallitse kirjautumisia</button></div></div></div>${modelCard(false)}`;
  } else if (p === 'yhteydet' && v === 1) {
    body = `<p class="s-intro">Ulkopuoliset tilit, joita agenttisi käyttävät tekoälyn lisäksi. Tekoälytilaukset ovat kohdassa Agentit ja mallit.</p>
<h3 class="s-h3">${GROUP.code.title}</h3>${card(accountsIn('code'))}${workspaces(false)}
<h3 class="s-h3">${GROUP.data.title}</h3>${dataSection()}`;
  } else if (p === 'yhteydet' && sub) {
    crumb = `<p class="s-crumb">Yhteydet ${I.chev.replace('<svg', '<svg width="12" height="12"')} ${GROUP[sub].title}</p>`;
    back = '← Yhteydet'; backTo = 'hub';
    body = `<p class="s-intro">${GROUP[sub].blurb}</p>${sub === 'ai' ? aiAccounts() : sub === 'code' ? card(accountsIn('code')) + workspaces(true) : dataSection()}`;
  } else if (p === 'yhteydet') {
    body = `<p class="s-intro">Kaikki tilit, joita agenttisi käyttävät, ryhmiteltynä sen mukaan, mihin niitä tarvitaan.</p><div class="hub">${['ai', 'code', 'data'].map((g) => {
      const list = accountsIn(g);
      const errs = list.filter((a) => S.acc[a.id] === 'err').length;
      const oks = list.filter((a) => S.acc[a.id] === 'ok').length;
      const summary = errs ? `<span class="s-desc bad">${errs} vaatii toimia</span>` : `<span class="s-desc">${oks ? `${oks} yhdistetty` : 'Ei yhdistettyjä'}</span>`;
      return `<section class="hub-card"><button class="hub-head" data-act="sub" data-sub="${g}"><span class="ic">${I[GROUP[g].icon]}</span><span class="s-lbl"><strong>${GROUP[g].title}</strong>${summary}</span><span class="chev">${I.chev}</span></button>
<div class="hub-list">${list.map((a) => `<button class="chip ${S.acc[a.id]}" data-act="chip" data-sub="${g}" data-id="${a.id}"><span class="mark sm tone-${a.tone}" aria-hidden="true">${a.mark}</span>${esc(a.name)}<span class="dot" aria-hidden="true"></span><span class="sr">${S.acc[a.id] === 'ok' ? 'yhdistetty' : S.acc[a.id] === 'err' ? 'vaatii toimia' : 'ei yhdistetty'}</span></button>`).join('')}</div></section>`;
    }).join('')}</div>`;
  } else {
    body = `<div class="s-card"><div class="s-row plain"><p class="s-desc">Tämä osio ei muutu tällä kierroksella. Kokeile Tekoälyn, koodipalvelujen ja tietolähteiden sivuja.</p></div></div>`;
  }
  return `<div class="s-main"><button class="btn quiet s-back" data-act="back" data-to="${backTo}">${back}</button>${crumb}<h2 id="section-title" tabindex="-1">${esc(sub ? GROUP[sub].title : pageTitle(p))}</h2>${body}${status}</div>`;
}
function nav() {
  const [p] = place();
  const item = ([id, label, icon, groups = []]) => `<button class="s-nav-i" data-act="nav" data-page="${id}"${id === p ? ' aria-current="page"' : ''}>${I[icon]}${label}${groups.length && hasErr(groups) ? '<span class="alert"></span><span class="sr">, vaatii toimia</span>' : ''}</button>`;
  return `<nav class="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>${[...OTHER, ...V().nav, ...TAIL].map(item).join('')}<span class="s-nav-h">Palvelimen ylläpito</span>${ADMIN.map(item).join('')}</nav>`;
}

function origins() {
  const go = (id, label) => `<button class="inline" data-go="${id}" data-dest="${esc(pathOf(ORIGINS[id].topic, ORIGINS[id].row))}">${label}</button>`;
  const dest = (id) => `<p class="dest">Vie: <b>${esc(pathOf(ORIGINS[id].topic, ORIGINS[id].row))}</b></p>`;
  const v = S.v;
  const aiLabel = ['Tekoäly-asetukset', 'Agentit ja mallit', 'Yhteydet › Tekoälypalvelut'][v];
  const agents = v === 2
    ? `<div class="mock"><strong>Asetukset › Agentit</strong><p>ChatGPT- ja Claude-tilaukset sekä API-avaimet ovat kohdassa Yhteydet › Tekoälypalvelut. ${go('agents-manage', 'Hallitse kirjautumisia')}</p></div>${dest('agents-manage')}`
    : `<div class="mock"><strong>Asetukset › ${v === 0 ? 'Tekoäly' : 'Agentit ja mallit'}</strong><p>Ei erillistä linkkiä: kirjautumiset ja oletusmalli ovat samalla sivulla. Nykyinen ”Hallitse kirjautumisia” -painike poistuu. ${go('model-default', 'Avaa sivu')}</p></div>`;
  return `<div class="origins"><h2>Mistä asetuksiin linkataan</h2><p>Sovelluksen muut paikat, jotka ohjaavat asetuksiin. Linkki avaa tämän vaihtoehdon kohteen ja korostaa rivin. Nykyään mallivalitsin vie Yhteydet-sivulle, Uusi työtila Integraatioihin ja Agentit-sivu Yhteydet-sivulle.</p>
<section class="origin"><h3>Mallivalitsin</h3><div class="mock"><div class="seg" role="group" aria-label="Palveluntarjoaja"><button aria-pressed="true">ChatGPT</button><button aria-pressed="false" disabled>Claude</button></div><p>Claude-tilaus ei ole käytettävissä: kirjautumista ei ole vahvistettu. ${go('model-claude', aiLabel)}</p><p>Oletusmallia muutetaan kohdassa ${go('model-default', pathOf('agents').replace('Asetukset › ', ''))}.</p></div>${dest('model-claude')}</section>
<section class="origin"><h3>Käyttöönotto, viimeinen vaihe</h3><div class="mock"><ol class="route"><li class="done"><span class="n">✓</span>GitHub</li><li class="done"><span class="n">✓</span>Työtilat</li><li class="done"><span class="n">✓</span>Google</li><li class="done"><span class="n">✓</span>Tekoäly</li><li class="cur"><span class="n">5</span>Valmis</li></ol><p>Näitä voi muuttaa myöhemmin asetuksista:</p><p>${go('onb-code', 'GitHub ja työtilat')} · ${go('onb-data', 'Google')} · ${go('onb-ai', 'ChatGPT-tilaus')}</p></div>
<p class="dest">Vie: <b>${esc(pathOf('code', 'github'))}</b> · <b>${esc(pathOf('data', 'google'))}</b> · <b>${esc(pathOf('ai', 'chatgpt'))}</b></p></section>
<section class="origin"><h3>Uusi työtila</h3><div class="mock"><strong>Gitea · git.kotiverkko.example</strong><p class="err">Gitea-yhteys ei ole nyt käytettävissä. ${go('ws-gitea', 'Tarkista yhteys')}</p><p>GitHubin repot listataan normaalisti.</p></div>${dest('ws-gitea')}</section>
<section class="origin"><h3>Agentit-sivun kirjautumiset</h3>${agents}</section>
<section class="origin"><h3>Ylläpito › AI-avain</h3><div class="mock"><p>Avain on annettu 4 henkilölle. He näkevät sen kohdassa <b>${esc(pathOf('ai'))}</b>. ${go('sitekey', 'Näytä henkilön näkymä')}</p></div>${dest('sitekey')}</section></div>`;
}

function renderApp() {
  if (S.view === 'origins') return origins();
  return `<div class="s-page${S.detail ? ' detail' : ''} variant-${S.v}" data-variant="${S.v + 1}">${nav()}${main()}</div>`;
}

const stageEl = () => document.getElementById('stage');
function rerender() {
  stageEl().innerHTML = renderApp();
  const target = S.focus;
  S.focus = null;
  if (target) document.getElementById(target)?.focus({ preventScroll: target === 'section-title' && !S.flash });
  if (S.flash) {
    const el = document.getElementById('row-' + S.flash);
    el?.scrollIntoView({ block: 'center' });
    S.flash = null; // the class lives until the next render
  }
}
function goOrigin(id) {
  const o = ORIGINS[id];
  S.view = 'settings'; S.topic = o.topic; S.detail = true; S.open = null; S.status = '';
  S.flash = o.row; S.focus = 'section-title';
  syncViewButtons();
  rerender();
}
function topicOfPage(page) {
  const v = V();
  const entry = Object.entries(v.resolve).find(([, [p, sub]]) => p === page && !sub);
  return entry ? entry[0] : page;
}
function onClick(e) {
  const go = e.target.closest('[data-go]');
  if (go) { goOrigin(go.dataset.go); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = BY_ID[el.dataset.id];
  switch (el.dataset.act) {
    case 'nav': S.topic = topicOfPage(el.dataset.page); S.detail = true; S.open = null; S.status = ''; S.focus = 'section-title'; break;
    case 'back': if (el.dataset.to === 'hub') S.topic = 'connections'; else S.detail = false; S.status = ''; S.focus = 'section-title'; break;
    case 'sub': S.topic = el.dataset.sub; S.detail = true; S.focus = 'section-title'; break;
    case 'chip': S.topic = el.dataset.sub; S.detail = true; S.flash = a.id; S.focus = 'row-' + a.id; break;
    case 'toggle': S.open = S.open === a.id ? null : a.id; S.focus = null; break;
    case 'connect': S.acc[a.id] = 'ok'; S.status = `Simuloitu: ${a.name} yhdistetty. Oikeassa sovelluksessa kirjautuminen avautuu dialogiin.`; S.focus = 'row-' + a.id; break;
    case 'fix': S.acc[a.id] = 'ok'; S.status = `Simuloitu: ${a.name} korjattu.`; S.focus = 'row-' + a.id; break;
    case 'disconnect': S.acc[a.id] = 'off'; S.open = null; S.status = `Simuloitu: ${a.name} irrotettu.`; S.focus = 'row-' + a.id; break;
    case 'new-ws': S.status = 'Simuloitu: avaisi Uusi työtila -sivun, jossa GitHubin ja Gitean repot ovat samassa listassa.'; break;
    case 'seg': [...el.parentNode.children].forEach((b) => b.setAttribute('aria-pressed', String(b === el))); return;
    default: return;
  }
  rerender();
}
function syncViewButtons() {
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === S.view)));
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
  document.querySelectorAll('[data-view]').forEach((b) => { b.onclick = () => { S.view = b.dataset.view; syncViewButtons(); rerender(); }; });
  syncViewButtons();
  stageEl().addEventListener('click', onClick);
}
// Picker render functions: each switch keeps the subject, not the page id.
const variants = VARIANTS.map((_, i) => () => { S.v = i; S.open = null; return renderApp(); });
