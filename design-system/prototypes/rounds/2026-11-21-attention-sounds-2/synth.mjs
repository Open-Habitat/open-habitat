// Attention sounds, round 2 (issue attention-sound): the sounds themselves.
//
// Round 1's sounds were a few damped sines each, mono and dry, peak-normalised.
// Jari found them not pleasant or varied enough. This renderer keeps round 1's
// shape (a declarative recipe rendered sample by sample in plain JavaScript, the
// same code in the page and in Node, seeded noise, no samples or third-party
// material) and adds what makes a short sound feel like a real object in a
// room:
//
//   modal   struck objects as banks of damped partials at measured or physical
//           ratios (bars, tines, tubes, glass, bowls, bells), optional beating
//           pairs, tremolo, pitch glide and a soft band-passed noise strike
//   fm      two-operator FM with a decaying index and an optional short "tine"
//           modulator (electric-piano and soft-ping tones)
//   pluck   Karplus-Strong string: filtered-noise excitation with a pick-position
//           comb, averaging loop filter and an allpass for exact tuning
//   pad     additive chord: detuned harmonic partials whose upper harmonics open
//           with the envelope ("bloom"), raised-cosine attack and release
//   noise   band-passed noise with a swept centre (breath), decorrelated L/R
//
// Every voice is panned with an equal-power law. The stereo bus then goes
// through an optional ping-pong echo and an 8-line feedback delay network
// (Householder matrix, damped loops, two diffusing allpasses in front), a
// gentle high-pass at 90 Hz and a 4th-order low-pass at 6.5 kHz (nothing harsh
// above ~6 kHz; a recipe's `tone` adds a further low-pass for bright plucks), raised-cosine fades at both ends, and a loudness
// normalisation: the K-weighted (ITU-R BS.1770) momentary loudness, 400 ms
// window, is brought to TARGET_LUFS at its maximum, with a peak ceiling. Short
// notification sounds are judged by their loudest moment, which is what the
// momentary maximum measures; integrated loudness would favour sparse sounds.
//
// Everything renders at SAMPLE_RATE whatever the playback context's own rate:
// the page wraps the samples in a 48 kHz AudioBuffer and lets the browser
// resample, so a recipe gives the same samples (and fingerprint) everywhere.

export const SAMPLE_RATE = 48000;
export const MAX_DUR = 1.2;
export const TARGET_LUFS = -17;
export const PEAK_CEIL = 0.708; // −3 dBFS
const TAU = 2 * Math.PI;

const NAMES = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };
/** 'F#5' → Hz (A4 = 440, equal temperament). */
export const hz = (n) => {
  const m = /^([A-G]#?)(\d)$/.exec(n);
  return 440 * Math.pow(2, (NAMES[m[1]] + 12 * (Number(m[2]) - 4)) / 12);
};

// ---------- Recipes ----------

// Physical or measured partial ratios: [ratio, amplitude, decay time constant (s)].
const MARIMBA = [[1, 1, 0.42], [3.99, 0.2, 0.07], [9.9, 0.035, 0.02]];
const KALIMBA = [[1, 1, 0.55], [5.95, 0.16, 0.05], [13.3, 0.03, 0.015]];
const CELESTA = [[1, 1, 0.5], [2, 0.32, 0.18], [3, 0.1, 0.09], [4.07, 0.045, 0.05]];
const VIBES = [[1, 1, 0.85], [4, 0.1, 0.22], [10, 0.015, 0.06]];
const BLOCK = [[1, 1, 0.075], [2.2, 0.3, 0.035], [3.6, 0.1, 0.018], [0.5, 0.18, 0.05]];
const GLASS = [[1, 1, 0.65], [1.0024, 0.55, 0.65], [2.32, 0.22, 0.28], [2.326, 0.16, 0.28], [4.25, 0.05, 0.11], [6.63, 0.015, 0.05]];
const TUBE = [[1, 1, 0.7], [2.756, 0.32, 0.28], [5.404, 0.1, 0.11], [8.933, 0.03, 0.05]];
const BOWL = [[1, 1, 0.9], [1.006, 0.8, 0.9], [2.74, 0.34, 0.5], [2.748, 0.24, 0.5], [5.17, 0.08, 0.25], [5.19, 0.06, 0.25], [8.4, 0.018, 0.1]];
const BELL = [[0.5, 0.28, 0.9], [1, 1, 0.55], [1.25, 0.22, 0.38], [1.5, 0.14, 0.3], [2, 0.32, 0.28], [2.52, 0.08, 0.14], [3.01, 0.05, 0.09]];
const DROP = [[1, 1, 0.075], [2.04, 0.06, 0.03]];
const BUBBLE = [[1, 1, 0.04]];

const strike = (f, ms, amp, seed, q = 0.8) => ({ f, ms, amp, seed, q });
const modal = (at, note, modes, o = {}) => ({ kind: 'modal', at, f: typeof note === 'string' ? hz(note) : note, modes, attack: 0.0015, ...o });
const pluck = (at, note, o = {}) => ({ kind: 'pluck', at, f: hz(note), t60: 2.4, bright: 0.3, pick: 0.13, ...o });
const ping = (at, note, o = {}) => ({ kind: 'fm', at, f: hz(note), ratio: 1, index: 0.9, indexDecay: 0.12, decay: 0.35, attack: 0.004, ...o });

// The Open Habitat motif (family D): the mark's two arches as a rising fifth,
// D5 → A5, and the sun above them as a soft F♯6. Round 1's Ovi was the first
// two notes; the third makes it a phrase that still resolves upwards.
const MOTIF = [[0, 'D5', 0.85, -0.3], [0.12, 'A5', 1, 0.2], [0.26, 'F#6', 0.42, 0.05]];

export const FAMILIES = [
  { id: 'A', name: 'Soittimet', short: 'Soitin',
    line: 'Lyhyitä kahden–kolmen sävelen aiheita marimballa, kalimballa, celestalla, vibrafonilla, kanteleella ja sähköpianolla: lämpimiä ja tuttuja, selvästi musiikkia.' },
  { id: 'B', name: 'Luonto ja esineet', short: 'Luonto',
    line: 'Pisara, puupala, lasit, tuulikello, kuplat ja laulava kulho: ääni kuulostaa esineeltä huoneessa, ei sävelmältä.' },
  { id: 'C', name: 'Tunnelmat', short: 'Tunnelma',
    line: 'Pehmeitä paisuntoja ja kaikuvia helähdyksiä: rauhallisin perhe, joka ei säikäytä mutta jää taustalle meluisassa huoneessa.' },
  { id: 'D', name: 'Habitat-tunnus', short: 'Tunnus',
    line: 'Yksi Open Habitatin aihe (kaksi kaarta kvintin päässä ja aurinko niiden yllä) neljällä soundilla; vertailuna kierroksen 1 Ovi.' },
];

export const SOUNDS = [
  // ---- A Soittimet ----
  { id: 'marimba', family: 'A', name: 'Marimba', dur: 1.1,
    desc: 'Kolme lankakapulan lyöntiä marimbaan: E5, G5, C6.',
    how: 'Moodisynteesi viritetyn ruusupuulaatan suhteilla 1 : 3,99 : 9,9, pehmeä 5 ms kapulakohina 1,2 kHz:n kaistalla, 100 ms välein vasemmalta oikealle; huone 0,7 s.',
    voices: [
      modal(0, 'E5', MARIMBA, { amp: 0.8, pan: -0.35, strike: strike(1200, 5, 0.12, 11) }),
      modal(0.1, 'G5', MARIMBA, { amp: 0.85, pan: 0, strike: strike(1300, 5, 0.12, 12) }),
      modal(0.2, 'C6', MARIMBA, { amp: 1, pan: 0.35, strike: strike(1400, 5, 0.12, 13) })],
    reverb: { t60: 0.7, mix: 0.2 } },
  { id: 'kalimba', family: 'A', name: 'Kalimba', dur: 1.1,
    desc: 'Peukalopianon kolme kieltä: B5, G5, D6.',
    how: 'Teräskielen moodit 1 : 5,95 : 13,3 (korkeat vaimenevat 50 ja 15 ms:ssa), peukalon 4 ms pehmeä isku; 120 ms välein, leveä stereo; huone 0,8 s.',
    voices: [
      modal(0, 'B5', KALIMBA, { amp: 0.85, pan: 0.25, strike: strike(1800, 4, 0.1, 21) }),
      modal(0.12, 'G5', KALIMBA, { amp: 0.8, pan: -0.3, strike: strike(1700, 4, 0.1, 22) }),
      modal(0.24, 'D6', KALIMBA, { amp: 0.9, pan: 0.1, strike: strike(1900, 4, 0.1, 23) })],
    reverb: { t60: 0.8, mix: 0.18 } },
  { id: 'celesta', family: 'A', name: 'Celesta', dur: 1.15,
    desc: 'Celestan terssi C6 + E6 hieman murrettuna ja sen päälle G6.',
    how: 'Lähes harmoniset teräslevyn moodit (1 : 2 : 3 : 4,07), 1,5 ms vasarakohina 3,5 kHz:llä, 15 ms murto; kaikuisampi sali 1,0 s.',
    voices: [
      modal(0, 'C6', CELESTA, { amp: 0.75, pan: -0.25, strike: strike(3500, 1.5, 0.05, 31) }),
      modal(0.015, 'E6', CELESTA, { amp: 0.65, pan: 0.2, strike: strike(3500, 1.5, 0.05, 32) }),
      modal(0.16, 'G6', CELESTA, { amp: 0.8, pan: 0.05, strike: strike(3600, 1.5, 0.05, 33) })],
    reverb: { t60: 1.0, mix: 0.25 } },
  { id: 'vibrafoni', family: 'A', name: 'Vibrafoni', dur: 1.2,
    desc: 'Vibrafonin pehmeä terssi F5 + A5, moottorin hidas värinä.',
    how: 'Alumiinilaatan moodit 1 : 4 : 10, pitkä 0,85 s vaimeneminen, 5,5 Hz:n amplitudivärinä (syvyys 35 %), 25 ms murto; huone 0,9 s.',
    voices: [
      modal(0, 'F5', VIBES, { amp: 0.9, pan: -0.3, tremolo: { rate: 5.5, depth: 0.35 }, strike: strike(1500, 3, 0.08, 41) }),
      modal(0.025, 'A5', VIBES, { amp: 0.8, pan: 0.3, tremolo: { rate: 5.5, depth: 0.35 }, strike: strike(1600, 3, 0.08, 42) })],
    reverb: { t60: 0.9, mix: 0.2 }, fadeOut: 0.3 },
  { id: 'kantele', family: 'A', name: 'Kantele', dur: 1.2,
    desc: 'Kanteleen näppäys: A4, D5, F♯5 ja A5 nopeana sivelynä.',
    how: 'Karplus–Strong-kieli: suodatettu kohinaheräte, näppäyskohdan kampa (13 %), keskiarvosilmukka (T60 2,4 s), allpass-viritys ja 4,5 kHz:n tummennus; 40 ms välein, kielet levitetty stereoon; huone 0,8 s.',
    voices: [
      pluck(0, 'A4', { amp: 0.8, pan: -0.45, seed: 51 }),
      pluck(0.04, 'D5', { amp: 0.85, pan: -0.15, seed: 52 }),
      pluck(0.08, 'F#5', { amp: 0.8, pan: 0.15, seed: 53 }),
      pluck(0.12, 'A5', { amp: 0.85, pan: 0.45, seed: 54 })],
    reverb: { t60: 0.8, mix: 0.2 }, tone: 4500 },
  { id: 'sahkopiano', family: 'A', name: 'Sähköpiano', dur: 1.15,
    desc: 'Sähköpianon nouseva kvartti E5 → A5, jälkimmäisen alla pehmeä A4.',
    how: 'FM: kantaja = modulaattori, indeksi 1,6 → 0,2 (250 ms), lisäksi 14 × f ”tine”-modulaattori 20 ms:n kilahdukseen; huone 0,8 s.',
    voices: [
      ping(0, 'E5', { amp: 0.8, pan: -0.2, index: 1.6, indexFloor: 0.2, indexDecay: 0.25, decay: 0.45, tine: { ratio: 14, index: 0.6, decay: 0.02 } }),
      ping(0.15, 'A5', { amp: 0.9, pan: 0.2, index: 1.6, indexFloor: 0.2, indexDecay: 0.25, decay: 0.55, tine: { ratio: 14, index: 0.6, decay: 0.02 } }),
      ping(0.15, 'A4', { amp: 0.4, pan: 0, index: 1.0, indexFloor: 0.1, indexDecay: 0.2, decay: 0.55 })],
    reverb: { t60: 0.8, mix: 0.18 } },

  // ---- B Luonto ja esineet ----
  { id: 'pisara', family: 'B', name: 'Pisara', dur: 1.0,
    desc: 'Kolme vesipisaraa kiviseen altaaseen.',
    how: 'Kuplan resonanssi: siniosa, jonka sävel nousee 0,55 × f:stä f:ään 18 ms:ssa ja vaimenee 75 ms:ssa (1000, 1350 ja 1700 Hz), hento roiskekohina; kaikuisa luola 1,1 s.',
    voices: [
      modal(0, 1000, DROP, { amp: 1, pan: -0.2, glide: { from: 0.55, tau: 0.018 }, strike: strike(2600, 1, 0.04, 61) }),
      modal(0.17, 1350, DROP, { amp: 0.65, pan: 0.3, glide: { from: 0.55, tau: 0.016 }, strike: strike(2800, 1, 0.03, 62) }),
      modal(0.29, 1700, DROP, { amp: 0.35, pan: 0.05, glide: { from: 0.6, tau: 0.014 } })],
    reverb: { t60: 1.1, mix: 0.35, predelay: 0.018 } },
  { id: 'puupala', family: 'B', name: 'Puupala', dur: 0.8,
    desc: 'Temppelipalikka, kaksi kopautusta: korkea ja kvarttia matalampi.',
    how: 'Ontto puu: moodit 0,5 : 1 : 2,2 : 3,6, vaimeneminen 75–18 ms, 2 ms puinen isku 2 kHz:llä; 130 ms välein; pieni huone 0,5 s.',
    voices: [
      modal(0, 780, BLOCK, { amp: 0.9, pan: -0.2, attack: 0.0008, strike: strike(2000, 2, 0.28, 71, 1.2) }),
      modal(0.13, 585, BLOCK, { amp: 1, pan: 0.2, attack: 0.0008, strike: strike(1800, 2, 0.28, 72, 1.2) })],
    reverb: { t60: 0.5, mix: 0.22 }, fadeOut: 0.12 },
  { id: 'lasit', family: 'B', name: 'Lasit', dur: 1.15,
    desc: 'Kaksi ohutta lasia kilahtaa: A5 ja D6.',
    how: 'Lasin epäharmoniset moodit (1 : 2,32 : 4,25 : 6,63) pareittain hieman eri taajuuksilla, jolloin ääni huojuu; pehmeä 1,5 ms isku; 160 ms välein; huone 1,0 s.',
    voices: [
      modal(0, 'A5', GLASS, { amp: 0.8, pan: -0.25, spread: 0.2, strike: strike(2500, 1.5, 0.05, 81) }),
      modal(0.16, 'D6', GLASS, { amp: 0.7, pan: 0.3, spread: 0.2, strike: strike(2700, 1.5, 0.05, 82) })],
    reverb: { t60: 1.0, mix: 0.22 }, fadeOut: 0.25 },
  { id: 'tuulikello', family: 'B', name: 'Tuulikello', dur: 1.2,
    desc: 'Viisi putkea pentatonisessa vireessä heilahtaa tuulessa.',
    how: 'Vapaan tangon moodit 1 : 2,756 : 5,404 : 8,933, putket G5 A5 C6 D6 E6 epätasaisin välein ja voimin, levitetty −0,6…+0,6; ulkoilmainen 1,2 s.',
    voices: [
      modal(0, 'C6', TUBE, { amp: 0.75, pan: -0.1, strike: strike(3000, 1, 0.04, 91) }),
      modal(0.07, 'E6', TUBE, { amp: 0.55, pan: 0.5, strike: strike(3000, 1, 0.04, 92) }),
      modal(0.16, 'A5', TUBE, { amp: 0.85, pan: -0.55, strike: strike(3000, 1, 0.04, 93) }),
      modal(0.235, 'D6', TUBE, { amp: 0.5, pan: 0.25, strike: strike(3000, 1, 0.04, 94) }),
      modal(0.34, 'G5', TUBE, { amp: 0.6, pan: -0.3, strike: strike(3000, 1, 0.04, 95) })],
    reverb: { t60: 1.2, mix: 0.25 }, fadeOut: 0.3 },
  { id: 'kuplat', family: 'B', name: 'Kuplat', dur: 0.9,
    desc: 'Neljä pientä kuplaa nousee pintaan.',
    how: 'Minnaert-kupla: lyhyt siniosa, jonka sävel nousee nopeasti (0,6 × f → f, 10 ms) ja vaimenee 40 ms:ssa; 620–980 Hz, eri kohdissa stereokuvaa; huone 0,6 s.',
    voices: [
      modal(0, 620, BUBBLE, { amp: 0.9, pan: -0.35, glide: { from: 0.6, tau: 0.01 } }),
      modal(0.07, 820, BUBBLE, { amp: 0.75, pan: 0.3, glide: { from: 0.6, tau: 0.01 } }),
      modal(0.15, 700, BUBBLE, { amp: 0.8, pan: -0.05, glide: { from: 0.6, tau: 0.01 } }),
      modal(0.2, 980, BUBBLE, { amp: 0.6, pan: 0.45, glide: { from: 0.6, tau: 0.009 } })],
    reverb: { t60: 0.6, mix: 0.25 }, fadeOut: 0.15 },
  { id: 'kulho', family: 'B', name: 'Kulho', dur: 1.2,
    desc: 'Laulava kulho, huopanuijan pehmeä lyönti, G4.',
    how: 'Kulhon moodit pareittain (1 : 1,006, 2,74 : 2,748, 5,17 : 5,19), jolloin syntyy 2–3 Hz:n huojunta; huopaisku 6 ms 900 Hz:llä, moodit levitetty stereoon; sali 1,4 s.',
    voices: [modal(0, 'G4', BOWL, { amp: 1, pan: 0, spread: 0.35, attack: 0.006, strike: strike(900, 6, 0.08, 101) })],
    reverb: { t60: 1.4, mix: 0.25 }, fadeOut: 0.35 },

  // ---- C Tunnelmat ----
  { id: 'aamu', family: 'C', name: 'Aamu', dur: 1.2,
    desc: 'D-duurin sointu paisuu esiin ja sen päälle syttyy F♯6.',
    how: 'Additiivinen pad: A4 D5 F♯5 A5, kuusi ylä-ääntä kutakin kahtena ±5 sentin päässä toisistaan, ylä-äänet aukeavat verhokäyrän mukana; 280 ms nousu; FM-helähdys 250 ms kohdalla; sali 1,2 s.',
    voices: [
      { kind: 'pad', at: 0, notes: ['A4', 'D5', 'F#5', 'A5'].map(hz), harmonics: 6, rolloff: 1.6, bloom: 1.5, detune: 5, attack: 0.28, hold: 0.15, release: 0.6, amp: 0.7, width: 0.6, seed: 111 },
      ping(0.25, 'F#6', { amp: 0.35, pan: 0.2, index: 0.5, decay: 0.4 })],
    reverb: { t60: 1.2, mix: 0.3 } },
  { id: 'hehku', family: 'C', name: 'Hehku', dur: 1.2,
    desc: 'Yksi pehmeä helähdys A5, kvintti hohtaa perässä.',
    how: 'FM 1 : 2, indeksi 0,7 → 0 (150 ms) ja sen päälle E6 heikkona 40 ms myöhemmin; suuri sali 1,6 s, 20 ms esiviive, kaikuosuus 45 %.',
    voices: [
      ping(0, 'A5', { amp: 1, pan: -0.15, ratio: 2, index: 0.7, indexDecay: 0.15, decay: 0.45 }),
      ping(0.04, 'E6', { amp: 0.22, pan: 0.3, ratio: 2, index: 0.4, indexDecay: 0.1, decay: 0.35 })],
    reverb: { t60: 1.6, mix: 0.45, predelay: 0.02 } },
  { id: 'henkays', family: 'C', name: 'Henkäys', dur: 1.2,
    desc: 'Pehmeä henkäys, jonka sisällä soi kvintti D5 + A5.',
    how: 'Kaistanpäästösuodatettu kohina (Q 2,5), jonka keskitaajuus nousee 400 → 1400 Hz, L ja R eri kohinasta; samaan verhokäyrään tumma additiivinen kvintti; sali 1,0 s.',
    voices: [
      { kind: 'noise', at: 0, f0: 400, f1: 1400, q: 2.5, attack: 0.35, hold: 0.05, release: 0.55, amp: 0.55, width: 0.8, seed: 121 },
      { kind: 'pad', at: 0.05, notes: ['D5', 'A5'].map(hz), harmonics: 3, rolloff: 2, bloom: 1, detune: 4, attack: 0.3, hold: 0.05, release: 0.6, amp: 0.5, width: 0.4, seed: 122 }],
    reverb: { t60: 1.0, mix: 0.3 } },
  { id: 'kaiku', family: 'C', name: 'Kaiku', dur: 1.2,
    desc: 'Kaksi pehmeää helähdystä G5 ja D6, kaiku vastaa puolelta toiselle.',
    how: 'Pehmeä FM-helähdys (indeksi 0,5), ping-pong-viive 190 ms, takaisinkytkentä 40 % ja 3 kHz:n alipäästö kaiussa; huone 0,9 s.',
    voices: [
      ping(0, 'G5', { amp: 0.9, pan: -0.5, index: 0.5, decay: 0.22 }),
      ping(0.12, 'D6', { amp: 0.75, pan: 0.5, index: 0.5, decay: 0.22 })],
    echo: { time: 0.19, fb: 0.4, mix: 0.55, tone: 3000 },
    reverb: { t60: 0.9, mix: 0.2 }, fadeOut: 0.25 },
  { id: 'usva', family: 'C', name: 'Usva', dur: 1.2,
    desc: 'Kaksi sointua: pidätys Dsus4 purkautuu D-duuriin.',
    how: 'Kaksi additiivista padia ristiin: D4 G4 A4 D5 → D4 F♯4 A4 D5, seitsemän ylä-ääntä, ±6 senttiä; toinen alkaa 300 ms kohdalla; sali 1,3 s.',
    voices: [
      { kind: 'pad', at: 0, notes: ['D4', 'G4', 'A4', 'D5'].map(hz), harmonics: 7, rolloff: 1.4, bloom: 1, detune: 6, attack: 0.12, hold: 0.18, release: 0.25, amp: 0.6, width: 0.5, seed: 131 },
      { kind: 'pad', at: 0.3, notes: ['D4', 'F#4', 'A4', 'D5'].map(hz), harmonics: 7, rolloff: 1.4, bloom: 1, detune: 6, attack: 0.15, hold: 0.2, release: 0.5, amp: 0.65, width: 0.5, seed: 132 }],
    reverb: { t60: 1.3, mix: 0.3 } },

  // ---- D Habitat-tunnus ----
  { id: 'tunnus-puu', family: 'D', name: 'Tunnus puu', dur: 1.1,
    desc: 'Habitat-aihe marimballa: D5 → A5 ja pehmeä F♯6.',
    how: 'Marimban moodit (1 : 3,99 : 9,9) ja 5 ms lankakapula, aihe 0 / 120 / 260 ms, sävelet levitetty stereoon; huone 0,8 s.',
    voices: MOTIF.map(([at, n, amp, pan], k) => modal(at, n, MARIMBA, { amp, pan, strike: strike(1300, 5, 0.12, 141 + k) })),
    reverb: { t60: 0.8, mix: 0.2 } },
  { id: 'tunnus-kello', family: 'D', name: 'Tunnus kello', dur: 1.2,
    desc: 'Habitat-aihe pienillä kelloilla.',
    how: 'Kellon moodit nominaalisävelen suhteen (humina 0,5, perus 1, duuriterssi 1,25, kvintti 1,5, nominaali 2, 2,52, 3,01), 1,5 ms isku; sali 1,2 s.',
    voices: MOTIF.map(([at, n, amp, pan], k) => modal(at, n, BELL, { amp: amp * 0.9, pan, strike: strike(2500, 1.5, 0.05, 151 + k) })),
    reverb: { t60: 1.2, mix: 0.25 }, fadeOut: 0.3 },
  { id: 'tunnus-kieli', family: 'D', name: 'Tunnus kieli', dur: 1.2,
    desc: 'Habitat-aihe kanteleen kielillä.',
    how: 'Karplus–Strong-kielet kuten Kanteleessa (T60 2,0 s, tummennus 4 kHz), aihe 0 / 120 / 260 ms; huone 0,8 s.',
    voices: MOTIF.map(([at, n, amp, pan], k) => pluck(at, n, { amp, pan, seed: 161 + k, t60: 2.0 })),
    reverb: { t60: 0.8, mix: 0.2 }, tone: 4000 },
  { id: 'tunnus-pehmea', family: 'D', name: 'Tunnus pehmeä', dur: 1.15,
    desc: 'Habitat-aihe pehmeänä helähdyksenä: Ovin jatkokehitys.',
    how: 'Ovin FM-malletti (kantaja = modulaattori) pienemmällä indeksillä 1,0 → 0, oktaavia alempi siniosa lämmöksi, stereo ja sali 1,1 s.',
    voices: MOTIF.flatMap(([at, n, amp, pan]) => [
      ping(at, n, { amp, pan, index: 1.0, indexDecay: 0.1, decay: 0.32 }),
      { kind: 'fm', at, f: hz(n) / 2, amp: amp * 0.22, pan, ratio: 1, index: 0, indexDecay: 1, decay: 0.3, attack: 0.006 }]),
    reverb: { t60: 1.1, mix: 0.3 } },
  { id: 'r1-ovi', family: 'D', name: 'Ovi (kierros 1)', dur: 0.75, reference: true,
    desc: 'Vertailu: kierroksen 1 suositus sellaisenaan, D5 → A5.',
    how: 'Kierroksen 1 resepti: FM-malletti (indeksi 1,4 → 0, 90 ms), mono, ei kaikua; vain äänekkyys tasattu samaan tasoon kuin muut.',
    voices: [
      { kind: 'fm', at: 0, f: hz('D5'), amp: 0.85, ratio: 1, index: 1.4, indexDecay: 0.09, decay: 0.24, attack: 0.004, envelope: 'exp' },
      { kind: 'fm', at: 0.09, f: hz('A5'), amp: 1, ratio: 1, index: 1.4, indexDecay: 0.09, decay: 0.3, attack: 0.004, envelope: 'exp' }],
    fadeOut: 0.225, master: false },
];

export const RECOMMENDED = { sound: 'tunnus-puu', shortlist: ['tunnus-puu', 'kalimba', 'kantele', 'pisara', 'hehku'] };

// ---------- Rendering ----------

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
  const modes = v.modes.map(([ratio, a, decay], m) => {
    const p = (v.pan ?? 0) + (v.spread ? (m % 2 ? 1 : -1) * v.spread : 0);
    return { ratio, a, k: Math.exp(-1 / (decay * sr)), g: panGains(p) };
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
      const s = md.a * env[m] * Math.sin(phase[m]);
      l += s * md.g[0]; r += s * md.g[1];
      env[m] *= md.k;
      phase[m] += TAU * v.f * md.ratio * bend / sr;
    }
    const k = amp * att * tr;
    L[i] += l * k; R[i] += r * k;
    if (noise && i - start < noise.length) { const s = amp * v.strike.amp * 6 * noise[i - start]; L[i] += s * gl; R[i] += s * gr; }
  }
}

function renderFm(v, L, R, sr) {
  const start = Math.round(v.at * sr), amp = v.amp ?? 1, [gl, gr] = panGains(v.pan);
  let pc = 0, pm = 0, pt = 0;
  const floor = v.indexFloor ?? 0;
  for (let i = start; i < L.length; i++) {
    const t = (i - start) / sr;
    const att = v.envelope === 'exp' ? 1 - Math.exp(-t / v.attack) : rcos(t, v.attack);
    const env = att * Math.exp(-t / v.decay);
    const index = floor + (v.index - floor) * Math.exp(-t / v.indexDecay);
    let mod = index * Math.sin(pm);
    if (v.tine) { mod += v.tine.index * Math.exp(-t / v.tine.decay) * Math.sin(pt); pt += TAU * v.f * v.tine.ratio / sr; }
    const s = amp * env * Math.sin(pc + mod);
    L[i] += s * gl; R[i] += s * gr;
    pc += TAU * v.f / sr; pm += TAU * v.f * v.ratio / sr;
  }
}

function renderPluck(v, L, R, sr) {
  const start = Math.round(v.at * sr), amp = v.amp ?? 1, [gl, gr] = panGains(v.pan);
  const N = sr / v.f, D = Math.floor(N - 0.5), frac = N - D - 0.5;
  const C = (1 - frac) / (1 + frac);
  const rho = Math.pow(10, -3 / (v.t60 * v.f));
  // Excitation: one period of seeded noise, combed at the pick position,
  // low-passed twice for a soft finger, with its DC removed.
  const rand = mulberry32(v.seed), exc = new Float64Array(D);
  const lp = Math.exp(-TAU * (800 + 5000 * v.bright) / sr);
  let y = 0, y2 = 0, mean = 0;
  for (let i = 0; i < D; i++) exc[i] = rand() * 2 - 1;
  const P = Math.max(1, Math.round(v.pick * D));
  for (let i = D - 1; i >= P; i--) exc[i] -= exc[i - P];
  // Filter after the comb: on a high string the comb's first peak would
  // otherwise land near 6 kHz.
  for (let i = 0; i < D; i++) { y = (1 - lp) * exc[i] + lp * y; y2 = (1 - lp) * y + lp * y2; exc[i] = y2; }
  for (let i = 0; i < D; i++) mean += exc[i] / D;
  for (let i = 0; i < D; i++) exc[i] -= mean;
  const size = D + 2, line = new Float64Array(size);
  let w = 0, apIn = 0, apOut = 0;
  for (let i = start, k = 0; i < L.length; i++, k++) {
    const a = line[(w - D + size) % size], b = line[(w - D - 1 + size) % size];
    const lpv = rho * 0.5 * (a + b);
    const ap = C * lpv + apIn - C * apOut; apIn = lpv; apOut = ap;
    const s = ap + (k < D ? exc[k] : 0);
    line[w] = s; w = (w + 1) % size;
    const o = amp * s * rcos(k / sr, 0.0015);
    L[i] += o * gl; R[i] += o * gr;
  }
}

function adsr(t, v) {
  if (t < 0) return 0;
  if (t < v.attack) return rcos(t, v.attack);
  if (t < v.attack + v.hold) return 1;
  return 1 - rcos(t - v.attack - v.hold, v.release);
}

function renderPad(v, L, R, sr) {
  const start = Math.round(v.at * sr), amp = v.amp ?? 1, rand = mulberry32(v.seed);
  const parts = [];
  v.notes.forEach((f, j) => {
    const pan = v.notes.length > 1 ? (j / (v.notes.length - 1) * 2 - 1) * (v.width ?? 0.5) : 0;
    for (let h = 1; h <= v.harmonics; h++) for (const side of [-1, 1]) {
      const fh = f * h * Math.pow(2, side * v.detune / 2400);
      parts.push({ w: TAU * fh / sr, a: Math.pow(h, -v.rolloff) / v.notes.length, h, ph: rand() * TAU, g: panGains(pan + side * 0.15) });
    }
  });
  const end = Math.min(L.length, start + Math.round((v.attack + v.hold + v.release) * sr));
  for (let i = start; i < end; i++) {
    const e = adsr((i - start) / sr, v);
    let l = 0, r = 0;
    for (const p of parts) {
      // Upper harmonics open with the envelope: brightness follows loudness.
      const s = p.a * Math.pow(e, 1 + v.bloom * (p.h - 1) / v.harmonics) * Math.sin(p.ph);
      l += s * p.g[0]; r += s * p.g[1];
      p.ph += p.w;
    }
    L[i] += amp * l; R[i] += amp * r;
  }
}

function renderNoise(v, L, R, sr) {
  const start = Math.round(v.at * sr), amp = v.amp ?? 1;
  const end = Math.min(L.length, start + Math.round((v.attack + v.hold + v.release) * sr));
  const total = (end - start) / sr;
  const chans = [mulberry32(v.seed), mulberry32(v.seed + 1000)].map(rand => ({ rand, x1: 0, x2: 0, y1: 0, y2: 0 }));
  const w = v.width ?? 0.8;
  let c = null;
  for (let i = start; i < end; i++) {
    const t = (i - start) / sr;
    if ((i - start) % 32 === 0) c = biquad('bp', v.f0 * Math.pow(v.f1 / v.f0, Math.min(1, t / total)), v.q, sr);
    const e = amp * adsr(t, v);
    const out = chans.map(ch => {
      const x = ch.rand() * 2 - 1;
      const y = c.b0 * x + c.b1 * ch.x1 + c.b2 * ch.x2 - c.a1 * ch.y1 - c.a2 * ch.y2;
      ch.x2 = ch.x1; ch.x1 = x; ch.y2 = ch.y1; ch.y1 = y;
      return y;
    });
    const mid = (out[0] + out[1]) / 2, side = (out[0] - out[1]) / 2 * w;
    L[i] += e * (mid + side) * 2; R[i] += e * (mid - side) * 2;
  }
}

function echo(L, R, o, sr) {
  const d = Math.round(o.time * sr), n = L.length;
  const bl = new Float64Array(n), br = new Float64Array(n);
  const k = Math.exp(-TAU * o.tone / sr);
  let zl = 0, zr = 0;
  // Ping-pong: the left input feeds the right line and the lines cross over,
  // so each repeat answers from the other side, darker than the last.
  for (let i = 0; i < n; i++) {
    const fl = i >= d ? br[i - d] : 0, fr = i >= d ? bl[i - d] : 0;
    zl = (1 - k) * (R[i] + o.fb * fl) + k * zl;
    zr = (1 - k) * (L[i] + o.fb * fr) + k * zr;
    bl[i] = zl; br[i] = zr;
  }
  for (let i = 0; i < n; i++) {
    L[i] += o.mix * (i >= d ? bl[i - d] : 0);
    R[i] += o.mix * (i >= d ? br[i - d] : 0);
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
  for (const v of sound.voices) ({ modal: renderModal, fm: renderFm, pluck: renderPluck, pad: renderPad, noise: renderNoise })[v.kind](v, L, R, sr);
  if (sound.echo) echo(L, R, sound.echo, sr);
  if (sound.reverb) reverb(L, R, sound.reverb, sr);
  if (sound.master !== false) {
    for (const ch of [L, R]) {
      filter(ch, biquad('hp', 90, 0.707));
      filter(ch, biquad('lp', 6500, 0.5412)); filter(ch, biquad('lp', 6500, 1.3066));
      if (sound.tone) filter(ch, biquad('lp', sound.tone, 0.707));
    }
  }
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
  return { left: Float32Array.from(L, x => x * gain), right: Float32Array.from(R, x => x * gain), lufs: lufs + 20 * Math.log10(gain) };
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
  let tail = 0;
  for (let i = n - tailN; i < n; i++) tail += (left[i] ** 2 + right[i] ** 2) / 2;
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
    first: Math.max(Math.abs(left[0]), Math.abs(right[0])), tailRms: Math.sqrt(tail / tailN),
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
