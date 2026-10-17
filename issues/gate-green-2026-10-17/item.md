---
created: 2026-10-17
updated: 2026-10-17
type: bug
reporter: conductor
status: fixed
priority: high
lane: unlaned
collision: [internal/provision, web/tests/lab-conversation.spec.ts]
preparation: ready
closed: 2026-10-17
---

# Clean gate red on main 2026-10-17: provision test race, two lab-conversation cursor cases

Full clean gate (`./scripts/ci-local.sh --clean --json`, umask 077, TMPDIR under /var/tmp) on main after the night stint, no other runs active: browser 41/43, Go/contracts red.
1. `internal/provision` `TestWriterSerializesAcrossInstances`: DATA RACE on `fakeQuota.Read` (writer_linux_test.go:606) written from two goroutines via `Writer.handleLocked` (writer_linux.go:489). Decide whether the fake needs synchronisation or the writer calls Quota.Read outside its serialisation; fix the real cause.
2. `web/tests/lab-conversation.spec.ts:736` "expired combined cursor waits for a newer snapshot without another send" and `:780` "combined stream reconciles a forced gap without reposting": reported by several workers on 2026-10-16/17 as pre-existing on main. Since then the event stream gained an immediate `: open` comment (live-disconnect-loop), the refresh pairs session and snapshot, and mutation replies carry journal cursors (ADR 0023). Find whether the tests or the product are wrong now and fix the right one; never weaken what the test proves.
Also report the six daemon Pi credential/device/model/startup Go tests workers called pre-existing: they passed in this gate run; say whether they are flaky.

## Acceptance Criteria
- [ ] `./scripts/ci-local.sh --clean --json` passes on the merged tree and writes a receipt.
