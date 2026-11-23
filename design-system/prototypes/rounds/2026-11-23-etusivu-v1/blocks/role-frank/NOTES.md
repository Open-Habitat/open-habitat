# role-frank

Frank: researcher, dye project. The three glimpses the page shows now carry
real output. The database answer comes from DuckDB on generated lab exports,
and the two R glimpses show what R printed and the figures ggplot2 drew from
the same script the work rows show.

## What changed and why

- **08:40, ten years into one database.** The view is now the query and its
  result, with each dye's colour and a bar for the median ΔE, in place of the
  generic sheet mock. The work shows the four files that stand for the four
  layouts, the loader's layout branches (the real script), the load, the
  saved query and DuckDB's own table. All the numbers are what the pipeline
  printed (18,375 rows, indigo 2.6 over 332 tests). The agent's thought names
  what changed between the layouts.
- **09:50, the model in R.** The view is the R figure: a dot plot of every
  sample in its dye's colour, with the model estimate and 95 % CI on top. A
  toggle switches between the wash and light tests. The bracket marks the
  open question, C against D in the wash: “not yet, p = 0.31”. The model is
  `lmer(delta_e ~ recipe + (1 | batch) + (1 | batch:recipe))` with
  Tukey-adjusted emmeans contrasts. The `write analysis/fastness.R` row shows
  the real script, and the `Rscript` row shows its real output, shortened.
  The reply quotes those numbers.
- **14:40, batch 7.** The same script reruns. The figure keeps the morning's
  estimates as grey rings, and the bracket now reads “differ, p = 0.04”, so
  the change shows at a glance. The care note and the hand to Alice are
  unchanged in substance.
- **Chemistry made plausible.** Round 6 had “indigo with alum”, but indigo is
  a vat dye and takes no mordant. The recipes are now A/B indigo with 3 or 6
  dips, C/D weld with alum (D adds tannin), and E/F madder with alum (F adds
  iron). The database has indigo with mordant “none”. The batch-7 finding is
  now that D, with tannin, holds better than C, which fits.
- Copy tightened in the blurb and the three `did` texts. Sidebar line at
  14:40 is “C and D now differ”. The 1996 notebook and the interview quote
  now speak of weld (the yellow), to match.
- The round-6 `ciMock` and its hand-typed numbers are gone.

## Assets (`$ETUSIVU_ASSETS/role-frank/`, about 200 KB in all)

| File | What | Size |
|---|---|---|
| `wash.webp`, `light.webp` | batches 1–6, 1200×840 | ~33 KB each |
| `wash-batch7.webp` | batches 1–7 with the previous run in grey | ~36 KB |
| `*-narrow.webp` (3) | the same plots saved at 4.4 × 5.06 in for phones (880×1011), served by `<picture>` below 560 px | ~32–35 KB each |

Made by `node blocks/role-frank/assets.mjs` (set `TMPDIR`; `RSCRIPT` points
to an Rscript with the packages below). It:

1. converts the page's fonts (Instrument Sans, JetBrains Mono, OFL, from
   `design-system/fonts/`) to static TTFs with fontTools, so the figures use
   the page's type;
2. simulates the trials with `sim.R` (inside assets.mjs; seed 20, six
   recipes × seven batches × 12 samples, lognormal noise, batch and
   recipe-in-batch effects). The seed was chosen so that the batch-1–6 C/D
   contrast is not significant and the batch-7 one is: that is the story, and
   the data are synthetic;
3. runs `FASTNESS_R` (exported from `block.js`, so the scene and the run share
   one text) on batches 1–6 and again with batch 7. A `ggsave` wrapper defined
   before `source()` also saves the narrow copy, so Frank's script stays as
   shown. ImageMagick converts the PNGs to WebP (`-quality 84`);
4. generates 120 xlsx exports in four layouts (`gen_exports.py`, openpyxl),
   loads them with `LOAD_PY` into DuckDB and runs `BEST_SQL`. The printed
   table is pasted into block.js; no file ships from this step.

Versions used: R 4.5.3, lme4 2.0.6, lmerTest 3.2.1, emmeans 2.0.4, ggplot2
4.0.4, ragg 1.5.2 (conda-forge via micromamba 2.10.0, linux-aarch64); Python
duckdb and openpyxl via uv 0.12.13; ImageMagick 6.9.12. Install:
`micromamba create -p <scratch>/renv -c conda-forge r-base r-lme4 r-lmertest r-emmeans r-ggplot2 r-ragg`.
Re-running gives the same numbers; if a package update changes them, the
`R_RUN_*` and `DUCK_OUT` strings in block.js must be updated from the
script's output.

## Sources and licenses

No third-party media. The fonts rasterised into the figures are the
design system's own Instrument Sans and JetBrains Mono (SIL OFL 1.1, see
`design-system/fonts/AGENTS.md`); OFL permits their use in images. All data
are synthetic; Riverside University is fictional.

## Assumptions about the product

- The agent can install R into the user's own account with micromamba with no
  administrator rights. That holds for a native Linux account with network
  access, which is how Open Habitat runs agents.
- `duckdb dyes.duckdb < …` assumes the DuckDB CLI is installed. The page's
  output came from DuckDB's Python package, which uses the same table
  renderer. The CLI's `varchar`/`int64` type row is dropped in the shortened
  output.

## For Jari

- The bracket and the grey "previous run" rings are drawn by Frank's script
  itself (it keeps `results/*.csv` between runs), so the rerun figure is
  honestly what the second run produces.
- p = 0.04 in the reply is the printed 0.0385, rounded.

## Engine needs

- `image()` has no responsive source. This block writes its own
  `<picture><source media="(max-width: 560px)">` around `image()` so that
  phones get a narrower plot with larger text. A `srcset`/`sources` option in
  the kit would let other figure blocks do the same.
