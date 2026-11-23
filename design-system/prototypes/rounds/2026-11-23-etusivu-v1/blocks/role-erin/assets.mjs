// node blocks/role-erin/assets.mjs: Erin's block-printing explainer, rendered
// with Manim Community from block_print.py beside this file.
//
// BLOCK_PRINT_PY is a Python that has manim and fonttools (default python3).
// On aarch64 pip cannot build manim's wheels without X11 and pango headers, so
// the tested route is conda-forge in scratch:
//   micromamba create -p $S/menv -c conda-forge python=3.12 manim fonttools brotli-python
//   BLOCK_PRINT_PY=$S/menv/bin/python TMPDIR=$S node blocks/role-erin/assets.mjs
// Writes block-print.mp4 (H.264, faststart, no audio) and block-print.webp
// (the poster: the finished two-colour cloth) into $ETUSIVU_ASSETS/role-erin/.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, statSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fonts = resolve(here, '../../../../../fonts');
const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), 'role-erin');
mkdirSync(out, { recursive: true });
const py = process.env.BLOCK_PRINT_PY || 'python3';
const scratch = mkdtempSync(join(tmpdir(), 'role-erin-'));
const run = (cmd, args, env = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, ...env }, cwd: scratch });

// The page's Instrument Sans (OFL, design-system/fonts) as a TTF pango can load.
const ttf = join(scratch, 'InstrumentSans.ttf');
run(py, ['-I', '-c', 'import sys; from fontTools.ttLib import TTFont; f = TTFont(sys.argv[1]); f.flavor = None; f.save(sys.argv[2])', join(fonts, 'instrument-sans-latin.woff2'), ttf]);

run(py, ['-m', 'manim', 'render', '-r', '1280,720', '--fps', '30', '--disable_caching', '--progress_bar', 'none', '--media_dir', join(scratch, 'media'), join(here, 'block_print.py'), 'BlockPrint'], { BLOCK_PRINT_FONT: ttf });
const raw = join(scratch, 'media/videos/block_print/720p30/BlockPrint.mp4');

const mp4 = join(out, 'block-print.mp4');
run('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
run('ffmpeg', ['-v', 'error', '-y', '-sseof', '-0.5', '-i', raw, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '82', join(out, 'block-print.webp')]);
for (const f of ['block-print.mp4', 'block-print.webp']) console.log(f, `${Math.round(statSync(join(out, f)).size / 1024)} KB`);
