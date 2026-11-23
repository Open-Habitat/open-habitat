// node build.mjs <out-dir>
// The scroll-mechanism round: Alice's day (alice-day and its 12 glimpses) and
// one role (role-carol), rendered by the landing page v1's own renderer
// (../2026-11-23-etusivu-v1/render.mjs) so the real steps and the real sticky
// screen are used. Only the scroll mechanism is ours: the v1 engine's
// client.js is replaced by ./client.js (the same engine with the activation
// rewritten and a variant switch), and ./scroll.css is layered after the
// engine CSS. The v1 round's files are read, never written.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, cpSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const v1 = join(here, '../2026-11-23-etusivu-v1');
const root = resolve(here, '../../../..');
const ds = join(root, 'design-system');
const { render } = await import(join(v1, 'render.mjs'));
const out = process.argv[2] && resolve(process.argv[2]);
if (!out) { console.error('usage: node build.mjs <out-dir>'); process.exit(2); }
const ASSETS = process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets');
const read = (p) => readFileSync(p, 'utf8');

// Two renders, one page. Each render carries the engine's CSS and client.js
// first; they are taken once, and the engine client is swapped for ours.
const parts = [await render({ only: 'alice-day' }), await render({ only: 'role-carol' })];
const engineCss = ['page', 'screen', 'product', 'views'].map((n) => read(join(v1, 'engine', `${n}.css`))).join('\n');
const engineJs = read(join(v1, 'engine/client.js'));
for (const p of parts) {
  if (!p.css.startsWith(engineCss)) throw new Error('render() CSS no longer starts with the engine CSS; update build.mjs');
  if (!p.js.startsWith(engineJs)) throw new Error('render() JS no longer starts with engine/client.js; update build.mjs');
}
const css = [
  ['colors', 'typography', 'spacing', 'motion'].map((n) => read(join(ds, 'tokens', `${n}.css`))).join('\n').replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, 'url("assets/fonts/$1")'),
  read(join(root, 'website/src/styles/brand.css')),
  engineCss,
  ...parts.map((p) => p.css.slice(engineCss.length)),
  read(join(here, 'scroll.css')),
  read(join(here, '../../lib/picker.css')), // PICKER.md verbatim, the library's copy
].join('\n');
const js = [read(join(here, 'client.js')), ...parts.map((p) => p.js.slice(engineJs.length))].join('\n');

// Assets: fonts, and each shown block's files from $ETUSIVU_ASSETS/<id>/.
mkdirSync(join(out, 'assets/fonts'), { recursive: true });
for (const f of readdirSync(join(ds, 'fonts')).filter((f) => f.endsWith('.woff2'))) cpSync(join(ds, 'fonts', f), join(out, 'assets/fonts', f));
const missing = [];
for (const p of parts) for (const [id, names] of p.assets) {
  for (const n of names) if (!existsSync(join(ASSETS, id, n))) missing.push(`${id}/${n}`);
  if (existsSync(join(ASSETS, id))) cpSync(join(ASSETS, id), join(out, 'assets', id), { recursive: true });
}
if (missing.length) { console.error(`missing assets (in ${ASSETS}): ${missing.join(', ')}`); process.exit(1); }

// The variants: name and the Finnish line shown above the page and as the
// picker button's title.
// Short button labels: the picker must not wrap at 390px (picker-check.mjs).
const VARIANTS = [
  ['Napsahdus', 'Napsahdus: selain napsauttaa vaiheen tekstin samalle yläviivalle kuin tuotenäkymä; viivalla oleva vaihe on aktiivinen.'],
  ['Kiinnitys', 'Kiinnitetty teksti: teksti pysyy paikallaan näkymän vieressä, ja vieritys vaihtaa sen ristihäivytyksellä seuraavaan; laskuri näyttää kohdan (3 / 12).'],
  ['Yläreuna', 'Yläreunan aktivointi: vapaa vieritys; teksti nousee näkymän yläreunaan, pysähtyy ja aktivoituu siinä; muut haalistuvat etäisyyden mukaan.'],
];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const picker = `<nav class="proto-picker" aria-label="Prototype variants">
  <span class="proto-picker-highlight" aria-hidden="true"></span>
${VARIANTS.map(([n, d], i) => `  <button class="proto-picker-item"${i === 0 ? ' data-active aria-current="true"' : ''} title="${esc(d)}">${esc(n)}</button>`).join('\n')}
</nav>`;
const head = `<header class="vr-head">
  <p class="vr-desc" aria-live="polite"><span class="vr-line">${esc(VARIANTS[0][1])}</span></p>
  <nav class="vr-links" aria-label="Ankkurilinkit (testi)"><a href="#day">#day</a><a class="cap-role" href="#g-alice-receipts" data-who="alice">Alice’s day: receipts</a><a class="cap-role" href="#g-alice-orders" data-who="alice">Alice’s day: order page</a><a href="#role-carol">#role-carol</a><a class="cap-role" href="#g-carol-tote" data-who="carol">Carol’s day: tote</a></nav>
</header>`;
const html = `<!doctype html><html lang="en" data-theme="light" data-v="1" class="no-js"><head><meta charset="utf-8"><meta name="prototype-round" content="2026-11-23-vieritys"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Vieritys · story steps snapping into place</title><script>document.documentElement.classList.replace('no-js','js');{const v=+new URLSearchParams(location.search).get('v');if(v>=1&&v<=${VARIANTS.length})document.documentElement.dataset.v=v;}</script><style>${css}</style></head><body>${head}<div class="pg v1">
${parts.map((p) => p.html).join('\n')}
<div class="vr-tail" aria-hidden="true"></div>
</div>
${picker}
<script>window.VARIANTS=${JSON.stringify(VARIANTS)};\n${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
writeFileSync(join(out, 'index.html'), html);
console.log(`${join(out, 'index.html')} ${(statSync(join(out, 'index.html')).size / 1e6).toFixed(2)} MB`);
