# Result

`scripts/test-ui-reference.py` now copies the entry scripts together with the helpers they
`source` (`$repo/scripts/x.sh` or `$(dirname "$0")/x.sh`), transitively, and asserts that
`scratch.sh` arrived. A new helper needs no list update. The other `scripts/test-*.py` that copy
scripts (`test-prepare-release`, `test-gate-receipt`, `test-screenshots-to-avif`) copy scripts
that source nothing, so they were left as they are.

Checks: `scripts/test-ui-reference.py`, `test-prepare-release.py`, `test-gate-receipt.py`,
`test-screenshots-to-avif.py` and `test-test-focused.py` all pass.

## Decisions for later review
- I parse `source` lines with a regex rather than copying the whole `scripts/` directory.
  Copying everything would also bring along scripts that the fixture deliberately leaves out.
  A form the regex misses fails loudly, as the original "No such file" did.
