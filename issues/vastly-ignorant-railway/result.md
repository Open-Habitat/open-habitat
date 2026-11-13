# Result

Reproduced at 9/400 under load. `Catalog.Start`'s align / resume / Microsoft recovery and
migration goroutine, and the login drivers, were never joined. After the context was cancelled,
recovery still ran `finishResume` and `reconcile`, writing into the home after the test (and in
production, possibly the process) had ended.

Fix (product):
- `Catalog` has a `background` WaitGroup over Start's goroutines and every `driveLogin`.
- `Catalog.Stop()` cancels Start's context, runs the shutdown sequence (cancel attempts, set
  `stopping`, stop sync clients) and waits for that background work.
- The daemon defers `catalog.Stop()`.
- `relay.cancelAll` closes the relay so that no login starts after shutdown. Without this, Stop
  could wait on a driver nobody cancelled, because handlers get 5 s of grace while `startLogin`
  can wait 15 s (review finding).
- Tests that hand-rolled the shutdown now call `Stop`.

Checks: under load the stressed tests ran 1000× + 500× with 0 failures (before the fix, 9/400);
the integrations package passes at `-race -count=20`; `go vet` and gofmt are clean.

Review: one `/llm-review` finder pass (claude-fable-5-2). Two should-fix findings were confirmed
locally and fixed (login start after shutdown; gofmt). Nothing was refuted, and no verifier was
called.

## Decisions for later review
- Stop waits without a timeout. A tool that hangs in cleanup (`pi mcp remove` with a Background
  context in `dropStale`/`discardNew`) would hold daemon exit until systemd's stop timeout. I
  chose finishing the step over a time limit, because a time limit would bring back the
  half-done step. Not observed; no issue filed.
- A login started after shutdown answers `attempt_active`, not a new error code: the daemon is
  exiting anyway.
