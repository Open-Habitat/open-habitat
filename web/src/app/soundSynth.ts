// The attention sounds (attention-sound), rendered in the
// browser from their recipes. No audio file ships: each sound is a few dozen
// numbers, rendered once on first play in ~10–40 ms and kept for the page.
//
// This is the accepted prototype round's renderer
// (design-system/prototypes/rounds/2026-11-21-attention-sounds-4/synth.mjs),
// reduced to the `struck` voice and the ten sounds Jari kept (21.11.2026):
// every mode is split into two slightly detuned components (the beating and
// two-stage decay of a real object), weighted by the spectrum of the
// mallet's or finger's contact, given a thump and strike noise, passed
// through the body's resonances, damped, placed in a small room and
// loudness-normalised to −17 LUFS with a −3 dBFS ceiling. The short length
// is the same object damped sooner, never a long sound cut off.
//
// The arithmetic is the round's verbatim, in the same order, so each render
// is bit-identical to what Jari heard; soundSynth.test.ts fingerprints all
// twenty against the round's own fingerprints. Change a recipe only on
// purpose, and update those fingerprints with it.

export const SAMPLE_RATE = 48000;
const TARGET_LUFS = -17;
const PEAK_CEIL = 0.708; // −3 dBFS
const TAU = 2 * Math.PI;

export const soundIds = [
  "kalimba",
  "marimba",
  "vibrafoni",
  "tunnus-puu",
  "pisara",
  "lasit",
  "tuulikello",
  "kuplat",
  "kulho",
  "jaapuikot",
] as const;
export type SoundId = (typeof soundIds)[number];
export type SoundLength = "short" | "long";
export const defaultSound: SoundId = "kalimba";

export function isSoundId(value: unknown): value is SoundId {
  return (soundIds as readonly unknown[]).includes(value);
}

const NAMES: Record<string, number> = {
  C: -9,
  "C#": -8,
  D: -7,
  "D#": -6,
  E: -5,
  F: -4,
  "F#": -3,
  G: -2,
  "G#": -1,
  A: 0,
  "A#": 1,
  B: 2,
};
/** 'F#5' → Hz (A4 = 440, equal temperament). */
const hz = (n: string) => {
  const m = /^([A-G]#?)(\d)$/.exec(n) as RegExpExecArray;
  return 440 * 2 ** ((NAMES[m[1]] + 12 * (Number(m[2]) - 4)) / 12);
};

/** [ratio, amplitude, decay time constant (s), attack (s, optional)]. */
type Mode = [number, number, number, number?];
type Noise = { f: number; ms: number; amp: number; seed: number; q: number };
type Voice = {
  at: number;
  f: number;
  modes: Mode[];
  attack: number;
  amp?: number;
  pan?: number;
  width?: number;
  contact?: number;
  thump?: { ms: number; amp: number };
  split?: { cents: number; level: number; decay: number };
  jitter?: number;
  seed?: number;
  strike?: Noise;
  tremolo?: { rate: number; depth: number };
  pitch?: { from: number; tau: number };
  rise?: number;
};
type Room = { taps: [number, number, boolean][]; tone?: number };
type Recipe = {
  dur: number;
  decays?: number;
  voices: Voice[];
  box?: [number, number, number][];
  early?: Room;
  damp?: { from: number; to: number };
  reverb?: { t60: number; mix: number; predelay?: number; damp?: number };
  fadeOut?: number;
};

const TINE: Mode[] = [
  [1, 1, 0.6],
  [5.95, 0.2, 0.06],
  [13.3, 0.05, 0.02],
  [0.5, 0.03, 0.35, 0.015],
];
const BAR: Mode[] = [
  [1, 1, 0.45],
  [3.99, 0.22, 0.075],
  [9.9, 0.045, 0.022],
  [1.0018, 0.3, 0.7, 0.012],
  [0.5, 0.045, 0.45, 0.02],
];
const VIBE: Mode[] = [
  [1, 1, 0.95],
  [4, 0.1, 0.22],
  [10, 0.015, 0.06],
  [1.0012, 0.32, 1.0, 0.015],
  [0.5, 0.04, 0.6, 0.02],
];
const DROPLET: Mode[] = [
  [1, 1, 0.075],
  [2.04, 0.06, 0.03],
  [0.5, 0.05, 0.06],
];
const GLASS5: Mode[] = [
  [1, 1, 0.65],
  [2.32, 0.24, 0.28],
  [4.25, 0.06, 0.11],
  [6.63, 0.018, 0.05],
  [0.5, 0.04, 0.35, 0.01],
];
const TUBE5: Mode[] = [
  [1, 1, 0.7],
  [2.756, 0.32, 0.28],
  [5.404, 0.1, 0.11],
  [8.933, 0.03, 0.05],
  [0.5, 0.03, 0.45, 0.01],
];
const BUBBLE5: Mode[] = [
  [1, 1, 0.04],
  [2.1, 0.03, 0.015],
];
const BOWL5: Mode[] = [
  [1, 1, 0.9],
  [2.74, 0.36, 0.5],
  [5.17, 0.09, 0.25],
  [8.4, 0.02, 0.1],
  [0.5, 0.06, 0.7, 0.02],
  [1.5, 0.015, 0.3, 0.02],
];
// A tapered ice rod: a free bar's modes pulled closer by the taper.
const ICE: Mode[] = [
  [1, 1, 0.42],
  [2.62, 0.26, 0.16],
  [4.95, 0.08, 0.06],
  [7.9, 0.025, 0.03],
  [0.5, 0.02, 0.25, 0.01],
];

const noise = (f: number, ms: number, amp: number, seed: number, q = 0.8) => ({
  f,
  ms,
  amp,
  seed,
  q,
});
const struck = (
  at: number,
  note: string | number,
  modes: Mode[],
  o: Partial<Voice> = {},
): Voice => ({
  at,
  f: typeof note === "string" ? hz(note) : note,
  modes,
  attack: 0.0015,
  ...o,
});
const S = <T>(short: boolean, s: T, l: T) => (short ? s : l);

// Small rooms: [delay ms, gain, from the same side?].
const ROOM5: Room = {
  taps: [
    [6.1, 0.2, true],
    [9.7, 0.17, false],
    [14.3, 0.14, true],
    [19.9, 0.12, false],
    [26.3, 0.09, true],
    [33.7, 0.07, false],
  ],
  tone: 3600,
};
// The Open Habitat motif: D5 → A5 and a soft F♯6.
const MOTIF5: [number, string, number, number][] = [
  [0, "D5", 0.85, -0.3],
  [0.12, "A5", 1, 0.2],
  [0.26, "F#6", 0.42, 0.05],
];

const recipes: Record<SoundId, (short: boolean) => Recipe> = {
  // Three tines of a thumb piano, B5 G5 D6, through the box's resonances.
  kalimba: (s) => ({
    dur: S(s, 0.72, 1.35),
    decays: S(s, 0.5, 1),
    voices: (
      [
        [0, "B5", 0.85, 0.35],
        [0.12, "G5", 0.8, -0.4],
        [0.24, "D6", 0.9, 0.15],
      ] as const
    ).map(([at, n, amp, pan], k) =>
      struck(at * S(s, 0.75, 1), n, TINE, {
        amp,
        pan,
        width: 0.25,
        contact: 0.45,
        thump: { ms: 3, amp: 0.35 },
        split: { cents: 3.5, level: 0.45, decay: 0.45 },
        jitter: 4,
        seed: 21 + k,
        strike: noise(1800, 4, 0.08, 21 + k),
      }),
    ),
    box: [
      [240, 4, 0.6],
      [520, 5, 0.35],
      [1150, 7, 0.15],
    ],
    early: ROOM5,
    damp: S(s, { from: 0.36, to: 0.64 }, { from: 0.82, to: 1.27 }),
    reverb: S(s, { t60: 0.42, mix: 0.16 }, { t60: 0.8, mix: 0.2 }),
    fadeOut: 0.06,
  }),
  // Three yarn-mallet strokes on rosewood bars, E5 G5 C6.
  marimba: (s) => ({
    dur: S(s, 0.7, 1.3),
    decays: S(s, 0.55, 1),
    voices: (
      [
        [0, "E5", 0.8, -0.35],
        [0.1, "G5", 0.85, 0],
        [0.2, "C6", 1, 0.35],
      ] as const
    ).map(([at, n, amp, pan], k) =>
      struck(at * S(s, 0.8, 1), n, BAR, {
        amp,
        pan,
        width: 0.15,
        contact: 1.1,
        thump: { ms: 2.5, amp: 0.25 },
        split: { cents: 1.5, level: 0.25, decay: 0.5 },
        jitter: 2,
        seed: 11 + k,
        strike: noise(1200, 5, 0.1, 11 + k),
      }),
    ),
    box: [[180, 3, 0.25]],
    early: ROOM5,
    damp: S(s, { from: 0.36, to: 0.63 }, { from: 0.72, to: 1.2 }),
    reverb: S(s, { t60: 0.42, mix: 0.17 }, { t60: 0.75, mix: 0.21 }),
    fadeOut: 0.06,
  }),
  // A soft third, F5 + A5, with the motor's slow vibrato.
  vibrafoni: (s) => ({
    dur: S(s, 0.78, 1.5),
    decays: S(s, 0.5, 1),
    voices: (
      [
        [0, "F5", 0.9, -0.3],
        [0.025, "A5", 0.8, 0.3],
      ] as const
    ).map(([at, n, amp, pan], k) =>
      struck(at, n, VIBE, {
        amp,
        pan,
        width: 0.15,
        contact: 0.9,
        tremolo: { rate: 5.5, depth: 0.35 },
        split: { cents: 1, level: 0.3, decay: 0.6 },
        jitter: 1.5,
        seed: 41 + k,
        thump: { ms: 2, amp: 0.15 },
        strike: noise(1500, 3, 0.07, 41 + k),
      }),
    ),
    early: ROOM5,
    damp: S(s, { from: 0.4, to: 0.7 }, { from: 0.85, to: 1.4 }),
    reverb: S(s, { t60: 0.45, mix: 0.17 }, { t60: 0.85, mix: 0.2 }),
    fadeOut: 0.06,
  }),
  // The Habitat motif on the same marimba.
  "tunnus-puu": (s) => ({
    dur: S(s, 0.72, 1.3),
    decays: S(s, 0.55, 1),
    voices: MOTIF5.map(([at, n, amp, pan], k) =>
      struck(at * S(s, 0.79, 1), n, BAR, {
        amp,
        pan,
        width: 0.15,
        contact: 1.1,
        thump: { ms: 2.5, amp: 0.25 },
        split: { cents: 1.5, level: 0.25, decay: 0.5 },
        jitter: 2,
        seed: 141 + k,
        strike: noise(1300, 5, 0.1, 141 + k),
      }),
    ),
    box: [[180, 3, 0.25]],
    early: ROOM5,
    damp: S(s, { from: 0.4, to: 0.66 }, { from: 0.75, to: 1.2 }),
    reverb: S(s, { t60: 0.42, mix: 0.17 }, { t60: 0.78, mix: 0.2 }),
    fadeOut: 0.06,
  }),
  // Three drops into a stone basin: rising bubble resonances.
  pisara: (s) => ({
    dur: S(s, 0.68, 1.25),
    voices: (
      [
        [0, 1000, 1, -0.2, 0.018],
        [0.17, 1350, 0.65, 0.3, 0.016],
        [0.29, 1700, 0.35, 0.05, 0.014],
      ] as const
    ).map(([at, f, amp, pan, tau], k) =>
      struck(at * S(s, 0.85, 1), f, DROPLET, {
        amp,
        pan,
        width: 0.1,
        pitch: { from: 0.55, tau },
        rise: 0.6,
        jitter: 3,
        seed: 61 + k,
        strike: k < 2 ? noise(2600, 1, 0.04 - 0.01 * k, 61 + k) : undefined,
      }),
    ),
    early: {
      taps: [
        [11.3, 0.2, true],
        [19.7, 0.17, false],
        [31.1, 0.13, true],
        [43.9, 0.1, false],
        [61.3, 0.06, true],
      ],
      tone: 3000,
    },
    reverb: S(
      s,
      { t60: 0.45, mix: 0.3, predelay: 0.016 },
      { t60: 0.85, mix: 0.34, predelay: 0.018 },
    ),
    fadeOut: 0.06,
  }),
  // Two thin glasses clink, A5 and D6.
  lasit: (s) => ({
    dur: S(s, 0.78, 1.45),
    decays: S(s, 0.55, 1),
    voices: (
      [
        [0, "A5", 0.8, -0.25],
        [0.16, "D6", 0.7, 0.3],
      ] as const
    ).map(([at, n, amp, pan], k) =>
      struck(at * S(s, 0.8, 1), n, GLASS5, {
        amp,
        pan,
        width: 0.2,
        contact: 0.15,
        split: { cents: 4, level: 0.55, decay: 1 },
        jitter: 3,
        seed: 81 + k,
        strike: noise(2500, 1.5, 0.05, 81 + k),
      }),
    ),
    early: ROOM5,
    damp: S(s, { from: 0.4, to: 0.7 }, { from: 0.78, to: 1.3 }),
    reverb: S(s, { t60: 0.45, mix: 0.18 }, { t60: 0.8, mix: 0.22 }),
    fadeOut: 0.06,
  }),
  // Five pentatonic tubes swinging in the wind.
  tuulikello: (s) => ({
    dur: S(s, 0.78, 1.45),
    decays: S(s, 0.45, 1),
    voices: (
      [
        ["C6", 0.75, -0.1],
        ["E6", 0.55, 0.5],
        ["A5", 0.85, -0.55],
        ["D6", 0.5, 0.25],
        ["G5", 0.6, -0.3],
      ] as const
    ).map(([n, amp, pan], k) =>
      struck(
        S(s, [0, 0.05, 0.11, 0.16, 0.22], [0, 0.07, 0.16, 0.235, 0.34])[k],
        n,
        TUBE5,
        {
          amp,
          pan,
          width: 0.12,
          contact: 0.25,
          split: { cents: 3.6, level: 0.35, decay: 0.8 },
          jitter: 3,
          seed: 91 + k,
          strike: noise(3000, 1, 0.035, 91 + k),
        },
      ),
    ),
    early: {
      taps: [
        [13.1, 0.14, true],
        [21.7, 0.12, false],
        [33.3, 0.09, true],
        [52.9, 0.05, false],
      ],
      tone: 3300,
    },
    damp: S(s, { from: 0.42, to: 0.7 }, { from: 0.92, to: 1.33 }),
    reverb: S(s, { t60: 0.45, mix: 0.2 }, { t60: 0.9, mix: 0.24 }),
    fadeOut: 0.06,
  }),
  // Small bubbles rising to the surface; the long length has two late ones.
  kuplat: (s) => ({
    dur: S(s, 0.6, 1.2),
    voices: (
      [
        [0, 620, 0.9, -0.35],
        [0.03, 390, 0.35, 0.1, 0.06],
        [0.07, 820, 0.75, 0.3],
        [0.15, 700, 0.8, -0.05],
        [0.2, 980, 0.6, 0.45],
        ...(s
          ? []
          : [
              [0.42, 880, 0.35, -0.4],
              [0.58, 1080, 0.22, 0.3],
            ]),
      ] as [number, number, number, number, number?][]
    ).map(([at, f, amp, pan, d], k) =>
      struck(at, f, d ? [[1, 1, d]] : BUBBLE5, {
        amp,
        pan,
        pitch: { from: 0.6, tau: 0.01 },
        rise: 1.6,
        jitter: 4,
        seed: 121 + k,
      }),
    ),
    early: ROOM5,
    reverb: S(s, { t60: 0.38, mix: 0.22 }, { t60: 0.6, mix: 0.25 }),
    fadeOut: 0.06,
  }),
  // A singing bowl, one soft felt-mallet stroke, G4.
  kulho: (s) => ({
    dur: S(s, 0.8, 1.5),
    decays: S(s, 0.5, 1),
    voices: [
      struck(0, "G4", BOWL5, {
        amp: 1,
        pan: 0,
        width: 0.35,
        attack: 0.004,
        contact: 4,
        thump: { ms: 6, amp: 0.15 },
        split: { cents: 10, level: 0.8, decay: 1 },
        jitter: 2,
        seed: 101,
        strike: noise(900, 6, 0.06, 101),
      }),
    ],
    early: ROOM5,
    damp: S(s, { from: 0.42, to: 0.74 }, { from: 0.75, to: 1.36 }),
    reverb: S(s, { t60: 0.5, mix: 0.2 }, { t60: 0.95, mix: 0.25 }),
    fadeOut: 0.06,
  }),
  // Three icicles tapped in a falling line, E6 C6 A5, the neighbours ringing along.
  jaapuikot: (s) => {
    const notes = [
      ["E6", 0.6, 0.35],
      ["C6", 0.7, -0.1],
      ["A5", 0.85, -0.35],
    ] as const;
    return {
      dur: S(s, 0.72, 1.38),
      decays: S(s, 0.55, 1),
      voices: notes.map(([n, amp, pan], k) =>
        struck(
          k * S(s, 0.1, 0.13),
          n,
          [
            ...ICE,
            // Sympathetic ringing: the neighbours sound faintly, swelling in.
            ...notes
              .filter((_, j) => j !== k)
              .map(([m]): Mode => [hz(m) / hz(n), 0.05, 0.3, 0.02]),
          ],
          {
            amp,
            pan,
            width: 0.15,
            contact: 0.12,
            split: { cents: 6, level: 0.5, decay: 0.7 },
            jitter: 8,
            seed: 211 + k,
            strike: noise(3200, 1, 0.035, 211 + k, 1.2),
          },
        ),
      ),
      early: {
        taps: [
          [9.1, 0.15, true],
          [15.9, 0.12, false],
          [24.7, 0.09, true],
          [41.3, 0.05, false],
        ],
        tone: 3300,
      },
      damp: S(s, { from: 0.38, to: 0.66 }, { from: 0.75, to: 1.24 }),
      reverb: S(s, { t60: 0.42, mix: 0.2 }, { t60: 0.8, mix: 0.24 }),
      fadeOut: 0.06,
    };
  },
};

function recipe(id: SoundId, length: SoundLength) {
  return recipes[id](length === "short");
}

/** One strike of a sound: its onset, strength and how long its ripple runs. */
export type Strike = { at: number; amp: number; ring: number };

/** The strikes of a sound in a length, for the emblem's ripples. */
export function soundStrikes(id: SoundId, length: SoundLength): Strike[] {
  const r = recipe(id, length);
  return r.voices.map((v) => ({
    at: v.at,
    amp: v.amp ?? 1,
    ring: Math.max(0.5, (r.dur - v.at) * (length === "short" ? 1.1 : 0.85)),
  }));
}

/** How long a sound plays, in seconds. */
export function soundDuration(id: SoundId, length: SoundLength) {
  return recipe(id, length).dur;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };
/** RBJ cookbook biquad coefficients. */
function biquad(
  type: "lp" | "hp" | "bp",
  f: number,
  q: number,
  sr = SAMPLE_RATE,
): Biquad {
  const w = (TAU * f) / sr;
  const cw = Math.cos(w);
  const al = Math.sin(w) / (2 * q);
  let b0: number;
  let b1: number;
  let b2: number;
  if (type === "lp") {
    b0 = (1 - cw) / 2;
    b1 = 1 - cw;
    b2 = b0;
  } else if (type === "hp") {
    b0 = (1 + cw) / 2;
    b1 = -(1 + cw);
    b2 = b0;
  } else {
    // band-pass, 0 dB peak
    b0 = al;
    b1 = 0;
    b2 = -al;
  }
  const a0 = 1 + al;
  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: (-2 * cw) / a0,
    a2: (1 - al) / a0,
  };
}
function filter(x: Float64Array, c: Biquad) {
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = y;
    x[i] = y;
  }
}
const panGains = (p = 0): [number, number] => {
  const a = ((Math.max(-1, Math.min(1, p)) + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
};
const rcos = (t: number, len: number) =>
  t <= 0 ? 0 : t >= len ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * t) / len);

// Each mode becomes one or two components (`split`), each slightly detuned
// at random (`jitter`, seeded so the render is reproducible), weighted by the
// spectrum of the contact force (`contact`), and panned a little to
// alternate sides (`width`). The contact pulse itself (`thump`) and
// band-passed strike noise are added at the onset. `decays` scales every
// decay time: the short length of a sound is the same object, damped sooner.
function renderStruck(
  v: Voice,
  L: Float64Array,
  R: Float64Array,
  sr: number,
  decays = 1,
) {
  const start = Math.round(v.at * sr);
  const amp = v.amp ?? 1;
  const n = L.length;
  const rand = mulberry32(v.seed ?? 1);
  const gauss = () => {
    const u = rand() || 1e-9;
    const w = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * w);
  };
  const tc = (v.contact ?? 0) / 1000;
  // A half-sine contact force of length tc falls 12 dB/octave above ~0.6/tc.
  const weight = (f: number) =>
    tc ? 1 / Math.sqrt(1 + ((f * tc) / 0.6) ** 4) : 1;
  const w0 = weight(v.f);
  const comps: {
    r: number;
    a: number;
    k: number;
    g: [number, number];
    att?: number;
  }[] = [];
  v.modes.forEach(([ratio, a, decay, att], m) => {
    const cents = (v.jitter ?? 0) * gauss() * (m ? 1 : 0.3);
    const r = ratio * 2 ** (cents / 1200);
    const side = m % 2 ? 1 : -1;
    const base = (a * weight(v.f * r)) / w0;
    const p = (v.pan ?? 0) + side * (v.width ?? 0);
    comps.push({
      r,
      a: base,
      k: Math.exp(-1 / (decay * decays * sr)),
      g: panGains(p),
      att,
    });
    if (v.split) {
      // The partner: a few cents away (direction at random), on the other
      // side, with its own decay. Its beating and decay are the object's
      // asymmetry.
      const c2 = v.split.cents * (0.7 + 0.6 * rand()) * (rand() < 0.5 ? -1 : 1);
      comps.push({
        r: r * 2 ** (c2 / 1200),
        a: base * v.split.level,
        k: Math.exp(-1 / (decay * decays * v.split.decay * sr)),
        g: panGains((v.pan ?? 0) - side * (v.width ?? 0)),
        att,
      });
    }
  });
  const [gl, gr] = panGains(v.pan);
  let noiseBuf: Float64Array | null = null;
  if (v.strike) {
    const nr = mulberry32(v.strike.seed);
    const c = biquad("bp", v.strike.f, v.strike.q, sr);
    const len = Math.min(n - start, Math.round((v.strike.ms / 1000) * sr * 8));
    noiseBuf = new Float64Array(Math.max(0, len));
    for (let i = 0; i < noiseBuf.length; i++)
      noiseBuf[i] =
        (nr() * 2 - 1) *
        Math.exp(-i / ((v.strike.ms / 1000) * sr)) *
        rcos(i / sr, 0.0003);
    filter(noiseBuf, c);
  }
  const thumpN = v.thump ? Math.round((v.thump.ms / 1000) * sr) : 0;
  const env = comps.map(() => 1);
  const phase = comps.map(() => 0);
  const trem = v.tremolo;
  for (let i = start; i < n; i++) {
    const t = (i - start) / sr;
    let bend = v.pitch
      ? 1 + (v.pitch.from - 1) * Math.exp(-t / v.pitch.tau)
      : 1;
    if (v.rise) bend *= 1 + v.rise * t;
    const att = rcos(t, v.attack);
    const tr = trem
      ? 1 - trem.depth * (0.5 - 0.5 * Math.cos(TAU * trem.rate * t))
      : 1;
    let l = 0;
    let r = 0;
    for (let m = 0; m < comps.length; m++) {
      const c = comps[m];
      if (env[m] < 1e-7) continue;
      const s =
        (c.att ? c.a * rcos(t, c.att) : c.a) * env[m] * Math.sin(phase[m]);
      l += s * c.g[0];
      r += s * c.g[1];
      env[m] *= c.k;
      phase[m] += (TAU * v.f * c.r * bend) / sr;
    }
    const k = amp * att * tr;
    L[i] += l * k;
    R[i] += r * k;
    const j = i - start;
    if (noiseBuf && v.strike && j < noiseBuf.length) {
      const s = amp * v.strike.amp * 6 * noiseBuf[j];
      L[i] += s * gl;
      R[i] += s * gr;
    }
    if (v.thump && j < thumpN) {
      const s = amp * v.thump.amp * Math.sin((Math.PI * j) / thumpN);
      L[i] += s * gl;
      R[i] += s * gr;
    }
  }
}

// The body: resonant band-pass filters [Hz, Q, gain] through which the
// whole dry sound passes, added to it.
function box(
  L: Float64Array,
  R: Float64Array,
  rows: [number, number, number][],
  sr: number,
) {
  for (const ch of [L, R]) {
    const wet = new Float64Array(ch.length);
    for (const [f, q, g] of rows) {
      const x = Float64Array.from(ch);
      filter(x, biquad("bp", f, q, sr));
      for (let i = 0; i < x.length; i++) wet[i] += g * x[i];
    }
    for (let i = 0; i < ch.length; i++) ch[i] += wet[i];
  }
}

// Early reflections: each output side sums a few short taps of the same or
// the opposite input side, through a one-pole low-pass.
function early(L: Float64Array, R: Float64Array, o: Room, sr: number) {
  const n = L.length;
  const k = Math.exp((-TAU * (o.tone ?? 4000)) / sr);
  const srcL = Float64Array.from(L);
  const srcR = Float64Array.from(R);
  for (const [side, out] of [
    [0, L],
    [1, R],
  ] as const) {
    const taps = o.taps.map(([ms, g, same]) => ({
      d: Math.round((ms / 1000) * sr * (side ? 1.09 : 1)),
      g,
      from: (same ? side : 1 - side) === 0 ? srcL : srcR,
    }));
    let z = 0;
    for (let i = 0; i < n; i++) {
      let x = 0;
      for (const t of taps) if (i >= t.d) x += t.g * t.from[i - t.d];
      z = (1 - k) * x + k * z;
      out[i] += z;
    }
  }
}

// Damping of the dry sound: 1 until `from`, then exp(−((t − from)/s)²) with
// s set so the gain is −60 dB at `to`, 0 after.
function damp(
  L: Float64Array,
  R: Float64Array,
  o: { from: number; to: number },
  sr: number,
) {
  const s = (o.to - o.from) / Math.sqrt(Math.log(1000));
  for (let i = Math.round(o.from * sr); i < L.length; i++) {
    const t = i / sr;
    const g = t >= o.to ? 0 : Math.exp(-(((t - o.from) / s) ** 2));
    L[i] *= g;
    R[i] *= g;
  }
}

// 8-line feedback delay network with a Householder matrix, a one-pole
// low-pass in each loop and two Schroeder allpasses before it.
const FDN_LENGTHS = [1433, 1601, 1867, 2053, 2251, 2399, 2677, 2969];
function reverb(
  L: Float64Array,
  R: Float64Array,
  o: { t60: number; mix: number; predelay?: number; damp?: number },
  sr: number,
) {
  const n = L.length;
  const N = FDN_LENGTHS.length;
  const pre = Math.round((o.predelay ?? 0.012) * sr);
  const dampK = Math.exp((-TAU * (o.damp ?? 4500)) / sr);
  const lines = FDN_LENGTHS.map((len) => ({
    len,
    buf: new Float64Array(len),
    w: 0,
    z: 0,
    g: 10 ** ((-3 * len) / (o.t60 * sr)),
  }));
  const aps = (
    [
      [142, 0.6],
      [107, 0.6],
    ] as const
  ).map(([len, g]) => ({ len, g, buf: new Float64Array(len), w: 0 }));
  const wetL = new Float64Array(n);
  const wetR = new Float64Array(n);
  const outs = new Float64Array(N);
  for (let i = 0; i < n; i++) {
    let x = i >= pre ? 0.5 * (L[i - pre] + R[i - pre]) : 0;
    for (const a of aps) {
      const d = a.buf[a.w];
      const y = -a.g * x + d;
      a.buf[a.w] = x + a.g * y;
      a.w = (a.w + 1) % a.len;
      x = y;
    }
    let sum = 0;
    for (let j = 0; j < N; j++) {
      const ln = lines[j];
      ln.z = (1 - dampK) * ln.buf[ln.w] + dampK * ln.z;
      outs[j] = ln.z * ln.g;
      sum += outs[j];
    }
    const hh = (2 / N) * sum;
    let l = 0;
    let r = 0;
    for (let j = 0; j < N; j++) {
      const ln = lines[j];
      ln.buf[ln.w] = outs[j] - hh + (j % 2 ? -x : x);
      ln.w = (ln.w + 1) % ln.len;
      if (j % 2) r += (j % 4 === 1 ? 1 : -1) * outs[j];
      else l += (j % 4 === 0 ? 1 : -1) * outs[j];
    }
    wetL[i] = l * 0.5;
    wetR[i] = r * 0.5;
  }
  for (let i = 0; i < n; i++) {
    L[i] += o.mix * wetL[i];
    R[i] += o.mix * wetR[i];
  }
}

// ITU-R BS.1770 K-weighting at 48 kHz.
const K1: Biquad = {
  b0: 1.53512485958697,
  b1: -2.69169618940638,
  b2: 1.19839281085285,
  a1: -1.69065929318241,
  a2: 0.73248077421585,
};
const K2: Biquad = {
  b0: 1,
  b1: -2,
  b2: 1,
  a1: -1.99004745483398,
  a2: 0.99007225036621,
};
/** Maximum momentary loudness (400 ms window, 10 ms hop) in LUFS. */
function momentaryMax(L: Float64Array, R: Float64Array) {
  const n = L.length;
  const W = Math.round(0.4 * SAMPLE_RATE);
  const hop = Math.round(0.01 * SAMPLE_RATE);
  const cum = new Float64Array(n + 1);
  for (const ch of [L, R]) {
    const x = Float64Array.from(ch);
    filter(x, K1);
    filter(x, K2);
    for (let i = 0; i < n; i++) cum[i + 1] += x[i] * x[i];
  }
  for (let i = 0; i < n; i++) cum[i + 1] += cum[i];
  let best = 0;
  for (let e = hop; e < n + W; e += hop) {
    const a = Math.max(0, e - W);
    const b = Math.min(n, e);
    best = Math.max(best, (cum[b] - cum[a]) / W);
  }
  return best > 0 ? -0.691 + 10 * Math.log10(best) : Number.NEGATIVE_INFINITY;
}

export type RenderedSound = { left: Float32Array; right: Float32Array };

/** Renders one sound to a 48 kHz stereo pair, mastered and loudness-normalised. */
export function renderSound(id: SoundId, length: SoundLength): RenderedSound {
  const sound = recipe(id, length);
  const sr = SAMPLE_RATE;
  const n = Math.round(sound.dur * sr);
  const L = new Float64Array(n);
  const R = new Float64Array(n);
  for (const v of sound.voices) renderStruck(v, L, R, sr, sound.decays);
  if (sound.box) box(L, R, sound.box, sr);
  if (sound.damp) damp(L, R, sound.damp, sr);
  if (sound.early) early(L, R, sound.early, sr);
  if (sound.reverb) reverb(L, R, sound.reverb, sr);
  for (const ch of [L, R]) {
    // biome-ignore lint/suspicious/noApproximativeNumericConstant: the accepted renders use 0.707 exactly; Math.SQRT1_2 would change every fingerprint
    filter(ch, biquad("hp", 90, 0.707));
    filter(ch, biquad("lp", 6500, 0.5412));
    filter(ch, biquad("lp", 6500, 1.3066));
  }
  const fin = Math.round(0.002 * sr);
  const fout = Math.round((sound.fadeOut ?? 0.18) * sr);
  for (const ch of [L, R]) {
    for (let i = 0; i < fin; i++)
      ch[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fin);
    for (let i = 0; i < fout; i++)
      ch[n - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fout);
    ch[0] = 0;
    ch[n - 1] = 0;
  }
  const lufs = momentaryMax(L, R);
  let peak = 0;
  for (let i = 0; i < n; i++)
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  let gain = 10 ** ((TARGET_LUFS - lufs) / 20);
  if (peak * gain > PEAK_CEIL) gain = PEAK_CEIL / peak;
  return {
    left: Float32Array.from(L, (x) => x * gain),
    right: Float32Array.from(R, (x) => x * gain),
  };
}

/** Gain for this device's volume (0–100): squared, so the slider feels even. */
export function volumeGain(volume: number) {
  return (Math.max(0, Math.min(100, volume)) / 100) ** 2;
}
