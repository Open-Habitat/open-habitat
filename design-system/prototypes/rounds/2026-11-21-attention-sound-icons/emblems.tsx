import React, {type ReactNode} from 'react';
import type {SoundId} from './text';

// The ten emblems in three directions, all in round 3's B Renkaat family:
// drawn in a 64-unit box around the centre, readable at rest, and while the
// sound plays each strike spreads outward at its own onset (`Strike.at`, read
// from the recipe of the chosen length) in the direction's own ring shape.
//
//   object   A: the object in the middle (a pictogram inside r ≈ 11) and one
//            ring per strike around it, as in round 3's B.
//   ripple   B: no picture; the rings' own geometry says the object: oval
//            water rings below a drop, hexagonal ice, two glasses' rings
//            interfering, bubbles that are not concentric.
//   pattern  C: a ring bent by the sound's partials, r(θ) = R(1 + Σ a·cos nθ),
//            a cymatics figure: the wine glass's (2,0) oval, the kalimba
//            tine's ~6:1 overtone as six waves, a sharp star for ice.

export type Dir = 'object' | 'ripple' | 'pattern';
export const DIRS: Dir[] = ['object', 'ripple', 'pattern'];
export type Strike = {at: number; amp: number; ring: number};
type Origin = {x: number; y: number; d: string};
type Emblem = {still: ReactNode; origins: Origin[]};

const f = (v: number) => +v.toFixed(2);
const circle = (r: number, x = 0, y = 0) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const ellipse = (rx: number, ry: number, x = 0, y = 0) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
const stadium = (w: number, h: number) => { const r = h / 2, s = w / 2 - r; return `M${f(-s)} ${f(-r)}H${f(s)}a${f(r)} ${f(r)} 0 0 1 0 ${f(h)}H${f(-s)}a${f(r)} ${f(r)} 0 0 1 0 ${f(-h)}Z`; };
const hexagon = (r: number) => Array.from({length: 6}, (_, k) => { const a = -Math.PI / 2 + k * Math.PI / 3; return `${k ? 'L' : 'M'}${f(r * Math.cos(a))} ${f(r * Math.sin(a))}`; }).join('') + 'Z';
const arch = (r: number, x: number, y: number) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 0 1 ${f(2 * r)} 0`;
/** A closed curve r(θ) = R·g(θ), sampled finely enough for a smooth stroke. */
const polar = (R: number, g: (th: number) => number, rot = 0, steps = 144) =>
  Array.from({length: steps}, (_, k) => { const th = k / steps * 2 * Math.PI; const r = R * g(th); return `${k ? 'L' : 'M'}${f(r * Math.cos(th + rot))} ${f(r * Math.sin(th + rot))}`; }).join('') + 'Z';
const lobes = (terms: [number, number, number][]) => (th: number) => 1 + terms.reduce((s, [n, a, p]) => s + a * Math.cos(n * th + p), 0);

const P = (d: string, cls = 'rq-e-line', extra: Record<string, unknown> = {}) => <path className={cls} d={d} {...extra} />;
const Dot = ({x = 0, y = 0, r = 2.6}: {x?: number; y?: number; r?: number}) => <circle className="rq-e-dot" cx={x} cy={y} r={r} />;

// ---- A: the object inside the strike rings ----
// Pictograms stay inside r ≈ 11.5 so the first ring (r 15) clears them.
const GLYPH: Record<SoundId, ReactNode> = {
  kalimba: <>{P('M-9 -1.5h18v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3Z')}{P('M-6 1.5V-7M-3 1.5V-10M0 1.5V-11M3 1.5V-9M6 1.5V-6.5')}<circle className="rq-e-line" cx="0" cy="5.5" r="1.5" /></>,
  marimba: <>{P('M-9 -9h3.4v18h-3.4ZM-4.2 -7.5h3.4v15h-3.4ZM0.6 -6h3.4v12h-3.4ZM5.4 -4.5h3.4v9h-3.4Z')}</>,
  vibrafoni: <>{P('M-10 -8h20v3.6h-20ZM-8 -1.8h16v3.6h-16Z')}{P('M-10 7.5q2.5 -3.4 5 0t5 0t5 0t5 0')}</>,
  // The Habitat mark (two interlocking arches, the sun beside them, not above: centred it reads as a person) on a wooden bar.
  'tunnus-puu': <>{P(arch(5.5, -4.5, 3))}{P(arch(5.5, 3, 3))}<circle className="rq-e-line" cx="6.5" cy="-7" r="2.3" />{P('M-10.5 6.5h21v3.4h-21Z')}</>,
  pisara: <>{P('M0 -11.5C4 -5.5 7.5 -1.5 7.5 3A7.5 7.5 0 0 1 -7.5 3C-7.5 -1.5 -4 -5.5 0 -11.5Z')}{P('M-3.5 3.5a3.6 3.6 0 0 0 2.6 3.4')}</>,
  lasit: <>{P('M-10 -7h7l-0.9 5.3a2.6 2.6 0 0 1 -5.2 0ZM-6.5 1v6.5M-9 7.5h5')}{P('M3 -7h7l-0.9 5.3a2.6 2.6 0 0 1 -5.2 0ZM6.5 1v6.5M4 7.5h5')}{P('M0 -11.5v3M-2.6 -10.6l1.2 1.8M2.6 -10.6l-1.2 1.8')}</>,
  tuulikello: <>{P('M-9.5 -10h19')}{P('M-7.4 -10v2M-3.1 -10v2M1.2 -10v2M5.5 -10v2')}{P('M-8.6 -8h2.4v8h-2.4ZM-4.3 -8h2.4v13h-2.4ZM0 -8h2.4v10.5h-2.4ZM4.3 -8h2.4v6h-2.4Z')}</>,
  kuplat: <><circle className="rq-e-line" cx="-3" cy="4.5" r="5" /><circle className="rq-e-line" cx="4.5" cy="-2.5" r="3.2" /><circle className="rq-e-line" cx="-1.5" cy="-7.5" r="2" /><circle className="rq-e-line" cx="5.5" cy="-9.5" r="1.2" />{P('M-5.5 3a2.6 2.6 0 0 1 2 -2.2')}</>,
  kulho: <>{P('M-10.5 -1h21a10.5 9 0 0 1 -21 0Z')}{P('M-4 8.6h8')}{P('M10.5 -11L5 -3.5')}<circle className="rq-e-dot" cx="10.8" cy="-11.4" r="1.9" /></>,
  jaapuikot: <>{P('M-10.5 -9.5h21')}{P('M-8.5 -9.5l2 11.5l2 -11.5M-3 -9.5l2.2 19l2.2 -19M2.6 -9.5l1.8 9.5l1.8 -9.5M7 -9.5l1.4 5.5l1.4 -5.5')}</>,
};
const LONG_RING: Partial<Record<SoundId, true>> = {kulho: true, vibrafoni: true, lasit: true};

function objectEmblem(id: SoundId, strikes: Strike[]): Emblem {
  const n = Math.min(4, strikes.length), step = n > 1 ? Math.min(4.5, 12 / (n - 1)) : 0;
  const rings = strikes.slice(0, n).map((s, i) => ({r: 16 + i * step, w: 0.9 + s.amp * 1.1}));
  return {
    still: <>
      {LONG_RING[id] ? <circle className="rq-e-halo" r={f(rings[rings.length - 1].r + 3.5)} /> : null}
      {rings.map((g, i) => <circle key={i} className="rq-e-ring" r={f(g.r)} style={{strokeWidth: f(g.w)}} />)}
      <g className="rq-e-glyph" transform="scale(1.18)">{GLYPH[id]}</g>
    </>,
    origins: [{x: 0, y: 0, d: circle(30)}],
  };
}

// ---- B: the shape of the ripple ----
function rippleEmblem(id: SoundId): Emblem {
  switch (id) {
    case 'kalimba': { // three tines, three small ring sets: B5, G5 (lower), D6 (higher)
      const c = [[-16, 2], [0, 9], [16, -7]];
      return {still: <>{c.map(([x, y], i) => <g key={i}>{P(circle(5.5, x, y), 'rq-e-ring')}{P(circle(9.5, x, y), 'rq-e-ring rq-e-soft')}<Dot x={x} y={y} r={2.2} /></g>)}</>,
        origins: c.map(([x, y]) => ({x, y, d: circle(16)}))};
    }
    case 'marimba': // wooden bars: nested stadium rings around a bar
      return {still: <>{P(stadium(46, 26), 'rq-e-ring rq-e-soft')}{P(stadium(34, 18), 'rq-e-ring')}{P(stadium(22, 10), 'rq-e-ring')}<rect className="rq-e-dot" x="-6.5" y="-2" width="13" height="4" rx="2" /></>,
        origins: [{x: 0, y: 0, d: stadium(60, 34)}]};
    case 'vibrafoni': // shimmering: solid rings with dashed rings between them
      return {still: <>{P(circle(9), 'rq-e-ring')}{P(circle(14), 'rq-e-ring rq-e-dash')}{P(circle(19), 'rq-e-ring')}{P(circle(24.5), 'rq-e-ring rq-e-dash')}<Dot r={3.2} /></>,
        origins: [{x: 0, y: 0, d: circle(30)}]};
    case 'tunnus-puu': // the Habitat mark built from rings: two arches and a sun
      return {still: <>{P(arch(7, -7, 9), 'rq-e-ring')}{P(arch(13, -7, 9), 'rq-e-ring rq-e-soft')}{P(arch(7, 7, 9), 'rq-e-ring')}{P(arch(13, 7, 9), 'rq-e-ring rq-e-soft')}{P(circle(5.5, 0, -14), 'rq-e-ring')}<Dot y={-14} r={2.4} /></>,
        origins: [{x: -7, y: 9, d: circle(14)}, {x: 7, y: 9, d: circle(14)}, {x: 0, y: -14, d: circle(10)}]};
    case 'pisara': // water surface in perspective under a falling drop
      return {still: <>{P(ellipse(8, 2.6, 0, 10), 'rq-e-ring')}{P(ellipse(16, 5.2, 0, 10), 'rq-e-ring')}{P(ellipse(25, 8.2, 0, 10), 'rq-e-ring rq-e-soft')}{P('M0 -12.5C1.6 -10 3 -8.3 3 -6.5a3 3 0 0 1 -6 0C-3 -8.3 -1.6 -10 0 -12.5Z', 'rq-e-dot')}</>,
        origins: [{x: 0, y: 10, d: ellipse(30, 10)}]};
    case 'lasit': // two glasses: two ring sets interfering
      return {still: <>{[-8, 8].map((x) => <g key={x}>{P(circle(6, x, 0), 'rq-e-ring')}{P(circle(12, x, 0), 'rq-e-ring')}{P(circle(18, x, 0), 'rq-e-ring rq-e-soft')}<Dot x={x} r={2} /></g>)}</>,
        origins: [{x: -8, y: 0, d: circle(22)}, {x: 8, y: 0, d: circle(22)}]};
    case 'tuulikello': { // five tubes swinging on an arc, each its own small ring
      const c = [-2, -1, 0, 1, 2].map((k) => [k * 9.5, -4 + 12 - Math.abs(k) * Math.abs(k) * 2.2]);
      return {still: <>{P('M-22 -12Q0 -2 22 -12', 'rq-e-ring rq-e-soft')}{c.map(([x, y], i) => <g key={i}>{P(circle(5.4, x, y), 'rq-e-ring')}<Dot x={x} y={y} r={1.9} /></g>)}</>,
        origins: c.map(([x, y]) => ({x, y, d: circle(11)}))};
    }
    case 'kuplat': { // bubbles: rings that are not concentric, rising and shrinking
      const c: [number, number, number][] = [[-9, 13, 7.5], [7, 5, 5.2], [-4, -6, 3.8], [8, -14, 2.6], [-10, -19, 1.7]];
      return {still: <>{c.map(([x, y, r], i) => P(circle(r, x, y), 'rq-e-ring', {key: i}))}{P('M-13.5 11a5 5 0 0 1 3 -3.6', 'rq-e-line')}</>,
        origins: c.map(([x, y, r]) => ({x, y, d: circle(r + 8)}))};
    }
    case 'kulho': // one broad ring with two near rings off-centre: the bowl's slow beating
      return {still: <>{P(circle(13.5, -1.2, 0), 'rq-e-ring')}{P(circle(17, 0, 0), 'rq-e-ring rq-e-thick')}{P(circle(20.5, 1.2, 0), 'rq-e-ring')}<Dot r={3.4} /></>,
        origins: [{x: 0, y: 0, d: circle(30)}]};
    case 'jaapuikot': // ice: hexagonal rings
      return {still: <>{P(hexagon(8), 'rq-e-ring')}{P(hexagon(15.5), 'rq-e-ring')}{P(hexagon(23), 'rq-e-ring rq-e-soft')}<Dot r={2.4} /></>,
        origins: [{x: 0, y: 0, d: hexagon(31)}]};
  }
}

// ---- C: the ring bent by the sound's partials ----
type Figure = {g: (th: number) => number; copies?: number; turn?: number; cross?: boolean};
const FIG: Record<SoundId, Figure> = {
  kalimba: {g: lobes([[6, 0.11, 0], [12, 0.025, 0]])},           // tine overtone ≈ 5.95 × the fundamental
  marimba: {g: lobes([[4, 0.12, Math.PI / 4]])},                  // bar overtone ≈ 3.99 ×
  vibrafoni: {g: lobes([[12, 0.035, 0]]), turn: Math.PI / 12},    // fine shimmer
  'tunnus-puu': {g: lobes([[3, 0.15, -Math.PI / 2]])},            // the motif's three notes
  pisara: {g: lobes([[1, 0.3, Math.PI / 2], [2, -0.08, 0]])},     // a drop's egg, heavier below
  lasit: {g: lobes([[2, 0.17, 0]])},                              // the wine glass's (2,0) rim mode
  tuulikello: {g: lobes([[5, 0.12, -Math.PI / 2]]), turn: Math.PI / 5},
  kuplat: {g: lobes([[2, 0.07, 0.7], [3, 0.08, 2.1], [5, 0.05, 4]]), turn: 1.1},
  kulho: {g: lobes([[2, 0.14, 0]]), copies: 2, cross: true},      // the bowl's degenerate pair, beating
  jaapuikot: {g: (th) => 0.78 + 0.3 * Math.pow(Math.abs(Math.cos(4 * th)), 7)}, // a sharp eight-point star
};
function patternEmblem(id: SoundId, strikes: Strike[]): Emblem {
  const fig = FIG[id];
  const n = fig.copies ?? Math.max(2, Math.min(4, strikes.length));
  const shapes = Array.from({length: n}, (_, i) => {
    if (fig.cross) return polar(21, fig.g, i * Math.PI / 2);
    const R = n > 1 ? 11 + i * (16 / (n - 1)) : 24;
    return polar(R, fig.g, i * (fig.turn ?? 0));
  });
  return {
    still: <>{fig.cross ? P(circle(9), 'rq-e-ring rq-e-soft') : null}{shapes.map((d, i) => P(d, i === shapes.length - 1 || fig.cross ? 'rq-e-ring' : 'rq-e-ring rq-e-soft', {key: i}))}<Dot r={3} /></>,
    origins: [{x: 0, y: 0, d: polar(30, fig.g)}],
  };
}

export function emblem(dir: Dir, id: SoundId, identity: Strike[]): Emblem {
  return dir === 'object' ? objectEmblem(id, identity) : dir === 'ripple' ? rippleEmblem(id) : patternEmblem(id, identity);
}

/** The emblem's SVG. `play` is the strikes of the length being played, with a
 * key that restarts the ripples on every press; null at rest or with reduced motion. */
export function EmblemSvg({dir, id, identity, play, small}: {dir: Dir; id: SoundId; identity: Strike[]; play: {key: number; strikes: Strike[]} | null; small?: boolean}) {
  const e = emblem(dir, id, identity);
  return (
    <svg className={`rq-emblem rq-emblem-${dir}${small ? ' rq-emblem-small' : ''}`} viewBox="-32 -32 64 64" aria-hidden="true"
      data-emblem={`${dir}-${id}`} data-active={play ? 'true' : undefined}>
      <g className="rq-e-still">{e.still}</g>
      {play ? (
        <g key={play.key}>
          {play.strikes.map((s, i) => {
            const o = e.origins[i % e.origins.length];
            return (
              <g key={i} transform={`translate(${o.x} ${o.y})`}>
                <path className={`rq-ripple${dir === 'pattern' ? ' rq-ripple-waver' : ''}`} d={o.d}
                  style={{animationDelay: `${s.at.toFixed(3)}s`, animationDuration: `${Math.min(1.4, Math.max(0.5, s.ring)).toFixed(2)}s`, ['--amp' as string]: String(0.45 + Math.min(1, s.amp) * 0.55)}} />
              </g>
            );
          })}
        </g>
      ) : null}
    </svg>
  );
}
