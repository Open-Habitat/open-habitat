# Result

Fixed the active conversation's status refresh to use `acceptance: pending`, including `execution: failed` / `pi_start_failed`. Removed the dead attention-clearing and fragment-resetting branches.

## Decisions for later review

- Refresh status on pending receipts rather than removing the branch: a held start failure must reach the composer from its event, without another poll or navigation. The receipt itself is not a full status, so retain the existing authoritative read.
- Remove command-based attention clearing rather than substituting acceptance: a queued message does not resolve an outstanding question. `question.resolved` still clears it.
- Remove command-based fragment reset rather than substituting acceptance: queuing behind a live answer or failing to start must not erase that answer or its truncation marker. Native turn/history events remain responsible for the live tail.

## Verification

Focused self-review against the event contract, held-failure producer and store routing; no daemon or contract changes. Updated the two tests that invented `state: pending`; added parameterized active-conversation tests for queued and failed pending receipts, immediate status reads, retained fragments and retained truncation state.

- Focused web checks: passed, 215 files / 1655 tests.
- Existing host-backed synthetic `queued-send.spec.ts` failed-start/retry journey: passed. It verifies the visible failure, retained message and single delivery after retry; unit tests isolate event-driven refresh without polling. No duplicate browser journey added.
- Initial browser attempt lacked the pinned Pi SDK fixture; installed its locked dependencies with scripts disabled and reran successfully.

Live check: when a sent message is held during an unsuccessful Pi start, the composer should show the failure without navigating away; retry should retain and deliver the message once. Queuing while an answer streams must leave that answer visible.
