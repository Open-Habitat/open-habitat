// node blocks/role-carol/assets.mjs [masks] [render] [encode] [cut] [logo]
//
// Carol's pictures, made by the programs her agent runs in the story:
//
//   render  Blender (Cycles, CPU) builds the linen tote from scene.py and
//           renders one turn per ink colour, then twelve products "as
//           photographed" on the print table.
//   encode  ffmpeg turns the frames into tote-<ink>.mp4 with a WebP poster.
//   cut     rembg cuts the twelve photographs out; ImageMagick puts each on
//           the shop's white with the same margin.
//   logo    a 200-pixel JPEG of the studio's first logo is traced by vtracer.
//
// With no stage named, all run in that order. Intermediate files (frames,
// photographs) go to $CAROL_RENDERS (default: a new directory under TMPDIR),
// so a stage can run on another machine: Blender publishes no Linux arm64
// build, and `render` is the only stage that needs it.
//
// Programs, from PATH or the environment:
//   BLENDER          blender 4.5 LTS (official Linux x64 tarball)
//   REMBG            rembg (`uv tool install "rembg[cpu,cli]"`)
//   VTRACER_PYTHON   a python with vtracer (`uv pip install vtracer`)
//   ffmpeg, convert (ImageMagick) and rsvg-convert are expected on PATH.
// Set TMPDIR to your scratch directory.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), 'role-carol');
const work = process.env.CAROL_RENDERS || mkdtempSync(join(tmpdir(), 'role-carol-'));
const BLENDER = process.env.BLENDER || 'blender';
const REMBG = process.env.REMBG || 'rembg';
const PY = process.env.VTRACER_PYTHON || 'python3';
const stages = process.argv.slice(2).length ? process.argv.slice(2) : ['masks', 'render', 'encode', 'cut', 'logo'];
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 28, ...opts });
const im = (args) => run('convert', args);
mkdirSync(out, { recursive: true });
mkdirSync(work, { recursive: true });

// ---------- The turntable and the twelve photographs ----------
export const FRAMES = 120; // one turn, 5 s at 24 frames a second
const INKS = ['indigo', 'rust'];
// [item, ink, print, seed]: what Carol photographed on the print table.
const PHOTOS = [
  ['tote', 'indigo', 'sprig', 11], ['tote', 'rust', 'sprig', 12], ['cushion', 'indigo', 'sun', 13], ['pouch', 'rust', 'wave', 14],
  ['cushion', 'rust', 'sprig', 15], ['tote', 'moss', 'sun', 16], ['pouch', 'indigo', 'sprig', 17], ['cushion', 'ochre', 'wave', 18],
  ['tote', 'indigo', 'wave', 19], ['pouch', 'moss', 'sun', 20], ['cushion', 'moss', 'sprig', 21], ['tote', 'ochre', 'sun', 22],
];
const nn = (k) => String(k + 1).padStart(2, '0');

// ---------- masks: the carved blocks, white where the ink goes ----------
const leaf = 'M0 0C8-9 22-10 31 0C22 9 8 9 0 0Z';
const sprig = (x, y) => `<g transform="translate(${x} ${y}) scale(.85)"><path d="M0 40C-3 15 3-10 0-34" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none"/>${[22, 4, -14].map((d) => `<path d="${leaf}" transform="translate(-2 ${d}) rotate(-145)"/><path d="${leaf}" transform="translate(2 ${d}) rotate(-35)"/>`).join('')}<path d="${leaf}" transform="translate(0 -32) rotate(-90)"/></g>`;
const dots = (x, y) => `<circle cx="${x}" cy="${y}" r="3.5"/>${[[0, -13], [13, 0], [0, 13], [-13, 0]].map(([a, b]) => `<circle cx="${x + a}" cy="${y + b}" r="5"/>`).join('')}`;
const sun = (x, y) => `<circle cx="${x}" cy="${y}" r="24"/>${Array.from({ length: 12 }, (_, k) => `<rect x="${x - 3.5}" y="${y - 47}" width="7" height="15" rx="2" transform="rotate(${k * 30} ${x} ${y})"/>`).join('')}`;
const ring = (x, y) => `<circle cx="${x}" cy="${y}" r="8"/><circle cx="${x}" cy="${y}" r="18" fill="none" stroke="#fff" stroke-width="4.5"/>`;
const wave = (y) => `<path d="M-50 ${y}Q-25 ${y - 26} 0 ${y}T50 ${y}T100 ${y}T150 ${y}T200 ${y}T250 ${y}" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round"/>`;
const MASKS = {
  sprig: sprig(50, 58) + sprig(150, 158) + dots(150, 52) + dots(50, 152),
  sun: sun(50, 50) + sun(150, 150) + ring(150, 50) + ring(50, 150),
  wave: wave(30) + wave(130) + [25, 75, 125, 175].map((x) => `<circle cx="${x}" cy="80" r="6"/><circle cx="${x}" cy="180" r="6"/>`).join(''),
};
const mask = (name) => join(work, `${name}.png`);
if (['masks', 'render', 'turn', 'photos'].some((s) => stages.includes(s))) {
  for (const [name, body] of Object.entries(MASKS)) {
    const svg = join(work, `${name}.svg`);
    writeFileSync(svg, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200"/><g fill="#fff">${body}</g></svg>`);
    run('rsvg-convert', ['-w', '1024', '-o', mask(name), svg]);
  }
}

// ---------- render: Blender ----------
const blender = (args) => run(BLENDER, ['-b', '--factory-startup', '-noaudio', '-P', join(here, 'scene.py'), '--', ...args, ...(process.env.CAROL_THREADS ? ['--threads', process.env.CAROL_THREADS] : [])], { stdio: ['ignore', 'ignore', 'inherit'] });
const want = (s) => stages.includes('render') || stages.includes(s); // `turn` and `photos` are the two halves of `render`
if (want('turn')) {
  console.log(run(BLENDER, ['--version']).toString().split('\n')[0]);
  for (const ink of INKS) {
    const dir = join(work, `turn-${ink}`);
    mkdirSync(dir, { recursive: true });
    const done = readdirSync(dir).length;
    if (done < FRAMES) blender(['--mode', 'turntable', '--ink', ink, '--print', mask('sprig'), '--out', dir, '--frames', String(FRAMES), '--start', String(done), '--res', '800x600', '--samples', '32']);
    console.log(`turn-${ink}: ${readdirSync(dir).length} frames`);
  }
}
if (want('photos')) {
  PHOTOS.forEach(([item, ink, print, seed], k) => {
    const png = join(work, `photo-${nn(k)}.png`);
    if (!existsSync(png)) blender(['--mode', 'photo', '--item', item, '--ink', ink, '--print', mask(print), '--out', png, '--seed', String(seed), '--res', '1000x750', '--samples', '48']);
    console.log(`photo-${nn(k)}: ${item}, ${ink} ${print}`);
  });
}

// ---------- encode: ffmpeg ----------
if (stages.includes('encode')) {
  for (const ink of INKS) {
    const dir = join(work, `turn-${ink}`);
    run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '24', '-i', join(dir, 'f%04d.png'), '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '20', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', join(out, `tote-${ink}.mp4`)]);
    im([join(dir, 'f0000.png'), '-quality', '88', '-define', 'webp:method=6', join(out, `tote-${ink}.webp`)]);
  }
}

// ---------- cut: rembg, then the shop's white with the same margin ----------
if (stages.includes('cut')) {
  console.log(run(REMBG, ['--version']).toString().trim());
  PHOTOS.forEach((_, k) => {
    const photo = join(work, `photo-${nn(k)}.png`);
    const cut = join(work, `cut-${nn(k)}.png`);
    const shop = join(work, `shop-${nn(k)}.png`);
    if (!existsSync(cut)) run(REMBG, ['i', '-m', 'isnet-general-use', photo, cut]);
    // Drop the faintest haze rembg leaves, trim to the product, fit it into 1280 px and centre it on a
    // 1600 px white square: a 10 % margin on the long side.
    im([cut, '-channel', 'A', '-level', '6%,100%', '+channel', '-trim', '+repage', '-resize', '1280x1280', '-background', 'white', '-gravity', 'center', '-extent', '1600x1600', '-flatten', shop]);
    im([shop, '-resize', '320x320', '-quality', '90', '-define', 'webp:method=6', join(out, `cut-${nn(k)}.webp`)]);
  });
  // The pair the reader sees large: the first photograph and its cut-out.
  im([join(work, 'photo-01.png'), '-resize', '960x720', '-quality', '88', '-define', 'webp:method=6', join(out, 'photo-01.webp')]);
  im([join(work, 'shop-01.png'), '-resize', '900x900', '-quality', '90', '-define', 'webp:method=6', join(out, 'shop-01.webp')]);
}

// ---------- logo: a small JPEG, traced ----------
if (stages.includes('logo')) {
  // The studio's first logo as it was drawn in 2016. Only the JPEG made from it survives in the story.
  const INDIGO = '#22406a', CREAM = '#efe6d2', RUST = '#b24d25';
  const art = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="${CREAM}"/>
<circle cx="100" cy="100" r="92" fill="${INDIGO}"/><circle cx="100" cy="100" r="80" fill="none" stroke="${CREAM}" stroke-width="3"/>
<g fill="${CREAM}" transform="translate(100 103) scale(1.38)"><path d="M0 40C-3 15 3-10 0-34" stroke="${CREAM}" stroke-width="5" stroke-linecap="round" fill="none"/>${[22, 4, -14].map((d) => `<path d="${leaf}" transform="translate(-2 ${d}) rotate(-145)"/><path d="${leaf}" transform="translate(2 ${d}) rotate(-35)"/>`).join('')}<path d="${leaf}" transform="translate(0 -32) rotate(-90)"/></g>
<circle cx="50" cy="124" r="12" fill="${RUST}"/><circle cx="150" cy="124" r="12" fill="${RUST}"/></svg>`;
  const src = join(work, 'logo-art.svg');
  const jpg = join(work, 'logo-2016.jpg');
  const big = join(work, 'logo-big.png');
  const svg = join(out, 'logo-2016.svg');
  writeFileSync(src, art);
  run('rsvg-convert', ['-w', '200', '-o', join(work, 'logo-art.png'), src]);
  im([join(work, 'logo-art.png'), '-quality', '38', '-sampling-factor', '4:2:0', jpg]);
  im([jpg, '-define', 'webp:lossless=true', join(out, 'logo-2016.webp')]); // the JPEG, pixel for pixel
  // Enlarge before tracing so the curves have pixels to follow, and drop the JPEG's ringing.
  // What the agent does before tracing: enlarge so the curves have pixels to follow, soften the JPEG's
  // ringing, and settle every pixel on one of the logo's three colours.
  const pal = join(work, 'logo-palette.png');
  im([`xc:${INDIGO}`, `xc:${CREAM}`, `xc:${RUST}`, '+append', pal]);
  im([jpg, '-filter', 'Lanczos', '-resize', '800%', '-blur', '0x5', '+dither', '-remap', pal, '-median', '11', big]);
  // Positional arguments: the vtracer 0.6 wheel for Linux arm64 crashes when they are passed by keyword.
  // colormode, hierarchical, mode, filter_speckle, color_precision, layer_difference, corner_threshold,
  // length_threshold, max_iterations, splice_threshold, path_precision
  run(PY, ['-c', "import sys, vtracer; vtracer.convert_image_to_svg_py(sys.argv[1], sys.argv[2], 'color', 'stacked', 'spline', 100, 6, 16, 60, 8.0, 10, 45, 1)", big, svg]);
  const traced = readFileSync(svg, 'utf8').replace(/<\?xml[^>]*\?>\s*/, '').replace(/<!--[^]*?-->\s*/, '').replace(/<svg[^>]*>/, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1600">');
  writeFileSync(svg, traced);
  console.log(`logo: ${(traced.match(/<path/g) || []).length} paths, ${new Set(traced.match(/fill="#[0-9a-fA-F]{6}"/g)).size} colours, ${traced.length} bytes`);
}

console.log(`assets in ${out}; intermediates in ${work}`);
