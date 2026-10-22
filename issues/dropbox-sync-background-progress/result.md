# Result

Fixed for Dropbox, Google Drive and Microsoft files. Microsoft Graph discovery/sign-in logic was not changed.

**Cause:** the PUT's 1.5 seconds was only the relay settling window. Afterwards `driveLogin` recursively ran `rclone size` before folder choice; after approval, `ChooseFolders` ran the initial `bisync --resync`. Both looked like the same spinner, and dialog close cancelled the native work.

**Now:** post-paste exchange/listing completes or reports expiry within 60 seconds; device-code inventory also has a 60-second bound. An approved first pass survives dialog close, Settings navigation and reload. Native rclone JSON stats supply phase, current-pass elapsed time, bytes, files and a progress bar. Settings polls every 15 seconds while visible and syncing, then shows native final health or an explicit failure/retry action. A separate explicit stop retains the native login and copied files. Failed/active initial passes cannot start steady supervision merely because native listing pairs exist.

## Evidence

All checks used synthetic credentials/homes. Implementation: `e3f9e24c107c855befd097b9146a8fcd87a9c798` (final runnable bytes; only an explanatory Go comment changed after the post-review suite). Final runnable source passed:

- `npm ci --prefix web`; `./scripts/test-focused.sh --area web`: format, lint, TypeScript, **88 files / 497 tests**.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations`; `TMPDIR=/var/tmp go test -race -count=1 ./internal/daemon/integrations` (12.360 s). Regressions cover expiry/cleanup, device deadline masking, explicit stop versus replacement, bounded/redacted native output, failed native exits, surviving listing pairs and SharePoint counter attribution.
- `./scripts/test-focused.sh --area contracts`: fingerprints clean; 63 schemas, 68 fixtures, 40 scenarios, 17 negative checks.
- `./scripts/test-focused.sh --area browser --spec integrations.spec.ts`: **6 passed**, including a11y and pre-choice cancellation.
- `./scripts/test-focused.sh --area browser --spec lab-integration-progress.spec.ts`: **4 passed**, desktop/390 px × light/dark; close/navigation survival, explicit stop, failure/recovery, a11y and layout regression. Browser suites ran serially through the installed remote wrapper on Cedar.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, `git diff --check`: passed with doctor's raster/oversized-image advisories. npm reported six existing audit advisories; dependencies were unchanged.

Storybook gained production-component initial-pass, background and failure stories. Eight final PNG/static-HTML pairs are under `review/` (`sync-{dialog,background}-{1280,390}-{light,dark}`). Self-review against the accepted Tili prototype retained its account cards, mono directories, understated byte bar, warning, dialog and compact wrapping. The first capture exposed desktop flex squeezing; counters now sit below the directory, with a regression assertion.

One targeted `claude-fable-5-1` review; five candidates locally confirmed and repaired: excessive provider probes, missing explicit stop, spurious sibling re-login, masked device deadlines and Microsoft pass/service attribution. Final checks above were rerun afterwards. Scratch review/assessment: `history/review-dropbox-background-sync.md` and `history/assessment-dropbox-background-sync.{json,md}`. No residual issue filed.

**Limits:** no real-provider throughput/credentials, live-host capture, distinct-UID proof or full clean gate claimed.

## Decisions for later review

- Retained the existing single native initial-pass/write exclusion, not a persistent job service. Another integration sign-in waits until completion or explicit stop; mutations refuse busy rather than queue for hours. Stop respects the originating browser lease.
- Counters are transient, service-attributed observations of the **current native pass**, not aggregate/durable job state. Microsoft counters reset between libraries. Restart rederives readiness from native listings; incomplete state is not automatically resynced.
- Preserved recursive inventory and quota admission. Inventories exceeding the sign-in bound fail clearly rather than inventing sizes or bypassing quota.

## Tool/workflow failures, all recovered

- First Go run failed the superseded cancellation/deletion expectation. Updated it to prove explicit-stop retention/replacement exclusion; final package/race and close-without-cancel browser cases passed (`/var/tmp/dropbox-go-tests.log`).
- Prettier was not installed; used repository Biome. A substring edit and a mistyped gofmt filename failed before successful targeted retries and final checks.
- Optional scoped instructions and outdated fixture/spec/schema filenames were absent; located/read the actual sources. No required input was omitted.
- Warm-runner executable was absent from PATH; its documented Fleetrepo absolute path worked. All bounded, basename-only screenshot transfers succeeded; no local browser fallback.
- `fixed` initially refused the incoming `improvement` type. Retyped this observed live defect to `bug` through issuectl and closed `fixed`, preserving its schedule/provenance.
