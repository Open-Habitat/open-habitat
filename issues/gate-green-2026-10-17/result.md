# Result

The full clean gate passes on the final tree; the receipt is in the gate JSON
of this run (see the closing commit).

## Causes and fixes

1. **Provision `TestWriterSerializesAcrossInstances` race: the test fake was wrong.**
   `Writer.handleLocked` calls `Quota.Read` while holding the ledger `flock`, so
   calls really are serialized across writer instances; the race detector cannot
   see a kernel lock. The production `nativeQuota` is stateless. `fakeQuota` now
   carries a mutex, like `fakeHost` already did.
2. **The two lab-conversation cursor cases: the product was wrong, and two
   tests disagreed.** c23cec8c (reconnect-live-cause) let a snapshot whose
   cursor equals the journal's end *every* recovery at once, so an invalid
   duplicate frame could not trap the tab; d63b0e60 then rewrote the browser
   409 test to require that reopen, without running the lab cases that forbid
   it. Both requirements are right: an equal cursor after a gap or a 409 is not
   proof that the cause has passed (reopening at once replays the same failure
   in a loop), but recovery must not stay stuck when the fault clears and no
   native event follows. The daemon's head cursor is never expired and always
   covers a frame it sent (`eventJournal.parse`), so a real daemon's next
   snapshot passes; only a fault leaves it equal. Recovery now records the
   sequence that proves its cause has passed (the gap frame's; one past an
   expired cursor; the current cursor for a duplicate or malformed frame; a new
   daemon instance always passes). Until a snapshot reaches it, nothing is
   reseeded; after the transport backoff (3 s, growing to 30 s) the unchanged
   cursor is accepted and a fresh snapshot ends recovery, and **Yritä
   uudelleen** accepts it at once. Tests unchanged; two unit cases cover the
   rule and fail on the old code.
3. **Found on the way: daemon `observe()` race.** It read `startupChoice` and
   `authError` after releasing `c.mu`, racing `awaitReady` (held messages,
   98e8d78c, landed after the gate run's daemon pass). Both are now captured in
   the existing critical section. `TestHeldMessagesAcrossDaemonRestart` and
   `TestHeldMessagesGoBeforeADirectSend` failed every run under `-race` before.
4. Two files on main were not gofmt-formatted (`pi_rpc_linux.go`,
   `processes_linux_test.go`), and ADR 0023 was missing from the Project View
   manifest (`docs/glasspad.yaml`).
5. **`@placeholder lost creation reply …` was flaky (4 of 10 on base): the test
   was wrong.** Any successful snapshot read reconciles an uncertain creation,
   and the new session's own event requests one, so the live read sometimes
   reconciled before the test observed the uncertain view. The test now holds
   snapshot reads that start once the session exists until the reload, so it
   still proves both the uncertain view and that the reload read reconciles;
   15/15 after.
6. **`@workspace-slice @a11y … no serious axe` was flaky (seen in this run's
   second gate): the test was wrong.** It ran axe as soon as `main` was visible,
   which can be the loading landing or the login card's entrance fade, and
   reported half-faded text as low contrast; its later font check read a
   landing `h1` that was replaced mid-read. It now judges each state's own view
   after the loading landing has gone and animations have settled. 32/32 over
   eight repeats of the spec.

## The six daemon Pi tests

Not flaky. `TestPiCredentialsNative`, `…UnsafeAndRawReferences`,
`…APIOnlyReadinessAndReplacement`, `TestPiDeviceNativeAndOwnership`,
`TestPiModelsNativeDefault` and `TestPiStartupChecksNotRepeated` need the pinned
Pi SDK in `internal/daemon/pi-device-test/node_modules`, which only the gate
installs. In a fresh worktree they fail deterministically ("native Pi
credentials unavailable"); after `npm ci --prefix internal/daemon/pi-device-test`
the package passed 3/3 under `-race`. TESTING.md now says so.

## Decisions for later review

- A gap or 409 the snapshot cannot explain is retried after the ordinary
  transport backoff rather than given up on or retried at once. A real daemon
  cannot produce it, so the cost is only a 3–30 s banner during a proxy fault.
- No UI change, so no paired screenshots.

## Review

Two `/llm-review` passes (gpt-6-astra finder; journal rule and daemon lock), no
confirmed findings; verifier not called because both finders were clean and the
surfaces carry no authentication or authority change.
