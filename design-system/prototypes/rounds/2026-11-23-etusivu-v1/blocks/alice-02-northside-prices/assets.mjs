// node blocks/alice-02-northside-prices/assets.mjs: run the margin check for real.
//
// Lays out a small fictional shop folder in scratch (catalog/, inbox/, tools/),
// makes its two CSV files with checker/make_data.py, then runs exactly the
// command the screen shows:
//     python3 tools/margin_check.py inbox/northside-2027.csv
// Its stdout is written to checker/run.txt beside this script (block.js shows
// it verbatim and builds the reply's table from it; checker/head.txt is the
// supplier file's first four lines, for the `head -4` row), and the chart it draws,
// reports/northside-2027.png, becomes $ETUSIVU_ASSETS/<id>/northside-2027.webp
// (plus a narrow copy for phones, drawn by the same checker with --chart-width).
// Python comes from uv (matplotlib, fontTools); the chart's font is the design
// system's Instrument Sans, cut into static Regular and SemiBold TTFs because
// matplotlib reads neither WOFF2 nor variable weights. Set TMPDIR to your scratch.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const id = 'alice-02-northside-prices';
const root = resolve(here, '../../../../../..');
const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), id);
mkdirSync(out, { recursive: true });
const shop = mkdtempSync(join(tmpdir(), 'northside-'));
const py = (args, opts = {}) => execFileSync('uv', ['run', '--quiet', '--no-project', '--python', '3.12', '--with', 'matplotlib==3.11.2', '--with', 'fonttools[woff]==4.61.1', 'python', ...args], { encoding: 'utf8', ...opts });

py([join(here, 'checker/make_data.py'), shop]);
mkdirSync(join(shop, 'tools/fonts'), { recursive: true });
copyFileSync(join(here, 'checker/margin_check.py'), join(shop, 'tools/margin_check.py'));
py(['-c', `
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
for w, style in ((400, "Regular"), (600, "SemiBold")):
    f = TTFont(sys.argv[1])
    f = instancer.instantiateVariableFont(f, {"wght": w})
    f.flavor = None
    f["OS/2"].usWeightClass = w
    f.save(f"{sys.argv[2]}/InstrumentSans-{style}.ttf")
`, join(root, 'design-system/fonts/instrument-sans-latin.woff2'), join(shop, 'tools/fonts')]);

const stdout = py(['tools/margin_check.py', 'inbox/northside-2027.csv'], { cwd: shop });
writeFileSync(join(here, 'checker/run.txt'), stdout);
writeFileSync(join(here, 'checker/head.txt'), readFileSync(join(shop, 'inbox/northside-2027.csv'), 'utf8').split('\n').slice(0, 4).join('\n') + '\n');
process.stdout.write(stdout);
execFileSync('convert', [join(shop, 'reports/northside-2027.png'), '-quality', '86', '-define', 'webp:method=6', join(out, 'northside-2027.webp')]);
// The same chart drawn narrow for phones (the view is about 340 px wide there);
// only the chart differs, so its stdout is not kept.
py(['tools/margin_check.py', 'inbox/northside-2027.csv', '--chart-width', '4.4', '--chart', 'reports/northside-2027-narrow.png'], { cwd: shop });
execFileSync('convert', [join(shop, 'reports/northside-2027-narrow.png'), '-quality', '86', '-define', 'webp:method=6', join(out, 'northside-2027-narrow.webp')]);
console.log(execFileSync('identify', ['-format', '%f %wx%h %b\n', join(out, 'northside-2027.webp'), join(out, 'northside-2027-narrow.webp')]).toString().trim());
