# Result

The gate installs `chromium` and `chromium-headless-shell` into its exported
`PLAYWRIGHT_BROWSERS_PATH` before running the device tests. The page-reader
failure now names `scripts/ci-local.sh` and gives a direct install command
with a reminder to use the same browser path.

## Verification

- `bash -n scripts/ci-local.sh` and `git diff --check`: passed.
- Fresh `git clone --no-local --single-branch` of commit `71e65106`, under a
  leased scratch TMPDIR; verified `.cache/ms-playwright` did not exist.
- Executed the exact prefix of `scripts/ci-local.sh` through the device-test
  command, using `bash -c` with `scripts/ci-local.sh` as `$0` and `--clean`.
  This preserves script-relative paths, the clean-tree check, setup, private
  HOME, browser cache environment and cleanup, without running later phases.
- With `OH_PORT_BASE=15100`, `OH_BROWSER_WORKERS=2` and a 900-second timeout:
  Chromium v1243, headless shell v1243 and FFmpeg downloaded into the clone's
  cache; all 77 tests passed, zero skipped. Dependencies finished in 78 seconds,
  exit 0. This is dependency-phase evidence, not a full clean-gate receipt.
- Focused self-review: verified install ordering and cache inheritance;
  inspected `test-focused.sh`, `browser-focused.py` and Go test invocations.
  Neither focused runner invokes the page-reader test. The Go runner installs
  the Pi SDK and invokes Go tests (one invokes `catch-up.test.mjs`); the browser
  runner invokes Playwright specs. No matching device-test ordering defect.

## Decisions for later review

Left the focused runners unchanged rather than adding unrelated browser
installation to their setup: neither runs the affected page-reader test.
Used the existing gate's exact dependency prefix rather than adding a new
public phase-selection option solely for this proof.

Live check: no server UI change; a fresh checkout can run the clean gate
without a pre-populated Playwright cache.
