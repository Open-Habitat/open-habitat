# Result: approved registry already delivered

The decisions of 15 November 2026 approved implementation, not another design
round. That implementation already landed in `ba4b7cf1d600c2c4ff1c49065d2e992ae0e78a3c`
under `start-page-preview-renderer`. This run verified it and closes the stale
design issue; it makes no production, contract or browser-spec changes.

The verification traced the approved behavior through `previewRegistry.ts`,
`previewInput.ts`, `DocumentPreviewFrame.tsx`, `StartPagePreview.tsx` and
`app/startPageCheck.ts`: exact workspace-root path matching, one bundled lazy
start-page renderer, prepared Markdown/YAML/JSON input, daemon-checked content,
special view first, plain-document fallback and inert goal navigation. Offers
and attachments remain generic. No additional renderer or feature switch is
needed. The completed design document is removed; its proposal and the original
review remain in git history. Later phases in that proposal are not approved
work for this run.

## Decisions for later review

- Reuse the implementation already delivered rather than introduce a second
  registry or refactor working code merely to produce a code diff. The only
  approved special renderer is already registered and its existing regression
  tests cover matching, input preparation, failed checks and stale replies.
- No new product decision is required. The old result's claim that the daemon
  check route awaited approval was superseded by the recorded decision.

## Checks and review

Verified production revision: `41c214dcba83b80a5d491cea5e649ce2a7aca9da`.
Test commands ran with `umask 077`, an outer timeout and the scratch lease.

- `./scripts/test-focused.sh --area web`: passed static/type checks and all
  257 test files / 2,176 tests.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15300 ./scripts/test-focused.sh --area browser --spec start-page-preview.spec.ts`:
  all four host-backed synthetic Chromium cases passed, covering Finnish and
  US English at desktop and compact widths, unsaved content validation, inert
  goals, plain/special switching, generic JSON, accessibility and Explain cards.
- Focused self-review: compared the decisions with the existing implementation
  and reviewed this documentation-only diff. No session, contract, daemon state
  or authorization boundary changed, so no new independent review was required.
  The original implementation's independent route review is recorded in
  `issues/start-page-preview-renderer/result.md`; it was not rerun here.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py` and
  `git diff --check`: passed.

Logs are retained outside the repository under
`/var/tmp/agent-keep/preview-renderer-registry/` (`web.log`, `browser.log`).
No screenshots or captured HTML were produced. Go/contracts checks, live
installation verification and the full gate were not run: there is no runnable
change in this run. No new test-server behavior or private testing-note update
is introduced.
