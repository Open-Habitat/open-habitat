# Result

Fixed for Dropbox, Google Drive and Microsoft drive/library choices. Recursive inventory and quota admission now start only after explicit approval, in the existing background initial pass. The browser can close, navigate away and reload without stopping it. A fresh quota refusal prevents copying, retains the native login, and remains visible both in the dialog and on the account card after reload.

Implementation: `5b6c9f65`, rebased onto `545b0bb8`. Generated fingerprints were regenerated from the independent start-page and skill-history schema changes plus these integrations changes.

## Evidence

Final checks on that runnable revision (before evidence-only edits), with `TMPDIR=/var/tmp` and `umask 077`:

- `npm ci --prefix web`; `./scripts/test-focused.sh --area web`: formatting, lint, TypeScript, 89 files / 502 tests passed.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations`; `go test -race -count=1 ./internal/daemon/integrations`: passed.
- `./scripts/test-focused.sh --area contracts`: generation clean; 63 schemas, 69 fixtures, 40 scenarios and 17 negative checks passed.
- Browser suites ran serially through Fleetrepo's installed Cedar warm runner: `integrations.spec.ts` (6), `lab-integration-progress.spec.ts` (4), `lab-integration-inventory.spec.ts` (4), all passed, including affected a11y interactions.
- `issuectl doctor --json` (existing raster/large-binary advisories), `python3 scripts/validate-project-view.py`, `git diff --check`: passed.

The synthetic 500,000-file inventory is held behind a barrier: choice must arrive within two seconds with no inventory invocation, unknown sizes must be absent rather than zero, and only approval may start counting. Tests change available quota after choice, then prove admission/refusal, cancellation, retained login and no automatic sync after refusal. Provider-level regressions prove all three production choices issue no recursive command and measure only approved roots. Malformed, missing, oversized and unsafe totals refuse; explicitly measured zero remains valid. Existing provider sync/restart, dialog-close and ownership tests remain in place.

`review/` contains 16 synthetic screenshot/static-HTML pairs: choice, inventory, quota refusal and background refusal at desktop 1280 px / phone 390 px, light/dark. Self-review against the accepted `2026-10-18-integraatiot` prototype retained its account cards, mono paths, warning, dialog/steps and controls. Unknown sizes replace invented byte totals/bars. The review exposed desktop card squeezing; cards now wrap by their own width, with a browser path-layout assertion. Storybook imports the production pending-size, inventory, unavailable-site and quota-refusal states.

## Decisions for later review

- Kept the existing selection granularity: Dropbox/Google offer their whole drive root, Microsoft its discovered drive/library roots. No new top-level subfolder-selection/filter feature was added. Those choices need **no file listing at all**; deriving them locally is faster than even a non-recursive listing. Full recursive size queries run only for approved roots.
- rclone size supplies a final total, not a reliable intermediate count. Inventory therefore reports its phase and one-second elapsed heartbeat, without an invented percentage or total. Native transfer counters continue once copying starts.
- Unknown size/free space is omitted, not zero. A temporarily unavailable quota reader does not block choice, but admission fails closed after inventory. Quota refusals are fixed transient codes, including on the account card; no credential, inventory or persistent job store was added.

No real-provider throughput, live credentials, VM changes, distinct-UID proof or full clean gate is claimed. Microsoft live acceptance remains Jari's next attempt.

## Tool/workflow failures (all recovered)

- An initial search used a literal shell brace path, and optional exploratory filenames were absent; corrected the scoped paths. No required input was skipped.
- First Go run expected the old synchronous HTTP 422 quota refusal. Replaced that obsolete expectation with explicit background-admission/no-copy regressions. A subsequent compile found two test-local `out` declarations removed with that block; corrected them, then reran package/race checks successfully.
- First targeted-review invocation omitted the required value of `--diff-files` and was rejected before calling a model. Retried with explicit scoped paths.
- First new browser run clicked React Aria's hidden checkbox input; changed it to click the visible label and assert checked state. The later background-close addition exposed two existing close controls sharing a test ID; scoped to the first/header control. Final browser/a11y runs passed.
- Rebase conflicted only in generated contract fingerprints after main's independent start-page and later skill-history schema changes. Regenerated from both schemas and reran focused checks and browser suites on the rebased code.
- Staged `git diff --check` found trailing whitespace emitted in captured HTML styles. Normalized that whitespace in the static review files and reran the check; no runnable code or screenshots changed.
- npm reported six existing audit advisories; dependencies were unchanged. No audit remediation was attempted or claimed.

## Targeted review

One `claude-fable-5-1` review. Both candidates were handled locally: (1) confirmed unknown free space could display as zero when every folder was unticked; corrected the room-knowledge condition with a browser regression; (2) no current production entry lacked a measurer, but an unknown-size entry could otherwise bypass admission; added a fail-closed fallback and no-copy regression, retaining known-size synthetic entries. No residual issue filed. Scratch report: `history/review-integrations-speed-discovery.md`.

The reviewer's own Microsoft test attempts failed on unsafe group-writable scratch ancestry and reproduced there at its HEAD. These are environmental refusals, not a product-baseline claim. Supported package/race checks were rerun independently on the final source and passed; no reviewer's failed run is counted as validation.
