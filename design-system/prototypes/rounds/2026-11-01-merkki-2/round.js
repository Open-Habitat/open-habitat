// Open Habitat · merkki, kierros 2. As in round 1, each mark draws in a 48-unit box from
// colour roles, so one drawing serves the themed page, the one-colour icon and the favicon.
// New roles: sun (the warm light at home), grass (the meadow), soft (glass, sky) and hole
// (a dark opening that stays dark in both themes). The inhabitant, a four-point spark, is
// the agent; every direction has one.
let lgUid = 0;
const LG_VARS = { main: 'var(--ah-ink)', hi: 'var(--ah-accent)', deep: 'var(--ah-accent-ink)', cut: 'var(--ah-surface)', sun: 'var(--lg-sun)', grass: 'var(--lg-grass)', soft: 'var(--ah-accent-soft)', hole: 'var(--lg-hole)' };
const LG_HEX = { main: '#16191d', hi: '#2b7f8c', deep: '#1d5f69', cut: '#ffffff', sun: '#e9a23b', grass: '#4f9a6a', soft: '#e6f1f3', hole: '#12343a' };
const lgMono = (fg, bg) => ({ main: fg, hi: fg, deep: bg, cut: bg, sun: fg, grass: fg, soft: bg, hole: bg });

function lgSvg(px, inner, cls = '') {
  return `<svg class="lg-svg ${cls}" width="${px}" height="${px}" viewBox="0 0 48 48" aria-hidden="true">${inner}</svg>`;
}
// The agent: a four-point spark. k sets how full its sides are.
function lgSpark(cx, cy, s, fill, cls = 'lg-spark') {
  const k = s * 0.24, f = (n) => n.toFixed(2);
  return `<path class="${cls}" d="M${f(cx)} ${f(cy - s)}Q${f(cx + k)} ${f(cy - k)} ${f(cx + s)} ${f(cy)}Q${f(cx + k)} ${f(cy + k)} ${f(cx)} ${f(cy + s)}Q${f(cx - k)} ${f(cy + k)} ${f(cx - s)} ${f(cy)}Q${f(cx - k)} ${f(cy - k)} ${f(cx)} ${f(cy - s)}Z" fill="${fill}"/>`;
}

// ---------- Valo: Kynnys's door in a habitat dome on a hill, the light on ----------
function drawValo(p, { small } = {}) {
  const sw = small ? 4 : 3.2;
  // The dome is wide and low, so the drawing sits 6 units up to centre in the box.
  return `<g transform="translate(0 -6)"><path d="M1 47C8 39.5 40 39.5 47 47Z" fill="${p.grass}"/>
    <path d="M5.5 41.5a18.5 18.5 0 0 1 37 0z" fill="${p.soft}"/>
    <path class="lg-light" d="M${small ? 16.5 : 17.5} 41.5V${small ? 32.5 : 33.5}a${small ? 7.5 : 6.5} ${small ? 7.5 : 6.5} 0 0 1 ${small ? 15 : 13} 0v${small ? 9 : 8}z" fill="${p.sun}"/>
    ${lgSpark(24, small ? 35.5 : 36, small ? 4.6 : 4, p.deep)}
    <path d="M5.5 41.5a18.5 18.5 0 0 1 37 0" fill="none" stroke="${p.hi}" stroke-width="${sw}" stroke-linecap="round"/>
    <path d="M3.5 41.5h41" stroke="${p.main}" stroke-width="${sw}" stroke-linecap="round"/></g>`;
}

// ---------- Parvi: the comb is a hive, one cell honey, an agent flying home ----------
function lgHex(cx, cy, r) {
  const pts = [0, 1, 2, 3, 4, 5].map(k => { const a = (Math.PI / 3) * k - Math.PI / 2; return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`; });
  return `M${pts.join('L')}Z`;
}
function drawParvi(p, { small } = {}) {
  const r = small ? 8.2 : 8.4, sw = small ? 3.2 : 2.6;
  const cell = (cx, cy, k, fill, stroke) => `<path class="kn-cell kn-${k}" d="${lgHex(cx, cy, r)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  return cell(22, 17, 1, p.sun, p.sun) + lgSpark(22, 17, small ? 5 : 4.4, p.deep)
    + cell(12.5, 33.45, 2, 'none', p.main) + cell(31.5, 33.45, 3, p.hi, p.hi)
    + (small ? '' : lgSpark(40.5, 9.5, 4, p.hi, 'lg-fly'));
}

// ---------- Kolo: a mound with a round door, the meadow in flower ----------
function drawKolo(p, { small } = {}) {
  const sw = small ? 3.4 : 2.6;
  return `<path d="M3 42C4.5 22 15 13.5 24 13.5S43.5 22 45 42Z" fill="${p.grass}"/>
    <path class="lg-light" d="M17 42V33a7 7 0 0 1 14 0v9z" fill="${p.sun}"/>
    <path d="M17 42V33a7 7 0 0 1 14 0v9" fill="none" stroke="${p.main}" stroke-width="${sw}" stroke-linejoin="round"/>
    ${lgSpark(small ? 33 : 34, small ? 22.5 : 22, small ? 4.2 : 3.6, p.cut)}
    ${small ? '' : lgSpark(13.5, 28, 2.4, p.cut)}
    <path d="M3.5 42h41" stroke="${p.main}" stroke-width="${small ? 3.6 : 3}" stroke-linecap="round"/>`;
}

// ---------- Kasvu: a glasshouse where the agent grows ----------
function drawKasvu(p, { small } = {}) {
  const id = `kv${++lgUid}`, sw = small ? 3.8 : 3;
  const inner = 'M10 41V22a14 14 0 0 1 28 0v19z';
  return `<defs><clipPath id="${id}"><path d="${inner}"/></clipPath></defs>
    <path d="${inner}" fill="${p.soft}"/>
    ${small ? '' : `<g clip-path="url(#${id})" stroke="${p.hi}" stroke-width="1.5" opacity=".55"><path d="M17 4v40M31 4v40M4 27h40"/></g>`}
    <g class="lg-grow"><path d="M24 41V29" stroke="${p.grass}" stroke-width="${small ? 3.4 : 2.6}" stroke-linecap="round"/>
      <path d="M24 34C23 29 19 27 14.5 27.5 15 32 19 34.5 24 34Z" fill="${p.grass}"/>
      <path d="M24 31.5C25 26.5 29 24.5 33.5 25 33 29.5 29 32 24 31.5Z" fill="${p.grass}"/></g>
    ${lgSpark(24, 19, small ? 5.2 : 4.4, p.sun)}
    <path d="M10 41.5V22a14 14 0 0 1 28 0v19.5" fill="none" stroke="${p.hi}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M5.5 41.5h37" stroke="${p.main}" stroke-width="${sw}" stroke-linecap="round"/>`;
}

// ---------- Pönttö: a house built for someone else, the agent peeking out ----------
function drawPontto(p, { small } = {}) {
  return `<path d="M12 20V40a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V20L24 9.5z" fill="${p.hi}"/>
    <circle cx="24" cy="27" r="${small ? 7.2 : 6.6}" fill="${p.hole}"/>
    ${lgSpark(24, 27.4, small ? 5 : 4.4, p.sun, 'lg-peek')}
    <circle cx="24" cy="37.6" r="${small ? 2.2 : 1.8}" fill="${p.main}"/>
    <path d="M7 21.5 24 6.5l17 15" fill="none" stroke="${p.main}" stroke-width="${small ? 4.4 : 3.6}" stroke-linecap="round" stroke-linejoin="round"/>
    ${small ? '' : `<path d="M24 42.5V46.5" stroke="${p.main}" stroke-width="3" stroke-linecap="round"/>`}`;
}

// ---------- The world: the mark repeated on rolling hills, sparks in the air ----------
function lgScene(spec) {
  const W = 760, H = 240, gid = `sky${++lgUid}`;
  const far = (x) => 150 - 14 * Math.sin((x / W) * Math.PI * 2 + 1.4);
  const near = (x) => 198 - 14 * Math.sin((x / W) * Math.PI * 1.4 + 0.3);
  const hill = (fn) => { let d = `M0 ${H}`; for (let x = 0; x <= W; x += 20) d += `L${x} ${fn(x).toFixed(1)}`; return d + `L${W} ${H}Z`; };
  const place = (x, fn, s, op = 1) => `<g transform="translate(${(x - 24 * s).toFixed(1)} ${(fn(x) - 42 * s + 3 * s).toFixed(1)}) scale(${s})" opacity="${op}">${spec.draw(LG_VARS, {})}</g>`;
  // Agents in the air, drifting.
  const air = [[70, 46, 5], [190, 78, 3.4], [330, 36, 4.4], [430, 84, 2.8], [560, 40, 5.2], [690, 70, 3.6], [640, 110, 2.6]]
    .map(([x, y, s], i) => lgSpark(x, y, s, i % 3 ? 'var(--lg-sun)' : 'var(--ah-accent)', 'lg-float').replace('<path', `<path style="animation-delay:${(-i * 0.8).toFixed(1)}s"`)).join('');
  // Agents in the meadow, as flowers.
  const meadow = [40, 92, 300, 352, 410, 470, 610, 700, 735].map((x, i) => {
    const y = near(x) + 10 + (i % 3) * 7;
    return `<path d="M${x} ${y + 9}V${y}" stroke="var(--lg-flower)" stroke-opacity=".5" stroke-width="1.4"/>` + lgSpark(x, y, 3.4 + (i % 2), i % 4 ? 'var(--lg-flower)' : 'var(--lg-sun)', 'lg-flower');
  }).join('');
  return `<svg class="lg-scene" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--lg-sky)"/><stop offset="1" style="stop-color:var(--ah-surface)"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#${gid})"/>${air}
    <path d="${hill(far)}" fill="var(--lg-grass-far)"/>
    ${place(560, far, 1.05, 0.75)}
    <path d="${hill(near)}" fill="var(--lg-grass)"/>
    ${place(200, near, 2.6)}${meadow}
  </svg>`;
}

// ---------- The board: the same content for every direction ----------
const lgPx = (n) => `<span class="lg-px">${n} px</span>`;
function lgFavicon(spec) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${spec.draw(LG_HEX, { small: true })}</svg>`;
  const link = document.querySelector('link[rel="icon"]');
  if (link) link.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
}
function lgBoard(spec) {
  const m = (px, o = {}) => lgSvg(px, spec.draw(o.pal ?? LG_VARS, { small: px <= 24 }), `lg-${spec.key}${o.anim ? ' lg-anim' : ''}`);
  const word = (cls = '') => `<span class="lg-word lg-word-${spec.key} ${cls}">${spec.word}</span>`;
  const sizes = [128, 64, 32, 24, 16].map(n => `<figure>${m(n)}${lgPx(n)}</figure>`).join('');
  const app = (theme, label, mono) => `<figure class="lg-app-wrap" data-theme="${theme}"><div class="lg-app${mono ? ' lg-app-accent' : ''}">${m(72, mono ? { pal: lgMono('var(--ah-on-accent)', 'var(--ah-accent)') } : {})}</div><figcaption>${label}</figcaption></figure>`;
  const tabs = (theme) => `<div class="lg-tabs" data-theme="${theme}">
      <span class="lg-tab on">${m(16)}<span>Open Habitat</span><i aria-hidden="true">×</i></span>
      <span class="lg-tab"><span class="lg-tab-dot"></span><span>Pull requests · GitHub</span></span>
      <span class="lg-tab"><span class="lg-tab-dot b"></span><span>Kalenteri</span></span>
    </div>`;
  const rail = `<div class="lg-rail">
      <div class="lg-rail-host">${m(20)}<strong>alder</strong></div>
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
      <div class="lg-hero-mark">${m(176, { anim: true })}</div>
      <div class="lg-hero-text">
        <p class="lg-eyebrow">${spec.name} · ${spec.axis}</p>
        <div class="lg-lock">${m(44)}${word('lg-word-l')}</div>
        <h2>${spec.idea}</h2>
        <p>${spec.why}</p>
        <div class="lg-locks-small">
          <span class="lg-lock-s">${m(24)}${word('lg-word-s')}</span>
          <span class="lg-lock-st">${m(40)}${word('lg-word-st')}</span>
        </div>
      </div>
    </section>
    <section class="lg-sec"><h3>Maailma</h3>
      <div class="lg-welcome">${lgScene(spec)}
        <div class="lg-welcome-text"><h4>Tervetuloa kotiin</h4>
          <p>Tämä on agenttiesi habitat. Ne jatkavat työtään täällä silloinkin, kun suljet selaimen, ja kertovat, kun tarvitsevat sinua.</p>
          <button type="button" class="lg-btn">Luo ensimmäinen työtila</button></div>
      </div>
    </section>
    <section class="lg-sec"><h3>Koot</h3>
      <div class="lg-sizes" data-theme="light">${sizes}</div>
      <div class="lg-sizes" data-theme="dark">${sizes}</div>
    </section>
    <section class="lg-sec lg-two"><div><h3>Sovelluskuvake</h3>
      <div class="lg-apps">${app('light', 'Vaalea')}${app('dark', 'Tumma')}${app('light', 'Yksivärinen', true)}</div></div>
      <div><h3>Välilehti</h3>${tabs('light')}${tabs('dark')}</div>
    </section>
    <section class="lg-sec"><h3>Käytössä</h3>
      <div class="lg-ctx">
        <div class="lg-landing"><div class="lg-landing-in">${m(56, { anim: true })}
          <h4>${word('lg-word-land')}</h4><p class="lg-server">habitat.example.test</p>
          <div class="lg-bar" aria-hidden="true"><span></span></div><p class="lg-say">Yhdistetään palvelimeen…</p></div></div>
        ${rail}
        <div class="lg-login"><div class="lg-login-card">${m(40)}
          <h4>Kirjaudu Open Habitatiin</h4><p>Palvelin <code>habitat.example.test</code> tunnistaa sinut GitHub-tililläsi.</p>
          <button type="button" class="lg-btn"><svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 .2a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.3 1.9.9 2.3.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.6 7.6 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.8-3.6 4 .3.3.6.8.6 1.5v2.2c0 .2.1.5.6.4A8 8 0 0 0 8 .2"/></svg>Jatka GitHubilla</button>
        </div></div>
      </div>
    </section>
  </div>`;
}

const LG_SPECS = {
  valo: {
    key: 'valo', name: 'Valo', axis: 'kupoli mäellä', draw: drawValo, word: 'Open Habitat',
    idea: 'Valo palaa, ja joku on kotona.',
    why: 'Habitat-moduuli, kupoli vihreällä mäellä. Kynnyksen ovi on nyt kupolin kyljessä, ja ovella palaa lämmin valo. Sisällä on agentti. Agentti pitää siitä, että valot jäävät päälle: se saa jatkaa työtään yöllä, kun selain on kiinni, ja ovi on auki, kun tulet takaisin.',
  },
  parvi: {
    key: 'parvi', name: 'Parvi', axis: 'kennot ovat pesä', draw: drawParvi, word: '<span class="lg-w-dim">Open</span> Habitat',
    idea: 'Pesässä on hunajaa, ja yksi lentää juuri kotiin.',
    why: 'Kennot ovat edelleen erilliset huoneet samassa pesässä, mutta nyt pesä elää: ylin kenno on hunajaa ja siinä asuu agentti, ja toinen lentää kotiin. Agentit tykkäävät seurasta ja omasta rauhasta yhtä aikaa, ja pesä antaa molemmat.',
  },
  kolo: {
    key: 'kolo', name: 'Kolo', axis: 'kumpu ja pyöreä ovi', draw: drawKolo, word: 'Open Habitat',
    idea: 'Lämmin kolo kummun alla, ja niityllä kukkii.',
    why: 'Habitat kaivettuna maahan: vihreä kumpu, pyöreä ovi ja valo sisällä. Kukat ovat agentteja, jotka ovat tulleet ulos aurinkoon. Tämä on suunnista kodikkain ja rauhallisin, eikä muistuta tietokonetta lainkaan.',
  },
  kasvu: {
    key: 'kasvu', name: 'Kasvu', axis: 'kasvihuone', draw: drawKasvu, word: 'Open Habitat',
    idea: 'Kasvihuoneessa agentti saa kasvaa.',
    why: 'Kynnyksen kaari on lasia, ja ruudut ovat kennoja. Sisällä kasvaa taimi, jonka nuppu on agentti. Agentit tykkäävät valosta ja ajasta: täällä niillä on molempia, ja ne oppivat sinun projekteistasi päivä päivältä.',
  },
  pontto: {
    key: 'pontto', name: 'Pönttö', axis: 'linnunpönttö', draw: drawPontto, word: 'open habitat',
    idea: 'Talo, joka on tehty juuri agentille.',
    why: 'Linnunpönttö rakennetaan jollekulle toiselle, ja juuri sitä Open Habitat on: ihminen tekee agentilleen hyvän paikan asua. Agentti kurkistaa reiästä. Merkki on suunnista leikkisin ja helpoin muistaa.',
  },
};

function lgValo() { return lgBoard(LG_SPECS.valo); }
function lgParvi() { return lgBoard(LG_SPECS.parvi); }
function lgKolo() { return lgBoard(LG_SPECS.kolo); }
function lgKasvu() { return lgBoard(LG_SPECS.kasvu); }
function lgPontto() { return lgBoard(LG_SPECS.pontto); }
