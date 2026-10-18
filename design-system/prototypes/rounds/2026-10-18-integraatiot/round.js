// Integraatiot (proto-integrations, 18.10.2026). Asetukset ovat tuotannon muoto (osioluettelo
// vasemmalla, yksi osio kerrallaan) ja saavat osion Integraatiot. Kaikki mitä näkymä kertoo
// liitoksesta tulee työkaluilta (rclone, gog, onedrive, ms-365-mcp-server) henkilön omana
// käyttäjänä; palvelin ei pidä omaa kirjaa. Kirjautumisen vaiheet vastaavat sitä, mitä
// issuen Feasibility-osio todensi: gog ja rclone ohjaavat lopuksi osoitteeseen 127.0.0.1,
// joka liitetään takaisin, ja Microsoft näyttää laitekoodin. Esitys-rivien painikkeet ovat vain
// prototyypissä: ne esittävät, mitä selaimen ulkopuolella tapahtuu.
(() => {
const IC = {
  user: SVG('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5"/>'),
  devices: SVG('<rect x="2.5" y="5" width="13" height="10" rx="1.5"/><path d="M1.5 18h10"/><rect x="16" y="8" width="6" height="12" rx="1.5"/>'),
  pi: SVG('<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M9 13h.01M15 13h.01"/>'),
  link: SVG('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  plug: SVG('<path d="M9 2v5M15 2v5"/><path d="M6 7h12v4a6 6 0 0 1-12 0z"/><path d="M12 17v5"/>'),
  eye: SVG('<path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.6"/>'),
  disk: SVG('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 14h18M7 17h.01"/>'),
  folder: SVG('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  mail: SVG('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>'),
  cal: SVG('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  mailcal: SVG('<rect x="2.5" y="6" width="12" height="10" rx="1.5"/><path d="m3 7 5.5 4.5L14 7"/><rect x="13" y="11" width="8.5" height="9" rx="1.5"/><path d="M13 14h8.5"/>'),
  ok: SVG('<path d="m5 12.5 4.5 4.5L19 7"/>'),
  warn: SVG('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4M12 17h.01"/>'),
  shield: SVG('<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z"/><path d="M12 8v4M12 15h.01"/>'),
  clock: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  copy: SVG('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  ext: SVG('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>'),
  sync: SVG('<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/>'),
  plus: SVG('<path d="M12 5v14M5 12h14"/>'),
  stop: SVG('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>'),
};

// ---------- Catalog (what the operator installed and registered) ----------
const ME = { name: 'Jari Mustonen', email: 'jari@esimerkki.fi', login: 'maintainer', srv: 'open-habitat-test' };
const PROV = {
  google: { name: 'Google', mark: 'G', acct: 'jari.koti@esimerkki.fi', login: 'paste', site: 'Google', gen: 'Googlen', ill: 'Googleen', back: 'http://127.0.0.1:46399/oauth2/callback?state=vwWgu6zcAn1a…&code=4/0AVMBsJh…&scope=email%20…', wrong: 'https://accounts.google.com/signin/oauth/consent?authuser=0&part=AJi8hAN…', prefix: 'http://127.0.0.1' },
  microsoft: { name: 'Microsoft 365', mark: 'M', acct: 'jari@esimerkki.fi', org: 'Esimerkki Oy', login: 'device', site: 'Microsoft', gen: 'Microsoftin', ill: 'Microsoft 365:een' },
  dropbox: { name: 'Dropbox', mark: 'D', acct: 'jari.koti@esimerkki.fi', login: 'paste', site: 'Dropbox', gen: 'Dropboxin', ill: 'Dropboxiin', back: 'http://localhost:53682/?code=sl.u.AFxk2…&state=lrxmQuH5ZcMU…', wrong: 'https://www.dropbox.com/oauth2/authorize?client_id=…&response_type=code', prefix: 'http://localhost:53682' },
};
// One entry per thing the agent gets. `tool` is the native tool behind it; `login` groups
// entries that one sign-in covers (gog serves Gmail and the calendar with one token).
const SVC = [
  { id: 'gdrive', p: 'google', name: 'Google Drive', kind: 'files', ic: 'folder', tool: 'rclone', login: 'g-drive', dir: '~/Google Drive', scope: 'lukea ja muokata Driven tiedostoja', can: ['lukee', 'kirjoittaa', 'poistaa tiedostoja'] },
  { id: 'gmail', p: 'google', name: 'Gmail', kind: 'tool', ic: 'mail', tool: 'gog', login: 'g-gog', skill: 'gmail', scope: 'lukea, järjestellä ja lähettää postia', can: ['hakee ja lukee', 'luonnostelee', 'lähettää'] },
  { id: 'gcal', p: 'google', name: 'Google-kalenteri', kind: 'tool', ic: 'cal', tool: 'gog', login: 'g-gog', skill: 'google-calendar', scope: 'lukea ja muokata kalentereita', can: ['lukee', 'luo ja muuttaa tapahtumia'] },
  { id: 'odrive', p: 'microsoft', name: 'OneDrive ja SharePoint', kind: 'files', ic: 'folder', tool: 'onedrive', login: 'm-files', dir: '~/OneDrive', scope: 'lukea ja muokata tiedostoja ja SharePoint-sivustoja', can: ['lukee', 'kirjoittaa', 'poistaa tiedostoja'] },
  { id: 'outlook', p: 'microsoft', name: 'Outlook-posti ja -kalenteri', kind: 'tool', ic: 'mailcal', tool: 'ms-365-mcp-server', login: 'm-mail', mcp: 'microsoft365', scope: 'lukea ja lähettää postia ja muokata kalenteria', can: ['hakee ja lukee', 'vastaa ja lähettää', 'luo tapahtumia'] },
  { id: 'dropbox', p: 'dropbox', name: 'Dropbox', kind: 'files', ic: 'folder', tool: 'rclone', login: 'd-files', dir: '~/Dropbox', scope: 'lukea ja muokata tiedostoja', can: ['lukee', 'kirjoittaa', 'poistaa tiedostoja'] },
];
const S = Object.fromEntries(SVC.map(s => [s.id, s]));
// Folders a file source offers once signed in (sizes from the provider).
const FOLDERS = {
  gdrive: [{ id: 'own', name: 'Oma Drive', gb: 4.3, on: true }, { id: 'shared', name: 'Jaettu kanssani', gb: 1.8, on: true }],
  odrive: [{ id: 'me', name: 'OneDrive – Esimerkki Oy', gb: 4.2, on: true }, { id: 'sales', name: 'SharePoint · Myynti › Asiakirjat', gb: 1.8, on: true }, { id: 'admin', name: 'SharePoint · Hallinto › Sopimukset', gb: 0.6, on: false }],
  dropbox: [{ id: 'docs', name: 'Asiakirjat', gb: 4.9, on: true }, { id: 'proj', name: 'Projektit', gb: 1.9, on: true }, { id: 'pics', name: 'Kuvat', gb: 31.2, on: false }],
};
const QUOTA = 50, OTHER = 15.3;
const gb = (x) => `${x.toFixed(1).replace('.', ',')} Gt`;
const mmss = (s) => `${Math.floor(s / 60)}.${String(s % 60).padStart(2, '0')}`;
const now = () => { const d = new Date(); return `${d.getHours()}.${String(d.getMinutes()).padStart(2, '0')}`; };

// ---------- Live state (as the tools would report it) ----------
let ST = {}, CUR = 'v1', VIEW = 'settings', SEC = 'integraatiot', FL = null, SYNC = 0;
function initState() {
  ST = {
    gdrive: { on: true, st: 'ok', sel: ['own', 'shared'], at: '9.38' },
    gmail: { on: true, st: 'ok', at: '9.38' },
    gcal: { on: true, st: 'ok', at: '9.38' },
  };
}
const on = (id) => !!ST[id]?.on;
const provOn = (p) => SVC.some(s => s.p === p && on(s.id));
const size = (id) => (FOLDERS[id] || []).filter(f => (ST[id]?.sel || []).includes(f.id)).reduce((a, f) => a + f.gb, 0);
const synced = () => SVC.filter(s => s.kind === 'files' && on(s.id)).reduce((a, s) => a + size(s.id), 0);
const free = () => QUOTA - OTHER - synced();
const mark = (p, cls = '') => `<span class="ig-mark ig-${p}${cls}" aria-hidden="true">${PROV[p].mark}</span>`;

function status(s) {
  const x = ST[s.id];
  if (!x?.on) return `<span class="ig-st off">Ei yhdistetty</span>`;
  if (x.chk) return `<span class="ig-st"><span class="ig-spin" aria-hidden="true"></span>Tarkistetaan…</span>`;
  if (x.st === 'expired') return `<span class="ig-st bad">${IC.warn}Kirjautuminen vanhentunut</span>`;
  if (x.st === 'syncing') return `<span class="ig-st busy">${IC.sync}<span data-prog="${s.id}">Synkronoi ${gb(x.done)} / ${gb(size(s.id))}</span></span>`;
  if (s.kind === 'files') return `<span class="ig-st ok">${IC.ok}Ajan tasalla · ${gb(size(s.id))}</span>`;
  return `<span class="ig-st ok">${IC.ok}Toimii</span>`;
}
const checked = (s) => ST[s.id]?.on && !ST[s.id].chk && ST[s.id].st !== 'syncing' ? `Tarkistettu klo ${ST[s.id].at}` : '';
function gets(s) {
  if (s.kind === 'files') return `Kansio <span class="mono">${esc(s.dir)}</span>, jota agentit käyttävät tavallisilla tiedostotyökaluilla`;
  if (s.mcp) return `MCP-palvelin <span class="mono">${s.mcp}</span> (${esc(s.tool)})`;
  return `Taito <span class="mono">${s.skill}</span>, joka käyttää komentoa <span class="mono">${esc(s.tool)}</span>`;
}
function progressBar(s) {
  const x = ST[s.id]; if (x?.st !== 'syncing') return '';
  return `<span class="ig-bar" aria-hidden="true"><span data-bar="${s.id}" style="width:${Math.round(100 * x.done / size(s.id))}%"></span></span>`;
}

// ---------- The warning, the same in every direction ----------
const WARN = `<div class="ig-warn" role="note">${IC.shield}<div><strong>Agentit voivat lukea ja käyttää kaikkea, mitä tähän liität.</strong> Ne voivat lähettää postia, muuttaa kalenteria ja muokata tai poistaa tiedostoja sinun nimissäsi. Liitetty viesti tai tiedosto voi myös sisältää ohjeita, joita agentti yrittää noudattaa. Liitä vain se, mitä haluat agenttien käyttävän.</div></div>`;
const FOOT = `<p class="ig-foot">Tila luetaan suoraan työkaluilta (rclone, gog, onedrive, ms-365-mcp-server) sinun käyttäjänäsi. Kirjautumistiedot ovat vain kotihakemistossasi; palvelin ei tallenna niitä eikä listaa liitoksiasi muualle. Uudet keskustelut näkevät liitoksen heti.</p>`;

// ---------- Sign-in flow: the same steps in every direction ----------
// steps: intro → login (paste or device) → choose folders (files) → … → done
function startFlow(p, ids, opts = {}) {
  clearInterval(FL?.timer);
  const steps = [];
  if (!opts.relogin) steps.push({ t: 'intro' });
  FL = { p, ids, steps, i: 0, sub: null, left: 0, timer: 0, input: '', err: '', pick: opts.pick, relogin: !!opts.relogin, sel: {}, code: 'K7QM2PXDW' };
  buildSteps();
  if (opts.relogin) enterStep();
  paintFlow(true);
}
// Logins are grouped by the tool's token: Google in Tili direction gets one consent for all
// (gog's refresh token is handed to rclone); Microsoft files and mail are two tools, two codes.
function buildSteps() {
  const keep = FL.steps.slice(0, FL.relogin ? 0 : 1);
  const ids = FL.ids;
  const groups = [];
  const key = (s) => CUR === 'v1' && s.p === 'google' ? 'g-all' : s.login;
  for (const id of ids) { const s = S[id]; const g = groups.find(x => x.key === key(s)); g ? g.ids.push(id) : groups.push({ key: key(s), ids: [id] }); }
  for (const g of groups) {
    keep.push({ t: 'login', ids: g.ids });
    if (!FL.relogin) for (const id of g.ids) if (S[id].kind === 'files') keep.push({ t: 'choose', id });
  }
  keep.push({ t: 'done' });
  FL.steps = keep;
}
const step = () => FL.steps[FL.i];
const logins = () => FL.steps.filter(x => x.t === 'login');
function enterStep() {
  clearInterval(FL.timer); FL.err = ''; FL.input = '';
  const st = step();
  if (st.t === 'login') {
    if (PROV[FL.p].login === 'device') { FL.sub = 'code'; FL.left = 900; if (logins().indexOf(st) > 0) FL.code = 'HQ7RK2M4P'; }
    else { FL.sub = 'open'; FL.left = 300; }
    if (FL.sub === 'code') FL.timer = setInterval(tickFlow, 1000);
  }
  if (st.t === 'choose') FL.sel[st.id] = FL.sel[st.id] || FOLDERS[st.id].filter(f => f.on).map(f => f.id);
  if (st.t === 'done') finish();
}
function next() { FL.i++; enterStep(); paintFlow(); }
function tickFlow() {
  if (!FL || !['code', 'paste'].includes(FL.sub)) return clearInterval(FL?.timer);
  FL.left = Math.max(0, FL.left - 1);
  if (!FL.left) { FL.sub = 'timeout'; clearInterval(FL.timer); return paintFlow(); }
  document.querySelectorAll('[data-left]').forEach(e => { e.textContent = mmss(FL.left); });
}
function finish() {
  for (const id of FL.ids) {
    const s = S[id];
    if (FL.relogin) { ST[id].st = 'ok'; ST[id].at = now(); continue; }
    ST[id] = { on: true, st: s.kind === 'files' ? 'syncing' : 'ok', at: now(), sel: FL.sel[id], done: 0 };
  }
  if (FL.p === 'microsoft') PROV.microsoft.acct = 'jari@esimerkki.fi';
  render(); startSync();
}
function startSync() {
  clearInterval(SYNC);
  if (!SVC.some(s => ST[s.id]?.st === 'syncing')) return;
  SYNC = setInterval(() => {
    let done = false;
    for (const s of SVC) {
      const x = ST[s.id]; if (x?.st !== 'syncing') continue;
      x.done = Math.min(size(s.id), x.done + 0.35);
      if (x.done >= size(s.id)) { x.st = 'ok'; x.at = now(); done = true; continue; }
      // Only the text and the bar change, so the row's buttons keep focus and presses.
      document.querySelectorAll(`[data-prog="${s.id}"]`).forEach(e => { e.textContent = `Synkronoi ${gb(x.done)} / ${gb(size(s.id))}`; });
      document.querySelectorAll(`[data-bar="${s.id}"]`).forEach(e => { e.style.width = `${Math.round(100 * x.done / size(s.id))}%`; });
    }
    if (done) { render(); if (!SVC.some(s => ST[s.id]?.st === 'syncing')) clearInterval(SYNC); }
  }, 700);
}
function cancelFlow() { if (!FL) return; clearInterval(FL.timer); FL = null; }

function flowTitle() {
  const p = PROV[FL.p];
  if (FL.relogin) return `Kirjaudu uudelleen: ${p.name}`;
  if (CUR === 'v1') return provOn(FL.p) ? `Lisää palveluita: ${p.name}` : `Yhdistä ${p.name}-tili`;
  return `Yhdistä ${S[FL.ids[0]].name}`;
}
function stepper() {
  const ls = FL.steps.filter(x => x.t !== 'intro' && x.t !== 'done');
  if (ls.length < 2) return '';
  const at = ls.indexOf(step());
  const label = (x) => x.t === 'login' ? `Kirjaudu: ${x.ids.map(i => S[i].name).join(', ')}` : `Valitse kansiot: ${S[x.id].name}`;
  return `<ol class="ig-steps">${ls.map((x, i) => `<li class="${i < at ? 'done' : i === at ? 'now' : ''}">${i < at ? IC.ok : `<span>${i + 1}</span>`}<span class="ig-steps-l">${esc(label(x))}</span></li>`).join('')}</ol>`;
}
function flowBody() {
  const st = step(), p = PROV[FL.p];
  if (st.t === 'intro') {
    const pick = CUR === 'v1' ? SVC.filter(s => s.p === FL.p) : FL.ids.map(i => S[i]);
    const list = pick.map(s => {
      const already = on(s.id);
      const box = CUR === 'v1' ? `<input type="checkbox" data-igc="svc:${s.id}"${FL.ids.includes(s.id) || already ? ' checked' : ''}${already ? ' disabled' : ''}>` : '';
      return `<label class="ig-pick${CUR === 'v1' ? '' : ' fixed'}">${box}<span class="ig-ic sm">${IC[s.ic]}</span><span><b>${esc(s.name)}</b>${already ? ' <span class="ig-badge">Yhdistetty</span>' : ''}<span class="ig-meta">${esc(p.site)} pyytää luvan ${esc(s.scope)}.</span></span></label>`;
    }).join('');
    const nLogins = logins().length;
    const how = p.login === 'device'
      ? `Kirjaudut Microsoftin sivulla lyhyellä koodilla${nLogins > 1 ? `, kerran kummallekin: tiedostoille ja postille ovat eri työkalut` : ''}. Työpaikan tilillä organisaation ylläpitäjän voi joutua hyväksymään sovelluksen ensin.`
      : `${esc(p.site)} avautuu uuteen välilehteen. Hyväksymisen jälkeen kopioit sen osoitteen, johon päädyit, takaisin tänne.`;
    const none = !FL.ids.length;
    return `${CUR === 'v1' ? `<p class="ig-lead">Valitse, mitä agentit saavat käyttöönsä.</p>` : ''}<div class="ig-picks">${list}</div>
<p class="ig-p">${how}</p>${WARN}
<div class="ig-row"><button type="button" class="secondary" data-ig="fcancel">Peruuta</button><button type="button" class="primary" data-ig="go"${none ? ' aria-disabled="true"' : ''}>${IC.ext}Jatka: ${esc(p.site)}</button></div>`;
  }
  if (st.t === 'login') return stepper() + loginBody(st);
  if (st.t === 'choose') return stepper() + chooseBody(st.id);
  return doneBody();
}
function loginBody(st) {
  const p = PROV[FL.p];
  const names = st.ids.map(i => S[i].name).join(', ');
  if (FL.sub === 'checking') return `<p class="ig-wait"><span class="ig-spin" aria-hidden="true"></span>Viimeistellään kirjautumista…</p>`;
  if (FL.sub === 'timeout') return `<p class="ig-result">${IC.clock}<span>Kirjautuminen vanheni ennen kuin se valmistui. Mitään ei yhdistetty.</span></p><div class="ig-row"><button type="button" class="secondary" data-ig="fcancel">Peruuta</button><button type="button" class="primary" data-ig="restart">Aloita alusta</button></div>`;
  if (FL.sub === 'consent') {
    const url = `https://login.microsoftonline.com/esimerkki.onmicrosoft.com/v2.0/adminconsent?client_id=3f1c…&scope=…`;
    return `<p class="ig-result bad">${IC.warn}<span><b>${esc(p.org)} vaatii ylläpitäjän luvan.</b> Organisaatiosi ei anna käyttäjien itse sallia sovelluksille pääsyä postiin, kalenteriin tai tiedostoihin. Ylläpitäjän pitää hyväksyä palvelimen <span class="mono">${ME.srv}</span> sovellus kerran koko organisaatiolle.</span></p>
<p class="ig-p">Lähetä tämä linkki organisaatiosi Microsoft 365 -ylläpitäjälle. Hän näkee, mitä sovellus pyytää, ennen kuin hyväksyy.</p>
<div class="ig-url"><span class="mono">${esc(url)}</span><button type="button" class="secondary sm" data-ig="copy:ylläpitäjän hyväksyntälinkki">${IC.copy}Kopioi</button></div>
<p class="ig-p">Kun lupa on annettu, kirjaudu uudelleen. Mitään ei tallennettu.</p>
<div class="ig-row"><button type="button" class="secondary" data-ig="fcancel">Sulje</button><button type="button" class="primary" data-ig="restart">Kirjaudu uudelleen</button></div>`;
  }
  if (FL.sub === 'blocked') return `<p class="ig-result bad">${IC.stop}<span><b>${esc(p.org)} estää kirjautumisen laitekoodilla.</b> Microsoft pysäytti kirjautumisen organisaation pääsysäännön takia. Tältä palvelimelta ei ole toista reittiä, koska se on ainoa tapa kirjautua selaimen kautta palvelimella ajettavaan työkaluun.</span></p>
<p class="ig-p">Organisaatiosi ylläpitäjä voi sallia laitekoodikirjautumisen tälle sovellukselle. Kerro hänelle palvelimen nimi <span class="mono">${ME.srv}</span>.</p>
<div class="ig-row"><button type="button" class="primary" data-ig="fcancel">Sulje</button></div>`;
  if (FL.sub === 'code') return `<p class="ig-h">Kirjaudu Microsoftiin tällä koodilla</p><p class="ig-p">Kohde: ${esc(names)}. Koodi kirjaa vain tämän palvelimen työkalun sinun tilillesi.</p>
<div class="ig-code"><span class="ig-code-v mono" aria-label="Koodi ${FL.code.split('').join(' ')}">${FL.code}</span><button type="button" class="secondary sm" data-ig="copy:${FL.code}">${IC.copy}Kopioi</button></div>
<div class="ig-row start"><button type="button" class="primary" data-ig="openms">${IC.ext}Avaa login.microsoft.com/device</button></div>
<p class="ig-wait"><span class="ig-spin" aria-hidden="true"></span><span>Odotetaan, että hyväksyt kirjautumisen. Koodi vanhenee <b data-left>${mmss(FL.left)}</b></span></p>
<p class="ig-fine">Syötä koodi vain tänne avaamallesi Microsoftin sivulle. Jos joku muu pyytää sinua syöttämään koodin, älä tee sitä.</p>
<div class="ig-row"><button type="button" class="secondary" data-ig="fcancel">Peruuta</button></div>
<div class="ig-demo" aria-label="Prototyypin esitys"><span>Esitys</span><button type="button" data-ig="msok">Hyväksy Microsoftissa</button><button type="button" data-ig="msconsent">Vaatii ylläpitäjän luvan</button><button type="button" data-ig="msblocked">Laitekoodi estetty</button><button type="button" data-ig="expire">Aika loppuu</button></div>`;
  // Paste flow (Google via gog or rclone, Dropbox via rclone).
  if (FL.sub === 'open') return `<p class="ig-h">Kirjaudu: ${esc(p.site)}</p><p class="ig-p">Kohde: ${esc(names)}. ${esc(p.site)} kysyy, mille tilille ja mitkä luvat annat.</p>
<div class="ig-row start"><button type="button" class="primary" data-ig="openpaste">${IC.ext}Avaa ${esc(p.site)}</button></div>
<div class="ig-row"><button type="button" class="secondary" data-ig="fcancel">Peruuta</button></div>`;
  return `<p class="ig-h">Liitä osoite, johon ${esc(p.site)} lopuksi ohjasi</p>
<ol class="ig-how"><li>Hyväksy luvat avautuneessa välilehdessä.</li><li>Lopuksi selain siirtyy sivulle, joka ei aukea. Se kuuluu asiaan: osoite alkaa <span class="mono">${esc(p.prefix)}</span> ja sisältää kirjautumisen.</li><li>Kopioi osoiteriviltä koko osoite ja liitä se tähän.</li></ol>
<label class="ig-field"><span class="sr-only">Paluuosoite</span><input type="text" data-igi="paste" value="${esc(FL.input)}" placeholder="${esc(p.prefix)}/…?code=…" spellcheck="false" autocomplete="off"></label>
${FL.err ? `<p class="ig-err" role="alert">${IC.warn}<span>${FL.err}</span></p>` : ''}
<p class="ig-wait quiet">${IC.clock}<span>Kirjautuminen on voimassa <b data-left>${mmss(FL.left)}</b>. <button type="button" class="ig-link" data-ig="openpaste">Avaa ${esc(p.site)} uudelleen</button></span></p>
<div class="ig-row"><button type="button" class="secondary" data-ig="fcancel">Peruuta</button><button type="button" class="primary" data-ig="paste">Yhdistä</button></div>
<div class="ig-demo" aria-label="Prototyypin esitys"><span>Esitys</span><button type="button" data-ig="fill">Liitä paluuosoite</button><button type="button" data-ig="fillwrong">Liitä ${esc(p.gen)} sivun osoite</button><button type="button" data-ig="expire">Aika loppuu</button></div>`;
}
function chooseBody(id) {
  const s = S[id], sel = FL.sel[id];
  const tot = FOLDERS[id].filter(f => sel.includes(f.id)).reduce((a, f) => a + f.gb, 0);
  const room = free();
  const over = tot > room;
  return `<p class="ig-h">Mitkä kansiot synkronoidaan kansioon <span class="mono">${esc(s.dir)}</span>?</p>
<p class="ig-p">Kansiot pysyvät ajan tasalla jatkuvasti, myös kun selain on kiinni. Ne vievät tilaa kotihakemistosi kiintiöstä.</p>
<div class="ig-folders">${FOLDERS[id].map(f => `<label class="ig-folder"><input type="checkbox" data-igc="fold:${id}:${f.id}"${sel.includes(f.id) ? ' checked' : ''}><span>${esc(f.name)}</span><span class="ig-meta">${gb(f.gb)}</span></label>`).join('')}</div>
<div class="ig-room${over ? ' over' : ''}"><span class="ig-quota" aria-hidden="true"><span class="u" style="width:${100 * (QUOTA - room) / QUOTA}%"></span><span class="n" style="width:${Math.min(100 * tot / QUOTA, 100 * room / QUOTA)}%"></span></span>
<span>${over ? `${IC.warn}<b>Ei mahdu.</b> Valitut ${gb(tot)}, vapaana ${gb(room)}. Jätä jokin kansio pois tai pyydä ylläpitäjältä lisää tilaa.` : `Valittu ${gb(tot)}. Kotihakemistossa on vapaana ${gb(room)} / ${gb(QUOTA)}.`}</span></div>
<div class="ig-row"><button type="button" class="secondary" data-ig="fcancel">Peruuta</button><button type="button" class="primary" data-ig="choose"${over || !sel.length ? ' aria-disabled="true"' : ''}>${IC.sync}Aloita synkronointi</button></div>`;
}
function doneBody() {
  const names = FL.ids.map(i => S[i].name);
  const files = FL.ids.filter(i => S[i].kind === 'files');
  if (FL.relogin) return `<p class="ig-result ok">${IC.ok}<span>Kirjauduttu uudelleen. ${esc(names.join(' ja '))} toimii taas.</span></p><div class="ig-row"><button type="button" class="primary" data-ig="fdone">Valmis</button></div>`;
  return `<p class="ig-result ok">${IC.ok}<span><b>Yhdistetty: ${esc(names.join(', '))}.</b> Uudet keskustelut näkevät ${names.length > 1 ? 'ne' : 'sen'} heti.</span></p>
${files.length ? `<p class="ig-p">Ensimmäinen synkronointi on käynnissä kansioon ${files.map(i => `<span class="mono">${esc(S[i].dir)}</span>`).join(' ja ')}. Se jatkuu, vaikka suljet sivun.</p>` : ''}
<div class="ig-row"><button type="button" class="primary" data-ig="fdone">Valmis</button></div>`;
}

// ---------- Flow containers: dialog (Tili), inline under the row (Palvelu), side sheet ----------
const dlg = document.createElement('dialog'); dlg.className = 'confirm ig-dlg'; document.body.appendChild(dlg);
const sheet = document.createElement('dialog'); sheet.className = 'ig-sheet'; document.body.appendChild(sheet);
const head = () => `<div class="ig-dh"><h3>${esc(flowTitle())}</h3><button type="button" class="icon-btn" data-ig="fcancel" aria-label="Sulje" title="Sulje">${ICON_CLOSE}</button></div>`;
for (const d of [dlg, sheet]) d.addEventListener('close', () => { if (FL) { cancelFlow(); render(); } });
function paintFlow(first) {
  if (!FL) { if (dlg.open) dlg.close(); if (sheet.open) sheet.close(); return render(); }
  const body = `<div class="ig-flow">${flowBody()}</div>`;
  if (CUR === 'v1') { dlg.innerHTML = head() + body; if (!dlg.open) dlg.showModal(); }
  else if (CUR === 'v3') { sheet.innerHTML = head() + body; if (!sheet.open) sheet.showModal(); }
  else { render(); if (first) requestAnimationFrame(() => document.querySelector('.ig-inline')?.scrollIntoView({ block: 'nearest' })); }
  if (CUR !== 'v2') render();
}
const inline = (id) => CUR === 'v2' && FL && FL.ids[0] === id ? `<div class="ig-inline">${head()}<div class="ig-flow">${flowBody()}</div></div>` : '';

// ---------- V1 Tili: provider accounts ----------
function v1Section() {
  const conn = Object.keys(PROV).filter(provOn), rest = Object.keys(PROV).filter(p => !provOn(p));
  const card = (p) => {
    const svcs = SVC.filter(s => s.p === p && on(s.id));
    const more = SVC.some(s => s.p === p && !on(s.id));
    const bad = svcs.some(s => ST[s.id].st === 'expired');
    return `<div class="ig-card"><div class="ig-acc">${mark(p)}<div><span class="ig-rn">${esc(PROV[p].name)}</span><span class="ig-meta">${esc(PROV[p].acct)}${PROV[p].org ? ` · ${esc(PROV[p].org)}` : ''}</span></div>
${bad ? `<button type="button" class="primary sm" data-ig="relogin:${p}">Kirjaudu uudelleen</button>` : ''}${more ? `<button type="button" class="secondary sm" data-ig="add:${p}">${IC.plus}Lisää palveluita</button>` : ''}<button type="button" class="ig-quiet" data-ig="check:${p}">${IC.sync}Tarkista</button><button type="button" class="ig-quiet" data-ig="rm:${p}">Poista…</button></div>
${svcs.map(s => `<div class="ig-svc"><span class="ig-ic sm">${IC[s.ic]}</span><div><span class="ig-rn">${esc(s.name)}</span><span class="ig-meta">${gets(s)}</span>${progressBar(s)}</div><div class="ig-sv">${status(s)}<span class="ig-meta">${checked(s)}</span></div></div>`).join('')}</div>`;
  };
  const tile = (p) => {
    const svcs = SVC.filter(s => s.p === p);
    return `<div class="ig-tile">${mark(p)}<div><span class="ig-rn">${esc(PROV[p].name)}</span><span class="ig-meta">${svcs.map(s => esc(s.name)).join(' · ')}</span></div><button type="button" class="secondary" data-ig="add:${p}">Yhdistä…</button></div>`;
  };
  return `<h2 class="ig-h2">Integraatiot</h2><p class="ig-intro">Liitä muiden palvelujen tilisi, niin agenttisi voivat käyttää niiden tiedostoja, postia ja kalentereita.</p>${WARN}
${conn.length ? `<h3 class="ig-h3">Yhdistetyt tilit</h3>${conn.map(card).join('')}` : ''}
${rest.length ? `<h3 class="ig-h3">Lisää tili</h3><div class="ig-tiles">${rest.map(tile).join('')}</div>` : ''}${FOOT}`;
}

// ---------- V2 Palvelu: one row per service ----------
function v2Section() {
  const group = (p) => {
    const acct = provOn(p) ? `<span class="ig-meta">${esc(PROV[p].acct)}</span>` : '';
    return `<div class="ig-group"><div class="ig-gh">${mark(p, ' sm')}<span>${esc(PROV[p].name)}</span>${acct}</div><ul class="ig-list">${SVC.filter(s => s.p === p).map(row).join('')}</ul></div>`;
  };
  const row = (s) => {
    const x = ST[s.id];
    const act = !x?.on ? `<button type="button" class="secondary sm" data-ig="add1:${s.id}"${FL && FL.ids[0] === s.id ? ' aria-disabled="true"' : ''}>Yhdistä…</button>`
      : `${x.st === 'expired' ? `<button type="button" class="primary sm" data-ig="relogin1:${s.id}">Kirjaudu uudelleen</button>` : ''}<button type="button" class="ig-quiet" data-ig="check1:${s.id}">${IC.sync}Tarkista</button><button type="button" class="ig-quiet" data-ig="rm1:${s.id}">Poista…</button>`;
    return `<li class="ig-li${x?.on ? '' : ' off'}"><span class="ig-ic">${IC[s.ic]}</span><div class="ig-lm"><span class="ig-rn">${esc(s.name)}</span><span class="ig-meta">${gets(s)}</span>${progressBar(s)}<span class="ig-stline">${status(s)}${checked(s) ? `<span class="ig-meta">${checked(s)}</span>` : ''}</span></div><div class="ig-act">${act}</div>${inline(s.id)}</li>`;
  };
  return `<h2 class="ig-h2">Integraatiot</h2><p class="ig-intro">Liitä muiden palvelujen tiedostot, posti ja kalenterit agenttiesi käyttöön, yksi kerrallaan.</p>${WARN}${Object.keys(PROV).map(group).join('')}${FOOT}`;
}

// ---------- V3 Mitä agentti saa: folders in the home, tools for mail and calendar ----------
function v3Section() {
  const files = SVC.filter(s => s.kind === 'files'), tools = SVC.filter(s => s.kind === 'tool');
  const used = synced();
  const seg = files.filter(s => on(s.id)).map(s => `<span class="ig-seg ig-${s.p}" style="width:${100 * size(s.id) / QUOTA}%" title="${esc(s.dir)} ${gb(size(s.id))}"></span>`).join('');
  const legend = files.filter(s => on(s.id)).map(s => `<span><i class="ig-dot ig-${s.p}"></i>${esc(s.dir)} ${gb(size(s.id))}</span>`).join('');
  const frow = (s) => {
    const x = ST[s.id];
    return `<li class="ig-li"><span class="ig-ic">${IC.folder}</span><div class="ig-lm"><span class="ig-rn mono">${esc(s.dir)}</span><span class="ig-meta">${mark(s.p, ' xs')} ${esc(s.name)} · ${esc(PROV[s.p].acct)} · ${(FOLDERS[s.id].filter(f => x.sel.includes(f.id)).map(f => esc(f.name))).join(', ')}</span>${progressBar(s)}<span class="ig-stline">${status(s)}<span class="ig-meta">${checked(s)}</span></span></div>
<div class="ig-act">${x.st === 'expired' ? `<button type="button" class="primary sm" data-ig="relogin1:${s.id}">Kirjaudu uudelleen</button>` : ''}<button type="button" class="ig-quiet" data-ig="check1:${s.id}">${IC.sync}Tarkista</button><button type="button" class="ig-quiet" data-ig="rm1:${s.id}">Poista…</button></div></li>`;
  };
  const trow = (s) => {
    const x = ST[s.id];
    return `<li class="ig-li"><span class="ig-ic">${IC[s.ic]}</span><div class="ig-lm"><span class="ig-rn">${esc(s.name)}</span><span class="ig-meta">${mark(s.p, ' xs')} ${esc(PROV[s.p].acct)} · ${gets(s)}</span><span class="ig-can">${s.can.map(c => `<span>${esc(c)}</span>`).join('')}</span><span class="ig-stline">${status(s)}<span class="ig-meta">${checked(s)}</span></span></div>
<div class="ig-act">${x.st === 'expired' ? `<button type="button" class="primary sm" data-ig="relogin1:${s.id}">Kirjaudu uudelleen</button>` : ''}<button type="button" class="ig-quiet" data-ig="check1:${s.id}">${IC.sync}Tarkista</button><button type="button" class="ig-quiet" data-ig="rm1:${s.id}">Poista…</button></div></li>`;
  };
  const addRow = (list, label) => {
    const rest = list.filter(s => !on(s.id));
    return rest.length ? `<div class="ig-add"><span class="ig-meta">${label}</span>${rest.map(s => `<button type="button" class="secondary sm" data-ig="add1:${s.id}">${mark(s.p, ' xs')}${esc(s.name)}</button>`).join('')}</div>` : '';
  };
  return `<h2 class="ig-h2">Integraatiot</h2><p class="ig-intro">Mitä agenttisi saavat muista palveluista: kansioita kotihakemistoon ja postin ja kalenterin työkaluiksi.</p>${WARN}
<h3 class="ig-h3">${IC.folder}Tiedostot kotihakemistossa</h3>
<div class="ig-card ig-disk"><div class="ig-diskh"><span class="ig-rn">Kotihakemisto</span><span class="ig-meta">${gb(used + OTHER)} / ${gb(QUOTA)} käytössä · synkronoidut kansiot ${gb(used)}</span></div>
<span class="ig-stack" aria-hidden="true">${seg}<span class="ig-seg other" style="width:${100 * OTHER / QUOTA}%"></span></span><span class="ig-legend">${legend}<span><i class="ig-dot other"></i>muut tiedostot ${gb(OTHER)}</span><span><i class="ig-dot free"></i>vapaana ${gb(free())}</span></span></div>
${files.some(s => on(s.id)) ? `<ul class="ig-list">${files.filter(s => on(s.id)).map(frow).join('')}</ul>` : ''}${addRow(files, 'Lisää kansio:')}
<h3 class="ig-h3">${IC.mailcal}Posti ja kalenterit agentin työkaluina</h3>
${tools.some(s => on(s.id)) ? `<ul class="ig-list">${tools.filter(s => on(s.id)).map(trow).join('')}</ul>` : ''}${addRow(tools, 'Lisää:')}${FOOT}`;
}

// ---------- Removal ----------
const rmDlg = document.createElement('dialog'); rmDlg.className = 'confirm ig-dlg sm'; document.body.appendChild(rmDlg);
let RM = null;
function askRemove(ids) {
  RM = ids;
  const p = S[ids[0]].p, P = PROV[p];
  const files = ids.filter(i => S[i].kind === 'files'), tools = ids.filter(i => S[i].kind === 'tool');
  const what = CUR === 'v1' ? `${P.name}-tili` : S[ids[0]].kind === 'files' && CUR === 'v3' ? S[ids[0]].dir : S[ids[0]].name;
  const lost = [];
  if (tools.length) lost.push(`Agentit eivät enää pääse palveluun ${tools.map(i => S[i].name).join(' ja ')}.`);
  if (files.length) lost.push(`Synkronointi pysähtyy, eivätkä muutokset enää kulje ${P.ill}.`);
  rmDlg.innerHTML = `<form method="dialog"><h3>Poistetaanko ${esc(what)}?</h3><p>${esc(lost.join(' '))} Kirjautuminen poistetaan tältä palvelimelta. ${esc(P.name)} muistaa antamasi luvan, kunnes perut sen ${esc(P.name)}-tilisi asetuksista.</p>
${files.map(i => `<label class="ig-check"><input type="checkbox" name="del-${i}"><span>Poista myös kansio <span class="mono">${esc(S[i].dir)}</span> (${gb(size(i))}). Muuten tiedostot jäävät kotihakemistoosi tavallisiksi tiedostoiksi.</span></label>`).join('')}
<div class="confirm-actions"><button class="secondary" value="cancel" autofocus>Peruuta</button><button class="ig-danger" value="ok">Poista</button></div></form>`;
  rmDlg.showModal();
}
rmDlg.addEventListener('close', () => {
  const ids = RM; RM = null; if (rmDlg.returnValue !== 'ok' || !ids) return; rmDlg.returnValue = '';
  const del = ids.filter(i => rmDlg.querySelector(`[name="del-${i}"]`)?.checked);
  for (const i of ids) delete ST[i];
  render();
  const kept = ids.filter(i => S[i].kind === 'files' && !del.includes(i));
  toast(kept.length ? `Poistettu. ${kept.map(i => S[i].dir).join(' ja ')} jäi kotihakemistoosi.` : 'Poistettu.');
});

// The tools' own checks: gog auth list --check, rclone about, onedrive --display-sync-status,
// ms-365-mcp-server --verify-login. An expired login stays expired; only a new sign-in fixes it.
function check(ids) {
  for (const i of ids) if (ST[i] && ST[i].st !== 'syncing') ST[i].chk = true;
  render();
  setTimeout(() => { for (const i of ids) if (ST[i]?.chk) { ST[i].chk = false; ST[i].at = now(); } render(); }, 700);
}

// ---------- Settings shell (production's shape) ----------
const NAV = [['tili', 'Tili', IC.user], ['laitteet', 'Laitteet', IC.devices], ['agentit', 'Agentit', IC.pi], ['yhteydet', 'Yhteydet', IC.link], ['integraatiot', 'Integraatiot', IC.plug], ['ulkoasu', 'Ulkoasu', IC.eye], ['tila', 'Tallennustila', IC.disk]];
const demo = () => `<div class="ig-demo page" aria-label="Prototyypin esitys"><span>Esitys</span><button type="button" data-ig="expireall">Googlen kirjautuminen vanhenee</button><button type="button" data-ig="reset">Alkutilaan</button></div>`;
function section() { return { v1: v1Section, v2: v2Section, v3: v3Section }[CUR]() + demo(); }
const settings = () => `<div class="ig-set"><nav class="ig-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>${NAV.map(([id, l, ic]) => `<a href="#" class="ig-nav-i" data-ig="sec:${id}"${id === SEC ? ' aria-current="true"' : ''}>${ic}<span>${l}</span></a>`).join('')}</nav><div class="ig-main">${section()}</div></div>`;
function render() {
  if (VIEW !== 'settings') return;
  const y = stage.scrollTop, f = document.activeElement?.dataset?.igi;
  stage.innerHTML = settings(); stage.scrollTop = y;
  if (f) { const el = stage.querySelector(`[data-igi="${f}"]`); el?.focus({ preventScroll: true }); }
}
APP.painted.push(() => {
  uiFrame.classList.toggle('ig-paged', VIEW === 'settings');
  if (VIEW !== 'settings') return;
  uiRail.querySelectorAll('.conv-row[aria-current]').forEach(a => a.removeAttribute('aria-current'));
  uiTop.innerHTML = `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button><div class="tb-title"><strong>Asetukset</strong></div>`;
});

// ---------- Events ----------
function login(sub) { FL.sub = 'checking'; clearInterval(FL.timer); paintFlow(); setTimeout(() => { if (FL && FL.sub === 'checking') next(); }, sub || 700); }
window.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('.proto-picker')) return;
  const stop = () => { e.preventDefault(); e.stopPropagation(); };
  if (t.closest('[data-p="settings"]')) { stop(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); VIEW = 'settings'; SEC = 'integraatiot'; paint(); return render(); }
  if (t.closest('[data-conv], [data-ws-add]')) { VIEW = 'conv'; cancelFlow(); return; }
  const k = t.closest('[data-ig]'); if (!k) return;
  stop();
  if (k.getAttribute('aria-disabled') === 'true') return;
  const [a, arg] = k.dataset.ig.split(/:(.*)/s);
  const ids = (p) => SVC.filter(s => s.p === p && on(s.id)).map(s => s.id);
  switch (a) {
    case 'sec': if (arg !== 'integraatiot') return toast('Muut osiot ovat ennallaan; tässä vedoksessa vain Integraatiot.'); return render();
    case 'add': return startFlow(arg, SVC.filter(s => s.p === arg && !on(s.id)).map(s => s.id));
    case 'add1': return startFlow(S[arg].p, [arg]);
    case 'relogin': return startFlow(arg, ids(arg).filter(i => ST[i].st === 'expired'), { relogin: true });
    case 'relogin1': { const g = S[arg].login; return startFlow(S[arg].p, SVC.filter(s => s.login === g && ST[s.id]?.st === 'expired').map(s => s.id), { relogin: true }); }
    case 'check': return check(ids(arg));
    case 'check1': return check([arg]);
    case 'rm': return askRemove(ids(arg));
    case 'rm1': return askRemove([arg]);
    case 'go': FL.ids = FL.ids.filter(i => !on(i)); buildSteps(); return next();
    case 'fcancel': cancelFlow(); return paintFlow();
    case 'fdone': FL = null; return paintFlow();
    case 'restart': FL.code = FL.code === 'K7QM2PXDW' ? 'R4TJ8NC2V' : 'K7QM2PXDW'; enterStep(); return paintFlow();
    case 'openpaste': FL.sub = 'paste'; clearInterval(FL.timer); FL.timer = setInterval(tickFlow, 1000); paintFlow(); return toast(`${PROV[FL.p].site} avautui uuteen välilehteen.`);
    case 'openms': return toast('login.microsoft.com/device avautui uuteen välilehteen.');
    case 'fill': FL.input = PROV[FL.p].back; FL.err = ''; return paintFlow();
    case 'fillwrong': FL.input = PROV[FL.p].wrong; FL.err = ''; return paintFlow();
    case 'paste': {
      const v = (stage.querySelector('[data-igi="paste"]') || document.querySelector('dialog[open] [data-igi="paste"]'))?.value.trim() ?? FL.input;
      FL.input = v;
      if (!v) { FL.err = 'Liitä ensin osoite, johon päädyit hyväksymisen jälkeen.'; return paintFlow(); }
      if (!v.startsWith(PROV[FL.p].prefix)) { FL.err = `Tämä on ${esc(PROV[FL.p].gen)} oma osoite. Liitä osoite, johon päädyit hyväksymisen jälkeen; se alkaa <span class="mono">${esc(PROV[FL.p].prefix)}</span>.`; return paintFlow(); }
      return login();
    }
    case 'msok': return login(900);
    case 'msconsent': clearInterval(FL.timer); FL.sub = 'consent'; return paintFlow();
    case 'msblocked': clearInterval(FL.timer); FL.sub = 'blocked'; return paintFlow();
    case 'expire': FL.left = 1; return tickFlow();
    case 'choose': return next();
    case 'copy': try { navigator.clipboard?.writeText(arg).catch(() => {}); } catch {} return toast(`Kopioitu: ${arg}`);
    case 'expireall': for (const i of ['gmail', 'gcal', 'gdrive']) if (ST[i]?.on) ST[i].st = 'expired'; render(); return toast('Googlen testisovelluksen kirjautumiset vanhenevat 7 päivässä; työkalu kertoo sen seuraavassa tarkistuksessa.');
    case 'reset': cancelFlow(); paintFlow(); initState(); return render();
  }
}, true);
document.addEventListener('change', (e) => {
  const c = e.target.closest?.('[data-igc]'); if (!c || !FL) return;
  const [a, id, f] = c.dataset.igc.split(':');
  if (a === 'svc') { FL.ids = c.checked ? [...new Set([...FL.ids, id])] : FL.ids.filter(x => x !== id); buildSteps(); }
  if (a === 'fold') { const s = FL.sel[id]; FL.sel[id] = c.checked ? [...s, f] : s.filter(x => x !== f); }
  paintFlow();
});
document.addEventListener('input', (e) => { if (e.target.dataset?.igi === 'paste' && FL) FL.input = e.target.value; });
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset?.igi === 'paste') { e.preventDefault(); document.querySelector('[data-ig="paste"]')?.click(); } });

const pick = (v) => () => {
  CUR = v; VIEW = 'settings'; SEC = 'integraatiot'; cancelFlow(); clearInterval(SYNC);
  if (dlg.open) dlg.close(); if (sheet.open) sheet.close(); if (rmDlg.open) rmDlg.close();
  initState(); UI.pop = false; paint(); following = false;
  requestAnimationFrame(() => { stage.scrollTop = 0; lastTop = 0; });
  return settings();
};
window.v1 = pick('v1'); window.v2 = pick('v2'); window.v3 = pick('v3');
})();
