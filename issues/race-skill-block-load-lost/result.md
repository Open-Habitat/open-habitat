# Investigation — 10 November 2026

**Still open; no confirmed cause or fix.** Investigated first in run
`01m720vap8bg1vfbbd1y2xyd7z`, starting from `bb5241c0f` (same product/spec bytes
as the reported main failure). No skill/history product or spec edits landed.

On Birch, umask 077, a short disk-backed TMPDIR, two workers, port base 16400,
all commands timeout-bounded. From `web/`:

`npx playwright test --config playwright.lab.config.ts tests/lab-skill-invocation.spec.ts --repeat-each 6 --trace on`

- D250, `sweep-focus`: 36/36 pass.
- D250, `sweep-lab-repeat`: 35 pass; one 390/light failure earlier at line 119:
  fallback skill chip was clicked but the reader title did not appear.
- D250, `sweep-lab-repeat`, `-g '1440 light' --repeat-each 18`: 17 pass,
  one failure at the same earlier reader-opening assertion.
- D250, `sweep-focus`, CPU4, `-g '1440 light' --repeat-each 6`: 6/6 pass.

The reported ARGUMENT END block-load failure did not recur. The new reader
failure is recorded here as a related investigation lead, not declared the same
cause. The click can cross the live-to-native message transition; inspect
component identity and reader ownership around that transition. For the original
block failure, ReadableBlock deliberately fences reads by entry/revision and
resets loaded content on a source change; the spec's neutral status/reload is
not by itself proof that no further native revision will arrive. Neither lead
has been established as the cause, so no speculative rewrite or extra wait was
committed.

Disposable logs: `/var/tmp/residuals-skill-{before,before2,probe,cpu}.log`.
The earlier failures are not hidden as passes. No default-delay repetition,
fix acceptance matrix, or live verification is claimed. Per the brief's
unsettled-issue exception, this remains open while the independently verified
rail action fix lands.

## Decisions for later review

Stop this investigation after four bounded detector batches rather than change
revision fences or make the spec wait for an unproven precondition. Follow-up
needs a retained failing block trace or deliberate transition instrumentation.
