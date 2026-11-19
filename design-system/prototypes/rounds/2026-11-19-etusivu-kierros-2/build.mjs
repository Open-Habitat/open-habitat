// node build.mjs [out.html]
// Builds the round as one self-contained HTML file: tokens and fonts from
// design-system/, the Päivä theme and the mark's CSS from
// website/src/styles/brand.css (read, never changed), the README screenshots
// from docs/assets/readme/ downscaled to WebP with ImageMagick (into $TMPDIR,
// so set TMPDIR to your scratch directory), the skill's floating picker from
// ../../lib/picker.css and picker.js verbatim, and this round's round.css and
// round.js.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const ROUND = '2026-11-19-etusivu-kierros-2';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const ds = join(root, 'design-system');
const out = resolve(process.argv[2] || join(ds, `prototypes/dist/${ROUND}.html`));
mkdirSync(dirname(out), { recursive: true });
const read = (p) => readFileSync(p, 'utf8');
const im = (args) => execFileSync('convert', args);

const scratch = mkdtempSync(join(tmpdir(), 'etusivu2-'));
const readme = (n) => join(root, 'docs/assets/readme', `${n}.png`);

// The hero capture is not centred in its own canvas: 78 px of background on the
// left, 67 on the right, 78 above and only 11 below, where the phone's shadow
// is cut by the edge. Trim the extra 11 px on the left and extend the bottom by
// a strip that fades the last row into the background, so the content sits in
// the middle of the canvas and the canvas edge never shows on the page's band.
const BG = 'rgb(232,236,229)';
const heroSrc = join(scratch, 'hero-centred.png');
const strip = join(scratch, 'hero-strip.png');
im([readme('hero'), '-crop', '3040x1+0+1919', '+repage', '-scale', '3040x80!',
  '(', '-size', '3040x80', `xc:${BG}`, ')',
  '(', '-size', '3040x80', 'gradient:black-white', ')',
  '-composite', strip]);
im([readme('hero'), strip, '-append', '-crop', '3029x2000+11+0', '+repage', heroSrc]);

// Screenshots: the widest each is ever shown at, at about 1.5x.
const WIDTH = { hero: 2600, view: 2000, 'terminal-editor': 1800 };
const IMG = {};
for (const name of ['hero', 'agent-at-work', 'first-use', 'your-turn', 'steer', 'workers', 'connections', 'view', 'build-on-top', 'people', 'ai-account', 'terminal-editor']) {
  const src = name === 'hero' ? heroSrc : readme(name);
  const dst = join(scratch, `${name}.webp`);
  im([src, '-resize', `${WIDTH[name] || 1400}x>`, '-quality', '86', '-define', 'webp:method=6', dst]);
  const [w, h] = execFileSync('identify', ['-format', '%w %h', dst]).toString().split(' ').map(Number);
  IMG[name] = { src: `data:image/webp;base64,${readFileSync(dst).toString('base64')}`, w, h };
}

const fontData = (css) => css.replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (_, f) => `url("data:font/woff2;base64,${readFileSync(join(ds, 'fonts', f)).toString('base64')}")`);
const tokens = ['colors', 'typography', 'spacing', 'motion'].map((n) => read(join(ds, 'tokens', `${n}.css`))).join('\n');
const brand = read(join(root, 'website/src/styles/brand.css'));
const css = [fontData(tokens), brand, read(join(here, 'round.css')), read(join(ds, 'prototypes/lib/picker.css'))].join('\n');

// Picker names and one-line descriptions are Finnish (the reader is Jari);
// the pages are English. The descriptions show in a strip above each page.
const VARIANTS = [
  ['Alicen päivä', 'Kuvan jälkeen yksi tarina: Alicen ensimmäinen päivä kantaa sivun, ruutu pysyy paikallaan ja vaihtuu luvun mukaan.'],
  ['Kysymykset', 'Kuvan jälkeen lukijan kysymykset järjestyksessä, lyhyt vastaus ja kuva todisteena; ensimmäinen päivä on yksi vastaus filminauhana.'],
  ['Tutki itse', 'Kuvan jälkeen lyhyt sivu: ensimmäinen päivä neljänä askeleena, kokeiltava pyyntövalikko ja asennus yhtenä viestinä.'],
];
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const picker = `<nav class="proto-picker" aria-label="Prototype variants">
  <span class="proto-picker-highlight" aria-hidden="true"></span>
${VARIANTS.map(([n, d], i) => `  <button class="proto-picker-item"${i === 0 ? ' data-active aria-current="true"' : ''} title="${esc(d)}">${esc(n)}</button>`).join('\n')}
</nav>`;

const favicon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2c6e3f" stroke-width="2" stroke-linecap="round"><path d="M14 3H8a5 5 0 0 0-5 5v8a5 5 0 0 0 5 5h8a5 5 0 0 0 5-5v-6"/><circle cx="12" cy="12" r="2.5" fill="#2c6e3f" stroke="none"/></svg>';
const js = `const IMG=${JSON.stringify(IMG)};\nconst VARIANTS=${JSON.stringify(VARIANTS)};\n${read(join(here, 'round.js'))}\n${read(join(ds, 'prototypes/lib/picker.js'))}`;
const html = `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="prototype-round" content="${ROUND}"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Etusivu, kierros 2 · kuvan jälkeen</title><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon)}"><style>${css}</style></head><body><div id="stage"></div>${picker}<script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
writeFileSync(out, html);
console.log(`${out} ${(statSync(out).size / 1e6).toFixed(2)} MB`);
