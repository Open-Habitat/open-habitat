// Candidate attention-sound sets for the quality round (attention-sounds-quality).
// Our own synthesis, no samples: every sound is rendered from the numbers
// below. Each set treats the same ten production sounds (same ids, same
// instruments) differently, so a row on the page compares one sound four
// ways. The measurements behind each change are in
// issues/attention-sounds-quality/research.md.
//
//   A Avattu    the production gestures (notes, timing, instruments), with
//               the spectrum opened to 12 kHz, the upper modes struck
//               harder, no octave-below mode, no box/thump colouring, no
//               early-reflection taps, and a tail that rings out instead of
//               being damped by a gain curve.
//   B Kirkas    A, plus a brighter register for metal, glass and ice, the
//               object's higher modes (the shimmer) present and slowly
//               beating, a hard, very short contact, at most three strikes
//               a little closer together, and the spectrum open to 16 kHz.
//   C Yksi isku B's voices, struck as one gesture: the notes 14 ms apart (a
//               rolled chord; drops and bubbles 50 ms), so the whole length
//               rings from the start.
//
// Every render is stereo 48 kHz, normalised like production: −17 LUFS
// maximum momentary loudness with a −3 dBFS peak ceiling, so the sets are
// loudness-matched with the current one by the same meter.
//
// "No damper": each voice's slowest decay is chosen so that it has fallen
// ~45 dB by the end of the sound (tau ≤ (end − onset) / 5.2). A short length
// is the same object damped sooner, and nothing is cut off by a gain curve;
// only a 90 ms fade under −45 dB closes the buffer.

export const SAMPLE_RATE = 48000;
export const TARGET_LUFS = -17;
export const PEAK_CEIL = 0.708; // −3 dBFS
export const LENGTHS = { short: 0.8, long: 1.6 };
const TAU = 2 * Math.PI;

export const SETS = [
  { id: 'A', name: 'Avattu', line: 'Samat eleet ja soittimet; yläpää auki 12 kHz:iin, soi loppuun asti, ei vaimennuskäyrää.' },
  { id: 'B', name: 'Kirkas', line: 'Lisäksi kirkkaampi rekisteri, esineen yläsävelet huojuvat, kova lyhyt kosketus, enintään kolme iskua.' },
  { id: 'C', name: 'Yksi isku', line: 'B:n äänet yhtenä eleenä: sävelet lyödään lähes yhtä aikaa (murtosointu), ja koko pituus soi.' },
];

const NAMES = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };
const hz = (n) => {
  if (typeof n === 'number') return n;
  const m = /^([A-G]#?)(\d)$/.exec(n);
  return 440 * 2 ** ((NAMES[m[1]] + 12 * (Number(m[2]) - 4)) / 12);
};

// Mode tables: [ratio, amplitude]. Decay comes from the voice (see `tau`).
// `extra` rows are the higher modes B and C add: the object's own shimmer.
// Glass and the singing bowl follow a thin ring's bending modes,
// f_m ∝ m(m²−1)/√(m²+1) for m = 2, 3, 4, …: 1 : 2.83 : 5.42 : 8.77 : 12.9.
// The wind-chime tube is a free–free bar: 1 : 2.756 : 5.404 : 8.933 : 13.34.
const FAMILY = {
  tine: { modes: [[1, 1], [5.95, 0.2], [13.3, 0.05]], extra: [[5.95, 0.3], [13.3, 0.12], [21.5, 0.035]], alpha: 0.9 },
  bar: { modes: [[1, 1], [3.99, 0.22], [9.9, 0.045]], extra: [[3.99, 0.12], [9.9, 0.07]], alpha: 1.1 },
  vibe: { modes: [[1, 1], [4, 0.1], [10, 0.015]], extra: [[4, 0.15], [10, 0.05], [17.6, 0.012]], alpha: 0.7 },
  drop: { modes: [[1, 1], [2.04, 0.06]], extra: [], alpha: 1.2 },
  glass: { modes: [[1, 1], [2.83, 0.24], [5.42, 0.06], [8.77, 0.018]], extra: [[2.83, 0.12], [5.42, 0.1], [8.77, 0.05], [12.9, 0.02]], alpha: 0.6 },
  tube: { modes: [[1, 1], [2.756, 0.32], [5.404, 0.1], [8.933, 0.03]], extra: [[5.404, 0.06], [8.933, 0.04], [13.34, 0.015]], alpha: 0.6 },
  bubble: { modes: [[1, 1], [2.1, 0.03]], extra: [], alpha: 1.2 },
  bowl: { modes: [[1, 1], [2.74, 0.36], [5.17, 0.09], [8.4, 0.02]], extra: [[5.17, 0.06], [8.4, 0.04], [12.5, 0.012]], alpha: 0.5 },
  ice: { modes: [[1, 1], [2.62, 0.26], [4.95, 0.08], [7.9, 0.025]], extra: [[4.95, 0.08], [7.9, 0.05], [11.6, 0.02]], alpha: 0.7 },
};

// The ten production sounds, as gestures. `notes`: [onset s, note, amp, pan].
// `up`: semitones B and C raise the register. `contact`: ms of the mallet's
// or finger's contact in A (B and C: `hard`). `t1`: the fundamental's decay
// time constant (s) in the long length before the no-damper limit.
const SOUNDS = {
  kalimba: { family: 'tine', notes: [[0, 'B5', 0.85, 0.35], [0.12, 'G5', 0.8, -0.4], [0.24, 'D6', 0.9, 0.15]], up: 5, contact: 0.3, hard: 0.12, t1: 0.6, split: 3.5, noise: [2400, 2, 0.05], body: [[240, 4, 0.3], [520, 5, 0.18]] },
  marimba: { family: 'bar', notes: [[0, 'E5', 0.8, -0.35], [0.1, 'G5', 0.85, 0], [0.2, 'C6', 1, 0.35]], up: 0, contact: 0.7, hard: 0.2, t1: 0.45, split: 1.5, noise: [1800, 3, 0.06], body: [[180, 3, 0.12]] },
  vibrafoni: { family: 'vibe', notes: [[0, 'F5', 0.9, -0.3], [0.025, 'A5', 0.8, 0.3]], up: 7, contact: 0.55, hard: 0.35, t1: 0.95, split: 1.2, noise: [2600, 2, 0.04], tremolo: [5.5, 0.3] },
  'tunnus-puu': { family: 'bar', notes: [[0, 'D5', 0.85, -0.3], [0.12, 'A5', 1, 0.2], [0.26, 'F#6', 0.42, 0.05]], up: 0, contact: 0.7, hard: 0.2, t1: 0.45, split: 1.5, noise: [1900, 3, 0.06], body: [[180, 3, 0.12]] },
  pisara: { family: 'drop', notes: [[0, 1000, 1, -0.2], [0.17, 1350, 0.65, 0.3], [0.29, 1700, 0.35, 0.05]], up: 4, contact: 0, hard: 0, t1: 0.075, split: 0, noise: [3000, 0.8, 0.03], pitch: [0.55, 0.016], rise: 0.6, room: 'wet' },
  lasit: { family: 'glass', notes: [[0, 'A5', 0.8, -0.25], [0.16, 'D6', 0.7, 0.3]], up: 7, contact: 0.12, hard: 0.06, t1: 0.65, split: 4, noise: [5200, 0.8, 0.04] },
  tuulikello: { family: 'tube', notes: [[0, 'C6', 0.75, -0.1], [0.07, 'E6', 0.55, 0.5], [0.16, 'A5', 0.85, -0.55], [0.235, 'D6', 0.5, 0.25], [0.34, 'G5', 0.6, -0.3]], up: 5, contact: 0.2, hard: 0.1, t1: 0.7, split: 3.6, noise: [4800, 0.8, 0.03] },
  kuplat: { family: 'bubble', notes: [[0, 620, 0.9, -0.35], [0.07, 820, 0.75, 0.3], [0.15, 700, 0.8, -0.05], [0.2, 980, 0.6, 0.45]], up: 3, contact: 0, hard: 0, t1: 0.04, shortDecay: 1, split: 0, pitch: [0.6, 0.01], rise: 1.6 },
  kulho: { family: 'bowl', notes: [[0, 'G4', 1, 0]], up: 5, contact: 3, hard: 1.2, t1: 0.9, split: 10, noise: [1500, 4, 0.04], attack: 0.004 },
  jaapuikot: { family: 'ice', notes: [[0, 'E6', 0.6, 0.35], [0.13, 'C6', 0.7, -0.1], [0.26, 'A5', 0.85, -0.35]], up: 5, contact: 0.1, hard: 0.05, t1: 0.42, split: 6, noise: [5600, 0.8, 0.035] },
};
export const SOUND_IDS = Object.keys(SOUNDS);

/** The voices of one sound in one set and length. */
function plan(set, id, length) {
  const s = SOUNDS[id];
  const fam = FAMILY[s.family];
  const dur = LENGTHS[length];
  const short = length === 'short';
  let notes = s.notes.map((n) => [...n]);
  if (set !== 'A') {
    if (notes.length > 3) notes = [notes[0], notes[1], notes[2]];
    notes = notes.map(([at, n, a, p]) => [at * 0.85, hz(n) * 2 ** (s.up / 12), a, p]);
  } else notes = notes.map(([at, n, a, p]) => [at, hz(n), a, p]);
  if (short && set !== 'C') notes = notes.map(([at, f, a, p]) => [at * 0.8, f, a, p]);
  // C: one gesture, a rolled chord; the highest note softest.
  // Drops and bubbles stay a quick run (50 ms apart): stacked, their peaks
  // add up and the peak ceiling would leave them quieter than the rest.
  const roll = fam === FAMILY.drop || fam === FAMILY.bubble ? 0.05 : 0.014;
  if (set === 'C') notes = notes.map(([, f, a, p], k) => [k * roll, f, a * (k ? 0.8 : 1), p]);
  // A strikes the upper modes 1.5× harder; B and C add each `extra` row's
  // amplitude to the same ratio, or append it as a new mode.
  const modes = fam.modes.map(([r, a], m) => [r, set === 'A' && m ? a * 1.5 : a]);
  if (set !== 'A') for (const [r, a] of fam.extra) {
    const row = modes.find(([q]) => q === r);
    if (row) row[1] += a; else modes.push([r, a]);
  }
  const fade = 0.09;
  const voices = notes.map(([at, f, amp, pan], k) => {
    const room = dur - fade - at;
    // A bubble is already brief: the short length does not damp it further.
    const t1 = Math.min(s.t1 * (short ? s.shortDecay ?? 0.55 : 1), room / 5.2);
    return {
      at, f, amp, pan, seed: 1000 + 37 * k + id.length * 7 + set.charCodeAt(0),
      modes: modes.map(([r, a]) => [r, a, Math.max(0.012, t1 * r ** -fam.alpha * (set === 'A' ? 1.4 : 1.8))]).map(([r, a, d], m) => [r, a, m ? Math.min(d, t1) : t1]),
      contact: set === 'A' ? s.contact : s.hard,
      split: s.split ? { cents: s.split * (set === 'A' ? 1 : 1.2), level: set === 'A' ? 0.45 : 0.6, decay: 0.7 } : null,
      jitter: s.family === 'ice' ? 6 : 2.5,
      width: set === 'A' ? 0.15 : 0.25,
      attack: s.attack ?? (set === 'A' ? 0.0008 : 0.0004),
      noise: s.noise ? { f: s.noise[0] * (set === 'A' ? 1 : 1.1), ms: s.noise[1], amp: s.noise[2] * (set === 'A' ? 1 : 0.6) } : null,
      pitch: s.pitch, rise: s.rise, tremolo: s.tremolo,
    };
  });
  return {
    dur, fade, voices,
    body: set === 'A' && s.body ? s.body.map(([f, q, g]) => [f, q, g * 0.5]) : null,
    reverb: s.room === 'wet'
      ? { t60: short ? 0.5 : 0.9, mix: 0.28, predelay: 0.016, damp: 7000 }
      : { t60: short ? 0.45 : 0.85, mix: set === 'A' ? 0.16 : 0.14, predelay: 0.01, damp: set === 'A' ? 6000 : 8000 },
    lowpass: set === 'A' ? 12000 : 16000,
  };
}

/** Onsets for the analyser and the emblem ripples. */
export function candidateStrikes(set, id, length) {
  const p = plan(set, id, length);
  return p.voices.map((v) => ({ at: v.at, amp: v.amp, ring: Math.max(0.5, (p.dur - v.at) * 0.85) }));
}
export const candidateDuration = (set, id, length) => LENGTHS[length];

// ---------- Renderer ----------

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function biquad(type, f, q, sr = SAMPLE_RATE) {
  const w = (TAU * f) / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; }
  const a0 = 1 + al;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * cw) / a0, a2: (1 - al) / a0 };
}
function filter(x, c) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y;
  }
}
const panGains = (p = 0) => { const a = ((Math.max(-1, Math.min(1, p)) + 1) * Math.PI) / 4; return [Math.cos(a), Math.sin(a)]; };
const rcos = (t, len) => (t <= 0 ? 0 : t >= len ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * t) / len));

function renderVoice(v, L, R, sr) {
  const start = Math.round(v.at * sr), n = L.length;
  const rand = mulberry32(v.seed);
  const gauss = () => { const u = rand() || 1e-9, w = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * w); };
  const tc = v.contact / 1000;
  // A half-sine contact force of length tc falls 12 dB/octave above ~0.6/tc.
  const weight = (f) => (tc ? 1 / Math.sqrt(1 + ((f * tc) / 0.6) ** 4) : 1);
  const w0 = weight(v.f);
  const comps = [];
  v.modes.forEach(([ratio, a, decay], m) => {
    if (v.f * ratio > 18000) return;
    const cents = v.jitter * gauss() * (m ? 1 : 0.3);
    const r = ratio * 2 ** (cents / 1200);
    const side = m % 2 ? 1 : -1;
    const base = (a * weight(v.f * r)) / w0;
    comps.push({ r, a: base, k: Math.exp(-1 / (decay * sr)), g: panGains(v.pan + side * v.width), ph: TAU * rand() * (m ? 1 : 0) });
    if (v.split) {
      // The near-degenerate partner: a few cents away on the other side, its
      // own (faster) decay. Its slow beating is the object's shimmer.
      const c2 = v.split.cents * (0.7 + 0.6 * rand()) * (rand() < 0.5 ? -1 : 1) * (m ? 1.4 : 1);
      comps.push({ r: r * 2 ** (c2 / 1200), a: base * v.split.level, k: Math.exp(-1 / (decay * v.split.decay * sr)), g: panGains(v.pan - side * v.width), ph: TAU * rand() });
    }
  });
  const [gl, gr] = panGains(v.pan);
  let noise = null;
  if (v.noise) {
    const nr = mulberry32(v.seed + 7);
    const len = Math.min(n - start, Math.round((v.noise.ms / 1000) * sr * 8));
    noise = new Float64Array(Math.max(0, len));
    for (let i = 0; i < noise.length; i++) noise[i] = (nr() * 2 - 1) * Math.exp(-i / ((v.noise.ms / 1000) * sr)) * rcos(i / sr, 0.0003);
    filter(noise, biquad('bp', v.noise.f, 0.8, sr));
  }
  const env = comps.map(() => 1), phase = comps.map((c) => c.ph);
  for (let i = start; i < n; i++) {
    const t = (i - start) / sr;
    let bend = v.pitch ? 1 + (v.pitch[0] - 1) * Math.exp(-t / v.pitch[1]) : 1;
    if (v.rise) bend *= 1 + v.rise * t;
    const tr = v.tremolo ? 1 - v.tremolo[1] * (0.5 - 0.5 * Math.cos(TAU * v.tremolo[0] * t)) : 1;
    const k = v.amp * rcos(t, v.attack) * tr;
    let l = 0, r = 0;
    for (let m = 0; m < comps.length; m++) {
      const c = comps[m];
      if (env[m] < 1e-7) continue;
      const s = c.a * env[m] * Math.sin(phase[m]);
      l += s * c.g[0]; r += s * c.g[1];
      env[m] *= c.k;
      phase[m] += (TAU * v.f * c.r * bend) / sr;
    }
    L[i] += l * k; R[i] += r * k;
    const j = i - start;
    if (noise && j < noise.length) { const s = v.amp * v.noise.amp * 6 * noise[j]; L[i] += s * gl; R[i] += s * gr; }
  }
}

function body(L, R, rows, sr) {
  for (const ch of [L, R]) {
    const wet = new Float64Array(ch.length);
    for (const [f, q, g] of rows) { const x = Float64Array.from(ch); filter(x, biquad('bp', f, q, sr)); for (let i = 0; i < x.length; i++) wet[i] += g * x[i]; }
    for (let i = 0; i < ch.length; i++) ch[i] += wet[i];
  }
}

// 8-line FDN with a Householder matrix, as production, but fed through four
// allpasses (denser onset) and no discrete early taps: taps 6–34 ms apart
// comb-filter a tonal sound (notches every 1/delay Hz).
const FDN = [1433, 1601, 1867, 2053, 2251, 2399, 2677, 2969];
function reverb(L, R, o, sr) {
  const n = L.length, N = FDN.length;
  const pre = Math.round(o.predelay * sr), dampK = Math.exp((-TAU * o.damp) / sr);
  const lines = FDN.map((len) => ({ len, buf: new Float64Array(len), w: 0, z: 0, g: 10 ** ((-3 * len) / (o.t60 * sr)) }));
  const aps = [[142, 0.62], [107, 0.62], [379, 0.6], [277, 0.6]].map(([len, g]) => ({ len, g, buf: new Float64Array(len), w: 0 }));
  const wetL = new Float64Array(n), wetR = new Float64Array(n), outs = new Float64Array(N);
  for (let i = 0; i < n; i++) {
    let x = i >= pre ? 0.5 * (L[i - pre] + R[i - pre]) : 0;
    for (const a of aps) { const d = a.buf[a.w]; const y = -a.g * x + d; a.buf[a.w] = x + a.g * y; a.w = (a.w + 1) % a.len; x = y; }
    let sum = 0;
    for (let j = 0; j < N; j++) { const ln = lines[j]; ln.z = (1 - dampK) * ln.buf[ln.w] + dampK * ln.z; outs[j] = ln.z * ln.g; sum += outs[j]; }
    const hh = (2 / N) * sum;
    let l = 0, r = 0;
    for (let j = 0; j < N; j++) {
      const ln = lines[j];
      ln.buf[ln.w] = outs[j] - hh + (j % 2 ? -x : x); ln.w = (ln.w + 1) % ln.len;
      if (j % 2) r += (j % 4 === 1 ? 1 : -1) * outs[j]; else l += (j % 4 === 0 ? 1 : -1) * outs[j];
    }
    wetL[i] = l * 0.5; wetR[i] = r * 0.5;
  }
  for (let i = 0; i < n; i++) { L[i] += o.mix * wetL[i]; R[i] += o.mix * wetR[i]; }
}

const K1 = { b0: 1.53512485958697, b1: -2.69169618940638, b2: 1.19839281085285, a1: -1.69065929318241, a2: 0.73248077421585 };
const K2 = { b0: 1, b1: -2, b2: 1, a1: -1.99004745483398, a2: 0.99007225036621 };
function momentaryMax(L, R) {
  const n = L.length, W = Math.round(0.4 * SAMPLE_RATE), hop = Math.round(0.01 * SAMPLE_RATE);
  const cum = new Float64Array(n + 1);
  for (const ch of [L, R]) { const x = Float64Array.from(ch); filter(x, K1); filter(x, K2); for (let i = 0; i < n; i++) cum[i + 1] += x[i] * x[i]; }
  for (let i = 0; i < n; i++) cum[i + 1] += cum[i];
  let best = 0;
  for (let e = hop; e < n + W; e += hop) best = Math.max(best, (cum[Math.min(n, e)] - cum[Math.max(0, e - W)]) / W);
  return -0.691 + 10 * Math.log10(best);
}

const cache = new Map();
/** One candidate sound, rendered and normalised: { left, right } at 48 kHz. */
export function renderCandidate(set, id, length) {
  const key = `${set}/${id}/${length}`;
  if (cache.has(key)) return cache.get(key);
  const p = plan(set, id, length), sr = SAMPLE_RATE, n = Math.round(p.dur * sr);
  const L = new Float64Array(n), R = new Float64Array(n);
  for (const v of p.voices) renderVoice(v, L, R, sr);
  if (p.body) body(L, R, p.body, sr);
  reverb(L, R, p.reverb, sr);
  for (const ch of [L, R]) { filter(ch, biquad('hp', 110, 0.707)); filter(ch, biquad('lp', p.lowpass, 0.707)); }
  const fin = Math.round(0.002 * sr), fout = Math.round(p.fade * sr);
  for (const ch of [L, R]) {
    for (let i = 0; i < fin; i++) ch[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fin);
    for (let i = 0; i < fout; i++) ch[n - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fout);
    ch[0] = 0; ch[n - 1] = 0;
  }
  const lufs = momentaryMax(L, R);
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  let gain = 10 ** ((TARGET_LUFS - lufs) / 20);
  if (peak * gain > PEAK_CEIL) gain = PEAK_CEIL / peak;
  const out = { left: Float32Array.from(L, (x) => x * gain), right: Float32Array.from(R, (x) => x * gain) };
  cache.set(key, out);
  return out;
}
