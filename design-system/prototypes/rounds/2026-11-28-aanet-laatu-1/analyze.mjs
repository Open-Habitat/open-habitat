#!/usr/bin/env node
// Measures attention sounds: the production set (web/src/app/soundSynth.ts,
// imported as is) and this round's candidate sets (candidates.mjs).
//
//   node analyze.mjs                       # table of every sound, both lengths
//   node analyze.mjs --json <file>         # also every number as JSON
//   node analyze.mjs --set current|A|B|C   # one set only
//   node analyze.mjs --wav <dir>           # also 48 kHz 16-bit WAVs, outside the repo
//
// Plain Node 22 (type stripping imports the production .ts), no packages:
// the host has no numpy, and the renderer is JavaScript anyway.
//
// What is measured, and why each number matters for a short struck sound:
// - length, sample rate, channels;
// - peak and true peak (4× oversampled), clipped samples, DC offset;
// - loudness: maximum momentary (400 ms) LUFS, the production normaliser's
//   own reference, and BS.1770 integrated LUFS;
// - attack: 10→90 % rise of each strike's envelope, and the first strike's
//   spectral flatness in its first 8 ms against 40–120 ms (how much of the
//   attack is noise rather than tone: a click or a thud);
// - decay: dB/s over the 150 ms after the last strike's peak and over the
//   last stretch before the final fade; a late rate much steeper than the
//   early one means the tail was choked by a gain curve, not left to ring;
//   the time from the last peak to −40 dB;
// - spectrum (whole sound, mono): centroid, 95 % roll-off, energy above
//   4, 6 and 8 kHz;
// - partials of the first strike: the strongest peaks, their ratio to the
//   lowest strong one, and the share of partial energy that is inharmonic
//   (> 30 cents from an integer ratio), with how long each partial rings;
// - stereo: L/R correlation and side-to-mid energy.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const TAU = 2 * Math.PI;

// ---------- DSP helpers ----------

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -TAU / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
/** Power spectrum of x[from, to) with a Hann window, zero-padded to 2^k. */
function power(x, from, to, minN = 1 << 15) {
  const len = Math.max(1, to - from);
  let n = 1; while (n < Math.max(len, minN)) n <<= 1;
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < len; i++) re[i] = (x[from + i] ?? 0) * (0.5 - 0.5 * Math.cos((TAU * i) / Math.max(1, len - 1)));
  fft(re, im);
  const p = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) p[i] = re[i] * re[i] + im[i] * im[i];
  return { p, df: 0, n };
}
const db = (x) => (x > 0 ? 10 * Math.log10(x) : -Infinity);
const dba = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

function biquadRun(x, c) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
// BS.1770 K-weighting, 48 kHz coefficients.
const K1 = { b0: 1.53512485958697, b1: -2.69169618940638, b2: 1.19839281085285, a1: -1.69065929318241, a2: 0.73248077421585 };
const K2 = { b0: 1, b1: -2, b2: 1, a1: -1.99004745483398, a2: 0.99007225036621 };

function loudness(L, R, sr) {
  const k = [L, R].map((ch) => biquadRun(biquadRun(ch, K1), K2));
  const W = Math.round(0.4 * sr), hop = Math.round(0.1 * sr);
  const n = L.length;
  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + k[0][i] ** 2 + k[1][i] ** 2;
  // Momentary max: 400 ms, 10 ms hop, zero beyond the ends (as production).
  let best = 0;
  const h10 = Math.round(0.01 * sr);
  for (let e = h10; e < n + W; e += h10) best = Math.max(best, (cum[Math.min(n, e)] - cum[Math.max(0, e - W)]) / W);
  // Integrated: 400 ms blocks, 75 % overlap, gates −70 LUFS and −10 LU.
  const blocks = [];
  for (let s = 0; s + W <= Math.max(n, W); s += hop) blocks.push((cum[Math.min(n, s + W)] - cum[Math.min(n, s)]) / W);
  const lk = (z) => -0.691 + 10 * Math.log10(z);
  const abs = blocks.filter((z) => z > 0 && lk(z) > -70);
  const mean = (a) => a.reduce((s, z) => s + z, 0) / a.length;
  const rel = abs.length ? lk(mean(abs)) - 10 : -Infinity;
  const gated = abs.filter((z) => lk(z) > rel);
  return { momentaryMax: lk(best), integrated: gated.length ? lk(mean(gated)) : -Infinity };
}

/** 4× oversampled peak with a 64-tap windowed-sinc interpolator. */
function truePeak(x) {
  const taps = 16, os = 4;
  let peak = 0;
  for (let i = 0; i < x.length; i++) {
    peak = Math.max(peak, Math.abs(x[i]));
    for (let p = 1; p < os; p++) {
      const frac = p / os;
      let s = 0;
      for (let k = -taps + 1; k <= taps; k++) {
        const j = i + k; if (j < 0 || j >= x.length) continue;
        const t = k - frac;
        const w = 0.5 + 0.5 * Math.cos((Math.PI * t) / taps);
        s += x[j] * (Math.sin(Math.PI * t) / (Math.PI * t)) * w;
      }
      peak = Math.max(peak, Math.abs(s));
    }
  }
  return peak;
}

/** RMS envelope in dB, window `win` s, hop `hop` s. */
function envelope(m, sr, win, hop) {
  const W = Math.max(1, Math.round(win * sr)), H = Math.max(1, Math.round(hop * sr));
  const out = [];
  for (let s = 0; s < m.length; s += H) {
    let e = 0, c = 0;
    for (let i = s - (W >> 1); i < s + (W >> 1); i++) if (i >= 0 && i < m.length) { e += m[i] * m[i]; c++; }
    out.push(Math.sqrt(e / Math.max(1, c)));
  }
  return { env: out, hop: H / sr };
}
function slope(xs, ys) {
  const n = xs.length; if (n < 2) return NaN;
  const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return num / den;
}
function flatness(x, from, to) {
  const { p } = power(x, from, to, 1024);
  let lg = 0, ar = 0, c = 0;
  for (let i = 2; i < p.length; i++) { const v = p[i] + 1e-20; lg += Math.log(v); ar += v; c++; }
  return Math.exp(lg / c) / (ar / c);
}

// ---------- Analysis of one render ----------

/**
 * @param {Float32Array} L @param {Float32Array} R @param {number} sr
 * @param {{at:number}[]} strikes onset times in seconds (from the recipe)
 * @param {number} fadeOut the final fade's length in seconds
 */
export function analyse(L, R, sr, strikes, fadeOut = 0.06) {
  const n = L.length;
  const m = Float64Array.from(L, (v, i) => 0.5 * (v + R[i]));
  const s = Float64Array.from(L, (v, i) => 0.5 * (v - R[i]));
  let peak = 0, clipped = 0, dc = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    peak = Math.max(peak, a); if (a >= 0.999) clipped++; dc += L[i] + R[i];
  }
  const tp = Math.max(truePeak(L), truePeak(R));
  const lu = loudness(L, R, sr);

  // Spectrum of the whole sound.
  const whole = power(m, 0, n);
  const df = sr / whole.n;
  let tot = 0, cen = 0; const above = { 4000: 0, 6000: 0, 8000: 0, 12000: 0 };
  for (let i = 1; i < whole.p.length; i++) {
    const f = i * df, v = whole.p[i]; tot += v; cen += f * v;
    for (const k of Object.keys(above)) if (f >= +k) above[k] += v;
  }
  let acc = 0, roll = 0;
  for (let i = 1; i < whole.p.length; i++) { acc += whole.p[i]; if (acc >= 0.95 * tot) { roll = i * df; break; } }

  // Attack: per strike, 10→90 % of the local peak in a 0.25 ms envelope.
  const fine = envelope(m, sr, 0.0005, 0.00025);
  const at = strikes.map((x) => x.at).sort((a, b) => a - b);
  const rises = at.map((t0, k) => {
    const t1 = Math.min(at[k + 1] ?? t0 + 0.08, t0 + 0.08);
    const a = Math.floor(t0 / fine.hop), b = Math.min(fine.env.length, Math.ceil(t1 / fine.hop));
    let pk = 0, pi = a;
    for (let i = a; i < b; i++) if (fine.env[i] > pk) { pk = fine.env[i]; pi = i; }
    let i10 = a; while (i10 < pi && fine.env[i10] < 0.1 * pk) i10++;
    let i90 = i10; while (i90 < pi && fine.env[i90] < 0.9 * pk) i90++;
    return (i90 - i10) * fine.hop * 1000;
  });
  const s0 = Math.round(at[0] * sr);
  const noiseAttack = flatness(m, s0, s0 + Math.round(0.008 * sr));
  const noiseBody = flatness(m, s0 + Math.round(0.04 * sr), s0 + Math.round(0.12 * sr));
  // Onset click: energy above 8 kHz in the first 5 ms against the whole first strike.
  const sp5 = power(m, s0, s0 + Math.round(0.005 * sr), 4096);
  const df5 = sr / sp5.n; let hi5 = 0, all5 = 0;
  for (let i = 1; i < sp5.p.length; i++) { all5 += sp5.p[i]; if (i * df5 >= 8000) hi5 += sp5.p[i]; }

  // Decay after the last strike.
  const coarse = envelope(m, sr, 0.01, 0.005);
  const lastAt = at[at.length - 1];
  const a0 = Math.floor(lastAt / coarse.hop);
  let pk = 0, pi = a0;
  for (let i = a0; i < Math.min(coarse.env.length, a0 + 20); i++) if (coarse.env[i] > pk) { pk = coarse.env[i]; pi = i; }
  const dbEnv = coarse.env.map((v) => dba(v / (pk || 1)));
  const range = (t0, t1) => {
    const xs = [], ys = [];
    for (let i = pi + Math.round(t0 / coarse.hop); i < pi + Math.round(t1 / coarse.hop) && i < dbEnv.length; i++) if (Number.isFinite(dbEnv[i]) && dbEnv[i] > -90) { xs.push(i * coarse.hop); ys.push(dbEnv[i]); }
    return slope(xs, ys);
  };
  const early = range(0.01, 0.16);
  const endT = n / sr - fadeOut - (pi * coarse.hop);
  const late = range(Math.max(0.17, endT - 0.15), endT);
  let to40 = NaN;
  for (let i = pi; i < dbEnv.length; i++) if (dbEnv[i] <= -40) { to40 = (i - pi) * coarse.hop; break; }
  const tail50 = (() => { let e = 0; const k = Math.round(0.05 * sr); for (let i = n - k; i < n; i++) e = Math.max(e, Math.abs(L[i]), Math.abs(R[i])); return dba(e); })();

  // Partials of the first strike: up to the next strike or 300 ms.
  const win = Math.round(Math.min((at[1] ?? at[0] + 0.3) - at[0], 0.3) * sr);
  const first = power(m, s0, s0 + Math.max(win, Math.round(0.06 * sr)), 1 << 16);
  const dfp = sr / first.n;
  const pdb = Array.from(first.p, db);
  const top = Math.max(...pdb);
  const minSep = Math.round(25 / dfp);
  let peaks = [];
  for (let i = 3; i < pdb.length - 3; i++) {
    if (i * dfp < 120 || i * dfp > 16000) continue;
    if (pdb[i] > pdb[i - 1] && pdb[i] >= pdb[i + 1] && pdb[i] > top - 45) {
      const y0 = pdb[i - 1], y1 = pdb[i], y2 = pdb[i + 1];
      const d = 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2 || 1);
      peaks.push({ f: (i + d) * dfp, dB: y1 - top, i });
    }
  }
  peaks.sort((a, b) => b.dB - a.dB);
  const kept = [];
  for (const p of peaks) if (kept.every((q) => Math.abs(q.i - p.i) > minSep)) kept.push(p);
  peaks = kept.slice(0, 8).sort((a, b) => a.f - b.f);
  const strong = peaks.filter((p) => p.dB > -20);
  const f0 = (strong[0] ?? peaks[0])?.f ?? 0;
  // How long each partial rings: magnitude at its frequency in 20 ms frames.
  const ringFor = (f) => {
    const W = Math.round(0.02 * sr), hopN = Math.round(0.01 * sr);
    const end = Math.min(n, s0 + Math.round(((at[1] ?? n / sr) - at[0]) * sr));
    const vals = [];
    for (let s = s0; s + W < end; s += hopN) {
      let re = 0, im = 0;
      for (let i = 0; i < W; i++) { const w = 0.5 - 0.5 * Math.cos((TAU * i) / (W - 1)); re += m[s + i] * w * Math.cos((TAU * f * i) / sr); im -= m[s + i] * w * Math.sin((TAU * f * i) / sr); }
      vals.push(Math.hypot(re, im));
    }
    const mx = Math.max(...vals); const k = vals.findIndex((v) => v < mx * 0.1); // −20 dB
    return k < 0 ? null : k * 0.01;
  };
  let inh = 0, pe = 0;
  const partials = peaks.map((p) => {
    const r = p.f / f0, near = Math.max(1, Math.round(r));
    const cents = 1200 * Math.log2(r / near);
    const e = 10 ** (p.dB / 10); pe += e; if (Math.abs(cents) > 30) inh += e;
    return { hz: +p.f.toFixed(1), dB: +p.dB.toFixed(1), ratio: +r.toFixed(3), cents: +cents.toFixed(0), ring20: ringFor(p.f) };
  });

  // Stereo.
  let lr = 0, ll = 0, rr = 0, se = 0, me = 0;
  for (let i = 0; i < n; i++) { lr += L[i] * R[i]; ll += L[i] ** 2; rr += R[i] ** 2; se += s[i] ** 2; me += m[i] ** 2; }

  return {
    length: +(n / sr).toFixed(3), sampleRate: sr, channels: 2,
    peakDb: +dba(peak).toFixed(2), truePeakDb: +dba(tp).toFixed(2), clipped, dc: +(dc / (2 * n)).toExponential(1),
    lufsMomentaryMax: +lu.momentaryMax.toFixed(2), lufsIntegrated: +lu.integrated.toFixed(2),
    strikes: at.length, riseMs: rises.map((r) => +r.toFixed(2)),
    attackNoiseDb: +db(noiseAttack).toFixed(1), bodyNoiseDb: +db(noiseBody).toFixed(1), onsetAbove8kDb: +db(hi5 / all5).toFixed(1),
    decayEarlyDbPerS: +early.toFixed(0), decayLateDbPerS: +late.toFixed(0), chokeRatio: +(late / early).toFixed(2),
    lastPeakTo40dB: Number.isFinite(to40) ? +to40.toFixed(3) : null, tail50Db: +tail50.toFixed(1),
    centroidHz: +(cen / tot).toFixed(0), rolloff95Hz: +roll.toFixed(0),
    above4kDb: +db(above[4000] / tot).toFixed(1), above6kDb: +db(above[6000] / tot).toFixed(1), above8kDb: +db(above[8000] / tot).toFixed(1), above12kDb: +db(above[12000] / tot).toFixed(1),
    partials, inharmonicShare: +(inh / (pe || 1)).toFixed(2),
    lrCorrelation: +(lr / Math.sqrt(ll * rr)).toFixed(3), sideToMidDb: +db(se / me).toFixed(1),
  };
}

// ---------- CLI ----------

function wav(path, L, R, sr) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  const q = (v) => Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  for (let i = 0; i < n; i++) { buf.writeInt16LE(q(L[i]), 44 + i * 4); buf.writeInt16LE(q(R[i]), 46 + i * 4); }
  writeFileSync(path, buf);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('analyze.mjs')) {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const prod = await import(resolve(here, '../../../../web/src/app/soundSynth.ts'));
  const { SETS, renderCandidate, candidateStrikes } = await import('./candidates.mjs');
  const sets = { current: { ids: prod.soundIds, render: prod.renderSound, strikes: prod.soundStrikes } };
  for (const set of SETS) sets[set.id] = { ids: prod.soundIds, render: (id, len) => renderCandidate(set.id, id, len), strikes: (id, len) => candidateStrikes(set.id, id, len) };
  const only = opt('--set');
  const wavDir = opt('--wav');
  if (wavDir) mkdirSync(wavDir, { recursive: true });
  const all = {};
  for (const [setId, set] of Object.entries(sets)) {
    if (only && only !== setId) continue;
    for (const id of set.ids) for (const len of ['short', 'long']) {
      const r = set.render(id, len);
      const a = analyse(r.left, r.right, 48000, set.strikes(id, len));
      all[`${setId}/${id}/${len}`] = a;
      if (wavDir) wav(join(wavDir, `${setId}-${id}-${len}.wav`), r.left, r.right, 48000);
    }
  }
  const cols = ['length', 'lufsMomentaryMax', 'lufsIntegrated', 'truePeakDb', 'clipped', 'strikes', 'riseMs', 'attackNoiseDb', 'bodyNoiseDb', 'onsetAbove8kDb', 'decayEarlyDbPerS', 'decayLateDbPerS', 'chokeRatio', 'lastPeakTo40dB', 'centroidHz', 'rolloff95Hz', 'above6kDb', 'above8kDb', 'inharmonicShare', 'lrCorrelation', 'sideToMidDb'];
  console.log(['sound', ...cols].join('\t'));
  for (const [k, a] of Object.entries(all)) console.log([k, ...cols.map((c) => Array.isArray(a[c]) ? a[c].map((v) => v.toFixed(1)).join('/') : a[c])].join('\t'));
  if (opt('--json')) writeFileSync(opt('--json'), JSON.stringify(all, null, 1));
}
