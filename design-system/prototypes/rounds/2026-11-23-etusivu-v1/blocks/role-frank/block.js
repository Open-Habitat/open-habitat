// Frank: researcher, dye project. His three shown glimpses carry real output:
// the database answer comes from DuckDB on generated lab exports, and the R
// glimpses show what R printed and the figures ggplot2 drew
// (node blocks/role-frank/assets.mjs). The block contract is in ../../BLOCKS.md.
import { esc, you, att, tool, turn, diff, screen, view, image, assets } from '../../engine/kit.mjs';
import { toggles, sheetMock } from '../../engine/views.mjs';

// ---------- The files Frank's agent writes ----------
// Shown in the work rows, and run as they are by assets.mjs.
export const FASTNESS_R = String.raw`# fastness.R: how six dye recipes on linen hold their colour.
# Reads every tests/batch-*.csv, fits one mixed model per test (recipe fixed;
# batch, and recipe within batch, random), prints the estimates and the
# pairwise differences, and draws figures/wash.png and figures/light.png.
# Rerun after a new batch: Rscript analysis/fastness.R
suppressPackageStartupMessages({ library(lmerTest); library(emmeans); library(ggplot2) })

d <- do.call(rbind, lapply(sort(Sys.glob("tests/batch-*.csv")), read.csv))
d$recipe <- factor(d$recipe); d$batch <- factor(d$batch)
names <- setNames(unique(d$recipe_name), unique(d$recipe))
dye <- c(A = "#3d5a8c", B = "#1f3563", C = "#c9a227", D = "#8f8a2c", E = "#b5432f", F = "#6a3440")
ask <- c("B - F", "C - D")  # the comparisons the lab asked about
open_q <- "C - D"           # the open one, bracketed in the figures
cat(nlevels(d$batch), "batches ·", nrow(d), "samples ·", nlevels(d$recipe), "recipes\n")

for (test in c("wash", "light")) {
  y <- paste0("delta_e_", test)
  m <- lmer(reformulate(c("recipe", "(1 | batch)", "(1 | batch:recipe)"), y), data = d)
  em <- emmeans(m, ~ recipe, lmer.df = "satterthwaite")
  est <- as.data.frame(em)
  cat("\n", test, ": ", deparse(formula(m)), "\n", sep = "")
  print(est[, c("recipe", "emmean", "lower.CL", "upper.CL")], digits = 2, row.names = FALSE)
  pw <- as.data.frame(pairs(em))  # Tukey-adjusted, all 15 pairs
  print(pw[pw$contrast %in% ask, c("contrast", "estimate", "p.value")], digits = 2, row.names = FALSE)

  # The previous run's estimates, if any, are drawn in grey behind the new ones.
  prev_file <- file.path("results", paste0(test, ".csv"))
  prev <- if (file.exists(prev_file)) read.csv(prev_file) else NULL
  dir.create("results", showWarnings = FALSE); write.csv(cbind(est, batches = nlevels(d$batch)), prev_file, row.names = FALSE)

  lab <- function(r) paste0(r, "  ", names[r])
  d$y <- d[[y]]; d$lab <- factor(lab(as.character(d$recipe)), levels = rev(lab(levels(d$recipe))))
  est$lab <- factor(lab(as.character(est$recipe)), levels = levels(d$lab))
  # A bracket on the right for the open question, with its p value.
  top <- max(d$y) * 1.04; r <- strsplit(open_q, " - ")[[1]]
  br <- data.frame(x = top, y1 = as.numeric(est$lab[est$recipe == r[1]]), y2 = as.numeric(est$lab[est$recipe == r[2]]),
    p = pw$p.value[pw$contrast == open_q])
  br$txt <- paste0(if (br$p < .05) "differ\n" else "not yet\n", if (br$p < .01) sprintf("p = %.3f", br$p) else sprintf("p = %.2f", br$p))
  p <- ggplot(d, aes(y, lab)) +
    geom_jitter(aes(colour = recipe), height = .22, width = 0, size = 1.1, alpha = .38, shape = 16) +
    geom_segment(data = br, aes(x = x, xend = x, y = y1, yend = y2, colour = NULL), inherit.aes = FALSE, colour = ifelse(br$p < .05, "#14201a", "grey60"), linewidth = .5) +
    geom_segment(data = rbind(transform(br, y = y1), transform(br, y = y2)), aes(x = x - .2, xend = x, y = y, yend = y), inherit.aes = FALSE, colour = "grey45", linewidth = .5) +
    geom_label(data = br, aes(x = x + .25, y = (y1 + y2) / 2, label = txt), inherit.aes = FALSE, family = "JetBrains Mono", size = 3.5, hjust = 0, lineheight = .95,
      colour = ifelse(br$p < .05, "#14201a", "grey45"), fill = "white", linewidth = 0, label.padding = unit(2, "pt")) +
    { if (!is.null(prev)) { prev$lab <- factor(lab(prev$recipe), levels = levels(d$lab))
        geom_pointrange(data = prev, aes(emmean, lab, xmin = lower.CL, xmax = upper.CL), inherit.aes = FALSE,
          position = position_nudge(y = .3), colour = "grey62", linewidth = .7, size = .38, shape = 21, fill = "white") } } +
    geom_pointrange(data = est, aes(emmean, lab, xmin = lower.CL, xmax = upper.CL, fill = recipe), inherit.aes = FALSE,
      colour = "#14201a", linewidth = 1, size = .62, shape = 21, stroke = 1.1) +
    coord_cartesian(clip = "off") +
    scale_colour_manual(values = dye, guide = "none") + scale_fill_manual(values = dye, guide = "none") +
    scale_x_continuous(limits = c(0, top * 1.38), breaks = seq(0, 20, 2), expand = expansion(mult = c(0, .03))) +
    labs(x = if (test == "wash") quote("Colour change after 20 washes, " * Delta * E["00"]) else quote("Colour change after 80 h of light, " * Delta * E["00"]),
      y = NULL,
      title = if (test == "wash") "Wash fastness on linen" else "Light fastness on linen",
      subtitle = paste0("Small dots: samples. Large: model estimate, 95% CI.\n", nlevels(d$batch), " batches, ", nrow(d), " samples",
        if (!is.null(prev)) paste0(". Grey: the previous run, ", prev$batches[1], " batches.") else ".")) +
    theme_minimal(base_size = 12.5, base_family = "Instrument Sans") +
    theme(panel.grid.major.y = element_blank(), panel.grid.minor = element_blank(),
      panel.grid.major.x = element_line(colour = "#e3e7e0", linewidth = .4),
      axis.text.y = element_text(colour = "#1d2a22", size = 12.5, hjust = 0),
      axis.text.x = element_text(colour = "#5b6660", family = "JetBrains Mono", size = 10.5),
      axis.title.x = element_text(colour = "#3b4640", size = 11, margin = margin(t = 8)),
      plot.title = element_text(face = "bold", size = 15, colour = "#14201a"),
      plot.subtitle = element_text(colour = "#5b6660", size = 10.5, margin = margin(b = 10), lineheight = 1.1),
      plot.title.position = "plot", plot.background = element_rect(fill = "white", colour = NA),
      plot.margin = margin(14, 18, 10, 12))
  dir.create("figures", showWarnings = FALSE)
  ggsave(file.path("figures", paste0(test, ".png")), p, width = 6, height = 4.2, dpi = 200, device = ragg::agg_png)
}
cat("\nfigures/wash.png · figures/light.png\n")
`;

export const LOAD_PY = String.raw`# tools/load_exports.py <exports-dir>: read every lab export, whatever its layout, into dyes.duckdb.
import sys, datetime as dt
from pathlib import Path
import duckdb
from openpyxl import load_workbook

def num(v): return float(str(v).replace(',', '.'))
def day(v): return v.date() if isinstance(v, dt.datetime) else dt.date.fromisoformat(v) if '-' in v else dt.datetime.strptime(v, '%d.%m.%Y').date()

def rows(path):
    ws = load_workbook(path, read_only=True).active
    cells = [r for r in ws.iter_rows(values_only=True) if any(c is not None for c in r)]
    head = next(i for i, r in enumerate(cells) if r[0] in ('Date', 'test_date', 'Sample ID'))
    h, body = cells[head], cells[head + 1:]
    if h[0] == 'test_date':                       # 2019–2020: title rows, upper-case fibres
        for d, s, fi, dy, mo, w, de in body: yield day(d), s, fi.lower(), dy.lower(), mo or 'none', int(w), num(de), 2
    elif h[0] == 'Sample ID':                     # 2024–: text dates, decimal commas, "20 x"
        for s, d, fi, dy, mo, w, de in body: yield day(d), s, fi.split()[0], dy, mo, int(w.split()[0]), num(de), 4
    elif h[3] == 'Dye + mordant':                 # 2021–2023: one row per sample, washes as columns
        for d, s, fi, dm, *de in body:
            dy, _, mo = dm.partition(' / ')
            for w, v in zip((5, 10, 20), de): yield day(d), s, fi, dy, mo or 'none', w, num(v), 3
    else:                                         # 2016–2018: the original long layout
        for d, s, fi, dy, mo, w, de in body: yield day(d), s, fi, dy, mo, int(w), num(de), 1

files = sorted(Path(sys.argv[1]).glob('*.xlsx'))
data = [r for f in files for r in rows(f)]
con = duckdb.connect('dyes.duckdb')
con.execute('create or replace table wash_tests (tested date, sample varchar, fibre varchar, dye varchar, mordant varchar, washes int, delta_e double, layout int)')
con.executemany('insert into wash_tests values (?, ?, ?, ?, ?, ?, ?, ?)', data)
n_lay = con.execute('select count(distinct layout) from wash_tests').fetchone()[0]
print(f'{len(files)} files · {n_lay} layouts · {len(data):,} test rows → dyes.duckdb')
`;

export const BEST_SQL = `-- Which dye held best on linen? Median colour change after 20 washes.
select dye, mordant, count(*) as tests, round(median(delta_e), 1) as median_de
from wash_tests
where fibre = 'linen' and washes = 20
group by dye, mordant
order by median_de
limit 5;
`;

const asset = assets(import.meta.url);
const lines = (s, a, b) => s.split('\n').slice(a, b).join('\n');
const nLines = (s) => s.trimEnd().split('\n').length;

// ---------- This block's own views ----------
// The first answer from the database: the query and its result, as DuckDB returned it.
const DYE = { indigo: '#2a4479', walnut: '#5e4632', madder: '#a63a2b', cochineal: '#a3264f', weld: '#c9a227' };
const BEST = [['indigo', 'none', 332, 2.6], ['walnut', 'none', 315, 3.5], ['madder', 'iron', 297, 3.9], ['cochineal', 'alum', 307, 4.1], ['madder', 'alum', 310, 4.2]];
const queryView = () => `<div class="fq"><pre class="fq-sql"><span class="fq-k">select</span> dye, mordant, count(*) <span class="fq-k">as</span> tests,
  round(median(delta_e), 1) <span class="fq-k">as</span> median_de
<span class="fq-k">from</span> wash_tests
<span class="fq-k">where</span> fibre = <span class="fq-s">'linen'</span> <span class="fq-k">and</span> washes = 20
<span class="fq-k">group by</span> dye, mordant <span class="fq-k">order by</span> median_de</pre>
<table class="fq-t"><thead><tr><th>dye</th><th>mordant</th><th class="n">tests</th><th class="n">median ΔE</th><th class="fq-barh"><span class="sr">bar</span></th></tr></thead><tbody>${BEST.map(([d, m, n, e], k) => `<tr${k === 0 ? ' class="on"' : ''}><td><i class="fq-sw" style="--c:${DYE[d]}"></i>${esc(d)}</td><td>${esc(m)}</td><td class="n">${n}</td><td class="n">${e.toFixed(1)}</td><td class="fq-bar"><i style="--w:${Math.round((e / 6) * 100)}%;--c:${DYE[d]}"></i></td></tr>`).join('')}</tbody></table>
<p class="fq-n"><span>dyes.duckdb · 18,375 rows</span><span>120 files · 4 layouts · 2016–2026</span></p></div>`;

// The R figures. The first glimpse lets the reader switch between the two tests.
const FIG = { w: 1200, h: 840 };
// R also saves each figure narrower (assets.mjs), so its text stays readable on a phone.
const fig = (name, alt) => `<picture><source media="(max-width: 560px)" srcset="${asset(name.replace('.webp', '-narrow.webp'))}" width="880" height="1012">${image(asset(name), alt, FIG.w, FIG.h)}</picture>`;
const figures = () => `<div class="ff" data-view data-state="wash">${toggles([['wash', 'After 20 washes'], ['light', 'After 80 h of light']], 'wash')}<div class="ff-fig ff-wash">${fig('wash.webp', 'Wash fastness on linen: dot plot of colour change per recipe, 6 batches, 432 samples. B, indigo with six dips, changes least; C and D overlap.')}</div><div class="ff-fig ff-light">${fig('light.webp', 'Light fastness on linen: colour change after 80 hours of light per recipe. The two weld recipes fade most.')}</div><p class="ff-n"><span>R 4.5 · lme4 · ggplot2</span><span>drawn by analysis/fastness.R</span></p></div>`;
const rerunFigure = () => `<div class="ff">${fig('wash-batch7.webp', 'Wash fastness after batch 7: 7 batches, 504 samples, with this morning’s estimates in grey. C and D now differ, p = 0.04.')}<p class="ff-n"><span>7 batches · 504 samples</span><span>grey: this morning’s run</span></p></div>`;

// Other glimpses' views, from round 6.
const SPK = { Alice: 'a', Bob: 'b', Carol: 'c' };
const transcriptMock = (lines, people = SPK, len = '58:12') => `<div class="tr"><div class="tr-wave" aria-hidden="true">${Array.from({ length: 64 }, (_, k) => `<i style="--h:${(22 + ((k * 37) % 61)) }%" class="sp-${'abc'[Math.floor(k / 9) % 3]}"></i>`).join('')}</div><p class="tr-len">${len} · ${Object.keys(people).length} speakers · transcribed on this server</p><ol>${lines.map(([t, who, text]) => `<li><time>${t}</time><b class="sp-${people[who] || 'a'}">${esc(who)}</b><span>${esc(text)}</span></li>`).join('')}</ol></div>`;
const scanMock = (h, lines, hit, word, label, foot) => `<div class="scan" data-view data-state="found">${toggles([['scan', 'Scanned'], ['found', label]], 'found')}<div class="scan-p"><p class="scan-h">${esc(h)}</p>${lines.map((l, k) => `<span class="scan-l${k === hit ? ' hit' : ''}">${k === hit ? esc(l).replace(word, `<mark>${word}</mark>`) : esc(l)}</span>`).join('')}</div><p class="scan-n">${esc(foot)}</p></div>`;

// What R and DuckDB printed (node blocks/role-frank/assets.mjs), shortened.
const R_RUN_1 = `6 batches · 432 samples · 6 recipes

wash: delta_e_wash ~ recipe + (1 | batch) + (1 | batch:recipe)
 recipe emmean lower.CL upper.CL
      A    4.9      4.3      5.4
      B    2.4      1.9      3.0
      C    6.3      5.8      6.9
      D    5.7      5.2      6.3
      E    4.5      3.9      5.0
      F    3.5      3.0      4.1
 contrast estimate p.value
    B - F    -1.10  0.0046
    C - D     0.57  0.3060

light: delta_e_light ~ recipe + (1 | batch) + (1 | batch:recipe)
 …
    C - D     1.28   0.033

figures/wash.png · figures/light.png`;
const R_RUN_7 = `7 batches · 504 samples · 6 recipes

wash: delta_e_wash ~ recipe + (1 | batch) + (1 | batch:recipe)
 recipe emmean lower.CL upper.CL
      B    2.4      1.9      2.9
      C    6.4      5.9      6.9
      D    5.6      5.1      6.1
      …
 contrast estimate p.value
    B - F    -1.06  0.0046
    C - D     0.84  0.0385

light: …
    C - D      1.3  0.0051

figures/wash.png · figures/light.png`;
const DUCK_OUT = `┌───────────┬─────────┬───────┬───────────┐
│    dye    │ mordant │ tests │ median_de │
├───────────┼─────────┼───────┼───────────┤
│ indigo    │ none    │   332 │       2.6 │
│ walnut    │ none    │   315 │       3.5 │
│ madder    │ iron    │   297 │       3.9 │
│ cochineal │ alum    │   307 │       4.1 │
│ madder    │ alum    │   310 │       4.2 │
└───────────┴─────────┴───────┴───────────┘`;

export default {
  id: 'role-frank',
  kind: 'role',
  // pick: 1 marks the glimpses the page shows; the others are reached from the sidebar.
  day: {
  id: 'frank', name: 'Frank', role: 'Researcher, dye project', org: 'Example Studio', color: '#2f4f73',
  blurb: 'Frank runs the studio’s dye research with Riverside University’s textile lab: which plant dyes keep their colour on linen, in the wash and in the sun.',
  places: [['08:15', 'At the lab', 'lab'], ['12:00', 'Lunch', 'lunch'], ['12:45', 'At the lab', 'lab'], ['13:30', 'Seminar', 'meet'], ['14:30', 'At the lab', 'lab']],
  sess: [
    { id: 'db', title: 'Ten years of test results', segs: [['08:20', 'run', 'Reading 120 spreadsheets'], ['08:40', 'turn', 'One database · first answer'], ['09:00', 'quiet', 'dyes.duckdb']] },
    { id: 'fast', title: 'Colour-fastness in R', segs: [['09:15', 'run', 'Installing R'], ['09:50', 'turn', 'Model and 2 figures'], ['10:10', 'quiet', 'analysis/fastness.R'], ['14:32', 'run', 'Rerunning with batch 7'], ['14:40', 'turn', 'C and D now differ'], ['14:44', 'run', 'Writing the care note'], ['14:46', 'quiet', 'team/products/indigo-care.md']] },
    { id: 'notes', title: 'Lab notebooks 1994–2001', segs: [['10:30', 'run', 'Reading 640 scanned pages'], ['11:30', 'turn', 'Searchable · 212 recipes'], ['11:45', 'quiet', 'notebooks/']] },
    { id: 'talk', title: 'Dyer interviews', segs: [['12:10', 'run', 'Transcribing 5 h 20 min'], ['12:55', 'turn', '6 transcripts, speakers named'], ['13:10', 'quiet', 'interviews/']] },
    { id: 'sun', title: 'Sunshine data', segs: [['15:10', 'run', 'Asking the weather service'], ['15:30', 'turn', 'Daily sun hours, 2019–2026'], ['15:40', 'quiet', 'sun-hours.csv']] },
    { id: 'papers', title: 'Lightfastness papers', segs: [['16:20', 'run', 'Indexing 40 papers'], ['16:40', 'turn', '6 papers, with pages'], ['16:50', 'quiet', 'Read']] },
  ],
  g: [
    {
      s: 'db', at: '08:40', pick: 1, ask: 'Ten years of the lab’s test results are 120 Excel exports in four different layouts. Make them one database I can ask.',
      did: 'Every few years someone redesigned the spreadsheet. His agent works out all four layouts, loads every file once into one database in his folder, and answers his first question with the query beside it. The answer can be checked, and the next question starts from the same place.',
      screen: () => screen('Ten years of test results', you('08:20', 'Ten years of the lab’s test results are 120 Excel exports in four different layouts. Make them one database I can ask. First: which dye held best on linen?', att('exports/', '120 xlsx · 2016–2026')) + turn({
        thoughts: ['The header row moves in 2019, washes turn into columns in 2021, and from 2024 the numbers have decimal commas. One loader can read all four.'],
        tools: [
          tool('bash', 'ls exports/ | sed -n "1p;48p;80p;120p"', 'wash-tests-2016-01-15.xlsx\nwash-tests-2020-04-11.xlsx\nwash-tests-2023-03-01.xlsx\nwash-tests-2026-10-09.xlsx'),
          tool('write', 'tools/load_exports.py', lines(LOAD_PY, 0, 1) + '\n…\n' + lines(LOAD_PY, 9, 24) + '\n…', `new · ${nLines(LOAD_PY)} lines`),
          tool('bash', 'uv run --with duckdb,openpyxl python3 tools/load_exports.py exports/', '120 files · 4 layouts · 18,375 test rows → dyes.duckdb'),
          tool('write', 'queries/best-on-linen.sql', BEST_SQL, `new · ${nLines(BEST_SQL)} lines`),
          tool('bash', 'duckdb dyes.duckdb < queries/best-on-linen.sql', DUCK_OUT),
        ],
        time: '20 min 53 s',
        reply: 'Over ten years, **indigo held best on linen**: a median colour change of **2.6 after 20 washes**, across 332 tests. Walnut and madder with iron come next.\n\nAll 120 files are now one table in *dyes.duckdb*, and the query is in *queries/*, so the next question starts from the same database.',
      }), view('dyes.duckdb', queryView(), 'Query'), 'Example Studio'),
    },
    {
      s: 'fast', at: '09:50', pick: 1, ask: 'Fit a model to the colour-fastness tests: six recipes, batches 1 to 6. In R, so the lab can read it and rerun it.',
      did: 'R is not on the server, so his agent installs it in Frank’s own account, no administrator needed. It writes the analysis as one script the lab can read, fits a model that allows for differences between test batches, and has R draw the figures. The script stays in his folder, so the next batch is one sentence.',
      screen: () => screen('Colour-fastness in R', you('09:15', 'Fit a model to the colour-fastness tests: six recipes, batches 1 to 6. In R, so the lab can read it and rerun it.', att('tests/', '6 batches · 432 samples')) + turn({
        thoughts: ['Samples from one batch share a dye bath and a test day, so batch goes in as a random effect, and recipe within batch too.'],
        tools: [
          tool('bash', 'Rscript --version', 'bash: Rscript: command not found'),
          tool('bash', 'micromamba create -n r -c conda-forge r-base r-lme4 r-lmertest r-emmeans r-ggplot2 r-ragg', 'Linking r-base-4.5.3\nLinking r-lme4-2.0_6\nLinking r-ggplot2-4.0.4\n…\nTransaction finished\n\nEnvironment: ~/micromamba/envs/r'),
          tool('write', 'analysis/fastness.R', lines(FASTNESS_R, 0, 31) + '\n…', `new · ${nLines(FASTNESS_R)} lines`),
          tool('bash', 'Rscript analysis/fastness.R', R_RUN_1),
        ],
        time: '35 min 38 s',
        reply: '**Recipe B, indigo with six dips, changes least in the wash**: ΔE 2.4 (95% CI 1.9–3.0), clearly ahead of the next best, F (p = 0.005), with the batches allowed for.\n\n**C and D cannot be told apart in the wash yet** (p = 0.31). In light they can: both weld recipes fade most. The figures are beside this; *fastness.R* reruns everything from the folder.',
      }), view('figures/wash.png', figures(), 'Figures'), 'Example Studio'),
    },
    {
      s: 'notes', at: '11:30', ask: 'The lab notebooks from the 1990s dye trials are scanned. Make them searchable, and list the recipes.',
      did: 'Six hundred and forty pages, typed and handwritten, scanned crooked. His agent straightens and reads them, saves searchable PDFs, and pulls every recipe into one list, marking those it could not read with confidence.',
      screen: () => screen('Lab notebooks 1994–2001', you('10:30', 'The lab notebooks from the 1990s dye trials are scanned. Make them searchable, and list the recipes.', att('notebooks-scanned/', '640 pages')) + turn({ tools: [
        tool('bash', 'ocrmypdf --deskew --rotate-pages -l eng notebooks-scanned/*.pdf notebooks/', '640 pages · text added · PDF/A'),
        tool('bash', 'python3 tools/recipes.py notebooks/', '212 recipes · 19 low confidence, each linked to its page'),
      ], time: '1 h 00 min', reply: 'All 640 pages are searchable now, and **212 recipes** are in *recipes.csv*. Nineteen were hard to read; each links to its page.' }), view('notebook 1996 · p. 41', scanMock('Lab notebook · 3 March 1996', ['Trial 41: weld on scoured linen', 'Mordant: alum 12 %, overnight', '2 h at 80 °C · rinsed · dried in shade', 'Wash test after 2 weeks: little change'], 1, 'alum', 'Searched: “alum”', '640 pages · 212 recipes · PDF/A')), 'Example Studio'),
    },
    {
      s: 'talk', at: '12:55', ask: 'Six interviews with retired dyers, five hours in all. Transcribe them here, speakers named.',
      did: 'The interviews are people’s own stories, so they stay on the studio’s server. His agent transcribes them there, names the speakers from his interview notes, and marks the passages about mordants.',
      screen: () => screen('Dyer interviews', you('12:10', 'Six interviews with retired dyers, five hours in all. Transcribe them here, speakers named.', att('interviews/', '6 recordings · 5 h 20 min')) + turn({ tools: [
        tool('bash', 'uv tool install whisperx', 'installed into ~/.local · no administrator needed'),
        tool('bash', 'whisperx interviews/*.m4a --diarize', 'transcribed on this server · nothing uploaded · 6 transcripts'),
        tool('write', 'interviews/index.md', '6 transcripts · 23 passages about mordants marked'),
      ], time: '45 min 08 s', reply: 'Six transcripts in *interviews/*, speakers named from your notes. **23 passages** about mordants are marked; the one about alum and rainwater is in interview 4 at 31:20.' }), view('interview-4.md', transcriptMock([['02:14', 'Frank', 'When did you start at the dye house?'], ['02:20', 'Hilda', 'In 1968. My mother was there before me.'], ['31:20', 'Hilda', 'We used rainwater for the alum. Tap water made the yellow go dull.'], ['31:42', 'Frank', 'Was that written down anywhere?']], { Frank: 'a', Hilda: 'b' }, '54:08')), 'Example Studio'),
    },
    {
      s: 'fast', at: '14:40', pick: 1, hand: 'Hands to Alice: a three-line care note for the indigo tote goes into team/products/, where the shop page reads it.',
      ask: 'Batch 7 from the lab is in. Rerun the analysis.',
      did: 'The lab sent the seventh batch during the seminar. His agent reruns the same script on all seven batches and says what changed. The open question from the morning now has an answer, and Frank turns the result into a care note for the shop in plain words.',
      screen: () => screen('Colour-fastness in R', you('14:32', 'Batch 7 from the lab is in. Rerun the analysis.', att('tests/batch-07.csv', '72 samples')) + turn({ tools: [
        tool('bash', 'Rscript analysis/fastness.R', R_RUN_7),
      ], time: '8 min 45 s', reply: 'Rerun on all seven batches. **B still holds best.** With batch 7, **C and D now differ in the wash**: D, with tannin, changes 0.84 less (p = 0.04). In the figure, grey is this morning’s run.' }) + you('14:44', 'Write the shop a care note for the indigo tote from this. Three lines.') + turn({ tools: [
        diff('team/products/indigo-care.md', ['+ Wash at 40 °C, inside out, with a mild soap.', '+ Dry in the shade; indigo keeps its depth longer.', '+ Wash- and light-tested with Riverside University’s textile lab.']),
      ], time: '30 s', reply: 'In *team/products/indigo-care.md*, where the shop page reads it.' }), view('figures/wash.png', rerunFigure(), 'Figures'), 'Example Studio'),
    },
    {
      s: 'sun', at: '15:30', ask: 'Daily sunshine hours for the test garden since 2019, from the weather service’s open data, next to our outdoor light tests.',
      did: 'The weather service publishes its observations through an open interface. His agent asks it for the nearest station day by day, saves the table, and joins it to the outdoor tests in his database.',
      screen: () => screen('Sunshine data', you('15:10', 'Daily sunshine hours for the test garden since 2019, from the weather service’s open data, next to our outdoor light tests.') + turn({ tools: [
        tool('bash', 'python3 tools/weather_api.py --station nearest --param sunshine --from 2019-01-01', '2,880 days · 14 missing, marked'),
        tool('bash', 'duckdb dyes.duckdb -c "create table sun as …; select … join outdoor_tests …"', 'sun hours joined to 1,140 outdoor tests'),
      ], time: '20 min 15 s', reply: '**2,880 days** of sunshine hours are in *sun-hours.csv* and in the database, joined to every outdoor test. Fourteen days had no reading; they are marked, not guessed.' }), view('sun-hours.csv', sheetMock('sun-hours.csv', ['Month', 'Sun hours', 'Outdoor tests'], [['Jun 2025', '292', '48'], ['Jul 2025', '305', '52'], ['Aug 2025', '241', '44'], ['Sep 2025', '163', '40']], '2019–2026 · weather service open data')), 'Example Studio'),
    },
    {
      s: 'papers', at: '16:40', ask: 'Which of these forty papers measured lightfastness of indigo on linen?',
      did: 'His agent searches every paper, the scanned ones too, by word and by meaning, so it also finds the two that call it “fading under light”. It answers with the page for each.',
      screen: () => screen('Lightfastness papers', you('16:20', 'Which of these forty papers measured lightfastness of indigo on linen?', att('literature/dyes/', '40 PDFs')) + turn({ tools: [
        tool('bash', 'rga -i "lightfast|light fastness" literature/dyes/', '4 papers by word'),
        tool('bash', 'python3 tools/semantic_search.py "indigo on linen fades in light"', '2 more by meaning · “fading under light”, “photodegradation”'),
      ], time: '20 min 52 s', reply: '**Six papers**, with the page for each:\n\n| File | Fibre | Page |\n|---|---|---|\n| lightfast-linen-2019.pdf | linen | 7 |\n| indigo-fibres-2021.pdf | linen, cotton | 12 |\n| dye-ageing-2015.pdf | linen | 4 |\n\n… and three more. Two of them never use the word “lightfastness”.' }), '', 'Example Studio'),
    },
  ],
},
};
