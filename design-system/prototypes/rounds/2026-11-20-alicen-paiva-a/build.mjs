// node build.mjs [out.html]
// Builds the round as one self-contained HTML file: tokens and fonts from
// design-system/, the Päivä theme and the mark's CSS from
// website/src/styles/brand.css (read, never changed), the conversation
// language from ../../lib/language.css, round 2's hero capture from
// docs/assets/readme/hero.png centred and downscaled to WebP with ImageMagick
// (into $TMPDIR, so set TMPDIR to your scratch directory), the skill's floating
// picker from ../../lib/picker.css and picker.js verbatim, and this round's
// round.css and round.js. Every scene's screen is drawn in HTML, not captured.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const ROUND = '2026-11-20-alicen-paiva-a';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const ds = join(root, 'design-system');
const out = resolve(process.argv[2] || join(ds, `prototypes/dist/${ROUND}.html`));
mkdirSync(dirname(out), { recursive: true });
const read = (p) => readFileSync(p, 'utf8');
const im = (args) => execFileSync('convert', args);
const scratch = mkdtempSync(join(tmpdir(), 'alicen-paiva-a-'));

// The hero, exactly as round 2 (2026-11-19-etusivu-kierros-2) prepared it: the
// capture is not centred in its own canvas (78 px of background on the left, 67
// on the right, 11 below), so trim 11 px on the left and extend the bottom with
// a strip that fades the last row into the background.
const BG = 'rgb(232,236,229)';
const src = join(root, 'docs/assets/readme/hero.png');
const strip = join(scratch, 'hero-strip.png');
const centred = join(scratch, 'hero-centred.png');
im([src, '-crop', '3040x1+0+1919', '+repage', '-scale', '3040x80!',
  '(', '-size', '3040x80', `xc:${BG}`, ')',
  '(', '-size', '3040x80', 'gradient:black-white', ')',
  '-composite', strip]);
im([src, strip, '-append', '-crop', '3029x2000+11+0', '+repage', centred]);
const webp = join(scratch, 'hero.webp');
im([centred, '-resize', '2600x>', '-quality', '86', '-define', 'webp:method=6', webp]);
const [w, h] = execFileSync('identify', ['-format', '%w %h', webp]).toString().split(' ').map(Number);
const IMG = { hero: { src: `data:image/webp;base64,${readFileSync(webp).toString('base64')}`, w, h } };

const fontData = (css) => css.replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (_, f) => `url("data:font/woff2;base64,${readFileSync(join(ds, 'fonts', f)).toString('base64')}")`);
const tokens = ['colors', 'typography', 'spacing', 'motion'].map((n) => read(join(ds, 'tokens', `${n}.css`))).join('\n');
const brand = read(join(root, 'website/src/styles/brand.css'));
const css = [fontData(tokens), brand, read(join(ds, 'prototypes/lib/language.css')), read(join(here, 'round.css')), read(join(ds, 'prototypes/lib/picker.css'))].join('\n');

// Picker names and one-line descriptions are Finnish (the reader is Jari);
// the pages are English. The description shows in a strip above each page
// and as the picker button's title.
const VARIANTS = [
  ['Palaverin kaari', 'Alicen torstai on yksi asiakaspalaveri: valmistelu asiakaskansiosta, postista ja kalenterista, kalvot hinnastosta, kysymys puhelimella kesken palaverin, muistio ja tarjous, joka lähtee hänen luvallaan.'],
  ['Reklamaatio', 'Alicen tiistai on yksi tyytymätön asiakas: aamun valitus kansioksi, vedos ja painotiedosto verrataan ohjelmalla, agentti kirjoittaa tarkistimen, ja iltapäivällä sama tarkistin hyväksyy uusintapainoksen välilehden ollessa kiinni.'],
  ['Tarjouspyyntö', 'Alicen maanantai on yksi tarjouspyyntö: 23 liitettä luetaan ohjelmilla, ristiriita kysymykseksi, neljä workeria käy 146 vanhaa projektia referensseiksi, Wordin kommentit yksi kerrallaan, ja hintataulukko täyttyy illalla.'],
];
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const picker = `<nav class="proto-picker" aria-label="Prototype variants">
  <span class="proto-picker-highlight" aria-hidden="true"></span>
${VARIANTS.map(([n, d], i) => `  <button class="proto-picker-item"${i === 0 ? ' data-active aria-current="true"' : ''} title="${esc(d)}">${esc(n)}</button>`).join('\n')}
</nav>`;

const favicon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2c6e3f" stroke-width="2" stroke-linecap="round"><path d="M14 3H8a5 5 0 0 0-5 5v8a5 5 0 0 0 5 5h8a5 5 0 0 0 5-5v-6"/><circle cx="12" cy="12" r="2.5" fill="#2c6e3f" stroke="none"/></svg>';
const js = `const IMG=${JSON.stringify(IMG)};\nconst VARIANTS=${JSON.stringify(VARIANTS)};\n${read(join(here, 'round.js'))}\n${read(join(ds, 'prototypes/lib/picker.js'))}`;
const html = `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="prototype-round" content="${ROUND}"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Alicen päivä (a) · yksi palaveri tai asiakas</title><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon)}"><style>${css}</style></head><body><div id="stage"></div>${picker}<script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
writeFileSync(out, html);
console.log(`${out} ${(statSync(out).size / 1e6).toFixed(2)} MB`);
