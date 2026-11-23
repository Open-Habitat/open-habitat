// node blocks/caps-3d/assets.mjs [model] [slice] [render] [encode]
//
// The bracket of "3D and making", made by the programs the agent runs in the
// story, from the one source file bracket.scad beside this script:
//
//   model   OpenSCAD exports bracket.stl from bracket.scad.
//   slice   PrusaSlicer slices the STL into bracket.gcode (0.2 mm layers,
//           PETG, no supports) and reports time and filament.
//   render  Blender (Cycles, CPU) runs scene.py twice: the STL as it hangs on
//           the wall, and the G-code drawn bead by bead up to nine layers.
//   encode  ffmpeg (libwebp) writes the WebP pictures; the measurements are drawn
//           as an SVG over the first picture, projected with the camera
//           Blender used, from the numbers in bracket.scad.
//
// Writes into $ETUSIVU_ASSETS/caps-3d/:
//   bracket.webp          the part, rendered from the STL
//   bracket-sizes.svg     its five measurements, as an overlay
//   layer-NNN.webp (x9)   the print up to layer NNN, rendered from the G-code
//
// With no stage named, all run in that order. Intermediate files go to
// $CAPS3D_WORK (default: a new directory under TMPDIR), so `render` can run on
// another machine: Blender publishes no Linux arm64 build.
//
// Programs, from PATH or the environment:
//   OPENSCAD       OpenSCAD 2021.01 (AppImage, extracted; needs a display: xvfb-run -a)
//   PRUSA_SLICER   PrusaSlicer 2.7.4 (official Linux tarball)
//   BLENDER        Blender 4.5 LTS (official Linux x64 tarball)
//   ffmpeg and identify (ImageMagick) are expected on PATH. Set TMPDIR to your scratch.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), 'caps-3d');
const work = process.env.CAPS3D_WORK || mkdtempSync(join(tmpdir(), 'caps-3d-'));
const words = (v, d) => (v || d).split(' ');
const OPENSCAD = words(process.env.OPENSCAD, 'openscad');
const PRUSA = words(process.env.PRUSA_SLICER, 'prusa-slicer');
const BLENDER = words(process.env.BLENDER, 'blender');
const stages = process.argv.slice(2).length ? process.argv.slice(2) : ['model', 'slice', 'render', 'encode'];
const run = ([cmd, ...pre], args) => execFileSync(cmd, [...pre, ...args], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 }).toString();
mkdirSync(out, { recursive: true });
mkdirSync(join(work, 'frames'), { recursive: true });

const scad = join(here, 'bracket.scad');
const stl = join(work, 'bracket.stl');
const gcode = join(work, 'bracket.gcode');
// The layers the print is shown at. The two holes sit at layers 68 and 242.
export const CUTS = [1, 34, 68, 110, 155, 200, 242, 276, 310];
const nnn = (n) => String(n).padStart(3, '0');

if (stages.includes('model')) {
  run(OPENSCAD, ['-o', stl, scad]);
  console.log(`model: ${stl}`);
}

if (stages.includes('slice')) {
  run(PRUSA, ['--export-gcode', '--layer-height', '0.2', '--first-layer-height', '0.2', '--perimeters', '3', '--fill-density', '20%', '--fill-pattern', 'gyroid',
    '--filament-type', 'PETG', '--temperature', '240', '--bed-temperature', '85', '--nozzle-diameter', '0.4', '--extrusion-width', '0.45', '--first-layer-extrusion-width', '0.5',
    '--filament-diameter', '1.75', '--filament-density', '1.27', '--skirts', '1', '--center', '110,110', '-o', gcode, stl]);
  // The numbers the block quotes: check them against block.js after a change.
  console.log(readFileSync(gcode, 'utf8').split('\n').filter((l) => /^; (estimated printing time|filament used \[g\]|support_material =)/.test(l)).join('\n'));
}

if (stages.includes('render')) {
  const blender = (args) => run(BLENDER, ['-b', '--factory-startup', '-noaudio', '-P', join(here, 'scene.py'), '--', ...args]);
  blender(['part', '--stl', stl, '--out', join(work, 'part.png'), '--camera-json', join(work, 'cam.json'), '--samples', '160']);
  blender(['sliced', '--gcode', gcode, '--out-dir', join(work, 'frames'), '--cuts', CUTS.join(','), '--samples', '96']);
}

if (stages.includes('encode')) {
  // ffmpeg's libwebp, not ImageMagick: the installed `convert` ignores -quality
  // for WebP and writes a blotchy picture.
  const webp = (src, dst, w, q = 90) => run(['ffmpeg'], ['-v', 'error', '-y', '-i', src, '-vf', `scale=${w}:-1:flags=lanczos`, '-c:v', 'libwebp', '-quality', String(q), '-compression_level', '6', join(out, dst)]);
  webp(join(work, 'part.png'), 'bracket.webp', 1200, 92);
  for (const c of CUTS) webp(join(work, 'frames', `layer-${nnn(c)}.png`), `layer-${nnn(c)}.webp`, 1000);

  // ---------- The measurements, drawn where the camera saw them ----------
  // The sizes come from bracket.scad itself, so the drawing cannot disagree
  // with the model. World: X along the rail (centred), -Y out from the wall,
  // Z up the wall, in millimetres (scene.py turns the STL the same way).
  const src = readFileSync(scad, 'utf8');
  const size = (name) => Number(src.match(new RegExp(`^${name}\\s*=\\s*([\\d.]+)`, 'm'))[1]);
  const [width, depth, height, thickness, hole, bend] = ['width', 'depth', 'height', 'thickness', 'hole', 'bend'].map(size);
  const cam = JSON.parse(readFileSync(join(work, 'cam.json'), 'utf8'));
  const px = ([x, y, z]) => {
    const v = [x * cam.mm, y * cam.mm, z * cam.mm, 1];
    const [cx, cy, , cw] = cam.m.map((r) => r.reduce((s, k, i) => s + k * v[i], 0));
    return [(cx / cw * 0.5 + 0.5) * cam.w, (1 - (cy / cw * 0.5 + 0.5)) * cam.h];
  };
  const f = (n) => n.toFixed(1);
  const line = (a, b, cls) => { const [p, q] = [px(a), px(b)]; return `<path class="${cls}" d="M${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}"/>`; };
  const label = ([x, y], text) => { const w = text.length * 28 + 36; return `<g transform="translate(${f(x)} ${f(y)})"><rect x="${-w / 2}" y="-34" width="${w}" height="68" rx="34"/><text y="15">${text}</text></g>`; };
  const mid = (a, b, dx = 0, dy = 0) => { const [p, q] = [px(a), px(b)]; return [(p[0] + q[0]) / 2 + dx, (p[1] + q[1]) / 2 + dy]; };
  // A measured length: the dimension line a to b, set off from the part's
  // corners ea and eb by two thin extension lines.
  const dim = (ea, eb, a, b, text, dx = 0, dy = 0) => line(ea, a, 'ext') + line(eb, b, 'ext') + line(a, b, 'dim') + [a, b].map((p) => { const [x, y] = px(p); return `<circle cx="${f(x)}" cy="${f(y)}" r="5.5"/>`; }).join('') + `@${JSON.stringify([mid(a, b, dx, dy), text])}`;
  const W2 = width / 2, off = 9;
  const holeZ = (height + thickness + bend) / 2, holeX = W2 - width * 0.22;
  const holeAt = px([-holeX, -thickness, holeZ]);
  const parts = [
    dim([-W2, -depth, 0], [W2, -depth, 0], [-W2, -depth - off, 0], [W2, -depth - off, 0], String(width), -10, 40),
    dim([W2, 0, 0], [W2, -depth, 0], [W2 + off, 0, 0], [W2 + off, -depth, 0], String(depth), 46, 14),
    dim([-W2, 0, 0], [-W2, 0, height], [-W2 - off, 0, 0], [-W2 - off, 0, height], String(height), -56, 0),
    dim([W2, 0, height], [W2, -thickness, height], [W2 + off, 0, height], [W2 + off, -thickness, height], String(thickness), 44, -34),
    `<path class="dim" d="M${f(holeAt[0])} ${f(holeAt[1])}L${f(holeAt[0] - 70)} ${f(holeAt[1] - 150)}"/><circle cx="${f(holeAt[0])}" cy="${f(holeAt[1])}" r="5.5"/>@${JSON.stringify([[holeAt[0] - 40, holeAt[1] - 176], `2 × ⌀ ${hole}`])}`,
  ];
  // Lines first, labels on top.
  const lines = parts.map((p) => p.split('@')[0]).join('');
  const labels = parts.map((p) => label(...JSON.parse(p.slice(p.indexOf('@') + 1)))).join('');
  writeFileSync(join(out, 'bracket-sizes.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cam.w} ${cam.h}"><style>path{fill:none;stroke:#17201a;stroke-linecap:round}.dim{stroke-width:3}.ext{stroke-width:1.6;opacity:.55}circle{fill:#17201a}rect{fill:#fff;stroke:#17201a;stroke-width:2.5}text{font:700 44px ui-monospace,"SF Mono",Menlo,Consolas,"DejaVu Sans Mono",monospace;fill:#17201a;text-anchor:middle}</style>${lines}${labels}</svg>\n`);
  console.log(run(['identify'], ['-format', '%f %wx%h %b\n', ...['bracket.webp', ...CUTS.map((c) => `layer-${nnn(c)}.webp`)].map((n) => join(out, n))]).trim());
}
