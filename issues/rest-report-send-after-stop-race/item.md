---
created: 2026-11-07
updated: 2026-11-07
type: bug
status: untriaged
priority: normal
provenance: ci
source_ref: taskfleet:01m6v4fwchjk9y365ebg4cn7t6/gate:rest-report-stop
originating_run: 01m6v4fwchjk9y365ebg4cn7t6
originating_run_kind: spinoff
---

# Daemon tests send right after Stop before the controller has recorded it (TestRestReportReadsTaskfleetWithoutStarting 409)

## Description

Observed in the conductor's clean gate on 2026-11-07 (`~/.local/state/oh-conductor/gate-r66b/stdout.json`): `TestRestReportReadsTaskfleetWithoutStarting` failed at `rest_linux_test.go:261`, send "Taas" answered `409 control_uncertain`. The daemon journal right before it shows `conversation_message_refused … state: stopping`. Passes alone.

Cause: the person's Stop (`ConversationController.stop`) marks the handle `stopping` and a goroutine closes Pi, then takes `c.mu` again to record `stopped`. The child is reaped (`liveChild` false) before that goroutine regains the lock. The test waits for "stopped" with `!h.live(c, id)`, which only checks the child, so under load the send lands in the gap and meets `stopping`, which send refuses by design. The product is consistent here: the journal invalidation that makes the browser reread status comes only after `stopped` is recorded. The same wait was used by six other rest/wake tests.

Fix: a `stopped` harness check that also requires the controller to have left `stopping`, used by every wait after a stop.
