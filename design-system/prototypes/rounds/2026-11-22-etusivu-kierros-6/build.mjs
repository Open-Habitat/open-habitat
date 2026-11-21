// node build.mjs [out.html]
// Builds the round as one self-contained HTML file: tokens and fonts from
// design-system/, the Päivä theme and the mark's CSS from
// website/src/styles/brand.css (read, never changed), the conversation
// language from ../../lib/language.css, round 2's hero capture from
// docs/assets/readme/hero.png centred in its canvas as round 2 does it and
// downscaled to WebP with ImageMagick (into $TMPDIR, so set TMPDIR to your
// scratch directory), the skill's floating picker from ../../lib/picker.css
// and picker.js verbatim, and this round's round.css and round.js.
// The day's screens are drawn in HTML, so the hero is the only picture.
// Round 6 (2026-11-22-etusivu-kierros-6): round 5 with the agreed cast, one
// company of seven in one Habitat. The round's code is four files read in this order: round.js (shared pieces, the
// story engine, Alice's day), caps.js (capabilities), roles.js (other people's
// days) and variants.js (the three ways of showing roles).
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const ROUND = '2026-11-22-etusivu-kierros-6';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const ds = join(root, 'design-system');
const out = resolve(process.argv[2] || join(ds, `prototypes/dist/${ROUND}.html`));
mkdirSync(dirname(out), { recursive: true });
const read = (p) => readFileSync(p, 'utf8');
const im = (args) => execFileSync('convert', args);

// Round 2's centring of the hero capture (see its build.mjs): trim 11 px on the
// left and extend the bottom by a strip that fades into the background.
const scratch = mkdtempSync(join(tmpdir(), 'etusivu-6-'));
const heroPng = join(root, 'docs/assets/readme/hero.png');
const BG = 'rgb(232,236,229)';
const strip = join(scratch, 'hero-strip.png');
const centred = join(scratch, 'hero-centred.png');
im([heroPng, '-crop', '3040x1+0+1919', '+repage', '-scale', '3040x80!',
  '(', '-size', '3040x80', `xc:${BG}`, ')',
  '(', '-size', '3040x80', 'gradient:black-white', ')',
  '-composite', strip]);
im([heroPng, strip, '-append', '-crop', '3029x2000+11+0', '+repage', centred]);
const heroWebp = join(scratch, 'hero.webp');
im([centred, '-resize', '2600x>', '-quality', '86', '-define', 'webp:method=6', heroWebp]);
const [w, h] = execFileSync('identify', ['-format', '%w %h', heroWebp]).toString().split(' ').map(Number);
const IMG = { hero: { src: `data:image/webp;base64,${readFileSync(heroWebp).toString('base64')}`, w, h } };

const fontData = (css) => css.replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (_, f) => `url("data:font/woff2;base64,${readFileSync(join(ds, 'fonts', f)).toString('base64')}")`);
const tokens = ['colors', 'typography', 'spacing', 'motion'].map((n) => read(join(ds, 'tokens', `${n}.css`))).join('\n');
const brand = read(join(root, 'website/src/styles/brand.css'));
const lib = (n) => read(join(ds, 'prototypes/lib', n));
const css = [fontData(tokens), brand, lib('language.css'), read(join(here, 'round.css')), lib('picker.css')].join('\n');

// Picker names and one-line descriptions are Finnish (the reader is Jari);
// the pages are English. The description shows in a strip above each page
// and as the picker button's title.
const VARIANTS = [
  ['Oma osio', 'Alicen päivän jälkeen osio ”Same place, other work”: Example Studion kuusi muuta (Bob myynti, Kirsi talous, Carol suunnittelija, Dave HR ja toimisto, Erin opettaja, Frank tutkija), kullakin kolme välähdystä omassa näkymässään.'],
  ['Rinnakkaiset päivät', 'Alicen päivä on pääraita, ja sen askelten välissä näkyy, mitä kuusi kollegaa tekevät samalla tunnilla omissa näkymissään; viisi kertaa tiedosto siirtyy talon sisällä Alicelle tai Alicelta.'],
  ['Valitse kenen päivä', 'Päiväosion yläreunassa valitsin: Alice oletuksena (ja hänen muilta viikoiltaan kolme välähdystä), ja valinta vaihtaa koko päivän kenen tahansa kuuden kollegan päiväksi samassa muodossa (5–7 välähdystä).'],
];
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const picker = `<nav class="proto-picker" aria-label="Prototype variants">
  <span class="proto-picker-highlight" aria-hidden="true"></span>
${VARIANTS.map(([n, d], i) => `  <button class="proto-picker-item"${i === 0 ? ' data-active aria-current="true"' : ''} title="${esc(d)}">${esc(n)}</button>`).join('\n')}
</nav>`;

const favicon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2c6e3f" stroke-width="2" stroke-linecap="round"><path d="M14 3H8a5 5 0 0 0-5 5v8a5 5 0 0 0 5 5h8a5 5 0 0 0 5-5v-6"/><circle cx="12" cy="12" r="2.5" fill="#2c6e3f" stroke="none"/></svg>';
const js = `const IMG=${JSON.stringify(IMG)};\nconst VARIANTS=${JSON.stringify(VARIANTS)};\n${lib('icons.js')}\n${lib('markdown.js')}\n${['round.js', 'caps.js', 'roles.js', 'variants.js'].map((f) => read(join(here, f))).join('\n')}\n${lib('picker.js')}`;
const html = `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="prototype-round" content="${ROUND}"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Etusivu, kierros 6 · sovittu roolitus</title><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon)}"><style>${css}</style></head><body><div id="stage"></div>${picker}<script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
writeFileSync(out, html);
console.log(`${out} ${(statSync(out).size / 1e6).toFixed(2)} MB`);
