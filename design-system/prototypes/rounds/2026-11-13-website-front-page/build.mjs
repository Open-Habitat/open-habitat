// node build.mjs [out-dir]
// Builds the round as one self-contained static page: offline.html with the
// fonts embedded, and index.html without them for glasspad's sandbox.
// The page text is not copied: it is today's front page text object, read
// from website/src/components/Landing.astro at build time, so the round
// cannot drift from the live claims. Nothing in website/ is changed.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const ds = join(root, 'design-system');
const out = resolve(process.argv[2] || join(ds, 'prototypes/dist/2026-11-13-website-front-page'));
mkdirSync(out, { recursive: true });
const read = (p) => readFileSync(p, 'utf8');

// Today's text, both languages, evaluated with the same two values the
// component interpolates.
const landing = read(join(root, 'website/src/components/Landing.astro'));
const start = landing.indexOf('const t = {');
const end = landing.indexOf('}[lang];', start);
if (start < 0 || end < 0) throw new Error('Landing.astro: text object not found; update build.mjs');
const repo = 'https://github.com/Open-Habitat/open-habitat';
const pi = '<a href="https://github.com/earendil-works/pi">Pi</a>';
const T = new Function('repo', 'pi', `return ${landing.slice(start + 'const t = '.length, end + 1)};`)(repo, pi);
for (const l of ['en', 'fi']) if (!T[l]?.heroTitle || !T[l]?.tryStatus) throw new Error(`Landing.astro: ${l} text incomplete`);

// Tokens: today's colours for the non-colour tokens, then the new themes
// and mark unchanged from the issue (brand.css).
const fontData = (css) => css.replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (_, f) => `url("data:font/woff2;base64,${readFileSync(join(ds, 'fonts', f)).toString('base64')}")`);
const tokens = ['colors', 'typography', 'spacing', 'motion'].map((n) => read(join(ds, 'tokens', `${n}.css`))).join('\n');
const css = [fontData(tokens), read(join(here, 'brand.css')), read(join(ds, 'prototypes/lib/picker.css')), read(join(here, 'round.css'))].join('\n');

const favicon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2c6e3f" stroke-width="2" stroke-linecap="round"><style>@media(prefers-color-scheme:dark){*{stroke:#8fe36b}circle{fill:#8fe36b}}</style><path d="M14 3H8a5 5 0 0 0-5 5v8a5 5 0 0 0 5 5h8a5 5 0 0 0 5-5v-6"/><circle cx="12" cy="12" r="2.5" fill="#2c6e3f" stroke="none"/></svg>';
const names = ['Hiljainen', 'Yö ensin', 'Merkki kantaa'];
const picker = `<nav class="proto-picker" aria-label="Prototype variants">
  <span class="proto-picker-highlight" aria-hidden="true"></span>
${names.map((n, i) => `  <button class="proto-picker-item"${i === 0 ? ' data-active aria-current="true"' : ''}>${n}</button>`).join('\n')}
  <span class="proto-picker-divider" aria-hidden="true"></span>
  <button class="proto-picker-item proto-picker-replay" aria-label="Replay animation (R)">↻</button>
</nav>`;
// round.js defines `stage` and `variants`; the picker wiring is lib/picker.js verbatim.
const js = `window.T=${JSON.stringify(T)};\n${read(join(here, 'round.js'))}\n${read(join(ds, 'prototypes/lib/picker.js'))}`;
const html = (styles) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="prototype-round" content="2026-11-13-website-front-page"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Website front page · new look · round 1</title><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon)}"><style>${styles}</style></head><body><div id="stage"></div>${picker}<script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
writeFileSync(join(out, 'offline.html'), html(css));
writeFileSync(join(out, 'index.html'), html(css.replace(/@font-face\s*\{[^}]*\}/g, '')));
console.log(out);
