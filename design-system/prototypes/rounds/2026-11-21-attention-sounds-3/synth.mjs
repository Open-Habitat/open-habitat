// Attention sounds, round 3 (issue attention-sound): polish of the sounds Jari
// accepted from round 2, plus a few new candidates in the styles that worked.
//
// The renderer is round 2's modal voice (struck objects as banks of damped
// partials with a band-passed noise strike), equal-power panning, its 8-line
// feedback delay network, a 90 Hz high-pass, a 6.5 kHz low-pass and loudness
// normalisation to the K-weighted momentary maximum. Round 2's fm, pluck, pad
// and noise voices and its echo are gone because no kept or new sound uses
// them. Four additions are all opt-in, so round 2's recipes still
// render to the same samples and the "before" side of every pair is exactly
// what Jari heard:
//
//   per-mode attack   a fourth element in a mode row lets that partial swell in
//                     instead of starting at the strike: a marimba or vibraphone
//                     resonator tube, a kalimba's box, the body of a bowl
//   body              fixed-frequency resonances (Hz, not ratios) excited by
//                     every strike, like the box under a kalimba's tines
//   early             a handful of short, low-passed, cross-fed reflections
//                     (7–29 ms) before the reverb: the walls of a small room,
//                     which is what gives a dry strike its place in stereo
//   damp              a smooth damping of the dry sound, Gaussian in time (so a
//                     parabola in decibels): nothing for `from` seconds, then
//                     ever faster, reaching −60 dB at `to`. A struck bowl or
//                     glass that is touched after it rings dies like this; a
//                     raised-cosine fade over the last few hundred milliseconds
//                     instead falls off a cliff in decibels, which is the "into
//                     a wall" ending Jari heard in Kulho and Lasit.
//
// A polished recipe damps its dry sound early enough, and sets a reverb T60
// short enough, that the room has died away on its own before the end of the
// buffer: the final 80–120 ms fade is only a guard against a stray sample, and
// render.mjs proves it by measuring the tail before the fade as well as after.

export const SAMPLE_RATE = 48000;
export const MAX_DUR = 1.6;
export const TARGET_LUFS = -17;
export const PEAK_CEIL = 0.708; // −3 dBFS
export const TAIL_CEIL = 0.00316; // −50 dBFS: the last 50 ms of a finished sound
export const RAW_TAIL_CEIL = 0.0056; // −45 dBFS: the same 50 ms before the final fade
const TAU = 2 * Math.PI;

const NAMES = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };
/** 'F#5' → Hz (A4 = 440, equal temperament). */
export const hz = (n) => {
  const m = /^([A-G]#?)(\d)$/.exec(n);
  return 440 * Math.pow(2, (NAMES[m[1]] + 12 * (Number(m[2]) - 4)) / 12);
};

// ---------- Recipes ----------

// Physical or measured partial ratios: [ratio, amplitude, decay time constant (s), attack (s, optional)].
// Round 2's tables, unchanged: the "before" recipes below use them.
const MARIMBA = [[1, 1, 0.42], [3.99, 0.2, 0.07], [9.9, 0.035, 0.02]];
const KALIMBA = [[1, 1, 0.55], [5.95, 0.16, 0.05], [13.3, 0.03, 0.015]];
const VIBES = [[1, 1, 0.85], [4, 0.1, 0.22], [10, 0.015, 0.06]];
const GLASS = [[1, 1, 0.65], [1.0024, 0.55, 0.65], [2.32, 0.22, 0.28], [2.326, 0.16, 0.28], [4.25, 0.05, 0.11], [6.63, 0.015, 0.05]];
const TUBE = [[1, 1, 0.7], [2.756, 0.32, 0.28], [5.404, 0.1, 0.11], [8.933, 0.03, 0.05]];
const BOWL = [[1, 1, 0.9], [1.006, 0.8, 0.9], [2.74, 0.34, 0.5], [2.748, 0.24, 0.5], [5.17, 0.08, 0.25], [5.19, 0.06, 0.25], [8.4, 0.018, 0.1]];
const DROP = [[1, 1, 0.075], [2.04, 0.06, 0.03]];
const BUBBLE = [[1, 1, 0.04]];

// Round 3's richer tables. Each keeps round 2's partials and adds what the
// object's body contributes: a resonator that swells in on the fundamental, a
// close partner that beats slowly (spread to the other side), and a soft low
// partial an octave down, far below the strike in level, which gives weight
// without loudness (the K-weighted meter barely counts it, so normalisation
// does not turn the sound down for it).
const MARIMBA_3 = [...MARIMBA, [1.0018, 0.32, 0.7, 0.012], [0.5, 0.045, 0.45, 0.02]];
const KALIMBA_3 = [...KALIMBA, [1.0032, 0.28, 0.6, 0.006], [0.5, 0.035, 0.4, 0.015]];
const VIBES_3 = [...VIBES, [1.0012, 0.34, 1.0, 0.015], [0.5, 0.04, 0.6, 0.02]];
const GLASS_3 = [...GLASS, [0.5, 0.04, 0.35, 0.01]];
const TUBE_3 = [...TUBE, [1.0021, 0.35, 0.7, 0.004], [0.5, 0.03, 0.45, 0.01]];
const BOWL_3 = [...BOWL, [0.5, 0.06, 0.7, 0.02], [1.003, 0.25, 1.0, 0.03]];
const DROP_3 = [...DROP, [0.5, 0.05, 0.06]];
// New candidates.
const TONGUE = [[1, 1, 0.65], [1.0025, 0.3, 0.7, 0.01], [2.0, 0.28, 0.32], [3.01, 0.07, 0.12], [0.5, 0.05, 0.5, 0.02]];
const ICICLE = [[1, 1, 0.38], [1.0028, 0.4, 0.38], [2.756, 0.2, 0.14], [5.404, 0.05, 0.05], [0.5, 0.025, 0.25, 0.01]];
const PLOP = [[1, 1, 0.09], [1.9, 0.08, 0.04]];

/**
 * A plucked string as modes: harmonics h·√(1 + B·h²) (slight stiffness), the
 * amplitude a pluck at fraction `p` of the length gives, |sin(π·h·p)| / h^roll,
 * and higher harmonics dying faster. This is the model round 2's Karplus–Strong
 * kantele approximated with a delay line; as modes the tone stays clean and
 * round, which is what a harp or nylon string sounds like through a laptop.
 */
const string = (p, H, T, roll = 1, B = 0.0003) => Array.from({ length: H }, (_, k) => {
  const h = k + 1;
  return [h * Math.sqrt(1 + B * h * h), Math.abs(Math.sin(Math.PI * h * p)) / Math.pow(h, roll) / Math.abs(Math.sin(Math.PI * p)), T / (1 + 0.55 * (h - 1))];
});

const strike = (f, ms, amp, seed, q = 0.8) => ({ f, ms, amp, seed, q });
const modal = (at, note, modes, o = {}) => ({ kind: 'modal', at, f: typeof note === 'string' ? hz(note) : note, modes, attack: 0.0015, ...o });

// Early reflections of a small room: [delay ms, gain, from the same side?].
const ROOM = { taps: [[7.3, 0.22, true], [11.9, 0.18, false], [17.1, 0.15, true], [23.3, 0.12, false], [29.1, 0.09, true]], tone: 3800 };

// The Open Habitat motif: the mark's two arches as a rising fifth, D5 → A5,
// and the sun above them as a soft F♯6.
const MOTIF = [[0, 'D5', 0.85, -0.3], [0.12, 'A5', 1, 0.2], [0.26, 'F#6', 0.42, 0.05]];

// Round 2's recipes for the kept sounds, verbatim except for id, name and the
// `before` mark, so the comparison plays what Jari judged on 21.11.
const R2 = {
  marimba: { dur: 1.1, voices: [
    modal(0, 'E5', MARIMBA, { amp: 0.8, pan: -0.35, strike: strike(1200, 5, 0.12, 11) }),
    modal(0.1, 'G5', MARIMBA, { amp: 0.85, pan: 0, strike: strike(1300, 5, 0.12, 12) }),
    modal(0.2, 'C6', MARIMBA, { amp: 1, pan: 0.35, strike: strike(1400, 5, 0.12, 13) })],
    reverb: { t60: 0.7, mix: 0.2 } },
  kalimba: { dur: 1.1, voices: [
    modal(0, 'B5', KALIMBA, { amp: 0.85, pan: 0.25, strike: strike(1800, 4, 0.1, 21) }),
    modal(0.12, 'G5', KALIMBA, { amp: 0.8, pan: -0.3, strike: strike(1700, 4, 0.1, 22) }),
    modal(0.24, 'D6', KALIMBA, { amp: 0.9, pan: 0.1, strike: strike(1900, 4, 0.1, 23) })],
    reverb: { t60: 0.8, mix: 0.18 } },
  vibrafoni: { dur: 1.2, voices: [
    modal(0, 'F5', VIBES, { amp: 0.9, pan: -0.3, tremolo: { rate: 5.5, depth: 0.35 }, strike: strike(1500, 3, 0.08, 41) }),
    modal(0.025, 'A5', VIBES, { amp: 0.8, pan: 0.3, tremolo: { rate: 5.5, depth: 0.35 }, strike: strike(1600, 3, 0.08, 42) })],
    reverb: { t60: 0.9, mix: 0.2 }, fadeOut: 0.3 },
  pisara: { dur: 1.0, voices: [
    modal(0, 1000, DROP, { amp: 1, pan: -0.2, glide: { from: 0.55, tau: 0.018 }, strike: strike(2600, 1, 0.04, 61) }),
    modal(0.17, 1350, DROP, { amp: 0.65, pan: 0.3, glide: { from: 0.55, tau: 0.016 }, strike: strike(2800, 1, 0.03, 62) }),
    modal(0.29, 1700, DROP, { amp: 0.35, pan: 0.05, glide: { from: 0.6, tau: 0.014 } })],
    reverb: { t60: 1.1, mix: 0.35, predelay: 0.018 } },
  lasit: { dur: 1.15, voices: [
    modal(0, 'A5', GLASS, { amp: 0.8, pan: -0.25, spread: 0.2, strike: strike(2500, 1.5, 0.05, 81) }),
    modal(0.16, 'D6', GLASS, { amp: 0.7, pan: 0.3, spread: 0.2, strike: strike(2700, 1.5, 0.05, 82) })],
    reverb: { t60: 1.0, mix: 0.22 }, fadeOut: 0.25 },
  tuulikello: { dur: 1.2, voices: [
    modal(0, 'C6', TUBE, { amp: 0.75, pan: -0.1, strike: strike(3000, 1, 0.04, 91) }),
    modal(0.07, 'E6', TUBE, { amp: 0.55, pan: 0.5, strike: strike(3000, 1, 0.04, 92) }),
    modal(0.16, 'A5', TUBE, { amp: 0.85, pan: -0.55, strike: strike(3000, 1, 0.04, 93) }),
    modal(0.235, 'D6', TUBE, { amp: 0.5, pan: 0.25, strike: strike(3000, 1, 0.04, 94) }),
    modal(0.34, 'G5', TUBE, { amp: 0.6, pan: -0.3, strike: strike(3000, 1, 0.04, 95) })],
    reverb: { t60: 1.2, mix: 0.25 }, fadeOut: 0.3 },
  kuplat: { dur: 0.9, voices: [
    modal(0, 620, BUBBLE, { amp: 0.9, pan: -0.35, glide: { from: 0.6, tau: 0.01 } }),
    modal(0.07, 820, BUBBLE, { amp: 0.75, pan: 0.3, glide: { from: 0.6, tau: 0.01 } }),
    modal(0.15, 700, BUBBLE, { amp: 0.8, pan: -0.05, glide: { from: 0.6, tau: 0.01 } }),
    modal(0.2, 980, BUBBLE, { amp: 0.6, pan: 0.45, glide: { from: 0.6, tau: 0.009 } })],
    reverb: { t60: 0.6, mix: 0.25 }, fadeOut: 0.15 },
  kulho: { dur: 1.2, voices: [modal(0, 'G4', BOWL, { amp: 1, pan: 0, spread: 0.35, attack: 0.006, strike: strike(900, 6, 0.08, 101) })],
    reverb: { t60: 1.4, mix: 0.25 }, fadeOut: 0.35 },
  'tunnus-puu': { dur: 1.1, voices: MOTIF.map(([at, n, amp, pan], k) => modal(at, n, MARIMBA, { amp, pan, strike: strike(1300, 5, 0.12, 141 + k) })),
    reverb: { t60: 0.8, mix: 0.2 } },
};

export const VIEWS = [
  { id: 'A', name: 'Ennen ja jälkeen', short: 'Ennen/jälkeen',
    line: 'Hyväksytyt yhdeksän ääntä hiottuina, kukin parina kierroksen 2 version kanssa: luonnollinen häivähdys, enemmän runkoa ja tilaa, sama äänekkyys.' },
  { id: 'B', name: 'Uudet ehdokkaat', short: 'Ehdokkaat',
    line: 'Viisi uutta ehdokasta toimineilla tyyleillä: kaksi näppäiltyä kieltä, sävelrumpu, kivi lampeen ja jääpuikot.' },
  { id: 'C', name: 'Koko valikoima', short: 'Valikoima',
    line: 'Kaikki tarjolle tulevat äänet siinä järjestyksessä kuin Asetukset ne näyttäisi, oletuksena Kalimba.' },
];

// The final set. `before` names round 2's version of a polished sound; a sound
// without it is a new candidate. Order is the order Settings would show.
const AFTER = [
  { id: 'kalimba', group: 'soitin', name: 'Kalimba', dur: 1.4,
    desc: 'Peukalopianon kolme kieltä: B5, G5, D6.',
    how: 'Kierroksen 2 teräskielen moodit (1 : 5,95 : 13,3) ja peukalon isku, lisäksi kielen hitaasti huojuva pari vastakkaisella puolella, puulaatikon kaksi resonanssia (240 ja 520 Hz) ja hento oktaavia matalampi osasävel; pienen huoneen varhaiset heijastukset, kaiku 0,8 s, vaimennus 0,75 s:sta alkaen.',
    voices: [
      modal(0, 'B5', KALIMBA_3, { amp: 0.85, pan: 0.35, spread: 0.3, strike: strike(1800, 4, 0.1, 21), body: [[240, 0.1, 0.14, 0.004], [520, 0.05, 0.08, 0.003]] }),
      modal(0.12, 'G5', KALIMBA_3, { amp: 0.8, pan: -0.4, spread: 0.3, strike: strike(1700, 4, 0.1, 22), body: [[240, 0.1, 0.14, 0.004], [520, 0.05, 0.08, 0.003]] }),
      modal(0.24, 'D6', KALIMBA_3, { amp: 0.9, pan: 0.15, spread: 0.3, strike: strike(1900, 4, 0.1, 23), body: [[240, 0.1, 0.14, 0.004], [520, 0.05, 0.08, 0.003]] })],
    early: ROOM, damp: { from: 0.75, to: 1.25 }, reverb: { t60: 0.8, mix: 0.2 }, fadeOut: 0.1 },
  { id: 'marimba', group: 'soitin', name: 'Marimba', dur: 1.35,
    desc: 'Kolme lankakapulan lyöntiä marimbaan: E5, G5, C6.',
    how: 'Kierroksen 2 ruusupuulaatan moodit ja kapulakohina, lisäksi resonaattoriputki, joka paisuu perussävelelle 12 ms:ssa ja soi pidempään, sekä hento alaoktaavi; varhaiset heijastukset, kaiku 0,75 s, vaimennus 0,7 s:sta alkaen.',
    voices: [
      modal(0, 'E5', MARIMBA_3, { amp: 0.8, pan: -0.35, spread: 0.15, strike: strike(1200, 5, 0.12, 11) }),
      modal(0.1, 'G5', MARIMBA_3, { amp: 0.85, pan: 0, spread: 0.15, strike: strike(1300, 5, 0.12, 12) }),
      modal(0.2, 'C6', MARIMBA_3, { amp: 1, pan: 0.35, spread: 0.15, strike: strike(1400, 5, 0.12, 13) })],
    early: ROOM, damp: { from: 0.7, to: 1.2 }, reverb: { t60: 0.75, mix: 0.22 }, fadeOut: 0.1 },
  { id: 'vibrafoni', group: 'soitin', name: 'Vibrafoni', dur: 1.55,
    desc: 'Vibrafonin pehmeä terssi F5 + A5, moottorin hidas värinä.',
    how: 'Kierroksen 2 alumiinilaatan moodit ja 5,5 Hz:n värinä, lisäksi resonaattoriputki perussävelellä ja hento alaoktaavi; varhaiset heijastukset, kaiku 0,85 s, pehmeä vaimennus 0,8 s:sta 1,4 s:iin, ei enää leikattua loppua.',
    voices: [
      modal(0, 'F5', VIBES_3, { amp: 0.9, pan: -0.3, spread: 0.15, tremolo: { rate: 5.5, depth: 0.35 }, strike: strike(1500, 3, 0.08, 41) }),
      modal(0.025, 'A5', VIBES_3, { amp: 0.8, pan: 0.3, spread: 0.15, tremolo: { rate: 5.5, depth: 0.35 }, strike: strike(1600, 3, 0.08, 42) })],
    early: ROOM, damp: { from: 0.8, to: 1.4 }, reverb: { t60: 0.85, mix: 0.2 }, fadeOut: 0.1 },
  { id: 'tunnus-puu', group: 'soitin', name: 'Tunnus puu', dur: 1.35,
    desc: 'Habitat-aihe marimballa: D5 → A5 ja pehmeä F♯6.',
    how: 'Sama hiottu marimba kuin yllä (resonaattori, alaoktaavi, huojuva pari), aihe 0 / 120 / 260 ms; varhaiset heijastukset, kaiku 0,8 s, vaimennus 0,75 s:sta alkaen.',
    voices: MOTIF.map(([at, n, amp, pan], k) => modal(at, n, MARIMBA_3, { amp, pan, spread: 0.15, strike: strike(1300, 5, 0.12, 141 + k) })),
    early: ROOM, damp: { from: 0.75, to: 1.22 }, reverb: { t60: 0.8, mix: 0.2 }, fadeOut: 0.1 },
  { id: 'pisara', group: 'luonto', name: 'Pisara', dur: 1.4,
    desc: 'Kolme vesipisaraa kiviseen altaaseen.',
    how: 'Kierroksen 2 kuplaresonanssit (1000, 1350, 1700 Hz, sävel nousee) ja roiske, lisäksi jokaisen pisaran alla hento matala ”plup”; luolan varhaiset heijastukset kauempana, kaiku 0,9 s eikä 1,1 s, jotta luola ehtii hiljentyä itse.',
    voices: [
      modal(0, 1000, DROP_3, { amp: 1, pan: -0.2, glide: { from: 0.55, tau: 0.018 }, strike: strike(2600, 1, 0.04, 61) }),
      modal(0.17, 1350, DROP_3, { amp: 0.65, pan: 0.3, glide: { from: 0.55, tau: 0.016 }, strike: strike(2800, 1, 0.03, 62) }),
      modal(0.29, 1700, DROP_3, { amp: 0.35, pan: 0.05, glide: { from: 0.6, tau: 0.014 } })],
    early: { taps: [[11.3, 0.2, true], [19.7, 0.17, false], [31.1, 0.13, true], [43.9, 0.1, false]], tone: 3200 },
    reverb: { t60: 0.9, mix: 0.35, predelay: 0.018 }, fadeOut: 0.1 },
  { id: 'lasit', group: 'luonto', name: 'Lasit', dur: 1.6,
    desc: 'Kaksi ohutta lasia kilahtaa: A5 ja D6.',
    how: 'Kierroksen 2 huojuvat lasimoodit ja isku, lisäksi hento alaoktaavi lasin rungoksi; lasit saavat soida 0,85 s ja hiljenevät sitten kuin sormi koskisi niitä (vaimennus 0,85 → 1,4 s), kaiku 0,85 s häipyy itsestään ennen loppua.',
    voices: [
      modal(0, 'A5', GLASS_3, { amp: 0.8, pan: -0.25, spread: 0.2, strike: strike(2500, 1.5, 0.05, 81) }),
      modal(0.16, 'D6', GLASS_3, { amp: 0.7, pan: 0.3, spread: 0.2, strike: strike(2700, 1.5, 0.05, 82) })],
    early: ROOM, damp: { from: 0.85, to: 1.4 }, reverb: { t60: 0.85, mix: 0.22 }, fadeOut: 0.1 },
  { id: 'tuulikello', group: 'luonto', name: 'Tuulikello', dur: 1.6,
    desc: 'Viisi putkea pentatonisessa vireessä heilahtaa tuulessa.',
    how: 'Kierroksen 2 vapaan tangon moodit, lisäksi jokaiselle putkelle huojuva pari ja hento alaoktaavi; ulkoilman heijastukset harvemmin, kaiku 1,0 s, vaimennus 1,0 → 1,45 s.',
    voices: [
      modal(0, 'C6', TUBE_3, { amp: 0.75, pan: -0.1, spread: 0.12, strike: strike(3000, 1, 0.04, 91) }),
      modal(0.07, 'E6', TUBE_3, { amp: 0.55, pan: 0.5, spread: 0.12, strike: strike(3000, 1, 0.04, 92) }),
      modal(0.16, 'A5', TUBE_3, { amp: 0.85, pan: -0.55, spread: 0.12, strike: strike(3000, 1, 0.04, 93) }),
      modal(0.235, 'D6', TUBE_3, { amp: 0.5, pan: 0.25, spread: 0.12, strike: strike(3000, 1, 0.04, 94) }),
      modal(0.34, 'G5', TUBE_3, { amp: 0.6, pan: -0.3, spread: 0.12, strike: strike(3000, 1, 0.04, 95) })],
    early: { taps: [[13.1, 0.14, true], [21.7, 0.12, false], [33.3, 0.09, true]], tone: 3500 },
    damp: { from: 1.0, to: 1.45 }, reverb: { t60: 1.0, mix: 0.25 }, fadeOut: 0.1 },
  { id: 'kuplat', group: 'luonto', name: 'Kuplat', dur: 1.1,
    desc: 'Neljä pientä kuplaa nousee pintaan.',
    how: 'Kierroksen 2 Minnaert-kuplat (620–980 Hz), lisäksi yksi isompi, matala kupla (390 Hz) pohjalla ja pienen altaan varhaiset heijastukset; kaiku 0,6 s, häivähdys ehtii loppuun.',
    voices: [
      modal(0, 620, BUBBLE, { amp: 0.9, pan: -0.35, glide: { from: 0.6, tau: 0.01 } }),
      modal(0.03, 390, [[1, 1, 0.06]], { amp: 0.35, pan: 0.1, glide: { from: 0.55, tau: 0.014 } }),
      modal(0.07, 820, BUBBLE, { amp: 0.75, pan: 0.3, glide: { from: 0.6, tau: 0.01 } }),
      modal(0.15, 700, BUBBLE, { amp: 0.8, pan: -0.05, glide: { from: 0.6, tau: 0.01 } }),
      modal(0.2, 980, BUBBLE, { amp: 0.6, pan: 0.45, glide: { from: 0.6, tau: 0.009 } })],
    early: ROOM, reverb: { t60: 0.6, mix: 0.25 }, fadeOut: 0.1 },
  { id: 'kulho', group: 'luonto', name: 'Kulho', dur: 1.6,
    desc: 'Laulava kulho, huopanuijan pehmeä lyönti, G4.',
    how: 'Kierroksen 2 huojuvat kulhomoodit ja huopaisku, lisäksi kulhon runko alaoktaavilla ja kolmas, hitaammin syttyvä huojuntapari; kulho soi täyteen 0,7 s ja hiljenee sitten pehmeästi kuin käsi laskeutuisi reunalle (vaimennus 0,7 → 1,4 s), kaiku 1,0 s eikä 1,4 s, jotta sali hiljenee itse ennen loppua.',
    voices: [modal(0, 'G4', BOWL_3, { amp: 1, pan: 0, spread: 0.35, attack: 0.006, strike: strike(900, 6, 0.08, 101) })],
    early: ROOM, damp: { from: 0.7, to: 1.4 }, reverb: { t60: 1.0, mix: 0.25 }, fadeOut: 0.12 },
  // ---- New candidates ----
  { id: 'savelrumpu', group: 'soitin', name: 'Sävelrumpu', dur: 1.5, isNew: true,
    desc: 'Teräksisen sävelrummun kaksi kieltä pehmeällä nuijalla: A4 → E5.',
    how: 'Kielen moodit lähes harmonisina (1 : 2 : 3,01), huojuva pari ja rummun kuoren alaoktaavi, 7 ms kumi-iskun kohina 700 Hz:llä; 160 ms välein; varhaiset heijastukset, kaiku 0,85 s, vaimennus 0,85 → 1,35 s.',
    voices: [
      modal(0, 'A4', TONGUE, { amp: 0.9, pan: -0.25, spread: 0.2, attack: 0.003, strike: strike(700, 7, 0.07, 171) }),
      modal(0.16, 'E5', TONGUE, { amp: 0.95, pan: 0.25, spread: 0.2, attack: 0.003, strike: strike(800, 7, 0.07, 172) })],
    early: ROOM, damp: { from: 0.85, to: 1.35 }, reverb: { t60: 0.85, mix: 0.2 }, fadeOut: 0.1 },
  { id: 'harppu', group: 'soitin', name: 'Harppu', dur: 1.5, isNew: true,
    desc: 'Harpun kolme kieltä nousevana murtona: C5, G5, E6.',
    how: 'Kielet moodeina: kahdeksan osasäveltä hieman venyneinä (jäykkyys), näppäys 30 %:n kohdalta, korkeat sammuvat ensin; 1,5 ms sormen kohina; 90 ms välein vasemmalta oikealle; varhaiset heijastukset, kaiku 0,9 s, vaimennus 0,85 → 1,35 s.',
    voices: [
      modal(0, 'C5', string(0.3, 8, 0.7, 1.15), { amp: 0.8, pan: -0.35, attack: 0.002, strike: strike(2000, 1.5, 0.04, 181) }),
      modal(0.09, 'G5', string(0.3, 8, 0.65, 1.15), { amp: 0.75, pan: 0, attack: 0.002, strike: strike(2200, 1.5, 0.04, 182) }),
      modal(0.18, 'E6', string(0.3, 4, 0.6, 1.4), { amp: 0.6, pan: 0.35, attack: 0.002, strike: strike(2400, 1.5, 0.035, 183) })],
    early: ROOM, damp: { from: 0.85, to: 1.35 }, reverb: { t60: 0.9, mix: 0.22 }, fadeOut: 0.1 },
  { id: 'kitara', group: 'soitin', name: 'Kitara', dur: 1.5, isNew: true,
    desc: 'Nailonkielisen kitaran pehmeä E-duurisointu sormilla sivellen.',
    how: 'Kielet moodeina kuten Harpussa mutta näppäys 22 %:n kohdalta ja pehmeämpi yläpää, E4 B4 E5 G♯5 22 ms välein, kopan kaksi resonanssia (205 ja 410 Hz); varhaiset heijastukset, kaiku 0,8 s, vaimennus 0,8 → 1,35 s.',
    voices: ['E4', 'B4', 'E5', 'G#5'].map((n, k) => modal(k * 0.022, n, string(0.22, 8, 0.8, 1.4), {
      amp: [0.7, 0.75, 0.7, 0.65][k], pan: -0.3 + 0.2 * k, attack: 0.002, strike: strike(1600, 1.5, 0.03, 191 + k),
      body: [[205, 0.12, 0.12, 0.004], [410, 0.06, 0.07, 0.003]] })),
    early: ROOM, damp: { from: 0.8, to: 1.35 }, reverb: { t60: 0.8, mix: 0.2 }, fadeOut: 0.1 },
  { id: 'kivi-lampeen', group: 'luonto', name: 'Kivi lampeen', dur: 1.3, isNew: true,
    desc: 'Pieni kivi putoaa lampeen, perässä kaksi kuplaa.',
    how: 'Matala Minnaert-kupla 300 Hz:ssä, jonka sävel nousee 0,5 × f:stä (”plump”), 4 ms roiskekohina 1,4 kHz:llä, sitten kaksi pientä kuplaa (760 ja 1050 Hz); ulkoilman heijastukset veden pinnasta, kaiku 0,7 s.',
    voices: [
      modal(0, 300, PLOP, { amp: 1, pan: -0.05, attack: 0.002, glide: { from: 0.5, tau: 0.03 }, strike: strike(1400, 4, 0.08, 201, 0.7) }),
      modal(0.16, 760, BUBBLE, { amp: 0.45, pan: 0.35, glide: { from: 0.6, tau: 0.01 } }),
      modal(0.27, 1050, BUBBLE, { amp: 0.3, pan: -0.3, glide: { from: 0.6, tau: 0.009 } })],
    early: { taps: [[9.7, 0.18, true], [16.3, 0.15, false], [27.1, 0.11, true]], tone: 3000 },
    reverb: { t60: 0.7, mix: 0.3, predelay: 0.015 }, fadeOut: 0.1 },
  { id: 'jaapuikot', group: 'luonto', name: 'Jääpuikot', dur: 1.45, isNew: true,
    desc: 'Kolme jääpuikkoa räystäällä, napautus laskevana: E6, C6, A5.',
    how: 'Ohuen tangon moodit (1 : 2,756 : 5,404) lyhyemmällä, kuulaammalla vaimenemisella kuin tuulikellossa, huojuva pari ja hento alaoktaavi; 1 ms napautus; 130 ms välein; ulkoilman heijastukset, kaiku 0,9 s, vaimennus 0,75 → 1,25 s.',
    voices: [
      modal(0, 'E6', ICICLE, { amp: 0.6, pan: 0.35, spread: 0.15, strike: strike(3200, 1, 0.035, 211) }),
      modal(0.13, 'C6', ICICLE, { amp: 0.7, pan: -0.1, spread: 0.15, strike: strike(3000, 1, 0.035, 212) }),
      modal(0.26, 'A5', ICICLE, { amp: 0.85, pan: -0.35, spread: 0.15, strike: strike(2800, 1, 0.035, 213) })],
    early: { taps: [[12.1, 0.15, true], [19.9, 0.12, false], [31.7, 0.09, true]], tone: 3500 },
    damp: { from: 0.75, to: 1.25 }, reverb: { t60: 0.9, mix: 0.25 }, fadeOut: 0.1 },
];
for (const s of AFTER) if (R2[s.id]) s.before = `r2-${s.id}`;

export const BEFORE = AFTER.filter(s => s.before).map(s => ({
  ...R2[s.id], id: s.before, name: `${s.name} (kierros 2)`, of: s.id, reference: true,
  desc: `Kierroksen 2 ${s.name} sellaisenaan: ${s.desc[0].toLowerCase()}${s.desc.slice(1)}`,
}));
export const SOUNDS = AFTER;
export const ALL = [...AFTER, ...BEFORE];
export const DEFAULT_SOUND = 'kalimba';


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

/** RBJ cookbook biquad coefficients. */
function biquad(type, f, q, sr = SAMPLE_RATE) {
  const w = TAU * f / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; } // band-pass, 0 dB peak
  const a0 = 1 + al;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: -2 * cw / a0, a2: (1 - al) / a0 };
}
function filter(x, c) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y;
  }
}
const panGains = (p = 0) => { const a = (Math.max(-1, Math.min(1, p)) + 1) * Math.PI / 4; return [Math.cos(a), Math.sin(a)]; };
const rcos = (t, len) => (t <= 0 ? 0 : t >= len ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * t / len));

function renderModal(v, L, R, sr) {
  const start = Math.round(v.at * sr), amp = v.amp ?? 1, n = L.length;
  // `body` rows are fixed-frequency resonances in Hz; they join the modes as
  // ratios of this note, so every strike excites the same box or shell.
  const rows = [...v.modes, ...(v.body ?? []).map(([f, a, decay, att]) => [f / v.f, a, decay, att])];
  const modes = rows.map(([ratio, a, decay, att], m) => {
    const p = (v.pan ?? 0) + (v.spread ? (m % 2 ? 1 : -1) * v.spread : 0);
    return { ratio, a, k: Math.exp(-1 / (decay * sr)), g: panGains(p), att };
  });
  const [gl, gr] = panGains(v.pan);
  let noise = null;
  if (v.strike) {
    const rand = mulberry32(v.strike.seed), c = biquad('bp', v.strike.f, v.strike.q, sr);
    const len = Math.min(n - start, Math.round(v.strike.ms / 1000 * sr * 8));
    noise = new Float64Array(Math.max(0, len));
    for (let i = 0; i < noise.length; i++) noise[i] = (rand() * 2 - 1) * Math.exp(-i / (v.strike.ms / 1000 * sr)) * rcos(i / sr, 0.0003);
    filter(noise, c);
  }
  const env = modes.map(() => 1), phase = modes.map(() => 0);
  const trem = v.tremolo;
  for (let i = start; i < n; i++) {
    const t = (i - start) / sr;
    const bend = v.glide ? 1 + (v.glide.from - 1) * Math.exp(-t / v.glide.tau) : 1;
    const att = rcos(t, v.attack);
    const tr = trem ? 1 - trem.depth * (0.5 - 0.5 * Math.cos(TAU * trem.rate * t)) : 1;
    let l = 0, r = 0;
    for (let m = 0; m < modes.length; m++) {
      const md = modes[m];
      // A row's own attack lets a resonator swell in after the strike.
      const s = (md.att ? md.a * rcos(t, md.att) : md.a) * env[m] * Math.sin(phase[m]);
      l += s * md.g[0]; r += s * md.g[1];
      env[m] *= md.k;
      phase[m] += TAU * v.f * md.ratio * bend / sr;
    }
    const k = amp * att * tr;
    L[i] += l * k; R[i] += r * k;
    if (noise && i - start < noise.length) { const s = amp * v.strike.amp * 6 * noise[i - start]; L[i] += s * gl; R[i] += s * gr; }
  }
}

// Early reflections: each output side sums a few short taps of the same or the
// opposite input side, through a one-pole low-pass (walls absorb the highs).
// Unequal tap times on the two sides decorrelate them, which is where a dry
// strike gets its gentle width before the diffuse room takes over.
function early(L, R, o, sr) {
  const n = L.length, k = Math.exp(-TAU * (o.tone ?? 4000) / sr);
  const srcL = Float64Array.from(L), srcR = Float64Array.from(R);
  for (const [side, out] of [[0, L], [1, R]]) {
    const taps = o.taps.map(([ms, g, same], j) => ({ d: Math.round(ms / 1000 * sr * (side ? 1.09 : 1)), g, from: (same ? side : 1 - side) === 0 ? srcL : srcR, j }));
    let z = 0;
    for (let i = 0; i < n; i++) {
      let x = 0;
      for (const t of taps) if (i >= t.d) x += t.g * t.from[i - t.d];
      z = (1 - k) * x + k * z;
      out[i] += z;
    }
  }
}

// Damping of the dry sound: 1 until `from`, then exp(−((t − from)/s)²) with s
// set so the gain is −60 dB at `to` (a parabola in decibels, so it starts
// imperceptibly and speeds up, as a touched glass or bowl does), 0 after.
function damp(L, R, o, sr) {
  const s = (o.to - o.from) / Math.sqrt(Math.log(1000));
  for (let i = Math.round(o.from * sr); i < L.length; i++) {
    const t = i / sr;
    const g = t >= o.to ? 0 : Math.exp(-(((t - o.from) / s) ** 2));
    L[i] *= g; R[i] *= g;
  }
}

// 8-line feedback delay network: mutually prime lengths of 30–62 ms, a
// Householder feedback matrix (lossless, every line feeds every other), a
// one-pole low-pass in each loop so highs die first, and per-line gains set
// from t60. Two Schroeder allpasses diffuse the input so the first echoes do
// not flutter. Even lines feed the left output, odd lines the right.
const FDN_LENGTHS = [1433, 1601, 1867, 2053, 2251, 2399, 2677, 2969];
function reverb(L, R, o, sr) {
  const n = L.length, N = FDN_LENGTHS.length;
  const pre = Math.round((o.predelay ?? 0.012) * sr);
  const damp = Math.exp(-TAU * (o.damp ?? 4500) / sr);
  const lines = FDN_LENGTHS.map(len => ({ len, buf: new Float64Array(len), w: 0, z: 0, g: Math.pow(10, -3 * len / (o.t60 * sr)) }));
  const aps = [[142, 0.6], [107, 0.6]].map(([len, g]) => ({ len, g, buf: new Float64Array(len), w: 0 }));
  const wetL = new Float64Array(n), wetR = new Float64Array(n);
  const outs = new Float64Array(N);
  for (let i = 0; i < n; i++) {
    let x = i >= pre ? 0.5 * (L[i - pre] + R[i - pre]) : 0;
    for (const a of aps) { const d = a.buf[a.w]; const y = -a.g * x + d; a.buf[a.w] = x + a.g * y; a.w = (a.w + 1) % a.len; x = y; }
    let sum = 0;
    for (let j = 0; j < N; j++) {
      const ln = lines[j];
      ln.z = (1 - damp) * ln.buf[ln.w] + damp * ln.z;
      outs[j] = ln.z * ln.g; sum += outs[j];
    }
    const hh = 2 / N * sum;
    let l = 0, r = 0;
    for (let j = 0; j < N; j++) {
      const ln = lines[j];
      ln.buf[ln.w] = outs[j] - hh + (j % 2 ? -x : x);
      ln.w = (ln.w + 1) % ln.len;
      if (j % 2) r += (j % 4 === 1 ? 1 : -1) * outs[j]; else l += (j % 4 === 0 ? 1 : -1) * outs[j];
    }
    wetL[i] = l * 0.5; wetR[i] = r * 0.5;
  }
  for (let i = 0; i < n; i++) { L[i] += o.mix * wetL[i]; R[i] += o.mix * wetR[i]; }
}

// ITU-R BS.1770 K-weighting at 48 kHz: the high-shelf "head" stage and the
// RLB high-pass, with the coefficients the standard gives for 48 kHz.
const K1 = { b0: 1.53512485958697, b1: -2.69169618940638, b2: 1.19839281085285, a1: -1.69065929318241, a2: 0.73248077421585 };
const K2 = { b0: 1, b1: -2, b2: 1, a1: -1.99004745483398, a2: 0.99007225036621 };
/** Maximum momentary loudness (400 ms window, 10 ms hop) in LUFS of a 48 kHz stereo pair. */
export function momentaryMax(L, R) {
  const n = L.length, W = Math.round(0.4 * SAMPLE_RATE), hop = Math.round(0.01 * SAMPLE_RATE);
  const cum = new Float64Array(n + 1);
  for (const ch of [L, R]) {
    const x = Float64Array.from(ch);
    filter(x, K1); filter(x, K2);
    for (let i = 0; i < n; i++) cum[i + 1] += x[i] * x[i];
  }
  for (let i = 0; i < n; i++) cum[i + 1] += cum[i];
  let best = 0;
  for (let e = hop; e < n + W; e += hop) {
    const a = Math.max(0, e - W), b = Math.min(n, e);
    best = Math.max(best, (cum[b] - cum[a]) / W);
  }
  return best > 0 ? -0.691 + 10 * Math.log10(best) : -Infinity;
}

/** Renders one sound to a 48 kHz stereo pair, mastered and loudness-normalised. */
export function renderSound(sound) {
  const sr = SAMPLE_RATE, n = Math.round(sound.dur * sr);
  const L = new Float64Array(n), R = new Float64Array(n);
  for (const v of sound.voices) renderModal(v, L, R, sr);
  if (sound.damp) damp(L, R, sound.damp, sr);
  if (sound.early) early(L, R, sound.early, sr);
  if (sound.reverb) reverb(L, R, sound.reverb, sr);
  if (sound.master !== false) {
    for (const ch of [L, R]) {
      filter(ch, biquad('hp', 90, 0.707));
      filter(ch, biquad('lp', 6500, 0.5412)); filter(ch, biquad('lp', 6500, 1.3066));
      if (sound.tone) filter(ch, biquad('lp', sound.tone, 0.707));
    }
  }
  // The last 50 ms before the final fade: a natural decay is already quiet
  // here, a truncated one is not (render.mjs compares it after normalisation).
  const tailN = Math.round(0.05 * sr);
  let rawTail = 0;
  for (let i = n - tailN; i < n; i++) rawTail = Math.max(rawTail, Math.abs(L[i]), Math.abs(R[i]));
  const fin = Math.round(0.002 * sr), fout = Math.round((sound.fadeOut ?? 0.18) * sr);
  for (const ch of [L, R]) {
    for (let i = 0; i < fin; i++) ch[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / fin);
    for (let i = 0; i < fout; i++) ch[n - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / fout);
    ch[0] = 0; ch[n - 1] = 0;
  }
  const lufs = momentaryMax(L, R);
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  let gain = Math.pow(10, (TARGET_LUFS - lufs) / 20);
  if (peak * gain > PEAK_CEIL) gain = PEAK_CEIL / peak;
  return { left: Float32Array.from(L, x => x * gain), right: Float32Array.from(R, x => x * gain), lufs: lufs + 20 * Math.log10(gain), rawTail: rawTail * gain };
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -TAU / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

/** Measures what the checks assert. */
export function measure({ left, right }, sr = SAMPLE_RATE) {
  const n = left.length;
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  const tailN = Math.round(0.01 * sr);
  let tail = 0, tail50 = 0;
  for (let i = n - tailN; i < n; i++) tail += (left[i] ** 2 + right[i] ** 2) / 2;
  for (let i = n - Math.round(0.05 * sr); i < n; i++) tail50 = Math.max(tail50, Math.abs(left[i]), Math.abs(right[i]));
  let last = 0;
  for (let i = n - 1; i >= 0; i--) if (Math.max(Math.abs(left[i]), Math.abs(right[i])) > peak / 100) { last = i; break; }
  // Share of energy above 6 kHz, and stereo width (side/mid energy).
  const size = 1 << Math.ceil(Math.log2(n));
  const re = new Float64Array(size), im = new Float64Array(size);
  let mid = 0, side = 0;
  for (let i = 0; i < n; i++) {
    re[i] = (left[i] + right[i]) / 2;
    mid += re[i] ** 2; side += ((left[i] - right[i]) / 2) ** 2;
  }
  fft(re, im);
  let hi = 0, all = 0;
  for (let k = 1; k < size / 2; k++) { const p = re[k] ** 2 + im[k] ** 2; all += p; if (k * sr / size > 6000) hi += p; }
  return {
    duration: n / sr, audible: (last + 1) / sr, peak, lufs: momentaryMax(left, right),
    above6k: hi > 0 ? 10 * Math.log10(hi / all) : -Infinity,
    width: mid > 0 ? side / mid : 0,
    first: Math.max(Math.abs(left[0]), Math.abs(right[0])), tailRms: Math.sqrt(tail / tailN), tail50,
  };
}

/** Gain for the person's volume setting (0–100): squared, so the slider feels even. */
export function volumeGain(volume, muted) {
  return muted ? 0 : Math.pow(Math.max(0, Math.min(100, volume)) / 100, 2);
}

/** Interleaved 16-bit little-endian PCM, the form fingerprinted and written to WAV. */
export function toPcm16({ left, right }) {
  const pcm = new Int16Array(left.length * 2);
  const q = x => Math.max(-32768, Math.min(32767, Math.round(x * 32767)));
  for (let i = 0; i < left.length; i++) { pcm[2 * i] = q(left[i]); pcm[2 * i + 1] = q(right[i]); }
  return pcm;
}
