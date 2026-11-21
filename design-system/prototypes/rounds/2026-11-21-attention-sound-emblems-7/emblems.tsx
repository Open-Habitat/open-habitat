import React, {type ReactNode} from 'react';
import type {Lang, SoundId} from './text';

// Round 7: B Väreilyn muoto (Jari 21.11. on round 6) riffed into three
// variants per sound. Every emblem stays in round 3's B Renkaat family: no
// picture, the rings' own geometry says the object, drawn in a 64-unit box
// around the centre, readable at rest at tile (76 px) and workspace-row
// (32 px) size, and while the sound plays each strike spreads outward from
// its own origin in that origin's shape. Variant 0 is round 6's B, unchanged.
// Each sound's trio follows one stated idea (`TRIO`); Kalimba and Kulho,
// which Jari said need the most, get the boldest departures.

export type Strike = {at: number; amp: number; ring: number};
/** Where a strike's ripple starts and the shape it spreads in (`rot` in degrees). */
type Origin = {x: number; y: number; d: string; rot?: number};
export type Emblem = {still: ReactNode; origins: Origin[]};
type Words = Record<Lang, string>;
export type Variant = {name: Words; idea: Words; draw: () => Emblem};

const f = (v: number) => +v.toFixed(2);
const circle = (r: number, x = 0, y = 0) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const ellipse = (rx: number, ry: number, x = 0, y = 0) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
/** A horizontal stadium (a bar's outline) w × h centred on (x, y). */
const stadium = (w: number, h: number, x = 0, y = 0) => { const r = h / 2, s = w / 2 - r; return `M${f(x - s)} ${f(y - r)}H${f(x + s)}a${f(r)} ${f(r)} 0 0 1 0 ${f(h)}H${f(x - s)}a${f(r)} ${f(r)} 0 0 1 0 ${f(-h)}Z`; };
/** A vertical stadium (a tine or tube) w × h centred on (x, y). */
const vstadium = (w: number, h: number, x = 0, y = 0) => { const r = w / 2, s = h / 2 - r; return `M${f(x - r)} ${f(y + s)}V${f(y - s)}a${f(r)} ${f(r)} 0 0 1 ${f(w)} 0V${f(y + s)}a${f(r)} ${f(r)} 0 0 1 ${f(-w)} 0Z`; };
const roundRect = (w: number, h: number, r: number) => `M${f(-w / 2 + r)} ${f(-h / 2)}H${f(w / 2 - r)}q${r} 0 ${r} ${r}V${f(h / 2 - r)}q0 ${r} ${-r} ${r}H${f(-w / 2 + r)}q${-r} 0 ${-r} ${-r}V${f(-h / 2 + r)}q0 ${-r} ${r} ${-r}Z`;
const hexagon = (r: number, x = 0, y = 0, rot = 0) => Array.from({length: 6}, (_, k) => { const a = -Math.PI / 2 + rot + k * Math.PI / 3; return `${k ? 'L' : 'M'}${f(x + r * Math.cos(a))} ${f(y + r * Math.sin(a))}`; }).join('') + 'Z';
const arch = (r: number, x: number, y: number) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 0 1 ${f(2 * r)} 0`;
/** An arc of radius r from a0 to a1 degrees (0 = right, clockwise). */
const arc = (r: number, a0: number, a1: number, x = 0, y = 0) => {
  const p = (a: number) => `${f(x + r * Math.cos(a * Math.PI / 180))} ${f(y + r * Math.sin(a * Math.PI / 180))}`;
  return `M${p(a0)}A${f(r)} ${f(r)} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}`;
};
/** A closed curve r(θ) = R·g(θ). */
const polar = (R: number, g: (th: number) => number, steps = 120) =>
  Array.from({length: steps}, (_, k) => { const th = k / steps * 2 * Math.PI, r = R * g(th); return `${k ? 'L' : 'M'}${f(r * Math.cos(th))} ${f(r * Math.sin(th))}`; }).join('') + 'Z';
/** An icicle: flat top w wide at y, tapering to a point h below. */
const icicle = (w: number, h: number, x: number, y: number) => `M${f(x - w / 2)} ${f(y)}H${f(x + w / 2)}L${f(x + w * 0.22)} ${f(y + h * 0.62)}L${f(x)} ${f(y + h)}L${f(x - w * 0.22)} ${f(y + h * 0.62)}Z`;

const P = (d: string, cls = 'rq-e-ring', extra: Record<string, unknown> = {}) => <path className={cls} d={d} {...extra} />;
const Dot = ({x = 0, y = 0, r = 2.6}: {x?: number; y?: number; r?: number}) => <circle className="rq-e-dot" cx={x} cy={y} r={r} />;
const G = ({x = 0, y = 0, rot = 0, children}: {x?: number; y?: number; rot?: number; children: ReactNode}) => <g transform={`translate(${x} ${y}) rotate(${rot})`}>{children}</g>;
const w = (fi: string, en: string): Words => ({fi, en});

// ---- Variant 0 of each sound: round 6's B, unchanged ----
const CURRENT: Record<SoundId, () => Emblem> = {
  kalimba: () => { // three tines, three small ring sets: B5, G5 (lower), D6 (higher)
    const c = [[-16, 2], [0, 9], [16, -7]];
    return {still: <>{c.map(([x, y], i) => <g key={i}>{P(circle(5.5, x, y))}{P(circle(9.5, x, y), 'rq-e-ring rq-e-soft')}<Dot x={x} y={y} r={2.2} /></g>)}</>,
      origins: c.map(([x, y]) => ({x, y, d: circle(16)}))};
  },
  marimba: () => ({still: <>{P(stadium(46, 26), 'rq-e-ring rq-e-soft')}{P(stadium(34, 18))}{P(stadium(22, 10))}<rect className="rq-e-dot" x="-6.5" y="-2" width="13" height="4" rx="2" /></>,
    origins: [{x: 0, y: 0, d: stadium(60, 34)}]}),
  vibrafoni: () => ({still: <>{P(circle(9))}{P(circle(14), 'rq-e-ring rq-e-dash')}{P(circle(19))}{P(circle(24.5), 'rq-e-ring rq-e-dash')}<Dot r={3.2} /></>,
    origins: [{x: 0, y: 0, d: circle(30)}]}),
  'tunnus-puu': () => ({still: <>{P(arch(7, -7, 9))}{P(arch(13, -7, 9), 'rq-e-ring rq-e-soft')}{P(arch(7, 7, 9))}{P(arch(13, 7, 9), 'rq-e-ring rq-e-soft')}{P(circle(5.5, 0, -14))}<Dot y={-14} r={2.4} /></>,
    origins: [{x: -7, y: 9, d: circle(14)}, {x: 7, y: 9, d: circle(14)}, {x: 0, y: -14, d: circle(10)}]}),
  pisara: () => ({still: <>{P(ellipse(8, 2.6, 0, 10))}{P(ellipse(16, 5.2, 0, 10))}{P(ellipse(25, 8.2, 0, 10), 'rq-e-ring rq-e-soft')}{P('M0 -12.5C1.6 -10 3 -8.3 3 -6.5a3 3 0 0 1 -6 0C-3 -8.3 -1.6 -10 0 -12.5Z', 'rq-e-dot')}</>,
    origins: [{x: 0, y: 10, d: ellipse(30, 10)}]}),
  lasit: () => ({still: <>{[-8, 8].map((x) => <g key={x}>{P(circle(6, x, 0))}{P(circle(12, x, 0))}{P(circle(18, x, 0), 'rq-e-ring rq-e-soft')}<Dot x={x} r={2} /></g>)}</>,
    origins: [{x: -8, y: 0, d: circle(22)}, {x: 8, y: 0, d: circle(22)}]}),
  tuulikello: () => {
    const c = [-2, -1, 0, 1, 2].map((k) => [k * 9.5, 8 - k * k * 2.2]);
    return {still: <>{P('M-22 -12Q0 -2 22 -12', 'rq-e-ring rq-e-soft')}{c.map(([x, y], i) => <g key={i}>{P(circle(5.4, x, y))}<Dot x={x} y={y} r={1.9} /></g>)}</>,
      origins: c.map(([x, y]) => ({x, y, d: circle(11)}))};
  },
  kuplat: () => {
    const c: [number, number, number][] = [[-9, 13, 7.5], [7, 5, 5.2], [-4, -6, 3.8], [8, -14, 2.6], [-10, -19, 1.7]];
    return {still: <>{c.map(([x, y, r], i) => P(circle(r, x, y), 'rq-e-ring', {key: i}))}{P('M-13.5 11a5 5 0 0 1 3 -3.6', 'rq-e-line')}</>,
      origins: c.map(([x, y, r]) => ({x, y, d: circle(r + 8)}))};
  },
  kulho: () => ({still: <>{P(circle(13.5, -1.2, 0))}{P(circle(17), 'rq-e-ring rq-e-thick')}{P(circle(20.5, 1.2, 0))}<Dot r={3.4} /></>,
    origins: [{x: 0, y: 0, d: circle(30)}]}),
  jaapuikot: () => ({still: <>{P(hexagon(8))}{P(hexagon(15.5))}{P(hexagon(23), 'rq-e-ring rq-e-soft')}<Dot r={2.4} /></>,
    origins: [{x: 0, y: 0, d: hexagon(31)}]}),
};

// ---- The three new variants of each sound ----
const NEW: Record<SoundId, Variant[]> = {
  kalimba: [
    {name: w('Kolme kieltä', 'Three tines'), idea: w('Kielet itse: kolme metallikieltä soivien sävelten pituisina, kukin oman renkaansa sisällä.', 'The tines themselves: three metal tines as long as their notes, each inside its own ring.'),
      draw: () => {
        // B5, G5 (longest, lowest), D6 (shortest) standing on the bridge.
        const t: [number, number][] = [[-12, 28], [0, 36], [12, 22]];
        const base = 18, mid = (h: number) => base - h / 2;
        return {still: <>{P('M-23 20.5H23', 'rq-e-line rq-e-soft')}{t.map(([x, h], i) => <g key={i}>{P(vstadium(6, h, x, mid(h)))}{P(vstadium(11, h + 5, x, mid(h) + 0.5), 'rq-e-ring rq-e-soft')}<Dot x={x} y={base - h + 4} r={1.7} /></g>)}</>,
          origins: t.map(([x, h]) => ({x, y: mid(h), d: vstadium(18, h + 14)}))};
      }},
    {name: w('Koko soitin', 'The whole instrument'), idea: w('Rohkein: viisi kieltä V-muodossa kopan päällä, ja soivat kolme keskimmäistä ovat vahvoja.', 'Boldest: five tines in a V on the box, the three that sound drawn strong.'),
      draw: () => {
        const x = [-16, -8, 0, 8, 16], len = [20, 27, 34, 27, 20], top = (k: number) => 12 - len[k];
        return {still: <>{P(roundRect(46, 14, 5), 'rq-e-ring rq-e-soft', {transform: 'translate(0 19)'})}
          {x.map((cx, k) => P(vstadium(5, len[k], cx, top(k) + len[k] / 2), k === 0 || k === 4 ? 'rq-e-ring rq-e-soft' : 'rq-e-ring rq-e-strong', {key: k}))}
          <Dot y={19} r={2.4} /></>,
          // Strikes B5, G5, D6 sound on the left, middle and right inner tines.
          origins: [1, 2, 3].map((k) => ({x: x[k], y: top(k) + len[k] / 2, d: vstadium(16, len[k] + 12)}))};
      }},
    {name: w('Näppäys', 'The pluck'), idea: w('Liike: yksi kieli heilahtaa tyvestään, ja sen renkaat kallistuvat vuorotellen kuin heilahdus.', 'Motion: one tine swings from its root, and its rings lean in turn like the swing.'),
      draw: () => {
        const root = 20;
        return {still: <>{[-14, 0, 14].map((a, i) => <G key={i} y={root} rot={a}>{P(vstadium(7 + Math.abs(a) * 0.6, 38 - Math.abs(a) * 0.5, 0, -19 + Math.abs(a) * 0.25), a === 0 ? 'rq-e-ring rq-e-strong' : 'rq-e-ring rq-e-soft')}</G>)}
          {P('M-14 23H14', 'rq-e-line')}<Dot y={-14} r={2.4} /></>,
          origins: [-14, 0, 14].map((a) => ({x: Math.sin(a * Math.PI / 180) * 19, y: root - Math.cos(a * Math.PI / 180) * 19, d: vstadium(16, 46), rot: a}))};
      }},
  ],
  marimba: [
    {name: w('Laatat', 'The bars'), idea: w('Kirjaimellisempi: kolme puulaattaa pituusjärjestyksessä, matalin pisin, kukin omana renkaanaan.', 'More literal: three wooden bars graded by length, the lowest longest, each its own ring.'),
      draw: () => {
        const b: [number, number][] = [[46, 13], [36, 0], [26, -13]]; // E5, G5, C6
        return {still: <>{b.map(([wd, y], i) => <g key={i}>{P(stadium(wd, 8, 0, y))}<Dot x={-wd / 2 + 6} y={y} r={1.6} /></g>)}</>,
          origins: b.map(([wd, y]) => ({x: 0, y, d: stadium(wd + 14, 20)}))};
      }},
    {name: w('Puun syy', 'Wood grain'), idea: w('Abstraktimpi: kulmikkaammat renkaat kuin puun vuosilustot; puu on suoraa, ei pyöreää.', 'More abstract: squarer rings like a log\'s growth rings; wood is straight, not round.'),
      draw: () => ({still: <>{P(roundRect(48, 32, 4), 'rq-e-ring rq-e-soft')}{P(roundRect(36, 22, 3))}{P(roundRect(24, 12, 2))}<rect className="rq-e-dot" x="-6" y="-1.8" width="12" height="3.6" rx="0.8" /></>,
        origins: [{x: 0, y: 0, d: roundRect(58, 38, 5)}]})},
    {name: w('Lyönnit kulkevat', 'Strokes travel'), idea: w('Liike: kolme lyöntiä nousevat oikealle, ja kunkin rengas syntyy edellisen vierestä.', 'Motion: the three strokes rise to the right, each ring born beside the one before.'),
      draw: () => {
        const s: [number, number, number, number][] = [[-12, 8, 18, 9], [0, 0, 28, 14], [12, -8, 38, 19]];
        return {still: <>{s.map(([x, y, wd, h], i) => P(stadium(wd, h, x, y), i === 2 ? 'rq-e-ring rq-e-soft' : 'rq-e-ring', {key: i}))}{s.map(([x, y], i) => <Dot key={i} x={x} y={y} r={1.8} />)}</>,
          origins: s.map(([x, y]) => ({x, y, d: stadium(40, 20)}))};
      }},
  ],
  vibrafoni: [
    {name: w('Kaksi laattaa', 'Two bars'), idea: w('Kirjaimellisempi: kaksi metallilaattaa yhtä aikaa, ja väreilevä katkoviiva kiertää molempia.', 'More literal: two metal bars at once, a shimmering dashed ring around both.'),
      draw: () => ({still: <>{P(stadium(30, 8, -3, -6))}{P(stadium(26, 8, 3, 6))}{P(stadium(44, 30), 'rq-e-ring rq-e-dash')}{P(stadium(54, 40), 'rq-e-ring rq-e-soft')}</>,
        origins: [{x: -3, y: -6, d: stadium(48, 24)}, {x: 3, y: 6, d: stadium(44, 24)}]})},
    {name: w('Värinä', 'Vibrato'), idea: w('Abstraktimpi: keskimmäinen rengas aaltoilee kuin vibraton sävelkorkeus.', 'More abstract: the middle ring undulates like the vibrato\'s pitch.'),
      draw: () => ({still: <>{P(circle(9))}{P(polar(17, (th) => 1 + 0.04 * Math.sin(9 * th)), 'rq-e-ring rq-e-strong')}{P(circle(25), 'rq-e-ring rq-e-soft')}<Dot r={3} /></>,
        origins: [{x: 0, y: 0, d: polar(30, (th) => 1 + 0.04 * Math.sin(9 * th))}]})},
    {name: w('Tuuletin', 'The fan'), idea: w('Liike: vibrafonin pyörivät levyt katkovat renkaat, ja aukot kiertävät renkaasta toiseen.', 'Motion: the vibraphone\'s spinning discs break the rings, and the gaps turn from ring to ring.'),
      draw: () => ({still: <>{[9, 15.5, 22].map((r, i) => <g key={i}>{P(arc(r, i * 40 + 20, i * 40 + 160), i === 2 ? 'rq-e-ring rq-e-soft' : 'rq-e-ring')}{P(arc(r, i * 40 + 200, i * 40 + 340), i === 2 ? 'rq-e-ring rq-e-soft' : 'rq-e-ring')}</g>)}<Dot r={3} /></>,
        origins: [{x: 0, y: 0, d: circle(30)}]})},
  ],
  'tunnus-puu': [
    {name: w('Merkki', 'The mark'), idea: w('Kirjaimellisempi: Habitatin merkki tiiviinä, kaaret lomittain ja aurinko vieressä, yksi rengas ympärillä.', 'More literal: the Habitat mark tight, arches interlocking and the sun beside, one ring around.'),
      draw: () => ({still: <>{P(arch(9, -5, 10), 'rq-e-ring rq-e-strong')}{P(arch(9, 5, 10), 'rq-e-ring rq-e-strong')}{P('M-17 10H17', 'rq-e-line rq-e-soft')}<Dot x={13} y={-9} r={3.4} />{P(circle(26), 'rq-e-ring rq-e-soft')}</>,
        origins: [{x: -5, y: 6, d: circle(22)}, {x: 5, y: 6, d: circle(22)}, {x: 13, y: -9, d: circle(14)}]})},
    {name: w('Kolme säveltä', 'Three notes'), idea: w('Abstraktimpi: merkin kaaret syntyvät aiheen kolmesta sävelestä, kukin kaari sävelen voimakkuinen.', 'More abstract: the mark\'s arches are born from the motif\'s three notes, each as strong as its note.'),
      draw: () => {
        const n: [number, number][] = [[-12, 9], [0, 13], [13, 6]]; // D5, A5 (strongest), F#6 (soft)
        return {still: <>{P('M-26 14H26', 'rq-e-line')}{n.map(([x, r], i) => <g key={i}>{P(arch(r, x, 14))}{P(arch(r + 5, x, 14), 'rq-e-ring rq-e-soft')}</g>)}</>,
          origins: n.map(([x, r]) => ({x, y: 14, d: arch(r + 12, 0, 0)}))};
      }},
    {name: w('Aurinko soi', 'The sun rings'), idea: w('Liike: merkin aurinko on äänen lähde, ja sen renkaat leviävät kaarten ylle.', 'Motion: the mark\'s sun is the source, its rings spreading over the arches.'),
      draw: () => ({still: <>{P(arch(8, -9, 18))}{P(arch(8, -1, 18))}<Dot x={10} y={-8} r={3} />{P(circle(7.5, 10, -8))}{P(circle(13, 10, -8), 'rq-e-ring rq-e-soft')}</>,
        origins: [{x: 10, y: -8, d: circle(22)}]})},
  ],
  pisara: [
    {name: w('Kolme pisaraa', 'Three drops'), idea: w('Kirjaimellisempi: äänen kolme pisaraa, kolme soikeaa rengassarjaa eri kohdissa pintaa.', 'More literal: the sound\'s three drops, three oval ring sets on different spots of the surface.'),
      draw: () => {
        const d: [number, number, number][] = [[-10, 8, 1], [11, 14, 0.75], [6, -6, 0.55]];
        return {still: <>{d.map(([x, y, s], i) => <g key={i}>{P(ellipse(5 * s, 1.7 * s, x, y))}{P(ellipse(11 * s, 3.6 * s, x, y), 'rq-e-ring rq-e-soft')}</g>)}</>,
          origins: d.map(([x, y, s]) => ({x, y, d: ellipse(18 * s + 4, 6 * s + 1.5)}))};
      }},
    {name: w('Kruunu', 'The crown'), idea: w('Kirjaimellisin: renkaiden keskeltä nousee roiske ja kaksi pientä pisaraa.', 'Most literal: a splash and two small drops rise from the middle of the rings.'),
      draw: () => ({still: <>{P(ellipse(10, 3.3, 0, 13))}{P(ellipse(20, 6.5, 0, 13), 'rq-e-ring rq-e-soft')}{P('M-7 12Q-6 4 -4 5Q-2 -4 0 1Q2 -4 4 5Q6 4 7 12', 'rq-e-line')}<Dot x={-5} y={-8} r={1.6} /><Dot x={4} y={-13} r={1.9} /></>,
        origins: [{x: 0, y: 13, d: ellipse(30, 10)}]})},
    {name: w('Pinta sivulta', 'Surface from the side'), idea: w('Abstraktimpi: veden pinta sivulta, aalto vaimenee pisaran kohdalta reunoille.', 'More abstract: the water surface from the side, a wave fading out from where the drop fell.'),
      draw: () => {
        const wave = Array.from({length: 53}, (_, k) => { const x = -26 + k; return `${k ? 'L' : 'M'}${x} ${f(8 + 6 * Math.exp(-Math.abs(x) / 9) * Math.cos(x / 2.6))}`; }).join('');
        return {still: <>{P(wave, 'rq-e-ring rq-e-strong')}{P('M-24 18H24', 'rq-e-line rq-e-soft')}{P('M0 -20C1.8 -17 3.4 -15 3.4 -13a3.4 3.4 0 0 1 -6.8 0C-3.4 -15 -1.8 -17 0 -20Z', 'rq-e-dot')}</>,
          origins: [{x: 0, y: 8, d: ellipse(30, 9)}]};
      }},
  ],
  lasit: [
    {name: w('Kilahdus', 'The clink'), idea: w('Kirjaimellisempi: kahden lasin renkaat koskettavat yhdessä pisteessä, josta kilahdus lähtee.', 'More literal: the two glasses\' rings touch at one point, where the clink starts.'),
      draw: () => ({still: <>{P(circle(10, -10, 3))}{P(circle(10, 10, 3))}{P(circle(15, -10, 3), 'rq-e-ring rq-e-soft')}{P(circle(15, 10, 3), 'rq-e-ring rq-e-soft')}{P('M0 -9.5v-5M-4 -8.5l-2.5 -3.5M4 -8.5l2.5 -3.5', 'rq-e-line')}<Dot y={3} r={2.2} /></>,
        origins: [{x: -10, y: 3, d: circle(20)}, {x: 10, y: 3, d: circle(20)}]})},
    {name: w('Lasin reuna', 'The rim'), idea: w('Abstraktimpi: kaksi lasin suuta vinosta kallistuneina toisiaan kohti, renkaat soikeina.', 'More abstract: two glass mouths seen at an angle, leaning toward each other, the rings oval.'),
      draw: () => ({still: <>{[[-10, 25], [10, -25]].map(([x, a]) => <G key={x} x={x} rot={a}>{P(ellipse(10, 4.5))}{P(ellipse(16, 7.5), 'rq-e-ring rq-e-soft')}</G>)}<Dot r={2} /></>,
        origins: [{x: -10, y: 0, d: ellipse(22, 10), rot: 25}, {x: 10, y: 0, d: ellipse(22, 10), rot: -25}]})},
    {name: w('Sointi jää', 'It rings on'), idea: w('Liike: toinen lasi soi korkeammalta ja pienempänä, ja pitkä sointi jää katkoviivaksi ympärille.', 'Motion: the second glass rings higher and smaller, and the long ring stays around as a dashed line.'),
      draw: () => ({still: <>{P(circle(6, -8, 5))}{P(circle(12, -8, 5))}{P(circle(4.5, 10, -7))}{P(circle(9, 10, -7))}{P(circle(26), 'rq-e-ring rq-e-dash')}<Dot x={-8} y={5} r={2} /><Dot x={10} y={-7} r={1.6} /></>,
        origins: [{x: -8, y: 5, d: circle(20)}, {x: 10, y: -7, d: circle(15)}]})},
  ],
  tuulikello: [
    {name: w('Putket', 'The tubes'), idea: w('Kirjaimellisempi: viisi putkea roikkuu orresta sävelensä pituisina.', 'More literal: five tubes hang from the bar, each as long as its note.'),
      draw: () => {
        // C6, E6, A5, D6, G5 as they strike, longer for lower notes.
        const t: [number, number][] = [[-16, 26], [-8, 19], [0, 31], [8, 23], [16, 35]];
        return {still: <>{P('M-22 -20H22', 'rq-e-line')}{t.map(([x, h], i) => P(vstadium(5, h, x, -18 + h / 2), 'rq-e-ring', {key: i}))}</>,
          origins: t.map(([x, h]) => ({x, y: -18 + h / 2, d: vstadium(14, h + 10)}))};
      }},
    {name: w('Tuulessa', 'In the wind'), idea: w('Liike: putket heilahtavat eri kulmiin, ja renkaat ovat vinoja soikioita.', 'Motion: the tubes swing to different angles, and the rings are tilted ovals.'),
      draw: () => {
        const a = [-32, -16, 0, 16, 32];
        return {still: <>{P('M-24 -14Q0 -22 24 -14', 'rq-e-ring rq-e-soft')}{a.map((d, k) => <G key={k} x={(k - 2) * 10} y={2 + Math.abs(k - 2) * -2} rot={d}>{P(ellipse(3.6, 8.5))}</G>)}{a.map((_, k) => <Dot key={k} x={(k - 2) * 10} y={2 + Math.abs(k - 2) * -2} r={1.5} />)}</>,
          origins: [2, 3, 1, 4, 0].map((k) => ({x: (k - 2) * 10, y: 2 + Math.abs(k - 2) * -2, d: ellipse(7, 15), rot: a[k]}))};
      }},
    {name: w('Kehä', 'The ring'), idea: w('Abstraktimpi: tuulikello alta katsottuna, viisi putkea kehällä ja läppä keskellä.', 'More abstract: the chime seen from below, five tubes on a circle and the clapper in the middle.'),
      draw: () => {
        const c = Array.from({length: 5}, (_, k) => { const a = -Math.PI / 2 + k * 2 * Math.PI / 5; return [f(16 * Math.cos(a)), f(16 * Math.sin(a))]; });
        return {still: <>{P(circle(25), 'rq-e-ring rq-e-soft')}{c.map(([x, y], i) => <g key={i}>{P(circle(5, x, y))}</g>)}<Dot r={3.2} /></>,
          origins: [0, 2, 4, 1, 3].map((k) => ({x: c[k][0], y: c[k][1], d: circle(11)}))};
      }},
  ],
  kuplat: [
    {name: w('Pintaan', 'To the surface'), idea: w('Kirjaimellisempi: kuplat nousevat pintaviivaan, ja pinnalle syntyy soikea rengas.', 'More literal: bubbles rise to a surface line, and an oval ring forms on it.'),
      draw: () => {
        const c: [number, number, number][] = [[-7, 17, 6], [4, 7, 4.2], [-3, -2, 3], [4, -9, 2]];
        return {still: <>{P('M-26 -16H26', 'rq-e-line rq-e-soft')}{P(ellipse(7, 2, 3, -16))}{P(ellipse(13, 3.6, 3, -16), 'rq-e-ring rq-e-soft')}{c.map(([x, y, r], i) => P(circle(r, x, y), 'rq-e-ring', {key: i}))}</>,
          origins: [...c.map(([x, y, r]) => ({x, y, d: circle(r + 7)})), {x: 3, y: -16, d: ellipse(22, 6)}]};
      }},
    {name: w('Vaahto', 'Foam'), idea: w('Abstraktimpi: kuplat rypäänä, eri kokoiset renkaat lähes toisiaan koskettaen.', 'More abstract: the bubbles as a cluster, rings of different sizes almost touching.'),
      draw: () => {
        const c: [number, number, number][] = [[-1, 1, 8.5], [13, -6, 5.2], [-13, -7, 5.8], [-6, 15, 5], [10, 11, 4.4], [2, -15, 4], [-17, 7, 3]];
        return {still: <>{c.map(([x, y, r], i) => P(circle(r, x, y), i === 0 ? 'rq-e-ring rq-e-strong' : 'rq-e-ring', {key: i}))}</>,
          origins: c.map(([x, y, r]) => ({x, y, d: circle(r + 7)}))};
      }},
    {name: w('Huojuva nousu', 'Wobbling rise'), idea: w('Liike: kuplat nousevat mutkitellen ja litistyvät vuorotellen kuin oikea kupla vedessä.', 'Motion: the bubbles rise in a wiggle, squashing in turn like a real bubble in water.'),
      draw: () => {
        const c: [number, number, number, number][] = [[-5, 17, 7.5, 5.6], [6, 6, 4.2, 5.2], [-4, -4, 3.8, 3], [5, -12, 2.4, 2.9], [-1, -19, 1.7, 1.4]];
        return {still: <>{c.map(([x, y, rx, ry], i) => P(ellipse(rx, ry, x, y), 'rq-e-ring rq-e-strong', {key: i}))}</>,
          origins: c.map(([x, y, rx, ry]) => ({x, y, d: ellipse(rx + 8, ry + 8)}))};
      }},
  ],
  kulho: [
    {name: w('Kulhon suu', 'The bowl\'s mouth'), idea: w('Kirjaimellisempi: kulho vinosta, leveä reuna soikiona ja ääni väreilee sen sisällä.', 'More literal: the bowl from an angle, its wide rim an oval and the sound shimmering inside it.'),
      draw: () => ({still: <>{P('M-24 -5A24 21 0 0 0 24 -5', 'rq-e-line rq-e-soft')}{P(ellipse(24, 7.5, 0, -5), 'rq-e-ring rq-e-thick')}{P(ellipse(15, 4.4, 0, -5))}{P(ellipse(6.5, 1.9, 0, -5))}</>,
        origins: [{x: 0, y: -5, d: ellipse(30, 9.5)}]})},
    {name: w('Huojunta', 'The beating'), idea: w('Rohkein abstrakti: yksi paksu rengas, joka ohenee ja paksunee kehällä kuin kulhon hidas huojunta.', 'Boldest abstract: one heavy ring that thins and thickens around, like the bowl\'s slow beating.'),
      draw: () => {
        const outer = polar(21, (th) => 1 + 0.11 * Math.cos(2 * th) + 0.02);
        return {still: <>{P(`${outer}${circle(15.5)}`, 'rq-e-fill', {fillRule: 'evenodd'})}{P(circle(27), 'rq-e-ring rq-e-soft rq-e-dash')}<Dot r={3.2} /></>,
          origins: [{x: 0, y: 0, d: polar(30, (th) => 1 + 0.1 * Math.cos(2 * th))}]};
      }},
    {name: w('Kiertävä nuija', 'The circling mallet'), idea: w('Liike: nuija kiertää kulhon reunaa, ja pitkä sointi kiertyy ulos spiraaliksi.', 'Motion: the mallet circles the rim, and the long ring winds out as a spiral.'),
      draw: () => {
        const turns = 2.6, steps = 160, r0 = 4, r1 = 24;
        const pts = Array.from({length: steps + 1}, (_, k) => { const t = k / steps, a = t * turns * 2 * Math.PI - Math.PI / 2, r = r0 + (r1 - r0) * t; return [r * Math.cos(a), r * Math.sin(a)]; });
        const d = pts.map(([x, y], k) => `${k ? 'L' : 'M'}${f(x)} ${f(y)}`).join('');
        const [ex, ey] = pts[steps];
        return {still: <>{P(d, 'rq-e-ring rq-e-strong')}<Dot x={f(ex)} y={f(ey)} r={3} /></>,
          origins: [{x: 0, y: 0, d: circle(30)}]};
      }},
  ],
  jaapuikot: [
    {name: w('Puikot', 'The icicles'), idea: w('Kirjaimellisempi: kolme jääpuikkoa räystäästä, renkaat puikon muotoisia.', 'More literal: three icicles from the eave, the rings shaped like icicles.'),
      draw: () => {
        const t: [number, number][] = [[-15, 22], [0, 30], [15, 38]]; // E6, C6, A5
        return {still: <>{P('M-24 -20H24', 'rq-e-line')}{t.map(([x, h], i) => <g key={i}>{P(icicle(7, h, x, -19))}{P(icicle(12.5, h + 5, x, -19), 'rq-e-ring rq-e-soft')}</g>)}</>,
          origins: t.map(([x, h]) => ({x, y: -19 + h / 2, d: icicle(18, h + 12, 0, -(h + 12) / 2)}))};
      }},
    {name: w('Kide', 'The crystal'), idea: w('Abstraktimpi: kuusikulmiot vuorotellen 30° kierrettyinä, kuin lumikiteen kerrokset.', 'More abstract: hexagons turned by 30° in turn, like the layers of a snow crystal.'),
      draw: () => ({still: <>{P(hexagon(8))}{P(hexagon(14.5, 0, 0, Math.PI / 6), 'rq-e-ring rq-e-strong')}{P(hexagon(21))}{P(hexagon(27, 0, 0, Math.PI / 6), 'rq-e-ring rq-e-soft')}<Dot r={2.2} /></>,
        origins: [{x: 0, y: 0, d: hexagon(31)}, {x: 0, y: 0, d: hexagon(31, 0, 0, Math.PI / 6)}]})},
    {name: w('Helähdys', 'The descending tap'), idea: w('Liike: kolme napautusta laskevat, kukin pieni kuusikulmio edellistä alempana.', 'Motion: the three taps descend, each small hexagon lower than the last.'),
      draw: () => {
        const c: [number, number][] = [[-14, -11], [0, 0], [14, 11]];
        return {still: <>{c.map(([x, y], i) => <g key={i}>{P(hexagon(5, x, y))}{P(hexagon(9.5, x, y), 'rq-e-ring rq-e-soft')}<Dot x={x} y={y} r={1.8} /></g>)}</>,
          origins: c.map(([x, y]) => ({x, y, d: hexagon(15)}))};
      }},
  ],
};

/** Each sound's trio idea: what the three variants try, in one line. */
export const TRIO: Record<SoundId, Words> = {
  kalimba: w('Kolme rohkeaa luentaa soittimesta: kielet, koko soitin, kielen liike.', 'Three bold readings of the instrument: the tines, the whole thing, the tine\'s motion.'),
  marimba: w('Kirjaimellisempi, abstraktimpi ja enemmän liikettä.', 'More literal, more abstract, more motion.'),
  vibrafoni: w('Laatat, värinä ja pyörivä tuuletin: kolme syytä vibrafonin väreilyyn.', 'The bars, the vibrato and the spinning fan: three sources of the shimmer.'),
  'tunnus-puu': w('Merkki tarkemmin, merkki sävelistä ja merkin aurinko äänen lähteenä.', 'The mark more exactly, the mark from notes, the mark\'s sun as the source.'),
  pisara: w('Montako pisaraa, roiske ja pinta sivulta.', 'How many drops, the splash, the surface from the side.'),
  lasit: w('Kosketus, kulma ja jälkisointi.', 'The touch, the angle and the ring-on.'),
  tuulikello: w('Putket edestä, putket tuulessa ja kello alta.', 'The tubes from the front, in the wind, and the chime from below.'),
  kuplat: w('Pinta, rypäs ja nousun liike.', 'The surface, the cluster and the motion of rising.'),
  kulho: w('Rohkeimmat: kulho vinosta, huojunta paksuutena ja nuijan kierros spiraalina.', 'Boldest: the bowl at an angle, the beating as thickness, the mallet\'s round as a spiral.'),
  jaapuikot: w('Puikon muoto, kiteen muoto ja napautusten lasku.', 'The icicle\'s shape, the crystal\'s shape and the falling taps.'),
};

const CURRENT_WORDS: Words = w('Nykyinen', 'Current');
const CURRENT_IDEA: Words = w('Kierroksen 6 B sellaisenaan.', 'Round 6\'s B as it is.');
export const VARIANTS: Record<SoundId, Variant[]> = Object.fromEntries(
  (Object.keys(CURRENT) as SoundId[]).map((id) => [id, [{name: CURRENT_WORDS, idea: CURRENT_IDEA, draw: CURRENT[id]}, ...NEW[id]]]),
) as Record<SoundId, Variant[]>;

/** The emblem's SVG. `play` is the strikes of the length being played, with a
 * key that restarts the ripples on every press; null at rest or with reduced motion. */
export function EmblemSvg({id, v, play, small}: {id: SoundId; v: number; play: {key: number; strikes: Strike[]} | null; small?: boolean}) {
  const e = VARIANTS[id][v].draw();
  return (
    <svg className={`rq-emblem rq-emblem-ripple${small ? ' rq-emblem-small' : ''}`} viewBox="-32 -32 64 64" aria-hidden="true"
      data-emblem={`${id}-${v}`} data-active={play ? 'true' : undefined}>
      <g className="rq-e-still">{e.still}</g>
      {play ? (
        <g key={play.key}>
          {play.strikes.map((s, i) => {
            const o = e.origins[i % e.origins.length];
            return (
              <g key={i} transform={`translate(${o.x} ${o.y}) rotate(${o.rot ?? 0})`}>
                <path className="rq-ripple" d={o.d}
                  style={{animationDelay: `${s.at.toFixed(3)}s`, animationDuration: `${Math.min(1.4, Math.max(0.5, s.ring)).toFixed(2)}s`, ['--amp' as string]: String(0.45 + Math.min(1, s.amp) * 0.55)}} />
              </g>
            );
          })}
        </g>
      ) : null}
    </svg>
  );
}

/** The variant this round recommends for each sound (0 = keep round 6's). */
export const RECOMMENDED: Record<SoundId, number> = {
  kalimba: 2, marimba: 1, vibrafoni: 2, 'tunnus-puu': 1, pisara: 0, lasit: 1, tuulikello: 0, kuplat: 1, kulho: 3, jaapuikot: 2,
};
