// node blocks/role-bob/assets.mjs: Bob's three real pictures, made by the programs in the scenes.
//
//   route-map.webp  OpenStreetMap roads (Overpass dump) → road graph → OR-Tools round → matplotlib map  (src/route.py)
//   quote.webp      the quote typeset with Typst, page 1 rendered at 144 ppi and trimmed               (src/quote.typ)
//   (no file)       the customer dedup with rapidfuzz; it prints the counts block.js shows             (src/dedup.py)
//
// Needs uv, ImageMagick (convert) and network for the first run; set TMPDIR to your scratch.
// Everything downloaded or computed stays in $TMPDIR/role-bob-assets (reused on the next run):
// Typst's official release, a uv venv with pinned versions, and the OSM extract.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir, homedir, arch } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), 'role-bob');
const work = join(tmpdir(), 'role-bob-assets');
mkdirSync(out, { recursive: true });
mkdirSync(work, { recursive: true });
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], ...opts }).toString();
const say = (s) => console.log(`role-bob: ${s.trim()}`);

// ---- Typst, the official static build ----
const TYPST_VERSION = '0.15.1';
const triple = arch() === 'arm64' ? 'aarch64-unknown-linux-musl' : 'x86_64-unknown-linux-musl';
const typst = process.env.TYPST || join(work, `typst-${triple}`, 'typst');
if (!existsSync(typst)) {
  const tar = join(work, 'typst.tar.xz');
  run('curl', ['-sSfL', '-o', tar, `https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-${triple}.tar.xz`]);
  run('tar', ['xf', tar, '-C', work]);
}
say(run(typst, ['--version']));

// ---- Python with rapidfuzz, OR-Tools, NetworkX, matplotlib ----
const venv = join(work, 'venv');
const py = join(venv, 'bin/python');
if (!existsSync(py)) {
  run('uv', ['venv', '-q', venv]);
  run('uv', ['pip', 'install', '-q', '-p', py, 'rapidfuzz==3.14.6', 'ortools==9.15.6755', 'networkx==3.7', 'matplotlib==3.11.2', 'numpy']);
}

// ---- 1. the dedup ----
mkdirSync(join(work, 'dedup'), { recursive: true });
say(run(py, ['-I', join(here, 'src/dedup.py'), join(work, 'dedup')]));

// ---- 2. the route on OSM roads ----
// An ordinary Finnish small town; the stops are invented and placed on its roads by a fixed seed.
const osm = join(work, 'osm.json');
if (!existsSync(osm)) {
  const q = `[out:json][timeout:180][bbox:60.365,25.60,60.425,25.73];
(way["highway"];way["natural"="water"];relation["natural"="water"];way["waterway"~"river|riverbank"];
way["landuse"~"forest|grass|meadow|farmland|residential|industrial|retail|commercial"];
way["leisure"~"park|pitch|golf_course"];way["natural"~"wood|wetland"];way["building"];);out geom;`;
  writeFileSync(join(work, 'osm.q'), q);
  run('curl', ['-sSf', '-A', 'map-render-script/1.0', '--data-urlencode', `data@${join(work, 'osm.q')}`, '-o', osm, 'https://overpass-api.de/api/interpreter']);
}
mkdirSync(join(work, 'route'), { recursive: true });
say(run(py, ['-I', join(here, 'src/route.py'), osm, join(work, 'route')]));
run('convert', [join(work, 'route/route-map.png'), '-quality', '82', '-define', 'webp:method=6', join(out, 'route-map.webp')]);

// ---- 3. the quote, typeset ----
const typ = join(here, 'src/quote.typ');
run(typst, ['compile', typ, join(work, 'Q-2026-118.pdf')]);
run(typst, ['compile', '--format', 'png', '--ppi', '144', typ, join(work, 'quote.png')]);
// page 1 down to just under the signature: the rest of the A4 is empty paper
run('convert', [join(work, 'quote.png'), '-crop', '1191x1330+0+0', '+repage', '-quality', '86', '-define', 'webp:method=6', join(out, 'quote.webp')]);
say(run('pdfinfo', [join(work, 'Q-2026-118.pdf')], { stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter((l) => /^(Pages|Page size|Producer)/.test(l)).join(' · '));

const route = JSON.parse(readFileSync(join(work, 'route/route.json'), 'utf8'));
say(`route: ${route.km} km, back ${route.back}, windows met ${route.windows_met}, nearest-next ${route.km_nearest_next} km`);
say(run('identify', ['-format', '%f %wx%h %b\n', join(out, 'route-map.webp'), join(out, 'quote.webp')]));
