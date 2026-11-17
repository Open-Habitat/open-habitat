// Attention sounds, round 1 (issue attention-sound): the sounds themselves.
//
// Every sound is a short declarative recipe rendered sample by sample in plain
// JavaScript: no Web Audio graph, no samples, no third-party material. The same
// function runs in the page (which wraps the samples in an AudioBuffer) and in
// Node (render.mjs, which writes 16-bit WAV files and checks fingerprints), so
// the product can either ship this renderer or the rendered files and get the
// same samples. Math.sin/Math.exp are the only primitives; the noise of the
// struck sounds comes from a seeded PRNG, so a recipe always gives the same
// output at a given sample rate.
//
// Voice kinds:
//   modes  struck or rung modal object: damped sines at `ratio`×f, each with its
//          own amplitude and decay (s); optional `glide` (start at from×f and
//          settle with time constant tau) and `noise` (a short low-passed
//          noise burst: the stick or finger hitting the object).
//   fm     two-operator FM "mallet": carrier f, modulator ratio×f, an index
//          that starts at `index` and decays with `indexDecay` (bright attack,
//          round tail), amplitude envelope attack/decay.
// The mix is faded out over its last 30 % (RELEASE) and peak-normalised to
// PEAK × level, so loudness is set in one place and the tail never clicks.

export const SAMPLE_RATE = 48000;
export const PEAK = 0.5;
// The release: a raised-cosine fade over the last 30 % of the sound, so a ring
// that is cut to stay under a second ends as if damped, not truncated.
const RELEASE = 0.3;

// Note frequencies (A4 = 440 Hz, equal temperament).
const N = {
  A4: 440.0, C5: 523.25, D5: 587.33, E5: 659.26, G5: 783.99, A5: 880.0,
  C6: 1046.5, D6: 1174.66, E6: 1318.51, Fs6: 1479.98, G6: 1567.98, A6: 1760.0,
};

const bell = [[1, 1, 0.4], [2.0, 0.25, 0.24], [3.01, 0.08, 0.18], [4.17, 0.05, 0.12]];
const chime = [[1, 1, 0.24], [2.76, 0.22, 0.14], [5.4, 0.07, 0.06]];
const bowl = [[1, 1, 0.5], [1.004, 0.6, 0.5], [2.71, 0.3, 0.3], [2.715, 0.2, 0.3], [5.15, 0.06, 0.2]];
const block = [[1, 1, 0.05], [1.58, 0.5, 0.035], [2.42, 0.25, 0.025]];
const marimba = [[1, 1, 0.2], [3.93, 0.18, 0.06], [9.2, 0.05, 0.02]];
const glass = [[1, 1, 0.32], [2.32, 0.35, 0.22], [4.25, 0.12, 0.15], [6.63, 0.05, 0.08]];
const drop = [[1, 1, 0.12], [2.1, 0.1, 0.05]];
const mallet = (at, f, amp = 1, decay = 0.26, extra = {}) =>
  ({ kind: 'fm', at, f, amp, ratio: 1, index: 1.4, indexDecay: 0.09, decay, attack: 0.004, ...extra });

export const FAMILIES = [
  {
    id: 'A', name: 'Kellot', short: 'Kellot',
    line: 'Pehmeät kellot ja kilinät: tuttu ”valmis”-ääni, soi pisimpään.',
  },
  {
    id: 'B', name: 'Puu ja lasi', short: 'Puu ja lasi',
    line: 'Lyhyet napautukset puuhun ja lasiin: kuiva, huomaamaton, kuin koputus oveen.',
  },
  {
    id: 'C', name: 'Habitat-aiheet', short: 'Habitat',
    line: 'Merkistä johdetut aiheet: kaksi kaarta kvintin päässä ja aurinko niiden yllä, yksi pehmeä soundi.',
  },
];

export const SOUNDS = [
  { id: 'a1', family: 'A', name: 'Kide', level: 0.9, dur: 0.9,
    desc: 'Yksi kirkas kello, C6.',
    how: 'Moodisynteesi: kellon neljä ylä-ääntä (1 : 2 : 3,01 : 4,17), vaimeneminen 0,40–0,12 s.',
    voices: [{ kind: 'modes', at: 0, f: N.C6, modes: bell, attack: 0.003 }] },
  { id: 'a2', family: 'A', name: 'Kaksi kelloa', level: 0.95, dur: 0.95,
    desc: 'Kaksi kelloa nousevana kvarttina, G5 → C6.',
    how: 'Sama kello kahdesti 130 ms välein, ensimmäinen hiljempaa.',
    voices: [
      { kind: 'modes', at: 0, f: N.G5, amp: 0.8, modes: bell, attack: 0.003 },
      { kind: 'modes', at: 0.13, f: N.C6, modes: bell, attack: 0.003 }] },
  { id: 'a3', family: 'A', name: 'Tuulikello', level: 0.85, dur: 0.75,
    desc: 'Kolme pientä putkikelloa, E6 G6 A6.',
    how: 'Moodisynteesi tankokellon suhteilla (1 : 2,76 : 5,4), 75 ms välein.',
    voices: [
      { kind: 'modes', at: 0, f: N.E6, amp: 0.6, modes: chime, attack: 0.002 },
      { kind: 'modes', at: 0.075, f: N.G6, amp: 0.7, modes: chime, attack: 0.002 },
      { kind: 'modes', at: 0.15, f: N.A6, amp: 0.8, modes: chime, attack: 0.002 }] },
  { id: 'a4', family: 'A', name: 'Kulho', level: 1, dur: 0.95,
    desc: 'Matala laulava kulho, A4, hento huojunta.',
    how: 'Moodit pareittain 1 : 1,004 ja 2,71 : 2,715, jolloin ääni huojuu; pehmeä 12 ms isku.',
    voices: [{ kind: 'modes', at: 0, f: N.A4, modes: bowl, attack: 0.012 }] },
  { id: 'b1', family: 'B', name: 'Koputus', level: 1, dur: 0.4,
    desc: 'Kaksi koputusta puuhun, toinen matalampi.',
    how: 'Puupalikan kolme moodia (1 : 1,58 : 2,42), vaimeneminen alle 50 ms, 6 ms kohinaisku; 150 ms välein.',
    voices: [
      { kind: 'modes', at: 0, f: 700, modes: block, attack: 0.0008, noise: { amp: 0.4, ms: 6, tone: 3000, seed: 11 } },
      { kind: 'modes', at: 0.15, f: 640, amp: 0.9, modes: block, attack: 0.0008, noise: { amp: 0.4, ms: 6, tone: 3000, seed: 12 } }] },
  { id: 'b2', family: 'B', name: 'Marimba', level: 1, dur: 0.65,
    desc: 'Kaksi marimbalyöntiä, E5 → A5.',
    how: 'Viritetyn puulaatan moodit (1 : 3,93 : 9,2) ja 3 ms kapulan kohina.',
    voices: [
      { kind: 'modes', at: 0, f: N.E5, amp: 0.85, modes: marimba, attack: 0.001, noise: { amp: 0.12, ms: 3, tone: 2500, seed: 21 } },
      { kind: 'modes', at: 0.11, f: N.A5, modes: marimba, attack: 0.001, noise: { amp: 0.12, ms: 3, tone: 2500, seed: 22 } }] },
  { id: 'b3', family: 'B', name: 'Lasi', level: 0.8, dur: 0.8,
    desc: 'Lusikka lasin reunaan, G6.',
    how: 'Lasin epäharmoniset moodit (1 : 2,32 : 4,25 : 6,63) ja 2 ms kirkas kohina.',
    voices: [{ kind: 'modes', at: 0, f: N.G6, modes: glass, attack: 0.001, noise: { amp: 0.08, ms: 2, tone: 8000, seed: 31 } }] },
  { id: 'b4', family: 'B', name: 'Pisara', level: 0.95, dur: 0.45,
    desc: 'Kaksi vesipisaraa, sävel nousee lyönnin aikana.',
    how: 'Yksi moodi, jonka sävel nousee 0,6 × f:stä f:ään 25 ms aikavakiolla; 900 ja 1200 Hz, 120 ms välein.',
    voices: [
      { kind: 'modes', at: 0, f: 900, modes: drop, attack: 0.001, glide: { from: 0.6, tau: 0.025 } },
      { kind: 'modes', at: 0.12, f: 1200, amp: 0.8, modes: drop, attack: 0.001, glide: { from: 0.6, tau: 0.025 } }] },
  { id: 'c1', family: 'C', name: 'Ovi', level: 1, dur: 0.75,
    desc: 'Kaksi kaarta: nouseva kvintti D5 → A5, ”ovi aukeaa”.',
    how: 'FM-malletti (kantaja = modulaattori, indeksi 1,4 → 0, 90 ms), toinen lyönti 90 ms myöhemmin päällekkäin.',
    voices: [mallet(0, N.D5, 0.85, 0.24), mallet(0.09, N.A5, 1, 0.3)] },
  { id: 'c2', family: 'C', name: 'Aurinko', level: 0.95, dur: 0.9,
    desc: 'Kaaret ja aurinko: D5, A5 ja F♯6 nopeana nousuna.',
    how: 'Sama FM-malletti kolmesti 80 ms välein, viimeinen soi pisimpään.',
    voices: [mallet(0, N.D5, 0.7, 0.2), mallet(0.08, N.A5, 0.8, 0.22), mallet(0.16, N.Fs6, 0.8, 0.32)] },
  { id: 'c3', family: 'C', name: 'Kaaret', level: 1, dur: 0.8,
    desc: 'Kaksi lomittuvaa kaarta yhtä aikaa: A4 ja E5 pehmeänä soinnun.',
    how: 'FM-malletti pienemmällä indeksillä (0,8) ja 20 ms iskulla, ylempi sävel 30 ms myöhemmin.',
    voices: [mallet(0, N.A4, 0.9, 0.32, { index: 0.8, attack: 0.02 }), mallet(0.03, N.E5, 0.8, 0.32, { index: 0.8, attack: 0.02 })] },
  { id: 'c4', family: 'C', name: 'Ilta', level: 1, dur: 0.75,
    desc: 'Laskeva kvintti A5 → D5: rauhallinen ”valmis”.',
    how: 'Ovi takaperin: sama FM-malletti, ylempi sävel ensin.',
    voices: [mallet(0, N.A5, 0.85, 0.24), mallet(0.1, N.D5, 1, 0.3)] },
];

export const RECOMMENDED = { family: 'C', sound: 'c1' };

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

const TAU = 2 * Math.PI;

function renderModes(v, out, sr) {
  const start = Math.round(v.at * sr), amp = v.amp ?? 1, attack = v.attack ?? 0.002;
  const phases = v.modes.map(() => 0);
  const rand = v.noise ? mulberry32(v.noise.seed ?? 1) : null;
  const lp = v.noise ? Math.exp(-TAU * v.noise.tone / sr) : 0;
  let noiseY = 0;
  for (let i = start; i < out.length; i++) {
    const t = (i - start) / sr;
    const env = 1 - Math.exp(-t / attack);
    const bend = v.glide ? 1 + (v.glide.from - 1) * Math.exp(-t / v.glide.tau) : 1;
    let s = 0;
    for (let m = 0; m < v.modes.length; m++) {
      const [ratio, a, decay] = v.modes[m];
      s += a * Math.exp(-t / decay) * Math.sin(phases[m]);
      phases[m] += TAU * v.f * ratio * bend / sr;
    }
    if (rand) {
      noiseY = (1 - lp) * (rand() * 2 - 1) + lp * noiseY;
      s += v.noise.amp * Math.exp(-t / (v.noise.ms / 1000)) * noiseY * 4;
    }
    out[i] += amp * env * s;
  }
}

function renderFm(v, out, sr) {
  const start = Math.round(v.at * sr), amp = v.amp ?? 1;
  let pc = 0, pm = 0;
  for (let i = start; i < out.length; i++) {
    const t = (i - start) / sr;
    const env = (1 - Math.exp(-t / v.attack)) * Math.exp(-t / v.decay);
    const index = v.index * Math.exp(-t / v.indexDecay);
    out[i] += amp * env * Math.sin(pc + index * Math.sin(pm));
    pc += TAU * v.f / sr;
    pm += TAU * v.f * v.ratio / sr;
  }
}

/** Renders one sound to mono samples in [-1, 1] at `sr` Hz. */
export function renderSound(sound, sr = SAMPLE_RATE) {
  const n = Math.round(sound.dur * sr);
  const mix = new Float64Array(n);
  for (const v of sound.voices) (v.kind === 'fm' ? renderFm : renderModes)(v, mix, sr);
  const fade = Math.round(RELEASE * n);
  for (let i = 0; i < fade; i++) mix[n - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / fade);
  let peak = 0;
  for (const x of mix) peak = Math.max(peak, Math.abs(x));
  const k = peak ? PEAK * (sound.level ?? 1) / peak : 0;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = mix[i] * k;
  return out;
}

/** Measures what the check asserts: length, peak, onset and tail. */
export function measure(samples, sr = SAMPLE_RATE) {
  let peak = 0, sum = 0;
  for (const x of samples) { peak = Math.max(peak, Math.abs(x)); sum += x * x; }
  const tailN = Math.round(0.01 * sr);
  let tail = 0;
  for (let i = samples.length - tailN; i < samples.length; i++) tail += samples[i] * samples[i];
  // Audible length: the last sample above -40 dB of the peak.
  let last = 0;
  for (let i = samples.length - 1; i >= 0; i--) if (Math.abs(samples[i]) > peak / 100) { last = i; break; }
  return {
    duration: samples.length / sr, audible: (last + 1) / sr, peak,
    rms: Math.sqrt(sum / samples.length), tailRms: Math.sqrt(tail / tailN), first: Math.abs(samples[0]),
  };
}

/** Gain for the person's volume setting (0–100): squared, so the slider feels even. */
export function volumeGain(volume, muted) {
  return muted ? 0 : Math.pow(Math.max(0, Math.min(100, volume)) / 100, 2);
}

/** 16-bit little-endian PCM, the form fingerprinted and written to WAV. */
export function toPcm16(samples) {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)));
  return pcm;
}
