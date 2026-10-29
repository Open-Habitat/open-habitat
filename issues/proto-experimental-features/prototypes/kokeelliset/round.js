// Prototype round proto-experimental-features: the Kokeelliset ominaisuudet settings
// section and the three features behind it. Hand-written, synthetic data, no network.
// Axis: where an experimental feature explains itself.
//   0 Rivit    – settings rows like Editori; the feature is unmarked where it appears.
//   1 Merkki   – the same rows; where it appears a Kokeellinen tag explains it and turns it off.
//   2 Esittely – a card per feature in settings with a picture, where, and what it needs;
//                unmarked where it appears.
// The same in all: off by default, saved to the account (all devices), takes effect at once.

const I = {
  flask: '<path d="M9 3h6M10 3v6.2L4.6 18.4A1.7 1.7 0 0 0 6.1 21h11.8a1.7 1.7 0 0 0 1.5-2.6L14 9.2V3"/><path d="M7.2 15h9.6"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5"/>',
  devices: '<rect x="2.5" y="5" width="13" height="10" rx="1.5"/><path d="M1.5 18h10"/><rect x="16" y="8" width="6" height="12" rx="1.5"/>',
  agent: '<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M9 13h.01M15 13h.01"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  code: '<path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/><path d="M13.5 5l-3 14"/>',
  plug: '<path d="M9 2v5M15 2v5"/><path d="M6 7h12v4a6 6 0 0 1-12 0z"/><path d="M12 17v5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.5"/>',
  editor: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16m5-11-2 3 2 3m3-6 2 3-2 3"/>',
  disk: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 14h18M7 17h.01"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5"/><path d="M15.5 5.5a3 3 0 0 1 0 5.5M17 14.6c1.8.5 3 1.9 3.5 4.4"/>',
  cross: '<path d="M5 5 19 19M19 5 5 19"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  home: '<path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 8 4 4-4 4M14 16h3"/>',
  worktree: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10M18 10c0 4-6 3-12 7"/>',
  forward: '<path d="M9 5l7 7-7 7"/>',
  external: '<path d="M13 5h6v6M19 5l-9 9"/><path d="M19 14v5H5V5h5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  send: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
};
const ic = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${I[n]}</svg>`;

// The three features, in the order of their implementation issues.
const FEATURES = [
  {
    id: 'next', key: 'next-waiting-row', name: 'Seuraava odottava keskustelu',
    desc: 'Kun olet vastannut ja agentti on aloittanut, kentän yläpuolelle tulee seuraava sinua odottava keskustelu.',
    where: 'Keskustelun alareunassa, kirjoituskentän yläpuolella, kun agentti työskentelee.',
    shows: 'Keskustelun nimen, miksi se odottaa ja Avaa-painikkeen (Alt+↓).',
    needs: 'Ei muuta. Järjestys seuraa toistaiseksi sivupalkkia.',
    view: 'ilta',
  },
  {
    id: 'sentence', key: 'worker-row-sentence', name: 'Workerin työ rivillä',
    desc: 'Workerin rivi kertoo sanoin, onko se jo tehnyt jotain: commitit, muutokset ja pull requestin tarkistukset.',
    where: 'Workerit-paneelin riveillä ja sivupalkin worktree-keskusteluissa.',
    shows: '”2 committia · 3 muutosta”, ”PR #412 luonnos, tarkistukset käynnissä” tai ”ei vielä muutoksia”.',
    needs: 'PR-tiedot näkyvät, kun gh on kirjautunut (Koodipalvelut).',
    view: 'ilta',
  },
  {
    id: 'mirror', key: 'terminal-watch', name: 'Päätteen Pi:n katselu',
    desc: 'Päätteessä käynnissä olevan Pi:n tmux-ikkunaa voi katsoa selaimen päätepaneelissa. Selain ei kirjoita siihen.',
    where: 'Päätteessä aloitetun keskustelun alareunassa: Katso päätteessä.',
    shows: 'Tmux-ikkunan sellaisenaan päätepaneelin välilehdellä, vain luku.',
    needs: 'Pi käynnissä tmuxissa samalla käyttäjällä. Ilman tmuxia painiketta ei ole.',
    view: 'status',
  },
];
const F = Object.fromEntries(FEATURES.map((f) => [f.id, f]));

const fresh = () => ({
  v: 0, view: 'settings', from: 'ilta', section: 'kokeelliset', detail: true,
  flags: { next: false, sentence: false, mirror: false },
  busy: null, error: null, saved: null, pop: null, toast: null,
  menu: false, drawer: false, panel: true, dock: false, landed: null,
});
let S = fresh();
let theme = 'light';
const phone = () => matchMedia('(max-width: 760px)').matches;

function paint() {
  stage.innerHTML = draw();
  if (S.focus) {
    stage.querySelector(S.focus)?.focus();
    S.focus = null;
  }
}

const variants = [0, 1, 2].map((v) => () => {
  S.v = v; S.pop = null; S.toast = null;
  return draw();
});

// ---------- shared pieces ----------
const seg = (id, on, disabled) => `<fieldset class="segmented" aria-label="${F[id].name}" data-testid="exp-${id}">
  <button type="button" class="segment" data-a="set" data-k="${id}" data-on="0" aria-pressed="${!on}"${disabled ? ' disabled' : ''}>Pois</button>
  <button type="button" class="segment" data-a="set" data-k="${id}" data-on="1" aria-pressed="${on}"${disabled ? ' disabled' : ''}>Päällä</button>
</fieldset>`;

function rowNote(id) {
  if (S.busy === id) return '<p class="s-note" role="status">Tallennetaan…</p>';
  if (S.error === id) return `<div class="s-note" role="alert" data-testid="exp-error">Valintaa ei voitu tallentaa. Lue tallennettu valinta ennen uutta yritystä. <button type="button" class="btn secondary small" data-a="reload">Lue tallennettu valinta</button></div>`;
  if (S.saved === id) return `<p class="s-note" role="status">${S.flags[id] ? 'Käytössä nyt kaikilla laitteillasi.' : 'Pois käytöstä kaikilla laitteillasi.'}</p>`;
  return '';
}

const intro = '<p class="s-intro">Keskeneräisiä ominaisuuksia, joita voit kokeilla jo nyt. Ne voivat vielä muuttua tai poistua. Valinnat tallentuvat tilillesi ja koskevat kaikkia laitteitasi.</p>';

function expTag(id, down) {
  if (S.v !== 1) return '';
  const open = S.pop === id;
  return `<span class="exp-anchor"><button type="button" class="exp-tag" data-a="pop" data-k="${id}" aria-haspopup="dialog" aria-expanded="${open}" aria-label="Kokeellinen ominaisuus: ${F[id].name}" data-testid="tag-${id}">${ic('flask')}<span class="w">Kokeellinen</span></button>${open ? `<div class="exp-pop${down ? ' down' : ''}" role="dialog" aria-label="${F[id].name}" data-testid="pop-${id}">
    <h3>${ic('flask')}${F[id].name}</h3>
    <p>Kokeellinen ominaisuus. Se on vielä kesken ja voi muuttua tai poistua.</p>
    <div class="acts"><button type="button" class="btn secondary small" data-a="pop-off" data-k="${id}">Poista käytöstä</button><button type="button" class="btn quiet small" data-a="to-settings" data-k="${id}">Asetukset ${ic('forward')}</button></div>
  </div>` : ''}</span>`;
}

// ---------- settings ----------
const SECTIONS = [
  ['tili', 'Tili', 'user'], ['laitteet', 'Laitteet', 'devices'], ['tekoaly', 'Tekoäly', 'agent'],
  ['sanelu', 'Sanelu', 'mic'], ['koodipalvelut', 'Koodipalvelut', 'code'], ['tiedot', 'Tiedot agenteille', 'plug'],
  ['ulkoasu', 'Ulkoasu', 'eye'], ['editori', 'Editori', 'editor'], ['tila', 'Tallennustila', 'disk'],
  ['kokeelliset', 'Kokeelliset ominaisuudet', 'flask'],
];
const ADMIN = [['palvelin', 'Palvelin', 'server'], ['kayttajat', 'Käyttäjät ja pääsy', 'users']];

function sectionBody() {
  const s = S.section;
  if (s === 'kokeelliset') return S.v === 2 ? exhibit() : rows();
  if (s === 'editori') return `<div class="s-card"><div class="s-row"><div class="s-lbl"><strong>Työtilan editori</strong><span class="s-desc">Puhelimessa aina CodeMirror 6.</span></div><div class="s-val"><fieldset class="segmented" aria-label="Työpöydän editori"><button type="button" class="segment" aria-pressed="true">CodeMirror 6</button><button type="button" class="segment" aria-pressed="false">VS Code</button></fieldset></div></div></div>`;
  if (s === 'ulkoasu') return `<div class="s-card"><div class="s-row"><div class="s-lbl"><strong>Teema</strong><span class="s-desc">Järjestelmä seuraa laitteen asetusta. Koskee tätä selainta.</span></div><div class="s-val"><fieldset class="segmented" aria-label="Teema"><button type="button" class="segment" aria-pressed="false">Järjestelmä</button><button type="button" class="segment" data-a="theme" data-t="light" aria-pressed="${theme === 'light'}">Vaalea</button><button type="button" class="segment" data-a="theme" data-t="dark" aria-pressed="${theme === 'dark'}">Tumma</button></fieldset></div></div></div>`;
  return `<p class="s-intro">Tämä osio on prototyypissä ennallaan. Kierros koskee vain Kokeelliset ominaisuudet -osiota.</p>`;
}

function rows() {
  return `<div class="s-stack">${intro}<div class="s-card" data-testid="exp-card">${FEATURES.map((f) => `
    <div class="s-row${S.landed === f.id ? ' landed' : ''}" data-settings-row="${f.key}" tabindex="-1">
      <div class="s-lbl"><strong>${f.name}</strong><span class="s-desc">${f.desc}</span></div>
      <div class="s-val">${seg(f.id, S.flags[f.id], S.busy === f.id)}</div>
      ${rowNote(f.id)}
    </div>`).join('')}</div></div>`;
}

function pic(id) {
  const off = S.flags[id] ? '' : ' data-off';
  if (id === 'next') return `<div class="ex-pic"${off}><span class="ex-cap">Keskustelun alareuna</span><div class="ghost r"></div><div class="ghost" style="width:80%"></div><div class="ghost" style="width:55%"></div>
    <div class="next"><span class="dot"></span><b>Kuvien pakkaus</b><span class="why">uusi vastaus · 12 min</span><span class="btn primary">Avaa</span></div>
    <div class="composer"><span>Kirjoita agentille…</span></div></div>`;
  if (id === 'sentence') return `<div class="ex-pic"${off}><span class="ex-cap">Workerit-paneeli</span>
    <div class="wrow"><span class="mk"><span class="dot"></span></span><span class="lines"><span class="l1"><b>Sääaseman CSV-vienti</b><span class="meta">18 min</span></span><span class="l2"><span class="w">agentti odottaa</span><span class="sep">·</span><span class="hl">2 committia · 3 muutosta</span></span></span></div>
    <div class="wrow"><span class="mk"><span class="dring"></span></span><span class="lines"><span class="l1"><b>Vanhan rajapinnan poisto</b><span class="meta">2 min</span></span><span class="l2"><span class="w idle">agentti ei odota</span><span class="sep">·</span><span class="hl">ei vielä muutoksia</span></span></span></div></div>`;
  return `<div class="ex-pic"${off}><span class="ex-cap">Päätepaneeli</span>
    <div style="display:flex;gap:4px"><span class="dtab">$ bash</span><span class="dtab" aria-selected="true">work:2 <span class="ro">vain luku</span></span></div>
    <pre class="term"><span class="a">pi</span> ~/src/aurinkokello · gpt-5.5
› Aja testit ja korjaa, mitä löytyy.
<span class="g">●</span> bash python -m pytest -q <span class="g">14 passed</span></pre></div>`;
}

function exhibit() {
  return `<div class="s-stack">${intro}${FEATURES.map((f) => `
    <section class="ex-card${S.landed === f.id ? ' landed' : ''}" data-settings-row="${f.key}" tabindex="-1" aria-label="${f.name}" data-testid="ex-${f.id}">
      <div class="s-row"><div class="s-lbl"><strong>${f.name}</strong><span class="s-desc">${f.desc}</span></div><div class="s-val">${seg(f.id, S.flags[f.id], S.busy === f.id)}</div>${rowNote(f.id)}</div>
      <div class="ex-body">${pic(f.id)}
        <dl class="ex-facts"><div><dt>Missä</dt><dd>${f.where}</dd></div><div><dt>Mitä näkyy</dt><dd>${f.shows}</dd></div><div><dt>Edellyttää</dt><dd>${f.needs}</dd></div></dl>
      </div>
      <div class="ex-foot"><button type="button" class="link-btn" data-a="show" data-k="${f.id}">${f.view === 'status' ? 'Näytä päätteessä aloitettu keskustelu' : 'Näytä keskustelussa'} ${ic('forward')}</button></div>
    </section>`).join('')}</div>`;
}

function settings() {
  const title = [...SECTIONS, ...ADMIN].find(([id]) => id === S.section)?.[1];
  const nav = (items) => items.map(([id, label, icon]) => `<button type="button" class="s-nav-i" data-a="section" data-s="${id}" data-testid="settings-${id}"${S.section === id ? ' aria-current="page"' : ''}>${ic(icon)}${label}</button>`).join('');
  return `<div class="settings-layer" data-testid="settings"><section class="s-page${S.detail ? ' detail' : ''}">
    <button type="button" class="icon-btn s-close" data-a="close" aria-label="Sulje asetukset" data-testid="settings-close">${ic('cross')}</button>
    <nav class="s-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>${nav(SECTIONS)}<span class="s-nav-h">Palvelimen ylläpito</span>${nav(ADMIN)}</nav>
    <div class="s-main">
      <button type="button" class="btn quiet s-back" data-a="list">← Asetukset</button>
      <h2 tabindex="-1" id="s-h2" data-testid="settings-section-${S.section}">${title}</h2>
      ${sectionBody()}
      <p class="s-version">Palvelin <code>v0.14.0-pilot.14</code> · tämä välilehti ajaa samaa versiota</p>
    </div>
  </section></div>`;
}

// ---------- the app around it ----------
function rail() {
  const cur = (v) => (S.view === v ? ' aria-current="page"' : '');
  const galleria = S.flags.sentence
    ? `<span class="nav-sub" data-testid="rail-sentence">2 committia · 1 muutos · #409 <span class="ok">läpi</span></span>`
    : '<span class="nav-sub">worktree · Työskentelee</span>';
  return `<aside class="rail" aria-label="Sivupalkki">
    <div class="rail-head"><strong>kotipalvelin</strong><span class="conn">Yhdistetty</span></div>
    <div class="rail-scroll">
      <button type="button" class="nav-i">${ic('home')}<span class="nav-lines"><span>Etusivu</span></span></button>
      <div class="ws">kasvimaa</div>
      <button type="button" class="nav-i" data-a="view" data-view="ilta"${cur('ilta')}><span class="dot"></span><span class="nav-lines"><span>Iltakierros</span></span></button>
      <button type="button" class="nav-i" data-a="view" data-view="ilta">${ic('worktree')}<span class="nav-lines"><span>Galleria: nipistyszoomi</span>${galleria}</span></button>
      <button type="button" class="nav-i" data-a="view" data-view="ilta"><span class="ring"></span><span class="nav-lines"><span>Kuvien pakkaus</span><span class="nav-sub">Uusi vastaus · 12 min</span></span></button>
      <div class="ws">aurinkokello</div>
      <button type="button" class="nav-i" data-a="view" data-view="status"${cur('status')}>${ic('terminal')}<span class="nav-lines"><span>Status-skripti</span><span class="nav-sub">Käynnissä päätteessä</span></span></button>
      <div class="ws">kirjasto</div>
      <button type="button" class="nav-i" data-a="view" data-view="ilta"><span class="ring"></span><span class="nav-lines"><span>Hakusanojen negaatiot</span></span></button>
    </div>
    <div class="account">
      ${S.menu ? `<div class="menu" role="menu"><button type="button" role="menuitem" class="nav-i" data-a="open-settings" data-testid="menu-settings">Asetukset</button><button type="button" role="menuitem" class="nav-i" data-a="menu">Kirjaudu ulos…</button></div>` : ''}
      <button type="button" class="nav-i" data-a="menu" aria-expanded="${S.menu}" data-testid="account"><span class="avatar">J</span><span class="nav-lines"><span>Jari</span></span></button>
    </div>
  </aside>`;
}

function topbar(title, ws, extra) {
  return `<header class="topbar"><button type="button" class="icon-btn hamb" data-a="drawer" aria-label="Sivupalkki">${ic('menu')}</button><div class="title"><strong>${title}</strong><span class="mono">${ws}</span></div>${extra}</header>`;
}

const WORKERS = [
  { n: 'Sääaseman CSV-vienti', t: '18 min', word: 'agentti odottaa', idle: false, mk: '<span class="dot"></span>', work: '2 committia · 3 muutosta', model: 'Pi · oletus' },
  { n: 'Kuvagallerian lataus', t: '6 min', word: 'agentti ei odota', idle: true, mk: '<span class="dring"></span>', work: '4 committia · PR #412 luonnos, <span class="run">tarkistukset käynnissä</span>', model: 'Pi · nopea' },
  { n: 'Vanhan rajapinnan poisto', t: '2 min', word: 'agentti ei odota', idle: true, mk: '<span class="dring"></span>', work: 'ei vielä muutoksia', model: 'Claude · tarkka' },
];

function workersPanel() {
  const pill = `<button type="button" class="pill" data-a="panel" aria-expanded="${S.panel}" data-testid="workers-pill">${ic('worktree')}Workerit 3</button>`;
  if (!S.panel) return pill;
  return `<div class="panel" data-testid="workers-panel"><div class="panel-head"><span class="t">${ic('worktree')}Workerit <span class="n">3</span></span><span class="sp"></span>${S.flags.sentence ? expTag('sentence', false) : ''}<button type="button" class="icon-btn" data-a="panel" aria-label="Sulje Workerit">${ic('cross')}</button></div>
    <div class="panel-body">${WORKERS.map((w) => `<button type="button" class="wrow"><span class="mk">${w.mk}</span><span class="lines"><span class="l1"><b>${w.n}</b><span class="meta">${w.t}</span></span><span class="l2"><span class="w${w.idle ? ' idle' : ''}">${w.word}</span>${S.flags.sentence ? `<span class="sep">·</span><span class="work" data-testid="sentence">${w.work}</span>` : ''}<span class="sep">·</span><span>${w.model}</span></span></span></button>`).join('')}</div></div>`;
}

function nextRow() {
  if (!S.flags.next) return '';
  return `<div class="next" role="region" aria-label="Seuraavaksi sinun vuorosi" data-testid="next-row"><span class="lead">Sillä aikaa</span><span class="dot"></span><b>Kuvien pakkaus</b><span class="why">uusi vastaus · 12 min</span><span class="more">+1</span>${expTag('next', false)}<button type="button" class="btn primary small" data-a="view" data-view="ilta">Avaa <kbd>Alt+↓</kbd></button></div>`;
}

function iltakierros() {
  return `${topbar('Iltakierros', 'kasvimaa', '<span class="state"><span class="dot"></span>Työskentelee</span>')}
  <div class="scroll"><div class="thread">
    <div class="msg user"><div class="bubble">Aja iltakierros: katso workerit ja kerro, mitä pitää päättää.</div></div>
    <div class="msg agent"><p>Käynnistin kolme workeria: CSV-vienti, gallerian lataus ja kirjaston vanha rajapinta. CSV-vienti kysyy, saako sarakkeiden järjestystä muuttaa.</p></div>
    <div class="msg user"><div class="bubble">Saa muuttaa, kunhan otsikkorivi pysyy.</div></div>
    <div class="msg agent"><span class="working"><span class="dot"></span>Työskentelee</span></div>
  </div></div>
  <div class="bottom"><div class="col">${workersPanel()}${nextRow()}<div class="composer"><input aria-label="Viesti agentille" placeholder="Kirjoita agentille…"><button type="button" class="icon-btn" aria-label="Lähetä">${ic('send')}</button></div></div></div>`;
}

function statusSkripti() {
  const on = S.flags.mirror;
  const foot = on
    ? `<div class="ro-foot" data-testid="ro-foot"><div class="txt"><span class="h">Käynnissä päätteessä ${expTag('mirror', false)}</span><span class="d">Pi kirjoittaa tätä tmuxissa (<code>work:2</code>), joten selaimessa se on vain luettavana.</span></div><button type="button" class="btn primary" data-a="dock" data-testid="watch">${ic('eye')}Katso päätteessä</button></div>`
    : `<div class="ro-foot" data-testid="ro-foot"><div class="txt"><span class="h">Vain luku</span><span class="d">Jatkaminen estetty: keskustelulla on aktiivinen kirjoittaja.</span></div></div>`;
  const dock = S.dock && on ? `<section class="dock" aria-label="Pääte" data-testid="dock"><div class="dock-tabs"><span class="ws-name">aurinkokello</span><span class="dtab">$ bash</span><span class="dtab" aria-selected="true">work:2 <span class="ro">vain luku</span></span><span style="flex:1"></span><button type="button" class="icon-btn" data-a="dock" aria-label="Sulje pääte">${ic('cross')}</button></div>
    <div class="dock-note">${ic('eye')}Peili tmux-ikkunastasi work:2. Selain ei lähetä siihen näppäimiä.</div>
    <pre class="term"><span class="a">pi</span> ~/src/aurinkokello · gpt-5.5 · medium
<span class="m">────────────────────────────────────────────</span>
› Aja testit ja korjaa, mitä löytyy.
<span class="g">●</span> bash python -m pytest -q <span class="g">14 passed</span>
<span class="g">●</span> edit README.md <span class="g">+6</span>
  Oletus on nyt viime maanantai, ja testit menevät läpi.
<span class="m">────────────────────────────────────────────</span>
<span class="m">valmis · 12,4k / 272k</span>
<span class="m">~/src/aurinkokello (main) · tmux work:2</span></pre></section>` : '';
  return `${topbar('Status-skripti', 'aurinkokello', `<span class="state">${ic('terminal')}Käynnissä päätteessä</span><span class="tag">Vain luku</span>`)}
  <div class="scroll"><div class="thread">
    <div class="msg user"><div class="bubble">Lisää skriptiin --since-valitsin, oletuksena viime maanantai.</div></div>
    <div class="msg agent"><p>Lisäsin valitsimen ja testit. <code>--since</code> on mukaan lukien, joten <code>--since 2026-10-06</code> ottaa myös 6.10. rivin.</p></div>
    <div class="msg user"><div class="bubble">Aja testit ja korjaa, mitä löytyy.</div></div>
  </div></div>
  <div class="bottom"><div class="col">${foot}</div></div>${dock}`;
}

function draw() {
  const view = S.view === 'settings' ? S.from : S.view;
  const body = view === 'status' ? statusSkripti() : iltakierros();
  const toast = S.toast ? `<div class="toast" role="status" data-testid="toast">${S.toast.text}${S.toast.undo ? `<button type="button" class="btn quiet small" data-a="undo" data-k="${S.toast.undo}">Kumoa</button>` : ''}</div>` : '';
  return `<div class="app${S.drawer ? ' drawer' : ''}" data-variant="${S.v}" data-view="${S.view}">${rail()}<div class="main">${S.view === 'settings' ? `<div data-under-settings hidden></div>` : ''}${S.view === 'settings' ? settings() : body}${toast}</div></div>`;
}

// ---------- behaviour ----------
let toastTimer;
function setFlag(id, on, after) {
  if (S.busy) return;
  if (S.flags[id] === on && S.error !== id) return;
  S.busy = id; S.error = null; S.saved = null;
  paint();
  setTimeout(() => {
    S.busy = null;
    if (document.getElementById('fail').checked) {
      S.error = id;
      if (S.view !== 'settings') toast('Valintaa ei voitu tallentaa. Ominaisuus on yhä käytössä.');
    } else {
      S.flags[id] = on;
      S.saved = id;
      after?.();
    }
    if (S.view === 'settings') S.focus = `[data-a="set"][data-k="${id}"][data-on="${S.flags[id] ? 1 : 0}"]`;
    paint();
  }, 450);
}
function toast(text, undo) {
  S.toast = { text, undo };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { S.toast = null; paint(); }, 6000);
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-a]');
  if (!t || !stage.contains(t)) {
    if (S.pop && !e.target.closest('.exp-pop') && stage.contains(e.target)) { S.pop = null; paint(); }
    if (S.menu && !e.target.closest('.account')) { S.menu = false; paint(); }
    if (S.drawer && e.target.closest('.app') && !e.target.closest('.rail')) { S.drawer = false; paint(); }
    return;
  }
  const a = t.dataset.a, k = t.dataset.k;
  if (a !== 'pop' && !t.closest('.exp-pop')) S.pop = null;
  if (a !== 'menu' && a !== 'open-settings') S.menu = false;
  switch (a) {
    case 'set': setFlag(k, t.dataset.on === '1'); return;
    case 'reload': S.error = null; S.saved = null; paint(); return;
    case 'section': S.section = t.dataset.s; S.detail = true; S.saved = null; S.error = null; S.focus = '#s-h2'; break;
    case 'list': S.detail = false; break;
    case 'close': S.view = S.from; S.saved = null; S.error = null; break;
    case 'menu': S.menu = !S.menu; break;
    case 'open-settings': S.menu = false; S.drawer = false; S.view = 'settings'; S.section = 'kokeelliset'; S.detail = true; S.focus = '#s-h2'; break;
    case 'view': S.view = t.dataset.view; S.from = S.view; S.drawer = false; S.toast = null; break;
    case 'drawer': S.drawer = !S.drawer; break;
    case 'panel': S.panel = !S.panel; break;
    case 'dock': S.dock = !S.dock; break;
    case 'theme': setTheme(t.dataset.t); break;
    case 'show': S.view = F[k].view; S.from = S.view; S.panel = true; break;
    case 'pop': S.pop = S.pop === k ? null : k; break;
    case 'pop-off':
      S.pop = null;
      setFlag(k, false, () => toast(`${F[k].name} pois käytöstä.`, k));
      if (k === 'mirror') S.dock = false;
      return;
    case 'undo': S.toast = null; setFlag(k, true); return;
    case 'to-settings':
      S.pop = null; S.view = 'settings'; S.section = 'kokeelliset'; S.detail = true; S.landed = k;
      setTimeout(() => {
        const row = stage.querySelector(`[data-settings-row="${F[k].key}"]`);
        row?.scrollIntoView({ block: 'center' }); row?.focus({ preventScroll: true });
      });
      setTimeout(() => { S.landed = null; }, 2400);
      break;
  }
  paint();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (S.pop) { const k = S.pop; S.pop = null; S.focus = `[data-testid="tag-${k}"]`; paint(); }
  else if (S.menu) { S.menu = false; paint(); }
  else if (S.view === 'settings') { S.view = S.from; paint(); }
});

function setTheme(t) {
  theme = t;
  document.documentElement.dataset.theme = t;
  document.getElementById('theme').textContent = t === 'dark' ? 'Vaalea' : 'Tumma';
}
document.getElementById('theme').addEventListener('click', () => { setTheme(theme === 'dark' ? 'light' : 'dark'); paint(); });
document.getElementById('reset').addEventListener('click', () => { const v = S.v; S = fresh(); S.v = v; paint(); });
// Test hook for check.mjs: open a state without clicking through it.
window.__proto = { get S() { return S; }, set(p) { Object.assign(S, p); paint(); } };
setTheme(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
