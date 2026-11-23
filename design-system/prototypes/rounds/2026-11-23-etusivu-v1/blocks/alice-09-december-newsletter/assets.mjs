// node blocks/alice-09-december-newsletter/assets.mjs
// The newsletter's three product photos. Blender (Cycles, CPU) simulates and
// renders the linen with linen.py: three hand-printed tea towels hung on pegs
// and two cushion covers, as cut-outs with their shadows. ImageMagick then
// does what the newsletter's author would: puts each cut-out on its panel
// colour, crops it for its slot and writes WebP into
// $ETUSIVU_ASSETS/alice-09-december-newsletter/.
//
// BLENDER names the Blender binary (default `blender`). Made with Blender
// 4.0.2; set TMPDIR to your scratch. About eight minutes on eight cores.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), 'alice-09-december-newsletter');
mkdirSync(out, { recursive: true });
const scratch = process.env.LINEN_RENDERS || mkdtempSync(join(tmpdir(), 'alice09-'));
const blender = process.env.BLENDER || 'blender';
const SAMPLES = process.env.LINEN_SAMPLES || '320';
const render = (what) => {
  const png = join(scratch, `${what}.png`);
  if (!process.env.LINEN_RENDERS) execFileSync(blender, ['-b', '--python', join(here, 'linen.py'), '--', what, png, SAMPLES], { stdio: ['ignore', 'ignore', 'inherit'] });
  return png;
};
const im = (args) => execFileSync('convert', args);
const webp = ['-quality', '84', '-define', 'webp:method=6'];

// The hero: the three towels on the letter's warm paper, cropped wide.
im([render('towels'), '-background', '#eadfcc', '-flatten', '-resize', '1200x', '-gravity', 'north', '-crop', '1200x540+0+40', '+repage', ...webp, join(out, 'winter-prints.webp')]);
// The two covers, each on a tint of its own ink.
for (const [what, tint] of [['cushion-fern', '#e3e8da'], ['cushion-indigo', '#dde3ec']]) {
  im([render(what), '-background', tint, '-flatten', '-gravity', 'center', '-crop', '780x780+0+20', '+repage', '-resize', '640x640', ...webp, join(out, `${what}.webp`)]);
}
console.log(execFileSync('identify', ['-format', '%f %wx%h %b\n', ...['winter-prints', 'cushion-fern', 'cushion-indigo'].map((n) => join(out, `${n}.webp`))]).toString().trim());
