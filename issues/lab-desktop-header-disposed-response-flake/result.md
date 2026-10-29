# Result

Cause: a `route.fetch()` response body lives in the browser context's request
context, and closing the context clears it (Playwright 1.63
`APIRequestContext._disposeImpl`). The lab header's Git chip polls; a read that
started just after the last assertion was still between `route.fetch()` and
`response.json()` when the context closed, and its handler's throw landed in
the case's teardown.

Fix, in `web/tests/worker-host.ts`: the shared `page` fixture of every host
and lab spec now unroutes with `behavior: "ignoreErrors"` after the case body
and its `afterEach` hooks, before the context closes. This is Playwright's own
remedy for handlers in flight at the end of a test. A handler error during the
case still fails it; only errors thrown after the unroute are swallowed. All
47 specs and helpers with the `route.fetch()` + body pattern use this fixture,
so they are covered without per-spec edits. The three per-spec
`afterEach(unrouteAll({ behavior: "wait" }))` teardown hooks (spinoffs,
ended-worker-ask, lab-sidebar-account) were redundant now and were removed.
Mid-test `unrouteAll` calls that drain before follow-up requests remain.

`lab-desktop-header.spec.ts` also had two timing waits: a fixed
`waitForTimeout(100)` before reading the row, now replaced by a `toPass` loop
that reads until the row holds and its `data-shorten` steps are the same on two
reads; and two separate reads of the tooltip text and `aria-label` (the
duration ticks while the turn runs), now replaced by one atomic read.

Evidence (Birch, `OH_PORT_BASE=7200`, `OH_BROWSER_WORKERS=2`):

- Forced repro: a Git read sent after the last assertion and held until the
  page closed failed with `apiResponse.json: Response has been disposed`
  without the fixture change and passed with it (temporary spec edit,
  reverted).
- `lab-desktop-header.spec.ts --repeat-each 5`: 20/20 alone, 20/20 under a
  4× `yes` CPU hog.
- spinoffs (5), ended-worker-ask (3), lab-sidebar-account (2) pass;
  `test-focused.sh --area web` passes.

Review: focused self-review (test-only change).

## Decisions for later review

- `ignoreErrors` rather than `wait` in the shared fixture. `wait` would hang
  teardown on any spec whose handler holds a request on a promise the test
  never releases; and once the case is over, an in-flight handler has nothing
  left to prove.
- The fix sits in the shared fixture, not in each spec's handler (for example
  a try/catch plus `route.fallback()`). Per-spec catching would have to be
  repeated in 47 places and could swallow a real disposal during the case.
