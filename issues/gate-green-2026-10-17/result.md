# Result

The full clean gate passes on the final tree; the receipt is in the gate JSON
of this run (see the closing commit).

## Causes and fixes

1. **Provision `TestWriterSerializesAcrossInstances` race: the test fake was wrong.**
   `Writer.handleLocked` calls `Quota.Read` while holding the ledger `flock`, so
   calls really are serialized across writer instances; the race detector cannot
   see a kernel lock. The production `nativeQuota` is stateless. `fakeQuota` now
   carries a mutex, like `fakeHost` already did.
2. **The two lab-conversation cursor cases: the product was wrong.** c23cec8c
   (reconnect-live-cause) let a snapshot whose cursor equals the journal's end
   *every* recovery, to stop an invalid duplicate frame from trapping the tab.
   That is right for a duplicate or malformed frame, but after a sequence gap or a
   409 the same cursor reopens straight into the same gap or 409. The daemon's
   head cursor is never expired and always covers any frame it sent
   (`eventJournal.parse`), so a real daemon's next snapshot passes both cases.
   Recovery now records the sequence that proves its cause has passed (the gap
   frame's sequence; one past an expired cursor; the current cursor otherwise; a
   new daemon instance always passes) and, until a snapshot reaches it, asks
   again at the 1 s agent-snapshot pace instead of back-to-back. The tests were
   not changed; two unit cases cover the rule and fail on the old code.
3. **Found on the way: daemon `observe()` race.** It read `startupChoice` and
   `authError` after releasing `c.mu`, racing `awaitReady` (held messages,
   98e8d78c, landed after the gate run's daemon pass). Both are now captured in
   the existing critical section. `TestHeldMessagesAcrossDaemonRestart` and
   `TestHeldMessagesGoBeforeADirectSend` failed every run under `-race` before.
4. Two files on main were not gofmt-formatted (`pi_rpc_linux.go`,
   `processes_linux_test.go`).

## The six daemon Pi tests

Not flaky. `TestPiCredentialsNative`, `…UnsafeAndRawReferences`,
`…APIOnlyReadinessAndReplacement`, `TestPiDeviceNativeAndOwnership`,
`TestPiModelsNativeDefault` and `TestPiStartupChecksNotRepeated` need the pinned
Pi SDK in `internal/daemon/pi-device-test/node_modules`, which only the gate
installs. In a fresh worktree they fail deterministically ("native Pi
credentials unavailable"); after `npm ci --prefix internal/daemon/pi-device-test`
the package passed 3/3 under `-race`. TESTING.md now says so.

## Decisions for later review

- A recovery whose target sequence the daemon never reaches (only constructible
  by a forged, internally consistent gap frame) keeps polling the snapshot at
  1/s rather than giving up. Accepted: bounded rate, no stream reopen loop, and
  a real daemon cannot produce it.
- No UI change, so no paired screenshots.

## Review

Two `/llm-review` passes (gpt-6-astra finder; journal rule and daemon lock), no
confirmed findings; verifier not called because both finders were clean and the
surfaces carry no authentication or authority change.
