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
// arc (A) or a cubic (C).
//
// Joins are curvature-continuous (G2), not only tangent-continuous (G1): a cubic's handle
// lengths are solved so that its curvature at each end equals its neighbour's there. The
// eye reads a curvature jump as a kink or a dent even when the tangent is continuous, and
// a handle set by hand (a share of the chord) almost never matches. Where the cubic meets
// an exact circle it takes the circle's curvature; at the outer caps the stem takes the
// curvature of a stroke parallel to the outer circle, which is how a round-capped pen line
// looks, and "pehmennys" replaces each cap joint with a G2 blend curve.

const P0 = {
  link: 'free',
  // The defaults are fitted to the draft (vedos.svg) by coordinate descent on a pixel XOR;
  // what remains is mostly the draft's outline being slightly oval (271 wide, 259 tall).
  g: 7.9,
  // Kaaren päät: angle on the circle and radius (half the stroke width there).
  aA: -92.8, eA: 14.8, aB: -11.9, eB: 16.5,
  // Keskipäät: polar position of the centre and radius.
  daA: 85.6, haA: 34.7, tA: 5.9, daB: 79, haB: 159.3, hB: 15.5,
  // Paksuus: swoosh 1's width at angle lam, swoosh 2's inner edge lowest point.
  wA: 36.9, lam: -134.3, mu: 99.2, rho: 46.1,
  // Kaarevuus: radii at the two knots inside the swooshes, and the one free handle (a share
  // of the chord) where swoosh 1's inner edge starts from the seam in a corner.
  // The radii are wishes: the solver takes the nearest value at which both curves meeting
  // there can be curvature-continuous.
  rLam: 305, rBowl: 42.4, kA1: 0.47, kS: 0.41,
  // Liitokset: length of the G2 blends at the outer caps' joints and where the seam leaves
  // and meets the inner ends.
  soft: 4, softI: 6,
  // Sauman reitti: where it starts, leaves inner end 2, meets inner end 1 and leaves it.
  phi0: -82.5, pDir: -82.9, psi1: 130.8, psi2: -118, psiX: 28.5,
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
    ['soft', 'Kaaren päiden pehmennys', 0, 14, 0.1],
    ['softI', 'Keskipäiden pehmennys', 0, 14, 0.1],
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
    ['rLam', 'Kaari 1 · sisäreunan säde leveimmässä kohdassa', 20, 600, 1],
    ['rBowl', 'Kaari 2 · sisäreunan säde pohjalla', 10, 200, 0.5],
    ['kA1', 'Kaari 1 · sisäreunan alkukahva saumalla', 0.05, 0.8, 0.01],
    ['kS', 'Sauma · keskiosan kahvat', 0.05, 0.8, 0.01],
  ] },
  { name: 'Sauman reitti', rows: [
    ['phi0', 'Alku keskipää 2:n ympärillä', -150, -20, 0.5],
    ['pDir', 'Kaari 1:n sisäreunan suunta alussa', -140, -20, 0.5],
    ['psi1', 'Irtoaa keskipää 2:sta', 40, 160, 0.5],
    ['psi2', 'Saapuu keskipää 1:lle', -200, -60, 0.5],
    ['psiX', 'Irtoaa keskipää 1:stä (ulostulon suunta)', -60, 90, 0.5],
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
  'Tasapäät': { link: 'all', eA: 12 },
  'Parit': { link: 'pairs', eA: 13.5, hB: 11 },
  'Turkoosi': { cNest: '#1d5f69', cSun: '#e9a23b', cText: '#16191d', cBg: '#ffffff', cNestD: '#4fa6b4', cSunD: '#f0bd5c', cTextD: '#e6e9ec', cBgD: '#14171a' },
};

// ---------- geometry ----------
const R = 100;
const rad = (d) => d * Math.PI / 180, DEG = 180 / Math.PI;
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

// A cubic from p0 to p3 leaving along d0 and arriving along d3, handles k × chord. G1 only;
// the G2 solvers below fall back to it when they have no solution.
function cubic(p0, d0, p3, d3, k0, k1) {
  const L = dist(p0, p3);
  return { c1: add(p0, d0, k0 * L), c2: add(p3, d3, -k1 * L), to: p3 };
}
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const unit = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };

// Curvature-continuous cubic (G2 Hermite): ends p0, p3, unit tangents t0, t3 and signed
// curvatures k0, k3 (SVG coordinates, positive = turning clockwise on screen). With handle
// lengths a, b the end curvatures are
//   k0 = 2/3 · (X0 − b·c) / a²,   k3 = 2/3 · (X3 − a·c) / b²,
// X0 = t0 × D, X3 = D × t3, c = t0 × t3, D = p3 − p0. The two equations are solved for
// positive a, b; of several solutions the one closest to the plain chord/3 handles wins.
const HMIN = 0.15, HMAX = 1.1;
function g2solve(p0, t0, k0, p3, t3, k3) {
  const D = sub(p3, p0), L = Math.hypot(D[0], D[1]), X0 = cross(t0, D), X3 = cross(D, t3), c = cross(t0, t3);
  // A handle shorter than ~15 % of the chord meets the curvature but crams the change into
  // the last few units before the join: the dent moves instead of going away.
  const ok = (a, b) => a > HMIN * L && b > HMIN * L && a < HMAX * L && b < HMAX * L;
  const cost = (a, b) => Math.abs(Math.log(a / (L / 3))) + Math.abs(Math.log(b / (L / 3)));
  let best = null;
  const take = (a, b) => { if (ok(a, b) && (!best || cost(a, b) < cost(...best))) best = [a, b]; };
  if (Math.abs(c) < 1e-6) {
    take(Math.sqrt(X0 / (1.5 * k0)), Math.sqrt(X3 / (1.5 * k3)));
  } else {
    // b from the first equation, then a root of the second by scanning a and bisecting.
    const bOf = (a) => (X0 - 1.5 * k0 * a * a) / c;
    const f = (a) => { const b = bOf(a); return 1.5 * k3 * b * b + a * c - X3; };
    const N = 240, top = HMAX * L;
    let pa = 1e-4 * L, pf = f(pa);
    for (let i = 1; i <= N; i++) {
      const a = top * i / N, fa = f(a);
      if (Math.sign(fa) !== Math.sign(pf)) {
        let lo = pa, hi = a, flo = pf;
        for (let j = 0; j < 40; j++) { const m = (lo + hi) / 2, fm = f(m); if (Math.sign(fm) === Math.sign(flo)) { lo = m; flo = fm; } else hi = m; }
        take((lo + hi) / 2, bOf((lo + hi) / 2));
      }
      pa = a; pf = fa;
    }
  }
  return best && { c1: add(p0, t0, best[0]), c2: add(p3, t3, -best[1]), to: p3 };
}
// G2 or, when there is none, a plain cubic and a warning naming the place.
function g2(p0, t0, k0, p3, t3, k3, warn, name) {
  const c = g2solve(p0, t0, k0, p3, t3, k3);
  if (!c) { warn?.push(name); return cubic(p0, t0, p3, t3, 1 / 3, 1 / 3); }
  return c;
}
// One-sided G2 with the start handle fixed (k0share × chord, for a corner): end curvature matched.
function g2endSolve(p0, t0, k0share, p3, t3, k3) {
  const D = sub(p3, p0), L = Math.hypot(D[0], D[1]), a = k0share * L;
  const b = Math.sqrt((cross(D, t3) - a * cross(t0, t3)) / (1.5 * k3));
  return b > HMIN * L && b < HMAX * L ? { c1: add(p0, t0, a), c2: add(p3, t3, -b), to: p3 } : null;
}
// One-sided G2 with the end handle fixed (k3share × chord, for a free end): start curvature matched.
function g2start(p0, t0, k0, p3, t3, k3share, warn, name) {
  const D = sub(p3, p0), L = Math.hypot(D[0], D[1]), b = k3share * L;
  const a = Math.sqrt((cross(t0, D) - b * cross(t0, t3)) / (1.5 * k0));
  if (!(a > HMIN * L && a < HMAX * L)) { warn?.push(name); return cubic(p0, t0, p3, t3, 1 / 3, k3share); }
  return { c1: add(p0, t0, a), c2: add(p3, t3, -b), to: p3 };
}
// The curvature at an inner knot: the wished value if both curves meeting there have a G2
// solution with it, else the nearest that does. Returns [k, curves] or null.
function knot(wish, make) {
  const r = make(wish); if (r) return [wish, r];
  for (let i = 1; i <= 300; i++) for (const sg of [1, -1]) {
    const k = wish + sg * i * 0.0005 * (1 + i / 60), r2 = make(k);
    if (r2) return [k, r2];
  }
  return null;
}

// Cubic helpers for splitting a stem where a blend takes over.
const bez = (p0, c, t) => { const m = 1 - t; return [0, 1].map(i => m * m * m * p0[i] + 3 * m * m * t * c.c1[i] + 3 * m * t * t * c.c2[i] + t * t * t * c.to[i]); };
const bezD1 = (p0, c, t) => { const m = 1 - t; return [0, 1].map(i => 3 * m * m * (c.c1[i] - p0[i]) + 6 * m * t * (c.c2[i] - c.c1[i]) + 3 * t * t * (c.to[i] - c.c2[i])); };
const bezD2 = (p0, c, t) => [0, 1].map(i => 6 * (1 - t) * (c.c2[i] - 2 * c.c1[i] + p0[i]) + 6 * t * (c.to[i] - 2 * c.c2[i] + c.c1[i]));
const bezK = (p0, c, t) => { const d1 = bezD1(p0, c, t); return cross(d1, bezD2(p0, c, t)) / Math.hypot(d1[0], d1[1]) ** 3; };
// de Casteljau: the parts before and after t.
function bezSplit(p0, c, t) {
  const l = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const p01 = l(p0, c.c1), p12 = l(c.c1, c.c2), p23 = l(c.c2, c.to), p012 = l(p01, p12), p123 = l(p12, p23), m = l(p012, p123);
  return [{ c1: p01, c2: p012, to: m }, { c1: p123, c2: p23, to: c.to }];
}
// Parameter at arc length s from the start (fromEnd: from the end).
function bezAt(p0, c, s, fromEnd) {
  let acc = 0, prev = bez(p0, c, fromEnd ? 1 : 0);
  for (let i = 1; i <= 200; i++) {
    const t = fromEnd ? 1 - i / 200 : i / 200, q = bez(p0, c, t);
    acc += dist(prev, q); prev = q;
    if (acc >= s) return t;
  }
  return fromEnd ? 0 : 1;
}
// A point on a circle traversed with SVG sweep flag `sw`: position, tangent, signed curvature.
const onCircle = (C, r, a, sw) => ({ p: polar(r, a, C), t: sw ? dir(a + 90) : dir(a - 90), k: sw ? 1 / r : -1 / r });
const onCubic = (p0, c, t) => ({ p: bez(p0, c, t), t: unit(bezD1(p0, c, t)), k: bezK(p0, c, t) });
const blend = (A, B, warn, name) => g2(A.p, A.t, A.k, B.p, B.t, B.k, warn, name);
// How far a transition's curvature strays outside the range between its end curvatures,
// summed along it. A blend should ease from one curvature to the other; a hump in between
// is a bump on the outline.
function overshoot(p0, c, k0, k3) {
  const lo = Math.min(k0, k3), hi = Math.max(k0, k3), span = Math.max(hi - lo, 1e-3);
  let x = 0;
  for (let i = 1; i < 24; i++) { const k = bezK(p0, c, i / 24); x += Math.max(0, k - hi, lo - k) / span; }
  return x;
}
// A blend whose far end slides along a stem: at(s) gives the stem point s units in. Of the
// slide lengths in [lo, hi] that have a G2 solution, the smoothest ramp wins.
function slideBlend(A, at, wish, lo, hi, reverse, warn, name) {
  let best = null;
  for (let i = 0; i <= 40; i++) {
    const sl = lo + (hi - lo) * i / 40, B = at(sl);
    const c = reverse ? g2solve(B.p, B.t, B.k, A.p, A.t, A.k) : g2solve(A.p, A.t, A.k, B.p, B.t, B.k);
    if (!c) continue;
    const score = overshoot(reverse ? B.p : A.p, c, reverse ? B.k : A.k, reverse ? A.k : B.k) + 0.02 * Math.abs(sl - wish) / wish;
    if (!best || score < best.score) best = { c, B, sl, score };
  }
  if (best) return best;
  warn.push(name);
  const B = at(wish);
  return { c: reverse ? cubic(B.p, B.t, A.p, A.t, 1 / 3, 1 / 3) : cubic(A.p, A.t, B.p, B.t, 1 / 3, 1 / 3), B, sl: wish };
}

function geometry(P) {
  const E = effective(P);
  const g = E.g, warn = [];
  const HB = polar(E.daB, E.haB), TA = polar(E.daA, E.haA);
  // Ends of the outer arc and the caps.
  const OA = polar(R, E.aA), IA = polar(R - 2 * E.eA, E.aA), CA = polar(R - E.eA, E.aA);
  const OB = polar(R, E.aB), IB = polar(R - 2 * E.eB, E.aB), CB = polar(R - E.eB, E.aB);
  // Swoosh 2's inner edge: from its cap down to the deepest point, then onto inner end 2.
  // At the cap it curves like a stroke parallel to the outer circle; at inner end 2 it takes
  // that circle's curvature, so the end and the edge are one smooth line.
  const Bowl = polar(E.rho, E.mu), tBowl = dir(E.mu + 90);
  const Ht = polar(E.hB, E.phi0, HB), Pp = polar(E.hB + g, E.phi0, HB);
  const tIB = dir(E.aB + 90), kIB = 1 / (R - 2 * E.eB), tHt = dir(E.phi0 - 90);
  const kb = knot(1 / E.rBowl, (k) => { const x = g2solve(IB, tIB, kIB, Bowl, tBowl, k), y = x && g2solve(Bowl, tBowl, k, Ht, tHt, -1 / E.hB); return y && [x, y]; });
  // Without a common knot curvature the ends stay smooth and only the knot inside breaks.
  if (!kb) warn.push('kaari 2:n pohja');
  const [b1, b2] = kb ? kb[1] : [g2start(IB, tIB, kIB, Bowl, tBowl, 1 / 3), g2endSolve(Bowl, tBowl, 1 / 3, Ht, tHt, -1 / E.hB) ?? cubic(Bowl, tBowl, Ht, tHt, 1 / 3, 1 / 3)];
  // Swoosh 1's inner edge: from the seam start (a corner) up past its widest point to its cap.
  const Lp = polar(R - E.wA, E.lam), tLp = dir(E.lam + 90), tIA = dir(E.aA + 90), kIA = 1 / (R - 2 * E.eA);
  // The corner handle gives way (nearest share first) when no knot curvature works with it.
  let ka = null, kA1used = E.kA1;
  for (let i = 0; i <= 30 && !ka; i++) for (const sg of i ? [1, -1] : [1]) {
    const h = E.kA1 + sg * i * 0.025; if (h < 0.05 || h > 1) continue;
    ka = knot(1 / E.rLam, (k) => { const x = g2endSolve(Pp, dir(E.pDir), h, Lp, tLp, k), y = x && g2solve(Lp, tLp, k, IA, tIA, kIA); return y && [x, y]; });
    if (ka) { kA1used = h; break; }
  }
  if (!ka) warn.push('kaari 1:n leveimmän kohdan');
  const [a1, a2] = ka ? ka[1] : [cubic(Pp, dir(E.pDir), Lp, tLp, E.kA1, 1 / 3), g2endSolve(Lp, tLp, 1 / 3, IA, tIA, kIA) ?? cubic(Lp, tLp, IA, tIA, 1 / 3, 1 / 3)];
  const used = { rBowl: kb ? 1 / kb[0] : NaN, rLam: ka ? 1 / ka[0] : NaN, kA1: kA1used };
  // The seam centreline. The middle is a plain cubic between the two circles; a G2 blend of
  // length softI joins it to each circle. The exit takes inner end 1's curvature and runs on
  // past the circle, where nothing of it shows.
  const rB = E.hB + g / 2, rT = E.tA + g / 2;
  const S0 = polar(rB, E.phi0, HB), S1 = polar(rB, E.psi1, HB);
  const S2 = polar(rT, E.psi2, TA), S3 = polar(rT, E.psiX, TA);
  const tailSweep = mod(E.psiX - E.psi2);
  const spine = cubic(S1, dir(E.psi1 - 90), S2, dir(E.psi2 + 90), E.kS, E.kS);
  const sI = Math.max(0, Math.min(E.softI, rB * 1.2, rT * 1.2, (mod(E.psiX - E.psi2) * Math.PI / 180) * rT * 0.45));
  const hEnd = onCircle(HB, rB, E.psi1 + sI / rB * DEG, 0), tStart = onCircle(TA, rT, E.psi2 + sI / rT * DEG, 1);
  const atSpine = (from) => (sl) => { const u = bezAt(S1, spine, sl, from); return { ...onCubic(S1, spine, u), u }; };
  const bl0 = sI > 0.05 ? slideBlend(hEnd, atSpine(false), sI, 0.4 * sI, 3 * sI, false, warn, 'keskipää 2') : null;
  const bl1 = sI > 0.05 ? slideBlend(tStart, atSpine(true), sI, 0.4 * sI, 3 * sI, true, warn, 'keskipää 1') : null;
  const u0 = bl0 ? bl0.B.u : 0, u1 = bl1 ? bl1.B.u : 1;
  const mid = bezSplit(S1, bezSplit(S1, spine, u1)[0], u0 / u1)[1];
  const j0 = bl0?.B, j1 = bl1?.B;
  // The exit leaves inner end 1 straight along its tangent, as a round pen tip leaves a
  // straight line, and runs past the outer circle where nothing of it shows.
  const exitDir = dir(E.psiX + 90);
  const bq = S3[0] * exitDir[0] + S3[1] * exitDir[1];
  const S5 = add(S3, exitDir, -bq + Math.sqrt(Math.max(0, bq * bq - (S3[0] ** 2 + S3[1] ** 2 - (R + g) ** 2))) + 1);
  const S4 = add(S3, exitDir, -bq + Math.sqrt(Math.max(0, bq * bq - (S3[0] ** 2 + S3[1] ** 2 - R * R))));
  const xI = Math.min(sI, rT * 1.2);
  const tEnd = onCircle(TA, rT, E.psiX - xI / rT * DEG, 1);
  const blX = xI > 0.05 ? slideBlend(tEnd, (sl) => ({ p: add(S3, exitDir, sl), t: exitDir, k: 0 }), xI, 0.4 * xI, Math.min(3 * xI, dist(S3, S4)), false, warn, 'sauma ulos') : null;
  const C = (c) => `C ${pt(c.c1)} ${pt(c.c2)} ${pt(c.to)}`;
  const arc = (r, sweepDeg, sw, to) => `A ${n(r)},${n(r)} 0 ${sweepDeg > 180 ? 1 : 0} ${sw} ${pt(to)}`;
  // A cap is drawn as two arcs that meet at its tip. A single half-circle arc is ambiguous
  // once its radius is rounded: the renderer may draw it a hair short or long, and the cap
  // then meets its stem with a small kink.
  const cap = (Cc, r, a0, a1, label) => {
    const tip = polar(r, (a0 + a1) / 2, Cc), half = Math.abs(a0 - a1) / 2;
    return [['A', arc(r, half, 0, tip), label + ', alkupuoli'], ['A', arc(r, half, 0, polar(r, a1, Cc)), label + ', loppupuoli']];
  };
  const cubics = [];
  const Cs = (from, c) => { cubics.push([from, c]); return C(c); };
  let union;
  const s = E.soft;
  if (s > 0.05) {
    // Pehmennys: each cap's two joints become G2 blends of length ~2s. The outer arc, the
    // cap circles and the stems are trimmed by s, and a blend cubic joins the cut ends.
    const sB = Math.min(s, E.eB * 1.2), sA = Math.min(s, E.eA * 1.2);
    const oStart = onCircle([0, 0], R, E.aA - s / R * DEG, 0), oEnd = onCircle([0, 0], R, E.aB + s / R * DEG, 0);
    const qBo = onCircle(CB, E.eB, E.aB - sB / E.eB * DEG, 0), qBi = onCircle(CB, E.eB, E.aB - 180 + sB / E.eB * DEG, 0);
    const qAi = onCircle(CA, E.eA, E.aA + 180 - sA / E.eA * DEG, 0), qAo = onCircle(CA, E.eA, E.aA + sA / E.eA * DEG, 0);
    const sbB = slideBlend(qBi, (sl) => { const u = bezAt(IB, b1, sl); return { ...onCubic(IB, b1, u), u }; }, s, 0.4 * s, 3 * s, false, warn, 'kaaren pää 2 sisällä');
    const sbA = slideBlend(qAi, (sl) => { const u = bezAt(Lp, a2, sl, true); return { ...onCubic(Lp, a2, u), u }; }, s, 0.4 * s, 3 * s, true, warn, 'kaaren pää 1 sisällä');
    const jB = sbB.B, jA = sbA.B, b1r = bezSplit(IB, b1, jB.u)[1], a2l = bezSplit(Lp, a2, jA.u)[0];
    const obB = slideBlend(qBo, (sl) => onCircle([0, 0], R, E.aB + sl / R * DEG, 0), s, 0.4 * s, 4 * s, true, warn, 'kaaren pää 2 ulkona');
    const obA = slideBlend(qAo, (sl) => onCircle([0, 0], R, E.aA - sl / R * DEG, 0), s, 0.4 * s, 4 * s, false, warn, 'kaaren pää 1 ulkona');
    const oEndS = obB.B, oStartS = obA.B, bOut = obB.c, bIn = sbB.c, aIn = sbA.c, aOut = obA.c;
    union = [
      ['M', `M ${pt(oStartS.p)}`, 'ulkokaaren alku'],
      ['A', arc(R, mod(E.aA - E.aB) - (obA.sl + obB.sl) / R * DEG, 0, oEndS.p), 'ulkokaari'],
      ['C', Cs(oEndS.p, bOut), 'pehmennys kaaren pää 2:lle'],
      ...cap(CB, E.eB, E.aB - sB / E.eB * DEG, E.aB - 180 + sB / E.eB * DEG, 'kaaren pää 2'),
      ['C', Cs(qBi.p, bIn), 'pehmennys varteen'],
      ['C', Cs(jB.p, b1r), 'kaari 2, sisäreuna oikealla'],
      ['C', Cs(Bowl, b2), 'kaari 2, sisäreunan pohja keskipää 2:lle'],
      ['L', `L ${pt(Pp)}`, 'sauman alku'],
      ['C', Cs(Pp, a1), 'kaari 1, sisäreuna alhaalla'],
      ['C', Cs(Lp, a2l), 'kaari 1, sisäreuna ylös'],
      ['C', Cs(jA.p, aIn), 'pehmennys kaaren pää 1:lle'],
      ...cap(CA, E.eA, E.aA + 180 - sA / E.eA * DEG, E.aA + sA / E.eA * DEG, 'kaaren pää 1'),
      ['C', Cs(qAo.p, aOut), 'pehmennys ulkokaareen'],
      ['Z', 'Z', ''],
    ];
  } else {
    union = [
      ['M', `M ${pt(OA)}`, 'kaaren pää 1, ulkoreuna'],
      ['A', arc(R, mod(E.aA - E.aB), 0, OB), 'ulkokaari'],
      ...cap(CB, E.eB, E.aB, E.aB - 180, 'kaaren pää 2'),
      ['C', Cs(IB, b1), 'kaari 2, sisäreuna oikealla'],
      ['C', Cs(Bowl, b2), 'kaari 2, sisäreunan pohja keskipää 2:lle'],
      ['L', `L ${pt(Pp)}`, 'sauman alku'],
      ['C', Cs(Pp, a1), 'kaari 1, sisäreuna alhaalla'],
      ['C', Cs(Lp, a2), 'kaari 1, sisäreuna ylös'],
      ...cap(CA, E.eA, E.aA + 180, E.aA, 'kaaren pää 1'),
      ['Z', 'Z', ''],
    ];
  }
  const headSweep = mod(E.phi0 - E.psi1) - (sI / rB) * DEG;
  const seam = sI > 0.05 ? [
    ['M', `M ${pt(S0)}`, 'sauman alku keskipää 2:n päällä'],
    ['A', arc(rB, headSweep, 0, hEnd.p), 'keskipää 2:n ympäri'],
    ['C', Cs(hEnd.p, bl0.c), 'pehmennys'],
    ['C', Cs(j0.p, mid), 'kaarten välissä'],
    ['C', Cs(j1.p, bl1.c), 'pehmennys'],
    ['A', arc(rT, tailSweep - (sI + xI) / rT * DEG, 1, tEnd.p), 'keskipää 1:n ympäri'],
    ['C', Cs(tEnd.p, blX.c), 'pehmennys'],
    ['L', `L ${pt(S5)}`, 'suoraan ulos kehän yli'],
  ] : [
    ['M', `M ${pt(S0)}`, 'sauman alku keskipää 2:n päällä'],
    ['A', arc(rB, headSweep, 0, S1), 'keskipää 2:n ympäri'],
    ['C', Cs(S1, spine), 'kaarten välissä'],
    ['A', arc(rT, tailSweep, 1, S3), 'keskipää 1:n ympäri'],
    ['L', `L ${pt(S5)}`, 'suoraan ulos kehän yli'],
  ];
  return { E, warn, used, cubics, HB, TA, OA, IA, CA, OB, IB, CB, Bowl, Ht, Pp, Lp, S0, S1, S2, S3, S4, S5, rB, rT, a1, a2, b1, b2, union, seam };
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
    ${G.cubics.map(([from, c]) => handle(from, c)).join('')}
    ${dot(G.CA, 2, 'e')}${dot(G.CB, 2, 'e')}${dot(G.HB, 2, 'e')}${dot(G.TA, 2, 'e')}
    ${dot(G.Bowl)}${dot(G.Lp)}${dot(G.Pp)}${dot([0, 0], 1.2)}
    ${label(G.CA, 'kaaren pää 1', 4, -6)}${label(G.CB, 'kaaren pää 2', -4, -6).replace('<text', '<text text-anchor="end"')}
    ${label(G.HB, 'keskipää 2', -4, -18).replace('<text', '<text text-anchor="end"')}${label(G.TA, 'keskipää 1', 6, -10)}
  </g>`;
}

// Curvature comb: hairs along each segment's normal, length proportional to curvature. A
// jump in hair length at a join is a curvature break the eye reads as a kink; hairs that
// swap sides are an inflection. Segments are parsed back from the path data, so the comb
// shows exactly what the SVG draws.
function segments(d) {
  const tok = d.match(/[MLCAZ]|-?[\d.]+(?:e-?\d+)?/g); const out = []; let i = 0, cur = [0, 0], start = [0, 0];
  const num = () => +tok[i++];
  while (i < tok.length) {
    const c = tok[i++];
    if (c === 'M') { cur = start = [num(), num()]; }
    else if (c === 'L') { const p0 = cur, p1 = [num(), num()]; out.push((t) => [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]); cur = p1; }
    else if (c === 'C') { const p0 = cur, a = [num(), num()], b = [num(), num()], p3 = [num(), num()];
      out.push((t) => { const m = 1 - t; return [0, 1].map(k => m * m * m * p0[k] + 3 * m * m * t * a[k] + 3 * m * t * t * b[k] + t * t * t * p3[k]); }); cur = p3; }
    else if (c === 'A') { const rx0 = num(), ry0 = num(), rot = num(), large = num(), sweep = num(), p1 = [num(), num()];
      out.push(arcFn(cur, rx0, ry0, rot, large, sweep, p1)); cur = p1; }
    else if (c === 'Z') { cur = start; }
  }
  return out;
}
// SVG arc, endpoint to centre parametrisation (SVG 1.1 F.6.5).
function arcFn(p0, rx, ry, rotDeg, large, sweep, p1) {
  const f = rad(rotDeg), cf = Math.cos(f), sf = Math.sin(f);
  const dx = (p0[0] - p1[0]) / 2, dy = (p0[1] - p1[1]) / 2;
  const x1 = cf * dx + sf * dy, y1 = -sf * dx + cf * dy;
  const lam = x1 * x1 / (rx * rx) + y1 * y1 / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const sgn = large === sweep ? -1 : 1;
  const co = sgn * Math.sqrt(Math.max(0, (rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1) / (rx * rx * y1 * y1 + ry * ry * x1 * x1)));
  const cx1 = co * rx * y1 / ry, cy1 = -co * ry * x1 / rx;
  const cx = cf * cx1 - sf * cy1 + (p0[0] + p1[0]) / 2, cy = sf * cx1 + cf * cy1 + (p0[1] + p1[1]) / 2;
  const ang = (ux, uy) => Math.atan2(uy, ux);
  const t1 = ang((x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = ang((-x1 - cx1) / rx, (-y1 - cy1) / ry) - t1;
  if (sweep && dt < 0) dt += 2 * Math.PI; if (!sweep && dt > 0) dt -= 2 * Math.PI;
  return (t) => { const a = t1 + dt * t, x = rx * Math.cos(a), y = ry * Math.sin(a); return [cf * x - sf * y + cx, sf * x + cf * y + cy]; };
}
function curvatureAt(f, t) {
  const h = 1e-3, a = f(Math.max(0, t - h)), b = f(t), c = f(Math.min(1, t + h));
  const s = t <= 0 ? [f(0), f(h), f(2 * h)] : t >= 1 ? [f(1 - 2 * h), f(1 - h), f(1)] : [a, b, c];
  const d1 = [(s[2][0] - s[0][0]) / 2, (s[2][1] - s[0][1]) / 2], d2 = [s[2][0] - 2 * s[1][0] + s[0][0], s[2][1] - 2 * s[1][1] + s[0][1]];
  const sp = Math.hypot(d1[0], d1[1]) || 1e-9;
  return { p: b, k: (d1[0] * d2[1] - d1[1] * d2[0]) / sp ** 3, nrm: [-d1[1] / sp, d1[0] / sp] };
}
function comb(d, cls, scale = 60) {
  let hairs = '', env = '';
  for (const f of segments(d)) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const { p, k, nrm } = curvatureAt(f, i / 24), L = Math.max(-28, Math.min(28, -k * scale));
      const q = [p[0] + nrm[0] * L, p[1] + nrm[1] * L]; pts.push(q);
      hairs += `M${pt(p)}L${pt(q)}`;
    }
    env += `M${pts.map(pt).join('L')}`;
  }
  return `<path class="comb ${cls}" d="${hairs}"/><path class="comb-env ${cls}" d="${env}"/>`;
}
function combs(P) {
  const G = geometry(P);
  const vis = G.union.filter(s => !s[2].startsWith('sauman alku')).map(s => s[1]).join(' ');
  return `<g class="combs">${comb(vis, 'u')}${comb(G.seam.map(s => s[1]).join(' '), 's')}</g>`;
}

// ---------- state, URL and panel ----------
let P = { ...P0 };
const $ = (s) => document.querySelector(s);
const view = { vedos: 0, rakenne: false, kampa: false, dark: false };

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
  const GG = geometry(P), W = GG.warn, notes = [];
  if (W.length) notes.push(`Kaarevuus katkeaa näissä kohdissa, koska näillä arvoilla niihin ei löydy sileää käyrää: ${W.join(', ')}. Kaarevuuskampa näyttää kohdan.`);
  for (const [k, label] of [['rBowl', 'Kaari 2:n pohjan säde'], ['rLam', 'Kaari 1:n säde leveimmässä kohdassa'], ['kA1', 'Kaari 1:n alkukahva']])
    if (isFinite(GG.used[k]) && Math.abs(GG.used[k] - GG.E[k]) > (k === 'kA1' ? 0.01 : 0.5)) notes.push(`${label} on ${n(GG.used[k])}, koska ${n(GG.E[k])} ei anna sileää käyrää.`);
  $('#warn').hidden = !notes.length;
  $('#warn').textContent = notes.join(' ');
  const svg = logoSource(P, { id: 'st', pretty: false, dark: view.dark, box });
  stage.innerHTML = svg.replace('</svg>', `${view.vedos ? `<g class="vedos" style="opacity:${view.vedos}"><g transform="${VEDOS_T}">${VEDOS.nest}${VEDOS.agent}</g>${P.textOn && P.font === 'vedos' ? '' : `<g transform="${VEDOS_T}" fill="#c33">${VEDOS.word}</g>`}</g>` : ''}${view.rakenne ? construction(P) : ''}${view.kampa ? combs(P) : ''}</svg>`);
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
  $('#kampa').addEventListener('change', (e) => { view.kampa = e.target.checked; render(); });
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
window.peti = { g2, get P() { return P; }, set(p) { P = { ...P0, ...p }; syncPanel(); render(); }, P0, geometry, logoSource };
init();
