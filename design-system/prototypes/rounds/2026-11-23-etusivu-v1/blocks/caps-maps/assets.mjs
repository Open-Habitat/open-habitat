// node blocks/caps-maps/assets.mjs: the two showpieces of "Maps and routes",
// each made by the program the block names. Writes into
// $ETUSIVU_ASSETS/caps-maps/:
//
//   park-ortho.webp        the orthophoto OpenDroneMap stitched from 77 drone photos
//   park-paved.webp        the paved surfaces measure.py found on it, as an overlay
//   park-model.mp4, .webp  a flight around the textured 3D model from the same run
//   old-town-a2.webp       the A2 poster drawn from OpenStreetMap
//   old-town-postcard.webp the postcard crop of the same map
//   old-town-detail.webp   a part of the A2 sheet at print size
//
// Programs (in $CAPS_MAPS_WORK, default $TMPDIR/caps-maps-work):
//   OpenDroneMap 3.6.2 (container docker.io/opendronemap/odm:3.6.2, run with podman);
//   OSMnx 2.2.0, GeoPandas 1.2.0 and Matplotlib 3.11.2 for the poster;
//   rasterio, SciPy and PyVista 0.49.2 (VTK, under xvfb-run) for the measurement
//   and the flight; ffmpeg and ImageMagick `convert`.
// Needs podman, uv, xvfb-run, ffmpeg, ImageMagick and network on the first run:
// about 0.6 GB of photos, a 1.6 GB container image, and half an hour of CPU for
// the photogrammetry. Every step is skipped when its result is already in the
// work directory. Set TMPDIR to your scratch.
// Sources and licences: NOTES.md beside this file.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'src');
const repo = join(here, '../../../../../..');
const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), 'caps-maps');
const work = process.env.CAPS_MAPS_WORK || join(tmpdir(), 'caps-maps-work');
for (const d of [out, work]) mkdirSync(d, { recursive: true });
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 28, ...opts }).toString();
const im = (args) => run('convert', args);
const kb = (name) => `${name} ${Math.round(statSync(join(out, name)).size / 1024)} KB`;

const py = join(work, 'venv-map/bin/python');
if (!existsSync(py)) {
  run('uv', ['venv', '-q', '--python', '3.12', join(work, 'venv-map')]);
  run('uv', ['pip', 'install', '-q', '--python', py, 'osmnx==2.2.0', 'matplotlib==3.11.2', 'brotli', 'rasterio', 'scipy', 'pillow', 'pyvista==0.49.2']);
}

// ---------- 1. The old town poster: OSMnx + Matplotlib ----------
// The page's own typeface on the poster: Instrument Sans (OFL) from
// design-system/fonts, unpacked from WOFF2 for Matplotlib.
const ttf = join(work, 'instrument-sans.ttf');
if (!existsSync(ttf)) run(py, ['-c', 'import sys\nfrom fontTools.ttLib import TTFont\nf = TTFont(sys.argv[1]); f.flavor = None; f.save(sys.argv[2])', join(repo, 'design-system/fonts/instrument-sans-latin.woff2'), ttf]);
const poster = join(work, 'poster');
mkdirSync(poster, { recursive: true });
if (!existsSync(join(poster, 'old-town-postcard.png'))) process.stdout.write(run(py, [join(src, 'poster.py'), poster, ttf]));
im([join(poster, 'old-town-A2.png'), '-resize', '840x', '-quality', '82', '-define', 'webp:method=6', join(out, 'old-town-a2.webp')]);
im([join(poster, 'old-town-postcard.png'), '-resize', '640x', '-quality', '80', '-define', 'webp:method=6', join(out, 'old-town-postcard.webp')]);
// The detail: the island in the river bend with the shop's dot, cut from the
// 2,400 px sheet without resampling (5.7 px per millimetre of the A2 print).
im([join(poster, 'old-town-A2.png'), '-crop', '840x1050+780+1010', '+repage', '-quality', '84', '-define', 'webp:method=6', join(out, 'old-town-detail.webp')]);
console.log(['old-town-a2.webp', 'old-town-postcard.webp', 'old-town-detail.webp'].map(kb).join(' · '));

// ---------- 2. The park from the air: OpenDroneMap ----------
// 77 photos of a park, flown for OpenDroneMap's sample data (CC0).
const odm = join(work, 'odm');
const project = join(odm, 'datasets/yard');
if (!existsSync(join(project, 'images'))) {
  mkdirSync(join(odm, 'datasets'), { recursive: true });
  if (!existsSync(join(odm, 'src/images'))) run('git', ['clone', '-q', '--depth', '1', 'https://github.com/OpenDroneMap/odm_data_aukerman.git', join(odm, 'src')]);
  mkdirSync(project, { recursive: true });
  cpSync(join(odm, 'src/images'), join(project, 'images'), { recursive: true });
}
const ortho = join(project, 'odm_orthophoto/odm_orthophoto.tif');
if (!existsSync(ortho)) {
  run('podman', ['run', '--rm', '-v', `${join(odm, 'datasets')}:/datasets`, 'docker.io/opendronemap/odm:3.6.2',
    '--project-path', '/datasets', 'yard', '--orthophoto-resolution', '4', '--dsm', '--max-concurrency', '8'], { stdio: ['ignore', 'ignore', 'inherit'] });
}
// The paved surfaces, measured on the orthophoto; prints the areas the block quotes.
const drone = join(work, 'drone');
mkdirSync(drone, { recursive: true });
process.stdout.write(run(py, [join(src, 'measure.py'), ortho, join(project, 'odm_dem/dsm.tif'), drone]));
im([join(drone, 'ortho.png'), '-quality', '82', '-define', 'webp:method=6', join(out, 'park-ortho.webp')]);
im([join(drone, 'paved.png'), '-quality', '80', '-define', 'webp:method=6', '-define', 'webp:alpha-quality=80', join(out, 'park-paved.webp')]);
// A flight around the textured model: PyVista draws the frames, ffmpeg cuts the
// film and lifts the midtones a little (gamma 1.15) to sit beside the map.
if (!existsSync(join(drone, 'frames/f-000.png'))) run('xvfb-run', ['-a', py, join(src, 'flight.py'), join(project, 'odm_texturing'), join(drone, 'frames')], { stdio: ['ignore', 'inherit', 'inherit'] });
run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '24', '-i', join(drone, 'frames/f-%03d.png'), '-vf', 'eq=gamma=1.15', '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '23',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', join(out, 'park-model.mp4')]);
im([join(drone, 'frames/f-000.png'), '-gamma', '1.15', '-quality', '80', '-define', 'webp:method=6', join(out, 'park-model.webp')]);
console.log(['park-ortho.webp', 'park-paved.webp', 'park-model.mp4', 'park-model.webp'].map(kb).join(' · '));
