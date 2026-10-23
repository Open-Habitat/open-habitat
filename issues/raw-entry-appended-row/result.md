# Result

The fallback in `WorkingProgress.tsx` serialized every unrecognized controller-status frame into a disclosure row. `entry_appended` was missing from its bookkeeping list. The fallback now renders nothing: known native control frames are silent, and unknown frames emit a fixed console diagnostic without their payload or even their untrusted type. A per-mount WeakSet avoids logging the same object again on rerender without retaining event payloads.

The typed live projection also no longer produces an unsupported-event notice; its unknown events reach the same diagnostic. Native history, typed supported live content, extension presentation and supported question controls are unchanged. No shared state ownership, host code, contracts, dependencies or tokens changed.

## Regression evidence

- Component regression supplies entry, queue, metadata, compaction, retry, RPC and extension bookkeeping frames, then unknown raw and typed events; checks silence, empty DOM and payload-free diagnostics across rerenders.
- Projection regression still tests extension replacement/clear and now requires no unknown-event presentation. This replaces the former test expectation that unknown native types became notices.
- The completed-turn Storybook story includes synthetic bookkeeping and an unknown frame alongside real production message components.
- `lab-raw-entry.spec.ts` injects synthetic controller-status frames through the actual browser read path, confirms normal send/answer still works, and audits the conversation with Axe at 1440 and 390 px in light/dark. These are same-UID synthetic-host results, not native provider or isolation evidence.

## Validation

Tested runnable source is the fix diff over `da3ccf6a`; final issue/evidence edits are metadata-only.

- `npm ci --prefix web`: passed.
- `./scripts/test-focused.sh --area web`, explicitly executed on the supported Cedar warm runner with `env OH_WEB_WORKERS=2`: formatting, lint, TypeScript and **536 tests / 93 files passed**. Command: `PYTHONPATH=~/.local/lib/fleetrepo/execution-runner python3 -m hbexec.warm --source "$PWD" run -- env OH_WEB_WORKERS=2 bash scripts/test-focused.sh --area web`.
- `./scripts/test-focused.sh --area browser --spec lab-raw-entry.spec.ts`: **4 passed**, including Axe at both widths/themes and paired static HTML/screenshots.
- `./scripts/test-focused.sh --area browser --spec lifecycle-frames.spec.ts`: **1 passed**, including four completed turns, DOM/paint sampling and reload.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py` and `git diff --check`: passed. Doctor reports only pre-existing raster/large-binary advisories in other issues.
- No Go/contracts changes; those suites and the full clean gate were intentionally not run.

Command logs remain at `/var/tmp/raw-entry-{web-budget,browser-final,lifecycle}.log`. The remote runner does not return artifacts automatically: fetched only this worktree's generated conversation captures through its pinned SSH route. Review material is in `evidence/conversation-{1440,390}-{light,dark}.{avif,html}`.

## Self-review

The accepted `Agentin vuoro` prototype and `design-system/design.md` put native conversation content in the thread, not technical RPC payloads. This fix removes only the unintended diagnostic presentation; it adds no visual elements or styles. Supported question controls remain separate from the removed raw fallback. Inspected all four captures against that transcript structure: user message, interim response, tool summary and final response remain; there is no technical frame/disclosure before or after them. Light/dark colors, existing message surfaces and 390 px wrapping are unchanged. Header/shell styling is outside this fix and remains another worker's area. No independent review was required: changes remain in presentation/diagnostics, not shared state, contracts or daemon behavior.

## Tool/sub-workflow inventory

- Initial focused web run overlapped further edits; its WorkingProgress test observed the earlier component version. It also hit the unrelated lazy-Markdown load timeout in `StartHere.test.tsx`. The final checks are rerun on stable files, using two workers for memory pressure.
- A second web invocation stopped at formatting after the final component edit. Applied Biome's formatting, then restarted the checks. Subsequent complete web runs had 535/536 tests passing, with only the same lazy-Markdown timeout. The package-manager dispatcher runs on Cedar and does not forward caller environment variables, so the apparent two-worker retry did not change its worker budget. The supported warm-workspace CLI with an explicit remote two-worker environment passed all checks.
- Initial browser regression used the ordinary host's `ordinary-dir` workspace name in a lab host, which has `aurinkokello` instead; all four cases stopped at that fixture lookup. Corrected the synthetic workspace selection and reran. The dispatcher also does not forward the capture flag or return local output directories, so captures now use Playwright's test output directory and were retrieved from the exact remote worktree.
- Discovery probes also found no local `.cache` or `web/test-results` after remote checks and no old `fleetrepo/bin/fleetrepo-heavy-command` location. Inspected the installed dispatcher and actual warm-runner implementation instead. `tw doctor` reported no attached seat; no screen, profile or seat operation is needed.
- Exploratory lookups found no `web/src/stories`, `web/vitest.config.ts`, or `web/tests/lab-a11y.spec.ts`; the actual stories live beside components, Vitest config is in `web/vite.config.ts`, and the new regression includes Axe directly. No required capability was lost.
- Optional Pillow AVIF conversion failed because the host Pillow lacks AVIF support. The installed `avifenc` converted the screenshots instead; originals were removed only after successful encoding. This did not affect testing or the paired HTML captures.
- Final staged whitespace check found trailing spaces in the generated offline HTML/CSS snapshots. Removed trailing line whitespace in the captures, reran the check and amended the local unpublished commit; no runnable code or screenshot content changed.
