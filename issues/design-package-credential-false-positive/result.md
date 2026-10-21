# Result

The match was `token = process.process_token`, a reference rather than a secret.
JS/TS generic assignment checks now require a quoted literal; known credential
signatures and URL query parameters remain checked in all text. Documents and
JS/TS comments still check unquoted values. Quoted object keys and backtick
literals are checked too. This remains a
heuristic scanner, not a guarantee that every possible secret is detected.

The same assembly exposed a second pre-existing match: a synthetic long process
handle in TerminalPanel's read-only Storybook fixture. It now uses the clearly
fake `fake-process-13` handle, without exempting stories from scanning.

Validation on this worker's implementation, based on
`551bf5624a424168436daa75171b4f8d8a9260ee`:

- `python3 .claude/skills/design-package/scripts/test_assemble.py`: seven tests
  pass, 1.70 seconds wall time on the final run. Includes actual source packaging, byte-for-byte
  ProcessTray inclusion, zip content, overwrite refusal and credential rejection
  before publishing either artifact.
- `npm ci --prefix web`: passes in 4.10 seconds; npm reports three existing
  dependency vulnerabilities (one moderate, two high); dependencies unchanged.
- `./scripts/test-web-fast.sh`: passes in 33.15 seconds (81 files, 477 tests,
  plus formatting, lint and type checks).
- `issuectl doctor --json`: no schema violations or parse errors.
- `python3 scripts/validate-project-view.py`: passes.
- `git diff --check`: passes.

Focused independent review: `claude-fable-5-1` identified a regression in URL
query and comment scanning; fixed with dedicated matching and regression cases.
Also adopted its isolated subtest cleanup suggestion and clarified the scanner
comment. Rejected its alternative of ignoring arbitrary identifier chains:
real alphanumeric secrets can also look like identifiers. Final tests include
all review-driven changes. Review completed successfully in 97 seconds.

An intermediate run still failed four assembly tests on the synthetic story
handle; fixed as described above. Logs: `/var/tmp/design-package-test.log`
(final passing run). No live credentials, browser profiles or host were used.
No Go changes or deployed feature; no live-server trial or browser behavior
claim. Storybook-only fixture data changes do not affect a browser journey.
