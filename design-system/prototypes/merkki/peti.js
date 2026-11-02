// Merkkipeti: Open Habitatin merkki parametreista.
//
// The mark is two interlocking swooshes around a sun. Both share one outer circle (radius
// R = 100, centre 0,0). Each swoosh has an outer end on the circle (kaaren pää) and an inner
// end that sits in the other swoosh's hook (keskipää). Because the two swooshes are one
// colour, the drawing is their union as ONE closed path, cut in two by ONE stroked seam:
//
//   union  = outer arc + cap 2 + inner edge of swoosh 2 + seam start + inner edge of swoosh 1 + cap 1
//   seam   = arc around inner end 2 + curve + arc around inner end 1 + curve out of the circle
//
// The seam's inner edge is the visible outline of both inner ends, so they are exact circles
// and the gap between the swooshes stays the same width everywhere. Every segment is an
// arc (A) or a cubic (C) whose ends and tangents come from the parameters below.

const P0 = {
  link: 'free',
  // The defaults are fitted to the draft (vedos.svg) by coordinate descent on a pixel XOR;
  // what remains is mostly the draft's outline being slightly oval (271 wide, 259 tall).
  // The exit steepness is held at 35°: the fit wants it near 5°, which shaves a long flat cut
  // off swoosh 1's outer edge.
  g: 7.9,
  // Kaaren päät: angle on the circle and radius (half the stroke width there).
  aA: -93.2, eA: 14.7, aB: -13.9, eB: 15.4, stretch: 1,
  // Keskipäät: polar position of the centre and radius.
  daA: 85.7, haA: 34.7, tA: 6.1, daB: 80, haB: 159.8, hB: 14.7,
  // Paksuus: swoosh 1's width at angle lam, swoosh 2's inner edge lowest point.
  wA: 36.9, lam: -134.5, mu: 88.2, rho: 48.3,
  // Kaarevuus: handle length as a share of the chord.
  kA1: 0.37, kA2: 0.18, kB1: 0.42, kB2: 0.3, kS: 0.43, kX: 0.3,
  // Sauman reitti: where it starts, leaves inner end 2, meets inner end 1, leaves and exits.
  phi0: -80, pDir: -79.9, psi1: 129, psi2: -117, psiX: 28.2, chi: 43.1, exitAng: 35,
  // Aurinko
  sx: 4.9, sy: 6.4, sr: 23.8,
  // Teksti
  text: 'open habitat', font: 'vedos', weight: 600, size: 56, track: 0, ty: 155, wdth: 100, textOn: true,
  // Värit
  cNest: '#1d4932', cSun: '#ffa260', cText: '#1d4932', cBg: '#fefbf2',
  cNestD: '#9fd4b0', cSunD: '#ffa260', cTextD: '#e6efe9', cBgD: '#14171a',
};

const FONTS = [
  ['vedos', 'Vedoksen kirjaimet'],
  ['Nunito', 'Nunito'], ['Quicksand', 'Quicksand'], ['Varela Round', 'Varela Round'],
  ['Comfortaa', 'Comfortaa'], ['Fredoka', 'Fredoka'], ['Baloo 2', 'Baloo 2'],
  ['Lexend', 'Lexend'], ['Outfit', 'Outfit'], ['Figtree', 'Figtree'], ['Manrope', 'Manrope'],
  ['Instrument Sans', 'Instrument Sans (tuote)'], ['JetBrains Mono', 'JetBrains Mono'],
];

// The control panel: [key, label, min, max, step]. Groups open and close.
const GROUPS = [
  { name: 'Päät', open: true, rows: [
    ['link', 'Linkitys', [['free', 'Kaikki erikseen'], ['pairs', 'Kaaren päät samat, keskipäät samat'], ['all', 'Kaikki neljä samat']]],
    ['eA', 'Kaaren pää 1 · koko', 4, 30, 0.1, 'outer1'],
    ['eB', 'Kaaren pää 2 · koko', 4, 30, 0.1, 'outer2'],
    ['stretch', 'Kaaren päiden venymä', 0.6, 2.5, 0.01],
    ['hB', 'Keskipää 2 · koko', 3, 30, 0.1, 'inner2'],
    ['tA', 'Keskipää 1 · koko', 3, 30, 0.1, 'inner1'],
  ] },
  { name: 'Päiden paikat', rows: [
    ['aA', 'Kaaren pää 1 · kulma', -180, 0, 0.1],
    ['aB', 'Kaaren pää 2 · kulma', -90, 60, 0.1],
    ['haB', 'Keskipää 2 · kulma', 100, 220, 0.1],
    ['daB', 'Keskipää 2 · etäisyys', 30, 95, 0.1],
    ['haA', 'Keskipää 1 · kulma', -20, 90, 0.1],
    ['daA', 'Keskipää 1 · etäisyys', 30, 95, 0.1],
  ] },
  { name: 'Viivaleveydet', open: true, rows: [
    ['g', 'Sauma', 1, 24, 0.1],
    ['wA', 'Kaari 1 · leveys', 10, 60, 0.1],
    ['lam', 'Kaari 1 · leveimmän kohdan kulma', -200, -100, 0.5],
    ['rho', 'Kaari 2 · sisäreunan syvyys', 15, 80, 0.1],
    ['mu', 'Kaari 2 · syvimmän kohdan kulma', 30, 140, 0.5],
  ] },
  { name: 'Kaarevuus', rows: [
    ['kA1', 'Kaari 1 · alaosa', 0.05, 0.8, 0.01],
    ['kA2', 'Kaari 1 · yläosa', 0.05, 0.8, 0.01],
    ['kB1', 'Kaari 2 · oikea reuna', 0.05, 0.8, 0.01],
    ['kB2', 'Kaari 2 · pohja', 0.05, 0.8, 0.01],
    ['kS', 'Sauma · keskiosa', 0.05, 0.8, 0.01],
    ['kX', 'Sauma · ulostulo', 0.05, 0.8, 0.01],
  ] },
  { name: 'Sauman reitti', rows: [
    ['phi0', 'Alku keskipää 2:n ympärillä', -150, -20, 0.5],
    ['pDir', 'Kaari 1:n sisäreunan suunta alussa', -140, -20, 0.5],
    ['psi1', 'Irtoaa keskipää 2:sta', 40, 160, 0.5],
    ['psi2', 'Saapuu keskipää 1:lle', -200, -60, 0.5],
    ['psiX', 'Irtoaa keskipää 1:stä', -60, 90, 0.5],
    ['chi', 'Ulostulon kulma kehällä', 0, 90, 0.5],
    ['exitAng', 'Ulostulon jyrkkyys', 5, 90, 0.5],
  ] },
  { name: 'Aurinko', open: true, rows: [
    ['sx', 'Vaaka', -40, 40, 0.1], ['sy', 'Pysty', -40, 40, 0.1], ['sr', 'Koko', 5, 45, 0.1],
  ] },
  { name: 'Teksti', open: true, rows: [
    ['textOn', 'Teksti näkyy', 'bool'],
    ['text', 'Teksti', 'text'],
    ['font', 'Fontti', FONTS],
    ['weight', 'Paino', 100, 1000, 1],
    ['wdth', 'Leveys (Fredoka)', 75, 125, 1],
    ['size', 'Koko', 20, 110, 0.5],
    ['track', 'Merkkiväli', -0.1, 0.3, 0.005],
    ['ty', 'Etäisyys merkistä', 110, 240, 0.5],
  ] },
  { name: 'Värit', rows: [
    ['cNest', 'Kaaret', 'color'], ['cSun', 'Aurinko', 'color'], ['cText', 'Teksti', 'color'], ['cBg', 'Tausta', 'color'],
    ['cNestD', 'Tumma · kaaret', 'color'], ['cSunD', 'Tumma · aurinko', 'color'], ['cTextD', 'Tumma · teksti', 'color'], ['cBgD', 'Tumma · tausta', 'color'],
  ] },
];

// Vedos resets everything; the others change only their own keys.
const PRESETS = {
  'Vedos': {},
  'Tasapäät': { link: 'all', eA: 12, stretch: 1 },
  'Parit': { link: 'pairs', eA: 13.5, hB: 11 },
  'Turkoosi': { cNest: '#1d5f69', cSun: '#e9a23b', cText: '#16191d', cBg: '#ffffff', cNestD: '#4fa6b4', cSunD: '#f0bd5c', cTextD: '#e6e9ec', cBgD: '#14171a' },
};

// ---------- geometry ----------
const R = 100;
const rad = (d) => d * Math.PI / 180;
const dir = (a) => [Math.cos(rad(a)), Math.sin(rad(a))];
const add = (p, q, s = 1) => [p[0] + q[0] * s, p[1] + q[1] * s];
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const polar = (r, a, c = [0, 0]) => add(c, dir(a), r);
const n = (v) => { const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, ''); return s === '-0' ? '0' : s; };
const pt = (p) => `${n(p[0])},${n(p[1])}`;
const mod = (v) => ((v % 360) + 360) % 360;

// Linking turns the four end sizes into one or two values.
function effective(P) {
  const E = { ...P };
  if (P.link === 'pairs') { E.eB = P.eA; E.tA = P.hB; }
  if (P.link === 'all') { E.eB = E.hB = E.tA = P.eA; }
  return E;
}

// A cubic from p0 to p3 leaving along d0 and arriving along d3, handles k × chord.
function cubic(p0, d0, p3, d3, k0, k1) {
  const L = dist(p0, p3);
  return { c1: add(p0, d0, k0 * L), c2: add(p3, d3, -k1 * L), to: p3 };
}

function geometry(P) {
  const E = effective(P);
  const g = E.g;
  const HB = polar(E.daB, E.haB), TA = polar(E.daA, E.haA);
  // Ends of the outer arc and the caps.
  const OA = polar(R, E.aA), IA = polar(R - 2 * E.eA, E.aA), CA = polar(R - E.eA, E.aA);
  const OB = polar(R, E.aB), IB = polar(R - 2 * E.eB, E.aB), CB = polar(R - E.eB, E.aB);
  const outerSweep = mod(E.aA - E.aB);
  // Swoosh 2's inner edge: from its cap down to the deepest point, then onto inner end 2.
  const Bowl = polar(E.rho, E.mu);
  const Ht = polar(E.hB, E.phi0, HB), Pp = polar(E.hB + g, E.phi0, HB);
  const b1 = cubic(IB, dir(E.aB + 90), Bowl, dir(E.mu + 90), E.kB1, E.kB2);
  const b2 = cubic(Bowl, dir(E.mu + 90), Ht, dir(E.phi0 - 90), E.kB2, E.kB2);
  // Swoosh 1's inner edge: from the seam start up past its widest point to its cap.
  const Lp = polar(R - E.wA, E.lam);
  const a1 = cubic(Pp, dir(E.pDir), Lp, dir(E.lam + 90), E.kA1, E.kA1);
  const a2 = cubic(Lp, dir(E.lam + 90), IA, dir(E.aA + 90), E.kA2, E.kA2);
  // The seam centreline.
  const rB = E.hB + g / 2, rT = E.tA + g / 2;
  const S0 = polar(rB, E.phi0, HB), S1 = polar(rB, E.psi1, HB);
  const S2 = polar(rT, E.psi2, TA), S3 = polar(rT, E.psiX, TA);
  const headSweep = mod(E.phi0 - E.psi1), tailSweep = mod(E.psiX - E.psi2);
  const s1 = cubic(S1, dir(E.psi1 - 90), S2, dir(E.psi2 + 90), E.kS, E.kS);
  const exitDir = dir(E.chi + 90 - E.exitAng);
  const S4 = polar(R, E.chi);
  const s2 = cubic(S3, dir(E.psiX + 90), S4, exitDir, E.kX, E.kX);
  // Run the last line until the whole stroke width is outside the circle, however shallow the exit.
  const bq = S4[0] * exitDir[0] + S4[1] * exitDir[1];
  const S5 = add(S4, exitDir, -bq + Math.sqrt(Math.max(0, bq * bq - (R * R - (R + g) ** 2))) + 1);
  const capRot = (a) => n(a + 90);
  const C = (c) => `C ${pt(c.c1)} ${pt(c.c2)} ${pt(c.to)}`;
  const union = [
    ['M', `M ${pt(OA)}`, 'kaaren pää 1, ulkoreuna'],
    ['A', `A ${R},${R} 0 ${outerSweep > 180 ? 1 : 0} 0 ${pt(OB)}`, 'ulkokaari'],
    ['A', `A ${n(E.eB * E.stretch)},${n(E.eB)} ${capRot(E.aB)} 0 0 ${pt(IB)}`, 'kaaren pää 2'],
    ['C', C(b1), 'kaari 2, sisäreuna oikealla'],
    ['C', C(b2), 'kaari 2, sisäreunan pohja keskipää 2:lle'],
    ['L', `L ${pt(Pp)}`, 'sauman alku'],
    ['C', C(a1), 'kaari 1, sisäreuna alhaalla'],
    ['C', C(a2), 'kaari 1, sisäreuna ylös'],
    ['A', `A ${n(E.eA * E.stretch)},${n(E.eA)} ${capRot(E.aA)} 0 0 ${pt(OA)}`, 'kaaren pää 1'],
    ['Z', 'Z', ''],
  ];
  const seam = [
    ['M', `M ${pt(S0)}`, 'sauman alku keskipää 2:n päällä'],
    ['A', `A ${n(rB)},${n(rB)} 0 ${headSweep > 180 ? 1 : 0} 0 ${pt(S1)}`, 'keskipää 2:n ympäri'],
    ['C', C(s1), 'kaarten välissä'],
    ['A', `A ${n(rT)},${n(rT)} 0 ${tailSweep > 180 ? 1 : 0} 1 ${pt(S3)}`, 'keskipää 1:n ympäri'],
    ['C', C(s2), 'kohti kehää'],
    ['L', `L ${pt(S5)}`, 'ulos'],
  ];
  return { E, HB, TA, OA, IA, CA, OB, IB, CB, Bowl, Ht, Pp, Lp, S0, S1, S2, S3, S4, S5, rB, rT, a1, a2, b1, b2, s1, s2, union, seam };
}

// ---------- rendering ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// The draft in the bed's coordinates, aligned by the same fit.
const VEDOS_T = 'scale(0.3747) translate(-628.4 -556)';

function wordmark(P, color, id) {
  if (!P.textOn) return '';
  if (P.font === 'vedos') {
    const s = P.size / 56;
    return `<g fill="${color}" transform="translate(0 ${n(P.ty)}) scale(${n(s)}) translate(0 -155)"><g transform="${VEDOS_T}">${VEDOS.word}</g></g>`;
  }
  const v = P.font === 'Fredoka' ? ` style="font-variation-settings:'wdth' ${P.wdth}"` : '';
  return `<text x="0" y="${n(P.ty)}" text-anchor="middle" font-family="${esc(P.font)}" font-size="${n(P.size)}" font-weight="${P.weight}" letter-spacing="${n(P.track * P.size)}" fill="${color}"${v}>${esc(P.text)}</text>`;
}

// The logo as clean SVG source: the readable form, shown to the person and exported.
function logoSource(P, { dark = false, mark = false, id = 'oh', pretty = true, box } = {}) {
  const G = geometry(P);
  const c = dark ? { nest: P.cNestD, sun: P.cSunD, text: P.cTextD } : { nest: P.cNest, sun: P.cSun, text: P.cText };
  const nl = pretty ? '\n' : ' ', ind = pretty ? '       ' : '';
  const d = (segs) => segs.map(s => s[1]).join(nl + ind);
  const legend = (segs) => segs.filter(s => s[2]).map((s, i) => `     ${i + 1}. ${s[0]} ${s[2]}`).join('\n');
  const vb = box ?? (mark ? [-104, -104, 208, 208] : textBox(P));
  const comment = pretty ? `
  <!-- Merkki: ympyrä R=100 keskellä 0,0. Kaaret ovat yksi muoto, jonka sauma leikkaa kahtia.
   Muoto:
${legend(G.union)}
   Sauma (viiva ${n(G.E.g)} leveä, leikataan maskilla):
${legend(G.seam)} -->` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(n).join(' ')}">${comment}
  <defs>
    <mask id="${id}-sauma" maskUnits="userSpaceOnUse" x="-130" y="-130" width="260" height="260">
      <rect x="-130" y="-130" width="260" height="260" fill="#fff"/>
      <path fill="none" stroke="#000" stroke-width="${n(G.E.g)}" stroke-linecap="butt" stroke-linejoin="round"
        d="${d(G.seam)}"/>
    </mask>
  </defs>
  <path fill="${c.nest}" mask="url(#${id}-sauma)"
    d="${d(G.union)}"/>
  <circle fill="${c.sun}" cx="${n(P.sx)}" cy="${n(P.sy)}" r="${n(P.sr)}"/>${mark ? '' : `
  ${wordmark(P, c.text, id)}`}
</svg>`;
}

let measured = null;
function textBox(P) {
  const m = measured ?? { x: -160, w: 320, bottom: P.ty + 18 };
  const x0 = Math.min(-108, m.x - 8), x1 = Math.max(108, m.x + m.w + 8);
  const y1 = P.textOn ? Math.max(108, m.bottom + 8) : 108;
  return [x0, -108, x1 - x0, y1 + 108];
}

// Construction lines: the circle, the end centres, the seam centreline and every handle.
function construction(P) {
  const G = geometry(P);
  const dot = (p, r = 1.6, cls = '') => `<circle class="k-dot ${cls}" cx="${n(p[0])}" cy="${n(p[1])}" r="${r}"/>`;
  const handle = (from, c) => `<path class="k-handle" d="M ${pt(from)} L ${pt(c.c1)} M ${pt(c.to)} L ${pt(c.c2)}"/>${dot(c.c1, 1.1, 'h')}${dot(c.c2, 1.1, 'h')}`;
  const label = (p, t, dx = 4, dy = -4) => `<text class="k-label" x="${n(p[0] + dx)}" y="${n(p[1] + dy)}">${t}</text>`;
  const E = G.E;
  return `<g class="k">
    <circle class="k-circle" r="${R}"/>
    <circle class="k-circle soft" r="${n(R - 2 * E.eA)}"/>
    <path class="k-seam" d="${G.seam.map(s => s[1]).join(' ')}"/>
    <circle class="k-ring" cx="${n(G.HB[0])}" cy="${n(G.HB[1])}" r="${n(E.hB)}"/>
    <circle class="k-ring" cx="${n(G.TA[0])}" cy="${n(G.TA[1])}" r="${n(E.tA)}"/>
    ${handle(G.IB, G.b1)}${handle(G.Bowl, G.b2)}${handle(G.Pp, G.a1)}${handle(G.Lp, G.a2)}${handle(G.S1, G.s1)}${handle(G.S3, G.s2)}
    ${dot(G.CA, 2, 'e')}${dot(G.CB, 2, 'e')}${dot(G.HB, 2, 'e')}${dot(G.TA, 2, 'e')}
    ${dot(G.Bowl)}${dot(G.Lp)}${dot(G.Pp)}${dot([0, 0], 1.2)}
    ${label(G.CA, 'kaaren pää 1', 4, -6)}${label(G.CB, 'kaaren pää 2', -4, -6).replace('<text', '<text text-anchor="end"')}
    ${label(G.HB, 'keskipää 2', -4, -18).replace('<text', '<text text-anchor="end"')}${label(G.TA, 'keskipää 1', 6, -10)}
  </g>`;
}

// ---------- state, URL and panel ----------
let P = { ...P0 };
const $ = (s) => document.querySelector(s);
const view = { vedos: 0, rakenne: false, dark: false };

function load() {
  try {
    const h = new URLSearchParams(location.hash.slice(1)).get('p');
    if (h) P = { ...P0, ...JSON.parse(decodeURIComponent(escape(atob(h)))) };
  } catch {}
}
function save() {
  const diff = Object.fromEntries(Object.entries(P).filter(([k, v]) => P0[k] !== v));
  try { history.replaceState(null, '', '#p=' + btoa(unescape(encodeURIComponent(JSON.stringify(diff))))); } catch {}
  return diff;
}

function controlRow(row) {
  const [k, label, a, b, step, role] = row;
  const id = 'c-' + k;
  if (Array.isArray(a)) return `<label class="row sel" data-k="${k}"><span>${label}</span><select id="${id}">${a.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select></label>`;
  if (a === 'color') return `<label class="row col" data-k="${k}"><span>${label}</span><input type="color" id="${id}"><code id="${id}-v"></code></label>`;
  if (a === 'text') return `<label class="row txt" data-k="${k}"><span>${label}</span><input type="text" id="${id}"></label>`;
  if (a === 'bool') return `<label class="row bool" data-k="${k}"><input type="checkbox" id="${id}"><span>${label}</span></label>`;
  return `<div class="row rng" data-k="${k}" ${role ? `data-role="${role}"` : ''}><label for="${id}">${label}</label><input type="number" id="${id}-n" min="${a}" max="${b}" step="${step}" aria-label="${label}"><input type="range" id="${id}" min="${a}" max="${b}" step="${step}"><button type="button" class="reset" data-reset="${k}" title="Palauta vedoksen arvo" aria-label="Palauta ${label}">↺</button></div>`;
}

function buildPanel() {
  $('#presets').innerHTML = Object.keys(PRESETS).map(p => `<button type="button" data-preset="${p}">${p}</button>`).join('');
  $('#controls').innerHTML = GROUPS.map(g => `<details ${g.open ? 'open' : ''}><summary>${g.name}</summary>${g.rows.map(controlRow).join('')}</details>`).join('');
  for (const g of GROUPS) for (const [k, , a] of g.rows) {
    const el = $('#c-' + k), num = $('#c-' + k + '-n');
    const set = (v) => { P[k] = v; syncPanel(k); render(); };
    if (a === 'bool') el.addEventListener('change', () => set(el.checked));
    else if (a === 'text' || Array.isArray(a) || a === 'color') el.addEventListener('input', () => set(el.value));
    else {
      el.addEventListener('input', () => set(+el.value));
      num.addEventListener('input', () => { if (num.value !== '' && !isNaN(+num.value)) set(+num.value); });
    }
  }
  $('#controls').addEventListener('click', (e) => { const r = e.target.closest('[data-reset]'); if (r) { P[r.dataset.reset] = P0[r.dataset.reset]; syncPanel(); render(); } });
  $('#presets').addEventListener('click', (e) => { const b = e.target.closest('[data-preset]'); if (b) { const name = b.dataset.preset; P = name === 'Vedos' ? { ...P0 } : { ...P, ...PRESETS[name] }; syncPanel(); render(); } });
}

// Linked sizes: hide the sliders the link mode drives, and rename the one that drives them.
const ROLE_LABEL = {
  free: {}, pairs: { outer1: 'Kaaren päät · koko', inner2: 'Keskipäät · koko' }, all: { outer1: 'Kaikki päät · koko' },
};
const HIDDEN = { free: [], pairs: ['outer2', 'inner1'], all: ['outer2', 'inner1', 'inner2'] };

function syncPanel(skip) {
  for (const g of GROUPS) for (const [k, label, a] of g.rows) {
    const el = $('#c-' + k); if (!el) continue;
    if (k !== skip || a === 'bool') {
      if (a === 'bool') el.checked = !!P[k]; else el.value = P[k];
      const num = $('#c-' + k + '-n'); if (num && k !== skip) num.value = P[k];
    }
    if (a !== 'bool' && !Array.isArray(a) && a !== 'text' && a !== 'color') { const num = $('#c-' + k + '-n'); if (num && document.activeElement !== num) num.value = P[k]; }
    if (a === 'color') $('#c-' + k + '-v').textContent = P[k];
    const row = el.closest('.row'), role = row.dataset.role;
    row.classList.toggle('changed', P[k] !== P0[k]);
    if (role) {
      row.hidden = HIDDEN[P.link].includes(role);
      row.querySelector('label').textContent = ROLE_LABEL[P.link][role] ?? label;
    }
  }
  $('[data-k="wdth"]').hidden = P.font !== 'Fredoka';
  $('[data-k="weight"]').hidden = $('[data-k="track"]').hidden = $('[data-k="text"]').hidden = P.font === 'vedos';
}

// ---------- render ----------
function render() {
  const diff = save();
  // Measure the wordmark once in the stage, then size the viewBox around it.
  const stage = $('#stage');
  measured = null;
  stage.innerHTML = logoSource(P, { id: 'st', pretty: false, dark: view.dark, box: [-170, -110, 340, 400] });
  const t = stage.querySelector('svg > text');
  if (P.textOn) { if (t) { const b = t.getBBox(); measured = { x: b.x, w: b.width, bottom: b.y + b.height }; } else measured = vedosBox(); }
  const box = textBox(P);
  const svg = logoSource(P, { id: 'st', pretty: false, dark: view.dark, box });
  stage.innerHTML = svg.replace('</svg>', `${view.vedos ? `<g class="vedos" style="opacity:${view.vedos}"><g transform="${VEDOS_T}">${VEDOS.nest}${VEDOS.agent}</g>${P.textOn && P.font === 'vedos' ? '' : `<g transform="${VEDOS_T}" fill="#c33">${VEDOS.word}</g>`}</g>` : ''}${view.rakenne ? construction(P) : ''}</svg>`);
  stage.classList.toggle('dark', view.dark);
  stage.style.background = view.dark ? P.cBgD : P.cBg;
  // Sizes: the mark alone, as a favicon and an app icon would see it.
  const sizes = [16, 24, 32, 48, 64, 128];
  const row = (dark) => `<div class="sizes" style="background:${dark ? P.cBgD : P.cBg}">${sizes.map(s => `<figure><div style="width:${s}px;height:${s}px">${logoSource(P, { mark: true, dark, id: `z${dark ? 'd' : 'l'}${s}`, pretty: false })}</div><figcaption>${s}</figcaption></figure>`).join('')}
    <figure class="lock"><div style="height:40px">${logoSource(P, { dark, id: `zl${dark ? 'd' : 'l'}`, pretty: false, box: lockBox() })}</div><figcaption>vaaka</figcaption></figure></div>`;
  $('#sizes').innerHTML = row(false) + row(true);
  // Horizontal lock-up: move the wordmark beside the mark.
  for (const el of document.querySelectorAll('.lock svg')) lockUp(el);
  $('#source').textContent = logoSource(P, { box });
  $('#params').value = JSON.stringify(diff, null, 1);
}

// The draft's letters span x -159…159 and reach 11 units below the baseline at size 56.
function vedosBox() { const s = P.size / 56; return { x: -159 * s, w: 318 * s, bottom: P.ty + 11 * s }; }
function lockBox() { return [-104, -104, 208 + 40 + (measured?.w ?? 320), 208]; }
function lockUp(svg) {
  const word = svg.querySelector(':scope > text, :scope > g:not(:first-child)');
  if (!word || !P.textOn) return;
  const w = measured?.w ?? 320, s = 1.25;
  const fitted = Math.min(s, 200 / (P.size * 1.2));
  word.setAttribute('transform', `translate(${n(104 + 24 + (w * fitted) / 2)} ${n(-P.ty * fitted + P.size * 0.36 * fitted)}) scale(${n(fitted)}) ${word.getAttribute('transform') ?? ''}`);
  svg.setAttribute('viewBox', [-104, -104, 208 + 24 + w * fitted + 8, 208].map(n).join(' '));
}

// ---------- page ----------
function init() {
  load(); buildPanel(); syncPanel();
  $('#vedos').addEventListener('input', (e) => { view.vedos = +e.target.value; render(); });
  $('#rakenne').addEventListener('change', (e) => { view.rakenne = e.target.checked; render(); });
  $('#darkstage').addEventListener('change', (e) => { view.dark = e.target.checked; render(); });
  $('#copy').addEventListener('click', async () => {
    const b = $('#copy');
    try { await navigator.clipboard.writeText($('#source').textContent); b.textContent = 'Kopioitu'; }
    catch { const r = document.createRange(); r.selectNodeContents($('#source')); getSelection().removeAllRanges(); getSelection().addRange(r); b.textContent = 'Valittu, kopioi Ctrl+C'; }
    setTimeout(() => (b.textContent = 'Kopioi SVG'), 1600);
  });
  $('#download').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([$('#source').textContent], { type: 'image/svg+xml' }));
    a.download = 'open-habitat.svg'; a.click();
  });
  $('#apply').addEventListener('click', () => {
    try { P = { ...P0, ...JSON.parse($('#params').value) }; syncPanel(); render(); $('#perr').textContent = ''; }
    catch (e) { $('#perr').textContent = 'JSON ei kelpaa: ' + e.message; }
  });
  document.fonts.ready.then(render);
  render();
}
window.peti = { get P() { return P; }, set(p) { P = { ...P0, ...p }; syncPanel(); render(); }, P0, geometry, logoSource };
init();
