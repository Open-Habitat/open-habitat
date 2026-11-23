// node blocks/hero/assets.mjs: the hero picture, made from the product capture
// docs/assets/readme/hero.png as round 2 did (ImageMagick): trim 11 px on the
// left, extend the bottom by a strip that fades into the band's colour, and
// write a 2000 px WebP into $ETUSIVU_ASSETS/hero/hero.webp. Set TMPDIR to your scratch.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../../..');
const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), 'hero');
mkdirSync(out, { recursive: true });
const im = (args) => execFileSync('convert', args);
const scratch = mkdtempSync(join(tmpdir(), 'hero-'));
const png = join(root, 'docs/assets/readme/hero.png');
const BG = 'rgb(232,236,229)';
const strip = join(scratch, 'strip.png');
const centred = join(scratch, 'centred.png');
im([png, '-crop', '3040x1+0+1919', '+repage', '-scale', '3040x80!', '(', '-size', '3040x80', `xc:${BG}`, ')', '(', '-size', '3040x80', 'gradient:black-white', ')', '-composite', strip]);
im([png, strip, '-append', '-crop', '3029x2000+11+0', '+repage', centred]);
im([centred, '-resize', '2000x>', '-quality', '80', '-define', 'webp:method=6', join(out, 'hero.webp')]);
console.log(execFileSync('identify', ['-format', '%f %wx%h %b\n', join(out, 'hero.webp')]).toString().trim());
