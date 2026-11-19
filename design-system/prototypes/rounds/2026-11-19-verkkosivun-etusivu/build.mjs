// node build.mjs [out.html]
// Builds the round as one self-contained HTML file: tokens and fonts from
// design-system/, the Päivä theme and the mark's CSS from
// website/src/styles/brand.css (read, never changed), the README screenshots
// from docs/assets/readme/ downscaled to WebP with ImageMagick's `convert`
// (into $TMPDIR, so set TMPDIR to your scratch directory), the picker from
// ../../lib/, and this round's round.css and round.js.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const ds = join(root, 'design-system');
const out = resolve(process.argv[2] || join(ds, 'prototypes/dist/2026-11-19-verkkosivun-etusivu.html'));
mkdirSync(dirname(out), { recursive: true });
const read = (p) => readFileSync(p, 'utf8');

// Screenshots: the widest each is ever shown at, at about 1.5x.
const WIDTH = { hero: 2800, view: 2400, 'terminal-editor': 1896 };
const scratch = mkdtempSync(join(tmpdir(), 'etusivu-'));
const IMG = {};
for (const name of ['hero', 'agent-at-work', 'first-use', 'your-turn', 'steer', 'workers', 'connections', 'view', 'build-on-top', 'people', 'ai-account', 'terminal-editor']) {
  const src = join(root, 'docs/assets/readme', `${name}.png`);
  const dst = join(scratch, `${name}.webp`);
  execFileSync('convert', [src, '-resize', `${WIDTH[name] || 1600}x>`, '-quality', '88', '-define', 'webp:method=6', dst]);
  const [w, h] = execFileSync('identify', ['-format', '%w %h', dst]).toString().split(' ').map(Number);
  IMG[name] = { src: `data:image/webp;base64,${readFileSync(dst).toString('base64')}`, w, h };
}

// Tokens with the fonts inlined, then the brand's Päivä theme and mark from the website.
const fontData = (css) => css.replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (_, f) => `url("data:font/woff2;base64,${readFileSync(join(ds, 'fonts', f)).toString('base64')}")`);
const tokens = ['colors', 'typography', 'spacing', 'motion'].map((n) => read(join(ds, 'tokens', `${n}.css`))).join('\n');
const brand = read(join(root, 'website/src/styles/brand.css'));
const css = [fontData(tokens), brand, read(join(ds, 'prototypes/lib/picker.css')), read(join(here, 'round.css'))].join('\n');

const DIRECTIONS = [
  ['Kuva edellä', 'Avautuu isolla tuotekuvalla; kuvakierros, jossa teksti on kuvatekstiä.'],
  ['Perustelu edellä', 'Avautuu väitteellä ilman kuvaa; neljän askeleen perustelu, kuvat todisteina.'],
  ['Tiimin päivä', 'Avautuu yhden tiimin maanantaista; aikajana, kuvat kohtauksina.'],
];
const bar = `<header class="rq" aria-label="Kierroksen valitsin">
<nav class="proto-picker" aria-label="Suunnat">
  <span class="proto-picker-highlight" aria-hidden="true"></span>
${DIRECTIONS.map(([n], i) => `  <button class="proto-picker-item"${i === 0 ? ' data-active aria-current="true"' : ''}>${i + 1} ${n}</button>`).join('\n')}
</nav>
<ol class="rq-lines">${DIRECTIONS.map(([n, l], i) => `<li${i === 0 ? ' aria-current="true"' : ''}><b>${i + 1} ${n}.</b> ${l}</li>`).join('')}</ol>
</header>`;

const favicon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2c6e3f" stroke-width="2" stroke-linecap="round"><path d="M14 3H8a5 5 0 0 0-5 5v8a5 5 0 0 0 5 5h8a5 5 0 0 0 5-5v-6"/><circle cx="12" cy="12" r="2.5" fill="#2c6e3f" stroke="none"/></svg>';
const js = `const IMG=${JSON.stringify(IMG)};\n${read(join(here, 'round.js'))}\n${read(join(ds, 'prototypes/lib/picker.js'))}`;
const html = `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="prototype-round" content="2026-11-19-verkkosivun-etusivu"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Etusivu · kolme avointa suuntaa</title><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon)}"><style>${css}</style></head><body>${bar}<div id="stage"></div><script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
writeFileSync(out, html);
console.log(`${out} ${(statSync(out).size / 1e6).toFixed(2)} MB`);
