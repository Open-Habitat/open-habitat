# Result

Repeated `--spec` now retains and validates every filename in the Python runner.
The shell no longer keeps a misleading last-only validation variable. Added
seven subprocess regression tests through the actual shell entrypoint, with a
fake `npx`; the clean gate runs them. TESTING.md includes the multi-spec form.

## Evidence and review

On Birch, the working tree committed with this result passed:
- `python3 scripts/test-test-focused.py` (7 tests): repeated selections and tag,
  invalid earlier selections (including empty/missing/specialist demo), mixed
  configs and nonzero exit propagation, lab selection, single spec, tag-only,
  and whole-suite forwarding with a private lock.
- `bash -n scripts/test-focused.sh scripts/ci-local.sh`
- `git diff --check`
- `python3 scripts/validate-project-view.py`
- `issuectl doctor --json`: no schema/parse errors; existing PNG evidence notices.

Focused self-review checked all-before-launch validation, argument boundaries,
configuration grouping, first failure preservation and unchanged suite locking.
This is runner-selection evidence, not browser/product evidence: no browser
spec, web code, Go package or contract changed; no npm install or browser suite
was needed or run. The full clean gate remains the conductor's check.

## Decisions for later review

Mixed ordinary/lab selections run once per configuration, continuing the other
group after a test failure and returning the first nonzero status. Alternatives
were rejecting mixed selections or choosing one config (which silently excludes
some files). Grouping satisfies the request to run every selected spec without
rebuilding for each file. Explicit `--lab` retains its existing override meaning.
No product/security decisions were needed.
