# Result

Not a new race: the failing gate tree predates the fix. The clean-gate run
that failed tested a tree from the `bcc4d42c` era, which does not contain
`fe46148a` ("test: clean up title routes before page teardown",
`altogether-shocking-babies`). The quoted line numbers match that older file
(test at 3231, route at 3239, without the `try`).

The mechanism: the snapshot route handler awaits `route.fetch()` while the
page polls. A poll still in that handler when the test body ends reaches
`response.json()` after fixture teardown has closed the context. Playwright
1.63 then reports the target-closed error as "Response has been disposed",
because a fetched body is dropped only on explicit `dispose()` or context
close. `fe46148a` wraps the body in `try/finally` with
`page.unrouteAll({ behavior: "ignoreErrors" })`, which drops handlers still in
flight before teardown. Neither the test nor the product needed another change.

Evidence on Cedar's slots (ordinary `npx playwright test` from `web/`,
remote warm runner, `--grep "title dots follow" --workers 8 --retries 0`):

- With the `finally` cleanup removed (the pre-`fe46148a` shape):
  `--repeat-each 150` failed 7/150 with exactly
  `apiResponse.json: Response has been disposed`.
- Current test, unchanged: `--repeat-each 60` passed 60/60, and
  `--repeat-each 300` passed 300/300 while the whole lab suite (131 cases)
  ran in parallel for load.

## Decisions for later review

- Closed with no code change: the reported failure reproduces only without
  the cleanup that `main` already has.
