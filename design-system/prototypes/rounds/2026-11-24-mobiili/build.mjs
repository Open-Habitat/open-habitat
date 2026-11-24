// node build.mjs <out-dir>
// The phone round: the whole landing page v1, rendered by its own renderer
// (../2026-11-23-etusivu-v1/render.mjs) and left exactly as it is, with this
// round's layer on top: mobile.css after the engine's CSS and mobile.js after
// the engine's and the blocks' scripts. The layer does nothing above 900px:
// its CSS is inside one media query and its script mounts only while that
// query matches, so the desktop page is the v1 page. Three variants behind
// the /prototype picker (html[data-v]). The v1 round's files are read, never
// written.
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
if (!out || out.startsWith('-')) { console.error('usage: node build.mjs <out-dir>'); process.exit(2); }
const ASSETS = process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets');
const read = (p) => readFileSync(p, 'utf8');

const r = await render();
const tokens = ['colors', 'typography', 'spacing', 'motion'].map((n) => read(join(ds, 'tokens', `${n}.css`))).join('\n').replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, 'url("assets/fonts/$1")');
const css = [
  tokens,
  read(join(root, 'website/src/styles/brand.css')),
  r.css,
  read(join(here, 'mobile.css')),
  read(join(here, '../../lib/picker.css')), // PICKER.md verbatim, the library's copy
].join('\n');

// The picker wiring is the library's copy of PICKER.md. Its one seam is
// mount(): a variant here is not a string to put in a stage but a layer over
// a page that is already rendered and already has the engine's listeners on
// it, so mounting means taking the old layer off and putting the new one on.
const MOUNT = `function mount(i) {
  stage.innerHTML = '';
  // Clear first, render next frame, so entrance animations re-run.
  requestAnimationFrame(() => { stage.innerHTML = variants[i](); });
}`;
const pickerJs = read(join(here, '../../lib/picker.js'));
if (!pickerJs.includes(MOUNT)) throw new Error('lib/picker.js: mount() is no longer the reference wiring; update build.mjs');
const js = [
  r.js,
  read(join(here, 'mobile.js')),
  `// ---- prototype harness: lib/picker.js with mount() pointed at the layer ----\n(() => {\nconst variants = window.VARIANTS;\n${pickerJs.replace(MOUNT, 'function mount(i) { window.MOBIILI.mount(i + 1); }')}\n})();`,
].join('\n');

// Assets: fonts, and each block's files from $ETUSIVU_ASSETS/<id>/.
mkdirSync(join(out, 'assets/fonts'), { recursive: true });
for (const f of readdirSync(join(ds, 'fonts')).filter((f) => f.endsWith('.woff2'))) cpSync(join(ds, 'fonts', f), join(out, 'assets/fonts', f));
const missing = [];
for (const [id, names] of r.assets) {
  for (const n of names) if (!existsSync(join(ASSETS, id, n))) missing.push(`${id}/${n}`);
  if (existsSync(join(ASSETS, id))) cpSync(join(ASSETS, id), join(out, 'assets', id), { recursive: true });
}
if (missing.length) { console.error(`missing assets (in ${ASSETS}): ${missing.join(', ')}`); process.exit(1); }

// The variants: the picker's label, and the Finnish line shown above the page
// and as the button's title. Labels are short: the picker must fit 360px.
const VARIANTS = [
  ['Valinta', 'Valitse kenen päivä: heron jälkeen valitaan henkilö tai kyky isoista korteista; päivä aukeaa omaksi näkymäkseen askel kerrallaan (”Carol’s Thursday · 2 / 3”), ja ylhäältä pääsee aina takaisin valintaan ja asennukseen.'],
  ['Pyyhkäisy', 'Tarinat pyyhkäistävinä: jokainen päivä on vaakaan pyyhkäistävä korttipakka; henkilön vaihto ja askelmittari pysyvät ylhäällä, asennus alhaalla, ja sivu on muutaman ruudun mittainen.'],
  ['Aikajana', 'Tiivis kronologia: päivä on silmäiltävä aikajana (kello, pyyntö, tulos); tuoteruutu aukeaa vasta napautuksesta. Yläpalkki kertoo kenen päivä ja mikä hetki, ja siitä vaihdetaan henkilöä.'],
];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const picker = `<nav class="proto-picker" aria-label="Prototype variants">
  <span class="proto-picker-highlight" aria-hidden="true"></span>
${VARIANTS.map(([n, d], i) => `  <button class="proto-picker-item"${i === 0 ? ' data-active aria-current="true"' : ''} title="${esc(d)}">${esc(n)}</button>`).join('\n')}
</nav>`;
// Harness chrome around the page: the line above it, and on the phone a band
// under the picker so that no variant's bottom bar is ever covered by it (the
// variants' fixed bars sit on --mb-dock, which is 0 in a port).
const head = `<header class="mb-head"><p class="mb-desc" aria-live="polite"><span class="mb-line">${esc(VARIANTS[0][1])}</span></p><p class="mb-wide">Tämä kierros koskee puhelinta: kavenna ikkuna enintään 900 pikselin levyiseksi. Tällä leveydellä sivu on v1 sellaisenaan.</p></header>`;
const html = `<!doctype html><html lang="en" data-theme="light" data-v="1" class="no-js"><head><meta charset="utf-8"><meta name="prototype-round" content="2026-11-24-mobiili"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Mobiili · the landing page on a phone</title><script>document.documentElement.classList.replace('no-js','js');{const v=+new URLSearchParams(location.search).get('v');if(v>=1&&v<=${VARIANTS.length})document.documentElement.dataset.v=v;}</script><style>${css}</style></head><body>${head}<div class="pg v1">
${r.html}
</div>
<div class="mb-dock" aria-hidden="true"></div>
${picker}
<script>window.VARIANTS=${JSON.stringify(VARIANTS)};\n${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
writeFileSync(join(out, 'index.html'), html);
console.log(`${join(out, 'index.html')} ${(statSync(join(out, 'index.html')).size / 1e6).toFixed(2)} MB`);
