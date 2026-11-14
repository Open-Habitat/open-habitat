# Result

Fixed the detector fixture, not the product rail. Parked workers now exist in
synthetic native Taskfleet state with ended Pi turns. Both parents have readable
history, and the test checks the unmodified host snapshot for both idle-worker
counts after creating the second conversation. The first parent must also finish
its turn before the test leaves its reply. Snapshot interception now only ages
timestamps.

## Evidence and limits

The original intermittent failure did **not** reproduce: 20/20 unchanged runs
passed with two timeout-bounded CPU busy loops, two browser workers,
`OH_REPLY_DELAY_MS=250`, `OH_REPLY_SEED=sweep-focus-repeat`, `OH_PORT_BASE=14700`,
`--grep 'Käynnissä rows' --repeat-each 20 --trace on`.
The final version passed 20/20 under the same load (two preceding corrected
fixture batches also passed 20/20 each). The full touched spec passed 3/3.
Focused web static/unit/component checks passed; `go test ./test/browser-host`
passed. Browser evidence is host-backed synthetic evidence, not live verification.

Earlier investigation also did not reproduce the failure and correctly noted
that ordinary host change patches do not replace worker counts. This run does
not establish that an unmodified event erased a snapshot override. In
`railNow.ts`, parked workers keep `live` true, but a new unread reply takes
precedence in group placement. Thus leaving before the parent settles can
legitimately move its row to Sinun vuorosi; worker-waiting alone is not a
settlement assertion. No evidence justified changing product membership rules.

Traces and logs are retained outside git at
`/var/tmp/agent-keep/rail-parked`: `before`, `after`, `final`, and `settled`
contain traced batches; `settled.log` is the final 20-run result. Probe traces
record two fixture-development failures (invalid run-ID length, then an empty
second parent with no readable history), both corrected before acceptance.
The initial baseline attempt needed the pinned Pi SDK fixture installed.
The focused Go wrapper rejects packages outside `./internal`; the browser-host
package was checked directly using the repository's short scratch helper.

Review: focused self-review of fixture isolation, native worker attribution,
parent settlement, assertions and unchanged product code. No daemon, contract,
session-state implementation or authority changes.

## Decisions for later review

- Use native-shaped workers instead of extending response interception to more
  endpoints: a raw host snapshot now independently verifies the fixture facts.
- Wait for the first parent to settle instead of forcing group membership or
  extending visibility timeouts. An unread reply legitimately belongs elsewhere.
- Keep timestamp aging as a narrow presentation seam; no clock or production
  freshness semantics changed.
- Close the fixture defect as fixed, without claiming a reproduced causal trace
  for the historical intermittent red. Before/after counts alone cannot prove
  that historical failure is eliminated.

Live check: no product behavior changed. On the test server, a conversation with
an idle worker should remain visible; a new unread parent reply may put it in
Sinun vuorosi instead of Käynnissä. Automated evidence uses synthetic workers.
