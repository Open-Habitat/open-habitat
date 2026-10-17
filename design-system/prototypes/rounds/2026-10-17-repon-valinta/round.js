// Repon valinta ja kloonaus (proto-repo-selection, 17.10.2026). Sisältö on sama kaikissa
// suunnissa: luettelo (viimeksi päivitetyt, omat, northwind 64 repolla, tailspin), haku ja
// käyttäjän valitsema aikasuodatus, repon tiedot ennen kloonausta (näkyvyys, oletushaara,
// viimeisin push, koko, kohde, vapaa tila), suuren repon kevyt klooni ja kolme lopputulosta:
// reitti onnistuu, asset-archive epäonnistuu ensimmäisellä yrityksellä (GitHub katkaisee
// yhteyden) ja northwind-monorepo katkeaa palvelimen uudelleenkäynnistykseen 910 MiB:n kohdalla
// täydellä kloonilla. Suunnat eroavat vain siinä, missä kloonaus asuu.
(() => {
const ICON_GH = SVG('<path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>');
const ICON_FOLDER = SVG('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>');
const ICON_LOCK = SVG('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>');
const ICON_BRANCH = SVG('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10"/><path d="M18 10c0 4-6 3-12 7"/>');
const ICON_WARN = SVG('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5"/><path d="M12 17.2h.01"/>');
const ICON_OK = SVG('<path d="m5 12.5 4.5 4.5L19 7"/>');
const ICON_BACK = SVG('<path d="m14.5 6-6 6 6 6"/>');
const ICON_CHAT = SVG('<path d="M5 18.5V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8z"/>');
const ICON_RESTART = SVG('<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6"/><path d="M4 4v4.6h4.6"/>');

// ---------- Synthetic GitHub catalog (what /user/repos would return, all pages) ----------
// `mb` is GitHub's `size` (KiB, shown as MiB/GiB), `d` days since `pushed_at`.
const R = (full, d, mb, desc, priv = true, branch = 'main') => ({ full, owner: full.split('/')[0], name: full.split('/')[1], d, mb, desc, priv, branch });
const CATALOG = [
  R('maintainer/reitti', 0.04, 2.3, 'HSL-reittihaku komentoriviltä', false),
  R('jarimustonen/taskfleet', 1.1, 8.1, 'Agenttiworktreiden ajonhallinta', false),
  R('maintainer/kuitit', 3.2, 0.9, 'Kuittien nimeäminen ja arkistointi'),
  R('maintainer/wilma-cli', 12, 1.4, 'Wilma-viestit komentoriville'),
  R('maintainer/aurinkokello', 0.15, 4.6, 'Auringonnousu ja -lasku komentoriviltä', false),
  R('jarimustonen/issuectl', 0.6, 9.4, 'Issuet repossa, DAG aikatauluna', false),
  R('maintainer/fleetrepo', 0.2, 2.1, 'Koneiden konvergointi ja dotfiles'),
  R('Open-Habitat/open-habitat', 0.1, 610, 'Monen käyttäjän web-host natiiveille agenteille'),
  R('maintainer/kotisivu', 210, 46, 'jari.mustonen.fi', false, 'gh-pages'),
  R('maintainer/reseptikirja', 400, 2.1, 'Perheen reseptit Markdownina'),
  R('maintainer/tilastoharjoitus', 900, 18, 'Tilastotieteen harjoituksia R:llä', false, 'master'),
  R('northwind/northwind-monorepo', 0.1, 4300, 'Northwind-sovellus, palvelut ja sisältö yhdessä repossa'),
  R('northwind/asset-archive', 40, 2900, '3D-mallien ja tekstuurien lähdetiedostot (Git LFS)'),
  R('northwind/web-viewer', 2, 120, 'Selaimen 3D-katselin'),
  R('tailspin/kirjanpito', 20, 3.2, 'Kirjanpidon skriptit ja raportit'),
  R('tailspin/verkkosivut', 75, 12, 'tailspin.test', false),
  R('tailspin/sopimuspohjat', 300, 0.6, 'Sopimus- ja laskupohjat'),
];
['lesson-plans', 'classroom-api', 'teacher-portal', 'student-app', 'unity-ar', 'ios-app', 'android-app', 'auth-service', 'billing', 'analytics', 'docs', 'design-tokens', 'infra', 'terraform', 'qa-automation', 'export-service', 'import-tools', 'media-pipeline', 'renderer', 'scene-editor', 'model-converter', 'admin-console', 'lms-integration', 'sso-bridge', 'license-server', 'reports', 'i18n', 'plugins', 'sdk-js', 'sdk-unity', 'cli', 'public-api', 'worker', 'job-queue', 'search', 'mailer', 'pdf-export', 'print-service', 'content-library', 'marketplace', 'store-front', 'payments', 'demo-scenes', 'sandbox', 'legacy-web', 'prototype-vr', 'experiments', 'benchmarks', 'perf-lab', 'ci-templates', 'deploy', 'status-page', 'support-bot', 'onboarding', 'curriculum', 'assessment', 'feedback', 'school-admin', 'data-warehouse', 'brand', 'hackathon-2024']
  .forEach((n, i) => CATALOG.push(R(`northwind/${n}`, ((i * 37) % 700) + 1.5 + (i % 3) * 0.3, Math.round((((i * 53) % 180) + 0.4) * 10) / 10, '', i % 7 !== 3)));
const OWNERS = [['maintainer', 'Omat'], ['northwind', 'Organisaatio'], ['tailspin', 'Organisaatio']];
const FREE_MB = 6250, BIG_MB = 500;
const repo = (full) => CATALOG.find(r => r.full === full);

// ---------- Small helpers ----------
const size = (mb) => mb >= 1024 ? `${(mb / 1024).toFixed(1).replace('.', ',')} GiB` : mb >= 10 ? `${Math.round(mb)} MiB` : `${mb.toFixed(1).replace('.', ',')} MiB`;
function when(d) {
  if (d < 0.4) { const m = 9 * 60 + 40 - Math.round(d * 1440); return `tänään klo ${Math.floor(m / 60)}.${String(m % 60).padStart(2, '0')}`; }
  if (d < 1.5) return 'eilen';
  if (d < 30) return `${Math.round(d)} pv sitten`;
  const t = new Date(Date.UTC(2026, 9, 17) - d * 864e5); return `${t.getUTCDate()}.${t.getUTCMonth() + 1}.${t.getUTCFullYear()}`;
}
const wsOf = (r) => UI.ws.find(w => w.id === r.name);
const STAGE = { connecting: 'Yhdistetään GitHubiin', receiving: 'Vastaanotetaan objekteja', resolving: 'Puretaan muutoksia', checkout: 'Kirjoitetaan tiedostoja', verifying: 'Tarkistetaan' };

// ---------- State ----------
let CUR = 'v1', PAGE = { kind: 'home' };
const ST = { tab: 'gh', q: '', since: 0, more: {}, sel: null, detail: false, mode: {} };
const JOBS = {};
const BASE = UI.ws.slice();
const narrow = () => document.getElementById('wrap').classList.contains('phone');

// ---------- Catalog list ----------
function chipFor(r) {
  const j = JOBS[r.full], w = wsOf(r);
  if (j && (j.phase === 'running' || j.phase === 'lost')) return `<span class="rv-chip run" data-jc="${r.full}">${j.stage === 'receiving' ? `${Math.floor(j.pct)} %` : 'kloonataan'}</span>`;
  if (j && j.phase === 'cut') return '<span class="rv-chip warn">keskeytyi</span>';
  if (j && j.phase === 'failed') return '<span class="rv-chip warn">epäonnistui</span>';
  if (w && !w.clone && !w.broken) return '<span class="rv-chip ok">työtilana</span>';
  return '';
}
const row = (r) => `<li><button type="button" class="rv-row" data-rv="repo:${r.full}"${ST.sel === r.full ? ' aria-current="true"' : ''}><span class="rv-row-name"><span class="mono"><span class="rv-own">${r.owner}/</span><b>${esc(r.name)}</b></span>${r.priv ? `<span class="rv-lock" title="Yksityinen" aria-label="Yksityinen">${ICON_LOCK}</span>` : ''}${chipFor(r)}</span>${r.desc ? `<span class="rv-row-desc">${esc(r.desc)}</span>` : ''}<span class="rv-row-meta"><span>${when(r.d)}</span><span>${size(r.mb)}</span>${r.mb >= BIG_MB ? '<span class="rv-big">suuri</span>' : ''}</span></button></li>`;
const SINCE = [[0, 'Kaikki'], [30, '30 pv'], [90, '3 kk'], [365, 'Vuosi']];
function listHTML() {
  const q = ST.q.trim().toLowerCase();
  const fresh = (r) => !ST.since || r.d <= ST.since;
  const byPush = (a, b) => a.d - b.d;
  const filter = `<div class="rv-find"><label class="rv-search">${ICON_SEARCH}<input type="search" data-rvq placeholder="Hae nimellä tai kuvauksella" aria-label="Hae repoa" value="${esc(ST.q)}" autocomplete="off" spellcheck="false"></label><div class="rv-since" role="group" aria-label="Päivitetty">${SINCE.map(([d, l]) => `<button type="button" data-rv="since:${d}" aria-pressed="${ST.since === d}">${l}</button>`).join('')}</div></div>`;
  if (q) {
    const hits = CATALOG.filter(r => (r.full + ' ' + r.desc).toLowerCase().includes(q)).sort(byPush);
    const shown = hits.filter(fresh);
    return `${filter}<div class="rv-list">${shown.length ? `<section class="rv-sec"><h4>Hakutulokset <span class="rv-n">${shown.length}</span></h4><ul>${shown.map(row).join('')}</ul></section>` : `<p class="rv-empty">Ei osumia haulle <b>${esc(ST.q)}</b>${hits.length ? ` valitulla aikavälillä. ${hits.length} vanhempaa osumaa piilossa.` : '.'}</p>`}</div>`;
  }
  const recent = CATALOG.filter(r => r.d < 3 && !wsOf(r)).sort(byPush).slice(0, 4);
  const secs = OWNERS.map(([o, kind]) => {
    const all = CATALOG.filter(r => r.owner === o).sort(byPush), vis = all.filter(fresh);
    const open = ST.more[o], cut = open ? vis : vis.slice(0, 5);
    const hidden = all.length - vis.length;
    return `<section class="rv-sec"><h4><span class="mono">${o}</span><span class="rv-kind">${kind}</span><span class="rv-n">${all.length}</span></h4>${cut.length ? `<ul>${cut.map(row).join('')}</ul>` : ''}<p class="rv-secfoot">${vis.length > 5 ? `<button type="button" class="rv-link" data-rv="more:${o}">${open ? 'Näytä vähemmän' : `Näytä kaikki ${vis.length}`}</button>` : ''}${hidden ? `<span>${hidden} ei päivitetty valitulla aikavälillä</span>` : ''}</p></section>`;
  }).join('');
  return `${filter}<div class="rv-list">${recent.length ? `<section class="rv-sec"><h4>Viimeksi päivitetyt</h4><ul>${recent.map(row).join('')}</ul></section>` : ''}${secs}</div>`;
}

// ---------- Repo details before cloning ----------
const modeHTML = (r, label = 'Kloonataan') => `<fieldset class="rv-mode"><legend>${label}</legend><label><input type="radio" name="mode-${r.name}" data-rvmode="${r.full}" value="full"${(ST.mode[r.full] || 'full') === 'full' ? ' checked' : ''}><span><b>Koko historia</b> noin ${size(r.mb)}. Kaikki tiedostoversiot heti levylle.</span></label><label><input type="radio" name="mode-${r.name}" data-rvmode="${r.full}" value="light"${ST.mode[r.full] === 'light' ? ' checked' : ''}><span><b>Kevyt klooni</b> Kaikki commitit, mutta vanhat tiedostoversiot haetaan GitHubista vasta, kun niitä tarvitaan (<span class="mono">--filter=blob:none</span>). Nopeampi ja pienempi; <span class="mono">git log -p</span> ja <span class="mono">blame</span> vaativat yhteyden.</span></label></fieldset>`;
function detailHTML(r) {
  if (!r) return `<div class="rv-detail rv-none"><p>Valitse repo nähdäksesi sen tiedot ennen kloonausta.</p></div>`;
  const w = wsOf(r), j = JOBS[r.full];
  const back = narrow() || PAGE.kind === 'new' && narrowStage() ? `<button type="button" class="rv-back" data-rv="back">${ICON_BACK}Kaikki repot</button>` : '';
  const facts = `<dl class="rv-facts"><dt>Näkyvyys</dt><dd>${r.priv ? `${ICON_LOCK}Yksityinen` : 'Julkinen'}</dd><dt>Oletushaara</dt><dd><span class="mono">${r.branch}</span></dd><dt>Viimeisin push</dt><dd>${when(r.d)}</dd><dt>Koko</dt><dd>${size(r.mb)} <span class="rv-sub">GitHubin arvio pakatusta historiasta</span></dd><dt>Kohde</dt><dd><span class="mono">~/src/${esc(r.name)}</span></dd><dt>Vapaata</dt><dd>${size(FREE_MB)} <span class="rv-sub">kiintiöstä 8,0 GiB</span></dd></dl>`;
  let foot;
  if (w && !w.clone && !w.broken) foot = `<p class="rv-note ok">${ICON_OK}<span>Repo on jo työtilana <span class="mono">${esc(w.path)}</span>.</span></p><div class="rv-actions"><button type="button" class="primary" data-rv="openws:${r.name}">Avaa työtila</button></div>`;
  else if (j && j.phase !== 'done') foot = `<p class="rv-note">${ICON_INFO}<span>${j.phase === 'running' || j.phase === 'lost' ? 'Kloonaus on käynnissä.' : 'Edellinen kloonaus jäi kesken.'}</span></p><div class="rv-actions"><button type="button" class="secondary" data-rv="showjob:${r.full}">Näytä kloonaus</button></div>`;
  else {
    const big = r.mb >= BIG_MB;
    foot = `${big ? `<p class="rv-note warn">${ICON_WARN}<span><b>Suuri repo.</b> Täysi klooni vie ${size(r.mb)} ${Math.round(100 * r.mb / FREE_MB)} % vapaasta tilasta, ja haku kestää yhteydestä riippuen kymmeniä minuutteja.</span></p>${modeHTML(r)}` : ''}<div class="rv-actions"><button type="button" class="primary" data-rv="clone:${r.full}">${ICON_GH}Kloonaa työtilaksi</button></div><p class="rv-hint">Kloonataan sinun GitHub-tunnuksillasi. ${CUR === 'v1' ? 'Dialogi pysyy auki, kunnes kloonaus on valmis.' : CUR === 'v2' ? 'Kloonaus jatkuu palvelimella, vaikka poistut sivulta.' : 'Työtila tulee sivupalkkiin heti, ja kloonaus jatkuu palvelimella.'}</p>`;
  }
  return `<div class="rv-detail">${back}<h3 class="mono"><span class="rv-own">${r.owner}/</span>${esc(r.name)}</h3>${r.desc ? `<p class="rv-desc">${esc(r.desc)}</p>` : ''}${facts}${foot}</div>`;
}
function narrowStage() { return stage.clientWidth < 640; }
function pickerHTML(compact) {
  const tabs = `<div class="seg" role="tablist"><button type="button" role="tab" aria-selected="${ST.tab === 'gh'}" data-rv="tab:gh">${ICON_GH}Kloonaa GitHubista</button><button type="button" role="tab" aria-selected="${ST.tab === 'dir'}" data-rv="tab:dir">${ICON_FOLDER}Uusi hakemisto</button></div>`;
  if (ST.tab === 'dir') return `${tabs}<div class="rv-dir"><label class="fld"><span>Nimi</span><input class="mono" data-rvdir placeholder="uusi-projekti" autocomplete="off"></label><p class="rv-hint">Luodaan <span class="mono">~/src/&lt;nimi&gt;</span> ja alustetaan Git-repoksi.</p><div class="rv-actions"><button type="button" class="primary" data-rv="mkdir">Luo työtila</button></div></div>`;
  const one = compact && ST.detail && ST.sel;
  return `${tabs}<div class="rv-pick${one ? ' one' : ''}"><div class="rv-col">${one ? '' : listHTML()}</div>${!compact || one ? detailHTML(repo(ST.sel)) : ''}</div>`;
}

// ---------- A clone job: the same view wherever it lives ----------
function jobHTML(j, where) {
  const r = repo(j.full), dest = `~/src/${r.name}`;
  const live = j.phase === 'running' || j.phase === 'lost';
  const leave = where === 'dlg' ? 'Pidä dialogi auki: sen sulkeminen keskeyttäisi kloonauksen.' : 'Kloonaus jatkuu palvelimella, vaikka suljet selaimen. Avaamme työtilan, kun se on valmis.';
  const head = `<div class="rv-jhead"><span class="rv-jic ${j.phase}">${j.phase === 'done' ? ICON_OK : j.phase === 'cut' || j.phase === 'failed' ? ICON_WARN : '<span class="rv-spin" aria-hidden="true"></span>'}</span><div><strong class="mono">${esc(j.full)}</strong><span class="rv-jsub">${j.mode === 'light' ? 'kevyt klooni' : 'koko historia'} → <span class="mono">${dest}</span>${j.attempt > 1 ? ` · ${j.attempt}. yritys` : ''}</span></div></div>`;
  let body = '', acts = '';
  if (j.phase === 'running') {
    body = `<div class="rv-bar" role="progressbar" aria-label="Kloonauksen edistyminen" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.floor(j.pct)}"><span data-jb="${j.full}" style="width:${barPct(j)}%"></span></div><p class="rv-jline" role="status" data-jt="${j.full}">${jobLine(j)}</p><p class="rv-hint">${leave}</p>`;
    acts = j.confirm ? `<div class="rv-confirm"><span>Keskeytetäänkö? ${j.mb ? `Vastaanotetut ${size(j.mb)} poistetaan` : 'Mitään ei ole vielä vastaanotettu'}, eikä keskeneräistä jää levylle.</span><button type="button" class="secondary" data-rv="keep:${j.full}">Jatka kloonausta</button><button type="button" class="danger" data-rv="cancel:${j.full}">Keskeytä</button></div>` : `<div class="rv-actions"><button type="button" class="secondary" data-rv="askcancel:${j.full}">Keskeytä</button></div>`;
  } else if (j.phase === 'lost') {
    body = `<div class="rv-bar paused" aria-hidden="true"><span style="width:${barPct(j)}%"></span></div><p class="rv-jline" role="status"><span class="rv-spin" aria-hidden="true"></span>Yhteys palvelimeen katkesi kohdassa ${Math.floor(j.pct)} %. Yhdistetään uudelleen…</p>`;
  } else if (j.phase === 'cut') {
    body = `<p class="rv-jtitle">Kloonaus keskeytyi: palvelin käynnistyi uudelleen</p><p>Palvelin käynnistyi uudelleen klo ${j.at}, kun ${size(j.mb)} oli vastaanotettu. Hakemistossa <span class="mono">${dest}</span> on keskeneräinen <span class="mono">.git</span> (${size(j.mb)}) ilman yhtään committia tai tiedostoa. Git ei osaa jatkaa keskeytynyttä kloonausta, joten uusi yritys alkaa alusta.</p>${r.mb >= BIG_MB ? modeHTML(r, 'Uusi yritys') : ''}`;
    acts = `<div class="rv-actions"><button type="button" class="secondary" data-rv="discard:${j.full}">Poista keskeneräinen (${size(j.mb)})</button><button type="button" class="primary" data-rv="retry:${j.full}">${ICON_RESTART}Aloita alusta</button></div>`;
  } else if (j.phase === 'failed') {
    body = `<p class="rv-jtitle">Kloonaus epäonnistui: GitHub katkaisi yhteyden</p><p>Yhteys GitHubiin katkesi kohdassa ${Math.floor(j.pct)} % (<span class="mono">early EOF</span>). Keskeneräinen hakemisto poistettiin, joten levylle ei jäänyt mitään ja uusi yritys alkaa puhtaalta pöydältä.</p>`;
    const other = where === 'dlg' ? `<button type="button" class="secondary" data-rv="other:${j.full}">Valitse toinen repo</button>` : `<button type="button" class="secondary" data-rv="dismiss:${j.full}">${where === 'ws' ? 'Poista työtila' : 'Poista ilmoitus'}</button>`;
    acts = `<div class="rv-actions">${other}<button type="button" class="primary" data-rv="retry:${j.full}">${ICON_RESTART}Yritä uudelleen</button></div>`;
  } else if (j.phase === 'done') {
    body = `<p class="rv-jtitle">Valmis</p><p>${size(j.disk)} levyllä, haara <span class="mono">${r.branch}</span> on haettu.</p>`;
    acts = `<div class="rv-actions"><button type="button" class="secondary" data-rv="dismiss:${j.full}">Sulje</button><button type="button" class="primary" data-rv="openws:${r.name}">Avaa työtila</button></div>`;
  }
  return `<div class="rv-job ${j.phase}${live ? ' live' : ''}">${head}${body}${acts}</div>`;
}
const barPct = (j) => j.stage === 'receiving' ? j.pct * 0.8 : j.stage === 'connecting' ? 2 : j.stage === 'resolving' ? 80 + j.pct * 0.08 : j.stage === 'checkout' ? 88 + j.pct * 0.1 : 99;
const jobLine = (j) => `${STAGE[j.stage]}${j.stage === 'connecting' || j.stage === 'verifying' ? '…' : ` ${Math.floor(j.pct)} %`}${j.mb ? ` · ${size(j.mb)} vastaanotettu` : ''}`;

// ---------- Simulated native clone ----------
// Durations are compressed: the outcome rules are what matter.
const PLAN = (j) => { const r = repo(j.full), total = j.mode === 'light' ? r.mb * 0.16 : r.mb; return { total, steps: [['connecting', 700], ['receiving', Math.min(9000, 1800 + total * 1.6)], ['resolving', 900], ['checkout', 900], ['verifying', 500]] }; };
function startJob(full) {
  const prev = JOBS[full];
  const j = JOBS[full] = { full, mode: ST.mode[full] || 'full', phase: 'running', stage: 'connecting', pct: 0, mb: 0, t: 0, attempt: (prev?.attempt || 0) + 1 };
  return j;
}
setInterval(() => {
  for (const j of Object.values(JOBS)) {
    if (j.phase === 'lost') { j.t += 200; if (j.t >= j.lostUntil) { j.phase = 'cut'; j.at = '9.41'; setConn(true); changed(j); } continue; }
    if (j.phase !== 'running') continue;
    j.t += 200;
    const { total, steps } = PLAN(j); let acc = 0, done = true;
    for (const [s, ms] of steps) { if (j.t < acc + ms) { j.stage = s; j.pct = Math.min(100, 100 * (j.t - acc) / ms); done = false; break; } acc += ms; }
    if (j.stage === 'receiving') j.mb = total * j.pct / 100; else if (j.stage !== 'connecting') j.mb = total;
    if (j.full === 'northwind/asset-archive' && j.attempt === 1 && j.stage === 'receiving' && j.pct >= 31) { j.phase = 'failed'; changed(j); continue; }
    if (j.full === 'northwind/northwind-monorepo' && j.attempt === 1 && j.mode === 'full' && j.stage === 'receiving' && j.mb >= 910) { j.mb = 910; j.phase = 'lost'; j.lostUntil = j.t + 2600; setConn(false); if (CUR === 'v1') brokenWs(j); changed(j); continue; }
    if (done) { j.phase = 'done'; j.disk = j.mode === 'light' ? total * 1.6 : total * 1.35; finish(j); continue; }
    sync(j);
  }
}, 200);
function sync(j) {
  document.querySelectorAll(`[data-jt="${j.full}"]`).forEach(e => { e.textContent = jobLine(j); });
  document.querySelectorAll(`[data-jb="${j.full}"]`).forEach(e => { e.style.width = barPct(j) + '%'; e.parentElement.setAttribute('aria-valuenow', Math.floor(j.pct)); });
  document.querySelectorAll(`[data-jc="${j.full}"], [data-jr="${j.full}"]`).forEach(e => { e.textContent = j.stage === 'receiving' ? `${Math.floor(j.pct)} %` : e.dataset.jr ? '…' : 'kloonataan'; });
}
function setConn(ok) {
  const c = uiRail.querySelector('.conn'); if (!c) return;
  c.innerHTML = ok ? '<span class="st-dot ok"></span>Yhdistetty' : '<span class="rv-spin sm" aria-hidden="true"></span>Yhdistetään…';
}
// After a restart the native directory is still there; in V1 it is a workspace like any other.
function brokenWs(j) { const r = repo(j.full); if (!wsOf(r)) UI.ws.push({ id: r.name, path: `~/src/${r.name}`, open: false, convs: [], broken: j.full }); }
function finish(j) {
  const r = repo(j.full); let w = wsOf(r);
  if (!w) { w = { id: r.name, path: `~/src/${r.name}`, open: true, convs: [] }; UI.ws.push(w); }
  delete w.clone; delete w.broken; w.fresh = j;
  if (CUR === 'v1') { delete JOBS[j.full]; if (dlg.open) { dlg.close(); PAGE = { kind: 'ws', id: r.name }; show(); } else render(); return toast(`Valmis: ${r.full} → ~/src/${r.name}`); }
  if (CUR === 'v3') { delete JOBS[j.full]; render(); if (!(PAGE.kind === 'ws' && PAGE.id === r.name)) toast(`${r.name} on valmis.`); return; }
  render(); toast(`${r.name} on kloonattu.`);
}
function changed(j) { render(); }

// ---------- Pages ----------
function homePage() {
  return `<div class="rv-page"><header class="rv-ph"><div><h1>Työtilat</h1><p class="rv-sub">${UI.ws.length} työtilaa</p></div><button type="button" class="primary" data-rv="new">Uusi työtila</button></header><ul class="rv-wslist">${UI.ws.map(w => `<li><a href="#" data-rv="openws:${w.id}"><span class="mono">${esc(w.id)}</span>${wsMark(w)}<span class="rv-sub mono">${esc(w.path)}</span></a></li>`).join('')}</ul></div>`;
}
function wsMark(w) {
  const j = JOBS[w.clone || w.broken];
  if (w.broken && !j) return `<span class="rv-wsmark warn" title="Keskeneräinen klooni">${ICON_WARN}</span>`;
  if (!j) return '';
  if (j.phase === 'running' || j.phase === 'lost') return `<span class="rv-wsmark run" data-jr="${j.full}">${j.stage === 'receiving' ? `${Math.floor(j.pct)} %` : '…'}</span>`;
  if (j.phase === 'cut' || j.phase === 'failed') return `<span class="rv-wsmark warn" title="${j.phase === 'cut' ? 'Kloonaus keskeytyi' : 'Kloonaus epäonnistui'}">${ICON_WARN}</span>`;
  return '';
}
function wsPage(w) {
  const head = `<header class="rv-ph"><div><h1 class="mono">${esc(w.id)}</h1><p class="rv-sub mono">${esc(w.path)}</p></div>${w.clone || w.broken ? '' : `<button type="button" class="primary" data-ws-add="${w.id}">${ICON_PLUS}Uusi keskustelu</button>`}</header>`;
  const j = JOBS[w.clone || w.broken];
  if (j) return `<div class="rv-page">${head}${jobHTML(j, 'ws')}${w.clone ? '<p class="rv-hint">Keskustelut voi aloittaa, kun kloonaus on valmis.</p>' : ''}</div>`;
  if (w.broken) return `<div class="rv-page">${head}<div class="rv-job cut"><p class="rv-jtitle">Keskeneräinen klooni</p><p>Hakemistossa on <span class="mono">.git</span> ilman yhtään committia tai tiedostoa.</p></div></div>`;
  const r = CATALOG.find(x => x.name === w.id);
  const fresh = w.fresh ? `<p class="rv-note ok">${ICON_OK}<span>Kloonattu juuri: ${size(w.fresh.disk)} levyllä${w.fresh.mode === 'light' ? ', kevyt klooni' : ''}.</span></p>` : '';
  return `<div class="rv-page">${head}<p class="rv-git">${ICON_BRANCH}<span class="mono">${r?.branch || 'main'}</span>${r ? `<span class="rv-sub">origin <span class="mono">${r.full}</span></span>` : ''}</p>${fresh}${w.convs.length ? `<ul class="rv-convs">${w.convs.map(c => `<li><a href="#" data-conv="${c.id}">${ICON_CHAT}<span>${esc(c.title)}</span></a></li>`).join('')}</ul>` : '<p class="rv-empty">Ei vielä keskusteluja. Aloita uusi keskustelu, niin Pi käynnistyy tässä hakemistossa.</p>'}</div>`;
}
// V2: the clone page. Jobs live at its top; the picker is the rest of the page.
function newPage() {
  const jobs = Object.values(JOBS);
  return `<div class="rv-page wide"><header class="rv-ph"><div><h1>Uusi työtila</h1><p class="rv-sub">Kloonaa GitHub-repo tai luo tyhjä hakemisto kotihakemistoosi <span class="mono">~/src</span>.</p></div></header>${jobs.length ? `<section class="rv-jobs"><h2 class="rv-h2">Kloonaukset</h2>${jobs.map(j => jobHTML(j, 'page')).join('')}</section>` : ''}<section class="rv-card">${pickerHTML(narrowStage())}</section></div>`;
}
function body() {
  if (PAGE.kind === 'new' && CUR === 'v2') return newPage();
  if (PAGE.kind === 'ws') { const w = UI.ws.find(x => x.id === PAGE.id); if (w) return wsPage(w); }
  return homePage();
}

// ---------- V1 and V3: the dialog ----------
const dlg = document.createElement('dialog'); dlg.className = 'confirm rv-dlg'; uiMain.appendChild(dlg);
let DJOB = null; // V1: the job this dialog is showing
function paintDlg() {
  dlg.classList.toggle('narrow', narrow());
  const j = DJOB && JOBS[DJOB];
  dlg.classList.toggle('job', !!j);
  const top = `<div class="rv-dhead"><h3>${j ? 'Kloonataan työtilaksi' : 'Uusi työtila'}</h3><button type="button" class="icon-btn" data-rv="close" aria-label="Sulje" title="${j && (j.phase === 'running' || j.phase === 'lost') ? 'Keskeytä ensin' : 'Sulje'}"${j && (j.phase === 'running' || j.phase === 'lost') ? ' aria-disabled="true"' : ''}>${ICON_CLOSE}</button></div>`;
  dlg.innerHTML = `${top}<div class="rv-dbody">${j ? jobHTML(j, 'dlg') : pickerHTML(narrow())}</div>`;
}
function openDlg() { DJOB = null; ST.detail = false; paintDlg(); dlg.showModal(); dlg.querySelector('[data-rvq]')?.focus(); }
dlg.addEventListener('cancel', (e) => { const j = DJOB && JOBS[DJOB]; if (j && (j.phase === 'running' || j.phase === 'lost')) e.preventDefault(); });
dlg.addEventListener('close', () => { if (DJOB && JOBS[DJOB]?.phase === 'failed') delete JOBS[DJOB]; DJOB = null; render(); });

// ---------- Rendering ----------
function render() {
  paintRail();
  if (dlg.open) { const f = keepFocus(dlg); paintDlg(); f(); }
  if (PAGE.kind !== 'conv') { const f = keepFocus(stage), y = stage.scrollTop; stage.innerHTML = body(); stage.scrollTop = y; f(); }
}
function keepFocus(root) {
  const a = document.activeElement; if (!a || !root.contains(a) || !a.matches('[data-rvq], [data-rvdir]')) return () => {};
  const sel = a.matches('[data-rvq]') ? '[data-rvq]' : '[data-rvdir]', s = a.selectionStart;
  return () => { const b = root.querySelector(sel); if (b) { b.focus(); b.setSelectionRange(s, s); } };
}
function show() { UI.drawer = false; UI.pop = false; paint(); following = false; stage.innerHTML = body(); stage.scrollTop = 0; lastTop = 0; }

// Sidebar: clone marks on workspace rows; V2 adds the running and unfinished clones.
const libPaintRail = window.paintRail;
window.paintRail = function () {
  libPaintRail();
  if (PAGE.kind !== 'conv') uiRail.querySelectorAll('.conv-row[aria-current]').forEach(a => a.removeAttribute('aria-current'));
  uiRail.querySelectorAll('.ws').forEach(s => {
    const id = s.querySelector('[data-ws-tog]').dataset.wsTog, w = UI.ws.find(x => x.id === id), row = s.querySelector('.ws-row');
    row.toggleAttribute('data-current', PAGE.kind === 'ws' && PAGE.id === id);
    if (w && (w.clone || w.broken)) { row.querySelector('.ws-more')?.remove(); row.querySelector('.ws-add')?.remove(); row.insertAdjacentHTML('beforeend', wsMark(w)); }
  });
  uiRail.querySelector('.rv-railjobs')?.remove();
  const jobs = Object.values(JOBS).filter(j => j.phase !== 'done');
  if (CUR === 'v2' && jobs.length) uiRail.querySelector('.rail-list').insertAdjacentHTML('beforebegin', `<a href="#" class="rv-railjobs" data-rv="newpage"${PAGE.kind === 'new' ? ' aria-current="page"' : ''}>${jobs.map(j => { const live = j.phase === 'running' || j.phase === 'lost'; return `<span class="rv-rj">${live ? '<span class="rv-spin sm" aria-hidden="true"></span>' : `<span class="rv-rj-warn">${ICON_WARN}</span>`}<span class="mono">${esc(repo(j.full).name)}</span>${live ? `<span class="rv-rj-p" data-jr="${j.full}">${j.stage === 'receiving' ? `${Math.floor(j.pct)} %` : '…'}</span>` : `<span class="rv-rj-p">${j.phase === 'cut' ? 'keskeytyi' : 'epäonnistui'}</span>`}</span>`; }).join('')}</a>`);
};
APP.painted.push(() => {
  uiFrame.classList.toggle('rv-paged', PAGE.kind !== 'conv');
  if (PAGE.kind === 'conv') return;
  uiRail.querySelectorAll('.conv-row[aria-current]').forEach(a => a.removeAttribute('aria-current'));
  const t = PAGE.kind === 'ws' ? `<strong class="mono">${esc(PAGE.id)}</strong>` : PAGE.kind === 'new' ? '<strong>Uusi työtila</strong>' : '<strong>Etusivu</strong>';
  uiTop.innerHTML = `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button><div class="tb-title">${t}</div>`;
});

// ---------- Actions ----------
function newWorkspace() { if (CUR === 'v2') { PAGE = { kind: 'new' }; ST.detail = false; return show(); } openDlg(); }
function startClone(full) {
  const r = repo(full);
  const j = startJob(full);
  if (CUR === 'v1') { DJOB = full; if (!dlg.open) { paintDlg(); dlg.showModal(); } return render(); }
  if (CUR === 'v3') {
    let w = wsOf(r); if (!w) { w = { id: r.name, path: `~/src/${r.name}`, open: false, convs: [] }; UI.ws.push(w); }
    w.clone = full; if (dlg.open) dlg.close(); PAGE = { kind: 'ws', id: r.name }; return show();
  }
  ST.detail = false; render(); stage.scrollTop = 0; return j;
}
function drop(full, msg) {
  const r = repo(full), w = wsOf(r); delete JOBS[full];
  if (w && (w.clone || w.broken)) { UI.ws.splice(UI.ws.indexOf(w), 1); if (PAGE.kind === 'ws' && PAGE.id === w.id) PAGE = CUR === 'v2' ? { kind: 'new' } : { kind: 'home' }; }
  if (msg) toast(msg);
}
async function act(a, arg, el) {
  switch (a) {
    case 'new': return newWorkspace();
    case 'newpage': PAGE = { kind: 'new' }; return show();
    case 'close': if (el.getAttribute('aria-disabled') === 'true') return toast('Keskeytä kloonaus ensin; dialogin sulkeminen katkaisisi sen.'); return dlg.close();
    case 'tab': ST.tab = arg; return render();
    case 'since': ST.since = Number(arg); return render();
    case 'more': ST.more[arg] = !ST.more[arg]; return render();
    case 'repo': ST.sel = arg; ST.detail = true; render(); return (dlg.open ? dlg : stage).querySelector('.rv-detail')?.scrollIntoView({ block: 'nearest' });
    case 'back': ST.detail = false; return render();
    case 'clone': return startClone(arg);
    case 'askcancel': JOBS[arg].confirm = true; return render();
    case 'keep': JOBS[arg].confirm = false; return render();
    case 'cancel': drop(arg, 'Kloonaus keskeytetty. Keskeneräinen hakemisto poistettiin.'); if (CUR === 'v1') { DJOB = null; return render(); } return show();
    case 'retry': { const j = JOBS[arg]; ST.mode[arg] = ST.mode[arg] || j.mode; if (j.phase === 'cut') { const w = wsOf(repo(arg)); if (w?.broken) UI.ws.splice(UI.ws.indexOf(w), 1); toast(`Keskeneräinen poistettu (${size(j.mb)}). Aloitetaan alusta.`); } return startClone(arg); }
    case 'discard': { const j = JOBS[arg]; drop(arg, `Keskeneräinen ~/src/${repo(arg).name} poistettu. ${size(j.mb)} vapautui.`); if (CUR === 'v1' && dlg.open) dlg.close(); return show(); }
    case 'dismiss': { const j = JOBS[arg]; drop(arg); if (j?.phase === 'done' && CUR === 'v2') return render(); return show(); }
    case 'other': delete JOBS[arg]; DJOB = null; ST.detail = false; return render();
    case 'showjob': { const r = repo(arg); if (CUR === 'v1') { DJOB = arg; return render(); } if (CUR === 'v2') { ST.detail = false; render(); return stage.scrollTop = 0; } if (dlg.open) dlg.close(); PAGE = { kind: 'ws', id: r.name }; return show(); }
    case 'openws': if (dlg.open) dlg.close(); if (CUR === 'v2') { const r = CATALOG.find(x => x.name === arg); if (r && JOBS[r.full]?.phase === 'done') delete JOBS[r.full]; } PAGE = { kind: 'ws', id: arg }; return show();
    case 'mkdir': {
      const v = (dlg.open ? dlg : stage).querySelector('[data-rvdir]').value.trim();
      if (!/^[a-z0-9][a-z0-9._-]*$/.test(v)) return toast('Tarkista nimi: pienet kirjaimet, numerot, . _ -');
      if (UI.ws.some(w => w.id === v)) return toast(`~/src/${v} on jo olemassa.`);
      UI.ws.push({ id: v, path: `~/src/${v}`, open: true, convs: [] }); if (dlg.open) dlg.close(); PAGE = { kind: 'ws', id: v }; show(); return toast(`Työtila ${v} luotu.`);
    }
  }
}
window.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('.proto-picker')) return;
  const stop = () => { e.preventDefault(); e.stopPropagation(); };
  if (t.closest('[data-p="nws"]')) { stop(); return newWorkspace(); }
  const wsName = t.closest('.ws-name[data-ui="ws"]');
  if (wsName) { stop(); PAGE = { kind: 'ws', id: wsName.closest('.ws').querySelector('[data-ws-tog]').dataset.wsTog }; return show(); }
  if (t.closest('[data-ui="home"]')) { stop(); PAGE = { kind: 'home' }; return show(); }
  if (t.closest('[data-conv], [data-ws-add]')) { if (dlg.open) dlg.close(); PAGE = { kind: 'conv' }; return; }
  const r = t.closest('[data-rv]');
  if (r) { stop(); const [a, arg] = r.dataset.rv.split(/:(.*)/s); return act(a, arg, r); }
}, true);
document.addEventListener('input', (e) => {
  if (e.target.matches('[data-rvq]')) { ST.q = e.target.value; ST.detail = false; render(); }
});
document.addEventListener('change', (e) => {
  if (e.target.matches('[data-rvmode]')) ST.mode[e.target.dataset.rvmode] = e.target.value;
});
document.getElementById('phone').addEventListener('change', () => { ST.detail = false; render(); });

const pick = (v) => () => {
  CUR = v; if (dlg.open) dlg.close();
  for (const k of Object.keys(JOBS)) delete JOBS[k];
  UI.ws.splice(0, UI.ws.length, ...BASE); BASE.forEach(w => { delete w.fresh; });
  ST.sel = null; ST.detail = false; ST.q = ''; setConn(true);
  PAGE = v === 'v2' ? { kind: 'new' } : { kind: 'home' };
  UI.pop = false; paint(); following = false; requestAnimationFrame(() => { stage.scrollTop = 0; lastTop = 0; });
  return body();
};
window.v1 = pick('v1'); window.v2 = pick('v2'); window.v3 = pick('v3');
})();
