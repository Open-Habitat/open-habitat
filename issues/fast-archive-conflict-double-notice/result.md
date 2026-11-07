# Result

Archive's observation token was a hash of the native file's size/mtime/mode.
The recorded clear_queue → abort → archive sequence can append the final reply
and stop entries after the snapshot, invalidating that token even though nobody
changed the archive. The API regression reproduces this exact stale-observation
mechanism. The journal excerpt does not contain the submitted token or native
revision, so it cannot independently distinguish every control_uncertain branch.

The token now binds native ID, directory and file location, not changing content.
Archive still verifies workspace membership, settled readable history, writer
ownership/census and the current archive annotation; browser send admission is
still locked through annotation commit. No write is retried. Home-card recap
refresh uses native changed_at instead of the now-stable archive token.

Rail/conversation refusals own one transient notice, with a failure heading and
no misleading restore action. It expires after eight unpaused seconds, including
a full reading interval for a late failure, and a failure arriving after dismissal
still reopens the notice. The duplicate conversation-page banner is suppressed.

## Evidence

On the worker tree based on b5befbe4 (7 November 2026):
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed.
  Initial run lacked Python referencing; installed requirements-ci.txt into a
  disposable uv venv, then reran the entire package successfully.
- `./scripts/test-focused.sh --area contracts`: passed (96 schemas, 149 fixtures).
- `./scripts/test-focused.sh --area web`: passed, including the late-refusal
  notice lifetime regression. A first final check caught a missing intentional
  effect dependency use; corrected and reran successfully.
- `OH_PORT_BASE=15200 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec rail-archive.spec.ts`:
  2 passed. Host-backed synthetic browser coverage includes refusal uniqueness,
  expiry, restored row, absent undo, and delayed refusal after dismissal.
- `go test -race ./internal/daemon -run 'TestArchiveKeepsNativeHistoryAndRejectsUnknownWriters|TestCloseEmptyBrowserChild|TestArchiveStopsIdlePiButNotBackgroundWork' -count=1`: passed.
- Independent llm-review (claude-fable-5-1 finder, gpt-6-astra verifier) plus
  assess-findings: three UI findings confirmed and fixed (recap invalidation,
  dismissed notice, late timer); no remaining actionable findings. Review used
  --no-perf-log to avoid a corpus push during the requested no-push session.

No live-host test, full clean gate or whole browser suite was run. Native writer
census is an observation, not atomic exclusion against a terminal starting later;
that limitation is unchanged.

## Decisions for later review

- Bind archive observation to native identity/location rather than history
  content. Alternative: fetch a fresh token in the browser or retry a refusal.
  Archive changes reversible presentation, so a finished turn is not a conflict;
  source semantics fix all callers without extra reads or repeating writes.
- A late refusal replaces the currently shown archive notice, even if another
  archive happened meanwhile. Alternative: silently drop it or create a second
  banner. One actionable explanation is more useful than a stale success notice.
- Keep the existing eight-second notice lifetime, paused by hover/focus/folding;
  give a newly received refusal a full interval. No new timing policy or layout.
