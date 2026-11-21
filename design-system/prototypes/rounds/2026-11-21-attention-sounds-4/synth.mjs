// Attention sounds, round 5 (issue attention-sound; the fourth directory of
// the attention-sounds series). Jari's verdict on round 4: the kept sounds move
// the right way but can become more natural and richer still; the five new
// candidates sounded "digital" and lacked colour; the longer sounds were a bit
// long. So every sound now comes in a short (0.5–0.8 s) and a long
// (1.2–1.6 s) variant, and every sound is rendered by a new voice, `struck`,
// that adds what the round 4 voice lacked:
//
//   contact     the mallet, thumb or finger touches the object for a finite
//               time. A half-sine contact force of `contact` ms has a spectrum
//               that falls 12 dB per octave above ~0.6 / contact, so a soft
//               mallet darkens the high modes and a hard tap keeps them. Round
//               4 had every mode at its table level whatever struck it.
//   thump       the contact force itself, a half-sine pulse heard as a soft
//               knock. It is what excites the `box` below.
//   split       every mode is two components a few cents apart, one decaying
//               faster: the two polarisations of a string or the two
//               near-degenerate modes of a bowl, bar or tine. Their beating and
//               two-stage decay ("prompt sound, then aftersound") is the
//               single largest difference between a real struck object and a
//               bank of pure decaying sines.
//   jitter      seeded random detuning of each mode by a few cents, so the
//               spectrum is slightly inharmonic as in a real object and no two
//               notes of one sound are exact copies.
//   pitch/rise  a pitch that settles after the pluck (string tension) or rises
//               through a bubble's short life (Minnaert bubble near a surface).
//   box         fixed resonant band-pass filters through which the whole dry
//               sound passes: a kalimba's box, a guitar's body, a harp's
//               soundboard, a tongue drum's shell. Round 4's `body` added fixed
//               sines; a filter rings with whatever excites it, strike noise
//               included, which is what a real body does.
//
// The round 4 renderer is kept verbatim (renderModal and the stages around it),
// and round 4's recipes are carried as `r4-<id>`, so "Kierros 4" plays exactly
// what Jari heard: render.mjs fingerprints them, and the fingerprints were the
// same as round 4's own fingerprints.json when this round was built.

export const SAMPLE_RATE = 48000;
export const MAX_DUR = 1.6;
// Each sound has two lengths; render.mjs and check.mjs check each against its band.
export const LENGTHS = { short: [0.5, 0.8], long: [1.2, 1.6] };
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

// ---------- Round 4 recipes (carried for comparison) ----------

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

// Round 4 (directory 2026-11-21-attention-sounds-3) verbatim: these render
// with renderModal and are carried as r4-<id>.
const R4_SRC = [
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

// ---------- Round 5 recipes ----------

// Mode tables: [ratio, amplitude, decay time constant (s), attack (s, optional)].
// Ratios and decays start from round 4's tables; the beating partners round 4
// listed as separate rows are now made by `split`, and round 4's fixed body
// sines by `box`.
const TINE = [[1, 1, 0.6], [5.95, 0.2, 0.06], [13.3, 0.05, 0.02], [0.5, 0.03, 0.35, 0.015]];
const BAR = [[1, 1, 0.45], [3.99, 0.22, 0.075], [9.9, 0.045, 0.022], [1.0018, 0.3, 0.7, 0.012], [0.5, 0.045, 0.45, 0.02]];
const VIBE = [[1, 1, 0.95], [4, 0.1, 0.22], [10, 0.015, 0.06], [1.0012, 0.32, 1.0, 0.015], [0.5, 0.04, 0.6, 0.02]];
const DROPLET = [[1, 1, 0.075], [2.04, 0.06, 0.03], [0.5, 0.05, 0.06]];
const GLASS5 = [[1, 1, 0.65], [2.32, 0.24, 0.28], [4.25, 0.06, 0.11], [6.63, 0.018, 0.05], [0.5, 0.04, 0.35, 0.01]];
const TUBE5 = [[1, 1, 0.7], [2.756, 0.32, 0.28], [5.404, 0.1, 0.11], [8.933, 0.03, 0.05], [0.5, 0.03, 0.45, 0.01]];
const BUBBLE5 = [[1, 1, 0.04], [2.1, 0.03, 0.015]];
const BOWL5 = [[1, 1, 0.9], [2.74, 0.36, 0.5], [5.17, 0.09, 0.25], [8.4, 0.02, 0.1], [0.5, 0.06, 0.7, 0.02], [1.5, 0.015, 0.3, 0.02]];
// A steel tongue: the tuned fundamental, octave and twelfth, and two weak
// untuned plate modes between them that make it metal rather than a sine.
const TONGUE5 = [[1, 1, 0.8], [2.0, 0.32, 0.36], [3.01, 0.09, 0.14], [2.43, 0.045, 0.09], [4.12, 0.02, 0.05], [0.5, 0.03, 0.5, 0.02]];
// A tapered ice rod: a free bar's modes pulled closer by the taper.
const ICE = [[1, 1, 0.42], [2.62, 0.26, 0.16], [4.95, 0.08, 0.06], [7.9, 0.025, 0.03], [0.5, 0.02, 0.25, 0.01]];

/**
 * A plucked string as modes: harmonics h·√(1 + B·h²) (stiffness), the
 * amplitude a pluck at fraction `p` gives a string pulled into a triangle,
 * |sin(π·h·p)| / h², and higher harmonics dying faster. Harmonics are kept
 * below 6 kHz. With `split` each harmonic is also two polarisations, the
 * vertical one dying quickly: that two-stage decay, with the finger contact,
 * the settling pitch and the body, is what round 4's string model lacked.
 */
const string5 = (f, p, T, B = 0.00015, H = 14) => {
  const rows = [];
  for (let h = 1; h <= H; h++) {
    const ratio = h * Math.sqrt(1 + B * h * h);
    if (f * ratio > 6000) break;
    const a = Math.abs(Math.sin(Math.PI * h * p)) / (h * h) / Math.abs(Math.sin(Math.PI * p));
    if (a > 0.002) rows.push([ratio, a, T / (1 + 0.32 * (h - 1) + 0.04 * (h - 1) ** 2)]);
  }
  return rows;
};

const noise = (f, ms, amp, seed, q = 0.8) => ({ f, ms, amp, seed, q });
const struck = (at, note, modes, o = {}) => ({ kind: 'struck', at, f: typeof note === 'string' ? hz(note) : note, modes, attack: 0.0015, ...o });
const S = (short, s, l) => (short ? s : l);

// Small rooms: [delay ms, gain, from the same side?].
const ROOM5 = { taps: [[6.1, 0.2, true], [9.7, 0.17, false], [14.3, 0.14, true], [19.9, 0.12, false], [26.3, 0.09, true], [33.7, 0.07, false]], tone: 3600 };
const OUTDOOR = { taps: [[11.3, 0.14, true], [18.9, 0.11, false], [87, 0.07, false], [131, 0.04, true]], tone: 2600 };

// The Open Habitat motif: D5 → A5 and a soft F♯6.
const MOTIF5 = [[0, 'D5', 0.85, -0.3], [0.12, 'A5', 1, 0.2], [0.26, 'F#6', 0.42, 0.05]];

export const VIEWS = [
  { id: 'A', name: 'Hyväksytyt', short: 'Hyväksytyt',
    line: 'Yhdeksän hyväksyttyä ääntä luonnollisempina ja rikkaampina, kukin lyhyenä ja pitkänä, vertailuna kierroksen 4 versio.' },
  { id: 'B', name: 'Uudelleen tehdyt', short: 'Uudelleen',
    line: 'Viisi kierroksen 4 ehdokasta tehtynä uudelleen: pehmeämpi isku, runko, lievä epävireisyys ja luonnollinen tila.' },
  { id: 'C', name: 'Koko valikoima', short: 'Valikoima',
    line: 'Kaikki 14 ääntä siinä järjestyksessä kuin Asetukset ne näyttäisi, oletuksena Kalimba; Lyhyt tai Pitkä valitsee soitettavan pituuden.' },
];

// Each sound is a function of its length. `decays` scales every mode's decay
// time, as a softer or more damped object would; `damp` and the room shrink
// with it, so a short sound has died away by itself, not been cut.
const SOUND_DEFS = [
  { id: 'kalimba', group: 'soitin', name: 'Kalimba',
    desc: 'Peukalopianon kolme kieltä: B5, G5, D6.',
    how: 'Teräskielen moodit (1 : 5,95 : 13,3), kukin kahtena hieman eri vireisenä komponenttina, joista toinen sammuu nopeasti; peukalon 0,45 ms kosketus ja sen tömähdys, joka soittaa puulaatikon kolmea resonanssia (240, 520, 1150 Hz); muutaman sentin satunnainen epävireisyys; pieni huone.',
    make: (s) => ({
      dur: S(s, 0.72, 1.35), decays: S(s, 0.5, 1),
      voices: [[0, 'B5', 0.85, 0.35], [0.12, 'G5', 0.8, -0.4], [0.24, 'D6', 0.9, 0.15]].map(([at, n, amp, pan], k) => struck(at * S(s, 0.75, 1), n, TINE, {
        amp, pan, width: 0.25, contact: 0.45, thump: { ms: 3, amp: 0.35 }, split: { cents: 3.5, level: 0.45, decay: 0.45 }, jitter: 4, seed: 21 + k,
        strike: noise(1800, 4, 0.08, 21 + k) })),
      box: [[240, 4, 0.6], [520, 5, 0.35], [1150, 7, 0.15]],
      early: ROOM5, damp: S(s, { from: 0.36, to: 0.64 }, { from: 0.82, to: 1.27 }),
      reverb: S(s, { t60: 0.42, mix: 0.16 }, { t60: 0.8, mix: 0.2 }), fadeOut: 0.06 }) },
  { id: 'marimba', group: 'soitin', name: 'Marimba',
    desc: 'Kolme lankakapulan lyöntiä marimbaan: E5, G5, C6.',
    how: 'Ruusupuulaatan moodit (1 : 3,99 : 9,9) ja resonaattoriputki, joka paisuu perussävelelle; lankakapulan 1,1 ms kosketus tummentaa yläsävelet; jokainen moodi kahtena hieman eri vireisenä komponenttina ja lievä satunnainen epävireisyys; kapulan tömähdys ja puun kohina; pieni huone.',
    make: (s) => ({
      dur: S(s, 0.7, 1.3), decays: S(s, 0.55, 1),
      voices: [[0, 'E5', 0.8, -0.35], [0.1, 'G5', 0.85, 0], [0.2, 'C6', 1, 0.35]].map(([at, n, amp, pan], k) => struck(at * S(s, 0.8, 1), n, BAR, {
        amp, pan, width: 0.15, contact: 1.1, thump: { ms: 2.5, amp: 0.25 }, split: { cents: 1.5, level: 0.25, decay: 0.5 }, jitter: 2, seed: 11 + k,
        strike: noise(1200, 5, 0.1, 11 + k) })),
      box: [[180, 3, 0.25]],
      early: ROOM5, damp: S(s, { from: 0.36, to: 0.63 }, { from: 0.72, to: 1.2 }),
      reverb: S(s, { t60: 0.42, mix: 0.17 }, { t60: 0.75, mix: 0.21 }), fadeOut: 0.06 }) },
  { id: 'vibrafoni', group: 'soitin', name: 'Vibrafoni',
    desc: 'Vibrafonin pehmeä terssi F5 + A5, moottorin hidas värinä.',
    how: 'Alumiinilaatan moodit ja resonaattoriputki, 5,5 Hz:n värinä; narukapulan 0,9 ms kosketus; jokainen moodi kahtena hieman eri vireisenä komponenttina; pieni huone, pehmeä vaimennus kuin pedaali nousisi.',
    make: (s) => ({
      dur: S(s, 0.78, 1.5), decays: S(s, 0.5, 1),
      voices: [[0, 'F5', 0.9, -0.3], [0.025, 'A5', 0.8, 0.3]].map(([at, n, amp, pan], k) => struck(at, n, VIBE, {
        amp, pan, width: 0.15, contact: 0.9, tremolo: { rate: 5.5, depth: 0.35 }, split: { cents: 1, level: 0.3, decay: 0.6 }, jitter: 1.5, seed: 41 + k,
        thump: { ms: 2, amp: 0.15 }, strike: noise(1500, 3, 0.07, 41 + k) })),
      early: ROOM5, damp: S(s, { from: 0.4, to: 0.7 }, { from: 0.85, to: 1.4 }),
      reverb: S(s, { t60: 0.45, mix: 0.17 }, { t60: 0.85, mix: 0.2 }), fadeOut: 0.06 }) },
  { id: 'tunnus-puu', group: 'soitin', name: 'Tunnus puu',
    desc: 'Habitat-aihe marimballa: D5 → A5 ja pehmeä F♯6.',
    how: 'Sama marimba kuin yllä (lankakapulan kosketus, resonaattori, kaksoiskomponentit), aihe 0 / 120 / 260 ms, lyhyessä 0 / 95 / 205 ms; pieni huone.',
    make: (s) => ({
      dur: S(s, 0.72, 1.3), decays: S(s, 0.55, 1),
      voices: MOTIF5.map(([at, n, amp, pan], k) => struck(at * S(s, 0.79, 1), n, BAR, {
        amp, pan, width: 0.15, contact: 1.1, thump: { ms: 2.5, amp: 0.25 }, split: { cents: 1.5, level: 0.25, decay: 0.5 }, jitter: 2, seed: 141 + k,
        strike: noise(1300, 5, 0.1, 141 + k) })),
      box: [[180, 3, 0.25]],
      early: ROOM5, damp: S(s, { from: 0.4, to: 0.66 }, { from: 0.75, to: 1.2 }),
      reverb: S(s, { t60: 0.42, mix: 0.17 }, { t60: 0.78, mix: 0.2 }), fadeOut: 0.06 }) },
  { id: 'pisara', group: 'luonto', name: 'Pisara',
    desc: 'Kolme vesipisaraa kiviseen altaaseen.',
    how: 'Kuplaresonanssit 1000, 1350 ja 1700 Hz, sävel asettuu ja jatkaa nousuaan kuplan lyhyen elämän ajan kuten pinnan lähellä; jokaisen pisaran alla hento matala ”plup” ja roiske; luolan varhaiset heijastukset kauempana.',
    make: (s) => ({
      dur: S(s, 0.68, 1.25),
      voices: [[0, 1000, 1, -0.2, 0.018], [0.17, 1350, 0.65, 0.3, 0.016], [0.29, 1700, 0.35, 0.05, 0.014]].map(([at, f, amp, pan, tau], k) => struck(at * S(s, 0.85, 1), f, DROPLET, {
        amp, pan, width: 0.1, pitch: { from: 0.55, tau }, rise: 0.6, jitter: 3, seed: 61 + k,
        strike: k < 2 ? noise(2600, 1, 0.04 - 0.01 * k, 61 + k) : undefined })),
      early: { taps: [[11.3, 0.2, true], [19.7, 0.17, false], [31.1, 0.13, true], [43.9, 0.1, false], [61.3, 0.06, true]], tone: 3000 },
      reverb: S(s, { t60: 0.45, mix: 0.3, predelay: 0.016 }, { t60: 0.85, mix: 0.34, predelay: 0.018 }), fadeOut: 0.06 }) },
  { id: 'lasit', group: 'luonto', name: 'Lasit',
    desc: 'Kaksi ohutta lasia kilahtaa: A5 ja D6.',
    how: 'Lasin moodit kahtena huojuvana komponenttina (lasi ei ole täysin pyöreä), kova 0,15 ms kosketus ja kirkas isku; lasit soivat ja hiljenevät sitten kuin sormi koskisi niitä; pieni huone.',
    make: (s) => ({
      dur: S(s, 0.78, 1.45), decays: S(s, 0.55, 1),
      voices: [[0, 'A5', 0.8, -0.25], [0.16, 'D6', 0.7, 0.3]].map(([at, n, amp, pan], k) => struck(at * S(s, 0.8, 1), n, GLASS5, {
        amp, pan, width: 0.2, contact: 0.15, split: { cents: 4, level: 0.55, decay: 1 }, jitter: 3, seed: 81 + k,
        strike: noise(2500, 1.5, 0.05, 81 + k) })),
      early: ROOM5, damp: S(s, { from: 0.4, to: 0.7 }, { from: 0.78, to: 1.3 }),
      reverb: S(s, { t60: 0.45, mix: 0.18 }, { t60: 0.8, mix: 0.22 }), fadeOut: 0.06 }) },
  { id: 'tuulikello', group: 'luonto', name: 'Tuulikello',
    desc: 'Viisi putkea pentatonisessa vireessä heilahtaa tuulessa.',
    how: 'Vapaan tangon moodit (1 : 2,756 : 5,404 : 8,933), kukin kahtena huojuvana komponenttina, puisen kielen 0,25 ms kosketus ja lievä satunnainen epävireisyys; ulkoilman harvat heijastukset; lyhyessä putket heilahtavat tiiviimmin.',
    make: (s) => ({
      dur: S(s, 0.78, 1.45), decays: S(s, 0.45, 1),
      voices: [['C6', 0.75, -0.1], ['E6', 0.55, 0.5], ['A5', 0.85, -0.55], ['D6', 0.5, 0.25], ['G5', 0.6, -0.3]].map(([n, amp, pan], k) => struck(S(s, [0, 0.05, 0.11, 0.16, 0.22], [0, 0.07, 0.16, 0.235, 0.34])[k], n, TUBE5, {
        amp, pan, width: 0.12, contact: 0.25, split: { cents: 3.6, level: 0.35, decay: 0.8 }, jitter: 3, seed: 91 + k,
        strike: noise(3000, 1, 0.035, 91 + k) })),
      early: { taps: [[13.1, 0.14, true], [21.7, 0.12, false], [33.3, 0.09, true], [52.9, 0.05, false]], tone: 3300 },
      damp: S(s, { from: 0.42, to: 0.7 }, { from: 0.92, to: 1.33 }),
      reverb: S(s, { t60: 0.45, mix: 0.2 }, { t60: 0.9, mix: 0.24 }), fadeOut: 0.06 }) },
  { id: 'kuplat', group: 'luonto', name: 'Kuplat',
    desc: 'Pieniä kuplia nousee pintaan.',
    how: 'Minnaert-kuplat (390–980 Hz), joiden sävel nousee koko lyhyen elämänsä ajan, kun kupla lähestyy pintaa; yksi isompi, matala kupla pohjalla; pitkässä vielä kaksi myöhäistä pientä kuplaa; pienen altaan heijastukset.',
    make: (s) => ({
      dur: S(s, 0.6, 1.2),
      voices: [[0, 620, 0.9, -0.35], [0.03, 390, 0.35, 0.1, 0.06], [0.07, 820, 0.75, 0.3], [0.15, 700, 0.8, -0.05], [0.2, 980, 0.6, 0.45],
        ...(s ? [] : [[0.42, 880, 0.35, -0.4], [0.58, 1080, 0.22, 0.3]])].map(([at, f, amp, pan, d], k) => struck(at, f, d ? [[1, 1, d]] : BUBBLE5, {
        amp, pan, pitch: { from: 0.6, tau: 0.01 }, rise: 1.6, jitter: 4, seed: 121 + k })),
      early: ROOM5, reverb: S(s, { t60: 0.38, mix: 0.22 }, { t60: 0.6, mix: 0.25 }), fadeOut: 0.06 }) },
  { id: 'kulho', group: 'luonto', name: 'Kulho',
    desc: 'Laulava kulho, huopanuijan pehmeä lyönti, G4.',
    how: 'Kulhon moodit kahtena kymmenen sentin päässä toisistaan olevana komponenttina (kulho ei ole täysin pyöreä, siitä hidas huojunta), huopanuijan 4 ms kosketus ja tömähdys, kulhon runko alaoktaavilla ja heikko kvintti; soi täyteen ja hiljenee kuin käsi laskeutuisi reunalle.',
    make: (s) => ({
      dur: S(s, 0.8, 1.5), decays: S(s, 0.5, 1),
      voices: [struck(0, 'G4', BOWL5, { amp: 1, pan: 0, width: 0.35, attack: 0.004, contact: 4, thump: { ms: 6, amp: 0.15 }, split: { cents: 10, level: 0.8, decay: 1 }, jitter: 2, seed: 101,
        strike: noise(900, 6, 0.06, 101) })],
      early: ROOM5, damp: S(s, { from: 0.42, to: 0.74 }, { from: 0.75, to: 1.36 }),
      reverb: S(s, { t60: 0.5, mix: 0.2 }, { t60: 0.95, mix: 0.25 }), fadeOut: 0.06 }) },
  // ---- Redone candidates ----
  { id: 'savelrumpu', group: 'soitin', name: 'Sävelrumpu', redone: true,
    desc: 'Teräksisen sävelrummun kaksi kieltä kuminuijalla: A4 → E5.',
    how: 'Kielen viritetyt moodit (1 : 2 : 3,01) ja kaksi heikkoa virittämätöntä levymoodia, jotka tekevät siitä metallia; kuminuijan 2,5 ms kosketus pyöristää iskun ja sen tömähdys soittaa rummun kuoren resonanssit (150, 330, 620 Hz); jokainen moodi kahtena komponenttina, joista toinen sammuu nopeasti; pieni huone.',
    make: (s) => ({
      dur: S(s, 0.76, 1.42), decays: S(s, 0.5, 1),
      voices: [[0, 'A4', 0.9, -0.25], [0.16, 'E5', 0.95, 0.25]].map(([at, n, amp, pan], k) => struck(at * S(s, 0.8, 1), n, TONGUE5, {
        amp, pan, width: 0.2, attack: 0.002, contact: 2.5, thump: { ms: 4, amp: 0.45 }, split: { cents: 2.5, level: 0.5, decay: 0.4 }, jitter: 3, seed: 171 + k,
        strike: noise(700, 6, 0.04, 171 + k) })),
      box: [[150, 6, 0.7], [330, 5, 0.3], [620, 8, 0.15]],
      early: ROOM5, damp: S(s, { from: 0.4, to: 0.7 }, { from: 0.85, to: 1.35 }),
      reverb: S(s, { t60: 0.45, mix: 0.18 }, { t60: 0.85, mix: 0.22 }), fadeOut: 0.06 }) },
  { id: 'harppu', group: 'soitin', name: 'Harppu', redone: true,
    desc: 'Harpun kolme kieltä nousevana murtona: F4, C5, A5.',
    how: 'Kieli kolmion muotoon vedettynä (osasävelet ∝ sin(πhp)/h²) hieman venyneinä, kukin kahtena polarisaationa, joista pystysuora sammuu nopeasti; sormenpään 0,8 ms kosketus, sävel asettuu näppäyksen jälkeen; kaikukopan kolme leveää resonanssia (240, 520, 1100 Hz) ja sormen kohina; pieni huone.',
    make: (s) => ({
      dur: S(s, 0.76, 1.42), decays: S(s, 0.5, 1),
      voices: [[0, 'F4', 0.85, -0.35], [0.09, 'C5', 0.8, 0], [0.18, 'A5', 0.7, 0.35]].map(([at, n, amp, pan], k) => struck(at * S(s, 0.8, 1), n, string5(hz(n), 0.33, 0.8), {
        amp, pan, width: 0.15, attack: 0.002, contact: 0.8, pitch: { from: 1.004, tau: 0.04 }, split: { cents: 1.2, level: 0.6, decay: 0.3 }, jitter: 1.5, seed: 181 + k,
        thump: { ms: 1.5, amp: 0.1 }, strike: noise(1800, 2, 0.03, 181 + k) })),
      box: [[240, 2.5, 0.45], [520, 3, 0.3], [1100, 4, 0.15]],
      early: ROOM5, damp: S(s, { from: 0.4, to: 0.7 }, { from: 0.85, to: 1.35 }),
      reverb: S(s, { t60: 0.45, mix: 0.18 }, { t60: 0.85, mix: 0.22 }), fadeOut: 0.06 }) },
  { id: 'kitara', group: 'soitin', name: 'Kitara', redone: true,
    desc: 'Nailonkielisen kitaran E-duurisointu peukalolla sivellen.',
    how: 'Kuusi kieltä E3–E5 alaspäin sivellen 13 ms välein; kielet kuten Harpussa mutta näppäys lähempää tallaa ja peukalon pehmeä 1,2 ms kosketus; kaksi polarisaatiota, asettuva sävel; kopan resonanssit (100, 205, 410, 800 Hz), joita jokainen kieli soittaa; pieni huone.',
    make: (s) => ({
      dur: S(s, 0.78, 1.45), decays: S(s, 0.5, 1),
      voices: ['E3', 'B3', 'E4', 'G#4', 'B4', 'E5'].map((n, k) => struck(k * 0.013, n, string5(hz(n), 0.18, 0.9), {
        amp: [0.6, 0.6, 0.62, 0.6, 0.55, 0.55][k], pan: -0.35 + 0.14 * k, width: 0.1, attack: 0.002, contact: 1.2, pitch: { from: 1.003, tau: 0.03 },
        split: { cents: 0.8, level: 0.5, decay: 0.35 }, jitter: 1.5, seed: 191 + k, thump: { ms: 2, amp: 0.12 }, strike: noise(1500, 2, 0.02, 191 + k) })),
      box: [[100, 3, 0.5], [205, 4, 0.6], [410, 4, 0.35], [800, 3, 0.15]],
      early: ROOM5, damp: S(s, { from: 0.4, to: 0.72 }, { from: 0.85, to: 1.38 }),
      reverb: S(s, { t60: 0.42, mix: 0.16 }, { t60: 0.8, mix: 0.2 }), fadeOut: 0.06 }) },
  { id: 'kivi-lampeen', group: 'luonto', name: 'Kivi lampeen', redone: true,
    desc: 'Pieni kivi putoaa lampeen: plumpsahdus, roiskepisarat ja kaksi kuplaa.',
    how: 'Roiske (1,5 kHz kohina), sitten kiven jättämän ontelon matala kupla 260 Hz, jonka sävel nousee, ja sen kuroutuessa pienempi kupla; perään satunnaisesti putoilevat roiskepisarat (1,4–2,6 kHz) ja kaksi nousevaa kuplaa; ulkona veden pinnan heijastukset ja kaukainen kaiku rannasta.',
    make: (s) => {
      const drops = [];
      const rand = mulberry32(201);
      const n = s ? 4 : 7;
      for (let k = 0; k < n; k++) drops.push(struck((s ? 0.1 : 0.12) + rand() * (s ? 0.22 : 0.5), 1400 + rand() * 1200, [[1, 1, 0.018]], {
        amp: 0.08 + rand() * 0.1, pan: rand() * 1.6 - 0.8, pitch: { from: 0.6, tau: 0.006 }, rise: 4, seed: 210 + k }));
      return {
        dur: S(s, 0.62, 1.25),
        voices: [
          struck(0, 1500, [[1, 0.0001, 0.01]], { amp: 1, pan: 0.25, strike: noise(1500, 4, 0.1, 201, 0.6) }),
          struck(0.012, 260, [[1, 1, 0.07], [1.9, 0.06, 0.03]], { amp: 1, pan: -0.15, width: 0.2, split: { cents: 12, level: 0.35, decay: 0.8 }, attack: 0.002, pitch: { from: 0.55, tau: 0.025 }, rise: 2.5, seed: 202 }),
          struck(0.05, 520, BUBBLE5, { amp: 0.35, pan: 0.15, pitch: { from: 0.6, tau: 0.01 }, rise: 3, seed: 203 }),
          struck(0.2, 700, BUBBLE5, { amp: 0.25, pan: 0.35, pitch: { from: 0.6, tau: 0.01 }, rise: 2, seed: 204 }),
          struck(S(s, 0.27, 0.32), 950, BUBBLE5, { amp: 0.18, pan: -0.3, pitch: { from: 0.6, tau: 0.009 }, rise: 2, seed: 205 }),
          ...drops],
        early: OUTDOOR, reverb: S(s, { t60: 0.35, mix: 0.15, predelay: 0.015 }, { t60: 0.55, mix: 0.18, predelay: 0.015 }), fadeOut: 0.06 };
    } },
  { id: 'jaapuikot', group: 'luonto', name: 'Jääpuikot', redone: true,
    desc: 'Kolme jääpuikkoa räystäällä, napautus laskevana: E6, C6, A5.',
    how: 'Kartiomaisen jäätangon moodit (1 : 2,62 : 4,95 : 7,9) kahtena huojuvana komponenttina ja selvä satunnainen epävireisyys (jää ei ole tasaista); kova 0,12 ms napautus; jokainen napautus herättää naapuripuikot hiljaa soimaan; ulkoilman heijastukset räystään alla.',
    make: (s) => {
      const notes = [['E6', 0.6, 0.35], ['C6', 0.7, -0.1], ['A5', 0.85, -0.35]];
      return {
        dur: S(s, 0.72, 1.38), decays: S(s, 0.55, 1),
        voices: notes.map(([n, amp, pan], k) => struck(k * S(s, 0.1, 0.13), n, [...ICE,
          // Sympathetic ringing: the neighbours sound faintly, swelling in.
          ...notes.filter((_, j) => j !== k).map(([m]) => [hz(m) / hz(n), 0.05, 0.3, 0.02])], {
          amp, pan, width: 0.15, contact: 0.12, split: { cents: 6, level: 0.5, decay: 0.7 }, jitter: 8, seed: 211 + k,
          strike: noise(3200, 1, 0.035, 211 + k, 1.2) })),
        early: { taps: [[9.1, 0.15, true], [15.9, 0.12, false], [24.7, 0.09, true], [41.3, 0.05, false]], tone: 3300 },
        damp: S(s, { from: 0.38, to: 0.66 }, { from: 0.75, to: 1.24 }),
        reverb: S(s, { t60: 0.42, mix: 0.2 }, { t60: 0.8, mix: 0.24 }), fadeOut: 0.06 };
    } },
];

// Two renders per sound: `<id>/short` and `<id>/long`.
export const LENGTH_NAMES = { short: 'Lyhyt', long: 'Pitkä' };
export const SOUNDS = SOUND_DEFS.map(({ make, ...s }) => ({ ...s, r4: `r4-${s.id}`, variants: {
  short: { ...make(true), key: `${s.id}/short`, of: s.id, length: 'short' },
  long: { ...make(false), key: `${s.id}/long`, of: s.id, length: 'long' } } }));
export const BEFORE = R4_SRC.map(r => ({ ...r, key: `r4-${r.id}`, id: `r4-${r.id}`, of: r.id, name: `${r.name} (kierros 4)`, reference: true }));
/** Every render on the page: both lengths of each sound, then round 4's versions. */
export const ALL = [...SOUNDS.flatMap(s => [s.variants.short, s.variants.long]), ...BEFORE];
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

// Round 5's voice. Each mode becomes one or two components (`split`), each
// slightly detuned at random (`jitter`, seeded so the render is reproducible),
// weighted by the spectrum of the contact force (`contact`), and panned a
// little to alternate sides (`width`). The contact pulse itself (`thump`) and
// band-passed strike noise are added at the onset. `decays` scales every decay
// time: the short length of a sound is the same object, damped sooner.
function renderStruck(v, L, R, sr, decays = 1) {
  const start = Math.round(v.at * sr), amp = v.amp ?? 1, n = L.length;
  const rand = mulberry32(v.seed ?? 1);
  const gauss = () => { const u = rand() || 1e-9, w = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * w); };
  const tc = (v.contact ?? 0) / 1000;
  // A half-sine contact force of length tc falls 12 dB/octave above ~0.6/tc.
  const weight = (f) => (tc ? 1 / Math.sqrt(1 + (f * tc / 0.6) ** 4) : 1);
  const w0 = weight(v.f);
  const comps = [];
  v.modes.forEach(([ratio, a, decay, att], m) => {
    const cents = (v.jitter ?? 0) * gauss() * (m ? 1 : 0.3);
    const r = ratio * Math.pow(2, cents / 1200);
    const side = m % 2 ? 1 : -1;
    const base = a * weight(v.f * r) / w0;
    const p = (v.pan ?? 0) + side * (v.width ?? 0);
    comps.push({ r, a: base, k: Math.exp(-1 / (decay * decays * sr)), g: panGains(p), att });
    if (v.split) {
      // The partner: a few cents away (direction at random), on the other side,
      // with its own decay. Its beating and decay are the object's asymmetry.
      const c2 = v.split.cents * (0.7 + 0.6 * rand()) * (rand() < 0.5 ? -1 : 1);
      comps.push({ r: r * Math.pow(2, c2 / 1200), a: base * v.split.level, k: Math.exp(-1 / (decay * decays * v.split.decay * sr)),
        g: panGains((v.pan ?? 0) - side * (v.width ?? 0)), att });
    }
  });
  const [gl, gr] = panGains(v.pan);
  let noise = null;
  if (v.strike) {
    const nr = mulberry32(v.strike.seed), c = biquad('bp', v.strike.f, v.strike.q, sr);
    const len = Math.min(n - start, Math.round(v.strike.ms / 1000 * sr * 8));
    noise = new Float64Array(Math.max(0, len));
    for (let i = 0; i < noise.length; i++) noise[i] = (nr() * 2 - 1) * Math.exp(-i / (v.strike.ms / 1000 * sr)) * rcos(i / sr, 0.0003);
    filter(noise, c);
  }
  const thumpN = v.thump ? Math.round(v.thump.ms / 1000 * sr) : 0;
  const env = comps.map(() => 1), phase = comps.map(() => 0);
  const trem = v.tremolo;
  for (let i = start; i < n; i++) {
    const t = (i - start) / sr;
    let bend = v.pitch ? 1 + (v.pitch.from - 1) * Math.exp(-t / v.pitch.tau) : 1;
    if (v.rise) bend *= 1 + v.rise * t;
    const att = rcos(t, v.attack);
    const tr = trem ? 1 - trem.depth * (0.5 - 0.5 * Math.cos(TAU * trem.rate * t)) : 1;
    let l = 0, r = 0;
    for (let m = 0; m < comps.length; m++) {
      const c = comps[m];
      if (env[m] < 1e-7) continue;
      const s = (c.att ? c.a * rcos(t, c.att) : c.a) * env[m] * Math.sin(phase[m]);
      l += s * c.g[0]; r += s * c.g[1];
      env[m] *= c.k;
      phase[m] += TAU * v.f * c.r * bend / sr;
    }
    const k = amp * att * tr;
    L[i] += l * k; R[i] += r * k;
    const j = i - start;
    if (noise && j < noise.length) { const s = amp * v.strike.amp * 6 * noise[j]; L[i] += s * gl; R[i] += s * gr; }
    if (j < thumpN) { const s = amp * v.thump.amp * Math.sin(Math.PI * j / thumpN); L[i] += s * gl; R[i] += s * gr; }
  }
}

// The body: resonant band-pass filters [Hz, Q, gain] through which the whole
// dry sound passes, added to it. A filter rings with whatever excites it, the
// strike and the thump included, which is how a box or soundboard colours an
// instrument; a fixed sine at that frequency (round 4's `body`) does not.
function box(L, R, rows, sr) {
  for (const ch of [L, R]) {
    const wet = new Float64Array(ch.length);
    for (const [f, q, g] of rows) {
      const x = Float64Array.from(ch);
      filter(x, biquad('bp', f, q, sr));
      for (let i = 0; i < x.length; i++) wet[i] += g * x[i];
    }
    for (let i = 0; i < ch.length; i++) ch[i] += wet[i];
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
  for (const v of sound.voices) {
    if (v.kind === 'struck') renderStruck(v, L, R, sr, sound.decays);
    else renderModal(v, L, R, sr);
  }
  if (sound.box) box(L, R, sound.box, sr);
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
