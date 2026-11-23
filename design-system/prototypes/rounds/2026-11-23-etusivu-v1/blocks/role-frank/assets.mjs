// node blocks/role-frank/assets.mjs: Frank's figures, made by R from synthetic data.
//
// 1. Simulates the lab's colour-fastness trials (sim.R below: six recipes,
//    seven batches of 72 samples, seed 20) and runs Frank's analysis script
//    (FASTNESS_R in block.js, the script his agent writes in the scene) on
//    batches 1-6, then again with batch 7, as in the scene. The PNGs R draws
//    become wash.webp, light.webp and wash-batch7.webp in
//    $ETUSIVU_ASSETS/role-frank/.
// 2. Generates ten years of lab exports (gen_exports.py below: 120 xlsx in
//    four layouts), loads them with Frank's loader (LOAD_PY in block.js) into
//    DuckDB and runs BEST_SQL. Its output is pasted, shortened, into block.js;
//    no file is shipped from this step.
//
// Needs: Rscript with lme4, lmerTest, emmeans, ggplot2, ragg (RSCRIPT=/path
// or on PATH; `micromamba create -p <scratch>/renv -c conda-forge r-base
// r-lme4 r-lmertest r-emmeans r-ggplot2 r-ragg`), uv, and ImageMagick's
// convert. Set TMPDIR to your scratch. Everything R and DuckDB print is
// echoed, so the work rows in block.js can be checked against it.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FASTNESS_R, LOAD_PY, BEST_SQL } from './block.js';

const here = dirname(fileURLToPath(import.meta.url));
const fonts = resolve(here, '../../../../../fonts');
const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), 'role-frank');
const R = process.env.RSCRIPT || 'Rscript';
const w = mkdtempSync(join(tmpdir(), 'role-frank-'));
const run = (cmd, args, cwd = w) => { const o = execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }); process.stdout.write(o); return o; };
const put = (p, text) => { mkdirSync(dirname(join(w, p)), { recursive: true }); writeFileSync(join(w, p), text); };

// The page's fonts (OFL, design-system/fonts) as static TTFs, so the figures read like the page.
put('fonts.py', `import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
for n in ('instrument-sans-latin', 'jetbrains-mono-latin'):
    for wt in (400, 600):
        f = TTFont(f'{sys.argv[1]}/{n}.woff2'); f.flavor = None
        instancer.instantiateVariableFont(f, {'wght': wt}).save(f'{n}-{wt}.ttf')
`);
run('uv', ['run', '-q', '--with', 'fonttools,brotli', 'python3', '-I', 'fonts.py', fonts]);

// The trials, and Frank's script run as he runs it (fonts registered first).
put('sim.R', String.raw`# Synthetic colour-fastness trials: six recipes, seven batches, 12 samples per recipe per batch.
args <- commandArgs(TRUE); seed <- as.integer(args[1]); out <- args[2]
set.seed(seed)
rec <- c(A = "indigo, 3 dips", B = "indigo, 6 dips", C = "weld, alum", D = "weld, alum + tannin", E = "madder, alum", F = "madder, alum + iron")
wash <- c(A = 4.6, B = 2.5, C = 6.5, D = 5.5, E = 4.3, F = 3.5)
light <- c(A = 3.9, B = 2.7, C = 8.4, D = 7.3, E = 3.3, F = 2.8)
dir.create(out, showWarnings = FALSE, recursive = TRUE)
for (b in 1:7) {
  bw <- rnorm(1, 0, .5); bl <- rnorm(1, 0, .6)
  rows <- do.call(rbind, lapply(names(rec), function(r) {
    iw <- rnorm(1, 0, .3); il <- rnorm(1, 0, .4)
    data.frame(sample = sprintf("B%02d-%s%02d", b, r, 1:12), batch = b, recipe = r, recipe_name = rec[[r]],
      delta_e_wash = round(pmax(.2, (wash[[r]] + bw + iw) * exp(rnorm(12, 0, .22))), 2),
      delta_e_light = round(pmax(.2, (light[[r]] + bl + il) * exp(rnorm(12, 0, .2))), 2))
  }))
  write.csv(rows, file.path(out, sprintf("batch-%02d.csv", b)), row.names = FALSE)
}
`);
run(R, ['sim.R', '20', 'all-batches']);
put('frank/analysis/fastness.R', FASTNESS_R);
mkdirSync(join(w, 'frank/tests'), { recursive: true });
const batch = (n) => copyFileSync(join(w, `all-batches/batch-0${n}.csv`), join(w, `frank/tests/batch-0${n}.csv`));
const reg = (family, file) => `systemfonts::register_font("${family}", plain = "${w}/${file}-400.ttf", bold = "${w}/${file}-600.ttf")`;
// Each ggsave in the script also writes a narrow copy of the same plot for phones (figures/*-narrow.png).
const NARROW = 'ggsave <- function(filename, plot, ...) { ggplot2::ggsave(filename, plot, ...); ggplot2::ggsave(sub("[.]png$", "-narrow.png", filename), plot, width = 4.4, height = 5.06, dpi = 200, device = ragg::agg_png) }';
const rscript = () => run(R, ['-e', `${reg('Instrument Sans', 'instrument-sans-latin')}; ${reg('JetBrains Mono', 'jetbrains-mono-latin')}; ${NARROW}; source("analysis/fastness.R")`], join(w, 'frank'));
const webp = (png, name) => execFileSync('convert', [join(w, 'frank/figures', png), '-quality', '84', '-define', 'webp:method=6', join(out, name)]);
mkdirSync(out, { recursive: true });
console.log('\n== Rscript analysis/fastness.R  (batches 1-6) ==');
[1, 2, 3, 4, 5, 6].forEach(batch); rscript();
for (const f of ['wash', 'light']) { webp(`${f}.png`, `${f}.webp`); webp(`${f}-narrow.png`, `${f}-narrow.webp`); }
console.log('\n== Rscript analysis/fastness.R  (batch 7 arrives) ==');
batch(7); rscript();
webp('wash.png', 'wash-batch7.webp'); webp('wash-narrow.png', 'wash-batch7-narrow.webp');

// Ten years of exports, one database, the first question.
put('gen_exports.py', String.raw`# gen_exports.py <out>: ten years of synthetic lab exports, 120 xlsx in four layouts.
import random, sys, datetime as dt
from pathlib import Path
from openpyxl import Workbook
out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
rnd = random.Random(7)
DYES = {('indigo', 'none'): 2.6, ('madder', 'alum'): 4.4, ('madder', 'iron'): 3.9, ('weld', 'alum'): 6.1,
        ('weld', 'none'): 8.2, ('woad', 'none'): 5.6, ('cochineal', 'alum'): 4.1, ('onion skin', 'alum'): 6.8, ('walnut', 'none'): 3.4}
FIBRES = ['linen'] * 5 + ['wool'] * 3 + ['cotton'] * 2 + ['silk']
WASHES = [5, 10, 20]
def layout(year): return 1 if year <= 2018 else 2 if year <= 2020 else 3 if year <= 2023 else 4
rows_total = 0
for k in range(120):
    date = dt.date(2016, 1, 15) + dt.timedelta(days=k * 3920 // 119); year = date.year; lay = layout(year)
    wb = Workbook(); ws = wb.active; ws.title = 'Results'
    samples = []
    for s in range(rnd.randint(46, 56)):
        (dye, mord), base = rnd.choice(list(DYES.items()))
        fibre = rnd.choice(FIBRES); f = {'linen': 1.0, 'wool': .8, 'cotton': 1.1, 'silk': .9}[fibre]
        de = {w: round(base * f * (w / 20) ** .6 * rnd.lognormvariate(0, .25), 2) for w in WASHES}
        samples.append((f'{year % 100:02d}{k:03d}-{s + 1:02d}', fibre, dye, mord, de))
    if lay == 1:
        ws.append(['Date', 'Sample', 'Fibre', 'Dye', 'Mordant', 'Washes', 'dE'])
        for sid, fi, dy, mo, de in samples:
            for w in WASHES: ws.append([date, sid, fi, dy, mo, w, de[w]]); rows_total += 1
    elif lay == 2:
        ws.append([f'Riverside textile lab: wash test export {date:%d.%m.%Y}']); ws.append(['Operator: lab']); ws.append([])
        ws.append(['test_date', 'sample_id', 'substrate', 'dyestuff', 'mordant', 'wash_cycles', 'delta_E_2000'])
        for sid, fi, dy, mo, de in samples:
            for w in WASHES: ws.append([date.isoformat(), sid, fi.upper(), dy.title(), mo if mo != 'none' else '', w, de[w]]); rows_total += 1
    elif lay == 3:
        ws.append(['Date', 'Sample', 'Fibre', 'Dye + mordant', 'dE 5 washes', 'dE 10 washes', 'dE 20 washes'])
        for sid, fi, dy, mo, de in samples:
            ws.append([date, sid, fi, dy if mo == 'none' else f'{dy} / {mo}', de[5], de[10], de[20]]); rows_total += 3
    else:
        ws.append(['Sample ID', 'Tested', 'Material', 'Dye', 'Mordant', 'Cycles', 'ΔE (CIEDE2000)'])
        for sid, fi, dy, mo, de in samples:
            for w in WASHES: ws.append([sid, f'{date:%d.%m.%Y}', f'{fi} 100 %', dy, mo or 'none', f'{w} x', str(de[w]).replace('.', ',')]); rows_total += 1
    wb.save(out / f'wash-tests-{date:%Y-%m-%d}.xlsx')
print(f'120 exports · {rows_total} test rows')
`);
put('frank/tools/load_exports.py', LOAD_PY);
put('frank/queries/best-on-linen.sql', BEST_SQL);
run('uv', ['run', '-q', '--with', 'openpyxl', 'python3', '-I', '../gen_exports.py', 'exports'], join(w, 'frank'));
console.log('\n== uv run --with duckdb,openpyxl python3 tools/load_exports.py exports/ ==');
run('uv', ['run', '-q', '--with', 'duckdb,openpyxl', 'python3', '-I', 'tools/load_exports.py', 'exports'], join(w, 'frank'));
console.log('\n== duckdb dyes.duckdb < queries/best-on-linen.sql ==');
run('uv', ['run', '-q', '--with', 'duckdb', 'python3', '-I', '-c', "import duckdb; duckdb.connect('dyes.duckdb', read_only=True).sql(open('queries/best-on-linen.sql').read()).show()"], join(w, 'frank'));
console.log(execFileSync('identify', ['-format', '%f %wx%h %b\n', ...['wash', 'light', 'wash-batch7'].flatMap((f) => [`${f}.webp`, `${f}-narrow.webp`]).map((f) => join(out, f))]).toString().trim());
