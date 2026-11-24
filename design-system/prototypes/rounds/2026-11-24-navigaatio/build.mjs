// node build.mjs [out-dir]
// Navigation on the long landing page (round 2026-11-24-navigaatio): three
// variants over the whole page as the v1 round renders it.
// The page is the v1 round's render() (../2026-11-23-etusivu-v1/render.mjs,
// read, never changed: the live site is built from it) with every real
// block; this round adds only nav/ (each variant's CSS and JS, layered on
// top, switched by html[data-nav]) and the skill's floating picker from
// ../../lib/picker.css and picker.js verbatim (harness/switch.js gives it its
// `stage` and `variants`). Assets come from $ETUSIVU_ASSETS as in v1 and are
// copied next to index.html; default out-dir
// ~/src/open-habitat-dev/worker-results/navigaatio/.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, cpSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { render } from '../2026-11-23-etusivu-v1/render.mjs';

const ROUND = '2026-11-24-navigaatio';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const ds = join(root, 'design-system');
const out = resolve(process.argv[2] || join(homedir(), 'src/open-habitat-dev/worker-results/navigaatio'));
const ASSETS = process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets');
const read = (p) => readFileSync(p, 'utf8');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Picker names and one-line descriptions are Finnish (the reader is Jari);
// the page is English. The description shows above the page and as the
// picker button's title.
const VARIANTS = [
  ['Yläpalkki', 'v1-ylapalkki', 'Kiinteä yläpalkki: ohut palkki tulee esiin, kun sivun oma yläpalkki vierii pois; neljä osiota, nykyinen korostettuna, logo vie alkuun; puhelimessa tiivis palkki ja osiovalikko.'],
  ['Hakemisto', 'v2-hakemisto', 'Sisällysluettelo ja eteneminen: työpöydällä ohut kisko sivun reunassa näyttää osiot ja kuinka pitkällä kussakin olet (Alice 5/12); puhelimessa peukalon alla oleva nappi avaa koko hakemiston.'],
  ['Väliotsikot', 'v3-valiotsikot', 'Väliotsikot ja paluu: lukiessa ei mitään pysyvää; osioiden välissä ”minne seuraavaksi” -kortit, osion otsikko jää hetkeksi kiinni, ja Alkuun-nappi tulee, kun vierität vähän ylöspäin.'],
];

const r = await render();
const tokens = ['colors', 'typography', 'spacing', 'motion'].map((n) => read(join(ds, 'tokens', `${n}.css`))).join('\n').replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, 'url("assets/fonts/$1")');
const css = [tokens, read(join(root, 'website/src/styles/brand.css')), r.css, read(join(here, 'nav/common.css')),
  ...VARIANTS.map(([, f]) => read(join(here, 'nav', `${f}.css`))),
  read(join(here, 'harness/harness.css')), read(join(ds, 'prototypes/lib/picker.css'))].join('\n');
const js = [r.js, read(join(here, 'nav/common.js')), ...VARIANTS.map(([, f]) => read(join(here, 'nav', `${f}.js`))),
  read(join(here, 'harness/switch.js')), read(join(ds, 'prototypes/lib/picker.js'))].join('\n');

// ---------- Assets (as the v1 build copies them) ----------
mkdirSync(join(out, 'assets/fonts'), { recursive: true });
for (const f of readdirSync(join(ds, 'fonts')).filter((f) => f.endsWith('.woff2'))) cpSync(join(ds, 'fonts', f), join(out, 'assets/fonts', f));
const missing = [];
for (const [id, names] of r.assets) {
  for (const n of names) if (!existsSync(join(ASSETS, id, n))) missing.push(`${id}/${n}`);
  if (existsSync(join(ASSETS, id))) cpSync(join(ASSETS, id), join(out, 'assets', id), { recursive: true });
}
if (missing.length) { console.error(`missing assets (in ${ASSETS}): ${missing.join(', ')}; build the v1 round once to generate them`); process.exit(1); }

// ---------- Page ----------
const picker = `<nav class="proto-picker" aria-label="Prototype variants">
  <span class="proto-picker-highlight" aria-hidden="true"></span>
${VARIANTS.map(([n, , d], i) => `  <button class="proto-picker-item"${i === 0 ? ' data-active aria-current="true"' : ''} title="${esc(d)}">${esc(n)}</button>`).join('\n')}
</nav>`;
const favicon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2c6e3f" stroke-width="2" stroke-linecap="round"><path d="M14 3H8a5 5 0 0 0-5 5v8a5 5 0 0 0 5 5h8a5 5 0 0 0 5-5v-6"/><circle cx="12" cy="12" r="2.5" fill="#2c6e3f" stroke="none"/></svg>';
const html = `<!doctype html><html lang="en" data-theme="light" class="no-js"><head><meta charset="utf-8"><meta name="prototype-round" content="${ROUND}"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Etusivu · navigaatio pitkällä sivulla</title><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon)}"><script>document.documentElement.classList.replace('no-js','js')</script><style>${css}</style></head><body>
<p class="proto-desc" lang="fi"><b></b><span></span></p>
<div class="pg v1">
${r.html}
</div><div id="stage" hidden></div>${picker}<script type="application/json" id="proto-desc-data">${JSON.stringify(VARIANTS.map(([, , d]) => d))}</script><script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
writeFileSync(join(out, 'index.html'), html);
console.log(`${join(out, 'index.html')} ${(statSync(join(out, 'index.html')).size / 1e6).toFixed(2)} MB · ${r.shown.length} blocks · ${VARIANTS.length} variants`);
