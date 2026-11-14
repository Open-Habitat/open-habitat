# Result

Fixed the recap scheduling race and made the browser case wait for the state it measures.

## Cause and repair

The background queue was not running concurrent jobs. A fast Pi could publish a
settled turn while `finishPrompt` still had its state pending. Publication could
not schedule a recap, and the later acknowledgement changed the state to idle
without scheduling one. The original queue test reproduced this on repetition
24 under the race detector. Merely waiting for a timer also failed: the timer
was genuinely missing, not just late.

`finishPrompt` now schedules a verified, published settlement when it returns to
idle, including a rejected steer/follow-up whose active turn meanwhile settled.
Native starts discard the previous turn's settlement proof. Publication records
its quiet-period origin even if acknowledgement is still pending. The original
queue test remains unchanged; added tests hold the prompt acknowledgement until
after publication and cover rejected queue writes and old settlement proofs.

The browser case passed alone and 20 moderate-load repetitions before changes.
Stronger load exposed two incorrect test assumptions: an empty conversation
already counts in Your turn, and a visible next-waiting row can temporarily
unmount when status becomes stale. Setup now waits for send acceptance and native
settlement before leaving the writer. It avoids a redundant hard navigation.
Axe and geometry assertions wait boundedly for the freshness-dependent row.
Their accessibility and layout assertions are unchanged.

The history-read changes in `a95dea58`/`dfec2cd4` do not alter next-waiting's
freshness rule. Rail counting was not evidence of a completed reply; neither the
background slot nor a first-history cancellation fix was needed for this browser
failure. The original gate artifact was no longer available, so the browser
claim is based on locally reproduced failures, not an assertion that its missing
trace had an identical failing line.

## Verification

Final runnable Go changes:
- 50 consecutive targeted runs, each `-race -count=1`, through
  `scripts/test-focused.sh --area go --go-package ./internal/daemon`, selecting
  the original queue test and the three new regression tests. Two bounded busy
  loops and `GOMAXPROCS=2`; all passed.
- One completed whole-daemon-package race run: passed in 395.862 seconds.
  An earlier whole-package attempt was interrupted by the outer tool timeout;
  it is not counted as a pass. No repeated whole-package stress loop was run.

Final browser spec:
- Acceptance case: 20/20 passed with two workers, 4× browser CPU throttling,
  0–250 ms reply jitter, two bounded busy loops and concurrent package testing.
- All four next-waiting cases passed through the focused entry point.
- Earlier iterations used additional loaded batches, including 8× CPU and
  0–1000 ms jitter; their failures drove the setup and freshness-wait repairs.

Fast web checks passed (216 files, 1674 tests). Contract generation and validation
passed (98 schemas, 157 fixtures, 44 scenarios). No full browser suite, clean gate,
real provider, or separate-UID deployment check was run. Browser evidence is
host-backed synthetic evidence, not live-host verification.

## Review

Independent `/llm-review`: finder `claude-fable-5-2`, verifier `gpt-6-astra`, two
calls, followed by `/assess-findings`. Fixed the new test's title/quiescence race,
removed the proposed timer wait from the original test, discarded old native
settlement proofs, used the existing 25-second setup budget, and covered the
rejected queue-message ordering found by the verifier. No findings remain open.

## Decisions for later review

- Keep queue serialization unchanged: the observed missing job arose before
  enqueue, not from concurrent queue workers.
- Keep next-waiting's deliberate hiding during stale status; wait for a mounted
  row instead of changing product freshness semantics to stabilize a test.
- Do not add a settlement-generation store: clearing the superseded native proof
  at a new native run keeps the existing single settlement record authoritative.

Live check: with automatic recaps enabled, let several short conversations finish
and later become idle-stopped; their owed recaps should still run one at a time.
While a held conversation works, next-waiting should open after send acceptance,
track other waiting replies, and close when this turn finishes.
