// node blocks/caps-print/assets.mjs: the certificates and the choir parts,
// made by the programs the block names.
//
//   Typst      certificate.typ + pupils.csv -> one PDF per class (118 pages)
//   LilyPond   silent-night.ily -> full score, four part books (as written in
//              D and a whole tone lower in C) and the soprano practice MIDI
//   FluidSynth the MIDI through a General MIDI soundfont -> the practice track
//   ffmpeg     the track under the soprano part, with a playhead that follows
//              the notes (their places are read from a LilyPond render with
//              red note heads; their lengths from the source)
//
// Where the programs are (defaults: on PATH):
//   TYPST, LILYPOND, FLUIDSYNTH   the executables
//   SOUNDFONT                     a General MIDI .sf2 (FluidR3_GM.sf2)
//   URW_FONTS                     a directory tree with the URW base 35 fonts
// The tested route on this aarch64 host is in NOTES.md. Set TMPDIR to scratch.
// Writes into $ETUSIVU_ASSETS/caps-print/.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), 'caps-print');
mkdirSync(out, { recursive: true });
const E = process.env;
const typst = E.TYPST || 'typst', lilypond = E.LILYPOND || 'lilypond', fluidsynth = E.FLUIDSYNTH || 'fluidsynth';
const soundfont = E.SOUNDFONT || '/usr/share/sounds/sf2/FluidR3_GM.sf2';
const fontDir = E.URW_FONTS || '/usr/share/fonts';
const scratch = mkdtempSync(join(tmpdir(), 'caps-print-'));
const run = (cmd, args, opt = {}) => execFileSync(cmd, args, { cwd: scratch, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, ...opt }).toString();
const im = (args) => run('convert', args);
const webp = (q = 82) => ['-quality', String(q), '-define', 'webp:method=6'];

// ---------- Certificates: Typst ----------
const classes = [...new Set(readFileSync(join(here, 'pupils.csv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split(',')[0]))];
let pages = 0;
for (const c of classes) {
  const pdf = join(scratch, `certificates-${c}.pdf`);
  run(typst, ['compile', '--font-path', fontDir, '--input', `class=${c}`, join(here, 'certificate.typ'), pdf]);
  pages += Number(/Pages:\s+(\d+)/.exec(run('pdfinfo', [pdf]))[1]);
}
console.log(`typst: ${classes.length} class PDFs, ${pages} certificates`);
// Class 7B, the one the view opens: three pages large, all 21 as a sheet.
run('pdftoppm', ['-r', '150', '-png', join(scratch, 'certificates-7B.pdf'), join(scratch, 'c7b')]);
const c7b = readdirSync(scratch).filter((f) => /^c7b-\d+\.png$/.test(f)).sort();
// Levels 3, 4 and 2: Lena Ashby, Tobias Abbot, Amir Eklund.
for (const [k, n] of [[1, 2], [2, 1], [3, 5]]) im([join(scratch, c7b[n - 1]), '-resize', '1000x', ...webp(84), join(out, `certificate-${k}.webp`)]);
run('montage', [...c7b.map((f) => join(scratch, f)), '-tile', '7x3', '-geometry', '162x+9+9', '-background', '#e9ece6', '-shadow', join(scratch, 'sheet.png')]);
im([join(scratch, 'sheet.png'), '-background', '#e9ece6', '-flatten', '-resize', '1200x', ...webp(80), join(out, 'certificates-7B-sheet.webp')]);

// ---------- Choir parts: LilyPond ----------
const ily = join(here, 'silent-night.ily');
const VOICES = [['soprano', 'Soprano', 'treble'], ['alto', 'Alto', 'treble'], ['tenor', 'Tenor', 'treble_8'], ['bass', 'Bass', 'bass']];
const head = `\\version "2.24.0"\n#(ly:font-config-add-directory "${fontDir}/")\n\\include "${ily}"\n`;
const inKey = (to, music) => (to === 'd' ? `{ \\global ${music} }` : `\\transpose d ${to} { \\global ${music} }`);
const staff = (to, [v, name, clef], { label = false, extra = '', breaks = false } = {}) => `\\new Staff ${label ? `\\with { instrumentName = "${name[0]}" }` : ''} << \\new Voice = "${v}" { \\clef "${clef}" ${extra} ${inKey(to, `\\${v}`)} }${breaks ? ' \\new Voice { \\partBreaks }' : ''} \\new Lyrics \\lyricsto "${v}" \\words >>`;
const part = (to, voice, extra = '') => `${head}\\header { instrument = "${voice[1]}" }\n\\score { ${staff(to, voice, { extra, breaks: true })} \\layout { } }\n`;
const score = (to) => `${head}\\paper { #(set-paper-size "a5") system-system-spacing.basic-distance = #22 }\n\\score { \\new ChoirStaff << ${VOICES.map((v) => staff(to, v, { label: true })).join('\n')} >> \\layout { \\context { \\Lyrics \\override LyricText.font-size = #-1 } } }\n`;
// The practice track for one voice: that voice a clarinet up front, the others a quiet piano.
const practice = (to, own) => `${head}\\score { << ${VOICES.map(([v]) => `\\new Staff \\with { midiInstrument = "${v === own ? 'clarinet' : 'acoustic grand'}" midiMinimumVolume = #${v === own ? 0.9 : 0.3} midiMaximumVolume = #${v === own ? 1.0 : 0.38} } ${inKey(to, `\\${v}`)}`).join('\n')} >> \\midi { } }\n`;
const ly = (name, src) => { writeFileSync(join(scratch, `${name}.ly`), src); run(lilypond, ['--loglevel=WARNING', '-o', name, `${name}.ly`]); return join(scratch, `${name}.pdf`); };
const png = (pdf, name, w) => { run('pdftoppm', ['-scale-to-x', String(w), '-scale-to-y', '-1', '-singlefile', '-png', pdf, join(scratch, name)]); return join(scratch, `${name}.png`); };

// The part page as the view shows it: the whole 160 x 120 mm sheet, 1200 x 900.
const W = 1200, H = 900, CROP = `${W}x${H}+0+0`;
const sop = VOICES[0];
for (const to of ['d', 'c']) im([png(ly(`soprano-${to}`, part(to, sop)), `soprano-${to}`, W), '-crop', CROP, '+repage', ...(to === 'd' ? [...webp(88), join(out, 'soprano-d.webp')] : [join(scratch, 'frame.png')])]);
im([join(scratch, 'frame.png'), ...webp(88), join(out, 'soprano-c.webp')]);
// The five books of the lower version, as thumbnails of their first pages.
for (const v of VOICES.slice(1)) ly(`${v[0]}-c`, part('c', v));
ly('score-c', score('c'));
for (const n of ['score', ...VOICES.map((v) => v[0])]) im([png(join(scratch, `${n}-c.pdf`), `thumb-${n}`, 520), '-gravity', 'north', '-crop', '520x390+0+0', '+repage', '-resize', '360x', ...webp(80), join(out, `book-${n}.webp`)]);
console.log('lilypond: score and four parts in C, soprano in D');

// ---------- Practice track: LilyPond MIDI -> FluidSynth ----------
ly('practice-soprano', practice('c', 'soprano'));
const wav = join(scratch, 'practice-soprano.wav');
run(fluidsynth, ['-ni', '-q', '-g', '1.0', '-r', '44100', '-F', wav, soundfont, join(scratch, 'practice-soprano.midi')], { env: { ...E, SDL_AUDIODRIVER: 'dummy' } });

// ---------- The playhead ----------
// Where each note head is: the same part with red heads, read column by column.
im([png(ly('soprano-red', part('c', sop, '\\override NoteHead.color = #red')), 'soprano-red', W), '-crop', CROP, '+repage', join(scratch, 'red.png')]);
const prof = (file, ops, geom) => { const b = execFileSync('convert', [file, ...ops, '-scale', geom, '-depth', '16', 'gray:-'], { maxBuffer: 1 << 26 }); const a = []; for (let i = 0; i + 1 < b.length; i += 2) a.push(b.readUInt16LE(i) / 65535); return a; };
const groups = (a, on, gap = 3) => { const g = []; a.forEach((v, i) => { if (!on(v)) return; const l = g[g.length - 1]; if (l && i - l[1] <= gap) l[1] = i; else g.push([i, i]); }); return g; };
const redness = ['-fx', '(u.r-u.g)>0.35 ? 1 : 0'];
// Systems: rows that hold red, grouped; a system's rows are far from the next one's.
const rowsRed = prof(join(scratch, 'red.png'), redness, `1x${H}!`);
const systems = groups(rowsRed, (v) => v > 0.0005, 40);
if (systems.length !== 4) throw new Error(`expected 4 systems in the soprano part, found ${systems.length}`);
const heads = systems.map(([y0, y1]) => {
  const cols = prof(join(scratch, 'red.png'), ['-crop', `${W}x${y1 - y0 + 1}+0+${y0}`, '+repage', ...redness], `${W}x1!`);
  return groups(cols, (v) => v > 0.02, 1).map(([a, b]) => (a + b) / 2);
});
// How long each note is, in eighths, from the source (durations are sticky, as in LilyPond).
const src = /soprano = \\relative c'' \{([^}]*)\}/.exec(readFileSync(ily, 'utf8'))[1].replace(/\\bar\s+"[^"]*"|\\break/g, ' ');
let dur = 4; const lens = [];
for (const m of src.matchAll(/(?<![a-z\\])[a-g](?:is|es)?[',]*(\d+)?(\.)?/g)) { if (m[1]) dur = (8 / Number(m[1])) * (m[2] ? 1.5 : 1); lens.push(dur); }
const total = lens.reduce((a, b) => a + b, 0);
if (total !== 72) throw new Error(`soprano is ${total} eighths, expected 72`);
// Notes per system: 18 eighths (three bars) each.
const perSystem = []; { let acc = 0, n = 0; for (const l of lens) { acc += l; n++; if (acc % 18 === 0) { perSystem.push(n); n = 0; } } }
heads.forEach((h, k) => { if (h.length !== perSystem[k]) throw new Error(`system ${k + 1}: ${h.length} note heads found, ${perSystem[k]} notes in the source`); });
const EIGHTH = 60 / 46 / 3; // the tempo in silent-night.ily: dotted crotchet = 46
// Segments [t0, t1, x0, x1, system]: from each note to the next; the last note of a system runs to its end.
const segs = []; { let t = 0, i = 0; heads.forEach((h, k) => h.forEach((x, j) => { const t1 = t + lens[i] * EIGHTH; segs.push([t, t1, x, j + 1 < h.length ? h[j + 1] : Math.min(W - 30, x + 60), k]); t = t1; i++; })); }
const end = segs[segs.length - 1][1];
const f = (n) => n.toFixed(3);
const BAR = 10, PAD = 34;
const xExpr = segs.map(([a, b, x0, x1]) => `between(t,${f(a)},${f(b - 0.0005)})*(${f(x0)}+${f(x1 - x0)}*(t-${f(a)})/${f(b - a)})`).join('+') + `+gte(t,${f(end)})*${f(segs[segs.length - 1][3])}`;
const yExpr = systems.map(([y0], k) => { const s = segs.filter((g) => g[4] === k); const last = k === systems.length - 1; return `${last ? `gte(t,${f(s[0][0])})` : `between(t,${f(s[0][0])},${f(s[s.length - 1][1] - 0.0005)})`}*${Math.max(0, y0 - PAD)}`; }).join('+');
const barH = Math.max(...systems.map(([a, b]) => b - a)) + 2 * PAD;
const graph = `[0:v]fps=25,format=yuv420p[bg];[1:v]format=rgba,colorchannelmixer=aa=0.42[bar];[bg][bar]overlay=x='${xExpr}-${BAR / 2}':y='${yExpr}':eval=frame,format=yuv420p[v]`;
writeFileSync(join(scratch, 'graph.txt'), graph);
const length = end + 1.6;
run('ffmpeg', ['-v', 'error', '-y', '-loop', '1', '-t', f(length), '-i', join(scratch, 'frame.png'), '-f', 'lavfi', '-t', f(length), '-i', `color=c=0x2c6e3f:s=${BAR}x${barH}:r=25`, '-i', wav,
  '-filter_complex_script', join(scratch, 'graph.txt'), '-map', '[v]', '-map', '2:a', '-t', f(length), '-af', `afade=t=out:st=${f(length - 1.2)}:d=1.2`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-movflags', '+faststart', join(out, 'practice-soprano.mp4')]);

for (const n of readdirSync(out).sort()) console.log(n.padEnd(28), `${Math.round(statSync(join(out, n)).size / 1024)} KB`);
