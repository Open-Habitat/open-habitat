// proto-integration-permission-levels: how a person chooses, when connecting,
// what agents may do with an account, and how that level shows afterwards.
// Axis: who decides the permissions and how finely. 1 Tilitaso: one
// provider-enforced level per account. 2 Palveluittain: a level per service.
// 3 Myönnöstä: Habitat asks for everything; the provider's consent page
// or the organisation narrows it, and Habitat shows what was granted.
// Synthetic people and addresses only; sign-in pages are stand-ins.
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  devices: svg('<rect x="3" y="4" width="13" height="10" rx="1.5"/><rect x="17" y="9" width="5" height="11" rx="1"/><path d="M7 18h6"/>'),
  agent: svg('<path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3z"/>'),
  code: svg('<path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/><path d="M13.5 5l-3 14"/>'),
  plug: svg('<path d="M9 3v5M15 3v5"/><path d="M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v4"/>'),
  eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  editor: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  disk: svg('<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/>'),
  server: svg('<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/>'),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5"/>'),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  contacts: svg('<circle cx="12" cy="9" r="3.5"/><path d="M5 20c1.2-3.5 3.8-5 7-5s5.8 1.5 7 5"/>'),
  folder: svg('<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/>'),
  check: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>'),
  tick: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  shield: svg('<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  refresh: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
  external: svg('<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  sync: svg('<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>'),
  mirror: svg('<path d="M4 12h13"/><path d="M13 7l5 5-5 5"/><path d="M20 5v14"/>'),
  key: svg('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>'),
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- What the providers actually offer (research-integration-permission-scopes) ----

// A capability per service: none, read, drafts (mail only), full,
// appfolder (Dropbox), selected (Microsoft files: folders shared with the app).
const RANK = { none: 0, read: 1, appfolder: 1, selected: 1, drafts: 2, full: 3 };
const P = {
  google: { name: 'Google', mark: 'G', tone: 1, site: 'Google', gen: 'Googlen', ine: 'Googlessa', login: 'oauth',
    svcs: ['mail', 'calendar', 'contacts', 'drive'],
    svcName: { mail: 'Gmail', calendar: 'Google-kalenteri', contacts: 'Google-yhteystiedot', drive: 'Google Drive' } },
  microsoft: { name: 'Microsoft 365', mark: 'M', tone: 2, site: 'Microsoft', gen: 'Microsoftin', ine: 'Microsoftilla', login: 'oauth',
    svcs: ['mail', 'calendar', 'contacts', 'onedrive'],
    svcName: { mail: 'Outlook-posti', calendar: 'Outlook-kalenteri', contacts: 'Yhteystiedot', onedrive: 'OneDrive ja SharePoint' } },
  dropbox: { name: 'Dropbox', mark: 'D', tone: 3, site: 'Dropbox', gen: 'Dropboxin', ine: 'Dropboxissa', login: 'oauth',
    svcs: ['dropbox'], svcName: { dropbox: 'Dropbox' } },
  imap: { name: 'Sähköposti (IMAP)', mark: '@', tone: 3, site: 'Postipalvelin', gen: 'postipalvelimen', ine: 'postipalvelimella', login: 'password',
    svcs: ['mail'], svcName: { mail: 'Posti' } },
  caldav: { name: 'Kalenteri (CalDAV)', mark: 'C', tone: 3, site: 'DAV-palvelin', gen: 'DAV-palvelimen', ine: 'DAV-palvelimella', login: 'password',
    svcs: ['calendar'], svcName: { calendar: 'Kalenteri (CalDAV)' } },
};
const FILES = ['drive', 'onedrive', 'dropbox'];
const SVC_ICON = { mail: 'mail', calendar: 'calendar', contacts: 'contacts', drive: 'folder', onedrive: 'folder', dropbox: 'folder' };

// The provider-enforced presets. `off` is a level the provider cannot give,
// said honestly instead of hidden; `server` marks levels that need the
// operator's extra application registration.
const LEVELS = {
  microsoft: [
    { id: 'full', name: 'Täysi', svc: { mail: 'full', calendar: 'full', contacts: 'full', onedrive: 'full' },
      sum: 'Agentit voivat lukea, muokata ja lähettää sinun nimissäsi.' },
    { id: 'drafts', name: 'Luonnokset, ei lähetystä', server: true, svc: { mail: 'drafts', calendar: 'read', contacts: 'read', onedrive: 'read' },
      sum: 'Agentit lukevat ja kirjoittavat postiluonnoksia. Tililtä ei lähde mitään: ei postia, kalenterikutsuja eikä jakolinkkejä.' },
    { id: 'read', name: 'Vain luku', server: true, svc: { mail: 'read', calendar: 'read', contacts: 'read', onedrive: 'read' },
      sum: 'Agentit lukevat postia, kalenteria, yhteystietoja ja tiedostoja, mutta eivät muuta mitään.' },
  ],
  google: [
    { id: 'full', name: 'Täysi', svc: { mail: 'full', calendar: 'full', contacts: 'full', drive: 'full' },
      sum: 'Agentit voivat lukea, muokata ja lähettää sinun nimissäsi.' },
    { id: 'drafts', name: 'Luonnokset, ei lähetystä', off: 'Google ei tarjoa tätä. Gmailin luonnosoikeus antaa aina myös lähetysoikeuden, joten luonnoksia kirjoittava agentti voi myös lähettää.' },
    { id: 'read', name: 'Vain luku', svc: { mail: 'read', calendar: 'read', contacts: 'read', drive: 'read' },
      sum: 'Agentit lukevat postia, kalenteria, yhteystietoja ja Drivea, mutta eivät muuta mitään.' },
  ],
  dropbox: [
    { id: 'full', name: 'Koko Dropbox', svc: { dropbox: 'full' },
      sum: 'Agentit voivat lukea, muokata, poistaa ja jakaa kaikkia tiedostojasi.' },
    { id: 'appfolder', name: 'Vain sovelluskansio', server: true, svc: { dropbox: 'appfolder' },
      sum: 'Agentit näkevät vain kansion Sovellukset/Open Habitat. Muu Dropboxisi ei näy niille lainkaan.' },
    { id: 'read', name: 'Vain luku', svc: { dropbox: 'read' },
      sum: 'Agentit lukevat kaikkia tiedostojasi, mutta eivät muuta, poista tai jaa niitä.' },
  ],
  imap: [
    { id: 'send', name: 'Posti ja lähetys', svc: { mail: 'full' },
      sum: 'Agentit lukevat, järjestelevät ja kirjoittavat luonnoksia ja voivat lähettää postia.' },
    { id: 'drafts', name: 'Ei lähetystä', svc: { mail: 'drafts' },
      sum: 'Lähetyspalvelinta ei määritetä. Raja on aito vain, jos postipalvelusi salasana ei kelpaa lähetykseen. Habitat kokeilee sen ja kertoo.' },
    { id: 'read', name: 'Vain luku', off: 'Sovellussalasanalla ei voi rajata lukemiseen: sillä voi aina myös siirtää ja poistaa viestejä.' },
  ],
  caldav: [
    { id: 'full', name: 'Lukeminen ja muokkaus', svc: { calendar: 'full' }, sum: 'Agentit lukevat ja muokkaavat kalentereita.' },
    { id: 'read', name: 'Vain luku', off: 'Sovellussalasanalla ei voi rajata lukemiseen.' },
  ],
};

// What a capability lets agents do, in the person's terms.
function ability(provider, s, cap) {
  if (cap === 'none') return 'Ei myönnetty. Agentit eivät pääse tähän.';
  if (s === 'mail') return { full: 'Lukee, järjestelee, kirjoittaa luonnoksia ja lähettää.', drafts: 'Lukee, järjestelee ja kirjoittaa luonnoksia. Ei voi lähettää.', read: 'Lukee. Ei voi muuttaa eikä lähettää mitään.' }[cap];
  if (s === 'calendar') return { full: 'Lukee ja muokkaa. Tapahtuma osallistujineen lähettää kutsut.', read: 'Lukee. Ei voi luoda tapahtumia eikä lähettää kutsuja.' }[cap];
  if (s === 'contacts') return { full: 'Lukee ja muokkaa.', read: 'Lukee.' }[cap];
  const where = provider === 'google' ? 'Drive' : provider === 'dropbox' ? 'Dropbox' : 'OneDrive';
  return {
    full: `Synkronoituu kotihakemistoosi molempiin suuntiin. Agentit voivat muokata, poistaa ja jakaa.`,
    read: `Peili: ${where} kopioituu kotihakemistoosi, mutta muutokset eivät palaa. Kansioon tehty muutos kirjoittuu seuraavalla kierroksella yli.`,
    appfolder: 'Vain kansio Sovellukset/Open Habitat, synkronoituu molempiin suuntiin. Muu Dropbox ei näy.',
    selected: 'Vain kansiot, jotka organisaatiosi on jakanut Habitatille. Haku ei toimi.',
  }[cap];
}
const CAP_NAME = { none: 'Ei myönnetty', read: 'Vain luku', drafts: 'Luonnokset', full: 'Täysi', appfolder: 'Sovelluskansio', selected: 'Valitut kansiot' };
const capClass = (cap) => (cap === 'full' ? 'full' : cap === 'none' ? 'none' : 'narrow');

// The provider's own names for a capability: shown under "Myönnetyt oikeudet".
const SCOPES = {
  google: { mail: { full: 'gmail.modify', read: 'gmail.readonly' }, calendar: { full: 'calendar', read: 'calendar.readonly' },
    contacts: { full: 'contacts', read: 'contacts.readonly' }, drive: { full: 'drive', read: 'drive.readonly' } },
  microsoft: { mail: { full: 'Mail.ReadWrite|Mail.Send', drafts: 'Mail.ReadWrite', read: 'Mail.Read' },
    calendar: { full: 'Calendars.ReadWrite', read: 'Calendars.Read' }, contacts: { full: 'Contacts.ReadWrite', read: 'Contacts.Read' },
    onedrive: { full: 'Files.ReadWrite.All|Sites.ReadWrite.All', read: 'Files.Read.All|Sites.Read.All', selected: 'Files.SelectedOperations.Selected' } },
  dropbox: { dropbox: { full: 'files.content.write|sharing.write', appfolder: 'files.content.write (vain sovelluskansio)', read: 'files.content.read' } },
  imap: { mail: { full: 'IMAP|SMTP', drafts: 'IMAP' } },
  caldav: { calendar: { full: 'CalDAV' } },
};
const scopeList = (p, s, cap) => (cap === 'none' ? [] : (SCOPES[p][s][cap] || '').split('|').filter(Boolean));

// What the consent page says, per capability.
function asks(p, s, cap) {
  const n = P[p].svcName[s];
  if (s === 'mail') return { full: `Lukea, kirjoittaa ja lähettää postia (${n})`, drafts: `Lukea ja kirjoittaa postia, ei lähettää (${n})`, read: `Lukea postia (${n})` }[cap];
  if (s === 'calendar') return { full: `Lukea ja muokata kalentereita`, read: `Lukea kalentereita` }[cap];
  if (s === 'contacts') return { full: `Lukea ja muokata yhteystietoja`, read: `Lukea yhteystietoja` }[cap];
  return { full: `Lukea, muokata, poistaa ja jakaa tiedostoja (${n})`, read: `Lukea tiedostoja (${n})`, appfolder: 'Käyttää omaa kansiotaan Dropboxissasi', selected: 'Käyttää tiedostoja, joihin sille on annettu pääsy' }[cap];
}

// ---- Scenarios -------------------------------------------------------------

const A = (provider, address, cap, extra = {}) => ({ id: provider + ':' + address, provider, address, cap: { ...cap }, ...extra });
const SCENARIOS = {
  ok: { label: 'Tilit yhdistetty',
    server: { msLevels: ['full', 'drafts', 'read'], msFolders: true, dropboxApp: true },
    org: {},
    // Direction 3 cannot ask for a narrower level: there the person left
    // Gmail unticked on Google's page and the rest is what was asked.
    accounts: (v) => (v === 2 ? [
      A('google', 'aino@laaksonen.example', { mail: 'none', calendar: 'full', contacts: 'full', drive: 'full' }, { asked: LEVELS.google[0].svc }),
      A('microsoft', 'aino.laaksonen@konepaja.example', { mail: 'full', calendar: 'full', contacts: 'full', onedrive: 'full' }),
      A('dropbox', 'aino@laaksonen.example', { dropbox: 'full' }),
      A('imap', 'aino@fastmail.example', { mail: 'drafts' }, { smtp: 'rejected' }),
    ] : [
      A('google', 'aino@laaksonen.example', { mail: 'read', calendar: 'read', contacts: 'read', drive: 'read' }),
      A('microsoft', 'aino.laaksonen@konepaja.example', { mail: 'drafts', calendar: 'read', contacts: 'read', onedrive: 'read' }),
      A('dropbox', 'aino@laaksonen.example', { dropbox: 'appfolder' }),
      A('imap', 'aino@fastmail.example', { mail: 'drafts' }, { smtp: 'rejected' }),
    ]) },
  org: { label: 'Organisaatio ja palvelin rajaavat',
    // The server has only the full Microsoft app; the tenant admin consented
    // to less, and a Workspace admin blocked Gmail for the app.
    server: { msLevels: ['full'], msFolders: false, dropboxApp: false },
    org: {
      'konepaja.example': { provider: 'microsoft', max: { mail: 'drafts', calendar: 'read', contacts: 'read', onedrive: 'read' }, who: 'Konepaja Oy' },
      'osuuskunta.example': { provider: 'google', max: { mail: 'none' }, who: 'Osuuskunta Ruis' },
    },
    accounts: () => [
      A('microsoft', 'aino.laaksonen@konepaja.example', { mail: 'drafts', calendar: 'read', contacts: 'read', onedrive: 'read' }, { asked: LEVELS.microsoft[0].svc }),
      A('google', 'aino@osuuskunta.example', { mail: 'none', calendar: 'full', contacts: 'full', drive: 'full' }, { asked: LEVELS.google[0].svc }),
      A('imap', 'aino@posti.example', { mail: 'drafts' }, { smtp: 'accepted' }),
    ] },
  none: { label: 'Ei vielä tilejä',
    server: { msLevels: ['full', 'drafts', 'read'], msFolders: true, dropboxApp: true },
    org: {}, accounts: () => [] },
};
// The address a new account of each provider gets in the dialog.
const NEW_ADDRESS = {
  ok: { google: 'aino.tyo@laaksonen.example', microsoft: 'aino@sivutoimi.example', dropbox: 'aino.tyo@laaksonen.example', imap: 'aino@posti.example', caldav: 'aino@kalenteri.example' },
  org: { google: 'aino@osuuskunta.example', microsoft: 'aino.laaksonen@konepaja.example', dropbox: 'aino@laaksonen.example', imap: 'aino@fastmail.example', caldav: 'aino@kalenteri.example' },
  none: { google: 'aino@laaksonen.example', microsoft: 'aino.laaksonen@konepaja.example', dropbox: 'aino@laaksonen.example', imap: 'aino@fastmail.example', caldav: 'aino@kalenteri.example' },
};

const S = { v: 0, scenario: 'ok', accounts: [], dialog: null, detail: true, flash: null };
const SC = () => SCENARIOS[S.scenario];
const orgOf = (address, provider) => { const o = SC().org[address.split('@')[1]]; return o && o.provider === provider ? o : null; };
function resetScenario() { S.accounts = SC().accounts(S.v); S.dialog = null; S.flash = null; }

// Which presets this server can offer, and why not.
function levelsFor(p) {
  const srv = SC().server;
  return LEVELS[p].map((l) => {
    if (l.off) return l;
    if (p === 'microsoft' && !srv.msLevels.includes(l.id)) return { ...l, off: 'Tällä palvelimella ei ole tämän tason Microsoft-sovellusta. Palvelimen ylläpitäjä voi lisätä sen (Palvelinintegraatiot).', server: true };
    if (p === 'dropbox' && l.id === 'appfolder' && !srv.dropboxApp) return { ...l, off: 'Tällä palvelimella ei ole sovelluskansion Dropbox-sovellusta. Palvelimen ylläpitäjä voi lisätä sen.' };
    return l;
  });
}
const sameCap = (a, b) => Object.keys(b).every((k) => a[k] === b[k]);
// The effective level is read from the grant: no separate record of choice.
function levelOf(acc) {
  const presets = LEVELS[acc.provider].filter((l) => !l.off);
  let l = presets.find((x) => sameCap(acc.cap, x.svc));
  if (!l && acc.cap.onedrive === 'selected') l = presets.find((x) => sameCap({ ...acc.cap, onedrive: x.svc.onedrive }, x.svc));
  const none = Object.keys(acc.cap).filter((s) => acc.cap[s] === 'none');
  if (!l && none.length) l = presets.find((x) => Object.keys(x.svc).every((s) => acc.cap[s] === 'none' || acc.cap[s] === x.svc[s]));
  if (!l) return { name: 'Mukautettu', cls: 'narrow' };
  const without = none.length ? `, ilman: ${none.map((s) => P[acc.provider].svcName[s]).join(', ')}` : '';
  const folders = acc.cap.onedrive === 'selected' ? ', valitut kansiot' : '';
  return { id: l.id, name: l.name + folders + without, cls: l.id === 'full' || l.id === 'send' ? (none.length ? 'narrow' : 'full') : 'narrow' };
}
// "postin lähetys sekä kalenterin ja tiedostojen muokkaus", or a whole service.
function missingText(acc, miss) {
  const gen = { mail: 'postin', calendar: 'kalenterin', contacts: 'yhteystietojen', drive: 'tiedostojen', onedrive: 'tiedostojen', dropbox: 'tiedostojen' };
  const whole = miss.filter((s) => acc.cap[s] === 'none').map((s) => P[acc.provider].svcName[s]);
  const send = miss.includes('mail') && acc.cap.mail === 'drafts' ? ['postin lähetys'] : [];
  const edit = miss.filter((s) => acc.cap[s] !== 'none' && !(s === 'mail' && acc.cap.mail === 'drafts')).map((s) => gen[s]);
  const and = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' ja ' + xs[xs.length - 1] : xs[0] || '');
  const parts = [...whole, ...send];
  if (edit.length) parts.push(and(edit) + ' muokkaus');
  return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' sekä ' + parts[parts.length - 1] : parts[0] || '';
}
function missingOf(acc) {
  if (!acc.asked) return [];
  const want = acc.asked || {};
  return Object.keys(want).filter((s) => RANK[acc.cap[s]] < RANK[want[s]]);
}

// ---- Page ------------------------------------------------------------------

const mark = (p, sm) => `<span class="ig-mark${sm ? ' sm' : ''} tone-${P[p].tone}" aria-hidden="true">${P[p].mark}</span>`;
const pill = (text, cls, icon) => `<span class="lv ${cls}">${icon ? I[icon] : ''}${esc(text)}</span>`;

// What no level prevents: the same-UID truth, said once on the page.
function limits() {
  return `<div class="ig-warn" role="note" data-testid="limits">${I.shield}<div><strong>Taso on palvelun oma raja: se pitää, vaikka agentti erehtyisi tai liitetty viesti yrittäisi ohjata sitä.</strong> Se ei estä tätä:
<ul><li>Agentit ajavat sinun käyttäjänäsi, joten ne voivat lukea myös kirjautumistiedot kotihakemistostasi. Jos tieto päätyy muualle, sillä voi tehdä saman kuin agentti, ei enempää.</li>
<li>Agentti voi kertoa eteenpäin kaiken, mitä se saa lukea. Vain luku ei estä lukemista.</li>
<li>Agentin työkalujen omat “turvatilat” ovat ohjeita, eivät rajoja. Raja on se, minkä palvelu myönsi.</li></ul></div></div>`;
}
function caps(p, s, cap) {
  const items = s === 'mail' ? [['Lukee', RANK[cap] >= 1], ['Luonnokset', RANK[cap] >= 2], ['Lähettää', cap === 'full']]
    : s === 'calendar' ? [['Lukee', RANK[cap] >= 1], ['Muokkaa ja kutsuu', cap === 'full']]
    : s === 'contacts' ? [['Lukee', RANK[cap] >= 1], ['Muokkaa', cap === 'full']]
    : [['Lukee', RANK[cap] >= 1], ['Muokkaa', cap === 'full' || cap === 'appfolder'], ['Jakaa linkillä', cap === 'full'], ['Koko tili', cap === 'full' || cap === 'read']];
  return `<span class="caps">${items.map(([t, ok]) => `<span class="${ok ? 'yes' : 'no'}">${ok ? I.tick : I.x}${t}</span>`).join('')}</span>`;
}
function grantList(acc) {
  const p = acc.provider;
  const want = acc.asked || acc.cap;
  const rows = [];
  for (const s of P[p].svcs) {
    const have = scopeList(p, s, acc.cap[s]);
    for (const sc of have) rows.push(`<li><span>${I.tick}</span><code>${esc(sc)}</code></li>`);
    for (const sc of scopeList(p, s, want[s]).filter((x) => !have.includes(x))) rows.push(`<li class="miss"><span>–</span><code>${esc(sc)}</code> <span>pyydettiin, ei myönnetty</span></li>`);
  }
  if (p === 'imap' && acc.smtp) rows.push(`<li${acc.smtp === 'rejected' ? ' class="miss"' : ''}><span>${acc.smtp === 'rejected' ? '–' : I.tick}</span><code>SMTP</code> <span>${acc.smtp === 'rejected' ? 'palvelin hylkäsi salasanan lähetykseen' : 'salasana kelpaa lähetykseen'}</span></li>`);
  const n = rows.filter((r) => !r.includes('class="miss"')).length;
  return `<details class="grant"><summary>${p === 'imap' || p === 'caldav' ? 'Mitä salasana avaa' : `Myönnetyt oikeudet (${n})`}</summary><ul>${rows.join('')}</ul></details>`;
}
function accountNotices(acc) {
  const p = acc.provider;
  const out = [];
  const miss = missingOf(acc);
  const org = orgOf(acc.address, p);
  if (miss.length && org) {
    const what = missingText(acc, miss);
    out.push(`<p class="ig-notice org" role="status" data-testid="narrowed">${I.info}<span><strong>${esc(org.who)} on rajannut Habitatin oikeuksia.</strong> Puuttuu: ${esc(what)}. Yhteys toimii myönnetyillä oikeuksilla. Rajaus muutetaan organisaation ${p === 'microsoft' ? 'Microsoft Entra' : 'Google Workspace'} -hallinnassa, ei täällä.</span></p>`);
  } else if (miss.length)
    out.push(`<p class="ig-notice" role="status" data-testid="narrowed">${I.info}<span><strong>Jätit kirjautuessa myöntämättä:</strong> ${esc(miss.map((s) => P[p].svcName[s]).join(', '))}. Agentit eivät pääse niihin. Muuta oikeuksia… lisää ne takaisin.</span></p>`);
  if (p === 'imap' && acc.cap.mail === 'drafts' && acc.smtp === 'accepted')
    out.push(`<p class="ig-notice" role="status" data-testid="smtp-open">${I.info}<span><strong>Lähetystä ei ole estetty.</strong> Lähetyspalvelinta ei määritetty, mutta postipalvelin hyväksyi saman salasanan myös lähetykseen, joten agentti voi lähettää postia itse. Aito raja syntyy vain salasanalla, joka ei kelpaa lähetykseen. Esimerkiksi Fastmail antaa tehdä sellaisen.</span></p>`);
  return out.join('');
}
function card(acc) {
  const p = acc.provider;
  const L = levelOf(acc);
  const btns = [];
  if (S.v === 0) btns.push(`<button class="btn" data-act="change" data-id="${esc(acc.id)}">Vaihda taso…</button>`);
  else if (S.v === 1) btns.push(`<button class="btn" data-act="change" data-id="${esc(acc.id)}">Muuta oikeuksia…</button>`);
  else btns.push(`<button class="btn" data-act="change" data-id="${esc(acc.id)}">Muuta oikeuksia…</button>`);
  btns.push(`<button class="btn quiet" data-act="noop">${I.refresh}Tarkista</button>`, `<button class="btn quiet" data-act="remove" data-id="${esc(acc.id)}">Poista…</button>`);
  const head = `<div class="ig-acc">${mark(p)}<div><span class="ig-rn">${P[p].name}</span><span class="ig-meta">${esc(acc.address)}</span></div>${S.v === 0 ? pill(L.name, L.cls, L.cls === 'full' ? 'key' : 'lock') : ''}<div class="ig-acc-actions">${btns.join('')}</div></div>`;
  const svcs = P[p].svcs.map((s) => {
    const cap = acc.cap[s];
    let meta = ability(p, s, cap);
    if (p === 'imap' && cap === 'drafts') meta = acc.smtp === 'rejected' ? 'Lukee, järjestelee ja kirjoittaa luonnoksia. Ei voi lähettää: palvelin hylkäsi salasanan lähetykseen.' : 'Lukee, järjestelee ja kirjoittaa luonnoksia. Lähetystä ei ole määritetty.';
    const right = cap === 'none' ? `<span class="ig-st none">${I.x}Ei käytössä</span>`
      : `<span class="ig-st">${I.check}${FILES.includes(s) ? 'Synkronoitu klo 9.38' : 'Toimii'}</span>`;
    return `<div class="ig-svc" data-svc="${s}" data-cap="${cap}"><span class="ig-ic">${I[SVC_ICON[s]]}</span><div><span class="ig-rn">${P[p].svcName[s]}</span><span class="ig-meta">${esc(meta)}</span>${S.v === 2 ? caps(p, s, cap) : ''}</div><div class="ig-sv">${S.v === 1 ? pill(CAP_NAME[cap], capClass(cap)) : ''}${right}</div></div>`;
  }).join('');
  return `<article class="ig-card${S.flash === acc.id ? ' flash' : ''}" data-account="${esc(acc.id)}" data-level="${esc(L.id || 'custom')}" aria-label="${esc(P[p].name + ' · ' + acc.address)}">${head}${accountNotices(acc)}${svcs}${grantList(acc)}</article>`;
}
function page() {
  const groups = ['google', 'microsoft', 'dropbox', 'imap', 'caldav'].filter((p) => S.accounts.some((a) => a.provider === p));
  const connected = groups.map((p) => `<section class="ig-provider" aria-label="${P[p].name}">${S.accounts.filter((a) => a.provider === p).map(card).join('')}
<div class="ig-another"><button class="btn quiet" data-act="connect" data-p="${p}">${I.plus}Lisää toinen ${p === 'imap' ? 'sähköpostitili' : p === 'caldav' ? 'kalenteri' : P[p].name + '-tili'}</button></div></section>`).join('');
  const rest = ['google', 'microsoft', 'dropbox', 'imap', 'caldav'].filter((p) => !groups.includes(p));
  const offered = (p) => levelsFor(p).filter((l) => !l.off).map((l) => l.name.toLowerCase()).join(' · ');
  const tiles = rest.map((p) => `<div class="ig-tile" data-tile="${p}">${mark(p)}<div><span class="ig-rn">${P[p].name}</span><span class="ig-meta">${P[p].svcs.map((s) => P[p].svcName[s]).join(' · ')}</span>${S.v === 2 ? '' : `<span class="ig-meta">Tasot: ${esc(offered(p))}</span>`}</div><button class="btn" data-act="connect" data-p="${p}">Yhdistä…</button></div>`).join('');
  return `<p class="ig-intro">Liitä muiden palvelujen tilisi, niin agenttisi voivat käyttää niiden tiedostoja, postia ja kalentereita.${S.v === 2 ? '' : ' Valitse jokaiselle tilille, mitä agentit saavat tehdä.'}</p>
${limits()}
${connected ? `<h3 class="ig-h3">Yhdistetyt tilit</h3>${connected}` : ''}
${tiles ? `<h3 class="ig-h3">Lisää tili</h3><div class="ig-tiles">${tiles}</div>` : ''}
<p class="ig-foot">Tila ja oikeudet luetaan suoraan työkaluilta ja palvelun myöntämästä kirjautumisesta sinun käyttäjänäsi. Kirjautumistiedot ovat vain kotihakemistossasi. Uudet keskustelut näkevät muutoksen heti; käynnissä oleva keskustelu näkee sen, kun lataat sen uudelleen.</p>`;
}

// ---- The connect and change dialog ---------------------------------------------

// The warning in the dialog follows the chosen capabilities.
function dialogWarning(p, cap) {
  const can = [];
  if (cap.mail === 'full') can.push('lähettää postia');
  if (cap.calendar === 'full') can.push('muuttaa kalenteria ja lähettää kutsuja');
  const f = FILES.find((s) => cap[s]);
  if (f && cap[f] === 'full') can.push('muokata, poistaa ja jakaa tiedostoja');
  if (f && cap[f] === 'appfolder') can.push('muokata ja poistaa sovelluskansion tiedostoja');
  const first = can.length ? `Agentit voivat ${can.join(', ').replace(/, ([^,]*)$/, ' ja $1')} sinun nimissäsi.`
    : cap.mail === 'drafts' ? 'Agentit voivat järjestellä postia ja kirjoittaa luonnoksia, mutta eivät lähettää mitään. Ne voivat silti kertoa eteenpäin kaiken, minkä lukevat.'
    : 'Agentit eivät voi lähettää tai muuttaa mitään, mutta ne voivat lukea kaiken, minkä tämä taso avaa, ja kertoa sen eteenpäin.';
  return `<div class="ig-warn" role="note" data-testid="dialog-warning">${I.shield}<div><strong>${esc(first)}</strong> Liitetty viesti tai tiedosto voi sisältää ohjeita, joita agentti yrittää noudattaa. Agentit näkevät myös kirjautumistiedon, mutta sillä voi tehdä vain sen, minkä ${esc(P[p].site)} myönsi.</div></div>`;
}
function capFromChoice(d) {
  const p = d.p;
  if (S.v === 1) return { ...d.cap };
  const l = LEVELS[p].find((x) => x.id === d.level);
  const cap = { ...l.svc };
  if (p === 'microsoft' && d.folders) cap.onedrive = 'selected';
  return cap;
}
function levelCards(d) {
  const ls = levelsFor(d.p);
  const opts = ls.map((l) => {
    const on = d.level === l.id;
    const list = !l.off && on ? `<ul class="lvl-svc">${P[d.p].svcs.map((s) => `<li><b>${P[d.p].svcName[s]}</b><span>${esc(ability(d.p, s, d.p === 'microsoft' && s === 'onedrive' && d.folders ? 'selected' : l.svc[s]))}</span></li>`).join('')}</ul>` : '';
    return `<label class="lvl-opt${l.off ? ' off' : ''}" data-level="${l.id}"><input type="radio" name="lvl" value="${l.id}"${on ? ' checked' : ''}${l.off ? ' disabled' : ''} data-act="level"><b>${esc(l.name)}</b><span class="ig-meta">${esc(l.off || l.sum)}</span>${list}</label>`;
  }).join('');
  const folders = d.p === 'microsoft' && SC().server.msFolders
    ? `<label class="lvl-extra"><input type="checkbox" data-act="folders"${d.folders ? ' checked' : ''}><span><b>Tiedostot vain valituista kansioista</b><span class="ig-meta">Agentit näkevät vain kansiot, joihin organisaatiosi IT tai kansion omistaja antaa Habitatille pääsyn. Haku ei toimi näissä kansioissa.</span></span></label>` : '';
  return `<p class="dlg-lead">Mitä agentit saavat tehdä tällä tilillä?</p><fieldset class="lvl-opts"><legend class="sr">Taso</legend>${opts}</fieldset>${folders}`;
}
function serviceRows(d) {
  const p = d.p;
  const rows = P[p].svcs.map((s) => {
    let choices;
    if (p === 'google') choices = s === 'mail' ? [['read', 'Vain luku'], ['drafts', 'Luonnokset', true], ['full', 'Täysi']] : [['read', 'Vain luku'], ['full', 'Täysi']];
    else if (p === 'microsoft') choices = s === 'mail' ? [['read', 'Vain luku'], ['drafts', 'Luonnokset'], ['full', 'Täysi']].map((c) => [...c, !SC().server.msLevels.includes(c[0])]) : null;
    else if (p === 'dropbox') choices = [['read', 'Vain luku'], ['appfolder', 'Sovelluskansio', !SC().server.dropboxApp], ['full', 'Koko Dropbox']];
    else if (p === 'imap') choices = [['drafts', 'Ei lähetystä'], ['full', 'Lähetys mukaan']];
    else choices = [['full', 'Lukeminen ja muokkaus']];
    let control;
    let note = ability(p, s, d.cap[s]);
    if (choices) control = `<div class="seg" role="group" aria-label="${P[p].svcName[s]}">${choices.map(([id, t, off]) => `<button type="button" data-act="svc" data-svc="${s}" data-cap="${id}" aria-pressed="${d.cap[s] === id}"${off ? ' disabled' : ''}>${t}</button>`).join('')}</div>`;
    else if (p === 'microsoft' && s === 'onedrive' && SC().server.msFolders) control = `<div class="seg" role="group" aria-label="${P[p].svcName[s]}"><button type="button" data-act="msfiles" data-sel="0" aria-pressed="${d.cap.onedrive !== 'selected'}">Kaikki</button><button type="button" data-act="msfiles" data-sel="1" aria-pressed="${d.cap.onedrive === 'selected'}">Valitut kansiot</button></div>`;
    else control = `<span class="locked">${I.lock} ${CAP_NAME[d.cap[s]]}</span>`;
    if (p === 'google' && s === 'mail') note += ' Luonnokset ilman lähetystä ei ole mahdollinen: Googlen luonnosoikeus sallii aina myös lähetyksen.';
    if (p === 'microsoft' && s !== 'mail') note += s === 'onedrive' && d.cap.onedrive === 'selected' ? '' : ' Seuraa postin tasoa.';
    return `<div class="svc-row" data-svc="${s}"><span class="ig-ic">${I[SVC_ICON[s]]}</span><b>${P[p].svcName[s]}</b>${control}<span class="ig-meta">${esc(note)}</span></div>`;
  }).join('');
  const msNote = p === 'microsoft' ? `<p class="ig-meta">Microsoftilla taso valitaan postille, ja kalenteri, yhteystiedot ja tiedostot seuraavat sitä. Microsoft antaa yhden sovelluksen kaikille käyttäjille saman oikeusjoukon, joten jokainen yhdistelmä vaatisi palvelimelle oman sovelluksen.</p>` : '';
  return `<p class="dlg-lead">Mitä agentit saavat tehdä kussakin palvelussa?</p><div class="svc-rows">${rows}</div>${msNote}`;
}
// Microsoft's other services follow the mail level (one app per level).
function msFollow(cap) {
  const l = LEVELS.microsoft.find((x) => x.svc.mail === cap.mail);
  const sel = cap.onedrive === 'selected';
  Object.assign(cap, l.svc);
  if (sel) cap.onedrive = 'selected';
}
function grantSide(d) {
  const p = d.p;
  const how = {
    google: 'Googlen kirjautumissivulla voit jättää rastin pois palveluista, joita et halua antaa, esimerkiksi Gmailin. Gmailia ei voi siellä vaihtaa vain lukuun: palvelu annetaan kokonaan tai ei ollenkaan.',
    microsoft: 'Microsoftin kirjautumissivulla ei voi valita oikeuksia. Työpaikan tilillä organisaatiosi ylläpitäjä päättää, mitä Habitat saa. Habitat käyttää sitä, mitä myönnetään.',
    dropbox: 'Dropboxin kirjautumissivulla ei voi valita oikeuksia.',
    imap: 'Postipalvelun salasana avaa yleensä kaiken. Jos palvelusi antaa tehdä salasanan, joka ei kelpaa lähetykseen, agentit eivät voi lähettää.',
    caldav: 'Kalenterin salasana avaa lukemisen ja muokkauksen.',
  }[p];
  return `<p class="dlg-lead">Agentit saavat käyttöönsä</p><ul class="picks">${P[p].svcs.map((s) => `<li class="pick"><span class="ig-ic">${I[SVC_ICON[s]]}</span><span><b>${P[p].svcName[s]}</b><span class="ig-meta">${esc(ability(p, s, LEVELS[p][0].svc[s]))}</span></span></li>`).join('')}</ul>
<div class="ig-notice">${I.info}<span><strong>Voiko rajata?</strong> ${esc(how)}</span></div>`;
}
function changeFacts(d, acc) {
  const p = d.p;
  const next = capFromChoice(d);
  const items = [];
  if (P[p].login === 'oauth') {
    items.push(['external', `Kirjaudut uudelleen ${P[p].ine}. Uusi kirjautuminen korvaa vanhan.`]);
    items.push(['lock', p === 'microsoft' ? 'Vanha kirjautuminen poistetaan kotihakemistostasi. Microsoft ei anna perua yksittäistä kirjautumista, joten jos epäilet sen päätyneen muualle, kirjaudu ulos kaikista istunnoista Microsoftin tiliasetuksista.' : `Habitat peruu vanhan kirjautumisen ${P[p].gen} päässä, joten laajemmat oikeudet eivät jää voimaan.`]);
  } else items.push(['key', 'Salasana pysyy samana. Vain Habitatin asetukset muuttuvat, joten raja on yhtä aito kuin ennenkin.']);
  for (const s of P[p].svcs.filter((x) => FILES.includes(x))) {
    if (acc.cap[s] !== 'read' && next[s] === 'read') items.push(['mirror', `${P[p].svcName[s]} muuttuu peiliksi. Ennen vaihtoa Habitat synkronoi vielä kerran molempiin suuntiin, joten jo tehdyt muutokset ehtivät palveluun.`]);
    if (acc.cap[s] === 'read' && next[s] === 'full') items.push(['sync', `${P[p].svcName[s]} synkronoituu taas molempiin suuntiin.`]);
    if (next[s] === 'appfolder' && acc.cap[s] !== 'appfolder') items.push(['folder', 'Kotihakemiston Dropbox-kansioon jää vain sovelluskansio. Muut tiedostot poistetaan kotihakemistostasi; Dropboxissa ne säilyvät.']);
  }
  return `<ul class="change">${items.map(([i, t]) => `<li>${I[i]}<span>${esc(t)}</span></li>`).join('')}</ul>`;
}
function consent(d) {
  const p = d.p;
  const want = capFromChoice(d);
  if (P[p].login === 'password') {
    const smtp = want.mail === 'full';
    return `<div class="prov" data-testid="provider-page"><div class="prov-h">${mark(p, true)}<span>Habitatin lomake: ${P[p].name}</span></div>
<p class="ig-meta">Sovellussalasana ja palvelimen osoitteet kuten nyt. ${smtp ? 'Lähetyspalvelin (SMTP) määritetään.' : 'Lähetyspalvelinta (SMTP) ei määritetä. Habitat kokeilee silti, kelpaako salasana lähetykseen, ja kertoo tuloksen.'}</p>
<ul><li>${I.key}<span>Sähköposti <code>${esc(d.address)}</code> · salasana ••••••••••••</span></li><li>${I.server}<span>IMAP <code>imap.${esc(d.address.split('@')[1])}</code>${smtp ? ` · SMTP <code>smtp.${esc(d.address.split('@')[1])}</code>` : ''}</span></li></ul></div>`;
  }
  const org = orgOf(d.address, p);
  const lines = P[p].svcs.map((s) => {
    if (!want[s] || want[s] === 'none') return '';
    const blocked = org && org.max[s] === 'none';
    const text = asks(p, s, want[s]);
    if (p === 'google' && S.v === 2 && !blocked) return `<li><input type="checkbox" data-act="consent" data-svc="${s}"${d.consent[s] !== false ? ' checked' : ''} aria-label="${esc(text)}"><span>${esc(text)}</span></li>`;
    return `<li class="${blocked ? 'denied' : ''}">${blocked ? I.x : I.tick}<span>${esc(text)}${blocked ? ' · organisaatiosi on estänyt' : ''}</span></li>`;
  }).join('');
  const orgNote = org && p === 'microsoft' ? `<p class="org">${esc(org.who)}: ylläpitäjä on hyväksynyt tälle sovellukselle vain osan oikeuksista. Saat sen, mikä on hyväksytty.</p>` : '';
  return `<div class="prov" data-testid="provider-page"><div class="prov-h">${mark(p, true)}<span>${P[p].site} · kirjautumissivu (simuloitu, oikeasti oma välilehti tai koodi)</span></div>
<p class="prov-t">Open Habitat haluaa käyttää tiliäsi ${esc(d.address)}</p>
<ul>${lines}</ul>${orgNote}</div>`;
}
// The provider grants what the person accepted, within the organisation's ceiling.
function grant(d) {
  const p = d.p;
  const want = capFromChoice(d);
  const org = orgOf(d.address, p);
  const cap = {};
  for (const s of P[p].svcs) {
    let c = want[s];
    if (S.v === 2 && p === 'google' && d.consent[s] === false) c = 'none';
    if (org && org.max[s] && RANK[org.max[s]] < RANK[c]) c = org.max[s];
    cap[s] = c;
  }
  return cap;
}
function dialogBody(d) {
  const p = d.p;
  const acc = d.accountId ? S.accounts.find((a) => a.id === d.accountId) : null;
  if (d.step === 'intro') {
    const chooser = S.v === 0 ? levelCards(d) : S.v === 1 ? serviceRows(d) : grantSide(d);
    const fromto = acc && S.v < 2 ? `<p class="fromto">${pill(levelOf(acc).name, levelOf(acc).cls)}${I.arrow}${pill(S.v === 0 ? (LEVELS[p].find((l) => l.id === d.level).name + (d.folders ? ', valitut kansiot' : '')) : levelOf({ provider: p, cap: d.cap }).name, 'narrow')}</p>` : '';
    const how = acc ? changeFacts(d, acc) : `<p class="dlg-p">${P[p].login === 'password' ? 'Tarvitset palvelusi sovellussalasanan ja palvelimen nimen. Ne kirjoitetaan vain kotihakemistosi asetuksiin.' : `Kirjaudut ${P[p].gen} sivulla. Taso pyydetään ${P[p].gen} kirjautumisessa, joten ${P[p].site} itse valvoo sitä.`}</p>`;
    const v3change = acc && S.v === 2 ? `<p class="dlg-p">Oikeuksia muutetaan kirjautumalla uudelleen. ${p === 'google' ? 'Jätä Googlen sivulla rasti pois siitä, mitä et halua antaa, tai lisää se takaisin.' : 'Habitat pyytää samat oikeudet kuin ennenkin.'}</p>` : '';
    const same = acc && S.v < 2 && sameCap(capFromChoice(d), acc.cap);
    return `${chooser}${fromto}${v3change}${how}${dialogWarning(p, S.v === 2 ? LEVELS[p][0].svc : capFromChoice(d))}
<div class="dlg-row"><button class="btn page" data-act="close">Peruuta</button><button class="btn page primary" data-act="continue"${same ? ' disabled' : ''}>${P[p].login === 'password' ? 'Jatka' : `${I.external}Jatka: ${P[p].site}`}</button></div>`;
  }
  if (d.step === 'consent') return `${consent(d)}<div class="dlg-row"><button class="btn page" data-act="close">Peruuta</button><button class="btn page primary" data-act="accept">${P[p].login === 'password' ? 'Yhdistä' : 'Hyväksy'}</button></div>`;
  // done
  const r = d.result;
  const L = levelOf(r);
  const miss = missingOf(r);
  const narrowed = miss.length > 0;
  const org = orgOf(r.address, p);
  let msg = acc ? `<b>Oikeudet vaihdettu.</b> ${esc(r.address)}: ${esc(L.name)}.` : `<b>Yhdistetty: ${esc(r.address)}.</b> Agentit saavat: ${esc(L.name)}. Uudet keskustelut näkevät sen heti.`;
  if (narrowed) msg = `<b>Yhdistetty kapeammin kuin pyydettiin.</b> ${org ? esc(org.who) + ' rajasi oikeuksia' : 'Jätit osan myöntämättä'}. Puuttuu: ${esc(missingText(r, miss))}. Yhteys toimii myönnetyillä oikeuksilla.`;
  const smtp = p === 'imap' && r.cap.mail === 'drafts' ? (r.smtp === 'rejected' ? '<p class="dlg-p">Habitat kokeili: palvelin hylkäsi salasanan lähetykseen. Agentit eivät voi lähettää.</p>' : '<p class="ig-notice">' + I.info + '<span><strong>Lähetystä ei ole estetty.</strong> Palvelin hyväksyi salasanan myös lähetykseen, joten agentti voi lähettää postia itse. Tee palvelussasi salasana, joka ei kelpaa lähetykseen, jos haluat aidon rajan.</span></p>') : '';
  return `<p class="result${narrowed ? ' narrow' : ''}" role="status" data-testid="connected">${narrowed ? I.info : I.check}<span>${msg}</span></p>${smtp}
<ul class="lvl-svc" style="margin:0">${P[p].svcs.map((s) => `<li><b>${P[p].svcName[s]}</b><span>${esc(ability(p, s, r.cap[s]))}</span></li>`).join('')}</ul>
<div class="dlg-row"><button class="btn page primary" data-act="done">Valmis</button></div>`;
}
function dialog() {
  const d = S.dialog;
  if (!d) return '';
  const acc = d.accountId ? S.accounts.find((a) => a.id === d.accountId) : null;
  const title = d.kind === 'remove' ? `Poista ${P[d.p].name}-tili?`
    : acc ? `${S.v === 0 ? 'Vaihda taso' : 'Muuta oikeuksia'}: ${P[d.p].name}` : `Yhdistä ${d.p === 'imap' ? 'sähköpostitili' : d.p === 'caldav' ? 'kalenteri' : P[d.p].name + '-tili'}`;
  const body = d.kind === 'remove'
    ? `<p class="dlg-p">Habitat poistaa kirjautumisen kotihakemistostasi. Synkronoidut tiedostot jäävät kotihakemistoosi.${P[d.p].login === 'oauth' ? ` ${P[d.p].site} muistaa antamasi luvan, kunnes perut sen tilisi asetuksista.` : ''}</p><div class="dlg-row"><button class="btn page" data-act="close">Peruuta</button><button class="btn page primary" data-act="really-remove">Poista</button></div>`
    : dialogBody(d);
  return `<div class="dlg-layer"><div class="scrim" data-act="close"></div><div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-title" data-step="${d.step || d.kind}"><div class="dlg-h">${mark(d.p)}<h2 id="dlg-title" tabindex="-1">${esc(title)}</h2><button class="btn quiet" data-act="close" aria-label="Sulje">${I.x}</button></div>${body}</div></div>`;
}

// ---- Shell -----------------------------------------------------------------

const NAV = [['tili', 'Tili', 'user'], ['laitteet', 'Laitteet', 'devices'], ['tekoaly', 'Tekoäly', 'agent'], ['koodi', 'Koodipalvelut', 'code'], ['tiedot', 'Tiedot agenteille', 'plug'], ['ulkoasu', 'Ulkoasu', 'eye'], ['editori', 'Editori', 'editor'], ['tila', 'Tallennustila', 'disk']];
const ADMIN = [['palvelin', 'Palvelin', 'server'], ['palvelinintegraatiot', 'Palvelinintegraatiot', 'plug'], ['kayttajat', 'Käyttäjät ja pääsy', 'users']];
S.page = 'tiedot';
function nav() {
  const item = ([id, label, icon]) => `<button class="s-nav-i" data-act="nav" data-page="${id}"${id === S.page ? ' aria-current="page"' : ''}>${I[icon]}${label}</button>`;
  return `<nav class="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>${NAV.map(item).join('')}<span class="s-nav-h">Palvelimen ylläpito</span>${ADMIN.map(item).join('')}</nav>`;
}
function renderApp() {
  const label = [...NAV, ...ADMIN].find(([id]) => id === S.page)[1];
  const body = S.page === 'tiedot' ? page() : `<p class="s-other">Tämä osio ei muutu tällä kierroksella. Kokeile Tiedot agenteille -sivua.</p>`;
  return `<div class="s-page${S.detail ? ' detail' : ''}" data-variant="${S.v + 1}">${nav()}<div class="s-main"><button class="btn quiet s-back" data-act="back">← Asetukset</button><h2 id="section-title">${esc(label)}</h2>${body}</div></div>${dialog()}`;
}
const stageEl = () => document.getElementById('stage');
function rerender() {
  stageEl().innerHTML = renderApp();
  const h = document.getElementById('dlg-title');
  if (h && S.focusDialog) { h.focus(); S.focusDialog = false; }
}

function openConnect(p, accountId) {
  const acc = accountId ? S.accounts.find((a) => a.id === accountId) : null;
  const L = acc ? levelOf(acc) : null;
  const first = levelsFor(p).find((l) => !l.off);
  const level = L?.id && LEVELS[p].some((l) => l.id === L.id) ? L.id : first.id;
  const cap = acc ? { ...acc.cap } : { ...first.svc };
  for (const s of Object.keys(cap)) if (cap[s] === 'none') cap[s] = first.svc[s];
  S.dialog = { kind: 'connect', p, accountId, step: 'intro', level, folders: acc?.cap.onedrive === 'selected', cap,
    consent: Object.fromEntries(P[p].svcs.map((s) => [s, acc ? acc.cap[s] !== 'none' : true])),
    address: acc ? acc.address : NEW_ADDRESS[S.scenario][p] };
  S.focusDialog = true;
}
function onClick(e) {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const act = t.dataset.act;
  const d = S.dialog;
  if (act === 'level' || act === 'folders' || act === 'consent') return; // handled on change
  if (act === 'nav') { S.page = t.dataset.page; S.detail = true; }
  else if (act === 'back') S.detail = false;
  else if (act === 'connect') openConnect(t.dataset.p);
  else if (act === 'change') openConnect(S.accounts.find((a) => a.id === t.dataset.id).provider, t.dataset.id);
  else if (act === 'remove') { const a = S.accounts.find((x) => x.id === t.dataset.id); S.dialog = { kind: 'remove', p: a.provider, accountId: a.id }; S.focusDialog = true; }
  else if (act === 'really-remove') { S.accounts = S.accounts.filter((a) => a.id !== d.accountId); S.dialog = null; }
  else if (act === 'close') S.dialog = null;
  else if (act === 'svc') { d.cap[t.dataset.svc] = t.dataset.cap; if (d.p === 'microsoft') msFollow(d.cap); }
  else if (act === 'msfiles') { if (t.dataset.sel === '1') d.cap.onedrive = 'selected'; else { d.cap.onedrive = 'full'; msFollow(d.cap); } }
  else if (act === 'continue') { d.step = 'consent'; S.focusDialog = true; }
  else if (act === 'accept') {
    const prev = d.accountId ? S.accounts.find((a) => a.id === d.accountId) : null;
    const want = capFromChoice(d);
    const got = grant(d);
    const r = { id: d.p + ':' + d.address, provider: d.p, address: d.address, cap: got, asked: sameCap(got, want) ? undefined : want };
    // The SMTP probe: only an address that refuses the password is a real limit.
    r.smtp = d.p === 'imap' && got.mail === 'drafts' ? (d.address.includes('posti') ? 'accepted' : 'rejected') : undefined;
    if (prev) Object.assign(prev, r);
    else if (!S.accounts.some((a) => a.id === r.id)) S.accounts.push(r);
    else Object.assign(S.accounts.find((a) => a.id === r.id), r);
    d.result = prev || S.accounts.find((a) => a.id === r.id);
    d.step = 'done'; S.focusDialog = true;
  } else if (act === 'done') { S.flash = d.result.id; S.dialog = null; }
  else if (act === 'noop') return;
  else return;
  rerender();
}
function onChange(e) {
  const t = e.target;
  const d = S.dialog;
  if (!d) return;
  if (t.dataset.act === 'level') d.level = t.value;
  else if (t.dataset.act === 'folders') d.folders = t.checked;
  else if (t.dataset.act === 'consent') { d.consent[t.dataset.svc] = t.checked; return; }
  else return;
  rerender();
  document.querySelector(`.lvl-opt[data-level="${d.level}"] input, .lvl-extra input`)?.focus();
}
function onKey(e) {
  if (e.key !== 'Escape' || !S.dialog) return;
  S.dialog = null; rerender(); e.stopPropagation();
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
  document.addEventListener('keydown', onKey, true);
}
resetScenario();
// Picker render functions: a switch keeps the scenario and starts it over,
// because each direction reaches different grants.
const variants = [0, 1, 2].map((i) => () => { S.v = i; resetScenario(); return renderApp(); });
