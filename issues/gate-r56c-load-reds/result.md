# Result

Both reds were the tests, not the product. Done 3.11. on Birch, 8 cores.

## Go: `TestThePersonsStopAfterATypingWakeHoldsAcrossARestart`

**Mechanism.** The synthetic Pi in `held_linux_test.go` bound and listened
on its process socket (`OH_PROCESS_SOCKET`) inside the bridge thread, while
the main thread already answered `get_state`. So the daemon could see the
woken Pi idle, take the person's stop and send `shutdown` with
`person: true` before the fake listened. `close` ignores that request's
error, so `oh-person-stop` was never appended. A temporary log in
`piRPC.close` showed `connect: connection refused` in both failing runs and
`err=<nil>` in every passing one.

Real Pi has no such window. RPC mode awaits `rebindSession` →
`bindExtensions`, which awaits each `session_start` handler, before it
attaches the stdin reader (`rpc-mode.js`, `agent-session.js`,
`extensions/runner.js` in the pinned SDK). The companion's handler awaits
`server.listen` (`process-extension.mjs`). So the daemon's stop and branch
write order is sound. Fix: the fake listens before it reads stdin, and only
the accept loop stays in the thread.

| Run (`-test.count`, `timeout`-bounded `while :` loops) | Before | After |
| --- | --- | --- |
| 8 loops, no race, ×50 | 0/50 | — |
| 16 loops, `-race`, ×50 then ×60 | 3/110 | 0/150 |

## Spec: `attachment-documents.spec.ts:221` (PDF, embedded font)

**Mechanism.** The spec waited for the paperclip to be enabled, then
dispatched a synthetic `drop` through
`page.locator(".ah-conversation-stream").evaluate(...)`. Since
race-input-before-ready, the paperclip is enabled while the view opens. The
loading view's stream (`PendingConversation`) is a different element from
the opened view's, and the locator resolves the element before the function
runs in the page. When the opened view replaced the stream in between, the
event went to a detached node. It never bubbled to the document listener
where the composer takes drops, so no upload request was made, which the
trace confirms. A probe in the evaluated function logged `isConnected`. In
20 runs, both failures were `connected=false` with the live frame `opened`.
All 18 passing runs were connected, 13 of them in the `loading` view, and
their drops were taken. So the product accepts a drop while the view opens.
A person's drop always targets an element in the page.

Fix: `tests/conversation-view.ts` `dropFiles` finds the stream in the same
page task that dispatches the drop. `attachment-documents.spec.ts` and the
two drops in `attachments.spec.ts`, which had the same pattern, use it.

Counts: `OH_REPLY_DELAY_MS=250`, `--repeat-each 10`, 2 workers,
`OH_PORT_BASE=11650`, run as `browser-focused.py` builds it (`TMPDIR=/var/tmp`,
umask 077).

| Run | Before | After |
| --- | --- | --- |
| `:221`, seeds r56c-pdf, a, b, c, d, e, f (some repeated), ×10 each | 8/100 | — |
| `:221`, seeds r56c-pdf, a, d, e, f, ×10 each | — | 0/50 |
| both attachment specs whole, seed r56c-whole, ×10 | — | 0/40 |

In 80 of the before runs, temporary console logs in Composer were on. They
did not change the rate.

## Checks

`./scripts/test-focused.sh --area go --go-package ./internal/daemon`,
`--area web`, `--area browser --spec` for both attachment specs: passed.

## Review

The production daemon code is unchanged; only a test fixture and specs
changed. So the review was a focused self-review rather than `/llm-review`.

## Decisions for later review

None.
