// Open Habitat · merkki. Each direction draws one mark in a 48-unit box from named colour
// roles (main, hi, deep, cut), so the same drawing serves the themed page (token variables),
// the one-colour app icon and the favicon (concrete hex, since a data: URL sees no tokens).
// `small` is the optical size for 24 px and below: thicker strokes, fewer details.
let lgUid = 0;
const LG_VARS = { main: 'var(--ah-ink)', hi: 'var(--ah-accent)', deep: 'var(--ah-accent-ink)', cut: 'var(--ah-surface)', ok: 'var(--ah-ok)' };
const LG_HEX = { main: '#16191d', hi: '#2b7f8c', deep: '#1d5f69', cut: '#ffffff', ok: '#2f7a55' };
const lgMono = (fg, bg) => ({ main: fg, hi: fg, deep: bg, cut: bg, ok: fg });
// Kehote's tile is the same dark in both themes: an app icon does not change with the page.
const KEHOTE = { tile: '#16191d', line: '#2a3036', roof: '#f4f6f7', cur: '#4fa6b4' };

function lgSvg(px, inner, cls = '') {
  return `<svg class="lg-svg ${cls}" width="${px}" height="${px}" viewBox="0 0 48 48" aria-hidden="true">${inner}</svg>`;
}

// ---------- Kynnys: an open door with light inside ----------
function drawKynnys(p, { small } = {}) {
  const id = `kc${++lgUid}`, sw = small ? 4.2 : 3.2;
  const inner = 'M13 40V23a11 11 0 0 1 22 0v17z';
  return `<defs><clipPath id="${id}"><path d="${inner}"/></clipPath></defs>
    <path d="${inner}" fill="${p.hi}"/>
    <g clip-path="url(#${id})"><path class="k-leaf" d="M35 41V10l-8 6v25z" fill="${p.deep}"/></g>
    ${small ? '' : `<path class="k-spill" d="M13 42.6h16l8 4H5z" fill="${p.hi}" opacity=".38"/>`}
    <path d="M13 40V23a11 11 0 0 1 22 0v17" fill="none" stroke="${p.main}" stroke-width="${sw}" stroke-linejoin="round"/>
    <path d="${small ? 'M8 40h32' : 'M6 40h36'}" stroke="${p.main}" stroke-width="${sw}" stroke-linecap="round"/>`;
}

// ---------- Kennot: three rooms in one comb, yours lit ----------
function lgHex(cx, cy, r) {
  const pts = [0, 1, 2, 3, 4, 5].map(k => { const a = (Math.PI / 3) * k - Math.PI / 2; return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`; });
  return `M${pts.join('L')}Z`;
}
function drawKennot(p, { small } = {}) {
  const r = small ? 7.8 : 8.4, sw = small ? 3.4 : 2.6;
  const cell = (cx, cy, k, lit) => `<path class="kn-cell kn-${k}" d="${lgHex(cx, cy, r)}" fill="${lit ? p.hi : 'none'}" stroke="${lit ? p.hi : p.main}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  return cell(24, 15.8, 1) + cell(14.5, 32.25, 2) + cell(33.5, 32.25, 3, true);
}

// ---------- Kehote: a roof that is a caret, a door that is a cursor ----------
function drawKehote(p, { small, tile } = {}) {
  if (tile) return `<rect x="2.5" y="2.5" width="43" height="43" rx="11" fill="${KEHOTE.tile}" stroke="${KEHOTE.line}"/>
    <path class="kh-roof" pathLength="100" d="M12.5 25.5 24 14l11.5 11.5" fill="none" stroke="${KEHOTE.roof}" stroke-width="${small ? 4.6 : 4}" stroke-linecap="round" stroke-linejoin="round"/>
    <rect class="kh-cur" x="19.5" y="29" width="9" height="11" rx="1.2" fill="${KEHOTE.cur}"/>`;
  return `<path class="kh-roof" pathLength="100" d="M8.5 25 24 9.5 39.5 25" fill="none" stroke="${p.main}" stroke-width="${small ? 5.4 : 4.4}" stroke-linecap="round" stroke-linejoin="round"/>
    <rect class="kh-cur" x="18.5" y="29" width="11" height="13" rx="1.4" fill="${p.hi}"/>`;
}

// ---------- Pesä: an open ring with a shoot growing out of the opening ----------
function drawPesa(p, { small } = {}) {
  const sw = small ? 6 : 5;
  return `<path class="ps-ring" pathLength="100" d="M36.52 22.38A14 14 0 1 1 26.62 12.48" fill="none" stroke="${p.hi}" stroke-width="${sw}" stroke-linecap="round"/>
    <path class="ps-leaf" d="M26.5 23.5C26 15.5 31.5 9.5 40.5 7.5 41 16 35.5 22.5 26.5 23.5Z" fill="${p.ok}"/>
    ${small ? '' : `<path class="ps-leaf" d="M28.6 21.2 37.8 10.6" stroke="${p.cut}" stroke-width="1.3" stroke-linecap="round"/>`}`;
}

// ---------- oh: the name's own letters, the h's shoulder a doorway ----------
function drawOh(p, { small } = {}) {
  const sw = small ? 5.4 : 4.4;
  return `<circle class="oh-o" pathLength="100" cx="14" cy="30" r="8" fill="none" stroke="${p.hi}" stroke-width="${sw}" transform="rotate(-90 14 30)"/>
    <path class="oh-h" pathLength="100" d="M27 9v30M27 28a7.5 7.5 0 0 1 15 0v11" fill="none" stroke="${p.main}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// ---------- The board: the same content for every direction ----------
const lgPx = (n) => `<span class="lg-px">${n} px</span>`;
function lgFavicon(spec) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${spec.draw(LG_HEX, { small: true, tile: spec.tileIcon })}</svg>`;
  const link = document.querySelector('link[rel="icon"]');
  if (link) link.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
}
function lgBoard(spec) {
  const m = (px, o = {}) => lgSvg(px, spec.draw(o.pal ?? LG_VARS, { small: px <= 24, tile: o.tile, anim: o.anim }), `lg-${spec.key}${o.anim ? ' lg-anim' : ''}`);
  const icon = (px) => m(px, { tile: spec.tileIcon });
  const word = (cls = '') => `<span class="lg-word lg-word-${spec.key} ${cls}">${spec.word}</span>`;
  const sizes = [128, 64, 32, 24, 16].map(n => `<figure>${icon(n)}${lgPx(n)}</figure>`).join('');
  const app = (theme, label, extra = '') => `<figure class="lg-app-wrap" data-theme="${theme}"><div class="lg-app ${extra}">${spec.tileIcon ? lgSvg(112, spec.draw(LG_VARS, { tile: true }), `lg-${spec.key} lg-full`) : m(68, extra ? { pal: lgMono('var(--ah-on-accent)', 'var(--ah-accent)') } : {})}</div><figcaption>${label}</figcaption></figure>`;
  const tabs = (theme) => `<div class="lg-tabs" data-theme="${theme}">
      <span class="lg-tab on">${icon(16)}<span>Open Habitat</span><i aria-hidden="true">×</i></span>
      <span class="lg-tab"><span class="lg-tab-dot"></span><span>Pull requests · GitHub</span></span>
      <span class="lg-tab"><span class="lg-tab-dot b"></span><span>Kalenteri</span></span>
    </div>`;
  const rail = `<div class="lg-rail">
      <div class="lg-rail-host">${icon(20)}<strong>alder</strong></div>
      <div class="lg-rail-row on"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 7.5 8 3l5.5 4.5V13h-11z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>Etusivu</div>
      <div class="lg-rail-sec">Työtilat</div>
      <div class="lg-rail-row"><span class="lg-glyph g0">oh</span><code>open-habitat</code></div>
      <div class="lg-rail-row"><span class="lg-glyph g2">e</span><code>ergona</code></div>
      <div class="lg-rail-row"><span class="lg-glyph g4">3d</span><code>northwind</code></div>
      <div class="lg-rail-row"><span class="lg-glyph g6">h</span><code>fleetrepo</code></div>
    </div>`;
  lgFavicon(spec);
  return `<div class="lg lg-v-${spec.key}">
    <section class="lg-hero">
      <div class="lg-hero-mark">${spec.tileIcon ? lgSvg(176, spec.draw(LG_VARS, {}), `lg-${spec.key}`) : m(176)}</div>
      <div class="lg-hero-text">
        <p class="lg-eyebrow">${spec.name} · ${spec.axis}</p>
        <div class="lg-lock">${spec.tileIcon ? lgSvg(44, spec.draw(LG_VARS, {}), `lg-${spec.key}`) : m(44)}${word('lg-word-l')}</div>
        <h2>${spec.idea}</h2>
        <p>${spec.why}</p>
        <div class="lg-locks-small">
          <span class="lg-lock-s">${icon(24)}${word('lg-word-s')}</span>
          <span class="lg-lock-st">${m(40)}${word('lg-word-st')}</span>
        </div>
      </div>
    </section>
    <section class="lg-sec"><h3>Koot</h3>
      <div class="lg-sizes" data-theme="light">${sizes}</div>
      <div class="lg-sizes" data-theme="dark">${sizes}</div>
    </section>
    <section class="lg-sec lg-two"><div><h3>Sovelluskuvake</h3>
      <div class="lg-apps">${app('light', 'Vaalea')}${app('dark', 'Tumma')}${spec.tileIcon ? '' : app('light', 'Yksivärinen', 'lg-app-accent')}</div></div>
      <div><h3>Välilehti</h3>${tabs('light')}${tabs('dark')}</div>
    </section>
    <section class="lg-sec"><h3>Käytössä</h3>
      <div class="lg-ctx">
        <div class="lg-landing"><div class="lg-landing-in">${spec.tileIcon ? lgSvg(56, spec.draw(LG_VARS, { tile: true }), `lg-${spec.key} lg-anim`) : m(56, { anim: true })}
          <h4>${word('lg-word-land')}</h4><p class="lg-server">habitat.example.test</p>
          <div class="lg-bar" aria-hidden="true"><span></span></div><p class="lg-say">Yhdistetään palvelimeen…</p></div></div>
        ${rail}
        <div class="lg-login"><div class="lg-login-card">${icon(40)}
          <h4>Kirjaudu Open Habitatiin</h4><p>Palvelin <code>habitat.example.test</code> tunnistaa sinut GitHub-tililläsi.</p>
          <button type="button" class="lg-btn"><svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 .2a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.3 1.9.9 2.3.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.6 7.6 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.8-3.6 4 .3.3.6.8.6 1.5v2.2c0 .2.1.5.6.4A8 8 0 0 0 8 .2"/></svg>Jatka GitHubilla</button>
        </div></div>
      </div>
    </section>
  </div>`;
}

const LG_SPECS = {
  kynnys: {
    key: 'kynnys', name: 'Kynnys', axis: 'avoin ovi', draw: drawKynnys, word: 'Open Habitat',
    idea: 'Ovi on raollaan, ja sisällä palaa valo.',
    why: 'Habitat on paikka, jossa agentit asuvat ja tekevät työtä silloinkin, kun selain on kiinni. Merkki on kaari, jonka ovi on auki sisäänpäin: palvelimella on joku kotona, ja selain on vain tapa astua sisään. Kaari jatkaa nykyistä paikanpitäjää, joten se tuntuu tutulta.',
  },
  kennot: {
    key: 'kennot', name: 'Kennot', axis: 'erilliset huoneet', draw: drawKennot, word: '<span class="lg-w-dim">Open</span> Habitat',
    idea: 'Yksi pesä, jokaisella oma kenno.',
    why: 'Tuotteen ydin on, että jokainen ihminen työskentelee omalla Linux-tunnuksellaan samalla palvelimella. Kennot ovat kiinni toisissaan mutta eivät jaa seiniään. Valaistu kenno on sinun. Muoto toimii pienenäkin ja on tunnistettava myös ilman sanaa.',
  },
  kehote: {
    key: 'kehote', name: 'Kehote', axis: 'natiivi pääte', draw: drawKehote, tileIcon: true, word: 'open-habitat',
    idea: 'Katto on kehotteen ^-merkki, ovi on vilkkuva kursori.',
    why: 'Open Habitat ei rakenna omaa agenttialustaa: selain on uusi tapa päästä samoihin natiiveihin istuntoihin kuin SSH ja tmux. Merkki on talo, joka on piirretty päätteen merkeillä, ja sanamerkki on komennon nimi monospacella. Tumma laatta on sama molemmissa teemoissa.',
  },
  pesa: {
    key: 'pesa', name: 'Pesä', axis: 'elävä ympäristö', draw: drawPesa, word: 'Open Habitat',
    idea: 'Rengas on auki, ja siitä kasvaa verso.',
    why: 'Habitat on elinympäristö, ei kone. Avoin rengas sanoo Open, verso sanoo että siellä kasvaa jotakin omaa: projekteja, keskusteluja, agenttien työtä. Suunta on lämpimin ja vähiten tekninen, ja se erottuu kehittäjätyökalujen kulmikkaista merkeistä.',
  },
  oh: {
    key: 'oh', name: 'oh', axis: 'nimen kirjaimet', draw: drawOh, word: 'open habitat',
    idea: 'Merkki on nimen alkukirjaimet o ja h.',
    why: 'Lyhenne oh on jo käytössä työtilan kirjaintunnuksena ja komennoissa. h:n olka on oviaukko, joten habitatin ajatus on mukana ilman erillistä kuvaa. Sanamerkki kirjoitetaan pienillä kirjaimilla, kuten komento ja verkko-osoite. Merkki on suunnista suorin, mutta myös helpoimmin sekoitettavissa.',
  },
};

function lgKynnys() { return lgBoard(LG_SPECS.kynnys); }
function lgKennot() { return lgBoard(LG_SPECS.kennot); }
function lgKehote() { return lgBoard(LG_SPECS.kehote); }
function lgPesa() { return lgBoard(LG_SPECS.pesa); }
function lgOh() { return lgBoard(LG_SPECS.oh); }
