# Result: snapshot-refresh-live spec under load

The test-side race the issue suspected. The spec waited for the recovered
snapshot with `page.waitForResponse` and read each candidate's body with
`response.text()` inside the predicate. Under load, Chromium can drop a
body before Playwright asks for it (a superseded or cancelled read).
`Network.getResponseBody` then fails, the predicate throws and the whole
wait rejects. No product behaviour was involved.

The route handler that already injects the failures now also serves the
recovered reads. It fetches the host's answer with `route.fetch()`, checks
the body in Node (where it cannot be evicted) and counts a recovery only
when the page received it. A read already in flight when the failures
began is not counted. The test still proves the same thing: after the
failures end, the page reads the host again by itself and no connection
notice ever appears.

## Evidence

- `--repeat-each 5` under four `yes` processes: 5/5; alone 1/1; under twelve
  `yes` processes with four workers `--repeat-each 12`: 12/12.

## Decisions for later review

- None beyond the test change; no product fault was found.
