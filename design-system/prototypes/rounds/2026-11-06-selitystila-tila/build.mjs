#!/usr/bin/env node
// Builds round 7 into one offline file. Each view is the production page as
// the synthetic lab rendered it (capture.mjs), with production's stylesheet and
// fonts, shown in an iframe as wide as the device so production's own
// breakpoints apply; frame.css and frame.js lay the explain mode over it. The
// captured views travel gzip-compressed, so the file stays small enough to
// commit next to its issue.
//   node design-system/prototypes/rounds/2026-11-06-selitystila-tila/build.mjs [--out <file>]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARDS as R6, KINDS, AREAS, STYLE } from '../2026-11-03-selitystila-kortit/cards.mjs';
import { STATES, CHANGED, NEW, BLOCKED, TOGGLE, RIFFS } from './state.mjs';

// Round 6's cards stay the content; round 7 rewrites the few that spoke of
// pinning and adds the riffs' entry points.
const CARDS = [...R6.map((c) => CHANGED[c.id]
  ? { ...c, ...CHANGED[c.id], fi: { ...c.fi, ...CHANGED[c.id].fi }, en: { ...c.en, ...CHANGED[c.id].en } } : c), ...NEW];

const here = path.dirname(fileURLToPath(import.meta.url));
const ds = path.resolve(here, '../../..');
const root = path.resolve(ds, '..');
const cap = path.join(ds, 'prototypes/dist/selitystila-tila-capture');
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? path.resolve(args[outIdx + 1])
  : path.join(root, 'issues/proto-explain-mode-r6/prototype/kierros-7/selitystila-tila.html');
const read = (...p) => readFileSync(path.join(...p), 'utf8');
const font = (f) => `url("data:font/woff2;base64,${readFileSync(path.join(ds, 'fonts', `${f}.woff2`)).toString('base64')}")`;

// The views, in the order the page's menu lists them. A view captured only on
// one width falls back to its nearest sibling on the other.
const VIEWS = [
  { id: 'kaynnissa', fi: 'Odottaa sinua: vastaus valmis' },
  { id: 'kaynnissa-auki', fi: 'Odottaa sinua: agentin työ auki' },
  { id: 'kaynnissa-tuloste', fi: 'Odottaa sinua: komennon tuloste auki' },
  { id: 'tyossa', fi: 'Työskentelee' },
  { id: 'tyossa-tyo', fi: 'Työskentelee: työ näkyvissä' },
  { id: 'pysaytetty', fi: 'Pysäytit vuoron' },
  { id: 'virhe', fi: 'Vuoro epäonnistui' },
  { id: 'taustatyo-merkki', fi: 'Odottaa sinua, worker jatkaa taustalla' },
  { id: 'taustatyo', fi: 'Taustatyö: workerit' },
  { id: 'uusi', fi: 'Uusi keskustelu: aloitussivu ja nauha' },
  { id: 'opas', fi: 'Tavoite valittu: opas auki' },
  { id: 'uusi-malli', fi: 'Uusi keskustelu: mallivalitsin' },
  { id: 'valikko', fi: '⋯-valikko auki', fallback: 'kaynnissa' },
  { id: 'komennot', fi: 'Kentän lista: Komennot' },
  { id: 'tiedosto', fi: 'Kentän lista: Tiedosto' },
  { id: 'malli', fi: 'Keskustelun malli' },
  { id: 'git', fi: 'Git-tila' },
  { id: 'tiedot', fi: 'Tiedot' },
  { id: 'paate', fi: 'Pääte' },
  { id: 'editori', fi: 'Editori' },
  { id: 'worker', fi: 'Workerin näkymä' },
  { id: 'sivupalkki', fi: 'Sivupalkki', fallback: 'kaynnissa' },
  { id: 'tilivalikko', fi: 'Tilivalikko' },
  { id: 'hiljaiset', fi: 'Hiljaiset: rajaus' },
  { id: 'etusivu', fi: 'Etusivu' },
  { id: 'tyotila', fi: 'Työtilan sivu' },
  { id: 'asetukset', fi: 'Asetukset' },
  { id: 'asetukset-tili', fi: 'Asetukset: Tili', fallback: 'asetukset' },
];
const views = {};
for (const v of VIEWS) {
  v.widths = [1440, 390].filter((w) => existsSync(path.join(cap, `${v.id}-${w}.json`)));
  if (!v.widths.length) throw new Error(`view ${v.id} was not captured; run capture.mjs`);
  for (const w of v.widths) {
    const snap = JSON.parse(read(cap, `${v.id}-${w}.json`));
    // The lab has no model catalog; the header shows a model as Jari's would.
    snap.body = snap.body.replaceAll('Malli ei tiedossa', 'Opus 5.5').replaceAll('ajattelutaso Ei tiedossa', 'ajattelutaso Medium');
    views[`${v.id}-${w}`] = snap;
  }
}

// Production's @font-face URLs name the design system's font files plus a hash.
const css = read(cap, 'production.css').replace(/url\("\/assets\/([a-z-]+?)-[A-Za-z0-9_]{8}\.woff2"\)/g, (_, f) => font(f));
if (/url\("\/assets\//.test(css)) throw new Error('an asset URL was left in production.css');
const tokens = ['colors', 'spacing', 'typography', 'motion'].map((t) => read(ds, 'tokens', `${t}.css`)).join('\n')
  .replace(/url\("\.\.\/fonts\/([a-z-]+)\.woff2"\)/g, (_, f) => font(f));

for (const c of CARDS) for (const l of ['fi', 'en']) if (!c[l]?.name || !c[l]?.lead) throw new Error(`card ${c.id} lacks ${l}`);
const ids = new Set();
for (const c of CARDS) { if (ids.has(c.id)) throw new Error(`duplicate ${c.id}`); ids.add(c.id); }

const data = gzipSync(JSON.stringify({ css, frameCss: read(here, 'frame.css'), frameJs: read(here, 'frame.js'), views }), { level: 9 }).toString('base64');
const states = Object.fromEntries(Object.entries(STATES).map(([id, st]) => [id, { id, ...st }]));
for (const st of Object.values(states)) for (const l of ['fi', 'en']) for (const [id] of st[l].can) if (!CARDS.some((c) => c.id === id)) throw new Error(`state ${st.id} points at ${id}`);
const meta = { cards: CARDS, kinds: KINDS, areas: AREAS, style: STYLE, riffs: RIFFS, states, blocked: [...BLOCKED], toggle: TOGGLE,
  views: VIEWS.map(({ id, fi, widths, fallback }) => ({ id, fi, widths, fallback })) };
const html = read(here, 'page.html')
  .replace('/*TOKENS_CSS*/', () => tokens)
  .replace('/*PICKER_CSS*/', () => read(ds, 'prototypes/lib/picker.css'))
  .replace('/*PICKER_JS*/', () => read(ds, 'prototypes/lib/picker.js'))
  .replace('/*META*/', () => JSON.stringify(meta).replace(/</g, '\\u003c'))
  .replace('/*DATA*/', () => data);
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${path.relative(root, out)} (${Math.round(html.length / 1024)} KiB, ${CARDS.length} cards, ${Object.keys(views).length} views)`);
